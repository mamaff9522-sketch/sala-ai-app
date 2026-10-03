export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5' | '4:3';
export type VideoResolution = '480p' | '720p' | '1080p' | '2K' | '4K';
export type MediaType = 'image' | 'video';
export type ProviderId = 'gemini' | 'meta' | 'xai' | 'mock';

export type VisualStylePreset =
  | 'Photorealistic'
  | 'Cinematic'
  | '3D Animation'
  | 'Cartoon'
  | 'Anime'
  | 'Historical/Ancient'
  | 'Fantasy'
  | 'Horror'
  | 'Drama'
  | 'Custom';

export type CameraShotType =
  | 'Close-up'
  | 'Medium Shot'
  | 'Wide Shot'
  | 'POV'
  | 'Tracking'
  | 'Dolly In'
  | 'Dolly Out'
  | 'Pan'
  | 'Tilt'
  | 'Orbit'
  | 'Handheld'
  | 'Static';

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  badge: string;
  description: string;
  isMock: boolean;
  isAvailable: boolean;
  requiresKeyEnv: string;
  hasServerKey: boolean;
  supportedMedia: MediaType[];
  supportedRatios: AspectRatio[];
  supportedResolutions: VideoResolution[];
  supportsLipSync: boolean;
  models: {
    id: string;
    name: string;
    description: string;
    costPerImage: number;
    costPerVideoSec: number;
  }[];
}

// ==========================================
// USER AUTHENTICATION & MEMBERSHIP
// ==========================================
export interface UserAccount {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'suspended';
  isVerified: boolean;
  verificationCode?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface RedeemCode {
  id: string;
  code: string;
  creditAmount: number;
  maxUses: number;
  usedCount: number;
  isExpired: boolean;
  expiresAt?: string;
  createdAt: string;
  createdBy: string;
}

// ==========================================
// CHARACTER LIBRARY & CHARACTER SHEET
// ==========================================
export interface CharacterStructuredFeatures {
  creatureType?: string;
  species?: string;
  name?: string;
  gender?: string;
  ageRange?: string;
  skinTone?: string;
  faceShape?: string;
  hairStyle?: string;
  hairColor?: string;
  eyeDescription?: string;
  bodyType?: string;
  topClothing?: string;
  bottomClothing?: string;
  footwear?: string;
  accessories?: string;
  distinctFeatures?: string;
  confidence?: number;
}

// ==========================================
// 4-LAYER CHARACTER ARCHITECTURE & FIELD TRACKING
// Layer 1: CHARACTER_IDENTITY
// Layer 2: REFERENCE_METADATA
// Layer 3: VISUAL_PROFILE
// Layer 4: STORY_PROFILE
// ==========================================

export type FieldSource = 'USER_CONFIRMED' | 'REFERENCE_TEXT' | 'VISUAL_OBSERVATION' | 'UNKNOWN';

export interface TrackedField<T = string> {
  value: T;
  source: FieldSource;
}

export type CharacterAnalysisStatus =
  | 'NOT_ANALYZED'
  | 'ANALYZING'
  | 'AI_DRAFT'
  | 'USER_CONFIRMED'
  | 'LOCKED'
  | 'FAILED'
  | 'idle'
  | 'analyzed'
  | 'error';

export type CharacterLockStatus = 'UNLOCKED' | 'LOCKED';

export interface CharacterIdentity {
  id: string;
  name: string;
}

export interface CharacterReferenceMetadata {
  referenceImageId: string;
  referenceImageUrl?: string;
  imageHash: string;
  detectedName?: string;
  detectedAge?: string;
  detectedHeight?: string;
  availableViews: string[]; // e.g. FRONT, FACE_CLOSEUP, THREE_QUARTER, SIDE, BACK, FULL_BODY, OUTFIT_DETAIL, ACCESSORY_DETAIL, SHOE_DETAIL
}

export interface CharacterVisualProfile {
  imageHash?: string;
  referenceImageId?: string;
  referenceImageUrl?: string;
  hairStyle: string;
  hairColor: string;
  top: string;
  bottom: string;
  shoes: string;
  accessories: string;
  visibleDistinctiveDetails: string;
  // Backward compatibility and display properties
  referenceImage: string;
  referenceImages: string[];
  imageAnalysisStatus: CharacterAnalysisStatus;
  imageAnalysisError?: string;
  hair?: string;
  visibleOutfit?: string;
  visibleAccessories?: string;
  visiblePhysicalAppearance?: string;
  visibleDistinguishingDetails?: string;
  detectedViews?: string[];
  isMultiViewSheet?: boolean;
  confidence: number;
  generatedVisualPrompt?: string;
}

export interface CharacterStoryProfile {
  age?: string;
  personality?: string;
  occupation?: string;
  role?: string;
  background?: string;
  storyInfo?: string;
}

export interface Character {
  id: string;
  name: string;
  gender: string;
  age: string;
  build?: string;
  hairStyle?: string;
  costume?: string;
  jewelry?: string;
  accessories?: string;
  description: string;
  triggerTag: string;
  referenceImages: string[];
  referenceImageId?: string;
  referenceImageUrl?: string;
  imageHash?: string;
  characterSheetUrl?: string;
  /** Durable copy of the reference image: compressed JPEG data URL (<= ~350 KB) stored in the
   *  Firestore doc, used when the server /uploads file is gone (ephemeral disk) */
  referenceImageBackup?: string;
  /** Edit counter, bumped by the owner's "แก้ไข (Edit)" action */
  version?: number;
  outfitDescription?: string;
  /** Face description for the Character Lock (optional; falls back to structuredFeatures faceShape / eyes / skin) */
  face?: string;
  /** General visual appearance (build, distinctive features) for the Character Lock (optional) */
  appearance?: string;
  consistencyStrength: number; // 0.1 to 1.0
  avatarUrl: string;
  userId?: string;
  isDefaultProject?: boolean;
  structuredFeatures?: CharacterStructuredFeatures;
  analysisConfidence?: number;
  isVerifiedByUser?: boolean;
  // 4-Layer Character Architecture
  identity?: CharacterIdentity;
  characterIdentity?: CharacterIdentity;
  referenceMetadata?: CharacterReferenceMetadata;
  visualProfile?: CharacterVisualProfile;
  storyProfile?: CharacterStoryProfile;
  // Source tracking and lock management
  fieldSources?: Record<string, FieldSource>;
  imageAnalysisStatus?: CharacterAnalysisStatus;
  lockStatus?: CharacterLockStatus;
  currentReferenceImageHash?: string;
  visualProfileImageHash?: string;
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// LOCATION LOCK & LOCATION DATA MODEL
// Reference Type: LOCATION
// 4-Layer Location Architecture:
// Layer 1: LocationIdentity
// Layer 2: LocationReferenceMetadata
// Layer 3: LocationVisualProfile
// Layer 4: LocationStoryProfile
// ==========================================

export type LocationAnalysisStatus =
  | 'NOT_ANALYZED'
  | 'ANALYZING'
  | 'AI_DRAFT'
  | 'USER_CONFIRMED'
  | 'LOCKED'
  | 'ANALYSIS_FAILED'
  | 'idle'
  | 'analyzed'
  | 'error';

export type LocationLockStatus = 'UNLOCKED' | 'LOCKED';

export interface LocationIdentity {
  id: string;
  name: string;
}

export interface LocationReferenceMetadata {
  referenceImageId: string;
  referenceImageUrl?: string;
  imageHash: string;
  combinedFingerprint?: string;
  availableViews: string[]; // e.g. ['WIDE_SHOT', 'CORNER_PERSPECTIVE', 'ARCHITECTURAL_DETAIL', 'FURNITURE_LAYOUT']
  imageAnalysisStatus: LocationAnalysisStatus;
}

export interface LocationVisualProfile {
  environmentType: string; // Indoor | Outdoor | Semi-outdoor
  architecturalStyle: string; // Modern Minimalist, Industrial, Traditional Thai, Sci-Fi etc.
  wallColor: string; // Wall color & texture
  floor: string; // Flooring material
  ceiling: string; // Ceiling design & fixtures
  doors: string; // Door placement & design
  windows: string; // Windows design & natural light
  majorFurniture: string; // Main furniture pieces
  fixedObjects: string; // Built-in or immovable structures
  spatialLayout: string; // Layout of room/space
  permanentDecor: string; // Permanent wall art, fixtures, decor
  distinctiveFeatures: string; // Signature visual anchors
  // Reference and analysis fields
  referenceImage?: string;
  referenceImages?: string[];
  referenceImageId?: string;
  referenceImageUrl?: string;
  imageHash?: string;
  confidence?: number;
  generatedVisualPrompt?: string;
}

export interface LocationStoryProfile {
  storyLocationName?: string;
  description?: string;
  notes?: string;
}

export interface LocationItem {
  id: string;
  name: string;
  type: 'LOCATION';
  userId?: string;
  // 4-Layer Location Architecture
  identity: LocationIdentity;
  referenceMetadata: LocationReferenceMetadata;
  visualProfile: LocationVisualProfile;
  storyProfile: LocationStoryProfile;
  // Lock and status management
  lockStatus: LocationLockStatus;
  imageAnalysisStatus: LocationAnalysisStatus;
  // Backward compatibility and quick access helpers
  referenceImages: string[];
  referenceImageId?: string;
  referenceImageUrl?: string;
  imageHash?: string;
  thumbnailUrl?: string;
  triggerTag?: string;
  /** Factual set description used VERBATIM as the Location Lock (materials, colours, counts, furniture with positions) */
  lockDescription?: string;
  /** Durable compressed JPEG data-URL copy of the reference photo (Firestore doc), used when /uploads is gone */
  referenceImageBackup?: string;
  /** Edit counter, bumped by the owner's "แก้ไข (Edit)" */
  version?: number;
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// SCENE, PROJECT, TEMPLATE & VERSIONING
// ==========================================
export interface Scene {
  id: string;
  sceneNumber: number;
  title: string;
  prompt: string;
  negativePrompt?: string;
  mediaType: MediaType;
  aspectRatio: AspectRatio;
  resolution?: VideoResolution;
  characterId?: string;
  locationId?: string;
  locationName?: string;
  cameraShot?: CameraShotType;
  usePreviousSceneAsRef: boolean;
  referenceImage?: string;
  outputJobId?: string;
  outputUrl?: string;
  status: 'draft' | 'generating' | 'completed';
}

export interface ProjectVersion {
  id: string;
  versionNumber: number;
  createdAt: string;
  note: string;
  sceneCount: number;
  snapshot: any;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  visualStyle: VisualStylePreset;
  defaultCharacterId?: string;
  continuityLock?: Partial<MasterContinuityLock>;
  audioDirectives?: Partial<AudioDirectives>;
  createdAt: string;
}

export interface Project {
  id: string;
  userId?: string;
  title: string;
  description: string;
  aspectRatio: AspectRatio;
  visualStyle?: VisualStylePreset;
  defaultCharacterId?: string;
  scenes: Scene[];
  versions?: ProjectVersion[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// GENERATION JOBS
// ==========================================
export interface GenerationJob {
  id: string;
  userId?: string;
  type: MediaType;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0 - 100
  stage: string;
  provider: ProviderId;
  providerName: string;
  isMock: boolean;
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatio;
  resolution?: VideoResolution;
  outputUrl?: string;
  thumbnailUrl?: string;
  characterId?: string;
  characterName?: string;
  referenceImages?: string[];
  projectId?: string;
  sceneId?: string;
  sceneNumber?: number;
  costCredits: number;
  seed: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
  durationSeconds?: number;
}

// ==========================================
// CREDITS & TRANSACTIONS
// ==========================================
export interface CreditTransaction {
  id: string;
  timestamp: string;
  amount: number; // negative for usage, positive for topup/refund
  type: 'usage' | 'topup' | 'refund' | 'bonus' | 'copy_prompt' | 'auto_generate' | 'admin_adjustment' | 'redeem_code';
  description: string;
  jobId?: string;
  actor?: string;
  balanceAfter: number;
}

export interface CreditAccount {
  userId: string;
  userName: string;
  userRole: 'user' | 'admin';
  remainingCredits: number;
  totalUsedCredits: number;
  dailyUsedCredits: number;
  dailyLimit: number;
  monthlyUsedCredits: number;
  monthlyLimit: number;
  perGenerationLimit: number;
  copyPromptFee: number; // default 10 credits
  serviceFeeType: 'fixed' | 'percentage';
  serviceFeeValue: number;
  transactions: CreditTransaction[];
}

export interface CostEstimate {
  estimatedCredits?: number;
  estimatedApiCredits: number;
  serviceFeeCredits: number;
  totalCredits: number;
  approximateThb: number;
  breakdown: string;
  canAfford: boolean;
  copyPromptFee?: number;
}

export interface AdminStats {
  totalUsers: number;
  totalGenerations: number;
  totalImagesGenerated: number;
  totalVideosGenerated: number;
  activeJobsCount: number;
  creditsSpentTotal: number;
  copyPromptFee: number;
  serviceFeeType: 'fixed' | 'percentage';
  serviceFeeValue: number;
  providersStatus: {
    id: ProviderId;
    name: string;
    hasKey: boolean;
    isMock: boolean;
    statusText: string;
    activeCalls: number;
  }[];
  recentJobs: GenerationJob[];
  userAccounts: CreditAccount[];
  allUsers?: UserAccount[];
  redeemCodes?: RedeemCode[];
}

// ==========================================
// MULTI-CLIP CONTINUITY DIRECTOR
// ==========================================
export type DirectorMode = 'prompt_only' | 'auto_generate';

export interface MasterContinuityLock {
  characterId?: string;
  characterIds?: string[];
  characterNames?: string[];
  characterName: string;
  characterAppearance: string;
  characterFace?: string;
  characterAge?: string;
  characterBuild?: string;
  characterHair?: string;
  characterCostume?: string;
  characterJewelry?: string;
  characterAccessories?: string;
  locationId?: string;
  locationLocked?: boolean;
  locationVisualDetails?: string;
  locationImageHash?: string;
  locationReferenceUrl?: string;
  location: string;
  timeOfDay: string;
  lighting: string;
  colorGrade?: string;
  visualStyle: VisualStylePreset | string;
  aspectRatio: AspectRatio;
  resolution: VideoResolution;
  cameraMovement: string;
  cameraShotType: CameraShotType;
  lensType: string;
  props: string;
  characterPosition: string;
  /**
   * Per-character Position Lock: posture + place + hand props / gesture / facing.
   * Used as the locked START state of the first clip; each clip's end state is
   * carried into the next clip and only changes when the script describes movement.
   */
  characterPositionLocks?: CharacterPositionLock[];
  previousEventStatus?: string;
  lockActionMomentum: boolean;
  lockColorGrade: string;
  /** Action & Narration Lock: preserves action/narration order, extracts via [ACT_TRIGGER]...[ACTION_END], enforces 100% silence when no dialogue */
  actionNarrationLockEnabled?: boolean;
}

export type DialogueCameraAngle = 'OTS' | 'CU' | '2S' | 'MID' | 'W' | 'AUTO';
export type DialogueBackgroundControl = 'AUTO' | 'SOFT' | 'CLEAR';

export interface DialogueLockEntry {
  id: string;
  speaker: string;
  line: string;
  emotionTone?: string;
  deliverySpeed?: 'slow' | 'natural' | 'fast';
  timestamp?: string;
  clipNumber?: number;
  /** Camera angles selected for this dialogue segment (Max 2: [0] = CAM-1, [1] = CAM-2) */
  cameraAngles?: DialogueCameraAngle[];
  /** Background depth of field control while preserving Location Lock */
  backgroundControl?: DialogueBackgroundControl;
}

export interface VoiceControl {
  enabled: boolean;
  voiceType: string;
  accent: string;
  emotion: string;
  deliverySpeed: 'slow' | 'natural' | 'fast';
  lockVoiceAcrossClips?: boolean;
}

export interface MusicControl {
  enabled: boolean;
  genre: string;
  tempo: string;
  mood: string;
  instruments: string;
}

export interface SfxControl {
  enabled: boolean;
  ambientSounds: string;
  foleyActions: string;
  reverbSpace: string;
}

export interface AudioDirectives {
  voice: VoiceControl;
  music: MusicControl;
  sfx: SfxControl;
}

// Continuity (pose handoff) data carried per clip / scene
export type ClipPosture = 'standing' | 'sitting' | 'lying' | 'kneeling' | 'walking' | 'unknown';
export interface ClipCharacterPose {
  name: string;
  posture: ClipPosture;
  place: string;
  /** Hand props / what the character holds, e.g. "ถือโทรศัพท์" (only when the script says so) */
  holding?: string;
  /** Gesture / contact, e.g. "จับมือพี่ทุย" */
  gesture?: string;
  /** Facing / looking at, e.g. "มองน้องน้ำ" */
  facing?: string;
  /** true when the character walks into the frame during this clip (start pose) */
  entering?: boolean;
}
/** Per-character Position Lock (same shape as a pose; carried scene -> scene). */
export type CharacterPositionLock = ClipCharacterPose;
export interface ClipContinuityWarning {
  clipNumber: number;
  type: 'missing_character' | 'pose_jump' | 'place_jump' | 'handoff_mismatch' | 'location_mismatch' | 'story_repeat' | 'story_handoff';
  character: string;
  message: string;
}

export interface DirectedClipItem {
  clipNumber: number;
  title: string;
  durationSeconds: number;
  sceneSummary: string;
  startAction: string;
  endAction: string;
  dialogues: DialogueLockEntry[];
  dialogue?: string; // "NONE" when no dialogue in script, or verbatim "Speaker: Line"
  continuityLockSummary: string;
  audioDirectiveSummary: string;
  characterPositions?: string; // Spatial position lock e.g. "พี่ทุยอยู่ซ้ายเสา, น้องน้ำอยู่ขวาเสา"
  locationId?: string;
  locationName?: string;
  locationLocked?: boolean;
  timeOfDay?: string;
  lighting?: string;
  cameraShotType?: CameraShotType;
  generatedPrompt: string;
  negativePrompt: string;
  continuityLock?: Partial<MasterContinuityLock>; // Per-clip Character/Location lock (filled by Story Continuation)
  charactersPresent?: string[]; // Characters on screen in this clip
  startPoses?: ClipCharacterPose[]; // Must equal the previous clip's endPoses unless the script moves them
  endPoses?: ClipCharacterPose[]; // Handed off to the next clip
  continuityWarnings?: ClipContinuityWarning[];
  /** Character Lock warnings, e.g. "ยังไม่ได้ระบุรูปลักษณ์ของ X" */
  appearanceWarnings?: string[];
  /** Location Lock warnings ("ไม่พบสถานที่ X ในคลัง", lost reference photo) */
  locationWarnings?: string[];
  /** Resolved Character Lock text (name + face / hair / outfit) used in the prompt */
  characterLockText?: string;
  /** Set when a dense scene was auto-split into several clips (density rule) */
  splitPart?: { sourceSceneNumber: number; part: number; total: number; reason: string };
  /** Estimated speech seconds of this clip's dialogue (density rule) */
  estimatedSpeechSeconds?: number;
  isEditing?: boolean;
  isLocked?: boolean; // User approved/locked clip
  /** Action & Narration Lock: extracts Action, Movement, Emotion/Expression, Narration; 100% silent when no dialogue */
  actionNarrationLock?: {
    action?: string;
    movement?: string;
    emotionExpression?: string;
    narration?: string;
    isSilent: boolean;
    hasActTrigger?: boolean;
  };
  jobId?: string;
  status?: 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  outputUrl?: string;
  error?: string;
}

// ==========================================
// CONTINUITY CHECKER
// ==========================================
export interface ContinuityIssue {
  id: string;
  clipNumber: number;
  type: 'character' | 'costume' | 'location' | 'time' | 'props' | 'dialogue' | 'event_order' | 'camera';
  severity: 'warning' | 'error' | 'info';
  title: string;
  description: string;
  suggestion: string;
}

export interface ContinuityCheckReport {
  hasConflicts: boolean;
  totalIssues: number;
  issues: ContinuityIssue[];
  passedChecks: string[];
}

// ==========================================
// AI SOCIAL POST ASSISTANT
// ==========================================
export type SocialPlatform = 'tiktok' | 'reels' | 'youtube' | 'facebook';
export type SocialTone = 'engaging' | 'dramatic' | 'funny' | 'mysterious' | 'punchy' | 'hooky';

export interface SocialPostRecommendation {
  platform: SocialPlatform;
  tone: SocialTone;
  titles: string[];
  captions: string[];
  hashtags: string[];
}

// ==========================================
// LIP SYNC MODE
// ==========================================
export interface LipSyncJob {
  id: string;
  characterName: string;
  characterImageUrl: string;
  audioUrl?: string;
  audioFileName?: string;
  scriptText?: string;
  status: 'draft' | 'ready' | 'processing' | 'completed' | 'failed';
  provider: ProviderId;
  providerSupported: boolean;
  generatedWorkflowPrompt: string;
  outputVideoUrl?: string;
  createdAt: string;
}

// ==========================================
// VIDEO TO SCRIPT & CHARACTER REPLACE
// ==========================================
export interface VideoAnalyzedScene {
  sceneNumber: number;
  startTime: string;
  endTime: string;
  action: string;
  dialogue: string;
  speaker: string;
  location: string;
  emotion: string;
  camera: string;
  audio: string;
}

export interface VideoToScriptResult {
  id: string;
  originalVideoName: string;
  durationSeconds: number;
  storyOverview: string;
  scenes: VideoAnalyzedScene[];
  detectedCharacters: string[];
}

export interface CharacterReplacementRule {
  oldName: string;
  newName: string;
  characterLibraryId?: string;
}

// ==========================================
// STORY CONTINUATION / PROGRESSIVE SCENE ENGINE
// ==========================================
export interface StoryDialogueLine {
  speaker: string;
  emotionOrAction: string;
  dialogue: string;
  offScreen?: boolean; // off-screen voice (e.g. "เสียงปริศนา"), never a locked character
}

export interface StoryContinuedScene {
  sceneNumber: number;
  sceneHeading: string;
  location: string;
  timeOfDay: string;
  characters: string[];
  characterPositions?: string; // Spatial position lock e.g. "พี่ทุยอยู่ซ้ายเสา, น้องน้ำอยู่ขวาเสา"
  actionDescription: string;
  startAction?: string;
  dialogues: StoryDialogueLine[];
  endState: string;
  visualPrompt: string;
  scriptFormattedText: string;
  mainCharacter?: string; // Main on-screen character of this scene (used for Character Lock)
  sceneTitle?: string; // Title / mood part of the heading, e.g. "คืนดีกัน"
  characterLocks?: { name: string; lock: string }[]; // Full Character Lock text per on-screen character
  locationLock?: { location: string; timeOfDay: string; lighting: string }; // One lighting description per location
  startPoses?: ClipCharacterPose[];
  endPoses?: ClipCharacterPose[];
  continuityWarnings?: ClipContinuityWarning[];
}

export interface StoryContinuationResponse {
  success: boolean;
  episodeNumber?: number;
  episodeTitle?: string;
  isStoryFinished: boolean;
  finishMessage: string;
  progressPercentage: number;
  currentMilestone: string;
  summaryOfEventsSoFar: string;
  episodeScriptText?: string; // Formatted 5-6 scenes script for "วางบทหรือฉากหลายฉาก" textarea
  scenes?: StoryContinuedScene[]; // Array of 5-6 continuous scenes
  nextScene: StoryContinuedScene | null;
  message?: string;
  code?: string;
  source?: 'gemini-flash' | 'offline-narrative-engine' | string;
  offline?: boolean;
  fallbackNotice?: string;
  hasMoreScenes?: boolean; // false when the source story has no further scenes
  declaredCharacters?: string[];
  continuityWarnings?: ClipContinuityWarning[];
  /** Character Lock warnings, e.g. "ยังไม่ได้ระบุรูปลักษณ์ของ X" */
  characterWarnings?: string[];
}

export interface StoryContinuationPayload {
  originalStory: string;
  currentScriptText?: string;
  episodeNumber?: number;
  targetSceneCount?: number; // default 5 or 6 scenes
  existingScenes?: Array<{
    sceneNumber: number;
    title?: string;
    summary?: string;
    characters?: string[];
    startAction?: string;
    endAction?: string;
    characterPositions?: string;
  }>;
  lastSceneState?: {
    sceneNumber: number;
    title?: string;
    endAction?: string;
    summary?: string;
    location?: string;
    timeOfDay?: string;
    characterPositions?: string;
    dialogues?: DialogueLockEntry[];
    endPoses?: ClipCharacterPose[];
  } | null;
  characters?: Character[];
  continuityLock?: MasterContinuityLock;
  clipDurationSeconds?: number;
  apiKey?: string;
  offline?: boolean; // explicit user choice: use the offline narrative engine instead of Gemini
}
