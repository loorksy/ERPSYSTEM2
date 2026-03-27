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

  function fillPaymentDueCycle(cycles) {
    var sel = document.getElementById('paymentDueCycle');
    if (!sel) return;
    sel.innerHTML = '<option value="">— بدون دورة —</option>';
    (cycles || []).forEach(function(c) {
      sel.innerHTML += '<option value="' + c.id + '">' + esc(c.name || c.id) + '</option>';
    });
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
          var ag = document.getElementById('recvAgencies');
          if (ag) ag.innerHTML = '<p class="text-red-600">' + esc(err) + '</p>';
          return;
        }
        totalEl.textContent = fmt(d.totalUsd);

        var pd = d.paymentDue;
        var pdVal = document.getElementById('paymentDueTotalVal');
        if (pdVal) pdVal.textContent = pd && pd.totalUsd != null ? fmt(pd.totalUsd) : '0.00';

        fetch('/api/sheet/cycles', { credentials: 'same-origin' })
          .then(function(r) { return r.json(); })
          .then(function(cres) {
            fillPaymentDueCycle(cres.cycles || []);
          })
          .catch(function() { fillPaymentDueCycle([]); });

        var accBox = document.getElementById('paymentDueAccList');
        if (accBox && pd && (pd.accreditations || []).length) {
          accBox.innerHTML = '<p class="text-xs opacity-90 mb-1">معتمدون (رصيد موجب)</p>' +
            (pd.accreditations || []).map(function(x) {
              return '<label class="flex items-center gap-2 py-1 cursor-pointer">' +
                '<input type="checkbox" class="pd-acc-cb" value="' + x.id + '">' +
                '<span class="flex-1">' + esc(x.name) + '</span>' +
                '<span class="tabular-nums">' + fmt(x.amountDueUsd) + '</span></label>';
            }).join('');
        } else if (accBox) {
          accBox.innerHTML = '<p class="opacity-90 text-sm">لا مطلوب دفع من معتمدين (لا رصيد موجب).</p>';
        }

        var subBox = document.getElementById('paymentDueSubList');
        if (subBox && pd && (pd.subAgencies || []).length) {
          subBox.innerHTML = '<p class="text-xs opacity-90 mb-1">وكالات فرعية (رصيد لصالحها)</p>' +
            (pd.subAgencies || []).map(function(x) {
              return '<label class="flex items-center gap-2 py-1 cursor-pointer">' +
                '<input type="checkbox" class="pd-sub-cb" value="' + x.id + '">' +
                '<span class="flex-1">' + esc(x.name) + '</span>' +
                '<span class="tabular-nums">' + fmt(x.amountDueUsd) + '</span></label>';
            }).join('');
        } else if (subBox) {
          subBox.innerHTML = '<p class="opacity-90 text-sm">لا مطلوب دفع من وكالات (لا رصيد موجب).</p>';
        }

        var ag = document.getElementById('recvAgencies');
        if (ag) {
          if (!d.subAgencies || !d.subAgencies.length) {
            ag.innerHTML = listEmpty('لا يوجد دين لنا مسجّل من الوكالات (لا رصيد سالب للوكالة)');
          } else {
            ag.innerHTML = '<ul class="divide-y divide-slate-100">' + d.subAgencies.map(function(x) {
              var amt = x.amountOwedToUs != null ? x.amountOwedToUs : Math.abs(parseFloat(x.balanceRaw) || 0);
              return '<li class="py-2 flex justify-between gap-4"><span>' + esc(x.name) +
                '</span><span class="font-semibold text-emerald-700 tabular-nums">' + fmt(amt) + '</span></li>';
            }).join('') + '</ul>';
          }
        }

        var ac = document.getElementById('recvAccred');
        if (ac) {
          var alist = d.accreditations || [];
          ac.innerHTML = alist.length
            ? '<ul class="divide-y divide-slate-100">' + alist.map(function(x) {
              return '<li class="py-2 flex justify-between gap-4"><span>' + esc(x.name) +
                '</span><span class="font-semibold tabular-nums text-emerald-700">' + fmt(x.amountOwedToUs) + '</span></li>';
            }).join('') + '</ul>'
            : listEmpty('لا أرصدة معتمدين لنا (رصيد سالب)');
        }

        var mb = document.getElementById('recvMembers');
        if (mb) {
          var mlist = d.members || [];
          mb.innerHTML = mlist.length
            ? '<ul class="divide-y divide-slate-100">' + mlist.map(function(x) {
              return '<li class="py-2 flex justify-between gap-4"><span class="font-mono">' + esc(x.memberUserId) +
                '</span><span class="font-semibold tabular-nums text-emerald-700">' + fmt(x.amountOwedToUs) + '</span></li>';
            }).join('') + '</ul>'
            : listEmpty('لا ديون مستخدمين على العضو');
        }

        var rt = document.getElementById('recvReturns');
        if (rt) {
          var rp = d.returnsPendingUsd != null ? d.returnsPendingUsd : 0;
          rt.textContent = rp > 0.0001 ? 'إجمالي مرتجعات معلّقة: ' + fmt(rp) : 'لا مرتجعات معلّقة مسجّلة.';
        }
      })
      .catch(function() {
        totalEl.textContent = '—';
      });

    var settleBtn = document.getElementById('paymentDueSettleBtn');
    if (settleBtn) {
      settleBtn.addEventListener('click', function() {
        var accIds = [];
        document.querySelectorAll('.pd-acc-cb:checked').forEach(function(cb) {
          accIds.push(parseInt(cb.value, 10));
        });
        var subIds = [];
        document.querySelectorAll('.pd-sub-cb:checked').forEach(function(cb) {
          subIds.push(parseInt(cb.value, 10));
        });
        if (!accIds.length && !subIds.length) {
          if (typeof window.showToast === 'function') window.showToast('حدّد صفاً واحداً على الأقل', 'error');
          else alert('حدّد صفاً واحداً على الأقل');
          return;
        }
        var cyc = document.getElementById('paymentDueCycle');
        var cycleId = cyc && cyc.value ? parseInt(cyc.value, 10) : null;
        settleBtn.disabled = true;
        fetch('/api/payment-due/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            cycleId: cycleId || null,
            accreditationIds: accIds,
            subAgencyIds: subIds
          })
        })
          .then(function(r) { return r.json(); })
          .then(function(res) {
            if (typeof window.showToast === 'function') window.showToast(res.message || '', res.success ? 'success' : 'error');
            else alert(res.message || '');
            if (res.success) window.location.reload();
          })
          .catch(function() {
            if (typeof window.showToast === 'function') window.showToast('فشل الطلب', 'error');
          })
          .finally(function() {
            settleBtn.disabled = false;
          });
      });
    }
  });
})();
