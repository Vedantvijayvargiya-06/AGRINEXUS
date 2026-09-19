import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  FileBarChart,
  Download,
  DollarSign,
  Scale,
  ShieldCheck,
  Truck,
  Sparkles,
  PieChart,
  TrendingUp
} from 'lucide-react';

export default function ReportsAnalyticsView() {
  const { lang, t } = useLanguage();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/reports/summary')
      .then(res => res.json())
      .then(data => {
        setSummary(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load reports:', err);
        setLoading(false);
      });
  }, []);

  const handleExportCSV = () => {
    window.open('/api/reports/export/csv', '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-950 to-slate-900 text-white p-6 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <FileBarChart className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black tracking-tight">{t('reports_title')}</h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">{t('reports_subtitle')}</p>
          </div>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-md shadow-emerald-600/20 self-start md:self-auto transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{t('export_csv')}</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-sm">Aggregating FPO performance metrics...</div>
      ) : summary ? (
        <>
          {/* Main KPI Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold uppercase">{t('total_batches')}</span>
              <p className="text-3xl font-black text-slate-900 mt-2">{summary.total_batches_handled}</p>
              <p className="text-[11px] text-slate-400 mt-1">Across 3 member farmer clusters</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-slate-500 text-xs font-semibold uppercase">{t('produce_tonnes')}</span>
              <p className="text-3xl font-black text-slate-900 mt-2">{summary.total_produce_tonnes} <span className="text-base font-bold text-slate-500">T</span></p>
              <p className="text-[11px] text-slate-400 mt-1">{summary.total_produce_kg.toLocaleString()} kg monitored</p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-emerald-800 text-xs font-bold uppercase">{t('total_revenue')}</span>
              <p className="text-3xl font-black text-emerald-700 mt-2">₹{summary.total_value_realized_inr?.toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-emerald-600 font-semibold mt-1">Total farmer payout realized</p>
            </div>

            <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-300 shadow-xs">
              <span className="text-emerald-900 text-xs font-bold uppercase flex items-center space-x-1">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{t('loss_prevented')}</span>
              </span>
              <p className="text-3xl font-black text-emerald-800 mt-2">₹{summary.estimated_loss_avoided_inr?.toLocaleString('en-IN')}</p>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">
                {summary.spoilage_tonnes_prevented} Tonnes spoilage prevented
              </p>
            </div>

          </div>

          {/* Logistics & Cost Savings Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Freight Before vs After */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>Cluster Logistics Before vs After (FR-10.3)</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between font-semibold text-slate-600 mb-1">
                    <span>Individual Dispatches (Baseline):</span>
                    <span className="font-bold text-red-600">₹4.50 - ₹5.20 / kg</span>
                  </div>
                  <div className="w-full bg-red-100 h-3 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full w-[85%]" />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-semibold text-slate-800 mb-1">
                    <span>AgriNexus Pooled Clusters:</span>
                    <span className="font-bold text-emerald-700">₹1.80 - ₹1.85 / kg ({summary.avg_freight_savings_pct}% Drop)</span>
                  </div>
                  <div className="w-full bg-emerald-100 h-3 rounded-full overflow-hidden">
                    <div className="bg-emerald-600 h-full w-[35%]" />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                Total aggregate freight saved by farmers this harvest cycle: <strong className="text-emerald-700 font-bold">₹{summary.total_freight_savings_inr?.toLocaleString('en-IN')}</strong>.
              </div>
            </div>

            {/* Decision Routing Distribution */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <PieChart className="w-4 h-4 text-emerald-600" />
                <span>Harvest Disposition Pathway Distribution</span>
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Terminal Redirect</span>
                  <p className="text-xl font-black text-slate-900 mt-1">45%</p>
                  <p className="text-[10px] text-slate-500">Azadpur / Vashi hubs</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Cold Storage</span>
                  <p className="text-xl font-black text-slate-900 mt-1">30%</p>
                  <p className="text-[10px] text-slate-500">Price surge capture</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Local Mandi Sell</span>
                  <p className="text-xl font-black text-slate-900 mt-1">15%</p>
                  <p className="text-[10px] text-slate-500">Immediate cash liquidation</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Secondary Processing</span>
                  <p className="text-xl font-black text-slate-900 mt-1">10%</p>
                  <p className="text-[10px] text-slate-500">Loss elimination</p>
                </div>
              </div>
            </div>

          </div>
        </>
      ) : null}

    </div>
  );
}
