import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Edit3,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Search
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

export default function MarketIntelligenceView() {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const isAdminOrFpo = currentUser?.role === 'admin' || currentUser?.role === 'fpo_admin';

  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filterCrop, setFilterCrop] = useState('');
  const [selectedForOverride, setSelectedForOverride] = useState(null);
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideMsg, setOverrideMsg] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [submittingOverride, setSubmittingOverride] = useState(false);

  const loadPrices = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await apiFetch('/api/market/prices');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to load mandi prices (${res.status})`);
      }
      const data = await res.json();
      setPrices(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err.message || 'Unable to load mandi price feeds.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrices();
  }, []);

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!selectedForOverride || submittingOverride) return;

    const parsed = parseFloat(overrideValue);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setOverrideError('Please enter a valid positive modal price (₹/kg).');
      return;
    }

    setOverrideError('');
    setOverrideMsg('');
    setSubmittingOverride(true);

    try {
      const res = await apiFetch('/api/market/override-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_price_id: selectedForOverride.id,
          new_modal_price: parsed
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Price override failed (${res.status})`);
      }

      setOverrideMsg('Price updated and farmer recalculation alerts broadcasted!');
      setTimeout(() => {
        setSelectedForOverride(null);
        setOverrideMsg('');
        setSubmittingOverride(false);
        loadPrices();
      }, 900);
    } catch (err) {
      setOverrideError(err.message || 'Unable to override mandi rate.');
      setSubmittingOverride(false);
    }
  };

  const filtered = prices.filter(
    (p) => !filterCrop || p.crop.toLowerCase().includes(filterCrop.toLowerCase())
  );

  const getTrendBadge = (trend, changePct) => {
    if (trend === 'rising') {
      return (
        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-xs font-bold flex items-center space-x-1">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>+{changePct}%</span>
        </span>
      );
    } else if (trend === 'falling') {
      return (
        <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-md text-xs font-bold flex items-center space-x-1">
          <TrendingDown className="w-3.5 h-3.5" />
          <span>{changePct}%</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-bold flex items-center space-x-1">
        <Minus className="w-3.5 h-3.5" />
        <span>Flat</span>
      </span>
    );
  };

  const renderSourceBadge = (p) => {
    const isOverride = p.source_type === 'admin_override' || p.is_manual_override;
    return (
      <span
        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
          isOverride
            ? 'bg-amber-100 text-amber-800'
            : 'bg-slate-100 text-slate-600'
        }`}
      >
        {isOverride ? 'FPO Override' : 'Demo Feed'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-emerald-950 text-white p-4 sm:p-6 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                <TrendingUp className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">{t('market_title')}</h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">{t('market_subtitle')}</p>
          </div>

          <div className="flex items-center space-x-2 w-full md:w-auto">
            <input
              type="text"
              placeholder="Search crop (e.g. Tomato)..."
              value={filterCrop}
              onChange={(e) => setFilterCrop(e.target.value)}
              aria-label="Filter mandi prices by crop"
              className="flex-1 min-w-0 md:w-56 px-3 py-2 sm:py-1.5 bg-white/10 text-white placeholder:text-slate-400 border border-white/20 rounded-xl text-xs focus:outline-none focus:bg-white/20"
            />
            <button
              type="button"
              onClick={loadPrices}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors shrink-0"
              title="Refresh Feeds"
              aria-label="Refresh Feeds"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-semibold">{loadError}</span>
          </div>
          <button
            type="button"
            onClick={loadPrices}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Override Price Modal (Admin / FPO Admin only) */}
      {selectedForOverride && isAdminOrFpo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-4 sm:p-5 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Edit3 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t('override_price')}</span>
            </h3>
            <p className="text-xs text-slate-500">
              Update modal rate for <strong>{selectedForOverride.crop}</strong> at{' '}
              <strong>{selectedForOverride.mandi}</strong>.
            </p>

            {overrideError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{overrideError}</span>
              </div>
            )}

            {overrideMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{overrideMsg}</span>
              </div>
            )}

            <form onSubmit={handleOverrideSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  New Modal Price (₹/kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  required
                  value={overrideValue}
                  onChange={(e) => setOverrideValue(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedForOverride(null);
                    setOverrideError('');
                    setOverrideMsg('');
                  }}
                  className="w-full sm:w-auto px-3 py-2 sm:py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOverride}
                  className="w-full sm:w-auto px-4 py-2 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold text-center"
                >
                  {submittingOverride ? 'Broadcasting...' : 'Broadcast Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile & Tablet Market Cards (< lg) */}
      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3">
        {loading ? (
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
            Loading daily mandi price feeds...
          </div>
        ) : filtered.length === 0 ? (
          <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs space-y-2">
            <Search className="w-6 h-6 mx-auto text-slate-400" />
            <p className="font-semibold">No mandi feeds match &ldquo;{filterCrop}&rdquo;.</p>
          </div>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg shrink-0">{getCropIcon(p.crop)}</span>
                    <h3 className="font-bold text-slate-900 text-sm truncate">{p.crop}</h3>
                  </div>
                  <p className="text-xs text-slate-600 flex items-start space-x-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="break-words">
                      {p.mandi} • {p.state} ({p.distance_km} km)
                    </span>
                  </p>
                </div>
                <div className="shrink-0">{getTrendBadge(p.trend, p.price_change_pct)}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl text-xs">
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    {t('modal_price')}
                  </span>
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    <span className="font-black text-slate-900 text-base">
                      ₹{p.modal_price_per_kg.toFixed(2)}
                    </span>
                    {renderSourceBadge(p)}
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                    {t('range_price')}
                  </span>
                  <span className="font-semibold text-slate-700 block mt-0.5">
                    ₹{p.min_price_per_kg} - ₹{p.max_price_per_kg}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs text-slate-600">
                  {t('arrivals')}:{' '}
                  <strong className="text-slate-800">{p.arrivals_tonnes} Tonnes</strong>
                </span>
                {isAdminOrFpo && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedForOverride(p);
                      setOverrideValue(p.modal_price_per_kg.toString());
                      setOverrideError('');
                      setOverrideMsg('');
                    }}
                    className="px-3 py-1.5 text-xs border border-slate-200 hover:border-slate-300 hover:bg-slate-100 rounded-lg font-semibold text-slate-700"
                  >
                    Override
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Market Prices Table (>= lg) */}
      <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs lg:text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-3 lg:p-4 whitespace-nowrap">Crop</th>
                <th className="p-3 lg:p-4 whitespace-nowrap">{t('mandi_name')}</th>
                <th className="p-3 lg:p-4 whitespace-nowrap">{t('modal_price')}</th>
                <th className="p-3 lg:p-4 whitespace-nowrap">{t('range_price')}</th>
                <th className="p-3 lg:p-4 whitespace-nowrap">{t('trend')}</th>
                <th className="p-3 lg:p-4 whitespace-nowrap">{t('arrivals')}</th>
                {isAdminOrFpo && (
                  <th className="p-3 lg:p-4 text-right whitespace-nowrap">Action</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={isAdminOrFpo ? 7 : 6} className="p-8 text-center text-slate-400">
                    Loading daily mandi price feeds...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={isAdminOrFpo ? 7 : 6} className="p-8 text-center text-slate-500">
                    No mandi feeds match &ldquo;{filterCrop}&rdquo;.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 lg:p-4 font-bold text-slate-900 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span>{getCropIcon(p.crop)}</span>
                        <span>{p.crop}</span>
                      </div>
                    </td>
                    <td className="p-3 lg:p-4 text-slate-700">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{p.mandi}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        {p.state} ({p.distance_km} km)
                      </span>
                    </td>
                    <td className="p-3 lg:p-4 font-black text-slate-900 text-sm lg:text-base whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span>₹{p.modal_price_per_kg.toFixed(2)}</span>
                        {renderSourceBadge(p)}
                      </div>
                    </td>
                    <td className="p-3 lg:p-4 text-slate-600 whitespace-nowrap">
                      ₹{p.min_price_per_kg} - ₹{p.max_price_per_kg}
                    </td>
                    <td className="p-3 lg:p-4 whitespace-nowrap">
                      {getTrendBadge(p.trend, p.price_change_pct)}
                    </td>
                    <td className="p-3 lg:p-4 text-slate-700 whitespace-nowrap">
                      {p.arrivals_tonnes} Tonnes
                    </td>
                    {isAdminOrFpo && (
                      <td className="p-3 lg:p-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedForOverride(p);
                            setOverrideValue(p.modal_price_per_kg.toString());
                            setOverrideError('');
                            setOverrideMsg('');
                          }}
                          className="px-2.5 py-1.5 text-xs border border-slate-200 hover:border-slate-300 hover:bg-slate-100 rounded-lg font-semibold text-slate-700"
                        >
                          Override
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
