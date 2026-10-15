/**
 * Picks the character library photos that go with one clip to Veo (as "asset" reference
 * images, so faces and outfits stay the same from clip to clip). Veo takes at most 3.
 *
 * A character counts as in the clip when listed in charactersPresent, when they speak,
 * or when their name is in the prompt. The server copy (/uploads/...) is preferred; the
 * small data-URL backup is used when the server copy is missing. Remote http(s) URLs are
 * skipped because the server does not fetch them.
 */
export const MAX_CLIP_REFERENCE_IMAGES = 3;

interface ClipLike {
  charactersPresent?: string[];
  dialogues?: { speaker?: string }[];
  generatedPrompt?: string;
}

interface LibraryCharacterLike {
  name?: string;
  referenceImageUrl?: string;
  referenceImageBackup?: string;
  referenceStatus?: string;
}

function usableUrl(c: LibraryCharacterLike): string | null {
  const url = String(c.referenceImageUrl || '').trim();
  const backup = String(c.referenceImageBackup || '').trim();
  const realBackup = /^data:image\/[a-z0-9.+-]+;base64,./i.test(backup) ? backup : '';
  if (url && c.referenceStatus !== 'missing') {
    if (url.startsWith('/uploads/') || /^data:image\//i.test(url)) return url;
  }
  return realBackup || null;
}

export function pickClipReferenceImages(
  clip: ClipLike,
  library: LibraryCharacterLike[],
  max = MAX_CLIP_REFERENCE_IMAGES
): string[] {
  if (!clip || !Array.isArray(library) || library.length === 0) return [];
  const order: string[] = [];
  const add = (n?: string) => {
    const name = String(n || '').trim();
    if (name && !order.includes(name)) order.push(name);
  };
  (clip.dialogues || []).forEach(d => add(d?.speaker));
  (clip.charactersPresent || []).forEach(add);
  const prompt = String(clip.generatedPrompt || '');
  library.forEach(c => { if (c?.name && prompt.includes(String(c.name))) add(c.name); });

  const out: string[] = [];
  for (const name of order) {
    if (out.length >= max) break;
    const c = library.find(l => String(l?.name || '').trim() === name);
    if (!c) continue;
    const url = usableUrl(c);
    if (url && !out.includes(url)) out.push(url);
  }
  return out;
}
