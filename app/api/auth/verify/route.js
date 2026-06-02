import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { signUserToken } from '@/lib/auth';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const remember = searchParams.get('remember') === 'true';

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=MissingToken', request.url));
  }

  try {
    const tokenRes = await query(
      'SELECT email FROM auth_tokens WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
      [token]
    );

    if (tokenRes.rows.length === 0) {
      return NextResponse.redirect(new URL('/login?error=InvalidOrExpiredToken', request.url));
    }

    const { email } = tokenRes.rows[0];
    await query('DELETE FROM auth_tokens WHERE token = $1', [token]);

    // The account must already exist (created at signup with a password).
    const userRes = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return NextResponse.redirect(new URL('/signup?error=NoAccount', request.url));
    }
    const userId = userRes.rows[0].id;

    // Clicking the link proves email ownership → mark verified and sign in.
    await query('UPDATE users SET email_verified = TRUE WHERE id = $1', [userId]);

    const jwt = await signUserToken(userId, email);
    const response = NextResponse.redirect(new URL('/?verified=1', request.url));
    response.cookies.set('bezar_user_session', jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: remember ? 60 * 60 * 24 * 7 : 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.redirect(new URL('/login?error=ServerError', request.url));
  }
}
