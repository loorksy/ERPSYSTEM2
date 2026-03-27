const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db/database');
const { getMainFundUsdBalance } = require('../services/fundService');

/**
 * سياق الإجراء السريع: سيولة الصندوق الرئيسي والشحن لتحديد إن كان الصادر «كسراً» أو يحتاج دين علينا.
 */
router.get('/context', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const userId = req.session.userId;
    const { usd: mainFundUsd } = await getMainFundUsdBalance(db, userId);
    const shipRows = (await db.query(`
      SELECT type, item_type, SUM(quantity) as sum_qty
      FROM shipping_transactions
      GROUP BY type, item_type
    `)).rows;
    let gold = 0;
    let crystal = 0;
    shipRows.forEach((r) => {
      const q = parseFloat(r.sum_qty) || 0;
      if (r.item_type === 'gold') gold += r.type === 'buy' ? q : -q;
      else if (r.item_type === 'crystal') crystal += r.type === 'buy' ? q : -q;
    });
    const shippingQty = gold + crystal;
    const cashBlocked = (mainFundUsd || 0) <= 0 && shippingQty <= 0;
    res.json({
      success: true,
      mainFundUsd: mainFundUsd || 0,
      shippingGold: gold,
      shippingCrystal: crystal,
      shippingQtyTotal: shippingQty,
      cashBlocked,
      links: {
        receivablesToUs: '/receivables-to-us',
        paymentDueAnchor: '/receivables-to-us#payment-due',
        subAgencies: '/sub-agencies',
        approvals: '/approvals',
      },
    });
  } catch (e) {
    res.json({
      success: false,
      message: e.message || 'فشل',
      mainFundUsd: 0,
      shippingQtyTotal: 0,
      cashBlocked: true,
      links: {
        receivablesToUs: '/receivables-to-us',
        paymentDueAnchor: '/receivables-to-us#payment-due',
        subAgencies: '/sub-agencies',
        approvals: '/approvals',
      },
    });
  }
});

module.exports = router;
