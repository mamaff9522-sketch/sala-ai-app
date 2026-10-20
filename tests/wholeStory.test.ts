import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWholeStory } from '../src/services/wholeStoryRunner';
import { offlineContinuation, isLineCovered, metaOptionsForStory } from '../src/services/storyProgress';
import { parseStoryStructure } from '../src/services/storyEpisodeEngine';
import { formatAllClipsForMetaAi, formatClipForMetaAi, characterNote } from '../src/services/metaAiPrompt';
import { analyzeClipContinuity } from '../src/services/continuityEngine';
import { isClipByClipScript } from '../src/services/storyNormalize';

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

for (const file of ['faiklaen-story.txt', 'avatar-story.txt', 't67-story.txt', 'nongnam-clips-story.txt', 'moradok-notes-story.txt']) {
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

await check('Gemini scene text without the lines: dialogue is still in the Meta AI prompt', () => {
  const clip: any = { clipNumber: 1, durationSeconds: 10, locationName: 'ห้องโถงบ้าน', charactersPresent: ['แพรวา', 'น้องน้ำ'],
    generatedPrompt: 'Cinematic 8K, medium shot, แพรวา shouting with anger.',
    dialogues: [{ speaker: 'แพรวา', line: 'ออกไปจากบ้านฉัน!' }, { speaker: 'น้องน้ำ', line: 'ไม่มีวัน' }] };
  const m = formatClipForMetaAi(clip, { knownCharacters: ['แพรวา', 'น้องน้ำ'] });
  assert.ok(m.includes('แพรวา speaks: "ออกไปจากบ้านฉัน!"') && m.includes('น้องน้ำ speaks: "ไม่มีวัน"'), m);
  assert.ok(m.indexOf('ออกไปจากบ้านฉัน') < m.indexOf('ไม่มีวัน'), 'lines stay in order');
});

await check('poses: "เผชิญหน้ากับ…" is not a place, places are never cut mid-word', () => {
  const pl = (t: string) => analyzeClipContinuity({ clips: [{ text: t }], lockedCharacters: ['แพรวา', 'น้องน้ำ'] }).clips[0].endPoses.map((p: any) => p.place).filter(Boolean).join('|');
  assert.equal(pl('แพรวายืนเผชิญหน้ากับน้องน้ำด้วยท่าทางเกรี้ยวกราด'), '');
  assert.equal(pl('น้องน้ำยืนอยู่ที่หน้าประตูบ้านด้วยสีหน้าเรียบเฉย'), 'ที่หน้าประตูบ้าน');
});

await check('character note: whole parts only, nothing "not visible"', () => {
  const n = characterNote({ appearance: 'ประเภท: reptile (กิ้งก่า), ผิว/เกล็ด: เกล็ดสีเขียว มีจุดดำ, รูปหน้า: หัวกิ้งก่า ตาโต, ทรงผม: ไม่มี (ไม่เห็นในภาพ)', outfit: 'ท่อนบน: ไม่เห็นชัดในภาพ • ท่อนล่าง: ไม่เห็นในภาพ' });
  assert.equal(n, 'ประเภท: reptile (กิ้งก่า), ผิว/เกล็ด: เกล็ดสีเขียว มีจุดดำ, รูปหน้า: หัวกิ้งก่า ตาโต');
});

await check('"คลิป 4 — title" is not an action; "ฉาก: ต่อเนื่อง…" keeps the place and the pose', async () => {
  const story = rd('nongnam-clips-story.txt');
  const r = await runWholeStory(story, { offline: true, clipSeconds: 10 }, fakeServer(false));
  const meta = formatAllClipsForMetaAi(r.clips as any, metaOptionsForStory(story, [], characterNote));
  assert.ok(!meta.includes('น้องน้ำสวนกลับ') && !meta.includes('แพรวาเข้าข้างแม่สามี'), 'clip titles never reach the video');
  assert.ok(!meta.includes('ต่อเนื่องจากคลิปที่'), 'not used as a place name');
  assert.ok(!meta.includes('เปลี่ยนสถานที่ ท่าเริ่มคลิป'), 'same place, so no "new place"');
  assert.equal((meta.match(/สถานที่ ห้องโถงบ้าน เวลา กลางวัน/g) || []).length, r.clips.length);
  assert.ok(!/กำลัง\S{0,6}กำลัง/.test(meta), 'no doubled "กำลัง"');
});

await check('review points: real cast per clip, no "ไม่มี" lines, no "บท" speaker, no mixing of places', async () => {
  const story = rd('moradok-notes-story.txt');
  const r = await runWholeStory(story, { offline: true, clipSeconds: 8 }, fakeServer(false));
  assert.ok(!r.error, r.error);
  const clips = formatAllClipsForMetaAi(r.clips as any, metaOptionsForStory(story, [], characterNote)).split('\n\n');
  const all = clips.join('\n');
  assert.ok(!/speaks:\s*"ไม่มี"/.test(all) && !all.includes('บทพูด:') && !all.includes('ตัวละครในฉาก'), 'notes are not played');
  assert.ok(!/(^|[\s.;])บท speaks/.test(all), '"บท" is never a speaker');
  assert.ok(all.includes('มะลิ speaks: "หนูจะดูแลที่ดินของแม่ให้ดีที่สุดค่ะ"'), 'unnamed "บท:" line goes to the scene speaker');
  const cast = (c: string) => (c.match(/ตัวละครในคลิป: ([^—]+)/)?.[1] || '').trim();
  assert.equal(cast(clips[0]), 'ธนา', 'only who is in the shot');
  assert.ok(!cast(clips[2]).includes('ธนา') && !cast(clips[2]).includes('มะลิ'), `living room: not the people of the study (${cast(clips[2])})`);
  assert.ok(!clips[2].includes('ห้องทำงาน') && !clips[2].includes('ธนาสะดุ้ง'), 'new place starts fresh');
  assert.ok(clips[0].includes('ไม่มีบทพูดในคลิปนี้'), 'clip without lines says so');
  for (const c of clips) {
    assert.ok(c.includes('เสียงพูด'), 'voice locked');
    const act = c.match(/Scene Action: ([^.]+)/)?.[1] || '';
    if (act) assert.equal(c.split(act.slice(0, 15)).length - 1, 1, `action written once: ${act}`);
  }
});

await check('ไฟแค้นซ่อนรัก 225 clips: the writer\'s clips kept exactly, every line once, notes never played', async () => {
  const story = rd('faiklaen-225-clips.txt');
  assert.equal(isClipByClipScript(story), true);
  const r = await runWholeStory(story, { offline: true, clipSeconds: 8, maxSteps: 400 }, fakeServer(false));
  assert.equal(r.clips.length, 225, 'one prompt per written clip');
  const clips = formatAllClipsForMetaAi(r.clips as any, metaOptionsForStory(story, [], characterNote)).split('\n\n').map(c => c.split('\n').slice(1).join(' '));
  const lines = Array.from(story.matchAll(/^บทพูด \[([^\]]+)\]: “(.+)”$/gm)).map(m => ({ who: m[1], line: m[2] }));
  assert.equal(lines.length, 190);
  for (const { who, line } of lines) {
    const where = clips.filter(c => c.includes(`"${line}"`));
    assert.equal(where.length, 1, `"${line}" in ${where.length} clips`);
    assert.ok(where[0].includes(`${who === 'ตำรวจ' ? 'ตำรวจหญิง' : who} speaks: "${line}"`), `${who}: ${line}`);
  }
  for (const [i, c] of clips.entries()) {
    assert.ok(!/คลิป \d+\/225|ภาพ\/การกระทำ|บทพูด \[|ข้อกำหนด|ความยาวเป้าหมาย|รูปที่ 1 ซึ่ง/.test(c), `clip ${i + 1} leaks a note: ${c.slice(0, 120)}`);
    assert.ok(/ล็อกฉาก: สถานที่ \S+.* เวลา \S+/.test(c), `clip ${i + 1} locks place and time`);
    assert.ok(!/speaks:\s*"ไม่มี"/.test(c));
  }
  // a clip without dialogue keeps its own action; the clip before it does not get it too
  assert.ok(clips[23].includes('ภาคินวางกระเป๋าที่ท้ายรถ') && !clips[22].includes('ภาคินวางกระเป๋าที่ท้ายรถ'));
  assert.ok(clips[44].includes('แฟ้มสีน้ำเงินปิดลงช้า') && !clips[45].includes('แฟ้มสีน้ำเงินปิดลงช้า'));
  assert.ok(clips[0].includes('เวลา กลางวัน'), 'day time read from "วันที่ 1 ช่วงกลางวัน"');
  assert.ok(clips[0].includes('เฉพาะคุณหญิงมณีที่ขยับปากพูด'), 'only the speaker moves their lips');
  assert.ok(/ตัวละครในคลิป: [^—]*ทนายกฤต/.test(clips[32]), '"กฤต" in an action is ทนายกฤต');
});

console.log(`\nwhole story: ${passed} passed`);
