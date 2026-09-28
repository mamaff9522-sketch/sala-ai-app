/**
 * Character Appearance Lock (pure functions, no Express / Firebase / DOM imports)
 * ------------------------------------------------------------------------------
 * Shared by the script splitter (/api/script/split), the Multi-Clip director
 * (buildSalaMultiClipPrompts) and the story continuation engine.
 *
 * Resolution order per character (field by field, never invented):
 *   1. Character data supplied by the caller (UI character library / API body):
 *      face, hairstyle/hair/hairStyle, outfit/outfitDescription/costume,
 *      appearance, visualProfile.*, structuredFeatures.*
 *   2. The script's own character list line, e.g.
 *      "- พี่ทุย — ผมสั้นสีดำ ใส่เสื้อโปโลสีกรมท่า ใจร้อน"  or
 *      "- พี่ทุย — face: ..., hair: ..., outfit: ..."
 *   3. Nothing: the personality text is kept and a warning
 *      "ยังไม่ได้ระบุรูปลักษณ์ของ X" is returned. No placeholder appearance.
 *
 * Lock text format (sent to the video model):
 *   "พี่ทุย (face: ...; hair: ...; outfit: ...; appearance: ...)"
 */

export interface CharacterAppearanceInput {
  name: string;
  face?: string;
  hairstyle?: string;
  hair?: string;
  hairStyle?: string;
  outfit?: string;
  outfitDescription?: string;
  costume?: string;
  appearance?: string;
  description?: string;
  personality?: string;
  gender?: string;
  age?: string;
  build?: string;
  accessories?: string;
  jewelry?: string;
  triggerTag?: string;
  visualProfile?: any;
  structuredFeatures?: any;
  storyProfile?: any;
  [key: string]: any;
}

export interface ResolvedCharacterProfile {
  name: string;
  face: string;
  hair: string;
  outfit: string;
  appearance: string;
  gender: string;
  age: string;
  build: string;
  accessories: string;
  personality: string;
  triggerTag: string;
  /** Footwear from the library card (visualProfile.shoes / structuredFeatures.footwear) */
  shoes: string;
  /** Library reference image (URL or data URL), '' when the card has none */
  referenceImageUrl: string;
  /** e.g. "MULTI_VIEWS" when the reference is a multi-view character sheet */
  referenceType: string;
  /** true when the card had a reference image that is missing / unreachable (re-upload needed) */
  referenceMissing: boolean;
  /** Where the visual fields came from */
  source: 'supplied' | 'script' | 'supplied+script' | 'none';
  /** true when at least one of face / hair / outfit / appearance is known */
  hasAppearance: boolean;
  /** visual fields that are still unknown (face / hair / outfit) */
  missing: Array<'face' | 'hair' | 'outfit'>;
}

/** Placeholder strings that are NOT real descriptions (never used as appearance). */
const PLACEHOLDER_RE = /^(?:ตามภาพอ้างอิง|ตามเนื้อเรื่อง|ไม่ระบุ(?:จากต้นฉบับ)?|ไม่เห็นชัด(?:ในภาพ)?|มองไม่เห็น(?:ในภาพ)?|ไม่มี|ไม่ทราบ|รูปลักษณ์ชัดเจน.*|-|n\/a|none|unknown|not visible|ตัวละครเอกประจำสตูดิโอศาลาเอไอ)$/i;

const clean = (v: any): string => {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/\s+/g, ' ').trim();
  if (!s || PLACEHOLDER_RE.test(s) || /ตามเนื้อเรื่อง$/.test(s)) return '';
  return s;
};
const join = (...parts: any[]) => parts.map(clean).filter(Boolean).join(', ');

// ---- Keyword classifiers (Thai + English) -----------------------------------
// Deliberately conservative: "ผม" alone is also the pronoun "I", "ใส่ใจ" means "to care".
const FACE_RE = /(ใบหน้า|หน้าตา|หน้า(?:กลม|เรียว|รูปไข่|เหลี่ยม|คม|หวาน|ใส|ตี๋|มน)|ดวงตา|ตา(?:โต|คม|ตี่|สี|ชั้นเดียว|สองชั้น|กลม)|คิ้ว|ริมฝีปาก|ผิว(?:ขาว|คล้ำ|แทน|สองสี|เนียน|สี)|หนวด|เครา|ไฝ|แว่น|ลักยิ้ม|\bface\b|\beyes?\b|\bskin\b|\bbeard\b|\bmustache\b|\bglasses\b|\bfreckles?\b|\bdimples?\b)/i;
const HAIR_RE = /(ทรงผม|ผม(?:สั้น|ยาว|หยิก|ตรง|ดำ|สี|ม้า|รวบ|มัด|ทอง|น้ำตาล|เปีย|บ็อบ|บ๊อบ|ประบ่า|หางม้า|ฟู|ลอน|ดัด|เทา|ขาว|แดง|รองทรง|เกรียน|ซอย|หน้าม้า)|หัวเกรียน|หัวล้าน|\bhair\b|\bhaired\b|\bponytail\b|\bbob\b|\bbangs\b|\bbraids?\b|\bbald\b)/i;
const OUTFIT_RE = /(ใส่(?!ใจ)|สวม|ชุด|เสื้อ|กางเกง|กระโปรง|รองเท้า|หมวก|เดรส|แจ็คเก็ต|แจ็กเก็ต|ยูนิฟอร์ม|เครื่องแบบ|ผ้าพันคอ|\bwearing\b|\bwears\b|\boutfit\b|\bshirt\b|\bdress\b|\bjacket\b|\bjeans\b|\bskirt\b|\buniform\b|\bhoodie\b|\bt-shirt\b|\bpolo\b|\bsuit\b|\bsneakers\b)/i;
const BODY_RE = /(รูปร่าง|หุ่น|ร่าง(?:ผอม|ท้วม|สูง|เล็ก|ใหญ่)|ตัว(?:สูง|เล็ก|ใหญ่|เตี้ย)|ผอมสูง|สูงโปร่ง|ล่ำ|สูง\s*\d+|\btall\b|\bslim\b|\bslender\b|\bchubby\b|\bmuscular\b|\bpetite\b|\bstocky\b)/i;
const PERSONALITY_RE = /(บุคลิก|นิสัย|ใจ|อารมณ์|ชอบ|รัก|พูด|ขี้|เก่ง|ฉลาด|ร่าเริง|เงียบ|แกล้ง|personality|\bkind\b|\bshy\b)/i;
const AGE_RE = /(?:อายุ\s*)?(\d{1,3})\s*(?:ปี|ขวบ|years?\s*old|y\/o)/i;

const LABELS: Array<{ re: RegExp; key: 'face' | 'hair' | 'outfit' | 'appearance' | 'personality' | 'age' | 'gender' }> = [
  { re: /^(?:face|ใบหน้า|หน้าตา|หน้า)\s*[:：=]\s*/i, key: 'face' },
  { re: /^(?:hair(?:style)?|ทรงผม|ผม)\s*[:：=]\s*/i, key: 'hair' },
  { re: /^(?:outfit|costume|clothes|ชุด|เสื้อผ้า|การแต่งกาย|เครื่องแต่งกาย)\s*[:：=]\s*/i, key: 'outfit' },
  { re: /^(?:appearance|look|รูปลักษณ์|รูปร่าง|ลักษณะ)\s*[:：=]\s*/i, key: 'appearance' },
  { re: /^(?:personality|บุคลิก|นิสัย)\s*[:：=]\s*/i, key: 'personality' },
  { re: /^(?:age|อายุ)\s*[:：=]\s*/i, key: 'age' },
  { re: /^(?:gender|เพศ)\s*[:：=]\s*/i, key: 'gender' }
];

export interface ExtractedAppearance {
  face: string;
  hair: string;
  outfit: string;
  appearance: string;
  personality: string;
  age: string;
  gender: string;
}

function classify(seg: string): 'face' | 'hair' | 'outfit' | 'appearance' | 'personality' | 'neutral' {
  if (HAIR_RE.test(seg)) return 'hair';
  if (OUTFIT_RE.test(seg)) return 'outfit';
  if (FACE_RE.test(seg)) return 'face';
  if (BODY_RE.test(seg)) return 'appearance';
  if (PERSONALITY_RE.test(seg)) return 'personality';
  return 'neutral';
}

/**
 * Splits a free-text character description (from the script's character list or a
 * library "description") into face / hair / outfit / appearance / personality.
 * Only text that is literally present is returned; nothing is invented.
 */
export function extractAppearanceFromDescription(description: string): ExtractedAppearance {
  const out: ExtractedAppearance = { face: '', hair: '', outfit: '', appearance: '', personality: '', age: '', gender: '' };
  const text = clean(description);
  if (!text) return out;
  const add = (key: keyof ExtractedAppearance, v: string) => {
    const s = v.trim().replace(/^[,;、\s]+|[,;、\s]+$/g, '');
    if (!s) return;
    out[key] = out[key] ? `${out[key]}, ${s}` : s;
  };

  // 1. Labeled chunks: "face: ..., hair: ..., outfit: ..." (separators , ; | or newline)
  const chunks = text.split(/\s*[;|\n]\s*|,\s*(?=(?:face|hair|hairstyle|outfit|costume|appearance|look|personality|age|gender|ใบหน้า|หน้าตา|หน้า|ทรงผม|ผม|ชุด|เสื้อผ้า|การแต่งกาย|รูปลักษณ์|รูปร่าง|บุคลิก|นิสัย|อายุ|เพศ)\s*[:：=])/i).filter(Boolean);
  const unlabeled: string[] = [];
  for (const chunk of chunks) {
    const label = LABELS.find(l => l.re.test(chunk));
    if (label) add(label.key, chunk.replace(label.re, ''));
    else unlabeled.push(chunk);
  }

  // 2. Unlabeled text: split into comma / space separated segments and classify each.
  //    A neutral segment right after a visual one continues it ("ผมยาว สีดำ").
  for (const chunk of unlabeled) {
    const segs = chunk.split(/\s*,\s*|\s+/).filter(Boolean);
    let prev: ReturnType<typeof classify> | null = null;
    let buf = '';
    const flush = () => {
      if (!buf) return;
      if (prev === 'face' || prev === 'hair' || prev === 'outfit' || prev === 'appearance') add(prev, buf);
      else add('personality', buf);
      buf = '';
    };
    for (const seg of segs) {
      let kind = classify(seg);
      if (kind === 'neutral' && prev && prev !== 'personality' && (prev as string) !== 'neutral') kind = prev; // continuation
      if (kind === 'neutral') kind = 'personality';
      if (kind !== prev) { flush(); prev = kind; }
      buf = buf ? `${buf} ${seg}` : seg;
    }
    flush();
  }

  const ageM = text.match(AGE_RE);
  if (ageM && !out.age) out.age = `${ageM[1]} ปี`;
  return out;
}

/** Builds the resolved profile from supplied (library / API) data only. */
function fromSupplied(c: CharacterAppearanceInput | undefined | null) {
  const empty = { face: '', hair: '', outfit: '', appearance: '', gender: '', age: '', build: '', accessories: '', personality: '', triggerTag: '', shoes: '', referenceImageUrl: '', referenceType: '', referenceMissing: false };
  if (!c) return empty;
  const vp = c.visualProfile || {};
  const sf = c.structuredFeatures || {};
  const sp = c.storyProfile || {};
  const face = clean(c.face) || clean(c.faceDescription) || clean(vp.face) || join(sf.faceShape, sf.eyeDescription, sf.skinTone);
  const hair = clean(c.hairstyle) || clean(c.hair) || clean(vp.hair) || join(c.hairStyle || vp.hairStyle || sf.hairStyle, vp.hairColor || sf.hairColor);
  const shoes = clean(c.shoes) || clean(vp.shoes) || clean(sf.footwear);
  const outfit = clean(c.outfit) || clean(c.outfitDescription) || clean(c.costume) || clean(vp.visibleOutfit) ||
    join(vp.top, vp.bottom) || join(sf.topClothing, sf.bottomClothing);
  let appearance = clean(c.appearance) || clean(vp.visiblePhysicalAppearance) || join(sf.bodyType, sf.distinctFeatures);
  let personality = clean(c.personality) || clean(sp.personality);
  // A library "description" is used as appearance only when it actually describes looks
  const desc = clean(c.description);
  if (desc) {
    const ex = extractAppearanceFromDescription(desc);
    const visual = ex.face || ex.hair || ex.outfit || ex.appearance;
    if (visual && !appearance) appearance = desc;
    else if (!visual && !personality) personality = desc;
  }
  return {
    face, hair, outfit, appearance,
    gender: clean(c.gender),
    age: clean(c.age) || clean(sp.age),
    build: clean(c.build),
    accessories: clean(c.accessories) || clean(vp.visibleAccessories) || clean(vp.accessories) || clean(c.jewelry) || clean(sf.accessories),
    personality,
    triggerTag: clean(c.triggerTag),
    shoes,
    ...referenceOf(c)
  };
}

/** Reference image of a library card: URL (or data URL backup), type and missing flag. */
function referenceOf(c: CharacterAppearanceInput): { referenceImageUrl: string; referenceType: string; referenceMissing: boolean } {
  const vp = c.visualProfile || {};
  const rm = c.referenceMetadata || {};
  const url = String(c.referenceImageUrl || rm.referenceImageUrl || vp.referenceImageUrl || vp.referenceImage || (Array.isArray(c.referenceImages) ? c.referenceImages[0] : '') || '').trim();
  // hasReferenceBackup: the backup exists but was not sent (request size)
  const backup = String(c.referenceImageBackup || (c.hasReferenceBackup ? 'data:image/backup' : '')).trim();
  const views: string[] = Array.isArray(rm.availableViews) ? rm.availableViews : (Array.isArray(vp.detectedViews) ? vp.detectedViews : []);
  const referenceType = String(c.referenceType || (views.includes('MULTI_VIEWS') || vp.isMultiViewSheet ? 'MULTI_VIEWS' : (views[0] || ''))).trim();
  // Card says it has a reference (URL / hash / type) but the file is gone (checked by the caller) or no URL at all
  const declared = !!(url || backup || c.imageHash || rm.imageHash || c.referenceImageId || rm.referenceImageId);
  const statusMissing = c.referenceStatus === 'missing';
  if (backup && (statusMissing || !url)) return { referenceImageUrl: backup, referenceType, referenceMissing: false };
  return { referenceImageUrl: statusMissing ? '' : url, referenceType, referenceMissing: declared && (statusMissing || !url) };
}

/** Thai honorific prefixes ignored when matching a script name to a library card ("พี่ทุย" = "ทุย"). */
const NAME_PREFIX_RE = /^(?:พี่|น้อง|คุณ|นางสาว|นาง|นาย|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.)/;

/**
 * Name key for matching: NFC, no zero-width chars, no parenthetical ("ฟ้าใส (Fahsai)"),
 * no whitespace, lower case. `stripPrefix` also drops one Thai honorific prefix.
 */
export function normalizeCharacterNameKey(name: string, stripPrefix = false): string {
  let s = String(name || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\([^)]*\)/g, '').replace(/[“”"'`]/g, '').replace(/\s+/g, '').toLowerCase().trim();
  if (stripPrefix) {
    const stripped = s.replace(NAME_PREFIX_RE, '');
    if (stripped.length >= 2) s = stripped;
  }
  return s;
}

/**
 * Library / declared character for a script name. Exact match first, then exact after
 * normalizing spacing / parentheticals, then exact after dropping one honorific prefix
 * (พี่ / น้อง / คุณ ...) on both sides - the last two only when exactly one card matches.
 * No substring / prefix fuzzy matching ("น้อง" never matches "น้องน้ำ").
 */
export function findCharacterByName<T extends { name?: string }>(list: T[] | undefined | null, name: string): T | undefined {
  const target = String(name || '').trim();
  if (!target || !Array.isArray(list)) return undefined;
  const exact = list.find(c => String(c?.name || '').trim() === target);
  if (exact) return exact;
  for (const strip of [false, true]) {
    const key = normalizeCharacterNameKey(target, strip);
    if (key.length < 2) continue;
    const hits = list.filter(c => normalizeCharacterNameKey(String(c?.name || ''), strip) === key);
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return undefined; // ambiguous: never guess
  }
  return undefined;
}

export function missingReferenceWarning(name: string): string {
  return `รูปอ้างอิงของ ${name} หาย กรุณาอัปโหลดใหม่ / Reference image for ${name} is missing — please re-upload it in the character library`;
}

export function missingAppearanceWarning(name: string): string {
  return `ยังไม่ได้ระบุรูปลักษณ์ของ ${name} (ใบหน้า / ทรงผม / ชุด) — ใส่ข้อมูลในคลังตัวละคร หรือเขียนในรายชื่อตัวละครของบท / No appearance given for ${name}`;
}
export function partialAppearanceWarning(name: string, missing: string[]): string {
  const th: Record<string, string> = { face: 'ใบหน้า', hair: 'ทรงผม', outfit: 'ชุด' };
  return `รูปลักษณ์ของ ${name} ยังไม่ครบ: ขาด ${missing.map(m => th[m] || m).join(' / ')} / Appearance of ${name} is missing: ${missing.join(', ')}`;
}

/**
 * Resolves one profile per character name.
 * supplied: characters from the UI library / request body.
 * scriptDeclared: the script's own character list ({ name, description }).
 */
export function resolveCharacterProfiles(
  names: string[],
  supplied: CharacterAppearanceInput[] = [],
  scriptDeclared: Array<{ name: string; description?: string }> = []
): { profiles: ResolvedCharacterProfile[]; warnings: string[] } {
  const uniq = Array.from(new Set((names || []).map(n => String(n || '').trim()).filter(Boolean)));
  const profiles: ResolvedCharacterProfile[] = [];
  const warnings: string[] = [];
  for (const name of uniq) {
    const sup = fromSupplied(findCharacterByName(supplied || [], name));
    const decl = findCharacterByName(scriptDeclared || [], name);
    const ex = extractAppearanceFromDescription(decl?.description || '');
    const pick = (a: string, b: string) => a || b;
    const face = pick(sup.face, ex.face);
    const hair = pick(sup.hair, ex.hair);
    const outfit = pick(sup.outfit, ex.outfit);
    const appearance = pick(sup.appearance, ex.appearance);
    const supVisual = !!(sup.face || sup.hair || sup.outfit || sup.appearance);
    const scriptVisual = !!(ex.face || ex.hair || ex.outfit || ex.appearance);
    const usedScript = (!sup.face && !!ex.face) || (!sup.hair && !!ex.hair) || (!sup.outfit && !!ex.outfit) || (!sup.appearance && !!ex.appearance);
    const source: ResolvedCharacterProfile['source'] = supVisual && usedScript ? 'supplied+script' : supVisual ? 'supplied' : scriptVisual ? 'script' : 'none';
    const hasAppearance = !!(face || hair || outfit || appearance);
    const missing = (['face', 'hair', 'outfit'] as const).filter(k => !({ face, hair, outfit } as any)[k]);
    const profile: ResolvedCharacterProfile = {
      name, face, hair, outfit, appearance,
      gender: sup.gender || ex.gender,
      age: sup.age || ex.age,
      build: sup.build,
      accessories: sup.accessories,
      personality: sup.personality || ex.personality,
      triggerTag: sup.triggerTag,
      shoes: sup.shoes,
      referenceImageUrl: sup.referenceImageUrl,
      referenceType: sup.referenceType,
      referenceMissing: sup.referenceMissing,
      source, hasAppearance, missing: [...missing]
    };
    if (sup.referenceMissing) warnings.push(missingReferenceWarning(name));
    if (!hasAppearance) warnings.push(missingAppearanceWarning(name));
    else if (missing.length > 0 && !appearance) warnings.push(partialAppearanceWarning(name, [...missing]));
    profiles.push(profile);
  }
  return { profiles, warnings };
}

/**
 * "พี่ทุย (face: ...; hair: ...; outfit: ...)". When no appearance is known the
 * personality text is kept ("พี่ทุย (personality: ...)") - never a fake appearance.
 */
/** Library "Default pose: ..." sentences are dropped: the pose of each clip comes from the Stance/Position Lock + action. */
export function stripDefaultPose(text: string): string {
  return String(text || '').replace(/(^|[\s.;])(?:Default|Standard|Idle)\s+pose\s*:[^.]*(?:\.|$)/gi, '$1').replace(/\s{2,}/g, ' ').trim();
}

/** Field value for the lock: no trailing period; quoted when it contains the "; " / " | " separators. */
function lockValue(v: string): string {
  const t = stripDefaultPose(v).replace(/[\s.]+$/, '').trim();
  return /;|\|/.test(t) ? `"${t.replace(/"/g, "'")}"` : t;
}

export function formatCharacterAppearanceLock(p: ResolvedCharacterProfile): string {
  if (!p) return '';
  const field = (label: string, v?: string) => { const t = v ? lockValue(v) : ''; return t ? `${label}: ${t}` : ''; };
  const fields = p.hasAppearance
    ? [
        field('face', p.face),
        field('hair', p.hair),
        field('outfit', p.outfit),
        field('shoes', p.shoes),
        field('appearance', p.appearance),
        field('gender', p.gender),
        field('age', p.age),
        field('build', p.build),
        field('accessories', p.accessories),
        field('tag', p.triggerTag)
      ]
    : [
        field('gender', p.gender),
        field('age', p.age),
        field('build', p.build),
        field('accessories', p.accessories),
        field('personality', p.personality),
        field('tag', p.triggerTag)
      ];
  const f = fields.filter(Boolean);
  return f.length > 0 ? `${p.name} (${f.join('; ')})` : p.name;
}

/** "Reference image: พี่ทุย reference sheet (multi-view) — match exactly" ('' when the card has no usable reference). */
export function formatReferenceImageLine(p: ResolvedCharacterProfile): string {
  if (!p || !p.referenceImageUrl) return '';
  const kind = p.referenceType === 'MULTI_VIEWS' ? 'reference sheet (multi-view)' : 'reference image';
  return `${p.name} ${kind} — match exactly`;
}

/** Convenience: "Character Lock: A (...) | B (...)" text + warnings for a list of names. */
export function buildCharacterAppearanceLock(
  names: string[],
  supplied: CharacterAppearanceInput[] = [],
  scriptDeclared: Array<{ name: string; description?: string }> = []
): { text: string; profiles: ResolvedCharacterProfile[]; warnings: string[] } {
  const r = resolveCharacterProfiles(names, supplied, scriptDeclared);
  return { text: r.profiles.map(formatCharacterAppearanceLock).join(' | '), profiles: r.profiles, warnings: r.warnings };
}

/**
 * Reads "name — description" / "name: description" / "name (description)" lines from the
 * character list block before the first scene header. Used when a parser did not keep
 * descriptions (e.g. the em-dash form "- พี่ทุย — ...").
 */
export function parseScriptCharacterList(scriptText: string): Array<{ name: string; description: string }> {
  const lines = String(scriptText || '').split(/\r?\n/).map(l => l.trim());
  const out: Array<{ name: string; description: string }> = [];
  let inBlock = false;
  for (const line of lines) {
    if (!line) continue;
    if (/^(?:#{1,6}\s*)?[*_\[【(]*\s*(?:ฉากที่|ฉาก|scene|clip)\s*\d+/i.test(line) || /^STORY\s*[:{]/i.test(line)) break;
    const header = line.match(/^(?:ตัวละครหลัก|ตัวละคร|รายชื่อตัวละคร|characters?)\s*[:：]?\s*(.*)$/i);
    if (header) { inBlock = true; continue; }
    if (!inBlock) continue;
    const m = line.match(/^[-*•\d.)\s]*([ก-๙a-zA-Z0-9_ ]{1,30}?)\s*(?:[—–]|\s-\s|[:：])\s*(.+)$/) ||
      line.match(/^[-*•\d.)\s]*([ก-๙a-zA-Z0-9_ ]{1,30}?)\s*\((.+)\)\s*$/);
    if (m) {
      const name = m[1].trim();
      if (/^(?:ชื่อเรื่อง|เรื่อง|สถานที่(?:หลัก)?|เวลา|ช่วงเวลา|แสง|สไตล์|โทนภาพ|อุปกรณ์|พร็อพ|title|location|time|lighting|style|props)$/i.test(name)) { inBlock = false; continue; }
      if (name && !out.some(c => c.name === name)) out.push({ name, description: m[2].trim() });
      continue;
    }
    if (/^[A-Za-zก-๙ ]{1,20}\s*[:：=]/.test(line)) inBlock = false; // next metadata key
  }
  return out;
}

/**
 * Script-declared characters for the Character Lock: the parser's declared characters that
 * carry a description + the character list lines of the raw script (one merged list used by
 * split, Multi-Clip and continuation).
 */
export function mergeDeclaredCharacters(
  declared: Array<{ name?: string; description?: string }> | undefined | null,
  scriptText = ''
): Array<{ name: string; description: string }> {
  return [
    ...(declared || []).filter(c => c && c.name && c.description).map(c => ({ name: String(c.name), description: String(c.description) })),
    ...(scriptText ? parseScriptCharacterList(scriptText) : [])
  ];
}

/** Master Continuity Lock main character as a supplied Character Lock entry ([] when no characterName). */
export function continuityLockCharacter(lock: any): CharacterAppearanceInput[] {
  return lock?.characterName ? [{ name: lock.characterName, face: lock.characterFace, hair: lock.characterHair, outfit: lock.characterCostume, description: lock.characterAppearance }] : [];
}

/**
 * Lock-relevant fields of a UI library character, sent to /api/script/split,
 * /api/director/generate-multi-clip-prompts and /api/story/continue (no images).
 */
export function toCharacterLockPayload(c: any): CharacterAppearanceInput {
  const vp = c?.visualProfile;
  const sf = c?.structuredFeatures;
  const sp = c?.storyProfile;
  return {
    id: c?.id, name: String(c?.name || ''), gender: c?.gender, age: c?.age, build: c?.build,
    face: c?.face, hairstyle: c?.hairstyle, hairStyle: c?.hairStyle, outfit: c?.outfit,
    outfitDescription: c?.outfitDescription, costume: c?.costume, appearance: c?.appearance,
    accessories: c?.accessories, jewelry: c?.jewelry, description: c?.description,
    personality: c?.personality, triggerTag: c?.triggerTag, shoes: c?.shoes,
    // Reference image (URL only, never image bytes, except a small data-URL backup) + reachability
    referenceImageUrl: c?.referenceImageUrl || c?.referenceMetadata?.referenceImageUrl || c?.visualProfile?.referenceImageUrl || undefined,
    referenceImageBackup: typeof c?.referenceImageBackup === 'string' && c.referenceImageBackup.length < 900_000 ? c.referenceImageBackup : undefined,
    referenceImageId: c?.referenceImageId, imageHash: c?.imageHash, referenceType: c?.referenceType,
    referenceStatus: c?.referenceStatus, hasReferenceBackup: c?.hasReferenceBackup || undefined,
    referenceMetadata: c?.referenceMetadata ? { availableViews: c.referenceMetadata.availableViews, imageHash: c.referenceMetadata.imageHash, referenceImageId: c.referenceMetadata.referenceImageId, referenceImageUrl: c.referenceMetadata.referenceImageUrl } : undefined,
    visualProfile: vp ? {
      hair: vp.hair, hairStyle: vp.hairStyle, hairColor: vp.hairColor, top: vp.top, bottom: vp.bottom, shoes: vp.shoes,
      visibleOutfit: vp.visibleOutfit, visibleAccessories: vp.visibleAccessories,
      visiblePhysicalAppearance: vp.visiblePhysicalAppearance, detectedViews: vp.detectedViews, isMultiViewSheet: vp.isMultiViewSheet,
      referenceImageUrl: vp.referenceImageUrl
    } : undefined,
    structuredFeatures: sf ? {
      faceShape: sf.faceShape, eyeDescription: sf.eyeDescription, skinTone: sf.skinTone,
      hairStyle: sf.hairStyle, hairColor: sf.hairColor, topClothing: sf.topClothing,
      bottomClothing: sf.bottomClothing, footwear: sf.footwear, bodyType: sf.bodyType,
      distinctFeatures: sf.distinctFeatures, accessories: sf.accessories
    } : undefined,
    storyProfile: sp ? { age: sp.age, personality: sp.personality } : undefined
  };
}
