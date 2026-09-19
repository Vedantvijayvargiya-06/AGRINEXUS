import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { useLanguage } from './context/LanguageContext';
import Header from './components/Header';
import FarmerDashboard from './components/FarmerDashboard';
import WhatIfSimulator from './components/WhatIfSimulator';
import ClusterPoolingView from './components/ClusterPoolingView';
import MarketIntelligenceView from './components/MarketIntelligenceView';
import ReportsAnalyticsView from './components/ReportsAnalyticsView';
import AdminConsoleView from './components/AdminConsoleView';
import NotificationDrawer from './components/NotificationDrawer';
import AddBatchModal from './components/AddBatchModal';
import DigitalTwinModal from './components/DigitalTwinModal';
import DecisionBreakdownModal from './components/DecisionBreakdownModal';
import AgriNexusAssistModal from './components/AgriNexusAssistModal';
import { Sparkles, MessageCircle } from 'lucide-react';

export default function App() {
  const { currentUser } = useAuth();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [batches, setBatches] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals & Drawers state
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [selectedTwinBatchId, setSelectedTwinBatchId] = useState(null);
  const [selectedDecisionBatchId, setSelectedDecisionBatchId] = useState(null);
  const [simulatorInitialBatch, setSimulatorInitialBatch] = useState(null);
  const [isAssistOpen, setIsAssistOpen] = useState(false);
  const [isNotifsOpen, setIsNotifsOpen] = useState(false);

  const fetchBatches = () => {
    fetch('/api/batches')
      .then(res => res.json())
      .then(data => {
        setBatches(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load batches:', err);
        setLoading(false);
      });
  };

  const fetchNotifications = () => {
    fetch(`/api/notifications?user_id=${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        setNotifications(data);
      })
      .catch(err => console.error('Failed to load notifs:', err));
  };

  useEffect(() => {
    fetchBatches();
    fetchNotifications();
    const interval = setInterval(() => {
      fetchBatches();
      fetchNotifications();
    }, 15000);
    return () => clearInterval(interval);
  }, [currentUser.id]);

  const handleMarkRead = async (notifId) => {
    await fetch(`/api/notifications/${notifId}/read`, { method: 'PUT' });
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    await fetch(`/api/notifications/read-all?user_id=${currentUser.id}`, { method: 'PUT' });
    fetchNotifications();
  };

  const handleOpenSimulatorFromBatch = (batch) => {
    setSimulatorInitialBatch(batch);
    setActiveTab('simulator');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {activeTab === 'dashboard' && (
          <FarmerDashboard
            batches={batches}
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
          <AdminConsoleView />
        )}

      </main>

      {/* Floating Action Button for AI Assist */}
      <button
        onClick={() => setIsAssistOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white p-4 rounded-2xl shadow-xl shadow-emerald-600/30 flex items-center space-x-2 transition-all hover:scale-105 group"
        title="Chat with AgriNexus Assist (Voice / Text)"
      >
        <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        <span className="font-bold text-xs hidden sm:inline">{t('ask_ai')}</span>
      </button>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 AgriNexus — AI-Powered Post-Harvest Decision Intelligence. Built for Smart India Hackathon (Problem Statement 26193).</p>
          <div className="flex items-center space-x-4 text-slate-400 text-[11px]">
            <span>ICAR-CIPHET Standards</span>
            <span>•</span>
            <span>Agmarknet / eNAM Synced</span>
            <span>•</span>
            <span>Q10 Kinetic Modeling</span>
          </div>
        </div>
      </footer>

      {/* Modals & Slide-out Drawers */}
      <NotificationDrawer
        isOpen={isNotifsOpen}
        onClose={() => setIsNotifsOpen(false)}
        notifications={notifications}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
      />

      <AddBatchModal
        isOpen={isAddBatchOpen}
        onClose={() => setIsAddBatchOpen(false)}
        onBatchAdded={() => fetchBatches()}
      />

      <DigitalTwinModal
        isOpen={!!selectedTwinBatchId}
        onClose={() => setSelectedTwinBatchId(null)}
        batchId={selectedTwinBatchId}
        onSimulate={handleOpenSimulatorFromBatch}
      />

      <DecisionBreakdownModal
        isOpen={!!selectedDecisionBatchId}
        onClose={() => setSelectedDecisionBatchId(null)}
        batchId={selectedDecisionBatchId}
        onConfirmed={() => fetchBatches()}
      />

      <AgriNexusAssistModal
        isOpen={isAssistOpen}
        onClose={() => setIsAssistOpen(false)}
        activeBatches={batches}
      />

    </div>
  );
}
