/**
 * أدوات مشتركة لصفحة الاعتمادات — يُحمّل أولاً قبل bulk.js و page.js
 */
(function() {
  window.accEscHtml = function(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;');
  };

  window.accApprovalsApiCall = function(url, opts) {
    if (typeof window.apiCall === 'function') return window.apiCall(url, opts);
    return fetch(url, { credentials: 'same-origin', ...opts }).then(function(r) { return r.json(); });
  };

  window.accToast = function(m, t) {
    if (typeof window.showToast === 'function') window.showToast(m, t);
    else alert(m);
  };
})();
