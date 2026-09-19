import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import {
  Truck,
  Users,
  TrendingDown,
  CheckCircle2,
  Sparkles,
  MapPin,
  Scale,
  Send,
  Radio,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export default function ClusterPoolingView() {
  const { lang, t } = useLanguage();
  const { currentUser } = useAuth();

  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');

  const loadClusters = () => {
    setLoading(true);
    fetch('/api/clusters')
      .then(res => res.json())
      .then(data => {
        setClusters(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load clusters:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadClusters();
  }, []);

  const handleConfirmCluster = async (clusterId) => {
    setConfirmingId(clusterId);
    setStatusMsg('');
    try {
      const res = await fetch('/api/clusters/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cluster_id: clusterId,
          admin_id: currentUser.id,
          destination_mandi: 'Azadpur Mandi, Delhi NCR'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setStatusMsg(`Cluster confirmed! Automated SMS notifications dispatched to participating farmers.`);
        setTimeout(() => {
          setConfirmingId(null);
          loadClusters();
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to confirm cluster:', err);
      setConfirmingId(null);
    }
  };

  const handleOptimizeNew = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/clusters/optimize-candidates?crop=Tomato&locality=Kolar', {
        method: 'POST'
      });
      if (res.ok) {
        loadClusters();
      }
    } catch (err) {
      console.error('Optimization error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-teal-900 text-white p-6 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                <Truck className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black tracking-tight">{t('cluster_title')}</h2>
            </div>
            <p className="text-xs text-emerald-100 max-w-2xl">{t('cluster_subtitle')}</p>
          </div>

          <button
            onClick={handleOptimizeNew}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md shadow-emerald-500/20 self-start md:self-auto transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Re-Optimize Harvest Clusters</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center space-x-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Clusters List */}
      <div className="space-y-5">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">Evaluating cluster pooling candidates...</div>
        ) : clusters.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 space-y-2">
            <Truck className="w-8 h-8 mx-auto text-slate-400" />
            <p className="font-semibold text-sm">No active clusters in candidate state.</p>
            <p className="text-xs text-slate-400">Batches will auto-cluster when nearby farmers register fresh harvests.</p>
          </div>
        ) : (
          clusters.map((c) => {
            const isConfirmed = c.status === 'confirmed';

            return (
              <div
                key={c.id}
                className={`bg-white rounded-2xl border p-5 transition-all shadow-xs ${
                  isConfirmed ? 'border-emerald-300 bg-emerald-50/20' : 'border-slate-200'
                }`}
              >
                
                {/* Cluster Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono font-bold text-xs">
                        {c.cluster_code}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isConfirmed ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isConfirmed ? 'Confirmed Dispatch' : 'Candidate Cluster'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.locality} ➔ <strong>{c.destination_mandi}</strong></span>
                    </p>
                  </div>

                  {/* Vehicle Spec */}
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Transport</span>
                    <span className="text-xs font-bold text-slate-800">{c.vehicle_type}</span>
                    <div className="flex items-center justify-end space-x-1 mt-0.5 text-[11px] font-semibold text-emerald-600">
                      <span>{c.capacity_utilization_pct}% Capacity Filled</span>
                    </div>
                  </div>
                </div>

                {/* Economic Comparison & Logistics Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4 border-b border-slate-100 text-xs">
                  
                  {/* Total Volume */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Consolidated Volume</span>
                    <p className="text-xl font-black text-slate-900 mt-1">{c.total_quantity_kg.toLocaleString()} kg</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{c.batches_count} member farmer batches</p>
                  </div>

                  {/* Individual Freight */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">{t('solo_freight')}</span>
                    <p className="text-xl font-black text-red-600 mt-1">₹{c.individual_transport_cost_per_kg}/kg</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Small solo tempo trip</p>
                  </div>

                  {/* Pooled Freight with Savings */}
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 uppercase font-bold block">{t('pooled_freight')}</span>
                    <div className="flex items-baseline space-x-2 mt-1">
                      <p className="text-xl font-black text-emerald-700">₹{c.pooled_transport_cost_per_kg}/kg</p>
                      <span className="px-1.5 py-0.2 bg-emerald-600 text-white rounded text-[10px] font-extrabold">
                        Save {c.cost_savings_pct}%
                      </span>
                    </div>
                    <p className="text-[10px] text-emerald-700 mt-0.5">Consolidated multi-axle freight</p>
                  </div>

                </div>

                {/* Participating Batches Mini Table */}
                <div className="pt-3">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                    Participating Farm Lots ({c.batches?.length || 0})
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {c.batches?.map((b) => (
                      <div key={b.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
                        <div>
                          <span className="font-bold text-slate-800 block">{b.farmer_name}</span>
                          <span className="text-[10px] font-mono text-slate-500">{b.batch_code}</span>
                        </div>
                        <span className="font-mono font-bold text-emerald-700">{b.quantity_kg} kg</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confirm Action Button */}
                {!isConfirmed && (
                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-end">
                    <button
                      onClick={() => handleConfirmCluster(c.id)}
                      disabled={confirmingId === c.id}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-2 shadow-md shadow-emerald-600/20 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{confirmingId === c.id ? 'Broadcasting SMS...' : t('confirm_and_sms')}</span>
                    </button>
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
