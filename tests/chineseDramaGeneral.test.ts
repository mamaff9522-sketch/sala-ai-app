/** Chinese drama rules on many kinds of scripts (not only shots 16-18). */
import assert from 'node:assert/strict';
import { chineseDramaShots, AUDIO_SPEECH, AUDIO_SILENT, CHINESE_DRAMA_OPENING, NO_ONE_SPEAKS, romanizeThaiName } from '../src/services/metaAiPrompt';

let passed = 0;
const check = (name: string, fn: () => void) => { fn(); passed++; console.log(`  ✔ ${name}`); };
const thaiOutsideQuotes = (p: string) => /[ก-๙]/.test(p.replace(/"[^"]*"/g, ''));
const cams = (p: string) => (p.match(/static camera|slow push-in/gi) || []).length;
/** rules every angle of every script must keep */
function general(shots: ReturnType<typeof chineseDramaShots>, photoOk: (shot: number, prompt: string) => void = () => {}) {
  for (const s of shots) for (const a of s.angles) {
    assert.ok(a.prompt.startsWith(CHINESE_DRAMA_OPENING));
    const speaks = a.prompt.includes('speaks Thai exactly');
    assert.ok(a.prompt.endsWith(speaks ? AUDIO_SPEECH : AUDIO_SILENT), a.prompt);
    assert.equal(cams(a.prompt), 1, a.prompt);
    if (speaks) assert.ok(/static camera/.test(a.prompt)); else if (/Reaction|Point-of-view/.test(a.prompt)) assert.ok(/slow push-in/.test(a.prompt));
    assert.ok(!thaiOutsideQuotes(a.prompt), a.prompt);
    assert.ok(!/attach .*profile photo|the people or scene/.test(a.prompt));
    // only on-screen characters are locked
    const locked = Array.from(a.prompt.matchAll(/photo \d+ is the face reference for ([A-Z][a-z]+)/g)).map(m => m[1]);
    for (const n of locked) assert.ok(a.onScreen.map(x => romanizeThaiName(x)).includes(n) || a.onScreen.some(x => TR[x] === n), `${n} locked but not on screen: ${a.prompt}`);
    photoOk(s.shotNumber, a.prompt);
  }
}
const at = (loc: string) => ({ locationName: loc, timeOfDay: 'กลางคืน', durationSeconds: 10 });
const TR: Record<string, string> = {}; // names romanized offline; actions translated below
const act = (th: string, en: string) => { TR[th] = en; return `Core action: ${th}.`; };
TR['ห้องรับแขก'] = 'living room'; TR['ลานวัด'] = 'temple courtyard'; TR['ค่ายทหาร'] = 'army camp'; TR['ทุ่งนา'] = 'rice field';

check('3-person dialogue (several speakers in turn): 2 angles per line + 1 group OTS, listener = next speaker', () => {
  const clips: any[] = [{ clipNumber: 1, ...at('ห้องรับแขก'), charactersPresent: ['สมชาย', 'มาลี', 'ป้าแดง'],
    generatedPrompt: act('สมชาย มาลี และป้าแดงนั่งคุยกันที่โต๊ะ', 'Somchai, Mali and Aunt Daeng sit talking at the table'),
    dialogues: [{ speaker: 'สมชาย', line: 'ใครเอาเงินไป' }, { speaker: 'มาลี', line: 'ไม่ใช่ฉันนะ' }, { speaker: 'ป้าแดง', line: 'พอได้แล้ว' }] }];
  const o: any = { knownCharacters: ['สมชาย', 'มาลี', 'ป้าแดง'], withPhoto: ['สมชาย', 'มาลี', 'ป้าแดง'] };
  const [s] = chineseDramaShots(clips, o, TR);
  assert.equal(s.angles.length, 7);
  assert.ok(s.angles[1].prompt.includes('Reaction shot of Mali'));
  assert.ok(s.angles[3].prompt.includes('Reaction shot of Padaeng'));
  assert.ok(s.angles[6].label.startsWith('Over-the-shoulder') && s.angles[6].onScreen.length === 3);
  general([s]);
});
check('fight / argument: 5 angles (CU, OTS, low, high, object)', () => {
  const clips: any[] = [{ clipNumber: 5, ...at('ลานวัด'), charactersPresent: ['ต้น', 'กฤต'],
    generatedPrompt: act('ต้นกับกฤตทะเลาะกันแล้วต่อยกัน', 'Ton and Krit argue, then start a fist fight'),
    dialogues: [{ speaker: 'กฤต', line: 'แกโกหก!' }, { speaker: 'ต้น', line: 'ฉันพูดจริง!' }] }];
  const [s] = chineseDramaShots(clips, { knownCharacters: ['ต้น', 'กฤต'], withPhoto: ['ต้น'] } as any, TR);
  assert.equal(s.kind, 'conflict');
  assert.deepEqual(s.angles.map(a => a.label), ['Close-up', 'Over-the-shoulder', 'Low angle (hero)', 'High angle (weaker side)', 'Object close-up']);
  assert.ok(s.angles[4].onScreen.length === 0 && !s.angles[4].prompt.includes('Character lock'));
  general([s]);
});
check('soldiers surround Ton (3+ people, conflict): 5 angles, Ton keeps his photo', () => {
  const clips: any[] = [{ clipNumber: 20, ...at('ค่ายทหาร'), charactersPresent: ['ต้น', 'ทหารหนึ่ง', 'ทหารสอง'],
    generatedPrompt: act('ทหารสามคนล้อมต้นไว้ ชี้ดาบใส่', 'Soldiers surround Ton and point swords at him'),
    dialogues: [{ speaker: 'ทหารหนึ่ง', line: 'จับมันไว้! อย่าให้หนี!' }] }];
  const o: any = { knownCharacters: ['ต้น', 'ทหารหนึ่ง', 'ทหารสอง'], withPhoto: ['ต้น'] };
  TR['ทหารหนึ่ง'] = 'First soldier'; TR['ทหารสอง'] = 'Second soldier';
  const [s] = chineseDramaShots(clips, o, TR);
  assert.equal(s.kind, 'conflict'); assert.equal(s.angles.length, 5);
  assert.ok(s.angles[0].prompt.includes('First soldier speaks Thai exactly: "จับมันไว้! อย่าให้หนี!"'));
  general([s]);
});
check('listener borrowed from 2 shots back in the same scene; a scene change stops it', () => {
  const clips: any[] = [
    { clipNumber: 1, ...at('ทุ่งนา'), charactersPresent: ['ต้น'], generatedPrompt: act('ต้นนั่งพักใต้ต้นไม้', 'Ton rests under a tree'), dialogues: [] },
    { clipNumber: 2, ...at('ทุ่งนา'), charactersPresent: [], generatedPrompt: act('ลมพัดรวงข้าวไหว', 'Wind sways the rice plants'), dialogues: [] },
    { clipNumber: 3, ...at('ทุ่งนา'), charactersPresent: ['ชาวนา'], generatedPrompt: act('ชาวนาเดินมาตะโกน', 'A farmer walks in and shouts'), dialogues: [{ speaker: 'ชาวนา', line: 'ฝนจะตกแล้ว!' }] },
    { clipNumber: 4, ...at('ลานวัด'), charactersPresent: ['ชาวนา'], generatedPrompt: act('ชาวนาวิ่งเข้าวัด', 'The farmer runs into the temple'), dialogues: [{ speaker: 'ชาวนา', line: 'หลวงพ่อครับ!' }] }
  ];
  TR['ชาวนา'] = 'Farmer';
  const shots = chineseDramaShots(clips, { knownCharacters: ['ต้น'], withPhoto: ['ต้น'] } as any, TR);
  const b3 = shots[2].angles[1];
  assert.deepEqual(b3.onScreen, ['ต้น']);
  assert.ok(/photo \d+ is the face reference for Ton/.test(b3.prompt) && b3.prompt.includes('Ton rests under a tree'), b3.prompt);
  assert.ok(shots[2].notes.some(n => n.startsWith('แนบรูปเพิ่ม') && n.includes('ต้น')));
  const b4 = shots[3].angles[1];
  assert.deepEqual(b4.onScreen, []); // new place: Ton is not carried over
  assert.ok(b4.prompt.includes('Point-of-view shot') && b4.prompt.includes('Farmer is not in the frame'));
  general(shots);
});
check('shot with no characters: one establishing angle, no character lock, silent', () => {
  const clips: any[] = [{ clipNumber: 9, ...at('ทุ่งนา'), charactersPresent: [], generatedPrompt: act('พระอาทิตย์ตกหลังทุ่งนา', 'The sun sets behind the rice field'), dialogues: [] }];
  const [s] = chineseDramaShots(clips, { knownCharacters: ['ต้น'], withPhoto: ['ต้น'] } as any, TR);
  assert.equal(s.angles.length, 1);
  assert.ok(s.angles[0].prompt.includes('Wide establishing shot') && !s.angles[0].prompt.includes('Character lock') && s.angles[0].prompt.endsWith(AUDIO_SILENT));
  general([s]);
});
check('character with no photo: no photo number, romanized name, still locked by look', () => {
  const clips: any[] = [{ clipNumber: 2, ...at('ห้องรับแขก'), charactersPresent: ['สมชาย', 'มาลี'],
    generatedPrompt: act('สมชายยื่นจดหมายให้มาลี', 'Somchai hands Mali a letter'), dialogues: [{ speaker: 'สมชาย', line: 'อ่านสิ' }] }];
  const [s] = chineseDramaShots(clips, { knownCharacters: ['สมชาย', 'มาลี'], withPhoto: ['สมชาย'], characterNotes: { 'มาลี': 'หญิงสาว' } } as any, { ...TR, 'หญิงสาว': 'young woman' });
  assert.ok(s.angles[1].prompt.includes('Mali (no reference photo), look: young woman'));
  assert.ok(/photo \d+ is the face reference for Somchai/.test(s.angles[0].prompt));
  assert.ok(s.angles[1].prompt.includes(NO_ONE_SPEAKS) && !s.angles[1].prompt.includes('speaks Thai'));
  general([s]);
});
check('offline romanizer gives Latin names', () => {
  for (const n of ['ต้น', 'สมชาย', 'มาลี', 'ชาวบ้านชาย', 'น้องน้ำ']) assert.ok(/^[A-Z][a-z]+$/.test(romanizeThaiName(n)), n);
  assert.equal(romanizeThaiName('ต้น'), 'Ton');
});
console.log(`chineseDramaGeneral: ${passed} passed`);
