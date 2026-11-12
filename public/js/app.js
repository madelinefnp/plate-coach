// Better Plate app (signed-in). Hash routes: #/today #/scan #/scan/:id #/scan/:id/edit #/plate #/plate/:id #/plate/:id/edit #/plan #/learn #/learn/:id #/account
(function () {
  'use strict';
  var view = document.getElementById('view');
  var state = { catalog: null, me: null, date: localDate(new Date()) };

  // ---------- utils ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function localDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return localDate(d); }
  function monday(s) { var d = new Date(s + 'T12:00:00'); var wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return localDate(d); }
  function prettyDate(s, opts) { return new Date(s + 'T12:00:00').toLocaleDateString(undefined, opts || { weekday: 'long', month: 'short', day: 'numeric' }); }
  function r0(n) { return Math.round(n || 0); }
  function pl(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  var MEALS = [['breakfast', 'Breakfast', 'sun-horizon'], ['lunch', 'Lunch', 'sun'], ['dinner', 'Dinner', 'moon'], ['snack', 'Snack', 'acorn']];
  var HABITS = [
    ['leaf', 'Veggies first', 'Eat a few bites of veggies or a small salad before the rest of your meal today.'],
    ['list-numbers', 'Eat in order', 'Veggies, then protein and fat, then the starchy or sweet part last.'],
    ['sun-horizon', 'Protein-forward breakfast', 'Start with real protein, like eggs and greens or Greek yogurt with nuts.'],
    ['egg', 'Pair your carbs', 'Don\u2019t eat carbs on their own today. Add protein, fat or fiber.'],
    ['cookie', 'Sweets after a meal', 'If you want something sweet, have it as dessert instead of an afternoon snack.'],
    ['person-simple-walk', 'Move after eating', 'Ten easy minutes after your biggest meal. A walk counts. So do the dishes.'],
  ];
  function mealFor(hour) { return hour < 10 ? 'breakfast' : hour < 15 ? 'lunch' : hour < 21 ? 'dinner' : 'snack'; }

  function api(method, url, body, isForm) {
    var headers = { 'X-Requested-With': 'fetch' };
    if (body && !isForm) headers['Content-Type'] = 'application/json';
    return fetch('/api' + url, { method: method, credentials: 'same-origin', headers: headers, body: body ? (isForm ? body : JSON.stringify(body)) : undefined })
      .then(function (r) {
        if (r.status === 401) { location.href = '/login?next=/app'; throw new Error('Please log in.'); }
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) { var e = new Error(d.error || 'Something went wrong. Please try again.'); e.fields = d.fields || {}; e.status = r.status; throw e; }
          return d;
        });
      }, function () { var e = new Error('You seem to be offline. Check your connection and try again.'); e.fields = {}; throw e; });
  }
  function fieldErrors(form, err) {
    form.querySelectorAll('.field-error').forEach(function (n) { n.remove(); });
    form.querySelectorAll('[aria-invalid]').forEach(function (n) { n.removeAttribute('aria-invalid'); });
    var box = form.querySelector('.form-error');
    if (!err) { if (box) box.hidden = true; return; }
    Object.keys(err.fields || {}).forEach(function (k) {
      var input = form.querySelector('[name="' + k + '"]');
      if (!input) return;
      input.setAttribute('aria-invalid', 'true');
      var p = document.createElement('span'); p.className = 'field-error'; p.textContent = err.fields[k];
      (input.closest('label') || input).appendChild(p);
    });
    if (box) { box.textContent = err.message; box.hidden = false; }
  }
  var toastTimer;
  function toast(msg, bad) {
    var t = document.querySelector('.toast') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toast' }));
    t.setAttribute('role', 'status'); t.textContent = msg; t.classList.toggle('bad', !!bad); t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }
  function errorView(e) { view.innerHTML = '<div class="empty">' + icon('warning', 'big-icon') + '<h2>That didn’t load</h2><p>' + esc(e.message) + '</p><a class="btn" href="#/today">Back to Today</a></div>'; }
  function loading() { view.innerHTML = '<div class="loading" aria-busy="true">Loading…</div>'; }

  function bar(label, emoji, val, target, kind) {
    var pct = target ? Math.min(100, (val / target) * 100) : 0;
    var over = kind === 'limit' && val > target;
    var note = kind === 'limit' ? (over ? r0(val - target) + 'g over your limit' : r0(target - val) + 'g left under your limit') : (val >= target ? 'Goal reached' : r0(target - val) + 'g to go');
    return '<div class="meter ' + (kind === 'limit' ? 'limit' : 'goal') + (over ? ' over' : '') + '">' +
      '<div class="meter-top"><span class="meter-emoji">' + icon(emoji) + '</span><b>' + label + '</b><span class="meter-num">' + r0(val) + ' / ' + r0(target) + 'g</span></div>' +
      '<div class="meter-track" role="progressbar" aria-label="' + label + '" aria-valuemin="0" aria-valuemax="' + r0(target) + '" aria-valuenow="' + r0(val) + '"><div class="meter-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="meter-note small">' + note + '</div></div>';
  }
  function macroChips(t) {
    return '<dl class="macros"><div class="c-protein"><dt>Protein</dt><dd>' + r0(t.protein) + 'g</dd></div><div class="c-fiber"><dt>Fiber</dt><dd>' + r0(t.fiber) + 'g</dd></div>' +
      '<div class="c-carbs"><dt>Carbs</dt><dd>' + r0(t.carbs != null ? t.carbs : t.total_carbs) + 'g</dd></div><div class="c-fat"><dt>Fat</dt><dd>' + r0(t.fat) + 'g</dd></div>' +
      '<div class="c-sugar"><dt>Added sugar</dt><dd>' + r0(t.added_sugar) + 'g</dd></div></dl>';
  }
  // Evidence label + numbered source links (sources live on /evidence).
  function evidence(level, refs) {
    var ev = state.catalog && state.catalog.evidence; if (!ev) return '';
    var L = level && ev.levels[level];
    var links = (refs || []).map(function (id) { var r = ev.refs[id]; return r ? '<a class="ev-ref" href="/evidence#ref-' + id + '" target="_blank" rel="noopener" title="' + esc(r.cite) + '" aria-label="Source ' + r.n + ': ' + esc(r.cite) + '">' + r.n + '</a>' : ''; }).join('');
    if (!L && !links) return '';
    return '<p class="ev-line">' + (L ? '<span class="ev ev-' + level + '" title="' + esc(L.text) + '">' + esc(L.label) + '</span>' : '') + (links ? '<span class="ev-refs">Sources ' + links + '</span>' : '') + '</p>';
  }
  function scoreRing(score, key) { return '<div class="score-ring ' + key + '" style="--pct:' + score + '"><span>' + score + '</span></div>'; }

  // Plate composition picture: ideal vs yours, as donut charts.
  function donut(parts, label) {
    var colors = { veg: 'var(--lime)', protein: 'var(--pink)', carbs: 'var(--peri)', other: 'var(--org)' };
    var acc = 0, segs = '';
    ['veg', 'protein', 'carbs', 'other'].forEach(function (k) {
      var v = parts[k] || 0; if (!v) return;
      segs += '<circle r="15.9" cx="21" cy="21" fill="none" stroke="' + colors[k] + '" stroke-width="7" stroke-dasharray="' + v + ' ' + (100 - v) + '" stroke-dashoffset="' + (25 - acc) + '"></circle>';
      acc += v;
    });
    return '<figure class="donut"><svg viewBox="0 0 42 42" role="img" aria-label="' + esc(label) + ': veggies ' + r0(parts.veg) + '%, protein ' + r0(parts.protein) + '%, carbs ' + r0(parts.carbs) + '%"><circle r="15.9" cx="21" cy="21" fill="none" stroke="var(--line)" stroke-width="7"></circle>' + segs + '</svg><figcaption>' + esc(label) + '</figcaption></figure>';
  }
  var legend = '<div class="legend small"><span><i style="background:var(--lime)"></i>Veggies</span><span><i style="background:var(--pink)"></i>Protein</span><span><i style="background:var(--peri)"></i>Carbs</span><span><i style="background:var(--org)"></i>Fat, fruit, sweets</span></div>';

  function photoPicker(currentId) {
    return '<div class="photo-pick"><label class="photo-drop">' +
      (currentId ? '<img alt="Your photo" src="/api/uploads/' + esc(currentId) + '">' : icon('camera', 'big-icon') + '<span>Add a photo (optional)</span><span class="tiny muted">JPG, PNG or WebP, up to 5 MB. Only you can see it.</span>') +
      '<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" name="photo" class="sr-only"></label>' +
      '<input type="hidden" name="photo_id" value="' + esc(currentId || '') + '"><p class="photo-error field-error-static" role="alert" hidden></p></div>';
  }
  function bindPhoto(root) {
    var input = root.querySelector('input[type=file][name=photo]'); if (!input) return;
    input.addEventListener('change', function () {
      var file = input.files[0]; if (!file) return;
      var errEl = root.querySelector('.photo-pick .photo-error'); errEl.hidden = true;
      if (file.size > 5 * 1024 * 1024) { errEl.textContent = 'Photos must be 5 MB or smaller.'; errEl.hidden = false; return; }
      var fd = new FormData(); fd.append('photo', file);
      var drop = root.querySelector('.photo-drop'); drop.classList.add('busy');
      api('POST', '/uploads', fd, true).then(function (d) {
        root.querySelector('[name=photo_id]').value = d.id;
        drop.querySelectorAll(':scope > :not(input)').forEach(function (n) { n.remove(); });
        var img = document.createElement('img'); img.alt = 'Your photo'; img.src = '/api/uploads/' + d.id; drop.prepend(img);
      }).catch(function (e) { errEl.textContent = e.message; errEl.hidden = false; }).finally(function () { drop.classList.remove('busy'); });
    });
  }

  // ---------- TODAY ----------
  function renderToday() {
    loading();
    var d = state.date;
    Promise.all([api('GET', '/day/' + d), api('GET', '/plans/' + monday(d)), api('GET', '/checkins/' + d), api('GET', '/experiments?today=' + localDate(new Date()))]).then(function (res) {
      var expA = res[3].active;
      var day = res[0], plan = res[1], t = day.targets, tot = day.totals;
      checkinState = Object.assign({ day: d, energy: null, mood: null, cravings: null, sleep: null, period: null, symptoms: [] }, res[2].checkin || {}, { day: d });
      var dayIdx = (new Date(d + 'T12:00:00').getDay() + 6) % 7;
      var planned = (plan.slots && plan.slots[dayIdx]) || {};
      var isToday = d === localDate(new Date());
      var hb = HABITS[Math.floor(new Date(d + 'T12:00:00').getTime() / 864e5) % HABITS.length];
      var html = '<p class="q">Your day so far</p><div class="date-nav"><button class="icon-btn" data-day="-1" aria-label="Previous day">' + icon('caret-left') + '</button><h1>' + (isToday ? 'Today' : esc(prettyDate(d))) + '<span class="small muted">' + (isToday ? esc(prettyDate(d)) : '') + '</span></h1><button class="icon-btn" data-day="1" aria-label="Next day">' + icon('caret-right') + '</button></div>' +
        '<section class="meters">' + bar('Protein', 'egg', tot.protein, t.protein, 'goal') + bar('Fiber', 'leaf', tot.fiber, t.fiber, 'goal') + bar('Added sugar', 'cookie', tot.added_sugar, t.added_sugar, 'limit') + '</section>' +
        checkinCard() +
        (expA ? '<section class="exp-strip ' + expA.def.color + '-soft"><span class="ask-ic ' + expA.def.color + '">' + icon(expA.def.icon) + '</span><div><span class="kicker">Experiment \u00B7 day ' + expA.dayNumber + ' of 7</span><b>' + esc(expA.def.title) + '</b><span class="small">' + esc(expA.def.daily) + '</span></div>' +
          (expA.def.auto === 'fiber' ? '<a class="btn btn-tiny btn-ghost" href="#/me/experiments">See progress</a>' : (expA.days.some(function (x) { return x.day === localDate(new Date()) && x.done; }) ? '<span class="pill done">' + icon('check') + ' Done today</span>' : '<button class="btn btn-tiny" data-exp-today="' + expA.id + '" data-exp-date="' + localDate(new Date()) + '">I did it today</button>')) + '</section>' : '') +
        '<p class="q">What do you want to do?</p><div class="ask-list">' +
          ask('#/scan', 'barcode', 'c-org', 'Is this food a good pick?', 'Scan a label: what\u2019s in it and what\u2019s been done to it') +
          ask('#/plate', 'fork-knife', 'c-lime', 'Is my plate balanced?', 'Tap your foods, get tips') +
          ask('#/plan', 'calendar-blank', 'c-peri', 'What should I eat this week?', 'Plan meals and get your grocery list') +
          ask('#/plan/staples', 'basket', 'c-pink', 'Is my kitchen set up?', 'Staples, snacks and simple swaps') +
          ask('#/me', 'user-focus', 'c-lime', 'How am I actually doing?', 'Your patterns, cycle, labs and wins that aren\u2019t the scale') +
          (expA ? '' : ask('#/me/experiments', 'flask', 'c-org', 'What works for my body?', 'Try a 7-day experiment and see how you feel')) +
          ask('#/me/report', 'clipboard-text', 'c-peri', 'Ready for my appointment?', 'A one-page summary to bring to your clinician') +
          ask('#/learn', 'book-open', 'c-ink', 'Why does this work?', state.catalog.lessons.length + ' short, research-backed lessons') +
        '</div>' +
        '<aside class="habit-card">' + icon(hb[0]) + '<div><span class="kicker">Habit of the day</span><b>' + esc(hb[1]) + '</b><p class="small">' + esc(hb[2]) + '</p></div><a class="small" href="#/learn/steady-habits">See the evidence</a></aside>' +
        '<div class="section-row"><div><p class="q">Food log</p><h2 class="h2">Today\u2019s meals</h2></div><button class="btn btn-small" data-add="' + mealFor(new Date().getHours()) + '">' + icon('plus') + ' Log food</button></div>';
      MEALS.forEach(function (m) {
        var logs = day.logs.filter(function (l) { return l.meal === m[0]; });
        var rid = planned[m[0]], rec = rid && recipe(rid);
        html += '<section class="meal-card"><div class="meal-head"><h2>' + icon(m[2]) + ' ' + m[1] + '</h2><button class="btn btn-tiny btn-ghost" data-add="' + m[0] + '">+ Add</button></div>';
        if (logs.length) html += '<ul class="log-list">' + logs.map(function (l) {
          return '<li><span class="log-emoji">' + icon(window.ICONS[l.emoji] ? l.emoji : 'bowl-food') + '</span><div class="log-main"><b>' + esc(l.label) + '</b><span class="tiny muted">' + r0(l.protein) + 'g protein · ' + r0(l.fiber) + 'g fiber · ' + r0(l.added_sugar) + 'g added sugar</span></div><button class="icon-btn small" data-del-log="' + esc(l.id) + '" aria-label="Remove ' + esc(l.label) + '">' + icon('x') + '</button></li>';
        }).join('') + '</ul>';
        else if (!rec) html += '<p class="muted small">Nothing logged yet.</p>';
        if (rec && !logs.some(function (l) { return l.label === rec.name; })) html += '<div class="planned">' + icon('calendar-blank') + '<span class="small">Planned: <b>' + esc(rec.name) + '</b></span><button class="btn btn-tiny" data-log-recipe="' + rec.id + '" data-meal="' + m[0] + '">I ate this</button></div>';
        html += '</section>';
      });
      html += '<p class="center small"><a href="#/account">Change my daily targets</a></p>';
      view.innerHTML = html;
    }).catch(errorView);
  }
  function ask(href, ic, cls, title, sub) {
    return '<a class="ask" href="' + href + '"><span class="ask-ic ' + cls + '">' + icon(ic) + '</span><span class="ask-t"><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></span><span class="chev" aria-hidden="true">' + icon('caret-right') + '</span></a>';
  }
  function recipe(id) { return state.catalog.recipes.find(function (r) { return r.id === id; }); }

  function openAddSheet(meal) {
    Promise.all([api('GET', '/plates'), api('GET', '/scans')]).then(function (res) {
      var plates = res[0].plates, scans = res[1].scans;
      var sheet = document.createElement('div');
      sheet.className = 'sheet-backdrop';
      sheet.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><div class="sheet-head"><h2 id="sheet-title">Log food</h2><button class="icon-btn" data-close aria-label="Close">' + icon('x') + '</button></div>' +
        '<label>Meal<select name="meal">' + MEALS.map(function (m) { return '<option value="' + m[0] + '"' + (m[0] === meal ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select></label>' +
        '<div class="tabs small-tabs" role="tablist"><button role="tab" class="tab on" data-st="recipes">Meal ideas</button><button role="tab" class="tab" data-st="plates">My plates</button><button role="tab" class="tab" data-st="scans">My labels</button><button role="tab" class="tab" data-st="manual">Type it</button></div>' +
        '<div data-sp="recipes" class="pick-list">' + state.catalog.recipes.map(function (r) { return '<button class="pick" data-src="recipe" data-ref="' + r.id + '">' + icon('bowl-food') + '<span>' + esc(r.name) + '<span class="tiny muted">' + r.protein + 'g protein · ' + r.fiber + 'g fiber</span></span></button>'; }).join('') + '</div>' +
        '<div data-sp="plates" class="pick-list" hidden>' + (plates.length ? plates.map(function (p) { return '<button class="pick" data-src="plate" data-ref="' + esc(p.id) + '">' + icon('fork-knife') + '<span>' + esc(p.name) + '<span class="tiny muted">' + r0(p.totals.protein) + 'g protein · ' + r0(p.totals.fiber) + 'g fiber</span></span></button>'; }).join('') : '<p class="muted small">No saved plates yet. <a href="#/plate">Build one</a>.</p>') + '</div>' +
        '<div data-sp="scans" class="pick-list" hidden>' + (scans.length ? scans.map(function (s) { return '<button class="pick" data-src="scan" data-ref="' + esc(s.id) + '">' + icon('tag') + '<span>' + esc(s.name) + ' (1 serving)<span class="tiny muted">Score ' + s.score + '</span></span></button>'; }).join('') : '<p class="muted small">No scanned labels yet. <a href="#/scan">Scan one</a>.</p>') + '</div>' +
        '<form data-sp="manual" class="form" hidden novalidate><label>What did you eat?<input name="label" maxlength="80" required></label><div class="grid-3">' +
        ['protein', 'fiber', 'added_sugar', 'carbs', 'fat'].map(function (k) { return '<label>' + ({ protein: 'Protein', fiber: 'Fiber', added_sugar: 'Added sugar', carbs: 'Carbs', fat: 'Fat' })[k] + ' (g)<input name="' + k + '" inputmode="decimal" placeholder="0"></label>'; }).join('') +
        '</div><button class="btn">Log it</button><p class="form-error" role="alert" hidden></p></form></div>';
      document.body.appendChild(sheet);
      var close = function () { sheet.remove(); };
      sheet.querySelector('[data-close]').focus();
      sheet.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      sheet.addEventListener('click', function (e) {
        if (e.target === sheet || e.target.closest('[data-close]')) return close();
        var tab = e.target.closest('[data-st]');
        if (tab) { sheet.querySelectorAll('[data-st]').forEach(function (t) { t.classList.toggle('on', t === tab); }); sheet.querySelectorAll('[data-sp]').forEach(function (p) { p.hidden = p.dataset.sp !== tab.dataset.st; }); return; }
        var pick = e.target.closest('.pick');
        if (pick) logEntry({ source: pick.dataset.src, ref_id: pick.dataset.ref, meal: sheet.querySelector('[name=meal]').value }).then(close).catch(function (er) { toast(er.message, true); });
        if (e.target.closest('a')) close();
      });
      sheet.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault(); var f = e.target; var body = Object.fromEntries(new FormData(f));
        body.source = 'manual'; body.meal = sheet.querySelector('[name=meal]').value;
        fieldErrors(f, null);
        logEntry(body).then(close).catch(function (er) { fieldErrors(f, er); });
      });
    }).catch(function (e) { toast(e.message, true); });
  }
  function logEntry(body) {
    body.log_date = body.log_date || state.date;
    return api('POST', '/logs', body).then(function () { toast('Logged'); if (route()[0] === 'today') renderToday(); });
  }

  // ---------- SCAN ----------
  function scanForm(s) {
    s = s || {};
    var v = function (k) { return s[k] == null ? '' : esc(s[k]); };
    return '<form id="scan-form" class="card form" novalidate>' +
      '<div class="label-hint">' + icon('barcode') + '<p class="small">Flip the package over and find the <b>Nutrition Facts</b> panel. Use the numbers for <b>one serving</b>.</p></div>' +
      '<label>Food name<input name="name" required maxlength="120" value="' + v('name') + '" placeholder="e.g. Granola bar"></label>' +
      '<label>Serving size (optional)<input name="serving" maxlength="60" value="' + v('serving') + '" placeholder="e.g. 1 bar (40g)"></label>' +
      '<div class="grid-2">' +
      '<label>Added sugars (g)<input name="added_sugar" inputmode="decimal" required value="' + v('added_sugar') + '"></label>' +
      '<label>Dietary fiber (g)<input name="fiber" inputmode="decimal" required value="' + v('fiber') + '"></label>' +
      '<label>Protein (g)<input name="protein" inputmode="decimal" required value="' + v('protein') + '"></label>' +
      '<label>Total carbs (g)<input name="total_carbs" inputmode="decimal" required value="' + v('total_carbs') + '"></label>' +
      '<label>Total fat (g, optional)<input name="fat" inputmode="decimal" value="' + v('fat') + '"></label></div>' +
      '<label>Ingredients (optional, needed to check what\u2019s been done to it)<textarea name="ingredients" rows="3" maxlength="3000" placeholder="Paste or type the ingredients list">' + v('ingredients') + '</textarea></label>' +
      (s.id ? '' : photoPicker(null)) +
      '<button class="btn btn-block">' + (s.id ? 'Save changes' : 'Get my score') + '</button><p class="form-error" role="alert" hidden></p></form>';
  }
  var PROC = { whole: ['Whole food', 'c-lime'], minimal: ['Minimally processed', 'c-lime'], processed: ['Processed', 'c-peri'], ultra: ['Ultra-processed signs', 'c-org'], unknown: ['Processing not checked', 'c-mute'] };
  function procBadge(p) { p = p || { level: 'unknown' }; var x = PROC[p.level] || PROC.unknown; return '<span class="proc ' + x[1] + '">' + esc(x[0]) + '</span>'; }
  function needsSwap(s) { return (s.result.processing && s.result.processing.level === 'ultra') || s.score < 40; }
  function renderScan() {
    loading();
    api('GET', '/scans').then(function (d) {
      var k = state.catalog.kitchen;
      var swap = d.scans.filter(needsSwap), keep = d.scans.filter(function (s) { return !needsSwap(s); });
      var row = function (s) {
        return '<li><a class="row-card" href="#/scan/' + esc(s.id) + '">' + scoreRing(s.score, s.result.grade.key) + '<div><b>' + esc(s.name) + '</b><span class="small grade-label ' + s.result.grade.key + '">' + icon(s.result.grade.icon || 'check') + ' ' + esc(s.result.grade.label) + '</span>' + procBadge(s.result.processing) + '</div><span class="chev" aria-hidden="true">' + icon('caret-right') + '</span></a></li>';
      };
      view.innerHTML = '<p class="q">Is this food a good pick?</p><h1>Check a label</h1>' +
        '<div class="two-q">' + k.LABEL_CHECKS.map(function (c) { return '<div class="tq">' + icon(c.icon) + '<div><b>' + esc(c.q) + '</b><p class="small">' + esc(c.text) + '</p></div></div>'; }).join('') + '</div>' +
        '<section class="barcode card"><div><p class="q">Fastest way</p><h2 class="h2">Scan the barcode</h2><p class="small muted">We look it up in the free Open Food Facts database and fill in the label for you to check.</p></div>' +
          '<div class="bc-actions"><button type="button" class="btn" data-scan-camera>' + icon('barcode') + ' Scan with camera</button>' +
          '<form class="bc-manual" data-bc-form novalidate><label class="sr-only" for="bc-code">Barcode number</label><input id="bc-code" name="code" inputmode="numeric" autocomplete="off" placeholder="or type the barcode number" maxlength="14"><button class="btn btn-ghost btn-small">Look up</button></form></div>' +
          '<div class="bc-result" aria-live="polite"></div></section>' +
        '<p class="q or-type">Or type the label yourself</p>' +
        scanForm() +
        '<div class="section-row"><div><p class="q">Pantry check</p><h2 class="h2">My pantry</h2></div></div>' +
        (d.scans.length ?
          (swap.length ? '<h3 class="h3 sub-h">' + icon('arrows-clockwise') + ' Swap when it runs out <span class="count">' + swap.length + '</span></h3><ul class="card-list">' + swap.map(row).join('') + '</ul>' : '') +
          (keep.length ? '<h3 class="h3 sub-h">' + icon('check-circle') + ' Keep <span class="count">' + keep.length + '</span></h3><ul class="card-list">' + keep.map(row).join('') + '</ul>' : '')
          : '<div class="empty small">' + icon('basket', 'big-icon') + '<p>Scan a few things from your pantry. They\u2019ll be sorted into \u201Ckeep\u201D and \u201Cswap when it runs out.\u201D</p></div>');
      bindScanForm(null);
    }).catch(errorView);
  }
  function bindScanForm(id) {
    var f = document.getElementById('scan-form');
    bindPhoto(f);
    f.addEventListener('submit', function (e) {
      e.preventDefault(); fieldErrors(f, null);
      var body = Object.fromEntries(new FormData(f)); delete body.photo;
      if (!body.photo_id) delete body.photo_id;
      var btn = f.querySelector('button.btn'); btn.disabled = true;
      api(id ? 'PUT' : 'POST', '/scans' + (id ? '/' + id : ''), body).then(function (d) { location.hash = '#/scan/' + d.id; })
        .catch(function (er) { fieldErrors(f, er); btn.disabled = false; });
    });
  }
  function processingBlock(p) {
    p = p || { level: 'unknown', note: 'Edit this label and add the ingredients to check processing.', found: [] };
    return '<div class="proc-box"><p class="q">What\u2019s been done to it?</p><div class="proc-head">' + procBadge(p) + '</div><p>' + esc(p.note) + '</p>' +
      (p.found && p.found.length ? '<ul class="proc-list">' + p.found.map(function (f) { return '<li><b>' + esc(f.group) + ':</b> ' + esc(f.items.join(', ')) + '<span class="small muted"> ' + esc(f.why) + '</span></li>'; }).join('') + '</ul>' : '') +
      evidence(null, ['monteiro2019', 'hall2019']) + '<p class="small"><a href="#/learn/real-food">Why processing matters</a></p></div>';
  }
  function renderScanDetail(id, edit) {
    loading();
    api('GET', '/scans/' + id).then(function (d) {
      var s = d.scan, r = s.result;
      if (edit) { view.innerHTML = '<a class="back" href="#/scan/' + esc(id) + '">‹ Back</a><h1>Edit label</h1>' + scanForm(s); return bindScanForm(id); }
      view.innerHTML = '<a class="back" href="#/scan">‹ All labels</a>' +
        '<div class="card result-card"><p class="q">What\u2019s in it?</p><div class="result-head">' + scoreRing(s.score, r.grade.key) + '<div><h1>' + esc(s.name) + '</h1><p class="grade-label ' + r.grade.key + '">' + icon(r.grade.icon) + ' ' + esc(r.grade.label) + '</p>' + (s.serving ? '<p class="tiny muted">Per ' + esc(s.serving) + '</p>' : '') + '</div></div>' +
        macroChips(s) +
        '<h2 class="h3">Why this score</h2><ul class="reasons">' + r.reasons.map(function (x) { return '<li class="' + (x.good ? 'good' : 'bad') + '">' + esc(x.text) + '</li>'; }).join('') + '</ul>' +
        '<div class="swap-box"><b>' + icon('arrows-clockwise') + ' One better swap</b><p>' + esc(r.swap) + '</p></div>' +
        processingBlock(r.processing) +
        (s.photo_id ? '<img class="detail-photo" alt="Photo of the label" src="/api/uploads/' + esc(s.photo_id) + '">' : '') +
        '<div class="btn-row"><button class="btn" data-log-scan="' + esc(s.id) + '">Log a serving</button><a class="btn btn-ghost" href="#/scan/' + esc(s.id) + '/edit">Edit</a><button class="btn btn-ghost danger" data-del-scan="' + esc(s.id) + '">Delete</button></div></div>' +
        '<p class="tiny muted center">The score is a transparent rule of thumb built on AHA, FDA and whole-grain research, not a validated clinical tool. <a href="/evidence#label-score" target="_blank" rel="noopener">How this score works</a></p>';
    }).catch(errorView);
  }

  // ---------- PLATE ----------
  var plateState = null;
  var GROUPS = [['protein', 'Protein', 'g-protein'], ['veg', 'Veggies', 'g-veg'], ['smartcarb', 'Smart carbs', 'g-smart'], ['refined', 'Refined carbs', 'g-refined'], ['fat', 'Healthy fats', 'g-fat'], ['fruit', 'Fruit', 'g-fruit'], ['sweet', 'Sweets & drinks', 'g-sweet']];
  function food(id) { return state.catalog.foods.find(function (f) { return f.id === id; }); }
  function renderPlate(existing) {
    plateState = { id: existing ? existing.id : null, name: existing ? existing.name : '', items: existing ? existing.items.slice() : [], photo_id: existing ? existing.photo_id : null };
    var listP = existing ? Promise.resolve({ plates: [] }) : api('GET', '/plates');
    loading();
    listP.then(function (d) {
      view.innerHTML = (existing ? '<a class="back" href="#/plate/' + esc(existing.id) + '">‹ Back</a><h1>Edit plate</h1>' : '<h1>Check my plate</h1><p class="muted">Add a photo, then tap what’s on your plate. We’ll estimate it and show you how to balance it.</p>') +
        '<div class="plate-layout"><div class="card">' + (existing ? '' : photoPicker(null)) +
        '<p class="small ai-note">' + icon('lightbulb') + ' Automatic food recognition from photos isn’t switched on yet, so tap your foods below. It takes about 20 seconds.</p>' +
        '<label class="sr-only" for="food-search">Search foods</label><input id="food-search" class="search" type="search" placeholder="Search foods…">' +
        '<div id="food-groups">' + GROUPS.map(function (g) {
          return '<div class="food-group ' + g[2] + '"><h3 class="h4">' + g[1] + '</h3><div class="food-grid">' + state.catalog.foods.filter(function (f) { return f.group === g[0]; }).map(function (f) {
            return '<button type="button" class="food-tile" data-food="' + f.id + '" data-name="' + esc(f.name.toLowerCase()) + '"><span class="ft-dot" aria-hidden="true"></span><span class="ft-name">' + esc(f.name) + '</span><span class="tiny muted">' + esc(f.portion) + '</span></button>';
          }).join('') + '</div></div>';
        }).join('') + '</div></div>' +
        '<div class="card plate-side" id="plate-side"></div></div>' +
        (existing ? '' : '<h2 class="section-title">Saved plates</h2>' + (d.plates.length ? '<ul class="card-list">' + d.plates.map(function (p) {
          return '<li><a class="row-card" href="#/plate/' + esc(p.id) + '">' + donut(p.totals.composition, '') + '<div><b>' + esc(p.name) + '</b><span class="tiny muted">' + r0(p.totals.protein) + 'g protein · ' + r0(p.totals.fiber) + 'g fiber</span></div><span class="chev" aria-hidden="true">›</span></a></li>';
        }).join('') + '</ul>' : '<div class="empty small">' + icon('fork-knife', 'big-icon') + '<p>No saved plates yet.</p></div>'));
      if (!existing) bindPhoto(view.querySelector('.card'));
      view.querySelector('#food-search').addEventListener('input', function (e) {
        var q = e.target.value.trim().toLowerCase();
        view.querySelectorAll('.food-tile').forEach(function (t) { t.hidden = q && t.dataset.name.indexOf(q) < 0; });
        view.querySelectorAll('.food-group').forEach(function (g) { g.hidden = !g.querySelector('.food-tile:not([hidden])'); });
      });
      drawPlateSide();
    }).catch(errorView);
  }
  var analyzeTimer, analyzeSeq = 0;
  function drawPlateSide(analysis) {
    var side = document.getElementById('plate-side'); if (!side) return;
    var ps = plateState;
    var peek = document.getElementById('plate-peek');
    if (!peek) { peek = document.createElement('button'); peek.id = 'plate-peek'; peek.type = 'button'; peek.className = 'plate-peek'; view.appendChild(peek); }
    var count = ps.items.length;
    peek.hidden = !count;
    peek.innerHTML = icon('fork-knife') + ' ' + count + ' food' + (count === 1 ? '' : 's') + (analysis ? ' \u00B7 ' + r0(analysis.totals.protein) + 'g protein \u00B7 ' + r0(analysis.totals.fiber) + 'g fiber' : '') + ' <b>See results \u2193</b>';
    if (!ps.items.length) { side.innerHTML = '<div class="empty small">' + icon('fork-knife', 'big-icon') + '<p>Your plate is empty. Tap foods to add them.</p></div>'; return; }
    side.innerHTML = '<h2 class="h3">On your plate</h2><ul class="plate-items">' + ps.items.map(function (it, i) {
      var f = food(it.id);
      return '<li class="g-' + f.group + '"><span class="ft-dot" aria-hidden="true"></span><span class="pi-name">' + esc(f.name) + '<span class="tiny muted">' + esc(f.portion) + ' each</span></span>' +
        '<select data-qty="' + i + '" aria-label="Portions of ' + esc(f.name) + '">' + [0.5, 1, 1.5, 2, 3].map(function (q) { return '<option value="' + q + '"' + (q === it.qty ? ' selected' : '') + '>' + (q === 0.5 ? '½' : q === 1.5 ? '1½' : q) + '×</option>'; }).join('') + '</select>' +
        '<button class="icon-btn small" data-rm="' + i + '" aria-label="Remove ' + esc(f.name) + '">' + icon('x') + '</button></li>';
    }).join('') + '</ul>' +
      (analysis ? '<h2 class="h3">Estimated for this plate</h2>' + macroChips(analysis.totals) +
        '<div class="donuts">' + donut(analysis.composition, 'Your plate') + donut({ veg: 50, protein: 25, carbs: 25, other: 0 }, 'Balanced plate') + '</div>' + legend +
        '<h2 class="h3">Quick tips to rebalance</h2><ul class="tips">' + analysis.tips.map(function (t) { return '<li class="tip ' + t.kind + '"><span class="tip-emoji">' + icon(t.icon || 'lightbulb') + '</span><div><b>' + esc(t.title) + '</b><p class="small">' + esc(t.text) + '</p>' + evidence(t.level, t.refs) + '</div></li>'; }).join('') + '</ul>'
        : '<p class="muted small">Working it out…</p>') +
      '<form id="plate-save" class="form" novalidate><label>Name this plate<input name="name" maxlength="80" value="' + esc(ps.name) + '" placeholder="e.g. Tuesday lunch bowl"></label>' +
      '<button class="btn btn-block">' + (ps.id ? 'Save changes' : 'Save plate') + '</button><p class="form-error" role="alert" hidden></p></form>' +
      '<p class="tiny muted">Estimates use standard portions. Your actual numbers will vary.</p>';
    if (!analysis) {
      clearTimeout(analyzeTimer);
      analyzeTimer = setTimeout(function () {
        var seq = ++analyzeSeq;
        api('POST', '/plates/analyze', { items: ps.items }).then(function (a) { if (seq === analyzeSeq && plateState === ps) drawPlateSide(a); }).catch(function (e) { toast(e.message, true); });
      }, 150);
    }
  }
  function savePlate(f) {
    var ps = plateState; fieldErrors(f, null);
    ps.name = f.querySelector('[name=name]').value;
    var photoInput = view.querySelector('[name=photo_id]');
    var body = { name: ps.name, items: ps.items };
    if (!ps.id && photoInput && photoInput.value) body.photo_id = photoInput.value;
    api(ps.id ? 'PUT' : 'POST', '/plates' + (ps.id ? '/' + ps.id : ''), body).then(function (d) { toast('Plate saved'); location.hash = '#/plate/' + d.id; })
      .catch(function (e) { fieldErrors(f, e); });
  }
  function renderPlateDetail(id, edit) {
    loading();
    api('GET', '/plates/' + id).then(function (d) {
      var p = d.plate;
      if (edit) return renderPlate(p);
      view.innerHTML = '<a class="back" href="#/plate">‹ All plates</a><div class="card"><h1>' + esc(p.name) + '</h1>' +
        (p.photo_id ? '<img class="detail-photo" alt="Photo of this plate" src="/api/uploads/' + esc(p.photo_id) + '">' : '') +
        '<ul class="plate-items readonly">' + p.items.map(function (it) { var f = food(it.id); return '<li class="g-' + f.group + '"><span class="ft-dot" aria-hidden="true"></span><span class="pi-name">' + esc(f.name) + '<span class="tiny muted">' + it.qty + ' × ' + esc(f.portion) + '</span></span></li>'; }).join('') + '</ul>' +
        macroChips(p.totals) + '<div class="donuts">' + donut(p.totals.composition, 'Your plate') + donut({ veg: 50, protein: 25, carbs: 25 }, 'Balanced plate') + '</div>' + legend +
        '<h2 class="h3">Quick tips</h2><ul class="tips">' + p.tips.map(function (t) { return '<li class="tip ' + t.kind + '"><span class="tip-emoji">' + icon(t.icon || 'lightbulb') + '</span><div><b>' + esc(t.title) + '</b><p class="small">' + esc(t.text) + '</p>' + evidence(t.level, t.refs) + '</div></li>'; }).join('') + '</ul>' +
        '<div class="btn-row"><button class="btn" data-log-plate="' + esc(p.id) + '">Log this plate</button><a class="btn btn-ghost" href="#/plate/' + esc(p.id) + '/edit">Edit</a><button class="btn btn-ghost danger" data-del-plate="' + esc(p.id) + '">Delete</button></div></div>';
    }).catch(errorView);
  }

  // ---------- PLAN ----------
  var planState = null;
  function renderPlan(week) {
    week = week || monday(state.date);
    loading();
    api('GET', '/plans/' + week).then(function (d) {
      planState = { week: week, slots: d.slots || {} };
      drawPlan();
    }).catch(errorView);
  }
  function drawPlan() {
    var ps = planState, t = state.me.targets;
    var html = planNav('week') + '<div class="date-nav"><button class="icon-btn" data-week="-7" aria-label="Previous week">' + icon('caret-left') + '</button><h1>This week<span class="small muted">Week of ' + esc(prettyDate(ps.week, { month: 'short', day: 'numeric' })) + '</span></h1><button class="icon-btn" data-week="7" aria-label="Next week">' + icon('caret-right') + '</button></div>' +
      '<div class="btn-row"><button class="btn" data-fill>' + icon('sparkle') + ' Fill empty slots</button><button class="btn btn-ghost" data-clear-week>Clear week</button></div>' +
      '<p class="small muted">Pick a meal for each slot. Changes save automatically. Fill my week leans on protein-forward breakfasts. Daily goals: ' + r0(t.protein) + 'g protein, ' + r0(t.fiber) + 'g fiber.</p><div class="plan-grid">';
    for (var i = 0; i < 7; i++) {
      var date = addDays(ps.week, i), day = ps.slots[i] || {}, tot = { protein: 0, fiber: 0, added_sugar: 0 };
      MEALS.forEach(function (m) { var r = day[m[0]] && recipe(day[m[0]]); if (r) { tot.protein += r.protein; tot.fiber += r.fiber; tot.added_sugar += r.added_sugar; } });
      html += '<section class="plan-day' + (date === localDate(new Date()) ? ' is-today' : '') + '"><h2 class="h4">' + esc(prettyDate(date, { weekday: 'short', month: 'short', day: 'numeric' })) + '</h2>' +
        MEALS.map(function (m) {
          var rid = day[m[0]], r = rid && recipe(rid);
          return '<label class="slot"><span class="slot-emoji">' + icon(m[2]) + '</span><span class="slot-main"><span class="tiny muted">' + m[1] + '</span>' +
            '<select data-slot="' + i + '" data-meal="' + m[0] + '"><option value="">Choose…</option>' + state.catalog.recipes.filter(function (x) { return x.meal === m[0]; }).map(function (x) { return '<option value="' + x.id + '"' + (x.id === rid ? ' selected' : '') + '>' + esc(x.name) + (x.savory ? ' (protein-forward)' : '') + '</option>'; }).join('') + '</select></span></label>';
        }).join('') +
        '<div class="plan-totals small"><span class="' + (tot.protein >= t.protein ? 'hit' : '') + '">' + icon('egg') + ' ' + tot.protein + 'g</span><span class="' + (tot.fiber >= t.fiber ? 'hit' : '') + '">' + icon('leaf') + ' ' + tot.fiber + 'g</span><span>' + icon('cookie') + ' ' + tot.added_sugar + 'g</span></div></section>';
    }
    html += '</div><a class="btn btn-block next-step" href="#/plan/grocery">' + icon('shopping-cart-simple') + ' See my grocery list</a>';
    view.innerHTML = html;
  }
  var planSaveTimer;
  function savePlan() {
    clearTimeout(planSaveTimer);
    planSaveTimer = setTimeout(function () {
      api('PUT', '/plans/' + planState.week, { slots: planState.slots }).then(function () { toast('Plan saved'); }).catch(function (e) { toast(e.message, true); });
    }, 300);
  }
  function fillWeek() {
    var byMeal = {};
    state.catalog.recipes.forEach(function (r) { (byMeal[r.meal] = byMeal[r.meal] || []).push(r); });
    for (var i = 0; i < 7; i++) {
      var day = planState.slots[i] = planState.slots[i] || {};
      MEALS.forEach(function (m, mi) {
        if (day[m[0]]) return;
        var list = byMeal[m[0]].slice().sort(function (a, b) { return (b.protein + b.fiber) - (a.protein + a.fiber); });
        if (m[0] === 'breakfast') list = list.filter(function (r) { return r.savory; }).concat(list.filter(function (r) { return !r.savory; }).slice(0, 2)); // savory breakfasts most days
        day[m[0]] = list[(i + mi) % list.length].id; // rotate for variety, favoring higher protein + fiber
      });
    }
    drawPlan(); savePlan();
  }

  // ---------- PLAN: grocery, snacks, staples, prep ----------
  var PLAN_TABS = [['week', 'Week', '#/plan'], ['grocery', 'Grocery list', '#/plan/grocery'], ['snacks', 'Snacks', '#/plan/snacks'], ['staples', 'Kitchen staples', '#/plan/staples'], ['prep', 'Prep + success', '#/plan/prep']];
  function planNav(on) {
    return '<p class="q">What should I eat this week?</p><nav class="subnav" aria-label="Plan sections">' + PLAN_TABS.map(function (t) { return '<a href="' + t[2] + '"' + (t[0] === on ? ' class="on" aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav>';
  }
  function store(key, val) { try { if (val === undefined) return JSON.parse(localStorage.getItem(key) || 'null'); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; } }
  var AISLES = ['produce', 'protein', 'dairy & eggs', 'frozen', 'bread & grains', 'pantry'];
  var groceryWeek = null;
  function renderGrocery() {
    var week = monday(state.date);
    loading();
    api('GET', '/plans/' + week).then(function (d) {
      var slots = d.slots || {}, items = {}, meals = 0;
      Object.keys(slots).forEach(function (day) { Object.keys(slots[day]).forEach(function (m) {
        var r = recipe(slots[day][m]); if (!r) return; meals++;
        r.ing.forEach(function (g) { var key = g.item; items[key] = items[key] || { item: g.item, aisle: g.aisle, n: 0 }; items[key].n++; });
      }); });
      var need = store('staples-need') || [];
      need.forEach(function (n) { if (!items[n]) items[n] = { item: n, aisle: 'restock', n: 0 }; });
      var checked = store('grocery-' + week) || {};
      var groups = AISLES.concat(['restock']).map(function (a) { return [a, Object.values(items).filter(function (x) { return x.aisle === a; }).sort(function (x, y) { return x.item.localeCompare(y.item); })]; }).filter(function (g) { return g[1].length; });
      var total = Object.keys(items).length;
      view.innerHTML = planNav('grocery') + '<h1>Grocery list</h1>' +
        (total ? '<p class="muted">Built from ' + meals + ' planned meals' + (need.length ? ' plus ' + need.length + ' staples to restock' : '') + '. Tap to check off.</p>' +
          '<div class="btn-row"><button class="btn btn-small btn-ghost" data-copy-list>' + icon('copy') + ' Copy list</button><button class="btn btn-small btn-ghost" data-clear-checks>Uncheck all</button></div>' +
          groups.map(function (g) {
            return '<section class="aisle"><h2 class="h3">' + esc(g[0] === 'restock' ? 'Staples to restock' : g[0]) + '</h2><ul class="checklist">' + g[1].map(function (x) {
              var id = 'g-' + x.item.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
              return '<li><label for="' + id + '"><input type="checkbox" id="' + id + '" data-gitem="' + esc(x.item) + '"' + (checked[x.item] ? ' checked' : '') + '><span>' + esc(x.item) + (x.n > 1 ? ' <em>for ' + x.n + ' meals</em>' : '') + '</span></label></li>';
            }).join('') + '</ul></section>';
          }).join('') +
          '<p class="small muted">Shopping tip: the outer aisles hold most whole foods. In the middle aisles, check labels with the scanner.</p>'
          : '<div class="empty">' + icon('shopping-cart-simple', 'big-icon') + '<p>Plan a few meals this week and your grocery list builds itself.</p><a class="btn" href="#/plan">Plan my week</a></div>');
      groceryWeek = week;
    }).catch(errorView);
  }
  function renderSnacks() {
    var k = state.catalog.kitchen, snacks = state.catalog.recipes.filter(function (r) { return r.meal === 'snack'; });
    view.innerHTML = planNav('snacks') + '<h1>Snacks that hold you</h1>' +
      '<p class="muted">The formula: one protein + one fiber. Protein keeps you full, fiber slows the sugar. Together they beat the 3pm crash.</p>' + evidence('moderate', ['sorensen2012', 'reynolds2019']) +
      '<div class="builder"><div><h2 class="h3">' + icon('egg') + ' Pick a protein</h2><ul class="chips-list">' + k.SNACK_BUILDER.protein.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="plus-sign" aria-hidden="true">+</div><div><h2 class="h3">' + icon('leaf') + ' Pick a fiber</h2><ul class="chips-list">' + k.SNACK_BUILDER.fiber.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>' +
      '<h2 class="h2">' + snacks.length + ' ready-made ideas</h2><ul class="snack-grid">' + snacks.map(function (r) {
        return '<li class="snack"><b>' + esc(r.name) + '</b><span class="small">' + r.protein + 'g protein \u00B7 ' + r.fiber + 'g fiber</span><button class="btn btn-tiny" data-log-recipe="' + r.id + '" data-meal="snack">' + icon('plus') + ' Log it</button></li>';
      }).join('') + '</ul>';
  }
  function renderStaples() {
    var k = state.catalog.kitchen, need = store('staples-need') || [];
    view.innerHTML = planNav('staples') + '<h1>Stock a PCOS-friendly kitchen</h1>' +
      '<p class="muted">With these on hand, a balanced meal is always 15 minutes away. Tap \u201CNeed it\u201D and it goes on your grocery list.</p>' +
      k.STAPLES.map(function (z) {
        return '<section class="zone"><h2 class="h2">' + icon(z.icon) + ' ' + esc(z.title) + '</h2><ul class="staple-list">' + z.items.map(function (it) {
          var on = need.indexOf(it.name) >= 0;
          return '<li class="staple"><div><b>' + esc(it.name) + '</b><p class="small">' + esc(it.why) + '</p>' + (it.check ? '<p class="small label-check">' + icon('magnifying-glass') + ' <span><b>Label check:</b> ' + esc(it.check) + '</span></p>' : '') + '</div>' +
            '<button class="btn btn-tiny ' + (on ? '' : 'btn-ghost') + '" data-need="' + esc(it.name) + '" aria-pressed="' + on + '">' + (on ? icon('check') + ' On list' : 'Need it') + '</button></li>';
        }).join('') + '</ul></section>';
      }).join('') +
      '<div class="card tip-card">' + icon('arrows-clockwise') + '<div><b>Don\u2019t empty your pantry.</b><p class="small">When something runs out, scan the next one and pick the simpler version. <a href="#/scan">Check a label</a></p></div></div>';
  }
  function renderPrep() {
    var k = state.catalog.kitchen;
    view.innerHTML = planNav('prep') + '<h1>How to make it stick</h1>' +
      '<p class="muted">People who plan meals eat a more varied, higher-quality diet. You don\u2019t need a perfect plan, just a few decisions made ahead.</p>' + evidence('moderate', ['ducrot2017']) +
      '<h2 class="h2">Plan these 4 moments</h2><ul class="moment-list">' + k.PLAN_MOMENTS.map(function (m, i) { return '<li><span class="n">' + (i + 1) + '</span><div><b>' + esc(m.title) + '</b><p class="small">' + esc(m.text) + '</p></div></li>'; }).join('') + '</ul>' +
      '<h2 class="h2">One prep hour a week</h2><ul class="checklist plain">' + k.PREP_HOUR.map(function (x) { return '<li>' + icon('check-circle') + ' ' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<h2 class="h2">Habits that keep you going</h2><ul class="success-list">' + k.SUCCESS.map(function (x) { return '<li>' + icon(x.icon) + '<div><b>' + esc(x.title) + '</b><p class="small">' + esc(x.text) + '</p></div></li>'; }).join('') + '</ul>' +
      '<a class="btn btn-block" href="#/plan">' + icon('calendar-blank') + ' Plan my week</a>';
  }

  // ---------- DAILY CHECK-IN ----------
  var checkinState = null, checkinTimer;
  var SCALE_UI = [
    ['energy', 'Energy', ['Drained', 'Low', 'Okay', 'Good', 'Great']],
    ['mood', 'Mood', ['Rough', 'Low', 'Okay', 'Good', 'Great']],
    ['cravings', 'Cravings', ['None', 'Mild', 'Some', 'Strong', 'Intense']],
    ['sleep', 'Sleep', ['Awful', 'Poor', 'Okay', 'Good', 'Great']],
  ];
  function checkinCard() {
    var c = checkinState, syms = state.catalog.symptoms || [];
    return '<section class="checkin" aria-labelledby="ci-title"><div class="ci-head"><div><p class="q">20-second check-in</p><h2 class="h2" id="ci-title">How are you today?</h2></div><span class="ci-saved small" aria-live="polite">' + (c.updated_at ? icon('check-circle') + ' Saved' : '') + '</span></div>' +
      SCALE_UI.map(function (sc) {
        return '<div class="ci-row" role="group" aria-label="' + sc[1] + '"><span class="ci-label">' + sc[1] + '</span><div class="ci-scale">' + sc[2].map(function (w, i) {
          var n = i + 1, on = c[sc[0]] === n;
          return '<button type="button" class="ci-dot' + (on ? ' on' : '') + '" data-ci="' + sc[0] + '" data-v="' + n + '" aria-pressed="' + on + '" title="' + w + '"><b>' + n + '</b><span>' + w + '</span></button>';
        }).join('') + '</div></div>';
      }).join('') +
      '<div class="ci-row" role="group" aria-label="Period"><span class="ci-label">Period</span><div class="ci-chips">' + [['none', 'No'], ['spotting', 'Spotting'], ['period', 'Period']].map(function (p) {
        return '<button type="button" class="chip-btn' + (c.period === p[0] ? ' on' : '') + '" data-ci-period="' + p[0] + '" aria-pressed="' + (c.period === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="ci-row" role="group" aria-label="Symptoms today"><span class="ci-label">Today I noticed</span><div class="ci-chips">' + syms.map(function (sy) {
        var on = c.symptoms.indexOf(sy[0]) >= 0; return '<button type="button" class="chip-btn' + (on ? ' on' : '') + '" data-ci-sym="' + sy[0] + '" aria-pressed="' + on + '">' + esc(sy[1]) + '</button>'; }).join('') + '</div></div>' +
      '<a class="small ci-link" href="#/me">See my patterns ' + icon('caret-right') + '</a></section>';
  }
  function saveCheckin() {
    clearTimeout(checkinTimer);
    checkinTimer = setTimeout(function () {
      var c = checkinState;
      api('PUT', '/checkins/' + c.day, { energy: c.energy, mood: c.mood, cravings: c.cravings, sleep: c.sleep, period: c.period, symptoms: c.symptoms })
        .then(function () { c.updated_at = 1; var el = view.querySelector('.ci-saved'); if (el) el.innerHTML = icon('check-circle') + ' Saved'; })
        .catch(function (e) { toast(e.message, true); });
    }, 250);
  }
  function redrawCheckin() { var el = view.querySelector('.checkin'); if (el) el.outerHTML = checkinCard(); }

  // ---------- ME: patterns, labs, report ----------
  var ME_TABS = [['patterns', 'My patterns', '#/me'], ['experiments', 'Experiments', '#/me/experiments'], ['labs', 'My numbers', '#/me/labs'], ['report', 'Report', '#/me/report']];
  function meNav(on, q) { return '<p class="q">' + q + '</p><nav class="subnav" aria-label="Me sections">' + ME_TABS.map(function (t) { return '<a href="' + t[2] + '"' + (t[0] === on ? ' class="on" aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav>'; }
  var LEVEL_WORD = { 1: 'low', 5: 'high' };
  function renderMe() {
    loading();
    api('GET', '/insights?today=' + localDate(new Date())).then(function (d) {
      var a = d.averages, ch = d.change, syms = state.catalog.symptoms || [];
      var stat = function (k, label, better) {
        var v = a[k], c = ch[k], good = c != null && (better === 'down' ? c < 0 : c > 0);
        return '<div class="pstat"><span class="ps-label">' + label + '</span><b>' + (v == null ? '–' : v) + '<small>/5</small></b>' +
          (c == null ? '<span class="ps-ch muted">No earlier data yet</span>' : '<span class="ps-ch ' + (good ? 'good' : c === 0 ? '' : 'meh') + '">' + (c > 0 ? '+' : '') + c + ' vs last month</span>') + '</div>';
      };
      var cal = d.calendar.map(function (x) {
        var cls = x.energy ? 'e' + x.energy : 'none'; var dd = new Date(x.day + 'T12:00:00');
        return '<li class="cal-day ' + cls + (x.period === 'period' ? ' per' : x.period === 'spotting' ? ' spot' : '') + '" title="' + esc(prettyDate(x.day, { month: 'short', day: 'numeric' })) + (x.energy ? ', energy ' + x.energy : '') + (x.period === 'period' ? ', period' : '') + '"><span>' + dd.getDate() + '</span></li>';
      }).join('');
      var topSym = syms.map(function (s) { return [s[1], d.symptomCounts[s[0]] || 0]; }).filter(function (x) { return x[1]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 4);
      var p = d.pattern;
      view.innerHTML = meNav('patterns', 'How am I actually doing?') + '<h1>My patterns</h1>' +
        (d.count ? '' : '<div class="empty">' + icon('calendar-blank', 'big-icon') + '<p>Do the 20-second check-in on the Today screen for a few days and your patterns show up here.</p><a class="btn" href="#/today">Check in now</a></div>') +
        '<div class="streak">' + icon('lightning') + '<div><b>' + d.streak + '-day streak</b><span class="small">' + pl(d.count, 'check-in') + ' in the last 30 days</span></div></div>' +
        '<h2 class="h2">Wins that aren’t the scale</h2>' +
        (d.wins.length ? '<ul class="wins">' + d.wins.map(function (w) { return '<li>' + icon(w.icon) + '<span>' + esc(w.text) + '</span></li>'; }).join('') + '</ul>'
          : '<p class="muted">Keep checking in and logging food. Wins like more energy, fewer cravings or steadier cycles will show up here.</p>') +
        '<h2 class="h2">The last 30 days</h2><div class="pstats">' + stat('energy', 'Energy') + stat('mood', 'Mood') + stat('cravings', 'Cravings', 'down') + stat('sleep', 'Sleep') + '</div>' +
        '<h2 class="h2">Energy and cycle, last 4 weeks</h2><ul class="cal" aria-label="Last 28 days">' + cal + '</ul>' +
        '<div class="legend small"><span><i class="lg e1"></i>Low energy</span><span><i class="lg e3"></i>Okay</span><span><i class="lg e5"></i>Great</span><span><i class="lg per"></i>Period</span></div>' +
        '<div class="cycle card"><h2 class="h3">' + icon('flower-lotus') + ' My cycle</h2>' +
          (d.lastStart ? '<p>Last period started <b>' + esc(prettyDate(d.lastStart, { month: 'long', day: 'numeric' })) + '</b>.' + (d.avgCycle ? ' Average cycle: <b>' + d.avgCycle + ' days</b> (' + pl(d.lengths.length, 'cycle') + ' tracked).' : ' Log your next period start to see cycle length.') + '</p>' +
            '<p class="small muted">Cycles regularly shorter than 21 or longer than 35 days are worth mentioning to your clinician.</p>' + evidence('guideline', ['pcos2023'])
            : '<p class="muted">Mark “Period” in your daily check-in and your cycle length is worked out for you.</p>') + '</div>' +
        (topSym.length ? '<div class="card"><h2 class="h3">Most common symptoms this month</h2><ul class="sym-bars">' + topSym.map(function (x) { return '<li><span>' + esc(x[0]) + '</span><i style="width:' + Math.min(100, x[1] / 30 * 100) + '%"></i><b>' + pl(x[1], 'day') + '</b></li>'; }).join('') + '</ul></div>' : '') +
        '<div class="card pattern"><h2 class="h3">' + icon('lightbulb') + ' Your food and energy</h2>' +
          (p ? '<p>On the <b>' + pl(p.hitDays, 'day') + '</b> you hit your fiber goal, your energy averaged <b>' + p.energyHit + '/5</b>. On the other <b>' + pl(p.missDays, 'day') + '</b>, it averaged <b>' + p.energyMiss + '/5</b>.' + (p.cravingsHit != null && p.cravingsMiss != null ? ' Cravings: ' + p.cravingsHit + ' vs ' + p.cravingsMiss + '.' : '') + '</p><p class="small muted">This is a pattern in your own data, not proof of cause. Sleep, stress and your cycle matter too.</p>'
            : '<p class="muted">Log food and check in on at least 8 days, and you’ll see how your energy compares on days you hit your fiber goal versus days you don’t.</p>') + '</div>' +
        '<a class="btn btn-block" href="#/me/report">' + icon('clipboard-text') + ' Make my appointment report</a>';
    }).catch(errorView);
  }
  var labKinds = null;
  function renderLabs() {
    loading();
    api('GET', '/labs').then(function (d) {
      labKinds = d.kinds;
      var m = d.metabolic;
      var bandCls = { ok: 'c-lime', watch: 'c-org', high: 'c-org', info: 'c-peri' }, bandWord = { ok: 'In range', watch: 'Worth watching', high: 'Talk to your clinician', info: 'For your records' };
      view.innerHTML = meNav('labs', 'What do my numbers mean?') + '<h1>My numbers</h1>' +
        '<p class="muted">Add results from your lab reports. You’ll see them next to the official ranges for prediabetes and metabolic syndrome. This is education, not a diagnosis.</p>' +
        '<form id="lab-form" class="card form" novalidate><h2 class="h3">Add a result</h2><div class="grid-2">' +
          '<label>Test<select name="kind">' + Object.keys(d.kinds).map(function (k) { return '<option value="' + k + '">' + esc(d.kinds[k].label) + ' (' + esc(d.kinds[k].unit) + ')</option>'; }).join('') + '</select></label>' +
          '<label>Date of test<input type="date" name="taken_on" value="' + localDate(new Date()) + '" max="' + localDate(new Date()) + '"></label>' +
          '<label><span class="lab-v1">Result</span><input name="value" inputmode="decimal" required></label>' +
          '<label class="lab-v2" hidden>Bottom number<input name="value2" inputmode="numeric"></label></div>' +
          '<button class="btn">Save result</button><p class="form-error" role="alert" hidden></p></form>' +
        (d.latest.length ? '<h2 class="h2">Latest results</h2><ul class="lab-list">' + d.latest.map(function (r) {
          return '<li class="lab"><div class="lab-top"><b>' + esc(r.label) + '</b><span class="lab-val">' + esc(r.display) + ' <small>' + esc(r.unit) + '</small></span></div>' +
            '<span class="proc ' + bandCls[r.band] + '">' + bandWord[r.band] + '</span><p class="small">' + esc(r.text) + '</p><p class="tiny muted">Tested ' + esc(prettyDate(r.taken_on, { month: 'short', day: 'numeric', year: 'numeric' })) + '</p>' + evidence(r.refs.length ? 'guideline' : null, r.refs) + '</li>';
        }).join('') + '</ul>' : '') +
        '<div class="card metab"><h2 class="h3">' + icon('heartbeat') + ' Metabolic syndrome check</h2>' +
          '<p>Metabolic syndrome means 3 or more of 5 markers. From the numbers you’ve added: <b>' + m.met + ' of ' + m.measured + '</b> measured markers are in the flagged range.</p><ul class="metab-list">' +
          m.items.map(function (i) { return '<li class="' + (i.met === true ? 'met' : i.met === false ? 'ok' : 'na') + '">' + icon(i.met === true ? 'warning-circle' : i.met === false ? 'check-circle' : 'minus-circle') + '<span>' + esc(i.label) + (i.met == null ? ' <em>(not added)</em>' : '') + '</span></li>'; }).join('') + '</ul>' +
          '<p class="small muted">Your clinician makes the diagnosis. Every one of these markers improves with the same habits.</p>' + evidence('guideline', ['alberti2009', 'dpp2002']) + '<p class="small"><a href="#/learn/prediabetes-metabolic">Prediabetes and metabolic syndrome: the same playbook</a></p></div>' +
        (d.rows.length > d.latest.length ? '<h2 class="h2">History</h2><ul class="lab-hist">' + d.rows.map(function (r) { return '<li><span>' + esc(prettyDate(r.taken_on, { month: 'short', day: 'numeric', year: 'numeric' })) + '</span><b>' + esc(r.label) + '</b><span>' + esc(r.display) + ' ' + esc(r.unit) + '</span><button class="icon-btn small" data-del-lab="' + esc(r.id) + '" aria-label="Delete ' + esc(r.label) + ' result">' + icon('x') + '</button></li>'; }).join('') + '</ul>'
          : (d.rows.length ? '<p class="small"><button class="linklike" data-del-lab="' + esc(d.rows[0].id) + '">Delete my last result</button></p>' : ''));
      var f = document.getElementById('lab-form');
      var sync = function () { var k = f.querySelector('[name=kind]').value, two = labKinds[k].two; f.querySelector('.lab-v2').hidden = !two; f.querySelector('.lab-v1').textContent = two ? 'Top number' : 'Result (' + labKinds[k].unit + ')'; };
      f.querySelector('[name=kind]').addEventListener('change', sync); sync();
      f.addEventListener('submit', function (e) {
        e.preventDefault(); fieldErrors(f, null);
        api('POST', '/labs', Object.fromEntries(new FormData(f))).then(function () { toast('Result saved'); renderLabs(); }).catch(function (er) { fieldErrors(f, er); });
      });
    }).catch(errorView);
  }
  function renderReport() {
    loading();
    api('GET', '/report?today=' + localDate(new Date())).then(function (r) {
      var asked = store('report-asked') || [], note = store('report-note') || '';
      var focusName = { pcos: 'PCOS', insulin_resistance: 'Insulin resistance', prediabetes: 'Prediabetes', metabolic_syndrome: 'Metabolic syndrome', not_sure: 'Not sure yet' }[r.focus] || 'PCOS';
      view.innerHTML = meNav('report', 'Ready for my appointment?') +
        '<div class="report-actions btn-row"><button class="btn" data-print>' + icon('printer') + ' Print or save as PDF</button></div>' +
        '<article class="report card">' +
          '<header class="rp-head"><div><p class="q">Appointment summary</p><h1>' + esc(r.name) + '</h1><p class="small">Last ' + r.days + ' days (' + esc(prettyDate(r.from, { month: 'short', day: 'numeric' })) + ' to ' + esc(prettyDate(r.generated, { month: 'short', day: 'numeric', year: 'numeric' })) + ') · Focus: ' + esc(focusName) + '</p></div></header>' +
          '<section><h2 class="h3">Cycle</h2>' + (r.starts.length ? '<p>Period start dates: <b>' + r.starts.map(function (s) { return esc(prettyDate(s, { month: 'short', day: 'numeric' })); }).join(', ') + '</b>.' + (r.avgCycle ? ' Average cycle length: <b>' + r.avgCycle + ' days</b> (lengths: ' + r.lengths.join(', ') + ').' : '') + '</p>' : '<p class="muted">No periods logged in this window.</p>') + '</section>' +
          '<section><h2 class="h3">How I’ve been feeling</h2><p>' + pl(r.checkins, 'daily check-in') + '. Average (1 to 5): energy <b>' + (r.averages.energy == null ? '–' : r.averages.energy) + '</b>, mood <b>' + (r.averages.mood == null ? '–' : r.averages.mood) + '</b>, cravings <b>' + (r.averages.cravings == null ? '–' : r.averages.cravings) + '</b>, sleep <b>' + (r.averages.sleep == null ? '–' : r.averages.sleep) + '</b>.</p>' +
            (r.symptoms.length ? '<p>Symptoms: ' + r.symptoms.map(function (s) { return esc(s.label) + ' (' + pl(s.days, 'day') + ')'; }).join(', ') + '.</p>' : '') + '</section>' +
          '<section><h2 class="h3">What I’ve been eating</h2>' + (r.food.daysLogged ? '<p>' + pl(r.food.daysLogged, 'day') + ' logged. Daily average: protein <b>' + r.food.protein + 'g</b>, fiber <b>' + r.food.fiber + 'g</b>, added sugar <b>' + r.food.sugar + 'g</b>.</p>' : '<p class="muted">No food logged in this window.</p>') + '</section>' +
          '<section><h2 class="h3">Lab results I’ve recorded</h2>' + (r.labs.length ? '<ul>' + r.labs.map(function (l) { return '<li><b>' + esc(l.label) + ':</b> ' + esc(l.display) + ' ' + esc(l.unit) + ' (' + esc(prettyDate(l.taken_on, { month: 'short', day: 'numeric', year: 'numeric' })) + ')</li>'; }).join('') + '</ul>' : '<p class="muted">None recorded.</p>') + '</section>' +
          (r.wins.length ? '<section><h2 class="h3">Changes I’ve noticed</h2><ul>' + r.wins.map(function (w) { return '<li>' + esc(w.text) + '</li>'; }).join('') + '</ul></section>' : '') +
          '<section><h2 class="h3">Tests I’d like to discuss</h2><ul>' + r.tests.map(function (t) { return '<li>' + esc(t.text) + '</li>'; }).join('') + '</ul><p class="tiny muted">Based on the 2023 International PCOS Guideline and ADA Standards of Care.</p></section>' +
          '<section><h2 class="h3">My questions</h2><ul class="q-pick">' + r.questions.map(function (q, i) { var on = asked.indexOf(i) >= 0; return '<li class="' + (on ? '' : 'no-print') + '"><label><input type="checkbox" data-ask="' + i + '"' + (on ? ' checked' : '') + '><span>' + esc(q) + '</span></label></li>'; }).join('') + '</ul>' +
            '<label class="rp-note">Anything else I want to say<textarea data-note rows="3" maxlength="1000" placeholder="For example: my cycles have been 45+ days since spring">' + esc(note) + '</textarea></label></section>' +
          '<footer class="tiny muted">Made with Better Plate. Self-reported and educational, not a medical record.</footer>' +
        '</article>';
    }).catch(errorView);
  }

  // ---------- BARCODE ----------
  var scanStream = null, zxingReader = null;
  function lookupBarcode(code) {
    var box = view.querySelector('.bc-result'); if (!box) return;
    box.innerHTML = '<p class="small muted">Looking up ' + esc(code) + '\u2026</p>';
    api('GET', '/products/' + encodeURIComponent(code)).then(function (d) {
      var p = d.product, f = document.getElementById('scan-form');
      var set = function (n, v) { var el = f.querySelector('[name="' + n + '"]'); if (el && v != null) el.value = v; };
      set('name', p.brand && p.name.toLowerCase().indexOf(p.brand.toLowerCase()) < 0 ? p.name + ' (' + p.brand + ')' : p.name);
      set('serving', p.serving); set('added_sugar', p.added_sugar); set('fiber', p.fiber); set('protein', p.protein); set('total_carbs', p.total_carbs); set('fat', p.fat); set('ingredients', p.ingredients);
      var nova = { 1: 'unprocessed or minimally processed', 2: 'a kitchen ingredient', 3: 'processed', 4: 'ultra-processed' }[p.nova_group];
      box.innerHTML = '<div class="found">' + icon('check-circle') + '<div><b>Found: ' + esc(p.name) + '</b><p class="small">The label below is filled in. Check it against your package, then tap \u201CGet my score.\u201D</p>' +
        (nova ? '<p class="small">Open Food Facts classifies this as <b>' + nova + '</b> (NOVA group ' + p.nova_group + ').</p>' : '') +
        (p.warnings.length ? '<ul class="small warn-list">' + p.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') +
        '<p class="tiny muted">Product data from Open Food Facts, available under the Open Database License.</p></div></div>';
      f.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function (e) { box.innerHTML = '<p class="form-error">' + esc(e.message) + '</p>'; });
  }
  function stopCamera() {
    if (zxingReader) { try { zxingReader.reset(); } catch (e) {} zxingReader = null; }
    if (scanStream) { scanStream.getTracks().forEach(function (t) { t.stop(); }); scanStream = null; }
    var sh = document.querySelector('.scan-sheet'); if (sh) sh.remove();
  }
  function loadZxing() {
    return new Promise(function (ok, bad) {
      if (window.ZXing) return ok(window.ZXing);
      var sc = document.createElement('script'); sc.src = '/vendor/zxing.min.js'; sc.onload = function () { ok(window.ZXing); }; sc.onerror = bad; document.head.appendChild(sc);
    });
  }
  function openCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return toast('Your browser can\u2019t use the camera here. Type the barcode number instead.', true);
    var sheet = document.createElement('div'); sheet.className = 'sheet-backdrop scan-sheet';
    sheet.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="scan-title"><div class="sheet-head"><h2 id="scan-title">Scan a barcode</h2><button class="icon-btn" data-close-scan aria-label="Close">' + icon('x') + '</button></div>' +
      '<div class="viewfinder"><video playsinline muted></video><span class="vf-line" aria-hidden="true"></span></div><p class="small muted center scan-msg">Hold the barcode inside the box. It scans by itself.</p></div>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', function (e) { if (e.target === sheet || e.target.closest('[data-close-scan]')) stopCamera(); });
    var video = sheet.querySelector('video'), done = false;
    var found = function (code) { if (done) return; done = true; if (navigator.vibrate) navigator.vibrate(40); stopCamera(); var inp = document.getElementById('bc-code'); if (inp) inp.value = code; lookupBarcode(code); };
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (stream) {
      scanStream = stream; video.srcObject = stream; return video.play();
    }).then(function () {
      if ('BarcodeDetector' in window) {
        var det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        var tick = function () { if (done || !scanStream) return; det.detect(video).then(function (r) { if (r.length) found(r[0].rawValue); else requestAnimationFrame(tick); }).catch(function () { requestAnimationFrame(tick); }); };
        tick();
      } else {
        loadZxing().then(function (Z) {
          zxingReader = new Z.BrowserMultiFormatReader();
          zxingReader.decodeFromVideoElementContinuously(video, function (res) { if (res) found(res.getText()); });
        }).catch(function () { sheet.querySelector('.scan-msg').textContent = 'Scanning isn\u2019t available on this device. Close this and type the barcode number.'; });
      }
    }).catch(function () { sheet.querySelector('.scan-msg').textContent = 'We couldn\u2019t open the camera. Check camera permission, or type the barcode number instead.'; });
  }

  // ---------- EXPERIMENTS ----------
  var METRIC = { energy: 'Energy', cravings: 'Cravings', sleep: 'Sleep', mood: 'Mood' };
  function expCompare(x) {
    if (!x.beforeCount || !x.duringCount) return '<p class="small muted">Do your daily check-in during the experiment (and ideally the week before) to see how you felt. </p>';
    return '<ul class="exp-compare">' + x.compare.map(function (c) {
      if (c.change == null) return '<li><b>' + METRIC[c.metric] + '</b><span class="muted">Not enough check-ins</span></li>';
      var good = c.better === 'down' ? c.change < 0 : c.change > 0;
      return '<li><b>' + METRIC[c.metric] + '</b><span>' + c.before + ' \u2192 ' + c.during + '</span><em class="' + (good ? 'good' : c.change === 0 ? '' : 'meh') + '">' + (c.change > 0 ? '+' : '') + c.change + '</em></li>';
    }).join('') + '</ul><p class="tiny muted">Average check-in scores (1 to 5): the 7 days before vs. during. A pattern for you, not proof.</p>';
  }
  function renderExperiments() {
    loading();
    api('GET', '/experiments?today=' + localDate(new Date())).then(function (d) {
      var a = d.active, today = localDate(new Date());
      var html = meNav('experiments', 'What works for my body?') + '<h1>7-day experiments</h1><p class="muted">Pick one habit, try it for a week, and see how you felt compared with the week before. Your body, your data.</p>';
      if (a) {
        html += '<section class="exp-active ' + a.def.color + '-soft"><p class="q">Day ' + a.dayNumber + ' of 7</p><h2 class="h2">' + icon(a.def.icon) + ' ' + esc(a.def.title) + '</h2><p><b>Today:</b> ' + esc(a.def.daily) + '</p>' +
          '<ol class="exp-days">' + a.days.map(function (x, i) {
            return '<li><button type="button" class="exp-day' + (x.done ? ' on' : '') + '" data-exp-day="' + x.day + '" data-exp="' + a.id + '"' + (x.future ? ' disabled' : '') + ' aria-pressed="' + x.done + '" aria-label="Day ' + (i + 1) + (x.done ? ', done' : '') + '"><b>' + (i + 1) + '</b>' + (x.done ? icon('check') : '') + '</button></li>';
          }).join('') + '</ol>' +
          (a.def.auto === 'fiber' ? '<p class="small muted">Days fill in automatically when your food log reaches your fiber goal.</p>' : '<button class="btn btn-block" data-exp-today="' + a.id + '" data-exp-date="' + today + '"' + (a.days.some(function (x) { return x.day === today && x.done; }) ? ' disabled' : '') + '>' + icon('check-circle') + ' I did it today</button>') +
          '<p class="small"><b>Why it might help:</b> ' + esc(a.def.why) + '</p>' + evidence(a.def.level, a.def.refs) +
          '<h3 class="h3">How you\u2019re feeling so far</h3>' + expCompare(a) +
          '<button class="linklike small" data-exp-stop="' + a.id + '">Stop this experiment</button></section>';
      }
      html += '<h2 class="h2">' + (a ? 'Next up' : 'Choose your experiment') + '</h2><ul class="exp-grid">' + d.catalog.map(function (e) {
        return '<li class="exp-card"><span class="ask-ic ' + e.color + '">' + icon(e.icon) + '</span><b>' + esc(e.title) + '</b><p class="small">' + esc(e.daily) + '</p>' + evidence(e.level, []) +
          '<button class="btn btn-small' + (a ? ' btn-ghost' : '') + '" data-exp-start="' + e.key + '">' + (a ? 'Switch to this' : 'Start 7 days') + '</button></li>';
      }).join('') + '</ul>';
      if (d.history.length) html += '<h2 class="h2">Past experiments</h2><ul class="exp-hist">' + d.history.map(function (h) {
        return '<li><div><b>' + esc(h.def.title) + '</b><span class="small muted">' + esc(prettyDate(h.started_on, { month: 'short', day: 'numeric' })) + ' \u00B7 ' + h.doneCount + ' of 7 days' + (h.status === 'stopped' ? ' \u00B7 stopped early' : '') + '</span></div>' + expCompare(h) + '</li>';
      }).join('') + '</ul>';
      view.innerHTML = html;
    }).catch(errorView);
  }

  // ---------- INSTALL + REMINDERS ----------
  var installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; var b = document.querySelector('[data-install]'); if (b) b.hidden = false; });
  if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  function appCard() {
    var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var rem = function (type, label, time) { return '<li><label><span>' + label + '</span><input type="time" value="' + time + '" data-rem-time="' + type + '"></label><a class="btn btn-tiny btn-ghost" data-rem="' + type + '" href="/api/reminders.ics?type=' + type + '&time=' + time + '" download>' + icon('calendar-blank') + ' Add to calendar</a></li>'; };
    return '<section class="card app-card"><h2 class="h3">' + icon('device-mobile') + ' Get the app</h2>' +
      (standalone ? '<p class="small">You\u2019re using the installed app. Nice.</p>'
        : '<p class="small">Put Better Plate on your home screen so it opens like an app.</p><button class="btn btn-small" data-install' + (installEvt ? '' : ' hidden') + '>' + icon('download-simple') + ' Install the app</button>' +
          (ios ? '<p class="small install-ios">On iPhone: tap the <b>Share</b> button in Safari, then <b>Add to Home Screen</b>.</p>' : (installEvt ? '' : '<p class="small muted">In Chrome, open the browser menu and choose <b>Install app</b> or <b>Add to Home screen</b>.</p>'))) +
      '<h3 class="h3">Reminders</h3><p class="small muted">Add a repeating reminder to your phone\u2019s calendar. Works on iPhone, Android and computer, no extra app needed.</p><ul class="rem-list">' +
      rem('checkin', 'Daily check-in', '20:00') + rem('walk', 'Walk after dinner', '19:00') + rem('plan', 'Sunday: plan my week', '17:00') + '</ul></section>';
  }

  // ---------- LEARN ----------
  function renderLearn() {
    loading();
    api('GET', '/progress').then(function (p) {
      var startId = { pcos: 'pcos-explained', insulin_resistance: 'insulin-resistance', prediabetes: 'prediabetes-metabolic', metabolic_syndrome: 'prediabetes-metabolic', not_sure: 'pcos-explained' }[(state.me.user || {}).focus] || 'pcos-explained';
      var start = state.catalog.lessons.find(function (l) { return l.id === startId; });
      view.innerHTML = '<p class="q">Why does this work?</p><h1>Learn</h1><p class="muted">Short, research-backed reads. A few minutes each. Every section shows its sources.</p>' +
        (start ? '<a class="start-here l-' + start.color + '" href="#/learn/' + start.id + '"><span class="kicker">Start here for your focus</span><b>' + esc(start.title) + '</b><span class="small">' + esc(start.summary) + '</span></a>' : '') +
        '<div class="lesson-grid">' + state.catalog.lessons.map(function (l) {
        var done = p.done.indexOf(l.id) >= 0;
        return '<a class="lesson-card l-' + l.color + '" href="#/learn/' + l.id + '"><span class="lesson-emoji">' + icon(l.icon) + '</span><h2 class="h3">' + esc(l.title) + '</h2><p class="small">' + esc(l.summary) + '</p><span class="tiny">' + l.minutes + ' min read' + (done ? ' · Done' : '') + '</span></a>';
      }).join('') + '</div><p class="tiny muted">Educational only. Not medical advice.</p>';
    }).catch(errorView);
  }
  function renderLesson(id) {
    loading();
    api('GET', '/lessons/' + id).then(function (d) {
      var l = d.lesson;
      view.innerHTML = '<a class="back" href="#/learn">‹ All lessons</a><article class="lesson l-' + l.color + '"><header class="lesson-hero"><span class="lesson-emoji big">' + icon(l.icon) + '</span><h1>' + esc(l.title) + '</h1><p>' + esc(l.summary) + '</p></header>' +
        l.sections.map(function (s) { return '<section class="lesson-sec"><span class="ls-emoji">' + icon(s.icon) + '</span><div><h2 class="h3">' + esc(s.heading) + '</h2><p>' + esc(s.body) + '</p>' + evidence(s.level, s.refs) + '</div></section>'; }).join('') +
        '<div class="btn-row center">' + (d.done ? '<span class="pill done">' + icon('check') + ' Completed</span>' : '<button class="btn" data-complete="' + l.id + '">Mark as done</button>') + (l.id === 'better-plate' ? '<a class="btn btn-ghost" href="#/plate">Try it on my plate</a>' : '') + '</div>' +
        '<p class="tiny muted">Educational only. Not medical advice. Talk with your clinician about your own care.</p></article>';
    }).catch(errorView);
  }

  // ---------- ACCOUNT ----------
  function renderAccount() {
    loading();
    api('GET', '/me').then(function (d) {
      state.me = d; var u = d.user, t = d.targets;
      view.innerHTML = '<h1>Account</h1>' +
        '<section class="card"><h2 class="h3">Your details</h2><p><b>' + esc(u.name) + '</b><br><span class="muted">' + esc(u.email) + '</span></p><p class="small">Plan: Free account. There’s no subscription to cancel.</p></section>' +
        appCard() +
        '<section class="card"><h2 class="h3">My focus</h2><p class="small muted">Tailors the lessons we suggest first. You can change it anytime.</p><div class="ci-chips" role="group" aria-label="My focus">' +
          [['pcos', 'PCOS'], ['insulin_resistance', 'Insulin resistance'], ['prediabetes', 'Prediabetes'], ['metabolic_syndrome', 'Metabolic syndrome'], ['not_sure', 'Not sure yet']].map(function (f) { return '<button type="button" class="chip-btn' + (u.focus === f[0] ? ' on' : '') + '" data-focus="' + f[0] + '" aria-pressed="' + (u.focus === f[0]) + '">' + f[1] + '</button>'; }).join('') + '</div></section>' +
        '<section class="card"><h2 class="h3">Daily targets</h2><p class="small muted">Defaults: fiber 25g (Institute of Medicine), added sugar under 25g (American Heart Association), protein 90g (a starting point, there\u2019s no official PCOS target). Your clinician may suggest different numbers. <a href="/evidence#targets" target="_blank" rel="noopener">Where these come from</a></p><form id="targets-form" class="form" novalidate><div class="grid-3">' +
        '<label>Protein goal (g)<input name="protein" inputmode="numeric" value="' + r0(t.protein) + '"></label><label>Fiber goal (g)<input name="fiber" inputmode="numeric" value="' + r0(t.fiber) + '"></label><label>Added sugar limit (g)<input name="added_sugar" inputmode="numeric" value="' + r0(t.added_sugar) + '"></label></div>' +
        '<button class="btn">Save targets</button><p class="form-error" role="alert" hidden></p></form></section>' +
        '<section class="card"><h2 class="h3">Emails</h2><label class="check"><input type="checkbox" id="mkt"' + (u.marketing_opt_in ? ' checked' : '') + '> <span>Send me tips and updates by email</span></label></section>' +
        '<section class="card"><h2 class="h3">Privacy</h2><p class="small">Cookie choices: <button class="linklike" data-open-cookie-settings>Cookie settings</button></p><div class="btn-row"><a class="btn btn-ghost" href="/api/account/export" download>Download my data</a><button class="btn btn-ghost" data-logout>Log out</button></div></section>' +
        '<section class="card danger-zone"><h2 class="h3">Delete account</h2><p class="small">This permanently deletes your profile, labels, plates, photos, logs and plans. We keep only records the law requires (your consent records).</p>' +
        '<form id="delete-form" class="form" novalidate><label>Type your password to confirm<input type="password" name="password" autocomplete="current-password" required></label><button class="btn danger">Delete my account</button><p class="form-error" role="alert" hidden></p></form></section>';
      document.getElementById('targets-form').addEventListener('submit', function (e) {
        e.preventDefault(); var f = e.target; fieldErrors(f, null);
        api('PUT', '/targets', Object.fromEntries(new FormData(f))).then(function (r) { state.me.targets = r.targets; toast('Targets saved'); }).catch(function (er) { fieldErrors(f, er); });
      });
      document.getElementById('mkt').addEventListener('change', function (e) {
        api('PUT', '/account/marketing', { marketing_opt_in: e.target.checked }).then(function () { toast('Email preference saved'); }).catch(function (er) { toast(er.message, true); });
      });
      document.getElementById('delete-form').addEventListener('submit', function (e) {
        e.preventDefault(); var f = e.target; fieldErrors(f, null);
        if (!confirm('Delete your account and all your data? This can’t be undone.')) return;
        api('DELETE', '/account', { password: f.querySelector('[name=password]').value }).then(function () { location.href = '/?deleted=1'; }).catch(function (er) { fieldErrors(f, er); });
      });
    }).catch(errorView);
  }

  // ---------- global events ----------
  view.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-day]'))) { state.date = addDays(state.date, Number(b.dataset.day)); return renderToday(); }
    if ((b = e.target.closest('[data-add]'))) return openAddSheet(b.dataset.add);
    if ((b = e.target.closest('[data-del-log]'))) return api('DELETE', '/logs/' + b.dataset.delLog).then(renderToday).catch(function (er) { toast(er.message, true); });
    if ((b = e.target.closest('[data-log-recipe]'))) return logEntry({ source: 'recipe', ref_id: b.dataset.logRecipe, meal: b.dataset.meal }).catch(function (er) { toast(er.message, true); });
    if ((b = e.target.closest('[data-log-scan]'))) { state.date = localDate(new Date()); return logEntry({ source: 'scan', ref_id: b.dataset.logScan, meal: mealFor(new Date().getHours()) }).catch(function (er) { toast(er.message, true); }); }
    if ((b = e.target.closest('[data-log-plate]'))) { state.date = localDate(new Date()); return logEntry({ source: 'plate', ref_id: b.dataset.logPlate, meal: mealFor(new Date().getHours()) }).catch(function (er) { toast(er.message, true); }); }
    if ((b = e.target.closest('[data-del-scan]'))) { if (confirm('Delete this label?')) api('DELETE', '/scans/' + b.dataset.delScan).then(function () { toast('Deleted'); location.hash = '#/scan'; }).catch(function (er) { toast(er.message, true); }); return; }
    if ((b = e.target.closest('[data-del-plate]'))) { if (confirm('Delete this plate?')) api('DELETE', '/plates/' + b.dataset.delPlate).then(function () { toast('Deleted'); location.hash = '#/plate'; }).catch(function (er) { toast(er.message, true); }); return; }
    if ((b = e.target.closest('[data-food]'))) {
      var ex = plateState.items.find(function (it) { return it.id === b.dataset.food; });
      var STEPS = [0.5, 1, 1.5, 2, 3];
      if (ex) ex.qty = STEPS[Math.min(STEPS.length - 1, STEPS.indexOf(ex.qty) + 1)]; else plateState.items.push({ id: b.dataset.food, qty: 1 });
      b.classList.add('pop'); setTimeout(function () { b.classList.remove('pop'); }, 250);
      return drawPlateSide();
    }
    if ((b = e.target.closest('[data-rm]'))) { plateState.items.splice(Number(b.dataset.rm), 1); return drawPlateSide(); }
    if ((b = e.target.closest('[data-week]'))) return renderPlan(addDays(planState.week, Number(b.dataset.week)));
    if (e.target.closest('[data-fill]')) return fillWeek();
    if (e.target.closest('[data-clear-week]')) { if (confirm('Clear every meal this week?')) { planState.slots = {}; drawPlan(); savePlan(); } return; }
    if ((b = e.target.closest('[data-complete]'))) return api('POST', '/lessons/' + b.dataset.complete + '/complete').then(function () { toast('Lesson complete'); renderLesson(b.dataset.complete); });
    if (e.target.closest('#plate-peek')) return document.getElementById('plate-side').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if ((b = e.target.closest('[data-ci]'))) { var k = b.dataset.ci, n = Number(b.dataset.v); checkinState[k] = checkinState[k] === n ? null : n; redrawCheckin(); return saveCheckin(); }
    if ((b = e.target.closest('[data-ci-period]'))) { checkinState.period = checkinState.period === b.dataset.ciPeriod ? null : b.dataset.ciPeriod; redrawCheckin(); return saveCheckin(); }
    if ((b = e.target.closest('[data-ci-sym]'))) { var sy = b.dataset.ciSym, li = checkinState.symptoms.indexOf(sy); if (li >= 0) checkinState.symptoms.splice(li, 1); else checkinState.symptoms.push(sy); redrawCheckin(); return saveCheckin(); }
    if ((b = e.target.closest('[data-del-lab]'))) { if (confirm('Delete this result?')) api('DELETE', '/labs/' + b.dataset.delLab).then(renderLabs).catch(function (er) { toast(er.message, true); }); return; }
    if ((b = e.target.closest('[data-focus]'))) return api('PUT', '/account/focus', { focus: b.dataset.focus }).then(function () { state.me.user.focus = b.dataset.focus; toast('Focus saved'); renderAccount(); }).catch(function (er) { toast(er.message, true); });
    if (e.target.closest('[data-scan-camera]')) return openCamera();
    if ((b = e.target.closest('[data-exp-start]'))) return api('POST', '/experiments', { key: b.dataset.expStart, today: localDate(new Date()) }).then(function () { toast('Experiment started. Day 1!'); if (route()[0] === 'today') renderToday(); else renderExperiments(); }).catch(function (er) { toast(er.message, true); });
    if ((b = e.target.closest('[data-exp-today]'))) return api('PUT', '/experiments/' + b.dataset.expToday + '/days/' + b.dataset.expDate, { done: true }).then(function () { toast('Nice. Day logged.'); if (route()[0] === 'today') renderToday(); else renderExperiments(); }).catch(function (er) { toast(er.message, true); });
    if ((b = e.target.closest('[data-exp-day]'))) return api('PUT', '/experiments/' + b.dataset.exp + '/days/' + b.dataset.expDay, { done: b.getAttribute('aria-pressed') !== 'true' }).then(renderExperiments).catch(function (er) { toast(er.message, true); });
    if ((b = e.target.closest('[data-exp-stop]'))) { if (confirm('Stop this experiment?')) api('POST', '/experiments/' + b.dataset.expStop + '/stop').then(renderExperiments).catch(function (er) { toast(er.message, true); }); return; }
    if (e.target.closest('[data-install]')) { if (installEvt) { installEvt.prompt(); installEvt = null; } return; }
    if (e.target.closest('[data-print]')) return window.print();
    if ((b = e.target.closest('[data-need]'))) { var need = store('staples-need') || [], n = b.dataset.need, i = need.indexOf(n); if (i >= 0) need.splice(i, 1); else need.push(n); store('staples-need', need); toast(i >= 0 ? 'Removed from list' : 'Added to grocery list'); return renderStaples(); }
    if (e.target.closest('[data-copy-list]')) { var txt = Array.from(view.querySelectorAll('[data-gitem]')).filter(function (c) { return !c.checked; }).map(function (c) { return '- ' + c.dataset.gitem; }).join('\n'); if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('List copied'); }, function () { toast('Couldn\u2019t copy. Try again.', true); }); return; }
    if (e.target.closest('[data-clear-checks]')) { store('grocery-' + groceryWeek, {}); return renderGrocery(); }
    if (e.target.closest('[data-logout]')) return api('POST', '/auth/logout').then(function () { location.href = '/'; });
  });
  view.addEventListener('change', function (e) {
    var s = e.target;
    if (s.matches('[data-rem-time]')) { var a = view.querySelector('[data-rem="' + s.dataset.remTime + '"]'); if (a && /^\d\d:\d\d$/.test(s.value)) a.href = '/api/reminders.ics?type=' + s.dataset.remTime + '&time=' + s.value; return; }
    if (s.matches('[data-ask]')) { var asked = store('report-asked') || [], qi = Number(s.dataset.ask), at = asked.indexOf(qi); if (s.checked && at < 0) asked.push(qi); if (!s.checked && at >= 0) asked.splice(at, 1); store('report-asked', asked); s.closest('li').classList.toggle('no-print', !s.checked); return; }
    if (s.matches('[data-gitem]')) { var key = 'grocery-' + groceryWeek, c = store(key) || {}; if (s.checked) c[s.dataset.gitem] = 1; else delete c[s.dataset.gitem]; store(key, c); return; }
    if (s.matches('[data-qty]')) { plateState.items[Number(s.dataset.qty)].qty = Number(s.value); drawPlateSide(); }
    if (s.matches('[data-slot]')) {
      var day = planState.slots[s.dataset.slot] = planState.slots[s.dataset.slot] || {};
      if (s.value) day[s.dataset.meal] = s.value; else delete day[s.dataset.meal];
      drawPlan(); savePlan();
    }
  });
  view.addEventListener('input', function (e) { if (plateState && e.target.closest('#plate-save') && e.target.name === 'name') plateState.name = e.target.value; });
  view.addEventListener('input', function (e) { if (e.target.matches('[data-note]')) store('report-note', e.target.value); });
  view.addEventListener('submit', function (e) {
    if (e.target.matches('[data-bc-form]')) { e.preventDefault(); var code = (e.target.querySelector('[name=code]').value || '').replace(/\D/g, ''); if (!code) return toast('Type the numbers under the barcode.', true); return lookupBarcode(code); }
  });
  view.addEventListener('submit', function (e) { if (e.target.id === 'plate-save') { e.preventDefault(); savePlate(e.target); } });

  function route() { return (location.hash.replace(/^#\/?/, '') || 'today').split('/'); }
  function render() {
    stopCamera();
    var r = route(), name = r[0];
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.dataset.nav === name); if (a.dataset.nav === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    window.scrollTo(0, 0);
    if (name === 'today') renderToday();
    else if (name === 'scan') r[1] ? renderScanDetail(r[1], r[2] === 'edit') : renderScan();
    else if (name === 'plate') r[1] ? renderPlateDetail(r[1], r[2] === 'edit') : renderPlate(null);
    else if (name === 'plan') ({ grocery: renderGrocery, snacks: renderSnacks, staples: renderStaples, prep: renderPrep }[r[1]] || function () { renderPlan(); })();
    else if (name === 'me') ({ labs: renderLabs, report: renderReport, experiments: renderExperiments }[r[1]] || renderMe)();
    else if (name === 'learn') r[1] ? renderLesson(r[1]) : renderLearn();
    else if (name === 'account') renderAccount();
    else errorView(new Error('That page doesn’t exist.'));
    view.focus({ preventScroll: true });
  }
  Promise.all([api('GET', '/catalog'), api('GET', '/me')]).then(function (res) {
    state.catalog = res[0]; state.me = res[1];
    window.addEventListener('hashchange', render);
    render();
  }).catch(errorView);
})();
