import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Coins,
  Cpu,
  RefreshCw,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Ticket,
  Sliders,
  UserCheck,
  UserX,
  Trash2,
  KeyRound,
  DollarSign
} from 'lucide-react';
import { AdminStats } from '../types';
import { api } from '../services/api';

interface AdminDashboardProps {
  onRefreshAll: () => void;
}

type AdminTab = 'overview' | 'users' | 'pricing' | 'redeem';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onRefreshAll }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [grantAmount, setGrantAmount] = useState<number>(50);
  const [selectedUserId, setSelectedUserId] = useState<string>('user_sala_001');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Users tab state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [customAdjustUserId, setCustomAdjustUserId] = useState<string>('');
  const [customAdjustAmount, setCustomAdjustAmount] = useState<number>(100);
  const [customAdjustReason, setCustomAdjustReason] = useState<string>('โบนัสกิจกรรมพิเศษ');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');

  // Pricing tab state
  const [pricingConfig, setPricingConfig] = useState<any>({
    promptCopyFeeCredits: 10,
    platformServiceFeePercent: 15,
    fixedServiceFeeCredits: 5,
    videoCostPerSecVeo: 6,
    videoCostPerSecSora: 8,
    imageCostStandard: 2
  });
  const [isSavingPricing, setIsSavingPricing] = useState(false);

  // Redeem codes tab state
  const [redeemCodes, setRedeemCodes] = useState<any[]>([]);
  const [newCodeName, setNewCodeName] = useState('');
  const [newCodeCredits, setNewCodeCredits] = useState<number>(100);
  const [newCodeMaxUses, setNewCodeMaxUses] = useState<number>(50);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAdminStats();
      setStats(data);
      if (data?.userAccounts?.length) {
        setUsersList(data.userAccounts);
      }
    } catch (err) {
      console.error('Error fetching admin stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const users = await api.getAdminUsers();
      setUsersList(users);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPricing = async () => {
    try {
      const cfg = await api.getPricingConfig();
      if (cfg) setPricingConfig(cfg);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRedeemCodes = async () => {
    try {
      const codes = await api.getRedeemCodes();
      setRedeemCodes(codes);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchPricing();
    fetchRedeemCodes();
    fetchUsers();
  }, []);

  const handleGrantCredits = async () => {
    if (!selectedUserId || !grantAmount) return;
    try {
      await api.adminGrantCredits(selectedUserId, grantAmount);
      setActionMessage(`เพิ่ม +${grantAmount} เครดิตให้แก่ผู้ใช้สำเร็จ`);
      fetchStats();
      fetchUsers();
      onRefreshAll();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCustomAdjustCredits = async () => {
    if (!customAdjustUserId) return;
    try {
      await api.adminAdjustCredits({
        userId: customAdjustUserId,
        amount: customAdjustAmount,
        reason: customAdjustReason
      });
      setActionMessage(`ปรับเครดิต (${customAdjustAmount > 0 ? '+' : ''}${customAdjustAmount}) สำเร็จ: ${customAdjustReason}`);
      fetchStats();
      fetchUsers();
      onRefreshAll();
      setTimeout(() => setActionMessage(null), 3500);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const handleToggleUserStatus = async (userId: string) => {
    try {
      await api.adminToggleUserStatus(userId);
      setActionMessage('สลับสถานะบัญชีผู้ใช้เรียบร้อยแล้ว');
      fetchUsers();
      fetchStats();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newEmail || !newPassword) return;
    try {
      await api.adminCreateUser({
        username: newUsername,
        email: newEmail,
        password: newPassword,
        role: newRole,
        initialCredits: 100
      });
      setActionMessage(`สร้างบัญชีผู้ใช้ "${newUsername}" สำเร็จแล้ว`);
      setIsCreatingUser(false);
      setNewUsername('');
      setNewEmail('');
      setNewPassword('');
      fetchUsers();
      fetchStats();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert('สร้างผู้ใช้ไม่สำเร็จ: ' + err.message);
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPricing(true);
    try {
      await api.updatePricingConfig(pricingConfig);
      setActionMessage('บันทึกโครงสร้างราคาและค่าธรรมเนียมเรียบร้อยแล้ว');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsSavingPricing(false);
    }
  };

  const handleCreateRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCodeName) return;
    try {
      await api.createRedeemCode({
        code: newCodeName.toUpperCase().trim(),
        credits: Number(newCodeCredits),
        maxUses: Number(newCodeMaxUses),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      });
      setActionMessage(`สร้างโค้ด ${newCodeName.toUpperCase().trim()} สำเร็จ`);
      setNewCodeName('');
      fetchRedeemCodes();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert('สร้างโค้ดไม่สำเร็จ: ' + err.message);
    }
  };

  const handleDeleteRedeemCode = async (id: string) => {
    if (!confirm('ต้องการลบโค้ดนี้ใช่หรือไม่?')) return;
    try {
      await api.deleteRedeemCode(id);
      setActionMessage('ลบโค้ดเรียบร้อยแล้ว');
      fetchRedeemCodes();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert('ลบโค้ดไม่สำเร็จ: ' + err.message);
    }
  };

  const handleResetDailyLimits = async () => {
    try {
      await api.adminResetLimits();
      setActionMessage('รีเซ็ต Daily Limit ประจำวันของผู้ใช้ทั้งหมดเรียบร้อยแล้ว');
      fetchStats();
      fetchUsers();
      onRefreshAll();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 pb-28 md:pb-12 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0d1322] border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">
              แผงควบคุมระบบแอดมิน (Admin Control Center)
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            ตรวจสอบผู้ใช้งาน จัดการเครดิต กำหนดค่าธรรมเนียมระบบ และบริหารโค้ดโปรโมชั่น
          </p>
        </div>

        <button
          onClick={() => {
            fetchStats();
            fetchUsers();
            fetchPricing();
            fetchRedeemCodes();
          }}
          disabled={isLoading}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-700 transition-all active:scale-95 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>รีเฟรชข้อมูล</span>
        </button>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Admin Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'overview'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>ภาพรวมระบบ (Overview)</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'users'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>จัดการสมาชิก (Users & Credits)</span>
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'pricing'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>ราคาและค่าธรรมเนียม (Pricing & Fees)</span>
        </button>

        <button
          onClick={() => setActiveTab('redeem')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 ${
            activeTab === 'redeem'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Ticket className="w-4 h-4" />
          <span>โค้ดแลกเครดิต (Redeem Codes)</span>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#0e1424] border border-slate-800/90 rounded-2xl p-4 shadow-lg space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">ผู้ใช้งานทั้งหมด</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-extrabold text-white font-mono">{stats?.totalUsers || usersList.length || 142}</p>
              <span className="text-[10px] text-emerald-400">Active Creators</span>
            </div>

            <div className="bg-[#0e1424] border border-slate-800/90 rounded-2xl p-4 shadow-lg space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">ผลงานที่สร้างแล้ว</span>
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-extrabold text-white font-mono">{stats?.totalGenerations || 412}</p>
              <span className="text-[10px] text-slate-400">
                {stats?.totalImagesGenerated || 310} ภาพ • {stats?.totalVideosGenerated || 102} คลิป
              </span>
            </div>

            <div className="bg-[#0e1424] border border-slate-800/90 rounded-2xl p-4 shadow-lg space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">คิวงานที่กำลังรัน</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-extrabold text-white font-mono">{stats?.activeJobsCount ?? 0}</p>
              <span className="text-[10px] text-slate-400">Background Jobs Polling</span>
            </div>

            <div className="bg-[#0e1424] border border-slate-800/90 rounded-2xl p-4 shadow-lg space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-medium">เครดิตที่หมุนเวียน</span>
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-extrabold text-amber-300 font-mono">{stats?.creditsSpentTotal || 3530}</p>
              <span className="text-[10px] text-slate-400">Credits Consumed</span>
            </div>
          </div>

          {/* Multi-Provider Architecture Status Matrix */}
          <div className="bg-[#0e1424] border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">
                สถานะโมเดลและโครงข่ายผู้ให้บริการ (Provider Adapters Health)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              {stats?.providersStatus.map((prov) => (
                <div
                  key={prov.id}
                  className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{prov.name}</span>
                    {prov.hasKey ? (
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-amber-400 font-mono bg-amber-400/10 px-1 rounded">
                        Mock
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">{prov.statusText}</p>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                    <span>Active Calls:</span>
                    <span className="font-mono text-slate-300">{prov.activeCalls}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Credit Grant */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="bg-[#0e1424] border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">เพิ่มเครดิตด่วน</h3>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">เลือกผู้ใช้งาน</label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 outline-none focus:border-indigo-500"
                  >
                    {usersList.map((u) => (
                      <option key={u.userId || u.id} value={u.userId || u.id}>
                        {u.userName || u.username} (คงเหลือ: {u.remainingCredits ?? u.credits ?? 0} เครดิต)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">จำนวนเครดิตที่ต้องการเพิ่ม</label>
                  <div className="flex gap-2">
                    {[50, 100, 250].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setGrantAmount(amt)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                          grantAmount === amt
                            ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        +{amt}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleGrantCredits}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>เพิ่มเครดิตให้ผู้ใช้ที่เลือก</span>
                </button>

                <button
                  onClick={handleResetDailyLimits}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs py-2 rounded-xl transition-all border border-slate-700 flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>รีเซ็ต Daily Limit ทุกคน</span>
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 bg-[#0e1424] border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  สรุปบัญชีผู้ใช้งาน
                </h3>
                <button
                  onClick={() => setActiveTab('users')}
                  className="text-xs text-amber-400 hover:underline"
                >
                  เปิดจัดการสมาชิกเต็มรูปแบบ →
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">ผู้ใช้งาน</th>
                      <th className="py-2.5 px-3">บทบาท</th>
                      <th className="py-2.5 px-3">เครดิตคงเหลือ</th>
                      <th className="py-2.5 px-3">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {usersList.slice(0, 5).map((user) => (
                      <tr key={user.userId || user.id} className="hover:bg-slate-900/40">
                        <td className="py-2.5 px-3 font-medium text-white">{user.userName || user.username}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-indigo-400 font-mono">
                            {user.userRole || user.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                          {user.remainingCredits ?? user.credits ?? 0}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            user.status === 'suspended' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {user.status === 'suspended' ? 'ระงับการใช้งาน' : 'ปกติ (Active)'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <span>จัดการบัญชีผู้ใช้งาน ({usersList.length} คน)</span>
            </h3>

            <button
              onClick={() => setIsCreatingUser(!isCreatingUser)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreatingUser ? 'ปิดฟอร์ม' : 'สร้างผู้ใช้ใหม่'}</span>
            </button>
          </div>

          {/* New User Form */}
          {isCreatingUser && (
            <form onSubmit={handleCreateUser} className="bg-[#0e1424] border border-indigo-500/40 rounded-2xl p-5 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-400" />
                <span>เพิ่มผู้ใช้งานระบบใหม่</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="ชื่อผู้ใช้ (Username)"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 outline-none focus:border-indigo-500"
                  required
                />
                <input
                  type="email"
                  placeholder="อีเมล (Email)"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 outline-none focus:border-indigo-500"
                  required
                />
                <input
                  type="password"
                  placeholder="รหัสผ่าน (Password)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 outline-none focus:border-indigo-500"
                  required
                />
                <select
                  value={newRole}
                  onChange={(e: any) => setNewRole(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 outline-none focus:border-indigo-500"
                >
                  <option value="user">ผู้ใช้ทั่วไป (User)</option>
                  <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingUser(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md active:scale-95"
                >
                  บันทึกผู้ใช้ใหม่ (+100 เครดิตฟรี)
                </button>
              </div>
            </form>
          )}

          {/* Custom Credit Adjustment Box */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>ปรับปรุงเครดิตแบบระบุเหตุผล (Audit Log)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                value={customAdjustUserId}
                onChange={(e) => setCustomAdjustUserId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 outline-none focus:border-indigo-500"
              >
                <option value="">-- เลือกผู้ใช้ --</option>
                {usersList.map((u) => (
                  <option key={u.userId || u.id} value={u.userId || u.id}>
                    {u.userName || u.username} ({u.remainingCredits ?? u.credits ?? 0} เครดิต)
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="จำนวนเครดิต (+ หรือ -)"
                value={customAdjustAmount}
                onChange={(e) => setCustomAdjustAmount(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 outline-none focus:border-indigo-500 font-mono"
              />
              <input
                type="text"
                placeholder="เหตุผล (Reason)"
                value={customAdjustReason}
                onChange={(e) => setCustomAdjustReason(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-xl p-2.5 outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleCustomAdjustCredits}
                disabled={!customAdjustUserId}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-md active:scale-95"
              >
                บันทึกการปรับเครดิต
              </button>
            </div>
          </div>

          {/* Full Users Table */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-3 px-3">ผู้ใช้งาน</th>
                    <th className="py-3 px-3">อีเมล</th>
                    <th className="py-3 px-3">บทบาท</th>
                    <th className="py-3 px-3">เครดิตคงเหลือ</th>
                    <th className="py-3 px-3">สถานะบัญชี</th>
                    <th className="py-3 px-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {usersList.map((user) => {
                    const uId = user.userId || user.id;
                    const isSuspended = user.status === 'suspended';
                    return (
                      <tr key={uId} className="hover:bg-slate-900/40">
                        <td className="py-3 px-3 font-semibold text-white">{user.userName || user.username}</td>
                        <td className="py-3 px-3 text-slate-400">{user.email || '-'}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                            user.userRole === 'admin' || user.role === 'admin'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {user.userRole || user.role}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-300 text-sm">
                          {user.remainingCredits ?? user.credits ?? 0}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 w-fit ${
                            isSuspended ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {isSuspended ? (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                <span>ระงับ (Suspended)</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>ปกติ (Active)</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleToggleUserStatus(uId)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                              isSuspended
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {isSuspended ? 'ปลดบล็อค' : 'ระงับบัญชี'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRICING & COST CONFIGURATION */}
      {activeTab === 'pricing' && (
        <form onSubmit={handleSavePricing} className="bg-[#0e1424] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span>โครงสร้างราคา ค่าคัดลอก และค่าธรรมเนียมบริการ (Pricing Engine)</span>
            </h3>
            <p className="text-xs text-slate-400">
              กำหนดอัตราค่าบริการและส่วนต่างกำไรของระบบแพลตฟอร์ม ค่าใช้จ่ายจะถูกคำนวณและแสดงให้ผู้ใช้ยืนยันอย่างโปร่งใสในหน้า Cost Estimation
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-2">
              <label className="text-xs font-bold text-slate-200">
                ค่าคัดลอก Prompt หลายคลิป (Prompt Copy Fee - เครดิต)
              </label>
              <p className="text-[11px] text-slate-400">
                ค่าธรรมเนียมเมื่อส่งออกชุด Prompt ไปยังเครื่องมือภายนอก (ปัจจุบันในโหมด Prompt ฟรี = 0 หรือกำหนดเป็นค่าบริการพิเศษ)
              </p>
              <input
                type="number"
                value={pricingConfig.promptCopyFeeCredits || 0}
                onChange={(e) => setPricingConfig({ ...pricingConfig, promptCopyFeeCredits: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 font-mono"
              />
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-2">
              <label className="text-xs font-bold text-slate-200">
                ค่าบริการแพลตฟอร์มแบบเปอร์เซ็นต์ (Platform Service Fee %)
              </label>
              <p className="text-[11px] text-slate-400">
                เปอร์เซ็นต์ค่าบริการที่ระบบคิดเพิ่มจากต้นทุน API จริง เช่น 15%
              </p>
              <input
                type="number"
                value={pricingConfig.platformServiceFeePercent || 15}
                onChange={(e) => setPricingConfig({ ...pricingConfig, platformServiceFeePercent: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 font-mono"
              />
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-2">
              <label className="text-xs font-bold text-slate-200">
                ค่าบริการคงที่ต่อชุดงาน (Fixed Service Fee - เครดิต)
              </label>
              <p className="text-[11px] text-slate-400">
                ค่าดูแลคิวประมวลผลและการจัดส่งแบบอัตโนมัติต่อ Job
              </p>
              <input
                type="number"
                value={pricingConfig.fixedServiceFeeCredits || 5}
                onChange={(e) => setPricingConfig({ ...pricingConfig, fixedServiceFeeCredits: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 font-mono"
              />
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-2">
              <label className="text-xs font-bold text-slate-200">
                อัตราเรนเดอร์วิดีโอ Veo (เครดิต / วินาที)
              </label>
              <p className="text-[11px] text-slate-400">
                เช่น 6 เครดิต ต่อ 1 วินาที (1 คลิป 10 วินาที = 60 เครดิต)
              </p>
              <input
                type="number"
                value={pricingConfig.videoCostPerSecVeo || 6}
                onChange={(e) => setPricingConfig({ ...pricingConfig, videoCostPerSecVeo: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingPricing}
              className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 active:scale-95 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSavingPricing ? 'กำลังบันทึก...' : 'บันทึกอัตราค่าบริการใหม่'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: REDEEM CODES */}
      {activeTab === 'redeem' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Ticket className="w-5 h-5 text-amber-400" />
              <span>โค้ดแลกเครดิตและคูปองโปรโมชั่น (Redeem Code Manager)</span>
            </h3>
          </div>

          {/* Create Code Form */}
          <form onSubmit={handleCreateRedeemCode} className="bg-[#0e1424] border border-amber-500/30 rounded-2xl p-5 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>สร้างโค้ดแลกเครดิตใหม่</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">รหัสโค้ด (เช่น SALA2026)</label>
                <input
                  type="text"
                  placeholder="SALA2026"
                  value={newCodeName}
                  onChange={(e) => setNewCodeName(e.target.value.toUpperCase())}
                  className="w-full bg-slate-900 border border-slate-700 text-amber-300 font-mono font-bold text-xs rounded-xl p-2.5 outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">จำนวนเครดิตที่มอบให้</label>
                <input
                  type="number"
                  placeholder="100"
                  value={newCodeCredits}
                  onChange={(e) => setNewCodeCredits(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-xs rounded-xl p-2.5 outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">จำนวนสิทธิ์การใช้สูงสุด</label>
                <input
                  type="number"
                  placeholder="50"
                  value={newCodeMaxUses}
                  onChange={(e) => setNewCodeMaxUses(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-xs rounded-xl p-2.5 outline-none focus:border-amber-500"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <Ticket className="w-4 h-4" />
                <span>สร้างโค้ดทันที</span>
              </button>
            </div>
          </form>

          {/* Existing Codes List */}
          <div className="bg-[#0e1424] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-semibold">
                  <tr>
                    <th className="py-3 px-3">รหัสโค้ด</th>
                    <th className="py-3 px-3">มูลค่าเครดิต</th>
                    <th className="py-3 px-3">การใช้งาน / สิทธิ์ทั้งหมด</th>
                    <th className="py-3 px-3">วันหมดอายุ</th>
                    <th className="py-3 px-3 text-right">ลบโค้ด</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {redeemCodes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        ยังไม่มีโค้ดแลกเครดิตในระบบ
                      </td>
                    </tr>
                  ) : (
                    redeemCodes.map((c) => (
                      <tr key={c.id || c.code} className="hover:bg-slate-900/40">
                        <td className="py-3 px-3 font-mono font-bold text-amber-300 text-sm">
                          {c.code}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-400 font-semibold">
                          +{c.credits} เครดิต
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {c.usedCount || 0} / {c.maxUses}
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('th-TH') : 'ไม่มีวันหมดอายุ'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleDeleteRedeemCode(c.id || c.code)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 transition-all"
                            title="ลบโค้ดนี้"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
