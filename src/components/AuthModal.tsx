import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowRight,
  LogOut,
  Sparkles
} from 'lucide-react';
import { UserAccount, CreditAccount } from '../types';
import { api } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  currentUserAccount: CreditAccount | null;
  onAuthSuccess: (user: UserAccount, account: CreditAccount) => void;
  onLogout: () => void;
}

type AuthTab = 'login' | 'register' | 'verify_otp' | 'forgot_password';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentUserAccount,
  onAuthSuccess,
  onLogout
}) => {
  const [tab, setTab] = useState<AuthTab>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Fields
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verifyEmailAddress, setVerifyEmailAddress] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.login({ usernameOrEmail, password });
      onAuthSuccess(res.user, res.account);
      setSuccessMessage(res.message);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'ไม่สามารถเข้าสู่ระบบได้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.register({
        firstName,
        lastName,
        username: registerUsername,
        email: registerEmail,
        password: registerPassword
      });
      setVerifyEmailAddress(registerEmail);
      setDevOtpHint(res.devOtpCode || '123456');
      setSuccessMessage(res.message);
      setTab('verify_otp');
    } catch (err: any) {
      setErrorMessage(err.message || 'ไม่สามารถสมัครสมาชิกได้');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.verifyEmail(verifyEmailAddress, otpCode);
      setSuccessMessage(res.message);
      setTimeout(() => {
        setTab('login');
        setUsernameOrEmail(verifyEmailAddress);
        setSuccessMessage('ยืนยันอีเมลสำเร็จแล้ว เข้าสู่ระบบได้ทันที');
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'รหัส OTP ไม่ถูกต้อง');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.forgotPassword(forgotEmail);
      setDevOtpHint(res.devOtpCode || '123456');
      setSuccessMessage(res.message);
    } catch (err: any) {
      setErrorMessage(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.resetPassword({
        email: forgotEmail,
        code: resetCode,
        newPassword
      });
      setSuccessMessage(res.message);
      setTimeout(() => {
        setTab('login');
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'รีเซ็ตรหัสผ่านไม่สำเร็จ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-[#0f1523] border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">ระบบสมาชิกและความปลอดภัย</h3>
              <p className="text-xs text-slate-400">ศาลาเอไอ (Sala AI Identity & Security)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current User Session Card */}
        {currentUser && (
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white text-sm">
                  {currentUser.firstName?.[0] || currentUser.username?.[0] || 'U'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {currentUser.firstName} {currentUser.lastName}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase font-bold ${
                        currentUser.role === 'admin'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">@{currentUser.username} • {currentUser.email}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  onLogout();
                  setSuccessMessage('ออกจากระบบเรียบร้อย');
                }}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-xl border border-rose-500/20 hover:bg-rose-500/10 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>ออก</span>
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
              <span>เครดิตคงเหลือ:</span>
              <span className="font-mono font-bold text-amber-300 text-sm">
                {currentUserAccount?.remainingCredits ?? 0} Credits
              </span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs font-medium">
          <button
            onClick={() => {
              setTab('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              tab === 'login' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            เข้าสู่ระบบ
          </button>
          <button
            onClick={() => {
              setTab('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              tab === 'register' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            สมัครสมาชิก
          </button>
        </div>

        {/* Feedback Alerts */}
        {errorMessage && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* TAB 1: LOGIN */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">ชื่อผู้ใช้ หรือ อีเมล</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="admin หรือ creator@sala.ai"
                  value={usernameOrEmail}
                  onChange={e => setUsernameOrEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">รหัสผ่าน</label>
                <button
                  type="button"
                  onClick={() => setTab('forgot_password')}
                  className="text-[11px] text-indigo-400 hover:underline"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? 'กำลังตรวจสอบสิทธิ์...' : 'เข้าสู่ระบบ'}
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Quick Demo Access Buttons */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-[11px] text-slate-400 block text-center">ทางลัดบัญชีทดสอบระบบ:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUsernameOrEmail('admin');
                    setPassword('admin1234');
                  }}
                  className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] rounded-lg font-medium transition-all"
                >
                  แอดมิน (admin)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUsernameOrEmail('creator');
                    setPassword('user1234');
                  }}
                  className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-[11px] rounded-lg font-medium transition-all"
                >
                  ครีเอเตอร์ (creator)
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: REGISTER */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">ชื่อจริง</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น สมชาย"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">นามสกุล</label>
                <input
                  type="text"
                  placeholder="นามสกุล"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">ชื่อผู้ใช้ (Username)</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="เช่น karn_director"
                  value={registerUsername}
                  onChange={e => setRegisterUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">อีเมล</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="name@domain.com"
                  value={registerEmail}
                  onChange={e => setRegisterEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">รหัสผ่าน (เข้ารหัส Salted PBKDF2 บนเซิร์ฟเวอร์)</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="กำหนดรหัสผ่านอย่างน้อย 6 ตัวอักษร"
                  value={registerPassword}
                  onChange={e => setRegisterPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0 text-indigo-400" />
              <span>รับโบนัสเริ่มต้นฟรีทันที 100 Sala AI Credits เมื่อสมัครสมาชิก</span>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading ? 'กำลังสร้างบัญชี...' : 'สมัครสมาชิกและรับ 100 เครดิต'}
            </button>
          </form>
        )}

        {/* TAB 3: VERIFY EMAIL / OTP */}
        {tab === 'verify_otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-2">
                <Mail className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-white">ยืนยันอีเมลของคุณ</h4>
              <p className="text-xs text-slate-400">
                กรอกรหัส OTP 6 หลักที่ส่งไปยัง <span className="text-indigo-300">{verifyEmailAddress}</span>
              </p>
            </div>

            {devOtpHint && (
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs text-center font-mono">
                💡 รหัส OTP โหมดทดสอบคือ: <strong>{devOtpHint}</strong>
              </div>
            )}

            <div className="space-y-1.5">
              <input
                type="text"
                maxLength={6}
                required
                placeholder="123456"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl text-center font-mono text-lg tracking-widest py-3 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg"
            >
              {isLoading ? 'กำลังตรวจสอบ...' : 'ยืนยันรหัส OTP'}
            </button>
          </form>
        )}

        {/* TAB 4: FORGOT / RESET PASSWORD */}
        {tab === 'forgot_password' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">รีเซ็ตรหัสผ่าน</h4>
              <p className="text-xs text-slate-400">กรอกอีเมลเพื่อรับรหัส OTP สำหรับตั้งรหัสผ่านใหม่</p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-3">
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="อีเมลที่ลงทะเบียน"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-all"
              >
                ส่งรหัส OTP รีเซ็ตรหัสผ่าน
              </button>
            </form>

            {devOtpHint && (
              <form onSubmit={handleResetPassword} className="space-y-3 pt-3 border-t border-slate-800">
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs text-center font-mono">
                  💡 รหัสยืนยันคือ: <strong>{devOtpHint}</strong>
                </div>
                <input
                  type="text"
                  required
                  placeholder="รหัส OTP 6 หลัก"
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <input
                  type="password"
                  required
                  placeholder="รหัสผ่านใหม่ที่ต้องการ"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all"
                >
                  บันทึกรหัสผ่านใหม่
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
