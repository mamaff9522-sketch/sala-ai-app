import React, { useState } from 'react';
import {
  X,
  Smartphone,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  Terminal,
  ExternalLink,
  Cpu
} from 'lucide-react';

interface AndroidGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AndroidGuideModal: React.FC<AndroidGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const copyCode = (index: number, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl bg-[#0f1523] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">คู่มือการติดตั้งแอปบน Android (TWA / APK)</h3>
              <p className="text-xs text-slate-400">
                ศาลาเอไอ (Sala AI) รองรับ PWA, Trusted Web Activities (TWA) และ Capacitor อย่างสมบูรณ์
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

        {/* Security Highlight */}
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-emerald-300 block">ปลอดภัยสูงสุด: Zero Key Leak in APK</span>
            <p className="text-slate-300 leading-relaxed">
              API Keys (Gemini, Veo, Grok, ฯลฯ) ถูกเก็บรักษาอย่างปลอดภัยบน Backend Server เท่านั้น
              ไม่มีการฝังคีย์ใดๆ ลงในไฟล์ APK หรือ Client Code ทำให้สามารถเผยแพร่ขึ้น Google Play Store ได้อย่างมั่นใจ
            </p>
          </div>
        </div>

        {/* Deployment Steps */}
        <div className="space-y-4 text-xs">
          {/* Option 1: PWA Direct Install */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2.5">
            <div className="flex items-center gap-2 text-white font-bold">
              <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-[10px]">1</span>
              <span>ติดตั้งทันทีผ่านเบราว์เซอร์ Chrome บนมือถือ (PWA Install)</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              เปิดเว็บไซต์นี้ด้วย Google Chrome บนอุปกรณ์ Android &rarr; กดปุ่มจุดสามจุด (⋮) มุมขวาบน &rarr; เลือก <strong>"ติดตั้งแอป" (Install app)</strong> หรือ <strong>"เพิ่มลงในหน้าจอหลัก" (Add to Home screen)</strong>
            </p>
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-300 font-mono text-[11px]">
              ตรวจพบ Web Manifest: <span className="text-indigo-400">/manifest.json</span> พร้อมไอคอน 192px และ 512px
            </div>
          </div>

          {/* Option 2: TWA with Bubblewrap */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold">
                <span className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-[10px]">2</span>
                <span>สร้างไฟล์ APK ด้วย Google Bubblewrap (TWA สำหรับ Play Store)</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 font-mono">
                Official Google Tool
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              เครื่องมือทางการจาก Google สำหรับแปลง PWA เป็น APK/AAB โดยไม่ต้องเขียนโค้ด Java/Kotlin
            </p>

            <div className="space-y-2">
              {[
                { title: 'ติดตั้ง CLI:', cmd: 'npm install -g @bubblewrap/cli' },
                { title: 'เริ่มสร้างโปรเจกต์ Android:', cmd: 'bubblewrap init --manifest https://YOUR-DOMAIN/manifest.json' },
                { title: 'คอมไพล์เป็นไฟล์ APK/AAB:', cmd: 'bubblewrap build' }
              ].map((step, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{step.title}</span>
                    <button
                      onClick={() => copyCode(idx, step.cmd)}
                      className="text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      {copiedIndex === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>คัดลอกคำสั่ง</span>
                    </button>
                  </div>
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] text-slate-300 flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{step.cmd}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
        >
          ปิดหน้าต่าง
        </button>
      </div>
    </div>
  );
};
