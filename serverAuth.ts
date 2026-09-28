/**
 * Server-side authentication helpers (Node only; imported by server.ts, never by the browser).
 *
 * 1. Firebase ID tokens: signature (RS256, Google's securetoken JWKS), issuer, audience,
 *    expiry, issued-at and subject are verified with `jose`. Decoding without verification
 *    is never trusted.
 * 2. Local username/password sessions: server-issued tokens signed with HMAC-SHA256
 *    ("sala.<userId>.<exp>.<nonce>.<sig>"), verified with a timing-safe compare.
 */
import crypto from 'crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

export const FIREBASE_JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

export interface VerifiedFirebaseClaims {
  uid: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
  /** Expiry (seconds since epoch) */
  exp: number;
}

let remoteJwks: JWTVerifyGetKey | null = null;
function getRemoteJwks(): JWTVerifyGetKey {
  if (!remoteJwks) remoteJwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL), { cooldownDuration: 30_000, cacheMaxAge: 6 * 3600_000 });
  return remoteJwks;
}

/**
 * Verifies a Firebase ID token. Returns null for anything invalid (unsigned / forged /
 * wrong project / expired / malformed). `keySet` can be injected for tests.
 */
export async function verifyFirebaseIdToken(
  token: string,
  projectId: string,
  keySet?: JWTVerifyGetKey
): Promise<VerifiedFirebaseClaims | null> {
  if (!token || !projectId || token.split('.').length !== 3) return null;
  try {
    const { payload } = await jwtVerify(token, keySet || getRemoteJwks(), {
      algorithms: ['RS256'],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      clockTolerance: 60
    });
    const uid = typeof payload.sub === 'string' ? payload.sub : '';
    if (!uid || uid.length > 128) return null;
    if (typeof payload.exp !== 'number') return null;
    const authTime = (payload as any).auth_time;
    if (typeof authTime === 'number' && authTime > Math.floor(Date.now() / 1000) + 60) return null;
    return {
      uid,
      email: typeof (payload as any).email === 'string' ? (payload as any).email : undefined,
      emailVerified: (payload as any).email_verified === true,
      name: typeof (payload as any).name === 'string' ? (payload as any).name : undefined,
      picture: typeof (payload as any).picture === 'string' ? (payload as any).picture : undefined,
      exp: payload.exp
    };
  } catch {
    return null;
  }
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

function sign(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

/** Server-issued session token for local (username/password) accounts. */
export function createSessionToken(userId: string, secret: string, ttlSeconds = 7 * 24 * 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const nonce = crypto.randomBytes(12).toString('base64url');
  const body = `sala.${b64url(userId)}.${exp}.${nonce}`;
  return `${body}.${sign(body, secret)}`;
}

/** Returns the userId of a valid, unexpired session token signed with `secret`; otherwise null. */
export function verifySessionToken(token: string, secret: string): { userId: string; exp: number } | null {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 5 || parts[0] !== 'sala') return null;
  const body = parts.slice(0, 4).join('.');
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(parts[4]);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  const exp = Number(parts[2]);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  let userId = '';
  try { userId = Buffer.from(parts[1], 'base64url').toString('utf8'); } catch { return null; }
  return userId ? { userId, exp } : null;
}

/** Admin = verified Firebase identity whose verified email is in the admin list. */
export function isAdminIdentity(claims: Pick<VerifiedFirebaseClaims, 'email' | 'emailVerified'> | null | undefined, adminEmails: string[]): boolean {
  if (!claims || !claims.emailVerified || !claims.email) return false;
  const email = claims.email.trim().toLowerCase();
  return adminEmails.map(e => e.trim().toLowerCase()).filter(Boolean).includes(email);
}

export function parseAdminEmails(raw: string | undefined, fallback: string[]): string[] {
  const list = String(raw || '').split(/[,\s]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
  return list.length > 0 ? list : fallback.map(e => e.toLowerCase());
}
