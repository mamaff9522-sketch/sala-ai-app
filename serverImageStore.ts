/**
 * Permanent copies of uploaded reference photos (characters / locations).
 *
 * Cloud Run's disk is wiped on every restart and every deploy, so a photo written only to
 * public/uploads disappears (library cards turned blank, prompts lost the character's photo).
 * Every upload is now also stored in Firestore (collection "referenceImages", split into chunks
 * under the 1 MiB document limit). When a /uploads file is missing on disk, it is read back from
 * Firestore and written to disk again (restoreUpload), so old URLs keep working.
 */
import fs from 'fs';
import path from 'path';

const COLLECTION = 'referenceImages';
/** base64 characters per chunk document (Firestore documents max 1 MiB) */
export const CHUNK_CHARS = 700_000;

/** Upload paths that may be stored: "characters/<file>" or "locations/<file>" with a plain file name. */
export function storableUploadPath(rel: string): string | null {
  const m = String(rel || '').replace(/^\/?uploads\//, '').split('?')[0].match(/^(characters|locations)\/([A-Za-z0-9._-]{1,160})$/);
  return m && !m[2].includes('..') ? `${m[1]}/${m[2]}` : null;
}

const docIdFor = (rel: string) => rel.replace(/\//g, '__');

export function splitChunks(base64: string, size = CHUNK_CHARS): string[] {
  const out: string[] = [];
  for (let i = 0; i < base64.length; i += size) out.push(base64.slice(i, i + size));
  return out.length ? out : [''];
}

type Db = any;
let dbLoader: () => Promise<Db> = async () => {
  const { getAdminFirestore } = await import('./serverBilling');
  return getAdminFirestore();
};
/** Tests swap in an in-memory store. */
export function setImageStoreDb(loader: () => Promise<Db>): void { dbLoader = loader; }

export async function saveUploadToStore(rel: string, base64: string, mimeType: string): Promise<boolean> {
  const key = storableUploadPath(rel);
  if (!key || !base64) return false;
  const db = await dbLoader();
  const chunks = splitChunks(base64);
  const ref = db.collection(COLLECTION).doc(docIdFor(key));
  for (let i = 0; i < chunks.length; i++) {
    await ref.collection('chunks').doc(String(i).padStart(4, '0')).set({ data: chunks[i] });
  }
  // Written last: a photo only counts as stored once every chunk is in
  await ref.set({ path: key, mimeType, chunks: chunks.length, size: base64.length, savedAt: new Date().toISOString() });
  return true;
}

export async function loadUploadFromStore(rel: string): Promise<{ mimeType: string; buffer: Buffer } | null> {
  const key = storableUploadPath(rel);
  if (!key) return null;
  const db = await dbLoader();
  const ref = db.collection(COLLECTION).doc(docIdFor(key));
  const head = await ref.get();
  if (!head.exists) return null;
  const meta = head.data() || {};
  const n = Number(meta.chunks) || 0;
  if (n <= 0) return null;
  const parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const c = await ref.collection('chunks').doc(String(i).padStart(4, '0')).get();
    if (!c.exists) return null;
    parts.push(String(c.data()?.data || ''));
  }
  return { mimeType: String(meta.mimeType || 'image/jpeg'), buffer: Buffer.from(parts.join(''), 'base64') };
}

/**
 * The file behind a /uploads URL, put back on disk from Firestore when the disk lost it.
 * Returns the absolute file path when it exists (already or after restoring), else null.
 */
export async function restoreUpload(uploadsDir: string, rel: string): Promise<string | null> {
  const key = storableUploadPath(rel);
  if (!key) return null;
  const file = path.resolve(uploadsDir, key);
  if (!file.startsWith(path.resolve(uploadsDir) + path.sep)) return null;
  if (fs.existsSync(file)) return file;
  try {
    const stored = await loadUploadFromStore(key);
    if (!stored) return null;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, stored.buffer);
    return file;
  } catch (err: any) {
    console.warn('[imageStore] restore failed:', key, err?.message || err);
    return null;
  }
}

/** Save without blocking the upload response; a failure is logged, the disk copy still works for now. */
export function backupUploadInBackground(rel: string, base64: string, mimeType: string): void {
  saveUploadToStore(rel, base64, mimeType)
    .then(ok => { if (ok) console.log('[imageStore] saved', rel); })
    .catch(err => console.warn('[imageStore] save failed:', rel, err?.message || err));
}
