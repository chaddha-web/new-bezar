import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAdminToken, verifyUserToken, verifyCmsToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    let isAuthorized = false;
    let isAdminOrCms = false;
    
    // Check Admin/CMS
    const adminSession = request.cookies.get('bezar_admin_session');
    if (adminSession && adminSession.value && await verifyAdminToken(adminSession.value)) {
      isAdminOrCms = true;
      isAuthorized = true;
    } else {
      const cmsSession = request.cookies.get('bezar_cms_session');
      if (cmsSession && cmsSession.value && await verifyCmsToken(cmsSession.value)) {
        isAdminOrCms = true;
        isAuthorized = true;
      }
    }
    
    // Check normal user subscription
    if (!isAuthorized) {
      const session = request.cookies.get('bezar_user_session');
      if (session && session.value) {
        const payload = await verifyUserToken(session.value);
        if (payload && payload.userId) {
          const authRes = await query(
            `SELECT 
              EXISTS(SELECT 1 FROM subscriptions WHERE user_id = $1 AND status = 'active') as has_sub,
              EXISTS(SELECT 1 FROM mlm_nodes WHERE node_id = $1 AND node_status = 'ACTIVE') as is_affiliate
            `,
            [payload.userId]
          );
          if (authRes.rows.length > 0 && (authRes.rows[0].has_sub || authRes.rows[0].is_affiliate)) {
            isAuthorized = true;
          }
        }
      }
    }

    let sql = 'SELECT * FROM movies';
    if (!isAdminOrCms) {
      sql += " WHERE status = 'PUBLISHED'";
    }
    sql += ' ORDER BY is_featured DESC, created_at DESC';

    const result = await query(sql);
    
    const movies = result.rows.map(m => ({
      ...m,
      videoSrc: isAuthorized ? m.video_src : null, // keep videoSrc camelCase for frontend
      trailerSrc: m.trailer_src,
      contentType: m.content_type
    }));

    return NextResponse.json(movies);
  } catch (error) {
    console.error('Failed to fetch movies:', error);
    return NextResponse.json([], { status: 200 }); // return empty array instead of dummy data on error to be safe
  }
}

export async function POST(request) {
  try {
    let hasAccess = false;
    const adminSession = request.cookies.get('bezar_admin_session');
    if (adminSession && adminSession.value && await verifyAdminToken(adminSession.value)) {
      hasAccess = true;
    } else {
      const cmsSession = request.cookies.get('bezar_cms_session');
      if (cmsSession && cmsSession.value && await verifyCmsToken(cmsSession.value)) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      title, genre, year, badge, thumbnail, videoSrc, description,
      contentType, trailerSrc, runtime, episodes, tags, ratings, credits
    } = await request.json();

    if (!title || !genre || !year) {
      return NextResponse.json({ error: 'Missing required metadata field(s)' }, { status: 400 });
    }

    // Admins could optionally publish immediately, but let's default to PENDING for safety
    const status = 'PENDING';

    const result = await query(
      `INSERT INTO movies (
        title, genre, year, badge, thumbnail, video_src, description, 
        content_type, trailer_src, runtime, episodes, tags, ratings, credits, status
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, title, status`,
      [
        title, genre, year, badge || 'Coming Soon', thumbnail, videoSrc, description,
        contentType || 'MOVIE', trailerSrc || null, runtime || 0, JSON.stringify(episodes || []),
        tags || null, ratings || null, credits || null, status
      ]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Content uploaded and pending review', 
      movie: result.rows[0] 
    });
  } catch (error) {
    console.error('Failed to create content in PostgreSQL:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
