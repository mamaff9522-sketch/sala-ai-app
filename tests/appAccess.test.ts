/**
 * Login lock: nothing in the app is usable until a real Firebase user exists.
 * Run: npx tsx tests/appAccess.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deviceGoogleClientId, goBackOnePage, googleLoginMethod, isAppUnlocked } from '../src/services/appAccess';
import { prepareOutlineRequest, readOutlineText, requestScriptOutline } from '../src/services/scriptOutline';
import { messagesIn, postTalk, startTalk } from '../src/services/friendChat';

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ✔ ${name}`);
}

check('logged-out, empty, and demo users stay locked', () => {
  assert.equal(isAppUnlocked(null), false);
  assert.equal(isAppUnlocked(undefined), false);
  assert.equal(isAppUnlocked({}), false);
  assert.equal(isAppUnlocked({ uid: '' }), false);
  assert.equal(isAppUnlocked({ uid: 'demo_creator' }), false);
});

check('a real Firebase uid unlocks the app', () => {
  assert.equal(isAppUnlocked({ uid: 'firebase-uid-1' }), true);
});

check('login is one Google button and asks for no password', () => {
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const start = app.indexOf('if (!isAppUnlocked');
  const gateStart = app.indexOf('return (', start);
  const gateEnd = app.indexOf('\n  return (', gateStart + 8);
  const gate = app.slice(gateStart, gateEnd);
  assert.equal(gate.includes('เข้าสู่ระบบด้วย Google'), true);
  assert.equal(gate.includes('handleLoginGoogle'), true);
  assert.equal(gate.includes('password'), false);
  assert.equal(gate.includes('รหัสผ่าน'), false);
  assert.equal(app.includes('AuthModal'), false);
  assert.equal(app.includes('signInWithEmailAndPassword'), false);
});

check('the phone uses the Google account on the device and never a password page', () => {
  assert.equal(googleLoginMethod(true), 'device');
  assert.equal(googleLoginMethod(false), 'popup');
  assert.equal(deviceGoogleClientId('84189743559-abc.apps.googleusercontent.com').endsWith('.apps.googleusercontent.com'), true);
  assert.throws(() => deviceGoogleClientId(''), /ยังไม่มีรหัสกูเกิล/);
  const authSrc = fs.readFileSync(new URL('../src/services/auth.ts', import.meta.url), 'utf8');
  assert.equal(authSrc.includes('signInWithCredential'), true);
  assert.equal(authSrc.includes('signInWithRedirect'), false);
  assert.equal(authSrc.includes('SalaGoogle'), true);
});

check('the app screen is the login page until unlock, and tabs do nothing before that', () => {
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const gate = app.indexOf('if (!isAppUnlocked(authUser))');
  const home = app.indexOf('<HomeDashboard');
  const nav = app.indexOf('<BottomNav');
  assert.ok(gate > 0, 'missing login gate');
  assert.ok(home > gate && nav > gate, 'home or bottom bar renders before the login gate');
  const tab = app.slice(app.indexOf('const handleTabChange'), app.indexOf('const handleTabChange') + 500);
  assert.match(tab, /if \(!isAppUnlocked\(authUser\)\) return;/);
  const signedOut = app.slice(app.indexOf('เมื่อไม่ได้ล็อกอิน'), app.indexOf('const handleLoginGoogle'));
  assert.doesNotMatch(signedOut, /loadInitialData\(/);
  assert.doesNotMatch(app, /useEffect\(\(\) => \{\n    loadInitialData\(\);\n  \}, \[\]\);/);
});


check('the empty outline heading is gone', () => {
  const nav = fs.readFileSync(new URL('../src/components/BottomNav.tsx', import.meta.url), 'utf8');
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.equal(nav.includes('ขอขอบท'), false);
  assert.equal(app.includes('onAskOutline'), false);
});

check('phone back moves exactly one page and stops when there is no previous page', () => {
  const first = goBackOnePage(['home', 'projects', 'chat']);
  assert.equal(first.page, 'chat');
  assert.deepEqual(first.history, ['home', 'projects']);
  const second = goBackOnePage(first.history);
  assert.equal(second.page, 'projects');
  assert.equal(goBackOnePage([]).page, null);
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const java = fs.readFileSync(new URL('../android/app/src/main/java/com/salaai/app/MainActivity.java', import.meta.url), 'utf8');
  assert.equal(app.includes('salaGoBackOne'), true);
  assert.equal(java.includes('salaGoBackOne'), true);
});

await (async () => {
  assert.equal(prepareOutlineRequest('  ').ok, false);
  assert.equal(prepareOutlineRequest('ผีในป่า').ok, true);
  assert.equal(readOutlineText({ candidates: [{ content: { parts: [{ text: 'ฉาก 1' }] } }] }), 'ฉาก 1');
  await assert.rejects(() => requestScriptOutline('ผีในป่า', { apiKey: '  ', fetchImpl: async () => { throw new Error('should not fetch'); } }), /ยังไม่มีคีย์/);
  const outline = await requestScriptOutline('ผีในป่า', {
    apiKey: 'test-key',
    fetchImpl: async () => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ชื่อเรื่อง: ป่า' }] } }] }) }) as Response
  });
  assert.equal(outline, 'ชื่อเรื่อง: ป่า');
  passed++;
  console.log('  ✔ an empty idea is refused and a reply is read as the outline');
})();

await (async () => {
  const me = { id: 'uid-me', name: 'ฉัน' };
  const friend = { id: 'uid-friend', name: 'เพื่อน' };
  let rooms = startTalk([], me, friend, 'friend');
  rooms = startTalk(rooms, me, { id: 'character:prae', name: 'แพร' }, 'character');
  assert.equal(rooms.length, 2);
  const roomId = rooms[0].id;
  let messages = postTalk([], roomId, me.id, '  ');
  assert.equal(messages.length, 0);
  messages = postTalk(messages, roomId, me.id, 'สวัสดี', 1);
  messages = postTalk(messages, roomId, friend.id, 'ได้ยิน', 2);
  const thread = messagesIn(messages, roomId);
  assert.deepEqual(thread.map((message) => message.text), ['สวัสดี', 'ได้ยิน']);
  assert.equal(thread[1].senderId, friend.id);
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  const chat = fs.readFileSync(new URL('../src/components/ChatRoom.tsx', import.meta.url), 'utf8');
  assert.equal(app.includes('<ChatRoom'), true);
  assert.equal(app.includes('<AiChat'), false);
  assert.equal(chat.includes('คุยกับเพื่อน'), true);
  assert.equal(chat.includes('พิมพ์ข้อความ'), true);
  assert.equal(chat.includes('ขอขอบทละครจากเอไอ'), false);
  passed++;
  console.log('  ✔ a friend message is delivered in the chat room, separate from script outline');
})();

check('the global stylesheet sets a readable base font size', () => {
  const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const html = css.match(/html\s*\{[^}]*font-size:\s*(\d+)px/);
  const body = css.match(/body\s*\{[^}]*font-size:\s*(\d+)px/);
  assert.ok(html && body, 'base font-size missing');
  const size = Number(html[1]);
  assert.equal(Number(body[1]), size);
  assert.ok(size >= 14 && size <= 16);
});

console.log(`appAccess: ${passed} passed`);
