const express = require('express');
const db = require('../database/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const asyncHandler = require('../middleware/async-handler');

const router = express.Router();
router.use(requireAuth);

router.get('/dashboard', asyncHandler(async (req, res) => {
  const [total, byStatus, recent] = await Promise.all([
    db.query('SELECT COUNT(*) AS c FROM project_requests'),
    db.query('SELECT status, COUNT(*) AS c FROM project_requests GROUP BY status'),
    db.query(`
      SELECT r.id, r.reference, r.title, r.status, r.priority, r.created_at,
             c.full_name AS client_name
      FROM project_requests r
      JOIN clients c ON c.id = r.client_id
      ORDER BY r.created_at DESC LIMIT 5
    `),
  ]);
  res.json({ total: Number(total.rows[0].c), byStatus: byStatus.rows, recent: recent.rows });
}));

router.get('/requests', asyncHandler(async (req, res) => {
  const { status, type, q, priority } = req.query;
  let sql = `
    SELECT r.*, c.full_name AS client_name, c.phone AS client_phone,
           c.email AS client_email, u.full_name AS assigned_name
    FROM project_requests r
    JOIN clients c ON c.id = r.client_id
    LEFT JOIN users u ON u.id = r.assigned_to_id
    WHERE TRUE
  `;
  const params = [];
  if (status) { sql += ' AND r.status = ?'; params.push(status); }
  if (type) { sql += ' AND r.project_type = ?'; params.push(type); }
  if (priority) { sql += ' AND r.priority = ?'; params.push(priority); }
  if (q) {
    sql += ' AND (r.title ILIKE ? OR r.reference ILIKE ? OR c.full_name ILIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY r.created_at DESC LIMIT 200';
  const { rows } = await db.query(sql, params);
  res.json(rows);
}));

router.get('/requests/:id', asyncHandler(async (req, res) => {
  const { rows } = await db.query(`
    SELECT r.*, c.full_name AS client_name, c.email AS client_email,
           c.phone AS client_phone, c.country, c.city, c.organization,
           u.full_name AS assigned_name
    FROM project_requests r
    JOIN clients c ON c.id = r.client_id
    LEFT JOIN users u ON u.id = r.assigned_to_id
    WHERE r.id = ?
  `, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Pedido não encontrado.' });
  res.json(rows[0]);
}));

router.get('/requests/:id/history', asyncHandler(async (req, res) => {
  const { rows } = await db.query(`
    SELECT h.*, u.full_name AS changed_by_name
    FROM request_status_history h
    LEFT JOIN users u ON u.id = h.changed_by_id
    WHERE h.request_id = ?
    ORDER BY h.created_at DESC
  `, [req.params.id]);
  res.json(rows);
}));

router.patch('/requests/:id', asyncHandler(async (req, res) => {
  const { status, priority, assigned_to_id, comment } = req.body || {};
  const allowedStatus = [
    'new', 'under_review', 'awaiting_client', 'quote_sent',
    'approved', 'in_development', 'completed', 'cancelled',
  ];
  const allowedPriority = ['low', 'normal', 'high', 'urgent'];
  const currentResult = await db.query('SELECT * FROM project_requests WHERE id = ?', [req.params.id]);
  const current = currentResult.rows[0];
  if (!current) return res.status(404).json({ error: 'Pedido não encontrado.' });

  await db.transaction(async (query) => {
    const updates = [];
    const values = [];
    const statusChanged = status && allowedStatus.includes(status) && status !== current.status;

    if (statusChanged) { updates.push('status = ?'); values.push(status); }
    if (priority && allowedPriority.includes(priority)) {
      updates.push('priority = ?');
      values.push(priority);
    }
    if (assigned_to_id !== undefined) {
      updates.push('assigned_to_id = ?');
      values.push(assigned_to_id || null);
    }
    if (updates.length) {
      updates.push('updated_at = NOW()');
      values.push(req.params.id);
      await query(`UPDATE project_requests SET ${updates.join(', ')} WHERE id = ?`, values);
    }

    if (statusChanged) {
      await query(`
        INSERT INTO request_status_history
          (request_id, changed_by_id, previous_status, new_status, comment)
        VALUES (?, ?, ?, ?, ?)
      `, [req.params.id, req.session.userId, current.status, status, comment || null]);
    }

    await query(`
      INSERT INTO audit_logs (actor_id, action, entity, entity_id, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [
      req.session.userId,
      'update_request',
      'project_request',
      req.params.id,
      JSON.stringify({ status, priority, assigned_to_id }),
    ]);
  });
  res.json({ ok: true });
}));

router.get('/clients', asyncHandler(async (req, res) => {
  const params = [];
  let sql = `
    SELECT c.*,
      (SELECT COUNT(*) FROM project_requests r WHERE r.client_id = c.id) AS requests_count
    FROM clients c
  `;
  if (req.query.q) {
    sql += ' WHERE c.full_name ILIKE ? OR c.phone ILIKE ? OR c.email ILIKE ?';
    params.push(`%${req.query.q}%`, `%${req.query.q}%`, `%${req.query.q}%`);
  }
  sql += ' ORDER BY c.created_at DESC LIMIT 200';
  const { rows } = await db.query(sql, params);
  res.json(rows);
}));

router.get('/audit', requireRole('superadmin', 'ceo'), asyncHandler(async (req, res) => {
  const { rows } = await db.query(`
    SELECT a.*, u.full_name AS actor_name
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_id
    ORDER BY a.created_at DESC LIMIT 500
  `);
  res.json(rows);
}));

router.get('/users', requireRole('superadmin'), asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT id, email, full_name, role, is_active, last_login FROM users',
  );
  res.json(rows);
}));

router.get('/settings', asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT key, value FROM settings');
  res.json(Object.fromEntries(rows.map((row) => [row.key, row.value])));
}));

router.patch('/settings', requireRole('superadmin'), asyncHandler(async (req, res) => {
  await db.transaction(async (query) => {
    for (const [key, value] of Object.entries(req.body || {})) {
      await query(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `, [key, String(value)]);
    }
    await query('INSERT INTO audit_logs (actor_id, action, entity) VALUES (?, ?, ?)', [
      req.session.userId,
      'update_settings',
      'settings',
    ]);
  });
  res.json({ ok: true });
}));

module.exports = router;
