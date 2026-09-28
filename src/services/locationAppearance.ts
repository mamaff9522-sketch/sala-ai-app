/**
 * Location Lock from the location library (pure functions, browser + server safe).
 * ---------------------------------------------------------------------------------
 * The library card is the source of truth for the set: its factual description (materials,
 * colours, object counts, furniture with positions) is used VERBATIM in every clip, followed by
 * "Reference image: <location> reference photo — match exactly (do not add, remove or move objects)".
 * Any location / set text written by Gemini is replaced (enforceLibraryLocationLocks).
 *
 * Matching (same rules as characters): exact name, then a unique match after normalizing
 * spacing / parentheticals / case (also against the card's story alias). Partial names never match.
 */
import type { DirectedClipItem } from '../types';
import { findSections, removeSections, insertBlock, stripExact, tidy } from './promptSections';

export interface LocationLockInput {
  id?: string;
  name: string;
  /** Factual set description used verbatim (lockDescription > storyProfile.description > description) */
  description?: string;
  lockDescription?: string;
  storyProfile?: { storyLocationName?: string; description?: string };
  visualProfile?: any;
  referenceImageUrl?: string;
  referenceImageBackup?: string;
  hasReferenceBackup?: boolean;
  referenceStatus?: 'ok' | 'missing';
  imageHash?: string;
  referenceImageId?: string;
  referenceMetadata?: { referenceImageUrl?: string; imageHash?: string; referenceImageId?: string };
  [key: string]: any;
}

export interface ResolvedLocationLock {
  name: string;
  found: boolean;
  description: string;
  referenceLine: string;
  warnings: string[];
}

const PLACEHOLDER_RE = /^(?:ไม่ระบุ(?:จากต้นฉบับ)?|ตามภาพอ้างอิง|-|n\/a|none|unknown)$/i;

export function missingLocationWarning(name: string): string {
  return `ไม่พบสถานที่ ${name} ในคลัง — เพิ่มสถานที่ในคลังสถานที่ หรือเลือกสถานที่จากคลัง / Location "${name}" is not in the location library`;
}
export function missingLocationReferenceWarning(name: string): string {
  return `รูปอ้างอิงของสถานที่ ${name} หาย กรุณาอัปโหลดใหม่ / Reference photo for location ${name} is missing — please re-upload it`;
}

/** Name key: NFC, no zero-width chars, no parenthetical, no whitespace, lower case. */
export function normalizeLocationNameKey(name: string): string {
  return String(name || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\([^)]*\)/g, '').replace(/[“”"'`]/g, '').replace(/\s+/g, '').toLowerCase().trim();
}

const namesOf = (l: any): string[] => [l?.name, l?.storyProfile?.storyLocationName, l?.identity?.name]
  .map(n => String(n || '').trim()).filter(Boolean);

/** Exact name / alias first, then a UNIQUE normalized match. Never substring / prefix matching. */
export function findLocationByName<T extends { name?: string }>(list: T[] | undefined | null, name: string): T | undefined {
  const target = String(name || '').trim();
  if (!target || !Array.isArray(list)) return undefined;
  const exact = list.filter(l => namesOf(l).includes(target));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;
  const key = normalizeLocationNameKey(target);
  if (key.length < 2) return undefined;
  const hits = list.filter(l => namesOf(l).some(n => normalizeLocationNameKey(n) === key));
  return hits.length === 1 ? hits[0] : undefined;
}

/** Factual description of a card: the owner's text wins; structured fields only as a fallback. */
export function locationDescriptionOf(l: any): string {
  const clean = (v: any) => { const s = String(v ?? '').trim(); return s && !PLACEHOLDER_RE.test(s) ? s : ''; };
  const direct = clean(l?.lockDescription) || clean(l?.storyProfile?.description) || clean(l?.description);
  if (direct) return direct;
  const v = l?.visualProfile || {};
  return [
    v.architecturalStyle && `Architecture: ${v.architecturalStyle}`,
    v.environmentType && `Environment: ${v.environmentType}`,
    v.wallColor && `Walls: ${v.wallColor}`,
    v.floor && `Floor: ${v.floor}`,
    v.ceiling && `Ceiling: ${v.ceiling}`,
    v.doors && `Doors: ${v.doors}`,
    v.windows && `Windows: ${v.windows}`,
    v.majorFurniture && `Furniture: ${v.majorFurniture}`,
    v.fixedObjects && `Fixed objects: ${v.fixedObjects}`,
    v.spatialLayout && `Layout: ${v.spatialLayout}`,
    v.permanentDecor && `Decor: ${v.permanentDecor}`,
    v.distinctiveFeatures && `Key features: ${v.distinctiveFeatures}`
  ].map(clean).filter(Boolean).join('; ');
}

/** Lock-relevant fields of a library location (no image bytes except a small data-URL backup). */
export function toLocationLockPayload(l: any): LocationLockInput {
  return {
    id: l?.id, name: String(l?.name || ''),
    description: locationDescriptionOf(l),
    storyProfile: l?.storyProfile ? { storyLocationName: l.storyProfile.storyLocationName } : undefined,
    referenceImageUrl: l?.referenceImageUrl || l?.referenceMetadata?.referenceImageUrl || l?.visualProfile?.referenceImageUrl || l?.thumbnailUrl || undefined,
    referenceImageBackup: typeof l?.referenceImageBackup === 'string' && l.referenceImageBackup.length < 900_000 ? l.referenceImageBackup : undefined,
    hasReferenceBackup: l?.hasReferenceBackup || undefined,
    referenceStatus: l?.referenceStatus,
    imageHash: l?.imageHash, referenceImageId: l?.referenceImageId
  };
}

/** Location lock of one name: library card (selected id wins) or a "not in library" warning. */
export function resolveLocationLock(name: string, library: LocationLockInput[] = [], selectedId?: string): ResolvedLocationLock {
  const card = (selectedId && library.find(l => l.id === selectedId)) || findLocationByName(library, name);
  const shownName = String(name || card?.name || '').trim();
  if (!card) return { name: shownName, found: false, description: '', referenceLine: '', warnings: shownName ? [missingLocationWarning(shownName)] : [] };
  const description = locationDescriptionOf(card);
  const url = String(card.referenceImageUrl || '').trim();
  const backup = !!(card.referenceImageBackup || card.hasReferenceBackup);
  const declared = !!(url || backup || card.imageHash || card.referenceImageId);
  const missing = card.referenceStatus === 'missing' || (!url && !backup);
  const usable = (url && card.referenceStatus !== 'missing') || backup;
  const warnings: string[] = [];
  if (declared && missing && !backup) warnings.push(missingLocationReferenceWarning(shownName));
  return {
    name: shownName,
    found: true,
    description,
    referenceLine: usable ? `${shownName} reference photo — match exactly (do not add, remove or move objects)` : '',
    warnings
  };
}

/** "Location: <name>. Location Lock (library, verbatim): <description> Reference image: ..." */
export function formatLocationLockBlock(r: ResolvedLocationLock): string {
  const desc = r.description.trim();
  const parts = [`Location: ${r.name}`];
  if (desc) parts.push(`Location Lock (library, verbatim): ${desc}${/[.!?]$/.test(desc) ? '' : '.'}`);
  let block = parts.join('. ');
  if (!desc && !/[.]$/.test(block)) block += '.';
  if (r.referenceLine) block += ` Reference image: ${r.referenceLine}.`;
  return block;
}

/** Place part of a scene heading: "ฉากที่ 2 — ห้องครัว / ช่วงสาย" -> { name: 'ห้องครัว', structured: true }. */
export function headingLocation(title: string): { name: string; structured: boolean } {
  const t = String(title || '').replace(/^\s*(?:ฉากที่|ฉาก|scene|clip)\s*\d+\s*[:.\-—–]?\s*/i, '').replace(/\((?:ประมาณ|about|~)?\s*\d+[^)]*\)/g, '').trim();
  if (!t) return { name: '', structured: false };
  const parts = t.split(/\s*\/\s*|\s+[-—–]\s+/).map(x => x.trim()).filter(Boolean);
  return { name: parts[0] || '', structured: parts.length > 1 };
}

// Sections of set / location text that the library lock replaces (Gemini or builder)
const SET_LABELS = new Set(['Location', 'Location Lock', 'Location Lock (library, verbatim)', 'Architectural Environment', 'Setting', 'Set Design', 'Set Details', 'Scene Setting', 'Environment', 'Background']);

/**
 * Rewrites the location part of each clip from the library: the clip's location name (or the
 * selected library location) -> verbatim description + reference line. Every set / location
 * section (Location / Setting / Environment / Background ..., up to the next known section label,
 * so multi-sentence text goes whole) and any old location reference line is removed; Atmosphere is
 * rebuilt from the locked time / lighting for Gemini output. Idempotent. Warnings -> clip.locationWarnings.
 */
export function enforceLibraryLocationLocks(
  clips: DirectedClipItem[],
  library: LocationLockInput[] | undefined,
  opts: { selectedLocationId?: string; lockedLocation?: string; timeOfDay?: string; lighting?: string; rebuildAtmosphere?: boolean } = {}
): DirectedClipItem[] {
  if (!Array.isArray(library)) return clips;
  const selected = opts.selectedLocationId ? library.find(l => l.id === opts.selectedLocationId) : undefined;
  const knownDescriptions = library.map(l => locationDescriptionOf(l)).filter(d => d.length > 20);
  let previousMatched = '';
  return clips.map(c => {
    // Location of the clip: selected library card > locked location > clip location > scene heading
    // ("ฉากที่ 2 — ห้องครัว / ช่วงสาย") > the previous clip's location (sub-clips / mood-title headings)
    let name = selected?.name || opts.lockedLocation || (c as any).locationName || '';
    if (!name) {
      const h = headingLocation(String((c as any).title || ''));
      if (h.name && (findLocationByName(library, h.name) || h.structured)) name = h.name;
      else name = previousMatched;
    }
    const r = resolveLocationLock(name, library, selected?.id);
    if (r.found) previousMatched = r.name;
    const out: any = { ...c, locationWarnings: r.warnings };
    if (!r.found) return out as DirectedClipItem;

    const block = formatLocationLockBlock(r);
    // Exact previous blocks / descriptions first (descriptions may contain "Floor:"-style text)
    let prompt = stripExact(String(c.generatedPrompt || ''), [block, ...knownDescriptions]);
    const removed = removeSections(prompt, s => SET_LABELS.has(s.label) ||
      (s.label === 'Reference image' && /reference photo — match exactly/.test(s.text)));
    prompt = removed.prompt;
    let insertAt = removed.firstIndex;
    const first = findSections(prompt)[0];
    if (insertAt === -1 || insertAt > prompt.length) {
      // after the visual style (text before the first section), else at the start
      insertAt = first ? first.start : prompt.length;
    }
    prompt = insertBlock(prompt, insertAt, block);
    // Gemini output: Atmosphere may carry invented set details -> rebuilt from the locked time / lighting
    if (opts.rebuildAtmosphere && (opts.timeOfDay || opts.lighting)) {
      const atm = findSections(prompt).find(s => s.label === 'Atmosphere');
      if (atm) prompt = tidy(`${prompt.slice(0, atm.start)}Atmosphere: ${[opts.timeOfDay, opts.lighting].filter(Boolean).join(', ')}. ${prompt.slice(atm.end)}`);
    }
    out.generatedPrompt = prompt;
    out.locationName = r.name;
    return out as DirectedClipItem;
  });
}
