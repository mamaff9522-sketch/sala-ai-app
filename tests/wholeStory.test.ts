import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWholeStory } from '../src/services/wholeStoryRunner';
import { offlineContinuation, isLineCovered, metaOptionsForStory } from '../src/services/storyProgress';
import { parseStoryStructure } from '../src/services/storyEpisodeEngine';
import { formatAllClipsForMetaAi, formatClipForMetaAi, formatClipImagePrompt, metaContextFor, characterNote, planCameras, imagePromptProblems } from '../src/services/metaAiPrompt';
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
  assert.ok(meta.includes('น้ำฟ้า (ลูกสะใภ้สาวฐานะยากจน'), 'character without a photo described from the script');
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
  assert.ok(m.includes('แพรวา พูดว่า "ออกไปจากบ้านฉัน!"') && m.includes('น้องน้ำ พูดว่า "ไม่มีวัน"'), m);
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
  assert.ok(!/พูดว่า\s*"ไม่มี"/.test(all) && !/บทพูด:\s*ไม่มี/.test(all) && !/การเคลื่อนไหวของตัวละคร:[^.]*บทพูด/.test(all) && !all.includes('ตัวละครในฉาก'), 'notes are not played');
  assert.ok(!/(^|[\s.;:])บท พูดว่า/.test(all), '"บท" is never a speaker');
  assert.ok(all.includes('มะลิ พูดว่า "หนูจะดูแลที่ดินของแม่ให้ดีที่สุดค่ะ"'), 'unnamed "บท:" line goes to the scene speaker');
  // names on the "ตัวละคร:" line, without photo numbers and notes
  const cast = (c: string) => (c.match(/ตัวละคร(?: \(ใช้รูปที่อัปโหลดเป็นต้นแบบ\))?: ([^—]+)/)?.[1] || '')
    .replace(/\([^()]*(?:\([^()]*\)[^()]*)*\)/g, '').replace(/รูปที่ \d+ = /g, '').split(',').map(x => x.trim()).filter(Boolean).join(', ');
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
    assert.ok(where[0].includes(`${who === 'ตำรวจ' ? 'ตำรวจหญิง' : who} พูดว่า "${line}"`), `${who}: ${line}`);
  }
  for (const [i, c] of clips.entries()) {
    assert.ok(!/คลิป \d+\/225|ภาพ\/การกระทำ|บทพูด \[|ข้อกำหนด|ความยาวเป้าหมาย|รูปที่ 1 ซึ่ง/.test(c), `clip ${i + 1} leaks a note: ${c.slice(0, 120)}`);
    assert.ok(/ล็อกฉาก: สถานที่ \S+.* เวลา \S+/.test(c), `clip ${i + 1} locks place and time`);
    assert.ok(!/พูดว่า\s*"ไม่มี"/.test(c));
  }
  // a clip without dialogue keeps its own action; the clip before it does not get it too
  assert.ok(clips[23].includes('ภาคินวางกระเป๋าที่ท้ายรถ') && !clips[22].includes('ภาคินวางกระเป๋าที่ท้ายรถ'));
  assert.ok(clips[44].includes('แฟ้มสีน้ำเงินปิดลงช้า') && !clips[45].includes('แฟ้มสีน้ำเงินปิดลงช้า'));
  assert.ok(clips[0].includes('เวลา กลางวัน'), 'day time read from "วันที่ 1 ช่วงกลางวัน"');
  assert.ok(clips[0].includes('เฉพาะคุณหญิงมณีที่ขยับปากพูด'), 'only the speaker moves their lips');
  assert.ok(/ตัวละคร(?: \([^)]*\))?: [^—]*ทนายกฤต/.test(clips[32]), '"กฤต" in an action is ทนายกฤต');
});

await check('image prompt per clip: same place, time, light and photos as the video; no dialogue; mouths closed', async () => {
  const story = rd('faiklaen-225-clips.txt');
  const r = await runWholeStory(story, { offline: true, clipSeconds: 8, maxSteps: 400 }, fakeServer(false));
  const lib = [{ name: 'คุณหญิงมณี', appearance: 'หญิงไทยวัย 60', referenceImageUrl: '/u/a.png' }, { name: 'น้ำฟ้า', appearance: 'หญิงสาววัย 25', referenceImageUrl: '/u/b.png' }];
  const opts = { ...metaOptionsForStory(story, lib, characterNote), aspectRatio: '9:16' };
  const lines = Array.from(story.matchAll(/^บทพูด \[[^\]]+\]: “(.+)”$/gm)).map(m => m[1]);
  r.clips.forEach((c, i) => {
    const ctx = { ...opts, ...metaContextFor(r.clips as any, i) };
    const img = formatClipImagePrompt(c as any, ctx);
    const vid = formatClipForMetaAi(c as any, ctx);
    assert.ok(img.includes('ภาพนิ่ง 9:16'), img.slice(0, 60));
    const placeOf = (t: string) => t.match(/(?:ล็อกฉาก: สถานที่|สถานที่และแสง:) (\S+)/)?.[1];
    assert.equal(placeOf(img), placeOf(vid), `clip ${i + 1} same place`);
    assert.deepEqual(imagePromptProblems(img, ctx.camera), [], `clip ${i + 1} consistent`);
    assert.ok(/แสง: \S/.test(img), `clip ${i + 1} light`);
    assert.ok(!/speaks|พูดว่า|Dialogue|Continuity Flow|Starting moment|Ending momentum|:\s*\./.test(img), `clip ${i + 1}: ${img}`);
    for (const l of lines) assert.ok(!img.includes(l.slice(0, 20)), `clip ${i + 1} has no dialogue`);
    for (const m of vid.matchAll(/รูปที่ (\d) = (\S+)/g)) assert.ok(img.includes(`รูปที่ ${m[1]} = ${m[2]}`), `clip ${i + 1} photo ${m[1]}`);
    if (/ตัวละคร(?:ในภาพ| \()/.test(img)) assert.ok(img.includes('ทุกคนปิดปาก'));
  });
});

await check('camera: varies every clip, sides never jump within a place, the script\'s own camera wins', async () => {
  const story = rd('faiklaen-225-clips.txt')
    .replace('คลิป 002/225 | 8 วินาที | 9:16\n', 'คลิป 002/225 | 8 วินาที | 9:16\nมุมกล้อง: ภาพใกล้หน้าน้ำฟ้า มุมต่ำเล็กน้อย\n');
  const r = await runWholeStory(story, { offline: true, clipSeconds: 8, maxSteps: 400 }, fakeServer(false));
  assert.equal(r.clips.length, 225);
  const plan = planCameras(r.clips as any);
  plan.forEach((c, i) => { if (i && c.kind !== 'script') assert.notEqual(c.kind, plan[i - 1].kind, `clip ${i + 1} same shot as clip ${i}`); });
  assert.ok(new Set(plan.map(c => c.kind)).size >= 5, 'several kinds of shot');
  assert.equal(plan[0].kind, 'wide', 'a new place opens wide');
  assert.equal(plan[1].kind, 'script');
  assert.ok(plan[1].framing.includes('ภาพใกล้หน้าน้ำฟ้า มุมต่ำเล็กน้อย'));
  assert.equal(plan[9].kind, 'script', 'the script\'s "กล้องจับสีหน้าคุณหญิงมณี" is used');
  // sides: within one place a character never moves from left to right
  let side = new Map<string, string>();
  plan.forEach((c, i) => {
    if (c.kind === 'wide' || c.framing.includes('เห็นพื้นหลังของ')) side = new Map();
    for (const m of c.framing.matchAll(/([^\s(,]+)อยู่(ซ้ายจอ|ขวาจอ)(?=[,)])/g)) {
      if (side.has(m[1])) assert.equal(side.get(m[1]), m[2], `clip ${i + 1}: ${m[1]} jumped sides`);
      side.set(m[1], m[2]);
    }
  });
  const opts = { ...metaOptionsForStory(story, [], characterNote), aspectRatio: '9:16' };
  const ctx = (i: number) => ({ ...opts, ...metaContextFor(r.clips as any, i) });
  const vid = formatClipForMetaAi(r.clips[1] as any, ctx(1));
  const img = formatClipImagePrompt(r.clips[1] as any, ctx(1));
  assert.ok(vid.includes('มุมกล้อง: ตามบท: ภาพใกล้หน้าน้ำฟ้า') && img.includes('มุมกล้องและระยะภาพ: ตามบท "ภาพใกล้หน้าน้ำฟ้า มุมต่ำเล็กน้อย"'));
  assert.ok(!vid.includes('[มุมกล้อง') && !img.includes('[มุมกล้อง'), 'the note is never played as an action');
  for (let i = 0; i < 225; i++) {
    const v = formatClipForMetaAi(r.clips[i] as any, ctx(i));
    const im = formatClipImagePrompt(r.clips[i] as any, ctx(i));
    assert.ok(/มุมกล้อง: \S/.test(v) && /มุมกล้องและระยะภาพ: \S/.test(im), `clip ${i + 1} has a camera`);
    assert.ok(!v.includes('film still'), 'video, not a still');
    assert.ok(!/ขณะพูด/.test(im), 'the still is before anyone speaks');
  }
});

await check('image prompt spec: strict camera direction and shot size from the script, staging per character', async () => {
  const story = rd('faiklaen-camera-cases.txt');
  const r = await runWholeStory(story, { offline: true, clipSeconds: 8 }, fakeServer(false));
  const opts = { ...metaOptionsForStory(story, [], characterNote), aspectRatio: '9:16' };
  const img = (i: number) => { const ctx = { ...opts, ...metaContextFor(r.clips as any, i) }; return { p: formatClipImagePrompt(r.clips[i] as any, ctx), cam: ctx.camera! }; };
  const order = ['ตัวละครและภาพอ้างอิง', 'เสื้อผ้าและรูปลักษณ์', 'สถานที่และแสง', 'มุมกล้องและระยะภาพ', 'ตำแหน่งและการกระทำ', 'ความต่อเนื่อง', 'รูปแบบและสัดส่วนภาพ', 'ข้อบังคับ'];
  const sec = (p: string, l: string) => { const at = p.indexOf(l + ':'); const next = order.slice(order.indexOf(l) + 1).map(x => p.indexOf(x + ':')).filter(x => x > at); return p.slice(at, next.length ? Math.min(...next) : undefined); };
  for (let i = 0; i < r.clips.length; i++) {
    const { p, cam } = img(i);
    const at = order.map(l => p.indexOf(l + ':')).filter(x => x >= 0);
    assert.deepEqual(at, [...at].sort((a, b) => a - b), `clip ${i + 1}: sections in order`);
    assert.deepEqual(imagePromptProblems(p, cam), [], `clip ${i + 1}`);
    assert.ok(p.includes('ห้ามคิดท่าทางใหม่ที่ไม่ตรงบท'));
    if (['CU', 'MCU', 'MS'].includes(cam.size)) assert.ok(p.includes('ห้ามขยายเป็นภาพเต็มตัว'));
  }
  // 1. ภาคิน half body, front
  let { p, cam } = img(4);
  assert.equal(cam.size, 'MS'); assert.equal(cam.angle, 'front'); assert.equal(cam.subject, 'ภาคิน');
  assert.ok(sec(p, 'มุมกล้องและระยะภาพ').includes('Medium Shot: ศีรษะถึงเอวของภาคินเท่านั้น ห้ามเห็นขาหรือรองเท้า'));
  assert.ok(sec(p, 'มุมกล้องและระยะภาพ').includes('ตัวละครรอง (คุณหญิงมณี, น้ำฟ้า, แพรวา) อยู่ฉากหลังหรือเห็นเพียงบางส่วน'), '4 people, half body kept');
  assert.ok(p.includes('กำลังก้าว') && p.includes('ให้เห็นประตู'), 'walking in through the door, not posing');
  // 2. ภาคิน half body, from behind
  ({ p, cam } = img(5));
  assert.equal(cam.angle, 'rear'); assert.equal(cam.size, 'MS');
  assert.ok(p.includes('Rear View: กล้องอยู่ด้านหลังภาคิน เห็นแผ่นหลังและด้านหลังศีรษะ ห้ามหันหน้าเข้ากล้อง') && p.includes('ห้ามหมุนตัวละครที่หันหลังมาเป็นด้านหน้า'));
  assert.ok(/ภาคิน: [^|]*หันหลังให้กล้อง/.test(p));
  // 3. น้ำฟ้า side
  ({ p, cam } = img(3));
  assert.equal(cam.angle, 'side'); assert.equal(cam.subject, 'น้ำฟ้า');
  assert.ok(p.includes('Side Profile: กล้องอยู่ด้านข้างน้ำฟ้า') && p.includes('ไม่ใช่หน้าตรง') && /น้ำฟ้า: [^|]*หันข้างให้กล้อง/.test(p));
  // 4. คุณหญิงมณี low angle
  ({ p, cam } = img(7));
  assert.equal(cam.angle, 'low'); assert.equal(cam.subject, 'คุณหญิงมณี');
  assert.ok(p.includes('กล้องอยู่ต่ำกว่าคุณหญิงมณีและเงยขึ้น'));
  // 5. four people, ภาคิน half body
  ({ p, cam } = img(6));
  assert.equal(cam.size, 'MS'); assert.equal(cam.subject, 'ภาคิน');
  assert.ok(/ภาคิน: [^|]*ฉากหน้า/.test(p) && /น้ำฟ้า: [^|]*ฉากหลัง/.test(p));
  // 6. wide, everyone in the hall; the action's own "กล้องจับสีหน้า…" does not fight it
  ({ p, cam } = img(9));
  assert.equal(cam.size, 'WS');
  assert.ok(sec(p, 'มุมกล้องและระยะภาพ').includes('Wide Shot: เห็นพื้นที่ฉากและตัวละครทุกคน'));
  assert.ok(!sec(p, 'ตำแหน่งและการกระทำ').includes('กล้องจับสีหน้า'));
  for (const n of ['คุณหญิงมณี', 'น้ำฟ้า', 'แพรวา', 'ภาคิน']) assert.ok(new RegExp(`${n}: (?:ซ้าย|ขวา|กลาง)จอ, ฉากกลาง`).test(p), n);
  // no reference photo: said so, never invented
  assert.ok(p.includes('ยังไม่มีภาพอ้างอิง'));
});

await check('prompt standard: Thai first, each fact once, no conflicts, shared locks, nothing important lost', async () => {
  const { checkPromptProblems, buildSharedLocks, formatSharedLocks } = await import('../src/services/metaAiPrompt');
  for (const file of ['faiklaen-225-clips.txt', 'faiklaen-camera-cases.txt', 'moradok-notes-story.txt', 'avatar-story.txt']) {
    const story = rd(file);
    const r = await runWholeStory(story, { offline: true, clipSeconds: 8, maxSteps: 400 }, fakeServer(false));
    const lib = [{ name: 'คุณหญิงมณี', appearance: 'หญิงไทยวัย 60', outfit: 'ชุดผ้าไหมสีม่วง', referenceImageUrl: '/u/a.png' }, { name: 'น้องน้ำ', appearance: 'ประเภท: anthropomorphic reptile (กิ้งก่า)', referenceImageUrl: '/u/x.png' }];
    const opts = { ...metaOptionsForStory(story, lib, characterNote), aspectRatio: '9:16' };
    r.clips.forEach((c, i) => {
      const ctx = { ...opts, ...metaContextFor(r.clips as any, i) };
      const v = formatClipForMetaAi(c as any, ctx);
      const im = formatClipImagePrompt(c as any, ctx);
      assert.deepEqual(checkPromptProblems(v, 'video', ctx.camera), [], `${file} clip ${i + 1} video`);
      assert.deepEqual(checkPromptProblems(im, 'image', ctx.camera), [], `${file} clip ${i + 1} image`);
      // video carries: length + ratio, place, characters, camera + its movement, every line word for word with its speaker
      assert.ok(v.startsWith('วิดีโอยาว 8 วินาที, สัดส่วนภาพ 9:16'));
      assert.ok(/มุมกล้อง: \S/.test(v) && /อารมณ์และการแสดง: \S/.test(v));
      for (const d of c.dialogues) assert.ok(v.includes(`${d.speaker} พูดว่า "${d.line}"`), `${file} clip ${i + 1}: ${d.line}`);
      // no app boilerplate repeating place / cast, no English lighting
      assert.ok(!/Cinematic 8K|Location Lock|Lighting Lock|daylight|lighting/.test(v + im), `${file} clip ${i + 1}`);
    });
    const shared = formatSharedLocks(buildSharedLocks(r.clips as any, opts));
    assert.ok(shared.startsWith('ข้อมูลล็อกกลางของเรื่อง'));
    if (file === 'faiklaen-225-clips.txt') {
      assert.ok(shared.includes('- รูปที่ 1 = คุณหญิงมณี (หญิงไทยวัย 60, ชุด: ชุดผ้าไหมสีม่วง)'));
      assert.ok(shared.includes('- ห้องโถงคฤหาสน์ เวลา กลางวัน วันที่ 1 แสงธรรมชาติกลางวันสว่าง เงานุ่ม'));
      assert.ok(shared.includes('ภาคิน (สามี) — ยังไม่มีภาพอ้างอิง'));
    }
  }
});

console.log(`\nwhole story: ${passed} passed`);
