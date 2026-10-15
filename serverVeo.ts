/**
 * Veo request helpers (Node only; imported by server.ts).
 *
 * - Veo 3.1 / Fast / Lite make 4, 6 or 8 second clips only. 8 is required with
 *   reference images or 1080p. The clip length the user chose is snapped to one of these.
 * - Character reference photos ("asset" reference images, up to 3) work on Veo 3.1 and
 *   Veo 3.1 Fast, not on Veo 3.1 Lite. When a clip carries library photos, the request is
 *   sent to VEO_REFERENCE_MODEL (default veo-3.1-generate-preview). Set
 *   VEO_REFERENCE_MODEL=off to keep Lite and send text only.
 */
import fs from 'fs';
import path from 'path';

export const VEO_DURATIONS = [4, 6, 8] as const;
export type VeoDuration = typeof VEO_DURATIONS[number];
export const VEO_MAX_REFERENCE_IMAGES = 3;
export const DEFAULT_VEO_REFERENCE_MODEL = 'veo-3.1-generate-preview';

/** Nearest allowed length (ties go up). 8 when reference images or 1080p are used. */
export function veoDurationSeconds(
  requested: unknown,
  opts: { resolution?: string; usesReferenceImages?: boolean } = {}
): VeoDuration {
  if (opts.usesReferenceImages || String(opts.resolution || '').toLowerCase() === '1080p') return 8;
  const n = Number(requested);
  if (!Number.isFinite(n) || n <= 0) return 8;
  let best: VeoDuration = 8;
  let bestGap = Infinity;
  for (const d of VEO_DURATIONS) {
    const gap = Math.abs(d - n);
    if (gap < bestGap || (gap === bestGap && d > best)) {
      best = d;
      bestGap = gap;
    }
  }
  return best;
}

/** Veo 3.1 and Veo 3.1 Fast accept asset reference images; Lite and older Veo models do not. */
export function veoSupportsReferenceImages(model: string): boolean {
  const m = String(model || '').toLowerCase();
  return m.startsWith('veo-3.1') && !m.includes('lite');
}

/** Model used when a clip carries character reference photos, or null when turned off. */
export function resolveVeoReferenceModel(env: string | undefined = process.env.VEO_REFERENCE_MODEL): string | null {
  const v = String(env ?? '').trim();
  if (!v) return DEFAULT_VEO_REFERENCE_MODEL;
  if (/^(off|false|0|none)$/i.test(v)) return null;
  return veoSupportsReferenceImages(v) ? v : null;
}

export interface VeoImage {
  imageBytes: string;
  mimeType: string;
}

/**
 * Reads one reference image: a data: URL, or a file under the server's public/uploads folder
 * (given as /uploads/...). Remote URLs are not fetched. Returns null when unusable.
 */
export function loadVeoReferenceImage(ref: unknown, uploadsDir: string): VeoImage | null {
  if (typeof ref !== 'string' || !ref) return null;
  const data = ref.match(/^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (data) return { mimeType: data[1].toLowerCase(), imageBytes: data[2].replace(/\s+/g, '') };
  if (!ref.startsWith('/uploads/')) return null;
  const rel = decodeURIComponent(ref.split(/[?#]/)[0].slice('/uploads/'.length));
  const root = path.resolve(uploadsDir);
  const file = path.resolve(root, rel);
  if (!file.startsWith(root + path.sep)) return null;
  const ext = path.extname(file).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : '';
  if (!mimeType) return null;
  try {
    const buf = fs.readFileSync(file);
    return buf.length > 0 ? { mimeType, imageBytes: buf.toString('base64') } : null;
  } catch {
    return null;
  }
}

/** Up to three distinct usable reference images, in the order given. */
export function loadVeoReferenceImages(refs: unknown, uploadsDir: string): VeoImage[] {
  if (!Array.isArray(refs)) return [];
  const out: VeoImage[] = [];
  const seen = new Set<string>();
  for (const r of refs) {
    if (out.length >= VEO_MAX_REFERENCE_IMAGES) break;
    const img = loadVeoReferenceImage(r, uploadsDir);
    if (!img) continue;
    const key = img.imageBytes.slice(0, 200) + img.imageBytes.length;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(img);
  }
  return out;
}
