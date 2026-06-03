import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(request, { params }) {
  try {
    const session = request.cookies.get('bezar_admin_session');
    if (!session || !session.value || !(await verifyAdminToken(session.value))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { status } = await request.json();

    if (!['PENDING', 'PUBLISHED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await query('UPDATE movies SET status = $1 WHERE id = $2', [status, id]);
    
    return NextResponse.json({ success: true, message: 'Status updated' });
  } catch (error) {
    console.error('Failed to update movie status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = request.cookies.get('bezar_admin_session');
    if (!session || !session.value || !(await verifyAdminToken(session.value))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    await query('DELETE FROM movies WHERE id = $1', [id]);
    
    return NextResponse.json({ success: true, message: 'Movie deleted' });
  } catch (error) {
    console.error('Failed to delete movie:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
