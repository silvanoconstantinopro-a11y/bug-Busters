require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const db = require('./db');

const tables = [
  ['users', ['id', 'email', 'password_hash', 'full_name', 'role', 'is_active', 'last_login', 'created_at']],
  ['clients', ['id', 'full_name', 'email', 'country_code', 'phone', 'country', 'city', 'organization', 'created_at', 'updated_at']],
  ['services', ['id', 'name', 'slug', 'description', 'icon', 'is_active', 'sort_order']],
  ['portfolio_projects', ['id', 'title', 'slug', 'summary', 'description', 'technologies', 'cover_image', 'demo_url', 'repository_url', 'is_published', 'created_at']],
  ['team_members', ['id', 'name', 'role', 'biography', 'photo_url', 'linkedin_url', 'sort_order', 'is_published']],
  ['project_requests', ['id', 'reference', 'confirmation_token', 'client_id', 'title', 'objective', 'description', 'project_type', 'client_category', 'industry', 'budget_range', 'desired_deadline', 'current_stage', 'status', 'priority', 'assigned_to_id', 'privacy_consent', 'created_at', 'updated_at']],
  ['request_status_history', ['id', 'request_id', 'changed_by_id', 'previous_status', 'new_status', 'comment', 'created_at']],
  ['audit_logs', ['id', 'actor_id', 'action', 'entity', 'entity_id', 'metadata', 'created_at']],
  ['settings', ['key', 'value']],
];

const booleanColumns = new Set([
  'users.is_active',
  'services.is_active',
  'portfolio_projects.is_published',
  'team_members.is_published',
  'project_requests.privacy_consent',
]);

async function migrate() {
  const sourcePath = process.argv[2] || path.join(__dirname, 'bugbusters.db');
  const source = new Database(sourcePath, { readonly: true, fileMustExist: true });

  try {
    await db.initDatabase();
    const targetCounts = await Promise.all(tables.map(([table]) =>
      db.query(`SELECT COUNT(*) AS count FROM ${table}`)));
    const occupied = tables
      .map(([table], index) => `${table}: ${targetCounts[index].rows[0].count}`)
      .filter((entry) => !entry.endsWith(': 0'));
    if (occupied.length) {
      throw new Error(
        `A base de dados PostgreSQL não está vazia (${occupied.join(', ')}). ` +
        'Migre para uma base Neon vazia para evitar misturar ou substituir dados.',
      );
    }

    const sourceTables = new Set(
      source.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name),
    );
    const rowsByTable = tables.map(([table, columns]) => {
      if (!sourceTables.has(table)) throw new Error(`A tabela SQLite ${table} não existe.`);
      return [table, columns, source.prepare(`SELECT ${columns.join(', ')} FROM ${table}`).all()];
    });

    const client = await db.getPool().connect();
    try {
      await client.query('BEGIN');
      for (const [table, columns, rows] of rowsByTable) {
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
        for (const row of rows) {
          const values = columns.map((column) => {
            const value = row[column];
            return booleanColumns.has(`${table}.${column}`) && value !== null
              ? Boolean(value)
              : value;
          });
          await client.query(
            `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
            values,
          );
        }
        console.log(`Migrada ${table}: ${rows.length} registos`);
      }

      await client.query(`
        INSERT INTO project_request_sequences (year, last_value)
        SELECT SUBSTRING(reference FROM 4 FOR 4)::INTEGER,
               MAX(SUBSTRING(reference FROM 9)::INTEGER)
        FROM project_requests
        WHERE reference ~ '^BB-[0-9]{4}-[0-9]+$'
        GROUP BY SUBSTRING(reference FROM 4 FOR 4)
        ON CONFLICT (year) DO UPDATE
          SET last_value = GREATEST(
            project_request_sequences.last_value,
            EXCLUDED.last_value
          )
      `);

      for (const [table] of tables.filter(([, columns]) => columns.includes('id'))) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence($1, 'id'),
            COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${table}`,
          [table],
        );
      }
      await client.query('COMMIT');
      console.log('Migração concluída. Pode executar npm run seed.');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    source.close();
  }
}

migrate().catch((error) => {
  console.error('Erro na migração:', error.message);
  process.exitCode = 1;
}).finally(() => db.closePool());
