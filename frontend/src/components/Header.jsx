import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useOfflineSync } from '../context/OfflineSyncContext';
import {
  Sprout,
  Globe,
  Wifi,
  WifiOff,
  Bell,
  RefreshCw,
  Sparkles,
  LogOut,
  Menu,
  X
} from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  unreadNotifsCount,
  onOpenNotifs,
  onOpenAssist
}) {
  const { currentUser, logout } = useAuth();
  const { lang, toggleLanguage, t } = useLanguage();
  const {
    effectiveOnline,
    simulatedOffline,
    toggleSimulatedOffline,
    queuedItems,
    syncQueue,
    isSyncing
  } = useOfflineSync();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: t('nav_dashboard') },
    { id: 'simulator', label: t('nav_simulator') },
    { id: 'pooling', label: t('nav_pooling') },
    { id: 'market', label: t('nav_market') },
  ];

  if (currentUser?.role === 'fpo_admin' || currentUser?.role === 'admin') {
    navItems.push({ id: 'reports', label: t('nav_reports') });
  }
  if (currentUser?.role === 'admin') {
    navItems.push({ id: 'admin', label: t('nav_admin') });
  }

  const handleMobileNav = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      {/* Top Banner for Offline simulation / Status */}
      {(!effectiveOnline || queuedItems.length > 0) && (
        <div className={`px-3 sm:px-4 py-1.5 text-xs font-medium flex flex-wrap items-center justify-between gap-2 transition-colors ${
          effectiveOnline
            ? 'bg-amber-50 text-amber-900 border-b border-amber-200'
            : 'bg-red-600 text-white'
        }`}>
          <div className="flex items-center space-x-2 min-w-0">
            {!effectiveOnline ? (
              <>
                <WifiOff className="w-3.5 h-3.5 animate-pulse shrink-0" />
                <span className="truncate">{t('offline_mode')}: {queuedItems.length} {t('queued_actions')}</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{queuedItems.length} {t('queued_actions')} ready to sync</span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2 shrink-0">
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
      <div className="max-w-7xl mx-auto px-2.5 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between gap-1.5 sm:gap-2 h-16">
          
          {/* Logo & Brand */}
          <button
            type="button"
            className="flex items-center space-x-1.5 sm:space-x-2 cursor-pointer min-w-0 shrink-0 text-left"
            onClick={() => handleMobileNav('dashboard')}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 shrink-0">
              <Sprout className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1">
                <span className="font-bold text-base sm:text-xl tracking-tight text-slate-900 truncate">
                  Agri<span className="text-emerald-600">Nexus</span>
                </span>
              </div>
              <p className="text-[11px] 2xl:text-xs text-slate-500 hidden xl:block whitespace-nowrap">{t('tagline')}</p>
            </div>
          </button>

          {/* Nav Tabs (Desktop - shown on xl+ screens) */}
          <nav className="hidden xl:flex items-center space-x-1 2xl:space-x-1.5 min-w-0">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 2xl:px-3.5 py-2 rounded-lg text-xs 2xl:text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === item.id
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Action Tools */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 2xl:space-x-2.5 shrink-0 min-w-0">
            
            {/* AI Assistant Button */}
            <button
              onClick={onOpenAssist}
              className="px-2 sm:px-2.5 2xl:px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1 shadow-sm shadow-emerald-600/20 transition-all hover:scale-105 shrink-0 whitespace-nowrap"
              aria-label={t('nav_assist')}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden 2xl:inline">{t('nav_assist')}</span>
              <span className="hidden sm:inline 2xl:hidden">Assist</span>
            </button>

            {/* Language Switcher (top bar on >= sm, also inside mobile menu) */}
            <button
              onClick={toggleLanguage}
              className="hidden sm:flex px-2 2xl:px-2.5 py-1.5 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 items-center space-x-1 2xl:space-x-1.5 transition-colors shadow-sm shrink-0 whitespace-nowrap"
              title="Toggle Language / भाषा बदलें"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{lang === 'en' ? 'हिंदी' : 'English'}</span>
            </button>

            {/* Notifications Bell */}
            <button
              onClick={onOpenNotifs}
              className="relative p-1.5 sm:p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              {unreadNotifsCount > 0 && (
                <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-red-500 text-white rounded-full text-[9px] sm:text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadNotifsCount}
                </span>
              )}
            </button>

            {/* User Profile Badge & Logout Button (sm+ in top bar, mobile inside menu) */}
            <div className="hidden sm:flex items-center space-x-1.5 2xl:space-x-2 shrink-0">
              <div className="flex items-center space-x-1.5 2xl:space-x-2 p-1.5 pl-2 pr-2 xl:pr-2.5 rounded-lg border border-slate-200 bg-slate-50">
                <span className="text-base shrink-0">{currentUser?.avatar || '👤'}</span>
                <div className="text-left hidden xl:block max-w-[110px] 2xl:max-w-none">
                  <p className="text-xs font-bold text-slate-800 leading-tight truncate">{currentUser?.name || 'User'}</p>
                  <p className="text-[10px] text-emerald-600 font-semibold truncate">{currentUser?.badge || currentUser?.role || 'Active'}</p>
                </div>
              </div>

              <button
                onClick={logout}
                className="px-2 2xl:px-2.5 py-1.5 border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg text-xs font-semibold flex items-center space-x-1 2xl:space-x-1.5 transition-colors shadow-sm whitespace-nowrap shrink-0"
                title="Sign out of AgriNexus"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">Sign Out</span>
              </button>
            </div>

            {/* Mobile/Tablet Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(prev => !prev)}
              className="xl:hidden p-1.5 sm:p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shrink-0"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

          </div>

        </div>
      </div>

      {/* Responsive Mobile/Tablet Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-3 py-3 space-y-3 shadow-lg">
          {/* Mobile Navigation Links */}
          <nav className="flex flex-col space-y-1" aria-label="Mobile Navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleMobileNav(item.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between ${
                  activeTab === item.id
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{item.label}</span>
                {activeTab === item.id && (
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                )}
              </button>
            ))}
          </nav>

          {/* Mobile Profile & Quick Actions */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center space-x-2.5 min-w-0">
                <span className="text-lg shrink-0">{currentUser?.avatar || '👤'}</span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{currentUser?.name || 'User'}</p>
                  <p className="text-[11px] text-emerald-600 font-semibold truncate">{currentUser?.badge || currentUser?.role || 'Active'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={toggleLanguage}
                className="px-3 py-2 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{lang === 'en' ? 'हिंदी' : 'English'}</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  logout();
                }}
                className="px-3 py-2 border border-red-200 bg-red-50/60 hover:bg-red-50 text-red-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

