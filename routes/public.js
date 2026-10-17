const express = require('express');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const db = require('../database/db');
const asyncHandler = require('../middleware/async-handler');
const PostgresRateLimitStore = require('../middleware/postgres-rate-limit-store');

const router = express.Router();

router.get('/services', asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM services WHERE is_active = TRUE ORDER BY sort_order');
  res.json(rows);
}));

router.get('/team', asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM team_members WHERE is_published = TRUE ORDER BY sort_order');
  res.json(rows);
}));

router.get('/portfolio', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM portfolio_projects WHERE is_published = TRUE ORDER BY created_at DESC',
  );
  res.json(rows);
}));

router.get('/portfolio/:slug', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT * FROM portfolio_projects WHERE slug = ? AND is_published = TRUE',
    [req.params.slug],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Projecto não encontrado.' });
  res.json(rows[0]);
}));

router.get('/settings', asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT key, value FROM settings');
  res.json(Object.fromEntries(rows.map((row) => [row.key, row.value])));
}));

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas submissões. Tente novamente mais tarde.' },
  store: new PostgresRateLimitStore('request'),
});

router.post('/requests', submitLimiter, asyncHandler(async (req, res) => {
  const { client = {}, project = {}, privacy_consent } = req.body || {};
  const errors = [];
  if (!client.full_name || client.full_name.trim().length < 3) errors.push('Nome completo inválido.');
  if (!client.phone || client.phone.trim().length < 6) errors.push('Telefone inválido.');
  if (!client.country) errors.push('País obrigatório.');
  if (!project.title || project.title.trim().length < 3) errors.push('Tema do projecto obrigatório.');
  if (!project.objective || project.objective.trim().length < 10) errors.push('Objectivo obrigatório.');
  if (!project.description || project.description.trim().length < 20) errors.push('Descrição obrigatória.');
  if (!['web', 'mobile', 'web_mobile', 'other'].includes(project.project_type)) errors.push('Tipo de projecto inválido.');
  if (!['company', 'personal', 'academic', 'institutional', 'other'].includes(project.client_category)) errors.push('Categoria inválida.');
  if (!privacy_consent) errors.push('É necessário aceitar a política de privacidade.');
  if (errors.length) return res.status(400).json({ error: errors.join(' ') });

  const confirmationToken = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
  const year = new Date().getFullYear();

  try {
    const reference = await db.transaction(async (query) => {
      const sequence = await query(
        `INSERT INTO project_request_sequences (year, last_value)
         SELECT ?, COALESCE(MAX(SUBSTRING(reference FROM 9)::INTEGER), 0) + 1
         FROM project_requests WHERE reference LIKE ?
         ON CONFLICT (year) DO UPDATE
           SET last_value = project_request_sequences.last_value + 1
         RETURNING last_value`,
        [year, `BB-${year}-%`],
      );
      const projectReference = `BB-${year}-${String(sequence.rows[0].last_value).padStart(4, '0')}`;
      const normalizedPhone = String(client.phone).replace(/[^\d+]/g, '');

      const insertedClient = await query(
        `INSERT INTO clients (full_name, email, country_code, phone, country, city, organization)
         VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          client.full_name.trim(),
          client.email ? client.email.trim() : null,
          client.country_code || '+244',
          normalizedPhone,
          client.country,
          client.city || null,
          client.organization || null,
        ],
      );

      const insertedRequest = await query(
        `INSERT INTO project_requests
         (reference, confirmation_token, client_id, title, objective, description,
          project_type, client_category, industry, budget_range, desired_deadline,
          current_stage, status, priority, privacy_consent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
        [
          projectReference,
          confirmationToken,
          insertedClient.rows[0].id,
          project.title.trim(),
          project.objective.trim(),
          project.description.trim(),
          project.project_type,
          project.client_category,
          project.industry || null,
          project.budget_range || null,
          project.desired_deadline || null,
          project.current_stage || null,
          'new',
          'normal',
          true,
        ],
      );

      await query(
        `INSERT INTO request_status_history (request_id, previous_status, new_status, comment)
         VALUES (?, ?, ?, ?)`,
        [insertedRequest.rows[0].id, null, 'new', 'Solicitação recebida pelo website.'],
      );
      return projectReference;
    });

    res.status(201).json({
      reference,
      status: 'new',
      message: 'A sua solicitação foi recebida.',
      confirmation_token: confirmationToken,
    });
  } catch (error) {
    console.error('Erro ao gravar solicitação:', error);
    res.status(500).json({ error: 'Erro ao processar a solicitação. Tente novamente.' });
  }
}));

router.get('/requests/confirmation/:token', asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    'SELECT reference, status, created_at FROM project_requests WHERE confirmation_token = ?',
    [req.params.token],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Referência não encontrada.' });
  res.json(rows[0]);
}));

module.exports = router;
