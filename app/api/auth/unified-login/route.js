import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { signUserToken, signAdminToken, signCmsToken } from '@/lib/auth';
import { comparePassword } from '@/lib/password';
import bcrypt from 'bcrypt';

export async function POST(request) {
  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Identifier and password are required' }, { status: 400 });
    }

    // 1. Admin Check
    const targetAdminUser = process.env.ADMIN_USERNAME || 'admin';
    const targetAdminPass = process.env.ADMIN_PASSWORD;

    if (identifier === targetAdminUser && password === targetAdminPass) {
      const response = NextResponse.json({ success: true, role: 'admin', message: 'Logged in as Admin' });
      const token = await signAdminToken();
      response.cookies.set('bezar_admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
      });
      return response;
    }

    // 2. CMS Staff Check
    const cmsRes = await query('SELECT * FROM cms_users WHERE username = $1', [identifier]);
    if (cmsRes.rows.length > 0) {
      const cmsUser = cmsRes.rows[0];
      const cmsMatch = await bcrypt.compare(password, cmsUser.password_hash);
      
      if (cmsMatch) {
        const response = NextResponse.json({ success: true, role: 'cms', message: 'Logged in as CMS Staff' });
        const token = await signCmsToken(cmsUser.username);
        response.cookies.set('bezar_cms_session', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24, // 1 day
          path: '/',
        });
        return response;
      }
    }

    // 3. Standard User Check
    const userRes = await query(
      'SELECT id, email, name, password_hash, email_verified FROM users WHERE email = $1',
      [identifier]
    );

    if (userRes.rows.length > 0) {
      const user = userRes.rows[0];
      const isValid = await comparePassword(password, user.password_hash);
      
      if (isValid) {
        if (!user.email_verified) {
          return NextResponse.json(
            { error: 'Please verify your email first — check your inbox for the verification link.', needsVerification: true },
            { status: 403 }
          );
        }

        const response = NextResponse.json({
          success: true,
          role: 'user',
          message: 'Logged in successfully',
          user: { id: user.id, email: user.email, name: user.name }
        });

        const token = await signUserToken(user.id, user.email);
        response.cookies.set('bezar_user_session', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 24 * 7, // 1 week
          path: '/',
        });
        return response;
      }
    }

    // No matches found
    return NextResponse.json({ error: 'Invalid username/email or password' }, { status: 401 });

  } catch (error) {
    console.error('[Unified Login API Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
