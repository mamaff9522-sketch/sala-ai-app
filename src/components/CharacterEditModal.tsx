import React, { useState } from 'react';
import { X, Save, Upload, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Character } from '../types';
import { saveCharacterToFirestore, getActiveUid } from '../services/characterService';
import { computeImageHash } from '../utils/imageHash';

/**
 * Owner-only "แก้ไข (Edit)" for a library card (locked or not): appearance / face / hair /
 * outfit / shoes / tag, and re-upload of the reference image. Saves to the same Firestore doc
 * (/users/{uid}/characters/{id}); lock status is kept, version and updatedAt are bumped.
 */
export function isCharacterOwner(char: Character | null | undefined): boolean {
  const uid = getActiveUid();
  return !!uid && !!char && (!char.userId || char.userId === uid);
}

export const CharacterEditModal: React.FC<{
  character: Character;
  onClose: () => void;
  onSaved: (saved: Character) => void | Promise<any>;
}> = ({ character, onClose, onSaved }) => {
  const vp: any = character.visualProfile || {};
  const [appearance, setAppearance] = useState(character.appearance || vp.visiblePhysicalAppearance || '');
  const [face, setFace] = useState(character.face || '');
  const [hair, setHair] = useState(character.hairStyle || vp.hairStyle || vp.hair || '');
  const [outfit, setOutfit] = useState(character.outfitDescription || character.costume || vp.visibleOutfit || '');
  const [shoes, setShoes] = useState(vp.shoes || character.structuredFeatures?.footwear || '');
  const [triggerTag, setTriggerTag] = useState(character.triggerTag || '');
  const [newImage, setNewImage] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const currentImage = character.referenceImageUrl || vp.referenceImageUrl || character.avatarUrl || '';

  const pickImage = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('กรุณาเลือกไฟล์รูปภาพ / Please choose an image file'); return; }
    const reader = new FileReader();
    reader.onload = () => { setNewImage(String(reader.result || '')); setError(''); };
    reader.onerror = () => setError('อ่านไฟล์รูปไม่สำเร็จ / Could not read the image');
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!isCharacterOwner(character)) { setError('แก้ไขได้เฉพาะเจ้าของตัวละคร / Only the owner can edit this character'); return; }
    setSaving(true);
    setError('');
    try {
      const now = new Date().toISOString();
      let next: Character = {
        ...character,
        appearance: appearance.trim(),
        face: face.trim(),
        hairStyle: hair.trim(),
        outfitDescription: outfit.trim(),
        triggerTag: triggerTag.trim(),
        visualProfile: character.visualProfile ? { ...character.visualProfile, hairStyle: hair.trim(), shoes: shoes.trim(), visibleOutfit: outfit.trim() || character.visualProfile.visibleOutfit } : character.visualProfile,
        structuredFeatures: character.structuredFeatures ? { ...character.structuredFeatures, footwear: shoes.trim() } : character.structuredFeatures,
        lockStatus: character.lockStatus, // unchanged
        version: (character.version || 1) + 1,
        updatedAt: now
      };
      if (newImage) {
        const hash = await computeImageHash(newImage).catch(() => '');
        const refId = `ref_${Date.now()}`;
        const others = (character.referenceImages || []).filter(img => img !== currentImage);
        next = {
          ...next,
          referenceImageUrl: newImage,
          referenceImageId: refId,
          imageHash: hash || character.imageHash,
          avatarUrl: newImage,
          referenceImages: [newImage, ...others],
          referenceImageBackup: undefined,
          referenceMetadata: character.referenceMetadata ? { ...character.referenceMetadata, referenceImageUrl: newImage, referenceImageId: refId, imageHash: hash || character.referenceMetadata.imageHash } : character.referenceMetadata,
          visualProfile: next.visualProfile ? { ...next.visualProfile, referenceImageUrl: newImage, referenceImage: newImage, referenceImageId: refId, imageHash: hash || next.visualProfile.imageHash } : next.visualProfile
        };
      }
      // Same doc id -> /users/{uid}/characters/{id} (Firestore rules: owner only)
      await saveCharacterToFirestore(next);
      await onSaved(next);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'บันทึกไม่สำเร็จ / Save failed');
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, value: string, set: (v: string) => void, rows = 2, id = '') => (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <textarea id={id} value={value} onChange={e => set(e.target.value)} rows={rows}
        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0e1424] border border-slate-700 w-full max-w-xl rounded-3xl p-5 shadow-2xl space-y-3 my-8" id="character-edit-modal">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white">แก้ไขตัวละคร (Edit): {character.name}</h3>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white" title="ปิด"><X className="w-4 h-4" /></button>
        </div>
        {character.lockStatus === 'LOCKED' && (
          <div className="text-[11px] text-emerald-300 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> ตัวละครนี้ LOCKED — สถานะล็อคจะคงเดิมหลังบันทึก</div>
        )}
        <div className="flex items-center gap-3">
          <img src={newImage || character.referenceImageBackup || currentImage} alt={character.name}
            onError={e => { const b = character.referenceImageBackup; if (b && e.currentTarget.src !== b) e.currentTarget.src = b; }}
            className="w-20 h-20 rounded-xl object-cover border border-slate-700 bg-slate-900" />
          <label className="flex-1 cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 flex items-center gap-2">
            <Upload className="w-4 h-4 text-indigo-400" />
            <span>{newImage ? 'เลือกรูปใหม่แล้ว (จะบันทึกเมื่อกดบันทึก)' : 'อัปโหลดรูปอ้างอิงใหม่ / Re-upload reference image'}</span>
            <input id="input-edit-char-reference" type="file" accept="image/*" className="hidden" onChange={e => pickImage(e.target.files?.[0])} />
          </label>
        </div>
        {field('รูปลักษณ์ (Appearance)', appearance, setAppearance, 4, 'input-edit-char-appearance')}
        {field('ใบหน้า (Face)', face, setFace, 2, 'input-edit-char-face')}
        {field('ทรงผม (Hair)', hair, setHair, 2, 'input-edit-char-hair')}
        {field('ชุด (Outfit)', outfit, setOutfit, 2, 'input-edit-char-outfit')}
        {field('รองเท้า (Shoes)', shoes, setShoes, 1, 'input-edit-char-shoes')}
        {field('Consistency Tag', triggerTag, setTriggerTag, 1, 'input-edit-char-tag')}
        {error && <div className="text-xs text-rose-300 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />{error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs text-slate-300 border border-slate-700 hover:bg-slate-800">ยกเลิก</button>
          <button type="button" onClick={handleSave} disabled={saving} id="btn-save-edit-char"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 flex items-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>บันทึก (Save)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
