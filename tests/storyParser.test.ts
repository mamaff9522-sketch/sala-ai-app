/**
 * Quick offline-parser regression test.
 * Run: npx tsx tests/storyParser.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toLocationLockPayload, findLocationByName, enforceLibraryLocationLocks } from '../src/services/locationAppearance';
import { parseScriptLocally, applySplitLocks } from '../src/services/localScriptParser';
import { toCharacterLockPayload, findCharacterByName, stripDefaultPose } from '../src/services/characterAppearance';
import {
  parseStoryStructure,
  generateEpisodeLocally,
  extractLocationFromText,
  normalizeSpeakerName,
  splitCharacterList,
  parseSceneHeading,
  normalizeSceneLocation,
  applyEpisodeLocks,
  hasExplicitEndingMarker
} from '../src/services/storyEpisodeEngine';
import {
  analyzeClipContinuity,
  expandCombinedCharacterNames,
  enforcePoseHandoff,
  buildCharacterLockText
} from '../src/services/continuityEngine';
import {
  validateSalaMultiClipPrompts,
  containsForbiddenPlaceholder,
  FORBIDDEN_PLACEHOLDER_SUBSTRINGS,
  deriveScenePhysicalStates,
  buildSalaMultiClipPrompts,
  attachClipContinuity,
  checkDialogueDensity,
  dedupeDialogueEntries,
  enforceLibraryCharacterLocks,
  lockDuplicationProblems,
  summarizeAutoSplit
} from '../src/services/salaDirectorEngine';
import { syncLocationLockInPrompt, checkStoryRepeats } from '../src/services/continuityEngine';
import {
  extractAppearanceFromDescription,
  buildCharacterAppearanceLock,
  parseScriptCharacterList
} from '../src/services/characterAppearance';

const SAMPLE = `ได้ครับ นี่คือบทสำหรับวิดีโอ 5 ฉาก ฉากละประมาณ 10 วินาที พร้อมนำไปใช้ได้ทันที
รูปแบบ: ฉาก / การกระทำ / บทพูด

ชื่อเรื่อง: เสียงเรียกจากป่า
ตัวละคร: น้องฟ้าใส, พี่ต้น

ฉากที่ 1: แคมป์ในป่า - กลางคืน (ประมาณ 10 วินาที)
น้องฟ้าใสกับพี่ต้นนั่งผิงไฟอยู่หน้าเต็นท์ เสียงจิ้งหรีดดังรอบตัว
น้องฟ้าใสกระซิบ "ได้ยินไหม"
พี่ต้นหยุดเขี่ยกองไฟแล้วเงยหน้าขึ้นฟัง

ฉากที่ 2: ชายป่าหลังแคมป์ - กลางคืน (ประมาณ 10 วินาที)
เงาของต้นไม้ไหวไปมาทั้งที่ไม่มีลม
เสียงปริศนา: "มาหาฉันสิ"
น้องฟ้าใสคว้าแขนพี่ต้นแน่น

ฉากที่ 3: ทางเดินในป่า - กลางคืน (ประมาณ 10 วินาที)
พี่ต้นส่องไฟฉายนำทาง น้องฟ้าใสเดินตามติด
พี่ต้นพูดว่า "อยู่ใกล้ๆ พี่ไว้นะ"

ฉากที่ 4: ลานหินกลางป่า - กลางคืน (ประมาณ 10 วินาที)
ทั้งสองพบกล่องดนตรีเก่าวางอยู่บนก้อนหิน มันเล่นเพลงเบาๆ เอง
น้องฟ้าใสตะโกน "ใครอยู่ตรงนั้น!"

ฉากที่ 5: แคมป์ในป่า - รุ่งเช้า (ประมาณ 10 วินาที)
พี่ต้นกอดน้องฟ้าใสไว้ข้างกองไฟที่มอดแล้ว กล่องดนตรีวางอยู่ข้างเต็นท์
น้องฟ้าใส: "พี่ต้น... มันตามเรามา"

---
ถ้าจะเอาไปใช้กับ Sala AI บอกได้เลยนะครับ`;

let passed = 0;
const check = (name: string, fn: () => void) => {
  fn();
  passed++;
  console.log(`  ✔ ${name}`);
};

const parsed = parseStoryStructure(SAMPLE);
const ep = generateEpisodeLocally({ originalStory: SAMPLE, episodeNumber: 1, targetSceneCount: 5, clipDurationSeconds: 10 });
const allText = JSON.stringify(ep);

console.log('Offline story parser test');
check('5 scenes parsed from ฉากที่ headers', () => {
  assert.equal(parsed.hasSceneHeaders, true);
  assert.equal(parsed.scenes.length, 5);
  assert.equal(ep.scenes.length, 5);
  assert.deepEqual(ep.scenes.map((s: any) => s.sceneNumber), [1, 2, 3, 4, 5]);
});
check('no chat preamble / trailer beats', () => {
  const beats = parsed.narrativeBeats.map(b => b.text).join('\n');
  for (const bad of ['ได้ครับ', 'รูปแบบ', 'Sala AI', 'บอกได้เลย', 'ถ้าจะเอาไปใช้']) {
    assert.ok(!beats.includes(bad), `beat contains "${bad}"`);
    assert.ok(!allText.includes(bad), `episode output contains "${bad}"`);
  }
  assert.equal(parsed.metadata['ชื่อเรื่อง'], 'เสียงเรียกจากป่า');
});
check('locations come from headings (never "10")', () => {
  assert.deepEqual(ep.scenes.map((s: any) => s.location), ['แคมป์ในป่า', 'ชายป่าหลังแคมป์', 'ทางเดินในป่า', 'ลานหินกลางป่า', 'แคมป์ในป่า']);
  assert.deepEqual(ep.scenes.map((s: any) => s.timeOfDay), ['กลางคืน', 'กลางคืน', 'กลางคืน', 'กลางคืน', 'รุ่งเช้า']);
  ep.scenes.forEach((s: any) => assert.ok(!/:\s*10\s*-/.test(s.sceneHeading), s.sceneHeading));
  assert.equal(extractLocationFromText('เดินเล่นประมาณ 10 วินาที'), '');
  assert.equal(extractLocationFromText('ทั้งสองนั่งอยู่ ในโกดังร้าง ตอนดึก'), 'โกดังร้าง');
});
check('speaker is "น้องฟ้าใส" (speech verb stripped), off-screen voice not locked', () => {
  const s1 = ep.scenes[0];
  assert.equal(s1.dialogues[0].speaker, 'น้องฟ้าใส');
  assert.equal(s1.dialogues[0].dialogue, 'ได้ยินไหม');
  assert.ok(s1.dialogues[0].emotionOrAction.includes('กระซิบ'));
  const voice = ep.scenes[1].dialogues[0];
  assert.equal(voice.speaker, 'เสียงปริศนา');
  assert.equal(voice.offScreen, true);
  const names = parsed.characters.map(c => c.name);
  assert.ok(!names.includes('เสียงปริศนา'), 'off-screen voice registered as character');
  assert.ok(!names.some(n => /กระซิบ|ตะโกน|พูด/.test(n)), `glued verb in names: ${names}`);
  assert.deepEqual(names, ['น้องฟ้าใส', 'พี่ต้น']);
  assert.equal(ep.scenes[2].dialogues[0].speaker, 'พี่ต้น');
  assert.equal(ep.scenes[3].dialogues[0].speaker, 'น้องฟ้าใส');
  assert.equal(normalizeSpeakerName('น้องฟ้าใสกระซิบ'), 'น้องฟ้าใส');
  assert.equal(normalizeSpeakerName('ลุงดำตะโกนว่า'), 'ลุงดำ');
  assert.deepEqual(splitCharacterList('ธันวา, มายด์ และลุงชาญ/ต้น & ใบเฟิร์น'), ['ธันวา', 'มายด์', 'ลุงชาญ', 'ต้น', 'ใบเฟิร์น']);
});
check('dialogue stays in its own scene (not one clip late)', () => {
  assert.equal(ep.scenes[0].dialogues.length, 1);
  assert.equal(ep.scenes[1].dialogues[0].dialogue, 'มาหาฉันสิ');
  assert.equal(ep.scenes[4].dialogues[0].dialogue, 'พี่ต้น... มันตามเรามา');
});
check('no "พูดขึ้น" / generic filler text', () => {
  for (const bad of ['พูดขึ้น', 'ดำเนินเหตุการณ์ต่อเนื่องไป', 'ดำเนินเรื่องต่อตามลำดับ']) assert.ok(!allText.includes(bad), bad);
});
check('endings are scene-specific (no ธันวา/มายด์/ลุงชาญ/โกดัง) and chained', () => {
  ep.scenes.forEach((s: any, i: number) => {
    assert.ok(!/ธันวา|มายด์|ลุงชาญ|โกดัง/.test(s.endState), `scene ${i + 1} end: ${s.endState}`);
    assert.ok(!/ธันวา|มายด์|ลุงชาญ|โกดัง/.test(s.startAction), `scene ${i + 1} start: ${s.startAction}`);
    if (i > 0) assert.equal(s.startAction, ep.scenes[i - 1].endState);
  });
  assert.ok(ep.scenes[0].endState.includes('พี่ต้นหยุดเขี่ยกองไฟ'), ep.scenes[0].endState);
  assert.ok(ep.scenes[4].endState.includes('พี่ต้น... มันตามเรามา'), ep.scenes[4].endState);
  const unique = new Set(ep.scenes.map((s: any) => s.endState));
  assert.equal(unique.size, 5);
});
check('main character filled for Character Lock', () => {
  ep.scenes.forEach((s: any) => assert.ok(['น้องฟ้าใส', 'พี่ต้น'].includes(s.mainCharacter), s.mainCharacter));
});
check('episode 2 has no new scenes (sliced, no re-split / duplicates)', () => {
  assert.equal(ep.hasMoreScenes, false);
  const ep2 = generateEpisodeLocally({ originalStory: SAMPLE, episodeNumber: 2, lastSceneState: { sceneNumber: 5 } });
  assert.equal(ep2.scenes.length, 0);
});
check('long headerless story is sliced per episode', () => {
  const long = Array.from({ length: 12 }, (_, i) => `เหตุการณ์ที่ ${i + 1}: ต้นเดินต่อไปข้างหน้าอีกก้าวหนึ่ง`).join('\n');
  const e1 = generateEpisodeLocally({ originalStory: long, episodeNumber: 1 });
  const e2 = generateEpisodeLocally({ originalStory: long, episodeNumber: 2, lastSceneState: { sceneNumber: e1.scenes.length } });
  assert.equal(e1.scenes.length, 5);
  assert.equal(e2.scenes[0].sceneNumber, 6);
  assert.ok(!e2.scenes.some((s: any) => e1.scenes.some((p: any) => p.actionDescription === s.actionDescription)));
});
check('validator: "ตัวละคร" allowed, null/undefined matched as whole tokens', () => {
  assert.ok(!FORBIDDEN_PLACEHOLDER_SUBSTRINGS.includes('ตัวละคร'));
  assert.equal(containsForbiddenPlaceholder('Character: Nullah', 'null'), false);
  assert.equal(containsForbiddenPlaceholder('Location: null.', 'null'), true);
  const v = validateSalaMultiClipPrompts([{
    clipNumber: 1, title: 't', durationSeconds: 10, sceneSummary: '', startAction: 'a', endAction: 'b', dialogues: [],
    continuityLockSummary: '', audioDirectiveSummary: '', negativePrompt: '',
    generatedPrompt: 'Cinematic 8K. Spatial Positioning Lock: ตำแหน่งตัวละครล็อคสอดคล้องต่อเนื่อง. Core action: walk.'
  }], []);
  assert.equal(v.isValid, true, v.errors.join('; '));
});
check('deriveScenePhysicalStates has no sample-story hard-coding', () => {
  const r = deriveScenePhysicalStates({ sceneIndex: 0, cleanAction: 'ใครบางคนถือตะเกียงเดินเข้ามาในโกดัง', sceneActiveChars: ['เอ'] });
  assert.ok(!/ลุงชาญ|ธันวา|มายด์/.test(r.endState + r.startState));
});

// ---------------------------------------------------------------------------
// Heading inheritance / pose handoff / missing-character (PROD-FIX-0927)
// ---------------------------------------------------------------------------
const JEALOUS = `ชื่อเรื่อง: แค่หึง ไม่ได้หมดรัก

ตัวละคร

- พี่ทุย — ผู้ชายใจร้อน พูดตรง แต่รักน้องน้ำมาก
- น้องน้ำ — ผู้หญิงอารมณ์ดี แต่บางครั้งชอบแกล้งให้พี่ทุยหึง

ฉากที่ 1 — หน้าบ้าน / ช่วงเย็น
พี่ทุยนั่งรอน้องน้ำอยู่หน้าบ้าน สีหน้าเริ่มไม่พอใจ เมื่อน้องน้ำเดินกลับมาพร้อมรอยยิ้ม

พี่ทุย: “ไปไหนมา ทำไมกลับช้าขนาดนี้?”
น้องน้ำ: “ไปธุระมานิดหน่อยเอง พี่ทุยจะถามอะไรเยอะแยะเนี่ย”
พี่ทุยมองน้องน้ำแบบจับผิด

ฉากที่ 2 — หน้าบ้านต่อเนื่อง
โทรศัพท์น้องน้ำดังขึ้น น้องน้ำรีบกดปิดหน้าจอ พี่ทุยเห็นพอดี

พี่ทุย: “ใครโทรมา ทำไมต้องรีบปิด?”
น้องน้ำ: “เพื่อนโทรมา ไม่มีอะไรหรอก”
พี่ทุย: “เพื่อนหรือใครกันแน่?”

น้องน้ำเริ่มทำหน้าจริงจัง

ฉากที่ 3 — อารมณ์เริ่มตึงเครียด
น้องน้ำยื่นโทรศัพท์ให้พี่ทุย

น้องน้ำ: “ถ้าไม่เชื่อก็ดูเลย น้ำไม่ได้มีใคร”
พี่ทุยรับโทรศัพท์มาแต่ยังไม่เปิดดู แล้ววางคืนให้น้องน้ำ

พี่ทุย: “พี่ไม่ได้อยากค้นโทรศัพท์ พี่แค่กลัวว่าน้ำจะไม่รักพี่แล้ว”

น้องน้ำเงียบไปครู่หนึ่ง

ฉากที่ 4 — คืนดีกัน
น้องน้ำเดินเข้าไปจับมือพี่ทุย

น้องน้ำ: “น้ำก็ยังรักพี่เหมือนเดิมนั่นแหละ แต่คราวหลังอย่าหึงจนไม่ฟังน้ำเลยนะ”
พี่ทุย: “ก็พี่รักน้ำมากนี่นา จะไม่ให้หึงได้ยังไง”
น้องน้ำหัวเราะเบา ๆ

น้องน้ำ: “งั้นคืนนี้พาไปกินหมูกระทะเป็นการไถ่โทษ”
พี่ทุย: “อ้าว สุดท้ายพี่เสียเงินอีกแล้วเหรอ!”

ทั้งคู่หัวเราะพร้อมกัน จบฉากด้วยบรรยากาศอบอุ่น`;

console.log('\nHeading inheritance / continuity tests');
check('parseSceneHeading: title/mood headings are not locations; "…ต่อเนื่อง" normalized', () => {
  assert.deepEqual(parseSceneHeading('หน้าบ้าน / ช่วงเย็น'), { location: 'หน้าบ้าน', timeOfDay: 'ช่วงเย็น', title: '', continued: false });
  const h2 = parseSceneHeading('หน้าบ้านต่อเนื่อง', true);
  assert.equal(h2.location, 'หน้าบ้าน'); assert.equal(h2.continued, true);
  for (const t of ['อารมณ์เริ่มตึงเครียด', 'คืนดีกัน']) {
    const h = parseSceneHeading(t, true);
    assert.equal(h.location, '', `${t} became location`);
    assert.equal(h.title, t);
  }
  // Backward compatible single-phrase / place headings
  assert.equal(parseSceneHeading('ป่าลึกยามค่ำคืน').location, 'ป่าลึกยามค่ำคืน');
  assert.equal(parseSceneHeading('แคมป์ในป่า - กลางคืน (ประมาณ 10 วินาที)').location, 'แคมป์ในป่า');
  assert.equal(parseSceneHeading('ห้องนอน (ต่อ)', true).location, 'ห้องนอน');
  assert.deepEqual(normalizeSceneLocation('หน้าบ้านต่อเนื่อง'), { location: 'หน้าบ้าน', continued: true, isTitle: false });
  assert.equal(normalizeSceneLocation('คืนดีกัน').isTitle, true);
});
const jEp: any = generateEpisodeLocally({
  originalStory: JEALOUS, episodeNumber: 1, targetSceneCount: 5,
  characters: [{ name: 'พี่ทุย', age: '28 ปี', hairStyle: 'ผมสั้นรองทรง', outfitDescription: 'เสื้อยืดสีกรมท่า กางเกงยีนส์' }] as any
});
check('"แค่หึง ไม่ได้หมดรัก": 4 scenes, all หน้าบ้าน / ช่วงเย็น, inherited from scene 1', () => {
  assert.equal(jEp.scenes.length, 4);
  assert.deepEqual(jEp.scenes.map((s: any) => s.location), ['หน้าบ้าน', 'หน้าบ้าน', 'หน้าบ้าน', 'หน้าบ้าน']);
  assert.deepEqual(jEp.scenes.map((s: any) => s.timeOfDay), ['ช่วงเย็น', 'ช่วงเย็น', 'ช่วงเย็น', 'ช่วงเย็น']);
  assert.ok(!JSON.stringify(jEp.scenes.map((s: any) => s.location)).includes('อารมณ์'));
  assert.ok(jEp.scenes[2].sceneHeading.includes('(อารมณ์เริ่มตึงเครียด)'));
});
check('"แค่หึง": characters and dialogue in the right scenes and order', () => {
  jEp.scenes.forEach((s: any) => assert.deepEqual([...s.characters].sort(), ['น้องน้ำ', 'พี่ทุย']));
  assert.deepEqual(jEp.scenes.map((s: any) => s.dialogues.length), [2, 3, 2, 4]);
  assert.deepEqual(jEp.scenes[1].dialogues.map((d: any) => d.speaker), ['พี่ทุย', 'น้องน้ำ', 'พี่ทุย']);
  assert.equal(jEp.scenes[0].dialogues[0].dialogue, 'ไปไหนมา ทำไมกลับช้าขนาดนี้?');
  assert.equal(jEp.scenes[3].dialogues[2].dialogue, 'งั้นคืนนี้พาไปกินหมูกระทะเป็นการไถ่โทษ');
  assert.equal(jEp.scenes[3].dialogues[3].speaker, 'พี่ทุย');
  assert.equal(jEp.hasMoreScenes, false);
});
check('full Character Lock + one Location Lock (same lighting) in every scene prompt', () => {
  const lightings = new Set(jEp.scenes.map((s: any) => s.locationLock.lighting));
  assert.equal(lightings.size, 1);
  jEp.scenes.forEach((s: any) => {
    assert.ok(s.visualPrompt.includes('age: 28 ปี') && s.visualPrompt.includes('hair: ผมสั้นรองทรง') && s.visualPrompt.includes('outfit: เสื้อยืดสีกรมท่า'), 'character lock');
    assert.ok(s.visualPrompt.includes(`Lighting Lock: ${[...lightings][0]}`), 'location lock');
    assert.ok(s.visualPrompt.includes('Continuity Handoff:'), 'pose handoff');
  });
  assert.equal(buildCharacterLockText({ name: 'เอ' }), 'เอ');
});
check('pose handoff: start pose of scene N = end pose of scene N-1', () => {
  for (let i = 1; i < jEp.scenes.length; i++) {
    const prev = jEp.scenes[i - 1].endPoses;
    const start = jEp.scenes[i].startPoses;
    prev.forEach((p: any) => assert.deepEqual(start.find((x: any) => x.name === p.name), p, `scene ${i + 1} ${p.name}`));
  }
  const tui = jEp.scenes[0].endPoses.find((p: any) => p.name === 'พี่ทุย');
  assert.equal(tui.posture, 'sitting');
  assert.equal(tui.place, 'หน้าบ้าน');
  assert.equal(jEp.continuityWarnings.length, 0, JSON.stringify(jEp.continuityWarnings));
});
check('pose jump warning (standing at door -> sitting in chair), none when the script moves them', () => {
  const jump = analyzeClipContinuity({ lockedCharacters: ['เอ', 'บี'], clips: [
    { text: 'เอยืนอยู่ที่ประตู บียิ้ม' },
    { text: 'เอนั่งอยู่บนเก้าอี้ บีมอง' }
  ] });
  assert.ok(jump.warnings.some(w => w.type === 'pose_jump' && w.character === 'เอ' && w.clipNumber === 2), JSON.stringify(jump.warnings));
  const moved = analyzeClipContinuity({ lockedCharacters: ['เอ', 'บี'], clips: [
    { text: 'เอยืนอยู่ที่ประตู บียิ้ม' },
    { text: 'เอเดินไปนั่งลงบนเก้าอี้ บีมอง' }
  ] });
  assert.equal(moved.warnings.length, 0, JSON.stringify(moved.warnings));
  assert.equal(moved.clips[1].startPoses.find(p => p.name === 'เอ')!.posture, 'standing');
  assert.equal(moved.clips[1].endPoses.find(p => p.name === 'เอ')!.posture, 'sitting');
});
check('missing locked character warning (disappears without leaving), none after "ออกไป"', () => {
  const missing = analyzeClipContinuity({ lockedCharacters: ['เอ', 'บี'], clips: [
    { text: 'เอนั่งคุยกับบี' },
    { text: 'เอหัวเราะคนเดียว' }
  ] });
  assert.ok(missing.warnings.some(w => w.type === 'missing_character' && w.character === 'บี'), JSON.stringify(missing.warnings));
  assert.ok(missing.clips[1].charactersPresent.includes('บี'), 'still present (not said to leave)');
  const left = analyzeClipContinuity({ lockedCharacters: ['เอ', 'บี'], clips: [
    { text: 'เอนั่งคุยกับบี บีเดินออกไป' },
    { text: 'เอหัวเราะคนเดียว' }
  ] });
  assert.equal(left.warnings.length, 0, JSON.stringify(left.warnings));
  assert.deepEqual(left.clips[1].charactersPresent, ['เอ']);
});
check('Multi-Clip board: handoff enforced, warnings surfaced, included in video prompts', () => {
  const base = { title: 't', durationSeconds: 10, startAction: 's', endAction: 'e', dialogues: [], continuityLockSummary: '', audioDirectiveSummary: '', negativePrompt: '', generatedPrompt: 'Cinematic 8K photorealistic shot of the scene.' };
  const r = attachClipContinuity([
    { ...base, clipNumber: 1, sceneSummary: 'เอยืนอยู่ที่ประตู บีนั่งบนโซฟา', endPoses: [{ name: 'เอ', posture: 'standing', place: 'ที่ประตู' }, { name: 'บี', posture: 'sitting', place: 'บนโซฟา' }] } as any,
    { ...base, clipNumber: 2, sceneSummary: 'เอพูดกับบี', startPoses: [{ name: 'เอ', posture: 'sitting', place: 'บนเก้าอี้' }] } as any,
    { ...base, clipNumber: 3, sceneSummary: 'เอยิ้ม' } as any
  ], ['เอ', 'บี'], { appendToPrompt: true });
  assert.deepEqual(r.clips[1].startPoses!.find(p => p.name === 'เอ'), { name: 'เอ', posture: 'standing', place: 'ที่ประตู' });
  assert.ok(r.warnings.some(w => w.type === 'handoff_mismatch' && w.clipNumber === 2));
  assert.ok(r.warnings.some(w => w.type === 'missing_character' && w.character === 'บี' && w.clipNumber === 3));
  assert.ok(r.clips[1].generatedPrompt.includes('Start pose (must exactly match the end pose of the previous clip): เอ standing'));
  const v = validateSalaMultiClipPrompts(r.clips, ['เอ', 'บี']);
  assert.ok(v.warnings.some(w => w.includes('บี') && w.includes('หายไป')));
  const built = buildSalaMultiClipPrompts({
    scriptText: 'ฉากที่ 1: เอยืนอยู่ที่ประตู บียิ้ม\nฉากที่ 2: เอนั่งอยู่บนเก้าอี้ บีมอง', clipDurationSeconds: 10, clipCount: 2,
    continuityLock: { characterName: 'เอ', characterNames: ['เอ', 'บี'], characterAppearance: '', location: 'ห้องนั่งเล่น', timeOfDay: '', lighting: '', visualStyle: '', aspectRatio: '16:9', resolution: '720p', cameraMovement: '', cameraShotType: 'Medium Shot', lensType: '', props: '', characterPosition: '' } as any
  });
  assert.ok(built.every(c => c.generatedPrompt.includes('Continuity Handoff:')));
  assert.ok((built[1].continuityWarnings || []).some(w => w.type === 'pose_jump'), JSON.stringify(built[1].continuityWarnings));
  assert.equal(enforcePoseHandoff([]).clips.length, 0);
});
check('Gemini story scenes: title/mood location inherits previous place/time + locks applied', () => {
  const r = applyEpisodeLocks([
    { sceneNumber: 1, location: 'หน้าบ้าน', timeOfDay: 'ช่วงเย็น', characters: ['พี่ทุย', 'น้องน้ำ'], actionDescription: 'พี่ทุยนั่งรอน้องน้ำอยู่หน้าบ้าน', dialogues: [], visualPrompt: 'Cinematic.' },
    { sceneNumber: 2, location: 'หน้าบ้านต่อเนื่อง', timeOfDay: '', characters: ['พี่ทุย', 'น้องน้ำ'], actionDescription: 'น้องน้ำยิ้มให้พี่ทุย', dialogues: [], visualPrompt: 'Cinematic.' },
    { sceneNumber: 3, location: 'คืนดีกัน', timeOfDay: 'ไม่ระบุจากต้นฉบับ', characters: ['พี่ทุย', 'น้องน้ำ'], actionDescription: 'น้องน้ำจับมือพี่ทุย', dialogues: [], visualPrompt: 'Cinematic.' }
  ], { originalStory: JEALOUS });
  assert.deepEqual(r.scenes.map((s: any) => [s.location, s.timeOfDay]), [['หน้าบ้าน', 'ช่วงเย็น'], ['หน้าบ้าน', 'ช่วงเย็น'], ['หน้าบ้าน', 'ช่วงเย็น']]);
  assert.equal(r.scenes[2].sceneTitle, 'คืนดีกัน');
  assert.equal(new Set(r.scenes.map((s: any) => s.locationLock.lighting)).size, 1);
  assert.ok(r.scenes.every((s: any) => s.visualPrompt.includes('Location Lock: หน้าบ้าน')));
});


// ---------------------------------------------------------------------------
// PROD-FIX2-0927: appearance lock / density split / end-of-story / position lock
// ---------------------------------------------------------------------------
console.log('\nPROD-FIX2-0927 regression tests');
// EXAMPLE appearance values (test data only, not from the story)
const EXAMPLE_CHARS = [
  { name: 'พี่ทุย', face: 'EXAMPLE หน้าคม', hairStyle: 'EXAMPLE ผมสั้นสีดำ', outfitDescription: 'EXAMPLE เสื้อโปโลสีกรมท่า' },
  { name: 'น้องน้ำ', face: 'EXAMPLE หน้าหวาน', hairstyle: 'EXAMPLE ผมยาว', outfit: 'EXAMPLE เดรสสีพาสเทล' }
];
const J_LOCK: any = { characterName: 'พี่ทุย', characterNames: ['พี่ทุย', 'น้องน้ำ'], characterAppearance: '', location: 'หน้าบ้าน', timeOfDay: 'ช่วงเย็น', lighting: '', visualStyle: '', aspectRatio: '16:9', resolution: '720p', cameraMovement: '', cameraShotType: 'Medium Shot', lensType: '', props: '', characterPosition: '' };
const mcWith = buildSalaMultiClipPrompts({ scriptText: JEALOUS, clipDurationSeconds: 10, clipCount: 4, continuityLock: J_LOCK, knownCharacters: ['พี่ทุย', 'น้องน้ำ'], characters: EXAMPLE_CHARS });
const mcNo = buildSalaMultiClipPrompts({ scriptText: JEALOUS, clipDurationSeconds: 10, clipCount: 4, continuityLock: J_LOCK, knownCharacters: ['พี่ทุย', 'น้องน้ำ'] });

check('fix1: multi-clip Character Lock carries face / hair / outfit for every character', () => {
  mcWith.forEach(c => {
    assert.ok(c.generatedPrompt.includes('พี่ทุย (face: EXAMPLE หน้าคม; hair: EXAMPLE ผมสั้นสีดำ; outfit: EXAMPLE เสื้อโปโลสีกรมท่า)'), c.generatedPrompt);
    assert.ok(c.generatedPrompt.includes('น้องน้ำ (face: EXAMPLE หน้าหวาน; hair: EXAMPLE ผมยาว; outfit: EXAMPLE เดรสสีพาสเทล)'));
    assert.deepEqual(c.appearanceWarnings, []);
  });
});
check('fix1: no appearance -> personality kept + "ยังไม่ได้ระบุรูปลักษณ์ของ X" warning, no fake placeholder', () => {
  mcNo.forEach(c => {
    assert.ok(c.generatedPrompt.includes('พี่ทุย (personality: ผู้ชายใจร้อน พูดตรง แต่รักน้องน้ำมาก)'), c.generatedPrompt);
    assert.ok(!c.generatedPrompt.includes('รูปลักษณ์ชัดเจน'));
    assert.ok((c.appearanceWarnings || []).some(w => w.includes('ยังไม่ได้ระบุรูปลักษณ์ของ พี่ทุย')));
  });
  const v = validateSalaMultiClipPrompts(mcNo, ['พี่ทุย', 'น้องน้ำ']);
  assert.equal(v.warnings.filter(w => w.includes('ยังไม่ได้ระบุรูปลักษณ์ของ น้องน้ำ')).length, 1);
  const ep: any = generateEpisodeLocally({ originalStory: JEALOUS });
  assert.ok(ep.characterWarnings.some((w: string) => w.includes('ยังไม่ได้ระบุรูปลักษณ์ของ พี่ทุย')));
  assert.ok(ep.scenes[0].visualPrompt.includes('personality: ผู้ชายใจร้อน'));
});
check('fix1: appearance parsed from the script character list; continuation uses supplied appearance', () => {
  const story = 'ตัวละคร\n- เอ — ผมสั้นสีดำ ใส่เสื้อยืดสีขาว ใจดี\n- บี: face: หน้ากลม, hair: ผมม้า, outfit: ชุดนักเรียน\n\nฉากที่ 1: ห้องเรียน - กลางวัน\nเอนั่งอยู่บนเก้าอี้ บียิ้ม';
  const list = parseScriptCharacterList(story);
  assert.deepEqual(list.map(c => c.name), ['เอ', 'บี']);
  const r = buildCharacterAppearanceLock(['เอ', 'บี'], [], list);
  assert.equal(r.text, 'เอ (hair: ผมสั้นสีดำ; outfit: ใส่เสื้อยืดสีขาว) | บี (face: หน้ากลม; hair: ผมม้า; outfit: ชุดนักเรียน)');
  assert.ok(r.warnings.some(w => w.includes('เอ') && w.includes('ใบหน้า')), 'partial warning for missing face');
  const ex = extractAppearanceFromDescription('ผู้ชายใจร้อน พูดตรง แต่รักน้องน้ำมาก');
  assert.equal(ex.face + ex.hair + ex.outfit + ex.appearance, '');
  const clips = buildSalaMultiClipPrompts({ scriptText: story, clipDurationSeconds: 10, clipCount: 1, continuityLock: { ...J_LOCK, characterName: 'เอ', characterNames: ['เอ', 'บี'], location: 'ห้องเรียน' }, knownCharacters: ['เอ', 'บี'] });
  assert.ok(clips[0].generatedPrompt.includes('บี (face: หน้ากลม; hair: ผมม้า; outfit: ชุดนักเรียน)'));
  const ep: any = generateEpisodeLocally({ originalStory: JEALOUS, characters: EXAMPLE_CHARS });
  ep.scenes.forEach((s: any) => assert.ok(s.visualPrompt.includes('พี่ทุย (face: EXAMPLE หน้าคม; hair: EXAMPLE ผมสั้นสีดำ; outfit: EXAMPLE เสื้อโปโลสีกรมท่า)')));
  assert.deepEqual(ep.characterWarnings, []);
});

check('fix2: scene 4 (4 lines) auto-splits into 2 clips -> 5 clips, dialogue in order, handoff kept', () => {
  assert.equal(mcWith.length, 5);
  assert.deepEqual(mcWith.map(c => c.dialogues.length), [2, 3, 2, 2, 2]);
  assert.ok(mcWith[3].title.includes('ฉากที่ 4') && mcWith[3].title.includes('(ตอนที่ 1/2)'), mcWith[3].title);
  assert.ok(mcWith[4].title.includes('(ตอนที่ 2/2)'));
  assert.equal(mcWith[3].dialogues[0].line, 'น้ำก็ยังรักพี่เหมือนเดิมนั่นแหละ แต่คราวหลังอย่าหึงจนไม่ฟังน้ำเลยนะ');
  assert.equal(mcWith[4].dialogues[0].line, 'งั้นคืนนี้พาไปกินหมูกระทะเป็นการไถ่โทษ');
  assert.deepEqual(mcWith.map(c => c.clipNumber), [1, 2, 3, 4, 5]);
  assert.equal(mcWith[4].startAction, mcWith[3].endAction);
  assert.ok(mcWith[3].sceneSummary.includes('จับมือพี่ทุย') && mcWith[3].sceneSummary.includes('หัวเราะเบา'));
  assert.ok(mcWith[4].sceneSummary.includes('ทั้งคู่หัวเราะพร้อมกัน'));
  assert.deepEqual(mcWith[4].startPoses, mcWith[3].endPoses);
  const sum = summarizeAutoSplit(mcWith, 4);
  assert.equal(sum.finalClipCount, 5); assert.equal(sum.splitScenes[0].sourceSceneNumber, 4); assert.equal(sum.splitScenes[0].parts, 2);
});
check('fix2: density rule keeps short scenes, respects autoSplitDense:false and longer clips', () => {
  assert.equal(checkDialogueDensity(['ใครโทรมา ทำไมต้องรีบปิด?', 'เพื่อนโทรมา ไม่มีอะไรหรอก', 'เพื่อนหรือใครกันแน่?'], 10).parts, 1);
  assert.equal(checkDialogueDensity(['ก', 'ข', 'ค', 'ง'], 10).parts, 2, '>3 lines for a 10s clip');
  const off = buildSalaMultiClipPrompts({ scriptText: JEALOUS, clipDurationSeconds: 10, clipCount: 4, continuityLock: J_LOCK, autoSplitDense: false });
  assert.equal(off.length, 4);
  const long = buildSalaMultiClipPrompts({ scriptText: JEALOUS, clipDurationSeconds: 20, clipCount: 4, continuityLock: J_LOCK });
  assert.equal(long.length, 4);
});

check('fix3: "จบฉาก" / จบ / -จบ- / THE END / ตอนจบ in the final lines = story finished', () => {
  assert.equal(hasExplicitEndingMarker(JEALOUS), true);
  const ep: any = generateEpisodeLocally({ originalStory: JEALOUS });
  assert.equal(ep.isStoryFinished, true);
  assert.equal(ep.hasMoreScenes, false);
  const base = 'ฉากที่ 1: บ้าน\nเอยิ้ม\nฉากที่ 2: สวน\nเอเดินเล่น';
  for (const m of ['จบ', '-จบ-', '— จบ —', '(จบ)', 'THE END', 'The End.', 'ตอนจบ', 'จบเรื่อง', 'จบบริบูรณ์']) {
    assert.equal(hasExplicitEndingMarker(`${base}\n${m}`), true, m);
  }
  assert.equal(hasExplicitEndingMarker(`${base} จบ`), true, 'trailing " จบ"');
});
check('fix3: no false ending mid-story, in dialogue, or in normal words', () => {
  assert.equal(hasExplicitEndingMarker('ฉากที่ 1: บ้าน\nเอพูดว่าจบเรื่องนี้ที\nจบฉากแรก\nฉากที่ 2: สวน\nเอเดินต่อ'), false, 'marker only in scene 1');
  assert.equal(hasExplicitEndingMarker('ฉากที่ 1: บ้าน\nเอ: "จบเรื่องนี้กันเถอะ"'), false, 'quoted dialogue');
  assert.equal(hasExplicitEndingMarker('ฉากที่ 1: บ้าน\nเอเพิ่งเรียนจบการศึกษา แล้วยิ้ม'), false, 'จบการศึกษา');
  assert.equal(hasExplicitEndingMarker('ฉากที่ 1: บ้าน\nจบฉาก\nเอเดิน\nบีวิ่ง\nซียิ้ม\nดีหัวเราะ'), false, 'not in last lines');
  assert.equal(ep.isStoryFinished, false, 'SAMPLE has no ending marker');
});

check('fix4: Position Lock on "แค่หึง": verbs / props / gesture / arrival detected, carried scene to scene', () => {
  const e: any = generateEpisodeLocally({ originalStory: JEALOUS });
  const pose = (sc: any, which: 'startPoses' | 'endPoses', n: string) => sc[which].find((p: any) => p.name === n);
  assert.equal(pose(e.scenes[0], 'startPoses', 'น้องน้ำ').entering, true);
  assert.deepEqual(pose(e.scenes[0], 'endPoses', 'น้องน้ำ'), { name: 'น้องน้ำ', posture: 'standing', place: 'หน้าบ้าน' });
  assert.equal(pose(e.scenes[0], 'endPoses', 'พี่ทุย').posture, 'sitting');
  assert.equal(pose(e.scenes[1], 'endPoses', 'น้องน้ำ').holding, 'ถือโทรศัพท์');
  assert.equal(pose(e.scenes[2], 'endPoses', 'พี่ทุย').holding, undefined, 'พี่ทุย put the phone back');
  assert.ok(pose(e.scenes[2], 'endPoses', 'น้องน้ำ').holding.includes('โทรศัพท์'));
  const n4 = pose(e.scenes[3], 'endPoses', 'น้องน้ำ');
  assert.equal(n4.place, 'ข้างพี่ทุย'); assert.equal(n4.gesture, 'จับมือพี่ทุย'); assert.equal(n4.posture, 'standing');
  for (let i = 1; i < e.scenes.length; i++) assert.deepEqual(e.scenes[i].startPoses, e.scenes[i - 1].endPoses);
  e.scenes.forEach((s: any) => assert.ok(s.visualPrompt.includes('Position Lock:')));
  assert.equal(e.continuityWarnings.length, 0);
  mcWith.forEach(c => assert.ok(c.generatedPrompt.includes('Position Lock:')));
});
check('fix4: locked start position from continuityLock + position-jump warnings; unknown place keeps previous', () => {
  const lockPos = { ...J_LOCK, characterName: 'เอ', characterNames: ['เอ', 'บี'], location: 'ห้อง', characterPositionLocks: [{ name: 'เอ', posture: 'sitting', place: 'บนเก้าอี้' }] };
  const c1 = buildSalaMultiClipPrompts({ scriptText: 'ฉากที่ 1: เอยืนอยู่ที่ประตู', clipDurationSeconds: 10, clipCount: 1, continuityLock: lockPos });
  assert.ok((c1[0].continuityWarnings || []).some(w => w.type === 'pose_jump'), JSON.stringify(c1[0].continuityWarnings));
  assert.ok(c1[0].generatedPrompt.includes('Start pose (must exactly match the end pose of the previous clip): เอ sitting (นั่ง) at บนเก้าอี้'));
  const a = analyzeClipContinuity({ lockedCharacters: ['เอ', 'บี'], clips: [
    { text: 'เอนั่งอยู่บนเก้าอี้ บีรับโทรศัพท์มา' }, { text: 'เอนั่งอยู่บนโซฟา' }, { text: 'บีหัวเราะ แล้ววางคืนให้เอ' }
  ] });
  assert.ok(a.warnings.some(w => w.type === 'place_jump' && w.clipNumber === 2 && w.character === 'เอ'));
  const b3 = a.clips[2].endPoses.find(p => p.name === 'บี')!;
  assert.equal(b3.holding, undefined, 'subject บี (not เอ) returned the phone');
  assert.ok((a.clips[2].endPoses.find(p => p.name === 'เอ')!.holding || '').includes('โทรศัพท์'));
  const c2 = attachClipContinuity([{ clipNumber: 1, title: 't', durationSeconds: 10, sceneSummary: 'เอยิ้ม', startAction: '', endAction: '', dialogues: [], continuityLockSummary: '', audioDirectiveSummary: '', generatedPrompt: 'x.', negativePrompt: '' } as any], ['เอ'], { appendToPrompt: true, initialPoses: [{ name: 'เอ', posture: 'sitting', place: 'บนเก้าอี้' }] as any });
  assert.deepEqual(c2.clips[0].endPoses, [{ name: 'เอ', posture: 'sitting', place: 'บนเก้าอี้' }], 'no movement -> previous position kept');
  const g = applyEpisodeLocks([{ sceneNumber: 1, location: 'หน้าบ้าน', timeOfDay: 'ช่วงเย็น', characters: ['พี่ทุย'], actionDescription: 'พี่ทุยนั่งอยู่หน้าบ้าน', dialogues: [], visualPrompt: 'Cinematic.' }], { originalStory: JEALOUS, characters: EXAMPLE_CHARS });
  assert.ok(g.scenes[0].visualPrompt.includes('Position Lock:') && g.scenes[0].visualPrompt.includes('face: EXAMPLE หน้าคม'));
});


// ---------------------------------------------------------------------------
// Lock coverage (Location / Story locks across split, Multi-Clip, continuation)
// ---------------------------------------------------------------------------
check('lock: Location Lock forced into split prompts (location / time / lighting / set / props), untouched when not locked', () => {
  const p = 'Cinematic 8K, Character Lock: เอ, Location Lock: ห้องครัว, Time: กลางคืน, Lighting Lock: cool night light, soft, consistent, Scene Action: เอยิ้ม';
  const out = syncLocationLockInPrompt(p, { location: 'หน้าบ้าน', timeOfDay: 'ช่วงเย็น', lighting: 'warm golden-hour, long shadows', locationVisualDetails: 'EXAMPLE ประตูไม้', props: 'EXAMPLE แก้วกาแฟ' });
  assert.equal(out, 'Cinematic 8K, Character Lock: เอ, Location Lock: หน้าบ้าน, Time: ช่วงเย็น, Lighting Lock: warm golden-hour, long shadows, Scene Action: เอยิ้ม, Set Lock: EXAMPLE ประตูไม้, Props Lock: EXAMPLE แก้วกาแฟ');
  assert.equal(syncLocationLockInPrompt(p, {}), p);
});
check('lock: Location Lock set details + props in every continuation scene at the locked place; Multi-Clip keeps set + props', () => {
  const lock = { location: 'หน้าบ้าน', timeOfDay: 'ช่วงเย็น', locationVisualDetails: 'EXAMPLE ประตูไม้สีน้ำตาล', props: 'EXAMPLE โทรศัพท์มือถือ' };
  const ep: any = generateEpisodeLocally({ originalStory: JEALOUS, continuityLock: lock });
  assert.ok(ep.scenes.length > 0);
  ep.scenes.forEach((sc: any) => {
    assert.ok(sc.visualPrompt.includes('Set Lock: EXAMPLE ประตูไม้สีน้ำตาล') && sc.visualPrompt.includes('Props Lock: EXAMPLE โทรศัพท์มือถือ'), sc.visualPrompt);
  });
  const clips = buildSalaMultiClipPrompts({ scriptText: JEALOUS, clipDurationSeconds: 10, clipCount: 4, continuityLock: { ...J_LOCK, ...lock }, knownCharacters: ['พี่ทุย', 'น้องน้ำ'] });
  clips.forEach(c => assert.ok(c.generatedPrompt.includes('Architectural Environment: EXAMPLE ประตูไม้สีน้ำตาล') && c.generatedPrompt.includes('Props: EXAMPLE โทรศัพท์มือถือ') && c.generatedPrompt.includes('Location: หน้าบ้าน')));
  const plain: any = generateEpisodeLocally({ originalStory: JEALOUS });
  assert.ok(plain.scenes.every((sc: any) => !sc.visualPrompt.includes('Set Lock:') && !sc.visualPrompt.includes('Props Lock:')));
});
check('lock: Story Lock - continuation starts from the previous end state and warns on repeated scenes', () => {
  const existing = [{ sceneNumber: 1, summary: 'พี่ทุยนั่งรอน้องน้ำอยู่หน้าบ้าน สีหน้าเริ่มไม่พอใจ', endAction: 'พี่ทุยจ้องน้องน้ำ' }];
  const r = applyEpisodeLocks([
    { sceneNumber: 2, location: 'หน้าบ้าน', timeOfDay: 'ช่วงเย็น', actionDescription: '[ช็อต 10 วินาที] พี่ทุยนั่งรอน้องน้ำอยู่หน้าบ้าน สีหน้าเริ่มไม่พอใจ', visualPrompt: 'x', characters: ['พี่ทุย'] },
    { sceneNumber: 3, location: 'หน้าบ้าน', timeOfDay: 'ช่วงเย็น', actionDescription: 'น้องน้ำยื่นโทรศัพท์ให้พี่ทุยดู', visualPrompt: 'y', characters: ['พี่ทุย', 'น้องน้ำ'] }
  ], { originalStory: JEALOUS, lastSceneState: { sceneNumber: 1, endAction: 'พี่ทุยจ้องน้องน้ำ', location: 'หน้าบ้าน', timeOfDay: 'ช่วงเย็น' }, existingScenes: existing });
  assert.equal(r.scenes[0].startAction, 'พี่ทุยจ้องน้องน้ำ');
  const rep = r.warnings.filter(w => w.type === 'story_repeat');
  assert.equal(rep.length, 1);
  assert.equal(rep[0].clipNumber, 2);
  assert.ok(r.scenes[0].continuityWarnings.some((w: any) => w.type === 'story_repeat'));
  assert.equal(checkStoryRepeats([{ sceneNumber: 5, actionDescription: 'ฉากใหม่ทั้งหมดที่ไม่เคยเกิดขึ้นมาก่อนเลย' }], existing).length, 0);
  assert.equal(checkStoryRepeats([{ sceneNumber: 1, actionDescription: 'อะไรก็ได้' }], existing)[0].type, 'story_repeat');
});

check('in-app แค่หึง case (combined "พี่ทุย และ น้องน้ำ"): 5 clips, no double lines, cast kept across sub-clips, no "locked character disappears"', () => {
  const story = JEALOUS;
  const D = (clip: number, speaker: string, line: string, tone: string) => ({ id: `g${clip}_${line.length}`, speaker, line, emotionTone: tone, clipNumber: clip });
  const dialogues = [
    D(1, 'พี่ทุย', 'ไปไหนมา ทำไมกลับช้าขนาดนี้?', 'หงุดหงิด สงสัย'), D(1, 'น้องน้ำ', 'ไปธุระมานิดหน่อยเอง พี่ทุยจะถามอะไรเยอะแยะเนี่ย', 'หยอกล้อ'),
    D(2, 'พี่ทุย', 'ใครโทรมา ทำไมต้องรีบปิด?', 'ระแวง'), D(2, 'น้องน้ำ', 'เพื่อนโทรมา ไม่มีอะไรหรอก', 'เรียบๆ'), D(2, 'พี่ทุย', 'เพื่อนหรือใครกันแน่?', 'คาดคั้น'),
    D(3, 'น้องน้ำ', 'ถ้าไม่เชื่อก็ดูเลย น้ำไม่ได้มีใคร', 'จริงจัง'), D(3, 'พี่ทุย', 'พี่ไม่ได้อยากค้นโทรศัพท์ พี่แค่กลัวว่าน้ำจะไม่รักพี่แล้ว', 'ตัดพ้อ'),
    D(4, 'น้องน้ำ', 'น้ำก็ยังรักพี่เหมือนเดิมนั่นแหละ แต่คราวหลังอย่าหึงจนไม่ฟังน้ำเลยนะ', 'อ่อนโยน'), D(4, 'พี่ทุย', 'ก็พี่รักน้ำมากนี่นา จะไม่ให้หึงได้ยังไง', 'เขินอาย'),
    D(4, 'น้องน้ำ', 'งั้นคืนนี้พาไปกินหมูกระทะเป็นการไถ่โทษ', 'อารมณ์ดี'), D(4, 'พี่ทุย', 'อ้าว สุดท้ายพี่เสียเงินอีกแล้วเหรอ!', 'ขำๆ')
  ];
  // In-app Gemini split style: the lock holds a combined label (with and without spaces)
  for (const combinedName of ['พี่ทุย และ น้องน้ำ', 'พี่ทุยและน้องน้ำ']) {
    const lock: any = { characterName: combinedName, characterNames: [combinedName], characterAppearance: 'พี่ทุยสวมเสื้อยืด, น้องน้ำสวมชุดเดรส',
      location: 'หน้าบ้าน', timeOfDay: 'ช่วงเย็น', lighting: 'แสงอาทิตย์ยามเย็นสีส้มทอง (Golden Hour Light)', visualStyle: 'Cinematic Photorealistic 8K' };
    const clips = buildSalaMultiClipPrompts({ scriptText: story, clipDurationSeconds: 10, clipCount: 4, continuityLock: lock, dialogues, audioDirectives: {} as any, knownCharacters: [combinedName], characters: [] });
    // Double-counted dialogue fixed: 4 scenes -> 5 clips (only scene 4 is split in two)
    assert.equal(clips.length, 5, clips.map(c => c.title).join(' | '));
    assert.deepEqual(clips.map(c => (c as any).splitPart?.sourceSceneNumber ?? c.clipNumber), [1, 2, 3, 4, 4]);
    const allLines = clips.flatMap(c => c.dialogues);
    assert.equal(allLines.length, dialogues.length, JSON.stringify(allLines.map(d => `${d.speaker}: ${d.line}`)));
    assert.equal(new Set(allLines.map(d => d.line)).size, allLines.length, 'no double lines');
    assert.ok(allLines.every(d => d.speaker === 'พี่ทุย' || d.speaker === 'น้องน้ำ'), JSON.stringify(allLines.map(d => d.speaker)));
    const v = validateSalaMultiClipPrompts(clips, [combinedName]);
    assert.equal(v.warnings.filter(w => w.includes('disappears') || w.includes('หายไป')).length, 0, JSON.stringify(v.warnings));
    clips.forEach(c => {
      assert.ok(c.charactersPresent!.includes('พี่ทุย') && c.charactersPresent!.includes('น้องน้ำ'), `clip ${c.clipNumber}: ${c.charactersPresent}`);
      assert.equal(c.locationName, 'หน้าบ้าน');
      assert.ok(c.generatedPrompt.includes('Stance/Position Lock:'), `clip ${c.clipNumber} stance lock`);
      assert.ok(!/(พี่ทุย และ น้องน้ำ|พี่ทุยและน้องน้ำ) speaks/.test(c.generatedPrompt), `clip ${c.clipNumber} combined speaker`);
      if (c.clipNumber > 1) assert.ok(/Stance\/Position Lock: Start pose[^.]*พี่ทุย[^.]*น้องน้ำ/.test(c.generatedPrompt), `clip ${c.clipNumber} start pose`);
    });
  }
  // Dedupe helper: combined label + real speaker = one entry (real speaker); different speakers stay separate
  const dd = dedupeDialogueEntries([
    { speaker: 'พี่ทุย และ น้องน้ำ', line: '“ไปไหนมา”' }, { speaker: 'พี่ทุย', line: 'ไปไหนมา' },
    { speaker: 'พี่ทุย', line: 'ใช่' }, { speaker: 'น้องน้ำ', line: 'ใช่' }, { speaker: 'น้องน้ำกระซิบ', line: ' ใช่ ' }
  ], ['พี่ทุย และ น้องน้ำ']);
  assert.deepEqual(dd.map(d => `${d.speaker}:${d.line.trim()}`), ['พี่ทุย:ไปไหนมา', 'พี่ทุย:ใช่', 'น้องน้ำ:ใช่']);
  assert.deepEqual(expandCombinedCharacterNames(['พี่ทุยและน้องน้ำ', 'เอ กับ บี', 'Ann & Bob', 'Sandra']), ['พี่ทุย', 'น้องน้ำ', 'เอ', 'บี', 'Ann', 'Bob', 'Sandra']);
  // Same-scene sub-clips inherit the cast; a new scene without the character still warns; an explicit exit is honoured
  const sub = analyzeClipContinuity({ lockedCharacters: ['เอ', 'บี'], clips: [
    { text: 'เอนั่งคุยกับบี', sceneKey: 's1' },
    { text: 'เอหัวเราะคนเดียว', sceneKey: 's1' },
    { text: 'เอยิ้ม', sceneKey: 's2' }
  ] });
  assert.ok(!sub.warnings.some(w => w.clipNumber === 2), JSON.stringify(sub.warnings));
  assert.ok(sub.clips[1].charactersPresent.includes('บี'));
  assert.ok(sub.warnings.some(w => w.type === 'missing_character' && w.character === 'บี' && w.clipNumber === 3));
  const exit = analyzeClipContinuity({ lockedCharacters: ['เอ', 'บี'], clips: [
    { text: 'เอนั่งคุยกับบี บีเดินออกไป', sceneKey: 's1' },
    { text: 'เอหัวเราะคนเดียว', sceneKey: 's1' }
  ] });
  assert.deepEqual(exit.clips[1].charactersPresent, ['เอ']);
});

check('Character Lock from the library (แค่หึง + mock library พี่ทุย): appearance / tag / reference in every clip, warnings for น้องน้ำ and lost reference', () => {
  const APPEAR = "P'Tui, young male buffalo, anthropomorphic 3D Pixar style, dark brown fluffy fur, large curved horns with texture, pink blush on cheeks, big expressive brown eyes, wearing indigo blue traditional Thai farmer shirt with 4 wooden buttons, red sash belt, brown traditional pants, bamboo basket on back - keep exact same face, horns, fur, and outfit as reference sheet";
  const TAG = '(พี่ทุย_consistent_char:1.2)';
  const card = (extra: any = {}) => ({
    id: 'char_tui', name: 'พี่ทุย', gender: 'ชาย', age: '24 ปี', description: '', appearance: APPEAR, hairStyle: 'ตามภาพอ้างอิง', triggerTag: TAG,
    referenceImages: ['/uploads/characters/ref_1790361434738.png'], referenceImageUrl: '/uploads/characters/ref_1790361434738.png', lockStatus: 'LOCKED',
    referenceMetadata: { referenceImageId: 'ref_1790361434738', imageHash: 'h1', availableViews: ['MULTI_VIEWS'] },
    visualProfile: { hairStyle: 'ตามภาพอ้างอิง', shoes: 'ไม่เห็นชัดในภาพ', referenceImageUrl: '/uploads/characters/ref_1790361434738.png' }, ...extra
  });
  // Decoy that must never be matched to น้องน้ำ (no fuzzy matching)
  const decoy = { id: 'char_x', name: 'น้องน้ำหวาน', appearance: 'DECOY_LOOK red dress', triggerTag: '(decoy:1.0)' };
  const lock: any = { location: 'หน้าบ้าน', timeOfDay: 'ช่วงเย็น', lighting: 'แสงอาทิตย์ยามเย็นสีส้มทอง (Golden Hour Light)', visualStyle: 'Cinematic Photorealistic 8K',
    characterNames: ['พี่ทุย', 'น้องน้ำ'], characterName: 'พี่ทุย' };
  const run = (library: any[]) => {
    const payloads = library.map(c => toCharacterLockPayload(c));
    const split = applySplitLocks(parseScriptLocally(JEALOUS, 4, payloads), lock, { characters: payloads, scriptText: JEALOUS });
    const dialogues = split.dialogues.map((d: any, i: number) => ({ id: `d${i}`, speaker: d.speaker, line: d.line, emotionTone: d.emotionTone, clipNumber: d.sceneNumber }));
    const clips = buildSalaMultiClipPrompts({ scriptText: JEALOUS, clipDurationSeconds: 10, clipCount: split.scenes.length, continuityLock: lock, dialogues, audioDirectives: {} as any,
      knownCharacters: ['พี่ทุย', 'น้องน้ำ'], characters: payloads });
    return { split, clips, v: validateSalaMultiClipPrompts(clips, ['พี่ทุย', 'น้องน้ำ']) };
  };

  const ok = run([card({ referenceStatus: 'ok' }), decoy]);
  assert.equal(ok.clips.length, 5);
  ok.clips.forEach(c => {
    assert.ok(c.generatedPrompt.includes(`พี่ทุย (appearance: ${APPEAR}`), `clip ${c.clipNumber}: ${c.generatedPrompt}`);
    assert.ok(c.generatedPrompt.includes(`tag: ${TAG}`), `clip ${c.clipNumber} tag`);
    assert.ok(c.generatedPrompt.includes('Reference image: พี่ทุย reference sheet (multi-view) — match exactly'), `clip ${c.clipNumber} reference`);
    assert.ok(/Character Lock: [^|]*\| น้องน้ำ/.test(c.generatedPrompt), `clip ${c.clipNumber} น้องน้ำ in lock`);
    assert.ok(!c.generatedPrompt.includes('DECOY_LOOK') && !c.generatedPrompt.includes('ตามภาพอ้างอิง') && !c.generatedPrompt.includes('ไม่เห็นชัดในภาพ'), `clip ${c.clipNumber} decoy/placeholder`);
  });
  assert.ok(ok.v.warnings.some(w => w.includes('ยังไม่ได้ระบุรูปลักษณ์ของ น้องน้ำ')), JSON.stringify(ok.v.warnings));
  assert.ok(!ok.v.warnings.some(w => w.includes('ยังไม่ได้ระบุรูปลักษณ์ของ พี่ทุย') || w.includes('รูปอ้างอิงของ')), JSON.stringify(ok.v.warnings));
  assert.ok(ok.split.characterWarnings.some((w: string) => w.includes('น้องน้ำ')));

  // Lost reference file: warning, no dead reference line; a data-URL backup keeps the reference
  const lost = run([card({ referenceStatus: 'missing' })]);
  assert.ok(lost.v.warnings.some(w => w.includes('รูปอ้างอิงของ พี่ทุย หาย กรุณาอัปโหลดใหม่')), JSON.stringify(lost.v.warnings));
  lost.clips.forEach(c => { assert.ok(!c.generatedPrompt.includes('Reference image:')); assert.ok(c.generatedPrompt.includes(APPEAR)); });
  const backed = run([card({ referenceStatus: 'missing', referenceImageBackup: 'data:image/jpeg;base64,AAAA' })]);
  assert.ok(!backed.v.warnings.some(w => w.includes('รูปอ้างอิงของ')));
  assert.ok(backed.clips.every(c => c.generatedPrompt.includes('Reference image: พี่ทุย reference sheet')));

  // Name normalization: "ทุย" / "พี่ ทุย" cards match พี่ทุย; ambiguous / partial names never match
  assert.equal(findCharacterByName([{ name: 'ทุย' }], 'พี่ทุย')?.name, 'ทุย');
  assert.equal(findCharacterByName([{ name: 'พี่ ทุย' }], 'พี่ทุย')?.name, 'พี่ ทุย');
  assert.equal(findCharacterByName([{ name: 'ฟ้าใส (Fahsai)' }], 'ฟ้าใส')?.name, 'ฟ้าใส (Fahsai)');
  assert.equal(findCharacterByName([{ name: 'น้องน้ำหวาน' }], 'น้องน้ำ'), undefined);
  assert.equal(findCharacterByName([{ name: 'น้อง' }], 'น้องน้ำ'), undefined);
  assert.equal(findCharacterByName([{ name: 'พี่ทุย' }, { name: 'น้องทุย' }], 'ทุย'), undefined);

  // Gemini-invented Character Lock is replaced by the library card (post-processing, not only the prompt)
  const gem = enforceLibraryCharacterLocks([{ clipNumber: 1, title: 't', durationSeconds: 10, sceneSummary: 's', startAction: 's', endAction: 'e', dialogues: [], continuityLockSummary: '', audioDirectiveSummary: '', negativePrompt: '',
    charactersPresent: ['พี่ทุย'], generatedPrompt: 'Cinematic 8K. Location: หน้าบ้าน. Character Lock: พี่ทุย (a tall man in a red business suit with short black hair). Spatial Positioning Lock: center frame. Core action: พี่ทุยนั่งรอ.' } as any],
    [toCharacterLockPayload(card())]);
  assert.ok(!gem[0].generatedPrompt.includes('red business suit'), gem[0].generatedPrompt);
  assert.ok(gem[0].generatedPrompt.includes(`Character Lock: พี่ทุย (appearance: ${APPEAR}`), gem[0].generatedPrompt);
  assert.ok(gem[0].generatedPrompt.includes('Spatial Positioning Lock: center frame. Core action: พี่ทุยนั่งรอ.'), gem[0].generatedPrompt);
});

// ---------------------------------------------------------------------------------------------
console.log('\nFIX4: robust Character Lock (multi-sentence library text) + Location Library Lock');
{
  const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const rd = (f: string) => fs.readFileSync(path.join(FIX, f), 'utf8').trim();
  const STORY = fs.readFileSync(path.join(FIX, 't67-story.txt'), 'utf8');
  const TUI_OUTFIT = 'Indigo-blue stand-collar Thai cotton shirt with four brown frog-toggle fastenings and two lower patch pockets, rust-red plaid pha khao ma sash knotted at front, dark brown-grey baggy trousers gathered below the knee, round woven bamboo hat on back, rope cord necklace';
  const NAM_OUTFIT = 'Deep red silk sabai with gold brocade over left shoulder, matching red silk pha sin with gold diamond pattern, gold front panel and gold hem, ornate gold belt, gold necklace with pendant, gold bangles on both wrists';
  const LIB = [
    { id: 'char_tui', name: 'พี่ทุย', gender: 'ชาย', age: '24', appearance: rd('charlib/ptui-appearance.txt'), hairStyle: rd('charlib/ptui-hair.txt'), shoes: rd('charlib/ptui-shoes.txt'), outfit: TUI_OUTFIT,
      triggerTag: '(พี่ทุย_consistent_char:1.2)', referenceImageUrl: '/uploads/characters/ptui-ref.png', referenceStatus: 'ok', lockStatus: 'LOCKED',
      referenceMetadata: { referenceImageId: 'ref_ptui', imageHash: 'h_ptui', availableViews: ['MULTI_VIEWS'] } },
    { id: 'char_nam', name: 'น้องน้ำ', gender: 'หญิง', appearance: rd('charlib/nongnam-appearance.txt'), hairStyle: rd('charlib/nongnam-hair.txt'), shoes: rd('charlib/nongnam-shoes.txt'), outfit: NAM_OUTFIT,
      triggerTag: '(น้องน้ำ_consistent_char:1.2)', referenceImageUrl: '/uploads/characters/nongnam-ref.png', referenceStatus: 'ok', lockStatus: 'LOCKED',
      referenceMetadata: { referenceImageId: 'ref_nam', imageHash: 'h_nam' } }
  ];
  const payloads = LIB.map(c => toCharacterLockPayload(c));
  const cnt = (h: string, n: string) => h.split(n).length - 1;
  const appearanceInLock = (a: string) => stripDefaultPose(a).replace(/[\s.]+$/, '');
  const lock: any = { location: 'หน้าบ้าน', timeOfDay: 'ช่วงเย็น', lighting: 'แสงอาทิตย์ยามเย็นสีส้มทอง (Golden Hour Light)', visualStyle: 'Cinematic Photorealistic 8K', characterNames: ['พี่ทุย', 'น้องน้ำ'], characterName: 'พี่ทุย' };
  const build = (script: string, l: any, locations?: any[]) => {
    const split = applySplitLocks(parseScriptLocally(script, 4, payloads), l, { characters: payloads, scriptText: script });
    const dialogues = split.dialogues.map((d: any, i: number) => ({ id: `d${i}`, speaker: d.speaker, line: d.line, emotionTone: d.emotionTone, clipNumber: d.sceneNumber }));
    return buildSalaMultiClipPrompts({ scriptText: script, clipDurationSeconds: 10, clipCount: split.scenes.length, continuityLock: l, dialogues, audioDirectives: {} as any,
      knownCharacters: ['พี่ทุย', 'น้องน้ำ'], characters: payloads, locations });
  };
  const assertOnce = (clips: any[], label: string) => clips.forEach(c => {
    const p = c.generatedPrompt;
    const present = c.charactersPresent || [];
    LIB.filter(l => present.includes(l.name)).forEach(l => {
      for (const [what, text] of [['appearance', appearanceInLock(l.appearance)], ['hair', l.hairStyle], ['shoes', l.shoes], ['outfit', l.outfit], ['tag', l.triggerTag]] as const) {
        assert.equal(cnt(p, text), 1, `${label} clip ${c.clipNumber} ${l.name} ${what} count ${cnt(p, text)}`);
      }
    });
    assert.equal(cnt(p, 'Character Lock:'), 1, `${label} clip ${c.clipNumber} lock count`);
    assert.equal(cnt(p, 'identical face, hair and outfit in every clip'), 1, `${label} clip ${c.clipNumber} lock tail`);
    assert.ok(!/Default pose:/.test(p), `${label} clip ${c.clipNumber} default pose`);
    assert.ok(p.includes('pose/position: follow the Stance/Position Lock'), `${label} clip ${c.clipNumber} pose rule`);
    assert.ok(!p.includes('.;'), `${label} clip ${c.clipNumber} ".;"`);
    assert.ok(!/brown fur|business suit|jeans|sneakers|carries a basket/.test(p), `${label} clip ${c.clipNumber} invented look: ${p}`);
    assert.deepEqual(lockDuplicationProblems(c), [], `${label} clip ${c.clipNumber}`);
  });

  check('multi-sentence library appearance: exactly once per character per clip, no Default pose, run twice = same', () => {
    const clips = build(STORY, lock);
    assert.equal(clips.length, 5);
    assertOnce(clips, 'offline');
    clips.forEach(c => assert.ok(c.generatedPrompt.includes('Spatial Positioning Lock: พี่ทุย and น้องน้ำ together in frame'), c.generatedPrompt));
    const twice = enforceLibraryCharacterLocks(clips, payloads);
    twice.forEach((c, i) => assert.equal(c.generatedPrompt, clips[i].generatedPrompt, `clip ${c.clipNumber} changed on 2nd pass`));
    assert.deepEqual(validateSalaMultiClipPrompts(clips, ['พี่ทุย', 'น้องน้ำ']).warnings.filter(w => /ซ้ำ|ปรากฏ/.test(w)), []);
  });

  check('Gemini path: multi-sentence invented lock, inline looks, server-appended lock -> library lock once', () => {
    const base = { title: 't', durationSeconds: 10, sceneSummary: 's', startAction: 's', endAction: 'e', dialogues: [], continuityLockSummary: '', audioDirectiveSummary: '', negativePrompt: '' };
    const serverAppended = (prompt: string, present: string[]) => {
      const r = buildCharacterAppearanceLock(present, payloads);
      return `${prompt} Character Lock: ${r.text}, identical face, hair and outfit in every clip. Continuity Handoff: Characters present in this clip: ${present.join(', ')}.`;
    };
    const fake: any[] = [
      { ...base, clipNumber: 1, charactersPresent: ['พี่ทุย', 'น้องน้ำ'], generatedPrompt: serverAppended('Cinematic 8K. Location: หน้าบ้าน. Character Lock: พี่ทุย wearing a red business suit. He has brown fur and carries a basket. น้องน้ำ in jeans. Spatial Positioning Lock: side by side. Core action: จับมือ.', ['พี่ทุย', 'น้องน้ำ']) },
      { ...base, clipNumber: 2, charactersPresent: ['พี่ทุย', 'น้องน้ำ'], generatedPrompt: 'Cinematic 8K. Location: หน้าบ้าน. Spatial Positioning Lock: side by side. Core action: พี่ทุย (brown fur, red business suit) จับมือน้องน้ำ (in jeans).' },
      { ...base, clipNumber: 3, charactersPresent: ['พี่ทุย'], generatedPrompt: 'Cinematic 8K. Character Lock: พี่ทุย (red business suit; Outfit: brown fur coat). Reference image: none. Spatial Positioning Lock: center. Core action: หัวเราะ (ยิ้มกว้าง).' }
    ];
    const once = enforceLibraryCharacterLocks(fake, payloads);
    assertOnce(once, 'gemini');
    assert.ok(once[1].appearanceWarnings!.some(w => w.includes('ตัดรูปลักษณ์ที่ไม่ได้มาจากคลังของ พี่ทุย')));
    assert.ok(once[2].generatedPrompt.includes('หัวเราะ (ยิ้มกว้าง)'), 'expression parentheses kept');
    assert.ok(once[0].generatedPrompt.indexOf('Character Lock:') < once[0].generatedPrompt.indexOf('Core action:'), 'lock before the action');
    const again = enforceLibraryCharacterLocks(once, payloads);
    again.forEach((c, i) => assert.equal(c.generatedPrompt, once[i].generatedPrompt));
    // validator flags an orphaned copy
    const broken = { ...once[0], generatedPrompt: `${once[0].generatedPrompt} ${appearanceInLock(LIB[1].appearance)}, identical face, hair and outfit in every clip. tag ${LIB[0].triggerTag}` };
    assert.ok(lockDuplicationProblems(broken).length >= 2, JSON.stringify(lockDuplicationProblems(broken)));
  });

  // ---- Location library from the 8 verified descriptions (tests/fixtures/locations) ----
  const sources = fs.readFileSync(path.join(FIX, 'locations/SOURCES.md'), 'utf8');
  const LOCS = fs.readdirSync(path.join(FIX, 'locations')).filter(f => f.endsWith('.txt')).sort().map(f => {
    const row = sources.split('\n').find(r => r.includes(f.replace('.txt', '.jpg')))!;
    const shortName = row.split('|')[3].trim();
    return { id: `loc_${f.slice(0, 2)}`, name: shortName, type: 'LOCATION', storyProfile: { description: rd(`locations/${f}`) }, referenceImageUrl: `/uploads/locations/${f.replace('.txt', '.jpg')}`, referenceStatus: 'ok' as const };
  });
  const locPayloads = LOCS.map(l => toLocationLockPayload(l));
  const desc = (name: string) => LOCS.find(l => l.name === name)!.storyProfile.description;
  const REF = (name: string) => `Reference image: ${name} reference photo — match exactly (do not add, remove or move objects).`;

  check('location library: 8 cards, safe name matching (exact, normalized unique, never partial)', () => {
    assert.equal(LOCS.length, 8);
    assert.deepEqual(LOCS.slice(0, 3).map(l => l.name), ['เรือนไทยภาคกลาง', 'บ้านไม้ยกพื้น', 'ท้องทุ่งนา']);
    assert.equal(findLocationByName(LOCS, 'ห้องครัว')?.id, 'loc_07');
    assert.equal(findLocationByName(LOCS, ' ห้อง ครัว ')?.id, 'loc_07');
    assert.equal(findLocationByName(LOCS, 'วัด')?.id, 'loc_04'); // "วัด (อุโบสถ)" normalized
    assert.equal(findLocationByName(LOCS, 'ครัว'), undefined);
    assert.equal(findLocationByName(LOCS, 'ห้อง'), undefined);
    assert.equal(findLocationByName(LOCS, 'เรือนไทย'), undefined);
    assert.equal(findLocationByName([{ name: 'ห้องครัว' }, { name: 'ห้อง ครัว' }], 'ห้องครัว ')?.name, 'ห้องครัว');
  });

  check('location lock: เรือนไทยภาคกลาง / ห้องครัว / ห้องนั่งเล่น scenes -> exact description + reference line in every clip', () => {
    const S = `ชื่อเรื่อง: บ้านเรา\nตัวละคร\n- พี่ทุย — ผู้ชายใจร้อน\n- น้องน้ำ — ผู้หญิงอารมณ์ดี\n\nฉากที่ 1 — เรือนไทยภาคกลาง / ช่วงเช้า\nพี่ทุยเดินขึ้นบันไดบ้าน น้องน้ำยืนรออยู่ที่ระเบียง\nพี่ทุย: “กลับมาแล้วจ้า”\n\nฉากที่ 2 — ห้องครัว / ช่วงสาย\nน้องน้ำตั้งกระทะบนเตาแก๊ส พี่ทุยหยิบไข่จากชั้นวาง\nน้องน้ำ: “ช่วยตอกไข่หน่อย”\n\nฉากที่ 3 — ห้องนั่งเล่น / ช่วงค่ำ\nทั้งสองนั่งบนโซฟา กินข้าวด้วยกัน\nพี่ทุย: “อร่อยมาก”\n`;
    const clips = build(S, { visualStyle: 'Cinematic Photorealistic 8K', characterNames: ['พี่ทุย', 'น้องน้ำ'] }, locPayloads);
    const expected = ['เรือนไทยภาคกลาง', 'ห้องครัว', 'ห้องนั่งเล่น'];
    assert.equal(clips.length, 3);
    clips.forEach((c, i) => {
      const p = c.generatedPrompt;
      assert.equal(cnt(p, desc(expected[i])), 1, `clip ${i + 1} description byte-for-byte`);
      assert.equal(cnt(p, REF(expected[i])), 1, `clip ${i + 1} reference line`);
      assert.ok(p.includes(`Location: ${expected[i]}. Location Lock (library, verbatim): ${desc(expected[i])}`), p);
      expected.filter((_, j) => j !== i).forEach(o => assert.ok(!p.includes(desc(o)), 'no other set'));
      assert.deepEqual(c.locationWarnings, []);
    });
    // selected library location wins for every clip; idempotent
    const sel = enforceLibraryLocationLocks(clips, locPayloads, { selectedLocationId: 'loc_07' });
    sel.forEach(c => { assert.equal(cnt(c.generatedPrompt, desc('ห้องครัว')), 1); assert.equal(cnt(c.generatedPrompt, 'Location Lock (library, verbatim):'), 1); assert.ok(!c.generatedPrompt.includes(desc('เรือนไทยภาคกลาง'))); });
    const sel2 = enforceLibraryLocationLocks(sel, locPayloads, { selectedLocationId: 'loc_07' });
    sel2.forEach((c, i) => assert.equal(c.generatedPrompt, sel[i].generatedPrompt));
  });

  check('location lock: Gemini invented set ("a red brick house with two oak trees") fully replaced, Atmosphere rebuilt', () => {
    const base = { title: 't', durationSeconds: 10, sceneSummary: 's', startAction: 's', endAction: 'e', dialogues: [], continuityLockSummary: '', audioDirectiveSummary: '', negativePrompt: '' };
    const fake: any[] = [1, 2].map(n => ({ ...base, clipNumber: n, charactersPresent: ['พี่ทุย'], locationName: 'ห้องครัว',
      generatedPrompt: `Cinematic 8K. Location: a red brick house with two oak trees. The garden has a white picket fence. Setting: two oak trees and a red brick chimney. Atmosphere: sunset glow over the red brick house with two oak trees. Character Lock: พี่ทุย (x). Core action: พี่ทุยทำกับข้าว. Background: oak trees swaying.` }));
    const out = enforceLibraryLocationLocks(enforceLibraryCharacterLocks(fake, payloads), locPayloads, { timeOfDay: 'ช่วงสาย', lighting: 'แสงธรรมชาติ', rebuildAtmosphere: true });
    out.forEach(c => {
      const p = c.generatedPrompt;
      assert.ok(!/red brick|oak tree|picket fence/i.test(p), p);
      assert.equal(cnt(p, desc('ห้องครัว')), 1);
      assert.equal(cnt(p, REF('ห้องครัว')), 1);
      assert.ok(p.includes('Atmosphere: ช่วงสาย, แสงธรรมชาติ.'), p);
      assert.equal(cnt(p, 'Character Lock:'), 1);
    });
    // character enforcement after location enforcement keeps the location lock intact (and vice versa)
    const back = enforceLibraryCharacterLocks(out, payloads);
    back.forEach((c, i) => assert.equal(c.generatedPrompt, out[i].generatedPrompt));
  });

  check('location lock: t67 story with library "หน้าบ้าน" = 01 description; warnings for missing card / lost photo', () => {
    const lib = [...locPayloads, toLocationLockPayload({ id: 'loc_front', name: 'หน้าบ้าน', storyProfile: { description: desc('เรือนไทยภาคกลาง') }, referenceImageUrl: '/uploads/locations/01-thai-house-front.jpg', referenceStatus: 'ok' })];
    const clips = build(STORY, lock, lib);
    assert.equal(clips.length, 5);
    assertOnce(clips, 't67+location');
    clips.forEach(c => {
      assert.equal(cnt(c.generatedPrompt, desc('เรือนไทยภาคกลาง')), 1, `clip ${c.clipNumber}`);
      assert.equal(cnt(c.generatedPrompt, REF('หน้าบ้าน')), 1, `clip ${c.clipNumber}`);
      assert.ok(c.generatedPrompt.includes('Stance/Position Lock:'));
    });
    const v = validateSalaMultiClipPrompts(clips, ['พี่ทุย', 'น้องน้ำ']);
    assert.ok(!v.warnings.some(w => w.includes('ไม่พบสถานที่') || w.includes('รูปอ้างอิงของสถานที่')), JSON.stringify(v.warnings));
    // not in the library
    const none = build(STORY, lock, locPayloads);
    assert.ok(validateSalaMultiClipPrompts(none, []).warnings.some(w => w.startsWith('ไม่พบสถานที่ หน้าบ้าน ในคลัง')));
    none.forEach(c => assert.ok(!c.generatedPrompt.includes('Location Lock (library, verbatim)')));
    // lost reference photo: warning + no reference line; compressed backup keeps it
    const lost = build(STORY, lock, [{ ...lib[8], referenceStatus: 'missing' }]);
    assert.ok(validateSalaMultiClipPrompts(lost, []).warnings.some(w => w.startsWith('รูปอ้างอิงของสถานที่ หน้าบ้าน หาย กรุณาอัปโหลดใหม่')));
    lost.forEach(c => { assert.ok(!c.generatedPrompt.includes('reference photo')); assert.equal(cnt(c.generatedPrompt, desc('เรือนไทยภาคกลาง')), 1); });
    const backed = build(STORY, lock, [{ ...lib[8], referenceStatus: 'missing', referenceImageBackup: 'data:image/jpeg;base64,AAAA' }]);
    assert.ok(!validateSalaMultiClipPrompts(backed, []).warnings.some(w => w.includes('รูปอ้างอิงของสถานที่')));
    // no library given at all -> no location warnings (old callers unchanged)
    assert.ok(!validateSalaMultiClipPrompts(build(STORY, lock), []).warnings.some(w => w.includes('สถานที่')));
  });
}

console.log(`\nAll ${passed} checks passed.`);
