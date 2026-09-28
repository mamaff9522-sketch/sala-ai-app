# คู่มือการเตรียมและแพ็กเกจ Sala AI เป็นแอปพลิเคชัน Android สำหรับ Google Play Store

เอกสารฉบับนี้อธิบายสถาปัตยกรรมและขั้นตอนการนำโปรเจกต์ **ศาลาเอไอ (Sala AI)** ไปสร้างเป็นไฟล์ Android Package (`.apk` / `.aab`) เพื่อส่งขึ้น **Google Play Store** อย่างปลอดภัย โดยรักษาโครงสร้างความปลอดภัยสูงสุด: **ห้ามฝัง API Keys หรือ Secrets ใดๆ ไว้ในตัวแอป Android อย่างเด็ดขาด**

---

## 1. หลักการความปลอดภัยระดับสถาปัตยกรรม (Security Architecture)

1. **Zero Secret in APK / Bundle**:
   - ไฟล์ APK/AAB จะไม่มี `GEMINI_API_KEY`, `META_API_KEY`, รหัสผ่านฐานข้อมูล หรือ Token ลับใดๆ
   - Client ทำหน้าที่เป็น UI ติดต่อกับ Server ผ่าน REST API ที่ปลอดภัย (`https://.../api/*`)
2. **Server-Side Enforcement**:
   - การตรวจสอบสิทธิ์ (Authentication), สิทธิ์ผู้ใช้ (Role-based Access Control: Admin/User), การคิดค่าใช้จ่าย, การหักเครดิต และการเรียก Google Veo API ทำงานบน Cloud Server 100%
3. **Session & Token Handling**:
   - บัญชีผู้ใช้ซิงก์ตรงกันทั้งบน Web และ Android App ผ่านระบบเซสชันเดียวกัน

---

## 2. ทางเลือกในการสร้าง Android App

### ทางเลือกที่ 1: Trusted Web Activity (TWA) ผ่าน Google Bubblewrap (แนะนำอย่างยิ่งสำหรับ Play Store)

Google แนะนำสถาปัตยกรรม **TWA (Trusted Web Activity)** เนื่องจาก:
- ใช้ Chrome Custom Tabs ที่เร็วและอัปเดตความปลอดภัยอัตโนมัติ
- ไม่ต้องบำรุงรักษาโค้ดแยก 2 ชุด เมื่ออัปเดตเว็บฝั่ง Server ผู้ใช้บน Android จะได้ฟีเจอร์ใหม่ทันที
- ไฟล์ขนาดเล็กมาก (< 3 MB) และผ่านเงื่อนไขของ Google Play Store 100%

#### ขั้นตอนการทำด้วย Bubblewrap CLI:
1. ติดตั้ง Node.js และ Bubblewrap CLI:
   ```bash
   npm install -g @bubblewrap/cli
   ```
2. ดึงการตั้งค่าจาก Web App Manifest:
   ```bash
   bubblewrap init --manifest=https://your-production-domain.com/manifest.json
   ```
3. ระบุชื่อแพ็กเกจ (เช่น `ai.sala.studio`) และกรอกข้อมูล keystore
4. ตรวจสอบการผูก Digital Asset Links (`.well-known/assetlinks.json`) เพื่อเปิดโหมด Full-screen ไร้แถบ URL bar
5. สร้าง Android App Bundle (`.aab`):
   ```bash
   bubblewrap build
   ```

---

### ทางเลือกที่ 2: Capacitor (Native Wrapper)

หากต้องการเพิ่มความสามารถ Native เชิงลึก (เช่น Background Push Notifications, Haptic Feedback):
1. ติดตั้ง Capacitor:
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init "Sala AI" "ai.sala.studio" --web-dir dist
   ```
2. สร้าง Production Build:
   ```bash
   npm run build
   ```
3. เพิ่ม Android Platform:
   ```bash
   npx cap add android
   npx cap open android
   ```
4. ใน Android Studio: Build > Generate Signed Bundle / APK > Android App Bundle สำหรับส่งเข้า Google Play Console

---

## 3. Checklist ก่อนส่งขึ้น Google Play Console

- [x] **Web App Manifest**: ไฟล์ `/manifest.json` ถูกเชื่อมต่อใน `index.html` เรียบร้อยแล้ว
- [x] **Mobile-First UI**: Touch targets ทุกปุ่มมีขนาดอย่างน้อย 44px x 44px รองรับการแตะบนมือถือ Android
- [x] **Viewport Configuration**: `viewport-fit=cover`, `user-scalable=no` เพื่อความรู้สึกแบบ Native
- [x] **Zero Frontend API Secrets**: ไม่มี Environment variables ลับใน JavaScript bundle
- [x] **Privacy Policy & Terms**: มีหน้าเงื่อนไขและนโยบายความเป็นส่วนตัวสำหรับแอปสื่อสร้างสรรค์
- [x] **Content Rating**: จัดอยู่ในหมวดหมู่เครื่องมือการผลิต (Productivity / Video Editing)
