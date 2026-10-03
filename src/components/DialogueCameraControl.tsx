import React, { useState } from 'react';
import {
  Camera,
  Info,
  X,
  Layers,
  Sparkles,
  Maximize2,
  Users,
  User,
  Compass,
  UserCheck,
  Check
} from 'lucide-react';
import { DialogueCameraAngle, DialogueBackgroundControl, DialogueLockEntry } from '../types';
import {
  CAMERA_ANGLE_DEFINITIONS,
  BACKGROUND_CONTROL_DEFINITIONS,
  CameraAngleDefinition
} from '../constants/cameraAngles';

interface DialogueCameraControlProps {
  dialogue: DialogueLockEntry;
  dialogueIndex: number;
  speakerName: string;
  allSceneCharacters?: string[];
  locationName?: string;
  onChange: (updated: DialogueLockEntry) => void;
  compact?: boolean;
}

export const DialogueCameraControl: React.FC<DialogueCameraControlProps> = ({
  dialogue,
  dialogueIndex,
  speakerName,
  allSceneCharacters = [],
  locationName,
  onChange,
  compact = false
}) => {
  const [selectedAngleInfo, setSelectedAngleInfo] = useState<CameraAngleDefinition | null>(null);

  // Active camera angles (max 2: [0] = CAM-1, [1] = CAM-2)
  const activeAngles: DialogueCameraAngle[] = dialogue.cameraAngles && dialogue.cameraAngles.length > 0
    ? dialogue.cameraAngles.slice(0, 2)
    : [];

  const activeBg: DialogueBackgroundControl = dialogue.backgroundControl || 'AUTO';

  const handleAngleToggle = (angle: DialogueCameraAngle) => {
    let nextAngles: DialogueCameraAngle[];
    const idx = activeAngles.indexOf(angle);

    if (idx !== -1) {
      // Already selected -> remove it
      nextAngles = activeAngles.filter(a => a !== angle);
    } else {
      // If AUTO clicked alone, it can be single or first
      if (activeAngles.length >= 2) {
        // Replace CAM-2 (second slot) with the new angle
        nextAngles = [activeAngles[0], angle];
      } else {
        // Append as CAM-1 or CAM-2
        nextAngles = [...activeAngles, angle];
      }
    }

    onChange({
      ...dialogue,
      cameraAngles: nextAngles
    });
  };

  const handleBgChange = (bg: DialogueBackgroundControl) => {
    onChange({
      ...dialogue,
      backgroundControl: bg
    });
  };

  const cameraAngleList: DialogueCameraAngle[] = ['AUTO', 'OTS', 'CU', '2S', 'MID', 'W'];
  const bgList: DialogueBackgroundControl[] = ['AUTO', 'SOFT', 'CLEAR'];

  return (
    <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-2 text-xs">
      {/* Header: Camera Control */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
          <Camera className="w-3.5 h-3.5 text-indigo-400" />
          <span>Camera Control (เลือกได้สูงสุด 2 มุม: CAM-1, CAM-2):</span>
        </div>

        {activeAngles.length > 0 && (
          <div className="flex items-center gap-1 text-[10px]">
            {activeAngles.map((ang, i) => (
              <span
                key={ang}
                className={`px-1.5 py-0.5 rounded font-mono font-bold border ${
                  i === 0
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50'
                    : 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                }`}
              >
                CAM-{i + 1}: {ang}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Camera Angle Buttons with small 'i' buttons */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {cameraAngleList.map((angleKey) => {
          const def = CAMERA_ANGLE_DEFINITIONS[angleKey];
          const isSelected = activeAngles.includes(angleKey);
          const camIndex = activeAngles.indexOf(angleKey); // 0 = CAM-1, 1 = CAM-2, -1 = none

          return (
            <div
              key={angleKey}
              className={`relative rounded-xl border transition-all flex items-center justify-between p-1 pl-2 gap-1 ${
                isSelected
                  ? camIndex === 0
                    ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-sm shadow-indigo-500/20'
                    : 'bg-purple-950/80 border-purple-500 text-white shadow-sm shadow-purple-500/20'
                  : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
              }`}
            >
              {/* Button click toggles angle selection */}
              <button
                type="button"
                onClick={() => handleAngleToggle(angleKey)}
                className="flex-1 flex items-center gap-1.5 text-left py-0.5 min-w-0"
                title={`${def.fullName} - ${def.summary}`}
              >
                <span className="font-bold text-xs tracking-wide">
                  {def.label}
                </span>

                {isSelected && (
                  <span
                    className={`text-[9px] font-black px-1 py-0.2 rounded font-mono ${
                      camIndex === 0
                        ? 'bg-indigo-500 text-white'
                        : 'bg-purple-500 text-white'
                    }`}
                  >
                    CAM-{camIndex + 1}
                  </span>
                )}
              </button>

              {/* Small 'i' info button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAngleInfo(def);
                }}
                className={`p-1 rounded-lg transition-colors flex-shrink-0 ${
                  isSelected
                    ? 'text-indigo-300 hover:bg-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={`ดูภาพตัวอย่างและคำอธิบายมุม ${def.label}`}
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Background Control Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
          <Layers className="w-3 h-3 text-slate-400" />
          <span>Background Control:</span>
        </div>

        <div className="flex items-center gap-1">
          {bgList.map((bgKey) => {
            const def = BACKGROUND_CONTROL_DEFINITIONS[bgKey];
            const isSelected = activeBg === bgKey;

            return (
              <button
                key={bgKey}
                type="button"
                onClick={() => handleBgChange(bgKey)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                  isSelected
                    ? def.badgeColor + ' font-bold ring-1 ring-offset-0 ring-indigo-400/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title={def.detail}
              >
                {def.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info Modal / Flyout when 'i' is clicked */}
      {selectedAngleInfo && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border border-slate-700 w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 font-bold text-sm">
                  {selectedAngleInfo.label}
                </span>
                <div>
                  <h4 className="font-bold text-white text-sm leading-tight">
                    มุมกล้อง {selectedAngleInfo.label}: {selectedAngleInfo.shortName}
                  </h4>
                  <p className="text-[11px] text-slate-400">{selectedAngleInfo.fullName}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAngleInfo(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Permanent Demonstration Image (Schematic SVG Diagram) */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2 flex flex-col items-center justify-center overflow-hidden">
              <div
                className="w-full h-32 flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: selectedAngleInfo.svgDiagram }}
              />
              <span className="text-[10px] text-slate-500 mt-1">
                *ภาพสาธิตมุมกล้องถาวร (ไม่ใช่รูปตัวละครจริงของผู้ใช้)
              </span>
            </div>

            {/* Short Explanation: Camera position & What is seen */}
            <div className="space-y-2 text-xs bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3">
              <div>
                <span className="text-indigo-400 font-semibold block text-[11px] mb-0.5">
                  📍 ตำแหน่งกล้อง (Where the camera is):
                </span>
                <p className="text-slate-200 text-[11px] leading-relaxed">
                  {selectedAngleInfo.cameraPosition}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/60">
                <span className="text-emerald-400 font-semibold block text-[11px] mb-0.5">
                  👁️ สิ่งที่เห็นในเฟรม (What is seen):
                </span>
                <p className="text-slate-200 text-[11px] leading-relaxed">
                  {selectedAngleInfo.whatIsSeen}
                </p>
              </div>
            </div>

            {/* Action button */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  handleAngleToggle(selectedAngleInfo.id);
                  setSelectedAngleInfo(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeAngles.includes(selectedAngleInfo.id)
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20'
                }`}
              >
                {activeAngles.includes(selectedAngleInfo.id) ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>ยกเลิกการเลือกมุมนี้</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>เลือกมุม {selectedAngleInfo.label} เป็น CAM-{activeAngles.length >= 1 ? '2' : '1'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
