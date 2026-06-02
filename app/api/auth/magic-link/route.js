import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import crypto from 'crypto';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request) {
  try {
    const { email, remember } = await request.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

    await query(
      'INSERT INTO auth_tokens (token, email, expires_at) VALUES ($1, $2, $3)',
      [token, email, expiresAt]
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const link = `${baseUrl}/api/auth/verify?token=${token}${remember ? '&remember=true' : ''}`;

    if (resend) {
      await resend.emails.send({
        from: 'Bezar <onboarding@resend.dev>', // Update in prod
        to: email,
        subject: 'Log into Bezar',
        html: `<p>Click the link below to securely log into your Bezar account:</p><p><a href="${link}">${link}</a></p><p>This link expires in 15 minutes.</p>`
      });
    } else {
      // Mock for local dev
      console.log(`\n\n[MAGIC LINK FOR ${email}]:\n-> ${link}\n\n`);
    }

    // Always return generic success to prevent enumeration
    return NextResponse.json({ success: true, message: 'If an account exists, a magic link was sent.' });
  } catch (error) {
    console.error('Magic link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
