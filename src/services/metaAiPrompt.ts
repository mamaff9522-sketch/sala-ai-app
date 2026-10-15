/**
 * Copy format for Meta AI (prompts are pasted into Meta AI together with uploaded character photos).
 *
 * The full director prompt carries long library appearance text, internal binding notes and
 * English continuity blocks. Meta AI gets the character look from the uploaded photos, so this
 * format:
 * - replaces the Character Lock with "photo 1 = <name>, photo 2 = <name>" for the characters in the clip
 * - drops internal notes (scene binding line, Continuity Handoff, Stance/Position Lock,
 *   Spatial Positioning Lock, Reference image) and the Negative prompt (Meta AI has no negative field)
 * - drops "Starting moment" / "Ending momentum" when the Core action already contains them
 * - keeps Location, Atmosphere, Core action, Cinematography and the Thai Dialogue verbatim
 * - adds clip length, aspect ratio, "speak Thai exactly as written" and "no on-screen text"
 */
import { findSections, removeSections, insertBlock, tidy } from './promptSections';

interface PoseForMeta {
  name?: string;
  posture?: string;
  place?: string;
  holding?: string;
  gesture?: string;
  facing?: string;
  entering?: boolean;
}

interface ClipForMeta {
  clipNumber?: number;
  title?: string;
  durationSeconds?: number;
  generatedPrompt?: string;
  charactersPresent?: string[];
  dialogues?: { speaker?: string; line?: string }[];
  locationName?: string;
  timeOfDay?: string;
  lighting?: string;
  continuityLock?: { location?: string; timeOfDay?: string; lighting?: string };
  startAction?: string;
  endAction?: string;
  startPoses?: PoseForMeta[];
  endPoses?: PoseForMeta[];
}

export interface MetaAiFormatOptions {
  aspectRatio?: string;
  /** Library character names, used to find who is in the clip when charactersPresent is missing */
  knownCharacters?: string[];
  /**
   * Fixed photo order for the whole story (photo 1 = first name, ...). The same character keeps the
   * same photo number in every clip. Defaults to knownCharacters.
   */
  photoOrder?: string[];
  /** Short identity per character (species / body / key outfit) that must never change */
  characterNotes?: Record<string, string>;
  /** Place and time carried from earlier clips when this clip names none (see sceneOfClip) */
  inheritedPlace?: { location: string; timeOfDay: string };
  /** The clip before this one, with ITS place: same place = continuous (start pose = its end pose) */
  previous?: { clip: ClipForMeta; place: { location: string; timeOfDay: string } };
}

const samePlace = (a: string, b: string) => {
  const n = (x: string) => String(x || '').replace(/\s|ต่อเนื่อง|ที่/g, '').toLowerCase();
  return !!n(a) && !!n(b) && (n(a) === n(b) || n(a).includes(n(b)) || n(b).includes(n(a)));
};

/** Options for clip i of a list: carried place and the previous clip (for the pose hand-off). */
export function metaContextFor(clips: ClipForMeta[], index: number): Pick<MetaAiFormatOptions, 'inheritedPlace' | 'previous'> {
  return {
    inheritedPlace: sceneOfClip(clips, index),
    previous: index > 0 ? { clip: clips[index - 1], place: sceneOfClip(clips, index - 1) } : undefined
  };
}

const BLANK_PLACE = /^(?:|ไม่ระบุ.*|unknown|n\/a|none|-)$/i;
const clean = (v: unknown) => {
  const t = String(v ?? '').trim();
  return BLANK_PLACE.test(t) ? '' : t;
};

/** The clip's own location / time (from the clip, its lock, or a "Location:" section of the prompt). */
export function ownPlace(clip: ClipForMeta): { location: string; timeOfDay: string } {
  let location = clean(clip.locationName) || clean(clip.continuityLock?.location);
  if (!location) {
    const sec = findSections(String(clip.generatedPrompt || '')).find(x => x.label === 'Location' || x.label === 'Location Lock');
    if (sec) location = clean(sectionBody(sec.text, sec.label).split(/[.;]/)[0]);
  }
  const timeOfDay = clean(clip.timeOfDay) || clean(clip.continuityLock?.timeOfDay);
  return { location, timeOfDay };
}

/** Location / time for clip i: its own, else the nearest earlier clip that has one (same set until it changes). */
export function sceneOfClip(clips: ClipForMeta[], index: number): { location: string; timeOfDay: string } {
  let location = '';
  let timeOfDay = '';
  for (let i = index; i >= 0 && (!location || !timeOfDay); i--) {
    const p = ownPlace(clips[i] || {});
    if (!location && p.location) location = p.location;
    if (!timeOfDay && p.timeOfDay) timeOfDay = p.timeOfDay;
  }
  return { location, timeOfDay };
}

const POSTURE_TH: Record<string, string> = { standing: 'ยืน', sitting: 'นั่ง', lying: 'นอน', kneeling: 'คุกเข่า', walking: 'เดิน' };
/** atRest: a hand-off pose, so someone still "walking" is locked as standing (they have arrived). */
function poseText(p: PoseForMeta, atRest = false): string {
  const name = String(p?.name || '').trim();
  if (!name) return '';
  const raw = atRest && p.posture === 'walking' ? 'standing' : String(p.posture || '');
  const posture = POSTURE_TH[raw] || '';
  const bits = [
    posture && !(p.entering && !atRest) ? posture : (p.entering && !atRest ? 'เดินเข้ามาในเฟรม' : ''),
    clean(p.place) ? `ที่${clean(p.place).replace(/^ที่/, '')}` : '',
    clean(p.holding) ? `ถือ${clean(p.holding).replace(/^ถือ/, '')}` : '',
    clean(p.gesture),
    clean(p.facing)
  ].filter(Boolean);
  return bits.length > 0 ? `${name} ${bits.join(' ')}` : '';
}
const posesText = (ps?: PoseForMeta[], atRest = false) => (ps || []).map(p => poseText(p, atRest)).filter(Boolean).join(', ');

const DROP_LABELS = new Set([
  'Reference image',
  'Spatial Positioning Lock',
  'Continuity Handoff',
  'Stance/Position Lock',
  'Negative prompt'
]);

/** Characters in the clip, in a stable order: present list, then speakers, then names in the prompt. */
export function charactersInClip(clip: ClipForMeta, knownCharacters: string[] = []): string[] {
  const out: string[] = [];
  const add = (n?: string) => {
    const name = String(n || '').trim();
    if (name && !out.includes(name)) out.push(name);
  };
  (clip.charactersPresent || []).forEach(add);
  (clip.dialogues || []).forEach(d => add(d?.speaker));
  const prompt = String(clip.generatedPrompt || '');
  const lock = findSections(prompt).find(s => s.label === 'Character Lock');
  knownCharacters.forEach(n => { if (n && (lock ? lock.text.includes(n) : prompt.includes(n))) add(n); });
  return out;
}

/** Photo number per character: fixed story-wide order first, then any extra names after it. */
export function photoNumbers(names: string[], opts: Pick<MetaAiFormatOptions, 'photoOrder' | 'knownCharacters'> = {}): Map<string, number> {
  const order = [...(opts.photoOrder || opts.knownCharacters || [])].map(n => String(n || '').trim()).filter(Boolean);
  for (const n of names) if (!order.includes(n)) order.push(n);
  return new Map(order.map((n, i) => [n, i + 1] as [string, number]));
}

/** Short identity line from a library character: species / body first sentence + outfit, max ~200 chars. */
export function characterNote(c: any): string {
  const first = (v: unknown, max: number) => {
    const t = String(v ?? '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    const cut = t.split(/(?<=[.!?。])\s/)[0];
    return cut.length > max ? `${cut.slice(0, max).replace(/[,\s]+\S*$/, '')}…` : cut.replace(/[.\s]+$/, '');
  };
  const body = first(c?.appearance || c?.visualProfile?.visiblePhysicalAppearance || c?.description, 150);
  const outfit = first(c?.outfit || c?.outfitDescription || c?.costume || c?.visualProfile?.visibleOutfit, 80);
  return [body, outfit ? `ชุด: ${outfit}` : ''].filter(Boolean).join(', ');
}

function sectionBody(text: string, label: string): string {
  return text.slice(label.length + 1).trim().replace(/[.\s]+$/, '');
}

export function formatClipForMetaAi(clip: ClipForMeta, opts: MetaAiFormatOptions = {}): string {
  let prompt = String(clip.generatedPrompt || '');

  // Internal scene-binding note ("ผูกพรอมต์นี้กับฉากที่ N เวลา ... สถานที่ ...") is not for the video model
  prompt = prompt.replace(/ผูกพรอมต์นี้กับฉากที่[^.]*\.\s*/g, '');

  const sections = findSections(prompt);
  const core = sections.find(s => s.label === 'Core action');
  const coreBody = core ? sectionBody(core.text, 'Core action') : '';

  // Character Lock -> uploaded photo mapping, placed where the lock was
  const names = charactersInClip(clip, opts.knownCharacters || []);
  const lockCut = removeSections(prompt, s => s.label === 'Character Lock');
  prompt = lockCut.prompt;
  if (names.length > 0) {
    const order = photoNumbers(names, opts);
    const mapping = names.map(n => `รูปที่ ${order.get(n)} = ${n}`).join(', ');
    const notes = names
      .map(n => (opts.characterNotes?.[n] ? `${n}: ${opts.characterNotes[n]}` : ''))
      .filter(Boolean).join(' | ');
    const block = `ตัวละคร (ใช้รูปที่อัปโหลดเป็นต้นแบบ): ${mapping} — ใบหน้า ทรงผม รูปร่าง และชุดต้องเหมือนในรูปทุกช็อต`
      + (notes ? `. ลักษณะที่ห้ามเปลี่ยน (ห้ามกลายเป็นมนุษย์หรือสิ่งอื่น): ${notes}` : '');
    prompt = lockCut.firstIndex >= 0 ? insertBlock(prompt, lockCut.firstIndex, block) : `${block}. ${prompt}`;
  }

  // Internal continuity blocks and repeats of the core action
  prompt = removeSections(prompt, s => {
    if (DROP_LABELS.has(s.label)) return true;
    if ((s.label === 'Starting moment' || s.label === 'Ending momentum') && coreBody) {
      return coreBody.includes(sectionBody(s.text, s.label));
    }
    return false;
  }).prompt;

  // Never pass "unspecified" placeholders to the video model
  prompt = prompt.replace(/(?:เวลา|สถานที่)\s*ไม่ระบุ[,.]?\s*/g, '');

  // Location Lock: this clip's place, else the one carried from earlier clips of the same scene
  const place = (() => {
    const own = ownPlace(clip);
    return {
      location: own.location || opts.inheritedPlace?.location || '',
      timeOfDay: own.timeOfDay || opts.inheritedPlace?.timeOfDay || ''
    };
  })();
  const lockLines: string[] = [];
  if (place.location || place.timeOfDay) {
    lockLines.push(`ล็อกฉาก: ${[place.location ? `สถานที่ ${place.location}` : '', place.timeOfDay ? `เวลา ${place.timeOfDay}` : ''].filter(Boolean).join(' ')} — ฉาก พื้นหลัง และแสงเหมือนเดิมทุกช็อต ห้ามเปลี่ยนสถานที่`);
  }
  // Start / end lock. Continuous clip (same place as the clip before): it starts EXACTLY on the previous
  // clip's end pose. New place: a new set-up, nothing is carried from the previous clip.
  const prev = opts.previous;
  const continuous = !!prev && (!place.location || !prev.place.location || samePlace(place.location, prev.place.location));
  const carried = continuous && prev ? posesText(prev.clip.endPoses, true) : '';
  const own = (clip.startPoses || []).map(p => poseText(p, !p.entering)).filter(Boolean).join(', ');
  const end = posesText(clip.endPoses, true);
  if (carried) lockLines.push(`ท่าเริ่มคลิป (ต่อเนื่องจากคลิปก่อน ตำแหน่งเดิมเป๊ะ): ${carried}`);
  else if (own) lockLines.push(prev && !continuous ? `เปลี่ยนสถานที่ ท่าเริ่มคลิป: ${own}` : `ท่าเริ่มคลิป: ${own}`);
  if (end || clean(clip.endAction)) {
    lockLines.push(`ท่าจบคลิป (ค้างไว้ส่งต่อคลิปถัดไป): ${end || clean(clip.endAction)}`);
  }

  const hasDialogue = (clip.dialogues || []).some(d => String(d?.line || '').trim());
  const head: string[] = [];
  if (clip.durationSeconds) head.push(`วิดีโอยาว ${clip.durationSeconds} วินาที`);
  if (opts.aspectRatio) head.push(`สัดส่วนภาพ ${opts.aspectRatio}`);
  const tail: string[] = [];
  if (hasDialogue) tail.push('ตัวละครพูดภาษาไทยตามบทพูดด้านบนคำต่อคำ ปากขยับตรงกับเสียง ไม่พูดประโยคอื่นเพิ่ม');
  else tail.push('ไม่มีบทพูดในคลิปนี้ ตัวละครไม่พูด');
  tail.push('ไม่มีตัวหนังสือ ซับไตเติล หรือลายน้ำบนจอ');

  const body = tidy(prompt).replace(/[.\s]+$/, '');
  return tidy([head.join(', '), ...lockLines.slice(0, 1), body, ...lockLines.slice(1), ...tail].filter(Boolean).map(s => s.replace(/[.\s]+$/, '')).join('. ') + '.');
}

export function formatAllClipsForMetaAi(clips: ClipForMeta[], opts: MetaAiFormatOptions = {}): string {
  return clips.map((c, i) => {
    const names = charactersInClip(c, opts.knownCharacters || []);
    const nums = photoNumbers(names, opts);
    const photos = names.length > 0 ? `\n(อัปโหลดรูป: ${names.map(n => `รูปที่ ${nums.get(n)} ${n}`).join('  ')})` : '';
    return `=== คลิป ${c.clipNumber || i + 1}/${clips.length} — ${c.title || ''} ===${photos}\n${formatClipForMetaAi(c, { ...opts, ...metaContextFor(clips, i) })}`;
  }).join('\n\n');
}
