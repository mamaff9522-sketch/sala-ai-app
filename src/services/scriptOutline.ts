/** Plus button: ask for a script outline. Does not open the project page. */

export function prepareOutlineRequest(idea: string): { ok: true; idea: string } | { ok: false; message: string } {
  const clean = idea.trim();
  if (!clean) return { ok: false, message: 'พิมพ์ไอเดียสั้นๆ ก่อน แล้วค่อยขอขอบท' };
  return { ok: true, idea: clean };
}

export function outlinePrompt(idea: string): string {
  return [
    'เขียนขอบทละครภาษาไทยจากไอเดียด้านล่างเท่านั้น',
    'ให้มีชื่อเรื่อง ตัวละคร และฉากสั้น 3 ถึง 5 ฉาก',
    'ห้ามเขียนพรอมป์ต์ภาพ ห้ามเขียนโค้ด',
    '',
    'ไอเดีย:',
    idea.trim()
  ].join('\n');
}

export function readOutlineText(body: unknown): string {
  const data = body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('').trim() || '';
  if (!text) throw new Error('เอไอยังไม่ส่งขอบทกลับมา');
  return text;
}

export async function requestScriptOutline(
  idea: string,
  opts: { apiKey: string; fetchImpl?: typeof fetch }
): Promise<string> {
  const prepared = prepareOutlineRequest(idea);
  if (!prepared.ok) throw new Error(prepared.message);
  const apiKey = opts.apiKey.trim();
  if (!apiKey) throw new Error('บัญชีนี้ยังไม่มีคีย์ Gemini จึงขอขอบทจากเอไอไม่ได้');
  const fetchImpl = opts.fetchImpl || fetch;
  const res = await fetchImpl(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: outlinePrompt(prepared.idea) }] }] })
    }
  );
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = (body as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(message || 'ขอขอบทจากเอไอไม่สำเร็จ');
  }
  return readOutlineText(body);
}
