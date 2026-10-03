import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Sparkles,
  Copy,
  Check,
  RotateCw,
  Edit3,
  Sliders,
  Lock,
  MessageSquare,
  Volume2,
  Music,
  Mic,
  Clapperboard,
  Play,
  Send,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Cpu,
  Coins,
  FileText,
  Layers,
  ArrowRight,
  Eye,
  Info,
  CheckCircle2,
  Flame,
  ShieldCheck,
  Shuffle,
  Square,
  Share2,
  FileVideo,
  RefreshCw,
  Users,
  Building,
  Compass,
  Camera,
  Scissors,
  X
} from 'lucide-react';
import { User } from 'firebase/auth';
import { auth, getStoredUserAsUser } from '../services/auth';
import {
  Character,
  LocationItem,
  CreditAccount,
  DirectorMode,
  DirectedClipItem,
  DialogueLockEntry,
  MasterContinuityLock,
  AudioDirectives,
  ProviderId,
  ProviderInfo,
  AspectRatio,
  CostEstimate,
  ContinuityIssue
} from '../types';
import { api, GenerateRequestPayload } from '../services/api';
import { splitScript, ScriptSplitResult } from '../services/scriptSplitter';
import { toCharacterLockPayload } from '../services/characterAppearance';
import { expandCombinedCharacterNames } from '../services/continuityEngine';
import { libraryLockPayloads, checkReferenceImages, loadLibraryLockCache, locationLockPayloads, loadLocationLockCache } from '../services/characterLibraryLock';
import { locationDescriptionOf } from '../services/locationAppearance';

/** Density auto-split notices: "ฉากที่ 4 แยกเป็น 2 คลิปอัตโนมัติ … (4 → 5 คลิป)" */
function autoSplitNotices(clips: DirectedClipItem[], requested: number): string[] {
  return summarizeAutoSplit(clips, requested).splitScenes.map(s =>
    `ฉากที่ ${s.sourceSceneNumber} แยกเป็น ${s.parts} คลิปอัตโนมัติ (${s.reason || 'บทพูดยาวเกินหนึ่งคลิป'}) — จำนวนคลิป ${requested} → ${clips.length}`);
}
import { VideoToScriptModal } from './VideoToScriptModal';
import { ScriptEditorModal } from './ScriptEditorModal';
import { ContinuityCheckerModal } from './ContinuityCheckerModal';
import { SocialPostAssistantModal } from './SocialPostAssistantModal';
import { VideoQualityControlBar, VideoQualitySettings } from './VideoQualityControlBar';
import { StoryContinuationPanel } from './StoryContinuationPanel';
import { DialogueCameraControl } from './DialogueCameraControl';
import { formatScriptWithActTriggerTags } from '../services/actionNarrationLock';
import {
  applyDialogue20WordSplitToClips,
  splitScriptTextDialoguesAt20Words,
  MAX_DIALOGUE_WORDS_PER_CLIP
} from '../services/dialogueWordSplitter';
import {
  isReservedSystemKeyword,
  isMetadataKeyword,
  validateSalaMultiClipPrompts,
  buildSalaMultiClipPrompts,
  refreshClipPromptWithCameraControls,
  summarizeAutoSplit
} from '../services/salaDirectorEngine';

interface MultiClipDirectorProps {
  characters: Character[];
  locations?: LocationItem[];
  initialCharacterId?: string;
  initialLocationId?: string;
  initialPrompt?: string;
  providers: ProviderInfo[];
  selectedProvider: ProviderId;
  setSelectedProvider: (id: ProviderId) => void;
  credits: CreditAccount | null;
  onOpenCredits: () => void;
  onGenerationStarted: (jobId: string) => void;
  onViewJobOutput: (url: string, type: 'video' | 'image') => void;
  authUser?: User | null;
  onLogin?: () => void;
  isLoggingIn?: boolean;
}

const SAMPLE_SCRIPTS = [
  {
    title: 'ตัวอย่าง: Sala Protocol V1 (Multi-Clip & Continuity)',
    script: `@SALA1#S001|P1/1|C01-03|H:01>02|K:KEEP|CT:KEEP
SALA_MULTI_CLIP
CHARACTERS: วีระ (นักบินอวกาศ)
LOCK: Character: วีระ | Location: ฐานสำรวจอวกาศ | Lighting: แสงไฟนีออนสีขาวนวล | Style: Sci-Fi Cinematic 8K
FRAME: 16:9
AUTO: TRUE
RULE: รักษารายละเอียดชุดอวกาศและหมวกนิรภัยต่อเนื่องทุกคลิป
STORY: {
  CLIP 1: วีระยืนหน้าจอควบคุมกลางห้องปฏิบัติการ ตรวจสอบสถานะออกซิเจนและระดับพลังงาน
  วีระ: "ระบบยังคงเสถียร ทุกอย่างพร้อมสำหรับการเดินทาง"
  END: วีระหันหลังและเดินไปยังประตูผนึกอากาศ

  CLIP 2: ต่อเนื่องจากการเดิน วีระก้าวผ่านประตูผนึกอากาศเข้ามาในห้องเตรียมชุด
  วีระ: "เริ่มกระบวนการปรับความดัน"
  END: วีระเอื้อมมือกดปุ่มยืนยันบนคอนโซลข้างประตู

  CLIP 3: ประตูด้านนอกเปิดออก เผยให้เห็นผืนทรายกว้างใหญ่ วีระก้าวออกสู่ภายนอก
  END: วีระหยุดยืนมองขอบฟ้าไกล กล้องค่อยๆ ดอลลี่ถอยหลังเผยทัศนียภาพกว้างใหญ่
}`,
    charName: 'วีระ (นักบินอวกาศ)',
    charAppearance: 'ชายวัย 32 ปี สวมชุดปฏิบัติการอวกาศสีขาวขลิบน้ำเงิน แผ่นป้ายชื่อติดหน้าอก',
    location: 'ฐานสำรวจอวกาศ ห้องควบคุมหลัก',
    timeOfDay: 'กลางวัน (Internal Station Lights)',
    lighting: 'แสงไฟนีออนสีขาวนวล คอนทราสต์นุ่มนวลสมจริง',
    style: 'Sci-Fi Cinematic 8K Photorealistic 35mm film',
    props: 'คอนโซลควบคุม, จอสัมผัสโฮโลแกรม',
    dialogues: [
      { id: 'd1', speaker: 'วีระ', line: 'ระบบยังคงเสถียร ทุกอย่างพร้อมสำหรับการเดินทาง', emotionTone: 'มั่นใจ', clipNumber: 1 },
      { id: 'd2', speaker: 'วีระ', line: 'เริ่มกระบวนการปรับความดัน', emotionTone: 'สุขุม', clipNumber: 2 }
    ]
  },
  {
    title: 'ตัวอย่าง: ไซเบอร์พังก์เยาวราช (2 คลิป 8 วิ)',
    script: `ฉากที่ 1: เมษา สาวไซบอร์กในชุดแจ็คเก็ตนีออนยืนอยู่ใต้ป้ายไฟภาษาจีนกลางสายฝนพรำบนถนนเยาวราช แสงไฟนีออนสีแดงและเขียวสะท้อนบนแอ่งน้ำ เมษาก้มมองอุปกรณ์นำทางโฮโลแกรมบนข้อมือ
ฉากที่ 2: เมษาเงยหน้าขึ้นเมื่อตรวจพบเป้าหมาย เธอออกตัววิ่งทะลุฝูงชนในตรอกแคบอย่างรวดเร็วและคล่องแคล่ว ส่งต่อการไล่ล่าสู่อนาคต`,
    charName: 'เมษา (นักสืบไซบอร์ก)',
    charAppearance: 'หญิงไทยวัย 24 ปี ผมบ็อบสั้นย้อมปลายสีฟ้าสะท้อนแสง สวมแจ็คเก็ตหนังสีดำแต่งแถบไฟนีออน แขนกลข้างขวาทำจากไททาเนียม',
    location: 'ถนนเยาวราชในโลกอนาคต ฝนตกพรำ ตรอกป้ายไฟนีออน',
    timeOfDay: 'กลางคืนใต้สายฝน (Midnight Rain)',
    lighting: 'แสงนีออน Cyberpunk สีแดงสด ตัดกับแสงเขียวมรกตและเงาสะท้อนแอ่งน้ำ',
    style: 'Neo-noir Cyberpunk, 8K Ultra-detailed, Anamorphic lens flare',
    props: 'อุปกรณ์โฮโลแกรมข้อมือ, ร่มใสส่องแสง',
    dialogues: [
      { id: 'd1', speaker: 'เมษา', line: 'สัญญาณพิกัดอยู่ห่างออกไปไม่เกินสามร้อยเมตร', emotionTone: 'เคร่งขรึม', clipNumber: 1 },
      { id: 'd2', speaker: 'เมษา', line: 'ล็อคเป้าหมายได้แล้ว อย่าคิดว่าจะหนีพ้น!', emotionTone: 'ดุดัน รวดเร็ว', clipNumber: 2 }
    ]
  }
];

export const MultiClipDirector: React.FC<MultiClipDirectorProps> = ({
  characters,
  locations,
  initialCharacterId,
  initialLocationId,
  initialPrompt,
  providers,
  selectedProvider,
  setSelectedProvider,
  credits,
  onOpenCredits,
  onGenerationStarted,
  onViewJobOutput,
  authUser,
  onLogin,
  isLoggingIn,
}) => {
  // Effective authenticated user with fallback to current session
  const effectiveAuthUser = authUser || auth.currentUser || getStoredUserAsUser();

  // Mode selection
  const [directorMode, setDirectorMode] = useState<DirectorMode>('prompt_only');

  // Script & Timing configuration
  const [originalStory, setOriginalStory] = useState<string>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('sala_story') || '';
    }
    return '';
  });
  const [scriptText, setScriptText] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('sala_current_director_script') || '';
    }
    return '';
  });
  const [clipDurationSeconds, setClipDurationSeconds] = useState<number>(10);
  const [clipCount, setClipCount] = useState<number>(3);

  // Sync scriptText to localStorage so state is preserved across tab navigation and refresh
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sala_current_director_script', scriptText);
    }
  }, [scriptText]);

  // Sync with changes from HomeDashboard (when user saves new Full Story)
  useEffect(() => {
    const handleStorageChange = () => {
      if (typeof localStorage !== 'undefined') {
        const savedScript = localStorage.getItem('sala_current_director_script');
        if (savedScript && savedScript !== scriptText) {
          setScriptText(savedScript);
        }
        const savedStory = localStorage.getItem('sala_story');
        if (savedStory && savedStory !== originalStory) {
          setOriginalStory(savedStory);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [scriptText, originalStory]);

  // Track previous originalStory (Source of Truth).
  // When Source of Truth changes to a new story, clear only the script/scene state derived from the old story.
  // Characters and Location Library are strictly preserved and untouched!
  const prevOriginalStoryRef = useRef<string>(originalStory);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sala_story', originalStory);
    }
    if (prevOriginalStoryRef.current !== originalStory) {
      // Clear script box (ช่องบท) immediately
      setScriptText('');
      // Clear clips from old story
      setClips([]);
      // Clear split data from old story
      setSplitSuccessData(null);
      prevOriginalStoryRef.current = originalStory;
    }
  }, [originalStory]);

  // Master Continuity Lock State
  const [showContinuityPanel, setShowContinuityPanel] = useState<boolean>(true);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('sala_selected_character_ids');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });
  const [continuityLock, setContinuityLock] = useState<MasterContinuityLock>(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('sala_master_continuity_lock');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {
      characterId: '',
      characterIds: [],
      characterNames: [],
      characterName: '',
      characterAppearance: '',
      location: '',
      timeOfDay: '',
      lighting: '',
      visualStyle: 'Cinematic Photorealistic 8K',
      aspectRatio: '16:9',
      resolution: '720p',
      cameraMovement: 'Cinematic tracking shot smoothly gliding alongside character',
      cameraShotType: 'Medium Shot',
      lensType: '35mm Anamorphic Prime f/1.8',
      props: '',
      characterPosition: '',
      lockActionMomentum: true,
      lockColorGrade: 'Film grain Kodak Vision3, rich warm contrast'
    };
  });

  // Preserve continuityLock & selected characters across page changes and browser refreshes
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sala_master_continuity_lock', JSON.stringify(continuityLock));
    }
  }, [continuityLock]);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sala_selected_character_ids', JSON.stringify(selectedCharacterIds));
    }
  }, [selectedCharacterIds]);

  // Dialogue Lock State
  const [showDialoguePanel, setShowDialoguePanel] = useState<boolean>(true);
  const [dialogues, setDialogues] = useState<DialogueLockEntry[]>([]);
  const [newSpeaker, setNewSpeaker] = useState('');
  const [newLine, setNewLine] = useState('');
  const [newEmotion, setNewEmotion] = useState('เป็นธรรมชาติ');
  const [newClipNum, setNewClipNum] = useState<number>(1);

  // Audio Directives (Voice, Music, SFX)
  const [showAudioPanel, setShowAudioPanel] = useState<boolean>(false);
  const [audioDirectives, setAudioDirectives] = useState<AudioDirectives>({
    voice: {
      enabled: true,
      voiceType: 'เสียงพากย์ภาษาไทย สำเนียงธรรมชาติ ทุ้มนุ่มน่าฟัง',
      accent: 'ไทยกลาง ชัดถ้อยชัดคำ',
      emotion: 'แสดงอารมณ์ตามบทพูด สมจริงในสถานการณ์',
      deliverySpeed: 'natural'
    },
    music: {
      enabled: true,
      genre: 'Thai Traditional Contemporary Orchestral Score ผสมดนตรีภาพยนตร์สากล',
      tempo: 'ปานกลาง สร้างความลึกลับและน่าค้นหา (Moderate Mysterious)',
      mood: 'ตื่นเต้น ผจญภัย ยิ่งใหญ่',
      instruments: 'วงออร์เคสตรา, ระนาดเอกโบราณประยุกต์, กลองท้าวจังหวะเร้าใจ'
    },
    sfx: {
      enabled: true,
      ambientSounds: 'เสียงบรรยากาศตามสถานที่ในฉาก',
      foleyActions: 'เสียงฝีเท้าและการเคลื่อนไหว',
      reverbSpace: 'เสียงสะท้อนสมจริงตามขนาดของพื้นที่'
    }
  });

  // Generated Clips State
  const [clips, setClips] = useState<DirectedClipItem[]>(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem('sala_director_clips');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  // Sync clips to localStorage so they persist across page changes, reloads and tabs
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      if (clips.length > 0) {
        localStorage.setItem('sala_director_clips', JSON.stringify(clips));
      } else {
        localStorage.removeItem('sala_director_clips');
      }
    }
  }, [clips]);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState<boolean>(false);
  const [generationSource, setGenerationSource] = useState<'gemini-ai' | 'deterministic' | null>(null);
  const [promptValidation, setPromptValidation] = useState<{ isValid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [promptGenerationError, setPromptGenerationError] = useState<string | null>(null);
  const [copiedClipIndex, setCopiedClipIndex] = useState<number | null>(null);
  const [allCopied, setAllCopied] = useState<boolean>(false);
  const [editingClipIndex, setEditingClipIndex] = useState<number | null>(null);
  const [editPromptValue, setEditPromptValue] = useState<string>('');
  const [isRegeneratingClip, setIsRegeneratingClip] = useState<number | null>(null);

  // Quality Control Bar State (from user redesign requirements)
  const [videoQuality, setVideoQuality] = useState<VideoQualitySettings>({
    resolution: '1080p',
    quality: 100,
    codec: 'H.264',
    colorProfile: 'Identity',
    fps: 24
  });

  // New Modals State
  const [showVideoToScriptModal, setShowVideoToScriptModal] = useState<boolean>(false);
  const [showScriptEditorModal, setShowScriptEditorModal] = useState<boolean>(false);
  const [showContinuityCheckerModal, setShowContinuityCheckerModal] = useState<boolean>(false);
  const [showSocialPostModal, setShowSocialPostModal] = useState<boolean>(false);

  // Auto Generate, Cost Breakdown & Emergency Stop
  const [showAutoConfirmModal, setShowAutoConfirmModal] = useState<boolean>(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState<boolean>(false);
  const [isEmergencyStopping, setIsEmergencyStopping] = useState<boolean>(false);
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [isEstimatingCost, setIsEstimatingCost] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; message: string }>({ current: 0, total: 0, message: '' });

  // AI Script Splitting State
  const [isSplittingScript, setIsSplittingScript] = useState<boolean>(false);
  // Explicit offline choice (no Gemini) for split + prompt generation; never used silently
  const [useOfflineMode, setUseOfflineMode] = useState<boolean>(false);
  const [splitNotice, setSplitNotice] = useState<string | null>(null);
  const [splitSuccessData, setSplitSuccessData] = useState<ScriptSplitResult | null>(null);

  const activeProvider = providers.find(p => p.id === selectedProvider) || providers[0];
  const isRealProvider = selectedProvider === 'gemini' && activeProvider?.hasServerKey;

  // Character library -> Character Lock payloads (all cards; matched by name in the engine),
  // reference images checked (lost /uploads files -> "รูปอ้างอิงของ X หาย" warning).
  // Not signed in: the last signed-in library saved on this device is used, with a notice.
  const getLibraryLockPayloads = async (): Promise<{ payloads: any[]; locationPayloads: any[]; notices: string[] }> => {
    let payloads = libraryLockPayloads(characters);
    const notices: string[] = [];
    if (payloads.length === 0 && !effectiveAuthUser) {
      const cache = loadLibraryLockCache();
      if (cache && cache.characters.length > 0) {
        payloads = cache.characters;
        notices.push(`ยังไม่ได้เข้าสู่ระบบ — ใช้ข้อมูลคลังตัวละครที่บันทึกไว้ในเครื่อง (${new Date(cache.savedAt).toLocaleString('th-TH')}) / Not signed in: using the character library saved on this device`);
      } else {
        notices.push('ยังไม่ได้เข้าสู่ระบบ — ไม่ได้โหลดคลังตัวละคร รูปลักษณ์จากคลังจะไม่ถูกล็อค กรุณาเข้าสู่ระบบ / Not signed in: character library not loaded, library appearance cannot be locked');
      }
    }
    try { payloads = await checkReferenceImages(payloads); } catch { /* keep unchecked */ }
    // Location library (same rules): signed out -> the last signed-in location library saved on this device
    let locationPayloads = locationLockPayloads(locations);
    if (!effectiveAuthUser) {
      const locCache = loadLocationLockCache();
      if (locCache && locCache.locations.length > 0) {
        const cachedIds = new Set(locCache.locations.map(l => l.id));
        locationPayloads = [...locCache.locations, ...locationPayloads.filter(l => !cachedIds.has(l.id))];
        notices.push(`ยังไม่ได้เข้าสู่ระบบ — ใช้ข้อมูลคลังสถานที่ที่บันทึกไว้ในเครื่อง (${new Date(locCache.savedAt).toLocaleString('th-TH')}) / Not signed in: using the location library saved on this device`);
      }
    }
    try { locationPayloads = await checkReferenceImages(locationPayloads); } catch { /* keep unchecked */ }
    return { payloads, locationPayloads, notices };
  };
  /** Payloads for server requests: data-URL backups replaced by a flag (request size) */
  const forServer = (payloads: any[]) => payloads.map(p => p.referenceImageBackup ? { ...p, referenceImageBackup: undefined, hasReferenceBackup: true } : p);

  // AI Script Splitter & Auto-Fill Handler
  const handleAiSplitAndFill = async () => {
    if (!scriptText.trim()) {
      alert('กรุณากรอกบทละครหรือโครงเรื่องในช่อง Script ก่อนกดแยกบท');
      return;
    }

    // 1. Reset derived analysis state, but KEEP the user's own locks (selected characters /
    //    location / lighting). They are sent to the splitter and forced into every scene.
    const userLock = continuityLock;
    setClips([]);
    setSplitSuccessData(null);
    setDialogues([]);
    setCopiedClipIndex(null);
    setAllCopied(false);
    setPromptGenerationError(null);
    setPromptValidation(null);
    setSplitNotice(null);

    setIsSplittingScript(true);

    try {
      const sceneHeaderMatches = scriptText.match(/^(?:\[?(?:CLIP|ฉากที่|ฉาก|SCENE)\s*0*(\d+)\]?[:.]?\s*.*)/gim);
      const detectedScenesCount = sceneHeaderMatches && sceneHeaderMatches.length >= 4 ? sceneHeaderMatches.length : clipCount;
      const targetClipCount = Math.max(detectedScenesCount, clipCount);

      const library = await getLibraryLockPayloads();
      const result = await splitScript(scriptText, {
        clipCount: targetClipCount,
        continuityLock: userLock,
        characters: (useOfflineMode ? library.payloads : forServer(library.payloads)) as any,
        locations: (useOfflineMode ? library.locationPayloads : forServer(library.locationPayloads)) as any,
        offlineMode: useOfflineMode
      });
      setSplitSuccessData(result);

      // User's locks win; split results only fill fields the user left empty
      // Combined labels from the split ("พี่ทุย และ น้องน้ำ") become individual characters
      const resolvedCharNames = expandCombinedCharacterNames((result.characters || []).map(c => c.name));
      const rawMainChar = userLock?.characterName || result.continuityLock?.characterName || result.characters?.[0]?.name || '';
      const mainCharParts = expandCombinedCharacterNames([rawMainChar]);
      const resolvedMainChar = mainCharParts.length > 1 ? mainCharParts.join(', ') : rawMainChar;
      // Appearance only (never the personality description) - '' when none is known
      const resolvedAppearance = userLock?.characterAppearance || result.continuityLock?.characterAppearance || result.characters?.[0]?.appearance || '';
      const resolvedLocation = userLock?.location || result.continuityLock?.location || result.locations?.[0]?.name || '';
      const resolvedTime = userLock?.timeOfDay || result.continuityLock?.timeOfDay || '';
      const resolvedLighting = userLock?.lighting || result.continuityLock?.lighting || result.lighting || '';
      const resolvedStyle = userLock?.visualStyle || result.continuityLock?.visualStyle || 'Cinematic Photorealistic 8K';
      const resolvedProps = userLock?.props || result.continuityLock?.props || '';
      const resolvedCameraMovement = userLock?.cameraMovement || result.continuityLock?.cameraMovement || result.camera?.movement || 'Cinematic tracking shot smoothly gliding alongside character';
      const resolvedCameraShotType = userLock?.cameraShotType || (result.continuityLock?.cameraShotType as any) || result.camera?.shotType || 'Medium Shot';
      const resolvedLensType = userLock?.lensType || result.continuityLock?.lensType || result.camera?.lensType || '35mm Anamorphic Prime f/1.8';
      const lockedNames = expandCombinedCharacterNames([...(userLock?.characterNames || []), ...(mainCharParts.length > 1 ? mainCharParts : [])].filter(Boolean));

      const freshContinuityLock: MasterContinuityLock = {
        ...userLock,
        characterId: userLock?.characterId || '',
        characterIds: userLock?.characterIds || [],
        characterNames: lockedNames.length > 0 ? Array.from(new Set([...lockedNames, ...resolvedCharNames])) : resolvedCharNames,
        characterName: resolvedMainChar,
        characterAppearance: resolvedAppearance,
        location: resolvedLocation,
        timeOfDay: resolvedTime,
        lighting: resolvedLighting,
        visualStyle: resolvedStyle,
        aspectRatio: userLock?.aspectRatio || '16:9',
        resolution: userLock?.resolution || '720p',
        cameraMovement: resolvedCameraMovement,
        cameraShotType: resolvedCameraShotType,
        lensType: resolvedLensType,
        props: resolvedProps,
        characterPosition: userLock?.characterPosition || '',
        lockActionMomentum: userLock?.lockActionMomentum ?? true,
        lockColorGrade: userLock?.lockColorGrade || 'Film grain Kodak Vision3, rich warm contrast'
      };

      setContinuityLock(freshContinuityLock);

      // Auto-fill Dialogue Lock strictly from current analysis
      const resolvedScenesCount = result.scenes && result.scenes.length > 0 ? result.scenes.length : clipCount;
      const freshDialogues: DialogueLockEntry[] = (result.dialogues || []).map((d, i) => ({
        id: d.id || `diag_auto_${Date.now()}_${i}`,
        speaker: d.speaker,
        line: d.line,
        emotionTone: d.emotionTone || 'ตามบทต้นฉบับ',
        clipNumber: d.sceneNumber || (i % resolvedScenesCount) + 1
      }));
      setDialogues(freshDialogues);

      // Update clip count to match detected scenes
      setClipCount(resolvedScenesCount);

      // Prompts: offline mode builds them locally right away (labelled "ออฟไลน์");
      // otherwise the user presses "สร้าง Prompt" so Gemini builds them (no silent local fallback).
      if (useOfflineMode) {
        try {
          const freshClips = buildSalaMultiClipPrompts({
            scriptText,
            clipDurationSeconds,
            clipCount: resolvedScenesCount,
            continuityLock: freshContinuityLock,
            dialogues: freshDialogues,
            audioDirectives,
            knownCharacters: freshContinuityLock.characterNames || resolvedCharNames,
            characters: library.payloads
          });
          const validation = validateSalaMultiClipPrompts(freshClips, freshContinuityLock.characterNames || resolvedCharNames);
          setPromptValidation({
            isValid: validation.isValid,
            errors: validation.errors,
            warnings: Array.from(new Set([...library.notices, ...(result.characterWarnings || []), ...validation.warnings, ...autoSplitNotices(freshClips, resolvedScenesCount)]))
          });
          setClips(freshClips);
          setGenerationSource('deterministic');
        } catch (promptErr: any) {
          setPromptGenerationError(`Offline builder: ${promptErr?.message || promptErr}`);
        }
      } else {
        setSplitNotice(`แยกบทด้วย ${result.source === 'gemini-flash' ? 'Gemini' : result.source} สำเร็จ ${resolvedScenesCount} ฉาก — กด "สร้าง Prompt ทุกคลิป" เพื่อให้ Gemini สร้าง Prompt พร้อมล็อคความต่อเนื่อง`);
      }

      // Ensure panels are expanded so user can see filled values
      setShowContinuityPanel(true);
      setShowDialoguePanel(true);
    } catch (err: any) {
      console.error('Failed to auto-split script:', err?.message || err);
      const msg = err?.message || 'ไม่สามารถประมวลผลได้';
      setPromptGenerationError(`แยกบทไม่สำเร็จ / Split failed: ${msg}${useOfflineMode ? '' : '\nลองใหม่ ตรวจสอบ Gemini API Key หรือเลือก "โหมดออฟไลน์"'}`);
      alert('เกิดข้อผิดพลาดในการแยกบท: ' + msg);
    } finally {
      setIsSplittingScript(false);
    }
  };

  // Sync selected characters from Character Library to Master Continuity Lock
  const syncCharactersToContinuity = (selectedIds: string[]) => {
    const selectedChars = characters.filter(c => selectedIds.includes(c.id));
    if (selectedChars.length === 0) {
      setContinuityLock(prev => ({
        ...prev,
        characterId: '',
        characterIds: [],
        characterNames: [],
      }));
      return;
    }

    const names = selectedChars.map(c => c.name);
    const combinedName = names.join(', ');
    const combinedAppearance = selectedChars
      .map(c => {
        const vis = c.visualProfile?.visiblePhysicalAppearance || c.description || '';
        const outfit = c.visualProfile?.visibleOutfit || c.outfitDescription || 'ชุดประจำตัว';
        return `${c.name} (${c.triggerTag}): ${vis}, สวมใส่: ${outfit}`;
      })
      .join(' | ');

    setContinuityLock(prev => ({
      ...prev,
      characterId: selectedChars[0].id,
      characterIds: selectedIds,
      characterNames: names,
      characterName: combinedName,
      characterAppearance: combinedAppearance
    }));
  };

  const handleToggleCharacter = (charId: string) => {
    const isSelected = selectedCharacterIds.includes(charId);
    const newSelected = isSelected
      ? selectedCharacterIds.filter(id => id !== charId)
      : [...selectedCharacterIds, charId];
    
    setSelectedCharacterIds(newSelected);
    syncCharactersToContinuity(newSelected);
  };

  const handleSelectAllCharacters = () => {
    const allIds = characters.map(c => c.id);
    setSelectedCharacterIds(allIds);
    syncCharactersToContinuity(allIds);
  };

  const handleClearCharacters = () => {
    setSelectedCharacterIds([]);
    setContinuityLock(prev => ({
      ...prev,
      characterId: '',
      characterIds: [],
      characterNames: [],
      characterName: '',
      characterAppearance: ''
    }));
  };

  // Sync selected character from Character Library if changed
  const handleSelectCharacterFromLibrary = (charId: string) => {
    if (!charId) {
      setSelectedCharacterIds([]);
      setContinuityLock(prev => ({
        ...prev,
        characterId: '',
        characterIds: [],
        characterNames: [],
        characterName: '',
        characterAppearance: ''
      }));
      return;
    }
    const found = characters.find(c => c.id === charId);
    if (found) {
      setSelectedCharacterIds([found.id]);
      setContinuityLock(prev => ({
        ...prev,
        characterId: found.id,
        characterIds: [found.id],
        characterNames: [found.name],
        characterName: found.name,
        characterAppearance: `${found.triggerTag}, ${found.visualProfile?.visiblePhysicalAppearance || found.description}, สวมใส่: ${found.visualProfile?.visibleOutfit || found.outfitDescription || 'ชุดตามลักษณะตัวละคร'}`
      }));
    }
  };

  // Location selection and sync to Master Continuity Lock
  const handleSelectLocation = (loc: LocationItem | null) => {
    if (!loc) {
      setContinuityLock(prev => ({
        ...prev,
        locationId: '',
        locationLocked: false,
        locationVisualDetails: '',
        locationImageHash: '',
        locationReferenceUrl: '',
        location: ''
      }));
      return;
    }

    // The owner's factual description (verbatim) is the lock; structured fields only as a fallback
    const details = locationDescriptionOf(loc);

    setContinuityLock(prev => ({
      ...prev,
      locationId: loc.id,
      locationLocked: true,
      locationVisualDetails: details,
      locationImageHash: loc.imageHash || loc.visualProfile?.imageHash || '',
      locationReferenceUrl: loc.referenceImageUrl || loc.visualProfile?.referenceImageUrl || loc.thumbnailUrl || '',
      location: loc.name
    }));
  };

  useEffect(() => {
    if (initialPrompt) {
      setScriptText(initialPrompt);
    }
  }, [initialPrompt]);

  useEffect(() => {
    if (initialCharacterId && characters && characters.length > 0) {
      handleSelectCharacterFromLibrary(initialCharacterId);
    }
  }, [initialCharacterId, characters]);

  useEffect(() => {
    if (initialLocationId && locations && locations.length > 0) {
      const match = locations.find(l => l.id === initialLocationId);
      if (match) {
        handleSelectLocation(match);
      }
    }
  }, [initialLocationId, locations]);

  // Load Preset
  const handleLoadSample = (sample: typeof SAMPLE_SCRIPTS[0]) => {
    setScriptText(sample.script);
    setClipCount(sample.dialogues.length || 3);
    setContinuityLock(prev => ({
      ...prev,
      characterName: sample.charName,
      characterAppearance: sample.charAppearance,
      location: sample.location,
      timeOfDay: sample.timeOfDay,
      lighting: sample.lighting,
      visualStyle: sample.style,
      props: sample.props
    }));
    setDialogues(sample.dialogues);
    setClips([]);
  };

  // Add Dialogue Entry
  const handleAddDialogue = () => {
    if (!newSpeaker.trim() || !newLine.trim()) return;
    if (isReservedSystemKeyword(newSpeaker.trim())) {
      alert(`คำว่า "${newSpeaker.trim()}" เป็น Reserved System Keyword ห้ามใช้เป็นชื่อผู้พูดหรือตัวละคร`);
      return;
    }
    const newEntry: DialogueLockEntry = {
      id: `diag_${Date.now()}`,
      speaker: newSpeaker.trim(),
      line: newLine.trim(),
      emotionTone: newEmotion.trim() || 'เป็นธรรมชาติ',
      clipNumber: newClipNum
    };
    setDialogues(prev => [...prev, newEntry]);
    setNewLine('');
  };

  const handleRemoveDialogue = (id: string) => {
    setDialogues(prev => prev.filter(d => d.id !== id));
  };

  // Generate All Prompts in One Click
  // Gemini failures are shown to the user; the offline builder is used only when the user explicitly agrees.
  const handleGenerateAllPrompts = async (forceOffline: boolean = false) => {
    const offlineRequested = forceOffline || useOfflineMode;
    // Offline mode builds prompts in the browser, so it works without login or the API server
    if (!effectiveAuthUser && !offlineRequested) {
      if (onLogin) {
        onLogin();
      }
      return;
    }

    if (!scriptText.trim()) {
      alert('กรุณากรอกบทหรือคำอธิบายฉากก่อนสร้าง Prompt');
      return;
    }

    setIsGeneratingPrompts(true);
    setPromptGenerationError(null);
    setPromptValidation(null);
    setClips([]);

    const characterNames = characters.map(c => c.name);
    if (continuityLock.characterName) characterNames.push(continuityLock.characterName);
    (continuityLock.characterNames || []).forEach(n => n && characterNames.push(n));

    // Library characters of the lock (name + face / hair / outfit / appearance) for the Character Lock
    // All library cards: the engine picks the card of each script name (normalized exact match)
    const library = await getLibraryLockPayloads();
    const lockedLibraryCharacters = library.payloads;

    const applyClips = (newClips: DirectedClipItem[], source: 'gemini-ai' | 'deterministic') => {
      // ระบบ DIALOGUE 20-WORD SPLIT:
      // ถ้าบทพูดของตัวละครยาวเกิน 20 คำ ให้ตัดเฉพาะบทพูดส่วนที่เกินไปต่อในคลิปถัดไปอัตโนมัติ
      const splitResult = applyDialogue20WordSplitToClips(newClips, clipDurationSeconds);
      const finalizedClips = splitResult.clips;

      // Validate prompts and surface the result in the UI (not only the console)
      const validation = validateSalaMultiClipPrompts(finalizedClips, characterNames);
      setPromptValidation({ isValid: validation.isValid, errors: validation.errors, warnings: Array.from(new Set([...library.notices, ...validation.warnings, ...autoSplitNotices(finalizedClips, clipCount)])) });
      setClips(finalizedClips);
      setGenerationSource(source);
    };

    // OFFLINE: same inputs as the server's offline branch (server.ts), built locally; no fetch
    if (offlineRequested) {
      try {
        const lockedNames: string[] = Array.from(new Set([
          ...expandCombinedCharacterNames([String(continuityLock?.characterName || '')]),
          ...expandCombinedCharacterNames(continuityLock?.characterNames || []),
          ...dialogues.filter(d => d && d.speaker && !isReservedSystemKeyword(d.speaker)).map(d => String(d.speaker || ''))
        ].map(n => n.trim()).filter(n => n && !isReservedSystemKeyword(n) && !isMetadataKeyword(n))));
        // Location Lock from the library is applied inside the builder (verbatim description + reference line)
        const localClips = buildSalaMultiClipPrompts({
          scriptText,
          clipDurationSeconds: Math.max(3, Math.min(30, Number(clipDurationSeconds) || 10)),
          clipCount: Math.max(1, Math.min(10, Number(clipCount) || 3)),
          continuityLock,
          dialogues: dialogues.filter(d => d && d.speaker && !isReservedSystemKeyword(d.speaker)),
          audioDirectives,
          knownCharacters: lockedNames,
          characters: lockedLibraryCharacters,
          locations: library.locationPayloads
        });
        applyClips(localClips, 'deterministic');
      } catch (localErr: any) {
        setPromptGenerationError(`Offline builder: ${localErr?.message || localErr}`);
      } finally {
        setIsGeneratingPrompts(false);
      }
      return;
    }

    try {
      const res = await api.generateMultiClipDirectorPrompts({
        scriptText,
        clipDurationSeconds,
        clipCount,
        continuityLock,
        dialogues,
        audioDirectives,
        offline: forceOffline || useOfflineMode,
        characters: forServer(lockedLibraryCharacters) as any,
        // All library locations: the server matches the clip location by name (or the selected id)
        locations: forServer(library.locationPayloads) as any
      });
      applyClips(res.clips, res.source);
    } catch (err: any) {
      const msg = err?.message || 'ไม่สามารถสร้าง Prompt ได้ / Prompt generation failed';
      console.warn('Multi-clip prompt generation failed:', msg);
      setPromptGenerationError(msg);
      if (!forceOffline && !useOfflineMode && confirm(`สร้าง Prompt ด้วย Gemini ไม่สำเร็จ / Gemini failed:\n${msg}\n\nต้องการสร้างแบบออฟไลน์ (ไม่ใช้ AI) แทนหรือไม่? / Build offline prompts instead?`)) {
        try {
          const localClips = buildSalaMultiClipPrompts({
            scriptText,
            clipDurationSeconds,
            clipCount,
            continuityLock,
            dialogues,
            audioDirectives,
            knownCharacters: [...(continuityLock.characterNames || []), ...characterNames],
            characters: lockedLibraryCharacters,
            locations: library.locationPayloads
          });
          applyClips(localClips, 'deterministic');
          setPromptGenerationError(null);
        } catch (localErr: any) {
          setPromptGenerationError(`${msg}\nOffline builder: ${localErr?.message || localErr}`);
        }
      }
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  // Copy Single Clip
  const handleCopySingleClip = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedClipIndex(index);
    setTimeout(() => setCopiedClipIndex(null), 2500);
  };

  // Copy All Clips Prompt Formatted
  const handleCopyAllClips = () => {
    if (clips.length === 0) return;
    const fullText = clips.map(c => (
`=== [CLIP ${c.clipNumber}/${clips.length} - ${c.title} (${c.durationSeconds}s)] ===
${c.generatedPrompt}

Negative Prompt:
${c.negativePrompt}
`
    )).join('\n\n----------------------------------------------------\n\n');

    navigator.clipboard.writeText(fullText);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2500);
  };

  // Save Inline Edit
  const handleSaveClipEdit = (index: number) => {
    setClips(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        generatedPrompt: editPromptValue
      };
      return updated;
    });
    setEditingClipIndex(null);
  };

  // Update a single dialogue's camera / background control inside a clip
  const handleUpdateClipDialogue = (clipIdx: number, dialogueIdx: number, updatedDialogue: DialogueLockEntry) => {
    setClips(prev => {
      const updated = [...prev];
      const targetClip = { ...updated[clipIdx] };
      const nextDialogues = [...(targetClip.dialogues || [])];
      nextDialogues[dialogueIdx] = updatedDialogue;
      targetClip.dialogues = nextDialogues;

      // Automatically refresh the prompt so the camera tags appear attached directly to dialogue
      // Rule: "ห้ามรวมคำสั่งกล้องไว้ที่ต้นคลิป ทุกคำสั่งกล้องต้องถูกแทรกให้ติดกับบทพูดที่มันควบคุม และอยู่ใกล้บทพูดที่สุด"
      const allSceneChars = targetClip.charactersPresent && targetClip.charactersPresent.length > 0
        ? targetClip.charactersPresent
        : (continuityLock.characterNames || []);
      const refreshed = refreshClipPromptWithCameraControls(targetClip, allSceneChars);
      targetClip.generatedPrompt = refreshed;

      updated[clipIdx] = targetClip;
      return updated;
    });
  };

  // Regenerate Single Clip
  const handleRegenerateSingleClip = async (clip: DirectedClipItem, index: number) => {
    if (!effectiveAuthUser) {
      if (onLogin) onLogin();
      return;
    }
    setIsRegeneratingClip(index);
    try {
      const prevClip = index > 0 ? clips[index - 1] : null;
      const nextClip = index < clips.length - 1 ? clips[index + 1] : null;

      const res = await api.regenerateSingleClipPrompt({
        clipNumber: clip.clipNumber,
        totalClips: clips.length,
        durationSeconds: clip.durationSeconds,
        sceneSummary: clip.sceneSummary,
        previousClipEndAction: prevClip ? prevClip.endAction : '',
        nextClipStartAction: nextClip ? nextClip.startAction : '',
        continuityLock,
        dialogues: dialogues.filter(d => d.clipNumber === clip.clipNumber),
        audioDirectives
      });

      setClips(prev => {
        const nextClips = [...prev];
        nextClips[index] = res.clip;
        return nextClips;
      });
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการสร้างคลิปใหม่: ' + err.message);
    } finally {
      setIsRegeneratingClip(null);
    }
  };

  // Auto Generate Calculations & Accurate Cost Estimation
  const costPerClip = activeProvider?.models?.[0]?.costPerVideoSec
    ? activeProvider.models[0].costPerVideoSec * clipDurationSeconds
    : 60;
  const totalCost = costEstimate?.totalCredits ?? (clips.length * costPerClip);
  const canAfford = credits ? credits.remainingCredits >= totalCost : false;

  const handleOpenAutoConfirmModal = async () => {
    if (!effectiveAuthUser) {
      if (onLogin) onLogin();
      return;
    }
    setIsEstimatingCost(true);
    setShowAutoConfirmModal(true);
    try {
      const estimate = await api.estimateCost({
        type: 'video',
        provider: selectedProvider,
        durationSeconds: clipDurationSeconds * clips.length,
        resolution: '720p',
        prompt: clips.map(c => c.generatedPrompt).join(' ')
      });
      setCostEstimate(estimate);
    } catch (err) {
      console.warn('Cost estimation fallback', err);
    } finally {
      setIsEstimatingCost(false);
    }
  };

  // Emergency Stop Handler
  const handleEmergencyStop = async () => {
    const activeJobIds = clips
      .filter(c => c.jobId && (c.status === 'processing' || c.status === 'queued'))
      .map(c => c.jobId!) as string[];

    setIsEmergencyStopping(true);
    try {
      await api.emergencyStop(activeJobIds);
      setClips(prev =>
        prev.map(c =>
          c.status === 'processing' || c.status === 'queued'
            ? { ...c, status: 'cancelled', error: 'ยกเลิกคำสั่งฉุกเฉินแล้ว' }
            : c
        )
      );
      setIsSubmittingBatch(false);
      setBatchProgress({ current: 0, total: 0, message: 'หยุดการทำงานฉุกเฉินสำเร็จ' });
      alert('สั่งหยุดการประมวลผลฉุกเฉินเรียบร้อยแล้ว เครดิตคงเหลือได้รับการปกป้อง');
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการหยุดฉุกเฉิน: ' + err.message);
    } finally {
      setIsEmergencyStopping(false);
    }
  };

  // Execute Auto Batch Generation
  const handleExecuteBatchAutoGenerate = async () => {
    if (!effectiveAuthUser) {
      if (onLogin) onLogin();
      return;
    }
    if (!isRealProvider) {
      alert('โมเดลนี้ไม่รองรับการเรียก Video API จริง กรุณาเลือก Google Gemini & Veo หรือสลับไปใช้ Prompt Mode');
      return;
    }
    if (!canAfford) {
      alert(`เครดิตไม่เพียงพอ (ต้องการ ${totalCost} เครดิต แต่คงเหลือ ${credits?.remainingCredits || 0} เครดิต)`);
      return;
    }

    setShowAutoConfirmModal(false);
    setIsSubmittingBatch(true);
    setBatchProgress({ current: 0, total: clips.length, message: 'กำลังเตรียมส่งคิวประมวลผล...' });

    try {
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        setBatchProgress({
          current: i + 1,
          total: clips.length,
          message: `กำลังส่งคลิปที่ ${i + 1}/${clips.length} ไปยัง ${activeProvider.name}...`
        });

        // Update clip status
        setClips(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'queued' };
          return next;
        });

        const payload: GenerateRequestPayload = {
          type: 'video',
          provider: selectedProvider,
          model: `${selectedProvider}-standard`,
          prompt: clip.generatedPrompt,
          negativePrompt: clip.negativePrompt,
          aspectRatio: continuityLock.aspectRatio,
          durationSeconds: clip.durationSeconds,
          characterId: continuityLock.characterId || undefined
        };

        let result: Awaited<ReturnType<typeof api.startGeneration>>;
        try {
          result = await api.startGeneration(payload);
        } catch (dispatchErr: any) {
          // Surface the server's error on the clip itself instead of leaving it stuck in 'queued'
          setClips(prev => {
            const next = [...prev];
            next[i] = { ...next[i], status: 'failed', error: dispatchErr?.message || 'ไม่สามารถเริ่มการสร้างได้' };
            return next;
          });
          throw dispatchErr;
        }

        setClips(prev => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            status: 'processing',
            jobId: result.jobId
          };
          return next;
        });

        onGenerationStarted(result.jobId);
        // Pause slightly between dispatch
        await new Promise(r => setTimeout(r, 600));
      }

      setBatchProgress({
        current: clips.length,
        total: clips.length,
        message: 'ส่งทุกคลิปเข้าสู่คิวประมวลผลเรียบร้อยแล้ว!'
      });
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดขณะส่งงาน: ' + (err.message || 'ไม่ทราบสาเหตุ'));
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-32">
      {/* Header Banner */}
      <div className="relative rounded-3xl bg-gradient-to-br from-indigo-950/60 via-[#0e1424] to-slate-900 border border-indigo-500/20 p-5 sm:p-7 shadow-2xl overflow-hidden mb-6">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
                <Clapperboard className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                  <span>ผู้กำกับหลายคลิปต่อเนื่อง</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Master Continuity Director
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-300">
                  ระบบแบ่งบทหลายคลิป ล็อคความต่อเนื่อง 10 มิติ ล็อคบทพูดไทย และแนบคำสั่งเสียงภาพยนตร์อัตโนมัติ
                </p>
              </div>
            </div>

            {/* Presets & Director Tool Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowVideoToScriptModal(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/30 transition-all flex items-center gap-1.5 active:scale-95"
                title="ถอดวิดีโอเป็นบทภาพยนตร์และมุมกล้อง"
              >
                <FileVideo className="w-3.5 h-3.5" />
                <span>ถอดวิดีโอเป็นบท</span>
              </button>
              <button
                onClick={() => setShowScriptEditorModal(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 active:scale-95"
                title="สลับตัวละครในบทและบทพูด"
              >
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>สลับตัวละครในบท</span>
              </button>
              <button
                onClick={() => setShowContinuityCheckerModal(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 transition-all flex items-center gap-1.5 active:scale-95"
                title="สแกนความต่อเนื่องข้ามคลิป 10 มิติ"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>ตรวจความต่อเนื่อง</span>
              </button>
              <button
                onClick={() => setShowSocialPostModal(true)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 border border-pink-500/30 transition-all flex items-center gap-1.5 active:scale-95"
                title="สร้างแคปชั่นและพาดหัวไวรัล"
              >
                <Share2 className="w-3.5 h-3.5 text-pink-400" />
                <span>AI ผู้ช่วยโซเชียล</span>
              </button>

              <div className="h-4 w-px bg-slate-700 hidden sm:block mx-1" />

              <button
                onClick={() => handleLoadSample(SAMPLE_SCRIPTS[0])}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>ตัวอย่าง 1 (โบราณคดี)</span>
              </button>
              <button
                onClick={() => handleLoadSample(SAMPLE_SCRIPTS[1])}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Flame className="w-3.5 h-3.5 text-rose-400" />
                <span>ตัวอย่าง 2 (ไซเบอร์พังก์)</span>
              </button>
            </div>
          </div>

          {/* TWO MAIN MODES SWITCHER (Mobile First) */}
          <div className="mt-5 pt-5 border-t border-slate-800/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Mode A: Prompt Mode */}
              <button
                onClick={() => setDirectorMode('prompt_only')}
                className={`p-4 rounded-2xl border text-left transition-all relative ${
                  directorMode === 'prompt_only'
                    ? 'bg-indigo-900/40 border-indigo-500 shadow-lg shadow-indigo-500/20 text-white'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    1. Prompt Mode (โหมดสร้าง Prompt ฟรี)
                  </span>
                  <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    0 เครดิต (ฟรี)
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  สร้างชุด Prompt หลายคลิปต่อเนื่องแบบมืออาชีพ พร้อมคัดลอกไปใช้ใน Runway, Sora, Kling, Luma 
                  <strong className="text-indigo-300 ml-1">ไม่มีการเรียก Video API และไม่เสียค่าใช้จ่ายใดๆ</strong>
                </p>
                {directorMode === 'prompt_only' && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-indigo-400 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> โหมดที่เลือกใช้งาน
                  </div>
                )}
              </button>

              {/* Mode B: Auto Generate Mode */}
              <button
                onClick={() => setDirectorMode('auto_generate')}
                className={`p-4 rounded-2xl border text-left transition-all relative ${
                  directorMode === 'auto_generate'
                    ? 'bg-indigo-900/40 border-indigo-500 shadow-lg shadow-indigo-500/20 text-white'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-base flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    2. Auto Generate Mode (ส่งสร้างอัตโนมัติ)
                  </span>
                  {isRealProvider ? (
                    <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      API พร้อมใช้งาน
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                      รองรับเฉพาะ API จริง
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ส่งชุด Prompt สร้างวิดีโออัตโนมัติไปยัง Provider ที่เชื่อมต่อ API จริง (Google Veo)
                  <span className="text-amber-300 block mt-1">
                    *หากเลือก Provider ที่ไม่มี API จริง ระบบจะแนะนำให้ใช้ Prompt Mode เพื่อป้องกันสถานะปลอม
                  </span>
                </p>
                {directorMode === 'auto_generate' && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> โหมดที่เลือกใช้งาน
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Provider Selector for Auto Generate Mode */}
      {directorMode === 'auto_generate' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <span>เลือก Provider สำหรับ Auto Generate Mode</span>
              </h2>
              <p className="text-xs text-slate-400">
                ระบบจะตรวจสอบความพร้อมของ API จริงก่อนส่งสร้างผลงาน
              </p>
            </div>

            {/* Provider Status Pill */}
            {isRealProvider ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Google Veo API เชื่อมต่อจริง (Real Connected)</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>ไม่มี API วิดีโอจริง — แนะนำใช้ Prompt Mode</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {providers.map(p => {
              const isSelected = selectedProvider === p.id;
              const hasRealVideo = p.id === 'gemini' && p.hasServerKey;

              return (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs truncate">{p.name}</span>
                    {hasRealVideo ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400" title="API เชื่อมต่อจริง" />
                    ) : (
                      <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded">Mock</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    {hasRealVideo ? 'รองรับ Video API จริง' : 'จำลอง (ไม่สร้างวิดีโอจริง)'}
                  </span>
                </button>
              );
            })}
          </div>

          {!isRealProvider && (
            <div className="mt-3 p-3 bg-amber-950/30 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <strong>คำเตือนความปลอดภัยของระบบ:</strong> Provider นี้ไม่มีการเชื่อมต่อ Video API จริง ห้ามแสดงสถานะปลอมว่าสร้างได้จริง กรุณาเปลี่ยนเป็น <strong>Google Gemini & Veo</strong> หรือสลับไปใช้ <strong>Prompt Mode</strong> เพื่อคัดลอก Prompt ไปใช้งานฟรี
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Controls & Prompt Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Script, Master Continuity Lock, Dialogue, Audio Directives */}
        <div className="lg:col-span-5 space-y-5">
          {/* Section: AI Story Continuation / ต่อบทอัตโนมัติ */}
          <StoryContinuationPanel
            originalStory={originalStory}
            setOriginalStory={setOriginalStory}
            currentScriptText={scriptText}
            setScriptText={setScriptText}
            clips={clips}
            setClips={setClips}
            setClipCount={setClipCount}
            characters={characters}
            continuityLock={continuityLock}
            clipDurationSeconds={clipDurationSeconds}
            onContinuityLockSuggested={(suggested) => {
              // Rule 2 & Constraint: ห้ามแตะ Character Lock และไม่สร้าง/ดึงข้อมูล Character Lock จากช่องนี้
              setContinuityLock(prev => ({
                ...prev,
                location: prev.location?.trim() ? prev.location : (suggested.location && suggested.location !== 'ไม่ระบุจากต้นฉบับ' ? suggested.location : ''),
                timeOfDay: prev.timeOfDay?.trim() ? prev.timeOfDay : (suggested.timeOfDay && suggested.timeOfDay !== 'ไม่ระบุจากต้นฉบับ' ? suggested.timeOfDay : '')
              }));
            }}
          />

          {/* Section 1: Script Input & Splitting */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-3xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>วางบทหรือฉากหลายฉาก (Script)</span>
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-split-dialogue-20words"
                  onClick={() => {
                    const result = splitScriptTextDialoguesAt20Words(scriptText);
                    setScriptText(result.formattedText);
                    if (result.totalSplits > 0) {
                      alert(`ตัดแบ่งบทพูดที่ยาวเกิน 20 คำสำเร็จ ${result.totalSplits} จุด โดยไม่เสียความหมายและรักษาผู้พูดคนเดิม`);
                    } else {
                      alert('บทพูดทุกประโยคมีความยาวไม่เกิน 20 คำอยู่แล้ว (ได้มาตรฐาน)');
                    }
                  }}
                  disabled={!scriptText.trim()}
                  title="ถ้าบทพูดของตัวละครยาวเกิน 20 คำ ให้ตัดเฉพาะบทพูดส่วนที่เกินไปต่อในคลิปถัดไปอัตโนมัติ"
                  className="px-2.5 py-1 rounded-xl bg-purple-950/70 hover:bg-purple-900/90 text-purple-300 border border-purple-500/40 text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Scissors className="w-3.5 h-3.5 text-purple-400" />
                  <span>ตัดบทพูด 20 คำ</span>
                </button>
                <button
                  type="button"
                  id="btn-format-act-trigger"
                  onClick={() => {
                    const formatted = formatScriptWithActTriggerTags(scriptText);
                    setScriptText(formatted);
                  }}
                  disabled={!scriptText.trim()}
                  title="ใส่แท็ก [ACT_TRIGGER] ... [ACTION_END] ครอบตำแหน่ง Action & Narration ตามลำดับเดิม"
                  className="px-2.5 py-1 rounded-xl bg-teal-950/70 hover:bg-teal-900/90 text-teal-300 border border-teal-500/40 text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                  <span>ใส่แท็ก [ACT_TRIGGER]</span>
                </button>
                <span className="text-xs text-slate-400">
                  รองรับภาษาไทย
                </span>
              </div>
            </div>

            <textarea
              value={scriptText}
              onChange={(e) => {
                setScriptText(e.target.value);
              }}
              rows={6}
              placeholder="วางบทละคร, โครงเรื่อง หรือลำดับฉากที่ต้องการแบ่ง เช่น:
ฉากที่ 1: ตัวละครเดินเข้าสู่วิหาร...
ฉากที่ 2: พบรหัสลับและเริ่มเปิดกลไก...
ฉากที่ 3: แสงสีฟ้าส่องสว่างเปิดประตูสู่ห้องใต้ดิน..."
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-2xl p-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
            />

            {/* ACTION & NARRATION LOCK and DIALOGUE 20-WORD SPLIT System Info Cards */}
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {/* ACTION & NARRATION LOCK */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-teal-950/70 via-slate-900 to-indigo-950/70 border border-teal-500/40 text-xs space-y-1.5 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-teal-300">
                    <ShieldCheck className="w-4 h-4 text-teal-400" />
                    <span>ACTION & NARRATION LOCK</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] font-bold border border-teal-500/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    ACTIVE
                  </span>
                </div>
                <ul className="text-slate-300 text-[11px] space-y-1 leading-relaxed list-disc list-inside">
                  <li>อ่านบทตามลำดับเดิมจากบนลงล่าง รักษา Action/Narration ไว้ตำแหน่งเดิมก่อนหรือหลังบทพูด ห้ามข้าม ห้ามย้าย ห้ามตัด ห้ามแปลงเป็นบทพูด</li>
                  <li>ใช้แท็ก <code className="text-amber-300 bg-black/50 px-1 py-0.5 rounded font-mono font-bold">[ACT_TRIGGER]</code> ... <code className="text-amber-300 bg-black/50 px-1 py-0.5 rounded font-mono font-bold">[ACTION_END]</code> ดึง Action, Movement, Emotion/Expression, Narration</li>
                  <li><strong className="text-amber-300">กฎสำคัญ:</strong> ถ้าช่วงใดไม่มี Dialogue ให้ตัวละครเงียบ 100% ห้ามสร้างบทพูดใหม่เองเด็ดขาด</li>
                </ul>
              </div>

              {/* DIALOGUE 20-WORD SPLIT */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/70 border border-purple-500/40 text-xs space-y-1.5 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-bold text-purple-300">
                    <Scissors className="w-4 h-4 text-purple-400" />
                    <span>DIALOGUE 20-WORD SPLIT</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/40 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                    MAX 20 WORDS
                  </span>
                </div>
                <ul className="text-slate-300 text-[11px] space-y-1 leading-relaxed list-disc list-inside">
                  <li>ถ้าบทพูดยาวเกิน 20 คำ ให้ตัดเฉพาะส่วนที่เกินไปต่อในคลิปถัดไปอัตโนมัติ ห้ามตัดคำกลางประโยคเสียความหมาย</li>
                  <li>ห้ามแก้ ห้ามย่อ ห้ามแต่งบทพูดเพิ่ม และรักษาผู้พูดคนเดิม 100%</li>
                  <li>คลิปถัดไปต่อเนื่องจาก END คลิปก่อนหน้า (ท่าทาง ตำแหน่ง สีหน้า กล้อง ฉาก เวลา และเสียง)</li>
                  <li>ถ้าช่วงใดไม่มี Dialogue ใช้ STRICT SILENCE PROTOCOL เงียบ 100%</li>
                </ul>
              </div>
            </div>

            {/* AI Auto-Split & Fill Button */}
            <div className="mt-3">
              <button
                type="button"
                id="btn-ai-split-fill"
                onClick={handleAiSplitAndFill}
                disabled={isSplittingScript || !scriptText.trim()}
                className="w-full bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 hover:from-amber-400 hover:via-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold text-sm py-3 px-4 rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
              >
                {isSplittingScript ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                    <span>AI Gemini Flash กำลังอ่านบทและแยกช่องอัตโนมัติ...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    <span>✨ AI แยกบทและเติมช่องอัตโนมัติ</span>
                  </>
                )}
              </button>
              <label className="mt-2 flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="chk-director-offline"
                  checked={useOfflineMode}
                  onChange={(e) => setUseOfflineMode(e.target.checked)}
                  className="accent-amber-500"
                />
                <span>โหมดออฟไลน์ (ไม่ใช้ Gemini): แยกบทและสร้าง Prompt ด้วยตัวแยกบทในเครื่อง / Offline mode (no AI)</span>
              </label>
              {splitNotice && (
                <div role="status" className="mt-2 p-2.5 rounded-xl bg-indigo-950/50 border border-indigo-500/40 text-xs text-indigo-200">
                  {splitNotice}
                </div>
              )}
            </div>

            {/* Split Success Feedback */}
            {splitSuccessData && (
              <div className="mt-3 p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-start justify-between gap-2 shadow-inner">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-emerald-200">
                      ✨ แยกบทสำเร็จ {splitSuccessData.scenes?.length || clipCount} ฉาก!
                    </p>
                    <p className="text-emerald-300/90 leading-relaxed">
                      เติมตัวละคร, บทพูด ({splitSuccessData.dialogues?.length || 0} บท), สถานที่, แสง และมุมกล้องลงใน Master Continuity Lock เรียบร้อยแล้ว ({splitSuccessData.source === 'gemini-flash' ? 'Gemini Flash' : 'Smart Fallback Parser'})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSplitSuccessData(null)}
                  className="text-slate-400 hover:text-white p-1 text-base leading-none"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Split controls (Duration per clip & Clip count) */}
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  ความยาวต่อคลิป
                </label>
                <select
                  value={clipDurationSeconds}
                  onChange={(e) => setClipDurationSeconds(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value={5}>5 วินาที / คลิป</option>
                  <option value={6}>6 วินาที / คลิป</option>
                  <option value={8}>8 วินาที / คลิป</option>
                  <option value={10}>10 วินาที / คลิป (มาตรฐาน)</option>
                  <option value={12}>12 วินาที / คลิป</option>
                  <option value={15}>15 วินาที / คลิป</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  จำนวนคลิปที่ต้องการแบ่ง
                </label>
                <select
                  value={clipCount}
                  onChange={(e) => setClipCount(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value={2}>2 คลิปต่อเนื่อง (รวม {clipDurationSeconds * 2} วิ)</option>
                  <option value={3}>3 คลิปต่อเนื่อง (รวม {clipDurationSeconds * 3} วิ)</option>
                  <option value={4}>4 คลิปต่อเนื่อง (รวม {clipDurationSeconds * 4} วิ)</option>
                  <option value={5}>5 คลิปต่อเนื่อง (รวม {clipDurationSeconds * 5} วิ)</option>
                  <option value={6}>6 คลิปต่อเนื่อง (รวม {clipDurationSeconds * 6} วิ)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Master Continuity Lock (10 Dimensions) */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-3xl p-5 shadow-lg">
            <button
              onClick={() => setShowContinuityPanel(!showContinuityPanel)}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>Master Continuity Lock</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/30">
                      ล็อค 10 มิติ
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    ล็อคตัวละคร (เลือกได้หลายตัว), สถานที่, เวลา, แสง, สไตล์, กล้อง, พร็อพ, ตำแหน่ง, และส่งต่อโมเมนตัม
                  </p>
                </div>
              </div>
              {showContinuityPanel ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>

            {showContinuityPanel && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-3.5">
                {/* 1. Character Lock (ระบบเลือกหลายตัวละครจากคลังตัวละคร) */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <span>1. ล็อคตัวละคร (Character Lock)</span>
                      </label>
                      {selectedCharacterIds.length > 0 && (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/30">
                          เลือกแล้ว {selectedCharacterIds.length} ตัว
                        </span>
                      )}
                    </div>
                    {characters.length > 0 && (
                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={handleSelectAllCharacters}
                          className="text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          เลือกทั้งหมด
                        </button>
                        <span className="text-slate-600">|</span>
                        <button
                          type="button"
                          onClick={handleClearCharacters}
                          className="text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          ล้างการเลือก
                        </button>
                      </div>
                    )}
                  </div>

                  {/* รายการตัวละครในคลังที่สามารถเลือกได้หลายตัวพร้อมกัน */}
                  {characters.length > 0 ? (
                    <div className="space-y-2">
                      <div className="text-[11px] text-slate-400">
                        เลือกตัวละครที่ต้องการล็อคความต่อเนื่อง (สามารถเลือกได้หลายตัวจากคลัง):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                        {characters.map(char => {
                          const isSelected = selectedCharacterIds.includes(char.id);
                          return (
                            <button
                              key={char.id}
                              type="button"
                              onClick={() => handleToggleCharacter(char.id)}
                              className={`p-2 rounded-xl border flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-sm ring-1 ring-indigo-500/40'
                                  : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                              }`}
                            >
                              <img
                                src={char.referenceImageUrl || char.visualProfile?.referenceImageUrl || char.visualProfile?.referenceImage || char.avatarUrl || (char.referenceImages && char.referenceImages[0])}
                                alt={char.name}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
                                referrerPolicy="no-referrer"
                              />
                              <div className="overflow-hidden flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-xs font-semibold truncate">{char.name}</span>
                                    {(char.lockStatus === 'LOCKED' || char.isVerifiedByUser || char.imageAnalysisStatus === 'USER_CONFIRMED') && (
                                      <span className="text-[9px] bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-1 py-0.2 rounded font-sans font-medium">
                                        LOCKED
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-400 shrink-0">{char.gender}</span>
                                </div>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <p className="text-[10px] text-indigo-400/90 font-mono truncate">
                                    {char.triggerTag}
                                  </p>
                                  {(char.visualProfileImageHash || char.referenceMetadata?.imageHash) && (
                                    <span className="text-[9px] text-slate-400 font-mono shrink-0">
                                      #{(char.visualProfileImageHash || char.referenceMetadata?.imageHash || '').slice(0, 6)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                  isSelected
                                    ? 'bg-indigo-600 border-indigo-400 text-white'
                                    : 'border-slate-700 bg-slate-950'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-3 text-center">
                      <p className="text-xs text-slate-400">ยังไม่มีตัวละครในคลังตัวละคร</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        ท่านสามารถสร้างและบันทึกตัวละครใน Character Library เพื่อนำมาเลือกล็อคความต่อเนื่องที่นี่ได้
                      </p>
                    </div>
                  )}

                  {/* แถบแสดงตัวละครที่เลือกไว้ */}
                  {selectedCharacterIds.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <div className="text-[11px] text-slate-400 mb-1.5">ตัวละครที่ถูกเลือกและล็อคไว้:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {characters
                          .filter(c => selectedCharacterIds.includes(c.id))
                          .map(char => (
                            <span
                              key={char.id}
                              className="inline-flex items-center gap-1.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-medium px-2 py-1 rounded-lg"
                            >
                              <img
                                src={char.referenceImageUrl || char.visualProfile?.referenceImageUrl || char.visualProfile?.referenceImage || char.avatarUrl || (char.referenceImages && char.referenceImages[0])}
                                alt={char.name}
                                className="w-4 h-4 rounded-full object-cover shrink-0 border border-indigo-400/40"
                                referrerPolicy="no-referrer"
                              />
                              <span>{char.name}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleCharacter(char.id);
                                }}
                                className="hover:text-rose-400 transition-colors p-0.5"
                                title="ลบตัวละครนี้ออกจากการเลือก"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* ข้อมูลสรุปชื่อตัวละครและลักษณะที่ใช้ล็อค (แก้ไขได้ตามต้องการ) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                        ชื่อตัวละครที่ล็อค (รองรับหลายคน คั่นด้วยจุลภาค)
                      </label>
                      <input
                        type="text"
                        placeholder="ชื่อตัวละคร เช่น วีระ, เมษา"
                        value={continuityLock.characterName}
                        onChange={(e) => setContinuityLock({ ...continuityLock, characterName: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                        ลักษณะใบหน้า/ทรงผม/ชุดประจำตัว
                      </label>
                      <input
                        type="text"
                        placeholder="ลักษณะใบหน้า/ทรงผม/ชุดประจำตัว หรือคำสั่งเฉพาะ"
                        value={continuityLock.characterAppearance}
                        onChange={(e) => setContinuityLock({ ...continuityLock, characterAppearance: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2 & 3. Location & Time of Day */}
                <div className="space-y-3">
                  {/* 2. ล็อคสถานที่ (Location Lock) */}
                  <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-emerald-400" />
                          <span>2. ล็อคสถานที่ & ฉาก (Location Lock)</span>
                        </label>
                        {continuityLock.locationLocked && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            <span>LOCKED</span>
                          </span>
                        )}
                      </div>
                      {continuityLock.locationId && (
                        <button
                          type="button"
                          onClick={() => handleSelectLocation(null)}
                          className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        >
                          ปลดล็อค / ล้างค่า
                        </button>
                      )}
                    </div>

                    {/* รายการสถานที่ในคลัง (Location Library) */}
                    {locations && locations.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] text-slate-400">เลือกสถานที่จากคลัง (Location Library):</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                          {locations.map(loc => {
                            const isSelected = continuityLock.locationId === loc.id;
                            const visual = loc.visualProfile;
                            return (
                              <button
                                key={loc.id}
                                type="button"
                                onClick={() => handleSelectLocation(isSelected ? null : loc)}
                                className={`p-2 rounded-xl border flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/40'
                                    : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700'
                                }`}
                              >
                                <img
                                  src={loc.referenceImageUrl || loc.thumbnailUrl || (loc.referenceImages && loc.referenceImages[0]) || loc.referenceImageBackup}
                                  alt={loc.name}
                                  onError={e => { const b = loc.referenceImageBackup; if (b && e.currentTarget.src !== b) e.currentTarget.src = b; }}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="overflow-hidden flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-semibold truncate">{loc.name}</span>
                                    <span className="text-[9px] bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-1 py-0.2 rounded font-sans font-medium shrink-0">
                                      LOCK
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 truncate">
                                    <span>{visual?.architecturalStyle || visual?.environmentType || 'สถานที่'}</span>
                                    {loc.imageHash && (
                                      <span className="text-[9px] font-mono text-emerald-400/80">
                                        #{loc.imageHash.slice(0, 6)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div
                                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                    isSelected
                                      ? 'bg-emerald-600 border-emerald-400 text-white'
                                      : 'border-slate-700 bg-slate-950'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* รายละเอียดสถาปัตยกรรมที่ล็อคไว้ */}
                    {continuityLock.locationLocked && continuityLock.locationVisualDetails && (
                      <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-2.5 text-[11px] text-emerald-200/90 leading-relaxed">
                        <span className="font-semibold text-emerald-300 block mb-0.5">🏛️ สถาปัตยกรรม & องค์ประกอบที่ถูกล็อคข้ามคลิป:</span>
                        <p className="line-clamp-2">{continuityLock.locationVisualDetails}</p>
                      </div>
                    )}

                    {/* ช่องกรอกข้อความสถานที่ */}
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-medium">
                        ชื่อสถานที่ในฉาก หรือระบุเพิ่มเติม
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น ห้องปฏิบัติการ, ฐานสำรวจ, ถนนคนเดิน"
                        value={continuityLock.location}
                        onChange={(e) => setContinuityLock({ ...continuityLock, location: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* 3. ล็อคเวลา (Time of Day) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      3. ล็อคเวลา (Time of Day)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น กลางวัน, ทไวไลท์ยามเย็น, กลางคืน"
                      value={continuityLock.timeOfDay}
                      onChange={(e) => setContinuityLock({ ...continuityLock, timeOfDay: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* 4 & 5. Lighting & Visual Style */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      4. ล็อคสภาพแสง (Lighting)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น แสงไฟนีออนสีขาวนวล, แสงธรรมชาติแดดยามบ่าย"
                      value={continuityLock.lighting}
                      onChange={(e) => setContinuityLock({ ...continuityLock, lighting: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      5. ล็อคสไตล์ภาพ (Visual Style)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น Cinematic 8K 35mm, Realistic"
                      value={continuityLock.visualStyle}
                      onChange={(e) => setContinuityLock({ ...continuityLock, visualStyle: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* 6 & 7. Aspect Ratio & Lens/Camera */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      6. อัตราส่วนภาพ (Aspect Ratio)
                    </label>
                    <select
                      value={continuityLock.aspectRatio}
                      onChange={(e) => setContinuityLock({ ...continuityLock, aspectRatio: e.target.value as AspectRatio })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="16:9">16:9 แนวนอน (ภาพยนตร์/YouTube)</option>
                      <option value="9:16">9:16 แนวตั้ง (TikTok/Reels/Shorts)</option>
                      <option value="1:1">1:1 สี่เหลี่ยมจัตุรัส (Instagram)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      7. กล้องและเลนส์ (Camera & Lens)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น 35mm Anamorphic, Tracking Shot"
                      value={continuityLock.lensType}
                      onChange={(e) => setContinuityLock({ ...continuityLock, lensType: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* 8, 9 & 10. Props, Position, and Action Momentum Chain */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      8. ล็อคพร็อพ/อุปกรณ์ (Props)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น คอนโซลควบคุม, สมุดบันทึก, กระเป๋าสะพาย"
                      value={continuityLock.props}
                      onChange={(e) => setContinuityLock({ ...continuityLock, props: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      9. ตำแหน่งตัวละคร (Position Anchor)
                    </label>
                    <input
                      type="text"
                      placeholder="เช่น ยืนกึ่งกลางเฟรม เคลื่อนที่ไปข้างหน้า"
                      value={continuityLock.characterPosition}
                      onChange={(e) => setContinuityLock({ ...continuityLock, characterPosition: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* 10. Action Momentum Switch */}
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={continuityLock.lockActionMomentum}
                      onChange={(e) => setContinuityLock({ ...continuityLock, lockActionMomentum: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700"
                    />
                    <span className="text-xs text-slate-200 font-medium">
                      10. ล็อคการเคลื่อนไหวต่อเนื่อง (Action Momentum Continuity): ให้จุดจบคลิปก่อนหน้าเป็นจุดเริ่มคลิปถัดไปอย่างต่อเนื่อง
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Dialogue Lock (Thai Language & Speaker Lock) */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-3xl p-5 shadow-lg">
            <button
              onClick={() => setShowDialoguePanel(!showDialoguePanel)}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>Dialogue Lock</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      ล็อคตัวละครต่อบทพูด
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    ระบุตัวละครต่อบทพูดภาษาไทย ห้ามสลับตัวละคร และห้ามแต่งเพิ่มเอง
                  </p>
                </div>
              </div>
              {showDialoguePanel ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>

            {showDialoguePanel && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
                {/* List of locked dialogues */}
                {dialogues.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {dialogues.map((d, idx) => (
                      <div
                        key={d.id}
                        className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 flex items-start justify-between gap-2 text-xs"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                              [{d.speaker}]
                            </span>
                            <span className="text-[10px] text-emerald-400 font-mono">
                              คลิปที่ {d.clipNumber || (idx + 1)}
                            </span>
                            {d.emotionTone && (
                              <span className="text-[10px] text-slate-400">
                                (อารมณ์: {d.emotionTone})
                              </span>
                            )}
                          </div>
                          <p className="text-slate-200 pl-1 italic">
                            "{d.line}"
                          </p>

                          <DialogueCameraControl
                            dialogue={d}
                            dialogueIndex={idx}
                            speakerName={d.speaker}
                            allSceneCharacters={continuityLock.characterNames || []}
                            locationName={continuityLock.location}
                            compact={true}
                            onChange={(updatedDialogue) => {
                              setDialogues(prev => prev.map(item => item.id === d.id ? updatedDialogue : item));
                            }}
                          />
                        </div>
                        <button
                          onClick={() => handleRemoveDialogue(d.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                          title="ลบบทพูด"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-3 text-xs text-slate-500 bg-slate-950/40 rounded-xl">
                    ยังไม่มีการเพิ่มบทพูดเจาะจง (ระบบจะใช้การดำเนินเรื่องทางภาพ)
                  </div>
                )}

                {/* Add new dialogue input */}
                <div className="pt-2 border-t border-slate-800/60 grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      placeholder="ชื่อผู้พูด เช่น วีระ"
                      value={newSpeaker}
                      onChange={(e) => setNewSpeaker(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      placeholder="บทพูดภาษาไทยตรงตัว"
                      value={newLine}
                      onChange={(e) => setNewLine(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-3 flex items-center gap-1.5">
                    <select
                      value={newClipNum}
                      onChange={(e) => setNewClipNum(Number(e.target.value))}
                      className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-slate-200"
                    >
                      {Array.from({ length: clipCount }).map((_, i) => (
                        <option key={i + 1} value={i + 1}>คลิป {i + 1}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAddDialogue}
                      disabled={!newSpeaker.trim() || !newLine.trim()}
                      className="w-1/2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-2 flex items-center justify-center transition-all text-xs font-semibold active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Audio Directives (Voice, Music, SFX Controls) */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-3xl p-5 shadow-lg">
            <button
              onClick={() => setShowAudioPanel(!showAudioPanel)}
              className="w-full flex items-center justify-between text-left group"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <span>Audio Directives Control</span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">
                      Voice • Music • SFX
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    เปิด/ปิด และแนบคำสั่งเสียงพากย์, เพลงประกอบ, และ Foley ใน Prompt อัตโนมัติ
                  </p>
                </div>
              </div>
              {showAudioPanel ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>

            {showAudioPanel && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-4 text-xs">
                {/* Voice Control */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-200 flex items-center gap-2">
                      <Mic className="w-4 h-4 text-purple-400" />
                      Voice Control (เสียงพากย์)
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={audioDirectives.voice.enabled}
                        onChange={(e) => setAudioDirectives({
                          ...audioDirectives,
                          voice: { ...audioDirectives.voice, enabled: e.target.checked }
                        })}
                        className="rounded text-purple-600 bg-slate-900 border-slate-700"
                      />
                      <span className="text-[11px] text-slate-300">เปิดใช้งาน</span>
                    </label>
                  </div>
                  {audioDirectives.voice.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="ประเภทเสียง เช่น เสียงทุ้มนุ่มน่าฟัง"
                        value={audioDirectives.voice.voiceType}
                        onChange={(e) => setAudioDirectives({
                          ...audioDirectives,
                          voice: { ...audioDirectives.voice, voiceType: e.target.value }
                        })}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                      />
                      <input
                        type="text"
                        placeholder="สำเนียงและอารมณ์ เช่น ไทยกลาง ชัดถ้อยชัดคำ"
                        value={audioDirectives.voice.accent}
                        onChange={(e) => setAudioDirectives({
                          ...audioDirectives,
                          voice: { ...audioDirectives.voice, accent: e.target.value }
                        })}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                      />
                    </div>
                  )}
                </div>

                {/* Music Control */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-200 flex items-center gap-2">
                      <Music className="w-4 h-4 text-indigo-400" />
                      Music Control (ดนตรีประกอบ)
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={audioDirectives.music.enabled}
                        onChange={(e) => setAudioDirectives({
                          ...audioDirectives,
                          music: { ...audioDirectives.music, enabled: e.target.checked }
                        })}
                        className="rounded text-indigo-600 bg-slate-900 border-slate-700"
                      />
                      <span className="text-[11px] text-slate-300">เปิดใช้งาน</span>
                    </label>
                  </div>
                  {audioDirectives.music.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="แนวเพลง เช่น Thai Traditional Orchestral"
                        value={audioDirectives.music.genre}
                        onChange={(e) => setAudioDirectives({
                          ...audioDirectives,
                          music: { ...audioDirectives.music, genre: e.target.value }
                        })}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                      />
                      <input
                        type="text"
                        placeholder="จังหวะและอารมณ์ เช่น ปานกลาง ลึกลับตื่นเต้น"
                        value={audioDirectives.music.tempo}
                        onChange={(e) => setAudioDirectives({
                          ...audioDirectives,
                          music: { ...audioDirectives.music, tempo: e.target.value }
                        })}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                      />
                    </div>
                  )}
                </div>

                {/* SFX Control */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-200 flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      Sound Effects & Foley (เสียงแวดล้อมและเอฟเฟกต์)
                    </span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={audioDirectives.sfx.enabled}
                        onChange={(e) => setAudioDirectives({
                          ...audioDirectives,
                          sfx: { ...audioDirectives.sfx, enabled: e.target.checked }
                        })}
                        className="rounded text-emerald-600 bg-slate-900 border-slate-700"
                      />
                      <span className="text-[11px] text-slate-300">เปิดใช้งาน</span>
                    </label>
                  </div>
                  {audioDirectives.sfx.enabled && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="เสียงแวดล้อม เช่น ลมพัด, เสียงเมือง, เสียงเครื่องยนต์"
                        value={audioDirectives.sfx.ambientSounds}
                        onChange={(e) => setAudioDirectives({
                          ...audioDirectives,
                          sfx: { ...audioDirectives.sfx, ambientSounds: e.target.value }
                        })}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                      />
                      <input
                        type="text"
                        placeholder="เสียง Foley เช่น ฝีเท้าก้าวเดิน, เสียงประตูกดเปิด"
                        value={audioDirectives.sfx.foleyActions}
                        onChange={(e) => setAudioDirectives({
                          ...audioDirectives,
                          sfx: { ...audioDirectives.sfx, foleyActions: e.target.value }
                        })}
                        className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-slate-100"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Video Quality Control Bar (Resolution, Codec, FPS, Quality Slider & Compute Monitor) */}
          <VideoQualityControlBar
            settings={videoQuality}
            onChange={setVideoQuality}
            isRendering={isGeneratingPrompts}
          />

          {/* MAIN GENERATE PROMPT BUTTON (Gradient ฟ้าอมม่วง ตามคำขอผู้ใช้) */}
          {(effectiveAuthUser || useOfflineMode) ? (
            <button
              onClick={() => handleGenerateAllPrompts()}
              disabled={isGeneratingPrompts || !scriptText.trim()}
              id="btn-generate-prompts"
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-400 via-indigo-500 to-fuchsia-500 hover:from-cyan-300 hover:via-indigo-400 hover:to-fuchsia-400 text-white font-bold text-base shadow-[0_0_30px_rgba(99,102,241,0.5)] flex items-center justify-center gap-2.5 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {isGeneratingPrompts ? (
                <>
                  <RotateCw className="w-5 h-5 animate-spin" />
                  <span>กำลังวิเคราะห์และสร้าง Prompt ต่อเนื่อง {clipCount} คลิป...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-cyan-200" />
                  <span>สร้าง Prompt ทุกคลิปพร้อมกัน ({clipCount} คลิป)</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onLogin}
              disabled={isLoggingIn}
              id="btn-login-to-director"
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:via-indigo-500 hover:to-purple-500 text-white font-bold text-base shadow-[0_0_30px_rgba(99,102,241,0.5)] flex items-center justify-center gap-3 transition-all active:scale-98 cursor-pointer disabled:opacity-60"
            >
              {isLoggingIn ? (
                <>
                  <RotateCw className="w-5 h-5 animate-spin" />
                  <span>กำลังเข้าสู่ระบบ Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>เข้าสู่ระบบด้วย Google เพื่อสร้าง Prompt ทุกคลิป</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Right Column: Output Cards for Clip 1, Clip 2, Clip 3... */}
        <div className="lg:col-span-7 space-y-5">
          {/* Output Action Bar */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>ผลลัพธ์ชุด Prompt ต่อเนื่อง ({clips.length} คลิป)</span>
                {generationSource && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700">
                    {generationSource === 'gemini-ai' ? 'Gemini AI' : 'ออฟไลน์ (ไม่ใช้ AI) / Offline Engine'}
                  </span>
                )}
              </h2>
              {promptGenerationError && (
                <div role="alert" className="mt-2 p-2.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 whitespace-pre-line">
                  <strong className="text-rose-100">สร้าง Prompt ไม่สำเร็จ / Generation failed:</strong> {promptGenerationError}
                </div>
              )}
              {promptValidation && (!promptValidation.isValid || promptValidation.warnings.length > 0) && (
                <div
                  role="status"
                  className={`mt-2 p-2.5 rounded-xl text-xs border ${promptValidation.isValid ? 'bg-amber-950/40 border-amber-500/40 text-amber-200' : 'bg-rose-950/50 border-rose-500/50 text-rose-200'}`}
                >
                  <p className="font-semibold mb-1">
                    {promptValidation.isValid
                      ? `ตรวจ Prompt ผ่าน แต่มีคำเตือน ${promptValidation.warnings.length} รายการ`
                      : `ตรวจ Prompt ไม่ผ่าน ${promptValidation.errors.length} รายการ — แก้ไขก่อนส่งสร้างวิดีโอ`}
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 max-h-28 overflow-y-auto">
                    {[...promptValidation.errors, ...promptValidation.warnings].slice(0, 12).map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-xs text-slate-400">
                {directorMode === 'prompt_only'
                  ? 'โหมดสร้าง Prompt ฟรี: พร้อมคัดลอกไปใช้ใน Runway, Sora, Kling, Luma'
                  : `โหมด Auto Generate: พร้อมส่งสร้างอัตโนมัติกับ ${activeProvider.name}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {clips.length > 0 && (
                <button
                  onClick={handleCopyAllClips}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                >
                  {allCopied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>คัดลอกทุกคลิปแล้ว!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>คัดลอกทุกคลิปรวดเดียว</span>
                    </>
                  )}
                </button>
              )}

              {directorMode === 'auto_generate' && clips.length > 0 && (
                <div className="flex items-center gap-2">
                  {effectiveAuthUser ? (
                    <button
                      onClick={handleOpenAutoConfirmModal}
                      disabled={isSubmittingBatch || !isRealProvider}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:via-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white shadow-md shadow-cyan-500/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <Play className="w-4 h-4" />
                      <span>{isEstimatingCost ? 'กำลังคำนวณราคา...' : 'ส่งสร้างอัตโนมัติทั้งหมด'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={onLogin}
                      disabled={isLoggingIn}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-sm flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                      <span>เข้าสู่ระบบด้วย Google เพื่อเริ่ม Auto Generate</span>
                    </button>
                  )}

                  {(isSubmittingBatch || clips.some(c => c.status === 'processing' || c.status === 'queued')) && (
                    <button
                      onClick={handleEmergencyStop}
                      disabled={isEmergencyStopping}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/20 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                      title="หยุดการทำงานและคืนเครดิตส่วนที่ยังไม่ได้สร้าง"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>{isEmergencyStopping ? 'กำลังสั่งหยุด...' : 'หยุดฉุกเฉิน (Emergency Stop)'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Batch Generation Progress Indicator */}
          {isSubmittingBatch && (
            <div className="bg-indigo-950/60 border border-indigo-500/30 rounded-2xl p-4 text-xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-indigo-300 flex items-center gap-2">
                  <RotateCw className="w-4 h-4 animate-spin text-indigo-400" />
                  {batchProgress.message}
                </span>
                <span className="font-mono text-emerald-400 font-bold">
                  {batchProgress.current} / {batchProgress.total}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300 rounded-full"
                  style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Empty State */}
          {clips.length === 0 && !isGeneratingPrompts && (
            <div className="bg-[#0e1424] border border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-lg">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
                <Clapperboard className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">
                พร้อมสร้างชุด Prompt สำหรับวิดีโอหลายคลิป
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed mb-6">
                กรอกบทละครหรือเลือกตัวอย่างทางด้านซ้าย แล้วกด <strong>"สร้าง Prompt ทุกคลิปพร้อมกัน"</strong> เพื่อให้ระบบล็อคความต่อเนื่อง 10 มิติและจัดสร้าง Prompt พร้อมใช้งานทันที
              </p>
              <button
                onClick={() => handleLoadSample(SAMPLE_SCRIPTS[0])}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all active:scale-95"
              >
                โหลดตัวอย่างบททดสอบ 3 คลิปทันที
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {isGeneratingPrompts && (
            <div className="space-y-4">
              {Array.from({ length: clipCount }).map((_, i) => (
                <div key={i} className="bg-[#0e1424] border border-slate-800 rounded-3xl p-5 shadow-lg animate-pulse">
                  <div className="h-5 bg-slate-800 rounded-lg w-1/3 mb-3" />
                  <div className="h-16 bg-slate-900 rounded-xl mb-3" />
                  <div className="h-24 bg-slate-950 rounded-xl" />
                </div>
              ))}
            </div>
          )}

          {/* Clips List */}
          {clips.map((clip, index) => {
            const isEditing = editingClipIndex === index;
            const isCopied = copiedClipIndex === index;
            const isRegenerating = isRegeneratingClip === index;

            return (
              <div
                key={clip.clipNumber}
                className="bg-[#0e1424] border border-slate-800 hover:border-slate-700/90 rounded-3xl p-5 shadow-lg transition-all relative overflow-hidden"
              >
                {/* Header: Clip Number & Title */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-mono font-bold flex items-center justify-center text-sm shadow-sm">
                      {clip.clipNumber}
                    </span>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                        <span>{clip.title}</span>
                        <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">
                          {clip.durationSeconds} วินาที
                        </span>
                      </h2>
                      <span className="text-[11px] text-slate-400 line-clamp-1">
                        {clip.sceneSummary}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Copy, Edit, Regenerate */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopySingleClip(clip.generatedPrompt, index)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 active:scale-95"
                      title="คัดลอกเฉพาะคลิปนี้"
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>คัดลอก</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        if (isEditing) {
                          setEditingClipIndex(null);
                        } else {
                          setEditingClipIndex(index);
                          setEditPromptValue(clip.generatedPrompt);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center gap-1.5 active:scale-95"
                      title="แก้ไขข้อความ Prompt"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{isEditing ? 'ยกเลิก' : 'แก้ไข'}</span>
                    </button>

                    <button
                      onClick={() => handleRegenerateSingleClip(clip, index)}
                      disabled={isRegenerating}
                      className="p-1.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-95 disabled:opacity-50"
                      title="สร้างใหม่เฉพาะคลิปนี้ โดยคงความต่อเนื่องเดิม"
                    >
                      <RotateCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin text-indigo-400' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Continuity Momentum Bridge */}
                <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 mb-3 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="border-b sm:border-b-0 sm:border-r border-slate-800/80 pb-1.5 sm:pb-0 sm:pr-2">
                    <span className="text-[10px] font-semibold text-indigo-400 block mb-0.5">
                      จุดเริ่มการเคลื่อนไหว (Start Action):
                    </span>
                    <p className="text-slate-300 text-[11px] line-clamp-2">
                      {clip.startAction}
                    </p>
                  </div>
                  <div className="sm:pl-1">
                    <span className="text-[10px] font-semibold text-emerald-400 block mb-0.5">
                      จุดจบส่งต่อคลิปถัดไป (End Action Momentum):
                    </span>
                    <p className="text-slate-300 text-[11px] line-clamp-2">
                      {clip.endAction}
                    </p>
                  </div>
                </div>

                {/* Master Continuity, Spatial Position & Audio Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3 text-[10px]">
                  <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Character Lock: {clip.continuityLockSummary}</span>
                  </span>
                  <span className="bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-md flex items-center gap-1 font-medium">
                    <Compass className="w-3 h-3 text-blue-400" />
                    <span>ตำแหน่งตัวละคร: {clip.characterPositions || 'ล็อคตำแหน่งสอดคล้องต่อเนื่อง'}</span>
                  </span>
                  <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-purple-400" />
                    {clip.audioDirectiveSummary}
                  </span>
                  {clip.dialogues && clip.dialogues.length > 0 && (
                    <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-emerald-400" />
                      บทพูดล็อค ({clip.dialogues.length} ประโยค)
                    </span>
                  )}
                  {/* ACTION & NARRATION LOCK TAG */}
                  <span className={`border px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold ${
                    clip.dialogues && clip.dialogues.length > 0
                      ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  }`}>
                    <ShieldCheck className="w-3 h-3 text-teal-400" />
                    <span>[ACT_TRIGGER] Action & Narration Lock:</span>
                    {clip.dialogues && clip.dialogues.length > 0 ? (
                      <span className="text-slate-300 font-normal">ตามลำดับบทพูด</span>
                    ) : (
                      <span className="text-amber-300 font-bold">เงียบ 100% (Ambient Only)</span>
                    )}
                  </span>
                  {/* DIALOGUE 20-WORD SPLIT TAG */}
                  {clip.splitPart && (
                    <span className="bg-purple-500/15 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                      <Scissors className="w-3 h-3 text-purple-400" />
                      <span>20-WORD SPLIT: ตอนที่ {clip.splitPart.part}/{clip.splitPart.total}</span>
                    </span>
                  )}
                  {(!clip.dialogues || clip.dialogues.length === 0) && (
                    <span className="bg-amber-500/15 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                      <span>STRICT SILENCE PROTOCOL (100% Silent)</span>
                    </span>
                  )}
                </div>

                {/* Dialogue Segments with Camera Control & Background Control Directly Underneath */}
                {clip.dialogues && clip.dialogues.length > 0 && (
                  <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-3 mb-3 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 border-b border-slate-800/80 pb-2">
                      <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>บทพูดในคลิปนี้ ({clip.dialogues.length} ช่วงบทพูด) — Camera & Background Control:</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">Original Dialogue Only</span>
                    </div>

                    <div className="space-y-2.5">
                      {clip.dialogues.map((d, dIdx) => (
                        <div
                          key={d.id || `clip_${clip.clipNumber}_dlg_${dIdx}`}
                          className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-1.5 shadow-sm"
                        >
                          {/* Dialogue Spoken Line */}
                          <div className="flex items-baseline gap-2">
                            <span className="font-bold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md text-xs">
                              {d.speaker}
                            </span>
                            {d.emotionTone && (
                              <span className="text-[10px] text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded font-medium">
                                ({d.emotionTone})
                              </span>
                            )}
                            <p className="text-slate-100 font-medium text-xs flex-1">
                              “{d.line}”
                            </p>
                          </div>

                          {/* Camera Control directly under dialogue */}
                          <DialogueCameraControl
                            dialogue={d}
                            dialogueIndex={dIdx}
                            speakerName={d.speaker}
                            allSceneCharacters={clip.charactersPresent || continuityLock.characterNames || []}
                            locationName={clip.locationName || continuityLock.location}
                            onChange={(updatedDialogue) => {
                              handleUpdateClipDialogue(index, dIdx, updatedDialogue);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Continuity Prompt & Visual Prompt Header */}
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                  <span className="flex items-center gap-1.5 text-indigo-300 font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Continuity Prompt & Visual Prompt (10 วินาที):</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">1 Clip = 1 Prompt</span>
                </div>

                {/* Prompt Box or Inline Editor */}
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editPromptValue}
                      onChange={(e) => setEditPromptValue(e.target.value)}
                      rows={5}
                      className="w-full bg-slate-950 border border-indigo-500/60 rounded-2xl p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-400 font-mono leading-relaxed"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingClipIndex(null)}
                        className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                      >
                        ยกเลิก
                      </button>
                      <button
                        onClick={() => handleSaveClipEdit(index)}
                        className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm"
                      >
                        บันทึกการแก้ไข
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 border border-slate-800/80 rounded-2xl p-3 text-xs text-slate-200 font-mono leading-relaxed break-words select-all">
                    {clip.generatedPrompt}
                  </div>
                )}

                {/* Job Generation Status in Auto Generate Mode */}
                {clip.status && clip.status !== 'idle' && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {clip.status === 'processing' && <RotateCw className="w-4 h-4 text-indigo-400 animate-spin" />}
                      {clip.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      {clip.status === 'failed' && <AlertTriangle className="w-4 h-4 text-rose-400" />}
                      <span className="text-slate-300">
                        สถานะ: {clip.status === 'queued' ? 'อยู่ในคิว' : clip.status === 'processing' ? 'กำลังประมวลผล' : clip.status === 'completed' ? 'สร้างเสร็จสมบูรณ์' : 'ล้มเหลว'}
                        {clip.status === 'failed' && clip.error && (
                          <span className="block text-[11px] text-rose-300 break-words">{clip.error}</span>
                        )}
                      </span>
                    </div>

                    {clip.outputUrl && (
                      <button
                        onClick={() => onViewJobOutput(clip.outputUrl!, 'video')}
                        className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>เปิดดูวิดีโอ</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation Modal for Auto Generate Mode */}
      {showAutoConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1424] border border-slate-700 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">ยืนยันการส่งสร้าง Auto Generate</h3>
                <p className="text-xs text-slate-400">ตรวจสอบรายละเอียดค่าใช้จ่ายและเครดิตก่อนดำเนินการ</p>
              </div>
            </div>

            {/* Cost Breakdown Table */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>ผู้ให้บริการ (Provider):</span>
                <span className="font-semibold text-white">{activeProvider.name}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>จำนวนคลิปทั้งหมด:</span>
                <span className="font-semibold text-white">{clips.length} คลิป</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>ความยาวรวม:</span>
                <span className="font-semibold text-white">{clips.length * clipDurationSeconds} วินาที</span>
              </div>
              
              {costEstimate ? (
                <>
                  <div className="flex justify-between text-slate-300">
                    <span>ค่าประมวลผล API ของโมเดล:</span>
                    <span className="font-mono text-slate-200">{costEstimate.estimatedApiCredits} เครดิต</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>ค่าบริการระบบแพลตฟอร์ม (Platform Service Fee):</span>
                    <span className="font-mono text-indigo-300">{costEstimate.serviceFeeCredits} เครดิต</span>
                  </div>
                  {costEstimate.breakdown && (
                    <div className="p-2 bg-slate-900/90 rounded-xl text-[11px] text-slate-400 font-mono">
                      {costEstimate.breakdown}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex justify-between text-slate-300">
                  <span>ค่าใช้จ่ายต่อคลิป ({clipDurationSeconds} วิ):</span>
                  <span className="font-mono font-semibold text-amber-300">{costPerClip} เครดิต</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 flex justify-between text-sm font-bold">
                <span className="text-white">รวมเครดิตที่ต้องใช้:</span>
                <div className="text-right">
                  <span className="font-mono text-emerald-400 block">{totalCost} เครดิต</span>
                  {costEstimate?.approximateThb ? (
                    <span className="text-[11px] text-slate-400 font-normal">
                      (~{costEstimate.approximateThb} บาท)
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>เครดิตคงเหลือของคุณ:</span>
                <span className={`font-mono font-bold ${canAfford ? 'text-slate-200' : 'text-rose-400'}`}>
                  {credits?.remainingCredits || 0} เครดิต
                </span>
              </div>
            </div>

            {!canAfford && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>เครดิตคงเหลือไม่เพียงพอ กรุณาเติมเครดิตหรือเปลี่ยนไปใช้ Prompt Mode ฟรี</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowAutoConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                ยกเลิก
              </button>
              {canAfford ? (
                <button
                  onClick={handleExecuteBatchAutoGenerate}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 active:scale-95"
                >
                  ยืนยันและเริ่มสร้าง ({totalCost} เครดิต)
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowAutoConfirmModal(false);
                    onOpenCredits();
                  }}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-lg active:scale-95"
                >
                  เติมเครดิตทันที
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video To Script Modal */}
      <VideoToScriptModal
        isOpen={showVideoToScriptModal}
        onClose={() => setShowVideoToScriptModal(false)}
        onApplyToDirector={(script, charName, newDialogues) => {
          setScriptText(script);
          setContinuityLock(prev => ({ ...prev, characterName: charName }));
          setDialogues(newDialogues);
          setClipCount(newDialogues.length || 3);
        }}
      />

      {/* Script Editor / Character Replace Modal */}
      <ScriptEditorModal
        isOpen={showScriptEditorModal}
        onClose={() => setShowScriptEditorModal(false)}
        scriptText={scriptText}
        dialogues={dialogues}
        characters={characters}
        onApplyReplacement={(updatedScript, updatedDialogues, newChar) => {
          setScriptText(updatedScript);
          setDialogues(updatedDialogues);
          setContinuityLock(prev => ({
            ...prev,
            characterId: newChar.id,
            characterName: newChar.name,
            characterAppearance: `${newChar.triggerTag}, ${newChar.description}, สวมใส่: ${newChar.outfitDescription || 'ชุดตามลักษณะตัวละคร'}`
          }));
        }}
      />

      {/* Continuity Checker Modal */}
      <ContinuityCheckerModal
        isOpen={showContinuityCheckerModal}
        onClose={() => setShowContinuityCheckerModal(false)}
        scriptText={scriptText}
        clips={clips}
        continuityLock={continuityLock}
        dialogues={dialogues}
      />

      {/* Social Post Assistant Modal */}
      <SocialPostAssistantModal
        isOpen={showSocialPostModal}
        onClose={() => setShowSocialPostModal(false)}
        scriptText={scriptText}
        characterName={continuityLock.characterName}
      />
    </div>
  );
};
