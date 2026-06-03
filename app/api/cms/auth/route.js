import { NextResponse } from 'next/server';
import { signCmsToken, verifyCmsToken } from '@/lib/auth';
import { query } from '@/lib/db';
import bcrypt from 'bcrypt';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const result = await query('SELECT * FROM cms_users WHERE username = $1', [username]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);

    if (match) {
      const response = NextResponse.json({ success: true, message: 'Logged in successfully' });
      
      const token = await signCmsToken(user.username);
      
      response.cookies.set('bezar_cms_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
      });

      return response;
    }

    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('CMS Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request) {
  const session = request.cookies.get('bezar_cms_session');
  if (session && session.value) {
    const payload = await verifyCmsToken(session.value);
    if (payload) {
      return NextResponse.json({ authenticated: true, username: payload.username });
    }
  }
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function DELETE(request) {
  const response = NextResponse.json({ success: true, message: 'Logged out' });
  response.cookies.set('bezar_cms_session', '', { maxAge: 0, path: '/' });
  return response;
}
