import React, { useRef, useState } from 'react';
import { X, FileVideo, Sparkles } from 'lucide-react';
import { api } from '../services/api';

interface VideoToScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToDirector: (scriptText: string, characterName: string, dialogues: any[]) => void;
}

const MAX_BYTES = 20 * 1024 * 1024;

export const VideoToScriptModal: React.FC<VideoToScriptModalProps> = ({
  isOpen,
  onClose,
  onApplyToDirector
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFile = (picked: File | null) => {
    setError('');
    setTranscript('');
    if (!picked) {
      setFile(null);
      return;
    }
    if (picked.size > MAX_BYTES) {
      setFile(null);
      setError('ไฟล์วิดีโอใหญ่เกิน 20MB');
      return;
    }
    setFile(picked);
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('กรุณาเลือกวิดีโอจากเครื่องก่อน');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const text = await api.analyzeVideoToScript(file);
      setTranscript(text);
    } catch (err: any) {
      setTranscript('');
      setError(err?.message || 'ถอดวิดีโอไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    const text = transcript.trim();
    if (!text) return;
    onApplyToDirector(text, '', []);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-[#0f1523] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileVideo className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">ถอดวิดีโอเป็นบท</h3>
              <p className="text-xs text-slate-400">เลือกวิดีโอจากเครื่อง แล้วถอดเสียงพูดเป็นบทที่แก้ได้</p>
            </div>
          </div>
          <button aria-label="ปิด" title="ปิด" onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-3">
          <label className="text-xs font-semibold text-slate-300 block">เลือกวิดีโอจากเครื่องหรือคลังไฟล์</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={(event) => {
              handleFile(event.target.files?.[0] || null);
              event.target.value = '';
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white"
          >
            เลือกไฟล์
          </button>
          {file && <p className="text-xs text-slate-400">ไฟล์ที่เลือก: {file.name}</p>}
          <button
            onClick={handleAnalyze}
            disabled={isLoading || !file}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isLoading ? 'กำลังถอดเสียงเป็นบท...' : 'ถอดเสียงเป็นบท'}</span>
          </button>
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">บทพูดที่ได้ แก้ได้</label>
          <textarea
            value={transcript}
            onChange={(event) => setTranscript(event.target.value)}
            rows={8}
            placeholder="บทพูดจะปรากฏที่นี่หลังถอดเสียง ไม่มีบทตัวอย่าง"
            className="w-full rounded-2xl bg-slate-950 border border-slate-800 p-3 text-sm text-slate-100"
          />
          <button
            onClick={handleApply}
            disabled={!transcript.trim()}
            className="w-full py-3 rounded-xl bg-slate-800 text-white text-xs font-bold disabled:opacity-50"
          >
            ใส่บทนี้ในช่องเรื่อง
          </button>
        </div>
      </div>
    </div>
  );
};
