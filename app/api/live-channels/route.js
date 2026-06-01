import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const result = await query(
      'SELECT id, title, genre, logo, video_src as "videoSrc", description, badge FROM live_channels ORDER BY created_at ASC'
    );
    // If table is empty, seed live channels manually inside the API
    if (result.rows.length === 0) {
      throw new Error("No live channels in database");
    }
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch live channels, using fallback live news seeds:', error);
    // Fallback seed array
    return NextResponse.json([
      {
        id: "india-daily-live",
        title: "India Daily Live",
        genre: "Hindi News",
        badge: "LIVE",
        logo: "https://jiotvimages.cdn.jio.com/dare_images/images/India_Daily_24x7.png",
        videoSrc: "https://indiadaily.ottlive.co.in/indiadailylive/index.m3u8",
        description: "Breaking news, headlines, and live coverage 24/7."
      },
      {
        id: "aaj-tak",
        title: "Aaj Tak HD",
        genre: "Hindi News",
        badge: "LIVE",
        logo: "https://jiotvimages.cdn.jio.com/dare_images/images/Aaj_Tak.png",
        videoSrc: "https://feeds.intoday.in/aajtak/api/aajtakhd/master.m3u8",
        description: "India's #1 Hindi news channel — live, 24/7."
      }
    ]);
  }
}
