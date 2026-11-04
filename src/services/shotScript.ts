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
const ROLE_COSTUME: [RegExp, string][] = [[/soldier|guard|warrior/, 'leather armor'], [/bandit/, 'ragged dark clothes'], [/villager|farmer/, 'cotton clothes']];

export interface CastEntry { name: string; desc: string; members?: string[]; role?: string }
export interface ShotClip {
  clipNumber: number; title: string; durationSeconds: number; scriptSeconds?: number;
  generatedPrompt: string; dialogues: { speaker: string; line: string }[]; charactersPresent: string[];
  locationName?: string; timeOfDay?: string; scriptAction: string;
  propsLock?: string; worldLock?: string; continuityNote?: string; castExact: true;
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

const lineOf = (l: string) => l.match(/^([^:："“]{1,30}?)\s*(?:\(([^)]*)\))?\s*[:：]\s*["“](.+?)["”]\s*$/);

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
  const secM = raw.match(/(?:คลิป|ช็อต)?ละ\s*(\d+)\s*วินาที|(\d+)\s*(?:วินาที|วิ)\s*(?:ต่อ|\/)\s*(?:คลิป|ช็อต)/);
  const seconds = secM ? Number(secM[1] || secM[2]) : undefined;
  // ---- names: script speakers + cast; groups with a count -> members
  const translations: Record<string, string> = {};
  const characterNotes: Record<string, string> = {};
  const roleEn = (name: string): string => {
    const kingdom = name.match(/^ทหาร(.+?)(?:\s*\d+\s*นาย)?$/)?.[1];
    if (/^ทหาร/.test(name)) return kingdom && !/คนที่|นาย/.test(kingdom) ? `${romanizeThaiName(kingdom)} soldier` : 'soldier';
    if (/^ชาวบ้านชาย/.test(name)) return 'male villager';
    if (/^ชาวบ้านหญิง/.test(name)) return 'female villager';
    if (/^ชาวบ้าน/.test(name)) return 'villager';
    if (/^(?:ชายชรา|ชายแก่|ตาแก่)/.test(name)) return 'old man';
    if (/^(?:หญิงชรา|ยายแก่)/.test(name)) return 'old woman';
    return glossaryTranslate(name) || romanizeThaiName(name);
  };
  const speakers = Array.from(new Set(blocks.flatMap(b => b.body.map(lineOf).filter(Boolean).map(m => m![1].trim()))));
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
      translations[c.name] = bare ? `the ${en}s` : (role || GENERIC_ROLE_RE.test(c.name)) ? `the ${en}` : romanizeThaiName(c.name);
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
  for (const b of blocks) {
    const dialogues: { speaker: string; line: string }[] = [];
    const actions: string[] = [];
    for (const l of b.body) {
      const m = lineOf(l);
      if (m) dialogues.push({ speaker: m[1].trim(), line: m[3].trim() });
      else if (!/^สถานที่|^เวลา/.test(l)) actions.push(l.replace(/^(?:การกระทำ|ภาพ)\s*[:：]\s*/, ''));
      const pl = l.match(/^สถานที่\s*[:：]\s*(.+)$/);
      if (pl && pl[1].trim() !== place) { place = pl[1].trim(); present = new Set(); }
    }
    const action = actions.join(' ').trim();
    const text = [action, ...dialogues.map(d => d.speaker)].join(' ');
    const here = new Set<string>();
    // named in this shot
    for (const n of people) if (dialogues.some(d => d.speaker === n) || hasWord(action, n)) here.add(n);
    // groups: "ทหาร 3 นาย" / "ทหารสุริยนคร" / bare "ทหาร" -> its members
    for (const c of cast) {
      if (!c.members) continue;
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
      dialogues, charactersPresent: cast0, locationName: place || undefined, timeOfDay: timeOfDay || undefined,
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
  [location, atmosphere, timeOfDay].forEach(t => tAdd(t));
  cast.forEach(c => tAdd(c.desc, baseNames, true));
  for (const c of clips) {
    // the bare role word in an action = the member who speaks in this shot, else the group
    const names = { ...baseNames };
    for (const g of cast) if (g.members && g.role) {
      const sp = c.dialogues.map(d => d.speaker).find(x => g.members!.includes(x));
      if (sp) names[g.role] = `the ${translations[sp]}`;
    }
    tAdd(c.scriptAction, names, true);
  }
  // continuity in English (format words like 9:16, "สมจริง", "คลิปละ 10 วินาที" are settings, not continuity)
  const contTh = continuity.replace(/\d+\s*:\s*\d+|คลิปละ\s*\d+\s*วินาที|สมจริง|ไม่มีของสมัยใหม่ในป่า|ไม่มีของสมัยใหม่/g, ' ').replace(/\s+/g, ' ').trim();
  const contEn = contTh ? glossaryTranslate(contTh, baseNames) : '';
  const continuityEn = contEn ? `Continuity: ${contEn.replace(/(^|, )(two|three|four|five|six) /g, '$1the $2 ')}.` : '';
  for (const c of clips) c.continuityNote = continuityEn || continuity;
  return { clips, location, timeOfDay, atmosphere, continuity, seconds, cast, translations, characterNotes, knownCharacters, locationNotes };
}
