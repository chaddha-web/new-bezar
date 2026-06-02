import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyUserToken } from '@/lib/auth';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function GET(request) {
  try {
    const sessionCookie = request.cookies.get('bezar_user_session');
    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifyUserToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ticketsRes = await query(
      `SELECT id, subject, status, created_at, updated_at
       FROM support_tickets
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [payload.userId]
    );

    return NextResponse.json({ tickets: ticketsRes.rows });
  } catch (error) {
    console.error('[Support GET Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const sessionCookie = request.cookies.get('bezar_user_session');
    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifyUserToken(sessionCookie.value);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subject, message } = await request.json();

    if (!subject || !message) {
      return NextResponse.json({ error: 'Subject and message are required.' }, { status: 400 });
    }

    await query('BEGIN');

    const ticketRes = await query(
      `INSERT INTO support_tickets (user_id, subject) VALUES ($1, $2) RETURNING id`,
      [payload.userId, subject]
    );
    const ticketId = ticketRes.rows[0].id;

    await query(
      `INSERT INTO support_messages (ticket_id, sender_type, body) VALUES ($1, 'USER', $2)`,
      [ticketId, message]
    );

    await query('COMMIT');

    const userRes = await query(`SELECT email, name FROM users WHERE id = $1`, [payload.userId]);
    const userEmail = userRes.rows[0].email;
    const userName = userRes.rows[0].name;

    // Fire outbound emails in background
    if (resend) {
      // 1. Notify Support Team
      resend.emails.send({
        from: 'Bezar Support <support@bezar.in>',
        to: ['support@bezar.in'],
        subject: `New Ticket: ${subject} [Ticket #${ticketId}]`,
        text: `New support ticket from ${userName} (${userEmail}):\n\n${message}`,
        reply_to: userEmail
      }).catch(err => console.error('Failed to notify support:', err));

      // 2. Auto-responder to User
      resend.emails.send({
        from: 'Bezar Support <support@bezar.in>',
        to: [userEmail],
        subject: `Re: ${subject} [Ticket #${ticketId}]`,
        text: `Hi ${userName},\n\nWe have received your support request and will get back to you shortly.\n\nYou can reply to this email to add more details.\n\nYour message:\n${message}`,
      }).catch(err => console.error('Failed to send auto-responder:', err));
    }

    return NextResponse.json({ success: true, ticketId });
  } catch (error) {
    await query('ROLLBACK');
    console.error('[Support POST Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
