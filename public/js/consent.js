// Consent banner. Nothing non-essential runs until the visitor says yes.
(function () {
  var VERSION = 'banner-v1';
  var gpc = navigator.globalPrivacyControl === true;

  function readChoice() {
    var m = document.cookie.match(/(?:^|;\s*)cc=([^;]+)/);
    if (!m) return null;
    try { var v = JSON.parse(decodeURIComponent(m[1])); return v && v.v === VERSION ? v.c : null; } catch (e) { return null; }
  }
  function region() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    if (/^Europe\/(London|Belfast|Guernsey|Isle_of_Man|Jersey)$/.test(tz)) return 'UK';
    if (/^(Europe|Atlantic\/(Canary|Madeira|Azores|Reykjavik))\//.test(tz)) return 'EU';
    if (tz === 'America/Los_Angeles') return 'US-CA';
    if (/^(America|Pacific\/Honolulu)/.test(tz)) return 'US';
    return 'OTHER';
  }
  // Only activates scripts whose category the visitor allowed.
  function activate(cats) {
    document.querySelectorAll('script[type="text/plain"][data-consent]').forEach(function (s) {
      var cat = s.getAttribute('data-consent');
      if (!cats || !cats[cat] || s.dataset.activated) return;
      var n = document.createElement('script');
      if (s.dataset.src) n.src = s.dataset.src; else n.textContent = s.textContent;
      s.dataset.activated = '1';
      document.head.appendChild(n);
    });
  }

  var el;
  function build() {
    el = document.createElement('div');
    el.className = 'cc-banner';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-labelledby', 'cc-title');
    el.innerHTML =
      '<div class="cc-inner">' +
      '<h2 id="cc-title" class="cc-title">Your privacy choices</h2>' +
      '<p class="cc-text">We use necessary cookies to keep you logged in. With your OK, we could also use analytics or marketing cookies. We never sell your data. Read the <a href="/cookies">Cookie Policy</a>.</p>' +
      (gpc ? '<p class="cc-gpc">Your browser sent a Global Privacy Control signal, so marketing stays off.</p>' : '') +
      '<div class="cc-prefs" hidden>' +
      '<label class="cc-row"><input type="checkbox" checked disabled> <span><b>Necessary</b> Login and remembering this choice. Always on.</span></label>' +
      '<label class="cc-row"><input type="checkbox" name="analytics"> <span><b>Analytics</b> Helps us see which features get used.</span></label>' +
      '<label class="cc-row"><input type="checkbox" name="marketing"' + (gpc ? ' disabled' : '') + '> <span><b>Marketing</b> Used to measure campaigns.' + (gpc ? ' (Off because of Global Privacy Control.)' : '') + '</span></label>' +
      '</div>' +
      '<div class="cc-actions">' +
      '<button type="button" class="btn btn-small" data-cc="accept_all">Accept all</button>' +
      '<button type="button" class="btn btn-small" data-cc="reject_all">Reject all</button>' +
      '<button type="button" class="btn btn-small btn-ghost" data-cc="manage">Manage preferences</button>' +
      '<button type="button" class="btn btn-small btn-ghost" data-cc="save" hidden>Save my choices</button>' +
      '</div><p class="cc-error" role="alert" hidden></p></div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cc]');
      if (!b) return;
      var a = b.getAttribute('data-cc');
      if (a === 'manage') {
        el.querySelector('.cc-prefs').hidden = false;
        el.querySelector('[data-cc="save"]').hidden = false;
        b.hidden = true;
        return;
      }
      var cats = { analytics: el.querySelector('[name=analytics]').checked, marketing: el.querySelector('[name=marketing]').checked };
      save(a === 'save' ? 'custom' : a, cats);
    });
  }
  function open() {
    if (!el) build();
    var cur = readChoice() || {};
    el.querySelector('[name=analytics]').checked = !!cur.analytics;
    el.querySelector('[name=marketing]').checked = !!cur.marketing && !gpc;
    el.hidden = false;
    var first = el.querySelector('button');
    if (first) first.focus();
  }
  function save(choice, cats) {
    var err = el.querySelector('.cc-error');
    err.hidden = true;
    fetch('/api/consent', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: JSON.stringify({ choice: choice, categories: cats, region: region(), gpc: gpc }),
    }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
      .then(function (d) { el.hidden = true; activate(d.categories); document.dispatchEvent(new CustomEvent('consentchange', { detail: d.categories })); })
      .catch(function () { err.textContent = 'We couldn’t save that. Please try again.'; err.hidden = false; });
  }

  window.cookieConsent = { open: open, get: readChoice };
  function init() {
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-cookie-settings]')) { e.preventDefault(); open(); }
    });
    var c = readChoice();
    if (c) activate(c); else open();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
