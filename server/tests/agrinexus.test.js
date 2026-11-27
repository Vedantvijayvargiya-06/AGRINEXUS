import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Ensure stable JWT secret before loading server config/app
process.env.JWT_SECRET_KEY =
  process.env.JWT_SECRET_KEY || 'test-only-super-secret-key-with-at-least-32-chars';

const { DecayEngine } = await import('../services/decayEngine.js');
const { DecisionEngine } = await import('../services/decisionEngine.js');
const { ClusterOptimizer } = await import('../services/clusterOptimizer.js');
const { ReportingService } = await import('../services/reportingService.js');
const { AgriNexusAssist } = await import('../services/agrinexusAssist.js');
const { closeStore, getUserByEmail, getUserByPhone, updateUserApproval, updateUserAuthState, upsertOtpRecord, deleteOtpRecord } = await import('../store.js');
const { resetRateLimits, generateOtp } = await import('../security.js');
const { createApp } = await import('../../server.js');

function tempDbPath(prefix) {
  return path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
}

function cleanupDbFiles(dbPath) {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${dbPath}${suffix}`;
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

async function startServer(dbPath) {
  resetRateLimits();
  const app = await createApp({ dbPath, serveFrontend: false });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const addr = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${addr.port}`
  };
}

async function stopServer(server) {
  await new Promise((resolve) => server.close(resolve));
  closeStore();
}

test('DecayEngine applies Q10 temperature acceleration accurately', () => {
  assert.equal(DecayEngine.computeTemperatureFactor(20), 1);
  assert.equal(DecayEngine.computeTemperatureFactor(30), 2);
  assert.equal(DecayEngine.computeTemperatureFactor(10), 0.5);

  const q20 = DecayEngine.computeQuality(72, 144, 100);
  assert.equal(q20, 50);
});

test('DecisionEngine avoids cold-storage double-decay and respects pooling toggle', () => {
  const resPooled = DecisionEngine.evaluateBatchDecision({
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

  const resHoursChanged = DecisionEngine.evaluateBatchDecision({
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

  const resSolo = DecisionEngine.evaluateBatchDecision({
    crop: 'Tomato',
    quantityKg: 1200,
    currentQuality: 85,
    hoursElapsed: 24,
    ambientTempC: 30,
    localMandiPricePerKg: 24,
    alternateMandiPricePerKg: 44,
    storageDays: 3,
    projectedPriceIncreasePct: 20,
    isPooled: false
  });

  assert.equal(resPooled.net_values.store, resHoursChanged.net_values.store);
  assert.ok(resPooled.net_values.redirect > resSolo.net_values.redirect);
  assert.ok(resPooled.best_expected_value > 0);
});

test('ClusterOptimizer computes freight savings accurately', () => {
  const summary = ClusterOptimizer.evaluateClusterFreightSavings(
    [
      { id: 1, batch_code: 'B-1', farmer_id: 1, farmer_name: 'Ramesh', crop: 'Tomato', locality: 'Kolar', quantity_kg: 1200 },
      { id: 2, batch_code: 'B-2', farmer_id: 2, farmer_name: 'Suresh', crop: 'Tomato', locality: 'Kolar', quantity_kg: 1800 }
    ],
    120.0
  );
  assert.equal(summary.total_quantity_kg, 3000);
  assert.equal(summary.batch_count, 2);
  assert.ok(summary.savings_pct > 40);
});

test('AgriNexusAssist escalates out-of-scope questions safely without hallucinating', () => {
  const resp = AgriNexusAssist.answerQuery({
    query: 'Who won the cricket IPL match yesterday?',
    userLang: 'en'
  });
  assert.equal(resp.uncertain, true);
  assert.equal(resp.escalate_to_helpdesk, true);
});

test('Security: public signup blocks admin/fpo_admin escalation, demo-switch disabled by default, unauthenticated rejected', async () => {
  const dbPath = tempDbPath('agrinexus-sec');
  const { server, baseUrl } = await startServer(dbPath);
  try {
    // 1. Unauthenticated batch request must fail with 401
    const unauthRes = await fetch(`${baseUrl}/api/batches`);
    assert.equal(unauthRes.status, 401);

    // 2. Demo switch must return 403 when DEMO_MODE is not enabled
    const demoRes = await fetch(`${baseUrl}/api/auth/demo-switch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 1 })
    });
    assert.equal(demoRes.status, 403);

    // 3. Public signup attempting role=admin must fail with 403
    const escAdminRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker',
        email: 'attacker@example.com',
        password: 'StrongPassword123',
        role: 'admin'
      })
    });
    assert.equal(escAdminRes.status, 403);

    // 4. Public signup attempting role=fpo_admin must fail with 403
    const escFpoRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker FPO',
        email: 'attacker-fpo@example.com',
        password: 'StrongPassword123',
        role: 'fpo_admin'
      })
    });
    assert.equal(escFpoRes.status, 403);

    // 5. Public signup with farmer role succeeds with 201 and returns token
    const farmerRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ramesh Test',
        phone: '9123456780',
        email: 'ramesh.test@example.com',
        password: 'StrongPassword123',
        role: 'farmer'
      })
    });
    assert.equal(farmerRes.status, 201);
    const farmerJson = await farmerRes.json();
    assert.equal(farmerJson.user.role, 'farmer');
    assert.ok(farmerJson.access_token);

    // 6. Farmer cannot access admin reports or override market prices
    const reportsRes = await fetch(`${baseUrl}/api/reports/summary`, {
      headers: { Authorization: `Bearer ${farmerJson.access_token}` }
    });
    assert.equal(reportsRes.status, 403);

    const overrideRes = await fetch(`${baseUrl}/api/market/override-price`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerJson.access_token}`
      },
      body: JSON.stringify({ market_price_id: 1, new_modal_price: 50 })
    });
    assert.equal(overrideRes.status, 403);

    // 7. Farmer cannot view another farmer's seeded batch (#1)
    const otherBatchRes = await fetch(`${baseUrl}/api/batches/1`, {
      headers: { Authorization: `Bearer ${farmerJson.access_token}` }
    });
    assert.equal(otherBatchRes.status, 403);
  } finally {
    await stopServer(server);
    cleanupDbFiles(dbPath);
  }
});

test('SQLite Persistence: registered farmer, created batch, and claimed admin survive server restart', async () => {
  const dbPath = tempDbPath('agrinexus-persist');
  let createdBatchCode = null;

  // Boot 1: register farmer, claim initial admin, create batch
  {
    const { server, baseUrl } = await startServer(dbPath);
    try {
      const statusRes = await fetch(`${baseUrl}/api/auth/admin-setup-status`);
      const statusJson = await statusRes.json();
      assert.equal(statusJson.needs_setup, true);

      const claimRes = await fetch(`${baseUrl}/api/auth/admin-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'AdminSecurePassword1!' })
      });
      assert.equal(claimRes.status, 200);

      // Re-claiming must fail with 409
      const reclaimRes = await fetch(`${baseUrl}/api/auth/admin-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'AnotherPassword1!' })
      });
      assert.equal(reclaimRes.status, 409);

      const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Sita Persistent',
          phone: '9888877777',
          email: 'sita@example.com',
          password: 'FarmerPassword123',
          role: 'farmer'
        })
      });
      assert.equal(signupRes.status, 201);
      const { access_token: token } = await signupRes.json();

      const addRes = await fetch(`${baseUrl}/api/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          crop: 'Tomato',
          quantity_kg: 1500,
          ambient_temp_c: 27,
          locality: 'Kolar'
        })
      });
      assert.equal(addRes.status, 201);
      const addJson = await addRes.json();
      createdBatchCode = addJson.batch_code;
      assert.ok(createdBatchCode);
    } finally {
      await stopServer(server);
    }
  }

  // Boot 2: fresh Express server against same SQLite DB file
  {
    const { server, baseUrl } = await startServer(dbPath);
    try {
      const statusRes = await fetch(`${baseUrl}/api/auth/admin-setup-status`);
      const statusJson = await statusRes.json();
      assert.equal(statusJson.needs_setup, false);

      const loginRes = await fetch(`${baseUrl}/api/auth/login-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'sita@example.com',
          password: 'FarmerPassword123'
        })
      });
      assert.equal(loginRes.status, 200);
      const { access_token: token } = await loginRes.json();

      const batchesRes = await fetch(`${baseUrl}/api/batches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      assert.equal(batchesRes.status, 200);
      const batches = await batchesRes.json();
      assert.ok(
        batches.some((b) => b.batch_code === createdBatchCode),
        'Created batch must persist in SQLite across restart'
      );
    } finally {
      await stopServer(server);
      cleanupDbFiles(dbPath);
    }
  }
});

test('ReportingService: empty clusters return 0% savings and zero cost/kg without hardcoded fallbacks', () => {
  const emptySummary = ReportingService.calculateFpoSummary([], []);
  assert.equal(emptySummary.avg_freight_savings_pct, 0);
  assert.equal(emptySummary.avg_solo_cost_per_kg, 0);
  assert.equal(emptySummary.avg_pooled_cost_per_kg, 0);
  assert.equal(emptySummary.total_freight_savings_inr, 0);

  const populatedSummary = ReportingService.calculateFpoSummary(
    [{ quantity_kg: 3000, best_expected_value: 90000, crop: 'Tomato', recommended_action: 'redirect' }],
    [{ individual_cost_total: 15000, pooled_cost_total: 6000, total_quantity_kg: 3000 }]
  );
  assert.equal(populatedSummary.avg_freight_savings_pct, 60);
  assert.equal(populatedSummary.avg_solo_cost_per_kg, 5);
  assert.equal(populatedSummary.avg_pooled_cost_per_kg, 2);
});

test('Cluster optimize-candidates preserves existing cluster_id and market override recalculates recommendations', async () => {
  const dbPath = tempDbPath('agrinexus-fixes');
  const { server, baseUrl } = await startServer(dbPath);
  try {
    // Claim admin to obtain admin JWT
    const claimRes = await fetch(`${baseUrl}/api/auth/admin-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'AdminStrongPassword1!' })
    });
    assert.equal(claimRes.status, 200);
    const { access_token: adminToken } = await claimRes.json();

    // Register a farmer and add two unclustered Onion batches
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cluster Fix Farmer',
        phone: '9777766666',
        email: 'cluster.farmer@example.com',
        password: 'FarmerPassword123',
        role: 'farmer'
      })
    });
    assert.equal(signupRes.status, 201);
    const { access_token: farmerToken } = await signupRes.json();

    // Check existing seeded Tomato batches keep their original cluster_id after optimize-candidates
    const beforeBatchesRes = await fetch(`${baseUrl}/api/batches`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const beforeBatches = await beforeBatchesRes.json();
    const seededClusteredBatch = beforeBatches.find((b) => b.cluster_id !== null);
    assert.ok(seededClusteredBatch, 'Seed DB should include an already-clustered Tomato batch');
    const originalClusterId = seededClusteredBatch.cluster_id;

    // Create two unclustered Onion batches
    for (const qty of [1100, 1400]) {
      const addRes = await fetch(`${baseUrl}/api/batches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${farmerToken}`
        },
        body: JSON.stringify({
          crop: 'Onion',
          quantity_kg: qty,
          ambient_temp_c: 26,
          locality: 'Kolar'
        })
      });
      assert.equal(addRes.status, 201);
    }

    // Run optimize-candidates for all crops
    const optRes = await fetch(`${baseUrl}/api/clusters/optimize-candidates`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(optRes.status, 200);
    const optJson = await optRes.json();
    assert.ok(
      Array.isArray(optJson.candidates) && optJson.candidates.some((c) => c.crop === 'Onion'),
      'Should propose Onion cluster for unclustered batches'
    );

    // Verify seeded already-clustered batch did NOT have its cluster_id overwritten
    const afterBatchesRes = await fetch(`${baseUrl}/api/batches`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const afterBatches = await afterBatchesRes.json();
    const sameBatchAfter = afterBatches.find((b) => b.id === seededClusteredBatch.id);
    assert.equal(sameBatchAfter.cluster_id, originalClusterId);

    // Override Tomato market price and verify active Tomato batch recommendations recalculate in SQLite
    const marketRes = await fetch(`${baseUrl}/api/market/prices?crop=Tomato`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const prices = await marketRes.json();
    assert.ok(prices.length > 0);
    const targetPrice = prices[0];

    const seededRecBefore = await (
      await fetch(`${baseUrl}/api/decisions/batch/${seededClusteredBatch.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      })
    ).json();

    const overrideRes = await fetch(`${baseUrl}/api/market/override-price`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ market_price_id: targetPrice.id, new_modal_price: 95 })
    });
    assert.equal(overrideRes.status, 200);
    const overrideJson = await overrideRes.json();
    assert.ok(overrideJson.recalculated_batches >= 1);

    const seededRecAfter = await (
      await fetch(`${baseUrl}/api/decisions/batch/${seededClusteredBatch.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      })
    ).json();
    assert.notEqual(
      seededRecAfter.best_expected_value,
      seededRecBefore.best_expected_value,
      'Market price override must persist recalculated batch recommendation'
    );
  } finally {
    await stopServer(server);
    cleanupDbFiles(dbPath);
  }
});

test('Auth OTP setup enforces approval, lockout, and whitespace password checks', async () => {
  const dbPath = tempDbPath('agrinexus-auth-hardening');
  const { server, baseUrl } = await startServer(dbPath);
  try {
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Lockout Farmer',
        phone: '9666655555',
        email: 'lockout@example.com',
        password: 'InitialPassword123',
        role: 'farmer'
      })
    });
    assert.equal(signupRes.status, 201);

    // Whitespace-only password rejected on login/signup
    const blankSignup = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Blank Pass',
        phone: '9666655551',
        email: 'blank@example.com',
        password: '        ',
        role: 'farmer'
      })
    });
    assert.equal(blankSignup.status, 400);

    // Request OTP endpoint succeeds cleanly without leaking OTP when DEMO_MODE=false
    const otpReq = await fetch(`${baseUrl}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9666655555' })
    });
    assert.equal(otpReq.status, 200);
    const otpJson = await otpReq.json();
    assert.equal(otpJson.demo_note, null);

    // Clear cooldown so test can generate a deterministic OTP directly
    deleteOtpRecord('9666655555');
    const { otpCode } = generateOtp('9666655555');

    const user = getUserByEmail('lockout@example.com');
    updateUserApproval(user.id, false);

    const setupBlocked = await fetch(`${baseUrl}/api/auth/setup-password-with-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9666655555',
        otp: otpCode,
        new_password: 'NewPassword123!'
      })
    });
    assert.equal(setupBlocked.status, 403);

    // Re-approve, lock user via failed attempts, confirm OTP reset fails 403
    updateUserApproval(user.id, true);
    updateUserAuthState(user.id, 0, new Date(Date.now() + 15 * 60000));
    const lockedSetup = await fetch(`${baseUrl}/api/auth/setup-password-with-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9666655555',
        otp: otpCode,
        new_password: 'NewPassword123!'
      })
    });
    assert.equal(lockedSetup.status, 403);

    // Unlock user and confirm valid OTP resets password cleanly
    updateUserAuthState(user.id, 0, null);
    const validSetup = await fetch(`${baseUrl}/api/auth/setup-password-with-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: '9666655555',
        otp: otpCode,
        new_password: 'NewPassword123!'
      })
    });
    assert.equal(validSetup.status, 200);
    const validSetupJson = await validSetup.json();
    assert.ok(validSetupJson.access_token);
  } finally {
    await stopServer(server);
    cleanupDbFiles(dbPath);
  }
});

test('System Health & Diagnostics module enforces admin-only RBAC, runs safe checks, and sanitizes/resolves error logs', async () => {
  const dbPath = tempDbPath('agrinexus-diagnostics');
  const { server, baseUrl } = await startServer(dbPath);
  try {
    // Setup admin + farmer
    const claimRes = await fetch(`${baseUrl}/api/auth/admin-setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'AdminStrongPassword1!' })
    });
    const { access_token: adminToken } = await claimRes.json();

    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Diag Farmer',
        phone: '9555544444',
        email: 'diag.farmer@example.com',
        password: 'FarmerPassword123',
        role: 'farmer'
      })
    });
    const { access_token: farmerToken } = await signupRes.json();

    // 1. Farmer strictly blocked from diagnostics overview, run, and resolve endpoints
    const farmerOverviewRes = await fetch(`${baseUrl}/api/admin/diagnostics/overview`, {
      headers: { Authorization: `Bearer ${farmerToken}` }
    });
    assert.equal(farmerOverviewRes.status, 403);

    const farmerRunRes = await fetch(`${baseUrl}/api/admin/diagnostics/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken}`
      },
      body: JSON.stringify({ scope: 'full' })
    });
    assert.equal(farmerRunRes.status, 403);

    // 2. Real system-health reports numeric uptime_seconds & db_latency_ms
    const healthRes = await fetch(`${baseUrl}/api/admin/system-health`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.database_integrity, 'ok');
    assert.equal(typeof healthJson.uptime_seconds, 'number');
    assert.equal(typeof healthJson.db_latency_ms, 'number');

    // 3. Trigger real 404 + sanitized frontend error log (with sensitive Bearer string inside message)
    const missingRes = await fetch(`${baseUrl}/api/non-existent-diag-probe`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(missingRes.status, 404);

    const clientErrRes = await fetch(`${baseUrl}/api/admin/diagnostics/client-error`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${farmerToken}`
      },
      body: JSON.stringify({
        message: 'Render failed with Bearer supersecrettoken123 and password=mysecretpass',
        module: 'WhatIfSimulator',
        endpoint: '/simulator',
        status_code: 500
      })
    });
    assert.equal(clientErrRes.status, 201);
    const clientErrJson = await clientErrRes.json();
    assert.ok(clientErrJson.id);

    // 4. Admin executes full diagnostic suite
    const runRes = await fetch(`${baseUrl}/api/admin/diagnostics/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ scope: 'full' })
    });
    assert.equal(runRes.status, 200);
    const runJson = await runRes.json();
    assert.ok(runJson.run_id.startsWith('DIAG-'));
    assert.equal(runJson.failed_checks, 0);
    assert.ok(runJson.passed_checks >= 7);

    // 5. Admin inspects overview: verifies secret redaction & resolves error log
    const overviewRes = await fetch(`${baseUrl}/api/admin/diagnostics/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(overviewRes.status, 200);
    const overview = await overviewRes.json();
    assert.equal(overview.database.integrity, 'ok');
    assert.ok(Array.isArray(overview.integrations) && overview.integrations.length >= 4);
    assert.ok(overview.diagnostic_runs.some((r) => r.run_id === runJson.run_id));

    const capturedClientErr = overview.error_logs.find((e) => e.id === clientErrJson.id);
    assert.ok(capturedClientErr, 'Client error should appear in diagnostics overview');
    assert.ok(!capturedClientErr.message.includes('supersecrettoken123'));
    assert.ok(!capturedClientErr.message.includes('mysecretpass'));
    assert.ok(capturedClientErr.message.includes('[REDACTED]'));
    assert.ok(capturedClientErr.root_cause && capturedClientErr.recommended_fix);

    const resolveRes = await fetch(`${baseUrl}/api/admin/diagnostics/errors/${clientErrJson.id}/resolve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(resolveRes.status, 200);

    const clearRes = await fetch(`${baseUrl}/api/admin/diagnostics/errors/resolved`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.equal(clearRes.status, 200);
    const clearJson = await clearRes.json();
    assert.ok(clearJson.removed_count >= 1);
  } finally {
    await stopServer(server);
    cleanupDbFiles(dbPath);
  }
});

test('Demo OTP flow: exposes inline demo_otp strictly for 6 predefined accounts when enabled, enforces expiry/reuse/attempts, and hides non-demo OTPs', async () => {
  const dbPath = tempDbPath('agrinexus-demo-otp');
  const prevFlag = process.env.DEMO_OTP_DISPLAY_ENABLED;
  process.env.DEMO_OTP_DISPLAY_ENABLED = 'true';

  const { server, baseUrl } = await startServer(dbPath);
  try {
    const predefinedAccounts = [
      { phone: '9876543210', role: 'farmer' },
      { phone: '9876543211', role: 'farmer' },
      { phone: '9876543212', role: 'farmer' },
      { phone: '9876543299', role: 'fpo_admin' },
      { phone: '9876543300', role: 'buyer' },
      { phone: '9876543399', role: 'admin' }
    ];

    // 1. All 6 predefined demo numbers receive a 6-digit demo_otp and authenticate to exact roles
    for (const account of predefinedAccounts) {
      resetRateLimits();
      const reqRes = await fetch(`${baseUrl}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: account.phone })
      });
      assert.equal(reqRes.status, 200);
      const reqJson = await reqRes.json();
      assert.equal(reqJson.delivered, true);
      assert.equal(reqJson.is_demo_otp, true);
      assert.match(reqJson.demo_otp, /^\d{6}$/);
      assert.equal(reqJson.demo_note, null);

      const verifyRes = await fetch(`${baseUrl}/api/auth/login-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: account.phone, otp: reqJson.demo_otp })
      });
      assert.equal(verifyRes.status, 200);
      const verifyJson = await verifyRes.json();
      assert.equal(verifyJson.user.role, account.role);
      assert.ok(verifyJson.access_token);

      // 2. Single-use enforcement: reusing the same OTP immediately fails
      const reuseRes = await fetch(`${baseUrl}/api/auth/login-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: account.phone, otp: reqJson.demo_otp })
      });
      assert.equal(reuseRes.status, 400);
    }

    // 3. Resend cooldown enforcement on active unused OTP
    resetRateLimits();
    deleteOtpRecord('9876543210');
    const firstReq = await fetch(`${baseUrl}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' })
    });
    assert.equal(firstReq.status, 200);
    const secondReq = await fetch(`${baseUrl}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' })
    });
    assert.equal(secondReq.status, 429);

    // 4. 5-minute OTP expiration enforcement
    deleteOtpRecord('9876543212');
    const expReq = await fetch(`${baseUrl}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543212' })
    });
    const expJson = await expReq.json();
    const { default: cryptoMod } = await import('node:crypto');
    upsertOtpRecord('9876543212', {
      otpHash: cryptoMod.createHash('sha256').update(expJson.demo_otp).digest('hex'),
      createdAt: Date.now() / 1000 - 305,
      attempts: 0,
      used: false
    });
    const expiredLoginRes = await fetch(`${baseUrl}/api/auth/login-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543212', otp: expJson.demo_otp })
    });
    assert.equal(expiredLoginRes.status, 400);

    // 5. Invalid OTP rejection & lockout after 5 wrong attempts
    deleteOtpRecord('9876543211');
    const lockReq = await fetch(`${baseUrl}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543211' })
    });
    const lockJson = await lockReq.json();
    const wrongOtp = lockJson.demo_otp === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const badRes = await fetch(`${baseUrl}/api/auth/login-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '9876543211', otp: wrongOtp })
      });
      assert.equal(badRes.status, 401);
    }
    const lockedRes = await fetch(`${baseUrl}/api/auth/login-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543211', otp: lockJson.demo_otp })
    });
    assert.equal(lockedRes.status, 403);
    const farmerUser = getUserByPhone('9876543211');
    updateUserAuthState(farmerUser.id, 0, null);

    // 6. Non-demo registered farmer AND arbitrary unregistered number NEVER receive demo_otp
    resetRateLimits();
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Real Farmer',
        phone: '9444433333',
        email: 'real.farmer@example.com',
        password: 'RealPassword123',
        role: 'farmer'
      })
    });
    assert.equal(signupRes.status, 201);

    for (const nonDemoPhone of ['9444433333', '9111122222']) {
      const nonDemoRes = await fetch(`${baseUrl}/api/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: nonDemoPhone })
      });
      assert.equal(nonDemoRes.status, 200);
      const nonDemoJson = await nonDemoRes.json();
      assert.equal(nonDemoJson.delivered, false);
      assert.equal(nonDemoJson.is_demo_otp, false);
      assert.equal(nonDemoJson.demo_otp, null);
      assert.equal(nonDemoJson.demo_note, null);
      assert.match(nonDemoJson.message, /SMS gateway is not configured/i);
    }

    // 7. When DEMO_OTP_DISPLAY_ENABLED is disabled, even predefined demo numbers do NOT return demo_otp
    process.env.DEMO_OTP_DISPLAY_ENABLED = 'false';
    deleteOtpRecord('9876543210');
    const disabledRes = await fetch(`${baseUrl}/api/auth/request-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '9876543210' })
    });
    assert.equal(disabledRes.status, 200);
    const disabledJson = await disabledRes.json();
    assert.equal(disabledJson.delivered, false);
    assert.equal(disabledJson.is_demo_otp, false);
    assert.equal(disabledJson.demo_otp, null);
  } finally {
    if (prevFlag === undefined) {
      delete process.env.DEMO_OTP_DISPLAY_ENABLED;
    } else {
      process.env.DEMO_OTP_DISPLAY_ENABLED = prevFlag;
    }
    await stopServer(server);
    cleanupDbFiles(dbPath);
  }
});


