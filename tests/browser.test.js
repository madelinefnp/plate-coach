// Browser journey test (Playwright + Chromium). Run: npm run test:browser
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs'); const os = require('os'); const path = require('path');
const assert = require('assert');

const PORT = 3800 + Math.floor(Math.random() * 100);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'plate-ui-'));
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const results = [];
async function test(name, fn) { try { await fn(); results.push(['PASS', name]); console.log('PASS', name); } catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); console.log('FAIL', name, e.message.split('\n').slice(0,6).join(' | ')); } }

(async () => {
  const srv = spawn(process.execPath, ['src/server.js'], { env: { ...process.env, PORT, DATA_DIR, OWNER_EMAIL: 'owner@example.test', NODE_ENV: 'test', BASE_URL: BASE }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(BASE); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  process.env.DATA_DIR = DATA_DIR; const { db } = require('../src/db');
  const browser = await chromium.launch();
  const consoleErrors = [];
  const watch = p => { p.on('console', m => { if (m.type() === 'error') consoleErrors.push(`${p.url()}: ${m.text()}`); }); p.on('pageerror', e => consoleErrors.push(`${p.url()}: ${e.message}`)); };

  // ---------- consent ----------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, timezoneId: 'Europe/Paris' });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage(); watch(page);
  await test('Banner shows on first visit and analytics is NOT loaded', async () => {
    await page.goto(BASE + '/');
    await page.getByRole('dialog', { name: /privacy choices/i }).waitFor();
    assert.equal(await page.evaluate(() => window.__analyticsLoaded === true), false);
    await page.screenshot({ path: path.join(SHOTS, 'desktop-landing-banner.png') });
  });
  await test('Manage preferences: nothing pre-ticked (EU visitor)', async () => {
    await page.getByRole('button', { name: 'Manage preferences' }).click();
    assert.equal(await page.locator('.cc-banner [name=analytics]').isChecked(), false);
    assert.equal(await page.locator('.cc-banner [name=marketing]').isChecked(), false);
  });
  await test('Reject all: row saved, analytics still blocked, choice remembered', async () => {
    const n0 = db.prepare('SELECT COUNT(*) n FROM consent_records').get().n;
    await page.getByRole('button', { name: 'Reject all' }).click();
    await page.waitForFunction(() => document.querySelector('.cc-banner').hidden);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM consent_records').get().n, n0 + 1);
    const row = db.prepare('SELECT * FROM consent_records ORDER BY created_at DESC LIMIT 1').get();
    assert.equal(row.choice, 'reject_all'); assert.equal(row.region, 'EU');
    await page.reload();
    assert.equal(await page.locator('.cc-banner').count(), 0, 'banner should not reappear');
    assert.equal(await page.evaluate(() => window.__analyticsLoaded === true), false);
  });
  await test('Footer "Cookie settings" reopens banner; Accept all loads analytics and adds a new row', async () => {
    await page.locator('footer [data-open-cookie-settings]').click();
    await page.getByRole('button', { name: 'Accept all' }).click();
    await page.waitForFunction(() => window.__analyticsLoaded === true);
    const rows = db.prepare('SELECT choice FROM consent_records ORDER BY created_at').all().map(r => r.choice);
    assert.deepEqual(rows.slice(-2), ['reject_all', 'accept_all']);
  });
  await test('Custom choice saves a third row', async () => {
    await page.locator('footer [data-open-cookie-settings]').click();
    await page.getByRole('button', { name: 'Manage preferences' }).click().catch(() => {});
    await page.locator('.cc-banner [name=marketing]').uncheck();
    await page.getByRole('button', { name: 'Save my choices' }).click();
    await page.waitForFunction(() => document.querySelector('.cc-banner').hidden);
    assert.equal(db.prepare('SELECT choice FROM consent_records ORDER BY created_at DESC LIMIT 1').get().choice, 'custom');
  });
  await test('GPC browser: marketing toggle disabled', async () => {
    const c = await browser.newContext(); const p = await c.newPage();
    await p.addInitScript(() => Object.defineProperty(navigator, 'globalPrivacyControl', { value: true }));
    await p.goto(BASE + '/'); await p.getByText(/Global Privacy Control signal/).waitFor();
    await p.getByRole('button', { name: 'Manage preferences' }).click();
    assert.equal(await p.locator('.cc-banner [name=marketing]').isDisabled(), true);
    await c.close();
  });

  // ---------- footer links ----------
  await test('Every footer link works', async () => {
    const hrefs = await page.locator('footer a[href^="/"]').evaluateAll(as => [...new Set(as.map(a => a.getAttribute('href')))]);
    for (const h of ['/privacy', '/terms', '/refunds', '/cookies', '/privacy-request']) assert.ok(hrefs.includes(h), `missing ${h}`);
    for (const h of hrefs) { const r = await page.request.get(BASE + h); assert.equal(r.status(), 200, h); }
  });

  // ---------- landing demo ----------
  await test('Landing demo scores a label', async () => {
    await page.goto(BASE + '/#demo');
    await page.getByRole('button', { name: 'Score it' }).click();
    await page.locator('#demo-result .score-ring').waitFor();
    assert.match(await page.locator('#demo-result').innerText(), /Worth swapping/i);
    assert.match(await page.locator('#demo-result').innerText(), /ultra-processed signs/i);
    await page.goto(BASE + '/'); await page.screenshot({ path: path.join(SHOTS, 'desktop-landing.png'), fullPage: true });
  });
  await test('Evidence page lists every reference the app cites', async () => {
    const EV = require('../src/evidence'); const lessons = require('../src/lessons');
    await page.goto(BASE + '/evidence');
    for (const id of EV.ORDER) assert.equal(await page.locator('#ref-' + id).count(), 1, id);
    const cited = new Set(lessons.flatMap(l => l.sections.flatMap(x => x.refs || [])));
    for (const id of cited) assert.ok(EV.REFS[id], 'lesson cites unknown ref ' + id);
    for (const l of lessons) for (const sec of l.sections) if (sec.level) assert.ok(EV.LEVELS[sec.level], sec.heading);
  });
  await test('Landing CTAs lead to signup', async () => {
    await page.goto(BASE + '/');
    await page.getByRole('link', { name: 'Create your free account' }).first().click();
    await page.waitForURL(/\/signup$/);
    await page.goto(BASE + '/salespage');
    await page.getByRole('link', { name: 'Create your free account' }).first().click();
    await page.waitForURL(/\/signup$/);
  });

  // ---------- signup + product journey (mobile) ----------
  const m = await browser.newContext({ ...devices['iPhone 13'], timezoneId: 'America/Chicago' });
  m.setDefaultTimeout(8000);
  const mp = await m.newPage(); watch(mp);
  await test('Signup form: checkbox required, then creates account + signup_consents row', async () => {
    await mp.goto(BASE + '/signup');
    await mp.getByRole('button', { name: 'Reject all' }).click();
    await mp.getByLabel('First name').fill('Maya');
    await mp.getByLabel('Email', { exact: true }).fill('maya@example.test');
    await mp.getByLabel('Password').fill('maya password 1');
    await mp.getByRole('button', { name: 'Create account' }).click();
    await mp.getByText('Please agree to the Terms of Use and Privacy Policy.').waitFor();
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-signup-error.png') });
    await mp.locator('[name=accept_terms]').check();
    await mp.getByRole('button', { name: 'Create account' }).click();
    await mp.waitForURL(/\/app/);
    const u = db.prepare("SELECT id FROM users WHERE email = 'maya@example.test'").get();
    const sc = db.prepare('SELECT * FROM signup_consents WHERE user_id = ?').get(u.id);
    assert.ok(sc); assert.equal(sc.marketing_opt_in, 0);
  });
  await test('Today screen shows targets and a habit of the day', async () => {
    await mp.getByText('Added sugar').first().waitFor();
    await mp.getByText('Habit of the day').waitFor();
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-today-empty.png') });
  });
  await test('Scan a label: validation, then score + swap, then log a serving', async () => {
    await mp.getByRole('link', { name: 'Scan', exact: true }).click();
    await mp.getByRole('button', { name: 'Get my score' }).click();
    await mp.getByText('Give this food a name.').waitFor();
    await mp.getByLabel('Food name').fill('Strawberry yogurt cup');
    await mp.getByLabel('Added sugars (g)').fill('15');
    await mp.getByLabel('Dietary fiber (g)').fill('0');
    await mp.getByLabel('Protein (g)').fill('5');
    await mp.getByLabel('Total carbs (g)').fill('24');
    await mp.getByLabel(/Ingredients/).fill('cultured milk, sugar, strawberries, corn starch, natural flavor');
    await mp.locator('input[type=file][name=photo]').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000050001a5f645400000000049454e44ae426082', 'hex') });
    await mp.locator('.photo-drop img').waitFor();
    await mp.getByRole('button', { name: 'Get my score' }).click();
    await mp.getByText('One better swap').waitFor();
    assert.match(await mp.locator('.swap-box').innerText(), /Greek yogurt/);
    await mp.getByText('What\u2019s been done to it?').waitFor();
    assert.match(await mp.locator('.proc-box').innerText(), /Ultra-processed signs/i);
    assert.match(await mp.locator('.proc-box').innerText(), /natural flavor/);
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-scan-result.png'), fullPage: true });
    await mp.getByRole('button', { name: 'Log a serving' }).click();
    await mp.getByText('Logged').waitFor();
  });
  await test('Edit a scan updates its score', async () => {
    await mp.getByRole('link', { name: 'Edit' }).click();
    await mp.getByLabel('Added sugars (g)').fill('0');
    await mp.getByLabel('Protein (g)').fill('17');
    await mp.getByLabel(/Ingredients/).fill('cultured milk');
    await mp.getByRole('button', { name: 'Save changes' }).click();
    await mp.getByText(/Great pick|Good choice/).waitFor();
  });
  await test('Build a plate: tap foods, see estimates + tips, save, log it', async () => {
    await mp.getByRole('link', { name: 'Plate', exact: true }).click();
    await mp.getByRole('button', { name: /White pasta/ }).click();
    await mp.getByRole('button', { name: /White bread/ }).click();
    await mp.getByText('Swap refined carbs for whole-food fiber').waitFor();
    await mp.getByText('Add protein').first().waitFor();
    await mp.getByText('Start with veggies').waitFor();
    await mp.getByRole('button', { name: /Chicken breast/ }).click();
    await mp.getByRole('button', { name: /Broccoli/ }).click();
    await mp.getByText('Eat it in this order').waitFor();
    assert.ok(await mp.locator('.tip.order .ev-early').count() >= 1, 'order tip shows its evidence level');
    assert.ok(await mp.locator('.tip.order .ev-ref').count() >= 1, 'order tip links its sources');
    await mp.getByLabel('Name this plate').fill('Pasta night');
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-plate-builder.png'), fullPage: true });
    await mp.getByRole('button', { name: 'Save plate' }).click();
    await mp.getByRole('heading', { name: 'Pasta night' }).waitFor();
    await mp.getByRole('button', { name: 'Log this plate' }).click();
    await mp.getByText('Logged').waitFor();
  });
  await test('Meal planner: fill week saves a plan', async () => {
    await mp.getByRole('link', { name: 'Plan' }).click();
    await mp.getByRole('button', { name: /Fill empty slots/ }).click();
    await mp.getByText('Plan saved').waitFor();
    const u = db.prepare("SELECT id FROM users WHERE email = 'maya@example.test'").get();
    const plan = db.prepare('SELECT slots FROM meal_plans WHERE user_id = ?').get(u.id);
    const slots = JSON.parse(plan.slots); assert.equal(Object.keys(slots).length, 7); assert.ok(slots[0].breakfast && slots[6].snack);
    const { RECIPE_BY_ID } = require('../src/nutrition');
    const savoryDays = Object.values(slots).filter(d => RECIPE_BY_ID[d.breakfast].savory).length;
    assert.ok(savoryDays >= 4, `only ${savoryDays} savory breakfasts`);
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-plan.png') });
  });
  await test('Grocery list is built from the week plan, and checks persist', async () => {
    await mp.goto(BASE + '/app#/plan/grocery');
    await mp.getByRole('heading', { name: 'Grocery list' }).waitFor();
    const n = await mp.locator('[data-gitem]').count();
    assert.ok(n >= 10, 'grocery items: ' + n);
    await mp.locator('[data-gitem]').first().check();
    await mp.reload(); await mp.getByRole('heading', { name: 'Grocery list' }).waitFor();
    assert.equal(await mp.locator('[data-gitem]').first().isChecked(), true);
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-grocery.png'), fullPage: true });
  });
  await test('Kitchen staples: "Need it" adds an item to the grocery list', async () => {
    await mp.goto(BASE + '/app#/plan/staples');
    await mp.getByRole('heading', { name: /Stock a PCOS-friendly kitchen/i }).waitFor();
    await mp.locator('[data-need="Natural nut butter"]').click();
    await mp.getByText('Added to grocery list').waitFor();
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-staples.png'), fullPage: true });
    await mp.goto(BASE + '/app#/plan/grocery');
    await mp.getByRole('heading', { name: 'Staples to restock' }).waitFor();
    await mp.locator('[data-gitem="Natural nut butter"]').waitFor();
  });
  await test('Snacks page lists ideas and can log one', async () => {
    await mp.goto(BASE + '/app#/plan/snacks');
    await mp.getByRole('heading', { name: /Snacks that hold you/i }).waitFor();
    assert.ok(await mp.locator('.snack').count() >= 10);
    await mp.locator('.snack').first().getByRole('button', { name: /Log it/ }).click();
    await mp.getByText('Logged').waitFor();
    await mp.goto(BASE + '/app#/plan/prep'); await mp.getByRole('heading', { name: /How to make it stick/i }).waitFor();
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-prep.png'), fullPage: true });
  });
  await test('Today totals reflect logged items + planned meal can be logged', async () => {
    await mp.goto(BASE + '/app#/today');
    await mp.getByText('Pasta night').waitFor();
    const before = await mp.locator('.meter').first().innerText();
    const btn = mp.getByRole('button', { name: 'I ate this' }).first();
    await btn.click(); await mp.getByText('Logged').waitFor();
    await mp.waitForFunction(b => { const m = document.querySelector('.meter'); return m && m.innerText !== b; }, before);
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-today.png'), fullPage: true });
  });
  await test('Manual log validates and saves', async () => {
    await mp.getByRole('button', { name: /Log food/ }).click();
    await mp.getByRole('tab', { name: 'Type it' }).click();
    await mp.getByRole('button', { name: 'Log it' }).click();
    await mp.locator('.sheet .field-error').waitFor();
    await mp.locator('.sheet [name=label]').fill('Handful of almonds');
    await mp.locator('.sheet [name=protein]').fill('6');
    await mp.getByRole('button', { name: 'Log it' }).click();
    await mp.getByText('Handful of almonds').waitFor();
  });
  await test('Learn: open lesson and mark done', async () => {
    await mp.getByRole('link', { name: 'Learn' }).click();
    await mp.getByRole('link', { name: /Same food, steadier blood sugar/ }).click();
    await mp.getByText('Eat in order').first().waitFor();
    assert.ok(await mp.locator('.lesson-sec .ev-ref').count() >= 6, 'lesson sections cite sources');
    await mp.getByRole('link', { name: 'All lessons' }).click();
    await mp.getByRole('link', { name: /Why this works for insulin resistance/ }).click();
    await mp.getByRole('button', { name: 'Mark as done' }).click();
    await mp.getByText('Completed').waitFor();
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-lesson.png') });
  });
  await test('Daily check-in saves with taps and shows on My patterns', async () => {
    await mp.goto(BASE + '/app#/today');
    await mp.getByRole('heading', { name: 'How are you today?' }).waitFor();
    await mp.locator('[data-ci="energy"][data-v="4"]').click();
    await mp.locator('[data-ci="cravings"][data-v="2"]').click();
    await mp.locator('[data-ci-period="period"]').click();
    await mp.locator('[data-ci-sym="bloating"]').click();
    await mp.locator('.ci-saved', { hasText: 'Saved' }).waitFor();
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-checkin.png') });
    const u = db.prepare("SELECT id FROM users WHERE email = 'maya@example.test'").get();
    await mp.waitForFunction(() => true);
    for (let i = 0; i < 20 && !db.prepare('SELECT energy FROM checkins WHERE user_id = ?').get(u.id); i++) await new Promise(r => setTimeout(r, 100));
    const c = db.prepare('SELECT * FROM checkins WHERE user_id = ?').get(u.id);
    assert.equal(c.energy, 4); assert.equal(c.period, 'period'); assert.match(c.symptoms, /bloating/);
    await mp.getByRole('link', { name: 'Me', exact: true }).click();
    await mp.getByRole('heading', { name: 'My patterns' }).waitFor();
    await mp.getByText(/1-day streak/i).waitFor();
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-patterns.png'), fullPage: true });
  });
  await test('My numbers: add labs, see ranges and metabolic check', async () => {
    await mp.goto(BASE + '/app#/me/labs');
    await mp.getByRole('heading', { name: 'My numbers' }).waitFor();
    await mp.locator('#lab-form [name=kind]').selectOption('a1c');
    await mp.locator('#lab-form [name=value]').fill('5.9');
    await mp.getByRole('button', { name: 'Save result' }).click();
    await mp.getByText(/prediabetes range/).first().waitFor();
    await mp.locator('#lab-form [name=kind]').selectOption('bp');
    await mp.locator('#lab-form [name=value]').fill('132');
    await mp.getByRole('button', { name: 'Save result' }).click();
    await mp.getByText('Enter the bottom number (30 to 160).').waitFor();
    await mp.locator('#lab-form [name=value2]').fill('84');
    await mp.getByRole('button', { name: 'Save result' }).click();
    await mp.getByText(/130\/85 or higher counts/).waitFor();
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-labs.png'), fullPage: true });
  });
  await test('Appointment report summarizes and has a print button', async () => {
    await mp.goto(BASE + '/app#/me/report');
    await mp.getByRole('button', { name: /Print or save as PDF/ }).waitFor();
    const txt = await mp.locator('.report').innerText();
    assert.match(txt, /Hemoglobin A1c/); assert.match(txt, /lipid profile/i); assert.match(txt, /Bloating/);
    await mp.locator('[data-ask="0"]').check();
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-report.png'), fullPage: true });
  });
  await test('Focus setting changes the suggested first lesson', async () => {
    await mp.goto(BASE + '/app#/account');
    await mp.locator('[data-focus="prediabetes"]').click();
    await mp.getByText('Focus saved').waitFor();
    await mp.goto(BASE + '/app#/learn');
    await mp.locator('.start-here', { hasText: /Prediabetes and metabolic syndrome/i }).waitFor();
  });
  await test('Barcode lookup fills the label form, then scores it with processing', async () => {
    const { mapProduct } = require('../src/foodfacts');
    const fx = mapProduct('0012345678905', { product_name: 'Test Oat Bar', brands: 'Demo', serving_size: '1 bar (40 g)', nova_group: 4,
      nutriments: { 'added-sugars_serving': 9, proteins_serving: 4, fiber_serving: 3, carbohydrates_serving: 27, fat_serving: 6 }, ingredients_text_en: 'oats, sugar, soy lecithin, natural flavor' });
    db.prepare('INSERT OR REPLACE INTO products (code, data, fetched_at) VALUES (?,?,?)').run('0012345678905', JSON.stringify(fx), Date.now());
    await mp.goto(BASE + '/app#/scan');
    await mp.getByRole('heading', { name: 'Scan the barcode' }).waitFor();
    await mp.getByRole('button', { name: /Scan with camera/ }).waitFor();
    await mp.locator('#bc-code').fill('0012345678905');
    await mp.getByRole('button', { name: 'Look up' }).click();
    await mp.getByText('Found: Test Oat Bar').waitFor();
    assert.equal(await mp.getByLabel('Added sugars (g)').inputValue(), '9');
    assert.match(await mp.locator('.bc-result').innerText(), /ultra-processed \(NOVA group 4\)/);
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-barcode.png'), fullPage: true });
    await mp.getByRole('button', { name: 'Get my score' }).click();
    await mp.waitForURL(/#\/scan\/[0-9a-f-]{36}$/);
    await mp.locator('.proc-box', { hasText: /Ultra-processed signs/i }).waitFor();
  });
  await test('7-day experiment: start, log today, shows on Today', async () => {
    await mp.goto(BASE + '/app#/me/experiments');
    await mp.getByRole('heading', { name: '7-day experiments' }).waitFor().catch(async e => { console.log('VIEW:', (await mp.locator('#view').innerText()).slice(0, 400)); throw e; });
    await mp.locator('[data-exp-start="walk_after_dinner"]').click();
    await mp.getByText('Day 1 of 7').waitFor();
    await mp.getByRole('button', { name: /I did it today/ }).click();
    await mp.getByText('Nice. Day logged.').waitFor().catch(async e => { console.log('TOAST:', await mp.locator('.toast').innerText().catch(() => 'none'), 'BTN:', await mp.locator('[data-exp-today]').evaluateAll(b => b.map(x => x.outerHTML))); throw e; });
    await mp.locator('.exp-day.on').first().waitFor();
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-experiment.png'), fullPage: true });
    await mp.goto(BASE + '/app#/today');
    await mp.locator('.exp-strip', { hasText: /10-minute walk after dinner/i }).waitFor();
    await mp.locator('.exp-strip', { hasText: 'Done today' }).waitFor();
  });
  await test('Account: install card and calendar reminders', async () => {
    await mp.goto(BASE + '/app#/account');
    await mp.getByRole('heading', { name: /Get the app/ }).waitFor();
    await mp.getByText(/Add to Home Screen/).waitFor();
    await mp.locator('[data-rem-time="checkin"]').fill('07:30');
    await mp.locator('[data-rem-time="checkin"]').dispatchEvent('change');
    assert.match(await mp.locator('[data-rem="checkin"]').getAttribute('href'), /time=07:30/);
    const [dl] = await Promise.all([mp.waitForEvent('download'), mp.locator('[data-rem="checkin"]').click()]);
    assert.match(fs.readFileSync(await dl.path(), 'utf8'), /RRULE:FREQ=DAILY/);
    await mp.screenshot({ path: path.join(SHOTS, 'mobile-account.png'), fullPage: true });
  });
  await test('Account: export my data downloads JSON', async () => {
    await mp.goto(BASE + '/app#/account');
    await mp.getByRole('link', { name: 'Download my data' }).waitFor();
    const [dl] = await Promise.all([mp.waitForEvent('download'), mp.getByRole('link', { name: 'Download my data' }).click()]);
    const data = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    assert.equal(data.account.email, 'maya@example.test'); assert.ok(data.plates.length && data.label_scans.length);
  });
  await test('Non-owner is blocked from /admin/compliance', async () => {
    const r = await mp.goto(BASE + '/admin/compliance'); assert.equal(r.status(), 403);
  });
  await test('Mobile pages have no horizontal scroll', async () => {
    for (const p of ['/', '/salespage', '/privacy', '/privacy-request', '/app#/plate', '/app#/plan', '/app#/today']) {
      await mp.goto(BASE + p); await mp.waitForTimeout(300);
      const over = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(over <= 1, `${p} overflows by ${over}px`);
    }
    await mp.goto(BASE + '/'); await mp.screenshot({ path: path.join(SHOTS, 'mobile-landing.png'), fullPage: true });
  });

  // ---------- privacy request -> admin -> CSV ----------
  await test('Delete request from /privacy-request appears in admin + owner email queued', async () => {
    await page.goto(BASE + '/privacy-request');
    await page.getByLabel('Email on your account').fill('maya@example.test');
    await page.getByLabel('Delete my data').check();
    await page.getByRole('button', { name: 'Send request' }).click();
    await page.getByText('Request received').waitFor();
    assert.ok(db.prepare("SELECT 1 FROM email_outbox WHERE to_addr = 'owner@example.test' AND subject LIKE '%delete%'").get());
    // owner signs up + logs in
    await page.goto(BASE + '/signup');
    await page.getByLabel('First name').fill('Owner'); await page.getByLabel('Email', { exact: true }).fill('owner@example.test');
    await page.getByLabel('Password').fill('owner password 1'); await page.locator('[name=accept_terms]').check();
    await page.getByRole('button', { name: 'Create account' }).click(); await page.waitForURL(/\/app/);
    await page.goto(BASE + '/admin/compliance');
    await page.getByRole('tab', { name: 'Data requests' }).click();
    await page.locator('#request-table').getByText('maya@example.test').waitFor();
    await page.locator('#request-table [data-status="in_progress"]').first().click();
    await page.locator('#request-table .pill.in_progress').waitFor();
    await page.screenshot({ path: path.join(SHOTS, 'desktop-admin.png') });
  });
  await test('Admin Export CSV buttons download CSV files', async () => {
    for (const [tab, idx] of [['Consent log', 0], ['Signup consents', 1], ['Data requests', 2]]) {
      await page.getByRole('tab', { name: tab }).click();
      const link = page.locator('.admin-panel:not([hidden])').getByRole('link', { name: 'Export CSV' });
      const [dl] = await Promise.all([page.waitForEvent('download'), link.click()]);
      assert.match(dl.suggestedFilename(), /\.csv$/);
      const txt = fs.readFileSync(await dl.path(), 'utf8'); assert.ok(txt.split('\r\n').length > 2, tab);
    }
  });
  await test('Signed-out visitor is redirected away from /admin/compliance', async () => {
    const c = await browser.newContext(); const p = await c.newPage();
    await p.goto(BASE + '/admin/compliance'); assert.match(p.url(), /\/login/); await c.close();
  });
  await test('Desktop app screenshots', async () => {
    await page.goto(BASE + '/app#/plate');
    await page.getByRole('button', { name: /Salmon/ }).click(); await page.getByRole('button', { name: /Sweet potato/ }).click(); await page.getByRole('button', { name: /Leafy salad/ }).click();
    await page.getByText('Estimated for this plate').waitFor();
    await page.screenshot({ path: path.join(SHOTS, 'desktop-plate.png'), fullPage: true });
    await page.goto(BASE + '/salespage'); await page.screenshot({ path: path.join(SHOTS, 'desktop-salespage.png'), fullPage: true });
  });
  await test('No browser console errors (incl. CSP violations)', async () => { assert.deepEqual(consoleErrors.filter(e => !/status of 4\d\d/.test(e)), []); });

  await browser.close(); srv.kill();
  const failed = results.filter(r => r[0] === 'FAIL');
  for (const r of results) console.log(`${r[0] === 'PASS' ? '✅' : '❌'} ${r[1]}${r[2] ? `\n     ${r[2]}` : ''}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
