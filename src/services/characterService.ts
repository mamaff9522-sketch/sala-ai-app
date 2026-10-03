import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { db, auth, getStoredUser } from './auth';
import { Character, CharacterReferenceMetadata, CharacterVisualProfile } from '../types';
import {
  safeFirestoreWrite,
  isFirestoreQuotaExhausted,
  setFirestoreQuotaExhausted,
  isQuotaError
} from './firestoreGuard';

/**
 * ดึง UID ของผู้ใช้ที่กำลังใช้งานอยู่จาก Firebase Auth หรือ LocalStorage
 */
export function getActiveUid(explicitUid?: string): string | null {
  if (explicitUid && explicitUid.trim()) return explicitUid.trim();
  if (auth.currentUser?.uid) return auth.currentUser.uid;
  try {
    const stored = getStoredUser();
    if (stored && stored.uid) return stored.uid;
  } catch {}
  return null;
}

// Potential LocalStorage keys where characters might have been saved
const LOCAL_STORAGE_KEYS = [
  'sala_characters',
  'sala_custom_characters',
  'characters',
  'sala_character_library',
  'sala_chars',
  'custom_characters',
  'user_characters'
];

export const DEFAULT_SAMPLE_CHARACTERS: Character[] = [
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
    consistencyStrength: 0.9,
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
    id: 'char_buffalo_03',
    name: 'ทุยเพื่อนยาก (Buffalo)',
    gender: 'สัตว์มัสคอต/เพื่อนร่วมเดินทาง',
    age: '5 ปี (ร่างแอนิเมชัน)',
    description: 'ควายไทยหนุ่มแสนใจดี เขาโค้งสวยงาม ดวงตากลมโตอบอุ่น ผิวสีน้ำตาลเข้มมันวาว สวมผ้าพันคอผ้าขาวม้าไทยลายตารางสีแดง มีบุคลิกซื่อสัตย์และกล้าหาญ',
    triggerTag: '(thai_water_buffalo_companion_character:1.3)',
    avatarUrl: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=600&q=80',
    referenceImages: [
      'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=600&q=80'
    ],
    outfitDescription: 'ผ้าขาวม้าผูกคอพื้นบ้านไทยลายตารางสีแดงส้ม และกระพรวนทองเหลืองโบราณ',
    consistencyStrength: 0.95,
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'char_nangnam_04',
    name: 'นางน้ำ / น้องกิ้งก่า (Nang-Nam)',
    gender: 'สิ่งมีชีวิตมหัศจรรย์',
    age: 'เยาว์วัย',
    description: 'กิ้งก่าลายสวยงาม ผิวเกล็ดสีเขียวมรกตเหลือบทอง ดวงตาสีอำพันสดใส เฉลียวฉลาด คอยชี้ทางให้เหล่านักผจญภัยในป่าลึก',
    triggerTag: '(nangnam_mystical_thai_lizard_creature:1.25)',
    avatarUrl: 'https://images.unsplash.com/photo-1568644396922-5c3bfae12521?auto=format&fit=crop&w=600&q=80',
    referenceImages: [
      'https://images.unsplash.com/photo-1568644396922-5c3bfae12521?auto=format&fit=crop&w=600&q=80'
    ],
    outfitDescription: 'สวมมงกุฎดอกพุดซ้อนจิ๋วและสายสร้อยลูกปัดแก้วโบราณ',
    consistencyStrength: 0.92,
    createdAt: new Date(Date.now() - 43200000).toISOString()
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

/**
 * ดึงข้อมูลตัวละครที่ไม่ซ้ำกันตาม ID
 */
export function deduplicateCharacters<T extends { id: string }>(characters: T[]): T[] {
  const uniqueMap = new Map<string, T>();
  for (const char of characters) {
    if (char && char.id && !uniqueMap.has(char.id)) {
      uniqueMap.set(char.id, char);
    }
  }
  return Array.from(uniqueMap.values());
}

/**
 * ดึงรายการตัวละครเฉพาะของผู้ใช้ที่มี UID ที่กำหนด (แยกบัญชีเด็ดขาด)
 */
export function getLocalStorageCharacters(uid?: string): Character[] {
  const currentUid = getActiveUid(uid) || (uid && uid.trim()) || 'guest_user';
  if (typeof window === 'undefined') return [];
  const map = new Map<string, Character>();

  // 1. อ่านจากคีย์เฉพาะของ UID ปัจจุบัน: sala_characters_${currentUid}
  try {
    const raw = localStorage.getItem(`sala_characters_${currentUid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: any) => {
          if (item && item.name && (item.id || item.avatarUrl)) {
            const char: Character = {
              ...item,
              userId: currentUid
            };
            map.set(char.id, char);
          }
        });
      }
    }
  } catch {}

  // 2. ตรวจสอบ legacy keys เฉพาะรายการที่ระบุ userId ตรงกับ currentUid เท่านั้น (ห้ามหยิบของคนอื่นมาเด็ดขาด)
  for (const key of LOCAL_STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item && item.name && (item.userId === currentUid || !item.userId)) {
              map.set(item.id, { ...item, userId: currentUid });
            }
          });
        }
      }
    } catch {}
  }

  const list = Array.from(map.values()).map(normalizeCharacterPersistence);
  return deduplicateCharacters(list);
}

/**
 * บันทึกตัวละครลงใน LocalStorage แยกตาม UID ของผู้ใช้นั้นๆ เสมอ
 */
export function saveCharactersToLocalStorage(chars: Character[], uid?: string): void {
  const currentUid = getActiveUid(uid) || (uid && uid.trim()) || 'guest_user';
  if (typeof window === 'undefined') return;

  const deduped = deduplicateCharacters(chars);
  const scopedChars = deduped.map(c => normalizeCharacterPersistence({ ...c, userId: currentUid }));
  try {
    localStorage.setItem(`sala_characters_${currentUid}`, JSON.stringify(scopedChars));
  } catch (err) {
    console.warn('LocalStorage save failed:', err);
  }
}

/**
 * ดึงตัวละครจาก Firestore โดย Query เฉพาะ UID ของผู้ใช้ปัจจุบันเท่านั้น
 * ทั้งจาก Top-level /characters (where userId == currentUid)
 * และจาก subcollection /users/{currentUid}/characters
 */
export async function fetchCharactersFromFirestore(uid?: string): Promise<Character[]> {
  const currentUid = getActiveUid(uid);
  if (!currentUid) {
    return [];
  }

  // หากโควตาเต็มแล้ว ดึงจากแคช LocalStorage ทันทีโดยไม่ต้องส่ง Request
  if (isFirestoreQuotaExhausted()) {
    return getLocalStorageCharacters(currentUid);
  }

  const charMap = new Map<string, Character>();

  // 1. Query subcollection /users/{currentUid}/characters (Scoped per user)
  try {
    const userCharsCol = collection(db, 'users', currentUid, 'characters');
    const snap = await getDocs(userCharsCol);
    snap.forEach(d => {
      const data = d.data() as Character;
      if (data) {
        charMap.set(d.id, { ...data, id: d.id, userId: currentUid });
      }
    });
  } catch (err: any) {
    if (isQuotaError(err)) {
      setFirestoreQuotaExhausted(err);
      return getLocalStorageCharacters(currentUid);
    }
    console.warn(`Could not read users/${currentUid}/characters:`, err?.message);
  }

  // 2. Query Top-level /characters ด้วย where("userId", "==", currentUid) (Fallback query)
  if (charMap.size === 0 && !isFirestoreQuotaExhausted()) {
    try {
      const q = query(collection(db, 'characters'), where('userId', '==', currentUid));
      const snap = await getDocs(q);
      snap.forEach(d => {
        const data = d.data() as Character;
        if (data && (data.userId === currentUid || !data.userId)) {
          charMap.set(d.id, { ...data, id: d.id, userId: currentUid });
        }
      });
    } catch (err: any) {
      if (isQuotaError(err)) {
        setFirestoreQuotaExhausted(err);
        return getLocalStorageCharacters(currentUid);
      }
      console.warn(`Could not query /characters for UID ${currentUid}:`, err?.message);
    }
  }

  const list = Array.from(charMap.values()).map(normalizeCharacterPersistence);
  return deduplicateCharacters(list);
}

/**
 * Normalizes character persistence fields so that referenceImageUrl,
 * referenceImageId, and imageHash are guaranteed to be present and consistent.
 */
export function normalizeCharacterPersistence(character: Character): Character {
  let referenceImageUrl = character.referenceImageUrl || character.visualProfile?.referenceImageUrl || character.visualProfile?.referenceImage;
  let referenceImageId = character.referenceImageId || character.visualProfile?.referenceImageId || character.referenceMetadata?.referenceImageId;
  let imageHash = character.imageHash || character.visualProfile?.imageHash || character.visualProfileImageHash || character.currentReferenceImageHash || character.referenceMetadata?.imageHash;

  // Fallback to avatarUrl or referenceImages if referenceImageUrl is missing
  if (!referenceImageUrl) {
    if (character.avatarUrl && !character.avatarUrl.startsWith('blob:') && !character.avatarUrl.startsWith('data:image')) {
      referenceImageUrl = character.avatarUrl;
    } else if (character.referenceImages && character.referenceImages.length > 0) {
      const firstValid = character.referenceImages.find(img => !img.startsWith('blob:') && !img.startsWith('data:image'));
      if (firstValid) referenceImageUrl = firstValid;
    }
  }

  // Ensure referenceImages array has referenceImageUrl
  let referenceImages = character.referenceImages ? [...character.referenceImages] : [];
  if (referenceImageUrl && !referenceImages.includes(referenceImageUrl)) {
    referenceImages.unshift(referenceImageUrl);
  }

  // If referenceImageId is missing, generate deterministic one
  if (!referenceImageId) {
    referenceImageId = imageHash ? `ref_${imageHash.slice(0, 10)}` : `ref_${character.id || Date.now()}`;
  }

  const updatedRefMetadata: CharacterReferenceMetadata | undefined = character.referenceMetadata ? {
    ...character.referenceMetadata,
    referenceImageId,
    referenceImageUrl: referenceImageUrl || character.referenceMetadata.referenceImageUrl,
    imageHash: imageHash || character.referenceMetadata.imageHash || character.id || 'hash_default'
  } : (referenceImageUrl || imageHash ? {
    referenceImageId,
    referenceImageUrl,
    imageHash: imageHash || character.id || 'hash_default',
    availableViews: referenceImages.length > 1 ? ['MULTI_VIEWS'] : ['FRONT']
  } : undefined);

  const updatedVisualProfile: CharacterVisualProfile | undefined = character.visualProfile ? {
    ...character.visualProfile,
    referenceImage: referenceImageUrl || character.visualProfile.referenceImage,
    referenceImageUrl: referenceImageUrl || character.visualProfile.referenceImageUrl,
    referenceImageId: referenceImageId || character.visualProfile.referenceImageId,
    imageHash: imageHash || character.visualProfile.imageHash,
    referenceImages: referenceImages.length > 0 ? referenceImages : character.visualProfile.referenceImages
  } : undefined;

  return {
    ...character,
    referenceImageUrl,
    referenceImageId,
    imageHash,
    avatarUrl: referenceImageUrl || character.avatarUrl,
    referenceImages,
    referenceMetadata: updatedRefMetadata,
    visualProfile: updatedVisualProfile,
    currentReferenceImageHash: imageHash || character.currentReferenceImageHash,
    visualProfileImageHash: imageHash || character.visualProfileImageHash
  };
}

/**
 * Compressed copy of a reference image (JPEG data URL, longest side <= 1024 px, <= ~350 KB) that
 * fits inside the Firestore character doc (1 MiB limit). Browser only; '' when not possible.
 */
export async function createReferenceImageBackup(src: string, maxBytes = 350_000): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined' || !src) return '';
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = src;
    });
    for (const [side, quality] of [[1024, 0.82], [768, 0.75], [512, 0.7], [384, 0.6]] as const) {
      const scale = Math.min(1, side / Math.max(img.naturalWidth || side, img.naturalHeight || side));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round((img.naturalWidth || side) * scale));
      canvas.height = Math.max(1, Math.round((img.naturalHeight || side) * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/jpeg', quality);
      if (url.length <= maxBytes) return url;
    }
  } catch (e) {
    console.warn('[createReferenceImageBackup] could not compress reference image:', e);
  }
  return '';
}

/**
 * Uploads a local/base64 character reference image to persistent server storage.
 * If the image is already a persistent URL, it returns the existing URL.
 */
export async function uploadCharacterReferenceImage(imageData: string, customId?: string, imageHash?: string): Promise<{
  referenceImageId: string;
  referenceImageUrl: string;
  imageHash: string;
}> {
  if (!imageData || typeof imageData !== 'string') {
    throw new Error('กรุณาระบุข้อมูลรูปภาพอ้างอิง');
  }

  // If already persistent URL
  if (imageData.startsWith('/uploads/') || imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return {
      referenceImageId: customId || `ref_${Date.now()}`,
      referenceImageUrl: imageData,
      imageHash: imageHash || ''
    };
  }

  // Post to /api/character/upload-reference
  const res = await fetch('/api/character/upload-reference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageData,
      referenceImageId: customId,
      imageHash
    })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'บันทึกรูปภาพอ้างอิงไม่สำเร็จ');
  }

  const result = await res.json();
  return {
    referenceImageId: result.referenceImageId,
    referenceImageUrl: result.referenceImageUrl,
    imageHash: result.imageHash
  };
}

/**
 * บันทึกตัวละคร 1 ตัวลง Firestore พร้อมอัด UID ของผู้ใช้ลงไปเสมอ
 * มีการบันทึกลง LocalStorage เสมอเพื่อความต่อเนื่อง และใช้ safeFirestoreWrite ป้องกันโควตาเต็ม
 */
export async function saveCharacterToFirestore(character: Character, uid?: string): Promise<void> {
  const currentUid = getActiveUid(uid || character.userId);
  if (!currentUid) {
    throw new Error('ไม่พบ Firebase Auth UID ของผู้ใช้ กรุณาเข้าสู่ระบบก่อนบันทึกตัวละคร');
  }

  let normalizedChar = normalizeCharacterPersistence(character);

  // If referenceImageUrl or the first referenceImage is base64 or blob, upload it to persistent storage
  const primaryImg = normalizedChar.referenceImageUrl || normalizedChar.referenceImages?.[0] || normalizedChar.avatarUrl;
  // Durable backup in the Firestore doc (server /uploads is ephemeral): small JPEG data URL
  if (primaryImg && (primaryImg.startsWith('data:image') || primaryImg.startsWith('blob:'))) {
    const backup = await createReferenceImageBackup(primaryImg);
    if (backup) normalizedChar = { ...normalizedChar, referenceImageBackup: backup };
  }
  if (primaryImg && (primaryImg.startsWith('data:image') || primaryImg.startsWith('blob:'))) {
    try {
      // If it's a blob: URL, convert to base64 first
      let uploadPayload = primaryImg;
      if (primaryImg.startsWith('blob:')) {
        const response = await fetch(primaryImg);
        const blob = await response.blob();
        uploadPayload = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      const uploaded = await uploadCharacterReferenceImage(
        uploadPayload,
        normalizedChar.referenceImageId,
        normalizedChar.imageHash
      );

      normalizedChar = normalizeCharacterPersistence({
        ...normalizedChar,
        referenceImageId: uploaded.referenceImageId,
        referenceImageUrl: uploaded.referenceImageUrl,
        imageHash: uploaded.imageHash,
        avatarUrl: uploaded.referenceImageUrl,
        referenceImages: [uploaded.referenceImageUrl, ...(normalizedChar.referenceImages || []).filter(img => !img.startsWith('blob:') && !img.startsWith('data:image'))]
      });
    } catch (uploadErr) {
      console.warn('[saveCharacterToFirestore] Could not upload reference image, keeping existing:', uploadErr);
      // Keep the Firestore doc small: use the compressed backup instead of the full-size data URL
      if (normalizedChar.referenceImageBackup) {
        normalizedChar = normalizeCharacterPersistence({
          ...normalizedChar,
          referenceImageUrl: normalizedChar.referenceImageBackup,
          avatarUrl: normalizedChar.referenceImageBackup,
          referenceImages: [normalizedChar.referenceImageBackup, ...(normalizedChar.referenceImages || []).filter(img => !img.startsWith('blob:') && !img.startsWith('data:image'))]
        });
      }
    }
  }

  // อัด UID ชัดเจนลงใน Character เสมอ
  const payload: Character = {
    ...normalizedChar,
    userId: currentUid,
    updatedAt: new Date().toISOString()
  };

  // 1. บันทึกลง LocalStorage เสมอ ไม่ว่า Firestore จะออนไลน์หรือโควตาเต็ม
  const currentLocal = getLocalStorageCharacters(currentUid);
  const updatedLocal = [payload, ...currentLocal.filter(c => c.id !== payload.id)];
  saveCharactersToLocalStorage(updatedLocal, currentUid);

  // Helper to remove undefined keys which Firestore rejects
  const sanitizeForFirestore = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
    if (typeof obj === 'object') {
      const clean: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (val !== undefined) {
          clean[key] = sanitizeForFirestore(val);
        }
      }
      return clean;
    }
    return obj;
  };

  // 2. บันทึกลง Firestore subcollection /users/{currentUid}/characters/{id} ผ่าน Quota Guard
  try {
    const firestoreData = sanitizeForFirestore(payload);
    await safeFirestoreWrite(async () => {
      await setDoc(doc(db, 'users', currentUid, 'characters', character.id), firestoreData, { merge: true });
    });
  } catch (err: any) {
    console.warn(`[saveCharacterToFirestore] Remote save notice, preserved in LocalStorage:`, err?.message);
  }
}

/**
 * ลบตัวละครจาก Firestore เฉพาะของ UID ปัจจุบัน และลบจาก LocalStorage
 */
export async function deleteCharacterFromFirestore(characterId: string, uid?: string): Promise<void> {
  const currentUid = getActiveUid(uid);

  // 1. ลบจาก LocalStorage ทันที
  if (currentUid) {
    const currentLocal = getLocalStorageCharacters(currentUid);
    saveCharactersToLocalStorage(currentLocal.filter(c => c.id !== characterId), currentUid);
  }

  // 2. ลบจาก Firestore ผ่าน Quota Guard
  if (currentUid) {
    try {
      await safeFirestoreWrite(async () => {
        await deleteDoc(doc(db, 'users', currentUid, 'characters', characterId));
      });
    } catch (err: any) {
      console.warn(`Could not delete /users/${currentUid}/characters/${characterId}:`, err?.message);
    }
  }
}

export interface SyncAuditResult {
  firestoreCount: number;
  localStorageCount: number;
  migratedCount: number;
  characters: Character[];
  message: string;
  status: 'synced_from_firestore' | 'migrated_from_local' | 'empty_both' | 'samples_ready';
}

/**
 * ตรวจสอบความสอดคล้อง ดึงตัวละครจาก Firestore ตาม UID หรือใช้งานตัวละครจาก LocalStorage
 */
export async function checkAndSyncCharacters(uid?: string): Promise<SyncAuditResult> {
  const currentUid = getActiveUid(uid);

  if (!currentUid) {
    return {
      firestoreCount: 0,
      localStorageCount: 0,
      migratedCount: 0,
      characters: [],
      message: 'กรุณาเข้าสู่ระบบเพื่อเข้าถึงและจัดการตัวละครของคุณ',
      status: 'empty_both'
    };
  }

  // ดึงจาก LocalStorage ก่อนเสมอ
  const localChars = getLocalStorageCharacters(currentUid);

  // หากโควตาเต็มแล้ว ให้ใช้ข้อมูลจาก LocalStorage ทันที
  if (isFirestoreQuotaExhausted()) {
    return {
      firestoreCount: 0,
      localStorageCount: localChars.length,
      migratedCount: 0,
      characters: localChars,
      message: `โหลดตัวละครจากเครื่องของคุณสำเร็จ ${localChars.length} ตัว (โหมดออฟไลน์/แคชในเครื่อง)`,
      status: localChars.length > 0 ? 'samples_ready' : 'empty_both'
    };
  }

  // 1. ตรวจสอบใน Firestore ตาม UID เท่านั้น
  const firestoreChars = await fetchCharactersFromFirestore(currentUid);

  console.log(`[Character Sync - UID: ${currentUid}] Firestore: ${firestoreChars.length}, Local: ${localChars.length}`);

  // กรณีที่ 1: มีตัวละครใน Firestore ของ UID นี้
  if (firestoreChars.length > 0) {
    const mergedMap = new Map<string, Character>();
    firestoreChars.forEach(c => mergedMap.set(c.id, { ...c, userId: currentUid }));
    localChars.forEach(c => {
      if (!mergedMap.has(c.id) && c.userId === currentUid) {
        mergedMap.set(c.id, c);
      }
    });

    const allMerged = Array.from(mergedMap.values());
    saveCharactersToLocalStorage(allMerged, currentUid);

    return {
      firestoreCount: firestoreChars.length,
      localStorageCount: localChars.length,
      migratedCount: 0,
      characters: allMerged,
      message: `พบตัวละครของคุณในระบบจำนวน ${firestoreChars.length} ตัว ดึงข้อมูลเรียบร้อยแล้ว`,
      status: 'synced_from_firestore'
    };
  }

  // กรณีที่ 2: ใน Firestore ยังไม่มี แต่ใน LocalStorage ของ UID นี้มี (ไม่ต้อง auto-spam write)
  const customLocalChars = localChars.filter(c => c.name && c.userId === currentUid);
  if (customLocalChars.length > 0) {
    return {
      firestoreCount: 0,
      localStorageCount: customLocalChars.length,
      migratedCount: 0,
      characters: customLocalChars,
      message: `โหลดตัวละครจากเครื่องของคุณ ${customLocalChars.length} ตัว เรียบร้อยแล้ว`,
      status: 'samples_ready'
    };
  }

  // กรณีที่ 3: ยังไม่มีตัวละคร
  return {
    firestoreCount: 0,
    localStorageCount: 0,
    migratedCount: 0,
    characters: [],
    message: 'ยังไม่มีตัวละครในคลังของคุณ กดปุ่มสร้างตัวละครใหม่เพื่อเริ่มต้น',
    status: 'empty_both'
  };
}

/**
 * บังคับย้ายตัวละครจาก LocalStorage ขึ้น Firestore โดยตรงสำหรับ UID ปัจจุบัน
 */
export async function forceMigrateLocalStorageToFirestore(uid?: string): Promise<{
  success: boolean;
  migratedCount: number;
  message: string;
  characters: Character[];
}> {
  const currentUid = getActiveUid(uid);
  if (!currentUid) {
    return {
      success: false,
      migratedCount: 0,
      characters: [],
      message: 'กรุณาเข้าสู่ระบบก่อนทำการซิงก์ข้อมูล'
    };
  }

  const localChars = getLocalStorageCharacters(currentUid);

  if (isFirestoreQuotaExhausted()) {
    return {
      success: false,
      migratedCount: 0,
      characters: localChars,
      message: 'โควตาการเขียนของ Firebase Firestore ประจำวันเต็มชั่วคราว ข้อมูลตัวละครทั้งหมดถูกเก็บรักษาไว้ในเครื่องของคุณเรียบร้อยแล้ว'
    };
  }
  if (localChars.length === 0) {
    return {
      success: true,
      migratedCount: 0,
      characters: [],
      message: 'ไม่พบตัวละครในเครื่องของคุณสำหรับย้ายขึ้น Cloud'
    };
  }

  let migrated = 0;
  for (const char of localChars) {
    try {
      await saveCharacterToFirestore(char, currentUid);
      migrated++;
    } catch (err) {
      console.error('Migration error:', err);
    }
  }

  // ดึงรายการอัปเดตจาก Firestore
  const updated = await fetchCharactersFromFirestore(currentUid);
  const finalList = updated.length > 0 ? updated : localChars;
  saveCharactersToLocalStorage(finalList, currentUid);

  return {
    success: true,
    migratedCount: migrated,
    characters: finalList,
    message: `ย้ายตัวละครของคุณขึ้น Firestore สำเร็จแล้วจำนวน ${migrated} ตัว`
  };
}
