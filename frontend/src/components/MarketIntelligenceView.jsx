import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Filter,
  RefreshCw,
  Edit3,
  MapPin,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function MarketIntelligenceView() {
  const { lang, t } = useLanguage();
  const { currentUser } = useAuth();

  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCrop, setFilterCrop] = useState('');
  const [selectedForOverride, setSelectedForOverride] = useState(null);
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideMsg, setOverrideMsg] = useState('');

  const loadPrices = () => {
    setLoading(true);
    fetch('/api/market/prices')
      .then(res => res.json())
      .then(data => {
        setPrices(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load prices:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadPrices();
  }, []);

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!selectedForOverride || !overrideValue) return;

    try {
      const res = await fetch('/api/market/override-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_price_id: selectedForOverride.id,
          new_modal_price: parseFloat(overrideValue)
        })
      });

      if (res.ok) {
        setOverrideMsg(`Price updated and farmer recalculation alerts broadcasted!`);
        setTimeout(() => {
          setSelectedForOverride(null);
          setOverrideMsg('');
          loadPrices();
        }, 1200);
      }
    } catch (err) {
      console.error('Price override error:', err);
    }
  };

  const filtered = prices.filter(p => !filterCrop || p.crop.toLowerCase().includes(filterCrop.toLowerCase()));

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
    } else {
      return (
        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-bold flex items-center space-x-1">
          <Minus className="w-3.5 h-3.5" />
          <span>Flat</span>
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-emerald-950 text-white p-6 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black tracking-tight">{t('market_title')}</h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">{t('market_subtitle')}</p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Search crop (e.g. Tomato)..."
              value={filterCrop}
              onChange={(e) => setFilterCrop(e.target.value)}
              className="px-3 py-1.5 bg-white/10 text-white placeholder:text-slate-400 border border-white/20 rounded-xl text-xs focus:outline-none focus:bg-white/20"
            />
            <button
              onClick={loadPrices}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
              title="Refresh Feeds"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Override Price Modal */}
      {selectedForOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Edit3 className="w-4 h-4 text-emerald-600" />
              <span>{t('override_price')}</span>
            </h3>
            <p className="text-xs text-slate-500">
              Update modal rate for <strong>{selectedForOverride.crop}</strong> at <strong>{selectedForOverride.mandi}</strong>.
            </p>

            {overrideMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{overrideMsg}</span>
              </div>
            )}

            <form onSubmit={handleOverrideSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Modal Price (₹/kg)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={overrideValue}
                  onChange={(e) => setOverrideValue(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedForOverride(null)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                >
                  Broadcast Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Market Prices Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold text-[11px] uppercase tracking-wider">
              <tr>
                <th className="p-4">Crop</th>
                <th className="p-4">{t('mandi_name')}</th>
                <th className="p-4">{t('modal_price')}</th>
                <th className="p-4">{t('range_price')}</th>
                <th className="p-4">{t('trend')}</th>
                <th className="p-4">{t('arrivals')}</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-400">Loading daily mandi price feeds...</td>
                </tr>
              ) : filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-bold text-slate-900 flex items-center space-x-2">
                    <span>{p.crop === 'Tomato' ? '🍅' : p.crop === 'Onion' ? '🧅' : p.crop === 'Potato' ? '🥔' : p.crop === 'Mango' ? '🥭' : '🍎'}</span>
                    <span>{p.crop}</span>
                  </td>
                  <td className="p-4 text-slate-700">
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{p.mandi}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block">{p.state} ({p.distance_km} km)</span>
                  </td>
                  <td className="p-4 font-black text-slate-900 text-base">
                    ₹{p.modal_price_per_kg.toFixed(2)}
                    {p.is_manual_override && (
                      <span className="ml-1.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded text-[9px] font-bold">
                        Override
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-slate-600">
                    ₹{p.min_price_per_kg} - ₹{p.max_price_per_kg}
                  </td>
                  <td className="p-4">
                    {getTrendBadge(p.trend, p.price_change_pct)}
                  </td>
                  <td className="p-4 text-slate-700">
                    {p.arrivals_tonnes} Tonnes
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedForOverride(p);
                        setOverrideValue(p.modal_price_per_kg.toString());
                      }}
                      className="px-2.5 py-1 text-xs border border-slate-200 hover:border-slate-300 hover:bg-slate-100 rounded-lg font-semibold text-slate-700"
                    >
                      Override
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
