/**
 * imageHash.ts
 * Deterministic hash utility for character reference images.
 * Uses SHA-256 for browser-side fast verification and cache keys.
 */

export async function computeImageHash(dataOrBase64: string): Promise<string> {
  if (!dataOrBase64) return '';
  const commaIdx = dataOrBase64.indexOf(',');
  const raw = commaIdx !== -1 ? dataOrBase64.slice(commaIdx + 1).trim() : dataOrBase64.trim();

  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(raw);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fallback if crypto.subtle fails
  }

  // Deterministic fallback hash
  let h1 = 0xdeadbeef;
  let h2 = 0x41c64e6d;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
}
