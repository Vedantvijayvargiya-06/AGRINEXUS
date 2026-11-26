import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  Sparkles,
  Clock,
  Scale,
  Plus,
  ArrowRight,
  Sliders,
  TrendingUp,
  Activity,
  ShoppingBag,
  Warehouse,
  Factory,
  Navigation,
  Inbox,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

function getCropIcon(crop) {
  switch (crop) {
    case 'Tomato': return '🍅';
    case 'Onion': return '🧅';
    case 'Potato': return '🥔';
    case 'Mango': return '🥭';
    case 'Apple': return '🍎';
    case 'Banana': return '🍌';
    case 'Cauliflower': return '🥦';
    case 'Guava': return '🍐';
    default: return '🌱';
  }
}

export default function FarmerDashboard({
  batches = [],
  loading = false,
  loadError = '',
  onRetry,
  onOpenAddBatch,
  onOpenTwin,
  onOpenDecision,
  onOpenSimulator
}) {
  const { lang, t } = useLanguage();
  const { currentUser } = useAuth();

  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'active' | 'completed'

  const userBatches = batches.filter(
    (b) =>
      b.farmer_id === currentUser?.id ||
      currentUser?.role === 'admin' ||
      currentUser?.role === 'fpo_admin'
  );

  const activeBatchesCount = userBatches.filter((b) => b.status === 'active').length;
  const completedBatchesCount = userBatches.filter((b) => b.status === 'completed').length;

  const displayedBatches = userBatches.filter((b) => {
    if (filterStatus === 'all') return true;
    return b.status === filterStatus;
  });

  const criticalBatches = userBatches.filter(
    (b) => b.spoilage_risk >= 70.0 && b.status === 'active'
  );

  const totalTonnage = userBatches.reduce((acc, b) => acc + (b.quantity_kg || 0), 0);
  const totalExpectedNet = userBatches.reduce(
    (acc, b) => acc + (b.recommendation?.expected_value || 0),
    0
  );
  const avgQuality =
    userBatches.length > 0
      ? Math.round(
          userBatches.reduce((acc, b) => acc + (b.current_quality || 0), 0) /
            userBatches.length
        )
      : 0;

  const getActionBadge = (action) => {
    switch (action) {
      case 'sell_now':
        return {
          title: t('pathway_sell_now'),
          bg: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: <ShoppingBag className="w-3.5 h-3.5" />
        };
      case 'store':
        return {
          title: t('pathway_store'),
          bg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          icon: <Warehouse className="w-3.5 h-3.5" />
        };
      case 'process':
        return {
          title: t('pathway_process'),
          bg: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: <Factory className="w-3.5 h-3.5" />
        };
      case 'redirect':
        return {
          title: t('pathway_redirect'),
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          icon: <Navigation className="w-3.5 h-3.5" />
        };
      default:
        return {
          title: 'Optimal Action',
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          icon: <Sparkles className="w-3.5 h-3.5" />
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {loadError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="font-semibold">{loadError}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold flex items-center justify-center space-x-1.5 shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* Critical Spoilage Alert Banner */}
      {criticalBatches.length > 0 && (
        <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 sm:p-5 shadow-md animate-pulse-slow">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-600 text-white rounded-xl shrink-0 mt-0.5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-red-950 flex flex-wrap items-center gap-2">
                  <span>{t('critical_spoilage_alert')}</span>
                  <span className="px-2 py-0.5 bg-red-200 text-red-900 rounded text-xs font-mono font-bold">
                    {criticalBatches[0].batch_code}
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-red-800 mt-1">
                  {lang === 'hi'
                    ? `आपके ${criticalBatches[0].crop_name_hi} बैच में सड़न का जोखिम ${criticalBatches[0].spoilage_risk}% पर पहुँच चुका है। भारी नुकसान से बचने के लिए इसे तुरंत प्रोसेसिंग में भेजें।`
                    : `Your ${criticalBatches[0].crop} batch spoilage risk has crossed ${criticalBatches[0].spoilage_risk}%. Act quickly to preserve ₹${(criticalBatches[0].recommendation?.expected_value || 0).toLocaleString('en-IN')}.`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenDecision(criticalBatches[0].id)}
              className="w-full sm:w-auto px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center justify-center space-x-1.5 shadow-sm transition-all"
            >
              <span>{t('take_action')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 min-[375px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
          <div className="flex items-center justify-between gap-2 text-slate-500 text-xs font-medium">
            <span className="truncate">{t('kpi_active_batches')}</span>
            <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mt-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {activeBatchesCount}
            </span>
            <span className="text-xs text-slate-500">({completedBatchesCount} completed)</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            {userBatches.length} Total Harvest Batches
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
          <div className="flex items-center justify-between gap-2 text-slate-500 text-xs font-medium">
            <span className="truncate">{t('kpi_produce_volume')}</span>
            <Scale className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-2 break-words">
            {totalTonnage.toLocaleString()}{' '}
            <span className="text-sm font-semibold text-slate-500">kg</span>
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Total fresh harvest under tracking</p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
          <div className="flex items-center justify-between gap-2 text-slate-500 text-xs font-medium">
            <span className="truncate">{t('kpi_expected_net')}</span>
            <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-700 mt-2 break-words">
            ₹{totalExpectedNet.toLocaleString('en-IN')}
          </p>
          <p className="text-[10px] text-emerald-600 font-semibold mt-1">
            {userBatches.length > 0 ? 'Modeled net pathway value' : 'Register a batch to forecast'}
          </p>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
          <div className="flex items-center justify-between gap-2 text-slate-500 text-xs font-medium">
            <span className="truncate">Average Crop Quality</span>
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-2">{avgQuality}%</p>
          <p className="text-[10px] text-slate-400 mt-1">
            {userBatches.length > 0 ? 'Q10 temperature adjusted' : 'No active harvest lots'}
          </p>
        </div>
      </div>

      {/* Header, Filter Tabs, and Register Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 flex flex-wrap items-center gap-2">
            <span>{t('nav_batches')}</span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-semibold">
              {displayedBatches.length} Displayed
            </span>
          </h2>
          <p className="text-xs text-slate-500">
            Real-time quality decay forecasting and automated profit optimization
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex flex-wrap items-center p-1 bg-slate-100 rounded-xl text-[11px] sm:text-xs font-semibold w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                filterStatus === 'all'
                  ? 'bg-white text-emerald-800 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({userBatches.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('active')}
              className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                filterStatus === 'active'
                  ? 'bg-white text-emerald-800 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({activeBatchesCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('completed')}
              className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
                filterStatus === 'completed'
                  ? 'bg-white text-emerald-800 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Completed ({completedBatchesCount})
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenAddBatch}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>{t('add_new_batch')}</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && batches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-xs">
          Loading harvest batches and digital twin telemetry...
        </div>
      ) : displayedBatches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-4">
            <Inbox className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {filterStatus === 'active'
              ? 'No Active Batches In Progress'
              : filterStatus === 'completed'
              ? 'No Completed Batches Found'
              : 'No Batches Registered'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            {filterStatus === 'active' && completedBatchesCount > 0
              ? `All ${completedBatchesCount} existing harvest batches have been marked completed with feedback recorded. You can view them in the Completed tab or register a new harvest batch.`
              : 'Register a fresh produce harvest to initiate AI digital twin monitoring and profit-maximizing pathway recommendations.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {filterStatus === 'active' && completedBatchesCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterStatus('completed')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors"
              >
                View Completed Batches ({completedBatchesCount})
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAddBatch}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Register New Harvest</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {displayedBatches.map((batch) => {
            const badge = getActionBadge(batch.recommendation?.action);
            const isCritical = batch.spoilage_risk >= 70 && batch.status === 'active';
            const isCompleted = batch.status === 'completed';

            return (
              <div
                key={batch.id}
                className={`bg-white rounded-2xl border transition-all hover:shadow-lg flex flex-col justify-between overflow-hidden ${
                  isCritical
                    ? 'border-red-300 ring-2 ring-red-500/10 shadow-xs'
                    : isCompleted
                    ? 'border-slate-200/80 shadow-xs opacity-95'
                    : 'border-slate-200 shadow-xs hover:border-emerald-300'
                }`}
              >
                {/* Batch Top Header */}
                <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-wrap items-start justify-between gap-2 bg-slate-50/70">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg shadow-sm shrink-0">
                      {getCropIcon(batch.crop)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {lang === 'hi' ? batch.crop_name_hi : batch.crop}
                        </h3>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                            isCompleted
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isCompleted ? 'Completed' : 'Active'}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-slate-500 truncate">
                        {batch.batch_code}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${batch.risk_bg_class}`}
                  >
                    {lang === 'hi' ? batch.risk_label_hi : batch.risk_label}
                  </span>
                </div>

                {/* Digital Twin Telemetry Grid */}
                <div className="p-3.5 sm:p-4 space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">{t('quality_score')}:</span>
                      <span className="font-bold text-slate-900">{batch.current_quality}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          batch.current_quality > 70
                            ? 'bg-emerald-500'
                            : batch.current_quality > 40
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        }`}
                        style={{
                          width: `${Math.max(0, Math.min(100, batch.current_quality || 0))}%`
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-[11px]">
                    <div className="space-y-0.5 min-w-0">
                      <span className="text-slate-400 block truncate">{t('remaining_life')}:</span>
                      <span className="font-bold text-slate-800 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="break-words">
                          {batch.shelf_life_days} Days ({batch.shelf_life_hrs}h)
                        </span>
                      </span>
                    </div>

                    <div className="space-y-0.5 min-w-0">
                      <span className="text-slate-400 block truncate">{t('quantity')}:</span>
                      <span className="font-bold text-slate-800 flex items-center space-x-1">
                        <Scale className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="break-words">
                          {batch.quantity_kg.toLocaleString()} kg
                        </span>
                      </span>
                    </div>
                  </div>

                  {batch.recommendation && (
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                        <span>{t('recommended_pathway')}</span>
                        <span>Expected Net</span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div
                          className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center space-x-1.5 max-w-full ${badge.bg}`}
                        >
                          <span className="shrink-0">{badge.icon}</span>
                          <span className="truncate">{badge.title}</span>
                        </div>
                        <span className="font-black text-emerald-800 text-sm break-words">
                          ₹
                          {batch.recommendation.expected_value?.toLocaleString('en-IN', {
                            minimumFractionDigits: 2
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 grid grid-cols-1 min-[380px]:grid-cols-3 gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => onOpenTwin(batch.id)}
                    className="px-2 py-2 min-[380px]:py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold flex items-center justify-center space-x-1 transition-colors min-w-0"
                    title="View Digital Twin decay trajectory"
                  >
                    <Activity className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span className="text-[11px] truncate">{t('view_details')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenSimulator(batch)}
                    className="px-2 py-2 min-[380px]:py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold flex items-center justify-center space-x-1 transition-colors min-w-0"
                    title="Test what-if road delay and storage"
                  >
                    <Sliders className="w-3 h-3 text-blue-600 shrink-0" />
                    <span className="text-[11px] truncate">What-If</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenDecision(batch.id)}
                    className="px-2 py-2 min-[380px]:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center space-x-1 shadow-sm transition-colors min-w-0"
                    title="View complete mathematical formula breakdown"
                  >
                    <Sparkles className="w-3 h-3 shrink-0" />
                    <span className="text-[11px] truncate">Decide</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
