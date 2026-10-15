import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSalaMultiClipPrompts, validateSalaMultiClipPrompts } from '../src/services/salaDirectorEngine';
import { pickClipReferenceImages } from '../src/services/clipReferenceImages';
import {
  veoDurationSeconds,
  veoSupportsReferenceImages,
  resolveVeoReferenceModel,
  loadVeoReferenceImages,
  DEFAULT_VEO_REFERENCE_MODEL
} from '../serverVeo';

const here = path.dirname(fileURLToPath(import.meta.url));
const STORY = fs.readFileSync(path.join(here, 'fixtures', 't67-story.txt'), 'utf8');
let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✔ ${name}`); };

check('a 4-scene story keeps its ending when 3 clips are requested', () => {
  const clips = buildSalaMultiClipPrompts({ scriptText: STORY, clipDurationSeconds: 8, clipCount: 3, continuityLock: {} });
  const titles = clips.map(c => c.title).join(' | ');
  assert.match(titles, /ฉากที่ 4/);
  const lines = clips.flatMap(c => c.dialogues.map(d => d.line)).join(' ');
  assert.ok(lines.includes('อ้าว สุดท้ายพี่เสียเงินอีกแล้วเหรอ!'), 'last line of the story is in a clip');
  const v = validateSalaMultiClipPrompts(clips, ['พี่ทุย', 'น้องน้ำ'], STORY);
  assert.equal(v.warnings.filter(w => w.startsWith('บทพูดในต้นฉบับไม่ได้อยู่ในคลิป')).length, 0);
});

check('validation warns when a script line is in no clip', () => {
  const clips = buildSalaMultiClipPrompts({ scriptText: STORY, clipDurationSeconds: 8, clipCount: 3, continuityLock: {} });
  const v = validateSalaMultiClipPrompts(clips.slice(0, 2), ['พี่ทุย', 'น้องน้ำ'], STORY);
  assert.ok(v.warnings.some(w => w.includes('อ้าวสุดท้ายพี่เสียเงินอีกแล้วเหรอ')), 'dropped ending is reported');
});

check('clip length snaps to Veo 4 / 6 / 8 seconds', () => {
  assert.equal(veoDurationSeconds(10), 8);
  assert.equal(veoDurationSeconds(15), 8);
  assert.equal(veoDurationSeconds(5), 6);
  assert.equal(veoDurationSeconds(4), 4);
  assert.equal(veoDurationSeconds(3), 4);
  assert.equal(veoDurationSeconds(undefined), 8);
  assert.equal(veoDurationSeconds(4, { resolution: '1080p' }), 8);
  assert.equal(veoDurationSeconds(4, { usesReferenceImages: true }), 8);
});

check('reference photos go to a Veo model that accepts them', () => {
  assert.equal(veoSupportsReferenceImages('veo-3.1-lite-generate-preview'), false);
  assert.equal(veoSupportsReferenceImages('veo-3.1-generate-preview'), true);
  assert.equal(resolveVeoReferenceModel(undefined), DEFAULT_VEO_REFERENCE_MODEL);
  assert.equal(resolveVeoReferenceModel('off'), null);
  assert.equal(resolveVeoReferenceModel('veo-3.1-lite-generate-preview'), null);
});

check('each clip sends the photos of the characters in it, max 3, no remote URLs', () => {
  const lib = [
    { name: 'พี่ทุย', referenceImageUrl: '/uploads/characters/tui.png', referenceStatus: 'ok' },
    { name: 'น้องน้ำ', referenceImageUrl: '/uploads/characters/nam.png', referenceStatus: 'missing', referenceImageBackup: 'data:image/png;base64,AAAA' },
    { name: 'ยาย', referenceImageUrl: 'https://example.com/yai.png' },
    { name: 'ตา', referenceImageUrl: '/uploads/characters/ta.png' }
  ];
  const refs = pickClipReferenceImages({ dialogues: [{ speaker: 'น้องน้ำ' }], generatedPrompt: 'พี่ทุย มองน้องน้ำ' }, lib);
  assert.deepEqual(refs, ['data:image/png;base64,AAAA', '/uploads/characters/tui.png']);
  assert.deepEqual(pickClipReferenceImages({ generatedPrompt: 'ยาย นั่ง' }, lib), []);
  const many = pickClipReferenceImages({ generatedPrompt: 'พี่ทุย น้องน้ำ ตา ยาย' }, lib.concat([{ name: 'ลุง', referenceImageUrl: '/uploads/characters/lung.png' }]));
  assert.equal(many.length, 3);
});

check('server reads only data URLs and files inside uploads', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'veo-up-'));
  fs.mkdirSync(path.join(dir, 'characters'));
  fs.writeFileSync(path.join(dir, 'characters', 'tui.png'), Buffer.from([1, 2, 3]));
  fs.writeFileSync(path.join(path.dirname(dir), 'outside.png'), Buffer.from([9]));
  const imgs = loadVeoReferenceImages([
    '/uploads/characters/tui.png',
    '/uploads/../outside.png',
    'https://example.com/x.png',
    'data:image/jpeg;base64,QUJD',
    '/uploads/characters/missing.png'
  ], dir);
  assert.deepEqual(imgs.map(i => i.mimeType), ['image/png', 'image/jpeg']);
  assert.equal(imgs[0].imageBytes, Buffer.from([1, 2, 3]).toString('base64'));
});

console.log(`\nprompt to Veo: ${passed} passed`);
