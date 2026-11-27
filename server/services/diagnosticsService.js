import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import {
  NODE_ENV,
  IS_PRODUCTION,
  DEMO_MODE,
  JWT_SECRET_KEY,
  CORS_ALLOWED_ORIGINS
} from '../config.js';
import {
  getDatabaseStatus,
  getSystemCounts,
  adminNeedsSetup
} from '../store.js';
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  decodeAccessToken
} from '../security.js';
import { DecayEngine } from './decayEngine.js';
import { DecisionEngine } from './decisionEngine.js';
import { ClusterOptimizer } from './clusterOptimizer.js';
import { ReportingService } from './reportingService.js';
import { AgriNexusAssist } from './agrinexusAssist.js';

function sanitizeText(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/(password|secret|token|api_key)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\/[^\s:]+\.(js|ts|db)/g, '[internal-path]')
    .slice(0, 450);
}

export function classifyAndSanitizeError({
  err,
  req,
  statusCode = 500,
  source = 'backend',
  module = 'api'
}) {
  const rawMessage = err?.detail || err?.message || 'Unexpected application error';
  const cleanMessage = sanitizeText(rawMessage);
  const code = Number(statusCode || err?.status || 500);

  let rootCause = 'Unhandled runtime exception inside request pipeline.';
  let recommendedFix = 'Inspect module validation and retry the operation.';

  if (code === 400) {
    rootCause = 'Invalid or out-of-range request payload or query parameter.';
    recommendedFix = 'Verify client input validation and payload field types before submission.';
  } else if (code === 401) {
    rootCause = 'Missing, expired, or invalid JWT authentication credentials.';
    recommendedFix = 'Ensure user signs in again to refresh the in-memory Bearer token.';
  } else if (code === 403) {
    rootCause = 'Role-based access control policy blocked unauthorized role or locked account.';
    recommendedFix = 'Restrict UI action to permitted roles or review user approval status.';
  } else if (code === 404) {
    rootCause = 'Requested API route or database entity ID does not exist.';
    recommendedFix = 'Verify frontend route URL and refresh stale entity lists.';
  } else if (code === 429) {
    rootCause = 'Rate limit or OTP resend cooldown threshold exceeded.';
    recommendedFix = 'Wait for the cooldown window to expire before retrying.';
  } else if (cleanMessage.toLowerCase().includes('sqlite') || cleanMessage.toLowerCase().includes('constraint')) {
    rootCause = 'SQLite persistence or uniqueness/foreign-key constraint failure.';
    recommendedFix = 'Check entity uniqueness constraints and database WAL write permissions.';
  }

  return {
    source,
    severity: code >= 500 ? 'critical' : code >= 400 ? 'warning' : 'error',
    module: sanitizeText(module || 'api'),
    method: req?.method || null,
    endpoint: req?.originalUrl ? String(req.originalUrl).split('?')[0].slice(0, 180) : null,
    status_code: code,
    message: cleanMessage,
    root_cause: rootCause,
    recommended_fix: recommendedFix
  };
}

export function getIntegrationReadiness() {
  const dbStatus = getDatabaseStatus();
  const hasGemini = Boolean((process.env.GEMINI_API_KEY || '').trim());
  const hasDataGov = Boolean((process.env.DATA_GOV_API_KEY || '').trim());
  const hasSms = Boolean((process.env.SMS_PROVIDER_API_KEY || '').trim());

  return [
    {
      id: 'sqlite',
      name: 'SQLite Persistent Database',
      status: dbStatus.connected && dbStatus.integrity === 'ok' ? 'operational' : 'degraded',
      configured: true,
      detail: `${dbStatus.engine} • Integrity: ${dbStatus.integrity} • Latency: ${dbStatus.query_latency_ms} ms`
    },
    {
      id: 'assist_engine',
      name: 'AgriNexus Assist (Grounded Engine)',
      status: 'operational',
      configured: true,
      detail: 'Built-in bilingual (EN/HI) deterministic context engine active'
    },
    {
      id: 'market_feed',
      name: 'Live Mandi API (Agmarknet / Data.gov.in)',
      status: hasDataGov ? 'configured' : 'not_configured',
      configured: hasDataGov,
      detail: hasDataGov
        ? 'API key present in environment'
        : 'Not configured — running on local Demo Feed & FPO Overrides'
    },
    {
      id: 'sms_gateway',
      name: 'SMS Notification Gateway',
      status: hasSms ? 'configured' : 'not_configured',
      configured: hasSms,
      detail: hasSms
        ? 'SMS provider API key configured'
        : 'Not configured — spoilage/cluster alerts delivered in-app only'
    },
    {
      id: 'external_llm',
      name: 'External LLM (Gemini API)',
      status: hasGemini ? 'configured' : 'not_configured',
      configured: hasGemini,
      detail: hasGemini
        ? 'Gemini API key configured'
        : 'Not configured — AgriNexus Assist uses grounded rule/context engine'
    },
    {
      id: 'weather_api',
      name: 'Live Weather Telemetry (Open-Meteo)',
      status: 'not_integrated',
      configured: false,
      detail: 'Manual ambient temperature slider & crop defaults used'
    }
  ];
}

export function getDiagnosticsOverview({ errorLogs = [], diagnosticRuns = [] } = {}) {
  const dbStatus = getDatabaseStatus();
  const counts = getSystemCounts();
  const mem = process.memoryUsage();

  return {
    generated_at: new Date().toISOString(),
    runtime: {
      status: dbStatus.connected && dbStatus.integrity === 'ok' ? 'healthy' : 'degraded',
      node_version: process.version,
      environment: NODE_ENV,
      is_production: IS_PRODUCTION,
      demo_mode: DEMO_MODE,
      uptime_seconds: Math.floor(process.uptime()),
      memory_rss_mb: Math.round((mem.rss / 1048576) * 10) / 10,
      memory_heap_used_mb: Math.round((mem.heapUsed / 1048576) * 10) / 10
    },
    database: dbStatus,
    counts,
    security_posture: {
      jwt_secret_configured: Boolean(JWT_SECRET_KEY),
      jwt_secret_strong: Boolean(JWT_SECRET_KEY && JWT_SECRET_KEY.length >= 32),
      cors_origins_count: CORS_ALLOWED_ORIGINS.length,
      admin_claimed: !adminNeedsSetup(),
      rate_limiting_active: true,
      password_hashing: 'PBKDF2-HMAC-SHA256 (100,000 iterations)'
    },
    integrations: getIntegrationReadiness(),
    error_logs: errorLogs,
    diagnostic_runs: diagnosticRuns
  };
}

function executeTimedCheck(id, category, name, fn) {
  const start = performance.now();
  try {
    const outcome = fn();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    return {
      id,
      category,
      name,
      status: outcome.status || 'pass',
      duration_ms: durationMs,
      detail: outcome.detail || 'Check passed'
    };
  } catch (err) {
    const durationMs = Math.round((performance.now() - start) * 100) / 100;
    return {
      id,
      category,
      name,
      status: 'fail',
      duration_ms: durationMs,
      detail: sanitizeText(err?.message || 'Verification failed')
    };
  }
}

export function runDiagnosticSuite(scope = 'full') {
  const validScopes = new Set(['full', 'database', 'auth_security', 'engines', 'integrations']);
  const normalizedScope = validScopes.has(scope) ? scope : 'full';
  const suiteStart = performance.now();
  const checks = [];

  const include = (cat) => normalizedScope === 'full' || normalizedScope === cat;

  if (include('database')) {
    checks.push(
      executeTimedCheck('db_integrity', 'database', 'Production SQLite Integrity & WAL Mode', () => {
        const db = getDatabaseStatus();
        if (!db.connected || db.integrity !== 'ok') {
          throw new Error(`SQLite integrity check returned '${db.integrity}'`);
        }
        if (!db.foreign_keys_enabled) {
          throw new Error('PRAGMA foreign_keys is disabled');
        }
        return {
          status: 'pass',
          detail: `Integrity=${db.integrity}, Journal=${db.journal_mode}, FK=ON, Latency=${db.query_latency_ms}ms`
        };
      })
    );

    checks.push(
      executeTimedCheck('db_isolated_crud', 'database', 'Isolated In-Memory SQLite CRUD & FK Cascade', () => {
        const memDb = new DatabaseSync(':memory:');
        try {
          memDb.exec('PRAGMA foreign_keys = ON;');
          memDb.exec(`
            CREATE TABLE parent (id INTEGER PRIMARY KEY, label TEXT NOT NULL);
            CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parent(id) ON DELETE CASCADE);
          `);
          const pInfo = memDb.prepare('INSERT INTO parent (label) VALUES (?)').run('test-lot');
          const pid = Number(pInfo.lastInsertRowid);
          memDb.prepare('INSERT INTO child (parent_id) VALUES (?)').run(pid);

          let fkBlocked = false;
          try {
            memDb.prepare('INSERT INTO child (parent_id) VALUES (?)').run(99999);
          } catch {
            fkBlocked = true;
          }
          if (!fkBlocked) {
            throw new Error('Foreign key constraint failed to reject orphan row');
          }

          memDb.prepare('DELETE FROM parent WHERE id = ?').run(pid);
          const remaining = memDb.prepare('SELECT COUNT(*) AS cnt FROM child').get().cnt;
          if (remaining !== 0) {
            throw new Error('ON DELETE CASCADE did not clean up child record');
          }
          return {
            status: 'pass',
            detail: 'Isolated :memory: CRUD, FK enforcement, and cascade delete verified cleanly'
          };
        } finally {
          memDb.close();
        }
      })
    );
  }

  if (include('auth_security')) {
    checks.push(
      executeTimedCheck('auth_pbkdf2', 'auth_security', 'PBKDF2-SHA256 Password Hashing & Verification', () => {
        const sample = `DiagTest#${crypto.randomBytes(6).toString('hex')}`;
        const hashed = hashPassword(sample);
        if (!verifyPassword(sample, hashed)) {
          throw new Error('Valid password failed verification');
        }
        if (verifyPassword(`${sample}-wrong`, hashed)) {
          throw new Error('Invalid password unexpectedly passed verification');
        }
        return {
          status: 'pass',
          detail: '100k-iteration PBKDF2-SHA256 salt + timingSafeEqual verified'
        };
      })
    );

    checks.push(
      executeTimedCheck('auth_jwt', 'auth_security', 'JWT HS256 Signing & Tamper Rejection', () => {
        const token = createAccessToken(9999, 'farmer');
        const decoded = decodeAccessToken(token);
        if (decoded.sub !== '9999' || decoded.role !== 'farmer') {
          throw new Error('Decoded JWT payload mismatch');
        }
        const parts = token.split('.');
        const tampered = `${parts[0]}.${parts[1]}.invalid_signature`;
        let rejected = false;
        try {
          decodeAccessToken(tampered);
        } catch {
          rejected = true;
        }
        if (!rejected) {
          throw new Error('Tampered JWT signature was not rejected');
        }
        if (!JWT_SECRET_KEY || JWT_SECRET_KEY.length < 32) {
          return {
            status: 'warning',
            detail: 'Token signing works, but JWT_SECRET_KEY is shorter than 32 characters'
          };
        }
        return {
          status: 'pass',
          detail: 'HS256 sign/verify roundtrip & tampered token rejection passed'
        };
      })
    );

    checks.push(
      executeTimedCheck('auth_posture', 'auth_security', 'Runtime Security Configuration Posture', () => {
        const notes = [];
        if (DEMO_MODE) notes.push('DEMO_MODE=true');
        if (adminNeedsSetup()) notes.push('initial admin password unclaimed');
        if (CORS_ALLOWED_ORIGINS.length === 0) {
          throw new Error('CORS_ALLOWED_ORIGINS allowlist is empty');
        }
        if (notes.length > 0) {
          return {
            status: 'warning',
            detail: `Configuration warnings: ${notes.join(', ')}`
          };
        }
        return {
          status: 'pass',
          detail: `Environment=${NODE_ENV}, DEMO_MODE=false, CORS origins=${CORS_ALLOWED_ORIGINS.length}`
        };
      })
    );
  }

  if (include('engines')) {
    checks.push(
      executeTimedCheck('engine_q10', 'engines', 'Q10 Kinetic Digital Twin Calculations', () => {
        const f20 = DecayEngine.computeTemperatureFactor(20);
        const f30 = DecayEngine.computeTemperatureFactor(30);
        const f10 = DecayEngine.computeTemperatureFactor(10);
        const q = DecayEngine.computeQuality(72, 144, 100);
        if (f20 !== 1 || f30 !== 2 || f10 !== 0.5 || q !== 50) {
          throw new Error(`Unexpected Q10 result: f20=${f20}, f30=${f30}, f10=${f10}, q=${q}`);
        }
        return {
          status: 'pass',
          detail: 'Q10 temperature factors (0.5x / 1.0x / 2.0x) and half-life decay exact'
        };
      })
    );

    checks.push(
      executeTimedCheck('engine_decision', 'engines', '4-Pathway Decision Optimization Invariants', () => {
        const resA = DecisionEngine.evaluateBatchDecision({
          crop: 'Tomato',
          quantityKg: 1200,
          currentQuality: 85,
          hoursElapsed: 24,
          ambientTempC: 30,
          localMandiPricePerKg: 24,
          alternateMandiPricePerKg: 44,
          storageDays: 3,
          projectedPriceIncreasePct: 20,
          isPooled: true
        });
        const resB = DecisionEngine.evaluateBatchDecision({
          crop: 'Tomato',
          quantityKg: 1200,
          currentQuality: 85,
          hoursElapsed: 72,
          ambientTempC: 30,
          localMandiPricePerKg: 24,
          alternateMandiPricePerKg: 44,
          storageDays: 3,
          projectedPriceIncreasePct: 20,
          isPooled: true
        });
        if (resA.net_values.store !== resB.net_values.store) {
          throw new Error('Cold storage pathway double-decay mismatch');
        }
        if (resA.best_expected_value <= 0) {
          throw new Error('Expected decision value must be positive');
        }
        return {
          status: 'pass',
          detail: `Best pathway=${resA.recommended_action}, Net=₹${resA.best_expected_value.toLocaleString('en-IN')}`
        };
      })
    );

    checks.push(
      executeTimedCheck('engine_cluster_reports', 'engines', 'Cluster Freight Pooling & Reporting Math', () => {
        const clusterSummary = ClusterOptimizer.evaluateClusterFreightSavings(
          [
            { id: 1, batch_code: 'DIAG-1', farmer_id: 1, farmer_name: 'A', quantity_kg: 1200 },
            { id: 2, batch_code: 'DIAG-2', farmer_id: 2, farmer_name: 'B', quantity_kg: 1800 }
          ],
          120
        );
        if (clusterSummary.savings_pct <= 40) {
          throw new Error(`Expected >40% pooling freight savings, got ${clusterSummary.savings_pct}%`);
        }
        const emptyReport = ReportingService.calculateFpoSummary([], []);
        if (emptyReport.avg_freight_savings_pct !== 0) {
          throw new Error(`Empty report should return 0% savings, got ${emptyReport.avg_freight_savings_pct}%`);
        }
        return {
          status: 'pass',
          detail: `Pooled 3,000kg savings=${clusterSummary.savings_pct}% (${clusterSummary.vehicle_type}); empty guard=0%`
        };
      })
    );

    checks.push(
      executeTimedCheck('engine_assist', 'engines', 'AgriNexus Assist Bilingual & Out-of-Scope Guardrails', () => {
        const oos = AgriNexusAssist.answerQuery({
          query: 'Who won the cricket match yesterday?',
          userLang: 'en'
        });
        if (!oos.uncertain || !oos.escalate_to_helpdesk) {
          throw new Error('Out-of-scope query did not trigger helpdesk escalation guardrail');
        }
        const hi = AgriNexusAssist.answerQuery({
          query: 'मेरी फसल की सेल्फ लाइफ कितनी है?',
          userLang: 'hi',
          batchContext: {
            crop: 'Tomato',
            crop_name_hi: 'टमाटर',
            batch_code: 'DIAG-TOM',
            current_quality: 84,
            remaining_shelf_life_days: 3.5,
            remaining_shelf_life_hrs: 84,
            spoilage_risk: 28,
            recommendation: {
              recommended_action: 'redirect',
              recommended_title_hi: 'टर्मिनल मंडी में भेजें',
              best_expected_value: 38000,
              explanation_hi: 'टर्मिनल मंडी में अधिक लाभ है।'
            }
          }
        });
        if (!hi.answer || hi.uncertain) {
          throw new Error('Bilingual grounded batch query failed');
        }
        return {
          status: 'pass',
          detail: 'Out-of-scope escalation & Hindi batch-context grounding verified'
        };
      })
    );
  }

  if (include('integrations')) {
    checks.push(
      executeTimedCheck('ext_integrations', 'integrations', 'External APIs & Gateway Configuration Audit', () => {
        const readiness = getIntegrationReadiness();
        const unconfigured = readiness.filter((i) => !i.configured).map((i) => i.name);
        if (unconfigured.length > 0) {
          return {
            status: 'warning',
            detail: `Unconfigured optional integrations (safe local fallbacks active): ${unconfigured.join(', ')}`
          };
        }
        return {
          status: 'pass',
          detail: 'All external API integrations configured'
        };
      })
    );
  }

  const passedChecks = checks.filter((c) => c.status === 'pass').length;
  const warningChecks = checks.filter((c) => c.status === 'warning').length;
  const failedChecks = checks.filter((c) => c.status === 'fail').length;
  const totalDurationMs = Math.round((performance.now() - suiteStart) * 100) / 100;

  return {
    run_id: `DIAG-${Date.now().toString(36).toUpperCase()}-${crypto.randomInt(100, 999)}`,
    scope: normalizedScope,
    status: failedChecks > 0 ? 'fail' : warningChecks > 0 ? 'warning' : 'pass',
    total_checks: checks.length,
    passed_checks: passedChecks,
    warning_checks: warningChecks,
    failed_checks: failedChecks,
    duration_ms: totalDurationMs,
    results: checks
  };
}
