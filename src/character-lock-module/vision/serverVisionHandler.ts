/**
 * Character Lock Module - Server Vision Handler
 * Implements Gemini 2.5 Flash / Flash Multimodal Character Sheet Analyzer with SHA-256 Caching
 */

import crypto from 'crypto';
import {
  CharacterIdentity,
  CharacterReferenceMetadata,
  CharacterVisualProfile,
  CharacterStoryProfile,
  CharacterStructuredFeatures,
  FieldSource
} from '../types';

export interface VisionServerOptions {
  aiClient?: any;
  persistReferenceImage?: (dataUrl: string, customId?: string) => { referenceImageId: string; referenceImageUrl: string; imageHash: string };
}

// In-memory cache for vision analysis results to avoid repeated API charges
export const visionAnalysisCache = new Map<string, { timestamp: number; data: any }>();

export function parseImageData(dataUriOrBase64: string): { mimeType: string; base64Data: string } | null {
  if (!dataUriOrBase64 || typeof dataUriOrBase64 !== 'string') return null;
  const match = dataUriOrBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], base64Data: match[2] };
  }
  return { mimeType: 'image/jpeg', base64Data: dataUriOrBase64.replace(/\s/g, '') };
}

/**
 * Executes server-side character image analysis
 */
export async function handleCharacterAnalysisRequest(
  body: {
    image?: string;
    images?: string[];
    forceReanalyze?: boolean;
  },
  aiClient: any,
  options?: VisionServerOptions
) {
  const { image, images, forceReanalyze } = body || {};

  const rawImagesList: string[] = Array.isArray(images)
    ? images.filter(img => typeof img === 'string' && img.trim().length > 0)
    : (image && typeof image === 'string' && image.trim().length > 0 ? [image] : []);

  if (rawImagesList.length === 0) {
    throw new Error('กรุณาส่งรูปภาพ base64 เพื่อให้ AI วิเคราะห์ (Image base64 is required)');
  }

  const parsedImages = rawImagesList
    .map(img => parseImageData(img))
    .filter((p): p is { mimeType: string; base64Data: string } => p !== null && p.base64Data.length > 0)
    .slice(0, 4);

  if (parsedImages.length === 0) {
    throw new Error('ข้อมูลรูปภาพไม่ถูกต้อง ไม่สามารถถอดรหัส base64 ได้');
  }

  const primaryParsed = parsedImages[0];
  const supportingParsed = parsedImages.slice(1);
  const primaryImageHash = crypto.createHash('sha256').update(primaryParsed.base64Data).digest('hex');

  // Cache hit
  if (!forceReanalyze && visionAnalysisCache.has(primaryImageHash)) {
    const cached = visionAnalysisCache.get(primaryImageHash)!;
    return {
      success: true,
      source: 'cache',
      cached: true,
      data: cached.data
    };
  }

  if (!aiClient) {
    throw new Error('Gemini AI Client is not initialized');
  }

  const systemInstruction = `คุณเป็น AI ผู้เชี่ยวชาญวิเคราะห์ภาพตัวละครและ Reference Sheet สำหรับงานภาพยนตร์และสตูดิโอแอนิเมชัน (Concept Art & Character Consistency Analyzer)
หน้าที่ของคุณคือ: วิเคราะห์ภาพตัวละครจากรูปอ้างอิงจริง โดยยึดหลักข้อเท็จจริงทางสายตา (Visual Ground Truth) ห้ามเดา ห้ามคิดแทน และห้ามแต่งเติม

*** ลำดับขั้นตอนและกฎเหล็กบังคับเข้มงวดสูงสุด (STRICT PROTOCOL) ***:
1. [SOURCE OF TRUTH ลำดับที่ 1: REFERENCE_TEXT (ข้อความในภาพ/Reference Sheet OCR)]
   - ตรวจหาข้อความ ตัวอักษร หรือป้ายกำกับทั้งหมดที่พิมพ์หรือเขียนอยู่ในภาพ:
     * "detectedName": ชื่อตัวละครที่ปรากฏชัดเจน เช่น "แพร / Prae"
     * "detectedAge": ตัวเลขอายุที่ปรากฏชัดเจน เช่น "30" หรือ "30 ปี" (ห้ามแปลงเป็นช่วง 25-30)
     * "detectedHeight": ส่วนสูงที่เขียนในภาพ เช่น "182 cm"
   - หากไม่พบ ให้เว้นว่างเป็น "" ห้ามแต่งเติมขึ้นมาเอง

2. [REFERENCE SHEET ต้องรู้ว่าเป็นคนเดียว (SINGLE CHARACTER)]
   - ถ้ารูปมีหลายมุมมอง (FRONT, SIDE, BACK, CLOSE-UP) ให้ถือว่าเป็นตัวละครคนเดียวกัน
   - บันทึกมุมมองลงใน "availableViews" เลือกเฉพาะที่มีจริงจาก:
     ["FRONT", "FACE_CLOSEUP", "THREE_QUARTER", "SIDE", "BACK", "FULL_BODY", "OUTFIT_DETAIL", "ACCESSORY_DETAIL", "SHOE_DETAIL"]

3. [SOURCE OF TRUTH ลำดับที่ 2: VISUAL_OBSERVATION]
   - "creatureType", "species", "hairStyle", "hairColor", "topClothing", "bottomClothing", "footwear", "accessories", "distinctFeatures"

4. [สิ่งที่ห้ามเดา]: อาชีพ, นิสัย, ฐานะ, ความสัมพันธ์, ประวัติชีวิต, ศาสนา

5. [โครงสร้าง JSON ที่ต้องส่งกลับ]:
{
  "detectedName": string,
  "detectedAge": string,
  "detectedHeight": string,
  "availableViews": string[],
  "creatureType": string,
  "species": string,
  "gender": string,
  "ageRange": string,
  "skinTone": string,
  "faceShape": string,
  "hairStyle": string,
  "hairColor": string,
  "eyeDescription": string,
  "bodyType": string,
  "topClothing": string,
  "bottomClothing": string,
  "footwear": string,
  "accessories": string,
  "distinctFeatures": string,
  "confidence": number
}`;

  const parts: any[] = [];
  parts.push({
    text: `[รูปภาพที่ 1: รูปอ้างอิงหลัก (Primary Reference)] โปรดอ่าน OCR ทั้งหมดและวิเคราะห์รูปลักษณ์จริง`
  });
  parts.push({
    inlineData: {
      data: primaryParsed.base64Data,
      mimeType: primaryParsed.mimeType
    }
  });

  supportingParsed.forEach((sup, idx) => {
    parts.push({
      text: `[รูปภาพที่ ${idx + 2}: รูปเสริม]`
    });
    parts.push({
      inlineData: {
        data: sup.base64Data,
        mimeType: sup.mimeType
      }
    });
  });

  parts.push({
    text: `คำสั่งวิเคราะห์ภาพตัวละครอย่างเคร่งครัด: อ่าน OCR และส่งคืนเฉพาะ JSON ตามโครงสร้างที่กำหนด`
  });

  const response = await aiClient.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: { parts },
    config: {
      systemInstruction,
      responseMimeType: 'application/json'
    }
  });

  const rawText = response.text || '';
  let jsonResult: any = null;
  try {
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    jsonResult = JSON.parse(cleaned);
  } catch {
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonResult = JSON.parse(jsonMatch[0]);
  }

  if (!jsonResult) {
    throw new Error('ไม่สามารถถอดรหัสผลการวิเคราะห์จาก AI ได้');
  }

  let confidence = typeof jsonResult.confidence === 'number' ? Math.round(jsonResult.confidence) : 85;
  if (isNaN(confidence) || confidence < 0) confidence = 50;
  if (confidence > 100) confidence = 100;

  const detectedName = (jsonResult.detectedName || '').trim();
  const detectedAge = (jsonResult.detectedAge || '').trim();
  const detectedHeight = (jsonResult.detectedHeight || '').trim();
  const finalName = detectedName || (jsonResult.name || jsonResult.suggestedName || '').trim();
  const finalAge = detectedAge || (jsonResult.ageRange || jsonResult.age || 'ไม่ระบุ').trim();

  const nameSource: FieldSource = detectedName ? 'REFERENCE_TEXT' : (finalName ? 'VISUAL_OBSERVATION' : 'UNKNOWN');
  const ageSource: FieldSource = detectedAge ? 'REFERENCE_TEXT' : (jsonResult.ageRange ? 'VISUAL_OBSERVATION' : 'UNKNOWN');
  const heightSource: FieldSource = detectedHeight ? 'REFERENCE_TEXT' : 'UNKNOWN';

  const validViews = ['FRONT', 'FACE_CLOSEUP', 'THREE_QUARTER', 'SIDE', 'BACK', 'FULL_BODY', 'OUTFIT_DETAIL', 'ACCESSORY_DETAIL', 'SHOE_DETAIL'];
  let availableViews: string[] = Array.isArray(jsonResult.availableViews)
    ? jsonResult.availableViews.map((v: string) => String(v).toUpperCase().replace(/[\s-]/g, '_'))
    : ['FRONT'];
  availableViews = availableViews.filter((v: string) => validViews.includes(v) || v.length > 2);
  if (availableViews.length === 0) availableViews = ['FRONT'];

  const structured: CharacterStructuredFeatures = {
    creatureType: jsonResult.creatureType || 'human',
    species: jsonResult.species || '',
    name: finalName,
    gender: (jsonResult.gender || 'ไม่ระบุ').trim(),
    ageRange: finalAge,
    skinTone: (jsonResult.skinTone || '').trim(),
    faceShape: (jsonResult.faceShape || '').trim(),
    hairStyle: (jsonResult.hairStyle || '').trim(),
    hairColor: (jsonResult.hairColor || '').trim(),
    eyeDescription: (jsonResult.eyeDescription || '').trim(),
    bodyType: (jsonResult.bodyType || '').trim(),
    topClothing: (jsonResult.topClothing || '').trim(),
    bottomClothing: (jsonResult.bottomClothing || '').trim(),
    footwear: (jsonResult.footwear || '').trim(),
    accessories: (jsonResult.accessories || 'ไม่มี').trim(),
    distinctFeatures: (jsonResult.distinctFeatures || '').trim(),
    confidence
  };

  const primaryDataUrl = `data:${primaryParsed.mimeType};base64,${primaryParsed.base64Data}`;
  const allDataUrls = parsedImages.map(p => `data:${p.mimeType};base64,${p.base64Data}`);

  let persistentRefUrl = primaryDataUrl;
  let persistentRefId = `ref_${primaryImageHash.slice(0, 10)}_${Date.now()}`;
  if (options?.persistReferenceImage) {
    try {
      const persisted = options.persistReferenceImage(primaryDataUrl, persistentRefId);
      persistentRefUrl = persisted.referenceImageUrl;
      persistentRefId = persisted.referenceImageId;
    } catch {}
  }

  const characterIdentity: CharacterIdentity = {
    id: `char_${Date.now()}`,
    name: finalName
  };

  const referenceMetadata: CharacterReferenceMetadata = {
    referenceImageId: persistentRefId,
    referenceImageUrl: persistentRefUrl,
    imageHash: primaryImageHash,
    detectedName: detectedName || undefined,
    detectedAge: detectedAge || undefined,
    detectedHeight: detectedHeight || undefined,
    availableViews
  };

  const visualProfile: CharacterVisualProfile = {
    imageHash: primaryImageHash,
    referenceImageId: persistentRefId,
    referenceImageUrl: persistentRefUrl,
    hairStyle: structured.hairStyle || 'ตามภาพอ้างอิง',
    hairColor: structured.hairColor || '',
    top: structured.topClothing || '',
    bottom: structured.bottomClothing || '',
    shoes: structured.footwear || 'ไม่เห็นชัดในภาพ',
    accessories: structured.accessories || 'ไม่มี',
    visibleDistinctiveDetails: structured.distinctFeatures || 'ไม่มี',
    referenceImage: persistentRefUrl,
    referenceImages: persistentRefUrl ? [persistentRefUrl] : allDataUrls,
    imageAnalysisStatus: 'analyzed',
    confidence: structured.confidence || 85,
    detectedViews: availableViews,
    isMultiViewSheet: availableViews.length > 1 || allDataUrls.length > 1
  };

  const storyProfile: CharacterStoryProfile = {
    role: '',
    personality: '',
    occupation: '',
    background: '',
    storyInfo: ''
  };

  const fieldSources: Record<string, FieldSource> = {
    name: nameSource,
    age: ageSource,
    height: heightSource,
    gender: 'VISUAL_OBSERVATION',
    hairStyle: 'VISUAL_OBSERVATION',
    topClothing: 'VISUAL_OBSERVATION',
    bottomClothing: 'VISUAL_OBSERVATION'
  };

  const outputData = {
    ...structured,
    name: finalName,
    age: finalAge,
    detectedName,
    detectedAge,
    detectedHeight,
    availableViews,
    imageHash: primaryImageHash,
    referenceImageId: persistentRefId,
    referenceImageUrl: persistentRefUrl,
    structured,
    characterIdentity,
    referenceMetadata,
    visualProfile,
    storyProfile,
    fieldSources,
    confidence
  };

  // Cache deterministic result
  visionAnalysisCache.set(primaryImageHash, {
    timestamp: Date.now(),
    data: outputData
  });

  return {
    success: true,
    source: 'gemini-flash',
    cached: false,
    data: outputData
  };
}
