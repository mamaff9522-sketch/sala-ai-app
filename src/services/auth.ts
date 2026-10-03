/**
 * Sala AI - Firebase Authentication & Firestore Service
 * รองรับ Google Sign-in และการจัดเก็บ API Key ผูกกับ UID ของผู้ใช้ใน Firestore
 * ตั้งค่า session ค้างถาวรด้วย browserLocalPersistence และ Auto-Refresh Token ก่อนหมดอายุ
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  setPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  onIdTokenChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseAppletConfig from '../../firebase-applet-config.json';
import {
  safeFirestoreWrite,
  isFirestoreQuotaExhausted,
  setFirestoreQuotaExhausted,
  isQuotaError
} from './firestoreGuard';

// Keys สำหรับ localStorage
const AUTH_TOKEN_KEY = 'sala_auth_id_token';
const AUTH_USER_KEY = 'sala_auth_user_cache';
const AUTH_TOKEN_EXP_KEY = 'sala_auth_token_exp';
const AUTH_USER_ROLE_KEY = 'sala_user_role';

// Environment variables requested for Firebase client configuration with automatic fallback to firebase-applet-config.json:
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId || '',
};

// Check for missing configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn(
    'Firebase configuration is missing. Please check your environment variables or firebase-applet-config.json.'
  );
}

// Initialize Firebase App instance safely (singleton)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/**
 * Initialize Firebase Auth โดยตั้งค่า browserLocalPersistence ทันทีตั้งแต่ขั้นตอน initializeApp
 * เพื่อให้ session ค้างถาวรในเบราว์เซอร์ ไม่หลุดเมื่อปิดหรือรีเฟรชหน้าเว็บ
 */
function createFirebaseAuth() {
  try {
    return initializeAuth(app, {
      persistence: browserLocalPersistence,
      popupRedirectResolver: browserPopupRedirectResolver
    });
  } catch {
    const existingAuth = getAuth(app);
    setPersistence(existingAuth, browserLocalPersistence).catch(() => {});
    return existingAuth;
  }
}

export const auth = createFirebaseAuth();

// ยืนยันการตั้งค่า browserLocalPersistence กับ auth instance
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Failed to set browserLocalPersistence on initializeApp:', err);
});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Initialize Firestore with databaseId if specified in environment variable or config
const dbId = import.meta.env.VITE_FIREBASE_DATABASE_ID || firebaseAppletConfig.firestoreDatabaseId;
export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

// Test Firestore connection safely (no auto-run to prevent unauthenticated RPC permission errors)
export async function validateFirestoreConnection() {
  if (isFirestoreQuotaExhausted()) {
    return;
  }
  try {
    if (auth.currentUser) {
      await getDocFromServer(doc(db, 'test', 'connection'));
    }
  } catch (error: any) {
    if (isQuotaError(error)) {
      setFirestoreQuotaExhausted(error);
    }
  }
}

/**
 * ฟังก์ชันจัดการ LocalStorage ของ Token และ User
 * ดึง Token กลับมาตอนเปิดแอป เพื่อให้ session ค้างถาวร
 */
export function saveAuthTokenToStorage(token: string): void {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem('sala_auth_token', token);
  }
}

export function getStoredToken(): string {
  return localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem('sala_auth_token') || '';
}

export interface StoredUserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'user';
}

export const DEFAULT_DEMO_USER: StoredUserProfile = {
  uid: 'demo_creator',
  email: 'creator@sala.ai',
  displayName: 'ผู้ใช้ทดสอบ (Demo Mode)',
  photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  role: 'user'
};

export function cacheUserData(user: User, role?: 'admin' | 'user'): void {
  try {
    const effectiveRole: 'admin' | 'user' = role === 'admin' ? 'admin' : (localStorage.getItem(AUTH_USER_ROLE_KEY) === 'admin' ? 'admin' : 'user');
    const userData: StoredUserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      role: effectiveRole
    };
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
    localStorage.setItem(AUTH_USER_ROLE_KEY, effectiveRole);
  } catch (err) {
    console.warn('Failed to cache user data:', err);
  }
}

export function getStoredUser(): StoredUserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const role: 'admin' | 'user' = (parsed.role === 'admin' || localStorage.getItem(AUTH_USER_ROLE_KEY) === 'admin') ? 'admin' : 'user';
    return { ...parsed, role };
  } catch {
    return null;
  }
}

/**
 * ตรวจสอบว่าเป็นผู้ใช้เดโม (Demo) หรือยังไม่ได้ล็อกอินจริงหรือไม่
 */
export function isDemoUser(user: { uid?: string } | null | undefined): boolean {
  if (!user || !user.uid) return true;
  return user.uid === 'demo_creator';
}

/**
 * ดึง role ของผู้ใช้จาก Firestore โดยตรงตามเงื่อนไข role === "admin"
 */
export async function fetchUserRole(uid: string): Promise<'admin' | 'user'> {
  if (uid === 'demo_creator') {
    return 'user';
  }
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const role: 'admin' | 'user' = data?.role === 'admin' ? 'admin' : 'user';
      localStorage.setItem(AUTH_USER_ROLE_KEY, role);
      return role;
    } else {
      localStorage.setItem(AUTH_USER_ROLE_KEY, 'user');
      return 'user';
    }
  } catch (err) {
    console.warn('Error fetching user role from Firestore:', err);
    const cachedRole = (localStorage.getItem(AUTH_USER_ROLE_KEY) === 'admin') ? 'admin' : 'user';
    return cachedRole;
  }
}

/**
 * สร้าง object User จำลองจากข้อมูลที่บันทึกไว้ใน localStorage
 * เพื่อให้ UI สลับสถานะล็อกอินได้ทันทีโดยไม่ต้องรอ Firebase asynchronous initialization
 */
export function getStoredUserAsUser(): User | null {
  const cached = getStoredUser();
  if (!cached) return null;
  const token = getStoredToken() || 'cached_token';
  return {
    uid: cached.uid,
    email: cached.email,
    displayName: cached.displayName,
    photoURL: cached.photoURL,
    getIdToken: async () => token
  } as unknown as User;
}

/**
 * ล้างข้อมูล session จาก localStorage เฉพาะเมื่อผู้ใช้กดออกจากระบบ (Logout) เองเท่านั้น
 */
export function clearAuthStorage(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem('sala_auth_token');
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(AUTH_TOKEN_EXP_KEY);
  localStorage.removeItem(AUTH_USER_ROLE_KEY);
}

/**
 * ตรวจสอบและ Refresh Token อัตโนมัติก่อนหมดอายุ
 * ถ้าเหลือเวลาน้อยกว่า 10 นาที หรือ force refresh จะดึง Token ใหม่และบันทึกลง localStorage ทันที
 */
export async function checkAndRefreshToken(user: User, force: boolean = false): Promise<string> {
  try {
    const tokenResult = await user.getIdTokenResult(force);
    const expTime = new Date(tokenResult.expirationTime).getTime();
    const now = Date.now();
    const tenMinutesMs = 10 * 60 * 1000;

    // ถ้า Token เหลือเวลาน้อยกว่า 10 นาที หรือต้องการ force refresh ให้ refresh ทันทีก่อนหมดอายุ
    if (force || expTime - now < tenMinutesMs) {
      const refreshedToken = await user.getIdToken(true);
      saveAuthTokenToStorage(refreshedToken);
      const newResult = await user.getIdTokenResult();
      localStorage.setItem(AUTH_TOKEN_EXP_KEY, new Date(newResult.expirationTime).getTime().toString());
      return refreshedToken;
    } else {
      saveAuthTokenToStorage(tokenResult.token);
      localStorage.setItem(AUTH_TOKEN_EXP_KEY, expTime.toString());
      return tokenResult.token;
    }
  } catch (err) {
    console.warn('Failed to refresh token:', err);
    return getStoredToken();
  }
}

// Background timer สำหรับตรวจสอบ Token ทุก 5 นาที
let tokenRefreshTimer: ReturnType<typeof setInterval> | null = null;

function startTokenRefreshTimer(user: User): void {
  if (tokenRefreshTimer) {
    clearInterval(tokenRefreshTimer);
  }
  // ตรวจสอบสถานะ Token ทุก 5 นาที ถ้าใกล้หมดจะ refresh ก่อนหมดอายุ
  tokenRefreshTimer = setInterval(async () => {
    if (auth.currentUser) {
      await checkAndRefreshToken(auth.currentUser);
    }
  }, 5 * 60 * 1000);
}

function stopTokenRefreshTimer(): void {
  if (tokenRefreshTimer) {
    clearInterval(tokenRefreshTimer);
    tokenRefreshTimer = null;
  }
}

// ติดตามการเปลี่ยนแปลง ID Token ของ Firebase อัตโนมัติและเก็บลง localStorage
onIdTokenChanged(auth, async (user) => {
  if (user) {
    try {
      const token = await user.getIdToken();
      saveAuthTokenToStorage(token);
      cacheUserData(user);
    } catch (err) {
      console.warn('onIdTokenChanged token update error:', err);
    }
  }
  // หมายเหตุ: ไม่ล้าง localStorage ที่นี่ เพื่อรักษา session ค้างไว้จนกว่าจะกด logout เอง
});

/**
 * เข้าสู่ระบบด้วย Google (Google Sign-In)
 * - ใช้ setPersistence(auth, browserLocalPersistence) ก่อน signInWithPopup
 * - บังคับใช้ prompt: 'select_account' เพื่อให้ผู้ใช้สามารถเลือกบัญชีที่ต้องการได้เสมอ
 * - บันทึกและรีเฟรช token ลง localStorage ทันที
 */
export async function loginWithGoogle(): Promise<User> {
  try {
    // บังคับใช้ setPersistence(auth, browserLocalPersistence) ก่อน signInWithPopup
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (user) {
      // ดึงและเก็บ token ลง localStorage ทันที
      const token = await user.getIdToken(true);
      saveAuthTokenToStorage(token);
      startTokenRefreshTimer(user);

      // บันทึกหรืออัปเดตข้อมูลผู้ใช้เบื้องต้นลงใน Firestore (users/{uid}) พร้อมดึง role
      const userRef = doc(db, 'users', user.uid);
      let determinedRole: 'admin' | 'user' = (user.email === 'mama.ff9522@gmail.com') ? 'admin' : 'user';

      try {
        if (!isFirestoreQuotaExhausted()) {
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            determinedRole = (data?.role === 'admin' || user.email === 'mama.ff9522@gmail.com') ? 'admin' : 'user';
            await safeFirestoreWrite(async () => {
              await setDoc(userRef, {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                updatedAt: new Date().toISOString()
              }, { merge: true });
            });
          } else {
            determinedRole = (user.email === 'mama.ff9522@gmail.com') ? 'admin' : 'user';
            await safeFirestoreWrite(async () => {
              await setDoc(userRef, {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                role: determinedRole,
                credits: determinedRole === 'admin' ? 9999 : 500,
                status: 'active',
                isLocked: false,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            });
          }
        }
      } catch (err) {
        console.warn('Firestore user profile sync notice (offline mode available):', err);
      }

      cacheUserData(user, determinedRole);
    }

    return user;
  } catch (error: any) {
    console.error('Google Sign-in Error:', error);
    throw error;
  }
}

/**
 * สลับบัญชี Google (Switch Google Account)
 * - เปิดหน้าต่างเลือกบัญชี Google (prompt: 'select_account') ให้ผู้ใช้เลือกบัญชีอื่นหรือลงชื่อเข้าใช้บัญชีใหม่
 * - รองรับการสลับบัญชีได้ทันทีแม้ผู้ใช้ล็อกอินอยู่เดิม
 */
export async function switchGoogleAccount(): Promise<User> {
  try {
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (user) {
      const token = await user.getIdToken(true);
      saveAuthTokenToStorage(token);
      startTokenRefreshTimer(user);

      const userRef = doc(db, 'users', user.uid);
      let determinedRole: 'admin' | 'user' = (user.email === 'mama.ff9522@gmail.com') ? 'admin' : 'user';

      try {
        if (!isFirestoreQuotaExhausted()) {
          const snap = await getDoc(userRef);
          if (snap.exists()) {
            const data = snap.data();
            determinedRole = (data?.role === 'admin' || user.email === 'mama.ff9522@gmail.com') ? 'admin' : 'user';
            await safeFirestoreWrite(async () => {
              await setDoc(userRef, {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                updatedAt: new Date().toISOString()
              }, { merge: true });
            });
          } else {
            determinedRole = (user.email === 'mama.ff9522@gmail.com') ? 'admin' : 'user';
            await safeFirestoreWrite(async () => {
              await setDoc(userRef, {
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || '',
                photoURL: user.photoURL || '',
                role: determinedRole,
                credits: determinedRole === 'admin' ? 9999 : 500,
                status: 'active',
                isLocked: false,
                updatedAt: new Date().toISOString()
              }, { merge: true });
            });
          }
        }
      } catch (err) {
        console.warn('Firestore sync on account switch notice:', err);
      }

      cacheUserData(user, determinedRole);
    }

    return user;
  } catch (error: any) {
    console.error('Switch Google Account Error:', error);
    throw error;
  }
}

/**
 * ออกจากระบบ (Logout)
 * - ล้าง session ใน localStorage เฉพาะเมื่อผู้ใช้กดออกจากระบบเอง
 */
export async function logout(): Promise<void> {
  try {
    stopTokenRefreshTimer();
    clearAuthStorage(); // ล้าง session เฉพาะเมื่อผู้ใช้กดออกจากระบบเอง
    await signOut(auth);
  } catch (error: any) {
    console.error('Logout Error:', error);
    throw error;
  }
}

/**
 * บันทึก API key ไว้ใน Firestore ผูกกับ uid ของผู้ใช้
 * @param apiKey ข้อความ API key
 * @param provider ชื่อผู้ให้บริการ เช่น 'gemini' (default), 'meta', 'xai'
 */
export async function saveApiKey(apiKey: string, provider: string = 'gemini'): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('กรุณาเข้าสู่ระบบด้วย Google ก่อนบันทึก API Key');
  }

  // แคชไว้ใน localStorage เพื่อความสะดวกและความต่อเนื่องเสมอ
  if (apiKey) {
    localStorage.setItem(`sala_${provider}_api_key`, apiKey.trim());
  } else {
    localStorage.removeItem(`sala_${provider}_api_key`);
  }

  // พยายามบันทึกลง Firestore ผ่าน safeFirestoreWrite
  try {
    const userRef = doc(db, 'users', currentUser.uid);
    await safeFirestoreWrite(async () => {
      await setDoc(userRef, {
        uid: currentUser.uid,
        apiKey: apiKey.trim(),
        [`apiKeys.${provider}`]: apiKey.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });
  } catch (err: any) {
    console.warn('Could not sync API key to remote Firestore, preserved locally:', err?.message);
  }
}

/**
 * ดึง API key จาก Firestore ที่ผูกกับ uid ของผู้ใช้
 * @param provider ชื่อผู้ให้บริการ เช่น 'gemini' (default)
 */
export async function getApiKey(provider: string = 'gemini'): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    // หากยังไม่ล็อกอิน ให้ดึงจาก localStorage หรือว่างไว้
    return localStorage.getItem(`sala_${provider}_api_key`) || '';
  }

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      const keyFromMap = data.apiKeys?.[provider];
      const primaryKey = data.apiKey;
      const key = keyFromMap || primaryKey || '';
      if (key) {
        localStorage.setItem(`sala_${provider}_api_key`, key);
      }
      return key;
    }
  } catch (error: any) {
    console.warn('Failed to retrieve API key from Firestore:', error);
  }

  return localStorage.getItem(`sala_${provider}_api_key`) || '';
}

/**
 * ตรวจสอบผู้ใช้ปัจจุบัน
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * ติดตามสถานะการล็อกอินของผู้ใช้ตลอดเวลาด้วย onAuthStateChanged
 * - ใช้ Firebase Auth เป็นแหล่งข้อมูลหลัก (Source of Truth) เท่านั้น
 */
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      cacheUserData(user);
      try {
        await checkAndRefreshToken(user);
      } catch (e) {
        console.warn('Error during token check on auth state change:', e);
      }
      startTokenRefreshTimer(user);
      // Fetch role asynchronously in background to ensure sync
      fetchUserRole(user.uid).then((role) => {
        cacheUserData(user, role);
      }).catch(() => {});
      callback(user);
    } else {
      stopTokenRefreshTimer();
      callback(null);
    }
  });
}

// ตรวจสอบ token เริ่มต้นเมื่อเปิดแอป
if (typeof window !== 'undefined') {
  const initialStoredToken = getStoredToken();
  if (initialStoredToken && auth.currentUser) {
    checkAndRefreshToken(auth.currentUser).catch(() => {});
  }
  // ล้าง demo session
  const cached = getStoredUser();
  if (cached && cached.uid === 'demo_creator') {
    clearAuthStorage();
  }
}

export const authService = {
  loginWithGoogle,
  switchGoogleAccount,
  logout,
  isDemoUser,
  saveApiKey,
  getApiKey,
  getCurrentUser,
  getStoredToken,
  getStoredUser,
  getStoredUserAsUser,
  checkAndRefreshToken,
  onAuthStateChange,
  fetchUserRole
};

export default authService;


