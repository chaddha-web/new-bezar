import { query } from './db';

/**
 * Read a numeric value from system_settings, falling back to `fallback`
 * if the key is missing, non-numeric, or the table is unavailable.
 */
export async function getNumericSetting(key, fallback) {
  try {
    const res = await query('SELECT value FROM system_settings WHERE key = $1', [key]);
    if (res.rows.length === 0) return fallback;
    const n = Number(res.rows[0].value);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}
