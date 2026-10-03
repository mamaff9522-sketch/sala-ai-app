import React, { useState } from 'react';
import {
  Home,
  FolderKanban,
  Plus,
  Coins,
  User,
  Sparkles,
  FileText,
  Clapperboard,
  UserCheck,
  Building,
  Image as ImageIcon,
  Video,
  X
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCredits: () => void;
  onOpenNewCharacterModal: () => void;
  onOpenNewLocationModal: () => void;
  onOpenQuickGenerate: (type: 'image' | 'video') => void;
  isAdmin?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenCredits,
  onOpenNewCharacterModal,
  onOpenNewLocationModal,
  onOpenQuickGenerate,
  isAdmin
}) => {
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);

  const navItems = [
    { id: 'home', label: 'หน้าแรก', icon: Home },
    { id: 'director', label: 'โปรเจกต์', icon: FolderKanban },
    // Center plus placeholder handled separately
    { id: 'pricing', label: 'เครดิต', icon: Coins, action: onOpenCredits },
    { id: 'profile', label: 'โปรไฟล์', icon: User }
  ];

  return (
    <>
      {/* Center (+) Floating Action Sheet / Modal */}
      {isPlusMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-[#0e0d1f] border-t sm:border border-purple-500/30 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">สร้างสรรค์ผลงานใหม่</h3>
                  <p className="text-[10px] text-slate-400">เลือกประเภทงานที่ต้องการสร้าง</p>
                </div>
              </div>
              <button
                onClick={() => setIsPlusMenuOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Creation Options Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  setActiveTab('director');
                }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/50 hover:bg-purple-950/20 text-left transition-all active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">วางบท / โปรเจกต์</span>
                  <span className="text-[10px] text-slate-400">เขียนบทด้วย AI</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  setActiveTab('director');
                }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-pink-500/50 hover:bg-pink-950/20 text-left transition-all active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
                  <Clapperboard className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">แยกฉาก / ช็อต</span>
                  <span className="text-[10px] text-slate-400">จัดสตอรี่บอร์ด</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  onOpenNewCharacterModal();
                  setActiveTab('characters');
                }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-orange-500/50 hover:bg-orange-950/20 text-left transition-all active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center text-orange-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">สร้างตัวละคร</span>
                  <span className="text-[10px] text-slate-400">Character Lock</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  onOpenNewLocationModal();
                  setActiveTab('locations');
                }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 hover:bg-cyan-950/20 text-left transition-all active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">สร้างสถานที่</span>
                  <span className="text-[10px] text-slate-400">Location Lock</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  onOpenQuickGenerate('image');
                }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-fuchsia-500/50 hover:bg-fuchsia-950/20 text-left transition-all active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-fuchsia-600/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">สร้างภาพ AI</span>
                  <span className="text-[10px] text-slate-400">ภาพคุณภาพสูง</span>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsPlusMenuOpen(false);
                  onOpenQuickGenerate('video');
                }}
                className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-950/20 text-left transition-all active:scale-98"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-white block">สร้างวิดีโอ AI</span>
                  <span className="text-[10px] text-slate-400">วิดีโอต่อเนื่อง</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cyberpunk Glowing Bottom Navigation Bar (Master Reference) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#020716]/95 backdrop-blur-xl border-t border-[#7B2CFF]/30 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 px-3 shadow-[0_-10px_35px_rgba(2,7,22,0.9)]">
        <div className="max-w-xl mx-auto flex items-center justify-between relative">
          {/* 1. หน้าแรก (Home) - Active Purple/Magenta Glow */}
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              activeTab === 'home'
                ? 'text-[#FF35D4] font-bold drop-shadow-[0_0_10px_rgba(255,53,212,0.7)]'
                : 'text-[#FFFFFF] hover:text-[#FF35D4] active:scale-95'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'home'
                  ? 'bg-gradient-to-tr from-[#7B2CFF]/30 to-[#FF35D4]/30 text-[#FF35D4] shadow-[0_0_18px_rgba(255,53,212,0.6)] border border-[#FF35D4]/40'
                  : ''
              }`}
            >
              <Home className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">หน้าแรก</span>
          </button>

          {/* 2. โปรเจกต์ (Projects / Director) - Solid White */}
          <button
            onClick={() => setActiveTab('director')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              activeTab === 'director'
                ? 'text-[#00D8FF] font-bold drop-shadow-[0_0_10px_rgba(0,216,255,0.7)]'
                : 'text-[#FFFFFF] hover:text-[#00D8FF] active:scale-95'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'director'
                  ? 'bg-[#00D8FF]/20 text-[#00D8FF] shadow-[0_0_15px_rgba(0,216,255,0.5)] border border-[#00D8FF]/40'
                  : ''
              }`}
            >
              <FolderKanban className="w-5 h-5 text-current" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">โปรเจกต์</span>
          </button>

          {/* 3. Center Glowing (+) Button - Neon Blue/Cyan Raised Circle */}
          <div className="flex-1 flex justify-center -mt-6">
            <button
              onClick={() => setIsPlusMenuOpen(true)}
              className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#00D8FF] via-[#1E90FF] to-[#7B2CFF] p-[2.5px] cursor-pointer group active:scale-90 transition-all"
              style={{
                boxShadow: '0 0 25px rgba(0, 216, 255, 0.8), 0 0 45px rgba(30, 144, 255, 0.5)'
              }}
              title="สร้างใหม่"
            >
              <div className="w-full h-full rounded-full bg-[#07112A] group-hover:bg-gradient-to-tr group-hover:from-[#00D8FF] group-hover:to-[#1E90FF] flex items-center justify-center transition-all">
                <Plus className="w-6 h-6 text-[#FFFFFF] stroke-[3]" />
              </div>
            </button>
          </div>

          {/* 4. เครดิต (Credits) - Solid White */}
          <button
            onClick={() => {
              if (onOpenCredits) onOpenCredits();
              else setActiveTab('pricing');
            }}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              activeTab === 'pricing'
                ? 'text-[#F7C94A] font-bold drop-shadow-[0_0_10px_rgba(247,201,74,0.7)]'
                : 'text-[#FFFFFF] hover:text-[#F7C94A] active:scale-95'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'pricing'
                  ? 'bg-[#F7C94A]/20 text-[#F7C94A] shadow-[0_0_15px_rgba(247,201,74,0.5)] border border-[#F7C94A]/40'
                  : ''
              }`}
            >
              <Coins className="w-5 h-5 text-current" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">เครดิต</span>
          </button>

          {/* 5. โปรไฟล์ (Profile) - Solid White */}
          <button
            onClick={() => setActiveTab('pricing')}
            className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
              activeTab === 'profile'
                ? 'text-[#FF35D4] font-bold drop-shadow-[0_0_10px_rgba(255,53,212,0.7)]'
                : 'text-[#FFFFFF] hover:text-[#FF35D4] active:scale-95'
            }`}
          >
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeTab === 'profile'
                  ? 'bg-[#FF35D4]/20 text-[#FF35D4] shadow-[0_0_15px_rgba(255,53,212,0.5)] border border-[#FF35D4]/40'
                  : ''
              }`}
            >
              <User className="w-5 h-5 text-current" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">โปรไฟล์</span>
          </button>
        </div>
      </nav>
    </>
  );
};
