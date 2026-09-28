import React, { useState, useRef, useEffect } from 'react';
import {
  UserCheck,
  Plus,
  Trash2,
  Sparkles,
  UploadCloud,
  X,
  Copy,
  Check,
  Sliders,
  Camera,
  Layers,
  Info,
  Loader2,
  CheckCircle2,
  Cloud,
  Database,
  RefreshCw,
  ArrowUpCircle,
  HardDrive,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Edit3,
  ChevronDown,
  ChevronUp,
  FileText,
  Hash,
  Lock,
  Unlock,
  Zap,
  Eye
} from 'lucide-react';
import {
  Character,
  CharacterStructuredFeatures,
  CharacterIdentity,
  CharacterReferenceMetadata,
  CharacterVisualProfile,
  CharacterStoryProfile,
  CharacterAnalysisStatus,
  CharacterLockStatus,
  FieldSource
} from '../types';
import { api } from '../services/api';
import { analyzeCharacterImage } from '../services/scriptSplitter';
import { computeImageHash } from '../utils/imageHash';
import {
  checkAndSyncCharacters,
  forceMigrateLocalStorageToFirestore,
  getLocalStorageCharacters,
  saveCharacterToFirestore,
  getActiveUid
} from '../services/characterService';

interface CharacterLibraryProps {
  characters: Character[];
  onRefreshCharacters: (savedChar?: Character) => void | Promise<any>;
  onUseCharacterInStudio: (characterId: string) => void;
  isOpenModal: boolean;
  onCloseModal: () => void;
  onOpenModal: () => void;
}

export const CharacterLibrary: React.FC<CharacterLibraryProps> = ({
  characters,
  onRefreshCharacters,
  onUseCharacterInStudio,
  isOpenModal,
  onCloseModal,
  onOpenModal,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delete Confirmation Dialog State
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Firestore & LocalStorage Sync State
  const [isCheckingSync, setIsCheckingSync] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [syncAuditInfo, setSyncAuditInfo] = useState<{
    message: string;
    type: 'success' | 'info' | 'warning';
    firestoreCount: number;
    localCount: number;
  } | null>(null);

  // ตรวจสอบ Firestore และ LocalStorage ตาม UID ของผู้ใช้ปัจจุบัน
  const handleCheckFirestoreAndSync = async () => {
    const currentUid = getActiveUid();
    if (!currentUid) {
      return;
    }
    setIsCheckingSync(true);
    try {
      const result = await checkAndSyncCharacters(currentUid);
      setSyncAuditInfo({
        message: result.message,
        type: result.firestoreCount > 0 ? 'success' : (result.migratedCount > 0 ? 'success' : 'info'),
        firestoreCount: result.firestoreCount,
        localCount: result.localStorageCount
      });
      onRefreshCharacters();
    } catch (err: any) {
      setSyncAuditInfo({
        message: `เกิดข้อผิดพลาดในการตรวจสอบ Firestore: ${err?.message || 'โปรดตรวจสอบการเชื่อมต่อ'}`,
        type: 'warning',
        firestoreCount: 0,
        localCount: getLocalStorageCharacters(currentUid).length
      });
    } finally {
      setIsCheckingSync(false);
    }
  };

  // บังคับย้ายตัวละครจาก LocalStorage ขึ้น Firestore สำหรับ UID ปัจจุบัน
  const handleMigrateToFirestore = async () => {
    const currentUid = getActiveUid();
    if (!currentUid) return;
    setIsMigrating(true);
    try {
      const result = await forceMigrateLocalStorageToFirestore(currentUid);
      setSyncAuditInfo({
        message: result.message,
        type: 'success',
        firestoreCount: result.characters.length,
        localCount: getLocalStorageCharacters(currentUid).length
      });
      onRefreshCharacters();
    } catch (err: any) {
      setSyncAuditInfo({
        message: `ย้ายข้อมูลไม่สำเร็จ: ${err?.message || 'เกิดข้อผิดพลาด'}`,
        type: 'warning',
        firestoreCount: 0,
        localCount: getLocalStorageCharacters(currentUid).length
      });
    } finally {
      setIsMigrating(false);
    }
  };

  // ตรวจสอบสถานะ Firestore เมื่อเปิดหน้าคลังตัวละคร
  useEffect(() => {
    handleCheckFirestoreAndSync();
  }, []);

  // New Character Form State
  // New Character Form State
  const [name, setName] = useState('');
  const [gender, setGender] = useState('หญิง');
  const [age, setAge] = useState('24 ปี');
  const [description, setDescription] = useState('');
  const [outfitDescription, setOutfitDescription] = useState('');
  const [triggerTag, setTriggerTag] = useState('');
  const [consistencyStrength, setConsistencyStrength] = useState(0.85);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [analysisSuccessMsg, setAnalysisSuccessMsg] = useState<string | null>(null);

  // Story Profile state (Layer C: narrative and story context - strictly separated from visual profile)
  const [personality, setPersonality] = useState('');
  const [role, setRole] = useState('');
  const [occupation, setOccupation] = useState('');
  const [background, setBackground] = useState('');

  // 4-Layer Architecture & Image Hash Caching State
  const [currentReferenceImageHash, setCurrentReferenceImageHash] = useState<string>('');
  const [visualProfileImageHash, setVisualProfileImageHash] = useState<string>('');
  const [analysisStatus, setAnalysisStatus] = useState<CharacterAnalysisStatus>('NOT_ANALYZED');
  const [fieldSources, setFieldSources] = useState<Record<string, FieldSource>>({});
  const [referenceMetadata, setReferenceMetadata] = useState<CharacterReferenceMetadata | null>(null);
  const [isCacheHit, setIsCacheHit] = useState<boolean>(false);
  const [referenceImageId, setReferenceImageId] = useState<string>('');
  const [referenceImageUrl, setReferenceImageUrl] = useState<string>('');

  // Character Detail / Inspection Modal State
  const [inspectedCharacter, setInspectedCharacter] = useState<Character | null>(null);

  // Requirement 3: Draft vs Confirmed State Management
  const [draftAnalysis, setDraftAnalysis] = useState<any | null>(null);
  const [isDraftActive, setIsDraftActive] = useState(false);
  const [isConfirmedByUser, setIsConfirmedByUser] = useState(false);
  const [userEditedFields, setUserEditedFields] = useState<Record<string, boolean>>({});
  const [showStructuredDetails, setShowStructuredDetails] = useState(false);

  // Structured visual attributes state (editable by user)
  const [structuredFeatures, setStructuredFeatures] = useState<CharacterStructuredFeatures>({
    name: '',
    gender: 'หญิง',
    ageRange: '24 ปี',
    skinTone: '',
    faceShape: '',
    hairStyle: '',
    hairColor: '',
    eyeDescription: '',
    bodyType: '',
    topClothing: '',
    bottomClothing: '',
    footwear: '',
    accessories: 'ไม่มี',
    distinctFeatures: '',
    confidence: 80
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetFormState = () => {
    setName('');
    setGender('หญิง');
    setAge('24 ปี');
    setDescription('');
    setOutfitDescription('');
    setTriggerTag('');
    setConsistencyStrength(0.85);
    setReferenceImages([]);
    setPersonality('');
    setRole('');
    setOccupation('');
    setBackground('');
    setCurrentReferenceImageHash('');
    setVisualProfileImageHash('');
    setReferenceImageId('');
    setReferenceImageUrl('');
    setAnalysisStatus('NOT_ANALYZED');
    setFieldSources({});
    setReferenceMetadata(null);
    setIsCacheHit(false);
    setDraftAnalysis(null);
    setIsDraftActive(false);
    setIsConfirmedByUser(false);
    setUserEditedFields({});
    setShowStructuredDetails(false);
    setErrorMsg(null);
    setAnalysisSuccessMsg(null);
    setStructuredFeatures({
      creatureType: 'human',
      species: '',
      name: '',
      gender: 'หญิง',
      ageRange: '24 ปี',
      skinTone: '',
      faceShape: '',
      hairStyle: '',
      hairColor: '',
      eyeDescription: '',
      bodyType: '',
      topClothing: '',
      bottomClothing: '',
      footwear: '',
      accessories: 'ไม่มี',
      distinctFeatures: '',
      confidence: 80
    });
  };

  // Helper to mark field as manually edited by user (preventing AI from overwriting - Priority 1: USER_CONFIRMED)
  const markFieldEdited = (fieldName: string) => {
    setUserEditedFields(prev => ({ ...prev, [fieldName]: true }));
    setFieldSources(prev => ({ ...prev, [fieldName]: 'USER_CONFIRMED' }));
    setIsConfirmedByUser(false);
    if (analysisStatus === 'USER_CONFIRMED' || analysisStatus === 'LOCKED') {
      setAnalysisStatus('AI_DRAFT');
    }
  };

  // Auto-generate trigger tag when name changes if user hasn't typed custom
  const handleNameChange = (val: string) => {
    setName(val);
    markFieldEdited('name');
    const slug = val.trim().replace(/\s+/g, '_').toLowerCase();
    if (slug) {
      setTriggerTag(`(${slug}_consistent_char:1.2)`);
    }
  };

  const handleGenderChange = (val: string) => {
    setGender(val);
    markFieldEdited('gender');
  };

  const handleAgeChange = (val: string) => {
    setAge(val);
    markFieldEdited('age');
  };

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    markFieldEdited('description');
  };

  const handleOutfitChange = (val: string) => {
    setOutfitDescription(val);
    markFieldEdited('outfitDescription');
  };

  const handleStructuredChange = (key: keyof CharacterStructuredFeatures, val: string) => {
    setStructuredFeatures(prev => ({ ...prev, [key]: val }));
    markFieldEdited(`struct_${key}`);
  };

  // Execute Character Image Analysis (Gemini Flash Multimodal) with Image Hash Caching & Source Priority
  const runImageAnalysis = async (imagesToAnalyze: string[], forceReanalyze: boolean = false, precomputedHash?: string) => {
    if (!imagesToAnalyze || imagesToAnalyze.length === 0) {
      setErrorMsg('กรุณาอัปโหลดรูปภาพอ้างอิงอย่างน้อย 1 รูปก่อนวิเคราะห์');
      return;
    }

    const primaryImage = imagesToAnalyze[0];
    let targetHash = precomputedHash;
    if (!targetHash) {
      try {
        targetHash = await computeImageHash(primaryImage);
      } catch {
        targetHash = '';
      }
    }
    if (targetHash) {
      setCurrentReferenceImageHash(targetHash);
    }

    // Caching check: if not forcing re-analysis, and imageHash matches existing visualProfileImageHash with draftAnalysis
    if (!forceReanalyze && targetHash && targetHash === visualProfileImageHash && draftAnalysis) {
      setIsCacheHit(true);
      setAnalysisStatus('AI_DRAFT');
      setAnalysisSuccessMsg('⚡ ใช้ผลวิเคราะห์เดิมจากแคช (imageHash ตรงกัน ไม่ต้องเรียก Gemini Vision ซ้ำ)');
      return;
    }

    setIsAnalyzingImage(true);
    setAnalysisStatus('ANALYZING');
    setIsCacheHit(false);
    setAnalysisSuccessMsg(null);
    setErrorMsg(null);

    try {
      // Pass full list of images; image 0 is primary, rest are supporting
      const analysis = await analyzeCharacterImage(imagesToAnalyze, { forceReanalyze });
      
      const resultingHash = analysis.imageHash || targetHash || '';
      setVisualProfileImageHash(resultingHash);
      if (targetHash) setCurrentReferenceImageHash(targetHash);
      setIsCacheHit(Boolean(analysis.cached));

      // Layer 2: Reference Metadata
      const refMeta: CharacterReferenceMetadata = analysis.referenceMetadata || {
        referenceImageId: `ref_${Date.now()}`,
        imageHash: resultingHash,
        detectedName: analysis.detectedName,
        detectedAge: analysis.detectedAge,
        detectedHeight: analysis.detectedHeight,
        availableViews: analysis.availableViews || (imagesToAnalyze.length > 1 ? ['MULTI_VIEWS'] : ['FRONT'])
      };
      setReferenceMetadata(refMeta);

      // Merge Field Sources (Strict Priority: never overwrite USER_CONFIRMED fields)
      const incomingSources = analysis.fieldSources || {};
      setFieldSources(prev => {
        const merged: Record<string, FieldSource> = { ...incomingSources };
        for (const k of Object.keys(prev)) {
          if (prev[k] === 'USER_CONFIRMED') {
            merged[k] = 'USER_CONFIRMED';
          }
        }
        return merged;
      });

      setDraftAnalysis(analysis);
      setIsDraftActive(true);
      setAnalysisStatus('AI_DRAFT');
      setIsConfirmedByUser(false);

      if (analysis.referenceImageUrl) {
        setReferenceImageUrl(analysis.referenceImageUrl);
        const refUrl = analysis.referenceImageUrl;
        setReferenceImages(prev => [refUrl, ...prev.slice(1)]);
      }
      if (analysis.referenceImageId) {
        setReferenceImageId(analysis.referenceImageId);
      }

      const struct: CharacterStructuredFeatures = analysis.structured || {
        creatureType: analysis.creatureType || '',
        species: analysis.species || '',
        name: analysis.detectedName || analysis.name || analysis.suggestedName || '',
        gender: analysis.gender || 'ไม่ระบุ',
        ageRange: analysis.detectedAge ? `${analysis.detectedAge} ปี` : (analysis.ageRange || analysis.age || 'ไม่ระบุ'),
        skinTone: analysis.skinTone || '',
        faceShape: analysis.faceShape || '',
        hairStyle: analysis.hairStyle || '',
        hairColor: analysis.hairColor || '',
        eyeDescription: analysis.eyeDescription || '',
        bodyType: analysis.bodyType || '',
        topClothing: analysis.topClothing || '',
        bottomClothing: analysis.bottomClothing || '',
        footwear: analysis.footwear || '',
        accessories: analysis.accessories || 'ไม่มี',
        distinctFeatures: analysis.distinctFeatures || '',
        confidence: analysis.confidence || 75
      };

      setStructuredFeatures(prev => {
        const updated = { ...struct };
        if (fieldSources['struct_topClothing'] === 'USER_CONFIRMED') updated.topClothing = prev.topClothing;
        if (fieldSources['struct_bottomClothing'] === 'USER_CONFIRMED') updated.bottomClothing = prev.bottomClothing;
        if (fieldSources['struct_hairStyle'] === 'USER_CONFIRMED') updated.hairStyle = prev.hairStyle;
        if (fieldSources['struct_hairColor'] === 'USER_CONFIRMED') updated.hairColor = prev.hairColor;
        return updated;
      });

      // Priority 1: USER_CONFIRMED (never overwrite)
      // Priority 2: REFERENCE_TEXT (from OCR detectedName, detectedAge, detectedHeight)
      // Priority 3: VISUAL_OBSERVATION (visual analysis)
      if (!userEditedFields['name'] && fieldSources['name'] !== 'USER_CONFIRMED') {
        const charName = analysis.detectedName || analysis.suggestedName || analysis.name;
        if (charName) {
          setName(charName);
          const slug = charName.trim().replace(/\s+/g, '_').toLowerCase();
          if (slug) {
            setTriggerTag(`(${slug}_consistent_char:1.2)`);
          }
        }
      }

      if (!userEditedFields['age'] && fieldSources['age'] !== 'USER_CONFIRMED') {
        if (analysis.detectedAge) {
          setAge(`${analysis.detectedAge} ปี`);
        } else if (analysis.ageRange && analysis.ageRange !== 'ไม่แน่ใจ' && analysis.ageRange !== 'ไม่ระบุ') {
          setAge(analysis.ageRange);
        }
      }

      if (!userEditedFields['gender'] && fieldSources['gender'] !== 'USER_CONFIRMED') {
        if (analysis.gender && analysis.gender !== 'ไม่แน่ใจ') {
          setGender(analysis.gender);
        }
      }

      if (!userEditedFields['description'] && fieldSources['description'] !== 'USER_CONFIRMED' && analysis.description) {
        setDescription(analysis.description);
      }

      if (!userEditedFields['outfitDescription'] && fieldSources['outfitDescription'] !== 'USER_CONFIRMED' && analysis.outfitDescription) {
        setOutfitDescription(analysis.outfitDescription);
      }

      if (analysis.cached) {
        setAnalysisSuccessMsg(`⚡ พบข้อมูลในแคช (imageHash: ${resultingHash.slice(0, 8)}) ไม่ต้องเรียก Gemini Vision ซ้ำ`);
      } else if (analysis.confidence < 70) {
        setAnalysisSuccessMsg(`⚠️ ภาพอาจเห็นรายละเอียดไม่ชัดเจน (ความมั่นใจ ${analysis.confidence}%) โปรดตรวจสอบหรือแก้ไขข้อมูลก่อนยืนยัน`);
      } else {
        setAnalysisSuccessMsg(`✨ Gemini Flash วิเคราะห์ภาพสำเร็จ (ความมั่นใจ ${analysis.confidence}%) จัดเก็บเป็นแบบร่างแล้ว`);
      }
    } catch (err: any) {
      console.warn('Image analysis error:', err);
      setAnalysisStatus('FAILED');
      setErrorMsg(err?.message || 'ไม่สามารถวิเคราะห์รูปภาพได้');
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // Button Action: "ใช้เป็นแบบร่าง (Use as Draft)"
  const handleApplyAsDraft = () => {
    if (!draftAnalysis) return;
    if (draftAnalysis.description) setDescription(draftAnalysis.description);
    if (draftAnalysis.outfitDescription) setOutfitDescription(draftAnalysis.outfitDescription);
    if (draftAnalysis.gender && draftAnalysis.gender !== 'ไม่แน่ใจ') setGender(draftAnalysis.gender);
    if (draftAnalysis.detectedAge) {
      setAge(`${draftAnalysis.detectedAge} ปี`);
    } else if (draftAnalysis.ageRange && draftAnalysis.ageRange !== 'ไม่แน่ใจ') {
      setAge(draftAnalysis.ageRange);
    }
    const detectedOrSuggested = draftAnalysis.detectedName || draftAnalysis.suggestedName || draftAnalysis.name;
    if (detectedOrSuggested && !name.trim()) {
      setName(detectedOrSuggested);
      const slug = detectedOrSuggested.trim().replace(/\s+/g, '_').toLowerCase();
      if (slug) setTriggerTag(`(${slug}_consistent_char:1.2)`);
    }
    if (draftAnalysis.structured) {
      setStructuredFeatures(draftAnalysis.structured);
    }
    setIsDraftActive(true);
    setIsConfirmedByUser(false);
    setAnalysisStatus('AI_DRAFT');
    setAnalysisSuccessMsg('📋 ดึงข้อมูลจากผลวิเคราะห์มาเป็นแบบร่างเรียบร้อยแล้ว ตรวจสอบและกด "ยืนยันข้อมูล"');
  };

  // Button Action: "รีเซ็ตค่า (Reset)"
  const handleResetDraftAndForm = () => {
    resetFormState();
  };

  // Button Action: "ยืนยันข้อมูลตัวละคร (Confirm Character Data)"
  const handleConfirmCharacterData = () => {
    if (!name.trim()) {
      setErrorMsg('กรุณาระบุชื่อตัวละครก่อนยืนยัน');
      return;
    }
    setIsConfirmedByUser(true);
    setAnalysisStatus('USER_CONFIRMED');
    setFieldSources(prev => {
      const updated = { ...prev };
      ['name', 'gender', 'age', 'description', 'outfitDescription'].forEach(f => {
        updated[f] = 'USER_CONFIRMED';
      });
      return updated;
    });
    setErrorMsg(null);
    setAnalysisSuccessMsg('✅ ยืนยันข้อมูลตัวละครเรียบร้อยแล้ว (Confirmed) ข้อมูลพร้อมสำหรับบันทึกและล็อกอัตลักษณ์');
  };

  // Helper to detect real image MIME type from binary magic bytes / base64 signatures
  const detectImageMimeType = (dataUrlOrBase64: string): string => {
    const commaIdx = dataUrlOrBase64.indexOf(',');
    const rawBase64 = commaIdx !== -1 ? dataUrlOrBase64.slice(commaIdx + 1).trim() : dataUrlOrBase64.trim();
    if (rawBase64.startsWith('/9j/')) return 'image/jpeg';
    if (rawBase64.startsWith('iVBORw0KGgo')) return 'image/png';
    if (rawBase64.startsWith('R0lGOD')) return 'image/gif';
    if (rawBase64.startsWith('UklGR')) return 'image/webp';
    if (rawBase64.startsWith('Qk')) return 'image/bmp';

    try {
      const binary = atob(rawBase64.slice(0, 32));
      if (binary.charCodeAt(0) === 0xff && binary.charCodeAt(1) === 0xd8 && binary.charCodeAt(2) === 0xff) {
        return 'image/jpeg';
      }
      if (binary.startsWith('\x89PNG\r\n\x1a\n')) {
        return 'image/png';
      }
      if (binary.startsWith('GIF87a') || binary.startsWith('GIF89a')) {
        return 'image/gif';
      }
      if (binary.startsWith('RIFF') && binary.slice(8, 12) === 'WEBP') {
        return 'image/webp';
      }
    } catch {
      // ignore decoding errors
    }
    return '';
  };

  const sanitizeDataUrl = (dataUrl: string, fallbackMime?: string): string => {
    if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return dataUrl;
    const rawBase64 = dataUrl.slice(commaIdx + 1).trim();
    const detected = detectImageMimeType(rawBase64);
    const mime = detected || fallbackMime || 'image/jpeg';
    return `data:${mime};base64,${rawBase64}`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const newImages: string[] = [];
    let loadedCount = 0;

    // ROOT CAUSE FIX: Reset existing Visual Profile data upon new image upload
    // to strictly prevent ghost data or stale profile leakage, while preserving Story Profile data
    setDescription('');
    setOutfitDescription('');
    setDraftAnalysis(null);
    setIsDraftActive(false);
    setIsConfirmedByUser(false);
    setAnalysisSuccessMsg(null);
    setStructuredFeatures({
      creatureType: 'human',
      species: '',
      name: '',
      gender: gender, // preserve Story Profile gender
      ageRange: age, // preserve Story Profile age
      skinTone: '',
      faceShape: '',
      hairStyle: '',
      hairColor: '',
      eyeDescription: '',
      bodyType: '',
      topClothing: '',
      bottomClothing: '',
      footwear: '',
      accessories: 'ไม่มี',
      distinctFeatures: '',
      confidence: 80
    });

    fileList.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        if (event.target?.result) {
          const rawResult = event.target.result as string;
          const commaIdx = rawResult.indexOf(',');
          let dataUrl = rawResult;
          if (commaIdx !== -1) {
            const rawBase64 = rawResult.slice(commaIdx + 1).trim();
            const detectedMime = detectImageMimeType(rawBase64);
            const actualMime = detectedMime || (file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg');
            dataUrl = `data:${actualMime};base64,${rawBase64}`;
          }
          newImages.push(dataUrl);
        }
        loadedCount++;
        if (loadedCount === fileList.length) {
          const combined = [...referenceImages, ...newImages];
          setReferenceImages(combined);
          
          // Calculate image hash for caching
          let hash = '';
          try {
            hash = await computeImageHash(combined[0]);
          } catch {
            hash = '';
          }
          if (hash) {
            setCurrentReferenceImageHash(hash);
          }

          // Caching check: If hash matches existing visualProfileImageHash and we have draftAnalysis, reuse it
          if (hash && hash === visualProfileImageHash && draftAnalysis) {
            setIsCacheHit(true);
            setAnalysisStatus('AI_DRAFT');
            setAnalysisSuccessMsg('⚡ ใช้ผลวิเคราะห์เดิมจากแคช (imageHash ตรงกัน ไม่ต้องเรียก Gemini Vision ซ้ำ)');
          } else {
            // Run image analysis with all images (combined[0] is primary, rest are supporting)
            runImageAnalysis(combined, false, hash);
          }
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = async (index: number) => {
    const updated = referenceImages.filter((_, i) => i !== index);
    setReferenceImages(updated);
    if (updated.length > 0) {
      let hash = '';
      try {
        hash = await computeImageHash(updated[0]);
      } catch {
        hash = '';
      }
      if (hash) setCurrentReferenceImageHash(hash);
      runImageAnalysis(updated, false, hash);
    } else {
      setCurrentReferenceImageHash('');
      setVisualProfileImageHash('');
      setAnalysisStatus('NOT_ANALYZED');
      setReferenceMetadata(null);
    }
  };

  const handleSaveCharacter = async (e: React.FormEvent) => {
    e.preventDefault();

    // =========================================================================
    // STEP A: Validate current Character
    // =========================================================================
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('กรุณากรอกชื่อตัวละคร');
      return;
    }
    if (referenceImages.length === 0) {
      setErrorMsg('กรุณาอัปโหลดรูปภาพอ้างอิงอย่างน้อย 1 รูป');
      return;
    }

    // Strict validation: reference image must match the visual profile image hash
    if (currentReferenceImageHash && visualProfileImageHash && currentReferenceImageHash !== visualProfileImageHash) {
      setErrorMsg('⚠️ รูปภาพอ้างอิงถูกเปลี่ยนแต่ยังไม่ได้วิเคราะห์ใหม่ โปรดกด "วิเคราะห์รูปภาพ" เพื่ออัปเดตรูปลักษณ์ให้ตรงกับภาพก่อนบันทึก');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      // ตรวจสอบและ normalize data URL ของรูปภาพทั้งหมดก่อนบันทึก
      const validatedImages = referenceImages.map(img => sanitizeDataUrl(img));

      const finalStructured: CharacterStructuredFeatures = {
        name: trimmedName,
        gender,
        ageRange: age,
        skinTone: structuredFeatures.skinTone || '',
        faceShape: structuredFeatures.faceShape || '',
        hairStyle: structuredFeatures.hairStyle || '',
        hairColor: structuredFeatures.hairColor || '',
        eyeDescription: structuredFeatures.eyeDescription || '',
        bodyType: structuredFeatures.bodyType || '',
        topClothing: structuredFeatures.topClothing || '',
        bottomClothing: structuredFeatures.bottomClothing || '',
        footwear: structuredFeatures.footwear || '',
        accessories: structuredFeatures.accessories || 'ไม่มี',
        distinctFeatures: structuredFeatures.distinctFeatures || '',
        confidence: draftAnalysis?.confidence ?? 80
      };

      const charId = `char_${Date.now()}`;
      const finalHash = visualProfileImageHash || currentReferenceImageHash;
      const finalAnalysisStatus: CharacterAnalysisStatus = isConfirmedByUser
        ? 'USER_CONFIRMED'
        : (analysisStatus === 'AI_DRAFT' ? 'AI_DRAFT' : 'NOT_ANALYZED');
      const finalLockStatus: CharacterLockStatus = isConfirmedByUser ? 'LOCKED' : 'UNLOCKED';

      // =========================================================================
      // STEP B: Build final 4-layer Character object
      // =========================================================================
      // Layer 1: CharacterIdentity (ชื่อ, ID ประจำตัว)
      const characterIdentity: CharacterIdentity = {
        id: charId,
        name: trimmedName
      };

      // Layer 2: CharacterReferenceMetadata (ข้อมูลทางเทคนิคของภาพอ้างอิง)
      const refMetadata: CharacterReferenceMetadata = referenceMetadata || {
        referenceImageId: referenceImageId || `ref_${Date.now()}`,
        referenceImageUrl: referenceImageUrl || validatedImages[0] || '',
        imageHash: finalHash,
        detectedName: draftAnalysis?.detectedName,
        detectedAge: draftAnalysis?.detectedAge,
        detectedHeight: draftAnalysis?.detectedHeight,
        availableViews: draftAnalysis?.availableViews || (validatedImages.length > 1 ? ['MULTI_VIEWS'] : ['FRONT'])
      };

      // Layer 3: CharacterVisualProfile (ลักษณะทางกายภาพที่สังเกตได้จริงจากภาพ)
      const visualProfile: CharacterVisualProfile = {
        imageHash: finalHash,
        referenceImage: validatedImages[0],
        referenceImages: validatedImages,
        imageAnalysisStatus: finalAnalysisStatus,
        hair: [finalStructured.hairStyle, finalStructured.hairColor].filter(Boolean).join(' ') || finalStructured.hairStyle || 'ตามภาพอ้างอิง',
        hairStyle: finalStructured.hairStyle || '',
        hairColor: finalStructured.hairColor || '',
        top: finalStructured.topClothing || '',
        bottom: finalStructured.bottomClothing || '',
        shoes: finalStructured.footwear || 'ไม่เห็นชัดในภาพ',
        accessories: finalStructured.accessories || 'ไม่มี',
        visibleDistinctiveDetails: finalStructured.distinctFeatures || 'ไม่มี',
        visibleOutfit: outfitDescription.trim() || 'ตามภาพอ้างอิง',
        visibleAccessories: finalStructured.accessories || 'ไม่มี',
        visiblePhysicalAppearance: description.trim() || 'ตามภาพอ้างอิง',
        visibleDistinguishingDetails: finalStructured.distinctFeatures || 'ไม่มี',
        detectedViews: refMetadata.availableViews,
        isMultiViewSheet: refMetadata.availableViews ? refMetadata.availableViews.length > 1 : false,
        confidence: draftAnalysis?.confidence ?? 80,
        generatedVisualPrompt: `${description.trim()}, wearing ${outfitDescription.trim()}`
      };

      // Layer 4: CharacterStoryProfile (ข้อมูลเชิงบทละคร แยกเด็ดขาดจากรูปลักษณ์ภาพ)
      const storyProfile: CharacterStoryProfile = {
        age,
        personality: personality.trim(),
        role: role.trim(),
        occupation: occupation.trim(),
        background: background.trim(),
        storyInfo: [
          role.trim() ? `บทบาท: ${role.trim()}` : '',
          personality.trim() ? `นิสัย: ${personality.trim()}` : '',
          occupation.trim() ? `อาชีพ: ${occupation.trim()}` : '',
          background.trim() ? `ปูมหลัง: ${background.trim()}` : ''
        ].filter(Boolean).join(' • ')
      };

      const charRefId = referenceImageId || refMetadata.referenceImageId || `ref_${Date.now()}`;
      const charRefUrl = referenceImageUrl || (validatedImages[0]?.startsWith('/uploads/') ? validatedImages[0] : (validatedImages[0] || ''));
      const finalReferenceImages = charRefUrl && !validatedImages.includes(charRefUrl) 
        ? [charRefUrl, ...validatedImages] 
        : validatedImages;

      const finalRefMetadata: CharacterReferenceMetadata = {
        ...refMetadata,
        referenceImageId: charRefId,
        referenceImageUrl: charRefUrl,
        imageHash: finalHash
      };

      const finalVisualProfile: CharacterVisualProfile = {
        ...visualProfile,
        referenceImage: charRefUrl || visualProfile.referenceImage,
        referenceImageUrl: charRefUrl,
        referenceImageId: charRefId,
        imageHash: finalHash,
        referenceImages: finalReferenceImages
      };

      const finalCharacterToSave: Partial<Character> = {
        id: charId,
        name: trimmedName,
        gender,
        age,
        description: description.trim() || 'ตัวละครเอกประจำสตูดิโอศาลาเอไอ',
        outfitDescription: outfitDescription.trim(),
        triggerTag: triggerTag.trim() || `(${trimmedName.toLowerCase()}:1.2)`,
        consistencyStrength,
        referenceImageId: charRefId,
        referenceImageUrl: charRefUrl,
        imageHash: finalHash,
        referenceImages: finalReferenceImages,
        avatarUrl: charRefUrl || validatedImages[0],
        structuredFeatures: finalStructured,
        analysisConfidence: draftAnalysis?.confidence ?? 80,
        isVerifiedByUser: isConfirmedByUser,
        identity: characterIdentity,
        characterIdentity,
        referenceMetadata: finalRefMetadata,
        visualProfile: finalVisualProfile,
        storyProfile,
        currentReferenceImageHash: finalHash,
        visualProfileImageHash: finalHash,
        imageAnalysisStatus: finalAnalysisStatus,
        lockStatus: finalLockStatus,
        fieldSources,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // =========================================================================
      // STEP C: Persist character
      // =========================================================================
      const savedCharacter = await api.createCharacter(finalCharacterToSave);

      // =========================================================================
      // STEP D: Verify persistence success
      // =========================================================================
      if (!savedCharacter || !savedCharacter.id || !savedCharacter.name) {
        throw new Error('ระบบไม่สามารถบันทึกตัวละครได้: ข้อมูลตอบกลับไม่ถูกต้องหรือไม่สมบูรณ์');
      }

      console.log(`✅ [Atomic Flow Success] Character "${savedCharacter.name}" (${savedCharacter.id}) persisted successfully.`);

      // =========================================================================
      // STEP E: Update Character Library state
      // =========================================================================
      await onRefreshCharacters(savedCharacter);

      // =========================================================================
      // STEP F: Close modal ONLY after success
      // =========================================================================
      onCloseModal();
      resetFormState();
      setErrorMsg(null);
      setAnalysisSuccessMsg(`✅ บันทึกตัวละคร "${savedCharacter.name}" ในคลังเรียบร้อยแล้ว`);
    } catch (err: any) {
      console.error('❌ [Atomic Save Error]:', err);
      setErrorMsg(err.message || 'ไม่สามารถบันทึกตัวละครได้');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCharacter = (id: string, charName: string) => {
    setDeleteTarget({ id, name: charName });
  };

  const handleCancelDelete = () => {
    setDeleteTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteCharacter(deleteTarget.id);
      onRefreshCharacters();
      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 pb-28 md:pb-12 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d1322] border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">
              ไลบรารีตัวละคร (Character Consistency Library)
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            สร้างและบันทึกตัวละครของตนเอง พร้อมอัปโหลดหลายมุมมองเพื่อล็อกโครงหน้า ทรงผม และชุดในทุกฉาก
          </p>
        </div>

        <button
          onClick={onOpenModal}
          id="btn-open-create-char"
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs sm:text-sm px-4 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/30 active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>สร้างตัวละครใหม่</span>
        </button>
      </div>

      {/* Firestore Cloud & LocalStorage Sync Controller */}
      <div className="bg-[#0b101d] border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Cloud className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                  <span>สถานะการบันทึกข้อมูลตัวละคร (Firestore & LocalStorage)</span>
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Firestore Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                ระบบสำรองข้อมูลตัวละครขึ้นคลาวด์ Firestore อัตโนมัติ ป้องกันข้อมูลสูญหายเมื่อรีเฟรชหรือเปลี่ยนเครื่อง
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCheckFirestoreAndSync}
              disabled={isCheckingSync || isMigrating}
              id="btn-sync-firestore"
              className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl transition-all disabled:opacity-50"
              title="ตรวจสอบตัวละครใน Firestore และดึงกลับมาแสดง"
            >
              {isCheckingSync ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span>{isCheckingSync ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ & ดึงจาก Firestore'}</span>
            </button>

            <button
              type="button"
              onClick={handleMigrateToFirestore}
              disabled={isCheckingSync || isMigrating}
              id="btn-migrate-local-firestore"
              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
              title="สแกนตัวละครใน LocalStorage ในเครื่องนี้แล้วอัปโหลดขึ้น Firestore"
            >
              {isMigrating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <ArrowUpCircle className="w-3.5 h-3.5 text-indigo-200" />
              )}
              <span>{isMigrating ? 'กำลังย้ายขึ้น Cloud...' : 'ย้ายจาก LocalStorage ขึ้น Firestore'}</span>
            </button>
          </div>
        </div>

        {/* Audit Status Message */}
        {syncAuditInfo && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
              syncAuditInfo.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : syncAuditInfo.type === 'warning'
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                : 'bg-indigo-950/40 border-indigo-500/40 text-indigo-200'
            }`}
          >
            {syncAuditInfo.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : syncAuditInfo.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 space-y-1">
              <div className="font-semibold">{syncAuditInfo.message}</div>
              <div className="text-[11px] opacity-85 flex flex-wrap items-center gap-3 pt-0.5">
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3 text-indigo-400" />
                  <span>Firestore Cloud: {syncAuditInfo.firestoreCount} ตัว</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-slate-400" />
                  <span>LocalStorage (เครื่องนี้): {syncAuditInfo.localCount} ตัว</span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Character Grid or Empty State */}
      {characters.length === 0 ? (
        <div className="bg-[#0e1424] border border-dashed border-slate-800 rounded-3xl p-10 text-center space-y-4 max-w-xl mx-auto my-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
            <UserCheck className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">ยังไม่มีตัวละครในคลัง</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              สร้างตัวละครใหม่เพื่อล็อกโครงหน้า อัตลักษณ์ เสื้อผ้า และความสม่ำเสมอในทุกฉากด้วย AI
            </p>
          </div>
          <button
            onClick={onOpenModal}
            id="btn-empty-create-char"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>สร้างตัวละครแรกของคุณ</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {characters.map((char) => (
            <div
              key={char.id}
              id={`character-card-${char.id}`}
              className="bg-[#0e1424] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all group"
            >
              <div>
                {/* Photo Banner with consistency badge */}
                <div 
                  onClick={() => setInspectedCharacter(char)}
                  className="relative h-56 bg-slate-900 overflow-hidden cursor-pointer"
                  title="คลิกเพื่อดูรายละเอียดอัตลักษณ์ 4 มิติ และรูปอ้างอิง"
                >
                  <img
                    src={char.referenceImageUrl || char.visualProfile?.referenceImageUrl || char.visualProfile?.referenceImage || char.avatarUrl || (char.referenceImages && char.referenceImages[0])}
                    alt={char.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e1424] via-transparent to-black/40" />

                  <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] text-white font-mono border border-white/10 max-w-[85%]">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Lock {Math.round(char.consistencyStrength * 100)}%</span>
                    {char.lockStatus === 'LOCKED' || char.isVerifiedByUser || char.imageAnalysisStatus === 'USER_CONFIRMED' ? (
                      <>
                        <span className="text-slate-400">|</span>
                        <span className="text-emerald-300 flex items-center gap-0.5 font-sans font-semibold">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          <span>LOCKED</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-400">|</span>
                        <span className="text-amber-300 flex items-center gap-0.5 font-sans">
                          <FileText className="w-3 h-3 text-amber-400" />
                          <span>DRAFT</span>
                        </span>
                      </>
                    )}
                    {(char.visualProfileImageHash || char.referenceMetadata?.imageHash) && (
                      <>
                        <span className="text-slate-400">|</span>
                        <span className="text-indigo-300 font-mono">
                          #{(char.visualProfileImageHash || char.referenceMetadata?.imageHash || '').slice(0, 8)}
                        </span>
                      </>
                    )}
                    {char.referenceMetadata?.detectedName && (
                      <>
                        <span className="text-slate-400">|</span>
                        <span className="text-cyan-300 font-sans">
                          OCR: {char.referenceMetadata.detectedName}
                        </span>
                      </>
                    )}
                    <span className="text-slate-400">|</span>
                    <span className="text-indigo-300 flex items-center gap-1 font-sans">
                      <Cloud className="w-3 h-3 text-indigo-400" />
                      <span>Firestore</span>
                    </span>
                  </div>

                  <button
                    onClick={() => handleDeleteCharacter(char.id, char.name)}
                    className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-colors"
                    title="ลบตัวละคร"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="absolute bottom-3 left-4 right-4">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-base font-bold text-white drop-shadow-md">{char.name}</h3>
                      <span className="text-xs text-slate-300 drop-shadow-md">{char.gender} • {char.age}</span>
                    </div>
                  </div>
                </div>

                {/* Character Details & Specs */}
                <div className="p-4 space-y-3">
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                    {char.description}
                  </p>

                  {char.outfitDescription && (
                    <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                      <span className="text-slate-300 font-medium">ชุดประจำตัว:</span> {char.outfitDescription}
                    </div>
                  )}

                  {char.storyProfile?.role && (
                    <div className="text-[11px] text-indigo-300 bg-indigo-950/40 p-2 rounded-xl border border-indigo-500/20">
                      <span className="font-semibold text-indigo-200">บทละคร:</span> {char.storyProfile.role}
                      {char.storyProfile.personality && ` • นิสัย: ${char.storyProfile.personality}`}
                    </div>
                  )}

                  {/* Reference thumbnails gallery */}
                  {char.referenceImages && char.referenceImages.length > 1 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        มุมมองอ้างอิง ({char.referenceImages.length} รูป):
                      </span>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {char.referenceImages.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt="ref"
                            className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trigger Tag Copy Box */}
                  <div className="flex items-center justify-between bg-slate-950/60 p-2 rounded-xl border border-slate-800/80 text-[11px] font-mono text-indigo-400">
                    <span className="truncate max-w-[200px]">{char.triggerTag}</span>
                    <button
                      onClick={() => copyToClipboard(char.triggerTag, char.id)}
                      className="p-1 hover:text-white text-slate-400 transition-colors"
                      title="คัดลอก Tag"
                    >
                      {copiedId === char.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Actions: Inspect Profile & Load to MultiClip Director */}
              <div className="p-4 pt-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInspectedCharacter(char)}
                  id={`btn-inspect-char-${char.id}`}
                  className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                  title="ดูอัตลักษณ์และข้อมูลเชิงลึก"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                </button>
                <button
                  type="button"
                  onClick={() => onUseCharacterInStudio(char.id)}
                  id={`btn-use-char-${char.id}`}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-semibold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
                  title="นำตัวละครไปกำกับหลายคลิปและสร้างงานต่อเนื่อง"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>กำกับหลายคลิป</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Inspect Character Profile (4 Layers & Persistent Reference Image) */}
      {inspectedCharacter && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0e1424] border border-slate-700 w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">รายละเอียดอัตลักษณ์ตัวละคร (4-Layer Character Lock)</h3>
                {(inspectedCharacter.lockStatus === 'LOCKED' || inspectedCharacter.isVerifiedByUser || inspectedCharacter.imageAnalysisStatus === 'USER_CONFIRMED') && (
                  <span className="text-[10px] bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                    LOCKED
                  </span>
                )}
              </div>
              <button
                onClick={() => setInspectedCharacter(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
              {/* Top: Reference Image Banner + Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                <div className="relative h-44 sm:h-auto rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                  <img
                    src={inspectedCharacter.referenceImageUrl || inspectedCharacter.visualProfile?.referenceImageUrl || inspectedCharacter.visualProfile?.referenceImage || inspectedCharacter.avatarUrl || (inspectedCharacter.referenceImages && inspectedCharacter.referenceImages[0])}
                    alt={inspectedCharacter.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {(inspectedCharacter.imageHash || inspectedCharacter.visualProfileImageHash || inspectedCharacter.referenceMetadata?.imageHash) && (
                    <div className="absolute bottom-1.5 left-1.5 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono text-indigo-300 border border-indigo-500/30">
                      #{(inspectedCharacter.imageHash || inspectedCharacter.visualProfileImageHash || inspectedCharacter.referenceMetadata?.imageHash || '').slice(0, 8)}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-2.5">
                  <div>
                    <h4 className="text-lg font-bold text-white">{inspectedCharacter.name}</h4>
                    <p className="text-xs text-slate-400">{inspectedCharacter.gender} • {inspectedCharacter.age}</p>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono text-indigo-400">
                    <span className="text-slate-400 mr-1">Trigger Tag:</span>
                    <span className="text-white font-semibold">{inspectedCharacter.triggerTag}</span>
                  </div>

                  {inspectedCharacter.referenceImageUrl && (
                    <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800/80 text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">รูปอ้างอิงถาวร: {inspectedCharacter.referenceImageUrl}</span>
                    </div>
                  )}

                  {inspectedCharacter.referenceImages && inspectedCharacter.referenceImages.length > 1 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-400">มุมมองอ้างอิงทั้งหมด ({inspectedCharacter.referenceImages.length} รูป):</span>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {inspectedCharacter.referenceImages.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            alt="ref"
                            className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Layer 1: CharacterIdentity */}
              <div className="bg-slate-900/50 border border-slate-800 p-3.5 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5 text-indigo-300">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Layer 1: CharacterIdentity (อัตลักษณ์ประจำตัว)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {inspectedCharacter.id}</span>
                </div>
                <p className="text-xs text-slate-300">
                  ชื่อ: <strong>{inspectedCharacter.name}</strong> • เพศ: {inspectedCharacter.gender} • อายุ: {inspectedCharacter.age}
                </p>
              </div>

              {/* Layer 2: CharacterReferenceMetadata */}
              <div className="bg-cyan-950/20 border border-cyan-500/20 p-3.5 rounded-2xl space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Layer 2: CharacterReferenceMetadata (ข้อมูลเทคนิคภาพอ้างอิง)</span>
                  </span>
                  {inspectedCharacter.imageHash && (
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-700">
                      Hash: {inspectedCharacter.imageHash.slice(0, 12)}...
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-300">
                  <div>
                    <span className="text-slate-400">Reference ID:</span> {inspectedCharacter.referenceImageId || inspectedCharacter.referenceMetadata?.referenceImageId || 'ref_primary'}
                  </div>
                  {inspectedCharacter.referenceMetadata?.detectedName && (
                    <div>
                      <span className="text-slate-400">OCR ชื่อ:</span> {inspectedCharacter.referenceMetadata.detectedName}
                    </div>
                  )}
                  {inspectedCharacter.referenceMetadata?.detectedAge && (
                    <div>
                      <span className="text-slate-400">OCR อายุ:</span> {inspectedCharacter.referenceMetadata.detectedAge} ปี
                    </div>
                  )}
                  {inspectedCharacter.referenceMetadata?.availableViews && (
                    <div>
                      <span className="text-slate-400">มุมมอง:</span> {inspectedCharacter.referenceMetadata.availableViews.join(', ')}
                    </div>
                  )}
                </div>
              </div>

              {/* Layer 3: CharacterVisualProfile */}
              <div className="bg-indigo-950/20 border border-indigo-500/20 p-3.5 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
                  <span className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Layer 3: CharacterVisualProfile (ลักษณะทางกายภาพที่สังเกตได้จริง)</span>
                  </span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-sans">
                    {inspectedCharacter.imageAnalysisStatus || 'USER_CONFIRMED'}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-300">
                  {inspectedCharacter.description && (
                    <p><strong className="text-slate-400">กายภาพ/ใบหน้า:</strong> {inspectedCharacter.description}</p>
                  )}
                  {inspectedCharacter.outfitDescription && (
                    <p><strong className="text-slate-400">เสื้อผ้าเครื่องแต่งกาย:</strong> {inspectedCharacter.outfitDescription}</p>
                  )}
                  {inspectedCharacter.visualProfile?.hair && (
                    <p><strong className="text-slate-400">ทรงผม:</strong> {inspectedCharacter.visualProfile.hair}</p>
                  )}
                  {inspectedCharacter.visualProfile?.top && (
                    <p><strong className="text-slate-400">เสื้อ/ท่อนบน:</strong> {inspectedCharacter.visualProfile.top}</p>
                  )}
                  {inspectedCharacter.visualProfile?.bottom && (
                    <p><strong className="text-slate-400">กางเกง/ท่อนล่าง:</strong> {inspectedCharacter.visualProfile.bottom}</p>
                  )}
                  {inspectedCharacter.visualProfile?.shoes && (
                    <p><strong className="text-slate-400">รองเท้า:</strong> {inspectedCharacter.visualProfile.shoes}</p>
                  )}
                  {inspectedCharacter.visualProfile?.accessories && inspectedCharacter.visualProfile.accessories !== 'ไม่มี' && (
                    <p><strong className="text-slate-400">เครื่องประดับ:</strong> {inspectedCharacter.visualProfile.accessories}</p>
                  )}
                </div>
              </div>

              {/* Layer 4: CharacterStoryProfile */}
              {inspectedCharacter.storyProfile && (inspectedCharacter.storyProfile.role || inspectedCharacter.storyProfile.personality || inspectedCharacter.storyProfile.occupation || inspectedCharacter.storyProfile.background) && (
                <div className="bg-amber-950/20 border border-amber-500/20 p-3.5 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>Layer 4: CharacterStoryProfile (ข้อมูลเชิงบทละคร & เรื่องราว)</span>
                    </span>
                    <span className="text-[10px] text-amber-400/80 font-mono">Layer C</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                    {inspectedCharacter.storyProfile.role && (
                      <p><strong className="text-slate-400">บทบาท:</strong> {inspectedCharacter.storyProfile.role}</p>
                    )}
                    {inspectedCharacter.storyProfile.personality && (
                      <p><strong className="text-slate-400">นิสัย:</strong> {inspectedCharacter.storyProfile.personality}</p>
                    )}
                    {inspectedCharacter.storyProfile.occupation && (
                      <p><strong className="text-slate-400">อาชีพ:</strong> {inspectedCharacter.storyProfile.occupation}</p>
                    )}
                    {inspectedCharacter.storyProfile.background && (
                      <p className="sm:col-span-2"><strong className="text-slate-400">ปูมหลัง:</strong> {inspectedCharacter.storyProfile.background}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setInspectedCharacter(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={() => {
                  onUseCharacterInStudio(inspectedCharacter.id);
                  setInspectedCharacter(null);
                }}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>นำไปกำกับหลายคลิปทันที</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create New Character */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0e1424] border border-slate-700 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">สร้างตัวละครใหม่ (New Character)</h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-medium">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Auto-Fill ด้วย Gemini Flash
                </span>
              </div>
              <button
                onClick={onCloseModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCharacter} className="space-y-4">
              {/* Reference Photos Upload (Multiple) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>รูปภาพอ้างอิงของตัวละคร (อัปโหลดรูป ระบบจะวิเคราะห์ให้อัตโนมัติ) *</span>
                  </span>
                  <span className="text-[11px] text-slate-500">{referenceImages.length} รูป</span>
                </label>

                <div className="flex flex-wrap gap-2">
                  {referenceImages.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-xl border border-slate-700 overflow-hidden">
                      <img src={img} alt="ref" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-0.5 right-0.5 p-0.5 bg-black/80 rounded text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-900/60 flex flex-col items-center justify-center text-slate-400 hover:text-indigo-400 transition-colors"
                  >
                    <UploadCloud className="w-5 h-5" />
                    <span className="text-[9px] mt-0.5 font-medium">+ เพิ่มรูป</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                {/* Gemini Flash Analysis Status Banner */}
                {isAnalyzingImage && (
                  <div className="bg-indigo-950/70 border border-indigo-500/40 rounded-2xl p-3 flex items-center gap-3 text-xs text-indigo-200 shadow-md animate-pulse">
                    <div className="w-7 h-7 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-semibold text-white flex items-center gap-1.5">
                        <span>Gemini Flash กำลังวิเคราะห์รูปภาพตัวละคร (Multi-image)...</span>
                      </div>
                      <p className="text-[11px] text-indigo-300">
                        วิเคราะห์โครงหน้า สีผิว ทรงผม เสื้อผ้า และจุดเด่นเฉพาะจากภาพจริง โดยห้ามเดาหรือแต่งเติม
                      </p>
                    </div>
                  </div>
                )}

                {/* Draft vs Confirmed Status Bar & Action Controls */}
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {/* Status Badges & Hash Indicators */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isConfirmedByUser || analysisStatus === 'USER_CONFIRMED' ? (
                        <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-2.5 py-1 rounded-full text-xs font-semibold">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>สถานะ: ล็อกอัตลักษณ์แล้ว (USER_CONFIRMED)</span>
                        </div>
                      ) : isDraftActive || analysisStatus === 'AI_DRAFT' ? (
                        <div className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/40 text-amber-300 px-2.5 py-1 rounded-full text-xs font-semibold">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          <span>สถานะ: แบบร่าง AI (AI_DRAFT)</span>
                        </div>
                      ) : isAnalyzingImage ? (
                        <div className="flex items-center gap-1.5 bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 px-2.5 py-1 rounded-full text-xs font-medium">
                          <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                          <span>สถานะ: กำลังวิเคราะห์...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-full text-xs font-medium">
                          <span>สถานะ: รอวิเคราะห์รูปภาพ</span>
                        </div>
                      )}

                      {/* Image Hash Indicator */}
                      {currentReferenceImageHash && (
                        <div
                          className="flex items-center gap-1 bg-slate-950/80 border border-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-mono text-[10px]"
                          title={`SHA-256 Image Hash: ${currentReferenceImageHash}`}
                        >
                          <Hash className="w-3 h-3 text-indigo-400" />
                          <span>{currentReferenceImageHash.slice(0, 8)}</span>
                        </div>
                      )}

                      {/* Cache Hit Badge */}
                      {isCacheHit && (
                        <div className="flex items-center gap-1 bg-sky-950/80 border border-sky-500/40 text-sky-300 px-2 py-0.5 rounded-full font-sans text-[10px] font-semibold">
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span>แคชตรงกัน (0 tokens)</span>
                        </div>
                      )}

                      {draftAnalysis?.confidence && (
                        <div
                          className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold border ${
                            draftAnalysis.confidence >= 70
                              ? 'bg-indigo-950/70 text-indigo-300 border-indigo-500/30'
                              : 'bg-amber-950/70 text-amber-300 border-amber-500/40'
                          }`}
                          title="ระดับความมั่นใจของการวิเคราะห์ภาพ"
                        >
                          ความมั่นใจ: {draftAnalysis.confidence}%
                        </div>
                      )}
                    </div>

                    {/* Action Buttons: Analyze, Use as Draft, Reset */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        id="btn-analyze-char-img"
                        onClick={() => runImageAnalysis(referenceImages, true)}
                        disabled={isAnalyzingImage || referenceImages.length === 0}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold transition-all shadow-sm"
                        title="สั่งวิเคราะห์รูปภาพด้วย Gemini Flash อีกครั้ง (บังคับสร้างใหม่)"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                        <span>{isAnalyzingImage ? 'กำลังวิเคราะห์...' : 'วิเคราะห์รูปภาพ'}</span>
                      </button>

                      {draftAnalysis && (
                        <button
                          type="button"
                          id="btn-apply-draft"
                          onClick={handleApplyAsDraft}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-200 border border-indigo-500/30 text-xs font-medium transition-all"
                          title="นำผลวิเคราะห์ AI มาเติมลงฟอร์มเป็นแบบร่าง"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>ใช้เป็นแบบร่าง</span>
                        </button>
                      )}

                      <button
                        type="button"
                        id="btn-reset-char-form"
                        onClick={handleResetDraftAndForm}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 text-xs font-medium transition-all"
                        title="ล้างข้อมูลและเริ่มต้นใหม่"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>รีเซ็ตค่า</span>
                      </button>

                      {!isConfirmedByUser && (
                        <button
                          type="button"
                          id="btn-confirm-char-data"
                          onClick={handleConfirmCharacterData}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-sm"
                          title="ตรวจสอบและยืนยันข้อมูลตัวละคร เพื่อป้องกัน AI เขียนทับ (Priority 1)"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>ยืนยันข้อมูล</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Confidence Warning if < 70 */}
                  {draftAnalysis?.confidence && draftAnalysis.confidence < 70 && (
                    <div className="bg-amber-950/70 border border-amber-500/40 rounded-xl p-2.5 flex items-start gap-2 text-xs text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">ภาพอาจเห็นรายละเอียดไม่ชัดเจน (ความมั่นใจ {draftAnalysis.confidence}%): </span>
                        <span>โปรดตรวจสอบสีผิว รูปหน้า ทรงผม หรือชุด ก่อนกดยืนยันข้อมูลตัวละคร</span>
                      </div>
                    </div>
                  )}

                  {analysisSuccessMsg && !isAnalyzingImage && (
                    <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2 flex items-center justify-between text-xs text-emerald-300">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{analysisSuccessMsg}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAnalysisSuccessMsg(null)}
                        className="text-emerald-400 hover:text-white p-0.5 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Layer 2: Detected Reference Text (OCR) Banner */}
                {referenceMetadata && (referenceMetadata.detectedName || referenceMetadata.detectedAge || referenceMetadata.detectedHeight || (referenceMetadata.availableViews && referenceMetadata.availableViews.length > 1)) && (
                  <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-2xl p-3 space-y-1.5 text-xs text-cyan-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold text-cyan-300">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>ตรวจพบข้อความในภาพอ้างอิงจริง (REFERENCE_TEXT - Priority 2)</span>
                      </div>
                      {referenceMetadata.imageHash && (
                        <span className="font-mono text-[10px] text-cyan-400/90 bg-cyan-950/90 px-2 py-0.5 rounded-full border border-cyan-800">
                          #{referenceMetadata.imageHash.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px] pt-0.5">
                      {referenceMetadata.detectedName && (
                        <div className="bg-cyan-900/40 px-2.5 py-1 rounded-lg border border-cyan-700/50">
                          ชื่อในภาพ: <strong className="text-white ml-1">{referenceMetadata.detectedName}</strong>
                        </div>
                      )}
                      {referenceMetadata.detectedAge && (
                        <div className="bg-cyan-900/40 px-2.5 py-1 rounded-lg border border-cyan-700/50">
                          อายุในภาพ: <strong className="text-white ml-1">{referenceMetadata.detectedAge} ปี</strong>
                        </div>
                      )}
                      {referenceMetadata.detectedHeight && (
                        <div className="bg-cyan-900/40 px-2.5 py-1 rounded-lg border border-cyan-700/50">
                          ส่วนสูง: <strong className="text-white ml-1">{referenceMetadata.detectedHeight}</strong>
                        </div>
                      )}
                      {referenceMetadata.availableViews && referenceMetadata.availableViews.length > 1 && (
                        <div className="bg-cyan-900/40 px-2.5 py-1 rounded-lg border border-cyan-700/50">
                          มุมมอง: <strong className="text-white ml-1">{referenceMetadata.availableViews.join(', ')}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Character Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>ชื่อตัวละคร *</span>
                      {fieldSources['name'] === 'USER_CONFIRMED' && (
                        <span className="text-[10px] text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.2 rounded font-sans font-medium">
                          ผู้ใช้กำหนด ✍️
                        </span>
                      )}
                      {fieldSources['name'] === 'REFERENCE_TEXT' && (
                        <span className="text-[10px] text-cyan-300 bg-cyan-950/80 border border-cyan-500/40 px-1.5 py-0.2 rounded font-sans font-medium">
                          จากภาพ (OCR)
                        </span>
                      )}
                    </span>
                    {isAnalyzingImage && <span className="text-[10px] text-indigo-400 animate-pulse">กำลังดึงชื่อ...</span>}
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="เช่น วายุ, ฟ้าใส, ไอดอลสาว"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>เพศ</span>
                    {fieldSources['gender'] === 'USER_CONFIRMED' && (
                      <span className="text-[10px] text-emerald-400">✍️</span>
                    )}
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => handleGenderChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  >
                    <option value="หญิง">หญิง</option>
                    <option value="ชาย">ชาย</option>
                    <option value="ไม่ระบุ">ไม่ระบุ</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>อายุ</span>
                    {fieldSources['age'] === 'REFERENCE_TEXT' && referenceMetadata?.detectedAge && (
                      <span className="text-[10px] text-cyan-300 bg-cyan-950/80 border border-cyan-500/40 px-1 rounded font-sans">
                        OCR: {referenceMetadata.detectedAge}
                      </span>
                    )}
                    {fieldSources['age'] === 'USER_CONFIRMED' && (
                      <span className="text-[10px] text-emerald-400">✍️</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={age}
                    onChange={(e) => handleAgeChange(e.target.value)}
                    placeholder="เช่น 24 ปี"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Story Profile Section (Layer C: narrative and script context) */}
              <div className="bg-slate-900/60 border border-indigo-950/80 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-indigo-200">
                      Story Profile (ข้อมูลเชิงเรื่องราว & บทละคร)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                    Layer C • แยกเด็ดขาดจากรูปภาพ
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  ระบุบทบาทและนิสัยของตัวละครในบทละคร โดยข้อมูลส่วนนี้จะไม่ถูกนำไปปนกับรูปลักษณ์ทางกายภาพจากภาพถ่าย
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-300">บทบาทในเรื่อง (Role)</label>
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="เช่น พระเอก, ผู้ช่วยสารวัตร, ตัวร้าย"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-300">นิสัย / บุคลิก (Personality)</label>
                    <input
                      type="text"
                      value={personality}
                      onChange={(e) => setPersonality(e.target.value)}
                      placeholder="เช่น สุขุม รอบคอบ อ่อนโยนแต่เด็ดขาด"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-300">อาชีพ (Occupation)</label>
                    <input
                      type="text"
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      placeholder="เช่น นักสืบ, จอมยุทธ์, แพทย์"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[11px] font-medium text-slate-300">ปูมหลังย่อ (Background Story)</label>
                    <input
                      type="text"
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      placeholder="เช่น เดินทางมาจากแดนไกลเพื่อตามหาความจริงเกี่ยวกับเหตุการณ์ในอดีต..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Visual Description */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>ลักษณะเด่นทางกายภาพ (ผิว, ผม, ตา, รูปลักษณ์ใบหน้า - จากภาพอ้างอิง)</span>
                  {isAnalyzingImage && <span className="text-[10px] text-indigo-400 animate-pulse">กำลังเติมให้อัตโนมัติ...</span>}
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="เช่น anthropomorphic animal ตัวละครสัตว์คล้ายคน ขนสีส้มอิฐ แผงคอสีขาว ตาสีเหลือง หรือ หญิงสาว ผิวสองสี ตาสีดำ ผมสั้นสีดำ..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Default Outfit & Accessories */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                  <span>ชุดประจำตัว เสื้อผ้า และอุปกรณ์</span>
                  {isAnalyzingImage && <span className="text-[10px] text-indigo-400 animate-pulse">กำลังเติมให้อัตโนมัติ...</span>}
                </label>
                <input
                  type="text"
                  value={outfitDescription}
                  onChange={(e) => handleOutfitChange(e.target.value)}
                  placeholder="เช่น เสื้อเชิ้ตผ้าลินินสีครีมมินิมอล กางเกงผ้าขากระบอกสีเบจ • อุปกรณ์: สร้อยคอเงินและนาฬิกาข้อมือสายหนัง"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              {/* Structured Visual Attributes Editor (Deep Inspection) */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowStructuredDetails(!showStructuredDetails)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-semibold text-slate-200">
                      ตรวจดูและปรับแต่งรายละเอียดโครงสร้าง (Structured Visual Attributes)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span className="text-[10px] text-slate-500">
                      {showStructuredDetails ? 'ย่อรายละเอียด' : 'ดูรายละเอียดเชิงลึก'}
                    </span>
                    {showStructuredDetails ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {showStructuredDetails && (
                  <div className="p-3.5 pt-1 border-t border-slate-800 space-y-3 bg-slate-950/40">
                    <p className="text-[11px] text-slate-400">
                      รายละเอียดทางกายภาพและเสื้อผ้าที่ถอดรหัสจากภาพอ้างอิงจริง หากต้องการปรับแต่ง สามารถพิมพ์แก้ไขได้ทันทีโดย AI จะไม่เขียนทับ
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">ประเภทสิ่งมีชีวิต (Creature Type)</label>
                        <select
                          value={structuredFeatures.creatureType || 'human'}
                          onChange={(e) => handleStructuredChange('creatureType', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                        >
                          <option value="human">มนุษย์ (human)</option>
                          <option value="anthropomorphic reptile">สัตว์เลื้อยคลานร่างมนุษย์ (anthropomorphic reptile)</option>
                          <option value="anthropomorphic mammal">สัตว์เลี้ยงลูกด้วยนมร่างมนุษย์ (anthropomorphic mammal)</option>
                          <option value="fantasy creature">สิ่งมีชีวิตแฟนตาซี (fantasy creature)</option>
                          <option value="unknown">ไม่แน่ใจ (unknown)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">สายพันธุ์ที่มองเห็น (Species)</label>
                        <input
                          type="text"
                          value={structuredFeatures.species || ''}
                          onChange={(e) => handleStructuredChange('species', e.target.value)}
                          placeholder="เช่น anthropomorphic reptile, กิ้งก่า, มนุษย์"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                        >
                        </input>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">สีผิว / ผิวพรรณ / เกล็ด (Skin Tone)</label>
                        <input
                          type="text"
                          value={structuredFeatures.skinTone}
                          onChange={(e) => handleStructuredChange('skinTone', e.target.value)}
                          placeholder="เช่น ผิวขาวอมชมพู, ผิวสีแทนเนียนละเอียด"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">รูปหน้า (Face Shape)</label>
                        <input
                          type="text"
                          value={structuredFeatures.faceShape}
                          onChange={(e) => handleStructuredChange('faceShape', e.target.value)}
                          placeholder="เช่น รูปไข่ คางเรียว สันกรามชัด"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">ทรงผม (Hair Style)</label>
                        <input
                          type="text"
                          value={structuredFeatures.hairStyle}
                          onChange={(e) => handleStructuredChange('hairStyle', e.target.value)}
                          placeholder="เช่น ผมสั้นประบ่า แสกข้าง มีหน้าม้าปัด"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">สีผม (Hair Color)</label>
                        <input
                          type="text"
                          value={structuredFeatures.hairColor}
                          onChange={(e) => handleStructuredChange('hairColor', e.target.value)}
                          placeholder="เช่น สีดำธรรมชาติ หรือ สีน้ำตาลคาราเมล"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">ลักษณะดวงตา (Eyes)</label>
                        <input
                          type="text"
                          value={structuredFeatures.eyeDescription}
                          onChange={(e) => handleStructuredChange('eyeDescription', e.target.value)}
                          placeholder="เช่น ตากลมโต สีน้ำตาลเข้ม คิ้วได้รูป"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">รูปร่าง / สรีระ (Body Type)</label>
                        <input
                          type="text"
                          value={structuredFeatures.bodyType}
                          onChange={(e) => handleStructuredChange('bodyType', e.target.value)}
                          placeholder="เช่น รูปร่างสมส่วน สูงโปร่ง ไหล่กว้าง"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">เสื้อผ้าท่อนบน (Top Clothing)</label>
                        <input
                          type="text"
                          value={structuredFeatures.topClothing}
                          onChange={(e) => handleStructuredChange('topClothing', e.target.value)}
                          placeholder="เช่น เสื้อเชิ้ตโอเวอร์ไซส์สีขาวคอปก"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">เสื้อผ้าท่อนล่าง (Bottom Clothing)</label>
                        <input
                          type="text"
                          value={structuredFeatures.bottomClothing}
                          onChange={(e) => handleStructuredChange('bottomClothing', e.target.value)}
                          placeholder="เช่น กางเกงยีนส์ขากระบอกสีน้ำเงินเข้ม"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">รองเท้า (Footwear)</label>
                        <input
                          type="text"
                          value={structuredFeatures.footwear}
                          onChange={(e) => handleStructuredChange('footwear', e.target.value)}
                          placeholder="เช่น รองเท้าผ้าใบสนีกเกอร์สีขาว"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">อุปกรณ์ & เครื่องประดับ (Accessories)</label>
                        <input
                          type="text"
                          value={structuredFeatures.accessories}
                          onChange={(e) => handleStructuredChange('accessories', e.target.value)}
                          placeholder="เช่น นาฬิกาข้อมือสายหนัง สร้อยคอเงิน"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="sm:col-span-2 space-y-1">
                        <label className="text-[11px] font-medium text-slate-300">จุดเด่นเฉพาะตัว (Distinct Features)</label>
                        <input
                          type="text"
                          value={structuredFeatures.distinctFeatures}
                          onChange={(e) => handleStructuredChange('distinctFeatures', e.target.value)}
                          placeholder="เช่น ไฝใต้ตาข้างขวา, ลักยิ้ม, รอยยิ้มสดใส"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Consistency Strength Slider */}
              <div className="space-y-1 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">ความเข้มข้นของการล็อกตัวละคร:</span>
                  <span className="font-mono font-bold text-indigo-400">{Math.round(consistencyStrength * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.0"
                  step="0.05"
                  value={consistencyStrength}
                  onChange={(e) => setConsistencyStrength(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Error Message */}
              {errorMsg && (
                <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/30">
                  {errorMsg}
                </p>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onCloseModal}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  id="btn-save-character"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกตัวละคร'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Dialog */}
      {deleteTarget && (
        <div
          id="dialog-confirm-delete-backdrop"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            id="dialog-confirm-delete"
            className="bg-[#0f172a] border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  ยืนยันการลบตัวละคร
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  คุณต้องการลบตัวละคร <span className="font-semibold text-white">"{deleteTarget.name}"</span> หรือไม่? ข้อมูลจะถูกลบออกจากระบบและคลังตัวละครถาวร
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                id="btn-cancel-delete"
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                id="btn-confirm-delete"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังลบ...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>ยืนยันลบตัวละคร</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
