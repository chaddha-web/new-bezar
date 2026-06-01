import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(
      'SELECT id, title, genre, year, badge, thumbnail, video_src as "videoSrc", description, is_featured as "featured" FROM movies ORDER BY is_featured DESC, created_at DESC'
    );
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch movies from PostgreSQL, returning fallback seeds:', error);
    // Fallback seed array to prevent crashes if DB isn't running yet
    return NextResponse.json([
      {
        id: "welcome-to-the-jungle",
        title: "Welcome To The Jungle",
        genre: "Action · Comedy",
        year: "2026",
        badge: "Coming Soon",
        thumbnail: "/thumbnails/welcome-to-the-jungle.jpg",
        videoSrc: "https://d2h58dsjpbzmve.cloudfront.net/50kjr%2Ffile%2F130200cb7ba80242a26d4c6e40d01842_1d5150b877ce5fa4fd0f73b36e1ee5d3.mp4",
        featured: true,
        description: "The wildest adventure of the year — arriving June 26, 2026."
      }
    ]);
  }
}

export async function POST(request) {
  try {
    const { title, genre, year, badge, thumbnail, videoSrc, description } = await request.json();

    if (!title || !genre || !year) {
      return NextResponse.json({ error: 'Missing required metadata field(s)' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO movies (title, genre, year, badge, thumbnail, video_src, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, title, genre, year, badge`,
      [title, genre, year, badge || 'Coming Soon', thumbnail, videoSrc, description]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Movie published successfully in PostgreSQL', 
      movie: result.rows[0] 
    });
  } catch (error) {
    console.error('Failed to create movie in PostgreSQL:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
