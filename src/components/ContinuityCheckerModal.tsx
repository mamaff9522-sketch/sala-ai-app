import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Sliders
} from 'lucide-react';
import {
  ContinuityCheckReport,
  ContinuityIssue,
  DirectedClipItem,
  MasterContinuityLock,
  DialogueLockEntry
} from '../types';
import { api } from '../services/api';

interface ContinuityCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptText: string;
  clips: DirectedClipItem[];
  continuityLock: MasterContinuityLock;
  dialogues: DialogueLockEntry[];
  onApplyFix?: (issue: ContinuityIssue) => void;
}

export const ContinuityCheckerModal: React.FC<ContinuityCheckerModalProps> = ({
  isOpen,
  onClose,
  scriptText,
  clips,
  continuityLock,
  dialogues,
  onApplyFix
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<ContinuityCheckReport | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunCheck = async () => {
    setIsLoading(true);
    setCheckError(null);
    try {
      const rep = await api.checkContinuity({
        scriptText,
        clips,
        continuityLock,
        dialogues
      });
      setReport(rep);
    } catch (err: any) {
      console.error('Continuity check failed:', err?.message || err);
      setCheckError(err?.message || 'ตรวจความต่อเนื่องไม่สำเร็จ / Continuity check failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#0f1523] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">ตรวจสอบความต่อเนื่องข้ามคลิป (Continuity Checker)</h3>
              <p className="text-xs text-slate-400">
                สแกนความสอดคล้องของตัวละคร เครื่องแต่งกาย แสง อารมณ์ และบทพูดก่อนทำการ Generate
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

        {/* Action Trigger Card */}
        {checkError && (
          <div role="alert" className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs text-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{checkError}</span>
          </div>
        )}

        {!report && (
          <div className="bg-slate-900/90 border border-slate-800 p-6 rounded-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mx-auto">
              <Sliders className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">พร้อมเริ่มการตรวจสอบ Pre-flight Check</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                ระบบจะตรวจสอบ {clips.length} คลิปต่อเนื่องเทียบกับ Master Continuity Lock ({continuityLock.characterName})
              </p>
            </div>
            <button
              onClick={handleRunCheck}
              disabled={isLoading}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isLoading ? 'กำลังวิเคราะห์ความต่อเนื่อง...' : 'เริ่มสแกนความต่อเนื่องเดี๋ยวนี้'}</span>
            </button>
          </div>
        )}

        {/* Report Display */}
        {report && (
          <div className="space-y-5 animate-in fade-in">
            {/* Status Summary Banner */}
            <div
              className={`p-4 rounded-2xl border flex items-center justify-between ${
                report.hasConflicts
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <div className="flex items-center gap-3">
                {report.hasConflicts ? (
                  <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                )}
                <div>
                  <div className="text-xs font-bold">
                    {report.hasConflicts
                      ? `พบข้อควรระวัง/ขัดแย้ง ${report.totalIssues} รายการ`
                      : 'ผ่านการตรวจสอบความต่อเนื่อง 100% ทุกคลิป'}
                  </div>
                  <div className="text-[11px] opacity-80">
                    {report.hasConflicts
                      ? 'คุณสามารถกดแก้ไขตามคำแนะนำเพื่อคุณภาพการเจนระดับสตูดิโอ'
                      : 'ตัวละคร เครื่องแต่งกาย แสง มุมกล้อง และบทพูดมีความสอดคล้องกันสมบูรณ์'}
                  </div>
                </div>
              </div>

              <button
                onClick={handleRunCheck}
                className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-all text-xs flex items-center gap-1"
                title="สแกนใหม่อีกครั้ง"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Passed Checks */}
            {report.passedChecks?.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-300 block">เกณฑ์การตรวจสอบที่ผ่านแล้ว:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {report.passedChecks.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-900/60 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-slate-300"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Identified Issues */}
            {report.issues?.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-300 block">รายการที่แนะนำให้ปรับปรุง:</span>
                {report.issues.map(issue => (
                  <div
                    key={issue.id}
                    className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-[10px] font-bold">
                          คลิปที่ {issue.clipNumber}
                        </span>
                        <span className="font-bold text-white">{issue.title}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">{issue.type}</span>
                    </div>

                    <p className="text-slate-300 leading-relaxed">{issue.description}</p>

                    <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300 text-[11px] flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-indigo-400" />
                      <div>
                        <strong>คำแนะนำในการแก้ไข:</strong> {issue.suggestion}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
            >
              ปิดหน้าต่างตรวจสอบ
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
