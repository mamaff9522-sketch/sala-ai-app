/**
 * Spoken lines for the Dialogue Lock list.
 * Parsed from the script in the app (not from the website). Each entry is a
 * real line from the script so the lock section is not left empty, and the
 * camera row can offer AUTO, OTS, CU, 2S, MID, and W.
 */
import type { DialogueBackgroundControl, DialogueCameraAngle, DialogueLockEntry } from '../types';
import { parseScriptLocally } from './localScriptParser';

export const DIALOGUE_CAMERA_ANGLES: DialogueCameraAngle[] = ['AUTO', 'OTS', 'CU', '2S', 'MID', 'W'];

function lineOf(raw: any): string {
  const line = String(raw?.line || raw?.dialogue || raw?.text || '').trim();
  if (!line || line.toUpperCase() === 'NONE') return '';
  return line;
}

function clipOf(raw: any, index: number): number {
  const n = Number(raw?.clipNumber || raw?.sceneNumber);
  return Number.isFinite(n) && n > 0 ? n : index + 1;
}

/** Normalize API or clip dialogue objects (line or dialogue) into lock entries. */
export function dialogueLockEntriesFromUnknown(raw: unknown): DialogueLockEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: DialogueLockEntry[] = [];
  raw.forEach((item, index) => {
    const speaker = String((item as any)?.speaker || (item as any)?.character || '').trim();
    const line = lineOf(item);
    if (!speaker || !line) return;
    const angles = (item as any)?.cameraAngles;
    out.push({
      id: String((item as any)?.id || `diag_lock_${index + 1}`),
      speaker,
      line,
      emotionTone: String((item as any)?.emotionTone || (item as any)?.emotionOrAction || 'ตามบทต้นฉบับ'),
      clipNumber: clipOf(item, index),
      cameraAngles: Array.isArray(angles) ? angles.filter((a: string) => DIALOGUE_CAMERA_ANGLES.includes(a as DialogueCameraAngle)) : undefined,
      backgroundControl: (item as any)?.backgroundControl as DialogueBackgroundControl | undefined
    });
  });
  return out;
}

/** Spoken lines that are actually in the script text. Empty when the script has none. */
export function dialogueLockEntriesFromScript(scriptText: string): DialogueLockEntry[] {
  const text = String(scriptText || '').trim();
  if (!text) return [];
  try {
    const parsed = parseScriptLocally(text);
    return dialogueLockEntriesFromUnknown(parsed?.dialogues);
  } catch {
    return [];
  }
}

function sameLine(a: DialogueLockEntry, b: DialogueLockEntry): boolean {
  return a.speaker === b.speaker && a.line === b.line && (a.clipNumber || 0) === (b.clipNumber || 0);
}

/** Keep camera / background choices the user already set for the same spoken line. */
export function mergeDialogueLock(parsed: DialogueLockEntry[], previous: DialogueLockEntry[]): DialogueLockEntry[] {
  if (parsed.length === 0) return previous;
  return parsed.map((entry, index) => {
    const hit = previous.find(d => sameLine(d, entry))
      || previous.find(d => d.speaker === entry.speaker && d.line === entry.line);
    if (!hit) return { ...entry, id: entry.id || `diag_lock_${index + 1}` };
    return {
      ...entry,
      id: hit.id || entry.id,
      emotionTone: hit.emotionTone || entry.emotionTone,
      cameraAngles: hit.cameraAngles,
      backgroundControl: hit.backgroundControl
    };
  });
}

export function dialogueLockSignature(entries: DialogueLockEntry[]): string {
  return entries.map(d => [
    d.speaker,
    d.line,
    d.clipNumber || 0,
    (d.cameraAngles || []).join('+'),
    d.backgroundControl || '',
    d.emotionTone || ''
  ].join('\u0001')).join('\u0002');
}
