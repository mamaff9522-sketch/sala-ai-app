import React, { useState } from 'react';
import {
  X,
  UserCheck,
  ArrowRight,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Character, DialogueLockEntry } from '../types';
import { api } from '../services/api';

interface ScriptEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptText: string;
  dialogues: DialogueLockEntry[];
  characters: Character[];
  onApplyReplacement: (
    updatedScript: string,
    updatedDialogues: DialogueLockEntry[],
    newCharacter: Character
  ) => void;
}

export const ScriptEditorModal: React.FC<ScriptEditorModalProps> = ({
  isOpen,
  onClose,
  scriptText,
  dialogues,
  characters,
  onApplyReplacement
}) => {
  const [oldName, setOldName] = useState('');
  const [selectedNewCharId, setSelectedNewCharId] = useState(characters[1]?.id || characters[0]?.id || '');
  const [isLoading, setIsLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<any>(null);

  if (!isOpen) return null;

  const targetCharacter = characters.find(c => c.id === selectedNewCharId) || characters[0];

  const handlePreviewReplace = async () => {
    setIsLoading(true);
    try {
      const res = await api.replaceCharactersInScript({
        scriptText,
        dialogues,
        oldName,
        newName: targetCharacter?.name || 'ตัวละครใหม่',
        characterLibraryId: targetCharacter?.id
      });
      setPreviewResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (!previewResult || !targetCharacter) return;
    onApplyReplacement(
      previewResult.updatedScript,
      previewResult.updatedDialogues,
      targetCharacter
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-xl bg-[#0f1523] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">แก้ไขบทและสลับตัวละคร (Character Replace)</h3>
              <p className="text-xs text-slate-400">
                สลับชื่อตัวละครในบทพูด บทบรรยาย และอัปเดตรูปลักษณ์อัตโนมัติ
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

        {/* Form Controls */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">ชื่อตัวละครเดิมในบท:</label>
            <input
              type="text"
              value={oldName}
              onChange={e => setOldName(e.target.value)}
              placeholder="ระบุชื่อตัวละครที่ต้องการแทนที่"
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              เลือกตัวละครใหม่จาก Character Library เพื่อสลับแทนที่:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {characters.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedNewCharId(c.id)}
                  className={`p-2.5 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                    selectedNewCharId === c.id
                      ? 'border-indigo-500 bg-indigo-500/15 ring-1 ring-indigo-500/40 text-white'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60 text-slate-400'
                  }`}
                >
                  <img
                    src={c.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80'}
                    alt={c.name}
                    className="w-9 h-9 rounded-lg object-cover border border-slate-700"
                  />
                  <div className="truncate">
                    <div className="text-xs font-medium text-white">{c.name}</div>
                    <div className="text-[10px] text-slate-400">{c.gender}, {c.age}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handlePreviewReplace}
            disabled={isLoading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isLoading ? 'กำลังประมวลผลแทนที่...' : 'แสดงตัวอย่างการแทนที่ตัวละคร'}</span>
          </button>
        </div>

        {/* Replacement Preview */}
        {previewResult && (
          <div className="space-y-4 pt-3 border-t border-slate-800 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                พบและสลับตัวละครสำเร็จ ({previewResult.replacementCount} ตำแหน่ง)
              </span>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400">บทภาพยนตร์หลังแทนที่:</span>
              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                {previewResult.updatedScript}
              </pre>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-400">บทพูดของตัวละคร ({previewResult.updatedDialogues.length} บรรทัด):</span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {previewResult.updatedDialogues.map((d: any, i: number) => (
                  <div key={i} className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-xs">
                    <span className="font-bold text-indigo-300">{d.speaker}:</span> {d.line}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleApply}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>ยืนยันและนำไปใช้ใน Master Continuity Lock</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
