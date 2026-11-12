(function () {
  var f = document.getElementById('demo-form'), out = document.getElementById('demo-result');
  if (!f) return;
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = Object.fromEntries(new FormData(f));
    showFieldErrors(f, null);
    http('POST', '/api/demo/score', d).then(function (r) {
      out.innerHTML = '<p class="q">What\u2019s in it?</p><div class="result-head"><div class="score-ring ' + r.grade.key + '" style="--pct:' + r.score + '"><span>' + r.score + '</span></div>' +
        '<div><p class="grade-label ' + r.grade.key + '">' + icon(r.grade.icon) + ' ' + esc(r.grade.label) + '</p><p class="muted small">' + esc(d.name) + '</p></div></div>' +
        '<ul class="reasons">' + r.reasons.map(function (x) { return '<li class="' + (x.good ? 'good' : 'bad') + '">' + esc(x.text) + '</li>'; }).join('') + '</ul>' +
        '<div class="swap-box"><b>' + icon('arrows-clockwise') + ' One better swap</b><p>' + esc(r.swap) + '</p></div>' +
        (r.processing ? '<div class="proc-box"><p class="q">What\u2019s been done to it?</p><span class="proc ' + ({ whole: 'c-lime', minimal: 'c-lime', processed: 'c-peri', ultra: 'c-org' }[r.processing.level] || 'c-mute') + '">' + esc(r.processing.label) + '</span><p>' + esc(r.processing.note) + '</p>' +
          (r.processing.found.length ? '<ul class="proc-list">' + r.processing.found.map(function (f) { return '<li><b>' + esc(f.group) + ':</b> ' + esc(f.items.join(', ')) + '</li>'; }).join('') + '</ul>' : '') + '</div>' : '') +
        '<a class="btn btn-block" href="/signup">Save your scans with a free account</a>';
    }).catch(function (err) { showFieldErrors(f, err); });
  });
})();
