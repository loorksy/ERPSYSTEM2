(function() {
  'use strict';

  /** تسميات عربية لـ source_type في دفتر صافي الربح (وما قد يُضاف لاحقاً) */
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

  function labelForSourceType(code) {
    var k = (code == null ? '' : String(code)).trim();
    if (!k) return '—';
    if (NET_PROFIT_SOURCE_LABELS[k]) return NET_PROFIT_SOURCE_LABELS[k];
    return k.replace(/_/g, ' ');
  }

  function apiCall(url, opts) {
    if (typeof window.apiCall === 'function') return window.apiCall(url, opts);
    return fetch(url, { credentials: 'same-origin', ...opts }).then(function(r) { return r.json(); });
  }
  function fmt(n) {
    if (typeof window.formatMoney === 'function') return window.formatMoney(n);
    return (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }) + ' $';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function amountClass(n) {
    var v = parseFloat(n);
    if (isNaN(v)) return 'text-slate-800';
    if (v < 0) return 'text-red-600';
    if (v > 0) return 'text-emerald-700';
    return 'text-slate-600';
  }

  document.addEventListener('DOMContentLoaded', function() {
    var box = document.getElementById('profitSourcesBox');
    if (!box) return;
    apiCall('/api/expenses/net-profit-by-source').then(function(res) {
      if (!res.success) {
        box.innerHTML =
          '<div class="rounded-2xl border border-red-100 bg-red-50/80 px-6 py-10 text-center">' +
          '<i class="fas fa-circle-exclamation text-2xl text-red-500 mb-2 block" aria-hidden="true"></i>' +
          '<p class="text-sm font-medium text-red-800">' + escapeHtml(res.message || 'فشل التحميل') + '</p></div>';
        return;
      }
      var rows = res.rows || [];
      if (!rows.length) {
        box.innerHTML =
          '<div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-14 text-center">' +
          '<span class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-200/80 text-slate-400 mb-3"><i class="fas fa-inbox text-2xl"></i></span>' +
          '<p class="text-sm font-medium text-slate-600">لا توجد قيود صافي ربح بعد</p>' +
          '<p class="text-xs text-slate-400 mt-1">ستظهر المصادر هنا عند تسجيل عمليات في الدفتر.</p></div>';
        return;
      }
      var items = rows.map(function(r) {
        var code = r.source_type || '';
        var title = labelForSourceType(code);
        var detailUrl = '/profit-sources/' + encodeURIComponent(code) + '/detail';
        var ac = amountClass(r.total);
        return (
          '<li class="border-b border-slate-100/90 last:border-0">' +
          '<a href="' + detailUrl + '" class="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 px-3 py-3.5 sm:px-5 sm:py-4 transition-colors hover:bg-sky-50/50 active:bg-sky-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 group min-w-0">' +
          '<div class="min-w-0 flex-1 text-right w-full">' +
          '<p class="text-sm sm:text-base font-semibold text-slate-900 group-hover:text-sky-950 leading-snug">' + escapeHtml(title) + '</p>' +
          '<p class="mt-1 font-mono text-[0.65rem] sm:text-xs text-slate-400 truncate" title="' + escapeHtml(code) + '">' + escapeHtml(code) + '</p>' +
          '</div>' +
          '<div class="flex shrink-0 items-center justify-end gap-2 sm:gap-3 w-full sm:w-auto min-w-0">' +
          '<span class="font-mono text-sm sm:text-base font-bold tabular-nums text-right min-w-0 max-w-full break-words leading-snug ' + ac + '">' + fmt(r.total) + '</span>' +
          '<span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400 transition group-hover:bg-sky-100 group-hover:text-sky-600" aria-hidden="true"><i class="fas fa-chevron-left text-xs"></i></span>' +
          '</div></a></li>'
        );
      }).join('');
      box.innerHTML =
        '<div class="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06),0_4px_14px_-4px_rgba(15,23,42,0.08)]">' +
        '<div class="border-b border-slate-100 bg-slate-50/90 px-4 py-3 sm:px-5">' +
        '<h2 class="text-xs font-bold uppercase tracking-wide text-slate-500">السجل</h2>' +
        '<p class="mt-0.5 text-[0.65rem] text-slate-400">' + rows.length + ' مصدر</p></div>' +
        '<ul class="divide-y divide-slate-100">' + items + '</ul></div>';
    });
  });
})();
