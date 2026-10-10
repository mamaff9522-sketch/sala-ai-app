/** Whether the signed-in Firebase user may use Sala AI. Demo and empty sessions stay locked. */
export function isAppUnlocked(user: { uid?: string | null } | null | undefined): boolean {
  const uid = user?.uid;
  return typeof uid === 'string' && uid.length > 0 && uid !== 'demo_creator';
}

/** The phone uses the Google account already on the device. The browser still uses a popup. */
export function googleLoginMethod(nativePlatform: boolean): 'device' | 'popup' {
  return nativePlatform ? 'device' : 'popup';
}

export function deviceGoogleClientId(clientId: string): string {
  const id = String(clientId || '').trim();
  if (!id.endsWith('.apps.googleusercontent.com')) {
    throw new Error('ยังไม่มีรหัสกูเกิลสำหรับแอป');
  }
  return id;
}

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/**
 * Pop exactly one previous page.
 * `page` is that page. `page === null` means there is no previous page, so the phone must leave the app.
 */
export function goBackOnePage(history: string[]): { history: string[]; page: string | null } {
  if (history.length === 0) return { history: [], page: null };
  return { history: history.slice(0, -1), page: history[history.length - 1] };
}
