import React, { useState } from 'react';
import {
  X,
  Share2,
  Sparkles,
  Copy,
  Check,
  Flame,
  MessageSquare,
  Hash
} from 'lucide-react';
import { SocialPostRecommendation } from '../types';
import { api } from '../services/api';

interface SocialPostAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptText: string;
  characterName: string;
}

export const SocialPostAssistantModal: React.FC<SocialPostAssistantModalProps> = ({
  isOpen,
  onClose,
  scriptText,
  characterName
}) => {
  const [tone, setTone] = useState<string>('hooky');
  const [isLoading, setIsLoading] = useState(false);
  const [posts, setPosts] = useState<SocialPostRecommendation[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const results = await api.generateSocialPosts({
        scriptText,
        characterName,
        tone
      });
      setPosts(results);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#0f1523] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">AI ผู้ช่วยโพสต์โซเชียล (Social Post Assistant)</h3>
              <p className="text-xs text-slate-400">
                เขียนแคปชั่น พาดหัว Hook และแฮชแท็กติดเทรนด์สำหรับ TikTok, Shorts, Reels, FB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tone Selector & Generate Button */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">สไตล์และอารมณ์ของแคปชั่น:</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'hooky', label: '🪝 ดึงดูดหยุดนิ้ว (Hooky)' },
                  { id: 'dramatic', label: '🎭 ดราม่าลุ้นระทึก (Dramatic)' },
                  { id: 'funny', label: '😂 ขำขันเป็นกันเอง (Humor)' },
                  { id: 'mysterious', label: '🔮 น่าค้นหา ซ่อนปม (Mysterious)' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      tone === t.id
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'border-slate-800 text-slate-400 hover:border-slate-700 bg-slate-950'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0 flex items-center gap-2 justify-center"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isLoading ? 'กำลังคิดแคปชั่น...' : 'สร้างแคปชั่นไวรัล'}</span>
            </button>
          </div>
        </div>

        {/* Generated Posts */}
        {posts.length > 0 && (
          <div className="space-y-4 animate-in fade-in">
            {posts.map(p => (
              <div
                key={p.platform}
                className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3.5"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 font-mono">
                    <Flame className="w-4 h-4 text-amber-400" />
                    {p.platform === 'tiktok'
                      ? 'TikTok'
                      : p.platform === 'reels'
                      ? 'Instagram Reels'
                      : p.platform === 'youtube'
                      ? 'YouTube Shorts'
                      : 'Facebook'}
                  </span>
                  <span className="text-[11px] text-indigo-400 font-mono">Tone: {p.tone}</span>
                </div>

                {/* Title */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>พาดหัวปกคลิป / Hook:</span>
                    <button
                      onClick={() => copyText(`${p.platform}_title`, p.titles[0])}
                      className="text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      {copiedKey === `${p.platform}_title` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>คัดลอก</span>
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white">
                    {p.titles[0]}
                  </div>
                </div>

                {/* Caption */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>ข้อความแคปชั่น:</span>
                    <button
                      onClick={() => copyText(`${p.platform}_caption`, p.captions[0])}
                      className="text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      {copiedKey === `${p.platform}_caption` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>คัดลอก</span>
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed">
                    {p.captions[0]}
                  </div>
                </div>

                {/* Hashtags */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>แฮชแท็ก:</span>
                    <button
                      onClick={() => copyText(`${p.platform}_hash`, p.hashtags.join(' '))}
                      className="text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      {copiedKey === `${p.platform}_hash` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>คัดลอก</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {p.hashtags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-mono"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
