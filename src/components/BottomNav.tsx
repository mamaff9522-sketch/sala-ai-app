import React from 'react';
import {
  Home,
  FolderKanban,
  Coins,
  User,
  MessageCircle
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
  const navItems = [
    { id: 'home', label: 'หน้าแรก', icon: Home },
    { id: 'projects', label: 'โปรเจกต์', icon: FolderKanban },
    // Center plus placeholder handled separately
    { id: 'pricing', label: 'เครดิต', icon: Coins, action: onOpenCredits },
    { id: 'profile', label: 'โปรไฟล์', icon: User }
  ];

  return (
    <>
      {/* Cyberpunk Glowing Bottom Navigation Bar (Master Reference) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#020716]/95 backdrop-blur-xl border-t border-[#7B2CFF]/30 pb-[max(env(safe-area-inset-bottom),4px)] pt-1 px-1 shadow-[0_-10px_35px_rgba(2,7,22,0.9)]">
        <div className="max-w-xl mx-auto flex items-center justify-between relative">
          {/* 1. หน้าแรก (Home) - reflective cyan ring, same family as the center plus */}
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center flex-1 py-0.5 transition-all ${
              activeTab === 'home'
                ? 'text-[#00D8FF] font-bold'
                : 'text-[#FFFFFF] hover:text-[#00D8FF] active:scale-95'
            }`}
          >
            <div
              className={`rounded-2xl p-[2px] transition-all ${
                activeTab === 'home'
                  ? 'bg-gradient-to-tr from-[#00D8FF] via-[#1E90FF] to-[#7B2CFF]'
                  : 'bg-transparent'
              }`}
              style={
                activeTab === 'home'
                  ? { boxShadow: '0 0 16px rgba(0, 216, 255, 0.8), 0 0 28px rgba(30, 144, 255, 0.4)' }
                  : undefined
              }
            >
              <div className={`p-0.5 rounded-[10px] ${activeTab === 'home' ? 'bg-[#07112A] text-white' : ''}`}>
                <Home className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight font-medium whitespace-nowrap leading-none">หน้าแรก</span>
          </button>

          {/* 2. โปรเจกต์ */}
          <button
            onClick={() => setActiveTab('projects')}
            className={`flex flex-col items-center justify-center flex-1 py-0.5 transition-all ${
              activeTab === 'projects'
                ? 'text-[#00D8FF] font-bold drop-shadow-[0_0_10px_rgba(0,216,255,0.7)]'
                : 'text-[#FFFFFF] hover:text-[#00D8FF] active:scale-95'
            }`}
          >
            <div
              className={`p-0.5 rounded-md transition-all ${
                activeTab === 'projects'
                  ? 'bg-[#00D8FF]/20 text-[#00D8FF] shadow-[0_0_15px_rgba(0,216,255,0.5)] border border-[#00D8FF]/40'
                  : ''
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5 text-current" />
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight font-medium whitespace-nowrap leading-none">โปรเจกต์</span>
          </button>

          {/* แชท */}
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center justify-center flex-1 py-0.5 transition-all ${
              activeTab === 'chat'
                ? 'text-[#C084FC] font-bold drop-shadow-[0_0_10px_rgba(192,132,252,0.7)]'
                : 'text-[#FFFFFF] hover:text-[#C084FC] active:scale-95'
            }`}
          >
            <div
              className={`p-0.5 rounded-md transition-all ${
                activeTab === 'chat'
                  ? 'bg-[#C084FC]/20 text-[#C084FC] shadow-[0_0_15px_rgba(192,132,252,0.5)] border border-[#C084FC]/40'
                  : ''
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5 text-current" />
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight font-medium whitespace-nowrap leading-none">แชท</span>
          </button>

          {/* 4. เครดิต (Credits) - Solid White */}
          <button
            onClick={() => setActiveTab('pricing')}
            className={`flex flex-col items-center justify-center flex-1 py-0.5 transition-all ${
              activeTab === 'pricing'
                ? 'text-[#F7C94A] font-bold drop-shadow-[0_0_10px_rgba(247,201,74,0.7)]'
                : 'text-[#FFFFFF] hover:text-[#F7C94A] active:scale-95'
            }`}
          >
            <div
              className={`p-0.5 rounded-md transition-all ${
                activeTab === 'pricing'
                  ? 'bg-[#F7C94A]/20 text-[#F7C94A] shadow-[0_0_15px_rgba(247,201,74,0.5)] border border-[#F7C94A]/40'
                  : ''
              }`}
            >
              <Coins className="w-3.5 h-3.5 text-current" />
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight font-medium whitespace-nowrap leading-none">เครดิต</span>
          </button>

          {/* 5. โปรไฟล์ (Profile) - Solid White */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center justify-center flex-1 py-0.5 transition-all ${
              activeTab === 'profile'
                ? 'text-[#A78BFA] font-bold drop-shadow-[0_0_10px_rgba(167,139,250,0.7)]'
                : 'text-[#FFFFFF] hover:text-[#A78BFA] active:scale-95'
            }`}
          >
            <div
              className={`p-0.5 rounded-md transition-all ${
                activeTab === 'profile'
                  ? 'bg-[#A78BFA]/20 text-[#A78BFA] shadow-[0_0_15px_rgba(167,139,250,0.5)] border border-[#A78BFA]/40'
                  : ''
              }`}
            >
              <User className="w-3.5 h-3.5 text-current" />
            </div>
            <span className="text-[11px] mt-0.5 tracking-tight font-medium whitespace-nowrap leading-none">โปรไฟล์</span>
          </button>
        </div>
      </nav>
    </>
  );
};
