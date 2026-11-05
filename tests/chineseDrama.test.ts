/** Chinese short drama mode: angles per shot, on-screen face locks, English prompt text, one camera per angle, speech only. */
import assert from 'node:assert/strict';
import { formatChineseDramaShot, formatAllChineseDrama, chineseDramaShots, dramaTranslatables, CHINESE_DRAMA_OPENING, CHINESE_DRAMA_STYLE, NO_ONE_SPEAKS, AUDIO_SPEECH, AUDIO_SILENT } from '../src/services/metaAiPrompt';

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
// what the server's /api/translate/en returns for these texts
export const TR: Record<string, string> = {
  'ต้น': 'Ton', 'ชาวบ้านชาย': 'a male villager', 'ทหาร': 'a soldier', 'ป่าชายแดน': 'border jungle',
  'ชายไทยอายุ 28 ชุด: เสื้อยืดสีกรมท่า กางเกงยีนส์เข้ม': 'Thai man, 28, outfit: navy t-shirt, dark jeans',
  'ต้นได้ยินเสียงฝีเท้าหลายคน เขารีบหลบหลังต้นไม้ใหญ่': 'Ton hears many footsteps and quickly hides behind a huge tree',
  'ชาวบ้านในชุดผ้าฝ้ายโบราณวิ่งผ่าน บางคนแบกกระสอบข้าว บางคนอุ้มลูก': 'Villagers in ancient cotton clothes run past in panic, some carry rice sacks, a mother holds her child',
  'ต้นเดินออกจากหลังต้นไม้ มองชาวบ้านที่วิ่งผ่านหน้า': 'Ton steps out from behind the tree and watches the villagers running past',
  'ชาวบ้านที่วิ่งผ่านหน้า': 'ancient villagers in cotton clothes running past in panic',
  'ต้นกับทหารทะเลาะกันเสียงดัง': 'Ton and a soldier argue loudly'
};
const shots = chineseDramaShots(clips, opts, TR);
const thaiOutsideQuotes = (p: string) => /[ก-๙]/.test(p.replace(/"[^"]*"/g, ''));

check('angle count: silent 2 (A wide + B reaction), dialogue 2, conflict 5', () => {
  assert.deepEqual(shots.map(s => s.angles.length), [2, 2, 2, 5]);
});
check('every prompt: opening, style suffix (no camera), English outside the quoted dialogue', () => {
  for (const s of shots) for (const a of s.angles) {
    assert.ok(a.prompt.startsWith(CHINESE_DRAMA_OPENING.slice(0, 11)));
    assert.ok(a.prompt.includes(CHINESE_DRAMA_STYLE));
    const speaks = a.prompt.includes('speaks Thai exactly');
    assert.ok(a.prompt.replace(/(effects\.) No [^.]+\.$/, "$1").endsWith(speaks ? AUDIO_SPEECH : AUDIO_SILENT), a.prompt);
    assert.ok(!(speaks && a.prompt.includes(AUDIO_SILENT)) && !(!speaks && a.prompt.includes(AUDIO_SPEECH)));
    assert.ok(!/Static camera on dialogue|push-in on emotional/i.test(CHINESE_DRAMA_STYLE));
    assert.ok(!thaiOutsideQuotes(a.prompt), a.prompt);
    assert.ok(a.prompt.includes('border jungle'));
  }
  assert.deepEqual(shots.flatMap(s => s.untranslated), []);
});
check('one camera instruction per angle: static speaker, push-in listener', () => {
  for (const s of shots) for (const a of s.angles) {
    const n = (a.prompt.match(/static camera|slow push-in/gi) || []).length;
    assert.equal(n, 1, a.prompt);
  }
  assert.ok(/static camera/.test(shots[2].angles[0].prompt) && /Locked-off static camera on a tripod, no camera movement, no zoom, no shake./.test(shots[2].angles[1].prompt) && !/push-in/.test(shots[2].angles[1].prompt));
});
check('listener from the previous shot; on-screen face lock only; no line in listener angle', () => {
  const b17 = shots[1].angles[1].prompt;
  assert.ok(b17.includes('Close-up on Ton, face only, hands out of frame. Locked-off static camera on a tripod') && b17.includes('hides behind a huge tree'));
  assert.ok(b17.includes('Photo 2 is Ton') && !b17.includes('attach') && !b17.includes('a male villager'), b17);
  assert.deepEqual(shots[1].angles[1].attachments.map(a => a.label), ['ป่าชายแดน Master', 'ต้น'].map((x, i) => i ? x : `ภาพมาสเตอร์ ${x}`));
  assert.ok(!b17.includes('the people or scene'));
  const b18 = shots[2].angles[1].prompt;
  assert.ok(b18.includes('villagers in cotton clothes running past') && !/Photo [0-9] is/.test(b18));
  for (const s of shots.slice(1, 3)) {
    assert.ok(s.angles[1].prompt.includes(AUDIO_SILENT));
    assert.ok(!s.angles[1].prompt.includes('speaks Thai'));
    assert.ok(s.angles[0].prompt.includes('speaks Thai exactly: "'));
  }
  assert.ok(shots[0].angles[0].prompt.includes('navy t-shirt') && shots[0].angles[0].prompt.includes(AUDIO_SILENT));
});
check('Thai editing notes: L-cut, J-cut, cut length 1.5–3 s', () => {
  assert.ok(shots[2].notes.some(n => n.startsWith('L-cut')));
  assert.ok(shots[1].notes.some(n => n.includes('J-cut')));
  for (const s of shots) for (const a of s.angles) assert.ok(a.seconds >= 1.5 && a.seconds <= 3);
});
check('offline fallback: no translations -> glossary for time/light, Thai kept and reported', () => {
  const s = formatChineseDramaShot(clips[0], opts);
  assert.ok(s.angles[0].prompt.includes('at midday'));
  assert.ok(s.untranslated.length > 0);
  assert.ok(dramaTranslatables(clips, opts).includes('ป่าชายแดน'));
});
if (process.env.PRINT_SAMPLE) console.log(formatAllChineseDrama(clips.slice(0, 3), opts, TR));
console.log(`chineseDrama: ${passed} passed`);
