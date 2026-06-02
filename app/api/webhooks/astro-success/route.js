import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(request) {
  try {
    const { userId, holdUsd, paymentId, type, planName } = await request.json();

    if (!userId || !paymentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (type === 'subscription') {
      // HANDLE SUBSCRIPTION CHECKOUT
      await query('BEGIN');
      const subRes = await query(
        `INSERT INTO subscriptions (user_id, plan_name, status, current_period_start)
         VALUES ($1, $2, 'active', CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE 
         SET plan_name = EXCLUDED.plan_name, status = 'active', current_period_start = CURRENT_TIMESTAMP`,
        [userId, planName]
      );
      await query('COMMIT');
      return NextResponse.json({ success: true, type: 'subscription' });
    }

    // HANDLE AFFILIATE ONBOARD/TOPUP HOLD

    const amountUsd = Number(holdUsd);
    const amountInr = amountUsd * 94; // Base INR value credited

    await query('BEGIN');

    // 1. Verify user exists
    const userRes = await query(`SELECT node_id FROM mlm_nodes WHERE node_id = $1 FOR UPDATE`, [userId]);
    if (userRes.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    // 2. Insert ledger
    const ledgerRes = await query(
      `INSERT INTO wallet_ledger (node_id, amount_usd, amount_inr, transaction_type, token_symbol, idempotency_key, description)
       VALUES ($1, $2, $3, 'DEPOSIT', 'INR', $4, $5)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [userId, amountUsd, amountInr, `razorpay:${paymentId}`, `Razorpay INR Deposit via Astro21`]
    );

    if (ledgerRes.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ success: true, duplicate: true }); // Already processed
    }

    // 3. Update Hold
    await query(
      `UPDATE mlm_nodes 
       SET investment_amount_usd = investment_amount_usd + $1,
           investment_amount_inr = investment_amount_inr + $2
       WHERE node_id = $3`,
      [amountUsd, amountInr, userId]
    );

    await query('COMMIT');

    // 4. Send Official Bezar Invoice
    if (resend) {
      const userDetails = await query(`SELECT name, email FROM users WHERE id = $1`, [userId]);
      if (userDetails.rows.length > 0) {
        const u = userDetails.rows[0];
        const invoiceHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Bezar Payment Receipt</h2>
            <p>Dear ${u.name},</p>
            <p>Thank you for your payment. Your Affiliate Hold has been successfully updated.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0;"><strong>Transaction ID:</strong></td>
                <td style="padding: 10px 0; text-align: right;">${paymentId}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0;"><strong>Hold Credited (USD):</strong></td>
                <td style="padding: 10px 0; text-align: right;">$${amountUsd}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0;"><strong>Base Amount (INR):</strong></td>
                <td style="padding: 10px 0; text-align: right;">₹${amountInr}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 0;"><strong>Processing Fee (8%):</strong></td>
                <td style="padding: 10px 0; text-align: right;">₹${Math.round(amountInr * 0.08)}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-size: 18px;"><strong>Total Paid (INR):</strong></td>
                <td style="padding: 10px 0; text-align: right; font-size: 18px;"><strong>₹${Math.round(amountInr * 1.08)}</strong></td>
              </tr>
            </table>
            <p style="margin-top: 30px; color: #666; font-size: 12px;">This is an automated receipt from Bezar.in. For support, reply to this email.</p>
          </div>
        `;
        resend.emails.send({
          from: 'Bezar Billing <support@bezar.in>',
          to: [u.email],
          subject: `Payment Receipt: ${paymentId}`,
          html: invoiceHtml,
        }).catch(err => console.error('Failed to send invoice:', err));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    await query('ROLLBACK');
    console.error('[Astro Webhook Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
