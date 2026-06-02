import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

// Keys an admin is allowed to change, with validation bounds.
const EDITABLE = {
  MIN_HOLD_USD: { min: 1, max: 100000 },
  MAX_INR_TRANSACTION: { min: 1, max: 100000000 },
};

export async function GET() {
  try {
    const settingsRes = await query(`SELECT key, value FROM system_settings`);
    const settings = {};
    settingsRes.rows.forEach((row) => {
      settings[row.key] = row.value;
    });

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('[Settings GET Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/settings — admin only. Upserts a single allowlisted numeric setting.
 * Body: { key, value }
 */
export async function POST(request) {
  try {
    const session = request.cookies.get('bezar_admin_session');
    const payload = session ? await verifyAdminToken(session.value) : null;
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { key, value } = await request.json();
    const rule = EDITABLE[key];
    if (!rule) {
      return NextResponse.json({ error: 'Unknown or non-editable setting.' }, { status: 400 });
    }

    const num = Number(value);
    if (!Number.isFinite(num) || num < rule.min || num > rule.max) {
      return NextResponse.json({ error: `Value must be a number between ${rule.min} and ${rule.max}.` }, { status: 400 });
    }

    await query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [key, String(num)]
    );

    return NextResponse.json({ success: true, key, value: String(num) });
  } catch (error) {
    console.error('[Settings POST Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
