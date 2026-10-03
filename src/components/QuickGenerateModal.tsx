import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Image as ImageIcon,
  Video,
  Wand2,
  Clock,
  Layers,
  CheckCircle2,
  Loader2,
  Coins
} from 'lucide-react';
import { Character, LocationItem, AspectRatio, MediaType } from '../types';

interface QuickGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'image' | 'video';
  characters: Character[];
  locations: LocationItem[];
  onGenerate: (params: {
    prompt: string;
    type: MediaType;
    aspectRatio: AspectRatio;
    characterId?: string;
    locationId?: string;
    durationSeconds?: number;
  }) => Promise<void>;
}

export const QuickGenerateModal: React.FC<QuickGenerateModalProps> = ({
  isOpen,
  onClose,
  type,
  characters,
  locations,
  onGenerate
}) => {
  const [prompt, setPrompt] = useState(
    type === 'image'
      ? 'ภาพยนตร์ไซไฟ ล้ำยุค แสงไฟนีออนสะท้อนถนนเปียกฝน สไตล์กรุงเทพฯ อนาคต คมชัดระดับ 4K Ultra HD'
      : 'มุมกล้องเคลื่อนผ่านสะพานข้ามแม่น้ำยามค่ำคืน แสงนีออนสะท้อนผิวน้ำ มีโดรนบินผ่านอย่างลื่นไหล 60fps'
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [selectedCharId, setSelectedCharId] = useState<string>('');
  const [selectedLocId, setSelectedLocId] = useState<string>('');
  const [duration, setDuration] = useState<number>(5);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      await onGenerate({
        prompt: prompt.trim(),
        type,
        aspectRatio,
        characterId: selectedCharId || undefined,
        locationId: selectedLocId || undefined,
        durationSeconds: type === 'video' ? duration : undefined
      });
      onClose();
    } catch (err) {
      console.error('Quick generate failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const cost = type === 'video' ? 15 : 2;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div
        className="w-full max-w-lg bg-[#0e0d1f] border border-purple-500/40 rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(168,85,247,0.25)] space-y-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow corner decorations */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
                type === 'video'
                  ? 'bg-gradient-to-tr from-amber-500 to-rose-600 text-white shadow-amber-500/30'
                  : 'bg-gradient-to-tr from-purple-500 to-pink-600 text-white shadow-purple-500/30'
              }`}
            >
              {type === 'video' ? <Video className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">
                {type === 'video' ? 'สร้างวิดีโอด้วย AI (Video Studio)' : 'สร้างภาพด้วย AI (Image Studio)'}
              </h3>
              <p className="text-[11px] text-purple-200/70">
                ประมวลผลผ่าน SALA AI Cinema Engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prompt Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>คำอธิบายภาพหรือฉาก (Prompt)</span>
              <span className="text-[10px] text-cyan-400">ภาษาไทย / English</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="บรรยายสิ่งที่คุณต้องการให้เกิดขึ้นในฉาก เช่น แสง มุมกล้อง สไตล์..."
              className="w-full bg-[#131126] border border-slate-700/80 focus:border-purple-500 rounded-2xl p-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all resize-none"
            />
          </div>

          {/* Aspect Ratio Picker */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
              อัตราส่วนภาพ (Aspect Ratio)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['16:9', '9:16', '1:1', '4:3'] as AspectRatio[]).map((ar) => (
                <button
                  key={ar}
                  type="button"
                  onClick={() => setAspectRatio(ar)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border ${
                    aspectRatio === ar
                      ? 'bg-purple-600/30 border-purple-400 text-purple-200 shadow-sm shadow-purple-500/20'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {ar}
                </button>
              ))}
            </div>
          </div>

          {/* Character & Location Lock Selection */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                ล็อคตัวละคร (Character Lock)
              </label>
              <select
                value={selectedCharId}
                onChange={(e) => setSelectedCharId(e.target.value)}
                className="w-full bg-[#131126] border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              >
                <option value="">-- ไม่ระบุตัวละคร --</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                ล็อคสถานที่ (Location Lock)
              </label>
              <select
                value={selectedLocId}
                onChange={(e) => setSelectedLocId(e.target.value)}
                className="w-full bg-[#131126] border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
              >
                <option value="">-- ไม่ระบุสถานที่ --</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Video Duration (if video) */}
          {type === 'video' && (
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                <span>ความยาววิดีโอ</span>
                <span className="text-cyan-400 font-mono text-[10px]">{duration} วินาที</span>
              </label>
              <input
                type="range"
                min={3}
                max={10}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
            </div>
          )}

          {/* Action Button & Cost */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>ค่าใช้จ่าย: {cost} เครดิต</span>
            </div>

            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className="flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>กำลังสังเคราะห์ผลงาน...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-cyan-200" />
                  <span>เริ่มสร้างทันที</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
