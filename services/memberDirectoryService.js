/**
 * ملف مركزي لكل عضو (member_user_id) + أحداث + تجميعات من المؤجل والتدقيق.
 */

async function upsertMemberProfileFromAudit(db, userId, cycleId, memberUserId, status, source, details) {
  const mid = String(memberUserId || '').trim();
  if (!mid || !userId) return;
  const title = details && (details.title || details.name) ? String(details.title || details.name).trim() : null;
  const meta = details && typeof details === 'object' ? { ...details, lastAuditCycleId: cycleId, lastAuditAt: new Date().toISOString() } : { lastAuditCycleId: cycleId };

  const metaStr = JSON.stringify(meta);
  await db.query(
    `INSERT INTO member_profiles (user_id, member_user_id, display_name, last_seen_name, meta_json, updated_at)
     VALUES ($1, $2, COALESCE($3, $4), COALESCE($4, $3), $5, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, member_user_id) DO UPDATE SET
       display_name = COALESCE(EXCLUDED.display_name, member_profiles.display_name),
       last_seen_name = COALESCE(EXCLUDED.last_seen_name, member_profiles.last_seen_name),
       meta_json = COALESCE(EXCLUDED.meta_json, member_profiles.meta_json),
       updated_at = CURRENT_TIMESTAMP`,
    [userId, mid, title, title, metaStr]
  );

  if (status === 'مدقق') {
    await db.query(
      `INSERT INTO member_profile_events (user_id, member_user_id, event_type, cycle_id, notes, status, meta_json)
       VALUES ($1, $2, 'audit_approved', $3, $4, 'done', $5)`,
      [
        userId,
        mid,
        cycleId || null,
        source || 'تدقيق',
        details ? JSON.stringify(details) : null,
      ]
    );
  }
}

async function refreshMemberDeferredSnapshot(db, userId, memberUserId) {
  const mid = String(memberUserId || '').trim();
  const row = (await db.query(
    `SELECT COALESCE(SUM(balance_d), 0)::float AS t FROM deferred_salary_lines WHERE user_id = $1 AND member_user_id = $2`,
    [userId, mid]
  )).rows[0];
  const total = row?.t ?? 0;
  await db.query(
    `INSERT INTO member_profiles (user_id, member_user_id, deferred_balance_usd, updated_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, member_user_id) DO UPDATE SET
       deferred_balance_usd = EXCLUDED.deferred_balance_usd,
       updated_at = CURRENT_TIMESTAMP`,
    [userId, mid, total]
  );
}

async function listMemberProfiles(db, userId, { q = '', page = 1, pageSize = 50 } = {}) {
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 50));
  const p = Math.max(1, parseInt(page, 10) || 1);
  const offset = (p - 1) * ps;
  const term = `%${String(q || '').trim()}%`;
  const countRow = (await db.query(
    `SELECT COUNT(*)::int AS c FROM member_profiles WHERE user_id = $1
     AND ($2 = '' OR member_user_id ILIKE $3 OR COALESCE(display_name,'') ILIKE $3 OR COALESCE(last_seen_name,'') ILIKE $3)`,
    [userId, String(q || '').trim(), term]
  )).rows[0];
  const total = countRow?.c ?? 0;
  const rows = (await db.query(
    `SELECT id, member_user_id, display_name, last_seen_name, total_salary_audited_usd, deferred_balance_usd, debt_to_company_usd, updated_at
     FROM member_profiles
     WHERE user_id = $1
     AND ($2 = '' OR member_user_id ILIKE $3 OR COALESCE(display_name,'') ILIKE $3 OR COALESCE(last_seen_name,'') ILIKE $3)
     ORDER BY updated_at DESC NULLS LAST, member_user_id ASC
     LIMIT $4 OFFSET $5`,
    [userId, String(q || '').trim(), term, ps, offset]
  )).rows;
  return { rows, total, page: p, pageSize: ps };
}

async function getMemberProfileRow(db, userId, memberUserId) {
  const mid = String(memberUserId || '').trim();
  return (await db.query(
    `SELECT * FROM member_profiles WHERE user_id = $1 AND member_user_id = $2`,
    [userId, mid]
  )).rows[0] || null;
}

async function getMemberDetail(db, userId, memberUserId) {
  const { getMemberDeferredHistory } = require('./deferredSalaryService');
  const mid = String(memberUserId || '').trim();
  await refreshMemberDeferredSnapshot(db, userId, mid);
  const profile = await getMemberProfileRow(db, userId, mid);
  const deferredHistory = await getMemberDeferredHistory(db, userId, mid);
  const auditRows = (await db.query(
    `SELECT cycle_id, audit_status, audit_source, details_json, updated_at
     FROM payroll_user_audit_cache
     WHERE user_id = $1 AND member_user_id = $2
     ORDER BY updated_at DESC NULLS LAST
     LIMIT 50`,
    [userId, mid]
  )).rows;
  const events = (await db.query(
    `SELECT id, event_type, amount, cycle_id, notes, status, meta_json, created_at
     FROM member_profile_events
     WHERE user_id = $1 AND member_user_id = $2
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId, mid]
  )).rows;
  const adjustments = (await db.query(
    `SELECT id, kind, amount, status, notes, cycle_id, created_at, processed_at
     FROM member_adjustments
     WHERE user_id = $1 AND member_user_id = $2
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId, mid]
  )).rows;
  return { profile, deferredHistory, auditRows, events, adjustments };
}

module.exports = {
  upsertMemberProfileFromAudit,
  refreshMemberDeferredSnapshot,
  listMemberProfiles,
  getMemberProfileRow,
  getMemberDetail,
};
