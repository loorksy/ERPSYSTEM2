/**
 * تحويل الأرقام العربية والفارسية إلى إنجليزية
 */
function toWesternDigits(str) {
  if (str == null) return '';
  let out = String(str).replace(/[\u200B-\u200D\u2060\uFEFF\u200E\u200F\u202A-\u202E]/g, '').trim();
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const western = '0123456789';
  for (let i = 0; i < 10; i++) {
    out = out.replace(new RegExp(arabic[i], 'g'), western[i]).replace(new RegExp(persian[i], 'g'), western[i]);
  }
  return out;
}

/**
 * تحليل رقم من نص (يدعم الفواصل العشرية العربية والغربية)
 * مثال: "١١،٥٠" أو "11.50" أو "1,234.56"
 */
function parseDecimal(str) {
  if (str == null || str === '') return 0;
  let s = toWesternDigits(str).trim();
  if (!s) return 0;
  s = s.replace(/\s/g, '');
  s = s.replace(/\u066B/g, '.');  // Arabic decimal separator ٫
  s = s.replace(/،/g, '.');       // Arabic comma كـ decimal
  s = s.replace(/\u066C/g, '');  // Arabic thousands separator
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const decimalPos = Math.max(lastComma, lastDot);
  if (decimalPos >= 0) {
    const before = s.substring(0, decimalPos).replace(/[,.]/g, '');
    const after = s.substring(decimalPos + 1).replace(/[,.]/g, '');
    s = before + '.' + after;
  } else {
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) || !isFinite(n) ? 0 : n;
}

const CURRENCY_SYMBOLS = {
  USD: '$',
  SAR: 'ر.س',
  KWD: 'د.ك',
  AED: 'د.إ',
  EGP: 'ج.م',
  IQD: 'د.ع',
  JOD: 'د.أ',
  BHD: 'د.ب',
  OMR: 'ر.ع',
  QAR: 'ر.ق',
  YER: 'ر.ي',
  LBP: 'ل.ل',
  SYP: 'ل.س',
  TND: 'د.ت',
  DZD: 'د.ج',
  MAD: 'د.م',
  SDG: 'ج.س',
  LYD: 'د.ل',
  NONE: ''
};

function getCurrencySymbol(code) {
  if (code === 'NONE') return '';
  return CURRENCY_SYMBOLS[code] || CURRENCY_SYMBOLS.USD || '$';
}

/**
 * تنسيق رقم مالي بأرقام غربية ورمز العملة
 */
function formatMoney(num, currencyCode) {
  const n = typeof num === 'number' ? num : parseDecimal(num);
  const symbol = getCurrencySymbol(currencyCode || 'USD');
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol ? formatted + ' ' + symbol : formatted;
}

module.exports = {
  parseDecimal,
  toWesternDigits,
  formatMoney,
  getCurrencySymbol,
  CURRENCY_SYMBOLS
};
