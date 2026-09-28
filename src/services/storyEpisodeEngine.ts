/**
 * Story Episode Engine (offline parser + deterministic episode builder)
 * --------------------------------------------------------------------
 * Pure functions (no Express / Firebase imports) so they can be unit-tested
 * with `npx tsx` and imported by server.ts.
 *
 * - Strips chat preamble/trailer text that often wraps AI-written scripts.
 * - Splits one scene per "ฉากที่ N" / "ฉาก N" / "Scene N" header block
 *   (count-chunking is only used when the story has no scene headers).
 * - Uses the heading's own location / time of day.
 * - Extracts speakers without gluing speech verbs to names and keeps
 *   off-screen voices (เสียงปริศนา / เสียง…) out of the locked character list.
 * - Slices scenes per episode instead of re-splitting the whole story.
 */
import {
  isReservedSystemKeyword,
  isMetadataKeyword,
  deriveScenePhysicalStates,
  SPEECH_VERBS
} from './salaDirectorEngine';

import {
  analyzeClipContinuity,
  formatContinuityForPrompt,
  sceneWarningsFor,
  checkStoryRepeats,
  lightingForTime,
  formatLocationLock,
  normalizePoseList,
  type CharacterPoseState,
  type ContinuityWarning,
  type LocationLock
} from './continuityEngine';
import {
  resolveCharacterProfiles,
  formatCharacterAppearanceLock,
  mergeDeclaredCharacters,
  type ResolvedCharacterProfile
} from './characterAppearance';

export { SPEECH_VERBS };

export interface StoryDialogue {
  speaker: string;
  emotionOrAction?: string;
  dialogue: string;
  offScreen?: boolean;
}

export interface StoryBeat {
  type: 'action' | 'dialogue';
  text: string;
  dialogue?: StoryDialogue;
}

export interface ParsedStoryScene {
  sceneNumber: number;
  heading: string;
  location: string;
  timeOfDay: string;
  /** Title / mood part of the heading (e.g. "คืนดีกัน"), '' when the heading is a place. */
  title?: string;
  /** True when location/time were inherited from the previous scene. */
  inheritedLocation?: boolean;
  beats: StoryBeat[];
}

export interface ParsedStoryStructure {
  metadata: Record<string, string>;
  /** Locked (on-screen) characters: declared first, then inferred from dialogue. */
  characters: { name: string; description: string; declared: boolean }[];
  /** Off-screen voices such as "เสียงปริศนา" (never locked as characters). */
  offScreenSpeakers: string[];
  narrativeBeats: StoryBeat[];
  allDialogues: (StoryDialogue & { beatIndex: number })[];
  /** Scene blocks from explicit headers. Empty when the story has no headers. */
  scenes: ParsedStoryScene[];
  hasSceneHeaders: boolean;
}

export const UNSPECIFIED = 'ไม่ระบุจากต้นฉบับ';


const SPEAKER_STOPWORDS = new Set([
  'แล้ว', 'จึง', 'ก็', 'และ', 'เขา', 'เธอ', 'มัน', 'ทุกคน', 'พวกเขา', 'ทั้งสอง', 'ใคร', 'เสียง'
]);

const TIME_WORD_REGEX = /(กลางคืน|ตอนกลางคืน|ยามค่ำคืน|ค่ำคืน|หัวค่ำ|พลบค่ำ|ค่ำ|ดึก|เที่ยงคืน|กลางวัน|ตอนกลางวัน|เที่ยงวัน|เที่ยง|บ่าย|เช้าตรู่|รุ่งเช้า|รุ่งสาง|ตอนเช้า|ยามเช้า|เช้า|ยามเย็น|ตอนเย็น|เย็น|สายัณห์|night|day|dawn|dusk|morning|evening|noon|midnight)/i;

const SCENE_HEADER_REGEX = /^(?:#{1,6}\s*)?[*_\[【(]*\s*(?:ฉากที่|ฉาก|Scene|SCENE|scene)\s*(\d{1,3})\s*[*_\]】)]*\s*(?:[:：.\-–—]\s*)?(.*)$/;

const CHAT_LINE_REGEX = /^(?:ได้(?:เลย)?(?:ครับ|ค่ะ|คะ)|แน่นอน|นี่คือ|นี่เป็น|ต่อไปนี้คือ|ด้านล่างนี้|ผม(?:ได้)?(?:เขียน|จัด|ทำ)|ฉัน(?:ได้)?(?:เขียน|จัด|ทำ)|หวังว่า|ถ้า(?:จะ|ต้องการ|อยาก|คุณ)|หาก(?:ต้องการ|อยาก|คุณ|จะ)|ต้องการให้|อยากให้|บอกได้|แจ้งได้|สามารถ(?:นำ|บอก|แจ้ง|ปรับ)|รูปแบบ\s*[:：]|หมายเหตุ\s*[:：]|Sure\b|Here(?:'s| is| are)\b|Of course\b|If you\b|Let me know\b|Hope this\b|Note\s*:)/i;
const CHAT_CONTENT_REGEX = /(Sala AI|บอกได้เลย|แจ้งได้เลย|ได้เลยนะ(?:ครับ|คะ|ค่ะ)|ให้ผม(?:ช่วย|ปรับ|เขียน)|ให้ฉัน(?:ช่วย|ปรับ|เขียน)|ต้องการปรับ|let me know)/i;
const SEPARATOR_REGEX = /^(?:[-=*_~]{3,}|```.*)$/;

const DURATION_REGEX = /\(\s*(?:ประมาณ|ราว|~)?\s*\d+(?:[.,]\d+)?\s*(?:วินาที|วิ|นาที|s|sec|secs|seconds?)\s*\)/gi;

/**
 * END-OF-STORY RULE (PROD-FIX2-0927)
 * The story is finished only when an ending marker appears in the FINAL part of the
 * text: the last scene block (after the last "ฉากที่ N" header) and, within it, only
 * its last ENDING_TAIL_LINES non-empty lines (the whole text's last lines when there
 * are no headers). Quoted dialogue is ignored ("จบเรื่องนี้กันเถอะ" said by a
 * character is not an ending). Markers:
 *   - anywhere in those lines: จบบริบูรณ์, จบเรื่อง, ตอนจบ, จบฉาก, จบตอน, บริบูรณ์, THE END
 *   - a stand-alone "จบ": a line that is only จบ / -จบ- / —จบ— / (จบ) / [จบ] / จบ. / END,
 *     or a line ending with " จบ" / " -จบ-".
 * The caller must also check that the source scenes are exhausted.
 */
export const ENDING_TAIL_LINES = 3;
const STRONG_ENDING_RE = /(จบบริบูรณ์|จบเรื่อง|ตอนจบ|จบฉาก|จบตอน|บริบูรณ์|THE\s*-?\s*END\b)/i;
const STANDALONE_ENDING_LINE_RE = /^[\s\-–—=~*_#.\[\](){}【】「」]*(?:จบ|END|FIN)[\s\-–—=~*_#.!\[\](){}【】「」]*$/i;
const TRAILING_ENDING_RE = /\s[\-–—\[(]*จบ[\-–—\])]*[.!]?\s*$/;

export function hasExplicitEndingMarker(text: string): boolean {
  if (!text) return false;
  const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  let lastHeader = -1;
  lines.forEach((l, i) => { if (SCENE_HEADER_REGEX.test(l)) lastHeader = i; });
  const lastBlock = lastHeader >= 0 ? lines.slice(lastHeader + 1) : lines;
  const block = lastBlock.length > 0 ? lastBlock : lines.slice(lastHeader);
  const tail = block.slice(-ENDING_TAIL_LINES)
    .map(l => l.replace(/["“”][^"“”]*["“”]|'[^']*'|‘[^’]*’/g, ' ').trim())
    .filter(Boolean);
  return tail.some(l => STRONG_ENDING_RE.test(l) || STANDALONE_ENDING_LINE_RE.test(l) || TRAILING_ENDING_RE.test(l));
}

/** Stand-alone marker text stripped from actions (never "จบฉากด้วย…" narrative text). */
const ENDING_MARKER_GLOBAL = /จบบริบูรณ์|จบเรื่อง|บริบูรณ์|THE\s*END|THE-END|[-–—]+\s*จบ\s*[-–—]+|\[จบ\]|\(จบ\)/gi;

export function isChatLine(line: string): boolean {
  const l = line.trim();
  if (!l) return true;
  if (SEPARATOR_REGEX.test(l)) return true;
  if (/["“”]/.test(l)) return false; // lines with quoted dialogue are story content
  if (CHAT_LINE_REGEX.test(l) || CHAT_CONTENT_REGEX.test(l)) return true;
  // Assistant-style sign-offs ending in polite particles, e.g. "ขอให้สนุกกับการสร้างวิดีโอนะครับ"
  return /^(?:ขอให้|ขอบคุณ|ยินดี)/.test(l) || /(?:นะ)(?:ครับ|คะ|ค่ะ)[!.\s]*$/.test(l);
}

/** True for voices that should not be locked as on-screen characters. */
export function isOffScreenSpeaker(name: string): boolean {
  if (!name) return false;
  const n = name.trim();
  return /^เสียง/.test(n) || /^(?:ผู้บรรยาย|คนบรรยาย|บรรยาย|narrator|voice|v\.?o\.?)\b/i.test(n) || /\((?:O\.?S\.?|V\.?O\.?)\)/i.test(n);
}

/**
 * Normalizes a raw speaker label: strips markup, parentheticals and speech-verb
 * suffixes ("น้องฟ้าใสกระซิบ" -> "น้องฟ้าใส") and maps to a declared character when possible.
 */
export function normalizeSpeakerName(raw: string, declaredNames: string[] = []): string {
  if (!raw) return '';
  let s = raw
    .replace(/[*_#"“”'`\[\]【】]/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/^[-•\s]+/, '')
    .replace(/[:：]+$/, '')
    .trim();
  if (!s) return '';

  // Declared characters win (longest name first so "น้องฟ้าใส" beats "ฟ้าใส").
  const declared = [...declaredNames].filter(Boolean).sort((a, b) => b.length - a.length);
  const exact = declared.find(d => d === s);
  if (exact) return exact;
  const startsWith = declared.find(d => s.startsWith(d));
  if (startsWith) return startsWith;

  if (isOffScreenSpeaker(s)) {
    // Keep the voice label but drop verbs: "เสียงปริศนากระซิบ" -> "เสียงปริศนา"
    return stripSpeechVerbs(s);
  }

  s = stripSpeechVerbs(s);
  // If there are still multiple words, the subject is normally the first word.
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) s = tokens[0];
  const contained = declared.find(d => s.includes(d));
  if (contained) return contained;
  return s.trim();
}

function stripSpeechVerbs(input: string): string {
  let s = input.trim();
  // Cut at the first speech verb that appears after at least 2 characters.
  let cut = -1;
  for (const v of SPEECH_VERBS) {
    const idx = s.indexOf(v);
    if (idx >= 2 && (cut === -1 || idx < cut)) cut = idx;
  }
  if (cut > 0) s = s.slice(0, cut);
  return s.replace(/\s*(?:ขึ้น|ออกมา|เบาๆ|เสียงดัง|ว่า)\s*$/, '').trim();
}

const ACTION_VERBS = ['เดิน', 'วิ่ง', 'ยืน', 'นั่ง', 'หัน', 'มอง', 'ก้าว', 'หยุด', 'ยก', 'จับ', 'คว้า', 'กอด', 'ชี้', 'ส่อง', 'ค่อยๆ', 'รีบ', 'พยัก', 'ส่าย', 'ถอย', 'เงย', 'ก้ม', 'ลุก', 'เปิด', 'ปิด', 'หยิบ', 'กำลัง'];

/** Returns the leading subject of a clause by cutting at the first action verb. */
function cutAtActionVerb(clause: string): string {
  const c = (clause || '').trim().split(/\s+/)[0] || '';
  let cut = -1;
  for (const v of ACTION_VERBS) {
    const idx = c.indexOf(v);
    if (idx >= 2 && (cut === -1 || idx < cut)) cut = idx;
  }
  return cut > 0 ? c.slice(0, cut) : c;
}

function isPlausibleSpeaker(name: string): boolean {
  if (!name) return false;
  const n = name.trim();
  if (n.length < 2 || n.length > 40) return false;
  if (/^\d+$/.test(n)) return false;
  if (SPEAKER_STOPWORDS.has(n)) return false;
  if (SPEECH_VERBS.some(v => n === v || n === v + 'ว่า')) return false;
  if (isReservedSystemKeyword(n) || isMetadataKeyword(n)) return false;
  return true;
}

/** Splits a declared-characters list. Fixed from the char-class bug `[,、/และ&]+`. */
export function splitCharacterList(raw: string): string[] {
  return raw
    .split(/,|、|\/|และ|&|，/)
    .map(s => s.replace(/\([^)]*\)/g, '').trim())
    .filter(Boolean);
}

/**
 * Extracts a location after a standalone particle (ใน / ที่ / ณ).
 * The particle must start a word (so the "ณ" at the end of "ประมาณ" never matches)
 * and number-only / duration captures such as "10" are rejected.
 */
export function extractLocationFromText(text: string): string {
  if (!text) return '';
  const cleaned = text.replace(DURATION_REGEX, ' ');
  const re = /(?:^|[\s(,"“])(?:ใน|ที่|ณ)\s*([ก-๙a-zA-Z][ก-๙a-zA-Z0-9_\-]*?)(?=กลางคืน|ตอนกลางคืน|ยามค่ำคืน|ค่ำคืน|กลางวัน|ตอนกลางวัน|เช้าตรู่|ตอนเช้า|ยามเช้า|ยามเย็น|ตอนเย็น|ดึก|\s|$|[.,)"”])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const cand = (m[1] || '').trim();
    if (isValidLocationCandidate(cand)) return cand;
  }
  return '';
}

export function isValidLocationCandidate(cand: string): boolean {
  if (!cand) return false;
  const c = cand.trim();
  if (c.length < 2) return false;
  if (/^[\d\s.,:]+$/.test(c)) return false;
  if (/^\d/.test(c)) return false;
  if (/(?:วินาที|นาที|ชั่วโมง|seconds?|sec)$/i.test(c)) return false;
  if (TIME_WORD_REGEX.test(c) && c.replace(TIME_WORD_REGEX, '').length < 2) return false;
  const stop = ['การ', 'ความ', 'การที่', 'นั่น', 'นี่', 'นี้', 'นั้น', 'ไหน', 'สุด', 'จริง', 'ขณะ', 'ระหว่าง', 'ตอน', 'เวลา', 'ที่สุด', 'ทันที', 'ใจ'];
  if (stop.includes(c)) return false;
  if (isReservedSystemKeyword(c) || isMetadataKeyword(c)) return false;
  return true;
}

export function detectTimeOfDay(text: string): string {
  if (!text) return '';
  if (/(ตอนกลางคืน|ยามค่ำคืน|ค่ำคืน|กลางคืน|ดึก|เที่ยงคืน|night|midnight)/i.test(text)) return 'กลางคืน';
  if (/(เช้าตรู่|รุ่งเช้า|รุ่งสาง|ยามเช้า|แสงแรก|ตอนเช้า|ช่วงเช้า|dawn|morning)/i.test(text)) return 'เช้าตรู่';
  if (/(กลางวัน|ตอนกลางวัน|เที่ยงวัน|บ่าย|noon|\bday\b)/i.test(text)) return 'กลางวัน';
  if (/(ยามเย็น|ตอนเย็น|ช่วงเย็น|เวลาเย็น|พระอาทิตย์ตก|สายัณห์|หัวค่ำ|พลบค่ำ|dusk|evening)/i.test(text)) return 'ยามเย็น';
  return '';
}

/** Words that make a heading part a real place ("หน้าบ้าน", "ห้องนอน", "แคมป์ในป่า" …). */
const LOCATION_NOUN_REGEX = /(บ้าน|ห้อง|ร้าน|ตลาด|โรงเรียน|โรงพยาบาล|โรงแรม|โรงงาน|ป่า|ถนน|ซอย|สวน|วัด|ทะเล|ชายหาด|หาด|แม่น้ำ|ริมน้ำ|คลอง|ภูเขา|ทุ่ง|ไร่|แคมป์|เต็นท์|ออฟฟิศ|สำนักงาน|บริษัท|คาเฟ่|สถานี|ป้ายรถ|สนาม|ลาน|ระเบียง|ดาดฟ้า|ครัว|ประตู|หน้าต่าง|บันได|ทางเดิน|โถง|ศาลา|หมู่บ้าน|เมือง|วิหาร|ถ้ำ|สะพาน|ท่าเรือ|สนามบิน|มหาวิทยาลัย|ห้าง|หอพัก|คอนโด|ลิฟต์|รถ|เรือ|ชายป่า|โต๊ะ|เวที|\broom\b|house|home|street|road|cafe|office|school|forest|park|beach|kitchen|bedroom|hall|station|market|temple|village|city|interior|exterior|\bINT\b|\bEXT\b)/i;
/** Words that make a heading part a title / mood ("อารมณ์เริ่มตึงเครียด", "คืนดีกัน" …), not a place. */
const TITLE_MOOD_REGEX = /(อารมณ์|ความรู้สึก|ตึงเครียด|เครียด|คืนดี|ดีกัน|ง้อ|หึง|ทะเลาะ|เริ่ม|บทสรุป|ตอนจบ|สรุป|ความจริง|เปิดใจ|สารภาพ|ขอโทษ|ให้อภัย|เข้าใจกัน|โกรธ|เสียใจ|ดีใจ|ตกใจ|ประทับใจ|ซึ้ง|อบอุ่น|หัวเราะ|ร้องไห้|ไคลแม็กซ์|จุดเปลี่ยน|บทนำ|เปิดเรื่อง|ความลับ|เผชิญหน้า|climax|ending|intro|mood|tension|reconcil)/gi;
/** "หน้าบ้านต่อเนื่อง", "หน้าบ้าน (ต่อ)", "หน้าบ้าน continued" -> "หน้าบ้าน" */
const CONTINUATION_SUFFIX_REGEX = /(?:\s*\(\s*(?:ต่อเนื่อง|ต่อ|continued|cont'?d?)\s*\)|\s*ต่อเนื่อง|\s+(?:ต่อ|continued|cont'?d?))\s*$/i;

export interface SceneHeadingInfo {
  location: string;
  timeOfDay: string;
  /** Title / mood text of the heading when it is not a place (e.g. "คืนดีกัน"). */
  title: string;
  /** True for "…ต่อเนื่อง" / "(ต่อ)" headings: same place and time as the previous scene. */
  continued: boolean;
}

function isLocationLike(p: string): boolean {
  const withoutMood = p.replace(TITLE_MOOD_REGEX, ' ');
  return LOCATION_NOUN_REGEX.test(withoutMood) || /^(?:ใน|ที่|ณ)\s*\S/.test(p);
}
function isMoodLike(p: string): boolean {
  TITLE_MOOD_REGEX.lastIndex = 0;
  const r = TITLE_MOOD_REGEX.test(p);
  TITLE_MOOD_REGEX.lastIndex = 0;
  return r;
}

/**
 * Normalizes a location coming from any source (Gemini JSON, split scenes):
 * strips "…ต่อเนื่อง" / "(ต่อ)" and reports whether the value is a title/mood instead of a place.
 */
export function normalizeSceneLocation(raw: string): { location: string; continued: boolean; isTitle: boolean } {
  let location = String(raw || '').trim();
  const continued = CONTINUATION_SUFFIX_REGEX.test(location);
  if (continued) location = location.replace(CONTINUATION_SUFFIX_REGEX, '').trim();
  const isTitle = !!location && isMoodLike(location) && !isLocationLike(location);
  return { location, continued, isTitle };
}

/**
 * Parses "แคมป์ในป่า - กลางคืน (ประมาณ 10 วินาที)" into location + time.
 * Title / mood headings ("อารมณ์เริ่มตึงเครียด", "คืนดีกัน") are returned as `title`
 * with an empty location so the caller can inherit the previous scene's place/time.
 * `hasPreviousLocation` = a previous scene already set a place (unknown single phrases
 * are then treated as titles instead of new places).
 */
export function parseSceneHeading(rest: string, hasPreviousLocation = false): SceneHeadingInfo {
  let r = (rest || '').replace(DURATION_REGEX, ' ').replace(/\((?!\s*(?:ต่อ|cont))[^)]*\)/gi, ' ').replace(/[*_]/g, '').trim();
  r = r.replace(/^[:：.\-–—\s]+/, '').replace(/[:：.\s]+$/, '');
  const empty: SceneHeadingInfo = { location: '', timeOfDay: '', title: '', continued: false };
  if (!r) return empty;
  let continued = false;
  if (CONTINUATION_SUFFIX_REGEX.test(r)) {
    continued = true;
    r = r.replace(CONTINUATION_SUFFIX_REGEX, '').trim();
  }
  const parts = r.split(/\s+[-–—|]\s+|\s*[|/]\s*|\s+[-–—]|[-–—]\s+/).map(p => p.trim()).filter(Boolean);
  let location = '';
  let timeOfDay = '';
  const titleParts: string[] = [];
  const unknownParts: string[] = [];
  for (const p0 of parts) {
    let p = p0;
    if (CONTINUATION_SUFFIX_REGEX.test(p)) { continued = true; p = p.replace(CONTINUATION_SUFFIX_REGEX, '').trim(); }
    if (!p) continue;
    const isTime = TIME_WORD_REGEX.test(p) && p.replace(TIME_WORD_REGEX, '').replace(/^(ตอน|ยาม|ช่วง)/, '').trim().length < 3;
    if (isTime && !timeOfDay) { timeOfDay = p; continue; }
    if (!location && isLocationLike(p) && isValidLocationCandidate(p)) { location = p; continue; }
    if (isMoodLike(p)) { titleParts.push(p); continue; }
    unknownParts.push(p);
  }
  // Unknown phrase (no place word, no mood word): a place only when nothing else can be the place
  // — i.e. first scene, or the heading also gives a time ("ห้วยขาแข้ง - กลางคืน").
  if (!location && unknownParts.length > 0) {
    const cand = unknownParts[0];
    if ((!hasPreviousLocation || timeOfDay) && isValidLocationCandidate(cand)) {
      location = cand;
      unknownParts.shift();
    }
  }
  titleParts.push(...unknownParts);
  if (location) location = location.replace(/^(?:ใน|ที่|ณ)\s*/, '').trim();
  return { location, timeOfDay, title: titleParts.join(' - '), continued };
}

const META_TAG_REGEX = /^(?:ชื่อเรื่อง|เรื่อง|TITLE|แนว|ประเภท|GENRE|เวลา|ช่วงเวลา|TIME|สถานที่|สถานที่หลัก|LOCATION|ธีม|MOOD|TONE|มุมมอง|สไตล์|STYLE)\s*[:：=]\s*(.*)$/i;
const CHAR_BLOCK_HEADER_REGEX = /^(?:ตัวละคร(?:หลัก)?|รายชื่อตัวละคร|CHARACTERS?)\s*[:：=]?\s*(.*)$/i;
const CHAR_BULLET_REGEX = /^(?:[-*•]|\d+[.)])\s*([ก-๙a-zA-Z0-9_\- ]+?)\s*(?:\(([^)]*)\))?\s*[:：\-–—]\s*(.*)$/;
const SCENE_LABEL_REGEX = /^\(?\s*(?:เริ่มต้น|การกระทำ|แอ็กชัน|แอคชั่น|action|ภาพ|บรรยาย|รายละเอียด|สิ้นสุดฉาก|จบฉาก|ตำแหน่ง(?:ตัวละคร)?|มุมกล้อง|กล้อง|camera|เสียงประกอบ|sfx|บรรยากาศ|หมายเหตุ)\s*[:：]\s*(.*?)\)?$/i;

interface LineParseContext {
  declared: string[];
}

/** Parses one story line into beats (action and/or dialogue). */
function parseStoryLine(line: string, nextLine: string | undefined, ctx: LineParseContext): { beats: StoryBeat[]; consumedNext: boolean } {
  const beats: StoryBeat[] = [];
  let l = line.replace(/^[-*•]\s+/, '').trim();
  if (!l) return { beats, consumedNext: false };

  // Scene sub-labels: "(เริ่มต้น: ...)", "การกระทำ: ..." -> action text without the label
  const labelMatch = l.match(SCENE_LABEL_REGEX);
  if (labelMatch && !/["“”]/.test(l)) {
    const t = (labelMatch[1] || '').trim();
    if (t) beats.push({ type: 'action', text: t });
    return { beats, consumedNext: false };
  }

  const makeDialogue = (rawSpeaker: string, emotion: string, text: string, sourceText: string): StoryBeat | null => {
    const speaker = normalizeSpeakerName(rawSpeaker, ctx.declared);
    if (!isPlausibleSpeaker(speaker) || !text.trim()) return null;
    const offScreen = isOffScreenSpeaker(speaker);
    // Keep the speech verb that was attached to the name as the delivery note.
    let delivery = (emotion || '').trim();
    if (!delivery) {
      const verbPart = rawSpeaker.replace(/[*_"“”]/g, '').trim().slice(speaker.length).trim();
      if (verbPart && verbPart.length <= 30) delivery = verbPart.replace(/ว่า$/, '').trim();
    }
    // Neutral verbs ("พูด", "บอก" …) carry no delivery information.
    if (/^(?:พูด|บอก|กล่าว|เอ่ย|ตอบ|ว่า)$/.test(delivery)) delivery = '';
    const emotionOrAction = [delivery ? `(${delivery.replace(/^\(|\)$/g, '')})` : '', offScreen ? '(เสียงนอกจอ / off-screen)' : '']
      .filter(Boolean).join(' ');
    return {
      type: 'dialogue',
      text: sourceText,
      dialogue: { speaker, emotionOrAction, dialogue: text.trim(), ...(offScreen ? { offScreen: true } : {}) }
    };
  };

  // Multi-line dialogue: "Speaker:" then a quote-only line
  const headerOnly = l.match(/^([ก-๙a-zA-Z0-9_\- ]{2,40}?)\s*(?:\(([^)]*)\))?\s*[:：]$/);
  if (headerOnly && nextLine && /^["“][^"”]+["”]$/.test(nextLine.trim())) {
    const q = nextLine.trim().replace(/^["“]|["”]$/g, '');
    const b = makeDialogue(headerOnly[1], headerOnly[2] || '', q, `${headerOnly[1].trim()}: "${q}"`);
    if (b) return { beats: [b], consumedNext: true };
  }

  // Single-line: Speaker (emotion): "quote"   or   Speaker: quote (declared speakers only)
  const single = l.match(/^([ก-๙a-zA-Z0-9_\- ]{2,40}?)\s*(?:\(([^)]*)\))?\s*[:：]\s*["“]([^"”]+)["”]\s*(.*)$/);
  if (single) {
    const b = makeDialogue(single[1], single[2] || '', single[3], l);
    if (b) {
      beats.push(b);
      const after = (single[4] || '').trim();
      if (after) beats.push({ type: 'action', text: after });
      return { beats, consumedNext: false };
    }
  }
  const unquoted = l.match(/^([ก-๙a-zA-Z0-9_\- ]{2,40}?)\s*(?:\(([^)]*)\))?\s*[:：]\s*(.+)$/);
  if (unquoted) {
    const sp = normalizeSpeakerName(unquoted[1], ctx.declared);
    if (ctx.declared.includes(sp) || isOffScreenSpeaker(sp)) {
      const b = makeDialogue(unquoted[1], unquoted[2] || '', unquoted[3], l);
      if (b) return { beats: [b], consumedNext: false };
    }
  }

  // Inline quote: "<before> <Speaker><verb> "quote" <after>"
  const inline = l.match(/^(.*?)["“]([^"”]+)["”]\s*(.*)$/);
  if (inline && inline[2].trim()) {
    const pre = inline[1].replace(/[:：,]\s*$/, '').trim();
    const quote = inline[2].trim();
    const after = inline[3].trim();
    let speakerRaw = '';
    let before = '';
    if (pre) {
      // Prefer a declared character mentioned in the pre-quote text (first mention = subject)
      const declared = [...ctx.declared].sort((a, b) => b.length - a.length);
      let bestIdx = -1;
      let best = '';
      for (const d of declared) {
        const idx = pre.indexOf(d);
        if (idx >= 0 && (bestIdx === -1 || idx < bestIdx)) { bestIdx = idx; best = d; }
      }
      if (best) {
        speakerRaw = pre.slice(bestIdx);
        before = pre.slice(0, bestIdx).trim();
      } else {
        // Undeclared: subject is the text up to the speech verb, last clause
        const clauses = pre.split(/\s+(?:แล้ว|จึง|ก่อนจะ|พร้อม)\s*|[,，]\s*/);
        const lastClause = clauses[clauses.length - 1] || pre;
        const startsWithVerb = SPEECH_VERBS.some(v => lastClause.startsWith(v));
        if (startsWithVerb && clauses.length > 1) {
          // Subject omitted ("ต้นเดินเข้ามา แล้วถามว่า"): subject is the start of the first clause.
          speakerRaw = cutAtActionVerb(clauses[0]) + lastClause;
          before = pre.slice(0, pre.length - lastClause.length).replace(/\s*(?:แล้ว|จึง|ก่อนจะ|พร้อม)\s*$/, '').trim();
        } else {
          speakerRaw = lastClause;
          before = pre.slice(0, pre.length - lastClause.length).trim();
        }
      }
    }
    const speakerCandidate = speakerRaw ? normalizeSpeakerName(speakerRaw, ctx.declared) : '';
    const hasVerbOrDeclared = !!speakerRaw && (ctx.declared.includes(speakerCandidate) || SPEECH_VERBS.some(v => speakerRaw.includes(v)) || isOffScreenSpeaker(speakerCandidate));
    if (speakerCandidate && hasVerbOrDeclared) {
      if (before) beats.push({ type: 'action', text: before });
      // Delivery note = whatever followed the name in the pre-quote text
      const verbPart = speakerRaw.slice(speakerRaw.indexOf(speakerCandidate) >= 0 ? speakerRaw.indexOf(speakerCandidate) + speakerCandidate.length : 0).trim();
      const b = makeDialogue(speakerCandidate, verbPart.replace(/ว่า$/, '').trim(), quote, l);
      if (b) {
        beats.push(b);
        if (after) beats.push({ type: 'action', text: after });
        return { beats, consumedNext: false };
      }
    }
  }

  beats.push({ type: 'action', text: l });
  return { beats, consumedNext: false };
}

/**
 * Parses a raw story/script. Handles chat preamble/trailer, scene headers,
 * metadata, declared characters and dialogue.
 */
export function parseStoryStructure(rawStory: string): ParsedStoryStructure {
  const empty: ParsedStoryStructure = {
    metadata: {}, characters: [], offScreenSpeakers: [], narrativeBeats: [], allDialogues: [], scenes: [], hasSceneHeaders: false
  };
  if (!rawStory || typeof rawStory !== 'string') return empty;

  const lines = rawStory.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const metadata: Record<string, string> = {};
  const characters: { name: string; description: string; declared: boolean }[] = [];
  const offScreen = new Set<string>();

  const headerIdx: number[] = [];
  lines.forEach((l, i) => { if (SCENE_HEADER_REGEX.test(l)) headerIdx.push(i); });
  const hasSceneHeaders = headerIdx.length > 0;

  // ---- Pass 1: metadata + declared characters (from the preamble region only when headers exist)
  const preEnd = hasSceneHeaders ? headerIdx[0] : lines.length;
  let inCharBlock = false;
  const consumedPre = new Set<number>();
  for (let i = 0; i < preEnd; i++) {
    const line = lines[i];
    const meta = line.match(META_TAG_REGEX);
    if (meta) {
      inCharBlock = false;
      metadata[line.split(/[:：=]/)[0].trim()] = meta[1].trim();
      consumedPre.add(i);
      continue;
    }
    const ch = line.match(CHAR_BLOCK_HEADER_REGEX);
    if (ch && /[:：=]|^(?:ตัวละคร(?:หลัก)?|รายชื่อตัวละคร|CHARACTERS?)$/i.test(line)) {
      inCharBlock = true;
      consumedPre.add(i);
      if (ch[1].trim()) {
        splitCharacterList(ch[1]).forEach(n => {
          const name = normalizeSpeakerName(n);
          if (isPlausibleSpeaker(name) && !isOffScreenSpeaker(name) && !characters.some(c => c.name === name)) {
            characters.push({ name, description: '', declared: true });
          }
        });
      }
      continue;
    }
    if (inCharBlock) {
      const b = line.match(CHAR_BULLET_REGEX);
      if (b) {
        const name = b[1].trim();
        if (isPlausibleSpeaker(name) && !isOffScreenSpeaker(name) && !characters.some(c => c.name === name)) {
          characters.push({ name, description: [b[2], b[3]].filter(Boolean).join(' ').trim(), declared: true });
        }
        consumedPre.add(i);
        continue;
      }
      if (/^[-*•]\s*[ก-๙a-zA-Z]/.test(line)) {
        const name = line.replace(/^[-*•]\s*/, '').replace(/\([^)]*\)/g, '').trim();
        if (isPlausibleSpeaker(name) && name.length <= 30 && !characters.some(c => c.name === name)) {
          characters.push({ name, description: '', declared: true });
        }
        consumedPre.add(i);
        continue;
      }
      inCharBlock = false;
    }
  }
  const declaredNames = () => characters.map(c => c.name);

  const narrativeBeats: StoryBeat[] = [];
  const allDialogues: (StoryDialogue & { beatIndex: number })[] = [];
  const scenes: ParsedStoryScene[] = [];

  const registerBeats = (beats: StoryBeat[], target: StoryBeat[]) => {
    for (const b of beats) {
      if (b.type === 'action' && (STANDALONE_ENDING_LINE_RE.test(b.text.trim()) || (hasExplicitEndingMarker(b.text) && b.text.replace(ENDING_MARKER_GLOBAL, '').replace(/[\s\-–—()[\]]/g, '').length === 0))) continue;
      if (b.type === 'dialogue' && b.dialogue) {
        allDialogues.push({ ...b.dialogue, beatIndex: narrativeBeats.length });
        if (b.dialogue.offScreen) offScreen.add(b.dialogue.speaker);
        else if (!characters.some(c => c.name === b.dialogue!.speaker)) {
          characters.push({ name: b.dialogue.speaker, description: '', declared: false });
        }
      }
      narrativeBeats.push(b);
      target.push(b);
    }
  };

  const parseBlock = (blockLines: string[], target: StoryBeat[]) => {
    for (let i = 0; i < blockLines.length; i++) {
      const { beats, consumedNext } = parseStoryLine(blockLines[i], blockLines[i + 1], { declared: declaredNames() });
      registerBeats(beats, target);
      if (consumedNext) i++;
    }
  };

  if (hasSceneHeaders) {
    for (let h = 0; h < headerIdx.length; h++) {
      const start = headerIdx[h];
      const end = h + 1 < headerIdx.length ? headerIdx[h + 1] : lines.length;
      const headerMatch = lines[start].match(SCENE_HEADER_REGEX)!;
      let body = lines.slice(start + 1, end);
      if (h === headerIdx.length - 1) {
        // Strip trailing chat after the last scene (and anything after a separator that is chat-like)
        const sepIdx = body.findIndex(l => SEPARATOR_REGEX.test(l));
        if (sepIdx >= 0 && body.slice(sepIdx + 1).every(l => isChatLine(l) || !/["“”]/.test(l) && CHAT_CONTENT_REGEX.test(l))) {
          body = body.slice(0, sepIdx);
        }
        while (body.length > 0 && isChatLine(body[body.length - 1])) body.pop();
      }
      body = body.filter(l => !SEPARATOR_REGEX.test(l));
      const prev = scenes.length > 0 ? scenes[scenes.length - 1] : null;
      const info = parseSceneHeading(headerMatch[2] || '', !!prev?.location);
      let { location, timeOfDay } = info;
      let inheritedLocation = false;
      // Title / mood / "…ต่อเนื่อง" headings keep the previous scene's place and time.
      if (!location && prev?.location) { location = prev.location; inheritedLocation = true; }
      if (!timeOfDay && prev?.timeOfDay && (inheritedLocation || info.continued || location === prev.location)) timeOfDay = prev.timeOfDay;
      const scene: ParsedStoryScene = {
        sceneNumber: Number(headerMatch[1]) || h + 1,
        heading: lines[start].replace(/[*_#]/g, '').trim(),
        location,
        timeOfDay,
        title: info.title,
        inheritedLocation,
        beats: []
      };
      parseBlock(body, scene.beats);
      scenes.push(scene);
    }
  } else {
    // No headers: strip leading/trailing chat, keep everything else as narrative.
    const bodyIdx: number[] = [];
    for (let i = 0; i < lines.length; i++) if (!consumedPre.has(i)) bodyIdx.push(i);
    let body = bodyIdx.map(i => lines[i]);
    while (body.length > 0 && isChatLine(body[0])) body.shift();
    while (body.length > 0 && isChatLine(body[body.length - 1])) body.pop();
    body = body.filter(l => !SEPARATOR_REGEX.test(l));
    parseBlock(body, []);
  }

  // Declared characters first
  characters.sort((a, b) => Number(b.declared) - Number(a.declared));

  return {
    metadata,
    characters,
    offScreenSpeakers: Array.from(offScreen),
    narrativeBeats,
    allDialogues,
    scenes,
    hasSceneHeaders
  };
}

export interface SceneBeatUnit {
  actionText: string;
  actionBeats: string[];
  dialogues: StoryDialogue[];
  endsWithDialogue: boolean;
  location?: string;
  timeOfDay?: string;
  heading?: string;
  title?: string;
}

/** Builds the visible action text of a scene from its real beats (no "พูดขึ้น" filler). */
export function buildUnitFromBeats(beats: StoryBeat[]): SceneBeatUnit {
  const actions = beats.filter(b => b.type === 'action').map(b => b.text.trim()).filter(Boolean);
  const dialogues = beats.filter(b => b.type === 'dialogue' && b.dialogue).map(b => b.dialogue!);
  // If a scene is dialogue-only, its action is the real dialogue lines themselves.
  const actionText = actions.length > 0
    ? actions.join(' ')
    : beats.filter(b => b.type === 'dialogue').map(b => b.text.trim()).join(' ');
  const last = beats[beats.length - 1];
  return { actionText, actionBeats: actions, dialogues, endsWithDialogue: !!last && last.type === 'dialogue' };
}

/**
 * Splits the whole story into ordered scene units.
 * With scene headers: exactly one unit per header block.
 * Without headers: beats are chunked so that a dialogue line stays in the same
 * unit as the action that introduces it (no "one clip late" dialogue).
 */
export function splitStoryIntoSceneUnits(parsed: ParsedStoryStructure, scenesPerChunk: number = 5): SceneBeatUnit[] {
  if (parsed.hasSceneHeaders && parsed.scenes.length > 0) {
    return parsed.scenes
      .map(sc => ({ ...buildUnitFromBeats(sc.beats), location: sc.location, timeOfDay: sc.timeOfDay, heading: sc.heading, title: sc.title }))
      .filter(u => u.actionText.trim() || u.dialogues.length > 0);
  }

  // Group each action with the dialogue lines that directly follow it.
  const groups: StoryBeat[][] = [];
  for (const b of parsed.narrativeBeats) {
    if (b.type === 'action' || groups.length === 0) groups.push([b]);
    else groups[groups.length - 1].push(b);
  }
  if (groups.length === 0) return [];

  // Chunk groups: roughly 1 group per scene when short, evenly otherwise.
  const target = Math.max(1, scenesPerChunk);
  const groupsPerScene = groups.length <= target * 2 ? 1 : Math.ceil(groups.length / (target * 2));
  const units: SceneBeatUnit[] = [];
  for (let i = 0; i < groups.length; i += groupsPerScene) {
    units.push(buildUnitFromBeats(groups.slice(i, i + groupsPerScene).flat()));
  }
  return units;
}

/** Backward-compatible helper (used to live in server.ts). No filler padding. */
export function groupStoryBeatsIntoScenes(rawBeats: StoryBeat[], targetSceneCount: number = 5): SceneBeatUnit[] {
  const parsed: ParsedStoryStructure = {
    metadata: {}, characters: [], offScreenSpeakers: [], narrativeBeats: rawBeats, allDialogues: [], scenes: [], hasSceneHeaders: false
  };
  return splitStoryIntoSceneUnits(parsed, targetSceneCount);
}

/** Picks the main (lockable) character for a scene. */
export function pickMainCharacter(candidates: string[], dialogues: StoryDialogue[] = [], fallback: string[] = []): string {
  const ok = (n?: string) => !!n && !isOffScreenSpeaker(n) && !isReservedSystemKeyword(n) && !isMetadataKeyword(n);
  const fromChars = candidates.find(ok);
  if (fromChars) return fromChars;
  const fromDlg = dialogues.map(d => d.speaker).find(ok);
  if (fromDlg) return fromDlg;
  return fallback.find(ok) || '';
}

/**
 * Builds the per-story lock data: one full Character Lock text per character
 * (library data first: age / hair / outfit, else the story's own description)
 * and one Location Lock (single lighting description) per location+time.
 */
export function buildStoryLocks(params: {
  parsedStory: ParsedStoryStructure;
  libraryCharacters?: any[];
  continuityLock?: any;
  /** Raw story text: its character list lines are parsed for appearance when the parser kept none */
  storyText?: string;
}) {
  const { parsedStory, libraryCharacters = [], continuityLock = null } = params;
  const characterLocks = new Map<string, string>();
  const profiles = new Map<string, ResolvedCharacterProfile>();
  const characterWarnings: string[] = [];
  const declaredList = mergeDeclaredCharacters(parsedStory.characters, params.storyText || '');
  // Master Continuity Lock appearance for the main character (UI "characterAppearance" / face / hair / costume)
  const lockChar = continuityLock?.characterName ? [{
    name: continuityLock.characterName,
    face: continuityLock.characterFace,
    hair: continuityLock.characterHair,
    outfit: continuityLock.characterCostume,
    appearance: continuityLock.characterAppearance,
    age: continuityLock.characterAge,
    build: continuityLock.characterBuild,
    accessories: continuityLock.characterAccessories
  }] : [];
  const lockFor = (name: string): string => {
    if (!name) return '';
    if (characterLocks.has(name)) return characterLocks.get(name)!;
    const r = resolveCharacterProfiles([name], [...(libraryCharacters || []), ...lockChar], declaredList);
    const prof = r.profiles[0];
    const text = prof ? formatCharacterAppearanceLock(prof) : name;
    if (prof) profiles.set(name, prof);
    r.warnings.forEach(w => { if (!characterWarnings.includes(w)) characterWarnings.push(w); });
    characterLocks.set(name, text);
    return text;
  };
  const locationLocks = new Map<string, LocationLock>();
  const locationLockFor = (location: string, timeOfDay: string): LocationLock => {
    const key = `${location}|${timeOfDay}`;
    if (!locationLocks.has(key)) {
      const lockedHere = continuityLock?.location && continuityLock.location === location;
      const ll: LocationLock = {
        location,
        timeOfDay,
        lighting: lightingForTime(timeOfDay, lockedHere ? continuityLock?.lighting || '' : (locationLocks.size === 0 ? continuityLock?.lighting || '' : ''))
      };
      // Location Lock from the library / Master Lock: set details + props at the locked place
      if (lockedHere && String(continuityLock?.locationVisualDetails || '').trim()) ll.setDetails = String(continuityLock.locationVisualDetails).trim();
      if (lockedHere && String(continuityLock?.props || '').trim()) ll.props = String(continuityLock.props).trim();
      locationLocks.set(key, ll);
    }
    return locationLocks.get(key)!;
  };
  return { lockFor, locationLockFor, characterLocks, locationLocks, profiles, characterWarnings };
}

export interface GenerateEpisodeParams {
  originalStory: string;
  currentScriptText?: string;
  episodeNumber?: number;
  targetSceneCount?: number;
  existingScenes?: any[];
  lastSceneState?: any;
  characters?: any[];
  continuityLock?: any;
  clipDurationSeconds?: number;
}

/**
 * Deterministic OFFLINE episode builder. Only used when the user explicitly
 * chooses offline mode. Slices the parsed scenes per episode.
 */
export function generateEpisodeLocally({
  originalStory,
  episodeNumber = 1,
  targetSceneCount = 5,
  existingScenes = [],
  lastSceneState = null,
  characters = [],
  continuityLock = null,
  clipDurationSeconds = 10
}: GenerateEpisodeParams) {
  const parsedStory = parseStoryStructure(originalStory);
  const hasExplicitEnd = hasExplicitEndingMarker(originalStory);
  const scenesPerEpisode = Math.max(5, Math.min(6, targetSceneCount || 5));

  // ---- Known characters: declared/parsed first, then library matches, then continuity lock
  const allKnownCharacters: string[] = [];
  const addChar = (n?: string) => {
    if (!n) return;
    const name = n.trim();
    if (!isPlausibleSpeaker(name) || isOffScreenSpeaker(name) || allKnownCharacters.includes(name)) return;
    allKnownCharacters.push(name);
  };
  parsedStory.characters.forEach(c => addChar(c.name));
  (characters || []).forEach((c: any) => {
    if (c?.name && originalStory.includes(String(c.name).split(' ')[0])) addChar(c.name);
  });
  if (Array.isArray(continuityLock?.characterNames)) continuityLock.characterNames.forEach((n: string) => {
    if (n && originalStory.includes(n)) addChar(n);
  });
  if (continuityLock?.characterName && originalStory.includes(continuityLock.characterName)) addChar(continuityLock.characterName);

  const pos = continuityLock?.characterPositions || continuityLock?.characterPosition || lastSceneState?.characterPositions || '';

  // ---- Story-wide location / time defaults
  const metaLocation = parsedStory.metadata['สถานที่'] || parsedStory.metadata['สถานที่หลัก'] || parsedStory.metadata['LOCATION'] || '';
  const metaTime = parsedStory.metadata['เวลา'] || parsedStory.metadata['ช่วงเวลา'] || parsedStory.metadata['TIME'] || '';
  const storyText = parsedStory.narrativeBeats.map(b => b.text).join('\n');
  const storyLocation = metaLocation || continuityLock?.location || extractLocationFromText(storyText) || '';
  const storyTime = metaTime || continuityLock?.timeOfDay || detectTimeOfDay(storyText) || '';

  // ---- Slice this episode's scenes out of the full ordered scene list
  const allUnits = splitStoryIntoSceneUnits(parsedStory, scenesPerEpisode);
  const lastNum = Number(lastSceneState?.sceneNumber) || 0;
  const startIndex = lastNum > 0
    ? lastNum
    : (existingScenes.length > 0 ? existingScenes.length : (Math.max(1, episodeNumber) - 1) * scenesPerEpisode);
  const episodeUnits = allUnits.slice(startIndex, startIndex + scenesPerEpisode);
  const hasMoreScenes = startIndex + episodeUnits.length < allUnits.length;

  const scenes: any[] = [];
  const introduced = new Set<string>();
  let prevEnd: string = lastSceneState?.endAction || '';
  const locks = buildStoryLocks({ parsedStory, libraryCharacters: characters, continuityLock, storyText: originalStory });

  // Pose / Position Lock handoff across the episode (start of scene N = end of scene N-1).
  // Initial state: previous episode's end poses, else the user's Position Lock.
  const initialPoses = normalizePoseList(lastSceneState?.endPoses).length > 0
    ? normalizePoseList(lastSceneState?.endPoses)
    : normalizePoseList(continuityLock?.characterPositionLocks);
  const continuity = analyzeClipContinuity({
    lockedCharacters: allKnownCharacters,
    initialPoses,
    clips: episodeUnits.map(u => ({
      text: [...u.actionBeats].join(' ') || u.actionText,
      speakers: u.dialogues.filter(d => !d.offScreen).map(d => d.speaker),
      location: u.location || storyLocation || ''
    }))
  });

  episodeUnits.forEach((unit, s) => {
    const scNum = startIndex + s + 1;
    const location = unit.location || storyLocation || extractLocationFromText(unit.actionText) || UNSPECIFIED;
    const timeOfDay = unit.timeOfDay || storyTime || detectTimeOfDay(unit.actionText) || UNSPECIFIED;
    const sceneHeading = `ฉากที่ ${scNum}: ${location} - ${timeOfDay}${unit.title ? ` (${unit.title})` : ''}`;
    const cont = continuity.clips[s];
    const locationLock = locks.locationLockFor(location, timeOfDay);

    const cleanAction = unit.actionText.replace(ENDING_MARKER_GLOBAL, '').trim();
    const dialogues = unit.dialogues.map(d => ({
      speaker: d.speaker,
      emotionOrAction: d.emotionOrAction || '',
      dialogue: d.dialogue,
      ...(d.offScreen ? { offScreen: true } : {})
    }));
    const sceneText = cleanAction + ' ' + dialogues.map(d => d.speaker + ' ' + d.dialogue).join(' ');
    // Ordered by first appearance in the scene so the scene's subject becomes the main character
    const mentioned = allKnownCharacters
      .filter(n => sceneText.includes(n))
      .sort((a, b) => sceneText.indexOf(a) - sceneText.indexOf(b));
    mentioned.forEach(n => introduced.add(n));
    // On-screen characters in this scene: mentioned first, then already-introduced ones
    const sceneActiveChars = Array.from(new Set([
      ...mentioned,
      ...(cont ? cont.charactersPresent : allKnownCharacters.filter(n => introduced.has(n) && !mentioned.includes(n)))
    ]));
    const characterLocks = sceneActiveChars.map(n => ({ name: n, lock: locks.lockFor(n) }));
    const mainCharacter = pickMainCharacter(mentioned.length ? mentioned : sceneActiveChars, dialogues, allKnownCharacters);

    const { startState: startAction, endState } = deriveScenePhysicalStates({
      sceneIndex: s,
      cleanAction,
      dialogues,
      sceneActiveChars,
      location,
      timeOfDay,
      prevSceneEndState: prevEnd,
      endsWithDialogue: unit.endsWithDialogue,
      actionBeats: unit.actionBeats.map(a => a.replace(ENDING_MARKER_GLOBAL, '').trim())
    });
    prevEnd = endState;

    const actionDescription = `[ช็อตความยาวประมาณ ${clipDurationSeconds} วินาที] ${cleanAction}${pos ? ` (ล็อคตำแหน่ง: ${pos})` : ''}`;
    const charLockPart = characterLocks.length > 0 ? ` Character Lock: ${characterLocks.map(c => c.lock).join(' | ')} — identical face, hair and outfit in every clip.` : '';
    const locationLockPart = location !== UNSPECIFIED ? ` ${formatLocationLock(locationLock)}.` : '';
    const posePart = cont ? ` Continuity Handoff: ${formatContinuityForPrompt(cont, scNum === 1 && !lastSceneState && initialPoses.length === 0)}.` : '';
    const sceneWarnings: ContinuityWarning[] = sceneWarningsFor(continuity.warnings, s + 1, scNum);
    const diagPart = dialogues.length > 0
      ? ' Dialogue: ' + dialogues.map(d => `${d.speaker}${d.offScreen ? ' (off-screen voice)' : ''} speaks: "${d.dialogue}"`).join('; ') + '.'
      : '';
    const visualPrompt = 'Cinematic 8K masterpiece' +
      (sceneActiveChars.length ? ', ' + sceneActiveChars.join(' and ') : '') +
      (location !== UNSPECIFIED ? ' at ' + location : '') +
      (timeOfDay !== UNSPECIFIED ? ', ' + timeOfDay : '') +
      ', 35mm lens, photorealistic film still.' +
      charLockPart +
      locationLockPart +
      (pos ? ` Spatial Position Lock: ${pos}.` : '') +
      ` Scene Action: ${cleanAction}.` +
      diagPart +
      ` Continuity Flow: Starting moment: ${startAction}. Ending momentum: ${endState}.` +
      posePart;

    let scriptFormattedText = sceneHeading + '\n';
    if (pos) scriptFormattedText += `(ตำแหน่งในฉาก: ${pos})\n`;
    scriptFormattedText += `(เริ่มต้น: ${startAction})\n(การกระทำ: ${actionDescription})\n`;
    dialogues.forEach(d => {
      scriptFormattedText += `${d.speaker}${d.emotionOrAction ? ' ' + d.emotionOrAction : ''}: "${d.dialogue}"\n`;
    });
    scriptFormattedText += `(สิ้นสุดฉาก: ${endState})\n`;

    scenes.push({
      sceneNumber: scNum,
      sceneHeading,
      location,
      timeOfDay,
      characters: sceneActiveChars,
      mainCharacter,
      characterPositions: pos,
      actionDescription,
      startAction,
      dialogues,
      endState,
      visualPrompt,
      scriptFormattedText: scriptFormattedText.trim(),
      sceneTitle: unit.title || '',
      characterLocks,
      locationLock,
      startPoses: cont?.startPoses || [],
      endPoses: cont?.endPoses || [],
      continuityWarnings: sceneWarnings
    });
  });

  const episodeTitle = scenes.length > 0
    ? `ตอนที่ ${episodeNumber}: ฉากที่ ${scenes[0].sceneNumber}-${scenes[scenes.length - 1].sceneNumber} (โหมดออฟไลน์)`
    : `ตอนที่ ${episodeNumber}`;
  const episodeScriptText = scenes.length > 0 ? `[${episodeTitle}]\n\n` + scenes.map(s => s.scriptFormattedText).join('\n\n') : '';

  const isFinished = !hasMoreScenes && hasExplicitEnd && scenes.length > 0;
  const done = startIndex + episodeUnits.length;
  const progressPercentage = allUnits.length > 0 ? Math.min(100, Math.round((done / allUnits.length) * 100)) : 0;

  return {
    isStoryFinished: isFinished,
    finishMessage: isFinished ? 'เนื้อเรื่องจบแล้ว (จบบริบูรณ์ตามต้นฉบับ)' : (!hasMoreScenes ? 'ใช้ฉากจากต้นฉบับครบแล้ว (ไม่มีฉากใหม่ให้สร้างในโหมดออฟไลน์)' : ''),
    hasMoreScenes,
    totalSourceScenes: allUnits.length,
    episodeNumber,
    episodeTitle,
    progressPercentage,
    currentMilestone: scenes.length > 0
      ? `${episodeTitle} (ฉากที่ ${scenes[0].sceneNumber} - ${scenes[scenes.length - 1].sceneNumber} จาก ${allUnits.length})`
      : 'ไม่มีฉากใหม่จากต้นฉบับ',
    summaryOfEventsSoFar: `สร้างถึงฉากที่ ${done} จากทั้งหมด ${allUnits.length} ฉากในต้นฉบับ`,
    episodeScriptText,
    scenes,
    nextScene: scenes[0] || null,
    declaredCharacters: parsedStory.characters.filter(c => c.declared).map(c => c.name),
    offScreenSpeakers: parsedStory.offScreenSpeakers,
    continuityWarnings: scenes.flatMap(sc => sc.continuityWarnings || []),
    /** Character Lock warnings, e.g. "ยังไม่ได้ระบุรูปลักษณ์ของ X" */
    characterWarnings: [...locks.characterWarnings],
    /** Position Lock after the last scene of this episode (use as the next episode's start) */
    characterPositionLocks: scenes.length > 0 ? scenes[scenes.length - 1].endPoses : initialPoses
  };
}

// ==========================================
// Gemini response validation (per-scene)
// ==========================================
export interface GeminiEpisodeValidation {
  ok: boolean;
  errors: string[];
  scenes: any[];
}

/** Validates / normalizes Gemini story scenes. Speakers are normalized; off-screen voices flagged. */
export function validateGeminiEpisodeScenes(parsed: any, startSceneNum: number, declaredNames: string[] = []): GeminiEpisodeValidation {
  const errors: string[] = [];
  if (!parsed || typeof parsed !== 'object') return { ok: false, errors: ['response is not a JSON object'], scenes: [] };
  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) return { ok: false, errors: ['"scenes" array is missing or empty'], scenes: [] };
  const str = (v: any) => (typeof v === 'string' ? v.trim() : '');
  const scenes = parsed.scenes.map((sc: any, idx: number) => {
    const n = idx + 1;
    if (!sc || typeof sc !== 'object') { errors.push(`scene ${n}: not an object`); return null; }
    const required = ['sceneHeading', 'actionDescription', 'startAction', 'endState', 'visualPrompt'];
    required.forEach(f => { if (!str(sc[f])) errors.push(`scene ${n}: missing "${f}"`); });
    const dialogues = Array.isArray(sc.dialogues) ? sc.dialogues : [];
    const cleanDialogues = dialogues
      .filter((d: any) => d && str(d.speaker) && str(d.dialogue))
      .map((d: any) => {
        const speaker = normalizeSpeakerName(str(d.speaker), declaredNames);
        const off = isOffScreenSpeaker(speaker);
        return { speaker, emotionOrAction: str(d.emotionOrAction), dialogue: str(d.dialogue), ...(off ? { offScreen: true } : {}) };
      })
      .filter((d: any) => d.speaker && !isReservedSystemKeyword(d.speaker));
    if (dialogues.length !== cleanDialogues.length) errors.push(`scene ${n}: ${dialogues.length - cleanDialogues.length} dialogue(s) missing speaker/dialogue or using reserved keywords`);
    const chars = (Array.isArray(sc.characters) ? sc.characters : [])
      .map((c: any) => normalizeSpeakerName(str(c), declaredNames))
      .filter((c: string) => c && !isOffScreenSpeaker(c) && !isReservedSystemKeyword(c));
    return {
      ...sc,
      sceneNumber: startSceneNum + idx,
      location: str(sc.location) || UNSPECIFIED,
      timeOfDay: str(sc.timeOfDay) || UNSPECIFIED,
      characters: chars,
      mainCharacter: pickMainCharacter(chars, cleanDialogues, declaredNames),
      dialogues: cleanDialogues
    };
  }).filter(Boolean);
  return { ok: errors.length === 0, errors, scenes };
}

/**
 * Post-processes Gemini story scenes with the same guarantees as the offline engine:
 * - a title/mood "location" (e.g. "คืนดีกัน") or "…ต่อเนื่อง" inherits the previous scene's place/time,
 * - full Character Lock + one Location Lock (single lighting) per scene,
 * - pose handoff (start pose = previous end pose) + continuity warnings,
 * all appended to the scene's visualPrompt that is sent to the video model.
 */
export function applyEpisodeLocks(scenes: any[], params: {
  originalStory: string;
  characters?: any[];
  continuityLock?: any;
  lastSceneState?: any;
  declaredNames?: string[];
  /** Scenes already generated (Story Lock: no repeats) */
  existingScenes?: any[];
}): { scenes: any[]; warnings: ContinuityWarning[]; characterWarnings: string[] } {
  const parsedStory = parseStoryStructure(params.originalStory || '');
  const locks = buildStoryLocks({ parsedStory, libraryCharacters: params.characters, continuityLock: params.continuityLock, storyText: params.originalStory });
  let prevLoc = String(params.lastSceneState?.location || '').trim();
  let prevTime = String(params.lastSceneState?.timeOfDay || '').trim();
  const fixed = (scenes || []).map((sc: any) => {
    let location = String(sc.location || '').trim();
    let timeOfDay = String(sc.timeOfDay || '').trim();
    const cont = CONTINUATION_SUFFIX_REGEX.test(location);
    if (cont) location = location.replace(CONTINUATION_SUFFIX_REGEX, '').trim();
    const unspecified = !location || location === UNSPECIFIED;
    let sceneTitle = sc.sceneTitle || '';
    if ((unspecified || (isMoodLike(location) && !isLocationLike(location))) && prevLoc) {
      if (!unspecified) sceneTitle = sceneTitle || location;
      location = prevLoc;
      if (!timeOfDay || timeOfDay === UNSPECIFIED) timeOfDay = prevTime;
    }
    if ((!timeOfDay || timeOfDay === UNSPECIFIED) && location === prevLoc && prevTime) timeOfDay = prevTime;
    if (location && location !== UNSPECIFIED) prevLoc = location;
    if (timeOfDay && timeOfDay !== UNSPECIFIED) prevTime = timeOfDay;
    return { ...sc, location: location || UNSPECIFIED, timeOfDay: timeOfDay || UNSPECIFIED, sceneTitle };
  });
  // Story Lock: the first new scene starts from the previous episode's end state
  const prevEndAction = String(params.lastSceneState?.endAction || params.lastSceneState?.endState || '').trim();
  if (fixed.length > 0 && prevEndAction && !String(fixed[0].startAction || '').trim()) fixed[0] = { ...fixed[0], startAction: prevEndAction };
  const storyWarnings = checkStoryRepeats(fixed, params.existingScenes || []);

  const known = Array.from(new Set([
    ...(params.declaredNames || []),
    ...parsedStory.characters.map(c => c.name),
    ...fixed.flatMap((sc: any) => sc.characters || [])
  ])).filter(n => n && !isOffScreenSpeaker(n));
  const initialPoses = normalizePoseList(params.lastSceneState?.endPoses).length > 0
    ? normalizePoseList(params.lastSceneState?.endPoses)
    : normalizePoseList(params.continuityLock?.characterPositionLocks);
  const continuity = analyzeClipContinuity({
    lockedCharacters: known,
    initialPoses,
    clips: fixed.map((sc: any) => ({
      text: String(sc.actionDescription || '').replace(/^\[[^\]]*\]\s*/, ''),
      speakers: (sc.dialogues || []).filter((d: any) => !d.offScreen).map((d: any) => d.speaker),
      location: sc.location && sc.location !== UNSPECIFIED ? sc.location : ''
    }))
  });

  const warnings: ContinuityWarning[] = [];
  const out = fixed.map((sc: any, i: number) => {
    const cont = continuity.clips[i];
    const present = Array.from(new Set([...(sc.characters || []), ...(cont?.charactersPresent || [])])).filter(n => n && !isOffScreenSpeaker(n));
    const characterLocks = present.map(n => ({ name: n, lock: locks.lockFor(n) }));
    const locationLock = locks.locationLockFor(sc.location, sc.timeOfDay === UNSPECIFIED ? '' : sc.timeOfDay);
    const sceneWarnings = sceneWarningsFor(continuity.warnings, i + 1, sc.sceneNumber);
    warnings.push(...sceneWarnings);
    const lockBlock = [
      characterLocks.length ? `Character Lock: ${characterLocks.map(c => c.lock).join(' | ')} — identical face, hair and outfit in every clip.` : '',
      sc.location !== UNSPECIFIED ? `${formatLocationLock(locationLock)}.` : '',
      cont ? `Continuity Handoff: ${formatContinuityForPrompt(cont, i === 0 && !params.lastSceneState && initialPoses.length === 0)}.` : ''
    ].filter(Boolean).join(' ');
    return {
      ...sc,
      characters: present,
      characterLocks,
      locationLock,
      startPoses: cont?.startPoses || [],
      endPoses: cont?.endPoses || [],
      continuityWarnings: sceneWarnings,
      visualPrompt: `${String(sc.visualPrompt || '').trim()} ${lockBlock}`.trim()
    };
  });
  warnings.push(...storyWarnings);
  const outWithStory = storyWarnings.length === 0 ? out : out.map((sc: any) => {
    const sw = storyWarnings.filter(w => w.clipNumber === (Number(sc.sceneNumber) || 0));
    return sw.length ? { ...sc, continuityWarnings: [...(sc.continuityWarnings || []), ...sw] } : sc;
  });
  return { scenes: outWithStory, warnings, characterWarnings: [...locks.characterWarnings] };
}

export type { CharacterPoseState, ContinuityWarning };
