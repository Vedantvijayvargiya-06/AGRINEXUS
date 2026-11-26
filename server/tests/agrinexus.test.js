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
const { AgriNexusAssist } = await import('../services/agrinexusAssist.js');
const { closeStore } = await import('../store.js');
const { resetRateLimits } = await import('../security.js');
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
