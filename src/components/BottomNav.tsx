import React from 'react';
import { Wand2, Clapperboard, UserCheck, Images, Coins, ShieldCheck, Film, Building } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCredits: () => void;
  isAdmin?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenCredits,
  isAdmin,
}) => {
  const tabs = [
    { id: 'director', label: 'ผู้กำกับคลิป', icon: Film },
    { id: 'characters', label: 'ตัวละคร', icon: UserCheck },
    { id: 'locations', label: 'สถานที่', icon: Building },
    { id: 'gallery', label: 'คลังผลงาน', icon: Images },
    ...(isAdmin ? [{ id: 'admin', label: 'แอดมิน', icon: ShieldCheck }] : []),
    { id: 'credits', label: 'เครดิต', icon: Coins, action: onOpenCredits },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#090d16]/95 backdrop-blur-lg border-t border-slate-800/90 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 px-2 shadow-2xl">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`bottom-nav-${tab.id}`}
              onClick={() => {
                if (tab.action) {
                  tab.action();
                } else {
                  setActiveTab(tab.id);
                }
              }}
              className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all ${
                isActive
                  ? 'text-indigo-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 active:scale-95'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 shadow-sm shadow-indigo-500/20'
                    : 'text-slate-400'
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[56px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
