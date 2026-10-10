/**
 * Server-only credit persistence.
 * Writes go through the Firebase Admin SDK, which bypasses security rules.
 * The client SDK cannot update users/{uid} credit fields (firestore.rules).
 * If no service account is configured, callers must fail instead of pretending the balance was saved.
 */
import fs from 'fs';
import path from 'path';
import { SEED_ADMIN_EMAIL as PLATFORM_ADMIN_EMAIL } from './adminAllowlist';

export const CREDIT_CATALOG: Record<string, { credits: number; priceThb: number }> = {
  pkg_starter_100: { credits: 100, priceThb: 100 },
  pkg_pro_500: { credits: 500, priceThb: 500 },
  pkg_master_1000: { credits: 1000, priceThb: 1000 },
  pkg_studio_2500: { credits: 2500, priceThb: 2500 },
};

/**
 * Live spend rate. creditsCharged = tokensUsed / TOKENS_PER_CREDIT, rounded half up to 2 decimals.
 * Do not take a second cut off the spend. The user never sees this rate.
 */
export const TOKENS_PER_CREDIT = 9000;

export function roundCredits(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** creditsCharged = tokens / TOKENS_PER_CREDIT, rounded half up to 2 decimals. 0 tokens => 0. No second hold on spend. */
export function creditsForTokens(tokens: number): number {
  const n = Number(tokens);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return roundCredits(n / TOKENS_PER_CREDIT);
}

export function creditsForImageTokens(tokens: number): number {
  return creditsForTokens(tokens);
}

export function normalizeVideoResolution(resolution: unknown): '720p' | '1080p' {
  return String(resolution || '').toLowerCase() === '1080p' ? '1080p' : '720p';
}

/** Top-up split. 100 baht => 100 usable credits and 10 hidden admin-share credits. The 10 is not subtracted from the 100. */
export function paidTopupSplit(amount: number): { usableCredits: number; adminShareCredits: number } {
  const usableCredits = Math.floor(Number(amount));
  if (!Number.isFinite(usableCredits) || usableCredits <= 0) {
    return { usableCredits: 0, adminShareCredits: 0 };
  }
  return { usableCredits, adminShareCredits: Math.round(usableCredits * 0.1) };
}

/** Reported token count only. Returns null when the API did not send one. Never invents a count. */
export function tokenCountFromUsage(usage: any): number | null {
  if (!usage || typeof usage !== 'object') return null;
  for (const key of ['totalTokenCount', 'totalTokens', 'tokenCount'] as const) {
    const value = usage[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  }
  const prompt = usage.promptTokenCount;
  const output = usage.candidatesTokenCount;
  const hasPrompt = typeof prompt === 'number' && Number.isFinite(prompt) && prompt >= 0;
  const hasOutput = typeof output === 'number' && Number.isFinite(output) && output >= 0;
  if (!hasPrompt && !hasOutput) return null;
  return (hasPrompt ? prompt : 0) + (hasOutput ? output : 0);
}

export interface UsageChargeQuote {
  tokensUsed: number | null;
  creditsCharged: number;
  usageMissing: boolean;
}

export function chargeFromUsageMetadata(usage: any): UsageChargeQuote {
  const tokensUsed = tokenCountFromUsage(usage);
  if (tokensUsed == null) return { tokensUsed: null, creditsCharged: 0, usageMissing: true };
  return { tokensUsed, creditsCharged: creditsForTokens(tokensUsed), usageMissing: false };
}

export function stripHiddenCreditFields<T extends Record<string, any>>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;
  const clone: any = Array.isArray(payload) ? [...payload] : { ...payload };
  delete clone.adminShareCredits;
  delete clone.totalAdminShareCredits;
  return clone;
}

const BLOCKED_CREDIT_UIDS = new Set([
  'user_sala_001',
  'user_admin_01',
  'guest_user',
  'demo_creator',
  'currentuseraccount',
]);

export const MISSING_STRIPE_SECRET_MESSAGE =
  'ระบบชำระเงินยังไม่พร้อม: ยังไม่ได้ตั้งค่า STRIPE_SECRET_KEY บนเซิร์ฟเวอร์ จึงไม่เปิดโหมดจำลองและไม่เติมเครดิต';

export const MISSING_FIRESTORE_CREDENTIAL_MESSAGE =
  'บันทึกยอดเครดิตไม่สำเร็จ: เซิร์ฟเวอร์ยังไม่มีสิทธิ์เขียน Firestore (ต้องตั้ง FIREBASE_SERVICE_ACCOUNT_JSON หรือ GOOGLE_APPLICATION_CREDENTIALS บนเครื่องที่รันเซิร์ฟเวอร์ ไม่ใส่ค่าในซอร์สโค้ด) ระบบไม่ได้บันทึกเครดิต';

export class CreditPersistError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = 'CreditPersistError';
    this.status = status;
  }
}

export function isRealCreditUid(uid: unknown): uid is string {
  if (typeof uid !== 'string') return false;
  const id = uid.trim();
  if (!id || id.length < 6 || id.length > 128) return false;
  if (id.includes('@') || id.includes('/') || id.includes('\\') || /\s/.test(id)) return false;
  if (BLOCKED_CREDIT_UIDS.has(id.toLowerCase())) return false;
  return true;
}

/** Cloud Run / Cloud Functions / App Engine provide a runtime service account via the metadata server. */
export function hasGcpRuntimeIdentity(): boolean {
  return Boolean(
    process.env.K_SERVICE?.trim() ||
    process.env.FUNCTION_TARGET?.trim() ||
    process.env.GAE_SERVICE?.trim()
  );
}

export function assertFirestoreCredentialConfigured(): void {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!json && !credPath) {
    if (hasGcpRuntimeIdentity()) return;
    throw new CreditPersistError(MISSING_FIRESTORE_CREDENTIAL_MESSAGE);
  }
  if (!json && credPath && !fs.existsSync(credPath)) {
    throw new CreditPersistError(
      `บันทึกยอดเครดิตไม่สำเร็จ: ไม่พบไฟล์ที่ GOOGLE_APPLICATION_CREDENTIALS ชี้ไว้ จึงไม่ได้บันทึกเครดิต`
    );
  }
  if (json) {
    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new CreditPersistError('FIREBASE_SERVICE_ACCOUNT_JSON ไม่ใช่ JSON ที่อ่านได้ จึงไม่ได้บันทึกเครดิต');
    }
    if (!parsed?.client_email || !parsed?.private_key) {
      throw new CreditPersistError('FIREBASE_SERVICE_ACCOUNT_JSON ไม่มี client_email หรือ private_key จึงไม่ได้บันทึกเครดิต');
    }
  }
}

function firestoreDatabaseId(): string {
  if (process.env.FIRESTORE_DATABASE_ID?.trim()) return process.env.FIRESTORE_DATABASE_ID.trim();
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
    return String(cfg.firestoreDatabaseId || '');
  } catch {
    return '';
  }
}

let adminDbPromise: Promise<any> | null = null;

export function getAdminFirestore(): Promise<any> {
  if (!adminDbPromise) {
    adminDbPromise = (async () => {
      assertFirestoreCredentialConfigured();
      const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
      const { initializeApp, cert, getApps, applicationDefault } = await import('firebase-admin/app');
      const { getFirestore } = await import('firebase-admin/firestore');
      if (!getApps().length) {
        if (json) {
          const parsed = JSON.parse(json);
          initializeApp({
            credential: cert(parsed),
            projectId: parsed.project_id || process.env.FIREBASE_PROJECT_ID || undefined,
          });
        } else {
          initializeApp({
            credential: applicationDefault(),
            projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || undefined,
          });
        }
      }
      const dbId = firestoreDatabaseId();
      const { getApp } = await import('firebase-admin/app');
      return dbId ? getFirestore(getApp(), dbId) : getFirestore(getApp());
    })().catch((err) => {
      adminDbPromise = null;
      if (err instanceof CreditPersistError) throw err;
      throw new CreditPersistError(
        `บันทึกยอดเครดิตไม่สำเร็จ: เริ่ม Firebase Admin ไม่ได้ (${err?.message || 'unknown'}) ระบบไม่ได้บันทึกเครดิต`
      );
    });
  }
  return adminDbPromise;
}

function balanceOf(data: any): number {
  const raw = data?.remainingCredits ?? data?.credits;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Paid Stripe credit. Idempotent across the given payment ids. Never touches a shared demo wallet. */
export async function creditPaidUserInFirestore(
  uid: string,
  credits: number,
  description: string,
  idempotencyIds: string[]
): Promise<{ remainingCredits: number; already: boolean }> {
  if (!isRealCreditUid(uid)) {
    throw new CreditPersistError('ไม่สามารถเติมเครดิตได้ เพราะไม่มี uid จริงของผู้ใช้ที่เข้าสู่ระบบ', 400);
  }
  const amount = Math.floor(Number(credits));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new CreditPersistError('จำนวนเครดิตไม่ถูกต้อง', 400);
  }
  const ids = Array.from(new Set(idempotencyIds.map((id) => String(id || '').trim()).filter(Boolean)));
  if (ids.length === 0) {
    throw new CreditPersistError('ไม่มีรหัสรายการชำระเงินสำหรับกันการเติมซ้ำ', 400);
  }

  const db = await getAdminFirestore();
  const { FieldValue } = await import('firebase-admin/firestore');
  const userRef = db.collection('users').doc(uid);
  const payRefs = ids.map((id: string) => db.collection('stripePayments').doc(id));
  const adminUid = await lookupPlatformAdminUid(db);
  const share = paidTopupSplit(amount).adminShareCredits;

  let remaining = 0;
  let already = false;
  await db.runTransaction(async (tx: any) => {
    const paySnaps = [];
    for (const ref of payRefs) paySnaps.push(await tx.get(ref));
    const userSnap = await tx.get(userRef);
    if (adminUid) await tx.get(db.collection('users').doc(adminUid));
    await tx.get(db.collection('billing').doc('adminShare'));
    if (paySnaps.some((snap: any) => snap.exists)) {
      already = true;
      remaining = balanceOf(userSnap.data());
      return;
    }
    remaining = balanceOf(userSnap.data()) + amount;
    const patch: any = {
      credits: FieldValue.increment(amount),
      remainingCredits: FieldValue.increment(amount),
      adminShareCredits: FieldValue.increment(share),
      updatedAt: new Date().toISOString(),
      lastTopupAt: new Date().toISOString(),
      lastTopupAmount: amount,
      lastPaymentMethod: 'stripe',
    };
    if (adminUid === uid) patch.totalAdminShareCredits = FieldValue.increment(share);
    tx.set(userRef, patch, { merge: true });
    writePlatformAdminShare(tx, db, FieldValue, share, adminUid, uid);
    ids.forEach((id, i) => {
      tx.set(payRefs[i], {
        uid,
        credits: amount,
        adminShareCredits: share,
        description,
        createdAt: new Date().toISOString(),
      });
    });
  });

  return { remainingCredits: remaining, already };
}

export async function paymentAlreadyRecorded(idempotencyIds: string[]): Promise<boolean> {
  const ids = Array.from(new Set(idempotencyIds.map((id) => String(id || '').trim()).filter(Boolean)));
  if (ids.length === 0) return false;
  const db = await getAdminFirestore();
  for (const id of ids) {
    const snap = await db.collection('stripePayments').doc(id).get();
    if (snap.exists) return true;
  }
  return false;
}

/** Read the Firestore balance. Throws if the server cannot read; returns null when the user doc has no numeric balance. */
export async function readFirestoreCreditBalance(uid: string): Promise<number | null> {
  if (!isRealCreditUid(uid)) {
    throw new CreditPersistError('ไม่มี uid จริงสำหรับอ่านยอดเครดิต', 400);
  }
  const db = await getAdminFirestore();
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (typeof data.remainingCredits === 'number') return data.remainingCredits;
  if (typeof data.credits === 'number') return data.credits;
  return null;
}

/**
 * Admin grant/adjust. Target must be a real uid whose users/{uid} document already exists.
 * Does not accept an email and does not credit the caller's own demo wallet.
 */
export async function adjustFirestoreCredits(targetUid: string, delta: number, reason: string): Promise<number> {
  if (!isRealCreditUid(targetUid)) {
    throw new CreditPersistError('ต้องระบุ uid จริงของผู้ใช้ ไม่สามารถมอบเครดิตด้วยอีเมลหรือบัญชีสาธิตได้', 400);
  }
  const num = roundCredits(Number(delta));
  if (!Number.isFinite(num) || num === 0) {
    throw new CreditPersistError('กรุณาระบุจำนวนเครดิตที่ไม่เป็นศูนย์', 400);
  }
  const db = await getAdminFirestore();
  const userRef = db.collection('users').doc(targetUid);
  const existing = await userRef.get();
  if (!existing.exists) {
    throw new CreditPersistError('ไม่พบผู้ใช้ใน Firestore users/{uid} จึงไม่มอบเครดิต', 404);
  }
  let next = 0;
  await db.runTransaction(async (tx: any) => {
    const snap = await tx.get(userRef);
    if (!snap.exists) {
      throw new CreditPersistError('ไม่พบผู้ใช้ใน Firestore users/{uid} จึงไม่มอบเครดิต', 404);
    }
    next = Math.max(0, roundCredits(balanceOf(snap.data()) + num));
    tx.set(userRef, {
      credits: next,
      remainingCredits: next,
      updatedAt: new Date().toISOString(),
      lastAdminAdjustAt: new Date().toISOString(),
      lastAdminAdjustAmount: num,
      lastAdminAdjustReason: String(reason || '').slice(0, 300),
    }, { merge: true });
  });
  return next;
}


async function lookupPlatformAdminUid(db: any): Promise<string | null> {
  try {
    const snap = await db.collection('users').where('email', '==', PLATFORM_ADMIN_EMAIL).limit(1).get();
    const docs = snap?.docs || [];
    if (!docs.length) return null;
    const id = String(docs[0].id || '').trim();
    return id || null;
  } catch {
    return null;
  }
}

/** Platform counter plus an optional copy on the admin user doc. Never touches credits or remainingCredits. */
function writePlatformAdminShare(tx: any, db: any, FieldValue: any, share: number, adminUid: string | null, payerUid: string) {
  tx.set(db.collection('billing').doc('adminShare'), {
    totalAdminShareCredits: FieldValue.increment(share),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  if (adminUid && adminUid !== payerUid) {
    tx.set(db.collection('users').doc(adminUid), {
      totalAdminShareCredits: FieldValue.increment(share),
    }, { merge: true });
  }
}

/**
 * Paid bank-transfer grant. Usable credits increase by the full amount.
 * adminShareCredits and billing/adminShare.totalAdminShareCredits increase by 10%.
 * A repeated idempotency id does not add the share again.
 * Manual admin grants go through adjustFirestoreCredits and do not call this.
 */
export async function grantPaidTransferCredits(targetUid: string, delta: number, reason: string): Promise<number> {
  if (!isRealCreditUid(targetUid)) {
    throw new CreditPersistError('ต้องระบุ uid จริงของผู้ใช้ ไม่สามารถมอบเครดิตด้วยอีเมลหรือบัญชีสาธิตได้', 400);
  }
  const amount = Math.trunc(Number(delta));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new CreditPersistError('จำนวนเครดิตไม่ถูกต้อง', 400);
  }
  const idempotencyId = `transfer:${String(reason || '').trim()}`.slice(0, 700);
  if (idempotencyId === 'transfer:') {
    throw new CreditPersistError('ไม่มีรหัสรายการสำหรับกันการเติมซ้ำ', 400);
  }
  const db = await getAdminFirestore();
  const { FieldValue } = await import('firebase-admin/firestore');
  const userRef = db.collection('users').doc(targetUid);
  const payRef = db.collection('paidGrants').doc(idempotencyId);
  const adminUid = await lookupPlatformAdminUid(db);
  const share = paidTopupSplit(amount).adminShareCredits;
  let remaining = 0;
  await db.runTransaction(async (tx: any) => {
    const paySnap = await tx.get(payRef);
    const userSnap = await tx.get(userRef);
    if (adminUid) await tx.get(db.collection('users').doc(adminUid));
    await tx.get(db.collection('billing').doc('adminShare'));
    if (!userSnap.exists) {
      throw new CreditPersistError('ไม่พบผู้ใช้ใน Firestore users/{uid} จึงไม่มอบเครดิต', 404);
    }
    if (paySnap.exists) {
      remaining = balanceOf(userSnap.data());
      return;
    }
    remaining = balanceOf(userSnap.data()) + amount;
    const patch: any = {
      credits: FieldValue.increment(amount),
      remainingCredits: FieldValue.increment(amount),
      adminShareCredits: FieldValue.increment(share),
      updatedAt: new Date().toISOString(),
      lastTopupAt: new Date().toISOString(),
      lastTopupAmount: amount,
      lastPaymentMethod: 'transfer',
    };
    if (adminUid === targetUid) patch.totalAdminShareCredits = FieldValue.increment(share);
    tx.set(userRef, patch, { merge: true });
    writePlatformAdminShare(tx, db, FieldValue, share, adminUid, targetUid);
    tx.set(payRef, {
      uid: targetUid,
      credits: amount,
      adminShareCredits: share,
      reason: String(reason || '').slice(0, 300),
      createdAt: new Date().toISOString(),
    });
  });
  return remaining;
}

export async function readPlatformAdminShare(): Promise<number> {
  const db = await getAdminFirestore();
  const snap = await db.collection('billing').doc('adminShare').get();
  if (!snap.exists) return 0;
  const n = Number(snap.data()?.totalAdminShareCredits);
  return Number.isFinite(n) ? n : 0;
}

export interface StoredCreditCharge {
  tokensUsed: number | null;
  creditsCharged: number;
  remainingCredits: number;
  usageMissing?: boolean;
  durationSeconds?: number;
  resolution?: string;
}

/**
 * Spend usable credits only. Does not change adminShareCredits and does not take a second cut.
 * tokensUsed is stored beside the credit fields and is never added into the balance.
 * A call with no token count charges 0 and sets usageMissing.
 */
export async function deductUsableCredits(
  uid: string,
  credits: number,
  reason: string,
  meta: { tokensUsed: number | null; usageMissing?: boolean; durationSeconds?: number; resolution?: string }
): Promise<StoredCreditCharge> {
  const creditsCharged = roundCredits(Number(credits));
  if (!Number.isFinite(creditsCharged) || creditsCharged < 0) {
    throw new CreditPersistError('จำนวนเครดิตที่หักไม่ถูกต้อง', 400);
  }
  const usageMissing = meta.usageMissing === true || meta.tokensUsed == null;
  let remainingCredits: number;
  if (creditsCharged === 0) {
    remainingCredits = (await readFirestoreCreditBalance(uid)) ?? 0;
  } else {
    remainingCredits = await adjustFirestoreCredits(uid, -creditsCharged, reason);
  }
  const record = {
    uid,
    tokensUsed: meta.tokensUsed,
    creditsCharged,
    remainingCredits,
    usageMissing,
    durationSeconds: meta.durationSeconds ?? null,
    resolution: meta.resolution ?? null,
    reason: String(reason || '').slice(0, 300),
    createdAt: new Date().toISOString(),
  };
  try {
    const db = await getAdminFirestore();
    await db.collection('creditUsage').add(record);
  } catch (err: any) {
    console.warn('[creditUsage] could not store usage record:', err?.message || err);
  }
  if (usageMissing) {
    console.warn(`[credits] usage missing for ${reason}; tokensUsed=null; creditsCharged=0`);
  }
  return {
    tokensUsed: meta.tokensUsed,
    creditsCharged,
    remainingCredits,
    usageMissing,
    durationSeconds: meta.durationSeconds,
    resolution: meta.resolution,
  };
}

/** Reject before a Gemini call when this user cannot be charged. Does not call the model. */
export async function ensureCanCallFlashLite(uid: unknown): Promise<void> {
  assertFirestoreCredentialConfigured();
  if (!isRealCreditUid(uid)) {
    throw new CreditPersistError('ต้องเข้าสู่ระบบด้วยบัญชีจริงก่อนเรียก Gemini จึงไม่เรียกโมเดล', 401);
  }
  const balance = await readFirestoreCreditBalance(uid);
  if ((balance ?? 0) <= 0) {
    throw new CreditPersistError('เครดิตคงเหลือไม่พอ จึงไม่เรียก Gemini', 402);
  }
}
