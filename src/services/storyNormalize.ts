/**
 * Rewrites common ways people write a Thai script into the form the parsers understand.
 * Idempotent: running it on its own output changes nothing.
 *
 *   ละครเรื่อง “ไฟแค้นซ่อนรัก”              → ชื่อเรื่อง: ไฟแค้นซ่อนรัก        (was read as DIALOGUE of "ละครเรื่อง")
 *   ตอนที่ 1: ลูกสะใภ้ที่ไม่มีใครต้องการ        → เรื่อง: ตอนที่ 1: ลูกสะใภ้…      (was read as an action)
 *   ตัวละคร / คุณหญิงมณี แม่สามีผู้ร่ำรวย…    → - คุณหญิงมณี — แม่สามีผู้ร่ำรวย…  (list without dashes was an action)
 *   ฉาก: คฤหาสน์หรู กลางคืน ฝนตกหนัก        → ฉากที่ 1 — คฤหาสน์หรู / กลางคืน ฝนตกหนัก
 *                                              (heading without a number was not a scene; place and time split)
 *   คลิป 4 — น้องน้ำสวนกลับ                   → (removed: a clip title, was written into the video as an action)
 *   ฉาก: ต่อเนื่องจากคลิปที่ 3 ตำแหน่งเดิม       → ฉากที่ 2 — ห้องโถงบ้าน / กลางวัน   (same place and time as before,
 *                                              was taken as the NAME of a new place)
 *   ตัวละครในฉาก: ธนา, มะลิ                   → (removed: a note, was played as an action)
 *   บทพูด: ไม่มี   /   ธนา: ไม่มี              → (removed: was "ธนา speaks: "ไม่มี"")
 *   บท: มะลิ: "…"  /  บทพูดของมะลิ: "…"        → มะลิ: "…"
 *   บท: "…"  (no name)                         → <the scene's speaker>: "…"   (was a character called "บท")
 */

const TIME_WORDS = [
  'รุ่งเช้า', 'เช้าตรู่', 'ตอนเช้า', 'ยามเช้า', 'เช้ามืด', 'เช้า', 'สาย', 'เที่ยงวัน', 'เที่ยงคืน', 'เที่ยง',
  'กลางวัน', 'ตอนบ่าย', 'บ่าย', 'ช่วงเย็น', 'ตอนเย็น', 'ยามเย็น', 'พลบค่ำ', 'หัวค่ำ', 'ยามค่ำ', 'ค่ำ',
  'ตอนกลางคืน', 'กลางคืน', 'ยามดึก', 'ดึก', 'เย็น',
  'night', 'day', 'morning', 'evening', 'dusk', 'dawn'
];

const NUMBERED_HEADING_RE = /^[ \t#*_\[【(]*(?:ฉากที่|ฉาก|scene)\s*(\d+)/i;
const UNNUMBERED_HEADING_RE = /^[ \t#*_\[【(]*(?:ฉาก|scene)\s*[:：\-–—]\s*(.+?)[\]】)*_]*$/i;
const TITLE_RE = /^(?:ละครเรื่อง|ละคร|นิยายเรื่อง|ซีรีส์เรื่อง|เรื่อง)\s*[:：]?\s*[“"«「]\s*(.+?)\s*[”"»」]\s*$/;
const EPISODE_RE = /^ตอนที่\s*\d+\s*(?:[:：.\-–—]\s*.*)?$/;
/** "คลิป 4 — น้องน้ำสวนกลับ", "คลิปที่ 2: …" — a label for the writer, not something that happens */
const CLIP_LABEL_RE = /^[ \t#*_\[【(]*(?:คลิป(?:ที่)?|clip)\s*\d+(?:\s*\/\s*\d+)?\s*(?:[:：.\-–—|]\s*.*)?$/i;
/** Heading text that means "same place as before" rather than naming a place */
const SAME_PLACE_RE = /^(?:ต่อเนื่อง|ต่อจาก|ฉากเดิม|สถานที่เดิม|ที่เดิม|same (?:place|location)|continu)/i;
/** "ตัวละครในฉาก: …", "ตัวละครในคลิป: …" — who is in the scene (a note, not an action) */
const CAST_RE = /^[ \t*_\-•(\[]*(?:ตัวละคร(?:ในฉาก|ในคลิป|ที่ปรากฏ|ที่อยู่ในฉาก)?|นักแสดง(?:ในฉาก)?|cast|characters? in (?:scene|clip))\s*[:：]\s*(.+?)[)\]]*$/i;
/** A line that says "no dialogue" */
const NO_DIALOGUE_RE = /^[ \t*_\-•(\[]*(?:(?:บทพูด|บท|เสียงพูด|dialogue)\s*[:：]\s*(?:\(?\s*(?:ไม่มี(?:บทพูด|เสียงพูด)?|ไม่พูด|เงียบ|-+|—|none|no dialogue)\s*\)?)?|ไม่มีบทพูด|ไม่มีเสียงพูด|\(?\s*ไม่มีบทพูด\s*\)?)\s*(?:\([^)]*\))?\s*[.)\]]*$/i;
/** "บท: …", "บทพูด: …", "บทพูดของมะลิ: …", "บทพูด (มะลิ): …" */
const LINE_LABEL_RE = /^[ \t*_\-•]*(?:บทพูด|บท|dialogue)\s*(?:ของ\s*([^:：()"“\[\]]{1,30})|[(\[]\s*([^)\]]{1,30})\s*[)\]]|\s([^:："“\[\]]{1,30}))?\s*[:：]\s*(.*)$/i;
/** "ภาพ/การกระทำ: …", "การกระทำ: …", "Action: …" — the label goes, the action stays */
const ACTION_LABEL_RE = /^[ \t*_\-•]*(?:ภาพ\s*[/／]\s*การกระทำ|ภาพและการกระทำ|การกระทำ|แอ็?คชั่?น|แอ็?กชั่?น|action|visual)\s*[:：]\s*(.+)$/i;
/** "จบเรื่อง — 225 คลิป × 8 วินาที …" → "จบเรื่อง" */
const END_NOTE_RE = /^[ \t*_\-•]*(จบเรื่อง|จบบริบูรณ์|-?จบ-?|THE END)\s*[—–\-:：].*$/i;
/** "วันที่ 1 ช่วงกลางวัน / ห้องโถงคฤหาสน์" right under a scene heading: when and where */
const DAY_RE = /วันที่\s*\d+|ต่อมา|วันรุ่งขึ้น|วันถัดมา|คืนนั้น|\bday\s*\d+/i;
/** Story-setup lines before the first scene ("ความยาวเป้าหมาย: …", "แนว: …", "- ทุกตัวละครเป็นมนุษย์…") */
const SETUP_KEY_RE = /^[ \t*_\-•]*(?:ความยาว|แนว|อัตราส่วน|คุณภาพ|รูปแบบ|หมายเหตุ|สไตล์|โทน|ประเภท|ภาษา|เพลง|ดนตรี|กลุ่มเป้าหมาย|ข้อกำหนด|เป้าหมาย|ใช้ภาพอ้างอิง|ภาพอ้างอิง|รูปที่\s*\d)[^:：]{0,30}(?:[:：]|$)/;
const MAIN_CAST_RE = /^[ \t*_\-•]*(?:ตัวละครหลัก|ตัวละครทั้งหมด|รายชื่อตัวละคร|ตัวละคร)\s*[:：]\s*(.+)$/;
/** "ธนา: ไม่มี", "ธนา: (เงียบ)", "ธนา: -" — a character with nothing to say */
const EMPTY_LINE_RE = /^[^:："“]{1,30}[:：]\s*["“]?\s*\(?\s*(?:ไม่มี(?:บทพูด)?|ไม่พูด|เงียบ|-+|—|…|\.{3})\s*\)?\s*["”]?\s*$/;
const CHAR_HEADER_RE = /^(?:ตัวละคร(?:หลัก)?|รายชื่อตัวละคร|นักแสดง|characters?)\s*[:：]?\s*$/i;

const isHeading = (t: string) => NUMBERED_HEADING_RE.test(t) || UNNUMBERED_HEADING_RE.test(t);
const hasTimeWord = (t: string) => TIME_WORDS.some(w => new RegExp(`(^|[\\s,，])${w}`, 'i').test(t)) || DAY_RE.test(t);

/** "วันที่ 1 ช่วงกลางวัน / ห้องโถงคฤหาสน์" → "ห้องโถงคฤหาสน์ / วันที่ 1 ช่วงกลางวัน" (place first), else '' */
function settingLine(t: string): string {
  if (!t || CLIP_LABEL_RE.test(t) || isHeading(t) || /[:："“]/.test(t)) return '';
  const parts = t.split(/\s*[/／]\s*/).filter(Boolean);
  if (parts.length !== 2) return '';
  const [a, b] = parts;
  if (hasTimeWord(a) && !hasTimeWord(b)) return `${b} / ${timeFirst(a)}`;
  if (hasTimeWord(b)) return `${a} / ${timeFirst(b)}`;
  return '';
}

/** "วันที่ 1 ช่วงกลางวัน" → "กลางวัน วันที่ 1": the parser only takes a time that starts with a time word */
function timeFirst(t: string): string {
  let best: { at: number; w: string } | null = null;
  for (const w of TIME_WORDS) {
    const m = t.match(new RegExp(`(^|[\\s,，]|ช่วง|ตอน|ยาม)(${w})`, 'i'));
    if (m && m.index != null) {
      const at = m.index + m[1].length;
      if (!best || at < best.at || (at === best.at && w.length > best.w.length)) best = { at, w };
    }
  }
  if (!best || best.at === 0) return t;
  const start = t.slice(0, best.at).replace(/(?:ช่วง|ตอน|ยาม)$/, '');
  const word = t.slice(best.at).split(/\s+/)[0];
  const rest = (start + ' ' + t.slice(best.at + word.length)).replace(/\s+/g, ' ').trim();
  return rest ? `${word} ${rest}` : word;
}

/** Titles before a name: "ทนายกฤต" is also called "กฤต" in actions */
const NAME_PREFIX_RE = /^(คุณหญิง|คุณนาย|คุณ|ทนาย|ป้า|ลุง|น้า|อา|ยาย|ตา|พี่|น้อง|หมอ|ครู|ตำรวจ|สารวัตร|ผู้กอง|นาย|นาง|นางสาว)(.{3,})$/;
/** Short names that are also everyday words: never expanded ("รับสาย", "ฟ้า") */
const COMMON_WORDS = new Set(['สาย', 'ฟ้า', 'น้ำ', 'ดาว', 'แก้ว', 'ทอง', 'ใจ', 'เดือน', 'ฝน', 'ลม', 'มณี', 'ดี', 'พร', 'ศรี', 'ชาย', 'หญิง']);

/** "คุณหญิงมณี (แม่สามี), น้ำฟ้า (ลูกสะใภ้), ตำรวจหญิง" → ["- คุณหญิงมณี — แม่สามี", …] */
function castEntries(list: string): string[] {
  const items: string[] = [];
  let depth = 0; let cur = '';
  for (const ch of list) {
    if (ch === '(' || ch === '（') depth++;
    if (ch === ')' || ch === '）') depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,，、;]/.test(ch)) { items.push(cur); cur = ''; continue; }
    cur += ch;
  }
  items.push(cur);
  return items.map(x => x.trim()).filter(Boolean).map(x => {
    const m = x.match(/^(.+?)\s*[(（]\s*(.+?)\s*[)）]\s*$/);
    return m ? `- ${m[1].trim()} — ${m[2].trim()}` : `- ${x}`;
  });
}

/**
 * Clip-by-clip scripts ("คลิป 001/225 | 8 วินาที | 9:16", "ภาพ/การกระทำ: …", "บทพูด [ชื่อ]: …"):
 * every clip becomes its own scene at the current place and time, so the writer's split is kept
 * exactly (it used to be merged into a handful of clips with no dialogue at all).
 * Also: setup notes before the first scene are dropped (they were played as actions),
 * "ตัวละครหลัก: A (desc), B" becomes a character list, a bare first line becomes the title.
 */
function preNormalizeLayout(lines: string[]): string[] {
  const firstHeading = lines.findIndex(l => isHeading(l.trim()));
  const clipIdx = lines.map((l, i) => (CLIP_LABEL_RE.test(l.trim()) ? i : -1)).filter(i => i >= 0);
  const nextNonBlank = (i: number) => { for (let j = i + 1; j < lines.length; j++) if (lines[j].trim()) return j; return -1; };
  // clips that are NOT immediately given their own "ฉาก:" heading carry the scene structure
  const clipMode = clipIdx.filter(i => { const j = nextNonBlank(i); return j < 0 || !isHeading(lines[j].trim()); }).length >= 2;
  const out: string[] = [];
  let titleDone = false;
  let inCharList = false;
  let place = '';
  let pendingScene = false;
  const openScene = () => { if (pendingScene) { out.push(`ฉาก: ${place || 'ต่อเนื่อง'}`); pendingScene = false; } };
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    // ---- setup block before the first scene ----
    if (firstHeading > 0 && i < firstHeading) {
      if (!t) { inCharList = false; out.push(lines[i]); continue; }
      const castLine = t.match(MAIN_CAST_RE);
      if (castLine && /[,，、(]/.test(castLine[1])) { out.push('ตัวละคร', ...castEntries(castLine[1]), ''); titleDone = true; continue; }
      if (CHAR_HEADER_RE.test(t)) { inCharList = true; titleDone = true; out.push(lines[i]); continue; }
      if (inCharList) { out.push(lines[i]); continue; }
      if (TITLE_RE.test(t) || /^(?:ชื่อเรื่อง|เรื่อง)\s*[:：]/.test(t) || EPISODE_RE.test(t)) { titleDone = true; out.push(lines[i]); continue; }
      if (!titleDone && !/[:："“]/.test(t) && !/^[-*•]/.test(t) && t.length <= 60) { titleDone = true; out.push(`ชื่อเรื่อง: ${t.replace(/^[“"]|[”"]$/g, '')}`); continue; }
      titleDone = true;
      if (/^[-*•]/.test(t) || SETUP_KEY_RE.test(t) || /^ข้อกำหนด|^หมายเหตุ|^คำแนะนำ/.test(t)) continue;
      out.push(lines[i]);
      continue;
    }
    // ---- scene heading (+ "when / where" line under it) ----
    if (isHeading(t)) {
      const j = nextNonBlank(i);
      const setting = j >= 0 ? settingLine(lines[j].trim()) : '';
      const un = t.match(UNNUMBERED_HEADING_RE);
      const own = setting || (un ? un[1].trim() : t.replace(NUMBERED_HEADING_RE, '').replace(/^[\s:：.\-–—]+/, '').trim());
      if (setting) i = j; // consumed
      if (clipMode) {
        place = setting || (SAME_PLACE_RE.test(own) ? place : splitPlaceAndTime(own)) || place;
        pendingScene = true;
        continue;
      }
      out.push(setting ? `ฉาก: ${setting}` : lines[i === j ? i - 0 : i]);
      if (setting) { /* heading replaced by its place and time */ }
      continue;
    }
    if (clipMode && CLIP_LABEL_RE.test(t)) {
      pendingScene = true;
      openScene();
      continue;
    }
    if (clipMode && t) openScene();
    const al = t.match(ACTION_LABEL_RE);
    if (al && i > firstHeading) { out.push(al[1].trim()); continue; }
    out.push(lines[i]);
  }
  return out;
}

/** "คฤหาสน์หรู กลางคืน ฝนตกหนัก" → "คฤหาสน์หรู / กลางคืน ฝนตกหนัก" (only when there is no "/" yet). */
export function splitPlaceAndTime(text: string): string {
  const t = String(text || '').trim();
  if (!t || /[/／]/.test(t)) return t;
  let at = -1;
  for (const w of TIME_WORDS) {
    const re = new RegExp(`(^|[\\s,，])(${w})`, 'i');
    const m = t.match(re);
    if (m && m.index != null) {
      const pos = m.index + m[1].length;
      if (pos > 0 && (at < 0 || pos < at)) at = pos;
    }
  }
  if (at <= 0) return t;
  const place = t.slice(0, at).replace(/[\s,，]+$/, '');
  const time = t.slice(at).trim();
  return place && time ? `${place} / ${time}` : t;
}

/** The writer already split the story clip by clip ("คลิป 001/225 …" with its own action / dialogue). */
export function isClipByClipScript(raw: string): boolean {
  const lines = String(raw || '').replace(/\r\n?/g, '\n').split('\n');
  const nextNonBlank = (i: number) => { for (let j = i + 1; j < lines.length; j++) if (lines[j].trim()) return lines[j].trim(); return ''; };
  return lines.filter((l, i) => CLIP_LABEL_RE.test(l.trim()) && !isHeading(nextNonBlank(i))).length >= 3;
}

export function normalizeStoryScript(raw: string): string {
  if (!raw || typeof raw !== 'string') return raw;
  const lines = preNormalizeLayout(raw.replace(/\r\n?/g, '\n').split('\n'));
  const out: string[] = [];
  let sceneNo = 0;
  let inChars = false;
  let charEntries = 0;
  let lastPlace = '';
  let inScene = false;
  const declared: string[] = [];
  let cast: string[] = [];
  let lastNamed = '';
  const namesIn = (text: string) => declared.filter(n => text.includes(n)).sort((a, b) => text.indexOf(a) - text.indexOf(b));
  for (const original of lines) {
    const t = original.trim();
    if (CLIP_LABEL_RE.test(t)) continue;
    const endNote = t.match(END_NOTE_RE);
    if (endNote) { out.push(endNote[1]); continue; }
    const actionLabel = t.match(ACTION_LABEL_RE);
    if (actionLabel && inScene) { out.push(actionLabel[1].trim()); continue; }
    if (inScene && t) {
      const castLine = t.match(CAST_RE);
      if (castLine) {
        cast = castLine[1].split(/[,，、/]|\s+และ\s+|\s+/).map(x => x.trim()).filter(Boolean);
        continue;
      }
      if (NO_DIALOGUE_RE.test(t) || EMPTY_LINE_RE.test(t)) continue;
      const label = t.match(LINE_LABEL_RE);
      if (label) {
        const named = (label[1] || label[2] || label[3] || '').trim();
        const rest = label[4].trim();
        if (!rest) continue; // "บทพูด:" heading; the lines follow on their own
        if (/^[^:："“]{1,30}[:：]/.test(rest)) { out.push(rest); continue; } // "บท: มะลิ: "…""
        const alias = (n: string) => { if (!n || declared.includes(n)) return n; const m = declared.filter(d => d.includes(n) || n.includes(d)); return m.length === 1 ? m[0] : n; };
        if (named && !/^[^:："“]{1,30}[:：]/.test(rest)) { out.push(`${alias(named)}: ${rest}`); continue; }
        const who = named || (cast.length === 1 ? cast[0] : '') || lastNamed || cast[0] || '';
        out.push(who ? `${who}: ${rest}` : rest);
        continue;
      }
      // "กฤตเปิดแฟ้ม" → "ทนายกฤตเปิดแฟ้ม": otherwise he is not seen as being in the clip
      if (!/[:："“]/.test(t)) {
        let line = t;
        for (const d of declared) {
          const m = d.match(NAME_PREFIX_RE);
          if (!m || COMMON_WORDS.has(m[2])) continue;
          if (line.startsWith(m[2])) line = d + line.slice(m[2].length);
          line = line.replace(new RegExp(`(\\s|จาก|ให้|กับ|มอง|หา)${m[2]}(?![ก-๙])`, 'g'), `$1${d}`);
        }
        if (line !== t) { const n = namesIn(line)[0]; if (n) lastNamed = n; out.push(line.replace(/\s*ภาพจบเรื่อง\s*$/, '')); continue; }
      }
      if (/\sภาพจบเรื่อง\s*$/.test(t)) { out.push(t.replace(/\s*ภาพจบเรื่อง\s*$/, '')); continue; }
      const speaker = t.match(/^([^:："“]{1,30})[:：]/);
      if (speaker && !/^(?:ฉาก|เวลา|สถานที่)/.test(speaker[1])) lastNamed = speaker[1].trim();
      else { const n = namesIn(t)[0]; if (n) lastNamed = n; }
    }
    const numbered = t.match(NUMBERED_HEADING_RE);
    if (numbered) {
      sceneNo = Math.max(sceneNo, Number(numbered[1]) || 0);
      inChars = false;
      const rest = t.replace(NUMBERED_HEADING_RE, '').replace(/^[\s:：.\-–—]+/, '').replace(/[\]】)*_]+$/, '').trim();
      if (rest && SAME_PLACE_RE.test(rest) && lastPlace) {
        out.push(`ฉากที่ ${numbered[1]} — ${lastPlace}`);
        continue;
      }
      if (rest && !SAME_PLACE_RE.test(rest)) lastPlace = rest;
      inScene = true; cast = []; lastNamed = '';
      out.push(original);
      continue;
    }
    const unnumbered = t.match(UNNUMBERED_HEADING_RE);
    if (unnumbered) {
      inChars = false;
      sceneNo += 1;
      const text = unnumbered[1].trim();
      const place = SAME_PLACE_RE.test(text) && lastPlace ? lastPlace : splitPlaceAndTime(text);
      if (!SAME_PLACE_RE.test(text)) lastPlace = place;
      inScene = true; cast = []; lastNamed = '';
      out.push(`ฉากที่ ${sceneNo} — ${place}`);
      continue;
    }
    const title = t.match(TITLE_RE);
    if (title) {
      out.push(`ชื่อเรื่อง: ${title[1]}`);
      continue;
    }
    if (EPISODE_RE.test(t)) {
      out.push(`เรื่อง: ${t}`);
      continue;
    }
    if (CHAR_HEADER_RE.test(t)) {
      inChars = true;
      charEntries = 0;
      out.push('ตัวละคร');
      continue;
    }
    if (inChars) {
      if (!t) {
        if (charEntries > 0) inChars = false;
        out.push(original);
        continue;
      }
      // a line of dialogue or a quote ends the list
      if (/[:：]/.test(t) && !/^[-*•]/.test(t) || /["“”]/.test(t)) {
        inChars = false;
      } else {
        charEntries++;
        const nm = t.replace(/^[-*•]\s*/, '').match(/^(\S+)/);
        if (nm && !declared.includes(nm[1])) declared.push(nm[1]);
        if (/^[-*•]/.test(t)) {
          out.push(original);
        } else {
          const m = t.match(/^(\S+)\s*(?:[—–\-]\s*)?(.*)$/);
          out.push(m && m[2] ? `- ${m[1]} — ${m[2]}` : `- ${t}`);
        }
        continue;
      }
    }
    out.push(original);
  }
  return out.join('\n');
}
