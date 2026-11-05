/**
 * Shot-by-shot scripts ("ช็อต 11", "คลิป 3", "ฉาก 2" ...): one script shot = one clip, numbers and
 * titles kept. Header blocks (ตัวละคร, สถานที่, เวลา, บรรยากาศ, ความต่อเนื่อง / ล็อกความต่อเนื่อง,
 * คลิปละ N วินาที) are locks for every clip, never shots.
 * - cast per shot is rebuilt: a character is in a shot when the shot names them; someone who
 *   ARRIVES (วิ่งเข้ามา, ล้อม, มาถึง …) stays until they leave (วิ่งหนี, จากไป …) or the place changes
 * - a group with a count ("ทหารสุริยนคร 3 นาย ถือดาบและหอก") becomes N members with distinct looks;
 *   numbered roles ("ทหารคนที่ 1") stay whole; the bare role word ("ทหาร") links to the members
 * - props (the phone, its battery from the shot that says it) and "nothing modern" are locks
 */
import { glossaryTranslate } from './thaiGlossary';
import { romanizeThaiName, GENERIC_ROLE_RE, hasWord } from './metaAiPrompt';

export const SHOT_LABEL_RE = /^[ \t#*_\[【(]*(?:ช็อต|ช๊อต|shot|คลิป|clip|ฉาก)(?:ที่)?\s*(\d+)\s*(?:[:：.\-–—|)\]】]\s*(.*))?$/i;
const HEADER_KEY_RE = /^(สถานที่(?:หลัก)?|เวลา|ช่วงเวลา|บรรยากาศ|ฉากหลัง|(?:ล็อก)?ความต่อเนื่อง|continuity|ตัวละคร(?:หลัก)?|รายชื่อตัวละคร|อุปกรณ์|พร็อพ|props?)\s*[:：]?\s*(.*)$/i;
const ARRIVE_RE = /หลบ|ซ่อน|แอบ|วิ่งเข้ามา|เดินเข้ามา|เข้ามา|ล้อม|มาถึง|โผล่ออกมา|ปรากฏตัว|ยืนขวาง|ตามมา/;
const LEAVE_RE = /วิ่งหนี|หนีไป|จากไป|เดินจากไป|ออกไป|หายไป|วิ่งผ่าน/;
const COUNT_RE = /(\d+)\s*(?:นาย|คน|ตัว)/;
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const TRAITS = ['bearded, red headband', 'thin moustache, bronze helmet', 'scarred cheek, black headband', 'shaved head, broad shoulders', 'young face, cloth head wrap', 'grey beard, iron helmet'];
/** fixed kit per weapon: one costume + weapon description, reused verbatim */
const WEAPON_KIT: Record<string, string> = { sword: 'plain straight sword', spear: 'wooden spear', bow: 'wooden longbow', knife: 'short knife', 'axe': 'iron axe' };
const ROLE_COSTUME: [RegExp, string][] = [[/soldier|guard|warrior/, 'leather armor, bare arms'], [/bandit/, 'ragged dark clothes'], [/villager|farmer/, 'cotton clothes']];

export interface CastEntry { name: string; desc: string; members?: string[]; role?: string }
export interface ShotClip {
  clipNumber: number; title: string; durationSeconds: number; scriptSeconds?: number;
  generatedPrompt: string; dialogues: { speaker: string; line: string }[]; charactersPresent: string[];
  locationName?: string; timeOfDay?: string; scriptAction: string;
  propsLock?: string; worldLock?: string; continuityNote?: string; castExact: true; listener?: string;
}
export interface ShotScript {
  clips: ShotClip[];
  location: string; timeOfDay: string; atmosphere: string; continuity: string; seconds?: number;
  cast: CastEntry[];
  /** Thai -> English for names, roles, looks and places (offline) */
  translations: Record<string, string>;
  characterNotes: Record<string, string>;
  knownCharacters: string[];
  locationNotes: Record<string, string>;
}

export function isShotScript(raw: string): boolean {
  return String(raw || '').split(/\r?\n/).filter(l => SHOT_LABEL_RE.test(l.trim())).length >= 2;
}

const NOT_SPEAKER_RE = /^(?:ภาพ|ผู้ฟัง|การกระทำ|สถานที่|เวลา|บรรยากาศ|กล้อง|เสียง|หมายเหตุ)$/;
const lineOf = (l: string) => { const m = l.match(/^([^:："“]{1,30}?)\s*(?:\(([^)]*)\))?\s*[:：]\s*["“](.+?)["”]\s*$/); return m && !NOT_SPEAKER_RE.test(m[1].trim()) ? m : null; };
/** "ชายแก่หยุดมองต้น พูดว่า "…"" -> action + speech (speaker found at the start by the caller) */
const INLINE_SPEECH_RE = /^(.*?)\s*(?:แล้ว)?(?:พูด|ตะโกน|กล่าว|บอก|ถาม|ร้อง|กระซิบ|ตวาด|สั่ง)(?:ขึ้น)?(?:ว่า)\s*["“](.+?)["”]\s*$/;
/** auto English looks for speakers who are not in the cast list */
const AUTO_LOOK: [RegExp, string, string][] = [
  [/^(?:ชายแก่|ชายชรา|ตาแก่|ลุง)/, 'old man', 'an old Thai villager, 65, white hair, cotton clothes'],
  [/^(?:หญิงแก่|หญิงชรา|ยายแก่|ยาย|ป้า)/, 'old woman', 'an old Thai village woman, 65, grey hair bun, cotton clothes'],
  [/^เด็กหญิง/, 'little girl', 'a Thai girl, 8, braided hair, cotton dress'],
  [/^(?:เด็กชาย|เด็ก)/, 'little boy', 'a Thai boy, 8, short hair, cotton clothes'],
  [/^ชาวบ้านหญิง|^หญิงชาวบ้าน/, 'female villager', 'a Thai village woman, 35, hair in a bun, cotton clothes'],
  [/^ชาวบ้าน/, 'male villager', 'a Thai village man, 40, cotton clothes'],
  [/^ทหารบาดเจ็บ/, 'wounded soldier', 'a wounded soldier, bandaged arm, leather armor'],
  [/^ทหาร/, 'soldier', 'a soldier, leather armor, bare arms, plain straight sword'],
  [/^(?:หมอ|หมอยา)/, 'healer', 'an old healer, white hair, brown cotton robe'],
  [/^(?:พระ)/, 'monk', 'a Thai monk, shaved head, saffron robe'],
  [/^(?:แม่ทัพ)/, 'general', 'a general, black leather armor, red cloak']
];
/** location keywords: the core noun of each header place name */
const PLACE_NOUNS = ['ค่ายทหาร', 'ค่าย', 'ศาลาบัญชาการ', 'ศาลา', 'เพิงรักษา', 'เพิง', 'หมู่บ้าน', 'ริมคลอง', 'คลอง', 'ท่าน้ำ', 'ป่า', 'ถนน', 'ซากกำแพง', 'กำแพง', 'วัด', 'ทุ่งนา', 'ทุ่ง', 'ตลาด', 'วัง', 'ถ้ำ', 'แม่น้ำ', 'ห้อง', 'บ้าน', 'เรือน', 'ลาน'];
const TIME_WORDS: [RegExp, string][] = [[/กลางคืน|ตอนดึก|ยามค่ำ/, 'กลางคืน'], [/เช้าตรู่|รุ่งเช้า|รุ่งสาง|ฟ้าสาง/, 'เช้าตรู่'], [/พลบค่ำ|ตอนเย็น|ยามเย็น/, 'ตอนเย็น'], [/กลางวัน|ตอนเที่ยง/, 'กลางวัน']];

export function parseShotScript(raw: string): ShotScript | null {
  if (!isShotScript(raw)) return null;
  const lines = String(raw).replace(/\r\n?/g, '\n').split('\n').map(l => l.trim());
  const head: string[] = []; const tailHeader: string[] = [];
  const blocks: { n: number; title: string; body: string[] }[] = [];
  for (const l of lines) {
    const m = l.match(SHOT_LABEL_RE);
    if (m) { blocks.push({ n: Number(m[1]), title: (m[2] || '').trim(), body: [] }); continue; }
    if (!l) continue;
    if (HEADER_KEY_RE.test(l) && !lineOf(l) && (blocks.length === 0 || /^(?:ล็อก)?ความต่อเนื่อง|^continuity|^อุปกรณ์|^พร็อพ|^props?/i.test(l))) { (blocks.length ? tailHeader : head).push(l); continue; }
    if (blocks.length) blocks[blocks.length - 1].body.push(l); else head.push(l);
  }
  // ---- header
  let location = ''; let timeOfDay = ''; let atmosphere = ''; let continuity = ''; let inCast = false;
  const cast: CastEntry[] = [];
  for (const l of [...head, ...tailHeader]) {
    const k = l.match(HEADER_KEY_RE);
    if (k) {
      const key = k[1]; const val = k[2].trim();
      inCast = /^ตัวละคร|^รายชื่อ/.test(key);
      if (/^สถานที่/.test(key)) location = val;
      else if (/เวลา/.test(key)) timeOfDay = val;
      else if (/บรรยากาศ|ฉากหลัง/.test(key)) atmosphere = val;
      else if (/ความต่อเนื่อง|continuity/i.test(key)) continuity = val;
      if (inCast && val) { const c = val.match(/^([^:：]+)[:：]\s*(.*)$/); if (c) cast.push({ name: c[1].trim(), desc: c[2].trim() }); }
      continue;
    }
    if (inCast) { const c = l.match(/^([^:：]{1,30})[:：]\s*(.*)$/); if (c) cast.push({ name: c[1].trim(), desc: c[2].trim() }); }
  }
  // several places in the header ("ถนนชนบท, ป่าชายแดน, ค่ายทหาร ...") -> a list; one per shot
  const splitList = (v: string) => v.split(/\s*(?:,|、|\/|\||;|\s+และ\s+|\n|\d+\.\s)\s*/).map(x => x.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  const placeList = splitList(location);
  const timeList = splitList(timeOfDay).length > 1 && /,/.test(timeOfDay) ? splitList(timeOfDay) : [timeOfDay].filter(Boolean);
  const placeForAction = (action: string) => {
    const full = placeList.filter(p => action.includes(p)).sort((a, b) => b.length - a.length)[0];
    if (full) return full;
    for (const noun of PLACE_NOUNS) if (action.includes(noun)) { const hit = placeList.find(p => p.includes(noun)); if (hit) return hit; }
    return '';
  };
  // inline speech ("X … พูดว่า "…"") and listener lines ("ผู้ฟัง: X")
  const castNames = cast.map(c => c.name).sort((a, b) => b.length - a.length);
  for (const b of blocks) {
    const inline: { speaker: string; line: string }[] = [];
    const body: string[] = [];
    for (const l0 of b.body) {
      const l = l0.replace(/^(?:การกระทำ|ภาพ)\s*[:：]\s*/, '');
      const ls = l.match(/^ผู้ฟัง\s*[:：]\s*(.+)$/);
      if (ls) { (b as any).listener = ls[1].trim(); continue; }
      const m = !lineOf(l0) ? l.match(INLINE_SPEECH_RE) : null;
      if (m) {
        const act = m[1].trim();
        const sp = castNames.find(n => act.startsWith(n)) || AUTO_LOOK.map(([re]) => act.match(new RegExp(re.source.replace(/^\^/, '^(?:') + ')[ก-๙]*?(?=หยุด|มอง|วิ่ง|เดิน|ยืน|นั่ง|หัน|ชี้|ยิ้ม|ร้อง|$)'))?.[0]).find(Boolean) || '';
        if (act) body.push(act);
        inline.push({ speaker: sp || castNames.find(n => act.includes(n)) || 'ผู้พูด', line: m[2].trim() });
        continue;
      }
      body.push(l0);
    }
    b.body = body; (b as any).inline = inline;
  }
  const secM = raw.match(/(?:คลิป|ช็อต)?ละ\s*(\d+)\s*วินาที|(\d+)\s*(?:วินาที|วิ)\s*(?:ต่อ|\/)\s*(?:คลิป|ช็อต)/);
  const seconds = secM ? Number(secM[1] || secM[2]) : undefined;
  // ---- names: script speakers + cast; groups with a count -> members
  const translations: Record<string, string> = {};
  const characterNotes: Record<string, string> = {};
  const roleEn = (name: string): string => {
    const kingdom = name.match(/^ทหาร(.+?)(?:\s*\d+\s*นาย)?$/)?.[1];
    if (/^ทหารบาดเจ็บ/.test(name)) return 'wounded soldier';
    if (/^ทหาร/.test(name)) return kingdom && !/คนที่|นาย/.test(kingdom) ? `${romanizeThaiName(kingdom)} soldier` : 'soldier';
    if (/^ชาวบ้านชาย/.test(name)) return 'male villager';
    if (/^ชาวบ้านหญิง/.test(name)) return 'female villager';
    if (/^ชาวบ้าน/.test(name)) return 'villager';
    if (/^(?:ชายชรา|ชายแก่|ตาแก่)/.test(name)) return 'old man';
    if (/^(?:หญิงชรา|ยายแก่)/.test(name)) return 'old woman';
    return glossaryTranslate(name) || romanizeThaiName(name);
  };
  const speakers = Array.from(new Set(blocks.flatMap(b => [...((b as any).inline || []).map((d: any) => d.speaker), ...b.body.map(lineOf).filter(Boolean).map(m => m![1].trim())])));
  const groupOf = new Map<string, CastEntry>();
  for (const c of cast) {
    const cnt = Number((c.desc.match(COUNT_RE) || c.name.match(COUNT_RE) || [])[1] || 0);
    const role = (c.name.match(GENERIC_ROLE_RE)?.[0]) || '';
    c.role = role;
    const en = roleEn(c.name);
    const look = glossaryTranslate(c.desc.replace(COUNT_RE, '').trim()) || '';
    if (cnt > 1 && role) {
      // numbered members: the script's own "ทหารคนที่ 1" names first, then made up
      const named = speakers.filter(s => s.startsWith(role) && /\d/.test(s));
      const members: string[] = [];
      for (let i = 1; i <= cnt; i++) members.push(named.find(s => Number(s.match(/(\d+)/)?.[1]) === i) || `${role}คนที่ ${i}`);
      c.members = members;
      const weapons = (c.desc.match(/ถือ(.+)$/)?.[1] || '').split(/และ|,|\s+/).map(w => w.trim()).filter(Boolean);
      const wEn = weapons.map(w => glossaryTranslate(w) || '').filter(Boolean);
      members.forEach((m, i) => {
        translations[m] = `${ORD[i] || `#${i + 1}`} ${en}`;
        const kitOf = (w: string) => WEAPON_KIT[w.replace(/^an? /, '')] || w.replace(/^an? /, '');
        const kit = wEn.length ? (i < wEn.length ? kitOf(wEn[i]) : wEn.map(w => w.replace(/^an? /, '')).join(' and ')) : '';
        const costume = ROLE_COSTUME.find(([re]) => re.test(en))?.[1] || 'ancient costume';
        characterNotes[m] = [TRAITS[i % TRAITS.length], costume, kit].filter(Boolean).join(', ');
        groupOf.set(m, c);
      });
      translations[c.name] = `${en}s`;
    } else {
      // a bare role word ("ชาวบ้าน") is the group: "the villagers"; a person role ("ชายชรา") gets "the"
      const bare = !!role && c.name === role && /^(?:ชาวบ้าน|ชาวนา|ชาวประมง|ชาวเขา|ทหาร|โจร|นักรบ|ทาส|องครักษ์)$/.test(role);
      if (cast.some(g => g !== c && g.members?.includes(c.name))) { if (look && !characterNotes[c.name]) { /* the group's fixed look wins */ } continue; }
      const title = c.name.match(/^(แม่ทัพ|หมอยา|หมอ|ขุน|พระยา|พระ|นาย|นาง|ท่าน|ป้า|ลุง|ยาย|ตา)(.+)$/);
      const TITLE: Record<string, string> = { 'แม่ทัพ': 'General', 'หมอยา': 'Healer', 'หมอ': 'Healer', 'ขุน': 'Khun', 'พระยา': 'Phraya', 'พระ': 'Phra', 'นาย': '', 'นาง': '', 'ท่าน': 'Lord', 'ป้า': 'Auntie', 'ลุง': 'Uncle', 'ยาย': 'Grandma', 'ตา': 'Grandpa' };
      translations[c.name] = bare ? `the ${en}s` : (role || GENERIC_ROLE_RE.test(c.name)) ? `the ${en}` : title && title[2].length > 1 ? `${TITLE[title[1]] ? `${TITLE[title[1]]} ` : ''}${romanizeThaiName(title[2])}` : romanizeThaiName(c.name);
      if (look) characterNotes[c.name] = look;
    }
  }
  for (const s of speakers) {
    if (translations[s]) continue;
    const parent = cast.find(c => c.members?.includes(s)) || cast.find(c => c.role && s.startsWith(c.role) && c.name !== s);
    if (GENERIC_ROLE_RE.test(s)) {
      const en = roleEn(s);
      translations[s] = /^ทหารคนที่/.test(s) ? translations[s] || `${ORD[Number(s.match(/\d+/)?.[0] || 1) - 1] || ''} soldier`.trim() : (/^[aeiou]/i.test(en) ? 'an ' : 'a ') + en;
      if (parent && characterNotes[parent.name] && !characterNotes[s]) characterNotes[s] = characterNotes[parent.name];
    } else translations[s] = romanizeThaiName(s);
  }
  // speakers / listeners not in the cast list: an automatic English look
  for (const b of blocks) if ((b as any).listener && !speakers.includes((b as any).listener)) speakers.push((b as any).listener);
  for (const sp of speakers) {
    const auto = AUTO_LOOK.find(([re]) => re.test(sp));
    if (!characterNotes[sp] && !cast.some(c => c.name === sp) && auto) characterNotes[sp] = auto[2];
    if (auto && (!translations[sp] || /[ก-๙]/.test(translations[sp]) || translations[sp] === romanizeThaiName(sp)) && GENERIC_ROLE_RE.test(sp) && !/^ทหารคนที่/.test(sp)) translations[sp] = `the ${auto[1]}`;
  }
  const people = Array.from(new Set([...cast.flatMap(c => c.members || [c.name]), ...speakers]));
  const groupNames = cast.filter(c => c.members).map(c => c.name);
  const knownCharacters = people.filter(n => !groupNames.includes(n));
  // ---- props / world
  const all = blocks.flatMap(b => b.body).join(' ');
  const hasPhone = /โทรศัพท์|มือถือ/.test(all + continuity);
  const owner = hasPhone ? (people.find(n => !GENERIC_ROLE_RE.test(n) && new RegExp(`${n}(?:หยิบ|ถือ)?โทรศัพท์|โทรศัพท์(?:มือถือ)?ของ${n}|กระเป๋าของ${n}`).test(all)) || people.find(n => !GENERIC_ROLE_RE.test(n)) || '') : '';
  const modern = /ไม่มีของสมัยใหม่|ยุคโบราณ|โบราณ/.test(continuity + location + all);
  const ownerEn = owner ? (translations[owner] || romanizeThaiName(owner)) : '';
  let battery = '';
  // ---- clips
  const clips: ShotClip[] = [];
  let present = new Set<string>();
  let place = location;
  let time = timeList[0] || timeOfDay;
  place = placeList[0] || location;
  for (const b of blocks) {
    const dialogues: { speaker: string; line: string }[] = (b as any).inline || [];
    const actions: string[] = [];
    let tagPlace = ''; let tagTime = '';
    for (const l of b.body) {
      const m = lineOf(l);
      if (m) dialogues.push({ speaker: m[1].trim(), line: m[3].trim() });
      else if (!/^(?:สถานที่|เวลา|ผู้ฟัง)\s*[:：]/.test(l)) actions.push(l.replace(/^(?:การกระทำ|ภาพ)\s*[:：]\s*/, ''));
      const pl = l.match(/^สถานที่\s*[:：]\s*(.+)$/); if (pl) tagPlace = pl[1].trim();
      const tl = l.match(/^เวลา\s*[:：]\s*(.+)$/); if (tl) tagTime = tl[1].trim();
    }
    const action = actions.join(' ').trim();
    const actionAll = action;
    // location: the shot's own tag, else a header place named in the action, else carried forward
    const inferred = !tagPlace && placeList.length > 1 ? placeForAction(action) : '';
    const newPlace = tagPlace || inferred || place;
    if (newPlace !== place) { place = newPlace; present = new Set(); }
    // time: tag, else a time word in the action (rain kept), else carried forward
    const tw = TIME_WORDS.find(([re]) => re.test(action))?.[1];
    if (tagTime) time = tagTime; else if (tw) time = `${tw}${/ฝนตกหนัก/.test(action) ? ' ฝนตกหนัก' : /ฝนตก/.test(action) ? ' ฝนตก' : ''}`;
    const text = [action, ...dialogues.map(d => d.speaker)].join(' ');
    const here = new Set<string>();
    // named in this shot
    for (const n of people) if (dialogues.some(d => d.speaker === n) || hasWord(action, n)) here.add(n);
    if ((b as any).listener && people.includes((b as any).listener)) here.add((b as any).listener);
    // groups: "ทหาร 3 นาย" / "ทหารสุริยนคร" / bare "ทหาร" -> its members
    for (const c of cast) {
      if (!c.members) continue;
      const longer = castNames.filter(n => c.role && n !== c.name && n.startsWith(c.role) && !c.members!.includes(n));
      const action = longer.reduce((t, n) => t.split(n).join(' '), actionAll);
      const named = hasWord(action, c.name) || (c.role && new RegExp(`${c.role}(?:${c.name.slice(c.role.length)})?\\s*\\d*\\s*(?:นาย|คน)?`).test(action) && hasWord(action, c.role));
      if (named || c.members.some(m => here.has(m))) {
        const cnt = Number(action.match(COUNT_RE)?.[1] || 0);
        if (cnt > 1 || ARRIVE_RE.test(action) || [...present].some(p => c.members!.includes(p))) c.members.forEach(m => here.add(m));
        else if (!c.members.some(m => here.has(m))) here.add(c.members[0]);
      }
    }
    // non-numbered generic group words in the action ("ชาวบ้าน")
    for (const c of cast) if (!c.members && !here.has(c.name) && hasWord(action, c.name)) here.add(c.name);
    // who stays from before: arrived and not left
    for (const p of present) if (!here.has(p)) here.add(p);
    // update persistence
    const next = new Set<string>();
    for (const n of here) {
      const mentioned = hasWord(action, n) || dialogues.some(d => d.speaker === n) || (groupOf.get(n) && (hasWord(action, groupOf.get(n)!.role || '~') || hasWord(action, groupOf.get(n)!.name)));
      if (present.has(n) && !(mentioned && LEAVE_RE.test(action))) next.add(n);
      else if (mentioned && ARRIVE_RE.test(action) && !LEAVE_RE.test(action)) next.add(n);
    }
    present = next;
    // battery from the shot that says it, onward
    const bat = action.match(/แบต(?:เตอรี่)?\s*(?:เหลือ)?\s*(\d+)\s*%/);
    if (bat) battery = bat[1];
    const phoneHere = /โทรศัพท์|มือถือ/.test(action + dialogues.map(d => d.line).join(' '));
    const propsLock = hasPhone && phoneHere ? `Props lock: ${ownerEn ? `${ownerEn}'s` : 'the same'} black smartphone, the same phone in every shot${battery ? `, battery shows ${battery}%` : ''}.` : '';
    const worldLock = modern ? `No modern buildings, roads, vehicles or technology in the forest${hasPhone && ownerEn ? `, except ${ownerEn}'s phone` : ''}.` : '';
    const cast0 = people.filter(n => here.has(n));
    clips.push({
      clipNumber: b.n, title: b.title, durationSeconds: seconds || 5, scriptSeconds: seconds,
      generatedPrompt: action ? `Core action: ${action}.` : '',
      dialogues, charactersPresent: cast0, locationName: place || undefined, timeOfDay: time || undefined, listener: (b as any).listener || undefined,
      scriptAction: action, propsLock, worldLock, continuityNote: continuity, castExact: true
    });
  }
  const locationNotes: Record<string, string> = {};
  if (location && atmosphere) locationNotes[location] = atmosphere;
  // offline English for the place, its look, the continuity, cast looks and every action
  const NUM = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const baseNames: Record<string, string> = { ...translations };
  for (const c of cast) if (c.members && c.role) {
    const en = roleEn(c.name); const k = c.members.length;
    for (const key of [c.name, c.role]) for (const sp of ['', ' ']) {
      baseNames[`${key}${sp}${k} นาย`] = baseNames[`${key}${sp}${k} คน`] = `${NUM[k] || k} ${en}s`;
    }
    baseNames[c.name] = baseNames[c.role] = `the ${en}s`;
  }
  // realm / city names in the header ("อาณาจักรสุริยนคร") -> romanized proper names
  for (const m of [location, atmosphere, ...cast.map(c => c.desc)].join(' ').matchAll(/(?:อาณาจักร|เมือง|แคว้น|นคร)([ก-๙]+?)(?=ยุค|สมัย|ใน|ของ|\s|$)/g)) if (m[1] && !baseNames[m[1]]) baseNames[m[1]] = romanizeThaiName(m[1]);
  const tAdd = (th: string, names = baseNames, capital = false) => { if (!th || translations[th]) return; const en = glossaryTranslate(th, names); if (en) translations[th] = capital ? en.charAt(0).toUpperCase() + en.slice(1) : en.replace(/^[A-Z](?=[a-z])/, ch => ch.toLowerCase()); };
  [location, atmosphere, timeOfDay, ...placeList, ...clips.map(c => c.timeOfDay || '')].forEach(t => tAdd(t));
  cast.forEach(c => tAdd(c.desc, baseNames, true));
  for (const c of clips) {
    // the bare role word in an action = the member who speaks in this shot, else the group
    const names = { ...baseNames };
    for (const g of cast) if (g.members && g.role) {
      const sp = c.dialogues.map(d => d.speaker).find(x => g.members!.includes(x));
      if (sp) names[g.role] = `the ${translations[sp]}`;
    }
    tAdd(c.scriptAction, names, true);
    if (translations[c.scriptAction]) for (const sp of c.dialogues.map(d => d.speaker)) {
      const en = translations[sp]; if (!en || !/^the /.test(en)) continue;
      const bare = en.slice(4);
      translations[c.scriptAction] = translations[c.scriptAction].replace(new RegExp(`(^|[\\s,;])(?:[Aa]n?|[Tt]he) ${bare}\\b`), (_m, pre) => `${pre}${pre ? 'the' : 'The'} ${bare}`);
    }
  }
  // continuity in English (format words like 9:16, "สมจริง", "คลิปละ 10 วินาที" are settings, not continuity)
  const contTh = continuity.replace(/\d+\s*:\s*\d+|คลิปละ\s*\d+\s*วินาที|สมจริง|ไม่มีของสมัยใหม่ในป่า|ไม่มีของสมัยใหม่/g, ' ').replace(/\s+/g, ' ').trim();
  const contEn = contTh ? glossaryTranslate(contTh, baseNames) : '';
  const continuityEn = contEn ? `Continuity: ${contEn.replace(/(^|, )(two|three|four|five|six) /g, '$1the $2 ')}.` : '';
  for (const c of clips) c.continuityNote = continuityEn || continuity;
  return { clips, location, timeOfDay, atmosphere, continuity, seconds, cast, translations, characterNotes, knownCharacters, locationNotes };
}
