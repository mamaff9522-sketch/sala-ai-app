/**
 * Character Lock Module - Reference Image Uploader & Storage Adapter
 * Handles persistent reference image uploads, hash computation, and format validation.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface UploadReferenceResult {
  success: boolean;
  referenceImageId: string;
  referenceImageUrl: string;
  imageHash: string;
  message?: string;
}

/**
 * Persists base64 reference images to local disk storage
 */
export function persistReferenceImageToDisk(
  dataUriOrBase64: string,
  targetDirectory: string,
  customReferenceId?: string
): { referenceImageId: string; referenceImageUrl: string; imageHash: string } {
  if (!fs.existsSync(targetDirectory)) {
    fs.mkdirSync(targetDirectory, { recursive: true });
  }

  let mimeType = 'image/jpeg';
  let ext = 'jpg';
  let base64Data = dataUriOrBase64;

  const match = dataUriOrBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    mimeType = match[1];
    base64Data = match[2];
    if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('gif')) ext = 'gif';
  }

  const hash = crypto.createHash('sha256').update(base64Data).digest('hex');
  const refId = customReferenceId || `ref_${hash.slice(0, 10)}_${Date.now()}`;
  const filename = `${refId}.${ext}`;
  const filePath = path.join(targetDirectory, filename);

  fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

  return {
    referenceImageId: refId,
    referenceImageUrl: `/uploads/characters/${filename}`,
    imageHash: hash
  };
}

/**
 * Client helper to upload reference image to server endpoint
 */
export async function uploadReferenceImage(
  imageData: string,
  customId?: string,
  imageHash?: string
): Promise<UploadReferenceResult> {
  const res = await fetch('/api/character/upload-reference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageData,
      referenceImageId: customId,
      imageHash
    })
  });

  if (!res.ok) {
    throw new Error('Failed to upload character reference image');
  }

  return await res.json();
}
