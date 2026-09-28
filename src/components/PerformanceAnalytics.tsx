import React from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Coins,
  CheckCircle2,
  Cpu,
  Layers,
  ArrowRight,
  Activity,
  Zap,
  ShieldCheck,
  Film,
  Sparkles
} from 'lucide-react';

export const PerformanceAnalytics: React.FC = () => {
  const kpis = [
    {
      title: 'ผลลัพธ์วิดีโอทั้งหมด',
      sub: 'Total Video Output',
      value: '248',
      unit: 'คลิป',
      change: '+18.4%',
      positive: true,
      icon: Film,
      color: 'from-cyan-500/20 to-cyan-500/5',
      borderColor: 'border-cyan-500/30',
      textColor: 'text-cyan-300',
    },
    {
      title: 'เวลาสร้างเฉลี่ย',
      sub: 'Avg. Generation Time',
      value: '38.2',
      unit: 'วินาที',
      change: '-4.1s (เร็วกว่าเดิม)',
      positive: true,
      icon: Clock,
      color: 'from-indigo-500/20 to-indigo-500/5',
      borderColor: 'border-indigo-500/30',
      textColor: 'text-indigo-300',
    },
    {
      title: 'ต้นทุนต่อวิดีโอ',
      sub: 'Cost Per Video',
      value: '14.5',
      unit: 'เครดิต',
      change: '-25% ประหยัดกว่า',
      positive: true,
      icon: Coins,
      color: 'from-amber-500/20 to-amber-500/5',
      borderColor: 'border-amber-500/30',
      textColor: 'text-amber-300',
    },
    {
      title: 'ประสิทธิภาพการประมวลผล',
      sub: 'Processing Efficiency',
      value: '99.4%',
      unit: 'เสร็จสมบูรณ์',
      change: 'Zero Dropped Jobs',
      positive: true,
      icon: CheckCircle2,
      color: 'from-emerald-500/20 to-emerald-500/5',
      borderColor: 'border-emerald-500/30',
      textColor: 'text-emerald-300',
    },
  ];

  const pipelineStages = [
    {
      id: 'input',
      title: '1. Input Prompt & Data',
      desc: 'สคริปต์, เสียงพากย์, และภาพอ้างอิงใบหน้า',
      status: 'Ready',
      statusColor: 'text-cyan-400 bg-cyan-950/60 border-cyan-500/30',
    },
    {
      id: 'concept',
      title: '2. 3D Spatial & Continuity',
      desc: 'วิเคราะห์โครงหน้า 3 มิติ และตรวจความต่อเนื่องของแสง',
      status: 'Active',
      statusColor: 'text-indigo-400 bg-indigo-950/60 border-indigo-500/30',
    },
    {
      id: 'scenes',
      title: '3. Storyboard & Scenes',
      desc: 'แยกช็อตกล้อง ซาวด์เอฟเฟกต์ และความสอดคล้อง',
      status: 'Synchronized',
      statusColor: 'text-purple-400 bg-purple-950/60 border-purple-500/30',
    },
    {
      id: 'output',
      title: '4. Generated Final Video',
      desc: 'เรนเดอร์ 1080p/4K พร้อมดาวน์โหลดและสตรีมมิ่ง',
      status: 'High Speed',
      statusColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30',
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                วิเคราะห์ผลและประสิทธิภาพ (Performance Analytics)
              </h1>
              <p className="text-xs text-slate-400">
                สถิติการสร้างผลงาน การใช้ทรัพยากร GPU และขั้นตอนการประมวลผล (Pipeline)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>AI Cluster Online (Node TH-BKK)</span>
          </span>
        </div>
      </div>

      {/* Top 4 KPI Cards (ตามภาพตัวอย่าง) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className={`rounded-3xl bg-gradient-to-b ${kpi.color} bg-[#090e1c] border ${kpi.borderColor} p-5 shadow-xl relative overflow-hidden`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  {kpi.sub}
                </span>
                <div className={`p-2 rounded-xl bg-slate-900/80 border border-slate-800 ${kpi.textColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                    {kpi.value}
                  </span>
                  <span className="text-xs font-medium text-slate-400">{kpi.unit}</span>
                </div>
                <h3 className="text-xs font-semibold text-slate-300 mt-1">{kpi.title}</h3>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-emerald-400 font-semibold">{kpi.change}</span>
                <span className="text-slate-400">30 วันที่ผ่านมา</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visual KPI Pipeline Flowchart (ตามภาพตัวอย่าง) */}
      <section className="rounded-3xl bg-[#090e1c] border border-cyan-500/30 p-6 shadow-xl space-y-5">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span>ขั้นตอนการประมวลผลวิดีโอ (Production Flow Pipeline)</span>
          </h2>
          <p className="text-xs text-slate-400">
            แผนผังการไหลของข้อมูลจากคำสั่งบทไปจนถึงการเรนเดอร์ระดับสตูดิโอ
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
          {pipelineStages.map((stage, idx) => (
            <div
              key={stage.id}
              className="rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-cyan-500/40 p-4 relative group transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                  {stage.title}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${stage.statusColor}`}>
                  {stage.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed min-h-[36px]">
                {stage.desc}
              </p>

              {/* Step indicator bar */}
              <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>STAGE 0{idx + 1}</span>
                <span className="text-cyan-400">Active Node</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Section: Daily Video Output Trend + System Load circular dials */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Output Trend Chart */}
        <div className="lg:col-span-2 rounded-3xl bg-[#090e1c] border border-slate-800 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              <h3 className="font-bold text-white text-sm sm:text-base">
                สถิติการเรนเดอร์ 7 วันล่าสุด (Daily Video Output)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">สัปดาห์ปัจจุบัน</span>
          </div>

          {/* Clean High-Tech Area Sparkline Visualizer */}
          <div className="w-full h-44 rounded-2xl bg-[#060a14] border border-slate-800/80 p-4 flex flex-col justify-between relative overflow-hidden">
            {/* SVG Wave/Line Chart */}
            <svg viewBox="0 0 500 120" className="w-full h-28 overflow-visible">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Area */}
              <path
                d="M 0,100 L 70,80 L 140,85 L 210,40 L 280,60 L 350,25 L 420,35 L 500,10 L 500,120 L 0,120 Z"
                fill="url(#chartGrad)"
              />
              {/* Stroke */}
              <path
                d="M 0,100 L 70,80 L 140,85 L 210,40 L 280,60 L 350,25 L 420,35 L 500,10"
                fill="none"
                stroke="#00d2ff"
                strokeWidth="2.5"
              />
              {/* Highlight Nodes */}
              {[[70, 80], [140, 85], [210, 40], [280, 60], [350, 25], [420, 35], [500, 10]].map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="4" fill="#00d2ff" stroke="#060a14" strokeWidth="2" />
              ))}
            </svg>

            {/* Day Labels */}
            <div className="grid grid-cols-7 text-center text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
              <span>จันทร์ (18)</span>
              <span>อังคาร (22)</span>
              <span>พุธ (25)</span>
              <span>พฤหัส (48)</span>
              <span>ศุกร์ (39)</span>
              <span>เสาร์ (64)</span>
              <span className="text-cyan-300 font-bold">อาทิตย์ (72)</span>
            </div>
          </div>
        </div>

        {/* Right 1 Col: System Load Circular Dials (ตามภาพตัวอย่าง: 72% System Load / 68% GPU Load) */}
        <div className="rounded-3xl bg-[#090e1c] border border-slate-800 p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-white text-sm sm:text-base">
                สถานะคลัสเตอร์ AI (System Load)
              </h3>
            </div>

            <div className="space-y-4">
              {/* Dial 1: System Engine */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-200">System Engine</p>
                  <p className="text-[10px] text-slate-400">คิวงานรอการประมวลผล</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="w-[72%] h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full" />
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-300">72%</span>
                </div>
              </div>

              {/* Dial 2: GPU Processing Load */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-200">GPU Compute Load</p>
                  <p className="text-[10px] text-slate-400">การประมวลผล Tensor Core</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div className="w-[68%] h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-full" />
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-300">68%</span>
                </div>
              </div>

              {/* Info stats */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-850 text-[11px] space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>VRAM Utilization:</span>
                  <span className="text-slate-200">5.4 / 8.0 GB</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Engine Version:</span>
                  <span className="text-cyan-400">Sala AI v2.2.0 Stable</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Latency &lt; 20ms
            </span>
            <span className="text-emerald-400 font-mono">100% Uptime</span>
          </div>
        </div>
      </div>
    </div>
  );
};
