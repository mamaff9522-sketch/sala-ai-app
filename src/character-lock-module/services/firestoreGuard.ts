/**
 * Firestore Quota Guardian & Circuit Breaker
 * ป้องกันปัญหา Quota Limit Exceeded (Free Tier 20,000 writes/day)
 * จัดการ Fallback ไปยัง LocalStorage และ In-Memory โดยไม่ทำให้แอปล่มหรือติด Backoff Retry Loop
 */

const QUOTA_STORAGE_KEY = 'sala_firestore_quota_status';
const QUOTA_RESET_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 ชั่วโมง หรือเช็ควันใหม่

interface QuotaStatus {
  isExhausted: boolean;
  exhaustedAt: number;
  reason?: string;
}

let inMemoryQuotaExhausted = false;

export function isQuotaError(error: any): boolean {
  if (!error) return false;
  const code = error?.code || '';
  const message = String(error?.message || error || '').toLowerCase();
  
  return (
    code === 'resource-exhausted' ||
    code === 'RESOURCE_EXHAUSTED' ||
    message.includes('quota limit exceeded') ||
    message.includes('quota exceeded') ||
    message.includes('daily write units') ||
    message.includes('resource-exhausted') ||
    message.includes('free tier database')
  );
}

export function isFirestoreQuotaExhausted(): boolean {
  if (inMemoryQuotaExhausted) return true;

  try {
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!raw) return false;
    const status: QuotaStatus = JSON.parse(raw);
    
    // หากเกิน 12 ชั่วโมง ให้ลองรีเซ็ตสถานะเพื่อตรวจสอบใหม่อีกครั้ง
    if (Date.now() - status.exhaustedAt > QUOTA_RESET_INTERVAL_MS) {
      localStorage.removeItem(QUOTA_STORAGE_KEY);
      inMemoryQuotaExhausted = false;
      return false;
    }

    inMemoryQuotaExhausted = status.isExhausted;
    return status.isExhausted;
  } catch {
    return inMemoryQuotaExhausted;
  }
}

export function setFirestoreQuotaExhausted(reason?: any): void {
  inMemoryQuotaExhausted = true;
  try {
    const status: QuotaStatus = {
      isExhausted: true,
      exhaustedAt: Date.now(),
      reason: String(reason?.message || reason || 'Daily write units quota exceeded')
    };
    localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(status));
    
    // แจ้งเตือนทุกส่วนของแอปผ่าน Custom Event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sala:firestore-quota-exceeded', {
          detail: status
        })
      );
    }
  } catch (err) {
    console.warn('[FirestoreGuard] Failed to save quota status to storage:', err);
  }
  
  console.warn(
    '[FirestoreGuard] ⚠️ Firestore Daily Write Quota Reached. Operating in offline/local fallback mode.'
  );
}

export function resetFirestoreQuotaStatus(): void {
  inMemoryQuotaExhausted = false;
  try {
    localStorage.removeItem(QUOTA_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * ป้องกันการเรียกคำสั่ง Write ไปยัง Firestore หากโควตาเต็ม
 * ถ้าโควตาเต็ม หรือเกิดข้อผิดพลาด Quota Exceeded จะข้ามการส่งไปยัง Firestore ทันที
 * เพื่อไม่ให้ Firebase SDK เกิด Error "Using maximum backoff delay to prevent overloading the backend"
 */
export async function safeFirestoreWrite<T>(
  writeOp: () => Promise<T>,
  fallbackOp?: () => Promise<T> | T
): Promise<T | null> {
  if (isFirestoreQuotaExhausted()) {
    console.info('[FirestoreGuard] Skipping remote Firestore write due to active quota limit. Using fallback.');
    if (fallbackOp) {
      return await fallbackOp();
    }
    return null;
  }

  try {
    return await writeOp();
  } catch (error: any) {
    if (isQuotaError(error)) {
      setFirestoreQuotaExhausted(error);
      if (fallbackOp) {
        return await fallbackOp();
      }
      return null;
    }
    // หากเป็น error อื่น ส่งกลับให้ผู้เรียกตัดสินใจ
    throw error;
  }
}
