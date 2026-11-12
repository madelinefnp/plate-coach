(function () {
  var f = document.getElementById('pr-form');
  if (!f) return;
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = new FormData(f);
    showFieldErrors(f, null);
    f.querySelector('button').disabled = true;
    http('POST', '/api/privacy-request', { email: d.get('email'), type: d.get('type'), details: d.get('details'), website: d.get('website') })
      .then(function () { f.hidden = true; document.getElementById('pr-done').hidden = false; })
      .catch(function (err) { showFieldErrors(f, err); f.querySelector('button').disabled = false; });
  });
})();
