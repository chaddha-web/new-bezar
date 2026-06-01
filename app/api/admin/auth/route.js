import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    
    const targetUser = process.env.ADMIN_USERNAME || 'admin';
    const targetPass = process.env.ADMIN_PASSWORD || 'bezar_secure_admin_pass';

    if (username === targetUser && password === targetPass) {
      // Create session payload
      const response = NextResponse.json({ success: true, message: 'Logged in successfully' });
      
      // Set httpOnly secure cookie
      response.cookies.set('bezar_admin_session', 'authenticated_token_active', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 1 day
        path: '/',
      });

      return response;
    }

    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  } catch (error) {
    console.error('Authentication error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET handler to check auth status
export async function GET(request) {
  const session = request.cookies.get('bezar_admin_session');
  if (session && session.value === 'authenticated_token_active') {
    return NextResponse.json({ authenticated: true });
  }
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

// DELETE handler to logout
export async function DELETE(request) {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.set('bezar_admin_session', '', { maxAge: 0, path: '/' });
  return response;
}
