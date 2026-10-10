import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { prepareChatSend, sendAiChat, type ChatTurn } from '../services/aiChat';

export const AiChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const prepared = prepareChatSend(draft);
    if (!prepared.ok || sending) return;
    const next: ChatTurn[] = [...messages, { role: 'user', text: prepared.text }];
    setMessages(next);
    setDraft('');
    setSending(true);
    try {
      const reply = await sendAiChat(next);
      setMessages(current => [...current, { role: 'assistant', text: reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'แชทเอไอไม่สำเร็จ';
      setMessages(current => [...current, { role: 'assistant', text: message }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-3 pt-4 pb-28 flex flex-col min-h-[70vh]">
      <h1 className="text-[18px] font-bold text-white mb-3">แชทเอไอ</h1>
      <div className="flex-1 space-y-2">
        {messages.length === 0 && (
          <p className="text-[14px] text-slate-400">พิมพ์ได้เลย เช่น ขอขอบทละครสั้นแนวสยองขวัญ</p>
        )}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`max-w-[90%] rounded-2xl px-3 py-2 text-[14px] whitespace-pre-wrap ${
              message.role === 'user' ? 'ml-auto bg-[#1E90FF] text-white' : 'mr-auto bg-[#14182a] text-slate-100'
            }`}
          >
            {message.text}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSend();
          }}
          placeholder="พิมพ์หาเอไอ"
          className="flex-1 rounded-2xl bg-slate-950 border border-slate-700 px-3 py-2 text-[14px] text-white"
        />
        <button type="button" onClick={handleSend} disabled={sending} className="rounded-2xl px-3 bg-[#7B2CFF] text-white disabled:opacity-60" aria-label="ส่ง">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
