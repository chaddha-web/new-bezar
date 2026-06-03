import { NextResponse } from 'next/server';
import { verifyUserToken, verifyAdminToken } from '@/lib/auth';

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // 1. Admin Paths Protection
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const token = request.cookies.get('bezar_admin_session')?.value;
    const payload = token ? await verifyAdminToken(token) : null;
    
    if (!payload) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }

  // 2. Admin API Protection (defense-in-depth)
  if (
    pathname.startsWith('/api/admin') && 
    !pathname.startsWith('/api/admin/auth')
  ) {
    const token = request.cookies.get('bezar_admin_session')?.value;
    const payload = token ? await verifyAdminToken(token) : null;
    
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized admin access' }, { status: 401 });
    }
  }

  // Admin POST restriction for movies
  if (pathname === '/api/movies' && request.method === 'POST') {
    const token = request.cookies.get('bezar_admin_session')?.value;
    const payload = token ? await verifyAdminToken(token) : null;
    
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized to post movies' }, { status: 401 });
    }
  }

  // 3. User API Protection
  const protectedUserApiRoutes = [
    '/api/wallet/withdraw',
    '/api/checkout/purchase',
    '/api/affiliate/',
    '/api/web3/deposit',
    '/api/watch-time'
  ];

  if (protectedUserApiRoutes.some(route => pathname.startsWith(route))) {
    const token = request.cookies.get('bezar_user_session')?.value;
    const payload = token ? await verifyUserToken(token) : null;

    if (!payload) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/movies',
    '/api/wallet/:path*',
    '/api/checkout/:path*',
    '/api/affiliate/:path*',
    '/api/web3/:path*',
    '/api/watch-time/:path*'
  ]
};
