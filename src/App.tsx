import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { CharacterLibrary } from './components/CharacterLibrary';
import { LocationLibrary } from './components/LocationLibrary';
import { MultiClipDirector } from './components/MultiClipDirector';
import { GalleryModal } from './components/GalleryModal';
import { CreditsModal } from './components/CreditsModal';
import { AdminDashboard } from './components/AdminDashboard';
import { Admin } from './pages/Admin';
import { Pricing } from './pages/Pricing';
import { ActiveJobBanner } from './components/ActiveJobBanner';
import { HomeDashboard } from './components/HomeDashboard';
import { ProjectList } from './components/ProjectList';
import { ChatRoom } from './components/ChatRoom';
import { QuickGenerateModal } from './components/QuickGenerateModal';
import {
  Character,
  LocationItem,
  CreditAccount,
  GenerationJob,
  MediaType,
  ProviderId,
  ProviderInfo,
  AspectRatio
} from './types';
import { api } from './services/api';
import { splitScript, scriptSplitter } from './services/scriptSplitter';
import {
  loginWithGoogle,
  switchGoogleAccount,
  logout,
  onAuthStateChange,
  getStoredUserAsUser,
  getStoredUser,
  fetchUserRole,
  auth
} from './services/auth';
import { goBackOnePage, isAppUnlocked } from './services/appAccess';
import type { User } from 'firebase/auth';
import { X, Play, Download, AlertCircle, RefreshCw, Loader2, CheckCircle2, ShieldCheck, LogOut, Users } from 'lucide-react';
import { downloadMediaFile } from './utils/download';
import { saveLibraryLockCache, clearLibraryLockCache, saveLocationLockCache, clearLocationLockCache } from './services/characterLibraryLock';
import { DEFAULT_SAMPLE_CHARACTERS } from './services/characterService';
import { DEFAULT_SAMPLE_LOCATIONS } from './services/locationService';

export default function App() {
  // Firebase Authentication & Role State
  const [authUser, setAuthUser] = useState<User | null | undefined>(undefined);
  const [userRole, setUserRole] = useState<'admin' | 'user'>(() => {
    const stored = getStoredUser();
    return stored?.role === 'admin' ? 'admin' : 'user';
  });

  // แสดงเมนู Admin และเข้าถึงหน้า /admin เฉพาะเมื่อผู้ใช้ล็อกอินและมี role === "admin" จาก Firestore เท่านั้น
  const isAdmin = Boolean(authUser && userRole === 'admin');

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = getStoredUser();
      const initialIsAdmin = stored?.role === 'admin';
      if (window.location.pathname.startsWith('/admin')) {
        if (!initialIsAdmin) {
          window.history.replaceState(null, '', '/');
          return 'home';
        }
        return 'admin';
      }
      if (window.location.pathname.startsWith('/pricing')) return 'pricing';
    }
    return 'home';
  });

  // Sync URL pathname with activeTab and enforce admin authorization
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.startsWith('/admin')) {
        if (isAdmin) {
          setActiveTab('admin');
        } else {
          setActiveTab('home');
          window.history.replaceState(null, '', '/');
        }
      } else if (window.location.pathname.startsWith('/pricing')) {
        setActiveTab('pricing');
      } else {
        setActiveTab((prev) => (prev === 'admin' || prev === 'pricing' ? 'home' : prev));
      }
    };

    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/admin')) {
        if (isAdmin) {
          if (activeTab !== 'admin') setActiveTab('admin');
        } else {
          if (activeTab === 'admin') setActiveTab('home');
          window.history.replaceState(null, '', '/');
        }
      } else if (window.location.pathname.startsWith('/pricing') && activeTab !== 'pricing') {
        setActiveTab('pricing');
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAdmin, activeTab]);

  // ป้องกัน /admin route ถ้าไม่ใช่ admin ให้ redirect กลับหน้าหลักทันที
  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      setActiveTab('home');
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
        window.history.replaceState(null, '', '/');
      }
    }
  }, [activeTab, isAdmin]);

  const tabHistoryRef = useRef<string[]>([]);

  const handleBack = () => {
    if (!isAppUnlocked(authUser)) return false;
    const step = goBackOnePage(tabHistoryRef.current);
    tabHistoryRef.current = step.history;
    if (!step.page) return false;
    setActiveTab(step.page);
    const previous = step.page;
    if (typeof window === 'undefined') return true;
    if (previous === 'admin') {
      if (window.location.pathname !== '/admin') window.history.pushState(null, '', '/admin');
    } else if (previous === 'pricing') {
      if (window.location.pathname !== '/pricing') window.history.pushState(null, '', '/pricing');
    } else if (window.location.pathname === '/admin' || window.location.pathname === '/pricing') {
      window.history.pushState(null, '', '/');
    }
    return true;
  };

  const handleBackRef = useRef(handleBack);
  handleBackRef.current = handleBack;
  useEffect(() => {
    (window as unknown as { salaGoBackOne?: () => boolean }).salaGoBackOne = () => Boolean(handleBackRef.current());
  }, []);

  const handleTabChange = (tab: string) => {
    if (!isAppUnlocked(authUser)) return;
    if (tab === 'admin' && !isAdmin) {
      // Prevent non-admins from switching to admin tab
      setActiveTab('home');
      if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
        window.history.replaceState(null, '', '/');
      }
      return;
    }

    if (tab !== activeTab) {
      tabHistoryRef.current = [...tabHistoryRef.current, activeTab].slice(-30);
    }

    setActiveTab(tab);
    if (typeof window !== 'undefined') {
      if (tab === 'admin') {
        if (window.location.pathname !== '/admin') {
          window.history.pushState(null, '', '/admin');
        }
      } else if (tab === 'pricing') {
        if (window.location.pathname !== '/pricing') {
          window.history.pushState(null, '', '/pricing');
        }
      } else {
        if (window.location.pathname === '/admin' || window.location.pathname === '/pricing') {
          window.history.pushState(null, '', '/');
        }
      }
    }
  };

  // Core Data
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId>('gemini');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [credits, setCredits] = useState<CreditAccount | null>(null);

  // Active Jobs Polling
  const [activeJobs, setActiveJobs] = useState<GenerationJob[]>([]);

  // Modals
  const [isCreditsModalOpen, setIsCreditsModalOpen] = useState(false);
  const [isNewCharModalOpen, setIsNewCharModalOpen] = useState(false);
  const [isNewLocModalOpen, setIsNewLocModalOpen] = useState(false);

  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Selected Output Modal for video/image viewing
  const [viewingOutput, setViewingOutput] = useState<{ url: string; type: MediaType } | null>(null);
  const [videoPlayError, setVideoPlayError] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  // Studio transfer state
  const [studioInitialCharacterId, setStudioInitialCharacterId] = useState<string | undefined>();
  const [studioInitialLocationId, setStudioInitialLocationId] = useState<string | undefined>();
  const [studioInitialSceneContinuityRef, setStudioInitialSceneContinuityRef] = useState<string | undefined>();
  const [studioInitialPrompt, setStudioInitialPrompt] = useState<string | undefined>();

  // Quick Generate modal state
  const [isQuickGenOpen, setIsQuickGenOpen] = useState<boolean>(false);
  const [quickGenType, setQuickGenType] = useState<'image' | 'video'>('image');

  const handleQuickGenerate = async (params: {
    prompt: string;
    type: MediaType;
    aspectRatio: AspectRatio;
    characterId?: string;
    locationId?: string;
    durationSeconds?: number;
  }) => {
    try {
      const res = await api.startGeneration({
        ...params,
        model: params.type === 'video' ? 'veo-3.1-lite-generate-preview' : 'gemini-3.1-flash-lite-image',
        provider: selectedProvider || 'mock'
      });
      if (res && res.job) {
        handleGenerationStarted(res.job.id);
        setActiveJobs(prev => [res.job, ...prev]);
        if (typeof res.remainingCredits === 'number') {
          setCredits(prev => prev ? { ...prev, remainingCredits: res.remainingCredits } : null);
        }
      }
    } catch (err: any) {
      alert('ไม่สามารถเริ่มการสร้างได้: ' + (err?.message || 'ข้อผิดพลาดเครือข่าย'));
    }
  };

  // Fetch initial data with smooth mock fallback
  const loadInitialData = async () => {
    try {
      const [provData, chars, allJobs, creds, locs] = await Promise.all([
        api.getProviders().catch(() => ({ success: true, providers: [] })),
        api.getCharacters().catch(() => DEFAULT_SAMPLE_CHARACTERS),
        api.getAllJobs().catch(() => []),
        api.getCredits().catch(() => null),
        api.getLocations().catch(() => DEFAULT_SAMPLE_LOCATIONS)
      ]);

      setProviders(provData.providers || []);
      setCharacters(chars && chars.length > 0 ? chars : DEFAULT_SAMPLE_CHARACTERS);
      setLocations(locs && locs.length > 0 ? locs : DEFAULT_SAMPLE_LOCATIONS);
      setJobs(allJobs || []);
      setCredits(creds);

      const running = (allJobs || []).filter(j => j.status === 'processing' || j.status === 'queued');
      setActiveJobs(running);
    } catch (err) {
      console.error('Failed to load initial data:', err);
      setCharacters(DEFAULT_SAMPLE_CHARACTERS);
      setLocations(DEFAULT_SAMPLE_LOCATIONS);
    }
  };

  // Keep a lock-data copy of the signed-in user's character library on this device, so offline
  // Multi-Clip prompts still use the library if the session is lost (cleared on explicit logout)
  useEffect(() => {
    const uid = auth.currentUser?.uid || getStoredUser()?.uid;
    if (uid && characters.length > 0) saveLibraryLockCache(uid, characters);
  }, [characters]);

  // Same for the location library (Location Lock): only the signed-in user's own cards
  useEffect(() => {
    const uid = auth.currentUser?.uid || getStoredUser()?.uid;
    const own = uid ? locations.filter(l => l.userId === uid) : [];
    if (uid && own.length > 0) saveLocationLockCache(uid, own);
  }, [locations]);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (user) => {
      if (user) {
        setAuthUser(user);
        loadInitialData();
        let role: 'admin' | 'user' = 'user';
        try {
          role = await fetchUserRole(user.uid);
          setUserRole(role);
        } catch (err) {
          console.warn('Could not fetch user role:', err);
          setUserRole('user');
        }
        if (role !== 'admin' && typeof localStorage !== 'undefined') {
          localStorage.removeItem('sala_gemini_api_key');
          localStorage.removeItem('sala_meta_api_key');
          localStorage.removeItem('sala_xai_api_key');
        }
      } else {
        // เมื่อไม่ได้ล็อกอิน ให้คืนค่า null ชัดเจน เพื่อให้ผู้ใช้สามารถกดเข้าสู่ระบบหรือสลับบัญชีได้
        setAuthUser(null);
        setUserRole('user');
        setCharacters([]);
        setLocations([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLoginGoogle = async () => {
    setIsLoggingIn(true);
    try {
      const user = await loginWithGoogle();
      if (user) {
        setAuthUser(user);
        const role = await fetchUserRole(user.uid);
        setUserRole(role);
        loadInitialData();
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        alert('เข้าสู่ระบบไม่สำเร็จ: ' + (err?.message || 'โปรดลองใหม่อีกครั้ง'));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSwitchAccount = async () => {
    setIsLoggingIn(true);
    try {
      const user = await switchGoogleAccount();
      if (user) {
        setAuthUser(user);
        const role = await fetchUserRole(user.uid);
        setUserRole(role);
        loadInitialData();
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        alert('สลับบัญชีไม่สำเร็จ: ' + (err?.message || 'โปรดลองใหม่อีกครั้ง'));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      clearLibraryLockCache();
      clearLocationLockCache();
      setAuthUser(null);
      setUserRole('user');
      setCharacters([]);
      setLocations([]);
      if (activeTab === 'admin') {
        setActiveTab('home');
        if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
          window.history.replaceState(null, '', '/');
        }
      }
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const handleGenerationStarted = async (jobId: string) => {
    try {
      const newJob = await api.getJob(jobId);
      setActiveJobs(prev => [...prev.filter(j => j.id !== jobId), newJob]);
      api.getCredits().then(setCredits);
    } catch (err) {
      console.error('Error fetching newly started job:', err);
    }
  };

  const handleDismissJob = (jobId: string) => {
    setActiveJobs(prev => prev.filter(j => j.id !== jobId));
  };

  const handleUseCharacterInStudio = (charId: string) => {
    setStudioInitialCharacterId(charId);
    handleTabChange('director');
  };

  const handleUsePromptInStudio = (promptText: string, charId?: string) => {
    setStudioInitialPrompt(promptText);
    if (charId) setStudioInitialCharacterId(charId);
    handleTabChange('director');
  };

  const handleRefreshCharacters = async (savedChar?: Character) => {
    if (savedChar) {
      setCharacters(prev => {
        const filtered = prev.filter(c => c.id !== savedChar.id);
        return [savedChar, ...filtered];
      });
    }
    try {
      const refreshed = await api.getCharacters();
      if (refreshed && refreshed.length > 0) {
        if (savedChar) {
          const exists = refreshed.some(c => c.id === savedChar.id);
          if (!exists) {
            setCharacters([savedChar, ...refreshed]);
            return;
          }
        }
        setCharacters(refreshed);
      }
    } catch (err) {
      console.warn('Failed to refresh characters from remote:', err);
    }
  };

  const handleUseLocationInStudio = (locationId: string) => {
    // Re-trigger the selection even when the same card is sent again (Director effect keys on the id)
    setStudioInitialLocationId(undefined);
    setTimeout(() => setStudioInitialLocationId(locationId), 0);
    handleTabChange('director');
  };

  const handleRefreshLocations = async (savedLoc?: LocationItem) => {
    if (savedLoc) {
      setLocations(prev => {
        const filtered = prev.filter(l => l.id !== savedLoc.id);
        return [savedLoc, ...filtered];
      });
    }
    try {
      const refreshed = await api.getLocations();
      if (refreshed && refreshed.length > 0) {
        if (savedLoc) {
          const exists = refreshed.some(l => l.id === savedLoc.id);
          if (!exists) {
            setLocations([savedLoc, ...refreshed]);
            return;
          }
        }
        setLocations(refreshed);
      }
    } catch (err) {
      console.warn('Failed to refresh locations from remote:', err);
    }
  };

  if (authUser === undefined) {
    return (
      <div className="min-h-screen app-sky text-slate-100 flex items-center justify-center px-6">
        <p className="text-[16px]">กำลังตรวจสอบการเข้าสู่ระบบ...</p>
      </div>
    );
  }

  if (!isAppUnlocked(authUser)) {
    return (
      <div className="min-h-screen app-sky text-slate-100 flex flex-col items-center justify-center px-6 gap-5">
        <h1 className="text-2xl font-black tracking-wide">SALA AI</h1>
        <p className="text-[16px] text-center text-slate-300">ต้องเข้าสู่ระบบก่อน ปุ่มและฟีเจอร์อื่นยังใช้ไม่ได้</p>
        <button
          type="button"
          onClick={handleLoginGoogle}
          disabled={isLoggingIn}
          className="px-6 py-3 rounded-2xl font-bold text-[16px] text-white bg-gradient-to-r from-[#7B2CFF] to-[#00D8FF] disabled:opacity-60"
        >
          {isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-sky text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        credits={credits}
        providers={providers}
        selectedProvider={selectedProvider}
        onOpenCredits={() => setIsCreditsModalOpen(true)}
        authUser={authUser}
        onLogin={handleLoginGoogle}
        onLogout={handleLogout}
        onSwitchAccount={handleSwitchAccount}
        isLoggingIn={isLoggingIn}
        isAdmin={isAdmin}
      />

      {/* Google Authentication & Cloud Sync Bar */}
      {activeTab !== 'home' && (
        <div className="w-full max-w-7xl mx-auto px-4 pt-3 pb-1">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm backdrop-blur-sm">
          {authUser && authUser.uid !== 'demo_creator' ? (
            <div className="flex items-center gap-3">
              {authUser.photoURL ? (
                <img
                  src={authUser.photoURL}
                  alt={authUser.displayName || 'Google Profile'}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full border border-emerald-500/60 object-cover shadow-sm ring-2 ring-emerald-500/20"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-emerald-500 border border-emerald-400/50 flex items-center justify-center text-sm font-bold text-white shadow-sm">
                  {(authUser.displayName || authUser.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">
                    {authUser.displayName || 'ผู้ใช้ Google'}
                  </span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> เข้าสู่ระบบแล้ว
                  </span>
                  {isAdmin && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-400" /> แอดมิน (Admin)
                    </span>
                  )}
                  {isAdmin && (
                    <button
                      type="button"
                      id="btn-open-admin"
                      onClick={() => handleTabChange('admin')}
                      className="text-[16px] bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-300 px-3 py-1 rounded-full font-bold cursor-pointer"
                    >
                      เปิดหน้าแอดมิน
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                  <span>{authUser.email || ''}</span>
                  <span className="font-mono text-[10px] text-slate-500 hidden sm:inline">(UID: {authUser.uid.slice(0, 8)}...)</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
              </div>
              <div>
                <div className="font-semibold text-white text-xs sm:text-sm">เข้าสู่ระบบ Sala AI ด้วย Google</div>
                <div className="text-slate-400 text-[11px]">ล็อกอินเพื่อบันทึกงานสร้าง คาแรกเตอร์ และสถานที่</div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {authUser && authUser.uid !== 'demo_creator' ? (
              <>
                <button
                  type="button"
                  id="btn-app-switch-account"
                  onClick={handleSwitchAccount}
                  disabled={isLoggingIn}
                  className="bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 font-medium py-1.5 px-3 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                  title="สลับบัญชี Google (Switch Account)"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>สลับบัญชี</span>
                </button>
                <button
                  type="button"
                  id="btn-app-logout"
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-rose-400 py-1.5 px-2.5 rounded-xl border border-slate-800/60 hover:border-rose-500/30 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ออกจากระบบ</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                id="btn-app-login-google"
                onClick={handleLoginGoogle}
                disabled={isLoggingIn}
                className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-2 px-4 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center gap-2.5 active:scale-95 disabled:opacity-50"
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
                <span>{isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Floating Active Job Status Banner (Real-time Polling & Progress) */}
      <ActiveJobBanner
        activeJobs={activeJobs}
        onViewJob={(job) => {
          if (job.outputUrl) {
            setViewingOutput({ url: job.outputUrl, type: job.type });
          }
        }}
        onDismissJob={handleDismissJob}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full">
        {['home', 'chat', 'director', 'characters', 'locations'].includes(activeTab) && (
          <div className="px-3 pt-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-600 bg-slate-900/80 px-3 py-2 text-[16px] font-semibold text-white"
            >
              <span>← กลับ</span>
            </button>
          </div>
        )}
        {activeTab === 'home' && (
          <HomeDashboard
            onNavigate={(tab) => handleTabChange(tab)}
            credits={credits}
            onOpenCredits={() => setIsCreditsModalOpen(true)}
            authUser={authUser}
            characters={characters}
            locations={locations}
            jobs={jobs}
            onOpenNewCharacterModal={() => {
              setIsNewCharModalOpen(true);
              handleTabChange('characters');
            }}
            onOpenNewLocationModal={() => {
              setIsNewLocModalOpen(true);
              handleTabChange('locations');
            }}
            onOpenQuickGenerate={(type) => {
              setQuickGenType(type);
              setIsQuickGenOpen(true);
            }}
            onOpenScriptWriter={() => handleTabChange('director')}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectList onOpen={() => handleTabChange('director')} />
        )}

        {activeTab === 'chat' && (
          <ChatRoom authUser={authUser} />
        )}

        {activeTab === 'director' && (
          <MultiClipDirector
            characters={characters}
            locations={locations}
            initialCharacterId={studioInitialCharacterId}
            initialLocationId={studioInitialLocationId}
            initialPrompt={studioInitialPrompt}
            providers={providers}
            selectedProvider={selectedProvider}
            setSelectedProvider={setSelectedProvider}
            credits={credits}
            onOpenCredits={() => setIsCreditsModalOpen(true)}
            onGenerationStarted={handleGenerationStarted}
            onViewJobOutput={(url, type) => setViewingOutput({ url, type })}
            authUser={authUser}
            onLogin={handleLoginGoogle}
            isLoggingIn={isLoggingIn}
          />
        )}

        {activeTab === 'characters' && (
          <CharacterLibrary
            characters={characters}
            onRefreshCharacters={handleRefreshCharacters}
            onUseCharacterInStudio={handleUseCharacterInStudio}
            isOpenModal={isNewCharModalOpen}
            onOpenModal={() => setIsNewCharModalOpen(true)}
            onCloseModal={() => setIsNewCharModalOpen(false)}
          />
        )}

        {activeTab === 'locations' && (
          <LocationLibrary
            locations={locations}
            onRefreshLocations={handleRefreshLocations}
            onUseLocationInStudio={handleUseLocationInStudio}
            isOpenModal={isNewLocModalOpen}
            onOpenModal={() => setIsNewLocModalOpen(true)}
            onCloseModal={() => setIsNewLocModalOpen(false)}
          />
        )}

        {activeTab === 'profile' && (
          <div className="px-4 py-6 text-white space-y-4">
            <h2 className="text-[22px] font-bold">โปรไฟล์</h2>
            {authUser ? (
              <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-4 space-y-2">
                <p className="text-[18px] font-semibold">{authUser.displayName || 'ผู้ใช้ Google'}</p>
                <p className="text-[16px] text-slate-300">{authUser.email || ''}</p>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-[16px] font-semibold text-white"
                >
                  ออกจากระบบ
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    id="profile-open-admin-btn"
                    onClick={() => handleTabChange('admin')}
                    className="mt-3 inline-flex rounded-xl bg-amber-500 px-4 py-2 text-[16px] font-semibold text-slate-950"
                  >
                    เปิดหน้าแอดมิน
                  </button>
                )}
                {isAdmin && (
                  <a
                    id="profile-apk-download-admin"
                    href="salaai://download-apk"
                    className="mt-3 inline-flex rounded-xl border border-amber-400/70 px-4 py-2 text-[16px] font-semibold text-white"
                  >
                    ดาวน์โหลด APK
                  </a>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleLoginGoogle}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-[16px] font-semibold text-white"
              >
                {isLoggingIn ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบด้วย Google'}
              </button>
            )}
          </div>
        )}

        {activeTab === 'gallery' && (
          <GalleryModal
            jobs={jobs}
            onUsePromptInStudio={handleUsePromptInStudio}
          />
        )}

        {activeTab === 'admin' && (
          <Admin
            authUser={authUser}
            isAdmin={isAdmin}
            onNavigateToStudio={() => handleTabChange('home')}
            onLogin={handleLoginGoogle}
            onSwitchAccount={handleSwitchAccount}
          />
        )}

        {activeTab === 'pricing' && (
          <Pricing
            authUser={authUser}
            onNavigateToStudio={() => handleTabChange('home')}
            onLogin={handleLoginGoogle}
            onSwitchAccount={handleSwitchAccount}
            serverCredits={credits?.remainingCredits ?? 0}
            onCreditsUpdated={(newCredits) => {
              setCredits(prev => prev ? { ...prev, remainingCredits: newCredits } : null);
            }}
          />
        )}
      </main>

      {/* Credits & Limits Modal */}
      <CreditsModal
        credits={credits}
        onRefreshCredits={() => api.getCredits().then(setCredits)}
        isOpen={isCreditsModalOpen}
        onClose={() => setIsCreditsModalOpen(false)}
        onNavigateToPricing={() => handleTabChange('pricing')}
      />

      {/* Full Preview Output Modal */}
      {viewingOutput && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0e1424] border border-slate-700 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl relative">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {viewingOutput.type === 'video' ? '🎬 ผลงานวิดีโอ (1080p)' : '🎨 ผลงานภาพนิ่ง'}
              </span>
              <button
                onClick={() => setViewingOutput(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-black flex items-center justify-center min-h-[260px] max-h-[500px] relative">
              {viewingOutput.type === 'video' ? (
                videoPlayError ? (
                  <div className="p-8 text-center space-y-3">
                    <AlertCircle className="w-10 h-10 text-amber-400 mx-auto" />
                    <p className="text-white text-sm font-semibold">ไม่สามารถเล่นสตรีมวิดีโอได้โดยตรง</p>
                    <p className="text-slate-400 text-xs max-w-sm mx-auto">
                      ท่านสามารถคลิกปุ่ม "ดาวน์โหลดไฟล์" เพื่อรับชมผ่านโปรแกรมเล่นวิดีโอในอุปกรณ์ได้ทันที
                    </p>
                    <button
                      onClick={() => setVideoPlayError(false)}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 underline"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> ลองโหลดใหม่อีกครั้ง
                    </button>
                  </div>
                ) : (
                  <video
                    src={viewingOutput.url}
                    controls
                    autoPlay
                    playsInline
                    onError={() => setVideoPlayError(true)}
                    onLoadedData={() => setVideoPlayError(false)}
                    className="max-h-[500px] w-auto mx-auto"
                  />
                )
              ) : (
                <img
                  src={viewingOutput.url}
                  alt="output"
                  className="max-h-[500px] w-auto object-contain mx-auto"
                />
              )}
            </div>

            <div className="p-4 flex items-center justify-between gap-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                {viewingOutput.type === 'video' ? 'ดาวน์โหลด MP4 โดยตรงจากเซิร์ฟเวอร์' : 'PNG High Resolution'}
              </span>
              <button
                type="button"
                disabled={isDownloading}
                onClick={async () => {
                  const ext = viewingOutput.type === 'video' ? 'mp4' : 'png';
                  await downloadMediaFile(
                    viewingOutput.url,
                    `sala_export_${Date.now()}.${ext}`,
                    setIsDownloading
                  );
                }}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 ml-auto cursor-pointer"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังดึงไฟล์...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>ดาวน์โหลดไฟล์</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Generate Modal for Home and Center (+) Button */}
      <QuickGenerateModal
        isOpen={isQuickGenOpen}
        onClose={() => setIsQuickGenOpen(false)}
        type={quickGenType}
        characters={characters}
        locations={locations}
        onGenerate={handleQuickGenerate}
      />

      {/* Cyberpunk Bottom Navigation Bar */}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        onOpenCredits={() => setIsCreditsModalOpen(true)}
        onOpenNewCharacterModal={() => {
          setIsNewCharModalOpen(true);
          handleTabChange('characters');
        }}
        onOpenNewLocationModal={() => {
          setIsNewLocModalOpen(true);
          handleTabChange('locations');
        }}
        onOpenQuickGenerate={(type) => {
          setQuickGenType(type);
          setIsQuickGenOpen(true);
        }}
        isAdmin={isAdmin}
      />
    </div>
  );
}
