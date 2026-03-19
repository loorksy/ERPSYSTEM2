const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db/database');
const { calculateCashBoxBalance, fetchDeferredBalanceUsers } = require('../services/agencySyncService');

router.get('/', requireAuth, (req, res) => {
  res.render('dashboard', {
    title: 'لوحة التحكم',
    page: 'home',
    user: req.session.user
  });
});

/** إحصائيات لوحة التحكم: رصيد الصندوق، رصيد المؤجل، رصيد الشحن */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { cycleId } = req.query || {};
    const db = getDb();
    const userId = req.session.userId;

    let cycles = (await db.query('SELECT id, name FROM financial_cycles WHERE user_id = $1 ORDER BY created_at DESC', [userId])).rows;
    const defaultCycleId = cycleId ? parseInt(cycleId, 10) : (cycles[0]?.id || null);

    let cashBalance = 0;
    let deferredBalance = 0;
    let shippingBalance = 0;

    const shipRows = (await db.query(`
      SELECT type, item_type, SUM(quantity) as sum_qty
      FROM shipping_transactions
      GROUP BY type, item_type
    `)).rows;
    let goldBalance = 0;
    let crystalBalance = 0;
    shipRows.forEach(r => {
      const qty = r.sum_qty || 0;
      if (r.item_type === 'gold') {
        if (r.type === 'buy') goldBalance += qty;
        else goldBalance -= qty;
      } else if (r.item_type === 'crystal') {
        if (r.type === 'buy') crystalBalance += qty;
        else crystalBalance -= qty;
      }
    });
    shippingBalance = goldBalance + crystalBalance;

    if (defaultCycleId) {
      const cashSnapshot = (await db.query(`
        SELECT cash_balance FROM cash_box_snapshot WHERE cycle_id = $1 ORDER BY snapshot_at DESC LIMIT 1
      `, [defaultCycleId])).rows[0];
      cashBalance = cashSnapshot?.cash_balance ?? 0;

      const deferredRows = (await db.query(`
        SELECT SUM(balance_d) as total FROM deferred_balance_users WHERE cycle_id = $1
      `, [defaultCycleId])).rows[0];
      deferredBalance = deferredRows?.total ?? 0;
    }

    res.json({
      success: true,
      cashBalance,
      deferredBalance,
      shippingBalance,
      goldBalance,
      crystalBalance,
      cycles,
      cycleId: defaultCycleId
    });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل جلب الإحصائيات' });
  }
});

/** حساب رصيد الصندوق وتحديث اللقطة (يُستدعى عند الحاجة) */
router.post('/refresh-cash', requireAuth, async (req, res) => {
  try {
    const { cycleId } = req.body || {};
    const cid = parseInt(cycleId, 10);
    if (!cid) return res.json({ success: false, message: 'الدورة مطلوبة' });
    const db = getDb();
    const cycle = (await db.query('SELECT id FROM financial_cycles WHERE id = $1 AND user_id = $2', [cid, req.session.userId])).rows[0];
    if (!cycle) return res.json({ success: false, message: 'الدورة غير موجودة' });
    const result = await calculateCashBoxBalance(cid, req.session.userId);
    if (!result) return res.json({ success: false, message: 'فشل حساب رصيد الصندوق' });
    res.json({ success: true, cashBalance: result.cashBalance || 0 });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل' });
  }
});

/** تحديث رصيد المؤجل من جدول الوكيل */
router.post('/refresh-deferred', requireAuth, async (req, res) => {
  try {
    const { cycleId } = req.body || {};
    const cid = parseInt(cycleId, 10);
    if (!cid) return res.json({ success: false, message: 'الدورة مطلوبة' });
    const db = getDb();
    const cycle = (await db.query('SELECT id FROM financial_cycles WHERE id = $1 AND user_id = $2', [cid, req.session.userId])).rows[0];
    if (!cycle) return res.json({ success: false, message: 'الدورة غير موجودة' });
    const users = await fetchDeferredBalanceUsers(cid, req.session.userId);
    const total = users.reduce((s, u) => s + (u.balance_d || 0), 0);
    res.json({ success: true, users, deferredBalance: total });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل' });
  }
});

/** قائمة المستخدمين غير المدققين (رصيد مؤجل) */
router.get('/deferred-users', requireAuth, async (req, res) => {
  try {
    const { cycleId } = req.query || {};
    const cid = parseInt(cycleId, 10);
    if (!cid) return res.json({ success: false, message: 'الدورة مطلوبة', users: [] });
    const db = getDb();
    const cycle = (await db.query('SELECT id FROM financial_cycles WHERE id = $1 AND user_id = $2', [cid, req.session.userId])).rows[0];
    if (!cycle) return res.json({ success: false, message: 'الدورة غير موجودة', users: [] });
    const users = (await db.query('SELECT member_user_id, extra_id_c, balance_d FROM deferred_balance_users WHERE cycle_id = $1 ORDER BY member_user_id', [cid])).rows;
    res.json({ success: true, users });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل', users: [] });
  }
});

module.exports = router;
