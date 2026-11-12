// Shared fetch helper used by public pages.
window.http = function (method, url, body) {
  return fetch(url, {
    method: method, credentials: 'same-origin',
    headers: Object.assign({ 'X-Requested-With': 'fetch' }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined,
  }).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (d) {
      if (!r.ok) { var e = new Error(d.error || 'Something went wrong. Please try again.'); e.fields = d.fields || {}; e.status = r.status; throw e; }
      return d;
    });
  }, function () { var e = new Error('You seem to be offline. Check your connection and try again.'); e.fields = {}; throw e; });
};
window.showFieldErrors = function (form, err) {
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
};
