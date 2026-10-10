import React from 'react';

type State = { error: Error | null };

/** Root crash guard: shows a Thai recovery screen instead of a blank/black WebView. */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[SalaCrashGuard] render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        role="alert"
        data-sala-crash-guard="1"
        style={{ minHeight: '100vh', background: '#050816', color: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center', fontSize: 16 }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>แอปเกิดข้อผิดพลาด</h1>
        <p>ขออภัย หน้าจอนี้ทำงานผิดพลาด ข้อมูลที่บันทึกไว้ยังอยู่ กดปุ่มด้านล่างเพื่อโหลดแอปใหม่</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ background: '#00D8FF', color: '#050816', fontWeight: 700, border: 0, borderRadius: 12, padding: '12px 24px', fontSize: 16 }}
        >
          โหลดแอปใหม่
        </button>
      </div>
    );
  }
}

let installed = false;
/** Log uncaught errors and promise rejections so they never fail silently. */
export function installGlobalErrorLogging() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => {
    console.error('[SalaCrashGuard] window error:', event.message, event.error);
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[SalaCrashGuard] unhandled rejection:', event.reason);
  });
}
