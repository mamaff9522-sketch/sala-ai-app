export type ChatTurn = { role: 'user' | 'assistant'; text: string };

export function prepareChatSend(text: string): { ok: true; text: string } | { ok: false; message: string } {
  const clean = text.trim();
  if (!clean) return { ok: false, message: 'พิมพ์ข้อความก่อน' };
  return { ok: true, text: clean };
}

export function readChatReply(body: unknown): string {
  const data = body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data?.candidates?.[0]?.content?.parts?.map(part => part?.text || '').join('').trim() || '';
  if (!text) throw new Error('เอไอยังไม่ตอบ');
  return text;
}

export async function sendAiChat(
  history: ChatTurn[],
  opts: { fetchImpl?: typeof fetch } = {}
): Promise<string> {
  const last = history[history.length - 1];
  const prepared = prepareChatSend(last?.role === 'user' ? last.text : '');
  if (!prepared.ok) throw new Error(prepared.message);
  const fetchImpl = opts.fetchImpl || fetch;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof localStorage !== 'undefined') {
    const token = localStorage.getItem('sala_auth_token') || '';
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetchImpl('/api/ai/chat', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      history: history.map(turn => ({ role: turn.role, text: turn.text }))
    })
  });
  const body = await res.json().catch(() => null) as { text?: string; message?: string } | null;
  if (!res.ok) throw new Error(body?.message || 'แชทเอไอไม่สำเร็จ');
  const text = body?.text?.trim() || '';
  if (!text) throw new Error('เอไอยังไม่ตอบ');
  return text;
}
