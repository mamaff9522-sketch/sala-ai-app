/**
 * Native (Capacitor) API origin.
 *
 * The Android WebView keeps the bundled UI (webDir dist, androidScheme https,
 * no remote document URL). Relative /api calls would hit https://localhost and never
 * reach Cloud Run. On the native app only, those calls are prefixed with the
 * live API origin. A normal browser on the website still uses relative URLs.
 *
 * GEMINI_API_KEY stays on the server. This file does not read or embed it.
 */
import { isNativeApp } from './appAccess';

export const CLOUD_RUN_API_ORIGIN =
  'https://sala-ai-cinematic-ai-video-short-drama-studio-84189743559.asia-southeast1.run.app';

export function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

/**
 * Prefix a relative or same-document /api URL when `native` is true.
 * Absolute URLs to other hosts, data/blob URLs, and non-API paths are unchanged.
 * Already-prefixed Cloud Run URLs are unchanged (safe to apply twice).
 */
export function prefixApiUrl(input: string, native: boolean, pageOrigin = ''): string {
  if (!native || !input) return input;
  if (input.startsWith('data:') || input.startsWith('blob:') || input.startsWith('file:')) return input;
  if (input.startsWith('/api/') || input === '/api' || input.startsWith('/api?')) {
    return CLOUD_RUN_API_ORIGIN + input;
  }
  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      const url = new URL(input);
      if (pageOrigin && url.origin === pageOrigin && isApiPath(url.pathname)) {
        return CLOUD_RUN_API_ORIGIN + url.pathname + url.search + url.hash;
      }
    } catch {
      return input;
    }
  }
  return input;
}

let installed = false;

function rewrite(input: string): string {
  const pageOrigin = typeof location !== 'undefined' ? location.origin : '';
  return prefixApiUrl(input, true, pageOrigin);
}

function patchFetch(): void {
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') return original(rewrite(input), init);
    if (input instanceof URL) return original(rewrite(input.toString()), init);
    if (typeof Request !== 'undefined' && input instanceof Request) {
      const next = rewrite(input.url);
      if (next === input.url) return original(input, init);
      return original(new Request(next, input), init);
    }
    return original(input, init);
  };
}

function patchUrlProperty(proto: object | undefined, prop: 'src' | 'href'): void {
  if (!proto) return;
  const desc = Object.getOwnPropertyDescriptor(proto, prop);
  if (!desc?.set || !desc.get) return;
  const setter = desc.set;
  Object.defineProperty(proto, prop, {
    configurable: true,
    enumerable: desc.enumerable ?? true,
    get: desc.get,
    set(value: string) {
      setter.call(this, rewrite(String(value ?? '')));
    }
  });
}

function patchSetAttribute(): void {
  const original = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (qualifiedName: string, value: string) {
    const name = String(qualifiedName || '').toLowerCase();
    if ((name === 'src' || name === 'href') && typeof value === 'string') {
      return original.call(this, qualifiedName, rewrite(value));
    }
    return original.call(this, qualifiedName, value);
  };
}

/**
 * Install once, and only inside the Capacitor WebView.
 * Covers every client fetch('/api/...'), including video transcription
 * (/api/video-to-script/analyze) and /api/director/generate-multi-clip-prompts,
 * plus <video>/<img>/anchor loads of /api URLs (video-stream, download).
 * Does not change the document URL, so the bundled page stays in place.
 */
export function installNativeApiRouting(): void {
  if (installed || typeof window === 'undefined') return;
  if (!isNativeApp()) return;
  installed = true;
  patchFetch();
  if (typeof HTMLMediaElement !== 'undefined') patchUrlProperty(HTMLMediaElement.prototype, 'src');
  if (typeof HTMLImageElement !== 'undefined') patchUrlProperty(HTMLImageElement.prototype, 'src');
  if (typeof HTMLAnchorElement !== 'undefined') patchUrlProperty(HTMLAnchorElement.prototype, 'href');
  patchSetAttribute();
}
