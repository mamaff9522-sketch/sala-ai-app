/**
 * Bank transfer / PromptPay top-up.
 * Credits are not added when a request is created or a slip is uploaded.
 * Only an admin confirm calls adjustFirestoreCredits. If Firestore credentials
 * are missing, confirm fails and the request stays pending.
 *
 * Receiving account fields start empty. This repo does not know the account
 * number, account name, or PromptPay ID — the admin types them in the admin form.
 * They are stored on the admin Firestore profile users/{adminUid} (bankName,
 * accountNumber, accountName, promptPayId), not in a source file and not only
 * in data JSON. Slip images stay under data/slips/ (gitignored).
 * A matching slip read never grants credits.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';
import type { Express, NextFunction, Request, Response } from 'express';
import {
  isAdminIdentity,
  verifyFirebaseIdToken,
  verifySessionToken,
  type VerifiedFirebaseClaims,
} from './serverAuth';
import { readAdminEmails } from './adminAllowlist';
import {
  CREDIT_CATALOG,
  CreditPersistError,
  chargeFromUsageMetadata,
  deductUsableCredits,
  ensureCanCallFlashLite,
  getAdminFirestore,
  grantPaidTransferCredits,
  isRealCreditUid,
  assertFirestoreCredentialConfigured,
} from './serverBilling';

const require = createRequire(import.meta.url);
const generatePromptPayPayload: (target: string, options: { amount?: number }) => string = require('promptpay-qr');
const QRCode: {
  toDataURL: (text: string, options?: Record<string, unknown>) => Promise<string>;
} = require('qrcode');

const SLIP_MAX_BYTES = 5 * 1024 * 1024;
const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface PaymentSettings {
  bankName: string;
  accountNumber: string;
  accountName: string;
  /** Thai mobile (10 digits, leading 0) or 13-digit national/tax id. Empty until the admin sets it. */
  promptPayId: string;
  /** Basename of an admin-uploaded QR image inside the data directory. Empty if none. */
  qrImageFile: string;
}

export interface TransferRequestRecord {
  reference: string;
  uid: string;
  email: string;
  packageId: string;
  amountThb: number;
  credits: number;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: string;
  slipFile?: string;
  slipMime?: string;
  slipUploadedAt?: string;
  confirmedAt?: string;
  rejectedAt?: string;
  remainingCredits?: number;
  grantedCredits?: number;
  /** Gemini slip read. A match does not grant credits. failed=true means the admin must decide. */
  slipRead?: SlipRead;
}

/** Same model server.ts uses for character and location photos. Not the image-generation model. */
export const SLIP_READ_MODEL = 'gemini-3.1-flash-lite';

export interface SlipRead {
  failed: boolean;
  error: string | null;
  senderName: string;
  amountThb: number | null;
  transferredAt: string;
  reference: string;
  raw: unknown;
  model: string | null;
  referenceMatch: boolean;
  amountMatch: boolean;
  matched: boolean;
  differences: string[];
}

export type GeminiClientFactory = (customApiKey?: string) => {
  models: { generateContent: (req: any) => Promise<{ text?: string }> };
} | null;

let geminiClientFactory: GeminiClientFactory | null = null;

export type CreditAdjuster = (targetUid: string, delta: number, reason: string) => Promise<number>;

export type ConfirmResult =
  | { ok: true; already: boolean; granted: boolean; remainingCredits: number | null; creditsAdded: number }
  | { ok: false; status: number; message: string };

const EMPTY_SETTINGS: PaymentSettings = {
  bankName: '',
  accountNumber: '',
  accountName: '',
  promptPayId: '',
  qrImageFile: '',
};

export function transferDataDir(): string {
  return process.env.SALA_TRANSFER_DATA_DIR || path.join(process.cwd(), 'data');
}

function requestsPath(): string {
  return path.join(transferDataDir(), 'transfer-requests.json');
}

function slipsDir(): string {
  return path.join(transferDataDir(), 'slips');
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJson(file: string, data: unknown): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function firebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
    return String(cfg.projectId || '');
  } catch {
    return '';
  }
}

/** Same derivation as server.ts SESSION_SECRET so local sessions verify identically. */
export function localSessionSecret(): string {
  const projectId = firebaseProjectId();
  return process.env.SESSION_SECRET || (projectId ? `sala-session-secret-${projectId}` : 'sala-ai-default-session-secret-2026');
}

export function normalizePromptPayId(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

export function isValidPromptPayId(id: string): boolean {
  if (!id) return false;
  if (/^0\d{9}$/.test(id)) return true;
  if (/^\d{13}$/.test(id)) return true;
  return false;
}

export function pickReceivingFields(data: any): PaymentSettings {
  return {
    bankName: typeof data?.bankName === 'string' ? data.bankName : '',
    accountNumber: typeof data?.accountNumber === 'string' ? data.accountNumber : '',
    accountName: typeof data?.accountName === 'string' ? data.accountName : '',
    promptPayId: typeof data?.promptPayId === 'string' ? data.promptPayId : '',
    qrImageFile: typeof data?.qrImageFile === 'string' ? path.basename(data.qrImageFile) : '',
  };
}

/** Reads bank fields from Firestore users docs of readAdminEmails(). Never reads a local JSON account file. */
export async function loadReceivingAccount(db?: any): Promise<PaymentSettings> {
  let database = db;
  if (!database) {
    try {
      assertFirestoreCredentialConfigured();
      database = await getAdminFirestore();
    } catch (err) {
      if (err instanceof CreditPersistError) return { ...EMPTY_SETTINGS };
      throw err;
    }
  }
  let best = { ...EMPTY_SETTINGS };
  let bestAt = '';
  let found = false;
  const seen = new Set<string>();
  for (const email of readAdminEmails()) {
    for (const field of ['email', 'receivingAccountEmail'] as const) {
      const snap = await database.collection('users').where(field, '==', email).limit(5).get();
      for (const doc of snap.docs || []) {
        const id = String(doc.id || '');
        if (seen.has(id)) continue;
        seen.add(id);
        const data = typeof doc.data === 'function' ? doc.data() : {};
        const at = String(data?.receivingAccountUpdatedAt || '');
        if (!found || at >= bestAt) {
          best = pickReceivingFields(data);
          bestAt = at;
          found = true;
        }
      }
    }
  }
  return best;
}

function cleanText(value: unknown, max: number): string {
  return String(value ?? '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

export async function saveReceivingAccount(
  adminUid: string,
  input: {
    bankName?: unknown;
    accountNumber?: unknown;
    accountName?: unknown;
    promptPayId?: unknown;
    qrImageFile?: string | null;
  },
  adminEmail: string,
  db?: any
): Promise<PaymentSettings> {
  const uid = String(adminUid || '').trim();
  if (!uid || uid.includes('/') || uid.includes('@') || uid.length < 6 || uid.length > 128) {
    throw new CreditPersistError('ไม่สามารถบันทึกบัญชีรับเงินได้ เพราะไม่มี uid ของแอดมิน', 400);
  }
  const database = db || await getAdminFirestore();
  const ref = database.collection('users').doc(uid);
  const existing = await ref.get();
  if (!existing.exists) {
    throw new CreditPersistError('ไม่พบโปรไฟล์ผู้ดูแลใน Firestore users/{uid} จึงยังไม่บันทึกบัญชีรับเงิน', 404);
  }
  const prev = typeof existing.data === 'function' ? existing.data() : {};
  const current = pickReceivingFields(prev);
  const promptPayId = input.promptPayId === undefined ? current.promptPayId : normalizePromptPayId(input.promptPayId);
  if (promptPayId && !isValidPromptPayId(promptPayId)) {
    throw new CreditPersistError('PromptPay ต้องเป็นเบอร์มือถือ 10 หลักขึ้นต้นด้วย 0 หรือเลข 13 หลัก หรือเว้นว่าง', 400);
  }
  const accountNumber = input.accountNumber === undefined ? current.accountNumber : cleanText(input.accountNumber, 40);
  if (accountNumber && !/^[0-9][0-9 \-]{0,39}$/.test(accountNumber)) {
    throw new CreditPersistError('เลขบัญชีใช้ได้เฉพาะตัวเลข เว้นวรรค หรือขีด หรือเว้นว่าง', 400);
  }
  const next: PaymentSettings = {
    bankName: input.bankName === undefined ? current.bankName : cleanText(input.bankName, 80),
    accountNumber,
    accountName: input.accountName === undefined ? current.accountName : cleanText(input.accountName, 120),
    promptPayId,
    qrImageFile: input.qrImageFile === undefined ? current.qrImageFile : (input.qrImageFile ? path.basename(input.qrImageFile) : ''),
  };
  const patch: Record<string, unknown> = {
    bankName: next.bankName,
    accountNumber: next.accountNumber,
    accountName: next.accountName,
    promptPayId: next.promptPayId,
    qrImageFile: next.qrImageFile,
    receivingAccountUpdatedAt: new Date().toISOString(),
  };
  const email = String(adminEmail || '').trim().toLowerCase();
  if (email) patch.receivingAccountEmail = email;
  if (!prev?.email && email) patch.email = email;
  await ref.set(patch, { merge: true });
  return next;
}

export function publicPaymentView(settings: PaymentSettings) {
  const hasUploadedQr = Boolean(settings.qrImageFile && fs.existsSync(path.join(transferDataDir(), settings.qrImageFile)));
  const hasGeneratedQr = isValidPromptPayId(settings.promptPayId);
  const configured = Boolean(
    settings.bankName || settings.accountNumber || settings.accountName || hasUploadedQr || hasGeneratedQr
  );
  return {
    bankName: settings.bankName,
    accountNumber: settings.accountNumber,
    accountName: settings.accountName,
    hasQr: hasUploadedQr || hasGeneratedQr,
    configured,
  };
}

/** Real PromptPay EMV payload from the promptpay-qr package (CRC16 included). Amount omitted => static QR. */
export function buildPromptPayPayload(promptPayId: string, amountThb?: number): string {
  const id = normalizePromptPayId(promptPayId);
  if (!isValidPromptPayId(id)) {
    throw new CreditPersistError('ยังไม่ได้ตั้ง PromptPay ID ที่ถูกต้อง', 400);
  }
  const amount = amountThb === undefined ? undefined : Number(amountThb);
  if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
    throw new CreditPersistError('จำนวนเงินไม่ถูกต้อง', 400);
  }
  return generatePromptPayPayload(id, amount !== undefined ? { amount } : {});
}

function catalogPackage(packageId: unknown): { id: string; credits: number; priceThb: number } | null {
  const id = String(packageId || '');
  const pkg = CREDIT_CATALOG[id];
  if (!pkg) return null;
  return { id, credits: pkg.credits, priceThb: pkg.priceThb };
}

async function qrDataUrlFor(settings: PaymentSettings, packageId?: string): Promise<{ qrDataUrl: string | null; qrSource: 'uploaded' | 'promptpay' | null; package: { id: string; credits: number; priceThb: number } | null }> {
  const pkg = packageId ? catalogPackage(packageId) : null;
  if (settings.qrImageFile) {
    const file = path.join(transferDataDir(), path.basename(settings.qrImageFile));
    if (fs.existsSync(file)) {
      const buf = fs.readFileSync(file);
      const ext = path.extname(file).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      return { qrDataUrl: `data:${mime};base64,${buf.toString('base64')}`, qrSource: 'uploaded', package: pkg };
    }
  }
  if (!isValidPromptPayId(settings.promptPayId)) {
    return { qrDataUrl: null, qrSource: null, package: pkg };
  }
  const payload = buildPromptPayPayload(settings.promptPayId, pkg ? pkg.priceThb : undefined);
  const qrDataUrl = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: 320 });
  return { qrDataUrl, qrSource: 'promptpay', package: pkg };
}

function loadRequests(): TransferRequestRecord[] {
  try {
    if (!fs.existsSync(requestsPath())) return [];
    const parsed = JSON.parse(fs.readFileSync(requestsPath(), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRequests(list: TransferRequestRecord[]): void {
  writeJson(requestsPath(), list);
}

function newReference(existing: Set<string>): string {
  for (let attempt = 0; attempt < 8; attempt++) {
    const bytes = crypto.randomBytes(6);
    let code = 'SALA-';
    for (let i = 0; i < 6; i++) code += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
    if (!existing.has(code)) return code;
  }
  throw new CreditPersistError('สร้างรหัสอ้างอิงไม่สำเร็จ กรุณาลองใหม่', 500);
}

function wholeRequestAmount(value: unknown, label: string): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isInteger(n) || n < 1 || n > 100000) {
    throw new CreditPersistError(`ระบุ${label}เป็นจำนวนเต็มตั้งแต่ 1 ถึง 100000`, 400);
  }
  return n;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

/** Creates a pending transfer. Does not read or write any credit balance.
 *  A baht-only request stores no user-chosen credit count. The admin sets credits on confirm.
 */
export function createTransferRequest(input: { uid: string; email?: string; packageId?: unknown; credits?: unknown; amountThb?: unknown }): TransferRequestRecord {
  if (!isRealCreditUid(input.uid)) {
    throw new CreditPersistError('กรุณาเข้าสู่ระบบด้วยบัญชีจริงก่อนทำรายการโอน', 401);
  }
  const hasAmount = hasValue(input.amountThb);
  const hasPackage = hasValue(input.packageId);
  let packageId: string;
  let credits: number;
  let amountThb: number;
  if (hasAmount && !hasPackage) {
    amountThb = wholeRequestAmount(input.amountThb, 'จำนวนเงินบาท');
    credits = 0;
    packageId = 'custom_request';
  } else if (hasPackage && !hasAmount) {
    const pkg = catalogPackage(input.packageId);
    if (!pkg) {
      throw new CreditPersistError('แพ็กเกจไม่ถูกต้อง ราคาและเครดิตต้องมาจากรายการของเซิร์ฟเวอร์เท่านั้น', 400);
    }
    packageId = pkg.id;
    credits = pkg.credits;
    amountThb = pkg.priceThb;
  } else {
    throw new CreditPersistError('ระบุจำนวนเงินบาท หรือเลือกแพ็กเกจของเซิร์ฟเวอร์ ห้ามกำหนดจำนวนเครดิตเอง', 400);
  }
  const list = loadRequests();
  const record: TransferRequestRecord = {
    reference: newReference(new Set(list.map((r) => r.reference))),
    uid: input.uid,
    email: cleanText(input.email || '', 160),
    packageId,
    amountThb,
    credits,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  list.push(record);
  saveRequests(list);
  return record;
}

function findRequest(reference: string): { list: TransferRequestRecord[]; index: number } | null {
  if (!/^SALA-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(reference)) return null;
  const list = loadRequests();
  const index = list.findIndex((r) => r.reference === reference);
  if (index < 0) return null;
  return { list, index };
}

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function sniffImage(buffer: Buffer): { mime: string; ext: string } | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { mime: 'image/png', ext: '.png' };
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: '.webp' };
  }
  return null;
}

export function decodeImagePayload(body: any): Buffer {
  let raw = String(body?.imageBase64 || body?.dataUrl || body?.data || '');
  const match = raw.match(/^data:(image\/(?:jpeg|png|webp));base64,([a-z0-9+/=\s]+)$/i);
  if (match) raw = match[2];
  raw = raw.replace(/\s/g, '');
  if (!raw || !/^[a-z0-9+/=]+$/i.test(raw)) {
    throw new CreditPersistError('ไฟล์สลิปไม่ถูกต้อง รองรับ jpeg, png หรือ webp', 400);
  }
  const buffer = Buffer.from(raw, 'base64');
  if (!buffer.length || buffer.length > SLIP_MAX_BYTES) {
    throw new CreditPersistError('ไฟล์สลิปต้องมีขนาดไม่เกิน 5 MB', 400);
  }
  if (!sniffImage(buffer)) {
    throw new CreditPersistError('ไฟล์สลิปต้องเป็น jpeg, png หรือ webp', 400);
  }
  const claimed = String(body?.mimeType || body?.mime || '').toLowerCase();
  if (claimed && !IMAGE_TYPES[claimed]) {
    throw new CreditPersistError('ชนิดไฟล์สลิปไม่รองรับ', 400);
  }
  return buffer;
}

export function normalizeTransferReference(value: string): string {
  return String(value || '').replace(/[\s-]+/g, '').toLowerCase();
}

export function parseSlipAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function compareSlipToRequest(
  read: { reference: string; amountThb: number | null },
  expected: { reference: string; amountThb: number }
): { referenceMatch: boolean; amountMatch: boolean; matched: boolean; differences: string[] } {
  const referenceMatch = normalizeTransferReference(read.reference) !== ''
    && normalizeTransferReference(read.reference) === normalizeTransferReference(expected.reference);
  const amountMatch = read.amountThb !== null && Math.abs(read.amountThb - expected.amountThb) < 0.001;
  const differences: string[] = [];
  if (!referenceMatch) {
    differences.push(`รหัสอ้างอิงไม่ตรง: อ่านได้ "${read.reference || '—'}" แต่รายการคือ "${expected.reference}"`);
  }
  if (!amountMatch) {
    differences.push(`ยอดเงินไม่ตรง: อ่านได้ ${read.amountThb === null ? '—' : read.amountThb} บาท แต่แพ็กเกจคือ ${expected.amountThb} บาท`);
  }
  return { referenceMatch, amountMatch, matched: referenceMatch && amountMatch, differences };
}

function failedSlipRead(error: string): SlipRead {
  return {
    failed: true,
    error,
    senderName: '',
    amountThb: null,
    transferredAt: '',
    reference: '',
    raw: null,
    model: null,
    referenceMatch: false,
    amountMatch: false,
    matched: false,
    differences: [],
  };
}

/**
 * Sends slip bytes to gemini-3.1-flash-lite through the server's getGeminiClient().
 * Returns a failed read when the key is missing or the model call fails. Never grants credits.
 */
export async function readSlipWithGemini(image: Buffer, mimeType: string, getClient: GeminiClientFactory): Promise<SlipRead> {
  const ai = getClient();
  if (!ai) {
    return failedSlipRead('ไม่มี GEMINI_API_KEY จึงอ่านสลิปไม่ได้');
  }
  try {
    const response = await ai.models.generateContent({
      model: SLIP_READ_MODEL,
      contents: [{
        parts: [
          {
            text: `อ่านสลิปโอนเงินในภาพนี้ ตอบเป็น JSON เท่านั้น ห้ามใส่ markdown และห้ามเดาถ้าไม่เห็นในภาพ ให้ใช้สตริงว่างหรือ null
{"senderName":"","amountThb":null,"transferredAt":"","reference":""}
senderName = ชื่อผู้โอน
amountThb = จำนวนเงินบาทที่เป็นตัวเลข หรือ null
transferredAt = วันเวลาที่โอนตามที่เห็นในสลิป หรือว่าง
reference = รหัสอ้างอิงหรือข้อความในหมายเหตุการโอน หรือว่าง`
          },
          { inlineData: { mimeType, data: image.toString('base64') } }
        ]
      }],
      config: { responseMimeType: 'application/json' }
    });
    const text = String(response?.text || '').replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    if (!text) return failedSlipRead('โมเดลไม่ส่งผลอ่านสลิป');
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      return failedSlipRead('ผลอ่านสลิปไม่ใช่ JSON');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return failedSlipRead('ผลอ่านสลิปไม่ใช่ JSON object');
    }
    return {
      failed: false,
      error: null,
      senderName: cleanText(parsed.senderName, 160),
      amountThb: parseSlipAmount(parsed.amountThb),
      transferredAt: cleanText(parsed.transferredAt, 80),
      reference: cleanText(parsed.reference, 80),
      raw: parsed,
      model: SLIP_READ_MODEL,
      referenceMatch: false,
      amountMatch: false,
      matched: false,
      differences: [],
      usageMetadata: (response as any)?.usageMetadata ?? null,
    };
  } catch (err: any) {
    return failedSlipRead(String(err?.message || 'อ่านสลิปไม่สำเร็จ').slice(0, 300));
  }
}

/** Stores the slip, reads it, and leaves status pending. Does not add credits. */
export async function attachSlip(
  reference: string,
  uid: string,
  buffer: Buffer,
  read: (image: Buffer, mime: string) => Promise<SlipRead> = (image, mime) => readSlipWithGemini(image, mime, geminiClientFactory || (() => null))
): Promise<TransferRequestRecord> {
  const found = findRequest(reference);
  if (!found) throw new CreditPersistError('ไม่พบรายการโอน', 404);
  const record = found.list[found.index];
  if (record.uid !== uid) throw new CreditPersistError('รายการนี้ไม่ใช่ของคุณ', 403);
  if (record.status === 'confirmed') throw new CreditPersistError('รายการนี้ยืนยันแล้ว', 409);
  const sniffed = sniffImage(buffer);
  if (!sniffed || buffer.length > SLIP_MAX_BYTES) {
    throw new CreditPersistError('ไฟล์สลิปต้องเป็น jpeg, png หรือ webp และไม่เกิน 5 MB', 400);
  }
  ensureDir(slipsDir());
  const fileName = `${record.reference}${sniffed.ext}`;
  const full = path.resolve(slipsDir(), fileName);
  if (!full.startsWith(path.resolve(slipsDir()) + path.sep)) {
    throw new CreditPersistError('บันทึกสลิปไม่สำเร็จ', 400);
  }
  fs.writeFileSync(full, buffer);
  record.slipFile = fileName;
  record.slipMime = sniffed.mime;
  record.slipUploadedAt = new Date().toISOString();
  record.status = 'pending';
  delete record.remainingCredits;
  delete record.grantedCredits;
  let extraction: SlipRead;
  try {
    extraction = await read(buffer, sniffed.mime);
  } catch (err: any) {
    if (err instanceof CreditPersistError) throw err;
    extraction = failedSlipRead(String(err?.message || 'อ่านสลิปไม่สำเร็จ').slice(0, 300));
  }
  if (!extraction || extraction.failed) {
    record.slipRead = extraction?.failed ? extraction : failedSlipRead('อ่านสลิปไม่สำเร็จ');
  } else {
    const comparison = compareSlipToRequest(
      { reference: extraction.reference, amountThb: extraction.amountThb },
      { reference: record.reference, amountThb: record.amountThb }
    );
    const cleanRead = { ...extraction, ...comparison, failed: false, error: null } as any;
    delete cleanRead.usageMetadata;
    record.slipRead = cleanRead;
  }
  record.status = 'pending';
  found.list[found.index] = record;
  saveRequests(found.list);
  return record;
}

export function readSlipFile(reference: string): { buffer: Buffer; mime: string } | null {
  const found = findRequest(reference);
  if (!found || !found.list[found.index].slipFile) return null;
  const record = found.list[found.index];
  const full = path.resolve(slipsDir(), path.basename(record.slipFile || ''));
  if (!full.startsWith(path.resolve(slipsDir()) + path.sep) || !fs.existsSync(full)) return null;
  return { buffer: fs.readFileSync(full), mime: record.slipMime || 'application/octet-stream' };
}

const confirmLocks = new Map<string, Promise<void>>();

async function withConfirmLock<T>(reference: string, fn: () => Promise<T>): Promise<T> {
  const prev = confirmLocks.get(reference) || Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  confirmLocks.set(reference, prev.then(() => gate, () => gate));
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
  }
}

/**
 * Grants credits once via adjustFirestoreCredits.
 * A second confirm does not call the adjuster again.
 * If the adjuster throws (including missing Firestore credentials), status stays pending.
 */
export async function confirmTransferRequest(reference: string, adjust: CreditAdjuster = grantPaidTransferCredits): Promise<ConfirmResult> {
  return withConfirmLock(reference, async () => {
    const found = findRequest(reference);
    if (!found) return { ok: false, status: 404, message: 'ไม่พบรายการโอน' };
    const record = found.list[found.index];
    if (record.status === 'rejected') {
      return { ok: false, status: 409, message: 'รายการนี้ถูกปฏิเสธแล้ว จึงไม่ได้เติมเครดิต' };
    }
    if (record.status === 'confirmed') {
      return {
        ok: true,
        already: true,
        granted: false,
        remainingCredits: typeof record.remainingCredits === 'number' ? record.remainingCredits : null,
        creditsAdded: 0,
      };
    }
    if (!record.slipFile) {
      return { ok: false, status: 400, message: 'ยังไม่มีสลิป ยังไม่ได้เติมเครดิต' };
    }
    try {
      const grantAmount = record.credits > 0 ? record.credits : record.amountThb;
      if (!Number.isInteger(grantAmount) || grantAmount < 1) {
        return { ok: false, status: 400, message: 'ยังไม่มีจำนวนเครดิตที่แอดมินจะมอบ จึงไม่ได้เติมเครดิต' };
      }
      const next = await adjust(record.uid, grantAmount, `ยืนยันสลิปโอน ${record.reference}`);
      const latest = findRequest(reference);
      if (!latest) return { ok: false, status: 404, message: 'ไม่พบรายการโอน' };
      const saved = latest.list[latest.index];
      if (saved.status === 'confirmed') {
        return {
          ok: true,
          already: true,
          granted: false,
          remainingCredits: typeof saved.remainingCredits === 'number' ? saved.remainingCredits : null,
          creditsAdded: 0,
        };
      }
      saved.status = 'confirmed';
      saved.confirmedAt = new Date().toISOString();
      saved.remainingCredits = next;
      const grantedNow = saved.credits > 0 ? saved.credits : saved.amountThb;
      saved.grantedCredits = grantedNow;
      latest.list[latest.index] = saved;
      saveRequests(latest.list);
      return { ok: true, already: false, granted: true, remainingCredits: next, creditsAdded: grantedNow };
    } catch (err: any) {
      const again = findRequest(reference);
      if (again && again.list[again.index].status !== 'confirmed') {
        again.list[again.index].status = 'pending';
        saveRequests(again.list);
      }
      const status = err instanceof CreditPersistError ? err.status : (err?.status || 503);
      const message = err?.message || 'ยืนยันไม่สำเร็จ ระบบไม่ได้เติมเครดิต';
      return { ok: false, status, message };
    }
  });
}

export type RejectResult =
  | { ok: true; already: boolean }
  | { ok: false; status: number; message: string };

/** Marks a pending slip rejected. Does not grant or change credits. */
export async function rejectTransferRequest(reference: string): Promise<RejectResult> {
  return withConfirmLock(reference, async () => {
    const found = findRequest(reference);
    if (!found) return { ok: false, status: 404, message: 'ไม่พบรายการโอน' };
    const record = found.list[found.index];
    if (record.status === 'confirmed') {
      return { ok: false, status: 409, message: 'รายการนี้ยืนยันและเติมเครดิตแล้ว จึงปฏิเสธไม่ได้' };
    }
    if (record.status === 'rejected') return { ok: true, already: true };
    record.status = 'rejected';
    record.rejectedAt = new Date().toISOString();
    found.list[found.index] = record;
    saveRequests(found.list);
    return { ok: true, already: false };
  });
}

export function listTransferRequests(status: 'pending' | 'confirmed' | 'all' = 'pending'): TransferRequestRecord[] {
  const list = loadRequests();
  const filtered = status === 'all' ? list : list.filter((r) => r.status === status);
  return filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export interface TransferIdentity {
  uid: string;
  email?: string;
  via: 'firebase' | 'local-session';
  firebase?: VerifiedFirebaseClaims;
}

export async function authenticateTransfer(req: Request): Promise<TransferIdentity | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1]?.trim();
  if (!token) return null;
  if (token.startsWith('sala.')) {
    const session = verifySessionToken(token, localSessionSecret());
    if (!session) return null;
    return { uid: session.userId, via: 'local-session' };
  }
  const claims = await verifyFirebaseIdToken(token, firebaseProjectId());
  if (!claims) return null;
  return { uid: claims.uid, email: claims.email, via: 'firebase', firebase: claims };
}

function isAdmin(identity: TransferIdentity | null): boolean {
  return Boolean(identity && identity.via === 'firebase' && isAdminIdentity(identity.firebase, readAdminEmails()));
}

async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const identity = await authenticateTransfer(req);
    if (!identity) {
      return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' });
    }
    (req as any).transferIdentity = identity;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' });
  }
}

async function requireTransferAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const identity = await authenticateTransfer(req);
    if (!identity) {
      return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ (Unauthorized: Session Token Required)' });
    }
    if (!isAdmin(identity)) {
      return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ ต้องใช้สิทธิ์ผู้ดูแลระบบ (Forbidden: Admin Privileges Required)' });
    }
    (req as any).transferIdentity = identity;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ' });
  }
}

function sendError(res: Response, err: any) {
  const status = err instanceof CreditPersistError ? err.status : (err?.status || 500);
  res.status(status).json({ success: false, creditsGranted: false, message: err?.message || 'เกิดข้อผิดพลาด' });
}

function saveAdminQr(buffer: Buffer): string {
  const sniffed = sniffImage(buffer);
  if (!sniffed) throw new CreditPersistError('รูป QR ต้องเป็น jpeg, png หรือ webp', 400);
  ensureDir(transferDataDir());
  const fileName = `payment-qr${sniffed.ext}`;
  for (const ext of ['.jpg', '.png', '.webp']) {
    const old = path.join(transferDataDir(), `payment-qr${ext}`);
    if (fs.existsSync(old) && path.basename(old) !== fileName) fs.unlinkSync(old);
  }
  fs.writeFileSync(path.join(transferDataDir(), fileName), buffer);
  return fileName;
}

export function registerTransferRoutes(app: Express, getGeminiClient?: GeminiClientFactory): void {
  geminiClientFactory = getGeminiClient || null;
  app.get('/api/credits/transfer/settings', requireUser, async (req, res) => {
    try {
      const settings = await loadReceivingAccount();
      const view = publicPaymentView(settings);
      const qr = await qrDataUrlFor(settings, typeof req.query.packageId === 'string' ? req.query.packageId : undefined);
      res.json({
        success: true,
        settings: view,
        qrDataUrl: qr.qrDataUrl,
        qrSource: qr.qrSource,
        package: qr.package,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post('/api/credits/transfer/requests', requireUser, (req, res) => {
    try {
      const identity = (req as any).transferIdentity as TransferIdentity;
      const record = createTransferRequest({
        uid: identity.uid,
        email: identity.email,
        packageId: req.body?.packageId,
        credits: req.body?.credits,
        amountThb: req.body?.amountThb,
      });
      res.json({
        success: true,
        creditsGranted: false,
        message: 'สร้างรายการโอนแล้ว ยังไม่ได้เติมเครดิต กรุณาโอนเงินตามยอดแล้วอัปโหลดสลิป',
        request: {
          reference: record.reference,
          packageId: record.packageId,
          amountThb: record.amountThb,
          ...(record.packageId === 'custom_request' ? {} : { credits: record.credits }),
          status: record.status,
          createdAt: record.createdAt,
        },
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post('/api/credits/transfer/requests/:reference/slip', requireUser, async (req, res) => {
    try {
      const identity = (req as any).transferIdentity as TransferIdentity;
      const buffer = decodeImagePayload(req.body);
      let charge: { tokensUsed: number | null; creditsCharged: number; remainingCredits: number } | null = null;
      const record = await attachSlip(String(req.params.reference || ''), identity.uid, buffer, async (image, mime) => {
        let canRead = false;
        try {
          await ensureCanCallFlashLite(identity.uid);
          canRead = true;
        } catch {
          canRead = false;
        }
        if (!canRead) {
          return failedSlipRead('ยังไม่อ่านสลิปด้วยโมเดล แอดมินตรวจสลิปเอง ยังไม่ได้เติมเครดิต');
        }
        const read = await readSlipWithGemini(image, mime, geminiClientFactory || (() => null));
        if (!read.failed) {
          try {
            const priced = chargeFromUsageMetadata((read as any).usageMetadata);
            charge = await deductUsableCredits(identity.uid, priced.creditsCharged, `อ่านสลิป ${String(req.params.reference || '')}`, {
              tokensUsed: priced.tokensUsed,
              usageMissing: priced.usageMissing,
            });
          } catch {
            charge = null;
          }
        }
        const stored = { ...read } as any;
        delete stored.usageMetadata;
        return stored;
      });
      res.json({
        success: true,
        creditsGranted: false,
        status: record.status,
        reference: record.reference,
        message: 'ส่งสลิปแล้ว กำลังรอแอดมินตรวจสอบ ยังไม่ได้เติมเครดิต',
        creditsCharged: charge ? charge.creditsCharged : 0,
        remainingCredits: charge ? charge.remainingCredits : null,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.get('/api/admin/transfer/settings', requireTransferAdmin, async (_req, res) => {
    try {
      const settings = await loadReceivingAccount();
      const qr = await qrDataUrlFor(settings);
      res.json({
        success: true,
        settings: {
          bankName: settings.bankName,
          accountNumber: settings.accountNumber,
          accountName: settings.accountName,
          promptPayId: settings.promptPayId,
          hasUploadedQr: Boolean(settings.qrImageFile),
        },
        qrDataUrl: qr.qrDataUrl,
        qrSource: qr.qrSource,
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post('/api/admin/transfer/settings', requireTransferAdmin, async (req, res) => {
    let wroteQr: string | null = null;
    try {
      const identity = (req as any).transferIdentity as TransferIdentity;
      let qrImageFile: string | null | undefined = undefined;
      if (req.body?.clearQr === true) qrImageFile = '';
      if (req.body?.qrImageBase64 || req.body?.imageBase64) {
        qrImageFile = saveAdminQr(decodeImagePayload(req.body?.qrImageBase64 ? { imageBase64: req.body.qrImageBase64, mimeType: req.body.qrMimeType } : req.body));
        wroteQr = qrImageFile;
      }
      const saved = await saveReceivingAccount(identity.uid, {
        bankName: req.body?.bankName,
        accountNumber: req.body?.accountNumber,
        accountName: req.body?.accountName,
        promptPayId: req.body?.promptPayId,
        qrImageFile,
      }, identity.email || '');
      if (req.body?.clearQr === true) {
        for (const ext of ['.jpg', '.png', '.webp']) {
          const old = path.join(transferDataDir(), `payment-qr${ext}`);
          if (fs.existsSync(old)) fs.unlinkSync(old);
        }
      }
      res.json({
        success: true,
        settings: {
          bankName: saved.bankName,
          accountNumber: saved.accountNumber,
          accountName: saved.accountName,
          promptPayId: saved.promptPayId,
          hasUploadedQr: Boolean(saved.qrImageFile),
        },
        message: 'บันทึกบัญชีรับเงินแล้ว',
      });
    } catch (err) {
      if (wroteQr) {
        const orphan = path.join(transferDataDir(), path.basename(wroteQr));
        if (fs.existsSync(orphan)) fs.unlinkSync(orphan);
      }
      sendError(res, err);
    }
  });

  app.get('/api/admin/transfer/requests', requireTransferAdmin, (req, res) => {
    const status = req.query.status === 'all' || req.query.status === 'confirmed' ? req.query.status : 'pending';
    const requests = listTransferRequests(status).map((r) => ({
      reference: r.reference,
      uid: r.uid,
      email: r.email || '',
      amountThb: r.amountThb,
      credits: r.packageId === 'custom_request' ? null : r.credits,
      packageId: r.packageId,
      status: r.status,
      createdAt: r.createdAt,
      slipUploadedAt: r.slipUploadedAt || null,
      hasSlip: Boolean(r.slipFile),
      confirmedAt: r.confirmedAt || null,
      remainingCredits: r.status === 'confirmed' && typeof r.remainingCredits === 'number' ? r.remainingCredits : null,
      slipRead: r.slipRead ? {
        failed: r.slipRead.failed === true,
        error: r.slipRead.error || null,
        senderName: r.slipRead.senderName || '',
        amountThb: r.slipRead.amountThb ?? null,
        transferredAt: r.slipRead.transferredAt || '',
        reference: r.slipRead.reference || '',
        referenceMatch: r.slipRead.referenceMatch === true,
        amountMatch: r.slipRead.amountMatch === true,
        matched: r.slipRead.matched === true,
        differences: Array.isArray(r.slipRead.differences) ? r.slipRead.differences : [],
        model: r.slipRead.model || null,
      } : null,
    }));
    res.json({ success: true, requests });
  });

  app.get('/api/admin/transfer/requests/:reference/slip', requireTransferAdmin, (req, res) => {
    const slip = readSlipFile(String(req.params.reference || ''));
    if (!slip) return res.status(404).json({ success: false, message: 'ไม่พบสลิป' });
    res.setHeader('Content-Type', slip.mime);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(slip.buffer);
  });

  app.post('/api/admin/transfer/requests/:reference/confirm', requireTransferAdmin, async (req, res) => {
    const result = await confirmTransferRequest(String(req.params.reference || ''));
    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        creditsGranted: false,
        granted: false,
        remainingCredits: null,
        message: result.message,
      });
    }
    res.json({
      success: true,
      creditsGranted: result.granted,
      granted: result.granted,
      already: result.already,
      remainingCredits: result.granted ? result.remainingCredits : null,
      creditsAdded: result.creditsAdded,
      message: result.already
        ? 'รายการนี้ยืนยันไปแล้ว จึงไม่ได้เติมเครดิตซ้ำ'
        : `เติมเครดิตแล้ว คงเหลือ ${result.remainingCredits}`,
    });
  });

  app.post('/api/admin/transfer/requests/:reference/reject', requireTransferAdmin, async (req, res) => {
    const result = await rejectTransferRequest(String(req.params.reference || ''));
    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        creditsGranted: false,
        rejected: false,
        message: result.message,
      });
    }
    res.json({
      success: true,
      creditsGranted: false,
      rejected: true,
      already: result.already,
      message: result.already ? 'รายการนี้ถูกปฏิเสธไปแล้ว จึงไม่ได้เติมเครดิต' : 'ปฏิเสธสลิปแล้ว ยังไม่ได้เติมเครดิต',
    });
  });
}
