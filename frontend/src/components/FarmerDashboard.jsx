import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  AlertTriangle,
  Sparkles,
  Clock,
  Thermometer,
  Scale,
  Plus,
  ArrowRight,
  Sliders,
  MessageSquare,
  TrendingUp,
  Activity,
  CheckCircle,
  ShoppingBag,
  Warehouse,
  Factory,
  Navigation
} from 'lucide-react';

export default function FarmerDashboard({
  batches,
  onOpenAddBatch,
  onOpenTwin,
  onOpenDecision,
  onOpenSimulator,
  onOpenAssist
}) {
  const { lang, t } = useLanguage();
  const { currentUser } = useAuth();

  // Filter batches for this farmer
  const farmerBatches = batches.filter(b => b.farmer_id === currentUser.id || currentUser.role === 'admin' || currentUser.role === 'fpo_admin');
  
  // Critical Spoilage Alerts (>70% risk)
  const criticalBatches = farmerBatches.filter(b => b.spoilage_risk >= 70.0 && b.status === 'active');

  const totalTonnage = farmerBatches.reduce((acc, b) => acc + (b.quantity_kg || 0), 0);
  const totalExpectedNet = farmerBatches.reduce((acc, b) => acc + (b.recommendation?.expected_value || 0), 0);
  const avgQuality = farmerBatches.length > 0
    ? Math.round(farmerBatches.reduce((acc, b) => acc + (b.current_quality || 0), 0) / farmerBatches.length)
    : 95;

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
      
      {/* Critical Spoilage Alert Banner (FR-2.4 & FR-11.1) */}
      {criticalBatches.length > 0 && (
        <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-4 sm:p-5 shadow-md animate-pulse-slow">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-600 text-white rounded-xl shrink-0 mt-0.5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-red-950 flex items-center space-x-2">
                  <span>{t('critical_spoilage_alert')}</span>
                  <span className="px-2 py-0.2 bg-red-200 text-red-900 rounded text-xs font-mono font-bold">
                    {criticalBatches[0].batch_code}
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-red-800 mt-1">
                  {lang === 'hi'
                    ? `आपके ${criticalBatches[0].crop_name_hi} बैच में सड़न का जोखिम ${criticalBatches[0].spoilage_risk}% पर पहुँच चुका है। भारी नुकसान से बचने के लिए इसे तुरंत प्रोसेसिंग में भेजें।`
                    : `Your ${criticalBatches[0].crop} batch spoilage risk has crossed ${criticalBatches[0].spoilage_risk}%. Divert immediately to Food Processing to save ₹${criticalBatches[0].recommendation?.expected_value?.toLocaleString('en-IN')}.`}
                </p>
              </div>
            </div>

            <button
              onClick={() => onOpenDecision(criticalBatches[0].id)}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shrink-0 flex items-center justify-center space-x-1.5 shadow-sm transition-all"
            >
              <span>{t('take_action')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{t('kpi_active_batches')}</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{farmerBatches.length}</p>
          <p className="text-[10px] text-slate-400 mt-1">Live digital twins modeled</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{t('kpi_produce_volume')}</span>
            <Scale className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{totalTonnage.toLocaleString()} <span className="text-sm font-semibold text-slate-500">kg</span></p>
          <p className="text-[10px] text-slate-400 mt-1">Total fresh harvest under tracking</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>{t('kpi_expected_net')}</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-700 mt-2">₹{totalExpectedNet.toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-emerald-600 font-semibold mt-1">+18.5% higher via AI decisions</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Average Crop Quality</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-2">{avgQuality}%</p>
          <p className="text-[10px] text-slate-400 mt-1">Q10 temperature adjusted</p>
        </div>

      </div>

      {/* Header and Register Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <span>{t('nav_batches')}</span>
            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full font-semibold">
              {farmerBatches.length} Total
            </span>
          </h2>
          <p className="text-xs text-slate-500">Real-time quality decay forecasting and automated profit optimization</p>
        </div>

        <button
          onClick={onOpenAddBatch}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20 transition-all hover:scale-102 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t('add_new_batch')}</span>
        </button>
      </div>

      {/* Active Produce Batches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {farmerBatches.map((batch) => {
          const badge = getActionBadge(batch.recommendation?.action);
          const isCritical = batch.spoilage_risk >= 70;

          return (
            <div
              key={batch.id}
              className={`bg-white rounded-2xl border transition-all hover:shadow-lg flex flex-col justify-between overflow-hidden ${
                isCritical
                  ? 'border-red-300 ring-2 ring-red-500/10 shadow-xs'
                  : 'border-slate-200 shadow-xs hover:border-emerald-300'
              }`}
            >
              
              {/* Batch Top Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-lg shadow-2xs">
                    {batch.crop === 'Tomato' ? '🍅' : batch.crop === 'Onion' ? '🧅' : batch.crop === 'Potato' ? '🥔' : batch.crop === 'Mango' ? '🥭' : '🍎'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {lang === 'hi' ? batch.crop_name_hi : batch.crop}
                    </h3>
                    <p className="text-[10px] font-mono text-slate-500">{batch.batch_code}</p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${batch.risk_bg_class}`}>
                  {lang === 'hi' ? batch.risk_label_hi : batch.risk_label}
                </span>
              </div>

              {/* Digital Twin Telemetry Grid */}
              <div className="p-4 space-y-3.5 text-xs">
                
                {/* Visual Quality Progress Bar */}
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
                      style={{ width: `${batch.current_quality}%` }}
                    />
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-[11px]">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 block">{t('remaining_life')}:</span>
                    <span className="font-bold text-slate-800 flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{batch.shelf_life_days} Days ({batch.shelf_life_hrs}h)</span>
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-slate-400 block">{t('quantity')}:</span>
                    <span className="font-bold text-slate-800 flex items-center space-x-1">
                      <Scale className="w-3 h-3 text-slate-500" />
                      <span>{batch.quantity_kg.toLocaleString()} kg</span>
                    </span>
                  </div>
                </div>

                {/* Recommended Decision Highlight */}
                {batch.recommendation && (
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-emerald-800 font-bold uppercase tracking-wider">
                      <span>{t('recommended_pathway')}</span>
                      <span>Expected Net</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center space-x-1.5 ${badge.bg}`}>
                        {badge.icon}
                        <span>{badge.title}</span>
                      </div>
                      <span className="font-black text-emerald-800 text-sm">
                        ₹{batch.recommendation.expected_value?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}

              </div>

              {/* Action Buttons (2-tap execution) */}
              <div className="p-3 bg-slate-50 border-t border-slate-100 grid grid-cols-3 gap-1.5 text-xs">
                <button
                  onClick={() => onOpenTwin(batch.id)}
                  className="px-2 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold flex items-center justify-center space-x-1 transition-colors"
                  title="View Digital Twin decay trajectory"
                >
                  <Activity className="w-3 h-3 text-emerald-600" />
                  <span className="text-[11px]">{t('view_details')}</span>
                </button>

                <button
                  onClick={() => onOpenSimulator(batch)}
                  className="px-2 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-semibold flex items-center justify-center space-x-1 transition-colors"
                  title="Test what-if road delay and storage"
                >
                  <Sliders className="w-3 h-3 text-blue-600" />
                  <span className="text-[11px]">What-If</span>
                </button>

                <button
                  onClick={() => onOpenDecision(batch.id)}
                  className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold flex items-center justify-center space-x-1 shadow-xs transition-colors"
                  title="View complete mathematical formula breakdown"
                >
                  <Sparkles className="w-3 h-3" />
                  <span className="text-[11px]">Decide</span>
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
