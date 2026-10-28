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
/** `น้ำฟ้า (look) พูดว่า "…"` / `ถามว่า` / `ตอบว่า` / `พูดต่อว่า`: the line word for word after its speaker */
const said = (who: string, line: string) => new RegExp(`${who.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: \\([^"]*?\\))? ?(?:พูด|ถาม|ตอบ|พูดต่อ)ว่า "${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
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
      assert.ok(/ฉากตามรูปที่ \d/.test(m), 'scene lock in every clip');
      assert.ok(m.includes('8 วินาที') && m.includes('9:16') && m.includes('cinematic photorealistic'));
      assert.ok(!/[:：]\s*[.;](\s|$)/.test(m), `no empty cue: ${m.slice(0, 80)}`);
      assert.ok(!/ไม่ระบุ/.test(m), 'no "unspecified" placeholders');
    }
  });
}

await check('ไฟแค้นซ่อนรัก: night rain at the mansion, right speakers, no leftovers from another story', async () => {
  const story = rd('faiklaen-story.txt');
  const r = await runWholeStory(story, { offline: true }, fakeServer(false));
  const meta = formatAllClipsForMetaAi(r.clips as any, metaOptionsForStory(story, [{ name: 'น้องน้ำ', appearance: 'gecko', referenceImageUrl: '/uploads/x.png' }], characterNote));
  assert.ok(meta.includes('คฤหาสน์หรู ตอนกลางคืน ฝนตกหนัก'), meta.slice(0, 200));
  assert.ok(!meta.includes('น้องน้ำ'), 'a library character not in this story never appears');
  assert.ok(!meta.includes('ละครเรื่อง'), 'the title is not a character');
  assert.deepEqual(r.clips.flatMap(c => c.dialogues.map(d => d.speaker)), ['คุณหญิงมณี', 'น้ำฟ้า']);
  assert.ok(meta.includes('น้ำฟ้า (ลูกสะใภ้สาวฐานะยากจน'), 'character without a photo described from the script');
  assert.ok(!/น้ำฟ้า \(รูปที่/.test(meta), 'no photo asked for a character without one');
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
  assert.ok(said('แพรวา', 'ออกไปจากบ้านฉัน!').test(m) && said('น้องน้ำ', 'ไม่มีวัน').test(m) && m.includes('พูดทีละคนตามลำดับ'), m);
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
  assert.ok(!meta.includes('เปลี่ยนฉากมาที่'), 'same place, so no "new place"');
  assert.equal((meta.match(/ห้องโถงบ้าน ตอนกลางวัน/g) || []).length, r.clips.length);
  assert.ok(!/กำลัง\S{0,6}กำลัง/.test(meta), 'no doubled "กำลัง"');
});

await check('review points: real cast per clip, no "ไม่มี" lines, no "บท" speaker, no mixing of places', async () => {
  const story = rd('moradok-notes-story.txt');
  const r = await runWholeStory(story, { offline: true, clipSeconds: 8 }, fakeServer(false));
  assert.ok(!r.error, r.error);
  const clips = formatAllClipsForMetaAi(r.clips as any, metaOptionsForStory(story, [], characterNote)).split('\n\n');
  const all = clips.join('\n');
  assert.ok(!/ว่า "ไม่มี"/.test(all) && !/บทพูด:\s*ไม่มี/.test(all) && !all.includes('ตัวละครในฉาก'), 'notes are not played');
  assert.ok(!/(^|[\s.;:])บท(?:พูด|ถาม|ตอบ)ว่า/.test(all), '"บท" is never a speaker');
  assert.ok(said('มะลิ', 'หนูจะดูแลที่ดินของแม่ให้ดีที่สุดค่ะ').test(all), 'unnamed "บท:" line goes to the scene speaker');
  // who is in the clip: the story's characters named in it (outside the dialogue)
  const known = metaOptionsForStory(story, [], characterNote).knownCharacters as string[];
  const cast = (c: string) => known.filter(n => c.split('\n').slice(2).join(' ').replace(/"[^"]*"/g, '').includes(n)).join(', ');
  assert.equal(cast(clips[0]), 'ธนา', 'only who is in the shot');
  assert.ok(!cast(clips[2]).includes('ธนา') && !cast(clips[2]).includes('มะลิ'), `living room: not the people of the study (${cast(clips[2])})`);
  assert.ok(!clips[2].includes('ห้องทำงาน') && !clips[2].includes('ธนาสะดุ้ง'), 'new place starts fresh');
  assert.ok(clips[0].includes('ไม่มีบทพูดในคลิปนี้'), 'clip without lines says so');
  for (const c of clips) {
    assert.ok(/เสียงพูด|เงียบ/.test(c), 'voice locked');
    assert.ok(!c.includes('Scene Action'), 'no internal label');
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
    assert.ok(said(who === 'ตำรวจ' ? 'ตำรวจหญิง' : who, line).test(where[0]), `${who}: ${line}`);
  }
  for (const [i, c] of clips.entries()) {
    assert.ok(!/คลิป \d+\/225|ภาพ\/การกระทำ|บทพูด \[|ข้อกำหนด|ความยาวเป้าหมาย|รูปที่ 1 ซึ่ง/.test(c), `clip ${i + 1} leaks a note: ${c.slice(0, 120)}`);
    assert.ok(/ฉากตามรูปที่ \d/.test(c) && / ตอน\S+/.test(c), `clip ${i + 1} locks place and time`);
    assert.ok(!/ว่า "ไม่มี"/.test(c));
  }
  // a clip without dialogue keeps its own action; the clip before it does not get it too
  assert.ok(clips[23].includes('ภาคินวางกระเป๋าที่ท้ายรถ') && !clips[22].includes('ภาคินวางกระเป๋าที่ท้ายรถ'));
  assert.ok(clips[44].includes('แฟ้มสีน้ำเงินปิดลงช้า') && !clips[45].includes('แฟ้มสีน้ำเงินปิดลงช้า'));
  assert.ok(clips[0].includes('ตอนกลางวัน'), 'day time read from "วันที่ 1 ช่วงกลางวัน"');
  assert.ok(clips[0].includes('คนอื่นไม่พูด'), 'only the speaker moves their lips');
  assert.ok(clips[32].includes('ทนายกฤต') && !/(^|[^ย])กฤต/.test(clips[32].replace(/ทนายกฤต/g, '')), '"กฤต" in an action is ทนายกฤต');
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
    const placeOf = (t: string) => t.match(/Master"\): สถานที่ (\S+)/)?.[1];
    assert.ok(vid.replace(/^เปลี่ยนฉากมาที่/, '').startsWith(placeOf(img)!), `clip ${i + 1} same place`);
    assert.deepEqual(imagePromptProblems(img, ctx.camera), [], `clip ${i + 1} consistent`);
    assert.ok(/— แสง[^—]+ แสงหลักเข้าจากด้าน(?:ซ้าย|ขวา)ของภาพ/.test(img), `clip ${i + 1} light`);
    assert.ok(!/speaks|พูดว่า|Dialogue|Continuity Flow|Starting moment|Ending momentum|:\s*\./.test(img), `clip ${i + 1}: ${img}`);
    for (const l of lines) assert.ok(!img.includes(l.slice(0, 20)), `clip ${i + 1} has no dialogue`);
    // the video numbers its own pictures (last frame first when it continues): same photos, own numbers
    for (const m of img.matchAll(/รูปที่ \d+ คือรูปโปรไฟล์อ้างอิงของ(\S+?)[,;]/g)) assert.ok(new RegExp(`${m[1]} \\(รูปที่ \\d\\)`).test(vid), `clip ${i + 1} photo of ${m[1]}`);
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
  assert.ok(vid.includes('มุมกล้อง: ภาพใกล้หน้าน้ำฟ้า มุมต่ำเล็กน้อย') && img.includes('มุมกล้องและระยะภาพ: ตามบท "ภาพใกล้หน้าน้ำฟ้า มุมต่ำเล็กน้อย"'));
  assert.ok(!vid.includes('[มุมกล้อง') && !img.includes('[มุมกล้อง'), 'the note is never played as an action');
  for (let i = 0; i < 225; i++) {
    const v = formatClipForMetaAi(r.clips[i] as any, ctx(i));
    const im = formatClipImagePrompt(r.clips[i] as any, ctx(i));
    // video: only the camera the script gives; image: always a camera
    assert.equal(/มุมกล้อง: \S/.test(v), plan[i].kind === 'script', `clip ${i + 1} video camera only from the script`);
    assert.ok(/มุมกล้องและระยะภาพ: \S/.test(im), `clip ${i + 1} has a camera`);
    assert.ok(!v.includes('film still'), 'video, not a still');
    assert.ok(!/ขณะพูด/.test(im), 'the still is before anyone speaks');
  }
});

await check('image prompt spec: strict camera direction and shot size from the script, staging per character', async () => {
  const story = rd('faiklaen-camera-cases.txt');
  const r = await runWholeStory(story, { offline: true, clipSeconds: 8 }, fakeServer(false));
  const opts = { ...metaOptionsForStory(story, [], characterNote), aspectRatio: '9:16' };
  const img = (i: number) => { const ctx = { ...opts, ...metaContextFor(r.clips as any, i) }; return { p: formatClipImagePrompt(r.clips[i] as any, ctx), cam: ctx.camera! }; };
  // Meta's order: story context, location + master, characters, continuity, camera / action, format
  const order = ['บริบท', 'สถานที่และแสง', 'ล็อกตัวละคร', 'เสื้อผ้าและรูปลักษณ์', 'ความต่อเนื่อง', 'มุมกล้องและระยะภาพ', 'ตำแหน่งและการกระทำ', 'รูปแบบและสัดส่วนภาพ', 'ข้อบังคับ'];
  const at = (p: string, l: string) => { const m = p.match(new RegExp(`(^|\\. )${l}(?: \\([^)]*\\))?:`)); return m ? m.index! + m[1].length : -1; };
  const sec = (p: string, l: string) => { const a = at(p, l); const next = order.slice(order.indexOf(l) + 1).map(x => at(p, x)).filter(x => x > a); return p.slice(a, next.length ? Math.min(...next) : undefined); };
  for (let i = 0; i < r.clips.length; i++) {
    const { p, cam } = img(i);
    const pos = order.map(l => at(p, l)).filter(x => x >= 0);
    assert.deepEqual(pos, [...pos].sort((a, b) => a - b), `clip ${i + 1}: sections in order`);
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
  const M0 = await import('../src/services/metaAiPrompt');
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
      assert.ok(v.endsWith('cinematic photorealistic, 9:16, 8 วินาที, ละครไทยแต่ง นักแสดงผู้ใหญ่, ' + (c.dialogues.length ? 'มีแค่เสียงพูดตามบท ไม่มีดนตรีหรือเสียงประกอบ' : 'เงียบทั้งคลิป ไม่มีเสียงพูด ดนตรี หรือเสียงประกอบ') + ', ไม่มีตัวหนังสือบนจอ'), v.slice(-160));
      if (c.charactersPresent?.length) assert.ok(v.includes('สีหน้าชัดเจน'), `${file} clip ${i + 1} emotion`);
      for (const d of c.dialogues) assert.ok(said(d.speaker, d.line).test(v), `${file} clip ${i + 1}: ${d.line}`);
      // the photo characters are named with their picture, the others with their look
      if (v.includes('น้องน้ำ') && /\(รูปที่ \d+ น้องน้ำ/.test(M0.attachmentLine(c as any, ctx).replace(/รูปที่ (\d+) /g, '(รูปที่ $1 '))) assert.ok(/น้องน้ำ \(รูปที่ \d\)/.test(v));
      // no app boilerplate repeating place / cast, no English lighting
      assert.ok(!/Cinematic 8K|Location Lock|Lighting Lock|daylight|lighting/.test(v + im), `${file} clip ${i + 1}`);
    });
    const shared = formatSharedLocks(buildSharedLocks(r.clips as any, opts));
    assert.ok(shared.startsWith('ข้อมูลล็อกกลางของเรื่อง'));
    if (file === 'faiklaen-225-clips.txt') {
      assert.ok(shared.includes('- คุณหญิงมณี (หญิงไทยวัย 60, ชุด: ชุดผ้าไหมสีม่วง) — มีรูปโปรไฟล์อ้างอิง'));
      assert.ok(shared.includes('- ห้องโถงคฤหาสน์ เวลา กลางวัน วันที่ 1 แสงธรรมชาติกลางวันสว่าง เงานุ่ม'));
      assert.ok(shared.includes('ภาคิน (สามี) — ยังไม่มีภาพอ้างอิง'));
    }
  }
});

await check('image prompts by place: one prompt for up to 4 images, shared locks once, every shot kept', async () => {
  const { groupClipsByPlace, formatPlaceImageBatch, IMAGE_BATCH_SIZE, checkPromptProblems, planCameras } = await import('../src/services/metaAiPrompt');
  const story = rd('faiklaen-225-clips.txt');
  const r = await runWholeStory(story, { offline: true, clipSeconds: 8, maxSteps: 400 }, fakeServer(false));
  const lib = [{ name: 'คุณหญิงมณี', appearance: 'หญิงไทยวัย 60', referenceImageUrl: '/u/a.png' }, { name: 'น้ำฟ้า', appearance: 'หญิงสาววัย 25', referenceImageUrl: '/u/b.png' }];
  const opts = { ...metaOptionsForStory(story, lib, characterNote), aspectRatio: '9:16' };
  const groups = groupClipsByPlace(r.clips as any);
  assert.equal(groups.reduce((n, g) => n + g.clips.length, 0), 225, 'every clip in exactly one group');
  assert.ok(groups.every(g => g.clips.every((i, k) => k === 0 || i > g.clips[k - 1])), 'story order');
  const hall = groups[0];
  assert.equal(hall.location, 'ห้องโถงคฤหาสน์'); assert.equal(hall.timeOfDay, 'กลางวัน วันที่ 1');
  const both = groups.find(g => g.location === 'ห้องรับแขกคฤหาสน์' && g.timeOfDay === 'บ่าย วันที่ 2')!;
  assert.equal(both.clips.length, 30, 'two scenes at the same place and time are one group');
  const plan = planCameras(r.clips as any);
  for (const g of groups) {
    for (let k = 0; k < g.clips.length; k += IMAGE_BATCH_SIZE) {
      const ch = g.clips.slice(k, k + IMAGE_BATCH_SIZE);
      const b = formatPlaceImageBatch(r.clips as any, ch, opts);
      assert.ok(b.startsWith(`สร้างภาพนิ่ง ${ch.length} ภาพแยกกัน`));
      for (const label of ['ล็อกตัวละคร:', 'สถานที่และแสง (รูปที่ 1 คือภาพมาสเตอร์', 'รูปแบบและสัดส่วนภาพ:']) assert.equal(b.split(label).length - 1, 1, `${label} once`);
      const shots = b.split(/\n\nภาพที่ \d+ \(คลิป \d+\):\n/).slice(1);
      assert.equal(shots.length, ch.length);
      shots.forEach((shot, j) => {
        const i = ch[j];
        assert.ok(shot.includes('มุมกล้องและระยะภาพ:') && shot.includes('ตำแหน่งและการกระทำ:'), `clip ${i + 1}`);
        if (plan[i].subject) assert.ok(shot.includes(plan[i].subject), `clip ${i + 1} camera subject`);
        assert.deepEqual(checkPromptProblems(shot, 'image', plan[i]).filter(p => !p.startsWith('ไม่มี รูปแบบ')), [], `clip ${i + 1}`);
      });
      for (const d of ch.flatMap(i => r.clips[i].dialogues)) assert.ok(!b.includes(d.line), 'no dialogue in images');
    }
  }
  const first = formatPlaceImageBatch(r.clips as any, hall.clips.slice(0, 4), opts);
  assert.ok(first.includes('(เตรียมไฟล์: ภาพมาสเตอร์ ห้องโถงคฤหาสน์ Master · รูปโปรไฟล์ของ คุณหญิงมณี, น้ำฟ้า'));
  assert.ok(first.includes('แนบก่อนพิมพ์: รูปที่ 1 ภาพมาสเตอร์ ห้องโถงคฤหาสน์ Master · รูปที่ 2 คุณหญิงมณี · รูปที่ 3 น้ำฟ้า'), 'per image: place, characters, previous clip');
  const singles = hall.clips.slice(0, 4).reduce((n, i) => n + formatClipImagePrompt(r.clips[i] as any, { ...opts, ...metaContextFor(r.clips as any, i) }).length, 0);
  assert.ok(first.length < singles * 0.8, `batch ${first.length} vs singles ${singles}`);
});

await check('video sound: only the scripted voices; silent clips silent; no background sound asked for', async () => {
  const { VIDEO_SOUND_DIALOGUE, VIDEO_SOUND_SILENT, withoutBackgroundSound, checkPromptProblems } = await import('../src/services/metaAiPrompt');
  const story = rd('faiklaen-225-clips.txt');
  const r = await runWholeStory(story, { offline: true, clipSeconds: 8, maxSteps: 400 }, fakeServer(false));
  const opts = { ...metaOptionsForStory(story, [], characterNote), aspectRatio: '9:16' };
  let silent = 0;
  r.clips.forEach((c, i) => {
    const ctx = { ...opts, ...metaContextFor(r.clips as any, i) };
    const v = formatClipForMetaAi(c as any, ctx);
    if (c.dialogues.length) assert.ok(v.includes(VIDEO_SOUND_DIALOGUE), `clip ${i + 1}`);
    else { silent++; assert.ok(v.includes(VIDEO_SOUND_SILENT), `clip ${i + 1}`); }
    assert.deepEqual(checkPromptProblems(v, 'video', ctx.camera), [], `clip ${i + 1}`);
  });
  assert.equal(silent, 35);
  // the story keeps what a character hears; only a clause that is background sound itself goes
  assert.equal(withoutBackgroundSound('ฟ้าใสนั่งผิงไฟ เสียงจิ้งหรีดดังรอบตัว'), 'ฟ้าใสนั่งผิงไฟ');
  assert.equal(withoutBackgroundSound('ด้านนอก ประตูขยับ ป้าสายได้ยินเพียงเสียงเบา ๆ'), 'ด้านนอก ประตูขยับ ป้าสายได้ยินเพียงเสียงเบา ๆ');
  assert.equal(withoutBackgroundSound('เพลงคลอเบา ๆ ภาคินยิ้ม'), 'ภาคินยิ้ม');
});

await check('short video prompt: order, dialogue word for word, pictures (last frame first, characters, place), same set sentence, safety only when needed', async () => {
  const M = await import('../src/services/metaAiPrompt');
  const story = rd('faiklaen-225-clips.txt');
  const r = await runWholeStory(story, { offline: true, clipSeconds: 8, maxSteps: 400 }, fakeServer(false));
  const lib = ['คุณหญิงมณี', 'น้ำฟ้า', 'ภาคิน', 'แพรวา'].map((name, k) => ({ name, appearance: `ลุค ${name}`, referenceImageUrl: `/u/${k}.png` }));
  const opts = { ...metaOptionsForStory(story, lib, characterNote), aspectRatio: '9:16' };
  const plan = M.planCameras(r.clips as any);
  const bibleOf = new Map<string, string>();
  r.clips.forEach((c, i) => {
    const ctx = { ...opts, ...metaContextFor(r.clips as any, i) };
    const v = formatClipForMetaAi(c as any, ctx);
    // the user's order: place + time, characters + action, dialogue, emotion, set + light, quality
    const firstLine = c.dialogues.length ? v.indexOf(`"${c.dialogues[0].line}"`) : -1;
    const order = [firstLine, v.indexOf('พูดภาษาไทยตรงตามบท'), v.indexOf('สีหน้าชัดเจน'), v.indexOf('ฉากตามรูปที่'), v.indexOf('cinematic photorealistic')];
    const pos = order.filter(x => x >= 0);
    assert.deepEqual(pos, [...pos].sort((a, b) => a - b), `clip ${i + 1} order`);
    const where = M.sceneOfClip(r.clips as any, i);
    assert.ok(v.replace(/^เปลี่ยนฉากมาที่/, '').startsWith(where.location), `clip ${i + 1} starts with the place`);
    assert.ok(v.includes('ละครไทยแต่ง นักแสดงผู้ใหญ่'));
    assert.ok(v.length < 1200, `clip ${i + 1} short (${v.length})`);
    // safety words only where the clip needs them
    assert.equal(v.includes(M.SAFETY_SHORT), M.sensitiveWords(c as any).length > 0 || /ร้องไห้|น้ำตา|สะอื้น/.test(M.clipAction(c as any)), `clip ${i + 1} safety`);
    // dialogue word for word, one speaker named
    for (const d of c.dialogues) assert.ok(said(d.speaker, d.line).test(v), `clip ${i + 1}: ${d.line}`);
    if (c.dialogues.length) assert.ok(v.includes('พูดภาษาไทยตรงตามบททุกคำ'));
    // attachments, numbered for this clip: a continuing clip starts from the previous clip's last
    // frame (picture 1), then the characters in the shot with a photo, the place master last;
    // a new place: the master first
    const att = M.attachmentsFor(c as any, ctx);
    const inShot = M.charactersInClip(c as any, opts.knownCharacters).filter(n => opts.withPhoto.includes(n));
    if (att.lastFrameOf) {
      assert.equal(att.list[0].kind, 'frame', `clip ${i + 1}: picture 1 is the previous clip's last frame`);
      assert.equal(att.list[att.list.length - 1].kind, 'master', `clip ${i + 1}: the master last`);
      assert.ok(v.includes(`ต่อจากเฟรมสุดท้ายของคลิป ${att.lastFrameOf} (รูปที่ 1) ทันที`), `clip ${i + 1} continues`);
    } else assert.equal(att.list[0].kind, 'master', `clip ${i + 1}: picture 1 is the place`);
    assert.deepEqual(att.list.filter(x => x.kind === 'face').map(x => x.name), inShot, `clip ${i + 1}: every character in the shot`);
    att.list.forEach((x, k) => assert.equal(x.n, k + 1));
    for (const x of att.list.filter(y => y.kind === 'face')) assert.ok(v.includes(`${x.name} (รูปที่ ${x.n})`), `clip ${i + 1}: ${x.name}`);
    const masterNo = att.list.find(x => x.kind === 'master')!.n;
    // the set sentence: the same words in every prompt at that place
    const key = `${where.location}|${where.timeOfDay}`;
    const scene = (v.match(new RegExp(`ฉากตามรูปที่ ${masterNo} (.*?ฉากและแสงคงเดิม)`))?.[1] || '');
    // background only from the master when a character photo is attached
    assert.equal(scene.includes('ไม่ใช้ฉากหลังของรูปตัวละคร'), att.faces.length > 0, `clip ${i + 1}: ${scene}`);
    assert.ok(!scene.includes('บันได'), `clip ${i + 1}: ${scene}`);
    const sceneWords = scene.replace(/\s*ไม่ใช้ฉากหลังของรูปตัวละคร\s*/, ' ').trim();
    if (bibleOf.has(key)) assert.equal(sceneWords, bibleOf.get(key), `clip ${i + 1}: set sentence rewritten`);
    else bibleOf.set(key, sceneWords);
    // crying is never a face close-up (unless the script asks for it)
    if (/ร้องไห้|น้ำตา|สะอื้น/.test(M.clipAction(c as any)) && plan[i].kind !== 'script') assert.notEqual(plan[i].kind, 'close', `clip ${i + 1}`);
  });
  const g = M.groupClipsByPlace(r.clips as any)[0];
  const master = M.formatLocationMasterPrompt(g.location, g.timeOfDay, M.thaiLighting('bright natural daylight', g.timeOfDay), '9:16');
  assert.ok(master.includes('ไม่มีคน') && master.includes(M.locationBible(g.location, g.timeOfDay, M.thaiLighting('bright natural daylight', g.timeOfDay))), 'master carries the location bible');
  assert.deepEqual(M.sensitiveWords({ generatedPrompt: 'Scene Action: แพรวาตบหน้าน้ำฟ้า.' } as any), ['ตบ']);
  assert.deepEqual(M.sensitiveWords({ generatedPrompt: 'Scene Action: ภาคินตีความเอกสาร.' } as any), []);
});

await check('Meta AI video review fixes: set from picture 1, clean action, prop, cast, wide camera, emotion', async () => {
  const M = await import('../src/services/metaAiPrompt');
  const clip: any = {
    clipNumber: 46, durationSeconds: 10, locationName: 'ห้องรับแขกคฤหาสน์', timeOfDay: 'บ่าย',
    charactersPresent: ['คุณหญิงมณี', 'ทนายกฤต', 'ภาคิน', 'น้ำฟ้า'],
    generatedPrompt: 'Scene Action: ระยะเวลา: 10 วินาที | สัดส่วนภาพ: 9:16. ทนายกฤตยืนตรง สีหน้าสุภาพ. Character Lock: คุณหญิงมณี, ทนายกฤต, แพรวา, กฤต.',
    dialogues: [{ speaker: 'คุณหญิงมณี', line: 'นี่มันเรื่องเหลวไหล สามีฉันจะยกบ้านให้ใคร!', emotion: '(น้ำเสียงโกรธจัด)' }],
    endAction: 'คุณหญิงมณีถือแฟ้มด้วยความโมโห'
  };
  const note = M.locationNote({ visualProfile: { architecturalStyle: 'ศาลาเปิดโล่งแบบโคโลเนียล', floor: 'พื้นหินอ่อน', windows: 'เสาสีขาวเปิดออกสู่สวน', majorFurniture: 'โซฟาหวายขอบไม้สีเข้ม' } });
  const opts: any = {
    aspectRatio: '9:16', knownCharacters: ['คุณหญิงมณี', 'ทนายกฤต', 'ภาคิน', 'น้ำฟ้า', 'แพรวา', 'กฤต'],
    withPhoto: ['คุณหญิงมณี', 'ทนายกฤต', 'ภาคิน', 'น้ำฟ้า'], locationNotes: { 'ห้องรับแขกคฤหาสน์': note }
  };
  const ctx = { ...opts, ...M.metaContextFor([clip], 0) };
  const v = M.formatClipForMetaAi(clip, ctx);
  // 1. the set: the place's own details, no generic staircase, background only from picture 1
  assert.ok(v.includes('(ศาลาเปิดโล่งแบบโคโลเนียล, พื้นหินอ่อน, เสาสีขาวเปิดออกสู่สวน, โซฟาหวายขอบไม้สีเข้ม)'), v);
  assert.ok(!v.includes('บันได'));
  assert.ok(v.includes('ฉากตามรูปที่ 1 (') && v.includes('ไม่ใช้ฉากหลังของรูปตัวละคร'));
  assert.ok(M.formatLocationMasterPrompt('ห้องรับแขกคฤหาสน์', 'บ่าย', '', '9:16', note).includes('ลักษณะสถานที่: ศาลาเปิดโล่ง'));
  // 2. no clip settings inside the action
  assert.ok(!/ระยะเวลา|สัดส่วนภาพ:|\|/.test(M.clipAction(clip)), M.clipAction(clip));
  assert.equal(M.withoutClipSettings('คลิป 046/225 | 8 วินาที | 9:16 คุณหญิงมณีรับแฟ้ม'), 'คุณหญิงมณีรับแฟ้ม');
  // 3. the folder of the end pose comes in during the clip
  assert.ok(v.includes('คุณหญิงมณีหยิบแฟ้มมาถือให้เห็นตั้งแต่ต้นคลิป ไม่ใช่โผล่ขึ้นมาเอง'), v);
  // 4. only the people in the shot, the lawyer once (not also as "กฤต"), not แพรวา
  assert.deepEqual(M.charactersInClip(clip, opts.knownCharacters), ['คุณหญิงมณี', 'ทนายกฤต', 'ภาคิน', 'น้ำฟ้า']);
  assert.ok(!v.includes('แพรวา') && !/[^ย]กฤต/.test(v.replace(/ทนายกฤต/g, '')));
  // 5. the script gives no camera: the video prompt does not invent one
  assert.ok(!v.includes('มุมกล้อง') && !v.includes('การเคลื่อนกล้อง'));
  // 6. an angry clip is not told to cry
  assert.ok(!v.includes('น้ำตาคลอ') && v.includes('แสดงความโกรธผ่านสีหน้า'));
  assert.ok(M.emotionDelivery('เสียใจ ร้องไห้').includes('น้ำตาคลอ'));
  assert.deepEqual(M.checkPromptProblems(v, 'video', ctx.camera), []);
});

console.log(`\nwhole story: ${passed} passed`);
