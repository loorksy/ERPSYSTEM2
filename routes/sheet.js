const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db/database');
const { google } = require('googleapis');

const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.BASE_URL || 'http://localhost:3000'}/sheets/callback`;

function getOAuth2Client(credentials) {
  const clientId = credentials?.client_id || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = credentials?.client_secret || process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

/** قراءة ورقة من Google Sheets وإرجاع صفوف */
async function readSheetFromGoogle(spreadsheetId, sheetName, credentials, token) {
  const oauth2Client = getOAuth2Client(credentials);
  if (!oauth2Client) throw new Error('بيانات الاعتماد غير متوفرة');
  oauth2Client.setCredentials(typeof token === 'string' ? JSON.parse(token) : token);
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const firstSheetTitle = meta.data.sheets && meta.data.sheets[0] ? meta.data.sheets[0].properties.title : 'Sheet1';
  const title = sheetName && String(sheetName).trim() ? String(sheetName).trim() : firstSheetTitle;
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${title}'!A:ZZ`
  });
  const rows = (res.data.values || []);
  return rows;
}

const uploadsDir = path.join(__dirname, '../uploads/temp');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 15 * 1024 * 1024 }
});

function parseUploadedFile(filePath, mimetype) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const ext = path.extname(filePath).toLowerCase();
  let rows = [];
  try {
    if (ext === '.csv' || mimetype === 'text/csv') {
      const buf = fs.readFileSync(filePath, 'utf8');
      const lines = buf.split(/\r?\n/).filter(l => l.trim());
      rows = lines.map(line => {
        const out = [];
        let cell = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') {
            inQuotes = !inQuotes;
          } else if ((c === ',' && !inQuotes) || c === '\t') {
            out.push(cell.trim());
            cell = '';
          } else {
            cell += c;
          }
        }
        out.push(cell.trim());
        return out;
      });
    } else {
      const wb = XLSX.readFile(filePath, { cellDates: true });
      const firstSheet = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheet];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    }
  } finally {
    try { fs.unlinkSync(filePath); } catch (_) {}
  }
  return rows;
}

/** قائمة جداول المستخدم من Google Drive (مزامنة) */
router.get('/spreadsheets-list', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const config = db.prepare('SELECT token, credentials FROM google_sheets_config WHERE id = 1').get();
    if (!config?.token) {
      return res.json({ success: false, message: 'لم يتم تسجيل الدخول بـ Google. اربط من الإعدادات → Google Sheets.' });
    }
    const credentials = config.credentials ? JSON.parse(config.credentials) : null;
    const oauth2Client = getOAuth2Client(credentials);
    if (!oauth2Client) return res.json({ success: false, message: 'بيانات الاعتماد غير متوفرة' });
    oauth2Client.setCredentials(typeof config.token === 'string' ? JSON.parse(config.token) : config.token);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet'",
      pageSize: 200,
      fields: 'files(id, name)',
      orderBy: 'modifiedTime desc'
    });
    const files = (response.data.files || []).map(f => ({ id: f.id, name: f.name || f.id }));
    res.json({ success: true, spreadsheets: files });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل جلب قائمة الجداول' });
  }
});

/** قائمة أوراق جدول معيّن (لاستخدامه عند اختيار جدول الإدارة أو الوكيل) */
router.get('/spreadsheet-sheets', requireAuth, async (req, res) => {
  try {
    const spreadsheetId = req.query.spreadsheetId;
    if (!spreadsheetId) return res.json({ success: false, message: 'معرّف الجدول مطلوب' });
    const db = getDb();
    const config = db.prepare('SELECT token, credentials FROM google_sheets_config WHERE id = 1').get();
    if (!config?.token) return res.json({ success: false, message: 'لم يتم تسجيل الدخول بـ Google' });
    const credentials = config.credentials ? JSON.parse(config.credentials) : null;
    const oauth2Client = getOAuth2Client(credentials);
    if (!oauth2Client) return res.json({ success: false, message: 'بيانات الاعتماد غير متوفرة' });
    oauth2Client.setCredentials(typeof config.token === 'string' ? JSON.parse(config.token) : config.token);
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const list = (meta.data.sheets || []).map(s => ({ id: s.properties.sheetId, title: s.properties.title }));
    res.json({ success: true, sheets: list });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل جلب الأوراق' });
  }
});

/** قائمة الدورات المالية للمستخدم */
router.get('/cycles', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(
      'SELECT id, name, created_at FROM financial_cycles WHERE user_id = ? ORDER BY created_at DESC'
    ).all(req.session.userId);
    res.json({ success: true, cycles: rows });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

/** إنشاء دورة مالية (اسم + بيانات الإدارة + الوكيل) */
router.post('/cycles', requireAuth, (req, res) => {
  try {
    const { name, managementData, agentData } = req.body;
    if (!name || !String(name).trim()) {
      return res.json({ success: false, message: 'أدخل اسم الدورة' });
    }
    const db = getDb();
    const managementJson = managementData != null ? JSON.stringify(managementData) : null;
    const agentJson = agentData != null ? JSON.stringify(agentData) : null;
    const result = db.prepare(
      'INSERT INTO financial_cycles (user_id, name, management_data, agent_data) VALUES (?, ?, ?, ?)'
    ).run(req.session.userId, String(name).trim(), managementJson, agentJson);
    const id = result.lastInsertRowid != null ? result.lastInsertRowid : null;
    res.json({ success: true, id, message: 'تم حفظ الدورة المالية' });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

/** استيراد من Google: جدول الإدارة + جدول الوكيل */
router.post('/import-google', requireAuth, async (req, res) => {
  try {
    const { managementSpreadsheetId, managementSheetName, agentSpreadsheetId, agentSheetName } = req.body;
    const db = getDb();
    const config = db.prepare('SELECT token, credentials FROM google_sheets_config WHERE id = 1').get();
    if (!config?.token) {
      return res.json({ success: false, message: 'لم يتم تسجيل الدخول بـ Google. اربط من الإعدادات → Google Sheets.' });
    }
    const credentials = config.credentials ? JSON.parse(config.credentials) : null;
    if (!managementSpreadsheetId || !agentSpreadsheetId) {
      return res.json({ success: false, message: 'أدخل معرّف جدول الإدارة ومعرّف جدول الوكيل' });
    }
    const managementRows = await readSheetFromGoogle(
      managementSpreadsheetId.trim(),
      managementSheetName,
      credentials,
      config.token
    );
    const agentRows = await readSheetFromGoogle(
      agentSpreadsheetId.trim(),
      agentSheetName,
      credentials,
      config.token
    );
    res.json({
      success: true,
      managementRows,
      agentRows
    });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل الاستيراد من Google' });
  }
});

/** رفع ملفين يدوياً (إدارة + وكيل) — Excel أو CSV */
router.post('/upload', requireAuth, (req, res) => {
  const uploadTwo = upload.fields([
    { name: 'managementFile', maxCount: 1 },
    { name: 'agentFile', maxCount: 1 }
  ]);
  uploadTwo(req, res, (err) => {
    if (err) {
      return res.json({ success: false, message: err.message || 'خطأ في رفع الملفات' });
    }
    try {
      const managementFile = req.files && req.files.managementFile && req.files.managementFile[0];
      const agentFile = req.files && req.files.agentFile && req.files.agentFile[0];
      if (!managementFile || !agentFile) {
        return res.json({ success: false, message: 'ارفع ملف الإدارة وملف الوكيل معاً' });
      }
      const managementRows = parseUploadedFile(managementFile.path, managementFile.mimetype);
      const agentRows = parseUploadedFile(agentFile.path, agentFile.mimetype);
      res.json({ success: true, managementRows, agentRows });
    } catch (e) {
      res.json({ success: false, message: e.message || 'فشل قراءة الملفات' });
    }
  });
});

module.exports = router;
