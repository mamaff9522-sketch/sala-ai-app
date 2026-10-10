import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  getDocs,
  arrayUnion
} from 'firebase/firestore';
import { db, auth, getApiKey, saveApiKey } from '../services/auth';
import { api } from '../services/api';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  safeFirestoreWrite,
  isFirestoreQuotaExhausted,
  isQuotaError,
  setFirestoreQuotaExhausted
} from '../services/firestoreGuard';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  Search,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Coins,
  ArrowLeft,
  Filter,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  ExternalLink
} from 'lucide-react';

export interface FirestoreUserDoc {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  credits?: number;
  isLocked?: boolean;
  status?: 'active' | 'locked' | string;
  role?: 'admin' | 'user' | string;
  apiKey?: string;
  apiKeys?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
}

interface AdminProps {
  authUser: FirebaseUser | null;
  isAdmin?: boolean;
  onNavigateToStudio?: () => void;
  onLogin?: () => void;
  onSwitchAccount?: () => void;
}

export const Admin: React.FC<AdminProps> = ({
  authUser,
  isAdmin = false,
  onNavigateToStudio,
  onLogin,
  onSwitchAccount
}) => {
  // Access Denied guard: If user is not authenticated or not an admin, deny access immediately
  const isAuthorized = Boolean(authUser && isAdmin);

  const [users, setUsers] = useState<FirestoreUserDoc[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'locked' | 'has_key'>('all');
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState<string | null>(null);

  // Credit adjustment modal state
  const [adjustingUser, setAdjustingUser] = useState<FirestoreUserDoc | null>(null);
  const [creditAmountInput, setCreditAmountInput] = useState<string>('100');
  const [creditAdjustmentType, setCreditAdjustmentType] = useState<'add' | 'set'>('add');

  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [promptPayId, setPromptPayId] = useState('');
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [clearQr, setClearQr] = useState(false);
  const [receivingLoaded, setReceivingLoaded] = useState(false);
  const [savingReceiving, setSavingReceiving] = useState(false);
  const [pendingTransfers, setPendingTransfers] = useState<Awaited<ReturnType<typeof api.adminListTransferRequests>>>([]);
  const [slipUrls, setSlipUrls] = useState<Record<string, string>>({});
  const [confirmingRef, setConfirmingRef] = useState<string | null>(null);
  const [rejectingRef, setRejectingRef] = useState<string | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [ownGeminiKey, setOwnGeminiKey] = useState('');
  const [showOwnGeminiKey, setShowOwnGeminiKey] = useState(false);
  const [savingOwnGeminiKey, setSavingOwnGeminiKey] = useState(false);

  // Listen to Firestore 'users' collection in real-time (Only if verified admin)
  useEffect(() => {
    if (!authUser || !isAuthorized) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const usersCollection = collection(db, 'users');

    const unsubscribe = onSnapshot(
      usersCollection,
      (snapshot) => {
        const userList: FirestoreUserDoc[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Partial<FirestoreUserDoc>;
          userList.push({
            uid: docSnap.id,
            email: data.email || '',
            displayName: data.displayName || 'ผู้ใช้ Sala AI',
            photoURL: data.photoURL,
            credits: typeof data.remainingCredits === 'number' ? data.remainingCredits : (typeof data.credits === 'number' ? data.credits : 0),
            isLocked: Boolean(data.isLocked || data.status === 'locked'),
            status: data.isLocked || data.status === 'locked' ? 'locked' : 'active',
            role: data.role || (data.email === 'mama.ff9522@gmail.com' ? 'admin' : 'user'),
            apiKey: data.apiKey || '',
            apiKeys: data.apiKeys || {},
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          });
        });

        // Ensure current user is in the list if newly logged in
        if (authUser && !userList.some((u) => u.uid === authUser.uid)) {
          const currentProfile: FirestoreUserDoc = {
            uid: authUser.uid,
            email: authUser.email || '',
            displayName: authUser.displayName || 'ผู้ดูแลระบบ',
            photoURL: authUser.photoURL || undefined,
            credits: 0,
            isLocked: false,
            status: 'active',
            role: authUser.email === 'mama.ff9522@gmail.com' ? 'admin' : 'user',
            apiKey: '',
            apiKeys: {},
            updatedAt: new Date().toISOString()
          };
          userList.unshift(currentProfile);
          // Note: Avoid setDoc inside onSnapshot callback to eliminate infinite retry loops & quota depletion
        }

        // Sort by updatedAt descending
        userList.sort((a, b) => {
          const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return timeB - timeA;
        });

        setUsers(userList);
        setIsLoading(false);
      },
      (error) => {
        if (isQuotaError(error)) {
          setFirestoreQuotaExhausted(error);
          console.warn('[Admin] Firestore write quota exhausted. Operating in offline/memory fallback mode.');
        } else {
          console.error('Error fetching users from Firestore:', error);
          setActionError(`เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้: ${error.message}`);
        }

        // Fallback: Ensure current admin user is displayed so admin dashboard remains functional
        if (authUser) {
          setUsers((prev) => {
            if (prev.length > 0) return prev;
            return [{
              uid: authUser.uid,
              email: authUser.email || '',
              displayName: authUser.displayName || 'ผู้ดูแลระบบ',
              photoURL: authUser.photoURL || undefined,
              credits: 0,
              isLocked: false,
              status: 'active',
              role: 'admin',
              apiKey: '',
              apiKeys: {},
              updatedAt: new Date().toISOString()
            }];
          });
        }
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authUser, isAuthorized]);

  // Toast auto-dismiss
  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => setActionSuccess(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);

  useEffect(() => {
    if (actionError) {
      const timer = setTimeout(() => setActionError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [actionError]);

  // Handle Lock / Unlock Toggle
  const handleToggleLock = async (user: FirestoreUserDoc) => {
    setIsUpdatingUser(user.uid);
    setActionError(null);
    const newIsLocked = !user.isLocked;
    const newStatus = newIsLocked ? 'locked' : 'active';

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await safeFirestoreWrite(
        async () => {
          await updateDoc(userDocRef, {
            isLocked: newIsLocked,
            status: newStatus,
            updatedAt: new Date().toISOString()
          });
        },
        () => {
          // Local fallback handled in setUsers
        }
      );

      // Update local state immediately for instant feedback
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid
            ? { ...u, isLocked: newIsLocked, status: newStatus }
            : u
        )
      );

      setActionSuccess(
        newIsLocked
          ? `ล็อกบัญชีผู้ใช้ ${user.displayName || user.email} เรียบร้อยแล้ว`
          : `ปลดล็อกบัญชีผู้ใช้ ${user.displayName || user.email} สำเร็จ`
      );
    } catch (err: any) {
      console.error('Error updating user lock status:', err);
      setActionError(`ไม่สามารถเปลี่ยนสถานะผู้ใช้ได้: ${err?.message || 'ข้อผิดพลาดไม่ทราบสาเหตุ'}`);
    } finally {
      setIsUpdatingUser(null);
    }
  };

  // Handle Credits Adjustment
  const handleSaveCreditsAdjustment = async () => {
    if (!adjustingUser) return;
    if (!adjustingUser.uid || adjustingUser.uid.includes('@')) {
      setActionError('ต้องเลือกผู้ใช้จาก uid จริง ไม่สามารถมอบเครดิตด้วยการพิมพ์อีเมล');
      return;
    }
    const val = parseInt(creditAmountInput, 10);
    if (isNaN(val)) {
      setActionError('กรุณากรอกจำนวนเครดิตเป็นตัวเลขที่ถูกต้อง');
      return;
    }

    setIsUpdatingUser(adjustingUser.uid);
    try {
      const currentCredits = adjustingUser.credits || 0;
      const diffAmount = creditAdjustmentType === 'add'
        ? val
        : (val - currentCredits);

      const finalCredits = creditAdjustmentType === 'add'
        ? Math.max(0, currentCredits + val)
        : Math.max(0, val);

      // Call Admin API directly (Server-Side Authorization & Firestore Update)
      await api.adminAdjustCredits({
        userId: adjustingUser.uid,
        amount: diffAmount,
        reason: `แอดมินปรับเครดิตผ่านแดชบอร์ด (${creditAdjustmentType === 'add' ? `+${val}` : `ตั้งค่าเป็น ${val}`})`
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === adjustingUser.uid ? { ...u, credits: finalCredits } : u
        )
      );

      setActionSuccess(`ปรับยอดเครดิตของ ${adjustingUser.displayName || adjustingUser.email} เป็น ${finalCredits.toLocaleString()} สำเร็จ`);
      setAdjustingUser(null);
    } catch (err: any) {
      console.error('Error updating credits:', err);
      setActionError(`ไม่สามารถอัปเดตเครดิตได้: ${err?.message || 'ข้อผิดพลาด'}`);
    } finally {
      setIsUpdatingUser(null);
    }
  };

  // Toggle API key visibility
  const toggleKeyVisibility = (uid: string) => {
    setRevealedKeys((prev) => ({ ...prev, [uid]: !prev[uid] }));
  };

  // Copy API key to clipboard
  const handleCopyKey = async (keyText: string, keyId: string) => {
    if (!keyText) return;
    try {
      await navigator.clipboard.writeText(keyText);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2500);
    } catch (err) {
      console.error('Failed to copy API key:', err);
    }
  };

  // Manual refresh from Firestore
  const handleManualRefresh = async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      if (isFirestoreQuotaExhausted()) {
        setActionSuccess('ระบบทำงานในโหมด Offline/Memory (ข้อมูลปัจจุบันพร้อมใช้งาน)');
        setIsLoading(false);
        return;
      }
      const snap = await getDocs(collection(db, 'users'));
      const list: FirestoreUserDoc[] = [];
      snap.forEach((d) => {
        const data = d.data() as Partial<FirestoreUserDoc>;
        list.push({
          uid: d.id,
          email: data.email || '',
          displayName: data.displayName || 'ผู้ใช้ Sala AI',
          photoURL: data.photoURL,
          credits: typeof data.remainingCredits === 'number' ? data.remainingCredits : (typeof data.credits === 'number' ? data.credits : 0),
          isLocked: Boolean(data.isLocked || data.status === 'locked'),
          status: data.isLocked || data.status === 'locked' ? 'locked' : 'active',
          role: data.role || (data.email === 'mama.ff9522@gmail.com' ? 'admin' : 'user'),
          apiKey: data.apiKey || '',
          apiKeys: data.apiKeys || {},
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });
      setUsers(list);
      setActionSuccess('รีเฟรชรายชื่อผู้ใช้จาก Firestore สำเร็จ');
    } catch (err: any) {
      if (isQuotaError(err)) {
        setFirestoreQuotaExhausted(err);
        setActionSuccess('โควตา Firestore เต็มชั่วคราว แสดงผลข้อมูลในหน่วยความจำปัจจุบัน');
      } else {
        setActionError(`รีเฟรชข้อมูลไม่สำเร็จ: ${err?.message || ''}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransferAdmin = async () => {
    if (!authUser || !isAuthorized) return;
    try {
      const [settingsRes, requests] = await Promise.all([
        api.adminGetTransferSettings(),
        api.adminListTransferRequests()
      ]);
      setBankName(settingsRes.settings.bankName || '');
      setAccountNumber(settingsRes.settings.accountNumber || '');
      setAccountName(settingsRes.settings.accountName || '');
      setPromptPayId(settingsRes.settings.promptPayId || '');
      setReceivingLoaded(true);
      setPendingTransfers(requests);
      const urls: Record<string, string> = {};
      for (const req of requests) {
        if (!req.hasSlip) continue;
        try {
          urls[req.reference] = await api.adminTransferSlipUrl(req.reference);
        } catch {
          /* slip preview is optional */
        }
      }
      setSlipUrls((prev) => {
        Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
        return urls;
      });
    } catch (err: any) {
      setReceivingLoaded(true);
      setActionError(err?.message || 'โหลดบัญชีรับเงินหรือสลิปไม่สำเร็จ');
    }
  };

  useEffect(() => {
    if (!authUser || !isAuthorized) return;
    loadTransferAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;
    getApiKey('gemini').then((key) => {
      if (!cancelled && key) setOwnGeminiKey(key);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [isAuthorized]);


  const readImageFile = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });

  const handleSaveReceivingAccount = async () => {
    setSavingReceiving(true);
    setActionError(null);
    try {
      const payload: {
        bankName: string;
        accountNumber: string;
        accountName: string;
        promptPayId: string;
        qrImageBase64?: string;
        qrMimeType?: string;
        clearQr?: boolean;
      } = { bankName, accountNumber, accountName, promptPayId };
      if (clearQr) payload.clearQr = true;
      if (qrFile) {
        if (qrFile.size > 5 * 1024 * 1024) throw new Error('รูป QR ต้องไม่เกิน 5 MB');
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(qrFile.type)) {
          throw new Error('รูป QR ต้องเป็น jpeg, png หรือ webp');
        }
        payload.qrImageBase64 = await readImageFile(qrFile);
        payload.qrMimeType = qrFile.type;
      }
      const saved = await api.adminSaveTransferSettings(payload);
      setBankName(saved.settings?.bankName || '');
      setAccountNumber(saved.settings?.accountNumber || '');
      setAccountName(saved.settings?.accountName || '');
      setPromptPayId(saved.settings?.promptPayId || '');
      setQrFile(null);
      setClearQr(false);
      setActionSuccess('บันทึกบัญชีรับเงินลงโปรไฟล์ Firestore ของแอดมินแล้ว');
    } catch (err: any) {
      setActionError(err?.message || 'บันทึกบัญชีรับเงินไม่สำเร็จ');
    } finally {
      setSavingReceiving(false);
    }
  };

  const handleConfirmTransfer = async (reference: string) => {
    setConfirmingRef(reference);
    setActionError(null);
    try {
      const res = await api.adminConfirmTransfer(reference);
      if (res.granted && typeof res.remainingCredits === 'number') {
        setActionSuccess(`ยืนยัน ${reference} แล้ว เติมเครดิตจริง ยอดคงเหลือใหม่ ${res.remainingCredits.toLocaleString()} เครดิต`);
      } else {
        setActionError(res.message || 'ยืนยันไม่สำเร็จ ยังไม่ได้เติมเครดิต');
      }
      await loadTransferAdmin();
    } catch (err: any) {
      setActionError(err?.message || 'ยืนยันไม่สำเร็จ ยังไม่ได้เติมเครดิต');
    } finally {
      setConfirmingRef(null);
    }
  };

  const handleRejectTransfer = async (reference: string) => {
    setRejectingRef(reference);
    setActionError(null);
    try {
      const res = await api.adminRejectTransfer(reference);
      setActionSuccess(res.message || `ปฏิเสธ ${reference} แล้ว ยังไม่ได้เติมเครดิต`);
      await loadTransferAdmin();
    } catch (err: any) {
      setActionError(err?.message || 'ปฏิเสธไม่สำเร็จ');
    } finally {
      setRejectingRef(null);
    }
  };

  const formatThaiTime = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false });
  };

  // If user is NOT logged in, show access restriction screen
  if (!authUser) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-amber-500/10">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">หน้าแอดมินสำหรับผู้ใช้ที่ล็อกอินแล้ว</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            ระบบความปลอดภัยของ ศาลาเอไอ กำหนดให้ต้องเข้าสู่ระบบด้วย Google ก่อนเข้าถึงหน้าจัดการผู้ใช้ Firestore
          </p>
          <div className="space-y-3">
            <button
              onClick={onLogin}
              id="btn-admin-login"
              className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-3 transition-all active:scale-98 cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>เข้าสู่ระบบด้วย Google</span>
            </button>
            {onNavigateToStudio && (
              <button
                onClick={onNavigateToStudio}
                className="w-full py-2.5 px-4 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-medium transition-colors"
              >
                กลับสู่หน้าหลักสตูดิโอ
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Filter users based on search & filter
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      u.uid.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'active') return !u.isLocked;
    if (statusFilter === 'locked') return u.isLocked;
    if (statusFilter === 'has_key') return Boolean(u.apiKey || (u.apiKeys && Object.values(u.apiKeys).some((k) => Boolean(k))));
    return true;
  });

  // Calculate stats
  const totalCount = users.length;
  const activeCount = users.filter((u) => !u.isLocked).length;
  const lockedCount = users.filter((u) => u.isLocked).length;
  const withKeyCount = users.filter(
    (u) => Boolean(u.apiKey || (u.apiKeys && Object.values(u.apiKeys).some((k) => Boolean(k))))
  ).length;

  if (!isAuthorized) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">ปฏิเสธการเข้าถึง (Access Denied)</h2>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed max-w-md mx-auto">
            หน้านี้สงวนไว้สำหรับผู้ดูแลระบบ (Admin) เท่านั้น บัญชีของคุณไม่มีสิทธิ์เข้าถึงแดชบอร์ดจัดการผู้ใช้ Firestore
          </p>
          {authUser && authUser.uid !== 'demo_creator' ? (
            <div className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
              <span className="text-slate-400">เข้าสู่ระบบด้วย:</span>
              <span className="font-semibold text-amber-300">{authUser.email || authUser.displayName}</span>
              <span className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md ml-1">ไม่ใช่แอดมิน</span>
            </div>
          ) : (
            <div className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-400">
              <span>สถานะ: ยังไม่ได้เข้าสู่ระบบ</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            {(onSwitchAccount || onLogin) && (
              <button
                type="button"
                id="btn-admin-switch-account"
                onClick={onSwitchAccount || onLogin}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                <span>{authUser && authUser.uid !== 'demo_creator' ? 'สลับไปยังบัญชีแอดมิน' : 'เข้าสู่ระบบด้วยบัญชีแอดมิน'}</span>
              </button>
            )}
            {onNavigateToStudio && (
              <button
                type="button"
                id="btn-admin-denied-back"
                onClick={onNavigateToStudio}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-all active:scale-95 border border-slate-700 cursor-pointer"
              >
                กลับสู่หน้าหลัก / สตูดิโอ
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-6 sm:px-6">
      {/* Toast Feedback */}
      {actionSuccess && (
        <div className="mb-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-sm shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs underline cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {actionError && (
        <div className="mb-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center justify-between text-sm shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs underline cursor-pointer"
          >
            ปิด
          </button>
        </div>
      )}

      {/* Firestore Quota Notice Banner */}
      {isFirestoreQuotaExhausted() && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-xs shadow-lg backdrop-blur-md">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold text-sm text-amber-300">
              โควตาการเขียน Firestore รายวันเต็ม (Free Tier Limit Reached)
            </p>
            <p className="text-amber-200/80 mt-1 leading-relaxed">
              ระบบเปิดใช้งานกลไกป้องกัน (Quota Circuit Breaker) และเปลี่ยนมาทำงานผ่าน LocalStorage และ In-Memory โดยอัตโนมัติ เพื่อให้ผู้ใช้และแอดมินยังสามารถใช้งานระบบได้อย่างต่อเนื่องโดยไม่เกิดข้อผิดพลาด
            </p>
          </div>
        </div>
      )}

      {/* Top Header & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          {onNavigateToStudio && (
            <button
              onClick={onNavigateToStudio}
              id="btn-admin-back"
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all active:scale-95"
              title="กลับสู่สตูดิโอ"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                จัดการผู้ใช้ Firestore (Admin)
              </h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                คอลเลกชัน: users
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              ตรวจสอบรายชื่อผู้ใช้ทั้งหมด, ยอดเครดิตคงเหลือ, API Key ในคลาวด์ และสั่งล็อก/ปลดล็อกบัญชีได้ทันที
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            id="btn-admin-refresh"
            className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : 'text-slate-400'}`} />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>
      </div>

      <section className="mb-6 bg-slate-900/80 border border-amber-500/30 rounded-2xl p-5 space-y-3">
        <h2 className="text-lg font-bold text-white">จัดการ Gemini API Key</h2>
        <p className="text-xs text-slate-400">เฉพาะผู้ดูแลบนหน้านี้เท่านั้นที่เห็นและบันทึกคีย์นี้ ผู้ใช้ทั่วไปไม่มีช่องคีย์ การสร้างภาพ วิดีโอ และแยกบทยังใช้คีย์บนเซิร์ฟเวอร์ ไม่ได้อ่านคีย์จากเบราว์เซอร์ของผู้ใช้</p>
        <label className="block text-xs font-semibold text-slate-200" htmlFor="admin-gemini-key">Gemini API Key ของบัญชีผู้ดูแล</label>
        <div className="flex flex-wrap gap-2">
          <input
            id="admin-gemini-key"
            type={showOwnGeminiKey ? 'text' : 'password'}
            value={ownGeminiKey}
            onChange={(e) => setOwnGeminiKey(e.target.value)}
            autoComplete="off"
            className="flex-1 min-w-[220px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono"
          />
          <button
            type="button"
            onClick={() => setShowOwnGeminiKey((v) => !v)}
            className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 text-sm"
          >
            {showOwnGeminiKey ? 'ซ่อน' : 'แสดง'}
          </button>
          <button
            type="button"
            disabled={savingOwnGeminiKey}
            onClick={async () => {
              setSavingOwnGeminiKey(true);
              setActionError(null);
              try {
                await saveApiKey(ownGeminiKey, 'gemini');
                setActionSuccess('บันทึก Gemini API Key ของผู้ดูแลแล้ว');
              } catch (err: any) {
                setActionError(err?.message || 'บันทึก API Key ไม่สำเร็จ');
              } finally {
                setSavingOwnGeminiKey(false);
              }
            }}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-sm font-bold disabled:opacity-50"
          >
            {savingOwnGeminiKey ? 'กำลังบันทึก...' : 'บันทึกคีย์'}
          </button>
        </div>
      </section>

      <section className="mb-6 bg-slate-900/80 border border-amber-500/30 rounded-2xl p-5 space-y-3">
        <h2 className="text-lg font-bold text-white">เพิ่มผู้ดูแล</h2>
        <p className="text-xs text-slate-400">ผู้ใช้ทั่วไปเพิ่มผู้ดูแลไม่ได้ เฉพาะผู้ดูแลที่มีอยู่แล้วเท่านั้นที่เพิ่มอีเมลคนอื่นได้ ผู้ดูแลคนแรกคือ mama.ff9522@gmail.com</p>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const email = newAdminEmail.trim().toLowerCase();
            if (!email) return;
            setAddingAdmin(true);
            setActionError(null);
            try {
              await api.addAdminEmail(email);
              await safeFirestoreWrite(async () => {
                await setDoc(doc(db, 'config', 'admins'), { emails: arrayUnion(email) }, { merge: true });
              });
              setNewAdminEmail('');
              setActionSuccess(`เพิ่ม ${email} เป็นผู้ดูแลแล้ว`);
            } catch (err: any) {
              setActionError(err?.message || 'เพิ่มผู้ดูแลไม่สำเร็จ');
            } finally {
              setAddingAdmin(false);
            }
          }}
        >
          <input
            type="email"
            required
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 min-w-[220px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
          <button
            type="submit"
            disabled={addingAdmin}
            className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-sm font-bold disabled:opacity-50"
          >
            {addingAdmin ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ดูแล'}
          </button>
        </form>
      </section>

      <section className="mb-6 bg-slate-900/80 border border-emerald-500/30 rounded-2xl p-5 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">บัญชีรับเงิน (โอน / พร้อมเพย์)</h2>
          <p className="text-xs text-slate-400 mt-1">
            บันทึกลง Firestore ที่โปรไฟล์ของแอดมินที่ล็อกอิน (users/uid) ช่องว่างไว้ได้ เพราะยังไม่มีเลขบัญชีในระบบ ห้ามใส่เลขที่ยังไม่ทราบ
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs text-slate-300 space-y-1 block">
            <span>ธนาคาร</span>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="ยังไม่ได้กรอก"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-300 space-y-1 block">
            <span>เลขบัญชี</span>
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="ยังไม่ได้กรอก"
              inputMode="numeric"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono"
            />
          </label>
          <label className="text-xs text-slate-300 space-y-1 block">
            <span>ชื่อบัญชี</span>
            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="ยังไม่ได้กรอก"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
            />
          </label>
          <label className="text-xs text-slate-300 space-y-1 block">
            <span>PromptPay ID</span>
            <input
              value={promptPayId}
              onChange={(e) => setPromptPayId(e.target.value)}
              placeholder="เบอร์ 10 หลักขึ้นต้น 0 หรือเลข 13 หลัก หรือว่าง"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono"
            />
          </label>
        </div>
        <label className="text-xs text-slate-300 block space-y-1">
          <span>รูป QR (ไม่บังคับ — ถ้ามีจะใช้รูปนี้แทน QR ที่ระบบสร้าง)</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-xs text-slate-300"
            onChange={(e) => setQrFile(e.target.files?.[0] || null)}
          />
        </label>
        <label className="text-xs text-slate-400 flex items-center gap-2">
          <input type="checkbox" checked={clearQr} onChange={(e) => setClearQr(e.target.checked)} />
          ลบรูป QR ที่อัปโหลดไว้
        </label>
        <button
          type="button"
          onClick={handleSaveReceivingAccount}
          disabled={!receivingLoaded || savingReceiving}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-60"
        >
          {savingReceiving ? 'กำลังบันทึก...' : 'บันทึกบัญชีรับเงิน'}
        </button>
      </section>

      <section className="mb-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">สลิปรอตรวจ</h2>
          <button type="button" onClick={loadTransferAdmin} className="text-xs text-indigo-300 underline">รีเฟรชสลิป</button>
        </div>
        {pendingTransfers.length === 0 ? (
          <p className="text-sm text-slate-400">ยังไม่มีรายการโอนที่รอตรวจ</p>
        ) : pendingTransfers.map((req) => (
          <div key={req.reference} className="border border-slate-800 rounded-xl p-3 space-y-2 text-xs text-slate-200">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="font-mono text-emerald-300">{req.reference}</span>
              <span>{req.email || 'ไม่ทราบอีเมล'}</span>
              <span className="font-mono">{req.uid}</span>
              <span>ผู้ใช้ชำระ {req.amountThb} บาท</span>
              <span>ระบบแนะนำให้มอบ {req.amountThb} เครดิต</span>
              <span>{formatThaiTime(req.createdAt)}</span>
            </div>
            {slipUrls[req.reference] && (
              <img src={slipUrls[req.reference]} alt={`สลิป ${req.reference}`} className="max-h-48 rounded-lg border border-slate-700" />
            )}
            {!req.slipRead ? (
              <p className="text-amber-200">ยังไม่มีผลอ่านสลิป</p>
            ) : req.slipRead.failed ? (
              <p className="text-amber-200">อ่านสลิปไม่สำเร็จ: {req.slipRead.error || 'ไม่ทราบสาเหตุ'} — ยังไม่ได้เติมเครดิต แอดมินตรวจเองแล้วกดยืนยันได้</p>
            ) : (
              <div className="space-y-1">
                <div>ชื่อผู้โอน: {req.slipRead.senderName || '—'}</div>
                <div>ยอดที่อ่านได้: {req.slipRead.amountThb === null ? '—' : `${req.slipRead.amountThb} บาท`}</div>
                <div>เวลาที่โอน: {req.slipRead.transferredAt || '—'}</div>
                <div>รหัสที่อ่านได้: {req.slipRead.reference || '—'}</div>
                {req.slipRead.matched ? (
                  <p className="text-emerald-300">ตรงกับรายการ (รหัสและยอดเงิน) ยังไม่ได้เติมเครดิตจนกว่าจะกดยืนยัน</p>
                ) : (
                  <ul className="text-amber-200 list-disc pl-4">
                    {req.slipRead.differences.map((diff) => <li key={diff}>{diff}</li>)}
                  </ul>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                id={`admin-approve-${req.reference}`}
                disabled={!req.hasSlip || confirmingRef === req.reference || rejectingRef === req.reference}
                onClick={() => handleConfirmTransfer(req.reference)}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-semibold disabled:opacity-50"
              >
                {confirmingRef === req.reference ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
              </button>
              <button
                type="button"
                id={`admin-reject-${req.reference}`}
                disabled={confirmingRef === req.reference || rejectingRef === req.reference}
                onClick={() => handleRejectTransfer(req.reference)}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold disabled:opacity-50"
              >
                {rejectingRef === req.reference ? 'กำลังปฏิเสธ...' : 'ปฏิเสธ'}
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>ผู้ใช้ทั้งหมด</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white">{totalCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">ใน Firestore Database</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>บัญชีปกติ (Active)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{activeCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">พร้อมใช้งานระบบ AI</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>บัญชีถูกล็อก (Locked)</span>
            <Lock className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">{lockedCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">ถูกระงับสิทธิ์การใช้งาน</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800/80 p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>บันทึก API Key แล้ว</span>
            <Key className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400">{withKeyCount}</div>
          <div className="text-xs text-slate-400 mt-0.5">มีคีย์ Gemini / ผู้ให้บริการอื่น</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        {/* Search input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาตามชื่อ, อีเมล หรือ UID..."
            id="input-admin-search"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-950/50 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            ทั้งหมด ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950/50 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            ปกติ ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('locked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'locked'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-950/50 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            ถูกล็อก ({lockedCount})
          </button>
          <button
            onClick={() => setStatusFilter('has_key')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === 'has_key'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-950/50 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            มี API Key ({withKeyCount})
          </button>
        </div>
      </div>

      {/* Users Table / Card List */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="font-bold text-sm text-white">
              รายชื่อผู้ใช้ ({filteredUsers.length} รายการ)
            </span>
          </div>
          <span className="text-xs text-slate-400">
            ซิงค์อัตโนมัติแบบ Real-time กับ Cloud Firestore
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
            <p className="text-sm">กำลังโหลดข้อมูลผู้ใช้จาก Firestore...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Users className="w-10 h-10 mx-auto mb-3 text-slate-400" />
            <p className="text-sm font-semibold text-slate-400">ไม่พบข้อมูลผู้ใช้ที่ตรงกับเงื่อนไข</p>
            <p className="text-xs text-slate-400 mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-5">ผู้ใช้ (User)</th>
                  <th className="py-3.5 px-4">อีเมล (Email)</th>
                  <th className="py-3.5 px-4">เครดิต (Credits)</th>
                  <th className="py-3.5 px-4">API Key ที่บันทึกไว้</th>
                  <th className="py-3.5 px-4">สถานะบัญชี</th>
                  <th className="py-3.5 px-5 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredUsers.map((user) => {
                  const isRevealed = Boolean(revealedKeys[user.uid]);
                  const rawKey = user.apiKey || (user.apiKeys && Object.values(user.apiKeys)[0]) || '';
                  const hasApiKey = Boolean(rawKey);
                  const isCurrentUser = authUser?.uid === user.uid;

                  return (
                    <tr
                      key={user.uid}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        user.isLocked ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Name and Avatar */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.displayName || 'Avatar'}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-full border border-slate-700 object-cover shadow-sm"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                              {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white text-sm flex items-center gap-2">
                              <span>{user.displayName || 'ผู้ใช้ Sala AI'}</span>
                              {user.role === 'admin' && (
                                <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  ADMIN
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  คุณ (YOU)
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-xs text-slate-400 mt-0.5">
                              UID: {user.uid}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-4 px-4 text-slate-300 font-medium">
                        {user.email ? (
                          <span className="font-mono text-xs">{user.email}</span>
                        ) : (
                          <span className="text-slate-400 italic">ไม่ได้ระบุอีเมล</span>
                        )}
                      </td>

                      {/* Credits */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-xl">
                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                            <span>{(user.credits ?? 0).toLocaleString()}</span>
                          </div>
                          <button
                            type="button"
                            id={`admin-grant-${user.uid}`}
                            onClick={() => {
                              setAdjustingUser(user);
                              setCreditAmountInput('100');
                              setCreditAdjustmentType('add');
                            }}
                            className="px-2 py-1 rounded-lg text-[16px] font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors"
                          >
                            มอบเครดิต
                          </button>
                        </div>
                      </td>

                      {/* API Key */}
                      <td className="py-4 px-4">
                        {hasApiKey ? (
                          <div className="flex items-center gap-2 max-w-xs">
                            <div className="font-mono text-xs bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded-lg text-slate-300 truncate select-all">
                              {isRevealed
                                ? rawKey
                                : `${rawKey.slice(0, 4)}••••••••••••${rawKey.slice(-4)}`}
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleKeyVisibility(user.uid)}
                              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                              title={isRevealed ? 'ซ่อนคีย์' : 'แสดงคีย์'}
                            >
                              {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyKey(rawKey, user.uid)}
                              className="p-1 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors cursor-pointer"
                              title="คัดลอก API Key"
                            >
                              {copiedKeyId === user.uid ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic flex items-center gap-1">
                            <Key className="w-3 h-3 text-slate-400" /> ยังไม่ได้บันทึก
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {user.isLocked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            <Lock className="w-3 h-3 text-rose-400" /> ถูกล็อก (Locked)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> ปกติ (Active)
                          </span>
                        )}
                      </td>

                      {/* Actions: Lock / Unlock */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleLock(user)}
                            disabled={isUpdatingUser === user.uid}
                            id={`btn-toggle-lock-${user.uid}`}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50 ${
                              user.isLocked
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                                : 'bg-rose-600/90 hover:bg-rose-500 text-white shadow-sm'
                            }`}
                          >
                            {isUpdatingUser === user.uid ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : user.isLocked ? (
                              <>
                                <Unlock className="w-3.5 h-3.5" />
                                <span>ปลดล็อก</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>ล็อกบัญชี</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Credit Adjustment Modal */}
      {adjustingUser && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1424] border border-slate-700 w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2 text-white font-bold">
                <Coins className="w-5 h-5 text-amber-400" />
                <span>ปรับยอดเครดิตผู้ใช้</span>
              </div>
              <button
                onClick={() => setAdjustingUser(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs">
                <div className="text-slate-400">ผู้ใช้:</div>
                <div className="font-bold text-white text-sm mt-0.5">
                  {adjustingUser.displayName || adjustingUser.email}
                </div>
                <div className="text-slate-400 font-mono text-xs mt-0.5">
                  UID: {adjustingUser.uid}
                </div>
                <div className="text-amber-300 font-bold text-xs mt-2">
                  เครดิตปัจจุบันใน Firestore: {(adjustingUser.credits ?? 0).toLocaleString()} เครดิต
                  <p className="text-xs text-slate-400 mt-2">
                  บันทึกที่ Firestore users/{adjustingUser.uid} ของผู้ใช้ที่เลือกเท่านั้น ไม่เติมเข้าอีเมลแอดมิน
                </p>
              </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  รูปแบบการปรับ:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreditAdjustmentType('add')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      creditAdjustmentType === 'add'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    + เพิ่มเครดิต (Top-up)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditAdjustmentType('set')}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      creditAdjustmentType === 'set'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    ตั้งค่ายอดตรงๆ (Set exact)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  จำนวนเครดิต:
                </label>
                <input
                  type="number"
                  value={creditAmountInput}
                  onChange={(e) => setCreditAmountInput(e.target.value)}
                  placeholder="เช่น 100, 500, 1000"
                  className="w-full py-2.5 px-3.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreditAmountInput('50')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  +50
                </button>
                <button
                  type="button"
                  onClick={() => setCreditAmountInput('100')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  +100
                </button>
                <button
                  type="button"
                  onClick={() => setCreditAmountInput('500')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  +500
                </button>
                <button
                  type="button"
                  onClick={() => setCreditAmountInput('1000')}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                >
                  +1,000
                </button>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustingUser(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveCreditsAdjustment}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-bold text-xs shadow-md"
                >
                  บันทึกลง Firestore
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
