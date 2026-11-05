/** 1.9.68: inline speech (พูดว่า …), ผู้ฟัง / ภาพ lines, several locations (tags or keywords), per-shot time. */
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { parseShotScript } from '../src/services/shotScript';
import { chineseDramaShots, characterNote } from '../src/services/metaAiPrompt';
import { metaOptionsForStory } from '../src/services/storyProgress';

const raw = readFileSync(new URL('./fixtures/script_full.txt', import.meta.url), 'utf8');
let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✔ ${name}`); };
const lib: any[] = [{ id: 'c1', name: 'ต้น', appearance: 'ชายไทยอายุ 28', outfit: 'เสื้อยืดสีกรมท่า กางเกงยีนส์สีเข้ม', referenceImageUrl: 'https://example.com/ton.jpg' }];
const run = (text: string) => {
  const s = parseShotScript(text)!;
  const base: any = metaOptionsForStory(text, lib, characterNote);
  const opts: any = { ...base, knownCharacters: [...s.knownCharacters, 'ต้น'], characterNotes: { ...s.characterNotes, ...base.characterNotes }, locationNotes: s.locationNotes };
  return { s, shots: chineseDramaShots(s.clips as any, opts, s.translations) };
};
const { s, shots } = run(raw);
const clip = (n: number) => s.clips.find(c => c.clipNumber === n)!;
const shot = (n: number) => shots.find(x => x.shotNumber === n)!;
const P = (n: number) => shot(n).angles.map(a => a.prompt).join('\n');

check('inline speech: "ชายแก่หยุดมองต้น พูดว่า "…"" = action + speaker + line; ผู้ฟัง sets the listener', () => {
  const c = clip(19);
  assert.deepEqual(c.dialogues, [{ speaker: 'ชายแก่', line: 'เอ็งยังไม่หนีอีกหรือ!' }]);
  assert.equal(c.scriptAction, 'ชายแก่หยุดมองต้น');
  assert.ok(P(19).includes('The old man: an old Thai villager, 65, white hair, cotton clothes.'));
  assert.ok(P(19).includes('The old man stops and looks at Ton'));
  assert.deepEqual(shot(19).angles[1].onScreen, ['ต้น']);
  assert.equal(clip(20).dialogues[0].speaker, 'บัวแก้ว');
  assert.equal(clip(65).dialogues[0].speaker, 'เด็กหญิง');
  assert.equal(shot(36).angles[1].onScreen[0], 'แม่ทัพศรชัย');
});
check('ภาพ / ผู้ฟัง are never speakers', () => {
  for (const c of s.clips) for (const d of c.dialogues) assert.ok(!/^(?:ภาพ|ผู้ฟัง)$/.test(d.speaker));
  assert.equal(clip(4).scriptAction, 'ต้นหมดสติอยู่ในรถ');
});
check('several locations: per-shot tags carry forward; photo 1 note on every change', () => {
  const loc = (n: number) => clip(n).locationName;
  assert.equal(loc(3), 'ถนนชนบท'); assert.equal(loc(11), 'ป่าชายแดน'); assert.equal(loc(30), 'ค่ายทหาร');
  assert.equal(loc(35), 'ศาลาบัญชาการ'); assert.equal(loc(43), 'เพิงรักษา'); assert.equal(loc(73), 'หมู่บ้านริมคลอง');
  assert.ok(!s.clips.some(c => /,/.test(c.locationName || '')));
  assert.ok(shot(41).notes.some(n => /เปลี่ยนสถานที่: แนบรูปที่ 1 = ภาพมาสเตอร์ เพิงรักษา/.test(n)));
  assert.ok(!shot(43).notes.some(n => /เปลี่ยนสถานที่/.test(n)));
  assert.ok(/at night, heavy rain/.test(P(3)) && /infirmary hut at night/.test(P(43)));
});
check('no tags: location inferred from keywords in the action, carried forward', () => {
  const r = run(raw.replace(/^(?:สถานที่|เวลา):.*$/gm, l => (/ถนนชนบท, ป่า/.test(l) || /^เวลา: กลางคืน ฝนตกหนัก$/.test(l) && raw.indexOf(l) < raw.indexOf('ช็อต 1')) ? l : ''));
  const loc = (n: number) => r.s.clips.find(c => c.clipNumber === n)!.locationName;
  assert.equal(loc(1), 'ถนนชนบท'); assert.equal(loc(11), 'ป่าชายแดน'); assert.equal(loc(30), 'ค่ายทหาร');
  assert.equal(loc(36), 'ศาลาบัญชาการ'); assert.equal(loc(41), 'เพิงรักษา'); assert.equal(loc(43), 'เพิงรักษา'); assert.equal(loc(61), 'หมู่บ้านริมคลอง');
});
check('English everywhere outside the quoted dialogue; angles <= 100 words', () => {
  for (const sh of shots) for (const a of sh.angles) {
    assert.ok(!/[ก-๙]/.test(a.prompt.replace(/"[^"]*"/g, '')), a.prompt);
    assert.ok(a.prompt.split(/\s+/).length <= 100, a.prompt);
    assert.ok(a.prompt.includes('Chinese drama style, warm-teal grade.'));
  }
  assert.ok(P(20).includes('Buakaew') && P(41).includes('Healer In') && P(35).includes('General Sornchai'));
  assert.ok(P(45).includes('wounded soldier'));
});
console.log(`shotScriptMulti: ${passed} passed`);
