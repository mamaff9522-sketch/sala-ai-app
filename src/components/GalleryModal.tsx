import React, { useState } from 'react';
import {
  Images,
  Download,
  Copy,
  Check,
  Play,
  Film,
  Image as ImageIcon,
  Sparkles,
  Calendar,
  Coins,
  Cpu,
  X,
  Layers,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { GenerationJob, MediaType } from '../types';
import { downloadMediaFile } from '../utils/download';

interface GalleryModalProps {
  jobs: GenerationJob[];
  onUsePromptInStudio: (prompt: string, characterId?: string) => void;
}

export const GalleryModal: React.FC<GalleryModalProps> = ({
  jobs,
  onUsePromptInStudio,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>('all');
  const [selectedJob, setSelectedJob] = useState<GenerationJob | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalVideoError, setModalVideoError] = useState<boolean>(false);
  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null);

  const completedJobs = jobs.filter(j => j.status === 'completed' && Boolean(j.outputUrl));
  const filteredJobs = completedJobs.filter(j => {
    if (filterType === 'all') return true;
    return j.type === filterType;
  });

  const handleCopyPrompt = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 pb-28 md:pb-12 space-y-6">
      {/* Header & Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d1322] border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Images className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">
              คลังผลงาน & ประวัติการสร้าง (Gallery & Downloads)
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            ดูผลงานภาพและวิดีโอทั้งหมดที่สร้างสำเร็จ ดาวน์โหลดไฟล์ความละเอียดเต็ม หรือคัดลอก Prompt ไปต่อยอด
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setFilterType('all')}
            id="filter-all"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterType === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ทั้งหมด ({completedJobs.length})
          </button>
          <button
            onClick={() => setFilterType('image')}
            id="filter-image"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterType === 'image'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ภาพนิ่ง ({completedJobs.filter(j => j.type === 'image').length})
          </button>
          <button
            onClick={() => setFilterType('video')}
            id="filter-video"
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterType === 'video'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            วิดีโอ ({completedJobs.filter(j => j.type === 'video').length})
          </button>
        </div>
      </div>

      {/* Grid of Generations */}
      {filteredJobs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredJobs.map((job) => {
            const isVideo = job.type === 'video';

            return (
              <div
                key={job.id}
                id={`gallery-item-${job.id}`}
                className="bg-[#0e1424] border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl hover:border-slate-700 transition-all flex flex-col justify-between group"
              >
                {/* Media Container */}
                <div
                  onClick={() => setSelectedJob(job)}
                  className="relative aspect-square sm:aspect-[4/3] bg-black cursor-pointer overflow-hidden"
                >
                  {isVideo ? (
                    <video
                      src={job.outputUrl}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      muted
                      loop
                      onMouseOver={(e) => (e.target as HTMLVideoElement).play()}
                      onMouseOut={(e) => (e.target as HTMLVideoElement).pause()}
                    />
                  ) : (
                    <img
                      src={job.outputUrl}
                      alt={job.prompt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  )}

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e1424] via-transparent to-black/30" />

                  {/* Badges on Media */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white border border-white/10 font-mono">
                      {job.aspectRatio}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-md text-white border ${
                      isVideo
                        ? 'bg-emerald-600/80 border-emerald-400/30'
                        : 'bg-indigo-600/80 border-indigo-400/30'
                    }`}>
                      {isVideo ? 'วิดีโอ 1080p' : 'ภาพนิ่ง'}
                    </span>
                  </div>

                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shadow-xl group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 fill-white ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Provider label */}
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[11px] text-slate-300">
                    <span className="truncate">{job.providerName}{job.isMock ? ' · ตัวอย่างจำลอง (Mock)' : ''}</span>
                    <span className="font-mono text-amber-300 shrink-0">{job.costCredits} เครดิต</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                    {job.prompt}
                  </p>

                  {job.characterName && (
                    <div className="flex items-center gap-1.5 text-[11px] text-indigo-400 bg-indigo-950/40 px-2.5 py-1 rounded-lg border border-indigo-900/50">
                      <Sparkles className="w-3 h-3" />
                      <span>ตัวละคร: {job.characterName}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                    <button
                      onClick={() => handleCopyPrompt(job.prompt, job.id)}
                      className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                      title="คัดลอก Prompt"
                    >
                      {copiedId === job.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400 text-[11px]">คัดลอกแล้ว</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span className="text-[11px]">ก็อปปี้ Prompt</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={downloadingJobId === job.id}
                      onClick={async () => {
                        if (!job.outputUrl) return;
                        setDownloadingJobId(job.id);
                        await downloadMediaFile(
                          job.outputUrl,
                          `sala_ai_${job.id}.${isVideo ? 'mp4' : 'png'}`
                        );
                        setDownloadingJobId(null);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-xl font-medium flex items-center gap-1.5 transition-all active:scale-95 text-[11px] cursor-pointer"
                    >
                      {downloadingJobId === job.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>กำลังดึงไฟล์...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>ดาวน์โหลด</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-[#0d1322] border border-slate-800 rounded-3xl p-8 space-y-3">
          <Images className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">ยังไม่มีประวัติการสร้างผลงานในหมวดนี้</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            สร้างภาพหรือวิดีโอแรกของคุณในห้องสตูดิโอ แล้วผลงานจะถูกเก็บถาวรไว้ที่นี่
          </p>
        </div>
      )}

      {/* Modal: Full Preview & Detail Inspector */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0e1424] border border-slate-700 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl space-y-4 my-6">
            <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">รายละเอียดผลงาน</span>
                <span className="text-xs text-slate-400 font-mono">({selectedJob.id})</span>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Media Presentation */}
            <div className="px-5">
              <div className="bg-black rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center min-h-[260px] max-h-[500px] relative">
                {selectedJob.type === 'video' ? (
                  modalVideoError ? (
                    <div className="p-8 text-center space-y-3">
                      <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                      <p className="text-white text-sm font-semibold">ไม่สามารถเล่นสตรีมวิดีโอได้โดยตรง</p>
                      <p className="text-slate-400 text-xs max-w-sm mx-auto">
                        ท่านสามารถคลิกปุ่ม "ดาวน์โหลดไฟล์ต้นฉบับ" ด้านล่าง เพื่อรับชมผ่านวิดีโอเพลเยอร์ในเครื่องได้ทันที
                      </p>
                      <button
                        onClick={() => setModalVideoError(false)}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> ลองโหลดใหม่อีกครั้ง
                      </button>
                    </div>
                  ) : (
                    <video
                      src={selectedJob.outputUrl}
                      controls
                      autoPlay
                      playsInline
                      onError={() => setModalVideoError(true)}
                      onLoadedData={() => setModalVideoError(false)}
                      className="max-h-[500px] w-auto mx-auto"
                    />
                  )
                ) : (
                  <img
                    src={selectedJob.outputUrl}
                    alt={selectedJob.prompt}
                    className="max-h-[500px] w-auto object-contain mx-auto"
                  />
                )}
              </div>
            </div>

            {/* Metadata & Actions */}
            <div className="p-5 pt-0 space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Prompt:</span>
                <p className="text-xs text-white bg-slate-900 p-3 rounded-xl border border-slate-800 leading-relaxed">
                  {selectedJob.prompt}
                </p>
              </div>

              {selectedJob.negativePrompt && (
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider">Negative Prompt:</span>
                  <p className="text-xs text-slate-300 bg-rose-950/20 p-2.5 rounded-xl border border-rose-900/30">
                    {selectedJob.negativePrompt}
                  </p>
                </div>
              )}

              {/* Spec Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">ผู้ให้บริการ</span>
                  <span className="font-semibold text-white">{selectedJob.providerName}</span>
                  {selectedJob.isMock && (
                    <span className="block text-[10px] text-amber-300 mt-0.5">ผลลัพธ์จำลอง/ตัวอย่าง ไม่ใช่งานที่ AI สร้างจริง (Mock / sample output)</span>
                  )}
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">อัตราส่วน</span>
                  <span className="font-semibold text-indigo-400 font-mono">{selectedJob.aspectRatio}</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">เครดิตที่ใช้</span>
                  <span className="font-semibold text-amber-400 font-mono">{selectedJob.costCredits} เครดิต</span>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Seed</span>
                  <span className="font-semibold text-slate-300 font-mono">{selectedJob.seed}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => {
                    onUsePromptInStudio(selectedJob.prompt, selectedJob.characterId);
                    setSelectedJob(null);
                  }}
                  className="w-full sm:w-auto bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs px-4 py-2.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>นำ Prompt ไปสร้างใหม่ในสตูดิโอ</span>
                </button>

                <button
                  type="button"
                  disabled={downloadingJobId === selectedJob.id}
                  onClick={async () => {
                    if (!selectedJob.outputUrl) return;
                    setDownloadingJobId(selectedJob.id);
                    await downloadMediaFile(
                      selectedJob.outputUrl,
                      `sala_${selectedJob.id}.${selectedJob.type === 'video' ? 'mp4' : 'png'}`
                    );
                    setDownloadingJobId(null);
                  }}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white text-xs px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {downloadingJobId === selectedJob.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังดึงไฟล์ MP4 จากเซิร์ฟเวอร์...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>ดาวน์โหลดไฟล์ต้นฉบับ ({selectedJob.type === 'video' ? 'MP4' : 'PNG'})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
