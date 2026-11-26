import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import {
  Truck,
  CheckCircle2,
  Sparkles,
  MapPin,
  Send,
  AlertCircle,
  Clock
} from 'lucide-react';

export default function ClusterPoolingView() {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const isFpoOrAdmin = currentUser?.role === 'fpo_admin' || currentUser?.role === 'admin';

  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadClusters = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/clusters');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to load clusters (${res.status})`);
      }
      const data = await res.json();
      setClusters(Array.isArray(data) ? data : []);
    } catch (err) {
      setErrorMsg(err.message || 'Unable to load harvest pooling clusters.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClusters();
  }, []);

  const handleConfirmCluster = async (clusterId) => {
    if (!isFpoOrAdmin || confirmingId) return;
    setConfirmingId(clusterId);
    setStatusMsg('');
    setErrorMsg('');
    try {
      const res = await apiFetch('/api/clusters/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cluster_id: clusterId,
          admin_id: currentUser.id,
          destination_mandi: 'Azadpur Mandi, Delhi NCR'
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Cluster confirmation failed (${res.status})`);
      }
      setStatusMsg(
        data.message ||
          'Cluster confirmed! Automated SMS notifications dispatched to participating farmers.'
      );
      setTimeout(() => {
        setConfirmingId(null);
        loadClusters();
      }, 900);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to confirm cluster.');
      setConfirmingId(null);
    }
  };

  const handleOptimizeNew = async () => {
    if (!isFpoOrAdmin) return;
    setLoading(true);
    setErrorMsg('');
    setStatusMsg('');
    try {
      const res = await apiFetch('/api/clusters/optimize-candidates?crop=Tomato&locality=Kolar', {
        method: 'POST'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Optimization failed (${res.status})`);
      }
      setStatusMsg(data.message || 'Cluster candidate optimization complete.');
      await loadClusters();
    } catch (err) {
      setErrorMsg(err.message || 'Unable to optimize harvest clusters.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-4 sm:p-6 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                <Truck className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">{t('cluster_title')}</h2>
            </div>
            <p className="text-xs text-emerald-100 max-w-2xl">{t('cluster_subtitle')}</p>
          </div>

          {isFpoOrAdmin && (
            <button
              type="button"
              onClick={handleOptimizeNew}
              disabled={loading}
              className="w-full md:w-auto px-4 py-2.5 md:py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-500/20 self-start md:self-auto transition-all shrink-0"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Re-Optimize Harvest Clusters</span>
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-xl flex items-center space-x-2 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {statusMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center space-x-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Clusters List */}
      <div className="space-y-5">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            Evaluating cluster pooling candidates...
          </div>
        ) : clusters.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 space-y-2">
            <Truck className="w-8 h-8 mx-auto text-slate-400" />
            <p className="font-semibold text-sm">No active clusters in candidate state.</p>
            <p className="text-xs text-slate-400">
              Batches will auto-cluster when nearby farmers register fresh harvests.
            </p>
          </div>
        ) : (
          clusters.map((c) => {
            const isConfirmed = c.status === 'confirmed';

            return (
              <div
                key={c.id}
                className={`bg-white rounded-2xl border p-4 sm:p-5 transition-all shadow-sm ${
                  isConfirmed ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200'
                }`}
              >
                {/* Cluster Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono font-bold text-xs">
                        {c.cluster_code}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isConfirmed ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isConfirmed ? 'Confirmed Dispatch' : 'Candidate Cluster'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 flex items-start sm:items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5 sm:mt-0" />
                      <span className="break-words">
                        {c.locality} ➔ <strong>{c.destination_mandi}</strong>
                      </span>
                    </p>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Assigned Transport
                    </span>
                    <span className="text-xs font-bold text-slate-800">{c.vehicle_type}</span>
                    <div className="flex items-center justify-start sm:justify-end space-x-1 mt-0.5 text-[11px] font-semibold text-emerald-600">
                      <span>{c.capacity_utilization_pct}% Capacity Filled</span>
                    </div>
                  </div>
                </div>

                {/* Economic Comparison & Logistics Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 py-4 border-b border-slate-100 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 min-w-0">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Consolidated Volume
                    </span>
                    <p className="text-lg sm:text-xl font-black text-slate-900 mt-1 break-words">
                      {c.total_quantity_kg.toLocaleString()} kg
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {c.batches_count} member farmer batches
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 min-w-0">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      {t('solo_freight')}
                    </span>
                    <p className="text-lg sm:text-xl font-black text-red-600 mt-1 break-words">
                      ₹{c.individual_transport_cost_per_kg}/kg
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Small solo tempo trip</p>
                  </div>

                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 min-w-0">
                    <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                      {t('pooled_freight')}
                    </span>
                    <div className="flex flex-wrap items-baseline gap-2 mt-1">
                      <p className="text-lg sm:text-xl font-black text-emerald-700 break-words">
                        ₹{c.pooled_transport_cost_per_kg}/kg
                      </p>
                      <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-extrabold shrink-0">
                        Save {c.cost_savings_pct}%
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-700 mt-0.5">
                      Consolidated multi-axle freight
                    </p>
                  </div>
                </div>

                {/* Participating Batches Mini Table */}
                <div className="pt-3">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                    Participating Farm Lots ({c.batches?.length || 0})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {c.batches?.map((b) => (
                      <div
                        key={b.id}
                        className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center gap-2 min-w-0"
                      >
                        <div className="min-w-0">
                          <span className="font-bold text-slate-800 block truncate">
                            {b.farmer_name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 block truncate">
                            {b.batch_code}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-700 shrink-0">
                          {b.quantity_kg} kg
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confirm Action Button (FPO / Admin only) or Status Badge */}
                {!isConfirmed && (
                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-end">
                    {isFpoOrAdmin ? (
                      <button
                        type="button"
                        onClick={() => handleConfirmCluster(c.id)}
                        disabled={confirmingId === c.id}
                        className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20 transition-all text-center"
                      >
                        <Send className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {confirmingId === c.id ? 'Broadcasting SMS...' : t('confirm_and_sms')}
                        </span>
                      </button>
                    ) : (
                      <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px] font-semibold flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span>Awaiting FPO Administrator confirmation</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
