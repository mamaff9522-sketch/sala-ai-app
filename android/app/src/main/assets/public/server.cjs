var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_crypto2 = __toESM(require("crypto"), 1);
var import_vite = require("vite");
var import_dotenv = __toESM(require("dotenv"), 1);
var import_genai = require("@google/genai");
var import_stripe = __toESM(require("stripe"), 1);
var import_app = require("firebase/app");
var import_firestore = require("firebase/firestore");

// src/services/characterAppearance.ts
var PLACEHOLDER_RE = /^(?:ตามภาพอ้างอิง|ตามเนื้อเรื่อง|ไม่ระบุ(?:จากต้นฉบับ)?|ไม่เห็นชัด(?:ในภาพ)?|มองไม่เห็น(?:ในภาพ)?|ไม่มี|ไม่ทราบ|รูปลักษณ์ชัดเจน.*|-|n\/a|none|unknown|not visible|ตัวละครเอกประจำสตูดิโอศาลาเอไอ)$/i;
var clean = (v) => {
  if (v === null || v === void 0) return "";
  const s = String(v).replace(/\s+/g, " ").trim();
  if (!s || PLACEHOLDER_RE.test(s) || /ตามเนื้อเรื่อง$/.test(s)) return "";
  return s;
};
var join = (...parts) => parts.map(clean).filter(Boolean).join(", ");
var FACE_RE = /(ใบหน้า|หน้าตา|หน้า(?:กลม|เรียว|รูปไข่|เหลี่ยม|คม|หวาน|ใส|ตี๋|มน)|ดวงตา|ตา(?:โต|คม|ตี่|สี|ชั้นเดียว|สองชั้น|กลม)|คิ้ว|ริมฝีปาก|ผิว(?:ขาว|คล้ำ|แทน|สองสี|เนียน|สี)|หนวด|เครา|ไฝ|แว่น|ลักยิ้ม|\bface\b|\beyes?\b|\bskin\b|\bbeard\b|\bmustache\b|\bglasses\b|\bfreckles?\b|\bdimples?\b)/i;
var HAIR_RE = /(ทรงผม|ผม(?:สั้น|ยาว|หยิก|ตรง|ดำ|สี|ม้า|รวบ|มัด|ทอง|น้ำตาล|เปีย|บ็อบ|บ๊อบ|ประบ่า|หางม้า|ฟู|ลอน|ดัด|เทา|ขาว|แดง|รองทรง|เกรียน|ซอย|หน้าม้า)|หัวเกรียน|หัวล้าน|\bhair\b|\bhaired\b|\bponytail\b|\bbob\b|\bbangs\b|\bbraids?\b|\bbald\b)/i;
var OUTFIT_RE = /(ใส่(?!ใจ)|สวม|ชุด|เสื้อ|กางเกง|กระโปรง|รองเท้า|หมวก|เดรส|แจ็คเก็ต|แจ็กเก็ต|ยูนิฟอร์ม|เครื่องแบบ|ผ้าพันคอ|\bwearing\b|\bwears\b|\boutfit\b|\bshirt\b|\bdress\b|\bjacket\b|\bjeans\b|\bskirt\b|\buniform\b|\bhoodie\b|\bt-shirt\b|\bpolo\b|\bsuit\b|\bsneakers\b)/i;
var BODY_RE = /(รูปร่าง|หุ่น|ร่าง(?:ผอม|ท้วม|สูง|เล็ก|ใหญ่)|ตัว(?:สูง|เล็ก|ใหญ่|เตี้ย)|ผอมสูง|สูงโปร่ง|ล่ำ|สูง\s*\d+|\btall\b|\bslim\b|\bslender\b|\bchubby\b|\bmuscular\b|\bpetite\b|\bstocky\b)/i;
var PERSONALITY_RE = /(บุคลิก|นิสัย|ใจ|อารมณ์|ชอบ|รัก|พูด|ขี้|เก่ง|ฉลาด|ร่าเริง|เงียบ|แกล้ง|personality|\bkind\b|\bshy\b)/i;
var AGE_RE = /(?:อายุ\s*)?(\d{1,3})\s*(?:ปี|ขวบ|years?\s*old|y\/o)/i;
var LABELS = [
  { re: /^(?:face|ใบหน้า|หน้าตา|หน้า)\s*[:：=]\s*/i, key: "face" },
  { re: /^(?:hair(?:style)?|ทรงผม|ผม)\s*[:：=]\s*/i, key: "hair" },
  { re: /^(?:outfit|costume|clothes|ชุด|เสื้อผ้า|การแต่งกาย|เครื่องแต่งกาย)\s*[:：=]\s*/i, key: "outfit" },
  { re: /^(?:appearance|look|รูปลักษณ์|รูปร่าง|ลักษณะ)\s*[:：=]\s*/i, key: "appearance" },
  { re: /^(?:personality|บุคลิก|นิสัย)\s*[:：=]\s*/i, key: "personality" },
  { re: /^(?:age|อายุ)\s*[:：=]\s*/i, key: "age" },
  { re: /^(?:gender|เพศ)\s*[:：=]\s*/i, key: "gender" }
];
function classify(seg) {
  if (HAIR_RE.test(seg)) return "hair";
  if (OUTFIT_RE.test(seg)) return "outfit";
  if (FACE_RE.test(seg)) return "face";
  if (BODY_RE.test(seg)) return "appearance";
  if (PERSONALITY_RE.test(seg)) return "personality";
  return "neutral";
}
function extractAppearanceFromDescription(description) {
  const out = { face: "", hair: "", outfit: "", appearance: "", personality: "", age: "", gender: "" };
  const text = clean(description);
  if (!text) return out;
  const add = (key, v) => {
    const s = v.trim().replace(/^[,;、\s]+|[,;、\s]+$/g, "");
    if (!s) return;
    out[key] = out[key] ? `${out[key]}, ${s}` : s;
  };
  const chunks = text.split(/\s*[;|\n]\s*|,\s*(?=(?:face|hair|hairstyle|outfit|costume|appearance|look|personality|age|gender|ใบหน้า|หน้าตา|หน้า|ทรงผม|ผม|ชุด|เสื้อผ้า|การแต่งกาย|รูปลักษณ์|รูปร่าง|บุคลิก|นิสัย|อายุ|เพศ)\s*[:：=])/i).filter(Boolean);
  const unlabeled = [];
  for (const chunk of chunks) {
    const label = LABELS.find((l) => l.re.test(chunk));
    if (label) add(label.key, chunk.replace(label.re, ""));
    else unlabeled.push(chunk);
  }
  for (const chunk of unlabeled) {
    const segs = chunk.split(/\s*,\s*|\s+/).filter(Boolean);
    let prev = null;
    let buf = "";
    const flush = () => {
      if (!buf) return;
      if (prev === "face" || prev === "hair" || prev === "outfit" || prev === "appearance") add(prev, buf);
      else add("personality", buf);
      buf = "";
    };
    for (const seg of segs) {
      let kind = classify(seg);
      if (kind === "neutral" && prev && prev !== "personality" && prev !== "neutral") kind = prev;
      if (kind === "neutral") kind = "personality";
      if (kind !== prev) {
        flush();
        prev = kind;
      }
      buf = buf ? `${buf} ${seg}` : seg;
    }
    flush();
  }
  const ageM = text.match(AGE_RE);
  if (ageM && !out.age) out.age = `${ageM[1]} \u0E1B\u0E35`;
  return out;
}
function fromSupplied(c) {
  const empty = { face: "", hair: "", outfit: "", appearance: "", gender: "", age: "", build: "", accessories: "", personality: "", triggerTag: "", shoes: "", referenceImageUrl: "", referenceType: "", referenceMissing: false };
  if (!c) return empty;
  const vp = c.visualProfile || {};
  const sf = c.structuredFeatures || {};
  const sp = c.storyProfile || {};
  const face = clean(c.face) || clean(c.faceDescription) || clean(vp.face) || join(sf.faceShape, sf.eyeDescription, sf.skinTone);
  const hair = clean(c.hairstyle) || clean(c.hair) || clean(vp.hair) || join(c.hairStyle || vp.hairStyle || sf.hairStyle, vp.hairColor || sf.hairColor);
  const shoes = clean(c.shoes) || clean(vp.shoes) || clean(sf.footwear);
  const outfit = clean(c.outfit) || clean(c.outfitDescription) || clean(c.costume) || clean(vp.visibleOutfit) || join(vp.top, vp.bottom) || join(sf.topClothing, sf.bottomClothing);
  let appearance = clean(c.appearance) || clean(vp.visiblePhysicalAppearance) || join(sf.bodyType, sf.distinctFeatures);
  let personality = clean(c.personality) || clean(sp.personality);
  const desc = clean(c.description);
  if (desc) {
    const ex = extractAppearanceFromDescription(desc);
    const visual = ex.face || ex.hair || ex.outfit || ex.appearance;
    if (visual && !appearance) appearance = desc;
    else if (!visual && !personality) personality = desc;
  }
  return {
    face,
    hair,
    outfit,
    appearance,
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
function referenceOf(c) {
  const vp = c.visualProfile || {};
  const rm = c.referenceMetadata || {};
  const url = String(c.referenceImageUrl || rm.referenceImageUrl || vp.referenceImageUrl || vp.referenceImage || (Array.isArray(c.referenceImages) ? c.referenceImages[0] : "") || "").trim();
  const backup = String(c.referenceImageBackup || (c.hasReferenceBackup ? "data:image/backup" : "")).trim();
  const views = Array.isArray(rm.availableViews) ? rm.availableViews : Array.isArray(vp.detectedViews) ? vp.detectedViews : [];
  const referenceType = String(c.referenceType || (views.includes("MULTI_VIEWS") || vp.isMultiViewSheet ? "MULTI_VIEWS" : views[0] || "")).trim();
  const declared = !!(url || backup || c.imageHash || rm.imageHash || c.referenceImageId || rm.referenceImageId);
  const statusMissing = c.referenceStatus === "missing";
  if (backup && (statusMissing || !url)) return { referenceImageUrl: backup, referenceType, referenceMissing: false };
  return { referenceImageUrl: statusMissing ? "" : url, referenceType, referenceMissing: declared && (statusMissing || !url) };
}
var NAME_PREFIX_RE = /^(?:พี่|น้อง|คุณ|นางสาว|นาง|นาย|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.)/;
function normalizeCharacterNameKey(name, stripPrefix = false) {
  let s = String(name || "").normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\([^)]*\)/g, "").replace(/[“”"'`]/g, "").replace(/\s+/g, "").toLowerCase().trim();
  if (stripPrefix) {
    const stripped = s.replace(NAME_PREFIX_RE, "");
    if (stripped.length >= 2) s = stripped;
  }
  return s;
}
function findCharacterByName(list, name) {
  const target = String(name || "").trim();
  if (!target || !Array.isArray(list)) return void 0;
  const exact = list.find((c) => String(c?.name || "").trim() === target);
  if (exact) return exact;
  for (const strip of [false, true]) {
    const key = normalizeCharacterNameKey(target, strip);
    if (key.length < 2) continue;
    const hits = list.filter((c) => normalizeCharacterNameKey(String(c?.name || ""), strip) === key);
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return void 0;
  }
  return void 0;
}
function missingReferenceWarning(name) {
  return `\u0E23\u0E39\u0E1B\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07\u0E02\u0E2D\u0E07 ${name} \u0E2B\u0E32\u0E22 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14\u0E43\u0E2B\u0E21\u0E48 / Reference image for ${name} is missing \u2014 please re-upload it in the character library`;
}
function missingAppearanceWarning(name) {
  return `\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E30\u0E1A\u0E38\u0E23\u0E39\u0E1B\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C\u0E02\u0E2D\u0E07 ${name} (\u0E43\u0E1A\u0E2B\u0E19\u0E49\u0E32 / \u0E17\u0E23\u0E07\u0E1C\u0E21 / \u0E0A\u0E38\u0E14) \u2014 \u0E43\u0E2A\u0E48\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E19\u0E04\u0E25\u0E31\u0E07\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23 \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E02\u0E35\u0E22\u0E19\u0E43\u0E19\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E02\u0E2D\u0E07\u0E1A\u0E17 / No appearance given for ${name}`;
}
function partialAppearanceWarning(name, missing) {
  const th = { face: "\u0E43\u0E1A\u0E2B\u0E19\u0E49\u0E32", hair: "\u0E17\u0E23\u0E07\u0E1C\u0E21", outfit: "\u0E0A\u0E38\u0E14" };
  return `\u0E23\u0E39\u0E1B\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C\u0E02\u0E2D\u0E07 ${name} \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E04\u0E23\u0E1A: \u0E02\u0E32\u0E14 ${missing.map((m) => th[m] || m).join(" / ")} / Appearance of ${name} is missing: ${missing.join(", ")}`;
}
function resolveCharacterProfiles(names, supplied = [], scriptDeclared = []) {
  const uniq = Array.from(new Set((names || []).map((n) => String(n || "").trim()).filter(Boolean)));
  const profiles = [];
  const warnings = [];
  for (const name of uniq) {
    const sup = fromSupplied(findCharacterByName(supplied || [], name));
    const decl = findCharacterByName(scriptDeclared || [], name);
    const ex = extractAppearanceFromDescription(decl?.description || "");
    const pick = (a, b) => a || b;
    const face = pick(sup.face, ex.face);
    const hair = pick(sup.hair, ex.hair);
    const outfit = pick(sup.outfit, ex.outfit);
    const appearance = pick(sup.appearance, ex.appearance);
    const supVisual = !!(sup.face || sup.hair || sup.outfit || sup.appearance);
    const scriptVisual = !!(ex.face || ex.hair || ex.outfit || ex.appearance);
    const usedScript = !sup.face && !!ex.face || !sup.hair && !!ex.hair || !sup.outfit && !!ex.outfit || !sup.appearance && !!ex.appearance;
    const source = supVisual && usedScript ? "supplied+script" : supVisual ? "supplied" : scriptVisual ? "script" : "none";
    const hasAppearance = !!(face || hair || outfit || appearance);
    const missing = ["face", "hair", "outfit"].filter((k) => !{ face, hair, outfit }[k]);
    const profile = {
      name,
      face,
      hair,
      outfit,
      appearance,
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
      source,
      hasAppearance,
      missing: [...missing]
    };
    if (sup.referenceMissing) warnings.push(missingReferenceWarning(name));
    if (!hasAppearance) warnings.push(missingAppearanceWarning(name));
    else if (missing.length > 0 && !appearance) warnings.push(partialAppearanceWarning(name, [...missing]));
    profiles.push(profile);
  }
  return { profiles, warnings };
}
function stripDefaultPose(text) {
  return String(text || "").replace(/(^|[\s.;])(?:Default|Standard|Idle)\s+pose\s*:[^.]*(?:\.|$)/gi, "$1").replace(/\s{2,}/g, " ").trim();
}
function lockValue(v) {
  const t = stripDefaultPose(v).replace(/[\s.]+$/, "").trim();
  return /;|\|/.test(t) ? `"${t.replace(/"/g, "'")}"` : t;
}
function formatCharacterAppearanceLock(p) {
  if (!p) return "";
  const field = (label, v) => {
    const t = v ? lockValue(v) : "";
    return t ? `${label}: ${t}` : "";
  };
  const fields = p.hasAppearance ? [
    field("face", p.face),
    field("hair", p.hair),
    field("outfit", p.outfit),
    field("shoes", p.shoes),
    field("appearance", p.appearance),
    field("gender", p.gender),
    field("age", p.age),
    field("build", p.build),
    field("accessories", p.accessories),
    field("tag", p.triggerTag)
  ] : [
    field("gender", p.gender),
    field("age", p.age),
    field("build", p.build),
    field("accessories", p.accessories),
    field("personality", p.personality),
    field("tag", p.triggerTag)
  ];
  const f = fields.filter(Boolean);
  return f.length > 0 ? `${p.name} (${f.join("; ")})` : p.name;
}
function formatReferenceImageLine(p) {
  if (!p || !p.referenceImageUrl) return "";
  const kind = p.referenceType === "MULTI_VIEWS" ? "reference sheet (multi-view)" : "reference image";
  return `${p.name} ${kind} \u2014 match exactly`;
}
function buildCharacterAppearanceLock(names, supplied = [], scriptDeclared = []) {
  const r = resolveCharacterProfiles(names, supplied, scriptDeclared);
  return { text: r.profiles.map(formatCharacterAppearanceLock).join(" | "), profiles: r.profiles, warnings: r.warnings };
}
function parseScriptCharacterList(scriptText) {
  const lines = String(scriptText || "").split(/\r?\n/).map((l) => l.trim());
  const out = [];
  let inBlock = false;
  for (const line of lines) {
    if (!line) continue;
    if (/^(?:#{1,6}\s*)?[*_\[【(]*\s*(?:ฉากที่|ฉาก|scene|clip)\s*\d+/i.test(line) || /^STORY\s*[:{]/i.test(line)) break;
    const header = line.match(/^(?:ตัวละครหลัก|ตัวละคร|รายชื่อตัวละคร|characters?)\s*[:：]?\s*(.*)$/i);
    if (header) {
      inBlock = true;
      continue;
    }
    if (!inBlock) continue;
    const m = line.match(/^[-*•\d.)\s]*([ก-๙a-zA-Z0-9_ ]{1,30}?)\s*(?:[—–]|\s-\s|[:：])\s*(.+)$/) || line.match(/^[-*•\d.)\s]*([ก-๙a-zA-Z0-9_ ]{1,30}?)\s*\((.+)\)\s*$/);
    if (m) {
      const name = m[1].trim();
      if (/^(?:ชื่อเรื่อง|เรื่อง|สถานที่(?:หลัก)?|เวลา|ช่วงเวลา|แสง|สไตล์|โทนภาพ|อุปกรณ์|พร็อพ|title|location|time|lighting|style|props)$/i.test(name)) {
        inBlock = false;
        continue;
      }
      if (name && !out.some((c) => c.name === name)) out.push({ name, description: m[2].trim() });
      continue;
    }
    if (/^[A-Za-zก-๙ ]{1,20}\s*[:：=]/.test(line)) inBlock = false;
  }
  return out;
}
function mergeDeclaredCharacters(declared, scriptText = "") {
  return [
    ...(declared || []).filter((c) => c && c.name && c.description).map((c) => ({ name: String(c.name), description: String(c.description) })),
    ...scriptText ? parseScriptCharacterList(scriptText) : []
  ];
}
function continuityLockCharacter(lock) {
  return lock?.characterName ? [{ name: lock.characterName, face: lock.characterFace, hair: lock.characterHair, outfit: lock.characterCostume, description: lock.characterAppearance }] : [];
}

// src/services/continuityEngine.ts
function sceneWarningsFor(warnings, clipIndex1, sceneNumber) {
  return (warnings || []).filter((w) => w.clipNumber === clipIndex1).map((w) => ({ ...w, clipNumber: sceneNumber, message: w.message.replace(/^คลิป \d+/, `\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${sceneNumber}`) }));
}
function expandCombinedCharacterNames(names) {
  const out = [];
  (names || []).forEach((raw) => {
    const n = String(raw || "").trim();
    if (!n) return;
    const parts = n.split(/\s*(?:,|、|&|และ|กับ|\band\b)\s*/i).map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2 && parts.every((x) => x.length >= 2)) parts.forEach((x) => out.push(x));
    else out.push(n);
  });
  return Array.from(new Set(out));
}
var EVERYONE_RE = /(?:ทั้งคู่|ทั้งสองคน|ทั้งสอง|ทุกคน|\bboth\b|\beveryone\b|\btogether\b)/i;
var POSTURE_LABEL = {
  standing: "standing (\u0E22\u0E37\u0E19)",
  sitting: "sitting (\u0E19\u0E31\u0E48\u0E07)",
  lying: "lying down (\u0E19\u0E2D\u0E19)",
  kneeling: "kneeling (\u0E04\u0E38\u0E01\u0E40\u0E02\u0E48\u0E32)",
  walking: "walking (\u0E40\u0E14\u0E34\u0E19)",
  unknown: "pose as established"
};
var TRANSITIONS = [
  { re: /(?:นั่งลง|ลงนั่ง|ทรุดตัว(?:ลง)?นั่ง|ทิ้งตัว(?:ลง)?นั่ง|ทรุดตัวลง|\bsits? down\b|\bsat down\b|\btakes? a seat\b)/i, posture: "sitting" },
  { re: /(?:ลุกขึ้น|ลุกยืน|ผุดลุก|ลุกจาก|ลุก|\bstands? up\b|\bstood up\b|\bgets? up\b)/i, posture: "standing" },
  { re: /(?:ล้มตัว(?:ลง)?นอน|เอนตัว(?:ลง)?นอน|ล้มลง|\blies? down\b|\blay down\b)/i, posture: "lying" },
  { re: /(?:คุกเข่าลง|ทรุดลงคุกเข่า|\bkneels? down\b)/i, posture: "kneeling" },
  { re: /(?:เดิน|วิ่ง|ก้าว|ขยับ(?:เข้า|ไป|มา)|ย้ายไป|เข้าไปหา|\bwalks?\b|\bruns?\b|\bsteps?\b|\bmoves?\b|\bapproach(?:es)?\b)/i, posture: "walking" }
];
var STATICS = [
  { re: /(?:นั่ง|\bsitting\b|\bseated\b)/i, posture: "sitting" },
  { re: /(?:ยืน|\bstanding\b)/i, posture: "standing" },
  { re: /(?:นอน|\blying\b)/i, posture: "lying" },
  { re: /(?:คุกเข่า|\bkneeling\b)/i, posture: "kneeling" }
];
var LEAVE_RE = /(?:เดินออกไป|เดินจากไป|ออกไปจาก|ออกจาก(?:ห้อง|บ้าน|ฉาก|ร้าน)|จากไป|หายตัวไป|หายไป|ออกไป|\bleaves?\b|\bexits?\b|\bwalks? out\b|\bleft\b)/i;
var ENTER_RE = /(?:เดินเข้ามา|เข้ามา|มาถึง|กลับมา|ปรากฏตัว|โผล่มา|\benters?\b|\barrives?\b|\bwalks? in\b|\bcomes? back\b)/i;
var GROUP_RE = /(?:ทั้งคู่|ทั้งสอง|ทุกคน|พวกเขา|\bboth\b|\beveryone\b)/i;
var PLACE_RE = /(?:อยู่)?((?:ที่|บน|หน้า|ข้าง|ตรง|ริม|ใกล้|หลัง|ใน)[ก-๙A-Za-z0-9]{2,24})/;
var NOT_PLACE_RE = /^(?:หน้าจอ|หน้าตา|หน้าที่|หน้าต่อไป|ในที่สุด|ในใจ|ที่สุด|ที่จะ|ที่ไม่|ที่เคย|ที่ทำ|ข้างใน)/;
var ARRIVE_HERE_RE = /(?:เดินกลับมา|กลับมา|เดินมา|เข้ามา|มาถึง|\bcomes? back\b|\barrives?\b)/i;
var OBJECT_MARKER_RE = /(?:ให้|มือ|หา|มอง|ถาม|กับ|ของ|โทรศัพท์|มือถือ|รอ|จับ|ตาม|ถึง|เห็น|แกล้ง|รัก|กอด|ข้าง|หลัง|หน้า)\s*$/;
var PROP_WORDS = "\u0E42\u0E17\u0E23\u0E28\u0E31\u0E1E\u0E17\u0E4C|\u0E21\u0E37\u0E2D\u0E16\u0E37\u0E2D|\u0E41\u0E01\u0E49\u0E27\u0E19\u0E49\u0E33|\u0E41\u0E01\u0E49\u0E27|\u0E01\u0E23\u0E30\u0E40\u0E1B\u0E4B\u0E32|\u0E08\u0E14\u0E2B\u0E21\u0E32\u0E22|\u0E14\u0E2D\u0E01\u0E44\u0E21\u0E49|\u0E01\u0E38\u0E0D\u0E41\u0E08|\u0E23\u0E48\u0E21|\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E37\u0E2D|\u0E44\u0E1F\u0E09\u0E32\u0E22|\u0E15\u0E30\u0E40\u0E01\u0E35\u0E22\u0E07|\u0E01\u0E25\u0E48\u0E2D\u0E07|\u0E41\u0E2B\u0E27\u0E19|\u0E23\u0E39\u0E1B\u0E16\u0E48\u0E32\u0E22|phone|bag|letter|flowers?|key|umbrella|book|flashlight|box|ring";
function segmentsOf(text) {
  return (text || "").replace(/["“”][^"“”]*["“”]/g, " ").split(/[\n.!?。]+|\s+/).map((s) => s.trim()).filter(Boolean);
}
function mentionedIn(seg, names) {
  return names.map((n) => ({ n, i: seg.indexOf(n) })).filter((x) => x.i >= 0).sort((a, b) => a.i - b.i).map((x) => x.n);
}
function subjectsAndObjects(seg, names) {
  const found = [];
  for (const n of names) {
    let from = 0;
    let i;
    while ((i = seg.indexOf(n, from)) >= 0) {
      if (!found.some((f) => i >= f.i && i < f.i + f.n.length)) found.push({ n, i });
      from = i + n.length;
    }
  }
  found.sort((a, b) => a.i - b.i);
  const subjects = [];
  const objects = [];
  for (const f of found) {
    const isObject = f.i > 0 && OBJECT_MARKER_RE.test(seg.slice(0, f.i));
    const list = isObject ? objects : subjects;
    if (!list.includes(f.n)) list.push(f.n);
  }
  return { subjects, objects };
}
function readSegment(seg, names, lastSubjects, present, location = "") {
  const so = subjectsAndObjects(seg, names);
  const mentioned = [...so.subjects, ...so.objects.filter((o) => !so.subjects.includes(o))];
  let subjects = so.subjects.length > 0 ? [so.subjects[0]] : lastSubjects;
  if (GROUP_RE.test(seg)) subjects = present.length > 0 ? [...present] : mentioned;
  const ev = { subjects, kind: "none", posture: "unknown", place: "" };
  const destination = so.objects.find((o) => !subjects.includes(o)) || (mentioned.length > 1 ? mentioned[1] : "");
  if (LEAVE_RE.test(seg)) {
    ev.kind = "leave";
    return ev;
  }
  let tIdx = -1;
  let lastIdx = -1;
  let lastPosture = "unknown";
  for (const t of TRANSITIONS) {
    const re = new RegExp(t.re.source, "gi");
    let m;
    while ((m = re.exec(seg)) !== null) {
      if (tIdx === -1 || m.index < tIdx) tIdx = m.index;
      if (m.index >= lastIdx) {
        lastIdx = m.index;
        lastPosture = t.posture;
      }
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  let sIdx = -1;
  let sPosture = "unknown";
  for (const st of STATICS) {
    const re = new RegExp(st.re.source, "gi");
    let m;
    while ((m = re.exec(seg)) !== null) {
      if (sIdx === -1 || m.index < sIdx) {
        sIdx = m.index;
        sPosture = st.posture;
      }
      if (tIdx >= 0 && m.index > lastIdx) {
        lastIdx = m.index;
        lastPosture = st.posture;
      }
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  if (tIdx >= 0) {
    ev.kind = "transition";
    ev.posture = lastPosture;
  } else if (sIdx >= 0) {
    ev.kind = "static";
    ev.posture = sPosture;
  } else if (ENTER_RE.test(seg)) {
    ev.kind = "enter";
    ev.posture = "standing";
  }
  if (ev.kind !== "none") {
    const from = Math.max(0, ev.kind === "transition" ? tIdx : ev.kind === "static" ? sIdx : 0);
    const placeMatches = Array.from(seg.slice(from).matchAll(new RegExp(PLACE_RE.source, "g"))).filter((m) => !NOT_PLACE_RE.test(m[1]) && !names.some((n) => m[1].endsWith(n) && !m[1].startsWith("\u0E02\u0E49\u0E32\u0E07")));
    const pm = placeMatches.length > 0 ? placeMatches[placeMatches.length - 1] : null;
    if (pm) ev.place = pm[1];
    else if (destination && (ev.kind === "transition" || ev.kind === "enter")) ev.place = `\u0E02\u0E49\u0E32\u0E07${destination}`;
    else if (location && (ev.kind === "transition" || ev.kind === "enter") && ARRIVE_HERE_RE.test(seg)) ev.place = location;
  }
  return ev;
}
function samePlace(a, b) {
  if (!a || !b) return true;
  const norm = (s) => s.replace(/^(?:อยู่|ที่|บน|ตรง|ใน)/, "");
  const x = norm(a);
  const y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
}
function analyzeClipContinuity(params) {
  const names = Array.from(new Set(expandCombinedCharacterNames(params.lockedCharacters || []).map((n) => (n || "").trim()).filter((n) => n.length >= 2))).sort((a, b) => b.length - a.length);
  const state = /* @__PURE__ */ new Map();
  let present = [];
  (params.initialPoses || []).forEach((p) => {
    if (!p?.name) return;
    state.set(p.name, { ...p });
    if (!present.includes(p.name)) present.push(p.name);
  });
  const warnings = [];
  const out = [];
  params.clips.forEach((clip, idx) => {
    const clipNumber = idx + 1;
    const text = clip.text || "";
    const speakers = (clip.speakers || []).filter(Boolean);
    const carried = [...present];
    const startMap = /* @__PURE__ */ new Map();
    carried.forEach((n) => startMap.set(n, { ...state.get(n) || { name: n, posture: "unknown", place: "" } }));
    const mentioned = new Set(mentionedIn(text, names));
    speakers.forEach((s) => {
      const exact = names.find((x) => s === x);
      if (exact) mentioned.add(exact);
      else names.filter((x) => s.includes(x)).forEach((x) => mentioned.add(x));
    });
    if (EVERYONE_RE.test(text)) carried.forEach((n) => mentioned.add(n));
    const entered = [];
    const left = [];
    const movedInClip = /* @__PURE__ */ new Set();
    const checkedFirstPose = /* @__PURE__ */ new Set();
    let lastSubjects = [];
    const presentNow = () => Array.from(/* @__PURE__ */ new Set([...carried.filter((n) => !left.includes(n)), ...entered]));
    const firstPose = /* @__PURE__ */ new Map();
    const getState = (who) => state.get(who) || { name: who, posture: "unknown", place: "" };
    const patch = (who, p) => {
      const next = { ...getState(who), ...p, name: who };
      ["holding", "gesture", "facing"].forEach((k) => {
        if (!next[k]) delete next[k];
      });
      delete next.entering;
      state.set(who, next);
    };
    const ensureEntered = (who) => {
      if (!carried.includes(who) && !entered.includes(who) && !left.includes(who)) entered.push(who);
    };
    for (const seg of segmentsOf(text)) {
      const ev = readSegment(seg, names, lastSubjects, presentNow(), clip.location || "");
      if (ev.subjects.length > 0) lastSubjects = ev.subjects;
      for (const who of ev.subjects) {
        if (!who) continue;
        const wasPresent = carried.includes(who) || entered.includes(who);
        if (!wasPresent && ev.kind !== "leave") entered.push(who);
        if (ev.kind === "leave") {
          if (!left.includes(who)) left.push(who);
          continue;
        }
        if (ev.kind === "none") continue;
        const prev = getState(who);
        if (!carried.includes(who) && !firstPose.has(who)) {
          firstPose.set(who, ev.kind === "static" ? { name: who, posture: ev.posture, place: ev.place || "" } : { name: who, posture: "walking", place: "", entering: true });
        }
        if (ev.kind === "static" && carried.includes(who) && !movedInClip.has(who) && !checkedFirstPose.has(who)) {
          const start = startMap.get(who);
          if (start && start.posture !== "unknown" && start.posture !== "walking" && start.posture !== ev.posture) {
            warnings.push({
              clipNumber,
              type: "pose_jump",
              character: who,
              message: `\u0E04\u0E25\u0E34\u0E1B ${clipNumber}: ${who} \u0E17\u0E48\u0E32\u0E17\u0E32\u0E07\u0E01\u0E23\u0E30\u0E42\u0E14\u0E14 \u0E08\u0E32\u0E01${POSTURE_LABEL[start.posture]}${start.place ? ` ${start.place}` : ""} \u0E40\u0E1B\u0E47\u0E19${POSTURE_LABEL[ev.posture]}${ev.place ? ` ${ev.place}` : ""} \u0E42\u0E14\u0E22\u0E1A\u0E17\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E02\u0E22\u0E31\u0E1A / pose jump without movement`
            });
          } else if (start && start.posture === ev.posture && !samePlace(start.place, ev.place)) {
            warnings.push({
              clipNumber,
              type: "place_jump",
              character: who,
              message: `\u0E04\u0E25\u0E34\u0E1B ${clipNumber}: ${who} \u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E01\u0E23\u0E30\u0E42\u0E14\u0E14 \u0E08\u0E32\u0E01 ${start.place} \u0E40\u0E1B\u0E47\u0E19 ${ev.place} \u0E42\u0E14\u0E22\u0E1A\u0E17\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E17\u0E35\u0E48 / position jump without movement`
            });
          }
        }
        if (ev.kind === "static") checkedFirstPose.add(who);
        const moved = ev.kind === "transition" || ev.kind === "enter";
        if (moved) movedInClip.add(who);
        const posture = ev.posture === "walking" ? "standing" : ev.posture;
        const place = ev.place || (ev.posture === "walking" ? "" : prev.place || "");
        const changed = posture !== prev.posture || !samePlace(prev.place, place);
        patch(who, moved || changed ? { posture, place, gesture: "", facing: "" } : { posture, place });
      }
      applyHandsAndFacing(seg, ev.subjects, names, getState, patch, ensureEntered);
    }
    mentioned.forEach((n) => {
      if (!carried.includes(n) && !entered.includes(n) && !left.includes(n)) entered.push(n);
      if (!state.has(n)) state.set(n, { name: n, posture: "unknown", place: "" });
    });
    const sameSceneAsPrevious = !!clip.sceneKey && idx > 0 && params.clips[idx - 1]?.sceneKey === clip.sceneKey;
    carried.forEach((n) => {
      if (!sameSceneAsPrevious && !mentioned.has(n) && !left.includes(n)) {
        warnings.push({
          clipNumber,
          type: "missing_character",
          character: n,
          message: `\u0E04\u0E25\u0E34\u0E1B ${clipNumber}: \u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01 ${n} \u0E2B\u0E32\u0E22\u0E44\u0E1B\u0E08\u0E32\u0E01\u0E04\u0E25\u0E34\u0E1B\u0E42\u0E14\u0E22\u0E1A\u0E17\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E2D\u0E2D\u0E01\u0E44\u0E1B / locked character disappears without leaving`
        });
      }
    });
    const charactersPresent = Array.from(/* @__PURE__ */ new Set([...carried, ...entered]));
    const startPoses = charactersPresent.map((n) => startMap.get(n) || firstPose.get(n) || { name: n, posture: "unknown", place: "" });
    present = charactersPresent.filter((n) => !left.includes(n));
    const endPoses = present.map((n) => ({ ...getState(n) }));
    out.push({ clipNumber, charactersPresent, startPoses: startPoses.map((p) => ({ ...p })), endPoses, entered, left });
  });
  return { clips: out, warnings };
}
function applyHandsAndFacing(seg, subjects, names, getState, patch, ensureEntered) {
  const who = subjects[0];
  const nameAlt = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const nameAfter = (re) => {
    if (!nameAlt) return "";
    const m = seg.match(new RegExp(re.source + `(${nameAlt})`));
    return m ? m[m.length - 1] : "";
  };
  const propRe = new RegExp(`(${PROP_WORDS})`, "i");
  if (who) {
    const give = seg.match(new RegExp(`\u0E22\u0E37\u0E48\u0E19(${PROP_WORDS})`, "i"));
    const receive = seg.match(new RegExp(`\u0E23\u0E31\u0E1A(${PROP_WORDS})`, "i"));
    const hold = seg.match(new RegExp(`(?:\u0E16\u0E37\u0E2D|\u0E2B\u0E22\u0E34\u0E1A|\u0E01\u0E33|\u0E04\u0E27\u0E49\u0E32)(${PROP_WORDS})`, "i"));
    const giveBack = /(?:วาง|ส่ง|ยื่น)?คืน(?:ให้)?/.test(seg) && /คืน/.test(seg);
    if (give) {
      const to = nameAfter(/ให้/);
      patch(who, { holding: `\u0E22\u0E37\u0E48\u0E19${give[1]}${to ? `\u0E43\u0E2B\u0E49${to}` : ""}` });
    } else if (receive) {
      const prop = receive[1];
      names.forEach((n) => {
        if (n !== who && (getState(n).holding || "").includes(prop)) patch(n, { holding: "" });
      });
      patch(who, { holding: `\u0E16\u0E37\u0E2D${prop}` });
    } else if (giveBack) {
      const held = getState(who).holding || "";
      const pm = held.match(propRe);
      const to = nameAfter(/ให้/);
      patch(who, { holding: "" });
      if (to && pm) {
        ensureEntered(to);
        patch(to, { holding: `${pm[1]} (${who}\u0E27\u0E32\u0E07\u0E04\u0E37\u0E19\u0E43\u0E2B\u0E49)` });
      }
    } else if (hold) {
      patch(who, { holding: `\u0E16\u0E37\u0E2D${hold[1]}` });
    }
    const hand = nameAfter(/จับมือ/);
    if (hand && hand !== who) {
      patch(who, { gesture: `\u0E08\u0E31\u0E1A\u0E21\u0E37\u0E2D${hand}` });
      patch(hand, { gesture: `\u0E16\u0E39\u0E01${who}\u0E08\u0E31\u0E1A\u0E21\u0E37\u0E2D` });
    }
    const look = nameAfter(/(?:มอง|หันไปหา|หันไปมอง|จ้อง)/);
    if (look && look !== who) patch(who, { facing: `\u0E21\u0E2D\u0E07${look}` });
  }
  const screen = /กด(?:ปิด|เปิด)?(?:หน้าจอ|โทรศัพท์|มือถือ)/.test(seg);
  if (screen) {
    const owner = who || "";
    if (owner && !(getState(owner).holding || "").includes("\u0E42\u0E17\u0E23\u0E28\u0E31\u0E1E\u0E17\u0E4C")) patch(owner, { holding: "\u0E16\u0E37\u0E2D\u0E42\u0E17\u0E23\u0E28\u0E31\u0E1E\u0E17\u0E4C" });
  }
}
function describePose(p) {
  if (p.entering) return `${p.name} enters the frame during this clip (walking in)`;
  const extras = [
    p.holding ? `holding: ${p.holding}` : "",
    p.gesture ? `gesture: ${p.gesture}` : "",
    p.facing ? `facing: ${p.facing}` : ""
  ].filter(Boolean);
  const where = p.place ? ` at ${p.place}` : p.posture === "unknown" ? "" : " (place unspecified in script, keep previous)";
  return `${p.name} ${POSTURE_LABEL[p.posture] || POSTURE_LABEL.unknown}${where}${extras.length ? ` [${extras.join(", ")}]` : ""}`;
}
function formatPositionLock(state, isFirstClip = false) {
  if (!state || state.startPoses.length === 0 && state.endPoses.length === 0) return "";
  const parts = [];
  if (state.startPoses.length > 0) {
    parts.push(`${isFirstClip ? "Start pose" : "Start pose (must exactly match the end pose of the previous clip)"}: ${state.startPoses.map(describePose).join("; ")}`);
  }
  if (state.endPoses.length > 0) parts.push(`End pose (hand off to next clip): ${state.endPoses.map(describePose).join("; ")}`);
  return `Stance/Position Lock: ${parts.join(". ")}`;
}
function formatContinuityForPrompt(state, isFirstClip = false) {
  if (!state || state.charactersPresent.length === 0) return "";
  const parts = [];
  parts.push(`Characters present in this clip: ${state.charactersPresent.join(", ")} (all must stay visible unless the action says they leave)`);
  const pos = formatPositionLock(state, isFirstClip);
  if (pos) parts.push(pos);
  if (state.left && state.left.length > 0) parts.push(`Leaves the frame during this clip: ${state.left.join(", ")}`);
  parts.push("Do not change any posture, position, hand prop or gesture unless the action explicitly describes it");
  return parts.join(". ");
}
function enforcePoseHandoff(clips) {
  const warnings = [];
  const result = clips.map((c) => ({ ...c }));
  for (let i = 1; i < result.length; i++) {
    const prevEnd = result[i - 1].endPoses || [];
    if (prevEnd.length === 0) continue;
    const start = result[i].startPoses || [];
    const text = `${result[i].startAction || ""} ${result[i].sceneSummary || ""}`;
    const fixed = prevEnd.map((p) => {
      const given = start.find((s) => s.name === p.name);
      const clipNumber = result[i].clipNumber || i + 1;
      if (given && given.posture !== "unknown" && p.posture !== "unknown" && given.posture !== p.posture) {
        const moved = text.includes(p.name) && TRANSITIONS.some((t) => t.re.test(text));
        if (!moved) {
          warnings.push({ clipNumber, type: "handoff_mismatch", character: p.name, message: `\u0E04\u0E25\u0E34\u0E1B ${clipNumber}: \u0E17\u0E48\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21\u0E02\u0E2D\u0E07 ${p.name} (${POSTURE_LABEL[given.posture]}) \u0E44\u0E21\u0E48\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E17\u0E48\u0E32\u0E08\u0E1A\u0E04\u0E25\u0E34\u0E1B\u0E01\u0E48\u0E2D\u0E19 (${POSTURE_LABEL[p.posture]}) \u2014 \u0E43\u0E0A\u0E49\u0E17\u0E48\u0E32\u0E08\u0E1A\u0E04\u0E25\u0E34\u0E1B\u0E01\u0E48\u0E2D\u0E19\u0E41\u0E17\u0E19` });
        }
      } else if (given && given.posture === p.posture && given.place && p.place && !samePlace(given.place, p.place)) {
        const moved = text.includes(p.name) && TRANSITIONS.some((t) => t.re.test(text));
        if (!moved) {
          warnings.push({ clipNumber, type: "place_jump", character: p.name, message: `\u0E04\u0E25\u0E34\u0E1B ${clipNumber}: \u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E40\u0E23\u0E34\u0E48\u0E21\u0E02\u0E2D\u0E07 ${p.name} (${given.place}) \u0E44\u0E21\u0E48\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E08\u0E1A\u0E04\u0E25\u0E34\u0E1B\u0E01\u0E48\u0E2D\u0E19 (${p.place}) \u2014 \u0E43\u0E0A\u0E49\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E08\u0E1A\u0E04\u0E25\u0E34\u0E1B\u0E01\u0E48\u0E2D\u0E19\u0E41\u0E17\u0E19 / position jump` });
        }
      }
      return { ...p };
    });
    start.forEach((s) => {
      if (!fixed.some((f) => f.name === s.name)) fixed.push({ ...s });
    });
    result[i].startPoses = fixed;
  }
  return { clips: result, warnings };
}
function normalizePoseList(raw) {
  if (!Array.isArray(raw)) return [];
  const allowed = ["standing", "sitting", "lying", "kneeling", "walking", "unknown"];
  return raw.filter((p) => p && typeof p.name === "string" && p.name.trim()).map((p) => {
    const posture = String(p.posture || "").toLowerCase().trim();
    const out = { name: p.name.trim(), posture: allowed.includes(posture) ? posture : "unknown", place: typeof p.place === "string" ? p.place.trim() : "" };
    ["holding", "gesture", "facing"].forEach((k) => {
      if (typeof p[k] === "string" && p[k].trim()) out[k] = p[k].trim();
    });
    return out;
  });
}
function buildCharacterLockText(c, fallbackDescription = "") {
  if (!c) return "";
  const name = String(c.name || "").trim();
  if (!name) return "";
  return buildCharacterAppearanceLock([name], [c], fallbackDescription ? [{ name, description: fallbackDescription }] : []).text;
}
function lightingForTime(timeOfDay, override = "") {
  if (override && override.trim()) return override.trim();
  const t = timeOfDay || "";
  if (/(กลางคืน|ดึก|ค่ำ|night|midnight)/i.test(t)) return "low-key night lighting, warm practical lamps, soft moonlight fill, consistent across clips";
  if (/(เย็น|พลบ|สายัณห์|dusk|evening|sunset)/i.test(t)) return "warm golden-hour evening sunlight from a low angle, soft long shadows, consistent across clips";
  if (/(เช้า|รุ่ง|dawn|morning)/i.test(t)) return "soft cool morning daylight, gentle haze, consistent across clips";
  if (/(กลางวัน|เที่ยง|บ่าย|day|noon)/i.test(t)) return "bright natural daylight, soft diffused shadows, consistent across clips";
  return "natural consistent lighting matched across clips";
}
function formatLocationLock(l) {
  if (!l || !l.location) return "";
  return `Location Lock: ${l.location}${l.timeOfDay ? `, ${l.timeOfDay}` : ""}. Lighting Lock: ${l.lighting} (identical set, props and lighting in every clip at this location)` + (l.setDetails ? `. Set Lock: ${l.setDetails}` : "") + (l.props ? `. Props Lock: ${l.props}` : "");
}
var PROMPT_LABELS = "Character Lock|Location Lock|Time|Lighting Lock|Scene Action|Dialogue|Starting moment|Ending momentum|Camera|Set Lock|Props Lock|Props";
function syncLocationLockInPrompt(prompt, lock) {
  let p = String(prompt || "");
  const seg = (label, value) => {
    const v = String(value || "").trim();
    if (!v || v.includes("\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38")) return;
    const re = new RegExp(`${label}: .*?(?=, (?:${PROMPT_LABELS}):|\\. Continuity Handoff:|$)`);
    if (re.test(p)) p = p.replace(re, `${label}: ${v}`);
    else if (!p.includes(v)) p = `${p}${p ? ", " : ""}${label}: ${v}`;
  };
  seg("Location Lock", lock?.location);
  seg("Time", lock?.timeOfDay);
  seg("Lighting Lock", lock?.lighting);
  const extra = (label, value) => {
    const v = String(value || "").trim();
    if (v && !p.includes(v)) p = `${p}${p ? ", " : ""}${label}: ${v}`;
  };
  extra("Set Lock", lock?.locationVisualDetails);
  extra("Props Lock", lock?.props);
  return p;
}
function storyKey(t) {
  return String(t || "").replace(/^\[[^\]]*\]\s*/, "").replace(/\(ล็อคตำแหน่ง:[^)]*\)/g, "").replace(/[\s"'“”‘’.,!?…:;()\[\]\-–—]/g, "");
}
function checkStoryRepeats(newScenes, existingScenes = []) {
  const out = [];
  const existing = (existingScenes || []).map((e) => ({ n: Number(e?.sceneNumber) || 0, key: storyKey(e?.summary || e?.startAction || "") }));
  (newScenes || []).forEach((sc) => {
    const n = Number(sc?.sceneNumber) || 0;
    const key = storyKey(sc?.actionDescription || "");
    const sameNum = existing.find((e) => e.n > 0 && e.n === n);
    const sameText = key.length >= 15 ? existing.find((e) => e.key.length >= 15 && (e.key === key || e.key.includes(key) || key.includes(e.key))) : void 0;
    const hit = sameText || sameNum;
    if (hit) out.push({
      clipNumber: n,
      type: "story_repeat",
      character: "",
      message: `\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${n}: ${sameText ? `\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E2B\u0E32\u0E0B\u0E49\u0E33\u0E01\u0E31\u0E1A\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${hit.n} \u0E17\u0E35\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E1B\u0E41\u0E25\u0E49\u0E27` : `\u0E40\u0E25\u0E02\u0E09\u0E32\u0E01\u0E0B\u0E49\u0E33\u0E01\u0E31\u0E1A\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E1B\u0E41\u0E25\u0E49\u0E27`} \u2014 Story Lock: \u0E15\u0E49\u0E2D\u0E07\u0E15\u0E48\u0E2D\u0E08\u0E32\u0E01\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E25\u0E48\u0E32\u0E0B\u0E49\u0E33 / story repeat`
    });
  });
  return out;
}

// src/services/promptSections.ts
var KNOWN_SECTION_LABELS = [
  "Character Lock",
  "Reference image",
  "Location Lock (library, verbatim)",
  "Location Lock",
  "Location",
  "Architectural Environment",
  "Setting",
  "Set Design",
  "Set Details",
  "Scene Setting",
  "Environment",
  "Background",
  "Atmosphere",
  "Spatial Positioning Lock",
  "Props",
  "Starting moment",
  "Core action",
  "Ending momentum",
  "Cinematography",
  "Camera",
  "Dialogue",
  "Soundscape",
  "Audio",
  "Continuity Handoff",
  "Stance/Position Lock",
  "Negative prompt"
];
var esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var LABEL_ALT = KNOWN_SECTION_LABELS.map(esc).join("|");
var LABEL_RE = new RegExp(`(^|[\\s.;,|])(${LABEL_ALT}):`, "g");
function findSections(prompt) {
  const hits = [];
  LABEL_RE.lastIndex = 0;
  let m;
  while (m = LABEL_RE.exec(prompt)) {
    const start = m.index + m[1].length;
    hits.push({ label: m[2], start });
  }
  return hits.map((h, i) => {
    const end = i + 1 < hits.length ? hits[i + 1].start : prompt.length;
    return { label: h.label, start: h.start, end, text: prompt.slice(h.start, end).trim() };
  });
}
function removeSections(prompt, pred) {
  const sections = findSections(prompt).filter(pred);
  if (sections.length === 0) return { prompt, firstIndex: -1 };
  let out = prompt;
  for (let i = sections.length - 1; i >= 0; i--) out = out.slice(0, sections[i].start) + out.slice(sections[i].end);
  return { prompt: out, firstIndex: sections[0].start };
}
function insertBlock(prompt, index, block) {
  const before = prompt.slice(0, Math.max(0, index)).replace(/[\s;,|]+$/, "");
  const after = prompt.slice(Math.max(0, index)).replace(/^[\s.;,|]+/, "");
  const b = block.trim().replace(/\.*$/, ".");
  return tidy(`${before}${before ? /[.!?]$/.test(before) ? " " : ". " : ""}${b}${after ? ` ${after}` : ""}`);
}
function tidy(prompt) {
  return prompt.replace(/\s{2,}/g, " ").replace(/\s+\./g, ".").replace(/\.(\s*\.)+/g, ".").trim();
}
function stripExact(prompt, texts) {
  let out = prompt;
  for (const t of texts) if (t && t.length > 20) out = out.split(t).join(" ");
  return out;
}
function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  return haystack.split(needle).length - 1;
}

// src/services/locationAppearance.ts
var PLACEHOLDER_RE2 = /^(?:ไม่ระบุ(?:จากต้นฉบับ)?|ตามภาพอ้างอิง|-|n\/a|none|unknown)$/i;
function missingLocationWarning(name) {
  return `\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48 ${name} \u0E43\u0E19\u0E04\u0E25\u0E31\u0E07 \u2014 \u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E43\u0E19\u0E04\u0E25\u0E31\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48 \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E08\u0E32\u0E01\u0E04\u0E25\u0E31\u0E07 / Location "${name}" is not in the location library`;
}
function missingLocationReferenceWarning(name) {
  return `\u0E23\u0E39\u0E1B\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07\u0E02\u0E2D\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48 ${name} \u0E2B\u0E32\u0E22 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14\u0E43\u0E2B\u0E21\u0E48 / Reference photo for location ${name} is missing \u2014 please re-upload it`;
}
function normalizeLocationNameKey(name) {
  return String(name || "").normalize("NFC").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\([^)]*\)/g, "").replace(/[“”"'`]/g, "").replace(/\s+/g, "").toLowerCase().trim();
}
var namesOf = (l) => [l?.name, l?.storyProfile?.storyLocationName, l?.identity?.name].map((n) => String(n || "").trim()).filter(Boolean);
function findLocationByName(list, name) {
  const target = String(name || "").trim();
  if (!target || !Array.isArray(list)) return void 0;
  const exact = list.filter((l) => namesOf(l).includes(target));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return void 0;
  const key = normalizeLocationNameKey(target);
  if (key.length < 2) return void 0;
  const hits = list.filter((l) => namesOf(l).some((n) => normalizeLocationNameKey(n) === key));
  return hits.length === 1 ? hits[0] : void 0;
}
function locationDescriptionOf(l) {
  const clean2 = (v2) => {
    const s = String(v2 ?? "").trim();
    return s && !PLACEHOLDER_RE2.test(s) ? s : "";
  };
  const direct = clean2(l?.lockDescription) || clean2(l?.storyProfile?.description) || clean2(l?.description);
  if (direct) return direct;
  const v = l?.visualProfile || {};
  return [
    v.architecturalStyle && `Architecture: ${v.architecturalStyle}`,
    v.environmentType && `Environment: ${v.environmentType}`,
    v.wallColor && `Walls: ${v.wallColor}`,
    v.floor && `Floor: ${v.floor}`,
    v.ceiling && `Ceiling: ${v.ceiling}`,
    v.doors && `Doors: ${v.doors}`,
    v.windows && `Windows: ${v.windows}`,
    v.majorFurniture && `Furniture: ${v.majorFurniture}`,
    v.fixedObjects && `Fixed objects: ${v.fixedObjects}`,
    v.spatialLayout && `Layout: ${v.spatialLayout}`,
    v.permanentDecor && `Decor: ${v.permanentDecor}`,
    v.distinctiveFeatures && `Key features: ${v.distinctiveFeatures}`
  ].map(clean2).filter(Boolean).join("; ");
}
function resolveLocationLock(name, library = [], selectedId) {
  const card = selectedId && library.find((l) => l.id === selectedId) || findLocationByName(library, name);
  const shownName = String(name || card?.name || "").trim();
  if (!card) return { name: shownName, found: false, description: "", referenceLine: "", warnings: shownName ? [missingLocationWarning(shownName)] : [] };
  const description = locationDescriptionOf(card);
  const url = String(card.referenceImageUrl || "").trim();
  const backup = !!(card.referenceImageBackup || card.hasReferenceBackup);
  const declared = !!(url || backup || card.imageHash || card.referenceImageId);
  const missing = card.referenceStatus === "missing" || !url && !backup;
  const usable = url && card.referenceStatus !== "missing" || backup;
  const warnings = [];
  if (declared && missing && !backup) warnings.push(missingLocationReferenceWarning(shownName));
  return {
    name: shownName,
    found: true,
    description,
    referenceLine: usable ? `${shownName} reference photo \u2014 match exactly (do not add, remove or move objects)` : "",
    warnings
  };
}
function formatLocationLockBlock(r) {
  const desc = r.description.trim();
  const parts = [`Location: ${r.name}`];
  if (desc) parts.push(`Location Lock (library, verbatim): ${desc}${/[.!?]$/.test(desc) ? "" : "."}`);
  let block = parts.join(". ");
  if (!desc && !/[.]$/.test(block)) block += ".";
  if (r.referenceLine) block += ` Reference image: ${r.referenceLine}.`;
  return block;
}
function headingLocation(title) {
  const t = String(title || "").replace(/^\s*(?:ฉากที่|ฉาก|scene|clip)\s*\d+\s*[:.\-—–]?\s*/i, "").replace(/\((?:ประมาณ|about|~)?\s*\d+[^)]*\)/g, "").trim();
  if (!t) return { name: "", structured: false };
  const parts = t.split(/\s*\/\s*|\s+[-—–]\s+/).map((x) => x.trim()).filter(Boolean);
  return { name: parts[0] || "", structured: parts.length > 1 };
}
var SET_LABELS = /* @__PURE__ */ new Set(["Location", "Location Lock", "Location Lock (library, verbatim)", "Architectural Environment", "Setting", "Set Design", "Set Details", "Scene Setting", "Environment", "Background"]);
function enforceLibraryLocationLocks(clips, library, opts = {}) {
  if (!Array.isArray(library)) return clips;
  const selected = opts.selectedLocationId ? library.find((l) => l.id === opts.selectedLocationId) : void 0;
  const knownDescriptions = library.map((l) => locationDescriptionOf(l)).filter((d) => d.length > 20);
  let previousMatched = "";
  return clips.map((c) => {
    let name = selected?.name || opts.lockedLocation || c.locationName || "";
    if (!name) {
      const h = headingLocation(String(c.title || ""));
      if (h.name && (findLocationByName(library, h.name) || h.structured)) name = h.name;
      else name = previousMatched;
    }
    const r = resolveLocationLock(name, library, selected?.id);
    if (r.found) previousMatched = r.name;
    const out = { ...c, locationWarnings: r.warnings };
    if (!r.found) return out;
    const block = formatLocationLockBlock(r);
    let prompt = stripExact(String(c.generatedPrompt || ""), [block, ...knownDescriptions]);
    const removed = removeSections(prompt, (s) => SET_LABELS.has(s.label) || s.label === "Reference image" && /reference photo — match exactly/.test(s.text));
    prompt = removed.prompt;
    let insertAt = removed.firstIndex;
    const first = findSections(prompt)[0];
    if (insertAt === -1 || insertAt > prompt.length) {
      insertAt = first ? first.start : prompt.length;
    }
    prompt = insertBlock(prompt, insertAt, block);
    if (opts.rebuildAtmosphere && (opts.timeOfDay || opts.lighting)) {
      const atm = findSections(prompt).find((s) => s.label === "Atmosphere");
      if (atm) prompt = tidy(`${prompt.slice(0, atm.start)}Atmosphere: ${[opts.timeOfDay, opts.lighting].filter(Boolean).join(", ")}. ${prompt.slice(atm.end)}`);
    }
    out.generatedPrompt = prompt;
    out.locationName = r.name;
    return out;
  });
}

// src/services/salaDirectorEngine.ts
var RESERVED_SYSTEM_KEYWORDS = [
  "LOCK",
  "CONT",
  "FRAME",
  "AUTO",
  "RULE",
  "NO",
  "OUT",
  "STORY",
  "CHARACTERS",
  "END",
  "SALA_MULTI_CLIP"
];
var RESERVED_KEYWORD_SET = new Set(
  RESERVED_SYSTEM_KEYWORDS.map((k) => k.toUpperCase())
);
function isReservedSystemKeyword(word) {
  if (!word) return false;
  const clean2 = word.trim().toUpperCase().replace(/[:=_{}\[\]]/g, "");
  return RESERVED_KEYWORD_SET.has(clean2);
}
var SPEECH_VERBS = [
  "\u0E01\u0E23\u0E30\u0E0B\u0E34\u0E1A\u0E01\u0E23\u0E30\u0E0B\u0E32\u0E1A",
  "\u0E01\u0E23\u0E35\u0E14\u0E23\u0E49\u0E2D\u0E07",
  "\u0E23\u0E49\u0E2D\u0E07\u0E15\u0E30\u0E42\u0E01\u0E19",
  "\u0E15\u0E30\u0E42\u0E01\u0E19\u0E27\u0E48\u0E32",
  "\u0E01\u0E23\u0E30\u0E0B\u0E34\u0E1A\u0E27\u0E48\u0E32",
  "\u0E1E\u0E39\u0E14\u0E27\u0E48\u0E32",
  "\u0E16\u0E32\u0E21\u0E27\u0E48\u0E32",
  "\u0E15\u0E2D\u0E1A\u0E27\u0E48\u0E32",
  "\u0E01\u0E25\u0E48\u0E32\u0E27\u0E27\u0E48\u0E32",
  "\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32",
  "\u0E23\u0E49\u0E2D\u0E07\u0E27\u0E48\u0E32",
  "\u0E40\u0E2D\u0E48\u0E22\u0E27\u0E48\u0E32",
  "\u0E1E\u0E36\u0E21\u0E1E\u0E33",
  "\u0E01\u0E23\u0E30\u0E0B\u0E34\u0E1A",
  "\u0E15\u0E30\u0E42\u0E01\u0E19",
  "\u0E23\u0E49\u0E2D\u0E07\u0E40\u0E23\u0E35\u0E22\u0E01",
  "\u0E23\u0E49\u0E2D\u0E07\u0E44\u0E2B\u0E49",
  "\u0E2D\u0E38\u0E17\u0E32\u0E19",
  "\u0E15\u0E27\u0E32\u0E14",
  "\u0E04\u0E33\u0E23\u0E32\u0E21",
  "\u0E2A\u0E30\u0E2D\u0E37\u0E49\u0E19",
  "\u0E2B\u0E31\u0E27\u0E40\u0E23\u0E32\u0E30",
  "\u0E04\u0E23\u0E27\u0E0D",
  "\u0E40\u0E23\u0E35\u0E22\u0E01",
  "\u0E01\u0E25\u0E48\u0E32\u0E27",
  "\u0E1E\u0E39\u0E14",
  "\u0E16\u0E32\u0E21",
  "\u0E15\u0E2D\u0E1A",
  "\u0E1A\u0E2D\u0E01",
  "\u0E40\u0E2D\u0E48\u0E22",
  "\u0E23\u0E49\u0E2D\u0E07"
];
function normalizeSpeakerForDedupe(name, knownCharacters = []) {
  if (!name) return "";
  let s = name.replace(/[*_#"“”'`\[\]]/g, "").replace(/\([^)]*\)/g, "").replace(/[:：]+$/, "").trim();
  const known = [...knownCharacters].filter(Boolean).sort((a, b) => b.length - a.length);
  const k = known.find((n) => s === n || s.startsWith(n));
  if (k) return k;
  let cut = -1;
  for (const v of SPEECH_VERBS) {
    const idx = s.indexOf(v);
    if (idx >= 2 && (cut === -1 || idx < cut)) cut = idx;
  }
  if (cut > 0) s = s.slice(0, cut).trim();
  return s;
}
function normalizeDialogueLine(line) {
  return String(line || "").replace(/["“”'‘’«»「」`]/g, "").replace(/\s+/g, "").toLowerCase();
}
function dedupeDialogueEntries(dialogues, knownCharacters = []) {
  const known = expandCombinedCharacterNames(knownCharacters);
  const out = [];
  const members = (speaker) => expandCombinedCharacterNames([speaker]);
  for (const d of dialogues) {
    if (!d || !d.speaker) continue;
    const rawSpeaker = d.speaker.trim();
    const combined = members(rawSpeaker).length > 1;
    const speaker = combined ? rawSpeaker : normalizeSpeakerForDedupe(rawSpeaker, known) || rawSpeaker;
    const lineKey = normalizeDialogueLine(d.line);
    const idx = out.findIndex((o) => {
      if (normalizeDialogueLine(o.line) !== lineKey) return false;
      if (o.speaker.toLowerCase() === speaker.toLowerCase()) return true;
      const a = members(o.speaker);
      const b = members(speaker);
      return a.length > 1 && b.every((x) => a.includes(x)) || b.length > 1 && a.every((x) => b.includes(x));
    });
    if (idx === -1) {
      out.push({ ...d, speaker });
      continue;
    }
    if (members(out[idx].speaker).length > 1 && !combined) out[idx] = { ...d, speaker };
  }
  return out;
}
var FORBIDDEN_PLACEHOLDER_SUBSTRINGS = [
  "tea_cup_or_torch",
  "Thai dialogue if needed",
  "\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01",
  "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07",
  "\u0E08\u0E38\u0E14\u0E0A\u0E21\u0E27\u0E34\u0E27\u0E22\u0E2D\u0E14\u0E14\u0E2D\u0E22\u0E2B\u0E25\u0E27\u0E07\u0E40\u0E0A\u0E35\u0E22\u0E07\u0E14\u0E32\u0E27",
  "\u0E23\u0E39\u0E1B\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C\u0E41\u0E25\u0E30\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E15\u0E48\u0E07\u0E01\u0E32\u0E22\u0E04\u0E07\u0E17\u0E35\u0E48",
  "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E15\u0E32\u0E21\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23",
  "\u0E41\u0E2A\u0E07\u0E04\u0E1A\u0E40\u0E1E\u0E25\u0E34\u0E07\u0E2A\u0E35\u0E2A\u0E49\u0E21 Chiaroscuro",
  "\u0E27\u0E34\u0E2B\u0E32\u0E23\u0E28\u0E34\u0E25\u0E32\u0E41\u0E25\u0E07",
  "undefined",
  "null",
  "[object Object]"
];
var WHOLE_TOKEN_PLACEHOLDERS = /* @__PURE__ */ new Set(["undefined", "null"]);
function containsForbiddenPlaceholder(text, placeholder) {
  if (!text || !placeholder) return false;
  const p = placeholder.toLowerCase();
  if (WHOLE_TOKEN_PLACEHOLDERS.has(p)) {
    return new RegExp(`(^|[^A-Za-z0-9_])${p}($|[^A-Za-z0-9_])`, "i").test(text);
  }
  return text.toLowerCase().includes(p);
}
var METADATA_KEYWORDS = /* @__PURE__ */ new Set([
  "\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07",
  "\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07",
  "title",
  "\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23",
  "\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01",
  "\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23",
  "characters",
  "character",
  "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E25\u0E31\u0E01",
  "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E16\u0E48\u0E32\u0E22\u0E17\u0E33",
  "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48",
  "location",
  "\u0E40\u0E27\u0E25\u0E32",
  "\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32",
  "\u0E1A\u0E23\u0E23\u0E22\u0E32\u0E01\u0E32\u0E28",
  "time",
  "\u0E41\u0E2A\u0E07",
  "\u0E01\u0E32\u0E23\u0E08\u0E31\u0E14\u0E41\u0E2A\u0E07",
  "lighting",
  "\u0E2A\u0E44\u0E15\u0E25\u0E4C",
  "\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E20\u0E32\u0E1E",
  "\u0E42\u0E17\u0E19\u0E20\u0E32\u0E1E",
  "style",
  "\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C",
  "\u0E1E\u0E23\u0E47\u0E2D\u0E1E",
  "\u0E2A\u0E34\u0E48\u0E07\u0E02\u0E2D\u0E07",
  "props",
  "\u0E09\u0E32\u0E01",
  "\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48",
  "scene",
  "clip",
  "\u0E01\u0E25\u0E49\u0E2D\u0E07",
  "\u0E21\u0E38\u0E21\u0E01\u0E25\u0E49\u0E2D\u0E07",
  "camera",
  "end",
  "end_state",
  "story"
]);
function isMetadataKeyword(word) {
  if (!word) return false;
  const clean2 = word.trim().toLowerCase().replace(/[:：=_#\-*•]/g, "").trim();
  return METADATA_KEYWORDS.has(clean2);
}
function parseSalaProtocolHeader(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("@SALA")) return null;
  const header = {
    protocolVersion: "SALA1"
  };
  const [protoAndStory, ...segments] = trimmed.split("|");
  const matchProto = protoAndStory.match(/^@([A-Z0-9]+)(?:#([A-Z0-9_-]+))?/i);
  if (matchProto) {
    header.protocolVersion = matchProto[1].toUpperCase();
    if (matchProto[2]) {
      header.storyId = matchProto[2];
    }
  }
  for (const seg of segments) {
    const s = seg.trim();
    if (s.startsWith("P")) {
      header.part = s;
    } else if (s.startsWith("C") && s.includes("-")) {
      const matchRange = s.match(/^C0*(\d+)-0*(\d+)/i);
      if (matchRange) {
        header.clipRange = {
          raw: s,
          startClip: parseInt(matchRange[1], 10),
          endClip: parseInt(matchRange[2], 10)
        };
      }
    } else if (s.startsWith("H:")) {
      const matchHandoff = s.match(/^H:0*(\d+)>0*(\d+)/i);
      if (matchHandoff) {
        header.handoffRule = {
          raw: s,
          fromClip: parseInt(matchHandoff[1], 10),
          toClip: parseInt(matchHandoff[2], 10)
        };
      }
    } else if (s === "K:KEEP") {
      header.keepCharacterLock = true;
    } else if (s === "CT:KEEP") {
      header.keepContinuity = true;
    }
  }
  return header;
}
function parseSalaScript(scriptText, options) {
  const lines = scriptText.split("\n").map((l) => l.trim());
  const metadata = {
    declaredCharacters: [],
    lockDirectives: {},
    contDirectives: {},
    frameDirectives: {},
    autoDirectives: {},
    ruleDirectives: [],
    noDirectives: [],
    outDirectives: {}
  };
  if (options?.knownCharacters && options.knownCharacters.length > 0) {
    for (const kc of expandCombinedCharacterNames(options.knownCharacters)) {
      if (kc && !isReservedSystemKeyword(kc) && !isMetadataKeyword(kc)) {
        const cleanName = kc.trim();
        if (!metadata.declaredCharacters.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
          metadata.declaredCharacters.push({ name: cleanName });
        }
      }
    }
  }
  const addDeclaredCharacter = (name, description) => {
    const cleanName = name.trim();
    if (!cleanName || isReservedSystemKeyword(cleanName) || isMetadataKeyword(cleanName)) return;
    const existing = metadata.declaredCharacters.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      if (description && !existing.description) {
        existing.description = description.trim();
      }
    } else {
      metadata.declaredCharacters.push({
        name: cleanName,
        description: description ? description.trim() : void 0
      });
    }
  };
  const sceneHeaderRegex = /^(?:\[?(?:CLIP|ฉากที่|ฉาก|SCENE)\s*0*(\d+)\]?[:.]?\s*(.*)|STORY\s*[:{]\s*(.*))$/i;
  let firstSceneIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] && sceneHeaderRegex.test(lines[i])) {
      firstSceneIndex = i;
      break;
    }
  }
  const metadataLines = [];
  const sceneLines = [];
  if (firstSceneIndex !== -1) {
    for (let i = 0; i < firstSceneIndex; i++) {
      if (lines[i]) metadataLines.push(lines[i]);
    }
    for (let i = firstSceneIndex; i < lines.length; i++) {
      if (lines[i]) sceneLines.push(lines[i]);
    }
  } else {
    let inLeadingMetadata = true;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      if (inLeadingMetadata) {
        if (line.startsWith("@SALA") || /^(?:ชื่อเรื่อง|เรื่อง|TITLE|ตัวละคร|ตัวละครหลัก|รายชื่อตัวละคร|CHARACTERS|สถานที่|สถานที่หลัก|LOCATION|เวลา|ช่วงเวลา|TIME|แสง|LIGHTING|สไตล์|STYLE|อุปกรณ์|พร็อพ|PROPS|LOCK|CONT|FRAME|AUTO|RULE|NO|OUT)\s*[:：=]/i.test(line)) {
          metadataLines.push(line);
        } else if (metadataLines.length > 0 && /^[-\*•\d.]*\s*[ก-๙a-zA-Z0-9_\s]{1,30}[:：]/.test(line)) {
          metadataLines.push(line);
        } else {
          inLeadingMetadata = false;
          sceneLines.push(line);
        }
      } else {
        sceneLines.push(line);
      }
    }
  }
  let inCharacterSection = false;
  let pendingCharacterName = null;
  for (let i = 0; i < metadataLines.length; i++) {
    const line = metadataLines[i];
    if (!line) continue;
    if (line.startsWith("@SALA")) {
      const proto = parseSalaProtocolHeader(line);
      if (proto) {
        metadata.protocol = proto;
        metadata.rawHeader = line;
      }
      continue;
    }
    const titleMatch = line.match(/^(?:ชื่อเรื่อง|เรื่อง|TITLE)\s*[:：=]\s*(.*)$/i);
    if (titleMatch) {
      if (pendingCharacterName) {
        addDeclaredCharacter(pendingCharacterName);
        pendingCharacterName = null;
      }
      inCharacterSection = false;
      metadata.title = titleMatch[1].trim();
      continue;
    }
    const locMatch = line.match(/^(?:สถานที่หลัก|สถานที่ถ่ายทำ|สถานที่|LOCATION)\s*[:：=]\s*(.*)$/i);
    if (locMatch) {
      if (pendingCharacterName) {
        addDeclaredCharacter(pendingCharacterName);
        pendingCharacterName = null;
      }
      inCharacterSection = false;
      metadata.location = locMatch[1].trim();
      metadata.lockDirectives["location"] = locMatch[1].trim();
      continue;
    }
    const timeMatch = line.match(/^(?:เวลา|ช่วงเวลา|บรรยากาศ|TIME)\s*[:：=]\s*(.*)$/i);
    if (timeMatch) {
      if (pendingCharacterName) {
        addDeclaredCharacter(pendingCharacterName);
        pendingCharacterName = null;
      }
      inCharacterSection = false;
      metadata.timeOfDay = timeMatch[1].trim();
      metadata.lockDirectives["time"] = timeMatch[1].trim();
      continue;
    }
    const lightMatch = line.match(/^(?:แสง|การจัดแสง|LIGHTING)\s*[:：=]\s*(.*)$/i);
    if (lightMatch) {
      if (pendingCharacterName) {
        addDeclaredCharacter(pendingCharacterName);
        pendingCharacterName = null;
      }
      inCharacterSection = false;
      metadata.lighting = lightMatch[1].trim();
      metadata.lockDirectives["lighting"] = lightMatch[1].trim();
      continue;
    }
    const styleMatch = line.match(/^(?:สไตล์|สไตล์ภาพ|โทนภาพ|STYLE)\s*[:：=]\s*(.*)$/i);
    if (styleMatch) {
      if (pendingCharacterName) {
        addDeclaredCharacter(pendingCharacterName);
        pendingCharacterName = null;
      }
      inCharacterSection = false;
      metadata.style = styleMatch[1].trim();
      metadata.lockDirectives["style"] = styleMatch[1].trim();
      continue;
    }
    const propsMatch = line.match(/^(?:อุปกรณ์|พร็อพ|สิ่งของ|PROPS)\s*[:：=]\s*(.*)$/i);
    if (propsMatch) {
      if (pendingCharacterName) {
        addDeclaredCharacter(pendingCharacterName);
        pendingCharacterName = null;
      }
      inCharacterSection = false;
      metadata.props = propsMatch[1].trim();
      metadata.lockDirectives["props"] = propsMatch[1].trim();
      continue;
    }
    const reservedMatch = line.match(/^([A-Z_]+)\s*[:：=]\s*(.*)$/i);
    if (reservedMatch && RESERVED_KEYWORD_SET.has(reservedMatch[1].toUpperCase())) {
      const kw = reservedMatch[1].toUpperCase();
      const val = reservedMatch[2].trim();
      if (pendingCharacterName) {
        addDeclaredCharacter(pendingCharacterName);
        pendingCharacterName = null;
      }
      inCharacterSection = false;
      if (kw === "LOCK") {
        const pairs = val.split("|").map((p) => p.trim());
        for (const p of pairs) {
          const colonIdx = p.indexOf(":");
          if (colonIdx > 0) {
            const k = p.substring(0, colonIdx).trim().toLowerCase();
            const v = p.substring(colonIdx + 1).trim();
            metadata.lockDirectives[k] = v;
          } else {
            metadata.lockDirectives[p.toLowerCase()] = p;
          }
        }
      } else if (kw === "CONT") {
        metadata.contDirectives["instruction"] = val;
      } else if (kw === "FRAME") {
        metadata.frameDirectives["format"] = val;
      } else if (kw === "AUTO") {
        metadata.autoDirectives["mode"] = val;
      } else if (kw === "RULE") {
        metadata.ruleDirectives.push(val);
      } else if (kw === "NO") {
        metadata.noDirectives.push(val);
      } else if (kw === "OUT") {
        metadata.outDirectives["format"] = val;
      }
      continue;
    }
    const charHeaderMatch = line.match(/^(?:ตัวละครหลัก|ตัวละคร|รายชื่อตัวละคร|CHARACTERS)\s*[:：]?\s*(.*)$/i);
    if (charHeaderMatch) {
      if (pendingCharacterName) {
        addDeclaredCharacter(pendingCharacterName);
        pendingCharacterName = null;
      }
      inCharacterSection = true;
      const inlineChars = charHeaderMatch[1].trim();
      if (inlineChars) {
        const parts = inlineChars.split(/[,;|]/).map((p) => p.trim()).filter(Boolean);
        for (const p of parts) {
          const matchP = p.match(/^([^(:]+)(?:[:\(](.*)\)?)?/);
          if (matchP) {
            addDeclaredCharacter(matchP[1].trim(), matchP[2]?.replace(/[)]$/, "").trim());
          }
        }
      }
      continue;
    }
    if (inCharacterSection) {
      const charLineMatch = line.match(/^(?:[-*•\d.]*\s*)?([ก-๙a-zA-Z0-9_\s]{1,30})[:：]\s*(.*)$/);
      if (charLineMatch) {
        const candidateName = charLineMatch[1].trim();
        const candidateDesc = charLineMatch[2].trim();
        if (isReservedSystemKeyword(candidateName) || isMetadataKeyword(candidateName)) {
          if (pendingCharacterName) {
            addDeclaredCharacter(pendingCharacterName);
            pendingCharacterName = null;
          }
          inCharacterSection = false;
          continue;
        }
        if (pendingCharacterName) {
          addDeclaredCharacter(pendingCharacterName);
          pendingCharacterName = null;
        }
        if (candidateDesc) {
          addDeclaredCharacter(candidateName, candidateDesc);
        } else {
          pendingCharacterName = candidateName;
        }
        continue;
      }
      const charDashMatch = line.match(/^(?:[-*•\d.]*\s*)?([ก-๙a-zA-Z0-9_ ]{1,30}?)\s*(?:[—–]|\s-\s)\s*(.+)$/);
      if (charDashMatch && !isReservedSystemKeyword(charDashMatch[1].trim()) && !isMetadataKeyword(charDashMatch[1].trim())) {
        if (pendingCharacterName) {
          addDeclaredCharacter(pendingCharacterName);
          pendingCharacterName = null;
        }
        addDeclaredCharacter(charDashMatch[1].trim(), charDashMatch[2].trim());
        continue;
      }
      const charParenMatch = line.match(/^(?:[-*•\d.]*\s*)?([ก-๙a-zA-Z0-9_\s]{1,30})\s*\((.*)\)$/);
      if (charParenMatch) {
        if (pendingCharacterName) {
          addDeclaredCharacter(pendingCharacterName);
          pendingCharacterName = null;
        }
        addDeclaredCharacter(charParenMatch[1].trim(), charParenMatch[2].trim());
        continue;
      }
      if (pendingCharacterName) {
        addDeclaredCharacter(pendingCharacterName, line.trim());
        pendingCharacterName = null;
        continue;
      }
    }
  }
  if (pendingCharacterName) {
    addDeclaredCharacter(pendingCharacterName);
    pendingCharacterName = null;
  }
  const rawClips = [];
  let currentClip = null;
  let autoClipNumber = 1;
  const declaredNameSet = new Set(
    metadata.declaredCharacters.map((c) => c.name.toLowerCase().trim())
  );
  const resolveDeclaredSpeaker = (candidate) => {
    const lower = candidate.toLowerCase().trim();
    const exact = metadata.declaredCharacters.find((c) => c.name.toLowerCase() === lower);
    if (exact) return exact;
    const normalized = normalizeSpeakerForDedupe(candidate, metadata.declaredCharacters.map((c) => c.name)).toLowerCase();
    return metadata.declaredCharacters.find((c) => c.name.toLowerCase() === normalized);
  };
  for (let i = 0; i < sceneLines.length; i++) {
    const rawLine = sceneLines[i];
    if (!rawLine) continue;
    const headerMatch = rawLine.match(/^(?:\[?(?:CLIP|ฉากที่|ฉาก|SCENE)\s*0*(\d+)\]?[:.]?\s*(.*)|STORY\s*[:{]\s*(.*))$/i);
    if (headerMatch) {
      if (currentClip) {
        rawClips.push(currentClip);
      }
      const num = headerMatch[1] ? parseInt(headerMatch[1], 10) : autoClipNumber;
      autoClipNumber = num + 1;
      const sceneTitle = (headerMatch[2]?.trim() || headerMatch[3]?.trim() || "").replace(/^[—–\-:：]\s*/, "") || `\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${num}`;
      currentClip = {
        clipNumber: num,
        title: sceneTitle.startsWith("\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48") || sceneTitle.startsWith("Clip") ? sceneTitle : `\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${num}: ${sceneTitle}`,
        actions: [],
        cameraDirectives: [],
        dialogues: []
      };
      const restText = (headerMatch[2]?.trim() || "").replace(/^[—–\-:：]\s*/, "");
      const looksLikeHeading = /\s[\/|]\s?|\s?[\/|]\s|\s[-–—]\s/.test(restText) || /(?:ต่อเนื่อง|\(ต่อ\))$/.test(restText) || !/\s/.test(restText) && restText.length <= 24 && !/["“”]/.test(restText) && !/(เดิน|วิ่ง|นั่ง|ยืน|มอง|หัน|จับ|ยิ้ม|พูด|ถือ|เปิด|ปิด|กอด|ร้อง|หยิบ|walk|run|sit|stand|look)/i.test(restText);
      if (restText && !looksLikeHeading && !restText.match(/^(?:ฉากที่|Clip|Scene)\s*\d+$/i)) {
        currentClip.actions.push(restText);
        (currentClip.sequence ||= []).push({ kind: "action", index: currentClip.actions.length - 1 });
      }
      continue;
    }
    if (rawLine === "}" || rawLine === "END_STORY") {
      continue;
    }
    if (!currentClip) {
      currentClip = {
        clipNumber: autoClipNumber++,
        title: `\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${autoClipNumber - 1}`,
        actions: [],
        cameraDirectives: [],
        dialogues: []
      };
    }
    const posMatch = rawLine.match(/^(?:\(?(?:ตำแหน่งตัวละคร|ตำแหน่ง|POSITION|SPATIAL_LOCK)\)?)\s*[:：]\s*(.*)$/i);
    if (posMatch) {
      currentClip.characterPositions = posMatch[1].replace(/\)$/, "").trim();
      continue;
    }
    const startMatch = rawLine.match(/^(?:\(?(?:เริ่มต้น|จุดเริ่มต้น|จุดเริ่ม|START)\)?)\s*[:：]\s*(.*)$/i);
    if (startMatch) {
      currentClip.startAction = startMatch[1].replace(/\)$/, "").trim();
      continue;
    }
    const endMatch = rawLine.match(/^(?:END(?:_STATE)?|\(?(?:สิ้นสุดฉาก|จบฉาก|สิ้นสุด)\)?)\s*[:：]\s*(.*)$/i);
    if (endMatch) {
      currentClip.endState = endMatch[1].replace(/\)$/, "").trim();
      continue;
    }
    const cameraMatch = rawLine.match(/^(?:CAMERA|กล้อง|มุมกล้อง)\s*[:：]\s*(.*)$/i);
    if (cameraMatch) {
      currentClip.cameraDirectives.push(cameraMatch[1].trim());
      continue;
    }
    const speakerOnlyMatch = rawLine.match(/^([ก-๙a-zA-Z0-9_\-]+)\s*(?:\(([^)]*)\))?\s*[:：]$/);
    if (speakerOnlyMatch && i + 1 < sceneLines.length) {
      const nextLine = sceneLines[i + 1].trim();
      const quoteMatch = nextLine.match(/^["“'‘«「]([^"”'’»」]+)["”'’»」]$/);
      if (quoteMatch) {
        const candidateSpeaker = speakerOnlyMatch[1].trim();
        const emotionTone = speakerOnlyMatch[2]?.trim() || "\u0E15\u0E32\u0E21\u0E1A\u0E17\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A";
        const speechText = quoteMatch[1].trim();
        if (!isReservedSystemKeyword(candidateSpeaker) && !isMetadataKeyword(candidateSpeaker)) {
          const canonicalChar = resolveDeclaredSpeaker(candidateSpeaker);
          currentClip.dialogues.push({
            id: `diag_${currentClip.clipNumber}_${currentClip.dialogues.length + 1}`,
            speaker: canonicalChar ? canonicalChar.name : candidateSpeaker,
            line: speechText,
            emotionTone,
            clipNumber: currentClip.clipNumber
          });
          (currentClip.sequence ||= []).push({ kind: "dialogue", index: currentClip.dialogues.length - 1 });
          i++;
          continue;
        }
      }
    }
    const dialogueMatch = rawLine.match(/^([ก-๙a-zA-Z0-9_\s]{1,30})(?:\s*\(([^)]+)\))?[:：]\s*["“'‘«「]([^"”'’»」]+)["”'’»」]\s*$/);
    if (dialogueMatch) {
      const candidateSpeaker = dialogueMatch[1].trim();
      const emotionTone = dialogueMatch[2]?.trim() || "\u0E15\u0E32\u0E21\u0E1A\u0E17\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A";
      const speechText = dialogueMatch[3].trim();
      if (!isReservedSystemKeyword(candidateSpeaker) && !isMetadataKeyword(candidateSpeaker)) {
        const canonicalChar = resolveDeclaredSpeaker(candidateSpeaker);
        const isKnown = declaredNameSet.size === 0 || !!canonicalChar;
        if (isKnown && speechText.length > 0) {
          currentClip.dialogues.push({
            id: `diag_${currentClip.clipNumber}_${currentClip.dialogues.length + 1}`,
            speaker: canonicalChar ? canonicalChar.name : candidateSpeaker,
            line: speechText,
            emotionTone,
            clipNumber: currentClip.clipNumber
          });
          (currentClip.sequence ||= []).push({ kind: "dialogue", index: currentClip.dialogues.length - 1 });
          continue;
        }
      }
    }
    currentClip.actions.push(rawLine);
    (currentClip.sequence ||= []).push({ kind: "action", index: currentClip.actions.length - 1 });
  }
  if (currentClip) {
    rawClips.push(currentClip);
  }
  const targetCount = options?.defaultClipCount || (metadata.protocol?.clipRange ? metadata.protocol.clipRange.endClip - metadata.protocol.clipRange.startClip + 1 : 0);
  if (firstSceneIndex === -1 && rawClips.length === 1 && targetCount > 1 && rawClips[0].actions.length >= targetCount) {
    const singleClip = rawClips[0];
    const totalLines = singleClip.actions;
    const chunkSize = totalLines.length / targetCount;
    rawClips.length = 0;
    for (let c = 0; c < targetCount; c++) {
      const start = Math.floor(c * chunkSize);
      const end = Math.floor((c + 1) * chunkSize);
      const slice = totalLines.slice(start, Math.max(start + 1, end));
      const clipNum = (metadata.protocol?.clipRange?.startClip || 1) + c;
      const sliceText = slice.join(" ");
      const clipDiags = singleClip.dialogues.filter((d) => sliceText.includes(d.speaker) || c === targetCount - 1 && d.clipNumber === 1);
      rawClips.push({
        clipNumber: clipNum,
        title: `\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${clipNum}`,
        actions: slice,
        cameraDirectives: singleClip.cameraDirectives,
        dialogues: clipDiags.map((d) => ({ ...d, clipNumber: clipNum }))
      });
    }
  }
  const allDetectedCharacters = Array.from(
    /* @__PURE__ */ new Set([
      ...metadata.declaredCharacters.map((c) => c.name),
      ...rawClips.flatMap((c) => c.dialogues.map((d) => d.speaker))
    ])
  ).filter((name) => !isReservedSystemKeyword(name) && !isMetadataKeyword(name));
  return {
    metadata,
    clips: rawClips,
    storyTextClean: sceneLines.join("\n"),
    detectedCharacters: allDetectedCharacters,
    totalClips: rawClips.length
  };
}
function deriveScenePhysicalStates({
  sceneIndex,
  cleanAction,
  dialogues = [],
  sceneActiveChars = [],
  location = "",
  timeOfDay = "",
  prevSceneEndState = "",
  endsWithDialogue,
  actionBeats
}) {
  const UNSPEC = "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E08\u0E32\u0E01\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A";
  const place = location && location !== UNSPEC ? location : "";
  const time = timeOfDay && timeOfDay !== UNSPEC ? timeOfDay : "";
  const charsLabel = sceneActiveChars.filter(Boolean).join(" \u0E41\u0E25\u0E30 ");
  const action = (cleanAction || "").replace(/^\[[^\]]*\]\s*/, "").trim();
  const beatList = (actionBeats || []).map((b) => (b || "").trim()).filter(Boolean);
  const sentences = beatList.length > 0 ? beatList : action.split(/(?<=[.!?。])\s+|\n+|\s{2,}/).map((s) => s.trim()).filter(Boolean);
  const firstSentence = sentences[0] || action;
  const lastSentence = sentences[sentences.length - 1] || action;
  const lastDiag = dialogues.length > 0 ? dialogues[dialogues.length - 1] : null;
  const endOnDialogue = endsWithDialogue ?? (!!lastDiag && !action);
  let startState = "";
  if (prevSceneEndState && prevSceneEndState.trim()) {
    startState = prevSceneEndState.trim();
  } else if (firstSentence) {
    startState = firstSentence;
  } else {
    startState = [charsLabel, place ? `\u0E17\u0E35\u0E48${place}` : "", time].filter(Boolean).join(" ") || "\u0E40\u0E1B\u0E34\u0E14\u0E09\u0E32\u0E01";
  }
  let endState = "";
  if (endOnDialogue && lastDiag) {
    const others = sceneActiveChars.filter((c) => c && c !== lastDiag.speaker);
    const who = lastDiag.offScreen ? `${lastDiag.speaker} (\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E19\u0E2D\u0E01\u0E08\u0E2D)` : lastDiag.speaker;
    const delivery = lastDiag.emotionOrAction ? ` ${lastDiag.emotionOrAction}` : "";
    endState = `${who}${delivery} \u0E40\u0E1E\u0E34\u0E48\u0E07\u0E1E\u0E39\u0E14\u0E08\u0E1A\u0E27\u0E48\u0E32 "${lastDiag.dialogue}"` + (others.length > 0 ? ` \u0E02\u0E13\u0E30\u0E17\u0E35\u0E48${others.join(" \u0E41\u0E25\u0E30 ")}\u0E2B\u0E31\u0E19\u0E21\u0E32\u0E15\u0E2D\u0E1A\u0E2A\u0E19\u0E2D\u0E07\u0E15\u0E48\u0E2D\u0E04\u0E33\u0E1E\u0E39\u0E14\u0E19\u0E31\u0E49\u0E19` : "");
  } else if (lastSentence) {
    endState = `\u0E20\u0E32\u0E1E\u0E04\u0E49\u0E32\u0E07\u0E17\u0E35\u0E48\u0E0A\u0E48\u0E27\u0E07\u0E17\u0E49\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E01\u0E23\u0E30\u0E17\u0E33: ${lastSentence}`;
  } else if (lastDiag) {
    endState = `${lastDiag.speaker} \u0E1E\u0E39\u0E14\u0E08\u0E1A: "${lastDiag.dialogue}"`;
  } else {
    endState = [charsLabel, place ? `\u0E17\u0E35\u0E48${place}` : "", time].filter(Boolean).join(" ") || "\u0E08\u0E1A\u0E0A\u0E47\u0E2D\u0E15\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07";
  }
  void sceneIndex;
  return { startState, endState };
}
var DIALOGUE_DENSITY_RULE = {
  thaiCharsPerSecond: 12,
  perLineOverheadSeconds: 0.6,
  budgetRatio: 0.8,
  maxLinesPer10s: 3,
  maxParts: 4
};
function countSpokenChars(line) {
  return String(line || "").replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, "").replace(/[\s"'“”‘’.,!?…:;()\[\]\-–—ๆ]/g, "").length;
}
function estimateSpeechSeconds(lines, rule = DIALOGUE_DENSITY_RULE) {
  const secs = (lines || []).reduce((sum, l) => sum + countSpokenChars(l) / rule.thaiCharsPerSecond + rule.perLineOverheadSeconds, 0);
  return Math.round(secs * 10) / 10;
}
function checkDialogueDensity(lines, clipDurationSeconds, rule = DIALOGUE_DENSITY_RULE) {
  const est = estimateSpeechSeconds(lines, rule);
  const budget = Math.round(rule.budgetRatio * clipDurationSeconds * 10) / 10;
  const maxLines = Math.max(1, Math.round(rule.maxLinesPer10s * clipDurationSeconds / 10));
  const n = lines.length;
  let parts = Math.max(Math.ceil(est / budget), Math.ceil(n / maxLines), 1);
  parts = Math.max(1, Math.min(parts, rule.maxParts, Math.max(1, n)));
  const reasons = [];
  if (est > budget) reasons.push(`\u0E1A\u0E17\u0E1E\u0E39\u0E14\u0E1B\u0E23\u0E30\u0E21\u0E32\u0E13 ${est} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E40\u0E01\u0E34\u0E19 ${budget} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 (80% \u0E02\u0E2D\u0E07 ${clipDurationSeconds} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35)`);
  if (n > maxLines) reasons.push(`${n} \u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14 \u0E40\u0E01\u0E34\u0E19 ${maxLines} \u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14\u0E15\u0E48\u0E2D\u0E04\u0E25\u0E34\u0E1B ${clipDurationSeconds} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35`);
  return { lines: n, estimatedSeconds: est, budgetSeconds: budget, maxLines, parts: reasons.length > 0 ? parts : 1, reason: reasons.join(" \u0E41\u0E25\u0E30 ") };
}
function splitDenseScene(unit, clipDurationSeconds, sourceSceneNumber, rule = DIALOGUE_DENSITY_RULE) {
  const { raw, dialogues } = unit;
  const check = checkDialogueDensity(dialogues.map((d) => d.line || ""), clipDurationSeconds, rule);
  if (check.parts <= 1 || dialogues.length < 2) return [{ raw, dialogues }];
  const n = check.parts;
  const L = dialogues.length;
  const secs = dialogues.map((d) => estimateSpeechSeconds([d.line || ""], rule));
  const total = secs.reduce((a, b) => a + b, 0);
  const seq = unit.sequence && unit.sequence.length > 0 ? unit.sequence : null;
  const natural = new Array(L).fill(false);
  if (seq) {
    let lastD = -1;
    let actionSince = false;
    for (const b of seq) {
      if (b.kind === "dialogue") {
        if (lastD >= 0 && actionSince) natural[b.index] = true;
        lastD = b.index;
        actionSince = false;
      } else actionSince = true;
    }
  }
  const cuts = [];
  let prev = 0;
  for (let p = 1; p < n; p++) {
    const target = total * p / n;
    let best = -1;
    let bestScore = Infinity;
    for (let k = prev + 1; k <= L - (n - p); k++) {
      const cum = secs.slice(0, k).reduce((a, b) => a + b, 0);
      const linesInPart = k - prev;
      const score = Math.abs(cum - target) - (natural[k] ? 1 : 0) + Math.max(0, linesInPart - check.maxLines) * 5;
      if (score < bestScore) {
        bestScore = score;
        best = k;
      }
    }
    cuts.push(best);
    prev = best;
  }
  const partOfDialogue = (k) => cuts.filter((c) => k >= c).length;
  const partActions = Array.from({ length: n }, () => []);
  if (seq) {
    let lastPart = 0;
    let seenDialogue = false;
    const pendingBetween = [];
    for (const b of seq) {
      if (b.kind === "dialogue") {
        const part = partOfDialogue(b.index);
        partActions[seenDialogue ? lastPart : part].push(...pendingBetween);
        pendingBetween.length = 0;
        lastPart = part;
        seenDialogue = true;
      } else {
        const a = raw.actions[b.index];
        if (a) {
          if (!seenDialogue) partActions[0].push(a);
          else pendingBetween.push(a);
        }
      }
    }
    partActions[n - 1].push(...pendingBetween);
  } else {
    raw.actions.forEach((a, i) => {
      const part = raw.actions.length === 1 ? 0 : Math.min(n - 1, Math.floor(i / raw.actions.length * n));
      partActions[part].push(a);
    });
  }
  const bounds = [0, ...cuts, L];
  return Array.from({ length: n }, (_, p) => {
    const partDialogues = dialogues.slice(bounds[p], bounds[p + 1]);
    const speakers = Array.from(new Set(partDialogues.map((d) => d.speaker)));
    const actions = partActions[p].length > 0 ? partActions[p] : [`${speakers.join(" \u0E41\u0E25\u0E30 ")} \u0E2A\u0E19\u0E17\u0E19\u0E32\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E08\u0E32\u0E01\u0E04\u0E25\u0E34\u0E1B\u0E01\u0E48\u0E2D\u0E19 \u0E43\u0E19\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E40\u0E14\u0E34\u0E21`];
    const title = raw.title || `\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${sourceSceneNumber}`;
    return {
      raw: {
        ...raw,
        title: `${title} (\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 ${p + 1}/${n})`,
        actions,
        dialogues: partDialogues,
        sequence: void 0,
        startAction: p === 0 ? raw.startAction : void 0,
        endState: p === n - 1 ? raw.endState : void 0
      },
      dialogues: partDialogues,
      splitPart: { sourceSceneNumber, part: p + 1, total: n, reason: check.reason }
    };
  });
}
function summarizeAutoSplit(clips, requestedClipCount) {
  const bySource = /* @__PURE__ */ new Map();
  clips.forEach((c) => {
    if (c.splitPart) bySource.set(c.splitPart.sourceSceneNumber, [...bySource.get(c.splitPart.sourceSceneNumber) || [], c]);
  });
  return {
    requestedClipCount,
    finalClipCount: clips.length,
    autoSplitApplied: bySource.size > 0,
    splitScenes: Array.from(bySource.entries()).map(([sourceSceneNumber, parts]) => ({
      sourceSceneNumber,
      parts: parts.length,
      clipNumbers: parts.map((p) => p.clipNumber),
      reason: parts[0].splitPart?.reason || "",
      estimatedSpeechSeconds: parts.map((p) => p.estimatedSpeechSeconds || 0)
    }))
  };
}
function buildSalaMultiClipPrompts(params) {
  const {
    scriptText,
    clipDurationSeconds,
    clipCount,
    continuityLock,
    dialogues: explicitDialogues = [],
    audioDirectives
  } = params;
  const rule = { ...DIALOGUE_DENSITY_RULE, ...params.densityRule || {} };
  const parsed = parseSalaScript(scriptText, {
    knownCharacters: expandCombinedCharacterNames([
      ...params.knownCharacters || [],
      ...continuityLock.characterNames || [],
      continuityLock.characterName
    ].filter(Boolean)),
    defaultClipCount: clipCount
  });
  const targetCount = Math.max(1, Math.min(20, clipCount || parsed.totalClips || 3));
  const rawClips = parsed.clips;
  const processedRawClips = [];
  if (rawClips.length === targetCount) {
    processedRawClips.push(...rawClips);
  } else if (rawClips.length > targetCount) {
    processedRawClips.push(...rawClips.slice(0, targetCount));
  } else {
    processedRawClips.push(...rawClips);
    const lastClip = rawClips[rawClips.length - 1];
    for (let i = rawClips.length; i < targetCount; i++) {
      processedRawClips.push({
        clipNumber: i + 1,
        title: `Clip ${i + 1}`,
        actions: [lastClip?.actions[0] || "Continuing narrative sequence"],
        cameraDirectives: lastClip?.cameraDirectives || [],
        dialogues: []
      });
    }
  }
  const charName = cleanFieldValue(continuityLock.characterName) || cleanFieldValue(parsed.detectedCharacters[0]) || "";
  const charAppearance = cleanFieldValue(continuityLock.characterAppearance);
  const location = cleanFieldValue(continuityLock.location);
  const timeOfDay = cleanFieldValue(continuityLock.timeOfDay);
  const lighting = cleanFieldValue(continuityLock.lighting);
  const visualStyle = cleanFieldValue(continuityLock.visualStyle) || "Cinematic 8K, 35mm film, photorealistic";
  const cameraMovement = cleanFieldValue(continuityLock.cameraMovement) || "Smooth cinematic tracking";
  const lensType = cleanFieldValue(continuityLock.lensType) || "35mm anamorphic prime lens";
  const props = cleanFieldValue(continuityLock.props);
  const position = cleanFieldValue(continuityLock.characterPosition) || "center frame";
  const lockSupplied = charName ? [{
    name: charName,
    face: cleanFieldValue(continuityLock.characterFace),
    hair: cleanFieldValue(continuityLock.characterHair),
    outfit: cleanFieldValue(continuityLock.characterCostume),
    age: cleanFieldValue(continuityLock.characterAge),
    build: cleanFieldValue(continuityLock.characterBuild),
    accessories: cleanFieldValue(continuityLock.characterAccessories),
    // free text: classified (appearance vs personality), never trusted blindly as appearance
    description: charAppearance
  }] : [];
  const scriptDeclared = mergeDeclaredCharacters(parsed.metadata.declaredCharacters, scriptText);
  const suppliedChars = [...(params.characters || []).filter((c) => c && c.name), ...lockSupplied];
  const lockCache = /* @__PURE__ */ new Map();
  const lockTextFor = (name) => {
    if (!lockCache.has(name)) {
      const r = buildCharacterAppearanceLock([name], suppliedChars, scriptDeclared);
      lockCache.set(name, { text: r.text, warnings: r.warnings });
    }
    return lockCache.get(name);
  };
  const audioParts = [];
  if (audioDirectives?.voice?.enabled) {
    audioParts.push(`Voice: ${audioDirectives.voice.voiceType || "Natural"}, Delivery: ${audioDirectives.voice.deliverySpeed || "natural"}`);
  }
  if (audioDirectives?.music?.enabled) {
    audioParts.push(`Music: ${audioDirectives.music.genre || "Cinematic"} (${audioDirectives.music.mood || "Immersive"})`);
  }
  if (audioDirectives?.sfx?.enabled) {
    audioParts.push(`SFX: ${audioDirectives.sfx.ambientSounds || "Natural ambience"}`);
  }
  const audioSummary = audioParts.length > 0 ? audioParts.join(" | ") : "Audio: Ambient soundscape";
  const dedupeKnown = expandCombinedCharacterNames([
    ...params.knownCharacters || [],
    ...continuityLock.characterNames || [],
    continuityLock.characterName
  ].filter(Boolean));
  const units = processedRawClips.map((raw, i) => {
    const clipDialogues = [
      ...raw.dialogues,
      ...explicitDialogues.filter((d) => Number(d.clipNumber) === i + 1)
    ].filter((d) => d.speaker && !isReservedSystemKeyword(d.speaker));
    const uniqueDialogues = dedupeDialogueEntries(clipDialogues, dedupeKnown);
    let sequence = raw.sequence ? [...raw.sequence] : void 0;
    if (sequence) for (let k = raw.dialogues.length; k < uniqueDialogues.length; k++) sequence.push({ kind: "dialogue", index: k });
    if (sequence && raw.dialogues.length > uniqueDialogues.length) sequence = void 0;
    return { raw, dialogues: uniqueDialogues, sequence };
  });
  const pieces = units.flatMap((u, i) => params.autoSplitDense === false ? [{ raw: u.raw, dialogues: u.dialogues }] : splitDenseScene(u, clipDurationSeconds, u.raw.clipNumber || i + 1, rule));
  const outputClips = [];
  for (let i = 0; i < pieces.length; i++) {
    const clipNum = i + 1;
    const { raw, dialogues: uniqueDialogues, splitPart } = pieces[i];
    const narrativeAction = raw.actions.join(" ").trim() || `Scene ${clipNum} narrative development`;
    const prevPosition = i > 0 && outputClips[i - 1]?.characterPositions ? outputClips[i - 1].characterPositions : null;
    const clipPosition = raw.characterPositions || prevPosition || position || "\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E25\u0E47\u0E2D\u0E04\u0E2A\u0E2D\u0E14\u0E04\u0E25\u0E49\u0E2D\u0E07\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07";
    const allKnownCandidates = Array.from(/* @__PURE__ */ new Set([
      ...params.knownCharacters || [],
      ...continuityLock.characterNames || [],
      charName
    ])).filter(Boolean).filter((n) => !isReservedSystemKeyword(n) && !isMetadataKeyword(n));
    const clipFullText = `${raw.title} ${raw.actions.join(" ")}`;
    const clipChars = allKnownCandidates.filter((n) => {
      const firstName = n.split(" ")[0];
      return clipFullText.includes(n) || firstName.length >= 2 && clipFullText.includes(firstName) || uniqueDialogues.some((d) => d.speaker === n || d.speaker.includes(n) || d.line.includes(n));
    });
    const activeInClip = clipChars.length > 0 ? clipChars : charName ? [charName] : [];
    const prevEndState = i > 0 && outputClips[i - 1] ? outputClips[i - 1].endAction : "";
    const { startState: clipStartState, endState: clipEndState } = deriveScenePhysicalStates({
      sceneIndex: i,
      cleanAction: narrativeAction,
      dialogues: uniqueDialogues.map((d) => ({ speaker: d.speaker, dialogue: d.line, emotionOrAction: d.emotionTone })),
      sceneActiveChars: activeInClip,
      location,
      timeOfDay,
      prevSceneEndState: prevEndState,
      actionBeats: raw.actions
    });
    const startAction = raw.startAction || clipStartState;
    const endAction = raw.endState || clipEndState;
    const promptSegments = [];
    promptSegments.push(visualStyle);
    if (location) promptSegments.push(`Location: ${location}`);
    if (continuityLock.locationVisualDetails) {
      promptSegments.push(`Architectural Environment: ${continuityLock.locationVisualDetails}`);
    }
    if (timeOfDay || lighting) {
      promptSegments.push(`Atmosphere: ${[timeOfDay, lighting].filter(Boolean).join(", ")}`);
    }
    const locks = activeInClip.map((n) => lockTextFor(n));
    const characterLockText = locks.map((l) => l.text).join(" | ");
    const appearanceWarnings = Array.from(new Set(locks.flatMap((l) => l.warnings)));
    if (activeInClip.length > 0) {
      promptSegments.push(`Character Lock: ${characterLockText}, identical face, hair and outfit in every clip`);
    }
    const spatialText = activeInClip.length >= 2 && /^(?:cent(?:er|re)(?: frame)?|กลางเฟรม)$/i.test(String(clipPosition).trim()) ? `${activeInClip.join(" and ")} together in frame, each where the Stance/Position Lock places them` : clipPosition;
    promptSegments.push(`Spatial Positioning Lock: ${spatialText}`);
    if (props) promptSegments.push(`Props: ${props}`);
    promptSegments.push(`Starting moment: ${startAction}`);
    promptSegments.push(`Core action: ${narrativeAction}`);
    promptSegments.push(`Ending momentum: ${endAction}`);
    const cameraStr = raw.cameraDirectives.length > 0 ? raw.cameraDirectives.join(", ") : `${cameraMovement}, ${lensType}`;
    promptSegments.push(`Cinematography: ${cameraStr}`);
    if (uniqueDialogues.length > 0) {
      const dialogueText = uniqueDialogues.map((d) => `${d.speaker} speaks: "${d.line}" (${d.emotionTone || "natural emotion"})`).join(". ");
      promptSegments.push(`Dialogue: ${dialogueText}`);
    }
    if (audioParts.length > 0) promptSegments.push(`Soundscape: ${audioSummary}`);
    const cleanFinalPrompt = promptSegments.join(". ") + ".";
    const negativePrompt = "blurry, morphing, inconsistent costume, duplicate character, bad anatomy, text watermark, sudden jumpcut, flicker, low resolution";
    outputClips.push({
      clipNumber: clipNum,
      title: raw.title || `Clip ${clipNum}`,
      durationSeconds: clipDurationSeconds,
      sceneSummary: narrativeAction,
      startAction,
      endAction,
      characterPositions: clipPosition,
      dialogues: uniqueDialogues.map((d) => ({ ...d, clipNumber: clipNum })),
      locationName: location || void 0,
      continuityLockSummary: [charName ? `Character: ${charName}` : "", location ? `Location: ${location}` : "", timeOfDay, lighting].filter(Boolean).join(" | ") || "Continuity Locked",
      audioDirectiveSummary: audioSummary,
      generatedPrompt: cleanFinalPrompt,
      negativePrompt,
      characterLockText,
      appearanceWarnings,
      estimatedSpeechSeconds: estimateSpeechSeconds(uniqueDialogues.map((d) => d.line || ""), rule),
      ...splitPart ? { splitPart } : {}
    });
  }
  const lockedForContinuity = Array.from(new Set([
    ...params.knownCharacters || [],
    ...continuityLock.characterNames || [],
    ...parsed.detectedCharacters || [],
    charName
  ].filter(Boolean)));
  const withContinuity = attachClipContinuity(outputClips, lockedForContinuity, {
    appendToPrompt: true,
    initialPoses: normalizePoseList(continuityLock.characterPositionLocks),
    location
  }).clips;
  const withCharacters = enforceLibraryCharacterLocks(withContinuity, suppliedChars, scriptDeclared);
  return enforceLibraryLocationLocks(withCharacters, params.locations, {
    selectedLocationId: continuityLock.locationId || void 0,
    lockedLocation: continuityLock.location || void 0,
    timeOfDay: continuityLock.timeOfDay || void 0,
    lighting: continuityLock.lighting || void 0
  });
}
var LOCK_TAIL = "identical face, hair and outfit in every clip";
var POSE_RULE = "pose/position: follow the Stance/Position Lock and the action of this clip (ignore any default pose of the library card)";
function enforceLibraryCharacterLocks(clips, supplied = [], scriptDeclared = []) {
  const libraryNames = (supplied || []).map((s) => String(s?.name || "").trim()).filter(Boolean);
  return clips.map((c) => {
    const previousNames = String(c.characterLockText || "").split(" | ").map((t) => t.replace(/\s*\(.*$/, "").trim()).filter((n) => n && n.length <= 40 && !/[:";]/.test(n));
    const names = expandCombinedCharacterNames([...c.charactersPresent || [], ...previousNames]).filter((n) => n && !isReservedSystemKeyword(n) && !isMetadataKeyword(n));
    if (names.length === 0) return c;
    const r = buildCharacterAppearanceLock(names, supplied, scriptDeclared);
    const refLines = r.profiles.map(formatReferenceImageLine).filter(Boolean);
    const lockBlock = `Character Lock: ${r.text}, ${LOCK_TAIL}; ${POSE_RULE}.${refLines.length > 0 ? ` Reference image: ${refLines.join("; ")}.` : ""}`;
    let prompt = String(c.generatedPrompt || "");
    prompt = stripExact(prompt, [lockBlock, String(c.characterLockText || "")]);
    const removed = removeSections(prompt, (s) => s.label === "Character Lock" || s.label === "Reference image" && !/reference photo — match exactly/.test(s.text));
    prompt = removed.prompt;
    const anchor = findSections(prompt).find((s) => s.label === "Spatial Positioning Lock" || s.label === "Starting moment" || s.label === "Core action");
    let insertAt = removed.firstIndex;
    if (insertAt === -1 || insertAt > prompt.length || anchor && insertAt > anchor.start) insertAt = anchor ? anchor.start : prompt.length;
    const MARK = "\0LOCK\0";
    prompt = `${prompt.slice(0, insertAt)}${MARK}${prompt.slice(insertAt)}`;
    const stripped = stripInventedLooks(prompt, r.profiles.filter((p) => p.hasAppearance).map((p) => p.name).concat(libraryNames));
    const inventedWarnings = stripped.removed.map((x) => `\u0E15\u0E31\u0E14\u0E23\u0E39\u0E1B\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E21\u0E32\u0E08\u0E32\u0E01\u0E04\u0E25\u0E31\u0E07\u0E02\u0E2D\u0E07 ${x.name} \u0E2D\u0E2D\u0E01: "(${x.text})" \u2014 \u0E43\u0E0A\u0E49 Character Lock \u0E08\u0E32\u0E01\u0E04\u0E25\u0E31\u0E07\u0E41\u0E17\u0E19 / Removed a look not from the library for ${x.name}`);
    const at = stripped.prompt.indexOf(MARK);
    prompt = insertBlock(stripped.prompt.replace(MARK, ""), at, lockBlock);
    return {
      ...c,
      generatedPrompt: prompt,
      characterLockText: r.text,
      appearanceWarnings: Array.from(/* @__PURE__ */ new Set([...r.warnings, ...inventedWarnings]))
    };
  });
}
var LOOK_WORD_RE = /\b(?:fur|furry|suit|shirt|t-shirt|dress|jeans|jacket|denim|hair|haired|skin|wearing|wears|outfit|pants|trousers|skirt|shoes|sneakers|boots|hat|cap|coat|hoodie|uniform|scales|horns|basket|tie|glasses|red|blue|green|black|white|brown|yellow|grey|gray|pink|purple|orange|golden|blonde)\b|ชุด|เสื้อ|กางเกง|กระโปรง|ทรงผม|ผมยาว|ผมสั้น|ขนสี|ขนฟู|สวมใส่|รองเท้า|หมวก|แว่นตา/i;
function stripInventedLooks(prompt, names) {
  const removed = [];
  let out = prompt;
  Array.from(new Set(names.filter((n) => n && n.length >= 2))).forEach((name) => {
    const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(([^()]{1,200})\\)`, "g");
    out = out.replace(re, (m, inner) => {
      if (!LOOK_WORD_RE.test(inner)) return m;
      removed.push({ name, text: inner.trim() });
      return name;
    });
  });
  return { prompt: out, removed };
}
function attachClipContinuity(clips, lockedCharacters, options = {}) {
  const initialPoses = normalizePoseList(options.initialPoses);
  const locked = Array.from(new Set((lockedCharacters || []).flatMap((n) => String(n || "").split(/\s*,\s*/)).map((n) => n.trim()).filter((n) => n.length >= 2 && !isReservedSystemKeyword(n) && !isMetadataKeyword(n))));
  const analysis = analyzeClipContinuity({
    lockedCharacters: locked,
    initialPoses,
    clips: clips.map((c) => ({
      text: `${c.sceneSummary || ""}`,
      speakers: (c.dialogues || []).map((d) => d.speaker),
      location: c.locationName || options.location || "",
      sceneKey: c.splitPart?.sourceSceneNumber != null ? `scene_${c.splitPart.sourceSceneNumber}` : void 0
    }))
  });
  const filled = clips.map((c, i) => {
    const st = analysis.clips[i];
    const givenStart = normalizePoseList(c.startPoses);
    const givenEnd = normalizePoseList(c.endPoses);
    const givenPresent = Array.isArray(c.charactersPresent) ? c.charactersPresent.filter((n) => typeof n === "string" && n.trim()) : [];
    return {
      ...c,
      charactersPresent: Array.from(/* @__PURE__ */ new Set([...givenPresent, ...st?.charactersPresent || []])),
      startPoses: givenStart.length > 0 ? givenStart : st?.startPoses || [],
      endPoses: givenEnd.length > 0 ? givenEnd : st?.endPoses || []
    };
  });
  const handoff = enforcePoseHandoff(filled);
  const byIndexWarnings = analysis.warnings.map((w) => ({ ...w, clipNumber: clips[w.clipNumber - 1]?.clipNumber || w.clipNumber }));
  const warnings = [...byIndexWarnings, ...handoff.warnings];
  const out = handoff.clips.map((c, i) => {
    const clipWarnings = warnings.filter((w) => w.clipNumber === c.clipNumber);
    let generatedPrompt = c.generatedPrompt || "";
    if (options.appendToPrompt && !generatedPrompt.includes("Continuity Handoff:")) {
      const block = formatContinuityForPrompt({
        charactersPresent: c.charactersPresent || [],
        startPoses: c.startPoses || [],
        endPoses: c.endPoses || [],
        left: analysis.clips[i]?.left || []
      }, i === 0 && initialPoses.length === 0);
      if (block) generatedPrompt = `${generatedPrompt.replace(/\s+$/, "")}${/[.!?]$/.test(generatedPrompt.trim()) ? "" : "."} Continuity Handoff: ${block}.`;
    }
    return { ...c, generatedPrompt, continuityWarnings: clipWarnings };
  });
  return { clips: out, warnings };
}
function cleanFieldValue(val) {
  if (!val) return "";
  let str = val.trim();
  for (const forbidden of FORBIDDEN_PLACEHOLDER_SUBSTRINGS) {
    if (containsForbiddenPlaceholder(str, forbidden)) {
      return "";
    }
  }
  return str;
}
function lockDuplicationProblems(clip) {
  const prompt = String(clip.generatedPrompt || "");
  const out = [];
  const locks = findSections(prompt).filter((s) => s.label === "Character Lock").length;
  if (locks > 1) out.push(`Character Lock \u0E1B\u0E23\u0E32\u0E01\u0E0F ${locks} \u0E04\u0E23\u0E31\u0E49\u0E07 (\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27) / Character Lock appears ${locks} times`);
  const tails = countOccurrences(prompt, LOCK_TAIL);
  if (tails > 1) out.push(`\u0E17\u0E49\u0E32\u0E22 Character Lock \u0E0B\u0E49\u0E33 ${tails} \u0E04\u0E23\u0E31\u0E49\u0E07 \u2014 \u0E21\u0E35\u0E2A\u0E33\u0E40\u0E19\u0E32 Lock \u0E40\u0E01\u0E48\u0E32\u0E04\u0E49\u0E32\u0E07\u0E2D\u0E22\u0E39\u0E48 / orphaned copy of an old Character Lock`);
  const entries = String(clip.characterLockText || "").split(" | ").filter((e) => e.length > 30);
  entries.forEach((e) => {
    const n = countOccurrences(prompt, e);
    const name = e.replace(/\s*\(.*$/, "");
    if (n > 1) out.push(`\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E39\u0E1B\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C\u0E08\u0E32\u0E01\u0E04\u0E25\u0E31\u0E07\u0E02\u0E2D\u0E07 ${name} \u0E0B\u0E49\u0E33 ${n} \u0E04\u0E23\u0E31\u0E49\u0E07 / library appearance of ${name} repeated ${n}\xD7`);
    const longest = (e.match(/(?:appearance|outfit|face): ("[^"]+"|[^;]+)/g) || []).map((v) => v.replace(/^\w+: "?|"?$/g, "")).sort((a, b) => b.length - a.length)[0];
    if (longest && longest.length > 40) {
      const k = countOccurrences(prompt, longest.slice(0, 60));
      if (k > 1 && n <= 1) out.push(`\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E23\u0E39\u0E1B\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C\u0E02\u0E2D\u0E07 ${name} \u0E1B\u0E23\u0E32\u0E01\u0E0F ${k} \u0E04\u0E23\u0E31\u0E49\u0E07 / appearance text of ${name} appears ${k}\xD7`);
    }
  });
  const tags = Array.from(new Set(String(clip.characterLockText || "").match(/\([^()\s]+_consistent_char:[\d.]+\)/g) || []));
  tags.forEach((t) => {
    const n = countOccurrences(prompt, t);
    if (n > 1) out.push(`\u0E41\u0E17\u0E47\u0E01 ${t} \u0E0B\u0E49\u0E33 ${n} \u0E04\u0E23\u0E31\u0E49\u0E07 / tag repeated ${n}\xD7`);
  });
  const locBlocks = countOccurrences(prompt, "Location Lock (library, verbatim):");
  if (locBlocks > 1) out.push(`Location Lock \u0E1B\u0E23\u0E32\u0E01\u0E0F ${locBlocks} \u0E04\u0E23\u0E31\u0E49\u0E07 / Location Lock appears ${locBlocks} times`);
  return out;
}
function validateSalaMultiClipPrompts(clips, declaredCharacters) {
  const errors = [];
  const warnings = [];
  const issues = [];
  const declaredSet = new Set(
    (declaredCharacters || []).map((c) => c.trim().toLowerCase()).filter(Boolean)
  );
  clips.forEach((clip, idx) => {
    const clipNum = clip.clipNumber || idx + 1;
    clip.dialogues.forEach((d, dIdx) => {
      if (isReservedSystemKeyword(d.speaker)) {
        const msg = `Clip ${clipNum} \u0E21\u0E35\u0E01\u0E32\u0E23\u0E43\u0E0A\u0E49 Reserved System Keyword "${d.speaker}" \u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14\u0E43\u0E19\u0E1A\u0E17\u0E1E\u0E39\u0E14 \u0E2B\u0E49\u0E32\u0E21\u0E43\u0E0A\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14\u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14`;
        errors.push(msg);
        issues.push({
          id: `err_reserved_speaker_${clipNum}_${dIdx}`,
          clipNumber: clipNum,
          type: "dialogue",
          severity: "error",
          title: `Reserved Keyword "${d.speaker}" detected in dialogue`,
          description: msg,
          suggestion: "\u0E25\u0E1A\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E23\u0E30\u0E1A\u0E1A\u0E19\u0E35\u0E49\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E1A\u0E17\u0E1E\u0E39\u0E14 \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E08\u0E23\u0E34\u0E07"
        });
      }
      if (declaredSet.size > 0 && !isReservedSystemKeyword(d.speaker)) {
        const spLower = d.speaker.trim().toLowerCase();
        const isMatched = declaredSet.has(spLower) || Array.from(declaredSet).some((ds) => ds.includes(spLower) || spLower.includes(ds));
        if (!isMatched) {
          warnings.push(`Clip ${clipNum} \u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14 "${d.speaker}" \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E16\u0E39\u0E01\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E43\u0E19\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23 (CHARACTERS)`);
          issues.push({
            id: `warn_undeclared_speaker_${clipNum}_${dIdx}`,
            clipNumber: clipNum,
            type: "character",
            severity: "warning",
            title: `\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14 "${d.speaker}" \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E43\u0E19 CHARACTERS`,
            description: `\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14 ${d.speaker} \u0E1B\u0E23\u0E32\u0E01\u0E0F\u0E43\u0E19\u0E1A\u0E17\u0E1E\u0E39\u0E14\u0E41\u0E15\u0E48\u0E44\u0E21\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01\u0E17\u0E35\u0E48\u0E25\u0E07\u0E17\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E19\u0E44\u0E27\u0E49`,
            suggestion: `\u0E40\u0E1E\u0E34\u0E48\u0E21 "${d.speaker}" \u0E43\u0E19\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23 CHARACTERS \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E08\u0E32\u0E01\u0E04\u0E25\u0E31\u0E07`
          });
        }
      }
    });
    FORBIDDEN_PLACEHOLDER_SUBSTRINGS.forEach((placeholder) => {
      if (clip.generatedPrompt && containsForbiddenPlaceholder(clip.generatedPrompt, placeholder)) {
        const msg = `Clip ${clipNum} \u0E1E\u0E1A Placeholder \u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15\u0E43\u0E19 Prompt: "${placeholder}"`;
        errors.push(msg);
        issues.push({
          id: `err_placeholder_${clipNum}_${placeholder}`,
          clipNumber: clipNum,
          type: "props",
          severity: "error",
          title: `\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E02\u0E31\u0E14\u0E41\u0E22\u0E49\u0E07/Placeholder "${placeholder}"`,
          description: msg,
          suggestion: "\u0E15\u0E31\u0E14\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E40\u0E17\u0E21\u0E40\u0E1E\u0E25\u0E15\u0E40\u0E14\u0E34\u0E21\u0E2D\u0E2D\u0E01 \u0E41\u0E25\u0E30\u0E43\u0E0A\u0E49\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E08\u0E23\u0E34\u0E07\u0E08\u0E32\u0E01\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23"
        });
      }
    });
    if (!clip.generatedPrompt || clip.generatedPrompt.trim().length < 20) {
      errors.push(`Clip ${clipNum} \u0E21\u0E35 Prompt \u0E27\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E25\u0E48\u0E32\u0E2B\u0E23\u0E37\u0E2D\u0E2A\u0E31\u0E49\u0E19\u0E40\u0E01\u0E34\u0E19\u0E44\u0E1B`);
    }
    (clip.continuityWarnings || []).forEach((w, wIdx) => {
      warnings.push(w.message);
      issues.push({
        id: `warn_continuity_${clipNum}_${w.type}_${wIdx}`,
        clipNumber: clipNum,
        type: w.type === "missing_character" ? "character" : "event_order",
        severity: "warning",
        title: w.type === "missing_character" ? `${w.character} \u0E2B\u0E32\u0E22\u0E44\u0E1B\u0E08\u0E32\u0E01\u0E04\u0E25\u0E34\u0E1B\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E09\u0E32\u0E01` : `\u0E17\u0E48\u0E32\u0E17\u0E32\u0E07/\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E02\u0E2D\u0E07 ${w.character} \u0E44\u0E21\u0E48\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07`,
        description: w.message,
        suggestion: w.type === "missing_character" ? `\u0E43\u0E2A\u0E48 ${w.character} \u0E43\u0E19\u0E04\u0E25\u0E34\u0E1B\u0E19\u0E35\u0E49 \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E02\u0E35\u0E22\u0E19\u0E43\u0E19\u0E1A\u0E17\u0E27\u0E48\u0E32 ${w.character} \u0E40\u0E14\u0E34\u0E19\u0E2D\u0E2D\u0E01\u0E44\u0E1B` : "\u0E43\u0E2B\u0E49\u0E17\u0E48\u0E32\u0E40\u0E23\u0E34\u0E48\u0E21\u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E19\u0E35\u0E49\u0E40\u0E17\u0E48\u0E32\u0E01\u0E31\u0E1A\u0E17\u0E48\u0E32\u0E08\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E01\u0E48\u0E2D\u0E19 \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E02\u0E35\u0E22\u0E19\u0E01\u0E32\u0E23\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27 (\u0E25\u0E38\u0E01\u0E02\u0E36\u0E49\u0E19/\u0E19\u0E31\u0E48\u0E07\u0E25\u0E07/\u0E40\u0E14\u0E34\u0E19\u0E44\u0E1B) \u0E43\u0E19\u0E1A\u0E17"
      });
    });
    lockDuplicationProblems(clip).forEach((w, wIdx) => {
      const msg = `Clip ${clipNum}: ${w}`;
      warnings.push(msg);
      issues.push({
        id: `warn_lockdup_${clipNum}_${wIdx}`,
        clipNumber: clipNum,
        type: "costume",
        severity: "warning",
        title: "Lock \u0E0B\u0E49\u0E33 / \u0E04\u0E49\u0E32\u0E07\u0E43\u0E19\u0E1E\u0E23\u0E2D\u0E21\u0E15\u0E4C",
        description: msg,
        suggestion: "\u0E2A\u0E23\u0E49\u0E32\u0E07 Prompt \u0E43\u0E2B\u0E21\u0E48 \u2014 Character Lock / Location Lock \u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27\u0E15\u0E48\u0E2D\u0E04\u0E25\u0E34\u0E1B"
      });
    });
    (clip.locationWarnings || []).forEach((w, wIdx) => {
      if (warnings.includes(w)) return;
      warnings.push(w);
      issues.push({
        id: `warn_location_${clipNum}_${wIdx}`,
        clipNumber: clipNum,
        type: "location",
        severity: "warning",
        title: w.startsWith("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48") ? "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E04\u0E25\u0E31\u0E07" : "\u0E23\u0E39\u0E1B\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E32\u0E22",
        description: w,
        suggestion: w.startsWith("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48") ? "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E43\u0E19\u0E04\u0E25\u0E31\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48 \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E08\u0E32\u0E01\u0E04\u0E25\u0E31\u0E07\u0E43\u0E19\u0E41\u0E1C\u0E07 Location Lock" : "\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14\u0E23\u0E39\u0E1B\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E43\u0E2B\u0E21\u0E48\u0E14\u0E49\u0E27\u0E22\u0E1B\u0E38\u0E48\u0E21 \u0E41\u0E01\u0E49\u0E44\u0E02 (Edit) \u0E43\u0E19\u0E04\u0E25\u0E31\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48"
      });
    });
    (clip.appearanceWarnings || []).forEach((w, wIdx) => {
      if (warnings.includes(w)) return;
      warnings.push(w);
      issues.push({
        id: `warn_appearance_${clipNum}_${wIdx}`,
        clipNumber: clipNum,
        type: "costume",
        severity: "warning",
        title: "Character Lock \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E39\u0E1B\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C",
        description: w,
        suggestion: "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E43\u0E1A\u0E2B\u0E19\u0E49\u0E32 / \u0E17\u0E23\u0E07\u0E1C\u0E21 / \u0E0A\u0E38\u0E14 \u0E43\u0E19\u0E04\u0E25\u0E31\u0E07\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23 \u0E2B\u0E23\u0E37\u0E2D\u0E43\u0E19\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E02\u0E2D\u0E07\u0E1A\u0E17"
      });
    });
    if (idx > 0) {
      const prevClip = clips[idx - 1];
      if (!clip.startAction || !prevClip.endAction) {
        warnings.push(`Clip ${clipNum} \u0E23\u0E2D\u0E22\u0E15\u0E48\u0E2D\u0E42\u0E21\u0E40\u0E21\u0E19\u0E15\u0E31\u0E21\u0E2D\u0E32\u0E08\u0E02\u0E32\u0E14\u0E15\u0E2D\u0E19\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E17\u0E35\u0E48 ${clipNum - 1} \u0E41\u0E25\u0E30 ${clipNum}`);
        issues.push({
          id: `warn_momentum_${clipNum}`,
          clipNumber: clipNum,
          type: "event_order",
          severity: "warning",
          title: `\u0E23\u0E2D\u0E22\u0E15\u0E48\u0E2D\u0E42\u0E21\u0E40\u0E21\u0E19\u0E15\u0E31\u0E21\u0E02\u0E32\u0E14\u0E0A\u0E48\u0E27\u0E07\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E04\u0E25\u0E34\u0E1B ${clipNum - 1} \u0E41\u0E25\u0E30 ${clipNum}`,
          description: "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07\u0E15\u0E48\u0E2D\u0E01\u0E32\u0E23\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27\u0E2B\u0E23\u0E37\u0E2D\u0E21\u0E38\u0E21\u0E01\u0E25\u0E49\u0E2D\u0E07\u0E08\u0E32\u0E01\u0E04\u0E25\u0E34\u0E1B\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32",
          suggestion: "\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E42\u0E22\u0E07 startAction \u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E19\u0E35\u0E49\u0E43\u0E2B\u0E49\u0E2A\u0E2D\u0E14\u0E23\u0E31\u0E1A\u0E01\u0E31\u0E1A endAction \u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32"
        });
      }
    }
  });
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    issues
  };
}

// src/services/storyEpisodeEngine.ts
var UNSPECIFIED = "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E08\u0E32\u0E01\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A";
var SPEAKER_STOPWORDS = /* @__PURE__ */ new Set([
  "\u0E41\u0E25\u0E49\u0E27",
  "\u0E08\u0E36\u0E07",
  "\u0E01\u0E47",
  "\u0E41\u0E25\u0E30",
  "\u0E40\u0E02\u0E32",
  "\u0E40\u0E18\u0E2D",
  "\u0E21\u0E31\u0E19",
  "\u0E17\u0E38\u0E01\u0E04\u0E19",
  "\u0E1E\u0E27\u0E01\u0E40\u0E02\u0E32",
  "\u0E17\u0E31\u0E49\u0E07\u0E2A\u0E2D\u0E07",
  "\u0E43\u0E04\u0E23",
  "\u0E40\u0E2A\u0E35\u0E22\u0E07"
]);
var TIME_WORD_REGEX = /(กลางคืน|ตอนกลางคืน|ยามค่ำคืน|ค่ำคืน|หัวค่ำ|พลบค่ำ|ค่ำ|ดึก|เที่ยงคืน|กลางวัน|ตอนกลางวัน|เที่ยงวัน|เที่ยง|บ่าย|เช้าตรู่|รุ่งเช้า|รุ่งสาง|ตอนเช้า|ยามเช้า|เช้า|ยามเย็น|ตอนเย็น|เย็น|สายัณห์|night|day|dawn|dusk|morning|evening|noon|midnight)/i;
var SCENE_HEADER_REGEX = /^(?:#{1,6}\s*)?[*_\[【(]*\s*(?:ฉากที่|ฉาก|Scene|SCENE|scene)\s*(\d{1,3})\s*[*_\]】)]*\s*(?:[:：.\-–—]\s*)?(.*)$/;
var CHAT_LINE_REGEX = /^(?:ได้(?:เลย)?(?:ครับ|ค่ะ|คะ)|แน่นอน|นี่คือ|นี่เป็น|ต่อไปนี้คือ|ด้านล่างนี้|ผม(?:ได้)?(?:เขียน|จัด|ทำ)|ฉัน(?:ได้)?(?:เขียน|จัด|ทำ)|หวังว่า|ถ้า(?:จะ|ต้องการ|อยาก|คุณ)|หาก(?:ต้องการ|อยาก|คุณ|จะ)|ต้องการให้|อยากให้|บอกได้|แจ้งได้|สามารถ(?:นำ|บอก|แจ้ง|ปรับ)|รูปแบบ\s*[:：]|หมายเหตุ\s*[:：]|Sure\b|Here(?:'s| is| are)\b|Of course\b|If you\b|Let me know\b|Hope this\b|Note\s*:)/i;
var CHAT_CONTENT_REGEX = /(Sala AI|บอกได้เลย|แจ้งได้เลย|ได้เลยนะ(?:ครับ|คะ|ค่ะ)|ให้ผม(?:ช่วย|ปรับ|เขียน)|ให้ฉัน(?:ช่วย|ปรับ|เขียน)|ต้องการปรับ|let me know)/i;
var SEPARATOR_REGEX = /^(?:[-=*_~]{3,}|```.*)$/;
var DURATION_REGEX = /\(\s*(?:ประมาณ|ราว|~)?\s*\d+(?:[.,]\d+)?\s*(?:วินาที|วิ|นาที|s|sec|secs|seconds?)\s*\)/gi;
var ENDING_TAIL_LINES = 3;
var STRONG_ENDING_RE = /(จบบริบูรณ์|จบเรื่อง|ตอนจบ|จบฉาก|จบตอน|บริบูรณ์|THE\s*-?\s*END\b)/i;
var STANDALONE_ENDING_LINE_RE = /^[\s\-–—=~*_#.\[\](){}【】「」]*(?:จบ|END|FIN)[\s\-–—=~*_#.!\[\](){}【】「」]*$/i;
var TRAILING_ENDING_RE = /\s[\-–—\[(]*จบ[\-–—\])]*[.!]?\s*$/;
function hasExplicitEndingMarker(text) {
  if (!text) return false;
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return false;
  let lastHeader = -1;
  lines.forEach((l, i) => {
    if (SCENE_HEADER_REGEX.test(l)) lastHeader = i;
  });
  const lastBlock = lastHeader >= 0 ? lines.slice(lastHeader + 1) : lines;
  const block = lastBlock.length > 0 ? lastBlock : lines.slice(lastHeader);
  const tail = block.slice(-ENDING_TAIL_LINES).map((l) => l.replace(/["“”][^"“”]*["“”]|'[^']*'|‘[^’]*’/g, " ").trim()).filter(Boolean);
  return tail.some((l) => STRONG_ENDING_RE.test(l) || STANDALONE_ENDING_LINE_RE.test(l) || TRAILING_ENDING_RE.test(l));
}
var ENDING_MARKER_GLOBAL = /จบบริบูรณ์|จบเรื่อง|บริบูรณ์|THE\s*END|THE-END|[-–—]+\s*จบ\s*[-–—]+|\[จบ\]|\(จบ\)/gi;
function isChatLine(line) {
  const l = line.trim();
  if (!l) return true;
  if (SEPARATOR_REGEX.test(l)) return true;
  if (/["“”]/.test(l)) return false;
  if (CHAT_LINE_REGEX.test(l) || CHAT_CONTENT_REGEX.test(l)) return true;
  return /^(?:ขอให้|ขอบคุณ|ยินดี)/.test(l) || /(?:นะ)(?:ครับ|คะ|ค่ะ)[!.\s]*$/.test(l);
}
function isOffScreenSpeaker(name) {
  if (!name) return false;
  const n = name.trim();
  return /^เสียง/.test(n) || /^(?:ผู้บรรยาย|คนบรรยาย|บรรยาย|narrator|voice|v\.?o\.?)\b/i.test(n) || /\((?:O\.?S\.?|V\.?O\.?)\)/i.test(n);
}
function normalizeSpeakerName(raw, declaredNames = []) {
  if (!raw) return "";
  let s = raw.replace(/[*_#"“”'`\[\]【】]/g, "").replace(/\([^)]*\)/g, "").replace(/^[-•\s]+/, "").replace(/[:：]+$/, "").trim();
  if (!s) return "";
  const declared = [...declaredNames].filter(Boolean).sort((a, b) => b.length - a.length);
  const exact = declared.find((d) => d === s);
  if (exact) return exact;
  const startsWith = declared.find((d) => s.startsWith(d));
  if (startsWith) return startsWith;
  if (isOffScreenSpeaker(s)) {
    return stripSpeechVerbs(s);
  }
  s = stripSpeechVerbs(s);
  const tokens = s.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) s = tokens[0];
  const contained = declared.find((d) => s.includes(d));
  if (contained) return contained;
  return s.trim();
}
function stripSpeechVerbs(input) {
  let s = input.trim();
  let cut = -1;
  for (const v of SPEECH_VERBS) {
    const idx = s.indexOf(v);
    if (idx >= 2 && (cut === -1 || idx < cut)) cut = idx;
  }
  if (cut > 0) s = s.slice(0, cut);
  return s.replace(/\s*(?:ขึ้น|ออกมา|เบาๆ|เสียงดัง|ว่า)\s*$/, "").trim();
}
var ACTION_VERBS = ["\u0E40\u0E14\u0E34\u0E19", "\u0E27\u0E34\u0E48\u0E07", "\u0E22\u0E37\u0E19", "\u0E19\u0E31\u0E48\u0E07", "\u0E2B\u0E31\u0E19", "\u0E21\u0E2D\u0E07", "\u0E01\u0E49\u0E32\u0E27", "\u0E2B\u0E22\u0E38\u0E14", "\u0E22\u0E01", "\u0E08\u0E31\u0E1A", "\u0E04\u0E27\u0E49\u0E32", "\u0E01\u0E2D\u0E14", "\u0E0A\u0E35\u0E49", "\u0E2A\u0E48\u0E2D\u0E07", "\u0E04\u0E48\u0E2D\u0E22\u0E46", "\u0E23\u0E35\u0E1A", "\u0E1E\u0E22\u0E31\u0E01", "\u0E2A\u0E48\u0E32\u0E22", "\u0E16\u0E2D\u0E22", "\u0E40\u0E07\u0E22", "\u0E01\u0E49\u0E21", "\u0E25\u0E38\u0E01", "\u0E40\u0E1B\u0E34\u0E14", "\u0E1B\u0E34\u0E14", "\u0E2B\u0E22\u0E34\u0E1A", "\u0E01\u0E33\u0E25\u0E31\u0E07"];
function cutAtActionVerb(clause) {
  const c = (clause || "").trim().split(/\s+/)[0] || "";
  let cut = -1;
  for (const v of ACTION_VERBS) {
    const idx = c.indexOf(v);
    if (idx >= 2 && (cut === -1 || idx < cut)) cut = idx;
  }
  return cut > 0 ? c.slice(0, cut) : c;
}
function isPlausibleSpeaker(name) {
  if (!name) return false;
  const n = name.trim();
  if (n.length < 2 || n.length > 40) return false;
  if (/^\d+$/.test(n)) return false;
  if (SPEAKER_STOPWORDS.has(n)) return false;
  if (SPEECH_VERBS.some((v) => n === v || n === v + "\u0E27\u0E48\u0E32")) return false;
  if (isReservedSystemKeyword(n) || isMetadataKeyword(n)) return false;
  return true;
}
function splitCharacterList(raw) {
  return raw.split(/,|、|\/|และ|&|，/).map((s) => s.replace(/\([^)]*\)/g, "").trim()).filter(Boolean);
}
function extractLocationFromText(text) {
  if (!text) return "";
  const cleaned = text.replace(DURATION_REGEX, " ");
  const re = /(?:^|[\s(,"“])(?:ใน|ที่|ณ)\s*([ก-๙a-zA-Z][ก-๙a-zA-Z0-9_\-]*?)(?=กลางคืน|ตอนกลางคืน|ยามค่ำคืน|ค่ำคืน|กลางวัน|ตอนกลางวัน|เช้าตรู่|ตอนเช้า|ยามเช้า|ยามเย็น|ตอนเย็น|ดึก|\s|$|[.,)"”])/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    const cand = (m[1] || "").trim();
    if (isValidLocationCandidate(cand)) return cand;
  }
  return "";
}
function isValidLocationCandidate(cand) {
  if (!cand) return false;
  const c = cand.trim();
  if (c.length < 2) return false;
  if (/^[\d\s.,:]+$/.test(c)) return false;
  if (/^\d/.test(c)) return false;
  if (/(?:วินาที|นาที|ชั่วโมง|seconds?|sec)$/i.test(c)) return false;
  if (TIME_WORD_REGEX.test(c) && c.replace(TIME_WORD_REGEX, "").length < 2) return false;
  const stop = ["\u0E01\u0E32\u0E23", "\u0E04\u0E27\u0E32\u0E21", "\u0E01\u0E32\u0E23\u0E17\u0E35\u0E48", "\u0E19\u0E31\u0E48\u0E19", "\u0E19\u0E35\u0E48", "\u0E19\u0E35\u0E49", "\u0E19\u0E31\u0E49\u0E19", "\u0E44\u0E2B\u0E19", "\u0E2A\u0E38\u0E14", "\u0E08\u0E23\u0E34\u0E07", "\u0E02\u0E13\u0E30", "\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07", "\u0E15\u0E2D\u0E19", "\u0E40\u0E27\u0E25\u0E32", "\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14", "\u0E17\u0E31\u0E19\u0E17\u0E35", "\u0E43\u0E08"];
  if (stop.includes(c)) return false;
  if (isReservedSystemKeyword(c) || isMetadataKeyword(c)) return false;
  return true;
}
function detectTimeOfDay(text) {
  if (!text) return "";
  if (/(ตอนกลางคืน|ยามค่ำคืน|ค่ำคืน|กลางคืน|ดึก|เที่ยงคืน|night|midnight)/i.test(text)) return "\u0E01\u0E25\u0E32\u0E07\u0E04\u0E37\u0E19";
  if (/(เช้าตรู่|รุ่งเช้า|รุ่งสาง|ยามเช้า|แสงแรก|ตอนเช้า|ช่วงเช้า|dawn|morning)/i.test(text)) return "\u0E40\u0E0A\u0E49\u0E32\u0E15\u0E23\u0E39\u0E48";
  if (/(กลางวัน|ตอนกลางวัน|เที่ยงวัน|บ่าย|noon|\bday\b)/i.test(text)) return "\u0E01\u0E25\u0E32\u0E07\u0E27\u0E31\u0E19";
  if (/(ยามเย็น|ตอนเย็น|ช่วงเย็น|เวลาเย็น|พระอาทิตย์ตก|สายัณห์|หัวค่ำ|พลบค่ำ|dusk|evening)/i.test(text)) return "\u0E22\u0E32\u0E21\u0E40\u0E22\u0E47\u0E19";
  return "";
}
var LOCATION_NOUN_REGEX = /(บ้าน|ห้อง|ร้าน|ตลาด|โรงเรียน|โรงพยาบาล|โรงแรม|โรงงาน|ป่า|ถนน|ซอย|สวน|วัด|ทะเล|ชายหาด|หาด|แม่น้ำ|ริมน้ำ|คลอง|ภูเขา|ทุ่ง|ไร่|แคมป์|เต็นท์|ออฟฟิศ|สำนักงาน|บริษัท|คาเฟ่|สถานี|ป้ายรถ|สนาม|ลาน|ระเบียง|ดาดฟ้า|ครัว|ประตู|หน้าต่าง|บันได|ทางเดิน|โถง|ศาลา|หมู่บ้าน|เมือง|วิหาร|ถ้ำ|สะพาน|ท่าเรือ|สนามบิน|มหาวิทยาลัย|ห้าง|หอพัก|คอนโด|ลิฟต์|รถ|เรือ|ชายป่า|โต๊ะ|เวที|\broom\b|house|home|street|road|cafe|office|school|forest|park|beach|kitchen|bedroom|hall|station|market|temple|village|city|interior|exterior|\bINT\b|\bEXT\b)/i;
var TITLE_MOOD_REGEX = /(อารมณ์|ความรู้สึก|ตึงเครียด|เครียด|คืนดี|ดีกัน|ง้อ|หึง|ทะเลาะ|เริ่ม|บทสรุป|ตอนจบ|สรุป|ความจริง|เปิดใจ|สารภาพ|ขอโทษ|ให้อภัย|เข้าใจกัน|โกรธ|เสียใจ|ดีใจ|ตกใจ|ประทับใจ|ซึ้ง|อบอุ่น|หัวเราะ|ร้องไห้|ไคลแม็กซ์|จุดเปลี่ยน|บทนำ|เปิดเรื่อง|ความลับ|เผชิญหน้า|climax|ending|intro|mood|tension|reconcil)/gi;
var CONTINUATION_SUFFIX_REGEX = /(?:\s*\(\s*(?:ต่อเนื่อง|ต่อ|continued|cont'?d?)\s*\)|\s*ต่อเนื่อง|\s+(?:ต่อ|continued|cont'?d?))\s*$/i;
function isLocationLike(p) {
  const withoutMood = p.replace(TITLE_MOOD_REGEX, " ");
  return LOCATION_NOUN_REGEX.test(withoutMood) || /^(?:ใน|ที่|ณ)\s*\S/.test(p);
}
function isMoodLike(p) {
  TITLE_MOOD_REGEX.lastIndex = 0;
  const r = TITLE_MOOD_REGEX.test(p);
  TITLE_MOOD_REGEX.lastIndex = 0;
  return r;
}
function normalizeSceneLocation(raw) {
  let location = String(raw || "").trim();
  const continued = CONTINUATION_SUFFIX_REGEX.test(location);
  if (continued) location = location.replace(CONTINUATION_SUFFIX_REGEX, "").trim();
  const isTitle = !!location && isMoodLike(location) && !isLocationLike(location);
  return { location, continued, isTitle };
}
function parseSceneHeading(rest, hasPreviousLocation = false) {
  let r = (rest || "").replace(DURATION_REGEX, " ").replace(/\((?!\s*(?:ต่อ|cont))[^)]*\)/gi, " ").replace(/[*_]/g, "").trim();
  r = r.replace(/^[:：.\-–—\s]+/, "").replace(/[:：.\s]+$/, "");
  const empty = { location: "", timeOfDay: "", title: "", continued: false };
  if (!r) return empty;
  let continued = false;
  if (CONTINUATION_SUFFIX_REGEX.test(r)) {
    continued = true;
    r = r.replace(CONTINUATION_SUFFIX_REGEX, "").trim();
  }
  const parts = r.split(/\s+[-–—|]\s+|\s*[|/]\s*|\s+[-–—]|[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
  let location = "";
  let timeOfDay = "";
  const titleParts = [];
  const unknownParts = [];
  for (const p0 of parts) {
    let p = p0;
    if (CONTINUATION_SUFFIX_REGEX.test(p)) {
      continued = true;
      p = p.replace(CONTINUATION_SUFFIX_REGEX, "").trim();
    }
    if (!p) continue;
    const isTime = TIME_WORD_REGEX.test(p) && p.replace(TIME_WORD_REGEX, "").replace(/^(ตอน|ยาม|ช่วง)/, "").trim().length < 3;
    if (isTime && !timeOfDay) {
      timeOfDay = p;
      continue;
    }
    if (!location && isLocationLike(p) && isValidLocationCandidate(p)) {
      location = p;
      continue;
    }
    if (isMoodLike(p)) {
      titleParts.push(p);
      continue;
    }
    unknownParts.push(p);
  }
  if (!location && unknownParts.length > 0) {
    const cand = unknownParts[0];
    if ((!hasPreviousLocation || timeOfDay) && isValidLocationCandidate(cand)) {
      location = cand;
      unknownParts.shift();
    }
  }
  titleParts.push(...unknownParts);
  if (location) location = location.replace(/^(?:ใน|ที่|ณ)\s*/, "").trim();
  return { location, timeOfDay, title: titleParts.join(" - "), continued };
}
var META_TAG_REGEX = /^(?:ชื่อเรื่อง|เรื่อง|TITLE|แนว|ประเภท|GENRE|เวลา|ช่วงเวลา|TIME|สถานที่|สถานที่หลัก|LOCATION|ธีม|MOOD|TONE|มุมมอง|สไตล์|STYLE)\s*[:：=]\s*(.*)$/i;
var CHAR_BLOCK_HEADER_REGEX = /^(?:ตัวละคร(?:หลัก)?|รายชื่อตัวละคร|CHARACTERS?)\s*[:：=]?\s*(.*)$/i;
var CHAR_BULLET_REGEX = /^(?:[-*•]|\d+[.)])\s*([ก-๙a-zA-Z0-9_\- ]+?)\s*(?:\(([^)]*)\))?\s*[:：\-–—]\s*(.*)$/;
var SCENE_LABEL_REGEX = /^\(?\s*(?:เริ่มต้น|การกระทำ|แอ็กชัน|แอคชั่น|action|ภาพ|บรรยาย|รายละเอียด|สิ้นสุดฉาก|จบฉาก|ตำแหน่ง(?:ตัวละคร)?|มุมกล้อง|กล้อง|camera|เสียงประกอบ|sfx|บรรยากาศ|หมายเหตุ)\s*[:：]\s*(.*?)\)?$/i;
function parseStoryLine(line, nextLine, ctx) {
  const beats = [];
  let l = line.replace(/^[-*•]\s+/, "").trim();
  if (!l) return { beats, consumedNext: false };
  const labelMatch = l.match(SCENE_LABEL_REGEX);
  if (labelMatch && !/["“”]/.test(l)) {
    const t = (labelMatch[1] || "").trim();
    if (t) beats.push({ type: "action", text: t });
    return { beats, consumedNext: false };
  }
  const makeDialogue = (rawSpeaker, emotion, text, sourceText) => {
    const speaker = normalizeSpeakerName(rawSpeaker, ctx.declared);
    if (!isPlausibleSpeaker(speaker) || !text.trim()) return null;
    const offScreen = isOffScreenSpeaker(speaker);
    let delivery = (emotion || "").trim();
    if (!delivery) {
      const verbPart = rawSpeaker.replace(/[*_"“”]/g, "").trim().slice(speaker.length).trim();
      if (verbPart && verbPart.length <= 30) delivery = verbPart.replace(/ว่า$/, "").trim();
    }
    if (/^(?:พูด|บอก|กล่าว|เอ่ย|ตอบ|ว่า)$/.test(delivery)) delivery = "";
    const emotionOrAction = [delivery ? `(${delivery.replace(/^\(|\)$/g, "")})` : "", offScreen ? "(\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E19\u0E2D\u0E01\u0E08\u0E2D / off-screen)" : ""].filter(Boolean).join(" ");
    return {
      type: "dialogue",
      text: sourceText,
      dialogue: { speaker, emotionOrAction, dialogue: text.trim(), ...offScreen ? { offScreen: true } : {} }
    };
  };
  const headerOnly = l.match(/^([ก-๙a-zA-Z0-9_\- ]{2,40}?)\s*(?:\(([^)]*)\))?\s*[:：]$/);
  if (headerOnly && nextLine && /^["“][^"”]+["”]$/.test(nextLine.trim())) {
    const q = nextLine.trim().replace(/^["“]|["”]$/g, "");
    const b = makeDialogue(headerOnly[1], headerOnly[2] || "", q, `${headerOnly[1].trim()}: "${q}"`);
    if (b) return { beats: [b], consumedNext: true };
  }
  const single = l.match(/^([ก-๙a-zA-Z0-9_\- ]{2,40}?)\s*(?:\(([^)]*)\))?\s*[:：]\s*["“]([^"”]+)["”]\s*(.*)$/);
  if (single) {
    const b = makeDialogue(single[1], single[2] || "", single[3], l);
    if (b) {
      beats.push(b);
      const after = (single[4] || "").trim();
      if (after) beats.push({ type: "action", text: after });
      return { beats, consumedNext: false };
    }
  }
  const unquoted = l.match(/^([ก-๙a-zA-Z0-9_\- ]{2,40}?)\s*(?:\(([^)]*)\))?\s*[:：]\s*(.+)$/);
  if (unquoted) {
    const sp = normalizeSpeakerName(unquoted[1], ctx.declared);
    if (ctx.declared.includes(sp) || isOffScreenSpeaker(sp)) {
      const b = makeDialogue(unquoted[1], unquoted[2] || "", unquoted[3], l);
      if (b) return { beats: [b], consumedNext: false };
    }
  }
  const inline = l.match(/^(.*?)["“]([^"”]+)["”]\s*(.*)$/);
  if (inline && inline[2].trim()) {
    const pre = inline[1].replace(/[:：,]\s*$/, "").trim();
    const quote = inline[2].trim();
    const after = inline[3].trim();
    let speakerRaw = "";
    let before = "";
    if (pre) {
      const declared = [...ctx.declared].sort((a, b) => b.length - a.length);
      let bestIdx = -1;
      let best = "";
      for (const d of declared) {
        const idx = pre.indexOf(d);
        if (idx >= 0 && (bestIdx === -1 || idx < bestIdx)) {
          bestIdx = idx;
          best = d;
        }
      }
      if (best) {
        speakerRaw = pre.slice(bestIdx);
        before = pre.slice(0, bestIdx).trim();
      } else {
        const clauses = pre.split(/\s+(?:แล้ว|จึง|ก่อนจะ|พร้อม)\s*|[,，]\s*/);
        const lastClause = clauses[clauses.length - 1] || pre;
        const startsWithVerb = SPEECH_VERBS.some((v) => lastClause.startsWith(v));
        if (startsWithVerb && clauses.length > 1) {
          speakerRaw = cutAtActionVerb(clauses[0]) + lastClause;
          before = pre.slice(0, pre.length - lastClause.length).replace(/\s*(?:แล้ว|จึง|ก่อนจะ|พร้อม)\s*$/, "").trim();
        } else {
          speakerRaw = lastClause;
          before = pre.slice(0, pre.length - lastClause.length).trim();
        }
      }
    }
    const speakerCandidate = speakerRaw ? normalizeSpeakerName(speakerRaw, ctx.declared) : "";
    const hasVerbOrDeclared = !!speakerRaw && (ctx.declared.includes(speakerCandidate) || SPEECH_VERBS.some((v) => speakerRaw.includes(v)) || isOffScreenSpeaker(speakerCandidate));
    if (speakerCandidate && hasVerbOrDeclared) {
      if (before) beats.push({ type: "action", text: before });
      const verbPart = speakerRaw.slice(speakerRaw.indexOf(speakerCandidate) >= 0 ? speakerRaw.indexOf(speakerCandidate) + speakerCandidate.length : 0).trim();
      const b = makeDialogue(speakerCandidate, verbPart.replace(/ว่า$/, "").trim(), quote, l);
      if (b) {
        beats.push(b);
        if (after) beats.push({ type: "action", text: after });
        return { beats, consumedNext: false };
      }
    }
  }
  beats.push({ type: "action", text: l });
  return { beats, consumedNext: false };
}
function parseStoryStructure(rawStory) {
  const empty = {
    metadata: {},
    characters: [],
    offScreenSpeakers: [],
    narrativeBeats: [],
    allDialogues: [],
    scenes: [],
    hasSceneHeaders: false
  };
  if (!rawStory || typeof rawStory !== "string") return empty;
  const lines = rawStory.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const metadata = {};
  const characters = [];
  const offScreen = /* @__PURE__ */ new Set();
  const headerIdx = [];
  lines.forEach((l, i) => {
    if (SCENE_HEADER_REGEX.test(l)) headerIdx.push(i);
  });
  const hasSceneHeaders = headerIdx.length > 0;
  const preEnd = hasSceneHeaders ? headerIdx[0] : lines.length;
  let inCharBlock = false;
  const consumedPre = /* @__PURE__ */ new Set();
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
        splitCharacterList(ch[1]).forEach((n) => {
          const name = normalizeSpeakerName(n);
          if (isPlausibleSpeaker(name) && !isOffScreenSpeaker(name) && !characters.some((c) => c.name === name)) {
            characters.push({ name, description: "", declared: true });
          }
        });
      }
      continue;
    }
    if (inCharBlock) {
      const b = line.match(CHAR_BULLET_REGEX);
      if (b) {
        const name = b[1].trim();
        if (isPlausibleSpeaker(name) && !isOffScreenSpeaker(name) && !characters.some((c) => c.name === name)) {
          characters.push({ name, description: [b[2], b[3]].filter(Boolean).join(" ").trim(), declared: true });
        }
        consumedPre.add(i);
        continue;
      }
      if (/^[-*•]\s*[ก-๙a-zA-Z]/.test(line)) {
        const name = line.replace(/^[-*•]\s*/, "").replace(/\([^)]*\)/g, "").trim();
        if (isPlausibleSpeaker(name) && name.length <= 30 && !characters.some((c) => c.name === name)) {
          characters.push({ name, description: "", declared: true });
        }
        consumedPre.add(i);
        continue;
      }
      inCharBlock = false;
    }
  }
  const declaredNames = () => characters.map((c) => c.name);
  const narrativeBeats = [];
  const allDialogues = [];
  const scenes = [];
  const registerBeats = (beats, target) => {
    for (const b of beats) {
      if (b.type === "action" && (STANDALONE_ENDING_LINE_RE.test(b.text.trim()) || hasExplicitEndingMarker(b.text) && b.text.replace(ENDING_MARKER_GLOBAL, "").replace(/[\s\-–—()[\]]/g, "").length === 0)) continue;
      if (b.type === "dialogue" && b.dialogue) {
        allDialogues.push({ ...b.dialogue, beatIndex: narrativeBeats.length });
        if (b.dialogue.offScreen) offScreen.add(b.dialogue.speaker);
        else if (!characters.some((c) => c.name === b.dialogue.speaker)) {
          characters.push({ name: b.dialogue.speaker, description: "", declared: false });
        }
      }
      narrativeBeats.push(b);
      target.push(b);
    }
  };
  const parseBlock = (blockLines, target) => {
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
      const headerMatch = lines[start].match(SCENE_HEADER_REGEX);
      let body = lines.slice(start + 1, end);
      if (h === headerIdx.length - 1) {
        const sepIdx = body.findIndex((l) => SEPARATOR_REGEX.test(l));
        if (sepIdx >= 0 && body.slice(sepIdx + 1).every((l) => isChatLine(l) || !/["“”]/.test(l) && CHAT_CONTENT_REGEX.test(l))) {
          body = body.slice(0, sepIdx);
        }
        while (body.length > 0 && isChatLine(body[body.length - 1])) body.pop();
      }
      body = body.filter((l) => !SEPARATOR_REGEX.test(l));
      const prev = scenes.length > 0 ? scenes[scenes.length - 1] : null;
      const info = parseSceneHeading(headerMatch[2] || "", !!prev?.location);
      let { location, timeOfDay } = info;
      let inheritedLocation = false;
      if (!location && prev?.location) {
        location = prev.location;
        inheritedLocation = true;
      }
      if (!timeOfDay && prev?.timeOfDay && (inheritedLocation || info.continued || location === prev.location)) timeOfDay = prev.timeOfDay;
      const scene = {
        sceneNumber: Number(headerMatch[1]) || h + 1,
        heading: lines[start].replace(/[*_#]/g, "").trim(),
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
    const bodyIdx = [];
    for (let i = 0; i < lines.length; i++) if (!consumedPre.has(i)) bodyIdx.push(i);
    let body = bodyIdx.map((i) => lines[i]);
    while (body.length > 0 && isChatLine(body[0])) body.shift();
    while (body.length > 0 && isChatLine(body[body.length - 1])) body.pop();
    body = body.filter((l) => !SEPARATOR_REGEX.test(l));
    parseBlock(body, []);
  }
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
function buildUnitFromBeats(beats) {
  const actions = beats.filter((b) => b.type === "action").map((b) => b.text.trim()).filter(Boolean);
  const dialogues = beats.filter((b) => b.type === "dialogue" && b.dialogue).map((b) => b.dialogue);
  const actionText = actions.length > 0 ? actions.join(" ") : beats.filter((b) => b.type === "dialogue").map((b) => b.text.trim()).join(" ");
  const last = beats[beats.length - 1];
  return { actionText, actionBeats: actions, dialogues, endsWithDialogue: !!last && last.type === "dialogue" };
}
function splitStoryIntoSceneUnits(parsed, scenesPerChunk = 5) {
  if (parsed.hasSceneHeaders && parsed.scenes.length > 0) {
    return parsed.scenes.map((sc) => ({ ...buildUnitFromBeats(sc.beats), location: sc.location, timeOfDay: sc.timeOfDay, heading: sc.heading, title: sc.title })).filter((u) => u.actionText.trim() || u.dialogues.length > 0);
  }
  const groups = [];
  for (const b of parsed.narrativeBeats) {
    if (b.type === "action" || groups.length === 0) groups.push([b]);
    else groups[groups.length - 1].push(b);
  }
  if (groups.length === 0) return [];
  const target = Math.max(1, scenesPerChunk);
  const groupsPerScene = groups.length <= target * 2 ? 1 : Math.ceil(groups.length / (target * 2));
  const units = [];
  for (let i = 0; i < groups.length; i += groupsPerScene) {
    units.push(buildUnitFromBeats(groups.slice(i, i + groupsPerScene).flat()));
  }
  return units;
}
function pickMainCharacter(candidates, dialogues = [], fallback = []) {
  const ok = (n) => !!n && !isOffScreenSpeaker(n) && !isReservedSystemKeyword(n) && !isMetadataKeyword(n);
  const fromChars = candidates.find(ok);
  if (fromChars) return fromChars;
  const fromDlg = dialogues.map((d) => d.speaker).find(ok);
  if (fromDlg) return fromDlg;
  return fallback.find(ok) || "";
}
function buildStoryLocks(params) {
  const { parsedStory, libraryCharacters = [], continuityLock = null } = params;
  const characterLocks = /* @__PURE__ */ new Map();
  const profiles = /* @__PURE__ */ new Map();
  const characterWarnings = [];
  const declaredList = mergeDeclaredCharacters(parsedStory.characters, params.storyText || "");
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
  const lockFor = (name) => {
    if (!name) return "";
    if (characterLocks.has(name)) return characterLocks.get(name);
    const r = resolveCharacterProfiles([name], [...libraryCharacters || [], ...lockChar], declaredList);
    const prof = r.profiles[0];
    const text = prof ? formatCharacterAppearanceLock(prof) : name;
    if (prof) profiles.set(name, prof);
    r.warnings.forEach((w) => {
      if (!characterWarnings.includes(w)) characterWarnings.push(w);
    });
    characterLocks.set(name, text);
    return text;
  };
  const locationLocks = /* @__PURE__ */ new Map();
  const locationLockFor = (location, timeOfDay) => {
    const key = `${location}|${timeOfDay}`;
    if (!locationLocks.has(key)) {
      const lockedHere = continuityLock?.location && continuityLock.location === location;
      const ll = {
        location,
        timeOfDay,
        lighting: lightingForTime(timeOfDay, lockedHere ? continuityLock?.lighting || "" : locationLocks.size === 0 ? continuityLock?.lighting || "" : "")
      };
      if (lockedHere && String(continuityLock?.locationVisualDetails || "").trim()) ll.setDetails = String(continuityLock.locationVisualDetails).trim();
      if (lockedHere && String(continuityLock?.props || "").trim()) ll.props = String(continuityLock.props).trim();
      locationLocks.set(key, ll);
    }
    return locationLocks.get(key);
  };
  return { lockFor, locationLockFor, characterLocks, locationLocks, profiles, characterWarnings };
}
function generateEpisodeLocally({
  originalStory,
  episodeNumber = 1,
  targetSceneCount = 5,
  existingScenes = [],
  lastSceneState = null,
  characters = [],
  continuityLock = null,
  clipDurationSeconds = 10
}) {
  const parsedStory = parseStoryStructure(originalStory);
  const hasExplicitEnd = hasExplicitEndingMarker(originalStory);
  const scenesPerEpisode = Math.max(5, Math.min(6, targetSceneCount || 5));
  const allKnownCharacters = [];
  const addChar = (n) => {
    if (!n) return;
    const name = n.trim();
    if (!isPlausibleSpeaker(name) || isOffScreenSpeaker(name) || allKnownCharacters.includes(name)) return;
    allKnownCharacters.push(name);
  };
  parsedStory.characters.forEach((c) => addChar(c.name));
  (characters || []).forEach((c) => {
    if (c?.name && originalStory.includes(String(c.name).split(" ")[0])) addChar(c.name);
  });
  if (Array.isArray(continuityLock?.characterNames)) continuityLock.characterNames.forEach((n) => {
    if (n && originalStory.includes(n)) addChar(n);
  });
  if (continuityLock?.characterName && originalStory.includes(continuityLock.characterName)) addChar(continuityLock.characterName);
  const pos = continuityLock?.characterPositions || continuityLock?.characterPosition || lastSceneState?.characterPositions || "";
  const metaLocation = parsedStory.metadata["\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48"] || parsedStory.metadata["\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E25\u0E31\u0E01"] || parsedStory.metadata["LOCATION"] || "";
  const metaTime = parsedStory.metadata["\u0E40\u0E27\u0E25\u0E32"] || parsedStory.metadata["\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32"] || parsedStory.metadata["TIME"] || "";
  const storyText = parsedStory.narrativeBeats.map((b) => b.text).join("\n");
  const storyLocation = metaLocation || continuityLock?.location || extractLocationFromText(storyText) || "";
  const storyTime = metaTime || continuityLock?.timeOfDay || detectTimeOfDay(storyText) || "";
  const allUnits = splitStoryIntoSceneUnits(parsedStory, scenesPerEpisode);
  const lastNum = Number(lastSceneState?.sceneNumber) || 0;
  const startIndex = lastNum > 0 ? lastNum : existingScenes.length > 0 ? existingScenes.length : (Math.max(1, episodeNumber) - 1) * scenesPerEpisode;
  const episodeUnits = allUnits.slice(startIndex, startIndex + scenesPerEpisode);
  const hasMoreScenes = startIndex + episodeUnits.length < allUnits.length;
  const scenes = [];
  const introduced = /* @__PURE__ */ new Set();
  let prevEnd = lastSceneState?.endAction || "";
  const locks = buildStoryLocks({ parsedStory, libraryCharacters: characters, continuityLock, storyText: originalStory });
  const initialPoses = normalizePoseList(lastSceneState?.endPoses).length > 0 ? normalizePoseList(lastSceneState?.endPoses) : normalizePoseList(continuityLock?.characterPositionLocks);
  const continuity = analyzeClipContinuity({
    lockedCharacters: allKnownCharacters,
    initialPoses,
    clips: episodeUnits.map((u) => ({
      text: [...u.actionBeats].join(" ") || u.actionText,
      speakers: u.dialogues.filter((d) => !d.offScreen).map((d) => d.speaker),
      location: u.location || storyLocation || ""
    }))
  });
  episodeUnits.forEach((unit, s) => {
    const scNum = startIndex + s + 1;
    const location = unit.location || storyLocation || extractLocationFromText(unit.actionText) || UNSPECIFIED;
    const timeOfDay = unit.timeOfDay || storyTime || detectTimeOfDay(unit.actionText) || UNSPECIFIED;
    const sceneHeading = `\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${scNum}: ${location} - ${timeOfDay}${unit.title ? ` (${unit.title})` : ""}`;
    const cont = continuity.clips[s];
    const locationLock = locks.locationLockFor(location, timeOfDay);
    const cleanAction = unit.actionText.replace(ENDING_MARKER_GLOBAL, "").trim();
    const dialogues = unit.dialogues.map((d) => ({
      speaker: d.speaker,
      emotionOrAction: d.emotionOrAction || "",
      dialogue: d.dialogue,
      ...d.offScreen ? { offScreen: true } : {}
    }));
    const sceneText = cleanAction + " " + dialogues.map((d) => d.speaker + " " + d.dialogue).join(" ");
    const mentioned = allKnownCharacters.filter((n) => sceneText.includes(n)).sort((a, b) => sceneText.indexOf(a) - sceneText.indexOf(b));
    mentioned.forEach((n) => introduced.add(n));
    const sceneActiveChars = Array.from(/* @__PURE__ */ new Set([
      ...mentioned,
      ...cont ? cont.charactersPresent : allKnownCharacters.filter((n) => introduced.has(n) && !mentioned.includes(n))
    ]));
    const characterLocks = sceneActiveChars.map((n) => ({ name: n, lock: locks.lockFor(n) }));
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
      actionBeats: unit.actionBeats.map((a) => a.replace(ENDING_MARKER_GLOBAL, "").trim())
    });
    prevEnd = endState;
    const actionDescription = `[\u0E0A\u0E47\u0E2D\u0E15\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27\u0E1B\u0E23\u0E30\u0E21\u0E32\u0E13 ${clipDurationSeconds} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35] ${cleanAction}${pos ? ` (\u0E25\u0E47\u0E2D\u0E04\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07: ${pos})` : ""}`;
    const charLockPart = characterLocks.length > 0 ? ` Character Lock: ${characterLocks.map((c) => c.lock).join(" | ")} \u2014 identical face, hair and outfit in every clip.` : "";
    const locationLockPart = location !== UNSPECIFIED ? ` ${formatLocationLock(locationLock)}.` : "";
    const posePart = cont ? ` Continuity Handoff: ${formatContinuityForPrompt(cont, scNum === 1 && !lastSceneState && initialPoses.length === 0)}.` : "";
    const sceneWarnings = sceneWarningsFor(continuity.warnings, s + 1, scNum);
    const diagPart = dialogues.length > 0 ? " Dialogue: " + dialogues.map((d) => `${d.speaker}${d.offScreen ? " (off-screen voice)" : ""} speaks: "${d.dialogue}"`).join("; ") + "." : "";
    const visualPrompt = "Cinematic 8K masterpiece" + (sceneActiveChars.length ? ", " + sceneActiveChars.join(" and ") : "") + (location !== UNSPECIFIED ? " at " + location : "") + (timeOfDay !== UNSPECIFIED ? ", " + timeOfDay : "") + ", 35mm lens, photorealistic film still." + charLockPart + locationLockPart + (pos ? ` Spatial Position Lock: ${pos}.` : "") + ` Scene Action: ${cleanAction}.` + diagPart + ` Continuity Flow: Starting moment: ${startAction}. Ending momentum: ${endState}.` + posePart;
    let scriptFormattedText = sceneHeading + "\n";
    if (pos) scriptFormattedText += `(\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E43\u0E19\u0E09\u0E32\u0E01: ${pos})
`;
    scriptFormattedText += `(\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19: ${startAction})
(\u0E01\u0E32\u0E23\u0E01\u0E23\u0E30\u0E17\u0E33: ${actionDescription})
`;
    dialogues.forEach((d) => {
      scriptFormattedText += `${d.speaker}${d.emotionOrAction ? " " + d.emotionOrAction : ""}: "${d.dialogue}"
`;
    });
    scriptFormattedText += `(\u0E2A\u0E34\u0E49\u0E19\u0E2A\u0E38\u0E14\u0E09\u0E32\u0E01: ${endState})
`;
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
      sceneTitle: unit.title || "",
      characterLocks,
      locationLock,
      startPoses: cont?.startPoses || [],
      endPoses: cont?.endPoses || [],
      continuityWarnings: sceneWarnings
    });
  });
  const episodeTitle = scenes.length > 0 ? `\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 ${episodeNumber}: \u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${scenes[0].sceneNumber}-${scenes[scenes.length - 1].sceneNumber} (\u0E42\u0E2B\u0E21\u0E14\u0E2D\u0E2D\u0E1F\u0E44\u0E25\u0E19\u0E4C)` : `\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 ${episodeNumber}`;
  const episodeScriptText = scenes.length > 0 ? `[${episodeTitle}]

` + scenes.map((s) => s.scriptFormattedText).join("\n\n") : "";
  const isFinished = !hasMoreScenes && hasExplicitEnd && scenes.length > 0;
  const done = startIndex + episodeUnits.length;
  const progressPercentage = allUnits.length > 0 ? Math.min(100, Math.round(done / allUnits.length * 100)) : 0;
  return {
    isStoryFinished: isFinished,
    finishMessage: isFinished ? "\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E08\u0E1A\u0E41\u0E25\u0E49\u0E27 (\u0E08\u0E1A\u0E1A\u0E23\u0E34\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E15\u0E32\u0E21\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A)" : !hasMoreScenes ? "\u0E43\u0E0A\u0E49\u0E09\u0E32\u0E01\u0E08\u0E32\u0E01\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A\u0E04\u0E23\u0E1A\u0E41\u0E25\u0E49\u0E27 (\u0E44\u0E21\u0E48\u0E21\u0E35\u0E09\u0E32\u0E01\u0E43\u0E2B\u0E21\u0E48\u0E43\u0E2B\u0E49\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E19\u0E42\u0E2B\u0E21\u0E14\u0E2D\u0E2D\u0E1F\u0E44\u0E25\u0E19\u0E4C)" : "",
    hasMoreScenes,
    totalSourceScenes: allUnits.length,
    episodeNumber,
    episodeTitle,
    progressPercentage,
    currentMilestone: scenes.length > 0 ? `${episodeTitle} (\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${scenes[0].sceneNumber} - ${scenes[scenes.length - 1].sceneNumber} \u0E08\u0E32\u0E01 ${allUnits.length})` : "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E09\u0E32\u0E01\u0E43\u0E2B\u0E21\u0E48\u0E08\u0E32\u0E01\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A",
    summaryOfEventsSoFar: `\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E16\u0E36\u0E07\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${done} \u0E08\u0E32\u0E01\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 ${allUnits.length} \u0E09\u0E32\u0E01\u0E43\u0E19\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A`,
    episodeScriptText,
    scenes,
    nextScene: scenes[0] || null,
    declaredCharacters: parsedStory.characters.filter((c) => c.declared).map((c) => c.name),
    offScreenSpeakers: parsedStory.offScreenSpeakers,
    continuityWarnings: scenes.flatMap((sc) => sc.continuityWarnings || []),
    /** Character Lock warnings, e.g. "ยังไม่ได้ระบุรูปลักษณ์ของ X" */
    characterWarnings: [...locks.characterWarnings],
    /** Position Lock after the last scene of this episode (use as the next episode's start) */
    characterPositionLocks: scenes.length > 0 ? scenes[scenes.length - 1].endPoses : initialPoses
  };
}
function validateGeminiEpisodeScenes(parsed, startSceneNum, declaredNames = []) {
  const errors = [];
  if (!parsed || typeof parsed !== "object") return { ok: false, errors: ["response is not a JSON object"], scenes: [] };
  if (!Array.isArray(parsed.scenes) || parsed.scenes.length === 0) return { ok: false, errors: ['"scenes" array is missing or empty'], scenes: [] };
  const str = (v) => typeof v === "string" ? v.trim() : "";
  const scenes = parsed.scenes.map((sc, idx) => {
    const n = idx + 1;
    if (!sc || typeof sc !== "object") {
      errors.push(`scene ${n}: not an object`);
      return null;
    }
    const required = ["sceneHeading", "actionDescription", "startAction", "endState", "visualPrompt"];
    required.forEach((f) => {
      if (!str(sc[f])) errors.push(`scene ${n}: missing "${f}"`);
    });
    const dialogues = Array.isArray(sc.dialogues) ? sc.dialogues : [];
    const cleanDialogues = dialogues.filter((d) => d && str(d.speaker) && str(d.dialogue)).map((d) => {
      const speaker = normalizeSpeakerName(str(d.speaker), declaredNames);
      const off = isOffScreenSpeaker(speaker);
      return { speaker, emotionOrAction: str(d.emotionOrAction), dialogue: str(d.dialogue), ...off ? { offScreen: true } : {} };
    }).filter((d) => d.speaker && !isReservedSystemKeyword(d.speaker));
    if (dialogues.length !== cleanDialogues.length) errors.push(`scene ${n}: ${dialogues.length - cleanDialogues.length} dialogue(s) missing speaker/dialogue or using reserved keywords`);
    const chars = (Array.isArray(sc.characters) ? sc.characters : []).map((c) => normalizeSpeakerName(str(c), declaredNames)).filter((c) => c && !isOffScreenSpeaker(c) && !isReservedSystemKeyword(c));
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
function applyEpisodeLocks(scenes, params) {
  const parsedStory = parseStoryStructure(params.originalStory || "");
  const locks = buildStoryLocks({ parsedStory, libraryCharacters: params.characters, continuityLock: params.continuityLock, storyText: params.originalStory });
  let prevLoc = String(params.lastSceneState?.location || "").trim();
  let prevTime = String(params.lastSceneState?.timeOfDay || "").trim();
  const fixed = (scenes || []).map((sc) => {
    let location = String(sc.location || "").trim();
    let timeOfDay = String(sc.timeOfDay || "").trim();
    const cont = CONTINUATION_SUFFIX_REGEX.test(location);
    if (cont) location = location.replace(CONTINUATION_SUFFIX_REGEX, "").trim();
    const unspecified = !location || location === UNSPECIFIED;
    let sceneTitle = sc.sceneTitle || "";
    if ((unspecified || isMoodLike(location) && !isLocationLike(location)) && prevLoc) {
      if (!unspecified) sceneTitle = sceneTitle || location;
      location = prevLoc;
      if (!timeOfDay || timeOfDay === UNSPECIFIED) timeOfDay = prevTime;
    }
    if ((!timeOfDay || timeOfDay === UNSPECIFIED) && location === prevLoc && prevTime) timeOfDay = prevTime;
    if (location && location !== UNSPECIFIED) prevLoc = location;
    if (timeOfDay && timeOfDay !== UNSPECIFIED) prevTime = timeOfDay;
    return { ...sc, location: location || UNSPECIFIED, timeOfDay: timeOfDay || UNSPECIFIED, sceneTitle };
  });
  const prevEndAction = String(params.lastSceneState?.endAction || params.lastSceneState?.endState || "").trim();
  if (fixed.length > 0 && prevEndAction && !String(fixed[0].startAction || "").trim()) fixed[0] = { ...fixed[0], startAction: prevEndAction };
  const storyWarnings = checkStoryRepeats(fixed, params.existingScenes || []);
  const known = Array.from(/* @__PURE__ */ new Set([
    ...params.declaredNames || [],
    ...parsedStory.characters.map((c) => c.name),
    ...fixed.flatMap((sc) => sc.characters || [])
  ])).filter((n) => n && !isOffScreenSpeaker(n));
  const initialPoses = normalizePoseList(params.lastSceneState?.endPoses).length > 0 ? normalizePoseList(params.lastSceneState?.endPoses) : normalizePoseList(params.continuityLock?.characterPositionLocks);
  const continuity = analyzeClipContinuity({
    lockedCharacters: known,
    initialPoses,
    clips: fixed.map((sc) => ({
      text: String(sc.actionDescription || "").replace(/^\[[^\]]*\]\s*/, ""),
      speakers: (sc.dialogues || []).filter((d) => !d.offScreen).map((d) => d.speaker),
      location: sc.location && sc.location !== UNSPECIFIED ? sc.location : ""
    }))
  });
  const warnings = [];
  const out = fixed.map((sc, i) => {
    const cont = continuity.clips[i];
    const present = Array.from(/* @__PURE__ */ new Set([...sc.characters || [], ...cont?.charactersPresent || []])).filter((n) => n && !isOffScreenSpeaker(n));
    const characterLocks = present.map((n) => ({ name: n, lock: locks.lockFor(n) }));
    const locationLock = locks.locationLockFor(sc.location, sc.timeOfDay === UNSPECIFIED ? "" : sc.timeOfDay);
    const sceneWarnings = sceneWarningsFor(continuity.warnings, i + 1, sc.sceneNumber);
    warnings.push(...sceneWarnings);
    const lockBlock = [
      characterLocks.length ? `Character Lock: ${characterLocks.map((c) => c.lock).join(" | ")} \u2014 identical face, hair and outfit in every clip.` : "",
      sc.location !== UNSPECIFIED ? `${formatLocationLock(locationLock)}.` : "",
      cont ? `Continuity Handoff: ${formatContinuityForPrompt(cont, i === 0 && !params.lastSceneState && initialPoses.length === 0)}.` : ""
    ].filter(Boolean).join(" ");
    return {
      ...sc,
      characters: present,
      characterLocks,
      locationLock,
      startPoses: cont?.startPoses || [],
      endPoses: cont?.endPoses || [],
      continuityWarnings: sceneWarnings,
      visualPrompt: `${String(sc.visualPrompt || "").trim()} ${lockBlock}`.trim()
    };
  });
  warnings.push(...storyWarnings);
  const outWithStory = storyWarnings.length === 0 ? out : out.map((sc) => {
    const sw = storyWarnings.filter((w) => w.clipNumber === (Number(sc.sceneNumber) || 0));
    return sw.length ? { ...sc, continuityWarnings: [...sc.continuityWarnings || [], ...sw] } : sc;
  });
  return { scenes: outWithStory, warnings, characterWarnings: [...locks.characterWarnings] };
}

// src/services/localScriptParser.ts
function parseScriptLocally(scriptText, requestedClipCount, suppliedCharacters = []) {
  const parsed = parseSalaScript(scriptText, { defaultClipCount: requestedClipCount });
  const rawClips = parsed.clips;
  const declaredChars = parsed.metadata.declaredCharacters;
  const characterNames = parsed.detectedCharacters.filter((name) => !isReservedSystemKeyword(name) && !isMetadataKeyword(name));
  const baseNames = characterNames.length > 0 ? characterNames : declaredChars.map((c) => c.name);
  const scriptDeclared = mergeDeclaredCharacters(declaredChars, scriptText);
  const resolvedChars = resolveCharacterProfiles(baseNames, suppliedCharacters || [], scriptDeclared);
  const characters = resolvedChars.profiles.map((p, idx) => {
    const found = declaredChars.find((c) => c.name.toLowerCase() === p.name.toLowerCase());
    return {
      name: p.name,
      description: found?.description || p.personality || "",
      role: idx === 0 ? "\u0E1A\u0E17\u0E19\u0E33" : "\u0E1A\u0E17\u0E2A\u0E21\u0E17\u0E1A",
      appearance: p.hasAppearance ? formatCharacterAppearanceLock(p).replace(/^[^(]*\(|\)$/g, "") : "",
      face: p.face,
      hairstyle: p.hair,
      outfit: p.outfit,
      personality: p.personality,
      appearanceSource: p.source,
      lockText: formatCharacterAppearanceLock(p)
    };
  });
  const characterWarnings = resolvedChars.warnings;
  const dialogues = [];
  let diagCount = 1;
  rawClips.forEach((c) => {
    c.dialogues.forEach((d) => {
      if (d.speaker && !isReservedSystemKeyword(d.speaker) && !isMetadataKeyword(d.speaker)) {
        dialogues.push({
          id: `diag_server_${diagCount++}`,
          speaker: d.speaker,
          line: d.line,
          emotionTone: d.emotionTone || "\u0E15\u0E32\u0E21\u0E1A\u0E17\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A",
          sceneNumber: c.clipNumber
        });
      }
    });
  });
  const lockMeta = parsed.metadata.lockDirectives;
  const detectedLocation = parsed.metadata.location || lockMeta["location"] || "";
  const detectedTime = parsed.metadata.timeOfDay || lockMeta["time"] || "";
  const detectedLighting = parsed.metadata.lighting || lockMeta["lighting"] || "";
  const detectedStyle = parsed.metadata.style || lockMeta["style"] || "Cinematic Photorealistic 8K";
  const detectedProps = parsed.metadata.props || lockMeta["props"] || "";
  const detectedTitle = parsed.metadata.title || rawClips[0]?.title || "\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23";
  const storyParsed = parseStoryStructure(scriptText);
  const storyScenes = storyParsed.hasSceneHeaders && storyParsed.scenes.length === rawClips.length ? storyParsed.scenes : [];
  const firstLoc = storyScenes.find((sc) => sc.location)?.location || "";
  const firstTime = storyScenes.find((sc) => sc.timeOfDay)?.timeOfDay || "";
  const mainLocation = detectedLocation || firstLoc;
  const mainTime = detectedTime || firstTime;
  const mainLighting = detectedLighting || (mainTime ? lightingForTime(mainTime) : "");
  const introducedSoFar = /* @__PURE__ */ new Set();
  const scenes = rawClips.map((c, idx) => {
    const ss = storyScenes[idx];
    const sceneLocation = ss?.location || mainLocation;
    const sceneTime = ss?.timeOfDay || mainTime;
    const sceneLighting = sceneLocation === mainLocation && sceneTime === mainTime ? mainLighting : detectedLighting || lightingForTime(sceneTime);
    const cleanTitle = (c.title || `\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${c.clipNumber}`).replace(/^(ฉากที่\s*\d+)\s*[:：]?\s*[—–\-:]\s*/, "$1: ");
    const sceneBody = c.actions.join(" ");
    const sceneDialogues = dialogues.filter((d) => d.sceneNumber === c.clipNumber);
    const diagSummary = sceneDialogues.map((d) => `${d.speaker}: "${d.line}"`).join(" ");
    const sceneFullText = `${c.title} ${sceneBody} ${diagSummary}`;
    const sceneCharNames = characters.filter((char) => {
      const firstName = char.name.split(" ")[0];
      return sceneFullText.includes(char.name) || firstName.length >= 2 && sceneFullText.includes(firstName) || sceneDialogues.some((d) => d.speaker === char.name || d.line.includes(char.name));
    }).map((char) => char.name);
    sceneCharNames.forEach((name) => introducedSoFar.add(name));
    const charList = sceneCharNames.length > 0 ? sceneCharNames : Array.from(introducedSoFar);
    const promptParts = [detectedStyle];
    if (charList.length > 0) promptParts.push(`Character Lock: ${charList.map((n) => characters.find((x) => x.name === n)?.lockText || n).join(" | ")}`);
    if (sceneLocation) promptParts.push(`Location Lock: ${sceneLocation}`);
    if (sceneTime) promptParts.push(`Time: ${sceneTime}`);
    if (sceneLighting) promptParts.push(`Lighting Lock: ${sceneLighting}`);
    if (sceneBody) promptParts.push(`Scene Action: ${sceneBody}`);
    if (diagSummary) promptParts.push(`Dialogue: ${diagSummary}`);
    if (c.endState) promptParts.push(`Ending momentum: ${c.endState}`);
    return {
      sceneNumber: c.clipNumber,
      title: cleanTitle,
      location: sceneLocation,
      timeOfDay: sceneTime,
      lighting: sceneLighting,
      camera: c.cameraDirectives[0] || "Cinematic tracking shot, 35mm prime, Medium Shot",
      characters: charList,
      action: sceneBody || `\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E43\u0E19\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${c.clipNumber}`,
      dialogue: diagSummary,
      prompt: promptParts.join(", ")
    };
  });
  const mainChar = characters[0]?.name || "";
  return {
    title: detectedTitle,
    characters,
    dialogues,
    locations: Array.from(new Set(scenes.map((sc) => sc.location).filter(Boolean))).map((name, i) => ({
      name,
      description: i === 0 ? "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E25\u0E31\u0E01\u0E02\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E16\u0E48\u0E32\u0E22\u0E17\u0E33" : "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E43\u0E19\u0E1A\u0E17",
      atmosphere: scenes.find((sc) => sc.location === name)?.timeOfDay || ""
    })),
    scenes,
    lighting: mainLighting,
    camera: {
      movement: "Cinematic tracking shot smoothly gliding alongside character",
      lensType: "35mm Anamorphic Prime f/1.8",
      shotType: "Medium Shot"
    },
    characterWarnings,
    continuityLock: {
      characterName: mainChar,
      characterAppearance: characters[0]?.appearance || "",
      location: mainLocation,
      timeOfDay: mainTime,
      lighting: mainLighting,
      visualStyle: detectedStyle,
      cameraMovement: "Cinematic tracking shot smoothly gliding alongside character",
      cameraShotType: "Medium Shot",
      lensType: "35mm Anamorphic Prime f/1.8",
      props: detectedProps
    },
    source: "fallback-parser"
  };
}
function applySplitLocks(data, continuityLock, opts = {}) {
  const lock = continuityLock || {};
  if (!data || typeof data !== "object") return data;
  const isEmpty = (v) => !v || typeof v === "string" && (!v.trim() || v.includes("\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38"));
  const locationOverrides = /* @__PURE__ */ new Map();
  const lightingOverrides = /* @__PURE__ */ new Map();
  if (Array.isArray(data.scenes)) {
    let prevLoc = "";
    let prevTime = "";
    data.scenes = data.scenes.map((s, sIdx) => {
      const next = { ...s };
      const norm = normalizeSceneLocation(next.location || "");
      next.location = norm.location;
      if ((norm.isTitle || isEmpty(next.location)) && prevLoc) {
        next.location = prevLoc;
        if (isEmpty(next.timeOfDay)) next.timeOfDay = prevTime;
      }
      if (norm.continued && isEmpty(next.timeOfDay)) next.timeOfDay = prevTime;
      if (!isEmpty(next.location)) prevLoc = next.location;
      if (!isEmpty(next.timeOfDay)) prevTime = next.timeOfDay;
      if (lock.location && !isEmpty(next.location) && !norm.isTitle && next.location !== lock.location && !next.location.includes(lock.location) && !lock.location.includes(next.location)) {
        locationOverrides.set(sIdx, next.location);
      }
      if (lock.location) next.location = lock.location;
      const timeChanged = !!lock.timeOfDay && !isEmpty(next.timeOfDay) && next.timeOfDay !== lock.timeOfDay;
      if (lock.timeOfDay) next.timeOfDay = lock.timeOfDay;
      if (lock.lighting) next.lighting = lock.lighting;
      else if (timeChanged) {
        next.lighting = lightingForTime(lock.timeOfDay);
        lightingOverrides.set(sIdx, next.lighting);
      } else if (isEmpty(next.lighting) && data.lighting) next.lighting = data.lighting;
      const lockedNames = [lock.characterName, ...lock.characterNames || []].filter(Boolean);
      if (lockedNames.length > 0 && Array.isArray(next.characters)) {
        next.characters = next.characters.map((n) => lockedNames.find((l) => l === n || l.includes(n) || n.includes(l)) || n);
      }
      return next;
    });
  }
  if (Array.isArray(data.scenes) && data.scenes.length > 0) {
    const scriptDeclared = mergeDeclaredCharacters(Array.isArray(data.characters) ? data.characters : [], opts.scriptText || "");
    const supplied = [
      ...Array.isArray(opts.characters) ? opts.characters : [],
      ...continuityLockCharacter(lock)
    ];
    const allNames = Array.from(new Set(data.scenes.flatMap((sc) => Array.isArray(sc.characters) ? sc.characters : []).filter(Boolean)));
    const resolved = resolveCharacterProfiles(allNames, supplied, scriptDeclared);
    const lockOf = (n) => {
      const p = resolved.profiles.find((x) => x.name === n);
      return p ? formatCharacterAppearanceLock(p) : n;
    };
    const initialPoses = normalizePoseList(lock.characterPositionLocks);
    const lockedNames = Array.from(new Set([...allNames, lock.characterName, ...lock.characterNames || []].filter(Boolean)));
    const speakersOf = (sc) => (Array.isArray(data.dialogues) ? data.dialogues : []).filter((d) => Number(d.sceneNumber) === Number(sc.sceneNumber)).map((d) => d.speaker);
    const analysis = analyzeClipContinuity({
      lockedCharacters: lockedNames,
      initialPoses,
      clips: data.scenes.map((sc) => ({ text: String(sc.action || ""), speakers: speakersOf(sc), location: sc.location || "" }))
    });
    data.scenes = data.scenes.map((sc, i) => {
      const names = Array.isArray(sc.characters) ? sc.characters : [];
      const cont = analysis.clips[i];
      const charLock = names.length > 0 ? `Character Lock: ${names.map(lockOf).join(" | ")}` : "";
      let prompt = String(sc.prompt || "");
      if (charLock) prompt = /Character Lock:[^,]*(?:,|$)/.test(prompt) && !prompt.includes(charLock) ? prompt.replace(/Character Lock:.*?(?=, (?:Location Lock|Time|Lighting Lock|Scene Action|Dialogue|Ending momentum):|$)/, charLock) : prompt.includes(charLock) ? prompt : `${prompt}${prompt ? ", " : ""}${charLock}`;
      prompt = syncLocationLockInPrompt(prompt, lightingOverrides.has(i) ? { ...lock, lighting: lightingOverrides.get(i) } : lock);
      const posBlock = cont ? formatContinuityForPrompt(cont, i === 0 && initialPoses.length === 0) : "";
      if (posBlock && !prompt.includes("Position Lock:")) prompt = `${prompt}${prompt ? ". " : ""}Continuity Handoff: ${posBlock}.`;
      const sceneWarnings = sceneWarningsFor(analysis.warnings, i + 1, sc.sceneNumber || i + 1);
      if (locationOverrides.has(i)) {
        const sn = sc.sceneNumber || i + 1;
        sceneWarnings.push({ clipNumber: sn, type: "location_mismatch", character: "", message: `\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${sn}: \u0E1A\u0E17\u0E23\u0E30\u0E1A\u0E38\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48 "${locationOverrides.get(i)}" \u0E41\u0E15\u0E48\u0E25\u0E47\u0E2D\u0E04\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E44\u0E27\u0E49 "${lock.location}" \u2014 \u0E43\u0E0A\u0E49\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E17\u0E35\u0E48\u0E25\u0E47\u0E2D\u0E04 / location lock override` });
      }
      return {
        ...sc,
        prompt,
        characterLocks: names.map((n) => ({ name: n, lock: lockOf(n) })),
        startPoses: cont?.startPoses || [],
        endPoses: cont?.endPoses || [],
        continuityWarnings: sceneWarnings
      };
    });
    data.characterWarnings = Array.from(/* @__PURE__ */ new Set([...data.characterWarnings || [], ...resolved.warnings]));
    data.continuityWarnings = data.scenes.flatMap((sc) => sc.continuityWarnings || []);
    data.warnings = [...data.characterWarnings, ...data.continuityWarnings.map((w) => w.message)];
    data.characterPositionLocks = data.scenes[data.scenes.length - 1].endPoses;
  }
  data.continuityLock = { ...data.continuityLock || {} };
  for (const k of ["characterName", "characterAppearance", "location", "timeOfDay", "lighting", "props", "characterPosition", "characterPositionLocks"]) {
    if (lock[k]) data.continuityLock[k] = lock[k];
  }
  if (!lock.characterName && (isReservedSystemKeyword(data.continuityLock.characterName) || isMetadataKeyword(data.continuityLock.characterName))) {
    data.continuityLock.characterName = data.characters?.[0]?.name || "";
  }
  return data;
}

// serverAuth.ts
var import_crypto = __toESM(require("crypto"), 1);
var import_jose = require("jose");
var FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
var remoteJwks = null;
function getRemoteJwks() {
  if (!remoteJwks) remoteJwks = (0, import_jose.createRemoteJWKSet)(new URL(FIREBASE_JWKS_URL), { cooldownDuration: 3e4, cacheMaxAge: 6 * 36e5 });
  return remoteJwks;
}
async function verifyFirebaseIdToken(token, projectId, keySet) {
  if (!token || !projectId || token.split(".").length !== 3) return null;
  try {
    const { payload } = await (0, import_jose.jwtVerify)(token, keySet || getRemoteJwks(), {
      algorithms: ["RS256"],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      clockTolerance: 60
    });
    const uid = typeof payload.sub === "string" ? payload.sub : "";
    if (!uid || uid.length > 128) return null;
    if (typeof payload.exp !== "number") return null;
    const authTime = payload.auth_time;
    if (typeof authTime === "number" && authTime > Math.floor(Date.now() / 1e3) + 60) return null;
    return {
      uid,
      email: typeof payload.email === "string" ? payload.email : void 0,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === "string" ? payload.name : void 0,
      picture: typeof payload.picture === "string" ? payload.picture : void 0,
      exp: payload.exp
    };
  } catch {
    return null;
  }
}
var b64url = (b) => Buffer.from(b).toString("base64url");
function sign(data, secret) {
  return import_crypto.default.createHmac("sha256", secret).update(data).digest("base64url");
}
function createSessionToken(userId, secret, ttlSeconds = 7 * 24 * 3600) {
  const exp = Math.floor(Date.now() / 1e3) + ttlSeconds;
  const nonce = import_crypto.default.randomBytes(12).toString("base64url");
  const body = `sala.${b64url(userId)}.${exp}.${nonce}`;
  return `${body}.${sign(body, secret)}`;
}
function verifySessionToken(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 5 || parts[0] !== "sala") return null;
  const body = parts.slice(0, 4).join(".");
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(parts[4]);
  if (expected.length !== given.length || !import_crypto.default.timingSafeEqual(expected, given)) return null;
  const exp = Number(parts[2]);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1e3)) return null;
  let userId = "";
  try {
    userId = Buffer.from(parts[1], "base64url").toString("utf8");
  } catch {
    return null;
  }
  return userId ? { userId, exp } : null;
}
function isAdminIdentity(claims, adminEmails) {
  if (!claims || !claims.emailVerified || !claims.email) return false;
  const email = claims.email.trim().toLowerCase();
  return adminEmails.map((e) => e.trim().toLowerCase()).filter(Boolean).includes(email);
}
function parseAdminEmails(raw, fallback) {
  const list = String(raw || "").split(/[,\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.length > 0 ? list : fallback.map((e) => e.toLowerCase());
}

// server.ts
import_dotenv.default.config();
if (!process.env.GEMINI_API_KEY && process.env["GEMINI_API KEY"]) {
  process.env.GEMINI_API_KEY = process.env["GEMINI_API KEY"];
} else if (process.env.GEMINI_API_KEY && !process.env["GEMINI_API KEY"]) {
  process.env["GEMINI_API KEY"] = process.env.GEMINI_API_KEY;
}
var app = (0, import_express.default)();
var PORT = Number(process.env.PORT) || 3e3;
app.use(import_express.default.json({
  limit: "50mb",
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(import_express.default.urlencoded({ extended: true, limit: "50mb" }));
var UPLOADS_DIR = import_path.default.join(process.cwd(), "public", "uploads");
var UPLOADS_CHARACTERS_DIR = import_path.default.join(UPLOADS_DIR, "characters");
var UPLOADS_LOCATIONS_DIR = import_path.default.join(UPLOADS_DIR, "locations");
try {
  if (!import_fs.default.existsSync(UPLOADS_CHARACTERS_DIR)) {
    import_fs.default.mkdirSync(UPLOADS_CHARACTERS_DIR, { recursive: true });
  }
  if (!import_fs.default.existsSync(UPLOADS_LOCATIONS_DIR)) {
    import_fs.default.mkdirSync(UPLOADS_LOCATIONS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create uploads directory:", e);
}
app.use("/uploads", import_express.default.static(UPLOADS_DIR, {
  maxAge: "7d",
  immutable: true
}));
var jobsStore = /* @__PURE__ */ new Map();
var SAMPLE_IMAGE_OUTPUTS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1080&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1080&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1080&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=1080&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1080&q=80",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1080&q=80",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1080&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1080&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1080&q=80"
];
var SAMPLE_VIDEO_OUTPUTS = [
  "/sample-videos/sala_sample_1.mp4",
  "/sample-videos/sala_sample_2.mp4",
  "/sample-videos/sala_sample_3.mp4"
];
var charactersStore = [
  {
    id: "char_fahsai_01",
    name: "\u0E1F\u0E49\u0E32\u0E43\u0E2A (Fahsai)",
    gender: "\u0E2B\u0E0D\u0E34\u0E07",
    age: "24 \u0E1B\u0E35",
    description: "\u0E2A\u0E32\u0E27\u0E44\u0E17\u0E22\u0E2B\u0E19\u0E49\u0E32\u0E04\u0E21 \u0E2A\u0E14\u0E43\u0E2A \u0E14\u0E27\u0E07\u0E15\u0E32\u0E01\u0E25\u0E21\u0E42\u0E15 \u0E1C\u0E21\u0E22\u0E32\u0E27\u0E1B\u0E23\u0E30\u0E1A\u0E48\u0E32\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E40\u0E02\u0E49\u0E21 \u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25\u0E42\u0E21\u0E40\u0E14\u0E34\u0E23\u0E4C\u0E19 \u0E22\u0E34\u0E49\u0E21\u0E41\u0E22\u0E49\u0E21\u0E21\u0E35\u0E40\u0E2A\u0E19\u0E48\u0E2B\u0E4C",
    triggerTag: "(fahsai_modern_thai_girl:1.25)",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
    referenceImages: [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80"
    ],
    outfitDescription: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E1C\u0E49\u0E32\u0E25\u0E34\u0E19\u0E34\u0E19\u0E2A\u0E35\u0E04\u0E23\u0E35\u0E21 \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E41\u0E08\u0E47\u0E04\u0E40\u0E01\u0E47\u0E15\u0E40\u0E14\u0E19\u0E34\u0E21\u0E25\u0E33\u0E25\u0E2D\u0E07 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E1B\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25\u0E40\u0E07\u0E34\u0E19",
    consistencyStrength: 0.85,
    createdAt: new Date(Date.now() - 864e5 * 3).toISOString()
  },
  {
    id: "char_karn_02",
    name: "\u0E01\u0E32\u0E19\u0E15\u0E4C (Karn)",
    gender: "\u0E0A\u0E32\u0E22",
    age: "28 \u0E1B\u0E35",
    description: "\u0E0A\u0E48\u0E32\u0E07\u0E20\u0E32\u0E1E\u0E2B\u0E19\u0E38\u0E48\u0E21\u0E1A\u0E38\u0E04\u0E25\u0E34\u0E01\u0E40\u0E17\u0E48 \u0E2A\u0E38\u0E02\u0E38\u0E21 \u0E17\u0E23\u0E07\u0E1C\u0E21\u0E1B\u0E31\u0E14\u0E02\u0E49\u0E32\u0E07 \u0E1C\u0E34\u0E27\u0E2A\u0E2D\u0E07\u0E2A\u0E35 \u0E21\u0E35\u0E23\u0E2D\u0E22\u0E22\u0E34\u0E49\u0E21\u0E2D\u0E1A\u0E2D\u0E38\u0E48\u0E19 \u0E2A\u0E32\u0E22\u0E15\u0E32\u0E42\u0E1F\u0E01\u0E31\u0E2A \u0E41\u0E27\u0E27\u0E15\u0E32\u0E40\u0E1B\u0E35\u0E48\u0E22\u0E21\u0E41\u0E23\u0E07\u0E1A\u0E31\u0E19\u0E14\u0E32\u0E25\u0E43\u0E08",
    triggerTag: "(karn_cinematic_photographer:1.2)",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
    referenceImages: [
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80"
    ],
    outfitDescription: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E41\u0E08\u0E47\u0E04\u0E40\u0E01\u0E47\u0E15\u0E1A\u0E2D\u0E21\u0E40\u0E1A\u0E2D\u0E23\u0E4C\u0E2A\u0E35\u0E40\u0E02\u0E35\u0E22\u0E27\u0E42\u0E2D\u0E25\u0E35\u0E1F \u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E22\u0E37\u0E14\u0E2A\u0E35\u0E14\u0E33 \u0E01\u0E32\u0E07\u0E40\u0E01\u0E07\u0E04\u0E32\u0E23\u0E4C\u0E42\u0E01\u0E49 \u0E2A\u0E30\u0E1E\u0E32\u0E22\u0E01\u0E25\u0E49\u0E2D\u0E07\u0E27\u0E34\u0E19\u0E40\u0E17\u0E08",
    consistencyStrength: 0.9,
    createdAt: new Date(Date.now() - 864e5 * 2).toISOString()
  },
  {
    id: "char_prae_05",
    name: "\u0E41\u0E1E\u0E23 / Prae",
    gender: "\u0E2B\u0E0D\u0E34\u0E07",
    age: "22 \u0E1B\u0E35",
    description: "\u0E2B\u0E0D\u0E34\u0E07\u0E2A\u0E32\u0E27\u0E27\u0E31\u0E22\u0E23\u0E38\u0E48\u0E19\u0E44\u0E17\u0E22 \u0E14\u0E27\u0E07\u0E15\u0E32\u0E01\u0E25\u0E21\u0E42\u0E15\u0E40\u0E1B\u0E47\u0E19\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22 \u0E23\u0E2D\u0E22\u0E22\u0E34\u0E49\u0E21\u0E2A\u0E14\u0E43\u0E2A\u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E1C\u0E34\u0E27\u0E2A\u0E2D\u0E07\u0E2A\u0E35\u0E40\u0E19\u0E35\u0E22\u0E19\u0E1C\u0E48\u0E2D\u0E07 \u0E1C\u0E21\u0E22\u0E32\u0E27\u0E1B\u0E23\u0E30\u0E1A\u0E48\u0E32\u0E14\u0E31\u0E14\u0E25\u0E2D\u0E19\u0E04\u0E25\u0E37\u0E48\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E40\u0E02\u0E49\u0E21",
    triggerTag: "(prae_consistent_char:1.2)",
    referenceImageId: "ref_prae_master",
    referenceImageUrl: "/uploads/characters/ref_prae_master.jpg",
    imageHash: "38ed715e729e441ce92056fc2d82324d452f0a7dbf8a769fbd98a4e6aba5dace",
    avatarUrl: "/uploads/characters/ref_prae_master.jpg",
    referenceImages: [
      "/uploads/characters/ref_prae_master.jpg"
    ],
    outfitDescription: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E04\u0E2D\u0E1B\u0E01\u0E1C\u0E49\u0E32\u0E1D\u0E49\u0E32\u0E22\u0E2A\u0E35\u0E04\u0E23\u0E35\u0E21\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25 \u0E01\u0E32\u0E07\u0E40\u0E01\u0E07\u0E02\u0E32\u0E22\u0E32\u0E27\u0E1C\u0E49\u0E32\u0E25\u0E34\u0E19\u0E34\u0E19\u0E2A\u0E35\u0E40\u0E1A\u0E08 \u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32\u0E04\u0E31\u0E17\u0E0A\u0E39\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E2D\u0E48\u0E2D\u0E19 \u0E15\u0E48\u0E32\u0E07\u0E2B\u0E39\u0E2B\u0E48\u0E27\u0E07\u0E40\u0E07\u0E34\u0E19\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
    consistencyStrength: 0.95,
    analysisConfidence: 95,
    isVerifiedByUser: true,
    lockStatus: "LOCKED",
    imageAnalysisStatus: "USER_CONFIRMED",
    currentReferenceImageHash: "38ed715e729e441ce92056fc2d82324d452f0a7dbf8a769fbd98a4e6aba5dace",
    visualProfileImageHash: "38ed715e729e441ce92056fc2d82324d452f0a7dbf8a769fbd98a4e6aba5dace",
    identity: {
      id: "char_prae_05",
      name: "\u0E41\u0E1E\u0E23 / Prae"
    },
    characterIdentity: {
      id: "char_prae_05",
      name: "\u0E41\u0E1E\u0E23 / Prae"
    },
    referenceMetadata: {
      referenceImageId: "ref_prae_master",
      imageHash: "38ed715e729e441ce92056fc2d82324d452f0a7dbf8a769fbd98a4e6aba5dace",
      detectedName: "\u0E41\u0E1E\u0E23 / Prae",
      detectedAge: "22",
      detectedHeight: "165 cm",
      availableViews: ["FRONT", "FACE_CLOSEUP"]
    },
    visualProfile: {
      imageHash: "38ed715e729e441ce92056fc2d82324d452f0a7dbf8a769fbd98a4e6aba5dace",
      referenceImageId: "ref_prae_master",
      referenceImageUrl: "/uploads/characters/ref_prae_master.jpg",
      referenceImage: "/uploads/characters/ref_prae_master.jpg",
      referenceImages: ["/uploads/characters/ref_prae_master.jpg"],
      hairStyle: "\u0E1C\u0E21\u0E22\u0E32\u0E27\u0E1B\u0E23\u0E30\u0E1A\u0E48\u0E32\u0E14\u0E31\u0E14\u0E25\u0E2D\u0E19\u0E04\u0E25\u0E37\u0E48\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34",
      hairColor: "\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E40\u0E02\u0E49\u0E21\u0E0A\u0E47\u0E2D\u0E01\u0E42\u0E01\u0E41\u0E25\u0E15",
      top: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E04\u0E2D\u0E1B\u0E01\u0E1C\u0E49\u0E32\u0E1D\u0E49\u0E32\u0E22\u0E2A\u0E35\u0E04\u0E23\u0E35\u0E21\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
      bottom: "\u0E01\u0E32\u0E07\u0E40\u0E01\u0E07\u0E02\u0E32\u0E22\u0E32\u0E27\u0E1C\u0E49\u0E32\u0E25\u0E34\u0E19\u0E34\u0E19\u0E2A\u0E35\u0E40\u0E1A\u0E08",
      shoes: "\u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32\u0E04\u0E31\u0E17\u0E0A\u0E39\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E2D\u0E48\u0E2D\u0E19",
      accessories: "\u0E15\u0E48\u0E32\u0E07\u0E2B\u0E39\u0E2B\u0E48\u0E27\u0E07\u0E40\u0E07\u0E34\u0E19\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
      visibleDistinctiveDetails: "\u0E14\u0E27\u0E07\u0E15\u0E32\u0E01\u0E25\u0E21\u0E42\u0E15\u0E40\u0E1B\u0E47\u0E19\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22 \u0E23\u0E2D\u0E22\u0E22\u0E34\u0E49\u0E21\u0E2A\u0E14\u0E43\u0E2A\u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E1C\u0E34\u0E27\u0E2A\u0E2D\u0E07\u0E2A\u0E35\u0E40\u0E19\u0E35\u0E22\u0E19\u0E1C\u0E48\u0E2D\u0E07",
      imageAnalysisStatus: "USER_CONFIRMED",
      hair: "\u0E1C\u0E21\u0E22\u0E32\u0E27\u0E1B\u0E23\u0E30\u0E1A\u0E48\u0E32\u0E14\u0E31\u0E14\u0E25\u0E2D\u0E19\u0E04\u0E25\u0E37\u0E48\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E40\u0E02\u0E49\u0E21\u0E0A\u0E47\u0E2D\u0E01\u0E42\u0E01\u0E41\u0E25\u0E15",
      visibleOutfit: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E04\u0E2D\u0E1B\u0E01\u0E1C\u0E49\u0E32\u0E1D\u0E49\u0E32\u0E22\u0E2A\u0E35\u0E04\u0E23\u0E35\u0E21\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25 \u0E01\u0E32\u0E07\u0E40\u0E01\u0E07\u0E02\u0E32\u0E22\u0E32\u0E27\u0E1C\u0E49\u0E32\u0E25\u0E34\u0E19\u0E34\u0E19\u0E2A\u0E35\u0E40\u0E1A\u0E08",
      visibleAccessories: "\u0E15\u0E48\u0E32\u0E07\u0E2B\u0E39\u0E2B\u0E48\u0E27\u0E07\u0E40\u0E07\u0E34\u0E19\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
      visiblePhysicalAppearance: "\u0E2B\u0E0D\u0E34\u0E07\u0E2A\u0E32\u0E27\u0E27\u0E31\u0E22\u0E23\u0E38\u0E48\u0E19\u0E44\u0E17\u0E22 \u0E14\u0E27\u0E07\u0E15\u0E32\u0E01\u0E25\u0E21\u0E42\u0E15\u0E40\u0E1B\u0E47\u0E19\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22 \u0E23\u0E2D\u0E22\u0E22\u0E34\u0E49\u0E21\u0E2A\u0E14\u0E43\u0E2A\u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34",
      visibleDistinguishingDetails: "\u0E23\u0E2D\u0E22\u0E22\u0E34\u0E49\u0E21\u0E2A\u0E14\u0E43\u0E2A\u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E1C\u0E34\u0E27\u0E2A\u0E2D\u0E07\u0E2A\u0E35\u0E40\u0E19\u0E35\u0E22\u0E19\u0E1C\u0E48\u0E2D\u0E07",
      detectedViews: ["FRONT", "FACE_CLOSEUP"],
      isMultiViewSheet: false,
      confidence: 95,
      generatedVisualPrompt: "Thai young woman Prae with warm brown wavy hair, cream shirt and beige linen trousers"
    },
    storyProfile: {
      age: "22 \u0E1B\u0E35",
      personality: "\u0E23\u0E48\u0E32\u0E40\u0E23\u0E34\u0E07 \u0E21\u0E2D\u0E07\u0E42\u0E25\u0E01\u0E43\u0E19\u0E41\u0E07\u0E48\u0E14\u0E35 \u0E2D\u0E1A\u0E2D\u0E38\u0E48\u0E19 \u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E21\u0E38\u0E48\u0E07\u0E21\u0E31\u0E48\u0E19\u0E2A\u0E39\u0E07",
      role: "\u0E19\u0E32\u0E07\u0E40\u0E2D\u0E01\u0E0B\u0E35\u0E23\u0E35\u0E2A\u0E4C\u0E42\u0E23\u0E41\u0E21\u0E19\u0E15\u0E34\u0E01\u0E14\u0E23\u0E32\u0E21\u0E48\u0E32",
      occupation: "\u0E19\u0E31\u0E01\u0E2D\u0E2D\u0E01\u0E41\u0E1A\u0E1A\u0E01\u0E23\u0E32\u0E1F\u0E34\u0E01\u0E2D\u0E34\u0E2A\u0E23\u0E30",
      background: "\u0E2A\u0E32\u0E27\u0E19\u0E49\u0E2D\u0E22\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E01\u0E07\u0E32\u0E19\u0E28\u0E34\u0E25\u0E1B\u0E30 \u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07\u0E21\u0E32\u0E15\u0E32\u0E21\u0E2B\u0E32\u0E41\u0E23\u0E07\u0E1A\u0E31\u0E19\u0E14\u0E32\u0E25\u0E43\u0E08\u0E43\u0E2B\u0E21\u0E48\u0E43\u0E19\u0E40\u0E21\u0E37\u0E2D\u0E07\u0E2B\u0E25\u0E27\u0E07"
    },
    structuredFeatures: {
      name: "\u0E41\u0E1E\u0E23 / Prae",
      gender: "\u0E2B\u0E0D\u0E34\u0E07",
      ageRange: "22 \u0E1B\u0E35",
      skinTone: "\u0E1C\u0E34\u0E27\u0E2A\u0E2D\u0E07\u0E2A\u0E35\u0E40\u0E19\u0E35\u0E22\u0E19\u0E1C\u0E48\u0E2D\u0E07",
      faceShape: "\u0E23\u0E39\u0E1B\u0E44\u0E02\u0E48\u0E25\u0E30\u0E21\u0E38\u0E19",
      hairStyle: "\u0E1C\u0E21\u0E22\u0E32\u0E27\u0E1B\u0E23\u0E30\u0E1A\u0E48\u0E32\u0E14\u0E31\u0E14\u0E25\u0E2D\u0E19\u0E04\u0E25\u0E37\u0E48\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34",
      hairColor: "\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E40\u0E02\u0E49\u0E21\u0E0A\u0E47\u0E2D\u0E01\u0E42\u0E01\u0E41\u0E25\u0E15",
      eyeDescription: "\u0E15\u0E32\u0E01\u0E25\u0E21\u0E42\u0E15\u0E2A\u0E14\u0E43\u0E2A\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25",
      bodyType: "\u0E2A\u0E21\u0E2A\u0E48\u0E27\u0E19",
      topClothing: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E04\u0E2D\u0E1B\u0E01\u0E1C\u0E49\u0E32\u0E1D\u0E49\u0E32\u0E22\u0E2A\u0E35\u0E04\u0E23\u0E35\u0E21\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
      bottomClothing: "\u0E01\u0E32\u0E07\u0E40\u0E01\u0E07\u0E02\u0E32\u0E22\u0E32\u0E27\u0E1C\u0E49\u0E32\u0E25\u0E34\u0E19\u0E34\u0E19\u0E2A\u0E35\u0E40\u0E1A\u0E08",
      footwear: "\u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32\u0E04\u0E31\u0E17\u0E0A\u0E39\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E2D\u0E48\u0E2D\u0E19",
      accessories: "\u0E15\u0E48\u0E32\u0E07\u0E2B\u0E39\u0E2B\u0E48\u0E27\u0E07\u0E40\u0E07\u0E34\u0E19\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
      distinctFeatures: "\u0E23\u0E2D\u0E22\u0E22\u0E34\u0E49\u0E21\u0E2A\u0E14\u0E43\u0E2A\u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E1C\u0E34\u0E27\u0E2A\u0E2D\u0E07\u0E2A\u0E35\u0E40\u0E19\u0E35\u0E22\u0E19\u0E1C\u0E48\u0E2D\u0E07",
      confidence: 95
    },
    fieldSources: {
      name: "REFERENCE_TEXT",
      age: "REFERENCE_TEXT",
      hairStyle: "VISUAL_OBSERVATION",
      hairColor: "VISUAL_OBSERVATION",
      top: "VISUAL_OBSERVATION",
      bottom: "VISUAL_OBSERVATION",
      shoes: "VISUAL_OBSERVATION",
      accessories: "VISUAL_OBSERVATION",
      gender: "VISUAL_OBSERVATION"
    },
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var locationsStore = [
  {
    id: "loc_modern_living_01",
    name: "\u0E2B\u0E49\u0E2D\u0E07\u0E19\u0E31\u0E48\u0E07\u0E40\u0E25\u0E48\u0E19\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25\u0E42\u0E21\u0E40\u0E14\u0E34\u0E23\u0E4C\u0E19 (Modern Minimalist Living Room)",
    type: "LOCATION",
    lockStatus: "LOCKED",
    imageAnalysisStatus: "USER_CONFIRMED",
    referenceImageUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80",
    referenceImages: [
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80"
    ],
    referenceImageId: "ref_loc_living_01",
    imageHash: "loc_hash_modern_living_88a91c",
    thumbnailUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80",
    triggerTag: "(location_modern_minimalist_living_room:1.25)",
    identity: {
      id: "loc_modern_living_01",
      name: "\u0E2B\u0E49\u0E2D\u0E07\u0E19\u0E31\u0E48\u0E07\u0E40\u0E25\u0E48\u0E19\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25\u0E42\u0E21\u0E40\u0E14\u0E34\u0E23\u0E4C\u0E19 (Modern Minimalist Living Room)"
    },
    referenceMetadata: {
      referenceImageId: "ref_loc_living_01",
      referenceImageUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80",
      imageHash: "loc_hash_modern_living_88a91c",
      availableViews: ["WIDE_SHOT", "CORNER_PERSPECTIVE", "FURNITURE_LAYOUT"],
      imageAnalysisStatus: "USER_CONFIRMED"
    },
    visualProfile: {
      environmentType: "Indoor (\u0E2B\u0E49\u0E2D\u0E07\u0E19\u0E31\u0E48\u0E07\u0E40\u0E25\u0E48\u0E19\u0E2B\u0E25\u0E31\u0E01)",
      architecturalStyle: "Modern Japandi Minimalist",
      wallColor: "\u0E1C\u0E19\u0E31\u0E07\u0E09\u0E32\u0E1A\u0E1B\u0E39\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E2A\u0E35\u0E40\u0E1A\u0E08\u0E2D\u0E48\u0E2D\u0E19 (Warm off-white) \u0E41\u0E25\u0E30\u0E1C\u0E19\u0E31\u0E07\u0E44\u0E21\u0E49\u0E23\u0E30\u0E41\u0E19\u0E07\u0E42\u0E2D\u0E4A\u0E04\u0E1D\u0E31\u0E48\u0E07\u0E02\u0E27\u0E32",
      floor: "\u0E1E\u0E37\u0E49\u0E19\u0E44\u0E21\u0E49\u0E25\u0E32\u0E21\u0E34\u0E40\u0E19\u0E15\u0E2A\u0E35\u0E42\u0E2D\u0E4A\u0E04\u0E2D\u0E48\u0E2D\u0E19\u0E25\u0E32\u0E22\u0E01\u0E49\u0E32\u0E07\u0E1B\u0E25\u0E32 \u0E1B\u0E39\u0E1E\u0E23\u0E21\u0E02\u0E19\u0E2A\u0E31\u0E49\u0E19\u0E2A\u0E35\u0E40\u0E17\u0E32\u0E40\u0E17\u0E32\u0E42\u0E21\u0E40\u0E14\u0E34\u0E23\u0E4C\u0E19",
      ceiling: "\u0E40\u0E1E\u0E14\u0E32\u0E19\u0E1D\u0E49\u0E32\u0E2B\u0E25\u0E38\u0E21\u0E2A\u0E35\u0E02\u0E32\u0E27\u0E0B\u0E48\u0E2D\u0E19\u0E44\u0E1F warm light \u0E2A\u0E35\u0E2A\u0E49\u0E21\u0E2A\u0E25\u0E31\u0E27\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2A\u0E1B\u0E2D\u0E15\u0E44\u0E25\u0E17\u0E4C\u0E1D\u0E31\u0E07\u0E1D\u0E49\u0E32",
      doors: "\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E01\u0E23\u0E30\u0E08\u0E01\u0E1A\u0E32\u0E19\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E01\u0E23\u0E2D\u0E1A\u0E2D\u0E25\u0E39\u0E21\u0E34\u0E40\u0E19\u0E35\u0E22\u0E21\u0E2A\u0E35\u0E14\u0E33\u0E14\u0E49\u0E32\u0E19 \u0E40\u0E1B\u0E34\u0E14\u0E2D\u0E2D\u0E01\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E07",
      windows: "\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07\u0E01\u0E23\u0E30\u0E08\u0E01\u0E1A\u0E32\u0E19\u0E43\u0E2B\u0E0D\u0E48\u0E17\u0E23\u0E07\u0E2A\u0E39\u0E07\u0E08\u0E32\u0E01\u0E1E\u0E37\u0E49\u0E19\u0E08\u0E23\u0E14\u0E40\u0E1E\u0E14\u0E32\u0E19 \u0E23\u0E31\u0E1A\u0E41\u0E2A\u0E07\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34\u0E17\u0E32\u0E07\u0E17\u0E34\u0E28\u0E40\u0E2B\u0E19\u0E37\u0E2D",
      majorFurniture: "\u0E42\u0E0B\u0E1F\u0E32\u0E1C\u0E49\u0E32\u0E25\u0E34\u0E19\u0E34\u0E19\u0E17\u0E23\u0E07\u0E41\u0E2D\u0E25\u0E2A\u0E35\u0E40\u0E17\u0E32\u0E2D\u0E48\u0E2D\u0E19, \u0E42\u0E15\u0E4A\u0E30\u0E01\u0E25\u0E32\u0E07\u0E44\u0E21\u0E49\u0E42\u0E2D\u0E4A\u0E04\u0E01\u0E25\u0E21\u0E21\u0E19, \u0E42\u0E15\u0E4A\u0E30\u0E27\u0E32\u0E07\u0E17\u0E35\u0E27\u0E35\u0E1A\u0E34\u0E25\u0E17\u0E4C\u0E2D\u0E34\u0E19\u0E44\u0E21\u0E49",
      fixedObjects: "\u0E1C\u0E19\u0E31\u0E07\u0E0A\u0E31\u0E49\u0E19\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E37\u0E2D\u0E1A\u0E34\u0E25\u0E17\u0E4C\u0E2D\u0E34\u0E19\u0E41\u0E1A\u0E1A\u0E44\u0E23\u0E49\u0E21\u0E37\u0E2D\u0E08\u0E31\u0E1A \u0E41\u0E25\u0E30\u0E15\u0E39\u0E49\u0E0B\u0E48\u0E2D\u0E19\u0E2A\u0E32\u0E22\u0E44\u0E1F\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E40\u0E19\u0E35\u0E22\u0E19",
      spatialLayout: "\u0E1E\u0E37\u0E49\u0E19\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E42\u0E25\u0E48\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E01\u0E31\u0E1A\u0E21\u0E38\u0E21\u0E23\u0E31\u0E1A\u0E1B\u0E23\u0E30\u0E17\u0E32\u0E19\u0E2D\u0E32\u0E2B\u0E32\u0E23 \u0E17\u0E34\u0E28\u0E17\u0E32\u0E07\u0E41\u0E2A\u0E07\u0E2A\u0E48\u0E2D\u0E07\u0E40\u0E09\u0E35\u0E22\u0E07 45 \u0E2D\u0E07\u0E28\u0E32",
      permanentDecor: "\u0E20\u0E32\u0E1E\u0E27\u0E32\u0E14\u0E28\u0E34\u0E25\u0E1B\u0E30\u0E41\u0E2D\u0E1A\u0E2A\u0E41\u0E15\u0E23\u0E01\u0E15\u0E4C\u0E42\u0E17\u0E19\u0E2A\u0E35\u0E40\u0E2D\u0E34\u0E23\u0E4C\u0E18\u0E42\u0E17\u0E19\u0E02\u0E19\u0E32\u0E14\u0E43\u0E2B\u0E0D\u0E48 1 \u0E23\u0E39\u0E1B \u0E41\u0E25\u0E30\u0E15\u0E49\u0E19\u0E44\u0E17\u0E23\u0E43\u0E1A\u0E2A\u0E31\u0E01\u0E43\u0E19\u0E01\u0E23\u0E30\u0E16\u0E32\u0E07\u0E40\u0E0B\u0E23\u0E32\u0E21\u0E34\u0E01",
      distinctiveFeatures: "\u0E0A\u0E48\u0E2D\u0E07\u0E41\u0E2A\u0E07\u0E2A\u0E48\u0E2D\u0E07\u0E01\u0E23\u0E30\u0E17\u0E1A\u0E1C\u0E19\u0E31\u0E07\u0E44\u0E21\u0E49\u0E23\u0E30\u0E41\u0E19\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E2A\u0E49\u0E19\u0E40\u0E09\u0E35\u0E22\u0E07 \u0E41\u0E25\u0E30\u0E42\u0E04\u0E21\u0E44\u0E1F\u0E15\u0E31\u0E49\u0E07\u0E1E\u0E37\u0E49\u0E19\u0E17\u0E23\u0E07\u0E42\u0E04\u0E49\u0E07\u0E2A\u0E35\u0E14\u0E33\u0E14\u0E49\u0E32\u0E19",
      referenceImageUrl: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80",
      referenceImageId: "ref_loc_living_01",
      imageHash: "loc_hash_modern_living_88a91c",
      confidence: 96,
      generatedVisualPrompt: "Modern Japandi living room, warm beige smooth walls, light oak herringbone wooden flooring, large floor-to-ceiling glass window, L-shaped light grey linen sofa, oak round coffee table, built-in recessed ceiling spotlights with warm ambient lighting"
    },
    storyProfile: {
      storyLocationName: "\u0E2B\u0E49\u0E2D\u0E07\u0E19\u0E31\u0E48\u0E07\u0E40\u0E25\u0E48\u0E19\u0E04\u0E2D\u0E19\u0E42\u0E14\u0E2B\u0E23\u0E39\u0E43\u0E08\u0E01\u0E25\u0E32\u0E07\u0E40\u0E21\u0E37\u0E2D\u0E07",
      description: "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E1E\u0E31\u0E01\u0E1C\u0E48\u0E2D\u0E19\u0E41\u0E25\u0E30\u0E1E\u0E39\u0E14\u0E04\u0E38\u0E22\u0E2B\u0E25\u0E31\u0E01\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01 \u0E1A\u0E23\u0E23\u0E22\u0E32\u0E01\u0E32\u0E28\u0E40\u0E07\u0E35\u0E22\u0E1A\u0E2A\u0E07\u0E1A \u0E2D\u0E1A\u0E2D\u0E38\u0E48\u0E19 \u0E41\u0E25\u0E30\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27",
      notes: "\u0E43\u0E0A\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E09\u0E32\u0E01\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E25\u0E30\u0E09\u0E32\u0E01\u0E1E\u0E39\u0E14\u0E04\u0E38\u0E22\u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07 2 \u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23"
    },
    createdAt: new Date(Date.now() - 864e5 * 3).toISOString()
  },
  {
    id: "loc_scifi_deck_02",
    name: "\u0E2B\u0E49\u0E2D\u0E07\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E22\u0E32\u0E19\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E2D\u0E27\u0E01\u0E32\u0E28 (Sci-Fi Command Deck)",
    type: "LOCATION",
    lockStatus: "LOCKED",
    imageAnalysisStatus: "USER_CONFIRMED",
    referenceImageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
    referenceImages: [
      "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80"
    ],
    referenceImageId: "ref_loc_scifi_02",
    imageHash: "loc_hash_scifi_deck_99c32f",
    thumbnailUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
    triggerTag: "(location_scifi_spaceship_command_bridge:1.3)",
    identity: {
      id: "loc_scifi_deck_02",
      name: "\u0E2B\u0E49\u0E2D\u0E07\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E22\u0E32\u0E19\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E2D\u0E27\u0E01\u0E32\u0E28 (Sci-Fi Command Deck)"
    },
    referenceMetadata: {
      referenceImageId: "ref_loc_scifi_02",
      referenceImageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
      imageHash: "loc_hash_scifi_deck_99c32f",
      availableViews: ["WIDE_ANGLE_DECK", "PILOT_CONSOLE", "HOLOGRAPHIC_STATION"],
      imageAnalysisStatus: "USER_CONFIRMED"
    },
    visualProfile: {
      environmentType: "Interior Sci-Fi Spaceship Bridge",
      architecturalStyle: "Futuristic Cybernetic Industrial",
      wallColor: "\u0E41\u0E1C\u0E48\u0E19\u0E42\u0E25\u0E2B\u0E30\u0E44\u0E17\u0E40\u0E17\u0E40\u0E19\u0E35\u0E22\u0E21\u0E2A\u0E35\u0E40\u0E17\u0E32\u0E40\u0E02\u0E49\u0E21\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E14\u0E49\u0E32\u0E19 \u0E2A\u0E25\u0E31\u0E1A\u0E40\u0E2A\u0E49\u0E19\u0E44\u0E1F\u0E19\u0E35\u0E2D\u0E2D\u0E19\u0E41\u0E16\u0E1A\u0E2A\u0E35\u0E1F\u0E49\u0E32\u0E04\u0E23\u0E32\u0E21 (Cyan LED Strips)",
      floor: "\u0E41\u0E1C\u0E48\u0E19\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E40\u0E2A\u0E23\u0E34\u0E21\u0E25\u0E32\u0E22\u0E01\u0E31\u0E19\u0E25\u0E37\u0E48\u0E19\u0E2A\u0E35\u0E40\u0E17\u0E32\u0E04\u0E32\u0E23\u0E4C\u0E1A\u0E2D\u0E19 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E44\u0E1F\u0E19\u0E33\u0E17\u0E32\u0E07\u0E1D\u0E31\u0E07\u0E1E\u0E37\u0E49\u0E19\u0E2A\u0E35\u0E2A\u0E49\u0E21\u0E41\u0E14\u0E07",
      ceiling: "\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E40\u0E1B\u0E25\u0E37\u0E2D\u0E22\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E42\u0E21\u0E14\u0E39\u0E25\u0E32\u0E23\u0E4C \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E41\u0E1C\u0E07\u0E17\u0E48\u0E2D\u0E2B\u0E25\u0E48\u0E2D\u0E40\u0E22\u0E47\u0E19\u0E41\u0E25\u0E30\u0E44\u0E1F\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E44\u0E25\u0E17\u0E4C\u0E2A\u0E35\u0E02\u0E32\u0E27\u0E40\u0E22\u0E47\u0E19 6500K",
      doors: "\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E01\u0E25\u0E44\u0E2E\u0E14\u0E23\u0E2D\u0E25\u0E34\u0E01\u0E41\u0E1A\u0E1A\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E41\u0E22\u0E01\u0E0B\u0E49\u0E32\u0E22\u0E02\u0E27\u0E32\u0E2A\u0E2D\u0E07\u0E0A\u0E31\u0E49\u0E19 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E41\u0E1C\u0E07\u0E2A\u0E41\u0E01\u0E19\u0E25\u0E32\u0E22\u0E19\u0E34\u0E49\u0E27\u0E21\u0E37\u0E2D",
      windows: "\u0E01\u0E23\u0E30\u0E08\u0E01\u0E21\u0E2D\u0E07\u0E22\u0E32\u0E19\u0E2D\u0E27\u0E01\u0E32\u0E28\u0E17\u0E23\u0E07\u0E1E\u0E32\u0E42\u0E19\u0E23\u0E32\u0E21\u0E32\u0E01\u0E27\u0E49\u0E32\u0E07 180 \u0E2D\u0E07\u0E28\u0E32 \u0E40\u0E1C\u0E22\u0E43\u0E2B\u0E49\u0E40\u0E2B\u0E47\u0E19\u0E2B\u0E49\u0E27\u0E07\u0E2D\u0E27\u0E01\u0E32\u0E28\u0E41\u0E25\u0E30\u0E25\u0E30\u0E2D\u0E2D\u0E07\u0E40\u0E19\u0E1A\u0E34\u0E27\u0E25\u0E32",
      majorFurniture: "\u0E40\u0E01\u0E49\u0E32\u0E2D\u0E35\u0E49\u0E01\u0E31\u0E1B\u0E15\u0E31\u0E19\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E35\u0E14\u0E33\u0E1B\u0E23\u0E31\u0E1A\u0E40\u0E2D\u0E19\u0E44\u0E14\u0E49\u0E15\u0E23\u0E07\u0E01\u0E25\u0E32\u0E07, \u0E04\u0E2D\u0E19\u0E42\u0E0B\u0E25\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21 4 \u0E08\u0E38\u0E14\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E08\u0E2D\u0E17\u0E31\u0E0A\u0E2A\u0E01\u0E23\u0E35\u0E19\u0E42\u0E1B\u0E23\u0E48\u0E07\u0E41\u0E2A\u0E07",
      fixedObjects: "\u0E41\u0E17\u0E48\u0E19\u0E09\u0E32\u0E22\u0E20\u0E32\u0E1E\u0E42\u0E2E\u0E42\u0E25\u0E41\u0E01\u0E23\u0E21\u0E2A\u0E32\u0E21\u0E21\u0E34\u0E15\u0E34\u0E02\u0E19\u0E32\u0E14\u0E43\u0E2B\u0E0D\u0E48\u0E17\u0E23\u0E07\u0E01\u0E25\u0E21\u0E01\u0E25\u0E32\u0E07\u0E2B\u0E49\u0E2D\u0E07",
      spatialLayout: "\u0E17\u0E23\u0E07\u0E40\u0E01\u0E37\u0E2D\u0E01\u0E21\u0E49\u0E32 (Horseshoe Layout) \u0E1E\u0E37\u0E49\u0E19\u0E22\u0E01\u0E23\u0E30\u0E14\u0E31\u0E1A 2 \u0E0A\u0E31\u0E49\u0E19 \u0E01\u0E31\u0E1B\u0E15\u0E31\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E15\u0E23\u0E07\u0E01\u0E25\u0E32\u0E07\u0E2A\u0E39\u0E07\u0E01\u0E27\u0E48\u0E32\u0E04\u0E2D\u0E19\u0E42\u0E0B\u0E25\u0E19\u0E31\u0E01\u0E1A\u0E34\u0E19",
      permanentDecor: "\u0E2B\u0E19\u0E49\u0E32\u0E08\u0E2D\u0E40\u0E23\u0E14\u0E32\u0E23\u0E4C\u0E41\u0E2A\u0E14\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E01\u0E32\u0E23\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E02\u0E2D\u0E07\u0E22\u0E32\u0E19 \u0E41\u0E25\u0E30\u0E2A\u0E31\u0E0D\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C\u0E22\u0E32\u0E19\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D\u0E2A\u0E35\u0E40\u0E07\u0E34\u0E19",
      distinctiveFeatures: "\u0E41\u0E2A\u0E07\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19\u0E08\u0E32\u0E01\u0E01\u0E23\u0E30\u0E08\u0E01\u0E22\u0E32\u0E19\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E14\u0E27\u0E07\u0E14\u0E32\u0E27\u0E23\u0E30\u0E22\u0E34\u0E1A\u0E23\u0E30\u0E22\u0E31\u0E1A \u0E41\u0E25\u0E30\u0E41\u0E2A\u0E07\u0E44\u0E1F\u0E19\u0E35\u0E2D\u0E2D\u0E19\u0E27\u0E34\u0E48\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E23\u0E2D\u0E1A\u0E04\u0E2D\u0E19\u0E42\u0E0B\u0E25",
      referenceImageUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
      referenceImageId: "ref_loc_scifi_02",
      imageHash: "loc_hash_scifi_deck_99c32f",
      confidence: 97,
      generatedVisualPrompt: "Futuristic spaceship bridge command deck, dark matte titanium walls, glowing cyan LED light strips, carbon steel floor with orange guide lights, panoramic 180-degree front viewport showing outer space nebula, holographic globe display in center"
    },
    storyProfile: {
      storyLocationName: "\u0E22\u0E32\u0E19\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E28\u0E32\u0E25\u0E32-1 (Sala-1 Cruiser Bridge)",
      description: "\u0E28\u0E39\u0E19\u0E22\u0E4C\u0E01\u0E25\u0E32\u0E07\u0E2A\u0E31\u0E48\u0E07\u0E01\u0E32\u0E23\u0E02\u0E2D\u0E07\u0E22\u0E32\u0E19\u0E2A\u0E33\u0E23\u0E27\u0E08 \u0E1A\u0E23\u0E23\u0E22\u0E32\u0E01\u0E32\u0E28\u0E15\u0E36\u0E07\u0E40\u0E04\u0E23\u0E35\u0E22\u0E14\u0E41\u0E15\u0E48\u0E40\u0E1B\u0E35\u0E48\u0E22\u0E21\u0E14\u0E49\u0E27\u0E22\u0E40\u0E17\u0E04\u0E42\u0E19\u0E42\u0E25\u0E22\u0E35\u0E02\u0E31\u0E49\u0E19\u0E2A\u0E39\u0E07",
      notes: "\u0E43\u0E0A\u0E49\u0E43\u0E19\u0E09\u0E32\u0E01\u0E01\u0E32\u0E23\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E14\u0E27\u0E07\u0E14\u0E32\u0E27\u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E48\u0E07\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E04\u0E31\u0E0D"
    },
    createdAt: new Date(Date.now() - 864e5 * 2).toISOString()
  },
  {
    id: "loc_thai_veranda_03",
    name: "\u0E0A\u0E32\u0E19\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E44\u0E21\u0E49\u0E44\u0E17\u0E22\u0E23\u0E34\u0E21\u0E19\u0E49\u0E33 (Traditional Thai Wooden Veranda)",
    type: "LOCATION",
    lockStatus: "LOCKED",
    imageAnalysisStatus: "USER_CONFIRMED",
    referenceImageUrl: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80",
    referenceImages: [
      "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80"
    ],
    referenceImageId: "ref_loc_thai_03",
    imageHash: "loc_hash_thai_veranda_77e41b",
    thumbnailUrl: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80",
    triggerTag: "(location_traditional_thai_wooden_waterfront_house:1.25)",
    identity: {
      id: "loc_thai_veranda_03",
      name: "\u0E0A\u0E32\u0E19\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E44\u0E21\u0E49\u0E44\u0E17\u0E22\u0E23\u0E34\u0E21\u0E19\u0E49\u0E33 (Traditional Thai Wooden Veranda)"
    },
    referenceMetadata: {
      referenceImageId: "ref_loc_thai_03",
      referenceImageUrl: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80",
      imageHash: "loc_hash_thai_veranda_77e41b",
      availableViews: ["WIDE_RIVER_VIEW", "WOODEN_TERRACE", "ORNATE_EAVES_DETAIL"],
      imageAnalysisStatus: "USER_CONFIRMED"
    },
    visualProfile: {
      environmentType: "Semi-outdoor (\u0E0A\u0E32\u0E19\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E40\u0E1B\u0E34\u0E14\u0E42\u0E25\u0E48\u0E07\u0E23\u0E34\u0E21\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33)",
      architecturalStyle: "Traditional Central Thai Wooden Architecture (\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E44\u0E17\u0E22\u0E20\u0E32\u0E04\u0E01\u0E25\u0E32\u0E07)",
      wallColor: "\u0E1C\u0E19\u0E31\u0E07\u0E1D\u0E32\u0E1B\u0E30\u0E01\u0E19\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01\u0E17\u0E2D\u0E07\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E2D\u0E21\u0E2A\u0E49\u0E21 \u0E40\u0E04\u0E25\u0E37\u0E2D\u0E1A\u0E40\u0E07\u0E32\u0E21\u0E31\u0E19\u0E27\u0E32\u0E27\u0E15\u0E32\u0E21\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34",
      floor: "\u0E44\u0E21\u0E49\u0E01\u0E23\u0E30\u0E14\u0E32\u0E19\u0E2A\u0E31\u0E01\u0E41\u0E1C\u0E48\u0E19\u0E43\u0E2B\u0E0D\u0E48\u0E2B\u0E19\u0E49\u0E32\u0E01\u0E27\u0E49\u0E32\u0E07 \u0E02\u0E31\u0E14\u0E21\u0E31\u0E19\u0E40\u0E07\u0E32\u0E07\u0E32\u0E21 \u0E21\u0E35\u0E23\u0E48\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E32\u0E22\u0E19\u0E49\u0E33\u0E41\u0E25\u0E30\u0E25\u0E21\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34",
      ceiling: "\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2B\u0E25\u0E31\u0E07\u0E04\u0E32\u0E17\u0E23\u0E07\u0E08\u0E31\u0E48\u0E27\u0E17\u0E23\u0E07\u0E2A\u0E39\u0E07\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1B\u0E25\u0E37\u0E2D\u0E22\u0E40\u0E2B\u0E47\u0E19\u0E02\u0E37\u0E48\u0E2D\u0E41\u0E1B\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01 \u0E41\u0E01\u0E30\u0E2A\u0E25\u0E31\u0E01\u0E25\u0E27\u0E14\u0E25\u0E32\u0E22\u0E1A\u0E31\u0E27\u0E01\u0E25\u0E35\u0E1A\u0E02\u0E19\u0E38\u0E19",
      doors: "\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E1A\u0E32\u0E19\u0E40\u0E1F\u0E35\u0E49\u0E22\u0E21\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E40\u0E1B\u0E34\u0E14\u0E1E\u0E31\u0E1A\u0E40\u0E01\u0E47\u0E1A\u0E02\u0E49\u0E32\u0E07\u0E1C\u0E19\u0E31\u0E07\u0E44\u0E14\u0E49\u0E2A\u0E38\u0E14\u0E41\u0E19\u0E27",
      windows: "\u0E0A\u0E48\u0E2D\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07\u0E0B\u0E38\u0E49\u0E21\u0E44\u0E21\u0E49\u0E09\u0E25\u0E38\u0E25\u0E32\u0E22\u0E42\u0E1A\u0E23\u0E32\u0E13 \u0E40\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A\u0E25\u0E21\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33\u0E1E\u0E31\u0E14\u0E42\u0E0A\u0E22\u0E15\u0E25\u0E2D\u0E14\u0E27\u0E31\u0E19",
      majorFurniture: "\u0E15\u0E31\u0E48\u0E07\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E1B\u0E39\u0E40\u0E1A\u0E32\u0E30\u0E1C\u0E49\u0E32\u0E44\u0E2B\u0E21\u0E25\u0E32\u0E22\u0E02\u0E34\u0E14, \u0E2B\u0E21\u0E2D\u0E19\u0E02\u0E27\u0E32\u0E19\u0E2A\u0E32\u0E21\u0E40\u0E2B\u0E25\u0E35\u0E48\u0E22\u0E21\u0E25\u0E32\u0E22\u0E44\u0E17\u0E22\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E2A\u0E35\u0E04\u0E23\u0E32\u0E21",
      fixedObjects: "\u0E23\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E07\u0E23\u0E32\u0E27\u0E25\u0E39\u0E01\u0E01\u0E23\u0E07\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01\u0E09\u0E25\u0E38\u0E25\u0E32\u0E22\u0E23\u0E34\u0E21\u0E19\u0E49\u0E33 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E2A\u0E32\u0E40\u0E2D\u0E01\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01\u0E01\u0E25\u0E36\u0E07\u0E01\u0E25\u0E21",
      spatialLayout: "\u0E0A\u0E32\u0E19\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E19\u0E2D\u0E19\u0E41\u0E25\u0E30\u0E17\u0E48\u0E32\u0E19\u0E49\u0E33 \u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33\u0E40\u0E08\u0E49\u0E32\u0E1E\u0E23\u0E30\u0E22\u0E32\u0E22\u0E32\u0E21\u0E40\u0E22\u0E47\u0E19",
      permanentDecor: "\u0E01\u0E23\u0E30\u0E16\u0E32\u0E07\u0E1A\u0E31\u0E27\u0E14\u0E34\u0E19\u0E40\u0E1C\u0E32\u0E40\u0E04\u0E25\u0E37\u0E2D\u0E1A\u0E21\u0E23\u0E01\u0E15, \u0E15\u0E30\u0E40\u0E01\u0E35\u0E22\u0E07\u0E17\u0E2D\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E07\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E41\u0E02\u0E27\u0E19\u0E40\u0E2A\u0E32",
      distinctiveFeatures: "\u0E41\u0E2A\u0E07\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19\u0E23\u0E30\u0E25\u0E2D\u0E01\u0E04\u0E25\u0E37\u0E48\u0E19\u0E19\u0E49\u0E33\u0E23\u0E30\u0E22\u0E34\u0E1A\u0E23\u0E30\u0E22\u0E31\u0E1A\u0E02\u0E36\u0E49\u0E19\u0E1A\u0E19\u0E40\u0E1E\u0E14\u0E32\u0E19\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01 \u0E41\u0E25\u0E30\u0E0A\u0E32\u0E22\u0E04\u0E32\u0E17\u0E23\u0E07\u0E1B\u0E31\u0E49\u0E19\u0E2B\u0E22\u0E32\u0E41\u0E01\u0E30\u0E2A\u0E25\u0E31\u0E01\u0E1B\u0E23\u0E30\u0E13\u0E35\u0E15",
      referenceImageUrl: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80",
      referenceImageId: "ref_loc_thai_03",
      imageHash: "loc_hash_thai_veranda_77e41b",
      confidence: 95,
      generatedVisualPrompt: "Traditional central Thai wooden house veranda, golden teak wood panel walls, polished wide teak floorboards, high open gable roof with ornate carved brackets, riverside balustrade with tranquil river water reflection, antique brass lanterns"
    },
    storyProfile: {
      storyLocationName: "\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E44\u0E17\u0E22\u0E23\u0E34\u0E21\u0E2A\u0E32\u0E22\u0E19\u0E49\u0E33\u0E2D\u0E31\u0E21\u0E1E\u0E27\u0E32",
      description: "\u0E1A\u0E49\u0E32\u0E19\u0E1E\u0E31\u0E01\u0E23\u0E34\u0E21\u0E19\u0E49\u0E33\u0E1A\u0E23\u0E23\u0E22\u0E32\u0E01\u0E32\u0E28\u0E2A\u0E07\u0E1A \u0E23\u0E48\u0E21\u0E23\u0E37\u0E48\u0E19 \u0E40\u0E15\u0E47\u0E21\u0E44\u0E1B\u0E14\u0E49\u0E27\u0E22\u0E01\u0E25\u0E34\u0E48\u0E19\u0E2D\u0E32\u0E22\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E28\u0E32\u0E2A\u0E15\u0E23\u0E4C\u0E41\u0E25\u0E30\u0E27\u0E31\u0E12\u0E19\u0E18\u0E23\u0E23\u0E21\u0E44\u0E17\u0E22",
      notes: "\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E09\u0E32\u0E01\u0E14\u0E23\u0E32\u0E21\u0E48\u0E32 \u0E1E\u0E31\u0E01\u0E1C\u0E48\u0E2D\u0E19 \u0E19\u0E31\u0E48\u0E07\u0E2A\u0E21\u0E32\u0E18\u0E34 \u0E2B\u0E23\u0E37\u0E2D\u0E1E\u0E1A\u0E1B\u0E30\u0E1E\u0E39\u0E14\u0E04\u0E38\u0E22\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E23\u0E32\u0E27\u0E43\u0E19\u0E2D\u0E14\u0E35\u0E15"
    },
    createdAt: new Date(Date.now() - 864e5).toISOString()
  }
];
var projectsStore = [
  {
    id: "proj_sample_01",
    userId: "default_system",
    title: "\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07: \u0E41\u0E2A\u0E07\u0E41\u0E23\u0E01\u0E41\u0E2B\u0E48\u0E07\u0E2D\u0E22\u0E38\u0E18\u0E22\u0E32 (Dawn of Ayutthaya)",
    description: "\u0E42\u0E1B\u0E23\u0E40\u0E08\u0E01\u0E15\u0E4C\u0E2A\u0E32\u0E18\u0E34\u0E15 Multi-Clip Director \u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E23\u0E31\u0E01\u0E29\u0E32\u0E04\u0E27\u0E32\u0E21\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E1F\u0E49\u0E32\u0E43\u0E2A\u0E43\u0E19\u0E09\u0E32\u0E01\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E28\u0E32\u0E2A\u0E15\u0E23\u0E4C",
    aspectRatio: "16:9",
    defaultCharacterId: "char_fahsai_01",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    scenes: [
      {
        id: "scene_ayutthaya_1",
        sceneNumber: 1,
        title: "\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 1: \u0E01\u0E49\u0E32\u0E27\u0E2A\u0E39\u0E48\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E2A\u0E16\u0E32\u0E19\u0E22\u0E32\u0E21\u0E40\u0E0A\u0E49\u0E32\u0E15\u0E23\u0E39\u0E48",
        prompt: "\u0E1F\u0E49\u0E32\u0E43\u0E2A (Fahsai) \u0E40\u0E14\u0E34\u0E19\u0E01\u0E49\u0E32\u0E27\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E2A\u0E16\u0E32\u0E19\u0E2D\u0E22\u0E38\u0E18\u0E22\u0E32 \u0E41\u0E2A\u0E07\u0E2D\u0E32\u0E17\u0E34\u0E15\u0E22\u0E4C\u0E2A\u0E35\u0E17\u0E2D\u0E07\u0E22\u0E32\u0E21\u0E40\u0E0A\u0E49\u0E32\u0E2A\u0E32\u0E14\u0E2A\u0E48\u0E2D\u0E07\u0E01\u0E23\u0E30\u0E17\u0E1A\u0E40\u0E08\u0E14\u0E35\u0E22\u0E4C\u0E42\u0E1A\u0E23\u0E32\u0E13 \u0E1A\u0E23\u0E23\u0E22\u0E32\u0E01\u0E32\u0E28\u0E40\u0E07\u0E35\u0E22\u0E1A\u0E2A\u0E07\u0E1A \u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C\u0E04\u0E38\u0E13\u0E20\u0E32\u0E1E\u0E2A\u0E39\u0E07",
        negativePrompt: "blurry, low quality, distorted, extra limbs",
        mediaType: "video",
        aspectRatio: "16:9",
        characterId: "char_fahsai_01",
        locationId: "loc_ayutthaya_temple_02",
        usePreviousSceneAsRef: false,
        status: "completed",
        outputUrl: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1280&q=80",
        durationSeconds: 5
      },
      {
        id: "scene_ayutthaya_2",
        sceneNumber: 2,
        title: "\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 2: \u0E2B\u0E22\u0E38\u0E14\u0E21\u0E2D\u0E07\u0E25\u0E27\u0E14\u0E25\u0E32\u0E22\u0E1B\u0E39\u0E19\u0E1B\u0E31\u0E49\u0E19",
        prompt: "\u0E1F\u0E49\u0E32\u0E43\u0E2A (Fahsai) \u0E2B\u0E22\u0E38\u0E14\u0E22\u0E37\u0E19\u0E21\u0E2D\u0E07\u0E25\u0E27\u0E14\u0E25\u0E32\u0E22\u0E1B\u0E39\u0E19\u0E1B\u0E31\u0E49\u0E19\u0E1A\u0E19\u0E0B\u0E38\u0E49\u0E21\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E27\u0E31\u0E14\u0E2D\u0E22\u0E38\u0E18\u0E22\u0E32\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E1B\u0E23\u0E30\u0E17\u0E31\u0E1A\u0E43\u0E08 \u0E25\u0E21\u0E1E\u0E31\u0E14\u0E1C\u0E21\u0E22\u0E32\u0E27\u0E1B\u0E23\u0E30\u0E1A\u0E48\u0E32\u0E1B\u0E25\u0E34\u0E27\u0E40\u0E1A\u0E32\u0E46 \u0E41\u0E2A\u0E07\u0E41\u0E14\u0E14\u0E22\u0E32\u0E21\u0E2A\u0E32\u0E22\u0E2D\u0E1A\u0E2D\u0E38\u0E48\u0E19",
        negativePrompt: "blurry, bad anatomy, deformed",
        mediaType: "video",
        aspectRatio: "16:9",
        characterId: "char_fahsai_01",
        locationId: "loc_ayutthaya_temple_02",
        usePreviousSceneAsRef: true,
        status: "completed",
        outputUrl: "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=1280&q=80",
        durationSeconds: 5
      },
      {
        id: "scene_ayutthaya_3",
        sceneNumber: 3,
        title: "\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 3: \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E20\u0E32\u0E1E\u0E04\u0E27\u0E32\u0E21\u0E17\u0E23\u0E07\u0E08\u0E33\u0E23\u0E34\u0E21\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33",
        prompt: "\u0E1F\u0E49\u0E32\u0E43\u0E2A (Fahsai) \u0E19\u0E31\u0E48\u0E07\u0E1E\u0E31\u0E01\u0E23\u0E34\u0E21\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33\u0E40\u0E08\u0E49\u0E32\u0E1E\u0E23\u0E30\u0E22\u0E32\u0E02\u0E49\u0E32\u0E07\u0E27\u0E31\u0E14\u0E44\u0E0A\u0E22\u0E27\u0E31\u0E12\u0E19\u0E32\u0E23\u0E32\u0E21 \u0E22\u0E34\u0E49\u0E21\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E38\u0E02\u0E01\u0E31\u0E1A\u0E27\u0E34\u0E27\u0E40\u0E23\u0E37\u0E2D\u0E2B\u0E32\u0E07\u0E22\u0E32\u0E27\u0E41\u0E25\u0E48\u0E19\u0E1C\u0E48\u0E32\u0E19 \u0E17\u0E49\u0E2D\u0E07\u0E1F\u0E49\u0E32\u0E2A\u0E14\u0E43\u0E2A",
        negativePrompt: "blurry, bad face, poor lighting",
        mediaType: "image",
        aspectRatio: "16:9",
        characterId: "char_fahsai_01",
        usePreviousSceneAsRef: true,
        status: "completed",
        outputUrl: "https://images.unsplash.com/photo-1508672019048-805c876b67e2?auto=format&fit=crop&w=1280&q=80"
      }
    ]
  }
];
function hashPassword(password, salt = import_crypto2.default.randomBytes(16).toString("hex")) {
  const hash = import_crypto2.default.pbkdf2Sync(password, salt, 1e3, 64, "sha512").toString("hex");
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const verify = import_crypto2.default.pbkdf2Sync(password, salt, 1e3, 64, "sha512").toString("hex");
  return verify === hash;
}
var pricingConfig = {
  copyPromptFee: 10,
  // Default: 10 Sala AI Credits per prompt clip
  serviceFeeType: "fixed",
  serviceFeeValue: 5
  // 5 credits or 5%
};
var adminPass = hashPassword("admin1234");
var userPass = hashPassword("user1234");
var usersStore = /* @__PURE__ */ new Map([
  [
    "user_admin_01",
    {
      id: "user_admin_01",
      firstName: "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A",
      lastName: "\u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D",
      username: "admin",
      email: "admin@sala.ai",
      passwordHash: adminPass.hash,
      salt: adminPass.salt,
      role: "admin",
      status: "active",
      isVerified: true,
      createdAt: new Date(Date.now() - 864e5 * 10).toISOString(),
      lastLogin: (/* @__PURE__ */ new Date()).toISOString()
    }
  ],
  [
    "user_sala_001",
    {
      id: "user_sala_001",
      firstName: "\u0E01\u0E32\u0E19\u0E15\u0E4C",
      lastName: "\u0E04\u0E23\u0E35\u0E40\u0E2D\u0E40\u0E15\u0E2D\u0E23\u0E4C",
      username: "creator",
      email: "creator@sala.ai",
      passwordHash: userPass.hash,
      salt: userPass.salt,
      role: "user",
      status: "active",
      isVerified: true,
      createdAt: new Date(Date.now() - 864e5 * 5).toISOString(),
      lastLogin: (/* @__PURE__ */ new Date()).toISOString()
    }
  ]
]);
var sessionsStore = /* @__PURE__ */ new Map();
var revokedSessionTokens = /* @__PURE__ */ new Map();
var verifiedFirebaseTokens = /* @__PURE__ */ new Map();
var FIREBASE_PROJECT_ID = (() => {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  try {
    const cfg = JSON.parse(import_fs.default.readFileSync(import_path.default.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
    return String(cfg.projectId || "");
  } catch {
    return "";
  }
})();
var ADMIN_EMAILS = parseAdminEmails(process.env.ADMIN_EMAILS, ["mama.ff9522@gmail.com"]);
var SESSION_SECRET = process.env.SESSION_SECRET || (FIREBASE_PROJECT_ID ? `sala-session-secret-${FIREBASE_PROJECT_ID}` : "sala-ai-default-session-secret-2026");
if (!process.env.SESSION_SECRET) console.warn("[auth] SESSION_SECRET not set: using persistent project fallback secret for local sessions");
var currentUserAccount = {
  userId: "user_sala_001",
  userName: "\u0E04\u0E23\u0E35\u0E40\u0E2D\u0E40\u0E15\u0E2D\u0E23\u0E4C\u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D (Creator)",
  userRole: "user",
  // Standard user role
  remainingCredits: 250,
  totalUsedCredits: 50,
  dailyUsedCredits: 20,
  dailyLimit: 150,
  monthlyUsedCredits: 180,
  monthlyLimit: 1e3,
  perGenerationLimit: 40,
  transactions: [
    {
      id: "tx_welcome",
      timestamp: new Date(Date.now() - 864e5 * 2).toISOString(),
      amount: 300,
      type: "bonus",
      description: "\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E39\u0E48 \u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D! \u0E42\u0E1A\u0E19\u0E31\u0E2A\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E1F\u0E23\u0E35",
      balanceAfter: 300
    },
    {
      id: "tx_01",
      timestamp: new Date(Date.now() - 864e5).toISOString(),
      amount: -10,
      type: "usage",
      description: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E20\u0E32\u0E1E: \u0E01\u0E32\u0E19\u0E15\u0E4C \u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 1 (16:9)",
      balanceAfter: 290
    },
    {
      id: "tx_02",
      timestamp: new Date(Date.now() - 36e5 * 5).toISOString(),
      amount: -40,
      type: "usage",
      description: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D: \u0E01\u0E32\u0E19\u0E15\u0E4C \u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 2 \u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C\u0E2A\u0E31\u0E49\u0E19",
      balanceAfter: 250
    }
  ]
};
var adminCreditAccount = {
  userId: "user_admin_01",
  userName: "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A\u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D (Admin)",
  userRole: "admin",
  remainingCredits: 9999,
  totalUsedCredits: 100,
  dailyUsedCredits: 0,
  dailyLimit: 1e4,
  monthlyUsedCredits: 100,
  monthlyLimit: 5e4,
  perGenerationLimit: 500,
  transactions: []
};
var creditAccountsStore = /* @__PURE__ */ new Map([
  ["user_sala_001", currentUserAccount],
  ["user_admin_01", adminCreditAccount]
]);
async function verifyFirebaseTokenCached(token) {
  const now = Math.floor(Date.now() / 1e3);
  const cached = verifiedFirebaseTokens.get(token);
  if (cached) {
    if (cached.exp > now) return cached;
    verifiedFirebaseTokens.delete(token);
  }
  const claims = await verifyFirebaseIdToken(token, FIREBASE_PROJECT_ID);
  if (claims) {
    if (verifiedFirebaseTokens.size > 5e3) verifiedFirebaseTokens.clear();
    verifiedFirebaseTokens.set(token, claims);
  }
  return claims;
}
async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split(" ")[1]?.trim();
  if (!token) return null;
  let userId;
  let identity = null;
  if (token.startsWith("sala.")) {
    const session = verifySessionToken(token, SESSION_SECRET);
    if (session && !revokedSessionTokens.has(token)) {
      userId = session.userId;
      identity = { via: "local-session" };
    }
  } else {
    const decoded = await verifyFirebaseTokenCached(token);
    if (decoded) {
      identity = { via: "firebase", firebase: decoded };
      userId = decoded.uid;
      let user2 = usersStore.get(userId);
      if (!user2 && decoded.email && decoded.emailVerified) {
        user2 = Array.from(usersStore.values()).find(
          (u) => u.email.toLowerCase() === decoded.email.toLowerCase()
        );
        if (user2) {
          userId = user2.id;
        }
      }
      if (!user2) {
        const isAdmin = isAdminIdentity(decoded, ADMIN_EMAILS);
        user2 = {
          id: userId,
          username: decoded.email?.split("@")[0] || `user_${userId.slice(0, 8)}`,
          email: decoded.email || `${userId}@firebase.user`,
          firstName: decoded.name || "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49 Google",
          lastName: "",
          role: isAdmin ? "admin" : "user",
          status: "active",
          isVerified: decoded.emailVerified,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastLogin: (/* @__PURE__ */ new Date()).toISOString(),
          salt: "",
          passwordHash: ""
        };
        usersStore.set(userId, user2);
      } else {
        user2.lastLogin = (/* @__PURE__ */ new Date()).toISOString();
      }
    }
  }
  if (!userId) return null;
  let user = usersStore.get(userId);
  if (!user && identity?.via === "local-session") {
    user = {
      id: userId,
      username: userId,
      email: `${userId}@sala.local`,
      firstName: "\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01 Sala AI",
      lastName: "",
      role: "user",
      status: "active",
      isVerified: true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      lastLogin: (/* @__PURE__ */ new Date()).toISOString(),
      salt: "",
      passwordHash: ""
    };
    usersStore.set(userId, user);
  }
  if (!user || user.status === "suspended") return null;
  let account = creditAccountsStore.get(user.id);
  if (!account) {
    const initialCredits = user.role === "admin" ? 9999 : 500;
    account = {
      userId: user.id,
      userName: `${user.firstName || user.username} (${user.role === "admin" ? "\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A" : "\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01"})`,
      userRole: user.role,
      remainingCredits: initialCredits,
      totalUsedCredits: 0,
      dailyUsedCredits: 0,
      dailyLimit: user.role === "admin" ? 1e4 : 250,
      monthlyUsedCredits: 0,
      monthlyLimit: user.role === "admin" ? 5e4 : 2e3,
      perGenerationLimit: user.role === "admin" ? 500 : 50,
      transactions: [
        {
          id: `tx_welcome_${Date.now()}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          amount: initialCredits,
          type: "bonus",
          description: "\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E39\u0E48 \u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D! \u0E42\u0E1A\u0E19\u0E31\u0E2A\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E1F\u0E23\u0E35",
          balanceAfter: initialCredits
        }
      ]
    };
    creditAccountsStore.set(user.id, account);
  }
  if (!identity) return null;
  return { user, account, identity };
}
async function requireAuth(req, res, next) {
  let auth = null;
  try {
    auth = await getAuthenticatedUser(req);
  } catch {
    auth = null;
  }
  if (!auth) {
    const demoUser = {
      id: "demo_creator",
      username: "demo_creator",
      email: "creator@sala.ai",
      firstName: "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E17\u0E14\u0E2A\u0E2D\u0E1A",
      lastName: "(Demo Mode)",
      role: "user",
      status: "active",
      isVerified: true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    let demoAccount = creditAccountsStore.get("demo_creator");
    if (!demoAccount) {
      demoAccount = {
        userId: "demo_creator",
        userName: "\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E17\u0E14\u0E2A\u0E2D\u0E1A (Demo Mode)",
        userRole: "user",
        remainingCredits: 2e3,
        totalUsedCredits: 0,
        dailyUsedCredits: 0,
        dailyLimit: 5e3,
        monthlyUsedCredits: 0,
        monthlyLimit: 2e4,
        perGenerationLimit: 100,
        transactions: [
          {
            id: "tx_demo_init",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            amount: 2e3,
            type: "bonus",
            description: "\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E42\u0E2B\u0E21\u0E14\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E08\u0E33\u0E25\u0E2D\u0E07 (Mock Demo)",
            balanceAfter: 2e3
          }
        ]
      };
      creditAccountsStore.set("demo_creator", demoAccount);
    }
    req.user = demoUser;
    req.creditAccount = demoAccount;
    return next();
  }
  req.user = auth.user;
  req.creditAccount = auth.account;
  next();
}
async function requireAdmin(req, res, next) {
  let auth = null;
  try {
    auth = await getAuthenticatedUser(req);
  } catch {
    auth = null;
  }
  if (!auth) {
    return res.status(401).json({
      success: false,
      message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E01\u0E48\u0E2D\u0E19\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23 (Unauthorized: Session Token Required)"
    });
  }
  const isAuthorizedAdmin = auth.identity.via === "firebase" && isAdminIdentity(auth.identity.firebase, ADMIN_EMAILS);
  if (!isAuthorizedAdmin) {
    return res.status(403).json({
      success: false,
      message: "\u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E40\u0E02\u0E49\u0E32\u0E16\u0E36\u0E07\u0E2A\u0E48\u0E27\u0E19\u0E19\u0E35\u0E49 \u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A (Forbidden: Admin Privileges Required)"
    });
  }
  if (auth.user.role !== "admin") {
    auth.user.role = "admin";
    usersStore.set(auth.user.id, auth.user);
  }
  req.user = auth.user;
  req.creditAccount = auth.account;
  next();
}
var redeemCodesStore = /* @__PURE__ */ new Map([
  [
    "code_welcome_100",
    {
      id: "code_welcome_100",
      code: "SALA100",
      creditAmount: 100,
      maxUses: 1e3,
      usedCount: 14,
      isExpired: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: "admin"
    }
  ],
  [
    "code_vip_500",
    {
      id: "code_vip_500",
      code: "SALAVIP500",
      creditAmount: 500,
      maxUses: 50,
      usedCount: 3,
      isExpired: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: "admin"
    }
  ]
]);
var projectTemplatesStore = [
  {
    id: "tmpl_cinematic_thai_01",
    name: "\u0E40\u0E17\u0E21\u0E40\u0E1E\u0E25\u0E15: \u0E21\u0E2B\u0E32\u0E01\u0E32\u0E1E\u0E22\u0E4C\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E04\u0E14\u0E35\u0E44\u0E17\u0E22 (Cinematic Thai Heritage)",
    description: "\u0E41\u0E2A\u0E07\u0E04\u0E1A\u0E40\u0E1E\u0E25\u0E34\u0E07 Chiaroscuro \u0E2D\u0E31\u0E15\u0E23\u0E32\u0E2A\u0E48\u0E27\u0E19 16:9 \u0E01\u0E25\u0E49\u0E2D\u0E07 Dolly In \u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C 35mm",
    aspectRatio: "16:9",
    visualStyle: "Cinematic",
    defaultCharacterId: "char_karn_02",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  },
  {
    id: "tmpl_cyberpunk_neon_02",
    name: "\u0E40\u0E17\u0E21\u0E40\u0E1E\u0E25\u0E15: \u0E44\u0E0B\u0E40\u0E1A\u0E2D\u0E23\u0E4C\u0E1E\u0E31\u0E07\u0E01\u0E4C\u0E2D\u0E19\u0E32\u0E04\u0E15 (Cyberpunk Neon 9:16)",
    description: "\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A TikTok / Reels 9:16 \u0E41\u0E2A\u0E07\u0E19\u0E35\u0E2D\u0E2D\u0E19\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19\u0E19\u0E49\u0E33\u0E1D\u0E19 \u0E01\u0E25\u0E49\u0E2D\u0E07 Tracking \u0E44\u0E27\u0E23\u0E31\u0E25",
    aspectRatio: "9:16",
    visualStyle: "3D Animation",
    defaultCharacterId: "char_fahsai_01",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  }
];
var initialJobs = [
  {
    id: "job_init_01",
    type: "image",
    status: "completed",
    progress: 100,
    stage: "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C",
    provider: "gemini",
    providerName: "Google Gemini (Nano Banana / Imagen)",
    isMock: true,
    // seeded demo/sample output, not a real generation
    model: "gemini-3.1-flash-lite-image",
    prompt: "\u0E1F\u0E49\u0E32\u0E43\u0E2A (Fahsai) \u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25\u0E42\u0E21\u0E40\u0E14\u0E34\u0E23\u0E4C\u0E19 \u0E2A\u0E27\u0E21\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E25\u0E34\u0E19\u0E34\u0E19\u0E2A\u0E35\u0E04\u0E23\u0E35\u0E21 \u0E22\u0E34\u0E49\u0E21\u0E2A\u0E14\u0E43\u0E2A\u0E43\u0E19\u0E04\u0E32\u0E40\u0E1F\u0E48 \u0E41\u0E2A\u0E07\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E16\u0E48\u0E32\u0E22\u0E14\u0E49\u0E27\u0E22\u0E40\u0E25\u0E19\u0E2A\u0E4C 85mm f/1.4",
    negativePrompt: "blurry, extra fingers, cartoon, low quality",
    aspectRatio: "1:1",
    outputUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1080&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    characterId: "char_fahsai_01",
    characterName: "\u0E1F\u0E49\u0E32\u0E43\u0E2A (Fahsai)",
    costCredits: 8,
    seed: 489214,
    createdAt: new Date(Date.now() - 36e5 * 6).toISOString(),
    completedAt: new Date(Date.now() - 36e5 * 6 + 12e3).toISOString()
  },
  {
    id: "job_init_02",
    type: "video",
    status: "completed",
    progress: 100,
    stage: "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C",
    provider: "gemini",
    providerName: "Google Veo Video Engine",
    isMock: true,
    // seeded demo/sample output, not a real generation
    model: "veo-3.1-lite-generate-preview",
    prompt: "\u0E01\u0E32\u0E19\u0E15\u0E4C\u0E40\u0E14\u0E34\u0E19\u0E16\u0E48\u0E32\u0E22\u0E20\u0E32\u0E1E\u0E23\u0E34\u0E21\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33\u0E40\u0E08\u0E49\u0E32\u0E1E\u0E23\u0E30\u0E22\u0E32 \u0E41\u0E2A\u0E07\u0E2A\u0E35\u0E2A\u0E49\u0E21\u0E22\u0E32\u0E21\u0E40\u0E0A\u0E49\u0E32 \u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E01\u0E25\u0E49\u0E2D\u0E07\u0E14\u0E2D\u0E25\u0E25\u0E35\u0E48\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E0A\u0E49\u0E32\u0E46 \u0E04\u0E27\u0E32\u0E21\u0E04\u0E21\u0E0A\u0E31\u0E14\u0E23\u0E30\u0E14\u0E31\u0E1A 1080p",
    negativePrompt: "jitter, low frame rate, blurry, artifacts",
    aspectRatio: "16:9",
    outputUrl: "/api/video-stream/job_init_02",
    thumbnailUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    characterId: "char_karn_02",
    characterName: "\u0E01\u0E32\u0E19\u0E15\u0E4C (Karn)",
    projectId: "proj_first_light_01",
    sceneId: "scene_02",
    sceneNumber: 2,
    costCredits: 35,
    seed: 129034,
    durationSeconds: 5,
    createdAt: new Date(Date.now() - 36e5 * 4).toISOString(),
    completedAt: new Date(Date.now() - 36e5 * 4 + 35e3).toISOString()
  },
  {
    id: "job_init_03",
    type: "image",
    status: "completed",
    progress: 100,
    stage: "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C",
    provider: "meta",
    providerName: "Meta Llama / Emu Vision",
    isMock: true,
    model: "emu-3-gen-v1",
    prompt: "\u0E41\u0E1F\u0E0A\u0E31\u0E48\u0E19\u0E2A\u0E15\u0E23\u0E35\u0E17\u0E2D\u0E32\u0E23\u0E4C\u0E15 9:16 \u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E01\u0E23\u0E38\u0E07\u0E40\u0E17\u0E1E\u0E2F \u0E44\u0E0B\u0E40\u0E1A\u0E2D\u0E23\u0E4C\u0E1B\u0E31\u0E07\u0E01\u0E4C \u0E2A\u0E35\u0E2A\u0E31\u0E19\u0E19\u0E35\u0E2D\u0E2D\u0E19\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19\u0E1E\u0E37\u0E49\u0E19\u0E16\u0E19\u0E19\u0E40\u0E1B\u0E35\u0E22\u0E01\u0E1D\u0E19 \u0E19\u0E32\u0E07\u0E41\u0E1A\u0E1A\u0E44\u0E17\u0E22\u0E22\u0E37\u0E19\u0E40\u0E14\u0E48\u0E19",
    negativePrompt: "monochrome, oversaturated, deformed eyes",
    aspectRatio: "9:16",
    outputUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1080&q=80",
    thumbnailUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80",
    costCredits: 10,
    seed: 948271,
    createdAt: new Date(Date.now() - 36e5 * 2).toISOString(),
    completedAt: new Date(Date.now() - 36e5 * 2 + 8e3).toISOString()
  }
];
initialJobs.forEach((job) => jobsStore.set(job.id, job));
var geminiClient = null;
function getGeminiClient(customApiKey) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!customApiKey && geminiClient) {
    return geminiClient;
  }
  const client = new import_genai.GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
  if (!customApiKey) {
    geminiClient = client;
  }
  return client;
}
function formatGenAIError(err) {
  if (!err) return "\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E17\u0E23\u0E32\u0E1A\u0E2A\u0E32\u0E40\u0E2B\u0E15\u0E38";
  const str = typeof err === "string" ? err : err.message || JSON.stringify(err);
  if (str.includes("429") || str.includes("quota") || str.includes("RESOURCE_EXHAUSTED")) {
    return "\u0E42\u0E04\u0E27\u0E15\u0E32 Google Veo / Gemini API \u0E02\u0E2D\u0E07\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E40\u0E15\u0E47\u0E21\u0E2B\u0E23\u0E37\u0E2D\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E34\u0E14\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 Paid Billing \u0E43\u0E19 Google AI Studio (429 Quota Exceeded / Billing Required)";
  }
  if (str.includes("403") || str.includes("PERMISSION_DENIED")) {
    return "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E40\u0E02\u0E49\u0E32\u0E16\u0E36\u0E07\u0E42\u0E21\u0E40\u0E14\u0E25 Google Veo \u0E2B\u0E23\u0E37\u0E2D\u0E04\u0E35\u0E22\u0E4C\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E40\u0E02\u0E49\u0E32\u0E16\u0E36\u0E07 (403 Permission Denied - \u0E08\u0E33\u0E40\u0E1B\u0E47\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E04\u0E35\u0E22\u0E4C\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E43\u0E0A\u0E49 Veo API)";
  }
  if (str.includes("404") || str.includes("NOT_FOUND")) {
    return "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E42\u0E21\u0E40\u0E14\u0E25 Google Veo \u0E1A\u0E19 API \u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19\u0E19\u0E35\u0E49 (404 Model Not Found)";
  }
  if (str.includes("Internal error") || str.includes("internal error") || str.includes("INTERNAL")) {
    return "\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C Google GenAI \u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E20\u0E32\u0E22\u0E43\u0E19 (Internal Server Error) \u0E2B\u0E23\u0E37\u0E2D\u0E0A\u0E37\u0E48\u0E2D\u0E42\u0E21\u0E40\u0E14\u0E25\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E30 Billing \u0E41\u0E25\u0E30 API Key";
  }
  try {
    const jsonStart = str.indexOf("{");
    if (jsonStart !== -1) {
      const parsed = JSON.parse(str.slice(jsonStart));
      if (parsed.error?.message) return parsed.error.message;
    }
  } catch {
  }
  return str;
}
async function saveGeneratedVideoToFile(ai, generatedVideo, targetFilePath) {
  const videoObj = generatedVideo?.video;
  if (!videoObj) {
    throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 Video \u0E43\u0E19\u0E1C\u0E25\u0E25\u0E31\u0E1E\u0E18\u0E4C\u0E08\u0E32\u0E01 Google Veo");
  }
  if (videoObj.videoBytes) {
    import_fs.default.writeFileSync(targetFilePath, Buffer.from(videoObj.videoBytes, "base64"));
    return;
  }
  if (videoObj.uri) {
    const apiKey = process.env.GEMINI_API_KEY || "";
    const headers = {};
    if (apiKey) {
      headers["x-goog-api-key"] = apiKey;
    }
    try {
      let downloadUrl = videoObj.uri;
      if (downloadUrl.startsWith("files/")) {
        downloadUrl = `https://generativelanguage.googleapis.com/v1beta/${videoObj.uri}:download?alt=media&key=${apiKey}`;
      }
      const res = await fetch(downloadUrl, { headers });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        import_fs.default.writeFileSync(targetFilePath, Buffer.from(arrayBuffer));
        if (import_fs.default.existsSync(targetFilePath) && import_fs.default.statSync(targetFilePath).size > 0) {
          return;
        }
      }
    } catch (fetchErr) {
      console.warn("Direct fetch of Veo video URI failed, trying SDK fallback:", fetchErr?.message || fetchErr);
    }
    try {
      await ai.files.download({
        file: videoObj.uri,
        downloadPath: targetFilePath
      });
      if (import_fs.default.existsSync(targetFilePath) && import_fs.default.statSync(targetFilePath).size > 0) {
        return;
      }
    } catch (sdkErr) {
      console.warn("ai.files.download fallback failed:", sdkErr?.message || sdkErr);
    }
  }
  throw new Error("\u0E1C\u0E25\u0E25\u0E31\u0E1E\u0E18\u0E4C\u0E08\u0E32\u0E01 Google Veo \u0E44\u0E21\u0E48\u0E21\u0E35\u0E17\u0E31\u0E49\u0E07 videoBytes \u0E41\u0E25\u0E30 uri \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14");
}
var GeminiProviderAdapter = class {
  constructor() {
    this.id = "gemini";
    this.name = "Google Gemini & Veo";
    this.badge = "Google AI Ecosystem";
    this.description = "\u0E42\u0E21\u0E40\u0E14\u0E25 Imagen 3 / Gemini \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E20\u0E32\u0E1E \u0E41\u0E25\u0E30 Google Veo \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E04\u0E38\u0E13\u0E20\u0E32\u0E1E\u0E2A\u0E39\u0E07";
    this.requiresKeyEnv = "GEMINI_API_KEY";
  }
  get hasKey() {
    return Boolean(process.env.GEMINI_API_KEY);
  }
  get isMockOnly() {
    return !this.hasKey;
  }
  estimateCost(params) {
    if (params.type === "video") {
      const dur = params.durationSeconds || 5;
      const credits = 30 + dur * 2;
      return {
        estimatedCredits: credits,
        approximateThb: Number((credits * 0.45).toFixed(2)),
        breakdown: `\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D Veo \u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27 ${dur} \u0E27\u0E34 (30 \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E1E\u0E37\u0E49\u0E19\u0E10\u0E32\u0E19 + ${dur * 2} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E40\u0E1F\u0E23\u0E21\u0E40\u0E23\u0E19\u0E40\u0E14\u0E2D\u0E23\u0E4C)`
      };
    } else {
      const credits = 8;
      return {
        estimatedCredits: credits,
        approximateThb: Number((credits * 0.45).toFixed(2)),
        breakdown: "\u0E20\u0E32\u0E1E\u0E04\u0E27\u0E32\u0E21\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E2A\u0E39\u0E07 Imagen 3 (8 \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15/\u0E20\u0E32\u0E1E)"
      };
    }
  }
  async generateImage(params, jobId) {
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E04\u0E35\u0E22\u0E4C GEMINI_API_KEY \u0E1A\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 API Key \u0E01\u0E48\u0E2D\u0E19\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E20\u0E32\u0E1E (GEMINI_API_KEY is not configured on the server)");
    }
    try {
      const promptText = buildEnrichedPrompt(params);
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-image",
        contents: {
          parts: [{ text: promptText }]
        },
        config: {
          imageConfig: {
            aspectRatio: params.aspectRatio === "9:16" ? "9:16" : params.aspectRatio === "16:9" ? "16:9" : "1:1"
          }
        }
      });
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || "image/png";
            return {
              outputUrl: `data:${mime};base64,${part.inlineData.data}`,
              isMock: false
            };
          }
        }
      }
      const finishReason = response.candidates?.[0]?.finishReason;
      throw new Error(`Gemini \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E2A\u0E48\u0E07\u0E20\u0E32\u0E1E\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32 (No image returned by Gemini${finishReason ? `, finishReason: ${finishReason}` : ""})`);
    } catch (err) {
      console.error("Gemini image generation failed:", err?.message || err);
      const msg = err?.message || String(err);
      if (msg.startsWith("Gemini \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E2A\u0E48\u0E07\u0E20\u0E32\u0E1E\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32")) throw err;
      throw new Error(`Gemini Image API: ${formatGenAIError(err)}`);
    }
  }
  async generateVideo(params, jobId, updateProgress) {
    const ai = getGeminiClient();
    if (!ai) {
      throw new Error("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E04\u0E35\u0E22\u0E4C GEMINI_API_KEY \u0E1A\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 API Key \u0E01\u0E48\u0E2D\u0E19\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 Google Veo");
    }
    const promptText = buildEnrichedPrompt(params);
    let inputImage;
    if (params.referenceImages && params.referenceImages.length > 0) {
      const ref = params.referenceImages[0];
      if (ref.startsWith("data:")) {
        const match = ref.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          inputImage = {
            mimeType: match[1],
            imageBytes: match[2]
          };
        }
      }
    }
    let modelName = "veo-3.1-lite-generate-preview";
    if (params.model && (params.model.includes("veo") || params.model.startsWith("veo-"))) {
      modelName = params.model;
    }
    const targetAspectRatio = params.aspectRatio === "9:16" ? "9:16" : "16:9";
    const videoConfig = {
      numberOfVideos: 1,
      resolution: "720p",
      aspectRatio: targetAspectRatio
    };
    const generatePayload = {
      model: modelName,
      prompt: promptText,
      config: videoConfig
    };
    if (inputImage) {
      generatePayload.image = inputImage;
    }
    updateProgress(15, `\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E41\u0E25\u0E30\u0E2A\u0E48\u0E07\u0E04\u0E33\u0E02\u0E2D\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E44\u0E1B\u0E22\u0E31\u0E07 Google Veo (${modelName})...`);
    let operation;
    try {
      operation = await ai.models.generateVideos(generatePayload);
    } catch (apiErr) {
      console.error("Google Veo generateVideos call failed:", apiErr);
      const friendlyErr = formatGenAIError(apiErr);
      throw new Error(`Google Veo API: ${friendlyErr}`);
    }
    if (!operation || !operation.name) {
      throw new Error("Google Veo API \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E2A\u0E48\u0E07\u0E04\u0E37\u0E19 Operation \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D");
    }
    const opId = operation.name.split("/").pop() || operation.name;
    updateProgress(25, `Google Veo \u0E01\u0E33\u0E25\u0E31\u0E07\u0E2A\u0E31\u0E07\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D (Operation: ${opId})...`);
    const pollStartTime = Date.now();
    let currentOp = operation;
    while (!currentOp.done) {
      await delay(5e3);
      try {
        currentOp = await ai.operations.getVideosOperation({ operation: { name: currentOp.name } });
      } catch (pollErr) {
        console.warn("Veo polling error:", pollErr?.message || pollErr);
      }
      const elapsedSec = Math.round((Date.now() - pollStartTime) / 1e3);
      const calculatedProg = Math.min(92, 25 + Math.floor(elapsedSec * 0.9));
      const stageDesc = calculatedProg < 45 ? `Google Veo \u0E01\u0E33\u0E25\u0E31\u0E07\u0E04\u0E33\u0E19\u0E27\u0E13\u0E01\u0E32\u0E23\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27\u0E41\u0E25\u0E30\u0E17\u0E34\u0E28\u0E17\u0E32\u0E07\u0E41\u0E2A\u0E07 (${elapsedSec}s)...` : calculatedProg < 75 ? `Google Veo \u0E01\u0E33\u0E25\u0E31\u0E07\u0E2A\u0E31\u0E07\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E41\u0E25\u0E30\u0E40\u0E23\u0E19\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E40\u0E1F\u0E23\u0E21\u0E04\u0E27\u0E32\u0E21\u0E04\u0E21\u0E0A\u0E31\u0E14\u0E2A\u0E39\u0E07 (${elapsedSec}s)...` : `Google Veo \u0E01\u0E33\u0E25\u0E31\u0E07\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E41\u0E25\u0E30\u0E1B\u0E23\u0E30\u0E21\u0E27\u0E25\u0E1C\u0E25 H.264 (${elapsedSec}s)...`;
      updateProgress(calculatedProg, stageDesc);
      if (elapsedSec > 600) {
        throw new Error("Google Veo \u0E43\u0E0A\u0E49\u0E40\u0E27\u0E25\u0E32\u0E1B\u0E23\u0E30\u0E21\u0E27\u0E25\u0E1C\u0E25\u0E19\u0E32\u0E19\u0E40\u0E01\u0E34\u0E19\u0E01\u0E33\u0E2B\u0E19\u0E14 (Timeout 10 \u0E19\u0E32\u0E17\u0E35)");
      }
    }
    if (currentOp.error) {
      const errMsg = currentOp.error?.message || JSON.stringify(currentOp.error);
      throw new Error(`Google Veo Operation \u0E25\u0E49\u0E21\u0E40\u0E2B\u0E25\u0E27: ${formatGenAIError(errMsg)}`);
    }
    if (currentOp.response?.raiMediaFilteredReasons && currentOp.response.raiMediaFilteredReasons.length > 0) {
      throw new Error(`Google Veo \u0E1B\u0E0F\u0E34\u0E40\u0E2A\u0E18\u0E01\u0E32\u0E23\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E08\u0E32\u0E01\u0E19\u0E42\u0E22\u0E1A\u0E32\u0E22\u0E04\u0E27\u0E32\u0E21\u0E1B\u0E25\u0E2D\u0E14\u0E20\u0E31\u0E22 (RAI Filter): ${currentOp.response.raiMediaFilteredReasons.join(", ")}`);
    }
    const generatedVideos = currentOp.response?.generatedVideos;
    if (!generatedVideos || generatedVideos.length === 0) {
      throw new Error("Google Veo \u0E1B\u0E23\u0E30\u0E21\u0E27\u0E25\u0E1C\u0E25\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E34\u0E49\u0E19\u0E41\u0E15\u0E48\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E43\u0E19\u0E1C\u0E25\u0E25\u0E31\u0E1E\u0E18\u0E4C");
    }
    updateProgress(95, "Google Veo \u0E40\u0E23\u0E19\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C \u0E01\u0E33\u0E25\u0E31\u0E07\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14\u0E41\u0E25\u0E30\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E1F\u0E25\u0E4C MP4 \u0E25\u0E07\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C...");
    const generatedDir = import_path.default.join(process.cwd(), "public", "generated-videos");
    if (!import_fs.default.existsSync(generatedDir)) {
      import_fs.default.mkdirSync(generatedDir, { recursive: true });
    }
    const localFilePath = import_path.default.join(generatedDir, `${jobId}.mp4`);
    await saveGeneratedVideoToFile(ai, generatedVideos[0], localFilePath);
    if (!import_fs.default.existsSync(localFilePath) || import_fs.default.statSync(localFilePath).size === 0) {
      throw new Error("\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E44\u0E1F\u0E25\u0E4C MP4 \u0E08\u0E32\u0E01 Google Veo \u0E25\u0E07\u0E1A\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E44\u0E14\u0E49 (\u0E44\u0E1F\u0E25\u0E4C\u0E27\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E25\u0E48\u0E32)");
    }
    updateProgress(100, "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E14\u0E49\u0E27\u0E22 Google Veo \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E25\u0E48\u0E19\u0E41\u0E25\u0E30\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14 MP4");
    return {
      outputUrl: `/api/video-stream/${jobId}`,
      isMock: false
    };
  }
};
function providerNotAvailableError(providerName, keyEnv, hasKey) {
  if (!hasKey) {
    return new Error(`\u0E1C\u0E39\u0E49\u0E43\u0E2B\u0E49\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23 ${providerName} \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 ${keyEnv} \u0E1A\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C (${keyEnv} is not configured). \u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01 Google Gemini \u0E2B\u0E23\u0E37\u0E2D\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 API Key`);
  }
  return new Error(`\u0E1C\u0E39\u0E49\u0E43\u0E2B\u0E49\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23 ${providerName} \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E23\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E08\u0E23\u0E34\u0E07\u0E43\u0E19\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19\u0E19\u0E35\u0E49 (real API integration not implemented). \u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01 Google Gemini`);
}
var MetaProviderAdapter = class {
  constructor() {
    this.id = "meta";
    this.name = "Meta Llama / Emu";
    this.badge = "Meta AI Research Architecture";
    this.description = "\u0E2A\u0E16\u0E32\u0E1B\u0E31\u0E15\u0E22\u0E01\u0E23\u0E23\u0E21 Meta Emu 3 \u0E41\u0E25\u0E30 Llama Multimodal \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E23\u0E19\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E20\u0E32\u0E1E\u0E04\u0E27\u0E32\u0E21\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E2A\u0E39\u0E07\u0E41\u0E25\u0E30\u0E2A\u0E15\u0E2D\u0E23\u0E35\u0E48\u0E1A\u0E2D\u0E23\u0E4C\u0E14";
    this.requiresKeyEnv = "META_API_KEY";
  }
  get hasKey() {
    return Boolean(process.env.META_API_KEY);
  }
  get isMockOnly() {
    return !this.hasKey;
  }
  estimateCost(params) {
    if (params.type === "video") {
      const dur = params.durationSeconds || 5;
      const credits = 35 + dur * 2;
      return {
        estimatedCredits: credits,
        approximateThb: Number((credits * 0.45).toFixed(2)),
        breakdown: `Meta Movie Gen (35 \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 + ${dur * 2} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27)`
      };
    } else {
      const credits = 10;
      return {
        estimatedCredits: credits,
        approximateThb: Number((credits * 0.45).toFixed(2)),
        breakdown: "Meta Emu 3 Generation (10 \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15/\u0E20\u0E32\u0E1E)"
      };
    }
  }
  async generateImage(params, jobId) {
    throw providerNotAvailableError(this.name, this.requiresKeyEnv, this.hasKey);
  }
  async generateVideo(params, jobId, updateProgress) {
    throw providerNotAvailableError(this.name, this.requiresKeyEnv, this.hasKey);
  }
};
var XaiProviderAdapter = class {
  constructor() {
    this.id = "xai";
    this.name = "xAI / Grok Vision";
    this.badge = "xAI Real-time Engine";
    this.description = "\u0E2A\u0E16\u0E32\u0E1B\u0E31\u0E15\u0E22\u0E01\u0E23\u0E23\u0E21 Grok Aurora \u0E41\u0E25\u0E30 Grok Imagine \u0E40\u0E19\u0E49\u0E19\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E21\u0E08\u0E23\u0E34\u0E07\u0E41\u0E25\u0E30\u0E44\u0E14\u0E19\u0E32\u0E21\u0E34\u0E01\u0E20\u0E32\u0E1E\u0E2A\u0E39\u0E07";
    this.requiresKeyEnv = "XAI_API_KEY";
  }
  get hasKey() {
    return Boolean(process.env.XAI_API_KEY);
  }
  get isMockOnly() {
    return !this.hasKey;
  }
  estimateCost(params) {
    if (params.type === "video") {
      const dur = params.durationSeconds || 5;
      const credits = 32 + dur * 2;
      return {
        estimatedCredits: credits,
        approximateThb: Number((credits * 0.45).toFixed(2)),
        breakdown: `xAI Grok Motion (${credits} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15)`
      };
    } else {
      const credits = 9;
      return {
        estimatedCredits: credits,
        approximateThb: Number((credits * 0.45).toFixed(2)),
        breakdown: "xAI Grok Imagine (9 \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15/\u0E20\u0E32\u0E1E)"
      };
    }
  }
  async generateImage(params, jobId) {
    throw providerNotAvailableError(this.name, this.requiresKeyEnv, this.hasKey);
  }
  async generateVideo(params, jobId, updateProgress) {
    throw providerNotAvailableError(this.name, this.requiresKeyEnv, this.hasKey);
  }
};
var MockProviderAdapter = class {
  constructor() {
    this.id = "mock";
    this.name = "\u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D Simulator";
    this.badge = "Mock / Sandbox Mode";
    this.description = "\u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E33\u0E25\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E20\u0E32\u0E1E\u0E41\u0E25\u0E30\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E17\u0E14\u0E2A\u0E2D\u0E1A UI, \u0E15\u0E23\u0E23\u0E01\u0E30\u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01 \u0E41\u0E25\u0E30\u0E2A\u0E16\u0E32\u0E1B\u0E31\u0E15\u0E22\u0E01\u0E23\u0E23\u0E21 (\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19\u0E27\u0E48\u0E32\u0E40\u0E1B\u0E47\u0E19 Mock)";
    this.requiresKeyEnv = "\u0E44\u0E21\u0E48\u0E21\u0E35 (\u0E1F\u0E23\u0E35)";
    this.hasKey = true;
    this.isMockOnly = true;
  }
  estimateCost(params) {
    const credits = params.type === "video" ? 15 : 2;
    return {
      estimatedCredits: credits,
      approximateThb: 0,
      breakdown: `\u0E42\u0E2B\u0E21\u0E14\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E08\u0E33\u0E25\u0E2D\u0E07 Mock Sandbox (${credits} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E08\u0E33\u0E25\u0E2D\u0E07 - \u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E48\u0E32\u0E43\u0E0A\u0E49\u0E08\u0E48\u0E32\u0E22\u0E08\u0E23\u0E34\u0E07)`
    };
  }
  async generateImage(params, jobId) {
    await delay(1200);
    const randomImg = SAMPLE_IMAGE_OUTPUTS[Math.floor(Math.random() * SAMPLE_IMAGE_OUTPUTS.length)];
    return { outputUrl: randomImg, isMock: true };
  }
  async generateVideo(params, jobId, updateProgress) {
    await simulateVideoStages(updateProgress, "Sala Simulator Pipeline");
    const randomVideo = SAMPLE_VIDEO_OUTPUTS[Math.floor(Math.random() * SAMPLE_VIDEO_OUTPUTS.length)];
    return { outputUrl: randomVideo, isMock: true };
  }
};
var ProviderManager = class {
  constructor() {
    this.adapters = /* @__PURE__ */ new Map();
    this.register(new GeminiProviderAdapter());
    this.register(new MetaProviderAdapter());
    this.register(new XaiProviderAdapter());
    this.register(new MockProviderAdapter());
  }
  register(adapter) {
    this.adapters.set(adapter.id, adapter);
  }
  // Lenient lookup used for labels / cost estimates only (unknown ids default to Gemini, never to mock).
  get(providerId) {
    return this.adapters.get(providerId) || this.adapters.get("gemini");
  }
  // Strict lookup used for actual generation: unknown providers are rejected.
  find(providerId) {
    return providerId ? this.adapters.get(providerId) : void 0;
  }
  listProviders() {
    return Array.from(this.adapters.values()).map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
      badge: adapter.badge,
      description: adapter.description,
      isMock: adapter.isMockOnly,
      isAvailable: true,
      requiresKeyEnv: adapter.requiresKeyEnv,
      hasServerKey: adapter.hasKey,
      supportedMedia: ["image", "video"],
      models: [
        {
          id: `${adapter.id}-standard`,
          name: `${adapter.name} Standard`,
          description: "\u0E04\u0E27\u0E32\u0E21\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E21\u0E32\u0E15\u0E23\u0E10\u0E32\u0E19 \u0E2A\u0E21\u0E14\u0E38\u0E25\u0E04\u0E27\u0E32\u0E21\u0E40\u0E23\u0E47\u0E27\u0E41\u0E25\u0E30\u0E04\u0E27\u0E32\u0E21\u0E41\u0E21\u0E48\u0E19\u0E22\u0E33",
          costPerImage: adapter.estimateCost({ type: "image", provider: adapter.id, model: "", prompt: "", aspectRatio: "1:1" }).estimatedCredits,
          costPerVideoSec: 6
        },
        {
          id: `${adapter.id}-ultra`,
          name: `${adapter.name} Ultra Cinematic`,
          description: "\u0E04\u0E38\u0E13\u0E20\u0E32\u0E1E\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E07\u0E32\u0E19\u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C\u0E41\u0E25\u0E30\u0E2A\u0E15\u0E2D\u0E23\u0E35\u0E48\u0E1A\u0E2D\u0E23\u0E4C\u0E14",
          costPerImage: adapter.estimateCost({ type: "image", provider: adapter.id, model: "", prompt: "", aspectRatio: "1:1" }).estimatedCredits + 4,
          costPerVideoSec: 8
        }
      ]
    }));
  }
};
var providerManager = new ProviderManager();
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function buildEnrichedPrompt(params) {
  let prompt = params.prompt;
  if (params.characterId) {
    const char = charactersStore.find((c) => c.id === params.characterId);
    if (char) {
      const parts = [];
      if (char.triggerTag) parts.push(char.triggerTag.trim());
      if (char.description) parts.push(char.description.trim());
      if (char.outfitDescription && char.outfitDescription.trim()) {
        parts.push(`Outfit: ${char.outfitDescription.trim()}`);
      }
      const charAnchor = parts.filter(Boolean).join(". ");
      if (charAnchor) {
        prompt = `${charAnchor}. ${prompt}`;
      }
    }
  }
  prompt += `. Aspect ratio: ${params.aspectRatio}. High quality, photographic composition, clean studio render.`;
  if (params.negativePrompt) {
    prompt += ` Avoid: ${params.negativePrompt}`;
  }
  return prompt;
}
async function simulateVideoStages(updateProgress, engineName = "Neural Video Pipeline") {
  const steps = [
    { p: 10, stage: `[${engineName}] \u0E40\u0E23\u0E34\u0E48\u0E21\u0E08\u0E31\u0E14\u0E04\u0E34\u0E27\u0E41\u0E25\u0E30\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C Prompt / Reference...` },
    { p: 25, stage: `[${engineName}] \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Character Consistency \u0E41\u0E25\u0E30 Scene Continuity...` },
    { p: 45, stage: `[${engineName}] \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E04\u0E35\u0E22\u0E4C\u0E40\u0E1F\u0E23\u0E21\u0E41\u0E25\u0E30\u0E04\u0E33\u0E19\u0E27\u0E13\u0E01\u0E32\u0E23\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27\u0E40\u0E0A\u0E34\u0E07\u0E1E\u0E37\u0E49\u0E19\u0E17\u0E35\u0E48 (Spatial-Temporal Keyframes)...` },
    { p: 68, stage: `[${engineName}] \u0E01\u0E23\u0E30\u0E1A\u0E27\u0E19\u0E01\u0E32\u0E23 Diffusion Denoising \u0E01\u0E33\u0E25\u0E31\u0E07\u0E1B\u0E23\u0E30\u0E21\u0E27\u0E25\u0E1C\u0E25\u0E40\u0E1F\u0E23\u0E21\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D...` },
    { p: 85, stage: `[${engineName}] \u0E40\u0E01\u0E25\u0E35\u0E48\u0E22\u0E41\u0E2A\u0E07\u0E41\u0E25\u0E30\u0E1B\u0E23\u0E31\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E02\u0E2D\u0E07\u0E43\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23...` },
    { p: 95, stage: `[${engineName}] \u0E1A\u0E35\u0E1A\u0E2D\u0E31\u0E14\u0E41\u0E25\u0E30\u0E40\u0E2D\u0E47\u0E01\u0E0B\u0E4C\u0E1E\u0E2D\u0E23\u0E4C\u0E15\u0E44\u0E1F\u0E25\u0E4C MP4 1080p H.264...` }
  ];
  for (const step of steps) {
    updateProgress(step.p, step.stage);
    await delay(1100);
  }
}
function processJobInBackground(jobId, params) {
  const job = jobsStore.get(jobId);
  if (!job) return;
  const adapter = providerManager.find(params.provider);
  (async () => {
    try {
      if (!adapter) {
        throw new Error(`\u0E44\u0E21\u0E48\u0E23\u0E39\u0E49\u0E08\u0E31\u0E01\u0E1C\u0E39\u0E49\u0E43\u0E2B\u0E49\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23 "${params.provider}" (Unknown provider)`);
      }
      job.status = "processing";
      job.progress = 10;
      job.stage = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21\u0E42\u0E21\u0E40\u0E14\u0E25\u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25 Reference...";
      jobsStore.set(jobId, job);
      let result;
      if (params.type === "video") {
        result = await adapter.generateVideo(params, jobId, (prog, stage) => {
          const current = jobsStore.get(jobId);
          if (current) {
            current.progress = prog;
            current.stage = stage;
            jobsStore.set(jobId, current);
          }
        });
      } else {
        job.progress = 35;
        job.stage = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E2A\u0E48\u0E07\u0E44\u0E1B\u0E22\u0E31\u0E07\u0E42\u0E21\u0E40\u0E14\u0E25\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E20\u0E32\u0E1E...";
        jobsStore.set(jobId, job);
        result = await adapter.generateImage(params, jobId);
        job.progress = 85;
        job.stage = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E20\u0E32\u0E1E\u0E1C\u0E25\u0E25\u0E31\u0E1E\u0E18\u0E4C\u0E41\u0E25\u0E30\u0E2A\u0E23\u0E49\u0E32\u0E07 Thumbnail...";
        jobsStore.set(jobId, job);
        await delay(500);
      }
      job.status = "completed";
      job.progress = 100;
      job.stage = "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C (\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14)";
      const finalUrl = params.type === "video" ? `/api/video-stream/${jobId}` : result.outputUrl;
      job.outputUrl = finalUrl;
      job.thumbnailUrl = result.outputUrl;
      job.isMock = result.isMock;
      job.completedAt = (/* @__PURE__ */ new Date()).toISOString();
      jobsStore.set(jobId, job);
      if (params.projectId && params.sceneId) {
        const proj = projectsStore.find((p) => p.id === params.projectId);
        if (proj) {
          const scene = proj.scenes.find((s) => s.id === params.sceneId);
          if (scene) {
            scene.status = "completed";
            scene.outputJobId = jobId;
            scene.outputUrl = finalUrl;
            proj.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          }
        }
      }
    } catch (err) {
      console.warn(`Error processing job ${jobId} via ${params.provider}, falling back to Mock Simulator:`, err?.message || err);
      try {
        const mockAdapter = providerManager.find("mock") || providerManager.list()[0];
        if (mockAdapter && params.provider !== "mock") {
          job.stage = "\u0E01\u0E33\u0E25\u0E31\u0E07\u0E08\u0E33\u0E25\u0E2D\u0E07\u0E1C\u0E25\u0E25\u0E31\u0E1E\u0E18\u0E4C\u0E1C\u0E48\u0E32\u0E19 Sala AI Simulator...";
          jobsStore.set(jobId, job);
          let mockRes;
          if (params.type === "video") {
            mockRes = await mockAdapter.generateVideo(params, jobId, (prog, stage) => {
              const current = jobsStore.get(jobId);
              if (current) {
                current.progress = prog;
                current.stage = stage;
                jobsStore.set(jobId, current);
              }
            });
          } else {
            mockRes = await mockAdapter.generateImage(params, jobId);
          }
          job.status = "completed";
          job.progress = 100;
          job.stage = "\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C (\u0E42\u0E2B\u0E21\u0E14\u0E08\u0E33\u0E25\u0E2D\u0E07 Mock Simulator)";
          const finalUrl = params.type === "video" ? `/api/video-stream/${jobId}` : mockRes.outputUrl;
          job.outputUrl = finalUrl;
          job.thumbnailUrl = mockRes.outputUrl;
          job.isMock = true;
          job.completedAt = (/* @__PURE__ */ new Date()).toISOString();
          jobsStore.set(jobId, job);
          if (params.projectId && params.sceneId) {
            const proj = projectsStore.find((p) => p.id === params.projectId);
            const scene = proj?.scenes.find((s) => s.id === params.sceneId);
            if (scene) {
              scene.status = "completed";
              scene.outputJobId = jobId;
              scene.outputUrl = finalUrl;
            }
          }
          return;
        }
      } catch (fallbackErr) {
        console.error("Mock fallback error:", fallbackErr);
      }
      job.status = "failed";
      job.progress = 0;
      job.stage = "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (Generation failed)";
      job.error = err?.message || "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1C\u0E25\u0E07\u0E32\u0E19\u0E44\u0E14\u0E49";
      job.outputUrl = void 0;
      job.thumbnailUrl = void 0;
      jobsStore.set(jobId, job);
      if (params.projectId && params.sceneId) {
        const proj = projectsStore.find((p) => p.id === params.projectId);
        const scene = proj?.scenes.find((s) => s.id === params.sceneId);
        if (scene && scene.status !== "completed") {
          scene.status = "draft";
        }
      }
      const refundAccount = job.userId && creditAccountsStore.get(job.userId) || currentUserAccount;
      refundAccount.remainingCredits += job.costCredits;
      if (refundAccount !== currentUserAccount) {
        refundAccount.totalUsedCredits = Math.max(0, refundAccount.totalUsedCredits - job.costCredits);
        refundAccount.dailyUsedCredits = Math.max(0, refundAccount.dailyUsedCredits - job.costCredits);
        refundAccount.monthlyUsedCredits = Math.max(0, refundAccount.monthlyUsedCredits - job.costCredits);
      }
      refundAccount.transactions.unshift({
        id: `refund_${Date.now()}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        amount: job.costCredits,
        type: "refund",
        description: `\u0E04\u0E37\u0E19\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E08\u0E32\u0E01\u0E01\u0E32\u0E23\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (\u0E07\u0E32\u0E19: ${job.id})`,
        jobId: job.id,
        balanceAfter: refundAccount.remainingCredits
      });
    }
  })();
}
app.get("/api/providers", (req, res) => {
  res.json({
    success: true,
    providers: providerManager.listProviders(),
    serverEnvKeys: {
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasMetaKey: Boolean(process.env.META_API_KEY),
      hasXaiKey: Boolean(process.env.XAI_API_KEY)
    }
  });
});
app.post("/api/estimate-cost", (req, res) => {
  const params = req.body;
  const adapter = providerManager.get(params.provider || "gemini");
  const baseEstimate = adapter.estimateCost(params);
  const apiCredits = baseEstimate.estimatedCredits;
  const serviceFee = pricingConfig.serviceFeeType === "fixed" ? pricingConfig.serviceFeeValue : Math.ceil(apiCredits * (pricingConfig.serviceFeeValue / 100));
  const totalCredits = apiCredits + serviceFee;
  const approximateThb = Number((totalCredits * 0.35).toFixed(2));
  const canAfford = currentUserAccount.remainingCredits >= totalCredits;
  const breakdown = `\u0E15\u0E49\u0E19\u0E17\u0E38\u0E19 API \u0E08\u0E23\u0E34\u0E07: ${apiCredits} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 | \u0E04\u0E48\u0E32\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23 Sala AI (${pricingConfig.serviceFeeType === "fixed" ? `${pricingConfig.serviceFeeValue} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E04\u0E07\u0E17\u0E35\u0E48` : `${pricingConfig.serviceFeeValue}%`}): ${serviceFee} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 | \u0E22\u0E2D\u0E14\u0E23\u0E27\u0E21: ${totalCredits} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 (\u0E1B\u0E23\u0E30\u0E21\u0E32\u0E13 ${approximateThb} \u0E1A\u0E32\u0E17)`;
  res.json({
    success: true,
    estimate: {
      estimatedApiCredits: apiCredits,
      serviceFeeCredits: serviceFee,
      totalCredits,
      approximateThb,
      breakdown,
      canAfford,
      copyPromptFee: pricingConfig.copyPromptFee
    },
    userCredits: {
      remaining: currentUserAccount.remainingCredits,
      dailyUsed: currentUserAccount.dailyUsedCredits,
      dailyLimit: currentUserAccount.dailyLimit,
      monthlyUsed: currentUserAccount.monthlyUsedCredits,
      monthlyLimit: currentUserAccount.monthlyLimit
    }
  });
});
app.post("/api/director/generate-multi-clip-prompts", requireAuth, async (req, res) => {
  try {
    const {
      scriptText,
      clipDurationSeconds = 10,
      clipCount = 3,
      continuityLock = {},
      dialogues = [],
      audioDirectives = {},
      apiKey,
      offline = false,
      characters = [],
      locations = []
    } = req.body;
    if (!scriptText || typeof scriptText !== "string" || scriptText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E23\u0E37\u0E2D\u0E04\u0E33\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E09\u0E32\u0E01 (Script / Storyboard text)"
      });
    }
    const count = Math.max(1, Math.min(10, Number(clipCount) || 3));
    const duration = Math.max(3, Math.min(30, Number(clipDurationSeconds) || 10));
    const libraryChars = markMissingUploadReferences(Array.isArray(characters) ? characters : []);
    const libraryLocs = Array.isArray(locations) ? markMissingUploadReferences(locations.filter((l) => l && l.name)) : void 0;
    const locationLockOpts = {
      selectedLocationId: continuityLock?.locationId || void 0,
      lockedLocation: continuityLock?.location || void 0,
      timeOfDay: continuityLock?.timeOfDay || void 0,
      lighting: continuityLock?.lighting || void 0
    };
    const sanitizedDialogues = Array.isArray(dialogues) ? dialogues.filter((d) => d && d.speaker && !isReservedSystemKeyword(d.speaker)) : [];
    const lockedNames = Array.from(new Set([
      ...expandCombinedCharacterNames([String(continuityLock?.characterName || "")]),
      ...expandCombinedCharacterNames(Array.isArray(continuityLock?.characterNames) ? continuityLock.characterNames : []),
      ...sanitizedDialogues.map((d) => String(d.speaker || ""))
    ].map((n) => n.trim()).filter((n) => n && !isReservedSystemKeyword(n) && !isMetadataKeyword(n))));
    if (offline === true) {
      const offlineClips = buildSalaMultiClipPrompts({
        scriptText,
        clipDurationSeconds: duration,
        clipCount: count,
        continuityLock,
        dialogues: sanitizedDialogues,
        audioDirectives,
        knownCharacters: lockedNames,
        characters: libraryChars,
        locations: libraryLocs
      });
      return res.json({
        success: true,
        source: "deterministic",
        offline: true,
        clips: offlineClips,
        autoSplit: summarizeAutoSplit(offlineClips, count),
        validation: validateSalaMultiClipPrompts(offlineClips, lockedNames)
      });
    }
    const userKey = typeof apiKey === "string" ? apiKey.trim() : "";
    const ai = getGeminiClient(userKey || void 0);
    if (!ai) {
      return res.status(400).json({
        success: false,
        code: "GEMINI_KEY_MISSING",
        message: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 Gemini API Key \u0E01\u0E23\u0E38\u0E13\u0E32\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 API Key \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E41\u0E1A\u0E1A\u0E2D\u0E2D\u0E1F\u0E44\u0E25\u0E19\u0E4C / No Gemini API key is configured. Save your key or choose offline mode."
      });
    }
    let clips = null;
    const source = "gemini-ai";
    {
      try {
        {
          const promptInstruction = `You are the Lead Visual Director for high-end cinematic AI video continuity.
Analyze the following script/scene in Thai, split it into exactly ${count} continuous, sequential video clips of ${duration} seconds each.

CRITICAL PROTOCOL & RESERVED KEYWORDS RULES:
- The following words are RESERVED SYSTEM KEYWORDS: LOCK, CONT, FRAME, AUTO, RULE, NO, OUT, STORY, CHARACTERS, END, SALA_MULTI_CLIP
- NEVER interpret any RESERVED SYSTEM KEYWORD as a character name, speaker name, or actor.
- NEVER output "[DIALOGUE_LOCK: LOCK says]" or similar invalid tags.
- Characters and speakers must be actual narrative persona names.

CRITICAL CONTINUITY DIRECTIVES (MASTER CONTINUITY LOCK):
- Character Lock: ${continuityLock.characterName || ""} | Appearance & Costume: ${continuityLock.characterAppearance || ""}
- Location Lock: ${continuityLock.location || ""}
- Time & Lighting Lock: ${continuityLock.timeOfDay || ""}, Lighting: ${continuityLock.lighting || ""}
- Visual Style Lock: ${continuityLock.visualStyle || "Photorealistic 8K, 35mm film"}
- Aspect Ratio: ${continuityLock.aspectRatio || "16:9"}
- Camera & Lens: Movement: ${continuityLock.cameraMovement || "Cinematic tracking"}, Lens: ${continuityLock.lensType || "35mm anamorphic"}
- Props Lock: ${continuityLock.props || ""}
- Spatial Anchor: ${continuityLock.characterPosition || ""}
- Action Momentum Continuity: The starting action of Clip N MUST seamlessly and directly continue from the ending frame and momentum of Clip N-1.
- POSE HANDOFF: For every clip list the characters present and each character's start pose and end pose (posture: standing | sitting | lying | kneeling | walking, plus where, e.g. "at the front door", "on the bench"). The startPoses of Clip N MUST equal the endPoses of Clip N-1 unless the script explicitly says the character moves (stands up, sits down, walks to ...).
- CHARACTER PRESENCE: A locked character who is in the scene must stay in every following clip until the script says they leave. Put leaving characters in "charactersLeft".
- LOCATION LOCK: use the same location name and ONE identical lighting description in every clip at that location. Scene headings that are titles or moods (e.g. "\u0E2D\u0E32\u0E23\u0E21\u0E13\u0E4C\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E36\u0E07\u0E40\u0E04\u0E23\u0E35\u0E22\u0E14", "\u0E04\u0E37\u0E19\u0E14\u0E35\u0E01\u0E31\u0E19") or "\u2026\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07" are NOT new locations.
${buildLockedContinuityContext(continuityLock, characters, locations)}

DIALOGUE LOCK:
${sanitizedDialogues.length > 0 ? `Strictly bind dialogues verbatim to matching clips in Thai. Do NOT change speaker or wording:
` + sanitizedDialogues.map((d) => `- [${d.speaker}]: "${d.line}" (Tone: ${d.emotionTone || "natural"}, Clip: ${d.clipNumber || "auto"})`).join("\n") : 'If characters speak, output [DIALOGUE_LOCK: Speaker says: "Thai dialogue"] with a real character name'}

AUDIO DIRECTIVES:
- Voice: ${audioDirectives?.voice?.enabled ? `Enabled (${audioDirectives.voice.voiceType}, ${audioDirectives.voice.accent}, ${audioDirectives.voice.emotion})` : "Disabled"}
- Music: ${audioDirectives?.music?.enabled ? `Enabled (${audioDirectives.music.genre}, ${audioDirectives.music.tempo}, ${audioDirectives.music.mood})` : "Disabled"}
- SFX: ${audioDirectives?.sfx?.enabled ? `Enabled (Ambience: ${audioDirectives.sfx.ambientSounds}, Foley: ${audioDirectives.sfx.foleyActions})` : "Disabled"}

SCRIPT TEXT:
"""
${scriptText}
"""

OUTPUT FORMAT:
Respond ONLY with a JSON array containing exactly ${count} objects (no markdown blocks, no code formatting):
[
  {
    "clipNumber": 1,
    "title": "\u0E0A\u0E37\u0E48\u0E2D\u0E09\u0E32\u0E01\u0E2A\u0E31\u0E49\u0E19\u0E46 \u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22",
    "durationSeconds": ${duration},
    "sceneSummary": "\u0E2A\u0E23\u0E38\u0E1B\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E19\u0E35\u0E49\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22",
    "startAction": "\u0E01\u0E32\u0E23\u0E01\u0E23\u0E30\u0E17\u0E33\u0E41\u0E25\u0E30\u0E21\u0E38\u0E21\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E19\u0E35\u0E49",
    "endAction": "\u0E01\u0E32\u0E23\u0E01\u0E23\u0E30\u0E17\u0E33\u0E41\u0E25\u0E30\u0E21\u0E38\u0E21\u0E01\u0E25\u0E49\u0E2D\u0E07\u0E08\u0E38\u0E14\u0E08\u0E1A\u0E17\u0E35\u0E48\u0E2A\u0E48\u0E07\u0E15\u0E48\u0E2D\u0E42\u0E21\u0E40\u0E21\u0E19\u0E15\u0E31\u0E21\u0E43\u0E2B\u0E49\u0E04\u0E25\u0E34\u0E1B\u0E16\u0E31\u0E14\u0E44\u0E1B",
    "dialogues": [
      { "id": "d1", "speaker": "\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E08\u0E23\u0E34\u0E07 (\u0E2B\u0E49\u0E32\u0E21\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E2A\u0E07\u0E27\u0E19)", "line": "\u0E1A\u0E17\u0E1E\u0E39\u0E14\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22\u0E15\u0E23\u0E07\u0E15\u0E31\u0E27", "emotionTone": "\u0E2D\u0E32\u0E23\u0E21\u0E13\u0E4C" }
    ],
    "charactersPresent": ["\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E04\u0E25\u0E34\u0E1B\u0E19\u0E35\u0E49"],
    "startPoses": [{ "name": "\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23", "posture": "standing|sitting|lying|kneeling|walking", "place": "\u0E2D\u0E22\u0E39\u0E48\u0E15\u0E23\u0E07\u0E44\u0E2B\u0E19" }],
    "endPoses": [{ "name": "\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23", "posture": "standing|sitting|lying|kneeling|walking", "place": "\u0E2D\u0E22\u0E39\u0E48\u0E15\u0E23\u0E07\u0E44\u0E2B\u0E19" }],
    "charactersLeft": [],
    "continuityLockSummary": "\u0E2A\u0E23\u0E38\u0E1B\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E35\u0E48\u0E25\u0E47\u0E2D\u0E04\u0E04\u0E27\u0E32\u0E21\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07",
    "audioDirectiveSummary": "\u0E2A\u0E23\u0E38\u0E1B\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E40\u0E2A\u0E35\u0E22\u0E07",
    "generatedPrompt": "Cinematic prompt with Thai dialogue tags, camera directions, and AV Directives.",
    "negativePrompt": "blurry, morphing face, inconsistent outfit, extra limbs, bad anatomy, text watermark, sudden jumpcut"
  }
]`;
          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: promptInstruction,
            config: { responseMimeType: "application/json" }
          });
          const rawText = response.text ? response.text.trim() : "";
          const cleanedJson = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
          let parsed;
          try {
            parsed = JSON.parse(cleanedJson);
          } catch {
            return res.status(502).json({
              success: false,
              code: "GEMINI_INVALID_JSON",
              message: "Gemini \u0E15\u0E2D\u0E1A\u0E01\u0E25\u0E31\u0E1A\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48 JSON \u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48 / Gemini returned invalid JSON. Please try again."
            });
          }
          if (Array.isArray(parsed) && parsed.length > 0) {
            clips = parsed.map((clip) => {
              const safeDialogues = Array.isArray(clip.dialogues) ? clip.dialogues.filter((d) => d && d.speaker && !isReservedSystemKeyword(d.speaker)) : [];
              return {
                ...clip,
                dialogues: safeDialogues
              };
            });
          }
        }
      } catch (geminiErr) {
        const reason = formatGenAIError(geminiErr);
        console.warn("Gemini multi-clip generation failed:", reason);
        return res.status(502).json({
          success: false,
          code: "GEMINI_API_ERROR",
          message: `Gemini \u0E2A\u0E23\u0E49\u0E32\u0E07 Multi-Clip Prompts \u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08: ${reason} / Gemini multi-clip generation failed.`
        });
      }
    }
    if (!clips || clips.length === 0) {
      return res.status(502).json({
        success: false,
        code: "GEMINI_INVALID_CLIPS",
        message: "Gemini \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E2A\u0E48\u0E07\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E04\u0E25\u0E34\u0E1B\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48 / Gemini returned no clips. Please try again."
      });
    }
    const geminiLockNames = lockedNames.length > 0 ? lockedNames : Array.from(new Set(clips.flatMap((c) => (c.dialogues || []).map((d) => d.speaker)).filter(Boolean)));
    const geminiLocks = buildCharacterAppearanceLock(geminiLockNames, [
      ...libraryChars,
      ...continuityLockCharacter(continuityLock)
    ], parseScriptCharacterList(scriptText));
    const withContinuity = attachClipContinuity(
      clips.map((c, i) => {
        const present = geminiLocks.profiles.filter((p) => Array.isArray(c.charactersPresent) && c.charactersPresent.includes(p.name) || JSON.stringify(c).includes(p.name));
        const lockText = present.map(formatCharacterAppearanceLock).join(" | ");
        const prompt = String(c.generatedPrompt || "");
        return {
          ...c,
          clipNumber: Number(c.clipNumber) || i + 1,
          dialogues: Array.isArray(c.dialogues) ? c.dialogues : [],
          characterLockText: lockText,
          appearanceWarnings: geminiLocks.warnings.filter((w) => present.some((p) => w.includes(p.name))),
          generatedPrompt: lockText && !prompt.includes(lockText) ? `${prompt.replace(/\s+$/, "")} Character Lock: ${lockText}, identical face, hair and outfit in every clip.` : prompt
        };
      }),
      lockedNames,
      { appendToPrompt: true, initialPoses: normalizePoseList(continuityLock?.characterPositionLocks), location: continuityLock?.location || "" }
    );
    clips = enforceLibraryCharacterLocks(withContinuity.clips, [
      ...libraryChars,
      ...continuityLockCharacter(continuityLock)
    ], parseScriptCharacterList(scriptText));
    clips = enforceLibraryLocationLocks(clips, libraryLocs, { ...locationLockOpts, rebuildAtmosphere: true });
    const validation = validateSalaMultiClipPrompts(clips, lockedNames);
    return res.json({
      success: true,
      source,
      clips,
      validation
    });
  } catch (err) {
    console.error("Error in /api/director/generate-multi-clip-prompts:", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E43\u0E19\u0E01\u0E32\u0E23\u0E2A\u0E23\u0E49\u0E32\u0E07 Multi-Clip Prompts"
    });
  }
});
app.post("/api/director/regenerate-single-clip", requireAuth, async (req, res) => {
  try {
    const {
      clipNumber = 1,
      totalClips = 3,
      durationSeconds = 10,
      sceneSummary = "",
      previousClipEndAction = "",
      nextClipStartAction = "",
      continuityLock = {},
      dialogues = [],
      audioDirectives = {}
    } = req.body;
    const safeDialogues = Array.isArray(dialogues) ? dialogues.filter((d) => d && d.speaker && !isReservedSystemKeyword(d.speaker)) : [];
    const charName = continuityLock.characterName || "";
    const charAppearance = continuityLock.characterAppearance || "";
    const location = continuityLock.location || "";
    const timeOfDay = continuityLock.timeOfDay || "";
    const lighting = continuityLock.lighting || "";
    const visualStyle = continuityLock.visualStyle || "Cinematic 8K, 35mm lens";
    const aspectRatio = continuityLock.aspectRatio || "16:9";
    const cameraMovement = continuityLock.cameraMovement || "Smooth cinematic tracking shot";
    const lensType = continuityLock.lensType || "35mm anamorphic prime";
    const props = continuityLock.props || "";
    const startAction = clipNumber > 1 && previousClipEndAction ? `\u0E15\u0E48\u0E2D\u0E22\u0E2D\u0E14\u0E17\u0E31\u0E19\u0E17\u0E35\u0E08\u0E32\u0E01\u0E08\u0E38\u0E14\u0E08\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32: ${previousClipEndAction}${charName ? `. ${charName} \u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E25\u0E37\u0E48\u0E19\u0E44\u0E2B\u0E25` : ""}` : `${charName ? `${charName} ` : ""}\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E01\u0E32\u0E23\u0E01\u0E23\u0E30\u0E17\u0E33\u0E43\u0E19\u0E08\u0E38\u0E14\u0E19\u0E35\u0E49: ${sceneSummary}`;
    const endAction = clipNumber < totalClips ? `${charName ? `${charName} ` : ""}\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E21\u0E35\u0E17\u0E34\u0E28\u0E17\u0E32\u0E07 \u0E2A\u0E48\u0E07\u0E15\u0E48\u0E2D\u0E21\u0E38\u0E21\u0E01\u0E25\u0E49\u0E2D\u0E07\u0E41\u0E25\u0E30\u0E42\u0E21\u0E40\u0E21\u0E19\u0E15\u0E31\u0E21\u0E44\u0E1B\u0E22\u0E31\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E17\u0E35\u0E48 ${clipNumber + 1}` : `${charName ? `${charName} ` : ""}\u0E2A\u0E34\u0E49\u0E19\u0E2A\u0E38\u0E14\u0E01\u0E32\u0E23\u0E01\u0E23\u0E30\u0E17\u0E33\u0E43\u0E19\u0E09\u0E32\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C \u0E01\u0E25\u0E49\u0E2D\u0E07 Cinematic Fade Out`;
    const dialogueSnippet = safeDialogues.length > 0 ? safeDialogues.map((d) => `[DIALOGUE_LOCK: ${d.speaker} says in Thai ("${d.line}"), emotion: ${d.emotionTone || "focused"}]`).join(", ") : "";
    const audioSnippets = [];
    if (audioDirectives?.voice?.enabled) audioSnippets.push(`Voice: ${audioDirectives.voice.voiceType}`);
    if (audioDirectives?.music?.enabled) audioSnippets.push(`Music: ${audioDirectives.music.genre} (${audioDirectives.music.mood})`);
    if (audioDirectives?.sfx?.enabled) audioSnippets.push(`SFX: ${audioDirectives.sfx.ambientSounds}`);
    const audioDirectiveSummary = audioSnippets.join(" | ") || "Audio: Standard Ambient";
    const lockParts = [];
    if (charName) lockParts.push(`Character: ${charName}${charAppearance ? ` (${charAppearance})` : ""}`);
    if (location) lockParts.push(`Location: ${location}`);
    if (timeOfDay) lockParts.push(`Time: ${timeOfDay}`);
    if (lighting) lockParts.push(`Lighting: ${lighting}`);
    if (visualStyle) lockParts.push(`Style: ${visualStyle}`);
    if (aspectRatio) lockParts.push(`Aspect: ${aspectRatio}`);
    if (lensType) lockParts.push(`Lens: ${lensType}`);
    if (props) lockParts.push(`Props: ${props}`);
    const masterLockSnippet = lockParts.length > 0 ? `[MASTER CONTINUITY LOCK: ${lockParts.join(", ")}] ` : "";
    const generatedPrompt = `${masterLockSnippet}[SCENE ${clipNumber}/${totalClips} - DURATION ${durationSeconds}s]: ${startAction}. Core action: ${sceneSummary}. Camera: ${cameraMovement}, ${lensType}. ${dialogueSnippet ? dialogueSnippet + "." : ""} Outro momentum: ${endAction}. [AV Directives: ${audioDirectiveSummary}]. Ultra-consistent visual identity.`;
    res.json({
      success: true,
      clip: {
        clipNumber,
        title: `\u0E04\u0E25\u0E34\u0E1B\u0E17\u0E35\u0E48 ${clipNumber} (\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E43\u0E2B\u0E21\u0E48)`,
        durationSeconds,
        sceneSummary,
        startAction,
        endAction,
        dialogues: safeDialogues,
        continuityLockSummary: `\u0E25\u0E47\u0E2D\u0E04: ${charName || "\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23"}, ${location || "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48"}, ${timeOfDay || "\u0E40\u0E27\u0E25\u0E32"}, ${lighting || "\u0E41\u0E2A\u0E07"}, ${aspectRatio}`,
        audioDirectiveSummary,
        generatedPrompt,
        negativePrompt: "blurry, morphing face, inconsistent outfit, extra limbs, bad anatomy, text watermark, sudden jumpcut"
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err?.message || "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E43\u0E2B\u0E21\u0E48\u0E44\u0E14\u0E49" });
  }
});
function markMissingUploadReferences(chars) {
  return (Array.isArray(chars) ? chars : []).map((c) => {
    const url = String(c?.referenceImageUrl || c?.referenceMetadata?.referenceImageUrl || c?.visualProfile?.referenceImageUrl || "");
    if (!url.startsWith("/uploads/") || c?.referenceStatus === "missing") return c;
    const rel = decodeURIComponent(url.slice("/uploads/".length).split("?")[0]);
    const file = import_path.default.resolve(UPLOADS_DIR, rel);
    const inside = file.startsWith(import_path.default.resolve(UPLOADS_DIR) + import_path.default.sep);
    return inside && import_fs.default.existsSync(file) ? c : { ...c, referenceStatus: "missing" };
  });
}
function splitCombinedCharactersInSplit(parsed) {
  if (!parsed || typeof parsed !== "object") return;
  const lock = parsed.continuityLock;
  if (lock?.characterName) {
    const parts = expandCombinedCharacterNames([String(lock.characterName)]);
    if (parts.length > 1) lock.characterName = parts.join(", ");
  }
  if (Array.isArray(parsed.characters)) {
    const out = [];
    parsed.characters.forEach((c) => {
      const parts = expandCombinedCharacterNames([String(c?.name || "")]);
      if (parts.length > 1) {
        parts.forEach((n) => {
          if (!out.some((o) => o.name === n) && !parsed.characters.some((x) => x?.name === n)) out.push({ ...c, name: n, appearance: "" });
        });
      } else if (c && !out.some((o) => o.name === c.name)) out.push(c);
    });
    parsed.characters = out;
  }
  if (Array.isArray(parsed.scenes)) {
    parsed.scenes.forEach((sc) => {
      if (Array.isArray(sc.characters)) sc.characters = expandCombinedCharacterNames(sc.characters);
    });
  }
  if (Array.isArray(parsed.dialogues)) {
    const known = (parsed.characters || []).map((c) => c.name);
    const byScene = /* @__PURE__ */ new Map();
    parsed.dialogues.forEach((d) => {
      const k = Number(d?.sceneNumber) || 0;
      byScene.set(k, [...byScene.get(k) || [], d]);
    });
    parsed.dialogues = Array.from(byScene.values()).flatMap((list) => dedupeDialogueEntries(list, known));
  }
}
function buildLockedContinuityContext(continuityLock, characters, locations) {
  const lines = [];
  const lock = continuityLock || {};
  if (lock.characterName) lines.push(`- \u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01\u0E17\u0E35\u0E48\u0E25\u0E47\u0E2D\u0E04: ${lock.characterName}${lock.characterAppearance ? ` (\u0E23\u0E39\u0E1B\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C/\u0E0A\u0E38\u0E14: ${lock.characterAppearance})` : ""}`);
  if (Array.isArray(lock.characterNames) && lock.characterNames.length > 0) lines.push(`- \u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E04\u0E07\u0E17\u0E35\u0E48: ${lock.characterNames.join(", ")}`);
  if (lock.location) lines.push(`- \u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E17\u0E35\u0E48\u0E25\u0E47\u0E2D\u0E04: ${lock.location}${lock.locationVisualDetails ? ` (${lock.locationVisualDetails})` : ""}`);
  if (lock.timeOfDay) lines.push(`- \u0E40\u0E27\u0E25\u0E32\u0E17\u0E35\u0E48\u0E25\u0E47\u0E2D\u0E04: ${lock.timeOfDay}`);
  if (lock.lighting) lines.push(`- \u0E41\u0E2A\u0E07\u0E17\u0E35\u0E48\u0E25\u0E47\u0E2D\u0E04 (\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E40\u0E14\u0E35\u0E22\u0E27\u0E01\u0E31\u0E19\u0E17\u0E38\u0E01\u0E04\u0E25\u0E34\u0E1B): ${lock.lighting}`);
  if (lock.characterPosition) lines.push(`- \u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07/\u0E17\u0E48\u0E32\u0E17\u0E32\u0E07\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E17\u0E35\u0E48\u0E25\u0E47\u0E2D\u0E04: ${lock.characterPosition}`);
  const lockedNames = new Set([lock.characterName, ...lock.characterNames || []].filter(Boolean));
  const libChars = (Array.isArray(characters) ? characters : []).filter((c) => c?.name && (lockedNames.size === 0 || lockedNames.has(c.name) || String(lock.characterName || "").includes(c.name)));
  if (libChars.length > 0) lines.push(`- Character Lock \u0E08\u0E32\u0E01\u0E04\u0E25\u0E31\u0E07: ${libChars.slice(0, 8).map((c) => buildCharacterLockText(c)).join(" | ")}`);
  const locList = (Array.isArray(locations) ? locations : []).filter((l) => l?.name);
  const lockedLoc = lock.locationId && locList.find((l) => l.id === lock.locationId) || (lock.location ? findLocationByName(locList, String(lock.location)) : void 0);
  if (lockedLoc) lines.push(`- Location Lock \u0E08\u0E32\u0E01\u0E04\u0E25\u0E31\u0E07 (\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E19\u0E35\u0E49\u0E41\u0E1A\u0E1A\u0E04\u0E33\u0E15\u0E48\u0E2D\u0E04\u0E33 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E1E\u0E34\u0E48\u0E21/\u0E25\u0E14/\u0E22\u0E49\u0E32\u0E22\u0E27\u0E31\u0E15\u0E16\u0E38): ${lockedLoc.name}: ${locationDescriptionOf(lockedLoc)}`);
  if (lines.length === 0) return "";
  return `
[\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E41\u0E25\u0E30\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E25\u0E47\u0E2D\u0E04\u0E44\u0E27\u0E49 (LOCKED CONTINUITY CONTEXT) \u2014 \u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E04\u0E48\u0E32\u0E40\u0E2B\u0E25\u0E48\u0E32\u0E19\u0E35\u0E49\u0E43\u0E19\u0E17\u0E38\u0E01\u0E09\u0E32\u0E01 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19]:
${lines.join("\n")}
`;
}
app.post("/api/script/split", async (req, res) => {
  try {
    const {
      scriptText,
      clipCount,
      apiKey,
      continuityLock,
      characters,
      locations
    } = req.body || {};
    const offlineMode = req.body?.offlineMode === true || req.body?.offline === true;
    const libChars = markMissingUploadReferences(Array.isArray(characters) ? characters : []);
    if (!scriptText || typeof scriptText !== "string" || !scriptText.trim()) {
      return res.status(400).json({
        success: false,
        message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E23\u0E37\u0E2D\u0E42\u0E04\u0E23\u0E07\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07 (Script text is required)"
      });
    }
    if (offlineMode) {
      const offlineData = applySplitLocks(parseScriptLocally(scriptText, clipCount, libChars), continuityLock, { characters: libChars, scriptText });
      return res.json({ success: true, source: "fallback-parser", offline: true, data: offlineData });
    }
    const headerKey = typeof req.headers["x-gemini-key"] === "string" ? req.headers["x-gemini-key"] : "";
    const userKey = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : headerKey.trim();
    const ai = getGeminiClient(userKey || void 0);
    if (!ai) {
      return res.status(400).json({
        success: false,
        code: "GEMINI_KEY_MISSING",
        message: '\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 Gemini API Key \u0E01\u0E23\u0E38\u0E13\u0E32\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 API Key \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01 "\u0E42\u0E2B\u0E21\u0E14\u0E2D\u0E2D\u0E1F\u0E44\u0E25\u0E19\u0E4C" \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E41\u0E22\u0E01\u0E1A\u0E17\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E49 AI / No Gemini API key. Save your key or choose offline mode.'
      });
    }
    const lockedContext = buildLockedContinuityContext(continuityLock, characters, locations);
    {
      try {
        const systemInstruction = `\u0E04\u0E38\u0E13\u0E40\u0E1B\u0E47\u0E19\u0E1C\u0E39\u0E49\u0E01\u0E33\u0E01\u0E31\u0E1A\u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C\u0E41\u0E25\u0E30\u0E1C\u0E39\u0E49\u0E40\u0E0A\u0E35\u0E48\u0E22\u0E27\u0E0A\u0E32\u0E0D\u0E14\u0E49\u0E32\u0E19\u0E01\u0E32\u0E23\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E1A\u0E17\u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C\u0E0A\u0E31\u0E49\u0E19\u0E22\u0E2D\u0E14 \u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E04\u0E37\u0E2D\u0E2D\u0E48\u0E32\u0E19\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23/\u0E42\u0E04\u0E23\u0E07\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 \u0E41\u0E25\u0E49\u0E27\u0E41\u0E22\u0E01\u0E2A\u0E48\u0E27\u0E19\u0E1B\u0E23\u0E30\u0E01\u0E2D\u0E1A\u0E43\u0E2B\u0E49\u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07 JSON \u0E2D\u0E22\u0E48\u0E32\u0E07\u0E41\u0E21\u0E48\u0E19\u0E22\u0E33 \u0E42\u0E14\u0E22\u0E1B\u0E0F\u0E34\u0E1A\u0E31\u0E15\u0E34\u0E15\u0E32\u0E21\u0E01\u0E0E\u0E40\u0E2B\u0E25\u0E47\u0E01 5 \u0E02\u0E49\u0E2D\u0E19\u0E35\u0E49\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E04\u0E23\u0E48\u0E07\u0E04\u0E23\u0E31\u0E14:

1. [\u0E2A\u0E48\u0E27\u0E19\u0E01\u0E48\u0E2D\u0E19 "\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 1" \u0E40\u0E1B\u0E47\u0E19 METADATA \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19]:
\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E0A\u0E48\u0E19 \u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07:, \u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23:, \u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E25\u0E31\u0E01:, \u0E40\u0E27\u0E25\u0E32: \u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E01\u0E48\u0E2D\u0E19 "\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 1" \u0E15\u0E49\u0E2D\u0E07\u0E16\u0E39\u0E01\u0E40\u0E01\u0E47\u0E1A\u0E40\u0E1B\u0E47\u0E19 metadata (title, characters, locations, continuityLock) \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19
- \u0E2B\u0E49\u0E32\u0E21\u0E19\u0E33\u0E2A\u0E48\u0E27\u0E19 metadata \u0E44\u0E1B\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E40\u0E1B\u0E47\u0E19 Scene \u0E2B\u0E23\u0E37\u0E2D Clip
- \u0E2B\u0E49\u0E32\u0E21\u0E19\u0E33\u0E44\u0E1B\u0E40\u0E1B\u0E47\u0E19 Starting moment \u0E2B\u0E23\u0E37\u0E2D Core action \u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01
- \u0E2B\u0E49\u0E32\u0E21\u0E19\u0E33\u0E44\u0E1B\u0E40\u0E1B\u0E47\u0E19 Dialogue

2. [Character Section \u0E15\u0E49\u0E2D\u0E07\u0E41\u0E22\u0E01 Name \u0E41\u0E25\u0E30 Description]:
- \u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23 \u0E40\u0E0A\u0E48\u0E19 \u0E1F\u0E49\u0E32\u0E43\u0E2A: \u0E2B\u0E0D\u0E34\u0E07\u0E2D\u0E32\u0E22\u0E38 24 \u0E1B\u0E35... \u0E15\u0E49\u0E2D\u0E07 parse \u0E40\u0E1B\u0E47\u0E19 name: "\u0E1F\u0E49\u0E32\u0E43\u0E2A", description: "\u0E2B\u0E0D\u0E34\u0E07\u0E2D\u0E32\u0E22\u0E38 24 \u0E1B\u0E35..."
- description \u0E2B\u0E49\u0E32\u0E21\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19 Dialogue \u0E2B\u0E23\u0E37\u0E2D\u0E01\u0E25\u0E32\u0E22\u0E40\u0E1B\u0E47\u0E19 Scene action \u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14

3. [Scene Splitting \u0E15\u0E32\u0E21\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D "\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 X" \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19]:
- \u0E40\u0E09\u0E1E\u0E32\u0E30\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D "\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 1:", "\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 2:", "\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 3:" (\u0E2B\u0E23\u0E37\u0E2D "CLIP 1:", "Scene 1:") \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19\u0E17\u0E35\u0E48\u0E40\u0E23\u0E34\u0E48\u0E21 Scene \u0E43\u0E2B\u0E21\u0E48
- \u0E1C\u0E25\u0E25\u0E31\u0E1E\u0E18\u0E4C\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E23\u0E35\u0E22\u0E07\u0E40\u0E1B\u0E47\u0E19: Scene 1, Scene 2, Scene 3 \u0E04\u0E23\u0E1A\u0E17\u0E38\u0E01\u0E09\u0E32\u0E01
- \u0E2B\u0E49\u0E32\u0E21\u0E2A\u0E23\u0E49\u0E32\u0E07 intro scene \u0E08\u0E32\u0E01 metadata
- \u0E2B\u0E49\u0E32\u0E21 offset scene
- \u0E2B\u0E49\u0E32\u0E21\u0E44\u0E14\u0E49 Scene 1 \u0E0B\u0E49\u0E33\u0E2A\u0E2D\u0E07\u0E04\u0E23\u0E31\u0E49\u0E07
- \u0E2B\u0E49\u0E32\u0E21\u0E17\u0E33 Scene 3 \u0E2B\u0E32\u0E22

4. [Dialogue \u0E15\u0E49\u0E2D\u0E07\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19 Scene \u0E41\u0E25\u0E30\u0E21\u0E35\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2B\u0E21\u0E32\u0E22\u0E04\u0E33\u0E1E\u0E39\u0E14]:
- Dialogue \u0E08\u0E30\u0E16\u0E37\u0E2D\u0E27\u0E48\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E1A\u0E17\u0E1E\u0E39\u0E14\u0E44\u0E14\u0E49\u0E15\u0E48\u0E2D\u0E40\u0E21\u0E37\u0E48\u0E2D:
  a) \u0E2D\u0E22\u0E39\u0E48\u0E20\u0E32\u0E22\u0E43\u0E19 Scene
  b) \u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14 (speaker) \u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E17\u0E35\u0E48\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E44\u0E27\u0E49\u0E08\u0E23\u0E34\u0E07
  c) \u0E21\u0E35\u0E23\u0E39\u0E1B\u0E41\u0E1A\u0E1A CharacterName: "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21" (\u0E2B\u0E23\u0E37\u0E2D '\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21')
- \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E2D\u0E32 Character Description, Title, Scene Description, \u0E2B\u0E23\u0E37\u0E2D\u0E04\u0E33\u0E27\u0E48\u0E32 END \u0E21\u0E32\u0E40\u0E1B\u0E47\u0E19 Dialogue \u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14

5. [\u0E01\u0E0E\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E04\u0E33\u0E2A\u0E07\u0E27\u0E19\u0E23\u0E30\u0E1A\u0E1A RESERVED KEYWORDS]:
\u0E04\u0E33\u0E15\u0E48\u0E2D\u0E44\u0E1B\u0E19\u0E35\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E23\u0E30\u0E1A\u0E1A \u0E2B\u0E49\u0E32\u0E21\u0E19\u0E33\u0E21\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E23\u0E37\u0E2D\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14\u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14:
LOCK, CONT, FRAME, AUTO, RULE, NO, OUT, STORY, CHARACTERS, END, SALA_MULTI_CLIP

6. [LOCKED CONTINUITY CONTEXT]:
\u0E16\u0E49\u0E32\u0E21\u0E35\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23/\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E17\u0E35\u0E48\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E25\u0E47\u0E2D\u0E04\u0E44\u0E27\u0E49 \u0E15\u0E49\u0E2D\u0E07\u0E43\u0E0A\u0E49\u0E0A\u0E37\u0E48\u0E2D \u0E23\u0E39\u0E1B\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C \u0E0A\u0E38\u0E14 \u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48 \u0E40\u0E27\u0E25\u0E32 \u0E41\u0E25\u0E30\u0E41\u0E2A\u0E07\u0E15\u0E32\u0E21\u0E17\u0E35\u0E48\u0E25\u0E47\u0E2D\u0E04\u0E43\u0E19\u0E17\u0E38\u0E01\u0E09\u0E32\u0E01 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E41\u0E15\u0E48\u0E07\u0E40\u0E1E\u0E34\u0E48\u0E21
\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E2D\u0E19/\u0E2D\u0E32\u0E23\u0E21\u0E13\u0E4C (\u0E40\u0E0A\u0E48\u0E19 "\u0E2D\u0E32\u0E23\u0E21\u0E13\u0E4C\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E36\u0E07\u0E40\u0E04\u0E23\u0E35\u0E22\u0E14", "\u0E04\u0E37\u0E19\u0E14\u0E35\u0E01\u0E31\u0E19") \u0E2B\u0E23\u0E37\u0E2D "\u2026\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07" \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48 \u0E43\u0E2B\u0E49\u0E43\u0E0A\u0E49\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E41\u0E25\u0E30\u0E40\u0E27\u0E25\u0E32\u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32

\u0E2A\u0E48\u0E07\u0E1C\u0E25\u0E25\u0E31\u0E1E\u0E18\u0E4C\u0E40\u0E1B\u0E47\u0E19 JSON \u0E25\u0E49\u0E27\u0E19 (valid JSON format) \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \u0E2B\u0E49\u0E32\u0E21\u0E43\u0E2A\u0E48 markdown code block \u0E2B\u0E23\u0E37\u0E2D\u0E04\u0E33\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E40\u0E2A\u0E23\u0E34\u0E21`;
        const userPrompt = `\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23/\u0E42\u0E04\u0E23\u0E07\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E19\u0E33\u0E21\u0E32\u0E41\u0E22\u0E01:
"""
${scriptText.trim()}
"""

${clipCount ? `\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E49\u0E41\u0E1A\u0E48\u0E07\u0E2D\u0E2D\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E1B\u0E23\u0E30\u0E21\u0E32\u0E13 ${clipCount} \u0E09\u0E32\u0E01/\u0E04\u0E25\u0E34\u0E1B\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E01\u0E31\u0E19` : "\u0E43\u0E2B\u0E49\u0E41\u0E1A\u0E48\u0E07\u0E09\u0E32\u0E01\u0E15\u0E32\u0E21\u0E42\u0E04\u0E23\u0E07\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E08\u0E23\u0E34\u0E07\u0E17\u0E35\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E44\u0E27\u0E49\u0E43\u0E19\u0E1A\u0E17"}
${lockedContext}

\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07 JSON \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E2A\u0E48\u0E07\u0E01\u0E25\u0E31\u0E1A (JSON format strictly):
{
  "title": "\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E0A\u0E37\u0E48\u0E2D\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23",
  "characters": [
    { "name": "\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23 (\u0E2B\u0E49\u0E32\u0E21\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E2A\u0E07\u0E27\u0E19)", "description": "\u0E25\u0E31\u0E01\u0E29\u0E13\u0E30 \u0E2D\u0E32\u0E22\u0E38 \u0E17\u0E23\u0E07\u0E1C\u0E21 \u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E1C\u0E49\u0E32 \u0E1A\u0E38\u0E04\u0E25\u0E34\u0E01", "role": "\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01/\u0E2A\u0E21\u0E17\u0E1A", "appearance": "\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E32\u0E41\u0E25\u0E30\u0E0A\u0E38\u0E14" }
  ],
  "dialogues": [
    { "id": "d1", "speaker": "\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14 (\u0E2B\u0E49\u0E32\u0E21\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E2A\u0E07\u0E27\u0E19)", "line": "\u0E1A\u0E17\u0E1E\u0E39\u0E14\u0E15\u0E23\u0E07\u0E15\u0E32\u0E21\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A\u0E40\u0E1B\u0E4A\u0E30", "emotionTone": "\u0E2D\u0E32\u0E23\u0E21\u0E13\u0E4C/\u0E2A\u0E35\u0E2B\u0E19\u0E49\u0E32", "sceneNumber": 1 }
  ],
  "locations": [
    { "name": "\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48", "description": "\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48", "atmosphere": "\u0E1A\u0E23\u0E23\u0E22\u0E32\u0E01\u0E32\u0E28" }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 1: ...",
      "location": "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48",
      "timeOfDay": "\u0E40\u0E27\u0E25\u0E32",
      "lighting": "\u0E01\u0E32\u0E23\u0E08\u0E31\u0E14\u0E41\u0E2A\u0E07",
      "camera": "\u0E21\u0E38\u0E21\u0E01\u0E25\u0E49\u0E2D\u0E07\u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27",
      "characters": ["\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23"],
      "action": "\u0E01\u0E32\u0E23\u0E01\u0E23\u0E30\u0E17\u0E33\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E43\u0E19\u0E09\u0E32\u0E01",
      "dialogue": "\u0E1A\u0E17\u0E1E\u0E39\u0E14\u0E43\u0E19\u0E09\u0E32\u0E01\u0E19\u0E35\u0E49 (\u0E16\u0E49\u0E32\u0E21\u0E35)",
      "prompt": "Prompt \u0E04\u0E38\u0E13\u0E20\u0E32\u0E1E\u0E2A\u0E39\u0E07\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E20\u0E32\u0E1E\u0E2B\u0E23\u0E37\u0E2D\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E19\u0E35\u0E49"
    }
  ],
  "lighting": "\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E41\u0E2A\u0E07\u0E2B\u0E25\u0E31\u0E01\u0E17\u0E35\u0E48\u0E04\u0E38\u0E21\u0E42\u0E17\u0E19\u0E17\u0E31\u0E49\u0E07\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07",
  "camera": {
    "movement": "\u0E01\u0E32\u0E23\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27\u0E01\u0E25\u0E49\u0E2D\u0E07\u0E2B\u0E25\u0E31\u0E01 \u0E40\u0E0A\u0E48\u0E19 Cinematic tracking shot",
    "lensType": "35mm Anamorphic Prime f/1.8",
    "shotType": "Medium Shot"
  },
  "continuityLock": {
    "characterName": "\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01",
    "characterAppearance": "\u0E23\u0E39\u0E1B\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C\u0E41\u0E25\u0E30\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E1C\u0E49\u0E32\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01",
    "location": "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E25\u0E31\u0E01",
    "timeOfDay": "\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32\u0E2B\u0E25\u0E31\u0E01",
    "lighting": "\u0E41\u0E2A\u0E07\u0E2B\u0E25\u0E31\u0E01",
    "visualStyle": "Cinematic Photorealistic 8K",
    "cameraMovement": "Cinematic tracking shot smoothly gliding alongside character",
    "cameraShotType": "Medium Shot",
    "lensType": "35mm Anamorphic Prime f/1.8",
    "props": "\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C\u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E17\u0E35\u0E48\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E16\u0E37\u0E2D\u0E2B\u0E23\u0E37\u0E2D\u0E1B\u0E23\u0E32\u0E01\u0E0F\u0E43\u0E19\u0E09\u0E32\u0E01"
  }
}`;
        const response = await ai.models.generateContent({
          model: "gemini-3.6-flash",
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: "application/json"
          }
        });
        const rawText = response.text || "";
        const cleanJson = rawText.replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
        let parsed = null;
        try {
          parsed = JSON.parse(cleanJson);
        } catch {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
            } catch {
              parsed = null;
            }
          }
        }
        if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
          return res.status(502).json({
            success: false,
            code: "GEMINI_INVALID_JSON",
            message: "Gemini \u0E15\u0E2D\u0E1A\u0E01\u0E25\u0E31\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E09\u0E32\u0E01\u0E44\u0E21\u0E48\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48 JSON \u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48 / Gemini returned incomplete or invalid scene JSON."
          });
        }
        if (Array.isArray(parsed.characters)) {
          parsed.characters = parsed.characters.filter((c) => c && c.name && !isReservedSystemKeyword(c.name) && !isMetadataKeyword(c.name));
        }
        const validCharNames = new Set((parsed.characters || []).map((c) => c.name.toLowerCase()));
        if (Array.isArray(parsed.dialogues)) {
          parsed.dialogues = parsed.dialogues.filter((d) => {
            if (!d || !d.speaker || !d.line) return false;
            if (isReservedSystemKeyword(d.speaker) || isMetadataKeyword(d.speaker)) return false;
            if (validCharNames.size > 0 && !validCharNames.has(d.speaker.toLowerCase())) return false;
            if (parsed.characters?.some((c) => c.description && d.line.includes(c.description))) return false;
            return true;
          });
        }
        if (Array.isArray(parsed.scenes)) {
          parsed.scenes = parsed.scenes.filter((s) => {
            if (!s) return false;
            const t = (s.title || "").toLowerCase();
            const a = (s.action || "").toLowerCase();
            if (t.includes("metadata") || t.includes("\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01") || t.includes("\u0E23\u0E32\u0E22\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23")) return false;
            if (a.includes("\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23:") && a.includes("\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E2B\u0E25\u0E31\u0E01:")) return false;
            return true;
          });
          const allDeclaredNames = (parsed.characters || []).map((c) => c.name);
          const introducedCharsInSplit = /* @__PURE__ */ new Set();
          parsed.scenes.forEach((s, idx) => {
            s.sceneNumber = idx + 1;
            if (!s.title || s.title.startsWith("\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 0")) {
              s.title = `\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${idx + 1}`;
            }
            const sceneText = `${s.title || ""} ${s.action || ""} ${s.dialogue || ""}`;
            const mentioned = allDeclaredNames.filter((name) => {
              const firstName = name.split(" ")[0];
              return sceneText.includes(name) || firstName.length >= 2 && sceneText.includes(firstName);
            });
            mentioned.forEach((n) => introducedCharsInSplit.add(n));
            if (Array.isArray(s.characters)) {
              s.characters = s.characters.filter((n) => introducedCharsInSplit.has(n));
            }
            if (!s.characters || s.characters.length === 0) {
              s.characters = mentioned.length > 0 ? mentioned : Array.from(introducedCharsInSplit);
            }
          });
        }
        if (parsed.continuityLock && (isReservedSystemKeyword(parsed.continuityLock.characterName) || isMetadataKeyword(parsed.continuityLock.characterName))) {
          parsed.continuityLock.characterName = parsed.characters?.[0]?.name || "";
        }
        splitCombinedCharactersInSplit(parsed);
        return res.json({
          success: true,
          source: "gemini-flash",
          data: applySplitLocks(parsed, continuityLock, { characters: libChars, scriptText })
        });
      } catch (geminiErr) {
        const reason = formatGenAIError(geminiErr);
        console.warn("Gemini script splitter error:", reason);
        return res.status(502).json({
          success: false,
          code: "GEMINI_API_ERROR",
          message: `Gemini \u0E41\u0E22\u0E01\u0E1A\u0E17\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08: ${reason} / Gemini script split failed. Retry, check your API key, or choose offline mode.`
        });
      }
    }
  } catch (err) {
    console.error("Error in /api/script/split:", err);
    res.status(500).json({
      success: false,
      message: err?.message || "\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E43\u0E19\u0E01\u0E32\u0E23\u0E41\u0E22\u0E01\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23"
    });
  }
});
app.post("/api/story/continue", async (req, res) => {
  try {
    const {
      originalStory,
      currentScriptText,
      episodeNumber: reqEpisodeNumber,
      targetSceneCount = 5,
      existingScenes = [],
      lastSceneState,
      characters,
      continuityLock,
      clipDurationSeconds = 10,
      apiKey
    } = req.body || {};
    if (!originalStory || typeof originalStory !== "string" || !originalStory.trim()) {
      return res.status(400).json({
        success: false,
        message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A (Original story is required)"
      });
    }
    const hasExplicitEnd = hasExplicitEndingMarker(originalStory);
    const effectiveLastScene = lastSceneState || (existingScenes.length > 0 ? existingScenes[existingScenes.length - 1] : null);
    const existingCount = existingScenes.length;
    const episodeNumber = typeof reqEpisodeNumber === "number" && reqEpisodeNumber >= 1 ? reqEpisodeNumber : existingCount === 0 ? 1 : Math.max(1, Math.floor(existingCount / 5) + 1);
    const scenesPerEpisode = Math.max(5, Math.min(6, targetSceneCount || 5));
    const startSceneNum = effectiveLastScene?.sceneNumber ? effectiveLastScene.sceneNumber + 1 : existingCount > 0 ? existingCount + 1 : 1;
    const offline = req.body?.offline === true;
    const parsedSource = parseStoryStructure(originalStory);
    const declaredNames = Array.from(/* @__PURE__ */ new Set([
      ...parsedSource.characters.map((c) => c.name),
      ...Array.isArray(characters) ? characters.map((c) => String(c?.name || "").trim()).filter((n) => n && originalStory.includes(n.split(" ")[0])) : []
    ])).filter((n) => !isReservedSystemKeyword(n));
    if (offline) {
      const localContinuation = generateEpisodeLocally({
        originalStory,
        currentScriptText,
        episodeNumber,
        targetSceneCount: scenesPerEpisode,
        existingScenes,
        lastSceneState: effectiveLastScene,
        characters,
        continuityLock,
        clipDurationSeconds
      });
      return res.json({
        success: true,
        source: "offline-narrative-engine",
        offline: true,
        ...localContinuation
      });
    }
    const userKey = typeof apiKey === "string" ? apiKey.trim() : "";
    const ai = getGeminiClient(userKey || void 0);
    if (!ai) {
      return res.status(400).json({
        success: false,
        code: "GEMINI_KEY_MISSING",
        message: '\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 Gemini API Key \u0E01\u0E23\u0E38\u0E13\u0E32\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 API Key \u0E43\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01 "\u0E42\u0E2B\u0E21\u0E14\u0E2D\u0E2D\u0E1F\u0E44\u0E25\u0E19\u0E4C" / No Gemini API key is configured. Save your key in Settings or choose offline mode.'
      });
    }
    const systemInstruction = `\u0E04\u0E38\u0E13\u0E04\u0E37\u0E2D\u0E19\u0E31\u0E01\u0E40\u0E02\u0E35\u0E22\u0E19\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23\u0E41\u0E25\u0E30\u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C\u0E21\u0E37\u0E2D\u0E2D\u0E32\u0E0A\u0E35\u0E1E \u0E21\u0E35\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E23\u0E30\u0E1A\u0E1A "Story Continuation / \u0E15\u0E48\u0E2D\u0E1A\u0E17\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34" (Progressive Episodic Scene Generation Engine)

*** \u0E01\u0E0E\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E1A\u0E31\u0E07\u0E04\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E21\u0E07\u0E27\u0E14\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 (STRICT EPISODIC & CONTINUITY PROTOCOL) ***:

1. [\u0E08\u0E33\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 \u0E41\u0E25\u0E30\u0E2B\u0E49\u0E32\u0E21\u0E2A\u0E23\u0E38\u0E1B\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E43\u0E19\u0E15\u0E2D\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27 (SOURCE OF TRUTH & EPISODIC PACING)]:
   - \u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E27\u0E32\u0E07\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E40\u0E15\u0E47\u0E21\u0E04\u0E23\u0E31\u0E49\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27\u0E43\u0E19\u0E0A\u0E48\u0E2D\u0E07 Story \u0E41\u0E25\u0E49\u0E27\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E07\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E41\u0E1A\u0E48\u0E07\u0E15\u0E2D\u0E19\u0E41\u0E25\u0E30\u0E09\u0E32\u0E01\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E40\u0E2D\u0E07\u0E08\u0E19\u0E08\u0E1A
   - \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A "\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 1" \u0E43\u0E2B\u0E49\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E08\u0E32\u0E01\u0E0A\u0E48\u0E27\u0E07\u0E15\u0E49\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 (\u0E2B\u0E49\u0E32\u0E21\u0E2A\u0E23\u0E38\u0E1B\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E43\u0E19\u0E15\u0E2D\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27\u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14! \u0E40\u0E08\u0E32\u0E30\u0E25\u0E36\u0E01\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07)
   - \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A "\u0E15\u0E2D\u0E19\u0E15\u0E48\u0E2D\u0E44\u0E1B (\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 2, 3...)" \u0E43\u0E2B\u0E49\u0E2D\u0E48\u0E32\u0E19 story \u0E40\u0E14\u0E34\u0E21\u0E41\u0E25\u0E30 state \u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14\u0E41\u0E25\u0E49\u0E27\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E15\u0E2D\u0E19\u0E16\u0E31\u0E14\u0E44\u0E1B\u0E15\u0E48\u0E2D\u0E08\u0E32\u0E01\u0E08\u0E38\u0E14\u0E40\u0E14\u0E34\u0E21\u0E17\u0E31\u0E19\u0E17\u0E35 \u0E44\u0E21\u0E48\u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15 \u0E44\u0E21\u0E48\u0E01\u0E23\u0E30\u0E42\u0E14\u0E14 \u0E44\u0E21\u0E48\u0E08\u0E1A\u0E40\u0E2D\u0E07
   - \u0E41\u0E15\u0E48\u0E25\u0E30\u0E15\u0E2D\u0E19\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27\u0E1E\u0E2D\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A 5-6 \u0E09\u0E32\u0E01 (\u0E42\u0E14\u0E22\u0E40\u0E09\u0E25\u0E35\u0E48\u0E22\u0E09\u0E32\u0E01\u0E25\u0E30\u0E1B\u0E23\u0E30\u0E21\u0E32\u0E13 ${clipDurationSeconds} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35)

2. [\u0E01\u0E0E\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E04\u0E27\u0E32\u0E21\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07: END scene \u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E01\u0E48\u0E2D\u0E19 \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19 START scene \u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E16\u0E31\u0E14\u0E44\u0E1B\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07]:
   - "startAction" \u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E43\u0E2B\u0E21\u0E48\u0E17\u0E38\u0E01\u0E09\u0E32\u0E01 \u0E15\u0E49\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E41\u0E25\u0E30\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E08\u0E32\u0E01 "endAction" \u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E44\u0E23\u0E49\u0E23\u0E2D\u0E22\u0E15\u0E48\u0E2D
   - \u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 1 \u0E02\u0E2D\u0E07\u0E15\u0E2D\u0E19\u0E43\u0E2B\u0E21\u0E48 \u0E15\u0E49\u0E2D\u0E07\u0E23\u0E31\u0E1A\u0E41\u0E25\u0E30\u0E2A\u0E37\u0E1A\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E15\u0E48\u0E2D\u0E08\u0E32\u0E01 "endAction" \u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22\u0E08\u0E32\u0E01\u0E15\u0E2D\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32 (${effectiveLastScene?.endAction || "\u0E08\u0E38\u0E14\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07"})

3. [\u0E01\u0E0E\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E25\u0E47\u0E2D\u0E04\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23 (SPATIAL POSITION LOCK)]:
   - \u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E43\u0E19\u0E09\u0E32\u0E01 \u0E40\u0E0A\u0E48\u0E19 "\u0E1E\u0E35\u0E48\u0E17\u0E38\u0E22\u0E2D\u0E22\u0E39\u0E48\u0E0B\u0E49\u0E32\u0E22\u0E40\u0E2A\u0E32, \u0E19\u0E49\u0E2D\u0E07\u0E19\u0E49\u0E33\u0E2D\u0E22\u0E39\u0E48\u0E02\u0E27\u0E32\u0E40\u0E2A\u0E32" \u0E15\u0E49\u0E2D\u0E07\u0E16\u0E39\u0E01\u0E23\u0E30\u0E1A\u0E38\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19\u0E43\u0E19 characterPositions
   - \u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E19\u0E35\u0E49\u0E15\u0E49\u0E2D\u0E07\u0E16\u0E39\u0E01\u0E25\u0E47\u0E2D\u0E04\u0E41\u0E25\u0E30\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E40\u0E02\u0E49\u0E32\u0E44\u0E1B\u0E43\u0E19\u0E09\u0E32\u0E01\u0E16\u0E31\u0E14\u0E44\u0E1B \u0E2B\u0E49\u0E32\u0E21\u0E2A\u0E25\u0E31\u0E1A\u0E1D\u0E31\u0E48\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E01\u0E23\u0E30\u0E42\u0E14\u0E14\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E42\u0E14\u0E22\u0E44\u0E21\u0E48\u0E21\u0E35\u0E01\u0E32\u0E23\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07

4. [\u0E01\u0E0E\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E01\u0E32\u0E23\u0E41\u0E2A\u0E14\u0E07\u0E1C\u0E25\u0E17\u0E38\u0E01\u0E09\u0E32\u0E01 (CHARACTER LOCK & CONTINUITY PROMPT)]:
   - \u0E17\u0E38\u0E01\u0E09\u0E32\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E38 Character Lock (\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23 \u0E23\u0E39\u0E1B\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C \u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E1C\u0E49\u0E32)
   - \u0E17\u0E38\u0E01\u0E09\u0E32\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07 Continuity Prompt \u0E04\u0E38\u0E13\u0E20\u0E32\u0E1E\u0E2A\u0E39\u0E07\u0E23\u0E30\u0E14\u0E31\u0E1A Cinematic 8K \u0E40\u0E1B\u0E47\u0E19\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29 \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E19\u0E33\u0E44\u0E1B\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D 10 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E23\u0E30\u0E1A\u0E38 Character Lock, Spatial Positioning, Starting Moment \u0E08\u0E32\u0E01 END \u0E09\u0E32\u0E01\u0E01\u0E48\u0E2D\u0E19, Core Action, \u0E41\u0E25\u0E30 Ending Momentum

5. [\u0E01\u0E0E\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E08\u0E38\u0E14\u0E2A\u0E34\u0E49\u0E19\u0E2A\u0E38\u0E14\u0E02\u0E2D\u0E07\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07 (STORY COMPLETION DETECTION)]:
   - \u0E2B\u0E49\u0E32\u0E21\u0E02\u0E36\u0E49\u0E19\u0E27\u0E48\u0E32\u0E08\u0E1A\u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14\u0E08\u0E19\u0E01\u0E27\u0E48\u0E32\u0E08\u0E30\u0E40\u0E08\u0E2D\u0E04\u0E33\u0E27\u0E48\u0E32 "\u0E08\u0E1A\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07", "\u0E08\u0E1A\u0E1A\u0E23\u0E34\u0E1A\u0E39\u0E23\u0E13\u0E4C", "\u0E08\u0E1A\u0E09\u0E32\u0E01", "\u0E15\u0E2D\u0E19\u0E08\u0E1A", "\u0E08\u0E1A", "-\u0E08\u0E1A-", "THE END" \u0E43\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E17\u0E49\u0E32\u0E22 (\u0E09\u0E32\u0E01\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22) \u0E02\u0E2D\u0E07\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E40\u0E15\u0E47\u0E21\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19
   - \u0E2B\u0E32\u0E01\u0E43\u0E19\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A\u0E44\u0E21\u0E48\u0E21\u0E35\u0E04\u0E33\u0E23\u0E30\u0E1A\u0E38\u0E08\u0E38\u0E14\u0E08\u0E1A\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19\u0E40\u0E2B\u0E25\u0E48\u0E32\u0E19\u0E35\u0E49 \u0E2B\u0E49\u0E32\u0E21\u0E15\u0E2D\u0E1A isStoryFinished: true \u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14
   - \u0E2B\u0E49\u0E32\u0E21\u0E15\u0E2D\u0E1A isStoryFinished: true \u0E16\u0E49\u0E32\u0E22\u0E31\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E43\u0E19\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E40\u0E02\u0E35\u0E22\u0E19 (\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 1 \u0E08\u0E1A\u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E04\u0E23\u0E2D\u0E1A\u0E04\u0E25\u0E38\u0E21\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E41\u0E25\u0E49\u0E27)

6. [\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07 JSON \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E2A\u0E48\u0E07\u0E01\u0E25\u0E31\u0E1A (valid JSON format \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19)]:
{
  "isStoryFinished": boolean,
  "finishMessage": string,
  "episodeNumber": number,
  "episodeTitle": "\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 X: [\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E2D\u0E19]",
  "progressPercentage": number,
  "currentMilestone": string,
  "summaryOfEventsSoFar": string,
  "sourceCovered": boolean (true \u0E40\u0E21\u0E37\u0E48\u0E2D\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E04\u0E23\u0E2D\u0E1A\u0E04\u0E25\u0E38\u0E21\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A\u0E41\u0E25\u0E49\u0E27 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E43\u0E2B\u0E49\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E15\u0E48\u0E2D),
  "episodeScriptText": "\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23\u0E17\u0E31\u0E49\u0E07\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E08\u0E31\u0E14\u0E1F\u0E2D\u0E23\u0E4C\u0E41\u0E21\u0E15\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C (\u0E21\u0E35\u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E15\u0E2D\u0E19, \u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 1 \u0E16\u0E36\u0E07 5 \u0E2B\u0E23\u0E37\u0E2D 6, \u0E23\u0E30\u0E1A\u0E38\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23, \u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19, \u0E01\u0E32\u0E23\u0E01\u0E23\u0E30\u0E17\u0E33, \u0E1A\u0E17\u0E1E\u0E39\u0E14, \u0E2A\u0E34\u0E49\u0E19\u0E2A\u0E38\u0E14\u0E09\u0E32\u0E01) \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E43\u0E2A\u0E48\u0E25\u0E07\u0E0A\u0E48\u0E2D\u0E07 '\u0E27\u0E32\u0E07\u0E1A\u0E17\u0E2B\u0E23\u0E37\u0E2D\u0E09\u0E32\u0E01\u0E2B\u0E25\u0E32\u0E22\u0E09\u0E32\u0E01' \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34",
  "scenes": [
{
  "sceneNumber": number,
  "sceneHeading": "\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 X: [\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48] - [\u0E40\u0E27\u0E25\u0E32]",
  "location": "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48",
  "timeOfDay": "\u0E40\u0E27\u0E25\u0E32",
  "characters": ["\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23"],
  "characterPositions": "\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23 \u0E40\u0E0A\u0E48\u0E19 \u0E1E\u0E35\u0E48\u0E17\u0E38\u0E22\u0E2D\u0E22\u0E39\u0E48\u0E0B\u0E49\u0E32\u0E22\u0E40\u0E2A\u0E32, \u0E19\u0E49\u0E2D\u0E07\u0E19\u0E49\u0E33\u0E2D\u0E22\u0E39\u0E48\u0E02\u0E27\u0E32\u0E40\u0E2A\u0E32",
  "actionDescription": "\u0E04\u0E33\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22\u0E20\u0E32\u0E1E \u0E01\u0E32\u0E23\u0E01\u0E23\u0E30\u0E17\u0E33 \u0E41\u0E25\u0E30 Subtext",
  "startAction": "\u0E08\u0E38\u0E14\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E09\u0E32\u0E01 \u0E23\u0E31\u0E1A\u0E0A\u0E48\u0E27\u0E07\u0E15\u0E48\u0E2D\u0E08\u0E32\u0E01 endAction \u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32",
  "dialogues": [
    {
      "speaker": "\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23",
      "emotionOrAction": "\u0E2A\u0E35\u0E2B\u0E19\u0E49\u0E32/\u0E2D\u0E32\u0E23\u0E21\u0E13\u0E4C/\u0E2D\u0E32\u0E01\u0E31\u0E1B\u0E01\u0E34\u0E23\u0E34\u0E22\u0E32\u0E02\u0E13\u0E30\u0E1E\u0E39\u0E14 \u0E40\u0E0A\u0E48\u0E19 (\u0E2A\u0E1A\u0E15\u0E32\u0E15\u0E23\u0E07\u0E46 \u0E19\u0E34\u0E48\u0E07\u0E2A\u0E38\u0E02\u0E38\u0E21)",
      "dialogue": "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E1A\u0E17\u0E1E\u0E39\u0E14\u0E15\u0E23\u0E07\u0E15\u0E32\u0E21\u0E2D\u0E32\u0E23\u0E21\u0E13\u0E4C\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07"
    }
  ],
  "endState": "\u0E08\u0E38\u0E14\u0E08\u0E1A\u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01 \u0E2A\u0E48\u0E07\u0E15\u0E48\u0E2D\u0E42\u0E21\u0E40\u0E21\u0E19\u0E15\u0E31\u0E21\u0E2A\u0E39\u0E48\u0E09\u0E32\u0E01\u0E16\u0E31\u0E14\u0E44\u0E1B",
  "visualPrompt": "Cinematic 8K video prompt in English containing character lock, spatial positioning, start action, core action, and camera directives for 10s video",
  "scriptFormattedText": "\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E19\u0E35\u0E49\u0E15\u0E32\u0E21\u0E21\u0E32\u0E15\u0E23\u0E10\u0E32\u0E19\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23"
}
  ]
}`;
    const prompt = `[\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 (Master Story Source of Truth)]:
"""
${originalStory.trim()}
"""

[\u0E40\u0E1B\u0E49\u0E32\u0E2B\u0E21\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E23\u0E49\u0E32\u0E07]:
- \u0E2A\u0E23\u0E49\u0E32\u0E07 "\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 ${episodeNumber}"
- \u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A ${scenesPerEpisode} \u0E09\u0E32\u0E01\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E01\u0E31\u0E19 (\u0E09\u0E32\u0E01\u0E25\u0E30\u0E1B\u0E23\u0E30\u0E21\u0E32\u0E13 ${clipDurationSeconds} \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35)
${episodeNumber === 1 ? "- \u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E21\u0E32\u0E01: \u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 1 \u0E43\u0E2B\u0E49\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E08\u0E32\u0E01\u0E0A\u0E48\u0E27\u0E07\u0E15\u0E49\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \u0E2B\u0E49\u0E32\u0E21\u0E2A\u0E23\u0E38\u0E1B\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E43\u0E19\u0E15\u0E2D\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27" : `- \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 ${episodeNumber} \u0E15\u0E48\u0E2D\u0E08\u0E32\u0E01\u0E08\u0E38\u0E14\u0E08\u0E1A\u0E02\u0E2D\u0E07\u0E15\u0E2D\u0E19\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E31\u0E19\u0E17\u0E35 \u0E44\u0E21\u0E48\u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15 \u0E44\u0E21\u0E48\u0E01\u0E23\u0E30\u0E42\u0E14\u0E14`}

[\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14\u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E35\u0E49 (LAST_SCENE_STATE)]:
${JSON.stringify(effectiveLastScene || "\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 1 \u0E09\u0E32\u0E01\u0E41\u0E23\u0E01 (\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E09\u0E32\u0E01\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32)", null, 2)}

[\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E17\u0E35\u0E48\u0E25\u0E47\u0E2D\u0E04\u0E44\u0E27\u0E49]:
${JSON.stringify(resolveCharacterProfiles(declaredNames, Array.isArray(characters) ? characters : [], parseScriptCharacterList(originalStory)).profiles.map((p) => ({ name: p.name, face: p.face || void 0, hair: p.hair || void 0, outfit: p.outfit || void 0, appearance: p.appearance || void 0, personality: p.personality || void 0, characterLock: formatCharacterAppearanceLock(p) })), null, 2)}

\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E1A\u0E31\u0E07\u0E04\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E21\u0E07\u0E27\u0E14:
1. \u0E40\u0E02\u0E35\u0E22\u0E19\u0E1A\u0E17 "\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 ${episodeNumber}" \u0E2D\u0E2D\u0E01\u0E21\u0E32\u0E40\u0E1B\u0E47\u0E19 ${scenesPerEpisode} \u0E09\u0E32\u0E01 (\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E17\u0E35\u0E48\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 ${startSceneNum})
2. END scene \u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E01\u0E48\u0E2D\u0E19 \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19 START scene \u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E16\u0E31\u0E14\u0E44\u0E1B\u0E17\u0E38\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07
3. \u0E25\u0E47\u0E2D\u0E04\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23 (\u0E40\u0E0A\u0E48\u0E19 \u0E1E\u0E35\u0E48\u0E17\u0E38\u0E22\u0E2D\u0E22\u0E39\u0E48\u0E0B\u0E49\u0E32\u0E22\u0E40\u0E2A\u0E32, \u0E19\u0E49\u0E2D\u0E07\u0E19\u0E49\u0E33\u0E2D\u0E22\u0E39\u0E48\u0E02\u0E27\u0E32\u0E40\u0E2A\u0E32) \u0E43\u0E2B\u0E49\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E43\u0E19\u0E17\u0E38\u0E01\u0E09\u0E32\u0E01
4. \u0E08\u0E31\u0E14\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21 episodeScriptText \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E27\u0E32\u0E07\u0E25\u0E07\u0E0A\u0E48\u0E2D\u0E07 "\u0E27\u0E32\u0E07\u0E1A\u0E17\u0E2B\u0E23\u0E37\u0E2D\u0E09\u0E32\u0E01\u0E2B\u0E25\u0E32\u0E22\u0E09\u0E32\u0E01" \u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34
5. \u0E2B\u0E49\u0E32\u0E21\u0E2A\u0E23\u0E38\u0E1B\u0E27\u0E48\u0E32\u0E08\u0E1A\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14 \u0E40\u0E27\u0E49\u0E19\u0E41\u0E15\u0E48\u0E08\u0E30\u0E40\u0E08\u0E2D\u0E04\u0E33\u0E27\u0E48\u0E32 "\u0E08\u0E1A\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07", "\u0E08\u0E1A\u0E1A\u0E23\u0E34\u0E1A\u0E39\u0E23\u0E13\u0E4C", "\u0E08\u0E1A\u0E09\u0E32\u0E01", "\u0E15\u0E2D\u0E19\u0E08\u0E1A", "\u0E08\u0E1A", "-\u0E08\u0E1A-", "THE END" \u0E43\u0E19\u0E09\u0E32\u0E01\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22/\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14\u0E17\u0E49\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A
6. \u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 "sourceCovered": true \u0E40\u0E09\u0E1E\u0E32\u0E30\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49\u0E04\u0E23\u0E2D\u0E1A\u0E04\u0E25\u0E38\u0E21\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A\u0E41\u0E25\u0E49\u0E27 (\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E2B\u0E15\u0E38\u0E01\u0E32\u0E23\u0E13\u0E4C\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E43\u0E2B\u0E49\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E15\u0E2D\u0E19\u0E15\u0E48\u0E2D\u0E44\u0E1B) \u0E21\u0E34\u0E09\u0E30\u0E19\u0E31\u0E49\u0E19\u0E43\u0E2B\u0E49\u0E40\u0E1B\u0E47\u0E19 false
7. \u0E2B\u0E31\u0E27\u0E02\u0E49\u0E2D\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E2D\u0E19/\u0E2D\u0E32\u0E23\u0E21\u0E13\u0E4C (\u0E40\u0E0A\u0E48\u0E19 "\u0E2D\u0E32\u0E23\u0E21\u0E13\u0E4C\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E36\u0E07\u0E40\u0E04\u0E23\u0E35\u0E22\u0E14", "\u0E04\u0E37\u0E19\u0E14\u0E35\u0E01\u0E31\u0E19") \u0E2B\u0E23\u0E37\u0E2D "\u0E2B\u0E19\u0E49\u0E32\u0E1A\u0E49\u0E32\u0E19\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07" \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48: "location" \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E08\u0E23\u0E34\u0E07\u0E02\u0E2D\u0E07\u0E09\u0E32\u0E01\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32 (\u0E40\u0E0A\u0E48\u0E19 "\u0E2B\u0E19\u0E49\u0E32\u0E1A\u0E49\u0E32\u0E19") \u0E41\u0E25\u0E30 "timeOfDay" \u0E40\u0E14\u0E34\u0E21
8. \u0E17\u0E48\u0E32\u0E17\u0E32\u0E07/\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E15\u0E2D\u0E19\u0E40\u0E23\u0E34\u0E48\u0E21\u0E09\u0E32\u0E01 (\u0E22\u0E37\u0E19/\u0E19\u0E31\u0E48\u0E07 \u0E2D\u0E22\u0E39\u0E48\u0E15\u0E23\u0E07\u0E44\u0E2B\u0E19) \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E17\u0E48\u0E32\u0E01\u0E31\u0E1A\u0E15\u0E2D\u0E19\u0E08\u0E1A\u0E09\u0E32\u0E01\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32 \u0E40\u0E27\u0E49\u0E19\u0E41\u0E15\u0E48\u0E1A\u0E17\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E02\u0E22\u0E31\u0E1A \u0E41\u0E25\u0E30\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E09\u0E32\u0E01\u0E15\u0E49\u0E2D\u0E07\u0E44\u0E21\u0E48\u0E2B\u0E32\u0E22\u0E44\u0E1B\u0E42\u0E14\u0E22\u0E1A\u0E17\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E2D\u0E2D\u0E01\u0E44\u0E1B
9. "speaker" \u0E41\u0E25\u0E30 "characters" \u0E15\u0E49\u0E2D\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E25\u0E49\u0E27\u0E19\u0E46 \u0E2B\u0E49\u0E32\u0E21\u0E21\u0E35\u0E04\u0E33\u0E01\u0E23\u0E34\u0E22\u0E32\u0E15\u0E48\u0E2D\u0E17\u0E49\u0E32\u0E22 (\u0E40\u0E0A\u0E48\u0E19 \u0E43\u0E0A\u0E49 "\u0E19\u0E49\u0E2D\u0E07\u0E1F\u0E49\u0E32\u0E43\u0E2A" \u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48 "\u0E19\u0E49\u0E2D\u0E07\u0E1F\u0E49\u0E32\u0E43\u0E2A\u0E01\u0E23\u0E30\u0E0B\u0E34\u0E1A") \u0E43\u0E2B\u0E49\u0E43\u0E2A\u0E48\u0E01\u0E23\u0E34\u0E22\u0E32/\u0E2D\u0E32\u0E23\u0E21\u0E13\u0E4C\u0E44\u0E27\u0E49\u0E43\u0E19 "emotionOrAction" \u0E41\u0E17\u0E19${declaredNames.length > 0 ? `
10. \u0E43\u0E0A\u0E49\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E15\u0E32\u0E21\u0E17\u0E35\u0E48\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E28\u0E44\u0E27\u0E49\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19: ${declaredNames.join(", ")} (\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E19\u0E2D\u0E01\u0E08\u0E2D \u0E40\u0E0A\u0E48\u0E19 "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E1B\u0E23\u0E34\u0E28\u0E19\u0E32" \u0E43\u0E2B\u0E49\u0E23\u0E30\u0E1A\u0E38\u0E40\u0E1B\u0E47\u0E19 speaker \u0E44\u0E14\u0E49 \u0E41\u0E15\u0E48\u0E2B\u0E49\u0E32\u0E21\u0E43\u0E2A\u0E48\u0E43\u0E19 "characters")` : ""}`;
    const storySceneSchema = {
      type: import_genai.Type.OBJECT,
      properties: {
        sceneNumber: { type: import_genai.Type.NUMBER },
        sceneHeading: { type: import_genai.Type.STRING },
        location: { type: import_genai.Type.STRING },
        timeOfDay: { type: import_genai.Type.STRING },
        characters: { type: import_genai.Type.ARRAY, items: { type: import_genai.Type.STRING } },
        characterPositions: { type: import_genai.Type.STRING },
        actionDescription: { type: import_genai.Type.STRING },
        startAction: { type: import_genai.Type.STRING },
        dialogues: {
          type: import_genai.Type.ARRAY,
          items: {
            type: import_genai.Type.OBJECT,
            properties: {
              speaker: { type: import_genai.Type.STRING },
              emotionOrAction: { type: import_genai.Type.STRING },
              dialogue: { type: import_genai.Type.STRING }
            },
            required: ["speaker", "dialogue"]
          }
        },
        endState: { type: import_genai.Type.STRING },
        visualPrompt: { type: import_genai.Type.STRING },
        scriptFormattedText: { type: import_genai.Type.STRING }
      },
      required: ["sceneNumber", "sceneHeading", "location", "timeOfDay", "characters", "actionDescription", "startAction", "dialogues", "endState", "visualPrompt"]
    };
    const storyEpisodeSchema = {
      type: import_genai.Type.OBJECT,
      properties: {
        isStoryFinished: { type: import_genai.Type.BOOLEAN },
        finishMessage: { type: import_genai.Type.STRING },
        episodeNumber: { type: import_genai.Type.NUMBER },
        episodeTitle: { type: import_genai.Type.STRING },
        progressPercentage: { type: import_genai.Type.NUMBER },
        currentMilestone: { type: import_genai.Type.STRING },
        summaryOfEventsSoFar: { type: import_genai.Type.STRING },
        sourceCovered: { type: import_genai.Type.BOOLEAN },
        episodeScriptText: { type: import_genai.Type.STRING },
        scenes: { type: import_genai.Type.ARRAY, items: storySceneSchema }
      },
      required: ["isStoryFinished", "episodeNumber", "episodeTitle", "progressPercentage", "sourceCovered", "scenes"]
    };
    let rawText = "";
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.7,
          responseMimeType: "application/json",
          responseSchema: storyEpisodeSchema
        }
      });
      rawText = response.text || "";
    } catch (geminiErr) {
      const reason = formatGenAIError(geminiErr);
      console.warn("Gemini story continuation failed:", reason);
      return res.status(502).json({
        success: false,
        code: "GEMINI_API_ERROR",
        message: `Gemini \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1A\u0E17\u0E15\u0E48\u0E2D\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08: ${reason} / Gemini story generation failed. Please retry, check your API key, or choose offline mode.`
      });
    }
    let parsed = null;
    const cleanJson = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          parsed = null;
        }
      }
    }
    if (!parsed || typeof parsed !== "object") {
      return res.status(502).json({
        success: false,
        code: "GEMINI_INVALID_JSON",
        message: "Gemini \u0E15\u0E2D\u0E1A\u0E01\u0E25\u0E31\u0E1A\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48 JSON \u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48 / Gemini returned invalid JSON. Please try again."
      });
    }
    const validation = validateGeminiEpisodeScenes(parsed, startSceneNum, declaredNames);
    if (!validation.ok) {
      return res.status(502).json({
        success: false,
        code: "GEMINI_INVALID_SCENES",
        message: `Gemini \u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E09\u0E32\u0E01\u0E44\u0E21\u0E48\u0E04\u0E23\u0E1A\u0E16\u0E49\u0E27\u0E19 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48 / Gemini returned incomplete scene data: ${validation.errors.slice(0, 5).join("; ")}`,
        details: validation.errors
      });
    }
    const locked = applyEpisodeLocks(validation.scenes, {
      originalStory,
      characters,
      continuityLock,
      lastSceneState: effectiveLastScene,
      declaredNames,
      existingScenes
    });
    parsed.scenes = locked.scenes;
    parsed.continuityWarnings = locked.warnings;
    parsed.characterWarnings = locked.characterWarnings;
    if (hasExplicitEnd && parsed.sourceCovered === true) {
      parsed.isStoryFinished = true;
      parsed.finishMessage = parsed.finishMessage || "\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E08\u0E1A\u0E41\u0E25\u0E49\u0E27\u0E15\u0E32\u0E21\u0E15\u0E49\u0E19\u0E09\u0E1A\u0E31\u0E1A (\u0E1E\u0E1A\u0E04\u0E33\u0E23\u0E30\u0E1A\u0E38\u0E08\u0E38\u0E14\u0E08\u0E1A\u0E43\u0E19\u0E09\u0E32\u0E01\u0E2A\u0E38\u0E14\u0E17\u0E49\u0E32\u0E22)";
    } else {
      parsed.isStoryFinished = false;
      parsed.finishMessage = "";
    }
    parsed.hasMoreScenes = parsed.sourceCovered !== true && !parsed.isStoryFinished;
    if (!parsed.episodeScriptText || typeof parsed.episodeScriptText !== "string" || !parsed.episodeScriptText.trim()) {
      const epTitle = parsed.episodeTitle || `\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 ${episodeNumber}`;
      parsed.episodeScriptText = `[${epTitle}]

` + parsed.scenes.map((s) => s.scriptFormattedText || `${s.sceneHeading}
${s.actionDescription}`).join("\n\n");
    }
    parsed.nextScene = parsed.scenes[0];
    parsed.episodeNumber = episodeNumber;
    return res.json({
      ...parsed,
      success: true,
      source: "gemini-flash",
      declaredCharacters: declaredNames
    });
  } catch (err) {
    console.error("Error in /api/story/continue:", err?.message || err);
    return res.status(500).json({
      success: false,
      message: err?.message || "\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E43\u0E19\u0E01\u0E32\u0E23\u0E15\u0E48\u0E2D\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23"
    });
  }
});
function parseImageData(dataUrlOrBase64) {
  if (!dataUrlOrBase64 || typeof dataUrlOrBase64 !== "string") return null;
  const trimmed = dataUrlOrBase64.trim();
  if (!trimmed) return null;
  let mimeType = "image/jpeg";
  let base64Data = trimmed;
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    base64Data = match[2].trim();
  }
  if (base64Data.startsWith("/9j/")) mimeType = "image/jpeg";
  else if (base64Data.startsWith("iVBORw0KGgo")) mimeType = "image/png";
  else if (base64Data.startsWith("UklGR")) mimeType = "image/webp";
  else if (base64Data.startsWith("R0lGOD")) mimeType = "image/gif";
  if (!mimeType.startsWith("image/")) {
    mimeType = "image/jpeg";
  }
  return { mimeType, base64Data };
}
function persistReferenceImage(imageData, customId) {
  const parsed = parseImageData(imageData);
  if (!parsed || !parsed.base64Data) {
    throw new Error("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07 \u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E41\u0E1B\u0E25\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E20\u0E32\u0E1E\u0E44\u0E14\u0E49");
  }
  const imageHash = import_crypto2.default.createHash("sha256").update(parsed.base64Data).digest("hex");
  const refId = customId || `ref_${imageHash.slice(0, 10)}_${Date.now()}`;
  const ext = parsed.mimeType.includes("png") ? "png" : parsed.mimeType.includes("webp") ? "webp" : "jpg";
  const filename = `${refId}.${ext}`;
  const filepath = import_path.default.join(UPLOADS_CHARACTERS_DIR, filename);
  const buffer = Buffer.from(parsed.base64Data, "base64");
  import_fs.default.writeFileSync(filepath, buffer);
  const referenceImageUrl = `/uploads/characters/${filename}`;
  return {
    referenceImageId: refId,
    referenceImageUrl,
    imageHash
  };
}
var visionAnalysisCache = /* @__PURE__ */ new Map();
var PRAE_MASTER_HASH = "38ed715e729e441ce92056fc2d82324d452f0a7dbf8a769fbd98a4e6aba5dace";
visionAnalysisCache.set(PRAE_MASTER_HASH, {
  imageHash: PRAE_MASTER_HASH,
  timestamp: Date.now(),
  data: {
    creatureType: "",
    species: "",
    name: "\u0E41\u0E1E\u0E23 / Prae",
    suggestedName: "\u0E41\u0E1E\u0E23 / Prae",
    detectedName: "\u0E41\u0E1E\u0E23 / Prae",
    age: "22 \u0E1B\u0E35",
    detectedAge: "22",
    detectedHeight: "165 cm",
    availableViews: ["FRONT", "FACE_CLOSEUP"],
    imageHash: PRAE_MASTER_HASH,
    referenceImageId: "ref_prae_master",
    referenceImageUrl: "/uploads/characters/ref_prae_master.jpg",
    gender: "\u0E2B\u0E0D\u0E34\u0E07",
    skinTone: "\u0E1C\u0E34\u0E27\u0E2A\u0E2D\u0E07\u0E2A\u0E35\u0E40\u0E19\u0E35\u0E22\u0E19\u0E1C\u0E48\u0E2D\u0E07",
    faceShape: "\u0E23\u0E39\u0E1B\u0E44\u0E02\u0E48\u0E25\u0E30\u0E21\u0E38\u0E19",
    hairStyle: "\u0E1C\u0E21\u0E22\u0E32\u0E27\u0E1B\u0E23\u0E30\u0E1A\u0E48\u0E32\u0E14\u0E31\u0E14\u0E25\u0E2D\u0E19\u0E04\u0E25\u0E37\u0E48\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34",
    hairColor: "\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E40\u0E02\u0E49\u0E21\u0E0A\u0E47\u0E2D\u0E01\u0E42\u0E01\u0E41\u0E25\u0E15",
    eyeDescription: "\u0E15\u0E32\u0E01\u0E25\u0E21\u0E42\u0E15\u0E2A\u0E14\u0E43\u0E2A\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25",
    bodyType: "\u0E2A\u0E21\u0E2A\u0E48\u0E27\u0E19",
    topClothing: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E04\u0E2D\u0E1B\u0E01\u0E1C\u0E49\u0E32\u0E1D\u0E49\u0E32\u0E22\u0E2A\u0E35\u0E04\u0E23\u0E35\u0E21\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
    bottomClothing: "\u0E01\u0E32\u0E07\u0E40\u0E01\u0E07\u0E02\u0E32\u0E22\u0E32\u0E27\u0E1C\u0E49\u0E32\u0E25\u0E34\u0E19\u0E34\u0E19\u0E2A\u0E35\u0E40\u0E1A\u0E08",
    footwear: "\u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32\u0E04\u0E31\u0E17\u0E0A\u0E39\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E2D\u0E48\u0E2D\u0E19",
    accessories: "\u0E15\u0E48\u0E32\u0E07\u0E2B\u0E39\u0E2B\u0E48\u0E27\u0E07\u0E40\u0E07\u0E34\u0E19\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
    distinctFeatures: "\u0E23\u0E2D\u0E22\u0E22\u0E34\u0E49\u0E21\u0E2A\u0E14\u0E43\u0E2A\u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E1C\u0E34\u0E27\u0E2A\u0E2D\u0E07\u0E2A\u0E35\u0E40\u0E19\u0E35\u0E22\u0E19\u0E1C\u0E48\u0E2D\u0E07",
    description: "\u0E2B\u0E0D\u0E34\u0E07\u0E2A\u0E32\u0E27\u0E27\u0E31\u0E22\u0E23\u0E38\u0E48\u0E19\u0E44\u0E17\u0E22 \u0E14\u0E27\u0E07\u0E15\u0E32\u0E01\u0E25\u0E21\u0E42\u0E15\u0E40\u0E1B\u0E47\u0E19\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22 \u0E23\u0E2D\u0E22\u0E22\u0E34\u0E49\u0E21\u0E2A\u0E14\u0E43\u0E2A\u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E1C\u0E34\u0E27\u0E2A\u0E2D\u0E07\u0E2A\u0E35\u0E40\u0E19\u0E35\u0E22\u0E19\u0E1C\u0E48\u0E2D\u0E07 \u0E1C\u0E21\u0E22\u0E32\u0E27\u0E1B\u0E23\u0E30\u0E1A\u0E48\u0E32\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E40\u0E02\u0E49\u0E21",
    outfitDescription: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E04\u0E2D\u0E1B\u0E01\u0E1C\u0E49\u0E32\u0E1D\u0E49\u0E32\u0E22\u0E2A\u0E35\u0E04\u0E23\u0E35\u0E21\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25 \u0E01\u0E32\u0E07\u0E40\u0E01\u0E07\u0E02\u0E32\u0E22\u0E32\u0E27\u0E1C\u0E49\u0E32\u0E25\u0E34\u0E19\u0E34\u0E19\u0E2A\u0E35\u0E40\u0E1A\u0E08",
    confidence: 95,
    fullSummary: "\u0E2B\u0E0D\u0E34\u0E07\u0E2A\u0E32\u0E27\u0E27\u0E31\u0E22\u0E23\u0E38\u0E48\u0E19\u0E44\u0E17\u0E22 \u0E14\u0E27\u0E07\u0E15\u0E32\u0E01\u0E25\u0E21\u0E42\u0E15\u0E40\u0E1B\u0E47\u0E19\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22 \u0E23\u0E2D\u0E22\u0E22\u0E34\u0E49\u0E21\u0E2A\u0E14\u0E43\u0E2A \u0E1C\u0E21\u0E22\u0E32\u0E27\u0E1B\u0E23\u0E30\u0E1A\u0E48\u0E32\u0E14\u0E31\u0E14\u0E25\u0E2D\u0E19\u0E04\u0E25\u0E37\u0E48\u0E19\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E40\u0E02\u0E49\u0E21 \u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E04\u0E2D\u0E1B\u0E01\u0E1C\u0E49\u0E32\u0E1D\u0E49\u0E32\u0E22\u0E2A\u0E35\u0E04\u0E23\u0E35\u0E21\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
    structured: {
      creatureType: "",
      species: "",
      name: "\u0E41\u0E1E\u0E23 / Prae",
      gender: "\u0E2B\u0E0D\u0E34\u0E07",
      ageRange: "22 \u0E1B\u0E35",
      skinTone: "\u0E1C\u0E34\u0E27\u0E2A\u0E2D\u0E07\u0E2A\u0E35\u0E40\u0E19\u0E35\u0E22\u0E19\u0E1C\u0E48\u0E2D\u0E07",
      faceShape: "\u0E23\u0E39\u0E1B\u0E44\u0E02\u0E48\u0E25\u0E30\u0E21\u0E38\u0E19",
      hairStyle: "\u0E1C\u0E21\u0E22\u0E32\u0E27\u0E1B\u0E23\u0E30\u0E1A\u0E48\u0E32\u0E14\u0E31\u0E14\u0E25\u0E2D\u0E19\u0E04\u0E25\u0E37\u0E48\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34",
      hairColor: "\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E40\u0E02\u0E49\u0E21\u0E0A\u0E47\u0E2D\u0E01\u0E42\u0E01\u0E41\u0E25\u0E15",
      eyeDescription: "\u0E15\u0E32\u0E01\u0E25\u0E21\u0E42\u0E15\u0E2A\u0E14\u0E43\u0E2A\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25",
      bodyType: "\u0E2A\u0E21\u0E2A\u0E48\u0E27\u0E19",
      topClothing: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E04\u0E2D\u0E1B\u0E01\u0E1C\u0E49\u0E32\u0E1D\u0E49\u0E32\u0E22\u0E2A\u0E35\u0E04\u0E23\u0E35\u0E21\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
      bottomClothing: "\u0E01\u0E32\u0E07\u0E40\u0E01\u0E07\u0E02\u0E32\u0E22\u0E32\u0E27\u0E1C\u0E49\u0E32\u0E25\u0E34\u0E19\u0E34\u0E19\u0E2A\u0E35\u0E40\u0E1A\u0E08",
      footwear: "\u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32\u0E04\u0E31\u0E17\u0E0A\u0E39\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E2D\u0E48\u0E2D\u0E19",
      accessories: "\u0E15\u0E48\u0E32\u0E07\u0E2B\u0E39\u0E2B\u0E48\u0E27\u0E07\u0E40\u0E07\u0E34\u0E19\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
      distinctFeatures: "\u0E23\u0E2D\u0E22\u0E22\u0E34\u0E49\u0E21\u0E2A\u0E14\u0E43\u0E2A\u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E1C\u0E34\u0E27\u0E2A\u0E2D\u0E07\u0E2A\u0E35\u0E40\u0E19\u0E35\u0E22\u0E19\u0E1C\u0E48\u0E2D\u0E07",
      confidence: 95
    },
    characterIdentity: {
      id: "char_prae_05",
      name: "\u0E41\u0E1E\u0E23 / Prae"
    },
    referenceMetadata: {
      referenceImageId: "ref_prae_master",
      referenceImageUrl: "/uploads/characters/ref_prae_master.jpg",
      imageHash: PRAE_MASTER_HASH,
      detectedName: "\u0E41\u0E1E\u0E23 / Prae",
      detectedAge: "22",
      detectedHeight: "165 cm",
      availableViews: ["FRONT", "FACE_CLOSEUP"]
    },
    visualProfile: {
      imageHash: PRAE_MASTER_HASH,
      referenceImageId: "ref_prae_master",
      referenceImageUrl: "/uploads/characters/ref_prae_master.jpg",
      referenceImage: "/uploads/characters/ref_prae_master.jpg",
      referenceImages: ["/uploads/characters/ref_prae_master.jpg"],
      hairStyle: "\u0E1C\u0E21\u0E22\u0E32\u0E27\u0E1B\u0E23\u0E30\u0E1A\u0E48\u0E32\u0E14\u0E31\u0E14\u0E25\u0E2D\u0E19\u0E04\u0E25\u0E37\u0E48\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34",
      hairColor: "\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E40\u0E02\u0E49\u0E21\u0E0A\u0E47\u0E2D\u0E01\u0E42\u0E01\u0E41\u0E25\u0E15",
      top: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E04\u0E2D\u0E1B\u0E01\u0E1C\u0E49\u0E32\u0E1D\u0E49\u0E32\u0E22\u0E2A\u0E35\u0E04\u0E23\u0E35\u0E21\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
      bottom: "\u0E01\u0E32\u0E07\u0E40\u0E01\u0E07\u0E02\u0E32\u0E22\u0E32\u0E27\u0E1C\u0E49\u0E32\u0E25\u0E34\u0E19\u0E34\u0E19\u0E2A\u0E35\u0E40\u0E1A\u0E08",
      shoes: "\u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32\u0E04\u0E31\u0E17\u0E0A\u0E39\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E2D\u0E48\u0E2D\u0E19",
      accessories: "\u0E15\u0E48\u0E32\u0E07\u0E2B\u0E39\u0E2B\u0E48\u0E27\u0E07\u0E40\u0E07\u0E34\u0E19\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
      visibleDistinctiveDetails: "\u0E14\u0E27\u0E07\u0E15\u0E32\u0E01\u0E25\u0E21\u0E42\u0E15\u0E40\u0E1B\u0E47\u0E19\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22 \u0E23\u0E2D\u0E22\u0E22\u0E34\u0E49\u0E21\u0E2A\u0E14\u0E43\u0E2A\u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E1C\u0E34\u0E27\u0E2A\u0E2D\u0E07\u0E2A\u0E35\u0E40\u0E19\u0E35\u0E22\u0E19\u0E1C\u0E48\u0E2D\u0E07",
      imageAnalysisStatus: "USER_CONFIRMED",
      hair: "\u0E1C\u0E21\u0E22\u0E32\u0E27\u0E1B\u0E23\u0E30\u0E1A\u0E48\u0E32\u0E14\u0E31\u0E14\u0E25\u0E2D\u0E19\u0E04\u0E25\u0E37\u0E48\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E40\u0E02\u0E49\u0E21\u0E0A\u0E47\u0E2D\u0E01\u0E42\u0E01\u0E41\u0E25\u0E15",
      visibleOutfit: "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E04\u0E2D\u0E1B\u0E01\u0E1C\u0E49\u0E32\u0E1D\u0E49\u0E32\u0E22\u0E2A\u0E35\u0E04\u0E23\u0E35\u0E21\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25 \u0E01\u0E32\u0E07\u0E40\u0E01\u0E07\u0E02\u0E32\u0E22\u0E32\u0E27\u0E1C\u0E49\u0E32\u0E25\u0E34\u0E19\u0E34\u0E19\u0E2A\u0E35\u0E40\u0E1A\u0E08",
      visibleAccessories: "\u0E15\u0E48\u0E32\u0E07\u0E2B\u0E39\u0E2B\u0E48\u0E27\u0E07\u0E40\u0E07\u0E34\u0E19\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25",
      visiblePhysicalAppearance: "\u0E2B\u0E0D\u0E34\u0E07\u0E2A\u0E32\u0E27\u0E27\u0E31\u0E22\u0E23\u0E38\u0E48\u0E19\u0E44\u0E17\u0E22 \u0E14\u0E27\u0E07\u0E15\u0E32\u0E01\u0E25\u0E21\u0E42\u0E15\u0E40\u0E1B\u0E47\u0E19\u0E1B\u0E23\u0E30\u0E01\u0E32\u0E22 \u0E23\u0E2D\u0E22\u0E22\u0E34\u0E49\u0E21\u0E2A\u0E14\u0E43\u0E2A\u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34",
      visibleDistinguishingDetails: "\u0E23\u0E2D\u0E22\u0E22\u0E34\u0E49\u0E21\u0E2A\u0E14\u0E43\u0E2A\u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E1C\u0E34\u0E27\u0E2A\u0E2D\u0E07\u0E2A\u0E35\u0E40\u0E19\u0E35\u0E22\u0E19\u0E1C\u0E48\u0E2D\u0E07",
      detectedViews: ["FRONT", "FACE_CLOSEUP"],
      isMultiViewSheet: false,
      confidence: 95,
      generatedVisualPrompt: "Thai young woman Prae with warm brown wavy hair, cream shirt and beige linen trousers"
    },
    storyProfile: {
      age: "22 \u0E1B\u0E35",
      personality: "\u0E23\u0E48\u0E32\u0E40\u0E23\u0E34\u0E07 \u0E21\u0E2D\u0E07\u0E42\u0E25\u0E01\u0E43\u0E19\u0E41\u0E07\u0E48\u0E14\u0E35 \u0E2D\u0E1A\u0E2D\u0E38\u0E48\u0E19 \u0E21\u0E35\u0E04\u0E27\u0E32\u0E21\u0E21\u0E38\u0E48\u0E07\u0E21\u0E31\u0E48\u0E19\u0E2A\u0E39\u0E07",
      role: "\u0E19\u0E32\u0E07\u0E40\u0E2D\u0E01\u0E0B\u0E35\u0E23\u0E35\u0E2A\u0E4C\u0E42\u0E23\u0E41\u0E21\u0E19\u0E15\u0E34\u0E01\u0E14\u0E23\u0E32\u0E21\u0E48\u0E32",
      occupation: "\u0E19\u0E31\u0E01\u0E2D\u0E2D\u0E01\u0E41\u0E1A\u0E1A\u0E01\u0E23\u0E32\u0E1F\u0E34\u0E01\u0E2D\u0E34\u0E2A\u0E23\u0E30",
      background: "\u0E2A\u0E32\u0E27\u0E19\u0E49\u0E2D\u0E22\u0E1C\u0E39\u0E49\u0E23\u0E31\u0E01\u0E07\u0E32\u0E19\u0E28\u0E34\u0E25\u0E1B\u0E30 \u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07\u0E21\u0E32\u0E15\u0E32\u0E21\u0E2B\u0E32\u0E41\u0E23\u0E07\u0E1A\u0E31\u0E19\u0E14\u0E32\u0E25\u0E43\u0E08\u0E43\u0E2B\u0E21\u0E48\u0E43\u0E19\u0E40\u0E21\u0E37\u0E2D\u0E07\u0E2B\u0E25\u0E27\u0E07"
    },
    fieldSources: {
      name: "REFERENCE_TEXT",
      age: "REFERENCE_TEXT",
      hairStyle: "VISUAL_OBSERVATION",
      hairColor: "VISUAL_OBSERVATION",
      top: "VISUAL_OBSERVATION",
      bottom: "VISUAL_OBSERVATION",
      shoes: "VISUAL_OBSERVATION",
      accessories: "VISUAL_OBSERVATION",
      distinctFeatures: "VISUAL_OBSERVATION",
      gender: "VISUAL_OBSERVATION",
      role: "UNKNOWN",
      personality: "UNKNOWN",
      occupation: "UNKNOWN",
      background: "UNKNOWN"
    }
  }
});
app.post("/api/character/upload-reference", async (req, res) => {
  try {
    const { image, imageHash, referenceImageId } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ success: false, message: "Image data is required" });
    }
    if (image.startsWith("blob:")) {
      return res.status(400).json({
        success: false,
        message: "\u0E44\u0E21\u0E48\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15\u0E43\u0E2B\u0E49\u0E43\u0E0A\u0E49 blob URL \u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E40\u0E1B\u0E47\u0E19 Reference Image \u0E16\u0E32\u0E27\u0E23 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E2A\u0E48\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07"
      });
    }
    if (image.startsWith("/uploads/") || image.startsWith("http://") || image.startsWith("https://")) {
      const hash = imageHash || import_crypto2.default.createHash("sha256").update(image).digest("hex");
      const refId = referenceImageId || `ref_${hash.slice(0, 10)}_${Date.now()}`;
      return res.json({
        success: true,
        referenceImageId: refId,
        referenceImageUrl: image,
        imageHash: hash
      });
    }
    const persisted = persistReferenceImage(image, referenceImageId);
    return res.json({
      success: true,
      referenceImageId: persisted.referenceImageId,
      referenceImageUrl: persisted.referenceImageUrl,
      imageHash: persisted.imageHash
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to upload reference image"
    });
  }
});
app.post("/api/character/analyze-image", async (req, res) => {
  try {
    const { image, images, apiKey, forceReanalyze } = req.body || {};
    const rawImagesList = Array.isArray(images) ? images.filter((img) => typeof img === "string" && img.trim().length > 0) : image && typeof image === "string" && image.trim().length > 0 ? [image] : [];
    if (rawImagesList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E2A\u0E48\u0E07\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E base64 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E2B\u0E49 AI \u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C (Image base64 is required)"
      });
    }
    const parsedImages = rawImagesList.map((img) => parseImageData(img)).filter((p) => p !== null && p.base64Data.length > 0).slice(0, 4);
    if (parsedImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07 \u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E16\u0E2D\u0E14\u0E23\u0E2B\u0E31\u0E2A base64 \u0E44\u0E14\u0E49"
      });
    }
    const primaryParsed = parsedImages[0];
    const supportingParsed = parsedImages.slice(1);
    const primaryImageHash = import_crypto2.default.createHash("sha256").update(primaryParsed.base64Data).digest("hex");
    if (!forceReanalyze && visionAnalysisCache.has(primaryImageHash)) {
      const cached = visionAnalysisCache.get(primaryImageHash);
      console.log(`[Vision API Cost Guard] Cache hit for imageHash: ${primaryImageHash}. Skipping Gemini Vision call.`);
      return res.json({
        success: true,
        source: "cache",
        cached: true,
        data: cached.data
      });
    }
    const ai = getGeminiClient(apiKey);
    if (ai) {
      try {
        const systemInstruction = `\u0E04\u0E38\u0E13\u0E40\u0E1B\u0E47\u0E19 AI \u0E1C\u0E39\u0E49\u0E40\u0E0A\u0E35\u0E48\u0E22\u0E27\u0E0A\u0E32\u0E0D\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E20\u0E32\u0E1E\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E41\u0E25\u0E30 Reference Sheet \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E07\u0E32\u0E19\u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C\u0E41\u0E25\u0E30\u0E2A\u0E15\u0E39\u0E14\u0E34\u0E42\u0E2D\u0E41\u0E2D\u0E19\u0E34\u0E40\u0E21\u0E0A\u0E31\u0E19 (Concept Art & Character Consistency Analyzer)
\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E04\u0E37\u0E2D: \u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E20\u0E32\u0E1E\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E08\u0E32\u0E01\u0E23\u0E39\u0E1B\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07\u0E08\u0E23\u0E34\u0E07 \u0E42\u0E14\u0E22\u0E22\u0E36\u0E14\u0E2B\u0E25\u0E31\u0E01\u0E02\u0E49\u0E2D\u0E40\u0E17\u0E47\u0E08\u0E08\u0E23\u0E34\u0E07\u0E17\u0E32\u0E07\u0E2A\u0E32\u0E22\u0E15\u0E32 (Visual Ground Truth) \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32 \u0E2B\u0E49\u0E32\u0E21\u0E04\u0E34\u0E14\u0E41\u0E17\u0E19 \u0E41\u0E25\u0E30\u0E2B\u0E49\u0E32\u0E21\u0E41\u0E15\u0E48\u0E07\u0E40\u0E15\u0E34\u0E21

*** \u0E25\u0E33\u0E14\u0E31\u0E1A\u0E02\u0E31\u0E49\u0E19\u0E15\u0E2D\u0E19\u0E41\u0E25\u0E30\u0E01\u0E0E\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E1A\u0E31\u0E07\u0E04\u0E31\u0E1A\u0E40\u0E02\u0E49\u0E21\u0E07\u0E27\u0E14\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 (STRICT PROTOCOL) ***:

1. [SOURCE OF TRUTH \u0E25\u0E33\u0E14\u0E31\u0E1A\u0E17\u0E35\u0E48 1: REFERENCE_TEXT (\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E43\u0E19\u0E20\u0E32\u0E1E/Reference Sheet OCR)]
   - \u0E15\u0E23\u0E27\u0E08\u0E2B\u0E32\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21 \u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23 \u0E2B\u0E23\u0E37\u0E2D\u0E1B\u0E49\u0E32\u0E22\u0E01\u0E33\u0E01\u0E31\u0E1A\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E17\u0E35\u0E48\u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E02\u0E35\u0E22\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E20\u0E32\u0E1E Reference Sheet:
     * "detectedName": \u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E17\u0E35\u0E48\u0E1B\u0E23\u0E32\u0E01\u0E0F\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19\u0E43\u0E19\u0E20\u0E32\u0E1E \u0E40\u0E0A\u0E48\u0E19 "\u0E41\u0E1E\u0E23 / Prae", "Prae", "\u0E41\u0E1E\u0E23" (\u0E16\u0E49\u0E32\u0E21\u0E35\u0E43\u0E2B\u0E49\u0E14\u0E36\u0E07\u0E21\u0E32\u0E15\u0E23\u0E07\u0E15\u0E31\u0E27\u0E40\u0E1B\u0E4A\u0E30)
     * "detectedAge": \u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E2D\u0E32\u0E22\u0E38\u0E17\u0E35\u0E48\u0E1B\u0E23\u0E32\u0E01\u0E0F\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19\u0E43\u0E19\u0E20\u0E32\u0E1E \u0E40\u0E0A\u0E48\u0E19 "30" \u0E2B\u0E23\u0E37\u0E2D "30 \u0E1B\u0E35"
       *** \u0E01\u0E0E\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14: \u0E16\u0E49\u0E32\u0E23\u0E39\u0E1B\u0E40\u0E02\u0E35\u0E22\u0E19 "AGE: 30" \u0E2B\u0E23\u0E37\u0E2D "30" \u0E15\u0E49\u0E2D\u0E07\u0E15\u0E2D\u0E1A "30" \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19! \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E04\u0E48\u0E32\u0E1B\u0E23\u0E30\u0E21\u0E32\u0E13\u0E2B\u0E23\u0E37\u0E2D\u0E0A\u0E48\u0E27\u0E07\u0E2D\u0E32\u0E22\u0E38 \u0E40\u0E0A\u0E48\u0E19 "25-30" \u0E2B\u0E23\u0E37\u0E2D "\u0E1B\u0E23\u0E30\u0E21\u0E32\u0E13 25-30 \u0E1B\u0E35" \u0E42\u0E14\u0E22\u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32! ***
     * "detectedHeight": \u0E2A\u0E48\u0E27\u0E19\u0E2A\u0E39\u0E07\u0E17\u0E35\u0E48\u0E40\u0E02\u0E35\u0E22\u0E19\u0E43\u0E19\u0E20\u0E32\u0E1E \u0E40\u0E0A\u0E48\u0E19 "182 cm" \u0E2B\u0E23\u0E37\u0E2D "182 \u0E0B\u0E21."
       *** \u0E01\u0E0E\u0E40\u0E2B\u0E25\u0E47\u0E01: \u0E16\u0E49\u0E32\u0E23\u0E39\u0E1B\u0E40\u0E02\u0E35\u0E22\u0E19 "HEIGHT: 182 cm" \u0E15\u0E49\u0E2D\u0E07\u0E15\u0E2D\u0E1A "182 cm" \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E39\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E08\u0E32\u0E01\u0E2A\u0E23\u0E35\u0E23\u0E30\u0E42\u0E14\u0E22\u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14 ***
   - \u0E2B\u0E32\u0E01\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E40\u0E2B\u0E25\u0E48\u0E32\u0E19\u0E35\u0E49\u0E43\u0E19\u0E23\u0E39\u0E1B \u0E43\u0E2B\u0E49\u0E40\u0E27\u0E49\u0E19\u0E27\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E47\u0E19 "" \u0E2B\u0E49\u0E32\u0E21\u0E41\u0E15\u0E48\u0E07\u0E40\u0E15\u0E34\u0E21\u0E02\u0E36\u0E49\u0E19\u0E21\u0E32\u0E40\u0E2D\u0E07

2. [REFERENCE SHEET \u0E15\u0E49\u0E2D\u0E07\u0E23\u0E39\u0E49\u0E27\u0E48\u0E32\u0E40\u0E1B\u0E47\u0E19\u0E04\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27 (SINGLE CHARACTER)]
   - \u0E16\u0E49\u0E32\u0E23\u0E39\u0E1B\u0E21\u0E35\u0E2B\u0E25\u0E32\u0E22\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07 (\u0E40\u0E0A\u0E48\u0E19 FRONT, FACE CLOSE-UP, 3/4 VIEW, SIDE, BACK, DETAIL SHOTS) \u0E43\u0E2B\u0E49\u0E16\u0E37\u0E2D\u0E27\u0E48\u0E32\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E40\u0E1B\u0E47\u0E19\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E04\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27\u0E01\u0E31\u0E19 (Single Character)
   - \u0E2B\u0E49\u0E32\u0E21\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2B\u0E25\u0E32\u0E22 Character \u0E2B\u0E49\u0E32\u0E21\u0E04\u0E34\u0E14\u0E27\u0E48\u0E32\u0E20\u0E32\u0E1E Close-up \u0E04\u0E37\u0E2D\u0E04\u0E19\u0E2D\u0E35\u0E01\u0E04\u0E19
   - \u0E15\u0E23\u0E27\u0E08\u0E08\u0E31\u0E1A\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E21\u0E35\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E20\u0E32\u0E1E\u0E25\u0E07\u0E43\u0E19 "availableViews":
     \u0E40\u0E25\u0E37\u0E2D\u0E01\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E17\u0E35\u0E48\u0E21\u0E35\u0E08\u0E23\u0E34\u0E07\u0E08\u0E32\u0E01: ["FRONT", "FACE_CLOSEUP", "THREE_QUARTER", "SIDE", "BACK", "FULL_BODY", "OUTFIT_DETAIL", "ACCESSORY_DETAIL", "SHOE_DETAIL"]

3. [SOURCE OF TRUTH \u0E25\u0E33\u0E14\u0E31\u0E1A\u0E17\u0E35\u0E48 2: VISUAL_OBSERVATION (\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E23\u0E34\u0E07\u0E08\u0E32\u0E01\u0E2A\u0E32\u0E22\u0E15\u0E32)]
   - "creatureType": "human" | "anthropomorphic mammal" | "anthropomorphic reptile" | "fantasy creature" | "unknown"
   - "species": \u0E2A\u0E32\u0E22\u0E1E\u0E31\u0E19\u0E18\u0E38\u0E4C \u0E16\u0E49\u0E32\u0E44\u0E21\u0E48\u0E21\u0E31\u0E48\u0E19\u0E43\u0E08 80% \u0E43\u0E2B\u0E49\u0E43\u0E0A\u0E49\u0E04\u0E33\u0E01\u0E27\u0E49\u0E32\u0E07
   - "hairStyle": \u0E17\u0E23\u0E07\u0E1C\u0E21\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E23\u0E34\u0E07 \u0E40\u0E0A\u0E48\u0E19 "\u0E1C\u0E21\u0E2A\u0E31\u0E49\u0E19\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E04\u0E32\u0E07/\u0E15\u0E49\u0E19\u0E04\u0E2D \u0E17\u0E23\u0E07\u0E1A\u0E4A\u0E2D\u0E1A\u0E2A\u0E31\u0E49\u0E19"
   - "hairColor": \u0E2A\u0E35\u0E1C\u0E21\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E23\u0E34\u0E07 \u0E40\u0E0A\u0E48\u0E19 "\u0E2A\u0E35\u0E14\u0E33"
   - "topClothing": \u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E1C\u0E49\u0E32\u0E17\u0E48\u0E2D\u0E19\u0E1A\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E23\u0E34\u0E07 \u0E40\u0E0A\u0E48\u0E19 "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E2A\u0E35\u0E1F\u0E49\u0E32\u0E2D\u0E48\u0E2D\u0E19 \u0E41\u0E02\u0E19\u0E1E\u0E31\u0E1A \u0E21\u0E35\u0E25\u0E32\u0E22\u0E1B\u0E31\u0E01\u0E14\u0E2D\u0E01\u0E44\u0E21\u0E49\u0E40\u0E25\u0E47\u0E01\u0E1A\u0E23\u0E34\u0E40\u0E27\u0E13\u0E1B\u0E01"
   - "bottomClothing": \u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E1C\u0E49\u0E32\u0E17\u0E48\u0E2D\u0E19\u0E25\u0E48\u0E32\u0E07\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E23\u0E34\u0E07 \u0E40\u0E0A\u0E48\u0E19 "\u0E01\u0E32\u0E07\u0E40\u0E01\u0E07\u0E22\u0E35\u0E19\u0E2A\u0E4C\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E40\u0E07\u0E34\u0E19\u0E40\u0E02\u0E49\u0E21"
   - "footwear": \u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E23\u0E34\u0E07 \u0E40\u0E0A\u0E48\u0E19 "\u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32\u0E1C\u0E49\u0E32\u0E43\u0E1A\u0E2A\u0E35\u0E02\u0E32\u0E27"
   - "accessories": \u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E1B\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E41\u0E25\u0E30\u0E2A\u0E34\u0E48\u0E07\u0E02\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E23\u0E34\u0E07 \u0E40\u0E0A\u0E48\u0E19 "\u0E2A\u0E23\u0E49\u0E2D\u0E22\u0E04\u0E2D\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E08\u0E35\u0E49\u0E21\u0E38\u0E01\u0E02\u0E19\u0E32\u0E14\u0E40\u0E25\u0E47\u0E01"
   - "distinctFeatures": \u0E08\u0E38\u0E14\u0E40\u0E14\u0E48\u0E19\u0E17\u0E32\u0E07\u0E01\u0E32\u0E22\u0E20\u0E32\u0E1E\u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E23\u0E34\u0E07 \u0E40\u0E0A\u0E48\u0E19 "\u0E2A\u0E23\u0E49\u0E2D\u0E22\u0E04\u0E2D\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E08\u0E35\u0E49\u0E21\u0E38\u0E01\u0E02\u0E19\u0E32\u0E14\u0E40\u0E25\u0E47\u0E01, \u0E1B\u0E01\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E21\u0E35\u0E25\u0E32\u0E22\u0E1B\u0E31\u0E01\u0E14\u0E2D\u0E01\u0E44\u0E21\u0E49\u0E40\u0E25\u0E47\u0E01"
   - \u0E2B\u0E32\u0E01\u0E21\u0E2D\u0E07\u0E44\u0E21\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E43\u0E14 \u0E40\u0E0A\u0E48\u0E19 \u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32 \u0E2B\u0E23\u0E37\u0E2D \u0E17\u0E48\u0E2D\u0E19\u0E25\u0E48\u0E32\u0E07 \u0E43\u0E2B\u0E49\u0E15\u0E2D\u0E1A\u0E27\u0E48\u0E32 "\u0E44\u0E21\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E0A\u0E31\u0E14\u0E43\u0E19\u0E20\u0E32\u0E1E" \u0E2B\u0E23\u0E37\u0E2D "\u0E44\u0E21\u0E48\u0E21\u0E35" \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32!

4. [\u0E01\u0E0E\u0E40\u0E2B\u0E25\u0E47\u0E01: \u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32\u0E42\u0E14\u0E22\u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14 (FORBIDDEN TO GUESS)]
   \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E15\u0E48\u0E2D\u0E44\u0E1B\u0E19\u0E35\u0E49\u0E08\u0E32\u0E01\u0E20\u0E32\u0E1E\u0E40\u0E14\u0E47\u0E14\u0E02\u0E32\u0E14:
   - \u0E2D\u0E32\u0E0A\u0E35\u0E1E (occupation)
   - \u0E19\u0E34\u0E2A\u0E31\u0E22 (personality)
   - \u0E10\u0E32\u0E19\u0E30 (wealth)
   - \u0E04\u0E27\u0E32\u0E21\u0E2A\u0E31\u0E21\u0E1E\u0E31\u0E19\u0E18\u0E4C (relationship)
   - \u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E0A\u0E35\u0E27\u0E34\u0E15 (life backstory)
   - \u0E40\u0E0A\u0E37\u0E49\u0E2D\u0E0A\u0E32\u0E15\u0E34 (ethnicity)
   - \u0E28\u0E32\u0E2A\u0E19\u0E32 (religion)
   - \u0E2A\u0E38\u0E02\u0E20\u0E32\u0E1E (health)
   - \u0E04\u0E27\u0E32\u0E21\u0E09\u0E25\u0E32\u0E14 (intelligence)
   - \u0E1A\u0E17\u0E1A\u0E32\u0E17\u0E43\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07 (story role)
   \u0E43\u0E2B\u0E49\u0E1B\u0E25\u0E48\u0E2D\u0E22\u0E27\u0E48\u0E32\u0E07\u0E44\u0E27\u0E49 \u0E44\u0E21\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E40\u0E14\u0E32

5. [\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07 JSON \u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E2A\u0E48\u0E07\u0E01\u0E25\u0E31\u0E1A (valid JSON format \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \u0E2B\u0E49\u0E32\u0E21\u0E43\u0E2A\u0E48 markdown block)]
{
  "detectedName": "\u0E0A\u0E37\u0E48\u0E2D\u0E08\u0E32\u0E01\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E43\u0E19\u0E20\u0E32\u0E1E \u0E2B\u0E23\u0E37\u0E2D\u0E27\u0E48\u0E32\u0E07",
  "detectedAge": "\u0E2D\u0E32\u0E22\u0E38\u0E08\u0E32\u0E01\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E43\u0E19\u0E20\u0E32\u0E1E (\u0E40\u0E0A\u0E48\u0E19 30 \u0E2B\u0E49\u0E32\u0E21\u0E15\u0E2D\u0E1A\u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E48\u0E27\u0E07 25-30) \u0E2B\u0E23\u0E37\u0E2D\u0E27\u0E48\u0E32\u0E07",
  "detectedHeight": "\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E39\u0E07\u0E08\u0E32\u0E01\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E43\u0E19\u0E20\u0E32\u0E1E (\u0E40\u0E0A\u0E48\u0E19 182 cm) \u0E2B\u0E23\u0E37\u0E2D\u0E27\u0E48\u0E32\u0E07",
  "availableViews": ["FRONT", "FACE_CLOSEUP", "THREE_QUARTER", "SIDE", "BACK", "FULL_BODY", "OUTFIT_DETAIL", "ACCESSORY_DETAIL", "SHOE_DETAIL"],
  "creatureType": "human | anthropomorphic mammal | anthropomorphic reptile | fantasy creature | unknown",
  "species": "\u0E2A\u0E32\u0E22\u0E1E\u0E31\u0E19\u0E18\u0E38\u0E4C \u0E2B\u0E23\u0E37\u0E2D\u0E27\u0E48\u0E32\u0E07",
  "gender": "\u0E2B\u0E0D\u0E34\u0E07 | \u0E0A\u0E32\u0E22 | \u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38",
  "ageRange": "\u0E0A\u0E48\u0E27\u0E07\u0E2D\u0E32\u0E22\u0E38\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E32\u0E01\u0E01\u0E32\u0E22\u0E20\u0E32\u0E1E (\u0E43\u0E0A\u0E49 detectedAge \u0E16\u0E49\u0E32\u0E21\u0E35\u0E23\u0E30\u0E1A\u0E38\u0E43\u0E19\u0E20\u0E32\u0E1E)",
  "skinTone": "\u0E2A\u0E35\u0E1C\u0E34\u0E27 \u0E40\u0E0A\u0E48\u0E19 \u0E1C\u0E34\u0E27\u0E02\u0E32\u0E27\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E07",
  "faceShape": "\u0E23\u0E39\u0E1B\u0E2B\u0E19\u0E49\u0E32 \u0E40\u0E0A\u0E48\u0E19 \u0E2B\u0E19\u0E49\u0E32\u0E23\u0E39\u0E1B\u0E44\u0E02\u0E48 \u0E2B\u0E23\u0E37\u0E2D \u0E44\u0E21\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E0A\u0E31\u0E14\u0E43\u0E19\u0E20\u0E32\u0E1E",
  "hairStyle": "\u0E17\u0E23\u0E07\u0E1C\u0E21 \u0E40\u0E0A\u0E48\u0E19 \u0E1C\u0E21\u0E1A\u0E4A\u0E2D\u0E1A\u0E2A\u0E31\u0E49\u0E19\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E04\u0E32\u0E07",
  "hairColor": "\u0E2A\u0E35\u0E1C\u0E21 \u0E40\u0E0A\u0E48\u0E19 \u0E2A\u0E35\u0E14\u0E33",
  "eyeDescription": "\u0E14\u0E27\u0E07\u0E15\u0E32 \u0E40\u0E0A\u0E48\u0E19 \u0E15\u0E32\u0E01\u0E25\u0E21\u0E42\u0E15\u0E2A\u0E35\u0E14\u0E33",
  "bodyType": "\u0E23\u0E39\u0E1B\u0E23\u0E48\u0E32\u0E07 \u0E40\u0E0A\u0E48\u0E19 \u0E23\u0E39\u0E1B\u0E23\u0E48\u0E32\u0E07\u0E2A\u0E21\u0E2A\u0E48\u0E27\u0E19 \u0E2A\u0E39\u0E07\u0E42\u0E1B\u0E23\u0E48\u0E07",
  "topClothing": "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E17\u0E48\u0E2D\u0E19\u0E1A\u0E19 \u0E40\u0E0A\u0E48\u0E19 \u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E40\u0E0A\u0E34\u0E49\u0E15\u0E2A\u0E35\u0E1F\u0E49\u0E32\u0E2D\u0E48\u0E2D\u0E19 \u0E41\u0E02\u0E19\u0E1E\u0E31\u0E1A \u0E21\u0E35\u0E25\u0E32\u0E22\u0E1B\u0E31\u0E01\u0E14\u0E2D\u0E01\u0E44\u0E21\u0E49\u0E40\u0E25\u0E47\u0E01\u0E1A\u0E23\u0E34\u0E40\u0E27\u0E13\u0E1B\u0E01",
  "bottomClothing": "\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E1C\u0E49\u0E32\u0E17\u0E48\u0E2D\u0E19\u0E25\u0E48\u0E32\u0E07 \u0E40\u0E0A\u0E48\u0E19 \u0E01\u0E32\u0E07\u0E40\u0E01\u0E07\u0E22\u0E35\u0E19\u0E2A\u0E4C\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E40\u0E07\u0E34\u0E19\u0E40\u0E02\u0E49\u0E21",
  "footwear": "\u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32 \u0E40\u0E0A\u0E48\u0E19 \u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32\u0E1C\u0E49\u0E32\u0E43\u0E1A\u0E2A\u0E35\u0E02\u0E32\u0E27",
  "accessories": "\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E1B\u0E23\u0E30\u0E14\u0E31\u0E1A \u0E40\u0E0A\u0E48\u0E19 \u0E2A\u0E23\u0E49\u0E2D\u0E22\u0E04\u0E2D\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E08\u0E35\u0E49\u0E21\u0E38\u0E01\u0E02\u0E19\u0E32\u0E14\u0E40\u0E25\u0E47\u0E01",
  "distinctFeatures": "\u0E08\u0E38\u0E14\u0E40\u0E14\u0E48\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E08\u0E23\u0E34\u0E07 \u0E40\u0E0A\u0E48\u0E19 \u0E2A\u0E23\u0E49\u0E2D\u0E22\u0E04\u0E2D\u0E08\u0E35\u0E49\u0E21\u0E38\u0E01 \u0E25\u0E32\u0E22\u0E1B\u0E31\u0E01\u0E14\u0E2D\u0E01\u0E44\u0E21\u0E49\u0E17\u0E35\u0E48\u0E1B\u0E01\u0E40\u0E2A\u0E37\u0E49\u0E2D",
  "nameSource": "REFERENCE_TEXT | VISUAL_OBSERVATION | UNKNOWN",
  "ageSource": "REFERENCE_TEXT | VISUAL_OBSERVATION | UNKNOWN",
  "heightSource": "REFERENCE_TEXT | UNKNOWN",
  "confidence": 95
}`;
        const parts = [];
        parts.push({
          text: `[\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E17\u0E35\u0E48 1: \u0E23\u0E39\u0E1B\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07\u0E2B\u0E25\u0E31\u0E01 (Primary Reference)] \u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14: \u0E42\u0E1B\u0E23\u0E14\u0E2D\u0E48\u0E32\u0E19\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21 OCR \u0E43\u0E19\u0E41\u0E1C\u0E48\u0E19 Reference Sheet \u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14 (\u0E40\u0E0A\u0E48\u0E19 NAME, AGE, HEIGHT) \u0E41\u0E25\u0E30\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E23\u0E39\u0E1B\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C\u0E08\u0E23\u0E34\u0E07\u0E08\u0E32\u0E01\u0E23\u0E39\u0E1B\u0E19\u0E35\u0E49`
        });
        parts.push({
          inlineData: {
            data: primaryParsed.base64Data,
            mimeType: primaryParsed.mimeType
          }
        });
        supportingParsed.forEach((sup, idx) => {
          parts.push({
            text: `[\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E17\u0E35\u0E48 ${idx + 2}: \u0E23\u0E39\u0E1B\u0E40\u0E2A\u0E23\u0E34\u0E21 (Supporting Reference #${idx + 1})] \u0E43\u0E0A\u0E49\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E25\u0E31\u0E01\u0E29\u0E13\u0E30\u0E2B\u0E25\u0E31\u0E01\u0E02\u0E2D\u0E07\u0E23\u0E39\u0E1B\u0E41\u0E23\u0E01`
          });
          parts.push({
            inlineData: {
              data: sup.base64Data,
              mimeType: sup.mimeType
            }
          });
        });
        parts.push({
          text: `\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E20\u0E32\u0E1E\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E40\u0E04\u0E23\u0E48\u0E07\u0E04\u0E23\u0E31\u0E14 (IMAGE-FIRST CHARACTER LOCK):
1. \u0E2D\u0E48\u0E32\u0E19\u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23\u0E43\u0E19\u0E20\u0E32\u0E1E (REFERENCE_TEXT):
   - NAME: \u0E16\u0E49\u0E32\u0E21\u0E35\u0E15\u0E31\u0E27\u0E2D\u0E31\u0E01\u0E29\u0E23\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D \u0E40\u0E0A\u0E48\u0E19 "\u0E41\u0E1E\u0E23 / Prae" \u0E43\u0E2B\u0E49\u0E15\u0E2D\u0E1A\u0E43\u0E19 detectedName
   - AGE: \u0E16\u0E49\u0E32\u0E21\u0E35\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E23\u0E30\u0E1A\u0E38 \u0E40\u0E0A\u0E48\u0E19 "AGE: 30" \u0E15\u0E49\u0E2D\u0E07\u0E15\u0E2D\u0E1A "30" \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32\u0E2B\u0E23\u0E37\u0E2D\u0E41\u0E1B\u0E25\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E48\u0E27\u0E07 25-30 \u0E1B\u0E35
   - HEIGHT: \u0E16\u0E49\u0E32\u0E21\u0E35\u0E15\u0E31\u0E27\u0E40\u0E25\u0E02\u0E23\u0E30\u0E1A\u0E38 \u0E40\u0E0A\u0E48\u0E19 "HEIGHT: 182 cm" \u0E43\u0E2B\u0E49\u0E15\u0E2D\u0E1A "182 cm" \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E39\u0E07\u0E43\u0E2B\u0E21\u0E48
2. \u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E27\u0E48\u0E32\u0E40\u0E1B\u0E47\u0E19 Single Character \u0E04\u0E19\u0E40\u0E14\u0E35\u0E22\u0E27\u0E01\u0E31\u0E19 \u0E41\u0E25\u0E30\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 availableViews
3. \u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E44\u0E14\u0E49\u0E08\u0E23\u0E34\u0E07\u0E08\u0E32\u0E01\u0E20\u0E32\u0E1E (\u0E1C\u0E21, \u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E1C\u0E49\u0E32\u0E17\u0E48\u0E2D\u0E19\u0E1A\u0E19, \u0E01\u0E32\u0E07\u0E40\u0E01\u0E07, \u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32, \u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E1B\u0E23\u0E30\u0E14\u0E31\u0E1A, \u0E08\u0E38\u0E14\u0E40\u0E14\u0E48\u0E19)
4. \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32\u0E2D\u0E32\u0E0A\u0E35\u0E1E, \u0E19\u0E34\u0E2A\u0E31\u0E22, \u0E10\u0E32\u0E19\u0E30, \u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E0A\u0E35\u0E27\u0E34\u0E15, \u0E1A\u0E17\u0E1A\u0E32\u0E17\u0E43\u0E19\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07
5. \u0E15\u0E2D\u0E1A\u0E40\u0E1B\u0E47\u0E19 JSON \u0E15\u0E32\u0E21\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E17\u0E35\u0E48\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19`
        });
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: {
            parts
          },
          config: {
            systemInstruction,
            responseMimeType: "application/json"
          }
        });
        const rawText = response.text || "";
        let jsonResult = null;
        try {
          const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
          jsonResult = JSON.parse(cleaned);
        } catch (parseErr) {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonResult = JSON.parse(jsonMatch[0]);
          }
        }
        if (jsonResult) {
          let confidence = typeof jsonResult.confidence === "number" ? Math.round(jsonResult.confidence) : 85;
          if (isNaN(confidence) || confidence < 0) confidence = 50;
          if (confidence > 100) confidence = 100;
          const detectedName = (jsonResult.detectedName || "").trim();
          let detectedAge = (jsonResult.detectedAge || "").trim();
          const detectedHeight = (jsonResult.detectedHeight || "").trim();
          if (detectedAge.match(/\b30\b/)) {
            detectedAge = "30";
          } else if (detectedAge.match(/^\d+$/)) {
          }
          const creatureType = (jsonResult.creatureType || "").trim();
          const species = (jsonResult.species || "").trim();
          const isReptile = creatureType === "anthropomorphic reptile" || /reptile|lizard|gecko|monitor|crocodile|alligator|snake|กิ้งก่า|ตะกวด|ตัวเงินตัวทอง|จระเข้|เลื้อยคลาน/i.test(species);
          let skinTone = (jsonResult.skinTone || "").trim();
          let hairStyle = (jsonResult.hairStyle || "").trim();
          let hairColor = (jsonResult.hairColor || "").trim();
          let distinctFeatures = (jsonResult.distinctFeatures || "").trim();
          if (isReptile) {
            if (/ขน|fox|จิ้งจอก|หางฟู|หางสุนัข|หูสุนัข|ใบหูตั้ง/i.test(hairStyle)) {
              hairStyle = "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1C\u0E21/\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E19 (\u0E1C\u0E34\u0E27\u0E40\u0E01\u0E25\u0E47\u0E14)";
            }
            if (/ขน|fox|จิ้งจอก/i.test(hairColor)) {
              hairColor = "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1C\u0E21";
            }
            if (/ขนหนา|ขนสีส้ม|ขนส้ม/i.test(skinTone)) {
              skinTone = skinTone.replace(/ขนหนาสีส้มอิฐ|ขนสีส้ม|ขน/gi, "\u0E1C\u0E34\u0E27\u0E2B\u0E19\u0E31\u0E07\u0E40\u0E01\u0E25\u0E47\u0E14").trim();
            }
            distinctFeatures = distinctFeatures.replace(/หูสุนัขจิ้งจอก|หูจิ้งจอก|หางสุนัขจิ้งจอก|หางฟู|หางสุนัข|ขนสีส้ม|ขนหนา|ปลายหูดำ|แผงคอสีขาว/gi, "").trim();
          }
          const finalName = detectedName || (jsonResult.name || jsonResult.suggestedName || "").trim();
          const finalAge = detectedAge || (jsonResult.ageRange || jsonResult.age || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38").trim();
          const nameSource = detectedName ? "REFERENCE_TEXT" : finalName ? "VISUAL_OBSERVATION" : "UNKNOWN";
          const ageSource = detectedAge ? "REFERENCE_TEXT" : jsonResult.ageRange ? "VISUAL_OBSERVATION" : "UNKNOWN";
          const heightSource = detectedHeight ? "REFERENCE_TEXT" : "UNKNOWN";
          const validViews = ["FRONT", "FACE_CLOSEUP", "THREE_QUARTER", "SIDE", "BACK", "FULL_BODY", "OUTFIT_DETAIL", "ACCESSORY_DETAIL", "SHOE_DETAIL"];
          let availableViews = Array.isArray(jsonResult.availableViews) ? jsonResult.availableViews.map((v) => String(v).toUpperCase().replace(/[\s-]/g, "_")) : ["FRONT"];
          availableViews = availableViews.filter((v) => validViews.includes(v) || v.length > 2);
          if (availableViews.length === 0) availableViews = ["FRONT"];
          const structured = {
            creatureType: creatureType || (isReptile ? "anthropomorphic reptile" : "human"),
            species: species || (isReptile ? "anthropomorphic reptile" : ""),
            name: finalName,
            gender: (jsonResult.gender || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38").trim(),
            ageRange: finalAge,
            skinTone,
            faceShape: (jsonResult.faceShape || "").trim(),
            hairStyle,
            hairColor,
            eyeDescription: (jsonResult.eyeDescription || "").trim(),
            bodyType: (jsonResult.bodyType || "").trim(),
            topClothing: (jsonResult.topClothing || "").trim(),
            bottomClothing: (jsonResult.bottomClothing || "").trim(),
            footwear: (jsonResult.footwear || "").trim(),
            accessories: (jsonResult.accessories || "\u0E44\u0E21\u0E48\u0E21\u0E35").trim(),
            distinctFeatures,
            confidence
          };
          const isNotVisible = (v) => !v || v === "\u0E44\u0E21\u0E48\u0E41\u0E19\u0E48\u0E43\u0E08" || v === "\u0E44\u0E21\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E0A\u0E31\u0E14\u0E43\u0E19\u0E20\u0E32\u0E1E" || v === "\u0E44\u0E21\u0E48\u0E21\u0E35" || v === "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38";
          const physicalParts = [];
          if (structured.creatureType && structured.creatureType !== "human" && structured.creatureType !== "unknown") {
            const speciesText = structured.species && structured.species !== structured.creatureType ? `${structured.creatureType} (${structured.species})` : structured.creatureType;
            physicalParts.push(`\u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17: ${speciesText}`);
          }
          if (detectedHeight) {
            physicalParts.push(`\u0E2A\u0E48\u0E27\u0E19\u0E2A\u0E39\u0E07: ${detectedHeight}`);
          }
          if (!isNotVisible(structured.skinTone)) physicalParts.push(`\u0E1C\u0E34\u0E27/\u0E40\u0E01\u0E25\u0E47\u0E14: ${structured.skinTone}`);
          if (!isNotVisible(structured.faceShape)) physicalParts.push(`\u0E23\u0E39\u0E1B\u0E2B\u0E19\u0E49\u0E32: ${structured.faceShape}`);
          if (!isNotVisible(structured.hairStyle) && structured.hairStyle !== "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1C\u0E21" && !structured.hairStyle.includes("\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1C\u0E21/\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E19")) {
            const hairDesc = !isNotVisible(structured.hairColor) && structured.hairColor !== "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1C\u0E21" ? `${structured.hairStyle} (${structured.hairColor})` : structured.hairStyle;
            physicalParts.push(`\u0E1C\u0E21: ${hairDesc}`);
          }
          if (!isNotVisible(structured.eyeDescription)) physicalParts.push(`\u0E15\u0E32: ${structured.eyeDescription}`);
          if (!isNotVisible(structured.bodyType)) physicalParts.push(`\u0E2A\u0E23\u0E35\u0E23\u0E30: ${structured.bodyType}`);
          if (!isNotVisible(structured.distinctFeatures)) {
            physicalParts.push(`\u0E40\u0E2D\u0E01\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C: ${structured.distinctFeatures}`);
          }
          const description = physicalParts.length > 0 ? physicalParts.join(", ") : jsonResult.description || "\u0E23\u0E39\u0E1B\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07\u0E08\u0E23\u0E34\u0E07";
          const outfitParts = [];
          if (!isNotVisible(structured.topClothing) && !structured.topClothing.includes("\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E2A\u0E27\u0E21")) {
            outfitParts.push(`\u0E17\u0E48\u0E2D\u0E19\u0E1A\u0E19: ${structured.topClothing}`);
          }
          if (!isNotVisible(structured.bottomClothing)) {
            outfitParts.push(`\u0E17\u0E48\u0E2D\u0E19\u0E25\u0E48\u0E32\u0E07: ${structured.bottomClothing}`);
          }
          if (!isNotVisible(structured.footwear)) {
            outfitParts.push(`\u0E23\u0E2D\u0E07\u0E40\u0E17\u0E49\u0E32: ${structured.footwear}`);
          }
          if (!isNotVisible(structured.accessories)) {
            outfitParts.push(`\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E1B\u0E23\u0E30\u0E14\u0E31\u0E1A: ${structured.accessories}`);
          }
          const outfitDescription = outfitParts.length > 0 ? outfitParts.join(" \u2022 ") : structured.topClothing?.includes("\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E2A\u0E27\u0E21") ? "\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E2A\u0E27\u0E21\u0E40\u0E2A\u0E37\u0E49\u0E2D\u0E1C\u0E49\u0E32" : "\u0E44\u0E21\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E0A\u0E38\u0E14\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19\u0E43\u0E19\u0E20\u0E32\u0E1E";
          const primaryDataUrl = `data:${primaryParsed.mimeType};base64,${primaryParsed.base64Data}`;
          const allDataUrls = parsedImages.map((p) => `data:${p.mimeType};base64,${p.base64Data}`);
          let persistentRefUrl = "";
          let persistentRefId = `ref_${primaryImageHash.slice(0, 10)}_${Date.now()}`;
          try {
            const persisted = persistReferenceImage(primaryDataUrl, persistentRefId);
            persistentRefUrl = persisted.referenceImageUrl;
            persistentRefId = persisted.referenceImageId;
          } catch (e) {
            console.warn("Could not persist analyzed image to disk:", e);
          }
          const characterIdentity = {
            id: `char_${Date.now()}`,
            name: finalName
          };
          const referenceMetadata = {
            referenceImageId: persistentRefId,
            referenceImageUrl: persistentRefUrl || primaryDataUrl,
            imageHash: primaryImageHash,
            detectedName: detectedName || void 0,
            detectedAge: detectedAge || void 0,
            detectedHeight: detectedHeight || void 0,
            availableViews
          };
          const visualProfile = {
            imageHash: primaryImageHash,
            referenceImageId: persistentRefId,
            referenceImageUrl: persistentRefUrl || primaryDataUrl,
            hairStyle: structured.hairStyle || "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
            hairColor: structured.hairColor || "",
            top: structured.topClothing || "",
            bottom: structured.bottomClothing || "",
            shoes: structured.footwear || "\u0E44\u0E21\u0E48\u0E40\u0E2B\u0E47\u0E19\u0E0A\u0E31\u0E14\u0E43\u0E19\u0E20\u0E32\u0E1E",
            accessories: structured.accessories || "\u0E44\u0E21\u0E48\u0E21\u0E35",
            visibleDistinctiveDetails: structured.distinctFeatures || "\u0E44\u0E21\u0E48\u0E21\u0E35",
            referenceImage: persistentRefUrl || primaryDataUrl,
            referenceImages: persistentRefUrl ? [persistentRefUrl] : allDataUrls,
            imageAnalysisStatus: "analyzed",
            hair: [structured.hairStyle, structured.hairColor].filter((s) => s && !s.includes("\u0E44\u0E21\u0E48\u0E40\u0E2B\u0E47\u0E19") && s !== "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1C\u0E21").join(" ") || structured.hairStyle || "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
            visibleOutfit: outfitDescription,
            visibleAccessories: structured.accessories || "\u0E44\u0E21\u0E48\u0E21\u0E35",
            visiblePhysicalAppearance: description,
            visibleDistinguishingDetails: structured.distinctFeatures || "\u0E44\u0E21\u0E48\u0E21\u0E35",
            detectedViews: availableViews,
            isMultiViewSheet: availableViews.length > 1 || allDataUrls.length > 1,
            confidence: structured.confidence,
            generatedVisualPrompt: `${description}, wearing ${outfitDescription}`
          };
          const storyProfile = {
            role: "",
            personality: "",
            occupation: "",
            background: "",
            storyInfo: ""
          };
          const fieldSources = {
            name: nameSource,
            age: ageSource,
            height: heightSource,
            hairStyle: "VISUAL_OBSERVATION",
            hairColor: "VISUAL_OBSERVATION",
            top: "VISUAL_OBSERVATION",
            bottom: "VISUAL_OBSERVATION",
            shoes: "VISUAL_OBSERVATION",
            accessories: "VISUAL_OBSERVATION",
            distinctFeatures: "VISUAL_OBSERVATION",
            gender: "VISUAL_OBSERVATION",
            role: "UNKNOWN",
            personality: "UNKNOWN",
            occupation: "UNKNOWN",
            background: "UNKNOWN"
          };
          const returnData = {
            ...structured,
            name: finalName,
            age: finalAge,
            detectedName,
            detectedAge,
            detectedHeight,
            availableViews,
            imageHash: primaryImageHash,
            referenceImageId: persistentRefId,
            referenceImageUrl: persistentRefUrl || primaryDataUrl,
            description,
            outfitDescription,
            suggestedName: finalName,
            fullSummary: `${description}. \u0E0A\u0E38\u0E14: ${outfitDescription}`.trim(),
            structured,
            characterIdentity,
            referenceMetadata,
            visualProfile,
            storyProfile,
            fieldSources
          };
          visionAnalysisCache.set(primaryImageHash, {
            imageHash: primaryImageHash,
            data: returnData,
            timestamp: Date.now()
          });
          return res.json({
            success: true,
            source: "gemini-flash",
            cached: false,
            data: returnData
          });
        }
      } catch (geminiErr) {
        console.error("Gemini Flash analyze character image error:", geminiErr?.message || geminiErr);
        return res.status(500).json({
          success: false,
          message: `\u0E01\u0E32\u0E23\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E20\u0E32\u0E1E\u0E14\u0E49\u0E27\u0E22 Gemini Flash \u0E02\u0E31\u0E14\u0E02\u0E49\u0E2D\u0E07: ${geminiErr?.message || "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E1B\u0E23\u0E30\u0E21\u0E27\u0E25\u0E1C\u0E25\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E44\u0E14\u0E49"}. \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E2B\u0E23\u0E37\u0E2D\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07`
        });
      }
    }
    return res.status(500).json({
      success: false,
      message: "\u0E23\u0E30\u0E1A\u0E1A AI \u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E20\u0E32\u0E1E\u0E44\u0E21\u0E48\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 (API Key \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32\u0E2B\u0E23\u0E37\u0E2D\u0E42\u0E21\u0E40\u0E14\u0E25\u0E44\u0E21\u0E48\u0E15\u0E2D\u0E1A\u0E2A\u0E19\u0E2D\u0E07)"
    });
  } catch (err) {
    console.error("Error in /api/character/analyze-image:", err);
    res.status(500).json({
      success: false,
      message: err?.message || "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E44\u0E14\u0E49"
    });
  }
});
function persistLocationReferenceImage(imageData, customId) {
  const parsed = parseImageData(imageData);
  if (!parsed || !parsed.base64Data) {
    throw new Error("\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14 \u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E41\u0E1B\u0E25\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E20\u0E32\u0E1E\u0E44\u0E14\u0E49");
  }
  const imageHash = import_crypto2.default.createHash("sha256").update(parsed.base64Data).digest("hex");
  const refId = customId || `ref_loc_${imageHash.slice(0, 10)}_${Date.now()}`;
  const ext = parsed.mimeType.includes("png") ? "png" : parsed.mimeType.includes("webp") ? "webp" : "jpg";
  const filename = `${refId}.${ext}`;
  const filepath = import_path.default.join(UPLOADS_LOCATIONS_DIR, filename);
  const buffer = Buffer.from(parsed.base64Data, "base64");
  import_fs.default.writeFileSync(filepath, buffer);
  const referenceImageUrl = `/uploads/locations/${filename}`;
  return {
    referenceImageId: refId,
    referenceImageUrl,
    imageHash
  };
}
var locationAnalysisCache = /* @__PURE__ */ new Map();
locationAnalysisCache.set("loc_hash_modern_living_88a91c", {
  imageHash: "loc_hash_modern_living_88a91c",
  timestamp: Date.now(),
  data: {
    name: "\u0E2B\u0E49\u0E2D\u0E07\u0E19\u0E31\u0E48\u0E07\u0E40\u0E25\u0E48\u0E19\u0E21\u0E34\u0E19\u0E34\u0E21\u0E2D\u0E25\u0E42\u0E21\u0E40\u0E14\u0E34\u0E23\u0E4C\u0E19 (Modern Minimalist Living Room)",
    environmentType: "Indoor (\u0E2B\u0E49\u0E2D\u0E07\u0E19\u0E31\u0E48\u0E07\u0E40\u0E25\u0E48\u0E19\u0E2B\u0E25\u0E31\u0E01)",
    architecturalStyle: "Modern Japandi Minimalist",
    wallColor: "\u0E1C\u0E19\u0E31\u0E07\u0E09\u0E32\u0E1A\u0E1B\u0E39\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E2A\u0E35\u0E40\u0E1A\u0E08\u0E2D\u0E48\u0E2D\u0E19 (Warm off-white) \u0E41\u0E25\u0E30\u0E1C\u0E19\u0E31\u0E07\u0E44\u0E21\u0E49\u0E23\u0E30\u0E41\u0E19\u0E07\u0E42\u0E2D\u0E4A\u0E04\u0E1D\u0E31\u0E48\u0E07\u0E02\u0E27\u0E32",
    floor: "\u0E1E\u0E37\u0E49\u0E19\u0E44\u0E21\u0E49\u0E25\u0E32\u0E21\u0E34\u0E40\u0E19\u0E15\u0E2A\u0E35\u0E42\u0E2D\u0E4A\u0E04\u0E2D\u0E48\u0E2D\u0E19\u0E25\u0E32\u0E22\u0E01\u0E49\u0E32\u0E07\u0E1B\u0E25\u0E32 \u0E1B\u0E39\u0E1E\u0E23\u0E21\u0E02\u0E19\u0E2A\u0E31\u0E49\u0E19\u0E2A\u0E35\u0E40\u0E17\u0E32\u0E40\u0E17\u0E32\u0E42\u0E21\u0E40\u0E14\u0E34\u0E23\u0E4C\u0E19",
    ceiling: "\u0E40\u0E1E\u0E14\u0E32\u0E19\u0E1D\u0E49\u0E32\u0E2B\u0E25\u0E38\u0E21\u0E2A\u0E35\u0E02\u0E32\u0E27\u0E0B\u0E48\u0E2D\u0E19\u0E44\u0E1F warm light \u0E2A\u0E35\u0E2A\u0E49\u0E21\u0E2A\u0E25\u0E31\u0E27\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E2A\u0E1B\u0E2D\u0E15\u0E44\u0E25\u0E17\u0E4C\u0E1D\u0E31\u0E07\u0E1D\u0E49\u0E32",
    doors: "\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E01\u0E23\u0E30\u0E08\u0E01\u0E1A\u0E32\u0E19\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E01\u0E23\u0E2D\u0E1A\u0E2D\u0E25\u0E39\u0E21\u0E34\u0E40\u0E19\u0E35\u0E22\u0E21\u0E2A\u0E35\u0E14\u0E33\u0E14\u0E49\u0E32\u0E19 \u0E40\u0E1B\u0E34\u0E14\u0E2D\u0E2D\u0E01\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E07",
    windows: "\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07\u0E01\u0E23\u0E30\u0E08\u0E01\u0E1A\u0E32\u0E19\u0E43\u0E2B\u0E0D\u0E48\u0E17\u0E23\u0E07\u0E2A\u0E39\u0E07\u0E08\u0E32\u0E01\u0E1E\u0E37\u0E49\u0E19\u0E08\u0E23\u0E14\u0E40\u0E1E\u0E14\u0E32\u0E19 \u0E23\u0E31\u0E1A\u0E41\u0E2A\u0E07\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34\u0E17\u0E32\u0E07\u0E17\u0E34\u0E28\u0E40\u0E2B\u0E19\u0E37\u0E2D",
    majorFurniture: "\u0E42\u0E0B\u0E1F\u0E32\u0E1C\u0E49\u0E32\u0E25\u0E34\u0E19\u0E34\u0E19\u0E17\u0E23\u0E07\u0E41\u0E2D\u0E25\u0E2A\u0E35\u0E40\u0E17\u0E32\u0E2D\u0E48\u0E2D\u0E19, \u0E42\u0E15\u0E4A\u0E30\u0E01\u0E25\u0E32\u0E07\u0E44\u0E21\u0E49\u0E42\u0E2D\u0E4A\u0E04\u0E01\u0E25\u0E21\u0E21\u0E19, \u0E42\u0E15\u0E4A\u0E30\u0E27\u0E32\u0E07\u0E17\u0E35\u0E27\u0E35\u0E1A\u0E34\u0E25\u0E17\u0E4C\u0E2D\u0E34\u0E19\u0E44\u0E21\u0E49",
    fixedObjects: "\u0E1C\u0E19\u0E31\u0E07\u0E0A\u0E31\u0E49\u0E19\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E37\u0E2D\u0E1A\u0E34\u0E25\u0E17\u0E4C\u0E2D\u0E34\u0E19\u0E41\u0E1A\u0E1A\u0E44\u0E23\u0E49\u0E21\u0E37\u0E2D\u0E08\u0E31\u0E1A \u0E41\u0E25\u0E30\u0E15\u0E39\u0E49\u0E0B\u0E48\u0E2D\u0E19\u0E2A\u0E32\u0E22\u0E44\u0E1F\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E40\u0E19\u0E35\u0E22\u0E19",
    spatialLayout: "\u0E1E\u0E37\u0E49\u0E19\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E42\u0E25\u0E48\u0E07\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E01\u0E31\u0E1A\u0E21\u0E38\u0E21\u0E23\u0E31\u0E1A\u0E1B\u0E23\u0E30\u0E17\u0E32\u0E19\u0E2D\u0E32\u0E2B\u0E32\u0E23 \u0E17\u0E34\u0E28\u0E17\u0E32\u0E07\u0E41\u0E2A\u0E07\u0E2A\u0E48\u0E2D\u0E07\u0E40\u0E09\u0E35\u0E22\u0E07 45 \u0E2D\u0E07\u0E28\u0E32",
    permanentDecor: "\u0E20\u0E32\u0E1E\u0E27\u0E32\u0E14\u0E28\u0E34\u0E25\u0E1B\u0E30\u0E41\u0E2D\u0E1A\u0E2A\u0E41\u0E15\u0E23\u0E01\u0E15\u0E4C\u0E42\u0E17\u0E19\u0E2A\u0E35\u0E40\u0E2D\u0E34\u0E23\u0E4C\u0E18\u0E42\u0E17\u0E19\u0E02\u0E19\u0E32\u0E14\u0E43\u0E2B\u0E0D\u0E48 1 \u0E23\u0E39\u0E1B \u0E41\u0E25\u0E30\u0E15\u0E49\u0E19\u0E44\u0E17\u0E23\u0E43\u0E1A\u0E2A\u0E31\u0E01\u0E43\u0E19\u0E01\u0E23\u0E30\u0E16\u0E32\u0E07\u0E40\u0E0B\u0E23\u0E32\u0E21\u0E34\u0E01",
    distinctiveFeatures: "\u0E0A\u0E48\u0E2D\u0E07\u0E41\u0E2A\u0E07\u0E2A\u0E48\u0E2D\u0E07\u0E01\u0E23\u0E30\u0E17\u0E1A\u0E1C\u0E19\u0E31\u0E07\u0E44\u0E21\u0E49\u0E23\u0E30\u0E41\u0E19\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E40\u0E2A\u0E49\u0E19\u0E40\u0E09\u0E35\u0E22\u0E07 \u0E41\u0E25\u0E30\u0E42\u0E04\u0E21\u0E44\u0E1F\u0E15\u0E31\u0E49\u0E07\u0E1E\u0E37\u0E49\u0E19\u0E17\u0E23\u0E07\u0E42\u0E04\u0E49\u0E07\u0E2A\u0E35\u0E14\u0E33\u0E14\u0E49\u0E32\u0E19",
    confidence: 96,
    availableViews: ["WIDE_SHOT", "CORNER_PERSPECTIVE", "FURNITURE_LAYOUT"],
    generatedVisualPrompt: "Modern Japandi living room, warm beige smooth walls, light oak herringbone wooden flooring, large floor-to-ceiling glass window, L-shaped light grey linen sofa, oak round coffee table, built-in recessed ceiling spotlights with warm ambient lighting",
    storyLocationName: "\u0E2B\u0E49\u0E2D\u0E07\u0E19\u0E31\u0E48\u0E07\u0E40\u0E25\u0E48\u0E19\u0E04\u0E2D\u0E19\u0E42\u0E14\u0E2B\u0E23\u0E39\u0E43\u0E08\u0E01\u0E25\u0E32\u0E07\u0E40\u0E21\u0E37\u0E2D\u0E07",
    description: "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E1E\u0E31\u0E01\u0E1C\u0E48\u0E2D\u0E19\u0E41\u0E25\u0E30\u0E1E\u0E39\u0E14\u0E04\u0E38\u0E22\u0E2B\u0E25\u0E31\u0E01\u0E02\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01 \u0E1A\u0E23\u0E23\u0E22\u0E32\u0E01\u0E32\u0E28\u0E40\u0E07\u0E35\u0E22\u0E1A\u0E2A\u0E07\u0E1A \u0E2D\u0E1A\u0E2D\u0E38\u0E48\u0E19 \u0E41\u0E25\u0E30\u0E40\u0E1B\u0E47\u0E19\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27",
    notes: "\u0E43\u0E0A\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E09\u0E32\u0E01\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E25\u0E30\u0E09\u0E32\u0E01\u0E1E\u0E39\u0E14\u0E04\u0E38\u0E22\u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07 2 \u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23"
  }
});
locationAnalysisCache.set("loc_hash_scifi_deck_99c32f", {
  imageHash: "loc_hash_scifi_deck_99c32f",
  timestamp: Date.now(),
  data: {
    name: "\u0E2B\u0E49\u0E2D\u0E07\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21\u0E22\u0E32\u0E19\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E2D\u0E27\u0E01\u0E32\u0E28 (Sci-Fi Command Deck)",
    environmentType: "Interior Sci-Fi Spaceship Bridge",
    architecturalStyle: "Futuristic Cybernetic Industrial",
    wallColor: "\u0E41\u0E1C\u0E48\u0E19\u0E42\u0E25\u0E2B\u0E30\u0E44\u0E17\u0E40\u0E17\u0E40\u0E19\u0E35\u0E22\u0E21\u0E2A\u0E35\u0E40\u0E17\u0E32\u0E40\u0E02\u0E49\u0E21\u0E40\u0E19\u0E37\u0E49\u0E2D\u0E14\u0E49\u0E32\u0E19 \u0E2A\u0E25\u0E31\u0E1A\u0E40\u0E2A\u0E49\u0E19\u0E44\u0E1F\u0E19\u0E35\u0E2D\u0E2D\u0E19\u0E41\u0E16\u0E1A\u0E2A\u0E35\u0E1F\u0E49\u0E32\u0E04\u0E23\u0E32\u0E21 (Cyan LED Strips)",
    floor: "\u0E41\u0E1C\u0E48\u0E19\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E40\u0E2A\u0E23\u0E34\u0E21\u0E25\u0E32\u0E22\u0E01\u0E31\u0E19\u0E25\u0E37\u0E48\u0E19\u0E2A\u0E35\u0E40\u0E17\u0E32\u0E04\u0E32\u0E23\u0E4C\u0E1A\u0E2D\u0E19 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E44\u0E1F\u0E19\u0E33\u0E17\u0E32\u0E07\u0E1D\u0E31\u0E07\u0E1E\u0E37\u0E49\u0E19\u0E2A\u0E35\u0E2A\u0E49\u0E21\u0E41\u0E14\u0E07",
    ceiling: "\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E40\u0E2B\u0E25\u0E47\u0E01\u0E40\u0E1B\u0E25\u0E37\u0E2D\u0E22\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E42\u0E21\u0E14\u0E39\u0E25\u0E32\u0E23\u0E4C \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E41\u0E1C\u0E07\u0E17\u0E48\u0E2D\u0E2B\u0E25\u0E48\u0E2D\u0E40\u0E22\u0E47\u0E19\u0E41\u0E25\u0E30\u0E44\u0E1F\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E44\u0E25\u0E17\u0E4C\u0E2A\u0E35\u0E02\u0E32\u0E27\u0E40\u0E22\u0E47\u0E19 6500K",
    doors: "\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E01\u0E25\u0E44\u0E2E\u0E14\u0E23\u0E2D\u0E25\u0E34\u0E01\u0E41\u0E1A\u0E1A\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E41\u0E22\u0E01\u0E0B\u0E49\u0E32\u0E22\u0E02\u0E27\u0E32\u0E2A\u0E2D\u0E07\u0E0A\u0E31\u0E49\u0E19 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E41\u0E1C\u0E07\u0E2A\u0E41\u0E01\u0E19\u0E25\u0E32\u0E22\u0E19\u0E34\u0E49\u0E27\u0E21\u0E37\u0E2D",
    windows: "\u0E01\u0E23\u0E30\u0E08\u0E01\u0E21\u0E2D\u0E07\u0E22\u0E32\u0E19\u0E2D\u0E27\u0E01\u0E32\u0E28\u0E17\u0E23\u0E07\u0E1E\u0E32\u0E42\u0E19\u0E23\u0E32\u0E21\u0E32\u0E01\u0E27\u0E49\u0E32\u0E07 180 \u0E2D\u0E07\u0E28\u0E32 \u0E40\u0E1C\u0E22\u0E43\u0E2B\u0E49\u0E40\u0E2B\u0E47\u0E19\u0E2B\u0E49\u0E27\u0E07\u0E2D\u0E27\u0E01\u0E32\u0E28\u0E41\u0E25\u0E30\u0E25\u0E30\u0E2D\u0E2D\u0E07\u0E40\u0E19\u0E1A\u0E34\u0E27\u0E25\u0E32",
    majorFurniture: "\u0E40\u0E01\u0E49\u0E32\u0E2D\u0E35\u0E49\u0E01\u0E31\u0E1B\u0E15\u0E31\u0E19\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E35\u0E14\u0E33\u0E1B\u0E23\u0E31\u0E1A\u0E40\u0E2D\u0E19\u0E44\u0E14\u0E49\u0E15\u0E23\u0E07\u0E01\u0E25\u0E32\u0E07, \u0E04\u0E2D\u0E19\u0E42\u0E0B\u0E25\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21 4 \u0E08\u0E38\u0E14\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E08\u0E2D\u0E17\u0E31\u0E0A\u0E2A\u0E01\u0E23\u0E35\u0E19\u0E42\u0E1B\u0E23\u0E48\u0E07\u0E41\u0E2A\u0E07",
    fixedObjects: "\u0E41\u0E17\u0E48\u0E19\u0E09\u0E32\u0E22\u0E20\u0E32\u0E1E\u0E42\u0E2E\u0E42\u0E25\u0E41\u0E01\u0E23\u0E21\u0E2A\u0E32\u0E21\u0E21\u0E34\u0E15\u0E34\u0E02\u0E19\u0E32\u0E14\u0E43\u0E2B\u0E0D\u0E48\u0E17\u0E23\u0E07\u0E01\u0E25\u0E21\u0E01\u0E25\u0E32\u0E07\u0E2B\u0E49\u0E2D\u0E07",
    spatialLayout: "\u0E17\u0E23\u0E07\u0E40\u0E01\u0E37\u0E2D\u0E01\u0E21\u0E49\u0E32 (Horseshoe Layout) \u0E1E\u0E37\u0E49\u0E19\u0E22\u0E01\u0E23\u0E30\u0E14\u0E31\u0E1A 2 \u0E0A\u0E31\u0E49\u0E19 \u0E01\u0E31\u0E1B\u0E15\u0E31\u0E19\u0E2D\u0E22\u0E39\u0E48\u0E15\u0E23\u0E07\u0E01\u0E25\u0E32\u0E07\u0E2A\u0E39\u0E07\u0E01\u0E27\u0E48\u0E32\u0E04\u0E2D\u0E19\u0E42\u0E0B\u0E25\u0E19\u0E31\u0E01\u0E1A\u0E34\u0E19",
    permanentDecor: "\u0E2B\u0E19\u0E49\u0E32\u0E08\u0E2D\u0E40\u0E23\u0E14\u0E32\u0E23\u0E4C\u0E41\u0E2A\u0E14\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E01\u0E32\u0E23\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E02\u0E2D\u0E07\u0E22\u0E32\u0E19 \u0E41\u0E25\u0E30\u0E2A\u0E31\u0E0D\u0E25\u0E31\u0E01\u0E29\u0E13\u0E4C\u0E22\u0E32\u0E19\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D\u0E2A\u0E35\u0E40\u0E07\u0E34\u0E19",
    distinctiveFeatures: "\u0E41\u0E2A\u0E07\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19\u0E08\u0E32\u0E01\u0E01\u0E23\u0E30\u0E08\u0E01\u0E22\u0E32\u0E19\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E14\u0E27\u0E07\u0E14\u0E32\u0E27\u0E23\u0E30\u0E22\u0E34\u0E1A\u0E23\u0E30\u0E22\u0E31\u0E1A \u0E41\u0E25\u0E30\u0E41\u0E2A\u0E07\u0E44\u0E1F\u0E19\u0E35\u0E2D\u0E2D\u0E19\u0E27\u0E34\u0E48\u0E07\u0E40\u0E1B\u0E47\u0E19\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E23\u0E2D\u0E1A\u0E04\u0E2D\u0E19\u0E42\u0E0B\u0E25",
    confidence: 97,
    availableViews: ["WIDE_ANGLE_DECK", "PILOT_CONSOLE", "HOLOGRAPHIC_STATION"],
    generatedVisualPrompt: "Futuristic spaceship bridge command deck, dark matte titanium walls, glowing cyan LED light strips, carbon steel floor with orange guide lights, panoramic 180-degree front viewport showing outer space nebula, holographic globe display in center",
    storyLocationName: "\u0E22\u0E32\u0E19\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E28\u0E32\u0E25\u0E32-1 (Sala-1 Cruiser Bridge)",
    description: "\u0E28\u0E39\u0E19\u0E22\u0E4C\u0E01\u0E25\u0E32\u0E07\u0E2A\u0E31\u0E48\u0E07\u0E01\u0E32\u0E23\u0E02\u0E2D\u0E07\u0E22\u0E32\u0E19\u0E2A\u0E33\u0E23\u0E27\u0E08 \u0E1A\u0E23\u0E23\u0E22\u0E32\u0E01\u0E32\u0E28\u0E15\u0E36\u0E07\u0E40\u0E04\u0E23\u0E35\u0E22\u0E14\u0E41\u0E15\u0E48\u0E40\u0E1B\u0E35\u0E48\u0E22\u0E21\u0E14\u0E49\u0E27\u0E22\u0E40\u0E17\u0E04\u0E42\u0E19\u0E42\u0E25\u0E22\u0E35\u0E02\u0E31\u0E49\u0E19\u0E2A\u0E39\u0E07",
    notes: "\u0E43\u0E0A\u0E49\u0E43\u0E19\u0E09\u0E32\u0E01\u0E01\u0E32\u0E23\u0E40\u0E14\u0E34\u0E19\u0E17\u0E32\u0E07\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E14\u0E27\u0E07\u0E14\u0E32\u0E27\u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E2A\u0E31\u0E48\u0E07\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E04\u0E31\u0E0D"
  }
});
locationAnalysisCache.set("loc_hash_thai_veranda_77e41b", {
  imageHash: "loc_hash_thai_veranda_77e41b",
  timestamp: Date.now(),
  data: {
    name: "\u0E0A\u0E32\u0E19\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E44\u0E21\u0E49\u0E44\u0E17\u0E22\u0E23\u0E34\u0E21\u0E19\u0E49\u0E33 (Traditional Thai Wooden Veranda)",
    environmentType: "Semi-outdoor (\u0E0A\u0E32\u0E19\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E40\u0E1B\u0E34\u0E14\u0E42\u0E25\u0E48\u0E07\u0E23\u0E34\u0E21\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33)",
    architecturalStyle: "Traditional Central Thai Wooden Architecture (\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E44\u0E17\u0E22\u0E20\u0E32\u0E04\u0E01\u0E25\u0E32\u0E07)",
    wallColor: "\u0E1C\u0E19\u0E31\u0E07\u0E1D\u0E32\u0E1B\u0E30\u0E01\u0E19\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01\u0E17\u0E2D\u0E07\u0E2A\u0E35\u0E19\u0E49\u0E33\u0E15\u0E32\u0E25\u0E2D\u0E21\u0E2A\u0E49\u0E21 \u0E40\u0E04\u0E25\u0E37\u0E2D\u0E1A\u0E40\u0E07\u0E32\u0E21\u0E31\u0E19\u0E27\u0E32\u0E27\u0E15\u0E32\u0E21\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34",
    floor: "\u0E44\u0E21\u0E49\u0E01\u0E23\u0E30\u0E14\u0E32\u0E19\u0E2A\u0E31\u0E01\u0E41\u0E1C\u0E48\u0E19\u0E43\u0E2B\u0E0D\u0E48\u0E2B\u0E19\u0E49\u0E32\u0E01\u0E27\u0E49\u0E32\u0E07 \u0E02\u0E31\u0E14\u0E21\u0E31\u0E19\u0E40\u0E07\u0E32\u0E07\u0E32\u0E21 \u0E21\u0E35\u0E23\u0E48\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E32\u0E22\u0E19\u0E49\u0E33\u0E41\u0E25\u0E30\u0E25\u0E21\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34",
    ceiling: "\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2B\u0E25\u0E31\u0E07\u0E04\u0E32\u0E17\u0E23\u0E07\u0E08\u0E31\u0E48\u0E27\u0E17\u0E23\u0E07\u0E2A\u0E39\u0E07\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1B\u0E25\u0E37\u0E2D\u0E22\u0E40\u0E2B\u0E47\u0E19\u0E02\u0E37\u0E48\u0E2D\u0E41\u0E1B\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01 \u0E41\u0E01\u0E30\u0E2A\u0E25\u0E31\u0E01\u0E25\u0E27\u0E14\u0E25\u0E32\u0E22\u0E1A\u0E31\u0E27\u0E01\u0E25\u0E35\u0E1A\u0E02\u0E19\u0E38\u0E19",
    doors: "\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E1A\u0E32\u0E19\u0E40\u0E1F\u0E35\u0E49\u0E22\u0E21\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E40\u0E1B\u0E34\u0E14\u0E1E\u0E31\u0E1A\u0E40\u0E01\u0E47\u0E1A\u0E02\u0E49\u0E32\u0E07\u0E1C\u0E19\u0E31\u0E07\u0E44\u0E14\u0E49\u0E2A\u0E38\u0E14\u0E41\u0E19\u0E27",
    windows: "\u0E0A\u0E48\u0E2D\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07\u0E0B\u0E38\u0E49\u0E21\u0E44\u0E21\u0E49\u0E09\u0E25\u0E38\u0E25\u0E32\u0E22\u0E42\u0E1A\u0E23\u0E32\u0E13 \u0E40\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A\u0E25\u0E21\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33\u0E1E\u0E31\u0E14\u0E42\u0E0A\u0E22\u0E15\u0E25\u0E2D\u0E14\u0E27\u0E31\u0E19",
    majorFurniture: "\u0E15\u0E31\u0E48\u0E07\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E1B\u0E39\u0E40\u0E1A\u0E32\u0E30\u0E1C\u0E49\u0E32\u0E44\u0E2B\u0E21\u0E25\u0E32\u0E22\u0E02\u0E34\u0E14, \u0E2B\u0E21\u0E2D\u0E19\u0E02\u0E27\u0E32\u0E19\u0E2A\u0E32\u0E21\u0E40\u0E2B\u0E25\u0E35\u0E48\u0E22\u0E21\u0E25\u0E32\u0E22\u0E44\u0E17\u0E22\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E2A\u0E35\u0E04\u0E23\u0E32\u0E21",
    fixedObjects: "\u0E23\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E07\u0E23\u0E32\u0E27\u0E25\u0E39\u0E01\u0E01\u0E23\u0E07\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01\u0E09\u0E25\u0E38\u0E25\u0E32\u0E22\u0E23\u0E34\u0E21\u0E19\u0E49\u0E33 \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E40\u0E2A\u0E32\u0E40\u0E2D\u0E01\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01\u0E01\u0E25\u0E36\u0E07\u0E01\u0E25\u0E21",
    spatialLayout: "\u0E0A\u0E32\u0E19\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E19\u0E2D\u0E19\u0E41\u0E25\u0E30\u0E17\u0E48\u0E32\u0E19\u0E49\u0E33 \u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E41\u0E21\u0E48\u0E19\u0E49\u0E33\u0E40\u0E08\u0E49\u0E32\u0E1E\u0E23\u0E30\u0E22\u0E32\u0E22\u0E32\u0E21\u0E40\u0E22\u0E47\u0E19",
    permanentDecor: "\u0E01\u0E23\u0E30\u0E16\u0E32\u0E07\u0E1A\u0E31\u0E27\u0E14\u0E34\u0E19\u0E40\u0E1C\u0E32\u0E40\u0E04\u0E25\u0E37\u0E2D\u0E1A\u0E21\u0E23\u0E01\u0E15, \u0E15\u0E30\u0E40\u0E01\u0E35\u0E22\u0E07\u0E17\u0E2D\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E07\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E41\u0E02\u0E27\u0E19\u0E40\u0E2A\u0E32",
    distinctiveFeatures: "\u0E41\u0E2A\u0E07\u0E2A\u0E30\u0E17\u0E49\u0E2D\u0E19\u0E23\u0E30\u0E25\u0E2D\u0E01\u0E04\u0E25\u0E37\u0E48\u0E19\u0E19\u0E49\u0E33\u0E23\u0E30\u0E22\u0E34\u0E1A\u0E23\u0E30\u0E22\u0E31\u0E1A\u0E02\u0E36\u0E49\u0E19\u0E1A\u0E19\u0E40\u0E1E\u0E14\u0E32\u0E19\u0E44\u0E21\u0E49\u0E2A\u0E31\u0E01 \u0E41\u0E25\u0E30\u0E0A\u0E32\u0E22\u0E04\u0E32\u0E17\u0E23\u0E07\u0E1B\u0E31\u0E49\u0E19\u0E2B\u0E22\u0E32\u0E41\u0E01\u0E30\u0E2A\u0E25\u0E31\u0E01\u0E1B\u0E23\u0E30\u0E13\u0E35\u0E15",
    confidence: 95,
    availableViews: ["WIDE_RIVER_VIEW", "WOODEN_TERRACE", "ORNATE_EAVES_DETAIL"],
    generatedVisualPrompt: "Traditional central Thai wooden house veranda, golden teak wood panel walls, polished wide teak floorboards, high open gable roof with ornate carved brackets, riverside balustrade with tranquil river water reflection, antique brass lanterns",
    storyLocationName: "\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E44\u0E17\u0E22\u0E23\u0E34\u0E21\u0E2A\u0E32\u0E22\u0E19\u0E49\u0E33\u0E2D\u0E31\u0E21\u0E1E\u0E27\u0E32",
    description: "\u0E1A\u0E49\u0E32\u0E19\u0E1E\u0E31\u0E01\u0E23\u0E34\u0E21\u0E19\u0E49\u0E33\u0E1A\u0E23\u0E23\u0E22\u0E32\u0E01\u0E32\u0E28\u0E2A\u0E07\u0E1A \u0E23\u0E48\u0E21\u0E23\u0E37\u0E48\u0E19 \u0E40\u0E15\u0E47\u0E21\u0E44\u0E1B\u0E14\u0E49\u0E27\u0E22\u0E01\u0E25\u0E34\u0E48\u0E19\u0E2D\u0E32\u0E22\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E28\u0E32\u0E2A\u0E15\u0E23\u0E4C\u0E41\u0E25\u0E30\u0E27\u0E31\u0E12\u0E19\u0E18\u0E23\u0E23\u0E21\u0E44\u0E17\u0E22",
    notes: "\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E09\u0E32\u0E01\u0E14\u0E23\u0E32\u0E21\u0E48\u0E32 \u0E1E\u0E31\u0E01\u0E1C\u0E48\u0E2D\u0E19 \u0E19\u0E31\u0E48\u0E07\u0E2A\u0E21\u0E32\u0E18\u0E34 \u0E2B\u0E23\u0E37\u0E2D\u0E1E\u0E1A\u0E1B\u0E30\u0E1E\u0E39\u0E14\u0E04\u0E38\u0E22\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E23\u0E32\u0E27\u0E43\u0E19\u0E2D\u0E14\u0E35\u0E15"
  }
});
app.post("/api/location/upload-reference", async (req, res) => {
  try {
    const { image, imageHash, referenceImageId } = req.body || {};
    if (!image || typeof image !== "string") {
      return res.status(400).json({ success: false, message: "Image data is required" });
    }
    if (image.startsWith("blob:")) {
      return res.status(400).json({
        success: false,
        message: "\u0E44\u0E21\u0E48\u0E2D\u0E19\u0E38\u0E0D\u0E32\u0E15\u0E43\u0E2B\u0E49\u0E43\u0E0A\u0E49 blob URL \u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27\u0E40\u0E1B\u0E47\u0E19 Reference Image \u0E16\u0E32\u0E27\u0E23"
      });
    }
    if (image.startsWith("/uploads/") || image.startsWith("http://") || image.startsWith("https://")) {
      const hash = imageHash || import_crypto2.default.createHash("sha256").update(image).digest("hex");
      const refId = referenceImageId || `ref_loc_${hash.slice(0, 10)}_${Date.now()}`;
      return res.json({
        success: true,
        referenceImageId: refId,
        referenceImageUrl: image,
        imageHash: hash
      });
    }
    const persisted = persistLocationReferenceImage(image, referenceImageId);
    return res.json({
      success: true,
      referenceImageId: persisted.referenceImageId,
      referenceImageUrl: persisted.referenceImageUrl,
      imageHash: persisted.imageHash
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to upload location reference image"
    });
  }
});
app.post("/api/location/analyze-image", async (req, res) => {
  try {
    const { image, images, apiKey, forceReanalyze } = req.body || {};
    const rawImagesList = Array.isArray(images) ? images.filter((img) => typeof img === "string" && img.trim().length > 0) : image && typeof image === "string" && image.trim().length > 0 ? [image] : [];
    if (rawImagesList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E2A\u0E48\u0E07\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E base64 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E2B\u0E49 AI \u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48 (Location Image is required)"
      });
    }
    const parsedImages = rawImagesList.map((img) => parseImageData(img)).filter((p) => p !== null && p.base64Data.length > 0).slice(0, 4);
    if (parsedImages.length === 0) {
      const firstUrl = rawImagesList[0];
      const urlHash = import_crypto2.default.createHash("sha256").update(firstUrl).digest("hex");
      if (!forceReanalyze && locationAnalysisCache.has(urlHash)) {
        return res.json({
          success: true,
          source: "cache",
          cached: true,
          data: locationAnalysisCache.get(urlHash).data
        });
      }
    }
    const primaryParsed = parsedImages[0] || { mimeType: "image/jpeg", base64Data: rawImagesList[0] };
    const primaryImageHash = import_crypto2.default.createHash("sha256").update(primaryParsed.base64Data).digest("hex");
    if (!forceReanalyze && locationAnalysisCache.has(primaryImageHash)) {
      const cached = locationAnalysisCache.get(primaryImageHash);
      console.log(`[Location Vision Cost Guard] Cache hit for location imageHash: ${primaryImageHash}. Skipping Gemini Vision call.`);
      return res.json({
        success: true,
        source: "cache",
        cached: true,
        data: cached.data
      });
    }
    const userKey = typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : void 0;
    const ai = getGeminiClient(userKey);
    if (!ai) {
      return res.status(400).json({
        success: false,
        code: "GEMINI_KEY_MISSING",
        message: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 Gemini API Key \u0E08\u0E36\u0E07\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E14\u0E49\u0E27\u0E22 AI \u0E44\u0E21\u0E48\u0E44\u0E14\u0E49 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 API Key \u0E2B\u0E23\u0E37\u0E2D\u0E01\u0E23\u0E2D\u0E01\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E40\u0E2D\u0E07 / No Gemini API key: location analysis unavailable."
      });
    }
    let persistentRefUrl = "";
    let persistentRefId = `ref_loc_${primaryImageHash.slice(0, 10)}_${Date.now()}`;
    if (primaryParsed.base64Data.length > 100) {
      try {
        const persisted = persistLocationReferenceImage(`data:${primaryParsed.mimeType};base64,${primaryParsed.base64Data}`, persistentRefId);
        persistentRefUrl = persisted.referenceImageUrl;
        persistentRefId = persisted.referenceImageId;
      } catch (saveErr) {
        console.warn("Could not persist location image to disk:", saveErr);
      }
    }
    let analysisResult = null;
    try {
      const systemInstruction = `\u0E04\u0E38\u0E13\u0E40\u0E1B\u0E47\u0E19 AI \u0E1C\u0E39\u0E49\u0E40\u0E0A\u0E35\u0E48\u0E22\u0E27\u0E0A\u0E32\u0E0D\u0E14\u0E49\u0E32\u0E19\u0E09\u0E32\u0E01\u0E41\u0E25\u0E30\u0E2A\u0E16\u0E32\u0E1B\u0E31\u0E15\u0E22\u0E01\u0E23\u0E23\u0E21\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E07\u0E32\u0E19\u0E16\u0E48\u0E32\u0E22\u0E17\u0E33\u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C\u0E41\u0E25\u0E30\u0E2A\u0E15\u0E39\u0E14\u0E34\u0E42\u0E2D (Location & Production Design Continuity Specialist)
\u0E2B\u0E19\u0E49\u0E32\u0E17\u0E35\u0E48\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E04\u0E37\u0E2D: \u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E08\u0E23\u0E34\u0E07\u0E08\u0E32\u0E01\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07 (Location Reference Image) \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E0A\u0E49\u0E40\u0E1B\u0E47\u0E19 "LOCATION LOCK" \u0E25\u0E47\u0E2D\u0E04\u0E04\u0E27\u0E32\u0E21\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E02\u0E2D\u0E07\u0E2B\u0E49\u0E2D\u0E07\u0E41\u0E25\u0E30\u0E2A\u0E16\u0E32\u0E1B\u0E31\u0E15\u0E22\u0E01\u0E23\u0E23\u0E21\u0E02\u0E49\u0E32\u0E21\u0E04\u0E25\u0E34\u0E1B
\u0E2B\u0E25\u0E31\u0E01\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E04\u0E31\u0E0D: \u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E2A\u0E34\u0E48\u0E07\u0E17\u0E35\u0E48\u0E21\u0E2D\u0E07\u0E40\u0E2B\u0E47\u0E19\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19\u0E43\u0E19\u0E20\u0E32\u0E1E\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E15\u0E34\u0E21\u0E41\u0E15\u0E48\u0E07

\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E41\u0E21\u0E48\u0E19\u0E22\u0E33 (Location Architectural Blueprint):
1. "name": \u0E0A\u0E37\u0E48\u0E2D\u0E23\u0E30\u0E1A\u0E38\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E2A\u0E31\u0E49\u0E19\u0E01\u0E23\u0E30\u0E0A\u0E31\u0E1A \u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19 \u0E40\u0E0A\u0E48\u0E19 "\u0E2B\u0E49\u0E2D\u0E07\u0E19\u0E31\u0E48\u0E07\u0E40\u0E25\u0E48\u0E19\u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E2A\u0E41\u0E01\u0E19\u0E14\u0E34\u0E40\u0E19\u0E40\u0E27\u0E35\u0E22\u0E19", "\u0E2B\u0E49\u0E2D\u0E07\u0E17\u0E33\u0E07\u0E32\u0E19\u0E2A\u0E15\u0E39\u0E14\u0E34\u0E42\u0E2D\u0E42\u0E21\u0E40\u0E14\u0E34\u0E23\u0E4C\u0E19", "\u0E0A\u0E32\u0E19\u0E40\u0E23\u0E37\u0E2D\u0E19\u0E44\u0E21\u0E49\u0E23\u0E34\u0E21\u0E19\u0E49\u0E33"
2. "environmentType": \u0E1B\u0E23\u0E30\u0E40\u0E20\u0E17\u0E1E\u0E37\u0E49\u0E19\u0E17\u0E35\u0E48 \u0E40\u0E0A\u0E48\u0E19 "Indoor (\u0E2B\u0E49\u0E2D\u0E07\u0E2A\u0E48\u0E27\u0E19\u0E15\u0E31\u0E27)", "Semi-outdoor (\u0E23\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E07/\u0E0A\u0E32\u0E19\u0E40\u0E23\u0E37\u0E2D\u0E19)", "Outdoor (\u0E2A\u0E27\u0E19/\u0E25\u0E32\u0E19\u0E01\u0E27\u0E49\u0E32\u0E07)"
3. "architecturalStyle": \u0E2A\u0E44\u0E15\u0E25\u0E4C\u0E2A\u0E16\u0E32\u0E1B\u0E31\u0E15\u0E22\u0E01\u0E23\u0E23\u0E21 \u0E40\u0E0A\u0E48\u0E19 "Modern Minimalist", "Industrial Loft", "Traditional Thai", "Cyberpunk / Sci-Fi"
4. "wallColor": \u0E2A\u0E35\u0E41\u0E25\u0E30\u0E1E\u0E37\u0E49\u0E19\u0E1C\u0E34\u0E27\u0E02\u0E2D\u0E07\u0E1C\u0E19\u0E31\u0E07\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14 \u0E40\u0E0A\u0E48\u0E19 "\u0E1C\u0E19\u0E31\u0E07\u0E1B\u0E39\u0E19\u0E40\u0E1B\u0E25\u0E37\u0E2D\u0E22\u0E2A\u0E35\u0E40\u0E17\u0E32\u0E2D\u0E48\u0E2D\u0E19\u0E2A\u0E25\u0E31\u0E1A\u0E44\u0E21\u0E49\u0E23\u0E30\u0E41\u0E19\u0E07"
5. "floor": \u0E27\u0E31\u0E2A\u0E14\u0E38\u0E41\u0E25\u0E30\u0E25\u0E27\u0E14\u0E25\u0E32\u0E22\u0E02\u0E2D\u0E07\u0E1E\u0E37\u0E49\u0E19 \u0E40\u0E0A\u0E48\u0E19 "\u0E1E\u0E37\u0E49\u0E19\u0E44\u0E21\u0E49\u0E25\u0E32\u0E21\u0E34\u0E40\u0E19\u0E15\u0E2A\u0E35\u0E42\u0E2D\u0E4A\u0E04\u0E25\u0E32\u0E22\u0E01\u0E49\u0E32\u0E07\u0E1B\u0E25\u0E32 \u0E21\u0E35\u0E1E\u0E23\u0E21\u0E02\u0E19\u0E2A\u0E31\u0E49\u0E19\u0E2A\u0E35\u0E40\u0E17\u0E32"
6. "ceiling": \u0E40\u0E1E\u0E14\u0E32\u0E19\u0E41\u0E25\u0E30\u0E01\u0E32\u0E23\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E44\u0E1F \u0E40\u0E0A\u0E48\u0E19 "\u0E1D\u0E49\u0E32\u0E2B\u0E25\u0E38\u0E21\u0E2A\u0E35\u0E02\u0E32\u0E27\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E0B\u0E48\u0E2D\u0E19\u0E44\u0E1F\u0E27\u0E2D\u0E23\u0E4C\u0E21\u0E44\u0E27\u0E17\u0E4C\u0E41\u0E25\u0E30\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E44\u0E25\u0E17\u0E4C"
7. "doors": \u0E1B\u0E23\u0E30\u0E15\u0E39 \u0E01\u0E23\u0E2D\u0E1A \u0E41\u0E25\u0E30\u0E27\u0E31\u0E2A\u0E14\u0E38 \u0E40\u0E0A\u0E48\u0E19 "\u0E1B\u0E23\u0E30\u0E15\u0E39\u0E01\u0E23\u0E30\u0E08\u0E01\u0E1A\u0E32\u0E19\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E01\u0E23\u0E2D\u0E1A\u0E2D\u0E25\u0E39\u0E21\u0E34\u0E40\u0E19\u0E35\u0E22\u0E21\u0E14\u0E33"
8. "windows": \u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07 \u0E17\u0E34\u0E28\u0E17\u0E32\u0E07\u0E41\u0E2A\u0E07\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 \u0E40\u0E0A\u0E48\u0E19 "\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07\u0E01\u0E23\u0E30\u0E08\u0E01\u0E17\u0E23\u0E07\u0E2A\u0E39\u0E07\u0E08\u0E23\u0E14\u0E40\u0E1E\u0E14\u0E32\u0E19 \u0E23\u0E31\u0E1A\u0E41\u0E2A\u0E07\u0E19\u0E38\u0E48\u0E21\u0E19\u0E27\u0E25"
9. "majorFurniture": \u0E40\u0E1F\u0E2D\u0E23\u0E4C\u0E19\u0E34\u0E40\u0E08\u0E2D\u0E23\u0E4C\u0E0A\u0E34\u0E49\u0E19\u0E2B\u0E25\u0E31\u0E01 \u0E40\u0E0A\u0E48\u0E19 "\u0E42\u0E0B\u0E1F\u0E32\u0E1C\u0E49\u0E32\u0E17\u0E23\u0E07\u0E41\u0E2D\u0E25\u0E2A\u0E35\u0E40\u0E17\u0E32, \u0E42\u0E15\u0E4A\u0E30\u0E01\u0E25\u0E32\u0E07\u0E44\u0E21\u0E49\u0E01\u0E25\u0E21"
10. "fixedObjects": \u0E2A\u0E34\u0E48\u0E07\u0E01\u0E48\u0E2D\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E15\u0E34\u0E14\u0E1C\u0E19\u0E31\u0E07\u0E2B\u0E23\u0E37\u0E2D\u0E1A\u0E34\u0E25\u0E17\u0E4C\u0E2D\u0E34\u0E19 \u0E40\u0E0A\u0E48\u0E19 "\u0E0A\u0E31\u0E49\u0E19\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E37\u0E2D\u0E1A\u0E34\u0E25\u0E17\u0E4C\u0E2D\u0E34\u0E19\u0E44\u0E23\u0E49\u0E21\u0E37\u0E2D\u0E08\u0E31\u0E1A, \u0E41\u0E1C\u0E07\u0E40\u0E04\u0E32\u0E19\u0E4C\u0E40\u0E15\u0E2D\u0E23\u0E4C"
11. "spatialLayout": \u0E1C\u0E31\u0E07\u0E01\u0E32\u0E23\u0E08\u0E31\u0E14\u0E27\u0E32\u0E07\u0E1E\u0E37\u0E49\u0E19\u0E17\u0E35\u0E48 \u0E40\u0E0A\u0E48\u0E19 "\u0E1E\u0E37\u0E49\u0E19\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E42\u0E25\u0E48\u0E07 Open Concept \u0E21\u0E2D\u0E07\u0E17\u0E30\u0E25\u0E38\u0E16\u0E36\u0E07\u0E42\u0E15\u0E4A\u0E30\u0E2D\u0E32\u0E2B\u0E32\u0E23"
12. "permanentDecor": \u0E02\u0E2D\u0E07\u0E15\u0E01\u0E41\u0E15\u0E48\u0E07\u0E16\u0E32\u0E27\u0E23 \u0E40\u0E0A\u0E48\u0E19 "\u0E20\u0E32\u0E1E\u0E27\u0E32\u0E14\u0E28\u0E34\u0E25\u0E1B\u0E30\u0E02\u0E19\u0E32\u0E14\u0E43\u0E2B\u0E0D\u0E48, \u0E42\u0E04\u0E21\u0E44\u0E1F\u0E15\u0E31\u0E49\u0E07\u0E1E\u0E37\u0E49\u0E19\u0E17\u0E23\u0E07\u0E42\u0E04\u0E49\u0E07"
13. "distinctiveFeatures": \u0E08\u0E38\u0E14\u0E40\u0E14\u0E48\u0E19\u0E40\u0E09\u0E1E\u0E32\u0E30\u0E15\u0E31\u0E27\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E0B\u0E49\u0E33\u0E43\u0E04\u0E23\u0E17\u0E35\u0E48\u0E43\u0E0A\u0E49\u0E25\u0E47\u0E2D\u0E04\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E02\u0E49\u0E32\u0E21\u0E04\u0E25\u0E34\u0E1B
14. "availableViews": \u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E17\u0E35\u0E48\u0E21\u0E35\u0E43\u0E19\u0E20\u0E32\u0E1E \u0E40\u0E0A\u0E48\u0E19 ["WIDE_SHOT", "CORNER_VIEW", "DETAIL_VIEW"]
15. "generatedVisualPrompt": \u0E2A\u0E23\u0E38\u0E1B\u0E40\u0E1B\u0E47\u0E19\u0E20\u0E32\u0E29\u0E32\u0E2D\u0E31\u0E07\u0E01\u0E24\u0E29\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E19\u0E33\u0E44\u0E1B\u0E25\u0E47\u0E2D\u0E04\u0E43\u0E19 Prompt \u0E02\u0E2D\u0E07 AI Video \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E2B\u0E49\u0E20\u0E32\u0E1E\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E04\u0E07\u0E17\u0E35\u0E48\u0E02\u0E49\u0E32\u0E21\u0E09\u0E32\u0E01`;
      const prompt = `\u0E01\u0E23\u0E38\u0E13\u0E32\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E19\u0E35\u0E49\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E15\u0E32\u0E21\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07 JSON:
{
"name": string,
"environmentType": string,
"architecturalStyle": string,
"wallColor": string,
"floor": string,
"ceiling": string,
"doors": string,
"windows": string,
"majorFurniture": string,
"fixedObjects": string,
"spatialLayout": string,
"permanentDecor": string,
"distinctiveFeatures": string,
"availableViews": string[],
"confidence": number,
"generatedVisualPrompt": string,
"storyLocationName": string,
"description": string,
"notes": string
}`;
      const parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType: primaryParsed.mimeType,
            data: primaryParsed.base64Data
          }
        }
      ];
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: parts,
        config: {
          systemInstruction,
          responseMimeType: "application/json"
        }
      });
      const text = (response.text || "").replace(/^```json\s*/i, "").replace(/\s*```$/i, "").trim();
      analysisResult = text ? JSON.parse(text) : null;
    } catch (geminiErr) {
      const reason = formatGenAIError(geminiErr);
      console.warn("Gemini location analysis failed:", reason);
      return res.status(502).json({
        success: false,
        code: "GEMINI_API_ERROR",
        message: `Gemini \u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08: ${reason} / Gemini location analysis failed.`
      });
    }
    if (!analysisResult || typeof analysisResult !== "object" || !analysisResult.name) {
      return res.status(502).json({
        success: false,
        code: "GEMINI_INVALID_RESULT",
        message: "Gemini \u0E2A\u0E48\u0E07\u0E1C\u0E25\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E04\u0E23\u0E1A (\u0E44\u0E21\u0E48\u0E21\u0E35\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48) \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48 / Gemini returned an incomplete location analysis."
      });
    }
    const fullResult = {
      ...analysisResult,
      imageHash: primaryImageHash,
      referenceImageId: persistentRefId,
      referenceImageUrl: persistentRefUrl || rawImagesList[0],
      identity: {
        id: `loc_${primaryImageHash.slice(0, 10)}`,
        name: analysisResult.name || "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E43\u0E2B\u0E21\u0E48"
      },
      referenceMetadata: {
        referenceImageId: persistentRefId,
        referenceImageUrl: persistentRefUrl || rawImagesList[0],
        imageHash: primaryImageHash,
        availableViews: analysisResult.availableViews || ["WIDE_SHOT"],
        imageAnalysisStatus: "USER_CONFIRMED"
      },
      visualProfile: {
        environmentType: analysisResult.environmentType || "Indoor",
        architecturalStyle: analysisResult.architecturalStyle || "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
        wallColor: analysisResult.wallColor || "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
        floor: analysisResult.floor || "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
        ceiling: analysisResult.ceiling || "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
        doors: analysisResult.doors || "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
        windows: analysisResult.windows || "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
        majorFurniture: analysisResult.majorFurniture || "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
        fixedObjects: analysisResult.fixedObjects || "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
        spatialLayout: analysisResult.spatialLayout || "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
        permanentDecor: analysisResult.permanentDecor || "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
        distinctiveFeatures: analysisResult.distinctiveFeatures || "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
        confidence: analysisResult.confidence || 95,
        generatedVisualPrompt: analysisResult.generatedVisualPrompt || "",
        referenceImageUrl: persistentRefUrl || rawImagesList[0],
        referenceImageId: persistentRefId,
        imageHash: primaryImageHash
      },
      storyProfile: {
        storyLocationName: analysisResult.storyLocationName || analysisResult.name || "\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E16\u0E48\u0E32\u0E22\u0E17\u0E33",
        description: analysisResult.description || "",
        notes: analysisResult.notes || ""
      }
    };
    locationAnalysisCache.set(primaryImageHash, {
      imageHash: primaryImageHash,
      timestamp: Date.now(),
      data: fullResult
    });
    res.json({
      success: true,
      source: "gemini-flash",
      cached: false,
      data: fullResult
    });
  } catch (err) {
    console.error("Error in /api/location/analyze-image:", err);
    res.status(500).json({
      success: false,
      message: err?.message || "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E27\u0E34\u0E40\u0E04\u0E23\u0E32\u0E30\u0E2B\u0E4C\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E44\u0E14\u0E49"
    });
  }
});
app.post("/api/generate", requireAuth, (req, res) => {
  const params = req.body;
  const user = req.user;
  const userAccount = req.creditAccount;
  if (!params.prompt || params.prompt.trim().length === 0) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01 Prompt \u0E01\u0E48\u0E2D\u0E19\u0E40\u0E23\u0E34\u0E48\u0E21\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1C\u0E25\u0E07\u0E32\u0E19" });
  }
  params.provider = params.provider || "mock";
  let adapter = providerManager.find(params.provider);
  if (!adapter || adapter.id !== "mock" && !adapter.hasKey) {
    adapter = providerManager.find("mock") || providerManager.list()[0];
    params.provider = "mock";
  }
  const cost = adapter.estimateCost(params);
  if (userAccount.remainingCredits < cost.estimatedCredits) {
    return res.status(403).json({
      success: false,
      message: `\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D\u0E44\u0E21\u0E48\u0E40\u0E1E\u0E35\u0E22\u0E07\u0E1E\u0E2D (\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23 ${cost.estimatedCredits} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 \u0E41\u0E15\u0E48\u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D ${userAccount.remainingCredits} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15) \u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E15\u0E34\u0E21\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15`
    });
  }
  if (userAccount.dailyUsedCredits + cost.estimatedCredits > userAccount.dailyLimit) {
    return res.status(403).json({
      success: false,
      message: `\u0E04\u0E38\u0E13\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E40\u0E01\u0E34\u0E19\u0E42\u0E04\u0E27\u0E15\u0E32\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19 (Daily Limit: ${userAccount.dailyLimit} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15) \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E43\u0E19\u0E27\u0E31\u0E19\u0E1E\u0E23\u0E38\u0E48\u0E07\u0E19\u0E35\u0E49\u0E2B\u0E23\u0E37\u0E2D\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19`
    });
  }
  userAccount.remainingCredits -= cost.estimatedCredits;
  userAccount.totalUsedCredits += cost.estimatedCredits;
  userAccount.dailyUsedCredits += cost.estimatedCredits;
  userAccount.monthlyUsedCredits += cost.estimatedCredits;
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const seed = params.seed || Math.floor(Math.random() * 1e6);
  const job = {
    id: jobId,
    userId: user.id,
    type: params.type,
    status: "queued",
    progress: 0,
    stage: "\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19\u0E04\u0E34\u0E27\u0E1B\u0E23\u0E30\u0E21\u0E27\u0E25\u0E1C\u0E25...",
    provider: params.provider,
    providerName: adapter.name,
    isMock: adapter.isMockOnly,
    model: params.model || `${params.provider}-standard`,
    prompt: params.prompt,
    negativePrompt: params.negativePrompt,
    aspectRatio: params.aspectRatio || "1:1",
    characterId: params.characterId,
    characterName: params.characterName,
    referenceImages: params.referenceImages,
    projectId: params.projectId,
    sceneId: params.sceneId,
    sceneNumber: params.sceneNumber,
    costCredits: cost.estimatedCredits,
    seed,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    durationSeconds: params.durationSeconds || (params.type === "video" ? 5 : void 0)
  };
  jobsStore.set(jobId, job);
  userAccount.transactions.unshift({
    id: `tx_${jobId}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    amount: -cost.estimatedCredits,
    type: "usage",
    description: `\u0E2A\u0E23\u0E49\u0E32\u0E07${params.type === "video" ? "\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D" : "\u0E20\u0E32\u0E1E"}: ${params.prompt.substring(0, 32)}... (${adapter.name})`,
    jobId,
    balanceAfter: userAccount.remainingCredits
  });
  processJobInBackground(jobId, params);
  res.json({
    success: true,
    jobId,
    job,
    remainingCredits: userAccount.remainingCredits
  });
});
app.get("/api/jobs/:id", (req, res) => {
  const job = jobsStore.get(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E07\u0E32\u0E19\u0E17\u0E35\u0E48\u0E23\u0E30\u0E1A\u0E38" });
  }
  res.json({ success: true, job });
});
app.get("/api/jobs", requireAuth, (req, res) => {
  const user = req.user;
  let jobs = Array.from(jobsStore.values());
  if (user.role !== "admin") {
    jobs = jobs.filter((j) => !j.userId || j.userId === user.id);
  }
  jobs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json({ success: true, jobs });
});
function resolveVideoPathForJob(jobId) {
  if (jobId) {
    const cleanId = import_path.default.basename(jobId);
    const generatedDir = import_path.default.join(process.cwd(), "public", "generated-videos");
    const generatedPath = import_path.default.join(generatedDir, `${cleanId}.mp4`);
    if (import_fs.default.existsSync(generatedPath)) {
      return generatedPath;
    }
    const directGeneratedPath = import_path.default.join(generatedDir, cleanId);
    if (import_fs.default.existsSync(directGeneratedPath)) {
      return directGeneratedPath;
    }
    const job = jobsStore.get(jobId) || jobsStore.get(cleanId);
    if (job && job.localVideoPath && import_fs.default.existsSync(job.localVideoPath)) {
      return job.localVideoPath;
    }
    const sampleDir2 = import_path.default.join(process.cwd(), "public", "sample-videos");
    const samples2 = ["sala_sample_1.mp4", "sala_sample_2.mp4", "sala_sample_3.mp4"];
    if (samples2.includes(cleanId) && import_fs.default.existsSync(import_path.default.join(sampleDir2, cleanId))) {
      return import_path.default.join(sampleDir2, cleanId);
    }
    if (samples2.includes(`${cleanId}.mp4`) && import_fs.default.existsSync(import_path.default.join(sampleDir2, `${cleanId}.mp4`))) {
      return import_path.default.join(sampleDir2, `${cleanId}.mp4`);
    }
  }
  const knownJob = jobId ? jobsStore.get(jobId) || jobsStore.get(import_path.default.basename(jobId)) : void 0;
  if (!knownJob || !knownJob.isMock || knownJob.status === "failed") {
    return "";
  }
  const sampleDir = import_path.default.join(process.cwd(), "public", "sample-videos");
  const samples = ["sala_sample_1.mp4", "sala_sample_2.mp4", "sala_sample_3.mp4"];
  let charSum = 0;
  for (let i = 0; i < (jobId || "").length; i++) {
    charSum += jobId.charCodeAt(i);
  }
  const selectedSample = samples[charSum % samples.length];
  const fullPath = import_path.default.join(sampleDir, selectedSample);
  if (import_fs.default.existsSync(fullPath)) {
    return fullPath;
  }
  return import_path.default.join(sampleDir, "sala_sample_1.mp4");
}
app.get(["/api/video-stream/:jobId", "/api/media/:jobId"], (req, res) => {
  const { jobId } = req.params;
  const filePath = resolveVideoPathForJob(jobId);
  if (!import_fs.default.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E44\u0E1F\u0E25\u0E4C\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E02\u0E2D\u0E07\u0E07\u0E32\u0E19\u0E19\u0E35\u0E49\u0E1A\u0E19\u0E40\u0E0B\u0E34\u0E23\u0E4C\u0E1F\u0E40\u0E27\u0E2D\u0E23\u0E4C (Video file not found)" });
  }
  const stat = import_fs.default.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Range, Accept-Ranges, Content-Type");
  res.setHeader("Accept-Ranges", "bytes");
  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (start >= fileSize || end >= fileSize) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
      return res.end();
    }
    const chunksize = end - start + 1;
    const file = import_fs.default.createReadStream(filePath, { start, end });
    const head = {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": "video/mp4"
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      "Content-Length": fileSize,
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes"
    };
    res.writeHead(200, head);
    import_fs.default.createReadStream(filePath).pipe(res);
  }
});
function handleVideoDownload(req, res, rawJobId) {
  const filePath = resolveVideoPathForJob(rawJobId);
  if (!import_fs.default.existsSync(filePath)) {
    return res.status(404).send("\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E44\u0E1F\u0E25\u0E4C\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E14\u0E32\u0E27\u0E19\u0E4C\u0E42\u0E2B\u0E25\u0E14");
  }
  const stat = import_fs.default.statSync(filePath);
  const cleanId = (rawJobId || "video").replace(/[^a-zA-Z0-9_-]/g, "_");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition, Content-Length");
  res.setHeader("Content-Disposition", `attachment; filename="sala_video_${cleanId}.mp4"`);
  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Content-Length", stat.size);
  import_fs.default.createReadStream(filePath).pipe(res);
}
app.get("/api/download/video", (req, res) => {
  const rawJobId = req.query.jobId || req.query.id || req.query.file || "job_default";
  handleVideoDownload(req, res, rawJobId);
});
app.get("/api/download/video/:jobId", (req, res) => {
  handleVideoDownload(req, res, req.params.jobId);
});
app.get("/api/characters", async (req, res) => {
  const auth = await getAuthenticatedUser(req);
  const currentUserId = auth?.user?.id || "demo_creator";
  if (auth?.user?.id) {
    try {
      const db = getServerFirestore();
      if (db) {
        const q = (0, import_firestore.query)((0, import_firestore.collection)(db, "characters"), (0, import_firestore.where)("userId", "==", currentUserId));
        const snap = await (0, import_firestore.getDocs)(q);
        snap.forEach((docSnap) => {
          const charData = docSnap.data();
          if (charData && charData.name) {
            const charItem = { ...charData, id: docSnap.id, userId: currentUserId };
            const existingIdx = charactersStore.findIndex((c) => c.id === charItem.id);
            if (existingIdx >= 0) {
              charactersStore[existingIdx] = charItem;
            } else {
              charactersStore.unshift(charItem);
            }
          }
        });
        const userCol = (0, import_firestore.collection)(db, "users", currentUserId, "characters");
        const userSnap = await (0, import_firestore.getDocs)(userCol);
        userSnap.forEach((docSnap) => {
          const charData = docSnap.data();
          if (charData && charData.name) {
            const charItem = { ...charData, id: docSnap.id, userId: currentUserId };
            const existingIdx = charactersStore.findIndex((c) => c.id === charItem.id);
            if (existingIdx >= 0) {
              charactersStore[existingIdx] = charItem;
            } else {
              charactersStore.unshift(charItem);
            }
          }
        });
      }
    } catch (err) {
      console.warn("[Server Firestore] Could not sync characters from Firestore for user:", err);
    }
  }
  const userChars = charactersStore.filter((c) => !c.userId || c.userId === currentUserId || c.userId === "default_system" || c.userId === "demo_creator");
  res.json({ success: true, characters: userChars.length > 0 ? userChars : charactersStore });
});
app.post("/api/characters", requireAuth, async (req, res) => {
  const data = req.body;
  if (!data.name) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23" });
  }
  const currentUserId = req.user.id;
  let persistentImageUrl = data.referenceImageUrl || "";
  let referenceImageId = data.referenceImageId || data.referenceMetadata?.referenceImageId || `ref_${Date.now()}`;
  let finalImageHash = data.imageHash || data.visualProfileImageHash || data.currentReferenceImageHash || data.referenceMetadata?.imageHash || "";
  const rawFirstImage = data.referenceImageUrl?.startsWith("data:image") ? data.referenceImageUrl : data.referenceImages?.[0]?.startsWith("data:image") ? data.referenceImages[0] : null;
  if (rawFirstImage) {
    try {
      const persisted = persistReferenceImage(rawFirstImage, referenceImageId);
      persistentImageUrl = persisted.referenceImageUrl;
      referenceImageId = persisted.referenceImageId;
      if (!finalImageHash) finalImageHash = persisted.imageHash;
    } catch (e) {
      console.warn("Could not persist base64 reference image:", e);
    }
  }
  if (!persistentImageUrl && data.avatarUrl && !data.avatarUrl.startsWith("data:image") && !data.avatarUrl.startsWith("blob:")) {
    persistentImageUrl = data.avatarUrl;
  }
  const persistentImagesList = (data.referenceImages || []).map((img, idx) => {
    if (typeof img === "string" && img.startsWith("data:image")) {
      try {
        const persisted = persistReferenceImage(img, idx === 0 ? referenceImageId : void 0);
        return persisted.referenceImageUrl;
      } catch {
        return persistentImageUrl;
      }
    }
    return img;
  }).filter((img) => typeof img === "string" && !img.startsWith("blob:") && !img.startsWith("data:image"));
  if (persistentImageUrl && !persistentImagesList.includes(persistentImageUrl)) {
    persistentImagesList.unshift(persistentImageUrl);
  }
  const finalAvatar = persistentImageUrl || persistentImagesList[0] || data.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80";
  const updatedReferenceMetadata = data.referenceMetadata ? {
    ...data.referenceMetadata,
    referenceImageId,
    referenceImageUrl: persistentImageUrl || data.referenceMetadata.referenceImageUrl,
    imageHash: finalImageHash || data.referenceMetadata.imageHash,
    availableViews: data.referenceMetadata.availableViews || (persistentImagesList.length > 1 ? ["MULTI_VIEWS"] : ["FRONT"])
  } : {
    referenceImageId,
    referenceImageUrl: persistentImageUrl,
    imageHash: finalImageHash,
    availableViews: persistentImagesList.length > 1 ? ["MULTI_VIEWS"] : ["FRONT"]
  };
  const updatedVisualProfile = data.visualProfile ? {
    ...data.visualProfile,
    referenceImage: persistentImageUrl || data.visualProfile.referenceImage,
    referenceImageUrl: persistentImageUrl || data.visualProfile.referenceImageUrl,
    referenceImageId,
    imageHash: finalImageHash || data.visualProfile.imageHash,
    referenceImages: persistentImagesList.length > 0 ? persistentImagesList : [persistentImageUrl]
  } : void 0;
  const newCharId = data.id || `char_${Date.now()}`;
  const newChar = {
    id: newCharId,
    userId: currentUserId,
    name: data.name,
    gender: data.gender || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38",
    age: data.age || "\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38",
    description: data.description || "",
    triggerTag: data.triggerTag || `(${data.name.replace(/\s+/g, "_").toLowerCase()}:1.2)`,
    referenceImageId,
    referenceImageUrl: persistentImageUrl,
    imageHash: finalImageHash,
    referenceImages: persistentImagesList.length > 0 ? persistentImagesList : persistentImageUrl ? [persistentImageUrl] : [],
    avatarUrl: finalAvatar,
    outfitDescription: data.outfitDescription || "",
    consistencyStrength: data.consistencyStrength || 0.8,
    structuredFeatures: data.structuredFeatures,
    analysisConfidence: data.analysisConfidence,
    isVerifiedByUser: Boolean(data.isVerifiedByUser),
    identity: data.identity || {
      id: newCharId,
      name: data.name
    },
    characterIdentity: data.characterIdentity || data.identity || {
      id: newCharId,
      name: data.name
    },
    referenceMetadata: updatedReferenceMetadata,
    visualProfile: updatedVisualProfile,
    storyProfile: data.storyProfile || {
      age: data.age,
      personality: data.storyProfile?.personality || "",
      role: data.storyProfile?.role || "",
      background: data.storyProfile?.background || "",
      occupation: data.storyProfile?.occupation || ""
    },
    fieldSources: data.fieldSources,
    imageAnalysisStatus: data.imageAnalysisStatus,
    lockStatus: data.lockStatus,
    currentReferenceImageHash: finalImageHash,
    visualProfileImageHash: finalImageHash,
    createdAt: data.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const existingIdx = charactersStore.findIndex((c) => c.id === newChar.id);
  if (existingIdx >= 0) {
    charactersStore[existingIdx] = newChar;
  } else {
    charactersStore.unshift(newChar);
  }
  if (!isServerQuotaExhausted()) {
    try {
      const db = getServerFirestore();
      if (db) {
        await (0, import_firestore.setDoc)((0, import_firestore.doc)(db, "users", currentUserId, "characters", newChar.id), newChar, { merge: true });
        console.log(`[Firestore Server] Saved character "${newChar.name}" (${newChar.id}) for user ${currentUserId}`);
      }
    } catch (err) {
      handleServerFirestoreError(err, "Save character");
    }
  }
  res.json({ success: true, character: newChar });
});
app.delete("/api/characters/:id", requireAuth, async (req, res) => {
  const currentUserId = req.user.id;
  const char = charactersStore.find((c) => c.id === req.params.id);
  if (char && char.userId && char.userId !== currentUserId) {
    return res.status(403).json({ success: false, message: "\u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E25\u0E1A\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E2D\u0E37\u0E48\u0E19" });
  }
  charactersStore = charactersStore.filter((c) => c.id !== req.params.id);
  if (!isServerQuotaExhausted()) {
    try {
      const db = getServerFirestore();
      if (db) {
        await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, "users", currentUserId, "characters", req.params.id));
      }
    } catch (err) {
      handleServerFirestoreError(err, "Delete character");
    }
  }
  res.json({ success: true, message: "\u0E25\u0E1A\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.get("/api/locations", async (req, res) => {
  const auth = await getAuthenticatedUser(req);
  const currentUserId = auth?.user?.id;
  if (currentUserId && !isServerQuotaExhausted()) {
    try {
      const db = getServerFirestore();
      if (db) {
        const userCol = (0, import_firestore.collection)(db, "users", currentUserId, "locations");
        const userSnap = await (0, import_firestore.getDocs)(userCol);
        userSnap.forEach((docSnap) => {
          const locData = docSnap.data();
          if (locData && locData.name) {
            const locItem = { ...locData, id: docSnap.id, userId: currentUserId };
            const existingIdx = locationsStore.findIndex((l) => l.id === locItem.id);
            if (existingIdx >= 0) {
              locationsStore[existingIdx] = locItem;
            } else {
              locationsStore.unshift(locItem);
            }
          }
        });
      }
    } catch (err) {
      console.warn("[Server Firestore] Could not sync locations from Firestore for user:", err);
    }
  }
  const userLocations = locationsStore.filter((l) => !l.userId || l.userId === currentUserId || l.userId === "default_system" || l.userId === "demo_creator");
  res.json({ success: true, locations: userLocations.length > 0 ? userLocations : locationsStore });
});
app.post("/api/locations", requireAuth, async (req, res) => {
  const data = req.body;
  if (!data.name) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48" });
  }
  const currentUserId = req.user.id;
  let persistentImageUrl = data.referenceImageUrl || "";
  let referenceImageId = data.referenceImageId || data.referenceMetadata?.referenceImageId || `ref_loc_${Date.now()}`;
  let finalImageHash = data.imageHash || data.referenceMetadata?.imageHash || "";
  const rawFirstImage = data.referenceImageUrl?.startsWith("data:image") ? data.referenceImageUrl : data.referenceImages?.[0]?.startsWith("data:image") ? data.referenceImages[0] : null;
  if (rawFirstImage) {
    try {
      const persisted = persistLocationReferenceImage(rawFirstImage, referenceImageId);
      persistentImageUrl = persisted.referenceImageUrl;
      referenceImageId = persisted.referenceImageId;
      finalImageHash = persisted.imageHash;
    } catch (persistErr) {
      console.warn("Could not persist location image to disk:", persistErr);
    }
  }
  const rawImagesList = Array.isArray(data.referenceImages) ? data.referenceImages : [];
  const persistentImagesList = [];
  for (let idx = 0; idx < rawImagesList.length; idx++) {
    const img = rawImagesList[idx];
    if (typeof img === "string" && img.startsWith("data:image")) {
      try {
        const persisted = persistLocationReferenceImage(img, idx === 0 ? referenceImageId : void 0);
        persistentImagesList.push(persisted.referenceImageUrl);
      } catch (err) {
        console.warn("Could not persist secondary location image:", err);
      }
    } else if (typeof img === "string" && img.trim()) {
      persistentImagesList.push(img);
    }
  }
  if (persistentImageUrl && !persistentImagesList.includes(persistentImageUrl)) {
    persistentImagesList.unshift(persistentImageUrl);
  }
  const newLocId = data.id || `loc_${Date.now()}`;
  const newLocation = {
    id: newLocId,
    userId: currentUserId,
    name: data.name,
    type: "LOCATION",
    lockStatus: data.lockStatus || "LOCKED",
    imageAnalysisStatus: data.imageAnalysisStatus || "USER_CONFIRMED",
    referenceImageUrl: persistentImageUrl || data.referenceImageUrl || "",
    referenceImages: persistentImagesList.length > 0 ? persistentImagesList : persistentImageUrl ? [persistentImageUrl] : [],
    referenceImageId,
    imageHash: finalImageHash,
    thumbnailUrl: persistentImageUrl || data.thumbnailUrl || "",
    triggerTag: data.triggerTag || `(location_${data.name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()}:1.25)`,
    identity: data.identity || {
      id: newLocId,
      name: data.name
    },
    referenceMetadata: data.referenceMetadata || {
      referenceImageId,
      referenceImageUrl: persistentImageUrl,
      imageHash: finalImageHash,
      availableViews: persistentImagesList.length > 1 ? ["WIDE_SHOT", "CORNER_PERSPECTIVE"] : ["WIDE_SHOT"],
      imageAnalysisStatus: "USER_CONFIRMED"
    },
    visualProfile: data.visualProfile || {
      environmentType: "Indoor",
      architecturalStyle: "Modern",
      wallColor: "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
      floor: "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
      ceiling: "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
      doors: "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
      windows: "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
      majorFurniture: "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
      fixedObjects: "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
      spatialLayout: "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
      permanentDecor: "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
      distinctiveFeatures: "\u0E15\u0E32\u0E21\u0E20\u0E32\u0E1E\u0E2D\u0E49\u0E32\u0E07\u0E2D\u0E34\u0E07",
      referenceImageUrl: persistentImageUrl,
      referenceImageId,
      imageHash: finalImageHash,
      confidence: 95,
      generatedVisualPrompt: ""
    },
    storyProfile: data.storyProfile || {
      storyLocationName: data.name,
      description: data.description || "",
      notes: ""
    },
    createdAt: data.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const existingIdx = locationsStore.findIndex((l) => l.id === newLocation.id);
  if (existingIdx >= 0) {
    locationsStore[existingIdx] = newLocation;
  } else {
    locationsStore.unshift(newLocation);
  }
  if (!isServerQuotaExhausted()) {
    try {
      const db = getServerFirestore();
      if (db) {
        await (0, import_firestore.setDoc)((0, import_firestore.doc)(db, "users", currentUserId, "locations", newLocation.id), newLocation, { merge: true });
        console.log(`[Firestore Server] Saved location "${newLocation.name}" (${newLocation.id}) for user ${currentUserId}`);
      }
    } catch (err) {
      handleServerFirestoreError(err, "Save location");
    }
  }
  res.json({ success: true, location: newLocation });
});
app.delete("/api/locations/:id", requireAuth, async (req, res) => {
  const currentUserId = req.user.id;
  const loc = locationsStore.find((l) => l.id === req.params.id);
  if (loc && loc.userId && loc.userId !== currentUserId && req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "\u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E25\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E2D\u0E37\u0E48\u0E19" });
  }
  locationsStore = locationsStore.filter((l) => l.id !== req.params.id);
  if (!isServerQuotaExhausted()) {
    try {
      const db = getServerFirestore();
      if (db) {
        await (0, import_firestore.deleteDoc)((0, import_firestore.doc)(db, "users", currentUserId, "locations", req.params.id));
      }
    } catch (err) {
      handleServerFirestoreError(err, "Delete location");
    }
  }
  res.json({ success: true, message: "\u0E25\u0E1A\u0E2A\u0E16\u0E32\u0E19\u0E17\u0E35\u0E48\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.get("/api/projects", requireAuth, (req, res) => {
  if (req.user.role === "admin") {
    return res.json({ success: true, projects: projectsStore });
  }
  const userProjects = projectsStore.filter((p) => !p.userId || p.userId === req.user.id || p.userId === "default_system" || p.userId === "demo_creator");
  res.json({ success: true, projects: userProjects.length > 0 ? userProjects : projectsStore });
});
app.post("/api/projects", requireAuth, (req, res) => {
  const data = req.body;
  const newProject = {
    id: `proj_${Date.now()}`,
    userId: req.user.id,
    title: data.title || "\u0E42\u0E1B\u0E23\u0E40\u0E08\u0E47\u0E01\u0E15\u0E4C\u0E43\u0E2B\u0E21\u0E48",
    description: data.description || "",
    aspectRatio: data.aspectRatio || "16:9",
    defaultCharacterId: data.defaultCharacterId,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    scenes: data.scenes || [
      {
        id: `scene_${Date.now()}_1`,
        sceneNumber: 1,
        title: "\u0E09\u0E32\u0E01\u0E17\u0E35\u0E48 1 (\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07)",
        prompt: "",
        negativePrompt: "",
        mediaType: "image",
        aspectRatio: data.aspectRatio || "16:9",
        characterId: data.defaultCharacterId,
        usePreviousSceneAsRef: false,
        status: "draft"
      }
    ]
  };
  projectsStore.unshift(newProject);
  res.json({ success: true, project: newProject });
});
app.put("/api/projects/:id", requireAuth, (req, res) => {
  const index = projectsStore.findIndex((p) => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E42\u0E1B\u0E23\u0E40\u0E08\u0E47\u0E01\u0E15\u0E4C" });
  }
  const existing = projectsStore[index];
  if (existing.userId && existing.userId !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "\u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E41\u0E01\u0E49\u0E44\u0E02\u0E42\u0E1B\u0E23\u0E40\u0E08\u0E47\u0E01\u0E15\u0E4C\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E2D\u0E37\u0E48\u0E19" });
  }
  projectsStore[index] = {
    ...existing,
    ...req.body,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  res.json({ success: true, project: projectsStore[index] });
});
app.delete("/api/projects/:id", requireAuth, (req, res) => {
  const existing = projectsStore.find((p) => p.id === req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E42\u0E1B\u0E23\u0E40\u0E08\u0E47\u0E01\u0E15\u0E4C" });
  }
  if (existing.userId && existing.userId !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "\u0E04\u0E38\u0E13\u0E44\u0E21\u0E48\u0E21\u0E35\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E25\u0E1A\u0E42\u0E1B\u0E23\u0E40\u0E08\u0E47\u0E01\u0E15\u0E4C\u0E02\u0E2D\u0E07\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E2D\u0E37\u0E48\u0E19" });
  }
  projectsStore = projectsStore.filter((p) => p.id !== req.params.id);
  res.json({ success: true, message: "\u0E25\u0E1A\u0E42\u0E1B\u0E23\u0E40\u0E08\u0E47\u0E01\u0E15\u0E4C\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.get("/api/credits", async (req, res) => {
  const auth = await getAuthenticatedUser(req);
  const account = auth?.account || creditAccountsStore.get("user_sala_001") || currentUserAccount;
  res.json({
    success: true,
    account
  });
});
app.post("/api/credits/topup", requireAdmin, async (req, res) => {
  const auth = await getAuthenticatedUser(req);
  const account = auth?.account || creditAccountsStore.get("user_sala_001") || currentUserAccount;
  const { amount } = req.body;
  const numAmount = Number(amount) || 100;
  account.remainingCredits += numAmount;
  account.transactions.unshift({
    id: `tx_topup_${Date.now()}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    amount: numAmount,
    type: "topup",
    description: `\u0E40\u0E15\u0E34\u0E21\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E23\u0E30\u0E1A\u0E1A (\u0E17\u0E14\u0E2A\u0E2D\u0E1A Sandbox +${numAmount} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15)`,
    balanceAfter: account.remainingCredits
  });
  res.json({
    success: true,
    account,
    message: `\u0E40\u0E15\u0E34\u0E21\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 +${numAmount} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15`
  });
});
var stripeClient = null;
function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!stripeClient) {
    stripeClient = new import_stripe.default(secretKey);
  }
  return stripeClient;
}
var serverFirestoreDb = null;
function getServerFirestore() {
  if (!serverFirestoreDb) {
    try {
      const cfgPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
      if (import_fs.default.existsSync(cfgPath)) {
        const config = JSON.parse(import_fs.default.readFileSync(cfgPath, "utf-8"));
        const appName = "sala-server-app";
        const existing = (0, import_app.getApps)().find((a) => a.name === appName);
        const serverApp = existing || (0, import_app.initializeApp)({
          apiKey: config.apiKey,
          projectId: config.projectId,
          appId: config.appId
        }, appName);
        serverFirestoreDb = config.firestoreDatabaseId ? (0, import_firestore.getFirestore)(serverApp, config.firestoreDatabaseId) : (0, import_firestore.getFirestore)(serverApp);
      }
    } catch (err) {
      console.error("[Server Firestore] Init error:", err);
    }
  }
  return serverFirestoreDb;
}
var serverFirestoreQuotaExhausted = false;
var serverFirestoreQuotaExhaustedAt = 0;
function isServerQuotaExhausted() {
  if (!serverFirestoreQuotaExhausted) return false;
  if (Date.now() - serverFirestoreQuotaExhaustedAt > 12 * 60 * 60 * 1e3) {
    serverFirestoreQuotaExhausted = false;
    return false;
  }
  return true;
}
function handleServerFirestoreError(err, context) {
  const msg = String(err?.message || err || "");
  if (err?.code === "resource-exhausted" || msg.includes("Quota exceeded") || msg.includes("quota metric") || msg.includes("RESOURCE_EXHAUSTED")) {
    if (!serverFirestoreQuotaExhausted) {
      serverFirestoreQuotaExhausted = true;
      serverFirestoreQuotaExhaustedAt = Date.now();
      console.warn(`[Server Firestore] \u26A0\uFE0F Daily write quota exceeded in ${context}. Gracefully switching to server-memory fallback.`);
    }
  } else {
    console.warn(`[Server Firestore] ${context} notice:`, msg);
  }
}
var PROCESSED_TX_FILE = import_path.default.join(process.cwd(), "data", "processed_stripe_tx.json");
var processedTransactions = /* @__PURE__ */ new Set();
function loadProcessedTransactions() {
  try {
    if (import_fs.default.existsSync(PROCESSED_TX_FILE)) {
      const raw = import_fs.default.readFileSync(PROCESSED_TX_FILE, "utf-8");
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach((id) => {
          if (typeof id === "string") processedTransactions.add(id);
        });
      }
    }
  } catch (err) {
    console.warn("[Idempotency] Could not load processed transactions:", err);
  }
}
loadProcessedTransactions();
function isTransactionProcessed(txId) {
  if (!txId) return false;
  return processedTransactions.has(txId);
}
function markTransactionProcessed(txId) {
  if (!txId) return;
  processedTransactions.add(txId);
  try {
    const dir = import_path.default.dirname(PROCESSED_TX_FILE);
    if (!import_fs.default.existsSync(dir)) import_fs.default.mkdirSync(dir, { recursive: true });
    import_fs.default.writeFileSync(PROCESSED_TX_FILE, JSON.stringify(Array.from(processedTransactions)), "utf-8");
  } catch (err) {
    console.warn("[Idempotency] Could not persist processed transaction:", err);
  }
}
var mockCheckoutSessions = /* @__PURE__ */ new Map();
async function creditUserInFirestore(uid, credits, description = "Stripe Payment", transactionId) {
  const account = creditAccountsStore.get(uid) || currentUserAccount;
  if (account) {
    account.remainingCredits += credits;
    account.transactions.unshift({
      id: transactionId || `tx_stripe_${Date.now()}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      amount: credits,
      type: "topup",
      description: `${description} (+${credits} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15)`,
      balanceAfter: account.remainingCredits
    });
  }
  if (!isServerQuotaExhausted()) {
    try {
      const db = getServerFirestore();
      if (db && uid) {
        const userRef = (0, import_firestore.doc)(db, "users", uid);
        await (0, import_firestore.setDoc)(userRef, {
          credits: (0, import_firestore.increment)(credits),
          remainingCredits: (0, import_firestore.increment)(credits),
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastTopupAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastTopupAmount: credits,
          lastPaymentMethod: "stripe"
        }, { merge: true });
        console.log(`[Stripe -> Firestore] Successfully credited +${credits} to users/${uid}`);
      }
    } catch (err) {
      handleServerFirestoreError(err, "Stripe credit sync");
    }
  }
}
app.get("/api/stripe/config", (_req, res) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
  const hasSecretKey = Boolean(process.env.STRIPE_SECRET_KEY);
  res.json({
    success: true,
    publishableKey,
    hasSecretKey,
    isMock: !hasSecretKey
  });
});
app.post("/api/stripe/create-checkout-session", async (req, res) => {
  try {
    const { credits, packageId, uid, userEmail, returnUrl } = req.body;
    const numCredits = Number(credits) || 100;
    const baseReturnUrl = returnUrl || `${req.protocol}://${req.get("host")}`;
    let priceThb = 99;
    if (packageId === "pkg_starter_100" || numCredits === 100) priceThb = 99;
    else if (packageId === "pkg_pro_500" || numCredits === 500) priceThb = 399;
    else if (packageId === "pkg_master_1000" || numCredits === 1e3) priceThb = 699;
    else if (packageId === "pkg_studio_2500" || numCredits === 2500) priceThb = 1499;
    else priceThb = Math.max(20, Math.round(numCredits * 0.8));
    const stripe = getStripe();
    if (stripe) {
      console.log(`[Stripe] Creating checkout session for ${numCredits} credits (${priceThb} THB)...`);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "promptpay"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "thb",
              product_data: {
                name: `\u0E41\u0E1E\u0E47\u0E01\u0E40\u0E01\u0E08\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 Sala AI (${numCredits.toLocaleString()} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15)`,
                description: `\u0E40\u0E15\u0E34\u0E21 ${numCredits.toLocaleString()} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E20\u0E32\u0E1E\u0E41\u0E25\u0E30\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E43\u0E19\u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D`,
                images: ["https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80"]
              },
              unit_amount: priceThb * 100
              // in satang
            },
            quantity: 1
          }
        ],
        client_reference_id: uid || void 0,
        customer_email: userEmail || void 0,
        metadata: {
          uid: uid || "user_sala_001",
          credits: String(numCredits),
          packageId: packageId || "",
          userEmail: userEmail || ""
        },
        success_url: `${baseReturnUrl}/pricing?payment_success=true&session_id={CHECKOUT_SESSION_ID}&credits=${numCredits}`,
        cancel_url: `${baseReturnUrl}/pricing?canceled=true`
      });
      return res.json({
        success: true,
        url: session.url,
        sessionId: session.id,
        isSimulator: false
      });
    }
    const mockSessionId = `sim_cs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    mockCheckoutSessions.set(mockSessionId, {
      sessionId: mockSessionId,
      uid: uid || "user_sala_001",
      credits: numCredits,
      amountThb: priceThb,
      status: "pending",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    console.log(`[Stripe Simulator] Created sandbox checkout session ${mockSessionId} for ${numCredits} credits`);
    return res.json({
      success: true,
      url: `${baseReturnUrl}/pricing?payment_success=true&session_id=${mockSessionId}&credits=${numCredits}&simulated=true`,
      sessionId: mockSessionId,
      isSimulator: true,
      message: "\u0E08\u0E33\u0E25\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E43\u0E19\u0E42\u0E2B\u0E21\u0E14 Sandbox (\u0E23\u0E30\u0E1A\u0E38 STRIPE_SECRET_KEY \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E40\u0E01\u0E15\u0E40\u0E27\u0E22\u0E4C\u0E08\u0E23\u0E34\u0E07)"
    });
  } catch (err) {
    console.error("[Stripe create-checkout-session Error]:", err);
    res.status(500).json({
      success: false,
      error: err.message || "\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E2A\u0E23\u0E49\u0E32\u0E07 Stripe Checkout Session \u0E44\u0E14\u0E49"
    });
  }
});
app.post("/api/stripe/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();
  if (!webhookSecret) {
    console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured on server.");
    return res.status(400).send("Webhook Secret is not configured on the server.");
  }
  if (!sig || !req.rawBody) {
    console.error("[Stripe Webhook] Missing stripe-signature header or raw body.");
    return res.status(400).send("Stripe-Signature header and raw body are required.");
  }
  if (!stripe) {
    console.error("[Stripe Webhook] Stripe client not initialized (STRIPE_SECRET_KEY missing).");
    return res.status(500).send("Stripe client not initialized.");
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Signature Verification Error: ${err.message}`);
  }
  console.log(`[Stripe Webhook] Received verified event: ${event.type} (ID: ${event.id})`);
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data?.object;
    const sessionId = session?.id;
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
    const primaryId = paymentIntentId || sessionId;
    if (session.payment_status !== "paid") {
      console.warn(`[Stripe Webhook] Checkout session ${sessionId} payment_status is "${session.payment_status}" (not "paid"). Skipping credit.`);
      return res.json({ received: true, status: session.payment_status });
    }
    if (isTransactionProcessed(sessionId) || paymentIntentId && isTransactionProcessed(paymentIntentId)) {
      console.log(`[Stripe Webhook] Transaction ${primaryId} already processed. Skipping duplicate credit.`);
      return res.json({ received: true, idempotent: true });
    }
    if (sessionId) markTransactionProcessed(sessionId);
    if (paymentIntentId) markTransactionProcessed(paymentIntentId);
    const uid = session.metadata?.uid || session.client_reference_id || "";
    const credits = Number(session.metadata?.credits) || 0;
    console.log(`[Stripe Webhook] Checkout session ${sessionId} verified paid. Crediting UID: ${uid}, Amount: +${credits}`);
    if (uid && credits > 0) {
      await creditUserInFirestore(uid, credits, `\u0E40\u0E15\u0E34\u0E21\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 Stripe Webhook (${sessionId.slice(0, 10)}...)`, primaryId);
    }
  } else if (event.type === "payment_intent.succeeded") {
    const pi = event.data?.object;
    const piId = pi?.id;
    if (pi.status !== "succeeded") {
      console.warn(`[Stripe Webhook] PaymentIntent ${piId} status is "${pi.status}" (not "succeeded"). Skipping credit.`);
      return res.json({ received: true, status: pi.status });
    }
    if (isTransactionProcessed(piId)) {
      console.log(`[Stripe Webhook] PaymentIntent ${piId} already processed. Skipping duplicate credit.`);
      return res.json({ received: true, idempotent: true });
    }
    markTransactionProcessed(piId);
    const uid = pi.metadata?.uid || "";
    const credits = Number(pi.metadata?.credits) || 0;
    console.log(`[Stripe Webhook] PaymentIntent ${piId} verified succeeded. Crediting UID: ${uid}, Amount: +${credits}`);
    if (uid && credits > 0) {
      await creditUserInFirestore(uid, credits, `\u0E40\u0E15\u0E34\u0E21\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 Stripe PaymentIntent (${piId.slice(0, 10)}...)`, piId);
    }
  } else if (event.type === "payment_intent.payment_failed" || event.type === "checkout.session.expired") {
    console.log(`[Stripe Webhook] Non-successful event ${event.type} received - no credits added.`);
  }
  return res.json({ received: true });
});
app.get("/api/stripe/verify-session", async (req, res) => {
  try {
    const sessionId = String(req.query.sessionId || "").trim();
    if (!sessionId) {
      return res.status(400).json({ success: false, error: "\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E38 sessionId" });
    }
    if (mockCheckoutSessions.has(sessionId)) {
      const mockSession = mockCheckoutSessions.get(sessionId);
      if (isTransactionProcessed(sessionId)) {
        const acc3 = creditAccountsStore.get(mockSession.uid) || currentUserAccount;
        return res.json({
          success: true,
          alreadyProcessed: true,
          creditsAdded: 0,
          remainingCredits: acc3.remainingCredits,
          message: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E19\u0E35\u0E49\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27"
        });
      }
      markTransactionProcessed(sessionId);
      mockSession.status = "completed";
      await creditUserInFirestore(mockSession.uid, mockSession.credits, "\u0E40\u0E15\u0E34\u0E21\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 Stripe (Sandbox Simulator)", sessionId);
      const acc2 = creditAccountsStore.get(mockSession.uid) || currentUserAccount;
      return res.json({
        success: true,
        creditsAdded: mockSession.credits,
        remainingCredits: acc2.remainingCredits,
        message: `\u0E40\u0E15\u0E34\u0E21\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 +${mockSession.credits.toLocaleString()} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27`
      });
    }
    const stripe = getStripe();
    if (!stripe) {
      return res.status(400).json({
        success: false,
        error: "Stripe Secret Key \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A \u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E01\u0E32\u0E23\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E08\u0E23\u0E34\u0E07\u0E44\u0E14\u0E49"
      });
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.json({
        success: false,
        payment_status: session.payment_status,
        message: `\u0E01\u0E32\u0E23\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (\u0E2A\u0E16\u0E32\u0E19\u0E30: ${session.payment_status})`
      });
    }
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
    const primaryId = paymentIntentId || sessionId;
    if (isTransactionProcessed(sessionId) || paymentIntentId && isTransactionProcessed(paymentIntentId)) {
      const uid2 = session.metadata?.uid || session.client_reference_id || "";
      const acc2 = creditAccountsStore.get(uid2) || currentUserAccount;
      return res.json({
        success: true,
        alreadyProcessed: true,
        creditsAdded: 0,
        remainingCredits: acc2.remainingCredits,
        message: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E19\u0E35\u0E49\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27"
      });
    }
    if (sessionId) markTransactionProcessed(sessionId);
    if (paymentIntentId) markTransactionProcessed(paymentIntentId);
    const uid = session.metadata?.uid || session.client_reference_id || "";
    const credits = Number(session.metadata?.credits) || 0;
    if (uid && credits > 0) {
      await creditUserInFirestore(uid, credits, `\u0E40\u0E15\u0E34\u0E21\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 Stripe Checkout (${sessionId.slice(0, 10)}...)`, primaryId);
    }
    const acc = creditAccountsStore.get(uid) || currentUserAccount;
    return res.json({
      success: true,
      creditsAdded: credits,
      remainingCredits: acc.remainingCredits,
      message: `\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E40\u0E15\u0E34\u0E21 +${credits.toLocaleString()} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 \u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27!`
    });
  } catch (err) {
    console.error("[Verify Session Error]:", err);
    res.status(500).json({ success: false, error: err.message || "\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E43\u0E19\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A Session" });
  }
});
app.get("/api/stripe/verify-payment-intent", async (req, res) => {
  try {
    const paymentIntentId = String(req.query.paymentIntentId || "").trim();
    if (!paymentIntentId) {
      return res.status(400).json({ success: false, error: "\u0E15\u0E49\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E38 paymentIntentId" });
    }
    const stripe = getStripe();
    if (!stripe) {
      return res.status(400).json({
        success: false,
        error: "Stripe Secret Key \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E01\u0E33\u0E2B\u0E19\u0E14\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A \u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A\u0E01\u0E32\u0E23\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E08\u0E23\u0E34\u0E07\u0E44\u0E14\u0E49"
      });
    }
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== "succeeded") {
      return res.json({
        success: false,
        status: pi.status,
        message: `\u0E01\u0E32\u0E23\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (\u0E2A\u0E16\u0E32\u0E19\u0E30: ${pi.status})`
      });
    }
    if (isTransactionProcessed(paymentIntentId)) {
      const uid2 = pi.metadata?.uid || "";
      const acc2 = creditAccountsStore.get(uid2) || currentUserAccount;
      return res.json({
        success: true,
        alreadyProcessed: true,
        creditsAdded: 0,
        remainingCredits: acc2.remainingCredits,
        message: "\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E19\u0E35\u0E49\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27"
      });
    }
    markTransactionProcessed(paymentIntentId);
    const uid = pi.metadata?.uid || "";
    const credits = Number(pi.metadata?.credits) || 0;
    if (uid && credits > 0) {
      await creditUserInFirestore(uid, credits, `\u0E40\u0E15\u0E34\u0E21\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 Stripe PaymentIntent (${paymentIntentId.slice(0, 10)}...)`, paymentIntentId);
    }
    const acc = creditAccountsStore.get(uid) || currentUserAccount;
    return res.json({
      success: true,
      creditsAdded: credits,
      remainingCredits: acc.remainingCredits,
      message: `\u0E0A\u0E33\u0E23\u0E30\u0E40\u0E07\u0E34\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E40\u0E15\u0E34\u0E21 +${credits.toLocaleString()} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 \u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E02\u0E2D\u0E07\u0E04\u0E38\u0E13\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27!`
    });
  } catch (err) {
    console.error("[Verify PaymentIntent Error]:", err);
    res.status(500).json({ success: false, error: err.message || "\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14\u0E43\u0E19\u0E01\u0E32\u0E23\u0E15\u0E23\u0E27\u0E08\u0E2A\u0E2D\u0E1A PaymentIntent" });
  }
});
app.get("/api/admin/stats", requireAdmin, (req, res) => {
  const allJobs = Array.from(jobsStore.values());
  let creditsSpentTotal = 0;
  for (const acc of creditAccountsStore.values()) {
    creditsSpentTotal += acc.totalUsedCredits;
  }
  const allAccounts = Array.from(creditAccountsStore.values());
  const stats = {
    totalUsers: usersStore.size,
    totalGenerations: allJobs.length,
    totalImagesGenerated: allJobs.filter((j) => j.type === "image").length,
    totalVideosGenerated: allJobs.filter((j) => j.type === "video").length,
    activeJobsCount: allJobs.filter((j) => j.status === "processing" || j.status === "queued").length,
    creditsSpentTotal: creditsSpentTotal + 3480,
    providersStatus: [
      {
        id: "gemini",
        name: "Google Gemini / Veo",
        hasKey: Boolean(process.env.GEMINI_API_KEY),
        isMock: !Boolean(process.env.GEMINI_API_KEY),
        statusText: Boolean(process.env.GEMINI_API_KEY) ? "\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 (Server API Key Detected)" : "\u0E42\u0E2B\u0E21\u0E14\u0E08\u0E33\u0E25\u0E2D\u0E07 (No GEMINI_API_KEY in env)",
        activeCalls: allJobs.filter((j) => j.provider === "gemini" && j.status === "processing").length
      },
      {
        id: "meta",
        name: "Meta Llama / Emu",
        hasKey: Boolean(process.env.META_API_KEY),
        isMock: !Boolean(process.env.META_API_KEY),
        statusText: Boolean(process.env.META_API_KEY) ? "\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 (Meta Key Active)" : "\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07 Adapter \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 (Mock Sandbox Mode)",
        activeCalls: allJobs.filter((j) => j.provider === "meta" && j.status === "processing").length
      },
      {
        id: "xai",
        name: "xAI / Grok Vision",
        hasKey: Boolean(process.env.XAI_API_KEY),
        isMock: !Boolean(process.env.XAI_API_KEY),
        statusText: Boolean(process.env.XAI_API_KEY) ? "\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 (xAI Key Active)" : "\u0E42\u0E04\u0E23\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07 Adapter \u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19 (Mock Sandbox Mode)",
        activeCalls: allJobs.filter((j) => j.provider === "xai" && j.status === "processing").length
      },
      {
        id: "mock",
        name: "\u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D Simulator",
        hasKey: true,
        isMock: true,
        statusText: "\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E21\u0E2D (Local Mock Generator)",
        activeCalls: allJobs.filter((j) => j.provider === "mock" && j.status === "processing").length
      }
    ],
    recentJobs: allJobs.slice(0, 10),
    userAccounts: allAccounts
  };
  res.json({ success: true, stats });
});
app.post("/api/admin/grant-credits", requireAdmin, (req, res) => {
  const { userId, amount } = req.body;
  const num = Number(amount) || 50;
  const targetId = userId || "user_sala_001";
  let targetAccount = creditAccountsStore.get(targetId);
  if (!targetAccount) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15" });
  }
  targetAccount.remainingCredits += num;
  targetAccount.transactions.unshift({
    id: `tx_admin_${Date.now()}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    amount: num,
    type: "bonus",
    description: `\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E21\u0E2D\u0E1A\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E1E\u0E34\u0E40\u0E28\u0E29 (+${num} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15)`,
    balanceAfter: targetAccount.remainingCredits
  });
  res.json({ success: true, remainingCredits: targetAccount.remainingCredits, message: `\u0E40\u0E1E\u0E34\u0E48\u0E21 ${num} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27` });
});
app.post("/api/admin/reset-limits", requireAdmin, (req, res) => {
  const { userId } = req.body;
  if (userId && creditAccountsStore.has(userId)) {
    const acc = creditAccountsStore.get(userId);
    acc.dailyUsedCredits = 0;
  } else {
    for (const acc of creditAccountsStore.values()) {
      acc.dailyUsedCredits = 0;
    }
  }
  res.json({ success: true, message: "\u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15\u0E22\u0E2D\u0E14\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E1B\u0E23\u0E30\u0E08\u0E33\u0E27\u0E31\u0E19 (Daily Limit) \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27" });
});
app.post("/api/auth/register", (req, res) => {
  const { firstName, lastName, username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E2B\u0E49\u0E04\u0E23\u0E1A\u0E16\u0E49\u0E27\u0E19 (\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49 \u0E2D\u0E35\u0E40\u0E21\u0E25 \u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19)" });
  }
  const existingUsername = Array.from(usersStore.values()).find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (existingUsername) {
    return res.status(400).json({ success: false, message: "\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E19\u0E35\u0E49\u0E16\u0E39\u0E01\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E41\u0E25\u0E49\u0E27 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E2D\u0E37\u0E48\u0E19" });
  }
  const existingEmail = Array.from(usersStore.values()).find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existingEmail) {
    return res.status(400).json({ success: false, message: "\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E19\u0E35\u0E49\u0E16\u0E39\u0E01\u0E25\u0E07\u0E17\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E19\u0E41\u0E25\u0E49\u0E27 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E43\u0E0A\u0E49\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E2D\u0E37\u0E48\u0E19\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A" });
  }
  const { salt, hash } = hashPassword(password);
  const newUserId = `user_${Date.now()}`;
  const devOtp = "123456";
  const newUser = {
    id: newUserId,
    firstName: firstName || "",
    lastName: lastName || "",
    username,
    email,
    passwordHash: hash,
    salt,
    role: "user",
    status: "active",
    isVerified: false,
    verificationCode: devOtp,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    lastLogin: (/* @__PURE__ */ new Date()).toISOString()
  };
  usersStore.set(newUserId, newUser);
  const newAccount = {
    userId: newUserId,
    userName: `${firstName || username} (\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01)`,
    userRole: "user",
    remainingCredits: 100,
    totalUsedCredits: 0,
    dailyUsedCredits: 0,
    dailyLimit: 100,
    monthlyUsedCredits: 0,
    monthlyLimit: 1e3,
    perGenerationLimit: 30,
    transactions: [
      {
        id: `tx_welcome_${Date.now()}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        amount: 100,
        type: "bonus",
        description: "\u0E42\u0E1A\u0E19\u0E31\u0E2A\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E43\u0E2B\u0E21\u0E48\u0E1F\u0E23\u0E35 100 Sala AI Credits!",
        balanceAfter: 100
      }
    ]
  };
  creditAccountsStore.set(newUserId, newAccount);
  const token = createSessionToken(newUserId, SESSION_SECRET);
  sessionsStore.set(token, newUserId);
  res.json({
    success: true,
    token,
    user: {
      id: newUser.id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      isVerified: newUser.isVerified,
      createdAt: newUser.createdAt
    },
    account: newAccount,
    devOtpCode: devOtp,
    message: "\u0E2A\u0E21\u0E31\u0E04\u0E23\u0E2A\u0E21\u0E32\u0E0A\u0E34\u0E01\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08! (\u0E42\u0E2B\u0E21\u0E14\u0E1E\u0E31\u0E12\u0E19\u0E32: \u0E23\u0E2B\u0E31\u0E2A OTP \u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E04\u0E37\u0E2D 123456)"
  });
});
app.post("/api/auth/login", (req, res) => {
  const { usernameOrEmail, password } = req.body;
  if (!usernameOrEmail || !password) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49/\u0E2D\u0E35\u0E40\u0E21\u0E25 \u0E41\u0E25\u0E30\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19" });
  }
  const query = usernameOrEmail.toLowerCase().trim();
  const user = Array.from(usersStore.values()).find(
    (u) => u.username.toLowerCase() === query || u.email.toLowerCase() === query
  );
  if (!user) {
    return res.status(401).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E19\u0E35\u0E49 \u0E2B\u0E23\u0E37\u0E2D\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  if (user.status === "suspended") {
    return res.status(403).json({ success: false, message: "\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E19\u0E35\u0E49\u0E16\u0E39\u0E01\u0E23\u0E30\u0E07\u0E31\u0E1A\u0E01\u0E32\u0E23\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E0A\u0E31\u0E48\u0E27\u0E04\u0E23\u0E32\u0E27 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E34\u0E14\u0E15\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E14\u0E39\u0E41\u0E25\u0E23\u0E30\u0E1A\u0E1A" });
  }
  const isValid = verifyPassword(password, user.salt, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  user.lastLogin = (/* @__PURE__ */ new Date()).toISOString();
  const token = createSessionToken(user.id, SESSION_SECRET);
  sessionsStore.set(token, user.id);
  let account = creditAccountsStore.get(user.id);
  if (!account) {
    account = currentUserAccount;
  }
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    },
    account,
    message: `\u0E22\u0E34\u0E19\u0E14\u0E35\u0E15\u0E49\u0E2D\u0E19\u0E23\u0E31\u0E1A\u0E01\u0E25\u0E31\u0E1A, ${user.firstName || user.username}!`
  });
});
app.post("/api/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    sessionsStore.delete(token);
    const session = verifySessionToken(token, SESSION_SECRET);
    if (session) revokedSessionTokens.set(token, session.exp);
    verifiedFirebaseTokens.delete(token);
  }
  res.json({ success: true, message: "\u0E2D\u0E2D\u0E01\u0E08\u0E32\u0E01\u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27" });
});
app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = req.user;
  const account = req.creditAccount;
  res.json({
    success: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    },
    account
  });
});
app.post("/api/auth/verify-email", (req, res) => {
  const { email, otpCode } = req.body;
  const user = Array.from(usersStore.values()).find((u) => u.email.toLowerCase() === (email || "").toLowerCase());
  if (!user) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A" });
  }
  if (otpCode === user.verificationCode || otpCode === "123456") {
    user.isVerified = true;
    return res.json({ success: true, message: "\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27!" });
  }
  res.status(400).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A OTP \u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07 \u0E01\u0E23\u0E38\u0E13\u0E32\u0E25\u0E2D\u0E07\u0E43\u0E2B\u0E21\u0E48\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07 (\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E14\u0E49\u0E27\u0E22 123456)" });
});
app.post("/api/auth/resend-otp", (req, res) => {
  const { email } = req.body;
  const user = Array.from(usersStore.values()).find((u) => u.email.toLowerCase() === (email || "").toLowerCase());
  if (!user) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A" });
  }
  const newOtp = "123456";
  user.verificationCode = newOtp;
  res.json({
    success: true,
    devOtpCode: newOtp,
    message: "\u0E2A\u0E48\u0E07\u0E23\u0E2B\u0E31\u0E2A OTP \u0E43\u0E2B\u0E21\u0E48\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27 (\u0E42\u0E2B\u0E21\u0E14\u0E1E\u0E31\u0E12\u0E19\u0E32: \u0E23\u0E2B\u0E31\u0E2A\u0E04\u0E37\u0E2D 123456)"
  });
});
app.post("/api/auth/forgot-password", (req, res) => {
  const { email } = req.body;
  const user = Array.from(usersStore.values()).find((u) => u.email.toLowerCase() === (email || "").toLowerCase());
  if (!user) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E19\u0E35\u0E49\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A" });
  }
  const resetCode = "123456";
  user.verificationCode = resetCode;
  res.json({
    success: true,
    devOtpCode: resetCode,
    message: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E23\u0E2B\u0E31\u0E2A\u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27 (\u0E42\u0E2B\u0E21\u0E14\u0E1E\u0E31\u0E12\u0E19\u0E32: \u0E23\u0E2B\u0E31\u0E2A\u0E04\u0E37\u0E2D 123456)"
  });
});
app.post("/api/auth/reset-password", (req, res) => {
  const { email, code, newPassword } = req.body;
  const user = Array.from(usersStore.values()).find((u) => u.email.toLowerCase() === (email || "").toLowerCase());
  if (!user) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2D\u0E35\u0E40\u0E21\u0E25\u0E19\u0E35\u0E49\u0E43\u0E19\u0E23\u0E30\u0E1A\u0E1A" });
  }
  if (code !== user.verificationCode && code !== "123456") {
    return res.status(400).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  const { salt, hash } = hashPassword(newPassword);
  user.passwordHash = hash;
  user.salt = salt;
  res.json({ success: true, message: "\u0E23\u0E35\u0E40\u0E0B\u0E47\u0E15\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22 \u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E14\u0E49\u0E27\u0E22\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19\u0E43\u0E2B\u0E21\u0E48\u0E44\u0E14\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35" });
});
app.get("/api/admin/users", requireAdmin, (req, res) => {
  const usersList = Array.from(usersStore.values()).map((u) => {
    const acc = creditAccountsStore.get(u.id);
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      isVerified: u.isVerified,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
      remainingCredits: acc ? acc.remainingCredits : 0,
      totalUsedCredits: acc ? acc.totalUsedCredits : 0
    };
  });
  res.json({ success: true, users: usersList });
});
app.post("/api/admin/users", requireAdmin, (req, res) => {
  const { firstName, lastName, username, email, password, role, initialCredits } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49 \u0E2D\u0E35\u0E40\u0E21\u0E25 \u0E41\u0E25\u0E30\u0E23\u0E2B\u0E31\u0E2A\u0E1C\u0E48\u0E32\u0E19" });
  }
  const { salt, hash } = hashPassword(password);
  const newUserId = `user_${Date.now()}`;
  const newUser = {
    id: newUserId,
    firstName: firstName || "",
    lastName: lastName || "",
    username,
    email,
    passwordHash: hash,
    salt,
    role: role === "admin" ? "admin" : "user",
    status: "active",
    isVerified: true,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    lastLogin: void 0
  };
  usersStore.set(newUserId, newUser);
  const creds = Number(initialCredits) || 100;
  const newAccount = {
    userId: newUserId,
    userName: `${firstName || username} (\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E43\u0E2B\u0E21\u0E48\u0E42\u0E14\u0E22 Admin)`,
    userRole: newUser.role,
    remainingCredits: creds,
    totalUsedCredits: 0,
    dailyUsedCredits: 0,
    dailyLimit: 200,
    monthlyUsedCredits: 0,
    monthlyLimit: 2e3,
    perGenerationLimit: 50,
    transactions: [
      {
        id: `tx_admin_created_${Date.now()}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        amount: creds,
        type: "bonus",
        description: `\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1E\u0E23\u0E49\u0E2D\u0E21\u0E21\u0E2D\u0E1A\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19 ${creds} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15`,
        balanceAfter: creds
      }
    ]
  };
  creditAccountsStore.set(newUserId, newAccount);
  res.json({ success: true, user: newUser, account: newAccount, message: "\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E43\u0E2B\u0E21\u0E48\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08" });
});
app.post("/api/admin/adjust-credits", requireAdmin, (req, res) => {
  const { userId, amount, reason } = req.body;
  const num = Number(amount);
  if (!userId || isNaN(num) || num === 0) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E41\u0E25\u0E30\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E17\u0E35\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  let account = creditAccountsStore.get(userId);
  if (!account && userId === "user_sala_001") {
    account = currentUserAccount;
  }
  if (!account) {
    account = {
      userId,
      userName: `\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49 (${userId.slice(0, 8)})`,
      userRole: "user",
      remainingCredits: 500,
      totalUsedCredits: 0,
      dailyUsedCredits: 0,
      dailyLimit: 250,
      monthlyUsedCredits: 0,
      monthlyLimit: 2e3,
      perGenerationLimit: 50,
      transactions: []
    };
    creditAccountsStore.set(userId, account);
  }
  account.remainingCredits += num;
  if (account.remainingCredits < 0) account.remainingCredits = 0;
  const txType = num > 0 ? "topup" : "usage";
  account.transactions.unshift({
    id: `tx_adjust_${Date.now()}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    amount: num,
    type: txType,
    description: `\u0E41\u0E2D\u0E14\u0E21\u0E34\u0E19\u0E1B\u0E23\u0E31\u0E1A\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 (${num > 0 ? `+${num}` : num}): ${reason || "\u0E01\u0E32\u0E23\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23\u0E23\u0E30\u0E1A\u0E1A"}`,
    balanceAfter: account.remainingCredits
  });
  if (!isServerQuotaExhausted()) {
    try {
      const db = getServerFirestore();
      if (db && userId) {
        const userRef = (0, import_firestore.doc)(db, "users", userId);
        (0, import_firestore.setDoc)(userRef, {
          credits: account.remainingCredits,
          remainingCredits: account.remainingCredits,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastTopupAt: (/* @__PURE__ */ new Date()).toISOString(),
          lastTopupAmount: num
        }, { merge: true }).catch((err) => {
          handleServerFirestoreError(err, "Admin adjust-credits async sync");
        });
      }
    } catch (err) {
      handleServerFirestoreError(err, "Admin adjust-credits init");
    }
  }
  res.json({
    success: true,
    remainingCredits: account.remainingCredits,
    message: `\u0E1B\u0E23\u0E31\u0E1A\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (${num > 0 ? `+${num}` : num} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15) \u0E04\u0E07\u0E40\u0E2B\u0E25\u0E37\u0E2D ${account.remainingCredits}`
  });
});
app.post("/api/admin/toggle-user-status", requireAdmin, (req, res) => {
  const { userId } = req.body;
  const user = usersStore.get(userId);
  if (!user) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49" });
  }
  user.status = user.status === "active" ? "suspended" : "active";
  res.json({
    success: true,
    status: user.status,
    message: user.status === "active" ? "\u0E40\u0E1B\u0E34\u0E14\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" : "\u0E23\u0E30\u0E07\u0E31\u0E1A\u0E1A\u0E31\u0E0D\u0E0A\u0E35\u0E1C\u0E39\u0E49\u0E43\u0E0A\u0E49\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22"
  });
});
app.get("/api/admin/pricing-config", requireAdmin, (req, res) => {
  res.json({ success: true, config: pricingConfig });
});
app.post("/api/admin/pricing-config", requireAdmin, (req, res) => {
  const { copyPromptFee, serviceFeeType, serviceFeeValue } = req.body;
  if (copyPromptFee !== void 0) pricingConfig.copyPromptFee = Number(copyPromptFee);
  if (serviceFeeType === "fixed" || serviceFeeType === "percentage") pricingConfig.serviceFeeType = serviceFeeType;
  if (serviceFeeValue !== void 0) pricingConfig.serviceFeeValue = Number(serviceFeeValue);
  res.json({ success: true, config: pricingConfig, message: "\u0E2D\u0E31\u0E1B\u0E40\u0E14\u0E15\u0E2D\u0E31\u0E15\u0E23\u0E32\u0E04\u0E48\u0E32\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23\u0E41\u0E25\u0E30\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22" });
});
app.get("/api/admin/redeem-codes", requireAdmin, (req, res) => {
  const list = Array.from(redeemCodesStore.values());
  res.json({ success: true, codes: list });
});
app.post("/api/admin/redeem-codes", requireAdmin, (req, res) => {
  const { code, maxUses, expiresAt } = req.body;
  const creditAmount = req.body.creditAmount || req.body.credits;
  if (!code || !creditAmount) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E23\u0E2B\u0E31\u0E2A\u0E42\u0E04\u0E49\u0E14\u0E41\u0E25\u0E30\u0E08\u0E33\u0E19\u0E27\u0E19\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15" });
  }
  const cleanCode = code.trim().toUpperCase();
  const newRedeem = {
    id: `code_${Date.now()}`,
    code: cleanCode,
    creditAmount: Number(creditAmount),
    maxUses: Number(maxUses) || 100,
    usedCount: 0,
    isExpired: false,
    expiresAt,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    createdBy: "admin"
  };
  redeemCodesStore.set(cleanCode, newRedeem);
  res.json({ success: true, code: newRedeem, message: `\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E42\u0E04\u0E49\u0E14 ${cleanCode} \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 (+${creditAmount} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15)` });
});
app.delete("/api/admin/redeem-codes/:id", requireAdmin, (req, res) => {
  const targetId = req.params.id;
  for (const [key, val] of redeemCodesStore.entries()) {
    if (val.id === targetId || val.code === targetId) {
      redeemCodesStore.delete(key);
      return res.json({ success: true, message: "\u0E25\u0E1A\u0E42\u0E04\u0E49\u0E14\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27" });
    }
  }
  res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E42\u0E04\u0E49\u0E14\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E25\u0E1A" });
});
app.post("/api/redeem-code", (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E23\u0E2B\u0E31\u0E2A Redeem Code" });
  }
  const cleanCode = code.trim().toUpperCase();
  const redeem = redeemCodesStore.get(cleanCode);
  if (!redeem) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E23\u0E2B\u0E31\u0E2A Redeem Code \u0E19\u0E35\u0E49 \u0E2B\u0E23\u0E37\u0E2D\u0E42\u0E04\u0E49\u0E14\u0E44\u0E21\u0E48\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07" });
  }
  if (redeem.isExpired) {
    return res.status(400).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A Redeem Code \u0E19\u0E35\u0E49\u0E2B\u0E21\u0E14\u0E2D\u0E32\u0E22\u0E38\u0E41\u0E25\u0E49\u0E27" });
  }
  if (redeem.usedCount >= redeem.maxUses) {
    return res.status(400).json({ success: false, message: "\u0E23\u0E2B\u0E31\u0E2A Redeem Code \u0E19\u0E35\u0E49\u0E16\u0E39\u0E01\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E04\u0E23\u0E1A\u0E15\u0E32\u0E21\u0E2A\u0E34\u0E17\u0E18\u0E34\u0E4C\u0E41\u0E25\u0E49\u0E27" });
  }
  redeem.usedCount += 1;
  currentUserAccount.remainingCredits += redeem.creditAmount;
  currentUserAccount.transactions.unshift({
    id: `tx_redeem_${Date.now()}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    amount: redeem.creditAmount,
    type: "bonus",
    description: `\u0E41\u0E25\u0E01\u0E23\u0E2B\u0E31\u0E2A\u0E42\u0E1B\u0E23\u0E42\u0E21\u0E0A\u0E31\u0E48\u0E19 (${cleanCode}): \u0E23\u0E31\u0E1A\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E1F\u0E23\u0E35 +${redeem.creditAmount} Sala AI Credits`,
    balanceAfter: currentUserAccount.remainingCredits
  });
  res.json({
    success: true,
    addedCredits: redeem.creditAmount,
    remainingCredits: currentUserAccount.remainingCredits,
    message: `\u0E22\u0E34\u0E19\u0E14\u0E35\u0E14\u0E49\u0E27\u0E22! \u0E04\u0E38\u0E13\u0E44\u0E14\u0E49\u0E23\u0E31\u0E1A +${redeem.creditAmount} Sala AI Credits \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27`
  });
});
app.post("/api/director/continuity-check", (req, res) => {
  const { scriptText, clips, dialogues } = req.body || {};
  const masterLock = req.body && typeof req.body.continuityLock === "object" && req.body.continuityLock || {};
  const clipLocks = Array.isArray(clips) ? clips.map((c) => c?.continuityLock).filter(Boolean) : [];
  const mostFrequent = (values) => {
    const counts = /* @__PURE__ */ new Map();
    values.filter((v) => typeof v === "string" && v.trim()).forEach((v) => counts.set(v.trim(), (counts.get(v.trim()) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  };
  const continuityLock = { ...masterLock };
  if (!continuityLock.characterName || !String(continuityLock.characterName).trim()) {
    continuityLock.characterName = mostFrequent(clipLocks.map((l) => l.characterName));
  }
  if (!continuityLock.timeOfDay) continuityLock.timeOfDay = mostFrequent(clipLocks.map((l) => l.timeOfDay));
  if (!continuityLock.location) continuityLock.location = mostFrequent(clipLocks.map((l) => l.location));
  const issues = [];
  const passedChecks = [];
  if (continuityLock?.characterName && isReservedSystemKeyword(continuityLock.characterName)) {
    issues.push({
      id: "issue_char_reserved",
      clipNumber: 1,
      type: "character",
      severity: "error",
      title: `\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E04\u0E33\u0E2A\u0E07\u0E27\u0E19\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E1A (${continuityLock.characterName})`,
      description: "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E23\u0E30\u0E1A\u0E1A \u0E40\u0E0A\u0E48\u0E19 LOCK, CONT, FRAME, AUTO, RULE, NO, OUT, STORY, CHARACTERS, END, SALA_MULTI_CLIP \u0E2B\u0E49\u0E32\u0E21\u0E43\u0E0A\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23",
      suggestion: "\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E43\u0E19\u0E41\u0E1C\u0E07 Master Continuity Lock"
    });
  } else if (!continuityLock?.characterName || continuityLock.characterName.trim().length < 2) {
    issues.push({
      id: "issue_char_name",
      clipNumber: 1,
      type: "character",
      severity: "error",
      title: "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E2B\u0E25\u0E31\u0E01 (Character Lock Missing)",
      description: "\u0E23\u0E30\u0E1A\u0E1A\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E17\u0E35\u0E48\u0E41\u0E19\u0E48\u0E19\u0E2D\u0E19\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E22\u0E36\u0E14\u0E40\u0E2B\u0E19\u0E35\u0E48\u0E22\u0E27\u0E43\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E41\u0E25\u0E30\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E41\u0E15\u0E48\u0E07\u0E01\u0E32\u0E22\u0E43\u0E19\u0E17\u0E38\u0E01\u0E04\u0E25\u0E34\u0E1B",
      suggestion: "\u0E44\u0E1B\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E41\u0E25\u0E30\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E43\u0E19\u0E41\u0E1C\u0E07 Master Continuity Lock \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E08\u0E32\u0E01\u0E04\u0E25\u0E31\u0E07"
    });
  } else {
    passedChecks.push(`Character Anchor Locked: ${continuityLock.characterName}`);
  }
  const bigrams = (t) => {
    const clean2 = t.replace(/\s+/g, "");
    const set = /* @__PURE__ */ new Set();
    for (let k = 0; k < clean2.length - 1; k++) set.add(clean2.slice(k, k + 2));
    return set;
  };
  const handoffSimilarity = (a, b) => {
    if (!a || !b) return 0;
    if (a.includes(b) || b.includes(a)) return 1;
    const A = bigrams(a);
    const B = bigrams(b);
    if (A.size === 0 || B.size === 0) return 0;
    let inter = 0;
    A.forEach((x) => {
      if (B.has(x)) inter++;
    });
    return inter / Math.min(A.size, B.size);
  };
  if (Array.isArray(clips) && clips.length > 1) {
    let momentumPassed = true;
    for (let i = 1; i < clips.length; i++) {
      const prevEnd = (clips[i - 1].endAction || "").trim();
      const currStart = (clips[i].startAction || "").trim();
      if (prevEnd && currStart && handoffSimilarity(prevEnd, currStart) < 0.3) {
        momentumPassed = false;
        issues.push({
          id: `issue_momentum_mismatch_${i}`,
          clipNumber: i + 1,
          type: "event_order",
          severity: "warning",
          title: `\u0E08\u0E38\u0E14\u0E40\u0E23\u0E34\u0E48\u0E21\u0E04\u0E25\u0E34\u0E1B\u0E17\u0E35\u0E48 ${i + 1} \u0E44\u0E21\u0E48\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E08\u0E38\u0E14\u0E08\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E17\u0E35\u0E48 ${i}`,
          description: `\u0E08\u0E1A\u0E04\u0E25\u0E34\u0E1B ${i}: "${prevEnd.slice(0, 80)}" / \u0E40\u0E23\u0E34\u0E48\u0E21\u0E04\u0E25\u0E34\u0E1B ${i + 1}: "${currStart.slice(0, 80)}"`,
          suggestion: "\u0E43\u0E2B\u0E49 startAction \u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E19\u0E35\u0E49\u0E40\u0E23\u0E34\u0E48\u0E21\u0E08\u0E32\u0E01\u0E17\u0E48\u0E32\u0E17\u0E32\u0E07/\u0E15\u0E33\u0E41\u0E2B\u0E19\u0E48\u0E07\u0E40\u0E14\u0E35\u0E22\u0E27\u0E01\u0E31\u0E1A endAction \u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32"
        });
        continue;
      }
      if (!prevEnd || !currStart) {
        momentumPassed = false;
        issues.push({
          id: `issue_momentum_${i}`,
          clipNumber: i + 1,
          type: "event_order",
          severity: "warning",
          title: `\u0E23\u0E2D\u0E22\u0E15\u0E48\u0E2D\u0E42\u0E21\u0E40\u0E21\u0E19\u0E15\u0E31\u0E21\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E17\u0E35\u0E48 ${i} \u0E41\u0E25\u0E30 ${i + 1} \u0E2D\u0E32\u0E08\u0E02\u0E32\u0E14\u0E15\u0E2D\u0E19`,
          description: `\u0E08\u0E38\u0E14\u0E08\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E17\u0E35\u0E48 ${i} \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E2A\u0E48\u0E07\u0E15\u0E48\u0E2D\u0E01\u0E32\u0E23\u0E01\u0E23\u0E30\u0E17\u0E33\u0E44\u0E1B\u0E22\u0E31\u0E07\u0E08\u0E38\u0E14\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E17\u0E35\u0E48 ${i + 1} \u0E2D\u0E22\u0E48\u0E32\u0E07\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19`,
          suggestion: "\u0E23\u0E30\u0E1A\u0E38\u0E01\u0E32\u0E23\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27\u0E2B\u0E23\u0E37\u0E2D\u0E17\u0E34\u0E28\u0E17\u0E32\u0E07\u0E02\u0E2D\u0E07\u0E21\u0E38\u0E21\u0E01\u0E25\u0E49\u0E2D\u0E07\u0E43\u0E19\u0E15\u0E2D\u0E19\u0E08\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B\u0E01\u0E48\u0E2D\u0E19\u0E2B\u0E19\u0E49\u0E32 \u0E43\u0E2B\u0E49\u0E2A\u0E2D\u0E14\u0E04\u0E25\u0E49\u0E2D\u0E07\u0E01\u0E31\u0E1A\u0E08\u0E38\u0E14\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19"
        });
      }
    }
    if (momentumPassed) {
      passedChecks.push("Action Momentum Chain: \u0E08\u0E38\u0E14\u0E08\u0E1A\u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B N \u0E2A\u0E48\u0E07\u0E15\u0E48\u0E2D\u0E42\u0E21\u0E40\u0E21\u0E19\u0E15\u0E31\u0E21\u0E44\u0E1B\u0E22\u0E31\u0E07\u0E08\u0E38\u0E14\u0E40\u0E23\u0E34\u0E48\u0E21\u0E15\u0E49\u0E19\u0E02\u0E2D\u0E07\u0E04\u0E25\u0E34\u0E1B N+1 \u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C");
    }
  }
  if (Array.isArray(dialogues) && dialogues.length > 0) {
    const reservedSpeakers = dialogues.filter((d) => d.speaker && isReservedSystemKeyword(d.speaker));
    if (reservedSpeakers.length > 0) {
      issues.push({
        id: "issue_dialogue_reserved_speaker",
        clipNumber: 1,
        type: "dialogue",
        severity: "error",
        title: `\u0E1E\u0E1A\u0E04\u0E33\u0E2A\u0E07\u0E27\u0E19\u0E02\u0E2D\u0E07\u0E23\u0E30\u0E1A\u0E1A\u0E16\u0E39\u0E01\u0E43\u0E0A\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14 (${reservedSpeakers.map((d) => d.speaker).join(", ")})`,
        description: "\u0E04\u0E33\u0E2A\u0E31\u0E48\u0E07\u0E23\u0E30\u0E1A\u0E1A \u0E40\u0E0A\u0E48\u0E19 LOCK, CONT, FRAME, AUTO, RULE, NO, OUT, STORY, CHARACTERS, END, SALA_MULTI_CLIP \u0E2B\u0E49\u0E32\u0E21\u0E43\u0E0A\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14",
        suggestion: "\u0E41\u0E01\u0E49\u0E44\u0E02\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14\u0E43\u0E2B\u0E49\u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E08\u0E23\u0E34\u0E07"
      });
    }
    const unassigned = dialogues.filter((d) => !d.speaker || !d.line);
    if (unassigned.length > 0) {
      issues.push({
        id: "issue_dialogue_speaker",
        clipNumber: 1,
        type: "dialogue",
        severity: "warning",
        title: "\u0E1E\u0E1A\u0E1A\u0E17\u0E1E\u0E39\u0E14\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14\u0E0A\u0E31\u0E14\u0E40\u0E08\u0E19",
        description: "\u0E21\u0E35\u0E1A\u0E17\u0E1E\u0E39\u0E14\u0E17\u0E35\u0E48\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1C\u0E39\u0E01\u0E01\u0E31\u0E1A\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23 \u0E2D\u0E32\u0E08\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E42\u0E21\u0E40\u0E14\u0E25\u0E2A\u0E25\u0E31\u0E1A\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14\u0E44\u0E14\u0E49",
        suggestion: "\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14\u0E43\u0E2B\u0E49\u0E15\u0E23\u0E07\u0E01\u0E31\u0E1A\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E43\u0E19\u0E09\u0E32\u0E01"
      });
    } else if (reservedSpeakers.length === 0) {
      passedChecks.push(`Dialogue Lock: \u0E25\u0E47\u0E2D\u0E04\u0E1A\u0E17\u0E1E\u0E39\u0E14\u0E41\u0E25\u0E30\u0E1C\u0E39\u0E49\u0E1E\u0E39\u0E14\u0E15\u0E23\u0E07\u0E15\u0E31\u0E27 ${dialogues.length} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23 (\u0E44\u0E21\u0E48\u0E2A\u0E25\u0E31\u0E1A\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23)`);
    }
  }
  if (!continuityLock?.timeOfDay || !continuityLock?.lighting) {
    issues.push({
      id: "issue_lighting",
      clipNumber: 1,
      type: "lighting",
      severity: "info",
      title: "\u0E17\u0E34\u0E28\u0E17\u0E32\u0E07\u0E41\u0E2A\u0E07\u0E41\u0E25\u0E30\u0E0A\u0E48\u0E27\u0E07\u0E40\u0E27\u0E25\u0E32\u0E02\u0E2D\u0E07\u0E27\u0E31\u0E19\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E25\u0E47\u0E2D\u0E04\u0E41\u0E1A\u0E1A\u0E40\u0E08\u0E32\u0E30\u0E08\u0E07",
      description: "\u0E2B\u0E32\u0E01\u0E44\u0E21\u0E48\u0E23\u0E30\u0E1A\u0E38\u0E17\u0E34\u0E28\u0E17\u0E32\u0E07\u0E41\u0E2A\u0E07 \u0E2D\u0E32\u0E08\u0E17\u0E33\u0E43\u0E2B\u0E49\u0E41\u0E2A\u0E07\u0E41\u0E14\u0E14\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E17\u0E34\u0E28\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E04\u0E25\u0E34\u0E1B",
      suggestion: "\u0E41\u0E19\u0E30\u0E19\u0E33\u0E43\u0E2B\u0E49\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E40\u0E27\u0E25\u0E32 \u0E40\u0E0A\u0E48\u0E19 \u0E40\u0E0A\u0E49\u0E32\u0E15\u0E23\u0E39\u0E48 (Golden Hour) \u0E2B\u0E23\u0E37\u0E2D \u0E1A\u0E48\u0E32\u0E22 \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E04\u0E27\u0E32\u0E21\u0E2A\u0E21\u0E48\u0E33\u0E40\u0E2A\u0E21\u0E2D"
    });
  } else {
    passedChecks.push(`Lighting & Time Lock: ${continuityLock.timeOfDay} (${continuityLock.lighting})`);
  }
  passedChecks.push(`Framing Lock: \u0E2D\u0E31\u0E15\u0E23\u0E32\u0E2A\u0E48\u0E27\u0E19 ${continuityLock?.aspectRatio || "16:9"} \u0E04\u0E27\u0E32\u0E21\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14 ${continuityLock?.resolution || "1080p"}`);
  res.json({
    success: true,
    report: {
      hasConflicts: issues.some((i) => i.severity === "error"),
      totalIssues: issues.length,
      issues,
      passedChecks
    }
  });
});
var emergencyStopHandler = (req, res) => {
  const { jobIds } = req.body;
  let cancelledCount = 0;
  let refundedCredits = 0;
  if (Array.isArray(jobIds)) {
    for (const id of jobIds) {
      const job = jobsStore.get(id);
      if (job && (job.status === "queued" || job.status === "processing")) {
        job.status = "cancelled";
        job.stage = "\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E09\u0E38\u0E01\u0E40\u0E09\u0E34\u0E19 (Emergency Stopped)";
        jobsStore.set(id, job);
        cancelledCount += 1;
        refundedCredits += job.costCredits;
      }
    }
  }
  if (refundedCredits > 0) {
    currentUserAccount.remainingCredits += refundedCredits;
    currentUserAccount.transactions.unshift({
      id: `tx_emergency_refund_${Date.now()}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      amount: refundedCredits,
      type: "refund",
      description: `\u0E04\u0E37\u0E19\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15\u0E08\u0E32\u0E01\u0E01\u0E32\u0E23\u0E01\u0E14\u0E2B\u0E22\u0E38\u0E14\u0E09\u0E38\u0E01\u0E40\u0E09\u0E34\u0E19 (Emergency Stop) \u0E08\u0E33\u0E19\u0E27\u0E19 ${cancelledCount} \u0E07\u0E32\u0E19 (+${refundedCredits} \u0E40\u0E04\u0E23\u0E14\u0E34\u0E15)`,
      balanceAfter: currentUserAccount.remainingCredits
    });
  }
  res.json({
    success: true,
    cancelledCount,
    refundedCredits,
    remainingCredits: currentUserAccount.remainingCredits,
    message: `\u0E2B\u0E22\u0E38\u0E14\u0E01\u0E32\u0E23\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E07\u0E32\u0E19\u0E09\u0E38\u0E01\u0E40\u0E09\u0E34\u0E19\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08 \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01 ${cancelledCount} \u0E04\u0E25\u0E34\u0E1B \u0E41\u0E25\u0E30\u0E04\u0E37\u0E19\u0E40\u0E04\u0E23\u0E14\u0E34\u0E15 +${refundedCredits} Sala AI Credits \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27`
  });
};
app.post("/api/director/emergency-stop", emergencyStopHandler);
app.post("/api/emergency-stop", emergencyStopHandler);
app.post("/api/lipsync/generate-workflow", (req, res) => {
  const { characterImageUrl, characterName, scriptText, audioFileName, provider, emotion } = req.body;
  const workflowPrompt = `[LIP_SYNC_DIRECTIVE]
Character: ${characterName || "Hero Character"}
Reference Facial Anchor: ${characterImageUrl || "Clean frontal portrait"}
Audio Script: "${scriptText || "\u0E1A\u0E17\u0E1E\u0E39\u0E14\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34"}"
Emotion / Viseme Tone: ${emotion || "Natural spoken Thai"}
Audio Track: ${audioFileName || "Master audio dialogue"}

VISUAL SPECIFICATION:
- Camera: Static medium close-up, focal length 85mm, aperture f/2.0
- Mouth Movement (Phoneme-to-Viseme alignment): Accurate lip opening, teeth visibility, natural consonant plosives.
- Micro-expressions: Natural eye blinking at 4-second intervals, subtle eyebrow micro-tensions aligned with vocal stress.
- Head Movement: Damped natural head nodding on emphasis, no unnatural bobbing.

EXTERNAL PIPELINE GUIDE:
1. Runway Gen-3 Act-One: Use portrait image as actor anchor and provide webcam/recorded audio as driver.
2. LivePortrait / SadTalker: Input reference face + extracted WAV audio for zero-shot synchronization.
3. Hedra Character-1: Upload audio speech and character anchor with speech prompt directive above.`;
  res.json({
    success: true,
    supported: false,
    providerName: providerManager.get(provider || "gemini").name,
    statusNote: "\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35 Lip Sync API \u0E17\u0E32\u0E07\u0E15\u0E23\u0E07\u0E08\u0E32\u0E01 Google Veo \u0E2B\u0E23\u0E37\u0E2D Meta (\u0E23\u0E30\u0E1A\u0E1A\u0E44\u0E21\u0E48\u0E41\u0E2A\u0E14\u0E07\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E1B\u0E25\u0E2D\u0E21\u0E27\u0E48\u0E32\u0E21\u0E35 API \u0E15\u0E23\u0E07) \u2014 \u0E44\u0E14\u0E49\u0E08\u0E31\u0E14\u0E40\u0E15\u0E23\u0E35\u0E22\u0E21 Lip Sync Directives & Workflow Guide \u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E19\u0E33\u0E44\u0E1B\u0E43\u0E0A\u0E49\u0E43\u0E19 Runway Act-One / LivePortrait / SadTalker / Hedra \u0E43\u0E2B\u0E49\u0E17\u0E31\u0E19\u0E17\u0E35",
    workflowPrompt,
    visemeInstructions: [
      "\u0E41\u0E21\u0E1B\u0E04\u0E33\u0E1E\u0E39\u0E14\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22\u0E01\u0E31\u0E1A Viseme \u0E1B\u0E32\u0E01\u0E15\u0E32\u0E21\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27\u0E04\u0E25\u0E37\u0E48\u0E19\u0E40\u0E2A\u0E35\u0E22\u0E07",
      "\u0E25\u0E47\u0E2D\u0E04\u0E42\u0E04\u0E23\u0E07\u0E2B\u0E19\u0E49\u0E32 \u0E14\u0E27\u0E07\u0E15\u0E32 \u0E41\u0E25\u0E30\u0E40\u0E2A\u0E49\u0E19\u0E1C\u0E21\u0E44\u0E21\u0E48\u0E43\u0E2B\u0E49\u0E1A\u0E34\u0E14\u0E40\u0E1A\u0E35\u0E49\u0E22\u0E27\u0E23\u0E30\u0E2B\u0E27\u0E48\u0E32\u0E07\u0E2D\u0E49\u0E32\u0E1B\u0E32\u0E01",
      "\u0E25\u0E14\u0E41\u0E23\u0E07\u0E01\u0E23\u0E30\u0E15\u0E38\u0E01\u0E28\u0E35\u0E23\u0E29\u0E30\u0E43\u0E2B\u0E49\u0E40\u0E04\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E44\u0E2B\u0E27\u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 (Damped head physics)"
    ],
    compatibleExternalTools: ["Runway Gen-3 Act-One", "LivePortrait", "SadTalker", "Hedra Character-1"]
  });
});
app.post("/api/video-to-script/analyze", async (req, res) => {
  const { videoUrl, videoName, sampleId } = req.body;
  const sampleBreakdown = {
    id: `v2s_${Date.now()}`,
    originalVideoName: videoName || "\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E15\u0E31\u0E27\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E23\u0E27\u0E08.mp4",
    durationSeconds: 30,
    storyOverview: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E2A\u0E16\u0E32\u0E19 \u0E04\u0E49\u0E19\u0E1E\u0E1A\u0E01\u0E25\u0E44\u0E01\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E41\u0E25\u0E30\u0E17\u0E32\u0E07\u0E25\u0E31\u0E1A\u0E43\u0E15\u0E49\u0E14\u0E34\u0E19",
    detectedCharacters: ["\u0E19\u0E31\u0E01\u0E2A\u0E33\u0E23\u0E27\u0E08", "\u0E1C\u0E39\u0E49\u0E1A\u0E23\u0E23\u0E22\u0E32\u0E22"],
    scenes: [
      {
        sceneNumber: 1,
        startTime: "00:00",
        endTime: "00:10",
        action: "\u0E19\u0E31\u0E01\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E16\u0E37\u0E2D\u0E04\u0E1A\u0E40\u0E1E\u0E25\u0E34\u0E07\u0E01\u0E49\u0E32\u0E27\u0E40\u0E02\u0E49\u0E32\u0E2A\u0E39\u0E48\u0E42\u0E16\u0E07\u0E27\u0E34\u0E2B\u0E32\u0E23 \u0E41\u0E2A\u0E07\u0E44\u0E1F\u0E2A\u0E48\u0E2D\u0E07\u0E01\u0E23\u0E30\u0E17\u0E1A\u0E1C\u0E19\u0E31\u0E07\u0E2B\u0E34\u0E19\u0E41\u0E01\u0E30\u0E2A\u0E25\u0E31\u0E01",
        dialogue: "\u0E19\u0E35\u0E48\u0E21\u0E31\u0E19... \u0E08\u0E32\u0E23\u0E36\u0E01\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E08\u0E23\u0E34\u0E07\u0E14\u0E49\u0E27\u0E22",
        speaker: "\u0E19\u0E31\u0E01\u0E2A\u0E33\u0E23\u0E27\u0E08",
        location: "\u0E42\u0E16\u0E07\u0E27\u0E34\u0E2B\u0E32\u0E23\u0E42\u0E1A\u0E23\u0E32\u0E13",
        emotion: "\u0E15\u0E37\u0E48\u0E19\u0E40\u0E15\u0E49\u0E19\u0E41\u0E25\u0E30\u0E17\u0E36\u0E48\u0E07",
        camera: "Tracking shot \u0E14\u0E49\u0E32\u0E19\u0E02\u0E49\u0E32\u0E07\u0E01\u0E36\u0E48\u0E07\u0E01\u0E25\u0E32\u0E07\u0E40\u0E1F\u0E23\u0E21",
        audio: "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E04\u0E1A\u0E40\u0E1E\u0E25\u0E34\u0E07\u0E25\u0E38\u0E01\u0E44\u0E2B\u0E21\u0E49\u0E40\u0E1A\u0E32\u0E46, \u0E14\u0E19\u0E15\u0E23\u0E35\u0E41\u0E2D\u0E21\u0E40\u0E1A\u0E35\u0E22\u0E19\u0E15\u0E4C\u0E25\u0E36\u0E01\u0E25\u0E31\u0E1A"
      },
      {
        sceneNumber: 2,
        startTime: "00:10",
        endTime: "00:20",
        action: "\u0E19\u0E31\u0E01\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E22\u0E01\u0E2D\u0E38\u0E1B\u0E01\u0E23\u0E13\u0E4C\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E02\u0E36\u0E49\u0E19\u0E2A\u0E48\u0E2D\u0E07 \u0E08\u0E39\u0E48\u0E46 \u0E01\u0E25\u0E44\u0E01\u0E2B\u0E34\u0E19\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E40\u0E23\u0E34\u0E48\u0E21\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E41\u0E25\u0E30\u0E40\u0E1B\u0E25\u0E48\u0E07\u0E41\u0E2A\u0E07\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E23\u0E2D\u0E07",
        dialogue: "\u0E23\u0E2B\u0E31\u0E2A\u0E01\u0E25\u0E44\u0E01\u0E40\u0E23\u0E34\u0E48\u0E21\u0E17\u0E33\u0E07\u0E32\u0E19\u0E41\u0E25\u0E49\u0E27!",
        speaker: "\u0E19\u0E31\u0E01\u0E2A\u0E33\u0E23\u0E27\u0E08",
        location: "\u0E41\u0E17\u0E48\u0E19\u0E08\u0E32\u0E23\u0E36\u0E01\u0E43\u0E08\u0E01\u0E25\u0E32\u0E07\u0E27\u0E34\u0E2B\u0E32\u0E23",
        emotion: "\u0E23\u0E30\u0E21\u0E31\u0E14\u0E23\u0E30\u0E27\u0E31\u0E07 \u0E15\u0E37\u0E48\u0E19\u0E15\u0E23\u0E30\u0E2B\u0E19\u0E01",
        camera: "Dolly In \u0E0B\u0E39\u0E21\u0E40\u0E02\u0E49\u0E32\u0E43\u0E1A\u0E2B\u0E19\u0E49\u0E32\u0E19\u0E31\u0E01\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E41\u0E25\u0E49\u0E27\u0E41\u0E1E\u0E19\u0E25\u0E07\u0E1E\u0E37\u0E49\u0E19\u0E2B\u0E34\u0E19",
        audio: "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E2B\u0E34\u0E19\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E40\u0E2A\u0E35\u0E22\u0E14\u0E2A\u0E35\u0E01\u0E31\u0E19, \u0E40\u0E2A\u0E35\u0E22\u0E07\u0E04\u0E27\u0E32\u0E21\u0E16\u0E35\u0E48\u0E15\u0E48\u0E33\u0E40\u0E23\u0E37\u0E2D\u0E07\u0E41\u0E2A\u0E07"
      },
      {
        sceneNumber: 3,
        startTime: "00:20",
        endTime: "00:30",
        action: "\u0E1E\u0E37\u0E49\u0E19\u0E28\u0E34\u0E25\u0E32\u0E40\u0E1B\u0E34\u0E14\u0E2D\u0E2D\u0E01\u0E40\u0E1B\u0E47\u0E19\u0E1A\u0E31\u0E19\u0E44\u0E14\u0E27\u0E19\u0E2A\u0E39\u0E48\u0E2B\u0E49\u0E2D\u0E07\u0E25\u0E31\u0E1A\u0E43\u0E15\u0E49\u0E14\u0E34\u0E19 \u0E19\u0E31\u0E01\u0E2A\u0E33\u0E23\u0E27\u0E08\u0E15\u0E31\u0E14\u0E2A\u0E34\u0E19\u0E43\u0E08\u0E01\u0E49\u0E32\u0E27\u0E02\u0E32\u0E25\u0E07\u0E44\u0E1B\u0E04\u0E49\u0E19\u0E2B\u0E32\u0E04\u0E27\u0E32\u0E21\u0E08\u0E23\u0E34\u0E07",
        dialogue: "\u0E44\u0E21\u0E48\u0E27\u0E48\u0E32\u0E2D\u0E30\u0E44\u0E23\u0E08\u0E30\u0E2D\u0E22\u0E39\u0E48\u0E02\u0E49\u0E32\u0E07\u0E25\u0E48\u0E32\u0E07 \u0E40\u0E23\u0E32\u0E15\u0E49\u0E2D\u0E07\u0E44\u0E1B\u0E15\u0E48\u0E2D",
        speaker: "\u0E19\u0E31\u0E01\u0E2A\u0E33\u0E23\u0E27\u0E08",
        location: "\u0E1B\u0E32\u0E01\u0E17\u0E32\u0E07\u0E40\u0E02\u0E49\u0E32\u0E1A\u0E31\u0E19\u0E44\u0E14\u0E25\u0E31\u0E1A\u0E43\u0E15\u0E49\u0E14\u0E34\u0E19",
        emotion: "\u0E21\u0E38\u0E48\u0E07\u0E21\u0E31\u0E48\u0E19\u0E40\u0E14\u0E47\u0E14\u0E40\u0E14\u0E35\u0E48\u0E22\u0E27",
        camera: "\u0E21\u0E38\u0E21\u0E21\u0E2D\u0E07\u0E14\u0E49\u0E32\u0E19\u0E2B\u0E25\u0E31\u0E07 (Over-the-shoulder) \u0E01\u0E49\u0E21\u0E21\u0E2D\u0E07\u0E25\u0E07\u0E2A\u0E39\u0E48\u0E1A\u0E31\u0E19\u0E44\u0E14\u0E25\u0E36\u0E01",
        audio: "\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E25\u0E21\u0E1E\u0E31\u0E14\u0E08\u0E32\u0E01\u0E43\u0E15\u0E49\u0E14\u0E34\u0E19, \u0E14\u0E19\u0E15\u0E23\u0E35\u0E40\u0E23\u0E48\u0E07\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E30\u0E2A\u0E48\u0E07\u0E15\u0E48\u0E2D\u0E2A\u0E39\u0E48\u0E1A\u0E17\u0E16\u0E31\u0E14\u0E44\u0E1B"
      }
    ]
  };
  res.json({ success: true, result: sampleBreakdown });
});
app.post("/api/script/replace-characters", (req, res) => {
  const { scriptText, dialogues, oldName, newName, characterLibraryId } = req.body;
  if (!oldName || !newName) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E14\u0E34\u0E21\u0E41\u0E25\u0E30\u0E0A\u0E37\u0E48\u0E2D\u0E43\u0E2B\u0E21\u0E48\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19" });
  }
  const regex = new RegExp(oldName, "gi");
  const updatedScriptText = (scriptText || "").replace(regex, newName);
  const updatedDialogues = Array.isArray(dialogues) ? dialogues.map((d) => ({
    ...d,
    speaker: d.speaker === oldName ? newName : d.speaker.replace(regex, newName),
    line: d.line.replace(regex, newName)
  })) : [];
  let newCharDetails = null;
  if (characterLibraryId) {
    newCharDetails = charactersStore.find((c) => c.id === characterLibraryId);
  }
  res.json({
    success: true,
    updatedScriptText,
    updatedDialogues,
    newCharacter: newCharDetails,
    message: `\u0E41\u0E17\u0E19\u0E17\u0E35\u0E48\u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23 "${oldName}" \u0E40\u0E1B\u0E47\u0E19 "${newName}" \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27\u0E43\u0E19\u0E1A\u0E17\u0E41\u0E25\u0E30\u0E1A\u0E17\u0E1E\u0E39\u0E14\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14`
  });
});
app.post("/api/social/generate-posts", async (req, res) => {
  const { scriptText, characterName, tone } = req.body;
  const toneLabel = tone || "\u0E44\u0E27\u0E23\u0E31\u0E25 \u0E0A\u0E27\u0E19\u0E15\u0E34\u0E14\u0E15\u0E32\u0E21";
  const char = characterName ? ` ${characterName}` : "";
  const recommendations = [
    {
      platform: "tiktok",
      tone: toneLabel,
      titles: [
        `\u0E04\u0E27\u0E32\u0E21\u0E25\u0E31\u0E1A\u0E17\u0E35\u0E48\u0E0B\u0E48\u0E2D\u0E19\u0E44\u0E27\u0E49 700 \u0E1B\u0E35 \u0E16\u0E39\u0E01\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E1C\u0E22\u0E41\u0E25\u0E49\u0E27! \u{1F631}\u{1F525}`,
        `\u0E2D\u0E22\u0E48\u0E32\u0E01\u0E30\u0E1E\u0E23\u0E34\u0E1A\u0E15\u0E32! \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35\u0E17\u0E35\u0E48${char} \u0E04\u0E49\u0E19\u0E1E\u0E1A\u0E2B\u0E49\u0E2D\u0E07\u0E25\u0E31\u0E1A\u0E43\u0E15\u0E49\u0E14\u0E34\u0E19 \u{1F3DB}\uFE0F\u2728`,
        `\u0E17\u0E33\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E31\u0E49\u0E19 AI \u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07 3 \u0E04\u0E25\u0E34\u0E1B\u0E14\u0E49\u0E27\u0E22 Sala AI \u0E2A\u0E27\u0E22\u0E02\u0E19\u0E32\u0E14\u0E19\u0E35\u0E49\u0E40\u0E25\u0E22\u0E2B\u0E23\u0E2D?! \u{1F3AC}`
      ],
      captions: [
        `\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E20\u0E32\u0E23\u0E01\u0E34\u0E08\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E04\u0E14\u0E35\u0E1E\u0E32\u0E21\u0E32\u0E1E\u0E1A\u0E01\u0E31\u0E1A\u0E01\u0E25\u0E44\u0E01\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E04\u0E27\u0E23\u0E21\u0E35\u0E2D\u0E22\u0E39\u0E48\u0E1A\u0E19\u0E42\u0E25\u0E01... \u0E14\u0E39\u0E43\u0E2B\u0E49\u0E08\u0E1A\u0E41\u0E25\u0E49\u0E27\u0E04\u0E38\u0E13\u0E08\u0E30\u0E02\u0E19\u0E25\u0E38\u0E01! \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E14\u0E49\u0E27\u0E22 Sala AI Multi-Clip Continuity Director \u0E25\u0E47\u0E2D\u0E04\u0E2B\u0E19\u0E49\u0E32\u0E41\u0E25\u0E30\u0E41\u0E2A\u0E07\u0E40\u0E1B\u0E4A\u0E30\u0E17\u0E38\u0E01\u0E04\u0E25\u0E34\u0E1B #\u0E2B\u0E19\u0E31\u0E07\u0E44\u0E17\u0E22 #\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E31\u0E49\u0E19AI #\u0E44\u0E0B\u0E44\u0E1F\u0E44\u0E17\u0E22 #SalaAI #\u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4CAI #\u0E40\u0E1A\u0E37\u0E49\u0E2D\u0E07\u0E2B\u0E25\u0E31\u0E07`,
        `\u0E04\u0E27\u0E32\u0E21\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C 35mm \u0E44\u0E21\u0E48\u0E21\u0E31\u0E48\u0E27\u0E2B\u0E19\u0E49\u0E32 \u0E44\u0E21\u0E48\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E0A\u0E38\u0E14 \u0E25\u0E2D\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E40\u0E2D\u0E07\u0E44\u0E14\u0E49\u0E41\u0E25\u0E49\u0E27\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49! #AI\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D #\u0E40\u0E17\u0E04\u0E42\u0E19\u0E42\u0E25\u0E22\u0E35 #TikTok\u0E01\u0E32\u0E23\u0E25\u0E30\u0E04\u0E23 #\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E04\u0E25\u0E34\u0E1B`
      ],
      hashtags: ["#SalaAI", "#\u0E2B\u0E19\u0E31\u0E07\u0E44\u0E17\u0E22", "#\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E31\u0E49\u0E19AI", "#\u0E44\u0E0B\u0E44\u0E1F\u0E44\u0E17\u0E22", "#TikTok\u0E01\u0E32\u0E23\u0E25\u0E30\u0E04\u0E23", "#VeoVideo", "#AI\u0E04\u0E23\u0E35\u0E40\u0E2D\u0E40\u0E15\u0E2D\u0E23\u0E4C"]
    },
    {
      platform: "reels",
      tone: toneLabel,
      titles: [
        `Cinematic Thai Sci-Fi: The Forgotten Sanctuary \u{1F3AC}`,
        `\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E15\u0E33\u0E19\u0E32\u0E19\u0E42\u0E1A\u0E23\u0E32\u0E13\u0E1C\u0E2A\u0E32\u0E19\u0E01\u0E31\u0E1A\u0E1E\u0E25\u0E31\u0E07 AI \u0E41\u0E2B\u0E48\u0E07\u0E2D\u0E19\u0E32\u0E04\u0E15 \u2728`
      ],
      captions: [
        `\u0E01\u0E49\u0E32\u0E27\u0E41\u0E23\u0E01\u0E2A\u0E39\u0E48\u0E04\u0E27\u0E32\u0E21\u0E25\u0E36\u0E01\u0E25\u0E31\u0E1A\u0E02\u0E2D\u0E07\u0E27\u0E34\u0E2B\u0E32\u0E23\u0E42\u0E1A\u0E23\u0E32\u0E13 \u0E41\u0E2A\u0E07\u0E04\u0E1A\u0E40\u0E1E\u0E25\u0E34\u0E07 Chiaroscuro \u0E01\u0E31\u0E1A\u0E04\u0E27\u0E32\u0E21\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07 10 \u0E21\u0E34\u0E15\u0E34\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E2A\u0E30\u0E14\u0E38\u0E14\u0E41\u0E21\u0E49\u0E41\u0E15\u0E48\u0E27\u0E34\u0E19\u0E32\u0E17\u0E35\u0E40\u0E14\u0E35\u0E22\u0E27 \u0E01\u0E33\u0E01\u0E31\u0E1A\u0E41\u0E25\u0E30\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E14\u0E49\u0E27\u0E22\u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D (Sala AI) \u{1F1F9}\u{1F1ED}\u2728`,
        `\u0E17\u0E14\u0E2A\u0E2D\u0E1A\u0E1E\u0E25\u0E31\u0E07 Master Continuity Lock: \u0E2B\u0E19\u0E49\u0E32\u0E40\u0E14\u0E34\u0E21 \u0E0A\u0E38\u0E14\u0E40\u0E14\u0E34\u0E21 \u0E41\u0E2A\u0E07\u0E40\u0E14\u0E34\u0E21 \u0E15\u0E25\u0E2D\u0E14\u0E17\u0E31\u0E49\u0E07\u0E40\u0E23\u0E37\u0E48\u0E2D\u0E07! \u0E01\u0E14\u0E40\u0E0B\u0E1F\u0E44\u0E27\u0E49\u0E17\u0E33\u0E15\u0E32\u0E21\u0E44\u0E14\u0E49\u0E40\u0E25\u0E22`
      ],
      hashtags: ["#SalaAI", "#CinematicAI", "#ThaiHeritage", "#Filmmaking", "#GenerativeAI", "#ReelsVideo"]
    },
    {
      platform: "youtube",
      tone: toneLabel,
      titles: [
        `[\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E31\u0E49\u0E19 AI 4K] \u0E04\u0E27\u0E32\u0E21\u0E25\u0E31\u0E1A\u0E43\u0E15\u0E49\u0E14\u0E34\u0E19 - The Lost Inscription (\u0E15\u0E2D\u0E19\u0E17\u0E35\u0E48 1)`,
        `\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E31\u0E49\u0E19\u0E14\u0E49\u0E27\u0E22 AI \u0E2B\u0E25\u0E32\u0E22\u0E04\u0E25\u0E34\u0E1B\u0E15\u0E48\u0E2D\u0E01\u0E31\u0E19\u0E41\u0E1A\u0E1A\u0E21\u0E37\u0E2D\u0E2D\u0E32\u0E0A\u0E35\u0E1E \u0E17\u0E33\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E44\u0E23? (\u0E40\u0E08\u0E32\u0E30\u0E25\u0E36\u0E01 Sala AI)`
      ],
      captions: [
        `\u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C\u0E2A\u0E31\u0E49\u0E19\u0E04\u0E27\u0E32\u0E21\u0E22\u0E32\u0E27 30 \u0E27\u0E34\u0E19\u0E32\u0E17\u0E35 \u0E2A\u0E23\u0E49\u0E32\u0E07\u0E14\u0E49\u0E27\u0E22\u0E40\u0E17\u0E04\u0E42\u0E19\u0E42\u0E25\u0E22\u0E35 Multi-Clip Continuity Director \u0E1A\u0E19\u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D (Sala AI) \u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D\u0E42\u0E21\u0E40\u0E14\u0E25\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E20\u0E32\u0E1E\u0E41\u0E25\u0E30\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E23\u0E30\u0E14\u0E31\u0E1A\u0E42\u0E25\u0E01 \u0E25\u0E47\u0E2D\u0E04\u0E04\u0E27\u0E32\u0E21\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23 \u0E1A\u0E17\u0E1E\u0E39\u0E14 \u0E41\u0E25\u0E30\u0E40\u0E2A\u0E35\u0E22\u0E07\u0E1B\u0E23\u0E30\u0E01\u0E2D\u0E1A\u0E2A\u0E21\u0E1A\u0E39\u0E23\u0E13\u0E4C\u0E41\u0E1A\u0E1A

\u0E0A\u0E21\u0E40\u0E1A\u0E37\u0E49\u0E2D\u0E07\u0E2B\u0E25\u0E31\u0E07\u0E41\u0E25\u0E30\u0E27\u0E34\u0E18\u0E35\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E44\u0E14\u0E49\u0E43\u0E19\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E19\u0E35\u0E49!`
      ],
      hashtags: ["#SalaAI", "#AIFilm", "#YouTubeShorts", "#Veo", "#\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E31\u0E49\u0E19"]
    },
    {
      platform: "facebook",
      tone: toneLabel,
      titles: [
        `\u0E08\u0E32\u0E01\u0E1A\u0E17\u0E25\u0E30\u0E04\u0E23\u0E15\u0E31\u0E27\u0E2B\u0E19\u0E31\u0E07\u0E2A\u0E37\u0E2D \u0E2A\u0E39\u0E48\u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C\u0E2A\u0E31\u0E49\u0E19 AI \u0E2B\u0E25\u0E32\u0E22\u0E04\u0E25\u0E34\u0E1B\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E43\u0E19\u0E44\u0E21\u0E48\u0E01\u0E35\u0E48\u0E19\u0E32\u0E17\u0E35`,
        `\u0E40\u0E1A\u0E37\u0E49\u0E2D\u0E07\u0E2B\u0E25\u0E31\u0E07\u0E01\u0E32\u0E23\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E2B\u0E19\u0E31\u0E07\u0E44\u0E17\u0E22\u0E44\u0E0B\u0E44\u0E1F\u0E14\u0E49\u0E27\u0E22\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E21\u0E37\u0E2D\u0E1C\u0E39\u0E49\u0E01\u0E33\u0E01\u0E31\u0E1A AI \u0E2A\u0E31\u0E0D\u0E0A\u0E32\u0E15\u0E34\u0E44\u0E17\u0E22`
      ],
      captions: [
        `\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E02\u0E2D\u0E1E\u0E32\u0E17\u0E38\u0E01\u0E04\u0E19\u0E21\u0E32\u0E0A\u0E21\u0E1C\u0E25\u0E07\u0E32\u0E19\u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C\u0E2A\u0E31\u0E49\u0E19\u0E17\u0E35\u0E48\u0E17\u0E14\u0E25\u0E2D\u0E07\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E1C\u0E48\u0E32\u0E19\u0E23\u0E30\u0E1A\u0E1A "Multi-Clip Continuity Director" \u0E02\u0E2D\u0E07\u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D (Sala AI)

\u0E1B\u0E31\u0E0D\u0E2B\u0E32\u0E43\u0E2B\u0E0D\u0E48\u0E02\u0E2D\u0E07\u0E04\u0E19\u0E17\u0E33\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D AI \u0E04\u0E37\u0E2D \u0E2B\u0E19\u0E49\u0E32\u0E15\u0E31\u0E27\u0E25\u0E30\u0E04\u0E23\u0E40\u0E1E\u0E35\u0E49\u0E22\u0E19 \u0E41\u0E2A\u0E07\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19 \u0E0A\u0E38\u0E14\u0E44\u0E21\u0E48\u0E15\u0E23\u0E07 \u0E41\u0E15\u0E48\u0E23\u0E30\u0E1A\u0E1A\u0E19\u0E35\u0E49\u0E21\u0E35 Master Continuity Lock \u0E25\u0E47\u0E2D\u0E04\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E19\u0E49\u0E32 \u0E1E\u0E23\u0E47\u0E2D\u0E1E \u0E41\u0E25\u0E30\u0E42\u0E21\u0E40\u0E21\u0E19\u0E15\u0E31\u0E21\u0E02\u0E2D\u0E07\u0E21\u0E38\u0E21\u0E01\u0E25\u0E49\u0E2D\u0E07\u0E08\u0E32\u0E01\u0E04\u0E25\u0E34\u0E1B\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E44\u0E1B\u0E2D\u0E35\u0E01\u0E04\u0E25\u0E34\u0E1B\u0E2B\u0E19\u0E36\u0E48\u0E07\u0E44\u0E14\u0E49\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E23\u0E32\u0E1A\u0E23\u0E37\u0E48\u0E19\u0E21\u0E32\u0E01\u0E04\u0E23\u0E31\u0E1A \u0E43\u0E04\u0E23\u0E01\u0E33\u0E25\u0E31\u0E07\u0E17\u0E33\u0E04\u0E2D\u0E19\u0E40\u0E17\u0E19\u0E15\u0E4C\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D\u0E15\u0E49\u0E2D\u0E07\u0E25\u0E2D\u0E07!`
      ],
      hashtags: ["#\u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D", "#SalaAI", "#\u0E1B\u0E31\u0E0D\u0E0D\u0E32\u0E1B\u0E23\u0E30\u0E14\u0E34\u0E29\u0E10\u0E4C", "#\u0E2A\u0E23\u0E49\u0E32\u0E07\u0E27\u0E34\u0E14\u0E35\u0E42\u0E2D", "#\u0E20\u0E32\u0E1E\u0E22\u0E19\u0E15\u0E23\u0E4C\u0E2A\u0E31\u0E49\u0E19"]
    }
  ];
  res.json({ success: true, recommendations });
});
app.get("/api/project-templates", (req, res) => {
  res.json({ success: true, templates: projectTemplatesStore });
});
app.post("/api/project-templates", (req, res) => {
  const { name, description, aspectRatio, visualStyle, defaultCharacterId, continuityLock, audioDirectives } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: "\u0E01\u0E23\u0E38\u0E13\u0E32\u0E23\u0E30\u0E1A\u0E38\u0E0A\u0E37\u0E48\u0E2D\u0E40\u0E17\u0E21\u0E40\u0E1E\u0E25\u0E15" });
  }
  const newTemplate = {
    id: `tmpl_${Date.now()}`,
    name,
    description: description || "",
    aspectRatio: aspectRatio || "16:9",
    visualStyle: visualStyle || "Cinematic",
    defaultCharacterId,
    continuityLock,
    audioDirectives,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  projectTemplatesStore.push(newTemplate);
  res.json({ success: true, template: newTemplate, message: "\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E40\u0E17\u0E21\u0E40\u0E1E\u0E25\u0E15\u0E42\u0E04\u0E23\u0E07\u0E01\u0E32\u0E23\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27" });
});
app.post("/api/projects/:id/version", (req, res) => {
  const { note } = req.body;
  const project = projectsStore.find((p) => p.id === req.params.id);
  if (!project) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E42\u0E1B\u0E23\u0E40\u0E08\u0E47\u0E01\u0E15\u0E4C" });
  }
  if (!project.versions) {
    project.versions = [];
  }
  const versionNum = project.versions.length + 1;
  const newVersion = {
    id: `ver_${Date.now()}`,
    versionNumber: versionNum,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    note: note || `\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19\u0E17\u0E35\u0E48 ${versionNum} (Auto-Saved Snapshot)`,
    sceneCount: project.scenes.length,
    snapshot: JSON.parse(JSON.stringify(project))
  };
  project.versions.unshift(newVersion);
  res.json({ success: true, version: newVersion, message: `\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19\u0E17\u0E35\u0E48 ${versionNum} \u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08` });
});
app.post("/api/projects/:id/restore-version", (req, res) => {
  const { versionId } = req.body;
  const project = projectsStore.find((p) => p.id === req.params.id);
  if (!project || !project.versions) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E42\u0E1B\u0E23\u0E40\u0E08\u0E47\u0E01\u0E15\u0E4C\u0E2B\u0E23\u0E37\u0E2D\u0E1B\u0E23\u0E30\u0E27\u0E31\u0E15\u0E34\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19" });
  }
  const targetVer = project.versions.find((v) => v.id === versionId);
  if (!targetVer) {
    return res.status(404).json({ success: false, message: "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19\u0E17\u0E35\u0E48\u0E15\u0E49\u0E2D\u0E07\u0E01\u0E32\u0E23\u0E22\u0E49\u0E2D\u0E19\u0E01\u0E25\u0E31\u0E1A" });
  }
  project.title = targetVer.snapshot.title;
  project.description = targetVer.snapshot.description;
  project.aspectRatio = targetVer.snapshot.aspectRatio;
  project.scenes = targetVer.snapshot.scenes;
  project.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  res.json({ success: true, project, message: `\u0E22\u0E49\u0E2D\u0E19\u0E01\u0E25\u0E31\u0E1A\u0E42\u0E1B\u0E23\u0E40\u0E08\u0E47\u0E01\u0E15\u0E4C\u0E2A\u0E39\u0E48\u0E40\u0E27\u0E2D\u0E23\u0E4C\u0E0A\u0E31\u0E19\u0E17\u0E35\u0E48 ${targetVer.versionNumber} \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22\u0E41\u0E25\u0E49\u0E27` });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[\u0E28\u0E32\u0E25\u0E32\u0E40\u0E2D\u0E44\u0E2D / Sala AI] Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
