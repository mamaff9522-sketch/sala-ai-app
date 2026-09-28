/**
 * @sala/character-lock-module
 * Complete Character Lock Architecture for Consistent AI Generation
 * 
 * Features:
 * - 4-Layer Character Data Architecture (Identity, Reference Metadata, Visual Profile, Story Profile)
 * - Deterministic SHA-256 Reference Image Hashing & Cost-Guard Caching
 * - Gemini 2.5 Flash Vision Multimodal Analysis with OCR Reference Sheet Extraction
 * - Character ID & Trigger Tag Generator
 * - Prompt Injection Engine for Strict Continuity & Keyframe Consistency
 * - Production-ready React Character Library UI Component
 * - Dual Storage Engine: Realtime Firestore with LocalStorage Fallback & Circuit Breaker
 */

// Types
export * from './types';

// Core Engine
export {
  generateCharacterId,
  generateTriggerTag,
  buildCharacterVisualPrompt,
  toggleCharacterLock,
  normalizeCharacterArchitecture
} from './core/characterEngine';
export { computeImageHash } from './core/imageHash';

// Vision & Analyzer
export { analyzeCharacterImage } from './vision/analyzeCharacterImage';
export {
  handleCharacterAnalysisRequest,
  parseImageData,
  visionAnalysisCache
} from './vision/serverVisionHandler';
export {
  persistReferenceImageToDisk,
  uploadReferenceImage
} from './vision/referenceUploader';

// Storage & Persistence
export {
  getActiveUid,
  DEFAULT_SAMPLE_CHARACTERS,
  getLocalStorageCharacters,
  saveCharactersToLocalStorage,
  fetchCharactersFromFirestore,
  normalizeCharacterPersistence,
  uploadCharacterReferenceImage,
  saveCharacterToFirestore,
  deleteCharacterFromFirestore,
  checkAndSyncCharacters,
  forceMigrateLocalStorageToFirestore
} from './storage/characterService';
export {
  isFirestoreQuotaExhausted,
  setFirestoreQuotaExhausted,
  isQuotaError,
  safeFirestoreWrite
} from './storage/firestoreGuard';

// Prompt Injector & Continuity
export {
  injectCharacterIntoPrompt,
  buildContinuityLockDirective
} from './prompt/promptInjector';

// UI Components
export { CharacterLibrary } from './components/CharacterLibrary';
