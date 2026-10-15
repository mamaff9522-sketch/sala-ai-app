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

interface ClipForMeta {
  clipNumber?: number;
  title?: string;
  durationSeconds?: number;
  generatedPrompt?: string;
  charactersPresent?: string[];
  dialogues?: { speaker?: string; line?: string }[];
}

export interface MetaAiFormatOptions {
  aspectRatio?: string;
  /** Library character names, used to find who is in the clip when charactersPresent is missing */
  knownCharacters?: string[];
}

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
    const mapping = names.map((n, i) => `รูปที่ ${i + 1} = ${n}`).join(', ');
    const block = `ตัวละคร (ใช้รูปที่อัปโหลดเป็นต้นแบบ): ${mapping} — ใบหน้า ทรงผม และชุดต้องเหมือนในรูปทุกช็อต`;
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

  const hasDialogue = (clip.dialogues || []).some(d => String(d?.line || '').trim());
  const head: string[] = [];
  if (clip.durationSeconds) head.push(`วิดีโอยาว ${clip.durationSeconds} วินาที`);
  if (opts.aspectRatio) head.push(`สัดส่วนภาพ ${opts.aspectRatio}`);
  const tail: string[] = [];
  if (hasDialogue) tail.push('ตัวละครพูดภาษาไทยตามบทพูดด้านบนคำต่อคำ ปากขยับตรงกับเสียง ไม่พูดประโยคอื่นเพิ่ม');
  else tail.push('ไม่มีบทพูดในคลิปนี้ ตัวละครไม่พูด');
  tail.push('ไม่มีตัวหนังสือ ซับไตเติล หรือลายน้ำบนจอ');

  const body = tidy(prompt).replace(/[.\s]+$/, '');
  return tidy([head.join(', '), body, ...tail].filter(Boolean).map(s => s.replace(/[.\s]+$/, '')).join('. ') + '.');
}

export function formatAllClipsForMetaAi(clips: ClipForMeta[], opts: MetaAiFormatOptions = {}): string {
  return clips.map((c, i) => {
    const names = charactersInClip(c, opts.knownCharacters || []);
    const photos = names.length > 0 ? `\n(อัปโหลดรูป: ${names.map((n, j) => `${j + 1}. ${n}`).join('  ')})` : '';
    return `=== คลิป ${c.clipNumber || i + 1}/${clips.length} — ${c.title || ''} ===${photos}\n${formatClipForMetaAi(c, opts)}`;
  }).join('\n\n');
}
