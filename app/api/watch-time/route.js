import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyUserToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const session = request.cookies.get('bezar_user_session');
    const payload = session ? await verifyUserToken(session.value) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = payload.userId;

    const { movieId, watchedSeconds, lastPositionSeconds } = await request.json();

    if (!movieId) {
      return NextResponse.json({ error: 'Missing movieId' }, { status: 400 });
    }

    const secondsToAdd = Number(watchedSeconds) || 10;
    
    // Anti-spam guard: limit max increment per request
    if (secondsToAdd > 60 || secondsToAdd < 0) {
      return NextResponse.json({ error: 'Invalid watch time increment' }, { status: 400 });
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
      [userId, movieId, secondsToAdd, lastPositionSeconds || 0]
    );

    // TELEMETRY BRIDGE: Log Daily Engagement Yield status
    // If the user watches > 10 minutes of video (600 seconds) in a single session, OR just tracks video activity
    await query(
      `INSERT INTO daily_engagement (user_id, date, video_completed)
       VALUES ($1, CURRENT_DATE, TRUE)
       ON CONFLICT (user_id, date)
       DO UPDATE SET video_completed = TRUE`,
      [userId]
    );

    return NextResponse.json({ success: true, message: 'Watch time updated successfully' });
  } catch (error) {
    console.error('Watch history update failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
