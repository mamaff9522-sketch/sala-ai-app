/**
 * Video generation with Gemini Omni Flash (Node only; imported by server.ts).
 *
 * Veo 3.1 / 3.1 Lite shut down on 22 Oct 2026; Google's replacement is Gemini Omni Flash
 * (gemini-omni-1.1-flash), called through the Interactions API:
 *   POST https://generativelanguage.googleapis.com/v1beta/interactions
 *   { model, input: [image parts..., text part], response_format: { type: 'video', aspect_ratio, resolution } }
 * The video comes back in steps[].content[] as { type: 'video', data (base64) | uri, mime_type }.
 *
 * Continuity for a story told in many clips:
 * - character photos from the library go in as references (<IMAGE_REF_n>), so faces stay the same
 * - a clip that continues the previous one (same place) starts from that clip's LAST FRAME
 *   (<FIRST_FRAME>), so the set, light and positions carry over
 * Images are declared in the prompt with @ImageN labels in input order:
 *   [# Sources <FIRST_FRAME>@Image1] [# References <IMAGE_REF_0>@Image2 ...]
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import type { VeoImage } from './serverVeo';

export const OMNI_VIDEO_MODEL = (process.env.OMNI_VIDEO_MODEL || 'gemini-omni-1.1-flash').trim();
export const OMNI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
export const OMNI_MAX_REFERENCES = 3;

export interface OmniVideoRequest {
  prompt: string;
  /** Character photos, in order; names[i] is who photo i shows */
  references?: VeoImage[];
  referenceNames?: string[];
  /** Start frame (e.g. the last frame of the previous clip) */
  firstFrame?: VeoImage | null;
  aspectRatio?: string;
  resolution?: string;
  durationSeconds?: number;
}

/** Interactions API body: images first (Image1..), then one text part with the tag declaration. */
export function buildOmniRequestBody(req: OmniVideoRequest, model = OMNI_VIDEO_MODEL): any {
  const refs = (req.references || []).slice(0, OMNI_MAX_REFERENCES);
  const names = req.referenceNames || [];
  const images: VeoImage[] = [];
  const sources: string[] = [];
  const references: string[] = [];
  if (req.firstFrame) {
    images.push(req.firstFrame);
    sources.push(`<FIRST_FRAME>@Image${images.length}`);
  }
  refs.forEach((img, i) => {
    images.push(img);
    references.push(`<IMAGE_REF_${i}>@Image${images.length}`);
  });
  const header = [
    sources.length ? `[# Sources ${sources.join(' ')}]` : '',
    references.length ? `[# References ${references.join(' ')}]` : ''
  ].filter(Boolean).join(' ');
  const cast = refs.length
    ? `Characters (keep each one's face, body, species and outfit exactly as in its reference image in every shot): ${refs.map((_, i) => `<IMAGE_REF_${i}>${names[i] ? ` = ${names[i]}` : ''}`).join(', ')}.`
    : '';
  const start = req.firstFrame
    ? 'The video starts exactly on <FIRST_FRAME>: same place, background, light, character positions and poses, then continues the action.'
    : '';
  const seconds = Number(req.durationSeconds) > 0 ? Math.min(10, Math.max(3, Math.round(Number(req.durationSeconds)))) : 0;
  const length = seconds ? `Video length about ${seconds} seconds.` : '';
  const text = [header, start, cast, String(req.prompt || '').trim(), length].filter(Boolean).join('\n');

  const response_format: any = { type: 'video', delivery: 'uri' };
  if (req.aspectRatio === '9:16' || req.aspectRatio === '16:9') response_format.aspect_ratio = req.aspectRatio;
  const res = String(req.resolution || '').toLowerCase();
  if (['360p', '720p', '1080p', '4k'].includes(res)) response_format.resolution = res;

  return {
    model,
    input: [
      ...images.map(img => ({ type: 'image', data: img.imageBytes, mime_type: img.mimeType })),
      { type: 'text', text }
    ],
    response_format,
    background: false,
    stream: false,
    store: false
  };
}

/** Finds the video in an Interactions API response (steps[].content[] or SDK-style output_video). */
export function extractOmniVideo(json: any): { data?: string; uri?: string; mimeType?: string } | null {
  if (!json || typeof json !== 'object') return null;
  if (json.output_video && (json.output_video.data || json.output_video.uri)) {
    return { data: json.output_video.data, uri: json.output_video.uri, mimeType: json.output_video.mime_type };
  }
  const seen = new Set<any>();
  const walk = (v: any): any => {
    if (!v || typeof v !== 'object' || seen.has(v)) return null;
    seen.add(v);
    if (v.type === 'video' && (typeof v.data === 'string' || typeof v.uri === 'string')) return v;
    for (const k of Object.keys(v)) {
      const hit = walk(v[k]);
      if (hit) return hit;
    }
    return null;
  };
  const hit = walk(json.steps ?? json);
  return hit ? { data: hit.data, uri: hit.uri, mimeType: hit.mime_type || hit.mimeType } : null;
}

/** Human message for a failed / blocked interaction, or '' when it succeeded. */
export function omniFailureReason(json: any, httpStatus: number): string {
  if (httpStatus >= 400) {
    return String(json?.error?.message || json?.message || `HTTP ${httpStatus}`);
  }
  const status = String(json?.status || '').toLowerCase();
  if (status && !['completed', 'succeeded', 'success', 'done'].includes(status)) {
    return String(json?.error?.message || json?.status_details || `สถานะ ${json.status}`);
  }
  return '';
}

type FetchLike = (url: string, init?: any) => Promise<{ ok: boolean; status: number; json(): Promise<any>; arrayBuffer(): Promise<ArrayBuffer> }>;

async function downloadOmniFile(uri: string, apiKey: string, fetchImpl: FetchLike): Promise<Buffer> {
  const base = uri.startsWith('http') ? uri : `https://generativelanguage.googleapis.com/v1beta/${uri.replace(/^\/+/, '')}`;
  const headers = { 'x-goog-api-key': apiKey };
  // Wait until the file is ready (ACTIVE), up to ~3 minutes
  for (let i = 0; i < 36; i++) {
    try {
      const meta = await fetchImpl(base.replace(/:download.*$/, ''), { headers });
      const m: any = meta.ok ? await meta.json() : null;
      const state = String(m?.state || m?.file?.state || 'ACTIVE').toUpperCase();
      if (state === 'ACTIVE') break;
      if (state === 'FAILED') throw new Error('ไฟล์วิดีโอบนเซิร์ฟเวอร์ Google ประมวลผลไม่สำเร็จ');
    } catch (e: any) {
      if (String(e?.message || '').includes('ไม่สำเร็จ')) throw e;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  const url = /:download/.test(base) ? base : `${base}:download?alt=media`;
  const res = await fetchImpl(url, { headers });
  if (!res.ok) throw new Error(`ดาวน์โหลดวิดีโอจาก Google ไม่สำเร็จ (HTTP ${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/** One clip. Returns the MP4 bytes and the raw response (for usage / logging). */
export async function generateOmniVideo(
  req: OmniVideoRequest,
  apiKey: string,
  fetchImpl: FetchLike = fetch as any
): Promise<{ bytes: Buffer; response: any }> {
  if (!apiKey) throw new Error('ไม่พบ GEMINI_API_KEY บนเซิร์ฟเวอร์');
  const body = buildOmniRequestBody(req);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 10 * 60 * 1000) : null;
  let res: any;
  let json: any = null;
  try {
    res = await fetchImpl(OMNI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      ...(controller ? { signal: controller.signal } : {})
    });
    try { json = await res.json(); } catch { json = null; }
  } finally {
    if (timer) clearTimeout(timer);
  }
  const failure = omniFailureReason(json, res?.status || 0);
  if (failure) throw new Error(`Gemini Omni: ${failure}`);
  const video = extractOmniVideo(json);
  if (!video) throw new Error('Gemini Omni ไม่ได้ส่งวิดีโอกลับมา (อาจถูกระบบความปลอดภัยปฏิเสธ)');
  const bytes = video.data ? Buffer.from(video.data, 'base64') : await downloadOmniFile(String(video.uri), apiKey, fetchImpl);
  if (!bytes.length) throw new Error('Gemini Omni ส่งไฟล์วิดีโอว่างเปล่า');
  return { bytes, response: json };
}

/** Last frame of an MP4 as a JPEG (ffmpeg). null when ffmpeg or the file is unavailable. */
export function extractLastFrame(videoPath: string, ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg'): Promise<VeoImage | null> {
  return new Promise(resolve => {
    if (!videoPath || !fs.existsSync(videoPath)) return resolve(null);
    const out = path.join(os.tmpdir(), `sala_last_${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.jpg`);
    execFile(ffmpegBin, ['-y', '-loglevel', 'error', '-sseof', '-0.25', '-i', videoPath, '-frames:v', '1', '-q:v', '2', out], { timeout: 60_000 }, err => {
      try {
        if (err || !fs.existsSync(out)) return resolve(null);
        const buf = fs.readFileSync(out);
        resolve(buf.length ? { imageBytes: buf.toString('base64'), mimeType: 'image/jpeg' } : null);
      } finally {
        try { fs.unlinkSync(out); } catch { /* ignore */ }
      }
    });
  });
}
