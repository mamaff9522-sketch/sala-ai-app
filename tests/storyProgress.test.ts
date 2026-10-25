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
  assert.ok(meta.length < clips[0].generatedPrompt.length / 2, 'much shorter than the full prompt');
  assert.ok(/รูปที่ \d คือรูปโปรไฟล์อ้างอิงของพี่ทุย/.test(meta) && /รูปที่ \d คือรูปโปรไฟล์อ้างอิงของน้องน้ำ/.test(meta));
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

{
  const { formatAllClipsForMetaAi } = await import('../src/services/metaAiPrompt');
  const clips = buildSalaMultiClipPrompts({ scriptText: STORY, clipDurationSeconds: 8, clipCount: 1, continuityLock: {} });
  const blocks = formatAllClipsForMetaAi(clips, { knownCharacters: ['พี่ทุย', 'น้องน้ำ'] }).split('\n\n');
  assert.equal(blocks.length, clips.length);
  for (const b of blocks) {
    assert.ok(b.includes('ล็อกฉาก (รูปที่ 1 คือภาพมาสเตอร์ "หน้าบ้าน Master"): สถานที่ หน้าบ้าน'), 'every clip locks the set, inherited when the heading names none');
    assert.ok(b.includes('ท่าจบคลิป'), 'every clip locks its end pose');
    assert.ok(!/ท่าจบคลิป[^.]*เดิน/.test(b), 'no one is still walking at the hand-off');
  }
  const endOf = (b: string) => (b.match(/ท่าจบคลิป \(ค้างไว้ส่งต่อคลิปถัดไป\): ([^.]*)\./) || [])[1];
  const startOf = (b: string) => (b.match(/ท่าเริ่มคลิป \(ต่อเนื่องจากคลิปก่อน ตำแหน่งเดิมเป๊ะ[^)]*\): ([^.]*)\./) || [])[1];
  for (let i = 1; i < blocks.length; i++) assert.equal(startOf(blocks[i]), endOf(blocks[i - 1]), `clip ${i + 1} starts where clip ${i} ends`);
  console.log('  ✔ Meta AI prompts lock the set and hand the end pose to the next clip');
  // A clip at a new place starts fresh: nothing carried from the previous clip
  const { formatClipForMetaAi, metaContextFor } = await import('../src/services/metaAiPrompt');
  const moved = [{ ...clips[0] }, { ...clips[1], locationName: 'ร้านหมูกระทะ', timeOfDay: 'กลางคืน' }];
  const m = formatClipForMetaAi(moved[1], metaContextFor(moved as any, 1));
  assert.ok(m.includes('): สถานที่ ร้านหมูกระทะ เวลา กลางคืน'));
  assert.ok(!m.includes('ต่อเนื่องจากคลิปก่อน'), 'no pose carried across a change of place');
  console.log('  ✔ a change of place starts a new set-up, no carried pose');
}

{
  const { formatAllClipsForMetaAi, characterNote } = await import('../src/services/metaAiPrompt');
  const lib = [
    { name: 'พี่ทุย', appearance: rd('charlib/ptui-appearance.txt'), outfit: 'Indigo-blue Thai cotton shirt' },
    { name: 'น้องน้ำ', appearance: rd('charlib/nongnam-appearance.txt'), outfit: 'Deep red silk sabai' }
  ];
  const clips = buildSalaMultiClipPrompts({ scriptText: STORY, clipDurationSeconds: 8, clipCount: 1, continuityLock: {} });
  const notes = Object.fromEntries(lib.map(c => [c.name, characterNote(c)]));
  const blocks = formatAllClipsForMetaAi(clips, { knownCharacters: ['พี่ทุย', 'น้องน้ำ'], photoOrder: ['พี่ทุย', 'น้องน้ำ'], characterNotes: notes }).split('\n\n');
  for (const b of blocks) {
    if (b.includes('= พี่ทุย')) assert.ok(b.includes('รูปที่ 1 = พี่ทุย'), 'พี่ทุย is always photo 1');
    if (b.includes('= น้องน้ำ')) assert.ok(b.includes('รูปที่ 2 = น้องน้ำ'), 'น้องน้ำ is always photo 2, even when she speaks first');
    assert.ok(b.includes('ห้ามกลายเป็นมนุษย์'), 'identity lock in every clip');
  }
  assert.ok(notes['น้องน้ำ'].length > 20 && notes['น้องน้ำ'].length < 260);
  console.log('  ✔ photo numbers are fixed for the whole story and identity is locked');
}

{
  const { restoreMissingStoryBeats, isLineCovered } = await import('../src/services/storyProgress');
  const AV = rd('avatar-story.txt');
  const lineOf = (s: string) => ({ line: s });
  const ep1 = [{ dialogues: ['พี่ทุย! มานี่เร็ว มาดูอีนี่สิ มันโพสต์อวดรถใหม่อีกแล้ว!', 'แล้วมันเกี่ยวอะไรกับเอ็งวะ? รถมัน เงินมัน!', 'โอ๊ย! ฉันหมั่นไส้มัน อยากด่ามันสักหน่อย!', 'ก็ไปด่ามันสิ!', 'จะบ้าเหรอ! ใช้เฟซจริงด่า เดี๋ยวชาวบ้านก็รู้หมด!', 'ก็ใช้เฟซอวตารที่เราสมัครไว้ไง ใครมันจะไปรู้ว่าเป็นเรา!', 'เออจริงด้วย! พี่ใช้เฟซหนึ่ง ฉันใช้อีกเฟซหนึ่ง แล้วช่วยกันคอมเมนต์!'].map(lineOf) }];
  const resume = findResumePoint(AV, ep1);
  const D = (speaker: string, dialogue: string) => ({ speaker, dialogue });
  // Gemini-like episode: summaries without the action lines, one dialogue line dropped
  const gem = [
    { dialogues: [D('น้องน้ำ', 'พี่! มันตอบกลับมาแล้ว!'), D('พี่ทุย', 'มันว่าไง?')], visualPrompt: 'Cinematic. Core action: she looks at her phone. Dialogue: [น้องน้ำ]: "พี่! มันตอบกลับมาแล้ว!" [พี่ทุย]: "มันว่าไง?". Continuity Handoff: both present.' },
    { dialogues: [D('น้องน้ำ', 'มันบอกว่า... ไอ้เฟซนี้ ส่งรูปควายเป็นโปรไฟล์ ต้องเป็นไอ้ทุยแน่ๆ!'), D('น้องน้ำ', '...พี่ไง')], visualPrompt: 'Cinematic. Core action: shocked. Dialogue: [น้องน้ำ]: "มันบอกว่า... ไอ้เฟซนี้ ส่งรูปควายเป็นโปรไฟล์ ต้องเป็นไอ้ทุยแน่ๆ!" [น้องน้ำ]: "...พี่ไง".' },
    { dialogues: [D('ป้าร้านค้า', 'อ้าว! สองคนนี้นี่เอง เฟซควายกับเฟซตุ๊กแก ทั้งหมู่บ้านรู้กันหมดแล้วจ้า!')], visualPrompt: 'Cinematic. Dialogue: [ป้าร้านค้า]: "อ้าว! สองคนนี้นี่เอง เฟซควายกับเฟซตุ๊กแก ทั้งหมู่บ้านรู้กันหมดแล้วจ้า!".' }
  ];
  const r = restoreMissingStoryBeats(gem as any, AV, { fromDialogueIndex: resume.nextIndex });
  const all = r.scenes.map((s: any) => s.visualPrompt).join('\n');
  for (const w of ['แสงแดดเริ่มอ่อนลง ทั้งคู่ยังนั่งพิมพ์อยู่บนแคร่', 'พี่ทุยชะโงกหน้ามาดูจอ', 'พี่ทุยสะดุ้ง ทำโทรศัพท์หล่นลงพื้น', 'ป้าเจ้าของร้านเงยหน้ามองแล้วยิ้มกว้าง', 'พี่ทุยกับน้องน้ำหันมองหน้ากัน แล้ววิ่งหนีออกจากร้าน']) {
    assert.ok(isLineCovered(w, all), `restored: ${w}`);
  }
  assert.ok(!isLineCovered('พี่ทุยวางจอบพิงเสา แล้วเดินมานั่งข้างน้องน้ำ', all), 'lines of earlier episodes are not repeated');
  const s2: any = r.scenes[1];
  assert.deepEqual(s2.dialogues.map((d: any) => d.dialogue), ['มันบอกว่า... ไอ้เฟซนี้ ส่งรูปควายเป็นโปรไฟล์ ต้องเป็นไอ้ทุยแน่ๆ!', 'ฉิบหายแล้ว! ใครใช้รูปควายเป็นโปรไฟล์วะ!', '...พี่ไง'], 'dropped dialogue back in story order');
  assert.ok(s2.visualPrompt.indexOf('ฉิบหายแล้ว') < s2.visualPrompt.indexOf('...พี่ไง'), 'and in that order in the prompt');
  assert.ok(s2.visualPrompt.includes('"มันบอกว่า... ไอ้เฟซนี้'), '"..." inside dialogue survives');
  // Offline paths keep the whole story (checked against the same file)
  const clipsAV = buildSalaMultiClipPrompts({ scriptText: AV, clipDurationSeconds: 8, clipCount: 1, continuityLock: {} });
  const allAV = clipsAV.map(c => c.generatedPrompt).join('\n');
  const storyLines = AV.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^(ชื่อเรื่อง|ตัวละคร|- |ฉากที่|จบ)/.test(l)).map(l => l.replace(/^[^:：]{1,20}[:：]\s*/, ''));
  assert.deepEqual(storyLines.filter(l => !isLineCovered(l, allAV)), [], 'director keeps every story line');
  console.log(`  ✔ lines Gemini drops are put back (${r.restoredActions} actions, ${r.restoredDialogues} dialogue), in story order`);
}

{
  const { offlineContinuation, isLineCovered } = await import('../src/services/storyProgress');
  // Run "ต่อเรื่อง" offline episode after episode, like the whole-story button does
  const runAll = (story: string, perEpisode: number) => {
    let clips: any[] = [];
    let episodes = 0;
    for (; episodes < 40; episodes++) {
      const existing = clips.map(c => ({ sceneNumber: c.sceneNumber, sourceCursor: c.sourceCursor, dialogues: (c.dialogues || []).map((d: any) => ({ speaker: d.speaker, line: d.dialogue })) }));
      const last = clips[clips.length - 1];
      const r = offlineContinuation({ originalStory: story, existingScenes: existing, lastSceneState: last ? { sceneNumber: last.sceneNumber, sourceCursor: last.sourceCursor, endPoses: last.endPoses } : null, targetSceneCount: perEpisode, clipDurationSeconds: 8 });
      if (!r.scenes?.length) break;
      clips = clips.concat(r.scenes);
      if (!r.hasMoreScenes) { episodes++; break; }
    }
    return { clips, episodes };
  };
  for (const [file, story] of [['avatar-story.txt', rd('avatar-story.txt')], ['t67-story.txt', STORY]] as const) {
    const storyLines = story.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^(ชื่อเรื่อง|ตัวละคร|- |ฉากที่|จบ)/.test(l)).map(l => l.replace(/^[^:：]{1,20}[:：]\s*/, ''));
    const sizes = new Set<number>();
    for (const per of [1, 2, 6]) {
      const { clips, episodes } = runAll(story, per);
      assert.ok(episodes < 40, `${file}/${per}: the run ends (no endless repeat)`);
      const all = clips.map(c => c.visualPrompt).join('\n');
      assert.deepEqual(storyLines.filter(l => !isLineCovered(l, all)), [], `${file}/${per}: every story line in a prompt`);
      const dl = clips.flatMap(c => (c.dialogues || []).map((d: any) => d.dialogue));
      assert.equal(new Set(dl).size, dl.length, `${file}/${per}: no dialogue twice`);
      assert.deepEqual(clips.map(c => c.sceneNumber), clips.map((_, i) => i + 1), `${file}/${per}: clip numbers 1..n`);
      sizes.add(clips.length);
    }
    assert.equal(sizes.size, 1, `${file}: same clips whatever the chunk size`);
  }
  console.log('  ✔ whole story, chunk after chunk: complete, no repeats, ends (any chunk size)');
}
