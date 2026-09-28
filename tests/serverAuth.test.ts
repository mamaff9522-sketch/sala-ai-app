/**
 * Auth security tests: Firebase ID token verification, HMAC local sessions, admin gate.
 * Run: npx tsx tests/serverAuth.test.ts
 * (starts server.ts on a free port without GEMINI / Firebase credentials; no network needed)
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } from 'jose';
import { verifyFirebaseIdToken, createSessionToken, verifySessionToken, isAdminIdentity } from '../serverAuth';

let passed = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed++;
  console.log(`  ✔ ${name}`);
}

const PROJECT = 'gen-lang-client-0176262524';
const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);
const firebaseClaims = (extra: any = {}) => ({ iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: 'user_sala_admin', user_id: 'user_sala_admin', iat: now(), exp: now() + 3600, auth_time: now(), email: 'mama.ff9522@gmail.com', email_verified: true, ...extra });
/** Unsigned ("alg: none") token: what the old base64-only decoder accepted */
const unsignedToken = (claims: any) => `${b64({ alg: 'none', typ: 'JWT' })}.${b64(claims)}.`;
const fakeSigToken = (claims: any) => `${b64({ alg: 'RS256', kid: 'x', typ: 'JWT' })}.${b64(claims)}.${Buffer.from('forged').toString('base64url')}`;

async function main() {
  // ---------- unit: Firebase ID token verification ----------
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const signed = (claims: any) => new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).sign(privateKey);

  await check('valid RS256 Firebase token (right iss/aud/exp) is accepted', async () => {
    const c = await verifyFirebaseIdToken(await signed(firebaseClaims({ sub: 'uid123', email: 'a@b.c' })), PROJECT, jwks);
    assert.equal(c?.uid, 'uid123');
    assert.equal(c?.emailVerified, true);
  });
  await check('forged unsigned / fake-signature / wrong-project / expired tokens are rejected', async () => {
    assert.equal(await verifyFirebaseIdToken(unsignedToken(firebaseClaims()), PROJECT, jwks), null);
    assert.equal(await verifyFirebaseIdToken(fakeSigToken(firebaseClaims()), PROJECT, jwks), null);
    assert.equal(await verifyFirebaseIdToken(await signed(firebaseClaims({ aud: 'other-project' })), PROJECT, jwks), null);
    assert.equal(await verifyFirebaseIdToken(await signed(firebaseClaims({ iss: 'https://securetoken.google.com/other-project' })), PROJECT, jwks), null);
    assert.equal(await verifyFirebaseIdToken(await signed(firebaseClaims({ exp: now() - 3600, iat: now() - 7200 })), PROJECT, jwks), null);
    const other = await generateKeyPair('RS256');
    const wrongKey = await new SignJWT(firebaseClaims()).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).sign(other.privateKey);
    assert.equal(await verifyFirebaseIdToken(wrongKey, PROJECT, jwks), null);
  });
  await check('admin needs a verified email in the admin list', () => {
    assert.equal(isAdminIdentity({ email: 'mama.ff9522@gmail.com', emailVerified: true }, ['mama.ff9522@gmail.com']), true);
    assert.equal(isAdminIdentity({ email: 'mama.ff9522@gmail.com', emailVerified: false }, ['mama.ff9522@gmail.com']), false);
    assert.equal(isAdminIdentity({ email: 'someone@gmail.com', emailVerified: true }, ['mama.ff9522@gmail.com']), false);
  });
  await check('HMAC local session tokens: valid accepted; tampered / other-secret / expired rejected', () => {
    const t = createSessionToken('user_sala_001', 'secret-a');
    assert.equal(verifySessionToken(t, 'secret-a')?.userId, 'user_sala_001');
    assert.equal(verifySessionToken(t, 'secret-b'), null);
    const parts = t.split('.');
    parts[1] = Buffer.from('user_admin_01').toString('base64url');
    assert.equal(verifySessionToken(parts.join('.'), 'secret-a'), null);
    assert.equal(verifySessionToken(createSessionToken('u', 'secret-a', -10), 'secret-a'), null);
  });

  // ---------- HTTP: real server.ts ----------
  const port: number = await new Promise(r => { const srv = net.createServer(); srv.listen(0, () => { const p = (srv.address() as any).port; srv.close(() => r(p)); }); });
  const env = { ...process.env, PORT: String(port), NODE_ENV: 'production', SESSION_SECRET: 'test-secret', GEMINI_API_KEY: '' };
  const child = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i++) {
      try { await fetch(`${base}/api/providers`); break; } catch { await new Promise(r => setTimeout(r, 200)); }
      if (i === 99) throw new Error(`server did not start:\n${log}`);
    }
    const get = (p: string, token?: string) => fetch(base + p, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

    await check('HTTP: forged unsigned Firebase token -> 401 (auth) and 401 (admin)', async () => {
      const forged = unsignedToken(firebaseClaims());
      assert.equal((await get('/api/auth/me', forged)).status, 401);
      assert.equal((await get('/api/admin/stats', forged)).status, 401);
      assert.equal((await get('/api/auth/me', fakeSigToken(firebaseClaims()))).status, 401);
    });
    await check('HTTP: forged user_sala_admin / demo / fake local tokens never get admin', async () => {
      for (const t of [unsignedToken(firebaseClaims({ sub: 'user_sala_admin', user_id: 'user_sala_admin' })), 'session_demo_admin', 'session_user_admin_01_1', 'sala.dXNlcl9hZG1pbl8wMQ.9999999999.x.forged']) {
        const r = await get('/api/admin/stats', t);
        assert.equal(r.status, 401, `${t} -> ${r.status}`);
      }
    });
    await check('HTTP: local username/password login still works (HMAC session), is not admin, logout revokes', async () => {
      const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernameOrEmail: 'creator', password: 'user1234' }) });
      const j: any = await r.json();
      assert.equal(j.success, true);
      assert.ok(String(j.token).startsWith('sala.'));
      assert.equal((await get('/api/auth/me', j.token)).status, 200);
      assert.equal((await get('/api/admin/stats', j.token)).status, 403);
      const a: any = await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernameOrEmail: 'admin', password: 'admin1234' }) })).json();
      assert.equal((await get('/api/admin/stats', a.token)).status, 403, 'local password account is never admin');
      await fetch(`${base}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${j.token}` } });
      assert.equal((await get('/api/auth/me', j.token)).status, 401);
    });
  } finally {
    child.kill();
  }
  console.log(`\nAll ${passed} auth checks passed.`);
}

main().catch(err => { console.error(err); process.exit(1); });
