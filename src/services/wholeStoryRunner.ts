/**
 * Whole story → prompts, start to finish, for the one-button screen.
 *
 * Calls the story-continuation endpoint chunk after chunk (≤6 scenes each, so Gemini never overflows),
 * passing back where the story stands (sourceCursor) so nothing is skipped or written twice.
 * When a chunk cannot use Gemini (not signed in, no credits, connection trouble), the rest of the
 * story is built without AI (offline engine), so the run always reaches the end.
 */
import type { StoryContinuationPayload, StoryContinuationResponse } from '../types';
import { normalizeStoryScript } from './storyNormalize';
import { isEmptyLine } from './promptSections';
import { parseStoryStructure } from './storyEpisodeEngine';

export interface StoryClip {
  clipNumber: number;
  title: string;
  durationSeconds: number;
  generatedPrompt: string;
  dialogues: { speaker: string; line: string; emotion?: string }[];
  charactersPresent?: string[];
  locationName?: string;
  timeOfDay?: string;
  startPoses?: any[];
  endPoses?: any[];
  endAction?: string;
  splitPart?: any;
  sourceCursor?: number;
}

export interface WholeStoryResult {
  clips: StoryClip[];
  notices: string[];
  usedOffline: boolean;
  finished: boolean;
  error?: string;
}

export interface WholeStoryOptions {
  characters?: any[];
  aspectRatio?: string;
  clipSeconds?: number;
  /** Start without AI (free) */
  offline?: boolean;
  onProgress?: (p: { step: number; clips: StoryClip[]; message: string }) => void;
  shouldStop?: () => boolean;
  maxSteps?: number;
}

export function sceneToClip(sc: any, clipSeconds: number): StoryClip {
  return {
    clipNumber: Number(sc?.sceneNumber) || 0,
    title: String(sc?.sceneHeading || ''),
    durationSeconds: clipSeconds,
    generatedPrompt: String(sc?.visualPrompt || ''),
    dialogues: (Array.isArray(sc?.dialogues) ? sc.dialogues : [])
      .map((d: any) => ({ speaker: String(d?.speaker || ''), line: String(d?.dialogue ?? d?.line ?? ''), ...(d?.emotionOrAction ? { emotion: String(d.emotionOrAction) } : {}) }))
      .filter((d: any) => d.line && !isEmptyLine(d.line)),
    charactersPresent: Array.isArray(sc?.characters) ? sc.characters : undefined,
    locationName: sc?.location && !/^ไม่ระบุ/.test(sc.location) ? sc.location : undefined,
    timeOfDay: sc?.timeOfDay && !/^ไม่ระบุ/.test(sc.timeOfDay) ? sc.timeOfDay : undefined,
    startPoses: sc?.startPoses,
    endPoses: sc?.endPoses,
    endAction: sc?.endState,
    splitPart: sc?.splitPart,
    sourceCursor: typeof sc?.sourceCursor === 'number' ? sc.sourceCursor : undefined
  };
}

export async function runWholeStory(
  rawStory: string,
  opts: WholeStoryOptions,
  continueStory: (payload: StoryContinuationPayload) => Promise<StoryContinuationResponse>
): Promise<WholeStoryResult> {
  const story = normalizeStoryScript(String(rawStory || ''));
  const clipSeconds = Math.max(4, Math.min(10, Number(opts.clipSeconds) || 8));
  const clips: StoryClip[] = [];
  const notices: string[] = [];
  let offline = !!opts.offline;
  let usedOffline = offline;
  let finished = false;
  let error: string | undefined;
  let retriedSameStep = false;
  const maxSteps = opts.maxSteps || 60;

  for (let step = 0; step < maxSteps; step++) {
    if (opts.shouldStop?.()) break;
    const last = clips[clips.length - 1];
    opts.onProgress?.({ step: step + 1, clips: [...clips], message: `กำลังสร้างช่วงที่ ${step + 1}${offline ? ' (ไม่ใช้ AI)' : ''} — ได้แล้ว ${clips.length} คลิป` });
    const payload: any = {
      originalStory: story,
      episodeNumber: step + 1,
      targetSceneCount: 6,
      existingScenes: clips.map(c => ({
        sceneNumber: c.clipNumber,
        title: c.title,
        endAction: c.endAction,
        sourceCursor: c.sourceCursor,
        dialogues: c.dialogues.map(d => ({ speaker: d.speaker, line: d.line }))
      })),
      lastSceneState: last ? {
        sceneNumber: last.clipNumber,
        title: last.title,
        endAction: last.endAction,
        location: last.locationName || '',
        timeOfDay: last.timeOfDay || '',
        dialogues: last.dialogues,
        endPoses: last.endPoses || [],
        sourceCursor: last.sourceCursor
      } : null,
      characters: opts.characters || [],
      continuityLock: { aspectRatio: opts.aspectRatio || '9:16' },
      clipDurationSeconds: clipSeconds,
      offline
    };

    let res: StoryContinuationResponse | null = null;
    try {
      res = await continueStory(payload);
      if (res && (res as any).success === false) throw Object.assign(new Error((res as any).message || 'ไม่สำเร็จ'), { status: 0 });
    } catch (err: any) {
      const msg = String(err?.message || err || 'การเชื่อมต่อขัดข้อง');
      if (!offline) {
        // Gemini unavailable for this account / right now: finish the story without AI
        offline = true;
        usedOffline = true;
        const why = err?.status === 401 ? 'ยังไม่ได้เข้าสู่ระบบ'
          : err?.status === 402 ? 'เครดิตไม่พอ'
          : msg;
        notices.push(`ใช้แบบไม่ใช้ AI ตั้งแต่คลิปที่ ${clips.length + 1}: ${why}`);
        step--;
        continue;
      }
      if (!retriedSameStep) {
        retriedSameStep = true;
        step--;
        continue;
      }
      error = msg;
      break;
    }
    retriedSameStep = false;

    if ((res as any)?.offline && !offline && !usedOffline) usedOffline = true;
    if ((res as any)?.fallbackNotice) notices.push(String((res as any).fallbackNotice));
    const scenes = Array.isArray(res?.scenes) && res!.scenes.length > 0 ? res!.scenes : [];
    if (scenes.length === 0) { finished = true; break; }

    const known = new Set(clips.map(c => c.clipNumber));
    let next = clips.length > 0 ? clips[clips.length - 1].clipNumber + 1 : 1;
    for (const sc of scenes) {
      const clip = sceneToClip(sc, clipSeconds);
      if (!clip.clipNumber || known.has(clip.clipNumber)) clip.clipNumber = next;
      known.add(clip.clipNumber);
      next = clip.clipNumber + 1;
      clips.push(clip);
    }
    if ((res as any)?.isStoryFinished || (res as any)?.hasMoreScenes === false) { finished = true; break; }
  }
  // Last check against the story itself: AI chunks sometimes leave a line out or say one twice, and
  // which line differs from run to run. The story's own lines are the authority.
  const fixed = reconcileWithStory(clips, story, clipSeconds);
  if (fixed.restored.length) notices.push(`ใส่บทพูดที่หายไปกลับคืน ${fixed.restored.length} ประโยค ตามลำดับในเนื้อเรื่อง`);
  if (fixed.removed.length) notices.push(`ตัดบทพูดที่ซ้ำออก ${fixed.removed.length} ประโยค (บทนี้มีครั้งเดียวในเนื้อเรื่อง)`);
  const out = fixed.clips;
  opts.onProgress?.({ step: 0, clips: [...out], message: finished ? `เสร็จแล้ว ${out.length} คลิป` : `หยุดที่ ${out.length} คลิป` });
  return { clips: out, notices: Array.from(new Set(notices)), usedOffline, finished, ...(error ? { error } : {}) };
}

const squashLine = (s: unknown) => String(s ?? '')
  .replace(/[“”"'‘’«»「」]/g, '')
  .replace(/[\s.,!?…~\-—–:;()]/g, '')
  .toLowerCase();

/**
 * Every spoken line of the story exactly once, in story order:
 * - a line said more often than the story says it is removed (a clip left with nothing is dropped);
 * - a story line no clip says gets its own clip, right after the clip with the line before it,
 *   at the same place and time, with the speaker and delivery from the story.
 * Lines the clips say that are not in the story (reworded beyond recognition) are left alone.
 */
export function reconcileWithStory(input: StoryClip[], story: string, clipSeconds = 8): { clips: StoryClip[]; restored: string[]; removed: string[] } {
  let src: { speaker: string; dialogue: string; emotionOrAction?: string }[] = [];
  try { src = parseStoryStructure(story).allDialogues.filter(d => d.dialogue && !isEmptyLine(d.dialogue)); } catch { /* no anchor */ }
  if (src.length === 0 || input.length === 0) return { clips: input, restored: [], removed: [] };
  const keys = src.map(d => squashLine(d.dialogue));
  const matchOf = (line: string, used: Set<number>, from: number): number => {
    const k = squashLine(line);
    if (k.length < 2) return -1;
    const exact = (i: number) => keys[i] === k;
    const part = (i: number) => (keys[i].includes(k) && k.length >= 4) || (k.includes(keys[i]) && keys[i].length >= 4);
    for (const test of [exact, part]) {
      for (let i = from; i < keys.length; i++) if (!used.has(i) && test(i)) return i;
      for (let i = 0; i < from; i++) if (!used.has(i) && test(i)) return i;
    }
    // every copy of this line is already used: a repeat
    for (const test of [exact, part]) for (let i = 0; i < keys.length; i++) if (test(i)) return -2;
    return -1;
  };
  const used = new Set<number>();
  const where = new Map<number, number>();   // story line -> index in clips
  const removed: string[] = [];
  const clips: StoryClip[] = [];
  let cursor = 0;
  for (const c of input) {
    const kept: StoryClip['dialogues'] = [];
    for (const d of c.dialogues || []) {
      const i = matchOf(d.line, used, cursor);
      if (i === -2) { removed.push(d.line); continue; }
      if (i >= 0) { used.add(i); where.set(i, clips.length); cursor = i + 1; }
      kept.push(d);
    }
    if ((c.dialogues || []).length > 0 && kept.length === 0) continue;   // the clip only repeated lines
    clips.push({ ...c, dialogues: kept });
  }
  const restored: string[] = [];
  for (let i = 0; i < src.length; i++) {
    if (used.has(i)) continue;
    let after = -1;
    for (let j = i - 1; j >= 0; j--) if (where.has(j)) { after = where.get(j)!; break; }
    let before = clips.length;
    for (let j = i + 1; j < src.length; j++) if (where.has(j)) { before = where.get(j)!; break; }
    const at = after >= 0 ? after + 1 : Math.min(before, clips.length);
    const near = clips[after >= 0 ? after : Math.min(at, clips.length - 1)];
    const d = src[i];
    const clip: StoryClip = {
      clipNumber: 0,
      title: near?.title || '',
      durationSeconds: near?.durationSeconds || clipSeconds,
      generatedPrompt: '',
      dialogues: [{ speaker: d.speaker, line: d.dialogue, ...(d.emotionOrAction ? { emotion: d.emotionOrAction.replace(/^[(（]|[)）]$/g, '') } : {}) }],
      charactersPresent: Array.from(new Set([...(near?.charactersPresent || []), d.speaker].filter(Boolean))),
      locationName: near?.locationName,
      timeOfDay: near?.timeOfDay,
      startPoses: near?.endPoses,
      endPoses: near?.endPoses,
      endAction: near?.endAction,
      sourceCursor: near?.sourceCursor
    };
    clips.splice(at, 0, clip);
    where.forEach((v, k) => { if (v >= at) where.set(k, v + 1); });
    where.set(i, at);
    used.add(i);
    restored.push(d.dialogue);
  }
  clips.forEach((c, k) => { c.clipNumber = k + 1; });
  return { clips, restored, removed };
}
