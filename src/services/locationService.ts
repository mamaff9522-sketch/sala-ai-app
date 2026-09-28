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
import {
  LocationItem,
  LocationReferenceMetadata,
  LocationVisualProfile,
  LocationStoryProfile,
  LocationIdentity
} from '../types';
import {
  safeFirestoreWrite,
  isFirestoreQuotaExhausted,
  setFirestoreQuotaExhausted,
  isQuotaError
} from './firestoreGuard';
import { computeImageHash } from '../utils/imageHash';
import { createReferenceImageBackup } from './characterService';

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

// LocalStorage keys for Locations
const LOCAL_STORAGE_LOCATION_KEYS = [
  'sala_locations',
  'sala_custom_locations',
  'locations',
  'sala_location_library',
  'sala_locs',
  'custom_locations',
  'user_locations'
];

/**
 * ข้อมูลสถานที่เริ่มต้นตัวอย่าง (Default Sample Locations)
 * มีครบ 4 เลเยอร์ (Identity, ReferenceMetadata, VisualProfile, StoryProfile)
 * ล็อคแล้ว (LOCKED) และพร้อมนำไปใช้งานใน Multi-Clip Continuity ทันที
 */
export const DEFAULT_SAMPLE_LOCATIONS: LocationItem[] = [
  {
    id: 'loc_modern_living_01',
    name: 'ห้องนั่งเล่นมินิมอลโมเดิร์น (Modern Minimalist Living Room)',
    type: 'LOCATION',
    lockStatus: 'LOCKED',
    imageAnalysisStatus: 'USER_CONFIRMED',
    referenceImageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
    referenceImages: [
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80'
    ],
    referenceImageId: 'ref_loc_living_01',
    imageHash: 'loc_hash_modern_living_88a91c',
    thumbnailUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
    triggerTag: '(location_modern_minimalist_living_room:1.25)',
    identity: {
      id: 'loc_modern_living_01',
      name: 'ห้องนั่งเล่นมินิมอลโมเดิร์น (Modern Minimalist Living Room)'
    },
    referenceMetadata: {
      referenceImageId: 'ref_loc_living_01',
      referenceImageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
      imageHash: 'loc_hash_modern_living_88a91c',
      availableViews: ['WIDE_SHOT', 'CORNER_PERSPECTIVE', 'FURNITURE_LAYOUT'],
      imageAnalysisStatus: 'USER_CONFIRMED'
    },
    visualProfile: {
      environmentType: 'Indoor (ห้องนั่งเล่นหลัก)',
      architecturalStyle: 'Modern Japandi Minimalist',
      wallColor: 'ผนังฉาบปูนเรียบสีเบจอ่อน (Warm off-white) และผนังไม้ระแนงโอ๊คฝั่งขวา',
      floor: 'พื้นไม้ลามิเนตสีโอ๊คอ่อนลายก้างปลา ปูพรมขนสั้นสีเทาเทาโมเดิร์น',
      ceiling: 'เพดานฝ้าหลุมสีขาวซ่อนไฟ warm light สีส้มสลัวพร้อมสปอตไลท์ฝังฝ้า',
      doors: 'ประตูกระจกบานเลื่อนกรอบอลูมิเนียมสีดำด้าน เปิดออกสู่ระเบียง',
      windows: 'หน้าต่างกระจกบานใหญ่ทรงสูงจากพื้นจรดเพดาน รับแสงธรรมชาติทางทิศเหนือ',
      majorFurniture: 'โซฟาผ้าลินินทรงแอลสีเทาอ่อน, โต๊ะกลางไม้โอ๊คกลมมน, โต๊ะวางทีวีบิลท์อินไม้',
      fixedObjects: 'ผนังชั้นหนังสือบิลท์อินแบบไร้มือจับ และตู้ซ่อนสายไฟเรียบเนียน',
      spatialLayout: 'พื้นที่เปิดโล่งเชื่อมต่อกับมุมรับประทานอาหาร ทิศทางแสงส่องเฉียง 45 องศา',
      permanentDecor: 'ภาพวาดศิลปะแอบสแตรกต์โทนสีเอิร์ธโทนขนาดใหญ่ 1 รูป และต้นไทรใบสักในกระถางเซรามิก',
      distinctiveFeatures: 'ช่องแสงส่องกระทบผนังไม้ระแนงเป็นเส้นเฉียง และโคมไฟตั้งพื้นทรงโค้งสีดำด้าน',
      referenceImageUrl: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
      referenceImageId: 'ref_loc_living_01',
      imageHash: 'loc_hash_modern_living_88a91c',
      confidence: 96,
      generatedVisualPrompt: 'Modern Japandi living room, warm beige smooth walls, light oak herringbone wooden flooring, large floor-to-ceiling glass window, L-shaped light grey linen sofa, oak round coffee table, built-in recessed ceiling spotlights with warm ambient lighting'
    },
    storyProfile: {
      storyLocationName: 'ห้องนั่งเล่นคอนโดหรูใจกลางเมือง',
      description: 'สถานที่พักผ่อนและพูดคุยหลักของตัวละครหลัก บรรยากาศเงียบสงบ อบอุ่น และเป็นส่วนตัว',
      notes: 'ใช้เป็นฉากเปิดเรื่องและฉากพูดคุยสำคัญระหว่าง 2 ตัวละคร'
    },
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
  },
  {
    id: 'loc_scifi_deck_02',
    name: 'ห้องควบคุมยานสำรวจอวกาศ (Sci-Fi Command Deck)',
    type: 'LOCATION',
    lockStatus: 'LOCKED',
    imageAnalysisStatus: 'USER_CONFIRMED',
    referenceImageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    referenceImages: [
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80'
    ],
    referenceImageId: 'ref_loc_scifi_02',
    imageHash: 'loc_hash_scifi_deck_99c32f',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    triggerTag: '(location_scifi_spaceship_command_bridge:1.3)',
    identity: {
      id: 'loc_scifi_deck_02',
      name: 'ห้องควบคุมยานสำรวจอวกาศ (Sci-Fi Command Deck)'
    },
    referenceMetadata: {
      referenceImageId: 'ref_loc_scifi_02',
      referenceImageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      imageHash: 'loc_hash_scifi_deck_99c32f',
      availableViews: ['WIDE_ANGLE_DECK', 'PILOT_CONSOLE', 'HOLOGRAPHIC_STATION'],
      imageAnalysisStatus: 'USER_CONFIRMED'
    },
    visualProfile: {
      environmentType: 'Interior Sci-Fi Spaceship Bridge',
      architecturalStyle: 'Futuristic Cybernetic Industrial',
      wallColor: 'แผ่นโลหะไทเทเนียมสีเทาเข้มเนื้อด้าน สลับเส้นไฟนีออนแถบสีฟ้าคราม (Cyan LED Strips)',
      floor: 'แผ่นเหล็กเสริมลายกันลื่นสีเทาคาร์บอน พร้อมไฟนำทางฝังพื้นสีส้มแดง',
      ceiling: 'โครงสร้างเหล็กเปลือยสไตล์โมดูลาร์ พร้อมแผงท่อหล่อเย็นและไฟดาวน์ไลท์สีขาวเย็น 6500K',
      doors: 'ประตูกลไฮดรอลิกแบบเปิดเลื่อนแยกซ้ายขวาสองชั้น พร้อมแผงสแกนลายนิ้วมือ',
      windows: 'กระจกมองยานอวกาศทรงพาโนรามากว้าง 180 องศา เผยให้เห็นห้วงอวกาศและละอองเนบิวลา',
      majorFurniture: 'เก้าอี้กัปตันหนังสีดำปรับเอนได้ตรงกลาง, คอนโซลควบคุม 4 จุดพร้อมจอทัชสกรีนโปร่งแสง',
      fixedObjects: 'แท่นฉายภาพโฮโลแกรมสามมิติขนาดใหญ่ทรงกลมกลางห้อง',
      spatialLayout: 'ทรงเกือกม้า (Horseshoe Layout) พื้นยกระดับ 2 ชั้น กัปตันอยู่ตรงกลางสูงกว่าคอนโซลนักบิน',
      permanentDecor: 'หน้าจอเรดาร์แสดงสถานะการเคลื่อนที่ของยาน และสัญลักษณ์ยานสำรวจศาลาเอไอสีเงิน',
      distinctiveFeatures: 'แสงสะท้อนจากกระจกยานมองเห็นดวงดาวระยิบระยับ และแสงไฟนีออนวิ่งเป็นจังหวะรอบคอนโซล',
      referenceImageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
      referenceImageId: 'ref_loc_scifi_02',
      imageHash: 'loc_hash_scifi_deck_99c32f',
      confidence: 97,
      generatedVisualPrompt: 'Futuristic spaceship bridge command deck, dark matte titanium walls, glowing cyan LED light strips, carbon steel floor with orange guide lights, panoramic 180-degree front viewport showing outer space nebula, holographic globe display in center'
    },
    storyProfile: {
      storyLocationName: 'ยานสำรวจศาลา-1 (Sala-1 Cruiser Bridge)',
      description: 'ศูนย์กลางสั่งการของยานสำรวจ บรรยากาศตึงเครียดแต่เปี่ยมด้วยเทคโนโลยีขั้นสูง',
      notes: 'ใช้ในฉากการเดินทางระหว่างดวงดาวและการสั่งการสำคัญ'
    },
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  },
  {
    id: 'loc_thai_veranda_03',
    name: 'ชานเรือนไม้ไทยริมน้ำ (Traditional Thai Wooden Veranda)',
    type: 'LOCATION',
    lockStatus: 'LOCKED',
    imageAnalysisStatus: 'USER_CONFIRMED',
    referenceImageUrl: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80',
    referenceImages: [
      'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80'
    ],
    referenceImageId: 'ref_loc_thai_03',
    imageHash: 'loc_hash_thai_veranda_77e41b',
    thumbnailUrl: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80',
    triggerTag: '(location_traditional_thai_wooden_waterfront_house:1.25)',
    identity: {
      id: 'loc_thai_veranda_03',
      name: 'ชานเรือนไม้ไทยริมน้ำ (Traditional Thai Wooden Veranda)'
    },
    referenceMetadata: {
      referenceImageId: 'ref_loc_thai_03',
      referenceImageUrl: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80',
      imageHash: 'loc_hash_thai_veranda_77e41b',
      availableViews: ['WIDE_RIVER_VIEW', 'WOODEN_TERRACE', 'ORNATE_EAVES_DETAIL'],
      imageAnalysisStatus: 'USER_CONFIRMED'
    },
    visualProfile: {
      environmentType: 'Semi-outdoor (ชานเรือนเปิดโล่งริมแม่น้ำ)',
      architecturalStyle: 'Traditional Central Thai Wooden Architecture (เรือนไทยภาคกลาง)',
      wallColor: 'ผนังฝาปะกนไม้สักทองสีน้ำตาลอมส้ม เคลือบเงามันวาวตามธรรมชาติ',
      floor: 'ไม้กระดานสักแผ่นใหญ่หน้ากว้าง ขัดมันเงางาม มีร่องระบายน้ำและลมธรรมชาติ',
      ceiling: 'โครงสร้างหลังคาทรงจั่วทรงสูงเปิดเปลือยเห็นขื่อแปไม้สัก แกะสลักลวดลายบัวกลีบขนุน',
      doors: 'ประตูบานเฟี้ยมไม้สักโบราณเปิดพับเก็บข้างผนังได้สุดแนว',
      windows: 'ช่องหน้าต่างซุ้มไม้ฉลุลายโบราณ เปิดรับลมแม่น้ำพัดโชยตลอดวัน',
      majorFurniture: 'ตั่งไม้สักโบราณปูเบาะผ้าไหมลายขิด, หมอนขวานสามเหลี่ยมลายไทยโบราณสีคราม',
      fixedObjects: 'ระเบียงราวลูกกรงไม้สักฉลุลายริมน้ำ พร้อมเสาเอกไม้สักกลึงกลม',
      spatialLayout: 'ชานเรือนเชื่อมระหว่างเรือนนอนและท่าน้ำ มองเห็นแม่น้ำเจ้าพระยายามเย็น',
      permanentDecor: 'กระถางบัวดินเผาเคลือบมรกต, ตะเกียงทองเหลืองโบราณแขวนเสา',
      distinctiveFeatures: 'แสงสะท้อนระลอกคลื่นน้ำระยิบระยับขึ้นบนเพดานไม้สัก และชายคาทรงปั้นหยาแกะสลักประณีต',
      referenceImageUrl: 'https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=800&q=80',
      referenceImageId: 'ref_loc_thai_03',
      imageHash: 'loc_hash_thai_veranda_77e41b',
      confidence: 95,
      generatedVisualPrompt: 'Traditional central Thai wooden house veranda, golden teak wood panel walls, polished wide teak floorboards, high open gable roof with ornate carved brackets, riverside balustrade with tranquil river water reflection, antique brass lanterns'
    },
    storyProfile: {
      storyLocationName: 'เรือนไทยริมสายน้ำอัมพวา',
      description: 'บ้านพักริมน้ำบรรยากาศสงบ ร่มรื่น เต็มไปด้วยกลิ่นอายประวัติศาสตร์และวัฒนธรรมไทย',
      notes: 'เหมาะสำหรับฉากดราม่า พักผ่อน นั่งสมาธิ หรือพบปะพูดคุยเรื่องราวในอดีต'
    },
    createdAt: new Date(Date.now() - 86400000).toISOString()
  }
];

/**
 * ดึงสถานที่จาก LocalStorage ของผู้ใช้ปัจจุบัน
 */
export function getLocalStorageLocations(uid?: string): LocationItem[] {
  const currentUid = getActiveUid(uid) || 'guest_user';
  if (typeof window === 'undefined') return [];

  // 1. ตรวจสอบ Key ประจำ UID ก่อนเสมอ
  try {
    const userKey = `sala_locations_${currentUid}`;
    const raw = localStorage.getItem(userKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse user-specific local locations:', e);
  }

  // 2. Fallback ตรวจสอบ Generic Keys
  for (const key of LOCAL_STORAGE_LOCATION_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = currentUid !== 'guest_user' 
            ? parsed.filter((loc: any) => !loc.userId || loc.userId === currentUid)
            : parsed;
          if (filtered.length > 0) {
            return filtered;
          }
        }
      }
    } catch {}
  }

  // 3. ถ้าว่าง ให้ seed ค่าเริ่มต้น DEFAULT_SAMPLE_LOCATIONS ที่ lockStatus = LOCKED
  const seeded = DEFAULT_SAMPLE_LOCATIONS.map(l => ({ ...l, lockStatus: 'LOCKED' as const }));
  saveLocationsToLocalStorage(seeded, currentUid);
  return seeded;
}

/**
 * บันทึกสถานที่ลง LocalStorage ตาม UID
 */
export function saveLocationsToLocalStorage(locations: LocationItem[], uid?: string): void {
  if (typeof window === 'undefined') return;
  const currentUid = getActiveUid(uid) || 'guest_user';

  try {
    const userKey = `sala_locations_${currentUid}`;
    localStorage.setItem(userKey, JSON.stringify(locations));
    localStorage.setItem('sala_locations', JSON.stringify(locations));
  } catch (e) {
    console.warn('Failed to save locations to local storage:', e);
  }
}

/**
 * ดึงรายการสถานที่ทั้งหมด (Firestore + LocalStorage fallback)
 */
export async function getLocations(uid?: string): Promise<LocationItem[]> {
  const currentUid = getActiveUid(uid) || 'guest_user';
  let localList = getLocalStorageLocations(currentUid);

  if (!localList || localList.length === 0) {
    localList = DEFAULT_SAMPLE_LOCATIONS.map(l => ({ ...l, lockStatus: 'LOCKED' as const }));
    saveLocationsToLocalStorage(localList, currentUid);
  }

  const realUid = getActiveUid(uid);
  if (realUid && !isFirestoreQuotaExhausted()) {
    try {
      const userLocColl = collection(db, 'users', realUid, 'locations');
      const snap = await getDocs(userLocColl);
      if (!snap.empty) {
        const firestoreLocations = snap.docs.map(d => d.data() as LocationItem);
        const map = new Map<string, LocationItem>();
        localList.forEach(l => map.set(l.id, l));
        firestoreLocations.forEach(l => map.set(l.id, l));
        const merged = Array.from(map.values());
        saveLocationsToLocalStorage(merged, realUid);
        return merged;
      }
    } catch (err) {
      console.warn('Could not fetch locations from Firestore, using local:', err);
    }
  }

  return localList;
}

/**
 * บันทึกสถานที่เดี่ยว (Firestore + LocalStorage)
 */
export async function saveLocation(location: LocationItem, uid?: string, opts: { keepLockStatus?: boolean } = {}): Promise<LocationItem> {
  const currentUid = getActiveUid(uid || location.userId) || 'guest_user';
  const normalized = normalizeLocationPersistence(await prepareLocationReference(location));
  normalized.userId = currentUid;
  normalized.lockStatus = opts.keepLockStatus && location.lockStatus ? location.lockStatus : 'LOCKED';

  const localList = getLocalStorageLocations(currentUid);
  const updatedLocal = [normalized, ...localList.filter(l => l.id !== normalized.id)];
  saveLocationsToLocalStorage(updatedLocal, currentUid);

  const realUid = getActiveUid(uid || location.userId);
  if (realUid && !isFirestoreQuotaExhausted()) {
    try {
      await saveLocationToFirestore(normalized, realUid);
    } catch (err) {
      console.warn('Could not save location to Firestore, saved to local:', err);
    }
  }

  return normalized;
}

/**
 * Durable reference photo (same approach as characters):
 * - a compressed JPEG data-URL copy (<= ~350 KB) is stored IN the Firestore doc (referenceImageBackup),
 *   so the photo survives a lost /uploads file (Cloud Run disk is ephemeral);
 * - a raw base64 upload is sent to /api/location/upload-reference; the full-size data URL is never
 *   written to Firestore (docs are limited to 1 MB). If the upload fails, the compressed copy is the URL.
 */
export async function prepareLocationReference(location: LocationItem): Promise<LocationItem> {
  const src = location.referenceImageUrl || location.referenceImages?.[0] || '';
  if (!src || typeof window === 'undefined') return location;
  let backup = location.referenceImageBackup || '';
  if (!backup || src.startsWith('data:')) backup = (await createReferenceImageBackup(src)) || backup;
  let url = src;
  if (src.startsWith('data:')) {
    try {
      url = (await uploadLocationReferenceImage(src, location.referenceImageId, location.imageHash)).referenceImageUrl;
    } catch (e) {
      console.warn('[prepareLocationReference] upload failed, using the compressed copy:', e);
      url = backup;
    }
  }
  if (!url) return location;
  return {
    ...location,
    referenceImageUrl: url,
    referenceImages: [url, ...(location.referenceImages || []).filter(r => r !== src && !String(r).startsWith('data:'))],
    thumbnailUrl: url,
    referenceImageBackup: backup || undefined,
    referenceMetadata: location.referenceMetadata ? { ...location.referenceMetadata, referenceImageUrl: url } : location.referenceMetadata,
    visualProfile: location.visualProfile ? { ...location.visualProfile, referenceImageUrl: url, referenceImage: url, referenceImages: [url] } : location.visualProfile
  };
}

/**
 * ลบสถานที่เดี่ยว (Firestore + LocalStorage)
 */
export async function deleteLocation(locationId: string, uid?: string): Promise<void> {
  const currentUid = getActiveUid(uid) || 'guest_user';
  const localList = getLocalStorageLocations(currentUid);
  const filtered = localList.filter(l => l.id !== locationId);
  saveLocationsToLocalStorage(filtered, currentUid);

  const realUid = getActiveUid(uid);
  if (realUid && !isFirestoreQuotaExhausted()) {
    try {
      await deleteLocationFromFirestore(locationId, realUid);
    } catch (err) {
      console.warn('Could not delete location from Firestore, removed from local:', err);
    }
  }
}

/**
 * ปรับโครงสร้างข้อมูลสถานที่ให้สมบูรณ์ครบ 4 เลเยอร์
 */
export function normalizeLocationPersistence(location: Partial<LocationItem>): LocationItem {
  const id = location.id || `loc_${Date.now()}`;
  const name = location.name || 'สถานที่ใหม่';
  const type: 'LOCATION' = 'LOCATION';

  // Resolve reference images and URLs
  let referenceImageUrl = location.referenceImageUrl || location.referenceImages?.[0] || '';
  let referenceImages = location.referenceImages || (referenceImageUrl ? [referenceImageUrl] : []);
  if (referenceImageUrl && !referenceImages.includes(referenceImageUrl)) {
    referenceImages.unshift(referenceImageUrl);
  }

  const imageHash = location.imageHash || location.referenceMetadata?.imageHash || `loc_hash_${id.slice(-8)}`;
  const referenceImageId = location.referenceImageId || location.referenceMetadata?.referenceImageId || `ref_loc_${id.slice(-8)}`;

  const identity: LocationIdentity = location.identity || {
    id,
    name
  };

  const referenceMetadata: LocationReferenceMetadata = location.referenceMetadata || {
    referenceImageId,
    referenceImageUrl,
    imageHash,
    availableViews: referenceImages.length > 1 ? ['WIDE_SHOT', 'PERSPECTIVE_CORNER'] : ['WIDE_SHOT'],
    imageAnalysisStatus: location.imageAnalysisStatus || 'USER_CONFIRMED'
  };

  const visualProfile: LocationVisualProfile = {
    // Only what the owner / analysis actually gave: never invent set details (they would end up in the Location Lock)
    environmentType: location.visualProfile?.environmentType || '',
    architecturalStyle: location.visualProfile?.architecturalStyle || '',
    wallColor: location.visualProfile?.wallColor || '',
    floor: location.visualProfile?.floor || '',
    ceiling: location.visualProfile?.ceiling || '',
    doors: location.visualProfile?.doors || '',
    windows: location.visualProfile?.windows || '',
    majorFurniture: location.visualProfile?.majorFurniture || '',
    fixedObjects: location.visualProfile?.fixedObjects || '',
    spatialLayout: location.visualProfile?.spatialLayout || '',
    permanentDecor: location.visualProfile?.permanentDecor || '',
    distinctiveFeatures: location.visualProfile?.distinctiveFeatures || '',
    referenceImage: referenceImageUrl,
    referenceImages,
    referenceImageId,
    referenceImageUrl,
    imageHash,
    confidence: location.visualProfile?.confidence ?? 95,
    generatedVisualPrompt: location.visualProfile?.generatedVisualPrompt || ''
  };

  const storyProfile: LocationStoryProfile = {
    storyLocationName: location.storyProfile?.storyLocationName || name,
    description: location.storyProfile?.description || location.lockDescription || '',
    notes: location.storyProfile?.notes || ''
  };

  return {
    id,
    name,
    type,
    userId: location.userId,
    identity,
    referenceMetadata,
    visualProfile,
    storyProfile,
    lockStatus: location.lockStatus || 'LOCKED',
    imageAnalysisStatus: location.imageAnalysisStatus || 'USER_CONFIRMED',
    referenceImages,
    referenceImageId,
    referenceImageUrl,
    imageHash,
    thumbnailUrl: referenceImageUrl || location.thumbnailUrl,
    triggerTag: location.triggerTag || `(location_${name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}:1.25)`,
    ...(location.lockDescription ? { lockDescription: location.lockDescription } : {}),
    ...(location.referenceImageBackup ? { referenceImageBackup: location.referenceImageBackup } : {}),
    ...(location.version ? { version: location.version } : {}),
    createdAt: location.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Upload reference image to server storage
 */
export async function uploadLocationReferenceImage(
  imageData: string,
  customId?: string,
  imageHash?: string
): Promise<{
  referenceImageId: string;
  referenceImageUrl: string;
  imageHash: string;
}> {
  if (!imageData || typeof imageData !== 'string') {
    throw new Error('กรุณาระบุข้อมูลรูปภาพอ้างอิงสถานที่');
  }

  if (imageData.startsWith('/uploads/') || imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return {
      referenceImageId: customId || `ref_loc_${Date.now()}`,
      referenceImageUrl: imageData,
      imageHash: imageHash || ''
    };
  }

  const res = await fetch('/api/location/upload-reference', {
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
    throw new Error(errorData.message || 'บันทึกรูปภาพสถานที่อ้างอิงไม่สำเร็จ');
  }

  const result = await res.json();
  return {
    referenceImageId: result.referenceImageId,
    referenceImageUrl: result.referenceImageUrl,
    imageHash: result.imageHash
  };
}

/**
 * บันทึกสถานที่ลง Firestore และ LocalStorage ตาม UID
 */
export async function saveLocationToFirestore(location: LocationItem, uid?: string): Promise<void> {
  const currentUid = getActiveUid(uid || location.userId);
  if (!currentUid) {
    throw new Error('ไม่พบ Firebase Auth UID ของผู้ใช้ กรุณาเข้าสู่ระบบก่อนบันทึกสถานที่');
  }

  const normalizedLoc = normalizeLocationPersistence(location);
  normalizedLoc.userId = currentUid;

  // 1. บันทึกลง LocalStorage เสมอก่อนเพื่อความต่อเนื่องในกรณีออฟไลน์/โควตา
  const localList = getLocalStorageLocations(currentUid);
  const updatedLocal = [normalizedLoc, ...localList.filter(l => l.id !== normalizedLoc.id)];
  saveLocationsToLocalStorage(updatedLocal, currentUid);

  // 2. ถ้าโควตา Firestore เต็ม ให้ข้ามการเขียนเครือข่าย
  if (isFirestoreQuotaExhausted()) {
    console.warn('Firestore quota already exhausted. Location saved to LocalStorage safely.');
    return;
  }

  // 3. บันทึกลง Firestore Subcollection: users/{uid}/locations/{locationId}
  try {
    await safeFirestoreWrite(async () => {
      const userLocRef = doc(db, 'users', currentUid, 'locations', normalizedLoc.id);
      await setDoc(userLocRef, normalizedLoc, { merge: true });
    });
  } catch (err: any) {
    console.warn('Failed to write location to users/{uid}/locations, trying fallback top-level:', err);
    try {
      await safeFirestoreWrite(async () => {
        const topLocRef = doc(db, 'locations', normalizedLoc.id);
        await setDoc(topLocRef, normalizedLoc, { merge: true });
      });
    } catch (topErr: any) {
      if (isQuotaError(topErr)) {
        setFirestoreQuotaExhausted();
      }
      console.warn('Could not save location to Firestore top-level either:', topErr);
    }
  }
}

/**
 * ลบสถานที่ออกจาก Firestore และ LocalStorage
 */
export async function deleteLocationFromFirestore(locationId: string, uid?: string): Promise<void> {
  const currentUid = getActiveUid(uid);
  if (typeof window !== 'undefined' && currentUid) {
    const local = getLocalStorageLocations(currentUid);
    const filtered = local.filter(l => l.id !== locationId);
    saveLocationsToLocalStorage(filtered, currentUid);
  }

  if (currentUid && !isFirestoreQuotaExhausted()) {
    try {
      await safeFirestoreWrite(async () => {
        const userLocRef = doc(db, 'users', currentUid, 'locations', locationId);
        await deleteDoc(userLocRef);
      });
    } catch (err) {
      console.warn('Error deleting location from user subcollection:', err);
    }

    try {
      await safeFirestoreWrite(async () => {
        const topLocRef = doc(db, 'locations', locationId);
        await deleteDoc(topLocRef);
      });
    } catch {}
  }
}

/**
 * ตรวจสอบและซิงก์สถานที่ระหว่าง Firestore และ LocalStorage
 */
export async function checkAndSyncLocations(uid: string): Promise<{
  firestoreCount: number;
  localStorageCount: number;
  migratedCount: number;
  message: string;
}> {
  const currentUid = getActiveUid(uid);
  if (!currentUid) {
    return {
      firestoreCount: 0,
      localStorageCount: 0,
      migratedCount: 0,
      message: 'ไม่พบ UID ของผู้ใช้'
    };
  }

  const localLocations = getLocalStorageLocations(currentUid);
  let firestoreLocations: LocationItem[] = [];

  if (!isFirestoreQuotaExhausted()) {
    try {
      const userLocColl = collection(db, 'users', currentUid, 'locations');
      const snap = await getDocs(userLocColl);
      firestoreLocations = snap.docs.map(d => d.data() as LocationItem);
    } catch (err) {
      console.warn('Could not fetch user locations from Firestore subcollection:', err);
    }
  }

  let migratedCount = 0;
  // If Firestore has items, merge them into local storage
  if (firestoreLocations.length > 0) {
    const firestoreMap = new Map<string, LocationItem>();
    firestoreLocations.forEach(l => firestoreMap.set(l.id, l));
    localLocations.forEach(l => {
      if (!firestoreMap.has(l.id)) {
        firestoreMap.set(l.id, l);
      }
    });
    const merged = Array.from(firestoreMap.values());
    saveLocationsToLocalStorage(merged, currentUid);
  } else if (localLocations.length > 0 && !isFirestoreQuotaExhausted()) {
    // Migrate local to firestore
    for (const loc of localLocations) {
      try {
        await saveLocationToFirestore(loc, currentUid);
        migratedCount++;
      } catch {}
    }
  }

  return {
    firestoreCount: firestoreLocations.length,
    localStorageCount: getLocalStorageLocations(currentUid).length,
    migratedCount,
    message: `ซิงก์ข้อมูลสถานที่สำเร็จ (คลาวด์: ${firestoreLocations.length}, เครื่องนี้: ${getLocalStorageLocations(currentUid).length})`
  };
}

/**
 * บังคับย้ายข้อมูลสถานที่จาก LocalStorage ขึ้น Firestore
 */
export async function forceMigrateLocalStorageToFirestore(uid?: string): Promise<{
  success: boolean;
  migratedCount: number;
  message: string;
}> {
  const currentUid = getActiveUid(uid);
  if (!currentUid) {
    return {
      success: false,
      migratedCount: 0,
      message: 'ไม่พบ UID ผู้ใช้ กรุณาเข้าสู่ระบบก่อน'
    };
  }

  const localLocations = getLocalStorageLocations(currentUid);
  if (localLocations.length === 0) {
    return {
      success: true,
      migratedCount: 0,
      message: 'ไม่มีสถานที่ในเครื่องที่ต้องย้าย'
    };
  }

  let successCount = 0;
  for (const loc of localLocations) {
    try {
      await saveLocationToFirestore(loc, currentUid);
      successCount++;
    } catch (err) {
      console.warn('Failed to migrate location:', loc.id, err);
    }
  }

  return {
    success: successCount > 0,
    migratedCount: successCount,
    message: `ย้ายข้อมูลสถานที่ขึ้น Cloud สำเร็จ ${successCount} รายการ`
  };
}
