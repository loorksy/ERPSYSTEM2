const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db/database');
const { processAdjustment } = require('../services/memberAdjustmentsService');

router.post('/apply', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { memberUserId, kind, amount, notes, cycleId } = req.body || {};
    const r = await processAdjustment(db, req.session.userId, {
      memberUserId,
      kind,
      amount,
      notes,
      cycleId: cycleId != null ? parseInt(cycleId, 10) : null,
    });
    if (!r.success) return res.json(r);
    res.json({ success: true, message: 'تم التسجيل', id: r.id });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل' });
  }
});

module.exports = router;
