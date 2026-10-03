/**
 * ACTION & NARRATION LOCK SYSTEM (ระบบล็อคการกระทำและคำบรรยาย)
 *
 * ข้อกำหนดและกฎเหล็ก:
 * 1. อ่านบทตามลำดับเดิมจากบนลงล่าง และรักษา Action/Narration ไว้ตำแหน่งเดิมก่อนหรือหลังบทพูด
 *    ห้ามข้าม ห้ามย้าย ห้ามตัด ห้ามแปลงเป็นบทพูด
 * 2. ใช้แท็ก [ACT_TRIGGER] เพื่อดึง:
 *    - Action (การกระทำ)
 *    - Movement (การเคลื่อนไหว)
 *    - Emotion/Expression (อารมณ์ / การแสดงออกทางสีหน้า)
 *    - Narration (คำบรรยาย)
 * 3. เมื่อถึง [ACTION_END] ให้ไปต่อเนื้อหาถัดไปตามลำดับเดิมทันที
 * 4. กฎสำคัญ:
 *    ถ้าช่วง Action/Narration ไม่มี Dialogue ให้ตัวละครทุกตัวเงียบ 100%
 *    ห้ามสร้างคำพูด เสียงพูด เสียงปาก บทสนทนา หรือ Dialogue ใหม่เองเด็ดขาด
 *    ให้มีเฉพาะการกระทำ อารมณ์ การเคลื่อนไหว และเสียงบรรยากาศตามบทเท่านั้น
 */

export interface ActionNarrationBlock {
  id: string;
  sequenceIndex: number;
  position: 'before_dialogue' | 'after_dialogue' | 'standalone';
  action: string;
  movement: string;
  emotionExpression: string;
  narration: string;
  associatedDialogue?: {
    speaker: string;
    line: string;
  };
  hasDialogue: boolean;
  isSilent: boolean; // ถ้าไม่มี Dialogue ต้องเงียบ 100%
  rawBlockText: string;
}

export interface ParsedActionNarrationScript {
  blocks: ActionNarrationBlock[];
  totalActionsCount: number;
  silentBlocksCount: number;
  dialogueBlocksCount: number;
}

/**
 * ดึงข้อมูล Action, Movement, Emotion/Expression, Narration จากข้อความภายใน [ACT_TRIGGER] ... [ACTION_END]
 */
export function parseSingleActTriggerBlock(content: string, sequenceIndex: number): ActionNarrationBlock {
  const clean = content.trim();

  let action = '';
  let movement = '';
  let emotionExpression = '';
  let narration = '';

  // ตรวจจับ key-value format เช่น
  // Action: ...
  // Movement: ...
  // Emotion/Expression: ...
  // Narration: ...
  const lines = clean.split('\n');
  let currentKey: 'action' | 'movement' | 'emotion' | 'narration' | null = null;
  const remainingLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const actionMatch = line.match(/^(?:action|การกระทำ)\s*[:：]\s*(.*)$/i);
    const movementMatch = line.match(/^(?:movement|การเคลื่อนไหว|การขยับ)\s*[:：]\s*(.*)$/i);
    const emotionMatch = line.match(/^(?:emotion|expression|emotion\/expression|อารมณ์|สีหน้า|การแสดงออก)\s*[:：]\s*(.*)$/i);
    const narrationMatch = line.match(/^(?:narration|คำบรรยาย|บรรยาย)\s*[:：]\s*(.*)$/i);

    if (actionMatch) {
      currentKey = 'action';
      action += (action ? ' ' : '') + actionMatch[1].trim();
    } else if (movementMatch) {
      currentKey = 'movement';
      movement += (movement ? ' ' : '') + movementMatch[1].trim();
    } else if (emotionMatch) {
      currentKey = 'emotion';
      emotionExpression += (emotionExpression ? ' ' : '') + emotionMatch[1].trim();
    } else if (narrationMatch) {
      currentKey = 'narration';
      narration += (narration ? ' ' : '') + narrationMatch[1].trim();
    } else if (currentKey === 'action') {
      action += ' ' + line;
    } else if (currentKey === 'movement') {
      movement += ' ' + line;
    } else if (currentKey === 'emotion') {
      emotionExpression += ' ' + line;
    } else if (currentKey === 'narration') {
      narration += ' ' + line;
    } else {
      remainingLines.push(line);
    }
  }

  // หากไม่มีคีย์กำกับไว้ ให้จัดข้อความธรรมดาลง action และ narration
  if (!action && !movement && !emotionExpression && !narration && remainingLines.length > 0) {
    const fullText = remainingLines.join(' ');
    action = fullText;
    narration = fullText;

    // สกัดการเคลื่อนไหว
    const moveKeywords = ['เดิน', 'วิ่ง', 'หัน', 'ก้าว', 'ลุก', 'นั่ง', 'หมุน', 'ก้ม', 'เอื้อม', 'ยกมือ', 'step', 'walk', 'run', 'turn'];
    const foundMoves = moveKeywords.filter(k => fullText.includes(k));
    if (foundMoves.length > 0) {
      movement = `การเคลื่อนไหว: ${foundMoves.join(', ')} ในฉาก`;
    }

    // สกัดอารมณ์/สีหน้า
    const emotionKeywords = ['ยิ้ม', 'เคร่งเครียด', 'ตกใจ', 'นิ่ง', 'สุขุม', 'เศร้า', 'โกรธ', 'หวาดระแวง', 'ลังเล', 'มุ่งมั่น', 'smile', 'serious', 'calm'];
    const foundEmotions = emotionKeywords.filter(k => fullText.includes(k));
    if (foundEmotions.length > 0) {
      emotionExpression = `สีหน้าและอารมณ์: ${foundEmotions.join(', ')}`;
    }
  }

  return {
    id: `act_narr_${sequenceIndex}_${Date.now()}`,
    sequenceIndex,
    position: 'standalone',
    action: action || clean,
    movement: movement || 'เคลื่อนไหวเป็นธรรมชาติสมจริงตามบท',
    emotionExpression: emotionExpression || 'สีหน้าสื่ออารมณ์ตามสถานการณ์',
    narration: narration || clean,
    hasDialogue: false,
    isSilent: true,
    rawBlockText: clean
  };
}

/**
 * วิเคราะห์และแยกส่วนบททั้งหมดตามลำดับบนลงล่าง
 * รองรับทั้งบทที่มีแท็ก [ACT_TRIGGER] ... [ACTION_END] และบททั่วไป
 * โดยรักษา Action/Narration ไว้ตำแหน่งเดิมก่อนหรือหลังบทพูด ห้ามข้าม ห้ามย้าย ห้ามตัด ห้ามแปลงเป็นบทพูด
 */
export function parseScriptWithActionNarrationLock(scriptText: string): ParsedActionNarrationScript {
  if (!scriptText || !scriptText.trim()) {
    return { blocks: [], totalActionsCount: 0, silentBlocksCount: 0, dialogueBlocksCount: 0 };
  }

  const blocks: ActionNarrationBlock[] = [];
  const lines = scriptText.split('\n');
  let currentSeq = 1;

  // ตรวจสอบว่าในบทมีแท็ก [ACT_TRIGGER] ... [ACTION_END] หรือไม่
  const hasExplicitTags = /\[ACT_TRIGGER\]/i.test(scriptText) && /\[ACTION_END\]/i.test(scriptText);

  if (hasExplicitTags) {
    const actRegex = /\[ACT_TRIGGER\]([\s\S]*?)\[ACTION_END\]/gi;
    let match: RegExpExecArray | null;

    let lastIndex = 0;
    while ((match = actRegex.exec(scriptText)) !== null) {
      const matchIndex = match.index;
      // ตรวจสอบว่ามีบทพูดคั่นอยู่ระหว่าง tag หรือไม่
      const precedingText = scriptText.slice(lastIndex, matchIndex).trim();
      if (precedingText) {
        // ค้นหา dialogue ใน precedingText
        const dlgMatch = precedingText.match(/^([ก-๙a-zA-Z0-9_\- ]{2,20})\s*[:：]\s*["“'‘«「]([^"”'’»」]+)["”'’»」]/m);
        if (dlgMatch) {
          blocks.push({
            id: `act_narr_dlg_${currentSeq++}`,
            sequenceIndex: currentSeq,
            position: 'before_dialogue',
            action: `ตัวละคร ${dlgMatch[1]} กำลังพูด`,
            movement: 'ขยับริมฝีปากและแสดงท่าทางขณะพูดบทสนทนา',
            emotionExpression: 'อารมณ์สอดคล้องกับบทสนทนา',
            narration: precedingText,
            associatedDialogue: {
              speaker: dlgMatch[1].trim(),
              line: dlgMatch[2].trim()
            },
            hasDialogue: true,
            isSilent: false,
            rawBlockText: precedingText
          });
        }
      }

      const innerContent = match[1];
      const parsedBlock = parseSingleActTriggerBlock(innerContent, currentSeq++);
      blocks.push(parsedBlock);

      lastIndex = actRegex.lastIndex;
    }

    // ท้ายสุดหลังแท็กสุดท้าย
    const tailText = scriptText.slice(lastIndex).trim();
    if (tailText) {
      const dlgMatch = tailText.match(/^([ก-๙a-zA-Z0-9_\- ]{2,20})\s*[:：]\s*["“'‘«「]([^"”'’»」]+)["”'’»」]/m);
      if (dlgMatch) {
        blocks.push({
          id: `act_narr_dlg_${currentSeq++}`,
          sequenceIndex: currentSeq,
          position: 'after_dialogue',
          action: `ตัวละคร ${dlgMatch[1]} กำลังพูด`,
          movement: 'ขยับริมฝีปากและแสดงท่าทางขณะพูดบทสนทนา',
          emotionExpression: 'อารมณ์สอดคล้องกับบทสนทนา',
          narration: tailText,
          associatedDialogue: {
            speaker: dlgMatch[1].trim(),
            line: dlgMatch[2].trim()
          },
          hasDialogue: true,
          isSilent: false,
          rawBlockText: tailText
        });
      }
    }
  } else {
    // ไม่มีแท็ก explicit: อ่านบทจากบนลงล่าง รักษา Action/Narration ไว้ตำแหน่งเดิมก่อนหรือหลังบทพูด
    let pendingActionLines: string[] = [];

    const flushPendingAction = (position: 'before_dialogue' | 'after_dialogue' | 'standalone', assocDlg?: { speaker: string; line: string }) => {
      if (pendingActionLines.length === 0) return;
      const combined = pendingActionLines.join('\n').trim();
      if (!combined) return;

      const block = parseSingleActTriggerBlock(combined, currentSeq++);
      block.position = position;
      if (assocDlg) {
        block.associatedDialogue = assocDlg;
        block.hasDialogue = true;
        block.isSilent = false;
      }
      blocks.push(block);
      pendingActionLines = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // ข้ามหัวข้อฉาก เช่น [ฉากที่ 1: โกดังร้าง]
      if (line.startsWith('[ฉากที่') || line.startsWith('ฉากที่') || line.startsWith('SCENE')) {
        flushPendingAction('standalone');
        continue;
      }

      // ตรวจสอบว่าบรรทัดนี้คือบทพูดหรือไม่: เช่น สมชาย: "อย่าเพิ่งไป"
      const dlgMatch = line.match(/^([ก-๙a-zA-Z0-9_\- ]{2,20})\s*[:：]\s*["“'‘«「]([^"”'’»」]+)["”'’»」]/) ||
                       line.match(/^([ก-๙a-zA-Z0-9_\- ]{2,20})\s*[:：]\s*(.+)$/);

      if (dlgMatch && !line.includes('Action:') && !line.includes('การกระทำ:')) {
        // ข้อความแอ็กชันที่อยู่ "ก่อน" บทพูดนี้
        flushPendingAction('before_dialogue');

        // บันทึกช่วงบทพูด
        blocks.push({
          id: `act_narr_${currentSeq++}`,
          sequenceIndex: currentSeq,
          position: 'before_dialogue',
          action: `${dlgMatch[1]} กำลังกล่าวคำพูด`,
          movement: 'ขยับริมฝีปากและแสดงท่าทางขณะพูดบทสนทนา',
          emotionExpression: 'สีหน้าสื่ออารมณ์ตามประโยคบทพูด',
          narration: line,
          associatedDialogue: {
            speaker: dlgMatch[1].trim(),
            line: dlgMatch[2].replace(/^["“'‘«「]|["”'’»」]$/g, '').trim()
          },
          hasDialogue: true,
          isSilent: false,
          rawBlockText: line
        });
      } else {
        // เป็นคำบรรยาย / Action
        pendingActionLines.push(line);
      }
    }
    flushPendingAction('standalone');
  }

  const silentCount = blocks.filter(b => b.isSilent).length;
  const dialogueCount = blocks.filter(b => b.hasDialogue).length;

  return {
    blocks,
    totalActionsCount: blocks.length,
    silentBlocksCount: silentCount,
    dialogueBlocksCount: dialogueCount
  };
}

/**
 * แปลงบทธรรมดาให้มีแท็ก [ACT_TRIGGER] ... [ACTION_END] ครอบตำแหน่ง Action & Narration
 * โดยรักษาลำดับเดิมจากบนลงล่าง ไม่ข้าม ไม่ย้าย ไม่ตัด ไม่แปลงเป็นบทพูด
 */
export function formatScriptWithActTriggerTags(scriptText: string): string {
  if (!scriptText || !scriptText.trim()) return '';

  // หากมีแท็กอยู่แล้ว ส่งคืนตามเดิม
  if (/\[ACT_TRIGGER\]/i.test(scriptText) && /\[ACTION_END\]/i.test(scriptText)) {
    return scriptText;
  }

  const lines = scriptText.split('\n');
  const resultLines: string[] = [];
  let currentActionBuffer: string[] = [];

  const flushActionBuffer = () => {
    if (currentActionBuffer.length === 0) return;
    const actionText = currentActionBuffer.join('\n').trim();
    if (actionText) {
      resultLines.push('[ACT_TRIGGER]');
      resultLines.push(actionText);
      resultLines.push('[ACTION_END]');
    }
    currentActionBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushActionBuffer();
      resultLines.push('');
      continue;
    }

    if (line.startsWith('[ฉากที่') || line.startsWith('ฉากที่') || line.startsWith('SCENE')) {
      flushActionBuffer();
      resultLines.push(line);
      continue;
    }

    // ตรวจสอบบทพูด
    const isDialogue = /^([ก-๙a-zA-Z0-9_\- ]{2,20})\s*[:：]\s*["“'‘«「]([^"”'’»」]+)["”'’»」]/.test(line) ||
                       /^([ก-๙a-zA-Z0-9_\- ]{2,20})\s*[:：]\s*(.+)$/.test(line);

    if (isDialogue) {
      flushActionBuffer();
      resultLines.push(line);
    } else {
      currentActionBuffer.push(line);
    }
  }
  flushActionBuffer();

  return resultLines.join('\n');
}

/**
 * สร้างคำสั่ง Prompt และ Negative Prompt ปฏิบัติตามกฎเหล็ก:
 * "ถ้าช่วง Action/Narration ไม่มี Dialogue ให้ตัวละครทุกตัวเงียบ 100%
 * ห้ามสร้างคำพูด เสียงพูด เสียงปาก บทสนทนา หรือ Dialogue ใหม่เองเด็ดขาด
 * ให้มีเฉพาะการกระทำ อารมณ์ การเคลื่อนไหว และเสียงบรรยากาศตามบทเท่านั้น"
 */
export function buildActionNarrationLockPromptDirectives(block: {
  action?: string;
  movement?: string;
  emotionExpression?: string;
  narration?: string;
  hasDialogue: boolean;
  dialogueText?: string;
}): {
  promptDirective: string;
  negativeDirective: string;
  audioDirective: string;
} {
  if (!block.hasDialogue) {
    // 100% SILENT RULE
    const promptParts = [
      '[ACTION & NARRATION LOCK: 100% SILENT SCENE]',
      block.action ? `Action: ${block.action}` : '',
      block.movement ? `Movement: ${block.movement}` : '',
      block.emotionExpression ? `Emotion: ${block.emotionExpression}` : '',
      'STRICT SILENCE PROTOCOL: All characters remain 100% silent, closed mouth, tight lips, no talking, no mouth movement, pure physical acting and body language only.',
      'Sound: Atmospheric ambient soundscape only, zero dialogue or spoken voice.'
    ].filter(Boolean);

    return {
      promptDirective: promptParts.join(', '),
      negativeDirective: 'speaking, talking, mouth moving, opening mouth to speak, lips flapping, mouthing words, voiceover, narrator, dialogue, chatter, whispering, speech bubble',
      audioDirective: 'ACTION & NARRATION LOCK: 100% Silent Characters (Ambient Atmosphere Only)'
    };
  }

  // มี Dialogue ตามต้นฉบับ
  return {
    promptDirective: `[ACTION & NARRATION LOCK] Action: ${block.action || 'Acting'}, Movement: ${block.movement || 'Natural'}, Emotion: ${block.emotionExpression || 'In character'}. Dialogue delivery matching verbatim script.`,
    negativeDirective: 'unrelated dialogue, invented speech, out of character voice, shouting without script',
    audioDirective: `Verbatim Dialogue with Ambient Atmosphere: "${block.dialogueText || ''}"`
  };
}
