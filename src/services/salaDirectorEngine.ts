/**
 * Sala AI - Master Continuity Director & Protocol Engine
 * 
 * Strict Specification & Requirements:
 * 1. RESERVED SYSTEM KEYWORDS:
 *    LOCK, CONT, FRAME, AUTO, RULE, NO, OUT, STORY, CHARACTERS, END, SALA_MULTI_CLIP
 * 2. RESERVED SYSTEM KEYWORDS must NEVER be treated as character names or dialogue speakers.
 * 3. Dialogue must ONLY accept characters explicitly declared in CHARACTERS or character library.
 * 4. END must be treated as endState for continuity, NEVER dialogue.
 * 5. Metadata before STORY:{ must be treated as system/control metadata.
 * 6. Multi-Clip Director: 1 clip = 1 prompt.
 * 7. Continuity: END_STATE of clip N must map to START_STATE of clip N+1.
 * 8. Final Provider Prompt: Must be clean, no internal metadata, no placeholders, no "OR" values.
 * 9. Strict validation required before generation.
 */

import {
  DirectedClipItem,
  DialogueLockEntry,
  MasterContinuityLock,
  AudioDirectives,
  ContinuityIssue
} from '../types';
import {
  analyzeClipContinuity,
  enforcePoseHandoff,
  formatContinuityForPrompt,
  normalizePoseList,
  expandCombinedCharacterNames,
  type CharacterPoseState,
  type ContinuityWarning
} from './continuityEngine';
import { enforceLibraryLocationLocks, type LocationLockInput } from './locationAppearance';
import { findSections, removeSections, insertBlock, stripExact, countOccurrences } from './promptSections';
import {
  buildCharacterAppearanceLock,
  formatReferenceImageLine,
  mergeDeclaredCharacters,
  type CharacterAppearanceInput
} from './characterAppearance';

// ==========================================
// 1. RESERVED SYSTEM KEYWORDS
// ==========================================
export const RESERVED_SYSTEM_KEYWORDS = [
  'LOCK',
  'CONT',
  'FRAME',
  'AUTO',
  'RULE',
  'NO',
  'OUT',
  'STORY',
  'CHARACTERS',
  'END',
  'SALA_MULTI_CLIP'
] as const;

export type ReservedKeyword = typeof RESERVED_SYSTEM_KEYWORDS[number];

export const RESERVED_KEYWORD_SET = new Set<string>(
  RESERVED_SYSTEM_KEYWORDS.map(k => k.toUpperCase())
);

/**
 * Checks if a token matches any reserved system keyword
 */
export function isReservedSystemKeyword(word: string): boolean {
  if (!word) return false;
  const clean = word.trim().toUpperCase().replace(/[:=_{}\[\]]/g, '');
  return RESERVED_KEYWORD_SET.has(clean);
}

/**
 * Thai speech verbs that are often glued to a speaker name ("น้องฟ้าใสกระซิบ").
 * Longest first so "พูดว่า" is removed before "พูด".
 */
export const SPEECH_VERBS = [
  'กระซิบกระซาบ', 'กรีดร้อง', 'ร้องตะโกน', 'ตะโกนว่า', 'กระซิบว่า', 'พูดว่า', 'ถามว่า', 'ตอบว่า',
  'กล่าวว่า', 'บอกว่า', 'ร้องว่า', 'เอ่ยว่า', 'พึมพำ', 'กระซิบ', 'ตะโกน', 'ร้องเรียก', 'ร้องไห้',
  'อุทาน', 'ตวาด', 'คำราม', 'สะอื้น', 'หัวเราะ', 'ครวญ', 'เรียก', 'กล่าว', 'พูด', 'ถาม', 'ตอบ',
  'บอก', 'เอ่ย', 'ร้อง'
];

/**
 * Normalizes a speaker label before de-duplication / comparison:
 * strips markup, parentheticals and trailing speech verbs, then maps to a known character.
 */
export function normalizeSpeakerForDedupe(name: string, knownCharacters: string[] = []): string {
  if (!name) return '';
  let s = name.replace(/[*_#"“”'`\[\]]/g, '').replace(/\([^)]*\)/g, '').replace(/[:：]+$/, '').trim();
  const known = [...knownCharacters].filter(Boolean).sort((a, b) => b.length - a.length);
  const k = known.find(n => s === n || s.startsWith(n));
  if (k) return k;
  let cut = -1;
  for (const v of SPEECH_VERBS) {
    const idx = s.indexOf(v);
    if (idx >= 2 && (cut === -1 || idx < cut)) cut = idx;
  }
  if (cut > 0) s = s.slice(0, cut).trim();
  return s;
}

/** Dialogue line text for de-duplication: quotes, whitespace and case ignored. */
export function normalizeDialogueLine(line: string): string {
  return String(line || '').replace(/["“”'‘’«»「」`]/g, '').replace(/\s+/g, '').toLowerCase();
}

/**
 * De-duplicates dialogue entries of one scene. Same normalized line text from the same speaker,
 * or from a combined label ("พี่ทุย และ น้องน้ำ") and one of its characters, is one entry;
 * the real single speaker is kept. Different single speakers saying the same words stay separate.
 */
export function dedupeDialogueEntries<T extends { speaker: string; line: string }>(dialogues: T[], knownCharacters: string[] = []): T[] {
  const known = expandCombinedCharacterNames(knownCharacters);
  const out: T[] = [];
  const members = (speaker: string) => expandCombinedCharacterNames([speaker]);
  for (const d of dialogues) {
    if (!d || !d.speaker) continue;
    const rawSpeaker = d.speaker.trim();
    const combined = members(rawSpeaker).length > 1;
    const speaker = combined ? rawSpeaker : (normalizeSpeakerForDedupe(rawSpeaker, known) || rawSpeaker);
    const lineKey = normalizeDialogueLine(d.line);
    const idx = out.findIndex(o => {
      if (normalizeDialogueLine(o.line) !== lineKey) return false;
      if (o.speaker.toLowerCase() === speaker.toLowerCase()) return true;
      const a = members(o.speaker); const b = members(speaker);
      return (a.length > 1 && b.every(x => a.includes(x))) || (b.length > 1 && a.every(x => b.includes(x)));
    });
    if (idx === -1) { out.push({ ...d, speaker }); continue; }
    // Replace a combined-label entry with the real single speaker's entry (same position)
    if (members(out[idx].speaker).length > 1 && !combined) out[idx] = { ...d, speaker };
  }
  return out;
}

// ==========================================
// 2. FORBIDDEN PLACEHOLDERS & TEMPLATES
// ==========================================
export const FORBIDDEN_PLACEHOLDER_SUBSTRINGS = [
  'tea_cup_or_torch',
  'Thai dialogue if needed',
  'ตัวละครหลัก',
  'สถานที่ดำเนินเรื่อง',
  'จุดชมวิวยอดดอยหลวงเชียงดาว',
  'รูปลักษณ์และเครื่องแต่งกายคงที่',
  'สถานที่ตามบทละคร',
  'แสงคบเพลิงสีส้ม Chiaroscuro',
  'วิหารศิลาแลง',
  'undefined',
  'null',
  '[object Object]'
];

/** Tokens that must be matched as whole words (so names like "Nullah" are not flagged). */
const WHOLE_TOKEN_PLACEHOLDERS = new Set(['undefined', 'null']);

/**
 * Returns true if `text` contains the forbidden placeholder.
 * 'null' / 'undefined' are matched as standalone tokens only; other entries are substrings.
 */
export function containsForbiddenPlaceholder(text: string, placeholder: string): boolean {
  if (!text || !placeholder) return false;
  const p = placeholder.toLowerCase();
  if (WHOLE_TOKEN_PLACEHOLDERS.has(p)) {
    return new RegExp(`(^|[^A-Za-z0-9_])${p}($|[^A-Za-z0-9_])`, 'i').test(text);
  }
  return text.toLowerCase().includes(p);
}

// ==========================================
// 3. PROTOCOL DATA STRUCTURES
// ==========================================
export interface SalaProtocolHeader {
  protocolVersion: string; // e.g. SALA1
  storyId?: string;        // e.g. S001
  part?: string;           // e.g. P2/3
  clipRange?: {
    raw: string;           // e.g. C07-12
    startClip: number;     // 7
    endClip: number;       // 12
  };
  handoffRule?: {
    raw: string;           // e.g. H:06>07
    fromClip: number;      // 6
    toClip: number;        // 7
  };
  keepCharacterLock?: boolean; // K:KEEP
  keepContinuity?: boolean;    // CT:KEEP
}

export interface ParsedControlMetadata {
  rawHeader?: string;
  protocol?: SalaProtocolHeader;
  title?: string;
  location?: string;
  timeOfDay?: string;
  lighting?: string;
  style?: string;
  props?: string;
  declaredCharacters: { name: string; description?: string }[];
  lockDirectives: Record<string, string>;
  contDirectives: Record<string, string>;
  frameDirectives: Record<string, string>;
  autoDirectives: Record<string, string>;
  ruleDirectives: string[];
  noDirectives: string[];
  outDirectives: Record<string, string>;
}

export interface ParsedRawClip {
  clipNumber: number;
  title: string;
  actions: string[];
  cameraDirectives: string[];
  dialogues: DialogueLockEntry[];
  characterPositions?: string;
  startAction?: string;
  endState?: string;
  /** Original order of action / dialogue beats (index into actions / dialogues) */
  sequence?: Array<{ kind: 'action' | 'dialogue'; index: number }>;
}

export interface ParseSalaScriptResult {
  metadata: ParsedControlMetadata;
  clips: ParsedRawClip[];
  storyTextClean: string;
  detectedCharacters: string[];
  totalClips: number;
}

// ==========================================
// 4. PROTOCOL & SCRIPT PARSER
// ==========================================

export const METADATA_KEYWORDS = new Set([
  'ชื่อเรื่อง', 'เรื่อง', 'title',
  'ตัวละคร', 'ตัวละครหลัก', 'รายชื่อตัวละคร', 'characters', 'character',
  'สถานที่หลัก', 'สถานที่ถ่ายทำ', 'สถานที่', 'location',
  'เวลา', 'ช่วงเวลา', 'บรรยากาศ', 'time',
  'แสง', 'การจัดแสง', 'lighting',
  'สไตล์', 'สไตล์ภาพ', 'โทนภาพ', 'style',
  'อุปกรณ์', 'พร็อพ', 'สิ่งของ', 'props',
  'ฉาก', 'ฉากที่', 'scene', 'clip',
  'กล้อง', 'มุมกล้อง', 'camera',
  'end', 'end_state', 'story'
]);

export function isMetadataKeyword(word: string): boolean {
  if (!word) return false;
  const clean = word.trim().toLowerCase().replace(/[:：=_#\-*•]/g, '').trim();
  return METADATA_KEYWORDS.has(clean);
}

/**
 * Parses protocol header line, e.g.
 * @SALA1#S001|P2/3|C07-12|H:06>07|K:KEEP|CT:KEEP
 */
export function parseSalaProtocolHeader(line: string): SalaProtocolHeader | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('@SALA')) return null;

  const header: SalaProtocolHeader = {
    protocolVersion: 'SALA1'
  };

  // e.g. @SALA1#S001|...
  const [protoAndStory, ...segments] = trimmed.split('|');
  const matchProto = protoAndStory.match(/^@([A-Z0-9]+)(?:#([A-Z0-9_-]+))?/i);
  if (matchProto) {
    header.protocolVersion = matchProto[1].toUpperCase();
    if (matchProto[2]) {
      header.storyId = matchProto[2];
    }
  }

  for (const seg of segments) {
    const s = seg.trim();
    if (s.startsWith('P')) {
      header.part = s;
    } else if (s.startsWith('C') && s.includes('-')) {
      const matchRange = s.match(/^C0*(\d+)-0*(\d+)/i);
      if (matchRange) {
        header.clipRange = {
          raw: s,
          startClip: parseInt(matchRange[1], 10),
          endClip: parseInt(matchRange[2], 10)
        };
      }
    } else if (s.startsWith('H:')) {
      const matchHandoff = s.match(/^H:0*(\d+)>0*(\d+)/i);
      if (matchHandoff) {
        header.handoffRule = {
          raw: s,
          fromClip: parseInt(matchHandoff[1], 10),
          toClip: parseInt(matchHandoff[2], 10)
        };
      }
    } else if (s === 'K:KEEP') {
      header.keepCharacterLock = true;
    } else if (s === 'CT:KEEP') {
      header.keepContinuity = true;
    }
  }

  return header;
}

/**
 * Strict script parser that isolates metadata before "ฉากที่ 1",
 * accurately extracts characters and their descriptions without turning them into dialogue,
 * maps scene headers 1:1 to clips, and validates dialogues.
 */
export function parseSalaScript(
  scriptText: string,
  options?: {
    knownCharacters?: string[];
    defaultClipCount?: number;
  }
): ParseSalaScriptResult {
  const lines = scriptText.split('\n').map(l => l.trim());
  const metadata: ParsedControlMetadata = {
    declaredCharacters: [],
    lockDirectives: {},
    contDirectives: {},
    frameDirectives: {},
    autoDirectives: {},
    ruleDirectives: [],
    noDirectives: [],
    outDirectives: {}
  };

  // Seed with caller-provided known characters
  if (options?.knownCharacters && options.knownCharacters.length > 0) {
    // "พี่ทุย และ น้องน้ำ" is two characters, never one combined speaker
    for (const kc of expandCombinedCharacterNames(options.knownCharacters)) {
      if (kc && !isReservedSystemKeyword(kc) && !isMetadataKeyword(kc)) {
        const cleanName = kc.trim();
        if (!metadata.declaredCharacters.some(c => c.name.toLowerCase() === cleanName.toLowerCase())) {
          metadata.declaredCharacters.push({ name: cleanName });
        }
      }
    }
  }

  // Helper to add declared character safely
  const addDeclaredCharacter = (name: string, description?: string) => {
    const cleanName = name.trim();
    if (!cleanName || isReservedSystemKeyword(cleanName) || isMetadataKeyword(cleanName)) return;
    const existing = metadata.declaredCharacters.find(c => c.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
      if (description && !existing.description) {
        existing.description = description.trim();
      }
    } else {
      metadata.declaredCharacters.push({
        name: cleanName,
        description: description ? description.trim() : undefined
      });
    }
  };

  // 1. Detect where the first scene begins
  // Strict rule: Explicit scene headers like "ฉากที่ 1:", "CLIP 1:", "Scene 1:" or "STORY: {"
  const sceneHeaderRegex = /^(?:\[?(?:CLIP|ฉากที่|ฉาก|SCENE)\s*0*(\d+)\]?[:.]?\s*(.*)|STORY\s*[:{]\s*(.*))$/i;

  let firstSceneIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] && sceneHeaderRegex.test(lines[i])) {
      firstSceneIndex = i;
      break;
    }
  }

  const metadataLines: string[] = [];
  const sceneLines: string[] = [];

  if (firstSceneIndex !== -1) {
    // All lines before firstSceneIndex are strictly METADATA!
    // Under NO circumstances should these create clips or dialogue!
    for (let i = 0; i < firstSceneIndex; i++) {
      if (lines[i]) metadataLines.push(lines[i]);
    }
    for (let i = firstSceneIndex; i < lines.length; i++) {
      if (lines[i]) sceneLines.push(lines[i]);
    }
  } else {
    // No explicit scene header found.
    // Partition leading metadata from narrative body.
    let inLeadingMetadata = true;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      if (inLeadingMetadata) {
        if (
          line.startsWith('@SALA') ||
          /^(?:ชื่อเรื่อง|เรื่อง|TITLE|ตัวละคร|ตัวละครหลัก|รายชื่อตัวละคร|CHARACTERS|สถานที่|สถานที่หลัก|LOCATION|เวลา|ช่วงเวลา|TIME|แสง|LIGHTING|สไตล์|STYLE|อุปกรณ์|พร็อพ|PROPS|LOCK|CONT|FRAME|AUTO|RULE|NO|OUT)\s*[:：=]/i.test(line)
        ) {
          metadataLines.push(line);
        } else if (metadataLines.length > 0 && /^[-\*•\d.]*\s*[ก-๙a-zA-Z0-9_\s]{1,30}[:：]/.test(line)) {
          // Additional metadata in character block
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

  // 2. PARSE METADATA SECTION
  let inCharacterSection = false;
  let pendingCharacterName: string | null = null;

  for (let i = 0; i < metadataLines.length; i++) {
    const line = metadataLines[i];
    if (!line) continue;

    // Check @SALA protocol header
    if (line.startsWith('@SALA')) {
      const proto = parseSalaProtocolHeader(line);
      if (proto) {
        metadata.protocol = proto;
        metadata.rawHeader = line;
      }
      continue;
    }

    // Check Title
    const titleMatch = line.match(/^(?:ชื่อเรื่อง|เรื่อง|TITLE)\s*[:：=]\s*(.*)$/i);
    if (titleMatch) {
      if (pendingCharacterName) { addDeclaredCharacter(pendingCharacterName); pendingCharacterName = null; }
      inCharacterSection = false;
      metadata.title = titleMatch[1].trim();
      continue;
    }

    // Check Location
    const locMatch = line.match(/^(?:สถานที่หลัก|สถานที่ถ่ายทำ|สถานที่|LOCATION)\s*[:：=]\s*(.*)$/i);
    if (locMatch) {
      if (pendingCharacterName) { addDeclaredCharacter(pendingCharacterName); pendingCharacterName = null; }
      inCharacterSection = false;
      metadata.location = locMatch[1].trim();
      metadata.lockDirectives['location'] = locMatch[1].trim();
      continue;
    }

    // Check Time
    const timeMatch = line.match(/^(?:เวลา|ช่วงเวลา|บรรยากาศ|TIME)\s*[:：=]\s*(.*)$/i);
    if (timeMatch) {
      if (pendingCharacterName) { addDeclaredCharacter(pendingCharacterName); pendingCharacterName = null; }
      inCharacterSection = false;
      metadata.timeOfDay = timeMatch[1].trim();
      metadata.lockDirectives['time'] = timeMatch[1].trim();
      continue;
    }

    // Check Lighting
    const lightMatch = line.match(/^(?:แสง|การจัดแสง|LIGHTING)\s*[:：=]\s*(.*)$/i);
    if (lightMatch) {
      if (pendingCharacterName) { addDeclaredCharacter(pendingCharacterName); pendingCharacterName = null; }
      inCharacterSection = false;
      metadata.lighting = lightMatch[1].trim();
      metadata.lockDirectives['lighting'] = lightMatch[1].trim();
      continue;
    }

    // Check Style
    const styleMatch = line.match(/^(?:สไตล์|สไตล์ภาพ|โทนภาพ|STYLE)\s*[:：=]\s*(.*)$/i);
    if (styleMatch) {
      if (pendingCharacterName) { addDeclaredCharacter(pendingCharacterName); pendingCharacterName = null; }
      inCharacterSection = false;
      metadata.style = styleMatch[1].trim();
      metadata.lockDirectives['style'] = styleMatch[1].trim();
      continue;
    }

    // Check Props
    const propsMatch = line.match(/^(?:อุปกรณ์|พร็อพ|สิ่งของ|PROPS)\s*[:：=]\s*(.*)$/i);
    if (propsMatch) {
      if (pendingCharacterName) { addDeclaredCharacter(pendingCharacterName); pendingCharacterName = null; }
      inCharacterSection = false;
      metadata.props = propsMatch[1].trim();
      metadata.lockDirectives['props'] = propsMatch[1].trim();
      continue;
    }

    // Check Reserved System Directives (LOCK, CONT, FRAME, etc.)
    const reservedMatch = line.match(/^([A-Z_]+)\s*[:：=]\s*(.*)$/i);
    if (reservedMatch && RESERVED_KEYWORD_SET.has(reservedMatch[1].toUpperCase())) {
      const kw = reservedMatch[1].toUpperCase();
      const val = reservedMatch[2].trim();

      if (pendingCharacterName) { addDeclaredCharacter(pendingCharacterName); pendingCharacterName = null; }
      inCharacterSection = false;

      if (kw === 'LOCK') {
        const pairs = val.split('|').map(p => p.trim());
        for (const p of pairs) {
          const colonIdx = p.indexOf(':');
          if (colonIdx > 0) {
            const k = p.substring(0, colonIdx).trim().toLowerCase();
            const v = p.substring(colonIdx + 1).trim();
            metadata.lockDirectives[k] = v;
          } else {
            metadata.lockDirectives[p.toLowerCase()] = p;
          }
        }
      } else if (kw === 'CONT') {
        metadata.contDirectives['instruction'] = val;
      } else if (kw === 'FRAME') {
        metadata.frameDirectives['format'] = val;
      } else if (kw === 'AUTO') {
        metadata.autoDirectives['mode'] = val;
      } else if (kw === 'RULE') {
        metadata.ruleDirectives.push(val);
      } else if (kw === 'NO') {
        metadata.noDirectives.push(val);
      } else if (kw === 'OUT') {
        metadata.outDirectives['format'] = val;
      }
      continue;
    }

    // Check Character Section Header
    const charHeaderMatch = line.match(/^(?:ตัวละครหลัก|ตัวละคร|รายชื่อตัวละคร|CHARACTERS)\s*[:：]?\s*(.*)$/i);
    if (charHeaderMatch) {
      if (pendingCharacterName) { addDeclaredCharacter(pendingCharacterName); pendingCharacterName = null; }
      inCharacterSection = true;
      const inlineChars = charHeaderMatch[1].trim();
      if (inlineChars) {
        const parts = inlineChars.split(/[,;|]/).map(p => p.trim()).filter(Boolean);
        for (const p of parts) {
          const matchP = p.match(/^([^(:]+)(?:[:\(](.*)\)?)?/);
          if (matchP) {
            addDeclaredCharacter(matchP[1].trim(), matchP[2]?.replace(/[)]$/, '').trim());
          }
        }
      }
      continue;
    }

    // If inside character section
    if (inCharacterSection) {
      // Check if line defines a character: e.g. "ฟ้าใส:" or "ฟ้าใส: หญิงอายุ 24 ปี..." or "- ฟ้าใส: หญิงอายุ 24..."
      const charLineMatch = line.match(/^(?:[-*•\d.]*\s*)?([ก-๙a-zA-Z0-9_\s]{1,30})[:：]\s*(.*)$/);
      if (charLineMatch) {
        const candidateName = charLineMatch[1].trim();
        const candidateDesc = charLineMatch[2].trim();

        if (isReservedSystemKeyword(candidateName) || isMetadataKeyword(candidateName)) {
          if (pendingCharacterName) { addDeclaredCharacter(pendingCharacterName); pendingCharacterName = null; }
          inCharacterSection = false;
          continue;
        }

        if (pendingCharacterName) {
          addDeclaredCharacter(pendingCharacterName);
          pendingCharacterName = null;
        }

        if (candidateDesc) {
          // Single-line definition: ฟ้าใส: หญิงอายุ 24 ปี บุคลิกสุภาพ ใจเย็น
          addDeclaredCharacter(candidateName, candidateDesc);
        } else {
          // Multi-line definition: ฟ้าใส: (description will follow on next line)
          pendingCharacterName = candidateName;
        }
        continue;
      }

      // Dash format: "- พี่ทุย — ผู้ชายใจร้อน ..." / "พี่ทุย - ผมสั้น ..." (name, then description)
      const charDashMatch = line.match(/^(?:[-*•\d.]*\s*)?([ก-๙a-zA-Z0-9_ ]{1,30}?)\s*(?:[—–]|\s-\s)\s*(.+)$/);
      if (charDashMatch && !isReservedSystemKeyword(charDashMatch[1].trim()) && !isMetadataKeyword(charDashMatch[1].trim())) {
        if (pendingCharacterName) { addDeclaredCharacter(pendingCharacterName); pendingCharacterName = null; }
        addDeclaredCharacter(charDashMatch[1].trim(), charDashMatch[2].trim());
        continue;
      }

      // Check parenthesized format: e.g. "ฟ้าใส (หญิงอายุ 24 ปี...)"
      const charParenMatch = line.match(/^(?:[-*•\d.]*\s*)?([ก-๙a-zA-Z0-9_\s]{1,30})\s*\((.*)\)$/);
      if (charParenMatch) {
        if (pendingCharacterName) { addDeclaredCharacter(pendingCharacterName); pendingCharacterName = null; }
        addDeclaredCharacter(charParenMatch[1].trim(), charParenMatch[2].trim());
        continue;
      }

      // If pending character waiting for description
      if (pendingCharacterName) {
        // This line is the character's description!
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

  // 3. PARSE SCENE SECTION (Scene 1 -> Clip 1, Scene 2 -> Clip 2, Scene 3 -> Clip 3)
  const rawClips: ParsedRawClip[] = [];
  let currentClip: ParsedRawClip | null = null;
  let autoClipNumber = 1;

  const declaredNameSet = new Set(
    metadata.declaredCharacters.map(c => c.name.toLowerCase().trim())
  );
  // Speaker -> declared character: exact name (case-insensitive), or the name followed by a
  // speech verb ("น้องน้ำกระซิบ"). No two-way substring matching.
  const resolveDeclaredSpeaker = (candidate: string) => {
    const lower = candidate.toLowerCase().trim();
    const exact = metadata.declaredCharacters.find(c => c.name.toLowerCase() === lower);
    if (exact) return exact;
    const normalized = normalizeSpeakerForDedupe(candidate, metadata.declaredCharacters.map(c => c.name)).toLowerCase();
    return metadata.declaredCharacters.find(c => c.name.toLowerCase() === normalized);
  };

  for (let i = 0; i < sceneLines.length; i++) {
    const rawLine = sceneLines[i];
    if (!rawLine) continue;

    // Check for explicit Scene Header:
    // e.g. "ฉากที่ 1:", "ฉาก 1:", "CLIP 1:", "SCENE 1:", "STORY: {"
    const headerMatch = rawLine.match(/^(?:\[?(?:CLIP|ฉากที่|ฉาก|SCENE)\s*0*(\d+)\]?[:.]?\s*(.*)|STORY\s*[:{]\s*(.*))$/i);
    if (headerMatch) {
      if (currentClip) {
        rawClips.push(currentClip);
      }
      const num = headerMatch[1] ? parseInt(headerMatch[1], 10) : autoClipNumber;
      autoClipNumber = num + 1;
      const sceneTitle = (headerMatch[2]?.trim() || headerMatch[3]?.trim() || '').replace(/^[—–\-:：]\s*/, '') || `ฉากที่ ${num}`;

      currentClip = {
        clipNumber: num,
        title: sceneTitle.startsWith('ฉากที่') || sceneTitle.startsWith('Clip') ? sceneTitle : `ฉากที่ ${num}: ${sceneTitle}`,
        actions: [],
        cameraDirectives: [],
        dialogues: []
      };

      // If the header line had action text on the same line after the scene number:
      // e.g. "ฉากที่ 1: ฟ้าใสนั่งจิบกาแฟริมหน้าต่าง มองสายฝนที่โปรยปราย"
      const restText = (headerMatch[2]?.trim() || '').replace(/^[—–\-:：]\s*/, '');
      // "หน้าบ้าน / ช่วงเย็น", "หน้าบ้านต่อเนื่อง", "คืนดีกัน" are headings (place / time / title), not actions
      const looksLikeHeading = /\s[\/|]\s?|\s?[\/|]\s|\s[-–—]\s/.test(restText) ||
        /(?:ต่อเนื่อง|\(ต่อ\))$/.test(restText) ||
        (!/\s/.test(restText) && restText.length <= 24 && !/["“”]/.test(restText) &&
          !/(เดิน|วิ่ง|นั่ง|ยืน|มอง|หัน|จับ|ยิ้ม|พูด|ถือ|เปิด|ปิด|กอด|ร้อง|หยิบ|walk|run|sit|stand|look)/i.test(restText));
      if (restText && !looksLikeHeading && !restText.match(/^(?:ฉากที่|Clip|Scene)\s*\d+$/i)) {
        currentClip.actions.push(restText);
        (currentClip.sequence ||= []).push({ kind: 'action', index: currentClip.actions.length - 1 });
      }
      continue;
    }

    // Check for STORY end delimiter
    if (rawLine === '}' || rawLine === 'END_STORY') {
      continue;
    }

    // If no scene header has been encountered (e.g. no explicit "ฉากที่" in script):
    if (!currentClip) {
      currentClip = {
        clipNumber: autoClipNumber++,
        title: `ฉากที่ ${autoClipNumber - 1}`,
        actions: [],
        cameraDirectives: [],
        dialogues: []
      };
    }

    // Check for character positions directive: (ตำแหน่งตัวละคร: ...) or (ตำแหน่ง: ...) or POSITION: ...
    const posMatch = rawLine.match(/^(?:\(?(?:ตำแหน่งตัวละคร|ตำแหน่ง|POSITION|SPATIAL_LOCK)\)?)\s*[:：]\s*(.*)$/i);
    if (posMatch) {
      currentClip.characterPositions = posMatch[1].replace(/\)$/, '').trim();
      continue;
    }

    // Check for start action directive: (เริ่มต้น: ...) or (จุดเริ่ม: ...) or START: ...
    const startMatch = rawLine.match(/^(?:\(?(?:เริ่มต้น|จุดเริ่มต้น|จุดเริ่ม|START)\)?)\s*[:：]\s*(.*)$/i);
    if (startMatch) {
      currentClip.startAction = startMatch[1].replace(/\)$/, '').trim();
      continue;
    }

    // Check for END: or END_STATE: directive or (สิ้นสุดฉาก: ...) or (จบฉาก: ...)
    // STRICT RULE: END is NEVER treated as dialogue!
    const endMatch = rawLine.match(/^(?:END(?:_STATE)?|\(?(?:สิ้นสุดฉาก|จบฉาก|สิ้นสุด)\)?)\s*[:：]\s*(.*)$/i);
    if (endMatch) {
      currentClip.endState = endMatch[1].replace(/\)$/, '').trim();
      continue;
    }

    // Check for Camera directive
    const cameraMatch = rawLine.match(/^(?:CAMERA|กล้อง|มุมกล้อง)\s*[:：]\s*(.*)$/i);
    if (cameraMatch) {
      currentClip.cameraDirectives.push(cameraMatch[1].trim());
      continue;
    }

    // Check for Multi-line Dialogue: Speaker: on line 1, Quote on line 2
    const speakerOnlyMatch = rawLine.match(/^([ก-๙a-zA-Z0-9_\-]+)\s*(?:\(([^)]*)\))?\s*[:：]$/);
    if (speakerOnlyMatch && i + 1 < sceneLines.length) {
      const nextLine = sceneLines[i + 1].trim();
      const quoteMatch = nextLine.match(/^["“'‘«「]([^"”'’»」]+)["”'’»」]$/);
      if (quoteMatch) {
        const candidateSpeaker = speakerOnlyMatch[1].trim();
        const emotionTone = speakerOnlyMatch[2]?.trim() || 'ตามบทต้นฉบับ';
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
          (currentClip.sequence ||= []).push({ kind: 'dialogue', index: currentClip.dialogues.length - 1 });
          i++; // Skip quote line
          continue;
        }
      }
    }

    // Check for Dialogue line (supporting optional emotion/action in parentheses before colon)
    // e.g. "ภพ (น้ำเสียงดุดัน): 'บทพูด'" or "ภพ: 'บทพูด'"
    const dialogueMatch = rawLine.match(/^([ก-๙a-zA-Z0-9_\s]{1,30})(?:\s*\(([^)]+)\))?[:：]\s*["“'‘«「]([^"”'’»」]+)["”'’»」]\s*$/);
    if (dialogueMatch) {
      const candidateSpeaker = dialogueMatch[1].trim();
      const emotionTone = dialogueMatch[2]?.trim() || 'ตามบทต้นฉบับ';
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
          (currentClip.sequence ||= []).push({ kind: 'dialogue', index: currentClip.dialogues.length - 1 });
          continue;
        }
      }
    }

    // Otherwise, treat as narrative action
    currentClip.actions.push(rawLine);
    (currentClip.sequence ||= []).push({ kind: 'action', index: currentClip.actions.length - 1 });
  }

  if (currentClip) {
    rawClips.push(currentClip);
  }

  // If no explicit scene headers existed, and only 1 big clip was created with multiple lines,
  // split into requested defaultClipCount
  const targetCount = options?.defaultClipCount || (metadata.protocol?.clipRange ? (metadata.protocol.clipRange.endClip - metadata.protocol.clipRange.startClip + 1) : 0);
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
      const sliceText = slice.join(' ');
      const clipDiags = singleClip.dialogues.filter(d => sliceText.includes(d.speaker) || (c === targetCount - 1 && d.clipNumber === 1));

      rawClips.push({
        clipNumber: clipNum,
        title: `ฉากที่ ${clipNum}`,
        actions: slice,
        cameraDirectives: singleClip.cameraDirectives,
        dialogues: clipDiags.map(d => ({ ...d, clipNumber: clipNum }))
      });
    }
  }

  const allDetectedCharacters = Array.from(
    new Set([
      ...metadata.declaredCharacters.map(c => c.name),
      ...rawClips.flatMap(c => c.dialogues.map(d => d.speaker))
    ])
  ).filter(name => !isReservedSystemKeyword(name) && !isMetadataKeyword(name));

  return {
    metadata,
    clips: rawClips,
    storyTextClean: sceneLines.join('\n'),
    detectedCharacters: allDetectedCharacters,
    totalClips: rawClips.length
  };
}

// ==========================================
// 5. MULTI-CLIP PROMPT BUILDER (1 Clip = 1 Prompt)
// ==========================================

export interface BuildPromptsOptions {
  scriptText: string;
  clipDurationSeconds: number;
  clipCount: number;
  continuityLock: MasterContinuityLock;
  dialogues?: DialogueLockEntry[];
  audioDirectives?: AudioDirectives;
  knownCharacters?: string[];
  /** Character data (UI character library / API): name + face / hair / outfit / appearance */
  characters?: CharacterAppearanceInput[];
  /** Location library (lock payloads). When given, the clip location is locked to the library card. */
  locations?: LocationLockInput[];
  /** Density auto-split (default true). See DIALOGUE_DENSITY_RULE. */
  autoSplitDense?: boolean;
  densityRule?: Partial<DialogueDensityRule>;
}

/**
 * Derives continuous physical START_STATE and END_STATE from each scene's OWN
 * narrative action and dialogue (no story-specific hard-coded cases).
 * - START_STATE of scene N = END_STATE of scene N-1 (seamless handoff).
 * - END_STATE = the scene's own last beat: its last spoken line (if the scene
 *   ends on dialogue) or its last action sentence.
 */
export function deriveScenePhysicalStates({
  sceneIndex,
  cleanAction,
  dialogues = [],
  sceneActiveChars = [],
  location = "",
  timeOfDay = "",
  prevSceneEndState = "",
  endsWithDialogue,
  actionBeats
}: {
  sceneIndex: number;
  cleanAction: string;
  dialogues?: { speaker: string; emotionOrAction?: string; dialogue: string; offScreen?: boolean }[];
  sceneActiveChars?: string[];
  location?: string;
  timeOfDay?: string;
  prevSceneEndState?: string;
  /** true when the scene's last beat is a dialogue line (defaults to "has dialogue and no action") */
  endsWithDialogue?: boolean;
  /** Individual action lines of the scene, in order (preferred over sentence-splitting cleanAction) */
  actionBeats?: string[];
}): { startState: string; endState: string } {
  const UNSPEC = "ไม่ระบุจากต้นฉบับ";
  const place = location && location !== UNSPEC ? location : "";
  const time = timeOfDay && timeOfDay !== UNSPEC ? timeOfDay : "";
  const charsLabel = sceneActiveChars.filter(Boolean).join(" และ ");
  const action = (cleanAction || "").replace(/^\[[^\]]*\]\s*/, "").trim();
  const beatList = (actionBeats || []).map(b => (b || "").trim()).filter(Boolean);
  const sentences = beatList.length > 0 ? beatList : action
    .split(/(?<=[.!?。])\s+|\n+|\s{2,}/)
    .map(s => s.trim())
    .filter(Boolean);
  const firstSentence = sentences[0] || action;
  const lastSentence = sentences[sentences.length - 1] || action;
  const lastDiag = dialogues.length > 0 ? dialogues[dialogues.length - 1] : null;
  const endOnDialogue = endsWithDialogue ?? (!!lastDiag && !action);

  // START_STATE: seamless handoff from the previous scene's ending
  let startState = "";
  if (prevSceneEndState && prevSceneEndState.trim()) {
    startState = prevSceneEndState.trim();
  } else if (firstSentence) {
    startState = firstSentence;
  } else {
    startState = [charsLabel, place ? `ที่${place}` : "", time].filter(Boolean).join(" ") || "เปิดฉาก";
  }

  // END_STATE: this scene's own last beat
  let endState = "";
  if (endOnDialogue && lastDiag) {
    const others = sceneActiveChars.filter(c => c && c !== lastDiag.speaker);
    const who = lastDiag.offScreen ? `${lastDiag.speaker} (เสียงนอกจอ)` : lastDiag.speaker;
    const delivery = lastDiag.emotionOrAction ? ` ${lastDiag.emotionOrAction}` : "";
    endState = `${who}${delivery} เพิ่งพูดจบว่า "${lastDiag.dialogue}"` +
      (others.length > 0 ? ` ขณะที่${others.join(" และ ")}หันมาตอบสนองต่อคำพูดนั้น` : "");
  } else if (lastSentence) {
    endState = `ภาพค้างที่ช่วงท้ายของการกระทำ: ${lastSentence}`;
  } else if (lastDiag) {
    endState = `${lastDiag.speaker} พูดจบ: "${lastDiag.dialogue}"`;
  } else {
    endState = [charsLabel, place ? `ที่${place}` : "", time].filter(Boolean).join(" ") || "จบช็อตอย่างต่อเนื่อง";
  }

  void sceneIndex;
  return { startState, endState };
}

// ==========================================
// 5.1 DIALOGUE DENSITY RULE (auto-split dense scenes)
// ==========================================
/**
 * DENSITY RULE (PROD-FIX2-0927), documented & configurable:
 *   spokenChars(line)   = characters of the line excluding spaces, punctuation and Thai
 *                         combining marks (upper/lower vowels, tone marks)
 *   speechSeconds(line) = spokenChars / thaiCharsPerSecond (12 chars/s ≈ 5 syllables/s,
 *                         natural Thai drama pace) + perLineOverheadSeconds (0.6 s turn-taking)
 *   budget              = budgetRatio (0.8) × clipDurationSeconds   (leave room for action)
 *   maxLines            = round(maxLinesPer10s (3) × clipDurationSeconds / 10)
 * A scene is split when Σ speechSeconds > budget OR its line count > maxLines.
 * parts = max(ceil(Σ/budget), ceil(lines/maxLines)), capped at maxParts and the line count.
 * Dialogue is divided IN ORDER at the boundary closest to equal speech time, preferring a
 * natural boundary (an action line between two dialogue lines). Actions before the first
 * line go to part 1, actions between two parts close the earlier part (its end pose hands
 * off to the next part's start pose), actions after the last line go to the last part.
 * The auto-split INCREASES the clip count (clipCount = number of source scenes requested);
 * the result reports requested vs final count (see summarizeAutoSplit).
 */
export interface DialogueDensityRule {
  thaiCharsPerSecond: number;
  perLineOverheadSeconds: number;
  budgetRatio: number;
  maxLinesPer10s: number;
  maxParts: number;
}
export const DIALOGUE_DENSITY_RULE: DialogueDensityRule = {
  thaiCharsPerSecond: 12,
  perLineOverheadSeconds: 0.6,
  budgetRatio: 0.8,
  maxLinesPer10s: 3,
  maxParts: 4
};

export function countSpokenChars(line: string): number {
  return String(line || '')
    .replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '')
    .replace(/[\s"'“”‘’.,!?…:;()\[\]\-–—ๆ]/g, '')
    .length;
}

export function estimateSpeechSeconds(lines: string[], rule: DialogueDensityRule = DIALOGUE_DENSITY_RULE): number {
  const secs = (lines || []).reduce((sum, l) => sum + countSpokenChars(l) / rule.thaiCharsPerSecond + rule.perLineOverheadSeconds, 0);
  return Math.round(secs * 10) / 10;
}

export interface DensityCheck {
  lines: number;
  estimatedSeconds: number;
  budgetSeconds: number;
  maxLines: number;
  parts: number;
  reason: string;
}

export function checkDialogueDensity(lines: string[], clipDurationSeconds: number, rule: DialogueDensityRule = DIALOGUE_DENSITY_RULE): DensityCheck {
  const est = estimateSpeechSeconds(lines, rule);
  const budget = Math.round(rule.budgetRatio * clipDurationSeconds * 10) / 10;
  const maxLines = Math.max(1, Math.round(rule.maxLinesPer10s * clipDurationSeconds / 10));
  const n = lines.length;
  let parts = Math.max(Math.ceil(est / budget), Math.ceil(n / maxLines), 1);
  parts = Math.max(1, Math.min(parts, rule.maxParts, Math.max(1, n)));
  const reasons: string[] = [];
  if (est > budget) reasons.push(`บทพูดประมาณ ${est} วินาที เกิน ${budget} วินาที (80% ของ ${clipDurationSeconds} วินาที)`);
  if (n > maxLines) reasons.push(`${n} บรรทัด เกิน ${maxLines} บรรทัดต่อคลิป ${clipDurationSeconds} วินาที`);
  return { lines: n, estimatedSeconds: est, budgetSeconds: budget, maxLines, parts: reasons.length > 0 ? parts : 1, reason: reasons.join(' และ ') };
}

interface SceneUnitForSplit {
  raw: ParsedRawClip;
  dialogues: DialogueLockEntry[];
  sequence?: Array<{ kind: 'action' | 'dialogue'; index: number }>;
}
interface SplitPiece {
  raw: ParsedRawClip;
  dialogues: DialogueLockEntry[];
  splitPart?: { sourceSceneNumber: number; part: number; total: number; reason: string };
}

/** Splits one dense scene into parts (see DENSITY RULE). Returns [unit] when it fits. */
export function splitDenseScene(
  unit: SceneUnitForSplit,
  clipDurationSeconds: number,
  sourceSceneNumber: number,
  rule: DialogueDensityRule = DIALOGUE_DENSITY_RULE
): SplitPiece[] {
  const { raw, dialogues } = unit;
  const check = checkDialogueDensity(dialogues.map(d => d.line || ''), clipDurationSeconds, rule);
  if (check.parts <= 1 || dialogues.length < 2) return [{ raw, dialogues }];
  const n = check.parts;
  const L = dialogues.length;
  const secs = dialogues.map(d => estimateSpeechSeconds([d.line || ''], rule));
  const total = secs.reduce((a, b) => a + b, 0);
  const seq = unit.sequence && unit.sequence.length > 0 ? unit.sequence : null;
  // natural[k]: an action line sits between dialogue k-1 and dialogue k
  const natural = new Array(L).fill(false);
  if (seq) {
    let lastD = -1; let actionSince = false;
    for (const b of seq) {
      if (b.kind === 'dialogue') { if (lastD >= 0 && actionSince) natural[b.index] = true; lastD = b.index; actionSince = false; }
      else actionSince = true;
    }
  }
  const cuts: number[] = []; // cut before dialogue index k
  let prev = 0;
  for (let p = 1; p < n; p++) {
    const target = (total * p) / n;
    let best = -1; let bestScore = Infinity;
    for (let k = prev + 1; k <= L - (n - p); k++) {
      const cum = secs.slice(0, k).reduce((a, b) => a + b, 0);
      const linesInPart = k - prev;
      const score = Math.abs(cum - target) - (natural[k] ? 1.0 : 0) + Math.max(0, linesInPart - check.maxLines) * 5;
      if (score < bestScore) { bestScore = score; best = k; }
    }
    cuts.push(best); prev = best;
  }
  const partOfDialogue = (k: number) => cuts.filter(c => k >= c).length;
  const partActions: string[][] = Array.from({ length: n }, () => []);
  if (seq) {
    let lastPart = 0; let seenDialogue = false;
    const pendingBetween: string[] = [];
    for (const b of seq) {
      if (b.kind === 'dialogue') {
        const part = partOfDialogue(b.index);
        // actions between two dialogue lines: stay with the earlier line's part (closing beat)
        partActions[seenDialogue ? lastPart : part].push(...pendingBetween);
        pendingBetween.length = 0;
        lastPart = part; seenDialogue = true;
      } else {
        const a = raw.actions[b.index];
        if (a) { if (!seenDialogue) partActions[0].push(a); else pendingBetween.push(a); }
      }
    }
    partActions[n - 1].push(...pendingBetween);
  } else {
    // No beat order known: first action opens part 1, last action closes the last part, others split evenly
    raw.actions.forEach((a, i) => {
      const part = raw.actions.length === 1 ? 0 : Math.min(n - 1, Math.floor((i / raw.actions.length) * n));
      partActions[part].push(a);
    });
  }
  const bounds = [0, ...cuts, L];
  return Array.from({ length: n }, (_, p) => {
    const partDialogues = dialogues.slice(bounds[p], bounds[p + 1]);
    const speakers = Array.from(new Set(partDialogues.map(d => d.speaker)));
    const actions = partActions[p].length > 0
      ? partActions[p]
      : [`${speakers.join(' และ ')} สนทนาต่อเนื่องจากคลิปก่อน ในตำแหน่งเดิม`];
    const title = raw.title || `ฉากที่ ${sourceSceneNumber}`;
    return {
      raw: {
        ...raw,
        title: `${title} (ตอนที่ ${p + 1}/${n})`,
        actions,
        dialogues: partDialogues,
        sequence: undefined,
        startAction: p === 0 ? raw.startAction : undefined,
        endState: p === n - 1 ? raw.endState : undefined
      },
      dialogues: partDialogues,
      splitPart: { sourceSceneNumber, part: p + 1, total: n, reason: check.reason }
    };
  });
}

/** Requested vs final clip count after the density auto-split. */
export function summarizeAutoSplit(clips: DirectedClipItem[], requestedClipCount: number) {
  const bySource = new Map<number, DirectedClipItem[]>();
  clips.forEach(c => { if (c.splitPart) bySource.set(c.splitPart.sourceSceneNumber, [...(bySource.get(c.splitPart.sourceSceneNumber) || []), c]); });
  return {
    requestedClipCount,
    finalClipCount: clips.length,
    autoSplitApplied: bySource.size > 0,
    splitScenes: Array.from(bySource.entries()).map(([sourceSceneNumber, parts]) => ({
      sourceSceneNumber,
      parts: parts.length,
      clipNumbers: parts.map(p => p.clipNumber),
      reason: parts[0].splitPart?.reason || '',
      estimatedSpeechSeconds: parts.map(p => p.estimatedSpeechSeconds || 0)
    }))
  };
}

/**
 * Builds clean, seamless, production-ready prompts for each clip.
 * 1 clip = 1 prompt (a dense scene may become several clips, see DENSITY RULE).
 * Seamless handoff: END_STATE of clip N becomes START_STATE of clip N+1.
 * Strict: No internal metadata leaked into final provider prompts. No "OR" branches.
 */
export function buildSalaMultiClipPrompts(params: BuildPromptsOptions): DirectedClipItem[] {
  const {
    scriptText,
    clipDurationSeconds,
    clipCount,
    continuityLock,
    dialogues: explicitDialogues = [],
    audioDirectives
  } = params;
  const rule: DialogueDensityRule = { ...DIALOGUE_DENSITY_RULE, ...(params.densityRule || {}) };

  // Parse script with strict protocol parser
  const parsed = parseSalaScript(scriptText, {
    knownCharacters: expandCombinedCharacterNames([
      ...(params.knownCharacters || []),
      ...(continuityLock.characterNames || []),
      continuityLock.characterName
    ].filter(Boolean) as string[]),
    defaultClipCount: clipCount
  });

  const targetCount = Math.max(1, Math.min(20, clipCount || parsed.totalClips || 3));
  const rawClips = parsed.clips;

  // Align rawClips with targetCount
  const processedRawClips: ParsedRawClip[] = [];
  if (rawClips.length === targetCount) {
    processedRawClips.push(...rawClips);
  } else if (rawClips.length > targetCount) {
    processedRawClips.push(...rawClips.slice(0, targetCount));
  } else {
    // Fill remaining
    processedRawClips.push(...rawClips);
    const lastClip = rawClips[rawClips.length - 1];
    for (let i = rawClips.length; i < targetCount; i++) {
      processedRawClips.push({
        clipNumber: i + 1,
        title: `Clip ${i + 1}`,
        actions: [lastClip?.actions[0] || 'Continuing narrative sequence'],
        cameraDirectives: lastClip?.cameraDirectives || [],
        dialogues: []
      });
    }
  }

  // Extract clean continuity lock fields (NO placeholders)
  const charName = cleanFieldValue(continuityLock.characterName) ||
    cleanFieldValue(parsed.detectedCharacters[0]) ||
    '';
  const charAppearance = cleanFieldValue(continuityLock.characterAppearance);
  const location = cleanFieldValue(continuityLock.location);
  const timeOfDay = cleanFieldValue(continuityLock.timeOfDay);
  const lighting = cleanFieldValue(continuityLock.lighting);
  const visualStyle = cleanFieldValue(continuityLock.visualStyle) || 'Cinematic 8K, 35mm film, photorealistic';
  const cameraMovement = cleanFieldValue(continuityLock.cameraMovement) || 'Smooth cinematic tracking';
  const lensType = cleanFieldValue(continuityLock.lensType) || '35mm anamorphic prime lens';
  const props = cleanFieldValue(continuityLock.props);
  const position = cleanFieldValue(continuityLock.characterPosition) || 'center frame';

  // Character Lock with appearance: supplied characters (library) > Master Lock fields > script character list
  const lockSupplied: CharacterAppearanceInput[] = charName ? [{
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
  const suppliedChars: CharacterAppearanceInput[] = [...(params.characters || []).filter(c => c && c.name), ...lockSupplied];
  const lockCache = new Map<string, { text: string; warnings: string[] }>();
  const lockTextFor = (name: string) => {
    if (!lockCache.has(name)) {
      const r = buildCharacterAppearanceLock([name], suppliedChars, scriptDeclared);
      lockCache.set(name, { text: r.text, warnings: r.warnings });
    }
    return lockCache.get(name)!;
  };

  // Format clean Audio Directive summary
  const audioParts: string[] = [];
  if (audioDirectives?.voice?.enabled) {
    audioParts.push(`Voice: ${audioDirectives.voice.voiceType || 'Natural'}, Delivery: ${audioDirectives.voice.deliverySpeed || 'natural'}`);
  }
  if (audioDirectives?.music?.enabled) {
    audioParts.push(`Music: ${audioDirectives.music.genre || 'Cinematic'} (${audioDirectives.music.mood || 'Immersive'})`);
  }
  if (audioDirectives?.sfx?.enabled) {
    audioParts.push(`SFX: ${audioDirectives.sfx.ambientSounds || 'Natural ambience'}`);
  }
  const audioSummary = audioParts.length > 0 ? audioParts.join(' | ') : 'Audio: Ambient soundscape';

  const dedupeKnown = expandCombinedCharacterNames([
    ...(params.knownCharacters || []),
    ...(continuityLock.characterNames || []),
    continuityLock.characterName
  ].filter(Boolean) as string[]);

  // 1. Per source scene: merge parsed + explicit dialogues (dedupe), keep beat order
  const units: SceneUnitForSplit[] = processedRawClips.map((raw, i) => {
    const clipDialogues = [
      ...raw.dialogues,
      ...explicitDialogues.filter(d => Number(d.clipNumber) === i + 1)
    ].filter(d => d.speaker && !isReservedSystemKeyword(d.speaker));
    // Speakers normalized ("น้องฟ้าใสกระซิบ" = "น้องฟ้าใส"); same line text = one entry (real speaker wins)
    const uniqueDialogues = dedupeDialogueEntries(clipDialogues, dedupeKnown);
    let sequence = raw.sequence ? [...raw.sequence] : undefined;
    if (sequence) for (let k = raw.dialogues.length; k < uniqueDialogues.length; k++) sequence.push({ kind: 'dialogue', index: k });
    if (sequence && raw.dialogues.length > uniqueDialogues.length) sequence = undefined;
    return { raw, dialogues: uniqueDialogues, sequence };
  });

  // 2. Density rule: a scene whose dialogue does not fit one clip becomes several clips
  const pieces: SplitPiece[] = units.flatMap((u, i) =>
    params.autoSplitDense === false ? [{ raw: u.raw, dialogues: u.dialogues }] : splitDenseScene(u, clipDurationSeconds, u.raw.clipNumber || i + 1, rule));

  const outputClips: DirectedClipItem[] = [];

  for (let i = 0; i < pieces.length; i++) {
    const clipNum = i + 1;
    const { raw, dialogues: uniqueDialogues, splitPart } = pieces[i];
    const narrativeAction = raw.actions.join(' ').trim() || `Scene ${clipNum} narrative development`;

    const prevPosition = i > 0 && outputClips[i - 1]?.characterPositions ? outputClips[i - 1].characterPositions : null;
    const clipPosition = raw.characterPositions || prevPosition || position || 'ตำแหน่งตัวละครล็อคสอดคล้องต่อเนื่อง';

    // Determine characters active specifically in this clip
    const allKnownCandidates = Array.from(new Set([
      ...(params.knownCharacters || []),
      ...(continuityLock.characterNames || []),
      charName
    ])).filter(Boolean).filter(n => !isReservedSystemKeyword(n) && !isMetadataKeyword(n));

    const clipFullText = `${raw.title} ${raw.actions.join(' ')}`;
    const clipChars = allKnownCandidates.filter(n => {
      const firstName = n.split(' ')[0];
      return clipFullText.includes(n) || (firstName.length >= 2 && clipFullText.includes(firstName)) ||
        uniqueDialogues.some(d => d.speaker === n || d.speaker.includes(n) || d.line.includes(n));
    });
    const activeInClip = clipChars.length > 0 ? clipChars : (charName ? [charName] : []);

    // Start / End with seamless handoff (also across auto-split parts)
    const prevEndState = i > 0 && outputClips[i - 1] ? outputClips[i - 1].endAction : '';
    const { startState: clipStartState, endState: clipEndState } = deriveScenePhysicalStates({
      sceneIndex: i,
      cleanAction: narrativeAction,
      dialogues: uniqueDialogues.map(d => ({ speaker: d.speaker, dialogue: d.line, emotionOrAction: d.emotionTone })),
      sceneActiveChars: activeInClip,
      location,
      timeOfDay,
      prevSceneEndState: prevEndState,
      actionBeats: raw.actions
    });

    const startAction = raw.startAction || clipStartState;
    const endAction = raw.endState || clipEndState;

    // Construct Clean Final Provider Prompt (1 Clip = 1 Prompt)
    const promptSegments: string[] = [];
    promptSegments.push(visualStyle);
    if (location) promptSegments.push(`Location: ${location}`);
    if (continuityLock.locationVisualDetails) {
      promptSegments.push(`Architectural Environment: ${continuityLock.locationVisualDetails}`);
    }
    if (timeOfDay || lighting) {
      promptSegments.push(`Atmosphere: ${[timeOfDay, lighting].filter(Boolean).join(', ')}`);
    }

    // Character Lock: every on-screen character with face / hair / outfit (never a placeholder)
    const locks = activeInClip.map(n => lockTextFor(n));
    const characterLockText = locks.map(l => l.text).join(' | ');
    const appearanceWarnings = Array.from(new Set(locks.flatMap(l => l.warnings)));
    if (activeInClip.length > 0) {
      promptSegments.push(`Character Lock: ${characterLockText}, identical face, hair and outfit in every clip`);
    }
    // Two or more characters on screen: a single-subject default ("center frame") would contradict the cast
    const spatialText = activeInClip.length >= 2 && /^(?:cent(?:er|re)(?: frame)?|กลางเฟรม)$/i.test(String(clipPosition).trim())
      ? `${activeInClip.join(' and ')} together in frame, each where the Stance/Position Lock places them`
      : clipPosition;
    promptSegments.push(`Spatial Positioning Lock: ${spatialText}`);
    if (props) promptSegments.push(`Props: ${props}`);

    promptSegments.push(`Starting moment: ${startAction}`);
    promptSegments.push(`Core action: ${narrativeAction}`);
    promptSegments.push(`Ending momentum: ${endAction}`);

    const cameraStr = raw.cameraDirectives.length > 0
      ? raw.cameraDirectives.join(', ')
      : `${cameraMovement}, ${lensType}`;
    promptSegments.push(`Cinematography: ${cameraStr}`);

    if (uniqueDialogues.length > 0) {
      const dialogueText = uniqueDialogues
        .map(d => `${d.speaker} speaks: "${d.line}" (${d.emotionTone || 'natural emotion'})`)
        .join('. ');
      promptSegments.push(`Dialogue: ${dialogueText}`);
    }
    if (audioParts.length > 0) promptSegments.push(`Soundscape: ${audioSummary}`);

    const cleanFinalPrompt = promptSegments.join('. ') + '.';
    const negativePrompt = 'blurry, morphing, inconsistent costume, duplicate character, bad anatomy, text watermark, sudden jumpcut, flicker, low resolution';

    outputClips.push({
      clipNumber: clipNum,
      title: raw.title || `Clip ${clipNum}`,
      durationSeconds: clipDurationSeconds,
      sceneSummary: narrativeAction,
      startAction,
      endAction,
      characterPositions: clipPosition,
      dialogues: uniqueDialogues.map(d => ({ ...d, clipNumber: clipNum })),
      locationName: location || undefined,
      continuityLockSummary: [charName ? `Character: ${charName}` : '', location ? `Location: ${location}` : '', timeOfDay, lighting].filter(Boolean).join(' | ') || 'Continuity Locked',
      audioDirectiveSummary: audioSummary,
      generatedPrompt: cleanFinalPrompt,
      negativePrompt,
      characterLockText,
      appearanceWarnings,
      estimatedSpeechSeconds: estimateSpeechSeconds(uniqueDialogues.map(d => d.line || ''), rule),
      ...(splitPart ? { splitPart } : {})
    });
  }

  // Pose / Position Lock handoff + missing-character / pose-jump warnings, included in each prompt
  const lockedForContinuity = Array.from(new Set([
    ...(params.knownCharacters || []),
    ...(continuityLock.characterNames || []),
    ...(parsed.detectedCharacters || []),
    charName
  ].filter(Boolean) as string[]));
  const withContinuity = attachClipContinuity(outputClips, lockedForContinuity, {
    appendToPrompt: true,
    initialPoses: normalizePoseList((continuityLock as any).characterPositionLocks),
    location
  }).clips;
  // Every clip: Character Lock for every character present (library card wins) + reference line
  const withCharacters = enforceLibraryCharacterLocks(withContinuity, suppliedChars, scriptDeclared);
  // Location Lock from the location library (verbatim description + reference photo line)
  return enforceLibraryLocationLocks(withCharacters, params.locations, {
    selectedLocationId: continuityLock.locationId || undefined,
    lockedLocation: continuityLock.location || undefined,
    timeOfDay: continuityLock.timeOfDay || undefined,
    lighting: continuityLock.lighting || undefined
  });
}

const LOCK_TAIL = 'identical face, hair and outfit in every clip';
/** Library appearances may describe a default pose; the clip's pose always comes from the Stance/Position Lock. */
const POSE_RULE = 'pose/position: follow the Stance/Position Lock and the action of this clip (ignore any default pose of the library card)';

/**
 * Rewrites the Character Lock of each clip from the character library (source of truth):
 * every character present in the clip (continuity charactersPresent + on-screen names) gets
 * the library appearance / hair / outfit / shoes / tag, plus a "Reference image: ..." line when
 * the card has a reference. Any Character Lock text written by Gemini is replaced, not kept.
 * Missing appearance / missing reference image produce warnings on the clip.
 */
export function enforceLibraryCharacterLocks(
  clips: DirectedClipItem[],
  supplied: CharacterAppearanceInput[] = [],
  scriptDeclared: Array<{ name: string; description?: string }> = []
): DirectedClipItem[] {
  const libraryNames = (supplied || []).map(s => String(s?.name || '').trim()).filter(Boolean);
  return clips.map(c => {
    // Names from the previous lock text: only plausible names (a quoted / "label:" chunk is never a name)
    const previousNames = String(c.characterLockText || '').split(' | ')
      .map(t => t.replace(/\s*\(.*$/, '').trim())
      .filter(n => n && n.length <= 40 && !/[:";]/.test(n));
    const names = expandCombinedCharacterNames([...(c.charactersPresent || []), ...previousNames])
      .filter(n => n && !isReservedSystemKeyword(n) && !isMetadataKeyword(n));
    if (names.length === 0) return c;
    const r = buildCharacterAppearanceLock(names, supplied, scriptDeclared);
    const refLines = r.profiles.map(formatReferenceImageLine).filter(Boolean);
    const lockBlock = `Character Lock: ${r.text}, ${LOCK_TAIL}; ${POSE_RULE}.${refLines.length > 0 ? ` Reference image: ${refLines.join('; ')}.` : ''}`;

    let prompt = String(c.generatedPrompt || '');
    // 1) exact copies of this lock / the previous lock text (idempotent re-runs), 2) every
    //    "Character Lock:" section up to the next KNOWN section label (multi-sentence safe),
    // 3) character "Reference image:" sections (the location reference photo line is kept).
    prompt = stripExact(prompt, [lockBlock, String(c.characterLockText || '')]);
    const removed = removeSections(prompt, s => s.label === 'Character Lock' ||
      (s.label === 'Reference image' && !/reference photo — match exactly/.test(s.text)));
    prompt = removed.prompt;
    // Lock goes where the first lock was, but never after the action (server-appended locks sit at the end)
    const anchor = findSections(prompt).find(s => s.label === 'Spatial Positioning Lock' || s.label === 'Starting moment' || s.label === 'Core action');
    let insertAt = removed.firstIndex;
    if (insertAt === -1 || insertAt > prompt.length || (anchor && insertAt > anchor.start)) insertAt = anchor ? anchor.start : prompt.length;
    const MARK = '\u0000LOCK\u0000';
    prompt = `${prompt.slice(0, insertAt)}${MARK}${prompt.slice(insertAt)}`;
    // Looks invented outside the lock ("พี่ทุย (brown fur, red business suit)") are cut: the lock is the only source
    const stripped = stripInventedLooks(prompt, r.profiles.filter(p => p.hasAppearance).map(p => p.name).concat(libraryNames));
    const inventedWarnings = stripped.removed.map(x => `ตัดรูปลักษณ์ที่ไม่ได้มาจากคลังของ ${x.name} ออก: "(${x.text})" — ใช้ Character Lock จากคลังแทน / Removed a look not from the library for ${x.name}`);
    const at = stripped.prompt.indexOf(MARK);
    prompt = insertBlock(stripped.prompt.replace(MARK, ''), at, lockBlock);
    return {
      ...c,
      generatedPrompt: prompt,
      characterLockText: r.text,
      appearanceWarnings: Array.from(new Set([...r.warnings, ...inventedWarnings]))
    } as DirectedClipItem;
  });
}

const LOOK_WORD_RE = /\b(?:fur|furry|suit|shirt|t-shirt|dress|jeans|jacket|denim|hair|haired|skin|wearing|wears|outfit|pants|trousers|skirt|shoes|sneakers|boots|hat|cap|coat|hoodie|uniform|scales|horns|basket|tie|glasses|red|blue|green|black|white|brown|yellow|grey|gray|pink|purple|orange|golden|blonde)\b|ชุด|เสื้อ|กางเกง|กระโปรง|ทรงผม|ผมยาว|ผมสั้น|ขนสี|ขนฟู|สวมใส่|รองเท้า|หมวก|แว่นตา/i;

/** Cuts "NAME (look words...)" parentheticals attached to library character names. */
function stripInventedLooks(prompt: string, names: string[]): { prompt: string; removed: Array<{ name: string; text: string }> } {
  const removed: Array<{ name: string; text: string }> = [];
  let out = prompt;
  Array.from(new Set(names.filter(n => n && n.length >= 2))).forEach(name => {
    const re = new RegExp(`${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\(([^()]{1,200})\\)`, 'g');
    out = out.replace(re, (m, inner: string) => {
      // Inside the lock itself the parenthetical is the library entry: never touched (the lock is inserted afterwards)
      if (!LOOK_WORD_RE.test(inner)) return m;
      removed.push({ name, text: inner.trim() });
      return name;
    });
  });
  return { prompt: out, removed };
}

/**
 * Adds pose-handoff continuity to clips (from Gemini or the offline builder):
 * - charactersPresent / startPoses / endPoses per clip (Gemini values kept when given),
 * - start pose of clip N forced to the end pose of clip N-1,
 * - warnings for a locked character disappearing without leaving, or a pose/position jump,
 * - optional "Continuity Handoff" block appended to the prompt sent to the video model.
 */
export function attachClipContinuity(
  clips: DirectedClipItem[],
  lockedCharacters: string[],
  options: { appendToPrompt?: boolean; initialPoses?: CharacterPoseState[]; location?: string } = {}
): { clips: DirectedClipItem[]; warnings: ContinuityWarning[] } {
  const initialPoses = normalizePoseList(options.initialPoses);
  const locked = Array.from(new Set((lockedCharacters || [])
    .flatMap(n => String(n || '').split(/\s*,\s*/))
    .map(n => n.trim())
    .filter(n => n.length >= 2 && !isReservedSystemKeyword(n) && !isMetadataKeyword(n))));
  const analysis = analyzeClipContinuity({
    lockedCharacters: locked,
    initialPoses,
    clips: clips.map(c => ({
      text: `${c.sceneSummary || ''}`,
      speakers: (c.dialogues || []).map(d => d.speaker),
      location: c.locationName || options.location || '',
      sceneKey: (c as any).splitPart?.sourceSceneNumber != null ? `scene_${(c as any).splitPart.sourceSceneNumber}` : undefined
    }))
  });
  const filled = clips.map((c, i) => {
    const st = analysis.clips[i];
    const givenStart = normalizePoseList((c as any).startPoses);
    const givenEnd = normalizePoseList((c as any).endPoses);
    const givenPresent = Array.isArray((c as any).charactersPresent) ? (c as any).charactersPresent.filter((n: any) => typeof n === 'string' && n.trim()) : [];
    return {
      ...c,
      charactersPresent: Array.from(new Set([...givenPresent, ...(st?.charactersPresent || [])])),
      startPoses: givenStart.length > 0 ? givenStart : (st?.startPoses || []),
      endPoses: givenEnd.length > 0 ? givenEnd : (st?.endPoses || [])
    } as DirectedClipItem;
  });
  const handoff = enforcePoseHandoff(filled);
  const byIndexWarnings = analysis.warnings.map(w => ({ ...w, clipNumber: clips[w.clipNumber - 1]?.clipNumber || w.clipNumber }));
  const warnings = [...byIndexWarnings, ...handoff.warnings];
  const out = handoff.clips.map((c, i) => {
    const clipWarnings = warnings.filter(w => w.clipNumber === c.clipNumber);
    let generatedPrompt = c.generatedPrompt || '';
    if (options.appendToPrompt && !generatedPrompt.includes('Continuity Handoff:')) {
      const block = formatContinuityForPrompt({
        charactersPresent: c.charactersPresent || [],
        startPoses: c.startPoses || [],
        endPoses: c.endPoses || [],
        left: analysis.clips[i]?.left || []
      }, i === 0 && initialPoses.length === 0);
      if (block) generatedPrompt = `${generatedPrompt.replace(/\s+$/, '')}${/[.!?]$/.test(generatedPrompt.trim()) ? '' : '.'} Continuity Handoff: ${block}.`;
    }
    return { ...c, generatedPrompt, continuityWarnings: clipWarnings };
  });
  return { clips: out, warnings };
}

/**
 * Removes any placeholder text or forbidden strings from field values
 */
function cleanFieldValue(val?: string | null): string {
  if (!val) return '';
  let str = val.trim();
  for (const forbidden of FORBIDDEN_PLACEHOLDER_SUBSTRINGS) {
    if (containsForbiddenPlaceholder(str, forbidden)) {
      return '';
    }
  }
  return str;
}

// ==========================================
// 6. STRICT PROMPT VALIDATOR
// ==========================================

export interface PromptValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  issues: ContinuityIssue[];
}

/** Problems of a finished prompt: each lock / library entry / tag must appear exactly once. */
export function lockDuplicationProblems(clip: DirectedClipItem): string[] {
  const prompt = String(clip.generatedPrompt || '');
  const out: string[] = [];
  const locks = findSections(prompt).filter(s => s.label === 'Character Lock').length;
  if (locks > 1) out.push(`Character Lock ปรากฏ ${locks} ครั้ง (ต้องมีครั้งเดียว) / Character Lock appears ${locks} times`);
  const tails = countOccurrences(prompt, LOCK_TAIL);
  if (tails > 1) out.push(`ท้าย Character Lock ซ้ำ ${tails} ครั้ง — มีสำเนา Lock เก่าค้างอยู่ / orphaned copy of an old Character Lock`);
  const entries = String(clip.characterLockText || '').split(' | ').filter(e => e.length > 30);
  entries.forEach(e => {
    const n = countOccurrences(prompt, e);
    const name = e.replace(/\s*\(.*$/, '');
    if (n > 1) out.push(`ข้อมูลรูปลักษณ์จากคลังของ ${name} ซ้ำ ${n} ครั้ง / library appearance of ${name} repeated ${n}×`);
    // the longest field value (usually the appearance) must not be repeated outside the lock either
    const longest = (e.match(/(?:appearance|outfit|face): ("[^"]+"|[^;]+)/g) || []).map(v => v.replace(/^\w+: "?|"?$/g, '')).sort((a, b) => b.length - a.length)[0];
    if (longest && longest.length > 40) {
      const k = countOccurrences(prompt, longest.slice(0, 60));
      if (k > 1 && n <= 1) out.push(`ข้อความรูปลักษณ์ของ ${name} ปรากฏ ${k} ครั้ง / appearance text of ${name} appears ${k}×`);
    }
  });
  const tags = Array.from(new Set(String(clip.characterLockText || '').match(/\([^()\s]+_consistent_char:[\d.]+\)/g) || []));
  tags.forEach(t => {
    const n = countOccurrences(prompt, t);
    if (n > 1) out.push(`แท็ก ${t} ซ้ำ ${n} ครั้ง / tag repeated ${n}×`);
  });
  const locBlocks = countOccurrences(prompt, 'Location Lock (library, verbatim):');
  if (locBlocks > 1) out.push(`Location Lock ปรากฏ ${locBlocks} ครั้ง / Location Lock appears ${locBlocks} times`);
  return out;
}

export function validateSalaMultiClipPrompts(
  clips: DirectedClipItem[],
  declaredCharacters?: string[]
): PromptValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const issues: ContinuityIssue[] = [];

  const declaredSet = new Set(
    (declaredCharacters || []).map(c => c.trim().toLowerCase()).filter(Boolean)
  );

  clips.forEach((clip, idx) => {
    const clipNum = clip.clipNumber || (idx + 1);

    // Rule 1: Validate Dialogues for Reserved System Keywords
    clip.dialogues.forEach((d, dIdx) => {
      if (isReservedSystemKeyword(d.speaker)) {
        const msg = `Clip ${clipNum} มีการใช้ Reserved System Keyword "${d.speaker}" เป็นชื่อผู้พูดในบทพูด ห้ามใช้เป็นผู้พูดเด็ดขาด`;
        errors.push(msg);
        issues.push({
          id: `err_reserved_speaker_${clipNum}_${dIdx}`,
          clipNumber: clipNum,
          type: 'dialogue',
          severity: 'error',
          title: `Reserved Keyword "${d.speaker}" detected in dialogue`,
          description: msg,
          suggestion: 'ลบคำสั่งควบคุมระบบนี้ออกจากบทพูด หรือเปลี่ยนเป็นชื่อตัวละครจริง'
        });
      }

      // Rule 2: Dialogue speaker must be among declared characters if declared
      if (declaredSet.size > 0 && !isReservedSystemKeyword(d.speaker)) {
        const spLower = d.speaker.trim().toLowerCase();
        const isMatched = declaredSet.has(spLower) ||
          Array.from(declaredSet).some(ds => ds.includes(spLower) || spLower.includes(ds));
        if (!isMatched) {
          warnings.push(`Clip ${clipNum} ผู้พูด "${d.speaker}" ไม่ได้ถูกประกาศในรายชื่อตัวละคร (CHARACTERS)`);
          issues.push({
            id: `warn_undeclared_speaker_${clipNum}_${dIdx}`,
            clipNumber: clipNum,
            type: 'character',
            severity: 'warning',
            title: `ผู้พูด "${d.speaker}" ยังไม่ได้ประกาศใน CHARACTERS`,
            description: `ผู้พูด ${d.speaker} ปรากฏในบทพูดแต่ไม่อยู่ในรายชื่อตัวละครหลักที่ลงทะเบียนไว้`,
            suggestion: `เพิ่ม "${d.speaker}" ในรายการ CHARACTERS หรือเลือกตัวละครจากคลัง`
          });
        }
      }
    });

    // Rule 3: Check for Forbidden Placeholders in generatedPrompt
    FORBIDDEN_PLACEHOLDER_SUBSTRINGS.forEach(placeholder => {
      if (clip.generatedPrompt && containsForbiddenPlaceholder(clip.generatedPrompt, placeholder)) {
        const msg = `Clip ${clipNum} พบ Placeholder ที่ไม่อนุญาตใน Prompt: "${placeholder}"`;
        errors.push(msg);
        issues.push({
          id: `err_placeholder_${clipNum}_${placeholder}`,
          clipNumber: clipNum,
          type: 'props',
          severity: 'error',
          title: `พบข้อความขัดแย้ง/Placeholder "${placeholder}"`,
          description: msg,
          suggestion: 'ตัดข้อความเทมเพลตเดิมออก และใช้ข้อมูลจริงจากบทละคร'
        });
      }
    });

    // Rule 4: Verify Non-Empty Prompt
    if (!clip.generatedPrompt || clip.generatedPrompt.trim().length < 20) {
      errors.push(`Clip ${clipNum} มี Prompt ว่างเปล่าหรือสั้นเกินไป`);
    }

    // Rule 6: Pose handoff / missing character warnings computed by attachClipContinuity
    (clip.continuityWarnings || []).forEach((w, wIdx) => {
      warnings.push(w.message);
      issues.push({
        id: `warn_continuity_${clipNum}_${w.type}_${wIdx}`,
        clipNumber: clipNum,
        type: w.type === 'missing_character' ? 'character' : 'event_order',
        severity: 'warning',
        title: w.type === 'missing_character' ? `${w.character} หายไปจากคลิปโดยไม่ได้ออกจากฉาก` : `ท่าทาง/ตำแหน่งของ ${w.character} ไม่ต่อเนื่อง`,
        description: w.message,
        suggestion: w.type === 'missing_character'
          ? `ใส่ ${w.character} ในคลิปนี้ หรือเขียนในบทว่า ${w.character} เดินออกไป`
          : 'ให้ท่าเริ่มของคลิปนี้เท่ากับท่าจบของคลิปก่อน หรือเขียนการเคลื่อนไหว (ลุกขึ้น/นั่งลง/เดินไป) ในบท'
      });
    });

    // Rule 9: lock duplication (orphaned / repeated Character Lock, repeated tags or library text, doubled Location Lock)
    lockDuplicationProblems(clip).forEach((w, wIdx) => {
      const msg = `Clip ${clipNum}: ${w}`;
      warnings.push(msg);
      issues.push({
        id: `warn_lockdup_${clipNum}_${wIdx}`,
        clipNumber: clipNum,
        type: 'costume',
        severity: 'warning',
        title: 'Lock ซ้ำ / ค้างในพรอมต์',
        description: msg,
        suggestion: 'สร้าง Prompt ใหม่ — Character Lock / Location Lock ต้องมีครั้งเดียวต่อคลิป'
      });
    });

    // Rule 8: Location Lock warnings (not in the library / lost reference photo), reported once
    (clip.locationWarnings || []).forEach((w, wIdx) => {
      if (warnings.includes(w)) return;
      warnings.push(w);
      issues.push({
        id: `warn_location_${clipNum}_${wIdx}`,
        clipNumber: clipNum,
        type: 'location',
        severity: 'warning',
        title: w.startsWith('ไม่พบสถานที่') ? 'สถานที่ไม่อยู่ในคลัง' : 'รูปอ้างอิงสถานที่หาย',
        description: w,
        suggestion: w.startsWith('ไม่พบสถานที่') ? 'เพิ่มสถานที่ในคลังสถานที่ หรือเลือกสถานที่จากคลังในแผง Location Lock' : 'อัปโหลดรูปอ้างอิงสถานที่ใหม่ด้วยปุ่ม แก้ไข (Edit) ในคลังสถานที่'
      });
    });

    // Rule 7: Character Lock without appearance ("ยังไม่ได้ระบุรูปลักษณ์ของ X"), reported once
    (clip.appearanceWarnings || []).forEach((w, wIdx) => {
      if (warnings.includes(w)) return;
      warnings.push(w);
      issues.push({
        id: `warn_appearance_${clipNum}_${wIdx}`,
        clipNumber: clipNum,
        type: 'costume',
        severity: 'warning',
        title: 'Character Lock ยังไม่มีรูปลักษณ์',
        description: w,
        suggestion: 'เพิ่มใบหน้า / ทรงผม / ชุด ในคลังตัวละคร หรือในรายชื่อตัวละครของบท'
      });
    });

    // Rule 5: Check Continuity Chain Handoff
    if (idx > 0) {
      const prevClip = clips[idx - 1];
      if (!clip.startAction || !prevClip.endAction) {
        warnings.push(`Clip ${clipNum} รอยต่อโมเมนตัมอาจขาดตอนระหว่างคลิปที่ ${clipNum - 1} และ ${clipNum}`);
        issues.push({
          id: `warn_momentum_${clipNum}`,
          clipNumber: clipNum,
          type: 'event_order',
          severity: 'warning',
          title: `รอยต่อโมเมนตัมขาดช่วงระหว่างคลิป ${clipNum - 1} และ ${clipNum}`,
          description: 'ไม่มีการส่งต่อการเคลื่อนไหวหรือมุมกล้องจากคลิปก่อนหน้า',
          suggestion: 'เชื่อมโยง startAction ของคลิปนี้ให้สอดรับกับ endAction ของคลิปก่อนหน้า'
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
