(function () {
  function bind(id, handler) { var f = document.getElementById(id); if (f) f.addEventListener('submit', function (e) { e.preventDefault(); handler(f); }); }
  function busy(f, on) { var b = f.querySelector('button[type=submit],button:not([type])'); if (b) { b.disabled = on; b.setAttribute('aria-busy', on ? 'true' : 'false'); } }
  bind('auth-form', function (f) {
    var kind = f.dataset.kind, d = new FormData(f);
    var body = { email: d.get('email'), password: d.get('password') };
    if (kind === 'signup') { body.name = d.get('name'); body.accept_terms = d.get('accept_terms') === 'on'; body.marketing_opt_in = d.get('marketing_opt_in') === 'on'; }
    showFieldErrors(f, null); busy(f, true);
    http('POST', '/api/auth/' + kind, body).then(function () {
      var next = f.dataset.next;
      location.href = next && /^\/(?!\/)/.test(next) ? next : '/app';
    }).catch(function (e) { showFieldErrors(f, e); busy(f, false); });
  });
  bind('forgot-form', function (f) {
    showFieldErrors(f, null); busy(f, true);
    http('POST', '/api/auth/forgot', { email: new FormData(f).get('email') }).then(function () {
      f.outerHTML = '<p class="success">If that email has an account, a reset link is on its way. It works for 1 hour.</p>';
    }).catch(function (e) { showFieldErrors(f, e); busy(f, false); });
  });
  bind('reset-form', function (f) {
    showFieldErrors(f, null); busy(f, true);
    http('POST', '/api/auth/reset', { token: f.dataset.token, password: new FormData(f).get('password') }).then(function () {
      f.outerHTML = '<p class="success">Password saved. <a href="/login">Log in</a></p>';
    }).catch(function (e) { showFieldErrors(f, e); busy(f, false); });
  });
})();
