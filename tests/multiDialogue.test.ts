import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWholeStory } from '../src/services/wholeStoryRunner';
import { offlineContinuation, metaOptionsForStory } from '../src/services/storyProgress';
import { parseStoryStructure } from '../src/services/storyEpisodeEngine';
import { packMultiDialogueClips, lineSeconds, MULTI_DIALOGUE_SECONDS, SPEECH_SHARE } from '../src/services/multiDialogueClips';
import { formatClipForMetaAi, formatClipImagePrompt, metaContextFor, characterNote, checkPromptProblems, sceneOfClip, samePlace } from '../src/services/metaAiPrompt';

const here = path.dirname(fileURLToPath(import.meta.url));
const rd = (f: string) => fs.readFileSync(path.join(here, 'fixtures', f), 'utf8');
let passed = 0;
const check = async (name: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log(`  ✔ ${name}`); };
const engine = async (story: string) => (await runWholeStory(story, { offline: true, clipSeconds: MULTI_DIALOGUE_SECONDS, maxSteps: 400 },
  async (p: any) => ({ success: true, ...offlineContinuation(p) } as any))).clips;

for (const file of ['multi-dialogue-story.txt', 'faiklaen-225-clips.txt']) {
  await check(`${file}: every line whole, once, in order, with its own speaker; clips continuous and within 10 s`, async () => {
    const story = rd(file);
    const source = parseStoryStructure(story).allDialogues.map(d => ({ speaker: d.speaker, line: d.dialogue }));
    assert.ok(source.length >= 10 && new Set(source.map(d => d.speaker)).size >= 2, 'at least 10 lines from two characters');
    const clips = await engine(story);
    const packed = packMultiDialogueClips(clips);
    // every line exactly once, in story order, never cut, never given to someone else
    const got = packed.flatMap(c => c.dialogues.map(d => ({ speaker: d.speaker, line: d.line })));
    assert.deepEqual(got.map(d => d.line), source.map(d => d.line), 'same lines, same order, word for word');
    assert.deepEqual(got.map(d => d.speaker), source.map(d => d.speaker), 'nobody swapped');
    // continuous numbering, one place per clip, speech fits the clip (a single over-long line keeps its own clip)
    packed.forEach((c, k) => {
      assert.equal(c.clipNumber, k + 1);
      assert.equal(c.durationSeconds, MULTI_DIALOGUE_SECONDS);
      const speech = c.dialogues.reduce((t, d) => t + lineSeconds(d.line), 0);
      if (c.overLong) assert.equal(c.dialogues.length, 1);
      else assert.ok(speech <= MULTI_DIALOGUE_SECONDS * SPEECH_SHARE + 1e-9, `clip ${k + 1}: ${speech.toFixed(1)} s of speech`);
      const places = (c.mergedFrom || []).map(n => sceneOfClip(clips as any, clips.findIndex(x => x.clipNumber === n)));
      assert.ok(places.every(p => samePlace(p.location, places[0].location) && p.timeOfDay === places[0].timeOfDay), `clip ${k + 1} one place`);
    });
    // nothing lost: parts used once each, in order
    assert.deepEqual(packed.flatMap(c => c.mergedFrom || []), clips.map(c => c.clipNumber));
    assert.ok(packed.some(c => new Set(c.dialogues.map(d => d.speaker)).size >= 2), 'a clip with two characters talking');
    assert.ok(packed.length < clips.length || file === 'multi-dialogue-story.txt');
  });
}

await check('prompts of packed clips: numbered lines in order, who speaks when, locks and continuity kept, no conflicts', async () => {
  const story = rd('multi-dialogue-story.txt');
  const packed = packMultiDialogueClips(await engine(story));
  const opts = { ...metaOptionsForStory(story, [], characterNote), aspectRatio: '9:16' };
  packed.forEach((c, i) => {
    const ctx = { ...opts, ...metaContextFor(packed as any, i) };
    const v = formatClipForMetaAi(c as any, ctx);
    const img = formatClipImagePrompt(c as any, ctx);
    assert.deepEqual(checkPromptProblems(v, 'video', ctx.camera), [], `clip ${i + 1} video`);
    assert.deepEqual(checkPromptProblems(img, 'image', ctx.camera), [], `clip ${i + 1} image`);
    assert.ok(v.startsWith(`วิดีโอยาว ${MULTI_DIALOGUE_SECONDS} วินาที`));
    assert.ok(v.includes('ล็อกฉาก: สถานที่') && v.includes('ใบหน้า ทรงผม ชุด และเสียงพูดของแต่ละคนคงเดิมทุกคลิป') && /มุมกล้อง: \S/.test(v));
    let at = -1;
    c.dialogues.forEach((d, k) => {
      const tag = c.dialogues.length > 1 ? `ประโยคที่ ${k + 1} ${d.speaker} พูดว่า "${d.line}"` : `${d.speaker} พูดว่า "${d.line}"`;
      const pos = v.indexOf(tag);
      assert.ok(pos > at, `clip ${i + 1}: line ${k + 1} in order`);
      at = pos;
    });
    if (new Set(c.dialogues.map(d => d.speaker)).size > 1) {
      assert.ok(v.includes('ห้ามสลับคนพูด') && v.includes('ลำดับในคลิป:'), `clip ${i + 1}`);
      c.dialogues.forEach((d, k) => assert.ok(v.includes(`${d.speaker} พูดประโยคที่ ${k + 1}`), `clip ${i + 1} timing of line ${k + 1}`));
    }
    // same place as the clip before: starts exactly where it ended
    const prevSame = i > 0 && samePlace(sceneOfClip(packed as any, i).location, sceneOfClip(packed as any, i - 1).location);
    if (prevSame && (packed[i - 1].endPoses || []).length) assert.ok(v.includes('ท่าเริ่มคลิป (ต่อเนื่องจากคลิปก่อน ตำแหน่งเดิมเป๊ะ'), `clip ${i + 1}`);
    // the still is the first moment, with no dialogue
    for (const d of c.dialogues) assert.ok(!img.includes(d.line));
  });
  // a line longer than one clip is kept whole in its own clip, never cut
  const long = packed.find(c => c.overLong)!;
  assert.ok(long && long.dialogues[0].line.endsWith('ไม่เคยคิดแย่งอะไรจากใครเลย'));
});

await check('switch off: nothing changes (packing only runs when the user turns it on)', async () => {
  const story = rd('multi-dialogue-story.txt');
  const clips = await engine(story);
  const copy = JSON.parse(JSON.stringify(clips));
  packMultiDialogueClips(clips);
  assert.deepEqual(JSON.parse(JSON.stringify(clips)), copy, 'the engine clips are not modified');
  const src = fs.readFileSync(path.join(here, '..', 'src', 'components', 'QuickPromptStudio.tsx'), 'utf8');
  assert.ok(/useState<boolean>\(\(\) => loadJson<boolean>\('sala_quick_multi_dialogue', false\)\)/.test(src), 'off by default');
  assert.ok(/if \(multi && r\.clips\.length > 0\)/.test(src), 'packed only when on');
});

console.log(`\nmulti-dialogue: ${passed} passed`);
