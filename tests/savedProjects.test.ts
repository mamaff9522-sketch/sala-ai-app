import assert from 'node:assert/strict';
import type { DirectedClipItem, MasterContinuityLock } from '../src/types';
import {
  deleteSavedProject,
  listSavedProjects,
  openSavedProject,
  saveCurrentProject
} from '../src/services/savedProjects';

function installMemoryStorage() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
    removeItem(key: string) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    get length() {
      return store.size;
    }
  };
  (globalThis as { localStorage?: Storage }).localStorage = localStorage as unknown as Storage;
  return localStorage;
}

const memory = installMemoryStorage();

const empty = saveCurrentProject({
  scriptText: '   ',
  originalStory: '',
  continuityLock: null,
  selectedCharacterIds: [],
  clips: [],
  characters: [],
  locations: []
});
assert.equal(empty, null);
assert.equal(listSavedProjects().length, 0);

const clip = {
  clipNumber: 1,
  title: 'ฉากที่ 1',
  durationSeconds: 8,
  sceneSummary: 'พี่ทุยเดินเข้าบ้าน',
  startAction: 'เดิน',
  endAction: 'หยุด',
  dialogues: [],
  continuityLockSummary: '',
  audioDirectiveSummary: '',
  generatedPrompt: 'cinematic prompt',
  negativePrompt: 'blur',
  locationId: 'loc1',
  locationName: 'หน้าบ้าน'
} as DirectedClipItem;

const lock = {
  characterName: 'พี่ทุย',
  location: 'หน้าบ้าน',
  locationId: 'loc1'
} as MasterContinuityLock;

const saved = saveCurrentProject({
  scriptText: 'แค่หึง ไม่ได้หมดรัก\nฉากที่ 1',
  originalStory: 'แค่หึง ไม่ได้หมดรัก',
  continuityLock: lock,
  selectedCharacterIds: ['c1'],
  clips: [clip],
  characters: [
    { id: 'c1', name: 'พี่ทุย' },
    { id: 'c2', name: 'คนอื่น' }
  ],
  locations: [{ id: 'loc1', name: 'หน้าบ้าน' }]
});
assert.ok(saved);
assert.equal(saved!.name, 'แค่หึง ไม่ได้หมดรัก');
assert.equal(saved!.characters.length, 1);
assert.equal(saved!.characters[0].name, 'พี่ทุย');
assert.equal(saved!.locations.some((location) => location.name === 'หน้าบ้าน'), true);
assert.equal(listSavedProjects().length, 1);

const secondClip = { ...clip, clipNumber: 2, generatedPrompt: 'second prompt' } as DirectedClipItem;
const updated = saveCurrentProject({
  scriptText: 'แค่หึง ไม่ได้หมดรัก\nฉากที่ 1\nเพิ่มบท',
  originalStory: 'แค่หึง ไม่ได้หมดรัก',
  continuityLock: lock,
  selectedCharacterIds: ['c1'],
  clips: [clip, secondClip],
  characters: [{ id: 'c1', name: 'พี่ทุย' }],
  locations: [{ id: 'loc1', name: 'หน้าบ้าน' }]
});
assert.ok(updated);
assert.equal(updated!.id, saved!.id);
assert.equal(updated!.name, saved!.name);
assert.equal(updated!.clips.length, 2);
assert.equal(listSavedProjects().length, 1);

const opened = openSavedProject(saved!.id);
assert.ok(opened);
assert.equal(memory.getItem('sala_current_director_script'), updated!.scriptText);
assert.equal(memory.getItem('sala_story'), updated!.originalStory);
assert.equal(memory.getItem('sala_open_project_id'), saved!.id);
const storedLock = JSON.parse(memory.getItem('sala_master_continuity_lock') || '{}');
assert.equal(storedLock.location, 'หน้าบ้าน');
const storedIds = JSON.parse(memory.getItem('sala_selected_character_ids') || '[]');
assert.deepEqual(storedIds, ['c1']);
const storedClips = JSON.parse(memory.getItem('sala_director_clips') || '[]');
assert.equal(storedClips.length, 2);
assert.equal(storedClips[0].generatedPrompt, 'cinematic prompt');
assert.equal(storedClips[0].negativePrompt, 'blur');

memory.removeItem('sala_open_project_id');
const other = saveCurrentProject({
  scriptText: 'เสียงเรียกจากป่า',
  originalStory: 'เสียงเรียกจากป่า',
  continuityLock: { ...lock, location: 'ป่าช้า', locationId: 'loc2' } as MasterContinuityLock,
  selectedCharacterIds: ['c3'],
  clips: [{ ...clip, locationId: 'loc2', locationName: 'ป่าช้า', generatedPrompt: 'forest' } as DirectedClipItem],
  characters: [{ id: 'c3', name: 'ฟ้าใส' }],
  locations: [{ id: 'loc2', name: 'ป่าช้า' }]
});
assert.ok(other);
assert.notEqual(other!.id, saved!.id);
assert.equal(listSavedProjects().length, 2);

assert.equal(deleteSavedProject(other!.id), true);
const remaining = listSavedProjects();
assert.equal(remaining.length, 1);
assert.equal(remaining[0].id, saved!.id);
assert.equal(memory.getItem('sala_open_project_id'), null);
assert.equal(deleteSavedProject('missing-id'), false);
assert.equal(listSavedProjects().length, 1);

console.log('saved projects: ok');
