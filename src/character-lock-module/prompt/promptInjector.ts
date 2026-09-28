/**
 * Character Lock Module - Prompt Injector & Continuity Engine
 * Merges locked character visual profile, trigger tags, and consistency rules into generation prompts.
 */

import { Character } from '../types';

export interface PromptInjectionOptions {
  includeTriggerTag?: boolean;
  includeOutfit?: boolean;
  includePhysicalFeatures?: boolean;
  weightOverride?: number;
  strictContinuity?: boolean;
}

/**
 * Injects a character's locked visual traits into an existing video/image prompt
 */
export function injectCharacterIntoPrompt(
  basePrompt: string,
  character: Character,
  options: PromptInjectionOptions = {}
): string {
  const {
    includeTriggerTag = true,
    includeOutfit = true,
    includePhysicalFeatures = true,
    strictContinuity = true
  } = options;

  const characterTokens: string[] = [];

  // 1. Trigger Tag (e.g. (fahsai_modern_thai_girl:1.25))
  if (includeTriggerTag && character.triggerTag) {
    characterTokens.push(character.triggerTag);
  }

  // 2. Physical traits from 4-Layer visual profile or structured features
  if (includePhysicalFeatures) {
    const struct = character.structuredFeatures;
    const traits: string[] = [];

    if (struct) {
      if (struct.hairStyle && struct.hairStyle !== 'ไม่มีผม' && !struct.hairStyle.includes('ไม่เห็น')) {
        const hair = struct.hairColor ? `${struct.hairStyle} (${struct.hairColor})` : struct.hairStyle;
        traits.push(hair);
      }
      if (struct.skinTone && !struct.skinTone.includes('ไม่เห็น')) traits.push(struct.skinTone);
      if (struct.distinctFeatures && !struct.distinctFeatures.includes('ไม่มี')) traits.push(struct.distinctFeatures);
    } else if (character.visualProfile?.hairStyle) {
      traits.push(character.visualProfile.hairStyle);
      if (character.visualProfile.visibleDistinctiveDetails) {
        traits.push(character.visualProfile.visibleDistinctiveDetails);
      }
    }

    if (traits.length > 0) {
      characterTokens.push(traits.join(', '));
    }
  }

  // 3. Outfit traits
  if (includeOutfit) {
    const outfit = character.visualProfile?.visibleOutfit || character.outfitDescription;
    if (outfit && !outfit.includes('ไม่เห็นชัด')) {
      characterTokens.push(`wearing ${outfit}`);
    }
  }

  // 4. Strict Continuity Lock
  if (strictContinuity && character.lockStatus === 'LOCKED') {
    const strength = character.consistencyStrength || 0.85;
    characterTokens.push(`master character lock, continuous facial identity, consistency strength: ${strength.toFixed(2)}`);
  }

  const prefix = characterTokens.filter(Boolean).join(', ');
  if (!prefix) return basePrompt;

  return `${prefix}. ${basePrompt}`.trim();
}

/**
 * Builds a multi-character continuity lock header for multi-clip director engines
 */
export function buildContinuityLockDirective(characters: Character[]): string {
  const lockedChars = characters.filter(c => c.lockStatus === 'LOCKED');
  if (lockedChars.length === 0) return '';

  const lockDirectives = lockedChars.map(c => {
    const tag = c.triggerTag || c.name;
    const outfit = c.visualProfile?.visibleOutfit || c.outfitDescription || 'default costume';
    return `Character: ${c.name} [Tag: ${tag}] (Outfit: ${outfit}, Consistency: ${c.consistencyStrength || 0.85})`;
  });

  return `LOCK: ${lockDirectives.join(' | ')}`;
}
