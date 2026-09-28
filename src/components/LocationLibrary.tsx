import React, { useState, useRef, useEffect } from 'react';
import { LocationEditModal, isLocationOwner } from './LocationEditModal';
import {
  MapPin,
  Building,
  Home,
  Plus,
  Trash2,
  Sparkles,
  UploadCloud,
  X,
  Copy,
  Check,
  Layers,
  Info,
  Loader2,
  CheckCircle2,
  Cloud,
  Database,
  RefreshCw,
  HardDrive,
  AlertCircle,
  ShieldCheck,
  Edit3,
  ChevronDown,
  ChevronUp,
  FileText,
  Lock,
  Unlock,
  Zap,
  Eye
} from 'lucide-react';
import {
  LocationItem,
  LocationVisualProfile,
  LocationIdentity,
  LocationReferenceMetadata,
  LocationStoryProfile,
  LocationAnalysisStatus,
  LocationLockStatus
} from '../types';
import { api } from '../services/api';
import { computeImageHash } from '../utils/imageHash';
import {
  getLocations,
  saveLocation,
  deleteLocation,
  checkAndSyncLocations,
  getActiveUid
} from '../services/locationService';

interface LocationLibraryProps {
  locations: LocationItem[];
  onRefreshLocations: (savedLoc?: LocationItem) => void | Promise<any>;
  onUseLocationInStudio: (locationId: string) => void;
  isOpenModal: boolean;
  onCloseModal: () => void;
  onOpenModal: () => void;
}

export const LocationLibrary: React.FC<LocationLibraryProps> = ({
  locations = [],
  onRefreshLocations,
  onUseLocationInStudio,
  isOpenModal,
  onCloseModal,
  onOpenModal
}) => {
  const safeLocations = Array.isArray(locations) ? locations : [];
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<LocationItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCheckingSync, setIsCheckingSync] = useState(false);
  const [syncAuditInfo, setSyncAuditInfo] = useState<{
    message: string;
    type: 'success' | 'info' | 'warning';
    firestoreCount: number;
    localCount: number;
  } | null>(null);

  // Sync with Firestore
  const handleCheckFirestoreAndSync = async () => {
    const currentUid = getActiveUid();
    if (!currentUid) return;
    setIsCheckingSync(true);
    try {
      const result = await checkAndSyncLocations(currentUid);
      setSyncAuditInfo({
        message: result.message,
        type: result.firestoreCount > 0 ? 'success' : 'info',
        firestoreCount: result.firestoreCount,
        localCount: result.localStorageCount
      });
      onRefreshLocations();
    } catch (err: any) {
      setSyncAuditInfo({
        message: `เกิดข้อผิดพลาดในการตรวจสอบ Firestore: ${err?.message || 'โปรดตรวจสอบการเชื่อมต่อ'}`,
        type: 'warning',
        firestoreCount: 0,
        localCount: locations.length
      });
    } finally {
      setIsCheckingSync(false);
    }
  };

  const handleCopyTag = (triggerTag: string, id: string) => {
    navigator.clipboard.writeText(triggerTag);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteLocation(deleteTarget.id);
      await onRefreshLocations();
      setDeleteTarget(null);
    } catch (err: any) {
      alert('ไม่สามารถลบสถานที่ได้: ' + (err?.message || 'ข้อผิดพลาดเครือข่าย'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
              <Building className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                <span>คลังสถานที่ & ฉาก (Location Library)</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-semibold">
                  LOCATION LOCK
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                ล็อคความต่อเนื่องของห้อง สถาปัตยกรรม ผนัง พื้น ประตู และหน้าต่าง ข้ามคลิป
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleCheckFirestoreAndSync}
            disabled={isCheckingSync}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 font-medium py-2 px-3.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 text-xs active:scale-95 disabled:opacity-50"
            title="ตรวจสอบและซิงค์ข้อมูลกับ Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCheckingSync ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
            <span>{isCheckingSync ? 'กำลังซิงค์...' : 'ซิงค์กับ Firestore'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenModal}
            className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold py-2 px-4 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2 text-xs active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มสถานที่ใหม่ (New Location)</span>
          </button>
        </div>
      </div>

      {/* Sync Banner Status */}
      {syncAuditInfo && (
        <div
          className={`mb-6 p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
            syncAuditInfo.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncAuditInfo.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncAuditInfo(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Locations Grid */}
      {safeLocations.length === 0 ? (
        <div className="bg-[#0e1424] border border-dashed border-slate-800 rounded-3xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4 text-emerald-400">
            <Building className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">ยังไม่มีสถานที่ที่บันทึกไว้</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
            เพิ่มสถานที่หรือห้องอ้างอิงเพื่อใช้ในการล็อคความต่อเนื่องของฉาก (Location Continuity Lock) สำหรับผู้กำกับหลายคลิป
          </p>
          <button
            type="button"
            onClick={onOpenModal}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ สร้างสถานที่ใหม่</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {safeLocations.map((loc) => {
            const visual = loc.visualProfile;
            return (
              <div
                key={loc.id}
                className="bg-[#0e1424] border border-slate-800 hover:border-emerald-500/50 rounded-3xl overflow-hidden shadow-lg transition-all flex flex-col group"
              >
                {/* Image Banner */}
                <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                  <img
                    src={loc.referenceImageUrl || loc.thumbnailUrl || (loc.referenceImages && loc.referenceImages[0]) || loc.referenceImageBackup}
                    alt={loc.name}
                    onError={e => { const b = loc.referenceImageBackup; if (b && e.currentTarget.src !== b) e.currentTarget.src = b; }}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e1424] via-transparent to-black/40" />

                  {/* Badges Overlay */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
                    <span className="bg-emerald-900/80 backdrop-blur-md border border-emerald-400/50 text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      <span>{loc.lockStatus || 'LOCKED'}</span>
                    </span>
                    <span className="bg-slate-900/80 backdrop-blur-md border border-slate-700 text-slate-300 text-[10px] font-medium px-2 py-0.5 rounded-full">
                      LOCATION
                    </span>
                  </div>

                  {loc.imageHash && (
                    <div className="absolute top-3 right-3">
                      <span className="bg-black/70 backdrop-blur-md border border-white/10 text-slate-400 font-mono text-[9px] px-2 py-0.5 rounded-full">
                        #{loc.imageHash.slice(0, 8)}
                      </span>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-base font-bold text-white truncate drop-shadow-md">
                      {loc.name}
                    </h3>
                    <p className="text-[11px] text-emerald-300/90 font-medium truncate">
                      {visual?.architecturalStyle || visual?.environmentType || 'สถาปัตยกรรมต่อเนื่อง'}
                    </p>
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                  {/* Visual Blueprint Specs */}
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-2.5">
                      <div>
                        <span className="text-[10px] text-slate-500 block">ประเภทพื้นที่</span>
                        <span className="text-slate-200 font-medium truncate block">
                          {visual?.environmentType || 'Indoor'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">สไตล์สถาปัตยกรรม</span>
                        <span className="text-slate-200 font-medium truncate block">
                          {visual?.architecturalStyle || 'Modern'}
                        </span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-800/60">
                        <span className="text-[10px] text-slate-500 block">ผนัง & พื้น</span>
                        <p className="text-slate-300 text-[11px] line-clamp-1">
                          {visual?.wallColor || visual?.floor || 'ตามภาพอ้างอิง'}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-[10px] text-slate-500 block">ประตู & หน้าต่าง</span>
                        <p className="text-slate-300 text-[11px] line-clamp-1">
                          {visual?.doors || visual?.windows || 'ตามภาพอ้างอิง'}
                        </p>
                      </div>
                    </div>

                    {/* Trigger Tag */}
                    <div className="flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1.5">
                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">
                        {loc.triggerTag}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyTag(loc.triggerTag || '', loc.id)}
                        className="text-slate-400 hover:text-emerald-400 p-1 rounded transition-colors"
                        title="คัดลอก Trigger Tag"
                      >
                        {copiedId === loc.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => onUseLocationInStudio(loc.id)}
                      className="flex-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-500 py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
                      title="ส่งสถานที่นี้ไปยังผู้กำกับหลายคลิปเพื่อล็อคฉากต่อเนื่อง"
                    >
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ล็อคสถานที่ & กำกับคลิป</span>
                    </button>
                    {isLocationOwner(loc) && (
                      <button
                        type="button"
                        id={`btn-edit-location-${loc.id}`}
                        onClick={() => setEditTarget(loc)}
                        className="text-slate-300 hover:text-emerald-300 bg-slate-900/60 hover:bg-emerald-500/10 py-2 px-2.5 rounded-xl border border-slate-700 hover:border-emerald-500/40 transition-all cursor-pointer shrink-0 flex items-center gap-1 text-xs font-semibold"
                        title="แก้ไขคำอธิบายฉาก / รูปอ้างอิง (เฉพาะเจ้าของ)"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>แก้ไข (Edit)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget({ id: loc.id, name: loc.name })}
                      className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 p-2 rounded-xl border border-transparent hover:border-rose-500/20 transition-all cursor-pointer shrink-0"
                      title="ลบสถานที่"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editTarget && (
        <LocationEditModal
          location={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={saved => onRefreshLocations(saved)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1424] border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-white mb-1">ยืนยันการลบสถานที่?</h3>
              <p className="text-xs text-slate-400">
                คุณต้องการลบ <span className="text-white font-semibold">"{deleteTarget.name}"</span> ออกจากคลังสถานที่และ Firestore หรือไม่?
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-slate-300 py-2.5 rounded-xl text-xs font-medium transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Create Location Modal */}
      {isOpenModal && (
        <CreateLocationModal
          onClose={onCloseModal}
          onSaved={(newLoc) => {
            onRefreshLocations(newLoc);
            onCloseModal();
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// CREATE / ANALYZE LOCATION MODAL
// ==========================================

interface CreateLocationModalProps {
  onClose: () => void;
  onSaved: (newLoc: LocationItem) => void;
}

const CreateLocationModal: React.FC<CreateLocationModalProps> = ({ onClose, onSaved }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<'upload' | 'draft_review'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Uploaded Image State
  const [imageDataUrl, setImageDataUrl] = useState<string>('');
  const [imageHash, setImageHash] = useState<string>('');
  const [referenceImageId, setReferenceImageId] = useState<string>('');

  // 4-Layer Location Model Form State
  const [name, setName] = useState('');
  const [environmentType, setEnvironmentType] = useState('');
  const [architecturalStyle, setArchitecturalStyle] = useState('');
  const [wallColor, setWallColor] = useState('');
  const [floor, setFloor] = useState('');
  const [ceiling, setCeiling] = useState('');
  const [doors, setDoors] = useState('');
  const [windows, setWindows] = useState('');
  const [majorFurniture, setMajorFurniture] = useState('');
  const [fixedObjects, setFixedObjects] = useState('');
  const [spatialLayout, setSpatialLayout] = useState('');
  const [permanentDecor, setPermanentDecor] = useState('');
  const [distinctiveFeatures, setDistinctiveFeatures] = useState('');
  const [generatedVisualPrompt, setGeneratedVisualPrompt] = useState('');
  const [storyLocationName, setStoryLocationName] = useState('');
  const [description, setDescription] = useState('');
  const [analysisSource, setAnalysisSource] = useState<string>('');
  const [cachedHit, setCachedHit] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพที่ถูกต้อง (PNG, JPG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setImageDataUrl(base64);

      try {
        setIsAnalyzing(true);
        setAnalysisError(null);

        // 1. Compute deterministic hash
        const computedHash = await computeImageHash(base64);
        setImageHash(computedHash);

        // 2. Call server analyze-image (Cost guard checks cache first!)
        const res = await api.analyzeLocationImage([base64]);

        if (res && res.success && res.data) {
          const d = res.data;
          setName(d.name || 'สถานที่ถ่ายทำใหม่');
          setEnvironmentType(d.environmentType || 'Indoor');
          setArchitecturalStyle(d.architecturalStyle || 'Modern');
          setWallColor(d.wallColor || '');
          setFloor(d.floor || '');
          setCeiling(d.ceiling || '');
          setDoors(d.doors || '');
          setWindows(d.windows || '');
          setMajorFurniture(d.majorFurniture || '');
          setFixedObjects(d.fixedObjects || '');
          setSpatialLayout(d.spatialLayout || '');
          setPermanentDecor(d.permanentDecor || '');
          setDistinctiveFeatures(d.distinctiveFeatures || '');
          setGeneratedVisualPrompt(d.generatedVisualPrompt || '');
          setStoryLocationName(d.storyLocationName || d.name || '');
          setDescription(d.description || '');
          setReferenceImageId(d.referenceImageId || `ref_loc_${computedHash.slice(0, 10)}`);
          setAnalysisSource(res.source || 'gemini-flash');
          setCachedHit(Boolean(res.cached));
          setStep('draft_review');
        } else {
          throw new Error(res?.message || 'วิเคราะห์ไม่สำเร็จ');
        }
      } catch (err: any) {
        // Show the real error; the user fills the fields manually (nothing is labelled as AI output)
        console.warn('AI location analysis failed:', err?.message || err);
        setAnalysisError(err?.message || 'วิเคราะห์สถานที่ไม่สำเร็จ / Location analysis failed');
        setAnalysisSource('manual');
        setCachedHit(false);
        setName('สถานที่ถ่ายทำใหม่');
        setStep('draft_review');
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveLocation = async () => {
    if (!name.trim()) {
      alert('กรุณาระบุชื่อสถานที่');
      return;
    }

    setIsSaving(true);
    try {
      const locId = `loc_${Date.now()}`;
      const triggerTag = `(location_${name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()}:1.25)`;

      const newLocation: LocationItem = {
        id: locId,
        name: name.trim(),
        type: 'LOCATION',
        lockStatus: 'LOCKED',
        imageAnalysisStatus: 'USER_CONFIRMED',
        referenceImageUrl: imageDataUrl,
        referenceImages: [imageDataUrl],
        referenceImageId: referenceImageId || `ref_loc_${Date.now()}`,
        imageHash: imageHash || 'loc_hash_custom',
        thumbnailUrl: imageDataUrl,
        triggerTag,
        identity: {
          id: locId,
          name: name.trim()
        },
        referenceMetadata: {
          referenceImageId: referenceImageId || `ref_loc_${Date.now()}`,
          referenceImageUrl: imageDataUrl,
          imageHash: imageHash || 'loc_hash_custom',
          availableViews: ['WIDE_SHOT', 'CORNER_PERSPECTIVE'],
          imageAnalysisStatus: 'USER_CONFIRMED'
        },
        visualProfile: {
          environmentType,
          architecturalStyle,
          wallColor,
          floor,
          ceiling,
          doors,
          windows,
          majorFurniture,
          fixedObjects,
          spatialLayout,
          permanentDecor,
          distinctiveFeatures,
          generatedVisualPrompt,
          referenceImageUrl: imageDataUrl,
          referenceImageId: referenceImageId || `ref_loc_${Date.now()}`,
          imageHash: imageHash || 'loc_hash_custom',
          confidence: 95
        },
        storyProfile: {
          storyLocationName: storyLocationName || name.trim(),
          description,
          notes: ''
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const saved = await saveLocation(newLocation);
      onSaved(saved);
    } catch (err: any) {
      alert('บันทึกสถานที่ล้มเหลว: ' + (err?.message || 'ข้อผิดพลาดเครือข่าย'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0e1424] border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>สร้างและล็อคสถานที่ใหม่ (Location Lock)</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  4-Layer Architecture
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                สแกนและล็อคความต่อเนื่องของห้อง สถาปัตยกรรม ผนัง พื้น ประตู หน้าต่าง
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-3xl p-10 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-emerald-950/10 group"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-4 group-hover:scale-110 transition-transform">
                {isAnalyzing ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <UploadCloud className="w-8 h-8" />
                )}
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                {isAnalyzing ? 'AI กำลังวิเคราะห์สถาปัตยกรรมและรายละเอียดห้อง...' : 'คลิกเพื่อเลือกภาพสถานที่อ้างอิง (Location Reference)'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                รองรับ PNG, JPG, WebP ระบบจะคำนวณ Hash และวิเคราะห์ ผนัง พื้น ประตู หน้าต่าง และผังพื้นที่
              </p>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <ShieldCheck className="w-4 h-4" />
                <span>Cost Guard & Privacy</span>
              </div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                ระบบจะตรวจสอบ Cache ผ่าน SHA-256 Hash ก่อนเสมอ หากเคยวิเคราะห์ภาพนี้แล้วจะไม่เรียก Gemini Vision ซ้ำ
                เพื่อป้องกันค่าใช้จ่ายส่วนเกินโดยไม่จำเป็น
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Draft Review & Confirmation */}
        {step === 'draft_review' && (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Status Banner */}
            {analysisError && (
              <div role="alert" className="bg-rose-950/50 border border-rose-500/50 rounded-2xl p-3 text-xs text-rose-200 whitespace-pre-line">
                <strong className="text-rose-100">วิเคราะห์ด้วย AI ไม่สำเร็จ / AI analysis failed:</strong> {analysisError}
                <div className="text-rose-300/80 mt-1">กรุณากรอกรายละเอียดสถานที่เอง หรือตรวจสอบ Gemini API Key แล้วลองใหม่</div>
              </div>
            )}
            <div className={`${analysisSource === 'gemini-flash' || cachedHit ? 'bg-emerald-950/40 border-emerald-500/40' : 'bg-amber-950/40 border-amber-500/40'} border rounded-2xl p-3 flex items-center justify-between gap-3 text-xs`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-emerald-200">
                  {cachedHit
                    ? 'ดึงข้อมูลสำเร็จจาก Cache (0 API Calls / 0 Credits)'
                    : analysisSource === 'gemini-flash'
                      ? 'วิเคราะห์สำเร็จผ่าน Gemini'
                      : 'ยังไม่ได้วิเคราะห์ด้วย AI — กรอกข้อมูลเอง / Not analyzed by AI (manual entry)'}
                </span>
              </div>
              {imageHash && (
                <span className="font-mono text-[10px] text-emerald-300/80">
                  #{imageHash.slice(0, 8)}
                </span>
              )}
            </div>

            {/* Thumbnail Preview */}
            <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
              <img
                src={imageDataUrl}
                alt="Location Preview"
                className="w-24 h-16 rounded-xl object-cover border border-slate-700 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] text-slate-400 mb-1 font-medium">ชื่อสถานที่ (Location Name)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น ห้องนั่งเล่นมินิมอลโมเดิร์น"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                />
              </div>
            </div>

            {/* Layer 3: Visual Profile Specifications */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>สถาปัตยกรรม & องค์ประกอบความต่อเนื่อง (Architectural Continuity Blueprint)</span>
                </h3>
                <span className="text-[10px] text-slate-500">แก้ไขได้ตามต้องการ</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">ประเภทพื้นที่ (Environment Type)</label>
                  <input
                    type="text"
                    value={environmentType}
                    onChange={(e) => setEnvironmentType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">สไตล์สถาปัตยกรรม (Architectural Style)</label>
                  <input
                    type="text"
                    value={architecturalStyle}
                    onChange={(e) => setArchitecturalStyle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">ผนัง & สีผิว (Wall Color / Material)</label>
                  <input
                    type="text"
                    value={wallColor}
                    onChange={(e) => setWallColor(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">พื้น & ผิวสัมผัส (Floor)</label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">ประตู (Doors)</label>
                  <input
                    type="text"
                    value={doors}
                    onChange={(e) => setDoors(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">หน้าต่าง & แสงธรรมชาติ (Windows)</label>
                  <input
                    type="text"
                    value={windows}
                    onChange={(e) => setWindows(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-1">เฟอร์นิเจอร์ชิ้นหลัก (Major Furniture)</label>
                  <input
                    type="text"
                    value={majorFurniture}
                    onChange={(e) => setMajorFurniture(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] text-slate-400 mb-1">ผังพื้นที่ & จุดเด่นเฉพาะตัว (Spatial Layout & Distinctive)</label>
                  <input
                    type="text"
                    value={distinctiveFeatures}
                    onChange={(e) => setDistinctiveFeatures(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Factual set description = Location Lock (used verbatim in every clip) */}
            <div className="bg-slate-950/70 border border-emerald-800/40 rounded-2xl p-3.5 space-y-1.5">
              <label className="block text-[11px] font-semibold text-emerald-300">
                คำอธิบายฉากแบบข้อเท็จจริง (Location Lock — ใช้ตามตัวอักษรทุกคลิป)
              </label>
              <p className="text-[10px] text-slate-500">วัสดุ สี จำนวนต้นไม้/วัตถุ และเฟอร์นิเจอร์พร้อมตำแหน่ง — เขียนเฉพาะสิ่งที่เห็นในรูป</p>
              <textarea
                id="input-create-loc-description"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Generated Visual Prompt for Video Engine */}
            {generatedVisualPrompt && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-300">
                  AI Video Prompt สำหรับล็อคสถานที่ (Location Consistency Prompt):
                </label>
                <textarea
                  rows={2}
                  value={generatedVisualPrompt}
                  onChange={(e) => setGeneratedVisualPrompt(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-300 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="bg-slate-900 hover:bg-slate-800 text-slate-300 px-4 py-2.5 rounded-xl text-xs font-medium transition-all"
              >
                เลือกภาพใหม่
              </button>
              <button
                type="button"
                onClick={handleSaveLocation}
                disabled={isSaving || !name.trim()}
                className="flex-1 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-emerald-600/20 text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{isSaving ? 'กำลังบันทึกลงระบบ...' : 'ยืนยัน & ล็อคสถานที่ (Confirm & Lock)'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
