/**
 * مسرد مصطلحات مالية: وضع المحاسب (مصطلحات أصلية) مقابل وضع العميل (صياغة مبسّطة).
 * المصدر القابل للتعديل: config/financialTerminology.glossary.json
 */

const fs = require('fs');
const path = require('path');
const {
  labelNetProfitSource,
  labelFundLedgerType,
} = require('./accountingLabelsAr');

const MODES = {
  ACCOUNTANT: 'accountant_mode',
  CLIENT: 'client_mode',
};

let cached = null;
let sortedPhrasePairs = [];

function glossaryPath() {
  return path.join(__dirname, '..', 'config', 'financialTerminology.glossary.json');
}

function loadGlossary() {
  if (cached) return cached;
  const p = glossaryPath();
  try {
    const raw = fs.readFileSync(p, 'utf8');
    cached = JSON.parse(raw);
  } catch (e) {
    console.warn('[financialTerminology] Could not load glossary:', e.message);
    cached = { version: 0, entries: [], code_maps: {}, net_profit_source_client: {}, fund_ledger_type_client: {} };
  }
  const entries = cached.entries || [];
  sortedPhrasePairs = entries
    .filter((e) => e && e.original_term && e.simple_term && String(e.original_term) !== String(e.simple_term))
    .map((e) => ({ from: String(e.original_term), to: String(e.simple_term) }))
    .sort((a, b) => b.from.length - a.from.length);
  return cached;
}

function reloadGlossary() {
  cached = null;
  sortedPhrasePairs = [];
  return loadGlossary();
}

/**
 * استبدال العبارات المعروفة (أطول تطابقاً أولاً) لوضع العميل.
 * @param {string} str
 * @param {string} mode
 */
function translatePhrase(str, mode) {
  if (str == null || mode !== MODES.CLIENT) return str == null ? '' : String(str);
  loadGlossary();
  let out = String(str);
  for (let i = 0; i < sortedPhrasePairs.length; i++) {
    const { from, to } = sortedPhrasePairs[i];
    if (out.includes(from)) out = out.split(from).join(to);
  }
  return out;
}

function mapCode(table, code, mode, accountantLabelFn) {
  const k = code == null ? '' : String(code).trim();
  if (!k) return '—';
  if (mode !== MODES.CLIENT) return accountantLabelFn(k);
  loadGlossary();
  const g = cached;
  const map = (g && g[table]) || {};
  if (map[k]) return map[k];
  return accountantLabelFn(k);
}

function labelLedgerBucket(code, mode) {
  const k = code == null ? '' : String(code).trim();
  if (!k) return '—';
  if (mode !== MODES.CLIENT) return k;
  loadGlossary();
  const m = (cached.code_maps && cached.code_maps.ledger_bucket) || {};
  return m[k] || k;
}

function labelNetProfitSourceMode(code, mode) {
  if (mode !== MODES.CLIENT) return labelNetProfitSource(code);
  return mapCode('net_profit_source_client', code, mode, labelNetProfitSource);
}

function labelFundLedgerTypeMode(code, mode) {
  if (mode !== MODES.CLIENT) return labelFundLedgerType(code);
  return mapCode('fund_ledger_type_client', code, mode, labelFundLedgerType);
}

function labelAccreditationEntryType(code, mode) {
  const k = code == null ? '' : String(code).trim();
  if (!k) return '—';
  if (mode !== MODES.CLIENT) return k;
  loadGlossary();
  const m = (cached.code_maps && cached.code_maps.accreditation_entry_type) || {};
  return m[k] || k;
}

function labelSubAgencyTxType(code, mode) {
  const k = code == null ? '' : String(code).trim();
  if (!k) return '—';
  if (mode !== MODES.CLIENT) return k;
  loadGlossary();
  const m = (cached.code_maps && cached.code_maps.sub_agency_transaction_type) || {};
  return m[k] || k;
}

/**
 * @param {import('express').Request} req
 * @returns {string} MODES.ACCOUNTANT | MODES.CLIENT
 */
function resolveReportTerminologyMode(req) {
  const q = String((req.query && (req.query.reportTerms || req.query.terminology)) || '')
    .trim()
    .toLowerCase();
  if (q === 'client' || q === 'simple' || q === '1' || q === 'true') return MODES.CLIENT;
  if (q === 'accountant' || q === 'technical' || q === '0' || q === 'false') return MODES.ACCOUNTANT;
  const u = req.session && req.session.user;
  if (u && u.useSimpleFinancialTerms) return MODES.CLIENT;
  return MODES.ACCOUNTANT;
}

module.exports = {
  MODES,
  loadGlossary,
  reloadGlossary,
  translatePhrase,
  labelLedgerBucket,
  labelNetProfitSourceMode,
  labelFundLedgerTypeMode,
  labelAccreditationEntryType,
  labelSubAgencyTxType,
  resolveReportTerminologyMode,
};
