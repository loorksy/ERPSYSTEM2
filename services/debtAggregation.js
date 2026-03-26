/**
 * تجميع إجمالي الديون لعرض اللوحة وصفحة الديون (نفس المنطق في كلا المكانين).
 */
async function computeDebtBreakdown(db, userId) {
  const sellAgg = (await db.query(`
    SELECT COALESCE(SUM(CASE WHEN status = 'debt' THEN total ELSE 0 END), 0)::float AS debt_sell
    FROM shipping_transactions WHERE type = 'sell'
  `)).rows[0];
  const shippingDebt = sellAgg?.debt_sell ?? 0;

  const accDebt = (await db.query(`
    SELECT COALESCE(SUM(-balance_amount), 0)::float AS t
    FROM accreditation_entities WHERE user_id = $1 AND balance_amount < 0
  `, [userId])).rows[0];
  const accreditationDebtTotal = accDebt?.t ?? 0;

  let payablesSumUsd = 0;
  try {
    const payRows = (await db.query(
      `SELECT COALESCE(SUM(amount), 0)::float AS t FROM entity_payables WHERE user_id = $1 AND currency = 'USD'`,
      [userId]
    )).rows[0];
    payablesSumUsd = payRows?.t ?? 0;
  } catch (_) {
    payablesSumUsd = 0;
  }

  const negCompanies = (await db.query(
    `SELECT id, name, balance_amount, balance_currency
     FROM transfer_companies
     WHERE user_id = $1 AND balance_amount < 0`,
    [userId]
  )).rows;

  const negFunds = (await db.query(
    `SELECT f.id, f.name, fb.amount, fb.currency
     FROM funds f
     JOIN fund_balances fb ON fb.fund_id = f.id
     WHERE f.user_id = $1 AND fb.amount < 0 AND fb.currency = 'USD'`,
    [userId]
  )).rows;

  let companyDebtFromBalance = 0;
  negCompanies.forEach((c) => {
    if ((c.balance_currency || 'USD') === 'USD') companyDebtFromBalance += Math.abs(c.balance_amount || 0);
  });

  let fundDebtFromBalance = 0;
  negFunds.forEach((f) => {
    fundDebtFromBalance += Math.abs(f.amount || 0);
  });

  const totalDebts =
    shippingDebt +
    accreditationDebtTotal +
    payablesSumUsd +
    companyDebtFromBalance +
    fundDebtFromBalance;

  return {
    shippingDebt,
    accreditationDebtTotal,
    payablesSumUsd,
    companyDebtFromBalance,
    fundDebtFromBalance,
    fxSpreadSumUsd: 0,
    totalDebts,
  };
}

/**
 * تجميع «ديين لنا»: أرصدة لصالحنا عبر المعتمدين وشركات التحويل والصناديق.
 * الوكالات الفرعية: يُعرض فقط الرصيد المحاسبي السالب (الوكالة مدينة لنا)، كقيمة موجبة amountOwedToUs.
 */
async function computeReceivablesToUs(db, userId) {
  const accreditation = (await db.query(
    `SELECT id, name, code, balance_amount AS amount
     FROM accreditation_entities
     WHERE user_id = $1 AND balance_amount > 0
     ORDER BY name`,
    [userId]
  )).rows;

  const transferCompanies = (await db.query(
    `SELECT id, name, balance_amount AS amount, balance_currency
     FROM transfer_companies
     WHERE user_id = $1 AND balance_amount > 0
     ORDER BY name`,
    [userId]
  )).rows;

  const funds = (await db.query(
    `SELECT f.id, f.name, f.fund_number, fb.amount, fb.currency
     FROM funds f
     JOIN fund_balances fb ON fb.fund_id = f.id
     WHERE f.user_id = $1 AND COALESCE(f.exclude_from_dashboard, 0) = 0
       AND fb.currency = 'USD' AND fb.amount > 0
     ORDER BY f.is_main DESC, f.name`,
    [userId]
  )).rows;

  const subAgencyRows = (await db.query(`
    SELECT s.id, s.name,
      COALESCE(SUM(CASE WHEN t.type IN ('profit', 'reward') THEN t.amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN t.type IN ('deduction', 'due') THEN t.amount ELSE 0 END), 0) AS balance
    FROM shipping_sub_agencies s
    LEFT JOIN sub_agency_transactions t ON t.sub_agency_id = s.id
    GROUP BY s.id, s.name
    HAVING (
      COALESCE(SUM(CASE WHEN t.type IN ('profit', 'reward') THEN t.amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN t.type IN ('deduction', 'due') THEN t.amount ELSE 0 END), 0)
    ) < -0.0001
    ORDER BY s.name
  `)).rows;

  let totalUsd = 0;
  accreditation.forEach((r) => { totalUsd += r.amount || 0; });
  transferCompanies.forEach((r) => {
    if ((r.balance_currency || 'USD') === 'USD') totalUsd += r.amount || 0;
  });
  funds.forEach((r) => { totalUsd += r.amount || 0; });
  subAgencyRows.forEach((r) => {
    const owed = Math.abs(r.balance || 0);
    totalUsd += owed;
  });

  return {
    totalUsd,
    accreditation,
    transferCompanies,
    funds,
    subAgencies: subAgencyRows.map((r) => ({
      id: r.id,
      name: r.name,
      balanceRaw: r.balance,
      amountOwedToUs: Math.abs(r.balance || 0),
    })),
  };
}

/**
 * توسعة مستقبلية محتملة: تسجيل صريح لتحويلات نقدية للوكالة مقابل نصيب الربح
 * (أنواع حركات جديدة أو جدول مرتبط بالصندوق) — راجع منطق sub_agency_transactions و fund_ledger.
 */

module.exports = { computeDebtBreakdown, computeReceivablesToUs };
