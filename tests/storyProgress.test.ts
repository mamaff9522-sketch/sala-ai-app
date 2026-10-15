import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findResumePoint, checkEpisodeOrder } from '../src/services/storyProgress';
import { buildSalaMultiClipPrompts } from '../src/services/salaDirectorEngine';
import { formatClipForMetaAi, formatAllClipsForMetaAi, charactersInClip } from '../src/services/metaAiPrompt';
import { toCharacterLockPayload } from '../src/services/characterAppearance';

const here = path.dirname(fileURLToPath(import.meta.url));
const rd = (f: string) => fs.readFileSync(path.join(here, 'fixtures', f), 'utf8');
const STORY = rd('t67-story.txt');
let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✔ ${name}`); };

const EP1 = [
  { dialogues: [{ line: 'ไปไหนมา ทำไมกลับช้าขนาดนี้?' }, { line: 'ไปธุระมานิดหน่อยเอง พี่ทุยจะถามอะไรเยอะแยะเนี่ย' }] },
  { dialogues: [{ line: 'ใครโทรมา ทำไมต้องรีบปิด?' }, { line: 'เพื่อนโทรมา ไม่มีอะไรหรอก' }, { line: 'เพื่อนหรือใครกันแน่?' }] }
];

check('a new story starts at the first line', () => {
  const r = findResumePoint(STORY, []);
  assert.equal(r.nextIndex, 0);
  assert.equal(r.sourceLines.length, 11);
});

check('continuing resumes right after the last written line', () => {
  const r = findResumePoint(STORY, EP1);
  assert.equal(r.lastWrittenLine, 'เพื่อนหรือใครกันแน่?');
  assert.ok(r.remainingText.startsWith('น้องน้ำเริ่มทำหน้าจริงจัง'));
  assert.ok(r.remainingText.includes('ฉากที่ 3'));
  assert.ok(!r.remainingText.includes('ใครโทรมา'));
});

check('an episode that jumps from the middle to the ending is caught and trimmed', () => {
  const r = findResumePoint(STORY, EP1);
  const jump = [
    { dialogues: [{ dialogue: 'ถ้าไม่เชื่อก็ดูเลย น้ำไม่ได้มีใคร' }] },
    { dialogues: [{ dialogue: 'งั้นคืนนี้พาไปกินหมูกระทะเป็นการไถ่โทษ' }, { dialogue: 'อ้าว สุดท้ายพี่เสียเงินอีกแล้วเหรอ!' }] }
  ];
  const c = checkEpisodeOrder(jump, r);
  assert.equal(c.keepSceneCount, 1, 'only the scene before the jump is kept');
  assert.ok(c.skippedLines.includes('พี่ไม่ได้อยากค้นโทรศัพท์ พี่แค่กลัวว่าน้ำจะไม่รักพี่แล้ว'));
  assert.equal(c.allLinesCovered, false);
});

check('an episode that starts at the ending keeps nothing', () => {
  const r = findResumePoint(STORY, EP1);
  const c = checkEpisodeOrder([{ dialogues: [{ dialogue: 'อ้าว สุดท้ายพี่เสียเงินอีกแล้วเหรอ!' }] }], r);
  assert.equal(c.keepSceneCount, 0);
  assert.ok(c.skippedLines.length >= 5);
});

check('an episode written in order passes, and the story counts as covered only at the end', () => {
  const r = findResumePoint(STORY, EP1);
  const mid = checkEpisodeOrder([{ dialogues: [{ dialogue: 'ถ้าไม่เชื่อก็ดูเลย น้ำไม่ได้มีใคร' }, { dialogue: 'พี่ไม่ได้อยากค้นโทรศัพท์ พี่แค่กลัวว่าน้ำจะไม่รักพี่แล้ว' }] }], r);
  assert.deepEqual(mid.skippedLines, []);
  assert.equal(mid.allLinesCovered, false);
  const rest = r.sourceLines.slice(r.nextIndex).map(l => ({ dialogue: l }));
  const end = checkEpisodeOrder([{ dialogues: rest.slice(0, 2) }, { dialogues: rest.slice(2) }], r);
  assert.deepEqual(end.skippedLines, []);
  assert.equal(end.allLinesCovered, true);
});

check('Meta AI format: photo mapping instead of library text, no internal notes, Thai dialogue kept', () => {
  const chars = [
    { id: 'char_tui', name: 'พี่ทุย', appearance: rd('charlib/ptui-appearance.txt'), hairStyle: rd('charlib/ptui-hair.txt'), outfit: 'white t-shirt' },
    { id: 'char_nam', name: 'น้องน้ำ', appearance: rd('charlib/nongnam-appearance.txt'), hairStyle: rd('charlib/nongnam-hair.txt'), outfit: 'yellow dress' }
  ].map(c => toCharacterLockPayload(c));
  const clips = buildSalaMultiClipPrompts({ scriptText: STORY, clipDurationSeconds: 8, clipCount: 3, continuityLock: {}, characters: chars as any });
  const meta = formatClipForMetaAi(clips[0], { aspectRatio: '9:16', knownCharacters: ['พี่ทุย', 'น้องน้ำ'] });
  assert.ok(meta.length < clips[0].generatedPrompt.length / 3, 'much shorter than the full prompt');
  assert.ok(meta.includes('รูปที่ 1 = พี่ทุย') && meta.includes('รูปที่ 2 = น้องน้ำ'));
  assert.ok(meta.includes('"ไปไหนมา ทำไมกลับช้าขนาดนี้?"'));
  assert.ok(meta.includes('วิดีโอยาว 8 วินาที') && meta.includes('9:16'));
  for (const gone of ['ผูกพรอมต์นี้', 'Continuity Handoff', 'Stance/Position Lock', 'Negative', 'ไม่ระบุ', 'water buffalo']) {
    assert.ok(!meta.includes(gone), `no "${gone}"`);
  }
  assert.deepEqual(charactersInClip(clips[0], ['พี่ทุย', 'น้องน้ำ']), ['พี่ทุย', 'น้องน้ำ']);
  const all = formatAllClipsForMetaAi(clips, { knownCharacters: ['พี่ทุย', 'น้องน้ำ'] });
  assert.ok(all.includes(`คลิป ${clips.length}/${clips.length}`));
  assert.ok(!all.includes('Negative Prompt'));
});

check('Meta AI format: a silent clip says nobody speaks', () => {
  const meta = formatClipForMetaAi({ durationSeconds: 8, generatedPrompt: 'Location: ป่า. Core action: ฟ้าใสกำลังเดินเข้าป่า.', dialogues: [] });
  assert.ok(meta.includes('ตัวละครไม่พูด'));
  assert.ok(!meta.includes('พูดภาษาไทยตามบท'));
});

console.log(`\nstory progress + Meta AI format: ${passed} passed`);

{
  const { salvageEpisodeJson } = await import('../src/services/storyProgress');
  const full = JSON.stringify({ isStoryFinished: false, episodeTitle: 'ตอนที่ 1: "หึง"', progressPercentage: 30, sourceCovered: true,
    scenes: [{ sceneNumber: 1, sceneHeading: 'ฉาก {1}', dialogues: [{ dialogue: 'ไปไหนมา?' }] }, { sceneNumber: 2, sceneHeading: 'ฉาก 2', visualPrompt: 'long text' }] });
  const cut = full.slice(0, full.indexOf('long text') + 4);
  const s = salvageEpisodeJson(cut);
  assert.equal(s.scenes.length, 1, 'only the complete scene is kept');
  assert.equal(s.scenes[0].sceneHeading, 'ฉาก {1}');
  assert.equal(s.episodeTitle, 'ตอนที่ 1: "หึง"');
  assert.equal(s.sourceCovered, false, 'a cut-off reply never counts as the end of the story');
  assert.equal(salvageEpisodeJson('{"scenes": [{"sceneNumber": 1, "x": "unfinished'), null);
  console.log('  ✔ a reply cut off mid-way keeps its complete scenes');
}

{
  const { splitDenseDialogueScenes } = await import('../src/services/storyProgress');
  const L = ['พี่ทุย! มานี่เร็ว มาดูอีนี่สิ มันโพสต์อวดรถใหม่อีกแล้ว!', 'แล้วมันเกี่ยวอะไรกับเอ็งวะ? รถมัน เงินมัน!', 'โอ๊ย! ฉันหมั่นไส้มัน อยากด่ามันสักหน่อย!', 'ก็ไปด่ามันสิ!', 'จะบ้าเหรอ! ใช้เฟซจริงด่า เดี๋ยวชาวบ้านก็รู้หมด!', 'ก็ใช้เฟซอวตารที่เราสมัครไว้ไง ใครมันจะไปรู้ว่าเป็นเรา!', 'เออจริงด้วย! พี่ใช้เฟซหนึ่ง ฉันใช้อีกเฟซหนึ่ง แล้วช่วยกันคอมเมนต์!'];
  const ds = L.map((l, i) => ({ speaker: i % 2 ? 'พี่ทุย' : 'น้องน้ำ', dialogue: l }));
  const vp = 'Cinematic. Dialogue: ' + ds.map(d => `[${d.speaker}]: ${d.dialogue}`).join(' ') + ' They laugh together happily. Character Lock: X.';
  const out = splitDenseDialogueScenes([{ sceneNumber: 5, sceneHeading: 'ฉากที่ 1', dialogues: ds, visualPrompt: vp, endState: 'หัวเราะ' }], 8);
  assert.ok(out.length >= 3, 'a 7-line scene is not one 8-second clip');
  assert.deepEqual(out.map(s => s.sceneNumber), out.map((_, i) => 5 + i));
  assert.deepEqual(out.flatMap(s => s.dialogues.map((d: any) => d.dialogue)), L, 'every line once, in order');
  for (const s of out) {
    for (const d of ds) assert.equal(s.visualPrompt.includes(d.dialogue), s.dialogues.includes(d), 'each prompt has only its own lines');
    assert.ok(s.visualPrompt.includes('Character Lock: X.'), 'locks stay in every part');
  }
  assert.equal(out.filter(s => s.visualPrompt.includes('laugh')).length, 1, 'the closing action only in the last part');
  assert.equal(out[out.length - 1].endState, 'หัวเราะ');
  const short = splitDenseDialogueScenes([{ sceneNumber: 1, dialogues: ds.slice(3, 4), visualPrompt: 'x' }], 8);
  assert.equal(short.length, 1, 'a short scene stays one clip');
  console.log(`  ✔ a long dialogue scene becomes ${out.length} clips in order`);
}
