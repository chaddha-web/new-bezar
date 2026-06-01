import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    const { userId, movieId, watchedSeconds, lastPositionSeconds } = await request.json();

    if (!userId || !movieId) {
      return NextResponse.json({ error: 'Missing userId or movieId' }, { status: 400 });
    }

    // High performance UPSERT (insert or update on collision)
    await query(
      `INSERT INTO watch_history (user_id, movie_id, watched_seconds, last_position_seconds, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, movie_id) 
       DO UPDATE SET 
         watched_seconds = watch_history.watched_seconds + EXCLUDED.watched_seconds,
         last_position_seconds = EXCLUDED.last_position_seconds,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, movieId, watchedSeconds || 10, lastPositionSeconds || 0]
    );

    return NextResponse.json({ success: true, message: 'Watch time updated successfully' });
  } catch (error) {
    console.error('Watch history update failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
