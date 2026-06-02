import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';

/**
 * GET /api/affiliate/watch-history
 * Returns the session user's viewing history, joined with movie metadata.
 */
export async function GET(request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await query(
      `SELECT w.movie_id, w.watched_seconds, w.last_position_seconds, w.updated_at,
              m.title, m.genre, m.thumbnail
       FROM watch_history w
       LEFT JOIN movies m ON m.id = w.movie_id
       WHERE w.user_id = $1
       ORDER BY w.updated_at DESC
       LIMIT 100`,
      [userId]
    );

    const history = res.rows.map((r) => ({
      movieId: r.movie_id,
      title: r.title || 'Untitled',
      genre: r.genre || '',
      thumbnail: r.thumbnail || null,
      watchedSeconds: Number(r.watched_seconds || 0),
      lastPositionSeconds: Number(r.last_position_seconds || 0),
      updatedAt: r.updated_at,
    }));

    return NextResponse.json({ history });
  } catch (error) {
    console.error('[Watch History Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
