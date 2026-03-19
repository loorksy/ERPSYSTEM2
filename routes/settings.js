const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db/database');

const { getCurrencySymbol } = require('../utils/numbers');

const CURRENCY_OPTIONS = [
  { code: 'USD', label: 'دولار أمريكي ($)' },
  { code: 'SAR', label: 'ريال سعودي (ر.س)' },
  { code: 'KWD', label: 'دينار كويتي (د.ك)' },
  { code: 'AED', label: 'درهم إماراتي (د.إ)' },
  { code: 'EGP', label: 'جنيه مصري (ج.م)' },
  { code: 'IQD', label: 'دينار عراقي (د.ع)' },
  { code: 'JOD', label: 'دينار أردني (د.أ)' },
  { code: 'BHD', label: 'دينار بحريني (د.ب)' },
  { code: 'OMR', label: 'ريال عماني (ر.ع)' },
  { code: 'QAR', label: 'ريال قطري (ر.ق)' },
  { code: 'NONE', label: 'بدون رمز' }
];

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const sheetsConfig = db.prepare('SELECT * FROM google_sheets_config WHERE id = 1').get();
  const currencyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('currency');
  const currency = currencyRow?.value || 'USD';
  res.render('dashboard', {
    title: 'الإعدادات',
    page: 'settings',
    user: req.session.user,
    sheetsConfig: sheetsConfig || null,
    currency,
    currencyOptions: CURRENCY_OPTIONS
  });
});

router.get('/currency', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('currency');
    const currency = row?.value || 'USD';
    const symbol = getCurrencySymbol(currency);
    res.json({ success: true, currency, symbol });
  } catch (e) {
    res.json({ success: false, currency: 'USD', symbol: '$' });
  }
});

router.post('/currency', requireAuth, (req, res) => {
  try {
    const { currency } = req.body || {};
    const code = CURRENCY_OPTIONS.some(c => c.code === currency) ? currency : 'USD';
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run('currency', code);
    res.json({ success: true, message: 'تم حفظ العملة', currency: code, symbol: getCurrencySymbol(code) });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل' });
  }
});

router.post('/change-password', requireAuth, (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const db = getDb();

    if (newPassword !== confirmPassword) {
      return res.json({ success: false, message: 'كلمات المرور غير متطابقة' });
    }

    if (newPassword.length < 6) {
      return res.json({ success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      return res.json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedPassword, req.session.userId);

    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    res.json({ success: false, message: 'حدث خطأ أثناء تغيير كلمة المرور' });
  }
});

router.post('/update-profile', requireAuth, (req, res) => {
  try {
    const { displayName } = req.body;
    const db = getDb();

    db.prepare('UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(displayName, req.session.userId);
    req.session.user.displayName = displayName;

    res.json({ success: true, message: 'تم تحديث الملف الشخصي بنجاح' });
  } catch (error) {
    res.json({ success: false, message: 'حدث خطأ أثناء تحديث الملف الشخصي' });
  }
});

router.post('/reset-data', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const userId = req.session.userId;
    db.prepare('DELETE FROM payroll_user_audit_cache WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM payroll_cycle_cache WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM payroll_cycle_columns WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM payroll_settings WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM financial_cycles WHERE user_id = ?').run(userId);
    res.json({ success: true, message: 'تم حذف بيانات الدورات والتدقيق لهذه الحساب وإعادة التعيين.' });
  } catch (error) {
    res.json({ success: false, message: 'فشل حذف البيانات: ' + (error.message || '') });
  }
});

module.exports = router;
