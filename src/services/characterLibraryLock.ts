/**
 * Character library -> Character Lock (browser side).
 * - Lock payloads of the library cards (text fields + reference URL, no image bytes).
 * - Reference image reachability check (a lost /uploads file is served as index.html by the
 *   SPA fallback, so the content-type must be an image).
 * - Local copy of the last signed-in user's library lock data, so offline prompts still use the
 *   library when the session is gone (e.g. Google sign-in failing in a preview). Cleared on logout.
 */
import { toCharacterLockPayload, findCharacterByName, type CharacterAppearanceInput } from './characterAppearance';
import { toLocationLockPayload, type LocationLockInput } from './locationAppearance';

const CACHE_KEY = 'sala_charlock_cache_v1';
const MAX_CARDS = 60;

export function libraryLockPayloads(characters: any[] | undefined | null): CharacterAppearanceInput[] {
  return (Array.isArray(characters) ? characters : []).filter(c => c && c.name).slice(0, MAX_CARDS).map(c => toCharacterLockPayload(c));
}

/** Library cards that match the given script names (exact after normalization; never fuzzy). */
export function libraryCardsForNames<T extends { name?: string }>(characters: T[] | undefined | null, names: string[]): T[] {
  const out: T[] = [];
  (names || []).forEach(n => {
    const c = findCharacterByName(characters || [], n);
    if (c && !out.includes(c)) out.push(c);
  });
  return out;
}

const refStatusCache = new Map<string, 'ok' | 'missing'>();

async function isImageReachable(url: string, timeoutMs = 4000): Promise<boolean> {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  if (url.startsWith('blob:')) return false; // temporary, never durable
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    let res = await fetch(url, { method: 'HEAD', signal: ctrl?.signal, cache: 'no-store' });
    if (res.status === 405 || res.status === 501) res = await fetch(url, { method: 'GET', signal: ctrl?.signal, cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    return res.ok && type.startsWith('image/');
  } catch {
    // Cross-origin images may block fetch; fall back to loading as <img>
    if (typeof Image === 'undefined') return false;
    return await new Promise<boolean>(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Marks each payload's reference image as 'ok' or 'missing' (a data-URL backup counts as ok). */
export async function checkReferenceImages<T extends object>(payloads: T[]): Promise<T[]> {
  return Promise.all(payloads.map(async p => {
    const url = String((p as any).referenceImageUrl || '').trim();
    if (!url) return p;
    if (!refStatusCache.has(url)) refStatusCache.set(url, (await isImageReachable(url)) ? 'ok' : 'missing');
    return { ...p, referenceStatus: refStatusCache.get(url) };
  }));
}

export function saveLibraryLockCache(uid: string, characters: any[]): void {
  if (typeof localStorage === 'undefined' || !uid) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ uid, savedAt: new Date().toISOString(), characters: libraryLockPayloads(characters) }));
  } catch {
    // quota: drop the data-URL backups and retry once
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ uid, savedAt: new Date().toISOString(), characters: libraryLockPayloads(characters).map(c => ({ ...c, referenceImageBackup: undefined })) }));
    } catch { /* ignore */ }
  }
}

export function loadLibraryLockCache(): { uid: string; savedAt: string; characters: CharacterAppearanceInput[] } | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (raw && Array.isArray(raw.characters)) return raw;
  } catch { /* ignore */ }
  return null;
}

export function clearLibraryLockCache(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(CACHE_KEY);
}

// ---- Location library (same approach: lock payloads + on-device copy for logged-out offline use) ----
const LOC_CACHE_KEY = 'sala_loclock_cache_v1';

export function locationLockPayloads(locations: any[] | undefined | null): LocationLockInput[] {
  return (Array.isArray(locations) ? locations : []).filter(l => l && l.name).slice(0, MAX_CARDS).map(l => toLocationLockPayload(l));
}

export function saveLocationLockCache(uid: string, locations: any[]): void {
  if (typeof localStorage === 'undefined' || !uid) return;
  const write = (list: LocationLockInput[]) => localStorage.setItem(LOC_CACHE_KEY, JSON.stringify({ uid, savedAt: new Date().toISOString(), locations: list }));
  try { write(locationLockPayloads(locations)); } catch {
    try { write(locationLockPayloads(locations).map(l => ({ ...l, referenceImageBackup: undefined }))); } catch { /* ignore */ }
  }
}

export function loadLocationLockCache(): { uid: string; savedAt: string; locations: LocationLockInput[] } | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = JSON.parse(localStorage.getItem(LOC_CACHE_KEY) || 'null');
    if (raw && Array.isArray(raw.locations)) return raw;
  } catch { /* ignore */ }
  return null;
}

export function clearLocationLockCache(): void {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(LOC_CACHE_KEY);
}
