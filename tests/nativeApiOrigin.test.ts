/**
 * Native app prefixes /api with Cloud Run. The website keeps relative URLs.
 * Run: npx tsx tests/nativeApiOrigin.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CLOUD_RUN_API_ORIGIN, prefixApiUrl } from '../src/services/nativeApiOrigin';

const ORIGIN = CLOUD_RUN_API_ORIGIN;
let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✔ ${name}`);
}

check('browser keeps relative /api URLs', () => {
  assert.equal(prefixApiUrl('/api/director/generate-multi-clip-prompts', false), '/api/director/generate-multi-clip-prompts');
  assert.equal(prefixApiUrl('/api/video-to-script/analyze', false), '/api/video-to-script/analyze');
  assert.equal(prefixApiUrl('/api/video-stream/job_1', false), '/api/video-stream/job_1');
  assert.equal(prefixApiUrl('/api/stripe/verify-session?sessionId=abc', false), '/api/stripe/verify-session?sessionId=abc');
});

check('native prefixes relative /api calls, including query strings', () => {
  assert.equal(
    prefixApiUrl('/api/director/generate-multi-clip-prompts', true),
    ORIGIN + '/api/director/generate-multi-clip-prompts'
  );
  assert.equal(
    prefixApiUrl('/api/video-to-script/analyze', true),
    ORIGIN + '/api/video-to-script/analyze'
  );
  assert.equal(
    prefixApiUrl('/api/stripe/verify-session?sessionId=abc', true),
    ORIGIN + '/api/stripe/verify-session?sessionId=abc'
  );
});

check('native rewrites only same-document absolute /api URLs', () => {
  assert.equal(
    prefixApiUrl('https://localhost/api/jobs/job_1', true, 'https://localhost'),
    ORIGIN + '/api/jobs/job_1'
  );
  assert.equal(
    prefixApiUrl('https://localhost/api/download/video/job_1?x=1', true, 'https://localhost'),
    ORIGIN + '/api/download/video/job_1?x=1'
  );
  assert.equal(
    prefixApiUrl(ORIGIN + '/api/providers', true, 'https://localhost'),
    ORIGIN + '/api/providers'
  );
  assert.equal(
    prefixApiUrl('https://firebase.googleapis.com/v1/accounts', true, 'https://localhost'),
    'https://firebase.googleapis.com/v1/accounts'
  );
});

check('native does not rewrite the bundled page, bundled uploads, or data URLs', () => {
  assert.equal(prefixApiUrl('/', true), '/');
  assert.equal(prefixApiUrl('/index.html', true), '/index.html');
  assert.equal(prefixApiUrl('/uploads/characters/ref_prae_master.jpg', true), '/uploads/characters/ref_prae_master.jpg');
  assert.equal(prefixApiUrl('data:image/png;base64,abc', true), 'data:image/png;base64,abc');
});

check('native loads uploaded photos from the server (they are not in the app)', () => {
  const up = '/uploads/characters/ref_abc123_1700000000000.jpg';
  assert.equal(prefixApiUrl(up, true), CLOUD_RUN_API_ORIGIN + up);
  assert.equal(prefixApiUrl(up, false), up, 'the website keeps relative URLs');
  assert.equal(prefixApiUrl('https://localhost' + up, true, 'https://localhost'), CLOUD_RUN_API_ORIGIN + up);
});

check('capacitor server.url is not set and webDir/androidScheme stay put', () => {
  const config = fs.readFileSync(new URL('../capacitor.config.ts', import.meta.url), 'utf8');
  assert.equal(config.includes('server.url'), false);
  assert.equal(config.includes('url:'), false);
  assert.equal(config.includes("webDir: 'dist'"), true);
  assert.equal(config.includes("androidScheme: 'https'"), true);
  const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.equal(server.includes("const CAPACITOR_WEBVIEW_ORIGIN = 'https://localhost'"), true);
  assert.equal(server.includes('GEMINI_API_KEY'), true);
  const client = fs.readFileSync(new URL('../src/services/nativeApiOrigin.ts', import.meta.url), 'utf8');
  assert.equal(client.includes('GEMINI_API_KEY'), true);
  assert.equal(client.includes('process.env.GEMINI'), false);
  assert.equal(client.includes('import.meta.env.GEMINI'), false);
});

console.log(`\n${passed} checks passed`);
