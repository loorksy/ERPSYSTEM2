/**
 * توليد PDF من HTML (RTL) عبر Puppeteer
 */

const puppeteer = require('puppeteer');
const {
  MODES,
  translatePhrase: trPhrase,
  labelNetProfitSourceMode,
  labelFundLedgerTypeMode,
  labelLedgerBucket,
  labelAccreditationEntryType,
  labelSubAgencyTxType,
} = require('../financialTerminology');

function tr(s, mode) {
  return trPhrase(s, mode);
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtNum(n) {
  const x = typeof n === 'number' ? n : parseFloat(n);
  if (Number.isNaN(x)) return '0.00';
  return x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function docShell(title, innerHtml) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Tajawal', sans-serif; font-size: 11px; color: #1e293b; padding: 16px 20px; line-height: 1.45; }
    h1 { font-size: 18px; margin: 0 0 8px; color: #0f172a; }
    h2 { font-size: 14px; margin: 18px 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; color: #334155; }
    .meta { color: #64748b; font-size: 10px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: right; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    .muted { color: #94a3b8; font-size: 10px; }
    .kv { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin: 10px 0; }
    .kv div { padding: 4px 0; border-bottom: 1px dashed #e2e8f0; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${innerHtml}
</body>
</html>`;
}

function tableHtml(headers, rows) {
  if (!rows || !rows.length) {
    return '<p class="muted">لا توجد بيانات.</p>';
  }
  let h = '<table><thead><tr>';
  headers.forEach((x) => {
    h += `<th>${escapeHtml(x)}</th>`;
  });
  h += '</tr></thead><tbody>';
  rows.forEach((row) => {
    h += '<tr>';
    row.forEach((cell) => {
      h += `<td>${cell == null ? '' : escapeHtml(String(cell))}</td>`;
    });
    h += '</tr>';
  });
  h += '</tbody></table>';
  return h;
}

function renderSummaryBlock(s, terminologyMode = MODES.ACCOUNTANT) {
  const m = terminologyMode;
  const rows = [
    [tr('إجمالي الإيرادات', m), fmtNum(s.totalRevenue)],
    [tr('الربح الصافي', m), fmtNum(s.netProfit)],
    [tr('المصاريف (مجمّع)', m), fmtNum(s.totalExpenses)],
    [tr('إجمالي الديون', m), fmtNum(s.totalDebts)],
    [tr('رصيد الصندوق (تقدير)', m), fmtNum(s.cashBalance)],
    [tr('رصيد المؤجل', m), fmtNum(s.deferredBalance)],
    [tr('رأس المال المسترد', m), fmtNum(s.capitalRecovered)],
    [tr('ربح الشحن', m), fmtNum(s.shippingProfit)],
    [tr('صافي الربح من الدفتر', m), fmtNum(s.ledgerNetProfit)],
    [tr('ديون الشحن', m), fmtNum(s.shippingDebt)],
    [tr('ديون الاعتمادات', m), fmtNum(s.accreditationDebtTotal)],
  ];
  return tableHtml([tr('البند', m), tr('القيمة', m)], rows);
}

function renderSubAgency(data, terminologyMode = MODES.ACCOUNTANT) {
  const m = terminologyMode;
  const a = data.agency;
  let inner = `<div class="meta">${escapeHtml(tr('تاريخ التقرير', m))}: ${escapeHtml(new Date().toLocaleString('ar-SY'))}</div>`;
  inner += `<div class="kv">
    <div><strong>${escapeHtml(tr('الاسم', m))}:</strong> ${escapeHtml(a.name)}</div>
    <div><strong>${escapeHtml(tr('نسبة الوكالة', m))}:</strong> ${fmtNum(a.commission_percent)}%</div>
    <div><strong>${escapeHtml(tr('الرصيد', m))}:</strong> ${fmtNum(data.balance)}</div>
    ${data.cycleName ? `<div><strong>${escapeHtml(tr('الدورة', m))}:</strong> ${escapeHtml(data.cycleName)}</div>` : ''}
  </div>`;
  inner += `<h2>${tr('الحركات', m)}</h2>`;
  if (data.truncated) {
    inner +=
      '<p class="muted">' +
      escapeHtml(tr('تم اقتطاع القائمة — أحدث ' + data.transactions.length + ' حركة.', m)) +
      '</p>';
  }
  const headers = ['#', tr('النوع', m), tr('المبلغ', m), tr('الدورة', m), tr('ملاحظات', m), tr('التاريخ', m)];
  const rows = data.transactions.map((t) => [
    String(t.id),
    labelSubAgencyTxType(t.type, m),
    fmtNum(t.amount),
    t.cycle_id != null ? String(t.cycle_id) : '—',
    t.notes || '—',
    t.created_at ? new Date(t.created_at).toLocaleString('ar-SY') : '',
  ]);
  inner += tableHtml(headers, rows);
  return docShell(tr('تقرير وكالة فرعية:', m) + ' ' + a.name, inner);
}

function renderAccreditations(data, terminologyMode = MODES.ACCOUNTANT) {
  const m = terminologyMode;
  let inner = `<div class="meta">${data.cycleName ? escapeHtml(tr('الدورة', m)) + ': ' + escapeHtml(data.cycleName) : tr('كل الدورات (الحركات غير المفلترة بالدورة إن لم تُختر دورة)', m)}</div>`;
  inner += `<h2>${tr('الجهات', m)}</h2>`;
  const entRows = data.entities.map((e) => [
    String(e.id),
    e.name,
    e.code || '—',
    fmtNum(e.balance_amount),
  ]);
  inner += tableHtml([tr('المعرف', m), tr('الاسم', m), tr('الكود', m), tr('الرصيد', m)], entRows);
  inner += `<h2>${tr('دفتر الاعتمادات', m)}</h2>`;
  if (data.truncated) inner += '<p class="muted">' + escapeHtml(tr('تم اقتطاع الحركات.', m)) + '</p>';
  const lr = data.ledger.map((l) => [
    String(l.id),
    l.entity_name,
    labelAccreditationEntryType(l.entry_type, m),
    fmtNum(l.amount),
    l.currency || 'USD',
    l.cycle_id != null ? String(l.cycle_id) : '—',
    (l.notes || '').slice(0, 80),
    l.created_at ? new Date(l.created_at).toLocaleString('ar-SY') : '',
  ]);
  inner += tableHtml(
    ['#', tr('الجهة', m), tr('النوع', m), tr('المبلغ', m), tr('العملة', m), tr('الدورة', m), tr('ملاحظات', m), tr('التاريخ', m)],
    lr
  );
  return docShell(tr('تقرير الاعتمادات', m), inner);
}

function renderTransferCompanyLedger(data, terminologyMode = MODES.ACCOUNTANT) {
  const m = terminologyMode;
  if (!data || !data.company) return docShell(tr('حركات شركة تحويل', m), '<p class="muted">' + escapeHtml(tr('لا توجد بيانات.', m)) + '</p>');
  const c = data.company;
  let inner = `<h2>${escapeHtml(c.name)} — ${escapeHtml(tr('رصيد', m))}: ${fmtNum(c.balance_amount)} ${escapeHtml(c.balance_currency || 'USD')}</h2>`;
  const rows = (data.rows || []).map((r) => [
    String(r.id),
    fmtNum(r.amount),
    r.currency || 'USD',
    (r.notes || '').slice(0, 120),
    r.created_at ? new Date(r.created_at).toLocaleString('ar-SY') : '',
  ]);
  inner += tableHtml(['#', tr('المبلغ', m), tr('العملة', m), tr('ملاحظات', m), tr('التاريخ', m)], rows);
  return docShell(tr('تقرير حركات شركة تحويل', m), inner);
}

function renderFundLedger(data, terminologyMode = MODES.ACCOUNTANT) {
  const m = terminologyMode;
  if (!data || !data.fund) return docShell(tr('حركات صندوق', m), '<p class="muted">' + escapeHtml(tr('لا توجد بيانات.', m)) + '</p>');
  const f = data.fund;
  const title = [f.name, f.fund_number].filter(Boolean).join(' — ');
  let inner = `<h2>${escapeHtml(title || tr('صندوق', m))}</h2>`;
  const rows = (data.rows || []).map((r) => [
    String(r.id),
    labelFundLedgerTypeMode(r.type, m),
    fmtNum(r.amount),
    r.currency || 'USD',
    (r.displayNotes || r.notes || '').slice(0, 100),
    r.created_at ? new Date(r.created_at).toLocaleString('ar-SY') : '',
  ]);
  inner += tableHtml(['#', tr('النوع', m), tr('المبلغ', m), tr('العملة', m), tr('ملاحظات', m), tr('التاريخ', m)], rows);
  return docShell(tr('تقرير حركات صندوق', m), inner);
}

function renderTransferCompanies(data, terminologyMode = MODES.ACCOUNTANT) {
  const m = terminologyMode;
  let inner = `<p class="muted">${escapeHtml(tr(data.noteNoCycle || '', m))}</p>`;
  for (const block of data.ledgersByCompany) {
    const c = block.company;
    inner += `<h2>${escapeHtml(c.name)} — ${escapeHtml(tr('رصيد', m))}: ${fmtNum(c.balance_amount)} ${escapeHtml(c.balance_currency || 'USD')}</h2>`;
    if (block.truncated) inner += '<p class="muted">' + escapeHtml(tr('تم اقتطاع حركات هذه الشركة.', m)) + '</p>';
    const rows = block.rows.map((r) => [
      String(r.id),
      fmtNum(r.amount),
      r.currency || 'USD',
      (r.notes || '').slice(0, 100),
      r.created_at ? new Date(r.created_at).toLocaleString('ar-SY') : '',
    ]);
    inner += tableHtml(['#', tr('المبلغ', m), tr('العملة', m), tr('ملاحظات', m), tr('التاريخ', m)], rows);
  }
  if (!data.ledgersByCompany.length) inner += '<p class="muted">' + escapeHtml(tr('لا توجد شركات أو حركات.', m)) + '</p>';
  return docShell(tr('تقرير شركات التحويل', m), inner);
}

function renderMovements(data, terminologyMode = MODES.ACCOUNTANT) {
  const m = terminologyMode;
  let inner = `<div class="meta">${data.cycleName ? escapeHtml(tr('الدورة', m)) + ': ' + escapeHtml(data.cycleName) : '—'} — ${escapeHtml(tr(data.noteTransferAndFundNoCycle || '', m))}</div>`;

  inner += `<h2>${tr('دفتر ledger_entries', m)}</h2>`;
  if (data.ledgerEntriesTruncated) inner += '<p class="muted">' + escapeHtml(tr('مقتطع.', m)) + '</p>';
  inner += tableHtml(
    ['#', tr('الدلو', m), tr('المصدر', m), tr('المبلغ', m), tr('عملة', m), tr('اتجاه', m), tr('دورة', m), tr('ملاحظات', m), tr('تاريخ', m)],
    data.ledgerEntries.map((r) => [
      String(r.id),
      labelLedgerBucket(r.bucket, m),
      labelNetProfitSourceMode(r.source_type, m),
      fmtNum(r.amount),
      r.currency,
      String(r.direction),
      r.cycle_id != null ? String(r.cycle_id) : '—',
      (r.notes || '').slice(0, 60),
      r.created_at ? new Date(r.created_at).toLocaleString('ar-SY') : '',
    ])
  );

  inner += `<h2>${tr('دفتر الاعتمادات', m)}</h2>`;
  if (data.accreditationLedgerTruncated) inner += '<p class="muted">' + escapeHtml(tr('مقتطع.', m)) + '</p>';
  inner += tableHtml(
    ['#', tr('الجهة', m), tr('النوع', m), tr('المبلغ', m), tr('دورة', m), tr('ملاحظات', m), tr('تاريخ', m)],
    data.accreditationLedger.map((r) => [
      String(r.id),
      r.entity_name,
      labelAccreditationEntryType(r.entry_type, m),
      fmtNum(r.amount),
      r.cycle_id != null ? String(r.cycle_id) : '—',
      (r.notes || '').slice(0, 60),
      r.created_at ? new Date(r.created_at).toLocaleString('ar-SY') : '',
    ])
  );

  inner += `<h2>${tr('دفتر شركات التحويل', m)}</h2>`;
  if (data.transferCompanyLedgerTruncated) inner += '<p class="muted">' + escapeHtml(tr('مقتطع.', m)) + '</p>';
  inner += tableHtml(
    ['#', tr('الشركة', m), tr('المبلغ', m), tr('ملاحظات', m), tr('تاريخ', m)],
    data.transferCompanyLedger.map((r) => [
      String(r.id),
      r.company_name,
      fmtNum(r.amount),
      (r.notes || '').slice(0, 80),
      r.created_at ? new Date(r.created_at).toLocaleString('ar-SY') : '',
    ])
  );

  inner += `<h2>${tr('حركات الوكالات الفرعية', m)}</h2>`;
  if (data.subAgencyTransactionsTruncated) inner += '<p class="muted">' + escapeHtml(tr('مقتطع.', m)) + '</p>';
  inner += tableHtml(
    ['#', tr('الوكالة', m), tr('النوع', m), tr('المبلغ', m), tr('دورة', m), tr('ملاحظات', m), tr('تاريخ', m)],
    data.subAgencyTransactions.map((r) => [
      String(r.id),
      r.agency_name,
      labelSubAgencyTxType(r.type, m),
      fmtNum(r.amount),
      r.cycle_id != null ? String(r.cycle_id) : '—',
      (r.notes || '').slice(0, 60),
      r.created_at ? new Date(r.created_at).toLocaleString('ar-SY') : '',
    ])
  );

  inner += `<h2>${tr('دفتر الصناديق', m)}</h2>`;
  if (data.fundLedgerTruncated) inner += '<p class="muted">' + escapeHtml(tr('مقتطع.', m)) + '</p>';
  inner += tableHtml(
    ['#', tr('الصندوق', m), tr('النوع', m), tr('المبلغ', m), tr('عملة', m), tr('ملاحظات', m), tr('تاريخ', m)],
    data.fundLedger.map((r) => [
      String(r.id),
      r.fund_name,
      labelFundLedgerTypeMode(r.type, m),
      fmtNum(r.amount),
      r.currency || 'USD',
      (r.notes || '').slice(0, 60),
      r.created_at ? new Date(r.created_at).toLocaleString('ar-SY') : '',
    ])
  );

  return docShell(tr('تقرير الحركات — جميع الدفاتر', m), inner);
}

function renderComprehensive(d, terminologyMode = MODES.ACCOUNTANT) {
  const m = terminologyMode;
  const s = d.summary;
  let inner = `<div class="meta">${escapeHtml(tr('تاريخ', m))}: ${escapeHtml(new Date().toLocaleString('ar-SY'))} — ${escapeHtml(tr('الدورة في الملخص', m))}: ${escapeHtml(s.cycleName || tr('الافتراضي', m))}</div>`;
  inner += `<h2>${tr('ملخص مالي', m)}</h2>`;
  inner += renderSummaryBlock(s, m);

  inner += `<h2>${tr('نظرة على الوكالات الفرعية', m)}</h2>`;
  inner += tableHtml(
    [tr('المعرف', m), tr('الاسم', m), tr('النسبة %', m), tr('الرصيد', m)],
    d.subAgenciesOverview.map((a) => [String(a.id), a.name, fmtNum(a.commission_percent), fmtNum(a.balance)])
  );

  inner += `<h2>${tr('الاعتمادات — الجهات', m)}</h2>`;
  inner += tableHtml(
    [tr('المعرف', m), tr('الاسم', m), tr('الرصيد', m)],
    d.accreditations.entities.map((e) => [String(e.id), e.name, fmtNum(e.balance_amount)])
  );

  inner += `<h2>${tr('شركات التحويل', m)}</h2>`;
  inner += '<p class="muted">' + escapeHtml(tr(d.transferCompanies.noteNoCycle || '', m)) + '</p>';
  inner += tableHtml(
    [tr('المعرف', m), tr('الاسم', m), tr('الرصيد', m), tr('العملة', m)],
    d.transferCompanies.companies.map((c) => [String(c.id), c.name, fmtNum(c.balance_amount), c.balance_currency || 'USD'])
  );

  inner += `<h2>${tr('ملخص الحركات (أحدث سجلات مختارة)', m)}</h2>`;
  inner += '<p class="muted">' + escapeHtml(tr(d.movements.noteTransferAndFundNoCycle || '', m)) + '</p>';
  inner += `<h3>${tr('ledger_entries', m)}</h3>`;
  inner += tableHtml(
    ['#', tr('دلو', m), tr('مصدر', m), tr('مبلغ', m)],
    d.movements.ledgerEntries
      .slice(0, 80)
      .map((r) => [String(r.id), labelLedgerBucket(r.bucket, m), labelNetProfitSourceMode(r.source_type, m), fmtNum(r.amount)])
  );
  inner += `<h3>${tr('الاعتمادات', m)}</h3>`;
  inner += tableHtml(
    ['#', tr('جهة', m), tr('مبلغ', m)],
    d.movements.accreditationLedger.slice(0, 80).map((r) => [String(r.id), r.entity_name, fmtNum(r.amount)])
  );

  return docShell(tr('تقرير محاسبي شامل — LorkERP', m), inner);
}

let browserSingleton = null;

async function getBrowser() {
  if (!browserSingleton) {
    const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || undefined;
    browserSingleton = await puppeteer.launch({
      headless: 'new',
      executablePath: execPath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
      timeout: 60000,
    });
  }
  return browserSingleton;
}

/**
 * @param {string} html
 * @returns {Promise<Buffer>}
 */
async function htmlToPdfBuffer(html) {
  let browser;
  try {
    browser = await getBrowser();
  } catch (e) {
    browserSingleton = null;
    throw new Error('فشل تشغيل المتصفح لتوليد PDF: ' + (e.message || ''));
  }
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.emulateMediaType('screen');
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' },
    });
    return Buffer.from(pdf);
  } catch (e) {
    throw new Error('فشل توليد PDF: ' + (e.message || ''));
  } finally {
    await page.close().catch(() => {});
  }
}

function encodeFilenameRfc5987(name) {
  return encodeURIComponent(name).replace(/'/g, '%27');
}

module.exports = {
  escapeHtml,
  fmtNum,
  docShell,
  tableHtml,
  renderSummaryBlock,
  renderSubAgency,
  renderAccreditations,
  renderTransferCompanies,
  renderTransferCompanyLedger,
  renderFundLedger,
  renderMovements,
  renderComprehensive,
  htmlToPdfBuffer,
  encodeFilenameRfc5987,
};
