import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    const { email, password, name, sponsorId } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    await query('BEGIN');

    // Check if user already exists
    const userCheck = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
    }

    // Insert user record (we store hashed/plain pass for now, standard password field)
    const userInsert = await query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name`,
      [email, password, name || 'Viewer']
    );

    const newUser = userInsert.rows[0];

    // Initialize MLM node connection for marketing features automatically (pack entry ₹9,400)
    const parentId = sponsorId || null;
    await query(
      `INSERT INTO mlm_nodes (node_id, parent_id, investment_amount_inr, accumulated_earnings_inr, node_status)
       VALUES ($1, $2, 9400.00, 0.00, 'ACTIVE')`,
      [newUser.id, parentId]
    );

    // Initialize free subscription tier
    await query(
      `INSERT INTO subscriptions (user_id, plan_name, status, current_period_start)
       VALUES ($1, 'Free', 'active', CURRENT_TIMESTAMP)`,
      [newUser.id]
    );

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Account successfully registered.',
      user: newUser
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('[Registration Error] Database rollback executed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
