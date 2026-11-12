// End-to-end API tests with fake users. Run: npm test
// Covers: signup consent rows, consent log append-only, two-account isolation (incl. files),
// admin access control, CSV exports, privacy request + owner email, validation, rate limiting, no stack traces.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const PORT = 3200 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'plate-test-'));
const results = [];

class Client {
  constructor() { this.jar = {}; }
  async req(method, url, body, { form, headers = {} } = {}) {
    const h = { 'X-Requested-With': 'fetch', ...headers };
    const cookie = Object.entries(this.jar).map(([k, v]) => `${k}=${v}`).join('; ');
    if (cookie) h.Cookie = cookie;
    if (body && !form) h['Content-Type'] = 'application/json';
    const res = await fetch(BASE + url, { method, headers: h, body: form || (body ? JSON.stringify(body) : undefined), redirect: 'manual' });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); this.jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  }
}

async function test(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}

(async () => {
  const srv = spawn(process.execPath, ['src/server.js'], { env: { ...process.env, PORT, DATA_DIR, OWNER_EMAIL: 'owner@example.test', NODE_ENV: 'test', BASE_URL: BASE }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 50; i++) { try { await fetch(BASE + '/'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }

  const owner = new Client(), A = new Client(), B = new Client(), anon = new Client();
  const { db } = (() => { process.env.DATA_DIR = DATA_DIR; return require('../src/db'); })();

  await test('Signup requires the Terms/Privacy checkbox', async () => {
    const r = await A.req('POST', '/api/auth/signup', { name: 'Ava', email: 'ava@example.test', password: 'correct horse 1', accept_terms: false });
    assert.equal(r.status, 400); assert.ok(r.json.fields.accept_terms);
  });
  await test('Signup validates email and password', async () => {
    const r = await A.req('POST', '/api/auth/signup', { name: '', email: 'nope', password: 'short', accept_terms: true });
    assert.equal(r.status, 400); assert.ok(r.json.fields.email && r.json.fields.password && r.json.fields.name);
  });
  await test('Signup creates a signup_consents row (marketing unchecked = 0)', async () => {
    const r = await A.req('POST', '/api/auth/signup', { name: 'Ava', email: 'ava@example.test', password: 'correct horse 1', accept_terms: true });
    assert.equal(r.status, 201);
    const u = db.prepare('SELECT id, role FROM users WHERE email = ?').get('ava@example.test');
    assert.equal(u.role, 'user');
    const sc = db.prepare('SELECT * FROM signup_consents WHERE user_id = ?').get(u.id);
    assert.ok(sc); assert.equal(sc.marketing_opt_in, 0); assert.ok(sc.terms_version && sc.privacy_version && sc.created_at);
  });
  await test('Client cannot make itself owner (role ignored)', async () => {
    const r = await B.req('POST', '/api/auth/signup', { name: 'Bea', email: 'bea@example.test', password: 'battery staple 2', accept_terms: true, marketing_opt_in: true, role: 'owner' });
    assert.equal(r.status, 201);
    assert.equal(db.prepare('SELECT role FROM users WHERE email = ?').get('bea@example.test').role, 'user');
    assert.equal(db.prepare('SELECT s.marketing_opt_in FROM signup_consents s JOIN users u ON u.id = s.user_id WHERE u.email = ?').get('bea@example.test').marketing_opt_in, 1);
  });
  await owner.req('POST', '/api/auth/signup', { name: 'Owner', email: 'owner@example.test', password: 'owner password 3', accept_terms: true });

  await test('Every banner choice inserts a NEW dated consent row', async () => {
    const before = db.prepare('SELECT COUNT(*) n FROM consent_records').get().n;
    await anon.req('GET', '/');
    for (const body of [{ choice: 'reject_all' }, { choice: 'accept_all' }, { choice: 'custom', categories: { analytics: true, marketing: false } }]) {
      const r = await anon.req('POST', '/api/consent', { ...body, region: 'EU' });
      assert.equal(r.status, 200);
    }
    const rows = db.prepare('SELECT * FROM consent_records ORDER BY created_at').all();
    assert.equal(rows.length, before + 3);
    assert.deepEqual(rows.map(r => r.choice).slice(-3), ['reject_all', 'accept_all', 'custom']);
    assert.ok(rows.every(r => r.created_at && r.visitor_id && r.banner_version && r.policy_version && r.region));
    assert.equal(new Set(rows.slice(-3).map(r => r.visitor_id)).size, 1);
  });
  await test('Global Privacy Control forces marketing off', async () => {
    const r = await anon.req('POST', '/api/consent', { choice: 'accept_all', region: 'US-CA' }, { headers: { 'Sec-GPC': '1' } });
    assert.equal(r.json.categories.marketing, false);
    assert.equal(db.prepare('SELECT gpc FROM consent_records ORDER BY created_at DESC LIMIT 1').get().gpc, 1);
  });
  await test('consent_records cannot be updated or deleted (append-only)', async () => {
    assert.throws(() => db.prepare("UPDATE consent_records SET choice = 'accept_all'").run());
    assert.throws(() => db.prepare('DELETE FROM consent_records').run());
  });
  await test('Consent from a signed-in user links user_id', async () => {
    await A.req('POST', '/api/consent', { choice: 'reject_all', region: 'US' });
    const u = db.prepare('SELECT id FROM users WHERE email = ?').get('ava@example.test');
    assert.ok(db.prepare('SELECT 1 FROM consent_records WHERE user_id = ?').get(u.id));
  });

  // ---- two-account test ----
  let scanA, plateA, logA, photoA;
  await test('User A creates a scan, plate, photo, log and plan', async () => {
    let r = await A.req('POST', '/api/scans', { name: 'Ava cereal', added_sugar: 12, fiber: 1, protein: 3, total_carbs: 35, ingredients: 'sugar, corn' });
    assert.equal(r.status, 201); scanA = r.json.id;
    r = await A.req('POST', '/api/plates', { name: 'Ava lunch', items: [{ id: 'chicken', qty: 1 }, { id: 'broccoli', qty: 2 }] });
    assert.equal(r.status, 201); plateA = r.json.id;
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c626001000000050001a5f645400000000049454e44ae426082', 'hex');
    const fd = new FormData(); fd.append('photo', new Blob([png], { type: 'image/png' }), 'p.png');
    r = await A.req('POST', '/api/uploads', null, { form: fd });
    assert.equal(r.status, 201); photoA = r.json.id;
    r = await A.req('POST', '/api/logs', { source: 'plate', ref_id: plateA, meal: 'lunch', log_date: '2026-11-12' });
    assert.equal(r.status, 201); logA = r.json.id;
    r = await A.req('PUT', '/api/plans/2026-11-09', { slots: { 0: { breakfast: 'r_yogurt_bowl' } } });
    assert.equal(r.status, 200);
    r = await A.req('GET', '/api/day/2026-11-12');
    assert.equal(r.json.totals.protein, 41);
  });
  await test('Two-account test: B cannot read A’s data', async () => {
    for (const url of [`/api/scans/${scanA}`, `/api/plates/${plateA}`, `/api/uploads/${photoA}`]) assert.equal((await B.req('GET', url)).status, 404, url);
    assert.equal((await B.req('GET', '/api/scans')).json.scans.length, 0);
    assert.equal((await B.req('GET', '/api/plates')).json.plates.length, 0);
    assert.equal((await B.req('GET', '/api/day/2026-11-12')).json.logs.length, 0);
    assert.deepEqual((await B.req('GET', '/api/plans/2026-11-09')).json.slots, {});
  });
  await test('Two-account test: B cannot change or delete A’s data', async () => {
    assert.equal((await B.req('PUT', `/api/scans/${scanA}`, { name: 'hacked', added_sugar: 0, fiber: 0, protein: 0, total_carbs: 0 })).status, 404);
    assert.equal((await B.req('PUT', `/api/plates/${plateA}`, { name: 'hacked', items: [{ id: 'eggs', qty: 1 }] })).status, 404);
    assert.equal((await B.req('DELETE', `/api/scans/${scanA}`)).status, 404);
    assert.equal((await B.req('DELETE', `/api/plates/${plateA}`)).status, 404);
    assert.equal((await B.req('DELETE', `/api/logs/${logA}`)).status, 404);
    assert.equal((await B.req('POST', '/api/logs', { source: 'plate', ref_id: plateA, meal: 'lunch' })).status, 404);
    assert.equal((await B.req('POST', '/api/plates', { name: 'x', items: [{ id: 'eggs', qty: 1 }], photo_id: photoA })).status, 400);
    assert.equal(db.prepare('SELECT name FROM label_scans WHERE id = ?').get(scanA).name, 'Ava cereal');
    assert.ok(db.prepare('SELECT 1 FROM food_logs WHERE id = ?').get(logA));
  });
  await test('Signed-out requests are denied', async () => {
    for (const url of ['/api/scans', `/api/plates/${plateA}`, `/api/uploads/${photoA}`, '/api/me', '/api/account/export']) assert.equal((await anon.req('GET', url)).status, 401, url);
    assert.equal((await anon.req('GET', '/app')).status, 302);
  });
  await test('Requests without the same-origin header are blocked (CSRF)', async () => {
    const r = await A.req('POST', '/api/scans', { name: 'x', added_sugar: 0, fiber: 0, protein: 0, total_carbs: 0 }, { headers: { 'X-Requested-With': '' } });
    assert.equal(r.status, 403);
  });

  // ---- privacy request + admin ----
  await test('Privacy delete request is saved and owner email is queued', async () => {
    const r = await anon.req('POST', '/api/privacy-request', { email: 'ava@example.test', type: 'delete', details: 'Please delete my account' });
    assert.equal(r.status, 201);
    assert.ok(db.prepare("SELECT 1 FROM data_requests WHERE email = 'ava@example.test' AND type = 'delete' AND status = 'new'").get());
    const mail = db.prepare("SELECT * FROM email_outbox WHERE to_addr = 'owner@example.test' ORDER BY id DESC LIMIT 1").get();
    assert.ok(mail && /privacy request/i.test(mail.subject));
  });
  await test('Privacy request validates input', async () => {
    const r = await anon.req('POST', '/api/privacy-request', { email: 'bad', type: 'steal' });
    assert.equal(r.status, 400); assert.ok(r.json.fields.email && r.json.fields.type);
  });
  await test('/admin/compliance blocked for signed-out and non-owners', async () => {
    assert.equal((await anon.req('GET', '/admin/compliance')).status, 302);
    assert.equal((await A.req('GET', '/admin/compliance')).status, 403);
    for (const u of ['/api/admin/consents', '/api/admin/signups.csv', '/api/admin/requests']) {
      assert.equal((await anon.req('GET', u)).status, 401, u);
      assert.equal((await A.req('GET', u)).status, 403, u);
    }
    assert.equal((await A.req('PUT', '/api/admin/requests/x', { status: 'done' })).status, 403);
    assert.equal((await owner.req('GET', '/admin/compliance')).status, 200);
  });
  await test('Owner sees the delete request and can change its status', async () => {
    const rows = (await owner.req('GET', '/api/admin/requests')).json.rows;
    const req = rows.find(r => r.type === 'delete');
    assert.ok(req);
    assert.equal((await owner.req('PUT', `/api/admin/requests/${req.id}`, { status: 'in_progress' })).status, 200);
    assert.equal((await owner.req('PUT', `/api/admin/requests/${req.id}`, { status: 'done' })).status, 200);
    assert.ok(db.prepare('SELECT completed_at FROM data_requests WHERE id = ?').get(req.id).completed_at);
  });
  await test('Each Export CSV downloads a CSV file', async () => {
    for (const [u, header] of [['/api/admin/consents.csv', 'id,visitor_id,user_id,choice'], ['/api/admin/signups.csv', 'user_id,terms_version'], ['/api/admin/requests.csv', 'id,email,type,status']]) {
      const r = await owner.req('GET', u);
      assert.equal(r.status, 200, u);
      assert.match(r.headers.get('content-type'), /text\/csv/);
      assert.match(r.headers.get('content-disposition'), /attachment; filename=".+\.csv"/);
      assert.ok(r.text.startsWith(header), u);
      assert.ok(r.text.split('\r\n').length > 2, `${u} has rows`);
    }
  });
  await test('Consent log date filter works', async () => {
    const all = (await owner.req('GET', '/api/admin/consents')).json.rows.length;
    const none = (await owner.req('GET', '/api/admin/consents?from=2000-01-01&to=2000-01-02')).json.rows.length;
    assert.ok(all > 0); assert.equal(none, 0);
  });

  // ---- validation, errors, account ----
  await test('Invalid input returns friendly errors, never stack traces', async () => {
    let r = await A.req('POST', '/api/scans', { name: '', added_sugar: -1, fiber: 'x', protein: 1, total_carbs: 1 });
    assert.equal(r.status, 400); assert.ok(r.json.fields.name && r.json.fields.added_sugar && r.json.fields.fiber);
    r = await A.req('POST', '/api/plates', { items: [{ id: 'nope', qty: 1 }] }); assert.equal(r.status, 400);
    r = await fetch(BASE + '/api/scans', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch', Cookie: `sid=${A.jar.sid}` }, body: '{bad json' });
    const t = await r.text(); assert.equal(r.status, 400); assert.ok(!/at .*\.js:\d+/.test(t) && !/SyntaxError/.test(t));
    const fd = new FormData(); fd.append('photo', new Blob(['not an image'], { type: 'image/png' }), 'x.png');
    r = await A.req('POST', '/api/uploads', null, { form: fd }); assert.equal(r.status, 400);
  });
  await test('Password reset: link is emailed (queued), works once, logs out old sessions', async () => {
    const c = new Client();
    await c.req('POST', '/api/auth/forgot', { email: 'bea@example.test' });
    const mail = db.prepare("SELECT body FROM email_outbox WHERE to_addr = 'bea@example.test' ORDER BY id DESC LIMIT 1").get();
    const token = mail.body.match(/token=([a-f0-9]+)/)[1];
    assert.equal((await c.req('POST', '/api/auth/reset', { token, password: 'brand new pass 9' })).status, 200);
    assert.equal((await c.req('POST', '/api/auth/reset', { token, password: 'again new pass 9' })).status, 400);
    assert.equal((await B.req('GET', '/api/me')).status, 401);
    assert.equal((await B.req('POST', '/api/auth/login', { email: 'bea@example.test', password: 'brand new pass 9' })).status, 200);
  });
  await test('Check-ins: validation, save, and two-account isolation', async () => {
    let r = await A.req('PUT', '/api/checkins/2026-11-12', { energy: 9, period: 'maybe', symptoms: ['nope'] });
    assert.equal(r.status, 400); assert.ok(r.json.fields.energy && r.json.fields.period && r.json.fields.symptoms);
    r = await A.req('PUT', '/api/checkins/2026-11-12', { energy: 4, mood: 3, cravings: 2, sleep: 4, period: 'period', symptoms: ['acne', 'bloating'] });
    assert.equal(r.status, 200);
    assert.equal((await A.req('GET', '/api/checkins/2026-11-12')).json.checkin.energy, 4);
    assert.equal((await B.req('GET', '/api/checkins/2026-11-12')).json.checkin, null);
    assert.equal((await anon.req('GET', '/api/checkins/2026-11-12')).status, 401);
  });
  await test('Labs: validation, plain-language ranges, metabolic check, isolation', async () => {
    let r = await A.req('POST', '/api/labs', { kind: 'a1c', value: 99, taken_on: '2026-11-01' });
    assert.equal(r.status, 400);
    r = await A.req('POST', '/api/labs', { kind: 'bp', value: 128, taken_on: '2026-11-01' });
    assert.equal(r.status, 400); assert.ok(r.json.fields.value2);
    for (const b of [{ kind: 'a1c', value: 5.9 }, { kind: 'fpg', value: 104 }, { kind: 'tg', value: 160 }, { kind: 'hdl', value: 55 }, { kind: 'bp', value: 128, value2: 80 }]) {
      r = await A.req('POST', '/api/labs', { ...b, taken_on: '2026-11-01' }); assert.equal(r.status, 201);
    }
    const d = (await A.req('GET', '/api/labs')).json;
    assert.equal(d.latest.find(x => x.kind === 'a1c').band, 'watch');
    assert.match(d.latest.find(x => x.kind === 'a1c').text, /prediabetes range/);
    assert.equal(d.metabolic.measured, 4); assert.equal(d.metabolic.met, 2);
    const labId = d.rows[0].id;
    assert.equal((await B.req('GET', '/api/labs')).json.rows.length, 0);
    assert.equal((await B.req('DELETE', `/api/labs/${labId}`)).status, 404);
  });
  await test('Insights and appointment report summarize the user’s own data', async () => {
    for (let i = 1; i <= 9; i++) {
      const day = `2026-11-${String(i).padStart(2, '0')}`;
      await A.req('PUT', `/api/checkins/${day}`, { energy: i % 2 ? 4 : 2, cravings: i % 2 ? 2 : 4, period: i === 1 ? 'period' : 'none', symptoms: i % 3 ? [] : ['brain_fog'] });
    }
    const ins = (await A.req('GET', '/api/insights?today=2026-11-12')).json;
    assert.ok(ins.count >= 10); assert.ok(ins.averages.energy > 0); assert.equal(ins.calendar.length, 28);
    assert.ok(ins.starts.includes('2026-11-01'));
    const rep = (await A.req('GET', '/api/report?today=2026-11-12')).json;
    assert.ok(rep.labs.length >= 5); assert.ok(rep.tests.length >= 4); assert.ok(rep.symptoms.find(x => x.key === 'brain_fog'));
    assert.equal((await B.req('GET', '/api/report?today=2026-11-12')).json.labs.length, 0);
  });
  await test('Barcode lookup: validates, serves cached product, flags unreliable added sugar', async () => {
    const { mapProduct } = require('../src/foodfacts');
    const m = mapProduct('3017624010701', { product_name: 'Nutella', brands: 'Ferrero', nutriments: { 'added-sugars_100g': 0, 'added-sugars_modifier': '~', sugars_100g: 56.3, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 }, ingredients_text_en: 'sugar, palm oil, hazelnuts' });
    assert.equal(m.added_sugar, 56.3); assert.equal(m.added_sugar_source, 'total_sugars'); assert.equal(m.basis, '100g'); assert.ok(m.warnings.length >= 2);
    const fixture = mapProduct('0012345678905', { product_name: 'Test Oat Bar', brands: 'Demo', serving_size: '1 bar (40 g)', nova_group: 4,
      nutriments: { 'added-sugars_serving': 9, proteins_serving: 4, fiber_serving: 3, carbohydrates_serving: 27, fat_serving: 6 }, ingredients_text_en: 'oats, sugar, soy lecithin, natural flavor' });
    db.prepare('INSERT OR REPLACE INTO products (code, data, fetched_at) VALUES (?,?,?)').run('0012345678905', JSON.stringify(fixture), Date.now());
    assert.equal((await A.req('GET', '/api/products/abc')).status, 400);
    assert.equal((await anon.req('GET', '/api/products/0012345678905')).status, 401);
    const r = await A.req('GET', '/api/products/0012345678905');
    assert.equal(r.status, 200); assert.equal(r.json.product.added_sugar, 9); assert.equal(r.json.product.nova_group, 4); assert.equal(r.json.product.basis, 'serving');
  });
  await test('Experiments: start, mark days, compare, and two-account isolation', async () => {
    let r = await A.req('POST', '/api/experiments', { key: 'nope' }); assert.equal(r.status, 400);
    r = await A.req('POST', '/api/experiments', { key: 'veggies_first', today: '2026-11-08' }); assert.equal(r.status, 201);
    const id = r.json.id;
    assert.equal((await A.req('PUT', `/api/experiments/${id}/days/2026-11-20`, { done: true })).status, 400);
    assert.equal((await A.req('PUT', `/api/experiments/${id}/days/2026-11-09`, { done: true })).status, 200);
    assert.equal((await B.req('PUT', `/api/experiments/${id}/days/2026-11-10`, { done: true })).status, 404);
    assert.equal((await B.req('POST', `/api/experiments/${id}/stop`)).status, 404);
    const d = (await A.req('GET', '/api/experiments?today=2026-11-12')).json;
    assert.equal(d.active.key, 'veggies_first'); assert.equal(d.active.dayNumber, 5); assert.equal(d.active.doneCount, 1);
    assert.ok(d.active.compare.length === 2 && d.active.duringCount > 0);
    assert.equal((await B.req('GET', '/api/experiments?today=2026-11-12')).json.active, null);
    const done = (await A.req('GET', '/api/experiments?today=2026-11-20')).json;
    assert.equal(done.active, null); assert.equal(done.history[0].status, 'done');
  });
  await test('Calendar reminders download a valid repeating .ics', async () => {
    assert.equal((await A.req('GET', '/api/reminders.ics?type=checkin&time=25:00')).status, 400);
    const r = await A.req('GET', '/api/reminders.ics?type=plan&time=17:00');
    assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/calendar/);
    assert.match(r.text, /BEGIN:VCALENDAR/); assert.match(r.text, /RRULE:FREQ=WEEKLY;BYDAY=SU/); assert.match(r.text, /T170000/); assert.match(r.text, /BEGIN:VALARM/);
  });
  await test('Install files: manifest and service worker are served', async () => {
    const m = await anon.req('GET', '/manifest.webmanifest'); assert.equal(m.status, 200); assert.match(m.headers.get('content-type'), /manifest\+json/); assert.equal(JSON.parse(m.text).display, 'standalone');
    const w = await anon.req('GET', '/sw.js'); assert.equal(w.status, 200); assert.match(w.text, /caches/); assert.ok(!/\/api\/.*cache/.test(w.text.split('startsWith')[0]));
  });
  await test('Focus setting validates and saves', async () => {
    assert.equal((await A.req('PUT', '/api/account/focus', { focus: 'nope' })).status, 400);
    assert.equal((await A.req('PUT', '/api/account/focus', { focus: 'prediabetes' })).status, 200);
    assert.equal((await A.req('GET', '/api/me')).json.user.focus, 'prediabetes');
  });
  await test('Account deletion removes personal data and files, keeps consent records', async () => {
    const u = db.prepare('SELECT id FROM users WHERE email = ?').get('ava@example.test');
    assert.equal((await A.req('DELETE', '/api/account', { password: 'wrong' })).status, 401);
    assert.equal((await A.req('DELETE', '/api/account', { password: 'correct horse 1' })).status, 200);
    assert.ok(!db.prepare('SELECT 1 FROM users WHERE id = ?').get(u.id));
    for (const t of ['label_scans', 'plates', 'food_logs', 'meal_plans', 'uploads', 'sessions', 'targets', 'checkins', 'labs', 'experiments']) assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${t} WHERE user_id = ?`).get(u.id).n, 0, t);
    assert.ok(!fs.existsSync(path.join(DATA_DIR, 'uploads', u.id)));
    assert.ok(db.prepare('SELECT 1 FROM consent_records WHERE user_id = ?').get(u.id));
  });
  await test('Login is rate limited', async () => {
    const c = new Client(); let last;
    for (let i = 0; i < 12; i++) last = await c.req('POST', '/api/auth/login', { email: 'x@example.test', password: 'wrong' });
    assert.equal(last.status, 429);
  });
  await test('Privacy request form is rate limited', async () => {
    let last;
    for (let i = 0; i < 6; i++) last = await anon.req('POST', '/api/privacy-request', { email: 'z@example.test', type: 'access' });
    assert.equal(last.status, 429);
  });
  await test('No third-party scripts or ad pixels in public pages', async () => {
    for (const p of ['/', '/salespage', '/signup', '/privacy']) {
      const html = (await anon.req('GET', p)).text;
      const srcs = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
      assert.ok(srcs.every(s => s.startsWith('/')), `${p}: ${srcs}`);
      assert.ok(!/facebook\.net|googletagmanager|google-analytics|analytics\.tiktok|fbq\(/i.test(html), p);
    }
  });

  srv.kill();
  const failed = results.filter(r => r[0] === 'FAIL');
  for (const r of results) console.log(`${r[0] === 'PASS' ? '✅' : '❌'} ${r[1]}${r[2] ? `\n     ${r[2]}` : ''}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) { console.log('\nServer log:\n' + log); process.exit(1); }
})();
