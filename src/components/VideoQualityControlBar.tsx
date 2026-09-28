import React from 'react';
import { Sliders, Cpu, Activity, Zap, Check, Monitor, Film, Layers } from 'lucide-react';

export interface VideoQualitySettings {
  resolution: '720p' | '1080p' | '4K';
  quality: number;
  codec: 'H.264' | 'H.265' | 'ProRes';
  colorProfile: 'Identity' | 'Cinematic' | 'Same';
  fps: 24 | 30 | 60;
}

interface VideoQualityControlBarProps {
  settings: VideoQualitySettings;
  onChange: (settings: VideoQualitySettings) => void;
  renderProgress?: number;
  isRendering?: boolean;
}

export const VideoQualityControlBar: React.FC<VideoQualityControlBarProps> = ({
  settings,
  onChange,
  renderProgress = 75,
  isRendering = false,
}) => {
  return (
    <div className="rounded-3xl bg-[#0a0f1d] border border-cyan-500/30 p-5 shadow-xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
              <span>แถบควบคุมคุณภาพวิดีโอ (Video Control & Quality)</span>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full font-mono">
                Studio Ready
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              กำหนดความละเอียด ตัวแปลงสัญญาณ (Codec) และโปรไฟล์สีของคลิป
            </p>
          </div>
        </div>

        <span className="text-xs font-mono text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2.5 py-1 rounded-lg hidden sm:inline-block">
          Preset: {settings.resolution} • {settings.fps}fps
        </span>
      </div>

      {/* Row 1: Resolution & Quality Slider */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Resolution Buttons (720p, 1080p, 4K / 2160p) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-cyan-400" />
              <span>ความละเอียด (Resolution)</span>
            </span>
            <span className="text-[11px] font-mono text-cyan-400 font-bold">
              {settings.resolution === '4K' ? '2160p (4K UHD)' : settings.resolution === '1080p' ? '1080p (FHD)' : '720p (HD)'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['720p', '1080p', '4K'] as const).map((res) => {
              const active = settings.resolution === res;
              return (
                <button
                  key={res}
                  type="button"
                  onClick={() => onChange({ ...settings, resolution: res })}
                  className={`py-2 px-2 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-cyan-500/30 to-indigo-600/40 border border-cyan-400 text-white shadow-md shadow-cyan-500/20'
                      : 'bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  {res}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quality Slider (0% - 100%) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>ระดับคุณภาพเรนเดอร์ (Quality)</span>
            </span>
            <span className="text-[11px] font-mono font-bold text-indigo-300">
              {settings.quality}%
            </span>
          </div>

          <div className="pt-1">
            <input
              type="range"
              min="50"
              max="100"
              step="5"
              value={settings.quality}
              onChange={(e) => onChange({ ...settings, quality: Number(e.target.value) })}
              className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg appearance-none"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>Standard (50%)</span>
              <span className="text-cyan-400">High Def (85%)</span>
              <span className="text-indigo-400 font-bold">Ultra 100%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Codec & Color Profile & FPS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
        {/* Codec */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-400">ตัวแปลงวิดีโอ (Codec)</label>
          <div className="grid grid-cols-3 gap-1">
            {(['H.264', 'H.265', 'ProRes'] as const).map((cdc) => (
              <button
                key={cdc}
                type="button"
                onClick={() => onChange({ ...settings, codec: cdc })}
                className={`py-1.5 px-1 rounded-lg text-[10px] font-mono transition-all ${
                  settings.codec === cdc
                    ? 'bg-indigo-600/30 border border-indigo-400 text-indigo-200 font-bold'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cdc}
              </button>
            ))}
          </div>
        </div>

        {/* Color Profile */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-400">การจัดสี (Colors)</label>
          <div className="grid grid-cols-3 gap-1">
            {(['Identity', 'Cinematic', 'Same'] as const).map((cp) => (
              <button
                key={cp}
                type="button"
                onClick={() => onChange({ ...settings, colorProfile: cp })}
                className={`py-1.5 px-1 rounded-lg text-[10px] transition-all truncate ${
                  settings.colorProfile === cp
                    ? 'bg-purple-600/30 border border-purple-400 text-purple-200 font-bold'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cp}
              </button>
            ))}
          </div>
        </div>

        {/* Framerate */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-medium text-slate-400">เฟรมเรต (FPS)</label>
          <div className="grid grid-cols-3 gap-1">
            {([24, 30, 60] as const).map((fpsVal) => (
              <button
                key={fpsVal}
                type="button"
                onClick={() => onChange({ ...settings, fps: fpsVal })}
                className={`py-1.5 px-1 rounded-lg text-[10px] font-mono transition-all ${
                  settings.fps === fpsVal
                    ? 'bg-cyan-600/30 border border-cyan-400 text-cyan-200 font-bold'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {fpsVal} fps
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Compute Usage GPU Monitor & Audio Waveform (ตามภาพตัวอย่าง) */}
      <div className="p-3.5 rounded-2xl bg-[#060a14] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Left: Render Progress / Status */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">
                {isRendering ? 'กำลังประมวลผลเรนเดอร์...' : 'ระบบพร้อมเรนเดอร์ (Engine Ready)'}
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                AI v2.2.0 Stable
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              ความเร็วประมวลผลเฉลี่ย ~38s / ช็อต • GPU Acceleration Active
            </p>
          </div>
        </div>

        {/* Right: Audio Waveform Simulation + GPU Bar */}
        <div className="flex items-center gap-4">
          {/* Waveform graphic */}
          <div className="flex items-end gap-1 h-6">
            {[4, 12, 18, 10, 22, 14, 20, 8, 16, 12, 24, 15].map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}px` }}
                className="w-1 rounded-full bg-gradient-to-t from-cyan-500 to-indigo-400 opacity-80"
              />
            ))}
          </div>

          {/* Compute usage */}
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block">Compute Usage</span>
            <span className="text-xs font-mono font-bold text-cyan-300">GPU 68%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
