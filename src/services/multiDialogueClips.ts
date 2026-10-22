/**
 * Multi-Dialogue Clip: automatic split by time, several lines and several characters per clip.
 *
 * Off by default (switch on the one-button screen). When on, the clips the story engine made are
 * packed into 10-second clips:
 * - consecutive clips at the SAME place and time are joined while their speaking time fits;
 * - a line is never cut: one that does not fit moves, whole, to the next clip;
 * - a line longer than a whole clip keeps its own clip (and is reported), still never cut;
 * - lines stay with their speakers, in story order, with their delivery (emotion);
 * - never across a change of place or time; start pose = the first part's, end pose = the last part's.
 * Each packed clip carries `sequence`: what happens and who speaks, in order, with rough times,
 * so the video prompt can say who talks when (see formatClipForMetaAi).
 */
import type { StoryClip } from './wholeStoryRunner';
import { clipAction, sceneOfClip, samePlace } from './metaAiPrompt';
import { isEmptyLine } from './promptSections';

export const MULTI_DIALOGUE_SECONDS = 10;
/** Share of the clip used for speech (the rest: reactions, breaths, the start and end poses) */
export const SPEECH_SHARE = 0.8;
/** ~12 Thai characters per second plus a short pause per line (same measure as the scene splitter) */
export const lineSeconds = (line: string) => String(line || '').replace(/\s/g, '').length / 12 + 0.6;
/** A part with no line still needs time to be acted */
const SILENT_PART_SECONDS = 2.5;
const ACTION_SECONDS = 1;

export interface SequenceStep {
  kind: 'action' | 'line';
  text: string;
  speaker?: string;
  /** line number inside the clip (1-based), for lines */
  n?: number;
  start: number;
  end: number;
}

export interface PackedClip extends StoryClip {
  sequence?: SequenceStep[];
  /** clip numbers this clip was made from */
  mergedFrom?: number[];
  /** a single line longer than the clip: kept whole in its own clip */
  overLong?: boolean;
}

interface Part {
  clip: StoryClip;
  index: number;
  action: string;
  lines: { speaker: string; line: string; emotion?: string }[];
  seconds: number;
}

function partOf(clip: StoryClip, index: number): Part {
  const action = clipAction(clip as any).replace(/\s*\[มุมกล้อง\s+[^\]]+\]\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const lines = (clip.dialogues || []).filter(d => String(d?.line || '').trim() && !isEmptyLine(d.line));
  const speech = lines.reduce((t, d) => t + lineSeconds(d.line), 0);
  return { clip, index, action, lines, seconds: lines.length ? speech + (action ? ACTION_SECONDS : 0) : SILENT_PART_SECONDS };
}

function buildClip(parts: Part[], clipNumber: number, seconds: number): PackedClip {
  const first = parts[0].clip;
  const last = parts[parts.length - 1].clip;
  const steps: SequenceStep[] = [];
  let t = 0;
  let n = 0;
  for (const p of parts) {
    if (p.action) {
      const d = p.lines.length ? ACTION_SECONDS : SILENT_PART_SECONDS;
      steps.push({ kind: 'action', text: p.action, start: t, end: t + d });
      t += d;
    }
    for (const l of p.lines) {
      const d = lineSeconds(l.line);
      steps.push({ kind: 'line', text: l.line, speaker: l.speaker, n: ++n, start: t, end: t + d });
      t += d;
    }
  }
  // spread over the clip when there is time to spare (pauses between beats), never past its end
  const scale = t > 0 && t < seconds * SPEECH_SHARE ? (seconds * SPEECH_SHARE) / t : (t > seconds ? seconds / t : 1);
  const round = (x: number) => Math.round(x * scale * 2) / 2;
  steps.forEach(s => { s.start = round(s.start); s.end = Math.max(round(s.end), s.start + 0.5); });
  const prompt = String(first.generatedPrompt || '');
  const userCamera = parts.map(p => String(p.clip.generatedPrompt || '').match(/\[มุมกล้อง\s+[^\]]+\]/)?.[0]).find(Boolean) || '';
  const lighting = prompt.match(/Lighting Lock:\s*[^.]*\./)?.[0] || '';
  const names: string[] = [];
  parts.forEach(p => (p.clip.charactersPresent || []).concat(p.lines.map(l => l.speaker)).forEach(x => { if (x && !names.includes(x)) names.push(x); }));
  const actions = parts.map(p => p.action).filter(Boolean);
  return {
    ...first,
    clipNumber,
    durationSeconds: seconds,
    generatedPrompt: [userCamera, actions.length ? `Scene Action: ${actions.join(' ')}.` : '', lighting].filter(Boolean).join(' '),
    dialogues: parts.flatMap(p => p.lines.map(l => ({ ...l }))),
    charactersPresent: names,
    startPoses: first.startPoses,
    endPoses: last.endPoses,
    endAction: last.endAction,
    splitPart: undefined,
    sourceCursor: last.sourceCursor,
    sequence: steps,
    mergedFrom: parts.map(p => p.clip.clipNumber || p.index + 1),
    overLong: parts.length === 1 && parts[0].lines.length === 1 && parts[0].seconds > seconds
  };
}

/** Packs the story's clips into 10-second clips with several lines each (see the file comment). */
export function packMultiDialogueClips(clips: StoryClip[], opts: { seconds?: number } = {}): PackedClip[] {
  const seconds = opts.seconds || MULTI_DIALOGUE_SECONDS;
  const budget = seconds * SPEECH_SHARE;
  const out: PackedClip[] = [];
  let group: Part[] = [];
  let used = 0;
  let where = { location: '', timeOfDay: '' };
  const flush = () => { if (group.length) out.push(buildClip(group, out.length + 1, seconds)); group = []; used = 0; };
  clips.forEach((clip, i) => {
    const part = partOf(clip, i);
    const here = sceneOfClip(clips as any, i);
    const sameSet = group.length > 0
      && (!here.location || !where.location || samePlace(here.location, where.location))
      && (here.timeOfDay || '') === (where.timeOfDay || '');
    // a whole part moves to the next clip when it does not fit (lines are never cut)
    if (!sameSet || used + part.seconds > budget) flush();
    if (group.length === 0) where = here;
    // a part that alone is longer than the clip with several lines: its lines go one clip at a time
    if (part.seconds > budget && part.lines.length > 1) {
      part.lines.forEach((l, k) => {
        const sub: Part = { ...part, action: k === 0 ? part.action : '', lines: [l], seconds: lineSeconds(l.line) + (k === 0 && part.action ? ACTION_SECONDS : 0) };
        if (used + sub.seconds > budget) flush();
        if (group.length === 0) where = here;
        group.push(sub);
        used += sub.seconds;
      });
      return;
    }
    group.push(part);
    used += part.seconds;
  });
  flush();
  return out;
}
