/** Shot-by-shot script (ช็อต 11–28): one shot = one clip, header locks, cast per shot, props, sound -> reaction, script camera. */
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { parseShotScript, isShotScript } from '../src/services/shotScript';
import { chineseDramaShots, characterNote, AUDIO_SPEECH, AUDIO_SILENT } from '../src/services/metaAiPrompt';
import { metaOptionsForStory } from '../src/services/storyProgress';

const raw = readFileSync(new URL('./fixtures/script_11_28.txt', import.meta.url), 'utf8');
let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✔ ${name}`); };
const lib: any[] = [{ id: 'c1', name: 'ต้น', appearance: 'ชายไทยอายุ 28', outfit: 'เสื้อยืดสีกรมท่า', referenceImageUrl: 'https://example.com/ton.jpg' }];
const s = parseShotScript(raw)!;
const base: any = metaOptionsForStory(raw, lib, characterNote);
const opts: any = { ...base, knownCharacters: [...s.knownCharacters, 'ต้น'], characterNotes: { ...s.characterNotes, ...base.characterNotes }, locationNotes: s.locationNotes };
const shots = chineseDramaShots(s.clips as any, opts, s.translations);
const byN = (n: number) => shots.find(x => x.shotNumber === n)!;
const P = (n: number) => byN(n).angles.map(a => a.prompt).join('\n');
const thaiOut = (p: string) => /[ก-๙]/.test(p.replace(/"[^"]*"/g, ''));

check('ช็อต labels: 18 clips numbered 11–28, also คลิป / ฉาก labels', () => {
  assert.ok(isShotScript(raw));
  assert.deepEqual(s.clips.map(c => c.clipNumber), Array.from({ length: 18 }, (_, i) => 11 + i));
  assert.equal(parseShotScript(raw.replace(/ช็อต/g, 'คลิป'))!.clips.length, 18);
  assert.equal(parseShotScript(raw.replace(/ช็อต/g, 'ฉาก'))!.clips[0].clipNumber, 11);
});
check('header = locks on every clip, not shots; duration from the script', () => {
  for (const sh of shots) for (const a of sh.angles) {
    assert.ok(a.prompt.includes('Location lock: the border forest') && a.prompt.includes('early morning'), a.prompt);
    assert.ok(a.prompt.includes("No modern buildings, roads, vehicles or technology in the forest, except Ton's phone."));
    assert.ok(a.prompt.includes('10 seconds') && a.prompt.includes('Continuity: same outfits'));
    assert.ok(!thaiOut(a.prompt), a.prompt);
    assert.equal(a.attachments[0]?.n, 1);
  }
});
check('cast per shot: villagers not lingering, numbered soldiers kept whole and distinct', () => {
  assert.ok(!byN(20).angles.some(a => a.onScreen.some(n => /ชาวบ้าน|ชายชรา/.test(n))));
  assert.deepEqual(byN(21).angles[3].onScreen, ['ทหารคนที่ 1', 'ทหารคนที่ 2', 'ทหารคนที่ 3']);
  const looks = ['ทหารคนที่ 1', 'ทหารคนที่ 2', 'ทหารคนที่ 3'].map(n => s.characterNotes[n]);
  assert.equal(new Set(looks).size, 3);
  assert.ok(P(21).includes('the three Suriyanakhon soldiers'));
});
check('self-talk -> POV of what the speaker sees', () => {
  assert.ok(P(15).includes('Cart-wheel tracks') && P(13).includes('no road or wall'));
  assert.ok(P(14).includes('phone screen') && P(14).includes('18%'));
});
check('props lock: same phone, battery 18% from shot 14', () => {
  assert.ok(P(14).includes('Props lock') && P(26).includes('Props lock') && P(26).includes('18%'));
});
check('sounds become reactions, audio stays speech-only plus "No <sound>"', () => {
  assert.ok(P(16).includes('reacts as if hearing many footsteps') && P(16).includes(`${AUDIO_SILENT} No footsteps.`));
  assert.ok(P(20).includes('reacts as if hearing distant war drums') && P(20).includes(`${AUDIO_SPEECH} No distant war drums.`));
  assert.ok(!/drum (?:sound|beat)s? (?:plays|in the audio)/i.test(P(20)));
});
check('script camera: wide stays wide, one camera, no camera words in action', () => {
  const a = byN(11).angles[0].prompt;
  assert.ok(a.includes('Wide shot of the border forest') && a.includes('slow tilt down'));
  assert.ok(!/Action:[^.]*(camera|wide shot)/i.test(a));
});
check('conflict words (มัด, ค้น, ชี้ดาบ) -> 5 angles; no dialogue echoed as action', () => {
  for (const n of [25, 26, 28]) assert.equal(byN(n).kind, 'conflict', String(n));
  for (const sh of shots) for (const a of sh.angles) { const m = a.prompt.match(/Action: ([^.]*)\./); assert.ok(!m || !/[ก-๙]/.test(m[1])); }
});
check('role English: the old man, a male villager, Suriyanakhon', () => {
  assert.ok(P(19).includes('the old man') && !/Chaichara/i.test(shots.map(x => P(x.shotNumber)).join()));
  assert.ok(/male villager/.test(P(17)) && !/chaobanchai/i.test(P(17)));
});
check('every shot has A + B; no generic hero / key object; face refs only for people in the angle', () => {
  for (const sh of shots) {
    assert.ok(sh.angles.length >= 2, String(sh.shotNumber));
    for (const a of sh.angles) {
      assert.ok(!/\bhero\b|key object/i.test(a.prompt), a.prompt);
      assert.equal(a.attachments[0].n, 1);
      const refs = (a.prompt.match(/photo \d+ is the face reference/g) || []).length;
      assert.equal(refs, a.attachments.length - 1);
      assert.ok(a.attachments.slice(1).every(x => a.onScreen.includes(x.label)));
    }
  }
  assert.ok(/Wide shot/.test(byN(16).angles[0].prompt) && /Close-up reaction shot of Ton/.test(byN(16).angles[1].prompt));
  assert.ok(/phone/.test(byN(26).angles[4].prompt) && /rope/.test(byN(28).angles[4].prompt));
});
console.log(`shotScript: ${passed} passed`);
