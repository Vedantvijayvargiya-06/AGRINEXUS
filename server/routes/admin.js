import { Router } from 'express';
import {
  listCropConstants,
  getCropConstant,
  upsertCropConstant,
  getUserById,
  updateUserApproval,
  getSystemCounts,
  getDatabaseStatus,
  listErrorLogs,
  resolveErrorLog,
  clearResolvedErrorLogs,
  insertErrorLog,
  insertDiagnosticRun,
  listDiagnosticRuns
} from '../store.js';
import {
  getDiagnosticsOverview,
  runDiagnosticSuite,
  classifyAndSanitizeError
} from '../services/diagnosticsService.js';
import { requireAuth, requireRole, checkRateLimit, HttpError } from '../security.js';

const router = Router();

router.get('/crop-constants', requireAuth, (req, res) => {
  const results = listCropConstants().map((c) => ({
    crop: c.crop,
    name_hi: c.name_hi,
    base_shelf_life_hours: c.base_shelf_life_hours,
    base_shelf_life_days: Math.round((c.base_shelf_life_hours / 24.0) * 10) / 10,
    base_fresh_price_per_kg: c.base_fresh_price_per_kg,
    processing_rate_per_kg: c.processing_rate_per_kg,
    processing_cost_per_kg: c.processing_cost_per_kg,
    cold_storage_rate_per_day_kg: c.cold_storage_rate_per_day_kg,
    q10_factor: c.q10_factor,
    optimal_temp_c: c.optimal_temp_c
  }));
  res.json(results);
});

router.post('/crop-constants', requireRole('admin'), (req, res, next) => {
  try {
    const payload = req.body || {};
    const cropName = String(payload.crop || '').trim();
    if (!cropName || cropName.length > 60) {
      throw new HttpError(400, 'Valid crop name is required');
    }

    const existing = getCropConstant(cropName);
    const shelfLife = Number(payload.base_shelf_life_hours);
    const freshPrice = Number(
      payload.base_fresh_price_per_kg ?? existing?.base_fresh_price_per_kg ?? 25
    );
    const procRate = Number(payload.processing_rate_per_kg);
    const procCost = Number(payload.processing_cost_per_kg ?? existing?.processing_cost_per_kg ?? 3.5);
    const coldRate = Number(payload.cold_storage_rate_per_day_kg);
    const q10 = Number(payload.q10_factor);

    if (!Number.isFinite(shelfLife) || shelfLife <= 0 || shelfLife > 10000) {
      throw new HttpError(400, 'Base shelf-life hours must be between 1 and 10,000');
    }
    if (!Number.isFinite(freshPrice) || freshPrice < 0 || !Number.isFinite(procRate) || procRate < 0) {
      throw new HttpError(400, 'Crop prices and processing yield must be non-negative');
    }
    if (!Number.isFinite(procCost) || procCost < 0 || !Number.isFinite(coldRate) || coldRate < 0) {
      throw new HttpError(400, 'Processing and cold storage rates must be non-negative');
    }
    if (!Number.isFinite(q10) || q10 < 1.0 || q10 > 5.0) {
      throw new HttpError(400, 'Q10 factor must be between 1.0 and 5.0');
    }

    upsertCropConstant({
      crop: cropName,
      name_hi: existing?.name_hi || String(payload.name_hi || cropName).trim(),
      base_shelf_life_hours: shelfLife,
      base_fresh_price_per_kg: freshPrice,
      processing_rate_per_kg: procRate,
      processing_cost_per_kg: procCost,
      cold_storage_rate_per_day_kg: coldRate,
      transport_base_per_kg_km: existing?.transport_base_per_kg_km ?? 0.035,
      q10_factor: q10,
      optimal_temp_c: existing?.optimal_temp_c ?? 12.0
    });

    res.json({ message: `Crop constants for ${cropName} updated successfully.` });
  } catch (err) {
    next(err);
  }
});

router.post('/approve-user', requireRole('admin'), (req, res, next) => {
  try {
    const { user_id, is_approved } = req.body || {};
    const uid = Number(user_id);
    if (!Number.isInteger(uid) || uid <= 0) {
      throw new HttpError(400, 'Invalid user_id');
    }
    const user = getUserById(uid);
    if (!user) throw new HttpError(404, 'User not found');

    if (user.id === req.currentUser.id && !is_approved) {
      throw new HttpError(400, 'Administrators cannot revoke their own approval');
    }

    const nextApproved = Boolean(is_approved);
    updateUserApproval(uid, nextApproved);
    res.json({
      message: `User ${user.name} approval status updated to ${nextApproved}.`
    });
  } catch (err) {
    next(err);
  }
});

router.get('/system-health', requireRole('admin', 'fpo_admin'), (req, res) => {
  const counts = getSystemCounts();
  const dbStatus = getDatabaseStatus();

  res.json({
    status: dbStatus.connected && dbStatus.integrity === 'ok' ? 'healthy' : 'degraded',
    uptime_seconds: Math.floor(process.uptime()),
    db_latency_ms: dbStatus.query_latency_ms,
    database: dbStatus.engine,
    database_integrity: dbStatus.integrity,
    prediction_engine: 'Q10 Decay + Linear Optimization (Operational)',
    rag_assistant: 'Active & Grounded',
    total_registered_users: counts.totalUsers,
    total_batches: counts.totalBatches,
    total_active_batches: counts.activeBatches,
    active_clusters: counts.totalClusters,
    unresolved_errors: counts.unresolvedErrors,
    timestamp: new Date().toISOString()
  });
});

// --- System Admin Health & Diagnostics Routes (strictly restricted to admin) ---
router.get('/diagnostics/overview', requireRole('admin'), (req, res) => {
  const includeResolved = req.query.include_resolved !== 'false';
  const errorLogs = listErrorLogs({ limit: 50, includeResolved });
  const diagnosticRuns = listDiagnosticRuns(15);
  res.json(getDiagnosticsOverview({ errorLogs, diagnosticRuns }));
});

router.post('/diagnostics/run', requireRole('admin'), (req, res, next) => {
  try {
    const scope = String(req.body?.scope || 'full').trim();
    const runResult = runDiagnosticSuite(scope);
    const saved = insertDiagnosticRun({
      ...runResult,
      triggered_by_user_id: req.currentUser.id
    });
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

router.put('/diagnostics/errors/:id/resolve', requireRole('admin'), (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'Invalid error log ID');
    }
    const updated = resolveErrorLog(id);
    if (!updated) {
      throw new HttpError(404, 'Error log entry not found');
    }
    res.json({ status: 'resolved', id });
  } catch (err) {
    next(err);
  }
});

router.delete('/diagnostics/errors/resolved', requireRole('admin'), (req, res) => {
  const removed = clearResolvedErrorLogs();
  res.json({ status: 'cleared', removed_count: removed });
});

// Authenticated frontend error reporter (captures real unexpected UI / API failures safely)
router.post('/diagnostics/client-error', requireAuth, (req, res, next) => {
  try {
    checkRateLimit(`client_err:${req.currentUser.id}`, 20, 60);
    const body = req.body || {};
    const message = String(body.message || '').trim();
    if (!message) {
      throw new HttpError(400, 'Error message is required');
    }
    const sanitized = classifyAndSanitizeError({
      err: { message },
      req: { method: body.method || 'UI', originalUrl: body.endpoint || '/frontend' },
      statusCode: Number(body.status_code) || 500,
      source: 'frontend',
      module: String(body.module || 'react-ui')
    });
    const entry = insertErrorLog(sanitized);
    res.status(201).json({ recorded: true, id: entry.id });
  } catch (err) {
    next(err);
  }
});

export default router;
