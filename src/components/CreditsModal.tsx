import React, { useState } from 'react';
import {
  Coins,
  TrendingDown,
  Calendar,
  ShieldCheck,
  PlusCircle,
  Clock,
  CheckCircle2,
  X,
  CreditCard,
  Zap,
  Info
} from 'lucide-react';
import { CreditAccount } from '../types';
import { api } from '../services/api';

interface CreditsModalProps {
  credits: CreditAccount | null;
  onRefreshCredits: () => void;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToPricing?: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({
  credits,
  onRefreshCredits,
  isOpen,
  onClose,
  onNavigateToPricing,
}) => {
  const [topupAmount, setTopupAmount] = useState<number>(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTopup = async (amt: number) => {
    setIsProcessing(true);
    setSuccessMsg(null);
    try {
      await api.topupCredits(amt);
      onRefreshCredits();
      setSuccessMsg(`เติมเครดิต +${amt} เครดิต (โหมด Sandbox) สำเร็จแล้ว!`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error('Topup error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const dailyPercent = credits
    ? Math.min(100, Math.round((credits.dailyUsedCredits / credits.dailyLimit) * 100))
    : 0;

  const monthlyPercent = credits
    ? Math.min(100, Math.round((credits.monthlyUsedCredits / credits.monthlyLimit) * 100))
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0e1424] border border-slate-700 w-full max-w-2xl rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                ระบบเครดิตและขีดจำกัด (Credits & Quota Limits)
              </h3>
              <p className="text-xs text-slate-400">
                จัดการเครดิตคงเหลือ ตรวจสอบสถิติการใช้งาน และจำกัดโควตารายวัน/รายเดือน
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Big Balance Banner */}
        <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-indigo-950/30 border border-amber-500/30 rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
              เครดิตคงเหลือของคุณ (Balance)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-white font-mono tracking-tight">
                {credits?.remainingCredits ?? 0}
              </span>
              <span className="text-sm font-semibold text-amber-400">Credits</span>
            </div>
            <p className="text-[11px] text-slate-400">
              ใช้สร้างภาพได้อีกประมาณ {Math.floor((credits?.remainingCredits || 0) / 8)} ภาพ หรือวิดีโอ {Math.floor((credits?.remainingCredits || 0) / 35)} คลิป
            </p>
          </div>

          {/* Stripe Topup Button */}
          <div className="flex flex-col gap-2 shrink-0">
            {onNavigateToPricing && (
              <button
                id="modal-topup-stripe-btn"
                onClick={() => {
                  onClose();
                  onNavigateToPricing();
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>เติมเครดิตผ่าน Stripe (100 - 2,500 เครดิต)</span>
              </button>
            )}
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Limit Meters: Daily & Monthly Limits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Daily Limit */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">จำกัดการใช้งานประจำวัน (Daily Limit)</span>
              <span className="font-mono text-slate-400 font-bold">
                {credits?.dailyUsedCredits} / {credits?.dailyLimit}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  dailyPercent > 85 ? 'bg-rose-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${dailyPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              คงเหลือสิทธิ์วันนี้: <span className="font-mono text-white">{(credits?.dailyLimit || 150) - (credits?.dailyUsedCredits || 0)}</span> เครดิต (รีเซ็ตทุกเที่ยงคืน)
            </p>
          </div>

          {/* Monthly Limit */}
          <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">จำกัดการใช้งานรายเดือน (Monthly Limit)</span>
              <span className="font-mono text-slate-400 font-bold">
                {credits?.monthlyUsedCredits} / {credits?.monthlyLimit}
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${monthlyPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">
              ยอดใช้สะสมรวมทั้งเดือน: <span className="font-mono text-white">{credits?.monthlyUsedCredits || 0}</span> เครดิต
            </p>
          </div>
        </div>

        {/* Cost Estimation Matrix Table */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            อัตราค่าใช้จ่ายโดยประมาณ (Rates & Provider Estimates)
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Google Gemini</span>
              <span className="font-bold text-white">8 เครดิต / ภาพ</span>
              <span className="text-[10px] text-slate-500 block">30-40 เครดิต/วิดีโอ</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Meta Emu / Llama</span>
              <span className="font-bold text-white">10 เครดิต / ภาพ</span>
              <span className="text-[10px] text-slate-500 block">35-45 เครดิต/วิดีโอ</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">xAI / Grok Vision</span>
              <span className="font-bold text-white">9 เครดิต / ภาพ</span>
              <span className="text-[10px] text-slate-500 block">32-42 เครดิต/วิดีโอ</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-[10px] block">ศาลา Simulator</span>
              <span className="font-bold text-emerald-400">2 เครดิต / ภาพ</span>
              <span className="text-[10px] text-slate-500 block">15 เครดิต/วิดีโอ</span>
            </div>
          </div>
        </div>

        {/* Transaction History Log */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            ประวัติการใช้งานเครดิต (Transaction History)
          </span>

          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {credits?.transactions && credits.transactions.length > 0 ? (
              credits.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="bg-slate-900/90 border border-slate-800/80 p-2.5 rounded-xl flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium text-slate-200 line-clamp-1">{tx.description}</p>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(tx.timestamp).toLocaleString('th-TH')}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono font-bold text-xs ${
                        tx.amount > 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                    </span>
                    <span className="text-[10px] text-slate-500 block font-mono">
                      คงเหลือ {tx.balanceAfter}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-4">ไม่มีประวัติธุรกรรม</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
