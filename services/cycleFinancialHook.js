const { computeReceivablesToUs } = require('./debtAggregation');
const { computePaymentDue } = require('./paymentDueService');

/**
 * بعد إنشاء دورة مالية: لقطة تدقيق (أرصدة دين لنا / مطلوب دفع) لاستخدامها لاحقاً في قواعد ترحيل أو تدقيق.
 * لا يُعدّل أرصدة الكيانات تلقائياً دون قواعد محاسبية صريحة.
 */
async function onFinancialCycleCreated(db, userId, cycleId) {
  const recv = await computeReceivablesToUs(db, userId);
  const due = await computePaymentDue(db, userId);
  try {
    await db.query(
      `INSERT INTO financial_cycle_opening_snapshots (user_id, cycle_id, receivables_json, payment_due_json)
       VALUES ($1, $2, $3, $4)`,
      [userId, cycleId, JSON.stringify(recv), JSON.stringify(due)]
    );
  } catch (e) {
    console.warn('[cycleFinancialHook] snapshot skipped:', e.message);
  }
}

module.exports = { onFinancialCycleCreated };
