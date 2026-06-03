import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  try {
    const session = request.cookies.get('bezar_admin_session');
    if (!session || !session.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyAdminToken(session.value);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = params;
    if (!id) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

    await query('DELETE FROM cms_users WHERE id = $1', [id]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete CMS user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
