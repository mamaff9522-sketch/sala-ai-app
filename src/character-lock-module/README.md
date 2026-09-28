# 🎭 Character Lock Module (`@sala/character-lock-module`)

ระบบ Character Lock ระดับโปรดักชันที่ดึงมาจาก Sala AI Master Engine ครบทั้งชุด สำหรับใช้ล็อคความต่อเนื่องของรูปลักษณ์ตัวละคร (ใบหน้า, ทรงผม, สีผิว, เสื้อผ้า, เครื่องประดับ) ข้ามฉากและข้ามคลิปใน AI Video & Image Generation

---

## 📌 คุณสมบัติเด่น (Key Features)

1. **4-Layer Character Architecture**:
   - **Layer 1: Identity** (`CharacterIdentity`) - รหัสประจำตัว ID (`char_...`), ชื่อตัวละคร, trigger tag
   - **Layer 2: Reference Metadata** (`CharacterReferenceMetadata`) - SHA-256 image hash, URL รูปถาวร, ข้อมูล OCR จาก Reference Sheet (ชื่อ, อายุ, ส่วนสูงที่อ่านได้จริง), รายการมุมมองภาพ (`availableViews`)
   - **Layer 3: Visual Profile** (`CharacterVisualProfile`) - วิเคราะห์รูปลักษณ์ทางกายภาพจากสายตาจริง (ทรงผม, สีผม, สรีระ, เสื้อผ้าบน/ล่าง, รองเท้า, จุดเด่น)
   - **Layer 4: Story Profile** (`CharacterStoryProfile`) - บทบาท, อาชีพ, อุปนิสัย (แยกเลเยอร์ชัดเจน ห้าม AI เดาจากรูป)

2. **Deterministic SHA-256 Hashing & Cost Guard**:
   - คำนวณ Hash ของรูปอ้างอิงทุกครั้ง ป้องกันการเรียก Gemini Multimodal API ซ้ำซ้อน ช่วยประหยัด Token และค่าใช้จ่าย

3. **Gemini 2.5 Flash Multimodal OCR & Analyzer**:
   - วิเคราะห์ภาพเดี่ยวหรือ Multi-View Reference Sheet ด้วย Strict Protocol
   - อ่านข้อความ OCR บนภาพ (เช่น `AGE: 30`, `NAME`, `HEIGHT`) โดยไม่เดาค่า
   - ตรวจจับว่าทุกมุมมองใน Sheet คือคนเดียวกัน (Single Character)

4. **Dynamic Prompt Injection Engine**:
   - แทรก Trigger Tag, รายละเอียดชุด และคำสั่ง Consistency Lock เข้าสู่ Prompt ปลายทางอัตโนมัติ

5. **Production UI (`CharacterLibrary`)**:
   - คอมโพเนนต์ React สวยงาม พร้อมระบบอัพโหลดรูป, ตรวจสอบสถานะการวิเคราะห์, ปรับระดับความเสถียร (Consistency Strength 0.1 - 1.0), ปุ่มล็อค/ปลดล็อคตัวละคร

6. **Dual Storage Engine**:
   - บันทึกลง Cloud Firestore อัตโนมัติ พร้อมระบบ Circuit Breaker และ Fallback ลง LocalStorage ในกรณีโควต้าฟรีเต็ม

---

## 📁 โครงสร้างโฟลเดอร์ (Module Architecture)

```
character-lock-module/
├── README.md               # คู่มือการติดตั้งและใช้งานฉบับสมบูรณ์
├── package.json            # นิยาม Dependency ของโมดูล
├── index.ts                # จุด Export หลักของทั้งโมดูล
├── types.ts                # TypeScript Type Definitions ทั้งหมด
├── core/
│   ├── imageHash.ts        # การคำนวณ Deterministic SHA-256 ของรูปภาพ
│   └── characterEngine.ts  # ตัวจัดการ ID, Trigger Tag, การ Normalization 4-Layer, Lock Toggle
├── vision/
│   ├── analyzeCharacterImage.ts  # Client-side Image Analyzer พร้อม Caching
│   ├── serverVisionHandler.ts    # Server-side Gemini 2.5 Flash Multimodal Analyzer
│   └── referenceUploader.ts      # การจัดเก็บรูปภาพอ้างอิงลง Disk Storage
├── storage/
│   ├── characterService.ts # ตัวเชื่อมต่อ Firestore และ LocalStorage
│   ├── firestoreGuard.ts   # ป้องกัน Quota Exceeded (Circuit Breaker)
│   └── auth.ts             # การจัดการ User UID และ Session
├── prompt/
│   └── promptInjector.ts   # แปลง Character เป็น Prompt Token สำหรับวิดีโอ/รูปภาพ
├── components/
│   └── CharacterLibrary.tsx # React Component หลักสำหรับจัดการตัวละคร
├── services/               # Internal API & Storage Adapters
├── utils/                  # Internal Utilities
└── examples/
    ├── basicUsage.tsx      # ตัวอย่างการใช้งานบน React Frontend
    └── serverExample.ts    # ตัวอย่างการตั้งค่า Endpoint บน Express Server
```

---

## 🚀 วิธีการใช้งาน (Quick Start)

### 1. การนำเข้าบน React Frontend

```tsx
import React, { useState } from 'react';
import {
  CharacterLibrary,
  injectCharacterIntoPrompt,
  toggleCharacterLock,
  Character
} from './character-lock-module';

export const MyStudioApp = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('เดินเล่นริมแม่น้ำเจ้าพระยายามเย็น');

  const activeChar = characters.find(c => c.id === selectedCharId);

  // ผสมผสานรายละเอียดตัวละครที่ล็อคไว้เข้ากับ Prompt วิดีโอจริง
  const finalPrompt = activeChar
    ? injectCharacterIntoPrompt(prompt, activeChar, { strictContinuity: true })
    : prompt;

  return (
    <div>
      <CharacterLibrary
        characters={characters}
        onRefreshCharacters={(saved) => {
          if (saved) setCharacters(prev => [saved, ...prev]);
        }}
        onUseCharacterInStudio={(id) => setSelectedCharId(id)}
        isOpenModal={true}
        onCloseModal={() => {}}
        onOpenModal={() => {}}
      />
      <div className="final-prompt-display">
        <strong>Prompt ส่งไปยัง Model:</strong>
        <p>{finalPrompt}</p>
      </div>
    </div>
  );
};
```

### 2. การตั้งค่า Backend Endpoints (Node.js / Express)

โมดูลนี้ต้องการ Endpoint ฝั่ง Server สำหรับการอัพโหลดรูปภาพและเรียกใช้ Gemini Multimodal API:

```ts
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import {
  handleCharacterAnalysisRequest,
  persistReferenceImageToDisk
} from './character-lock-module';

const app = express();
app.use(express.json({ limit: '50mb' }));

const aiClient = new GoogleGenAI();
const UPLOAD_DIR = './public/uploads/characters';

// 1. Endpoint อัพโหลดภาพอ้างอิง
app.post('/api/character/upload-reference', async (req, res) => {
  const { image, referenceImageId } = req.body;
  const result = persistReferenceImageToDisk(image, UPLOAD_DIR, referenceImageId);
  res.json({ success: true, ...result });
});

// 2. Endpoint วิเคราะห์ภาพด้วย Gemini Flash Vision
app.post('/api/character/analyze-image', async (req, res) => {
  const result = await handleCharacterAnalysisRequest(req.body, aiClient, {
    persistReferenceImage: (dataUri, refId) => persistReferenceImageToDisk(dataUri, UPLOAD_DIR, refId)
  });
  res.json(result);
});
```

---

## 🔒 ลำดับขั้นตอน Character Lock (Execution Flow)

1. **Upload**: ผู้ใช้อัพโหลดรูปตัวละครเดี่ยว หรือแผ่น Reference Sheet
2. **Hash & Cache Check**: ระบบคำนวณ `SHA-256` ของ Base64 Data เพื่อตรวจว่าเคยวิเคราะห์ภาพนี้แล้วหรือไม่
3. **Multimodal Vision OCR**: Gemini 2.5 Flash สแกนหาข้อความชื่อ/อายุ/ส่วนสูง และแยกแยะมุมมองต่าง ๆ
4. **4-Layer Profile Build**: ระบบประกอบโครงสร้างข้อมูล แยก Visual Attributes ออกจาก Story Background
5. **Lock Activation**: ผู้ใช้กดปุ่ม **LOCKED** เพื่อตรึงสรีระและชุดของตัวละคร
6. **Prompt Injection**: เมื่อสั่ง Render คลิป ระบบจะดึง `triggerTag` + `visualProfile` + `outfit` ไปฉีดเข้าหน้า Prompt เพื่อให้ AI คุมใบหน้าและเครื่องแต่งกายให้เหมือนกัน 100%

---

## 📄 License
MIT © Sala AI Engineering Team
