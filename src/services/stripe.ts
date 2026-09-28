/**
 * Sala AI - Stripe Payment Service
 * รองรับการสร้าง Checkout Session โดยใช้ตัวแปร STRIPE_PUBLISHABLE_KEY และ STRIPE_SECRET_KEY
 * พร้อมระบบ Webhook เติมเครดิตเข้า Firestore users/{uid} ทันที
 */

import { loadStripe, Stripe as StripeJS } from '@stripe/stripe-js';

// อ่านค่า STRIPE_PUBLISHABLE_KEY จาก Client Environment Variable
export const STRIPE_PUBLISHABLE_KEY =
  (import.meta as any).env?.VITE_STRIPE_PUBLISHABLE_KEY ||
  (import.meta as any).env?.STRIPE_PUBLISHABLE_KEY ||
  '';

let stripePromise: Promise<StripeJS | null> | null = null;

/**
 * ดึงอ็อบเจกต์ Stripe SDK สำหรับ Client Side (ผ่าน loadStripe)
 */
export function getStripeClient(): Promise<StripeJS | null> {
  if (!stripePromise) {
    if (STRIPE_PUBLISHABLE_KEY) {
      stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
    } else {
      // ดึงจากเซิร์ฟเวอร์สำรอง หากไม่ได้ตั้งค่า VITE_ prefix
      stripePromise = fetch('/api/stripe/config')
        .then((res) => res.json())
        .then((data) => {
          if (data.publishableKey) {
            return loadStripe(data.publishableKey);
          }
          return null;
        })
        .catch(() => null);
    }
  }
  return stripePromise;
}

export interface CreditPackage {
  id: string;
  name: string;
  nameTh: string;
  credits: number;
  priceThb: number;
  priceUsd: number;
  badge?: string;
  popular?: boolean;
  description: string;
  features: string[];
  approxImages: number;
  approxVideos: number;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'pkg_starter_100',
    name: 'Starter Pack',
    nameTh: 'ชุดเริ่มต้น',
    credits: 100,
    priceThb: 99,
    priceUsd: 2.99,
    description: 'เหมาะสำหรับผู้เริ่มต้นทดลองสร้างภาพและคลิปสั้น',
    approxImages: 50,
    approxVideos: 10,
    features: [
      '100 เครดิตพร้อมใช้งานทันที',
      'สร้างภาพ AI ได้ประมาณ 50 ภาพ',
      'สร้างคลิปวิดีโอ Veo/Director ได้ประมาณ 10 คลิป',
      'ไม่มีวันหมดอายุ',
      'ซิงค์ยอดเข้า Firestore อัตโนมัติ'
    ]
  },
  {
    id: 'pkg_pro_500',
    name: 'Pro Creator',
    nameTh: 'ชุดยอดนิยม ครีเอเตอร์',
    credits: 500,
    priceThb: 399,
    priceUsd: 11.99,
    popular: true,
    badge: 'สุดคุ้ม ยอดนิยม ⭐',
    description: 'ประหยัดกว่า 20% เหมาะสำหรับทำคอนเทนต์ซีรีส์และสตอรี่บอร์ด',
    approxImages: 250,
    approxVideos: 50,
    features: [
      '500 เครดิตพร้อมใช้งานทันที',
      'สร้างภาพ AI ได้ประมาณ 250 ภาพ',
      'สร้างวิดีโอต่อเนื่อง Multi-Clip ได้ประมาณ 50 คลิป',
      'ประหยัดกว่าแพ็กเกจเริ่มต้น 20%',
      'สิทธิ์คิวประมวลผลความเร็วสูง (High Priority)',
      'ไม่มีวันหมดอายุ'
    ]
  },
  {
    id: 'pkg_master_1000',
    name: 'Master Director',
    nameTh: 'ชุดผู้กำกับมือโปร',
    credits: 1000,
    priceThb: 699,
    priceUsd: 19.99,
    badge: 'ลดพิเศษ 30%',
    description: 'สำหรับโปรดิวเซอร์ที่ต้องการผลิตหนังสั้นและคลิปยาวต่อเนื่อง',
    approxImages: 500,
    approxVideos: 100,
    features: [
      '1,000 เครดิตพร้อมใช้งานทันที',
      'สร้างภาพ AI ได้ประมาณ 500 ภาพ',
      'สร้างคลิปหนังสั้นเต็มเรื่องได้กว่า 100 คลิป',
      'ประหยัดสูงสุด 30%',
      'สิทธิ์การเข้าถึงโมเดลใหม่ก่อนใคร',
      'การสนับสนุนพิเศษทางเทคนิค'
    ]
  },
  {
    id: 'pkg_studio_2500',
    name: 'Studio Enterprise',
    nameTh: 'ชุดสตูดิโอโปรดักชัน',
    credits: 2500,
    priceThb: 1499,
    priceUsd: 42.99,
    badge: 'ความจุสูงสุด',
    description: 'ความจุสูงสุดสำหรับทีมงาน บริษัทโฆษณา และสตูดิโอขนาดใหญ่',
    approxImages: 1250,
    approxVideos: 250,
    features: [
      '2,500 เครดิตคุ้มค่าที่สุด',
      'สร้างภาพ AI ได้กว่า 1,250 ภาพ',
      'สร้างวิดีโอโปรดักชันได้กว่า 250 คลิป',
      'เรนเดอร์พร้อมกันได้สูงสุด ไม่จำกัดเพดาน',
      'ซัพพอร์ตระดับ VIP ตลอด 24 ชม.'
    ]
  }
];

export interface CreateCheckoutSessionParams {
  credits: number;
  packageId?: string;
  uid?: string;
  userEmail?: string;
  customAmountThb?: number;
}

export interface CheckoutSessionResponse {
  success: boolean;
  url: string;
  sessionId: string;
  isSimulator?: boolean;
  message?: string;
  error?: string;
}

/**
 * ฟังก์ชันสร้าง Stripe Checkout Session
 * เรียก API เซิร์ฟเวอร์ที่ใช้ STRIPE_SECRET_KEY จาก Environment Variable
 * @param params ข้อมูลเครดิต, UID ผู้ใช้ และอีเมล
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CheckoutSessionResponse> {
  const returnUrl = window.location.origin;

  const response = await fetch('/api/stripe/create-checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('sala_auth_id_token') || ''}`
    },
    body: JSON.stringify({
      credits: params.credits,
      packageId: params.packageId,
      uid: params.uid,
      userEmail: params.userEmail,
      customAmountThb: params.customAmountThb,
      returnUrl
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ (${response.status})`);
  }

  const data: CheckoutSessionResponse = await response.json();
  if (!data.success || !data.url) {
    throw new Error(data.error || 'ไม่ได้รับ URL สำหรับชำระเงินจาก Stripe');
  }

  return data;
}

/**
 * นำทางผู้ใช้ไปยังหน้าชำระเงิน Stripe Checkout
 * รองรับทั้ง Stripe.js SDK (เมื่อมี STRIPE_PUBLISHABLE_KEY) และ Direct URL Redirect
 * @param checkoutUrl URL หรือ SessionId ที่ได้รับจาก createCheckoutSession
 * @param sessionId Optional Stripe Checkout Session ID
 */
export async function redirectToCheckout(checkoutUrl: string, sessionId?: string): Promise<void> {
  if (!checkoutUrl && !sessionId) {
    throw new Error('ไม่พบ URL หรือ Session ID สำหรับชำระเงิน');
  }

  // พยายามใช้ Stripe.js SDK หากมี Session ID และ Publishable Key
  if (sessionId) {
    try {
      const stripe = await getStripeClient();
      if (stripe && typeof (stripe as any).redirectToCheckout === 'function') {
        const { error } = await (stripe as any).redirectToCheckout({ sessionId });
        if (!error) return;
        console.warn('Stripe.js redirect failed, falling back to direct URL:', error?.message);
      }
    } catch (err) {
      console.warn('Stripe.js checkout error, using direct redirect:', err);
    }
  }

  // นำทางผู้ใช้ไปยัง Stripe Checkout Direct URL ทันที
  if (checkoutUrl) {
    window.location.href = checkoutUrl;
  }
}

/**
 * ยืนยันสถานะ Session การชำระเงินหลังจาก Redirect กลับมาที่แอป
 * และตรวจสอบว่าเครดิตได้ถูกเติมเข้า Firestore users/{uid} เรียบร้อยแล้ว
 */
export async function verifyPaymentSession(sessionId: string): Promise<{
  success: boolean;
  creditsAdded: number;
  remainingCredits: number;
  message: string;
}> {
  const response = await fetch(`/api/stripe/verify-session?sessionId=${encodeURIComponent(sessionId)}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('sala_auth_id_token') || ''}`
    }
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'ไม่สามารถยืนยันสถานะการชำระเงินได้');
  }

  return await response.json();
}

/**
 * ดึงสถานะการตั้งค่า Stripe จากเซิร์ฟเวอร์ (ตรวจสอบ STRIPE_PUBLISHABLE_KEY & STRIPE_SECRET_KEY)
 */
export interface StripeConfig {
  success: boolean;
  publishableKey: string;
  hasSecretKey: boolean;
  isMock: boolean;
}

export async function fetchStripeConfig(): Promise<StripeConfig> {
  try {
    const res = await fetch('/api/stripe/config');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to fetch stripe config:', err);
  }
  return {
    success: true,
    publishableKey: STRIPE_PUBLISHABLE_KEY,
    hasSecretKey: false,
    isMock: true
  };
}
