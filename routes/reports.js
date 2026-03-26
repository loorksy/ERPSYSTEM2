const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db/database');
const {
  ensureCycleOwnership,
  getSummarySnapshot,
  getSubAgencyReportData,
  getAccreditationsReportData,
  getTransferCompaniesReportData,
  getMovementsReportData,
  getComprehensiveReportData,
} = require('../services/accountingReportData');
const {
  renderSubAgency,
  renderAccreditations,
  renderTransferCompanies,
  renderMovements,
  renderComprehensive,
  htmlToPdfBuffer,
  encodeFilenameRfc5987,
} = require('../services/pdf/htmlAccountingPdf');

function sendPdf(res, filename, buffer) {
  const displayName = (filename && String(filename).trim()) || 'report.pdf';
  /** الاسم العربي فقط في filename* (RFC 5987) — ترميز UTF-8 كنسب مئوية ASCII؛ لا نضع أحرف غير ASCII في filename= */
  const star = encodeFilenameRfc5987(displayName);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="report.pdf"; filename*=UTF-8''${star}`
  );
  res.send(buffer);
}

function parseCycleId(q) {
  if (!q || q === '') return null;
  const n = parseInt(q, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** GET /api/reports/pdf/sub-agency?subAgencyId=&cycleId= */
router.get('/pdf/sub-agency', requireAuth, async (req, res) => {
  try {
    const subAgencyId = parseInt(req.query.subAgencyId, 10);
    if (!subAgencyId) {
      return res.status(400).json({ success: false, message: 'subAgencyId مطلوب' });
    }
    const cycleId = parseCycleId(req.query.cycleId);
    const db = getDb();
    const userId = req.session.userId;
    if (cycleId) {
      const c = await ensureCycleOwnership(db, userId, cycleId);
      if (!c) return res.status(404).json({ success: false, message: 'الدورة غير موجودة' });
    }
    const data = await getSubAgencyReportData(db, userId, subAgencyId, cycleId);
    if (!data) return res.status(404).json({ success: false, message: 'الوكالة غير موجودة' });
    const html = renderSubAgency(data);
    const buf = await htmlToPdfBuffer(html);
    const name = `وكالة-${data.agency.name || subAgencyId}.pdf`;
    sendPdf(res, name, buf);
  } catch (e) {
    console.error('[reports] sub-agency PDF:', e);
    res.status(500).json({ success: false, message: e.message || 'فشل إنشاء PDF' });
  }
});

router.get('/pdf/accreditations', requireAuth, async (req, res) => {
  try {
    const cycleId = parseCycleId(req.query.cycleId);
    const db = getDb();
    const userId = req.session.userId;
    if (cycleId) {
      const c = await ensureCycleOwnership(db, userId, cycleId);
      if (!c) return res.status(404).json({ success: false, message: 'الدورة غير موجودة' });
    }
    const data = await getAccreditationsReportData(db, userId, cycleId);
    const html = renderAccreditations(data);
    const buf = await htmlToPdfBuffer(html);
    sendPdf(res, 'اعتمادات.pdf', buf);
  } catch (e) {
    console.error('[reports] accreditations PDF:', e);
    res.status(500).json({ success: false, message: e.message || 'فشل إنشاء PDF' });
  }
});

router.get('/pdf/transfer-companies', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const data = await getTransferCompaniesReportData(db, req.session.userId);
    const html = renderTransferCompanies(data);
    const buf = await htmlToPdfBuffer(html);
    sendPdf(res, 'شركات-التحويل.pdf', buf);
  } catch (e) {
    console.error('[reports] transfer-companies PDF:', e);
    res.status(500).json({ success: false, message: e.message || 'فشل إنشاء PDF' });
  }
});

router.get('/pdf/movements', requireAuth, async (req, res) => {
  try {
    const cycleId = parseCycleId(req.query.cycleId);
    const db = getDb();
    const userId = req.session.userId;
    if (cycleId) {
      const c = await ensureCycleOwnership(db, userId, cycleId);
      if (!c) return res.status(404).json({ success: false, message: 'الدورة غير موجودة' });
    }
    const data = await getMovementsReportData(db, userId, cycleId);
    if (cycleId && !data) return res.status(404).json({ success: false, message: 'الدورة غير موجودة' });
    const html = renderMovements(data);
    const buf = await htmlToPdfBuffer(html);
    sendPdf(res, 'حركات.pdf', buf);
  } catch (e) {
    console.error('[reports] movements PDF:', e);
    res.status(500).json({ success: false, message: e.message || 'فشل إنشاء PDF' });
  }
});

router.get('/pdf/comprehensive', requireAuth, async (req, res) => {
  try {
    const cycleId = parseCycleId(req.query.cycleId);
    const db = getDb();
    const userId = req.session.userId;
    if (cycleId) {
      const c = await ensureCycleOwnership(db, userId, cycleId);
      if (!c) return res.status(404).json({ success: false, message: 'الدورة غير موجودة' });
    }
    const data = await getComprehensiveReportData(db, userId, cycleId);
    const html = renderComprehensive(data);
    const buf = await htmlToPdfBuffer(html);
    sendPdf(res, 'تقرير-شامل.pdf', buf);
  } catch (e) {
    console.error('[reports] comprehensive PDF:', e);
    res.status(500).json({ success: false, message: e.message || 'فشل إنشاء PDF' });
  }
});

/** JSON ملخص للعرض (اختياري) */
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const cycleId = parseCycleId(req.query.cycleId);
    const db = getDb();
    const s = await getSummarySnapshot(db, req.session.userId, cycleId);
    res.json({ success: true, summary: s });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل' });
  }
});

module.exports = router;
