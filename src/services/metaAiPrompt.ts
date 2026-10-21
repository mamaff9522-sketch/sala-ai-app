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
  CU: w => `ภาพระยะใกล้ (Close-up) เฟรมเฉพาะใบหน้าและไหล่ของ${w}`,
  MCU: w => `ภาพระยะใกล้ปานกลาง (Medium Close-up) เฟรมตั้งแต่ศีรษะถึงช่วงอกของ${w}`,
  MS: w => `ภาพครึ่งตัว (Medium Shot) เฟรมตั้งแต่ศีรษะถึงเอวของ${w}เท่านั้น ห้ามเห็นขาหรือรองเท้า${w} ห้ามเป็นภาพเต็มตัว`,
  MLS: w => `ภาพระยะศีรษะถึงเข่า (Medium Long Shot) ของ${w} ห้ามเห็นเท้า`,
  FS: w => `ภาพเต็มตัว (Full Shot) เห็น${w}ตั้งแต่ศีรษะถึงเท้า`,
  WS: () => 'ภาพกว้าง (Wide Shot) เห็นพื้นที่ฉากและตัวละครทุกคนตามบท',
  EWS: () => 'ภาพกว้างมาก (Extreme Wide Shot) เน้นภาพรวมของสถานที่ ตัวละครมีขนาดเล็กในภาพ'
};
const ANGLE_TEXT: Record<CameraAngle, (who: string, partner?: string) => string> = {
  front: w => `มุมกล้องด้านหน้า (Front View) มองเห็น${w}จากด้านหน้า`,
  front34: w => `มุมกล้องเฉียงหน้า (Front Three-Quarter) มองเห็นใบหน้า${w}จากมุมเฉียง`,
  side: w => `มุมกล้องด้านข้าง (Side Profile) กล้องอยู่ด้านข้าง${w}จริง เห็นใบหน้าด้านข้างและลำตัวด้านข้าง ไม่ใช่มุมหน้าตรง`,
  rear: w => `มุมกล้องด้านหลัง (Rear View) กล้องอยู่ด้านหลัง${w}จริง เห็นแผ่นหลังและด้านหลังศีรษะ ห้ามหมุนหน้า${w}เข้าหากล้อง`,
  rear34: w => `มุมกล้องเฉียงหลัง (Rear Three-Quarter) เห็นแผ่นหลัง${w}เป็นหลักและเห็นด้านข้างบางส่วน ห้ามหันหน้าเข้าหากล้อง`,
  high: w => `มุมสูง (High Angle) กล้องอยู่สูงกว่า${w}และกดมุมลง`,
  low: w => `มุมต่ำ (Low Angle) กล้องอยู่ต่ำกว่า${w}และเงยขึ้น`,
  ots: (w, p) => `มุมข้ามไหล่ (Over-the-Shoulder) มองผ่านไหล่${p || 'ตัวละครอีกคน'}ไปยัง${w} ไหล่และด้านหลังศีรษะของ${p || 'ตัวละครอีกคน'}อยู่ฉากหน้า`,
  eye: () => 'กล้องระดับสายตา (Eye Level)'
};

const samePlace = (a: string, b: string) => {
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

const LABEL_CUT_RE = /\s*(?:Continuity Flow|Starting moment|Ending momentum|Dialogue|Continuity Handoff|Stance\/Position Lock|Spatial Position Lock|Location Lock|Lighting Lock)\s*:.*$/;
function clipAction(clip: ClipForMeta): string {
  const prompt = String(clip.generatedPrompt || '');
  const secs = findSections(prompt);
  const parts = ['Core action', 'Scene Action', 'Script action']
    .map(l => secs.find(x => x.label === l))
    .filter(Boolean)
    .map(x => sectionBody(x!.text, x!.label).replace(LABEL_CUT_RE, '').replace(/[.;\s]+$/, ''));
  return parts.join(' ') || clean(clip.startAction);
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
          sd = !used.has('ซ้ายจอ') ? 'ซ้ายจอ' : !used.has('ขวาจอ') ? 'ขวาจอ' : 'กลางจอ';
          used.add(sd);
          if (sd !== 'กลางจอ') screen.set(n, sd);
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
        ? shot('wide', `ภาพกว้าง เห็นทั้ง${place || 'สถานที่'}และทุกคนในฉาก${sidesText(names)}`, 'กล้องค่อยๆ เลื่อนเข้าช้าๆ')
        : shot('medium', `ภาพครึ่งตัว ${subject} เห็นพื้นหลังของ${place || 'สถานที่'}`, 'กล้องค่อยๆ เลื่อนเข้าช้าๆ');
    } else if (lines.length === 0) {
      const prop = action.match(PROP_RE)?.[1];
      if (prop && prev?.kind !== 'insert') {
        cam = shot('insert', `ภาพใกล้${prop}${subject ? `ในมือ${subject}` : ''} แล้วเห็นสีหน้า${subject || 'ตัวละคร'}`, 'กล้องนิ่ง');
      } else if (prev?.kind !== 'close' && subject) {
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
      if (moving) options.unshift(shot('medium', `ภาพครึ่งตัว ${subject || speaker} ขณะเคลื่อนที่`, 'กล้องเลื่อนตามช้าๆ'));
      cam = options.find(o => o.kind !== prev?.kind) || options[0];
      if (cam.kind === 'ots' || cam.kind === 'two') cam.partner = listener;
      if (cam.kind !== 'medium' || !moving) cam.subject = speaker;
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
        sd = !taken.has('ซ้ายจอ') ? 'ซ้ายจอ' : !taken.has('ขวาจอ') ? 'ขวาจอ' : 'กลางจอ';
        taken.add(sd);
        if (sd !== 'กลางจอ') screen.set(n, sd);
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
  knownCharacters.forEach(n => { if (n && (lock ? lock.text.includes(n) : prompt.includes(n))) add(n); });
  return out;
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

/** Who is in the clip: photo numbers, the others, and what must never change about them. */
function identityBlock(names: string[], opts: MetaAiFormatOptions, kind: 'video' | 'image'): string {
  const order0 = photoNumbers(withPhotoIn(names, opts), opts);
  const photoNames = withPhotoIn(names, opts).sort((a, b) => (order0.get(a) || 0) - (order0.get(b) || 0));
  const order = order0;
  const others = names.filter(n => !photoNames.includes(n));
  const notes = names
    .map(n => (opts.characterNotes?.[n] ? `${n}: ${opts.characterNotes[n]}` : ''))
    .filter(Boolean).join(' | ');
  const parts: string[] = [];
  if (photoNames.length) {
    parts.push(`ตัวละคร (ใช้รูปที่อัปโหลดเป็นต้นแบบ): ${photoNames.map(n => `รูปที่ ${order.get(n)} = ${n}`).join(', ')} — ใบหน้า ทรงผม รูปร่าง และชุดต้องเหมือนในรูป${kind === 'video' ? 'ทุกช็อต เสียงพูดของแต่ละคนเหมือนเดิมทุกคลิป' : ''}`);
  }
  if (others.length) {
    parts.push(kind === 'video'
      ? `ตัวละคร${photoNames.length ? 'อื่น' : ''}ในคลิป: ${others.join(', ')} — หน้าตา ชุด และเสียงพูดของแต่ละคนต้องเหมือนเดิมทุกคลิป`
      : `ตัวละคร${photoNames.length ? 'อื่น' : ''}ในภาพ: ${others.join(', ')} — หน้าตาและชุดเหมือนเดิมทุกภาพ`);
  }
  // Animal characters drift into people most: say so explicitly for them
  const animal = /anthropomorphic|animal|reptile|gecko|lizard|buffalo|creature|สัตว์|เกล็ด|ตุ๊กแก|ตัวเหี้ย|กิ้งก่า|ควาย/i.test(notes);
  if (notes) parts.push(`ลักษณะที่ห้ามเปลี่ยน (${animal ? 'ห้ามกลายเป็นมนุษย์หรือสิ่งอื่น' : 'ห้ามกลายเป็นคนอื่น'}): ${notes}`);
  return parts.join('. ');
}

/**
 * Still-image prompt for one clip (Image Prompt Generator). Built from the same camera plan, place,
 * light and photo numbers as the video prompt, in this order:
 *   Character Reference Lock, Costume Lock, Location & Lighting Lock, Camera Direction Lock,
 *   Shot Size Lock, Character Position & Action, Scene Continuity, Photorealistic Cinematic Quality,
 *   then the priority rules. Camera direction and shot size from the script are never changed;
 *   the result is checked for contradictions before it is returned (see imagePromptProblems).
 */
export function formatClipImagePrompt(clip: ClipForMeta, opts: MetaAiFormatOptions = {}): string {
  const prompt = String(clip.generatedPrompt || '').replace(/ผูกพรอมต์นี้กับฉากที่[^.]*\.\s*/g, '');
  const own = ownPlace(clip);
  const place = {
    location: own.location || opts.inheritedPlace?.location || '',
    timeOfDay: own.timeOfDay || opts.inheritedPlace?.timeOfDay || ''
  };
  const prev = opts.previous;
  const continuous = !!prev && (!place.location || !prev.place.location || samePlace(place.location, prev.place.location));
  const startPoses: PoseForMeta[] = (continuous && prev?.clip.endPoses?.length ? prev.clip.endPoses : clip.startPoses) || [];
  // The user's own "มุมกล้อง:" line wins: a camera phrase inside the action would contradict it
  const userCamera = SCRIPT_CAMERA_RE.test(String(clip.generatedPrompt || ''));
  let action = clipAction(clip).replace(/\s*\[มุมกล้อง\s+[^\]]+\]\s*/g, ' ').trim();
  if (userCamera) action = action.replace(new RegExp(SCRIPT_CAMERA_WORDS_RE.source, 'gi'), ' ').replace(/\s+/g, ' ').trim();
  const lightMatch = prompt.match(/Lighting Lock:\s*([^.]*)/);
  const lighting = (lightMatch?.[1] || clean(clip.lighting) || clean(clip.continuityLock?.lighting))
    .replace(/\s*\(identical set[^)]*\)?/, '').replace(/,?\s*consistent across clips/i, '').trim();
  const names = charactersInClip(clip, opts.knownCharacters || []);
  const cam: CameraShot = opts.camera || {
    kind: 'medium', framing: '', movement: '', size: names.length > 1 ? 'WS' : 'MS', angle: 'eye',
    subject: names[0] || '', staging: {}, moving: false
  };
  const main = cam.subject || names[0] || '';
  const others = names.filter(n => n !== main);
  const close = ['CU', 'MCU', 'MS'].includes(cam.size);
  const backTurned = (n: string) => (n === main && (cam.angle === 'rear' || cam.angle === 'rear34')) || (cam.angle === 'ots' && n === cam.partner);

  // 1-2. Character reference + costume
  const photoNames = withPhotoIn(names, opts);
  const order = photoNumbers(photoNames, opts);
  const sortedPhotos = [...photoNames].sort((a, b) => (order.get(a) || 0) - (order.get(b) || 0));
  const noPhoto = names.filter(n => !photoNames.includes(n));
  const refParts: string[] = [];
  if (sortedPhotos.length) refParts.push(`${sortedPhotos.map(n => `รูปที่ ${order.get(n)} = ${n}`).join(', ')} — ใช้ภาพที่ผูกกับหมายเลขเป็นภาพอ้างอิงหลักของแต่ละคน รักษาใบหน้าและโครงหน้าตามต้นฉบับ`);
  if (noPhoto.length) refParts.push(`${noPhoto.map(n => `${n}${opts.characterNotes?.[n] ? ` (${opts.characterNotes[n]})` : ''}`).join(', ')} — ยังไม่มีภาพอ้างอิง`);
  refParts.push('ห้ามสลับหน้าระหว่างตัวละคร ห้ามเพิ่มตัวละครอื่นที่ไม่มีในบท');
  const costume = sortedPhotos.length
    ? 'ทรงผม สีผม เสื้อผ้า สีชุด เนื้อผ้า ลวดลาย รองเท้า และเครื่องประดับของแต่ละคนตามภาพอ้างอิง ห้ามเปลี่ยนชุด ห้ามสลับเสื้อผ้าระหว่างตัวละคร'
    : 'ชุดและทรงผมของแต่ละคนเหมือนเดิมทุกภาพ ห้ามสลับเสื้อผ้าระหว่างตัวละคร';
  const animal = /anthropomorphic|animal|reptile|gecko|lizard|buffalo|creature|สัตว์|เกล็ด|ตุ๊กแก|ตัวเหี้ย|กิ้งก่า|ควาย/i
    .test(names.map(n => opts.characterNotes?.[n] || '').join(' '));

  // 4-5. Camera direction + shot size (the script's own words first, word for word)
  const direction = [
    cam.scriptText ? `ตามบท "${cam.scriptText}"` : '',
    ANGLE_TEXT[cam.angle](main, cam.partner),
    cam.angle !== 'eye' && cam.angle !== 'high' && cam.angle !== 'low' ? 'ระดับกล้องเท่าสายตา' : ''
  ].filter(Boolean).join(' — ');
  const sizeText = cam.kind === 'insert' && cam.prop
    ? `ภาพระยะใกล้ (Close-up) ที่${cam.prop}${main ? `ในมือ${main}` : ''} เห็นมือและ${cam.prop}ชัด`
    : SIZE_TEXT[cam.size](main || 'ตัวละครหลัก');
  const secondary = close && others.length
    ? `ตัวละครรอง (${others.join(', ')}) ปรากฏเพียงบางส่วนหรืออยู่ฉากหลังได้ ไม่ต้องเห็นเต็มตัว`
    : '';

  // 6. Position and action per character
  const poseOf = (n: string) => startPoses.find(p => p?.name === n);
  const lines = (clip.dialogues || []).filter(d => String(d?.line || '').trim() && !isEmptyLine(d?.line));
  const speaker = String(lines[0]?.speaker || '').trim();
  const lookAt = (n: string): string => {
    const m = action.match(new RegExp(`${n}[^\\s]*?มอง(?:ไปที่|ไปยัง|หา)?(${names.filter(x => x !== n).join('|') || '$^'})`));
    if (m) return m[1];
    const g = clean(poseOf(n)?.gesture).match(new RegExp(`มอง(?:ไปที่|ไปยัง|หา)?(${names.filter(x => x !== n).join('|') || '$^'})`));
    if (g) return g[1];
    return speaker && n !== speaker && names.includes(speaker) ? speaker : '';
  };
  const depthOf = (n: string) => (cam.size === 'WS' || cam.size === 'EWS')
    ? 'ฉากกลาง'
    : n === main ? 'ฉากหน้า' : (cam.angle === 'ots' && n === cam.partner ? 'ฉากหน้า (ไหล่และด้านหลังศีรษะ เบลอเล็กน้อย)' : 'ฉากหลัง');
  const facingOf = (n: string) => {
    if (backTurned(n)) return 'หันหลังให้กล้อง';
    if (n === main && cam.angle === 'side') return 'หันข้างให้กล้อง';
    return '';
  };
  const staging = names.map(n => {
    const p = poseOf(n);
    // carried from the previous clip's end: whoever was walking has stopped by now
    const posture = p ? (POSTURE_TH[p.posture === 'walking' && !p.entering ? 'standing' : (p.posture || '')] || '') : '';
    const bits = [
      cam.staging?.[n] || '',
      depthOf(n),
      facingOf(n),
      posture,
      clean(p?.place) ? `ที่${clean(p?.place).replace(/^ที่/, '')}` : '',
      lookAt(n) ? `มองไปที่${lookAt(n)}` : '',
      clean(p?.holding) ? `ถือ${clean(p?.holding).replace(/^ถือ/, '')}` : '',
      clean(p?.gesture) && !/^มอง/.test(clean(p?.gesture)) ? clean(p?.gesture) : ''
    ].filter(Boolean);
    return `${n}: ${bits.join(', ')}`;
  });
  const setPiece = action.match(/(ประตู|หน้าต่าง|บันได|โต๊ะ|โซฟา|รถ|เตียง|ราวบันได)/)?.[1];
  const moment = action
    ? `จังหวะในภาพตามบท: ${action}${cam.moving ? ' (แสดงเป็นจังหวะกำลังเคลื่อนไหว เช่น กำลังก้าว ไม่ใช่ยืนโพสนิ่ง)' : ''}${setPiece ? ` ให้เห็นบริเวณ${setPiece}ในองค์ประกอบภาพเท่าที่ระยะกล้องอนุญาต` : ''}`
    : '';
  const expression = names.length
    ? (names.some(backTurned) ? 'ตัวละครที่หันหลังแสดงอารมณ์ผ่านท่าทางและภาษากาย ' : '') + 'สีหน้าและอารมณ์ตรงกับเหตุการณ์ ทุกคนปิดปาก ยังไม่พูด'
    : '';

  // 7. Scene continuity / location and light
  const where = [place.location, place.timeOfDay ? `เวลา ${place.timeOfDay}` : ''].filter(Boolean).join(' ');
  const locationLock = where
    ? `${where} — ผังห้อง ประตู หน้าต่าง บันได เครื่องเรือน ตำแหน่งและทิศทางแสง โทนสีและบรรยากาศ เหมือนเดิมทุกภาพของสถานที่และช่วงเวลานี้ เปลี่ยนได้เฉพาะมุมมองของกล้อง ห้ามสร้างสถานที่ใหม่${lighting ? `. แสง: ${lighting}` : ''}`
    : (lighting ? `แสง: ${lighting}` : '');
  const continuity = continuous && prev
    ? 'ต่อเนื่องจากภาพของคลิปก่อนหน้า ตัวละครอยู่ตำแหน่งเดิม ชุดเดิม ฉากเดิม'
    : (prev ? 'เริ่มฉากใหม่ตามบท' : '');

  const sections: [string, string][] = [
    ['Character Reference Lock', names.length ? refParts.join('. ') + (animal ? '. ตัวละครที่เป็นสัตว์ต้องเป็นสัตว์ตามภาพ ห้ามกลายเป็นมนุษย์' : '') : ''],
    ['Costume Lock', names.length ? costume : ''],
    ['Location & Lighting Lock', locationLock],
    ['Camera Direction Lock', direction],
    ['Shot Size Lock', [sizeText, secondary].filter(Boolean).join('. ')],
    ['Character Position & Action', [staging.join(' | '), moment, expression].filter(Boolean).join('. ')],
    ['Scene Continuity', continuity],
    ['Photorealistic Cinematic Quality', `ภาพนิ่ง${opts.aspectRatio ? ` สัดส่วน ${opts.aspectRatio}` : ''} ภาพถ่ายสมจริงแบบฉากในภาพยนตร์ ไม่ใช่ภาพวาดหรือการ์ตูน ไม่มีตัวหนังสือ ซับไตเติล หรือลายน้ำในภาพ`]
  ];
  const priority = 'ลำดับความสำคัญ: มุมกล้อง ระยะภาพ ตัวละคร และท่าทาง เป็นข้อบังคับหลัก ความสวยงามต้องไม่ทำให้ละเมิดข้อบังคับเหล่านี้ ห้ามขยายภาพจากครึ่งตัวเป็นเต็มตัวเพื่อให้เห็นทุกคน ห้ามหมุนตัวละครจากด้านหลังมาเป็นด้านหน้าเพื่อให้เห็นใบหน้า ห้ามคิดท่าทางใหม่ที่ไม่ตรงบท หากขัดแย้งกันให้รักษามุมกล้องของตัวละครหลัก';
  return tidy(sections.filter(([, v]) => v).map(([k, v]) => `${k}: ${v.replace(/[.\s]+$/, '')}`).join('. ') + '. ' + priority + '.')
    .replace(/(?:เวลา|สถานที่)\s*ไม่ระบุ(?:จากต้นฉบับ)?[,.]?\s*/g, '');
}

/**
 * Contradictions in an image prompt that would make the model ignore the camera
 * (empty = consistent). Used by the tests on every clip.
 */
export function imagePromptProblems(img: string, cam?: CameraShot): string[] {
  const out: string[] = [];
  if (!cam) return out;
  if (['CU', 'MCU', 'MS'].includes(cam.size) && /(Full Shot|ภาพเต็มตัว \(|ศีรษะถึงเท้า)/.test(img)) out.push('ระยะใกล้แต่สั่งเต็มตัว');
  if ((cam.angle === 'rear' || cam.angle === 'rear34') && new RegExp(`${cam.subject}: [^|]*หันหน้า`).test(img)) out.push('มุมหลังแต่สั่งหันหน้า');
  if (cam.size === 'MS' && !/ห้ามเห็นขาหรือรองเท้า/.test(img)) out.push('ครึ่งตัวไม่ได้ห้ามเห็นขา');
  if (/ขณะพูด/.test(img)) out.push('ภาพนิ่งแต่สั่งให้พูด');
  for (const label of ['Camera Direction Lock', 'Shot Size Lock', 'Photorealistic Cinematic Quality']) if (!img.includes(label + ':')) out.push(`ไม่มี ${label}`);
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
  const core = sections.find(s => s.label === 'Core action' || s.label === 'Scene Action' || s.label === 'Script action');
  const coreBody = core ? sectionBody(core.text, core.label) : '';

  // Character Lock -> uploaded photo mapping, placed where the lock was
  const names = charactersInClip(clip, opts.knownCharacters || []);
  const lockCut = removeSections(prompt, s => s.label === 'Character Lock');
  prompt = lockCut.prompt;
  if (names.length > 0) {
    const block = identityBlock(names, opts, 'video');
    prompt = lockCut.firstIndex >= 0 ? insertBlock(prompt, lockCut.firstIndex, block) : `${block}. ${prompt}`;
  }

  // What already happened in the previous clip of the same place (its start is carried by the pose lock)
  const squashed = (t: string) => String(t || '').replace(/กำลัง/g, '').replace(/[\s"'“”‘’.,!?…:;()\[\]\-–—~]/g, '');
  const prevSamePlace = !!opts.previous && (() => {
    const a = ownPlace(clip).location || opts.inheritedPlace?.location || '';
    const b = opts.previous!.place.location;
    return !a || !b || samePlace(a, b);
  })();
  const prevText = prevSamePlace ? squashed(opts.previous!.clip.generatedPrompt || '') : '';

  // Internal continuity blocks and repeats of the core action
  prompt = removeSections(prompt, s => {
    if (DROP_LABELS.has(s.label)) return true;
    if (s.label === 'Starting moment' && prevText) {
      const b = squashed(sectionBody(s.text, s.label));
      if (b.length >= 6 && prevText.includes(b)) return true;
    }
    if ((s.label === 'Starting moment' || s.label === 'Ending momentum') && coreBody) {
      // the same action again (only "กำลัง" added) would be played twice
      return squashed(coreBody).includes(squashed(sectionBody(s.text, s.label)));
    }
    return false;
  }).prompt;

  // Never pass "unspecified" placeholders to the video model
  prompt = prompt.replace(/(?:เวลา|สถานที่)\s*ไม่ระบุ(?:จากต้นฉบับ)?[,.]?\s*/g, '').replace(/[,/\-–—]?\s*ไม่ระบุ(?:จากต้นฉบับ)?/g, '');

  // Location Lock: this clip's place, else the one carried from earlier clips of the same scene
  const place = (() => {
    const own = ownPlace(clip);
    return {
      location: own.location || opts.inheritedPlace?.location || '',
      timeOfDay: own.timeOfDay || opts.inheritedPlace?.timeOfDay || ''
    };
  })();
  // Camera: the user's "[มุมกล้อง …]" note becomes the camera line, never an action
  prompt = prompt.replace(/\s*\[มุมกล้อง\s+[^\]]+\]\s*/g, ' ')
    .replace(/,?\s*35mm lens, photorealistic film still/g, ', photorealistic cinematic video, natural motion');
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
  if (carried) lockLines.push(`ท่าเริ่มคลิป (ต่อเนื่องจากคลิปก่อน ตำแหน่งเดิมเป๊ะ ห้ามเล่นเหตุการณ์ของคลิปก่อนซ้ำ): ${carried}`);
  else if (own) lockLines.push(prev && !continuous ? `เปลี่ยนสถานที่ ท่าเริ่มคลิป: ${own}` : `ท่าเริ่มคลิป: ${own}`);
  if (end || clean(clip.endAction)) {
    lockLines.push(`ท่าจบคลิป (ค้างไว้ส่งต่อคลิปถัดไป): ${end || clean(clip.endAction)}`);
  }

  const hasDialogue = (clip.dialogues || []).some(d => String(d?.line || '').trim() && !isEmptyLine(d?.line));
  const head: string[] = [];
  if (clip.durationSeconds) head.push(`วิดีโอยาว ${clip.durationSeconds} วินาที`);
  if (opts.aspectRatio) head.push(`สัดส่วนภาพ ${opts.aspectRatio}`);
  const tail: string[] = [];
  if (hasDialogue) tail.push('ตัวละครพูดภาษาไทยตามบทพูดด้านบนคำต่อคำ ปากขยับตรงกับเสียง ไม่พูดประโยคอื่นเพิ่ม');
  // One speaker: everyone else keeps their mouth closed (the video model makes the whole cast talk)
  const speakers = Array.from(new Set((clip.dialogues || []).filter(d => String(d?.line || '').trim() && !isEmptyLine(d?.line)).map(d => String(d?.speaker || '').trim()).filter(Boolean)));
  if (speakers.length === 1 && names.some(n => n !== speakers[0])) tail.push(`เฉพาะ${speakers[0]}ที่ขยับปากพูด ตัวละครอื่นปิดปาก ไม่พูดตาม`);
  else tail.push('ไม่มีบทพูดในคลิปนี้ ตัวละครไม่พูด');
  tail.push('ไม่มีตัวหนังสือ ซับไตเติล หรือลายน้ำบนจอ');

  const body = ensureDialoguesInPrompt(dropEmptyCues(tidy(prompt)), clip.dialogues).replace(/[.;\s]+$/, '');
  const camLine = cameraLine(opts.camera, 'video', opts.aspectRatio);
  return tidy([head.join(', '), ...lockLines.slice(0, 1), camLine, body, ...lockLines.slice(1), ...tail].filter(Boolean).map(s => s.replace(/[.\s]+$/, '')).join('. ') + '.');
}

export function formatAllClipsForMetaAi(clips: ClipForMeta[], opts: MetaAiFormatOptions = {}): string {
  return clips.map((c, i) => {
    const names = withPhotoIn(charactersInClip(c, opts.knownCharacters || []), opts);
    const nums = photoNumbers(names, opts);
    const photos = names.length > 0
      ? `\n(อัปโหลดรูป: ${[...names].sort((a, b) => (nums.get(a) || 0) - (nums.get(b) || 0)).map(n => `รูปที่ ${nums.get(n)} ${n}`).join('  ')})`
      : '';
    return `=== คลิป ${c.clipNumber || i + 1}/${clips.length} — ${String(c.title || '').replace(/\s*[-–—/]?\s*ไม่ระบุ(?:จากต้นฉบับ)?/g, '').trim()} ===${photos}\n${formatClipForMetaAi(c, { ...opts, ...metaContextFor(clips, i) })}`;
  }).join('\n\n');
}
