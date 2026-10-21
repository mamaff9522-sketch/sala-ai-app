import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setImageStoreDb, saveUploadToStore, loadUploadFromStore, restoreUpload, storableUploadPath, splitChunks, CHUNK_CHARS } from '../serverImageStore';

let passed = 0;
const check = async (name: string, fn: () => Promise<void> | void) => { await fn(); passed++; console.log(`  ✔ ${name}`); };

// In-memory stand-in for firebase-admin Firestore (collection/doc/set/get, sub-collections)
const memory = new Map<string, any>();
const docRef = (p: string): any => ({
  set: async (data: any) => { memory.set(p, JSON.parse(JSON.stringify(data))); },
  get: async () => ({ exists: memory.has(p), data: () => memory.get(p) }),
  collection: (c: string) => collRef(`${p}/${c}`)
});
const collRef = (p: string): any => ({ doc: (id: string) => docRef(`${p}/${id}`) });
setImageStoreDb(async () => ({ collection: (c: string) => collRef(c) }));

await check('only character / location photos with plain names are stored', () => {
  assert.equal(storableUploadPath('/uploads/characters/ref_a1_17.jpg'), 'characters/ref_a1_17.jpg');
  assert.equal(storableUploadPath('locations/ref_loc_x.png?v=2'), 'locations/ref_loc_x.png');
  assert.equal(storableUploadPath('../etc/passwd'), null);
  assert.equal(storableUploadPath('characters/../../x.jpg'), null);
  assert.equal(storableUploadPath('generated/clip.mp4'), null);
});

await check('a big photo is split under the Firestore document limit and comes back byte for byte', async () => {
  const bytes = Buffer.alloc(1_600_000);
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7919) % 256;
  const b64 = bytes.toString('base64');
  assert.ok(splitChunks(b64).every(c => c.length <= CHUNK_CHARS));
  assert.ok(splitChunks(b64).length > 1);
  assert.equal(await saveUploadToStore('characters/ref_big_1.jpg', b64, 'image/jpeg'), true);
  const back = await loadUploadFromStore('/uploads/characters/ref_big_1.jpg');
  assert.ok(back && back.buffer.equals(bytes));
  assert.equal(back!.mimeType, 'image/jpeg');
});

await check('after the disk is wiped, the photo is written back from the store', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  await saveUploadToStore('characters/ref_nf_2.png', png.toString('base64'), 'image/png');
  const file = await restoreUpload(dir, 'characters/ref_nf_2.png');
  assert.ok(file && fs.readFileSync(file).equals(png));
  assert.equal(await restoreUpload(dir, 'characters/never_uploaded.jpg'), null, 'unknown photo stays missing');
  assert.equal(await restoreUpload(dir, '../outside.jpg'), null);
});

await check('a photo whose chunks were not all written is not served half-made', async () => {
  const b64 = 'A'.repeat(CHUNK_CHARS + 10);
  await saveUploadToStore('characters/ref_half.jpg', b64, 'image/jpeg');
  memory.delete('referenceImages/characters__ref_half.jpg/chunks/0001');
  assert.equal(await loadUploadFromStore('characters/ref_half.jpg'), null);
});

console.log(`\nimage store: ${passed} passed`);
