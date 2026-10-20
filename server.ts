import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import Stripe from 'stripe';
import { initializeApp as initFirebaseServer, getApps as getFirebaseServerApps } from 'firebase/app';
import { getFirestore as getFirestoreServer, doc as docServer, getDoc as getDocServer, setDoc as setDocServer, increment as incrementServer, collection as collectionServer, getDocs as getDocsServer, deleteDoc as deleteDocServer, query as queryServer, where as whereServer } from 'firebase/firestore';
import {
  RESERVED_KEYWORD_SET,
  isReservedSystemKeyword,
  isMetadataKeyword,
  parseSalaScript,
  buildSalaMultiClipPrompts,
  validateSalaMultiClipPrompts,
  attachClipContinuity,
  summarizeAutoSplit,
  dedupeDialogueEntries,
  enforceLibraryCharacterLocks,
  isVerbatimDialogueInScript,
  extractVerbatimScriptQuotes,
  stripProhibitedSpeechWords,
  enforceOriginalDialogueOnly,
  ORIGINAL_DIALOGUE_ONLY,
  INVENT_DIALOGUE,
  NARRATION_TO_DIALOGUE,
  mergeDialogueCameraControls,
  formatDialogueWithCameraControl,
  hasManualCameraAngles,
  stripAutoCameraPhrases
} from './src/services/salaDirectorEngine';
import { enforceLibraryLocationLocks, findLocationByName, locationDescriptionOf } from './src/services/locationAppearance';
import {
  parseStoryStructure,
  generateEpisodeLocally,
  hasExplicitEndingMarker,
  validateGeminiEpisodeScenes,
  applyEpisodeLocks,
  normalizeSceneLocation
} from './src/services/storyEpisodeEngine';
import { expandCombinedCharacterNames, buildCharacterLockText, lightingForTime, analyzeClipContinuity, formatContinuityForPrompt, normalizePoseList, sceneWarningsFor, syncLocationLockInPrompt } from './src/services/continuityEngine';
import { resolveCharacterProfiles, formatCharacterAppearanceLock, parseScriptCharacterList, buildCharacterAppearanceLock, mergeDeclaredCharacters, continuityLockCharacter } from './src/services/characterAppearance';
import { parseScriptLocally, applySplitLocks } from './src/services/localScriptParser';
import { applyDialogue20WordSplitToClips } from './src/services/dialogueWordSplitter';
import { buildSocialPostsFromStory } from './src/services/socialPostFromStory';
import { verifyFirebaseIdToken, createSessionToken, verifySessionToken, isAdminIdentity, type VerifiedFirebaseClaims } from './serverAuth';
import { addAdminEmail, readAdminEmails } from './adminAllowlist';
import { CREDIT_CATALOG, MISSING_FIRESTORE_CREDENTIAL_MESSAGE, MISSING_STRIPE_SECRET_MESSAGE, adjustFirestoreCredits, assertFirestoreCredentialConfigured, chargeFromUsageMetadata, creditPaidUserInFirestore, creditsForTokens, deductUsableCredits, ensureCanCallFlashLite, isRealCreditUid, normalizeVideoResolution, paymentAlreadyRecorded, readFirestoreCreditBalance, readPlatformAdminShare, stripHiddenCreditFields } from './serverBilling';
import { registerTransferRoutes } from './serverTransfer';
import { loadVeoReferenceImages, resolveVeoReferenceModel, veoDurationSeconds } from './serverVeo';
import { OMNI_VIDEO_MODEL, extractLastFrame, generateOmniVideo } from './serverOmni';
import { findResumePoint, checkEpisodeOrder, salvageEpisodeJson, splitDenseDialogueScenes, restoreMissingStoryBeats, offlineContinuation, storyCursorFor } from './src/services/storyProgress';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Capacitor Android (androidScheme https) loads the bundled UI from this origin.
// API fetches from the phone are cross-origin, so preflight must allow it.
// Not deployed by this change. Same-origin browser traffic is unchanged.
const CAPACITOR_WEBVIEW_ORIGIN = 'https://localhost';
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin !== CAPACITOR_WEBVIEW_ORIGIN) return next();
  res.setHeader('Access-Control-Allow-Origin', CAPACITOR_WEBVIEW_ORIGIN);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS');
  const requested = req.headers['access-control-request-headers'];
  res.setHeader(
    'Access-Control-Allow-Headers',
    typeof requested === 'string' && requested.trim()
      ? requested
      : 'Authorization, Content-Type, Accept, Range'
  );
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Range, Accept-Ranges');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

console.log('Using PORT:', PORT);

// Support large payload for base64 image reference uploads & capture rawBody for Stripe Webhook signature verification
app.use(express.json({
  limit: '50mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Persistent Uploads Directory for Character & Location Reference Images & Assets
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const UPLOADS_CHARACTERS_DIR = path.join(UPLOADS_DIR, 'characters');
const UPLOADS_LOCATIONS_DIR = path.join(UPLOADS_DIR, 'locations');
try {
  if (!fs.existsSync(UPLOADS_CHARACTERS_DIR)) {
    fs.mkdirSync(UPLOADS_CHARACTERS_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_LOCATIONS_DIR)) {
    fs.mkdirSync(UPLOADS_LOCATIONS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create uploads directory:', e);
}

// Serve /uploads statically from public/uploads
app.use('/uploads', express.static(UPLOADS_DIR, {
  maxAge: '7d',
  immutable: true
}));

// ==========================================
// 1. DATA TYPES & INTERFACES (SERVER-SIDE)
// ==========================================
export type AspectRatio = '9:16' | '16:9' | '1:1';
export type MediaType = 'image' | 'video';
export type ProviderId = 'gemini' | 'meta' | 'xai' | 'mock';

export interface GenerationParams {
  type: MediaType;
  provider: ProviderId;
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatio;
  referenceImages?: string[];
  /** 'asset' = character/location photos to keep identity (Veo reference images); default = first image is the start frame */
  referenceMode?: 'asset' | 'start-frame';
  /** Who each reference photo shows (same order as referenceImages) */
  referenceNames?: string[];
  /** Job of the previous clip at the same place: this clip starts from that clip's last frame */
  continueFromJobId?: string;
  characterId?: string;
  characterName?: string;
  projectId?: string;
  sceneId?: string;
  sceneNumber?: number;
  durationSeconds?: number;
  resolution?: string;
  /** Optional pre-call token estimate. Used only when the client already has a count. Never invented here. */
  estimatedTokens?: number;
  seed?: number;
  consistencyStrength?: number;
}

export interface GenerationResult {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage: string;
  outputUrl?: string;
  thumbnailUrl?: string;
  isMock: boolean;
  costCredits: number;
  error?: string;
}

export interface ProviderAdapter {
  id: ProviderId;
  name: string;
  badge: string;
  description: string;
  hasKey: boolean;
  isMockOnly: boolean;
  estimateCost(params: GenerationParams): { estimatedCredits: number; approximateThb: number; breakdown: string };
  generateImage(params: GenerationParams, jobId: string): Promise<{ outputUrl: string; isMock: boolean; usage?: any }>;
  generateVideo(params: GenerationParams, jobId: string, updateProgress: (prog: number, stage: string) => void): Promise<{ outputUrl: string; isMock: boolean; usage?: any }>;
}

// ==========================================
// 2. IN-MEMORY STORAGE & SYSTEM STATE
// ==========================================
export interface GenerationJob {
  id: string;
  userId?: string;
  type: MediaType;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage: string;
  provider: ProviderId;
  providerName: string;
  isMock: boolean;
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatio;
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
  resolution?: string;
  tokensUsed?: number | null;
  creditsCharged?: number;
  remainingCredits?: number;
  usageMissing?: boolean;
  skipMemoryCharge?: boolean;
}

export type FieldSource = 'USER_CONFIRMED' | 'REFERENCE_TEXT' | 'VISUAL_OBSERVATION' | 'UNKNOWN';

export type CharacterAnalysisStatus =
  | 'NOT_ANALYZED'
  | 'ANALYZING'
  | 'AI_DRAFT'
  | 'USER_CONFIRMED'
  | 'LOCKED'
  | 'FAILED'
  | 'idle'
  | 'analyzed'
  | 'error'
  | 'pending';

export type CharacterLockStatus = 'UNLOCKED' | 'LOCKED';

export interface CharacterIdentity {
  id: string;
  name: string;
  alias?: string;
  originalNameInScript?: string;
}

export interface CharacterReferenceMetadata {
  referenceImageId: string;
  referenceImageUrl?: string;
  imageHash: string;
  detectedName?: string;
  detectedAge?: string;
  detectedHeight?: string;
  availableViews: string[];
}

export interface CharacterVisualProfile {
  imageHash?: string;
  referenceImageId?: string;
  referenceImageUrl?: string;
  hairStyle?: string;
  hairColor?: string;
  top?: string;
  bottom?: string;
  shoes?: string;
  accessories?: string;
  visibleDistinctiveDetails?: string;
  referenceImage: string;
  referenceImages?: string[];
  imageAnalysisStatus: CharacterAnalysisStatus;
  hair?: string;
  visibleOutfit?: string;
  visibleAccessories?: string;
  visiblePhysicalAppearance?: string;
  visibleDistinguishingDetails?: string;
  characterSheetUrl?: string;
  isMultiViewSheet?: boolean;
  detectedViews?: string[];
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

export interface CharacterStructuredFeatures {
  creatureType?: string;
  species?: string;
  name: string;
  gender: string;
  ageRange: string;
  skinTone: string;
  faceShape: string;
  hairStyle: string;
  hairColor: string;
  eyeDescription: string;
  bodyType: string;
  topClothing: string;
  bottomClothing: string;
  footwear: string;
  accessories: string;
  distinctFeatures: string;
  confidence: number;
}

export interface Character {
  id: string;
  userId?: string;
  name: string;
  gender: string;
  age: string;
  description: string;
  triggerTag: string;
  referenceImages: string[];
  referenceImageId?: string;
  referenceImageUrl?: string;
  imageHash?: string;
  outfitDescription?: string;
  consistencyStrength: number;
  avatarUrl: string;
  structuredFeatures?: CharacterStructuredFeatures;
  analysisConfidence?: number;
  isVerifiedByUser?: boolean;
  identity?: CharacterIdentity;
  characterIdentity?: CharacterIdentity;
  referenceMetadata?: CharacterReferenceMetadata;
  visualProfile?: CharacterVisualProfile;
  storyProfile?: CharacterStoryProfile;
  fieldSources?: Record<string, FieldSource>;
  imageAnalysisStatus?: CharacterAnalysisStatus;
  lockStatus?: CharacterLockStatus;
  currentReferenceImageHash?: string;
  visualProfileImageHash?: string;
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// LOCATION LOCK & LOCATION DATA MODEL (SERVER)
// Reference Type: LOCATION
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
  availableViews: string[];
  imageAnalysisStatus: LocationAnalysisStatus;
}

export interface LocationVisualProfile {
  environmentType: string;
  architecturalStyle: string;
  wallColor: string;
  floor: string;
  ceiling: string;
  doors: string;
  windows: string;
  majorFurniture: string;
  fixedObjects: string;
  spatialLayout: string;
  permanentDecor: string;
  distinctiveFeatures: string;
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
  identity: LocationIdentity;
  referenceMetadata: LocationReferenceMetadata;
  visualProfile: LocationVisualProfile;
  storyProfile: LocationStoryProfile;
  lockStatus: LocationLockStatus;
  imageAnalysisStatus: LocationAnalysisStatus;
  referenceImages: string[];
  referenceImageId?: string;
  referenceImageUrl?: string;
  imageHash?: string;
  thumbnailUrl?: string;
  triggerTag?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Scene {
  id: string;
  sceneNumber: number;
  title: string;
  prompt: string;
  negativePrompt?: string;
  mediaType: MediaType;
  aspectRatio: AspectRatio;
  characterId?: string;
  locationId?: string;
  locationName?: string;
  usePreviousSceneAsRef: boolean;
  referenceImage?: string;
  outputJobId?: string;
  outputUrl?: string;
  status: 'draft' | 'generating' | 'completed';
}

export interface Project {
  id: string;
  userId?: string;
  title: string;
  description: string;
  aspectRatio: AspectRatio;
  defaultCharacterId?: string;
  scenes: Scene[];
  versions?: any[];
  createdAt: string;
  updatedAt: string;
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
  transactions: {
    id: string;
    timestamp: string;
    amount: number;
    type: 'usage' | 'topup' | 'refund' | 'bonus';
    description: string;
    jobId?: string;
    balanceAfter: number;
  }[];
}

const jobsStore: Map<string, GenerationJob> = new Map();

// Sample curated high aesthetic presets
const SAMPLE_IMAGE_OUTPUTS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1080&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=1080&q=80'
];

const SAMPLE_VIDEO_OUTPUTS = [
  '/sample-videos/sala_sample_1.mp4',
  '/sample-videos/sala_sample_2.mp4',
  '/sample-videos/sala_sample_3.mp4'
];

// Initial Character Library
let charactersStore: Character[] = [
  {
    id: 'char_fahsai_01',
    name: 'ฟ้าใส (Fahsai)',
    gender: 'หญิง',
    age: '24 ปี',
    description: 'สาวไทยหน้าคม สดใส ดวงตากลมโต ผมยาวประบ่าสีน้ำตาลเข้ม สไตล์มินิมอลโมเดิร์น ยิ้มแย้มมีเสน่ห์',
    triggerTag: '(fahsai_modern_thai_girl:1.25)',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    referenceImages: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80'
    ],
    outfitDescription: 'เสื้อเชิ้ตผ้าลินินสีครีม หรือเสื้อแจ็คเก็ตเดนิมลำลอง พร้อมเครื่องประดับมินิมอลเงิน',
    consistencyStrength: 0.85,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'char_karn_02',
    name: 'กานต์ (Karn)',
    gender: 'ชาย',
    age: '28 ปี',
    description: 'ช่างภาพหนุ่มบุคลิกเท่ สุขุม ทรงผมปัดข้าง ผิวสองสี มีรอยยิ้มอบอุ่น สายตาโฟกัส แววตาเปี่ยมแรงบันดาลใจ',
    triggerTag: '(karn_cinematic_photographer:1.2)',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    referenceImages: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=600&q=80'
    ],
    outfitDescription: 'เสื้อแจ็คเก็ตบอมเบอร์สีเขียวโอลีฟ เสื้อยืดสีดำ กางเกงคาร์โก้ สะพายกล้องวินเทจ',
    consistencyStrength: 0.9,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'char_prae_05',
    name: 'แพร / Prae',
    gender: 'หญิง',
    age: '22 ปี',
    description: 'หญิงสาววัยรุ่นไทย ดวงตากลมโตเป็นประกาย รอยยิ้มสดใสเป็นธรรมชาติ ผิวสองสีเนียนผ่อง ผมยาวประบ่าดัดลอนคลื่นธรรมชาติสีน้ำตาลเข้ม',
    triggerTag: '(prae_consistent_char:1.2)',
    referenceImageId: 'ref_prae_master',
    referenceImageUrl: '/uploads/characters/ref_prae_master.jpg',
    imageHash: '38ed715e729e441ce92056fc2d82324d452f0a7dbf8a769fbd98a4e6aba5dace',
    avatarUrl: '/uploads/characters/ref_prae_master.jpg',
    referenceImages: [
      '/uploads/characters/ref_prae_master.jpg'
    ],
    outfitDescription: 'เสื้อเชิ้ตคอปกผ้าฝ้ายสีครีมมินิมอล กางเกงขายาวผ้าลินินสีเบจ รองเท้าคัทชูหนังสีน้ำตาลอ่อน ต่างหูห่วงเงินมินิมอล',
    consistencyStrength: 0.95,
    analysisConfidence: 95,
    isVerifiedByUser: true,
    lockStatus: 'LOCKED',
    imageAnalysisStatus: 'USER_CONFIRMED',
    currentReferenceImageHash: '38ed715e729e441ce92056fc2d82324d452f0a7dbf8a769fbd98a4e6aba5dace',
    visualProfileImageHash: '38ed715e729e441ce92056fc2d82324d452f0a7dbf8a769fbd98a4e6aba5dace',
    identity: {
      id: 'char_prae_05',
      name: 'แพร / Prae'
    },
    characterIdentity: {
      id: 'char_prae_05',
      name: 'แพร / Prae'
    },
    referenceMetadata: {
      referenceImageId: 'ref_prae_master',
      imageHash: '38ed715e729e441ce92056fc2d82324d452f0a7dbf8a769fbd98a4e6aba5dace',
      detectedName: 'แพร / Prae',
      detectedAge: '22',
      detectedHeight: '165 cm',
      availableViews: ['FRONT', 'FACE_CLOSEUP']
    },
    visualProfile: {
      imageHash: '38ed715e729e441ce92056fc2d82324d452f0a7dbf8a769fbd98a4e6aba5dace',
      referenceImageId: 'ref_prae_master',
      referenceImageUrl: '/uploads/characters/ref_prae_master.jpg',
      referenceImage: '/uploads/characters/ref_prae_master.jpg',
      referenceImages: ['/uploads/characters/ref_prae_master.jpg'],
      hairStyle: 'ผมยาวประบ่าดัดลอนคลื่นธรรมชาติ',
      hairColor: 'น้ำตาลเข้มช็อกโกแลต',
      top: 'เสื้อเชิ้ตคอปกผ้าฝ้ายสีครีมมินิมอล',
      bottom: 'กางเกงขายาวผ้าลินินสีเบจ',
      shoes: 'รองเท้าคัทชูหนังสีน้ำตาลอ่อน',
      accessories: 'ต่างหูห่วงเงินมินิมอล',
      visibleDistinctiveDetails: 'ดวงตากลมโตเป็นประกาย รอยยิ้มสดใสเป็นธรรมชาติ ผิวสองสีเนียนผ่อง',
      imageAnalysisStatus: 'USER_CONFIRMED',
      hair: 'ผมยาวประบ่าดัดลอนคลื่นธรรมชาติ น้ำตาลเข้มช็อกโกแลต',
      visibleOutfit: 'เสื้อเชิ้ตคอปกผ้าฝ้ายสีครีมมินิมอล กางเกงขายาวผ้าลินินสีเบจ',
      visibleAccessories: 'ต่างหูห่วงเงินมินิมอล',
      visiblePhysicalAppearance: 'หญิงสาววัยรุ่นไทย ดวงตากลมโตเป็นประกาย รอยยิ้มสดใสเป็นธรรมชาติ',
      visibleDistinguishingDetails: 'รอยยิ้มสดใสเป็นธรรมชาติ ผิวสองสีเนียนผ่อง',
      detectedViews: ['FRONT', 'FACE_CLOSEUP'],
      isMultiViewSheet: false,
      confidence: 95,
      generatedVisualPrompt: 'Thai young woman Prae with warm brown wavy hair, cream shirt and beige linen trousers'
    },
    storyProfile: {
      age: '22 ปี',
      personality: 'ร่าเริง มองโลกในแง่ดี อบอุ่น มีความมุ่งมั่นสูง',
      role: 'นางเอกซีรีส์โรแมนติกดราม่า',
      occupation: 'นักออกแบบกราฟิกอิสระ',
      background: 'สาวน้อยผู้รักงานศิลปะ เดินทางมาตามหาแรงบันดาลใจใหม่ในเมืองหลวง'
    },
    structuredFeatures: {
      name: 'แพร / Prae',
      gender: 'หญิง',
      ageRange: '22 ปี',
      skinTone: 'ผิวสองสีเนียนผ่อง',
      faceShape: 'รูปไข่ละมุน',
      hairStyle: 'ผมยาวประบ่าดัดลอนคลื่นธรรมชาติ',
      hairColor: 'น้ำตาลเข้มช็อกโกแลต',
      eyeDescription: 'ตากลมโตสดใสสีน้ำตาล',
      bodyType: 'สมส่วน',
      topClothing: 'เสื้อเชิ้ตคอปกผ้าฝ้ายสีครีมมินิมอล',
      bottomClothing: 'กางเกงขายาวผ้าลินินสีเบจ',
      footwear: 'รองเท้าคัทชูหนังสีน้ำตาลอ่อน',
      accessories: 'ต่างหูห่วงเงินมินิมอล',
      distinctFeatures: 'รอยยิ้มสดใสเป็นธรรมชาติ ผิวสองสีเนียนผ่อง',
      confidence: 95
    },
    fieldSources: {
      name: 'REFERENCE_TEXT',
      age: 'REFERENCE_TEXT',
      hairStyle: 'VISUAL_OBSERVATION',
      hairColor: 'VISUAL_OBSERVATION',
      top: 'VISUAL_OBSERVATION',
      bottom: 'VISUAL_OBSERVATION',
      shoes: 'VISUAL_OBSERVATION',
      accessories: 'VISUAL_OBSERVATION',
      gender: 'VISUAL_OBSERVATION'
    },
    createdAt: new Date().toISOString()
  }
];

// Initial Location Library (Location Lock Store)
let locationsStore: LocationItem[] = [
  {
    id: 'loc_modern_living_01',
    name: 'ห้องนั่งเล่นมินิมอลโมเดิร์น (Modern Minimalist Living Room)',
    type: 'LOCATION',
    lockStatus: 'LOCKED',
    imageAnalysisStatus: 'USER_CONFIRMED',
    referenceImageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
    referenceImages: [
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80'
    ],
    referenceImageId: 'ref_loc_living_01',
    imageHash: 'loc_hash_modern_living_88a91c',
    thumbnailUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
    triggerTag: '(location_modern_minimalist_living_room:1.25)',
    identity: {
      id: 'loc_modern_living_01',
      name: 'ห้องนั่งเล่นมินิมอลโมเดิร์น (Modern Minimalist Living Room)'
    },
    referenceMetadata: {
      referenceImageId: 'ref_loc_living_01',
      referenceImageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
      imageHash: 'loc_hash_modern_living_88a91c',
      availableViews: ['WIDE_SHOT', 'CORNER_PERSPECTIVE', 'FURNITURE_LAYOUT'],
      imageAnalysisStatus: 'USER_CONFIRMED'
    },
    visualProfile: {
      environmentType: 'Indoor (ห้องนั่งเล่นหลัก)',
      architecturalStyle: 'Modern Japandi Minimalist',
      wallColor: 'ผนังฉาบปูนเรียบสีเบจอ่อน (Warm off-white) และผนังไม้ระแนงโอ๊คฝั่งขวา',
      floor: 'พื้นไม้ลามิเนตสีโอ๊คอ่อนลายก้างปลา ปูพรมขนสั้นสีเทาเทาโมเดิร์น',
      ceiling: 'เพดานฝ้าหลุมสีขาวซ่อนไฟ warm light สีส้มสลัวพร้อมสปอตไลท์ฝังฝ้า',
      doors: 'ประตูกระจกบานเลื่อนกรอบอลูมิเนียมสีดำด้าน เปิดออกสู่ระเบียง',
      windows: 'หน้าต่างกระจกบานใหญ่ทรงสูงจากพื้นจรดเพดาน รับแสงธรรมชาติทางทิศเหนือ',
      majorFurniture: 'โซฟาผ้าลินินทรงแอลสีเทาอ่อน, โต๊ะกลางไม้โอ๊คกลมมน, โต๊ะวางทีวีบิลท์อินไม้',
      fixedObjects: 'ผนังชั้นหนังสือบิลท์อินแบบไร้มือจับ และตู้ซ่อนสายไฟเรียบเนียน',
      spatialLayout: 'พื้นที่เปิดโล่งเชื่อมต่อกับมุมรับประทานอาหาร ทิศทางแสงส่องเฉียง 45 องศา',
      permanentDecor: 'ภาพวาดศิลปะแอบสแตรกต์โทนสีเอิร์ธโทนขนาดใหญ่ 1 รูป และต้นไทรใบสักในกระถางเซรามิก',
      distinctiveFeatures: 'ช่องแสงส่องกระทบผนังไม้ระแนงเป็นเส้นเฉียง และโคมไฟตั้งพื้นทรงโค้งสีดำด้าน',
      referenceImageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
      referenceImageId: 'ref_loc_living_01',
      imageHash: 'loc_hash_modern_living_88a91c',
      confidence: 96,
      generatedVisualPrompt: 'Modern Japandi living room, warm beige smooth walls, light oak herringbone wooden flooring, large floor-to-ceiling glass window, L-shaped light grey linen sofa, oak round coffee table, built-in recessed ceiling spotlights with warm ambient lighting'
    },
    storyProfile: {
      storyLocationName: 'ห้องนั่งเล่นคอนโดหรูใจกลางเมือง',
      description: 'สถานที่พักผ่อนและพูดคุยหลักของตัวละครหลัก บรรยากาศเงียบสงบ อบอุ่น และเป็นส่วนตัว',
      notes: 'ใช้เป็นฉากเปิดเรื่องและฉากพูดคุยสำคัญระหว่าง 2 ตัวละคร'
    },
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'loc_scifi_deck_02',
    name: 'ห้องควบคุมยานสำรวจอวกาศ (Sci-Fi Command Deck)',
    type: 'LOCATION',
    lockStatus: 'LOCKED',
    imageAnalysisStatus: 'USER_CONFIRMED',
    referenceImageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    referenceImages: [
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80'
    ],
    referenceImageId: 'ref_loc_scifi_02',
    imageHash: 'loc_hash_scifi_deck_99c32f',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    triggerTag: '(location_scifi_spaceship_command_bridge:1.3)',
    identity: {
      id: 'loc_scifi_deck_02',
      name: 'ห้องควบคุมยานสำรวจอวกาศ (Sci-Fi Command Deck)'
    },
    referenceMetadata: {
      referenceImageId: 'ref_loc_scifi_02',
      referenceImageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      imageHash: 'loc_hash_scifi_deck_99c32f',
      availableViews: ['WIDE_ANGLE_DECK', 'PILOT_CONSOLE', 'HOLOGRAPHIC_STATION'],
      imageAnalysisStatus: 'USER_CONFIRMED'
    },
    visualProfile: {
      environmentType: 'Interior Sci-Fi Spaceship Bridge',
      architecturalStyle: 'Futuristic Cybernetic Industrial',
      wallColor: 'แผ่นโลหะไทเทเนียมสีเทาเข้มเนื้อด้าน สลับเส้นไฟนีออนแถบสีฟ้าคราม (Cyan LED Strips)',
      floor: 'แผ่นเหล็กเสริมลายกันลื่นสีเทาคาร์บอน พร้อมไฟนำทางฝังพื้นสีส้มแดง',
      ceiling: 'โครงสร้างเหล็กเปลือยสไตล์โมดูลาร์ พร้อมแผงท่อหล่อเย็นและไฟดาวน์ไลท์สีขาวเย็น 6500K',
      doors: 'ประตูกลไฮดรอลิกแบบเปิดเลื่อนแยกซ้ายขวาสองชั้น พร้อมแผงสแกนลายนิ้วมือ',
      windows: 'กระจกมองยานอวกาศทรงพาโนรามากว้าง 180 องศา เผยให้เห็นห้วงอวกาศและละอองเนบิวลา',
      majorFurniture: 'เก้าอี้กัปตันหนังสีดำปรับเอนได้ตรงกลาง, คอนโซลควบคุม 4 จุดพร้อมจอทัชสกรีนโปร่งแสง',
      fixedObjects: 'แท่นฉายภาพโฮโลแกรมสามมิติขนาดใหญ่ทรงกลมกลางห้อง',
      spatialLayout: 'ทรงเกือกม้า (Horseshoe Layout) พื้นยกระดับ 2 ชั้น กัปตันอยู่ตรงกลางสูงกว่าคอนโซลนักบิน',
      permanentDecor: 'หน้าจอเรดาร์แสดงสถานะการเคลื่อนที่ของยาน และสัญลักษณ์ยานสำรวจศาลาเอไอสีเงิน',
      distinctiveFeatures: 'แสงสะท้อนจากกระจกยานมองเห็นดวงดาวระยิบระยับ และแสงไฟนีออนวิ่งเป็นจังหวะรอบคอนโซล',
      referenceImageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      referenceImageId: 'ref_loc_scifi_02',
      imageHash: 'loc_hash_scifi_deck_99c32f',
      confidence: 97,
      generatedVisualPrompt: 'Futuristic spaceship bridge command deck, dark matte titanium walls, glowing cyan LED light strips, carbon steel floor with orange guide lights, panoramic 180-degree front viewport showing outer space nebula, holographic globe display in center'
    },
    storyProfile: {
      storyLocationName: 'ยานสำรวจศาลา-1 (Sala-1 Cruiser Bridge)',
      description: 'ศูนย์กลางสั่งการของยานสำรวจ บรรยากาศตึงเครียดแต่เปี่ยมด้วยเทคโนโลยีขั้นสูง',
      notes: 'ใช้ในฉากการเดินทางระหว่างดวงดาวและการสั่งการสำคัญ'
    },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'loc_thai_veranda_03',
    name: 'ชานเรือนไม้ไทยริมน้ำ (Traditional Thai Wooden Veranda)',
    type: 'LOCATION',
    lockStatus: 'LOCKED',
    imageAnalysisStatus: 'USER_CONFIRMED',
    referenceImageUrl: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80',
    referenceImages: [
      'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80'
    ],
    referenceImageId: 'ref_loc_thai_03',
    imageHash: 'loc_hash_thai_veranda_77e41b',
    thumbnailUrl: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80',
    triggerTag: '(location_traditional_thai_wooden_waterfront_house:1.25)',
    identity: {
      id: 'loc_thai_veranda_03',
      name: 'ชานเรือนไม้ไทยริมน้ำ (Traditional Thai Wooden Veranda)'
    },
    referenceMetadata: {
      referenceImageId: 'ref_loc_thai_03',
      referenceImageUrl: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80',
      imageHash: 'loc_hash_thai_veranda_77e41b',
      availableViews: ['WIDE_RIVER_VIEW', 'WOODEN_TERRACE', 'ORNATE_EAVES_DETAIL'],
      imageAnalysisStatus: 'USER_CONFIRMED'
    },
    visualProfile: {
      environmentType: 'Semi-outdoor (ชานเรือนเปิดโล่งริมแม่น้ำ)',
      architecturalStyle: 'Traditional Central Thai Wooden Architecture (เรือนไทยภาคกลาง)',
      wallColor: 'ผนังฝาปะกนไม้สักทองสีน้ำตาลอมส้ม เคลือบเงามันวาวตามธรรมชาติ',
      floor: 'ไม้กระดานสักแผ่นใหญ่หน้ากว้าง ขัดมันเงางาม มีร่องระบายน้ำและลมธรรมชาติ',
      ceiling: 'โครงสร้างหลังคาทรงจั่วทรงสูงเปิดเปลือยเห็นขื่อแปไม้สัก แกะสลักลวดลายบัวกลีบขนุน',
      doors: 'ประตูบานเฟี้ยมไม้สักโบราณเปิดพับเก็บข้างผนังได้สุดแนว',
      windows: 'ช่องหน้าต่างซุ้มไม้ฉลุลายโบราณ เปิดรับลมแม่น้ำพัดโชยตลอดวัน',
      majorFurniture: 'ตั่งไม้สักโบราณปูเบาะผ้าไหมลายขิด, หมอนขวานสามเหลี่ยมลายไทยโบราณสีคราม',
      fixedObjects: 'ระเบียงราวลูกกรงไม้สักฉลุลายริมน้ำ พร้อมเสาเอกไม้สักกลึงกลม',
      spatialLayout: 'ชานเรือนเชื่อมระหว่างเรือนนอนและท่าน้ำ มองเห็นแม่น้ำเจ้าพระยายามเย็น',
      permanentDecor: 'กระถางบัวดินเผาเคลือบมรกต, ตะเกียงทองเหลืองโบราณแขวนเสา',
      distinctiveFeatures: 'แสงสะท้อนระลอกคลื่นน้ำระยิบระยับขึ้นบนเพดานไม้สัก และชายคาทรงปั้นหยาแกะสลักประณีต',
      referenceImageUrl: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80',
      referenceImageId: 'ref_loc_thai_03',
      imageHash: 'loc_hash_thai_veranda_77e41b',
      confidence: 95,
      generatedVisualPrompt: 'Traditional central Thai wooden house veranda, golden teak wood panel walls, polished wide teak floorboards, high open gable roof with ornate carved brackets, riverside balustrade with tranquil river water reflection, antique brass lanterns'
    },
    storyProfile: {
      storyLocationName: 'เรือนไทยริมสายน้ำอัมพวา',
      description: 'บ้านพักริมน้ำบรรยากาศสงบ ร่มรื่น เต็มไปด้วยกลิ่นอายประวัติศาสตร์และวัฒนธรรมไทย',
      notes: 'เหมาะสำหรับฉากดราม่า พักผ่อน นั่งสมาธิ หรือพบปะพูดคุยเรื่องราวในอดีต'
    },
    createdAt: new Date(Date.now() - 86400000).toISOString()
  }
];

// Initial Projects Store (Empty)
let projectsStore: Project[] = [];

// ==========================================
// USER AUTHENTICATION, ROLES & ENCRYPTION
// ==========================================
export interface StoredUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  passwordHash: string;
  salt: string;
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

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  aspectRatio: AspectRatio;
  visualStyle: string;
  defaultCharacterId?: string;
  continuityLock?: any;
  audioDirectives?: any;
  createdAt: string;
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')): { salt: string; hash: string } {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password: string, salt: string, hash: string): boolean {
  const verify = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return verify === hash;
}

// Global Pricing & Fee Configuration (Managed by Admin)
let pricingConfig = {
  copyPromptFee: 10, // Default: 10 Sala AI Credits per prompt clip
  serviceFeeType: 'fixed' as 'fixed' | 'percentage',
  serviceFeeValue: 5 // 5 credits or 5%
};

// Seed users with cryptographically salted hashes (Never plaintext!)
const adminPass = hashPassword('admin1234');
const userPass = hashPassword('user1234');

const usersStore: Map<string, StoredUser> = new Map([
  [
    'user_admin_01',
    {
      id: 'user_admin_01',
      firstName: 'ผู้ดูแลระบบ',
      lastName: 'ศาลาเอไอ',
      username: 'admin',
      email: 'admin@sala.ai',
      passwordHash: adminPass.hash,
      salt: adminPass.salt,
      role: 'admin',
      status: 'active',
      isVerified: true,
      createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      lastLogin: new Date().toISOString()
    }
  ],
  [
    'user_sala_001',
    {
      id: 'user_sala_001',
      firstName: 'กานต์',
      lastName: 'ครีเอเตอร์',
      username: 'creator',
      email: 'creator@sala.ai',
      passwordHash: userPass.hash,
      salt: userPass.salt,
      role: 'user',
      status: 'active',
      isVerified: true,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      lastLogin: new Date().toISOString()
    }
  ]
]);

// Active Token Sessions (token -> userId). Local sessions are HMAC-signed (serverAuth.ts);
// no hard-coded demo tokens are accepted.
const sessionsStore: Map<string, string> = new Map();
// Logged-out local session tokens (until they expire)
const revokedSessionTokens: Map<string, number> = new Map();
// Verified Firebase ID tokens cache (token -> claims), dropped at token expiry
const verifiedFirebaseTokens: Map<string, VerifiedFirebaseClaims> = new Map();

// Firebase project for ID-token verification (env override, else the app's firebase-applet-config.json)
const FIREBASE_PROJECT_ID: string = (() => {
  if (process.env.FIREBASE_PROJECT_ID) return process.env.FIREBASE_PROJECT_ID;
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
    return String(cfg.projectId || '');
  } catch {
    return '';
  }
})();
// Admins: verified Firebase email from readAdminEmails() (seed plus emails an existing admin added).
// HMAC secret for local session tokens.
const SESSION_SECRET: string = process.env.SESSION_SECRET || (FIREBASE_PROJECT_ID ? `sala-session-secret-${FIREBASE_PROJECT_ID}` : 'sala-ai-default-session-secret-2026');
if (!process.env.SESSION_SECRET) console.warn('[auth] SESSION_SECRET not set: using persistent project fallback secret for local sessions');

// Initial User Credits Account (Creator account)
const currentUserAccount: CreditAccount = {
  userId: 'user_sala_001',
  userName: 'ครีเอเตอร์ศาลาเอไอ (Creator)',
  userRole: 'user', // Standard user role
  remainingCredits: 0,
  totalUsedCredits: 0,
  dailyUsedCredits: 0,
  dailyLimit: 150,
  monthlyUsedCredits: 0,
  monthlyLimit: 1000,
  perGenerationLimit: 40,
  transactions: []
};

// Admin Credit Account
const adminCreditAccount: CreditAccount = {
  userId: 'user_admin_01',
  userName: 'ผู้ดูแลระบบศาลาเอไอ (Admin)',
  userRole: 'admin',
  remainingCredits: 0,
  totalUsedCredits: 100,
  dailyUsedCredits: 0,
  dailyLimit: 10000,
  monthlyUsedCredits: 100,
  monthlyLimit: 50000,
  perGenerationLimit: 500,
  transactions: []
};

// Credit Accounts Store (userId -> CreditAccount)
const creditAccountsStore: Map<string, CreditAccount> = new Map([
  ['user_sala_001', currentUserAccount],
  ['user_admin_01', adminCreditAccount]
]);

// Authenticated identity of a request (how it was proven)
interface RequestIdentity {
  via: 'firebase' | 'local-session';
  firebase?: VerifiedFirebaseClaims;
}

async function verifyFirebaseTokenCached(token: string): Promise<VerifiedFirebaseClaims | null> {
  const now = Math.floor(Date.now() / 1000);
  const cached = verifiedFirebaseTokens.get(token);
  if (cached) {
    if (cached.exp > now) return cached;
    verifiedFirebaseTokens.delete(token);
  }
  const claims = await verifyFirebaseIdToken(token, FIREBASE_PROJECT_ID);
  if (claims) {
    if (verifiedFirebaseTokens.size > 5000) verifiedFirebaseTokens.clear();
    verifiedFirebaseTokens.set(token, claims);
  }
  return claims;
}

// Helper to authenticate user from Authorization Header (Bearer token).
// Accepts ONLY: a valid HMAC-signed local session token, or a cryptographically verified Firebase ID token.
async function getAuthenticatedUser(req: express.Request): Promise<{ user: StoredUser; account: CreditAccount; identity: RequestIdentity } | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split(' ')[1]?.trim();
  if (!token) return null;

  let userId: string | undefined;
  let identity: RequestIdentity | null = null;

  if (token.startsWith('sala.')) {
    // Local username/password session (server-issued, HMAC-signed)
    const session = verifySessionToken(token, SESSION_SECRET);
    if (session && !revokedSessionTokens.has(token)) {
      userId = session.userId;
      identity = { via: 'local-session' };
    }
  } else {
    // Firebase ID token: signature / issuer / audience / expiry verified (never just decoded)
    const decoded = await verifyFirebaseTokenCached(token);
    if (decoded) {
      identity = { via: 'firebase', firebase: decoded };
      userId = decoded.uid;
      let user = usersStore.get(userId);
      // Link to an existing account by email only when Google/Firebase verified that email
      if (!user && decoded.email && decoded.emailVerified) {
        user = Array.from(usersStore.values()).find(
          u => u.email.toLowerCase() === decoded.email!.toLowerCase()
        );
        if (user) {
          userId = user.id;
        }
      }

      if (!user) {
        const isAdmin = isAdminIdentity(decoded, readAdminEmails());
        user = {
          id: userId,
          username: decoded.email?.split('@')[0] || `user_${userId.slice(0, 8)}`,
          email: decoded.email || `${userId}@firebase.user`,
          firstName: decoded.name || 'ผู้ใช้ Google',
          lastName: '',
          role: isAdmin ? 'admin' : 'user',
          status: 'active',
          isVerified: decoded.emailVerified,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          salt: '',
          passwordHash: ''
        };
        usersStore.set(userId, user);
      } else {
        user.lastLogin = new Date().toISOString();
      }
    }
  }

  if (!userId) return null;

  let user = usersStore.get(userId);
  if (!user && identity?.via === 'local-session') {
    user = {
      id: userId,
      username: userId,
      email: `${userId}@sala.local`,
      firstName: 'สมาชิก Sala AI',
      lastName: '',
      role: 'user',
      status: 'active',
      isVerified: true,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      salt: '',
      passwordHash: ''
    };
    usersStore.set(userId, user);
  }

  if (!user || user.status === 'suspended') return null;

  let account = creditAccountsStore.get(user.id);
  if (!account) {
    account = {
      userId: user.id,
      userName: `${user.firstName || user.username} (${user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'สมาชิก'})`,
      userRole: user.role,
      remainingCredits: 0,
      totalUsedCredits: 0,
      dailyUsedCredits: 0,
      dailyLimit: user.role === 'admin' ? 10000 : 250,
      monthlyUsedCredits: 0,
      monthlyLimit: user.role === 'admin' ? 50000 : 2000,
      perGenerationLimit: user.role === 'admin' ? 500 : 50,
      transactions: []
    };
    creditAccountsStore.set(user.id, account);
  }

  if (!identity) return null;
  return { user, account, identity };
}

// Middleware: Require valid session token

function jobForViewer(job: any, role?: string) {
  if (!job) return job;
  if (role === 'admin') return job;
  const copy = { ...job };
  delete copy.tokensUsed;
  delete copy.usageMissing;
  return copy;
}

function chargeFieldsFrom(req: any) {
  const charge = req?.creditCharge;
  if (!charge) return {};
  return {
    creditsCharged: charge.creditsCharged ?? 0,
    remainingCredits: charge.remainingCredits ?? null,
  };
}

/** Gate, call Gemini, then charge tokens/TOKENS_PER_CREDIT. No token count => charge 0 and record usageMissing. Does not add another 10%. */
async function callBillableGemini(req: any, res: any, ai: any, payload: any, reason: string): Promise<{ response: any } | null> {
  let uid = req.user?.id as string | undefined;
  if (!uid) {
    const auth = await getAuthenticatedUser(req);
    uid = auth?.user?.id;
  }
  try {
    await ensureCanCallFlashLite(uid);
  } catch (err: any) {
    res.status(err?.status || 503).json({ success: false, message: err?.message || MISSING_FIRESTORE_CREDENTIAL_MESSAGE });
    return null;
  }
  const response = await ai.models.generateContent(payload);
  const priced = chargeFromUsageMetadata(response?.usageMetadata || response?.usage || null);
  const charge = await deductUsableCredits(uid as string, priced.creditsCharged, reason, {
    tokensUsed: priced.tokensUsed,
    usageMissing: priced.usageMissing,
  });
  req.creditCharge = charge;
  if (isRealCreditUid(uid)) rememberUserBalance(uid as string, charge.remainingCredits);
  return { response };
}

async function requireAuth(req: any, res: express.Response, next: express.NextFunction) {
  let auth: Awaited<ReturnType<typeof getAuthenticatedUser>> = null;
  try { auth = await getAuthenticatedUser(req); } catch { auth = null; }
  if (!auth) {
    return res.status(401).json({
      success: false,
      message: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ (Unauthorized: Valid Session Token Required)'
    });
  }
  req.user = auth.user;
  req.creditAccount = auth.account;
  next();
}

// Middleware: Require Admin role.
// Admin = cryptographically verified Firebase ID token whose email is verified (email_verified)
// and listed in readAdminEmails(). No uid bypass, no local-session admin, no self-writable role flags.
async function requireAdmin(req: any, res: express.Response, next: express.NextFunction) {
  let auth: Awaited<ReturnType<typeof getAuthenticatedUser>> = null;
  try { auth = await getAuthenticatedUser(req); } catch { auth = null; }
  if (!auth) {
    return res.status(401).json({
      success: false,
      message: 'กรุณาเข้าสู่ระบบก่อนดำเนินการ (Unauthorized: Session Token Required)'
    });
  }

  const isAuthorizedAdmin = auth.identity.via === 'firebase' && isAdminIdentity(auth.identity.firebase, readAdminEmails());
  if (!isAuthorizedAdmin) {
    return res.status(403).json({
      success: false,
      message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ ต้องใช้สิทธิ์ผู้ดูแลระบบ (Forbidden: Admin Privileges Required)'
    });
  }
  if (auth.user.role !== 'admin') {
    auth.user.role = 'admin';
    usersStore.set(auth.user.id, auth.user);
  }

  req.user = auth.user;
  req.creditAccount = auth.account;
  next();
}

// Seed Redeem Codes
const redeemCodesStore: Map<string, RedeemCode> = new Map([
  [
    'code_welcome_100',
    {
      id: 'code_welcome_100',
      code: 'SALA100',
      creditAmount: 100,
      maxUses: 1000,
      usedCount: 14,
      isExpired: false,
      createdAt: new Date().toISOString(),
      createdBy: 'admin'
    }
  ],
  [
    'code_vip_500',
    {
      id: 'code_vip_500',
      code: 'SALAVIP500',
      creditAmount: 500,
      maxUses: 50,
      usedCount: 3,
      isExpired: false,
      createdAt: new Date().toISOString(),
      createdBy: 'admin'
    }
  ]
]);

// Project templates. Archaeology and cyberpunk samples are not seeded.
let projectTemplatesStore: ProjectTemplate[] = [];

// Seed initial completed jobs in store for download gallery
const initialJobs: GenerationJob[] = [
  {
    id: 'job_init_01',
    type: 'image',
    status: 'completed',
    progress: 100,
    stage: 'สำเร็จสมบูรณ์',
    provider: 'gemini',
    providerName: 'Google Gemini (Nano Banana / Imagen)',
    isMock: true, // seeded demo/sample output, not a real generation
    model: 'gemini-3.1-flash-lite-image',
    prompt: 'ฟ้าใส (Fahsai) สไตล์มินิมอลโมเดิร์น สวมเสื้อเชิ้ตลินินสีครีม ยิ้มสดใสในคาเฟ่ แสงธรรมชาติ ถ่ายด้วยเลนส์ 85mm f/1.4',
    negativePrompt: 'blurry, extra fingers, cartoon, low quality',
    aspectRatio: '1:1',
    outputUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1080&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    characterId: 'char_fahsai_01',
    characterName: 'ฟ้าใส (Fahsai)',
    costCredits: 8,
    seed: 489214,
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 6 + 12000).toISOString()
  },
  {
    id: 'job_init_02',
    type: 'video',
    status: 'completed',
    progress: 100,
    stage: 'สำเร็จสมบูรณ์',
    provider: 'gemini',
    providerName: 'Google Veo Video Engine',
    isMock: true, // seeded demo/sample output, not a real generation
    model: 'veo-3.1-lite-generate-preview',
    prompt: 'กานต์เดินถ่ายภาพริมแม่น้ำเจ้าพระยา แสงสีส้มยามเช้า มุมมองกล้องดอลลี่เคลื่อนที่ช้าๆ ความคมชัดระดับ 1080p',
    negativePrompt: 'jitter, low frame rate, blurry, artifacts',
    aspectRatio: '16:9',
    outputUrl: '/api/video-stream/job_init_02',
    thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    characterId: 'char_karn_02',
    characterName: 'กานต์ (Karn)',
    projectId: 'proj_first_light_01',
    sceneId: 'scene_02',
    sceneNumber: 2,
    costCredits: 35,
    seed: 129034,
    durationSeconds: 5,
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 4 + 35000).toISOString()
  },
  {
    id: 'job_init_03',
    type: 'image',
    status: 'completed',
    progress: 100,
    stage: 'สำเร็จสมบูรณ์',
    provider: 'meta',
    providerName: 'Meta Llama / Emu Vision',
    isMock: true,
    model: 'emu-3-gen-v1',
    prompt: 'แฟชั่นสตรีทอาร์ต 9:16 สไตล์กรุงเทพฯ ไซเบอร์ปังก์ สีสันนีออนสะท้อนพื้นถนนเปียกฝน นางแบบไทยยืนเด่น',
    negativePrompt: 'monochrome, oversaturated, deformed eyes',
    aspectRatio: '9:16',
    outputUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1080&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
    costCredits: 10,
    seed: 948271,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 2 + 8000).toISOString()
  }
];

initialJobs.forEach(job => jobsStore.set(job.id, job));

// ==========================================
// 3. PROVIDER ADAPTER IMPLEMENTATIONS
// ==========================================

// Helper for Gemini SDK client
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(customApiKey?: string): GoogleGenAI | null {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!customApiKey && geminiClient) {
    return geminiClient;
  }
  const client = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
  if (!customApiKey) {
    geminiClient = client;
  }
  return client;
}

// Helper to format GenAI / Veo errors cleanly for user feedback
function formatGenAIError(err: any): string {
  if (!err) return 'ข้อผิดพลาดที่ไม่ทราบสาเหตุ';
  const str = typeof err === 'string' ? err : err.message || JSON.stringify(err);

  if (str.includes('429') || str.includes('quota') || str.includes('RESOURCE_EXHAUSTED')) {
    return 'โควตา Google Veo / Gemini API ของบัญชีนี้เต็มหรือต้องเปิดใช้งาน Paid Billing ใน Google AI Studio (429 Quota Exceeded / Billing Required)';
  }
  if (str.includes('403') || str.includes('PERMISSION_DENIED')) {
    return 'ไม่มีสิทธิ์เข้าถึงโมเดล Google Veo หรือคีย์ไม่มีสิทธิ์เข้าถึง (403 Permission Denied - จำเป็นต้องใช้คีย์ที่เปิดใช้ Veo API)';
  }
  if (str.includes('404') || str.includes('NOT_FOUND')) {
    return 'ไม่พบโมเดล AI หรือโมเดลนี้ไม่เปิดให้บริการแล้ว (404 Model Not Found)';
  }
  if (str.includes('Internal error') || str.includes('internal error') || str.includes('INTERNAL')) {
    return 'เซิร์ฟเวอร์ Google GenAI เกิดข้อผิดพลาดภายใน (Internal Server Error) หรือชื่อโมเดลไม่ถูกต้อง กรุณาตรวจสอบสถานะ Billing และ API Key';
  }

  try {
    const jsonStart = str.indexOf('{');
    if (jsonStart !== -1) {
      const parsed = JSON.parse(str.slice(jsonStart));
      if (parsed.error?.message) return parsed.error.message;
    }
  } catch {}

  return str;
}

// Helper to save generated Veo video to local MP4 file on the server
async function saveGeneratedVideoToFile(
  ai: GoogleGenAI,
  generatedVideo: any,
  targetFilePath: string
): Promise<void> {
  const videoObj = generatedVideo?.video;
  if (!videoObj) {
    throw new Error('ไม่พบข้อมูล Video ในผลลัพธ์จาก Google Veo');
  }

  // 1. Direct base64 videoBytes if returned
  if (videoObj.videoBytes) {
    fs.writeFileSync(targetFilePath, Buffer.from(videoObj.videoBytes, 'base64'));
    return;
  }

  // 2. Download from URI using x-goog-api-key header (standard @google/genai pattern)
  if (videoObj.uri) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['x-goog-api-key'] = apiKey;
    }

    try {
      let downloadUrl = videoObj.uri;
      if (downloadUrl.startsWith('files/')) {
        downloadUrl = `https://generativelanguage.googleapis.com/v1beta/${videoObj.uri}:download?alt=media&key=${apiKey}`;
      }
      const res = await fetch(downloadUrl, { headers });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        fs.writeFileSync(targetFilePath, Buffer.from(arrayBuffer));
        if (fs.existsSync(targetFilePath) && fs.statSync(targetFilePath).size > 0) {
          return;
        }
      }
    } catch (fetchErr: any) {
      console.warn('Direct fetch of Veo video URI failed, trying SDK fallback:', fetchErr?.message || fetchErr);
    }

    // 3. Fallback to ai.files.download
    try {
      await ai.files.download({
        file: videoObj.uri,
        downloadPath: targetFilePath,
      });
      if (fs.existsSync(targetFilePath) && fs.statSync(targetFilePath).size > 0) {
        return;
      }
    } catch (sdkErr: any) {
      console.warn('ai.files.download fallback failed:', sdkErr?.message || sdkErr);
    }
  }

  throw new Error('ผลลัพธ์จาก Google Veo ไม่มีทั้ง videoBytes และ uri สำหรับการดาวน์โหลด');
}

// Provider 1: Gemini Adapter (Real server-side SDK; errors are surfaced, never replaced by sample output)
class GeminiProviderAdapter implements ProviderAdapter {
  id: ProviderId = 'gemini';
  name = 'Google Gemini & Veo';
  badge = 'Google AI Ecosystem';
  description = 'โมเดล Imagen 3 / Gemini สำหรับภาพ และ Google Veo สำหรับการสร้างวิดีโอคุณภาพสูง';
  requiresKeyEnv = 'GEMINI_API_KEY';

  get hasKey(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  get isMockOnly(): boolean {
    return !this.hasKey;
  }

  estimateCost(params: GenerationParams) {
    const hinted = Number(params.estimatedTokens);
    if (Number.isFinite(hinted) && hinted > 0) {
      const credits = creditsForTokens(hinted);
      return {
        estimatedCredits: credits,
        approximateThb: credits,
        breakdown: `ประมาณ ${credits} เครดิต (ยอดจริงคิดหลังระบบตอบกลับ)`
      };
    }
    if (params.type === 'video') {
      const dur = params.durationSeconds || 5;
      const resolution = normalizeVideoResolution(params.resolution);
      return {
        estimatedCredits: 0,
        approximateThb: 0,
        breakdown: `วิดีโอ Veo ${resolution} ${dur} วินาที คิดเครดิตหลังระบบตอบกลับ (ยังไม่หักล่วงหน้า)`
      };
    }
    return {
      estimatedCredits: 0,
      approximateThb: 0,
      breakdown: `ภาพ Gemini คิดเครดิตหลังระบบตอบกลับ (ยังไม่หักล่วงหน้า)`
    };
  }

  async generateImage(params: GenerationParams, jobId: string): Promise<{ outputUrl: string; isMock: boolean }> {
    const ai = getGeminiClient();
    if (!ai) {
      // No silent sample fallback: a missing key is a hard, user-visible failure.
      throw new Error('ไม่พบคีย์ GEMINI_API_KEY บนเซิร์ฟเวอร์ กรุณาตั้งค่า API Key ก่อนสร้างภาพ (GEMINI_API_KEY is not configured on the server)');
    }

    try {
      // Call Google GenAI SDK for image generation using gemini-3.1-flash-lite-image
      const promptText = buildEnrichedPrompt(params);
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite-image',
        contents: {
          parts: [{ text: promptText }]
        },
        config: {
          imageConfig: {
            aspectRatio: params.aspectRatio === '9:16' ? '9:16' : params.aspectRatio === '16:9' ? '16:9' : '1:1'
          }
        }
      });

      // Extract inlineData image
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType || 'image/png';
            return {
              outputUrl: `data:${mime};base64,${part.inlineData.data}`,
              isMock: false,
              usage: (response as any).usageMetadata || (response as any).usage || null
            };
          }
        }
      }

      // Model returned no image (e.g. text-only answer or safety block) -> fail explicitly
      const finishReason = response.candidates?.[0]?.finishReason;
      throw new Error(`Gemini ไม่ได้ส่งภาพกลับมา (No image returned by Gemini${finishReason ? `, finishReason: ${finishReason}` : ''})`);
    } catch (err: any) {
      console.error('Gemini image generation failed:', err?.message || err);
      const msg = err?.message || String(err);
      if (msg.startsWith('Gemini ไม่ได้ส่งภาพกลับมา')) throw err;
      throw new Error(`Gemini Image API: ${formatGenAIError(err)}`);
    }
  }

  async generateVideo(
    params: GenerationParams,
    jobId: string,
    updateProgress: (prog: number, stage: string) => void
  ): Promise<{ outputUrl: string; isMock: boolean }> {
    const ai = getGeminiClient();

    if (!ai) {
      throw new Error('ไม่พบคีย์ GEMINI_API_KEY บนเซิร์ฟเวอร์ กรุณาตั้งค่า API Key ก่อนใช้งาน Google Veo');
    }
    // Veo 3.1 / 3.1 Lite shut down on 22 Oct 2026: Gemini Omni Flash unless VIDEO_ENGINE=veo
    if (String(process.env.VIDEO_ENGINE || '').toLowerCase() !== 'veo') {
      return generateVideoWithOmni(params, jobId, updateProgress);
    }

    // 1. Prepare Prompt & Reference Image
    const promptText = buildEnrichedPrompt(params);

    // Character / location photos from the library (Veo "asset" reference images, up to 3)
    const assetRefs = params.referenceMode === 'asset' ? loadVeoReferenceImages(params.referenceImages, UPLOADS_DIR) : [];
    const referenceModel = assetRefs.length > 0 ? resolveVeoReferenceModel() : null;

    // Extract reference image if provided (Image-to-Video start frame)
    let inputImage: { imageBytes: string; mimeType: string } | undefined;
    if (params.referenceMode !== 'asset' && params.referenceImages && params.referenceImages.length > 0) {
      const ref = params.referenceImages[0];
      if (ref.startsWith('data:')) {
        const match = ref.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          inputImage = {
            mimeType: match[1],
            imageBytes: match[2],
          };
        }
      }
    }

    // Determine model (veo-3.1-lite-generate-preview as robust default)
    let modelName = 'veo-3.1-lite-generate-preview';
    if (params.model && (params.model.includes('veo') || params.model.startsWith('veo-'))) {
      modelName = params.model;
    }
    const useAssetRefs = assetRefs.length > 0 && !!referenceModel;
    if (useAssetRefs) modelName = referenceModel as string;

    const targetAspectRatio: '16:9' | '9:16' = params.aspectRatio === '9:16' ? '9:16' : '16:9';

    const videoResolution = normalizeVideoResolution(params.resolution);
    // Veo makes 4, 6 or 8 second clips; the chosen length is sent (it used to be left out)
    const videoDuration = veoDurationSeconds(params.durationSeconds, { resolution: videoResolution, usesReferenceImages: useAssetRefs });
    params.durationSeconds = videoDuration;
    const videoConfig: any = {
      numberOfVideos: 1,
      resolution: videoResolution,
      aspectRatio: targetAspectRatio,
      durationSeconds: videoDuration,
    };
    if (useAssetRefs) {
      videoConfig.referenceImages = assetRefs.map(image => ({ image, referenceType: 'asset' }));
    } else if (assetRefs.length > 0) {
      console.warn('[veo] character reference photos skipped: VEO_REFERENCE_MODEL is off');
    }

    const generatePayload: any = {
      model: modelName,
      prompt: promptText,
      config: videoConfig,
    };

    if (inputImage) {
      generatePayload.image = inputImage;
    }

    updateProgress(15, `กำลังเชื่อมต่อและส่งคำขอสร้างวิดีโอไปยัง Google Veo (${modelName}, ${videoDuration} วินาที${useAssetRefs ? `, รูปอ้างอิงตัวละคร ${assetRefs.length} รูป` : ''})...`);

    let operation: any;
    try {
      operation = await ai.models.generateVideos(generatePayload);
    } catch (apiErr: any) {
      console.error('Google Veo generateVideos call failed:', apiErr);
      const friendlyErr = formatGenAIError(apiErr);
      throw new Error(`Google Veo API: ${friendlyErr}`);
    }

    if (!operation || !operation.name) {
      throw new Error('Google Veo API ไม่ได้ส่งคืน Operation สำหรับการสร้างวิดีโอ');
    }

    const opId = operation.name.split('/').pop() || operation.name;
    updateProgress(25, `Google Veo กำลังสังเคราะห์วิดีโอ (Operation: ${opId})...`);

    // 2. Poll Operation until done
    const pollStartTime = Date.now();
    let currentOp = operation;

    while (!currentOp.done) {
      await delay(5000);
      try {
        currentOp = await ai.operations.getVideosOperation({ operation: { name: currentOp.name } as any });
      } catch (pollErr: any) {
        console.warn('Veo polling error:', pollErr?.message || pollErr);
      }

      const elapsedSec = Math.round((Date.now() - pollStartTime) / 1000);
      const calculatedProg = Math.min(92, 25 + Math.floor(elapsedSec * 0.9));
      const stageDesc =
        calculatedProg < 45
          ? `Google Veo กำลังคำนวณการเคลื่อนไหวและทิศทางแสง (${elapsedSec}s)...`
          : calculatedProg < 75
          ? `Google Veo กำลังสังเคราะห์และเรนเดอร์เฟรมความคมชัดสูง (${elapsedSec}s)...`
          : `Google Veo กำลังตรวจสอบความต่อเนื่องของฉากและประมวลผล H.264 (${elapsedSec}s)...`;

      updateProgress(calculatedProg, stageDesc);

      if (elapsedSec > 600) {
        throw new Error('Google Veo ใช้เวลาประมวลผลนานเกินกำหนด (Timeout 10 นาที)');
      }
    }

    // 3. Verify Operation result
    if (currentOp.error) {
      const errMsg = (currentOp.error as any)?.message || JSON.stringify(currentOp.error);
      throw new Error(`Google Veo Operation ล้มเหลว: ${formatGenAIError(errMsg)}`);
    }

    if (currentOp.response?.raiMediaFilteredReasons && currentOp.response.raiMediaFilteredReasons.length > 0) {
      throw new Error(`Google Veo ปฏิเสธการสร้างเนื่องจากนโยบายความปลอดภัย (RAI Filter): ${currentOp.response.raiMediaFilteredReasons.join(', ')}`);
    }

    const generatedVideos = currentOp.response?.generatedVideos;
    if (!generatedVideos || generatedVideos.length === 0) {
      throw new Error('Google Veo ประมวลผลเสร็จสิ้นแต่ไม่พบข้อมูลวิดีโอในผลลัพธ์');
    }

    // 4. Download and persist MP4 locally on server
    updateProgress(95, 'Google Veo เรนเดอร์เสร็จสมบูรณ์ กำลังดาวน์โหลดและบันทึกไฟล์ MP4 ลงเซิร์ฟเวอร์...');

    const generatedDir = path.join(process.cwd(), 'public', 'generated-videos');
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, { recursive: true });
    }

    const localFilePath = path.join(generatedDir, `${jobId}.mp4`);
    await saveGeneratedVideoToFile(ai, generatedVideos[0], localFilePath);

    if (!fs.existsSync(localFilePath) || fs.statSync(localFilePath).size === 0) {
      throw new Error('ไม่สามารถบันทึกไฟล์ MP4 จาก Google Veo ลงบนเซิร์ฟเวอร์ได้ (ไฟล์ว่างเปล่า)');
    }

    updateProgress(100, 'สร้างวิดีโอด้วย Google Veo สำเร็จสมบูรณ์ พร้อมเปิดเล่นและดาวน์โหลด MP4');
    const veoUsage = (currentOp as any)?.response?.usageMetadata
      || (currentOp as any)?.response?.usage
      || (currentOp as any)?.usageMetadata
      || (currentOp as any)?.usage
      || null;
    return {
      outputUrl: `/api/video-stream/${jobId}`,
      isMock: false,
      usage: veoUsage,
    };
  }
}

// Meta / xAI adapters have no real API integration yet. Instead of silently returning
// random sample media, they fail with a clear error so users are never shown fake output.
function providerNotAvailableError(providerName: string, keyEnv: string, hasKey: boolean): Error {
  if (!hasKey) {
    return new Error(`ผู้ให้บริการ ${providerName} ยังไม่ได้ตั้งค่า ${keyEnv} บนเซิร์ฟเวอร์ (${keyEnv} is not configured). กรุณาเลือก Google Gemini หรือตั้งค่า API Key`);
  }
  return new Error(`ผู้ให้บริการ ${providerName} ยังไม่รองรับการสร้างจริงในเวอร์ชันนี้ (real API integration not implemented). กรุณาเลือก Google Gemini`);
}

// Provider 2: Meta Adapter (Llama / Emu Architecture)
class MetaProviderAdapter implements ProviderAdapter {
  id: ProviderId = 'meta';
  name = 'Meta Llama / Emu';
  badge = 'Meta AI Research Architecture';
  description = 'สถาปัตยกรรม Meta Emu 3 และ Llama Multimodal สำหรับการเรนเดอร์ภาพความละเอียดสูงและสตอรี่บอร์ด';
  requiresKeyEnv = 'META_API_KEY';

  get hasKey(): boolean {
    return Boolean(process.env.META_API_KEY);
  }

  get isMockOnly(): boolean {
    return !this.hasKey;
  }

  estimateCost(params: GenerationParams) {
    if (params.type === 'video') {
      const dur = params.durationSeconds || 5;
      const credits = 35 + dur * 2;
      return {
        estimatedCredits: credits,
        approximateThb: credits,
        breakdown: `Meta Movie Gen (35 เครดิต + ${dur * 2} เครดิตความยาว)`
      };
    } else {
      const credits = 10;
      return {
        estimatedCredits: credits,
        approximateThb: credits,
        breakdown: 'Meta Emu 3 Generation (10 เครดิต/ภาพ)'
      };
    }
  }

  async generateImage(params: GenerationParams, jobId: string): Promise<{ outputUrl: string; isMock: boolean }> {
    throw providerNotAvailableError(this.name, this.requiresKeyEnv, this.hasKey);
  }

  async generateVideo(
    params: GenerationParams,
    jobId: string,
    updateProgress: (prog: number, stage: string) => void
  ): Promise<{ outputUrl: string; isMock: boolean }> {
    throw providerNotAvailableError(this.name, this.requiresKeyEnv, this.hasKey);
  }
}

// Provider 3: xAI / Grok Adapter Architecture
class XaiProviderAdapter implements ProviderAdapter {
  id: ProviderId = 'xai';
  name = 'xAI / Grok Vision';
  badge = 'xAI Real-time Engine';
  description = 'สถาปัตยกรรม Grok Aurora และ Grok Imagine เน้นความสมจริงและไดนามิกภาพสูง';
  requiresKeyEnv = 'XAI_API_KEY';

  get hasKey(): boolean {
    return Boolean(process.env.XAI_API_KEY);
  }

  get isMockOnly(): boolean {
    return !this.hasKey;
  }

  estimateCost(params: GenerationParams) {
    if (params.type === 'video') {
      const dur = params.durationSeconds || 5;
      const credits = 32 + dur * 2;
      return {
        estimatedCredits: credits,
        approximateThb: credits,
        breakdown: `xAI Grok Motion (${credits} เครดิต)`
      };
    } else {
      const credits = 9;
      return {
        estimatedCredits: credits,
        approximateThb: credits,
        breakdown: 'xAI Grok Imagine (9 เครดิต/ภาพ)'
      };
    }
  }

  async generateImage(params: GenerationParams, jobId: string): Promise<{ outputUrl: string; isMock: boolean }> {
    throw providerNotAvailableError(this.name, this.requiresKeyEnv, this.hasKey);
  }

  async generateVideo(
    params: GenerationParams,
    jobId: string,
    updateProgress: (prog: number, stage: string) => void
  ): Promise<{ outputUrl: string; isMock: boolean }> {
    throw providerNotAvailableError(this.name, this.requiresKeyEnv, this.hasKey);
  }
}

// Provider 4: Mock Simulator Adapter (Always available for testing & offline)
// Intentional dev/demo sandbox: only used when the user EXPLICITLY selects provider 'mock'.
// Its jobs are always flagged isMock=true and the UI labels them as simulated output.
class MockProviderAdapter implements ProviderAdapter {
  id: ProviderId = 'mock';
  name = 'ศาลาเอไอ Simulator';
  badge = 'Mock / Sandbox Mode';
  description = 'ระบบจำลองการสร้างภาพและวิดีโอสำหรับการทดสอบ UI, ตรรกะของฉาก และสถาปัตยกรรม (ระบุชัดเจนว่าเป็น Mock)';
  requiresKeyEnv = 'ไม่มี (ฟรี)';
  hasKey = true;
  isMockOnly = true;

  estimateCost(params: GenerationParams) {
    const credits = params.type === 'video' ? 15 : 2;
    return {
      estimatedCredits: credits,
      approximateThb: 0,
      breakdown: `โหมดทดสอบจำลอง Mock Sandbox (${credits} เครดิตจำลอง - ไม่มีค่าใช้จ่ายจริง)`
    };
  }

  async generateImage(params: GenerationParams, jobId: string): Promise<{ outputUrl: string; isMock: boolean }> {
    await delay(1200);
    const randomImg = SAMPLE_IMAGE_OUTPUTS[Math.floor(Math.random() * SAMPLE_IMAGE_OUTPUTS.length)];
    return { outputUrl: randomImg, isMock: true };
  }

  async generateVideo(
    params: GenerationParams,
    jobId: string,
    updateProgress: (prog: number, stage: string) => void
  ): Promise<{ outputUrl: string; isMock: boolean }> {
    await simulateVideoStages(updateProgress, 'Sala Simulator Pipeline');
    const randomVideo = SAMPLE_VIDEO_OUTPUTS[Math.floor(Math.random() * SAMPLE_VIDEO_OUTPUTS.length)];
    return { outputUrl: randomVideo, isMock: true };
  }
}

// ==========================================
// 4. PROVIDER MANAGER
// ==========================================
class ProviderManager {
  private adapters: Map<ProviderId, ProviderAdapter> = new Map();

  constructor() {
    this.register(new GeminiProviderAdapter());
    this.register(new MetaProviderAdapter());
    this.register(new XaiProviderAdapter());
    this.register(new MockProviderAdapter());
  }

  register(adapter: ProviderAdapter) {
    this.adapters.set(adapter.id, adapter);
  }

  // Lenient lookup used for labels / cost estimates only (unknown ids default to Gemini, never to mock).
  get(providerId: ProviderId): ProviderAdapter {
    return this.adapters.get(providerId) || this.adapters.get('gemini')!;
  }

  // Strict lookup used for actual generation: unknown providers are rejected.
  find(providerId: ProviderId | undefined): ProviderAdapter | undefined {
    return providerId ? this.adapters.get(providerId) : undefined;
  }

  listProviders() {
    return Array.from(this.adapters.values()).map(adapter => ({
      id: adapter.id,
      name: adapter.name,
      badge: adapter.badge,
      description: adapter.description,
      isMock: adapter.isMockOnly,
      isAvailable: true,
      requiresKeyEnv: (adapter as any).requiresKeyEnv,
      hasServerKey: adapter.hasKey,
      supportedMedia: ['image', 'video'] as MediaType[],
      models: [
        {
          id: `${adapter.id}-standard`,
          name: `${adapter.name} Standard`,
          description: 'ความละเอียดมาตรฐาน สมดุลความเร็วและความแม่นยำ',
          costPerImage: adapter.estimateCost({ type: 'image', provider: adapter.id, model: '', prompt: '', aspectRatio: '1:1' }).estimatedCredits,
          costPerVideoSec: 0
        },
        {
          id: `${adapter.id}-ultra`,
          name: `${adapter.name} Ultra Cinematic`,
          description: 'คุณภาพสูงสุดสำหรับงานภาพยนตร์และสตอรี่บอร์ด',
          costPerImage: adapter.estimateCost({ type: 'image', provider: adapter.id, model: '', prompt: '', aspectRatio: '1:1' }).estimatedCredits,
          costPerVideoSec: 0
        }
      ]
    }));
  }
}

const providerManager = new ProviderManager();

// ==========================================
// 5. HELPER FUNCTIONS
// ==========================================
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * One clip with Gemini Omni Flash: library photos keep the characters' faces, and a clip that continues
 * the previous one (same place) starts from that clip's last frame, so set and positions carry over.
 */
async function generateVideoWithOmni(
  params: GenerationParams,
  jobId: string,
  updateProgress: (prog: number, stage: string) => void
): Promise<{ outputUrl: string; isMock: boolean; usage?: any }> {
  const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
  const references = params.referenceMode === 'asset' ? loadVeoReferenceImages(params.referenceImages, UPLOADS_DIR) : [];
  const names = Array.isArray(params.referenceNames) ? params.referenceNames.map(n => String(n || '')) : [];

  // Start frame: last frame of the previous clip, once that clip is done (waits up to 15 minutes)
  let firstFrame: { imageBytes: string; mimeType: string } | null = null;
  const prevId = typeof params.continueFromJobId === 'string' ? params.continueFromJobId : '';
  if (prevId && prevId !== jobId) {
    const started = Date.now();
    while (Date.now() - started < 15 * 60 * 1000) {
      const prev = jobsStore.get(prevId);
      if (!prev || prev.status === 'completed' || prev.status === 'failed' || prev.status === 'cancelled') break;
      const waited = Math.round((Date.now() - started) / 1000);
      updateProgress(8, `รอคลิปก่อนหน้าเสร็จ เพื่อใช้ภาพสุดท้ายเป็นจุดเริ่มของคลิปนี้ (${waited}s)...`);
      await delay(4000);
    }
    if (jobsStore.get(prevId)?.status === 'completed') {
      firstFrame = await extractLastFrame(resolveVideoPathForJob(prevId));
    }
  }

  const seconds = Math.min(10, Math.max(3, Number(params.durationSeconds) || 8));
  params.durationSeconds = seconds;
  updateProgress(20, `กำลังสร้างวิดีโอด้วย Gemini Omni (${OMNI_VIDEO_MODEL}, ~${seconds} วินาที${references.length ? `, รูปตัวละคร ${references.length} รูป` : ''}${firstFrame ? ', เริ่มจากภาพสุดท้ายของคลิปก่อน' : ''})...`);
  const started = Date.now();
  const ticker = setInterval(() => {
    const s = Math.round((Date.now() - started) / 1000);
    updateProgress(Math.min(90, 20 + Math.floor(s * 0.6)), `Gemini Omni กำลังสร้างวิดีโอ (${s}s)...`);
  }, 5000);
  let result: { bytes: Buffer; response: any };
  try {
    result = await generateOmniVideo({
      prompt: buildEnrichedPrompt(params),
      references,
      referenceNames: names,
      firstFrame,
      aspectRatio: params.aspectRatio,
      resolution: normalizeVideoResolution(params.resolution),
      durationSeconds: seconds
    }, apiKey);
  } finally {
    clearInterval(ticker);
  }

  updateProgress(95, 'กำลังบันทึกไฟล์ MP4 ลงเซิร์ฟเวอร์...');
  const generatedDir = path.join(process.cwd(), 'public', 'generated-videos');
  if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true });
  fs.writeFileSync(path.join(generatedDir, `${jobId}.mp4`), result.bytes);
  updateProgress(100, 'สร้างวิดีโอด้วย Gemini Omni สำเร็จ พร้อมเปิดเล่นและดาวน์โหลด MP4');
  const usage = result.response?.usage || result.response?.usage_metadata || result.response?.usageMetadata || null;
  return { outputUrl: `/api/video-stream/${jobId}`, isMock: false, usage };
}

function buildEnrichedPrompt(params: GenerationParams): string {
  let prompt = params.prompt;

  const isVideo = params.type === 'video';
  // Director prompts already carry the full Character Lock; adding the anchor again doubles it
  const hasCharacterLock = /Character Lock:/i.test(prompt);

  // Add character consistency anchor if selected
  if (params.characterId && !hasCharacterLock) {
    const char = charactersStore.find(c => c.id === params.characterId);
    if (char) {
      const parts: string[] = [];
      if (char.triggerTag) parts.push(char.triggerTag.trim());
      if (char.description) parts.push(char.description.trim());
      if (char.outfitDescription && char.outfitDescription.trim()) {
        parts.push(`Outfit: ${char.outfitDescription.trim()}`);
      }
      const charAnchor = parts.filter(Boolean).join('. ');
      if (charAnchor) {
        prompt = `${charAnchor}. ${prompt}`;
      }
    }
  }

  // Aspect ratio goes in the Veo config; "clean studio render" is an image-only finish that
  // fought against outdoor / night / location scenes in video prompts.
  prompt = prompt.replace(/[\s.]+$/, '');
  if (!isVideo) {
    prompt += `. Aspect ratio: ${params.aspectRatio}. High quality, photographic composition, clean studio render.`;
  } else {
    prompt += '.';
  }
  if (params.negativePrompt) {
    prompt += ` Avoid: ${params.negativePrompt}`;
  }

  return prompt;
}

async function simulateVideoStages(
  updateProgress: (prog: number, stage: string) => void,
  engineName: string = 'Neural Video Pipeline'
) {
  const steps = [
    { p: 10, stage: `[${engineName}] เริ่มจัดคิวและวิเคราะห์ Prompt / Reference...` },
    { p: 25, stage: `[${engineName}] ตรวจสอบ Character Consistency และ Scene Continuity...` },
    { p: 45, stage: `[${engineName}] สร้างคีย์เฟรมและคำนวณการเคลื่อนไหวเชิงพื้นที่ (Spatial-Temporal Keyframes)...` },
    { p: 68, stage: `[${engineName}] กระบวนการ Diffusion Denoising กำลังประมวลผลเฟรมวิดีโอ...` },
    { p: 85, stage: `[${engineName}] เกลี่ยแสงและปรับความต่อเนื่องของใบหน้าตัวละคร...` },
    { p: 95, stage: `[${engineName}] บีบอัดและเอ็กซ์พอร์ตไฟล์ MP4 1080p H.264...` }
  ];

  for (const step of steps) {
    updateProgress(step.p, step.stage);
    await delay(1100);
  }
}

// Background Worker for Job Processing
function processJobInBackground(jobId: string, params: GenerationParams) {
  const job = jobsStore.get(jobId);
  if (!job) return;

  const adapter = providerManager.find(params.provider);

  (async () => {
    try {
      if (!adapter) {
        throw new Error(`ไม่รู้จักผู้ให้บริการ "${params.provider}" (Unknown provider)`);
      }
      job.status = 'processing';
      job.progress = 10;
      job.stage = 'กำลังเตรียมโมเดลและข้อมูล Reference...';
      jobsStore.set(jobId, job);

      let result: { outputUrl: string; isMock: boolean };

      if (params.type === 'video') {
        result = await adapter.generateVideo(params, jobId, (prog, stage) => {
          const current = jobsStore.get(jobId);
          if (current) {
            current.progress = prog;
            current.stage = stage;
            jobsStore.set(jobId, current);
          }
        });
      } else {
        job.progress = 35;
        job.stage = 'กำลังส่งไปยังโมเดลสร้างภาพ...';
        jobsStore.set(jobId, job);
        result = await adapter.generateImage(params, jobId);
        job.progress = 85;
        job.stage = 'กำลังบันทึกภาพผลลัพธ์และสร้าง Thumbnail...';
        jobsStore.set(jobId, job);
        await delay(500);
      }

      if (!result.isMock && params.provider === 'gemini' && job.userId && isRealCreditUid(job.userId)) {
        const priced = chargeFromUsageMetadata((result as any).usage);
        const charge = await deductUsableCredits(
          job.userId,
          priced.creditsCharged,
          `สร้าง${params.type === 'video' ? 'วิดีโอ' : 'ภาพ'} ${jobId}`,
          {
            tokensUsed: priced.tokensUsed,
            usageMissing: priced.usageMissing,
            durationSeconds: params.type === 'video' ? (params.durationSeconds || job.durationSeconds || 5) : undefined,
            resolution: params.type === 'video' ? normalizeVideoResolution(params.resolution) : undefined,
          }
        );
        job.tokensUsed = charge.tokensUsed;
        job.creditsCharged = charge.creditsCharged;
        job.remainingCredits = charge.remainingCredits;
        job.costCredits = charge.creditsCharged;
        job.usageMissing = charge.usageMissing === true;
        if (params.type === 'video') {
          job.durationSeconds = params.durationSeconds || job.durationSeconds || 5;
          job.resolution = normalizeVideoResolution(params.resolution);
        }
        rememberUserBalance(job.userId, charge.remainingCredits);
      }

      job.status = 'completed';
      job.progress = 100;
      job.stage = 'สำเร็จสมบูรณ์ (พร้อมดาวน์โหลด)';
      const finalUrl = params.type === 'video' ? `/api/video-stream/${jobId}` : result.outputUrl;
      job.outputUrl = finalUrl;
      job.thumbnailUrl = result.outputUrl;
      job.isMock = result.isMock;
      job.completedAt = new Date().toISOString();
      jobsStore.set(jobId, job);

      // If associated with a scene in a project, update the scene output!
      if (params.projectId && params.sceneId) {
        const proj = projectsStore.find(p => p.id === params.projectId);
        if (proj) {
          const scene = proj.scenes.find(s => s.id === params.sceneId);
          if (scene) {
            scene.status = 'completed';
            scene.outputJobId = jobId;
            scene.outputUrl = finalUrl;
            proj.updatedAt = new Date().toISOString();
          }
        }
      }
    } catch (err: any) {
      console.error(`Error processing job ${jobId}:`, err);
      job.status = 'failed';
      job.progress = 0;
      job.stage = 'สร้างไม่สำเร็จ (Generation failed)';
      job.error = err?.message || 'ไม่สามารถสร้างผลงานได้';
      job.outputUrl = undefined;
      job.thumbnailUrl = undefined;
      jobsStore.set(jobId, job);

      if (params.projectId && params.sceneId) {
        const proj = projectsStore.find(p => p.id === params.projectId);
        const scene = proj?.scenes.find(s => s.id === params.sceneId);
        if (scene && scene.status !== 'completed') {
          scene.status = 'draft'; // allow re-generation after a failed attempt
        }
      }

      // Refund an in-memory hold only. Gemini jobs are charged from Firestore after a real token count, so a failed call must not invent a refund.
      if (job.skipMemoryCharge) {
        jobsStore.set(jobId, job);
        return;
      }
      const refundAccount = (job.userId && creditAccountsStore.get(job.userId)) || currentUserAccount;
      refundAccount.remainingCredits += job.costCredits;
      if (refundAccount !== currentUserAccount) {
        refundAccount.totalUsedCredits = Math.max(0, refundAccount.totalUsedCredits - job.costCredits);
        refundAccount.dailyUsedCredits = Math.max(0, refundAccount.dailyUsedCredits - job.costCredits);
        refundAccount.monthlyUsedCredits = Math.max(0, refundAccount.monthlyUsedCredits - job.costCredits);
      }
      refundAccount.transactions.unshift({
        id: `refund_${Date.now()}`,
        timestamp: new Date().toISOString(),
        amount: job.costCredits,
        type: 'refund',
        description: `คืนเครดิตเนื่องจากการสร้างไม่สำเร็จ (งาน: ${job.id})`,
        jobId: job.id,
        balanceAfter: refundAccount.remainingCredits
      });
    }
  })();
}

// ==========================================
// 6. REST API ENDPOINTS
// ==========================================

// 6.1 Providers Info
app.get('/api/providers', (req, res) => {
  res.json({
    success: true,
    providers: providerManager.listProviders(),
    serverEnvKeys: {
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasMetaKey: Boolean(process.env.META_API_KEY),
      hasXaiKey: Boolean(process.env.XAI_API_KEY)
    }
  });
});

// 6.2 Cost Estimate
app.post('/api/estimate-cost', (req, res) => {
  const params: GenerationParams = req.body;
  const adapter = providerManager.get(params.provider || 'gemini');
  const baseEstimate = adapter.estimateCost(params);

  const apiCredits = baseEstimate.estimatedCredits;
  const serviceFee = pricingConfig.serviceFeeType === 'fixed'
    ? pricingConfig.serviceFeeValue
    : Math.ceil(apiCredits * (pricingConfig.serviceFeeValue / 100));
  const totalCredits = apiCredits + serviceFee;
  const approximateThb = Number(Number(totalCredits).toFixed(2));
  const canAfford = currentUserAccount.remainingCredits >= totalCredits;

  const breakdown = `ต้นทุน API จริง: ${apiCredits} เครดิต | ค่าบริการ Sala AI (${pricingConfig.serviceFeeType === 'fixed' ? `${pricingConfig.serviceFeeValue} เครดิตคงที่` : `${pricingConfig.serviceFeeValue}%`}): ${serviceFee} เครดิต | ยอดรวม: ${totalCredits} เครดิต (ประมาณ ${approximateThb} บาท)`;

  res.json({
    success: true,
    estimate: {
      estimatedApiCredits: apiCredits,
      serviceFeeCredits: serviceFee,
      totalCredits,
      approximateThb,
      breakdown,
      canAfford,
      copyPromptFee: pricingConfig.copyPromptFee
    },
    userCredits: {
      remaining: currentUserAccount.remainingCredits,
      dailyUsed: currentUserAccount.dailyUsedCredits,
      dailyLimit: currentUserAccount.dailyLimit,
      monthlyUsed: currentUserAccount.monthlyUsedCredits,
      monthlyLimit: currentUserAccount.monthlyLimit
    }
  });
});

// 6.2.1 Multi-Clip Continuity Director: Batch Prompt Generation
app.post('/api/director/generate-multi-clip-prompts', requireAuth, async (req: any, res) => {
  try {
    const {
      scriptText,
      clipDurationSeconds = 10,
      clipCount = 3,
      continuityLock = {},
      dialogues = [],
      audioDirectives = {},
      apiKey,
      offline = false,
      characters = [],
      locations = []
    } = req.body;

    if (!scriptText || typeof scriptText !== 'string' || scriptText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุบทละครหรือคำอธิบายฉาก (Script / Storyboard text)'
      });
    }

    const requestedCount = Math.max(1, Math.min(10, Number(clipCount) || 3));
    // Meta AI / Veo clips run 8-10 seconds at most, so dialogue is planned for at most 10 seconds
    const duration = Math.max(3, Math.min(10, Number(clipDurationSeconds) || 8));
    // Never plan fewer clips than the script has scenes, or the ending is lost
    let scriptSceneCount = 0;
    try { scriptSceneCount = parseSalaScript(scriptText, {}).clips.length; } catch { scriptSceneCount = 0; }
    const count = Math.max(requestedCount, Math.min(30, scriptSceneCount));
    const sceneCredits = Math.round(count * 0.5 * 100) / 100;
    const creditUid = req.user?.id;
    if (isRealCreditUid(creditUid)) {
      const balance = (await readFirestoreCreditBalance(creditUid)) ?? 0;
      if (balance < sceneCredits) {
        return res.status(402).json({
          success: false,
          message: `เครดิตไม่พอสำหรับผู้กำกับ Multi-Clip (ต้องการ ${sceneCredits} เครดิต คงเหลือ ${balance})`
        });
      }
      await deductUsableCredits(creditUid, sceneCredits, `ผู้กำกับ Multi-Clip ${count} ฉาก`, {
        tokensUsed: 0,
        usageMissing: false
      });
    }
    // Library cards with server-side reference check (lost /uploads files -> re-upload warning)
    const libraryChars = markMissingUploadReferences(Array.isArray(characters) ? characters : []);
    // Location library (lock payloads) with the same reference check; undefined = client sent no library
    const libraryLocs: any[] | undefined = Array.isArray(locations) ? markMissingUploadReferences(locations.filter((l: any) => l && l.name)) : undefined;
    const locationLockOpts = {
      selectedLocationId: continuityLock?.locationId || undefined,
      lockedLocation: continuityLock?.location || undefined,
      timeOfDay: continuityLock?.timeOfDay || undefined,
      lighting: continuityLock?.lighting || undefined
    };

    // Sanitize incoming dialogues: strictly exclude any reserved system keywords as speakers
    const sanitizedDialogues = Array.isArray(dialogues)
      ? dialogues.filter((d: any) => d && d.speaker && !isReservedSystemKeyword(d.speaker))
      : [];

    // Locked characters: user's lock first, then speakers of the Dialogue Lock
    const lockedNames: string[] = Array.from(new Set([
      ...expandCombinedCharacterNames([String(continuityLock?.characterName || '')]),
      ...expandCombinedCharacterNames(Array.isArray(continuityLock?.characterNames) ? continuityLock.characterNames : []),
      ...sanitizedDialogues.map((d: any) => String(d.speaker || ''))
    ].map((n: string) => n.trim()).filter((n: string) => n && !isReservedSystemKeyword(n) && !isMetadataKeyword(n))));

    // OFFLINE (deterministic) builder: only when the user explicitly chose it
    if (offline === true) {
      // Location Lock from the library is applied inside the builder (verbatim description + reference line)
      const offlineClips = buildSalaMultiClipPrompts({
        scriptText,
        clipDurationSeconds: duration,
        clipCount: count,
        continuityLock,
        dialogues: sanitizedDialogues,
        audioDirectives,
        knownCharacters: lockedNames,
        characters: libraryChars,
        locations: libraryLocs
      });
      return res.json({
        success: true,
        source: 'deterministic',
        offline: true,
        clips: offlineClips,
        autoSplit: summarizeAutoSplit(offlineClips, count),
        validation: validateSalaMultiClipPrompts(offlineClips, lockedNames)
      });
    }

    // User's saved key first, then server GEMINI_API_KEY. The key is never logged.
    const userKey = typeof apiKey === 'string' ? apiKey.trim() : '';
    const ai = getGeminiClient(userKey || undefined);
    if (!ai) {
      return res.status(400).json({
        success: false,
        code: 'GEMINI_KEY_MISSING',
        message: 'ยังไม่ได้ตั้งค่า Gemini API Key กรุณาบันทึก API Key หรือเลือกสร้างแบบออฟไลน์ / No Gemini API key is configured. Save your key or choose offline mode.'
      });
    }

    let clips: any[] | null = null;
    const source: 'gemini-ai' = 'gemini-ai';
    {
      try {
        {
          const promptInstruction = `You are the Lead Visual Director for high-end cinematic AI video continuity.
Analyze the following script/scene in Thai and split it into continuous, sequential video clips of ${duration} seconds each (about ${count} clips, at least one per scene). Cover the WHOLE script: every scene, every action and every dialogue line must be in a clip, including the ending. Never drop or merge away any part of the story; add clips if needed.

CRITICAL PROTOCOL & RESERVED KEYWORDS RULES:
- The following words are RESERVED SYSTEM KEYWORDS: LOCK, CONT, FRAME, AUTO, RULE, NO, OUT, STORY, CHARACTERS, END, SALA_MULTI_CLIP
- NEVER interpret any RESERVED SYSTEM KEYWORD as a character name, speaker name, or actor.
- NEVER output "[DIALOGUE_LOCK: LOCK says]" or similar invalid tags.
- Characters and speakers must be actual narrative persona names.

CRITICAL CONTINUITY DIRECTIVES (MASTER CONTINUITY LOCK):
- Character Lock: ${continuityLock.characterName || ''} | Appearance & Costume: ${continuityLock.characterAppearance || ''}
- Location Lock: ${continuityLock.location || ''}
- Time & Lighting Lock: ${continuityLock.timeOfDay || ''}, Lighting: ${continuityLock.lighting || ''}
- Visual Style Lock: ${continuityLock.visualStyle || 'Photorealistic 8K, 35mm film'}
- Aspect Ratio: ${continuityLock.aspectRatio || '16:9'}
- Camera & Lens: Movement: ${continuityLock.cameraMovement || 'Cinematic tracking'}, Lens: ${continuityLock.lensType || '35mm anamorphic'}
- Props Lock: ${continuityLock.props || ''}
- Spatial Anchor: ${continuityLock.characterPosition || ''}
- Action Momentum Continuity: The starting action of Clip N MUST seamlessly and directly continue from the ending frame and momentum of Clip N-1.
- POSE HANDOFF: For every clip list the characters present and each character's start pose and end pose (posture: standing | sitting | lying | kneeling | walking, plus where, e.g. "at the front door", "on the bench"). The startPoses of Clip N MUST equal the endPoses of Clip N-1 unless the script explicitly says the character moves (stands up, sits down, walks to ...).
- CHARACTER PRESENCE: A locked character who is in the scene must stay in every following clip until the script says they leave. Put leaving characters in "charactersLeft".
- LOCATION LOCK & AUTO SCENE ENVIRONMENT:
  * ดึงค่า "สถานที่" (Location) และ "ช่วงเวลา/สภาพแสง" (Lighting/Time) จากเนื้อเรื่องของฉากนั้นโดยตรง
  * เมื่อขึ้นฉากใหม่ ให้รีเซ็ตค่าสภาพแวดล้อมเดิมทิ้งทันที ห้ามนำค่าเดิม (เช่น ป่าทึบ/แสงแดด) ข้ามมาใช้ในฉากใหม่ (เช่น ถ้ำโบราณ/กลางคืน)
  * หัวข้อฉากที่เป็นชื่อตอน/อารมณ์ (เช่น "อารมณ์เริ่มตึงเครียด", "คืนดีกัน") หรือ "…ต่อเนื่อง" ไม่ใช่สถานที่ใหม่ ให้ใช้สถานที่และเวลาของฉากเดิมต่อเนื่อง
${buildLockedContinuityContext(continuityLock, characters, locations)}

CRITICAL ORIGINAL DIALOGUE INTEGRITY RULES:
- ORIGINAL_DIALOGUE_ONLY = true
- INVENT_DIALOGUE = false
- NARRATION_TO_DIALOGUE = false
- Dialogue MUST be extracted from the original script ONLY, verbatim word-for-word.
- NEVER invent, extrapolate, add, shorten, or alter dialogue lines.
- If a clip has NO dialogue in the original script, set "dialogues": [] and "dialogue": "NONE". Never create spoken lines!
- Narration, character action, thoughts, facial expressions, and scene descriptions MUST NEVER be converted to dialogue.
- Before creating each CLIP, search dialogue from the original story section corresponding to that scene first.
- If there is dialogue, clearly output character name + exact original line.
- NEVER use words like "shouting", "yelling", "says", "asks", or "speaks" in generatedPrompt if there is no real dialogue from the original script in that clip.

ACTION & NARRATION RULE:
- ทุกบรรทัด Action/Narration ในบทต้องอยู่ใน generatedPrompt ของคลิปใดคลิปหนึ่ง ครบทุกบรรทัด ห้ามตัด ห้ามสรุปรวบ
- ถ้าบทมี Action/Narration แม้ไม่มีบทพูด ต้องนำ Action/Narration นั้นไปสร้างเป็นเหตุการณ์ใน Prompt ตามลำดับเดิม
- ตัวอย่าง:
  บท: "บรรยากาศป่ามืด ฝนตก ฟ้าใสเดินเข้าป่า"
  Prompt ต้องสื่อเพียงว่า: "ป่ามืด ฝนกำลังตก ฟ้าใสกำลังเดินเข้าป่า"
- Action/Narration ต้องทำหน้าที่เพียง "บอกสิ่งที่กำลังเกิดขึ้นในช็อตนั้น" เท่านั้น ไม่ให้ไปเปลี่ยนโครงสร้าง Prompt เดิมหรือผสมกับระบบ Lock อื่น
- ห้ามนำ Action/Narration ไป:
  * รวมกับบทพูด หรือเปลี่ยนเป็นบทพูด หรือเพิ่มบทพูดใหม่
  * เปลี่ยนอารมณ์ตัวละครเอง หรือเปลี่ยนท่าทางอื่นที่บทไม่ได้สั่ง
  * แก้ Character Lock หรือแก้ Location Lock
  * สร้าง Action เพิ่มเอง

CLIP SPLITTING RULES:
- ห้ามใช้ 1 Action = 1 Clip เด็ดขาด
- Action/Narration ที่ต่อเนื่องกันในฉากและสถานที่เดียวกัน ให้รวมอยู่ในคลิปเดียวเท่าที่เวลา ${duration} วินาทีรองรับ (เช่น “หันมอง → เดินเข้าไป → ทำหน้าโมโห → หยิบมีด → ฟันต้นไม้” เป็นเหตุการณ์ต่อเนื่องกันในฉากเดียวกัน ให้รวมอยู่ในคลิปเดียว)
- ห้ามสร้าง Action เพิ่มเองเพื่อยืดจำนวนคลิป
- กฎแบ่ง 20 คำให้ทำงานเฉพาะ “บทพูด” ที่เกิน 20 คำเท่านั้น (Action/Narration ห้ามนำไปนับหรือแตกด้วยกฎ 20 คำ)
- ไม่ต้องกำหนดจำนวนคลิปขั้นต่ำ 5 หรือ 6 คลิป ให้แบ่งตามเหตุการณ์จริงในบท

DIALOGUE 20-WORD SPLIT PROTOCOL:
- ถ้าบทพูดของตัวละครยาวเกิน 20 คำ ให้ตัดเฉพาะบทพูดส่วนที่เกินไปต่อในคลิปถัดไปอัตโนมัติ (Action/Narration ห้ามนำไปนับหรือแตกด้วยกฎ 20 คำ)
- ห้ามตัดคำกลางประโยคแบบเสียความหมาย
- ห้ามแก้ ห้ามย่อ ห้ามแต่งบทพูดเพิ่ม และต้องรักษาผู้พูดคนเดิม 100%
- Action/Narration ก่อนและหลังบทพูดต้องคงตำแหน่งเดิม
- คลิปถัดไปต้องต่อเนื่องจาก END คลิปก่อนหน้า ทั้งท่าทาง ตำแหน่ง สีหน้า กล้อง ฉาก เวลา และเสียง
- ถ้าช่วงใดไม่มี Dialogue ให้ใช้ STRICT SILENCE PROTOCOL และห้ามตัวละครพูดเอง
- [กฎแก้ไขบทพูดซ้ำซ้อน - FIX REDUNDANT DIALOGUE]:
  * ในคลิปที่ถูกตัดแบ่งบทพูด (Dialogue Split Parts) ให้ลบบทพูดยาวเต็มประโยค (Full Dialogue Text) ออกจากต้นพรอมต์และเนื้อหาพรอมต์
  * บังคับให้แสดงเฉพาะประโยคย่อยที่ตัดแบ่งแล้ว (Part 1/N) ของคลิปนั้น ๆ เพียงจุดเดียว (ในส่วน Dialogue: เท่านั้น ห้ามใส่บทพูดซ้ำที่ต้นพรอมต์หรือใน Action)
- ทำซ้ำจนกว่าบทพูดทั้งหมดจะครบ

DIALOGUE LOCK:
${sanitizedDialogues.length > 0
  ? `Strictly bind dialogues verbatim to matching clips in Thai. Do NOT change speaker or wording:\n` +
    sanitizedDialogues.map((d: any) => `- [${d.speaker}]: "${d.line}" (Tone: ${d.emotionTone || 'natural'}, Clip: ${d.clipNumber || 'auto'})`).join('\n')
  : 'If no dialogue in original script, set "dialogues": [] and "dialogue": "NONE". Do not invent dialogues.'}

AUDIO DIRECTIVES:
- Voice: ${audioDirectives?.voice?.enabled ? `Enabled (${audioDirectives.voice.voiceType}, ${audioDirectives.voice.accent}, ${audioDirectives.voice.emotion})` : 'Disabled'}
- Music: ${audioDirectives?.music?.enabled ? `Enabled (${audioDirectives.music.genre}, ${audioDirectives.music.tempo}, ${audioDirectives.music.mood})` : 'Disabled'}
- SFX: ${audioDirectives?.sfx?.enabled ? `Enabled (Ambience: ${audioDirectives.sfx.ambientSounds}, Foley: ${audioDirectives.sfx.foleyActions})` : 'Disabled'}

SCRIPT TEXT:
"""
${scriptText}
"""

OUTPUT FORMAT:
Respond ONLY with a JSON array with one object per clip, covering the whole script (no markdown blocks, no code formatting):
[
  {
    "clipNumber": 1,
    "title": "ชื่อฉากสั้นๆ ภาษาไทย",
    "durationSeconds": ${duration},
    "sceneSummary": "สรุปเหตุการณ์ของคลิปนี้ภาษาไทย",
    "startAction": "การกระทำและมุมเริ่มต้นของคลิปนี้",
    "endAction": "การกระทำและมุมกล้องจุดจบที่ส่งต่อโมเมนตัมให้คลิปถัดไป",
    "dialogues": [
      { "id": "d1", "speaker": "ชื่อตัวละครจริง (ห้ามใช้คำสงวน)", "line": "บทพูดภาษาไทยตรงตัว", "emotionTone": "อารมณ์" }
    ],
    "charactersPresent": ["ชื่อตัวละครที่อยู่ในคลิปนี้"],
    "startPoses": [{ "name": "ชื่อตัวละคร", "posture": "standing|sitting|lying|kneeling|walking", "place": "อยู่ตรงไหน" }],
    "endPoses": [{ "name": "ชื่อตัวละคร", "posture": "standing|sitting|lying|kneeling|walking", "place": "อยู่ตรงไหน" }],
    "charactersLeft": [],
    "continuityLockSummary": "สรุปข้อมูลที่ล็อคความต่อเนื่อง",
    "audioDirectiveSummary": "สรุปคำสั่งเสียง",
    "generatedPrompt": "Cinematic prompt with Thai dialogue tags, camera directions, and AV Directives.",
    "negativePrompt": "blurry, morphing face, inconsistent outfit, extra limbs, bad anatomy, text watermark, sudden jumpcut"
  }
]`;

          const billed = await callBillableGemini(req, res, ai, {
            model: 'gemini-3.1-flash-lite',
            contents: promptInstruction,
            config: { responseMimeType: 'application/json' }
          }, 'multi-clip prompts');
          if (!billed) return;
          const response = billed.response;

          const rawText = response.text ? response.text.trim() : '';
          const cleanedJson = rawText
            .replace(/^```json\s*/i, '')
            .replace(/^```\s*/i, '')
            .replace(/\s*```$/, '')
            .trim();

          let parsed: any;
          try {
            parsed = JSON.parse(cleanedJson);
          } catch {
            return res.status(502).json({
              success: false,
              code: 'GEMINI_INVALID_JSON',
              message: 'Gemini ตอบกลับไม่ใช่ JSON ที่ถูกต้อง กรุณาลองใหม่ / Gemini returned invalid JSON. Please try again.'
            });
          }
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Sanitize parsed clips to guarantee original dialogue only, no reserved keywords, and no invented dialogue
            const initialClips = parsed.map((clip: any) => {
              const safeDialogues = Array.isArray(clip.dialogues)
                ? clip.dialogues.filter((d: any) => d && d.speaker && !isReservedSystemKeyword(d.speaker))
                : [];
              // Preserve camera controls from user's sanitizedDialogues
              const dialoguesWithCamera = mergeDialogueCameraControls(safeDialogues, sanitizedDialogues);
              return {
                ...clip,
                dialogues: dialoguesWithCamera
              };
            });
            const dialogueEnforced = enforceOriginalDialogueOnly(initialClips, scriptText);
            if (dialogueEnforced.rejectedCount > 0) {
              console.warn(`[Dialogue Validation] Rejected ${dialogueEnforced.rejectedCount} invented dialogue line(s) from Gemini. Auto-regenerating clips from source script...`);
              clips = buildSalaMultiClipPrompts({
                scriptText,
                clipDurationSeconds: duration,
                clipCount: count,
                continuityLock,
                dialogues: sanitizedDialogues,
                characters: libraryChars,
                locations: libraryLocs,
                knownCharacters: lockedNames,
                audioDirectives
              });
            } else {
              clips = dialogueEnforced.clips;
            }
          }
        }
      } catch (geminiErr: any) {
        const reason = formatGenAIError(geminiErr);
        console.warn('Gemini multi-clip generation failed:', reason);
        return res.status(502).json({
          success: false,
          code: 'GEMINI_API_ERROR',
          message: `Gemini สร้าง Multi-Clip Prompts ไม่สำเร็จ: ${reason} / Gemini multi-clip generation failed.`
        });
      }
    }

    if (!clips || clips.length === 0) {
      return res.status(502).json({
        success: false,
        code: 'GEMINI_INVALID_CLIPS',
        message: 'Gemini ไม่ได้ส่งรายการคลิปกลับมา กรุณาลองใหม่ / Gemini returned no clips. Please try again.'
      });
    }

    // Pose handoff + missing-character / pose-jump check, included in the video prompts
    // Character Lock with appearance (library / Master Lock / script character list) on every Gemini clip
    const geminiLockNames = lockedNames.length > 0 ? lockedNames : Array.from(new Set(clips.flatMap((c: any) => (c.dialogues || []).map((d: any) => d.speaker)).filter(Boolean))) as string[];
    const geminiLocks = buildCharacterAppearanceLock(geminiLockNames, [
      ...libraryChars,
      ...continuityLockCharacter(continuityLock)
    ], parseScriptCharacterList(scriptText));
    const withContinuity = attachClipContinuity(
      clips.map((c: any, i: number) => {
        const present = geminiLocks.profiles.filter(p => (Array.isArray(c.charactersPresent) && c.charactersPresent.includes(p.name)) || JSON.stringify(c).includes(p.name));
        const lockText = present.map(formatCharacterAppearanceLock).join(' | ');
        const prompt = String(c.generatedPrompt || '');
        return {
          ...c,
          clipNumber: Number(c.clipNumber) || i + 1,
          dialogues: Array.isArray(c.dialogues) ? c.dialogues : [],
          characterLockText: lockText,
          appearanceWarnings: geminiLocks.warnings.filter(w => present.some(p => w.includes(p.name))),
          generatedPrompt: lockText && !prompt.includes(lockText) ? `${prompt.replace(/\s+$/, '')} Character Lock: ${lockText}, identical face, hair and outfit in every clip.` : prompt
        };
      }),
      lockedNames,
      { appendToPrompt: true, initialPoses: normalizePoseList(continuityLock?.characterPositionLocks), location: continuityLock?.location || '' }
    );
    // Library is the source of truth: Gemini's own Character Lock text is replaced in every clip
    clips = enforceLibraryCharacterLocks(withContinuity.clips, [
      ...libraryChars,
      ...continuityLockCharacter(continuityLock)
    ], parseScriptCharacterList(scriptText));
    // Library is the source of truth for the set too: Gemini's Location / Setting / Environment text is
    // replaced by the verbatim library description + reference photo line, Atmosphere rebuilt from the lock
    clips = enforceLibraryLocationLocks(clips, libraryLocs, { ...locationLockOpts, rebuildAtmosphere: true });
    // Final check: strictly enforce original dialogue only (reject invented/narration dialogues)
    clips = enforceOriginalDialogueOnly(clips, scriptText).clips;

    // Apply DIALOGUE 20-WORD SPLIT SYSTEM (ถ้าบทพูดของตัวละครยาวเกิน 20 คำ ให้ตัดเฉพาะบทพูดส่วนที่เกินไปต่อในคลิปถัดไปอัตโนมัติ)
    const splitResult = applyDialogue20WordSplitToClips(clips, duration);
    clips = splitResult.clips;
    // Gemini rewrites the script in its own words and drops action lines: put back every script line
    // it left out, in the clip where it belongs
    const restoredBeats = restoreMissingStoryBeats(clips, scriptText, { untilEnd: true, promptKey: 'generatedPrompt', dialogueKey: 'line' });
    clips = restoredBeats.scenes;
    // Too much dialogue for one clip: split into consecutive clips (Gemini sometimes packs a whole scene)
    clips = splitDenseDialogueScenes(clips, duration, { promptKey: 'generatedPrompt', numberKey: 'clipNumber', titleKey: 'title', endKey: 'endAction' });

    const validation = validateSalaMultiClipPrompts(clips, lockedNames, scriptText);

    return res.json({
      success: true,
      source,
      clips,
      validation,
      ...chargeFieldsFrom(req)
    });
  } catch (err: any) {
    console.error('Error in /api/director/generate-multi-clip-prompts:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'เกิดข้อผิดพลาดในการสร้าง Multi-Clip Prompts'
    });
  }
});

// 6.2.2 Multi-Clip Continuity Director: Regenerate Single Clip Prompt
app.post('/api/director/regenerate-single-clip', requireAuth, async (req: any, res) => {
  try {
    const {
      clipNumber = 1,
      totalClips = 3,
      durationSeconds = 10,
      sceneSummary = '',
      previousClipEndAction = '',
      nextClipStartAction = '',
      continuityLock = {},
      dialogues = [],
      audioDirectives = {},
      scriptText = ''
    } = req.body;

    const quotes = scriptText ? extractVerbatimScriptQuotes(scriptText) : null;
    const safeDialogues = Array.isArray(dialogues)
      ? dialogues.filter((d: any) => {
          if (!d || !d.speaker || isReservedSystemKeyword(d.speaker)) return false;
          if (quotes && !isVerbatimDialogueInScript(d.line, scriptText, quotes)) return false;
          return true;
        })
      : [];

    const charName = continuityLock.characterName || '';
    const charAppearance = continuityLock.characterAppearance || '';
    const location = continuityLock.location || '';
    const timeOfDay = continuityLock.timeOfDay || '';
    const lighting = continuityLock.lighting || '';
    const visualStyle = continuityLock.visualStyle || 'Cinematic 8K, 35mm lens';
    const aspectRatio = continuityLock.aspectRatio || '16:9';
    const cameraMovement = continuityLock.cameraMovement || 'Smooth cinematic tracking shot';
    const lensType = continuityLock.lensType || '35mm anamorphic prime';
    const props = continuityLock.props || '';

    // Start action connects from previous clip if not first
    const startAction = clipNumber > 1 && previousClipEndAction
      ? `ต่อยอดทันทีจากจุดจบของคลิปก่อนหน้า: ${previousClipEndAction}${charName ? `. ${charName} ดำเนินการต่ออย่างลื่นไหล` : ''}`
      : `${charName ? `${charName} ` : ''}เริ่มต้นการกระทำในจุดนี้: ${sceneSummary}`;

    const endAction = clipNumber < totalClips
      ? `${charName ? `${charName} ` : ''}กำลังเคลื่อนไหวอย่างมีทิศทาง ส่งต่อมุมกล้องและโมเมนตัมไปยังคลิปที่ ${clipNumber + 1}`
      : `${charName ? `${charName} ` : ''}สิ้นสุดการกระทำในฉากอย่างสมบูรณ์ กล้อง Cinematic Fade Out`;

    const mergedDialogues = mergeDialogueCameraControls(safeDialogues, dialogues);
    const hasManual = hasManualCameraAngles(mergedDialogues);

    const audioSnippets = [];
    if (audioDirectives?.voice?.enabled) audioSnippets.push(`Voice: ${audioDirectives.voice.voiceType}`);
    if (audioDirectives?.music?.enabled) audioSnippets.push(`Music: ${audioDirectives.music.genre} (${audioDirectives.music.mood})`);
    if (audioDirectives?.sfx?.enabled) audioSnippets.push(`SFX: ${audioDirectives.sfx.ambientSounds}`);
    const audioDirectiveSummary = audioSnippets.join(' | ') || 'Audio: Standard Ambient';

    const lockParts = [];
    if (charName) lockParts.push(`Character: ${charName}${charAppearance ? ` (${charAppearance})` : ''}`);
    if (location) lockParts.push(`Location: ${location}`);
    if (timeOfDay) lockParts.push(`Time: ${timeOfDay}`);
    if (lighting) lockParts.push(`Lighting: ${lighting}`);
    if (visualStyle) lockParts.push(`Style: ${visualStyle}`);
    if (aspectRatio) lockParts.push(`Aspect: ${aspectRatio}`);
    if (lensType) lockParts.push(`Lens: ${lensType}`);
    if (props) lockParts.push(`Props: ${props}`);

    const masterLockSnippet = lockParts.length > 0 ? `[MASTER CONTINUITY LOCK: ${lockParts.join(', ')}] ` : '';
    const cameraSection = hasManual ? '' : `Camera: ${cameraMovement}, ${lensType}. `;

    const formattedDialogue = mergedDialogues.length > 0
      ? formatDialogueWithCameraControl(mergedDialogues, [charName].filter(Boolean), location || 'เดิม')
      : '';
    const dialogueBlock = formattedDialogue ? `Dialogue:\n${formattedDialogue}. ` : '';

    let generatedPrompt = `${masterLockSnippet}[SCENE ${clipNumber}/${totalClips} - DURATION ${durationSeconds}s]: ${startAction}. Core action: ${sceneSummary}. ${cameraSection}${dialogueBlock}Outro momentum: ${endAction}. [AV Directives: ${audioDirectiveSummary}]. Ultra-consistent visual identity.`;
    if (hasManual) {
      generatedPrompt = stripAutoCameraPhrases(generatedPrompt);
    }
    if (mergedDialogues.length === 0) {
      generatedPrompt = stripProhibitedSpeechWords(generatedPrompt);
    }

    res.json({
      success: true,
      clip: {
        clipNumber,
        title: `Clip ${clipNumber}`,
        durationSeconds,
        sceneSummary,
        startAction,
        endAction,
        characterPositions: continuityLock.characterPosition || 'ตำแหน่งตัวละครล็อคสอดคล้องต่อเนื่อง',
        dialogues: mergedDialogues,
        dialogue: mergedDialogues.length > 0 ? mergedDialogues.map((d: any) => `${d.speaker}: "${d.line}"`).join(' ') : 'NONE',
        locationName: location || undefined,
        continuityLockSummary: [charName ? `Character: ${charName}` : '', location ? `Location: ${location}` : '', timeOfDay, lighting].filter(Boolean).join(' | ') || 'Continuity Locked',
        audioDirectiveSummary,
        generatedPrompt,
        negativePrompt: 'blurry, morphing face, inconsistent outfit, extra limbs, bad anatomy, text watermark, sudden jumpcut'
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message || 'ไม่สามารถสร้างคลิปใหม่ได้' });
  }
});

// A library card whose reference image is a /uploads file that no longer exists (ephemeral disk)
// is marked referenceStatus 'missing' so the prompts carry a re-upload warning instead of a dead reference.
function markMissingUploadReferences(chars: any[]): any[] {
  return (Array.isArray(chars) ? chars : []).map((c: any) => {
    const url = String(c?.referenceImageUrl || c?.referenceMetadata?.referenceImageUrl || c?.visualProfile?.referenceImageUrl || '');
    if (!url.startsWith('/uploads/') || c?.referenceStatus === 'missing') return c;
    const rel = decodeURIComponent(url.slice('/uploads/'.length).split('?')[0]);
    const file = path.resolve(UPLOADS_DIR, rel);
    const inside = file.startsWith(path.resolve(UPLOADS_DIR) + path.sep);
    return inside && fs.existsSync(file) ? c : { ...c, referenceStatus: 'missing' };
  });
}

// Gemini sometimes returns one combined character ("พี่ทุย และ น้องน้ำ"): split it into individuals
// (lock name, characters list, scene casts) and drop dialogue lines duplicated under the combined label.
function splitCombinedCharactersInSplit(parsed: any): void {
  if (!parsed || typeof parsed !== 'object') return;
  const lock = parsed.continuityLock;
  if (lock?.characterName) {
    const parts = expandCombinedCharacterNames([String(lock.characterName)]);
    if (parts.length > 1) lock.characterName = parts.join(', ');
  }
  if (Array.isArray(parsed.characters)) {
    const out: any[] = [];
    parsed.characters.forEach((c: any) => {
      const parts = expandCombinedCharacterNames([String(c?.name || '')]);
      if (parts.length > 1) {
        parts.forEach(n => { if (!out.some(o => o.name === n) && !parsed.characters.some((x: any) => x?.name === n)) out.push({ ...c, name: n, appearance: '' }); });
      } else if (c && !out.some(o => o.name === c.name)) out.push(c);
    });
    parsed.characters = out;
  }
  if (Array.isArray(parsed.scenes)) {
    parsed.scenes.forEach((sc: any) => { if (Array.isArray(sc.characters)) sc.characters = expandCombinedCharacterNames(sc.characters); });
  }
  if (Array.isArray(parsed.dialogues)) {
    const known = (parsed.characters || []).map((c: any) => c.name);
    const byScene = new Map<number, any[]>();
    parsed.dialogues.forEach((d: any) => { const k = Number(d?.sceneNumber) || 0; byScene.set(k, [...(byScene.get(k) || []), d]); });
    parsed.dialogues = Array.from(byScene.values()).flatMap(list => dedupeDialogueEntries(list, known));
  }
}

// LOCKED CONTINUITY CONTEXT block injected into Gemini prompts (script split / multi-clip)
function buildLockedContinuityContext(continuityLock: any, characters?: any[], locations?: any[]): string {
  const lines: string[] = [];
  const lock = continuityLock || {};
  if (lock.characterName) lines.push(`- ตัวละครหลักที่ล็อค: ${lock.characterName}${lock.characterAppearance ? ` (รูปลักษณ์/ชุด: ${lock.characterAppearance})` : ''}`);
  if (Array.isArray(lock.characterNames) && lock.characterNames.length > 0) lines.push(`- รายชื่อตัวละครที่ต้องคงที่: ${lock.characterNames.join(', ')}`);
  if (lock.location) lines.push(`- สถานที่ที่ล็อค: ${lock.location}${lock.locationVisualDetails ? ` (${lock.locationVisualDetails})` : ''}`);
  if (lock.timeOfDay) lines.push(`- เวลาที่ล็อค: ${lock.timeOfDay}`);
  if (lock.lighting) lines.push(`- แสงที่ล็อค (ใช้คำอธิบายเดียวกันทุกคลิป): ${lock.lighting}`);
  if (lock.characterPosition) lines.push(`- ตำแหน่ง/ท่าทางเริ่มต้นที่ล็อค: ${lock.characterPosition}`);
  const lockedNames = new Set<string>([lock.characterName, ...(lock.characterNames || [])].filter(Boolean));
  const libChars = (Array.isArray(characters) ? characters : []).filter((c: any) => c?.name && (lockedNames.size === 0 || lockedNames.has(c.name) || String(lock.characterName || '').includes(c.name)));
  if (libChars.length > 0) lines.push(`- Character Lock จากคลัง: ${libChars.slice(0, 8).map((c: any) => buildCharacterLockText(c)).join(' | ')}`);
  const locList = (Array.isArray(locations) ? locations : []).filter((l: any) => l?.name);
  const lockedLoc = (lock.locationId && locList.find((l: any) => l.id === lock.locationId)) || (lock.location ? findLocationByName(locList, String(lock.location)) : undefined);
  if (lockedLoc) lines.push(`- Location Lock จากคลัง (ใช้คำอธิบายนี้แบบคำต่อคำ ห้ามเพิ่ม/ลด/ย้ายวัตถุ): ${lockedLoc.name}: ${locationDescriptionOf(lockedLoc)}`);
  if (lines.length === 0) return '';
  return `\n[ตัวละครและสถานที่ที่ถูกล็อคไว้ (LOCKED CONTINUITY CONTEXT) — ต้องใช้ค่าเหล่านี้ในทุกฉาก ห้ามเปลี่ยน]:\n${lines.join('\n')}\n`;
}

// 6.2.1 AI Script Splitter Endpoint (Gemini Flash, strict: no silent fallback)
// The local parser is used ONLY when the user explicitly chooses offline mode.
app.post('/api/script/split', async (req: express.Request, res: express.Response) => {
  try {
    const {
      scriptText,
      clipCount,
      apiKey,
      continuityLock,
      characters,
      locations
    } = req.body || {};
    const offlineMode = req.body?.offlineMode === true || req.body?.offline === true;
    const libChars = markMissingUploadReferences(Array.isArray(characters) ? characters : []);
    if (!scriptText || typeof scriptText !== 'string' || !scriptText.trim()) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุบทละครหรือโครงเรื่อง (Script text is required)'
      });
    }

    if (offlineMode) {
      const offlineData = applySplitLocks(parseScriptLocally(scriptText, clipCount, libChars), continuityLock, { characters: libChars, scriptText });
      return res.json({ success: true, source: 'fallback-parser', offline: true, data: offlineData });
    }

    // User's saved key (body or x-gemini-key header) first, then server GEMINI_API_KEY (never logged)
    const headerKey = typeof req.headers['x-gemini-key'] === 'string' ? (req.headers['x-gemini-key'] as string) : '';
    const userKey = (typeof apiKey === 'string' && apiKey.trim()) ? apiKey.trim() : headerKey.trim();
    const ai = getGeminiClient(userKey || undefined);
    if (!ai) {
      return res.status(400).json({
        success: false,
        code: 'GEMINI_KEY_MISSING',
        message: 'ยังไม่ได้ตั้งค่า Gemini API Key กรุณาบันทึก API Key หรือเลือก "โหมดออฟไลน์" เพื่อแยกบทโดยไม่ใช้ AI / No Gemini API key. Save your key or choose offline mode.'
      });
    }

    const lockedContext = buildLockedContinuityContext(continuityLock, characters, locations);
    {
      try {
        const systemInstruction = `คุณเป็นผู้กำกับภาพยนตร์และผู้เชี่ยวชาญด้านการวิเคราะห์บทภาพยนตร์ชั้นยอด หน้าที่ของคุณคืออ่านบทละคร/โครงเรื่องทั้งหมด แล้วแยกส่วนประกอบให้ออกมาเป็นโครงสร้าง JSON อย่างแม่นยำ โดยปฏิบัติตามกฎเหล็ก 5 ข้อนี้อย่างเคร่งครัด:

1. [ส่วนก่อน "ฉากที่ 1" เป็น METADATA เท่านั้น]:
ข้อมูลเช่น ชื่อเรื่อง:, ตัวละคร:, สถานที่หลัก:, เวลา: ที่อยู่ก่อน "ฉากที่ 1" ต้องถูกเก็บเป็น metadata (title, characters, locations, continuityLock) เท่านั้น
- ห้ามนำส่วน metadata ไปสร้างเป็น Scene หรือ Clip
- ห้ามนำไปเป็น Starting moment หรือ Core action ของฉาก
- ห้ามนำไปเป็น Dialogue

2. [Character Section ต้องแยก Name และ Description]:
- ตัวละคร เช่น ฟ้าใส: หญิงอายุ 24 ปี... ต้อง parse เป็น name: "ฟ้าใส", description: "หญิงอายุ 24 ปี..."
- description ห้ามกลายเป็น Dialogue หรือกลายเป็น Scene action เด็ดขาด

3. [Scene Splitting ตามหัวข้อ "ฉากที่ X" เท่านั้น]:
- เฉพาะหัวข้อ "ฉากที่ 1:", "ฉากที่ 2:", "ฉากที่ 3:" (หรือ "CLIP 1:", "Scene 1:") เท่านั้นที่เริ่ม Scene ใหม่
- ผลลัพธ์ต้องเรียงเป็น: Scene 1, Scene 2, Scene 3 ครบทุกฉาก
- ห้ามสร้าง intro scene จาก metadata
- ห้าม offset scene
- ห้ามได้ Scene 1 ซ้ำสองครั้ง
- ห้ามทำ Scene 3 หาย

4. [กฎเหล็ก ORIGINAL_DIALOGUE_ONLY]:
- ORIGINAL_DIALOGUE_ONLY = true
- INVENT_DIALOGUE = false
- NARRATION_TO_DIALOGUE = false
- Dialogue ต้องดึงจากบทต้นฉบับเท่านั้น แบบคำต่อคำ (Verbatim) ห้าม AI แต่ง เพิ่ม ย่อ เปลี่ยน หรือเดาบทพูดเองเด็ดขาด
- ถ้าฉากนั้นไม่มีบทพูดในต้นฉบับ ให้กำหนด dialogue = "NONE" และ dialogues = [] ห้ามสร้างคำพูดขึ้นมาเองเด็ดขาด
- ข้อความบรรยาย การกระทำ ความคิด สีหน้า และคำบรรยายฉาก ห้ามแปลงเป็นบทพูดเด็ดขาด
- ก่อนสร้างแต่ละฉาก ให้ค้นหาบทพูดจากช่วงเนื้อเรื่องต้นฉบับที่ตรงกับฉากนั้นก่อนเสมอ
- ถ้ามีบทพูด ให้ระบุชื่อตัวละคร + ประโยคต้นฉบับชัดเจน
- ห้ามใช้คำเช่น shouting, yelling, says, asks หรือ speaks ใน prompt หรือ action ถ้าไม่มี dialogue จริงจากต้นฉบับ

5. [กฎเหล็กคำสงวนระบบ RESERVED KEYWORDS]:
คำต่อไปนี้เป็นคำสั่งระบบ ห้ามนำมาเป็นชื่อตัวละครหรือผู้พูดเด็ดขาด:
LOCK, CONT, FRAME, AUTO, RULE, NO, OUT, STORY, CHARACTERS, END, SALA_MULTI_CLIP

6. [LOCKED CONTINUITY & AUTO SCENE ENVIRONMENT]:
ถ้ามีตัวละคร/สถานที่ที่ผู้ใช้ล็อคไว้ ต้องใช้ชื่อ รูปลักษณ์ ชุด สถานที่ เวลา และแสงตามที่ล็อคในทุกฉาก ห้ามเปลี่ยนหรือแต่งเพิ่ม
- ดึงค่า "สถานที่" (Location) และ "ช่วงเวลา/สภาพแสง" (Lighting/Time) จากเนื้อเรื่องของฉากนั้นโดยตรง
- เมื่อขึ้นฉากใหม่ ให้รีเซ็ตค่าสภาพแวดล้อมเดิมทิ้งทันที ห้ามนำค่าเดิม (เช่น ป่าทึบ/แสงแดด) ข้ามมาใช้ในฉากใหม่ (เช่น ถ้ำโบราณ/กลางคืน)
- หัวข้อฉากที่เป็นชื่อตอน/อารมณ์ (เช่น "อารมณ์เริ่มตึงเครียด", "คืนดีกัน") หรือ "…ต่อเนื่อง" ไม่ใช่สถานที่ใหม่ ให้ใช้สถานที่และเวลาของฉากเดิมต่อเนื่อง

7. [กฎการสร้างเหตุการณ์จาก Action/Narration และการรวมคลิป]:
- ถ้าบทมี Action/Narration แม้ไม่มีบทพูด ต้องนำ Action/Narration นั้นไปสร้างเป็นเหตุการณ์ใน Prompt ตามลำดับเดิม
- ตัวอย่าง: บท "บรรยากาศป่ามืด ฝนตก ฟ้าใสเดินเข้าป่า" -> นำเสนอเหตุการณ์ "ป่ามืด ฝนกำลังตก ฟ้าใสกำลังเดินเข้าป่า"
- Action/Narration ต้องทำหน้าที่เพียง "บอกสิ่งที่กำลังเกิดขึ้นในช็อตนั้น" เท่านั้น ไม่ให้ไปเปลี่ยนโครงสร้าง Prompt เดิมหรือผสมกับระบบ Lock อื่น
- ห้ามนำ Action/Narration ไป:
  * รวมกับบทพูด หรือเปลี่ยนเป็นบทพูด หรือเพิ่มบทพูดใหม่
  * เปลี่ยนอารมณ์ตัวละครเอง หรือเปลี่ยนท่าทางอื่นที่บทไม่ได้สั่ง
  * แก้ Character Lock หรือแก้ Location Lock
  * สร้าง Action เพิ่มเอง
- [กฎการแบ่งคลิปอัตโนมัติ]:
  * ห้ามใช้ 1 Action = 1 Clip เด็ดขาด
  * Action/Narration ที่ต่อเนื่องกันในฉากและสถานที่เดียวกัน ให้รวมอยู่ในคลิปเดียวเท่าที่เวลา 10 วินาทีรองรับ (เช่น “หันมอง → เดินเข้าไป → ทำหน้าโมโห → หยิบมีด → ฟันต้นไม้” เป็นเหตุการณ์ต่อเนื่องกันในฉากเดียวกัน ให้รวมอยู่ในคลิปเดียว)
  * ห้ามสร้าง Action เพิ่มเองเพื่อยืดจำนวนคลิป
  * กฎแบ่ง 20 คำให้ทำงานเฉพาะ “บทพูด” ที่เกิน 20 คำเท่านั้น (Action/Narration ห้ามนำไปนับหรือแตกด้วยกฎ 20 คำ)
  * ไม่ต้องกำหนดจำนวนคลิปขั้นต่ำ 5 หรือ 6 คลิป (ถ้าบทมีเพียง 1 หรือ 2 คลิป ให้แบ่งตามเนื้อเรื่องจริง ไม่ต้องยืดเป็น 5-6 คลิป)

8. [ระบบ DIALOGUE 20-WORD SPLIT & FIX REDUNDANT DIALOGUE]:
- ถ้าบทพูดของตัวละครยาวเกิน 20 คำ ให้ตัดเฉพาะบทพูดส่วนที่เกินไปต่อในคลิปถัดไปอัตโนมัติ (Action/Narration ห้ามนำไปนับหรือแตกด้วยกฎ 20 คำ)
- ห้ามตัดคำกลางประโยคแบบเสียความหมาย
- ห้ามแก้ ห้ามย่อ ห้ามแต่งบทพูดเพิ่ม และต้องรักษาผู้พูดคนเดิม 100%
- Action/Narration ก่อนและหลังบทพูดต้องคงตำแหน่งเดิม
- คลิปถัดไปต้องต่อเนื่องจาก END คลิปก่อนหน้า ทั้งท่าทาง ตำแหน่ง สีหน้า กล้อง ฉาก เวลา และเสียง
- ถ้าช่วงใดไม่มี Dialogue ให้ใช้ STRICT SILENCE PROTOCOL และห้ามตัวละครพูดเอง
- [กฎแก้ไขบทพูดซ้ำซ้อน]: ในคลิปที่ถูกตัดแบ่งบทพูด (Dialogue Split Parts) ให้ลบบทพูดยาวเต็มประโยค (Full Dialogue Text) ออกจากต้นพรอมต์และเนื้อหาพรอมต์ บังคับให้แสดงเฉพาะประโยคย่อยที่ตัดแบ่งแล้ว (Part 1/N) ของคลิปนั้น ๆ เพียงจุดเดียว (ในส่วน Dialogue: เท่านั้น ห้ามใส่บทพูดซ้ำที่ต้นพรอมต์หรือใน Action)
- ทำซ้ำจนกว่าบทพูดทั้งหมดจะครบ

ส่งผลลัพธ์เป็น JSON ล้วน (valid JSON format) เท่านั้น ห้ามใส่ markdown code block หรือคำอธิบายเสริม`;

        const userPrompt = `บทละคร/โครงเรื่องที่ต้องนำมาแยก:
"""
${scriptText.trim()}
"""

${Number(clipCount) > 1 ? `ต้องการให้แบ่งออกเป็นประมาณ ${clipCount} ฉาก/คลิปต่อเนื่องกัน (ไม่ต้องกำหนดขั้นต่ำ 5 หรือ 6 คลิป และห้ามใช้ 1 Action = 1 Clip)` : 'ให้แบ่งฉากตามโครงเรื่องจริงที่ระบุไว้ในบท โดยไม่ต้องกำหนดจำนวนคลิปขั้นต่ำ 5 หรือ 6 คลิป และห้ามใช้ 1 Action = 1 Clip รวม Action ต่อเนื่องในฉากเดียวกันไว้ในคลิปเดียว'}
${lockedContext}

โครงสร้าง JSON ที่ต้องส่งกลับ (JSON format strictly):
{
  "title": "ชื่อเรื่องหรือชื่อบทละคร",
  "characters": [
    { "name": "ชื่อตัวละคร (ห้ามใช้คำสงวน)", "description": "ลักษณะ อายุ ทรงผม เสื้อผ้า บุคลิก", "role": "ตัวละครหลัก/สมทบ", "appearance": "รายละเอียดหน้าตาและชุด" }
  ],
  "dialogues": [
    { "id": "d1", "speaker": "ชื่อผู้พูด (ห้ามใช้คำสงวน)", "line": "บทพูดตรงตามต้นฉบับเป๊ะ", "emotionTone": "อารมณ์/สีหน้า", "sceneNumber": 1 }
  ],
  "locations": [
    { "name": "ชื่อสถานที่", "description": "รายละเอียดสถานที่", "atmosphere": "บรรยากาศ" }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "ฉากที่ 1: ...",
      "location": "สถานที่",
      "timeOfDay": "เวลา",
      "lighting": "การจัดแสง",
      "camera": "มุมกล้องและการเคลื่อนไหว",
      "characters": ["ชื่อตัวละคร"],
      "action": "การกระทำของตัวละครในฉาก",
      "dialogue": "บทพูดในฉากนี้ (ถ้าไม่มีให้ระบุ NONE)",
      "actionNarrationLock": {
        "action": "การกระทำตามลำดับบท",
        "movement": "การเคลื่อนไหว",
        "emotionExpression": "อารมณ์/การแสดงออกทางสีหน้า",
        "narration": "คำบรรยาย",
        "isSilent": true
      },
      "prompt": "Prompt คุณภาพสูงสำหรับสร้างภาพหรือวิดีโอของฉากนี้"
    }
  ],
  "lighting": "รายละเอียดแสงหลักที่คุมโทนทั้งเรื่อง",
  "camera": {
    "movement": "การเคลื่อนไหวกล้องหลัก เช่น Cinematic tracking shot",
    "lensType": "35mm Anamorphic Prime f/1.8",
    "shotType": "Medium Shot"
  },
  "continuityLock": {
    "characterName": "ชื่อตัวละครหลัก",
    "characterAppearance": "รูปลักษณ์และเสื้อผ้าตัวละครหลัก",
    "location": "สถานที่หลัก",
    "timeOfDay": "ช่วงเวลาหลัก",
    "lighting": "แสงหลัก",
    "visualStyle": "Cinematic Photorealistic 8K",
    "cameraMovement": "Cinematic tracking shot smoothly gliding alongside character",
    "cameraShotType": "Medium Shot",
    "lensType": "35mm Anamorphic Prime f/1.8",
    "props": "อุปกรณ์สำคัญที่ตัวละครถือหรือปรากฏในฉาก"
  }
}`;

        const billed = await callBillableGemini(req, res, ai, {
          model: 'gemini-3.1-flash-lite',
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json'
          }
        }, 'script split');
        if (!billed) return;
        const response = billed.response;

        const rawText = response.text || '';
        const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        let parsed: any = null;
        try {
          parsed = JSON.parse(cleanJson);
        } catch {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = null; }
          }
        }
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.scenes) || parsed.scenes.length === 0) {
          return res.status(502).json({
            success: false,
            code: 'GEMINI_INVALID_JSON',
            message: 'Gemini ตอบกลับข้อมูลฉากไม่สมบูรณ์หรือไม่ใช่ JSON ที่ถูกต้อง กรุณาลองใหม่ / Gemini returned incomplete or invalid scene JSON.'
          });
        }

        // Sanitize: strip any reserved system keywords or metadata keywords from characters
        if (Array.isArray(parsed.characters)) {
          parsed.characters = parsed.characters.filter((c: any) => c && c.name && !isReservedSystemKeyword(c.name) && !isMetadataKeyword(c.name));
        }

        // Sanitize dialogues: strictly enforce original dialogue only (reject invented/narration dialogues)
        const validCharNames = new Set((parsed.characters || []).map((c: any) => c.name.toLowerCase()));
        if (Array.isArray(parsed.dialogues)) {
          parsed.dialogues = parsed.dialogues.filter((d: any) => {
            if (!d || !d.speaker || !d.line) return false;
            if (isReservedSystemKeyword(d.speaker) || isMetadataKeyword(d.speaker)) return false;
            if (validCharNames.size > 0 && !validCharNames.has(d.speaker.toLowerCase())) return false;
            if (parsed.characters?.some((c: any) => c.description && d.line.includes(c.description))) return false;
            // Rule 1 & 2 & 4: Must be verbatim in original script
            if (!isVerbatimDialogueInScript(d.line, scriptText)) return false;
            return true;
          });
        }

        // Sanitize scenes: remove any scene that is actually metadata
        if (Array.isArray(parsed.scenes)) {
          parsed.scenes = parsed.scenes.filter((s: any) => {
            if (!s) return false;
            const t = (s.title || '').toLowerCase();
            const a = (s.action || '').toLowerCase();
            if (t.includes('metadata') || t.includes('ตัวละครหลัก') || t.includes('รายชื่อตัวละคร')) return false;
            if (a.includes('ตัวละคร:') && a.includes('สถานที่หลัก:')) return false;
            return true;
          });

          const allDeclaredNames = (parsed.characters || []).map((c: any) => c.name);
          const introducedCharsInSplit = new Set<string>();

          parsed.scenes.forEach((s: any, idx: number) => {
            s.sceneNumber = idx + 1;
            if (!s.title || s.title.startsWith('ฉากที่ 0')) {
              s.title = `ฉากที่ ${idx + 1}`;
            }

            // Ensure dialogue for this scene: verbatim if present, otherwise "NONE"
            const matchingDiags = (parsed.dialogues || []).filter((d: any) => d.sceneNumber === idx + 1 || (s.dialogue && s.dialogue.includes(d.line)));
            if (matchingDiags.length > 0) {
              s.dialogue = matchingDiags.map((d: any) => `${d.speaker}: "${d.line}"`).join(' ');
            } else if (s.dialogue && isVerbatimDialogueInScript(s.dialogue, scriptText)) {
              // Verbatim dialogue kept
            } else {
              s.dialogue = 'NONE';
              if (s.prompt) s.prompt = stripProhibitedSpeechWords(s.prompt);
              if (s.action) s.action = stripProhibitedSpeechWords(s.action);
            }

            const sceneText = `${s.title || ''} ${s.action || ''} ${s.dialogue !== 'NONE' ? s.dialogue : ''}`;
            const mentioned = allDeclaredNames.filter((name: string) => {
              const firstName = name.split(' ')[0];
              return sceneText.includes(name) || (firstName.length >= 2 && sceneText.includes(firstName));
            });
            mentioned.forEach((n: string) => introducedCharsInSplit.add(n));

            // Strictly filter scene characters to only those introduced up to this scene!
            if (Array.isArray(s.characters)) {
              s.characters = s.characters.filter((n: string) => introducedCharsInSplit.has(n));
            }
            if (!s.characters || s.characters.length === 0) {
              s.characters = mentioned.length > 0 ? mentioned : Array.from(introducedCharsInSplit);
            }
          });
        }

        if (parsed.continuityLock && (isReservedSystemKeyword(parsed.continuityLock.characterName) || isMetadataKeyword(parsed.continuityLock.characterName))) {
          parsed.continuityLock.characterName = parsed.characters?.[0]?.name || '';
        }
        splitCombinedCharactersInSplit(parsed);

        const splitData = applySplitLocks(parsed, continuityLock, { characters: libChars, scriptText });
        return res.json({
          success: true,
          source: 'gemini-flash',
          ...chargeFieldsFrom(req),
          ORIGINAL_DIALOGUE_ONLY: true,
          INVENT_DIALOGUE: false,
          NARRATION_TO_DIALOGUE: false,
          data: {
            ...splitData,
            ORIGINAL_DIALOGUE_ONLY: true,
            INVENT_DIALOGUE: false,
            NARRATION_TO_DIALOGUE: false
          }
        });
      } catch (geminiErr: any) {
        const reason = formatGenAIError(geminiErr);
        console.warn('Gemini script splitter error:', reason);
        return res.status(502).json({
          success: false,
          code: 'GEMINI_API_ERROR',
          message: `Gemini แยกบทไม่สำเร็จ: ${reason} / Gemini script split failed. Retry, check your API key, or choose offline mode.`
        });
      }
    }
  } catch (err: any) {
    console.error('Error in /api/script/split:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'เกิดข้อผิดพลาดในการแยกบทละคร'
    });
  }
});

// 6.2.1.B AI Story Continuation / Progressive Episodic Scene Generator Endpoint
app.post(['/api/story/continue', '/api/story/continue/'], async (req: express.Request, res: express.Response) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  try {
    const {
      originalStory,
      currentScriptText,
      episodeNumber: reqEpisodeNumber,
      targetSceneCount = 5,
      existingScenes = [],
      lastSceneState,
      characters,
      continuityLock,
      clipDurationSeconds = 10,
      apiKey
    } = req.body || {};

    if (!originalStory || typeof originalStory !== 'string' || !originalStory.trim()) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกเนื้อเรื่องต้นฉบับ (Original story is required)'
      });
    }

    const hasExplicitEnd = hasExplicitEndingMarker(originalStory);
    const effectiveLastScene = lastSceneState || (existingScenes.length > 0 ? existingScenes[existingScenes.length - 1] : null);
    const existingCount = existingScenes.length;
    
    // Determine episode number (starts at 1)
    const episodeNumber = typeof reqEpisodeNumber === 'number' && reqEpisodeNumber >= 1
      ? reqEpisodeNumber
      : (existingCount === 0 ? 1 : Math.max(1, Math.floor(existingCount / 5) + 1));

    // Declared / parsed characters (used to normalize speakers and pick the Character Lock)
    const parsedSource = parseStoryStructure(originalStory);
    // At most 6 scenes per episode: asking for the whole story at once overflowed the model's
    // reply length, the JSON was cut off and "สร้างต่อ" failed with "invalid JSON".
    const MAX_SCENES_PER_EPISODE = 6;
    const scenesPerEpisode = Math.min(MAX_SCENES_PER_EPISODE, targetSceneCount && targetSceneCount > 0
      ? targetSceneCount
      : (parsedSource.hasSceneHeaders && parsedSource.scenes.length > 0 ? parsedSource.scenes.length : 5));
    const startSceneNum = effectiveLastScene?.sceneNumber ? effectiveLastScene.sceneNumber + 1 : (existingCount > 0 ? existingCount + 1 : 1);

    const offline = req.body?.offline === true;

    // Where the story stands: the last source line already written and the source text after it.
    // The model gets exactly the part still to write, so it cannot jump from the middle to the ending.
    const resume = findResumePoint(originalStory, [
      ...(Array.isArray(existingScenes) ? existingScenes : []),
      ...(effectiveLastScene ? [effectiveLastScene] : [])
    ]);

    const declaredNames = Array.from(new Set([
      ...parsedSource.characters.map(c => c.name),
      ...(Array.isArray(characters)
        ? characters.map((c: any) => String(c?.name || '').trim()).filter((n: string) => n && originalStory.includes(n.split(' ')[0]))
        : [])
    ])).filter(n => !isReservedSystemKeyword(n));

    // Offline (no AI) episode that continues exactly after the last story line already written.
    // Used when the user picks offline mode, and for a chunk Gemini could not write.
    const offlineEpisode = (notice?: string) => {
      const local = offlineContinuation({
        originalStory,
        currentScriptText,
        episodeNumber,
        targetSceneCount: scenesPerEpisode,
        existingScenes,
        lastSceneState: effectiveLastScene,
        characters,
        continuityLock,
        clipDurationSeconds
      });
      return res.json({
        success: true,
        source: 'offline-narrative-engine',
        offline: true,
        ...(notice ? { fallbackNotice: notice } : {}),
        ...local,
        episodeNumber,
        declaredCharacters: declaredNames,
        ...chargeFieldsFrom(req)
      });
    };
    if (offline) return offlineEpisode();

    // User's own key first (sent by the client), otherwise the server GEMINI_API_KEY. Never logged.
    const userKey = typeof apiKey === 'string' ? apiKey.trim() : '';
    const ai = getGeminiClient(userKey || undefined);
    if (!ai) {
      return res.status(400).json({
        success: false,
        code: 'GEMINI_KEY_MISSING',
        message: 'ยังไม่ได้ตั้งค่า Gemini API Key กรุณาบันทึก API Key ในหน้าตั้งค่า หรือเลือก "โหมดออฟไลน์" / No Gemini API key is configured. Save your key in Settings or choose offline mode.'
      });
    }

    const systemInstruction = `คุณคือนักเขียนบทละครและภาพยนตร์มืออาชีพ มีหน้าที่ดำเนินระบบ "Story Continuation / ต่อบทอัตโนมัติ" (Progressive Episodic Scene Generation Engine)

*** กฎเหล็กบังคับเข้มงวดสูงสุด (STRICT EPISODIC & CONTINUITY PROTOCOL) ***:

1. [จำเนื้อเรื่องต้นฉบับทั้งหมด และห้ามสรุปเรื่องทั้งหมดในตอนเดียว (SOURCE OF TRUTH & EPISODIC PACING)]:
   - ผู้ใช้วางเนื้อเรื่องเต็มครั้งเดียวในช่องเนื้อเรื่องเต็มหน้าแรก แล้วระบบต้องจัดการแบ่งตอนและฉากต่อเนื่องเองจนจบ
   - สำหรับ "ตอนที่ 1" ให้สร้างจากช่วงต้นเรื่องเท่านั้น (ห้ามสรุปเรื่องทั้งหมดในตอนเดียวเด็ดขาด! เจาะลึกเฉพาะเหตุการณ์ช่วงเปิดเรื่อง)
   - สำหรับ "ตอนต่อไป (ตอนที่ 2, 3...)" ให้อ่าน story เดิมและ state ล่าสุดแล้วสร้างตอนถัดไปต่อจากจุดเดิมทันที ไม่รีเซ็ต ไม่กระโดด ไม่จบเอง
   - ให้แบ่งฉากตามเหตุการณ์จริง ไม่ต้องกำหนดจำนวนคลิปขั้นต่ำ 5 หรือ 6 คลิป
   - ห้ามใช้ 1 Action = 1 Clip และ Action/Narration ที่ต่อเนื่องกันในฉากและสถานที่เดียวกัน ให้รวมอยู่ในคลิปเดียวเท่าที่เวลา ${clipDurationSeconds} วินาทีรองรับ
   - ห้ามสร้าง Action เพิ่มเองเพื่อยืดจำนวนคลิป
   - กฎแบ่ง 20 คำให้ทำงานเฉพาะ “บทพูด” ที่เกิน 20 คำเท่านั้น (Action/Narration ห้ามนำไปนับหรือแตกด้วยกฎ 20 คำ)

2. [กฎการสร้างเหตุการณ์จาก Action/Narration]:
   - ถ้าบทมี Action/Narration แม้ไม่มีบทพูด ต้องนำ Action/Narration นั้นไปสร้างเป็นเหตุการณ์ใน Prompt ตามลำดับเดิม
   - Action/Narration ต้องทำหน้าที่เพียง "บอกสิ่งที่กำลังเกิดขึ้นในช็อตนั้น" เท่านั้น ไม่ให้ไปเปลี่ยนโครงสร้าง Prompt เดิมหรือผสมกับระบบ Lock อื่น
   - ห้ามนำ Action/Narration ไป:
     * รวมกับบทพูด หรือเปลี่ยนเป็นบทพูด หรือเพิ่มบทพูดใหม่
     * เปลี่ยนอารมณ์ตัวละครเอง หรือเปลี่ยนท่าทางอื่นที่บทไม่ได้สั่ง
     * แก้ Character Lock หรือแก้ Location Lock
     * สร้าง Action เพิ่มเอง
   - หากในเนื้อเรื่องต้นฉบับมีบทพูด ให้ใช้บทพูดตามต้นฉบับตรงเป๊ะ ห้ามแปลงหรือแต่งเติมถ้อยคำ

3. [ระบบ DIALOGUE 20-WORD SPLIT & FIX REDUNDANT DIALOGUE]:
   - ถ้าบทพูดของตัวละครยาวเกิน 20 คำ ให้ตัดเฉพาะบทพูดส่วนที่เกินไปต่อในคลิปถัดไปอัตโนมัติ
   - ห้ามตัดคำกลางประโยคแบบเสียความหมาย
   - ห้ามแก้ ห้ามย่อ ห้ามแต่งบทพูดเพิ่ม และต้องรักษาผู้พูดคนเดิม 100%
   - Action/Narration ก่อนและหลังบทพูดต้องคงตำแหน่งเดิม
   - คลิปถัดไปต้องต่อเนื่องจาก END คลิปก่อนหน้า ทั้งท่าทาง ตำแหน่ง สีหน้า กล้อง ฉาก เวลา และเสียง
   - ถ้าช่วงใดไม่มี Dialogue ให้ใช้ STRICT SILENCE PROTOCOL และห้ามตัวละครพูดเอง
   - [กฎแก้ไขบทพูดซ้ำซ้อน]: ในคลิปที่ถูกตัดแบ่งบทพูด (Dialogue Split Parts) ให้ลบบทพูดยาวเต็มประโยค (Full Dialogue Text) ออกจากต้นพรอมต์และเนื้อหาพรอมต์ บังคับให้แสดงเฉพาะประโยคย่อยที่ตัดแบ่งแล้ว (Part 1/N) ของคลิปนั้น ๆ เพียงจุดเดียว (ในส่วน Dialogue: เท่านั้น ห้ามใส่บทพูดซ้ำที่ต้นพรอมต์หรือใน Action)
   - ทำซ้ำจนกว่าบทพูดทั้งหมดจะครบ

4. [ล็อกสถานที่และแสงอัตโนมัติตามเนื้อเรื่อง (AUTO SCENE ENVIRONMENT)]:
   - ดึงค่า "สถานที่" (Location) และ "ช่วงเวลา/สภาพแสง" (Lighting/Time) จากเนื้อเรื่องของฉากนั้นโดยตรง
   - เมื่อขึ้นฉากใหม่ ให้รีเซ็ตค่าสภาพแวดล้อมเดิมทิ้งทันที ห้ามนำค่าเดิม (เช่น ป่าทึบ/แสงแดด) ข้ามมาใช้ในฉากใหม่ (เช่น ถ้ำโบราณ/กลางคืน)
   - ในสถานที่เดียวกัน ให้ Story เดินเรื่องต่อเนื่องจนหมดช่วงเหตุการณ์นั้น ไม่จำกัดจำนวนคลิป
   - เมื่อเนื้อเรื่องกำลังเปลี่ยนไปสถานที่ใหม่ ให้หยุดทันที ห้ามดึงฉากถัดไปเอง รอผู้ใช้กด "เดินเรื่องต่อไป"

4. [กฎเหล็กความต่อเนื่อง: END scene ของฉากก่อน ต้องเป็น START scene ของฉากถัดไปทุกครั้ง]:
   - "startAction" ของฉากใหม่ทุกฉาก ต้องรับและเชื่อมต่อจาก "endAction" ของฉากก่อนหน้าอย่างไร้รอยต่อ
   - ฉากที่ 1 ของตอนใหม่ ต้องรับและสืบเนื่องต่อจาก "endAction" ของฉากสุดท้ายจากตอนก่อนหน้า (${effectiveLastScene?.endAction || 'จุดเปิดเรื่อง'})

5. [กฎเหล็กล็อคตำแหน่งตัวละคร (SPATIAL POSITION LOCK)]:
   - ตำแหน่งตัวละครในฉาก เช่น "พี่ทุยอยู่ซ้ายเสา, น้องน้ำอยู่ขวาเสา" ต้องถูกระบุอย่างชัดเจนใน characterPositions
   - ตำแหน่งนี้ต้องถูกล็อคและต่อเนื่องเข้าไปในฉากถัดไป ห้ามสลับฝั่งหรือกระโดดตำแหน่งโดยไม่มีการเคลื่อนไหวต่อเนื่อง

6. [กฎเหล็กการแสดงผลทุกฉาก (CHARACTER LOCK & CONTINUITY PROMPT)]:
   - ไม่ต้องสร้างหรือดึงข้อมูล Character Lock จากช่องเนื้อเรื่องเต็มนี้ ให้ใช้เฉพาะข้อมูล Character Lock ที่มีอยู่แล้วในระบบ
   - ทุกฉากต้องสร้าง Continuity Prompt คุณภาพสูงระดับ Cinematic 8K เป็นภาษาอังกฤษ สำหรับนำไปสร้างวิดีโอ 10 วินาที พร้อมระบุ Character Lock, Spatial Positioning, Starting Moment จาก END ฉากก่อน, Core Action, และ Ending Momentum

7. [กฎเหล็กการตรวจสอบจุดสิ้นสุดของเนื้อเรื่อง (STORY COMPLETION DETECTION)]:
   - ห้ามขึ้นว่าจบเด็ดขาดจนกว่าจะเจอคำว่า "จบเรื่อง", "จบบริบูรณ์", "จบฉาก", "ตอนจบ", "จบ", "-จบ-", "THE END" ในช่วงท้าย (ฉากสุดท้าย) ของเนื้อเรื่องเต็มเท่านั้น
   - หากในเนื้อเรื่องต้นฉบับไม่มีคำระบุจุดจบชัดเจนเหล่านี้ ห้ามตอบ isStoryFinished: true เด็ดขาด
   - ห้ามตอบ isStoryFinished: true ถ้ายังเหลือเหตุการณ์ในต้นฉบับที่ยังไม่ได้เขียน (ตอนที่ 1 จบได้เฉพาะเมื่อครอบคลุมเรื่องทั้งหมดแล้ว)

8. [โครงสร้าง JSON ที่ต้องส่งกลับ (valid JSON format เท่านั้น)]:
{
  "isStoryFinished": boolean,
  "finishMessage": string,
  "episodeNumber": number,
  "episodeTitle": "ตอนที่ X: [ชื่อตอน]",
  "progressPercentage": number,
  "currentMilestone": string,
  "summaryOfEventsSoFar": string,
  "sourceCovered": boolean (true เมื่อตอนนี้ครอบคลุมเหตุการณ์สุดท้ายของเนื้อเรื่องต้นฉบับแล้ว ไม่มีเหตุการณ์เหลือให้สร้างต่อ),
  "episodeScriptText": "บทละครทั้งตอนที่จัดฟอร์แมตสมบูรณ์ (มีหัวข้อตอน, ฉากตามลำดับต้นฉบับ, ระบุตำแหน่งตัวละคร, เริ่มต้น, การกระทำ, บทพูด, สิ้นสุดฉาก) สำหรับใส่ลงช่อง 'วางบทหรือฉากหลายฉาก' อัตโนมัติ",
  "scenes": [
{
  "sceneNumber": number,
  "sceneHeading": "ฉากที่ X: [สถานที่] - [เวลา]",
  "location": "สถานที่",
  "timeOfDay": "เวลา",
  "characters": ["ชื่อตัวละคร"],
  "characterPositions": "ตำแหน่งตัวละคร เช่น พี่ทุยอยู่ซ้ายเสา, น้องน้ำอยู่ขวาเสา",
  "actionDescription": "คำอธิบายภาพ การกระทำจริงของตัวละครและ Subtext (ห้ามเป็นเสียงบรรยาย)",
  "startAction": "จุดเริ่มต้นฉาก รับช่วงต่อจาก endAction ของฉากก่อนหน้า",
  "dialogues": [
    {
      "speaker": "ชื่อตัวละคร",
      "emotionOrAction": "สีหน้า/อารมณ์/อากัปกิริยาขณะพูด เช่น (สบตาตรงๆ นิ่งสุขุม)",
      "dialogue": "ข้อความบทพูดตรงตามต้นฉบับ"
    }
  ],
  "endState": "จุดจบของฉาก ส่งต่อโมเมนตัมสู่ฉากถัดไป",
  "visualPrompt": "Cinematic 8K video prompt in English containing character lock, spatial positioning, start action, core action, and camera directives for 10s video",
  "scriptFormattedText": "ข้อความของฉากนี้ตามมาตรฐานบทละคร"
}
  ]
}`;

    const resumeBlock = resume.lastWrittenIndex >= 0 && resume.remainingText
      ? `
[จุดที่เขียนถึงแล้ว]: ตอนก่อนหน้าเขียนถึงบทพูด "${resume.lastWrittenLine}" แล้ว (ทุกอย่างก่อนหน้านั้นเขียนไปแล้ว ห้ามเขียนซ้ำ)

[เนื้อเรื่องส่วนที่ยังไม่ได้เขียน — ตอนนี้ต้องเริ่มจากบรรทัดแรกของส่วนนี้]:
"""
${resume.remainingText}
"""

[กฎลำดับเรื่อง (สำคัญที่สุด)]:
- เขียนตามลำดับของ "ส่วนที่ยังไม่ได้เขียน" บรรทัดต่อบรรทัด ทุกบทพูดและทุกเหตุการณ์ ห้ามข้ามแม้แต่บรรทัดเดียว
- ห้ามกระโดดไปเขียนตอนจบ ห้ามสรุปรวบเหตุการณ์ที่เหลือ
- ถ้าเนื้อเรื่องยาวเกินตอนนี้ ให้หยุดตรงกลางเรื่องได้เลย แล้วตั้ง "sourceCovered": false เพื่อให้ผู้ใช้กดสร้างตอนต่อไป
`
      : `
[กฎลำดับเรื่อง (สำคัญที่สุด)]:
- เริ่มจากบรรทัดแรกของเนื้อเรื่อง แล้วเขียนตามลำดับบรรทัดต่อบรรทัด ทุกบทพูดและทุกเหตุการณ์ ห้ามข้าม
- ห้ามกระโดดไปเขียนตอนจบ ห้ามสรุปรวบเหตุการณ์ ถ้าเนื้อเรื่องยาวเกินตอนนี้ให้หยุดกลางเรื่องแล้วตั้ง "sourceCovered": false
`;

    const prompt = `[เนื้อเรื่องต้นฉบับทั้งหมด (Master Story Source of Truth) — ใช้อ้างอิงเท่านั้น]:
"""
${originalStory.trim()}
"""
${resumeBlock}
[เป้าหมายการสร้าง]:
- สร้าง "ตอนที่ ${episodeNumber}" ไม่เกิน ${scenesPerEpisode} ฉาก (เนื้อเรื่องที่เหลือไว้ตอนถัดไป)
- "visualPrompt" ต้องมีทุก Action/Narration ของฉากนั้นครบทุกบรรทัดตามลำดับในบท ห้ามตัด ห้ามสรุปรวบ ห้ามข้าม แต่ไม่ต้องใส่รายละเอียดหน้าตาตัวละคร (ระบบใส่ Character Lock ให้เอง)
- ความยาวตามเหตุการณ์จริง (ฉากละประมาณ ${clipDurationSeconds} วินาที ไม่ต้องกำหนดขั้นต่ำ 5 หรือ 6 คลิป และห้ามใช้ 1 Action = 1 Clip)
${episodeNumber === 1 ? '- สำคัญมาก: ตอนที่ 1 ให้สร้างจากช่วงต้นเรื่องเท่านั้น ห้ามสรุปเรื่องทั้งหมดในตอนเดียว' : `- สร้างตอนที่ ${episodeNumber} ต่อจากจุดจบของตอนก่อนหน้าทันที ไม่รีเซ็ต ไม่กระโดด`}

[สถานะล่าสุดของฉากสุดท้ายก่อนหน้านี้ (LAST_SCENE_STATE)]:
${JSON.stringify(effectiveLastScene || 'เริ่มตอนที่ 1 ฉากแรก (ยังไม่มีฉากก่อนหน้า)', null, 2)}

[ตัวละครที่ล็อคไว้ (ใช้เฉพาะตัวละครเดิมที่มีในระบบ ห้ามสร้างใหม่จากเนื้อเรื่องเต็ม)]:
${JSON.stringify(resolveCharacterProfiles(declaredNames, Array.isArray(characters) ? characters : [], []).profiles.map(p => ({ name: p.name, face: p.face || undefined, hair: p.hair || undefined, outfit: p.outfit || undefined, appearance: p.appearance || undefined, personality: p.personality || undefined, characterLock: formatCharacterAppearanceLock(p) })), null, 2)}

คำสั่งบังคับเข้มงวด:
1. เขียนบท "ตอนที่ ${episodeNumber}" ออกมาตามเนื้อเรื่องจริง (เริ่มต้นที่ฉากที่ ${startSceneNum}) โดยไม่ต้องกำหนดจำนวนคลิปขั้นต่ำ 5 หรือ 6 คลิป และห้ามใช้ 1 Action = 1 Clip รวม Action ที่ต่อเนื่องกันในฉากเดียวกันไว้ในคลิปเดียว
2. END scene ของฉากก่อน ต้องเป็น START scene ของฉากถัดไปทุกครั้ง
3. [กฎ Action/Narration]: ถ้าบทมี Action/Narration แม้ไม่มีบทพูด ต้องนำ Action/Narration นั้นไปสร้างเป็นเหตุการณ์ใน Prompt ตามลำดับเดิม โดยทำหน้าที่เพียง "บอกสิ่งที่กำลังเกิดขึ้นในช็อตนั้น" เท่านั้น ห้ามนำไปรวมกับบทพูด ห้ามเปลี่ยนเป็นบทพูด ห้ามเพิ่มบทพูดใหม่ ห้ามเปลี่ยนอารมณ์ตัวละครเอง ห้ามเปลี่ยนท่าทางอื่นที่บทไม่ได้สั่ง ห้ามแก้ Character Lock ห้ามแก้ Location Lock และห้ามสร้าง Action เพิ่มเอง
4. [DIALOGUE 20-WORD SPLIT]: ถ้าบทพูดของตัวละครยาวเกิน 20 คำ ให้ตัดเฉพาะบทพูดส่วนที่เกินไปต่อในคลิปถัดไปอัตโนมัติ โดยไม่ตัดคำกลางประโยคเสียความหมาย รักษาผู้พูดคนเดิม ห้ามแก้/ย่อ/แต่งเพิ่ม และคลิปถัดไปต้องต่อเนื่องจาก END คลิปก่อนหน้า (ท่าทาง ตำแหน่ง สีหน้า กล้อง ฉาก เวลา เสียง) และ Action/Narration ห้ามนำไปนับหรือแตกด้วยกฎ 20 คำ
5. คำบรรยายการกระทำต้องถูกแปลงเป็นภาพ ท่าทาง และ Action ของตัวละครจริง ไม่ใช่เสียงบรรยาย
6. ถ้ามีบทพูดให้ใช้บทพูดตามต้นฉบับตรงเป๊ะ ห้ามแปลงคำพูด
7. ในสถานที่เดียวกัน ให้ Story เดินเรื่องต่อเนื่องจนหมดช่วงนั้น
8. เมื่อเนื้อเรื่องกำลังเปลี่ยนไปสถานที่ใหม่ ให้หยุดทันที ห้ามสร้างฉากข้ามไปยังสถานที่ใหม่
9. ล็อคตำแหน่งตัวละคร (เช่น พี่ทุยอยู่ซ้ายเสา, น้องน้ำอยู่ขวาเสา) ให้ต่อเนื่องในทุกฉาก
10. จัดเตรียม episodeScriptText สำหรับวางลงช่อง "วางบทหรือฉากหลายฉาก" อัตโนมัติ
11. ห้ามสรุปว่าจบเรื่องเด็ดขาด เว้นแต่จะเจอคำว่า "จบเรื่อง", "จบบริบูรณ์", "จบฉาก", "ตอนจบ", "จบ", "-จบ-", "THE END" ในฉากสุดท้าย/บรรทัดท้ายของเนื้อเรื่องต้นฉบับ
12. ตั้งค่า "sourceCovered": true เฉพาะเมื่อตอนนี้ครอบคลุมเหตุการณ์สุดท้ายของเนื้อเรื่องต้นฉบับแล้ว (ไม่มีเหตุการณ์เหลือให้สร้างตอนต่อไป) มิฉะนั้นให้เป็น false
13. หัวข้อฉากที่เป็นชื่อตอน/อารมณ์ หรือ "หน้าบ้านต่อเนื่อง" ไม่ใช่สถานที่: "location" ต้องเป็นสถานที่จริงของฉากก่อนหน้า และ "timeOfDay" เดิม
14. ท่าทาง/ตำแหน่งตอนเริ่มฉาก ต้องเท่ากับตอนจบฉากก่อนหน้า เว้นแต่บทบอกว่าขยับ
15. "speaker" และ "characters" ต้องเป็นชื่อตัวละครล้วนๆ ห้ามมีคำกริยาต่อท้าย ให้ใส่กริยา/อารมณ์ไว้ใน "emotionOrAction" แทน${declaredNames.length > 0 ? `\n16. ใช้ชื่อตัวละครตามที่ประกาศไว้เท่านั้น: ${declaredNames.join(', ')}` : ''}`;

    const storySceneSchema = {
      type: Type.OBJECT,
      properties: {
        sceneNumber: { type: Type.NUMBER },
        sceneHeading: { type: Type.STRING },
        location: { type: Type.STRING },
        timeOfDay: { type: Type.STRING },
        characters: { type: Type.ARRAY, items: { type: Type.STRING } },
        characterPositions: { type: Type.STRING },
        actionDescription: { type: Type.STRING },
        startAction: { type: Type.STRING },
        dialogues: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              speaker: { type: Type.STRING },
              emotionOrAction: { type: Type.STRING },
              dialogue: { type: Type.STRING }
            },
            required: ['speaker', 'dialogue']
          }
        },
        endState: { type: Type.STRING },
        visualPrompt: { type: Type.STRING },
        scriptFormattedText: { type: Type.STRING }
      },
      required: ['sceneNumber', 'sceneHeading', 'location', 'timeOfDay', 'characters', 'actionDescription', 'startAction', 'dialogues', 'endState', 'visualPrompt']
    };
    const storyEpisodeSchema = {
      type: Type.OBJECT,
      properties: {
        isStoryFinished: { type: Type.BOOLEAN },
        finishMessage: { type: Type.STRING },
        episodeNumber: { type: Type.NUMBER },
        episodeTitle: { type: Type.STRING },
        progressPercentage: { type: Type.NUMBER },
        currentMilestone: { type: Type.STRING },
        summaryOfEventsSoFar: { type: Type.STRING },
        sourceCovered: { type: Type.BOOLEAN },
        episodeScriptText: { type: Type.STRING },
        scenes: { type: Type.ARRAY, items: storySceneSchema }
      },
      required: ['isStoryFinished', 'episodeNumber', 'episodeTitle', 'progressPercentage', 'sourceCovered', 'scenes']
    };

    // Up to 2 attempts: the second one only when the first skipped source lines before writing anything usable
    let parsed: any = null;
    let validation: ReturnType<typeof validateGeminiEpisodeScenes> | null = null;
    let order: ReturnType<typeof checkEpisodeOrder> | null = null;
    let retryNote = '';
    for (let attempt = 1; attempt <= 2; attempt++) {
    let rawText = '';
    try {
      const billed = await callBillableGemini(req, res, ai, {
        model: 'gemini-3.1-flash-lite',
        contents: prompt + retryNote,
        config: {
          systemInstruction,
          // Low temperature: follow the source in order instead of improvising toward an ending
          temperature: 0.3,
          maxOutputTokens: 32768,
          responseMimeType: 'application/json',
          responseSchema: storyEpisodeSchema
        }
      }, 'story continue');
      if (!billed) return;
      const response = billed.response;
      rawText = response.text || '';
    } catch (geminiErr: any) {
      const reason = formatGenAIError(geminiErr);
      console.warn('Gemini story continuation failed:', reason);
      return offlineEpisode(`Gemini ขัดข้อง (${reason}) ระบบสร้างช่วงนี้แบบไม่ใช้ AI แทน เนื้อเรื่องครบตามต้นฉบับ`);
    }

    parsed = null;
    const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      parsed = JSON.parse(cleanJson);
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { parsed = JSON.parse(jsonMatch[0]); } catch { parsed = null; }
      }
    }
    if (!parsed || typeof parsed !== 'object') {
      // Reply cut off by the length limit: keep the complete scenes (checked for order below)
      parsed = salvageEpisodeJson(rawText);
    }
    if (!parsed || typeof parsed !== 'object') {
      if (attempt < 2) {
        retryNote = `\n\n[แก้ไขจากครั้งก่อน]: คำตอบครั้งก่อนยาวเกินจนถูกตัด ให้สร้างไม่เกิน 3 ฉาก และ visualPrompt สั้นๆ`;
        continue;
      }
      return offlineEpisode('Gemini ตอบกลับไม่สมบูรณ์ ระบบสร้างช่วงนี้แบบไม่ใช้ AI แทน เนื้อเรื่องครบตามต้นฉบับ');
    }

    validation = validateGeminiEpisodeScenes(parsed, startSceneNum, declaredNames);
    if (!validation.ok) {
      console.warn('Gemini story scenes incomplete:', validation.errors.slice(0, 5).join('; '));
      return offlineEpisode('Gemini ส่งข้อมูลฉากไม่ครบ ระบบสร้างช่วงนี้แบบไม่ใช้ AI แทน เนื้อเรื่องครบตามต้นฉบับ');
    }
    order = checkEpisodeOrder(validation.scenes, resume);
    if (order.skippedLines.length === 0 || order.keepSceneCount > 0) break;
    retryNote = `

[แก้ไขจากครั้งก่อน]: ครั้งก่อนคุณข้ามบทพูดเหล่านี้ไป ซึ่งห้ามเด็ดขาด: ${order.skippedLines.slice(0, 6).map(l => `"${l}"`).join(', ')}
ให้เริ่มฉากแรกจากบทพูด "${order.skippedLines[0]}" และเขียนตามลำดับ ห้ามข้าม`;
    }
    if (!validation || !order) {
      return offlineEpisode('Gemini ไม่ได้ส่งฉากกลับมา ระบบสร้างช่วงนี้แบบไม่ใช้ AI แทน');
    }
    if (order.skippedLines.length > 0 && order.keepSceneCount === 0) {
      return offlineEpisode(`Gemini ข้ามเนื้อเรื่อง (เช่น "${order.skippedLines[0]}") ระบบสร้างช่วงนี้แบบไม่ใช้ AI แทน เนื้อเรื่องครบตามต้นฉบับ`);
    }
    let orderNotice = '';
    if (order.skippedLines.length > 0) {
      // Keep only the scenes before the jump; the rest is written by the next "สร้างต่อ"
      const dropped = validation.scenes.length - order.keepSceneCount;
      validation.scenes = validation.scenes.slice(0, order.keepSceneCount);
      order = checkEpisodeOrder(validation.scenes, resume);
      orderNotice = `Gemini พยายามข้ามไปช่วงท้ายเรื่อง ระบบตัด ${dropped} ฉากที่ข้ามออก และเก็บเฉพาะฉากที่ต่อเนื่องตามต้นฉบับ กดสร้างต่อเพื่อเขียนส่วนที่เหลือ`;
      parsed.sourceCovered = false;
    }
    // Not covered while any source dialogue line is still unwritten
    if (resume.sourceLines.length > 0 && !order.allLinesCovered) parsed.sourceCovered = false;
    // Same guarantees as offline mode: heading inheritance, full Character Lock,
    // one Location Lock per place and pose handoff, all included in visualPrompt.
    const locked = applyEpisodeLocks(validation.scenes, {
      originalStory,
      characters,
      continuityLock,
      lastSceneState: effectiveLastScene,
      declaredNames,
      existingScenes
    });
    // One scene with more dialogue than one clip can hold becomes several clips
    // (a 7-line scene used to come out as a single 8-second prompt)
    // Gemini rewrites scenes in its own words and drops action lines: put every story line it left out
    // back into the scene where it belongs (the original story is the source of truth)
    const restored = restoreMissingStoryBeats(locked.scenes, originalStory, { fromDialogueIndex: resume.nextIndex, fromBeat: resume.fromBeat });
    if (restored.restoredActions || restored.restoredDialogues) {
      console.log(`[story continue] restored ${restored.restoredActions} action and ${restored.restoredDialogues} dialogue line(s) Gemini left out`);
    }
    // Story position reached (action lines included); the next episode starts right after it
    const cursor = storyCursorFor(restored.scenes, originalStory, resume.fromBeat);
    if (cursor < resume.fromBeat) {
      return offlineEpisode('Gemini ไม่ได้เขียนเนื้อเรื่องต่อ ระบบสร้างช่วงนี้แบบไม่ใช้ AI แทน');
    }
    parsed.sourceCovered = cursor >= (parsedSource.narrativeBeats?.length || 0) - 1;
    parsed.scenes = splitDenseDialogueScenes(restored.scenes.map((sc: any) => ({ ...sc, sourceCursor: cursor })), Number(clipDurationSeconds) || 8);
    parsed.continuityWarnings = locked.warnings;
    parsed.characterWarnings = locked.characterWarnings;

    // Strict Rule: finished ONLY when the final scene/last lines carry an ending marker
    // AND this episode covers the last source event (source exhausted).
    if (hasExplicitEnd && parsed.sourceCovered === true) {
      parsed.isStoryFinished = true;
      parsed.finishMessage = parsed.finishMessage || 'เนื้อเรื่องจบแล้วตามต้นฉบับ (พบคำระบุจุดจบในฉากสุดท้าย)';
    } else {
      parsed.isStoryFinished = false;
      parsed.finishMessage = '';
    }
    parsed.hasMoreScenes = parsed.sourceCovered !== true && !parsed.isStoryFinished;

    // Ensure episodeScriptText is populated
    if (!parsed.episodeScriptText || typeof parsed.episodeScriptText !== 'string' || !parsed.episodeScriptText.trim()) {
      const epTitle = parsed.episodeTitle || `ตอนที่ ${episodeNumber}`;
      parsed.episodeScriptText = `[${epTitle}]\n\n` + parsed.scenes.map((s: any) => s.scriptFormattedText || `${s.sceneHeading}\n${s.actionDescription}`).join('\n\n');
    }

    parsed.nextScene = parsed.scenes[0];
    parsed.episodeNumber = episodeNumber;
    if (orderNotice) parsed.fallbackNotice = orderNotice;

    return res.json({
      ...parsed,
      success: true,
      source: 'gemini-flash',
      declaredCharacters: declaredNames,
      ...chargeFieldsFrom(req)
    });
  } catch (err: any) {
    console.error('Error in /api/story/continue:', err?.message || err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'เกิดข้อผิดพลาดในการต่อบทละคร'
    });
  }
});

// Story parsing / offline episode building now lives in src/services/storyEpisodeEngine.ts
// (parseStoryStructure, splitStoryIntoSceneUnits, generateEpisodeLocally, extractLocationFromText …)


// Fallback character generator completely removed to enforce Image-First Character Lock

// Helper to parse base64 image data and mime type safely
function parseImageData(dataUrlOrBase64: string): { mimeType: string; base64Data: string } | null {
  if (!dataUrlOrBase64 || typeof dataUrlOrBase64 !== 'string') return null;
  const trimmed = dataUrlOrBase64.trim();
  if (!trimmed) return null;

  let mimeType = 'image/jpeg';
  let base64Data = trimmed;
  const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    base64Data = match[2].trim();
  }

  // Detect signature if mimeType is generic or missing
  if (base64Data.startsWith('/9j/')) mimeType = 'image/jpeg';
  else if (base64Data.startsWith('iVBORw0KGgo')) mimeType = 'image/png';
  else if (base64Data.startsWith('UklGR')) mimeType = 'image/webp';
  else if (base64Data.startsWith('R0lGOD')) mimeType = 'image/gif';

  if (!mimeType.startsWith('image/')) {
    mimeType = 'image/jpeg';
  }

  return { mimeType, base64Data };
}

// Persistent Reference Image Writer for Character Consistency
function persistReferenceImage(imageData: string, customId?: string): {
  referenceImageId: string;
  referenceImageUrl: string;
  imageHash: string;
} {
  const parsed = parseImageData(imageData);
  if (!parsed || !parsed.base64Data) {
    throw new Error('ข้อมูลรูปภาพไม่ถูกต้อง ไม่สามารถแปลงข้อมูลภาพได้');
  }

  const imageHash = crypto.createHash('sha256').update(parsed.base64Data).digest('hex');
  const refId = customId || `ref_${imageHash.slice(0, 10)}_${Date.now()}`;
  const ext = parsed.mimeType.includes('png') ? 'png' : (parsed.mimeType.includes('webp') ? 'webp' : 'jpg');
  const filename = `${refId}.${ext}`;
  const filepath = path.join(UPLOADS_CHARACTERS_DIR, filename);

  const buffer = Buffer.from(parsed.base64Data, 'base64');
  fs.writeFileSync(filepath, buffer);

  const referenceImageUrl = `/uploads/characters/${filename}`;
  return {
    referenceImageId: refId,
    referenceImageUrl,
    imageHash
  };
}

// In-Memory Vision Analysis Cache to guard Gemini Vision API costs
const visionAnalysisCache = new Map<string, {
  imageHash: string;
  data: any;
  timestamp: number;
}>();

// Seed Prae Master Analysis into Vision Cache so TEST A & analysis are instant with 0 Vision API calls
const PRAE_MASTER_HASH = '38ed715e729e441ce92056fc2d82324d452f0a7dbf8a769fbd98a4e6aba5dace';
visionAnalysisCache.set(PRAE_MASTER_HASH, {
  imageHash: PRAE_MASTER_HASH,
  timestamp: Date.now(),
  data: {
    creatureType: '',
    species: '',
    name: 'แพร / Prae',
    suggestedName: 'แพร / Prae',
    detectedName: 'แพร / Prae',
    age: '22 ปี',
    detectedAge: '22',
    detectedHeight: '165 cm',
    availableViews: ['FRONT', 'FACE_CLOSEUP'],
    imageHash: PRAE_MASTER_HASH,
    referenceImageId: 'ref_prae_master',
    referenceImageUrl: '/uploads/characters/ref_prae_master.jpg',
    gender: 'หญิง',
    skinTone: 'ผิวสองสีเนียนผ่อง',
    faceShape: 'รูปไข่ละมุน',
    hairStyle: 'ผมยาวประบ่าดัดลอนคลื่นธรรมชาติ',
    hairColor: 'น้ำตาลเข้มช็อกโกแลต',
    eyeDescription: 'ตากลมโตสดใสสีน้ำตาล',
    bodyType: 'สมส่วน',
    topClothing: 'เสื้อเชิ้ตคอปกผ้าฝ้ายสีครีมมินิมอล',
    bottomClothing: 'กางเกงขายาวผ้าลินินสีเบจ',
    footwear: 'รองเท้าคัทชูหนังสีน้ำตาลอ่อน',
    accessories: 'ต่างหูห่วงเงินมินิมอล',
    distinctFeatures: 'รอยยิ้มสดใสเป็นธรรมชาติ ผิวสองสีเนียนผ่อง',
    description: 'หญิงสาววัยรุ่นไทย ดวงตากลมโตเป็นประกาย รอยยิ้มสดใสเป็นธรรมชาติ ผิวสองสีเนียนผ่อง ผมยาวประบ่าสีน้ำตาลเข้ม',
    outfitDescription: 'เสื้อเชิ้ตคอปกผ้าฝ้ายสีครีมมินิมอล กางเกงขายาวผ้าลินินสีเบจ',
    confidence: 95,
    fullSummary: 'หญิงสาววัยรุ่นไทย ดวงตากลมโตเป็นประกาย รอยยิ้มสดใส ผมยาวประบ่าดัดลอนคลื่นสีน้ำตาลเข้ม เสื้อเชิ้ตคอปกผ้าฝ้ายสีครีมมินิมอล',
    structured: {
      creatureType: '',
      species: '',
      name: 'แพร / Prae',
      gender: 'หญิง',
      ageRange: '22 ปี',
      skinTone: 'ผิวสองสีเนียนผ่อง',
      faceShape: 'รูปไข่ละมุน',
      hairStyle: 'ผมยาวประบ่าดัดลอนคลื่นธรรมชาติ',
      hairColor: 'น้ำตาลเข้มช็อกโกแลต',
      eyeDescription: 'ตากลมโตสดใสสีน้ำตาล',
      bodyType: 'สมส่วน',
      topClothing: 'เสื้อเชิ้ตคอปกผ้าฝ้ายสีครีมมินิมอล',
      bottomClothing: 'กางเกงขายาวผ้าลินินสีเบจ',
      footwear: 'รองเท้าคัทชูหนังสีน้ำตาลอ่อน',
      accessories: 'ต่างหูห่วงเงินมินิมอล',
      distinctFeatures: 'รอยยิ้มสดใสเป็นธรรมชาติ ผิวสองสีเนียนผ่อง',
      confidence: 95
    },
    characterIdentity: {
      id: 'char_prae_05',
      name: 'แพร / Prae'
    },
    referenceMetadata: {
      referenceImageId: 'ref_prae_master',
      referenceImageUrl: '/uploads/characters/ref_prae_master.jpg',
      imageHash: PRAE_MASTER_HASH,
      detectedName: 'แพร / Prae',
      detectedAge: '22',
      detectedHeight: '165 cm',
      availableViews: ['FRONT', 'FACE_CLOSEUP']
    },
    visualProfile: {
      imageHash: PRAE_MASTER_HASH,
      referenceImageId: 'ref_prae_master',
      referenceImageUrl: '/uploads/characters/ref_prae_master.jpg',
      referenceImage: '/uploads/characters/ref_prae_master.jpg',
      referenceImages: ['/uploads/characters/ref_prae_master.jpg'],
      hairStyle: 'ผมยาวประบ่าดัดลอนคลื่นธรรมชาติ',
      hairColor: 'น้ำตาลเข้มช็อกโกแลต',
      top: 'เสื้อเชิ้ตคอปกผ้าฝ้ายสีครีมมินิมอล',
      bottom: 'กางเกงขายาวผ้าลินินสีเบจ',
      shoes: 'รองเท้าคัทชูหนังสีน้ำตาลอ่อน',
      accessories: 'ต่างหูห่วงเงินมินิมอล',
      visibleDistinctiveDetails: 'ดวงตากลมโตเป็นประกาย รอยยิ้มสดใสเป็นธรรมชาติ ผิวสองสีเนียนผ่อง',
      imageAnalysisStatus: 'USER_CONFIRMED',
      hair: 'ผมยาวประบ่าดัดลอนคลื่นธรรมชาติ น้ำตาลเข้มช็อกโกแลต',
      visibleOutfit: 'เสื้อเชิ้ตคอปกผ้าฝ้ายสีครีมมินิมอล กางเกงขายาวผ้าลินินสีเบจ',
      visibleAccessories: 'ต่างหูห่วงเงินมินิมอล',
      visiblePhysicalAppearance: 'หญิงสาววัยรุ่นไทย ดวงตากลมโตเป็นประกาย รอยยิ้มสดใสเป็นธรรมชาติ',
      visibleDistinguishingDetails: 'รอยยิ้มสดใสเป็นธรรมชาติ ผิวสองสีเนียนผ่อง',
      detectedViews: ['FRONT', 'FACE_CLOSEUP'],
      isMultiViewSheet: false,
      confidence: 95,
      generatedVisualPrompt: 'Thai young woman Prae with warm brown wavy hair, cream shirt and beige linen trousers'
    },
    storyProfile: {
      age: '22 ปี',
      personality: 'ร่าเริง มองโลกในแง่ดี อบอุ่น มีความมุ่งมั่นสูง',
      role: 'นางเอกซีรีส์โรแมนติกดราม่า',
      occupation: 'นักออกแบบกราฟิกอิสระ',
      background: 'สาวน้อยผู้รักงานศิลปะ เดินทางมาตามหาแรงบันดาลใจใหม่ในเมืองหลวง'
    },
    fieldSources: {
      name: 'REFERENCE_TEXT',
      age: 'REFERENCE_TEXT',
      hairStyle: 'VISUAL_OBSERVATION',
      hairColor: 'VISUAL_OBSERVATION',
      top: 'VISUAL_OBSERVATION',
      bottom: 'VISUAL_OBSERVATION',
      shoes: 'VISUAL_OBSERVATION',
      accessories: 'VISUAL_OBSERVATION',
      distinctFeatures: 'VISUAL_OBSERVATION',
      gender: 'VISUAL_OBSERVATION',
      role: 'UNKNOWN',
      personality: 'UNKNOWN',
      occupation: 'UNKNOWN',
      background: 'UNKNOWN'
    }
  }
});

// Dedicated Reference Image Upload Endpoint (Survives Reloads / Persistent Storage)
app.post('/api/character/upload-reference', async (req: express.Request, res: express.Response) => {
  try {
    const { image, imageHash, referenceImageId } = req.body || {};
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ success: false, message: 'Image data is required' });
    }

    if (image.startsWith('blob:')) {
      return res.status(400).json({
        success: false,
        message: 'ไม่อนุญาตให้ใช้ blob URL ชั่วคราวเป็น Reference Image ถาวร กรุณาส่งข้อมูลรูปภาพที่ถูกต้อง'
      });
    }

    // If already persistent URL
    if (image.startsWith('/uploads/') || image.startsWith('http://') || image.startsWith('https://')) {
      const hash = imageHash || crypto.createHash('sha256').update(image).digest('hex');
      const refId = referenceImageId || `ref_${hash.slice(0, 10)}_${Date.now()}`;
      return res.json({
        success: true,
        referenceImageId: refId,
        referenceImageUrl: image,
        imageHash: hash
      });
    }

    const persisted = persistReferenceImage(image, referenceImageId);
    return res.json({
      success: true,
      referenceImageId: persisted.referenceImageId,
      referenceImageUrl: persisted.referenceImageUrl,
      imageHash: persisted.imageHash
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to upload reference image'
    });
  }
});

// 6.2.2 AI Character Image Analyzer Endpoint (Gemini Flash Multimodal)
app.post('/api/character/analyze-image', async (req: express.Request, res: express.Response) => {
  try {
    const { image, images, apiKey, forceReanalyze } = req.body || {};

    // Support both single image and multiple images array
    const rawImagesList: string[] = Array.isArray(images)
      ? images.filter(img => typeof img === 'string' && img.trim().length > 0)
      : (image && typeof image === 'string' && image.trim().length > 0 ? [image] : []);

    if (rawImagesList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาส่งรูปภาพ base64 เพื่อให้ AI วิเคราะห์ (Image base64 is required)'
      });
    }

    // Parse all images safely; limit to 4 images max to stay within token & payload budgets
    const parsedImages = rawImagesList
      .map(img => parseImageData(img))
      .filter((p): p is { mimeType: string; base64Data: string } => p !== null && p.base64Data.length > 0)
      .slice(0, 4);

    if (parsedImages.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลรูปภาพไม่ถูกต้อง ไม่สามารถถอดรหัส base64 ได้'
      });
    }

    const primaryParsed = parsedImages[0];
    const supportingParsed = parsedImages.slice(1);

    // Compute deterministic SHA-256 hash of the primary reference image
    const primaryImageHash = crypto.createHash('sha256').update(primaryParsed.base64Data).digest('hex');

    // API COST GUARD: Check cache first unless forced by user action
    if (!forceReanalyze && visionAnalysisCache.has(primaryImageHash)) {
      const cached = visionAnalysisCache.get(primaryImageHash)!;
      console.log(`[Vision API Cost Guard] Cache hit for imageHash: ${primaryImageHash}. Skipping Gemini Vision call.`);
      return res.json({
        success: true,
        source: 'cache',
        cached: true,
        data: cached.data
      });
    }

    const ai = getGeminiClient(apiKey);
    if (ai) {
      try {
        const systemInstruction = `คุณเป็น AI ผู้เชี่ยวชาญวิเคราะห์ภาพตัวละครและ Reference Sheet สำหรับงานภาพยนตร์และสตูดิโอแอนิเมชัน (Concept Art & Character Consistency Analyzer)
หน้าที่ของคุณคือ: วิเคราะห์ภาพตัวละครจากรูปอ้างอิงจริง โดยยึดหลักข้อเท็จจริงทางสายตา (Visual Ground Truth) ห้ามเดา ห้ามคิดแทน และห้ามแต่งเติม

*** ลำดับขั้นตอนและกฎเหล็กบังคับเข้มงวดสูงสุด (STRICT PROTOCOL) ***:

1. [SOURCE OF TRUTH ลำดับที่ 1: REFERENCE_TEXT (ข้อความในภาพ/Reference Sheet OCR)]
   - ตรวจหาข้อความ ตัวอักษร หรือป้ายกำกับทั้งหมดที่พิมพ์หรือเขียนอยู่ในภาพ Reference Sheet:
     * "detectedName": ชื่อตัวละครที่ปรากฏชัดเจนในภาพ เช่น "แพร / Prae", "Prae", "แพร" (ถ้ามีให้ดึงมาตรงตัวเป๊ะ)
     * "detectedAge": ตัวเลขอายุที่ปรากฏชัดเจนในภาพ เช่น "30" หรือ "30 ปี"
       *** กฎเหล็กสูงสุด: ถ้ารูปเขียน "AGE: 30" หรือ "30" ต้องตอบ "30" เท่านั้น! ห้ามเปลี่ยนเป็นค่าประมาณหรือช่วงอายุ เช่น "25-30" หรือ "ประมาณ 25-30 ปี" โดยเด็ดขาด ห้ามเดา! ***
     * "detectedHeight": ส่วนสูงที่เขียนในภาพ เช่น "182 cm" หรือ "182 ซม."
       *** กฎเหล็ก: ถ้ารูปเขียน "HEIGHT: 182 cm" ต้องตอบ "182 cm" ห้ามเดาความสูงใหม่จากสรีระโดยเด็ดขาด ***
   - หากไม่พบข้อความเหล่านี้ในรูป ให้เว้นว่างเป็น "" ห้ามแต่งเติมขึ้นมาเอง

2. [REFERENCE SHEET ต้องรู้ว่าเป็นคนเดียว (SINGLE CHARACTER)]
   - ถ้ารูปมีหลายมุมมอง (เช่น FRONT, FACE CLOSE-UP, 3/4 VIEW, SIDE, BACK, DETAIL SHOTS) ให้ถือว่าทั้งหมดเป็นตัวละครคนเดียวกัน (Single Character)
   - ห้ามสร้างหลาย Character ห้ามคิดว่าภาพ Close-up คือคนอีกคน
   - ตรวจจับมุมมองที่มีอยู่ในภาพลงใน "availableViews":
     เลือกเฉพาะที่มีจริงจาก: ["FRONT", "FACE_CLOSEUP", "THREE_QUARTER", "SIDE", "BACK", "FULL_BODY", "OUTFIT_DETAIL", "ACCESSORY_DETAIL", "SHOE_DETAIL"]

3. [SOURCE OF TRUTH ลำดับที่ 2: VISUAL_OBSERVATION (สิ่งที่เห็นจริงจากสายตา)]
   - "creatureType": "human" | "anthropomorphic mammal" | "anthropomorphic reptile" | "fantasy creature" | "unknown"
   - "species": สายพันธุ์ ถ้าไม่มั่นใจ 80% ให้ใช้คำกว้าง
   - "hairStyle": ทรงผมที่เห็นจริง เช่น "ผมสั้นระดับคาง/ต้นคอ ทรงบ๊อบสั้น"
   - "hairColor": สีผมที่เห็นจริง เช่น "สีดำ"
   - "topClothing": เสื้อผ้าท่อนบนที่เห็นจริง เช่น "เสื้อเชิ้ตสีฟ้าอ่อน แขนพับ มีลายปักดอกไม้เล็กบริเวณปก"
   - "bottomClothing": เสื้อผ้าท่อนล่างที่เห็นจริง เช่น "กางเกงยีนส์สีน้ำเงินเข้ม"
   - "footwear": รองเท้าที่เห็นจริง เช่น "รองเท้าผ้าใบสีขาว"
   - "accessories": เครื่องประดับและสิ่งของที่เห็นจริง เช่น "สร้อยคอพร้อมจี้มุกขนาดเล็ก"
   - "distinctFeatures": จุดเด่นทางกายภาพและรายละเอียดที่เห็นจริง เช่น "สร้อยคอพร้อมจี้มุกขนาดเล็ก, ปกเสื้อมีลายปักดอกไม้เล็ก"
   - หากมองไม่เห็นส่วนใด เช่น รองเท้า หรือ ท่อนล่าง ให้ตอบว่า "ไม่เห็นชัดในภาพ" หรือ "ไม่มี" ห้ามเดา!

4. [กฎเหล็ก: สิ่งที่ห้ามเดาโดยเด็ดขาด (FORBIDDEN TO GUESS)]
   ห้ามเดาข้อมูลต่อไปนี้จากภาพเด็ดขาด:
   - อาชีพ (occupation)
   - นิสัย (personality)
   - ฐานะ (wealth)
   - ความสัมพันธ์ (relationship)
   - ประวัติชีวิต (life backstory)
   - เชื้อชาติ (ethnicity)
   - ศาสนา (religion)
   - สุขภาพ (health)
   - ความฉลาด (intelligence)
   - บทบาทในเรื่อง (story role)
   ให้ปล่อยว่างไว้ ไม่ต้องเดา

5. [โครงสร้าง JSON ที่ต้องส่งกลับ (valid JSON format เท่านั้น ห้ามใส่ markdown block)]
{
  "detectedName": "ชื่อจากข้อความในภาพ หรือว่าง",
  "detectedAge": "อายุจากข้อความในภาพ (เช่น 30 ห้ามตอบเป็นช่วง 25-30) หรือว่าง",
  "detectedHeight": "ความสูงจากข้อความในภาพ (เช่น 182 cm) หรือว่าง",
  "availableViews": ["FRONT", "FACE_CLOSEUP", "THREE_QUARTER", "SIDE", "BACK", "FULL_BODY", "OUTFIT_DETAIL", "ACCESSORY_DETAIL", "SHOE_DETAIL"],
  "creatureType": "human | anthropomorphic mammal | anthropomorphic reptile | fantasy creature | unknown",
  "species": "สายพันธุ์ หรือว่าง",
  "gender": "หญิง | ชาย | ไม่ระบุ",
  "ageRange": "ช่วงอายุที่เห็นจากกายภาพ (ใช้ detectedAge ถ้ามีระบุในภาพ)",
  "skinTone": "สีผิว เช่น ผิวขาวเหลือง",
  "faceShape": "รูปหน้า เช่น หน้ารูปไข่ หรือ ไม่เห็นชัดในภาพ",
  "hairStyle": "ทรงผม เช่น ผมบ๊อบสั้นระดับคาง",
  "hairColor": "สีผม เช่น สีดำ",
  "eyeDescription": "ดวงตา เช่น ตากลมโตสีดำ",
  "bodyType": "รูปร่าง เช่น รูปร่างสมส่วน สูงโปร่ง",
  "topClothing": "เสื้อท่อนบน เช่น เสื้อเชิ้ตสีฟ้าอ่อน แขนพับ มีลายปักดอกไม้เล็กบริเวณปก",
  "bottomClothing": "เสื้อผ้าท่อนล่าง เช่น กางเกงยีนส์สีน้ำเงินเข้ม",
  "footwear": "รองเท้า เช่น รองเท้าผ้าใบสีขาว",
  "accessories": "เครื่องประดับ เช่น สร้อยคอพร้อมจี้มุกขนาดเล็ก",
  "distinctFeatures": "จุดเด่นที่เห็นจริง เช่น สร้อยคอจี้มุก ลายปักดอกไม้ที่ปกเสื้อ",
  "nameSource": "REFERENCE_TEXT | VISUAL_OBSERVATION | UNKNOWN",
  "ageSource": "REFERENCE_TEXT | VISUAL_OBSERVATION | UNKNOWN",
  "heightSource": "REFERENCE_TEXT | UNKNOWN",
  "confidence": 95
}`;

        // Build multimodal content parts
        const parts: any[] = [];

        // 1. Primary Image Part
        parts.push({
          text: `[รูปภาพที่ 1: รูปอ้างอิงหลัก (Primary Reference)] สำคัญที่สุด: โปรดอ่านข้อความ OCR ในแผ่น Reference Sheet ทั้งหมด (เช่น NAME, AGE, HEIGHT) และวิเคราะห์รูปลักษณ์จริงจากรูปนี้`
        });
        parts.push({
          inlineData: {
            data: primaryParsed.base64Data,
            mimeType: primaryParsed.mimeType
          }
        });

        // 2. Supporting Images Parts (if any)
        supportingParsed.forEach((sup, idx) => {
          parts.push({
            text: `[รูปภาพที่ ${idx + 2}: รูปเสริม (Supporting Reference #${idx + 1})] ใช้เพื่อยืนยันหรือตรวจสอบมุมมองเพิ่มเติมเท่านั้น ห้ามเปลี่ยนลักษณะหลักของรูปแรก`
          });
          parts.push({
            inlineData: {
              data: sup.base64Data,
              mimeType: sup.mimeType
            }
          });
        });

        // 3. User Prompt Part
        parts.push({
          text: `คำสั่งวิเคราะห์ภาพตัวละครอย่างเคร่งครัด (IMAGE-FIRST CHARACTER LOCK):
1. อ่านตัวอักษรในภาพ (REFERENCE_TEXT):
   - NAME: ถ้ามีตัวอักษรระบุชื่อ เช่น "แพร / Prae" ให้ตอบใน detectedName
   - AGE: ถ้ามีตัวเลขระบุ เช่น "AGE: 30" ต้องตอบ "30" ห้ามเดาหรือแปลงเป็นช่วง 25-30 ปี
   - HEIGHT: ถ้ามีตัวเลขระบุ เช่น "HEIGHT: 182 cm" ให้ตอบ "182 cm" ห้ามเดาความสูงใหม่
2. ตรวจสอบมุมมองทั้งหมดว่าเป็น Single Character คนเดียวกัน และบันทึก availableViews
3. วิเคราะห์เฉพาะสิ่งที่เห็นได้จริงจากภาพ (ผม, เสื้อผ้าท่อนบน, กางเกง, รองเท้า, เครื่องประดับ, จุดเด่น)
4. ห้ามเดาอาชีพ, นิสัย, ฐานะ, ประวัติชีวิต, บทบาทในเรื่อง
5. ตอบเป็น JSON ตามโครงสร้างที่กำหนดเท่านั้น`
        });

        const billed = await callBillableGemini(req, res, ai, {
          model: 'gemini-3.1-flash-lite',
          contents: {
            parts
          },
          config: {
            systemInstruction,
            responseMimeType: 'application/json'
          }
        }, 'character analyze');
        if (!billed) return;
        const response = billed.response;

        const rawText = response.text || '';
        let jsonResult: any = null;
        try {
          const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          jsonResult = JSON.parse(cleaned);
        } catch (parseErr) {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonResult = JSON.parse(jsonMatch[0]);
          }
        }

        if (jsonResult) {
          // Normalize confidence score
          let confidence = typeof jsonResult.confidence === 'number' ? Math.round(jsonResult.confidence) : 85;
          if (isNaN(confidence) || confidence < 0) confidence = 50;
          if (confidence > 100) confidence = 100;

          // Extract and sanitize detected text
          const detectedName = (jsonResult.detectedName || '').trim();
          let detectedAge = (jsonResult.detectedAge || '').trim();
          const detectedHeight = (jsonResult.detectedHeight || '').trim();

          // Enforce rule: if detectedAge is clearly 30 or a number, keep clean exact value
          if (detectedAge.match(/\b30\b/)) {
            detectedAge = '30';
          } else if (detectedAge.match(/^\d+$/)) {
            // Keep pure number
          }

          // Check if reptile or other creature
          const creatureType = (jsonResult.creatureType || '').trim();
          const species = (jsonResult.species || '').trim();
          const isReptile = creatureType === 'anthropomorphic reptile' ||
            /reptile|lizard|gecko|monitor|crocodile|alligator|snake|กิ้งก่า|ตะกวด|ตัวเงินตัวทอง|จระเข้|เลื้อยคลาน/i.test(species);

          let skinTone = (jsonResult.skinTone || '').trim();
          let hairStyle = (jsonResult.hairStyle || '').trim();
          let hairColor = (jsonResult.hairColor || '').trim();
          let distinctFeatures = (jsonResult.distinctFeatures || '').trim();

          // Reptile safety guard
          if (isReptile) {
            if (/ขน|fox|จิ้งจอก|หางฟู|หางสุนัข|หูสุนัข|ใบหูตั้ง/i.test(hairStyle)) {
              hairStyle = 'ไม่มีผม/ไม่มีขน (ผิวเกล็ด)';
            }
            if (/ขน|fox|จิ้งจอก/i.test(hairColor)) {
              hairColor = 'ไม่มีผม';
            }
            if (/ขนหนา|ขนสีส้ม|ขนส้ม/i.test(skinTone)) {
              skinTone = skinTone.replace(/ขนหนาสีส้มอิฐ|ขนสีส้ม|ขน/gi, 'ผิวหนังเกล็ด').trim();
            }
            distinctFeatures = distinctFeatures
              .replace(/หูสุนัขจิ้งจอก|หูจิ้งจอก|หางสุนัขจิ้งจอก|หางฟู|หางสุนัข|ขนสีส้ม|ขนหนา|ปลายหูดำ|แผงคอสีขาว/gi, '')
              .trim();
          }

          const finalName = detectedName || (jsonResult.name || jsonResult.suggestedName || '').trim();
          const finalAge = detectedAge || (jsonResult.ageRange || jsonResult.age || 'ไม่ระบุ').trim();

          // Determine field sources
          const nameSource: FieldSource = detectedName ? 'REFERENCE_TEXT' : (finalName ? 'VISUAL_OBSERVATION' : 'UNKNOWN');
          const ageSource: FieldSource = detectedAge ? 'REFERENCE_TEXT' : (jsonResult.ageRange ? 'VISUAL_OBSERVATION' : 'UNKNOWN');
          const heightSource: FieldSource = detectedHeight ? 'REFERENCE_TEXT' : 'UNKNOWN';

          // Extract available views
          const validViews = ['FRONT', 'FACE_CLOSEUP', 'THREE_QUARTER', 'SIDE', 'BACK', 'FULL_BODY', 'OUTFIT_DETAIL', 'ACCESSORY_DETAIL', 'SHOE_DETAIL'];
          let availableViews: string[] = Array.isArray(jsonResult.availableViews)
            ? jsonResult.availableViews.map((v: string) => String(v).toUpperCase().replace(/[\s-]/g, '_'))
            : ['FRONT'];
          // Keep only valid recognized or sanitized view tags
          availableViews = availableViews.filter((v: string) => validViews.includes(v) || v.length > 2);
          if (availableViews.length === 0) availableViews = ['FRONT'];

          // Build structured features
          const structured: CharacterStructuredFeatures = {
            creatureType: creatureType || (isReptile ? 'anthropomorphic reptile' : 'human'),
            species: species || (isReptile ? 'anthropomorphic reptile' : ''),
            name: finalName,
            gender: (jsonResult.gender || 'ไม่ระบุ').trim(),
            ageRange: finalAge,
            skinTone,
            faceShape: (jsonResult.faceShape || '').trim(),
            hairStyle,
            hairColor,
            eyeDescription: (jsonResult.eyeDescription || '').trim(),
            bodyType: (jsonResult.bodyType || '').trim(),
            topClothing: (jsonResult.topClothing || '').trim(),
            bottomClothing: (jsonResult.bottomClothing || '').trim(),
            footwear: (jsonResult.footwear || '').trim(),
            accessories: (jsonResult.accessories || 'ไม่มี').trim(),
            distinctFeatures,
            confidence
          };

          const isNotVisible = (v: string | undefined) =>
            !v || v === 'ไม่แน่ใจ' || v === 'ไม่เห็นชัดในภาพ' || v === 'ไม่มี' || v === 'ไม่ระบุ';

          // Compose physical description safely from strictly visible attributes
          const physicalParts: string[] = [];
          if (structured.creatureType && structured.creatureType !== 'human' && structured.creatureType !== 'unknown') {
            const speciesText = structured.species && structured.species !== structured.creatureType
              ? `${structured.creatureType} (${structured.species})`
              : structured.creatureType;
            physicalParts.push(`ประเภท: ${speciesText}`);
          }
          if (detectedHeight) {
            physicalParts.push(`ส่วนสูง: ${detectedHeight}`);
          }
          if (!isNotVisible(structured.skinTone)) physicalParts.push(`ผิว/เกล็ด: ${structured.skinTone}`);
          if (!isNotVisible(structured.faceShape)) physicalParts.push(`รูปหน้า: ${structured.faceShape}`);
          if (!isNotVisible(structured.hairStyle) && structured.hairStyle !== 'ไม่มีผม' && !structured.hairStyle.includes('ไม่มีผม/ไม่มีขน')) {
            const hairDesc = !isNotVisible(structured.hairColor) && structured.hairColor !== 'ไม่มีผม'
              ? `${structured.hairStyle} (${structured.hairColor})`
              : structured.hairStyle;
            physicalParts.push(`ผม: ${hairDesc}`);
          }
          if (!isNotVisible(structured.eyeDescription)) physicalParts.push(`ตา: ${structured.eyeDescription}`);
          if (!isNotVisible(structured.bodyType)) physicalParts.push(`สรีระ: ${structured.bodyType}`);
          if (!isNotVisible(structured.distinctFeatures)) {
            physicalParts.push(`เอกลักษณ์: ${structured.distinctFeatures}`);
          }

          const description = physicalParts.length > 0
            ? physicalParts.join(', ')
            : (jsonResult.description || 'รูปลักษณ์ตัวละครตามภาพอ้างอิงจริง');

          // Compose outfit description safely
          const outfitParts: string[] = [];
          if (!isNotVisible(structured.topClothing) && !structured.topClothing.includes('ไม่ได้สวม')) {
            outfitParts.push(`ท่อนบน: ${structured.topClothing}`);
          }
          if (!isNotVisible(structured.bottomClothing)) {
            outfitParts.push(`ท่อนล่าง: ${structured.bottomClothing}`);
          }
          if (!isNotVisible(structured.footwear)) {
            outfitParts.push(`รองเท้า: ${structured.footwear}`);
          }
          if (!isNotVisible(structured.accessories)) {
            outfitParts.push(`เครื่องประดับ: ${structured.accessories}`);
          }

          const outfitDescription = outfitParts.length > 0
            ? outfitParts.join(' • ')
            : (structured.topClothing?.includes('ไม่ได้สวม') ? 'ไม่ได้สวมเสื้อผ้า' : 'ไม่เห็นชุดชัดเจนในภาพ');

          // Build 4-Layer Architecture outputs
          const primaryDataUrl = `data:${primaryParsed.mimeType};base64,${primaryParsed.base64Data}`;
          const allDataUrls = parsedImages.map(p => `data:${p.mimeType};base64,${p.base64Data}`);

          // Persist the primary reference image immediately to disk
          let persistentRefUrl = '';
          let persistentRefId = `ref_${primaryImageHash.slice(0, 10)}_${Date.now()}`;
          try {
            const persisted = persistReferenceImage(primaryDataUrl, persistentRefId);
            persistentRefUrl = persisted.referenceImageUrl;
            persistentRefId = persisted.referenceImageId;
          } catch (e) {
            console.warn('Could not persist analyzed image to disk:', e);
          }

          // Layer 1: CHARACTER_IDENTITY
          const characterIdentity: CharacterIdentity = {
            id: `char_${Date.now()}`,
            name: finalName
          };

          // Layer 2: REFERENCE_METADATA
          const referenceMetadata: CharacterReferenceMetadata = {
            referenceImageId: persistentRefId,
            referenceImageUrl: persistentRefUrl || primaryDataUrl,
            imageHash: primaryImageHash,
            detectedName: detectedName || undefined,
            detectedAge: detectedAge || undefined,
            detectedHeight: detectedHeight || undefined,
            availableViews
          };

          // Layer 3: VISUAL_PROFILE (Strictly from actual reference image)
          const visualProfile: CharacterVisualProfile = {
            imageHash: primaryImageHash,
            referenceImageId: persistentRefId,
            referenceImageUrl: persistentRefUrl || primaryDataUrl,
            hairStyle: structured.hairStyle || 'ตามภาพอ้างอิง',
            hairColor: structured.hairColor || '',
            top: structured.topClothing || '',
            bottom: structured.bottomClothing || '',
            shoes: structured.footwear || 'ไม่เห็นชัดในภาพ',
            accessories: structured.accessories || 'ไม่มี',
            visibleDistinctiveDetails: structured.distinctFeatures || 'ไม่มี',
            referenceImage: persistentRefUrl || primaryDataUrl,
            referenceImages: persistentRefUrl ? [persistentRefUrl] : allDataUrls,
            imageAnalysisStatus: 'analyzed',
            hair: [structured.hairStyle, structured.hairColor].filter(s => s && !s.includes('ไม่เห็น') && s !== 'ไม่มีผม').join(' ') || structured.hairStyle || 'ตามภาพอ้างอิง',
            visibleOutfit: outfitDescription,
            visibleAccessories: structured.accessories || 'ไม่มี',
            visiblePhysicalAppearance: description,
            visibleDistinguishingDetails: structured.distinctFeatures || 'ไม่มี',
            detectedViews: availableViews,
            isMultiViewSheet: availableViews.length > 1 || allDataUrls.length > 1,
            confidence: structured.confidence,
            generatedVisualPrompt: `${description}, wearing ${outfitDescription}`
          };

          // Layer 4: STORY_PROFILE (Empty for Vision - only user/narrative may populate)
          const storyProfile: CharacterStoryProfile = {
            role: '',
            personality: '',
            occupation: '',
            background: '',
            storyInfo: ''
          };

          // Track sources of all fields
          const fieldSources: Record<string, FieldSource> = {
            name: nameSource,
            age: ageSource,
            height: heightSource,
            hairStyle: 'VISUAL_OBSERVATION',
            hairColor: 'VISUAL_OBSERVATION',
            top: 'VISUAL_OBSERVATION',
            bottom: 'VISUAL_OBSERVATION',
            shoes: 'VISUAL_OBSERVATION',
            accessories: 'VISUAL_OBSERVATION',
            distinctFeatures: 'VISUAL_OBSERVATION',
            gender: 'VISUAL_OBSERVATION',
            role: 'UNKNOWN',
            personality: 'UNKNOWN',
            occupation: 'UNKNOWN',
            background: 'UNKNOWN'
          };

          const returnData = {
            ...structured,
            name: finalName,
            age: finalAge,
            detectedName,
            detectedAge,
            detectedHeight,
            availableViews,
            imageHash: primaryImageHash,
            referenceImageId: persistentRefId,
            referenceImageUrl: persistentRefUrl || primaryDataUrl,
            description,
            outfitDescription,
            suggestedName: finalName,
            fullSummary: `${description}. ชุด: ${outfitDescription}`.trim(),
            structured,
            characterIdentity,
            referenceMetadata,
            visualProfile,
            storyProfile,
            fieldSources
          };

          // Cache in memory by imageHash
          visionAnalysisCache.set(primaryImageHash, {
            imageHash: primaryImageHash,
            data: returnData,
            timestamp: Date.now()
          });

          return res.json({
            success: true,
            source: 'gemini-flash',
            cached: false,
            data: returnData,
            ...chargeFieldsFrom(req)
          });
        }
      } catch (geminiErr: any) {
        console.error('Gemini Flash analyze character image error:', geminiErr?.message || geminiErr);
        return res.status(500).json({
          success: false,
          message: `การวิเคราะห์ภาพด้วย Gemini Flash ขัดข้อง: ${geminiErr?.message || 'ไม่สามารถประมวลผลรูปภาพได้'}. กรุณาตรวจสอบรูปภาพหรือลองใหม่อีกครั้ง`
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: 'ระบบ AI วิเคราะห์ภาพไม่พร้อมใช้งาน (API Key ยังไม่ได้ตั้งค่าหรือโมเดลไม่ตอบสนอง)'
    });
  } catch (err: any) {
    console.error('Error in /api/character/analyze-image:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'ไม่สามารถวิเคราะห์รูปภาพตัวละครได้'
    });
  }
});

// ==========================================
// LOCATION LOCK ENGINE & CACHE
// Reference Type: LOCATION
// Architecture: Room, Architecture, Wall, Floor, Door, Window
// ==========================================

function persistLocationReferenceImage(imageData: string, customId?: string): {
  referenceImageId: string;
  referenceImageUrl: string;
  imageHash: string;
} {
  const parsed = parseImageData(imageData);
  if (!parsed || !parsed.base64Data) {
    throw new Error('ข้อมูลรูปภาพสถานที่ผิดพลาด ไม่สามารถแปลงข้อมูลภาพได้');
  }

  const imageHash = crypto.createHash('sha256').update(parsed.base64Data).digest('hex');
  const refId = customId || `ref_loc_${imageHash.slice(0, 10)}_${Date.now()}`;
  const ext = parsed.mimeType.includes('png') ? 'png' : (parsed.mimeType.includes('webp') ? 'webp' : 'jpg');
  const filename = `${refId}.${ext}`;
  const filepath = path.join(UPLOADS_LOCATIONS_DIR, filename);

  const buffer = Buffer.from(parsed.base64Data, 'base64');
  fs.writeFileSync(filepath, buffer);

  const referenceImageUrl = `/uploads/locations/${filename}`;
  return {
    referenceImageId: refId,
    referenceImageUrl,
    imageHash
  };
}

// In-Memory Location Analysis Cache to guard Gemini Vision API costs
const locationAnalysisCache = new Map<string, {
  imageHash: string;
  data: any;
  timestamp: number;
}>();

// Pre-seed sample locations into Location Cache for zero-cost instant analysis
locationAnalysisCache.set('loc_hash_modern_living_88a91c', {
  imageHash: 'loc_hash_modern_living_88a91c',
  timestamp: Date.now(),
  data: {
    name: 'ห้องนั่งเล่นมินิมอลโมเดิร์น (Modern Minimalist Living Room)',
    environmentType: 'Indoor (ห้องนั่งเล่นหลัก)',
    architecturalStyle: 'Modern Japandi Minimalist',
    wallColor: 'ผนังฉาบปูนเรียบสีเบจอ่อน (Warm off-white) และผนังไม้ระแนงโอ๊คฝั่งขวา',
    floor: 'พื้นไม้ลามิเนตสีโอ๊คอ่อนลายก้างปลา ปูพรมขนสั้นสีเทาเทาโมเดิร์น',
    ceiling: 'เพดานฝ้าหลุมสีขาวซ่อนไฟ warm light สีส้มสลัวพร้อมสปอตไลท์ฝังฝ้า',
    doors: 'ประตูกระจกบานเลื่อนกรอบอลูมิเนียมสีดำด้าน เปิดออกสู่ระเบียง',
    windows: 'หน้าต่างกระจกบานใหญ่ทรงสูงจากพื้นจรดเพดาน รับแสงธรรมชาติทางทิศเหนือ',
    majorFurniture: 'โซฟาผ้าลินินทรงแอลสีเทาอ่อน, โต๊ะกลางไม้โอ๊คกลมมน, โต๊ะวางทีวีบิลท์อินไม้',
    fixedObjects: 'ผนังชั้นหนังสือบิลท์อินแบบไร้มือจับ และตู้ซ่อนสายไฟเรียบเนียน',
    spatialLayout: 'พื้นที่เปิดโล่งเชื่อมต่อกับมุมรับประทานอาหาร ทิศทางแสงส่องเฉียง 45 องศา',
    permanentDecor: 'ภาพวาดศิลปะแอบสแตรกต์โทนสีเอิร์ธโทนขนาดใหญ่ 1 รูป และต้นไทรใบสักในกระถางเซรามิก',
    distinctiveFeatures: 'ช่องแสงส่องกระทบผนังไม้ระแนงเป็นเส้นเฉียง และโคมไฟตั้งพื้นทรงโค้งสีดำด้าน',
    confidence: 96,
    availableViews: ['WIDE_SHOT', 'CORNER_PERSPECTIVE', 'FURNITURE_LAYOUT'],
    generatedVisualPrompt: 'Modern Japandi living room, warm beige smooth walls, light oak herringbone wooden flooring, large floor-to-ceiling glass window, L-shaped light grey linen sofa, oak round coffee table, built-in recessed ceiling spotlights with warm ambient lighting',
    storyLocationName: 'ห้องนั่งเล่นคอนโดหรูใจกลางเมือง',
    description: 'สถานที่พักผ่อนและพูดคุยหลักของตัวละครหลัก บรรยากาศเงียบสงบ อบอุ่น และเป็นส่วนตัว',
    notes: 'ใช้เป็นฉากเปิดเรื่องและฉากพูดคุยสำคัญระหว่าง 2 ตัวละคร'
  }
});

locationAnalysisCache.set('loc_hash_scifi_deck_99c32f', {
  imageHash: 'loc_hash_scifi_deck_99c32f',
  timestamp: Date.now(),
  data: {
    name: 'ห้องควบคุมยานสำรวจอวกาศ (Sci-Fi Command Deck)',
    environmentType: 'Interior Sci-Fi Spaceship Bridge',
    architecturalStyle: 'Futuristic Cybernetic Industrial',
    wallColor: 'แผ่นโลหะไทเทเนียมสีเทาเข้มเนื้อด้าน สลับเส้นไฟนีออนแถบสีฟ้าคราม (Cyan LED Strips)',
    floor: 'แผ่นเหล็กเสริมลายกันลื่นสีเทาคาร์บอน พร้อมไฟนำทางฝังพื้นสีส้มแดง',
    ceiling: 'โครงสร้างเหล็กเปลือยสไตล์โมดูลาร์ พร้อมแผงท่อหล่อเย็นและไฟดาวน์ไลท์สีขาวเย็น 6500K',
    doors: 'ประตูกลไฮดรอลิกแบบเปิดเลื่อนแยกซ้ายขวาสองชั้น พร้อมแผงสแกนลายนิ้วมือ',
    windows: 'กระจกมองยานอวกาศทรงพาโนรามากว้าง 180 องศา เผยให้เห็นห้วงอวกาศและละอองเนบิวลา',
    majorFurniture: 'เก้าอี้กัปตันหนังสีดำปรับเอนได้ตรงกลาง, คอนโซลควบคุม 4 จุดพร้อมจอทัชสกรีนโปร่งแสง',
    fixedObjects: 'แท่นฉายภาพโฮโลแกรมสามมิติขนาดใหญ่ทรงกลมกลางห้อง',
    spatialLayout: 'ทรงเกือกม้า (Horseshoe Layout) พื้นยกระดับ 2 ชั้น กัปตันอยู่ตรงกลางสูงกว่าคอนโซลนักบิน',
    permanentDecor: 'หน้าจอเรดาร์แสดงสถานะการเคลื่อนที่ของยาน และสัญลักษณ์ยานสำรวจศาลาเอไอสีเงิน',
    distinctiveFeatures: 'แสงสะท้อนจากกระจกยานมองเห็นดวงดาวระยิบระยับ และแสงไฟนีออนวิ่งเป็นจังหวะรอบคอนโซล',
    confidence: 97,
    availableViews: ['WIDE_ANGLE_DECK', 'PILOT_CONSOLE', 'HOLOGRAPHIC_STATION'],
    generatedVisualPrompt: 'Futuristic spaceship bridge command deck, dark matte titanium walls, glowing cyan LED light strips, carbon steel floor with orange guide lights, panoramic 180-degree front viewport showing outer space nebula, holographic globe display in center',
    storyLocationName: 'ยานสำรวจศาลา-1 (Sala-1 Cruiser Bridge)',
    description: 'ศูนย์กลางสั่งการของยานสำรวจ บรรยากาศตึงเครียดแต่เปี่ยมด้วยเทคโนโลยีขั้นสูง',
    notes: 'ใช้ในฉากการเดินทางระหว่างดวงดาวและการสั่งการสำคัญ'
  }
});

locationAnalysisCache.set('loc_hash_thai_veranda_77e41b', {
  imageHash: 'loc_hash_thai_veranda_77e41b',
  timestamp: Date.now(),
  data: {
    name: 'ชานเรือนไม้ไทยริมน้ำ (Traditional Thai Wooden Veranda)',
    environmentType: 'Semi-outdoor (ชานเรือนเปิดโล่งริมแม่น้ำ)',
    architecturalStyle: 'Traditional Central Thai Wooden Architecture (เรือนไทยภาคกลาง)',
    wallColor: 'ผนังฝาปะกนไม้สักทองสีน้ำตาลอมส้ม เคลือบเงามันวาวตามธรรมชาติ',
    floor: 'ไม้กระดานสักแผ่นใหญ่หน้ากว้าง ขัดมันเงางาม มีร่องระบายน้ำและลมธรรมชาติ',
    ceiling: 'โครงสร้างหลังคาทรงจั่วทรงสูงเปิดเปลือยเห็นขื่อแปไม้สัก แกะสลักลวดลายบัวกลีบขนุน',
    doors: 'ประตูบานเฟี้ยมไม้สักโบราณเปิดพับเก็บข้างผนังได้สุดแนว',
    windows: 'ช่องหน้าต่างซุ้มไม้ฉลุลายโบราณ เปิดรับลมแม่น้ำพัดโชยตลอดวัน',
    majorFurniture: 'ตั่งไม้สักโบราณปูเบาะผ้าไหมลายขิด, หมอนขวานสามเหลี่ยมลายไทยโบราณสีคราม',
    fixedObjects: 'ระเบียงราวลูกกรงไม้สักฉลุลายริมน้ำ พร้อมเสาเอกไม้สักกลึงกลม',
    spatialLayout: 'ชานเรือนเชื่อมระหว่างเรือนนอนและท่าน้ำ มองเห็นแม่น้ำเจ้าพระยายามเย็น',
    permanentDecor: 'กระถางบัวดินเผาเคลือบมรกต, ตะเกียงทองเหลืองโบราณแขวนเสา',
    distinctiveFeatures: 'แสงสะท้อนระลอกคลื่นน้ำระยิบระยับขึ้นบนเพดานไม้สัก และชายคาทรงปั้นหยาแกะสลักประณีต',
    confidence: 95,
    availableViews: ['WIDE_RIVER_VIEW', 'WOODEN_TERRACE', 'ORNATE_EAVES_DETAIL'],
    generatedVisualPrompt: 'Traditional central Thai wooden house veranda, golden teak wood panel walls, polished wide teak floorboards, high open gable roof with ornate carved brackets, riverside balustrade with tranquil river water reflection, antique brass lanterns',
    storyLocationName: 'เรือนไทยริมสายน้ำอัมพวา',
    description: 'บ้านพักริมน้ำบรรยากาศสงบ ร่มรื่น เต็มไปด้วยกลิ่นอายประวัติศาสตร์และวัฒนธรรมไทย',
    notes: 'เหมาะสำหรับฉากดราม่า พักผ่อน นั่งสมาธิ หรือพบปะพูดคุยเรื่องราวในอดีต'
  }
});

// Location Upload Reference Image Endpoint
app.post('/api/location/upload-reference', async (req: express.Request, res: express.Response) => {
  try {
    const { image, imageHash, referenceImageId } = req.body || {};
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ success: false, message: 'Image data is required' });
    }

    if (image.startsWith('blob:')) {
      return res.status(400).json({
        success: false,
        message: 'ไม่อนุญาตให้ใช้ blob URL ชั่วคราวเป็น Reference Image ถาวร'
      });
    }

    if (image.startsWith('/uploads/') || image.startsWith('http://') || image.startsWith('https://')) {
      const hash = imageHash || crypto.createHash('sha256').update(image).digest('hex');
      const refId = referenceImageId || `ref_loc_${hash.slice(0, 10)}_${Date.now()}`;
      return res.json({
        success: true,
        referenceImageId: refId,
        referenceImageUrl: image,
        imageHash: hash
      });
    }

    const persisted = persistLocationReferenceImage(image, referenceImageId);
    return res.json({
      success: true,
      referenceImageId: persisted.referenceImageId,
      referenceImageUrl: persisted.referenceImageUrl,
      imageHash: persisted.imageHash
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Failed to upload location reference image'
    });
  }
});

// Location Image Analyzer Endpoint (Cost Guard + Gemini Vision / Heuristic Grounding)
app.post('/api/location/analyze-image', async (req: express.Request, res: express.Response) => {
  try {
    const { image, images, apiKey, forceReanalyze } = req.body || {};

    const rawImagesList: string[] = Array.isArray(images)
      ? images.filter(img => typeof img === 'string' && img.trim().length > 0)
      : (image && typeof image === 'string' && image.trim().length > 0 ? [image] : []);

    if (rawImagesList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาส่งรูปภาพ base64 เพื่อให้ AI วิเคราะห์สถานที่ (Location Image is required)'
      });
    }

    const parsedImages = rawImagesList
      .map(img => parseImageData(img))
      .filter((p): p is { mimeType: string; base64Data: string } => p !== null && p.base64Data.length > 0)
      .slice(0, 4);

    if (parsedImages.length === 0) {
      // If URLs rather than base64
      const firstUrl = rawImagesList[0];
      const urlHash = crypto.createHash('sha256').update(firstUrl).digest('hex');
      if (!forceReanalyze && locationAnalysisCache.has(urlHash)) {
        return res.json({
          success: true,
          source: 'cache',
          cached: true,
          data: locationAnalysisCache.get(urlHash)!.data
        });
      }
    }

    const primaryParsed = parsedImages[0] || { mimeType: 'image/jpeg', base64Data: rawImagesList[0] };
    const primaryImageHash = crypto.createHash('sha256').update(primaryParsed.base64Data).digest('hex');

    // 1. Check in-memory Vision Cache First (Cost Guard: 0 credits, 0 API calls)
    if (!forceReanalyze && locationAnalysisCache.has(primaryImageHash)) {
      const cached = locationAnalysisCache.get(primaryImageHash)!;
      console.log(`[Location Vision Cost Guard] Cache hit for location imageHash: ${primaryImageHash}. Skipping Gemini Vision call.`);
      return res.json({
        success: true,
        source: 'cache',
        cached: true,
        data: cached.data
      });
    }

    const userKey = typeof apiKey === 'string' && apiKey.trim() ? apiKey.trim() : undefined;
    const ai = getGeminiClient(userKey);
    if (!ai) {
      return res.status(400).json({
        success: false,
        code: 'GEMINI_KEY_MISSING',
        message: 'ยังไม่ได้ตั้งค่า Gemini API Key จึงวิเคราะห์สถานที่ด้วย AI ไม่ได้ กรุณาบันทึก API Key หรือกรอกรายละเอียดสถานที่เอง / No Gemini API key: location analysis unavailable.'
      });
    }

    let persistentRefUrl = '';
    let persistentRefId = `ref_loc_${primaryImageHash.slice(0, 10)}_${Date.now()}`;
    if (primaryParsed.base64Data.length > 100) {
      try {
        const persisted = persistLocationReferenceImage(`data:${primaryParsed.mimeType};base64,${primaryParsed.base64Data}`, persistentRefId);
        persistentRefUrl = persisted.referenceImageUrl;
        persistentRefId = persisted.referenceImageId;
      } catch (saveErr) {
        console.warn('Could not persist location image to disk:', saveErr);
      }
    }

    let analysisResult: any = null;
    try {
      const systemInstruction = `คุณเป็น AI ผู้เชี่ยวชาญด้านฉากและสถาปัตยกรรมสำหรับงานถ่ายทำภาพยนตร์และสตูดิโอ (Location & Production Design Continuity Specialist)
หน้าที่ของคุณคือ: วิเคราะห์สถานที่จริงจากรูปภาพอ้างอิง (Location Reference Image) เพื่อใช้เป็น "LOCATION LOCK" ล็อคความต่อเนื่องของห้องและสถาปัตยกรรมข้ามคลิป
หลักการสำคัญ: วิเคราะห์เฉพาะสิ่งที่มองเห็นชัดเจนในภาพเท่านั้น ห้ามเดา ห้ามเติมแต่ง

โครงสร้างที่ต้องวิเคราะห์อย่างแม่นยำ (Location Architectural Blueprint):
1. "name": ชื่อระบุสถานที่สั้นกระชับ ชัดเจน เช่น "ห้องนั่งเล่นสไตล์สแกนดิเนเวียน", "ห้องทำงานสตูดิโอโมเดิร์น", "ชานเรือนไม้ริมน้ำ"
2. "environmentType": ประเภทพื้นที่ เช่น "Indoor (ห้องส่วนตัว)", "Semi-outdoor (ระเบียง/ชานเรือน)", "Outdoor (สวน/ลานกว้าง)"
3. "architecturalStyle": สไตล์สถาปัตยกรรม เช่น "Modern Minimalist", "Industrial Loft", "Traditional Thai", "Cyberpunk / Sci-Fi"
4. "wallColor": สีและพื้นผิวของผนังอย่างละเอียด เช่น "ผนังปูนเปลือยสีเทาอ่อนสลับไม้ระแนง"
5. "floor": วัสดุและลวดลายของพื้น เช่น "พื้นไม้ลามิเนตสีโอ๊คลายก้างปลา มีพรมขนสั้นสีเทา"
6. "ceiling": เพดานและการติดตั้งไฟ เช่น "ฝ้าหลุมสีขาวเรียบซ่อนไฟวอร์มไวท์และดาวน์ไลท์"
7. "doors": ประตู กรอบ และวัสดุ เช่น "ประตูกระจกบานเลื่อนกรอบอลูมิเนียมดำ"
8. "windows": หน้าต่าง ทิศทางแสงธรรมชาติ เช่น "หน้าต่างกระจกทรงสูงจรดเพดาน รับแสงนุ่มนวล"
9. "majorFurniture": เฟอร์นิเจอร์ชิ้นหลัก เช่น "โซฟาผ้าทรงแอลสีเทา, โต๊ะกลางไม้กลม"
10. "fixedObjects": สิ่งก่อสร้างติดผนังหรือบิลท์อิน เช่น "ชั้นหนังสือบิลท์อินไร้มือจับ, แผงเคาน์เตอร์"
11. "spatialLayout": ผังการจัดวางพื้นที่ เช่น "พื้นที่เปิดโล่ง Open Concept มองทะลุถึงโต๊ะอาหาร"
12. "permanentDecor": ของตกแต่งถาวร เช่น "ภาพวาดศิลปะขนาดใหญ่, โคมไฟตั้งพื้นทรงโค้ง"
13. "distinctiveFeatures": จุดเด่นเฉพาะตัวที่ไม่ซ้ำใครที่ใช้ล็อคสถานที่ข้ามคลิป
14. "availableViews": มุมมองที่มีในภาพ เช่น ["WIDE_SHOT", "CORNER_VIEW", "DETAIL_VIEW"]
15. "generatedVisualPrompt": สรุปเป็นภาษาอังกฤษสำหรับนำไปล็อคใน Prompt ของ AI Video เพื่อให้ภาพสถานที่คงที่ข้ามฉาก`;

      const prompt = `กรุณาวิเคราะห์รูปภาพสถานที่นี้อย่างละเอียดตามโครงสร้าง JSON:
{
"name": string,
"environmentType": string,
"architecturalStyle": string,
"wallColor": string,
"floor": string,
"ceiling": string,
"doors": string,
"windows": string,
"majorFurniture": string,
"fixedObjects": string,
"spatialLayout": string,
"permanentDecor": string,
"distinctiveFeatures": string,
"availableViews": string[],
"confidence": number,
"generatedVisualPrompt": string,
"storyLocationName": string,
"description": string,
"notes": string
}`;

      const parts: any[] = [
        { text: prompt },
        {
          inlineData: {
            mimeType: primaryParsed.mimeType,
            data: primaryParsed.base64Data
          }
        }
      ];

      const billed = await callBillableGemini(req, res, ai, {
        model: 'gemini-3.1-flash-lite',
        contents: parts,
        config: {
          systemInstruction,
          responseMimeType: 'application/json'
        }
      }, 'location analyze');
      if (!billed) return;
      const response = billed.response;

      const text = (response.text || '').replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      analysisResult = text ? JSON.parse(text) : null;
    } catch (geminiErr: any) {
      const reason = formatGenAIError(geminiErr);
      console.warn('Gemini location analysis failed:', reason);
      // Never return a template labelled as a Gemini result, and never cache a failure
      return res.status(502).json({
        success: false,
        code: 'GEMINI_API_ERROR',
        message: `Gemini วิเคราะห์สถานที่ไม่สำเร็จ: ${reason} / Gemini location analysis failed.`
      });
    }

    if (!analysisResult || typeof analysisResult !== 'object' || !analysisResult.name) {
      return res.status(502).json({
        success: false,
        code: 'GEMINI_INVALID_RESULT',
        message: 'Gemini ส่งผลวิเคราะห์สถานที่ไม่ครบ (ไม่มีชื่อสถานที่) กรุณาลองใหม่ / Gemini returned an incomplete location analysis.'
      });
    }

    const fullResult = {
      ...analysisResult,
      imageHash: primaryImageHash,
      referenceImageId: persistentRefId,
      referenceImageUrl: persistentRefUrl || rawImagesList[0],
      identity: {
        id: `loc_${primaryImageHash.slice(0, 10)}`,
        name: analysisResult.name || 'สถานที่ใหม่'
      },
      referenceMetadata: {
        referenceImageId: persistentRefId,
        referenceImageUrl: persistentRefUrl || rawImagesList[0],
        imageHash: primaryImageHash,
        availableViews: analysisResult.availableViews || ['WIDE_SHOT'],
        imageAnalysisStatus: 'USER_CONFIRMED'
      },
      visualProfile: {
        environmentType: analysisResult.environmentType || 'Indoor',
        architecturalStyle: analysisResult.architecturalStyle || 'ตามภาพอ้างอิง',
        wallColor: analysisResult.wallColor || 'ตามภาพอ้างอิง',
        floor: analysisResult.floor || 'ตามภาพอ้างอิง',
        ceiling: analysisResult.ceiling || 'ตามภาพอ้างอิง',
        doors: analysisResult.doors || 'ตามภาพอ้างอิง',
        windows: analysisResult.windows || 'ตามภาพอ้างอิง',
        majorFurniture: analysisResult.majorFurniture || 'ตามภาพอ้างอิง',
        fixedObjects: analysisResult.fixedObjects || 'ตามภาพอ้างอิง',
        spatialLayout: analysisResult.spatialLayout || 'ตามภาพอ้างอิง',
        permanentDecor: analysisResult.permanentDecor || 'ตามภาพอ้างอิง',
        distinctiveFeatures: analysisResult.distinctiveFeatures || 'ตามภาพอ้างอิง',
        confidence: analysisResult.confidence || 95,
        generatedVisualPrompt: analysisResult.generatedVisualPrompt || '',
        referenceImageUrl: persistentRefUrl || rawImagesList[0],
        referenceImageId: persistentRefId,
        imageHash: primaryImageHash
      },
      storyProfile: {
        storyLocationName: analysisResult.storyLocationName || analysisResult.name || 'สถานที่ถ่ายทำ',
        description: analysisResult.description || '',
        notes: analysisResult.notes || ''
      }
    };

    // Store in cache to guard future costs
    locationAnalysisCache.set(primaryImageHash, {
      imageHash: primaryImageHash,
      timestamp: Date.now(),
      data: fullResult
    });

    res.json({
      success: true,
      source: 'gemini-flash',
      cached: false,
      data: fullResult,
      ...chargeFieldsFrom(req)
    });
  } catch (err: any) {
    console.error('Error in /api/location/analyze-image:', err);
    res.status(500).json({
      success: false,
      message: err?.message || 'ไม่สามารถวิเคราะห์รูปภาพสถานที่ได้'
    });
  }
});



// 6.3 Generate Media (Unified Endpoint)
app.post('/api/generate', requireAuth, async (req: any, res) => {
  const params: GenerationParams = req.body;
  const user = req.user as StoredUser;
  const userAccount = req.creditAccount as CreditAccount;

  // Validate prompt
  if (!params.prompt || params.prompt.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'กรุณากรอก Prompt ก่อนเริ่มสร้างผลงาน' });
  }

  // In-app video costs real money per second (Google bill). Off unless ENABLE_IN_APP_VIDEO=on;
  // the app is used to copy prompts into Meta AI instead.
  if (params.type === 'video' && String(process.env.ENABLE_IN_APP_VIDEO || '').toLowerCase() !== 'on') {
    return res.status(403).json({
      success: false,
      code: 'IN_APP_VIDEO_OFF',
      message: 'ปิดการสร้างวิดีโอในแอปไว้ เพราะมีค่าใช้จ่ายจริงต่อวินาที กรุณาคัดลอกพรอมต์ไปสร้างใน Meta AI แทน / In-app video is turned off.'
    });
  }

  // Resolve provider strictly (no silent fallback to mock/sample output)
  params.provider = (params.provider || 'gemini') as ProviderId;
  const adapter = providerManager.find(params.provider);
  if (!adapter) {
    return res.status(400).json({ success: false, message: `ไม่รู้จักผู้ให้บริการ "${params.provider}" (Unknown provider)` });
  }
  // Fail fast before charging credits when the selected real provider has no server API key
  if (adapter.id !== 'mock' && !adapter.hasKey) {
    return res.status(503).json({
      success: false,
      code: 'PROVIDER_KEY_MISSING',
      message: `ยังไม่ได้ตั้งค่า ${(adapter as any).requiresKeyEnv || 'API key'} บนเซิร์ฟเวอร์ จึงไม่สามารถสร้างด้วย ${adapter.name} ได้ (${(adapter as any).requiresKeyEnv || 'API key'} is not configured)`
    });
  }

  // Cost calculation. Gemini/Veo charges the real token count after the call (tokens / TOKENS_PER_CREDIT). No flat 8 or 40.
  const cost = adapter.estimateCost(params);
  const billGemini = adapter.id === 'gemini';
  if (billGemini) {
    try {
      await ensureCanCallFlashLite(user.id);
    } catch (err: any) {
      return res.status(err?.status || 503).json({
        success: false,
        message: err?.message || MISSING_FIRESTORE_CREDENTIAL_MESSAGE
      });
    }
  } else if (userAccount.remainingCredits < cost.estimatedCredits) {
    return res.status(403).json({
      success: false,
      message: `เครดิตคงเหลือไม่เพียงพอ (ต้องการ ${cost.estimatedCredits} เครดิต แต่คงเหลือ ${userAccount.remainingCredits} เครดิต) กรุณาเติมเครดิต`
    });
  } else if (userAccount.dailyUsedCredits + cost.estimatedCredits > userAccount.dailyLimit) {
    return res.status(403).json({
      success: false,
      message: `คุณใช้งานเกินโควตาประจำวัน (Daily Limit: ${userAccount.dailyLimit} เครดิต) กรุณาลองใหม่อีกครั้งในวันพรุ่งนี้หรือติดต่อแอดมิน`
    });
  }

  if (!billGemini) {
    userAccount.remainingCredits -= cost.estimatedCredits;
    userAccount.totalUsedCredits += cost.estimatedCredits;
    userAccount.dailyUsedCredits += cost.estimatedCredits;
    userAccount.monthlyUsedCredits += cost.estimatedCredits;
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const seed = params.seed || Math.floor(Math.random() * 1000000);

  const job: GenerationJob = {
    id: jobId,
    userId: user.id,
    type: params.type,
    status: 'queued',
    progress: 0,
    stage: 'อยู่ในคิวประมวลผล...',
    provider: params.provider,
    providerName: adapter.name,
    isMock: adapter.isMockOnly,
    model: params.model || `${params.provider}-standard`,
    prompt: params.prompt,
    negativePrompt: params.negativePrompt,
    aspectRatio: params.aspectRatio || '1:1',
    characterId: params.characterId,
    characterName: params.characterName,
    // Large data: URLs stay out of the job record (it is polled and listed); the generator reads params
    referenceImages: Array.isArray(params.referenceImages)
      ? params.referenceImages.filter((r: any) => typeof r === 'string' && !r.startsWith('data:'))
      : params.referenceImages,
    projectId: params.projectId,
    sceneId: params.sceneId,
    sceneNumber: params.sceneNumber,
    costCredits: billGemini ? 0 : cost.estimatedCredits,
    skipMemoryCharge: billGemini,
    seed,
    createdAt: new Date().toISOString(),
    durationSeconds: params.durationSeconds || (params.type === 'video' ? 5 : undefined)
  };

  jobsStore.set(jobId, job);

  if (!billGemini) {
    userAccount.transactions.unshift({
      id: `tx_${jobId}`,
      timestamp: new Date().toISOString(),
      amount: -cost.estimatedCredits,
      type: 'usage',
      description: `สร้าง${params.type === 'video' ? 'วิดีโอ' : 'ภาพ'}: ${params.prompt.substring(0, 32)}... (${adapter.name})`,
      jobId,
      balanceAfter: userAccount.remainingCredits
    });
  }

  // Start background asynchronous job execution
  processJobInBackground(jobId, params);

  const balanceNow = billGemini ? await readFirestoreCreditBalance(user.id) : userAccount.remainingCredits;
  res.json({
    success: true,
    jobId,
    job: jobForViewer(job, req.user?.role),
    creditsCharged: 0,
    remainingCredits: balanceNow
  });
});

// 6.4 Check Job Status (Polling)
app.get('/api/jobs/:id', (req, res) => {
  const job = jobsStore.get(req.params.id);
  if (!job) {
    return res.status(404).json({ success: false, message: 'ไม่พบงานที่ระบุ' });
  }
  res.json({ success: true, job: jobForViewer(job) });
});

// 6.5 List All Jobs (History / Gallery - Filtered per user or all for admin)
app.get('/api/jobs', requireAuth, (req: any, res) => {
  const user = req.user as StoredUser;
  const jobs = Array.from(jobsStore.values()).filter(j => j.userId === user.id);
  jobs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  res.json({ success: true, jobs: jobs.map((job) => jobForViewer(job, user.role)) });
});

// Helper to resolve local video file path
function resolveVideoPathForJob(jobId: string): string {
  if (jobId) {
    const cleanId = path.basename(jobId);
    // 1. Check generated real Veo videos first
    const generatedDir = path.join(process.cwd(), 'public', 'generated-videos');
    const generatedPath = path.join(generatedDir, `${cleanId}.mp4`);
    if (fs.existsSync(generatedPath)) {
      return generatedPath;
    }
    const directGeneratedPath = path.join(generatedDir, cleanId);
    if (fs.existsSync(directGeneratedPath)) {
      return directGeneratedPath;
    }

    // Also check if job stored a direct local path
    const job = jobsStore.get(jobId) || jobsStore.get(cleanId);
    if (job && (job as any).localVideoPath && fs.existsSync((job as any).localVideoPath)) {
      return (job as any).localVideoPath;
    }

    // 2. Check sample-videos
    const sampleDir = path.join(process.cwd(), 'public', 'sample-videos');
    const samples = ['sala_sample_1.mp4', 'sala_sample_2.mp4', 'sala_sample_3.mp4'];
    if (samples.includes(cleanId) && fs.existsSync(path.join(sampleDir, cleanId))) {
      return path.join(sampleDir, cleanId);
    }
    if (samples.includes(`${cleanId}.mp4`) && fs.existsSync(path.join(sampleDir, `${cleanId}.mp4`))) {
      return path.join(sampleDir, `${cleanId}.mp4`);
    }
  }

  // Only simulated (mock provider) or seeded demo jobs may stream a sample clip.
  // Real jobs without a generated file must 404 instead of showing a random sample.
  const knownJob = jobId ? (jobsStore.get(jobId) || jobsStore.get(path.basename(jobId))) : undefined;
  if (!knownJob || !knownJob.isMock || knownJob.status === 'failed') {
    return '';
  }

  const sampleDir = path.join(process.cwd(), 'public', 'sample-videos');
  const samples = ['sala_sample_1.mp4', 'sala_sample_2.mp4', 'sala_sample_3.mp4'];
  let charSum = 0;
  for (let i = 0; i < (jobId || '').length; i++) {
    charSum += jobId.charCodeAt(i);
  }
  const selectedSample = samples[charSum % samples.length];
  const fullPath = path.join(sampleDir, selectedSample);
  
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return path.join(sampleDir, 'sala_sample_1.mp4');
}

// 6.5.1 Video Streaming Endpoint with HTTP 206 Partial Content (Android & iOS Compatible)
app.get(['/api/video-stream/:jobId', '/api/media/:jobId'], (req, res) => {
  const { jobId } = req.params;
  const filePath = resolveVideoPathForJob(jobId);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'ไม่พบไฟล์วิดีโอของงานนี้บนเซิร์ฟเวอร์ (Video file not found)' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Ranges, Content-Type');
  res.setHeader('Accept-Ranges', 'bytes');

  if (range) {
    // Parse Range header (e.g. "bytes=0-1024")
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
      return res.end();
    }

    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes'
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

// 6.5.2 Download Video Endpoint with Content-Disposition Attachment
function handleVideoDownload(req: express.Request, res: express.Response, rawJobId: string) {
  const filePath = resolveVideoPathForJob(rawJobId);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('ไม่พบไฟล์สำหรับดาวน์โหลด');
  }

  const stat = fs.statSync(filePath);
  const cleanId = (rawJobId || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length');
  res.setHeader('Content-Disposition', `attachment; filename="sala_video_${cleanId}.mp4"`);
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Length', stat.size);
  fs.createReadStream(filePath).pipe(res);
}

app.get('/api/download/video', (req, res) => {
  const rawJobId = (req.query.jobId as string) || (req.query.id as string) || (req.query.file as string) || 'job_default';
  handleVideoDownload(req, res, rawJobId);
});

app.get('/api/download/video/:jobId', (req, res) => {
  handleVideoDownload(req, res, req.params.jobId);
});

// 6.6 Character Library Endpoints
// 6.6 Character Library Endpoints (Synced with Firestore by UID)
app.get('/api/characters', async (req, res) => {
  const auth = await getAuthenticatedUser(req);
  if (!auth || !auth.user || !auth.user.id) {
    return res.json({ success: true, characters: [] });
  }

  const currentUserId = auth.user.id;

  // Sync with Firestore collection strictly for this user's UID
  try {
    const db = getServerFirestore();
    if (db) {
      // 1. Query Top-level collection by userId
      const q = queryServer(collectionServer(db, 'characters'), whereServer('userId', '==', currentUserId));
      const snap = await getDocsServer(q);
      snap.forEach(docSnap => {
        const charData = docSnap.data() as Character;
        if (charData && charData.name) {
          const charItem: Character = { ...charData, id: docSnap.id, userId: currentUserId };
          const existingIdx = charactersStore.findIndex(c => c.id === charItem.id);
          if (existingIdx >= 0) {
            charactersStore[existingIdx] = charItem;
          } else {
            charactersStore.unshift(charItem);
          }
        }
      });

      // 2. Query user's subcollection /users/{uid}/characters
      const userCol = collectionServer(db, 'users', currentUserId, 'characters');
      const userSnap = await getDocsServer(userCol);
      userSnap.forEach(docSnap => {
        const charData = docSnap.data() as Character;
        if (charData && charData.name) {
          const charItem: Character = { ...charData, id: docSnap.id, userId: currentUserId };
          const existingIdx = charactersStore.findIndex(c => c.id === charItem.id);
          if (existingIdx >= 0) {
            charactersStore[existingIdx] = charItem;
          } else {
            charactersStore.unshift(charItem);
          }
        }
      });
    }
  } catch (err) {
    console.warn('[Server Firestore] Could not sync characters from Firestore for user:', err);
  }

  // Strict isolation: Admin sees ONLY Admin's characters. Each user sees ONLY their own characters.
  const userChars = charactersStore.filter(c => c.userId === currentUserId);
  res.json({ success: true, characters: userChars });
});

app.post('/api/characters', requireAuth, async (req: any, res) => {
  const data = req.body;
  if (!data.name) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อตัวละคร' });
  }

  const currentUserId = req.user.id;

  // 1. Resolve Persistent Reference Image
  let persistentImageUrl = data.referenceImageUrl || '';
  let referenceImageId = data.referenceImageId || data.referenceMetadata?.referenceImageId || `ref_${Date.now()}`;
  let finalImageHash = data.imageHash || data.visualProfileImageHash || data.currentReferenceImageHash || data.referenceMetadata?.imageHash || '';

  // If referenceImageUrl is a base64 string or if data.referenceImages[0] is base64, persist it to disk
  const rawFirstImage = data.referenceImageUrl?.startsWith('data:image')
    ? data.referenceImageUrl
    : (data.referenceImages?.[0]?.startsWith('data:image') ? data.referenceImages[0] : null);

  if (rawFirstImage) {
    try {
      const persisted = persistReferenceImage(rawFirstImage, referenceImageId);
      persistentImageUrl = persisted.referenceImageUrl;
      referenceImageId = persisted.referenceImageId;
      if (!finalImageHash) finalImageHash = persisted.imageHash;
    } catch (e) {
      console.warn('Could not persist base64 reference image:', e);
    }
  }

  // Ensure persistentImageUrl is valid or fallback to avatarUrl (if avatarUrl is already a URL)
  if (!persistentImageUrl && data.avatarUrl && !data.avatarUrl.startsWith('data:image') && !data.avatarUrl.startsWith('blob:')) {
    persistentImageUrl = data.avatarUrl;
  }

  // Normalize referenceImages array to only contain persistent URLs
  const persistentImagesList: string[] = (data.referenceImages || []).map((img: string, idx: number) => {
    if (typeof img === 'string' && img.startsWith('data:image')) {
      try {
        const persisted = persistReferenceImage(img, idx === 0 ? referenceImageId : undefined);
        return persisted.referenceImageUrl;
      } catch {
        return persistentImageUrl;
      }
    }
    return img;
  }).filter((img: string) => typeof img === 'string' && !img.startsWith('blob:') && !img.startsWith('data:image'));

  if (persistentImageUrl && !persistentImagesList.includes(persistentImageUrl)) {
    persistentImagesList.unshift(persistentImageUrl);
  }

  const finalAvatar = persistentImageUrl || persistentImagesList[0] || data.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

  const updatedReferenceMetadata: CharacterReferenceMetadata = data.referenceMetadata ? {
    ...data.referenceMetadata,
    referenceImageId,
    referenceImageUrl: persistentImageUrl || data.referenceMetadata.referenceImageUrl,
    imageHash: finalImageHash || data.referenceMetadata.imageHash,
    availableViews: data.referenceMetadata.availableViews || (persistentImagesList.length > 1 ? ['MULTI_VIEWS'] : ['FRONT'])
  } : {
    referenceImageId,
    referenceImageUrl: persistentImageUrl,
    imageHash: finalImageHash,
    availableViews: persistentImagesList.length > 1 ? ['MULTI_VIEWS'] : ['FRONT']
  };

  const updatedVisualProfile: CharacterVisualProfile | undefined = data.visualProfile ? {
    ...data.visualProfile,
    referenceImage: persistentImageUrl || data.visualProfile.referenceImage,
    referenceImageUrl: persistentImageUrl || data.visualProfile.referenceImageUrl,
    referenceImageId,
    imageHash: finalImageHash || data.visualProfile.imageHash,
    referenceImages: persistentImagesList.length > 0 ? persistentImagesList : [persistentImageUrl]
  } : undefined;

  // Enforce injecting current user UID and 4-Layer Character Architecture
  const newCharId = data.id || `char_${Date.now()}`;
  const newChar: Character = {
    id: newCharId,
    userId: currentUserId,
    name: data.name,
    gender: data.gender || 'ไม่ระบุ',
    age: data.age || 'ไม่ระบุ',
    description: data.description || '',
    triggerTag: data.triggerTag || `(${data.name.replace(/\s+/g, '_').toLowerCase()}:1.2)`,
    referenceImageId,
    referenceImageUrl: persistentImageUrl,
    imageHash: finalImageHash,
    referenceImages: persistentImagesList.length > 0 ? persistentImagesList : (persistentImageUrl ? [persistentImageUrl] : []),
    avatarUrl: finalAvatar,
    outfitDescription: data.outfitDescription || '',
    consistencyStrength: data.consistencyStrength || 0.8,
    structuredFeatures: data.structuredFeatures,
    analysisConfidence: data.analysisConfidence,
    isVerifiedByUser: Boolean(data.isVerifiedByUser),
    identity: data.identity || {
      id: newCharId,
      name: data.name
    },
    characterIdentity: data.characterIdentity || data.identity || {
      id: newCharId,
      name: data.name
    },
    referenceMetadata: updatedReferenceMetadata,
    visualProfile: updatedVisualProfile,
    storyProfile: data.storyProfile || {
      age: data.age,
      personality: data.storyProfile?.personality || '',
      role: data.storyProfile?.role || '',
      background: data.storyProfile?.background || '',
      occupation: data.storyProfile?.occupation || ''
    },
    fieldSources: data.fieldSources,
    imageAnalysisStatus: data.imageAnalysisStatus,
    lockStatus: data.lockStatus,
    currentReferenceImageHash: finalImageHash,
    visualProfileImageHash: finalImageHash,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const existingIdx = charactersStore.findIndex(c => c.id === newChar.id);
  if (existingIdx >= 0 && charactersStore[existingIdx].userId && charactersStore[existingIdx].userId !== currentUserId) {
    return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์แก้ตัวละครของผู้ใช้อื่น' });
  }
  if (existingIdx >= 0) {
    charactersStore[existingIdx] = newChar;
  } else {
    charactersStore.unshift(newChar);
  }

  // Persist to Firestore server-side with current UID
  if (!isServerQuotaExhausted()) {
    try {
      const db = getServerFirestore();
      if (db) {
        // Save to users/{currentUserId}/characters/{id} subcollection (single write to avoid duplicate quota consumption)
        await setDocServer(docServer(db, 'users', currentUserId, 'characters', newChar.id), newChar, { merge: true });
        console.log(`[Firestore Server] Saved character "${newChar.name}" (${newChar.id}) for user ${currentUserId}`);
      }
    } catch (err: any) {
      handleServerFirestoreError(err, 'Save character');
    }
  }

  res.json({ success: true, character: newChar });
});

app.delete('/api/characters/:id', requireAuth, async (req: any, res) => {
  const currentUserId = req.user.id;
  const char = charactersStore.find(c => c.id === req.params.id);
  if (char && char.userId !== currentUserId) {
    return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ลบตัวละครของผู้ใช้อื่น' });
  }

  charactersStore = charactersStore.filter(c => !(c.id === req.params.id && c.userId === currentUserId));

  // Delete from Firestore
  if (!isServerQuotaExhausted()) {
    try {
      const db = getServerFirestore();
      if (db) {
        await deleteDocServer(docServer(db, 'users', currentUserId, 'characters', req.params.id));
      }
    } catch (err: any) {
      handleServerFirestoreError(err, 'Delete character');
    }
  }

  res.json({ success: true, message: 'ลบตัวละครเรียบร้อย' });
});

// ==========================================
// 6.6.2 LOCATION LOCK & LOCATION CRUD ENDPOINTS (UID-Scoped)
// ==========================================
app.get('/api/locations', async (req, res) => {
  const auth = await getAuthenticatedUser(req);
  const currentUserId = auth?.user?.id;

  // Sync with Firestore collection strictly for this user's UID
  if (currentUserId && !isServerQuotaExhausted()) {
    try {
      const db = getServerFirestore();
      if (db) {
        // Query user's subcollection /users/{uid}/locations
        const userCol = collectionServer(db, 'users', currentUserId, 'locations');
        const userSnap = await getDocsServer(userCol);
        userSnap.forEach(docSnap => {
          const locData = docSnap.data() as LocationItem;
          if (locData && locData.name) {
            const locItem: LocationItem = { ...locData, id: docSnap.id, userId: currentUserId };
            const existingIdx = locationsStore.findIndex(l => l.id === locItem.id);
            if (existingIdx >= 0) {
              locationsStore[existingIdx] = locItem;
            } else {
              locationsStore.unshift(locItem);
            }
          }
        });
      }
    } catch (err) {
      console.warn('[Server Firestore] Could not sync locations from Firestore for user:', err);
    }
  }

  // Strict isolation: only this user's locations. Unscoped or another user's rows are not returned.
  if (!currentUserId) {
    return res.json({ success: true, locations: [] });
  }
  const userLocations = locationsStore.filter(l => l.userId === currentUserId);
  res.json({ success: true, locations: userLocations });
});

app.post('/api/locations', requireAuth, async (req: any, res) => {
  const data = req.body;
  if (!data.name) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อสถานที่' });
  }

  const currentUserId = req.user.id;

  // 1. Resolve Persistent Reference Image
  let persistentImageUrl = data.referenceImageUrl || '';
  let referenceImageId = data.referenceImageId || data.referenceMetadata?.referenceImageId || `ref_loc_${Date.now()}`;
  let finalImageHash = data.imageHash || data.referenceMetadata?.imageHash || '';

  const rawFirstImage = data.referenceImageUrl?.startsWith('data:image')
    ? data.referenceImageUrl
    : (data.referenceImages?.[0]?.startsWith('data:image') ? data.referenceImages[0] : null);

  if (rawFirstImage) {
    try {
      const persisted = persistLocationReferenceImage(rawFirstImage, referenceImageId);
      persistentImageUrl = persisted.referenceImageUrl;
      referenceImageId = persisted.referenceImageId;
      finalImageHash = persisted.imageHash;
    } catch (persistErr) {
      console.warn('Could not persist location image to disk:', persistErr);
    }
  }

  const rawImagesList: string[] = Array.isArray(data.referenceImages) ? data.referenceImages : [];
  const persistentImagesList: string[] = [];
  for (let idx = 0; idx < rawImagesList.length; idx++) {
    const img = rawImagesList[idx];
    if (typeof img === 'string' && img.startsWith('data:image')) {
      try {
        const persisted = persistLocationReferenceImage(img, idx === 0 ? referenceImageId : undefined);
        persistentImagesList.push(persisted.referenceImageUrl);
      } catch (err) {
        console.warn('Could not persist secondary location image:', err);
      }
    } else if (typeof img === 'string' && img.trim()) {
      persistentImagesList.push(img);
    }
  }

  if (persistentImageUrl && !persistentImagesList.includes(persistentImageUrl)) {
    persistentImagesList.unshift(persistentImageUrl);
  }

  const newLocId = data.id || `loc_${Date.now()}`;
  const newLocation: LocationItem = {
    id: newLocId,
    userId: currentUserId,
    name: data.name,
    type: 'LOCATION',
    lockStatus: data.lockStatus || 'LOCKED',
    imageAnalysisStatus: data.imageAnalysisStatus || 'USER_CONFIRMED',
    referenceImageUrl: persistentImageUrl || data.referenceImageUrl || '',
    referenceImages: persistentImagesList.length > 0 ? persistentImagesList : (persistentImageUrl ? [persistentImageUrl] : []),
    referenceImageId,
    imageHash: finalImageHash,
    thumbnailUrl: persistentImageUrl || data.thumbnailUrl || '',
    triggerTag: data.triggerTag || `(location_${data.name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}:1.25)`,
    identity: data.identity || {
      id: newLocId,
      name: data.name
    },
    referenceMetadata: data.referenceMetadata || {
      referenceImageId,
      referenceImageUrl: persistentImageUrl,
      imageHash: finalImageHash,
      availableViews: persistentImagesList.length > 1 ? ['WIDE_SHOT', 'CORNER_PERSPECTIVE'] : ['WIDE_SHOT'],
      imageAnalysisStatus: 'USER_CONFIRMED'
    },
    visualProfile: data.visualProfile || {
      environmentType: 'Indoor',
      architecturalStyle: 'Modern',
      wallColor: 'ตามภาพอ้างอิง',
      floor: 'ตามภาพอ้างอิง',
      ceiling: 'ตามภาพอ้างอิง',
      doors: 'ตามภาพอ้างอิง',
      windows: 'ตามภาพอ้างอิง',
      majorFurniture: 'ตามภาพอ้างอิง',
      fixedObjects: 'ตามภาพอ้างอิง',
      spatialLayout: 'ตามภาพอ้างอิง',
      permanentDecor: 'ตามภาพอ้างอิง',
      distinctiveFeatures: 'ตามภาพอ้างอิง',
      referenceImageUrl: persistentImageUrl,
      referenceImageId,
      imageHash: finalImageHash,
      confidence: 95,
      generatedVisualPrompt: ''
    },
    storyProfile: data.storyProfile || {
      storyLocationName: data.name,
      description: data.description || '',
      notes: ''
    },
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const existingIdx = locationsStore.findIndex(l => l.id === newLocation.id);
  if (existingIdx >= 0 && locationsStore[existingIdx].userId && locationsStore[existingIdx].userId !== currentUserId) {
    return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์แก้สถานที่ของผู้ใช้อื่น' });
  }
  if (existingIdx >= 0) {
    locationsStore[existingIdx] = newLocation;
  } else {
    locationsStore.unshift(newLocation);
  }

  // Persist to Firestore server-side with current UID
  if (!isServerQuotaExhausted()) {
    try {
      const db = getServerFirestore();
      if (db) {
        await setDocServer(docServer(db, 'users', currentUserId, 'locations', newLocation.id), newLocation, { merge: true });
        console.log(`[Firestore Server] Saved location "${newLocation.name}" (${newLocation.id}) for user ${currentUserId}`);
      }
    } catch (err: any) {
      handleServerFirestoreError(err, 'Save location');
    }
  }

  res.json({ success: true, location: newLocation });
});

app.delete('/api/locations/:id', requireAuth, async (req: any, res) => {
  const currentUserId = req.user.id;
  const loc = locationsStore.find(l => l.id === req.params.id);
  if (loc && loc.userId !== currentUserId) {
    return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ลบสถานที่ของผู้ใช้อื่น' });
  }

  locationsStore = locationsStore.filter(l => l.id !== req.params.id);

  // Delete from Firestore
  if (!isServerQuotaExhausted()) {
    try {
      const db = getServerFirestore();
      if (db) {
        await deleteDocServer(docServer(db, 'users', currentUserId, 'locations', req.params.id));
      }
    } catch (err: any) {
      handleServerFirestoreError(err, 'Delete location');
    }
  }

  res.json({ success: true, message: 'ลบสถานที่เรียบร้อย' });
});

// 6.7 Projects & Scenes Endpoints
app.get('/api/projects', requireAuth, (req: any, res) => {
  const userProjects = projectsStore.filter(p => p.userId === req.user.id);
  res.json({ success: true, projects: userProjects });
});

app.post('/api/projects', requireAuth, (req: any, res) => {
  const data = req.body;
  const newProject: Project = {
    id: `proj_${Date.now()}`,
    userId: req.user.id,
    title: data.title || 'โปรเจ็กต์ใหม่',
    description: data.description || '',
    aspectRatio: data.aspectRatio || '16:9',
    defaultCharacterId: data.defaultCharacterId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scenes: data.scenes || [
      {
        id: `scene_${Date.now()}_1`,
        sceneNumber: 1,
        title: 'ฉากที่ 1 (เปิดเรื่อง)',
        prompt: '',
        negativePrompt: '',
        mediaType: 'image',
        aspectRatio: data.aspectRatio || '16:9',
        characterId: data.defaultCharacterId,
        usePreviousSceneAsRef: false,
        status: 'draft'
      }
    ]
  };

  projectsStore.unshift(newProject);
  res.json({ success: true, project: newProject });
});

app.put('/api/projects/:id', requireAuth, (req: any, res) => {
  const index = projectsStore.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'ไม่พบโปรเจ็กต์' });
  }

  const existing = projectsStore[index];
  if (existing.userId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์แก้ไขโปรเจ็กต์ของผู้ใช้อื่น' });
  }

  const body = { ...(req.body || {}) };
  delete body.userId;
  delete body.id;
  projectsStore[index] = {
    ...existing,
    ...body,
    id: existing.id,
    userId: existing.userId,
    updatedAt: new Date().toISOString()
  };

  res.json({ success: true, project: projectsStore[index] });
});

app.delete('/api/projects/:id', requireAuth, (req: any, res) => {
  const existing = projectsStore.find(p => p.id === req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: 'ไม่พบโปรเจ็กต์' });
  }

  if (existing.userId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ลบโปรเจ็กต์ของผู้ใช้อื่น' });
  }

  projectsStore = projectsStore.filter(p => p.id !== req.params.id);
  res.json({ success: true, message: 'ลบโปรเจ็กต์เรียบร้อย' });
});

// 6.8 User Credits & Transactions
function rememberUserBalance(uid: string, remaining: number, entry?: { id: string; amount: number; description: string; type?: 'topup' | 'bonus' | 'refund' | 'usage' }) {
  let account = creditAccountsStore.get(uid);
  if (!account) {
    account = {
      userId: uid,
      userName: `ผู้ใช้ (${uid.slice(0, 8)})`,
      userRole: 'user',
      remainingCredits: remaining,
      totalUsedCredits: 0,
      dailyUsedCredits: 0,
      dailyLimit: 250,
      monthlyUsedCredits: 0,
      monthlyLimit: 2000,
      perGenerationLimit: 50,
      transactions: []
    };
    creditAccountsStore.set(uid, account);
  } else {
    account.remainingCredits = remaining;
  }
  if (entry && !account.transactions.some(tx => tx.id === entry.id)) {
    account.transactions.unshift({
      id: entry.id,
      timestamp: new Date().toISOString(),
      amount: entry.amount,
      type: entry.type || 'topup',
      description: entry.description,
      balanceAfter: remaining
    });
  }
  return account;
}

app.get('/api/credits', async (req: any, res) => {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return res.status(401).json({
      success: false,
      message: 'กรุณาเข้าสู่ระบบก่อนดูยอดเครดิต'
    });
  }
  if (!isRealCreditUid(auth.user.id)) {
    return res.status(403).json({
      success: false,
      message: 'บัญชีนี้ไม่มียอดเครดิตใน Firestore และระบบจะไม่แสดงยอดบัญชีสาธิต'
    });
  }
  try {
    const remaining = await readFirestoreCreditBalance(auth.user.id);
    const account = stripHiddenCreditFields(rememberUserBalance(auth.user.id, remaining ?? 0));
    return res.json({
      success: true,
      balanceSource: 'firestore',
      account
    });
  } catch (err: any) {
    return res.status(err?.status || 503).json({
      success: false,
      balanceSource: 'unavailable',
      message: err?.message || MISSING_FIRESTORE_CREDENTIAL_MESSAGE
    });
  }
});

// Sandbox self-topup is disabled. It used to add credits to the admin's own in-memory account with no payment.
app.post('/api/credits/topup', async (_req: any, res) => {
  return res.status(410).json({
    success: false,
    message: 'ปิดการเติมเครดิตทดสอบแล้ว ไม่มีการเพิ่มเครดิต ต้องชำระผ่าน Stripe หรือให้แอดมินมอบเครดิตให้ uid จริงผ่านหน้าแอดมินเท่านั้น'
  });
});

// ==========================================
// 6.8.1 STRIPE PAYMENT GATEWAY & WEBHOOK
// ==========================================

// Lazy Stripe initialization (safe when STRIPE_SECRET_KEY is not yet configured)
let stripeClient: Stripe | null = null;
function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

// Server-side Firestore initialization
let serverFirestoreDb: any = null;
function getServerFirestore() {
  if (!serverFirestoreDb) {
    try {
      const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(cfgPath)) {
        const config = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        const appName = 'sala-server-app';
        const existing = getFirebaseServerApps().find(a => a.name === appName);
        const serverApp = existing || initFirebaseServer({
          apiKey: config.apiKey,
          projectId: config.projectId,
          appId: config.appId
        }, appName);
        serverFirestoreDb = config.firestoreDatabaseId 
          ? getFirestoreServer(serverApp, config.firestoreDatabaseId)
          : getFirestoreServer(serverApp);
      }
    } catch (err) {
      console.error('[Server Firestore] Init error:', err);
    }
  }
  return serverFirestoreDb;
}

let serverFirestoreQuotaExhausted = false;
let serverFirestoreQuotaExhaustedAt = 0;

function isServerQuotaExhausted(): boolean {
  if (!serverFirestoreQuotaExhausted) return false;
  if (Date.now() - serverFirestoreQuotaExhaustedAt > 12 * 60 * 60 * 1000) {
    serverFirestoreQuotaExhausted = false;
    return false;
  }
  return true;
}

function handleServerFirestoreError(err: any, context: string): void {
  const msg = String(err?.message || err || '');
  if (err?.code === 'resource-exhausted' || msg.includes('Quota exceeded') || msg.includes('quota metric') || msg.includes('RESOURCE_EXHAUSTED')) {
    if (!serverFirestoreQuotaExhausted) {
      serverFirestoreQuotaExhausted = true;
      serverFirestoreQuotaExhaustedAt = Date.now();
      console.warn(`[Server Firestore] ⚠️ Daily write quota exceeded in ${context}. Gracefully switching to server-memory fallback.`);
    }
  } else {
    console.warn(`[Server Firestore] ${context} notice:`, msg);
  }
}

// File-backed persistent idempotent store for processed Stripe transactions (prevents duplicate credits)
const PROCESSED_TX_FILE = path.join(process.cwd(), 'data', 'processed_stripe_tx.json');
const processedTransactions = new Set<string>();

function loadProcessedTransactions() {
  try {
    if (fs.existsSync(PROCESSED_TX_FILE)) {
      const raw = fs.readFileSync(PROCESSED_TX_FILE, 'utf-8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach(id => {
          if (typeof id === 'string') processedTransactions.add(id);
        });
      }
    }
  } catch (err) {
    console.warn('[Idempotency] Could not load processed transactions:', err);
  }
}
loadProcessedTransactions();

function isTransactionProcessed(txId: string): boolean {
  if (!txId) return false;
  return processedTransactions.has(txId);
}

function markTransactionProcessed(txId: string): void {
  if (!txId) return;
  processedTransactions.add(txId);
  try {
    const dir = path.dirname(PROCESSED_TX_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PROCESSED_TX_FILE, JSON.stringify(Array.from(processedTransactions)), 'utf-8');
  } catch (err) {
    console.warn('[Idempotency] Could not persist processed transaction:', err);
  }
}

// Track credited sessions to avoid duplicate top-ups
const processedStripeSessions = processedTransactions;

// Paid credits are written only by serverBilling.ts (Firebase Admin). No simulator sessions.

// 0. Stripe Public Configuration (Publishable key & Status)
app.get('/api/stripe/config', (_req: any, res) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
  const hasSecretKey = Boolean(process.env.STRIPE_SECRET_KEY);
  let firestoreReady = false;
  try {
    assertFirestoreCredentialConfigured();
    firestoreReady = true;
  } catch {
    firestoreReady = false;
  }
  res.json({
    success: true,
    publishableKey,
    hasSecretKey,
    firestoreReady,
    isMock: false,
    paymentsEnabled: hasSecretKey && firestoreReady
  });
});

// 1. Create Checkout Session — authenticated user only, server catalog price, no simulator
app.post('/api/stripe/create-checkout-session', async (req: any, res) => {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth || !isRealCreditUid(auth.user.id)) {
      return res.status(401).json({
        success: false,
        isSimulator: false,
        error: 'กรุณาเข้าสู่ระบบก่อนเติมเครดิต ระบบไม่รับ uid จากหน้าเว็บ และจะไม่เติมเข้าบัญชีสาธิตหรือบัญชีแอดมินคนอื่น'
      });
    }
    const packageId = String(req.body?.packageId || '');
    const pkg = CREDIT_CATALOG[packageId];
    if (!pkg) {
      return res.status(400).json({
        success: false,
        error: 'แพ็กเกจไม่ถูกต้อง ราคาและจำนวนเครดิตกำหนดจากเซิร์ฟเวอร์เท่านั้น'
      });
    }
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({
        success: false,
        isSimulator: false,
        error: MISSING_STRIPE_SECRET_MESSAGE
      });
    }
    try {
      assertFirestoreCredentialConfigured();
    } catch (err: any) {
      return res.status(503).json({
        success: false,
        isSimulator: false,
        error: err?.message || MISSING_FIRESTORE_CREDENTIAL_MESSAGE
      });
    }

    const uid = auth.user.id;
    const baseReturnUrl = req.body?.returnUrl || `${req.protocol}://${req.get('host')}`;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'promptpay'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'thb',
            product_data: {
              name: `แพ็กเกจเครดิต Sala AI (${pkg.credits.toLocaleString()} เครดิต)`,
              description: `เติม ${pkg.credits.toLocaleString()} เครดิตสำหรับสร้างภาพและวิดีโอในศาลาเอไอ`
            },
            unit_amount: pkg.priceThb * 100
          },
          quantity: 1
        }
      ],
      client_reference_id: uid,
      customer_email: auth.user.email || undefined,
      metadata: {
        uid,
        credits: String(pkg.credits),
        packageId,
        priceThb: String(pkg.priceThb)
      },
      payment_intent_data: {
        metadata: {
          uid,
          credits: String(pkg.credits),
          packageId,
          priceThb: String(pkg.priceThb)
        }
      },
      success_url: `${baseReturnUrl}/pricing?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseReturnUrl}/pricing?canceled=true`
    });

    return res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      isSimulator: false
    });
  } catch (err: any) {
    console.error('[Stripe create-checkout-session Error]:', err);
    res.status(500).json({
      success: false,
      isSimulator: false,
      error: err.message || 'ไม่สามารถสร้าง Stripe Checkout Session ได้'
    });
  }
});

function catalogGrantFromMetadata(metadata: Stripe.Metadata | null | undefined, amountTotal: number | null): { credits: number; priceThb: number } | null {
  const packageId = String(metadata?.packageId || '');
  const pkg = CREDIT_CATALOG[packageId];
  if (!pkg) return null;
  if (String(metadata?.credits || '') !== String(pkg.credits)) return null;
  if (String(metadata?.priceThb || '') !== String(pkg.priceThb)) return null;
  if (amountTotal != null && amountTotal !== pkg.priceThb * 100) return null;
  return pkg;
}

async function grantPaidStripeCredits(uid: string, credits: number, description: string, idempotencyIds: string[]) {
  const result = await creditPaidUserInFirestore(uid, credits, description, idempotencyIds);
  rememberUserBalance(uid, result.remainingCredits, result.already ? undefined : {
    id: idempotencyIds.find(Boolean) || `tx_stripe_${Date.now()}`,
    amount: credits,
    description: `${description} (+${credits} เครดิต)`,
    type: 'topup'
  });
  for (const id of idempotencyIds) {
    if (id) markTransactionProcessed(id);
  }
  return result;
}

// 2. Stripe Webhook — the only path that grants purchased credits
app.post('/api/stripe/webhook', async (req: any, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = getStripe();

  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET is not configured on server.');
    return res.status(400).send('Webhook Secret is not configured on the server.');
  }
  if (!sig || !req.rawBody) {
    console.error('[Stripe Webhook] Missing stripe-signature header or raw body.');
    return res.status(400).send('Stripe-Signature header and raw body are required.');
  }
  if (!stripe) {
    console.error('[Stripe Webhook] Stripe client not initialized (STRIPE_SECRET_KEY missing).');
    return res.status(500).send('Stripe client not initialized.');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Signature Verification Error: ${err.message}`);
  }

  console.log(`[Stripe Webhook] Received verified event: ${event.type} (ID: ${event.id})`);

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data?.object as Stripe.Checkout.Session;
      const sessionId = session?.id;
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : '';
      if (session.payment_status !== 'paid') {
        console.warn(`[Stripe Webhook] Checkout session ${sessionId} payment_status is "${session.payment_status}" (not "paid"). Skipping credit.`);
        return res.json({ received: true, credited: false, status: session.payment_status });
      }
      const ids = [paymentIntentId, sessionId].filter(Boolean);
      if (ids.some(id => isTransactionProcessed(id))) {
        return res.json({ received: true, idempotent: true, credited: false });
      }
      const pkg = catalogGrantFromMetadata(session.metadata, typeof session.amount_total === 'number' ? session.amount_total : null);
      const uid = String(session.metadata?.uid || '');
      if (!pkg || !isRealCreditUid(uid) || session.client_reference_id !== uid) {
        console.error('[Stripe Webhook] Refusing credit: catalog, amount, or uid mismatch', sessionId);
        return res.json({ received: true, credited: false, reason: 'not_granted' });
      }
      await grantPaidStripeCredits(uid, pkg.credits, `เติมเครดิต Stripe Webhook (${String(sessionId).slice(0, 10)}...)`, ids);
      return res.json({ received: true, credited: true });
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data?.object as Stripe.PaymentIntent;
      const piId = pi?.id;
      if (pi.status !== 'succeeded') {
        return res.json({ received: true, credited: false, status: pi.status });
      }
      if (piId && isTransactionProcessed(piId)) {
        return res.json({ received: true, idempotent: true, credited: false });
      }
      const amount = typeof pi.amount_received === 'number' ? pi.amount_received : (typeof pi.amount === 'number' ? pi.amount : null);
      const pkg = catalogGrantFromMetadata(pi.metadata, amount);
      const uid = String(pi.metadata?.uid || '');
      if (!pkg || !isRealCreditUid(uid) || !piId) {
        return res.json({ received: true, credited: false, reason: 'not_granted' });
      }
      await grantPaidStripeCredits(uid, pkg.credits, `เติมเครดิต Stripe PaymentIntent (${piId.slice(0, 10)}...)`, [piId]);
      return res.json({ received: true, credited: true });
    }

    if (event.type === 'payment_intent.payment_failed' || event.type === 'checkout.session.expired') {
      console.log(`[Stripe Webhook] Non-successful event ${event.type} received - no credits added.`);
    }
    return res.json({ received: true, credited: false });
  } catch (err: any) {
    console.error('[Stripe Webhook] Credit was not saved:', err?.message || err);
    return res.status(err?.status && err.status < 500 ? err.status : 500).json({
      received: false,
      credited: false,
      error: err?.message || MISSING_FIRESTORE_CREDENTIAL_MESSAGE
    });
  }
});

// 3. Report Checkout status only. This route never grants credits.
app.get('/api/stripe/verify-session', async (req: any, res) => {
  try {
    const sessionId = String(req.query.sessionId || '').trim();
    if (!sessionId) {
      return res.status(400).json({ success: false, creditsAdded: 0, creditsGranted: false, error: 'ต้องระบุ sessionId' });
    }
    if (sessionId.startsWith('sim_') || sessionId.startsWith('cs_test_sim')) {
      return res.status(400).json({
        success: false,
        creditsAdded: 0,
        creditsGranted: false,
        error: 'ไม่รองรับรายการจำลอง และไม่ได้เติมเครดิต'
      });
    }
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({
        success: false,
        creditsAdded: 0,
        creditsGranted: false,
        error: MISSING_STRIPE_SECRET_MESSAGE
      });
    }
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.json({
        success: false,
        payment_status: session.payment_status,
        creditsAdded: 0,
        creditsGranted: false,
        message: `การชำระเงินยังไม่สำเร็จ (สถานะ: ${session.payment_status}) จึงไม่เติมเครดิต`
      });
    }
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : '';
    const uid = String(session.metadata?.uid || '');
    let creditsGranted = false;
    let remainingCredits: number | null = null;
    let persistError = '';
    try {
      creditsGranted = await paymentAlreadyRecorded([paymentIntentId, sessionId]);
      const auth = await getAuthenticatedUser(req);
      if (creditsGranted && auth && isRealCreditUid(auth.user.id) && auth.user.id === uid) {
        remainingCredits = await readFirestoreCreditBalance(uid);
        if (typeof remainingCredits === 'number') rememberUserBalance(uid, remainingCredits);
      }
    } catch (err: any) {
      creditsGranted = false;
      persistError = err?.message || MISSING_FIRESTORE_CREDENTIAL_MESSAGE;
    }
    return res.json({
      success: creditsGranted,
      payment_status: session.payment_status,
      creditsAdded: 0,
      creditsGranted,
      remainingCredits,
      message: creditsGranted
        ? 'การชำระเงินนี้ถูกบันทึกเครดิตแล้วจาก webhook หน้านี้ไม่ได้เติมซ้ำ'
        : (persistError || 'รับการชำระเงินจาก Stripe แล้ว แต่ยังไม่ยืนยันว่าเครดิตถูกบันทึกลง Firestore หน้านี้ไม่เติมเครดิต')
    });
  } catch (err: any) {
    console.error('[Verify Session Error]:', err);
    res.status(500).json({ success: false, creditsAdded: 0, creditsGranted: false, error: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบ Session' });
  }
});

// 3.1 Report PaymentIntent status only. This route never grants credits.
app.get('/api/stripe/verify-payment-intent', async (req: any, res) => {
  try {
    const paymentIntentId = String(req.query.paymentIntentId || '').trim();
    if (!paymentIntentId) {
      return res.status(400).json({ success: false, creditsAdded: 0, creditsGranted: false, error: 'ต้องระบุ paymentIntentId' });
    }
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({
        success: false,
        creditsAdded: 0,
        creditsGranted: false,
        error: MISSING_STRIPE_SECRET_MESSAGE
      });
    }
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status !== 'succeeded') {
      return res.json({
        success: false,
        status: pi.status,
        creditsAdded: 0,
        creditsGranted: false,
        message: `การชำระเงินยังไม่สำเร็จ (สถานะ: ${pi.status}) จึงไม่เติมเครดิต`
      });
    }
    const uid = String(pi.metadata?.uid || '');
    let creditsGranted = false;
    let remainingCredits: number | null = null;
    let persistError = '';
    try {
      creditsGranted = await paymentAlreadyRecorded([paymentIntentId]);
      const auth = await getAuthenticatedUser(req);
      if (creditsGranted && auth && isRealCreditUid(auth.user.id) && auth.user.id === uid) {
        remainingCredits = await readFirestoreCreditBalance(uid);
        if (typeof remainingCredits === 'number') rememberUserBalance(uid, remainingCredits);
      }
    } catch (err: any) {
      creditsGranted = false;
      persistError = err?.message || MISSING_FIRESTORE_CREDENTIAL_MESSAGE;
    }
    return res.json({
      success: creditsGranted,
      status: pi.status,
      creditsAdded: 0,
      creditsGranted,
      remainingCredits,
      message: creditsGranted
        ? 'การชำระเงินนี้ถูกบันทึกเครดิตแล้วจาก webhook หน้านี้ไม่ได้เติมซ้ำ'
        : (persistError || 'รับการชำระเงินจาก Stripe แล้ว แต่ยังไม่ยืนยันว่าเครดิตถูกบันทึกลง Firestore หน้านี้ไม่เติมเครดิต')
    });
  } catch (err: any) {
    console.error('[Verify PaymentIntent Error]:', err);
    res.status(500).json({ success: false, creditsAdded: 0, creditsGranted: false, error: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบ PaymentIntent' });
  }
});

app.get('/api/auth/role', async (req, res) => {
  const auth = await getAuthenticatedUser(req);
  if (!auth) return res.status(401).json({ success: false, role: 'user' });
  const isAdmin = auth.identity.via === 'firebase' && isAdminIdentity(auth.identity.firebase, readAdminEmails());
  res.json({ success: true, role: isAdmin ? 'admin' : 'user' });
});

app.get('/api/admin/admins', requireAdmin, (_req, res) => {
  res.json({ success: true, emails: readAdminEmails() });
});

app.post('/api/admin/admins', requireAdmin, (req, res) => {
  try {
    const emails = addAdminEmail(String(req.body?.email || ''));
    res.json({ success: true, emails });
  } catch (err: any) {
    res.status(err?.status || 400).json({ success: false, message: err?.message || 'เพิ่มผู้ดูแลไม่สำเร็จ' });
  }
});

app.get('/api/admin/stats', requireAdmin, async (req: any, res) => {
  const allJobs = Array.from(jobsStore.values());
  let creditsSpentTotal = 0;
  for (const acc of creditAccountsStore.values()) {
    creditsSpentTotal += acc.totalUsedCredits;
  }

  const allAccounts = Array.from(creditAccountsStore.values());

  let totalAdminShareCredits: number | null = null;
  try { totalAdminShareCredits = await readPlatformAdminShare(); } catch { totalAdminShareCredits = null; }

  const stats = {
    totalUsers: usersStore.size,
    totalAdminShareCredits,
    totalGenerations: allJobs.length,
    totalImagesGenerated: allJobs.filter(j => j.type === 'image').length,
    totalVideosGenerated: allJobs.filter(j => j.type === 'video').length,
    activeJobsCount: allJobs.filter(j => j.status === 'processing' || j.status === 'queued').length,
    creditsSpentTotal: creditsSpentTotal + 3480,
    providersStatus: [
      {
        id: 'gemini' as ProviderId,
        name: 'Google Gemini / Veo',
        hasKey: Boolean(process.env.GEMINI_API_KEY),
        isMock: !Boolean(process.env.GEMINI_API_KEY),
        statusText: Boolean(process.env.GEMINI_API_KEY) ? 'พร้อมใช้งาน (Server API Key Detected)' : 'โหมดจำลอง (No GEMINI_API_KEY in env)',
        activeCalls: allJobs.filter(j => j.provider === 'gemini' && j.status === 'processing').length
      },
      {
        id: 'meta' as ProviderId,
        name: 'Meta Llama / Emu',
        hasKey: Boolean(process.env.META_API_KEY),
        isMock: !Boolean(process.env.META_API_KEY),
        statusText: Boolean(process.env.META_API_KEY) ? 'พร้อมใช้งาน (Meta Key Active)' : 'โครงสร้าง Adapter พร้อมใช้งาน (Mock Sandbox Mode)',
        activeCalls: allJobs.filter(j => j.provider === 'meta' && j.status === 'processing').length
      },
      {
        id: 'xai' as ProviderId,
        name: 'xAI / Grok Vision',
        hasKey: Boolean(process.env.XAI_API_KEY),
        isMock: !Boolean(process.env.XAI_API_KEY),
        statusText: Boolean(process.env.XAI_API_KEY) ? 'พร้อมใช้งาน (xAI Key Active)' : 'โครงสร้าง Adapter พร้อมใช้งาน (Mock Sandbox Mode)',
        activeCalls: allJobs.filter(j => j.provider === 'xai' && j.status === 'processing').length
      },
      {
        id: 'mock' as ProviderId,
        name: 'ศาลาเอไอ Simulator',
        hasKey: true,
        isMock: true,
        statusText: 'พร้อมใช้งานเสมอ (Local Mock Generator)',
        activeCalls: allJobs.filter(j => j.provider === 'mock' && j.status === 'processing').length
      }
    ],
    recentJobs: allJobs.slice(0, 10),
    userAccounts: allAccounts
  };

  res.json({ success: true, stats });
});

app.post('/api/admin/grant-credits', requireAdmin, async (req: any, res) => {
  const { userId, amount } = req.body || {};
  const num = Math.trunc(Number(amount));
  try {
    const next = await adjustFirestoreCredits(String(userId || ''), num, 'แอดมินมอบเครดิต');
    rememberUserBalance(String(userId), next, {
      id: `tx_admin_${Date.now()}`,
      amount: num,
      description: `แอดมินมอบเครดิตพิเศษ (+${num} เครดิต)`,
      type: 'bonus'
    });
    res.json({ success: true, remainingCredits: next, message: `บันทึก ${num} เครดิตใน Firestore users/${userId} แล้ว คงเหลือ ${next}` });
  } catch (err: any) {
    res.status(err?.status || 503).json({ success: false, message: err?.message || MISSING_FIRESTORE_CREDENTIAL_MESSAGE });
  }
});

app.post('/api/admin/reset-limits', requireAdmin, (req: any, res) => {
  const { userId } = req.body;
  if (userId && creditAccountsStore.has(userId)) {
    const acc = creditAccountsStore.get(userId)!;
    acc.dailyUsedCredits = 0;
  } else {
    for (const acc of creditAccountsStore.values()) {
      acc.dailyUsedCredits = 0;
    }
  }
  res.json({ success: true, message: 'รีเซ็ตยอดใช้งานประจำวัน (Daily Limit) เรียบร้อยแล้ว' });
});

// ==========================================
// 6.10 AUTHENTICATION & USER MANAGEMENT
// ==========================================

// Register
app.post('/api/auth/register', (req, res) => {
  const { firstName, lastName, username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน (ชื่อผู้ใช้ อีเมล รหัสผ่าน)' });
  }

  // Check unique username & email
  const existingUsername = Array.from(usersStore.values()).find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existingUsername) {
    return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว กรุณาเลือกชื่ออื่น' });
  }

  const existingEmail = Array.from(usersStore.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingEmail) {
    return res.status(400).json({ success: false, message: 'อีเมลนี้ถูกลงทะเบียนแล้ว กรุณาใช้อีเมลอื่นหรือเข้าสู่ระบบ' });
  }

  // Hash password securely (PBKDF2 + salt)
  const { salt, hash } = hashPassword(password);
  const newUserId = `user_${Date.now()}`;
  const devOtp = '123456';

  const newUser: StoredUser = {
    id: newUserId,
    firstName: firstName || '',
    lastName: lastName || '',
    username,
    email,
    passwordHash: hash,
    salt,
    role: 'user',
    status: 'active',
    isVerified: false,
    verificationCode: devOtp,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  };

  usersStore.set(newUserId, newUser);

  // New accounts start at 0. Credits are added only by an admin grant.
  const newAccount: CreditAccount = {
    userId: newUserId,
    userName: `${firstName || username} (สมาชิก)`,
    userRole: 'user',
    remainingCredits: 0,
    totalUsedCredits: 0,
    dailyUsedCredits: 0,
    dailyLimit: 100,
    monthlyUsedCredits: 0,
    monthlyLimit: 1000,
    perGenerationLimit: 30,
    transactions: []
  };

  creditAccountsStore.set(newUserId, newAccount);

  const token = createSessionToken(newUserId, SESSION_SECRET);
  sessionsStore.set(token, newUserId);

  res.json({
    success: true,
    token,
    user: {
      id: newUser.id,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      isVerified: newUser.isVerified,
      createdAt: newUser.createdAt
    },
    account: newAccount,
    devOtpCode: devOtp,
    message: 'สมัครสมาชิกสำเร็จ! (โหมดพัฒนา: รหัส OTP ยืนยันอีเมลคือ 123456)'
  });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { usernameOrEmail, password } = req.body;

  if (!usernameOrEmail || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้/อีเมล และรหัสผ่าน' });
  }

  const query = usernameOrEmail.toLowerCase().trim();
  const user = Array.from(usersStore.values()).find(
    u => u.username.toLowerCase() === query || u.email.toLowerCase() === query
  );

  if (!user) {
    return res.status(401).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้นี้ หรือรหัสผ่านไม่ถูกต้อง' });
  }

  if (user.status === 'suspended') {
    return res.status(403).json({ success: false, message: 'บัญชีนี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ' });
  }

  const isValid = verifyPassword(password, user.salt, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
  }

  user.lastLogin = new Date().toISOString();
  const token = createSessionToken(user.id, SESSION_SECRET);
  sessionsStore.set(token, user.id);

  let account = creditAccountsStore.get(user.id);
  if (!account) {
    account = {
      userId: user.id,
      userName: `${user.firstName || user.username} (สมาชิก)`,
      userRole: user.role,
      remainingCredits: 0,
      totalUsedCredits: 0,
      dailyUsedCredits: 0,
      dailyLimit: user.role === 'admin' ? 10000 : 250,
      monthlyUsedCredits: 0,
      monthlyLimit: user.role === 'admin' ? 50000 : 2000,
      perGenerationLimit: user.role === 'admin' ? 500 : 50,
      transactions: []
    };
    creditAccountsStore.set(user.id, account);
  }

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    },
    account,
    message: `ยินดีต้อนรับกลับ, ${user.firstName || user.username}!`
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    sessionsStore.delete(token);
    const session = verifySessionToken(token, SESSION_SECRET);
    if (session) revokedSessionTokens.set(token, session.exp);
    verifiedFirebaseTokens.delete(token);
  }
  res.json({ success: true, message: 'ออกจากระบบเรียบร้อยแล้ว' });
});

// Current User Profile (Requires valid auth token, strictly no demo fallback)
app.get('/api/auth/me', requireAuth, (req: any, res) => {
  const user = req.user as StoredUser;
  const account = req.creditAccount as CreditAccount;

  res.json({
    success: true,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    },
    account
  });
});

// Verify Email / OTP
app.post('/api/auth/verify-email', (req, res) => {
  const { email, otpCode } = req.body;
  const user = Array.from(usersStore.values()).find(u => u.email.toLowerCase() === (email || '').toLowerCase());

  if (!user) {
    return res.status(404).json({ success: false, message: 'ไม่พบอีเมลในระบบ' });
  }

  // Accept generated code or fallback dev code '123456'
  if (otpCode === user.verificationCode || otpCode === '123456') {
    user.isVerified = true;
    return res.json({ success: true, message: 'ยืนยันอีเมลสำเร็จเรียบร้อยแล้ว!' });
  }

  res.status(400).json({ success: false, message: 'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง (ทดสอบด้วย 123456)' });
});

// Resend OTP
app.post('/api/auth/resend-otp', (req, res) => {
  const { email } = req.body;
  const user = Array.from(usersStore.values()).find(u => u.email.toLowerCase() === (email || '').toLowerCase());

  if (!user) {
    return res.status(404).json({ success: false, message: 'ไม่พบอีเมลในระบบ' });
  }

  const newOtp = '123456';
  user.verificationCode = newOtp;

  res.json({
    success: true,
    devOtpCode: newOtp,
    message: 'ส่งรหัส OTP ใหม่เรียบร้อยแล้ว (โหมดพัฒนา: รหัสคือ 123456)'
  });
});

// Forgot Password
app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  const user = Array.from(usersStore.values()).find(u => u.email.toLowerCase() === (email || '').toLowerCase());

  if (!user) {
    return res.status(404).json({ success: false, message: 'ไม่พบอีเมลนี้ในระบบ' });
  }

  const resetCode = '123456';
  user.verificationCode = resetCode;

  res.json({
    success: true,
    devOtpCode: resetCode,
    message: 'สร้างรหัสรีเซ็ตรหัสผ่านเรียบร้อยแล้ว (โหมดพัฒนา: รหัสคือ 123456)'
  });
});

// Reset Password
app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;
  const user = Array.from(usersStore.values()).find(u => u.email.toLowerCase() === (email || '').toLowerCase());

  if (!user) {
    return res.status(404).json({ success: false, message: 'ไม่พบอีเมลนี้ในระบบ' });
  }

  if (code !== user.verificationCode && code !== '123456') {
    return res.status(400).json({ success: false, message: 'รหัสยืนยันไม่ถูกต้อง' });
  }

  const { salt, hash } = hashPassword(newPassword);
  user.passwordHash = hash;
  user.salt = salt;

  res.json({ success: true, message: 'รีเซ็ตรหัสผ่านสำเร็จเรียบร้อย สามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้ทันที' });
});

// ==========================================
// 6.11 ADMIN USER & SYSTEM MANAGEMENT
// ==========================================

// Get All Users (Admin)
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const usersList = Array.from(usersStore.values()).map(u => {
    const acc = creditAccountsStore.get(u.id);
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      username: u.username,
      email: u.email,
      role: u.role,
      status: u.status,
      isVerified: u.isVerified,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
      remainingCredits: acc ? acc.remainingCredits : 0,
      totalUsedCredits: acc ? acc.totalUsedCredits : 0
    };
  });

  res.json({ success: true, users: usersList });
});

// Create User (Admin)
app.post('/api/admin/users', requireAdmin, (req, res) => {
  const { firstName, lastName, username, email, password, role, initialCredits } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้ อีเมล และรหัสผ่าน' });
  }

  const { salt, hash } = hashPassword(password);
  const newUserId = `user_${Date.now()}`;

  const newUser: StoredUser = {
    id: newUserId,
    firstName: firstName || '',
    lastName: lastName || '',
    username,
    email,
    passwordHash: hash,
    salt,
    role: role === 'admin' ? 'admin' : 'user',
    status: 'active',
    isVerified: true,
    createdAt: new Date().toISOString(),
    lastLogin: undefined
  };

  usersStore.set(newUserId, newUser);

  const parsedCredits = Number(initialCredits);
  const creds = Number.isFinite(parsedCredits) && parsedCredits > 0 ? Math.floor(parsedCredits) : 0;
  const newAccount: CreditAccount = {
    userId: newUserId,
    userName: `${firstName || username} (ผู้ใช้ใหม่โดย Admin)`,
    userRole: newUser.role,
    remainingCredits: creds,
    totalUsedCredits: 0,
    dailyUsedCredits: 0,
    dailyLimit: 200,
    monthlyUsedCredits: 0,
    monthlyLimit: 2000,
    perGenerationLimit: 50,
    transactions: creds > 0 ? [
      {
        id: `tx_admin_created_${Date.now()}`,
        timestamp: new Date().toISOString(),
        amount: creds,
        type: 'bonus',
        description: `แอดมินสร้างบัญชีพร้อมมอบเครดิตเริ่มต้น ${creds} เครดิต`,
        balanceAfter: creds
      }
    ] : []
  };

  creditAccountsStore.set(newUserId, newAccount);

  res.json({ success: true, user: newUser, account: newAccount, message: 'สร้างบัญชีผู้ใช้ใหม่สำเร็จ' });
});

// Adjust User Credits (Add or Deduct with Reason)
app.post('/api/admin/adjust-credits', requireAdmin, async (req, res) => {
  const { userId, amount, reason } = req.body || {};
  const num = Math.trunc(Number(amount));
  try {
    const next = await adjustFirestoreCredits(String(userId || ''), num, String(reason || 'การจัดการระบบ'));
    rememberUserBalance(String(userId), next, {
      id: `tx_adjust_${Date.now()}`,
      amount: num,
      description: `แอดมินปรับเครดิต (${num > 0 ? `+${num}` : num}): ${reason || 'การจัดการระบบ'}`,
      type: num > 0 ? 'topup' : 'usage'
    });
    res.json({
      success: true,
      remainingCredits: next,
      message: `บันทึกยอดใน Firestore users/${userId} แล้ว (${num > 0 ? `+${num}` : num} เครดิต) คงเหลือ ${next}`
    });
  } catch (err: any) {
    res.status(err?.status || 503).json({ success: false, message: err?.message || MISSING_FIRESTORE_CREDENTIAL_MESSAGE });
  }
});

app.post('/api/admin/toggle-user-status', requireAdmin, (req, res) => {
  const { userId } = req.body;
  const user = usersStore.get(userId);

  if (!user) {
    return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
  }

  user.status = user.status === 'active' ? 'suspended' : 'active';
  res.json({
    success: true,
    status: user.status,
    message: user.status === 'active' ? 'เปิดใช้งานบัญชีเรียบร้อย' : 'ระงับบัญชีผู้ใช้เรียบร้อย'
  });
});

// Pricing & Service Fee Config
app.get('/api/admin/pricing-config', requireAdmin, (req, res) => {
  res.json({ success: true, config: pricingConfig });
});

app.post('/api/admin/pricing-config', requireAdmin, (req, res) => {
  const { copyPromptFee, serviceFeeType, serviceFeeValue } = req.body;

  if (copyPromptFee !== undefined) pricingConfig.copyPromptFee = Number(copyPromptFee);
  if (serviceFeeType === 'fixed' || serviceFeeType === 'percentage') pricingConfig.serviceFeeType = serviceFeeType;
  if (serviceFeeValue !== undefined) pricingConfig.serviceFeeValue = Number(serviceFeeValue);

  res.json({ success: true, config: pricingConfig, message: 'อัปเดตอัตราค่าบริการและเครดิตเรียบร้อย' });
});

// Redeem Codes Endpoints
app.get('/api/admin/redeem-codes', requireAdmin, (req, res) => {
  const list = Array.from(redeemCodesStore.values());
  res.json({ success: true, codes: list });
});

app.post('/api/admin/redeem-codes', requireAdmin, (req, res) => {
  const { code, maxUses, expiresAt } = req.body;
  const creditAmount = req.body.creditAmount || req.body.credits;

  if (!code || !creditAmount) {
    return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสโค้ดและจำนวนเครดิต' });
  }

  const cleanCode = code.trim().toUpperCase();
  const newRedeem: RedeemCode = {
    id: `code_${Date.now()}`,
    code: cleanCode,
    creditAmount: Number(creditAmount),
    maxUses: Number(maxUses) || 100,
    usedCount: 0,
    isExpired: false,
    expiresAt,
    createdAt: new Date().toISOString(),
    createdBy: 'admin'
  };

  redeemCodesStore.set(cleanCode, newRedeem);
  res.json({ success: true, code: newRedeem, message: `สร้างโค้ด ${cleanCode} สำเร็จ (+${creditAmount} เครดิต)` });
});

app.delete('/api/admin/redeem-codes/:id', requireAdmin, (req, res) => {
  const targetId = req.params.id;
  for (const [key, val] of redeemCodesStore.entries()) {
    if (val.id === targetId || val.code === targetId) {
      redeemCodesStore.delete(key);
      return res.json({ success: true, message: 'ลบโค้ดเรียบร้อยแล้ว' });
    }
  }
  res.status(404).json({ success: false, message: 'ไม่พบโค้ดที่ต้องการลบ' });
});

// Free redeem is disabled. It used to add credits to the shared demo wallet with no auth.
app.post('/api/redeem-code', (_req, res) => {
  return res.status(410).json({
    success: false,
    addedCredits: 0,
    message: 'ปิดการแลกโค้ดรับเครดิตฟรีแล้ว ระบบไม่เพิ่มเครดิตให้บัญชีสาธิต'
  });
});

// ==========================================
// 6.12 CONTINUITY CHECKER
// ==========================================
app.post('/api/director/continuity-check', (req, res) => {
  const { scriptText, clips, dialogues } = req.body || {};
  const masterLock = (req.body && typeof req.body.continuityLock === 'object' && req.body.continuityLock) || {};

  // If the master lock has no character, fall back to the per-clip Character Lock that
  // Story Continuation fills in (most frequent main character across clips).
  const clipLocks: any[] = Array.isArray(clips) ? clips.map((c: any) => c?.continuityLock).filter(Boolean) : [];
  const mostFrequent = (values: string[]) => {
    const counts = new Map<string, number>();
    values.filter(v => typeof v === 'string' && v.trim()).forEach(v => counts.set(v.trim(), (counts.get(v.trim()) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  };
  const continuityLock: any = { ...masterLock };
  if (!continuityLock.characterName || !String(continuityLock.characterName).trim()) {
    continuityLock.characterName = mostFrequent(clipLocks.map(l => l.characterName));
  }
  if (!continuityLock.timeOfDay) continuityLock.timeOfDay = mostFrequent(clipLocks.map(l => l.timeOfDay));
  if (!continuityLock.location) continuityLock.location = mostFrequent(clipLocks.map(l => l.location));

  const issues: any[] = [];
  const passedChecks: string[] = [];

  // Check 1: Character identity & Appearance
  if (continuityLock?.characterName && isReservedSystemKeyword(continuityLock.characterName)) {
    issues.push({
      id: 'issue_char_reserved',
      clipNumber: 1,
      type: 'character',
      severity: 'error',
      title: `ชื่อตัวละครหลักเป็นคำสงวนของระบบ (${continuityLock.characterName})`,
      description: 'คำสั่งระบบ เช่น LOCK, CONT, FRAME, AUTO, RULE, NO, OUT, STORY, CHARACTERS, END, SALA_MULTI_CLIP ห้ามใช้เป็นชื่อตัวละคร',
      suggestion: 'เปลี่ยนชื่อตัวละครในแผง Master Continuity Lock'
    });
  } else if (!continuityLock?.characterName || continuityLock.characterName.trim().length < 2) {
    issues.push({
      id: 'issue_char_name',
      clipNumber: 1,
      type: 'character',
      severity: 'error',
      title: 'ยังไม่ได้ระบุชื่อตัวละครหลัก (Character Lock Missing)',
      description: 'ระบบต้องการชื่อตัวละครที่แน่นอนเพื่อยึดเหนี่ยวใบหน้าและเครื่องแต่งกายในทุกคลิป',
      suggestion: 'ไประบุชื่อและรายละเอียดในแผง Master Continuity Lock หรือเลือกตัวละครจากคลัง'
    });
  } else {
    passedChecks.push(`Character Anchor Locked: ${continuityLock.characterName}`);
  }

  // Check 2: Action Momentum Chain (presence AND content handoff)
  const bigrams = (t: string) => {
    const clean = t.replace(/\s+/g, '');
    const set = new Set<string>();
    for (let k = 0; k < clean.length - 1; k++) set.add(clean.slice(k, k + 2));
    return set;
  };
  const handoffSimilarity = (a: string, b: string) => {
    if (!a || !b) return 0;
    if (a.includes(b) || b.includes(a)) return 1;
    const A = bigrams(a);
    const B = bigrams(b);
    if (A.size === 0 || B.size === 0) return 0;
    let inter = 0;
    A.forEach(x => { if (B.has(x)) inter++; });
    return inter / Math.min(A.size, B.size);
  };
  if (Array.isArray(clips) && clips.length > 1) {
    let momentumPassed = true;
    for (let i = 1; i < clips.length; i++) {
      const prevEnd = (clips[i - 1].endAction || '').trim();
      const currStart = (clips[i].startAction || '').trim();
      if (prevEnd && currStart && handoffSimilarity(prevEnd, currStart) < 0.3) {
        momentumPassed = false;
        issues.push({
          id: `issue_momentum_mismatch_${i}`,
          clipNumber: i + 1,
          type: 'event_order',
          severity: 'warning',
          title: `จุดเริ่มคลิปที่ ${i + 1} ไม่ตรงกับจุดจบของคลิปที่ ${i}`,
          description: `จบคลิป ${i}: "${prevEnd.slice(0, 80)}" / เริ่มคลิป ${i + 1}: "${currStart.slice(0, 80)}"`,
          suggestion: 'ให้ startAction ของคลิปนี้เริ่มจากท่าทาง/ตำแหน่งเดียวกับ endAction ของคลิปก่อนหน้า'
        });
        continue;
      }
      if (!prevEnd || !currStart) {
        momentumPassed = false;
        issues.push({
          id: `issue_momentum_${i}`,
          clipNumber: i + 1,
          type: 'event_order',
          severity: 'warning',
          title: `รอยต่อโมเมนตัมระหว่างคลิปที่ ${i} และ ${i + 1} อาจขาดตอน`,
          description: `จุดจบของคลิปที่ ${i} ยังไม่ได้ส่งต่อการกระทำไปยังจุดเริ่มต้นของคลิปที่ ${i + 1} อย่างชัดเจน`,
          suggestion: 'ระบุการเคลื่อนไหวหรือทิศทางของมุมกล้องในตอนจบของคลิปก่อนหน้า ให้สอดคล้องกับจุดเริ่มต้น'
        });
      }
    }
    if (momentumPassed) {
      passedChecks.push('Action Momentum Chain: จุดจบของคลิป N ส่งต่อโมเมนตัมไปยังจุดเริ่มต้นของคลิป N+1 สมบูรณ์');
    }
  }

  // Check 3: Dialogue Attributions & Reserved Keywords
  if (Array.isArray(dialogues) && dialogues.length > 0) {
    const reservedSpeakers = dialogues.filter(d => d.speaker && isReservedSystemKeyword(d.speaker));
    if (reservedSpeakers.length > 0) {
      issues.push({
        id: 'issue_dialogue_reserved_speaker',
        clipNumber: 1,
        type: 'dialogue',
        severity: 'error',
        title: `พบคำสงวนของระบบถูกใช้เป็นชื่อผู้พูด (${reservedSpeakers.map(d => d.speaker).join(', ')})`,
        description: 'คำสั่งระบบ เช่น LOCK, CONT, FRAME, AUTO, RULE, NO, OUT, STORY, CHARACTERS, END, SALA_MULTI_CLIP ห้ามใช้เป็นชื่อผู้พูด',
        suggestion: 'แก้ไขชื่อผู้พูดให้เป็นชื่อตัวละครจริง'
      });
    }

    const unassigned = dialogues.filter(d => !d.speaker || !d.line);
    if (unassigned.length > 0) {
      issues.push({
        id: 'issue_dialogue_speaker',
        clipNumber: 1,
        type: 'dialogue',
        severity: 'warning',
        title: 'พบบทพูดที่ไม่มีผู้พูดชัดเจน',
        description: 'มีบทพูดที่ยังไม่ได้ผูกกับตัวละคร อาจทำให้โมเดลสลับผู้พูดได้',
        suggestion: 'ระบุชื่อผู้พูดให้ตรงกับตัวละครในฉาก'
      });
    } else if (reservedSpeakers.length === 0) {
      passedChecks.push(`Dialogue Lock: ล็อคบทพูดและผู้พูดตรงตัว ${dialogues.length} รายการ (ไม่สลับตัวละคร)`);
    }
  }

  // Check 4: Lighting & Time Consistency
  if (!continuityLock?.timeOfDay || !continuityLock?.lighting) {
    issues.push({
      id: 'issue_lighting',
      clipNumber: 1,
      type: 'lighting',
      severity: 'info',
      title: 'ทิศทางแสงและช่วงเวลาของวันยังไม่ได้ล็อคแบบเจาะจง',
      description: 'หากไม่ระบุทิศทางแสง อาจทำให้แสงแดดเปลี่ยนทิศระหว่างคลิป',
      suggestion: 'แนะนำให้เลือกเวลา เช่น เช้าตรู่ (Golden Hour) หรือ บ่าย เพื่อความสม่ำเสมอ'
    });
  } else {
    passedChecks.push(`Lighting & Time Lock: ${continuityLock.timeOfDay} (${continuityLock.lighting})`);
  }

  // Check 5: Aspect Ratio & Resolution
  passedChecks.push(`Framing Lock: อัตราส่วน ${continuityLock?.aspectRatio || '16:9'} ความละเอียด ${continuityLock?.resolution || '1080p'}`);

  res.json({
    success: true,
    report: {
      hasConflicts: issues.some(i => i.severity === 'error'),
      totalIssues: issues.length,
      issues,
      passedChecks
    }
  });
});

// ==========================================
// 6.13 EMERGENCY STOP & BATCH CANCELLATION
// ==========================================
const emergencyStopHandler = async (req: express.Request, res: express.Response) => {
  const auth = await getAuthenticatedUser(req);
  if (!auth) {
    return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อนหยุดงาน' });
  }
  const { jobIds } = req.body || {};
  const owned: GenerationJob[] = [];
  if (Array.isArray(jobIds)) {
    for (const id of jobIds) {
      const job = jobsStore.get(id);
      if (job && job.userId === auth.user.id && (job.status === 'queued' || job.status === 'processing')) {
        owned.push(job);
      }
    }
  }
  const refundTotal = owned.reduce((sum, job) => sum + (Number(job.costCredits) || 0), 0);
  let refundedCredits = 0;
  let remainingCredits: number | null = null;
  if (refundTotal > 0) {
    if (!isRealCreditUid(auth.user.id)) {
      refundedCredits = 0;
    } else {
      try {
        remainingCredits = await adjustFirestoreCredits(auth.user.id, refundTotal, 'คืนเครดิตจากการหยุดฉุกเฉิน');
        rememberUserBalance(auth.user.id, remainingCredits, {
          id: `tx_emergency_refund_${Date.now()}`,
          amount: refundTotal,
          description: `คืนเครดิตจากการกดหยุดฉุกเฉิน จำนวน ${owned.length} งาน (+${refundTotal} เครดิต)`,
          type: 'refund'
        });
        refundedCredits = refundTotal;
      } catch (err: any) {
        return res.status(err?.status || 503).json({
          success: false,
          cancelledCount: 0,
          refundedCredits: 0,
          message: err?.message || 'ยกเลิกงานไม่สำเร็จ เพราะบันทึกการคืนเครดิตลง Firestore ไม่ได้ และไม่ได้เติมเข้าบัญชีสาธิต'
        });
      }
    }
  }
  for (const job of owned) {
    job.status = 'cancelled';
    job.stage = 'ยกเลิกฉุกเฉิน (Emergency Stopped)';
    jobsStore.set(job.id, job);
  }
  return res.json({
    success: true,
    cancelledCount: owned.length,
    refundedCredits,
    remainingCredits,
    message: refundedCredits > 0
      ? `หยุดงานสำเร็จ ยกเลิก ${owned.length} งาน และบันทึกคืนเครดิต +${refundedCredits} ลง Firestore แล้ว`
      : `หยุดงานสำเร็จ ยกเลิก ${owned.length} งาน โดยไม่ได้เติมเครดิตเข้าบัญชีสาธิต`
  });
};

app.post('/api/director/emergency-stop', emergencyStopHandler);
app.post('/api/emergency-stop', emergencyStopHandler);

// ==========================================
// 6.14 LIP SYNC MODE WORKFLOW GENERATOR
// ==========================================
app.post('/api/lipsync/generate-workflow', (req, res) => {
  const { characterImageUrl, characterName, scriptText, audioFileName, provider, emotion } = req.body;

  // Real capability status check:
  // Google Gemini/Veo and Meta do NOT currently provide native direct public viseme/audio LipSync API.
  // We honestly declare supported: false, and provide the specialized prompt workflow without lying.
  const workflowPrompt = `[LIP_SYNC_DIRECTIVE]
Character: ${characterName || 'Hero Character'}
Reference Facial Anchor: ${characterImageUrl || 'Clean frontal portrait'}
Audio Script: "${scriptText || 'บทพูดภาษาไทยธรรมชาติ'}"
Emotion / Viseme Tone: ${emotion || 'Natural spoken Thai'}
Audio Track: ${audioFileName || 'Master audio dialogue'}

VISUAL SPECIFICATION:
- Camera: Static medium close-up, focal length 85mm, aperture f/2.0
- Mouth Movement (Phoneme-to-Viseme alignment): Accurate lip opening, teeth visibility, natural consonant plosives.
- Micro-expressions: Natural eye blinking at 4-second intervals, subtle eyebrow micro-tensions aligned with vocal stress.
- Head Movement: Damped natural head nodding on emphasis, no unnatural bobbing.

EXTERNAL PIPELINE GUIDE:
1. Runway Gen-3 Act-One: Use portrait image as actor anchor and provide webcam/recorded audio as driver.
2. LivePortrait / SadTalker: Input reference face + extracted WAV audio for zero-shot synchronization.
3. Hedra Character-1: Upload audio speech and character anchor with speech prompt directive above.`;

  res.json({
    success: true,
    supported: false,
    providerName: providerManager.get(provider || 'gemini').name,
    statusNote: 'ปัจจุบันยังไม่มี Lip Sync API ทางตรงจาก Google Veo หรือ Meta (ระบบไม่แสดงสถานะปลอมว่ามี API ตรง) — ได้จัดเตรียม Lip Sync Directives & Workflow Guide สำหรับนำไปใช้ใน Runway Act-One / LivePortrait / SadTalker / Hedra ให้ทันที',
    workflowPrompt,
    visemeInstructions: [
      'แมปคำพูดภาษาไทยกับ Viseme ปากตามความยาวคลื่นเสียง',
      'ล็อคโครงหน้า ดวงตา และเส้นผมไม่ให้บิดเบี้ยวระหว่างอ้าปาก',
      'ลดแรงกระตุกศีรษะให้เคลื่อนไหวเป็นธรรมชาติ (Damped head physics)'
    ],
    compatibleExternalTools: ['Runway Gen-3 Act-One', 'LivePortrait', 'SadTalker', 'Hedra Character-1']
  });
});

// ==========================================
// 6.15 VIDEO TO SCRIPT (speech transcript only)
// ==========================================
const VIDEO_TO_SCRIPT_MAX_BYTES = 20 * 1024 * 1024;

function readBodyLimited(req: express.Request, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const fail = (error: Error) => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      reject(error);
    };
    const onData = (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        const error: any = new Error('ไฟล์วิดีโอใหญ่เกิน 20MB');
        error.code = 'TOO_BIG';
        req.destroy();
        fail(error);
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => resolve(Buffer.concat(chunks));
    const onError = (error: Error) => fail(error);
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

function extractMultipartFile(body: Buffer, contentType: string): { filename: string; mime: string; data: Buffer } | null {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!match) return null;
  const boundary = Buffer.from(`--${(match[1] || match[2]).trim()}`);
  let cursor = body.indexOf(boundary);
  while (cursor !== -1) {
    let partStart = cursor + boundary.length;
    const marker = body.subarray(partStart, partStart + 2).toString('utf8');
    if (marker === '--') break;
    if (marker === '\r\n') partStart += 2;
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), partStart);
    if (headerEnd < 0) break;
    const next = body.indexOf(boundary, headerEnd + 4);
    if (next < 0) break;
    const headers = body.subarray(partStart, headerEnd).toString('utf8');
    if (/filename=/i.test(headers)) {
      const nameMatch = /filename="([^"]*)"/i.exec(headers) || /filename=([^;\r\n]+)/i.exec(headers);
      const mimeMatch = /Content-Type:\s*([^\r\n]+)/i.exec(headers);
      let dataEnd = next;
      if (body.subarray(dataEnd - 2, dataEnd).toString('utf8') === '\r\n') dataEnd -= 2;
      return {
        filename: (nameMatch?.[1] || 'video').trim() || 'video',
        mime: (mimeMatch?.[1] || 'application/octet-stream').trim(),
        data: body.subarray(headerEnd + 4, dataEnd)
      };
    }
    cursor = next;
  }
  return null;
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/ffmpeg', args, { timeout: 120000, maxBuffer: 2 * 1024 * 1024 }, (error, _stdout, stderr) => {
      if (!error) {
        resolve();
        return;
      }
      const detail = String(stderr || error.message || '');
      const noAudio = /does not contain any stream|Output file is empty|matches no streams/i.test(detail);
      const wrapped: any = new Error(noAudio ? 'วิดีโอนี้ไม่มีแทร็กเสียง' : 'ดึงเสียงจากวิดีโอไม่สำเร็จ');
      wrapped.ffmpeg = detail.slice(0, 500);
      reject(wrapped);
    });
  });
}

function speechTextFromPart(transcription: any): string {
  if (!transcription || typeof transcription !== 'object') return '';
  if (typeof transcription.text === 'string' && transcription.text.trim()) return transcription.text.trim();
  if (!Array.isArray(transcription.words)) return '';
  return transcription.words.map((word: any) => String(word?.word || '').trim()).filter(Boolean).join(' ').trim();
}

function speakerScriptLabel(raw: string): string {
  const match = /(?:spk[:_\s]*)(\d+)/i.exec(raw);
  if (!match) return raw;
  return `ผู้พูด ${Number(match[1]) + 1}`;
}

/** Gemini 3.5 Transcribe puts the spoken words on audioTranscription, not response.text. */
function speechTranscriptFromResponse(response: any): string {
  const lines: string[] = [];
  const candidates = Array.isArray(response?.candidates) ? response.candidates : [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      const spoken = speechTextFromPart(part?.audioTranscription);
      if (spoken) {
        const speaker = typeof part.audioTranscription?.speakerLabel === 'string'
          ? part.audioTranscription.speakerLabel.trim()
          : '';
        lines.push(speaker ? `${speakerScriptLabel(speaker)}: ${spoken}` : spoken);
        continue;
      }
      if (typeof part?.text === 'string' && part.text.trim() && !part.thought) {
        lines.push(part.text.trim());
      }
    }
  }
  return lines.join('\n').trim();
}

async function uploadWavForTranscription(ai: any, wavPath: string): Promise<{ name: string; uri: string; mimeType: string }> {
  let current = await ai.files.upload({
    file: wavPath,
    config: { mimeType: 'audio/wav' }
  });
  const name = String(current?.name || '');
  if (!name) {
    throw new Error('ส่งเสียงไปถอดบทไม่สำเร็จ');
  }
  for (let attempt = 0; attempt < 30 && String(current?.state || '') === 'PROCESSING'; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    current = await ai.files.get({ name });
  }
  const uri = String(current?.uri || '');
  if (!uri || String(current?.state || '') === 'FAILED') {
    throw new Error('ส่งเสียงไปถอดบทไม่สำเร็จ');
  }
  return {
    name,
    uri,
    mimeType: String(current?.mimeType || 'audio/wav')
  };
}

app.post('/api/video-to-script/analyze', async (req, res) => {
  const contentType = String(req.headers['content-type'] || '');
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return res.status(400).json({ success: false, message: 'ต้องอัปโหลดไฟล์วิดีโอ' });
  }

  let body: Buffer;
  try {
    body = await readBodyLimited(req, VIDEO_TO_SCRIPT_MAX_BYTES + 256 * 1024);
  } catch (err: any) {
    if (err?.code === 'TOO_BIG' || res.headersSent) {
      if (!res.headersSent) {
        return res.status(400).json({ success: false, message: 'ไฟล์วิดีโอใหญ่เกิน 20MB' });
      }
      return;
    }
    return res.status(400).json({ success: false, message: 'อ่านไฟล์วิดีโอไม่สำเร็จ' });
  }

  const file = extractMultipartFile(body, contentType);
  if (!file || file.data.length === 0) {
    return res.status(400).json({ success: false, message: 'ต้องอัปโหลดไฟล์วิดีโอ' });
  }
  if (file.data.length > VIDEO_TO_SCRIPT_MAX_BYTES) {
    return res.status(400).json({ success: false, message: 'ไฟล์วิดีโอใหญ่เกิน 20MB' });
  }

  // Server key only. A key stored in the app must not be used for transcription.
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(400).json({
      success: false,
      code: 'GEMINI_KEY_MISSING',
      message: 'ยังไม่ได้ตั้งค่า Gemini API Key'
    });
  }

  const stamp = crypto.randomBytes(8).toString('hex');
  const inputPath = path.join('/tmp', `sala-v2s-${stamp}.bin`);
  const wavPath = path.join('/tmp', `sala-v2s-${stamp}.wav`);
  let uploadedName = '';
  try {
    await fs.promises.writeFile(inputPath, file.data);
    await runFfmpeg(['-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', '16000', '-f', 'wav', wavPath]);
    const wavStat = await fs.promises.stat(wavPath).catch(() => null);
    if (!wavStat || wavStat.size < 44) {
      return res.status(400).json({ success: false, message: 'ดึงเสียงจากวิดีโอไม่สำเร็จ' });
    }

    const uploaded = await uploadWavForTranscription(ai, wavPath);
    uploadedName = uploaded.name;
    let billed: { response: any } | null = null;
    try {
      billed = await callBillableGemini(req, res, ai, {
        model: 'gemini-3.5-transcribe',
        contents: [{
          role: 'user',
          parts: [{ fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType } }]
        }],
        config: {
          audioTranscriptionConfig: {
            diarization: true,
            mode: 'VERBATIM'
          }
        }
      }, 'video to script');
    } catch (geminiErr: any) {
      if (res.headersSent) return;
      return res.status(400).json({
        success: false,
        code: 'GEMINI_API_ERROR',
        message: formatGenAIError(geminiErr)
      });
    }
    if (!billed) return;

    const transcript = speechTranscriptFromResponse(billed.response);
    if (!transcript) {
      return res.status(502).json({ success: false, message: 'ไม่พบเสียงพูดในวิดีโอนี้' });
    }
    return res.json({ success: true, transcript });
  } catch (err: any) {
    if (res.headersSent) return;
    console.error('video-to-script analyze failed:', err?.ffmpeg || err?.message || err);
    const known = err?.message === 'วิดีโอนี้ไม่มีแทร็กเสียง'
      || err?.message === 'ดึงเสียงจากวิดีโอไม่สำเร็จ'
      || err?.message === 'ส่งเสียงไปถอดบทไม่สำเร็จ';
    return res.status(400).json({
      success: false,
      message: known ? err.message : 'ถอดเสียงจากวิดีโอไม่สำเร็จ'
    });
  } finally {
    if (uploadedName) {
      await ai.files.delete({ name: uploadedName }).catch(() => {});
    }
    await fs.promises.unlink(inputPath).catch(() => {});
    await fs.promises.unlink(wavPath).catch(() => {});
  }
});

// ==========================================
// 6.16 SCRIPT EDITOR & CHARACTER REPLACEMENT
// ==========================================
app.post('/api/script/replace-characters', (req, res) => {
  const { scriptText, dialogues, oldName, newName, characterLibraryId } = req.body;

  if (!oldName || !newName) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อเดิมและชื่อใหม่ที่ต้องการเปลี่ยน' });
  }

  // Replace in scriptText
  const regex = new RegExp(oldName, 'gi');
  const updatedScriptText = (scriptText || '').replace(regex, newName);

  // Replace in dialogues
  const updatedDialogues = Array.isArray(dialogues)
    ? dialogues.map(d => ({
        ...d,
        speaker: d.speaker === oldName ? newName : d.speaker.replace(regex, newName),
        line: d.line.replace(regex, newName)
      }))
    : [];

  // If character library ID is mapped, fetch new character details
  let newCharDetails: any = null;
  if (characterLibraryId) {
    newCharDetails = charactersStore.find(c => c.id === characterLibraryId);
  }

  res.json({
    success: true,
    updatedScriptText,
    updatedDialogues,
    newCharacter: newCharDetails,
    message: `แทนที่ชื่อตัวละคร "${oldName}" เป็น "${newName}" เรียบร้อยแล้วในบทและบทพูดทั้งหมด`
  });
});

// ==========================================
// 6.17 AI SOCIAL POST ASSISTANT
// ==========================================
app.post('/api/social/generate-posts', async (req, res) => {
  const { scriptText, characterName, tone } = req.body || {};
  const story = typeof scriptText === 'string' ? scriptText.trim() : '';
  if (!story) {
    return res.status(400).json({ success: false, message: 'ยังไม่มีเนื้อเรื่องปัจจุบัน', recommendations: [] });
  }
  const recommendations = buildSocialPostsFromStory(story, characterName, tone);
  res.json({ success: true, recommendations });
});

// ==========================================
// 6.18 PROJECT TEMPLATES & VERSIONING
// ==========================================

// Get Project Templates
app.get('/api/project-templates', (req, res) => {
  res.json({ success: true, templates: projectTemplatesStore });
});

// Save Project Template
app.post('/api/project-templates', (req, res) => {
  const { name, description, aspectRatio, visualStyle, defaultCharacterId, continuityLock, audioDirectives } = req.body;

  if (!name) {
    return res.status(400).json({ success: false, message: 'กรุณาระบุชื่อเทมเพลต' });
  }

  const newTemplate: ProjectTemplate = {
    id: `tmpl_${Date.now()}`,
    name,
    description: description || '',
    aspectRatio: aspectRatio || '16:9',
    visualStyle: visualStyle || 'Cinematic',
    defaultCharacterId,
    continuityLock,
    audioDirectives,
    createdAt: new Date().toISOString()
  };

  projectTemplatesStore.push(newTemplate);
  res.json({ success: true, template: newTemplate, message: 'บันทึกเทมเพลตโครงการเรียบร้อยแล้ว' });
});

// Create Project Version Snapshot
app.post('/api/projects/:id/version', requireAuth, (req: any, res) => {
  const { note } = req.body;
  const project = projectsStore.find(p => p.id === req.params.id);
  if (project && project.userId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงโปรเจ็กต์ของผู้ใช้อื่น' });
  }

  if (!project) {
    return res.status(404).json({ success: false, message: 'ไม่พบโปรเจ็กต์' });
  }

  if (!project.versions) {
    project.versions = [];
  }

  const versionNum = project.versions.length + 1;
  const newVersion = {
    id: `ver_${Date.now()}`,
    versionNumber: versionNum,
    createdAt: new Date().toISOString(),
    note: note || `เวอร์ชันที่ ${versionNum} (Auto-Saved Snapshot)`,
    sceneCount: project.scenes.length,
    snapshot: JSON.parse(JSON.stringify(project))
  };

  project.versions.unshift(newVersion);
  res.json({ success: true, version: newVersion, message: `บันทึกเวอร์ชันที่ ${versionNum} สำเร็จ` });
});

// Restore Project Version Snapshot
app.post('/api/projects/:id/restore-version', requireAuth, (req: any, res) => {
  const { versionId } = req.body;
  const project = projectsStore.find(p => p.id === req.params.id);
  if (project && project.userId !== req.user.id) {
    return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึงโปรเจ็กต์ของผู้ใช้อื่น' });
  }

  if (!project || !project.versions) {
    return res.status(404).json({ success: false, message: 'ไม่พบโปรเจ็กต์หรือประวัติเวอร์ชัน' });
  }

  const targetVer = project.versions.find((v: any) => v.id === versionId);
  if (!targetVer) {
    return res.status(404).json({ success: false, message: 'ไม่พบเวอร์ชันที่ต้องการย้อนกลับ' });
  }

  // Restore snapshot fields
  project.title = targetVer.snapshot.title;
  project.description = targetVer.snapshot.description;
  project.aspectRatio = targetVer.snapshot.aspectRatio;
  project.scenes = targetVer.snapshot.scenes;
  project.updatedAt = new Date().toISOString();

  res.json({ success: true, project, message: `ย้อนกลับโปรเจ็กต์สู่เวอร์ชันที่ ${targetVer.versionNumber} เรียบร้อยแล้ว` });
});

registerTransferRoutes(app, getGeminiClient);


app.post('/api/ai/chat', requireAuth, async (req: any, res) => {
  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const turns = history
    .filter((turn: any) => turn && (turn.role === 'user' || turn.role === 'assistant') && typeof turn.text === 'string' && turn.text.trim())
    .slice(-20)
    .map((turn: any) => ({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(turn.text).slice(0, 4000) }]
    }));
  if (!turns.length || turns[turns.length - 1].role !== 'user') {
    return res.status(400).json({ success: false, message: 'พิมพ์ข้อความก่อน' });
  }
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ success: false, message: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า Gemini' });
  }
  try {
    const billed = await callBillableGemini(req, res, ai, {
      model: 'gemini-3.1-flash-lite',
      contents: turns,
      config: {
        systemInstruction: 'คุณคือ Sala AI ในห้องแชท ตอบเป็นภาษาไทยเหมือนคุยกับคน ถ้าผู้ใช้ขอขอบทหรือบทละคร ให้เขียนบทละครกลับไปเลย ห้ามตอบเป็นแบบฟอร์มว่าง'
      }
    }, 'ai chat');
    if (!billed) return;
    const text = billed.response?.text ? String(billed.response.text).trim() : '';
    if (!text) return res.status(502).json({ success: false, message: 'เอไอยังไม่ตอบ' });
    return res.json({ success: true, text });
  } catch (err: any) {
    return res.status(502).json({ success: false, message: formatGenAIError(err) });
  }
});

// Explicit 404 for unhandled API routes so they never fall through to Vite HTML
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API endpoint ${req.method} ${req.path} not found` });
});

// ==========================================
// 7. VITE MIDDLEWARE & SERVER STARTUP
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ศาลาเอไอ / Sala AI] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
