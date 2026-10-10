import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { installNativeApiRouting } from './services/nativeApiOrigin';
import './index.css';
import { AppErrorBoundary, installGlobalErrorLogging } from './components/AppErrorBoundary';

// Phone only: send /api calls to Cloud Run. The WebView still shows this bundle.
installGlobalErrorLogging();
installNativeApiRouting();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
