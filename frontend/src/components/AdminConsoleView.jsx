import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  Settings,
  Users,
  Activity,
  Sliders,
  CheckCircle2,
  Server,
  Shield,
  Save,
  Cpu
} from 'lucide-react';

export default function AdminConsoleView() {
  const { lang, t } = useLanguage();

  const [health, setHealth] = useState(null);
  const [cropConstants, setCropConstants] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');

  const loadAdminData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/admin/system-health').then(r => r.json()),
      fetch('/api/admin/crop-constants').then(r => r.json()),
      fetch('/api/auth/users').then(r => r.json())
    ])
      .then(([h, c, u]) => {
        setHealth(h);
        setCropConstants(c);
        setUsers(u);
        if (c.length > 0) setSelectedCrop(c[0]);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load admin data:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleUpdateConstants = async (e) => {
    e.preventDefault();
    if (!selectedCrop) return;

    try {
      const res = await fetch('/api/admin/crop-constants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedCrop)
      });
      if (res.ok) {
        setSaveMsg(`Constants for ${selectedCrop.crop} updated successfully.`);
        setTimeout(() => setSaveMsg(''), 2000);
      }
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const handleApproveUser = async (userId, currentStatus) => {
    try {
      const res = await fetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, is_approved: !currentStatus })
      });
      if (res.ok) {
        loadAdminData();
      }
    } catch (err) {
      console.error('Approval toggle error:', err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-md">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Settings className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-black tracking-tight">{t('nav_admin')}</h2>
          </div>
          <p className="text-xs text-slate-300">
            System health telemetry, crop degradation heuristics configuration, and user governance
          </p>
        </div>
      </div>

      {/* System Health Telemetry */}
      {health && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-[10px] uppercase font-bold">API Server Uptime</span>
            <p className="text-2xl font-black text-emerald-600 mt-1">{health.api_uptime_pct}%</p>
            <span className="text-[10px] text-slate-400">Stateless REST Layer</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Latency</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{health.sync_latency_ms} <span className="text-xs text-slate-400 font-normal">ms</span></p>
            <span className="text-[10px] text-emerald-600 font-semibold">&lt; 500ms SLA</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Active Batches</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{health.total_active_batches}</p>
            <span className="text-[10px] text-slate-400">Digital Twins running</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-[10px] uppercase font-bold">Registered Users</span>
            <p className="text-2xl font-black text-slate-900 mt-1">{health.total_registered_users}</p>
            <span className="text-[10px] text-slate-400">Across FPO networks</span>
          </div>
        </div>
      )}

      {/* 2-Column Config Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Crop Degradation Constants Tuner (Left 7 Cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs sm:text-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-emerald-600" />
              <span>Crop Kinetic Constants & Baseline Physics (FR-12.2)</span>
            </h3>
          </div>

          {saveMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{saveMsg}</span>
            </div>
          )}

          {/* Crop Selector Tabs */}
          <div className="flex space-x-1 overflow-x-auto pb-1">
            {cropConstants.map((c) => (
              <button
                key={c.crop}
                onClick={() => setSelectedCrop(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedCrop?.crop === c.crop
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {c.crop}
              </button>
            ))}
          </div>

          {selectedCrop && (
            <form onSubmit={handleUpdateConstants} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Base Safe Shelf-Life (Hours at 20°C)
                  </label>
                  <input
                    type="number"
                    value={selectedCrop.base_shelf_life_hours}
                    onChange={(e) => setSelectedCrop({ ...selectedCrop, base_shelf_life_hours: parseFloat(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400">{Math.round(selectedCrop.base_shelf_life_hours / 24)} days</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Q10 Kinetic Temperature Factor
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedCrop.q10_factor}
                    onChange={(e) => setSelectedCrop({ ...selectedCrop, q10_factor: parseFloat(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                  <span className="text-[10px] text-slate-400">Decay multiplier per 10°C</span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Processing Yield Value (₹/kg)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedCrop.processing_rate_per_kg}
                    onChange={(e) => setSelectedCrop({ ...selectedCrop, processing_rate_per_kg: parseFloat(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Cold Storage Rate (₹/day/kg)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={selectedCrop.cold_storage_rate_per_day_kg}
                    onChange={(e) => setSelectedCrop({ ...selectedCrop, cold_storage_rate_per_day_kg: parseFloat(e.target.value) })}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Crop Constants</span>
                </button>
              </div>
            </form>
          )}

        </div>

        {/* User Account & FPO Governance (Right 5 Cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-900 flex items-center space-x-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <span>User Governance & Approvals (FR-12.1)</span>
            </h3>
          </div>

          <div className="space-y-2.5 max-h-[360px] overflow-y-auto">
            {users.map((u) => (
              <div key={u.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900">{u.name}</span>
                    <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded text-[9px] uppercase font-bold">
                      {u.role}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">{u.phone || u.email} • {u.locality}</span>
                </div>

                <button
                  onClick={() => handleApproveUser(u.id, u.is_approved)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                    u.is_approved
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }`}
                >
                  {u.is_approved ? 'Approved ✓' : 'Pending'}
                </button>
              </div>
            ))}
          </div>

        </div>

      </div>

    </div>
  );
}
