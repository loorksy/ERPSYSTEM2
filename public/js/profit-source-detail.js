(function () {
  'use strict';
  var root = document.getElementById('profitDetailRoot');
  if (!root) return;
  var st = (root.getAttribute('data-source') || '').trim();
  var box = document.getElementById('profitDetailBox');
  var titleEl = document.getElementById('profitDetailTitle');
  var codeEl = document.getElementById('profitDetailCode');

  var NET_PROFIT_SOURCE_LABELS = {
    fx_spread_profit: 'ربح فرق التصريف',
    audit_cycle_profits: 'أرباح تدقيق الدورة (مكافات شهرية وإيداع W في الصندوق)',
    audit_management_yz: 'أرباح المكافات الشهرية',
    audit_management_w: 'أرباح الإدارة: عمود W (أرشيف — لا يُنشأ قيد جديد)',
    transfer_discount_profit: 'ربح نسبة خصم التحويل',
    cycle_creation_discount_profit: 'ربح خصم التحويل (إنشاء دورة)',
    accreditation_brokerage: 'وساطة معتمدين',
    accreditation_payable_discount: 'ربح خصم دين علينا (معتمد)',
    admin_brokerage: 'وساطة إدارية',
    shipping_sale_profit: 'ربح بيع شحن',
    sub_agency_share: 'حصة وكالة فرعية',
    sub_agency_company_profit: 'ربح الشركة من نسبة الوكالات',
    manual_expense: 'مصروف يدوي',
    sub_agency_reward: 'مكافأة وكالة فرعية',
    agent_table_primary_seed: 'جدول الوكيل (رأس مال)',
    primary_agent_seed: 'رأس مال من جدول الوكيل',
    profit_transfer: 'ترحيل أرباح',
    fx_spread_disbursement: 'تصريف عملات',
    company_payout: 'صرف لشركة تحويل',
    fund_allocation: 'تحويل لصندوق',
    shipping_sale_cash: 'بيع شحن نقدي',
    shipping_buy_cash: 'شراء شحن نقدي',
  };
  function labelFor(code) {
    var k = (code == null ? '' : String(code)).trim();
    if (!k) return '—';
    if (NET_PROFIT_SOURCE_LABELS[k]) return NET_PROFIT_SOURCE_LABELS[k];
    return k.replace(/_/g, ' ');
  }
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

  function amtClass(n) {
    var v = parseFloat(n);
    if (isNaN(v)) return 'text-slate-800';
    if (v < 0) return 'text-red-600';
    return 'text-slate-900';
  }

  function tableShell(title, subtitle, innerTable) {
    return (
      '<div class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]">' +
      '<div class="border-b border-slate-100 bg-slate-50/90 px-4 py-3 sm:px-5">' +
      '<h2 class="text-sm font-bold text-slate-800">' + esc(title) + '</h2>' +
      (subtitle ? '<p class="mt-0.5 text-[0.65rem] text-slate-500">' + esc(subtitle) + '</p>' : '') +
      '</div>' +
      '<div class="overflow-x-auto">' + innerTable + '</div></div>'
    );
  }

  if (titleEl) titleEl.textContent = labelFor(st);
  if (codeEl) codeEl.textContent = st || '—';

  function apiCall(url) {
    if (typeof window.apiCall === 'function') return window.apiCall(url);
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      return r.json();
    });
  }

  apiCall('/api/expenses/net-profit-by-source/' + encodeURIComponent(st) + '/detail').then(function (res) {
    if (!res.success || !box) {
      box.innerHTML =
        '<div class="rounded-2xl border border-red-100 bg-red-50/80 px-6 py-10 text-center">' +
        '<i class="fas fa-circle-exclamation text-2xl text-red-500 mb-2 block" aria-hidden="true"></i>' +
        '<p class="text-sm font-medium text-red-800">' + esc(res.message || 'فشل التحميل') + '</p></div>';
      return;
    }
    if (res.kind === 'shipping') {
      var rows = res.rows || [];
      if (!rows.length) {
        box.innerHTML =
          '<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-14 text-center">' +
          '<span class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200/80 text-slate-400 mb-3"><i class="fas fa-truck text-2xl"></i></span>' +
          '<p class="text-sm font-medium text-slate-600">لا مبيعات بعد لهذا المصدر</p></div>';
        return;
      }
      var tbl =
        '<table class="w-full min-w-[720px] text-right text-sm">' +
        '<thead><tr class="border-b border-slate-200 bg-slate-50/95 text-slate-600">' +
        '<th class="px-3 py-3 text-xs font-bold whitespace-nowrap">#</th>' +
        '<th class="px-3 py-3 text-xs font-bold">النوع</th>' +
        '<th class="px-3 py-3 text-xs font-bold whitespace-nowrap">الكمية</th>' +
        '<th class="px-3 py-3 text-xs font-bold whitespace-nowrap">الإجمالي</th>' +
        '<th class="px-3 py-3 text-xs font-bold whitespace-nowrap">الربح</th>' +
        '<th class="px-3 py-3 text-xs font-bold whitespace-nowrap">التاريخ</th>' +
        '</tr></thead><tbody class="divide-y divide-slate-100">' +
        rows
          .map(function (r) {
            var prof = parseFloat(r.profit_amount);
            var pCls = !isNaN(prof) && prof < 0 ? 'text-red-600' : 'text-emerald-700';
            return (
              '<tr class="hover:bg-slate-50/80 transition-colors">' +
              '<td class="px-3 py-2.5 font-mono text-xs text-slate-500">' + esc(r.id) + '</td>' +
              '<td class="px-3 py-2.5 text-slate-800">' + esc(r.item_type) + '</td>' +
              '<td class="px-3 py-2.5 tabular-nums text-slate-700">' + esc(r.quantity) + '</td>' +
              '<td class="px-3 py-2.5 font-mono tabular-nums ' + amtClass(r.total) + '">' + fmt(r.total) + '</td>' +
              '<td class="px-3 py-2.5 font-mono tabular-nums font-semibold ' + pCls + '">' + fmt(r.profit_amount) + '</td>' +
              '<td class="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">' +
              esc(r.created_at ? new Date(r.created_at).toLocaleString('ar') : '') +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>';
      box.innerHTML = tableShell('مبيعات الشحن', rows.length + ' سجل', tbl);
      return;
    }
    var lrows = res.rows || [];
    if (!lrows.length) {
      box.innerHTML =
        '<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-14 text-center">' +
        '<span class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200/80 text-slate-400 mb-3"><i class="fas fa-book text-2xl"></i></span>' +
        '<p class="text-sm font-medium text-slate-600">لا قيود محاسبية لهذا المصدر</p>' +
        '<p class="text-xs text-slate-400 mt-1">قد يكون المصدر جديداً أو لم يُسجَّل له حركات بعد.</p></div>';
      return;
    }
    var tbl2 =
      '<table class="w-full min-w-[640px] text-right text-sm">' +
      '<thead><tr class="border-b border-slate-200 bg-slate-50/95 text-slate-600">' +
      '<th class="px-3 py-3 text-xs font-bold whitespace-nowrap">#</th>' +
      '<th class="px-3 py-3 text-xs font-bold whitespace-nowrap">المبلغ</th>' +
      '<th class="px-3 py-3 text-xs font-bold">الاتجاه</th>' +
      '<th class="px-3 py-3 text-xs font-bold min-w-[8rem]">ملاحظات</th>' +
      '<th class="px-3 py-3 text-xs font-bold whitespace-nowrap">التاريخ</th>' +
      '</tr></thead><tbody class="divide-y divide-slate-100">' +
      lrows
        .map(function (r) {
          return (
            '<tr class="hover:bg-slate-50/80 transition-colors">' +
            '<td class="px-3 py-2.5 font-mono text-xs text-slate-500">' + esc(r.id) + '</td>' +
            '<td class="px-3 py-2.5 font-mono tabular-nums font-semibold ' + amtClass(r.amount) + '">' + fmt(r.amount) + '</td>' +
            '<td class="px-3 py-2.5 text-slate-700">' + esc(r.direction) + '</td>' +
            '<td class="px-3 py-2.5 text-xs text-slate-600 max-w-[16rem] sm:max-w-xs break-words" title="' + esc(r.notes) + '">' + esc(r.notes) + '</td>' +
            '<td class="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">' +
            esc(r.created_at ? new Date(r.created_at).toLocaleString('ar') : '') +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody></table>';
    box.innerHTML = tableShell('قيود الدفتر', lrows.length + ' قيد', tbl2);
  });
})();
