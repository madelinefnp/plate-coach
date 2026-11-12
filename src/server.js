const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const CFG = require('./config');
const { db, DATA_DIR } = require('./db');
const N = require('./nutrition');
const LESSONS = require('./lessons');
const P = require('./pages');
const H = require('./health');
const OFF = require('./foodfacts');
const X = require('./experiments');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// ---------- helpers ----------
const uid = () => crypto.randomUUID();
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const nowIso = () => new Date().toISOString();
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [, saltHex, keyHex] = String(stored).split('$');
  if (!saltHex || !keyHex) return false;
  const key = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(key, Buffer.from(keyHex, 'hex'));
}
const DUMMY_HASH = hashPassword('timing-equalizer-not-a-real-password');

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function setCookie(res, name, value, { maxAge, httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (httpOnly) parts.push('HttpOnly');
  if (CFG.COOKIE_SECURE) parts.push('Secure');
  if (maxAge != null) parts.push(`Max-Age=${maxAge}`);
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(Array.isArray(prev) ? prev : prev ? [prev] : []), parts.join('; ')]);
}

// Outbound email. Without an email connection, messages are queued in email_outbox (visible in /admin/compliance).
function sendEmail(to, subject, body) {
  db.prepare('INSERT INTO email_outbox (to_addr, subject, body) VALUES (?,?,?)').run(to, subject, body);
  if (process.env.NODE_ENV !== 'test') console.log(`[email queued] to=${to} subject="${subject}"`);
}

// Simple in-memory rate limiter (per IP + bucket). In production, use the platform's limiter or a shared store.
const hits = new Map();
function rateLimit(bucket, max, windowMs) {
  return (req, res, next) => {
    const key = `${bucket}:${req.ip}`;
    const now = Date.now();
    const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (arr.length >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: 'Too many tries. Please wait a few minutes and try again.' });
    }
    arr.push(now); hits.set(key, arr); next();
  };
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

const fail = (res, status, error, fields) => res.status(status).json({ error, ...(fields ? { fields } : {}) });

// ---------- middleware ----------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; worker-src 'self'; manifest-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
});
app.use(express.json({ limit: '200kb' }));

// Session + visitor id
app.use((req, res, next) => {
  const c = parseCookies(req);
  req.cookies = c;
  if (!c.vid || !/^[a-f0-9-]{36}$/.test(c.vid)) {
    c.vid = uid();
    setCookie(res, 'vid', c.vid, { maxAge: 365 * 86400 });
  }
  req.visitorId = c.vid;
  req.user = null;
  if (c.sid) {
    const row = db.prepare(`SELECT u.id, u.email, u.name, u.role, u.marketing_opt_in FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`).get(sha(c.sid), Date.now());
    if (row) req.user = row;
  }
  next();
});

// CSRF defense for state-changing API calls: same-origin JSON or multipart from our own pages.
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin) {
    try { if (new URL(origin).host !== req.headers.host) return fail(res, 403, 'Request blocked.'); }
    catch { return fail(res, 403, 'Request blocked.'); }
  }
  if (req.headers['x-requested-with'] !== 'fetch') return fail(res, 403, 'Request blocked.');
  next();
});

const requireUser = (req, res, next) => req.user ? next() : fail(res, 401, 'Please log in.');
const requireOwner = (req, res, next) => (req.user && req.user.role === 'owner') ? next() : fail(res, req.user ? 403 : 401, 'Not allowed.');

app.get('/sw.js', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.setHeader('Service-Worker-Allowed', '/'); res.type('application/javascript').sendFile(path.join(__dirname, '..', 'public', 'sw.js')); });
app.get('/manifest.webmanifest', (req, res) => res.type('application/manifest+json').sendFile(path.join(__dirname, '..', 'public', 'manifest.webmanifest')));
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h', index: false }));

// ---------- public pages ----------
const page = fn => (req, res) => res.type('html').send(fn({ user: req.user }));
app.get('/', page(P.landing));
app.get('/landingpage', (req, res) => res.redirect(301, '/'));
app.get('/salespage', page(P.salesPage));
app.get('/privacy', page(P.privacyPage));
app.get('/terms', page(P.termsPage));
app.get('/refunds', page(P.refundsPage));
app.get('/cookies', page(P.cookiesPage));
app.get('/evidence', page(P.evidencePage));
app.get('/privacy-request', page(P.privacyRequestPage));
app.get('/signup', (req, res) => req.user ? res.redirect('/app') : res.type('html').send(P.authPage('signup', { user: null })));
app.get('/login', (req, res) => req.user ? res.redirect('/app') : res.type('html').send(P.authPage('login', { user: null, next: String(req.query.next || '') })));
app.get('/forgot', (req, res) => res.type('html').send(P.forgotPage({ user: req.user })));
app.get('/reset', (req, res) => res.type('html').send(P.forgotPage({ user: req.user, token: String(req.query.token || '') })));
app.get('/app', (req, res) => req.user ? res.type('html').send(P.appShell({ user: req.user })) : res.redirect('/login?next=/app'));
app.get('/admin/compliance', (req, res) => {
  if (!req.user) return res.redirect('/login?next=/admin/compliance');
  if (req.user.role !== 'owner') return res.status(403).type('html').send(P.errorPage({ user: req.user, code: 403, message: 'This page is only for the app owner.' }));
  res.type('html').send(P.adminPage({ user: req.user }));
});

// ---------- consent ----------
app.post('/api/consent', rateLimit('consent', 30, 60e3), (req, res) => {
  const { choice, categories = {}, region } = req.body || {};
  if (!['accept_all', 'reject_all', 'custom'].includes(choice)) return fail(res, 400, 'Invalid choice.');
  const gpc = req.headers['sec-gpc'] === '1' || req.body.gpc === true;
  let cats = { necessary: true, analytics: !!categories.analytics, marketing: !!categories.marketing };
  if (choice === 'accept_all') cats = { necessary: true, analytics: true, marketing: true };
  if (choice === 'reject_all') cats = { necessary: true, analytics: false, marketing: false };
  if (gpc) cats.marketing = false; // Global Privacy Control: never opt in to marketing/sharing
  const reg = ['EU', 'UK', 'US-CA', 'US', 'OTHER'].includes(region) ? region : 'OTHER';
  const id = uid();
  db.prepare(`INSERT INTO consent_records (id, visitor_id, user_id, choice, categories, banner_version, policy_version, region, gpc, user_agent)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, req.visitorId, req.user ? req.user.id : null, choice, JSON.stringify(cats),
    CFG.BANNER_VERSION, CFG.POLICY_VERSION, reg, gpc ? 1 : 0, String(req.headers['user-agent'] || '').slice(0, 300));
  const value = JSON.stringify({ v: CFG.BANNER_VERSION, c: cats });
  setCookie(res, 'cc', value, { maxAge: 365 * 86400, httpOnly: false });
  res.json({ ok: true, categories: cats });
});

// ---------- auth ----------
const authLimiter = rateLimit('auth', 10, 15 * 60e3);
function startSession(res, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)').run(sha(token), userId, Date.now() + 30 * 86400e3);
  setCookie(res, 'sid', token, { maxAge: 30 * 86400 });
}

app.post('/api/auth/signup', authLimiter, (req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 60);
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');
  const fields = {};
  if (!name) fields.name = 'Tell us your first name.';
  if (!EMAIL_RE.test(email)) fields.email = 'Enter a valid email.';
  if (password.length < 10) fields.password = 'Use at least 10 characters.';
  if (password.length > 200) fields.password = 'That password is too long.';
  if (b.accept_terms !== true) fields.accept_terms = 'Please agree to the Terms of Use and Privacy Policy.';
  if (Object.keys(fields).length) return fail(res, 400, 'Please fix the highlighted fields.', fields);
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return fail(res, 409, 'An account with that email already exists. Try logging in.', { email: 'Already registered.' });
  const id = uid();
  const role = email === CFG.OWNER_EMAIL ? 'owner' : 'user'; // role is never taken from the client
  const marketing = b.marketing_opt_in === true ? 1 : 0;
  db.transaction(() => {
    db.prepare('INSERT INTO users (id, email, name, pass_hash, role, marketing_opt_in) VALUES (?,?,?,?,?,?)').run(id, email, name, hashPassword(password), role, marketing);
    db.prepare('INSERT INTO signup_consents (user_id, terms_version, privacy_version, marketing_opt_in) VALUES (?,?,?,?)').run(id, CFG.TERMS_VERSION, CFG.POLICY_VERSION, marketing);
    db.prepare('INSERT INTO targets (user_id) VALUES (?)').run(id);
  })();
  startSession(res, id);
  res.status(201).json({ ok: true });
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  const password = String((req.body || {}).password || '');
  const u = db.prepare('SELECT id, pass_hash FROM users WHERE email = ?').get(email);
  const ok = verifyPassword(password, u ? u.pass_hash : DUMMY_HASH) && !!u;
  if (!ok) return fail(res, 401, 'That email and password don’t match.');
  startSession(res, u.id);
  res.json({ ok: true });
});

app.post('/api/auth/logout', (req, res) => {
  if (req.cookies.sid) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(req.cookies.sid));
  setCookie(res, 'sid', '', { maxAge: 0 });
  res.json({ ok: true });
});

app.post('/api/auth/forgot', authLimiter, (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  const u = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (u) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?,?,?)').run(sha(token), u.id, Date.now() + 3600e3);
    sendEmail(email, `Reset your ${CFG.APP_NAME} password`, `Use this link within 1 hour to set a new password:\n${CFG.BASE_URL}/reset?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`);
  }
  res.json({ ok: true }); // same answer either way so emails can't be enumerated
});

app.post('/api/auth/reset', authLimiter, (req, res) => {
  const token = String((req.body || {}).token || ''), password = String((req.body || {}).password || '');
  if (password.length < 10 || password.length > 200) return fail(res, 400, 'Use at least 10 characters.', { password: 'Use at least 10 characters.' });
  const r = db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used = 0 AND expires_at > ?').get(sha(token), Date.now());
  if (!r) return fail(res, 400, 'That reset link is invalid or expired. Request a new one.');
  db.transaction(() => {
    db.prepare('UPDATE password_resets SET used = 1 WHERE token_hash = ?').run(sha(token));
    db.prepare('UPDATE users SET pass_hash = ? WHERE id = ?').run(hashPassword(password), r.user_id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(r.user_id);
  })();
  res.json({ ok: true });
});

// ---------- privacy requests (public) ----------
app.post('/api/privacy-request', rateLimit('privacy', 5, 60 * 60e3), (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot
  const email = String(b.email || '').trim().toLowerCase();
  const type = String(b.type || '');
  const details = String(b.details || '').slice(0, 2000);
  const fields = {};
  if (!EMAIL_RE.test(email)) fields.email = 'Enter a valid email.';
  if (!['access', 'delete', 'correct'].includes(type)) fields.type = 'Choose a request type.';
  if (Object.keys(fields).length) return fail(res, 400, 'Please fix the highlighted fields.', fields);
  const id = uid();
  db.prepare('INSERT INTO data_requests (id, email, type, details) VALUES (?,?,?,?)').run(id, email, type, details);
  sendEmail(CFG.OWNER_EMAIL, `New privacy request (${type})`, `A new ${type} request was submitted.\nFrom: ${email}\nDetails: ${details || '(none)'}\nReview it: ${CFG.BASE_URL}/admin/compliance`);
  res.status(201).json({ ok: true });
});

// ---------- public demo ----------
app.post('/api/demo/score', rateLimit('demo', 30, 60e3), (req, res) => {
  const r = N.scoreLabel(req.body || {});
  if (r.errors) return fail(res, 400, 'Please fix the highlighted fields.', r.errors);
  res.json({ score: r.score, ...r.result });
});

// ---------- app API (all scoped to req.user.id) ----------
const api = express.Router();
api.use(requireUser);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const today = () => new Date().toISOString().slice(0, 10);
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'];
const writeLimiter = rateLimit('write', 120, 60e3);

api.get('/me', (req, res) => {
  const t = db.prepare('SELECT protein, fiber, added_sugar FROM targets WHERE user_id = ?').get(req.user.id);
  const focus = db.prepare('SELECT focus FROM users WHERE id = ?').get(req.user.id).focus;
  res.json({ user: { name: req.user.name, email: req.user.email, role: req.user.role, marketing_opt_in: !!req.user.marketing_opt_in, focus }, targets: t });
});
const EV = require('./evidence');
api.get('/catalog', (req, res) => res.json({ foods: N.FOODS, recipes: N.RECIPES, lessons: LESSONS.map(({ sections, ...l }) => l), kitchen: require('./kitchen'), symptoms: H.SYMPTOMS,
  evidence: { levels: EV.LEVELS, refs: Object.fromEntries(EV.ORDER.map(id => [id, { n: EV.refNumber(id), cite: EV.REFS[id].cite }])) } }));

api.put('/targets', writeLimiter, (req, res) => {
  const b = req.body || {}; const fields = {};
  const v = {};
  for (const [k, lo, hi] of [['protein', 20, 250], ['fiber', 5, 80], ['added_sugar', 0, 100]]) {
    const n = Number(b[k]);
    if (!Number.isFinite(n) || n < lo || n > hi) fields[k] = `Enter a number from ${lo} to ${hi}.`; else v[k] = Math.round(n);
  }
  if (Object.keys(fields).length) return fail(res, 400, 'Please fix the highlighted fields.', fields);
  db.prepare('UPDATE targets SET protein = ?, fiber = ?, added_sugar = ? WHERE user_id = ?').run(v.protein, v.fiber, v.added_sugar, req.user.id);
  res.json({ targets: v });
});

// Uploads: images only, 5 MB max, private to the uploader.
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const ALLOWED = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}
api.post('/uploads', rateLimit('upload', 20, 60e3), (req, res) => {
  upload.single('photo')(req, res, err => {
    if (err) return fail(res, 400, err.code === 'LIMIT_FILE_SIZE' ? 'Photos must be 5 MB or smaller.' : 'That upload didn’t work. Try another photo.');
    if (!req.file) return fail(res, 400, 'Choose a photo first.');
    const mime = sniff(req.file.buffer);
    if (!mime || !ALLOWED[mime]) return fail(res, 400, 'Use a JPG, PNG or WebP photo.');
    const id = uid();
    const dir = path.join(UPLOAD_DIR, req.user.id);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${id}.${ALLOWED[mime]}`);
    fs.writeFileSync(file, req.file.buffer);
    db.prepare('INSERT INTO uploads (id, user_id, mime, size, path) VALUES (?,?,?,?,?)').run(id, req.user.id, mime, req.file.size, file);
    res.status(201).json({ id });
  });
});
api.get('/uploads/:id', (req, res) => {
  const f = db.prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!f) return fail(res, 404, 'Not found.');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.type(f.mime).sendFile(f.path);
});
const ownPhoto = (userId, id) => !id || !!db.prepare('SELECT 1 FROM uploads WHERE id = ? AND user_id = ?').get(id, userId);

// Label scans
api.post('/scans', writeLimiter, (req, res) => {
  const r = N.scoreLabel(req.body || {});
  if (r.errors) return fail(res, 400, 'Please fix the highlighted fields.', r.errors);
  const photo = req.body.photo_id || null;
  if (!ownPhoto(req.user.id, photo)) return fail(res, 400, 'That photo wasn’t found.');
  const id = uid(); const v = r.value;
  db.prepare(`INSERT INTO label_scans (id, user_id, name, serving, added_sugar, fiber, protein, total_carbs, fat, ingredients, score, result, photo_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, req.user.id, v.name, v.serving, v.added_sugar, v.fiber, v.protein, v.total_carbs, v.fat, v.ingredients, r.score, JSON.stringify(r.result), photo);
  res.status(201).json({ id });
});
const scanOut = s => s && ({ ...s, result: JSON.parse(s.result) });
api.get('/scans', (req, res) => res.json({ scans: db.prepare('SELECT * FROM label_scans WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.user.id).map(scanOut) }));
api.get('/scans/:id', (req, res) => {
  const s = db.prepare('SELECT * FROM label_scans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  s ? res.json({ scan: scanOut(s) }) : fail(res, 404, 'Not found.');
});
api.put('/scans/:id', writeLimiter, (req, res) => {
  const existing = db.prepare('SELECT id, photo_id FROM label_scans WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return fail(res, 404, 'Not found.');
  const r = N.scoreLabel(req.body || {});
  if (r.errors) return fail(res, 400, 'Please fix the highlighted fields.', r.errors);
  const v = r.value;
  db.prepare(`UPDATE label_scans SET name=?, serving=?, added_sugar=?, fiber=?, protein=?, total_carbs=?, fat=?, ingredients=?, score=?, result=?
    WHERE id = ? AND user_id = ?`).run(v.name, v.serving, v.added_sugar, v.fiber, v.protein, v.total_carbs, v.fat, v.ingredients, r.score, JSON.stringify(r.result), req.params.id, req.user.id);
  res.json({ id: req.params.id });
});
api.delete('/scans/:id', writeLimiter, (req, res) => {
  const info = db.prepare('DELETE FROM label_scans WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  info.changes ? res.json({ ok: true }) : fail(res, 404, 'Not found.');
});

// Plates
api.post('/plates/analyze', (req, res) => {
  const r = N.analyzePlate((req.body || {}).items);
  r.errors ? fail(res, 400, r.errors.items, r.errors) : res.json(r);
});
function plateBody(req) {
  const r = N.analyzePlate((req.body || {}).items);
  if (r.errors) return { err: r.errors.items };
  const name = String(req.body.name || '').trim().slice(0, 80) || 'My plate';
  return { r, name };
}
api.post('/plates', writeLimiter, (req, res) => {
  const { r, name, err } = plateBody(req);
  if (err) return fail(res, 400, err, { items: err });
  const photo = req.body.photo_id || null;
  if (!ownPhoto(req.user.id, photo)) return fail(res, 400, 'That photo wasn’t found.');
  const id = uid();
  db.prepare('INSERT INTO plates (id, user_id, name, items, totals, tips, photo_id) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.user.id, name, JSON.stringify(r.items), JSON.stringify({ ...r.totals, composition: r.composition }), JSON.stringify(r.tips), photo);
  res.status(201).json({ id });
});
const plateOut = p => p && ({ ...p, items: JSON.parse(p.items), totals: JSON.parse(p.totals), tips: JSON.parse(p.tips) });
api.get('/plates', (req, res) => res.json({ plates: db.prepare('SELECT * FROM plates WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.user.id).map(plateOut) }));
api.get('/plates/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM plates WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  p ? res.json({ plate: plateOut(p) }) : fail(res, 404, 'Not found.');
});
api.put('/plates/:id', writeLimiter, (req, res) => {
  if (!db.prepare('SELECT 1 FROM plates WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id)) return fail(res, 404, 'Not found.');
  const { r, name, err } = plateBody(req);
  if (err) return fail(res, 400, err, { items: err });
  db.prepare('UPDATE plates SET name=?, items=?, totals=?, tips=? WHERE id = ? AND user_id = ?')
    .run(name, JSON.stringify(r.items), JSON.stringify({ ...r.totals, composition: r.composition }), JSON.stringify(r.tips), req.params.id, req.user.id);
  res.json({ id: req.params.id });
});
api.delete('/plates/:id', writeLimiter, (req, res) => {
  const info = db.prepare('DELETE FROM plates WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  info.changes ? res.json({ ok: true }) : fail(res, 404, 'Not found.');
});

// Food log + daily totals
api.get('/day/:date', (req, res) => {
  if (!isDate(req.params.date)) return fail(res, 400, 'Invalid date.');
  const logs = db.prepare('SELECT * FROM food_logs WHERE user_id = ? AND log_date = ? ORDER BY created_at').all(req.user.id, req.params.date);
  const totals = logs.reduce((t, l) => { for (const k of ['protein', 'fiber', 'added_sugar', 'carbs', 'fat']) t[k] = Math.round((t[k] + l[k]) * 10) / 10; return t; },
    { protein: 0, fiber: 0, added_sugar: 0, carbs: 0, fat: 0 });
  const targets = db.prepare('SELECT protein, fiber, added_sugar FROM targets WHERE user_id = ?').get(req.user.id);
  res.json({ date: req.params.date, logs, totals, targets });
});
api.post('/logs', writeLimiter, (req, res) => {
  const b = req.body || {}; const fields = {};
  const log_date = String(b.log_date || today());
  if (!isDate(log_date)) fields.log_date = 'Pick a date.';
  const meal = String(b.meal || '');
  if (!MEALS.includes(meal)) fields.meal = 'Pick a meal.';
  let entry;
  if (b.source === 'plate') {
    const p = db.prepare('SELECT * FROM plates WHERE id = ? AND user_id = ?').get(String(b.ref_id || ''), req.user.id);
    if (!p) return fail(res, 404, 'Plate not found.');
    const t = JSON.parse(p.totals);
    entry = { label: p.name, emoji: 'fork-knife', protein: t.protein, fiber: t.fiber, added_sugar: t.added_sugar, carbs: t.carbs, fat: t.fat };
  } else if (b.source === 'scan') {
    const s = db.prepare('SELECT * FROM label_scans WHERE id = ? AND user_id = ?').get(String(b.ref_id || ''), req.user.id);
    if (!s) return fail(res, 404, 'Label not found.');
    entry = { label: s.name, emoji: 'tag', protein: s.protein, fiber: s.fiber, added_sugar: s.added_sugar, carbs: s.total_carbs, fat: s.fat };
  } else if (b.source === 'recipe') {
    const r = N.RECIPE_BY_ID[b.ref_id];
    if (!r) return fail(res, 404, 'Meal not found.');
    entry = { label: r.name, emoji: 'bowl-food', protein: r.protein, fiber: r.fiber, added_sugar: r.added_sugar, carbs: r.carbs, fat: r.fat };
  } else if (b.source === 'manual') {
    const label = String(b.label || '').trim().slice(0, 80);
    if (!label) fields.label = 'What did you eat?';
    entry = { label, emoji: 'note-pencil' };
    for (const k of ['protein', 'fiber', 'added_sugar', 'carbs', 'fat']) {
      const n = b[k] === '' || b[k] == null ? 0 : Number(b[k]);
      if (!Number.isFinite(n) || n < 0 || n > 300) fields[k] = 'Enter 0 to 300.'; else entry[k] = n;
    }
  } else return fail(res, 400, 'Unknown entry type.');
  if (Object.keys(fields).length) return fail(res, 400, 'Please fix the highlighted fields.', fields);
  const id = uid();
  db.prepare(`INSERT INTO food_logs (id, user_id, log_date, meal, label, emoji, protein, fiber, added_sugar, carbs, fat, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, req.user.id, log_date, meal, entry.label, entry.emoji, entry.protein || 0, entry.fiber || 0, entry.added_sugar || 0, entry.carbs || 0, entry.fat || 0, b.source);
  res.status(201).json({ id });
});
api.delete('/logs/:id', writeLimiter, (req, res) => {
  const info = db.prepare('DELETE FROM food_logs WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  info.changes ? res.json({ ok: true }) : fail(res, 404, 'Not found.');
});

// Meal plans: { "0": { breakfast: recipeId, lunch, dinner, snack }, ... "6": {...} } where 0 = Monday
function validSlots(slots) {
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return null;
  const out = {};
  for (let d = 0; d < 7; d++) {
    const day = slots[d] || slots[String(d)] || {};
    out[d] = {};
    for (const m of MEALS) {
      const rid = day[m];
      if (rid == null || rid === '') continue;
      const r = N.RECIPE_BY_ID[rid];
      if (!r) return null;
      out[d][m] = rid;
    }
  }
  return out;
}
const isMonday = s => isDate(s) && new Date(`${s}T00:00:00Z`).getUTCDay() === 1;
api.get('/plans/:week', (req, res) => {
  if (!isMonday(req.params.week)) return fail(res, 400, 'Week must start on a Monday.');
  const p = db.prepare('SELECT slots, updated_at FROM meal_plans WHERE user_id = ? AND week_start = ?').get(req.user.id, req.params.week);
  res.json({ week_start: req.params.week, slots: p ? JSON.parse(p.slots) : {}, updated_at: p ? p.updated_at : null });
});
api.put('/plans/:week', writeLimiter, (req, res) => {
  if (!isMonday(req.params.week)) return fail(res, 400, 'Week must start on a Monday.');
  const slots = validSlots((req.body || {}).slots);
  if (!slots) return fail(res, 400, 'One of those meals wasn’t recognized.');
  db.prepare(`INSERT INTO meal_plans (user_id, week_start, slots, updated_at) VALUES (?,?,?,?)
    ON CONFLICT(user_id, week_start) DO UPDATE SET slots = excluded.slots, updated_at = excluded.updated_at`).run(req.user.id, req.params.week, JSON.stringify(slots), nowIso());
  res.json({ ok: true, slots });
});

// Lessons
api.get('/lessons/:id', (req, res) => {
  const l = LESSONS.find(x => x.id === req.params.id);
  if (!l) return fail(res, 404, 'Not found.');
  const done = !!db.prepare('SELECT 1 FROM lesson_progress WHERE user_id = ? AND lesson_id = ?').get(req.user.id, l.id);
  res.json({ lesson: l, done });
});
api.get('/progress', (req, res) => res.json({ done: db.prepare('SELECT lesson_id FROM lesson_progress WHERE user_id = ?').all(req.user.id).map(r => r.lesson_id) }));
api.post('/lessons/:id/complete', writeLimiter, (req, res) => {
  if (!LESSONS.find(x => x.id === req.params.id)) return fail(res, 404, 'Not found.');
  db.prepare('INSERT OR IGNORE INTO lesson_progress (user_id, lesson_id) VALUES (?,?)').run(req.user.id, req.params.id);
  res.json({ ok: true });
});

// ---------- check-ins, patterns, labs, report ----------
const FOCUS = ['pcos', 'insulin_resistance', 'prediabetes', 'metabolic_syndrome', 'not_sure'];
api.put('/account/focus', writeLimiter, (req, res) => {
  const f = String((req.body || {}).focus || '');
  if (!FOCUS.includes(f)) return fail(res, 400, 'Choose a focus.');
  db.prepare('UPDATE users SET focus = ? WHERE id = ?').run(f, req.user.id);
  res.json({ focus: f });
});
const checkinOut = c => c && ({ ...c, symptoms: JSON.parse(c.symptoms) });
api.get('/checkins/:day', (req, res) => {
  if (!isDate(req.params.day)) return fail(res, 400, 'Invalid date.');
  res.json({ checkin: checkinOut(db.prepare('SELECT * FROM checkins WHERE user_id = ? AND day = ?').get(req.user.id, req.params.day)) || null });
});
api.put('/checkins/:day', writeLimiter, (req, res) => {
  const day = req.params.day, b = req.body || {}, fields = {};
  if (!isDate(day) || Date.parse(day) > Date.now() + 2 * 864e5) return fail(res, 400, 'Invalid date.');
  const v = {};
  for (const k of H.SCALES) {
    if (b[k] == null || b[k] === '') { v[k] = null; continue; }
    const n = Number(b[k]); if (!Number.isInteger(n) || n < 1 || n > 5) fields[k] = 'Choose 1 to 5.'; else v[k] = n;
  }
  const period = b.period == null ? null : String(b.period);
  if (period != null && !['none', 'spotting', 'period'].includes(period)) fields.period = 'Choose an option.';
  const symptoms = Array.isArray(b.symptoms) ? [...new Set(b.symptoms.map(String))] : [];
  if (symptoms.some(x => !H.SYMPTOM_KEYS.includes(x))) fields.symptoms = 'Unknown symptom.';
  const note = b.note == null ? null : String(b.note).slice(0, 500);
  if (Object.keys(fields).length) return fail(res, 400, 'Please fix the highlighted fields.', fields);
  db.prepare(`INSERT INTO checkins (user_id, day, energy, mood, cravings, sleep, period, symptoms, note, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id, day) DO UPDATE SET energy=excluded.energy, mood=excluded.mood, cravings=excluded.cravings, sleep=excluded.sleep, period=excluded.period, symptoms=excluded.symptoms, note=excluded.note, updated_at=excluded.updated_at`)
    .run(req.user.id, day, v.energy, v.mood, v.cravings, v.sleep, period, JSON.stringify(symptoms), note, nowIso());
  res.json({ ok: true });
});
api.get('/insights', (req, res) => {
  const t = isDate(String(req.query.today || '')) ? req.query.today : today();
  res.json(H.insights(req.user.id, t, 30));
});
api.get('/labs', (req, res) => {
  const { rows, latest } = H.latestLabs(req.user.id);
  res.json({ rows: rows.map(H.describeLab), latest: Object.values(latest).map(H.describeLab), metabolic: H.metabolicCheck(latest),
    kinds: Object.fromEntries(Object.entries(H.LABS).map(([k, d]) => [k, { label: d.label, unit: d.unit, step: d.step, two: !!d.two }])) });
});
api.post('/labs', writeLimiter, (req, res) => {
  const r = H.validateLab(req.body || {});
  if (r.fields) return fail(res, 400, 'Please fix the highlighted fields.', r.fields);
  const id = uid(); const v = r.value;
  db.prepare('INSERT INTO labs (id, user_id, kind, value, value2, taken_on) VALUES (?,?,?,?,?,?)').run(id, req.user.id, v.kind, v.value, v.value2, v.taken_on);
  res.status(201).json({ id });
});
api.delete('/labs/:id', writeLimiter, (req, res) => {
  const info = db.prepare('DELETE FROM labs WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  info.changes ? res.json({ ok: true }) : fail(res, 404, 'Not found.');
});
api.get('/report', (req, res) => {
  const t = isDate(String(req.query.today || '')) ? req.query.today : today();
  res.json(H.report(req.user.id, t, 90));
});

// ---------- barcode lookup (Open Food Facts, server-side + cached) ----------
api.get('/products/:code', rateLimit('product', 30, 60e3), async (req, res, next) => {
  const code = String(req.params.code || '');
  if (!/^\d{8,14}$/.test(code)) return fail(res, 400, 'That doesn’t look like a barcode. Barcodes are 8 to 14 digits.');
  try {
    const p = await OFF.lookup(code);
    if (p.notFound) return fail(res, 404, 'We couldn’t find that product. You can type the label in instead.');
    res.json({ product: p });
  } catch (e) {
    console.error('[product lookup]', e.message);
    fail(res, 502, 'The food database isn’t responding right now. You can type the label in instead.');
  }
});

// ---------- 7-day experiments ----------
const expRow = id => db.prepare('SELECT * FROM experiments WHERE id = ?').get(id);
api.get('/experiments', (req, res) => {
  const t = isDate(String(req.query.today || '')) ? req.query.today : today();
  const rows = db.prepare('SELECT * FROM experiments WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(req.user.id);
  // auto-complete experiments whose 7 days are over
  for (const r of rows) if (r.status === 'active' && t > X.addDays(r.started_on, 6)) {
    db.prepare("UPDATE experiments SET status = 'done', ended_on = ? WHERE id = ? AND user_id = ?").run(X.addDays(r.started_on, 6), r.id, req.user.id);
    r.status = 'done'; r.ended_on = X.addDays(r.started_on, 6);
  }
  const active = rows.find(r => r.status === 'active');
  res.json({ catalog: X.EXPERIMENTS, active: active ? X.results(req.user.id, active, t) : null,
    history: rows.filter(r => r.status !== 'active').map(r => X.results(req.user.id, r, t)) });
});
api.post('/experiments', writeLimiter, (req, res) => {
  const key = String((req.body || {}).key || ''), start = String((req.body || {}).today || today());
  if (!X.BY_KEY[key]) return fail(res, 400, 'Choose an experiment.');
  if (!isDate(start)) return fail(res, 400, 'Invalid date.');
  db.prepare("UPDATE experiments SET status = 'stopped', ended_on = ? WHERE user_id = ? AND status = 'active'").run(start, req.user.id);
  const id = uid();
  db.prepare('INSERT INTO experiments (id, user_id, key, started_on) VALUES (?,?,?,?)').run(id, req.user.id, key, start);
  res.status(201).json({ id });
});
api.put('/experiments/:id/days/:day', writeLimiter, (req, res) => {
  const e = expRow(req.params.id);
  if (!e || e.user_id !== req.user.id) return fail(res, 404, 'Not found.');
  const day = req.params.day;
  if (!isDate(day) || day < e.started_on || day > X.addDays(e.started_on, 6)) return fail(res, 400, 'That day isn’t part of this experiment.');
  if ((req.body || {}).done === true) db.prepare('INSERT OR IGNORE INTO experiment_days (experiment_id, day) VALUES (?,?)').run(e.id, day);
  else db.prepare('DELETE FROM experiment_days WHERE experiment_id = ? AND day = ?').run(e.id, day);
  res.json({ ok: true });
});
api.post('/experiments/:id/stop', writeLimiter, (req, res) => {
  const info = db.prepare("UPDATE experiments SET status = 'stopped', ended_on = ? WHERE id = ? AND user_id = ? AND status = 'active'").run(today(), req.params.id, req.user.id);
  info.changes ? res.json({ ok: true }) : fail(res, 404, 'Not found.');
});

// ---------- calendar reminders (.ics works on iPhone, Android and desktop with no app install) ----------
const REMINDERS = {
  checkin: { title: 'Better Plate: 20-second check-in', desc: 'How are you today? Tap energy, mood, cravings and sleep.', rule: 'FREQ=DAILY', path: '/app#/today' },
  walk: { title: 'Better Plate: 10-minute walk after dinner', desc: 'A short walk after your biggest meal helps your muscles use glucose.', rule: 'FREQ=DAILY', path: '/app#/me/experiments' },
  plan: { title: 'Better Plate: plan your week', desc: 'Fill your week and get your grocery list.', rule: 'FREQ=WEEKLY;BYDAY=SU', path: '/app#/plan' },
};
api.get('/reminders.ics', (req, res) => {
  const r = REMINDERS[req.query.type];
  const time = String(req.query.time || '');
  if (!r || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return fail(res, 400, 'Choose a reminder and a time.');
  const d = today().replace(/-/g, ''), hm = time.replace(':', '');
  const esc = t => t.replace(/[\;,]/g, m => '\\' + m);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${CFG.APP_NAME}//Reminders//EN`, 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${uid()}@betterplate`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${d}T${hm}00`, 'DURATION:PT10M', `RRULE:${r.rule}`, `SUMMARY:${esc(r.title)}`,
    `DESCRIPTION:${esc(r.desc + ' ' + CFG.BASE_URL + r.path)}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(r.title)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  res.setHeader('Content-Disposition', `attachment; filename="better-plate-${req.query.type}.ics"`);
  res.type('text/calendar').send(ics);
});

// Account
api.put('/account/marketing', writeLimiter, (req, res) => {
  const v = (req.body || {}).marketing_opt_in === true ? 1 : 0;
  db.prepare('UPDATE users SET marketing_opt_in = ? WHERE id = ?').run(v, req.user.id);
  res.json({ marketing_opt_in: !!v });
});
api.get('/account/export', (req, res) => {
  const id = req.user.id;
  const data = {
    exported_at: nowIso(),
    account: db.prepare('SELECT email, name, marketing_opt_in, created_at FROM users WHERE id = ?').get(id),
    targets: db.prepare('SELECT protein, fiber, added_sugar FROM targets WHERE user_id = ?').get(id),
    label_scans: db.prepare('SELECT * FROM label_scans WHERE user_id = ?').all(id).map(scanOut),
    plates: db.prepare('SELECT * FROM plates WHERE user_id = ?').all(id).map(plateOut),
    food_logs: db.prepare('SELECT * FROM food_logs WHERE user_id = ?').all(id),
    meal_plans: db.prepare('SELECT week_start, slots, updated_at FROM meal_plans WHERE user_id = ?').all(id).map(p => ({ ...p, slots: JSON.parse(p.slots) })),
    lesson_progress: db.prepare('SELECT lesson_id, completed_at FROM lesson_progress WHERE user_id = ?').all(id),
    checkins: db.prepare('SELECT * FROM checkins WHERE user_id = ?').all(id).map(checkinOut),
    labs: db.prepare('SELECT kind, value, value2, taken_on FROM labs WHERE user_id = ?').all(id),
    experiments: db.prepare('SELECT key, started_on, status, ended_on FROM experiments WHERE user_id = ?').all(id),
    signup_consents: db.prepare('SELECT terms_version, privacy_version, marketing_opt_in, created_at FROM signup_consents WHERE user_id = ?').all(id),
    photos: db.prepare('SELECT id, mime, size, created_at FROM uploads WHERE user_id = ?').all(id),
  };
  res.setHeader('Content-Disposition', 'attachment; filename="my-data.json"');
  res.json(data);
});
api.delete('/account', rateLimit('delete', 5, 60 * 60e3), (req, res) => {
  const pw = String((req.body || {}).password || '');
  const u = db.prepare('SELECT pass_hash FROM users WHERE id = ?').get(req.user.id);
  if (!u || !verifyPassword(pw, u.pass_hash)) return fail(res, 401, 'That password isn’t right.', { password: 'Incorrect password.' });
  const id = req.user.id;
  // Personal data and files are removed. Kept (legal record): consent_records and signup_consents rows,
  // which hold only an anonymous id and versions, and data_requests the person sent.
  fs.rmSync(path.join(UPLOAD_DIR, id), { recursive: true, force: true });
  db.prepare('DELETE FROM users WHERE id = ?').run(id); // cascades to sessions, scans, plates, logs, plans, targets, uploads, progress
  setCookie(res, 'sid', '', { maxAge: 0 });
  res.json({ ok: true });
});

app.use('/api', api);

// ---------- admin (owner only) ----------
const admin = express.Router();
admin.use(requireOwner);
function consentQuery(q) {
  const where = []; const args = [];
  if (isDate(String(q.from || ''))) { where.push('created_at >= ?'); args.push(`${q.from}T00:00:00.000Z`); }
  if (isDate(String(q.to || ''))) { where.push('created_at <= ?'); args.push(`${q.to}T23:59:59.999Z`); }
  return db.prepare(`SELECT * FROM consent_records ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 5000`).all(...args);
}
function csv(rows, cols) {
  const cell = v => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}
const sendCsv = (res, name, rows, cols) => { res.setHeader('Content-Disposition', `attachment; filename="${name}-${today()}.csv"`); res.type('text/csv').send(csv(rows, cols)); };
const CONSENT_COLS = ['id', 'visitor_id', 'user_id', 'choice', 'categories', 'banner_version', 'policy_version', 'region', 'gpc', 'created_at', 'user_agent'];
const SIGNUP_COLS = ['user_id', 'terms_version', 'privacy_version', 'marketing_opt_in', 'created_at'];
const REQ_COLS = ['id', 'email', 'type', 'status', 'details', 'created_at', 'completed_at', 'notes'];
admin.get('/consents', (req, res) => res.json({ rows: consentQuery(req.query) }));
admin.get('/consents.csv', (req, res) => sendCsv(res, 'consent-log', consentQuery(req.query), CONSENT_COLS));
admin.get('/signups', (req, res) => res.json({ rows: db.prepare('SELECT * FROM signup_consents ORDER BY created_at DESC LIMIT 5000').all() }));
admin.get('/signups.csv', (req, res) => sendCsv(res, 'signup-consents', db.prepare('SELECT * FROM signup_consents ORDER BY created_at DESC').all(), SIGNUP_COLS));
admin.get('/requests', (req, res) => res.json({ rows: db.prepare('SELECT * FROM data_requests ORDER BY created_at DESC LIMIT 5000').all() }));
admin.get('/requests.csv', (req, res) => sendCsv(res, 'data-requests', db.prepare('SELECT * FROM data_requests ORDER BY created_at DESC').all(), REQ_COLS));
admin.put('/requests/:id', (req, res) => {
  const status = String((req.body || {}).status || '');
  if (!['new', 'in_progress', 'done'].includes(status)) return fail(res, 400, 'Invalid status.');
  const notes = (req.body || {}).notes != null ? String(req.body.notes).slice(0, 2000) : null;
  const info = db.prepare(`UPDATE data_requests SET status = ?, completed_at = ?, notes = COALESCE(?, notes) WHERE id = ?`)
    .run(status, status === 'done' ? nowIso() : null, notes, req.params.id);
  info.changes ? res.json({ ok: true }) : fail(res, 404, 'Not found.');
});
admin.get('/outbox', (req, res) => res.json({ rows: db.prepare('SELECT id, to_addr, subject, status, created_at FROM email_outbox ORDER BY id DESC LIMIT 200').all() }));
app.use('/api/admin', admin);

// ---------- errors ----------
app.use('/api', (req, res) => fail(res, 404, 'Not found.'));
app.use((req, res) => res.status(404).type('html').send(P.errorPage({ user: req.user, code: 404, message: 'That page doesn’t exist. Let’s get you back on track.' })));
// Never leak stack traces to users.
app.use((err, req, res, _next) => {
  console.error('[error]', req.method, req.path, err && err.message);
  if (err && err.type === 'entity.parse.failed') return fail(res, 400, 'That request couldn’t be read.');
  if (err && err.type === 'entity.too.large') return fail(res, 413, 'That request is too large.');
  if (req.path.startsWith('/api')) return fail(res, 500, 'Something went wrong on our end. Please try again.');
  res.status(500).type('html').send(P.errorPage({ user: req.user, code: 500, message: 'Something went wrong on our end. Please try again.' }));
});

if (require.main === module) app.listen(CFG.PORT, () => console.log(`${CFG.APP_NAME} running on ${CFG.BASE_URL}`));
module.exports = app;
