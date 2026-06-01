import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request) {
  try {
    const session = request.cookies.get('bezar_user_session');

    if (!session || !session.value) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const userId = session.value;

    // Resolve viewer details along with subscription plan
    const userRes = await query(
      `SELECT u.id, u.email, u.name, s.plan_name as plan 
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       WHERE u.id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const user = userRes.rows[0];

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan || 'Free'
      }
    });

  } catch (error) {
    console.error('[Session Check Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.set('bezar_user_session', '', { maxAge: 0, path: '/' });
  return response;
}
