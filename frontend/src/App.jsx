import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
import { apiFetch } from './utils/api';
import ErrorBoundary from './components/ErrorBoundary';
import Header from './components/Header';
import FarmerDashboard from './components/FarmerDashboard';
import LoginPage from './components/LoginPage';
import { Sparkles } from 'lucide-react';

const WhatIfSimulator = lazy(() => import('./components/WhatIfSimulator'));
const ClusterPoolingView = lazy(() => import('./components/ClusterPoolingView'));
const MarketIntelligenceView = lazy(() => import('./components/MarketIntelligenceView'));
const ReportsAnalyticsView = lazy(() => import('./components/ReportsAnalyticsView'));
const AdminConsoleView = lazy(() => import('./components/AdminConsoleView'));
const SystemDiagnosticsView = lazy(() => import('./components/SystemDiagnosticsView'));
const NotificationDrawer = lazy(() => import('./components/NotificationDrawer'));
const AddBatchModal = lazy(() => import('./components/AddBatchModal'));
const DigitalTwinModal = lazy(() => import('./components/DigitalTwinModal'));
const DecisionBreakdownModal = lazy(() => import('./components/DecisionBreakdownModal'));
const AgriNexusAssistModal = lazy(() => import('./components/AgriNexusAssistModal'));
const LoginModal = lazy(() => import('./components/LoginModal'));

function ViewFallback() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs">
      Loading module...
    </div>
  );
}

function getDefaultTabForRole(role) {
  switch (role) {
    case 'fpo_admin':
      return 'reports';
    case 'buyer':
      return 'market';
    case 'admin':
      return 'admin';
    default:
      return 'dashboard';
  }
}

export default function App() {
  const { currentUser, token, authInitialized, isLoginModalOpen, setIsLoginModalOpen } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [batches, setBatches] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Modals & Drawers state
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [selectedTwinBatchId, setSelectedTwinBatchId] = useState(null);
  const [selectedDecisionBatchId, setSelectedDecisionBatchId] = useState(null);
  const [simulatorInitialBatch, setSimulatorInitialBatch] = useState(null);
  const [isAssistOpen, setIsAssistOpen] = useState(false);
  const [isNotifsOpen, setIsNotifsOpen] = useState(false);

  const fetchBatches = (status = 'all') => {
    setLoadError('');
    apiFetch(`/api/batches?status=${status}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch batches (HTTP ${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setBatches(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load batches:', err);
        setLoadError(err.message || 'Unable to load batches.');
        setLoading(false);
      });
  };

  const fetchNotifications = () => {
    apiFetch('/api/notifications')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setNotifications(data);
        }
      })
      .catch((err) => console.error('Failed to load notifs:', err));
  };

  useEffect(() => {
    if (!token || !currentUser?.id) {
      setBatches([]);
      setNotifications([]);
      setActiveTab('dashboard');
      return;
    }
    setActiveTab(getDefaultTabForRole(currentUser.role));
    setLoading(true);
    fetchBatches();
    fetchNotifications();
    const interval = setInterval(() => {
      fetchBatches();
      fetchNotifications();
    }, 15000);
    return () => clearInterval(interval);
  }, [token, currentUser?.id, currentUser?.role, authInitialized]);

  const handleMarkRead = async (notifId) => {
    const res = await apiFetch(`/api/notifications/${notifId}/read`, { method: 'PUT' });
    if (res.ok) {
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    const res = await apiFetch('/api/notifications/read-all', { method: 'PUT' });
    if (res.ok) {
      fetchNotifications();
    }
  };

  const handleOpenSimulatorFromBatch = (batch) => {
    setSimulatorInitialBatch(batch);
    setActiveTab('simulator');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3 text-white">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-medium">Initializing AgriNexus Secure Session...</p>
        </div>
      </div>
    );
  }

  if (!currentUser || !token) {
    return (
      <ErrorBoundary>
        <LoginPage />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-emerald-500 selection:text-white">
        
        {/* Top Navigation */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          unreadNotifsCount={unreadCount}
          onOpenNotifs={() => setIsNotifsOpen(true)}
          onOpenAssist={() => setIsAssistOpen(true)}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full min-w-0 mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <Suspense fallback={<ViewFallback />}>
            {activeTab === 'dashboard' && (
              <FarmerDashboard
                batches={batches}
                loading={loading}
                loadError={loadError}
                onRetry={() => fetchBatches()}
                onOpenAddBatch={() => setIsAddBatchOpen(true)}
                onOpenTwin={(id) => setSelectedTwinBatchId(id)}
                onOpenDecision={(id) => setSelectedDecisionBatchId(id)}
                onOpenSimulator={handleOpenSimulatorFromBatch}
                onOpenAssist={() => setIsAssistOpen(true)}
              />
            )}

            {activeTab === 'simulator' && (
              <WhatIfSimulator initialBatch={simulatorInitialBatch} />
            )}

            {activeTab === 'pooling' && (
              <ClusterPoolingView />
            )}

            {activeTab === 'market' && (
              <MarketIntelligenceView />
            )}

            {activeTab === 'reports' && (
              <ReportsAnalyticsView />
            )}

            {activeTab === 'admin' && (
              <AdminConsoleView onOpenDiagnostics={() => setActiveTab('diagnostics')} />
            )}

            {activeTab === 'diagnostics' && currentUser?.role === 'admin' && (
              <SystemDiagnosticsView />
            )}
          </Suspense>
        </main>

        {/* Floating Action Button for AI Assist (desktop/tablet; mobile uses sticky Header AI button) */}
        <button
          type="button"
          onClick={() => setIsAssistOpen(true)}
          className="hidden sm:flex fixed bottom-6 right-6 z-40 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white p-4 rounded-2xl shadow-xl shadow-emerald-600/30 items-center space-x-2 transition-all hover:scale-105 group"
          title="Chat with AgriNexus Assist (Voice / Text)"
        >
          <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span className="font-bold text-xs">{t('ask_ai')}</span>
        </button>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 sm:pr-44 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>© 2026 AgriNexus — AI-Powered Post-Harvest Decision Intelligence.</p>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-slate-400 text-[11px]">
              <span>ICAR-CIPHET Standards</span>
              <span>•</span>
              <span>Agmarknet / eNAM Reference</span>
              <span>•</span>
              <span>Q10 Kinetic Modeling</span>
            </div>
          </div>
        </footer>

        {/* Modals & Slide-out Drawers */}
        <Suspense fallback={null}>
          {isLoginModalOpen && (
            <LoginModal
              isOpen={isLoginModalOpen}
              onClose={() => setIsLoginModalOpen(false)}
            />
          )}

          {isNotifsOpen && (
            <NotificationDrawer
              isOpen={isNotifsOpen}
              onClose={() => setIsNotifsOpen(false)}
              notifications={notifications}
              onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead}
            />
          )}

          {isAddBatchOpen && (
            <AddBatchModal
              isOpen={isAddBatchOpen}
              onClose={() => setIsAddBatchOpen(false)}
              onBatchAdded={() => fetchBatches()}
            />
          )}

          {selectedTwinBatchId && (
            <DigitalTwinModal
              isOpen={!!selectedTwinBatchId}
              onClose={() => setSelectedTwinBatchId(null)}
              batchId={selectedTwinBatchId}
              onSimulate={handleOpenSimulatorFromBatch}
            />
          )}

          {selectedDecisionBatchId && (
            <DecisionBreakdownModal
              isOpen={!!selectedDecisionBatchId}
              onClose={() => setSelectedDecisionBatchId(null)}
              batchId={selectedDecisionBatchId}
              onConfirmed={() => fetchBatches()}
            />
          )}

          {isAssistOpen && (
            <AgriNexusAssistModal
              isOpen={isAssistOpen}
              onClose={() => setIsAssistOpen(false)}
              activeBatches={batches}
            />
          )}
        </Suspense>

      </div>
    </ErrorBoundary>
  );
}
