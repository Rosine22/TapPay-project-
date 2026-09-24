const pg = require('pg');
const { Pool } = pg;
const env = require('./env');

// By default node-postgres returns BIGINT as a string to avoid precision loss.
// Every BIGINT here is an id or a whole number of RWF, far below
// Number.MAX_SAFE_INTEGER, so parsing them as numbers keeps comparisons honest.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => parseInt(value, 10));

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error', err);
});

// Every query in the app goes through here with parameterised values ($1, $2...).
// No SQL string is ever built by concatenating user input.
function query(text, params) {
  return pool.query(text, params);
}

// Runs fn inside BEGIN / COMMIT, rolling back on any thrown error.
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
