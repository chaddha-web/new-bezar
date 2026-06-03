import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyUserToken } from '@/lib/auth';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function GET(request, { params }) {
  try {
    const sessionCookie = request.cookies.get('bezar_user_session');
    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifyUserToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: ticketId } = await params;

    // Verify ownership
    const ticketRes = await query(
      `SELECT id, subject, status, created_at, updated_at FROM support_tickets WHERE id = $1 AND user_id = $2`,
      [ticketId, payload.userId]
    );

    if (ticketRes.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    const msgRes = await query(
      `SELECT id, sender_type, body, created_at FROM support_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
      [ticketId]
    );

    return NextResponse.json({ ticket: ticketRes.rows[0], messages: msgRes.rows });
  } catch (error) {
    console.error('[Support Ticket GET Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const sessionCookie = request.cookies.get('bezar_user_session');
    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifyUserToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: ticketId } = await params;
    const { message } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    // Verify ownership
    const ticketRes = await query(
      `SELECT id, subject, status, user_id FROM support_tickets WHERE id = $1 AND user_id = $2`,
      [ticketId, payload.userId]
    );

    if (ticketRes.rows.length === 0) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    await query('BEGIN');

    await query(
      `INSERT INTO support_messages (ticket_id, sender_type, body) VALUES ($1, 'USER', $2)`,
      [ticketId, message]
    );
    await query(`UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [ticketId]);

    await query('COMMIT');

    const userRes = await query(`SELECT email, name FROM users WHERE id = $1`, [payload.userId]);
    const userEmail = userRes.rows[0].email;
    const userName = userRes.rows[0].name;

    if (resend) {
      resend.emails.send({
        from: 'Bezar Support <support@bezar.in>',
        to: ['support@bezar.in'],
        subject: `Re: ${ticketRes.rows[0].subject} [Ticket #${ticketId}]`,
        text: `New reply from ${userName}:\n\n${message}`,
        reply_to: userEmail
      }).catch(err => console.error('Failed to notify support:', err));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    await query('ROLLBACK');
    console.error('[Support Ticket POST Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
