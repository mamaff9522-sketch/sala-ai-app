import React from 'react';
import { DialogueCameraAngle, DialogueBackgroundControl } from '../types';

export interface CameraAngleDefinition {
  id: DialogueCameraAngle;
  label: string;
  shortName: string;
  fullName: string;
  summary: string;
  cameraPosition: string;
  whatIsSeen: string;
  badgeColor: string;
  iconName: string;
  svgDiagram: string; // SVG data or path for permanent visual demonstration
}

export const CAMERA_ANGLE_DEFINITIONS: Record<DialogueCameraAngle, CameraAngleDefinition> = {
  AUTO: {
    id: 'AUTO',
    label: 'AUTO',
    shortName: 'ระบบเลือกอัตโนมัติ',
    fullName: 'Dynamic Auto Angle',
    summary: 'ระบบเลือกมุมกล้องตามอารมณ์และการเคลื่อนไหว',
    cameraPosition: 'กล้องปรับตำแหน่งและระยะอัตโนมัติตามจังหวะอารมณ์ของบทสนทนา',
    whatIsSeen: 'เห็นภาพรวมการสนทนาและการแสดงออกที่สอดคล้องกับเนื้อเรื่องที่สุด',
    badgeColor: 'from-slate-600 to-slate-700 text-slate-100 border-slate-500',
    iconName: 'Sparkles',
    svgDiagram: `
      <svg viewBox="0 0 200 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="120" rx="8" fill="#0f172a" />
        <circle cx="100" cy="60" r="38" fill="none" stroke="#6366f1" stroke-width="2" stroke-dasharray="4 4" />
        <circle cx="100" cy="60" r="24" fill="#1e1b4b" stroke="#818cf8" stroke-width="2" />
        <circle cx="100" cy="60" r="10" fill="#a5b4fc" />
        <path d="M70 35 L100 20 L130 35" fill="none" stroke="#38bdf8" stroke-width="2" />
        <path d="M130 85 L100 100 L70 85" fill="none" stroke="#38bdf8" stroke-width="2" />
        <text x="100" y="112" font-size="10" fill="#94a3b8" text-anchor="middle" font-weight="bold">AUTO DYNAMIC</text>
      </svg>
    `
  },
  OTS: {
    id: 'OTS',
    label: 'OTS',
    shortName: 'Over The Shoulder',
    fullName: 'Over-the-Shoulder Shot',
    summary: 'กล้องอยู่หลังไหล่อีกตัวละคร → จับหน้าคนพูด',
    cameraPosition: 'กล้องตั้งอยู่ด้านหลังบ่า/ไหล่ของตัวละครอีกคน หันหน้าเลนส์ไปยังคนพูด',
    whatIsSeen: 'เห็นเงาบ่า/ศีรษะของคู่สนทนาด้านหน้าเฟรม และเห็นใบหน้า แววตา สีหน้าคนพูดชัดเจน',
    badgeColor: 'from-amber-600 to-amber-700 text-amber-100 border-amber-500',
    iconName: 'UserCheck',
    svgDiagram: `
      <svg viewBox="0 0 200 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="120" rx="8" fill="#0f172a" />
        <!-- Foreground Shoulder/Back of listener (left) -->
        <path d="M-10 130 Q15 65 50 65 Q70 65 80 130 Z" fill="#334155" stroke="#475569" stroke-width="1.5" />
        <circle cx="55" cy="45" r="18" fill="#1e293b" stroke="#475569" stroke-width="1.5" />
        <!-- Target Speaker (center-right, in sharp focus) -->
        <circle cx="140" cy="45" r="20" fill="#f59e0b" fill-opacity="0.3" stroke="#f59e0b" stroke-width="2" />
        <circle cx="140" cy="42" r="14" fill="#fbbf24" />
        <path d="M115 120 Q140 75 165 120 Z" fill="#d97706" />
        <!-- Eye & facial focus -->
        <circle cx="135" cy="40" r="2" fill="#0f172a" />
        <circle cx="145" cy="40" r="2" fill="#0f172a" />
        <!-- Focus brackets -->
        <path d="M115 25 L110 25 L110 65 L115 65" fill="none" stroke="#38bdf8" stroke-width="1.5" />
        <path d="M165 25 L170 25 L170 65 L165 65" fill="none" stroke="#38bdf8" stroke-width="1.5" />
        <!-- Camera indicator -->
        <text x="25" y="112" font-size="9" fill="#94a3b8">บ่าคู่สนทนา</text>
        <text x="140" y="112" font-size="9" fill="#fbbf24" text-anchor="middle" font-weight="bold">คนพูด (Focus Face)</text>
      </svg>
    `
  },
  CU: {
    id: 'CU',
    label: 'CU',
    shortName: 'Close Up',
    fullName: 'Close-Up Shot',
    summary: 'Close Up จับหน้าคนพูด',
    cameraPosition: 'กล้องอยู่ระยะใกล้ประชิด เจาะตรงเข้าใบหน้าของคนพูด',
    whatIsSeen: 'เห็นใบหน้า แววตา ริมฝีปาก และการแสดงอารมณ์ของคนพูดอย่างละเอียดคมชัด',
    badgeColor: 'from-rose-600 to-rose-700 text-rose-100 border-rose-500',
    iconName: 'Maximize2',
    svgDiagram: `
      <svg viewBox="0 0 200 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="120" rx="8" fill="#0f172a" />
        <!-- Large Face in frame -->
        <circle cx="100" cy="55" r="42" fill="#f43f5e" fill-opacity="0.2" stroke="#f43f5e" stroke-width="2" />
        <ellipse cx="100" cy="58" rx="28" ry="34" fill="#fb7185" />
        <!-- Eyes & Mouth in close up -->
        <ellipse cx="90" cy="50" rx="4" ry="5" fill="#1e1b4b" />
        <ellipse cx="110" cy="50" rx="4" ry="5" fill="#1e1b4b" />
        <path d="M92 72 Q100 80 108 72" fill="none" stroke="#881337" stroke-width="3" stroke-linecap="round" />
        <!-- Framing grid corners -->
        <path d="M40 25 L30 25 L30 45" fill="none" stroke="#f43f5e" stroke-width="2" />
        <path d="M160 25 L170 25 L170 45" fill="none" stroke="#f43f5e" stroke-width="2" />
        <path d="M40 95 L30 95 L30 75" fill="none" stroke="#f43f5e" stroke-width="2" />
        <path d="M160 95 L170 95 L170 75" fill="none" stroke="#f43f5e" stroke-width="2" />
        <text x="100" y="112" font-size="9" fill="#fda4af" text-anchor="middle" font-weight="bold">CLOSE-UP FACE LOCK</text>
      </svg>
    `
  },
  '2S': {
    id: '2S',
    label: '2S',
    shortName: 'Two Shot',
    fullName: 'Two-Shot Frame',
    summary: 'เห็นตัวละคร 2 คนในเฟรม',
    cameraPosition: 'กล้องถอยออกมาในระยะที่จัดเฟรมให้ครอบคลุมตัวละครทั้งสองคนพร้อมกัน',
    whatIsSeen: 'เห็นตัวละครทั้ง 2 คนในเฟรมเดียวกัน เห็นปฏิสัมพันธ์ สายตา และภาษากายที่คุยกัน',
    badgeColor: 'from-emerald-600 to-emerald-700 text-emerald-100 border-emerald-500',
    iconName: 'Users',
    svgDiagram: `
      <svg viewBox="0 0 200 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="120" rx="8" fill="#0f172a" />
        <!-- Character 1 (Left) -->
        <circle cx="65" cy="42" r="16" fill="#10b981" />
        <path d="M40 110 Q65 65 90 110 Z" fill="#059669" />
        <!-- Character 2 (Right) -->
        <circle cx="135" cy="42" r="16" fill="#3b82f6" />
        <path d="M110 110 Q135 65 160 110 Z" fill="#2563eb" />
        <!-- Interaction indicator -->
        <path d="M85 45 L115 45" stroke="#fef08a" stroke-width="2" stroke-dasharray="3 3" />
        <circle cx="100" cy="45" r="3" fill="#fef08a" />
        <!-- Frame bracket -->
        <rect x="25" y="18" width="150" height="85" rx="6" fill="none" stroke="#10b981" stroke-width="1.5" stroke-opacity="0.6" />
        <text x="100" y="114" font-size="9" fill="#6ee7b7" text-anchor="middle" font-weight="bold">TWO-SHOT (2 คนร่วมเฟรม)</text>
      </svg>
    `
  },
  MID: {
    id: 'MID',
    label: 'MID',
    shortName: 'Medium Shot',
    fullName: 'Medium Shot (Waist Up)',
    summary: 'ครึ่งตัว เห็นตัวละครและฉากบางส่วน',
    cameraPosition: 'กล้องอยู่ระยะปานกลาง หันตรงจับตัวละครตั้งแต่ช่วงเอวขึ้นไป',
    whatIsSeen: 'เห็นตัวละครครึ่งตัว ทรงผม เสื้อผ้าท่อนบน การขยับมือ และฉากหลังบางส่วน',
    badgeColor: 'from-blue-600 to-blue-700 text-blue-100 border-blue-500',
    iconName: 'User',
    svgDiagram: `
      <svg viewBox="0 0 200 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="120" rx="8" fill="#0f172a" />
        <!-- Background environmental hint -->
        <line x1="20" y1="90" x2="180" y2="90" stroke="#334155" stroke-width="2" />
        <rect x="30" y="40" width="30" height="50" fill="#1e293b" />
        <rect x="145" y="45" width="25" height="45" fill="#1e293b" />
        <!-- Character Waist Up (Center) -->
        <circle cx="100" cy="38" r="16" fill="#60a5fa" />
        <path d="M72 105 Q100 60 128 105 Z" fill="#2563eb" />
        <!-- Waist Cut line -->
        <line x1="65" y1="105" x2="135" y2="105" stroke="#facc15" stroke-width="1.5" stroke-dasharray="3 2" />
        <text x="100" y="115" font-size="9" fill="#93c5fd" text-anchor="middle" font-weight="bold">MEDIUM (ระดับเอวขึ้นไป)</text>
      </svg>
    `
  },
  W: {
    id: 'W',
    label: 'W',
    shortName: 'Wide Shot',
    fullName: 'Wide Shot',
    summary: 'Wide เห็นการกระทำและสถานที่มากขึ้น',
    cameraPosition: 'กล้องถอยระยะออกไปไกล เพื่อเปิดมุมมองกว้างครอบคลุมพื้นที่',
    whatIsSeen: 'เห็นตัวละครเต็มตัว ท่าทางการเดินหรือเคลื่อนไหว และสภาพแวดล้อมสถานที่ชัดเจน',
    badgeColor: 'from-purple-600 to-purple-700 text-purple-100 border-purple-500',
    iconName: 'Compass',
    svgDiagram: `
      <svg viewBox="0 0 200 120" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="120" rx="8" fill="#0f172a" />
        <!-- Wide Environment Landscape / Room -->
        <path d="M0 80 Q50 60 100 75 Q150 90 200 70 L200 120 L0 120 Z" fill="#1e1b4b" opacity="0.6" />
        <rect x="25" y="30" width="45" height="50" fill="#312e81" opacity="0.4" />
        <rect x="135" y="25" width="40" height="55" fill="#312e81" opacity="0.4" />
        <!-- Small full-body characters in wide scene -->
        <circle cx="90" cy="65" r="7" fill="#c084fc" />
        <line x1="90" y1="72" x2="90" y2="92" stroke="#a855f7" stroke-width="3" />
        <line x1="90" y1="92" x2="85" y2="104" stroke="#a855f7" stroke-width="2.5" />
        <line x1="90" y1="92" x2="95" y2="104" stroke="#a855f7" stroke-width="2.5" />
        <!-- Second character -->
        <circle cx="115" cy="67" r="7" fill="#e879f9" />
        <line x1="115" y1="74" x2="115" y2="94" stroke="#d946ef" stroke-width="3" />
        <line x1="115" y1="94" x2="110" y2="104" stroke="#d946ef" stroke-width="2.5" />
        <line x1="115" y1="94" x2="120" y2="104" stroke="#d946ef" stroke-width="2.5" />
        <text x="100" y="115" font-size="9" fill="#e9d5ff" text-anchor="middle" font-weight="bold">WIDE SHOT (เห็นสถานที่ + กิริยา)</text>
      </svg>
    `
  }
};

export interface BackgroundControlDefinition {
  id: DialogueBackgroundControl;
  label: string;
  description: string;
  detail: string;
  badgeColor: string;
}

export const BACKGROUND_CONTROL_DEFINITIONS: Record<DialogueBackgroundControl, BackgroundControlDefinition> = {
  AUTO: {
    id: 'AUTO',
    label: 'AUTO',
    description: 'ระบบเลือกตามมุมกล้อง',
    detail: 'ระบบ AI เลือกระดับความชัดลึกของฉากหลังให้สอดคล้องกับขนาดมุมกล้อง (เช่น CU ละลายหลัง, W ชัดลึก) โดยคง Location เดิม',
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700'
  },
  SOFT: {
    id: 'SOFT',
    label: 'SOFT',
    description: 'ฉากหลังเบลอ แต่ Location เดิม',
    detail: 'ฉากหลังเบลอนุ่มนวลโบเก้ (Shallow Depth of Field) ช่วยตัดตัวละครให้เด่นชัด ลดปัญหาใบหน้าหลุด โดยยังคงสถานที่เดิม (LOCATION LOCK เดิม)',
    badgeColor: 'bg-indigo-900/60 text-indigo-300 border-indigo-500/50'
  },
  CLEAR: {
    id: 'CLEAR',
    label: 'CLEAR',
    description: 'เห็นฉากหลังชัดขึ้น แต่ Location เดิม',
    detail: 'ฉากหลังคมชัดลึก (Deep Focus) เห็นรายละเอียด พร็อพ และบรรยากาศโดยรอบอย่างชัดเจน โดยยังคงสถานที่เดิม (LOCATION LOCK เดิม)',
    badgeColor: 'bg-emerald-900/60 text-emerald-300 border-emerald-500/50'
  }
};
