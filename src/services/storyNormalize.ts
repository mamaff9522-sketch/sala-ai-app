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
const CLIP_LABEL_RE = /^[ \t#*_\[【(]*(?:คลิป(?:ที่)?|clip)\s*\d+\s*(?:[:：.\-–—]\s*.*)?$/i;
/** Heading text that means "same place as before" rather than naming a place */
const SAME_PLACE_RE = /^(?:ต่อเนื่อง|ต่อจาก|ฉากเดิม|สถานที่เดิม|ที่เดิม|same (?:place|location)|continu)/i;
/** "ตัวละครในฉาก: …", "ตัวละครในคลิป: …" — who is in the scene (a note, not an action) */
const CAST_RE = /^[ \t*_\-•(\[]*(?:ตัวละคร(?:ในฉาก|ในคลิป|ที่ปรากฏ|ที่อยู่ในฉาก)?|นักแสดง(?:ในฉาก)?|cast|characters? in (?:scene|clip))\s*[:：]\s*(.+?)[)\]]*$/i;
/** A line that says "no dialogue" */
const NO_DIALOGUE_RE = /^[ \t*_\-•(\[]*(?:(?:บทพูด|บท|เสียงพูด|dialogue)\s*[:：]\s*(?:\(?\s*(?:ไม่มี(?:บทพูด|เสียงพูด)?|ไม่พูด|เงียบ|-+|—|none|no dialogue)\s*\)?)?|ไม่มีบทพูด|ไม่มีเสียงพูด|\(?\s*ไม่มีบทพูด\s*\)?)\s*[.)\]]*$/i;
/** "บท: …", "บทพูด: …", "บทพูดของมะลิ: …", "บทพูด (มะลิ): …" */
const LINE_LABEL_RE = /^[ \t*_\-•]*(?:บทพูด|บท|dialogue)\s*(?:ของ\s*([^:：()"“]{1,30})|\(\s*([^)]{1,30})\s*\)|\s([^:："“]{1,30}))?\s*[:：]\s*(.*)$/i;
/** "ธนา: ไม่มี", "ธนา: (เงียบ)", "ธนา: -" — a character with nothing to say */
const EMPTY_LINE_RE = /^[^:："“]{1,30}[:：]\s*["“]?\s*\(?\s*(?:ไม่มี(?:บทพูด)?|ไม่พูด|เงียบ|-+|—|…|\.{3})\s*\)?\s*["”]?\s*$/;
const CHAR_HEADER_RE = /^(?:ตัวละคร(?:หลัก)?|รายชื่อตัวละคร|นักแสดง|characters?)\s*[:：]?\s*$/i;

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

export function normalizeStoryScript(raw: string): string {
  if (!raw || typeof raw !== 'string') return raw;
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
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
        const who = named || (cast.length === 1 ? cast[0] : '') || lastNamed || cast[0] || '';
        out.push(who ? `${who}: ${rest}` : rest);
        continue;
      }
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
