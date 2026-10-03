import { Character, LocationItem, MasterContinuityLock } from '../types';
import { getApiKey } from './auth';
import { toCharacterLockPayload } from './characterAppearance';
import { parseScriptLocally, applySplitLocks } from './localScriptParser';

/** Offline split in the browser: same code path as the server's offline branch (no server / login / AI). */
function splitScriptLocally(scriptText: string, options?: ScriptSplitOptions, notice?: string): ScriptSplitResult {
  const text = scriptText.trim();
  const characters = (options?.characters || []).map(c => toCharacterLockPayload(c));
  const data = applySplitLocks(parseScriptLocally(text, options?.clipCount, characters), options?.continuityLock, { characters, scriptText: text });
  if (notice) {
    data.characterWarnings = [notice, ...(data.characterWarnings || [])];
    data.warnings = [notice, ...(data.warnings || [])];
  }
  return { ...data, source: 'fallback-parser' };
}

/**
 * Sala AI - Script Splitter Service
 * ฟังก์ชันรับบทละคร/โครงเรื่อง ส่งให้ Gemini Flash แยกตัวละคร คำพูด สถานที่ ฉาก แสง กล้อง
 * คืนค่าเป็น JSON โครงสร้างสมบูรณ์สำหรับเติมช่องต่าง ๆ ในแอปอัตโนมัติ
 */

export interface SplitCharacter {
  name: string;
  description: string;
  role?: string;
  /** Visual appearance ('' when none was supplied / found in the script - never a placeholder) */
  appearance?: string;
  face?: string;
  hairstyle?: string;
  outfit?: string;
  personality?: string;
  appearanceSource?: 'supplied' | 'script' | 'supplied+script' | 'none';
  /** Full Character Lock text, e.g. "พี่ทุย (face: …; hair: …; outfit: …)" */
  lockText?: string;
}

export interface SplitDialogue {
  id: string;
  speaker: string;
  line: string;
  emotionTone?: string;
  sceneNumber?: number;
}

export interface SplitLocation {
  name: string;
  description: string;
  atmosphere?: string;
}

export interface SplitCamera {
  movement: string;
  lensType: string;
  shotType: string;
}

export interface SplitScene {
  sceneNumber: number;
  title: string;
  location: string;
  timeOfDay: string;
  lighting: string;
  camera: string;
  characters: string[];
  action: string;
  dialogue?: string;
  prompt?: string;
}

export interface SplitContinuityLock {
  characterName: string;
  characterAppearance: string;
  location: string;
  timeOfDay: string;
  lighting: string;
  visualStyle: string;
  cameraMovement: string;
  cameraShotType: string;
  lensType: string;
  props: string;
}

export interface ScriptSplitResult {
  title: string;
  characters: SplitCharacter[];
  dialogues: SplitDialogue[];
  locations: SplitLocation[];
  scenes: SplitScene[];
  lighting: string;
  camera: SplitCamera;
  continuityLock: SplitContinuityLock;
  source: 'gemini-flash' | 'fallback-parser';
  /** e.g. "ยังไม่ได้ระบุรูปลักษณ์ของ X" */
  characterWarnings?: string[];
  /** Character + position continuity warnings (human readable) */
  warnings?: string[];
  /** Position Lock after the last scene */
  characterPositionLocks?: import('../types').ClipCharacterPose[];
  ORIGINAL_DIALOGUE_ONLY?: boolean;
  INVENT_DIALOGUE?: boolean;
  NARRATION_TO_DIALOGUE?: boolean;
}

export interface ScriptSplitOptions {
  clipCount?: number;
  token?: string;
  /** User's Gemini key (defaults to the saved key: Firestore when signed in, else localStorage) */
  apiKey?: string;
  /** User's locks: forwarded as LOCKED CONTINUITY CONTEXT and forced into every scene */
  continuityLock?: Partial<MasterContinuityLock>;
  characters?: Character[];
  locations?: LocationItem[];
  /** Explicit offline choice: the server's local parser is used instead of Gemini */
  offlineMode?: boolean;
}

/**
 * ฟังก์ชันรับบทละคร เรียก Gemini Flash ผ่าน API backend และคืนค่า JSON
 * แยกตัวละคร, คำพูด, สถานที่, ฉาก, แสง, กล้อง
 * - ใช้ตัวแยกบทในเครื่อง (ไม่ใช้ AI) เฉพาะเมื่อผู้ใช้เลือก offlineMode เองเท่านั้น
 * - ถ้า Gemini ล้มเหลว จะ throw error ที่อ่านได้ (ไม่สลับไปใช้ตัวสำรองแบบเงียบๆ)
 */
export async function splitScript(
  scriptText: string,
  options?: ScriptSplitOptions
): Promise<ScriptSplitResult> {
  if (!scriptText || !scriptText.trim()) {
    throw new Error('กรุณากรอกบทละครหรือเนื้อเรื่องก่อนให้ AI ทำการแยกบท');
  }

  // Offline mode: parse in the browser (no /api/script/split call, works without the server or login)
  if (options?.offlineMode === true) {
    return splitScriptLocally(scriptText, options);
  }

  const hasStorage = typeof localStorage !== 'undefined';
  const token = options?.token || (hasStorage ? localStorage.getItem('sala_auth_token') || '' : '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let apiKey = '';
  if (!options?.offlineMode) {
    apiKey = (options?.apiKey || '').trim();
    if (!apiKey) {
      try {
        apiKey = (await getApiKey('gemini')) || '';
      } catch {
        apiKey = hasStorage ? localStorage.getItem('sala_gemini_api_key') || '' : '';
      }
    }
  }

  let res: Response;
  try {
    res = await fetch('/api/script/split', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        scriptText: scriptText.trim(),
        clipCount: options?.clipCount,
        apiKey: apiKey || undefined,
        continuityLock: options?.continuityLock,
        characters: (options?.characters || []).map(c => toCharacterLockPayload(c)),
        locations: (options?.locations || []).map(l => ({ id: l.id, name: l.name, description: (l as any).description || '' })),
        offlineMode: false
      }),
    });
  } catch (netErr: any) {
    throw new Error(`เชื่อมต่อเซิร์ฟเวอร์แยกบทไม่ได้ / Cannot reach /api/script/split: ${netErr?.message || netErr}`);
  }

  // Non-JSON (e.g. index.html from a preview without the API server): use the local parser, with a visible notice
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return splitScriptLocally(scriptText, options,
      `เซิร์ฟเวอร์ API ไม่ตอบกลับเป็น JSON (HTTP ${res.status}) — ใช้ตัวแยกบทออฟไลน์ในเบราว์เซอร์แทน / API server returned non-JSON from /api/script/split; used the offline parser instead`);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.message || `เกิดข้อผิดพลาดในการแยกบท (HTTP ${res.status})`);
  }
  if (!json.data) {
    throw new Error('ไม่พบข้อมูลผลลัพธ์จากการแยกบท / Empty split result');
  }
  return {
    ...json.data,
    ORIGINAL_DIALOGUE_ONLY: true,
    INVENT_DIALOGUE: false,
    NARRATION_TO_DIALOGUE: false,
    source: json.source || 'gemini-flash',
  };
}

import {
  CharacterStructuredFeatures,
  CharacterVisualProfile,
  CharacterIdentity,
  CharacterReferenceMetadata,
  CharacterStoryProfile,
  FieldSource
} from '../types';

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

/**
 * วิเคราะห์รูปภาพตัวละครจริง (Actual Image Data) ด้วย Gemini Flash Vision
 * - ใช้รูปแรกเป็นรูปอ้างอิงหลัก (Primary Reference)
 * - รูปที่เหลือเป็นรูปเสริม (Supporting Reference) หรือตรวจจับ Multi-View Reference Sheet
 * - วิเคราะห์เฉพาะสิ่งที่มองเห็นได้ชัดเจนจากภาพเท่านั้น ห้ามเดาข้อมูลเบื้องหลัง
 * - บังคับผลลัพธ์เป็น 4-Layer Character Architecture (Identity, Metadata, Visual, Story)
 * - มีระบบ imageHash Caching ป้องกันการเรียก Vision API ซ้ำ
 */
export async function analyzeCharacterImage(
  imageOrImages: string | string[],
  options?: AnalyzeCharacterImageOptions
): Promise<CharacterImageAnalysis> {
  const imagesList = Array.isArray(imageOrImages)
    ? imageOrImages.filter(img => typeof img === 'string' && img.trim().length > 0)
    : [imageOrImages].filter(img => typeof img === 'string' && img.trim().length > 0);

  if (imagesList.length === 0) {
    throw new Error('กรุณาระบุรูปภาพ base64 สำหรับการวิเคราะห์ตัวละคร');
  }

  const primaryImage = imagesList[0];
  const token = options?.token || localStorage.getItem('sala_auth_token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const apiKey = options?.apiKey || localStorage.getItem('sala_gemini_api_key') || '';

  try {
    const res = await fetch('/api/character/analyze-image', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        image: primaryImage,
        images: imagesList,
        apiKey: apiKey || undefined,
        forceReanalyze: options?.forceReanalyze ?? false,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        const struct: CharacterStructuredFeatures = d.structured || {
          creatureType: d.creatureType || '',
          species: d.species || '',
          name: d.name || d.suggestedName || '',
          gender: d.gender || 'ไม่ระบุ',
          ageRange: d.ageRange || d.age || 'ไม่ระบุ',
          skinTone: d.skinTone || '',
          faceShape: d.faceShape || '',
          hairStyle: d.hairStyle || '',
          hairColor: d.hairColor || '',
          eyeDescription: d.eyeDescription || '',
          bodyType: d.bodyType || '',
          topClothing: d.topClothing || '',
          bottomClothing: d.bottomClothing || '',
          footwear: d.footwear || '',
          accessories: d.accessories || 'ไม่มี',
          distinctFeatures: d.distinctFeatures || '',
          confidence: typeof d.confidence === 'number' ? d.confidence : 75
        };

        const visualProfile: CharacterVisualProfile = d.visualProfile || {
          referenceImage: primaryImage,
          referenceImages: imagesList,
          imageAnalysisStatus: 'analyzed',
          hair: [struct.hairStyle, struct.hairColor].filter(Boolean).join(' ') || d.hair || 'ตามภาพอ้างอิง',
          visibleOutfit: [struct.topClothing, struct.bottomClothing].filter(Boolean).join(', ') || d.outfitDescription || 'ตามภาพอ้างอิง',
          shoes: struct.footwear || d.shoes || 'ไม่เห็นชัดในภาพ',
          visibleAccessories: struct.accessories || d.accessories || 'ไม่มี',
          visiblePhysicalAppearance: [struct.skinTone, struct.faceShape, struct.eyeDescription, struct.bodyType].filter(Boolean).join(', ') || d.description || 'ตามภาพอ้างอิง',
          visibleDistinguishingDetails: struct.distinctFeatures || d.distinctFeatures || 'ไม่มี',
          detectedViews: d.detectedViews || (imagesList.length > 1 ? ['multi_images'] : ['front']),
          isMultiViewSheet: !!d.isMultiViewSheet,
          confidence: typeof d.confidence === 'number' ? d.confidence : (struct.confidence || 75),
          generatedVisualPrompt: d.generatedVisualPrompt || ''
        };

        return {
          creatureType: d.creatureType || struct.creatureType || '',
          species: d.species || struct.species || '',
          name: struct.name || d.suggestedName || '',
          gender: struct.gender || d.gender || 'ไม่ระบุ',
          ageRange: struct.ageRange || d.age || 'ไม่ระบุ',
          age: struct.ageRange || d.age || 'ไม่ระบุ',
          skinTone: struct.skinTone || '',
          faceShape: struct.faceShape || '',
          hairStyle: struct.hairStyle || '',
          hairColor: struct.hairColor || '',
          eyeDescription: struct.eyeDescription || '',
          bodyType: struct.bodyType || '',
          topClothing: struct.topClothing || '',
          bottomClothing: struct.bottomClothing || '',
          footwear: struct.footwear || '',
          accessories: struct.accessories || d.accessories || 'ไม่มี',
          distinctFeatures: struct.distinctFeatures || '',
          confidence: typeof d.confidence === 'number' ? d.confidence : (struct.confidence || 75),
          description: d.description || '',
          outfitDescription: d.outfitDescription || '',
          suggestedName: d.suggestedName || struct.name || '',
          fullSummary: d.fullSummary || `${d.description} ${d.outfitDescription}`.trim(),
          structured: struct,
          characterIdentity: d.characterIdentity,
          referenceMetadata: d.referenceMetadata,
          visualProfile,
          storyProfile: d.storyProfile,
          fieldSources: d.fieldSources,
          imageHash: d.imageHash || d.referenceMetadata?.imageHash || '',
          detectedName: d.detectedName,
          detectedAge: d.detectedAge,
          detectedHeight: d.detectedHeight,
          availableViews: d.availableViews || visualProfile.detectedViews,
          detectedViews: visualProfile.detectedViews,
          isMultiViewSheet: visualProfile.isMultiViewSheet,
          generatedVisualPrompt: visualProfile.generatedVisualPrompt,
          cached: json.cached ?? false,
          source: json.source || 'gemini-flash',
        };
      } else {
        throw new Error(json.message || 'ไม่สามารถวิเคราะห์ภาพอ้างอิงได้');
      }
    } else {
      let errDetail = 'ไม่สามารถวิเคราะห์ภาพอ้างอิงได้';
      try {
        const errJson = await res.json();
        if (errJson.message) errDetail = errJson.message;
      } catch {}
      throw new Error(errDetail);
    }
  } catch (netErr: any) {
    if (netErr?.message && netErr.message.includes('ไม่สามารถวิเคราะห์ภาพอ้างอิงได้')) {
      throw netErr;
    }
    throw new Error(`ไม่สามารถวิเคราะห์ภาพอ้างอิงได้: ${netErr?.message || 'การเชื่อมต่อเซิร์ฟเวอร์ขัดข้อง'}`);
  }

  throw new Error('ไม่สามารถวิเคราะห์ภาพอ้างอิงได้: ไม่ได้รับข้อมูลการวิเคราะห์ภาพ');
}

export const scriptSplitter = {
  split: splitScript,
  analyzeCharacterImage,
};

export default splitScript;
