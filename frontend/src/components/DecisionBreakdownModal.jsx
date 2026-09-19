import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  X,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Warehouse,
  Factory,
  Navigation,
  Info
} from 'lucide-react';

export default function DecisionBreakdownModal({ isOpen, onClose, batchId, onConfirmed }) {
  const { lang, t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState('');

  useEffect(() => {
    if (!isOpen || !batchId) return;
    setLoading(true);
    setConfirmedSuccess('');
    fetch(`/api/decisions/batch/${batchId}`)
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load decision breakdown:', err);
        setLoading(false);
      });
  }, [isOpen, batchId]);

  if (!isOpen) return null;

  const handleConfirmAction = async () => {
    if (!data) return;
    setConfirming(true);
    try {
      const res = await fetch('/api/batches/confirm-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batchId,
          actual_action: data.recommended_action,
          actual_value_realised: data.best_expected_value,
          feedback_notes: 'Farmer confirmed AI decision recommendation'
        })
      });
      if (res.ok) {
        setConfirmedSuccess('Decision confirmed and dispatched to FPO dispatch ledger!');
        setTimeout(() => {
          setConfirming(false);
          if (onConfirmed) onConfirmed();
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to confirm action:', err);
      setConfirming(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'sell_now': return <ShoppingBag className="w-5 h-5 text-blue-600" />;
      case 'store': return <Warehouse className="w-5 h-5 text-indigo-600" />;
      case 'process': return <Factory className="w-5 h-5 text-amber-600" />;
      case 'redirect': return <Navigation className="w-5 h-5 text-emerald-600" />;
      default: return <DollarSign className="w-5 h-5 text-slate-600" />;
    }
  };

  const getActionTitle = (action) => {
    switch (action) {
      case 'sell_now': return t('pathway_sell_now');
      case 'store': return t('pathway_store');
      case 'process': return t('pathway_process');
      case 'redirect': return t('pathway_redirect');
      default: return action;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-900 text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-700 text-emerald-100 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">{t('decision_engine_title')}</h3>
              <p className="text-xs text-emerald-200">Mathematical Optimization (SRS Section 5.3.2)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs sm:text-sm">
          {loading ? (
            <div className="py-16 text-center text-slate-400">Evaluating 4 decision pathways...</div>
          ) : data ? (
            <>
              {confirmedSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center space-x-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{confirmedSuccess}</span>
                </div>
              )}

              {/* Winning Recommendation Card */}
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-5 rounded-2xl shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 bg-white/20 backdrop-blur-xs text-white rounded-full text-[11px] font-extrabold uppercase tracking-wider">
                      ★ {t('winning_recommendation')}
                    </span>
                    <span className="text-xs text-emerald-100 font-medium">95% Confidence</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-emerald-100 block uppercase font-semibold">Expected Net Income</span>
                    <span className="text-2xl font-black">₹{data.best_expected_value?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/20 text-xs leading-relaxed">
                  <p className="font-medium">
                    {lang === 'hi' ? data.explanation_hi : data.explanation_en}
                  </p>
                </div>
              </div>

              {/* 4 Pathways Comparison Grid */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center space-x-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-600" />
                  <span>Comparing All 4 Pathways</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {['sell_now', 'store', 'process', 'redirect'].map((actionKey) => {
                    const isWinner = data.recommended_action === actionKey;
                    const netVal = data.net_values?.[actionKey] || 0;
                    const calcData = data.formula_breakdown?.calculations?.[actionKey] || {};

                    return (
                      <div
                        key={actionKey}
                        className={`p-4 rounded-xl border transition-all ${
                          isWinner
                            ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'bg-slate-50/70 border-slate-200 opacity-85 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-xs">
                              {getActionIcon(actionKey)}
                            </div>
                            <span className={`text-xs font-bold ${isWinner ? 'text-emerald-900' : 'text-slate-800'}`}>
                              {getActionTitle(actionKey)}
                            </span>
                          </div>
                          {isWinner && (
                            <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-extrabold uppercase">
                              Best Choice
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-xs pt-1 border-t border-slate-200/60">
                          <div className="flex justify-between text-slate-500 text-[11px]">
                            <span>Gross Return:</span>
                            <span className="font-semibold text-slate-700">₹{calcData.gross?.toLocaleString('en-IN') || '—'}</span>
                          </div>
                          <div className="flex justify-between text-slate-500 text-[11px]">
                            <span>Deductions:</span>
                            <span className="font-semibold text-red-600">-₹{(calcData.transport || calcData.storage_cost || calcData.processing_fee || calcData.freight_cost || 0)?.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200 font-bold">
                            <span className="text-slate-700">Net Return:</span>
                            <span className={`text-base font-black ${isWinner ? 'text-emerald-700' : 'text-slate-900'}`}>
                              ₹{netVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Exact Formula Inputs Auditing */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-600" />
                  <span>Formula Inputs & Transparent Audit Log (FR-7.3)</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-slate-600">
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Quantity:</span>
                    <strong>{data.formula_breakdown?.inputs?.quantity_kg || 1000} kg</strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Quality Factor:</span>
                    <strong>{(data.formula_breakdown?.inputs?.current_quality_pct || 90)}%</strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Local Mandi:</span>
                    <strong>₹{data.formula_breakdown?.inputs?.local_mandi_price || 26.5}/kg</strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Terminal Mandi:</span>
                    <strong>₹{data.formula_breakdown?.inputs?.alternate_mandi_price || 42}/kg</strong>
                  </div>
                </div>
              </div>

            </>
          ) : null}
        </div>

        {/* Footer (2-tap execution) */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close
          </button>
          
          <button
            onClick={handleConfirmAction}
            disabled={confirming || !!confirmedSuccess}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-md shadow-emerald-600/20"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{confirming ? 'Executing Decision...' : t('confirm_action')}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
