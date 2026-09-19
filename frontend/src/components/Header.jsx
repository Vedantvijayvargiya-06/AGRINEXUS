import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import {
  Sprout,
  Globe,
  Wifi,
  WifiOff,
  Bell,
  UserCheck,
  RefreshCw,
  Sparkles,
  Layers,
  TrendingUp,
  FileBarChart,
  Settings
} from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  unreadNotifsCount,
  onOpenNotifs,
  onOpenAssist
}) {
  const { currentUser, switchRole, demoProfiles } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const {
    effectiveOnline,
    simulatedOffline,
    toggleSimulatedOffline,
    queuedItems,
    syncQueue,
    isSyncing
  } = useOfflineSync();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      {/* Top Banner for Offline simulation / Status */}
      {(!effectiveOnline || queuedItems.length > 0) && (
        <div className={`px-4 py-1.5 text-xs font-medium flex items-center justify-between transition-colors ${
          effectiveOnline
            ? 'bg-amber-50 text-amber-900 border-b border-amber-200'
            : 'bg-red-600 text-white'
        }`}>
          <div className="flex items-center space-x-2">
            {!effectiveOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                <span>{t('offline_mode')}: {queuedItems.length} {t('queued_actions')}</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                <span>{queuedItems.length} {t('queued_actions')} ready to sync</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {effectiveOnline && queuedItems.length > 0 && (
              <button
                onClick={() => syncQueue()}
                disabled={isSyncing}
                className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs flex items-center space-x-1 shadow-sm font-semibold"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{t('sync_now')}</span>
              </button>
            )}
            <button
              onClick={toggleSimulatedOffline}
              className="underline text-[11px] opacity-90 hover:opacity-100"
            >
              {simulatedOffline ? "Restore Online" : "Simulate Offline"}
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-xl tracking-tight text-slate-900">Agri<span className="text-emerald-600">Nexus</span></span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded">SIH 2026</span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">{t('tagline')}</p>
            </div>
          </div>

          {/* Nav Tabs (Desktop) */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {t('nav_dashboard')}
            </button>
            
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'simulator'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {t('nav_simulator')}
            </button>

            <button
              onClick={() => setActiveTab('pooling')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'pooling'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {t('nav_pooling')}
            </button>

            <button
              onClick={() => setActiveTab('market')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'market'
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {t('nav_market')}
            </button>

            {currentUser.role === 'fpo_admin' && (
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'reports'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {t('nav_reports')}
              </button>
            )}

            {currentUser.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'admin'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {t('nav_admin')}
              </button>
            )}
          </nav>

          {/* Action Tools: AI Assistant, Language Switcher, Notifications, Persona Switcher */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* AI Assistant Button */}
            <button
              onClick={onOpenAssist}
              className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-sm shadow-emerald-600/20 transition-all hover:scale-105"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('nav_assist')}</span>
              <span className="sm:hidden">AI</span>
            </button>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="px-2.5 py-1.5 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 transition-colors shadow-xs"
              title="Toggle Language / भाषा बदलें"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === 'en' ? 'हिंदी' : 'English'}</span>
            </button>

            {/* Notifications Bell */}
            <button
              onClick={onOpenNotifs}
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {/* Role Switcher Menu */}
            <div className="relative group">
              <button className="flex items-center space-x-2 p-1.5 pl-2 rounded-lg border border-slate-200 hover:border-slate-300 bg-slate-50/70 hover:bg-slate-100 transition-colors">
                <span className="text-base">{currentUser.avatar}</span>
                <div className="text-left hidden lg:block">
                  <p className="text-xs font-semibold text-slate-800 leading-tight">{currentUser.name}</p>
                  <p className="text-[10px] text-emerald-600 font-medium">{currentUser.badge}</p>
                </div>
              </button>

              {/* Dropdown for instant evaluator persona switching */}
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl py-2 hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-3 py-1.5 border-b border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Switch Persona (Demo)</p>
                </div>
                {demoProfiles.map((p) => (
                  <button
                    key={p.role}
                    onClick={() => {
                      switchRole(p.role);
                      setActiveTab('dashboard');
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center space-x-2.5 text-xs hover:bg-emerald-50 transition-colors ${
                      currentUser.role === p.role ? 'bg-emerald-50/70 font-bold text-emerald-800' : 'text-slate-700'
                    }`}
                  >
                    <span className="text-base">{p.avatar}</span>
                    <div>
                      <p className="font-semibold leading-tight">{p.name}</p>
                      <p className="text-[10px] text-slate-500">{p.badge}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
