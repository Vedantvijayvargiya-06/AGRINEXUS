import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { X, AlertTriangle, TrendingUp, Truck, Check, Bell } from 'lucide-react';

export default function NotificationDrawer({
  isOpen,
  onClose,
  notifications,
  onMarkRead,
  onMarkAllRead
}) {
  const { lang, t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col">
          
          {/* Drawer Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Notifications & Alerts</h2>
                <p className="text-xs text-slate-500">Real-time alerts & SMS fallback logs</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={onMarkAllRead}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold px-2 py-1 rounded hover:bg-emerald-50"
              >
                Mark all read
              </button>
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No active alerts right now.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isHindi = lang === 'hi';
                const title = isHindi && n.title_hi ? n.title_hi : n.title;
                const message = isHindi && n.message_hi ? n.message_hi : n.message;

                const isCritical = n.severity === 'critical' || n.type === 'spoilage_alert';
                const isCluster = n.type === 'cluster_invite';

                return (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      n.is_read
                        ? 'bg-slate-50/60 border-slate-200 opacity-75'
                        : isCritical
                        ? 'bg-red-50/90 border-red-300 shadow-xs'
                        : isCluster
                        ? 'bg-emerald-50/80 border-emerald-300 shadow-xs'
                        : 'bg-white border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between space-x-3">
                      <div className="flex items-start space-x-2.5">
                        <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                          isCritical
                            ? 'bg-red-100 text-red-600'
                            : isCluster
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          {isCritical ? (
                            <AlertTriangle className="w-4 h-4" />
                          ) : isCluster ? (
                            <Truck className="w-4 h-4" />
                          ) : (
                            <TrendingUp className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className={`text-xs font-bold ${isCritical ? 'text-red-900' : 'text-slate-900'}`}>
                              {title}
                            </h4>
                            {n.sent_sms && (
                              <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded text-[9px] font-semibold">
                                SMS Sent
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{message}</p>
                          <p className="text-[10px] text-slate-400 mt-2">
                            {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      {!n.is_read && (
                        <button
                          onClick={() => onMarkRead(n.id)}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-white shrink-0"
                          title="Mark read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
