import { Pool } from 'pg';

// Initialize a connection pool. 
// Uses DATABASE_URL connection string from environment variables.
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@db:5432/bezar';

const pool = new Pool({
  connectionString,
  max: 15, // Maximum number of active connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Timeout return error if connection takes > 2s
});

export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('[DB Query] Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (err) {
    console.error('[DB Query Error]', err);
    throw err;
  }
};

export default pool;
