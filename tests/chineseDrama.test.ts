/** Chinese short drama mode: angle count per shot, fixed opening + style, Thai lines kept, speech only. */
import assert from 'node:assert/strict';
import { formatChineseDramaShot, formatAllChineseDrama, CHINESE_DRAMA_OPENING, CHINESE_DRAMA_STYLE } from '../src/services/metaAiPrompt';

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✔ ${name}`); };
const place = { locationName: 'ป่าชายแดน', timeOfDay: 'กลางวัน', durationSeconds: 10 };
const clips: any[] = [
  { clipNumber: 16, title: 'เสียงคนวิ่ง', ...place, charactersPresent: ['ต้น'], generatedPrompt: 'Core action: ต้นได้ยินเสียงฝีเท้าหลายคน เขารีบหลบหลังต้นไม้ใหญ่.', dialogues: [] },
  { clipNumber: 17, title: 'ชาวบ้านหนีศึก', ...place, charactersPresent: ['ชาวบ้านชาย'], generatedPrompt: 'Core action: ชาวบ้านในชุดผ้าฝ้ายโบราณวิ่งผ่าน บางคนแบกกระสอบข้าว บางคนอุ้มลูก.', dialogues: [{ speaker: 'ชาวบ้านชาย', line: 'เร็วเข้า! พวกทหารกำลังมา!' }] },
  { clipNumber: 18, title: 'ต้นตกใจ', ...place, charactersPresent: ['ต้น'], generatedPrompt: 'Core action: ต้นเดินออกจากหลังต้นไม้ มองชาวบ้านที่วิ่งผ่านหน้า.', dialogues: [{ speaker: 'ต้น', line: 'เดี๋ยวก่อนครับ! นี่ถ่ายละครกันอยู่เหรอ?' }] },
  { clipNumber: 19, title: 'ปะทะ', ...place, charactersPresent: ['ต้น', 'ทหาร'], generatedPrompt: 'Core action: ต้นกับทหารทะเลาะกันเสียงดัง.', dialogues: [{ speaker: 'ทหาร', line: 'เจ้าเป็นใคร!' }] }
];
const opts: any = { aspectRatio: '9:16', knownCharacters: ['ต้น'], photoOrder: ['ต้น'], withPhoto: ['ต้น'], characterNotes: { 'ต้น': 'ชายไทยอายุ 28 ชุด: เสื้อยืดสีกรมท่า กางเกงยีนส์เข้ม' } };
const shots = clips.map((c, i) => formatChineseDramaShot(c, opts, clips[i + 1]));

check('angle count: silent 1, dialogue 2, conflict 5', () => {
  assert.deepEqual(shots.map(s => s.angles.length), [1, 2, 2, 5]);
  assert.equal(shots[3].kind, 'conflict');
});
check('every prompt: opening, style suffix, locks', () => {
  for (const s of shots) for (const a of s.angles) {
    assert.ok(a.prompt.startsWith(CHINESE_DRAMA_OPENING));
    assert.ok(a.prompt.includes(CHINESE_DRAMA_STYLE));
    assert.ok(a.prompt.includes('ล็อกสถานที่: สถานที่ ป่าชายแดน'));
    assert.ok(!/whoosh|music swell|heartbeat/i.test(a.prompt));
  }
  assert.ok(shots[0].angles[0].prompt.includes('เสื้อยืดสีกรมท่า'));
});
check('dialogue exact, voice carries over the reaction, Thai notes', () => {
  assert.ok(shots[2].angles[0].prompt.includes('ต้น speaks Thai exactly: "เดี๋ยวก่อนครับ! นี่ถ่ายละครกันอยู่เหรอ?"'));
  assert.ok(shots[2].angles[1].prompt.includes('voice continues off-screen'));
  assert.ok(shots[2].notes.some(n => n.startsWith('L-cut')));
  assert.ok(shots[1].notes.some(n => n.includes('J-cut')));
  for (const s of shots) for (const a of s.angles) assert.ok(a.seconds >= 1.5 && a.seconds <= 3);
});
check('copy-all text has every shot', () => {
  const all = formatAllChineseDrama(clips, opts);
  assert.ok(all.includes('ช็อต 16') && all.includes('ช็อต 18') && all.includes('วิธีตัดต่อ'));
});
if (process.env.PRINT_SAMPLE) console.log(formatAllChineseDrama(clips.slice(0, 3), opts));
console.log(`chineseDrama: ${passed} passed`);
