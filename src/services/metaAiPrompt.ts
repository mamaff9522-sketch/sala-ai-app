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
 *
 * VIDEO prompts are short natural Thai (user's format): place + time → characters + action →
 * dialogue → face + emotion → set + light → quality, e.g.
 *   หน้าศาลาวัด ตอนกลางวัน พี่ทุย (รูปที่ 2) กับน้องน้ำยืนคุยกัน พี่ทุยถามว่า "…" น้องน้ำตอบว่า "…"
 *   … สีหน้าชัดเจน ฉากตามรูปที่ 1 … ฉากและแสงคงเดิม cinematic photorealistic, 9:16 …
 * The face / costume / place / dialogue / continuity locks stay, each said once in a few words.
 * No camera is added unless the script gives one. Image prompts keep their detailed format.
 */
import { findSections, removeSections, insertBlock, tidy, dropEmptyCues, ensureDialoguesInPrompt, isEmptyLine } from './promptSections';

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
  /** Multi-Dialogue Clip: what happens and who speaks, in order, with rough times (multiDialogueClips.ts) */
  sequence?: { kind: 'action' | 'line'; text: string; speaker?: string; n?: number; start: number; end: number }[];
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
  /**
   * Characters that have a photo to upload. Others are described by their note only (no "photo N"
   * asked for a photo the user does not have). Default: every character has one.
   */
  withPhoto?: string[];
  /** Place and time carried from earlier clips when this clip names none (see sceneOfClip) */
  inheritedPlace?: { location: string; timeOfDay: string };
  /** The clip before this one, with ITS place: same place = continuous (start pose = its end pose) */
  previous?: { clip: ClipForMeta; place: { location: string; timeOfDay: string } };
  /** This clip's camera (planned over the whole list, see planCameras) */
  camera?: CameraShot;
  /** What each place looks like (from the location library), by place name: written into the location lock */
  locationNotes?: Record<string, string>;
}

export type ShotSize = 'CU' | 'MCU' | 'MS' | 'MLS' | 'FS' | 'WS' | 'EWS';
export type CameraAngle = 'front' | 'front34' | 'side' | 'rear' | 'rear34' | 'high' | 'low' | 'ots' | 'eye';

export interface CameraShot {
  kind: 'script' | 'wide' | 'medium' | 'ots' | 'close' | 'two' | 'insert';
  /** Shot size / angle / who is framed and where they stand on screen (one line, for the video prompt) */
  framing: string;
  /** One camera movement for the whole clip */
  movement: string;
  /** Strict shot size and camera direction (from the script when it gives them, never changed) */
  size: ShotSize;
  angle: CameraAngle;
  /** Main character the size / angle apply to; partner = the shoulder in an over-the-shoulder */
  subject: string;
  partner?: string;
  prop?: string;
  /** What the script itself said about the camera (kept word for word) */
  scriptText?: string;
  /** Left / right / centre of frame per character, kept while the place stays */
  staging: Record<string, string>;
  moving: boolean;
}

/** Thai / English camera words in the script → strict shot size and direction */
export function parseCameraText(text: string, names: string[] = []): { size?: ShotSize; angle?: CameraAngle; subject?: string } {
  const t = String(text || '');
  const out: { size?: ShotSize; angle?: CameraAngle; subject?: string } = {};
  if (/เฉียงหลัง|rear three[- ]?quarter|ด้านหลังเฉียง/i.test(t)) out.angle = 'rear34';
  else if (/เฉียงหน้า|front three[- ]?quarter|three[- ]?quarter/i.test(t)) out.angle = 'front34';
  else if (/ข้ามไหล่|over[- ]the[- ]shoulder|\bOTS\b/i.test(t)) out.angle = 'ots';
  else if (/ด้านหลัง|มุมหลัง|จากข้างหลัง|ข้างหลัง|rear view|from behind|back view/i.test(t)) out.angle = 'rear';
  else if (/ด้านข้าง|มุมข้าง|หันข้าง|side profile|side view|profile/i.test(t)) out.angle = 'side';
  else if (/มุมสูง|กดลง|มองลงมา|high angle|bird/i.test(t)) out.angle = 'high';
  else if (/มุมต่ำ|เงยขึ้น|low angle/i.test(t)) out.angle = 'low';
  else if (/ด้านหน้า|หน้าตรง|มุมหน้า|front view/i.test(t)) out.angle = 'front';
  if (/กว้างมาก|extreme wide|establishing/i.test(t)) out.size = 'EWS';
  else if (/ภาพกว้าง|มุมกว้าง|wide shot|\bwide\b|long shot/i.test(t) && !/medium long/i.test(t)) out.size = 'WS';
  else if (/เต็มตัว|full shot|full body/i.test(t)) out.size = 'FS';
  else if (/ถึงเข่า|ศีรษะถึงเข่า|medium long|สามส่วน/i.test(t)) out.size = 'MLS';
  else if (/ครึ่งตัว|medium shot|\bMS\b/i.test(t)) out.size = 'MS';
  else if (/ระดับอก|ถึงอก|ระดับไหล่|medium close/i.test(t)) out.size = 'MCU';
  else if (/ใกล้หน้า|ภาพใกล้|โคลสอัพ|close-?up|สีหน้า|ใกล้มาก/i.test(t)) out.size = 'CU';
  const named = names.filter(n => n && t.includes(n)).sort((a, b) => t.indexOf(a) - t.indexOf(b));
  if (named.length) out.subject = named[0];
  return out;
}

const SIZE_TEXT: Record<ShotSize, (who: string) => string> = {
  CU: w => `Close-up: เฉพาะใบหน้าและไหล่ของ${w}`,
  MCU: w => `Medium Close-up: ศีรษะถึงช่วงอกของ${w}`,
  MS: w => `Medium Shot: ศีรษะถึงเอวของ${w}เท่านั้น ห้ามเห็นขาหรือรองเท้า ห้ามเป็นภาพเต็มตัว`,
  MLS: w => `Medium Long Shot: ศีรษะถึงเข่าของ${w} ห้ามเห็นเท้า`,
  FS: w => `Full Shot: ${w}ตั้งแต่ศีรษะถึงเท้า`,
  WS: () => 'Wide Shot: เห็นพื้นที่ฉากและตัวละครทุกคนตามบท',
  EWS: () => 'Extreme Wide Shot: เน้นภาพรวมของสถานที่ ตัวละครมีขนาดเล็ก'
};
const ANGLE_TEXT: Record<CameraAngle, (who: string, partner?: string) => string> = {
  front: w => `Front View: มองเห็น${w}จากด้านหน้า`,
  front34: w => `Front Three-Quarter: เห็นใบหน้า${w}จากมุมเฉียง`,
  side: w => `Side Profile: กล้องอยู่ด้านข้าง${w} เห็นใบหน้าและลำตัวด้านข้าง ไม่ใช่หน้าตรง`,
  rear: w => `Rear View: กล้องอยู่ด้านหลัง${w} เห็นแผ่นหลังและด้านหลังศีรษะ ห้ามหันหน้าเข้ากล้อง`,
  rear34: w => `Rear Three-Quarter: เห็นแผ่นหลัง${w}เป็นหลักและด้านข้างบางส่วน ห้ามหันหน้าเข้ากล้อง`,
  high: w => `High Angle: กล้องอยู่สูงกว่า${w}และกดลง`,
  low: w => `Low Angle: กล้องอยู่ต่ำกว่า${w}และเงยขึ้น`,
  ots: (w, p) => `Over-the-Shoulder: มองผ่านไหล่${p || 'ตัวละครอีกคน'}ไปยัง${w} ไหล่และท้ายทอยของ${p || 'ตัวละครอีกคน'}อยู่ฉากหน้า`,
  eye: () => 'Eye Level: กล้องระดับสายตา'
};

export const samePlace = (a: string, b: string) => {
  const n = (x: string) => String(x || '').replace(/\s|ต่อเนื่อง|ที่/g, '').toLowerCase();
  return !!n(a) && !!n(b) && (n(a) === n(b) || n(a).includes(n(b)) || n(b).includes(n(a)));
};

/** Options for clip i of a list: carried place, the previous clip (for the pose hand-off) and its camera. */
export function metaContextFor(clips: ClipForMeta[], index: number): Pick<MetaAiFormatOptions, 'inheritedPlace' | 'previous' | 'camera'> {
  return {
    inheritedPlace: sceneOfClip(clips, index),
    previous: index > 0 ? { clip: clips[index - 1], place: sceneOfClip(clips, index - 1) } : undefined,
    camera: planCameras(clips)[index]
  };
}

// ---------------------------------------------------------------------------------------------
// Camera: every clip used to say only "35mm lens, film still", so Meta AI picked the same angle
// every time. Each clip now gets a shot chosen from what happens in it, never the same shot size
// as the clip before, with each character kept on their side of the frame while the place stays.
// ---------------------------------------------------------------------------------------------

/** "[มุมกล้อง …]" written by the user in the script (see storyNormalize) */
const SCRIPT_CAMERA_RE = /\[มุมกล้อง\s+([^\]]+)\]/;
/** The script already says where the camera looks ("กล้องจับสีหน้าคุณหญิงมณี", "ภาพใกล้จดหมาย") */
const SCRIPT_CAMERA_WORDS_RE = /(?:^|\s)((?:กล้อง|ภาพใกล้|ภาพกว้าง|โคลสอัพ|close-?up|wide shot)[^\s]*(?:\s+(?:ๆ|ค่อย|ช้า|จาก|ไป|มา|ที่)[^\s]*)*)/i;
const PROP_RE = /(แฟ้ม|เอกสาร|จดหมาย|กุญแจ|โทรศัพท์|ซอง|ปากกา|กรอบรูป|รูปถ่าย|ลายเซ็น|กระเป๋า|แหวน|กระดาษ|โฉนด|พินัยกรรม)/;
const MOVING_RE = /(?:เดิน|ก้าว|วิ่ง|เข้ามา|ออกไป|ขับ|walks?|runs?)/;
const camCache = new WeakMap<object, CameraShot[]>();
/** A wide shot of several people: the camera stays, so nobody leaves the frame (a push-in lost them) */
export const WIDE_GROUP_MOVE = 'กล้องนิ่ง ทุกคนอยู่ในเฟรมตลอดคลิป ห้ามดันกล้องเข้าจนมีคนหลุดเฟรม';

const LABEL_CUT_RE = /\s*(?:Continuity Flow|Starting moment|Ending momentum|Dialogue|Continuity Handoff|Stance\/Position Lock|Spatial Position Lock|Location Lock|Lighting Lock)\s*:.*$/;
/**
 * Clip settings the story writer put next to the action ("ระยะเวลา: 10 วินาที | สัดส่วนภาพ: 9:16",
 * "สถานที่: ห้องรับแขก / เวลา: บ่าย", "คลิป 046/225"): not something to act, removed from the action.
 */
export function withoutClipSettings(text: string): string {
  return String(text || '')
    .replace(/คลิป(?:ที่)?\s*\d+(?:\s*\/\s*\d+)?\s*[|:：]?/g, ' ')
    .replace(/(?:ระยะเวลา|ความยาว)\s*[:：]?\s*\d+(?:\.\d+)?\s*วิ(?:นาที)?\.?/g, ' ')
    .replace(/(?:สัดส่วน(?:ภาพ)?|อัตราส่วน(?:ภาพ)?)\s*[:：]?\s*\d+\s*:\s*\d+\.?/g, ' ')
    .replace(/(?:^|\s)\d+(?:\.\d+)?\s*วินาที\s*\|\s*\d+\s*:\s*\d+\.?/g, ' ')
    .replace(/(?:^|\s)(?:สถานที่|ฉาก)\s*[:：][^/.]*\/\s*เวลา\s*[:：]\s*\S+/g, ' ')
    .replace(/(?:^|\s)[|]+(?=\s|$)/g, ' ')
    .replace(/^[\s.|;,]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function clipAction(clip: ClipForMeta): string {
  const prompt = String(clip.generatedPrompt || '');
  const secs = findSections(prompt);
  const parts = ['Core action', 'Scene Action', 'Script action']
    .map(l => secs.find(x => x.label === l))
    .filter(Boolean)
    .map(x => withoutClipSettings(sectionBody(x!.text, x!.label).replace(LABEL_CUT_RE, '')).replace(/[.;\s]+$/, ''))
    .filter(Boolean);
  return parts.join(' ') || withoutClipSettings(clean(clip.startAction));
}

export function planCameras(clips: ClipForMeta[]): CameraShot[] {
  const hit = camCache.get(clips);
  if (hit && hit.length === clips.length) return hit;
  const plan: CameraShot[] = [];
  let sides: string[] = [];
  let screen = new Map<string, string>();
  let prevPlace = '';
  clips.forEach((clip, i) => {
    const place = sceneOfClip(clips, i).location;
    const newPlace = i === 0 || !samePlace(place, prevPlace);
    if (newPlace) { sides = []; screen = new Map(); }
    if (place) prevPlace = place;
    const names = charactersInClip(clip, []);
    names.forEach(n => { if (!sides.includes(n)) sides.push(n); });
    // Each character keeps the side of the frame they were first shown on, while the place stays
    // (180-degree rule: no jumping from left to right between clips)
    const opposite = (x: string) => (x === 'ซ้ายจอ' ? 'ขวาจอ' : 'ซ้ายจอ');
    const sidesText = (who: string[]) => {
      const list = who.filter(Boolean).sort((x, y) => sides.indexOf(x) - sides.indexOf(y)).slice(0, 4);
      if (list.length < 2) return '';
      if (list.length === 2) {
        const [a, b] = list;
        let sa = screen.get(a); let sb = screen.get(b);
        // both already on the same side (three or more people in the room): say nothing rather than move one
        if (sa && sb && sa === sb) return '';
        {
          if (!sa && !sb) { sa = 'ซ้ายจอ'; sb = 'ขวาจอ'; }
          else if (!sa) sa = opposite(sb!);
          else if (!sb) sb = opposite(sa);
          screen.set(a, sa!); screen.set(b, sb!);
        }
        return sa === 'ซ้ายจอ' ? ` (${a}อยู่ซ้ายจอ, ${b}อยู่ขวาจอ)` : ` (${b}อยู่ซ้ายจอ, ${a}อยู่ขวาจอ)`;
      }
      const used = new Set(list.map(n => screen.get(n)).filter(Boolean));
      return ` (${list.map(n => {
        let sd = screen.get(n);
        if (!sd) {
          sd = !used.has('ซ้ายจอ') ? 'ซ้ายจอ' : !used.has('ขวาจอ') ? 'ขวาจอ' : !used.has('กลางจอ') ? 'กลางจอ' : 'กลางจอด้านหลัง';
          used.add(sd);
          if (!sd.startsWith('กลางจอ')) screen.set(n, sd);
        }
        return `${n}อยู่${sd}`;
      }).join(', ')})`;
    };
    const action = clipAction(clip);
    const lines = (clip.dialogues || []).filter(d => String(d?.line || '').trim() && !isEmptyLine(d?.line));
    const speaker = String(lines[0]?.speaker || '').trim();
    const subject = [...names].sort((a, b) => {
      const ia = action.indexOf(a); const ib = action.indexOf(b);
      return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
    })[0] || speaker || '';
    const prev = plan[i - 1];
    const moving = MOVING_RE.test(action);
    const emotional = lines.some(d => /[!！]/.test(String(d.line)));
    const shot = (kind: CameraShot['kind'], framing: string, movement: string): CameraShot =>
      ({ kind, framing, movement, size: 'MS', angle: 'front34', subject: '', staging: {}, moving: false });
    const scriptCam = String(clip.generatedPrompt || '').match(SCRIPT_CAMERA_RE)?.[1]?.trim()
      || action.match(SCRIPT_CAMERA_WORDS_RE)?.[1]?.trim();
    let cam: CameraShot;
    if (scriptCam) {
      cam = shot('script', `ตามบท: ${scriptCam}`, /ดัน|ถอย|เลื่อน|แพน|ตาม|ซูม|push|pull|pan|dolly/i.test(scriptCam) ? '' : 'กล้องนิ่ง');
    } else if (newPlace) {
      cam = names.length >= 2
        ? shot('wide', `ภาพกว้าง เห็นทั้ง${place || 'สถานที่'}และทุกคนในฉาก${sidesText(names)}`, WIDE_GROUP_MOVE)
        : names.length === 0
          // nobody in the shot: an establishing view of the place itself
          ? shot('wide', `ภาพกว้าง เห็นทั้ง${place || 'สถานที่'}`, 'กล้องค่อยๆ เลื่อนเข้าช้าๆ')
          : shot('medium', `ภาพครึ่งตัว ${subject} เห็นพื้นหลังของ${place || 'สถานที่'}`, 'กล้องค่อยๆ เลื่อนเข้าช้าๆ');
    } else if (lines.length === 0) {
      const prop = action.match(PROP_RE)?.[1];
      if (prop && prev?.kind !== 'insert') {
        cam = shot('insert', `ภาพใกล้${prop}${subject ? `ในมือ${subject}` : ''} แล้วเห็นสีหน้า${subject || 'ตัวละคร'}`, 'กล้องนิ่ง');
      } else if (prev?.kind !== 'close' && subject && !moving) {
        cam = shot('close', `ภาพใกล้หน้า ${subject} เห็นอารมณ์ชัด`, 'กล้องค่อยๆ ดันเข้าช้าๆ');
      } else {
        cam = shot('medium', `ภาพครึ่งตัว ${subject || names[0] || ''}`.trim(), moving ? 'กล้องเลื่อนตามช้าๆ' : 'กล้องนิ่ง');
      }
    } else {
      const listeners = names.filter(n => n !== speaker);
      const listener = listeners.find(n => action.includes(n)) || (prev && plan.length ? listeners.find(n => String(clips[i - 1].dialogues?.[0]?.speaker || '') === n) : '') || listeners[0] || '';
      const options: CameraShot[] = listener
        ? [
            shot('ots', `ภาพใกล้ระดับไหล่ ถ่ายข้ามไหล่${listener}ไปที่${speaker}${sidesText([listener, speaker])}`, 'กล้องนิ่ง'),
            shot('close', `ภาพใกล้หน้า ${speaker} ขณะพูด`, emotional ? 'กล้องค่อยๆ ดันเข้าช้าๆ' : 'กล้องนิ่ง'),
            shot('two', `ภาพสองคน ${speaker} และ ${listener} อยู่ในเฟรม${sidesText([speaker, listener])}`, 'กล้องนิ่ง')
          ]
        : [
            shot('medium', `ภาพครึ่งตัว ${speaker}`, 'กล้องนิ่ง'),
            shot('close', `ภาพใกล้หน้า ${speaker} ขณะพูด`, emotional ? 'กล้องค่อยๆ ดันเข้าช้าๆ' : 'กล้องนิ่ง')
          ];
      if (emotional && listener) options.unshift(options.splice(1, 1)[0]);
      // two (or more) people talking in one clip: frame them together
      const talkers = Array.from(new Set(lines.map(d => String(d.speaker || '').trim()).filter(Boolean)));
      if (talkers.length > 1) {
        options.unshift(shot('two', `ภาพสองคน ${talkers[0]} และ ${talkers[1]} อยู่ในเฟรม ขณะคุยกัน${sidesText(talkers.slice(0, 2))}`, 'กล้องนิ่ง'));
        options.splice(1, 0, shot('ots', `ภาพใกล้ระดับไหล่ ถ่ายข้ามไหล่${talkers[1]}ไปที่${talkers[0]}${sidesText([talkers[1], talkers[0]])}`, 'กล้องนิ่ง'));
      }
      if (moving) options.unshift(shot('medium', `ภาพครึ่งตัว ${subject || speaker} ขณะเคลื่อนที่`, 'กล้องเลื่อนตามช้าๆ'));
      // someone walking cannot be shown in a face close-up
      const fit = moving ? options.filter(o => o.kind !== 'close') : options;
      cam = fit.find(o => o.kind !== prev?.kind) || fit[0];
      if (cam.kind === 'ots' || cam.kind === 'two') {
        const talkers = Array.from(new Set(lines.map(d => String(d.speaker || '').trim()).filter(Boolean)));
        cam.partner = talkers.length > 1 ? talkers[1] : listener;
      }
      if (cam.kind !== 'medium' || !moving) cam.subject = speaker;
    }
    // Crying / tears: Meta refuses heavy crying in close-ups with real faces -> medium shot
    if (cam.kind === 'close' && /ร้องไห้|น้ำตา|สะอื้น/.test(action)) {
      const alt = [shot('medium', `ภาพครึ่งตัว ${subject || speaker}`, 'กล้องนิ่ง'), shot('two', `ภาพสองคน ${names.slice(0, 2).join(' และ ')} อยู่ในเฟรม${sidesText(names.slice(0, 2))}`, 'กล้องนิ่ง'), shot('wide', `ภาพกว้าง เห็น${subject || speaker || 'ตัวละคร'}ใน${place || 'ฉาก'}${sidesText(names)}`, 'กล้องนิ่ง')]
        .filter(o => o.kind !== 'two' || names.length > 1);
      cam = alt.find(o => o.kind !== prev?.kind) || alt[0];
    }
    // Walking again in the same shot size as the clip before: follow the walk in a wide shot instead
    if (moving && cam.kind !== 'script' && cam.kind === prev?.kind) {
      cam = shot('wide', `ภาพกว้าง เห็น${subject || speaker || 'ตัวละคร'}เคลื่อนที่ใน${place || 'ฉาก'}${sidesText(names)}`, 'กล้องเลื่อนตามช้าๆ');
    }
    // Strict size / direction: the script's words win and are never changed; the rest from the shot kind
    const fromScript = scriptCam ? parseCameraText(scriptCam, names) : {};
    const AUTO: Record<CameraShot['kind'], { size: ShotSize; angle: CameraAngle }> = {
      wide: { size: 'WS', angle: 'eye' }, medium: { size: 'MS', angle: 'front34' }, close: { size: 'CU', angle: 'front34' },
      ots: { size: 'MCU', angle: 'ots' }, two: { size: 'MS', angle: 'front' }, insert: { size: 'CU', angle: 'high' },
      script: { size: 'MS', angle: 'front34' }
    };
    const auto = AUTO[cam.kind];
    cam.size = fromScript.size || auto.size;
    cam.angle = fromScript.angle || (fromScript.size === 'WS' || fromScript.size === 'EWS' ? 'eye' : auto.angle);
    cam.subject = fromScript.subject || cam.subject || subject || speaker || names[0] || '';
    if (cam.angle === 'ots' && !cam.partner) cam.partner = names.find(n => n !== cam.subject) || '';
    if (cam.kind === 'insert') cam.prop = action.match(PROP_RE)?.[1];
    if (scriptCam) cam.scriptText = scriptCam;
    cam.moving = moving;
    // Every character in the shot gets a side of the frame, remembered while the place stays
    const taken = new Set(names.map(n => screen.get(n)).filter(Boolean));
    cam.staging = {};
    for (const n of names) {
      let sd = screen.get(n);
      if (!sd) {
        sd = !taken.has('ซ้ายจอ') ? 'ซ้ายจอ' : !taken.has('ขวาจอ') ? 'ขวาจอ' : !taken.has('กลางจอ') ? 'กลางจอ' : 'กลางจอด้านหลัง';
        taken.add(sd);
        if (!sd.startsWith('กลางจอ')) screen.set(n, sd);
      }
      cam.staging[n] = sd;
    }
    plan.push(cam);
  });
  camCache.set(clips, plan);
  return plan;
}

/** "มุมกล้อง: …" line for a prompt (video: with the movement; image: framing only). */
export function cameraLine(cam: CameraShot | undefined, kind: 'video' | 'image', aspectRatio?: string): string {
  if (!cam) return '';
  const fromBehind = cam.angle === 'rear' || cam.angle === 'rear34';
  const vertical = aspectRatio === '9:16' ? (fromBehind ? 'จัดภาพแนวตั้ง' : 'จัดภาพแนวตั้ง ใบหน้าตัวละครอยู่ช่วงบนของจอ') : '';
  // the still is the clip's first frame: nobody is talking yet
  const framing = kind === 'image' ? cam.framing.replace(/\s*ขณะ(?:พูด|เคลื่อนที่)/g, '') : cam.framing;
  const bits = [framing, kind === 'video' ? cam.movement : '', vertical].filter(Boolean);
  return `มุมกล้อง: ${bits.join(', ')}`;
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
  // When the clip lists who is present, a name only counts if the action itself names them
  // (the app's Character Lock text may list the whole cast, e.g. แพรวา who is not in this scene)
  const where = (clip.charactersPresent || []).length ? clipAction(clip) : (lock ? lock.text : prompt);
  knownCharacters.forEach(n => {
    if (!n) return;
    // "กฤต" inside "ทนายกฤต" is the same person, not a second character
    const longer = [...knownCharacters, ...out].filter(m => m && m !== n && m.includes(n));
    const text = longer.reduce((t, m) => t.split(m).join(' '), where);
    if (text.includes(n)) add(n);
  });
  // Same person under a short and a long name ("กฤต" / "ทนายกฤต"): keep the long name once
  const all = [...knownCharacters, ...out].filter(Boolean);
  const full = (n: string) => all.find(m => m !== n && m.length > n.length && m.endsWith(n)) || n;
  return Array.from(new Set(out.map(full)));
}

/** The clip's characters that have a photo to upload (all of them when withPhoto is not given). */
function withPhotoIn(names: string[], opts: Pick<MetaAiFormatOptions, 'withPhoto'>): string[] {
  if (!Array.isArray(opts.withPhoto)) return names;
  const set = new Set(opts.withPhoto.map(n => String(n || '').trim()));
  return names.filter(n => set.has(n));
}

/** Photo number per character: fixed story-wide order first, then any extra names after it. */
export function photoNumbers(names: string[], opts: Pick<MetaAiFormatOptions, 'photoOrder' | 'knownCharacters'> = {}): Map<string, number> {
  const order = [...(opts.photoOrder || opts.knownCharacters || [])].map(n => String(n || '').trim()).filter(Boolean);
  for (const n of names) if (!order.includes(n)) order.push(n);
  return new Map(order.map((n, i) => [n, i + 1] as [string, number]));
}

/** Short identity line from a library character: species / body first sentence + outfit, max ~200 chars. */
export function characterNote(c: any): string {
  // Whole parts only ("ผิว/เกล็ด: …", "รูปหน้า: …"): Thai has no spaces between words, so cutting
  // at a character count broke words ("รูปหน้า:…"). Parts that say nothing ("ไม่เห็นในภาพ") are dropped.
  const first = (v: unknown, max: number) => {
    const t = String(v ?? '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    const sentence = t.split(/(?<=[.!?。])\s/)[0].replace(/[.\s]+$/, '');
    const parts: string[] = [];
    let depth = 0; let cur = '';
    for (const ch of sentence) {
      if (ch === '(') depth++;
      if (ch === ')') depth = Math.max(0, depth - 1);
      if (depth === 0 && /[,•|;]/.test(ch)) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur);
    const useful = parts.map(x => x.trim()).filter(x => x && !/[:：]\s*$/.test(x) && !/ไม่เห็น|ไม่ระบุ|ไม่ทราบ|not visible|unknown/i.test(x));
    const kept: string[] = [];
    for (const x of useful) {
      if (kept.length > 0 && kept.join(', ').length + x.length + 2 > max) break;
      kept.push(x);
    }
    return kept.join(', ');
  };
  const body = first(c?.appearance || c?.visualProfile?.visiblePhysicalAppearance || c?.description, 220);
  const outfit = first(c?.outfit || c?.outfitDescription || c?.costume || c?.visualProfile?.visibleOutfit, 120);
  return [body, outfit ? `ชุด: ${outfit}` : ''].filter(Boolean).join(', ');
}

function sectionBody(text: string, label: string): string {
  return text.slice(label.length + 1).trim().replace(/[.\s]+$/, '');
}

// ---------------------------------------------------------------------------------------------
// Prompt composer (image + video prompts sent to Meta AI)
//
// One set of facts per clip (clipFacts), each fact written ONCE, in Thai; English only for camera
// terms (Close-up, Medium Shot, Low Angle…), never the same instruction in both languages.
// The shared locks (characters, costumes, places, light) live at story level
// (metaOptionsForStory → buildSharedLocks); every clip prompt refers to the same values in short
// form, and carries what Meta AI needs because each clip is generated on its own.
// Every prompt goes through checkPromptProblems (repeats, contradictions, mixed language,
// camera vs shot size, action vs framing) in the tests.
// ---------------------------------------------------------------------------------------------

const LIGHT_TH = {
  night: 'แสงกลางคืนโทนต่ำ ไฟในห้องโทนอุ่น แสงจันทร์นุ่ม',
  evening: 'แสงแดดเย็นสีทองจากมุมต่ำ เงายาวนุ่ม',
  morning: 'แสงเช้านุ่มโทนเย็น หมอกบาง',
  day: 'แสงธรรมชาติกลางวันสว่าง เงานุ่ม',
  plain: 'แสงธรรมชาติ'
};

/** The lighting lock in Thai (the app's own English phrases translated; a light the user wrote is kept). */
export function thaiLighting(raw: string, timeOfDay = ''): string {
  const t = String(raw || '')
    .replace(/\s*\(identical set[^)]*\)?/i, '')
    .replace(/,?\s*(?:consistent|matched) across clips/gi, '')
    .trim();
  const byTime = (): string => {
    const tt = String(timeOfDay || '');
    if (/(กลางคืน|ดึก|ค่ำ|night)/i.test(tt)) return LIGHT_TH.night;
    if (/(เย็น|พลบ|dusk|evening)/i.test(tt)) return LIGHT_TH.evening;
    if (/(เช้า|รุ่ง|morning|dawn)/i.test(tt)) return LIGHT_TH.morning;
    if (/(กลางวัน|เที่ยง|บ่าย|สาย|day|noon)/i.test(tt)) return LIGHT_TH.day;
    return '';
  };
  if (/[ก-๙]/.test(t)) return t;
  if (!t || /^natural consistent lighting/i.test(t)) return byTime() || (t ? LIGHT_TH.plain : '');
  if (/low-key night|moonlight|night lighting/i.test(t)) return LIGHT_TH.night;
  if (/golden-hour|evening sunlight|sunset/i.test(t)) return LIGHT_TH.evening;
  if (/morning daylight|morning/i.test(t)) return LIGHT_TH.morning;
  if (/bright natural daylight|daylight/i.test(t)) return LIGHT_TH.day;
  return t; // a lighting the user wrote in English: kept word for word
}

interface ClipLine { speaker: string; line: string; emotion: string }
interface ClipFacts {
  place: { location: string; timeOfDay: string };
  lighting: string;
  names: string[];
  photoNames: string[];
  photoNo: Map<string, number>;
  noPhoto: string[];
  notes: Record<string, string>;
  animal: boolean;
  continuous: boolean;
  hasPrevious: boolean;
  carried: string;
  ownStart: string;
  startPoses: PoseForMeta[];
  end: string;
  /** The script's own start / end moment of the clip, when the action does not already say it */
  startMoment: string;
  endMoment: string;
  action: string;
  extra: string;
  lines: ClipLine[];
  speakers: string[];
  cam?: CameraShot;
}

const thaiShare = (t: string) => {
  const th = (t.match(/[ก-๙]/g) || []).length;
  const en = (t.match(/[A-Za-z]/g) || []).length;
  return th + en === 0 ? 0 : th / (th + en);
};

/** Everything both prompts need about one clip, read once. */
function clipFacts(clip: ClipForMeta, opts: MetaAiFormatOptions): ClipFacts {
  const prompt = String(clip.generatedPrompt || '').replace(/ผูกพรอมต์นี้กับฉากที่[^.]*\.\s*/g, '');
  const own = ownPlace(clip);
  const place = {
    location: own.location || opts.inheritedPlace?.location || '',
    timeOfDay: own.timeOfDay || opts.inheritedPlace?.timeOfDay || ''
  };
  const prev = opts.previous;
  const continuous = !!prev && (!place.location || !prev.place.location || samePlace(place.location, prev.place.location));
  const lightRaw = prompt.match(/Lighting Lock:\s*([^.]*)/)?.[1] || clean(clip.lighting) || clean(clip.continuityLock?.lighting);
  const names = charactersInClip(clip, opts.knownCharacters || []);
  const photoNo = photoNumbers(withPhotoIn(names, opts), opts);
  const photoNames = withPhotoIn(names, opts).sort((a, b) => (photoNo.get(a) || 0) - (photoNo.get(b) || 0));
  const notes: Record<string, string> = {};
  for (const n of names) if (opts.characterNotes?.[n]) notes[n] = opts.characterNotes[n].replace(/[.\s]+$/, '');
  const cam = opts.camera;
  // The script's own action lines; a camera phrase already used as the camera line is not repeated
  const userCamera = SCRIPT_CAMERA_RE.test(prompt);
  let action = clipAction(clip).replace(/\s*\[มุมกล้อง\s+[^\]]+\]\s*/g, ' ');
  if (userCamera) action = action.replace(new RegExp(SCRIPT_CAMERA_WORDS_RE.source, 'gi'), ' ');
  else if (cam?.scriptText) action = action.split(cam.scriptText).join(' ');
  action = action.replace(/\s+/g, ' ').trim();
  // Free description before the first labelled section: kept only when it is the writer's Thai text
  // (the app's own "Cinematic 8K masterpiece, A and B at …" line only repeats the place and cast)
  const first = findSections(prompt)[0];
  const lead = (first ? prompt.slice(0, first.start) : '').replace(/\s*\[มุมกล้อง\s+[^\]]+\]\s*/g, ' ').trim().replace(/[.\s]+$/, '');
  const extra = lead && !/^Cinematic 8K/i.test(lead) && thaiShare(lead) >= 0.6 ? lead : '';
  // Dialogue exactly as written (from the clip; from the prompt text for older clips)
  let lines: ClipLine[] = (clip.dialogues || [])
    .map((d: any) => ({ speaker: String(d?.speaker || '').trim(), line: String(d?.line ?? d?.dialogue ?? '').trim(), emotion: String(d?.emotion || d?.emotionOrAction || '').trim() }))
    .filter(d => d.line && !isEmptyLine(d.line));
  if (lines.length === 0) {
    const sec = findSections(prompt).find(x => x.label === 'Dialogue');
    if (sec) {
      for (const m of sec.text.matchAll(/(?:\[([^\]]+)\]|([^\s;:"“”]+)(?:\s+(?:speaks|says))?)\s*[:：]\s*["“]([^"”]+)["”]/g)) {
        const line = m[3].trim();
        if (line && !isEmptyLine(line)) lines.push({ speaker: (m[1] || m[2] || '').trim(), line, emotion: '' });
      }
    }
  }
  const speakers = Array.from(new Set(lines.map(d => d.speaker).filter(Boolean)));
  const startPoses: PoseForMeta[] = (continuous && prev?.clip.endPoses?.length ? prev.clip.endPoses : clip.startPoses) || [];
  const squash = (t: string) => String(t || '').replace(/กำลัง/g, '').replace(/[\s"'“”‘’.,!?…:;()\[\]\-–—~]/g, '');
  const moment = (label: string) => {
    const sec = findSections(prompt).find(x => x.label === label);
    const b = sec ? sectionBody(sec.text, label).replace(LABEL_CUT_RE, '').replace(/[.;\s]+$/, '') : '';
    return b && !squash(action).includes(squash(b)) && !/^ต่อจากคลิปก่อน/.test(b) ? b : '';
  };
  return {
    place,
    lighting: thaiLighting(lightRaw, place.timeOfDay),
    names,
    photoNames,
    photoNo,
    noPhoto: names.filter(n => !photoNames.includes(n)),
    notes,
    animal: /anthropomorphic|animal|reptile|gecko|lizard|buffalo|creature|สัตว์|เกล็ด|ตุ๊กแก|ตัวเหี้ย|กิ้งก่า|ควาย/i.test(Object.values(notes).join(' ')),
    continuous,
    hasPrevious: !!prev,
    carried: continuous && prev ? posesText(prev.clip.endPoses, true) : '',
    ownStart: (clip.startPoses || []).map(p => poseText(p, !p.entering)).filter(Boolean).join(', '),
    startPoses,
    end: posesText(clip.endPoses, true) || clean(clip.endAction),
    startMoment: moment('Starting moment'),
    endMoment: moment('Ending momentum'),
    action,
    extra,
    lines,
    speakers,
    cam
  };
}

/** "สถานที่ ห้องโถง เวลา กลางวัน แสง…" — the place / time / light lock, once. */
function placeText(f: ClipFacts, withWord = true): string {
  return [f.place.location ? `${withWord ? 'สถานที่ ' : ''}${f.place.location}` : '', f.place.timeOfDay ? `เวลา ${f.place.timeOfDay}` : '', f.lighting].filter(Boolean).join(' ');
}

/** Characters with their photo number and identity / costume note (the Character + Costume lock). */
function castText(f: ClipFacts, withNotes: 'all' | 'no-photo'): string {
  const note = (n: string) => (f.notes[n] && (withNotes === 'all' || !f.photoNames.includes(n)) ? ` (${f.notes[n]})` : '');
  return [
    ...f.photoNames.map(n => `รูปที่ ${f.photoNo.get(n)} = ${n}${note(n)}`),
    ...f.noPhoto.map(n => `${n}${note(n)}`)
  ].join(', ');
}

/** Drops a sentence that says what an earlier sentence already said (same words, any order of parts). */
function withoutRepeats(parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts.filter(Boolean)) {
    const kept = part.split(/(?<=[.])\s+/).filter(seg => {
      const k = seg.replace(/[\s.,;:()"“”—–-]/g, '');
      if (k.length > 8 && seen.has(k)) return false;
      seen.add(k);
      return true;
    }).join(' ');
    if (kept.trim()) out.push(kept.trim().replace(/[.\s]+$/, ''));
  }
  return tidy(out.join('. ') + '.');
}

/**
 * "คุณหญิงมณีถือแฟ้ม" at the end while nothing before shows the folder: one line saying how it comes
 * into the hand, so it does not pop up out of nowhere.
 */
function propBridge(f: ClipFacts, sequenceText = ''): string {
  const endText = [f.end, f.endMoment].join(' ');
  const prop = endText.match(PROP_RE)?.[1];
  if (!prop) return '';
  const before = [f.action, sequenceText, f.extra, f.carried, f.ownStart, f.startMoment].join(' ');
  if (before.includes(prop)) return '';
  // who holds it: the end-pose part that names the prop ("พี่ทุย นั่ง … ถือโทรศัพท์"), not the first name
  const part = endText.split(/,\s*|;\s*/).find(x => x.includes(prop)) || endText;
  const holder = [...f.names].sort((a, b) => part.indexOf(a) - part.indexOf(b)).find(n => part.includes(n) && part.indexOf(n) === part.search(new RegExp(f.names.join('|')))) || '';
  return `${holder || 'ตัวละคร'}หยิบ${prop}มาถือให้เห็นตั้งแต่ต้นคลิป ไม่ใช่โผล่ขึ้นมาเอง`;
}

/** The video's sound: the characters' scripted voices only (user rule). */
export const VIDEO_SOUND_DIALOGUE = 'มีแค่เสียงพูดตามบท ไม่มีดนตรีหรือเสียงประกอบ';
export const VIDEO_SOUND_SILENT = 'เงียบทั้งคลิป ไม่มีเสียงพูด ดนตรี หรือเสียงประกอบ';
/** "เสียงจิ้งหรีดดังรอบตัว", "เสียงฟ้าร้อง", "เพลงคลอเบา ๆ": a clause that asks for background sound */
const BACKGROUND_SOUND_RE = /^(?:เสียง(?!พูด|ตัวละคร)\S*|เพลง\S*|ดนตรี\S*|ซาวด์\S*)$/;
export function withoutBackgroundSound(action: string): string {
  const out: string[] = [];
  let dropped = false;
  for (const seg of String(action || '').split(/\s+/).filter(Boolean)) {
    if (BACKGROUND_SOUND_RE.test(seg)) { dropped = true; continue; }
    if (dropped && seg === 'ๆ') continue; // the "ๆ" of the clause just left out
    dropped = false;
    out.push(seg);
  }
  return out.join(' ').trim();
}

/**
 * The pieces of one clip's video prompt, by role, in the order the user asked for:
 * place + time → characters + action → dialogue → face + emotion → set + light → picture quality.
 * Short natural Thai sentences, each fact once. The locks stay, in short form:
 * face / costume = the character's reference photo number (or their look note when there is no photo),
 * place = the master image, dialogue = word for word, continuity = the previous clip's last frame
 * attached first and played on from. No camera is invented: only the camera the script itself gives.
 */
interface VideoPart { key: 'place' | 'start' | 'action' | 'lock' | 'emotion' | 'ending' | 'scene' | 'camera' | 'safety' | 'quality'; text: string }

const QUESTION_RE = /(?:[?？]|ไหม|มั้ย|หรอ|เหรอ|หรือเปล่า|หรือยัง|อะไร|ทำไม|ยังไง|อย่างไร|ที่ไหน|เมื่อไร|เมื่อไหร่|ใคร|กี่\S*)\s*(?:คะ|ครับ|จ๊ะ|จ้ะ|นะ|ล่ะ)?[!！.…]*$/;

/** `พี่ทุยถามว่า "…"` / `น้องน้ำตอบว่า "…"`: the lines exactly as written, in order. */
function spokenText(lines: ClipLine[], names: string[] = []): string {
  // "เธอขอพรว่าอะไรหรอน้องน้ำ": the name at the end is who is asked, not part of the question
  const isQuestion = (line: string) => {
    let t = String(line || '').trim();
    for (const n of [...names].sort((a, b) => b.length - a.length)) if (n && t.endsWith(n)) t = t.slice(0, -n.length).trim();
    return QUESTION_RE.test(t);
  };
  return lines.map((d, k) => {
    const who = d.speaker || 'ตัวละคร';
    const prev = lines[k - 1];
    const verb = isQuestion(d.line) ? 'ถามว่า'
      : prev && prev.speaker !== d.speaker && isQuestion(prev.line) ? 'ตอบว่า'
      : prev && prev.speaker === d.speaker ? 'พูดต่อว่า' : 'พูดว่า';
    return `${who}${verb} "${d.line}"`;
  }).join(' ');
}

/**
 * Who is who, before the action: "พี่ทุย (รูปที่ 2) และน้องน้ำ (look) อยู่ในฉาก". The script's own
 * action and dialogue follow word for word (a tag inside the writer's sentence broke it apart).
 */
function withCastTags(text: string, f: ClipFacts, faces: { n: number; name: string }[]): string {
  const tag = (n: string) => {
    const photo = faces.find(x => x.name === n);
    return photo ? `รูปที่ ${photo.n}` : shortLook(f.notes[n]);
  };
  const body = String(text || '').replace(/[ \t]{2,}/g, ' ').trim();
  const outside = body.replace(/"[^"]*"/g, ' ');
  const listed = f.names.filter(n => tag(n) || !outside.includes(n)).map(n => (tag(n) ? `${n} (${tag(n)})` : n));
  const who = listed.length > 1 ? `${listed.slice(0, -1).join(', ')} และ${listed[listed.length - 1]}` : listed[0] || '';
  return [who ? `${who} อยู่ในฉาก` : '', body].filter(Boolean).join(' ');
}

/** "ประเภท: reptile (กิ้งก่า), ผิว/เกล็ด: เกล็ดเขียว, ชุด: …" -> "reptile (กิ้งก่า), เกล็ดเขียว, …" */
export function shortLook(note?: string): string {
  return String(note || '').replace(/(^|,\s*)[^,:：()]{1,20}[:：]\s*/g, '$1').replace(/\s+/g, ' ').trim();
}

/** End poses in a few words: "พี่ทุยและน้องน้ำยืนที่หน้าศาล" (same pose said once for everyone). */
function endingText(poses: PoseForMeta[] | undefined, fallback: string): string {
  const groups: { names: string[]; how: string }[] = [];
  for (const p of poses || []) {
    const name = String(p?.name || '').trim();
    if (!name) continue;
    const raw = p.posture === 'walking' ? 'standing' : String(p.posture || '');
    const how = [POSTURE_TH[raw] || '', clean(p.place) ? `ที่${clean(p.place).replace(/^ที่/, '')}` : '',
      clean(p.holding) ? `ถือ${clean(p.holding).replace(/^ถือ/, '')}` : '', clean(p.gesture), clean(p.facing)]
      .filter(Boolean).filter(x => !/เพิ่งพูดจบ|หยุดพูด/.test(x)).join('');
    if (!how) continue;
    const g = groups.find(x => x.how === how);
    if (g) { if (!g.names.includes(name)) g.names.push(name); } else groups.push({ names: [name], how });
  }
  const text = groups.map(g => `${g.names.length > 1 ? `${g.names.slice(0, -1).join(', ')}และ${g.names[g.names.length - 1]}` : g.names[0]}${g.how}`).join(', ');
  // "คุณหญิงมณี เพิ่งพูดจบ หยุดพูดแล้ว" says nothing the dialogue does not
  return text || (/เพิ่งพูดจบ|หยุดพูด/.test(fallback) ? '' : fallback);
}

const sentence = (t: string) => String(t || '').replace(/\s+/g, ' ').replace(/[.;\s]+$/, '').trim();

function videoPromptParts(clip: ClipForMeta, opts: MetaAiFormatOptions): VideoPart[] {
  const f = clipFacts(clip, opts);
  const cam = f.cam;
  const parts: VideoPart[] = [];
  const add = (key: VideoPart['key'], text: string) => { const t = sentence(text); if (t) parts.push({ key, text: t }); };
  const att = attachmentsFor(clip, opts, f);
  const masterNo = att.list.find(x => x.kind === 'master')?.n;
  // 1. place and time
  const when = f.place.timeOfDay ? (/^ตอน/.test(f.place.timeOfDay) ? f.place.timeOfDay : `ตอน${f.place.timeOfDay}`) : '';
  const where = [f.place.location, when].filter(Boolean).join(' ');
  add('place', where && f.hasPrevious && !f.continuous ? `เปลี่ยนฉากมาที่${where}` : where);
  // continuity: the previous clip's last frame (attached first) is where this clip starts
  if (f.continuous && f.hasPrevious && att.lastFrameOf) {
    add('start', `ต่อจากเฟรมสุดท้ายของคลิป ${att.lastFrameOf} (รูปที่ ${att.frameNo}) ทันที ท่าและตำแหน่งเดิม ไม่ตัดภาพ ไม่เล่นซ้ำ`);
  } else if (f.carried) {
    add('start', `เริ่มจากท่าเดิมของคลิปก่อน: ${f.carried}`);
  } else if (f.startMoment) {
    add('start', `เริ่มคลิป: ${f.startMoment}`);
  }
  // 2 + 3. characters, what they do and what they say (dialogue word for word, in order)
  const moves = withoutBackgroundSound(f.action);
  const seq = (clip.sequence || []).filter(st => st.kind === 'line' || withoutBackgroundSound(st.text));
  const multi = seq.length > 1 && f.lines.length > 0;
  let body: string;
  if (multi) {
    // who speaks when: a short time mark before each line (Multi-Dialogue Clip)
    const sec = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
    body = seq.map(st => (st.kind === 'line'
      ? (() => { const d = f.lines[(st.n || 1) - 1]; return d ? `(${sec(st.start)}–${sec(st.end)} วิ) ${spokenText([d], f.names)}` : ''; })()
      : sentence(withoutBackgroundSound(st.text)))).filter(Boolean).join(' ');
    // a line the sequence did not place is still said, after the rest
    const said = f.lines.filter(d => !body.includes(`"${d.line}"`));
    if (said.length) body = `${body} ${spokenText(said, f.names)}`;
  } else {
    const start = !moves && !f.carried && !att.lastFrameOf ? f.ownStart : '';
    body = [sentence(start), sentence(moves), f.lines.length ? spokenText(f.lines, f.names) : ''].filter(Boolean).join(' ');
  }
  const extra = withoutBackgroundSound(f.extra);
  if (extra) body = `${body} ${sentence(extra)}`;
  if (f.names.length) body = withCastTags(body, f, att.faces);
  add('action', body);
  const bridge = propBridge(f, seq.map(st => st.text).join(' '));
  if (bridge) add('action', bridge);
  // the locks, once: dialogue exactly as written, faces / costumes from the photos, nobody doubled
  const speech = f.lines.length
    ? `พูดภาษาไทยตรงตามบททุกคำ${f.speakers.length > 1 ? ' พูดทีละคนตามลำดับ' : f.names.length > 1 ? ' คนอื่นไม่พูด' : ''}`
    : 'ไม่มีบทพูดในคลิปนี้';
  const looks = f.names.length
    ? `หน้าตาและชุดคงเดิม${att.faces.length ? 'ตามรูป' : ''}${f.animal ? ' ไม่กลายเป็นมนุษย์' : ''} ไม่มีตัวละครซ้ำ`
    : '';
  add('lock', [speech, looks].filter(Boolean).join(' '));
  // 4. face and feeling (the script's own emotion; a safe way to show it)
  const felt = f.lines.filter(d => d.emotion).map(d => `${d.speaker} ${d.emotion.replace(/^[(（]\s*|\s*[)）]$/g, '')}`);
  const delivery = emotionDelivery([...felt, f.action].join(' '));
  if (f.names.length) add('emotion', [felt.join(' '), delivery, 'สีหน้าชัดเจน'].filter(Boolean).join(' '));
  const squash = (t: string) => String(t || '').replace(/กำลัง|\s|[,.!?"“”]/g, '');
  const endPose = endingText(clip.endPoses, clean(clip.endAction));
  const endMoment = /เพิ่งพูดจบ|หยุดพูด/.test(f.endMoment) ? '' : f.endMoment;
  const ending = [endPose, endMoment && !squash(endPose).includes(squash(endMoment)) ? endMoment : '']
    .filter(x => x && !squash(body).includes(squash(x).replace(new RegExp(f.names.join('|') || '$^', 'g'), '')))
    .join(', ');
  if (ending) add('ending', `จบคลิปด้วย${ending}`);
  if (sensitiveWords(clip).length || /ร้องไห้|น้ำตา|สะอื้น/.test(f.action)) add('safety', SAFETY_SHORT);
  // 5. set and light (the master image), and the camera only when the script gives one
  // the place's own details from the location library (a generic list made Meta add a staircase)
  const placeNote = locationNoteFor(f.place.location, opts.locationNotes);
  add('scene', [
    masterNo ? `ฉากตามรูปที่ ${masterNo}${placeNote ? ` (${placeNote})` : ''}${att.faces.length ? ' ไม่ใช้ฉากหลังของรูปตัวละคร' : ''}` : '',
    f.lighting,
    'ฉากและแสงคงเดิม'
  ].filter(Boolean).join(' '));
  if (cam?.kind === 'script' && cam.scriptText) add('camera', `มุมกล้อง: ${cam.scriptText}${cam.movement ? ` ${cam.movement}` : ''}`);
  // 6. picture quality, format and sound
  add('quality', qualityLine(opts.aspectRatio, clip.durationSeconds, f.lines.length > 0));
  return parts;
}

/** "cinematic photorealistic, 9:16, 10 วินาที, …": the last sentence of every video prompt. */
function qualityLine(aspectRatio?: string, seconds?: number, speaks = true): string {
  return [
    'cinematic photorealistic',
    aspectRatio || '',
    seconds ? `${seconds} วินาที` : '',
    'ละครไทยแต่ง นักแสดงผู้ใหญ่',
    speaks ? VIDEO_SOUND_DIALOGUE : VIDEO_SOUND_SILENT,
    'ไม่มีตัวหนังสือบนจอ'
  ].filter(Boolean).join(', ');
}

/** One clip's video prompt: the parts in order, as plain sentences. */
function joinVideoParts(parts: VideoPart[]): string {
  const seen = new Set<string>();
  return parts.map(p => p.text).filter(t => {
    const k = t.replace(/[\s.,;:()"“”—–-]/g, '');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).join(' ').replace(/\s+/g, ' ').trim();
}

// ---- What Meta AI asked for (its own answer, kept in the prompts) --------------------------------
/** Meta's dialogue formula: name + this + the Thai line in quotes */
export const DIALOGUE_FORMULA = 'speaks in Thai, exact line, lip-sync, no paraphrase';
/** Real faces + physical violence / heavy distress are refused: drama in words, emotion without harm */
export const SAFETY_LINE = 'ความปลอดภัย: ดราม่าด้วยคำพูดเท่านั้น ไม่มีการทำร้ายร่างกาย ไม่ตี ไม่ผลัก ไม่ร้องไห้หนักในภาพใกล้มาก';
/** The video prompt's version, only for a clip with a hit / push / tears (see sensitiveWords) */
export const SAFETY_SHORT = 'ดราม่าด้วยคำพูด ไม่มีการทำร้ายร่างกาย ไม่ร้องไห้หนักในภาพใกล้';
/** How to show the clip's feeling safely, matched to it (an angry clip is not told to be teary) */
export function emotionDelivery(text: string): string {
  const t = String(text || '');
  if (/(ร้องไห้|น้ำตา|เศร้า|เสียใจ|สะอื้น|ผิดหวัง|เจ็บปวด)/.test(t)) return 'แสดงความเศร้าผ่านน้ำตาคลอและเสียงสั่น';
  if (/(โกรธ|โมโห|เดือด|ฉุน|ตะคอก|ตวาด|ขึ้นเสียง|เกรี้ยวกราด|แค้น)/.test(t)) return 'แสดงความโกรธผ่านสีหน้า แววตา และน้ำเสียงหนักแน่น ไม่มีน้ำตา';
  if (/(ตกใจ|ช็อก|อึ้ง|งง)/.test(t)) return 'แสดงความตกใจผ่านสีหน้าและแววตา';
  return '';
}
/** Actions Meta may refuse with real faces (shown as a warning on the clip card, the script is not changed) */
const SENSITIVE_RE = /(ตบ|ตี(?!ความ|ห|ตัว|สอง|หนึ่ง|นิ้ว)|ผลัก|ต่อย|เตะ|ทำร้าย|บีบคอ|แทง|ยิง|เลือด|ฆ่า|ทุบ|กระชาก|จูบ|ถอดเสื้อ|เปลือย)/g;
export function sensitiveWords(clip: ClipForMeta): string[] {
  return Array.from(new Set((clipAction(clip).match(SENSITIVE_RE) || [])));
}

function first0Master(clips: ClipForMeta[], indexes: number[]): string {
  const p = indexes.length ? sceneOfClip(clips, indexes[0]) : { location: '' };
  return p.location ? `ภาพมาสเตอร์ ${masterName(p.location)}` : '';
}

/** "ห้องโถงคฤหาสน์ Master": the empty-set picture attached with every prompt at that place */
export function masterName(location: string): string {
  return `${location || 'สถานที่'} Master`;
}

/**
 * Location Bible: the same block, word for word, in every prompt at a place (Meta: never rewrite it).
 * Floor, walls, stairs, curtains, doors, light direction, time, camera height.
 */
export function locationBible(location: string, timeOfDay: string, lighting: string, details = ''): string {
  let h = 0;
  for (const ch of String(location || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const side = h % 2 ? 'ซ้าย' : 'ขวา';
  return [
    `สถานที่ ${location || 'เดิม'}${timeOfDay ? ` เวลา ${timeOfDay}` : ''}`,
    // the place's own details only (a generic "stairs, curtains" list made Meta add a staircase)
    details ? `ลักษณะสถานที่: ${details}` : '',
    'พื้น ผนัง ประตู หน้าต่าง และเฟอร์นิเจอร์ ตำแหน่งและสีตามภาพมาสเตอร์ทุกจุด ห้ามย้าย เพิ่ม หรือลบ',
    `${lighting || 'แสงธรรมชาติ'} แสงหลักเข้าจากด้าน${side}ของภาพ`,
    'กล้องระดับสายตา เลนส์ 35 มม. ฉากและแสงคงเดิมทั้งคลิป ห้ามเปลี่ยนสถานที่'
  ].filter(Boolean).join(' — ');
}

/** Background rule when character photos are attached: their photo backgrounds are not the set */
export const BACKGROUND_FROM_MASTER = 'ฉากหลังใช้จากรูปที่ 1 เท่านั้น ห้ามใช้ฉากหลังจากรูปโปรไฟล์ตัวละคร (รูปตัวละครใช้เฉพาะใบหน้า ทรงผม และชุด)';

/** "ห้องรับแขกคฤหาสน์" -> its description from the location library (same place name, any spelling) */
export function locationNoteFor(location: string, notes?: Record<string, string>): string {
  if (!location || !notes) return '';
  const key = Object.keys(notes).find(k => k === location) || Object.keys(notes).find(k => samePlace(k, location));
  return key ? notes[key] : '';
}

/** Short look of a library location: style, floor, walls, windows, furniture, signature details. */
export function locationNote(loc: any): string {
  const v = loc?.visualProfile || {};
  const bits = [v.architecturalStyle, v.floor, v.wallColor, v.windows, v.majorFurniture, v.distinctiveFeatures]
    .map(x => String(x || '').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, ''))
    .filter(x => x && !/ไม่เห็น|ไม่ระบุ|ไม่ทราบ|not visible|unknown/i.test(x));
  const kept: string[] = [];
  for (const b of bits) {
    if (kept.length && kept.join(', ').length + b.length > 260) break;
    kept.push(b);
  }
  return kept.join(', ') || String(loc?.description || loc?.storyProfile?.description || '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

/** Still image of the empty set, made once per place and attached to every prompt there. */
export function formatLocationMasterPrompt(location: string, timeOfDay: string, lighting: string, aspectRatio = '', details = ''): string {
  return [
    `ภาพมาสเตอร์สถานที่ "${masterName(location)}": ภาพนิ่ง${aspectRatio ? ` ${aspectRatio}` : ''} ภาพถ่ายสมจริงแบบฉากในภาพยนตร์ สถานที่ว่าง ไม่มีคน`,
    locationBible(location, timeOfDay, lighting, details),
    'เห็นพื้นที่ทั้งหมดของสถานที่ชัดเจน ไม่มีตัวหนังสือหรือลายน้ำ'
  ].join('. ') + '.';
}

export interface Attachment { n: number; kind: 'master' | 'face' | 'frame'; name: string; label: string }

/**
 * What to attach before typing this clip's prompt, numbered for THIS clip (user's order):
 * รูปที่ 1 = the place's master image, then every character in the shot who has a reference photo,
 * and last the previous clip (its last video frame; for a still image, its still) when the clip
 * continues from it.
 */
export function attachmentsFor(clip: ClipForMeta, opts: MetaAiFormatOptions, facts?: ClipFacts, kind: 'video' | 'image' = 'video'): {
  list: Attachment[]; master: string; faces: { n: number; name: string }[]; lastFrameOf?: number; frameNo?: number;
} {
  const f = facts || clipFacts(clip, opts);
  const list: Attachment[] = [];
  const master = f.place.location ? masterName(f.place.location) : '';
  if (master) list.push({ n: list.length + 1, kind: 'master', name: master, label: `ภาพมาสเตอร์ ${master}` });
  for (const name of f.names) {
    if (f.photoNames.includes(name)) list.push({ n: list.length + 1, kind: 'face', name, label: name });
  }
  const prev = opts.previous;
  const lastFrameOf = f.continuous && prev ? (Number(prev.clip.clipNumber) || undefined) : undefined;
  if (lastFrameOf) {
    const frame: Attachment = { n: 0, kind: 'frame', name: String(lastFrameOf), label: kind === 'video' ? `เฟรมสุดท้ายของวิดีโอคลิป ${lastFrameOf}` : `ภาพนิ่งของคลิป ${lastFrameOf}` };
    // a video starts from its FIRST picture: with the empty set first, the cast faded in over it
    // (double exposure, a second floating head). So the previous clip's last frame goes first,
    // then the faces, the master last.
    if (kind === 'video') {
      const master0 = list.filter(x => x.kind === 'master');
      list.splice(0, list.length, frame, ...list.filter(x => x.kind !== 'master'), ...master0);
    } else list.push(frame);
    list.forEach((x, k) => { x.n = k + 1; });
  }
  return {
    list,
    master,
    faces: list.filter(x => x.kind === 'face').map(x => ({ n: x.n, name: x.name })),
    lastFrameOf,
    frameNo: list.find(x => x.kind === 'frame')?.n
  };
}

/** "รูปที่ 1 ภาพมาสเตอร์ … · รูปที่ 2 คุณหญิงมณี · … · รูปที่ 4 เฟรมสุดท้ายของวิดีโอคลิป 4" for the card. */
export function attachmentLine(clip: ClipForMeta, opts: MetaAiFormatOptions, kind: 'video' | 'image' = 'video'): string {
  return attachmentsFor(clip, opts, undefined, kind).list.map(x => `รูปที่ ${x.n} ${x.label}`).join(' · ');
}

/** Character lock: profile reference photos (at most two attached) + one fixed look line per person. */
function characterLock(f: ClipFacts, faces: { n: number; name: string }[]): string {
  const refs = faces.map(x => `รูปที่ ${x.n} คือรูปโปรไฟล์อ้างอิงของ${x.name}`);
  const looks = f.names.map(n => `${n}${f.notes[n] ? ` (${f.notes[n]})` : ''}${!f.photoNames.includes(n) ? ' ยังไม่มีภาพอ้างอิง' : ''}`);
  return `ล็อกตัวละคร: ${[refs.join(', '), `ลุคคงที่: ${looks.join(', ')}`].filter(Boolean).join('; ')} — ใบหน้า ทรงผม เมคอัพ เครื่องประดับ ชุด และเสียงพูดของแต่ละคนคงเดิมทุกคลิป ${f.animal ? 'ห้ามกลายเป็นมนุษย์หรือสิ่งอื่น' : 'ห้ามกลายเป็นคนอื่น'}`;
}

export function formatClipForMetaAi(clip: ClipForMeta, opts: MetaAiFormatOptions = {}): string {
  return joinVideoParts(videoPromptParts(clip, opts));
}

/** The pieces of one clip's image prompt, by role (the location batch shares some of them). */
interface ImageParts {
  context?: string;
  refs?: string; looks?: string; place?: string; camera?: string; staging?: string;
  continuity?: string; format?: string; rules: string[]; names?: string[]; facts?: ClipFacts;
}

/** "ตัวละครและภาพอ้างอิง" + "เสื้อผ้าและรูปลักษณ์" for a cast (one clip, or every clip of a batch). */
function castBlocks(f: Pick<ClipFacts, 'photoNames' | 'photoNo' | 'noPhoto' | 'notes' | 'animal'>): { refs: string; looks: string } {
  const refs = [
    f.photoNames.length ? `${f.photoNames.map(n => `รูปที่ ${f.photoNo.get(n)} = ${n}`).join(', ')} ใช้รูปเป็นต้นแบบหลักของใบหน้าและโครงหน้า` : '',
    f.noPhoto.length ? `${f.noPhoto.map(n => `${n}${f.notes[n] ? ` (${f.notes[n]})` : ''}`).join(', ')} ยังไม่มีภาพอ้างอิง` : ''
  ].filter(Boolean).join('; ');
  const looks = f.photoNames.filter(n => f.notes[n]).map(n => `${n} (${f.notes[n]})`).join(', ');
  return {
    refs: `ตัวละครและภาพอ้างอิง: ${refs} — ห้ามสลับหน้าระหว่างตัวละคร ห้ามเพิ่มตัวละครที่ไม่มีในบท${f.animal ? ' ตัวละครที่เป็นสัตว์ต้องเป็นสัตว์ตามภาพ ห้ามกลายเป็นมนุษย์' : ''}`,
    looks: `เสื้อผ้าและรูปลักษณ์: ${looks ? looks + ' — ' : ''}${f.photoNames.length ? 'ทรงผม สีผม ชุด สี ลวดลาย รองเท้า และเครื่องประดับตามภาพอ้างอิง ' : ''}ห้ามเปลี่ยนชุดหรือสลับเสื้อผ้าระหว่างตัวละคร`
  };
}

function imagePromptParts(clip: ClipForMeta, opts: MetaAiFormatOptions): ImageParts {
  const f = clipFacts(clip, opts);
  const cam: CameraShot = f.cam || {
    kind: 'medium', framing: '', movement: '', size: f.names.length > 1 ? 'WS' : 'MS', angle: 'eye',
    subject: f.names[0] || '', staging: {}, moving: false
  };
  const main = cam.subject || f.names[0] || '';
  const others = f.names.filter(n => n !== main);
  const close = ['CU', 'MCU', 'MS'].includes(cam.size);
  const fromBehind = cam.angle === 'rear' || cam.angle === 'rear34';
  const backTurned = (n: string) => (n === main && fromBehind) || (cam.angle === 'ots' && n === cam.partner);
  const parts: ImageParts = { rules: [] };

  parts.context = 'บริบท: ภาพนิ่งจากละครดราม่าไทยแต่ง (นิยาย) นักแสดงผู้ใหญ่ที่ยินยอม';
  // 1-2. characters: at most two profile reference photos + one fixed look line per person (Meta)
  if (f.names.length) {
    const faces = attachmentsFor(clip, opts, f, 'image').faces;
    parts.refs = characterLock(f, faces) + ' ห้ามสลับหน้าระหว่างตัวละคร ห้ามเพิ่มตัวละครที่ไม่มีในบท';
    parts.looks = `เสื้อผ้าและรูปลักษณ์: ${f.photoNames.length ? 'ทรงผม สีผม ชุด สี ลวดลาย รองเท้า และเครื่องประดับตามภาพอ้างอิง ' : ''}ห้ามเปลี่ยนชุดหรือสลับเสื้อผ้าระหว่างตัวละคร`;
  }
  // 3. place + light
  if (f.place.location || f.place.timeOfDay) parts.place = `สถานที่และแสง${f.place.location ? ` (รูปที่ 1 คือภาพมาสเตอร์ "${masterName(f.place.location)}")` : ''}: ${locationBible(f.place.location, f.place.timeOfDay, f.lighting, locationNoteFor(f.place.location, opts.locationNotes))} เปลี่ยนได้เฉพาะมุมกล้อง${f.place.location && f.photoNames.length ? ` — ${BACKGROUND_FROM_MASTER}` : ''}`;
  // 4. camera direction + shot size
  const sizeText = cam.kind === 'insert' && cam.prop
    ? `Close-up: ${cam.prop}${main ? `ในมือ${main}` : ''} เห็นมือและ${cam.prop}ชัด`
    : SIZE_TEXT[cam.size](main || 'ตัวละครหลัก');
  parts.camera = (`มุมกล้องและระยะภาพ: ${[cam.scriptText ? `ตามบท "${cam.scriptText}"` : '', ANGLE_TEXT[cam.angle](main, cam.partner), sizeText,
    close && others.length ? `ตัวละครรอง (${others.join(', ')}) อยู่ฉากหลังหรือเห็นเพียงบางส่วนได้` : ''].filter(Boolean).join('; ')}`);
  // 5. positions + action
  const poseOf = (n: string) => f.startPoses.find(p => p?.name === n);
  const lookAt = (n: string): string => {
    const alt = f.names.filter(x => x !== n).join('|') || '$^';
    const m = f.action.match(new RegExp(`${n}[^\\s]*?มอง(?:ไปที่|ไปยัง|หา)?(${alt})`));
    if (m) return m[1];
    const g = clean(poseOf(n)?.gesture).match(new RegExp(`มอง(?:ไปที่|ไปยัง|หา)?(${alt})`));
    if (g) return g[1];
    return f.speakers[0] && n !== f.speakers[0] && f.names.includes(f.speakers[0]) ? f.speakers[0] : '';
  };
  const depthOf = (n: string) => (cam.size === 'WS' || cam.size === 'EWS')
    ? 'ฉากกลาง'
    : n === main ? 'ฉากหน้า' : (cam.angle === 'ots' && n === cam.partner ? 'ฉากหน้า เห็นไหล่และท้ายทอย' : 'ฉากหลัง');
  const staging = f.names.map(n => {
    const p = poseOf(n);
    const posture = p ? (POSTURE_TH[p.posture === 'walking' && !p.entering ? 'standing' : (p.posture || '')] || '') : '';
    return `${n}: ${[
      cam.staging?.[n] || '',
      depthOf(n),
      backTurned(n) ? 'หันหลังให้กล้อง' : (n === main && cam.angle === 'side' ? 'หันข้างให้กล้อง' : ''),
      posture,
      clean(p?.place) ? `ที่${clean(p?.place).replace(/^ที่/, '')}` : '',
      lookAt(n) ? `มองไปที่${lookAt(n)}` : '',
      clean(p?.holding) ? `ถือ${clean(p?.holding).replace(/^ถือ/, '')}` : '',
      clean(p?.gesture) && !/^มอง/.test(clean(p?.gesture)) ? clean(p?.gesture) : ''
    ].filter(Boolean).join(', ')}`;
  });
  // a packed clip (several beats): the still is its first moment
  const firstAction = (clip.sequence || []).find(st => st.kind === 'action')?.text;
  const shown = clip.sequence && clip.sequence.length > 1 ? (clip.sequence[0].kind === 'action' ? firstAction || '' : '') : f.action;
  const setPiece = shown.match(/(ประตู|หน้าต่าง|บันได|โต๊ะ|โซฟา|รถ|เตียง|ราวบันได)/)?.[1];
  const moment = shown
    ? `จังหวะในภาพ: ${shown}${cam.moving ? ' (กำลังเคลื่อนไหว เช่น กำลังก้าว ไม่ใช่ยืนโพสนิ่ง)' : ''}${setPiece ? ` ให้เห็น${setPiece}เท่าที่ระยะกล้องอนุญาต` : ''}`
    : '';
  const face = f.names.length
    ? `${f.names.some(backTurned) ? 'ตัวละครที่หันหลังแสดงอารมณ์ผ่านท่าทาง ' : ''}สีหน้าและอารมณ์ตรงกับเหตุการณ์ ทุกคนปิดปาก ยังไม่พูด`
    : '';
  parts.staging = (`ตำแหน่งและการกระทำ: ${[staging.join(' | '), moment, face].filter(Boolean).join('. ')}`);
  if (f.continuous && f.hasPrevious) {
    const att = attachmentsFor(clip, opts, f, 'image');
    parts.continuity = `ความต่อเนื่อง: ${att.lastFrameOf ? `รูปที่ ${att.frameNo} (รูปสุดท้าย) คือภาพนิ่งของคลิป ${att.lastFrameOf} ` : ''}ต่อจากภาพของคลิปก่อน ตำแหน่ง ชุด แสง และฉากเดิม`;
  }
  // 6. format + the rules that matter for this shot
  parts.format = (`รูปแบบและสัดส่วนภาพ: ภาพนิ่ง${opts.aspectRatio ? ` ${opts.aspectRatio}` : ''} ภาพถ่ายสมจริงแบบฉากในภาพยนตร์ ไม่ใช่ภาพวาดหรือการ์ตูน${opts.aspectRatio === '9:16' && !fromBehind ? ' ใบหน้าอยู่ช่วงบนของจอ' : ''} ไม่มีตัวหนังสือ ซับไตเติล หรือลายน้ำ`);
  parts.rules = [
    'มุมกล้อง ระยะภาพ ตัวละคร และท่าทางสำคัญกว่าความสวยงาม',
    close ? 'ห้ามขยายเป็นภาพเต็มตัวเพื่อให้เห็นทุกคน' : '',
    f.names.some(backTurned) ? 'ห้ามหมุนตัวละครที่หันหลังมาเป็นด้านหน้า' : '',
    'ห้ามคิดท่าทางใหม่ที่ไม่ตรงบท'
  ].filter(Boolean);
  parts.names = f.names;
  parts.facts = f;
  return parts;
}

const cleanUnspecified = (t: string) => t.replace(/(?:เวลา|สถานที่)\s*ไม่ระบุ(?:จากต้นฉบับ)?[,.]?\s*/g, '');

/**
 * Still-image prompt for one clip (made first, then animated): same facts as the video prompt,
 * in the order: characters + references, costume, place + light, camera + shot size,
 * positions + action, format. Camera direction / shot size from the script are never changed.
 */
export function formatClipImagePrompt(clip: ClipForMeta, opts: MetaAiFormatOptions = {}): string {
  const p = imagePromptParts(clip, opts);
  // Meta's order: story context, location + master, characters, continuity, action / camera, format
  return cleanUnspecified(withoutRepeats([p.context, p.place, p.refs, p.looks, p.continuity, p.camera, p.staging, p.format,
    p.rules.length ? `ข้อบังคับ: ${p.rules.join(' ')}` : ''].filter(Boolean) as string[]));
}

export interface PlaceImageGroup {
  location: string;
  timeOfDay: string;
  /** Clip indexes (0-based) at this place and time, in story order */
  clips: number[];
}

/** Clips that share one set and one light (same place, same time of day), wherever they are in the story. */
export function groupClipsByPlace(clips: ClipForMeta[]): PlaceImageGroup[] {
  const groups: PlaceImageGroup[] = [];
  clips.forEach((_, i) => {
    const p = sceneOfClip(clips, i);
    const g = groups.find(x => (x.location || p.location ? samePlace(x.location, p.location) : true) && x.timeOfDay === p.timeOfDay);
    if (g) g.clips.push(i);
    else groups.push({ location: p.location, timeOfDay: p.timeOfDay, clips: [i] });
  });
  return groups;
}

/** How many images one batch prompt asks for (long prompts with many shots are followed less well). */
export const IMAGE_BATCH_SIZE = 4;

/**
 * One prompt for several still images at the same place: the shared locks (characters, costume,
 * place + light, format, rules) written once, then each clip's own shot (cast, camera + shot size,
 * positions + action, continuity, its own extra rules).
 */
export function formatPlaceImageBatch(clips: ClipForMeta[], indexes: number[], opts: MetaAiFormatOptions = {}): string {
  const items = indexes.map(i => ({ i, p: imagePromptParts(clips[i], { ...opts, ...metaContextFor(clips, i) }) }));
  if (items.length === 0) return '';
  // the cast of the whole batch, with the story-wide photo numbers
  const all = { photoNames: [] as string[], photoNo: new Map<string, number>(), noPhoto: [] as string[], notes: {} as Record<string, string>, animal: false };
  for (const { p } of items) {
    const f = p.facts!;
    f.photoNames.forEach(n => { if (!all.photoNames.includes(n)) { all.photoNames.push(n); all.photoNo.set(n, f.photoNo.get(n)!); } });
    f.noPhoto.forEach(n => { if (!all.noPhoto.includes(n)) all.noPhoto.push(n); });
    Object.assign(all.notes, f.notes);
    all.animal = all.animal || f.animal;
  }
  all.photoNames.sort((a, b) => (all.photoNo.get(a) || 0) - (all.photoNo.get(b) || 0));
  all.noPhoto = all.noPhoto.filter(n => !all.photoNames.includes(n));
  const shared: string[] = [];
  const first = items[0].p;
  if (first.context) shared.push(first.context);
  if (first.place) shared.push(first.place);
  if (all.photoNames.length || all.noPhoto.length) {
    const names = [...all.photoNames, ...all.noPhoto];
    const looks = names.map(n => `${n}${all.notes[n] ? ` (${all.notes[n]})` : ''}${all.photoNames.includes(n) ? '' : ' ยังไม่มีภาพอ้างอิง'}`);
    shared.push(`ล็อกตัวละคร: ลุคคงที่: ${looks.join(', ')} — แต่ละภาพแนบรูปตามลำดับใน "แนบก่อนพิมพ์" ของภาพนั้น (รูปที่ 1 สถานที่ ต่อด้วยตัวละครในภาพ รูปสุดท้ายภาพของคลิปก่อน) ห้ามสลับหน้าระหว่างตัวละคร ห้ามเพิ่มตัวละครที่ไม่มีในบท${all.animal ? ' ตัวละครที่เป็นสัตว์ต้องเป็นสัตว์ตามภาพ ห้ามกลายเป็นมนุษย์' : ''}`);
    if (first.looks) shared.push(first.looks);
  }
  // "ใบหน้าอยู่ช่วงบนของจอ" once for the batch when every shot has it, else per shot
  const faceEverywhere = items.every(({ p }) => /ใบหน้าอยู่ช่วงบนของจอ/.test(p.format || ''));
  if (first.format) shared.push(faceEverywhere ? first.format.replace(/\s*ใบหน้าอยู่ช่วงบนของจอ/, '') + ' ใบหน้าอยู่ช่วงบนของจอ' : first.format.replace(/\s*ใบหน้าอยู่ช่วงบนของจอ/, ''));
  shared.push('ข้อบังคับ: มุมกล้อง ระยะภาพ ตัวละคร และท่าทางสำคัญกว่าความสวยงาม ห้ามคิดท่าทางใหม่ที่ไม่ตรงบท');
  const COMMON = new Set(['มุมกล้อง ระยะภาพ ตัวละคร และท่าทางสำคัญกว่าความสวยงาม', 'ห้ามคิดท่าทางใหม่ที่ไม่ตรงบท']);
  const shots = items.map(({ i, p }, k) => {
    const own = p.rules.filter(r => !COMMON.has(r));
    const face = !faceEverywhere && /ใบหน้าอยู่ช่วงบนของจอ/.test(p.format || '') ? 'ใบหน้าอยู่ช่วงบนของจอ' : '';
    const att = attachmentLine(clips[i], { ...opts, ...metaContextFor(clips, i) }, 'image');
    const lines = [
      att ? `แนบก่อนพิมพ์: ${att}` : '',
      p.names?.length ? `ตัวละครในภาพ: ${p.names.join(', ')}` : '',
      p.continuity, p.camera, p.staging,
      [face, ...own].filter(Boolean).length ? `เฉพาะภาพนี้: ${[face, ...own].filter(Boolean).join(' ')}` : ''
    ].filter(Boolean) as string[];
    return `ภาพที่ ${k + 1} (คลิป ${(clips[i].clipNumber as number) || i + 1}):\n${cleanUnspecified(withoutRepeats(lines))}`;
  });
  const uploads = all.photoNames.length ? `รูปโปรไฟล์ของ ${all.photoNames.join(', ')}` : '';
  return [
    `สร้างภาพนิ่ง ${items.length} ภาพแยกกัน ภาพละ 1 ช็อตตามรายการด้านล่าง ทุกภาพอยู่ในสถานที่และเวลาเดียวกัน ใช้ข้อมูลล็อกร่วมเหมือนกันทุกภาพ`,
    `(เตรียมไฟล์: ${[first0Master(clips, indexes), uploads].filter(Boolean).join(' · ')} — แต่ละช็อตแนบเฉพาะไฟล์ที่ระบุใน "แนบก่อนพิมพ์")`,
    `ล็อกร่วมทุกภาพ:\n${cleanUnspecified(withoutRepeats(shared))}`,
    ...shots
  ].filter(Boolean).join('\n\n');
}

/** How many video clips one scene batch carries (each clip is still made on its own). */
export const VIDEO_BATCH_SIZE = 4;

/**
 * Several video prompts of one scene (same place and time) in one copy: the shared locks written
 * once (length + ratio, place + light, characters with looks / costume / voice, sound, no text),
 * then each clip in story order with only its own parts (start pose, camera, actions, dialogue
 * word for word, emotion, end pose, speech rules).
 */
export function formatPlaceVideoBatch(clips: ClipForMeta[], indexes: number[], opts: MetaAiFormatOptions = {}): string {
  const items = indexes.map(i => {
    const ctx = { ...opts, ...metaContextFor(clips, i) };
    return { i, parts: videoPromptParts(clips[i], ctx), f: clipFacts(clips[i], ctx) };
  });
  if (items.length === 0) return '';
  // the cast of the whole scene, with the story-wide photo numbers
  const all: any = { photoNames: [] as string[], photoNo: new Map<string, number>(), noPhoto: [] as string[], notes: {} as Record<string, string>, animal: false };
  for (const { f } of items) {
    f.photoNames.forEach(n => { if (!all.photoNames.includes(n)) { all.photoNames.push(n); all.photoNo.set(n, f.photoNo.get(n)); } });
    f.noPhoto.forEach(n => { if (!all.noPhoto.includes(n)) all.noPhoto.push(n); });
    Object.assign(all.notes, f.notes);
    all.animal = all.animal || f.animal;
  }
  all.photoNames.sort((a: string, b: string) => (all.photoNo.get(a) || 0) - (all.photoNo.get(b) || 0));
  all.noPhoto = all.noPhoto.filter((n: string) => !all.photoNames.includes(n));
  const part = (k: number, key: VideoPart['key']) => items[k].parts.filter(p => p.key === key).map(p => p.text);
  const lengths = Array.from(new Set(indexes.map(i => clips[i].durationSeconds || 0)));
  const shared: string[] = [];
  // same place and time for the whole batch: said once
  shared.push(...part(0, 'place').map(t => t.replace(/^เปลี่ยนฉากมาที่/, '')));
  if (all.photoNames.length || all.noPhoto.length) {
    const names = [...all.photoNames, ...all.noPhoto];
    const who = names.map((n: string) => `${n}${!all.photoNames.includes(n) && all.notes[n] ? ` (${shortLook(all.notes[n])})` : ''}`);
    shared.push(`ตัวละคร: ${who.join(', ')} หน้าตาและชุดคงเดิมทุกคลิป${all.photoNames.length ? 'ตามรูป' : ''}${all.animal ? ' ไม่กลายเป็นมนุษย์' : ''} ไม่มีตัวละครซ้ำ`);
  }
  const master = first0Master(clips, indexes);
  const light = items[0].f.lighting;
  shared.push([master ? `ฉากตาม${master}` : '', light, 'ฉากและแสงคงเดิมทุกคลิป'].filter(Boolean).join(' '));
  shared.push(qualityLine(opts.aspectRatio, lengths.length === 1 ? lengths[0] || undefined : undefined, true)
    .replace(VIDEO_SOUND_DIALOGUE, 'มีแค่เสียงพูดตามบทของแต่ละคลิป คลิปที่ไม่มีบทพูดให้เงียบ ไม่มีดนตรีหรือเสียงประกอบ'));
  const OWN: VideoPart['key'][] = ['start', 'action', 'lock', 'emotion', 'ending', 'safety', 'camera'];
  const shots = items.map(({ i, parts }, k) => {
    const own = parts.filter(p => OWN.includes(p.key)).map(p => p.text)
      // the look lock is in the shared part; keep only the dialogue lock here
      .map(t => t.replace(/\s*หน้าตาและชุดคงเดิม\S*(?: ไม่กลายเป็นมนุษย์)? ไม่มีตัวละครซ้ำ/, '').trim())
      .filter(Boolean);
    const att = attachmentLine(clips[i], { ...opts, ...metaContextFor(clips, i) });
    const lines = [att ? `แนบก่อนพิมพ์: ${att}` : '', own.join(' ')].filter(Boolean);
    const len = lengths.length > 1 && clips[i].durationSeconds ? `, ${clips[i].durationSeconds} วินาที` : '';
    return `คลิปที่ ${k + 1} (คลิป ${(clips[i].clipNumber as number) || i + 1}${len}):\n${lines.join('\n')}`;
  });
  const uploads = all.photoNames.length ? `รูปโปรไฟล์ของ ${all.photoNames.join(', ')}` : '';
  return [
    `สร้างวิดีโอ ${items.length} คลิปแยกกัน คลิปละ 1 ช็อต ต่อเนื่องกันตามลำดับด้านล่าง ทุกคลิปอยู่ในสถานที่และเวลาเดียวกัน ใช้ข้อมูลล็อกร่วมเหมือนกันทุกคลิป`,
    `(เตรียมไฟล์: ${[first0Master(clips, indexes), uploads].filter(Boolean).join(' · ')} — แต่ละช็อตแนบเฉพาะไฟล์ที่ระบุใน "แนบก่อนพิมพ์")`,
    `ล็อกร่วมทุกคลิป:\n${withoutRepeats(shared)}`,
    ...shots
  ].filter(Boolean).join('\n\n');
}

/** Longest a video prompt may be, without its dialogue and look notes (old format: 1300-2300; the user example ~250). */
export const VIDEO_PROMPT_MAX = 700;

/** Camera / shot-size terms allowed in English (no Thai word says it as precisely). */
const TECH_WORDS = new Set(['close-up', 'medium', 'close', 'shot', 'long', 'full', 'wide', 'extreme', 'front', 'view', 'three-quarter',
  'side', 'profile', 'rear', 'high', 'low', 'angle', 'over-the-shoulder', 'eye', 'level',
  // Meta AI's own wording (dialogue formula, continuity, no subtitles, the master image's name)
  'speaks', 'in', 'thai', 'exact', 'line', 'lip-sync', 'no', 'paraphrase', 'only', 'other', 'silent',
  'continue', 'from', 'this', 'frame', 'jump', 'cut', 'subtitles', 'master',
  // the short video prompt's quality words
  'cinematic', 'photorealistic']);

/**
 * Problems in a finished prompt (empty = ready to send): repeated sentences, contradictions,
 * mixed language, camera vs shot size, action vs framing, missing parts.
 */
export function checkPromptProblems(text: string, kind: 'image' | 'video', cam?: CameraShot): string[] {
  const out: string[] = [];
  const t = String(text || '');
  // repeats
  const seen = new Map<string, number>();
  for (const seg of t.split(/(?<=[.;|])\s+|\s+\|\s+/)) {
    const k = seg.replace(/[\s.,;:()"“”—–|-]/g, '');
    if (k.length > 12) seen.set(k, (seen.get(k) || 0) + 1);
  }
  for (const [k, n] of seen) if (n > 1) out.push(`คำสั่งซ้ำ: ${k.slice(0, 30)}`);
  // language: English only for camera terms (the writer's own words in quotes / brackets are not checked)
  const ours = t.replace(/"[^"]*"/g, ' ').replace(/\([^()]*(?:\([^()]*\)[^()]*)*\)/g, ' ');
  const foreign = (ours.match(/[A-Za-z][A-Za-z-]*/g) || []).filter(w => !TECH_WORDS.has(w.toLowerCase()));
  if (foreign.length) out.push(`ภาษาอังกฤษนอกศัพท์เทคนิค: ${Array.from(new Set(foreign)).slice(0, 5).join(', ')}`);
  if (cam) {
    // camera vs shot size
    if (['CU', 'MCU', 'MS'].includes(cam.size) && /(?<!ห้ามเป็น|ห้ามขยายเป็น)ภาพเต็มตัว(?!เพื่อ)|Full Shot|ศีรษะถึงเท้า/.test(t)) out.push('ระยะใกล้แต่สั่งเต็มตัว');
    if ((cam.angle === 'rear' || cam.angle === 'rear34') && new RegExp(`${cam.subject}: [^|]*หันหน้า`).test(t)) out.push('มุมหลังแต่สั่งหันหน้า');
    if (kind === 'image' && cam.size === 'MS' && cam.kind !== 'insert' && !/ห้ามเห็นขาหรือรองเท้า/.test(t)) out.push('ครึ่งตัวไม่ได้ห้ามเห็นขา');
    // action vs framing: a close-up of the face cannot show someone walking in
    if (kind === 'image' && cam.size === 'CU' && cam.kind !== 'script' && cam.kind !== 'insert' && cam.moving) out.push('การกระทำเคลื่อนที่แต่ระยะภาพใกล้หน้า');
  }
  if (kind === 'image') {
    if (/ขณะพูด|พูดว่า "/.test(t)) out.push('ภาพนิ่งแต่สั่งให้พูด');
    for (const label of ['มุมกล้องและระยะภาพ', 'รูปแบบและสัดส่วนภาพ']) if (!t.includes(label + ':')) out.push(`ไม่มี ${label}`);
  } else {
    // the short natural video prompt (see videoPromptParts)
    const speaks = /"[^"]+"/.test(t.replace(/^แนบก่อนพิมพ์:.*$/gm, ''));
    if (speaks && /ไม่มีบทพูดในคลิปนี้/.test(t)) out.push('มีบทพูดแต่สั่งว่าไม่มีบทพูด');
    if (!speaks && /พูดภาษาไทยตรงตามบท/.test(t)) out.push('ไม่มีบทพูดแต่สั่งให้พูด');
    if (speaks && !/พูดภาษาไทยตรงตามบททุกคำ/.test(t)) out.push('บทพูดไม่ได้ล็อกให้พูดตรงตามบท');
    if (speaks && t.includes(VIDEO_SOUND_SILENT)) out.push('มีบทพูดแต่สั่งให้เงียบ');
    if (!/cinematic photorealistic/.test(t)) out.push('ไม่มี คุณภาพภาพ');
    if (!/เสียง|เงียบ/.test(t)) out.push('ไม่มี เสียง');
    if (/ล็อกฉาก|ล็อกตัวละคร|ใบหน้าตัวละครอยู่ช่วงบนของจอ|speaks in Thai|อารมณ์และการแสดง:/.test(t)) out.push('ยังเป็นรูปแบบพรอมต์ยาวแบบเก่า');
    // long prompts are followed less well: dialogue and look notes do not count
    const own = t.replace(/"[^"]*"/g, '').replace(/\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '');
    // a packed clip (several lines and beats) may be longer, by its extra lines
    const lineCount = (t.match(/"[^"]*"/g) || []).length;
    // …and by its extra characters (each has an end pose): "A, B, C และD อยู่ในฉาก"
    const castLead = own.match(/([^"]{0,120}) อยู่ในฉาก/)?.[1] || '';
    const people = castLead ? (castLead.match(/,/g) || []).length + (/และ/.test(castLead) ? 2 : 1) : 0;
    const max = VIDEO_PROMPT_MAX + 120 * Math.max(0, lineCount - 1) + 80 * Math.max(0, people - 2);
    if (own.length > max) out.push(`พรอมต์ยาวเกิน (${own.length} ตัวอักษร)`);
    if (cam) {
      if (cam.kind !== 'script' && /มุมกล้อง/.test(t)) out.push('ใส่มุมกล้องที่บทไม่ได้กำหนด');
      if (cam.kind === 'script' && cam.scriptText && !t.includes('มุมกล้อง')) out.push('ไม่มี มุมกล้องตามบท');
    }
  }
  return out;
}

/** Kept for existing callers: the image checks. */
export function imagePromptProblems(img: string, cam?: CameraShot): string[] {
  return checkPromptProblems(img, 'image', cam);
}

export interface SharedLocks {
  characters: { name: string; photo?: number; note: string }[];
  places: { location: string; timeOfDay: string; lighting: string }[];
}

/** The story's shared locks, once: who (photo number + identity / costume) and where (place, time, light). */
export function buildSharedLocks(clips: ClipForMeta[], opts: MetaAiFormatOptions = {}): SharedLocks {
  const names: string[] = [];
  clips.forEach(c => charactersInClip(c, opts.knownCharacters || []).forEach(n => { if (!names.includes(n)) names.push(n); }));
  const withPhoto = withPhotoIn(names, opts);
  const nums = photoNumbers(withPhoto, opts);
  const characters = names.map(n => ({ name: n, ...(withPhoto.includes(n) ? { photo: nums.get(n) } : {}), note: opts.characterNotes?.[n] || '' }))
    .sort((a, b) => (a.photo ?? 999) - (b.photo ?? 999));
  const places: SharedLocks['places'] = [];
  clips.forEach((c, i) => {
    const p = sceneOfClip(clips, i);
    if (!p.location && !p.timeOfDay) return;
    if (places.some(x => samePlace(x.location, p.location) && x.timeOfDay === p.timeOfDay)) return;
    const raw = String(c.generatedPrompt || '').match(/Lighting Lock:\s*([^.]*)/)?.[1] || clean(c.lighting);
    places.push({ location: p.location, timeOfDay: p.timeOfDay, lighting: thaiLighting(raw, p.timeOfDay) });
  });
  return { characters, places };
}

export function formatSharedLocks(l: SharedLocks): string {
  const who = l.characters.map(c => `- ${c.name}${c.note ? ` (${c.note})` : ''}${c.photo ? ' — มีรูปโปรไฟล์อ้างอิง' : ' — ยังไม่มีภาพอ้างอิง'}`);
  const where = l.places.map(p => `- ${[p.location, p.timeOfDay ? `เวลา ${p.timeOfDay}` : '', p.lighting].filter(Boolean).join(' ')}`);
  return [
    'ข้อมูลล็อกกลางของเรื่อง (ใช้ร่วมกันทุกคลิป)',
    who.length ? `ตัวละครและชุด:\n${who.join('\n')}` : '',
    where.length ? `สถานที่และแสง:\n${where.join('\n')}` : ''
  ].filter(Boolean).join('\n');
}


export function formatAllClipsForMetaAi(clips: ClipForMeta[], opts: MetaAiFormatOptions = {}): string {
  return clips.map((c, i) => {
    // per clip: รูปที่ 1 the place, then the characters in the shot, last the previous clip's frame
    const att = attachmentLine(c, { ...opts, ...metaContextFor(clips, i) });
    const photos = att ? `\n(แนบก่อนพิมพ์: ${att})` : '';
    return `=== คลิป ${c.clipNumber || i + 1}/${clips.length} — ${String(c.title || '').replace(/\s*[-–—/]?\s*ไม่ระบุ(?:จากต้นฉบับ)?/g, '').trim()} ===${photos}\n${formatClipForMetaAi(c, { ...opts, ...metaContextFor(clips, i) })}`;
  }).join('\n\n');
}
