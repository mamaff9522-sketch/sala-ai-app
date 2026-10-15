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
