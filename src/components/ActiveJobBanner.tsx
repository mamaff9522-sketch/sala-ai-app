import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Play, Sparkles, X, Eye } from 'lucide-react';
import { GenerationJob } from '../types';

interface ActiveJobBannerProps {
  activeJobs: GenerationJob[];
  onViewJob: (job: GenerationJob) => void;
  onDismissJob: (jobId: string) => void;
}

export const ActiveJobBanner: React.FC<ActiveJobBannerProps> = ({
  activeJobs,
  onViewJob,
  onDismissJob,
}) => {
  if (activeJobs.length === 0) return null;

  return (
    <div className="fixed top-18 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2.5 pointer-events-none">
      {activeJobs.map((job) => {
        const isCompleted = job.status === 'completed';
        const isFailed = job.status === 'failed';
        const isProcessing = job.status === 'processing' || job.status === 'queued';

        return (
          <div
            key={job.id}
            id={`job-banner-${job.id}`}
            className="pointer-events-auto bg-[#0d1424] border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl shadow-black/60 backdrop-blur-xl animate-in slide-in-from-top-4 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : isFailed
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 animate-pulse'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : isFailed ? (
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                  ) : (
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      {job.type === 'video' ? '🎬 กำลังสร้างวิดีโอ' : '🎨 กำลังสร้างภาพ'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {job.aspectRatio}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 line-clamp-1 mt-0.5 max-w-[210px]">
                    {job.prompt}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onDismissJob(job.id)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 transition-colors"
                title="ปิดการแจ้งเตือน"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Stage text & progress bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="text-slate-400 line-clamp-1">{job.stage}</span>
                <span className="font-mono font-bold text-indigo-400 shrink-0">
                  {job.progress}%
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isCompleted
                      ? 'bg-emerald-400'
                      : isFailed
                      ? 'bg-rose-500'
                      : 'bg-gradient-to-r from-indigo-500 to-emerald-400'
                  }`}
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            </div>

            {/* Completed Action */}
            {isCompleted && (
              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> เสร็จสมบูรณ์
                  {job.isMock && (
                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      Mock (จำลอง)
                    </span>
                  )}
                </span>
                <button
                  onClick={() => onViewJob(job)}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs px-3 py-1.5 rounded-xl font-medium transition-all shadow-sm shadow-indigo-600/30 active:scale-95"
                >
                  <Eye className="w-3.5 h-3.5" />
                  เปิดดูผลงาน
                </button>
              </div>
            )}

            {/* Failed Action & Details */}
            {isFailed && (
              <div className="mt-3 pt-2.5 border-t border-rose-900/50">
                <div className="bg-rose-950/40 border border-rose-500/20 rounded-lg p-2.5 text-xs text-rose-300">
                  <div className="font-semibold text-rose-200 mb-0.5 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>สร้างไม่สำเร็จ (Generation failed) — คืนเครดิตแล้ว</span>
                  </div>
                  <p className="text-[11px] text-rose-300/90 leading-relaxed break-words">
                    {job.error || job.stage}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
