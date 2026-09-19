import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { LanguageProvider } from './context/LanguageContext';
import { OfflineSyncProvider } from './context/OfflineSyncContext';

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
