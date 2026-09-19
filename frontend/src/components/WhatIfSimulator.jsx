import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  Sliders,
  Sparkles,
  TrendingUp,
  RotateCcw,
  ShoppingBag,
  Warehouse,
  Factory,
  Navigation,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export default function WhatIfSimulator({ initialBatch }) {
  const { lang, t } = useLanguage();

  const [crop, setCrop] = useState(initialBatch?.crop || 'Tomato');
  const [quantityKg, setQuantityKg] = useState(initialBatch?.quantity_kg || 1200);
  const [currentQuality, setCurrentQuality] = useState(initialBatch?.current_quality || 85);
  const [ambientTemp, setAmbientTemp] = useState(initialBatch?.ambient_temp_c || 28);
  const [transportDelayHours, setTransportDelayHours] = useState(0);
  const [storageDays, setStorageDays] = useState(7);
  const [priceSurgePct, setPriceSurgePct] = useState(15);
  const [isPooled, setIsPooled] = useState(true);
  const [localPrice, setLocalPrice] = useState(26.5);
  const [alternatePrice, setAlternatePrice] = useState(42.0);

  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const runSimulation = () => {
    setLoading(true);
    fetch('/api/decisions/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crop,
        quantity_kg: parseFloat(quantityKg),
        current_quality: parseFloat(currentQuality),
        ambient_temp_c: parseFloat(ambientTemp),
        hours_elapsed: 24.0,
        local_mandi_price_per_kg: parseFloat(localPrice),
        alternate_mandi_price_per_kg: parseFloat(alternatePrice),
        storage_days: parseInt(storageDays),
        projected_price_surge_pct: parseFloat(priceSurgePct),
        transport_delay_hours: parseFloat(transportDelayHours),
        is_pooled: isPooled,
        cluster_pool_size_kg: 3500.0
      })
    })
      .then(res => res.json())
      .then(json => {
        setSimResult(json);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to run simulation:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    runSimulation();
  }, [crop, quantityKg, currentQuality, ambientTemp, transportDelayHours, storageDays, priceSurgePct, isPooled, localPrice, alternatePrice]);

  const handleReset = () => {
    setTransportDelayHours(0);
    setAmbientTemp(28);
    setStorageDays(7);
    setPriceSurgePct(15);
    setIsPooled(true);
  };

  const getActionName = (key) => {
    switch (key) {
      case 'sell_now': return t('pathway_sell_now');
      case 'store': return t('pathway_store');
      case 'process': return t('pathway_process');
      case 'redirect': return t('pathway_redirect');
      default: return key;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-slate-900 text-white p-6 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <Sliders className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black tracking-tight">{t('simulator_title')}</h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">{t('simulator_subtitle')}</p>
          </div>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 self-start md:self-auto transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Parameters</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sliders Panel (Left 5 Cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-5 text-xs sm:text-sm">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs border-b border-slate-100 pb-2">
            Adjust External Variables
          </h3>

          {/* Transport Delay Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-700">{t('param_transport_delay')}:</label>
              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                +{transportDelayHours} hrs {transportDelayHours > 6 && "⚠️ Risk"}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="24"
              step="1"
              value={transportDelayHours}
              onChange={(e) => setTransportDelayHours(e.target.value)}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">Simulate roadblock, vehicle breakdown or weather delays.</p>
          </div>

          {/* Ambient Temperature Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-700">{t('param_ambient_temp')}:</label>
              <span className={`font-mono font-bold px-2 py-0.5 rounded ${ambientTemp > 30 ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-900'}`}>
                {ambientTemp}°C
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="42"
              step="1"
              value={ambientTemp}
              onChange={(e) => setAmbientTemp(e.target.value)}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">Higher temperatures accelerate microbiological degradation.</p>
          </div>

          {/* Storage Duration Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-700">{t('param_storage_days')}:</label>
              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {storageDays} Days
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              step="1"
              value={storageDays}
              onChange={(e) => setStorageDays(e.target.value)}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">Cold storage holding charges accumulate per kg/day.</p>
          </div>

          {/* Price Surge Projection Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-700">{t('param_price_surge')}:</label>
              <span className={`font-mono font-bold px-2 py-0.5 rounded ${priceSurgePct >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                {priceSurgePct > 0 ? `+${priceSurgePct}` : priceSurgePct}%
              </span>
            </div>
            <input
              type="range"
              min="-20"
              max="40"
              step="5"
              value={priceSurgePct}
              onChange={(e) => setPriceSurgePct(e.target.value)}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <p className="text-[10px] text-slate-400">Forecasted festival or supply shortage price swing.</p>
          </div>

          {/* Cluster Pooling Toggle */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800 block text-xs">Enable Cluster Pooling Rate</span>
              <p className="text-[10px] text-slate-400">Shares transport with neighboring farmers</p>
            </div>
            <button
              onClick={() => setIsPooled(!isPooled)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                isPooled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {isPooled ? "Enabled (60% Off Freight)" : "Solo Freight"}
            </button>
          </div>

        </div>

        {/* Live Simulation Outcomes Display (Right 7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {simResult && (
            <>
              {/* Dynamic Winner Banner */}
              <div className="bg-white p-5 rounded-2xl border-2 border-emerald-500 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-extrabold uppercase">
                      Live Optimal Action
                    </span>
                    <h3 className="text-base font-black text-slate-900">
                      {lang === 'hi' ? simResult.recommended_title_hi : simResult.recommended_title}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">Simulated Net</span>
                    <span className="text-xl font-black text-emerald-700">
                      ₹{simResult.best_expected_value?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950">
                  <p>{lang === 'hi' ? simResult.explanation_hi : simResult.explanation_en}</p>
                </div>
              </div>

              {/* Reactive Visual Comparison Bars */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Comparative Net Realization (₹)
                </h4>

                <div className="space-y-3">
                  {['sell_now', 'store', 'process', 'redirect'].map((key) => {
                    const isWinner = simResult.recommended_action === key;
                    const val = simResult.net_values?.[key] || 0;
                    const maxVal = Math.max(...Object.values(simResult.net_values || {}), 1);
                    const widthPct = Math.max(10, (val / maxVal) * 100);

                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className={isWinner ? 'text-emerald-700 font-bold' : 'text-slate-700'}>
                            {getActionName(key)} {isWinner && "★"}
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            ₹{val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isWinner
                                ? 'bg-emerald-500 shadow-sm'
                                : 'bg-slate-400'
                            }`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </>
          )}

        </div>

      </div>

    </div>
  );
}
