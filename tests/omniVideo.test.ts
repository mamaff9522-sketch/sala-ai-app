import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildOmniRequestBody, extractOmniVideo, generateOmniVideo, extractLastFrame, omniFailureReason, OMNI_ENDPOINT } from '../serverOmni';
import { pickClipReferences } from '../src/services/clipReferenceImages';
import { tokenCountFromUsage } from '../serverBilling';

let passed = 0;
const check = async (name: string, fn: () => void | Promise<void>) => { await fn(); passed++; console.log(`  ✔ ${name}`); };
const img = (b: string) => ({ imageBytes: Buffer.from(b).toString('base64'), mimeType: 'image/jpeg' });

await check('request: start frame is Image1, character photos follow with names, 9:16 and 720p', () => {
  const body = buildOmniRequestBody({ prompt: 'Two friends talk.', firstFrame: img('last'), references: [img('tui'), img('nam')], referenceNames: ['พี่ทุย', 'น้องน้ำ'], aspectRatio: '9:16', resolution: '720p', durationSeconds: 8 });
  assert.equal(body.model, 'gemini-omni-1.1-flash');
  assert.deepEqual(body.input.slice(0, 3).map((p: any) => Buffer.from(p.data, 'base64').toString()), ['last', 'tui', 'nam']);
  const text = body.input[3].text;
  assert.ok(text.startsWith('[# Sources <FIRST_FRAME>@Image1] [# References <IMAGE_REF_0>@Image2 <IMAGE_REF_1>@Image3]'));
  assert.ok(text.includes('<IMAGE_REF_0> = พี่ทุย') && text.includes('<IMAGE_REF_1> = น้องน้ำ'));
  assert.ok(text.includes('starts exactly on <FIRST_FRAME>') && text.includes('Two friends talk.') && text.includes('about 8 seconds'));
  assert.deepEqual(body.response_format, { type: 'video', delivery: 'uri', aspect_ratio: '9:16', resolution: '720p' });
});

await check('request without photos or start frame is plain text-to-video', () => {
  const body = buildOmniRequestBody({ prompt: 'A rice field at dawn.' });
  assert.equal(body.input.length, 1);
  assert.ok(!body.input[0].text.includes('[#'));
});

await check('response: video found in steps[].content[] and failures reported', () => {
  const json = { id: 'v1_abc', status: 'completed', steps: [{ type: 'thought' }, { type: 'model_output', content: [{ type: 'text', text: 'ok' }, { type: 'video', mime_type: 'video/mp4', data: 'AAAA' }] }] };
  assert.deepEqual(extractOmniVideo(json), { data: 'AAAA', uri: undefined, mimeType: 'video/mp4' });
  assert.equal(omniFailureReason(json, 200), '');
  assert.equal(omniFailureReason({ error: { message: 'blocked' } }, 400), 'blocked');
  assert.equal(extractOmniVideo({ steps: [] }), null);
});

await check('generate: inline video bytes', async () => {
  const calls: any[] = [];
  const fake = async (url: string, init: any) => {
    calls.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ id: 'v1', status: 'completed', steps: [{ content: [{ type: 'video', data: Buffer.from('MP4DATA').toString('base64') }] }] }), arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const r = await generateOmniVideo({ prompt: 'x' }, 'KEY', fake as any);
  assert.equal(r.bytes.toString(), 'MP4DATA');
  assert.equal(calls[0].url, OMNI_ENDPOINT);
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'KEY');
});

await check('generate: video delivered as a file uri is downloaded once ACTIVE', async () => {
  let metaCalls = 0;
  const fake = async (url: string) => {
    if (url === OMNI_ENDPOINT) return { ok: true, status: 200, json: async () => ({ status: 'completed', steps: [{ content: [{ type: 'video', uri: 'https://generativelanguage.googleapis.com/v1beta/files/f1' }] }] }), arrayBuffer: async () => new ArrayBuffer(0) };
    if (url.endsWith(':download?alt=media')) return { ok: true, status: 200, json: async () => ({}), arrayBuffer: async () => new TextEncoder().encode('FILEMP4').buffer };
    metaCalls++;
    return { ok: true, status: 200, json: async () => ({ state: 'ACTIVE' }), arrayBuffer: async () => new ArrayBuffer(0) };
  };
  const r = await generateOmniVideo({ prompt: 'x' }, 'KEY', fake as any);
  assert.equal(r.bytes.toString(), 'FILEMP4');
  assert.equal(metaCalls, 1);
});

await check('generate: API error becomes a readable message', async () => {
  const fake = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'Request blocked by safety filters' } }), arrayBuffer: async () => new ArrayBuffer(0) });
  await assert.rejects(() => generateOmniVideo({ prompt: 'x' }, 'KEY', fake as any), /Gemini Omni: Request blocked by safety filters/);
});

let hasFfmpeg = true;
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { hasFfmpeg = false; }
if (hasFfmpeg) {
  await check('last frame of a real MP4 becomes a JPEG start frame', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omni-'));
    const mp4 = path.join(dir, 'clip.mp4');
    // 2 s: red, then the last half second blue
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=64x64:d=1.5', '-f', 'lavfi', '-i', 'color=c=blue:s=64x64:d=0.5', '-filter_complex', '[0][1]concat=n=2:v=1', '-pix_fmt', 'yuv420p', mp4]);
    const frame = await extractLastFrame(mp4);
    assert.ok(frame && frame.mimeType === 'image/jpeg');
    const jpg = path.join(dir, 'f.jpg');
    fs.writeFileSync(jpg, Buffer.from(frame!.imageBytes, 'base64'));
    const rgb = execFileSync('ffmpeg', ['-loglevel', 'error', '-i', jpg, '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
    assert.ok(rgb[2] > 150 && rgb[0] < 100, `last frame is blue (rgb ${[...rgb].join(',')})`);
    assert.equal(await extractLastFrame(path.join(dir, 'missing.mp4')), null);
  });
} else {
  console.log('  - ffmpeg not installed here: last-frame test skipped');
}

await check('clip photos come with the names of who they show', () => {
  const lib = [{ name: 'พี่ทุย', referenceImageUrl: '/uploads/characters/tui.png' }, { name: 'น้องน้ำ', referenceImageUrl: '/uploads/characters/nam.png' }];
  const r = pickClipReferences({ dialogues: [{ speaker: 'น้องน้ำ' }], generatedPrompt: 'พี่ทุย' }, lib);
  assert.deepEqual(r, { urls: ['/uploads/characters/nam.png', '/uploads/characters/tui.png'], names: ['น้องน้ำ', 'พี่ทุย'] });
});

await check('billing reads snake_case token usage', () => {
  assert.equal(tokenCountFromUsage({ total_tokens: 46336 }), 46336);
});

console.log(`\nomni video: ${passed} passed`);
