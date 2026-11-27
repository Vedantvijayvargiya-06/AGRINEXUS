import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const OfflineSyncContext = createContext();

export function OfflineSyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [queuedItems, setQueuedItems] = useState(() => {
    const saved = localStorage.getItem('agrinexus_sync_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState(new Date().toLocaleTimeString());

  const effectiveOnline = isOnline && !simulatedOffline;

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queueAction = (type, payload) => {
    const item = {
      id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      payload,
      timestamp: new Date().toISOString()
    };
    const updated = [...queuedItems, item];
    setQueuedItems(updated);
    localStorage.setItem('agrinexus_sync_queue', JSON.stringify(updated));
    return item;
  };

  const toggleSimulatedOffline = () => {
    setSimulatedOffline(prev => !prev);
  };

  const syncQueue = async (onBatchCreated) => {
    if (queuedItems.length === 0 || !effectiveOnline) return;

    setIsSyncing(true);
    setSyncError('');
    const remaining = [];
    let syncedCount = 0;

    try {
      for (const item of queuedItems) {
        if (item.type === 'CREATE_BATCH') {
          try {
            const res = await apiFetch('/api/batches', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(item.payload)
            });
            if (res.ok) {
              syncedCount += 1;
              if (onBatchCreated) {
                const data = await res.json();
                onBatchCreated(data);
              }
            } else {
              const errData = await res.json().catch(() => ({}));
              setSyncError(errData.detail || `Sync failed with status ${res.status}`);
              remaining.push(item);
            }
          } catch (itemErr) {
            setSyncError(itemErr.message || 'Network error during offline sync');
            remaining.push(item);
          }
        }
      }
      setQueuedItems(remaining);
      if (remaining.length === 0) {
        localStorage.removeItem('agrinexus_sync_queue');
      } else {
        localStorage.setItem('agrinexus_sync_queue', JSON.stringify(remaining));
      }
      if (syncedCount > 0) {
        setLastSyncedAt(new Date().toLocaleTimeString());
      }
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <OfflineSyncContext.Provider value={{
      effectiveOnline,
      simulatedOffline,
      toggleSimulatedOffline,
      queuedItems,
      queueAction,
      syncQueue,
      isSyncing,
      syncError,
      lastSyncedAt
    }}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export const useOfflineSync = () => useContext(OfflineSyncContext);
