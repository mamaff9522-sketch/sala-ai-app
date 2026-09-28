/**
 * Character Lock Module - Server Integration Example
 * Demonstrates mounting the Character Lock endpoints on an Express server.
 */

import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { handleCharacterAnalysisRequest } from '../vision/serverVisionHandler';
import { persistReferenceImageToDisk } from '../vision/referenceUploader';

const app = express();
app.use(express.json({ limit: '50mb' }));

const UPLOADS_CHARACTERS_DIR = path.join(process.cwd(), 'public', 'uploads', 'characters');
const aiClient = process.env.GEMINI_API_KEY ? new GoogleGenAI() : null;

// 1. Reference Image Upload Endpoint
app.post('/api/character/upload-reference', async (req, res) => {
  try {
    const { image, referenceImageId } = req.body || {};
    if (!image) return res.status(400).json({ success: false, message: 'Image is required' });

    const persisted = persistReferenceImageToDisk(image, UPLOADS_CHARACTERS_DIR, referenceImageId);
    return res.json({
      success: true,
      referenceImageId: persisted.referenceImageId,
      referenceImageUrl: persisted.referenceImageUrl,
      imageHash: persisted.imageHash
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Multimodal Vision Analyzer Endpoint
app.post('/api/character/analyze-image', async (req, res) => {
  try {
    const result = await handleCharacterAnalysisRequest(
      req.body,
      aiClient,
      {
        persistReferenceImage: (dataUri, customId) =>
          persistReferenceImageToDisk(dataUri, UPLOADS_CHARACTERS_DIR, customId)
      }
    );
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default app;
