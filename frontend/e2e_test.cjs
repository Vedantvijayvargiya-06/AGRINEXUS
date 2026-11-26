const { chromium } = require('playwright');
const fs = require('node:fs');

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
        // Ignore harmless favicon / disabled HMR websocket messages
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
    check('5. Public farmer signup enters Farmer Dashboard', true);

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

    // Navigate to What-If Simulator
    await page.getByRole('button', { name: /What-If Simulator/i }).first().click();
    await page.waitForSelector('text=Comparative Net Realization', { timeout: 10000 });
    check('10. What-If Simulator renders live comparative calculation', true);

    // Navigate to Market Intelligence & verify farmer cannot see Override button
    await page.getByRole('button', { name: /Mandi Market/i }).first().click();
    await page.waitForSelector('table:has-text("Azadpur")', { timeout: 10000 });
    const marketOverrideCount = await page.locator('button:has-text("Override")').count();
    check('11. Market Intelligence hides Override action from Farmer role', marketOverrideCount === 0);

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
      await page.waitForTimeout(200);
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

    check('15. Zero uncaught page or console errors', pageErrors.length === 0 && consoleErrors.length === 0, `${pageErrors.concat(consoleErrors).join('; ')}`);

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
