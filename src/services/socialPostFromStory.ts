import type { SocialPlatform, SocialPostRecommendation, SocialTone } from '../types';

const PLATFORMS: SocialPlatform[] = ['tiktok', 'reels', 'youtube', 'facebook'];
const TONES: SocialTone[] = ['engaging', 'dramatic', 'funny', 'mysterious', 'punchy', 'hooky'];

function clean(value: string): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function quoteFrom(story: string, max = 90): string {
  const lines = story.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const body = lines.find((line) => !/^ฉาก(?:ที่)?\s*\d+/.test(line) && line.length > 8) || lines[0] || '';
  const quote = clean(body);
  return quote.length > max ? `${quote.slice(0, max).trim()}…` : quote;
}

function locationsFrom(story: string): string[] {
  const found: string[] = [];
  const pattern = /ฉาก(?:ที่)?\s*\d+\s*[:：.]?\s*([^\n]{2,40})/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(story)) && found.length < 3) {
    const place = clean(match[1]).replace(/\s*ช่วง.+$/, '').trim();
    if (place && !found.includes(place)) found.push(place);
  }
  return found;
}

function asTag(word: string): string | null {
  const cleaned = word.replace(/[^\p{L}\p{M}\p{N}]/gu, '');
  if (cleaned.length < 2 || cleaned.length > 30) return null;
  return `#${cleaned}`;
}

type StoryTheme = { id: string; label: string; tags: string[]; words: string[] };

/** Genre comes only from words in the current story. Horror wins over comedy. */
const THEMES: StoryTheme[] = [
  {
    id: 'horror',
    label: 'เรื่องผี',
    tags: ['#เรื่องผี', '#สยองขวัญ', '#หลอน'],
    words: ['ผี', 'สยอง', 'หลอน', 'วิญญาณ', 'ศพ', 'ป่าช้า', 'ปอบ', 'กระสือ', 'เสือสมิง', 'บ้านร้าง'],
  },
  {
    id: 'comedy',
    label: 'เรื่องตลก',
    tags: ['#ตลก', '#ขำ'],
    words: ['ตลก', 'ขำ', 'ฮีฮา', 'มุกตลก'],
  },
  {
    id: 'romance',
    label: 'เรื่องรัก',
    tags: ['#รัก', '#ความรัก'],
    words: ['หึง', 'รัก', 'แฟน', 'จูบ', 'หมดรัก'],
  },
];

function themeOf(story: string): StoryTheme | null {
  const hits = THEMES.map((theme) => ({
    theme,
    score: theme.words.reduce((count, word) => count + (story.includes(word) ? 1 : 0), 0),
  })).filter((item) => item.score > 0);
  const horror = hits.find((item) => item.theme.id === 'horror');
  if (horror) return horror.theme;
  hits.sort((a, b) => b.score - a.score);
  return hits[0]?.theme || null;
}

const LEAD: Record<SocialTone, string> = {
  hooky: 'ดูให้จบ',
  dramatic: 'เรื่องนี้เข้มข้น',
  funny: 'เบาๆ แต่ติดตาม',
  mysterious: 'มีอะไรซ่อนอยู่',
  punchy: 'สั้นๆ แต่ชัด',
  engaging: 'ติดตามเรื่องนี้',
};

/** Post text and hashtags taken only from the current story. No sample plot and no fixed comedy tags. */
export function buildSocialPostsFromStory(
  scriptText: string,
  characterName?: string,
  tone?: string
): SocialPostRecommendation[] {
  const story = String(scriptText || '').trim();
  if (!story) return [];
  const toneId: SocialTone = TONES.includes(tone as SocialTone) ? (tone as SocialTone) : 'hooky';
  const quote = quoteFrom(story);
  const theme = themeOf(story);
  const who = clean(characterName || '');
  const places = locationsFrom(story);
  const tags = theme ? [...theme.tags] : [];
  const nameTag = who ? asTag(who.split(/และ|,|\/|\s+/)[0]) : null;
  if (nameTag && !tags.includes(nameTag)) tags.push(nameTag);
  for (const place of places) {
    const tag = asTag(place.split(/\s+/)[0]);
    if (tag && !tags.includes(tag)) tags.push(tag);
  }
  const where = places[0] ? ` ที่${places[0]}` : '';
  const cast = who ? ` ตัวละคร ${who}` : '';
  const headline = theme ? `${theme.label}: ${quote}` : quote;
  const lead = theme?.id === 'horror' ? 'เรื่องผีเรื่องนี้' : theme?.id === 'comedy' ? 'เรื่องตลก' : LEAD[toneId];
  return PLATFORMS.map((platform) => ({
    platform,
    tone: toneId,
    titles: [headline],
    captions: [`${lead}: ${quote}${cast}${where}`],
    hashtags: tags.slice(0, 6),
  }));
}
