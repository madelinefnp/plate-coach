(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function when(s) { return s ? new Date(s).toLocaleString() : ''; }
  function table(id, cols, rows, extra) {
    var t = document.getElementById(id);
    t.innerHTML = '<thead><tr>' + cols.map(function (c) { return '<th>' + esc(c[1]) + '</th>'; }).join('') + (extra ? '<th>Actions</th>' : '') + '</tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) { return '<tr>' + cols.map(function (c) { return '<td>' + (c[2] ? c[2](r[c[0]], r) : esc(r[c[0]])) + '</td>'; }).join('') + (extra ? '<td>' + extra(r) + '</td>' : '') + '</tr>'; }).join('')
        : '<tr><td colspan="' + (cols.length + (extra ? 1 : 0)) + '" class="muted">Nothing here yet.</td></tr>') + '</tbody>';
  }
  function loadConsents() {
    var f = document.getElementById('consent-filter'), q = new URLSearchParams(new FormData(f)).toString();
    document.getElementById('consent-csv').href = '/api/admin/consents.csv?' + q;
    http('GET', '/api/admin/consents?' + q).then(function (d) {
      table('consent-table', [['created_at', 'Date', when], ['choice', 'Choice'], ['categories', 'Categories'], ['region', 'Region'], ['gpc', 'GPC', function (v) { return v ? 'yes' : 'no'; }], ['visitor_id', 'Visitor'], ['user_id', 'User'], ['banner_version', 'Banner'], ['policy_version', 'Policy']], d.rows);
    });
  }
  function loadSignups() { http('GET', '/api/admin/signups').then(function (d) { table('signup-table', [['created_at', 'Date', when], ['user_id', 'User'], ['terms_version', 'Terms'], ['privacy_version', 'Privacy'], ['marketing_opt_in', 'Marketing', function (v) { return v ? 'yes' : 'no'; }]], d.rows); }); }
  function loadRequests() {
    http('GET', '/api/admin/requests').then(function (d) {
      table('request-table', [['created_at', 'Date', when], ['email', 'Email'], ['type', 'Type'], ['status', 'Status', function (v) { return '<span class="pill ' + esc(v) + '">' + esc(v.replace('_', ' ')) + '</span>'; }], ['details', 'Details'], ['completed_at', 'Completed', when]], d.rows,
        function (r) { return ['new', 'in_progress', 'done'].map(function (s) { return '<button class="btn btn-tiny' + (r.status === s ? '' : ' btn-ghost') + '" data-req="' + esc(r.id) + '" data-status="' + s + '">' + s.replace('_', ' ') + '</button>'; }).join(' '); });
    });
  }
  function loadOutbox() { http('GET', '/api/admin/outbox').then(function (d) { table('outbox-table', [['created_at', 'Date', when], ['to_addr', 'To'], ['subject', 'Subject'], ['status', 'Status']], d.rows); }); }
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (tab) {
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('on', t === tab); });
      document.querySelectorAll('.admin-panel').forEach(function (p) { p.hidden = p.dataset.panel !== tab.dataset.tab; });
    }
    var b = e.target.closest('[data-req]');
    if (b) http('PUT', '/api/admin/requests/' + b.dataset.req, { status: b.dataset.status }).then(loadRequests);
  });
  document.getElementById('consent-filter').addEventListener('submit', function (e) { e.preventDefault(); loadConsents(); });
  loadConsents(); loadSignups(); loadRequests(); loadOutbox();
})();
