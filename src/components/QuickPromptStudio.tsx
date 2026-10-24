import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, Play, StopCircle, Wrench, UserCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Character } from '../types';
import { api } from '../services/api';
import { runWholeStory, type StoryClip } from '../services/wholeStoryRunner';
import { metaOptionsForStory, offlineContinuation } from '../services/storyProgress';
import { isClipByClipScript } from '../services/storyNormalize';
import { packMultiDialogueClips, MULTI_DIALOGUE_SECONDS } from '../services/multiDialogueClips';
import { formatClipForMetaAi, formatClipImagePrompt, buildSharedLocks, formatSharedLocks, groupClipsByPlace, formatPlaceImageBatch, IMAGE_BATCH_SIZE, formatPlaceVideoBatch, VIDEO_BATCH_SIZE, attachmentLine, sensitiveWords, formatLocationMasterPrompt, thaiLighting, metaContextFor, characterNote, charactersInClip, photoNumbers } from '../services/metaAiPrompt';
import { toCharacterLockPayload } from '../services/characterAppearance';

/**
 * One-button screen: paste the story, tap once, get a prompt for every clip, ready for Meta AI.
 * Everything else (scenes, clip split, Gemini in chunks, no-AI fallback, scene / pose / character
 * locks) is done by the system. The full tools stay one tap away.
 */
interface QuickPromptStudioProps {
  characters: Character[];
  onOpenTools: () => void;
  onOpenCharacters: () => void;
}

const DRAFT_KEY = 'sala_quick_story_draft';
const RESULT_KEY = 'sala_quick_story_result';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export const QuickPromptStudio: React.FC<QuickPromptStudioProps> = ({ characters, onOpenTools, onOpenCharacters }) => {
  const saved = loadJson<{ story: string; clips: StoryClip[]; notices: string[]; aspect: string; seconds: number } | null>(RESULT_KEY, null);
  const [story, setStory] = useState<string>(() => loadJson<string>(DRAFT_KEY, saved?.story || ''));
  const [aspect, setAspect] = useState<string>(saved?.aspect || '9:16');
  const [seconds, setSeconds] = useState<number>(saved?.seconds || 8);
  // Multi-Dialogue Clip switch: several lines / characters per 10-second clip, split automatically
  const [multi, setMulti] = useState<boolean>(() => loadJson<boolean>('sala_quick_multi_dialogue', false));
  useEffect(() => { saveJson('sala_quick_multi_dialogue', multi); }, [multi]);
  const [clips, setClips] = useState<StoryClip[]>(saved?.clips || []);
  const [resultStory, setResultStory] = useState<string>(saved?.story || '');
  const [notices, setNotices] = useState<string[]>(saved?.notices || []);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const stopRef = useRef(false);

  useEffect(() => { saveJson(DRAFT_KEY, story); }, [story]);

  // A photo address is not a photo: check that each library character's picture really loads.
  // One that does not (file lost on the server) is not used as a reference and is reported.
  const [brokenPhotos, setBrokenPhotos] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const sourcesOf = (c: any): string[] => [c?.referenceImageBackup, c?.referenceImageUrl, c?.visualProfile?.referenceImageUrl,
      c?.visualProfile?.referenceImage, c?.avatarUrl, Array.isArray(c?.referenceImages) ? c.referenceImages[0] : '']
      .filter((u: any) => typeof u === 'string' && u.trim());
    const loads = (src: string) => new Promise<boolean>(resolve => {
      const img = new Image();
      const t = setTimeout(() => resolve(false), 10000);
      img.onload = () => { clearTimeout(t); resolve(img.naturalWidth > 0); };
      img.onerror = () => { clearTimeout(t); resolve(false); };
      img.src = src;
    });
    (async () => {
      const broken: string[] = [];
      for (const c of characters || []) {
        const srcs = sourcesOf(c);
        if (!c?.name || srcs.length === 0) continue;
        let ok = false;
        for (const src of srcs) { if (await loads(src)) { ok = true; break; } }
        if (!ok) broken.push(c.name);
      }
      if (!cancelled) setBrokenPhotos(broken);
    })();
    return () => { cancelled = true; };
  }, [characters]);

  // Meta AI copy for each clip: only this story's characters, fixed photo numbers, scene / pose locks
  const metaOpts = useMemo(() => {
    const lib = (characters || []).map(c => ({
      ...toCharacterLockPayload(c), avatarUrl: (c as any).avatarUrl, referenceImages: (c as any).referenceImages,
      referenceImageBackup: (c as any).referenceImageBackup, photoBroken: brokenPhotos.includes(c.name)
    }));
    return { ...metaOptionsForStory(resultStory, lib, characterNote), aspectRatio: aspect };
  }, [characters, resultStory, aspect, brokenPhotos]);
  const prompts = useMemo(
    () => clips.map((c, i) => formatClipForMetaAi(c as any, { ...metaOpts, ...metaContextFor(clips as any, i) })),
    [clips, metaOpts]
  );
  // Box 1 of every card: a still image that matches the clip (made first, then animated)
  const imagePrompts = useMemo(
    () => clips.map((c, i) => formatClipImagePrompt(c as any, { ...metaOpts, ...metaContextFor(clips as any, i) })),
    [clips, metaOpts]
  );
  // Image prompts by place: clips at the same place and time, copied together to make the images at once
  const placeGroups = useMemo(() => groupClipsByPlace(clips as any), [clips]);
  const ranges = (nums: number[]) => {
    const out: string[] = [];
    for (let k = 0; k < nums.length; k++) {
      let j = k;
      while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
      out.push(j > k ? `${nums[k]}–${nums[j]}` : `${nums[k]}`);
      k = j;
    }
    return out.join(', ');
  };
  const photoLine = (c: StoryClip) => {
    const names = charactersInClip(c as any, metaOpts.knownCharacters).filter(n => metaOpts.withPhoto.includes(n));
    const nums = photoNumbers(names, metaOpts);
    return names.sort((a, b) => (nums.get(a) || 0) - (nums.get(b) || 0)).map(n => `รูปที่ ${nums.get(n)} ${n}`).join('  ');
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(key);
    setTimeout(() => setCopied(c => (c === key ? null : c)), 2000);
  };

  const copyAll = () => {
    const all = clips.map((c, i) => {
      const photos = photoLine(c);
      const att = attachmentLine(c as any, { ...metaOpts, ...metaContextFor(clips as any, i) });
      return `=== คลิป ${i + 1}/${clips.length} ===${att ? `\n(แนบก่อนพิมพ์: ${att})` : ''}\n[พรอมต์สร้างภาพ]\n${imagePrompts[i]}\n[พรอมต์วิดีโอ]\n${prompts[i]}`;
    }).join('\n\n');
    // The story's shared locks once at the top; every clip prompt below still carries what Meta AI needs
    const tips = 'วิธีใช้กับ Meta AI: แนบไฟล์ตาม "แนบก่อนพิมพ์" ทุกช็อตก่อนพิมพ์ · สร้างภาพนิ่งก่อนแล้วค่อยทำเป็นวิดีโอ · คลิปต่อเนื่องให้แนบเฟรมสุดท้ายของคลิปก่อน · ใช้โหมด Quality · เริ่มแชทใหม่เป็นระยะแล้วแนบมาสเตอร์ใหม่';
    copy(`${tips}\n\n${formatSharedLocks(buildSharedLocks(clips as any, metaOpts))}\n\n${all}`, 'all');
  };

  const start = async () => {
    const text = story.trim();
    if (!text) { setError('วางเนื้อเรื่องก่อนครับ'); return; }
    stopRef.current = false;
    setRunning(true);
    setError(null);
    setNotices([]);
    setClips([]);
    setResultStory(text);
    setProgress('กำลังเริ่ม...');
    const lib = (characters || []).filter(c => c?.name && text.includes(c.name)).map(c => toCharacterLockPayload(c));
    // Already split clip by clip by the writer: use the clips exactly as written, on this phone,
    // free (Gemini would only rewrite them, at the cost of one call per 6 clips)
    const exact = isClipByClipScript(text);
    const runLocal = async (payload: any) => {
      await new Promise(r => setTimeout(r, 0)); // let the progress line update
      return { success: true, ...offlineContinuation(payload) } as any;
    };
    try {
      const r = await runWholeStory(text, {
        characters: lib,
        aspectRatio: aspect,
        clipSeconds: multi ? MULTI_DIALOGUE_SECONDS : seconds,
        offline: exact,
        maxSteps: exact ? 400 : undefined,
        shouldStop: () => stopRef.current,
        onProgress: p => { setProgress(p.message); setClips(p.clips); }
      }, exact ? runLocal : (payload => api.continueStory(payload)));
      if (multi && r.clips.length > 0) {
        // pack into 10-second clips with several lines each (never cutting a line)
        const before = r.clips.length;
        const packed = packMultiDialogueClips(r.clips, { seconds: MULTI_DIALOGUE_SECONDS });
        const long = packed.filter(c => c.overLong).map(c => c.clipNumber);
        r.notices.unshift(`หลายบทพูดต่อคลิป: จัด ${before} ช่วงเป็น ${packed.length} คลิป คลิปละ ${MULTI_DIALOGUE_SECONDS} วินาที ไม่ตัดประโยค`
          + (long.length ? ` (ประโยคยาวเกิน ${MULTI_DIALOGUE_SECONDS} วินาที อยู่คลิปเดียวของมันเอง: คลิป ${long.join(', ')})` : ''));
        r.clips = packed;
      }
      setClips(r.clips);
      const notices = r.notices.filter(n => !exact || !n.includes('ไม่ใช้ AI ตั้งแต่'));
      if (exact) notices.unshift('บทนี้แบ่งคลิปมาแล้ว ระบบใช้คลิปตามบทเป๊ะทุกคลิป สร้างในเครื่อง ไม่ใช้ AI ไม่เสียเครดิต');
      r.notices = notices;
      setNotices(notices);
      if (r.error) setError(`สร้างได้ ${r.clips.length} คลิปแล้วเกิดปัญหา: ${r.error} — กดสร้างใหม่อีกครั้งได้`);
      saveJson(RESULT_KEY, { story: text, clips: r.clips, notices: r.notices, aspect, seconds: multi ? MULTI_DIALOGUE_SECONDS : seconds });
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setRunning(false);
      setProgress('');
    }
  };

  const libraryInStory = (characters || []).filter(c => c?.name && story.includes(c.name)).length;

  return (
    <div className="min-h-screen text-white pb-28 pt-3 px-3 sm:px-6 app-sky font-sans">
      <div className="max-w-xl mx-auto space-y-3">
        <header className="flex items-start justify-between gap-2 px-1">
          <div>
            <h1 className="text-xl font-bold">สร้างพรอมต์จากเรื่อง</h1>
            <p className="text-[13px] text-slate-300 mt-0.5">วางเนื้อเรื่อง กดปุ่มเดียว ได้พรอมต์ทุกคลิปพร้อมวางใน Meta AI</p>
          </div>
          <button
            type="button"
            onClick={onOpenTools}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-200"
          >
            <Wrench className="w-4 h-4" /> เครื่องมือเต็ม
          </button>
        </header>

        <div className="rounded-2xl border border-slate-700 bg-[#0b1224]/90 p-3 space-y-3">
          <textarea
            value={story}
            onChange={e => setStory(e.target.value)}
            disabled={running}
            placeholder={'วางเนื้อเรื่องที่นี่ เช่น\n\nตัวละคร\nน้ำฟ้า ลูกสะใภ้สาว\n\nฉาก: คฤหาสน์หรู กลางคืน\nคุณหญิงมณีโยนกระเป๋า...\nคุณหญิงมณี: "ออกไปจากบ้านฉัน!"'}
            className="w-full min-h-[220px] rounded-xl bg-slate-950/80 border border-slate-700 p-3 text-[15px] leading-relaxed text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-slate-400">สัดส่วน</span>
            {['9:16', '16:9'].map(a => (
              <button key={a} type="button" disabled={running} onClick={() => setAspect(a)}
                className={`px-3 py-1.5 rounded-lg border ${aspect === a ? 'border-indigo-400 bg-indigo-600/30 text-white' : 'border-slate-700 text-slate-300'}`}>
                {a}
              </button>
            ))}
            <span className="text-slate-400 ml-2">ความยาวคลิป</span>
            {[8, 10].map(s => (
              <button key={s} type="button" disabled={running || (multi && s !== MULTI_DIALOGUE_SECONDS)} onClick={() => setSeconds(s)}
                className={`px-3 py-1.5 rounded-lg border disabled:opacity-40 ${(multi ? MULTI_DIALOGUE_SECONDS : seconds) === s ? 'border-indigo-400 bg-indigo-600/30 text-white' : 'border-slate-700 text-slate-300'}`}>
                {s} วิ
              </button>
            ))}
          </div>
          <label className="flex items-start gap-2.5 rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-[13px] cursor-pointer">
            <input type="checkbox" checked={multi} disabled={running} onChange={e => setMulti(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-500" />
            <span>
              <span className="font-semibold text-slate-100">หลายบทพูดต่อคลิป (Multi-Dialogue)</span>
              <span className="block text-slate-400">แบ่งคลิปอัตโนมัติตามเวลา คลิปละ {MULTI_DIALOGUE_SECONDS} วินาที หลายประโยคและหลายตัวละครในคลิปเดียว ไม่ตัดกลางประโยค พูดไม่ทันย้ายไปคลิปถัดไป (Meta แนะนำ 1 คนพูดต่อคลิป ปิดไว้จะได้ผลแม่นกว่า)</span>
            </span>
          </label>

          <button
            type="button"
            onClick={running ? () => { stopRef.current = true; } : start}
            disabled={!running && !story.trim()}
            className={`w-full py-3.5 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 ${
              running ? 'bg-rose-600 text-white' : 'bg-gradient-to-r from-cyan-500 via-indigo-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-600/30'
            }`}
          >
            {running ? <><StopCircle className="w-5 h-5" /> {progress || 'กำลังสร้าง...'} (แตะเพื่อหยุด)</> : <><Play className="w-5 h-5 fill-current" /> สร้างพรอมต์ทั้งเรื่อง</>}
          </button>

          <button type="button" onClick={onOpenCharacters} className="w-full text-left text-[12px] text-slate-400 flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-slate-500" />
            {libraryInStory > 0
              ? `ใช้หน้าตาจากคลังตัวละคร ${libraryInStory} ตัวที่มีชื่อในเรื่องนี้ (แตะเพื่อดูคลัง)`
              : 'ตัวละครที่ไม่มีในคลังจะใช้คำอธิบายจากรายชื่อตัวละครในบท (แตะเพื่อเพิ่มรูปในคลัง)'}
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-[13px] text-rose-200 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
          </div>
        )}
        {notices.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/30 p-3 text-[12px] text-amber-200 space-y-1">
            {notices.map((n, i) => <div key={i}>• {n}</div>)}
          </div>
        )}

        {clips.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-[14px] font-semibold">
                {!running && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {running ? `ได้แล้ว ${clips.length} คลิป...` : `ได้ ${clips.length} คลิป`}
              </div>
              {!running && (
                <button type="button" onClick={copyAll}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-[13px] font-semibold">
                  {copied === 'all' ? <><Check className="w-4 h-4" /> คัดลอกแล้ว</> : <><Copy className="w-4 h-4" /> คัดลอกทั้งหมด</>}
                </button>
              )}
            </div>
            {!running && (
              <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-[12px] text-slate-300 leading-relaxed">
                วิธีใช้กับ Meta AI: แนบไฟล์ตาม "แนบก่อนพิมพ์" ทุกช็อตก่อนพิมพ์ · สร้างภาพนิ่งก่อนแล้วค่อยทำเป็นวิดีโอ · คลิปต่อเนื่องให้แนบเฟรมสุดท้ายของคลิปก่อน · ใช้โหมด Quality ไม่ใช่ Instant · เริ่มแชทใหม่เป็นระยะหรือเมื่อภาพเริ่มเพี้ยน แล้วแนบมาสเตอร์ใหม่
              </div>
            )}
            {!running && placeGroups.length > 0 && (
              <details className="rounded-2xl border border-amber-500/40 bg-[#0b1224]/90 p-3">
                <summary className="cursor-pointer text-[13px] font-semibold text-amber-300">
                  คัดลอกพรอมต์ตามสถานที่ (ภาพ / วิดีโอ หลายคลิปพร้อมกัน)
                </summary>
                <p className="mt-1.5 text-[12px] text-slate-400">
                  ทำ "ภาพมาสเตอร์สถานที่" ของแต่ละที่ก่อน แล้วแนบทุกครั้งที่สร้างภาพหรือวิดีโอในที่นั้น คลิปที่อยู่สถานที่และเวลาเดียวกัน รวมเป็นพรอมต์เดียว ชุดละไม่เกิน {IMAGE_BATCH_SIZE} ภาพ หรือ {VIDEO_BATCH_SIZE} คลิปวิดีโอ ข้อมูลตัวละคร ชุด สถานที่ แสง และเสียง เขียนครั้งเดียวด้านบน
                </p>
                <div className="mt-2 space-y-2.5">
                  {placeGroups.map((g, gi) => {
                    const chunks: number[][] = [];
                    for (let k = 0; k < g.clips.length; k += IMAGE_BATCH_SIZE) chunks.push(g.clips.slice(k, k + IMAGE_BATCH_SIZE));
                    const videoChunks: number[][] = [];
                    for (let k = 0; k < g.clips.length; k += VIDEO_BATCH_SIZE) videoChunks.push(g.clips.slice(k, k + VIDEO_BATCH_SIZE));
                    return (
                      <div key={gi} className="rounded-xl border border-slate-700 p-2">
                        <div className="text-[13px] font-semibold text-slate-100">{[g.location, g.timeOfDay].filter(Boolean).join(' · ') || 'ไม่ระบุสถานที่'}</div>
                        <div className="text-[12px] text-slate-400">คลิป {ranges(g.clips.map(i => i + 1))} ({g.clips.length} ภาพ)</div>
                        <button type="button"
                          onClick={() => {
                            const raw = String((clips[g.clips[0]] as any)?.generatedPrompt || '').match(/Lighting Lock:\s*([^.]*)/)?.[1] || '';
                            copy(formatLocationMasterPrompt(g.location, g.timeOfDay, thaiLighting(raw, g.timeOfDay), aspect), `master${gi}`);
                          }}
                          className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-slate-900 px-2.5 py-1 text-[12px]">
                          {copied === `master${gi}` ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> คัดลอกแล้ว</> : <><Copy className="w-3.5 h-3.5" /> ภาพมาสเตอร์สถานที่ (ทำก่อน)</>}
                        </button>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-amber-300 w-12">ภาพ</span>
                          {chunks.map((ch, ci) => (
                            <button key={ci} type="button"
                              onClick={() => copy(formatPlaceImageBatch(clips as any, ch, metaOpts), `place${gi}-${ci}`)}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/50 bg-slate-900 px-2.5 py-1 text-[12px]">
                              {copied === `place${gi}-${ci}` ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> คัดลอกแล้ว</> : <><Copy className="w-3.5 h-3.5" /> คลิป {ranges(ch.map(i => i + 1))}</>}
                            </button>
                          ))}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-indigo-300 w-12">วิดีโอ</span>
                          {videoChunks.map((ch, ci) => (
                            <button key={ci} type="button"
                              onClick={() => copy(formatPlaceVideoBatch(clips as any, ch, metaOpts), `vplace${gi}-${ci}`)}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/50 bg-slate-900 px-2.5 py-1 text-[12px]">
                              {copied === `vplace${gi}-${ci}` ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> คัดลอกแล้ว</> : <><Copy className="w-3.5 h-3.5" /> คลิป {ranges(ch.map(i => i + 1))}</>}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
            {clips.map((c, i) => {
              const photos = photoLine(c);
              return (
                <div key={`${c.clipNumber}-${i}`} className="rounded-2xl border border-slate-700 bg-[#0b1224]/90 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold">คลิป {i + 1}</div>
                      <div className="text-[12px] text-slate-400 truncate">{String(c.title || '').replace(/\s*[-–—/]?\s*ไม่ระบุ(?:จากต้นฉบับ)?/g, '')}</div>
                    </div>
                    <button type="button" onClick={() => copy(prompts[i], `c${i}`)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5 text-[13px]">
                      {copied === `c${i}` ? <><Check className="w-4 h-4 text-emerald-400" /> คัดลอกแล้ว</> : <><Copy className="w-4 h-4" /> คัดลอก</>}
                    </button>
                  </div>
                  {(() => {
                    const att = attachmentLine(c as any, { ...metaOpts, ...metaContextFor(clips as any, i) });
                    const risky = sensitiveWords(c as any);
                    return <>
                      {att && <div className="mt-1.5 text-[12px] text-cyan-300">แนบใน Meta AI ก่อนพิมพ์: {att}</div>}
                      {risky.length > 0 && <div className="mt-1 flex items-start gap-1 text-[12px] text-rose-300"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />มีการกระทำที่ Meta อาจปฏิเสธ ({risky.join(', ')}) พรอมต์สั่งให้เป็นดราม่าด้วยคำพูดแทนแล้ว</div>}
                    </>;
                  })()}
                  <div className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12px] font-semibold text-amber-300">1. พรอมต์สร้างภาพ</div>
                      <button type="button" onClick={() => copy(imagePrompts[i], `img${i}`)}
                        className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-slate-900 px-2.5 py-1 text-[12px]">
                        {copied === `img${i}` ? <><Check className="w-3.5 h-3.5 text-emerald-400" /> คัดลอกแล้ว</> : <><Copy className="w-3.5 h-3.5" /> คัดลอกภาพ</>}
                      </button>
                    </div>
                    {(() => {
                      // Spec: no reference image -> say so (the prompt never invents a look for them)
                      const missing = charactersInClip(c as any, metaOpts.knownCharacters).filter(n => !metaOpts.withPhoto.includes(n));
                      const lost = missing.filter(n => brokenPhotos.includes(n));
                      const none = missing.filter(n => !brokenPhotos.includes(n));
                      return missing.length > 0
                        ? <div className="mt-1 space-y-0.5 text-[12px] text-amber-200">
                            {lost.length > 0 && <div className="flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />รูปอ้างอิงหาย โหลดไม่ได้: {lost.join(', ')} — อัปโหลดรูปใหม่ในคลังตัวละคร</div>}
                            {none.length > 0 && <div className="flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />ยังไม่มีรูปอ้างอิง: {none.join(', ')} — เพิ่มรูปในคลังตัวละครเพื่อล็อกหน้าตาและชุด</div>}
                          </div>
                        : null;
                    })()}
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words line-clamp-3">{imagePrompts[i]}</p>
                  </div>
                  <div className="mt-2 text-[12px] font-semibold text-indigo-300">2. พรอมต์วิดีโอ <span className="font-normal text-slate-400">(ปุ่มคัดลอกด้านบน)</span></div>
                  {c.dialogues.length > 0 && (
                    <div className="mt-2 space-y-0.5 text-[13px] text-slate-200">
                      {c.dialogues.map((d, j) => <div key={j}><span className="text-slate-400">{d.speaker}:</span> “{d.line}”</div>)}
                    </div>
                  )}
                  <details className="mt-2">
                    <summary className="text-[12px] text-slate-400 cursor-pointer">ดูพรอมต์เต็ม</summary>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-slate-300 whitespace-pre-wrap break-words">{prompts[i]}</p>
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
