(function() {
  var accBulkStagingItems = [];

  function accSyncBulkStep() {
    var modal = document.getElementById('accBulkModal');
    if (!modal) return;
    var st = document.getElementById('accBulkStaging');
    var reviewing = !!(st && !st.classList.contains('hidden') && accBulkStagingItems.length > 0);
    modal.setAttribute('data-acc-step', reviewing ? 'review' : 'import');
  }

  function accScrollBulkModalToStaging() {
    var body = document.getElementById('accBulkModalBody');
    var st = document.getElementById('accBulkStaging');
    if (!body || !st) return;
    var rect = st.getBoundingClientRect();
    var bodyRect = body.getBoundingClientRect();
    var top = rect.top - bodyRect.top + body.scrollTop;
    body.scrollTop = Math.max(0, top - 4);
  }

  function accResetBulkStagingTableScroll() {
    var wrap = document.querySelector('#accBulkStagingTable .acc-bulk-scroll');
    if (!wrap) return;
    wrap.scrollTop = 0;
    wrap.scrollLeft = 0;
  }

  function accShowStagingFromPreview(preview) {
    var valid = (preview || []).filter(function(r) { return r.valid; });
    if (!valid.length) {
      window.accToast('لا توجد صفوف صالحة', 'error');
      return;
    }
    accBulkStagingItems = valid.map(function(r) {
      return {
        lineIndex: r.lineIndex,
        code: r.code,
        name: r.name,
        amount: r.amount,
        parentRef: r.parentRef || '',
        brokeragePct: '',
        salaryDirection: 'to_us',
        amountKind: 'salary',
      };
    });
    accRenderStagingTable();
    var st = document.getElementById('accBulkStaging');
    if (st) st.classList.remove('hidden');
    accSyncBulkStep();
    accResetBulkStagingTableScroll();
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        accScrollBulkModalToStaging();
        accResetBulkStagingTableScroll();
      });
    });
  }

  function accRenderStagingTable() {
    var tb = document.getElementById('accBulkStagingTable');
    if (!tb) return;
    var badge = document.getElementById('accBulkStagingBadge');
    var badgeText = badge && badge.querySelector('.acc-bulk-badge-text');
    if (badgeText) badgeText.textContent = accBulkStagingItems.length + ' صف';
    else if (badge) badge.textContent = accBulkStagingItems.length + ' صف';
    var br = document.getElementById('accBulkBroker');
    var defB = br && br.value !== '' && br.value != null ? br.value : '0';
    if (!accBulkStagingItems.length) {
      tb.innerHTML = '';
      return;
    }

    function rowBp(row, idx) {
      var bpVal = row.brokeragePct !== '' && row.brokeragePct != null && row.brokeragePct !== undefined ? row.brokeragePct : defB;
      return { bpVal: bpVal, lineNum: row.lineIndex != null ? row.lineIndex : idx + 1 };
    }

    function accBulkBpInputValue(bpVal, defB) {
      var v = bpVal !== '' && bpVal != null && bpVal !== undefined ? String(bpVal) : String(defB !== '' && defB != null ? defB : '0');
      if (v === '.' || v === '-' || v === '+' || v === '..' || v.trim() === '') v = '0';
      return v;
    }

    var rows = accBulkStagingItems.map(function(row, idx) {
      var r = rowBp(row, idx);
      return (
        '<tr class="acc-bulk-tr border-b border-slate-100 hover:bg-indigo-50/25 transition-colors">' +
        '<td class="acc-bulk-td p-2 sm:p-3 align-middle text-slate-600 tabular-nums whitespace-nowrap" data-label="#"><span class="acc-bulk-val">' + window.accEscHtml(r.lineNum) + '</span></td>' +
        '<td class="acc-bulk-td p-2 sm:p-3 align-middle font-mono text-sm text-slate-800" data-label="كود"><span class="acc-bulk-val">' + window.accEscHtml(row.code) + '</span></td>' +
        '<td class="acc-bulk-td p-2 sm:p-3 align-middle font-medium text-slate-900 min-w-0" data-label="الاسم"><span class="acc-bulk-val line-clamp-3 break-words inline-block max-w-full">' + window.accEscHtml(row.name) + '</span></td>' +
        '<td class="acc-bulk-td p-2 sm:p-3 align-middle text-indigo-700 font-semibold tabular-nums whitespace-nowrap" data-label="المبلغ"><span class="acc-bulk-val">' + window.accEscHtml(row.amount) + '</span></td>' +
        '<td class="acc-bulk-td p-2 sm:p-3 align-middle" data-label="وساطة %">' +
        '<input type="number" min="0" max="100" step="0.01" class="acc-bulk-bp w-full max-w-full sm:max-w-[5.5rem] min-h-[40px] sm:min-h-[40px] px-3 py-2 sm:py-1.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" data-idx="' + idx + '" value="' + window.accEscHtml(accBulkBpInputValue(r.bpVal, defB)) + '"></td>' +
        '<td class="acc-bulk-td p-2 sm:p-3 align-middle" data-label="الاتجاه">' +
        '<select class="acc-bulk-dir w-full max-w-full min-w-0 min-h-[40px] sm:min-h-[40px] px-3 py-2 sm:py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" data-idx="' + idx + '">' +
        '<option value="to_us"' + (row.salaryDirection === 'to_us' ? ' selected' : '') + '>راتب لنا</option>' +
        '<option value="to_them"' + (row.salaryDirection === 'to_them' ? ' selected' : '') + '>راتب علينا</option></select></td>' +
        '<td class="acc-bulk-td p-2 sm:p-3 align-middle" data-label="النوع">' +
        '<select class="acc-bulk-kind w-full max-w-full min-w-0 min-h-[40px] sm:min-h-[40px] px-3 py-2 sm:py-2 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400" data-idx="' + idx + '">' +
        '<option value="salary"' + (row.amountKind === 'salary' ? ' selected' : '') + '>راتب</option>' +
        '<option value="debt_to_us"' + (row.amountKind === 'debt_to_us' ? ' selected' : '') + '>دين لنا</option></select></td>' +
        '<td class="acc-bulk-td acc-bulk-td-actions p-2 sm:p-3 align-middle whitespace-nowrap" data-label="إجراء">' +
        '<button type="button" class="min-h-[40px] sm:min-h-0 w-full sm:w-auto px-4 py-2 sm:py-0 rounded-xl border border-red-100 sm:border-0 bg-red-50/80 sm:bg-transparent text-red-600 text-sm font-semibold hover:bg-red-100 sm:hover:bg-transparent sm:hover:underline" data-acc-delete="' + idx + '">حذف</button></td></tr>'
      );
    }).join('');

    var colgroup =
      '<colgroup>' +
      '<col style="width:3%">' +
      '<col style="width:8%">' +
      '<col style="width:26%">' +
      '<col style="width:10%">' +
      '<col style="width:8%">' +
      '<col style="width:18%">' +
      '<col style="width:15%">' +
      '<col style="width:12%">' +
      '</colgroup>';

    var thead =
      '<thead class="acc-bulk-thead">' +
      '<tr class="border-b border-slate-100 bg-slate-50 text-slate-700">' +
      '<th class="p-2 sm:p-3 text-xs sm:text-sm font-bold whitespace-nowrap"><span class="inline-flex items-center gap-1.5"><i class="fas fa-hashtag text-[0.65rem] text-slate-400" aria-hidden="true"></i>#</span></th>' +
      '<th class="p-2 sm:p-3 text-xs sm:text-sm font-bold whitespace-nowrap"><span class="inline-flex items-center gap-1.5"><i class="fas fa-barcode text-[0.65rem] text-slate-400" aria-hidden="true"></i>كود</span></th>' +
      '<th class="p-2 sm:p-3 text-xs sm:text-sm font-bold"><span class="inline-flex items-center gap-1.5"><i class="fas fa-user text-[0.65rem] text-slate-400" aria-hidden="true"></i>الاسم</span></th>' +
      '<th class="p-2 sm:p-3 text-xs sm:text-sm font-bold whitespace-nowrap"><span class="inline-flex items-center gap-1.5"><i class="fas fa-coins text-[0.65rem] text-slate-400" aria-hidden="true"></i>المبلغ</span></th>' +
      '<th class="p-2 sm:p-3 text-xs sm:text-sm font-bold whitespace-nowrap"><span class="inline-flex items-center gap-1.5"><i class="fas fa-percent text-[0.65rem] text-slate-400" aria-hidden="true"></i>وساطة %</span></th>' +
      '<th class="p-2 sm:p-3 text-xs sm:text-sm font-bold"><span class="inline-flex items-center gap-1.5"><i class="fas fa-right-left text-[0.65rem] text-slate-400" aria-hidden="true"></i>الاتجاه</span></th>' +
      '<th class="p-2 sm:p-3 text-xs sm:text-sm font-bold"><span class="inline-flex items-center gap-1.5"><i class="fas fa-tag text-[0.65rem] text-slate-400" aria-hidden="true"></i>النوع</span></th>' +
      '<th class="p-2 sm:p-3 text-xs sm:text-sm font-bold w-16"><span class="inline-flex items-center gap-1.5"><i class="fas fa-cog text-[0.65rem] text-slate-400" aria-hidden="true"></i></span></th>' +
      '</tr></thead>';

    tb.innerHTML =
      '<div class="acc-bulk-scroll max-h-[min(38vh,18rem)] sm:max-h-[min(52vh,30rem)] lg:max-h-[min(60vh,38rem)] overflow-y-auto overflow-x-auto overscroll-contain [-webkit-overflow-scrolling:touch]">' +
      '<table class="acc-bulk-review w-full min-w-0 text-right border-collapse text-sm">' +
      colgroup +
      thead +
      '<tbody>' + rows + '</tbody></table></div>';
  }

  function wireAccBulkStagingDelegation() {
    var c = document.getElementById('accBulkStagingTable');
    if (!c || c.dataset.accBulkBound) return;
    c.dataset.accBulkBound = '1';
    c.addEventListener('change', function(e) {
      var t = e.target;
      var idx = parseInt(t.getAttribute('data-idx'), 10);
      if (isNaN(idx) || !accBulkStagingItems[idx]) return;
      if (t.classList.contains('acc-bulk-dir')) accBulkStagingItems[idx].salaryDirection = t.value;
      if (t.classList.contains('acc-bulk-kind')) accBulkStagingItems[idx].amountKind = t.value;
    });
    c.addEventListener('input', function(e) {
      var t = e.target;
      if (!t.classList.contains('acc-bulk-bp')) return;
      var idx = parseInt(t.getAttribute('data-idx'), 10);
      if (isNaN(idx) || !accBulkStagingItems[idx]) return;
      accBulkStagingItems[idx].brokeragePct = t.value;
    });
    c.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-acc-delete]');
      if (!btn) return;
      e.preventDefault();
      var idx = parseInt(btn.getAttribute('data-acc-delete'), 10);
      if (!isNaN(idx)) window.accRemoveStagingRow(idx);
    });
  }

  window.accRemoveStagingRow = function(idx) {
    accBulkStagingItems.splice(idx, 1);
    if (!accBulkStagingItems.length) {
      window.accClearBulkStaging();
      return;
    }
    accRenderStagingTable();
  };

  window.accClearBulkStaging = function() {
    accBulkStagingItems = [];
    var st = document.getElementById('accBulkStaging');
    if (st) st.classList.add('hidden');
    var tb = document.getElementById('accBulkStagingTable');
    if (tb) tb.innerHTML = '';
    accSyncBulkStep();
  };

  window.accCommitBulk = function() {
    if (!accBulkStagingItems.length) {
      window.accToast('لا توجد صفوف', 'error');
      return;
    }
    var cid = document.getElementById('accBulkCycle').value;
    var defBr = document.getElementById('accBulkBroker') ? document.getElementById('accBulkBroker').value : '';
    var items = accBulkStagingItems.map(function(r) {
      return {
        code: r.code,
        name: r.name,
        amount: r.amount,
        parentRef: r.parentRef,
        brokeragePct: r.brokeragePct !== '' && r.brokeragePct != null ? r.brokeragePct : defBr,
        salaryDirection: r.salaryDirection,
        amountKind: r.amountKind,
      };
    });
    window.accApprovalsApiCall('/api/accreditations/bulk-balance-commit', {
      method: 'POST',
      body: JSON.stringify({ cycleId: cid || null, items: items, defaultBrokeragePct: defBr || null }),
    }).then(function(res) {
      window.accToast(res.message || '', res.success ? 'success' : 'error');
      if (res.success) {
        window.accClearBulkStaging();
        window.accCloseBulk();
        var f = document.getElementById('accBulkFile');
        if (f) f.value = '';
        if (typeof window.accBulkClearFileNameDisplay === 'function') window.accBulkClearFileNameDisplay();
        var p = document.getElementById('accBulkPaste');
        if (p) p.value = '';
        var u = document.getElementById('accBulkSheetUrl');
        if (u) u.value = '';
        window.accLoad();
      }
    });
  };

  window.accSyncBulkStep = accSyncBulkStep;
  window.accRenderStagingTable = accRenderStagingTable;
  window.accBulkStagingItemCount = function() {
    return accBulkStagingItems.length;
  };
})();
