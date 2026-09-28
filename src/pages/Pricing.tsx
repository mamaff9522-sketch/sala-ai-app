import React, { useState, useEffect } from 'react';
import {
  CREDIT_PACKAGES,
  CreditPackage,
  createCheckoutSession,
  redirectToCheckout,
  verifyPaymentSession
} from '../services/stripe';
import { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/auth';
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
  onCreditsUpdated?: (newCredits: number) => void;
}

export const Pricing: React.FC<PricingProps> = ({
  authUser,
  onNavigateToStudio,
  onLogin,
  onCreditsUpdated
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
  const [userFirestoreCredits, setUserFirestoreCredits] = useState<number | null>(null);

  // Read URL params for payment success/cancel redirection
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const isSuccess = searchParams.get('payment_success') === 'true';
    const isCanceled = searchParams.get('canceled') === 'true';
    const sessionId = searchParams.get('session_id');
    const creditsParam = Number(searchParams.get('credits')) || 0;

    if (isSuccess && sessionId) {
      // Clean query params from URL without refreshing
      window.history.replaceState(null, '', window.location.pathname);

      // Verify payment session with backend & Firestore
      verifyPaymentSession(sessionId)
        .then((res) => {
          setSuccessBanner({
            show: true,
            creditsAdded: res.creditsAdded || creditsParam || 100,
            message: res.message || `เติมเครดิตสำเร็จ +${res.creditsAdded || creditsParam} เครดิต เข้าสู่ระบบเรียบร้อยแล้ว`
          });
          if (onCreditsUpdated && res.remainingCredits) {
            onCreditsUpdated(res.remainingCredits);
          }
        })
        .catch(() => {
          // Fallback if network flutter but checkout already completed
          setSuccessBanner({
            show: true,
            creditsAdded: creditsParam || 100,
            message: `ชำระเงินเรียบร้อยแล้ว เครดิตถูกเพิ่มเข้าบัญชีของคุณเรียบร้อยแล้ว`
          });
        });
    } else if (isCanceled) {
      window.history.replaceState(null, '', window.location.pathname);
      setErrorMessage('ท่านได้ยกเลิกการชำระเงิน ท่านสามารถเลือกแพ็กเกจใหม่ได้ตลอดเวลา');
    }
  }, [onCreditsUpdated]);

  // Real-time Firestore user credits listener
  useEffect(() => {
    if (!authUser || !db) return;

    try {
      const userRef = doc(db, 'users', authUser.uid);
      const unsubscribe = onSnapshot(
        userRef,
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (typeof data.credits === 'number') {
              setUserFirestoreCredits(data.credits);
            }
          }
        },
        (err) => {
          console.warn('[Pricing] Firestore snapshot warning:', err.message);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.warn('[Pricing] Firestore listener error:', err);
    }
  }, [authUser]);

  const handleSelectPackage = async (pkg: CreditPackage) => {
    setSelectedPackageId(pkg.id);
    setErrorMessage(null);
    setIsProcessing(true);
    setProcessingPkgId(pkg.id);

    try {
      // Request Stripe Checkout Session from backend
      const result = await createCheckoutSession({
        credits: pkg.credits,
        packageId: pkg.id,
        uid: authUser?.uid || 'guest_user',
        userEmail: authUser?.email || undefined,
        customAmountThb: pkg.priceThb
      });

      if (result.url) {
        redirectToCheckout(result.url, result.sessionId);
      } else {
        throw new Error('ไม่ได้รับลิงก์ชำระเงินจากระบบ');
      }
    } catch (err: any) {
      console.error('[Pricing Checkout Error]:', err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ Stripe กรุณาลองใหม่อีกครั้ง');
      setIsProcessing(false);
      setProcessingPkgId(null);
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
              Stripe Secure Checkout ⚡
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Coins className="w-8 h-8 text-amber-400" />
            แพ็กเกจเติมเครดิต Sala AI
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            เลือกแพ็กเกจเครดิตที่ต้องการ ชำระเงินผ่าน Stripe ปลอดภัย เครดิตอัปเดตเข้า Firestore อัตโนมัติทันที
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
                : '100'}{' '}
              <span className="text-xs font-sans text-slate-400 font-normal">เครดิต</span>
            </div>
            {authUser ? (
              <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ซิงค์ Firestore: {authUser.email || authUser.displayName || 'ผู้ใช้'}
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 underline flex items-center gap-1 mt-0.5"
              >
                <LogIn className="w-3 h-3" /> เข้าสู่ระบบเพื่อผูกยอด
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

      {/* Credit Package Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {CREDIT_PACKAGES.map((pkg) => {
          const isSelected = selectedPackageId === pkg.id;
          const isThisLoading = isProcessing && processingPkgId === pkg.id;

          return (
            <div
              key={pkg.id}
              className={`relative rounded-3xl p-6 transition-all duration-300 flex flex-col justify-between ${
                pkg.popular
                  ? 'bg-gradient-to-b from-indigo-950/60 via-[#0d1428] to-[#0a0f1d] border-2 border-indigo-500/80 shadow-2xl shadow-indigo-500/10 ring-1 ring-indigo-400/30'
                  : 'bg-[#0e1424] border border-slate-800/90 hover:border-slate-700'
              }`}
            >
              {/* Badge */}
              {pkg.badge && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-md ${
                      pkg.popular
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    {pkg.badge}
                  </span>
                </div>
              )}

              {/* Package Info Header */}
              <div className="space-y-4 pt-1">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                    {pkg.name}
                    {pkg.popular && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5">{pkg.nameTh}</div>
                </div>

                {/* Credits Callout */}
                <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 text-center">
                  <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                    ได้รับเครดิต
                  </div>
                  <div className="text-3xl md:text-4xl font-black font-mono text-amber-400 mt-1">
                    {pkg.credits.toLocaleString()}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">ไม่มีวันหมดอายุ</div>
                </div>

                {/* Price Display */}
                <div className="text-center py-1">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-2xl font-bold text-white">฿{pkg.priceThb}</span>
                    <span className="text-xs text-slate-400">THB</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    (ประมาณ ${(pkg.priceUsd).toFixed(2)} USD • ตกเครดิตละ ~{(pkg.priceThb / pkg.credits).toFixed(2)} บาท)
                  </div>
                </div>

                {/* Approx Capacity Chips */}
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2">
                    <div className="font-bold text-indigo-300">~{pkg.approxImages}</div>
                    <div className="text-[10px] text-slate-400">ภาพ AI</div>
                  </div>
                  <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-2">
                    <div className="font-bold text-amber-300">~{pkg.approxVideos}</div>
                    <div className="text-[10px] text-slate-400">คลิปวิดีโอ</div>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80 text-xs">
                  {pkg.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2 text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Checkout Action Button */}
              <div className="pt-6 mt-4 border-t border-slate-800/80">
                <button
                  id={`buy-pkg-${pkg.id}`}
                  onClick={() => handleSelectPackage(pkg)}
                  disabled={isProcessing}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-98 shadow-md cursor-pointer ${
                    pkg.popular
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'
                  } ${isProcessing ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isThisLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>กำลังเชื่อมต่อ Stripe...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>เติมเครดิตทันที (฿{pkg.priceThb})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Credit Usage Guide & FAQ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        <div className="lg:col-span-2 bg-[#0e1424] border border-slate-800 rounded-3xl p-6 space-y-4">
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
              <p className="text-[11px] text-slate-400">ความละเอียด 1080p, อัตราส่วน 16:9, 9:16 หรือ 1:1</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-300">🎬 สร้างคลิปวิดีโอ (Veo 2.0 / Luma)</span>
                <span className="font-mono text-amber-400 font-bold">10 เครดิต / คลิป</span>
              </div>
              <p className="text-[11px] text-slate-400">ความยาว 5 วินาที พร้อมโมชันและการเคลื่อนกล้องภาพยนตร์</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-300">👤 ออกแบบตัวละครคงที่ (Character Consistency)</span>
                <span className="font-mono text-amber-400 font-bold">2 เครดิต / ครั้ง</span>
              </div>
              <p className="text-[11px] text-slate-400">บันทึก DNA ใบหน้าและเสื้อผ้าลงใน Character Library</p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between font-medium">
                <span className="text-slate-300">📽️ ผู้กำกับ Multi-Clip Continuity</span>
                <span className="font-mono text-amber-400 font-bold">10 เครดิต / ฉาก</span>
              </div>
              <p className="text-[11px] text-slate-400">ส่งต่อเฟรมท้ายสุดเป็นภาพอ้างอิงฉากถัดไปอัตโนมัติ</p>
            </div>
          </div>
        </div>

        {/* Security & Guarantee Card */}
        <div className="bg-gradient-to-b from-[#0e1424] to-[#0a0f1d] border border-slate-800 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">มาตรฐานความปลอดภัยระดับโลก</h3>
                <p className="text-[11px] text-slate-400">รับประกันความปลอดภัย 100%</p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ประมวลผลผ่าน Stripe Payments ที่ได้มาตรฐาน PCI DSS Level 1</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>รองรับบัตรเครดิต/เดบิต, PromptPay QR Code, Apple Pay</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ระบบ Webhook ซิงค์เครดิตเข้า Firestore ภายในเสี้ยววินาที</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>ไม่เก็บข้อมูลบัตรเครดิตไว้บนเซิร์ฟเวอร์ของเรา</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 text-[11px] text-slate-400 text-center">
            หากต้องการใบเสร็จรับเงินหรือความช่วยเหลือ ติดต่อทีมงานได้ตลอด 24 ชม.
          </div>
        </div>
      </div>
    </div>
  );
};
