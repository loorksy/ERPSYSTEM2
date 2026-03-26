(function() {
  'use strict';

  function fmt(n) {
    if (typeof window.formatMoney === 'function') return window.formatMoney(n);
    return (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' $';
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function listEmpty(msg) {
    return '<p class="text-slate-400 py-2">' + esc(msg) + '</p>';
  }

  document.addEventListener('DOMContentLoaded', function() {
    var totalEl = document.getElementById('recvToUsTotalVal');
    if (!totalEl) return;

    fetch('/dashboard/receivables-to-us', { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) {
          totalEl.textContent = '—';
          var err = d.message || 'فشل التحميل';
          ['recvAccreditation', 'recvCompanies', 'recvFunds', 'recvAgencies'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.innerHTML = '<p class="text-red-600">' + esc(err) + '</p>';
          });
          return;
        }
        totalEl.textContent = fmt(d.totalUsd);

        var acc = document.getElementById('recvAccreditation');
        if (acc) {
          if (!d.accreditation || !d.accreditation.length) acc.innerHTML = listEmpty('لا توجد أرصدة موجبة');
          else {
            acc.innerHTML = '<ul class="divide-y divide-slate-100">' + d.accreditation.map(function(x) {
              return '<li class="py-2 flex justify-between gap-4"><span>' + esc(x.name) +
                (x.code ? ' <span class="text-slate-400 text-xs">(' + esc(x.code) + ')</span>' : '') +
                '</span><span class="font-semibold text-emerald-700 tabular-nums">' + fmt(x.amount) + '</span></li>';
            }).join('') + '</ul>';
          }
        }

        var comp = document.getElementById('recvCompanies');
        if (comp) {
          if (!d.transferCompanies || !d.transferCompanies.length) comp.innerHTML = listEmpty('لا توجد أرصدة موجبة');
          else {
            comp.innerHTML = '<ul class="divide-y divide-slate-100">' + d.transferCompanies.map(function(x) {
              return '<li class="py-2 flex justify-between gap-4"><span>' + esc(x.name) + '</span>' +
                '<span class="font-semibold text-emerald-700 tabular-nums">' + fmt(x.amount) + '</span></li>';
            }).join('') + '</ul>';
          }
        }

        var fd = document.getElementById('recvFunds');
        if (fd) {
          if (!d.funds || !d.funds.length) fd.innerHTML = listEmpty('لا توجد أرصدة موجبة');
          else {
            fd.innerHTML = '<ul class="divide-y divide-slate-100">' + d.funds.map(function(x) {
              return '<li class="py-2 flex justify-between gap-4"><span>' + esc(x.name) +
                '</span><span class="font-semibold text-emerald-700 tabular-nums">' + fmt(x.amount) + ' ' + esc(x.currency || 'USD') + '</span></li>';
            }).join('') + '</ul>';
          }
        }

        var ag = document.getElementById('recvAgencies');
        if (ag) {
          if (!d.subAgencies || !d.subAgencies.length) {
            ag.innerHTML = listEmpty('لا يوجد دين مسجل لنا من الوكالات (رصيد محاسبي سالب للوكالة فقط)');
          } else {
            ag.innerHTML = '<ul class="divide-y divide-slate-100">' + d.subAgencies.map(function(x) {
              var amt = x.amountOwedToUs != null ? x.amountOwedToUs : Math.abs(parseFloat(x.balance) || 0);
              return '<li class="py-2 flex justify-between gap-4"><span>' + esc(x.name) +
                '</span><span class="font-semibold text-emerald-700 tabular-nums">' + fmt(amt) + '</span></li>';
            }).join('') + '</ul>';
          }
        }
      })
      .catch(function() {
        totalEl.textContent = '—';
      });
  });
})();
