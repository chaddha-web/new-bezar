import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';

export const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export async function GET(request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = (request.nextUrl.searchParams.get('username') || '').trim();

    if (!USERNAME_RE.test(username)) {
      return NextResponse.json({
        valid: false,
        available: false,
        reason: '3–20 characters, letters, numbers, and underscores only.',
      });
    }

    // Available if no other node owns this handle (case-insensitive).
    const res = await query(
      `SELECT node_id FROM mlm_nodes
       WHERE LOWER(username) = LOWER($1) AND node_id <> $2
       LIMIT 1`,
      [username, userId]
    );

    const available = res.rows.length === 0;
    return NextResponse.json({
      valid: true,
      available,
      reason: available ? 'Available' : 'That username is already taken.',
    });
  } catch (error) {
    console.error('[Username Check Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
