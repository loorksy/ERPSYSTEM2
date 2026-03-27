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

  function fillCycleSelect(cycles) {
    var sel = document.getElementById('paymentDueCycle');
    if (!sel) return;
    sel.innerHTML = '<option value="">— بدون ربط بدورة —</option>';
    (cycles || []).forEach(function(c) {
      sel.innerHTML += '<option value="' + c.id + '">' + esc(c.name || c.id) + '</option>';
    });
  }

  function renderDetail(containerId, rows, emptyMsg) {
    var el = document.getElementById(containerId);
    if (!el) return;
    if (!rows || !rows.length) {
      el.innerHTML = '<p class="text-slate-400 py-2">' + esc(emptyMsg) + '</p>';
      return;
    }
    el.innerHTML = '<ul class="divide-y divide-slate-100">' + rows.map(function(x) {
      var label = x.name || '';
      var amt = x.amountDueUsd != null ? x.amountDueUsd : x.amount;
      return '<li class="py-2.5 flex justify-between gap-3"><span class="text-slate-700">' + esc(label) +
        '</span><span class="font-semibold tabular-nums text-amber-700">' + fmt(amt) + '</span></li>';
    }).join('') + '</ul>';
  }

  document.addEventListener('DOMContentLoaded', function() {
    var totalEl = document.getElementById('paymentDueTotalVal');
    if (!totalEl) return;

    fetch('/api/sheet/cycles', { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(cres) {
        fillCycleSelect(cres.cycles || []);
      })
      .catch(function() { fillCycleSelect([]); });

    fetch('/dashboard/payment-due', { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success) {
          totalEl.textContent = '—';
          var err = d.message || 'فشل التحميل';
          var accBox = document.getElementById('paymentDueAccList');
          if (accBox) accBox.innerHTML = '<p class="text-red-600">' + esc(err) + '</p>';
          return;
        }
        var pd = d;
        totalEl.textContent = pd.totalUsd != null ? fmt(pd.totalUsd) : '0.00';

        renderDetail('paymentDueAccDetail', pd.accreditations || [], 'لا مستحقات معتمدين حالياً.');
        renderDetail('paymentDueSubDetail', pd.subAgencies || [], 'لا مستحقات وكالات حالياً.');

        var accBox = document.getElementById('paymentDueAccList');
        if (accBox && (pd.accreditations || []).length) {
          accBox.innerHTML = '<p class="text-xs font-semibold text-slate-600 mb-2">اختر معتمدين</p>' +
            (pd.accreditations || []).map(function(x) {
              return '<label class="flex items-center gap-3 py-2 px-3 rounded-xl border border-slate-100 hover:bg-amber-50/50 cursor-pointer transition-colors">' +
                '<input type="checkbox" class="pd-acc-cb rounded border-slate-300 text-amber-600 focus:ring-amber-500" value="' + x.id + '">' +
                '<span class="flex-1 text-slate-800">' + esc(x.name) + '</span>' +
                '<span class="font-semibold tabular-nums text-amber-700">' + fmt(x.amountDueUsd) + '</span></label>';
            }).join('');
        } else if (accBox) {
          accBox.innerHTML = '<p class="text-slate-400 py-2">لا يوجد معتمدون برصيد موجب.</p>';
        }

        var subBox = document.getElementById('paymentDueSubList');
        if (subBox && (pd.subAgencies || []).length) {
          subBox.innerHTML = '<p class="text-xs font-semibold text-slate-600 mb-2">اختر وكالات فرعية</p>' +
            (pd.subAgencies || []).map(function(x) {
              return '<label class="flex items-center gap-3 py-2 px-3 rounded-xl border border-slate-100 hover:bg-amber-50/50 cursor-pointer transition-colors">' +
                '<input type="checkbox" class="pd-sub-cb rounded border-slate-300 text-amber-600 focus:ring-amber-500" value="' + x.id + '">' +
                '<span class="flex-1 text-slate-800">' + esc(x.name) + '</span>' +
                '<span class="font-semibold tabular-nums text-amber-700">' + fmt(x.amountDueUsd) + '</span></label>';
            }).join('');
        } else if (subBox) {
          subBox.innerHTML = '<p class="text-slate-400 py-2">لا توجد وكالات برصيد لصالحها.</p>';
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
          if (typeof window.showToast === 'function') window.showToast('حدّد بنداً واحداً على الأقل', 'error');
          else alert('حدّد بنداً واحداً على الأقل');
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
