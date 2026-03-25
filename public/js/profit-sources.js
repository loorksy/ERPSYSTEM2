(function() {
  'use strict';

  function apiCall(url, opts) {
    if (typeof window.apiCall === 'function') return window.apiCall(url, opts);
    return fetch(url, { credentials: 'same-origin', ...opts }).then(function(r) { return r.json(); });
  }
  function fmt(n) {
    if (typeof window.formatMoney === 'function') return window.formatMoney(n);
    return (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' $';
  }

  document.addEventListener('DOMContentLoaded', function() {
    var box = document.getElementById('profitSourcesBox');
    if (!box) return;
    apiCall('/api/expenses/net-profit-by-source').then(function(res) {
      if (!res.success) {
        box.innerHTML = '<p class="p-8 text-center text-sm text-red-600">' + (res.message || 'فشل') + '</p>';
        return;
      }
      var rows = res.rows || [];
      if (!rows.length) {
        box.innerHTML = '<p class="p-8 text-center text-sm text-slate-400">لا توجد قيود صافي ربح بعد</p>';
        return;
      }
      box.innerHTML =
        '<div class="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50">' +
        '<table class="w-full text-right text-sm">' +
        '<thead><tr class="bg-slate-100/90 text-slate-700 border-b border-slate-200">' +
        '<th class="px-4 py-2.5 font-semibold text-xs">نوع المصدر</th>' +
        '<th class="px-4 py-2.5 font-semibold text-xs">الإجمالي</th></tr></thead><tbody class="bg-white">' +
        rows.map(function(r) {
          return '<tr class="border-b border-slate-100 hover:bg-slate-50/80">' +
            '<td class="px-4 py-2.5 font-mono text-xs text-slate-800">' + (r.source_type || '') + '</td>' +
            '<td class="px-4 py-2.5 font-semibold tabular-nums text-indigo-700">' + fmt(r.total) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>';
    });
  });
})();
