/**
 * Dialogue Lock must list spoken lines from the script, with the 6 camera choices.
 * Run: npx tsx tests/dialogueLock.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DIALOGUE_CAMERA_ANGLES,
  dialogueLockEntriesFromScript,
  dialogueLockEntriesFromUnknown,
  mergeDialogueLock
} from '../src/services/dialogueLockFromScript';

const JEALOUS = `ชื่อเรื่อง: แค่หึง ไม่ได้หมดรัก

ตัวละคร

- พี่ทุย — ผู้ชายใจร้อน พูดตรง แต่รักน้องน้ำมาก
- น้องน้ำ — ผู้หญิงอารมณ์ดี แต่บางครั้งชอบแกล้งให้พี่ทุยหึง

ฉากที่ 1 — หน้าบ้าน / ช่วงเย็น
พี่ทุยนั่งรอน้องน้ำอยู่หน้าบ้าน สีหน้าเริ่มไม่พอใจ เมื่อน้องน้ำเดินกลับมาพร้อมรอยยิ้ม

พี่ทุย: “ไปไหนมา ทำไมกลับช้าขนาดนี้?”
น้องน้ำ: “ไปธุระมานิดหน่อยเอง พี่ทุยจะถามอะไรเยอะแยะเนี่ย”

ฉากที่ 2 — หน้าบ้านต่อเนื่อง
พี่ทุย: “ใครโทรมา ทำไมต้องรีบปิด?”
น้องน้ำ: “เพื่อนโทรมา ไม่มีอะไรหรอก”
พี่ทุย: “เพื่อนหรือใครกันแน่?”
`;

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✔ ${name}`);
}

check('script dialogue is not an empty lock list', () => {
  const rows = dialogueLockEntriesFromScript(JEALOUS);
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.map(d => `${d.speaker}: ${d.line}`), [
    'พี่ทุย: ไปไหนมา ทำไมกลับช้าขนาดนี้?',
    'น้องน้ำ: ไปธุระมานิดหน่อยเอง พี่ทุยจะถามอะไรเยอะแยะเนี่ย',
    'พี่ทุย: ใครโทรมา ทำไมต้องรีบปิด?',
    'น้องน้ำ: เพื่อนโทรมา ไม่มีอะไรหรอก',
    'พี่ทุย: เพื่อนหรือใครกันแน่?'
  ]);
  assert.deepEqual(rows.map(d => d.clipNumber), [1, 1, 2, 2, 2]);
});

check('a story with no spoken lines stays empty', () => {
  assert.deepEqual(dialogueLockEntriesFromScript('ฟ้าใสเดินเข้าป่าโดยไม่มีใครพูด'), []);
  assert.deepEqual(dialogueLockEntriesFromScript(''), []);
});

check('API objects that use dialogue instead of line still count', () => {
  const rows = dialogueLockEntriesFromUnknown([
    { speaker: 'พี่ทุย', dialogue: 'ไปไหนมา', sceneNumber: 1 },
    { speaker: 'น้องน้ำ', line: 'NONE', sceneNumber: 1 }
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].line, 'ไปไหนมา');
  assert.equal(rows[0].clipNumber, 1);
});

check('camera choices already set on a line are kept, and the six angles stay available', () => {
  assert.deepEqual(DIALOGUE_CAMERA_ANGLES, ['AUTO', 'OTS', 'CU', '2S', 'MID', 'W']);
  const parsed = dialogueLockEntriesFromScript(JEALOUS);
  const previous = parsed.map((d, i) => i === 0 ? { ...d, cameraAngles: ['OTS' as const, 'CU' as const], backgroundControl: 'CLEAR' as const } : d);
  const merged = mergeDialogueLock(parsed, previous);
  assert.deepEqual(merged[0].cameraAngles, ['OTS', 'CU']);
  assert.equal(merged[0].backgroundControl, 'CLEAR');
  assert.equal(merged.length, parsed.length);
  const ui = fs.readFileSync(new URL('../src/components/DialogueCameraControl.tsx', import.meta.url), 'utf8');
  assert.equal(ui.includes('DIALOGUE_CAMERA_ANGLES'), true);
  assert.equal(ui.includes("['AUTO', 'OTS', 'CU', '2S', 'MID', 'W']"), false);
  const director = fs.readFileSync(new URL('../src/components/MultiClipDirector.tsx', import.meta.url), 'utf8');
  assert.equal(director.includes('dialogueLockEntriesFromScript'), true);
  assert.equal(director.includes('ยังไม่มีการเพิ่มบทพูดเจาะจง'), true);
});

console.log(`\n${passed} checks passed`);
