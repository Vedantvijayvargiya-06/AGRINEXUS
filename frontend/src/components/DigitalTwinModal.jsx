import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../utils/api';
import { X, Activity, Sparkles, TrendingDown, ArrowRight, AlertCircle } from 'lucide-react';

export default function DigitalTwinModal({ isOpen, onClose, batchId, onSimulate }) {
  const { lang, t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!isOpen || !batchId) return;
    setLoading(true);
    setLoadError('');
    apiFetch(`/api/batches/${batchId}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.detail || `Failed to load batch details (${res.status})`);
        }
        return json;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(err.message || 'Unable to compute digital twin.');
        setLoading(false);
      });
  }, [isOpen, batchId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2 bg-slate-900 text-white">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shrink-0">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-bold break-words">
                  {t('digital_twin_title')}
                </h3>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-mono font-bold shrink-0">
                  {data?.batch_code || 'BATCH'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Continuous Q10 Kinetic Degradation Forecaster
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close digital twin modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5 text-xs sm:text-sm">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              Computing real-time decay parameters...
            </div>
          ) : loadError ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl flex items-center space-x-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{loadError}</span>
            </div>
          ) : data ? (
            <>
              {/* Top Stats Grid */}
              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 min-w-0">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Quality Index
                  </span>
                  <div className="flex flex-wrap items-baseline gap-1 mt-1">
                    <span className="text-xl sm:text-2xl font-black text-slate-900">
                      {data.digital_twin?.current_quality}%
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold">/ 100</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, data.digital_twin?.current_quality || 0)
                        )}%`
                      }}
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 min-w-0">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Remaining Life
                  </span>
                  <div className="flex flex-wrap items-baseline gap-1 mt-1">
                    <span className="text-xl sm:text-2xl font-black text-slate-900">
                      {data.digital_twin?.remaining_shelf_life_days}
                    </span>
                    <span className="text-[10px] text-slate-600 font-semibold">
                      Days ({data.digital_twin?.remaining_shelf_life_hrs}h)
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">Safe window before spoilage</p>
                </div>

                <div
                  className={`p-3.5 rounded-xl border min-w-0 ${
                    data.digital_twin?.spoilage_risk >= 70
                      ? 'bg-red-50 border-red-200 text-red-900'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Spoilage Risk
                  </span>
                  <div className="flex items-baseline space-x-1 mt-1">
                    <span
                      className={`text-xl sm:text-2xl font-black ${
                        data.digital_twin?.spoilage_risk >= 70 ? 'text-red-600' : 'text-slate-900'
                      }`}
                    >
                      {data.digital_twin?.spoilage_risk}%
                    </span>
                  </div>
                  <span
                    className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold ${data.digital_twin?.risk_bg_class}`}
                  >
                    {lang === 'hi' ? data.digital_twin?.risk_label_hi : data.digital_twin?.risk_label}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 min-w-0">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Decay Acceleration
                  </span>
                  <div className="flex flex-wrap items-baseline gap-1 mt-1">
                    <span className="text-xl sm:text-2xl font-black text-amber-600">
                      {data.digital_twin?.temperature_factor}x
                    </span>
                    <span className="text-[10px] text-slate-500">at {data.ambient_temp_c}°C</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">Q10 Heuristic Rate</p>
                </div>
              </div>

              {/* Mathematical Physics Breakdown */}
              <div className="bg-emerald-50/50 p-3.5 sm:p-4 rounded-xl border border-emerald-200 space-y-2">
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>Decay Model Formula Transparency (SRS Section 5.3.1)</span>
                </h4>
                <div className="font-mono text-[11px] text-emerald-950 space-y-1.5 bg-white/80 p-3 rounded-lg border border-emerald-100 break-words overflow-x-auto">
                  <p>
                    • <strong>Temperature Factor (TF):</strong> 2^((T - 20°C) / 10) = 2^((
                    {data.ambient_temp_c} - 20)/10) ={' '}
                    <strong>{data.digital_twin?.temperature_factor}x</strong>
                  </p>
                  <p>
                    • <strong>Effective Shelf-Life:</strong> Base{' '}
                    {data.digital_twin?.base_shelf_life_hrs}h /{' '}
                    {data.digital_twin?.temperature_factor} ={' '}
                    <strong>{data.digital_twin?.effective_shelf_life_hrs} hours</strong>
                  </p>
                  <p>
                    • <strong>Current Quality:</strong> {data.initial_quality ?? 98} × (1 -{' '}
                    {data.digital_twin?.hours_elapsed}h /{' '}
                    {data.digital_twin?.effective_shelf_life_hrs}h) ={' '}
                    <strong>{data.digital_twin?.current_quality}%</strong>
                  </p>
                </div>
              </div>

              {/* Visual Trajectory Timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center space-x-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span>{t('decay_curve')}</span>
                </h4>
                <div className="bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
                  <div className="space-y-2.5 sm:space-y-2">
                    {data.digital_twin?.trajectory?.slice(0, 6).map((step, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col min-[420px]:flex-row min-[420px]:items-center justify-between gap-1.5 sm:gap-4 text-xs py-1.5 sm:py-1 border-b border-slate-100 last:border-0"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              step.is_current
                                ? 'bg-emerald-500 ring-4 ring-emerald-200'
                                : 'bg-slate-300'
                            }`}
                          />
                          <span
                            className={`font-mono truncate ${
                              step.is_current ? 'font-bold text-emerald-700' : 'text-slate-600'
                            }`}
                          >
                            +{step.hours_from_harvest} hrs {step.is_current && '(Current State)'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
                          <div className="flex-1 min-[420px]:flex-initial min-[420px]:w-28 sm:w-32 bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                step.projected_quality > 60
                                  ? 'bg-emerald-500'
                                  : step.projected_quality > 30
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${step.projected_quality}%` }}
                            />
                          </div>
                          <span className="w-12 text-right font-mono font-bold text-slate-800 shrink-0">
                            {step.projected_quality}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 text-center"
          >
            Close
          </button>
          <button
            type="button"
            disabled={!data}
            onClick={() => {
              onClose();
              if (onSimulate && data) {
                onSimulate({
                  ...data,
                  current_quality: data.digital_twin?.current_quality ?? data.initial_quality
                });
              }
            }}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm"
          >
            <span>{t('simulate_scenario')}</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
