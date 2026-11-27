import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../utils/api';
import { Sliders, RotateCcw, AlertCircle } from 'lucide-react';

const CROP_PRICE_DEFAULTS = {
  Tomato: { local: 26.5, alt: 42.0 },
  Onion: { local: 22.0, alt: 36.0 },
  Potato: { local: 18.0, alt: 28.0 },
  Mango: { local: 55.0, alt: 90.0 },
  Apple: { local: 75.0, alt: 120.0 },
  Banana: { local: 24.0, alt: 40.0 },
  Cauliflower: { local: 25.0, alt: 42.0 },
  Guava: { local: 32.0, alt: 55.0 }
};

export default function WhatIfSimulator({ initialBatch }) {
  const { lang, t } = useLanguage();

  const initialCrop = initialBatch?.crop || 'Tomato';
  const defaultPrices = CROP_PRICE_DEFAULTS[initialCrop] || CROP_PRICE_DEFAULTS.Tomato;

  const [crop, setCrop] = useState(initialCrop);
  const [quantityKg, setQuantityKg] = useState(initialBatch?.quantity_kg || 1200);
  const [currentQuality, setCurrentQuality] = useState(initialBatch?.current_quality || 85);
  const [ambientTemp, setAmbientTemp] = useState(initialBatch?.ambient_temp_c || 28);
  const [transportDelayHours, setTransportDelayHours] = useState(0);
  const [storageDays, setStorageDays] = useState(7);
  const [priceSurgePct, setPriceSurgePct] = useState(15);
  const [isPooled, setIsPooled] = useState(true);
  const [localPrice, setLocalPrice] = useState(defaultPrices.local);
  const [alternatePrice, setAlternatePrice] = useState(defaultPrices.alt);

  const [simResult, setSimResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [simError, setSimError] = useState('');

  // Sync state when navigating into simulator from a specific batch
  useEffect(() => {
    if (!initialBatch) return;
    const nextCrop = initialBatch.crop || 'Tomato';
    const nextPrices = CROP_PRICE_DEFAULTS[nextCrop] || CROP_PRICE_DEFAULTS.Tomato;
    setCrop(nextCrop);
    setQuantityKg(initialBatch.quantity_kg || 1200);
    setCurrentQuality(initialBatch.current_quality || 85);
    setAmbientTemp(initialBatch.ambient_temp_c || 28);
    setLocalPrice(nextPrices.local);
    setAlternatePrice(nextPrices.alt);
  }, [initialBatch]);

  useEffect(() => {
    const qtyNum = parseFloat(quantityKg);
    const qualNum = parseFloat(currentQuality);
    const tempNum = parseFloat(ambientTemp);
    const delayNum = parseFloat(transportDelayHours);
    const daysNum = parseInt(storageDays, 10);
    const surgeNum = parseFloat(priceSurgePct);
    const localNum = parseFloat(localPrice);
    const altNum = parseFloat(alternatePrice);

    if (!Number.isFinite(qtyNum) || qtyNum <= 0 || qtyNum > 1000000) {
      setSimError('Lot quantity must be between 1 and 1,000,000 kg.');
      return;
    }
    if (!Number.isFinite(qualNum) || qualNum < 1 || qualNum > 100) {
      setSimError('Quality score must be between 1% and 100%.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSimError('');

    apiFetch('/api/decisions/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        crop,
        quantity_kg: qtyNum,
        current_quality: Number.isFinite(qualNum) ? qualNum : 85,
        ambient_temp_c: Number.isFinite(tempNum) ? tempNum : 28,
        hours_elapsed: 24.0,
        local_mandi_price_per_kg: Number.isFinite(localNum) ? localNum : 26.5,
        alternate_mandi_price_per_kg: Number.isFinite(altNum) ? altNum : 42.0,
        storage_days: Number.isFinite(daysNum) ? daysNum : 7,
        projected_price_surge_pct: Number.isFinite(surgeNum) ? surgeNum : 15,
        transport_delay_hours: Number.isFinite(delayNum) ? delayNum : 0,
        is_pooled: isPooled,
        cluster_pool_size_kg: 3500.0
      })
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.detail || `Simulation failed (${res.status})`);
        }
        return json;
      })
      .then((json) => {
        if (!cancelled) {
          setSimResult(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSimError(err.message || 'Unable to compute simulation.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    crop,
    quantityKg,
    currentQuality,
    ambientTemp,
    transportDelayHours,
    storageDays,
    priceSurgePct,
    isPooled,
    localPrice,
    alternatePrice
  ]);

  const handleCropChange = (nextCrop) => {
    const prices = CROP_PRICE_DEFAULTS[nextCrop] || CROP_PRICE_DEFAULTS.Tomato;
    setCrop(nextCrop);
    setLocalPrice(prices.local);
    setAlternatePrice(prices.alt);
  };

  const handleReset = () => {
    const prices = CROP_PRICE_DEFAULTS[crop] || CROP_PRICE_DEFAULTS.Tomato;
    setTransportDelayHours(0);
    setAmbientTemp(28);
    setStorageDays(7);
    setPriceSurgePct(15);
    setIsPooled(true);
    setLocalPrice(prices.local);
    setAlternatePrice(prices.alt);
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
      <div className="bg-gradient-to-r from-emerald-800 to-slate-900 text-white p-4 sm:p-6 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                <Sliders className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">
                {t('simulator_title')}
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">{t('simulator_subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="w-full sm:w-auto px-3 py-2 sm:py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 self-start md:self-auto transition-colors shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Parameters</span>
          </button>
        </div>
      </div>

      {simError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl flex items-center space-x-2 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{simError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sliders & Batch Context Panel */}
        <div className="lg:col-span-5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs sm:text-sm min-w-0">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs border-b border-slate-100 pb-2">
            Adjust Harvest & External Variables
          </h3>

          {/* Crop, Quantity & Quality */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Crop</label>
              <select
                value={crop}
                onChange={(e) => handleCropChange(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 bg-white"
              >
                {Object.keys(CROP_PRICE_DEFAULTS).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Lot (kg)
              </label>
              <input
                type="number"
                min="10"
                max="100000"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
              />
            </div>
            <div>
              <label htmlFor="sim-quality" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Quality (%)
              </label>
              <input
                id="sim-quality"
                type="number"
                min="1"
                max="100"
                value={currentQuality}
                onChange={(e) => setCurrentQuality(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums"
              />
            </div>
          </div>

          {/* Local & Terminal Mandi Prices */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div>
              <label htmlFor="sim-local-price" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Local Mandi Price (₹/kg)
              </label>
              <input
                id="sim-local-price"
                type="number"
                min="1"
                step="0.5"
                value={localPrice}
                onChange={(e) => setLocalPrice(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="sim-alt-price" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Terminal Hub Price (₹/kg)
              </label>
              <input
                id="sim-alt-price"
                type="number"
                min="1"
                step="0.5"
                value={alternatePrice}
                onChange={(e) => setAlternatePrice(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 tabular-nums"
              />
            </div>
          </div>

          {/* Transport Delay Slider */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap justify-between items-center gap-1.5 text-xs">
              <label className="font-semibold text-slate-700">{t('param_transport_delay')}:</label>
              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                +{transportDelayHours} hrs {Number(transportDelayHours) > 6 && '⚠️ Risk'}
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
            <p className="text-[10px] text-slate-400">
              Simulate roadblock, vehicle breakdown or weather delays.
            </p>
          </div>

          {/* Ambient Temperature Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-700">{t('param_ambient_temp')}:</label>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded ${
                  Number(ambientTemp) > 30
                    ? 'bg-red-100 text-red-800'
                    : 'bg-slate-100 text-slate-900'
                }`}
              >
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
            <p className="text-[10px] text-slate-400">
              Higher temperatures accelerate microbiological degradation.
            </p>
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
            <p className="text-[10px] text-slate-400">
              Cold storage holding charges accumulate per kg/day.
            </p>
          </div>

          {/* Price Surge Projection Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-slate-700">{t('param_price_surge')}:</label>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded ${
                  Number(priceSurgePct) >= 0
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {Number(priceSurgePct) > 0 ? `+${priceSurgePct}` : priceSurgePct}%
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
            <p className="text-[10px] text-slate-400">
              Forecasted festival or supply shortage price swing.
            </p>
          </div>

          {/* Cluster Pooling Toggle */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <span className="font-semibold text-slate-800 block text-xs">
                Enable Cluster Pooling Rate
              </span>
              <p className="text-[10px] text-slate-400">
                Shares transport with neighboring farmers
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPooled(!isPooled)}
              className={`w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg font-bold text-xs transition-colors shrink-0 ${
                isPooled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {isPooled ? 'Enabled (60% Off Freight)' : 'Solo Freight'}
            </button>
          </div>
        </div>

        {/* Live Simulation Outcomes Display */}
        <div className="lg:col-span-7 space-y-4 min-w-0">
          {loading && !simResult ? (
            <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
              Computing simulated net returns...
            </div>
          ) : simResult ? (
            <>
              <div className="bg-white p-4 sm:p-5 rounded-2xl border-2 border-emerald-500 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-extrabold uppercase shrink-0">
                      Live Optimal Action
                    </span>
                    <h3 className="text-base font-black text-slate-900 break-words">
                      {lang === 'hi' ? simResult.recommended_title_hi : simResult.recommended_title}
                    </h3>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold">
                      Simulated Net
                    </span>
                    <span className="text-xl font-black text-emerald-700 break-words">
                      ₹
                      {simResult.best_expected_value?.toLocaleString('en-IN', {
                        minimumFractionDigits: 2
                      })}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950">
                  <p>{lang === 'hi' ? simResult.explanation_hi : simResult.explanation_en}</p>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Comparative Net Realization (₹)
                </h4>

                <div className="space-y-3">
                  {['sell_now', 'store', 'process', 'redirect'].map((key) => {
                    const isWinner = simResult.recommended_action === key;
                    const val = simResult.net_values?.[key] || 0;
                    const maxVal = Math.max(
                      ...Object.values(simResult.net_values || {}).map((v) => Math.max(0, v)),
                      1
                    );
                    const widthPct = Math.max(
                      val > 0 ? 8 : 0,
                      Math.min(100, (Math.max(0, val) / maxVal) * 100)
                    );

                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex flex-wrap justify-between items-baseline gap-1 text-xs font-semibold">
                          <span className={isWinner ? 'text-emerald-700 font-bold' : 'text-slate-700'}>
                            {getActionName(key)} {isWinner && '★'}
                          </span>
                          <span className="font-mono font-bold text-slate-900">
                            ₹{val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isWinner ? 'bg-emerald-500 shadow-sm' : 'bg-slate-400'
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
