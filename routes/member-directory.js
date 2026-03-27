const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getDb } = require('../db/database');
const { listMemberProfiles, getMemberDetail } = require('../services/memberDirectoryService');

router.get('/list', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const q = req.query.q || '';
    const page = parseInt(req.query.page, 10) || 1;
    const pageSize = parseInt(req.query.pageSize, 10) || 50;
    const data = await listMemberProfiles(db, req.session.userId, { q, page, pageSize });
    res.json({ success: true, ...data });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل', rows: [], total: 0 });
  }
});

router.get('/member/:memberUserId', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const memberUserId = decodeURIComponent(String(req.params.memberUserId || ''));
    if (!memberUserId.trim()) {
      return res.json({ success: false, message: 'رقم مستخدم غير صالح' });
    }
    const detail = await getMemberDetail(db, req.session.userId, memberUserId);
    res.json({ success: true, ...detail });
  } catch (e) {
    res.json({ success: false, message: e.message || 'فشل' });
  }
});

module.exports = router;
