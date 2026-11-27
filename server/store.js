import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { ADMIN_BOOTSTRAP_PASSWORD, DATABASE_PATH } from './config.js';
import { DEFAULT_CROP_PROFILES, DecayEngine } from './services/decayEngine.js';
import { DecisionEngine } from './services/decisionEngine.js';
import { ClusterOptimizer } from './services/clusterOptimizer.js';
import { INITIAL_MANDI_FEED } from './services/marketService.js';

let sqliteDb = null;
let activeDbPath = DATABASE_PATH;

function hashPasswordRaw(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return `pbkdf2:sha256:100000$${salt}$${key.toString('hex')}`;
}

function getDb() {
  if (!sqliteDb) {
    initStore();
  }
  return sqliteDb;
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    password_hash: row.password_hash,
    role: row.role,
    fpo_id: row.fpo_id,
    locality: row.locality,
    language_preference: row.language_preference,
    is_approved: Boolean(row.is_approved),
    failed_attempts: row.failed_attempts || 0,
    locked_until: row.locked_until ? new Date(row.locked_until) : null,
    created_at: new Date(row.created_at)
  };
}

function mapBatch(row) {
  if (!row) return null;
  return {
    id: row.id,
    batch_code: row.batch_code,
    farmer_id: row.farmer_id,
    crop: row.crop,
    variety: row.variety,
    quantity_kg: row.quantity_kg,
    harvest_time: new Date(row.harvest_time),
    location: row.location,
    locality: row.locality,
    ambient_temp_c: row.ambient_temp_c,
    storage_type: row.storage_type,
    initial_quality: row.initial_quality,
    current_quality: row.current_quality,
    shelf_life_hrs: row.shelf_life_hrs,
    spoilage_risk: row.spoilage_risk,
    photo_url: row.photo_url,
    status: row.status,
    cluster_id: row.cluster_id,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at)
  };
}

function mapMarketPrice(row) {
  if (!row) return null;
  return {
    id: row.id,
    crop: row.crop,
    mandi: row.mandi,
    state: row.state,
    distance_km: row.distance_km,
    modal_price_per_kg: row.modal_price_per_kg,
    min_price_per_kg: row.min_price_per_kg,
    max_price_per_kg: row.max_price_per_kg,
    trend: row.trend,
    price_change_pct: row.price_change_pct,
    arrivals_tonnes: row.arrivals_tonnes,
    demand_index: row.demand_index,
    is_manual_override: Boolean(row.is_manual_override),
    source_type: row.source_type || 'demo_seed',
    fetched_at: new Date(row.fetched_at)
  };
}

function mapCluster(row) {
  if (!row) return null;
  return {
    id: row.id,
    cluster_code: row.cluster_code,
    crop: row.crop,
    locality: row.locality,
    destination_mandi: row.destination_mandi,
    total_quantity_kg: row.total_quantity_kg,
    individual_transport_cost_per_kg: row.individual_transport_cost_per_kg,
    pooled_transport_cost_per_kg: row.pooled_transport_cost_per_kg,
    cost_savings_pct: row.cost_savings_pct,
    vehicle_type: row.vehicle_type,
    capacity_utilization_pct: row.capacity_utilization_pct,
    status: row.status,
    confirmed_by_id: row.confirmed_by_id,
    dispatch_date: row.dispatch_date ? new Date(row.dispatch_date) : null,
    created_at: new Date(row.created_at)
  };
}

function mapRecommendation(row) {
  if (!row) return null;
  let breakdown = null;
  try {
    breakdown = JSON.parse(row.formula_breakdown_json);
  } catch {
    breakdown = null;
  }
  return {
    id: row.id,
    batch_id: row.batch_id,
    recommended_action: row.recommended_action,
    net_value_sell: row.net_value_sell,
    net_value_store: row.net_value_store,
    net_value_process: row.net_value_process,
    net_value_redirect: row.net_value_redirect,
    best_expected_value: row.best_expected_value,
    formula_breakdown: breakdown,
    explanation_en: row.explanation_en,
    explanation_hi: row.explanation_hi,
    confidence_score: row.confidence_score,
    generated_at: new Date(row.generated_at)
  };
}

function mapNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    batch_id: row.batch_id,
    title: row.title,
    title_hi: row.title_hi,
    message: row.message,
    message_hi: row.message_hi,
    type: row.type,
    severity: row.severity,
    is_read: Boolean(row.is_read),
    sent_sms: Boolean(row.sent_sms),
    created_at: new Date(row.created_at)
  };
}

function runInTransaction(conn, fn) {
  conn.exec('BEGIN');
  try {
    const result = fn();
    conn.exec('COMMIT');
    return result;
  } catch (err) {
    conn.exec('ROLLBACK');
    throw err;
  }
}

function createSchema(conn) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE,
      email TEXT UNIQUE COLLATE NOCASE,
      password_hash TEXT,
      role TEXT NOT NULL CHECK (role IN ('farmer', 'fpo_admin', 'buyer', 'admin')),
      fpo_id TEXT NOT NULL DEFAULT 'FPO-KOLAR-01',
      locality TEXT NOT NULL DEFAULT 'Kolar, Karnataka',
      language_preference TEXT NOT NULL DEFAULT 'en',
      is_approved INTEGER NOT NULL DEFAULT 1,
      failed_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS crop_constants (
      crop TEXT PRIMARY KEY,
      name_hi TEXT NOT NULL,
      base_shelf_life_hours REAL NOT NULL,
      base_fresh_price_per_kg REAL NOT NULL,
      processing_rate_per_kg REAL NOT NULL,
      processing_cost_per_kg REAL NOT NULL,
      cold_storage_rate_per_day_kg REAL NOT NULL,
      transport_base_per_kg_km REAL NOT NULL DEFAULT 0.035,
      q10_factor REAL NOT NULL,
      optimal_temp_c REAL NOT NULL DEFAULT 12.0
    );

    CREATE TABLE IF NOT EXISTS market_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crop TEXT NOT NULL,
      mandi TEXT NOT NULL,
      state TEXT NOT NULL,
      distance_km REAL NOT NULL,
      modal_price_per_kg REAL NOT NULL,
      min_price_per_kg REAL NOT NULL,
      max_price_per_kg REAL NOT NULL,
      trend TEXT NOT NULL,
      price_change_pct REAL NOT NULL,
      arrivals_tonnes REAL NOT NULL,
      demand_index TEXT NOT NULL,
      is_manual_override INTEGER NOT NULL DEFAULT 0,
      source_type TEXT NOT NULL DEFAULT 'demo_seed',
      fetched_at TEXT NOT NULL,
      UNIQUE (crop, mandi)
    );

    CREATE TABLE IF NOT EXISTS clusters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cluster_code TEXT NOT NULL UNIQUE,
      crop TEXT NOT NULL,
      locality TEXT NOT NULL,
      destination_mandi TEXT NOT NULL,
      total_quantity_kg REAL NOT NULL,
      individual_transport_cost_per_kg REAL NOT NULL,
      pooled_transport_cost_per_kg REAL NOT NULL,
      cost_savings_pct REAL NOT NULL,
      vehicle_type TEXT NOT NULL,
      capacity_utilization_pct REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'candidate',
      confirmed_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      dispatch_date TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_code TEXT NOT NULL UNIQUE,
      farmer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      crop TEXT NOT NULL,
      variety TEXT NOT NULL,
      quantity_kg REAL NOT NULL,
      harvest_time TEXT NOT NULL,
      location TEXT NOT NULL,
      locality TEXT NOT NULL,
      ambient_temp_c REAL NOT NULL,
      storage_type TEXT NOT NULL,
      initial_quality REAL NOT NULL,
      current_quality REAL NOT NULL,
      shelf_life_hrs REAL NOT NULL,
      spoilage_risk REAL NOT NULL,
      photo_url TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      cluster_id INTEGER REFERENCES clusters(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      recommended_action TEXT NOT NULL,
      net_value_sell REAL NOT NULL,
      net_value_store REAL NOT NULL,
      net_value_process REAL NOT NULL,
      net_value_redirect REAL NOT NULL,
      best_expected_value REAL NOT NULL,
      formula_breakdown_json TEXT NOT NULL,
      explanation_en TEXT NOT NULL,
      explanation_hi TEXT NOT NULL,
      confidence_score REAL NOT NULL,
      generated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      actual_action TEXT NOT NULL,
      predicted_action TEXT NOT NULL,
      actual_value_realised REAL NOT NULL,
      predicted_value REAL NOT NULL,
      error_pct REAL NOT NULL,
      feedback_notes TEXT,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      title_hi TEXT,
      message TEXT NOT NULL,
      message_hi TEXT,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      sent_sms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_records (
      phone TEXT PRIMARY KEY,
      otp_hash TEXT NOT NULL,
      created_at REAL NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      used INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS escalations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
      issue_topic TEXT NOT NULL,
      query_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'backend',
      severity TEXT NOT NULL DEFAULT 'error',
      module TEXT NOT NULL,
      method TEXT,
      endpoint TEXT,
      status_code INTEGER,
      message TEXT NOT NULL,
      root_cause TEXT,
      recommended_fix TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS diagnostic_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL UNIQUE,
      triggered_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      scope TEXT NOT NULL,
      status TEXT NOT NULL,
      total_checks INTEGER NOT NULL,
      passed_checks INTEGER NOT NULL,
      warning_checks INTEGER NOT NULL,
      failed_checks INTEGER NOT NULL,
      duration_ms REAL NOT NULL,
      results_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_batches_farmer ON batches(farmer_id);
    CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
    CREATE INDEX IF NOT EXISTS idx_recommendations_batch ON recommendations(batch_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved, timestamp DESC);
  `);
}

function seedInitialData(conn) {
  const countRow = conn.prepare('SELECT COUNT(*) AS cnt FROM users').get();
  if (countRow && countRow.cnt > 0) {
    // Sync optional bootstrap admin password if configured via env
    if (ADMIN_BOOTSTRAP_PASSWORD && ADMIN_BOOTSTRAP_PASSWORD.length >= 8) {
      conn
        .prepare('UPDATE users SET password_hash = ? WHERE role = ?')
        .run(hashPasswordRaw(ADMIN_BOOTSTRAP_PASSWORD), 'admin');
    }
    return;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  runInTransaction(conn, () => {
    const insertCrop = conn.prepare(`
      INSERT OR IGNORE INTO crop_constants (
        crop, name_hi, base_shelf_life_hours, base_fresh_price_per_kg,
        processing_rate_per_kg, processing_cost_per_kg, cold_storage_rate_per_day_kg,
        transport_base_per_kg_km, q10_factor, optimal_temp_c
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const [cropName, data] of Object.entries(DEFAULT_CROP_PROFILES)) {
      insertCrop.run(
        cropName,
        data.name_hi || cropName,
        data.base_shelf_life_hours,
        data.base_fresh_price_per_kg,
        data.processing_rate_per_kg,
        data.processing_cost_per_kg,
        data.cold_storage_rate_per_day_kg,
        data.transport_base_per_kg_km ?? 0.035,
        data.q10_factor,
        data.optimal_temp_c ?? 12.0
      );
    }

    const adminPasswordHash =
      ADMIN_BOOTSTRAP_PASSWORD && ADMIN_BOOTSTRAP_PASSWORD.length >= 8
        ? hashPasswordRaw(ADMIN_BOOTSTRAP_PASSWORD)
        : null;

    const seedUsers = [
      {
        name: 'Ramesh Kumar',
        phone: '9876543210',
        email: 'ramesh.farmer@agrinexus.org',
        password_hash: null,
        role: 'farmer',
        fpo_id: 'FPO-KOLAR-01',
        locality: 'Kolar, Karnataka',
        language_preference: 'hi'
      },
      {
        name: 'Suresh Patel',
        phone: '9876543211',
        email: 'suresh.farmer@agrinexus.org',
        password_hash: null,
        role: 'farmer',
        fpo_id: 'FPO-KOLAR-01',
        locality: 'Malur, Kolar',
        language_preference: 'en'
      },
      {
        name: 'Anita Devi',
        phone: '9876543212',
        email: 'anita.farmer@agrinexus.org',
        password_hash: null,
        role: 'farmer',
        fpo_id: 'FPO-KOLAR-01',
        locality: 'Bangarapet, Kolar',
        language_preference: 'hi'
      },
      {
        name: 'Rajesh Sharma (FPO Admin)',
        phone: '9876543299',
        email: 'admin@kisankalyan.org',
        password_hash: null,
        role: 'fpo_admin',
        fpo_id: 'FPO-KOLAR-01',
        locality: 'Kolar Regional Office',
        language_preference: 'en'
      },
      {
        name: 'AgroFresh Foods Procurement',
        phone: '9876543300',
        email: 'procurement@agrofresh.in',
        password_hash: null,
        role: 'buyer',
        fpo_id: 'BUYER-CORP-99',
        locality: 'Bengaluru Terminal Hub',
        language_preference: 'en'
      },
      {
        name: 'System Administrator',
        phone: '9876543399',
        email: 'superadmin@agrinexus.gov.in',
        password_hash: adminPasswordHash,
        role: 'admin',
        fpo_id: 'HQ-01',
        locality: 'National Operations',
        language_preference: 'en'
      }
    ];

    const insertUser = conn.prepare(`
      INSERT INTO users (
        name, phone, email, password_hash, role, fpo_id, locality,
        language_preference, is_approved, failed_attempts, locked_until, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NULL, ?)
    `);

    const insertedUsers = [];
    for (const u of seedUsers) {
      const info = insertUser.run(
        u.name,
        u.phone,
        u.email,
        u.password_hash,
        u.role,
        u.fpo_id,
        u.locality,
        u.language_preference,
        nowIso
      );
      insertedUsers.push({ id: Number(info.lastInsertRowid), ...u });
    }

    const [farmer1, farmer2, farmer3] = insertedUsers;

    const insertMarket = conn.prepare(`
      INSERT OR IGNORE INTO market_prices (
        crop, mandi, state, distance_km, modal_price_per_kg, min_price_per_kg,
        max_price_per_kg, trend, price_change_pct, arrivals_tonnes, demand_index,
        is_manual_override, source_type, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    for (const mp of INITIAL_MANDI_FEED) {
      insertMarket.run(
        mp.crop,
        mp.mandi,
        mp.state,
        mp.distance_km,
        mp.modal_price_per_kg,
        mp.min_price_per_kg,
        mp.max_price_per_kg,
        mp.trend,
        mp.price_change_pct,
        mp.arrivals_tonnes,
        mp.demand_index,
        mp.source_type || 'demo_seed',
        nowIso
      );
    }

    const batchSeeds = [
      {
        code: 'BATCH-TOM-101',
        farmer: farmer1,
        crop: 'Tomato',
        variety: 'Arka Rakshak (Hybrid)',
        quantity: 1200.0,
        harvest_offset_hrs: 22.0,
        temp: 28.0,
        locality: 'Kolar, Karnataka',
        status: 'active'
      },
      {
        code: 'BATCH-ONI-102',
        farmer: farmer1,
        crop: 'Onion',
        variety: 'Bhima Dark Red',
        quantity: 2500.0,
        harvest_offset_hrs: 72.0,
        temp: 26.0,
        locality: 'Kolar, Karnataka',
        status: 'active'
      },
      {
        code: 'BATCH-TOM-CRIT-103',
        farmer: farmer1,
        crop: 'Tomato',
        variety: 'Local Standard',
        quantity: 480.0,
        harvest_offset_hrs: 68.0,
        temp: 34.0,
        locality: 'Kolar, Karnataka',
        status: 'active'
      },
      {
        code: 'BATCH-POT-104',
        farmer: farmer2,
        crop: 'Potato',
        variety: 'Kufri Jyoti',
        quantity: 1800.0,
        harvest_offset_hrs: 40.0,
        temp: 24.0,
        locality: 'Malur, Kolar',
        status: 'active'
      },
      {
        code: 'BATCH-TOM-105',
        farmer: farmer3,
        crop: 'Tomato',
        variety: 'Arka Rakshak',
        quantity: 1500.0,
        harvest_offset_hrs: 18.0,
        temp: 27.0,
        locality: 'Bangarapet, Kolar',
        status: 'active'
      }
    ];

    const insertBatch = conn.prepare(`
      INSERT INTO batches (
        batch_code, farmer_id, crop, variety, quantity_kg, harvest_time,
        location, locality, ambient_temp_c, storage_type, initial_quality,
        current_quality, shelf_life_hrs, spoilage_risk, photo_url, status,
        cluster_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `);

    const insertRec = conn.prepare(`
      INSERT INTO recommendations (
        batch_id, recommended_action, net_value_sell, net_value_store,
        net_value_process, net_value_redirect, best_expected_value,
        formula_breakdown_json, explanation_en, explanation_hi, confidence_score,
        generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertNotif = conn.prepare(`
      INSERT INTO notifications (
        user_id, batch_id, title, title_hi, message, message_hi, type,
        severity, is_read, sent_sms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const createdBatches = [];
    for (const spec of batchSeeds) {
      const harvestDt = new Date(now.getTime() - spec.harvest_offset_hrs * 3600000);
      const dtCalc = DecayEngine.computeBatchDigitalTwin({
        crop: spec.crop,
        harvestTime: harvestDt,
        ambientTempC: spec.temp,
        initialQuality: 98.0,
        currentTime: now
      });

      const batchInfo = insertBatch.run(
        spec.code,
        spec.farmer.id,
        spec.crop,
        spec.variety,
        spec.quantity,
        harvestDt.toISOString(),
        `${spec.locality} Farm Cluster`,
        spec.locality,
        spec.temp,
        'Ambient Farm Shed',
        98.0,
        dtCalc.current_quality,
        dtCalc.remaining_shelf_life_hrs,
        dtCalc.spoilage_risk,
        null,
        spec.status,
        nowIso,
        nowIso
      );
      const batchId = Number(batchInfo.lastInsertRowid);

      const localPrice = spec.crop === 'Tomato' ? 26.5 : spec.crop === 'Onion' ? 34.0 : 22.0;
      const altPrice = spec.crop === 'Tomato' ? 42.0 : spec.crop === 'Onion' ? 38.0 : 25.0;

      const decCalc = DecisionEngine.evaluateBatchDecision({
        crop: spec.crop,
        quantityKg: spec.quantity,
        currentQuality: dtCalc.current_quality,
        ambientTempC: spec.temp,
        hoursElapsed: spec.harvest_offset_hrs,
        localMandiPricePerKg: localPrice,
        alternateMandiPricePerKg: altPrice
      });

      insertRec.run(
        batchId,
        decCalc.recommended_action,
        decCalc.net_values.sell_now,
        decCalc.net_values.store,
        decCalc.net_values.process,
        decCalc.net_values.redirect,
        decCalc.best_expected_value,
        JSON.stringify(decCalc.formula_breakdown),
        decCalc.explanation_en,
        decCalc.explanation_hi,
        0.96,
        nowIso
      );

      if (dtCalc.spoilage_risk >= 70.0) {
        insertNotif.run(
          spec.farmer.id,
          batchId,
          `CRITICAL SPOILAGE RISK (${Math.round(dtCalc.spoilage_risk)}%) on ${spec.code}`,
          `अत्यधिक सड़न जोखिम चेतावनी (${Math.round(dtCalc.spoilage_risk)}%): ${spec.code}`,
          `Produce ambient temperature (${spec.temp}°C) has accelerated decay. Divert to Processing unit immediately to save ₹${decCalc.net_values.process.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
          `अधिक तापमान (${spec.temp}°C) के कारण फसल तेजी से खराब हो रही है। तुरंत प्रोसेसिंग में भेजकर ₹${decCalc.net_values.process.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} की आय सुरक्षित करें।`,
          'spoilage_alert',
          'critical',
          1,
          nowIso
        );
      }

      createdBatches.push({
        id: batchId,
        batch_code: spec.code,
        farmer_id: spec.farmer.id,
        crop: spec.crop,
        quantity_kg: spec.quantity,
        spoilage_risk: dtCalc.spoilage_risk
      });
    }

    const tomatoBatches = createdBatches.filter(
      (b) => b.crop === 'Tomato' && b.spoilage_risk < 70.0
    );
    if (tomatoBatches.length > 0) {
      const batchDicts = tomatoBatches.map((b) => ({
        id: b.id,
        batch_code: b.batch_code,
        farmer_id: b.farmer_id,
        farmer_name: 'Ramesh / Suresh',
        quantity_kg: b.quantity_kg
      }));
      const evalRes = ClusterOptimizer.evaluateClusterFreightSavings(batchDicts, 140.0);

      const clusterInfo = conn
        .prepare(
          `
        INSERT INTO clusters (
          cluster_code, crop, locality, destination_mandi, total_quantity_kg,
          individual_transport_cost_per_kg, pooled_transport_cost_per_kg,
          cost_savings_pct, vehicle_type, capacity_utilization_pct, status,
          confirmed_by_id, dispatch_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate', NULL, NULL, ?)
      `
        )
        .run(
          'CLUS-KOLAR-TOM-01',
          'Tomato',
          'Kolar District Hub',
          'Azadpur Mandi, Delhi',
          evalRes.total_quantity_kg,
          evalRes.individual_cost_per_kg,
          evalRes.pooled_cost_per_kg,
          evalRes.savings_pct,
          evalRes.vehicle_type,
          evalRes.capacity_utilization_pct,
          nowIso
        );
      const clusterId = Number(clusterInfo.lastInsertRowid);
      const updateClusterStmt = conn.prepare('UPDATE batches SET cluster_id = ? WHERE id = ?');
      for (const b of tomatoBatches) {
        updateClusterStmt.run(clusterId, b.id);
      }
    }
  });
}

export function initStore(customPath = null) {
  if (sqliteDb && !customPath) return sqliteDb;
  if (sqliteDb && customPath) {
    closeStore();
  }

  activeDbPath = customPath || DATABASE_PATH;
  if (activeDbPath !== ':memory:') {
    const dir = path.dirname(activeDbPath);
    fs.mkdirSync(dir, { recursive: true });
  }

  sqliteDb = new DatabaseSync(activeDbPath);
  if (activeDbPath !== ':memory:') {
    sqliteDb.exec('PRAGMA journal_mode = WAL;');
  }
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.exec('PRAGMA busy_timeout = 5000;');

  createSchema(sqliteDb);
  seedInitialData(sqliteDb);
  return sqliteDb;
}

export function closeStore() {
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
}

export function getDatabaseStatus() {
  const conn = getDb();
  const t0 = performance.now();
  const quickCheckRow = conn.prepare('PRAGMA quick_check(1)').get();
  const journalRow = conn.prepare('PRAGMA journal_mode').get();
  const fkRow = conn.prepare('PRAGMA foreign_keys').get();
  const latencyMs = Math.round((performance.now() - t0) * 100) / 100;

  let fileSizeBytes = 0;
  if (activeDbPath !== ':memory:' && fs.existsSync(activeDbPath)) {
    fileSizeBytes = fs.statSync(activeDbPath).size;
  }

  const integrityVal = quickCheckRow ? Object.values(quickCheckRow)[0] : 'unknown';
  const journalVal = journalRow ? Object.values(journalRow)[0] : 'unknown';
  const fkVal = fkRow ? Boolean(Object.values(fkRow)[0]) : false;

  return {
    engine: activeDbPath === ':memory:' ? 'SQLite (In-Memory Test)' : `SQLite Persistent (${String(journalVal).toUpperCase()})`,
    path: activeDbPath,
    connected: true,
    integrity: String(integrityVal),
    journal_mode: String(journalVal),
    foreign_keys_enabled: fkVal,
    query_latency_ms: latencyMs,
    file_size_bytes: fileSizeBytes
  };
}

// --- Users ---
export function getUserById(userId) {
  const row = getDb().prepare('SELECT * FROM users WHERE id = ?').get(Number(userId));
  return mapUser(row);
}

export function getUserByPhone(phone) {
  if (!phone) return null;
  const row = getDb().prepare('SELECT * FROM users WHERE phone = ?').get(String(phone));
  return mapUser(row);
}

export function getUserByEmail(email) {
  if (!email) return null;
  const row = getDb().prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(String(email));
  return mapUser(row);
}

export function listUsers() {
  return getDb().prepare('SELECT * FROM users ORDER BY id ASC').all().map(mapUser);
}

export function createUser({
  name,
  phone = null,
  email = null,
  password_hash = null,
  role = 'farmer',
  fpo_id = 'FPO-KOLAR-01',
  locality = 'Kolar, Karnataka',
  language_preference = 'en',
  is_approved = true
}) {
  const conn = getDb();
  const nowIso = new Date().toISOString();
  const info = conn
    .prepare(
      `
    INSERT INTO users (
      name, phone, email, password_hash, role, fpo_id, locality,
      language_preference, is_approved, failed_attempts, locked_until, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)
  `
    )
    .run(
      name,
      phone || null,
      email || null,
      password_hash,
      role,
      fpo_id,
      locality,
      language_preference || 'en',
      is_approved ? 1 : 0,
      nowIso
    );
  return getUserById(Number(info.lastInsertRowid));
}

export function updateUserAuthState(userId, failedAttempts, lockedUntil) {
  getDb()
    .prepare('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?')
    .run(
      failedAttempts || 0,
      lockedUntil ? new Date(lockedUntil).toISOString() : null,
      Number(userId)
    );
}

export function updateUserPassword(userId, passwordHash) {
  getDb()
    .prepare(
      'UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?'
    )
    .run(passwordHash, Number(userId));
}

export function updateUserApproval(userId, isApproved) {
  const info = getDb()
    .prepare('UPDATE users SET is_approved = ? WHERE id = ?')
    .run(isApproved ? 1 : 0, Number(userId));
  return info.changes > 0;
}

export function adminNeedsSetup() {
  if (ADMIN_BOOTSTRAP_PASSWORD && ADMIN_BOOTSTRAP_PASSWORD.length >= 8) {
    return false;
  }
  const row = getDb()
    .prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND password_hash IS NOT NULL")
    .get();
  return !row || row.cnt === 0;
}

export function claimInitialAdminPassword(passwordHash) {
  const conn = getDb();
  return runInTransaction(conn, () => {
    const existing = conn
      .prepare("SELECT COUNT(*) AS cnt FROM users WHERE role = 'admin' AND password_hash IS NOT NULL")
      .get();
    if (existing && existing.cnt > 0) {
      return null;
    }
    const admin = conn.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1").get();
    if (!admin) return null;
    conn
      .prepare(
        'UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL WHERE id = ?'
      )
      .run(passwordHash, admin.id);
    return getUserById(admin.id);
  });
}

// --- Crop Constants ---
export function listCropConstants() {
  return getDb().prepare('SELECT * FROM crop_constants ORDER BY crop ASC').all();
}

export function getCropConstant(crop) {
  if (!crop) return null;
  return getDb().prepare('SELECT * FROM crop_constants WHERE crop = ?').get(String(crop)) || null;
}

export function upsertCropConstant(data) {
  getDb()
    .prepare(
      `
    INSERT INTO crop_constants (
      crop, name_hi, base_shelf_life_hours, base_fresh_price_per_kg,
      processing_rate_per_kg, processing_cost_per_kg, cold_storage_rate_per_day_kg,
      transport_base_per_kg_km, q10_factor, optimal_temp_c
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(crop) DO UPDATE SET
      name_hi = excluded.name_hi,
      base_shelf_life_hours = excluded.base_shelf_life_hours,
      base_fresh_price_per_kg = excluded.base_fresh_price_per_kg,
      processing_rate_per_kg = excluded.processing_rate_per_kg,
      processing_cost_per_kg = excluded.processing_cost_per_kg,
      cold_storage_rate_per_day_kg = excluded.cold_storage_rate_per_day_kg,
      transport_base_per_kg_km = excluded.transport_base_per_kg_km,
      q10_factor = excluded.q10_factor,
      optimal_temp_c = excluded.optimal_temp_c
  `
    )
    .run(
      data.crop,
      data.name_hi || data.crop,
      data.base_shelf_life_hours,
      data.base_fresh_price_per_kg,
      data.processing_rate_per_kg,
      data.processing_cost_per_kg,
      data.cold_storage_rate_per_day_kg,
      data.transport_base_per_kg_km ?? 0.035,
      data.q10_factor,
      data.optimal_temp_c ?? 12.0
    );
}

// --- Market Prices ---
export function listMarketPrices(cropFilter = null) {
  const conn = getDb();
  if (cropFilter) {
    const q = `%${String(cropFilter).toLowerCase()}%`;
    return conn
      .prepare(
        'SELECT * FROM market_prices WHERE LOWER(crop) LIKE ? ORDER BY modal_price_per_kg DESC'
      )
      .all(q)
      .map(mapMarketPrice);
  }
  return conn
    .prepare('SELECT * FROM market_prices ORDER BY modal_price_per_kg DESC')
    .all()
    .map(mapMarketPrice);
}

export function getMarketPriceById(id) {
  const row = getDb().prepare('SELECT * FROM market_prices WHERE id = ?').get(Number(id));
  return mapMarketPrice(row);
}

export function updateMarketPriceAndNotifyFarmers(
  marketPriceId,
  { modal_price_per_kg, min_price_per_kg, max_price_per_kg, trend, price_change_pct },
  notifications
) {
  const conn = getDb();
  const nowIso = new Date().toISOString();
  return runInTransaction(conn, () => {
    conn
      .prepare(
        `
      UPDATE market_prices
      SET modal_price_per_kg = ?,
          min_price_per_kg = COALESCE(?, min_price_per_kg),
          max_price_per_kg = COALESCE(?, max_price_per_kg),
          trend = ?, price_change_pct = ?,
          is_manual_override = 1, source_type = 'admin_override', fetched_at = ?
      WHERE id = ?
    `
      )
      .run(
        modal_price_per_kg,
        min_price_per_kg ?? null,
        max_price_per_kg ?? null,
        trend,
        price_change_pct,
        nowIso,
        Number(marketPriceId)
      );

    const insertNotif = conn.prepare(`
      INSERT INTO notifications (
        user_id, batch_id, title, title_hi, message, message_hi, type,
        severity, is_read, sent_sms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    for (const n of notifications) {
      insertNotif.run(
        n.user_id,
        n.batch_id ?? null,
        n.title,
        n.title_hi || null,
        n.message,
        n.message_hi || null,
        n.type,
        n.severity,
        n.sent_sms ? 1 : 0,
        nowIso
      );
    }
    return getMarketPriceById(marketPriceId);
  });
}

export function insertRecommendationForBatch(batchId, recData) {
  const nowIso = new Date().toISOString();
  getDb()
    .prepare(
      `
      INSERT INTO recommendations (
        batch_id, recommended_action, net_value_sell, net_value_store,
        net_value_process, net_value_redirect, best_expected_value,
        formula_breakdown_json, explanation_en, explanation_hi,
        confidence_score, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      Number(batchId),
      recData.recommended_action,
      recData.net_value_sell,
      recData.net_value_store,
      recData.net_value_process,
      recData.net_value_redirect,
      recData.best_expected_value,
      JSON.stringify(recData.formula_breakdown),
      recData.explanation_en,
      recData.explanation_hi,
      recData.confidence_score ?? 0.96,
      nowIso
    );
}

// --- Batches ---
export function listBatches({ farmerId = null, status = 'all' } = {}) {
  const conn = getDb();
  const clauses = [];
  const params = [];

  if (farmerId !== null && farmerId !== undefined) {
    clauses.push('farmer_id = ?');
    params.push(Number(farmerId));
  }
  if (status && status !== 'all') {
    clauses.push('status = ?');
    params.push(String(status));
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return conn
    .prepare(`SELECT * FROM batches ${where} ORDER BY created_at DESC, id DESC`)
    .all(...params)
    .map(mapBatch);
}

export function getBatchById(batchId) {
  const row = getDb().prepare('SELECT * FROM batches WHERE id = ?').get(Number(batchId));
  return mapBatch(row);
}

export function batchCodeExists(code) {
  const row = getDb().prepare('SELECT 1 FROM batches WHERE batch_code = ?').get(String(code));
  return Boolean(row);
}

export function createBatchWithTwinAndRec(batchData, recData, notificationData = null) {
  const conn = getDb();
  const nowIso = new Date().toISOString();
  return runInTransaction(conn, () => {
    const batchInfo = conn
      .prepare(
        `
      INSERT INTO batches (
        batch_code, farmer_id, crop, variety, quantity_kg, harvest_time,
        location, locality, ambient_temp_c, storage_type, initial_quality,
        current_quality, shelf_life_hrs, spoilage_risk, photo_url, status,
        cluster_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?, ?)
    `
      )
      .run(
        batchData.batch_code,
        batchData.farmer_id,
        batchData.crop,
        batchData.variety,
        batchData.quantity_kg,
        new Date(batchData.harvest_time).toISOString(),
        batchData.location,
        batchData.locality,
        batchData.ambient_temp_c,
        batchData.storage_type,
        batchData.initial_quality,
        batchData.current_quality,
        batchData.shelf_life_hrs,
        batchData.spoilage_risk,
        batchData.photo_url || null,
        nowIso,
        nowIso
      );
    const batchId = Number(batchInfo.lastInsertRowid);

    conn
      .prepare(
        `
      INSERT INTO recommendations (
        batch_id, recommended_action, net_value_sell, net_value_store,
        net_value_process, net_value_redirect, best_expected_value,
        formula_breakdown_json, explanation_en, explanation_hi,
        confidence_score, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        batchId,
        recData.recommended_action,
        recData.net_value_sell,
        recData.net_value_store,
        recData.net_value_process,
        recData.net_value_redirect,
        recData.best_expected_value,
        JSON.stringify(recData.formula_breakdown),
        recData.explanation_en,
        recData.explanation_hi,
        recData.confidence_score ?? 0.96,
        nowIso
      );

    if (notificationData) {
      conn
        .prepare(
          `
        INSERT INTO notifications (
          user_id, batch_id, title, title_hi, message, message_hi, type,
          severity, is_read, sent_sms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `
        )
        .run(
          notificationData.user_id,
          batchId,
          notificationData.title,
          notificationData.title_hi || null,
          notificationData.message,
          notificationData.message_hi || null,
          notificationData.type,
          notificationData.severity,
          notificationData.sent_sms ? 1 : 0,
          nowIso
        );
    }

    return getBatchById(batchId);
  });
}

export function updateBatchStatus(batchId, status) {
  const nowIso = new Date().toISOString();
  const info = getDb()
    .prepare('UPDATE batches SET status = ?, updated_at = ? WHERE id = ?')
    .run(String(status), nowIso, Number(batchId));
  return info.changes > 0;
}

// --- Recommendations & Outcomes ---
export function getLatestRecommendation(batchId) {
  const row = getDb()
    .prepare('SELECT * FROM recommendations WHERE batch_id = ? ORDER BY id DESC LIMIT 1')
    .get(Number(batchId));
  return mapRecommendation(row);
}

export function createOutcomeAndCompleteBatch(outcomeData) {
  const conn = getDb();
  const nowIso = new Date().toISOString();
  return runInTransaction(conn, () => {
    conn
      .prepare(
        `
      INSERT INTO outcomes (
        batch_id, actual_action, predicted_action, actual_value_realised,
        predicted_value, error_pct, feedback_notes, recorded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        outcomeData.batch_id,
        outcomeData.actual_action,
        outcomeData.predicted_action,
        outcomeData.actual_value_realised,
        outcomeData.predicted_value,
        outcomeData.error_pct,
        outcomeData.feedback_notes || null,
        nowIso
      );

    conn
      .prepare("UPDATE batches SET status = 'completed', updated_at = ? WHERE id = ?")
      .run(nowIso, outcomeData.batch_id);
  });
}

// --- Clusters ---
export function listClusters(status = null) {
  const conn = getDb();
  if (status && status !== 'all') {
    return conn
      .prepare('SELECT * FROM clusters WHERE status = ? ORDER BY created_at DESC, id DESC')
      .all(String(status))
      .map(mapCluster);
  }
  return conn.prepare('SELECT * FROM clusters ORDER BY created_at DESC, id DESC').all().map(mapCluster);
}

export function getClusterById(clusterId) {
  const row = getDb().prepare('SELECT * FROM clusters WHERE id = ?').get(Number(clusterId));
  return mapCluster(row);
}

export function listBatchesInCluster(clusterId) {
  return getDb()
    .prepare('SELECT * FROM batches WHERE cluster_id = ? ORDER BY id ASC')
    .all(Number(clusterId))
    .map(mapBatch);
}

export function createClusterWithBatches(clusterData, batchIds) {
  const conn = getDb();
  const nowIso = new Date().toISOString();
  return runInTransaction(conn, () => {
    const info = conn
      .prepare(
        `
      INSERT INTO clusters (
        cluster_code, crop, locality, destination_mandi, total_quantity_kg,
        individual_transport_cost_per_kg, pooled_transport_cost_per_kg,
        cost_savings_pct, vehicle_type, capacity_utilization_pct, status,
        confirmed_by_id, dispatch_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'candidate', NULL, NULL, ?)
    `
      )
      .run(
        clusterData.cluster_code,
        clusterData.crop,
        clusterData.locality,
        clusterData.destination_mandi,
        clusterData.total_quantity_kg,
        clusterData.individual_transport_cost_per_kg,
        clusterData.pooled_transport_cost_per_kg,
        clusterData.cost_savings_pct,
        clusterData.vehicle_type,
        clusterData.capacity_utilization_pct,
        nowIso
      );
    const clusterId = Number(info.lastInsertRowid);
    const stmt = conn.prepare('UPDATE batches SET cluster_id = ?, updated_at = ? WHERE id = ?');
    for (const bid of batchIds) {
      stmt.run(clusterId, nowIso, Number(bid));
    }
    return getClusterById(clusterId);
  });
}

export function confirmClusterAndNotify(
  clusterId,
  confirmedById,
  dispatchDate,
  destinationMandi,
  notifications
) {
  const conn = getDb();
  const nowIso = new Date().toISOString();
  return runInTransaction(conn, () => {
    conn
      .prepare(
        `
      UPDATE clusters
      SET status = 'confirmed', confirmed_by_id = ?, dispatch_date = ?, destination_mandi = ?
      WHERE id = ?
    `
      )
      .run(
        Number(confirmedById),
        new Date(dispatchDate).toISOString(),
        destinationMandi,
        Number(clusterId)
      );

    const insertNotif = conn.prepare(`
      INSERT INTO notifications (
        user_id, batch_id, title, title_hi, message, message_hi, type,
        severity, is_read, sent_sms, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    for (const n of notifications) {
      insertNotif.run(
        n.user_id,
        n.batch_id ?? null,
        n.title,
        n.title_hi || null,
        n.message,
        n.message_hi || null,
        n.type,
        n.severity,
        n.sent_sms ? 1 : 0,
        nowIso
      );
    }

    return getClusterById(clusterId);
  });
}

// --- Notifications ---
export function listNotificationsForUser(userId) {
  return getDb()
    .prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC')
    .all(Number(userId))
    .map(mapNotification);
}

export function getNotificationById(notifId) {
  const row = getDb().prepare('SELECT * FROM notifications WHERE id = ?').get(Number(notifId));
  return mapNotification(row);
}

export function markNotificationRead(notifId) {
  getDb().prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(Number(notifId));
}

export function markAllNotificationsRead(userId) {
  getDb().prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(Number(userId));
}

// --- OTP Records ---
export function getOtpRecord(phone) {
  const row = getDb().prepare('SELECT * FROM otp_records WHERE phone = ?').get(String(phone));
  if (!row) return null;
  return {
    phone: row.phone,
    otpHash: row.otp_hash,
    createdAt: row.created_at,
    attempts: row.attempts,
    used: Boolean(row.used)
  };
}

export function upsertOtpRecord(phone, { otpHash, createdAt, attempts = 0, used = false }) {
  getDb()
    .prepare(
      `
    INSERT INTO otp_records (phone, otp_hash, created_at, attempts, used)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(phone) DO UPDATE SET
      otp_hash = excluded.otp_hash,
      created_at = excluded.created_at,
      attempts = excluded.attempts,
      used = excluded.used
  `
    )
    .run(String(phone), otpHash, createdAt, attempts, used ? 1 : 0);
}

export function updateOtpRecordState(phone, attempts, used) {
  getDb()
    .prepare('UPDATE otp_records SET attempts = ?, used = ? WHERE phone = ?')
    .run(attempts, used ? 1 : 0, String(phone));
}

export function deleteOtpRecord(phone) {
  getDb().prepare('DELETE FROM otp_records WHERE phone = ?').run(String(phone));
}

// --- Escalations ---
export function createEscalation({ ticket_id, user_id, batch_id = null, issue_topic, query_text }) {
  const nowIso = new Date().toISOString();
  getDb()
    .prepare(
      `
    INSERT INTO escalations (ticket_id, user_id, batch_id, issue_topic, query_text, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      ticket_id,
      Number(user_id),
      batch_id ? Number(batch_id) : null,
      issue_topic || 'Post-Harvest Escalation',
      query_text || '',
      nowIso
    );
}

// --- System Counts ---
export function getSystemCounts() {
  const conn = getDb();
  const totalUsers = conn.prepare('SELECT COUNT(*) AS cnt FROM users').get().cnt;
  const totalBatches = conn.prepare('SELECT COUNT(*) AS cnt FROM batches').get().cnt;
  const activeBatches = conn
    .prepare("SELECT COUNT(*) AS cnt FROM batches WHERE status = 'active'")
    .get().cnt;
  const totalClusters = conn.prepare('SELECT COUNT(*) AS cnt FROM clusters').get().cnt;
  const marketPrices = conn.prepare('SELECT COUNT(*) AS cnt FROM market_prices').get().cnt;
  const notifications = conn.prepare('SELECT COUNT(*) AS cnt FROM notifications').get().cnt;
  const unresolvedErrors = conn
    .prepare('SELECT COUNT(*) AS cnt FROM error_logs WHERE resolved = 0')
    .get().cnt;
  return {
    totalUsers,
    totalBatches,
    activeBatches,
    totalClusters,
    marketPrices,
    notifications,
    unresolvedErrors
  };
}

// --- Error Logs & Diagnostics ---
export function insertErrorLog({
  source = 'backend',
  severity = 'error',
  module = 'api',
  method = null,
  endpoint = null,
  status_code = null,
  message,
  root_cause = null,
  recommended_fix = null
}) {
  const conn = getDb();
  const nowIso = new Date().toISOString();
  const info = conn
    .prepare(
      `
      INSERT INTO error_logs (
        timestamp, source, severity, module, method, endpoint, status_code,
        message, root_cause, recommended_fix, resolved, resolved_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
    `
    )
    .run(
      nowIso,
      String(source).slice(0, 32),
      String(severity).slice(0, 20),
      String(module).slice(0, 80),
      method ? String(method).slice(0, 12) : null,
      endpoint ? String(endpoint).slice(0, 200) : null,
      status_code !== null && status_code !== undefined ? Number(status_code) : null,
      String(message || 'Unexpected error').slice(0, 500),
      root_cause ? String(root_cause).slice(0, 500) : null,
      recommended_fix ? String(recommended_fix).slice(0, 500) : null
    );

  // Retain latest 300 logs to keep SQLite compact
  conn
    .prepare(
      'DELETE FROM error_logs WHERE id NOT IN (SELECT id FROM error_logs ORDER BY id DESC LIMIT 300)'
    )
    .run();

  return getErrorLogById(Number(info.lastInsertRowid));
}

function mapErrorLog(row) {
  if (!row) return null;
  return {
    id: row.id,
    timestamp: row.timestamp,
    source: row.source,
    severity: row.severity,
    module: row.module,
    method: row.method,
    endpoint: row.endpoint,
    status_code: row.status_code,
    message: row.message,
    root_cause: row.root_cause,
    recommended_fix: row.recommended_fix,
    resolved: Boolean(row.resolved),
    resolved_at: row.resolved_at
  };
}

export function getErrorLogById(id) {
  const row = getDb().prepare('SELECT * FROM error_logs WHERE id = ?').get(Number(id));
  return mapErrorLog(row);
}

export function listErrorLogs({ limit = 50, includeResolved = true } = {}) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const where = includeResolved ? '' : 'WHERE resolved = 0';
  return getDb()
    .prepare(`SELECT * FROM error_logs ${where} ORDER BY id DESC LIMIT ?`)
    .all(safeLimit)
    .map(mapErrorLog);
}

export function resolveErrorLog(id) {
  const nowIso = new Date().toISOString();
  const info = getDb()
    .prepare('UPDATE error_logs SET resolved = 1, resolved_at = ? WHERE id = ?')
    .run(nowIso, Number(id));
  return info.changes > 0;
}

export function clearResolvedErrorLogs() {
  const info = getDb().prepare('DELETE FROM error_logs WHERE resolved = 1').run();
  return info.changes;
}

function mapDiagnosticRun(row) {
  if (!row) return null;
  let results = [];
  try {
    results = JSON.parse(row.results_json);
  } catch {
    results = [];
  }
  return {
    id: row.id,
    run_id: row.run_id,
    triggered_by_user_id: row.triggered_by_user_id,
    scope: row.scope,
    status: row.status,
    total_checks: row.total_checks,
    passed_checks: row.passed_checks,
    warning_checks: row.warning_checks,
    failed_checks: row.failed_checks,
    duration_ms: row.duration_ms,
    results,
    created_at: row.created_at
  };
}

export function insertDiagnosticRun(run) {
  const nowIso = new Date().toISOString();
  const conn = getDb();
  const info = conn
    .prepare(
      `
      INSERT INTO diagnostic_runs (
        run_id, triggered_by_user_id, scope, status, total_checks,
        passed_checks, warning_checks, failed_checks, duration_ms,
        results_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      run.run_id,
      run.triggered_by_user_id ? Number(run.triggered_by_user_id) : null,
      run.scope,
      run.status,
      run.total_checks,
      run.passed_checks,
      run.warning_checks,
      run.failed_checks,
      run.duration_ms,
      JSON.stringify(run.results || []),
      nowIso
    );

  // Retain latest 50 diagnostic runs
  conn
    .prepare(
      'DELETE FROM diagnostic_runs WHERE id NOT IN (SELECT id FROM diagnostic_runs ORDER BY id DESC LIMIT 50)'
    )
    .run();

  return mapDiagnosticRun(
    conn.prepare('SELECT * FROM diagnostic_runs WHERE id = ?').get(Number(info.lastInsertRowid))
  );
}

export function listDiagnosticRuns(limit = 15) {
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 15));
  return getDb()
    .prepare('SELECT * FROM diagnostic_runs ORDER BY id DESC LIMIT ?')
    .all(safeLimit)
    .map(mapDiagnosticRun);
}

