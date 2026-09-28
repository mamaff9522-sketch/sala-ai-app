/**
 * Character Lock Module - Client Vision Analyzer
 * Invokes multimodal vision analysis, handles caching, multi-image views, and 4-layer mapping.
 */

import {
  CharacterImageAnalysis,
  AnalyzeCharacterImageOptions,
  CharacterStructuredFeatures,
  CharacterVisualProfile
} from '../types';

/**
 * Client-side function to analyze character reference images via the backend endpoint
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
  const token = options?.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('sala_auth_token') || '' : '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const apiKey = options?.apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('sala_gemini_api_key') || '' : '');

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
          hairStyle: struct.hairStyle || d.hairStyle || 'ตามภาพอ้างอิง',
          hairColor: struct.hairColor || d.hairColor || '',
          top: struct.topClothing || '',
          bottom: struct.bottomClothing || '',
          shoes: struct.footwear || 'ไม่เห็นชัดในภาพ',
          accessories: struct.accessories || 'ไม่มี',
          visibleDistinctiveDetails: struct.distinctFeatures || 'ไม่มี',
          hair: [struct.hairStyle, struct.hairColor].filter(Boolean).join(' ') || d.hair || 'ตามภาพอ้างอิง',
          visibleOutfit: [struct.topClothing, struct.bottomClothing].filter(Boolean).join(', ') || d.outfitDescription || 'ตามภาพอ้างอิง',
          visibleAccessories: struct.accessories || d.accessories || 'ไม่มี',
          visiblePhysicalAppearance: [struct.skinTone, struct.faceShape, struct.eyeDescription, struct.bodyType].filter(Boolean).join(', ') || d.description || 'ตามภาพอ้างอิง',
          visibleDistinguishingDetails: struct.distinctFeatures || d.distinctFeatures || 'ไม่มี',
          detectedViews: d.detectedViews || (imagesList.length > 1 ? ['multi_images'] : ['FRONT']),
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
          accessories: struct.accessories || 'ไม่มี',
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
}
