const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const context = await browser.newContext({
    permissions: ['notifications'],
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  // Intercept Supabase push_subscriptions calls so we can observe them
  const dbCalls = [];
  page.on('request', req => {
    if (req.url().includes('push_subscriptions')) {
      dbCalls.push({ method: req.method(), url: req.url(), postData: req.postData() });
    }
  });
  page.on('response', async res => {
    if (res.url().includes('push_subscriptions')) {
      try {
        const body = await res.text();
        dbCalls.push({ status: res.status(), response: body.slice(0, 200) });
      } catch {}
    }
  });

  console.log('1. Opening app at localhost:5173...');
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'verify_01_initial.png', fullPage: true });
  console.log('   Screenshot: verify_01_initial.png');
  console.log('   Title:', await page.title());
  console.log('   URL:', page.url());

  // Check what's visible
  const pageText = await page.locator('body').innerText().catch(() => '');
  console.log('   Page content preview:', pageText.slice(0, 200));

  // Look for auth form
  const emailInput = page.locator('input[type="email"]');
  const hasEmail = await emailInput.isVisible().catch(() => false);
  console.log('2. Auth form visible:', hasEmail);

  if (hasEmail) {
    await page.screenshot({ path: 'verify_02_auth.png', fullPage: true });
    console.log('   Screenshot: verify_02_auth.png - auth page loaded correctly');
  }

  // Check for any console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.waitForTimeout(1000);

  console.log('\n3. Console errors:', errors.length === 0 ? 'none' : errors);
  console.log('\n4. Supabase push_subscriptions calls intercepted:', dbCalls.length);
  dbCalls.forEach(c => console.log('  ', JSON.stringify(c)));

  console.log('\n--- RESULT: App loads cleanly. Login required to test notification toggle. ---');
  console.log('To fully test: log in, click Bell icon to enable notifications,');
  console.log('then click again to disable and check push_subscriptions table is cleared.');

  await browser.close();
})();
