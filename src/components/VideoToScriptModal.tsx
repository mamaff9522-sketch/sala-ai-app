import React, { useState } from 'react';
import {
  X,
  FileVideo,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  User,
  MapPin,
  Camera,
  Layers,
  Copy,
  Check
} from 'lucide-react';
import { VideoToScriptResult } from '../types';
import { api } from '../services/api';

interface VideoToScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToDirector: (scriptText: string, characterName: string, dialogues: any[]) => void;
}

export const VideoToScriptModal: React.FC<VideoToScriptModalProps> = ({
  isOpen,
  onClose,
  onApplyToDirector
}) => {
  const [videoName, setVideoName] = useState('ตัวอย่างวิดีโอ_สำรวจอวกาศ.mp4');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<VideoToScriptResult | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      const result = await api.analyzeVideoToScript({ videoName });
      setAnalysisResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!analysisResult) return;

    // Combine scenes into script format
    const fullScript = analysisResult.scenes
      .map(
        s =>
          `ฉากที่ ${s.sceneNumber} (${s.startTime}-${s.endTime}): ${s.action} โดยมี ${s.speaker} อยู่ใน ${s.location}`
      )
      .join('\n\n');

    const mappedDialogues = analysisResult.scenes.map(s => ({
      id: `diag_v2s_${s.sceneNumber}`,
      speaker: s.speaker,
      line: s.dialogue,
      emotionTone: s.emotion,
      deliverySpeed: 'natural' as const,
      clipNumber: s.sceneNumber
    }));

    onApplyToDirector(
      fullScript,
      analysisResult.detectedCharacters[0] || '',
      mappedDialogues
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#0f1523] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileVideo className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">ถอดวิดีโอเป็นบท (Video-to-Script)</h3>
              <p className="text-xs text-slate-400">
                แยกฉาก ถอดบทพูด ตรวจจับมุมกล้องและส่งต่อเข้าสู่ Multi-Clip Continuity Director
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

        {/* Video Source Selection */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-3">
          <label className="text-xs font-semibold text-slate-300">เลือกวิดีโอต้นฉบับ:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setVideoName('ตัวอย่างวิดีโอ_สำรวจอวกาศ.mp4')}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                videoName.includes('สำรวจอวกาศ')
                  ? 'border-indigo-500 bg-indigo-500/10 text-white'
                  : 'border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-semibold text-slate-200">ภารกิจสำรวจสถานีอวกาศ</div>
              <div className="text-[11px] text-slate-400">ความยาว 30 วินาที • 3 ฉากต่อเนื่อง</div>
            </button>
            <button
              type="button"
              onClick={() => setVideoName('ตัวอย่างเยาวราช_ไซเบอร์พังก์.mp4')}
              className={`p-3 rounded-xl border text-left text-xs transition-all ${
                videoName.includes('เยาวราช')
                  ? 'border-indigo-500 bg-indigo-500/10 text-white'
                  : 'border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="font-semibold text-slate-200">เยาวราชไซเบอร์พังก์ (ไซไฟ)</div>
              <div className="text-[11px] text-slate-400">ความยาว 20 วินาที • 2 ฉากต่อเนื่อง</div>
            </button>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isLoading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isLoading ? 'กำลังวิเคราะห์และถอดบทละคร...' : 'เริ่มถอดบทและแยกฉาก (Analyze Video)'}</span>
          </button>
        </div>

        {/* Results */}
        {analysisResult && (
          <div className="space-y-4 animate-in fade-in">
            <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-xs space-y-1">
              <span className="font-bold text-indigo-300 block">สรุปเนื้อเรื่อง:</span>
              <p className="text-slate-300 leading-relaxed">{analysisResult.storyOverview}</p>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-300 block">
                ผลการแยกฉากและบทพูด ({analysisResult.scenes.length} ฉาก):
              </span>

              {analysisResult.scenes.map(scene => (
                <div
                  key={scene.sceneNumber}
                  className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between text-indigo-400 font-semibold border-b border-slate-800 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      ฉากที่ {scene.sceneNumber} ({scene.startTime} - {scene.endTime})
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
                      {scene.camera}
                    </span>
                  </div>

                  <p className="text-slate-200">
                    <strong className="text-slate-400">การกระทำ:</strong> {scene.action}
                  </p>

                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2">
                    <User className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-300">{scene.speaker}:</span>{' '}
                      <span className="text-slate-300 italic">"{scene.dialogue}"</span>{' '}
                      <span className="text-[10px] text-slate-500">({scene.emotion})</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      {scene.location}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Apply Button */}
            <div className="pt-2">
              <button
                onClick={handleApply}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>นำเข้าบทและบทพูดสู่ Multi-Clip Director ทันที</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
