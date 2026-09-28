import React from 'react';
import { Coins, ShieldAlert, Cpu, Layers, User as UserIcon, Image as ImageIcon, LogIn, LogOut, Key, Loader2, PlusCircle } from 'lucide-react';
import { CreditAccount, ProviderInfo, ProviderId } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  credits: CreditAccount | null;
  providers: ProviderInfo[];
  selectedProvider: ProviderId;
  onOpenCredits: () => void;
  authUser?: any;
  onLogin?: () => void;
  onLogout?: () => void;
  onOpenApiKeyModal?: () => void;
  isLoggingIn?: boolean;
  isAdmin?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  credits,
  providers,
  selectedProvider,
  onOpenCredits,
  authUser,
  onLogin,
  onLogout,
  onOpenApiKeyModal,
  isLoggingIn,
  isAdmin,
}) => {
  const currentProvider = providers.find(p => p.id === selectedProvider);

  return (
    <header className="sticky top-0 z-40 bg-[#090d16]/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand & Logo */}
        <div
          onClick={() => setActiveTab('director')}
          className="flex items-center gap-2.5 cursor-pointer group"
          id="nav-brand-logo"
        >
          <img
            src="/logo.png"
            alt="Sala AI"
            className="w-10 h-10 rounded-xl object-cover shadow-lg group-hover:scale-105 transition-transform"
          />
          <span className="font-bold text-xl text-white tracking-wide">
            SALA AI
          </span>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab('director')}
            id="nav-desktop-director"
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'director'
                ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-600 text-white shadow-lg shadow-indigo-600/25 ring-1 ring-white/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <span>ผู้กำกับหลายคลิป</span>
            <span className="text-[9px] bg-emerald-500/25 text-emerald-300 px-1.5 py-0.5 rounded font-bold border border-emerald-500/30">
              Continuity Engine
            </span>
          </button>
          <button
            onClick={() => setActiveTab('characters')}
            id="nav-desktop-characters"
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'characters'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            ตัวละคร (Character Lock)
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            id="nav-desktop-locations"
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'locations'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <span>สถานที่</span>
            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
              Lock
            </span>
          </button>
          <button
            onClick={() => setActiveTab('gallery')}
            id="nav-desktop-gallery"
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'gallery'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            คลังผลงาน
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              id="nav-desktop-admin"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'admin'
                  ? 'bg-amber-600/90 text-white shadow-sm'
                  : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800/60'
              }`}
            >
              แดชบอร์ดแอดมิน
            </button>
          )}
          <button
            onClick={() => setActiveTab('pricing')}
            id="nav-desktop-pricing"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'pricing'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-amber-400/90 hover:text-amber-300 hover:bg-amber-500/10'
            }`}
          >
            เติมเครดิต / ราคา
          </button>
        </nav>

        {/* Right Info: Provider Badge + Credits Pill */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Provider Pill */}
          {currentProvider && (
            <div 
              title={currentProvider.isMock ? 'โหมดจำลอง (Mock Simulator)' : 'เชื่อมต่อ API สำเร็จ'}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-slate-900 border-slate-800 text-slate-300"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span className="truncate max-w-[120px]">{currentProvider.name}</span>
              {currentProvider.isMock ? (
                <span className="text-[10px] text-amber-400 font-mono bg-amber-400/10 px-1 rounded">Mock</span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
          )}

          {/* Credits Balance Pill */}
          <button
            onClick={onOpenCredits}
            id="nav-credits-btn"
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-amber-500/5 hover:from-amber-500/20 hover:to-amber-500/15 border border-amber-500/30 text-amber-300 px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95"
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <div className="text-left">
              <span className="text-[11px] block leading-none text-amber-300/80">เครดิต</span>
              <span className="text-sm font-bold leading-none font-mono">
                {credits !== null && credits !== undefined && typeof credits.remainingCredits === 'number'
                  ? credits.remainingCredits
                  : 100}
              </span>
            </div>
          </button>

          {/* เติมเครดิต (Stripe Checkout) Button */}
          <button
            onClick={() => setActiveTab('pricing')}
            id="nav-topup-credits-btn"
            title="เติมเครดิตผ่าน Stripe"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-md shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">เติมเครดิต</span>
          </button>

          {/* Firebase Authentication & User Profile */}
          {authUser ? (
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenApiKeyModal}
                id="nav-user-apikey-btn"
                title="จัดการ API Key ใน Firestore"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border bg-slate-900/90 border-slate-700 hover:border-indigo-500 text-slate-200 transition-all active:scale-95"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">API Key</span>
              </button>

              <div className="flex items-center gap-2 pl-1 bg-slate-900/80 border border-slate-800 rounded-xl px-2.5 py-1 shadow-sm">
                {authUser.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt={authUser.displayName || 'User avatar'}
                    referrerPolicy="no-referrer"
                    className="w-7 h-7 rounded-full border border-indigo-500/60 object-cover shadow-sm ring-1 ring-indigo-500/30"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 border border-indigo-400/50 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                    {(authUser.displayName || authUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="block text-left">
                  <span className="text-xs font-semibold text-white block truncate max-w-[90px] sm:max-w-[130px] leading-tight">
                    {authUser.displayName || 'ผู้ใช้ Google'}
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:block truncate max-w-[130px] leading-tight">
                    {authUser.email || ''}
                  </span>
                </div>
                <button
                  onClick={onLogout}
                  id="nav-logout-btn"
                  title="ออกจากระบบ"
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-all ml-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onLogin}
              id="nav-login-google-btn"
              disabled={isLoggingIn}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl shadow-md shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5.1 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2s.7 5.5 1.9 7.9l3.7-2.9c-.2-.7-.4-1.5-.4-2.4z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16c1.8 3.7 5.6 7 10.1 7z"
                  />
                </svg>
              )}
              <span className="hidden sm:inline">{isLoggingIn ? 'กำลังเชื่อมต่อ...' : 'เข้าสู่ระบบด้วย Google'}</span>
              <span className="sm:hidden">{isLoggingIn ? '...' : 'เข้าสู่ระบบ'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
