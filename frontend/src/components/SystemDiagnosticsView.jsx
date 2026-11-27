import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import {
  Activity,
  ShieldCheck,
  Database,
  Play,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Server,
  X,
  Trash2,
  Check
} from 'lucide-react';

function formatDuration(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}h ${m}m ${rem}s`;
  if (m > 0) return `${m}m ${rem}s`;
  return `${rem}s`;
}

export default function SystemDiagnosticsView() {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';

  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [runningScope, setRunningScope] = useState('');
  const [activeRun, setActiveRun] = useState(null);
  const [selectedError, setSelectedError] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const loadOverview = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiFetch(`/api/admin/diagnostics/overview?include_resolved=${showResolved}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Failed to load diagnostics (${res.status})`);
      }
      setOverview(data);
      if (!activeRun && Array.isArray(data.diagnostic_runs) && data.diagnostic_runs.length > 0) {
        setActiveRun(data.diagnostic_runs[0]);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Unable to load system diagnostics overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [showResolved]);

  const handleRunDiagnostics = async (scope = 'full') => {
    if (!isAdmin || runningScope) return;
    setRunningScope(scope);
    setErrorMsg('');
    setActionMsg('');
    try {
      const res = await apiFetch('/api/admin/diagnostics/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Diagnostic run failed (${res.status})`);
      }
      setActiveRun(data);
      setActionMsg(`Completed ${scope} suite (${data.passed_checks}/${data.total_checks} passed).`);
      await loadOverview();
    } catch (err) {
      setErrorMsg(err.message || 'Unable to execute diagnostic suite.');
    } finally {
      setRunningScope('');
    }
  };

  const handleResolveError = async (id) => {
    try {
      const res = await apiFetch(`/api/admin/diagnostics/errors/${id}/resolve`, {
        method: 'PUT'
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to resolve error log.');
      }
      setSelectedError(null);
      await loadOverview();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to mark error as resolved.');
    }
  };

  const handleClearResolved = async () => {
    try {
      const res = await apiFetch('/api/admin/diagnostics/errors/resolved', {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to clear resolved errors.');
      await loadOverview();
    } catch (err) {
      setErrorMsg(err.message || 'Unable to clear resolved logs.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-red-200 text-center text-sm text-red-800 font-semibold">
        Access Restricted: System Health & Diagnostics is strictly limited to System Administrators.
      </div>
    );
  }

  const getStatusBadge = (status) => {
    if (status === 'pass' || status === 'operational' || status === 'healthy' || status === 'configured') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase whitespace-nowrap shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    }
    if (status === 'warning' || status === 'not_configured' || status === 'not_integrated') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[11px] font-bold uppercase whitespace-nowrap shrink-0">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{status.replace(/_/g, ' ')}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-red-100 text-red-800 text-[11px] font-bold uppercase whitespace-nowrap shrink-0">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-emerald-950 text-white p-4 sm:p-6 rounded-2xl shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                <Activity className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-black tracking-tight">
                System Health & Live Diagnostics
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-2xl">
              Real-time infrastructure telemetry, isolated non-destructive verification suites, and sanitized runtime error monitoring.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleRunDiagnostics('full')}
              disabled={Boolean(runningScope)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md"
            >
              <Play className="w-3.5 h-3.5 shrink-0" />
              <span>{runningScope === 'full' ? 'Running Suite...' : 'Run Full Diagnostics'}</span>
            </button>
            <button
              type="button"
              onClick={loadOverview}
              disabled={loading}
              aria-label="Refresh diagnostics overview"
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-900 rounded-2xl flex items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={loadOverview}
            className="px-3 py-1 bg-red-600 text-white rounded-lg font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {actionMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center space-x-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionMsg}</span>
        </div>
      )}

      {loading && !overview ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
          Inspecting SQLite WAL integrity, security posture, and live runtime telemetry...
        </div>
      ) : overview ? (
        <>
          {/* Top Health KPI Row */}
          <div className="grid grid-cols-1 min-[375px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Backend Runtime</span>
                <Server className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl font-black text-slate-900 mt-1.5 tabular-nums">
                {formatDuration(overview.runtime.uptime_seconds)}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                {overview.runtime.node_version} • RSS {overview.runtime.memory_rss_mb} MB
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>SQLite Integrity</span>
                <Database className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="text-xl font-black text-slate-900 uppercase">
                  {overview.database.integrity}
                </span>
                <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded tabular-nums">
                  {overview.database.query_latency_ms} ms
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {overview.database.journal_mode.toUpperCase()} • FK {overview.database.foreign_keys_enabled ? 'ON' : 'OFF'}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Security Posture</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-xl font-black text-slate-900 mt-1.5">
                {overview.security_posture.jwt_secret_strong ? 'Hardened' : 'Dev Ephemeral'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Demo Mode: {overview.runtime.demo_mode ? 'Enabled' : 'Disabled'} • CORS: {overview.security_posture.cors_origins_count}
              </p>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm min-w-0">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Unresolved Errors</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <p className={`text-xl font-black mt-1.5 tabular-nums ${overview.counts.unresolvedErrors > 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {overview.counts.unresolvedErrors}
              </p>
              <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                {overview.counts.totalBatches} batches • {overview.counts.totalUsers} users
              </p>
            </div>
          </div>

          {/* Diagnostic Suite Runner & Results */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Safe Automated Verification Runner
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Runs isolated in-memory CRUD, Q10 math, RBAC, and config checks without altering production data.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'database', label: 'Database' },
                    { id: 'auth_security', label: 'Auth & Security' },
                    { id: 'engines', label: 'AI & Engines' },
                    { id: 'integrations', label: 'Integrations' }
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={Boolean(runningScope)}
                      onClick={() => handleRunDiagnostics(s.id)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg text-[11px] font-semibold"
                    >
                      {runningScope === s.id ? 'Running...' : s.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeRun ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      {getStatusBadge(activeRun.status)}
                      <span className="font-mono font-bold text-slate-800">{activeRun.run_id}</span>
                      <span className="text-slate-500">Scope: {activeRun.scope}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-600 tabular-nums">
                      <span>Passed: <strong>{activeRun.passed_checks}/{activeRun.total_checks}</strong></span>
                      <span>Warnings: <strong>{activeRun.warning_checks}</strong></span>
                      <span>Failed: <strong>{activeRun.failed_checks}</strong></span>
                      <span>{activeRun.duration_ms} ms</span>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {activeRun.results.map((chk) => (
                      <div key={chk.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-white">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            {getStatusBadge(chk.status)}
                            <span className="font-bold text-slate-900">{chk.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-600 break-words">{chk.detail}</p>
                        </div>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0 tabular-nums">
                          {chk.duration_ms} ms
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                  No diagnostic run executed yet. Click <strong>Run Full Diagnostics</strong> to verify all modules.
                </div>
              )}
            </div>

            {/* External Integration Matrix & Run History */}
            <div className="lg:col-span-4 space-y-6 min-w-0">
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
                  Integration Readiness
                </h3>
                <div className="space-y-2.5">
                  {overview.integrations.map((intg) => (
                    <div key={intg.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-900 leading-snug">{intg.name}</span>
                        {getStatusBadge(intg.status)}
                      </div>
                      <p className="text-[11px] text-slate-500">{intg.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2 flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span>Recent Diagnostic Runs</span>
                </h3>
                {overview.diagnostic_runs.length === 0 ? (
                  <p className="text-xs text-slate-400">No historical runs recorded yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {overview.diagnostic_runs.map((run) => (
                      <button
                        key={run.run_id}
                        type="button"
                        onClick={() => setActiveRun(run)}
                        className={`w-full text-left p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-colors ${
                          activeRun?.run_id === run.run_id
                            ? 'bg-emerald-50 border-emerald-300'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-slate-800 truncate">{run.run_id}</p>
                          <p className="text-[10px] text-slate-500">
                            {run.scope} • {new Date(run.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                        {getStatusBadge(run.status)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Live Error Monitoring Feed */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Live Sanitized Error Monitoring
                </h3>
                <p className="text-[11px] text-slate-500">
                  Captures backend exceptions, API 4xx/5xx faults, and UI error boundaries with secrets redacted. Click any row for root cause & fix.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowResolved((prev) => !prev)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                >
                  {showResolved ? 'Hide Resolved' : 'Show Resolved'}
                </button>
                <button
                  type="button"
                  onClick={handleClearResolved}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Resolved</span>
                </button>
              </div>
            </div>

            {overview.error_logs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                No {showResolved ? '' : 'unresolved '}runtime errors recorded.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                {overview.error_logs.map((errItem) => (
                  <button
                    key={errItem.id}
                    type="button"
                    onClick={() => setSelectedError(errItem)}
                    className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusBadge(errItem.severity)}
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                          {errItem.source} • {errItem.module}
                        </span>
                        {errItem.status_code && (
                          <span className="font-mono text-[11px] font-bold text-slate-600">
                            HTTP {errItem.status_code}
                          </span>
                        )}
                        {errItem.resolved && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                            Resolved
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-slate-900 truncate">{errItem.message}</p>
                      <p className="text-[11px] text-slate-500 font-mono truncate">
                        {errItem.method} {errItem.endpoint || '—'}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                      {new Date(errItem.timestamp).toLocaleString()}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Clickable Error Detail Modal */}
      {selectedError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="error-detail-title"
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedError.severity)}
                  <span className="text-xs font-mono text-slate-500">#{selectedError.id}</span>
                </div>
                <h3 id="error-detail-title" className="text-base font-bold text-slate-900 mt-1.5">
                  Error Diagnostic Detail
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close error details"
                onClick={() => setSelectedError(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Module / Source</span>
                  <span className="font-bold text-slate-800">
                    {selectedError.module} ({selectedError.source})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Endpoint & Status</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedError.method} {selectedError.endpoint || 'N/A'} ({selectedError.status_code || '—'})
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Sanitized Message</span>
                <p className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-900 font-medium break-words">
                  {selectedError.message}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Likely Root Cause</span>
                <p className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  {selectedError.root_cause || 'Diagnostic analysis unavailable.'}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Recommended Fix</span>
                <p className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
                  {selectedError.recommended_fix || 'Review module validation and retry.'}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedError(null)}
                className="px-3.5 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700"
              >
                Close
              </button>
              {!selectedError.resolved && (
                <button
                  type="button"
                  onClick={() => handleResolveError(selectedError.id)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark Resolved</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
