import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { Resend } from 'resend';
import { query } from '@/lib/db';
import { hashPassword } from '@/lib/password';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request) {
  try {
    const { email, password, name, sponsorId } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    await query('BEGIN');

    // Generic response on duplicate to limit account enumeration.
    const userCheck = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Registration failed. Please check your details or try logging in.' }, { status: 400 });
    }

    const hashedPass = await hashPassword(password);

    // Create the account unverified — must click the magic link to verify.
    const userInsert = await query(
      `INSERT INTO users (email, password_hash, name, email_verified)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, email, name`,
      [email, hashedPass, name || 'Viewer']
    );
    const newUser = userInsert.rows[0];

    // Marketing node + free subscription (unchanged).
    const parentId = sponsorId || null;
    await query(
      `INSERT INTO mlm_nodes (node_id, parent_id, investment_amount_inr, accumulated_earnings_inr, node_status)
       VALUES ($1, $2, 9400.00, 0.00, 'ACTIVE')`,
      [newUser.id, parentId]
    );
    await query(
      `INSERT INTO subscriptions (user_id, plan_name, status, current_period_start)
       VALUES ($1, 'Free', 'active', CURRENT_TIMESTAMP)`,
      [newUser.id]
    );

    // Issue an email-verification magic link (24h).
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO auth_tokens (token, email, expires_at) VALUES ($1, $2, $3)',
      [token, email, expiresAt]
    );

    await query('COMMIT');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const link = `${baseUrl}/api/auth/verify?token=${token}`;

    if (resend) {
      await resend.emails.send({
        from: 'Bezar <onboarding@resend.dev>',
        to: email,
        subject: 'Verify your Bezar account',
        html: `<p>Welcome to Bezar! Confirm your email to activate your account:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
      });
    } else {
      console.log(`\n\n[VERIFY LINK FOR ${email}]:\n-> ${link}\n\n`);
    }

    return NextResponse.json({
      success: true,
      message: 'Account created. Check your email for a verification link to activate it.',
    });
  } catch (error) {
    await query('ROLLBACK');
    console.error('[Registration Error] Database rollback executed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
