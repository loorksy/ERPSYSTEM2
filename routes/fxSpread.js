const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db/database');

/**
 * السعران: عدد وحدات العملة الأجنبية مقابل 1 دولار (مثال: 42 ليرة تركية = 1 USD).
 * فرق القيمة بالدولار = |مبلغ/سعر_داخلي − مبلغ/سعر_التسليم|
 */
function computeSpreadUsd(amountForeign, internalRate, settlementRate) {
  const amt = parseFloat(amountForeign);
  const a = parseFloat(internalRate);
  const b = parseFloat(settlementRate);
  if (!(amt > 0) || !(a > 0) || !(b > 0)) return null;
  return Math.abs(amt / a - amt / b);
}

router.get('/list', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session.userId;
    const rows = (await db.query(
      `SELECT e.id, e.cycle_id, e.currency, e.amount_foreign, e.internal_rate, e.settlement_rate,
              e.spread_usd, e.entity_type, e.entity_id, e.notes, e.created_at,
              c.name AS cycle_name
       FROM fx_spread_entries e
       LEFT JOIN financial_cycles c ON c.id = e.cycle_id AND c.user_id = e.user_id
       WHERE e.user_id = $1
       ORDER BY e.created_at DESC
       LIMIT 500`,
      [userId]
    )).rows;
    const cycles = (await db.query(
      'SELECT id, name FROM financial_cycles WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    )).rows;
    res.json({ success: true, entries: rows, cycles });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل', entries: [], cycles: [] });
  }
});

router.post('/add', requireAuth, async (req, res) => {
  try {
    const {
      cycleId,
      currency,
      amountForeign,
      internalRate,
      settlementRate,
      spreadUsd: spreadOverride,
      entityType,
      entityId,
      notes,
    } = req.body || {};
    const cur = (currency || 'TRY').trim().toUpperCase();
    const amt = parseFloat(amountForeign);
    const ir = parseFloat(internalRate);
    const sr = parseFloat(settlementRate);
    let spread = spreadOverride != null && spreadOverride !== '' ? parseFloat(spreadOverride) : computeSpreadUsd(amt, ir, sr);
    if (spread == null || isNaN(spread) || spread < 0) {
      return res.json({ success: false, message: 'مبالغ وأسعار صالحة مطلوبة' });
    }
    const db = getDb();
    const userId = req.session.userId;
    let cid = cycleId ? parseInt(cycleId, 10) : null;
    if (cid) {
      const ok = (await db.query('SELECT id FROM financial_cycles WHERE id = $1 AND user_id = $2', [cid, userId])).rows[0];
      if (!ok) cid = null;
    }
    let et = null;
    let eid = null;
    if (entityType === 'fund' || entityType === 'transfer_company') {
      et = entityType;
      eid = parseInt(entityId, 10);
      if (!eid) {
        et = null;
        eid = null;
      } else if (et === 'transfer_company') {
        const ok = (await db.query('SELECT id FROM transfer_companies WHERE id = $1 AND user_id = $2', [eid, userId])).rows[0];
        if (!ok) return res.json({ success: false, message: 'شركة غير موجودة' });
      } else {
        const ok = (await db.query('SELECT id FROM funds WHERE id = $1 AND user_id = $2', [eid, userId])).rows[0];
        if (!ok) return res.json({ success: false, message: 'صندوق غير موجود' });
      }
    }
    const r = await db.query(
      `INSERT INTO fx_spread_entries
        (user_id, cycle_id, currency, amount_foreign, internal_rate, settlement_rate, spread_usd, entity_type, entity_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [userId, cid, cur, amt, ir, sr, spread, et, eid, notes || null]
    );
    res.json({ success: true, id: r.rows[0].id, spreadUsd: spread, message: 'تم تسجيل فرق التصريف' });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.json({ success: false, message: 'معرّف غير صالح' });
    const db = getDb();
    const r = await db.query('DELETE FROM fx_spread_entries WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.session.userId]);
    if (!r.rows.length) return res.json({ success: false, message: 'غير موجود' });
    res.json({ success: true, message: 'تم الحذف' });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل' });
  }
});

module.exports = router;
