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
import { parseStoryStructure } from './storyEpisodeEngine';
import { findSections } from './promptSections';

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
  return {
    sourceLines,
    nextIndex: last + 1,
    lastWrittenIndex: last,
    remainingText,
    lastWrittenLine,
    anchored
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
  opts: { promptKey?: 'visualPrompt' | 'generatedPrompt'; numberKey?: 'sceneNumber' | 'clipNumber'; titleKey?: 'sceneHeading' | 'title'; endKey?: 'endState' | 'endAction' } = {}
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
      const lastLine = lineOf(g[g.length - 1]);
      const prevLast = k > 0 ? lineOf(groups[k - 1][groups[k - 1].length - 1]) : '';
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
        ...(k > 0 ? { startAction: `ต่อเนื่องจากคลิปก่อน หลังบทพูด "${prevLast}" ฉาก ท่าทาง และตำแหน่งเดิม` } : {}),
        ...(k < groups.length - 1 ? { [endKey]: `ยังอยู่ในฉากเดิม หลังบทพูด "${lastLine}" ส่งต่อคลิปถัดไป` } : {}),
        // sourceSceneNumber marks the parts as one scene for the continuity check (cast carried, no "disappears")
        splitPart: { sourceSceneNumber: Number(scene?.[numberKey]) || 0, part: k + 1, total: groups.length, reason: `บทพูดยาวเกิน ${duration} วินาที แบ่งเป็น ${groups.length} คลิป` }
      } as T);
    });
  }
  const start = Number(scenes?.[0]?.[numberKey]) || 1;
  return out.map((s, i) => ({ ...s, [numberKey]: start + i }));
}
