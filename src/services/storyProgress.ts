/**
 * Where "สร้างต่อ" (story continuation) is in the original story, and whether a new episode
 * skipped part of it.
 *
 * Problem this solves: the continuation request used to send the whole story plus a summary
 * of the last scene. The model had to guess where the previous episode stopped and often
 * jumped from the middle straight to the ending. Here the dialogue lines of the original story
 * are the ruler:
 * - findResumePoint(): the last source line already written, and the source text after it
 * - checkEpisodeOrder(): source lines a new episode skipped, and the scenes to keep (the ones
 *   before the first jump)
 */
import { parseStoryStructure, generateEpisodeLocally, hasExplicitEndingMarker } from './storyEpisodeEngine';
import { normalizeStoryScript } from './storyNormalize';
import { findSections, insertBlock, removeSections, dropEmptyCues } from './promptSections';

export interface ResumePoint {
  /** Source dialogue lines in story order */
  sourceLines: string[];
  /** Index of the next source line still to write (0 = start of the story) */
  nextIndex: number;
  /** Index of the last source line already written (-1 = nothing yet) */
  lastWrittenIndex: number;
  /** Original story text after the last written line ('' when unknown or nothing written) */
  remainingText: string;
  /** The last written line as it appears in the story ('' when nothing written) */
  lastWrittenLine: string;
  /** false when nothing could be matched although scenes exist (no dialogue to anchor on) */
  anchored: boolean;
  /** First story beat (action or dialogue) still to write */
  fromBeat: number;
}

/** Story text after beat index `idx` (walks story lines and beats in step). '' when not found. */
function textAfterBeat(story: string, beats: any[], idx: number): string {
  const norm = String(story || '').replace(/\r\n?/g, '\n');
  const lines = norm.split('\n');
  const key = (b: any) => squash(b?.type === 'dialogue' ? b?.dialogue?.dialogue : b?.text);
  let j = 0;
  for (let i = 0; i < lines.length; i++) {
    const sq = squash(lines[i]);
    while (sq && j <= idx && key(beats[j]) && sq.includes(key(beats[j]))) {
      if (j === idx) return lines.slice(i + 1).join('\n').trim();
      j++;
    }
  }
  return '';
}

/**
 * Last story beat these scenes carry, scanning forward from `fromBeat` (actions by fuzzy match, so
 * light rewording counts). Stops at the first dialogue line they do not carry.
 */
export function storyCursorFor(scenes: any[], originalStory: string, fromBeat: number, promptKey: 'visualPrompt' | 'generatedPrompt' = 'visualPrompt'): number {
  let beats: any[] = [];
  try { beats = parseStoryStructure(originalStory).narrativeBeats || []; } catch { return fromBeat - 1; }
  const text = (scenes || []).map(s => [s?.[promptKey], ...(Array.isArray(s?.dialogues) ? s.dialogues.map((d: any) => d?.dialogue ?? d?.line) : [])].join(' ')).join('\n');
  let last = fromBeat - 1;
  for (let b = Math.max(0, fromBeat); b < beats.length; b++) {
    const t = beats[b]?.type === 'dialogue' ? beats[b]?.dialogue?.dialogue : beats[b]?.text;
    if (isLineCovered(String(t || ''), text)) last = b;
    else if (beats[b]?.type === 'dialogue') break;
  }
  return last;
}

const squash = (s: unknown) => String(s ?? '')
  .replace(/[“”"'‘’«»「」]/g, '')
  .replace(/[\s.,!?…~\-—–:;()]/g, '')
  .toLowerCase();

/** Index in sourceLines of a written line (exact, or one contains the other for split parts). */
export function matchSourceLine(line: unknown, sourceLines: string[], from = 0): number {
  const key = squash(line);
  if (key.length < 2) return -1;
  for (let i = from; i < sourceLines.length; i++) {
    const src = squash(sourceLines[i]);
    if (src === key) return i;
  }
  for (let i = from; i < sourceLines.length; i++) {
    const src = squash(sourceLines[i]);
    if (src && (src.includes(key) && key.length >= 4 || key.includes(src) && src.length >= 4)) return i;
  }
  return -1;
}

function linesOfScene(scene: any): string[] {
  const ds = Array.isArray(scene?.dialogues) ? scene.dialogues : [];
  return ds.map((d: any) => (typeof d === 'string' ? d : d?.line ?? d?.dialogue ?? '')).filter(Boolean);
}

export function sourceDialogueLines(originalStory: string): string[] {
  try {
    return parseStoryStructure(originalStory).allDialogues.map(d => d.dialogue).filter(Boolean);
  } catch {
    return [];
  }
}

/** Finds where the next episode must start, from the scenes already written. */
export function findResumePoint(originalStory: string, writtenScenes: any[] = []): ResumePoint {
  const sourceLines = sourceDialogueLines(originalStory);
  // Preferred: the story position stamped on earlier episodes (counts action lines too, so an episode
  // that ended on action lines is never written again)
  const cursors = (writtenScenes || []).map(s => Number(s?.sourceCursor)).filter(n => Number.isFinite(n) && n >= 0);
  if (cursors.length > 0) {
    let parsedBeats: any[] = [];
    let dlgBeats: number[] = [];
    try {
      const ps = parseStoryStructure(originalStory);
      parsedBeats = ps.narrativeBeats || [];
      dlgBeats = ps.allDialogues.map(d => d.beatIndex);
    } catch { /* fall through to dialogue matching */ }
    if (parsedBeats.length > 0) {
      const cursor = Math.min(Math.max(...cursors), parsedBeats.length - 1);
      const nextIndex = dlgBeats.filter(b => b <= cursor).length;
      return {
        sourceLines,
        nextIndex,
        lastWrittenIndex: nextIndex - 1,
        remainingText: cursor >= parsedBeats.length - 1 ? '' : textAfterBeat(originalStory, parsedBeats, cursor),
        lastWrittenLine: nextIndex > 0 ? sourceLines[nextIndex - 1] : '',
        anchored: true,
        fromBeat: cursor + 1
      };
    }
  }
  let last = -1;
  for (const scene of writtenScenes || []) {
    for (const line of linesOfScene(scene)) {
      const idx = matchSourceLine(line, sourceLines);
      if (idx > last) last = idx;
    }
  }
  const anchored = last >= 0 || (writtenScenes || []).length === 0;
  let remainingText = '';
  let lastWrittenLine = '';
  if (last >= 0) {
    lastWrittenLine = sourceLines[last];
    // Cut the story right after the line that holds the last written dialogue
    // Walk the story lines and the source dialogue in step, so a repeated line resolves to the right one
    const storyLines = originalStory.split(/\r?\n/);
    let j = 0;
    let cutAt = -1;
    for (let i = 0; i < storyLines.length && cutAt < 0; i++) {
      const sq = squash(storyLines[i]);
      while (sq && j <= last && squash(sourceLines[j]) && sq.includes(squash(sourceLines[j]))) {
        if (j === last) { cutAt = i; break; }
        j++;
      }
    }
    if (cutAt >= 0) remainingText = storyLines.slice(cutAt + 1).join('\n').trim();
  }
  let fromBeat = 0;
  if (last >= 0) {
    try { fromBeat = (parseStoryStructure(originalStory).allDialogues[last]?.beatIndex ?? -1) + 1; } catch { fromBeat = 0; }
  }
  return {
    sourceLines,
    nextIndex: last + 1,
    lastWrittenIndex: last,
    remainingText,
    lastWrittenLine,
    anchored,
    fromBeat
  };
}

export interface EpisodeOrderCheck {
  /** Source lines between the resume point and the last line the episode used that it never wrote */
  skippedLines: string[];
  /** Scenes to keep: all of them when nothing was skipped, else the ones before the first jump */
  keepSceneCount: number;
  /** Index of the last source line this episode wrote (-1 = none matched) */
  lastIndex: number;
  /** true when every source dialogue line is written by the end of this episode */
  allLinesCovered: boolean;
}

/** Checks that a new episode writes the source lines in order from the resume point, without gaps. */
export function checkEpisodeOrder(scenes: any[], resume: ResumePoint): EpisodeOrderCheck {
  const { sourceLines, nextIndex } = resume;
  const total = sourceLines.length;
  if (total === 0) {
    return { skippedLines: [], keepSceneCount: (scenes || []).length, lastIndex: -1, allLinesCovered: true };
  }
  const written = new Set<number>();
  for (let i = 0; i < nextIndex; i++) written.add(i);
  let expected = nextIndex;
  let keepSceneCount = (scenes || []).length;
  let firstJumpFound = false;
  let lastIndex = -1;
  (scenes || []).forEach((scene, sIdx) => {
    for (const line of linesOfScene(scene)) {
      const idx = matchSourceLine(line, sourceLines, Math.max(0, nextIndex - 1));
      if (idx < 0) continue;
      if (!firstJumpFound && idx > expected) {
        // A source line was skipped: keep only the scenes before this one
        firstJumpFound = true;
        keepSceneCount = sIdx;
      }
      written.add(idx);
      if (idx >= expected) expected = idx + 1;
      if (idx > lastIndex) lastIndex = idx;
    }
  });
  const skippedLines: string[] = [];
  for (let i = nextIndex; i <= lastIndex; i++) if (!written.has(i)) skippedLines.push(sourceLines[i]);
  if (skippedLines.length === 0) keepSceneCount = (scenes || []).length;
  let allLinesCovered = true;
  for (let i = 0; i < total; i++) if (!written.has(i)) { allLinesCovered = false; break; }
  return { skippedLines, keepSceneCount, lastIndex, allLinesCovered };
}

/**
 * Recovers an episode from a reply that was cut off mid-way (output length limit): keeps every
 * complete scene object inside "scenes": [...] and the top-level fields written before it.
 * Returns null when not even one complete scene is there.
 */
export function salvageEpisodeJson(raw: string): any | null {
  const text = String(raw || '');
  const key = text.search(/"scenes"\s*:\s*\[/);
  if (key < 0) return null;
  const arrStart = text.indexOf('[', key);
  const scenes: any[] = [];
  let depth = 0;
  let inStr = false;
  let esc = false;
  let objStart = -1;
  for (let i = arrStart + 1; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') { if (depth === 0) objStart = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0 && objStart >= 0) {
        try { scenes.push(JSON.parse(text.slice(objStart, i + 1))); } catch { /* skip a broken one */ }
        objStart = -1;
      }
    } else if (ch === ']' && depth === 0) break;
  }
  if (scenes.length === 0) return null;
  const head: any = {};
  const before = text.slice(0, key);
  for (const m of before.matchAll(/"(isStoryFinished|sourceCovered)"\s*:\s*(true|false)/g)) head[m[1]] = m[2] === 'true';
  for (const m of before.matchAll(/"(episodeTitle|finishMessage|currentMilestone|summaryOfEventsSoFar)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
    try { head[m[1]] = JSON.parse(`"${m[2]}"`); } catch { /* ignore */ }
  }
  const num = before.match(/"progressPercentage"\s*:\s*(\d+(?:\.\d+)?)/);
  if (num) head.progressPercentage = Number(num[1]);
  return { ...head, scenes, sourceCovered: false, isStoryFinished: false, truncated: true };
}

/**
 * Splits scenes whose dialogue cannot be spoken in one clip into consecutive parts
 * (same density rule as the offline builder: ~80% of the clip for speech, about 3 lines per 10 s).
 * Works for story-continuation scenes ({dialogues:[{speaker, dialogue}], visualPrompt}) and
 * director clips ({dialogues:[{speaker, line}], generatedPrompt}). Each part keeps only its own
 * lines in the prompt; numbers are renumbered from the first scene's number.
 */
export function splitDenseDialogueScenes<T extends Record<string, any>>(
  scenes: T[],
  clipDurationSeconds: number,
  opts: {
    promptKey?: 'visualPrompt' | 'generatedPrompt';
    numberKey?: 'sceneNumber' | 'clipNumber';
    titleKey?: 'sceneHeading' | 'title';
    endKey?: 'endState' | 'endAction';
    /** The story: action sections are cleared so restoreMissingStoryBeats can give each part its own actions */
    story?: string;
  } = {}
): T[] {
  const promptKey = opts.promptKey || 'visualPrompt';
  const numberKey = opts.numberKey || 'sceneNumber';
  const titleKey = opts.titleKey || 'sceneHeading';
  const endKey = opts.endKey || 'endState';
  const duration = Math.max(3, Number(clipDurationSeconds) || 8);
  const lineOf = (d: any) => String(d?.dialogue ?? d?.line ?? '').trim();
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // ~12 Thai chars/s + 0.6 s per line, 80% of the clip; at most ~3 lines per 10 s
  const secs = (l: string) => l.replace(/\s/g, '').length / 12 + 0.6;
  const budget = 0.8 * duration;
  const maxLines = Math.max(1, Math.round(3 * duration / 10));

  const out: T[] = [];
  for (const scene of scenes || []) {
    const ds: any[] = Array.isArray(scene?.dialogues) ? scene.dialogues : [];
    const total = ds.reduce((a, d) => a + secs(lineOf(d)), 0);
    if (ds.length < 2 || (total <= budget && ds.length <= maxLines)) { out.push(scene); continue; }
    // Greedy groups in order: close a group when the next line would overflow time or line count
    const groups: any[][] = [];
    let cur: any[] = [];
    let t = 0;
    for (const d of ds) {
      const s = secs(lineOf(d));
      if (cur.length > 0 && (t + s > budget || cur.length >= maxLines)) { groups.push(cur); cur = []; t = 0; }
      cur.push(d); t += s;
    }
    if (cur.length) groups.push(cur);
    if (groups.length < 2) { out.push(scene); continue; }
    const prompt = String(scene?.[promptKey] || '');
    // Action written after the last line inside the dialogue block ("They laugh together") ends the
    // scene: only the last part keeps it. It stops at the next known section (locks added later).
    let tail = '';
    const lastSrc = lineOf(ds[ds.length - 1]);
    const at = lastSrc ? prompt.lastIndexOf(lastSrc) : -1;
    if (at >= 0) {
      const after = at + lastSrc.length;
      const next = findSections(prompt).find(sec => sec.start >= after);
      tail = prompt.slice(after, next ? next.start : prompt.length).replace(/^["”]/, '').trim().replace(/^[.,]\s*/, '');
      if (tail.length > 300) tail = '';
    }
    groups.forEach((g, k) => {
      let p = prompt;
      if (tail && k < groups.length - 1) p = p.split(tail).join(' ');
      for (const other of ds) {
        if (g.includes(other)) continue;
        const line = lineOf(other);
        if (!line) continue;
        const sp = esc(String(other?.speaker || ''));
        const re = new RegExp(`(?:\\[?${sp}\\]?\\s*[:：]\\s*)?["“]?${esc(line)}["”]?\\s*`, 'g');
        p = p.replace(re, ' ');
      }
      p = p.replace(/\s{2,}/g, ' ').replace(/\s+([.,])/g, '$1').trim();

      // Action sections describe the whole scene; with opts.story each part gets back only its own
      // actions (restoreMissingStoryBeats). Later parts never replay what an earlier part showed.
      if (opts.story) {
        p = removeSections(p, x => ACTION_LABELS.has(x.label)).prompt;
      } else if (k > 0) {
        p = removeSections(p, x => x.label === 'Starting moment').prompt;
      }
      const lastLine = lineOf(g[g.length - 1]);
      const prevLast = k > 0 ? lineOf(groups[k - 1][groups[k - 1].length - 1]) : '';
      // Speech cues left without their line ("น้ำฟ้า speaks: ;") and emptied labels ("Continuity Flow:.")
      p = dropEmptyCues(p);
      if (k > 0) {
        // No earlier line is quoted here: the video model could say it again
        const cont = 'Starting moment: ต่อจากคลิปก่อนทันที ตัวละครอยู่ตำแหน่งเดิม (เหตุการณ์และบทพูดของคลิปก่อนเกิดขึ้นไปแล้ว ห้ามทำซ้ำ)';
        const firstSec = findSections(p).find(x => x.label === 'Dialogue' || x.label === 'Character Lock' || x.label === 'Cinematography');
        p = insertBlock(p, firstSec ? firstSec.start : p.length, cont);
      }
      const isLast = k === groups.length - 1;
      out.push({
        ...scene,
        dialogues: g,
        // Parts stay in place: start = scene start, the scene's end pose only on the last part
        ...(k > 0 && scene?.startPoses ? { startPoses: scene.startPoses } : {}),
        ...(!isLast && scene?.startPoses ? { endPoses: scene.startPoses } : {}),
        // The scene's own continuity warnings once, on the first part (not repeated per part)
        ...(k > 0 ? { continuityWarnings: [] } : {}),
        [promptKey]: p,
        [titleKey]: `${scene?.[titleKey] || ''} (ตอนที่ ${k + 1}/${groups.length})`.trim(),
        ...(k > 0 ? { startAction: 'ต่อเนื่องจากคลิปก่อน ฉาก ท่าทาง และตำแหน่งเดิม' } : {}),
        ...(k < groups.length - 1 ? { [endKey]: 'ยังอยู่ในฉากเดิม ท่าทางและตำแหน่งเดิม ส่งต่อคลิปถัดไป' } : {}),
        // sourceSceneNumber marks the parts as one scene for the continuity check (cast carried, no "disappears")
        splitPart: { sourceSceneNumber: Number(scene?.[numberKey]) || 0, part: k + 1, total: groups.length, reason: `บทพูดยาวเกิน ${duration} วินาที แบ่งเป็น ${groups.length} คลิป` }
      } as T);
    });
  }
  const start = Number(scenes?.[0]?.[numberKey]) || 1;
  return out.map((s, i) => ({ ...s, [numberKey]: start + i }));
}

const squashForCover = (s: string) => String(s || '')
  .replace(/กำลัง/g, '')
  .replace(/[\s"“”'‘’«»「」.,!?…~:：;()\-—–]/g, '')
  .toLowerCase();

/** true when the text already carries this story line (exact, or ≥80% of its 4-char pieces, so light rewording counts). */
export function isLineCovered(line: string, text: string): boolean {
  const k = squashForCover(line);
  const t = squashForCover(text);
  if (k.length < 2) return true;
  if (t.includes(k)) return true;
  const pieces = new Set<string>();
  for (let i = 0; i + 4 <= k.length; i++) pieces.add(k.slice(i, i + 4));
  if (pieces.size === 0) return false;
  let hit = 0;
  for (const p of pieces) if (t.includes(p)) hit++;
  return hit / pieces.size >= 0.8;
}

/**
 * Puts back story lines that Gemini left out of its scene prompts.
 *
 * Gemini rewrites each scene in its own words and often drops action / narration lines (and now and
 * then a dialogue line). The original story is the source of truth: every beat in the window this
 * episode covers is assigned to a scene (by the dialogue around it, within the same source scene) and,
 * when that scene's prompt does not carry it, it is written back in story order:
 * - action / narration → a "Script action:" section
 * - dialogue → the scene's dialogue list and its "Dialogue:" section
 *
 * Window: from the line after the last one already written (fromDialogueIndex) up to the last
 * dialogue line these scenes use; to the end of the story when that is the story's last line or
 * untilEnd is set (the director covers the whole script).
 */
export function restoreMissingStoryBeats<T extends Record<string, any>>(
  scenes: T[],
  originalStory: string,
  opts: {
    fromDialogueIndex?: number;
    /** First story beat still to write (wins over fromDialogueIndex) */
    fromBeat?: number;
    /** Last story beat this episode covers (when known) */
    toBeat?: number;
    untilEnd?: boolean;
    promptKey?: 'visualPrompt' | 'generatedPrompt';
    dialogueKey?: 'dialogue' | 'line';
  } = {}
): { scenes: T[]; restoredActions: number; restoredDialogues: number } {
  const promptKey = opts.promptKey || 'visualPrompt';
  const dialogueKey = opts.dialogueKey || 'dialogue';
  const none = { scenes, restoredActions: 0, restoredDialogues: 0 };
  if (!Array.isArray(scenes) || scenes.length === 0) return none;
  let parsed: ReturnType<typeof parseStoryStructure>;
  try { parsed = parseStoryStructure(originalStory); } catch { return none; }
  const beats = parsed.narrativeBeats || [];
  if (beats.length === 0) return none;
  const sourceLines = parsed.allDialogues.map(d => d.dialogue);
  const dlgBeat = parsed.allDialogues.map(d => d.beatIndex);

  // Source scene of every beat (beats are shared objects between narrativeBeats and scenes[].beats)
  const srcSceneOfObj = new Map<any, number>();
  (parsed.scenes || []).forEach((sc, i) => (sc.beats || []).forEach(b => srcSceneOfObj.set(b, i)));
  const srcScene = beats.map(b => srcSceneOfObj.get(b) ?? 0);

  // Which output scene holds each source dialogue line
  const from = Math.max(0, opts.fromDialogueIndex || 0);
  const sceneOfDialogue = new Map<number, number>();
  scenes.forEach((sc, sIdx) => {
    for (const d of Array.isArray(sc.dialogues) ? sc.dialogues : []) {
      const idx = matchSourceLine(d?.[dialogueKey] ?? d?.line ?? d?.dialogue, sourceLines, Math.max(0, from - 1));
      if (idx >= 0 && !sceneOfDialogue.has(idx)) sceneOfDialogue.set(idx, sIdx);
    }
  });
  const matched = Array.from(sceneOfDialogue.keys());
  if (matched.length === 0 && !opts.untilEnd) return none;
  const lastMatched = matched.length ? Math.max(...matched) : -1;

  const startBeat = opts.fromBeat != null && opts.fromBeat >= 0
    ? opts.fromBeat
    : (from > 0 && dlgBeat[from - 1] != null ? dlgBeat[from - 1] + 1 : 0);
  const endBeat = opts.toBeat != null && opts.toBeat >= 0
    ? Math.min(opts.toBeat, beats.length - 1)
    : (opts.untilEnd || lastMatched === sourceLines.length - 1 || lastMatched < 0
      ? beats.length - 1
      : dlgBeat[lastMatched]);

  // Output scene of each beat in the window
  const sceneAtBeat = new Map<number, number>();
  sceneOfDialogue.forEach((s, dIdx) => sceneAtBeat.set(dlgBeat[dIdx], s));
  const mappedBeats = Array.from(sceneAtBeat.keys()).sort((a, b) => a - b);
  const assign = (b: number): number => {
    const prev = [...mappedBeats].reverse().find(x => x < b);
    const next = mappedBeats.find(x => x > b);
    if (prev != null && srcScene[prev] === srcScene[b]) return sceneAtBeat.get(prev)!;
    if (next != null) return sceneAtBeat.get(next)!;
    if (prev != null) return sceneAtBeat.get(prev)!;
    return 0;
  };

  const out = scenes.map(s => ({ ...s, dialogues: Array.isArray(s.dialogues) ? [...s.dialogues] : [] })) as T[];
  const addActions = new Map<number, string[]>();
  let restoredActions = 0;
  let restoredDialogues = 0;
  for (let b = startBeat; b <= endBeat && b < beats.length; b++) {
    const beat = beats[b];
    const s = beat.type === 'dialogue' && sceneAtBeat.has(b) ? sceneAtBeat.get(b)! : assign(b);
    const scene: any = out[s];
    const prompt = String(scene?.[promptKey] || '');
    if (beat.type === 'action') {
      const text = String(beat.text || '').trim();
      if (!text || isLineCovered(text, prompt) || isLineCovered(text, (addActions.get(s) || []).join(' '))) continue;
      if (!addActions.has(s)) addActions.set(s, []);
      addActions.get(s)!.push(text.replace(/[.\s]+$/, ''));
      restoredActions++;
    } else if (beat.dialogue && !sceneAtBeat.has(b)) {
      // A dialogue line no scene carries: add it after the dialogue that precedes it in the story
      const dIdx = dlgBeat.indexOf(b);
      const entry: any = { speaker: beat.dialogue.speaker, [dialogueKey]: beat.dialogue.dialogue, id: `restored_${dIdx}` };
      const prevIdx = dIdx - 1;
      const at = scene.dialogues.findIndex((d: any) => matchSourceLine(d?.[dialogueKey] ?? d?.line ?? d?.dialogue, sourceLines) === prevIdx);
      scene.dialogues.splice(at >= 0 ? at + 1 : scene.dialogues.length, 0, entry);
      // Rewrite the Dialogue section from the scene's list, so the restored line sits in story order
      const block = `Dialogue: ${scene.dialogues.map((d: any) => `[${d.speaker}]: "${d?.[dialogueKey] ?? d?.line ?? d?.dialogue}"`).join(' ')}`;
      const cut = removeSections(prompt, x => x.label === 'Dialogue');
      scene[promptKey] = cut.firstIndex >= 0 ? insertBlock(cut.prompt, cut.firstIndex, block) : insertBeforeLocks(prompt, block);
      sceneAtBeat.set(b, s);
      restoredDialogues++;
    }
  }
  addActions.forEach((list, s) => {
    const scene: any = out[s];
    const block = `Script action: ${list.join('. ')}`;
    scene[promptKey] = insertBeforeLocks(String(scene[promptKey] || ''), block);
  });
  return { scenes: out, restoredActions, restoredDialogues };
}

/** Inserts a block before the Dialogue / lock sections (or at the end) with clean joins. */
function insertBeforeLocks(prompt: string, block: string): string {
  const stop = findSections(prompt).find(x => ['Dialogue', 'Continuity Handoff', 'Stance/Position Lock', 'Negative prompt'].includes(x.label));
  return insertBlock(prompt, stop ? stop.start : prompt.length, block);
}

const ACTION_LABELS = new Set(['Core action', 'Script action', 'Scene Action', 'Starting moment', 'Ending momentum']);

const SCENE_HEADING_RE = /^[ \t#*_\[【(]*(?:ฉากที่|ฉาก|scene)\s*\d+.*$/gim;

/**
 * The story text still to write: the story's opening (title / character list), the heading of the
 * scene where writing stopped (so place and time carry over), then everything after the last
 * written line. '' when the story is used up; null when nothing written can be found in the story
 * (no dialogue to anchor on), so the caller falls back to its old behaviour.
 */
export function remainingStorySource(originalStory: string, resume: ResumePoint, hasWrittenScenes: boolean): string | null {
  const norm = String(originalStory || '').replace(/\r\n?/g, '\n');
  if (resume.fromBeat <= 0) return hasWrittenScenes ? null : norm;
  if (!resume.remainingText.trim()) return '';
  const cut = norm.lastIndexOf(resume.remainingText);
  if (cut < 0) return null;
  const before = norm.slice(0, cut);
  const heads = before.match(SCENE_HEADING_RE) || [];
  const firstHead = norm.search(new RegExp(SCENE_HEADING_RE.source, 'im'));
  const preamble = firstHead > 0 ? norm.slice(0, firstHead).trim() : '';
  return [preamble, heads.length ? heads[heads.length - 1].trim() : '', resume.remainingText].filter(Boolean).join('\n\n');
}

/**
 * One offline (no AI) episode that continues EXACTLY after the last line already written.
 * The old engine continued from the last scene NUMBER, which skips scenes once long scenes are split
 * into several clips or episodes came from Gemini (their numbers no longer match the story's scenes).
 */
export function offlineContinuation(p: {
  originalStory: string;
  existingScenes?: any[];
  lastSceneState?: any;
  targetSceneCount?: number;
  characters?: any[];
  continuityLock?: any;
  clipDurationSeconds?: number;
  episodeNumber?: number;
  currentScriptText?: string;
}): any {
  p = { ...p, originalStory: normalizeStoryScript(String(p.originalStory || '')), continuityLock: lockForScript(p.continuityLock, String(p.originalStory || '')) };
  const existing = Array.isArray(p.existingScenes) ? p.existingScenes : [];
  const written = [...existing, ...(p.lastSceneState ? [p.lastSceneState] : [])];
  const resume = findResumePoint(p.originalStory, written);
  const duration = Number(p.clipDurationSeconds) || 8;
  const perEpisode = Math.max(1, Math.min(6, Number(p.targetSceneCount) || 6));
  const source = remainingStorySource(p.originalStory, resume, written.length > 0);

  if (source === null) {
    // Nothing to anchor on (story without dialogue): the old scene-number behaviour
    const legacy: any = generateEpisodeLocally({ ...p, targetSceneCount: perEpisode } as any);
    if (Array.isArray(legacy.scenes)) legacy.scenes = splitDenseDialogueScenes(legacy.scenes, duration);
    return legacy;
  }
  if (source === '') {
    const finished = hasExplicitEndingMarker(p.originalStory);
    return { scenes: [], hasMoreScenes: false, sourceCovered: true, isStoryFinished: finished, finishMessage: finished ? 'เนื้อเรื่องจบแล้ว (จบบริบูรณ์ตามต้นฉบับ)' : 'ใช้เนื้อเรื่องต้นฉบับครบแล้ว', progressPercentage: 100 };
  }
  const startSceneNum = Math.max(
    Number(p.lastSceneState?.sceneNumber) || 0,
    ...existing.map(s => Number(s?.sceneNumber) || 0),
    0
  ) + 1;
  const local: any = generateEpisodeLocally({
    originalStory: source,
    currentScriptText: p.currentScriptText,
    episodeNumber: 1,
    targetSceneCount: perEpisode,
    existingScenes: [],
    // keeps the pose hand-off; sceneNumber 0 so the engine starts at the top of the remaining text
    lastSceneState: p.lastSceneState ? { ...p.lastSceneState, sceneNumber: 0 } : null,
    characters: p.characters,
    continuityLock: p.continuityLock,
    clipDurationSeconds: duration
  } as any);
  const numbered = (local.scenes || []).map((s: any, i: number) => ({ ...s, sceneNumber: startSceneNum + i }));
  const order = checkEpisodeOrder(numbered, resume);
  const cursor = storyCursorFor(numbered, p.originalStory, resume.fromBeat);
  const beatCount = (() => { try { return parseStoryStructure(p.originalStory).narrativeBeats.length; } catch { return 0; } })();
  if (cursor < resume.fromBeat) {
    // No story line advanced: never hand back the same scenes again
    return { scenes: [], hasMoreScenes: false, sourceCovered: true, isStoryFinished: false, finishMessage: 'ไม่มีเนื้อเรื่องเหลือให้สร้างต่อ', progressPercentage: 100 };
  }
  // Long scenes → several clips, each with only its own actions (put back from the story)
  const split = splitDenseDialogueScenes(numbered.map((s: any) => ({ ...s, sourceCursor: cursor })), duration, { story: p.originalStory });
  const scenes = restoreMissingStoryBeats(split, p.originalStory, { fromDialogueIndex: resume.nextIndex, fromBeat: resume.fromBeat, toBeat: cursor }).scenes;
  const hasMoreScenes = cursor < beatCount - 1;
  const finished = !hasMoreScenes && hasExplicitEndingMarker(p.originalStory);
  const total = resume.sourceLines.length;
  return {
    ...local,
    episodeNumber: p.episodeNumber || local.episodeNumber,
    scenes,
    nextScene: scenes[0],
    hasMoreScenes,
    sourceCovered: !hasMoreScenes,
    isStoryFinished: finished,
    finishMessage: finished ? 'เนื้อเรื่องจบแล้ว (จบบริบูรณ์ตามต้นฉบับ)' : (!hasMoreScenes ? 'ใช้เนื้อเรื่องต้นฉบับครบแล้ว' : ''),
    progressPercentage: total > 0 ? Math.min(100, Math.round(((order.lastIndex + 1) / total) * 100)) : local.progressPercentage
  };
}

/**
 * The Master Continuity Lock without leftovers from another story.
 * The lock is kept between stories in the app; sent as "use in every scene, never change" it put the
 * previous story's characters (e.g. น้องน้ำ) and light (daylight) into a new night-time story.
 * - characters whose name is not in this script are dropped (with their appearance / position)
 * - place / time / light are dropped when the script names its own place or time, or when the
 *   locked place is not in the script
 */
export function lockForScript<T extends Record<string, any>>(lock: T | null | undefined, script: string): T {
  if (!lock || typeof lock !== 'object') return ({} as T);
  const text = normalizeStoryScript(String(script || ''));
  if (!text.trim()) return lock;
  const inScript = (n: unknown) => {
    const name = String(n ?? '').trim();
    return !!name && text.includes(name);
  };
  const out: any = { ...lock };
  const names = (Array.isArray(lock.characterNames) ? lock.characterNames : []).filter(inScript);
  out.characterNames = names;
  if (lock.characterName && !inScript(lock.characterName)) {
    out.characterName = names[0] || '';
    out.characterAppearance = '';
    out.characterId = undefined;
  }
  if (Array.isArray(lock.characterPositionLocks)) {
    out.characterPositionLocks = lock.characterPositionLocks.filter((p: any) => inScript(p?.name));
  }
  if (lock.characterPosition && /[ก-๙A-Za-z]/.test(String(lock.characterPosition))) {
    const all = [lock.characterName, ...(Array.isArray(lock.characterNames) ? lock.characterNames : [])].filter(Boolean);
    if (all.some(n => !inScript(n) && String(lock.characterPosition).includes(String(n)))) out.characterPosition = '';
  }
  let scriptNamesPlace = false;
  try {
    const parsed = parseStoryStructure(text);
    scriptNamesPlace = (parsed.scenes || []).some(s => {
      const loc = String(s.location || '').trim();
      return (loc && !/^ไม่ระบุ/.test(loc)) || !!String(s.timeOfDay || '').trim();
    });
  } catch { /* keep */ }
  if (scriptNamesPlace || (lock.location && !inScript(lock.location))) {
    out.location = '';
    out.locationId = undefined;
    out.locationVisualDetails = '';
    out.timeOfDay = '';
    out.lighting = '';
  }
  return out as T;
}

/**
 * Puts the story's own speaker back on every dialogue line (Gemini sometimes gives a line to a locked
 * or similarly named character, e.g. น้ำฟ้า's line to น้องน้ำ). A wrong name that is not a character of
 * this story is also replaced in the prompt text.
 */
export function fixDialogueSpeakers<T extends Record<string, any>>(
  scenes: T[],
  originalStory: string,
  opts: { promptKey?: 'visualPrompt' | 'generatedPrompt'; dialogueKey?: 'dialogue' | 'line' } = {}
): { scenes: T[]; fixed: number } {
  const promptKey = opts.promptKey || 'visualPrompt';
  const dialogueKey = opts.dialogueKey || 'dialogue';
  let parsed: ReturnType<typeof parseStoryStructure>;
  try { parsed = parseStoryStructure(originalStory); } catch { return { scenes, fixed: 0 }; }
  const src = parsed.allDialogues || [];
  if (src.length === 0) return { scenes, fixed: 0 };
  const lines = src.map(d => d.dialogue);
  const storyNames = new Set<string>([...parsed.characters.map(c => c.name), ...src.map(d => d.speaker)].filter(Boolean));
  const renames = new Map<string, string>();
  let fixed = 0;
  const out = (scenes || []).map(sc => {
    const ds = Array.isArray(sc?.dialogues) ? sc.dialogues : [];
    const nd = ds.map((d: any) => {
      const idx = matchSourceLine(d?.[dialogueKey] ?? d?.line ?? d?.dialogue, lines);
      const right = idx >= 0 ? src[idx].speaker : '';
      const wrong = String(d?.speaker || '').trim();
      if (!right || !wrong || wrong === right) return d;
      fixed++;
      if (!storyNames.has(wrong)) renames.set(wrong, right);
      return { ...d, speaker: right };
    });
    return { ...sc, dialogues: nd };
  });
  if (renames.size > 0) {
    const swap = (v: unknown) => {
      let t = String(v ?? '');
      renames.forEach((right, wrong) => { t = t.split(wrong).join(right); });
      return t;
    };
    out.forEach((sc: any) => {
      if (typeof sc[promptKey] === 'string') sc[promptKey] = swap(sc[promptKey]);
      if (Array.isArray(sc.charactersPresent)) sc.charactersPresent = Array.from(new Set(sc.charactersPresent.map((n: string) => swap(n))));
      if (Array.isArray(sc.characters)) sc.characters = Array.from(new Set(sc.characters.map((n: string) => swap(n))));
    });
  }
  return { scenes: out as T[], fixed };
}

/**
 * Meta AI copy options for one story: its characters only.
 * - photo numbers: story characters that have a library photo, in story order (fixed for every clip)
 * - identity line per character: library appearance when the character is in the library, otherwise
 *   the description the script gives in its character list ("น้ำฟ้า — ลูกสะใภ้สาวฐานะยากจน…")
 */
export function metaOptionsForStory(story: string, library: any[] = [], noteOf: (c: any) => string = () => ''): {
  knownCharacters: string[];
  photoOrder: string[];
  withPhoto: string[];
  characterNotes: Record<string, string>;
} {
  let parsed: ReturnType<typeof parseStoryStructure> | null = null;
  try { parsed = parseStoryStructure(story); } catch { parsed = null; }
  const storyNames: string[] = [];
  const add = (n: unknown) => { const t = String(n ?? '').trim(); if (t && !storyNames.includes(t)) storyNames.push(t); };
  (parsed?.characters || []).forEach(c => add(c.name));
  (parsed?.allDialogues || []).filter(d => !d.offScreen).forEach(d => add(d.speaker));
  const text = normalizeStoryScript(String(story || ''));
  const lib = (Array.isArray(library) ? library : []).filter(c => c?.name && text.includes(String(c.name)));
  lib.forEach(c => add(c.name));
  const hasPhoto = (c: any) => !!(c?.referenceImageUrl || c?.referenceMetadata?.referenceImageUrl || c?.visualProfile?.referenceImageUrl || c?.avatarUrl || (Array.isArray(c?.referenceImages) && c.referenceImages.length));
  const withPhoto = storyNames.filter(n => lib.some(c => c.name === n && hasPhoto(c)));
  const characterNotes: Record<string, string> = {};
  for (const n of storyNames) {
    const fromLib = lib.find(c => c.name === n);
    const libNote = fromLib ? String(noteOf(fromLib) || '').trim() : '';
    const scriptNote = String(parsed?.characters.find(c => c.name === n)?.description || '').trim();
    const note = libNote || scriptNote;
    if (note) characterNotes[n] = note;
  }
  return { knownCharacters: storyNames, photoOrder: withPhoto, withPhoto, characterNotes };
}
