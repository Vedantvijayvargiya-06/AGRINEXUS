import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../utils/api';
import {
  FileBarChart,
  Download,
  ShieldCheck,
  Truck,
  PieChart,
  AlertCircle
} from 'lucide-react';

export default function ReportsAnalyticsView() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const loadSummary = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/reports/summary');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Failed to load FPO reports (${res.status})`);
      }
      setSummary(data);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to load analytics summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const handleExportCSV = async () => {
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/reports/export/csv');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'agrinexus_post_harvest_report.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to export CSV report.');
    }
  };

  const dist = summary?.decision_distribution || {
    redirect: 0,
    store: 0,
    sell_now: 0,
    process: 0
  };
  const totalDecisions =
    (dist.redirect || 0) + (dist.store || 0) + (dist.sell_now || 0) + (dist.process || 0);
  const pct = (count) => (totalDecisions > 0 ? Math.round((count / totalDecisions) * 100) : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-950 to-slate-900 text-white p-4 sm:p-6 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                <FileBarChart className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">
                {t('reports_title')}
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">{t('reports_subtitle')}</p>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={loading || !summary}
            className="w-full md:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20 self-start md:self-auto transition-all shrink-0"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{t('export_csv')}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 font-semibold">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={loadSummary}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">
          Aggregating FPO performance metrics...
        </div>
      ) : summary ? (
        <>
          {/* Main KPI Stats Grid */}
          <div className="grid grid-cols-1 min-[375px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm min-w-0">
              <span className="text-slate-500 text-[11px] sm:text-xs font-semibold uppercase block truncate">
                {t('total_batches')}
              </span>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 break-words">
                {summary.total_batches_handled}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Across {summary.active_clusters_count} active farmer clusters
              </p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm min-w-0">
              <span className="text-slate-500 text-[11px] sm:text-xs font-semibold uppercase block truncate">
                {t('produce_tonnes')}
              </span>
              <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2 break-words">
                {summary.total_produce_tonnes}{' '}
                <span className="text-sm sm:text-base font-bold text-slate-500">T</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {summary.total_produce_kg.toLocaleString()} kg monitored
              </p>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm min-w-0">
              <span className="text-emerald-800 text-[11px] sm:text-xs font-bold uppercase block truncate">
                {t('total_revenue')}
              </span>
              <p className="text-xl sm:text-3xl font-black text-emerald-700 mt-2 break-words">
                ₹{summary.total_value_realized_inr?.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                Total farmer payout realized
              </p>
            </div>

            <div className="bg-emerald-50 p-4 sm:p-5 rounded-2xl border border-emerald-300 shadow-sm min-w-0">
              <span className="text-emerald-900 text-[11px] sm:text-xs font-bold uppercase flex items-center space-x-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">{t('loss_prevented')}</span>
              </span>
              <p className="text-xl sm:text-3xl font-black text-emerald-800 mt-2 break-words">
                ₹{summary.estimated_loss_avoided_inr?.toLocaleString('en-IN')}
              </p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                {summary.spoilage_tonnes_prevented} Tonnes spoilage prevented
              </p>
            </div>
          </div>

          {/* Logistics & Decision Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 min-w-0">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <Truck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Cluster Logistics Before vs After (FR-10.3)</span>
              </h3>

              {summary.active_clusters_count > 0 && summary.avg_solo_cost_per_kg > 0 ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex flex-wrap justify-between gap-1 font-semibold text-slate-600 mb-1">
                      <span>Individual Dispatches (Weighted Avg):</span>
                      <span className="font-bold text-red-600 tabular-nums">
                        ₹{summary.avg_solo_cost_per_kg.toFixed(2)} / kg
                      </span>
                    </div>
                    <div className="w-full bg-red-100 h-3 rounded-full overflow-hidden">
                      <div className="bg-red-500 h-full w-full" />
                    </div>
                  </div>

                  <div>
                    <div className="flex flex-wrap justify-between gap-1 font-semibold text-slate-800 mb-1">
                      <span>AgriNexus Pooled Clusters:</span>
                      <span className="font-bold text-emerald-700 tabular-nums">
                        ₹{summary.avg_pooled_cost_per_kg.toFixed(2)} / kg ({summary.avg_freight_savings_pct}% Drop)
                      </span>
                    </div>
                    <div className="w-full bg-emerald-100 h-3 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full transition-all duration-300"
                        style={{
                          width: `${Math.max(
                            8,
                            Math.min(
                              100,
                              Math.round(
                                (summary.avg_pooled_cost_per_kg /
                                  Math.max(0.01, summary.avg_solo_cost_per_kg)) *
                                  100
                              )
                            )
                          )}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                  No active pooled freight clusters calculated yet. Optimize candidate clusters to view solo vs pooled freight savings.
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                Total aggregate freight saved by farmers this harvest cycle:{' '}
                <strong className="text-emerald-700 font-bold tabular-nums">
                  ₹{summary.total_freight_savings_inr?.toLocaleString('en-IN')}
                </strong>
                .
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 min-w-0">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <PieChart className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Harvest Disposition Pathway Distribution</span>
              </h3>

              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 min-w-0">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Terminal Redirect
                  </span>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    {pct(dist.redirect)}%
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {dist.redirect || 0} batches • Azadpur / Vashi hubs
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 min-w-0">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Cold Storage
                  </span>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    {pct(dist.store)}%
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {dist.store || 0} batches • Price surge capture
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 min-w-0">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Local Mandi Sell
                  </span>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    {pct(dist.sell_now)}%
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {dist.sell_now || 0} batches • Immediate liquidation
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 min-w-0">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">
                    Secondary Processing
                  </span>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    {pct(dist.process)}%
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {dist.process || 0} batches • Loss elimination
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
