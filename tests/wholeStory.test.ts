import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWholeStory } from '../src/services/wholeStoryRunner';
import { offlineContinuation, isLineCovered, metaOptionsForStory } from '../src/services/storyProgress';
import { parseStoryStructure } from '../src/services/storyEpisodeEngine';
import { formatAllClipsForMetaAi, characterNote } from '../src/services/metaAiPrompt';

const here = path.dirname(fileURLToPath(import.meta.url));
const rd = (f: string) => fs.readFileSync(path.join(here, 'fixtures', f), 'utf8');
let passed = 0;
const check = async (name: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log(`  ✔ ${name}`); };

// Stand-in for the server: the offline engine; the first call fails like "no credits"
const fakeServer = (failFirst: boolean) => {
  let calls = 0;
  return async (payload: any) => {
    calls++;
    if (failFirst && calls === 1 && !payload.offline) throw Object.assign(new Error('เครดิตคงเหลือไม่พอ'), { status: 402 });
    return { success: true, ...offlineContinuation(payload) } as any;
  };
};

for (const file of ['faiklaen-story.txt', 'avatar-story.txt', 't67-story.txt']) {
  await check(`${file}: whole story, every line in exactly one Meta AI prompt`, async () => {
    const story = rd(file);
    const r = await runWholeStory(story, { aspectRatio: '9:16', clipSeconds: 8 }, fakeServer(true));
    assert.equal(r.finished, true);
    assert.equal(r.usedOffline, true);
    assert.ok(r.notices.some(n => n.includes('เครดิตไม่พอ')), 'the switch to no-AI is reported');
    assert.deepEqual(r.clips.map(c => c.clipNumber), r.clips.map((_, i) => i + 1));
    const meta = formatAllClipsForMetaAi(r.clips as any, { ...metaOptionsForStory(story, [], characterNote), aspectRatio: '9:16' }).split('\n\n');
    assert.equal(meta.length, r.clips.length);
    for (const b of parseStoryStructure(story).narrativeBeats) {
      const t = b.type === 'dialogue' ? b.dialogue!.dialogue : b.text;
      const n = meta.filter(m => isLineCovered(t, m)).length;
      assert.equal(n, 1, `"${t.slice(0, 40)}" is in ${n} clips`);
    }
    for (const m of meta) {
      assert.ok(m.includes('ล็อกฉาก'), 'scene lock in every clip');
      assert.ok(m.includes('วิดีโอยาว 8 วินาที') && m.includes('9:16'));
      assert.ok(!/[:：]\s*[.;](\s|$)/.test(m), `no empty cue: ${m.slice(0, 80)}`);
      assert.ok(!/ไม่ระบุ/.test(m), 'no "unspecified" placeholders');
    }
  });
}

await check('ไฟแค้นซ่อนรัก: night rain at the mansion, right speakers, no leftovers from another story', async () => {
  const story = rd('faiklaen-story.txt');
  const r = await runWholeStory(story, { offline: true }, fakeServer(false));
  const meta = formatAllClipsForMetaAi(r.clips as any, metaOptionsForStory(story, [{ name: 'น้องน้ำ', appearance: 'gecko', referenceImageUrl: '/uploads/x.png' }], characterNote));
  assert.ok(meta.includes('สถานที่ คฤหาสน์หรู เวลา กลางคืน ฝนตกหนัก'));
  assert.ok(!meta.includes('น้องน้ำ'), 'a library character not in this story never appears');
  assert.ok(!meta.includes('ละครเรื่อง'), 'the title is not a character');
  assert.deepEqual(r.clips.flatMap(c => c.dialogues.map(d => d.speaker)), ['คุณหญิงมณี', 'น้ำฟ้า']);
  assert.ok(meta.includes('น้ำฟ้า: ลูกสะใภ้สาวฐานะยากจน'), 'character without a photo described from the script');
  assert.ok(!/รูปที่ \d+ = น้ำฟ้า/.test(meta), 'no photo asked for a character without one');
});

await check('stops when asked', async () => {
  let n = 0;
  const r = await runWholeStory(rd('avatar-story.txt'), { offline: true, shouldStop: () => n++ >= 1 }, async (p: any) => ({ success: true, ...offlineContinuation({ ...p, targetSceneCount: 1 }) } as any));
  assert.equal(r.finished, false);
  assert.ok(r.clips.length > 0);
});

console.log(`\nwhole story: ${passed} passed`);
