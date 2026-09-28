/**
 * Character Lock Module - Core Engine
 * Manages Character Identity, Normalization, Consistency Locking, and Prompt Synthesis.
 */

import {
  Character,
  CharacterIdentity,
  CharacterReferenceMetadata,
  CharacterVisualProfile,
  CharacterStoryProfile,
  CharacterStructuredFeatures,
  CharacterLockStatus
} from '../types';
import { computeImageHash } from './imageHash';

/**
 * Generates a unique, URL-safe character identifier
 */
export function generateCharacterId(prefix: string = 'char'): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${timestamp}_${randomSuffix}`;
}

/**
 * Creates an AI model trigger tag from character name
 */
export function generateTriggerTag(name: string, weight: number = 1.25): string {
  const cleanName = (name || 'character')
    .toLowerCase()
    .replace(/[^\w\u0E00-\u0E7F]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `(${cleanName}_character:${weight.toFixed(2)})`;
}

/**
 * Builds a visual prompt synthesizer string from character attributes
 */
export function buildCharacterVisualPrompt(character: Partial<Character>): string {
  const parts: string[] = [];

  // 1. Identity & Trigger Tag
  if (character.triggerTag) {
    parts.push(character.triggerTag);
  }

  // 2. Physical Appearance
  const struct = character.structuredFeatures;
  if (struct) {
    if (struct.creatureType && struct.creatureType !== 'human') {
      parts.push(struct.species ? `${struct.creatureType} (${struct.species})` : struct.creatureType);
    }
    if (struct.hairStyle && struct.hairStyle !== 'ไม่มีผม') {
      const hair = struct.hairColor ? `${struct.hairStyle}, ${struct.hairColor} hair` : struct.hairStyle;
      parts.push(hair);
    }
    if (struct.skinTone) parts.push(`${struct.skinTone} skin`);
    if (struct.eyeDescription) parts.push(struct.eyeDescription);
    if (struct.bodyType) parts.push(struct.bodyType);
    if (struct.distinctFeatures) parts.push(struct.distinctFeatures);
  } else if (character.description) {
    parts.push(character.description);
  }

  // 3. Clothing & Outfits
  if (struct?.topClothing || struct?.bottomClothing || struct?.footwear || struct?.accessories) {
    const outfit: string[] = [];
    if (struct.topClothing) outfit.push(struct.topClothing);
    if (struct.bottomClothing) outfit.push(struct.bottomClothing);
    if (struct.footwear) outfit.push(struct.footwear);
    if (struct.accessories && struct.accessories !== 'ไม่มี') outfit.push(struct.accessories);
    if (outfit.length > 0) parts.push(`wearing ${outfit.join(', ')}`);
  } else if (character.outfitDescription) {
    parts.push(`wearing ${character.outfitDescription}`);
  }

  // 4. Consistency Lock enforcement
  const strength = character.consistencyStrength ?? 0.85;
  if (strength >= 0.8) {
    parts.push('exact facial features, consistent character design, master keyframe continuity');
  }

  return parts.filter(Boolean).join(', ');
}

/**
 * Sets the Lock Status of a character with hash validation
 */
export async function toggleCharacterLock(
  character: Character,
  desiredStatus?: CharacterLockStatus
): Promise<Character> {
  const currentStatus = character.lockStatus || 'UNLOCKED';
  const nextStatus = desiredStatus || (currentStatus === 'LOCKED' ? 'UNLOCKED' : 'LOCKED');

  let imageHash = character.imageHash;
  if (!imageHash && character.referenceImages && character.referenceImages.length > 0) {
    imageHash = await computeImageHash(character.referenceImages[0]);
  }

  return {
    ...character,
    lockStatus: nextStatus,
    imageHash: imageHash || character.imageHash,
    currentReferenceImageHash: imageHash || character.currentReferenceImageHash,
    visualProfileImageHash: nextStatus === 'LOCKED' ? imageHash : character.visualProfileImageHash,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Normalizes character data ensuring all 4 layers are populated
 */
export function normalizeCharacterArchitecture(raw: Partial<Character>): Character {
  const id = raw.id || generateCharacterId();
  const name = raw.name || raw.identity?.name || 'ตัวละครใหม่';
  const refImages = raw.referenceImages || (raw.avatarUrl ? [raw.avatarUrl] : []);
  const primaryImage = raw.referenceImageUrl || refImages[0] || raw.avatarUrl || '';
  const now = new Date().toISOString();

  const identity: CharacterIdentity = raw.identity || raw.characterIdentity || {
    id,
    name
  };

  const referenceMetadata: CharacterReferenceMetadata = raw.referenceMetadata || {
    referenceImageId: raw.referenceImageId || `ref_${id}`,
    referenceImageUrl: primaryImage,
    imageHash: raw.imageHash || '',
    availableViews: ['FRONT']
  };

  const visualProfile: CharacterVisualProfile = raw.visualProfile || {
    referenceImage: primaryImage,
    referenceImages: refImages,
    imageAnalysisStatus: raw.imageAnalysisStatus || 'idle',
    hairStyle: raw.structuredFeatures?.hairStyle || raw.hairStyle || 'ตามภาพอ้างอิง',
    hairColor: raw.structuredFeatures?.hairColor || '',
    top: raw.structuredFeatures?.topClothing || '',
    bottom: raw.structuredFeatures?.bottomClothing || '',
    shoes: raw.structuredFeatures?.footwear || '',
    accessories: raw.structuredFeatures?.accessories || '',
    visibleDistinctiveDetails: raw.structuredFeatures?.distinctFeatures || '',
    confidence: raw.analysisConfidence || 85,
    generatedVisualPrompt: buildCharacterVisualPrompt(raw)
  };

  const storyProfile: CharacterStoryProfile = raw.storyProfile || {
    age: raw.age || '',
    personality: '',
    occupation: '',
    role: '',
    background: '',
    storyInfo: ''
  };

  return {
    id,
    name,
    gender: raw.gender || raw.structuredFeatures?.gender || 'ไม่ระบุ',
    age: raw.age || raw.structuredFeatures?.ageRange || 'ไม่ระบุ',
    description: raw.description || '',
    triggerTag: raw.triggerTag || generateTriggerTag(name),
    referenceImages: refImages,
    referenceImageId: referenceMetadata.referenceImageId,
    referenceImageUrl: primaryImage,
    imageHash: referenceMetadata.imageHash,
    outfitDescription: raw.outfitDescription || '',
    consistencyStrength: typeof raw.consistencyStrength === 'number' ? raw.consistencyStrength : 0.85,
    avatarUrl: raw.avatarUrl || primaryImage,
    userId: raw.userId,
    structuredFeatures: raw.structuredFeatures,
    analysisConfidence: raw.analysisConfidence ?? 85,
    isVerifiedByUser: raw.isVerifiedByUser ?? false,
    identity,
    characterIdentity: identity,
    referenceMetadata,
    visualProfile,
    storyProfile,
    fieldSources: raw.fieldSources || {},
    imageAnalysisStatus: raw.imageAnalysisStatus || 'idle',
    lockStatus: raw.lockStatus || 'UNLOCKED',
    currentReferenceImageHash: referenceMetadata.imageHash,
    visualProfileImageHash: raw.visualProfileImageHash,
    createdAt: raw.createdAt || now,
    updatedAt: now
  };
}
