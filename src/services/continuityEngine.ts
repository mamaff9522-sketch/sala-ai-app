/**
 * Continuity Engine (pure functions, no Express / Firebase / DOM imports)
 * ----------------------------------------------------------------------
 * Shared by the Story engine, the Multi-Clip board and server.ts.
 *
 * 1. Pose handoff: every clip carries the characters present and each
 *    character's END pose (posture + where). The next clip's START pose is
 *    the previous END pose unless the script describes a movement.
 * 2. Continuity check: warns when a locked character disappears without the
 *    script saying they left, or when a pose/position jumps without movement
 *    (e.g. standing at the door -> sitting in a chair).
 * 3. Lock text helpers: full Character Lock (face / hair / outfit when known)
 *    and a single Location Lock (one lighting description reused per clip).
 * 4. Position Lock (PROD-FIX2-0927): per character posture + place + hand props
 *    (ถือโทรศัพท์ / ยื่น / รับ / วางคืน), gesture (จับมือ X) and facing (มอง X).
 *    The END state of clip N is the locked START state of clip N+1 and only
 *    changes when the script explicitly describes it. Unknown = "unspecified"
 *    (keeps the previous value, nothing invented).
 */
import { buildCharacterAppearanceLock } from './characterAppearance';
import type { ClipPosture, ClipCharacterPose, ClipContinuityWarning } from '../types';

// Single source of truth for pose / warning shapes: src/types.ts (ClipPosture,
// ClipCharacterPose = CharacterPositionLock, ClipContinuityWarning). Engine names kept as aliases.
export type Posture = ClipPosture;
/** Posture + place (+ hand props / gesture / facing / entering) of one character. */
export type CharacterPoseState = ClipCharacterPose;
export type ContinuityWarning = ClipContinuityWarning;

/**
 * Warnings of clip `clipIndex1` (1-based) re-labelled for a story/split scene:
 * clipNumber = sceneNumber and "คลิป N" -> "ฉากที่ N" in the message.
 */
export function sceneWarningsFor(warnings: ContinuityWarning[], clipIndex1: number, sceneNumber: number): ContinuityWarning[] {
  return (warnings || [])
    .filter(w => w.clipNumber === clipIndex1)
    .map(w => ({ ...w, clipNumber: sceneNumber, message: w.message.replace(/^คลิป \d+/, `ฉากที่ ${sceneNumber}`) }));
}

export interface ClipContinuityState {
  clipNumber: number;
  charactersPresent: string[];
  startPoses: CharacterPoseState[];
  endPoses: CharacterPoseState[];
  entered: string[];
  left: string[];
}

export interface ClipContinuityInput {
  text: string;
  speakers?: string[];
  /** Scene location (e.g. "หน้าบ้าน"): "เดินกลับมา / เข้ามา" with no other place ends here */
  location?: string;
  /** Source scene id: consecutive clips with the same key are auto-split parts of one scene and inherit its full cast */
  sceneKey?: string;
}

/**
 * Splits combined character labels into individual names:
 * "พี่ทุย และ น้องน้ำ" / "พี่ทุยและน้องน้ำ" / "เอ กับ บี" / "A, B" / "A & B" / "A and B" -> ["พี่ทุย", "น้องน้ำ"].
 */
export function expandCombinedCharacterNames(names: string[]): string[] {
  const out: string[] = [];
  (names || []).forEach(raw => {
    const n = String(raw || '').trim();
    if (!n) return;
    // Thai joiners may have no spaces ("พี่ทุยและน้องน้ำ"); English "and" must be a separate word
    const parts = n.split(/\s*(?:,|、|&|และ|กับ|\band\b)\s*/i).map(x => x.trim()).filter(Boolean);
    if (parts.length >= 2 && parts.every(x => x.length >= 2)) parts.forEach(x => out.push(x));
    else out.push(n);
  });
  return Array.from(new Set(out));
}

/** "ทั้งคู่ / ทั้งสองคน / both / together": everyone present is in the action */
const EVERYONE_RE = /(?:ทั้งคู่|ทั้งสองคน|ทั้งสอง|ทุกคน|\bboth\b|\beveryone\b|\btogether\b)/i;

export interface ContinuityAnalysis {
  clips: ClipContinuityState[];
  warnings: ContinuityWarning[];
}

export const POSTURE_LABEL: Record<Posture, string> = {
  standing: 'standing (ยืน)',
  sitting: 'sitting (นั่ง)',
  lying: 'lying down (นอน)',
  kneeling: 'kneeling (คุกเข่า)',
  walking: 'walking (เดิน)',
  unknown: 'pose as established'
};

// ---- Posture / movement vocabulary ----------------------------------------
const TRANSITIONS: { re: RegExp; posture: Posture }[] = [
  { re: /(?:นั่งลง|ลงนั่ง|ทรุดตัว(?:ลง)?นั่ง|ทิ้งตัว(?:ลง)?นั่ง|ทรุดตัวลง|\bsits? down\b|\bsat down\b|\btakes? a seat\b)/i, posture: 'sitting' },
  { re: /(?:ลุกขึ้น|ลุกยืน|ผุดลุก|ลุกจาก|ลุก|\bstands? up\b|\bstood up\b|\bgets? up\b)/i, posture: 'standing' },
  { re: /(?:ล้มตัว(?:ลง)?นอน|เอนตัว(?:ลง)?นอน|ล้มลง|\blies? down\b|\blay down\b)/i, posture: 'lying' },
  { re: /(?:คุกเข่าลง|ทรุดลงคุกเข่า|\bkneels? down\b)/i, posture: 'kneeling' },
  { re: /(?:เดิน|วิ่ง|ก้าว|ขยับ(?:เข้า|ไป|มา)|ย้ายไป|เข้าไปหา|\bwalks?\b|\bruns?\b|\bsteps?\b|\bmoves?\b|\bapproach(?:es)?\b)/i, posture: 'walking' }
];
const STATICS: { re: RegExp; posture: Posture }[] = [
  { re: /(?:นั่ง|\bsitting\b|\bseated\b)/i, posture: 'sitting' },
  { re: /(?:ยืน|\bstanding\b)/i, posture: 'standing' },
  { re: /(?:นอน|\blying\b)/i, posture: 'lying' },
  { re: /(?:คุกเข่า|\bkneeling\b)/i, posture: 'kneeling' }
];
const LEAVE_RE = /(?:เดินออกไป|เดินจากไป|ออกไปจาก|ออกจาก(?:ห้อง|บ้าน|ฉาก|ร้าน)|จากไป|หายตัวไป|หายไป|ออกไป|\bleaves?\b|\bexits?\b|\bwalks? out\b|\bleft\b)/i;
const ENTER_RE = /(?:เดินเข้ามา|เข้ามา|มาถึง|กลับมา|ปรากฏตัว|โผล่มา|\benters?\b|\barrives?\b|\bwalks? in\b|\bcomes? back\b)/i;
const GROUP_RE = /(?:ทั้งคู่|ทั้งสอง|ทุกคน|พวกเขา|\bboth\b|\beveryone\b)/i;
const PLACE_RE = /(?:อยู่)?((?:ที่|บน|หน้า|ข้าง|ตรง|ริม|ใกล้|หลัง|ใน)[ก-๙A-Za-z0-9]{2,24})/;
/** Words that start like a place phrase but are not places ("หน้าจอ", "สีหน้า", "ในที่สุด") */
const NOT_PLACE_RE = /^(?:หน้าจอ|หน้าตา|หน้าที่|หน้าต่อไป|ในที่สุด|ในใจ|ที่สุด|ที่จะ|ที่ไม่|ที่เคย|ที่ทำ|ข้างใน)/;
/** Arriving here: the character ends at the scene location */
const ARRIVE_HERE_RE = /(?:เดินกลับมา|กลับมา|เดินมา|เข้ามา|มาถึง|\bcomes? back\b|\barrives?\b)/i;
/** A name right after one of these is an OBJECT, not the subject ("ยื่นโทรศัพท์ให้พี่ทุย", "โทรศัพท์น้องน้ำ") */
const OBJECT_MARKER_RE = /(?:ให้|มือ|หา|มอง|ถาม|กับ|ของ|โทรศัพท์|มือถือ|รอ|จับ|ตาม|ถึง|เห็น|แกล้ง|รัก|กอด|ข้าง|หลัง|หน้า)\s*$/;
const PROP_WORDS = 'โทรศัพท์|มือถือ|แก้วน้ำ|แก้ว|กระเป๋า|จดหมาย|ดอกไม้|กุญแจ|ร่ม|หนังสือ|ไฟฉาย|ตะเกียง|กล่อง|แหวน|รูปถ่าย|phone|bag|letter|flowers?|key|umbrella|book|flashlight|box|ring';


/** Splits text into clause-like segments (Thai uses spaces between clauses). */
function segmentsOf(text: string): string[] {
  return (text || '')
    .replace(/["“”][^"“”]*["“”]/g, ' ') // quoted dialogue never describes posture
    .split(/[\n.!?。]+|\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function mentionedIn(seg: string, names: string[]): string[] {
  return names
    .map(n => ({ n, i: seg.indexOf(n) }))
    .filter(x => x.i >= 0)
    .sort((a, b) => a.i - b.i)
    .map(x => x.n);
}

interface SegmentEvent {
  subjects: string[];
  kind: 'transition' | 'static' | 'leave' | 'enter' | 'none';
  posture: Posture;
  place: string;
}

/** Mentions split into subjects (not preceded by an object marker) and objects, in order. */
function subjectsAndObjects(seg: string, names: string[]): { subjects: string[]; objects: string[] } {
  const found: { n: string; i: number }[] = [];
  for (const n of names) {
    let from = 0; let i: number;
    while ((i = seg.indexOf(n, from)) >= 0) {
      // skip if inside a longer, already found name
      if (!found.some(f => i >= f.i && i < f.i + f.n.length)) found.push({ n, i });
      from = i + n.length;
    }
  }
  found.sort((a, b) => a.i - b.i);
  const subjects: string[] = []; const objects: string[] = [];
  for (const f of found) {
    const isObject = f.i > 0 && OBJECT_MARKER_RE.test(seg.slice(0, f.i));
    const list = isObject ? objects : subjects;
    if (!list.includes(f.n)) list.push(f.n);
  }
  return { subjects, objects };
}

function readSegment(seg: string, names: string[], lastSubjects: string[], present: string[], location = ''): SegmentEvent {
  const so = subjectsAndObjects(seg, names);
  const mentioned = [...so.subjects, ...so.objects.filter(o => !so.subjects.includes(o))];
  let subjects = so.subjects.length > 0 ? [so.subjects[0]] : lastSubjects;
  if (GROUP_RE.test(seg)) subjects = present.length > 0 ? [...present] : mentioned;
  const ev: SegmentEvent = { subjects, kind: 'none', posture: 'unknown', place: '' };

  // Object of a movement ("เดินเข้าไปจับมือพี่ทุย") becomes the destination
  const destination = so.objects.find(o => !subjects.includes(o)) || (mentioned.length > 1 ? mentioned[1] : '');

  if (LEAVE_RE.test(seg)) { ev.kind = 'leave'; return ev; }

  // Transition = the script describes a movement; the LAST posture word in the clause is
  // where the character ends up ("เดินไปนั่งลงบนเก้าอี้" -> moved, ends sitting).
  let tIdx = -1;
  let lastIdx = -1; let lastPosture: Posture = 'unknown';
  for (const t of TRANSITIONS) {
    const re = new RegExp(t.re.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg)) !== null) {
      if (tIdx === -1 || m.index < tIdx) tIdx = m.index;
      if (m.index >= lastIdx) { lastIdx = m.index; lastPosture = t.posture; }
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  let sIdx = -1; let sPosture: Posture = 'unknown';
  for (const st of STATICS) {
    const re = new RegExp(st.re.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg)) !== null) {
      if (sIdx === -1 || m.index < sIdx) { sIdx = m.index; sPosture = st.posture; }
      if (tIdx >= 0 && m.index > lastIdx) { lastIdx = m.index; lastPosture = st.posture; }
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  if (tIdx >= 0) { ev.kind = 'transition'; ev.posture = lastPosture; }
  else if (sIdx >= 0) { ev.kind = 'static'; ev.posture = sPosture; }
  else if (ENTER_RE.test(seg)) { ev.kind = 'enter'; ev.posture = 'standing'; }

  if (ev.kind !== 'none') {
    const from = Math.max(0, ev.kind === 'transition' ? tIdx : (ev.kind === 'static' ? sIdx : 0));
    // Place: the last place phrase after the first movement/posture word (destination wins)
    const placeMatches = Array.from(seg.slice(from).matchAll(new RegExp(PLACE_RE.source, 'g')))
      .filter(m => !NOT_PLACE_RE.test(m[1]) && !names.some(n => m[1].endsWith(n) && !m[1].startsWith('ข้าง')));
    const pm = placeMatches.length > 0 ? placeMatches[placeMatches.length - 1] : null;
    if (pm) ev.place = pm[1];
    else if (destination && (ev.kind === 'transition' || ev.kind === 'enter')) ev.place = `ข้าง${destination}`;
    else if (location && (ev.kind === 'transition' || ev.kind === 'enter') && ARRIVE_HERE_RE.test(seg)) ev.place = location;
  }
  return ev;
}

function samePlace(a: string, b: string): boolean {
  if (!a || !b) return true; // unknown place never counts as a jump
  const norm = (s: string) => s.replace(/^(?:อยู่|ที่|บน|ตรง|ใน)/, '');
  const x = norm(a); const y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
}

/**
 * Tracks characters present and their poses across ordered clips.
 * lockedCharacters: the story's locked (main) characters.
 */
export function analyzeClipContinuity(params: {
  clips: ClipContinuityInput[];
  lockedCharacters: string[];
  initialPoses?: CharacterPoseState[];
}): ContinuityAnalysis {
  const names = Array.from(new Set(expandCombinedCharacterNames(params.lockedCharacters || []).map(n => (n || '').trim()).filter(n => n.length >= 2)))
    .sort((a, b) => b.length - a.length);
  const state = new Map<string, CharacterPoseState>();
  let present: string[] = [];
  (params.initialPoses || []).forEach(p => {
    if (!p?.name) return;
    state.set(p.name, { ...p });
    if (!present.includes(p.name)) present.push(p.name);
  });

  const warnings: ContinuityWarning[] = [];
  const out: ClipContinuityState[] = [];

  params.clips.forEach((clip, idx) => {
    const clipNumber = idx + 1;
    const text = clip.text || '';
    const speakers = (clip.speakers || []).filter(Boolean);
    const carried = [...present];
    const startMap = new Map<string, CharacterPoseState>();
    carried.forEach(n => startMap.set(n, { ...(state.get(n) || { name: n, posture: 'unknown', place: '' }) }));

    const mentioned = new Set<string>(mentionedIn(text, names));
    // A combined speaker label ("พี่ทุย และ น้องน้ำ") mentions every name it contains
    speakers.forEach(s => {
      const exact = names.find(x => s === x);
      if (exact) mentioned.add(exact);
      else names.filter(x => s.includes(x)).forEach(x => mentioned.add(x));
    });
    if (EVERYONE_RE.test(text)) carried.forEach(n => mentioned.add(n));

    const entered: string[] = [];
    const left: string[] = [];
    const movedInClip = new Set<string>();
    const checkedFirstPose = new Set<string>();
    let lastSubjects: string[] = [];
    const presentNow = () => Array.from(new Set([...carried.filter(n => !left.includes(n)), ...entered]));

    const firstPose = new Map<string, CharacterPoseState>();
    const getState = (who: string): CharacterPoseState => state.get(who) || { name: who, posture: 'unknown', place: '' };
    const patch = (who: string, p: Partial<CharacterPoseState>) => {
      const next: CharacterPoseState = { ...getState(who), ...p, name: who };
      (['holding', 'gesture', 'facing'] as const).forEach(k => { if (!next[k]) delete next[k]; });
      delete next.entering;
      state.set(who, next);
    };
    const ensureEntered = (who: string) => {
      if (!carried.includes(who) && !entered.includes(who) && !left.includes(who)) entered.push(who);
    };

    for (const seg of segmentsOf(text)) {
      const ev = readSegment(seg, names, lastSubjects, presentNow(), clip.location || '');
      if (ev.subjects.length > 0) lastSubjects = ev.subjects;
      for (const who of ev.subjects) {
        if (!who) continue;
        const wasPresent = carried.includes(who) || entered.includes(who);
        if (!wasPresent && ev.kind !== 'leave') entered.push(who);
        if (ev.kind === 'leave') {
          if (!left.includes(who)) left.push(who);
          continue;
        }
        if (ev.kind === 'none') continue;
        const prev = getState(who);
        // First pose of a character that was NOT carried in: static = its start pose; movement = walks in
        if (!carried.includes(who) && !firstPose.has(who)) {
          firstPose.set(who, ev.kind === 'static'
            ? { name: who, posture: ev.posture, place: ev.place || '' }
            : { name: who, posture: 'walking', place: '', entering: true });
        }
        if (ev.kind === 'static' && carried.includes(who) && !movedInClip.has(who) && !checkedFirstPose.has(who)) {
          const start = startMap.get(who);
          if (start && start.posture !== 'unknown' && start.posture !== 'walking' && start.posture !== ev.posture) {
            warnings.push({
              clipNumber, type: 'pose_jump', character: who,
              message: `คลิป ${clipNumber}: ${who} ท่าทางกระโดด จาก${POSTURE_LABEL[start.posture]}${start.place ? ` ${start.place}` : ''} เป็น${POSTURE_LABEL[ev.posture]}${ev.place ? ` ${ev.place}` : ''} โดยบทไม่ได้บอกว่าขยับ / pose jump without movement`
            });
          } else if (start && start.posture === ev.posture && !samePlace(start.place, ev.place)) {
            warnings.push({
              clipNumber, type: 'place_jump', character: who,
              message: `คลิป ${clipNumber}: ${who} ตำแหน่งกระโดด จาก ${start.place} เป็น ${ev.place} โดยบทไม่ได้บอกว่าเคลื่อนที่ / position jump without movement`
            });
          }
        }
        if (ev.kind === 'static') checkedFirstPose.add(who);
        const moved = ev.kind === 'transition' || ev.kind === 'enter';
        if (moved) movedInClip.add(who);
        // Walking ends standing wherever the character walked to
        const posture: Posture = ev.posture === 'walking' ? 'standing' : ev.posture;
        // Place: explicit place wins; walking somewhere unnamed makes the place unknown; otherwise keep the old spot
        const place = ev.place || (ev.posture === 'walking' ? '' : prev.place || '');
        // A described movement ends the previous gesture / facing (hand props stay in hand)
        const changed = posture !== prev.posture || !samePlace(prev.place, place);
        patch(who, moved || changed ? { posture, place, gesture: '', facing: '' } : { posture, place });
      }
      applyHandsAndFacing(seg, ev.subjects, names, getState, patch, ensureEntered);
    }

    // Characters mentioned/speaking without any pose information
    mentioned.forEach(n => {
      if (!carried.includes(n) && !entered.includes(n) && !left.includes(n)) entered.push(n);
      if (!state.has(n)) state.set(n, { name: n, posture: 'unknown', place: '' });
    });

    // Missing-character check: a locked character that was present must appear or be said to leave.
    // Auto-split parts of the same scene inherit the scene's full cast (carried, no warning).
    const sameSceneAsPrevious = !!clip.sceneKey && idx > 0 && params.clips[idx - 1]?.sceneKey === clip.sceneKey;
    carried.forEach(n => {
      if (!sameSceneAsPrevious && !mentioned.has(n) && !left.includes(n)) {
        warnings.push({
          clipNumber, type: 'missing_character', character: n,
          message: `คลิป ${clipNumber}: ตัวละครหลัก ${n} หายไปจากคลิปโดยบทไม่ได้บอกว่าออกไป / locked character disappears without leaving`
        });
      }
    });

    const charactersPresent = Array.from(new Set([...carried, ...entered]));
    const startPoses = charactersPresent.map(n => startMap.get(n) || firstPose.get(n) || { name: n, posture: 'unknown' as Posture, place: '' });
    present = charactersPresent.filter(n => !left.includes(n));
    const endPoses = present.map(n => ({ ...getState(n) }));

    out.push({ clipNumber, charactersPresent, startPoses: startPoses.map(p => ({ ...p })), endPoses, entered, left });
  });

  return { clips: out, warnings };
}

/**
 * Hand props / gesture / facing from one clause (subject = the clause's subject).
 *   "ยื่นโทรศัพท์ให้พี่ทุย"      -> subject holding "ยื่นโทรศัพท์ให้พี่ทุย"
 *   "รับโทรศัพท์มา"              -> subject holding "ถือโทรศัพท์" (the giver lets go)
 *   "วางคืนให้น้องน้ำ"            -> subject lets go, recipient gets it back
 *   "ถือ/หยิบโทรศัพท์", "กดปิดหน้าจอ" (phone clip) -> holding "ถือโทรศัพท์"
 *   "จับมือพี่ทุย"               -> gesture "จับมือพี่ทุย" (and "ถูก…จับมือ" on the other)
 *   "มองน้องน้ำ"                 -> facing "มองน้องน้ำ"
 * Only what the clause literally says; otherwise the previous state is kept.
 */
function applyHandsAndFacing(
  seg: string,
  subjects: string[],
  names: string[],
  getState: (n: string) => CharacterPoseState,
  patch: (n: string, p: Partial<CharacterPoseState>) => void,
  ensureEntered: (n: string) => void
): void {
  const who = subjects[0];
  const nameAlt = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const nameAfter = (re: RegExp): string => {
    if (!nameAlt) return '';
    const m = seg.match(new RegExp(re.source + `(${nameAlt})`));
    return m ? m[m.length - 1] : '';
  };
  const propRe = new RegExp(`(${PROP_WORDS})`, 'i');
  if (who) {
    const give = seg.match(new RegExp(`ยื่น(${PROP_WORDS})`, 'i'));
    const receive = seg.match(new RegExp(`รับ(${PROP_WORDS})`, 'i'));
    const hold = seg.match(new RegExp(`(?:ถือ|หยิบ|กำ|คว้า)(${PROP_WORDS})`, 'i'));
    const giveBack = /(?:วาง|ส่ง|ยื่น)?คืน(?:ให้)?/.test(seg) && /คืน/.test(seg);
    if (give) {
      const to = nameAfter(/ให้/);
      patch(who, { holding: `ยื่น${give[1]}${to ? `ให้${to}` : ''}` });
    } else if (receive) {
      const prop = receive[1];
      names.forEach(n => { if (n !== who && (getState(n).holding || '').includes(prop)) patch(n, { holding: '' }); });
      patch(who, { holding: `ถือ${prop}` });
    } else if (giveBack) {
      const held = getState(who).holding || '';
      const pm = held.match(propRe);
      const to = nameAfter(/ให้/);
      patch(who, { holding: '' });
      if (to && pm) { ensureEntered(to); patch(to, { holding: `${pm[1]} (${who}วางคืนให้)` }); }
    } else if (hold) {
      patch(who, { holding: `ถือ${hold[1]}` });
    }
    const hand = nameAfter(/จับมือ/);
    if (hand && hand !== who) {
      patch(who, { gesture: `จับมือ${hand}` });
      patch(hand, { gesture: `ถูก${who}จับมือ` });
    }
    const look = nameAfter(/(?:มอง|หันไปหา|หันไปมอง|จ้อง)/);
    if (look && look !== who) patch(who, { facing: `มอง${look}` });
  }
  // "…กดปิดหน้าจอ" on a phone (the clause's owner is the phone's owner/subject)
  const screen = /กด(?:ปิด|เปิด)?(?:หน้าจอ|โทรศัพท์|มือถือ)/.test(seg);
  if (screen) {
    const owner = who || '';
    if (owner && !(getState(owner).holding || '').includes('โทรศัพท์')) patch(owner, { holding: 'ถือโทรศัพท์' });
  }
}

/** "unspecified" is shown for unknown places; the previous value is kept by the engine. */
export function describePose(p: CharacterPoseState): string {
  if (p.entering) return `${p.name} enters the frame during this clip (walking in)`;
  const extras = [
    p.holding ? `holding: ${p.holding}` : '',
    p.gesture ? `gesture: ${p.gesture}` : '',
    p.facing ? `facing: ${p.facing}` : ''
  ].filter(Boolean);
  const where = p.place ? ` at ${p.place}` : (p.posture === 'unknown' ? '' : ' (place unspecified in script, keep previous)');
  return `${p.name} ${POSTURE_LABEL[p.posture] || POSTURE_LABEL.unknown}${where}${extras.length ? ` [${extras.join(', ')}]` : ''}`;
}

/** Thai one-line description used in reports / UI. */
export function describePoseThai(p: CharacterPoseState): string {
  if (p.entering) return `${p.name}: เดินเข้ามาในฉากระหว่างคลิป`;
  const th: Record<Posture, string> = { standing: 'ยืน', sitting: 'นั่ง', lying: 'นอน', kneeling: 'คุกเข่า', walking: 'เดิน', unknown: 'ท่าทางไม่ระบุ' };
  const parts = [th[p.posture] || th.unknown, p.place ? `ที่ ${p.place}` : 'ตำแหน่งไม่ระบุ (คงเดิม)'];
  if (p.holding) parts.push(`มือ: ${p.holding}`);
  if (p.gesture) parts.push(`ท่าทาง: ${p.gesture}`);
  if (p.facing) parts.push(`หันไปทาง: ${p.facing}`);
  return `${p.name}: ${parts.join(', ')}`;
}

/** "Stance/Position Lock" (ล็อกจุดยืน) section: start state (locked from the previous clip) and end state (handed off). */
export function formatPositionLock(state: Pick<ClipContinuityState, 'startPoses' | 'endPoses'>, isFirstClip = false): string {
  if (!state || (state.startPoses.length === 0 && state.endPoses.length === 0)) return '';
  const parts: string[] = [];
  if (state.startPoses.length > 0) {
    parts.push(`${isFirstClip ? 'Start pose' : 'Start pose (must exactly match the end pose of the previous clip)'}: ${state.startPoses.map(describePose).join('; ')}`);
  }
  if (state.endPoses.length > 0) parts.push(`End pose (hand off to next clip): ${state.endPoses.map(describePose).join('; ')}`);
  return `Stance/Position Lock: ${parts.join('. ')}`;
}

/** Prompt block sent to the video model for one clip (includes the "Position Lock" section). */
export function formatContinuityForPrompt(state: Pick<ClipContinuityState, 'charactersPresent' | 'startPoses' | 'endPoses' | 'left'>, isFirstClip = false): string {
  if (!state || state.charactersPresent.length === 0) return '';
  const parts: string[] = [];
  parts.push(`Characters present in this clip: ${state.charactersPresent.join(', ')} (all must stay visible unless the action says they leave)`);
  const pos = formatPositionLock(state, isFirstClip);
  if (pos) parts.push(pos);
  if (state.left && state.left.length > 0) parts.push(`Leaves the frame during this clip: ${state.left.join(', ')}`);
  parts.push('Do not change any posture, position, hand prop or gesture unless the action explicitly describes it');
  return parts.join('. ');
}

/**
 * Enforces the pose handoff on clips that already carry pose data (e.g. from Gemini):
 * clip N start pose := clip N-1 end pose. Returns warnings where the source disagreed.
 */
export function enforcePoseHandoff<T extends { clipNumber?: number; startPoses?: CharacterPoseState[]; endPoses?: CharacterPoseState[]; sceneSummary?: string; startAction?: string }>(clips: T[]): { clips: T[]; warnings: ContinuityWarning[] } {
  const warnings: ContinuityWarning[] = [];
  const result = clips.map(c => ({ ...c }));
  for (let i = 1; i < result.length; i++) {
    const prevEnd = result[i - 1].endPoses || [];
    if (prevEnd.length === 0) continue;
    const start = result[i].startPoses || [];
    const text = `${result[i].startAction || ''} ${result[i].sceneSummary || ''}`;
    const fixed: CharacterPoseState[] = prevEnd.map(p => {
      const given = start.find(s => s.name === p.name);
      const clipNumber = result[i].clipNumber || i + 1;
      if (given && given.posture !== 'unknown' && p.posture !== 'unknown' && given.posture !== p.posture) {
        const moved = text.includes(p.name) && TRANSITIONS.some(t => t.re.test(text));
        if (!moved) {
          warnings.push({ clipNumber, type: 'handoff_mismatch', character: p.name, message: `คลิป ${clipNumber}: ท่าเริ่มของ ${p.name} (${POSTURE_LABEL[given.posture]}) ไม่ตรงกับท่าจบคลิปก่อน (${POSTURE_LABEL[p.posture]}) — ใช้ท่าจบคลิปก่อนแทน` });
        }
      } else if (given && given.posture === p.posture && given.place && p.place && !samePlace(given.place, p.place)) {
        const moved = text.includes(p.name) && TRANSITIONS.some(t => t.re.test(text));
        if (!moved) {
          warnings.push({ clipNumber, type: 'place_jump', character: p.name, message: `คลิป ${clipNumber}: ตำแหน่งเริ่มของ ${p.name} (${given.place}) ไม่ตรงกับตำแหน่งจบคลิปก่อน (${p.place}) — ใช้ตำแหน่งจบคลิปก่อนแทน / position jump` });
        }
      }
      return { ...p };
    });
    // Keep extra characters that newly enter in this clip
    start.forEach(s => { if (!fixed.some(f => f.name === s.name)) fixed.push({ ...s }); });
    result[i].startPoses = fixed;
  }
  return { clips: result, warnings };
}

export function normalizePoseList(raw: any): CharacterPoseState[] {
  if (!Array.isArray(raw)) return [];
  const allowed: Posture[] = ['standing', 'sitting', 'lying', 'kneeling', 'walking', 'unknown'];
  return raw
    .filter((p: any) => p && typeof p.name === 'string' && p.name.trim())
    .map((p: any) => {
      const posture = String(p.posture || '').toLowerCase().trim() as Posture;
      const out: CharacterPoseState = { name: p.name.trim(), posture: allowed.includes(posture) ? posture : 'unknown', place: typeof p.place === 'string' ? p.place.trim() : '' };
      (['holding', 'gesture', 'facing'] as const).forEach(k => { if (typeof p[k] === 'string' && p[k].trim()) out[k] = p[k].trim(); });
      return out;
    });
}

// ---- Lock text helpers -------------------------------------------------------

/**
 * Full Character Lock text: "name (face: …; hair: …; outfit: …; appearance: …; age: …)".
 * Uses only supplied fields (library / API) plus the fallback description when it
 * actually describes looks; a personality-only description is kept as "personality: …".
 * Never adds a placeholder appearance.
 */
export function buildCharacterLockText(c: any, fallbackDescription = ''): string {
  if (!c) return '';
  const name = String(c.name || '').trim();
  if (!name) return '';
  return buildCharacterAppearanceLock([name], [c], fallbackDescription ? [{ name, description: fallbackDescription }] : []).text;
}

/** One lighting description per location+time, reused across every clip of that location. */
export function lightingForTime(timeOfDay: string, override = ''): string {
  if (override && override.trim()) return override.trim();
  const t = timeOfDay || '';
  if (/(กลางคืน|ดึก|ค่ำ|night|midnight)/i.test(t)) return 'low-key night lighting, warm practical lamps, soft moonlight fill, consistent across clips';
  if (/(เย็น|พลบ|สายัณห์|dusk|evening|sunset)/i.test(t)) return 'warm golden-hour evening sunlight from a low angle, soft long shadows, consistent across clips';
  if (/(เช้า|รุ่ง|dawn|morning)/i.test(t)) return 'soft cool morning daylight, gentle haze, consistent across clips';
  if (/(กลางวัน|เที่ยง|บ่าย|day|noon)/i.test(t)) return 'bright natural daylight, soft diffused shadows, consistent across clips';
  return 'natural consistent lighting matched across clips';
}

export interface LocationLock {
  location: string;
  timeOfDay: string;
  lighting: string;
  /** Set / architecture details of the locked library location (Master Lock locationVisualDetails) */
  setDetails?: string;
  /** Locked props (Master Lock props) */
  props?: string;
}

export function formatLocationLock(l: LocationLock): string {
  if (!l || !l.location) return '';
  return `Location Lock: ${l.location}${l.timeOfDay ? `, ${l.timeOfDay}` : ''}. Lighting Lock: ${l.lighting} (identical set, props and lighting in every clip at this location)` +
    (l.setDetails ? `. Set Lock: ${l.setDetails}` : '') +
    (l.props ? `. Props Lock: ${l.props}` : '');
}

/**
 * Location Lock sync for an already-built scene prompt (split stage): the locked location /
 * time / lighting replace the script's values in the "Location Lock: / Time: / Lighting Lock:"
 * segments (appended when missing); locked set details and props are appended once.
 * Only locked (non-empty) values are touched.
 */
const PROMPT_LABELS = 'Character Lock|Location Lock|Time|Lighting Lock|Scene Action|Dialogue|Starting moment|Ending momentum|Camera|Set Lock|Props Lock|Props';
export function syncLocationLockInPrompt(prompt: string, lock: { location?: string; timeOfDay?: string; lighting?: string; locationVisualDetails?: string; props?: string }): string {
  let p = String(prompt || '');
  const seg = (label: string, value?: string) => {
    const v = String(value || '').trim();
    if (!v || v.includes('ไม่ระบุ')) return;
    const re = new RegExp(`${label}: .*?(?=, (?:${PROMPT_LABELS}):|\\. Continuity Handoff:|$)`);
    if (re.test(p)) p = p.replace(re, `${label}: ${v}`);
    else if (!p.includes(v)) p = `${p}${p ? ', ' : ''}${label}: ${v}`;
  };
  seg('Location Lock', lock?.location);
  seg('Time', lock?.timeOfDay);
  seg('Lighting Lock', lock?.lighting);
  const extra = (label: string, value?: string) => {
    const v = String(value || '').trim();
    if (v && !p.includes(v)) p = `${p}${p ? ', ' : ''}${label}: ${v}`;
  };
  extra('Set Lock', lock?.locationVisualDetails);
  extra('Props Lock', lock?.props);
  return p;
}

/** Normalized text for repeat detection (no spaces / punctuation / shot-length prefix). */
function storyKey(t: string): string {
  return String(t || '').replace(/^\[[^\]]*\]\s*/, '').replace(/\(ล็อคตำแหน่ง:[^)]*\)/g, '').replace(/[\s"'“”‘’.,!?…:;()\[\]\-–—]/g, '');
}

/**
 * Story Lock check for a continuation episode: warns when a new scene repeats a scene
 * that was already generated (same scene number or the same action text).
 */
export function checkStoryRepeats(
  newScenes: Array<{ sceneNumber?: number; actionDescription?: string }>,
  existingScenes: Array<{ sceneNumber?: number; summary?: string; startAction?: string }> = []
): ContinuityWarning[] {
  const out: ContinuityWarning[] = [];
  const existing = (existingScenes || []).map(e => ({ n: Number(e?.sceneNumber) || 0, key: storyKey(e?.summary || e?.startAction || '') }));
  (newScenes || []).forEach(sc => {
    const n = Number(sc?.sceneNumber) || 0;
    const key = storyKey(sc?.actionDescription || '');
    const sameNum = existing.find(e => e.n > 0 && e.n === n);
    const sameText = key.length >= 15 ? existing.find(e => e.key.length >= 15 && (e.key === key || e.key.includes(key) || key.includes(e.key))) : undefined;
    const hit = sameText || sameNum;
    if (hit) out.push({
      clipNumber: n,
      type: 'story_repeat',
      character: '',
      message: `ฉากที่ ${n}: ${sameText ? `เนื้อหาซ้ำกับฉากที่ ${hit.n} ที่สร้างไปแล้ว` : `เลขฉากซ้ำกับฉากที่สร้างไปแล้ว`} — Story Lock: ต้องต่อจากเหตุการณ์ล่าสุด ห้ามเล่าซ้ำ / story repeat`
    });
  });
  return out;
}
