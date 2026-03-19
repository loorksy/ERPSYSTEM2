const { google } = require('googleapis');
const { getDb } = require('../db/database');
const { normalizeUserId } = require('./payrollSearchService');
const { parseDecimal } = require('../utils/numbers');

function getOAuth2Client(credentials) {
  const clientId = credentials?.client_id || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = credentials?.client_secret || process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL || 'http://localhost:3000'}/sheets/callback`);
}

function columnLetterToIndex(letter) {
  if (letter == null || letter === '') return null;
  const s = String(letter).trim().toUpperCase();
  let idx = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i) - 65;
    if (c < 0 || c > 25) return null;
    idx = idx * 26 + (c + 1);
  }
  return idx - 1;
}

async function fetchSheetValuesBatched(sheets, spreadsheetId, title) {
  const allRows = [];
  const BATCH = 5000;
  const MAX = 150000;
  let startRow = 1;
  while (startRow <= MAX) {
    const endRow = startRow + BATCH - 1;
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${title}'!A${startRow}:ZZ${endRow}`
    });
    const batch = res.data.values || [];
    if (batch.length === 0) break;
    allRows.push(...batch);
    if (batch.length < BATCH) break;
    startRow = endRow + 1;
  }
  return allRows;
}

function isHeaderRow(row, colIdx) {
  if (!row || colIdx == null) return true;
  const val = row[colIdx] != null ? String(row[colIdx]).trim() : '';
  if (!val) return true;
  const normalized = normalizeUserId(val);
  if (!normalized) return true;
  const n = parseFloat(normalized);
  return isNaN(n) || !isFinite(n);
}

/**
 * مزامنة الوكالات الفرعية من جدول الإدارة
 * - كل ورقة (ما عدا الأولى) = وكالة فرعية
 * - الأعمدة: A=رقم المستخدم، B=اسم المستخدم، W=الربح الأساسي
 * @param {number} cycleId
 * @param {number} userId
 * @param {object} sheetsApi - Google Sheets API instance (auth already set)
 * @returns {{ success: boolean, usersCount?: number, agenciesCount?: number, error?: string }}
 */
async function syncAgenciesFromManagementTable(cycleId, userId, sheetsApi) {
  const db = getDb();
  const cycle = db.prepare(
    'SELECT id, management_spreadsheet_id FROM financial_cycles WHERE id = ? AND user_id = ?'
  ).get(cycleId, userId);
  if (!cycle || !cycle.management_spreadsheet_id) {
    return { success: false, error: 'الدورة غير موجودة أو غير مرتبطة بجدول الإدارة' };
  }

  const spreadsheetId = String(cycle.management_spreadsheet_id).trim();
  const sheets = sheetsApi || google.sheets({ version: 'v4', auth: null });

  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheetList = meta.data.sheets || [];
    const titles = sheetList.map(s => (s.properties && s.properties.title) || '').filter(Boolean);
    if (titles.length < 2) {
      return { success: true, usersCount: 0, agenciesCount: 0 };
    }

    const agencySheetNames = titles.slice(1);
    const COL_A = 0;
    const COL_B = 1;
    const COL_W = columnLetterToIndex('W') ?? 22;

    let totalUsers = 0;
    const seenUserIds = new Set();

    for (const sheetName of agencySheetNames) {
      let agency = db.prepare('SELECT id, name, commission_percent, company_percent FROM shipping_sub_agencies WHERE name = ?').get(sheetName);
      if (!agency) {
        db.prepare('INSERT INTO shipping_sub_agencies (name, commission_percent, company_percent) VALUES (?, 0, 0)').run(sheetName);
        agency = db.prepare('SELECT id, name, commission_percent, company_percent FROM shipping_sub_agencies WHERE name = ?').get(sheetName);
      }

      const companyPercent = (agency.company_percent != null && !isNaN(agency.company_percent)) ? agency.company_percent : (100 - (agency.commission_percent || 0));
      const agencyPercent = 100 - companyPercent;

      let rows = [];
      try {
        rows = await fetchSheetValuesBatched(sheets, spreadsheetId, sheetName);
      } catch (e) {
        continue;
      }

      const headerRows = rows.length > 0 && isHeaderRow(rows[0], COL_A) ? 1 : 0;
      const dataRows = rows.slice(headerRows);

      for (const row of dataRows) {
        const memberUserId = normalizeUserId(row[COL_A]);
        if (!memberUserId) continue;

        const userName = (row[COL_B] != null ? String(row[COL_B]) : '').trim();
        const baseProfitW = parseDecimal(row[COL_W]);

        db.prepare(
          `INSERT INTO agency_cycle_users (cycle_id, sub_agency_id, member_user_id, user_name, base_profit_w, synced_at)
           VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(cycle_id, sub_agency_id, member_user_id) DO UPDATE SET
             user_name = excluded.user_name,
             base_profit_w = excluded.base_profit_w,
             synced_at = CURRENT_TIMESTAMP`
        ).run(cycleId, agency.id, memberUserId, userName, baseProfitW);

        db.prepare(
          `INSERT INTO user_agency_link (member_user_id, sub_agency_id, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(member_user_id) DO UPDATE SET sub_agency_id = excluded.sub_agency_id, updated_at = CURRENT_TIMESTAMP`
        ).run(memberUserId, agency.id);

        if (!seenUserIds.has(memberUserId)) {
          seenUserIds.add(memberUserId);
          totalUsers++;
        }

        const agencyProfit = baseProfitW * (agencyPercent / 100);
        if (agencyProfit > 0) {
          const existing = db.prepare(
            `SELECT id FROM sub_agency_transactions
             WHERE sub_agency_id = ? AND cycle_id = ? AND member_user_id = ? AND type = 'profit'`
          ).get(agency.id, cycleId, memberUserId);
          if (!existing) {
            db.prepare(
              `INSERT INTO sub_agency_transactions (sub_agency_id, type, amount, notes, cycle_id, member_user_id)
               VALUES (?, 'profit', ?, ?, ?, ?)`
            ).run(agency.id, agencyProfit, `ربح من مزامنة - مستخدم ${memberUserId}`, cycleId, memberUserId);
          }
        }
      }

      try {
        db.prepare(
          `INSERT INTO agency_sheet_mapping (sub_agency_id, cycle_id, sheet_name, spreadsheet_id)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(sub_agency_id, cycle_id) DO UPDATE SET sheet_name = excluded.sheet_name, spreadsheet_id = excluded.spreadsheet_id`
        ).run(agency.id, cycleId, sheetName, spreadsheetId);
      } catch (_) {}
    }

    db.prepare(
      'INSERT INTO agency_sync_log (cycle_id, synced_at, users_count, agencies_count) VALUES (?, CURRENT_TIMESTAMP, ?, ?)'
    ).run(cycleId, totalUsers, agencySheetNames.length);

    return { success: true, usersCount: totalUsers, agenciesCount: agencySheetNames.length };
  } catch (e) {
    return { success: false, error: e.message || 'فشل المزامنة' };
  }
}

/**
 * حساب رصيد الصندوق من الورقة الأولى
 * W = مجموع (للمستخدمين في وكالة: نسبة الشركة فقط)، Y+Z = كامل
 */
async function calculateCashBoxBalance(cycleId, userId, sheetsApi) {
  const db = getDb();
  const cycle = db.prepare(
    'SELECT management_spreadsheet_id, management_sheet_name FROM financial_cycles WHERE id = ? AND user_id = ?'
  ).get(cycleId, userId);
  if (!cycle || !cycle.management_spreadsheet_id) return null;

  let sheets = sheetsApi;
  if (!sheets) {
    const config = db.prepare('SELECT token, credentials FROM google_sheets_config WHERE id = 1').get();
    if (!config?.token) return null;
    const credentials = config.credentials ? JSON.parse(config.credentials) : null;
    const oauth2Client = getOAuth2Client(credentials);
    if (!oauth2Client) return null;
    oauth2Client.setCredentials(typeof config.token === 'string' ? JSON.parse(config.token) : config.token);
    sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  }

  const spreadsheetId = String(cycle.management_spreadsheet_id).trim();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const titles = meta.data.sheets?.map(s => s.properties?.title || '')?.filter(Boolean) || [];
  const sheetToUse = titles[0];
  if (!sheetToUse) return null;

  const rows = await fetchSheetValuesBatched(sheets, spreadsheetId, sheetToUse);
  const COL_W = columnLetterToIndex('W') ?? 22;
  const COL_Y = columnLetterToIndex('Y') ?? 24;
  const COL_Z = columnLetterToIndex('Z') ?? 25;

  const headerRows = rows.length > 0 && isHeaderRow(rows[0], 0) ? 1 : 0;
  const dataRows = rows.slice(headerRows);

  const userLinks = db.prepare('SELECT member_user_id, sub_agency_id FROM user_agency_link').all();
  const userToAgency = {};
  userLinks.forEach(r => { userToAgency[r.member_user_id] = r.sub_agency_id; });

  let sourceFirstSheetW = 0;
  let sourceYZ = 0;
  let companyProfit = 0;

  for (const row of dataRows) {
    const memberUserId = normalizeUserId(row[0]);
    const wNum = parseDecimal(row[COL_W]);
    const agencyId = memberUserId ? userToAgency[memberUserId] : null;
    if (agencyId) {
      const agency = db.prepare('SELECT company_percent, commission_percent FROM shipping_sub_agencies WHERE id = ?').get(agencyId);
      const cp = (agency?.company_percent != null && !isNaN(agency.company_percent)) ? agency.company_percent : (100 - (agency?.commission_percent || 0));
      sourceFirstSheetW += wNum * (cp / 100);
      companyProfit += wNum * (cp / 100);
    } else {
      sourceFirstSheetW += wNum;
    }
    sourceYZ += parseDecimal(row[COL_Y]) + parseDecimal(row[COL_Z]);
  }

  const cashBalance = sourceFirstSheetW + sourceYZ;
  const details = { sourceFirstSheetW, sourceYZ, companyProfit };

  db.prepare(
    `INSERT INTO cash_box_snapshot (cycle_id, snapshot_at, cash_balance, source_first_sheet_w, source_y_z, company_profit, details_json)
     VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)`
  ).run(cycleId, cashBalance, sourceFirstSheetW, sourceYZ, companyProfit, JSON.stringify(details));

  return { cashBalance, sourceFirstSheetW, sourceYZ, companyProfit };
}

/**
 * جلب رصيد المؤجل: مستخدمون غير مدققين من جدول الوكيل (A, C, D)
 */
async function fetchDeferredBalanceUsers(cycleId, userId, sheetsApi) {
  const db = getDb();
  const cycle = db.prepare(
    'SELECT agent_spreadsheet_id, agent_sheet_name FROM financial_cycles WHERE id = ? AND user_id = ?'
  ).get(cycleId, userId);
  if (!cycle || !cycle.agent_spreadsheet_id) return [];

  const audited = db.prepare(
    'SELECT member_user_id FROM payroll_user_audit_cache WHERE cycle_id = ? AND user_id = ? AND audit_status = ?'
  ).all(cycleId, userId, 'مدقق');
  const auditedSet = new Set((audited || []).map(r => String(r.member_user_id)));

  let sheets = sheetsApi;
  if (!sheets) {
    const config = db.prepare('SELECT token, credentials FROM google_sheets_config WHERE id = 1').get();
    if (!config?.token) return [];
    const credentials = config.credentials ? JSON.parse(config.credentials) : null;
    const oauth2Client = getOAuth2Client(credentials);
    if (!oauth2Client) return [];
    oauth2Client.setCredentials(typeof config.token === 'string' ? JSON.parse(config.token) : config.token);
    sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  }

  const spreadsheetId = String(cycle.agent_spreadsheet_id).trim();
  const sheetName = (cycle.agent_sheet_name && String(cycle.agent_sheet_name).trim()) || null;

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const titles = meta.data.sheets?.map(s => s.properties?.title || '')?.filter(Boolean) || [];
  const sheetToUse = sheetName && titles.includes(sheetName) ? sheetName : titles[0];
  if (!sheetToUse) return [];

  const rows = await fetchSheetValuesBatched(sheets, spreadsheetId, sheetToUse);
  const COL_A = 0;
  const COL_C = 2;
  const COL_D = 3;

  const headerRows = rows.length > 0 && isHeaderRow(rows[0], COL_A) ? 1 : 0;
  const dataRows = rows.slice(headerRows);

  const result = [];
  db.prepare('DELETE FROM deferred_balance_users WHERE cycle_id = ?').run(cycleId);

  for (const row of dataRows) {
    const memberUserId = normalizeUserId(row[COL_A]);
    if (!memberUserId || auditedSet.has(memberUserId)) continue;

    const extraIdC = (row[COL_C] != null ? String(row[COL_C]) : '').trim();
    const balanceD = parseDecimal(row[COL_D]);

    result.push({ member_user_id: memberUserId, extra_id_c: extraIdC, balance_d: balanceD });
    db.prepare(
      'INSERT INTO deferred_balance_users (cycle_id, member_user_id, extra_id_c, balance_d, sheet_source, synced_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    ).run(cycleId, memberUserId, extraIdC, balanceD, sheetToUse);
  }

  return result;
}

module.exports = {
  syncAgenciesFromManagementTable,
  calculateCashBoxBalance,
  fetchDeferredBalanceUsers,
  fetchSheetValuesBatched
};
