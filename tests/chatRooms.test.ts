import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  EVERYONE_ROOM_ID,
  EVERYONE_ROOM_TITLE,
  MAX_CHAT_MEMBERS,
  MAX_CHAT_MESSAGE,
  directRoomId,
  memberIdsForRoom,
  orderedChatRooms,
  parseMemberIds,
  roomKind,
  roomTitle,
  senderLabel
} from '../src/services/chatRoomMembers';

const members = memberIdsForRoom('uid-me', [' uid-other ', 'uid-me', '', 'uid-other']);
assert.deepEqual(members, ['uid-me', 'uid-other']);
assert.deepEqual(memberIdsForRoom('uid-me', []), ['uid-me']);
assert.equal(memberIdsForRoom('', ['x']).includes(''), false);

const fortyNine = Array.from({ length: 49 }, (_, index) => `user-${index}`);
assert.equal(memberIdsForRoom('me', fortyNine).length, MAX_CHAT_MEMBERS);
assert.throws(() => memberIdsForRoom('me', [...fortyNine, 'extra']), /50/);

assert.deepEqual(parseMemberIds(' a, b\nc  a ;b'), ['a', 'b', 'c']);
assert.equal(directRoomId('uid-b', 'uid-a'), 'dm-uid-a-uid-b');
assert.equal(directRoomId('uid-a', 'uid-b'), directRoomId('uid-b', 'uid-a'));
assert.throws(() => directRoomId('uid-a', 'uid-a'));

assert.equal(EVERYONE_ROOM_ID, 'sala-everyone');
assert.equal(EVERYONE_ROOM_TITLE, 'ห้องรวม');
assert.equal(MAX_CHAT_MESSAGE, 4000);

assert.equal(senderLabel('uid-x', {}), 'uid-x');
assert.equal(senderLabel('uid-x', { 'uid-x': 'นาม' }), 'นาม');
assert.equal(senderLabel('uid-x', { 'uid-x': '  ' }), 'uid-x');

assert.equal(roomTitle({ id: EVERYONE_ROOM_ID, name: 'x', memberIds: [] }, 'me'), 'ห้องรวม');
assert.equal(
  roomTitle({ id: 'g', name: 'แก๊ง', memberIds: ['a', 'b', 'c'], kind: 'group' }, 'a'),
  'แก๊ง'
);
assert.equal(
  roomTitle({ id: 'd', name: 'stored', memberIds: ['me', 'friend'], kind: 'direct', createdBy: 'me' }, 'me', { friend: 'สมชาย' }),
  'สมชาย'
);
assert.equal(
  roomTitle({ id: 'd', name: 'stored', memberIds: ['me', 'friend'], kind: 'direct', createdBy: 'me' }, 'me'),
  'stored'
);
assert.equal(
  roomTitle({ id: 'd', name: '', memberIds: ['me', 'friend'], kind: 'direct', createdBy: 'other' }, 'me'),
  'friend'
);

const ordered = orderedChatRooms([
  { id: 'd2', name: 'zeta', memberIds: ['a', 'b'], kind: 'direct', createdBy: 'a' },
  { id: 'g2', name: 'beta', memberIds: ['a', 'b', 'c'], kind: 'group' },
  { id: 'd1', name: 'alpha', memberIds: ['a', 'b'], kind: 'direct', createdBy: 'a' },
  { id: 'g1', name: 'gamma', memberIds: ['a', 'b'], kind: 'group' },
  { id: EVERYONE_ROOM_ID, name: 'other', memberIds: ['a'], kind: 'direct' }
], 'a');
assert.deepEqual(ordered.map((room) => room.id), [EVERYONE_ROOM_ID, 'g2', 'g1', 'd1', 'd2']);
assert.equal(ordered[0].name, EVERYONE_ROOM_TITLE);
assert.equal(roomKind(ordered[0]), 'everyone');

const legacy = orderedChatRooms([
  { id: 'legacy', name: 'old', memberIds: ['a', 'b', 'c'] },
  { id: 'pair', name: 'pair', memberIds: ['a', 'b'] }
]);
assert.equal(legacy[1].id, 'legacy');
assert.equal(roomKind(legacy[1]), 'group');
assert.equal(legacy[2].id, 'pair');
assert.equal(roomKind(legacy[2]), 'direct');

const rules = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const chatStart = rules.indexOf('match /chatRooms/{roomId}');
const chatEnd = rules.indexOf('match /config/admins');
assert.ok(chatStart > 0 && chatEnd > chatStart);
const chat = rules.slice(chatStart, chatEnd);
assert.equal(chat.includes("roomId == 'sala-everyone'"), true);
assert.equal(chat.includes('allow list: if signedMember(resource.data);'), true);
assert.equal(chat.includes('request.auth.uid in data.memberIds'), true);
assert.equal(chat.includes('memberIds.size() <= 50'), true);
assert.equal(chat.includes('allow update, delete: if false'), true);
assert.equal(chat.includes('request.resource.data.senderId == request.auth.uid'), true);
assert.equal(chat.includes("hasOnly(['senderId', 'text', 'createdAt'])"), true);
assert.equal(/allow read:\s*if isSignedIn\(\)/.test(chat), false);
assert.equal(chat.includes('allow read, write: if true'), false);

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const view = fs.readFileSync(new URL('../src/components/ChatRoom.tsx', import.meta.url), 'utf8');
assert.equal(app.includes('people={characters.map'), false);
assert.equal(view.includes('ตัวละคร'), false);
assert.equal(view.includes('เพิ่มเพื่อน'), true);
assert.equal(view.includes('สร้างกลุ่ม'), true);
assert.equal(view.includes('กลับ'), true);
assert.equal(view.includes('พิมพ์ข้อความ'), true);
assert.equal(view.includes('คุยกับเพื่อน'), true);
assert.equal(view.includes('EVERYONE_ROOM_ID'), true);
assert.equal(view.includes('EVERYONE_ROOM_TITLE'), true);

console.log('chat room member ids: ok');
