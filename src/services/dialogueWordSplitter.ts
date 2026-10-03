/**
 * DIALOGUE 20-WORD SPLIT SYSTEM (ระบบแบ่งบทพูดไม่เกิน 20 คำต่อคลิป)
 *
 * ข้อกำหนดและกฎเหล็ก:
 * 1. ถ้าบทพูดของตัวละครยาวเกิน 20 คำ ให้ตัดเฉพาะบทพูดส่วนที่เกินไปต่อในคลิปถัดไปอัตโนมัติ
 * 2. ห้ามตัดคำกลางประโยคแบบเสียความหมาย (ตัดที่จุดจบประโยค เครื่องหมายวรรคตอน หรือขอบเขตคำ)
 * 3. ห้ามแก้ ห้ามย่อ ห้ามแต่งบทพูดเพิ่ม (รักษาข้อความต้นฉบับเดิมทุกประโยค)
 * 4. ต้องรักษาผู้พูดคนเดิมในทุกคลิปต่อเนื่อง
 * 5. Action/Narration ก่อนและหลังบทพูดต้องคงตำแหน่งเดิม
 * 6. คลิปถัดไปต้องต่อเนื่องจาก END คลิปก่อนหน้า ทั้งท่าทาง ตำแหน่ง สีหน้า กล้อง ฉาก เวลา และเสียง
 * 7. ถ้าช่วงใดไม่มี Dialogue ให้ใช้ STRICT SILENCE PROTOCOL และห้ามตัวละครพูดเอง
 * 8. ทำซ้ำจนกว่าบทพูดทั้งหมดจะครบ
 * 9. ห้ามลบหรือเปลี่ยนระบบเดิม ให้เพิ่มระบบนี้เข้าโปรเจกต์เดิมเท่านั้น
 */

import { DirectedClipItem, DialogueLockEntry, DialogueCameraAngle } from '../types';
import { removeSections } from './promptSections';

export const MAX_DIALOGUE_WORDS_PER_CLIP = 20;

/**
 * ลบบทพูดยาวเต็มประโยค (Full Dialogue Text) ออกจากต้นพรอมต์และเนื้อหาพรอมต์อย่างหมดจด
 * เพื่อป้องกันปัญหาบทพูดซ้ำซ้อนในคลิปที่ถูกตัดแบ่งบทพูด (Dialogue Split Parts)
 * และบังคับให้แสดงเฉพาะประโยคย่อยที่ตัดแบ่งแล้ว (Part 1/N) ของคลิปนั้น ๆ เพียงจุดเดียว
 */
export function stripFullDialogueFromPrompt(
  prompt: string,
  fullDialogueText: string,
  speaker?: string
): string {
  if (!prompt) return '';
  let p = prompt;

  // 1. ลบส่วน Dialogue: เดิมทั้งหมดออกจากพรอมต์
  const removed = removeSections(p, s => s.label === 'Dialogue');
  p = removed.prompt;

  // ลบส่วน Dialogue: ที่อาจไม่ตรงกับ label มาตรฐาน หรือต่อท้ายด้วย newline
  p = p.replace(/(?:,?\s*\[DIALOGUE 20-WORD SPLIT[^\]]*\])?\s*Dialogue:\s*[\s\S]*?(?=(?:Outro momentum|Starting moment|Ending momentum|Core action|Architectural Environment|Character Lock|Spatial Positioning Lock|Negative Prompt|Negative:|$))/gi, '');
  p = p.replace(/\[DIALOGUE 20-WORD SPLIT[^\]]*\]/gi, '');

  if (!fullDialogueText || !fullDialogueText.trim()) {
    return p.replace(/\s{2,}/g, ' ').replace(/\.{2,}/g, '.').trim();
  }

  const cleanFull = fullDialogueText.replace(/^["“'‘«「]+|["”'’»」]+$/g, '').trim();
  const escapedFull = cleanFull.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSpeaker = speaker ? speaker.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';

  // 2. ลบกรณีมีชื่อผู้พูดนำหน้าบทพูดเต็ม เช่น "น้องฟ้าใส: "..." หรือ "น้องฟ้าใสพูดว่า "..."" โดยเฉพาะที่ต้นพรอมต์
  if (escapedSpeaker) {
    const speakerPrefixRegex = new RegExp(
      `(?:^|[\\s.,;]+)(?:\\[[^\\]]*\\]\\s*)?${escapedSpeaker}\\s*(?:กล่าวว่า|พูดว่า|กระซิบว่า|บอกว่า|ตะโกนว่า|ถามว่า|speaks?:?|:)?\\s*["“'‘«「]?${escapedFull}["”'’»」]?[.,;]?`,
      'gi'
    );
    p = p.replace(speakerPrefixRegex, ' ');
  }

  // 3. ลบกรณีมีคำกริยาพูดนำหน้า เช่น "พูดว่า "..."" หรือ "speaks: "...""
  const verbPrefixRegex = new RegExp(
    `(?:กล่าวว่า|พูดว่า|กระซิบว่า|บอกว่า|ตะโกนว่า|ถามว่า|speaks?:?)\\s*["“'‘«「]?${escapedFull}["”'’»」]?[.,;]?`,
    'gi'
  );
  p = p.replace(verbPrefixRegex, ' ');

  // 4. ลบข้อความบทพูดเต็มในเครื่องหมายคำพูด
  const quotedRegex = new RegExp(`["“'‘«「]${escapedFull}["”'’»」]`, 'gi');
  p = p.replace(quotedRegex, ' ');

  // 5. ลบข้อความบทพูดเต็มแบบไม่มีเครื่องหมายคำพูด (ถ้ายังหลงเหลืออยู่ในเนื้อหาพรอมต์)
  const bareRegex = new RegExp(escapedFull, 'gi');
  p = p.replace(bareRegex, ' ');

  // 6. ทำความสะอาดช่องว่างและเครื่องหมายวรรคตอนที่ซ้ำซ้อน
  p = p
    .replace(/["“'‘«「]\s*["”'’»」]/g, '')
    .replace(/\bDialogue:\s*NONE\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.:;])/g, '$1')
    .replace(/\.{2,}/g, '.')
    .replace(/,\s*,/g, ',')
    .replace(/(?:^[.,;\s]+|[.,;\s]+$)/g, '')
    .trim();

  return p;
}

/**
 * นับจำนวนคำอย่างแม่นยำ รองรับทั้งภาษาไทยและภาษาอังกฤษ
 */
export function countDialogueWords(text: string): number {
  if (!text || !text.trim()) return 0;
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    try {
      const seg = new (Intl as any).Segmenter(['th', 'en'], { granularity: 'word' });
      const count = Array.from(seg.segment(text)).filter((s: any) => s.isWordLike).length;
      if (count > 0) return count;
    } catch {}
  }
  // Fallback tokenizer: split by spaces and Thai syllable pattern approximations
  const whitespaceWords = text.trim().split(/\s+/).filter(Boolean);
  // If Thai text without spaces, estimate roughly ~4-5 characters per Thai word
  const thaiChars = (text.match(/[\u0E00-\u0E7F]/g) || []).length;
  if (whitespaceWords.length <= 1 && thaiChars > 15) {
    return Math.ceil(thaiChars / 4.5);
  }
  return whitespaceWords.length;
}

/**
 * แยกบทพูดที่ยาวเกิน 20 คำออกเป็นท่อนๆ โดยไม่ตัดคำกลางประโยค และไม่แก้หรือย่อข้อความ
 */
export function splitDialogueTextAt20Words(text: string, maxWords: number = MAX_DIALOGUE_WORDS_PER_CLIP): string[] {
  if (!text || !text.trim()) return [];
  const clean = text.trim();
  const totalWords = countDialogueWords(clean);
  if (totalWords <= maxWords) {
    return [clean];
  }

  // ใช้ Intl.Segmenter เพื่อระบุขอบเขตคำและเครื่องหมายวรรคตอน
  if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
    try {
      const seg = new (Intl as any).Segmenter(['th', 'en'], { granularity: 'word' });
      const segments: Array<{ segment: string; index: number; input: string; isWordLike?: boolean }> = Array.from(seg.segment(clean));
      const chunks: string[] = [];
      let startSegIdx = 0;

      while (startSegIdx < segments.length) {
        // สะสมคำจาก startSegIdx จนถึง maxWords
        const currentWordsIndices: number[] = [];
        let endSegIdx = startSegIdx;

        for (let i = startSegIdx; i < segments.length; i++) {
          if (segments[i].isWordLike) {
            if (currentWordsIndices.length >= maxWords) {
              break;
            }
            currentWordsIndices.push(i);
          }
          endSegIdx = i;
        }

        // ถ้าที่เหลือทั้งหมดไม่เกิน maxWords แล้ว ให้ใส่ท่อนสุดท้าย
        if (endSegIdx >= segments.length - 1) {
          const remainingText = segments.slice(startSegIdx).map(s => s.segment).join('').trim();
          if (remainingText) chunks.push(remainingText);
          break;
        }

        // ค้นหาจุดตัดที่ธรรมชาติที่สุด (เครื่องหมายวรรคตอน หรือช่องว่าง)
        let cutPoint = -1;

        // ลำดับที่ 1: ค้นหาย้อนหลังจาก endSegIdx ลงมาหาเครื่องหมายวรรคตอน หรือช่องว่าง
        for (let j = endSegIdx; j >= startSegIdx; j--) {
          const segText = segments[j].segment;
          const wordsBefore = currentWordsIndices.filter(wIdx => wIdx <= j).length;
          // ตัดที่เครื่องหมายวรรคตอนหรือช่องว่าง เมื่อมีคำสะสมแล้วอย่างน้อย 5 คำ
          if (wordsBefore >= 5 && wordsBefore <= maxWords && /[.,!?;:\n\s…—\-\u201C\u201D"']/.test(segText)) {
            cutPoint = j;
            break;
          }
        }

        // ลำดับที่ 2: ถ้าไม่พบวรรคตอน ให้ตัดที่ขอบคำตัวสุดท้ายก่อนเกิน 20 คำ
        if (cutPoint === -1) {
          cutPoint = endSegIdx;
        }

        const chunkText = segments.slice(startSegIdx, cutPoint + 1).map(s => s.segment).join('').trim();
        if (chunkText) {
          chunks.push(chunkText);
        }

        startSegIdx = cutPoint + 1;
        // ข้ามช่องว่างนำหน้าในท่อนถัดไป
        while (startSegIdx < segments.length && !segments[startSegIdx].isWordLike && /^\s+$/.test(segments[startSegIdx].segment)) {
          startSegIdx++;
        }
      }

      if (chunks.length > 0) {
        return chunks;
      }
    } catch {}
  }

  // Fallback splitter สำหรับกรณีไม่มี Intl.Segmenter
  const words = clean.split(/\s+/).filter(Boolean);
  const fallbackChunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    fallbackChunks.push(words.slice(i, i + maxWords).join(' '));
  }
  return fallbackChunks;
}

/**
 * ตรวจสอบว่าในคลิปหรือรายการบทพูด มีประโยคใดยาวเกิน 20 คำหรือไม่
 */
export function hasDialogueExceeding20Words(dialogues: DialogueLockEntry[]): boolean {
  if (!dialogues || dialogues.length === 0) return false;
  return dialogues.some(d => countDialogueWords(d.line) > MAX_DIALOGUE_WORDS_PER_CLIP);
}

/**
 * แยกรายการ DialogueLockEntry: ถ้าบทพูดของผู้พูดยาวเกิน 20 คำ
 * จะแตกเป็นหลาย DialogueLockEntry โดยรักษาผู้พูดคนเดิมและอารมณ์เดิม
 */
export function splitDialogueEntryList(dialogues: DialogueLockEntry[]): DialogueLockEntry[] {
  if (!dialogues || dialogues.length === 0) return [];
  const result: DialogueLockEntry[] = [];

  dialogues.forEach(entry => {
    const wordsCount = countDialogueWords(entry.line);
    if (wordsCount <= MAX_DIALOGUE_WORDS_PER_CLIP) {
      result.push(entry);
    } else {
      const parts = splitDialogueTextAt20Words(entry.line, MAX_DIALOGUE_WORDS_PER_CLIP);
      parts.forEach((partText, pIdx) => {
        result.push({
          ...entry,
          id: `${entry.id}_part_${pIdx + 1}`,
          line: partText,
          speaker: entry.speaker, // รักษาผู้พูดคนเดิม 100%
          emotionTone: entry.emotionTone || 'ตามบทต้นฉบับ',
          clipNumber: entry.clipNumber
        });
      });
    }
  });

  return result;
}

/**
 * แปลงข้อความบทละคร (Script Text) ให้บทพูดที่ยาวเกิน 20 คำ
 * ถูกแบ่งเป็นท่อนต่อเนื่องอัตโนมัติ โดยไม่เสียความหมาย และไม่กระทบ Action/Narration
 */
export function splitScriptTextDialoguesAt20Words(scriptText: string): { formattedText: string; totalSplits: number } {
  if (!scriptText || !scriptText.trim()) {
    return { formattedText: scriptText, totalSplits: 0 };
  }

  const lines = scriptText.split('\n');
  const resultLines: string[] = [];
  let totalSplits = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      resultLines.push('');
      continue;
    }

    // กฎเหล็ก:
    // - กฎแบ่ง 20 คำให้ทำงานเฉพาะ “บทพูด” ที่เกิน 20 คำเท่านั้น
    // - Action/Narration ห้ามนำไปนับหรือแตกด้วยกฎ 20 คำเด็ดขาด
    const isActionOrDirective = /^(?:Action|การกระทำ|บทบรรยาย|คำบรรยาย|บรรยาย|ความคิด|สีหน้า|START|END|POSITION|CAMERA|ฉากที่|ฉาก|Clip|Scene)\s*[:：]/i.test(line) ||
      /^(?:ชื่อเรื่อง|เรื่อง|TITLE|ตัวละคร|สถานที่|เวลา|แสง|สไตล์|STYLE|PROPS)\s*[:：=]/i.test(line);

    if (isActionOrDirective) {
      resultLines.push(rawLine);
      continue;
    }

    // ตรวจสอบว่าบรรทัดนี้คือ Dialogue หรือไม่: เช่น ฟ้าใส: "..." หรือ ฟ้าใส: ...
    const dlgMatch = line.match(/^([ก-๙a-zA-Z0-9_\- ]{2,20})\s*[:：]\s*(?:["“'‘«「]([^"”'’»」]+)["”'’»」]|(.+))$/);

    if (dlgMatch) {
      const candidateSpeaker = dlgMatch[1].trim();
      // ไม่นำกริยาการกระทำมานับเป็นชื่อผู้พูด
      const isVerbSpeaker = /(เดิน|วิ่ง|นั่ง|ยืน|มอง|หัน|จับ|ยิ้ม|ถือ|เปิด|ปิด|กอด|ร้อง|หยิบ|ฟัน|ชี้|ฉาก|Clip|Scene)/i.test(candidateSpeaker);
      if (isVerbSpeaker) {
        resultLines.push(rawLine);
        continue;
      }

      const dialogueBody = (dlgMatch[2] || dlgMatch[3] || '').trim();
      const wordsCount = countDialogueWords(dialogueBody);

      if (wordsCount > MAX_DIALOGUE_WORDS_PER_CLIP) {
        const parts = splitDialogueTextAt20Words(dialogueBody, MAX_DIALOGUE_WORDS_PER_CLIP);
        if (parts.length > 1) {
          totalSplits += parts.length - 1;
          parts.forEach((part) => {
            resultLines.push(`${candidateSpeaker}: "${part}"`);
          });
          continue;
        }
      }
    }

    resultLines.push(rawLine);
  }

  return {
    formattedText: resultLines.join('\n'),
    totalSplits
  };
}

/**
 * ประยุกต์ใช้ DIALOGUE 20-WORD SPLIT กับ DirectedClipItem[]
 * หากคลิปใดมีบทพูดที่ยาวเกิน 20 คำ ระบบจะตัดเฉพาะบทพูดส่วนที่เกิน
 * ไปสร้างเป็นคลิปต่อเนื่องถัดไปอัตโนมัติ โดย:
 * 1. ห้ามตัดคำกลางประโยคแบบเสียความหมาย
 * 2. ห้ามแก้ ห้ามย่อ ห้ามแต่งบทพูดเพิ่ม
 * 3. รักษาผู้พูดคนเดิม
 * 4. Action/Narration ก่อนและหลังบทพูดคงตำแหน่งเดิม
 * 5. คลิปถัดไปต้องต่อเนื่องจาก END คลิปก่อนหน้า ทั้งท่าทาง ตำแหน่ง สีหน้า กล้อง ฉาก เวลา และเสียง
 * 6. ถ้าช่วงใดไม่มี Dialogue ให้ใช้ STRICT SILENCE PROTOCOL และห้ามตัวละครพูดเอง
 * 7. ทำซ้ำจนกว่าบทพูดทั้งหมดจะครบ
 */
export function applyDialogue20WordSplitToClips(
  clips: DirectedClipItem[],
  clipDurationSeconds: number = 10
): {
  clips: DirectedClipItem[];
  splitApplied: boolean;
  totalOriginalClips: number;
  totalNewClips: number;
} {
  if (!clips || clips.length === 0) {
    return { clips: [], splitApplied: false, totalOriginalClips: 0, totalNewClips: 0 };
  }

  let workingClips: DirectedClipItem[] = [...clips];
  let overallSplitApplied = false;
  let iterations = 0;
  const MAX_ITERATIONS = 25; // ทำซ้ำจนกว่าบทพูดทั้งหมดจะครบ (safeguard against infinite loops)

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    // ค้นหาคลิปแรกที่มีบทพูดยาวเกิน 20 คำ
    const targetClipIdx = workingClips.findIndex(c =>
      (c.dialogues || []).some(d => countDialogueWords(d.line) > MAX_DIALOGUE_WORDS_PER_CLIP)
    );

    if (targetClipIdx === -1) {
      // ไม่มีคลิปใดมีบทพูดเกิน 20 คำแล้ว -> เสร็จสมบูรณ์
      break;
    }

    overallSplitApplied = true;
    const clip = workingClips[targetClipIdx];
    const dialogues = clip.dialogues || [];
    const targetDiagIdx = dialogues.findIndex(d => countDialogueWords(d.line) > MAX_DIALOGUE_WORDS_PER_CLIP);
    const targetDiag = dialogues[targetDiagIdx];

    // แยกบทพูดเฉพาะส่วนที่เกิน 20 คำ
    const splitParts = splitDialogueTextAt20Words(targetDiag.line, MAX_DIALOGUE_WORDS_PER_CLIP);
    if (splitParts.length <= 1) {
      break;
    }

    const nParts = splitParts.length;
    const expandedPartClips: DirectedClipItem[] = [];

    for (let p = 0; p < nParts; p++) {
      const partText = splitParts[p];
      const isFirst = p === 0;
      const isLast = p === nParts - 1;

      // ต้องรักษาผู้พูดคนเดิม 100%
      const partDiagEntry: DialogueLockEntry = {
        ...targetDiag,
        id: `${targetDiag.id}_split20_${p + 1}`,
        line: partText,
        speaker: targetDiag.speaker, // รักษาผู้พูดคนเดิม
        emotionTone: targetDiag.emotionTone || 'ตามบทต้นฉบับ'
      };

      const clipPartDialogues: DialogueLockEntry[] = isFirst
        ? [...dialogues.slice(0, targetDiagIdx), partDiagEntry]
        : isLast
        ? [partDiagEntry, ...dialogues.slice(targetDiagIdx + 1)]
        : [partDiagEntry];

      // Action/Narration ก่อนและหลังบทพูดคงตำแหน่งเดิม
      const partStartAction = isFirst
        ? clip.startAction
        : `${targetDiag.speaker} สนทนาประโยคต่อเนื่องในตำแหน่งและอารมณ์เดิมอย่างเป็นธรรมชาติ (รับช่วงต่อจากคลิปก่อนหน้า)`;

      const partEndAction = isLast
        ? clip.endAction
        : `${targetDiag.speaker} กำลังพูดต่อเนื่อง ส่งต่อโมเมนตัมคำพูดและท่าทางไปยังคลิปถัดไป`;

      const partTitle = `${clip.title} (ตอนที่ ${p + 1}/${nParts})`;

      // กฎข้อ 1: แก้ไขบทพูดซ้ำซ้อน (Fix Redundant Dialogue)
      // ในคลิปที่ถูกตัดแบ่งบทพูด (Dialogue Split Parts) ให้ลบบทพูดยาวเต็มประโยค (Full Dialogue Text) ออกจากต้นพรอมต์
      // บังคับให้แสดงเฉพาะประโยคย่อยที่ตัดแบ่งแล้ว (Part 1/N) ของคลิปนั้น ๆ เพียงจุดเดียว
      const fullDialogueLine = targetDiag.line;
      const basePrompt = stripFullDialogueFromPrompt(clip.generatedPrompt, fullDialogueLine, targetDiag.speaker);

      // กฎข้อ 3: ความหลากหลายของมุมกล้องในช็อตที่ตัดแบ่ง (Dynamic Camera & Micro-Action)
      // Part 1/2: ภาพระยะใกล้/เจาะจง (Close-up)
      // Part 2/2: เปลี่ยนมุมกล้อง (Over-the-shoulder หรือ Medium shot)
      const camTag = p === 0
        ? `[CAM-1 | CU (Close-up) | Subject: ${targetDiag.speaker} | Face Lock: ${targetDiag.speaker} | Location Lock: ${clip.locationName || 'เดิม'}]`
        : (p === 1
          ? `[CAM-2 | OTS (Over-the-shoulder) | Subject: ${targetDiag.speaker} | Face Lock: ${targetDiag.speaker} | Location Lock: ${clip.locationName || 'เดิม'}]`
          : `[CAM-${p + 1} | MID (Medium shot) | Subject: ${targetDiag.speaker} | Face Lock: ${targetDiag.speaker} | Location Lock: ${clip.locationName || 'เดิม'}]`);

      // บังคับให้แสดงเฉพาะประโยคย่อยที่ตัดแบ่งแล้ว (Part p+1/nParts) เพียงจุดเดียว
      const updatedPrompt = `${basePrompt}. [DIALOGUE 20-WORD SPLIT: Part ${p + 1}/${nParts}] Dialogue:\n${camTag}\n[${targetDiag.speaker}]: "${partText}"`;

      // ลบข้อความบทพูดเต็มออกจาก Action และ Summary ป้องกันการรั่วไหลซ้ำซ้อน
      const cleanSummary = (clip.sceneSummary || '')
        .replace(fullDialogueLine, `"${partText}"`)
        .replace(/\s{2,}/g, ' ')
        .trim();
      const cleanStartAction = (partStartAction || '')
        .replace(fullDialogueLine, `"${partText}"`)
        .replace(/\s{2,}/g, ' ')
        .trim();
      const cleanEndAction = (partEndAction || '')
        .replace(fullDialogueLine, `"${partText}"`)
        .replace(/\s{2,}/g, ' ')
        .trim();

      expandedPartClips.push({
        ...clip,
        title: partTitle,
        durationSeconds: clipDurationSeconds,
        sceneSummary: `${cleanSummary} (ตอนที่ ${p + 1}/${nParts})`,
        startAction: cleanStartAction,
        endAction: cleanEndAction,
        dialogues: clipPartDialogues,
        dialogue: `${targetDiag.speaker}: "${partText}"`,
        generatedPrompt: updatedPrompt,
        continuityLock: {
          ...clip.continuityLock,
          location: clip.continuityLock?.location || clip.locationName,
          timeOfDay: clip.continuityLock?.timeOfDay,
          lighting: clip.continuityLock?.lighting,
          visualStyle: clip.continuityLock?.visualStyle,
          cameraMovement: clip.continuityLock?.cameraMovement,
          lensType: clip.continuityLock?.lensType,
          characterPosition: clip.characterPositions || clip.continuityLock?.characterPosition
        },
        charactersPresent: clip.charactersPresent,
        startPoses: clip.startPoses,
        endPoses: clip.endPoses,
        characterPositions: clip.characterPositions,
        locationId: clip.locationId,
        locationName: clip.locationName,
        locationLocked: clip.locationLocked,
        cameraShotType: clip.cameraShotType,
        splitPart: {
          sourceSceneNumber: clip.clipNumber,
          part: p + 1,
          total: nParts,
          reason: `บทพูดของ ${targetDiag.speaker} ยาวเกิน 20 คำ (แยกอัตโนมัติ ${nParts} ท่อน ท่อนละไม่เกิน 20 คำ)`
        },
        actionNarrationLock: {
          action: partStartAction,
          movement: clip.characterPositions || 'ขยับตามบทต่อเนื่อง',
          emotionExpression: targetDiag.emotionTone || 'อารมณ์สอดคล้องกับบทสนทนา',
          narration: clip.sceneSummary,
          isSilent: false,
          hasActTrigger: true
        }
      });
    }

    // แทนที่คลิปเดิมด้วยคลิปย่อยที่แตกออกมา แล้ววนทำซ้ำต่อไป
    workingClips.splice(targetClipIdx, 1, ...expandedPartClips);
  }

  // ปรับปรุงความต่อเนื่องของคลิปทั้งหมด (END -> START เชื่อมต่อ ท่าทาง ตำแหน่ง สีหน้า กล้อง ฉาก เวลา และเสียง)
  // และตรวจสอบ STRICT SILENCE PROTOCOL สำหรับช่วงที่ไม่มี Dialogue
  let previousEnd = '';
  const finalizedClips = workingClips.map((c, idx) => {
    const clipNum = idx + 1;
    const startAction = idx === 0 ? c.startAction : (previousEnd || c.startAction);
    previousEnd = c.endAction;

    // กฎ: ถ้าช่วงใดไม่มี Dialogue ให้ใช้ STRICT SILENCE PROTOCOL และห้ามตัวละครพูดเอง
    const hasDiag = c.dialogues && c.dialogues.length > 0 && c.dialogues.some(d => d.line && d.line.trim());
    const isSilent = !hasDiag;

    let negativePrompt = c.negativePrompt || '';
    let audioDirectiveSummary = c.audioDirectiveSummary || '';
    let generatedPrompt = c.generatedPrompt || '';

    if (isSilent) {
      if (!negativePrompt.includes('speaking')) {
        negativePrompt += ', speaking, talking, mouth moving, lips moving, opening mouth, mouthing words, voiceover, dialogue, speech, chatter, whispering';
      }
      audioDirectiveSummary = 'STRICT SILENCE PROTOCOL: 100% Silent Characters (Ambient Atmosphere Only)';
    } else {
      if (!audioDirectiveSummary || audioDirectiveSummary.includes('STRICT SILENCE')) {
        const dText = c.dialogues.map(d => `${d.speaker}: "${d.line}"`).join(' ');
        audioDirectiveSummary = `Verbatim Dialogue with Ambient Atmosphere: ${dText}`;
      }
    }

    return {
      ...c,
      clipNumber: clipNum,
      startAction,
      negativePrompt,
      audioDirectiveSummary,
      generatedPrompt,
      dialogue: isSilent ? 'NONE' : c.dialogue,
      dialogues: (c.dialogues || []).map(d => ({ ...d, clipNumber: clipNum })),
      actionNarrationLock: c.actionNarrationLock ? {
        ...c.actionNarrationLock,
        isSilent
      } : {
        action: startAction,
        movement: c.characterPositions || 'ตามบท',
        emotionExpression: isSilent ? 'สีหน้าสื่ออารมณ์สงบนิ่ง' : 'อารมณ์สมจริงตามบท',
        narration: c.sceneSummary,
        isSilent,
        hasActTrigger: true
      }
    };
  });

  return {
    clips: finalizedClips,
    splitApplied: overallSplitApplied,
    totalOriginalClips: clips.length,
    totalNewClips: finalizedClips.length
  };
}
