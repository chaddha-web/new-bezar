import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/**
 * POST /api/webhooks/resend
 * Receives incoming emails forwarded by Resend webhook.
 * Extracts the ticket ID from the subject [Ticket #<UUID>] and appends the message.
 */
export async function POST(request) {
  try {
    const payload = await request.json();
    
    // Resend webhook wrapper structure: payload.type === 'email.received', payload.data contains email info
    if (payload.type !== 'email.received') {
      return NextResponse.json({ success: true, ignored: true });
    }

    const emailData = payload.data;
    const subject = emailData.subject || '';
    const textBody = emailData.text || emailData.html || '(No content)';

    // Extract ticket ID from subject: [Ticket #<uuid>]
    const match = subject.match(/\[Ticket #([a-f0-9\-]{36})\]/i);
    if (!match) {
      console.log('Incoming email missing ticket ID in subject:', subject);
      return NextResponse.json({ success: true, ignored: true });
    }

    const ticketId = match[1];

    // Check if ticket exists
    const ticketRes = await query(`SELECT id, user_id FROM support_tickets WHERE id = $1`, [ticketId]);
    if (ticketRes.rows.length === 0) {
      console.log('Incoming email mapped to invalid ticket:', ticketId);
      return NextResponse.json({ success: true, ignored: true });
    }

    const userId = ticketRes.rows[0].user_id;

    // Clean up email replies if possible (very basic strip of original message)
    // Normally we'd use a robust parser, but a naive split on "On ... wrote:" works for basic replies
    const cleanText = textBody.split(/\nOn .* wrote:/)[0].trim();

    await query('BEGIN');
    await query(
      `INSERT INTO support_messages (ticket_id, sender_type, body) VALUES ($1, 'SUPPORT', $2)`,
      [ticketId, cleanText]
    );
    await query(`UPDATE support_tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [ticketId]);
    await query('COMMIT');

    // Notify user of the reply via Resend API
    if (resend) {
      const userRes = await query(`SELECT email, name FROM users WHERE id = $1`, [userId]);
      if (userRes.rows.length > 0) {
        resend.emails.send({
          from: 'Bezar Support <support@bezar.in>',
          to: [userRes.rows[0].email],
          subject: subject.startsWith('Re:') ? subject : `Re: ${subject}`,
          text: `Support has replied to your ticket:\n\n${cleanText}\n\nYou can reply directly to this email.`,
        }).catch(err => console.error('Failed to email user:', err));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Resend Webhook Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
