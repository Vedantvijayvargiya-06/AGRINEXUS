import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { X, Activity, Thermometer, Clock, ShieldAlert, Sparkles, TrendingDown, ArrowRight } from 'lucide-react';

export default function DigitalTwinModal({ isOpen, onClose, batchId, onSimulate }) {
  const { lang, t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !batchId) return;
    setLoading(true);
    fetch(`/api/batches/${batchId}`)
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load batch twin:', err);
        setLoading(false);
      });
  }, [isOpen, batchId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold">{t('digital_twin_title')}</h3>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded text-[10px] font-mono font-bold">
                  {data?.batch_code || 'BATCH'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Continuous $Q_{10}$ Kinetic Degradation Forecaster</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs sm:text-sm">
          {loading ? (
            <div className="py-16 text-center text-slate-400">Computing real-time decay parameters...</div>
          ) : data ? (
            <>
              {/* Top Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                
                {/* Quality Score */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Quality Index</span>
                  <div className="flex items-baseline space-x-1 mt-1">
                    <span className="text-2xl font-black text-slate-900">{data.digital_twin?.current_quality}%</span>
                    <span className="text-[10px] text-emerald-600 font-semibold">/ 100</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${data.digital_twin?.current_quality}%` }}
                    />
                  </div>
                </div>

                {/* Remaining Safe Life */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Remaining Life</span>
                  <div className="flex items-baseline space-x-1 mt-1">
                    <span className="text-2xl font-black text-slate-900">{data.digital_twin?.remaining_shelf_life_days}</span>
                    <span className="text-[10px] text-slate-600 font-semibold">Days ({data.digital_twin?.remaining_shelf_life_hrs}h)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">Safe window before spoilage</p>
                </div>

                {/* Spoilage Risk */}
                <div className={`p-3.5 rounded-xl border ${
                  data.digital_twin?.spoilage_risk >= 70
                    ? 'bg-red-50 border-red-200 text-red-900'
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}>
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Spoilage Risk</span>
                  <div className="flex items-baseline space-x-1 mt-1">
                    <span className={`text-2xl font-black ${
                      data.digital_twin?.spoilage_risk >= 70 ? 'text-red-600' : 'text-slate-900'
                    }`}>
                      {data.digital_twin?.spoilage_risk}%
                    </span>
                  </div>
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold ${data.digital_twin?.risk_bg_class}`}>
                    {lang === 'hi' ? data.digital_twin?.risk_label_hi : data.digital_twin?.risk_label}
                  </span>
                </div>

                {/* Ambient Temp Multiplier */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Decay Acceleration</span>
                  <div className="flex items-baseline space-x-1 mt-1">
                    <span className="text-2xl font-black text-amber-600">{data.digital_twin?.temperature_factor}x</span>
                    <span className="text-[10px] text-slate-500">at {data.ambient_temp_c}°C</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">Q10 Heuristic Rate</p>
                </div>

              </div>

              {/* Mathematical Physics Breakdown */}
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-2">
                <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Decay Model Formula Transparency (SRS Section 5.3.1)</span>
                </h4>
                <div className="font-mono text-[11px] text-emerald-950 space-y-1 bg-white/80 p-3 rounded-lg border border-emerald-100">
                  <p>• <strong>Temperature Factor (TF):</strong> 2^((T - 20°C) / 10) = 2^(({data.ambient_temp_c} - 20)/10) = <strong>{data.digital_twin?.temperature_factor}x</strong></p>
                  <p>• <strong>Effective Shelf-Life:</strong> Base {data.digital_twin?.base_shelf_life_hrs}h / {data.digital_twin?.temperature_factor} = <strong>{data.digital_twin?.effective_shelf_life_hrs} hours</strong></p>
                  <p>• <strong>Current Quality:</strong> 100 × (1 - {data.digital_twin?.hours_elapsed}h / {data.digital_twin?.effective_shelf_life_hrs}h) = <strong>{data.digital_twin?.current_quality}%</strong></p>
                </div>
              </div>

              {/* Visual Trajectory Timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-2 flex items-center space-x-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-slate-600" />
                  <span>{t('decay_curve')}</span>
                </h4>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="space-y-2">
                    {data.digital_twin?.trajectory?.slice(0, 6).map((step, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${step.is_current ? 'bg-emerald-500 ring-4 ring-emerald-200' : 'bg-slate-300'}`} />
                          <span className={`font-mono ${step.is_current ? 'font-bold text-emerald-700' : 'text-slate-600'}`}>
                            +{step.hours_from_harvest} hrs {step.is_current && "(Current State)"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="w-32 bg-slate-200 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${step.projected_quality > 60 ? 'bg-emerald-500' : step.projected_quality > 30 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${step.projected_quality}%` }}
                            />
                          </div>
                          <span className="w-12 text-right font-mono font-bold text-slate-800">{step.projected_quality}%</span>
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
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              if (onSimulate && data) onSimulate(data);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-sm"
          >
            <span>{t('simulate_scenario')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
