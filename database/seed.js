require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcryptjs');

const services = [
  ['Desenvolvimento Web', 'desenvolvimento-web', 'Websites e plataformas web modernas, responsivas e seguras.', '🌐', 1],
  ['Aplicações Mobile', 'apps-mobile', 'Aplicações Android e iOS com Flutter e tecnologias nativas.', '📱', 2],
  ['Sistemas Empresariais', 'sistemas-empresariais', 'ERPs, CRMs e plataformas de gestão à medida.', '🏢', 3],
  ['Sistemas Inteligentes', 'sistemas-inteligentes', 'Automação, IA e integração de APIs para decisões inteligentes.', '🤖', 4],
  ['Bases de Dados', 'bases-de-dados', 'Modelação, optimização e administração de dados.', '🗄️', 5],
  ['Automação & Integrações', 'automacao-integracoes', 'Integração de serviços, webhooks e fluxos automáticos.', '⚙️', 6],
];

const team = [
  {
    name: 'Silano Constantino',
    role: 'CEO — Director Executivo',
    biography: 'Responsável pela liderança da empresa, estratégia, decisões empresariais, parcerias e crescimento do negócio.',
    photo_url: '/img/foto1.jpg',
    linkedin_url: null,
    sort_order: 1,
  },
  {
    name: 'Adelino Firmino',
    role: 'Co-fundador e Director de Operações',
    biography: 'Responsável pela coordenação operacional, acompanhamento dos clientes, organização dos processos e apoio à gestão dos projectos.',
    photo_url: '/img/foto2.jpg',
    linkedin_url: null,
    sort_order: 2,
  },
  {
    name: 'Silvano Siliwa Sapalo Constantino',
    role: 'Lead Developer & Project Architect',
    biography: 'Responsável pelo planeamento técnico, levantamento de requisitos, arquitectura, desenvolvimento e implementação dos projectos.',
    photo_url: '/img/foto3.jpg',
    linkedin_url: process.env.COMPANY_LINKEDIN || 'https://linkedin.com/in/silvano',
    sort_order: 3,
  },
];

const portfolio = [
  {
    title: 'Sistema de Gestão Escolar',
    slug: 'gestao-escolar',
    summary: 'Plataforma para gestão de alunos, notas e pagamentos.',
    description: 'Sistema completo para instituições de ensino com módulos de matrícula, avaliação e financeiro.',
    technologies: 'Next.js, Django, PostgreSQL',
  },
  {
    title: 'App de Delivery',
    slug: 'app-delivery',
    summary: 'Aplicação mobile para pedidos e entregas.',
    description: 'App Flutter com rastreamento em tempo real, pagamentos e painel administrativo.',
    technologies: 'Flutter, Node.js, MySQL',
  },
];

async function seed() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
    throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo de 12 caracteres) antes de executar o seed.');
  }

  await db.initDatabase();
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await db.transaction(async (query) => {
    await query(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (email) DO NOTHING
    `, [process.env.ADMIN_EMAIL, passwordHash, 'Administrador Bug Busters', 'superadmin']);

    for (const service of services) {
      await query(`
        INSERT INTO services (name, slug, description, icon, sort_order)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (slug) DO NOTHING
      `, service);
    }

    for (const member of team) {
      const existing = await query('SELECT id FROM team_members WHERE name = ?', [member.name]);
      if (existing.rows[0]) {
        await query(`
          UPDATE team_members
          SET role = ?, biography = ?, photo_url = ?, linkedin_url = ?, sort_order = ?
          WHERE id = ?
        `, [
          member.role,
          member.biography,
          member.photo_url,
          member.linkedin_url,
          member.sort_order,
          existing.rows[0].id,
        ]);
      } else {
        await query(`
          INSERT INTO team_members
            (name, role, biography, photo_url, linkedin_url, sort_order, is_published)
          VALUES (?, ?, ?, ?, ?, ?, TRUE)
        `, [
          member.name,
          member.role,
          member.biography,
          member.photo_url,
          member.linkedin_url,
          member.sort_order,
        ]);
      }
    }

    for (const project of portfolio) {
      await query(`
        INSERT INTO portfolio_projects
          (title, slug, summary, description, technologies, is_published)
        VALUES (?, ?, ?, ?, ?, TRUE)
        ON CONFLICT (slug) DO NOTHING
      `, [
        project.title,
        project.slug,
        project.summary,
        project.description,
        project.technologies,
      ]);
    }

    const settings = [
      ['company_name', 'Bug Busters'],
      ['company_slogan', 'Transformamos ideias em soluções inteligentes.'],
      ['company_whatsapp', process.env.COMPANY_WHATSAPP || '+244900000000'],
      ['company_linkedin', process.env.COMPANY_LINKEDIN || ''],
      ['company_email', process.env.COMPANY_EMAIL || 'contacto@bugbusters.ao'],
    ];
    for (const [key, value] of settings) {
      await query(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `, [key, value]);
    }
  });

  const [users, seededServices, seededTeam, seededPortfolio] = await Promise.all([
    db.query('SELECT COUNT(*) AS count FROM users'),
    db.query('SELECT COUNT(*) AS count FROM services'),
    db.query('SELECT COUNT(*) AS count FROM team_members'),
    db.query('SELECT COUNT(*) AS count FROM portfolio_projects'),
  ]);
  console.table({
    users: Number(users.rows[0].count),
    services: Number(seededServices.rows[0].count),
    team: Number(seededTeam.rows[0].count),
    portfolio: Number(seededPortfolio.rows[0].count),
  });
}

if (require.main === module) {
  seed().catch((error) => {
    console.error('Erro no seed:', error.message);
    process.exitCode = 1;
  }).finally(() => db.closePool());
}

module.exports = seed;
