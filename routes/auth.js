const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');

router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('login', { title: 'تسجيل الدخول', error: null });
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = getDb();
    const user = (await db.query('SELECT * FROM users WHERE username = $1', [username])).rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.render('login', { title: 'تسجيل الدخول', error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    }
    req.session.userId = user.id;
    req.session.user = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role
    };
    res.redirect('/dashboard');
  } catch (e) {
    console.error('[auth] Login error:', e.message);
    res.render('login', { title: 'تسجيل الدخول', error: 'حدث خطأ. حاول مرة أخرى.' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
