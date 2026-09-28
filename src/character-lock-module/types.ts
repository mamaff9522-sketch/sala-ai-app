/**
 * Character Lock Module - Type Definitions
 * Exact extracted type system for 4-Layer Character Architecture & Continuity Locking
 */

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

// 4-Layer Character Architecture Field Tracking
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
  outfitDescription?: string;
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

export interface CharacterImageAnalysis {
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

  // 4-Layer Character Architecture
  characterIdentity?: CharacterIdentity;
  referenceMetadata?: CharacterReferenceMetadata;
  visualProfile?: CharacterVisualProfile;
  storyProfile?: CharacterStoryProfile;
  fieldSources?: Record<string, FieldSource>;

  imageHash?: string;
  referenceImageId?: string;
  referenceImageUrl?: string;
  detectedName?: string;
  detectedAge?: string;
  detectedHeight?: string;
  availableViews?: string[];
  detectedViews?: string[];
  isMultiViewSheet?: boolean;
  generatedVisualPrompt?: string;
  cached?: boolean;

  // Backward-compatible fields
  age: string;
  description: string;
  outfitDescription: string;
  suggestedName?: string;
  fullSummary?: string;
  structured?: CharacterStructuredFeatures;
  source?: 'gemini-flash' | 'cache';
}

export interface AnalyzeCharacterImageOptions {
  token?: string;
  apiKey?: string;
  forceReanalyze?: boolean;
}

export interface SyncAuditResult {
  localCount: number;
  firestoreCount: number;
  syncedToFirestore: number;
  syncedToLocal: number;
  inSync: boolean;
  error?: string;
}
