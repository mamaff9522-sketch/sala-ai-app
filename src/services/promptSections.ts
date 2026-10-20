/**
 * Section-based editing of a finished clip prompt ("Label: text. Label: text. ...").
 * A section runs from its label to the NEXT KNOWN section label (never to the first ". "), so
 * multi-sentence values (library appearances, set descriptions, Gemini free text) are removed whole.
 * Labels that can occur inside library text ("Default pose:", "Left wall:", "Floor:") are NOT known
 * labels, so they never end a section.
 */
export const KNOWN_SECTION_LABELS = [
  'Character Lock',
  'Reference image',
  'Location Lock (library, verbatim)',
  'Location Lock',
  'Location',
  'Architectural Environment',
  'Setting',
  'Set Design',
  'Set Details',
  'Scene Setting',
  'Environment',
  'Background',
  'Atmosphere',
  'Spatial Positioning Lock',
  'Props',
  'Starting moment',
  'Core action',
  'Script action',
  'Scene Action',
  'Ending momentum',
  'Cinematography',
  'Camera',
  'Dialogue',
  'Soundscape',
  'Audio',
  'Continuity Handoff',
  'Stance/Position Lock',
  'Negative prompt'
];

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const LABEL_ALT = KNOWN_SECTION_LABELS.map(esc).join('|');
/** A known label at the start or after whitespace / sentence punctuation. */
const LABEL_RE = new RegExp(`(^|[\\s.;,|])(${LABEL_ALT}):`, 'g');

export interface PromptSection { label: string; start: number; end: number; text: string }

/** All known-label sections of a prompt, in order (text = full "Label: ..." slice, trimmed). */
export function findSections(prompt: string): PromptSection[] {
  const hits: Array<{ label: string; start: number }> = [];
  LABEL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LABEL_RE.exec(prompt))) {
    const start = m.index + m[1].length;
    hits.push({ label: m[2], start });
  }
  return hits.map((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].start : prompt.length;
    return { label: h.label, start: h.start, end, text: prompt.slice(h.start, end).trim() };
  });
}

/** Removes sections matching the predicate; returns the new prompt and the index where the first one was. */
export function removeSections(prompt: string, pred: (s: PromptSection) => boolean): { prompt: string; firstIndex: number } {
  const sections = findSections(prompt).filter(pred);
  if (sections.length === 0) return { prompt, firstIndex: -1 };
  let out = prompt;
  for (let i = sections.length - 1; i >= 0; i--) out = out.slice(0, sections[i].start) + out.slice(sections[i].end);
  return { prompt: out, firstIndex: sections[0].start };
}

/** Inserts a block at an index with clean ". " joins (block must end with "."). */
export function insertBlock(prompt: string, index: number, block: string): string {
  const before = prompt.slice(0, Math.max(0, index)).replace(/[\s;,|]+$/, '');
  const after = prompt.slice(Math.max(0, index)).replace(/^[\s.;,|]+/, '');
  const b = block.trim().replace(/\.*$/, '.');
  return tidy(`${before}${before ? (/[.!?]$/.test(before) ? ' ' : '. ') : ''}${b}${after ? ` ${after}` : ''}`);
}

/** Collapses doubled spaces / periods left by removals. */
export function tidy(prompt: string): string {
  // "..." / "…" inside dialogue are kept: only stray doubled periods left by removals are collapsed
  const ELL = '\u0000ELLIPSIS\u0000';
  return prompt
    .replace(/\.{3,}/g, ELL)
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .replace(/\.(\s*\.)+/g, '.')
    .split(ELL).join('...')
    .trim();
}

/** Removes every exact occurrence of the given texts (used before section cutting for idempotency). */
export function stripExact(prompt: string, texts: string[]): string {
  let out = prompt;
  for (const t of texts) if (t && t.length > 20) out = out.split(t).join(' ');
  return out;
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

/**
 * Removes leftovers after lines or sections were moved out of a prompt:
 * - a speech cue without its line: `น้ำฟ้า speaks: ;`, `she replies with dignity:.`
 * - an empty label: `Continuity Flow:.`, `Dialogue:` at the end
 */
export function dropEmptyCues(prompt: string): string {
  let p = String(prompt || '');
  const CUE = /(?:^|(?<=[.;"”]\s?)|(?<=\s))[^.;:"“”\[\]]{0,60}\b(?:speaks|says|shouts|yells|replies|asks|whispers|answers|responds)\b[^.;:"“”\[\]]{0,40}[:：]\s*(?=[.;]|$)[.;]?/gi;
  const EMPTY_LABEL = /(^|[.;"”]\s*)(?:[A-Za-z][A-Za-z /&-]{1,30}|[ก-๙][ก-๙ /]{0,30})[:：]\s*(?=[.;](?:\s|$)|$)[.;]?/g;
  for (let i = 0; i < 3; i++) {
    const before = p;
    p = p.replace(CUE, ' ').replace(EMPTY_LABEL, '$1');
    if (p === before) break;
  }
  return tidy(p.replace(/\s+([.;,])/g, '$1').replace(/;\s*\./g, '.').replace(/([.;])\s*;/g, '$1'));
}

/** Compare text ignoring spaces, quotes and punctuation. */
const squash = (t: string) => String(t || '').replace(/[\s"'“”‘’.,!?…:;()\[\]\-–—~]/g, '');

/**
 * Makes sure every dialogue line of the clip is written in its prompt. Gemini's English scene
 * description often leaves the lines out, and a video prompt without them makes the characters
 * say nothing (or invent speech). Missing lines are added, in order, as one "Dialogue:" section.
 */
export function ensureDialoguesInPrompt(prompt: string, dialogues: { speaker?: string; line?: string; dialogue?: string; emotionOrAction?: string }[] | undefined): string {
  const p = String(prompt || '');
  const have = squash(p);
  const missing = (dialogues || [])
    .map(d => ({ speaker: String(d?.speaker || '').trim(), line: String(d?.line ?? d?.dialogue ?? '').trim(), how: String(d?.emotionOrAction || '').trim() }))
    .filter(d => d.line && !have.includes(squash(d.line)));
  if (missing.length === 0) return p;
  const cue = missing.map(d => `${d.speaker || 'Character'}${d.how ? ` ${d.how}` : ''} speaks: "${d.line}"`).join('; ');
  const body = p.replace(/[.\s]+$/, '');
  return body ? `${body}. Dialogue: ${cue}.` : `Dialogue: ${cue}.`;
}
