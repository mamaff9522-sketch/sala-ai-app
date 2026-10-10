/**
 * Admin emails. The first admin is always mama.ff9522@gmail.com.
 * Extra emails are added only by an existing admin (POST /api/admin/admins)
 * and stored in data/admin-emails.json (gitignored with the rest of data/).
 * ADMIN_EMAILS in the environment is merged in, never required.
 */
import fs from 'fs';
import path from 'path';

export const SEED_ADMIN_EMAIL = 'mama.ff9522@gmail.com';

const FILE = path.join(process.cwd(), 'data', 'admin-emails.json');

export function normalizeAdminEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200;
}

function envEmails(): string[] {
  return String(process.env.ADMIN_EMAILS || '')
    .split(/[,\s]+/)
    .map(normalizeAdminEmail)
    .filter(validEmail);
}

function fileEmails(): string[] {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const list = Array.isArray(raw) ? raw : raw?.emails;
    if (!Array.isArray(list)) return [];
    return list.map((e: unknown) => normalizeAdminEmail(String(e))).filter(validEmail);
  } catch {
    return [];
  }
}

/** Seed + env + file. The seed email cannot be removed. */
export function readAdminEmails(): string[] {
  return [...new Set([SEED_ADMIN_EMAIL, ...envEmails(), ...fileEmails()])];
}

/** Persists one extra admin email. Caller must already be an admin. */
export function addAdminEmail(email: string): string[] {
  const next = normalizeAdminEmail(email);
  if (!validEmail(next)) {
    const err = new Error('อีเมลไม่ถูกต้อง');
    (err as any).status = 400;
    throw err;
  }
  const emails = readAdminEmails();
  if (!emails.includes(next)) emails.push(next);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(emails, null, 2));
  return emails;
}
