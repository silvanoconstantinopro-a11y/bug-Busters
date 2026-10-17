const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../database/db');
const asyncHandler = require('../middleware/async-handler');
const PostgresRateLimitStore = require('../middleware/postgres-rate-limit-store');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiadas tentativas. Tente novamente mais tarde.' },
  store: new PostgresRateLimitStore('login'),
});

router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Credenciais em falta.' });

  const { rows } = await db.query(
    'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
    [email],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.fullName = user.full_name;
  await new Promise((resolve, reject) => {
    req.session.save((error) => error ? reject(error) : resolve());
  });

  await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
  await db.query('INSERT INTO audit_logs (actor_id, action, entity) VALUES (?, ?, ?)', [
    user.id, 'login', 'user',
  ]);
  res.json({
    ok: true,
    user: { id: user.id, email: user.email, fullName: user.full_name, role: user.role },
  });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const userId = req.session?.userId;
  if (req.session) {
    await new Promise((resolve, reject) => {
      req.session.destroy((error) => error ? reject(error) : resolve());
    });
  }
  if (userId) {
    await db.query('INSERT INTO audit_logs (actor_id, action, entity) VALUES (?, ?, ?)', [
      userId, 'logout', 'user',
    ]);
  }
  res.clearCookie('bb.sid');
  res.json({ ok: true });
}));

router.get('/me', (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ error: 'Não autenticado.' });
  res.json({
    id: req.session.userId,
    role: req.session.role,
    fullName: req.session.fullName,
  });
});

module.exports = router;
