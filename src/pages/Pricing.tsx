import React, { useState, useEffect } from 'react';
import {
  CREDIT_PACKAGES,
  CreditPackage,
  verifyPaymentSession
} from '../services/stripe';
import { api } from '../services/api';
import { User } from 'firebase/auth';
import {
  Coins,
  Check,
  Zap,
  Sparkles,
  Shield,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Star,
  LogIn,
  RefreshCw
} from 'lucide-react';

interface PricingProps {
  authUser: User | null;
  onNavigateToStudio?: () => void;
  onLogin?: () => void;
  onSwitchAccount?: () => void;
  onCreditsUpdated?: (newCredits: number) => void;
  serverCredits?: number | null;
}

export const Pricing: React.FC<PricingProps> = ({
  authUser,
  onNavigateToStudio,
  onLogin,
  onSwitchAccount,
  onCreditsUpdated,
  serverCredits
}) => {
  const [selectedPackageId, setSelectedPackageId] = useState<string>('pkg_pro_500');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingPkgId, setProcessingPkgId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<{
    show: boolean;
    creditsAdded: number;
    message: string;
  } | null>(null);
  // Balance comes only from the server (/api/credits → Firestore remainingCredits). Default 0.
  const userFirestoreCredits: number | null = authUser ? (typeof serverCredits === 'number' && Number.isFinite(serverCredits) ? serverCredits : 0) : null;
  const [transferPackageId, setTransferPackageId] = useState<string>('pkg_pro_500');
  const [transferSettings, setTransferSettings] = useState<{
    bankName: string;
    accountNumber: string;
    accountName: string;
    hasQr: boolean;
    configured: boolean;
  } | null>(null);
  const [transferQr, setTransferQr] = useState<string | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferReference, setTransferReference] = useState<string | null>(null);
  const [transferAmount, setTransferAmount] = useState<number | null>(null);
  const [transferCredits, setTransferCredits] = useState<number | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipSending, setSlipSending] = useState(false);
  const [slipSent, setSlipSent] = useState(false);
  const [transferNote, setTransferNote] = useState<string | null>(null);

  // Read URL params for payment success/cancel redirection
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const isSuccess = searchParams.get('payment_success') === 'true';
    const isCanceled = searchParams.get('canceled') === 'true';
    const sessionId = searchParams.get('session_id');

    if (isSuccess && sessionId) {
      window.history.replaceState(null, '', window.location.pathname);
      verifyPaymentSession(sessionId)
        .then((res) => {
          if (res.creditsGranted) {
            setSuccessBanner({
              show: true,
              creditsAdded: 0,
              message: res.message || 'การชำระเงินถูกยืนยันและบันทึกเครดิตแล้ว'
            });
            if (onCreditsUpdated && typeof res.remainingCredits === 'number') {
              onCreditsUpdated(res.remainingCredits);
            }
          } else {
            setSuccessBanner(null);
            setErrorMessage(res.message || 'ยังไม่ยืนยันว่าเครดิตถูกบันทึก จึงยังไม่นับว่าเติมเครดิตแล้ว');
          }
        })
        .catch((err: any) => {
          setSuccessBanner(null);
          setErrorMessage(err?.message || 'ยังยืนยันการบันทึกเครดิตไม่ได้ จึงยังไม่นับว่าเติมเครดิตแล้ว');
        });
    } else if (isCanceled) {
      window.history.replaceState(null, '', window.location.pathname);
      setErrorMessage('ท่านได้ยกเลิกการชำระเงิน ท่านสามารถเลือกแพ็กเกจใหม่ได้ตลอดเวลา');
    }
  }, [onCreditsUpdated]);

  useEffect(() => {
    if (!authUser) {
      setTransferSettings(null);
      setTransferQr(null);
      return;
    }
    let cancelled = false;
    setTransferLoading(true);
    api.getTransferSettings(transferPackageId)
      .then((data) => {
        if (cancelled) return;
        setTransferSettings(data.settings);
        setTransferQr(data.qrDataUrl || null);
        setTransferNote(null);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setTransferSettings(null);
        setTransferQr(null);
        setTransferNote(err?.message || 'โหลดข้อมูลการโอนไม่สำเร็จ');
      })
      .finally(() => {
        if (!cancelled) setTransferLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authUser, transferPackageId]);

  const handleCreateTransfer = async () => {
    if (!authUser) {
      setTransferNote('กรุณาเข้าสู่ระบบก่อนทำรายการโอน');
      return;
    }
    setSlipSending(true);
    setTransferNote(null);
    try {
      const res = await api.createTransferRequest(transferPackageId);
      setTransferReference(res.request.reference);
      setTransferAmount(res.request.amountThb);
      setTransferCredits(res.request.credits ?? null);
      setSlipSent(false);
      setSlipFile(null);
      setTransferNote('สร้างรายการโอนแล้ว ยังไม่ได้เติมเครดิต ใส่รหัสอ้างอิงในหมายเหตุการโอน แล้วอัปโหลดสลิป');
    } catch (err: any) {
      setTransferNote(err?.message || 'สร้างรายการโอนไม่สำเร็จ');
    } finally {
      setSlipSending(false);
    }
  };

  const handleUploadSlip = async () => {
    if (!transferReference || !slipFile) {
      setTransferNote('เลือกไฟล์สลิปก่อนส่ง');
      return;
    }
    if (slipFile.size > 5 * 1024 * 1024) {
      setTransferNote('ไฟล์สลิปต้องไม่เกิน 5 MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(slipFile.type)) {
      setTransferNote('รองรับเฉพาะไฟล์ jpeg, png หรือ webp');
      return;
    }
    setSlipSending(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
        reader.readAsDataURL(slipFile);
      });
      const res = await api.uploadTransferSlip(transferReference, dataUrl, slipFile.type);
      setSlipSent(true);
      setTransferNote(res.message || 'ส่งสลิปแล้ว กำลังรอแอดมินตรวจสอบ ยังไม่ได้เติมเครดิต');
    } catch (err: any) {
      setSlipSent(false);
      setTransferNote(err?.message || 'ส่งสลิปไม่สำเร็จ ยังไม่ได้เติมเครดิต');
    } finally {
      setSlipSending(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {onNavigateToStudio && (
              <button
                onClick={onNavigateToStudio}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> กลับหน้าสตูดิโอ
              </button>
            )}
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              โอนผ่านพร้อมเพย์ · แอดมินยืนยันสลิป
            </span>
          </div>
          <h1 className="text-2xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Coins className="w-8 h-8 text-amber-400" />
            แพ็กเกจเติมเครดิต Sala AI
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            โอนเงินผ่านพร้อมเพย์แล้วอัปโหลดสลิป เครดิตจะเข้าเมื่อแอดมินยืนยันสลิปแล้วเท่านั้น
          </p>
        </div>

        {/* Current User Balance Badge */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 min-w-[240px]">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-400">ยอดคงเหลือของคุณ</div>
            <div className="text-2xl font-bold font-mono text-amber-300">
              {userFirestoreCredits !== null
                ? userFirestoreCredits.toLocaleString()
                : authUser
                ? '...'
                : '—'}{' '}
              <span className="text-xs font-sans text-slate-400 font-normal">เครดิต</span>
            </div>
            {authUser && authUser.uid !== 'demo_creator' ? (
              <div className="text-xs text-emerald-400 flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ซิงค์ Firestore: {authUser.email || authUser.displayName || 'ผู้ใช้'}
                </span>
                <button
                  type="button"
                  onClick={onSwitchAccount || onLogin}
                  className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer text-xs"
                >
                  (สลับบัญชี)
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onLogin}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1 mt-0.5 cursor-pointer"
              >
                <LogIn className="w-3 h-3" /> เข้าสู่ระบบด้วย Google เพื่อผูกยอด
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-2xl p-5 shadow-lg shadow-emerald-900/20 flex items-start gap-4 animate-in fade-in duration-300">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1 grow">
            <h3 className="text-base font-bold text-emerald-300">ชำระเงินและเติมเครดิตสำเร็จ! 🎉</h3>
            <p className="text-sm text-emerald-200/90">{successBanner.message}</p>
            <div className="flex items-center gap-3 pt-2">
              {onNavigateToStudio && (
                <button
                  onClick={onNavigateToStudio}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow transition-all active:scale-95"
                >
                  เริ่มสร้างผลงานทันที
                </button>
              )}
              <button
                onClick={() => setSuccessBanner(null)}
                className="text-xs text-emerald-300/80 hover:text-white underline"
              >
                ปิดข้อความนี้
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-rose-950/70 border border-rose-500/50 rounded-2xl p-4 flex items-center gap-3 text-rose-200 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span className="grow">{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-xs text-rose-400 hover:text-white underline ml-2"
          >
            ปิด
          </button>
        </div>
      )}


      {/* Bank transfer / PromptPay (Stripe checkout removed). Credits are not added here. */}
      <section className="bg-[#0e1424] border border-emerald-500/30 rounded-3xl p-6 space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">โอนผ่านพร้อมเพย์</h2>
          <p className="text-sm text-slate-400 mt-1">
            โอนเข้าบัญชีที่แอดมินตั้งไว้ แล้วอัปโหลดสลิป เครดิตจะเข้าเมื่อแอดมินยืนยันสลิปเท่านั้น ยังไม่เติมทันที
          </p>
        </div>

        {!authUser ? (
          <p className="text-sm text-amber-200">กรุณาเข้าสู่ระบบก่อนทำรายการโอน</p>
        ) : transferLoading && !transferSettings ? (
          <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลดบัญชีรับเงิน...</p>
        ) : !transferSettings?.configured ? (
          <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
            แอดมินยังไม่ได้บันทึกบัญชีรับเงิน
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="text-xs text-slate-400">เลือกแพ็กเกจสำหรับโอน (ราคาและเครดิตจากเซิร์ฟเวอร์)</div>
              <div className="grid grid-cols-2 gap-2">
                {CREDIT_PACKAGES.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => {
                      setTransferPackageId(pkg.id);
                      setTransferReference(null);
                      setTransferAmount(null);
                      setTransferCredits(null);
                      setSlipSent(false);
                      setSlipFile(null);
                    }}
                    className={`text-left rounded-xl border px-3 py-2 text-xs ${
                      transferPackageId === pkg.id
                        ? 'border-emerald-400 bg-emerald-500/10 text-white'
                        : 'border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="font-bold">{pkg.nameTh}</div>
                    <div>฿{pkg.priceThb} · {pkg.credits.toLocaleString()} เครดิต</div>
                  </button>
                ))}
              </div>
              {transferQr ? (
                <img src={transferQr} alt="PromptPay QR" className="w-56 h-56 bg-white rounded-2xl p-2" />
              ) : (
                <p className="text-xs text-slate-400">ยังไม่มี QR พร้อมเพย์ (แอดมินยังไม่ได้ใส่ PromptPay หรืออัปโหลดรูป QR)</p>
              )}
              <div className="text-sm text-slate-200 space-y-1">
                {transferSettings.bankName ? <div>ธนาคาร: {transferSettings.bankName}</div> : null}
                {transferSettings.accountNumber ? <div>เลขบัญชี: <span className="font-mono">{transferSettings.accountNumber}</span></div> : null}
                {transferSettings.accountName ? <div>ชื่อบัญชี: {transferSettings.accountName}</div> : null}
              </div>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleCreateTransfer}
                disabled={slipSending}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-60"
              >
                สร้างรหัสอ้างอิงการโอน
              </button>
              {transferReference && (
                <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4 space-y-2">
                  <div className="text-xs text-slate-400">ใส่รหัสนี้ในหมายเหตุการโอน</div>
                  <div className="text-2xl font-black font-mono text-emerald-300">{transferReference}</div>
                  <div className="text-sm text-slate-300">
                    ยอดโอน ฿{transferAmount} · จะได้ {transferCredits?.toLocaleString()} เครดิตเมื่อแอดมินยืนยัน
                  </div>
                  <label className="block text-xs text-slate-400">
                    อัปโหลดสลิป (jpeg, png, webp ไม่เกิน 5 MB)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="mt-2 block w-full text-xs text-slate-300"
                      onChange={(e) => {
                        setSlipFile(e.target.files?.[0] || null);
                        setSlipSent(false);
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleUploadSlip}
                    disabled={slipSending || !slipFile || slipSent}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {slipSending ? 'กำลังส่ง...' : 'ส่งสลิป'}
                  </button>
                  {slipSent && (
                    <p className="text-sm text-amber-200">ส่งสลิปแล้ว กำลังรอแอดมินตรวจสอบ ยังไม่ได้เติมเครดิต</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {transferNote && <p className="text-sm text-slate-300">{transferNote}</p>}
      </section>

      {/* Credit Usage Guide & FAQ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        <div className="lg:col-span-3 bg-[#0e1424] border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">อัตราการใช้เครดิตในระบบ</h3>
              <p className="text-xs text-slate-400">ความโปร่งใส คุ้มค่าทุกการสร้างสรรค์ผลงาน</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-300">🎨 สร้างภาพเดี่ยว (Imagen 3 / SD)</span>
                <span className="font-mono text-amber-400 font-bold">1-2 เครดิต / รูป</span>
              </div>
              <p className="text-xs text-slate-400">ความละเอียด 1080p, อัตราส่วน 16:9, 9:16 หรือ 1:1</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-300">🎬 สร้างคลิปวิดีโอ (Veo 2.0 / Luma)</span>
                <span className="font-mono text-amber-400 font-bold">10 เครดิต / คลิป</span>
              </div>
              <p className="text-xs text-slate-400">ความยาว 5 วินาที พร้อมโมชันและการเคลื่อนกล้องภาพยนตร์</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-300">👤 ออกแบบตัวละครคงที่ (Character Consistency)</span>
                <span className="font-mono text-amber-400 font-bold">2 เครดิต / ครั้ง</span>
              </div>
              <p className="text-xs text-slate-400">บันทึก DNA ใบหน้าและเสื้อผ้าลงใน Character Library</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-300">📽️ ผู้กำกับ Multi-Clip Continuity</span>
                <span className="font-mono text-amber-400 font-bold">0.5 เครดิต / ฉาก</span>
              </div>
              <p className="text-xs text-slate-400">ส่งต่อเฟรมท้ายสุดเป็นภาพอ้างอิงฉากถัดไปอัตโนมัติ</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
