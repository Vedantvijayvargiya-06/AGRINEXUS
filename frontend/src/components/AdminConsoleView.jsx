import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import {
  Settings,
  Users,
  CheckCircle2,
  Save,
  Cpu,
  AlertCircle,
  UserPlus
} from 'lucide-react';

export default function AdminConsoleView() {
  const { t } = useLanguage();
  const { currentUser } = useAuth();
  const isSystemAdmin = currentUser?.role === 'admin';

  const [health, setHealth] = useState(null);
  const [cropConstants, setCropConstants] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedCrop, setSelectedCrop] = useState(null);
  const [saveMsg, setSaveMsg] = useState('');
  const [actionError, setActionError] = useState('');

  // Admin staff provisioning form
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('fpo_admin');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);

  const loadAdminData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [hRes, cRes, uRes] = await Promise.all([
        apiFetch('/api/admin/system-health'),
        apiFetch('/api/admin/crop-constants'),
        apiFetch('/api/auth/users')
      ]);

      if (!hRes.ok || !cRes.ok || !uRes.ok) {
        throw new Error('Failed to load administrator telemetry or user registry.');
      }

      const [h, c, u] = await Promise.all([hRes.json(), cRes.json(), uRes.json()]);
      setHealth(h);
      setCropConstants(c);
      setUsers(u);
      if (c.length > 0) {
        setSelectedCrop((prev) => c.find((item) => item.crop === prev?.crop) || c[0]);
      }
    } catch (err) {
      setLoadError(err.message || 'Unable to load system console data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleNumericField = (field, raw) => {
    const val = raw === '' ? '' : parseFloat(raw);
    setSelectedCrop((prev) => ({ ...prev, [field]: Number.isNaN(val) ? '' : val }));
  };

  const handleUpdateConstants = async (e) => {
    e.preventDefault();
    if (!selectedCrop || !isSystemAdmin) return;
    setActionError('');
    setSaveMsg('');

    const payload = {
      ...selectedCrop,
      base_shelf_life_hours: Number(selectedCrop.base_shelf_life_hours),
      q10_factor: Number(selectedCrop.q10_factor),
      processing_rate_per_kg: Number(selectedCrop.processing_rate_per_kg),
      cold_storage_rate_per_day_kg: Number(selectedCrop.cold_storage_rate_per_day_kg)
    };

    try {
      const res = await apiFetch('/api/admin/crop-constants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Failed to save crop constants (${res.status})`);
      }
      setSaveMsg(`Constants for ${selectedCrop.crop} updated successfully.`);
      setTimeout(() => setSaveMsg(''), 2500);
      loadAdminData();
    } catch (err) {
      setActionError(err.message || 'Failed to update crop constants.');
    }
  };

  const handleApproveUser = async (userId, currentStatus) => {
    if (!isSystemAdmin) return;
    setActionError('');
    try {
      const res = await apiFetch('/api/admin/approve-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, is_approved: !currentStatus })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Approval toggle failed (${res.status})`);
      }
      loadAdminData();
    } catch (err) {
      setActionError(err.message || 'Unable to update user approval status.');
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!isSystemAdmin || creatingStaff) return;
    setActionError('');
    setSaveMsg('');
    setCreatingStaff(true);

    try {
      const res = await apiFetch('/api/auth/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newStaffName.trim(),
          email: newStaffEmail.trim(),
          phone: newStaffPhone.trim() || null,
          role: newStaffRole,
          password: newStaffPassword
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Failed to provision account (${res.status})`);
      }

      setSaveMsg(data.message || 'Staff account provisioned successfully.');
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPhone('');
      setNewStaffPassword('');
      await loadAdminData();
    } catch (err) {
      setActionError(err.message || 'Unable to create privileged account.');
    } finally {
      setCreatingStaff(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 sm:p-6 rounded-2xl shadow-md">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg shrink-0">
              <Settings className="w-5 h-5" />
            </span>
            <h2 className="text-lg sm:text-xl font-black tracking-tight">{t('nav_admin')}</h2>
          </div>
          <p className="text-xs text-slate-300">
            System health telemetry, crop degradation heuristics configuration, and user governance
          </p>
        </div>
      </div>

      {loadError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2 font-semibold">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            type="button"
            onClick={loadAdminData}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {saveMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{saveMsg}</span>
        </div>
      )}

      {loading && !health ? (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
          Loading system telemetry and governance data...
        </div>
      ) : (
        <>
          {/* System Health Telemetry */}
          {health && (
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                <span className="text-slate-500 text-[10px] uppercase font-bold block truncate">
                  API Server Uptime
                </span>
                <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 break-words">
                  {health.api_uptime_pct}%
                </p>
                <span className="text-[10px] text-slate-400">{health.database || 'SQLite'}</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                <span className="text-slate-500 text-[10px] uppercase font-bold block truncate">
                  Latency
                </span>
                <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1 break-words">
                  {health.sync_latency_ms}{' '}
                  <span className="text-xs text-slate-400 font-normal">ms</span>
                </p>
                <span className="text-[10px] text-emerald-600 font-semibold">&lt; 500ms SLA</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                <span className="text-slate-500 text-[10px] uppercase font-bold block truncate">
                  Active Batches
                </span>
                <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1 break-words">
                  {health.total_active_batches}
                </p>
                <span className="text-[10px] text-slate-400">Digital Twins running</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
                <span className="text-slate-500 text-[10px] uppercase font-bold block truncate">
                  Registered Users
                </span>
                <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1 break-words">
                  {health.total_registered_users}
                </p>
                <span className="text-[10px] text-slate-400">Across FPO networks</span>
              </div>
            </div>
          )}

          {/* 2-Column Config Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Crop Degradation Constants Tuner */}
            <div className="lg:col-span-7 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs sm:text-sm min-w-0">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                  <Cpu className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Crop Kinetic Constants & Baseline Physics (FR-12.2)</span>
                </h3>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-1.5 sm:space-x-1 sm:gap-0 overflow-x-auto pb-1">
                {cropConstants.map((c) => (
                  <button
                    type="button"
                    key={c.crop}
                    onClick={() => setSelectedCrop(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedCrop?.crop === c.crop
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {c.crop}
                  </button>
                ))}
              </div>

              {selectedCrop && (
                <form onSubmit={handleUpdateConstants} className="space-y-3 pt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Base Safe Shelf-Life (Hours at 20°C)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        required
                        disabled={!isSystemAdmin}
                        value={selectedCrop.base_shelf_life_hours}
                        onChange={(e) => handleNumericField('base_shelf_life_hours', e.target.value)}
                        className="w-full px-3 py-2 sm:py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 disabled:bg-slate-50"
                      />
                      <span className="text-[10px] text-slate-400">
                        {Math.round((Number(selectedCrop.base_shelf_life_hours) || 0) / 24)} days
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Q10 Kinetic Temperature Factor
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        max="5"
                        required
                        disabled={!isSystemAdmin}
                        value={selectedCrop.q10_factor}
                        onChange={(e) => handleNumericField('q10_factor', e.target.value)}
                        className="w-full px-3 py-2 sm:py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 disabled:bg-slate-50"
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
                        min="0"
                        required
                        disabled={!isSystemAdmin}
                        value={selectedCrop.processing_rate_per_kg}
                        onChange={(e) => handleNumericField('processing_rate_per_kg', e.target.value)}
                        className="w-full px-3 py-2 sm:py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 disabled:bg-slate-50"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Cold Storage Rate (₹/day/kg)
                      </label>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        required
                        disabled={!isSystemAdmin}
                        value={selectedCrop.cold_storage_rate_per_day_kg}
                        onChange={(e) =>
                          handleNumericField('cold_storage_rate_per_day_kg', e.target.value)
                        }
                        className="w-full px-3 py-2 sm:py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 disabled:bg-slate-50"
                      />
                    </div>
                  </div>

                  {isSystemAdmin && (
                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        type="submit"
                        className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm"
                      >
                        <Save className="w-3.5 h-3.5 shrink-0" />
                        <span>Save Crop Constants</span>
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>

            {/* User Governance + Staff Provisioning */}
            <div className="lg:col-span-5 space-y-6 min-w-0">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs min-w-0">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 flex items-center space-x-2">
                    <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>User Governance & Approvals (FR-12.1)</span>
                  </h3>
                </div>

                <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col min-[380px]:flex-row min-[380px]:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-slate-900 break-words">{u.name}</span>
                          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] uppercase font-bold shrink-0">
                            {u.role}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block break-words">
                          {u.phone || u.email} • {u.locality}
                        </span>
                      </div>

                      {isSystemAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleApproveUser(u.id, u.is_approved)}
                          className={`self-start min-[380px]:self-auto px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] font-bold transition-colors shrink-0 ${
                            u.is_approved
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          }`}
                        >
                          {u.is_approved ? 'Approved ✓' : 'Pending'}
                        </button>
                      ) : (
                        <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 shrink-0">
                          {u.is_approved ? 'Approved' : 'Pending'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {isSystemAdmin && (
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-xs min-w-0">
                  <div className="flex items-center space-x-2 border-b border-slate-100 pb-2.5">
                    <UserPlus className="w-4 h-4 text-emerald-600 shrink-0" />
                    <h3 className="font-bold text-slate-900">
                      Provision FPO Admin / Staff Account
                    </h3>
                  </div>

                  <form onSubmit={handleCreateStaff} className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          minLength={2}
                          value={newStaffName}
                          onChange={(e) => setNewStaffName(e.target.value)}
                          placeholder="Staff full name"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Assigned Role
                        </label>
                        <select
                          value={newStaffRole}
                          onChange={(e) => setNewStaffRole(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white font-semibold"
                        >
                          <option value="fpo_admin">FPO Administrator</option>
                          <option value="admin">System Administrator</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Work Email
                        </label>
                        <input
                          type="email"
                          required
                          value={newStaffEmail}
                          onChange={(e) => setNewStaffEmail(e.target.value)}
                          placeholder="staff@agrinexus.in"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          10-Digit Phone (Optional)
                        </label>
                        <input
                          type="tel"
                          maxLength={10}
                          value={newStaffPhone}
                          onChange={(e) => setNewStaffPhone(e.target.value.replace(/\D/g, ''))}
                          placeholder="10 digits"
                          className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Initial Password (8+ chars)
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newStaffPassword}
                        onChange={(e) => setNewStaffPassword(e.target.value)}
                        placeholder="Minimum 8 characters"
                        className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-900"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={creatingStaff}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>{creatingStaff ? 'Creating...' : 'Create Staff Account'}</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
