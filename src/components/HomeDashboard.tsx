import React, { useState, useEffect } from 'react';
import {
  FileText,
  Clapperboard,
  UserCheck,
  Building,
  Image as ImageIcon,
  Video,
  Sparkles,
  Coins,
  Bell,
  Plus,
  Play,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  FolderKanban,
  Film,
  Compass,
  Palette,
  Camera,
  Layers,
  Sparkle,
  Mountain,
  FileSpreadsheet,
  BookOpen,
  Save,
  Trash2,
  FastForward,
  Check
} from 'lucide-react';
import { CreditAccount, Character, LocationItem, GenerationJob } from '../types';
import {
  getSavedFullStory,
  saveFullStory,
  clearFullStory,
  analyzeStoryLocationSegments,
  getStoryFlowState,
  saveStoryFlowState,
  LocationSceneSegment
} from '../services/salaStoryFlowEngine';
import { HOME_HORROR_STORY } from '../constants/homeHorrorStory';
import { api } from '../services/api';
import scriptCardImg from '../assets/cards/script-card.png';
import sceneCardImg from '../assets/cards/scene-card.png';
import characterCardImg from '../assets/cards/character-card.png';
import locationCardImg from '../assets/cards/location-card.png';
import imageCardImg from '../assets/cards/image-card.png';
import videoCardImg from '../assets/cards/video-card.png';
import videoToScriptCardImg from '../assets/cards/video-to-script-card.svg';

interface HomeDashboardProps {
  onNavigate: (tab: string) => void;
  credits: CreditAccount | null;
  onOpenCredits: () => void;
  authUser: any;
  characters: Character[];
  locations: LocationItem[];
  jobs: GenerationJob[];
  onOpenNewCharacterModal: () => void;
  onOpenNewLocationModal: () => void;
  onOpenQuickGenerate: (type: 'image' | 'video') => void;
  onOpenScriptWriter?: () => void;
  isAdmin?: boolean;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  onNavigate,
  credits,
  onOpenCredits,
  authUser,
  characters,
  locations,
  jobs,
  onOpenNewCharacterModal,
  onOpenNewLocationModal,
  onOpenQuickGenerate,
  onOpenScriptWriter,
  isAdmin = false
}) => {
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [topupOpen, setTopupOpen] = useState(false);
  const [bahtRequest, setBahtRequest] = useState('');
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [topupBusy, setTopupBusy] = useState(false);
  const [topupNote, setTopupNote] = useState<string | null>(null);

  // -------------------------------------------------------------
  // Full Story State (ช่อง "เนื้อเรื่องเต็ม" หน้าแรก)
  // -------------------------------------------------------------
  const [fullStoryInput, setFullStoryInput] = useState<string>(() => {
    return getSavedFullStory() || (typeof localStorage !== 'undefined' ? localStorage.getItem('sala_story') || '' : '') || HOME_HORROR_STORY;
  });
  const [savedSuccessNotice, setSavedSuccessNotice] = useState<string | null>(null);
  const [analyzedSegments, setAnalyzedSegments] = useState<LocationSceneSegment[]>(() => {
    const saved = getSavedFullStory() || (typeof localStorage !== 'undefined' ? localStorage.getItem('sala_story') || '' : '') || HOME_HORROR_STORY;
    return saved ? analyzeStoryLocationSegments(saved) : [];
  });
  const [currentFlowSegmentIndex, setCurrentFlowSegmentIndex] = useState<number>(() => {
    return getStoryFlowState().segmentIndex;
  });

  // ซิงค์ข้อมูลเนื้อเรื่องเต็มและสถานะจุดเปลี่ยนสถานที่ทุกครั้งที่กลับมาหน้าแรก (Rule 6)
  useEffect(() => {
    const saved = getSavedFullStory() || (typeof localStorage !== 'undefined' ? localStorage.getItem('sala_story') || '' : '') || HOME_HORROR_STORY;
    if (saved && saved !== fullStoryInput) {
      setFullStoryInput(saved);
      setAnalyzedSegments(analyzeStoryLocationSegments(saved));
    }
    const flow = getStoryFlowState();
    if (flow.segmentIndex !== currentFlowSegmentIndex) {
      setCurrentFlowSegmentIndex(flow.segmentIndex);
    }
  }, []);

  const handleSaveFullStory = () => {
    if (!fullStoryInput.trim()) {
      alert('กรุณากรอกหรือวางเนื้อเรื่องเต็มตั้งแต่ต้นจนจบก่อนกดบันทึก');
      return;
    }
    const cleanStory = fullStoryInput.trim();
    saveFullStory(cleanStory);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sala_story', cleanStory);
    }

    // วิเคราะห์จุดเปลี่ยนสถานที่และแยกกลุ่มฉาก
    const segments = analyzeStoryLocationSegments(cleanStory);
    setAnalyzedSegments(segments);

    // ดึง "ฉากแรก" ในสถานที่แรกลงช่อง Story (MultiClipDirector) อัตโนมัติ
    if (segments.length > 0) {
      const firstSegment = segments[0];
      saveStoryFlowState(1);
      setCurrentFlowSegmentIndex(1);

      // บันทึกฉากแรกเข้า sala_current_director_script เพื่อให้ MultiClipDirector โหลดขึ้นช่อง Story ทันที
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('sala_current_director_script', firstSegment.scriptText);
      }
      setSavedSuccessNotice(`บันทึกเนื้อเรื่องเต็มสำเร็จ! AI วิเคราะห์พบ ${segments.length} สถานที่ ดึง "${firstSegment.sceneRange} (${firstSegment.locationName})" เข้าสู่ Story แล้ว`);
    } else {
      setSavedSuccessNotice('บันทึกเนื้อเรื่องเต็มสำเร็จ!');
    }
    setTimeout(() => setSavedSuccessNotice(null), 4500);
  };

  const handleClearFullStory = () => {
    if (confirm('คุณต้องการลบ "เนื้อเรื่องเต็ม" ทั้งหมดใช่หรือไม่? ข้อมูลฉากใน Story จะถูกล้างออก')) {
      clearFullStory();
      setFullStoryInput('');
      setAnalyzedSegments([]);
      setCurrentFlowSegmentIndex(1);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('sala_story');
        localStorage.removeItem('sala_current_director_script');
        localStorage.removeItem('sala_story_continuation_state');
      }
      setSavedSuccessNotice('ลบเนื้อเรื่องเต็มเรียบร้อยแล้ว');
      setTimeout(() => setSavedSuccessNotice(null), 3000);
    }
  };

  const displayCredits =
    credits && typeof credits.remainingCredits === 'number'
      ? credits.remainingCredits.toLocaleString()
      : '0';

  const closeTopupRequest = () => {
    setTopupOpen(false);
    setTopupNote(null);
  };

  const submitTopupRequest = async () => {
    const bahtAsked = Number(bahtRequest.trim());
    if (!Number.isInteger(bahtAsked) || bahtAsked < 1) {
      setTopupNote('ระบุจำนวนเงินเป็นบาท เป็นจำนวนเต็ม');
      return;
    }
    if (!slipFile) {
      setTopupNote('เลือกสลิปการโอนก่อนส่งคำขอ');
      return;
    }
    if (slipFile.size > 5 * 1024 * 1024) {
      setTopupNote('ไฟล์สลิปต้องไม่เกิน 5 MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(slipFile.type)) {
      setTopupNote('รองรับเฉพาะไฟล์ jpeg, png หรือ webp');
      return;
    }
    setTopupBusy(true);
    setTopupNote(null);
    try {
      const created = await api.createTransferRequest({ amountThb: bahtAsked });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
        reader.readAsDataURL(slipFile);
      });
      const uploaded = await api.uploadTransferSlip(created.request.reference, dataUrl, slipFile.type);
      setTopupNote(uploaded.message || `ส่งคำขอ ${created.request.reference} แล้ว รอแอดมินอนุมัติ ยังไม่ได้เติมเครดิต`);
      setBahtRequest('');
      setSlipFile(null);
    } catch (err: any) {
      setTopupNote(err?.message || 'ส่งคำขอไม่สำเร็จ ยังไม่ได้เติมเครดิต');
    } finally {
      setTopupBusy(false);
    }
  };

  const menuCards = [
    // แถว 1 ซ้าย: วางบท / เขียนบท -> รูปม้วนบทและปากกา
    {
      id: 'script',
      title: 'วางบท / เขียนบท',
      desc1: 'จากไอเดีย สู่บทภาพยนตร์',
      desc2: 'ด้วย AI',
      imgSrc: scriptCardImg,
      onClick: () => {
        if (onOpenScriptWriter) {
          onOpenScriptWriter();
        } else {
          onNavigate('director');
        }
      }
    },
    // แถว 1 ขวา: แยกเป็นฉาก / ช็อต -> รูป clapperboard + storyboard
    {
      id: 'scenes',
      title: 'แยกเป็นฉาก / ช็อต',
      desc1: 'จัดโครงสร้างฉาก',
      desc2: 'และสตอรี่บอร์ดอัตโนมัติ',
      imgSrc: sceneCardImg,
      onClick: () => onNavigate('director')
    },
    // แถว 2 ซ้าย: ตัวละคร -> รูปตัวละคร 3 คน
    {
      id: 'characters',
      title: 'ตัวละคร',
      desc1: 'สร้างและเลือกคาแรกเตอร์',
      desc2: 'ให้สไตล์โดดเด่น',
      imgSrc: characterCardImg,
      onClick: () => onNavigate('characters')
    },
    // แถว 2 ขวา: สถานที่ -> รูปปราสาท/โลกแฟนตาซี
    {
      id: 'locations',
      title: 'สถานที่',
      desc1: 'สร้างโลก สถานที่',
      desc2: 'และบรรยากาศของเรื่อง',
      imgSrc: locationCardImg,
      onClick: () => onNavigate('locations')
    },
    // แถว 3 ซ้าย: สร้างภาพ -> รูปภาพซ้อนกัน
    {
      id: 'image',
      title: 'สร้างภาพ',
      desc1: 'สร้างภาพด้วย AI',
      desc2: 'จากบทหรือฉากที่ต้องการ',
      imgSrc: imageCardImg,
      onClick: () => onOpenQuickGenerate('image')
    },
    // แถว 3 ขวา: สร้างวิดีโอ -> รูปฟิล์ม + Play
    {
      id: 'video',
      title: 'สร้างวิดีโอ',
      desc1: 'เปลี่ยนภาพและบท',
      desc2: 'เป็นวิดีโอสุดสมจริง',
      imgSrc: videoCardImg,
      onClick: () => onOpenQuickGenerate('video')
    }
    ,
    {
      id: 'video-to-script',
      title: 'ถอดวิดีโอเป็นบท',
      desc1: 'เลือกวิดีโอจากเครื่อง',
      desc2: 'แปลงเสียงพูดเป็นบท',
      imgSrc: videoToScriptCardImg,
      onClick: () => {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('sala_open_video_to_script', '1');
        }
        onNavigate('director');
      }
    }
  ];

  return (
    <div className="min-h-screen text-white pb-28 pt-[max(env(safe-area-inset-top),8px)] px-3 sm:px-6 relative overflow-hidden app-sky font-sans">
      {/* Main Content Area */}
      <div className="max-w-xl mx-auto space-y-3.5 sm:space-y-4 relative z-10">
        {/* ============================================================== */}
        {/* 3) HEADER SECTION (MASTER REFERENCE LAYOUT)                    */}
        {/* Avatar -> Robot Logo -> SALA (White) -> AI (Neon) -> Pro -> 🔔 */}
        {/* ============================================================== */}
        <header className="flex items-center justify-between pt-1 pb-1 px-1">
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* 1. Avatar with Online Green Dot */}
            <div
              className="relative group cursor-pointer"
              onClick={() => onNavigate('pricing')}
              title="ดูโปรไฟล์"
            >
              <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-[#00D8FF] via-[#7B2CFF] to-[#FF35D4] shadow-[0_0_15px_rgba(0,216,255,0.6)]">
                {authUser?.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt={authUser.displayName || 'Avatar'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-[#07112A] flex items-center justify-center text-[16px] font-bold text-white">
                    {(authUser?.displayName || 'S').trim().slice(0, 1)}
                  </div>
                )}
              </div>
              {/* Online Green Dot on bottom right */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#00FF66] border-2 border-[#020716] rounded-full shadow-[0_0_8px_#00FF66]" />
            </div>

            {/* 2. Robot Mascot / Logo */}
            <div 
              className="w-10 h-10 flex items-center justify-center relative cursor-pointer group" 
              onClick={() => onNavigate('home')}
              title="ศาลาเอไอ (Sala AI)"
            >
              <div className="w-full h-full rounded-2xl overflow-hidden p-[1.5px] bg-gradient-to-tr from-[#00D8FF] via-[#7B2CFF] to-[#FF35D4] shadow-[0_0_15px_rgba(0,216,255,0.6)] group-hover:shadow-[0_0_22px_rgba(255,53,212,0.8)] transition-all duration-300">
                <img
                  src="/robot-mascot.svg"
                  alt="Sala AI Mascot"
                  className="w-full h-full object-cover rounded-[14px] transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            </div>

            {/* 3. Brand Text: SALA (White) + AI (Neon Cyan/Purple/Pink Glow) */}
            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => onNavigate('home')}>
              <span className="text-xl font-black tracking-wide text-[#FFFFFF] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                SALA
              </span>
              <span
                className="text-xl font-black tracking-wide bg-gradient-to-r from-[#00D8FF] via-[#7B2CFF] to-[#FF35D4] bg-clip-text [-webkit-background-clip:text] text-transparent [-webkit-text-fill-color:transparent]"
                style={{
                  filter: 'drop-shadow(0 0 10px rgba(0, 216, 255, 0.75)) drop-shadow(0 0 15px rgba(255, 53, 212, 0.5))'
                }}
              >
                AI
              </span>

              {/* 4. Pro Pill Badge (Vivid Pink-Purple) */}
              <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#FF35D4] via-[#FF4ECF] to-[#7B2CFF] text-[#FFFFFF] shadow-[0_0_12px_rgba(255,53,212,0.8)] border border-pink-300/60 ml-0.5">
                Pro
              </span>
            </div>
          </div>

          {isAdmin && (
            <a
              id="apk-download-admin"
              href="salaai://download-apk"
              className="relative z-20 pointer-events-auto mr-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-white border border-amber-400/70 bg-[#07112A]"
            >
              ดาวน์โหลด APK
            </a>
          )}
          {/* 5. Notification Bell (Pure White Icon) */}
          <button
            type="button"
            onClick={() => setShowNotificationModal(true)}
            className="w-10 h-10 rounded-2xl bg-[#07112A]/80 border border-[#7B2CFF]/40 hover:border-[#00D8FF]/70 backdrop-blur-xl flex items-center justify-center text-[#FFFFFF] hover:text-[#00D8FF] transition-all shadow-[0_0_15px_rgba(123,44,255,0.3)] relative active:scale-95"
            title="การแจ้งเตือน"
          >
            <Bell className="w-5 h-5 text-[#FFFFFF]" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-[#FF35D4] rounded-full ring-2 ring-[#020716] shadow-[0_0_8px_#FF35D4] animate-pulse" />
          </button>
        </header>

        {/* ============================================================== */}
        {/* 4) CREDIT BOX (MASTER REFERENCE STYLE)                         */}
        {/* Glassmorphism + Orange/Pink/Purple/Cyan Neon Glow Border       */}
        {/* Left: 3D Gold Coins + เครดิตของคุณ + 2,450                       */}
        {/* Right: เติมเครดิต + (Neon Cyan/Blue Border Button)               */}
        {/* ============================================================== */}
        <div className="relative group">
          {/* Neon Gradient Border Layer: Orange / Pink / Purple / Cyan */}
          <div
            className="p-[1.5px] rounded-[24px] bg-gradient-to-r from-[#F7C94A] via-[#FF35D4] via-[#7B2CFF] to-[#00D8FF]"
            style={{
              boxShadow: '0 0 30px rgba(123, 44, 255, 0.45), 0 0 15px rgba(255, 53, 212, 0.35)'
            }}
          >
            {/* Dark Translucent Glass Card */}
            <div className="bg-[#07112A]/85 backdrop-blur-2xl rounded-[22px] px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between border border-white/10">
              {/* Left Side: 3D Gold Coins Stack + Text + Balance */}
              <div className="flex items-center gap-3.5">
                {/* 3D Stack of Gold Coins Icon */}
                <div
                  className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FFD96A] via-[#F7C94A] to-[#B38300] flex items-center justify-center shrink-0 border border-[#FFE58F]/70"
                  style={{
                    boxShadow: '0 0 20px rgba(247, 201, 74, 0.65)'
                  }}
                >
                  <Coins className="w-6 h-6 text-[#1A1200] stroke-[2.4]" />
                </div>

                <div>
                  <span className="text-xs text-[#D8DDF0] font-medium block leading-tight tracking-wide">
                    เครดิตของคุณ
                  </span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-xl font-extrabold tracking-tight text-[#FFFFFF] font-mono drop-shadow-[0_0_12px_rgba(255,255,255,0.5)]">
                      {displayCredits}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: เติมเครดิต + (Cyan/Blue Neon Glowing Pill Button) */}
              <button
                type="button"
                id="home-topup-credits-btn"
                aria-expanded={topupOpen}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setTopupOpen(true);
                }}
                className="relative z-20 pointer-events-auto px-4 py-2 rounded-xl text-[16px] font-bold bg-[#0A1633]/90 hover:bg-[#07112A] text-[#FFFFFF] border-2 border-[#00D8FF] hover:border-[#4EDBFF] transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                style={{
                  boxShadow: '0 0 18px rgba(0, 216, 255, 0.55), inset 0 0 10px rgba(0, 216, 255, 0.25)'
                }}
              >
                <span>เติมเครดิต</span>
                <span className="text-[16px] font-bold text-[#00D8FF]">+</span>
              </button>
            </div>
          </div>
        </div>

        {topupOpen && (
          <form
            id="home-topup-request"
            className="relative z-20 rounded-2xl border border-[#00D8FF]/40 bg-[#07112A]/95 p-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submitTopupRequest();
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-slate-200">
                โอนเงินแล้วส่งสลิป แอดมินเป็นคนกำหนดจำนวนเครดิตและอนุมัติเท่านั้น ยังไม่เติมเข้าบัญชีเอง
              </p>
              <button
                type="button"
                id="home-topup-close"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closeTopupRequest();
                }}
                className="shrink-0 px-3 py-1.5 rounded-xl text-[16px] font-bold text-white border border-slate-500 bg-[#0A1633]"
              >
                ปิด
              </button>
            </div>
            <label className="block text-xs text-slate-300" htmlFor="topup-baht-input">
              จำนวนเงินที่โอน (บาท)
              <input
                id="topup-baht-input"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={bahtRequest}
                onChange={(event) => setBahtRequest(event.target.value)}
                placeholder="บาท"
                className="mt-1 w-full rounded-xl border border-slate-600 bg-[#030714] px-3 py-2 text-[16px] text-white"
              />
            </label>
            <label className="block text-xs text-slate-300" htmlFor="topup-slip-input">
              สลิปการโอน
              <input
                id="topup-slip-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="mt-1 block w-full text-xs text-slate-300"
                onChange={(event) => setSlipFile(event.target.files?.[0] || null)}
              />
            </label>
            <button
              type="submit"
              id="topup-submit-btn"
              disabled={topupBusy}
              className="px-4 py-2 rounded-xl text-[16px] font-bold text-slate-950 bg-[#00D8FF] disabled:opacity-60"
            >
              {topupBusy ? 'กำลังส่งคำขอ...' : 'ส่งคำขอและสลิป'}
            </button>
            {topupNote && <p className="text-sm text-amber-200">{topupNote}</p>}
          </form>
        )}

        {/* ============================================================== */}
        {/* 5) FULL STORY CARD (ช่อง "เนื้อเรื่องเต็ม" เฉพาะหน้าแรก)         */}
        {/* สำหรับวางบทตั้งแต่ต้นจนจบ แล้วกดบันทึก                              */}
        {/* AI อ่านและจำเนื้อเรื่องทั้งหมด วิเคราะห์จุดเปลี่ยนสถานที่            */}
        {/* และดึง "ฉากแรก" เข้าสู่ Story อัตโนมัติ                         */}
        {/* ============================================================== */}
        <div
          className="relative rounded-[26px] p-[1.5px] bg-gradient-to-r from-[#7B2CFF]/80 via-[#FF35D4]/70 to-[#00D8FF]/80 group transition-all duration-300"
          style={{
            boxShadow: '0 0 35px rgba(123, 44, 255, 0.35), 0 0 20px rgba(0, 216, 255, 0.25)'
          }}
        >
          <div className="relative rounded-[24px] overflow-hidden p-4 sm:p-5 bg-[#07112A]/95 backdrop-blur-2xl space-y-3.5">
            {/* Header: Title + Status Badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#7B2CFF] via-[#FF35D4] to-[#00D8FF] p-[1px] flex items-center justify-center shadow-[0_0_15px_rgba(123,44,255,0.6)]">
                  <div className="w-full h-full rounded-[15px] bg-[#07112A] flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-[#00D8FF]" />
                  </div>
                </div>
                <div>
                  <h2 className="text-[20px] sm:text-[22px] font-black text-white tracking-wide flex items-center gap-2">
                    <span>เนื้อเรื่องเต็ม</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#00D8FF]/15 text-[#00D8FF] border border-[#00D8FF]/30">
                      Master Full Story
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    วางบทตั้งแต่ต้นจนจบ AI จำเนื้อเรื่องและวิเคราะห์ดึงฉากตามสถานที่เข้า Story
                  </p>
                </div>
              </div>

              {/* Action buttons: Clear if has story */}
              {fullStoryInput.trim() && (
                <button
                  type="button"
                  onClick={handleClearFullStory}
                  className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/40 text-[16px] flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="ลบเนื้อเรื่องเต็ม"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">ลบเรื่องเดิม</span>
                </button>
              )}
            </div>

            {/* Notification alert */}
            {savedSuccessNotice && (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/70 to-teal-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2.5 shadow-lg animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="flex-1 font-medium">{savedSuccessNotice}</span>
              </div>
            )}

            {/* Story Textarea */}
            <div className="relative">
              <textarea
                value={fullStoryInput}
                onChange={(e) => setFullStoryInput(e.target.value)}
                rows={5}
                placeholder="วางเนื้อเรื่องเต็มตั้งแต่ต้นจนจบที่นี่ เช่น บทภาพยนตร์ทั้งเรื่อง, นิยายสั้น, หรือลำดับเหตุการณ์ทั้งหมด...

เมื่อกด 'บันทึกเนื้อเรื่องเต็ม' AI จะอ่านและจำเนื้อเรื่องทั้งหมด วิเคราะห์จุดเปลี่ยนสถานที่ และดึงฉากแรกในสถานที่นั้นเข้าสู่ระบบ Story อัตโนมัติ"
                className="w-full bg-[#030714]/90 border border-slate-700/80 focus:border-[#00D8FF] rounded-2xl p-3.5 text-[16px] text-slate-100 placeholder:text-slate-400 focus:outline-none transition-all leading-relaxed resize-none shadow-inner"
              />
              <div className="absolute right-3 bottom-3 text-xs text-slate-400 pointer-events-none">
                {fullStoryInput.length.toLocaleString()} ตัวอักษร
              </div>
            </div>

            {/* Analyzed Segments Status Badge if available */}
            {analyzedSegments.length > 0 && (
              <div className="p-2.5 rounded-xl bg-[#0b142c]/80 border border-indigo-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00FF66] shadow-[0_0_8px_#00FF66]" />
                  <span className="text-slate-300 font-medium">
                    วิเคราะห์พบ <strong className="text-[#00D8FF]">{analyzedSegments.length} สถานที่</strong> ในเนื้อเรื่องเต็ม
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  ฉากปัจจุบัน: <span className="text-pink-300 font-semibold">{analyzedSegments[currentFlowSegmentIndex - 1]?.locationName || analyzedSegments[0]?.locationName}</span> ({analyzedSegments[currentFlowSegmentIndex - 1]?.sceneRange || analyzedSegments[0]?.sceneRange})
                </div>
              </div>
            )}

            {/* Footer Buttons: Save Button + Go to Story Director Button */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
              <button
                type="button"
                id="btn-save-full-story"
                onClick={handleSaveFullStory}
                disabled={!fullStoryInput.trim()}
                className="w-full sm:flex-1 py-3 px-4 rounded-2xl font-bold text-[16px] text-white bg-gradient-to-r from-[#7B2CFF] via-[#FF35D4] to-[#00D8FF] hover:brightness-110 disabled:opacity-50 shadow-[0_0_20px_rgba(123,44,255,0.4)] border border-pink-400/40 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98]"
              >
                <Save className="w-4 h-4" />
                <span>บันทึกเนื้อเรื่องเต็ม & ดึงฉากแรกเข้า Story</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('director')}
                className="w-full sm:w-auto py-3 px-5 rounded-2xl font-semibold text-[16px] text-slate-200 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 hover:border-[#00D8FF]/60 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.98]"
              >
                <span>เปิดห้อง Story</span>
                <ChevronRight className="w-4 h-4 text-[#00D8FF]" />
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* 6) MAIN CARD GRID MENU                  */}
        {/* Strict Order: 1:วางบท, 2:แยกฉาก, 3:ตัวละคร, 4:สถานที่,         */}
        {/* 5:สร้างภาพ, 6:สร้างวิดีโอ, 7:ถอดวิดีโอเป็นบท              */}
        {/* ============================================================== */}
        <div className="pt-1">
          <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
            {menuCards.map((card) => {
              return (
                <div
                  key={card.id}
                  onClick={card.onClick}
                  className="home-menu-neon group relative w-full aspect-[2/1] rounded-[20px] overflow-hidden cursor-pointer transition-all duration-300 active:scale-[0.98] hover:scale-[1.02]"
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '20px',
                    aspectRatio: '2 / 1'
                  }}
                >
                  <img
                    src={card.imgSrc}
                    alt={card.title}
                    className="w-full h-full block select-none pointer-events-none"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center',
                      borderRadius: 'inherit'
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 7) NOTIFICATION MODAL                                          */}
      {/* ============================================================== */}
      {showNotificationModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#07112A] border-2 border-[#7B2CFF]/60 rounded-3xl p-5 max-w-sm w-full shadow-[0_0_40px_rgba(123,44,255,0.5)] backdrop-blur-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#FF35D4]" />
                <h3 className="font-bold text-[#FFFFFF] text-[20px]">การแจ้งเตือนระบบ</h3>
              </div>
              <button
                onClick={() => setShowNotificationModal(false)}
                className="text-[#D8DDF0] hover:text-white text-[16px] px-2.5 py-1 rounded-xl bg-[#0A1633] border border-slate-700"
              >
                ปิด
              </button>
            </div>
            <div className="space-y-2.5 text-xs text-[#D8DDF0]">
              <div className="p-3 rounded-2xl bg-[#0A1633]/80 border border-[#7B2CFF]/40">
                <p className="font-bold text-[#4EDBFF]">ยินดีต้อนรับสู่ SALA AI Pro</p>
                <p className="text-[#D8DDF0] text-xs mt-0.5">
                  พร้อมใช้งานระบบ Multi-Clip Director และ Character Lock สไตล์ Futuristic Sci-Fi
                </p>
              </div>
              <div className="p-3 rounded-2xl bg-[#0A1633]/80 border border-[#FF35D4]/40">
                <p className="font-bold text-[#A78BFA]">เครดิตพร้อมใช้งาน</p>
                <p className="text-[#D8DDF0] text-xs mt-0.5">
                  ยอดเครดิตจะแสดงเมื่อเข้าสู่ระบบและอ่านได้จาก Firestore เท่านั้น
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
