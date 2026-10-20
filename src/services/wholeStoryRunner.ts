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

export interface StoryClip {
  clipNumber: number;
  title: string;
  durationSeconds: number;
  generatedPrompt: string;
  dialogues: { speaker: string; line: string }[];
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
      .map((d: any) => ({ speaker: String(d?.speaker || ''), line: String(d?.dialogue ?? d?.line ?? '') }))
      .filter((d: any) => d.line),
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
  opts.onProgress?.({ step: 0, clips: [...clips], message: finished ? `เสร็จแล้ว ${clips.length} คลิป` : `หยุดที่ ${clips.length} คลิป` });
  return { clips, notices: Array.from(new Set(notices)), usedOffline, finished, ...(error ? { error } : {}) };
}
