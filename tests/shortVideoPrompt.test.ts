/**
 * Short natural video prompts (user's format):
 * place + time → characters + action → dialogue → face + emotion → set + light → quality.
 * The locks (face, costume, place, dialogue, continuity) stay, each in a few words; no camera is
 * invented; a continuing clip attaches the previous clip's last frame FIRST.
 * Nothing here calls a video API.
 */
import assert from 'node:assert/strict';
import { formatClipForMetaAi, metaContextFor, attachmentLine, checkPromptProblems, VIDEO_PROMPT_MAX } from '../src/services/metaAiPrompt';

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✔ ${name}`); };

const place = { locationName: 'หน้าศาลาวัดไทยชนบท', timeOfDay: 'กลางวัน', durationSeconds: 10 };
const ends = [{ name: 'พี่ทุย', posture: 'standing', place: 'หน้ากระถางธูป' }, { name: 'น้องน้ำ', posture: 'standing', place: 'หน้ากระถางธูป' }];
const clips: any[] = [
  { clipNumber: 1, ...place, charactersPresent: ['พี่ทุย', 'น้องน้ำ'], generatedPrompt: 'Core action: พี่ทุยกับน้องน้ำยืนคุยกันหน้ากระถางธูป.',
    dialogues: [{ speaker: 'พี่ทุย', line: 'เธอขอพรว่าอะไรหรอน้องน้ำ' }, { speaker: 'น้องน้ำ', line: 'ขอให้เราได้อยู่ด้วยกันตลอดไป' }], endPoses: ends },
  { clipNumber: 2, ...place, charactersPresent: ['พี่ทุย', 'น้องน้ำ'], generatedPrompt: 'Core action: น้องน้ำหันไปสบตาพี่ทุย.',
    dialogues: [{ speaker: 'น้องน้ำ', line: 'ขอให้เราได้อยู่ด้วยกันตลอดไปนะ', emotion: 'ยิ้มอ่อนโยน' }], endPoses: ends },
  { clipNumber: 3, ...place, charactersPresent: ['พี่ทุย', 'น้องน้ำ'], generatedPrompt: 'Core action: พี่ทุยจับมือน้องน้ำ. [มุมกล้อง ภาพกว้างจากด้านหลัง]', dialogues: [], endPoses: ends }
];
const opts: any = {
  aspectRatio: '9:16', knownCharacters: ['พี่ทุย', 'น้องน้ำ'], photoOrder: ['พี่ทุย', 'น้องน้ำ'], withPhoto: ['พี่ทุย'],
  characterNotes: { 'พี่ทุย': 'ควายหนุ่ม ชุด: เสื้อคอจีนสีคราม', 'น้องน้ำ': 'ประเภท: กิ้งก่าสาว, ผิว/เกล็ด: เกล็ดสีเขียวอมเหลือง' }
};
const ctx = (i: number) => ({ ...opts, ...metaContextFor(clips, i) });
const v = clips.map((c, i) => formatClipForMetaAi(c, ctx(i)));

check('the user\'s example: natural Thai in the asked order', () => {
  const t = v[0];
  assert.ok(t.startsWith('หน้าศาลาวัดไทยชนบท ตอนกลางวัน '), t);
  const at = [
    t.indexOf('พี่ทุย (รูปที่ 2)'),
    t.indexOf('ยืนคุยกันหน้ากระถางธูป'),
    t.indexOf('พี่ทุยถามว่า "เธอขอพรว่าอะไรหรอน้องน้ำ"'),
    t.indexOf('น้องน้ำตอบว่า "ขอให้เราได้อยู่ด้วยกันตลอดไป"'),
    t.indexOf('สีหน้าชัดเจน'),
    t.indexOf('ฉากตามรูปที่ 1'),
    t.indexOf('ฉากและแสงคงเดิม'),
    t.indexOf('cinematic photorealistic, 9:16')
  ];
  assert.ok(at.every(x => x >= 0), `${at} ${t}`);
  assert.deepEqual(at, [...at].sort((a, b) => a - b), 'place → characters + action → dialogue → emotion → set + light → quality');
  assert.ok(t.includes('น้องน้ำ (กิ้งก่าสาว, เกล็ดสีเขียวอมเหลือง)'), 'no photo: the look, without its labels');
});

check('short: no long lock blocks, no repeated instructions, far under the old 1,300-2,300 characters', () => {
  for (const [i, t] of v.entries()) {
    assert.deepEqual(checkPromptProblems(t, 'video', ctx(i).camera), [], `clip ${i + 1}: ${t}`);
    assert.ok(t.length < 800, `clip ${i + 1}: ${t.length}`);
    for (const old of ['บริบท:', 'ล็อกฉาก', 'ล็อกตัวละคร', 'speaks in Thai', 'ใบหน้าตัวละครอยู่ช่วงบนของจอ', 'อารมณ์และการแสดง:', 'การเคลื่อนไหวของตัวละคร:']) assert.ok(!t.includes(old), `clip ${i + 1}: "${old}"`);
  }
  assert.ok(VIDEO_PROMPT_MAX <= 700);
});

check('no camera unless the script gives one', () => {
  assert.ok(!v[0].includes('มุมกล้อง') && !v[1].includes('มุมกล้อง'));
  assert.ok(v[2].includes('มุมกล้อง: ภาพกว้างจากด้านหลัง'), v[2]);
  assert.ok(!v[2].includes('[มุมกล้อง'), 'the note is not played as an action');
});

check('continuity: the previous clip\'s last frame is picture 1, then the faces, the master last', () => {
  assert.equal(attachmentLine(clips[0], ctx(0)), 'รูปที่ 1 ภาพมาสเตอร์ หน้าศาลาวัดไทยชนบท Master · รูปที่ 2 พี่ทุย');
  assert.equal(attachmentLine(clips[1], ctx(1)), 'รูปที่ 1 เฟรมสุดท้ายของวิดีโอคลิป 1 · รูปที่ 2 พี่ทุย · รูปที่ 3 ภาพมาสเตอร์ หน้าศาลาวัดไทยชนบท Master');
  assert.ok(v[1].includes('ต่อจากเฟรมสุดท้ายของคลิป 1 (รูปที่ 1) ทันที') && v[1].includes('ฉากตามรูปที่ 3'), v[1]);
  // the still images keep their own order (the master first)
  assert.ok(attachmentLine(clips[1], ctx(1), 'image').startsWith('รูปที่ 1 ภาพมาสเตอร์'));
  assert.ok(v[0].includes('จบคลิปด้วยพี่ทุยและน้องน้ำยืนที่หน้ากระถางธูป'), 'end pose handed on');
});

check('locks kept: dialogue word for word, faces / costume, nobody doubled, sound, no text', () => {
  assert.ok(v[0].includes('พูดภาษาไทยตรงตามบททุกคำ พูดทีละคนตามลำดับ'));
  assert.ok(v[1].includes('น้องน้ำพูดว่า "ขอให้เราได้อยู่ด้วยกันตลอดไปนะ"') && v[1].includes('คนอื่นไม่พูด'));
  assert.ok(v[1].includes('น้องน้ำ ยิ้มอ่อนโยน สีหน้าชัดเจน'), 'the script\'s own emotion');
  for (const t of v) assert.ok(t.includes('หน้าตาและชุดคงเดิมตามรูป') && t.includes('ไม่มีตัวละครซ้ำ') && t.includes('ไม่มีตัวหนังสือบนจอ'));
  assert.ok(v[2].includes('ไม่มีบทพูดในคลิปนี้') && v[2].includes('เงียบทั้งคลิป'));
  // never a line the script does not have
  const quoted = v.flatMap(t => Array.from(t.matchAll(/"([^"]+)"/g)).map(m => m[1]));
  assert.deepEqual(quoted, clips.flatMap(c => c.dialogues.map((d: any) => d.line)));
});

check('same format for any story and cast: a human cast, no photos, a new place', () => {
  const other: any[] = [
    { clipNumber: 1, locationName: 'ห้องโถงคฤหาสน์', timeOfDay: 'กลางคืน', durationSeconds: 8, charactersPresent: ['คุณหญิงมณี', 'น้ำฟ้า'],
      generatedPrompt: 'Core action: คุณหญิงมณีโยนกระเป๋าลงพื้น.', dialogues: [{ speaker: 'คุณหญิงมณี', line: 'ออกไปจากบ้านฉัน!' }] },
    { clipNumber: 2, locationName: 'ริมถนน', timeOfDay: 'กลางคืน', durationSeconds: 8, charactersPresent: ['น้ำฟ้า'],
      generatedPrompt: 'Core action: น้ำฟ้าเดินลากกระเป๋าตากฝน.', dialogues: [] }
  ];
  const o: any = { aspectRatio: '16:9', knownCharacters: ['คุณหญิงมณี', 'น้ำฟ้า'], withPhoto: [] };
  const a = formatClipForMetaAi(other[0], { ...o, ...metaContextFor(other, 0) });
  const b = formatClipForMetaAi(other[1], { ...o, ...metaContextFor(other, 1) });
  assert.ok(a.startsWith('ห้องโถงคฤหาสน์ ตอนกลางคืน') && a.includes('คุณหญิงมณีพูดว่า "ออกไปจากบ้านฉัน!"') && a.includes('16:9, 8 วินาที'), a);
  assert.ok(!a.includes('ไม่กลายเป็นมนุษย์'), 'a human cast is not told not to become human');
  assert.ok(b.startsWith('เปลี่ยนฉากมาที่ริมถนน ตอนกลางคืน') && !b.includes('ต่อจากเฟรมสุดท้าย'), b);
});

console.log(`\nshort video prompt: ${passed} passed`);
