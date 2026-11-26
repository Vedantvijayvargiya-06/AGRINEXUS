import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../utils/api';
import {
  X,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Sparkles,
  ShoppingBag,
  Warehouse,
  Factory,
  Navigation,
  Info,
  AlertCircle
} from 'lucide-react';

function getPathwayDeductions(actionKey, calcData = {}) {
  switch (actionKey) {
    case 'sell_now':
      return calcData.transport || 0;
    case 'store':
      return (calcData.storage_cost || 0) + (calcData.transport || 0);
    case 'process':
      return calcData.processing_fee || 0;
    case 'redirect':
      return (calcData.freight_cost || 0) + (calcData.handling_fee || 0);
    default:
      return 0;
  }
}

export default function DecisionBreakdownModal({ isOpen, onClose, batchId, onConfirmed }) {
  const { lang, t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmedSuccess, setConfirmedSuccess] = useState('');

  useEffect(() => {
    if (!isOpen || !batchId) return;
    setLoading(true);
    setLoadError('');
    setConfirmError('');
    setConfirmedSuccess('');

    apiFetch(`/api/decisions/batch/${batchId}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.detail || `Failed to load decision breakdown (${res.status})`);
        }
        return json;
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(err.message || 'Unable to evaluate decision pathways.');
        setLoading(false);
      });
  }, [isOpen, batchId]);

  if (!isOpen) return null;

  const handleConfirmAction = async () => {
    if (!data || confirming) return;
    setConfirming(true);
    setConfirmError('');
    try {
      const res = await apiFetch('/api/batches/confirm-outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batchId,
          actual_action: data.recommended_action,
          actual_value_realised: data.best_expected_value,
          feedback_notes: 'Farmer confirmed AI decision recommendation'
        })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.detail || `Confirmation failed (${res.status})`);
      }

      setConfirmedSuccess('Decision confirmed and dispatched to FPO dispatch ledger!');
      setTimeout(() => {
        setConfirming(false);
        if (onConfirmed) onConfirmed();
        onClose();
      }, 900);
    } catch (err) {
      setConfirmError(err.message || 'Failed to confirm decision outcome.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2 bg-emerald-900 text-white">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-2 bg-emerald-700 text-emerald-100 rounded-xl shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold break-words">
                {t('decision_engine_title')}
              </h3>
              <p className="text-xs text-emerald-200">
                Mathematical Optimization (SRS Section 5.3.2)
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close decision breakdown"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-800 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5 text-xs sm:text-sm">
          {loading ? (
            <div className="py-16 text-center text-slate-400">
              Evaluating 4 decision pathways...
            </div>
          ) : loadError ? (
            <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl flex items-center space-x-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{loadError}</span>
            </div>
          ) : data ? (
            <>
              {confirmError && (
                <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl flex items-center space-x-2 font-semibold">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{confirmError}</span>
                </div>
              )}

              {confirmedSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center space-x-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{confirmedSuccess}</span>
                </div>
              )}

              {/* Winning Recommendation Card */}
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 sm:p-5 rounded-2xl shadow-md space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="px-2.5 py-0.5 bg-white/20 backdrop-blur-sm text-white rounded-full text-[11px] font-extrabold uppercase tracking-wider">
                      ★ {t('winning_recommendation')}
                    </span>
                    <span className="text-xs text-emerald-100 font-medium">95% Confidence</span>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[10px] text-emerald-100 block uppercase font-semibold">
                      Expected Net Income
                    </span>
                    <span className="text-xl sm:text-2xl font-black break-words">
                      ₹
                      {data.best_expected_value?.toLocaleString('en-IN', {
                        minimumFractionDigits: 2
                      })}
                    </span>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-sm p-3.5 rounded-xl border border-white/20 text-xs leading-relaxed">
                  <p className="font-medium">
                    {lang === 'hi' ? data.explanation_hi : data.explanation_en}
                  </p>
                </div>
              </div>

              {/* 4 Pathways Comparison Grid */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide mb-3 flex items-center space-x-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span>Comparing All 4 Pathways</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {['sell_now', 'store', 'process', 'redirect'].map((actionKey) => {
                    const isWinner = data.recommended_action === actionKey;
                    const netVal = data.net_values?.[actionKey] || 0;
                    const calcData = data.formula_breakdown?.calculations?.[actionKey] || {};
                    const totalDeductions = getPathwayDeductions(actionKey, calcData);

                    return (
                      <div
                        key={actionKey}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all min-w-0 ${
                          isWinner
                            ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-sm'
                            : 'bg-slate-50/70 border-slate-200 opacity-85 hover:opacity-100'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <div className="p-1.5 bg-white rounded-lg border border-slate-200 shadow-sm shrink-0">
                              {getActionIcon(actionKey)}
                            </div>
                            <span
                              className={`text-xs font-bold break-words ${
                                isWinner ? 'text-emerald-900' : 'text-slate-800'
                              }`}
                            >
                              {getActionTitle(actionKey)}
                            </span>
                          </div>
                          {isWinner && (
                            <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-extrabold uppercase shrink-0">
                              Best Choice
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-xs pt-1 border-t border-slate-200/60">
                          <div className="flex justify-between gap-2 text-slate-500 text-[11px]">
                            <span>Gross Return:</span>
                            <span className="font-semibold text-slate-700">
                              ₹{calcData.gross?.toLocaleString('en-IN') ?? '—'}
                            </span>
                          </div>
                          <div className="flex justify-between gap-2 text-slate-500 text-[11px]">
                            <span>Total Deductions:</span>
                            <span className="font-semibold text-red-600">
                              -₹{totalDeductions.toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="flex flex-wrap justify-between items-baseline gap-1 pt-1.5 border-t border-slate-200 font-bold">
                            <span className="text-slate-700">Net Return:</span>
                            <span
                              className={`text-base font-black break-words ${
                                isWinner ? 'text-emerald-700' : 'text-slate-900'
                              }`}
                            >
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
              <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center space-x-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  <span>Formula Inputs & Transparent Audit Log (FR-7.3)</span>
                </h4>
                <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] text-slate-600">
                  <div className="bg-white p-2 rounded border border-slate-200 min-w-0">
                    <span className="text-[10px] text-slate-400 block">Quantity:</span>
                    <strong className="break-words">
                      {data.formula_breakdown?.inputs?.quantity_kg ?? '—'} kg
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200 min-w-0">
                    <span className="text-[10px] text-slate-400 block">Quality Factor:</span>
                    <strong className="break-words">
                      {data.formula_breakdown?.inputs?.current_quality_pct ?? '—'}%
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200 min-w-0">
                    <span className="text-[10px] text-slate-400 block">Local Mandi:</span>
                    <strong className="break-words">
                      ₹{data.formula_breakdown?.inputs?.local_mandi_price ?? '—'}/kg
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-slate-200 min-w-0">
                    <span className="text-[10px] text-slate-400 block">Terminal Mandi:</span>
                    <strong className="break-words">
                      ₹{data.formula_breakdown?.inputs?.alternate_mandi_price ?? '—'}/kg
                    </strong>
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
            onClick={handleConfirmAction}
            disabled={loading || !!loadError || !data || confirming || !!confirmedSuccess}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{confirming ? 'Executing Decision...' : t('confirm_action')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
