import { parseSalaScript, isReservedSystemKeyword } from './salaDirectorEngine';

/**
 * Sala AI - Script Splitter Service
 * ฟังก์ชันรับบทละคร/โครงเรื่อง ส่งให้ Gemini Flash แยกตัวละคร คำพูด สถานที่ ฉาก แสง กล้อง
 * คืนค่าเป็น JSON โครงสร้างสมบูรณ์สำหรับเติมช่องต่าง ๆ ในแอปอัตโนมัติ
 */

export interface SplitCharacter {
  name: string;
  description: string;
  role?: string;
  appearance?: string;
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
}

export interface ScriptSplitOptions {
  clipCount?: number;
  token?: string;
}

/**
 * ฟังก์ชันรับบทละคร เรียก Gemini Flash ผ่าน API backend และคืนค่า JSON
 * แยกตัวละคร, คำพูด, สถานที่, ฉาก, แสง, กล้อง
 */
export async function splitScript(
  scriptText: string,
  options?: ScriptSplitOptions
): Promise<ScriptSplitResult> {
  if (!scriptText || !scriptText.trim()) {
    throw new Error('กรุณากรอกบทละครหรือเนื้อเรื่องก่อนให้ AI ทำการแยกบท');
  }

  const token = options?.token || localStorage.getItem('sala_auth_token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch('/api/script/split', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        scriptText: scriptText.trim(),
        clipCount: options?.clipCount,
      }),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        return {
          ...json.data,
          source: json.source || 'gemini-flash',
        };
      }
    }
  } catch (netErr) {
    console.warn('Backend /api/script/split unreachable, using client-side fallback parser:', netErr);
  }

  // Client-side fallback if server fails or network is offline
  return parseScriptClientFallback(scriptText, options?.clipCount);
}

/**
 * Fallback Parser ในฝั่ง Client กรณีออฟไลน์หรือเซิร์ฟเวอร์ขัดข้อง
 * ใช้ Sala Protocol & Reserved System Keyword Engine ที่เข้มงวด
 */
function parseScriptClientFallback(
  scriptText: string,
  requestedClipCount?: number
): ScriptSplitResult {
  const parsed = parseSalaScript(scriptText, {
    defaultClipCount: requestedClipCount
  });

  const rawClips = parsed.clips;
  const declaredChars = parsed.metadata.declaredCharacters;

  // Build character list exclusively from declared characters or actual parsed speakers
  const characterNames = parsed.detectedCharacters.filter(name => !isReservedSystemKeyword(name));
  const characters: SplitCharacter[] = characterNames.length > 0
    ? characterNames.map((name, idx) => {
        const found = declaredChars.find(c => c.name.toLowerCase() === name.toLowerCase());
        return {
          name,
          description: found?.description || `ตัวละคร ${name} ในเนื้อเรื่อง`,
          role: idx === 0 ? 'ตัวละครนำ' : 'ตัวละครร่วม',
          appearance: 'รูปลักษณ์ชัดเจน สอดคล้องตลอดเรื่อง'
        };
      })
    : declaredChars.length > 0
    ? declaredChars.map((c, idx) => ({
        name: c.name,
        description: c.description || `ตัวละคร ${c.name}`,
        role: idx === 0 ? 'ตัวละครนำ' : 'ตัวละครร่วม',
        appearance: 'รูปลักษณ์ชัดเจน สอดคล้องตลอดเรื่อง'
      }))
    : [];

  // Extract dialogues, rigorously filtering out any reserved system keywords
  const dialogues: SplitDialogue[] = [];
  let diagCount = 1;
  rawClips.forEach(c => {
    c.dialogues.forEach(d => {
      if (d.speaker && !isReservedSystemKeyword(d.speaker)) {
        dialogues.push({
          id: `diag_client_${diagCount++}`,
          speaker: d.speaker,
          line: d.line,
          emotionTone: d.emotionTone || 'ตามอารมณ์ในบท',
          sceneNumber: c.clipNumber
        });
      }
    });
  });

  // Extract clean location & lighting from metadata if specified, or general scene context
  const lockMeta = parsed.metadata.lockDirectives;
  const detectedLocation = parsed.metadata.location || lockMeta['location'] || '';
  const detectedTime = parsed.metadata.timeOfDay || lockMeta['time'] || '';
  const detectedLighting = parsed.metadata.lighting || lockMeta['lighting'] || '';
  const detectedStyle = parsed.metadata.style || lockMeta['style'] || 'Cinematic Photorealistic 8K';
  const detectedProps = parsed.metadata.props || lockMeta['props'] || '';
  const detectedTitle = parsed.metadata.title || rawClips[0]?.title || 'บทละคร';

  const introducedInClips = new Set<string>();

  const scenes: SplitScene[] = rawClips.map((c) => {
    const sceneBody = c.actions.join(' ');
    const sceneDialogues = dialogues.filter((d) => d.sceneNumber === c.clipNumber);
    const diagSummary = sceneDialogues.map((d) => `${d.speaker}: "${d.line}"`).join(' ');
    const sceneFullText = `${c.title} ${sceneBody} ${diagSummary}`;

    const sceneCharNames = characters
      .filter((char) => {
        const firstName = char.name.split(' ')[0];
        return sceneFullText.includes(char.name) ||
          (firstName.length >= 2 && sceneFullText.includes(firstName)) ||
          sceneDialogues.some(d => d.speaker === char.name || d.line.includes(char.name));
      })
      .map((char) => char.name);

    sceneCharNames.forEach(name => introducedInClips.add(name));

    // Characters active in this clip: only those introduced up to this scene!
    const charList = sceneCharNames.length > 0
      ? sceneCharNames
      : Array.from(introducedInClips);

    const promptParts = [detectedStyle];
    if (charList.length > 0) promptParts.push(`Character Lock: ${charList.join(', ')}`);
    if (detectedLocation) promptParts.push(`at ${detectedLocation}`);
    if (detectedTime) promptParts.push(`${detectedTime} atmospheric lighting`);
    if (sceneBody) promptParts.push(`Scene Action: ${sceneBody}`);
    if (diagSummary) promptParts.push(`Dialogue: ${diagSummary}`);
    if (c.endState) promptParts.push(`Ending momentum: ${c.endState}`);

    return {
      sceneNumber: c.clipNumber,
      title: c.title || `ฉากที่ ${c.clipNumber}`,
      location: detectedLocation,
      timeOfDay: detectedTime,
      lighting: detectedLighting,
      camera: c.cameraDirectives[0] || 'Cinematic tracking shot, 35mm prime, Medium Shot',
      characters: charList,
      action: sceneBody || `เหตุการณ์ในฉากที่ ${c.clipNumber}`,
      dialogue: diagSummary,
      prompt: promptParts.join(', ')
    };
  });

  const mainChar = characters[0]?.name || '';

  return {
    title: detectedTitle,
    characters,
    dialogues,
    locations: detectedLocation ? [{ name: detectedLocation, description: 'สถานที่หลักของการถ่ายทำ', atmosphere: detectedTime }] : [],
    scenes,
    lighting: detectedLighting,
    camera: {
      movement: 'Cinematic tracking shot smoothly gliding alongside character',
      lensType: '35mm Anamorphic Prime f/1.8',
      shotType: 'Medium Shot',
    },
    continuityLock: {
      characterName: mainChar,
      characterAppearance: characters[0]?.description || characters[0]?.appearance || '',
      location: detectedLocation,
      timeOfDay: detectedTime,
      lighting: detectedLighting,
      visualStyle: detectedStyle,
      cameraMovement: 'Cinematic tracking shot smoothly gliding alongside character',
      cameraShotType: 'Medium Shot',
      lensType: '35mm Anamorphic Prime f/1.8',
      props: detectedProps,
    },
    source: 'fallback-parser',
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
  parseLocal: parseScriptClientFallback,
  analyzeCharacterImage,
};

export default splitScript;
