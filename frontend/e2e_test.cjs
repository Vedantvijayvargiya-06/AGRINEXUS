const { chromium } = require('playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function launchChromium() {
  const candidates = [
    process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    '/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome'
  ].filter(Boolean);

  for (const executablePath of candidates) {
    if (fs.existsSync(executablePath)) {
      return chromium.launch({ executablePath, headless: true });
    }
  }
  return chromium.launch({ headless: true });
}

function cleanupDbFiles(dbPath) {
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${dbPath}${suffix}`;
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

async function runE2ETests() {
  console.log('--- Starting AgriNexus Browser E2E Tests ---');
  let browser;
  let failures = 0;
  const consoleErrors = [];
  const pageErrors = [];

  function check(name, condition, detail = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
    } else {
      failures += 1;
      console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
    }
  }

  try {
    browser = await launchChromium();
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon') && !text.includes('WebSocket')) {
          consoleErrors.push(text);
        }
      }
    });

    const baseUrl = (process.env.E2E_BASE_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
    console.log(`Target URL: ${baseUrl}`);

    const response = await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 20000 });
    check('1. Initial page HTTP status 200', response && response.status() === 200, `Got ${response?.status()}`);

    const title = await page.title();
    check('2. Page title includes AgriNexus', title.includes('AgriNexus'), `Got "${title}"`);

    const loginBody = await page.textContent('body');
    check(
      '3. Stale SIH 2026 branding removed',
      !loginBody.includes('SIH 2026') && !loginBody.includes('Smart India Hackathon'),
      'Found legacy hackathon text'
    );
    check(
      '4. Auth screen has Sign In and Sign Up tabs without unauthenticated admin demo button',
      loginBody.includes('Sign In') && loginBody.includes('Sign Up') && !loginBody.includes('Quick Demo Switch'),
      'Unexpected auth controls'
    );

    // Register a unique farmer via public Sign Up tab
    const uniqueSuffix = Date.now().toString().slice(-6);
    const testEmail = `e2e.farmer.${uniqueSuffix}@example.com`;
    const testPhone = `98${uniqueSuffix.padStart(8, '1').slice(0, 8)}`;
    const testPassword = 'FarmerE2EPassword1!';

    await page.getByRole('button', { name: 'Sign Up' }).click();
    await page.fill('#signup-name', 'Kisan E2E Grower');
    await page.fill('#signup-email', testEmail);
    await page.fill('#signup-phone', testPhone);
    await page.selectOption('#signup-role', 'farmer');
    await page.fill('#signup-password', testPassword);
    await page.getByRole('button', { name: 'Create Account' }).click();

    await page.waitForSelector('text=Active Batches', { timeout: 10000 });
    check('5. Public farmer signup enters Farmer Dashboard (and Diagnostics tab is hidden)', (await page.locator('button:has-text("Diagnostics")').count()) === 0);

    const tokenInStorage = await page.evaluate(() => localStorage.getItem('agrinexus_token'));
    check('6. JWT is kept in memory only (not stored in localStorage)', tokenInStorage === null);

    // Add a real harvest batch
    await page.getByRole('button', { name: /Register Harvest Batch/i }).first().click();
    await page.waitForSelector('text=Register & Compute Digital Twin', { timeout: 5000 });
    await page.getByRole('button', { name: /Register & Compute Digital Twin/i }).click();
    await page.waitForSelector('text=1,000 kg', { timeout: 10000 });
    const dashText = await page.textContent('body');
    check('7. Newly added harvest batch appears on dashboard', dashText.includes('Tomato') && dashText.includes('1,000 kg'));

    // Open Digital Twin Modal
    await page.getByRole('button', { name: /Digital Twin/i }).first().click();
    await page.waitForSelector('text=Continuous Q10 Kinetic Degradation Forecaster', { timeout: 5000 });
    check('8. Digital Twin modal renders Q10 trajectory', true);
    await page.getByRole('button', { name: 'Close digital twin modal' }).click();

    // Open Decision Breakdown Modal
    await page.getByRole('button', { name: /Decide/i }).first().click();
    await page.waitForSelector('text=Comparing All 4 Pathways', { timeout: 5000 });
    check('9. Decision Breakdown modal renders 4 pathways', true);
    await page.getByRole('button', { name: 'Close decision breakdown' }).click();

    // Navigate to What-If Simulator & verify editable local/terminal price controls work
    await page.getByRole('button', { name: /What-If Simulator/i }).first().click();
    await page.waitForSelector('#sim-local-price', { timeout: 10000 });
    await page.fill('#sim-local-price', '18');
    await page.fill('#sim-alt-price', '55');
    await page.waitForSelector('text=Comparative Net Realization', { timeout: 10000 });
    check('10. What-If Simulator renders editable prices and live comparative calculation', true);

    // Navigate to Market Intelligence, verify sort/filter & farmer cannot see Override button
    await page.getByRole('button', { name: /Mandi Market/i }).first().click();
    await page.waitForSelector('table:has-text("Azadpur")', { timeout: 10000 });
    await page.selectOption('select[aria-label="Sort mandi prices"]', 'distance_asc');
    const marketOverrideCount = await page.locator('button:has-text("Override")').count();
    check('11. Market Intelligence supports sort & hides Override action from Farmer role', marketOverrideCount === 0);

    // Navigate to Cluster Pooling & verify farmer cannot see Confirm Cluster action
    await page.getByRole('button', { name: /Cluster Pooling/i }).first().click();
    await page.waitForSelector('text=Awaiting FPO Administrator confirmation', { timeout: 10000 });
    const confirmClusterCount = await page.locator('button:has-text("Confirm Cluster")').count();
    check('12. Cluster Pooling hides admin dispatch confirmation from Farmer role', confirmClusterCount === 0);

    // Reload page -> verify memory-only session resets to login -> sign in again -> verify batch persisted in SQLite
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#login-email', { timeout: 10000 });
    await page.fill('#login-email', testEmail);
    await page.fill('#login-password', testPassword);
    await page.getByRole('button', { name: 'Sign In to AgriNexus' }).click();
    await page.waitForSelector('text=1,000 kg', { timeout: 10000 });
    check('13. Batch persisted in SQLite across reload & re-login', true);

    // Mobile & Tablet responsiveness horizontal overflow verification
    const viewports = [
      { width: 320, height: 667 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 }
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(150);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
      }));
      check(
        `14. No horizontal overflow at ${vp.width}x${vp.height}`,
        metrics.scrollWidth <= metrics.innerWidth,
        `scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`
      );
    }

    // Phase B: Isolated System Admin & Diagnostics UI Verification
    if (process.env.E2E_SKIP_ISOLATED_ADMIN !== '1') {
      const tempDb = path.join(os.tmpdir(), `agrinexus-e2e-admin-${Date.now()}.db`);
      process.env.JWT_SECRET_KEY =
        process.env.JWT_SECRET_KEY || 'e2e-only-super-secret-key-at-least-32-chars';
      const express = (await import('express')).default;
      const { createApp } = await import('../server.js');
      const { closeStore } = await import('../server/store.js');
      const { resetRateLimits } = await import('../server/security.js');
      resetRateLimits();
      const adminApp = await createApp({ dbPath: tempDb, serveFrontend: false });
      const distDir = path.resolve(__dirname, 'dist');
      adminApp.use(express.static(distDir));
      adminApp.get('*', (req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
      const adminServer = await new Promise((resolve) => {
        const s = adminApp.listen(0, '127.0.0.1', () => resolve(s));
      });
      const adminBaseUrl = `http://127.0.0.1:${adminServer.address().port}`;

      try {
        const adminPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        adminPage.on('pageerror', (err) => pageErrors.push(err.message));

        // Claim admin password cleanly & trigger a sanitized 404 probe for error feed check
        const claimRes = await fetch(`${adminBaseUrl}/api/auth/admin-setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'AdminE2EStrongPassword1!' })
        });
        check('15. Isolated admin setup succeeded', claimRes.status === 200);
        await fetch(`${adminBaseUrl}/api/e2e-missing-probe`);

        await adminPage.goto(adminBaseUrl, { waitUntil: 'networkidle', timeout: 20000 });
        await adminPage.waitForSelector('#login-email', { timeout: 10000 });
        await adminPage.fill('#login-email', 'superadmin@agrinexus.gov.in');
        await adminPage.fill('#login-password', 'AdminE2EStrongPassword1!');
        await adminPage.getByRole('button', { name: 'Sign In to AgriNexus' }).click();

        await adminPage.waitForSelector('button:has-text("Diagnostics")', { timeout: 10000 });

        // Verify zero navbar button bounding-box overlap at 1280px & 1440px for 7-tab Admin role
        for (const navVp of [{ width: 1280, height: 800 }, { width: 1440, height: 900 }]) {
          await adminPage.setViewportSize(navVp);
          await adminPage.waitForTimeout(100);
          const navOverlap = await adminPage.evaluate(() => {
            const header = document.querySelector('header');
            const buttons = Array.from(header.querySelectorAll('button')).filter((el) => {
              const style = window.getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
            });
            for (let i = 0; i < buttons.length; i++) {
              const a = buttons[i].getBoundingClientRect();
              for (let j = i + 1; j < buttons.length; j++) {
                const b = buttons[j].getBoundingClientRect();
                const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
                const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
                if (overlapX > 1 && overlapY > 1) {
                  return `"${buttons[i].innerText.trim()}" overlaps "${buttons[j].innerText.trim()}"`;
                }
              }
            }
            return null;
          });
          check(`15b. Admin navbar buttons zero overlap at ${navVp.width}px`, !navOverlap, navOverlap || '');
        }

        await adminPage.getByRole('button', { name: /Diagnostics/i }).first().click();
        await adminPage.waitForSelector('text=System Health & Live Diagnostics', { timeout: 10000 });
        check('16. Admin System Health & Diagnostics screen renders real metrics & integration matrix', true);

        // Execute diagnostic suite from UI
        await adminPage.getByRole('button', { name: /Run Full Diagnostics/i }).click();
        await adminPage.waitForSelector('text=Completed full suite', { timeout: 10000 });
        check('17. Admin diagnostic suite runner executes and renders check results', true);

        // Inspect clickable error log modal & mark resolved
        await adminPage.waitForSelector('text=e2e-missing-probe', { timeout: 10000 });
        await adminPage.locator('button:has-text("e2e-missing-probe")').first().click();
        await adminPage.waitForSelector('text=Likely Root Cause', { timeout: 5000 });
        await adminPage.getByRole('button', { name: /Mark Resolved/i }).click();
        await adminPage.waitForSelector('text=No unresolved runtime errors recorded', { timeout: 10000 });
        check('18. Error detail modal inspection and resolution workflow succeeded', true);

        // Verify zero horizontal overflow on Diagnostics view at mobile & desktop
        for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
          await adminPage.setViewportSize(vp);
          await adminPage.waitForTimeout(150);
          const metrics = await adminPage.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth
          }));
          check(
            `19. Diagnostics view zero overflow at ${vp.width}x${vp.height}`,
            metrics.scrollWidth <= metrics.innerWidth,
            `scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`
          );
        }
        await adminPage.close();
      } finally {
        await new Promise((resolve) => adminServer.close(resolve));
        closeStore();
        cleanupDbFiles(tempDb);
      }

      // Phase C: Isolated Demo OTP Inline Display & Role-Based Dashboard Redirect Verification
      const demoDb = path.join(os.tmpdir(), `agrinexus-e2e-demootp-${Date.now()}.db`);
      const prevDemoOtpFlag = process.env.DEMO_OTP_DISPLAY_ENABLED;
      process.env.DEMO_OTP_DISPLAY_ENABLED = 'true';
      resetRateLimits();
      const demoApp = await createApp({ dbPath: demoDb, serveFrontend: false });
      demoApp.use(express.static(distDir));
      demoApp.get('*', (req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
      const demoServer = await new Promise((resolve) => {
        const s = demoApp.listen(0, '127.0.0.1', () => resolve(s));
      });
      const demoBaseUrl = `http://127.0.0.1:${demoServer.address().port}`;

      try {
        const otpPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        otpPage.on('pageerror', (err) => pageErrors.push(err.message));

        await otpPage.goto(demoBaseUrl, { waitUntil: 'networkidle', timeout: 20000 });
        await otpPage.getByRole('button', { name: 'Kisan OTP' }).click();

        // 1. Non-demo number must show SMS gateway error and NEVER expose demo OTP banner
        await otpPage.fill('#otp-phone', '9111122222');
        await otpPage.getByRole('button', { name: 'Send OTP' }).click();
        await otpPage.waitForSelector('text=SMS gateway is not configured', { timeout: 10000 });
        check(
          '20a. Non-demo phone shows SMS config message without exposing Demo OTP',
          (await otpPage.locator('[data-testid="demo-otp-banner"]').count()) === 0 &&
            (await otpPage.locator('#otp-code').count()) === 0
        );

        // 2. Demo Farmer phone displays inline DEMO OTP banner directly above OTP input
        await otpPage.fill('#otp-phone', '9876543210');
        await otpPage.getByRole('button', { name: 'Send OTP' }).click();
        await otpPage.waitForSelector('[data-testid="demo-otp-banner"]', { timeout: 10000 });
        const bannerText = await otpPage.locator('[data-testid="demo-otp-banner"]').innerText();
        const farmerOtpMatch = bannerText.match(/DEMO OTP:\s*(\d{6})/);
        check(
          '20b. Predefined demo number displays inline 6-digit DEMO OTP banner',
          Boolean(farmerOtpMatch) && bannerText.includes('Demo OTP is displayed here for testing purposes.')
        );

        if (process.env.E2E_CAPTURE_DEMO_OTP_SCREENSHOTS === '1') {
          await otpPage.screenshot({ path: path.resolve(__dirname, '.tmp-demo-otp-desktop.png'), fullPage: true });
          await otpPage.setViewportSize({ width: 390, height: 844 });
          await otpPage.waitForTimeout(150);
          await otpPage.screenshot({ path: path.resolve(__dirname, '.tmp-demo-otp-mobile.png'), fullPage: true });
          await otpPage.setViewportSize({ width: 1440, height: 900 });
        }

        // Verify zero overflow on OTP login screen at 320px and 1440px
        for (const vp of [{ width: 320, height: 667 }, { width: 1440, height: 900 }]) {
          await otpPage.setViewportSize(vp);
          await otpPage.waitForTimeout(100);
          const metrics = await otpPage.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth
          }));
          check(
            `20c. OTP screen zero overflow at ${vp.width}x${vp.height}`,
            metrics.scrollWidth <= metrics.innerWidth,
            `scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`
          );
        }

        // 3. Changing phone number clears previously displayed Demo OTP
        await otpPage.fill('#otp-phone', '9876543299');
        check(
          '20d. Changing phone number clears displayed Demo OTP',
          (await otpPage.locator('[data-testid="demo-otp-banner"]').count()) === 0
        );

        // 4. Test OTP login & role-based dashboard redirect across all 4 roles
        const roleScenarios = [
          { phone: '9876543299', label: 'FPO Admin', expectSelector: 'button:has-text("Export CSV")' },
          { phone: '9876543300', label: 'Buyer', expectSelector: 'table:has-text("Azadpur")' },
          { phone: '9876543399', label: 'System Admin', expectSelector: 'button:has-text("Diagnostics")' },
          { phone: '9876543211', label: 'Farmer', expectSelector: 'text=Active Batches' }
        ];

        for (const scenario of roleScenarios) {
          resetRateLimits();
          await otpPage.getByRole('button', { name: 'Kisan OTP' }).click();
          await otpPage.fill('#otp-phone', scenario.phone);
          await otpPage.getByRole('button', { name: 'Send OTP' }).click();
          await otpPage.waitForSelector('[data-testid="demo-otp-banner"]', { timeout: 10000 });
          const text = await otpPage.locator('[data-testid="demo-otp-banner"]').innerText();
          const codeMatch = text.match(/DEMO OTP:\s*(\d{6})/);
          if (!codeMatch) {
            check(`20e. OTP displayed for ${scenario.label} (${scenario.phone})`, false);
            continue;
          }
          await otpPage.fill('#otp-code', codeMatch[1]);
          await otpPage.getByRole('button', { name: /Verify & Access Dashboard/i }).click();
          await otpPage.waitForSelector(scenario.expectSelector, { timeout: 10000 });
          check(`20e. OTP login redirects ${scenario.label} (${scenario.phone}) to role dashboard`, true);

          await otpPage.getByRole('button', { name: 'Sign out of AgriNexus' }).click();
          await otpPage.waitForSelector('text=Sign In to AgriNexus', { timeout: 10000 });
        }

        await otpPage.close();
      } finally {
        if (prevDemoOtpFlag === undefined) {
          delete process.env.DEMO_OTP_DISPLAY_ENABLED;
        } else {
          process.env.DEMO_OTP_DISPLAY_ENABLED = prevDemoOtpFlag;
        }
        await new Promise((resolve) => demoServer.close(resolve));
        closeStore();
        cleanupDbFiles(demoDb);
      }
    }

    check('21. Zero uncaught page or console errors', pageErrors.length === 0 && consoleErrors.length === 0, `${pageErrors.concat(consoleErrors).join('; ')}`);

    await browser.close();
    console.log(`--- E2E Finished: ${failures} failure(s) ---`);
    process.exit(failures > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal E2E runner error:', err);
    if (browser) await browser.close();
    process.exit(1);
  }
}

runE2ETests();


