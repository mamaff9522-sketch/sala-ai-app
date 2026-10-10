/**
 * PromptPay transfer: empty receiving account, no credit on create/slip, no double grant.
 * Run: npx tsx tests/transferTopup.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import express from 'express';
import { createSessionToken } from '../serverAuth';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sala-transfer-'));
process.env.SALA_TRANSFER_DATA_DIR = dataDir;
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
delete process.env.ADMIN_EMAILS;

const require = createRequire(import.meta.url);
const generatePayload: (id: string, options: { amount?: number }) => string = require('promptpay-qr');

const {
  SLIP_READ_MODEL,
  attachSlip,
  buildPromptPayPayload,
  compareSlipToRequest,
  confirmTransferRequest,
  createTransferRequest,
  loadReceivingAccount,
  localSessionSecret,
  publicPaymentView,
  readSlipWithGemini,
  registerTransferRoutes,
  saveReceivingAccount,
} = await import('../serverTransfer.ts');

let passed = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed++;
  console.log(`  ✔ ${name}`);
}

function emvCrc(body: string): string {
  let crc = 0xffff;
  for (let i = 0; i < body.length; i++) {
    crc ^= body.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function memoryDb() {
  const docs = new Map<string, any>();
  return {
    docs,
    collection(name: string) {
      return {
        doc(id: string) {
          const key = `${name}/${id}`;
          return {
            async get() {
              const data = docs.get(key);
              return { exists: data !== undefined, id, data: () => data };
            },
            async set(patch: any, opts?: { merge?: boolean }) {
              const prev = docs.get(key) || {};
              docs.set(key, opts?.merge ? { ...prev, ...patch } : patch);
            },
          };
        },
        where(field: string, _op: string, value: string) {
          const query = {
            limit() { return query; },
            async get() {
              const found: any[] = [];
              for (const [key, data] of docs) {
                if (!key.startsWith(`${name}/`)) continue;
                if (data?.[field] === value) found.push({ id: key.slice(name.length + 1), data: () => data });
              }
              return { docs: found, empty: found.length === 0 };
            },
          };
          return query;
        },
      };
    },
  };
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function main() {
  const wallet = { remainingCredits: 42 };

  await check('receiving account starts empty and ignores a local JSON file', async () => {
    fs.writeFileSync(path.join(dataDir, 'payment-settings.json'), JSON.stringify({
      bankName: 'SHOULD-NOT-LOAD',
      accountNumber: '999',
      accountName: 'SHOULD-NOT-LOAD',
      promptPayId: '0812345678',
    }));
    const settings = await loadReceivingAccount();
    assert.deepEqual(settings, { bankName: '', accountNumber: '', accountName: '', promptPayId: '', qrImageFile: '' });
    assert.equal(publicPaymentView(settings).configured, false);
    assert.equal('promptPayId' in publicPaymentView(settings), false);
  });

  await check('saving without Firestore credentials fails and does not write a bank file', async () => {
    await assert.rejects(() => saveReceivingAccount('adminuid123', {
      bankName: 'ธนาคารทดสอบ',
      accountNumber: '1234567890',
      accountName: 'ชื่อทดสอบ',
      promptPayId: '',
    }, 'mama.ff9522@gmail.com'));
    const settings = await loadReceivingAccount();
    assert.equal(settings.bankName, '');
    assert.equal(settings.accountNumber, '');
    assert.equal(settings.accountName, '');
  });

  await check('admin save writes bankName, accountNumber, accountName on users/{adminUid}', async () => {
    const db = memoryDb();
    const uid = 'adminuid123';
    db.docs.set(`users/${uid}`, { email: 'mama.ff9522@gmail.com', credits: 5, remainingCredits: 5 });
    const empty = await loadReceivingAccount(db);
    assert.equal(empty.bankName, '');
    assert.equal(empty.accountNumber, '');
    assert.equal(empty.accountName, '');
    const saved = await saveReceivingAccount(uid, {
      bankName: 'ธนาคารทดสอบ',
      accountNumber: '1234567890',
      accountName: 'ชื่อทดสอบ',
      promptPayId: '0812345678',
    }, 'mama.ff9522@gmail.com', db);
    assert.equal(saved.bankName, 'ธนาคารทดสอบ');
    assert.equal(saved.accountNumber, '1234567890');
    assert.equal(saved.accountName, 'ชื่อทดสอบ');
    const doc = db.docs.get(`users/${uid}`);
    assert.equal(doc.bankName, 'ธนาคารทดสอบ');
    assert.equal(doc.accountNumber, '1234567890');
    assert.equal(doc.accountName, 'ชื่อทดสอบ');
    assert.equal(doc.credits, 5);
    const loaded = await loadReceivingAccount(db);
    assert.equal(loaded.accountNumber, '1234567890');
    const pub = publicPaymentView({ ...loaded, qrImageFile: '' });
    assert.equal(pub.bankName, 'ธนาคารทดสอบ');
    assert.equal(pub.accountNumber, '1234567890');
    assert.equal(pub.accountName, 'ชื่อทดสอบ');
    assert.equal('promptPayId' in pub, false);
  });

  await check('PromptPay payload for 0812345678 matches promptpay-qr and EMV CRC16', () => {
    const plain = buildPromptPayPayload('0812345678');
    const withAmount = buildPromptPayPayload('0812345678', 99);
    assert.equal(plain, generatePayload('0812345678', {}));
    assert.equal(withAmount, generatePayload('0812345678', { amount: 99 }));
    assert.equal(plain.slice(-4), emvCrc(plain.slice(0, -4)));
    assert.equal(withAmount.slice(-4), emvCrc(withAmount.slice(0, -4)));
    assert.ok(plain.includes('010211'));
    assert.ok(withAmount.includes('010212'));
    assert.ok(plain.includes('0066812345678'));
  });

  await check('creating a request does not change a credit balance', () => {
    const req = createTransferRequest({ uid: 'transferuser01', email: 'user@example.com', packageId: 'pkg_starter_100' });
    assert.equal(req.status, 'pending');
    assert.equal(req.amountThb, 100);
    assert.equal(req.credits, 100);
    assert.equal(req.remainingCredits, undefined);
    assert.equal(wallet.remainingCredits, 42);
    assert.match(req.reference, /^SALA-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });

  await check('slip read compares reference and amount and does not grant credits', async () => {
    const req = createTransferRequest({ uid: 'transferuser01', packageId: 'pkg_starter_100' });
    const matched = compareSlipToRequest(
      { reference: req.reference.toLowerCase().slice(0, 5) + ' ' + req.reference.slice(5), amountThb: 100 },
      { reference: req.reference, amountThb: req.amountThb }
    );
    assert.equal(matched.matched, true);
    const mismatch = compareSlipToRequest(
      { reference: 'SALA-ZZZZZZ', amountThb: 50 },
      { reference: req.reference, amountThb: 100 }
    );
    assert.equal(mismatch.matched, false);
    assert.equal(mismatch.differences.length, 2);
    assert.match(mismatch.differences[0], /SALA-ZZZZZZ/);
    assert.match(mismatch.differences[0], new RegExp(req.reference));
    assert.match(mismatch.differences[1], /50/);
    assert.match(mismatch.differences[1], /100/);

    const calls: any[] = [];
    const read = await readSlipWithGemini(PNG, 'image/png', () => ({
      models: {
        async generateContent(body: any) {
          calls.push(body);
          return { text: JSON.stringify({ senderName: 'ผู้โอนทดสอบ', amountThb: 100, transferredAt: '2026-10-03 12:00', reference: ` ${req.reference} ` }) };
        },
      },
    }));
    assert.equal(calls[0].model, 'gemini-3.1-flash-lite');
    assert.equal(calls[0].model, SLIP_READ_MODEL);
    assert.notEqual(calls[0].model, 'gemini-3.1-flash-lite-image');
    assert.equal(calls[0].contents[0].parts[1].inlineData.mimeType, 'image/png');
    assert.equal(read.failed, false);
    assert.equal(read.senderName, 'ผู้โอนทดสอบ');

    const stored = await attachSlip(req.reference, 'transferuser01', PNG, async () => read);
    assert.equal(stored.status, 'pending');
    assert.equal(stored.slipRead?.matched, true);
    assert.equal(stored.slipRead?.senderName, 'ผู้โอนทดสอบ');
    assert.equal(stored.remainingCredits, undefined);
    assert.equal(wallet.remainingCredits, 42);

    const failed = await readSlipWithGemini(PNG, 'image/png', () => null);
    assert.equal(failed.failed, true);
    assert.equal(failed.matched, false);
    const broken = await attachSlip(req.reference, 'transferuser01', PNG, async () => { throw new Error('model down'); });
    assert.equal(broken.status, 'pending');
    assert.equal(broken.slipRead?.failed, true);
    assert.match(broken.slipRead?.error || '', /model down/);
    assert.equal(wallet.remainingCredits, 42);
  });

  await check('confirm fails closed without Firestore and a second confirm does not double-grant', async () => {
    const req = createTransferRequest({ uid: 'transferuser01', packageId: 'pkg_pro_500' });
    await attachSlip(req.reference, 'transferuser01', PNG, async () => ({
      failed: true, error: 'no key', senderName: '', amountThb: null, transferredAt: '', reference: '',
      raw: null, model: null, referenceMatch: false, amountMatch: false, matched: false, differences: [],
    }));
    const denied = await confirmTransferRequest(req.reference);
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.status, 503);
    const still = JSON.parse(fs.readFileSync(path.join(dataDir, 'transfer-requests.json'), 'utf8'));
    const row = still.find((r: any) => r.reference === req.reference);
    assert.equal(row.status, 'pending');
    assert.equal(wallet.remainingCredits, 42);

    let calls = 0;
    const first = await confirmTransferRequest(req.reference, async () => {
      calls += 1;
      wallet.remainingCredits += 500;
      return wallet.remainingCredits;
    });
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.granted, true);
      assert.equal(first.remainingCredits, 542);
    }
    const second = await confirmTransferRequest(req.reference, async () => {
      calls += 1;
      wallet.remainingCredits += 500;
      return wallet.remainingCredits;
    });
    assert.equal(second.ok, true);
    if (second.ok) {
      assert.equal(second.already, true);
      assert.equal(second.granted, false);
      assert.equal(second.creditsAdded, 0);
    }
    assert.equal(calls, 1);
    assert.equal(wallet.remainingCredits, 542);
  });

  await check('local session can create a request but cannot edit the receiving account', async () => {
    const app = express();
    app.use(express.json({ limit: '2mb' }));
    registerTransferRoutes(app, () => null);
    const server = app.listen(0);
    const port = (server.address() as any).port;
    const token = createSessionToken('transferuser01', localSessionSecret());
    try {
      const noAuth = await fetch(`http://127.0.0.1:${port}/api/credits/transfer/settings`);
      assert.equal(noAuth.status, 401);
      const created = await fetch(`http://127.0.0.1:${port}/api/credits/transfer/requests`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: 'pkg_master_1000' }),
      });
      const body = await created.json();
      assert.equal(created.status, 200);
      assert.equal(body.creditsGranted, false);
      assert.equal(body.request.status, 'pending');
      assert.equal(body.request.amountThb, 1000);
      const adminTry = await fetch(`http://127.0.0.1:${port}/api/admin/transfer/settings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankName: 'x', accountNumber: '1', accountName: 'y', promptPayId: '' }),
      });
      assert.equal(adminTry.status, 403);
      const forged = await fetch(`http://127.0.0.1:${port}/api/admin/transfer/settings`, {
        headers: { Authorization: 'Bearer forged.token.value' },
      });
      assert.equal(forged.status, 401);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log(`\n${passed} transfer tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
