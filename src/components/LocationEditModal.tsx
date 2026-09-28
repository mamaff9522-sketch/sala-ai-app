import React, { useState } from 'react';
import { X, Save, Upload, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { LocationItem } from '../types';
import { saveLocation, getActiveUid } from '../services/locationService';
import { locationDescriptionOf } from '../services/locationAppearance';
import { computeImageHash } from '../utils/imageHash';

/**
 * Owner-only "แก้ไข (Edit)" for a location card (locked or not): the factual set description
 * that is used VERBATIM as the Location Lock in every clip, the story alias, the tag, and
 * re-upload / replace of the reference photo (a compressed copy is stored in the Firestore doc).
 * Saves to the same doc (/users/{uid}/locations/{id}); lock status kept, version / updatedAt bumped.
 */
export function isLocationOwner(loc: LocationItem | null | undefined): boolean {
  const uid = getActiveUid();
  return !!uid && !!loc && (!loc.userId || loc.userId === uid);
}

export const LocationEditModal: React.FC<{
  location: LocationItem;
  onClose: () => void;
  onSaved: (saved: LocationItem) => void | Promise<any>;
}> = ({ location, onClose, onSaved }) => {
  const [name, setName] = useState(location.name || '');
  const [alias, setAlias] = useState(location.storyProfile?.storyLocationName && location.storyProfile.storyLocationName !== location.name ? location.storyProfile.storyLocationName : '');
  const [description, setDescription] = useState(locationDescriptionOf(location));
  const [triggerTag, setTriggerTag] = useState(location.triggerTag || '');
  const [newImage, setNewImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const currentImage = location.referenceImageUrl || location.thumbnailUrl || location.referenceImages?.[0] || '';

  const pickImage = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('กรุณาเลือกไฟล์รูปภาพ / Please choose an image file'); return; }
    const reader = new FileReader();
    reader.onload = () => { setNewImage(String(reader.result || '')); setError(''); };
    reader.onerror = () => setError('อ่านไฟล์รูปไม่สำเร็จ / Could not read the image');
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!isLocationOwner(location)) { setError('แก้ไขได้เฉพาะเจ้าของสถานที่ / Only the owner can edit this location'); return; }
    if (!name.trim()) { setError('กรุณาระบุชื่อสถานที่ / Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      let next: LocationItem = {
        ...location,
        name: name.trim(),
        identity: { ...(location.identity || { id: location.id }), id: location.id, name: name.trim() },
        storyProfile: { ...(location.storyProfile || {}), storyLocationName: alias.trim() || name.trim(), description: description.trim() },
        lockDescription: description.trim(),
        triggerTag: triggerTag.trim() || location.triggerTag,
        version: (location.version || 1) + 1,
        updatedAt: new Date().toISOString()
      };
      if (newImage) {
        const hash = await computeImageHash(newImage).catch(() => '');
        const refId = `ref_loc_${Date.now()}`;
        next = {
          ...next,
          referenceImageUrl: newImage,
          referenceImageId: refId,
          imageHash: hash || location.imageHash,
          referenceImages: [newImage],
          thumbnailUrl: newImage,
          referenceImageBackup: undefined, // rebuilt from the new photo in saveLocation
          referenceMetadata: location.referenceMetadata ? { ...location.referenceMetadata, referenceImageUrl: newImage, referenceImageId: refId, imageHash: hash || location.referenceMetadata.imageHash } : location.referenceMetadata
        };
      }
      // Upload + compressed copy + same doc id (Firestore rules: owner only); lock status kept
      const saved = await saveLocation(next, undefined, { keepLockStatus: true });
      await onSaved(saved);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'บันทึกไม่สำเร็จ / Save failed');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, rows = 2, id = '', hint = '') => (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      {hint && <span className="block text-[10px] text-slate-500">{hint}</span>}
      <textarea id={id} value={value} onChange={e => set(e.target.value)} rows={rows}
        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0e1424] border border-slate-700 w-full max-w-xl rounded-3xl p-5 shadow-2xl space-y-3 my-8" id="location-edit-modal">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">แก้ไขสถานที่ (Edit): {location.name}</h3>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white" title="ปิด"><X className="w-4 h-4" /></button>
        </div>
        {location.lockStatus === 'LOCKED' && (
          <div className="text-[11px] text-emerald-300 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> สถานที่นี้ LOCKED — สถานะล็อคจะคงเดิมหลังบันทึก</div>
        )}
        <div className="flex items-center gap-3">
          <img src={newImage || currentImage || location.referenceImageBackup} alt={location.name}
            onError={e => { const b = location.referenceImageBackup; if (b && e.currentTarget.src !== b) e.currentTarget.src = b; }}
            className="w-28 h-20 rounded-xl object-cover border border-slate-700 bg-slate-900" />
          <label className="flex-1 cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>{newImage ? 'เลือกรูปใหม่แล้ว (จะบันทึกเมื่อกดบันทึก)' : 'อัปโหลด / เปลี่ยนรูปอ้างอิงสถานที่ / Upload or replace reference photo'}</span>
            <input id="input-edit-loc-reference" type="file" accept="image/*" className="hidden" onChange={e => pickImage(e.target.files?.[0])} />
          </label>
        </div>
        {field('ชื่อสถานที่ (Name)', name, setName, 1, 'input-edit-loc-name', 'ชื่อที่ใช้ในบท เช่น "ห้องครัว" — จับคู่แบบตรงชื่อเท่านั้น')}
        {field('ชื่อเรียกในบท (Alias, ไม่บังคับ)', alias, setAlias, 1, 'input-edit-loc-alias', 'เช่น "หน้าบ้าน" ถ้าบทเรียกสถานที่นี้ด้วยชื่ออื่น')}
        {field('คำอธิบายฉากแบบข้อเท็จจริง (Location Lock — ใช้ตามตัวอักษรทุกคลิป)', description, setDescription, 8, 'input-edit-loc-description',
          'วัสดุ สี จำนวนต้นไม้/วัตถุ และเฟอร์นิเจอร์พร้อมตำแหน่ง (ซ้าย/กลาง/ขวา/หน้า/หลัง) — ห้ามเขียนสิ่งที่ไม่มีในรูป')}
        {field('Trigger Tag', triggerTag, setTriggerTag, 1, 'input-edit-loc-tag')}
        {error && <div className="text-xs text-rose-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs text-slate-300 border border-slate-700 hover:bg-slate-800">ยกเลิก</button>
          <button type="button" onClick={handleSave} disabled={saving} id="btn-save-edit-loc"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 flex items-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>บันทึก (Save)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
