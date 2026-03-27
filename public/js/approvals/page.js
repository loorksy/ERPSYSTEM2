(function() {
  var currentId = null;
  var currentPinned = false;
function accApprovalsEmptyStateHtml(kind, msg) {
    if (kind === 'loading') {
      return (
        '<div class="col-span-full acc-approvals-empty text-slate-400">' +
        '<i class="fas fa-spinner fa-spin text-3xl text-indigo-400" aria-hidden="true"></i>' +
        '<span class="text-sm font-medium">جاري التحميل...</span></div>'
      );
    }
    if (kind === 'error') {
      return (
        '<div class="col-span-full acc-approvals-empty text-slate-600">' +
        '<i class="fas fa-circle-exclamation text-4xl text-red-400" aria-hidden="true"></i>' +
        '<p class="text-red-600 font-medium text-sm">' + window.accEscHtml(msg || 'حدث خطأ') + '</p></div>'
      );
    }
    return (
      '<div class="col-span-full acc-approvals-empty text-slate-500">' +
      '<span class="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">' +
      '<i class="fas fa-clipboard-list text-4xl" aria-hidden="true"></i></span>' +
      '<p class="font-medium text-slate-600">لا يوجد معتمدون</p>' +
      '<p class="text-xs text-slate-400 max-w-sm leading-relaxed">أضف معتمداً من زر «إضافة معتمد» أو استورد أرصدة من «رفع أرصدة».</p></div>'
    );
  }

  window.accLoad = function() {
    var box = document.getElementById('accCards');
    if (!box) return;
    box.innerHTML = accApprovalsEmptyStateHtml('loading');
    window.accApprovalsApiCall('/api/accreditations/list').then(function(res) {
      if (!res.success) {
        box.innerHTML = accApprovalsEmptyStateHtml('error', res.message || '');
        return;
      }
      var list = res.list || [];
      if (list.length === 0) {
        box.innerHTML = accApprovalsEmptyStateHtml('empty');
        return;
      }
      box.innerHTML = list.map(function(a) {
        var pin = a.pinned ? '<i class="fas fa-thumbtack text-amber-500 ml-1"></i>' : '';
        return '<div class="rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white p-5 shadow-sm cursor-pointer hover:shadow-md hover:border-indigo-200/80 transition-colors" onclick="accOpen(' + a.id + ')">' +
          pin + '<h5 class="font-bold text-slate-900">' + window.accEscHtml(a.name || '') + '</h5>' +
          '<p class="text-xs text-slate-500">' + window.accEscHtml(a.code || '') + '</p>' +
          '<p class="text-indigo-600 font-semibold mt-2 tabular-nums">' + (a.balance_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</p></div>';
      }).join('');
    });
  };

  window.accOpenAdd = function() {
    document.getElementById('accAddModal').classList.remove('hidden');
    document.getElementById('accAddModal').classList.add('flex');
  };
  window.accCloseAdd = function() {
    document.getElementById('accAddModal').classList.add('hidden');
    document.getElementById('accAddModal').classList.remove('flex');
  };

  /** @returns {Promise<string>} قيمة المحدد بعد التعبئة (آخر دورة إن طُلب defaultLatest) */
  function fillCycleSelect(selId, opts) {
    opts = opts || {};
    var sel = document.getElementById(selId);
    if (!sel) return Promise.resolve('');
    return window.accApprovalsApiCall('/api/sub-agencies/cycles/list').then(function(c) {
      var cycles = c.cycles || [];
      var cur = opts.keepSelection ? sel.value : '';
      sel.innerHTML = '<option value="">— دورة (اختياري) —</option>';
      cycles.forEach(function(x) {
        sel.innerHTML += '<option value="' + x.id + '">' + (x.name || x.id) + '</option>';
      });
      if (opts.defaultLatest && cycles.length > 0) {
        sel.value = String(cycles[0].id);
      } else if (cur) {
        sel.value = cur;
      }
      return sel.value || '';
    });
  }
  window.fillCycleSelect = fillCycleSelect;

  function accRefreshDeliveryList(cycleId) {
    var listEl = document.getElementById('accDelList');
    if (!listEl) return;
    listEl.innerHTML = '<p class="text-slate-400">جاري التحميل…</p>';
    var url = '/api/accreditations/with-balance';
    if (cycleId) url += '?cycleId=' + encodeURIComponent(cycleId);
    window.accApprovalsApiCall(url).then(function(res) {
      if (!listEl) return;
      if (!res.success || !(res.list || []).length) {
        listEl.innerHTML = '<p class="text-slate-500">لا يوجد معتمدون برصيد' + (cycleId ? ' له نشاط في الدورة المختارة' : '') + '</p>';
        return;
      }
      listEl.innerHTML = (res.list || []).map(function(a) {
        return '<label class="flex items-center gap-2 p-2 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-50">' +
          '<input type="checkbox" class="acc-del-cb" value="' + a.id + '">' +
          '<span class="flex-1">' + (a.name || '') + ' <span class="text-slate-400 text-xs">' + (a.code || '') + '</span></span>' +
          '<span class="font-semibold text-indigo-600">' + (a.balance_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</span></label>';
      }).join('');
    });
  }

  function accSyncBulkSourcePanels() {
    var sel = document.getElementById('accBulkSourceMethod');
    var v = sel && sel.value ? sel.value : 'file';
    var panels = {
      file: document.getElementById('accBulkPanelFile'),
      paste: document.getElementById('accBulkPanelPaste'),
      sheet: document.getElementById('accBulkPanelSheet'),
    };
    Object.keys(panels).forEach(function(k) {
      var el = panels[k];
      if (!el) return;
      el.classList.toggle('hidden', k !== v);
    });
  }
  window.accSyncBulkSourcePanels = accSyncBulkSourcePanels;

  function wireAccBulkSourceMethod() {
    var sel = document.getElementById('accBulkSourceMethod');
    if (!sel || sel.dataset.accBulkMethodBound) return;
    sel.dataset.accBulkMethodBound = '1';
    sel.addEventListener('change', accSyncBulkSourcePanels);
  }

  function accBulkClearFileNameDisplay() {
    var el = document.getElementById('accBulkFileName');
    if (el) {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }
  window.accBulkClearFileNameDisplay = accBulkClearFileNameDisplay;

  function accBulkUpdateFileNameDisplay() {
    var input = document.getElementById('accBulkFile');
    var el = document.getElementById('accBulkFileName');
    if (!el || !input) return;
    if (input.files && input.files[0]) {
      el.textContent = input.files[0].name;
      el.classList.remove('hidden');
    } else {
      el.textContent = '';
      el.classList.add('hidden');
    }
  }

  function wireAccBulkDropzone() {
    var dz = document.getElementById('accBulkDropzone');
    var input = document.getElementById('accBulkFile');
    if (!dz || !input || dz.dataset.accBulkDzBound) return;
    dz.dataset.accBulkDzBound = '1';
    input.addEventListener('change', accBulkUpdateFileNameDisplay);
    ['dragenter', 'dragover'].forEach(function(ev) {
      dz.addEventListener(ev, function(e) {
        e.preventDefault();
        e.stopPropagation();
        dz.classList.add('acc-bulk-dropzone-drag');
      });
    });
    dz.addEventListener('dragleave', function(e) {
      if (e.relatedTarget && dz.contains(e.relatedTarget)) return;
      dz.classList.remove('acc-bulk-dropzone-drag');
    });
    dz.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      dz.classList.remove('acc-bulk-dropzone-drag');
      var files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      try {
        var dt = new DataTransfer();
        dt.items.add(files[0]);
        input.files = dt.files;
      } catch (err) {}
      accBulkUpdateFileNameDisplay();
    });
  }

  window.accOpenBulk = function() {
    window.accClearBulkStaging();
    accBulkClearFileNameDisplay();
    fillCycleSelect('accBulkCycle', { defaultLatest: true, keepSelection: false });
    var br = document.getElementById('accBulkBroker');
    if (br) {
      br.value = '';
      if (!br.dataset.bound) {
        br.dataset.bound = '1';
        br.addEventListener('input', function() {
          if (window.accBulkStagingItemCount()) window.accRenderStagingTable();
        });
      }
    }
    var method = document.getElementById('accBulkSourceMethod');
    if (method) method.value = 'file';
    accSyncBulkSourcePanels();
    window.accSyncBulkStep();
    var modal = document.getElementById('accBulkModal');
    var body = document.getElementById('accBulkModalBody');
    if (body) body.scrollTop = 0;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  };
  window.accCloseBulk = function() {
    var modal = document.getElementById('accBulkModal');
    var body = document.getElementById('accBulkModalBody');
    if (body) body.scrollTop = 0;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  };
  window.accSubmitBulk = function() {
    var f = document.getElementById('accBulkFile');
    if (!f || !f.files || !f.files[0]) {
      window.accToast('اختر ملفاً', 'error');
      return;
    }
    var fd = new FormData();
    fd.append('file', f.files[0]);
    fetch('/api/accreditations/bulk-balance-parse-file', { method: 'POST', body: fd, credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(res) {
        if (!res.success) {
          window.accToast(res.message || 'فشل', 'error');
          return;
        }
        accShowStagingFromPreview(res.preview || []);
        window.accToast('راجع الصفوف ثم اضغط حفظ الكل', 'success');
      });
  };

  window.accSubmitBulkText = function() {
    var t = document.getElementById('accBulkPaste');
    var txt = t && t.value ? t.value.trim() : '';
    if (!txt) {
      window.accToast('الصق النص أولاً', 'error');
      return;
    }
    window.accApprovalsApiCall('/api/accreditations/bulk-balance-parse-text', {
      method: 'POST',
      body: JSON.stringify({ csvText: txt }),
    }).then(function(res) {
      if (!res.success) {
        window.accToast(res.message || 'فشل', 'error');
        return;
      }
      accShowStagingFromPreview(res.preview || []);
      window.accToast('راجع الصفوف ثم اضغط حفظ الكل', 'success');
    });
  };

  window.accSubmitBulkSheetUrl = function() {
    var u = document.getElementById('accBulkSheetUrl');
    var sn = document.getElementById('accBulkSheetName');
    var url = u && u.value ? u.value.trim() : '';
    if (!url) {
      window.accToast('أدخل رابط الجدول', 'error');
      return;
    }
    window.accApprovalsApiCall('/api/accreditations/bulk-balance-parse-sheet-url', {
      method: 'POST',
      body: JSON.stringify({
        sheetUrl: url,
        sheetName: sn && sn.value ? sn.value.trim() : null,
      }),
    }).then(function(res) {
      if (!res.success) {
        window.accToast(res.message || 'فشل', 'error');
        return;
      }
      var extra = res.sheetTitleUsed ? ' — ' + res.sheetTitleUsed : '';
      accShowStagingFromPreview(res.preview || []);
      window.accToast('تمت المعاينة' + extra, 'success');
    });
  };

  window.accOpenDelivery = function() {
    fillCycleSelect('accDelCycle');
    var listEl = document.getElementById('accDelList');
    if (listEl) listEl.innerHTML = '<p class="text-slate-400">جاري التحميل…</p>';
    document.getElementById('accDeliveryModal').classList.remove('hidden');
    document.getElementById('accDeliveryModal').classList.add('flex');
    window.accApprovalsApiCall('/api/accreditations/with-balance').then(function(res) {
      if (!listEl) return;
      if (!res.success || !(res.list || []).length) {
        listEl.innerHTML = '<p class="text-slate-500">لا يوجد معتمدون برصيد</p>';
        return;
      }
      listEl.innerHTML = (res.list || []).map(function(a) {
        return '<label class="flex items-center gap-2 p-2 rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-50">' +
          '<input type="checkbox" class="acc-del-cb" value="' + a.id + '">' +
          '<span class="flex-1">' + (a.name || '') + ' <span class="text-slate-400 text-xs">' + (a.code || '') + '</span></span>' +
          '<span class="font-semibold text-indigo-600">' + (a.balance_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</span></label>';
      }).join('');
    });
  };
  window.accCloseDelivery = function() {
    document.getElementById('accDeliveryModal').classList.add('hidden');
    document.getElementById('accDeliveryModal').classList.remove('flex');
  };
  window.accSubmitDelivery = function() {
    var boxes = document.querySelectorAll('.acc-del-cb:checked');
    var ids = [];
    boxes.forEach(function(b) { ids.push(parseInt(b.value, 10)); });
    if (!ids.length) {
      window.accToast('حدّد معتمداً واحداً على الأقل', 'error');
      return;
    }
    var cid = document.getElementById('accDelCycle').value || null;
    window.accApprovalsApiCall('/api/accreditations/delivery-settle', {
      method: 'POST',
      body: JSON.stringify({ cycleId: cid, accreditationIds: ids })
    }).then(function(res) {
      window.accToast(res.message || '', res.success ? 'success' : 'error');
      if (res.success) {
        window.accCloseDelivery();
        window.accLoad();
      }
    });
  };

  window.accOpen = function(id) {
    currentId = id;
    window.accApprovalsApiCall('/api/accreditations/' + id).then(function(res) {
      if (!res.success) return;
      var e = res.entity;
      currentPinned = !!e.pinned;
      document.getElementById('accDetailTitle').textContent = e.name || '';
      document.getElementById('accDetailBal').textContent = 'الرصيد: ' + (e.balance_amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
      document.getElementById('accLedger').innerHTML = (res.ledger || []).map(function(l) {
        return '<div class="py-2 border-b border-slate-50 flex justify-between"><span>' + (l.entry_type || '') + '</span><span>' + (l.amount || 0) + '</span></div>';
      }).join('') || '<p class="text-slate-400">فارغ</p>';
      document.getElementById('accAddAmountPanel').classList.add('hidden');
      document.getElementById('accTransferPanel').classList.add('hidden');
      window.accApprovalsApiCall('/api/sub-agencies/cycles/list').then(function(c) {
        var sel = document.getElementById('accCycle');
        sel.innerHTML = '<option value="">— دورة —</option>';
        (c.cycles || []).forEach(function(x) {
          sel.innerHTML += '<option value="' + x.id + '">' + (x.name || x.id) + '</option>';
        });
      });
      window.accApprovalsApiCall('/api/funds/list').then(function(f) {
        var s = document.getElementById('accTfFund');
        s.innerHTML = '<option value="">— صندوق —</option>';
        (f.funds || []).forEach(function(x) {
          s.innerHTML += '<option value="' + x.id + '">' + (x.name || '') + '</option>';
        });
      });
      window.accApprovalsApiCall('/api/transfer-companies/list').then(function(t) {
        var s = document.getElementById('accTfCompany');
        s.innerHTML = '<option value="">— شركة —</option>';
        (t.companies || []).forEach(function(x) {
          s.innerHTML += '<option value="' + x.id + '">' + (x.name || '') + '</option>';
        });
      });
      document.getElementById('accDetailModal').classList.remove('hidden');
      document.getElementById('accDetailModal').classList.add('flex');
    });
  };
  window.accCloseDetail = function() {
    document.getElementById('accDetailModal').classList.add('hidden');
    document.getElementById('accDetailModal').classList.remove('flex');
    currentId = null;
  };

  window.accAmountKindChange = function() {
    var k = document.getElementById('accAmountKind');
    var show = !k || k.value === 'salary';
    document.querySelectorAll('.acc-salary-only').forEach(function(el) {
      el.classList.toggle('hidden', !show);
    });
  };

  window.accShowAddAmount = function() {
    document.getElementById('accAddAmountPanel').classList.toggle('hidden');
    var ak = document.getElementById('accAmountKind');
    if (ak) ak.value = 'salary';
    accAmountKindChange();
  };
  window.accShowTransfer = function() {
    document.getElementById('accTransferPanel').classList.toggle('hidden');
    accTfTypeChange();
  };
  window.accTfTypeChange = function() {
    var t = document.getElementById('accTfType').value;
    document.getElementById('accTfFund').classList.toggle('hidden', t !== 'fund');
    document.getElementById('accTfCompany').classList.toggle('hidden', t !== 'company');
    document.getElementById('accTfShipHint').classList.toggle('hidden', t !== 'shipping');
  };

  window.accSubmitAmount = function() {
    if (!currentId) return;
    window.accApprovalsApiCall('/api/accreditations/' + currentId + '/add-amount', {
      method: 'POST',
      body: JSON.stringify({
        amountKind: document.getElementById('accAmountKind') ? document.getElementById('accAmountKind').value : 'salary',
        salaryDirection: document.getElementById('accSalaryDir').value,
        amount: document.getElementById('accAmt').value,
        brokeragePct: document.getElementById('accBroker').value,
        cycleId: document.getElementById('accCycle').value || null
      })
    }).then(function(res) {
      window.accToast(res.message || '', res.success ? 'success' : 'error');
      if (res.success) window.accOpen(currentId);
    });
  };

  window.accSubmitTransfer = function() {
    if (!currentId) return;
    var t = document.getElementById('accTfType').value;
    var body = {
      transferType: t === 'fund' ? 'fund' : t === 'company' ? 'company' : 'manual',
      amount: document.getElementById('accTfAmt').value,
      fundId: document.getElementById('accTfFund').value,
      companyId: document.getElementById('accTfCompany').value
    };
    window.accApprovalsApiCall('/api/accreditations/' + currentId + '/transfer', { method: 'POST', body: JSON.stringify(body) }).then(function(res) {
      window.accToast(res.message || '', res.success ? 'success' : 'error');
      if (res.success) window.accOpen(currentId);
    });
  };

  window.accTogglePin = function() {
    if (!currentId) return;
    window.accApprovalsApiCall('/api/accreditations/' + currentId + '/pin', {
      method: 'POST',
      body: JSON.stringify({ pinned: !currentPinned })
    }).then(function(res) {
      if (res.success) {
        currentPinned = !currentPinned;
        window.accLoad();
      }
    });
  };

  document.getElementById('accAddForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    window.accApprovalsApiCall('/api/accreditations/add', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('accName').value,
        code: document.getElementById('accCode').value
      })
    }).then(function(res) {
      window.accToast(res.message || '', res.success ? 'success' : 'error');
      if (res.success) {
        window.accCloseAdd();
        window.accLoad();
      }
    });
  });

  function accInitApprovalsPage() {
    wireAccBulkStagingDelegation();
    wireAccBulkSourceMethod();
    wireAccBulkDropzone();
    accSyncBulkSourcePanels();
    window.accLoad();
    accAmountKindChange();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', accInitApprovalsPage);
  } else {
    accInitApprovalsPage();
  }
})();
