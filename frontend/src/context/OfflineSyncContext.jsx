import React, { createContext, useContext, useState, useEffect } from 'react';

const OfflineSyncContext = createContext();

export function OfflineSyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [simulatedOffline, setSimulatedOffline] = useState(false);
  const [queuedItems, setQueuedItems] = useState(() => {
    const saved = localStorage.getItem('agrinexus_sync_queue');
    return saved ? JSON.parse(saved) : [];
  });
  const [isSyncing, setIsSyncing] = useState(false);
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
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
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
    try {
      for (const item of queuedItems) {
        if (item.type === 'CREATE_BATCH') {
          const res = await fetch('/api/batches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload)
          });
          if (res.ok && onBatchCreated) {
            const data = await res.json();
            onBatchCreated(data);
          }
        }
      }
      setQueuedItems([]);
      localStorage.removeItem('agrinexus_sync_queue');
      setLastSyncedAt(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to sync queue:', err);
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
      lastSyncedAt
    }}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export const useOfflineSync = () => useContext(OfflineSyncContext);
