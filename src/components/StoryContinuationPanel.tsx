import React, { useState, useRef } from 'react';
import {
  BookOpen,
  FastForward,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Layers,
  StopCircle,
  RotateCcw,
  Film,
  ChevronDown,
  ChevronUp,
  Info,
  Check
} from 'lucide-react';
import {
  DirectedClipItem,
  Character,
  MasterContinuityLock,
  DialogueLockEntry,
  StoryContinuationResponse,
  StoryContinuedScene
} from '../types';
import { api } from '../services/api';
import { toCharacterLockPayload } from '../services/characterAppearance';

const SAMPLE_ORIGINAL_STORIES = [
  {
    title: 'ภพ & มีน: สืบปมลับโกดังริมน้ำ (3-4 ฉาก)',
    story: `ภพ หัวหน้าแก๊งผู้สุขุมแต่ระแวงคนง่าย นัดพบกับ มีน เจ้าหน้าที่สายสืบที่ปลอมตัวเข้ามาทำงานในทีมเป็นเวลาหลายเดือน ณ โกดังร้างริมแม่น้ำเจ้าพระยายามค่ำคืน

ฉากเริ่มจาก ภพ สงสัยว่าข้อมูลการส่งของลับหลุดไปถึงมือนายอำเภอได้อย่างไร ภพจึงเรียกมีนมาซักถามเด็ดขาดที่หน้าโต๊ะทำงานกลางโกดัง
มีนใช้ความเยือกเย็น เอาเอกสารบันทึกเวลาเปิดตู้เซฟมายืนยันความบริสุทธิ์ของตนเอง และชี้เป้าว่ามีสายรั่วอีกคนหนึ่งในทีมคือ ชัย คนสนิทของภพ
ภพเริ่มลังเลและสั่งให้ลูกน้องแอบไปตรวจค้นตู้ล็อกเกอร์ของชัย และพบโทรศัพท์เครื่องลับที่ใช้ส่งข้อความจริง
ในที่สุด ภพตระหนักว่ามีนพูดความจริงและหันมาให้ความไว้วางใจมีนอย่างแท้จริง ทั้งสองเตรียมแผนตลบหลังเพื่อจับกุมคนทรยศตัวจริง เป็นการปิดฉากความคลางแคลงใจลงอย่างสมบูรณ์`
  },
  {
    title: 'ฟ้าใส & กานต์: แสงแรกแห่งดอยหลวง (3 ฉาก)',
    story: `ฟ้าใส ช่างภาพสาวผู้สูญเสียแรงบันดาลใจ เดินทางขึ้นสู่ยอดดอยหลวงเชียงดาวคนเดียวเพื่อตามหาแสงแรกตามคำสัญญาในอดีต เธอได้พบกับ กานต์ เจ้าหน้าที่พิทักษ์ป่าหนุ่มใจดีผู้คอยดูแลเส้นทางธรรมชาติ

ทั้งคู่เริ่มจากการเดินฝ่าสายหมอกหนาในยามเช้าตรู่ ฟ้าใสสะดุดล้มจนกล้องหลุดมือ แต่กานต์รับไว้ได้ทันและช่วยพยุงเธอขึ้นมา ทั้งสองได้เปิดใจพูดคุยกันถึงความสูญเสียในอดีต กานต์เล่าว่าเขาก็เคยสูญเสียคนรักและเลือกมาใช้ชีวิตปกป้องผืนป่าแห่งนี้
เมื่อเดินถึงจุดชมวิวยอดดอย แสงอาทิตย์สีทองแรกของวันส่องกระทบทะเลหมอกอย่างงดงาม ฟ้าใสยกกล้องขึ้นถ่ายภาพด้วยรอยยิ้มที่เปี่ยมสุขอีกครั้ง เธอค้นพบพลังใจในการมีชีวิตอยู่ต่อ และขอบคุณกานต์สำหรับมิตรภาพอันอบอุ่น เรื่องราวจบลงอย่างอิ่มเอมใจ`
  }
];

interface StoryContinuationPanelProps {
  originalStory: string;
  setOriginalStory: (story: string) => void;
  currentScriptText: string;
  setScriptText: React.Dispatch<React.SetStateAction<string>>;
  clips: DirectedClipItem[];
  setClips: React.Dispatch<React.SetStateAction<DirectedClipItem[]>>;
  setClipCount?: React.Dispatch<React.SetStateAction<number>>;
  characters: Character[];
  continuityLock: MasterContinuityLock;
  clipDurationSeconds: number;
  onSceneAppended?: (newClip: DirectedClipItem, scene: StoryContinuedScene) => void;
  /** Called with the story's main character / location / time so empty Master Lock fields can be filled. */
  onContinuityLockSuggested?: (lock: Partial<MasterContinuityLock>) => void;
}

/** Result of one continuation step (used by auto-run instead of stale React state). */
interface ContinueStepResult {
  ok: boolean;
  newSceneCount: number;
  hasMore: boolean;
}

const isOffScreenName = (name?: string) => !!name && /^เสียง|^(?:ผู้บรรยาย|narrator)/i.test(name.trim());

function computeStoryId(story: string): string {
  if (!story || !story.trim()) return '';
  const clean = story.trim();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash) + clean.charCodeAt(i);
    hash |= 0;
  }
  return `story_${Math.abs(hash)}_${clean.length}`;
}

export const StoryContinuationPanel: React.FC<StoryContinuationPanelProps> = ({
  originalStory,
  setOriginalStory,
  currentScriptText,
  setScriptText,
  clips,
  setClips,
  setClipCount,
  characters,
  continuityLock,
  clipDurationSeconds,
  onSceneAppended,
  onContinuityLockSuggested
}) => {
  const [isContinuing, setIsContinuing] = useState<boolean>(false);
  const [isAutoRunning, setIsAutoRunning] = useState<boolean>(false);
  const [isStoryFinished, setIsStoryFinished] = useState<boolean>(false);
  const [finishMessage, setFinishMessage] = useState<string>('');
  const [currentMilestone, setCurrentMilestone] = useState<string>('');
  const [progressPercentage, setProgressPercentage] = useState<number>(0);
  const [currentEpisode, setCurrentEpisode] = useState<number>(1);
  const [lastGeneratedScene, setLastGeneratedScene] = useState<StoryContinuedScene | null>(null);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'original' | 'scenes'>('original');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Continuity check result (missing character / pose jump); a warning, not a failure
  const [continuityNotice, setContinuityNotice] = useState<string | null>(null);
  const [useOfflineEngine, setUseOfflineEngine] = useState<boolean>(false);
  const [lastSource, setLastSource] = useState<string>('');

  const stopAutoRunRef = useRef<boolean>(false);
  const prevStoryRef = useRef<string>(originalStory);
  // Always-current mirrors of clips / episode so auto-run iterations never read stale closures
  const clipsRef = useRef<DirectedClipItem[]>(clips);
  const episodeRef = useRef<number>(1);
  React.useEffect(() => { clipsRef.current = clips; }, [clips]);
  React.useEffect(() => { episodeRef.current = currentEpisode; }, [currentEpisode]);

  // Restore state from LocalStorage on mount ONLY IF storyId matches the current originalStory
  // NEVER restore old story automatically when the user is starting with empty/new story!
  React.useEffect(() => {
    try {
      const savedRaw = localStorage.getItem('sala_story_continuation_state');
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        const currentStoryId = computeStoryId(originalStory);

        // If there is no current story, or saved story does not match current story:
        // NEVER restore old story automatically, ignore and clear old continuation state!
        if (!currentStoryId || !saved.storyId || saved.storyId !== currentStoryId) {
          localStorage.removeItem('sala_story_continuation_state');
          return;
        }

        // Only restore if storyId matches
        if (typeof saved.currentEpisode === 'number') {
          setCurrentEpisode(saved.currentEpisode);
        }
        if (typeof saved.progressPercentage === 'number') {
          setProgressPercentage(saved.progressPercentage);
        }
        if (saved.isStoryFinished) {
          setIsStoryFinished(true);
          setFinishMessage(saved.finishMessage || 'เนื้อเรื่องจบแล้ว');
        }
        if (saved.currentMilestone) {
          setCurrentMilestone(saved.currentMilestone);
        }
      }
    } catch {}
  }, []);

  // When Source of Truth (originalStory) changes to a new story:
  // Clean up all script states created from the old story immediately.
  // Characters and Location Library remain completely untouched!
  React.useEffect(() => {
    if (prevStoryRef.current !== originalStory) {
      setScriptText('');
      setClips([]);
      setIsStoryFinished(false);
      setFinishMessage('');
      setProgressPercentage(0);
      setCurrentMilestone('');
      setCurrentEpisode(1);
      setLastGeneratedScene(null);
      try {
        localStorage.removeItem('sala_story_continuation_state');
      } catch {}
      prevStoryRef.current = originalStory;
    }
  }, [originalStory, setScriptText, setClips]);

  // Helper to load sample story
  const handleSelectSampleStory = (sample: typeof SAMPLE_ORIGINAL_STORIES[0]) => {
    setOriginalStory(sample.story);
    prevStoryRef.current = sample.story;
    setScriptText('');
    setClips([]);
    setIsStoryFinished(false);
    setFinishMessage('');
    setProgressPercentage(0);
    setCurrentMilestone('');
    setCurrentEpisode(1);
    setLastGeneratedScene(null);
    try {
      localStorage.removeItem('sala_story_continuation_state');
    } catch {}
    setStatusNotification(`โหลดเรื่องตัวอย่าง "${sample.title}" เรียบร้อย ช่องบทถูกล้างว่างพร้อมสร้างตอนที่ 1`);
    setTimeout(() => setStatusNotification(null), 3500);
  };

  // Reset continuation progress
  const handleResetProgress = () => {
    if (confirm('คุณต้องการรีเซ็ตสถานะการต่อบททั้งหมดใช่หรือไม่? (เนื้อเรื่องต้นฉบับจะยังคงอยู่)')) {
      setIsStoryFinished(false);
      setFinishMessage('');
      setProgressPercentage(0);
      setCurrentMilestone('');
      setCurrentEpisode(1);
      setLastGeneratedScene(null);
      stopAutoRunRef.current = true;
      setIsAutoRunning(false);
      setScriptText('');
      setClips([]);
      try {
        localStorage.removeItem('sala_story_continuation_state');
      } catch {}
      setStatusNotification('รีเซ็ตสถานะการต่อบทเรียบร้อยแล้ว สามารถกด "ต่อเรื่อง" เพื่อเริ่มตอนที่ 1 ได้ทันที');
      setTimeout(() => setStatusNotification(null), 3500);
    }
  };

  // Core handler: Continue Episode (5-6 Scenes per Episode)
  // Reads clips / episode from refs and returns a result so auto-run always uses the latest state.
  const handleContinueStory = async (
    forceContinueEvenIfFinished: boolean = false,
    opts: { silentErrors?: boolean } = {}
  ): Promise<ContinueStepResult> => {
    const fail: ContinueStepResult = { ok: false, newSceneCount: 0, hasMore: false };
    if (!originalStory.trim()) {
      alert('กรุณากรอกหรือวาง "เนื้อเรื่องต้นฉบับ" ก่อน เพื่อให้ AI ใช้เป็นฐานข้อมูลในการต่อบท');
      return fail;
    }

    if (isStoryFinished && !forceContinueEvenIfFinished) {
      if (confirm('เนื้อเรื่องตามต้นฉบับเดิมจบแล้ว คุณต้องการขยายเรื่องหรือเขียนฉากเพิ่มเติมต่อจากจุดนี้หรือไม่?')) {
        setIsStoryFinished(false);
        setFinishMessage('');
      } else {
        return fail;
      }
    }

    setIsContinuing(true);
    setStatusNotification(null);
    setErrorMessage(null);

    try {
      let currentClips = clipsRef.current;
      const episodeToGenerate = currentClips.length === 0 ? 1 : episodeRef.current;

      // When generating episode 1 or story changed: strictly clear old state before generating
      if (episodeToGenerate === 1 || prevStoryRef.current !== originalStory) {
        currentClips = [];
        clipsRef.current = [];
        episodeRef.current = 1;
        setScriptText('');
        setClips([]);
        setCurrentEpisode(1);
        setLastGeneratedScene(null);
        setIsStoryFinished(false);
        setFinishMessage('');
        setProgressPercentage(0);
        setCurrentMilestone('');
        try {
          localStorage.removeItem('sala_story_continuation_state');
        } catch {}
        prevStoryRef.current = originalStory;
      }

      // 1. Build summary of existing scenes (latest state)
      const existingScenesSummary = currentClips.map(c => ({
        sceneNumber: c.clipNumber,
        title: c.title,
        summary: c.sceneSummary || c.startAction,
        startAction: c.startAction,
        endAction: c.endAction,
        characterPositions: c.characterPositions,
        characters: c.dialogues?.map(d => d.speaker) || []
      }));

      // 2. Extract LAST_SCENE_STATE from the highest scene number we have
      const lastScene = currentClips.length > 0
        ? currentClips.reduce((a, b) => (b.clipNumber > a.clipNumber ? b : a), currentClips[0])
        : null;
      const lastSceneState = lastScene ? {
        sceneNumber: lastScene.clipNumber,
        title: lastScene.title,
        endAction: lastScene.endAction,
        summary: lastScene.sceneSummary || lastScene.startAction,
        location: lastScene.locationName || lastScene.continuityLock?.location || '',
        timeOfDay: lastScene.continuityLock?.timeOfDay || '',
        characterPositions: lastScene.characterPositions || '',
        dialogues: lastScene.dialogues || [],
        endPoses: lastScene.endPoses || []
      } : null;

      // 3. Call continuation API for full episode (5-6 continuous scenes)
      const res: StoryContinuationResponse = await api.continueStory({
        originalStory,
        currentScriptText: (currentClips.length === 0 || episodeToGenerate === 1) ? '' : currentScriptText,
        episodeNumber: episodeToGenerate,
        targetSceneCount: 5,
        existingScenes: existingScenesSummary,
        lastSceneState,
        // Library characters with face / hair / outfit / appearance for the Character Lock (no images)
        characters: characters.map(c => toCharacterLockPayload(c)) as any,
        continuityLock,
        clipDurationSeconds,
        offline: useOfflineEngine
      });

      if (!res.success) {
        throw new Error(res.message || 'ไม่สามารถสร้างฉากต่อเนื่องได้');
      }
      setLastSource(res.offline ? 'offline' : (res.source || ''));

      const generatedScenes = res.scenes && res.scenes.length > 0
        ? res.scenes
        : (res.nextScene ? [res.nextScene] : []);

      // Check if finished (Strict rule: requires explicit ending marker)
      if (res.isStoryFinished && generatedScenes.length === 0) {
        setIsStoryFinished(true);
        setFinishMessage(res.finishMessage || 'เนื้อเรื่องจบแล้ว');
        setProgressPercentage(100);
        setCurrentMilestone('บทสรุปจบสมบูรณ์ (The End)');
        setStatusNotification('🎉 เนื้อเรื่องจบแล้วตามต้นฉบับเรียบร้อยแล้ว! ระบบไม่สร้างตอนเพิ่มเอง');
        return { ok: true, newSceneCount: 0, hasMore: false };
      }

      if (generatedScenes.length === 0) {
        setStatusNotification(res.finishMessage || 'ไม่มีฉากใหม่ให้สร้างจากต้นฉบับแล้ว (No new scenes)');
        return { ok: true, newSceneCount: 0, hasMore: false };
      }

      // 4. Build DirectedClipItems with Character Lock filled from the scene's main character
      const declared = (res.declaredCharacters || []).filter(n => n && !isOffScreenName(n));
      const fallbackMain = [continuityLock.characterName, ...declared, ...characters.map(c => c.name)]
        .find(n => !!n && !isOffScreenName(n) && originalStory.includes(String(n).split(' ')[0])) || '';

      const newClips: DirectedClipItem[] = generatedScenes.map((sc) => {
        const clipDialogues: DialogueLockEntry[] = (sc.dialogues || []).map((d, idx) => ({
          id: `dlg_${sc.sceneNumber}_${Date.now()}_${idx}`,
          speaker: d.speaker,
          line: d.dialogue,
          emotionTone: d.emotionOrAction,
          clipNumber: sc.sceneNumber
        }));
        const onScreen = (sc.characters || []).filter(n => n && !isOffScreenName(n));
        const mainCharacter = (sc.mainCharacter && !isOffScreenName(sc.mainCharacter) ? sc.mainCharacter : '')
          || onScreen[0]
          || (sc.dialogues || []).map(d => d.speaker).find(n => !!n && !isOffScreenName(n))
          || fallbackMain;
        const libChar = characters.find(c => c.name === mainCharacter);
        // Full Character Lock (age / hair / outfit when known) for every on-screen character
        const lockTexts = (sc.characterLocks || []).map(c => c.lock).filter(Boolean);
        const appearance = lockTexts.length > 0
          ? lockTexts.join(' | ')
          : (libChar?.appearance || continuityLock.characterAppearance || '');
        // One Location Lock: the same lighting description for every clip at this location
        const lighting = sc.locationLock?.lighting || continuityLock.lighting || '';

        return {
          clipNumber: sc.sceneNumber,
          title: sc.sceneHeading,
          durationSeconds: clipDurationSeconds,
          sceneSummary: sc.actionDescription,
          startAction: sc.startAction || sc.actionDescription,
          endAction: sc.endState || '',
          characterPositions: sc.characterPositions || '',
          dialogues: clipDialogues,
          locationName: sc.location,
          continuityLock: {
            characterName: mainCharacter,
            characterNames: onScreen.length > 0 ? onScreen : (mainCharacter ? [mainCharacter] : []),
            characterAppearance: appearance,
            location: sc.location,
            timeOfDay: sc.timeOfDay,
            lighting
          },
          charactersPresent: onScreen,
          startPoses: sc.startPoses || [],
          endPoses: sc.endPoses || [],
          continuityWarnings: sc.continuityWarnings || [],
          continuityLockSummary: [mainCharacter ? `Character: ${mainCharacter}` : '', `Location: ${sc.location}`, `Time: ${sc.timeOfDay}`, lighting ? `Lighting: ${lighting}` : ''].filter(Boolean).join(' | '),
          audioDirectiveSummary: 'Cinematic Ambient & Thai Voice',
          generatedPrompt: sc.visualPrompt,
          negativePrompt: 'blurry, low resolution, duplicate characters, distorted faces, amateurish, morphing'
        };
      });

      // 5. Merge with de-duplication by scene number (never append duplicates)
      const existingNums = new Set(currentClips.map(c => c.clipNumber));
      const trulyNew = newClips.filter(c => !existingNums.has(c.clipNumber));
      const merged = [...currentClips.filter(c => !newClips.some(n => n.clipNumber === c.clipNumber)), ...newClips]
        .sort((a, b) => a.clipNumber - b.clipNumber);
      clipsRef.current = merged;
      setClips(merged);

      if (trulyNew.length === 0) {
        setStatusNotification('ไม่มีฉากใหม่ (ฉากที่ได้รับซ้ำกับฉากเดิมทั้งหมด) ระบบหยุดสร้างต่อ');
        return { ok: true, newSceneCount: 0, hasMore: false };
      }

      const latestScene = generatedScenes[generatedScenes.length - 1];
      setLastGeneratedScene(latestScene);
      setProgressPercentage(res.progressPercentage || Math.min(95, episodeToGenerate * 30));
      setCurrentMilestone(res.currentMilestone || `ตอนที่ ${episodeToGenerate}: ${generatedScenes.length} ฉาก`);

      // 6. Put the generated episode script into "วางบทหรือฉากหลายฉาก" (scriptText)
      const formattedEpisodeScript = res.episodeScriptText || generatedScenes.map(s => s.scriptFormattedText).join('\n\n');
      setScriptText(formattedEpisodeScript);
      if (setClipCount && generatedScenes.length > 0) {
        setClipCount(generatedScenes.length);
      }

      // 7. Suggest Master Continuity Lock values (only fills empty fields in the parent)
      const firstMain = newClips.find(c => c.continuityLock?.characterName)?.continuityLock;
      if (onContinuityLockSuggested && firstMain) {
        const allNames = Array.from(new Set(merged.flatMap(c => c.continuityLock?.characterNames || [])));
        onContinuityLockSuggested({
          characterName: firstMain.characterName,
          characterNames: allNames,
          location: firstMain.location,
          timeOfDay: firstMain.timeOfDay,
          ...(firstMain.lighting ? { lighting: firstMain.lighting } : {})
        });
      }

      if (res.isStoryFinished) {
        setIsStoryFinished(true);
        setFinishMessage(res.finishMessage || 'เนื้อเรื่องจบแล้ว');
        setProgressPercentage(100);
      }

      // Advance episode for the next click
      const nextEpisodeNum = episodeToGenerate + 1;
      episodeRef.current = nextEpisodeNum;
      setCurrentEpisode(nextEpisodeNum);
      const hasMore = !res.isStoryFinished && res.hasMoreScenes !== false;

      // 8. Save state to LocalStorage
      try {
        localStorage.setItem('sala_story_continuation_state', JSON.stringify({
          storyId: computeStoryId(originalStory),
          originalStory,
          currentEpisode: nextEpisodeNum,
          lastSceneNumber: latestScene.sceneNumber,
          lastSceneState: {
            sceneNumber: latestScene.sceneNumber,
            title: latestScene.sceneHeading,
            endAction: latestScene.endState,
            characterPositions: latestScene.characterPositions,
            summary: latestScene.actionDescription,
            location: latestScene.location,
            timeOfDay: latestScene.timeOfDay,
            dialogues: latestScene.dialogues,
            endPoses: latestScene.endPoses || []
          },
          progressPercentage: res.progressPercentage,
          isStoryFinished: !!res.isStoryFinished,
          finishMessage: res.finishMessage || '',
          currentMilestone: res.currentMilestone || `ตอนที่ ${episodeToGenerate} (${generatedScenes.length} ฉาก)`,
          updatedAt: new Date().toISOString()
        }));
      } catch {}

      if (onSceneAppended && newClips.length > 0) {
        onSceneAppended(newClips[0], generatedScenes[0]);
      }

      const sourceLabel = res.offline ? ' [โหมดออฟไลน์ ไม่ใช้ Gemini]' : ' [Gemini]';
      const contWarnings = [...(res.characterWarnings || []), ...(res.continuityWarnings || []).map(w => w.message)];
      if (contWarnings.length > 0) {
        setContinuityNotice(`- ${contWarnings.slice(0, 8).join('\n- ')}`);
      } else {
        setContinuityNotice(null);
      }
      setStatusNotification(
        `✨ สร้างตอนที่ ${episodeToGenerate} (${trulyNew.length} ฉากใหม่) สำเร็จ${sourceLabel}` +
        (hasMore ? '' : ' — ใช้เนื้อเรื่องต้นฉบับครบแล้ว')
      );
      setTimeout(() => setStatusNotification(null), 6000);

      return { ok: true, newSceneCount: trulyNew.length, hasMore };
    } catch (err: any) {
      console.error('Continue story error:', err?.message || err);
      const msg = err?.message || 'การเชื่อมต่อขัดข้อง / Connection error';
      setErrorMessage(msg);
      if (!opts.silentErrors) {
        alert(`เกิดข้อผิดพลาดในการต่อบท / Story continuation failed:\n${msg}`);
      }
      return fail;
    } finally {
      setIsContinuing(false);
    }
  };

  // Auto-run sequentially until the story finishes or no new scenes are produced
  const handleAutoRunUntilFinished = async () => {
    if (!originalStory.trim()) {
      alert('กรุณากรอก "เนื้อเรื่องต้นฉบับ" ก่อนเริ่มระบบอัตโนมัติ');
      return;
    }
    if (isStoryFinished) {
      alert('เนื้อเรื่องจบแล้วตามต้นฉบับเรียบร้อยแล้ว');
      return;
    }

    setIsAutoRunning(true);
    stopAutoRunRef.current = false;

    const maxSteps = 10;
    for (let step = 0; step < maxSteps && !stopAutoRunRef.current; step++) {
      const result = await handleContinueStory(false, { silentErrors: true });
      if (!result.ok || result.newSceneCount === 0 || !result.hasMore || stopAutoRunRef.current) {
        break;
      }
      // Small pause between episodes to respect token limits and UI feedback
      await new Promise(r => setTimeout(r, 1200));
    }

    setIsAutoRunning(false);
  };

  const handleStopAutoRun = () => {
    stopAutoRunRef.current = true;
    setIsAutoRunning(false);
    setStatusNotification('หยุดระบบสร้างอัตโนมัติแล้ว');
    setTimeout(() => setStatusNotification(null), 3000);
  };

  return (
    <div className="bg-[#0b1120] border-2 border-indigo-500/40 rounded-3xl p-5 shadow-2xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Story Continuation / ต่อบทอัตโนมัติ
              </h2>
              {isStoryFinished ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3" /> เนื้อเรื่องจบแล้ว
                </span>
              ) : progressPercentage > 0 ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  คืบหน้า {progressPercentage}%
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  โหมดคุมความต่อเนื่อง
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              AI จำเนื้อเรื่องต้นฉบับและสถานะล่าสุด กด “ต่อเนื่อง” เพื่อเขียนฉากถัดไปทันที
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {clips.length > 0 && (
            <button
              type="button"
              onClick={handleResetProgress}
              title="เริ่มเขียนฉากใหม่จากต้นฉบับ"
              className="px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-rose-300 text-xs flex items-center gap-1.5 transition-colors border border-slate-700/60"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">รีเซ็ต</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 relative z-10">
          {/* Progress Bar & Current Milestone */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>สถานะบทปัจจุบัน:</span>
                <span className="text-white font-mono">{clips.length} ฉากในระบบ</span>
              </span>
              <span className="text-indigo-300 font-mono font-bold">
                {isStoryFinished ? '100% (จบแล้ว)' : `${progressPercentage}%`}
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isStoryFinished
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                    : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'
                }`}
                style={{ width: `${Math.max(5, progressPercentage)}%` }}
              />
            </div>

            {currentMilestone && (
              <p className="text-[11px] text-slate-400 mt-2 truncate">
                <span className="text-indigo-400 font-medium">ฉากล่าสุด:</span> {currentMilestone}
              </p>
            )}
          </div>

          {/* Tab Switcher: Original Story vs Scenes Overview */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('original')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'original'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                📖 เนื้อเรื่องต้นฉบับ (Source of Truth)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('scenes')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'scenes'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                🎬 ลำดับฉากที่สร้างแล้ว ({clips.length})
              </button>
            </div>

            {/* Presets dropdown */}
            <div className="relative group">
              <select
                onChange={(e) => {
                  const val = e.target.value;
                  const found = SAMPLE_ORIGINAL_STORIES.find(s => s.title === val);
                  if (found) handleSelectSampleStory(found);
                }}
                defaultValue=""
                className="bg-slate-900 border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs text-indigo-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="" disabled>เลือกตัวอย่างเรื่องเล่า...</option>
                {SAMPLE_ORIGINAL_STORIES.map((s, idx) => (
                  <option key={idx} value={s.title}>{s.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tab Content 1: Original Story */}
          {activeTab === 'original' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>วางเรื่องเล่าทั้งหมดที่ต้องการให้ AI จดจำและทยอยเขียนทีละฉาก:</span>
                <span className="text-[11px] text-slate-500">
                  {originalStory.length} ตัวอักษร
                </span>
              </div>
              <textarea
                value={originalStory}
                onChange={(e) => {
                  const val = e.target.value;
                  setOriginalStory(val);
                  if (val !== originalStory) {
                    setScriptText('');
                    setClips([]);
                    setIsStoryFinished(false);
                    setFinishMessage('');
                    setProgressPercentage(0);
                    setCurrentMilestone('');
                    setCurrentEpisode(1);
                    setLastGeneratedScene(null);
                    try {
                      localStorage.removeItem('sala_story_continuation_state');
                    } catch {}
                  }
                }}
                onPaste={() => {
                  setScriptText('');
                  setClips([]);
                  setIsStoryFinished(false);
                  setFinishMessage('');
                  setProgressPercentage(0);
                  setCurrentMilestone('');
                  setCurrentEpisode(1);
                  setLastGeneratedScene(null);
                  try {
                    localStorage.removeItem('sala_story_continuation_state');
                  } catch {}
                }}
                rows={5}
                placeholder="วางเนื้อเรื่องต้นฉบับทั้งหมดที่นี่ เช่น นิยายสั้น, เรื่องเล่า, หรือโครงเรื่องทั้งหมด... AI จะจดจำตัวละคร สถานที่ และเหตุการณ์ทั้งหมด แล้วเขียนฉากถัดไปให้สอดคล้องกัน 100%"
                className="w-full bg-slate-950/90 border border-slate-700 rounded-2xl p-3.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed resize-none font-sans"
              />
            </div>
          )}

          {/* Tab Content 2: Scenes Overview */}
          {activeTab === 'scenes' && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {clips.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-center text-xs text-slate-400">
                  ยังไม่มีฉากที่เขียน กดปุ่ม <strong>“ต่อเนื่อง”</strong> ด้านล่างเพื่อเริ่มสร้างฉากที่ 1 ตามเนื้อเรื่องต้นฉบับ
                </div>
              ) : (
                clips.map((clip, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs space-y-1 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{clip.title}</span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        {clip.durationSeconds}s
                      </span>
                    </div>
                    <p className="text-slate-300 line-clamp-1">{clip.startAction}</p>
                    {clip.dialogues && clip.dialogues.length > 0 && (
                      <p className="text-indigo-300/80 text-[11px] italic line-clamp-1">
                        บทพูด: {clip.dialogues[0].speaker}: "{clip.dialogues[0].line}"
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Finish Alert Banner */}
          {isStoryFinished && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 to-teal-950/70 border border-emerald-500/50 text-emerald-200 flex items-start gap-3 shadow-lg animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-emerald-100 text-sm">
                  {finishMessage || 'เนื้อเรื่องจบแล้วตามต้นฉบับเรียบร้อยแล้ว'}
                </p>
                <p className="text-xs text-emerald-300/90 leading-relaxed">
                  เนื้อเรื่องต้นฉบับทั้งหมดได้ดำเนินมาจนถึงบทสรุปเรียบร้อยแล้ว ระบบปฏิบัติตามกฎเหล็ก: <strong>ไม่สร้างตอนเพิ่มเอง</strong> เพื่อรักษาความถูกต้องของบทประพันธ์ คุณสามารถนำ Prompt ของแต่ละฉากไปสร้างวิดีโอได้ทันที
                </p>
              </div>
            </div>
          )}

          {/* Realtime Status Notification */}
          {statusNotification && (
            <div className="p-3 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-xs text-indigo-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>{statusNotification}</span>
            </div>
          )}

          {/* Continuity warnings (pose jump / character disappears without leaving) */}
          {continuityNotice && (
            <div role="status" className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/40 text-xs text-amber-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-amber-100">คำเตือนความต่อเนื่อง / Continuity warnings</p>
                <p className="whitespace-pre-line break-words">{continuityNotice}</p>
              </div>
              <button type="button" onClick={() => setContinuityNotice(null)} className="text-amber-300 hover:text-white" aria-label="ปิด">
                ×
              </button>
            </div>
          )}

          {/* Error banner (Gemini / network / key errors are never hidden) */}
          {errorMessage && (
            <div role="alert" className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-rose-100">ต่อบทไม่สำเร็จ / Story continuation failed</p>
                <p className="whitespace-pre-line break-words">{errorMessage}</p>
                {!useOfflineEngine && (
                  <p className="text-rose-300/80">
                    ตรวจสอบ Gemini API Key แล้วลองใหม่ หรือเปิด “โหมดออฟไลน์” ด้านล่างเพื่อแบ่งฉากจากต้นฉบับโดยไม่ใช้ AI
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-300 hover:text-white" aria-label="ปิด">
                ×
              </button>
            </div>
          )}

          {/* Explicit offline-mode choice (never used silently) */}
          <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useOfflineEngine}
              onChange={(e) => setUseOfflineEngine(e.target.checked)}
              className="accent-amber-500"
            />
            <span>
              โหมดออฟไลน์ (ไม่ใช้ Gemini): แบ่งฉากจากต้นฉบับตามหัวข้อ “ฉากที่ N” โดยตรง / Offline mode (no AI)
            </span>
            {lastSource && (
              <span className={`ml-auto px-2 py-0.5 rounded-full border ${lastSource === 'offline' ? 'border-amber-500/40 text-amber-300' : 'border-emerald-500/40 text-emerald-300'}`}>
                ล่าสุด: {lastSource === 'offline' ? 'ออฟไลน์' : 'Gemini'}
              </span>
            )}
          </label>

          {/* Action Buttons: "ตอนต่อไป / ต่อเนื่อง" and "ต่ออัตโนมัติ" */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5 pt-2">
            {/* Main "ต่อเรื่อง" / "ตอนต่อไป" Button */}
            <button
              type="button"
              id="btn-story-continue"
              onClick={() => handleContinueStory()}
              disabled={isContinuing || isAutoRunning || !originalStory.trim()}
              className={`flex-1 py-3 px-5 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] ${
                isStoryFinished
                  ? 'bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-600 hover:to-teal-600 text-white border border-emerald-500/40'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:via-teal-500 hover:to-indigo-500 text-white shadow-emerald-600/25 disabled:opacity-50'
              }`}
            >
              {isContinuing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-200" />
                  <span>กำลังโหลด Source และสร้างตอนที่ {clips.length === 0 ? 1 : currentEpisode}... (5-6 ฉาก)</span>
                </>
              ) : isStoryFinished ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>เนื้อเรื่องจบแล้ว (พบคำว่า จบบริบูรณ์/จบเรื่อง/THE END ในต้นฉบับ)</span>
                </>
              ) : clips.length === 0 ? (
                <>
                  <Play className="w-4 h-4 fill-current text-emerald-300" />
                  <span>▶ ต่อเรื่อง (สร้างตอนที่ 1 จากช่วงต้นเรื่อง 5-6 ฉาก)</span>
                </>
              ) : (
                <>
                  <FastForward className="w-4 h-4 text-emerald-300" />
                  <span>▶ ตอนต่อไป (สร้างตอนที่ {currentEpisode} ต่อเนื่องทันที 5-6 ฉาก)</span>
                </>
              )}
            </button>

            {/* Auto-Run Button */}
            {!isStoryFinished && (
              isAutoRunning ? (
                <button
                  type="button"
                  onClick={handleStopAutoRun}
                  className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/25 transition-all"
                >
                  <StopCircle className="w-4 h-4" />
                  <span>หยุดระบบต่ออัตโนมัติ</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAutoRunUntilFinished}
                  disabled={isContinuing || !originalStory.trim()}
                  title="สร้างฉากต่อเนื่องอัตโนมัติทีละตอนจนกว่าเนื้อเรื่องจะจบ"
                  className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 hover:text-white font-semibold text-xs border border-indigo-500/30 flex items-center justify-center gap-1.5 transition-all"
                >
                  <FastForward className="w-3.5 h-3.5 text-indigo-400" />
                  <span>ต่ออัตโนมัติจนจบ</span>
                </button>
              )
            )}
          </div>

          {/* Rule note */}
          <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
            <Info className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span>
              ระบบแบ่งตอนต่อเนื่อง: วางเนื้อเรื่องเต็มครั้งเดียว กด "ต่อเรื่อง" สร้างตอนที่ 1 (5-6 ฉาก) ลงช่อง Script อัตโนมัติ และกด "ตอนต่อไป" เพื่อสร้างตอนถัดไป โดย END scene เชื่อมโยงเป็น START scene ถัดไปเสมอ พร้อมล็อคตำแหน่งตัวละครและ Continuity Prompt
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
