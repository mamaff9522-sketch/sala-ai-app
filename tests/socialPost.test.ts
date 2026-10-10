import assert from 'node:assert/strict';
import { buildSocialPostsFromStory } from '../src/services/socialPostFromStory';

const story = `แค่หึง ไม่ได้หมดรัก
ฉากที่ 1 หน้าบ้าน ช่วงเย็น
พี่ทุย: ไปไหนมา ทำไมกลับช้าขนาดนี้?`;

const posts = buildSocialPostsFromStory(story, 'พี่ทุย', 'hooky');
assert.equal(posts.length, 4);
assert.ok(posts[0].titles[0].includes('แค่หึง'));
assert.ok(posts[0].titles[0].includes('เรื่องรัก'));
assert.ok(posts[0].captions[0].includes('แค่หึง'));
assert.ok(posts[0].hashtags.includes('#รัก'));
assert.equal(posts[0].hashtags.some((tag) => /ฮีฮา|ตลก|SalaAI/.test(tag)), false);
assert.ok(posts[0].hashtags.some((tag) => tag.includes('พี่ทุย') || tag.includes('หน้าบ้าน')));
assert.equal(posts.some((post) => /โบราณ|700 ปี|ห้องลับ/.test(post.captions[0] + post.titles[0])), false);

const ghost = `เสียงเรียกจากป่า
ฉากที่ 1 ป่าช้า กลางคืน
ฟ้าใส: ได้ยินเสียงผีเรียกจากในป่า`;
const ghostPosts = buildSocialPostsFromStory(ghost, 'ฟ้าใส', 'funny');
assert.ok(ghostPosts[0].titles[0].startsWith('เรื่องผี'));
assert.ok(ghostPosts[0].titles[0].includes('เสียงเรียกจากป่า'));
assert.ok(ghostPosts[0].hashtags.includes('#เรื่องผี'));
assert.ok(ghostPosts[0].hashtags.includes('#สยองขวัญ'));
assert.equal(ghostPosts[0].hashtags.some((tag) => /ฮีฮา|ตลก|ขำ/.test(tag)), false);
assert.equal(ghostPosts[0].captions[0].includes('ฮีฮา'), false);

assert.equal(buildSocialPostsFromStory('   ').length, 0);
console.log('social posts follow the current story genre: ok');
