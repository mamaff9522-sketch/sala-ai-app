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
  return prompt.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').replace(/\.(\s*\.)+/g, '.').trim();
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
