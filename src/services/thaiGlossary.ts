/**
 * Offline Thai -> English fallback for short script actions, looks and places (used only when the
 * server's AI translation is not available). Longest-phrase match over a small glossary of common
 * story words; names come from the caller. Returns null when a part is not covered, so the caller
 * keeps the Thai text and reports it, instead of writing half-English.
 */
const G: Record<string, string> = {
  'ยุคสงครามโบราณสมมติ': 'in a fictional ancient war era',
  // places / nature
  'ป่าชายแดน': 'the border forest', 'ป่าลึก': 'deep forest', 'ป่า': 'the forest', 'ชายแดน': 'border', 'อาณาจักร': 'of the kingdom of', 'ยุคสงครามโบราณ': 'in an ancient war era', 'ยุคโบราณ': 'in ancient times',
  'สงคราม': 'war', 'โบราณ': 'ancient', 'สมมติ': '(fictional)', 'หมู่บ้าน': 'village', 'วัด': 'temple', 'ทุ่งนา': 'rice field', 'แม่น้ำ': 'river', 'ลำธาร': 'stream', 'ภูเขา': 'mountain',
  'ต้นไม้ใหญ่': 'big trees', 'ต้นไม้': 'a tree', 'ชุดเดิม': 'same outfits', 'โทรศัพท์เครื่องเดิม': 'same phone', 'ป่าเดิม': 'same forest', 'ฉากเดิม': 'same set', 'หน้าตาและชุดเดิม': 'keep the same faces and costumes', 'เช้าตรู่': 'early morning', 'กลองศึก': 'war drums', 'ฝีเท้า': 'footsteps', 'หลายคน': 'many', 'ดังมาแต่ไกล': 'from far away', 'แต่ไกล': 'from far away', 'หมอกบาง': 'thin mist', 'หมอก': 'mist', 'ทางดิน': 'dirt path', 'รอยล้อเกวียน': 'cart-wheel tracks', 'แสงแดดลอดใบไม้': 'sunlight through the leaves',
  'แสงแดด': 'sunlight', 'ใบไม้': 'leaves', 'หลังฝนตก': 'after rain', 'ฝนตก': 'rain falls', 'พื้น': 'the ground', 'บนพื้น': 'on the ground', 'บนทางดิน': 'on the dirt path', 'ถนน': 'road', 'กำแพง': 'wall',
  // people / looks
  'ชายไทย': 'Thai man', 'หญิงไทย': 'Thai woman', 'อายุ': 'age', 'ชุด': 'outfit', 'เสื้อยืดสีกรมท่า': 'navy t-shirt', 'กางเกงยีนส์สีเข้ม': 'dark jeans', 'ชุดผ้าฝ้าย': 'cotton clothes',
  'ชาวบ้านโบราณ': 'ancient villagers', 'ชาวบ้าน': 'villagers', 'ชายแก่ชาวบ้าน': 'old village man', 'ชายแก่': 'old man', 'ทหาร': 'soldiers', 'นาย': '', 'ถือดาบและหอก': 'holding swords and spears',
  'ทุกคน': 'everyone is', 'เขา': 'he', 'เธอ': 'she', 'พวกเขา': 'they',
  // objects
  'โทรศัพท์มือถือ': 'mobile phone', 'โทรศัพท์': 'phone', 'มือถือ': 'mobile phone', 'แบตเหลือ': 'battery at', 'หน้าจอ': 'the screen', 'ปุ่ม': 'the button of', 'กระเป๋า': 'bag', 'เสื้อ': 'shirt', 'ดาบ': 'sword', 'หอก': 'spear',
  'ปุ่มโทรศัพท์': "the phone's button", 'เจอโทรศัพท์มือถือ': 'finds the mobile phone', 'มือ': 'hands', 'มือทั้งสองข้าง': 'both hands', 'หัว': 'head', 'เกวียน': 'cart',
  // verbs / phrases
  'นอนหมดสติอยู่': 'lies unconscious', 'หมดสติ': 'unconscious', 'ฟื้นขึ้นมา': 'wakes up', 'จับหัว': 'holds his head', 'ลุกขึ้น': 'gets up', 'เดินสำรวจ': 'and explores', 'ไม่เห็น': 'sees no', 'หรือ': 'or',
  'หยิบ': 'takes out his', 'ขึ้นมา': '', 'เจอ': 'finds', 'รีบหลบหลัง': 'quickly hides behind', 'หลบหลัง': 'hides behind', 'วิ่งหนีผ่าน': 'flee through', 'วิ่งหนี': 'flee', 'วิ่งผ่าน': 'run past',
  'เดินออกมาจากหลัง': 'steps out from behind', 'เดินออกจากหลัง': 'steps out from behind', 'หยุดแล้วมอง': 'stops and looks at', 'หยุด': 'stops', 'มอง': 'looks at', 'แล้ว': 'and',
  'วิ่งเข้ามาล้อม': 'run in and surround', 'ล้อม': 'surround', 'ยก': 'raises', 'ชี้ดาบไปที่': 'points a sword at', 'ชี้': 'points at', 'ไปที่': 'at', 'ค้น': 'searches', 'กด': 'presses',
  'สว่างขึ้น': 'lights up', 'ตกใจ': 'shocked', 'มัดมือ': 'tie the hands of', 'ไว้': '', 'ยิ้ม': 'smiles', 'ไหว้': 'gives a wai', 'เดิน': 'walks', 'วิ่ง': 'runs', 'นั่ง': 'sits', 'ยืน': 'stands',
  'เห็น': 'sees', 'ร้องไห้': 'cries', 'กอด': 'hugs', 'พูด': 'says', 'ตะโกน': 'shouts', 'ที่': 'at', 'บน': 'on', 'ใน': 'in', 'กับ': 'and', 'และ': 'and', 'อยู่': '', 'ค่อยๆ': 'slowly'
};
const KEYS = Object.keys(G).sort((a, b) => b.length - a.length);

export function glossaryTranslate(th: string, names: Record<string, string> = {}): string | null {
  const text = String(th || '').trim();
  if (!text) return '';
  const nameKeys = Object.keys(names).sort((a, b) => b.length - a.length);
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (!/[ก-๙]/.test(ch)) {
      const m = text.slice(i).match(/^[^ก-๙]+/)![0];
      const t = m.replace(/\s+/g, ' ');
      if (t.trim()) out.push(t.trim()); else if (out.length && !/,$/.test(out[out.length - 1])) out.push(',');
      i += m.length; continue;
    }
    const n = nameKeys.find(k => text.startsWith(k, i));
    const g = KEYS.find(k => text.startsWith(k, i));
    const pick = n && (!g || n.length >= g.length) ? n : g;
    // "<thing>ของ<name>" -> "<name>'s <thing>"
    if (!pick && text.startsWith('ของ', i)) {
      const rest = text.slice(i + 3);
      const who = nameKeys.find(k => rest.startsWith(k));
      if (who && out.length) { const thing = out.pop()!; out.push(`${names[who]}'s ${thing.replace(/^the /, '')}`); i += 3 + who.length; continue; }
      i += 3; continue;
    }
    if (!pick) return null;
    const en = pick === n ? names[n!] : G[pick];
    if (en) out.push(en);
    i += pick.length;
  }
  return out.join(' ').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').replace(/\s+'s/g, "'s").replace(/\s+/g, ' ').trim();
}
