const db = require('../database/db');

class PostgresRateLimitStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.windowMs = 60000;
    this.requests = 0;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    await db.initDatabase();
    const { rows } = await db.query(`
      INSERT INTO rate_limit_hits AS stored (key, hits, reset_at)
      VALUES (?, 1, NOW() + (?::DOUBLE PRECISION * INTERVAL '1 millisecond'))
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN stored.reset_at <= NOW() THEN 1 ELSE stored.hits + 1 END,
        reset_at = CASE
          WHEN stored.reset_at <= NOW()
            THEN NOW() + (?::DOUBLE PRECISION * INTERVAL '1 millisecond')
          ELSE stored.reset_at
        END
      RETURNING hits, reset_at
    `, [`${this.prefix}:${key}`, this.windowMs, this.windowMs]);

    this.requests += 1;
    if (this.requests >= 100) {
      this.requests = 0;
      await db.query('DELETE FROM rate_limit_hits WHERE reset_at <= NOW()');
    }

    return {
      totalHits: Number(rows[0].hits),
      resetTime: new Date(rows[0].reset_at),
    };
  }

  async decrement(key) {
    await db.query(
      'UPDATE rate_limit_hits SET hits = GREATEST(hits - 1, 0) WHERE key = ?',
      [`${this.prefix}:${key}`],
    );
  }

  async resetKey(key) {
    await db.query('DELETE FROM rate_limit_hits WHERE key = ?', [`${this.prefix}:${key}`]);
  }
}

module.exports = PostgresRateLimitStore;
