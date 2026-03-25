(function () {
  if (typeof Handsontable === 'undefined') {
    console.error('Handsontable not loaded');
    return;
  }

  var cycleId = typeof window.PN_CYCLE_ID === 'number' ? window.PN_CYCLE_ID : parseInt(String(window.PN_CYCLE_ID || '0'), 10);
  if (!cycleId) {
    window.location.href = '/payroll';
    return;
  }

  var COLS = (function () {
    var o = [];
    var i, j;
    for (i = 0; i < 26; i++) o.push(String.fromCharCode(65 + i));
    for (i = 0; i < 26; i++) for (j = 0; j < 26; j++) o.push(String.fromCharCode(65 + i) + String.fromCharCode(65 + j));
    return o;
  })();

  var state = {
    cycleId: cycleId,
    sheetIndex: { management: 0, agent: 0, userInfo: 0 },
    workbooks: {
      management: { sheets: [{ name: 'ورقة1', rows: [['']] }] },
      agent: { sheets: [{ name: 'ورقة1', rows: [['']] }] },
      userInfo: { sheets: [{ name: 'ورقة1', rows: [['']] }] },
    },
    settings: {},
    hotMgmt: null,
    hotAgent: null,
    hotUser: null,
  };

  function $(id) {
    return document.getElementById(id);
  }

  function showToast(msg, type) {
    if (typeof window.showToast === 'function') window.showToast(msg, type);
    else alert(msg);
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function fillColSelects() {
    document.querySelectorAll('.pn-col-select').forEach(function (sel) {
      if (sel.options.length) return;
      COLS.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
      });
    });
  }

  function setSelectValue(id, val) {
    var el = $(id);
    if (!el) return;
    el.value = val || el.options[0].value;
  }

  function hotDataToRows(hot) {
    return hot.getData().map(function (row) {
      return row.map(function (cell) {
        return cell === null || cell === undefined ? '' : cell;
      });
    });
  }

  function ensureMinRows(rows) {
    return rows && rows.length ? rows : [['']];
  }

  function hotHeightFor(kind) {
    var vh = window.innerHeight;
    var w = window.innerWidth;
    if (kind === 'userInfo') {
      if (w >= 1024) return Math.max(200, Math.floor(vh * 0.28));
      return Math.max(200, Math.floor(vh * 0.3));
    }
    if (w >= 1024) return Math.max(200, Math.floor((vh - 320) / 2.15));
    return Math.max(200, Math.floor(vh * 0.32));
  }

  function destroyOne(kind) {
    var key = kind === 'management' ? 'hotMgmt' : kind === 'agent' ? 'hotAgent' : 'hotUser';
    var elId = kind === 'management' ? 'pnHotMgmt' : kind === 'agent' ? 'pnHotAgent' : 'pnHotUser';
    if (state[key]) {
      try {
        state[key].destroy();
      } catch (e) {}
      state[key] = null;
    }
    var c = $(elId);
    if (c) c.innerHTML = '';
  }

  function renderHot(kind) {
    destroyOne(kind);
    var sheets = state.workbooks[kind].sheets;
    if (!sheets.length) sheets.push({ name: 'ورقة1', rows: [['']] });
    var idx = state.sheetIndex[kind] || 0;
    if (idx >= sheets.length) idx = sheets.length - 1;
    state.sheetIndex[kind] = idx;
    var sheet = sheets[idx];
    var rows = ensureMinRows(sheet.rows || [['']]);
    sheet.rows = rows;

    var elId = kind === 'management' ? 'pnHotMgmt' : kind === 'agent' ? 'pnHotAgent' : 'pnHotUser';
    var container = $(elId);
    if (!container) return;

    var wrap = document.createElement('div');
    wrap.className = 'w-full';
    container.appendChild(wrap);

    var h = hotHeightFor(kind);
    var hot = new Handsontable(wrap, {
      data: rows,
      stretchH: 'all',
      rowHeaders: true,
      colHeaders: true,
      height: h,
      licenseKey: 'non-commercial-and-evaluation',
      layoutDirection: 'rtl',
      contextMenu: true,
      manualColumnResize: true,
      manualRowResize: true,
      afterChange: function () {
        var sh = state.workbooks[kind].sheets[state.sheetIndex[kind]];
        if (sh) sh.rows = hotDataToRows(hot);
      },
    });

    if (kind === 'management') state.hotMgmt = hot;
    else if (kind === 'agent') state.hotAgent = hot;
    else state.hotUser = hot;
  }

  function renderSheetTabs(kind) {
    var sheets = state.workbooks[kind].sheets;
    var wrapId =
      kind === 'management' ? 'pnMgmtSheetTabs' : kind === 'agent' ? 'pnAgentSheetTabs' : 'pnUserSheetTabs';
    var wrap = $(wrapId);
    if (!wrap) return;
    wrap.innerHTML = '';
    var activeIdx = state.sheetIndex[kind] || 0;
    sheets.forEach(function (s, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'px-2.5 py-1 rounded-lg text-xs border max-w-[140px] truncate ' +
        (i === activeIdx ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200');
      btn.title = s.name || 'ورقة';
      btn.textContent = s.name || 'ورقة ' + (i + 1);
      btn.addEventListener('click', function () {
        syncKindFromHot(kind);
        state.sheetIndex[kind] = i;
        renderSheetTabs(kind);
        renderHot(kind);
      });
      wrap.appendChild(btn);
    });
  }

  function syncKindFromHot(kind) {
    var hot =
      kind === 'management' ? state.hotMgmt : kind === 'agent' ? state.hotAgent : state.hotUser;
    if (!hot) return;
    var sh = state.workbooks[kind].sheets[state.sheetIndex[kind]];
    if (sh) sh.rows = hotDataToRows(hot);
  }

  function syncAllFromHots() {
    syncKindFromHot('management');
    syncKindFromHot('agent');
    syncKindFromHot('userInfo');
  }

  function renderAll() {
    renderSheetTabs('management');
    renderSheetTabs('agent');
    renderSheetTabs('userInfo');
    renderHot('management');
    renderHot('agent');
    renderHot('userInfo');
  }

  function readSettingsFromForm() {
    return {
      mgmt_user_id_col: $('pnColMgmt').value,
      agent_user_id_col: $('pnColAgentUid').value,
      agent_salary_col: $('pnColAgentSal').value,
      user_info_user_id_col: $('pnColUiUid').value,
      user_info_title_col: $('pnColUiTitle').value,
      user_info_salary_col: $('pnColUiSal').value,
      user_info_sheet_index: parseInt($('pnUserInfoSheetIdx').value, 10) || 0,
    };
  }

  async function loadCycle() {
    try {
      var res = await fetch('/api/payroll-native/cycles/' + state.cycleId);
      var data = await res.json();
      if (!data.success) {
        showToast(data.message || 'فشل التحميل', 'error');
        return;
      }
      state.workbooks.management = data.management || state.workbooks.management;
      state.workbooks.agent = data.agent || state.workbooks.agent;
      state.workbooks.userInfo = data.userInfo || state.workbooks.userInfo;
      state.settings = data.settings || {};
      state.sheetIndex = { management: 0, agent: 0, userInfo: 0 };

      $('pnCycleName').value = (data.cycle && data.cycle.name) || '';

      var ps = await fetch('/api/sheet/payroll-settings');
      var pset = await ps.json();
      if (pset.success) {
        $('pnDiscount').value = pset.discountRate != null ? pset.discountRate : 0;
        $('pnColorAgent').value = pset.agentColor || '#3b82f6';
        $('pnColorMgmt').value = pset.managementColor || '#10b981';
      }

      $('pnUserInfoSheetIdx').value = state.settings.user_info_sheet_index != null ? state.settings.user_info_sheet_index : 0;
      setSelectValue('pnColUiUid', state.settings.user_info_user_id_col || 'C');
      setSelectValue('pnColUiTitle', state.settings.user_info_title_col || 'D');
      setSelectValue('pnColUiSal', state.settings.user_info_salary_col || 'L');
      setSelectValue('pnColMgmt', state.settings.mgmt_user_id_col || 'A');
      setSelectValue('pnColAgentUid', state.settings.agent_user_id_col || 'A');
      setSelectValue('pnColAgentSal', state.settings.agent_salary_col || 'D');

      fillColSelects();
      renderAll();
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function saveWorkbooks() {
    syncAllFromHots();
    var settings = readSettingsFromForm();
    try {
      var res = await fetch('/api/payroll-native/cycles/' + state.cycleId + '/workbooks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          management: state.workbooks.management,
          agent: state.workbooks.agent,
          userInfo: state.workbooks.userInfo,
          settings: settings,
        }),
      });
      var data = await res.json();
      if (data.success) showToast(data.message || 'تم الحفظ', 'success');
      else showToast(data.message || 'فشل', 'error');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  async function saveCycleName() {
    var name = ($('pnCycleName').value || '').trim();
    if (!name) {
      showToast('أدخل اسماً', 'error');
      return;
    }
    try {
      var res = await fetch('/api/payroll-native/cycles/' + state.cycleId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name }),
      });
      var data = await res.json();
      if (data.success) showToast(data.message || 'تم', 'success');
      else showToast(data.message || 'فشل', 'error');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function buildAuditHtml(data) {
    var s = data.summary || {};
    var html = '';
    html += '<p class="text-xs text-slate-500 mb-2"><i class="fas fa-server ml-1"></i> تدقيق داخل LorkERP</p>';
    html += '<p class="font-semibold text-slate-800 mb-2">' + escapeHtml(data.message || '') + '</p>';
    html += '<ul class="space-y-1 text-slate-600 mb-4 text-sm">';
    html += '<li>إجمالي: <strong>' + (s.total || 0) + '</strong></li>';
    html += '<li>سحب وكالة: <strong>' + (s.agent || 0) + '</strong></li>';
    html += '<li>سحب إدارة: <strong>' + (s.management || 0) + '</strong></li>';
    html += '<li>غير موجود: <strong>' + (s.notFound || 0) + '</strong></li></ul>';
    if (data.results && data.results.length) {
      html += '<div class="overflow-x-auto border border-slate-200 rounded-xl">';
      html += '<table class="min-w-full text-xs text-right"><thead><tr class="bg-slate-100">';
      html += '<th class="p-2">#</th><th class="p-2">المستخدم</th><th class="p-2">العنوان</th><th class="p-2">النوع</th></tr></thead><tbody>';
      data.results.forEach(function (r, i) {
        var bg = r.color ? 'background:' + r.color + ';color:#111' : '';
        html += '<tr style="' + bg + '"><td class="p-2">' + (i + 1) + '</td><td class="p-2">' + escapeHtml(String(r.userId || '')) + '</td><td class="p-2">' + escapeHtml(String(r.title || '')) + '</td><td class="p-2">' + escapeHtml(String(r.type || '')) + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    return html;
  }

  async function runAudit() {
    await saveWorkbooks();
    var settings = readSettingsFromForm();
    var btn = $('pnAuditBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    try {
      var res = await fetch('/api/payroll-native/cycles/' + state.cycleId + '/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discountRate: parseFloat($('pnDiscount').value) || 0,
          agentColor: $('pnColorAgent').value,
          managementColor: $('pnColorMgmt').value,
          userInfoUserIdCol: settings.user_info_user_id_col,
          userInfoTitleCol: settings.user_info_title_col,
          userInfoSalaryCol: settings.user_info_salary_col,
          cycleMgmtUserIdCol: settings.mgmt_user_id_col,
          cycleAgentUserIdCol: settings.agent_user_id_col,
          cycleAgentSalaryCol: settings.agent_salary_col,
          userInfoSheetIndex: settings.user_info_sheet_index,
        }),
      });
      var data = await res.json();
      $('pnResultsSection').classList.remove('hidden');
      $('pnResultsBody').innerHTML = data.success ? buildAuditHtml(data) : '<p class="text-red-600">' + escapeHtml(data.message || 'فشل') + '</p>';
      if (data.success) showToast(data.message || 'تم التدقيق', 'success');
      else showToast(data.message || 'فشل', 'error');
    } catch (e) {
      $('pnResultsSection').classList.remove('hidden');
      $('pnResultsBody').innerHTML = '<p class="text-red-600">' + escapeHtml(e.message) + '</p>';
    }
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-double"></i> تدقيق';
    }
  }

  async function exportKind(kind) {
    try {
      var res = await fetch('/api/payroll-native/cycles/' + state.cycleId + '/export/' + kind, { method: 'POST' });
      var data = await res.json();
      if (data.success && data.url) {
        showToast(data.message || 'تم التصدير', 'success');
        window.open(data.url, '_blank', 'noopener');
      } else showToast(data.message || 'فشل', 'error');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  function addSheet(kind) {
    syncKindFromHot(kind);
    var sheets = state.workbooks[kind].sheets;
    var n = sheets.length + 1;
    sheets.push({ name: 'ورقة ' + n, rows: [['']] });
    state.sheetIndex[kind] = sheets.length - 1;
    renderSheetTabs(kind);
    renderHot(kind);
  }

  async function replaceFile(kind, file) {
    if (!file) return;
    syncAllFromHots();
    var fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    try {
      var res = await fetch('/api/payroll-native/cycles/' + state.cycleId + '/upload', {
        method: 'POST',
        body: fd,
      });
      var data = await res.json();
      if (data.success && data.workbook) {
        state.workbooks[kind] = data.workbook;
        state.sheetIndex[kind] = 0;
        renderSheetTabs(kind);
        renderHot(kind);
        showToast(data.message || 'تم الاستبدال', 'success');
      } else showToast(data.message || 'فشل', 'error');
    } catch (e) {
      showToast(e.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    fillColSelects();
    loadCycle();

    $('pnSaveSheetsBtn').addEventListener('click', saveWorkbooks);
    $('pnSaveNameBtn').addEventListener('click', saveCycleName);
    $('pnAuditBtn').addEventListener('click', runAudit);
    $('pnExportMgmt').addEventListener('click', function () {
      exportKind('management');
    });
    $('pnExportAgent').addEventListener('click', function () {
      exportKind('agent');
    });
    $('pnExportUser').addEventListener('click', function () {
      exportKind('userInfo');
    });

    document.querySelectorAll('.pn-add-sheet').forEach(function (b) {
      b.addEventListener('click', function () {
        addSheet(b.getAttribute('data-kind'));
      });
    });

    document.querySelectorAll('.pn-replace-file').forEach(function (input) {
      input.addEventListener('change', function () {
        var k = this.getAttribute('data-kind');
        if (this.files && this.files[0]) replaceFile(k, this.files[0]);
        this.value = '';
      });
    });

    var resizeT;
    window.addEventListener('resize', function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(function () {
        syncAllFromHots();
        renderHot('management');
        renderHot('agent');
        renderHot('userInfo');
      }, 150);
    });
  });
})();
