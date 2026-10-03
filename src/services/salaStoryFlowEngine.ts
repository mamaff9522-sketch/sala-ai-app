/**
 * Sala Story Flow Engine (ระบบจัดการเนื้อเรื่องเต็ม & การวิเคราะห์ดึงฉากอัตโนมัติ)
 *
 * ทำหน้าที่ตามข้อกำหนด 6 ข้ออย่างเคร่งครัด:
 * 1. รับเนื้อเรื่องเต็ม (Full Story Source of Truth) จากหน้าแรก
 * 2. AI อ่านและจดจำเนื้อเรื่องเต็มทั้งหมด ทั้งเนื้อเรื่อง ลำดับเหตุการณ์ การกระทำ คำบรรยาย และบทพูด
 *    (ไม่สร้างหรือดึงข้อมูล Character Lock จากช่องนี้)
 * 3. วิเคราะห์จุดเปลี่ยนสถานที่ (Location Transition Analysis) และดึง "ฉากแรก" มาใส่ช่อง Story อัตโนมัติ
 * 4. ในสถานที่เดียวกัน ให้ Story เดินเรื่องต่อเนื่องจนหมดช่วงนั้น ไม่จำกัดจำนวนคลิป
 *    คำบรรยายการกระทำต้องถูกแปลงเป็นภาพและ Action ของตัวละครจริง ไม่ใช่เสียงบรรยาย
 *    และถ้ามีบทพูดให้ใช้บทพูดตามต้นฉบับ
 * 5. เมื่อเนื้อเรื่องกำลังเปลี่ยนไปสถานที่ใหม่ ให้หยุดทันที ห้ามดึงฉากถัดไปเอง
 *    รอผู้ใช้กด “เดินเรื่องต่อไป” แล้วจึงดึงฉากสถานที่ถัดไปจากเนื้อเรื่องเต็มเข้า Story
 * 6. รักษาข้อมูล Story, ตัวละคร, รูปอ้างอิง และ Lock ทั้งหมดไว้เมื่อเปลี่ยนหน้า ปิดแอป หรือเปิดใหม่
 *    ห้ามหายเอง ไม่ใช่ล็อกถาวร ให้ล้างเมื่อผู้ใช้กดลบเองหรือวาง “เนื้อเรื่องเต็มใหม่” แทนเรื่องเดิมเท่านั้น
 */

import { parseStoryStructure, UNSPECIFIED } from './storyEpisodeEngine';
import { extractVerbatimScriptQuotes } from './salaDirectorEngine';

export interface LocationSceneSegment {
  segmentIndex: number;
  locationName: string;
  timeOfDay: string;
  sceneRange: string;
  scenes: AnalyzedStoryScene[];
  scriptText: string;
}

export interface AnalyzedStoryScene {
  sceneIndex: number;
  originalHeading: string;
  location: string;
  timeOfDay: string;
  actionText: string;
  dialogues: Array<{
    speaker: string;
    emotionOrAction: string;
    dialogue: string;
  }>;
  charactersInvolved: string[];
}

export interface StoryFlowAnalysisResult {
  storyText: string;
  totalScenesCount: number;
  segments: LocationSceneSegment[];
  currentSegmentIndex: number;
  currentSegment: LocationSceneSegment | null;
  hasNextLocation: boolean;
  nextLocationName: string | null;
  isCompleted: boolean;
}

const STORAGE_KEY_FULL_STORY = 'sala_full_story_source';
const STORAGE_KEY_FLOW_STATE = 'sala_story_flow_state';

/**
 * ทำความสะอาดชื่อสถานที่ให้เป็นชื่อหลัก
 */
function cleanLocationName(raw: string): string {
  if (!raw || raw === UNSPECIFIED) return 'สถานที่ตามเนื้อเรื่อง';
  return raw
    .replace(/^([ฉากที่\s\d.:\-]+)/, '')
    .replace(/(ยามเช้า|ยามเย็น|กลางคืน|กลางวัน|ตอนค่ำ|รุ่งเช้า|พลบค่ำ|ดึก|night|day|morning|evening)/gi, '')
    .replace(/[,\-–—:：]/g, ' ')
    .trim() || 'สถานที่ตามเนื้อเรื่อง';
}

/**
 * ตัดแบ่งเนื้อเรื่องเต็มออกเป็นฉากๆ และจัดกลุ่มตาม "สถานที่เดียวกัน"
 */
export function analyzeStoryLocationSegments(fullStory: string): LocationSceneSegment[] {
  if (!fullStory || !fullStory.trim()) return [];

  const parsed = parseStoryStructure(fullStory);
  const rawScenes = parsed.scenes;
  const quotes = extractVerbatimScriptQuotes(fullStory);

  const analyzedScenes: AnalyzedStoryScene[] = [];

  if (rawScenes.length > 0) {
    // โครงเรื่องมีหัวข้อ "ฉากที่ N"
    rawScenes.forEach((sc, idx) => {
      const actions = sc.beats.filter(b => b.type === 'action').map(b => b.text.trim()).filter(Boolean);
      const actionText = actions.join('\n');
      const dlgs = sc.beats
        .filter(b => b.type === 'dialogue' && b.dialogue)
        .map(b => ({
          speaker: b.dialogue!.speaker,
          emotionOrAction: b.dialogue!.emotionOrAction || 'สมจริงตามสถานการณ์',
          dialogue: b.dialogue!.dialogue
        }));

      // ดึงตัวละครที่เกี่ยวข้องในฉากนี้
      const charsInvolved = Array.from(new Set([
        ...dlgs.map(d => d.speaker),
        ...parsed.characters.filter(c => actionText.includes(c.name)).map(c => c.name)
      ]));

      analyzedScenes.push({
        sceneIndex: sc.sceneNumber || idx + 1,
        originalHeading: sc.heading || `ฉากที่ ${idx + 1}: ${sc.location || 'สถานที่ตามเนื้อเรื่อง'}`,
        location: cleanLocationName(sc.location || parsed.metadata['สถานที่'] || 'สถานที่ตามเนื้อเรื่อง'),
        timeOfDay: sc.timeOfDay && sc.timeOfDay !== UNSPECIFIED ? sc.timeOfDay : (parsed.metadata['เวลา'] || 'กลางวัน'),
        actionText,
        dialogues: dlgs,
        charactersInvolved: charsInvolved
      });
    });
  } else {
    // กรณีเนื้อเรื่องเป็นเรื่องเล่าร้อยแก้วยาวๆ ไม่มีหัวข้อฉาก
    // ใช้ย่อหน้า หรือการเปลี่ยนสถานที่ในการจัดฉาก
    const paragraphs = fullStory
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    let currentLocation = cleanLocationName(parsed.metadata['สถานที่'] || 'ฉากเปิดเรื่อง');
    let currentTime = parsed.metadata['เวลา'] || 'กลางวัน';

    paragraphs.forEach((para, idx) => {
      // ตรวจสอบว่าในย่อหน้ามีคำบอกสถานที่ใหม่หรือไม่
      const locMatch = para.match(/(ณ|ที่|บริเวณ|ภายใน|ด้านหน้า|ในห้อง|ริม)\s*([ก-๙a-zA-Z0-9_\- ]{3,30})/);
      if (locMatch && idx > 0) {
        currentLocation = cleanLocationName(locMatch[0]);
      }

      // ดึงบทพูดในย่อหน้า
      const dlgs: Array<{ speaker: string; emotionOrAction: string; dialogue: string }> = [];
      const quoteMatches = para.matchAll(/([ก-๙a-zA-Z0-9_\- ]{2,25})[:：]\s*["“'‘«「]([^"”'’»」]+)["”'’»」]/g);
      for (const m of quoteMatches) {
        dlgs.push({
          speaker: m[1].trim(),
          emotionOrAction: 'เป็นธรรมชาติ',
          dialogue: m[2].trim()
        });
      }

      const charsInvolved = Array.from(new Set([
        ...dlgs.map(d => d.speaker),
        ...parsed.characters.filter(c => para.includes(c.name)).map(c => c.name)
      ]));

      analyzedScenes.push({
        sceneIndex: idx + 1,
        originalHeading: `ฉากที่ ${idx + 1}: ${currentLocation} - ${currentTime}`,
        location: currentLocation,
        timeOfDay: currentTime,
        actionText: para,
        dialogues: dlgs,
        charactersInvolved: charsInvolved
      });
    });
  }

  if (analyzedScenes.length === 0) return [];

  // จัดกลุ่มฉากตาม "สถานที่เดียวกัน" (Location Grouping)
  const segments: LocationSceneSegment[] = [];
  let currentLoc = analyzedScenes[0].location;
  let currentGroup: AnalyzedStoryScene[] = [];

  const flushGroup = () => {
    if (currentGroup.length === 0) return;
    const startNum = currentGroup[0].sceneIndex;
    const endNum = currentGroup[currentGroup.length - 1].sceneIndex;
    const rangeText = startNum === endNum ? `ฉากที่ ${startNum}` : `ฉากที่ ${startNum} - ${endNum}`;
    
    // แปลงกลุ่มฉากในสถานที่นี้ให้อยู่ในฟอร์แมตบทสำหรับส่งเข้า Story
    const scriptLines: string[] = [];
    currentGroup.forEach(sc => {
      scriptLines.push(`[${sc.originalHeading}]`);
      if (sc.actionText) {
        scriptLines.push(sc.actionText);
      }
      sc.dialogues.forEach(d => {
        scriptLines.push(`${d.speaker}: "${d.dialogue}"`);
      });
      scriptLines.push('');
    });

    segments.push({
      segmentIndex: segments.length + 1,
      locationName: currentLoc,
      timeOfDay: currentGroup[0].timeOfDay,
      sceneRange: rangeText,
      scenes: [...currentGroup],
      scriptText: scriptLines.join('\n').trim()
    });
    currentGroup = [];
  };

  analyzedScenes.forEach(scene => {
    if (scene.location !== currentLoc && currentGroup.length > 0) {
      flushGroup();
      currentLoc = scene.location;
    }
    currentGroup.push(scene);
  });
  flushGroup();

  return segments;
}

/**
 * โหลดเนื้อเรื่องเต็มที่บันทึกไว้ใน LocalStorage
 */
export function getSavedFullStory(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY_FULL_STORY) || '';
}

/**
 * บันทึกเนื้อเรื่องเต็มลง LocalStorage
 */
export function saveFullStory(text: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_FULL_STORY, text);
}

/**
 * ลบเนื้อเรื่องเต็มเมื่อผู้ใช้กดลบเอง
 */
export function clearFullStory(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_FULL_STORY);
  localStorage.removeItem(STORAGE_KEY_FLOW_STATE);
}

/**
 * ดึงสถานะการเดินเรื่องปัจจุบัน
 */
export function getStoryFlowState(): { segmentIndex: number } {
  if (typeof localStorage === 'undefined') return { segmentIndex: 1 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FLOW_STATE);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { segmentIndex: 1 };
}

/**
 * บันทึกสถานะการเดินเรื่อง
 */
export function saveStoryFlowState(segmentIndex: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_FLOW_STATE, JSON.stringify({ segmentIndex }));
}
