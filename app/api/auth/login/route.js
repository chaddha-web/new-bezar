import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { signUserToken } from '@/lib/auth';
import { comparePassword } from '@/lib/password';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Lookup user credentials
    const userRes = await query(
      'SELECT id, email, name, password_hash, email_verified FROM users WHERE email = $1',
      [email]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const user = userRes.rows[0];

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.email_verified) {
      return NextResponse.json(
        { error: 'Please verify your email first — check your inbox for the verification link.', needsVerification: true },
        { status: 403 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
      user: { id: user.id, email: user.email, name: user.name }
    });

    // Set secure JWT cookie
    const token = await signUserToken(user.id, user.email);
    response.cookies.set('bezar_user_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('[Login API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
