import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { OfflineSyncProvider } from './context/OfflineSyncContext';

import { apiFetch } from './utils/api';

// Safely install global fetch interceptor if window.fetch is configurable or writable
// (avoids TypeError: Cannot set property fetch of #<Window> which has only a getter)
try {
  const desc = Object.getOwnPropertyDescriptor(window, 'fetch');
  if (!desc || desc.configurable || desc.writable || typeof desc.set === 'function') {
    const wrappedFetch = (url, options = {}) => apiFetch(url, options);
    if (!desc || desc.configurable) {
      Object.defineProperty(window, 'fetch', {
        value: wrappedFetch,
        writable: true,
        configurable: true
      });
    } else if (desc.writable || typeof desc.set === 'function') {
      window.fetch = wrappedFetch;
    }
  }
} catch (err) {
  console.warn('[AgriNexus] Global fetch override skipped; using apiFetch wrapper:', err);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <LanguageProvider>
        <OfflineSyncProvider>
          <App />
        </OfflineSyncProvider>
      </LanguageProvider>
    </AuthProvider>
  </React.StrictMode>,
);
