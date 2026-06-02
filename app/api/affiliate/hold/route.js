import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { executeLedgerCredit } from '@/lib/mlm';
import { getNumericSetting } from '@/lib/settings';

const USD_TO_INR = 94;

/**
 * POST /api/affiliate/hold
 * Adds a new hold (top-up) for an already-onboarded affiliate, increasing their
 * contract base. Idempotent via a client-supplied Idempotency-Key.
 */
export async function POST(request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const amountUsd = Number(body.amountUsd);
    const idempotencyKey =
      request.headers.get('idempotency-key') || body.idempotencyKey || `hold:${userId}:${Date.now()}`;

    const minHoldUsd = await getNumericSetting('MIN_HOLD_USD', 100);
    if (!Number.isFinite(amountUsd) || amountUsd < minHoldUsd) {
      return NextResponse.json({ error: `Minimum hold is $${minHoldUsd} (₹${minHoldUsd * USD_TO_INR}).` }, { status: 400 });
    }
    if (amountUsd % 5 !== 0) {
      return NextResponse.json({ error: 'Hold amount must be in multiples of $5.' }, { status: 400 });
    }

    const amountInr = amountUsd * USD_TO_INR;

    await query('BEGIN');

    const nodeRes = await query(
      `SELECT username, parent_id, currency_preference,
              investment_amount_usd, node_status
       FROM mlm_nodes WHERE node_id = $1 FOR UPDATE`,
      [userId]
    );

    if (nodeRes.rows.length === 0 || !nodeRes.rows[0].username) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Join the affiliate program before adding a hold.' }, { status: 400 });
    }

    const node = nodeRes.rows[0];
    const token = node.currency_preference === 'INR' ? 'USDT' : node.currency_preference || 'USDT';

    // Idempotency guard first — a duplicate must not increase the contract twice.
    const ledgerInsert = await query(
      `INSERT INTO wallet_ledger (node_id, amount_usd, amount_inr, transaction_type, token_symbol, idempotency_key, description)
       VALUES ($1, $2, $3, 'DEPOSIT', $4, $5, $6)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [userId, amountUsd, amountInr, token, idempotencyKey, `Added hold of ${amountUsd} ${token}`]
    );

    if (ledgerInsert.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ success: true, duplicate: true });
    }

    const newInvestmentUsd = Number(node.investment_amount_usd) + amountUsd;
    await query(
      `UPDATE mlm_nodes
       SET investment_amount_usd = $1, investment_amount_inr = $2, node_status = 'ACTIVE'
       WHERE node_id = $3`,
      [newInvestmentUsd, newInvestmentUsd * USD_TO_INR, userId]
    );

    await query('COMMIT');

    if (node.parent_id) {
      await executeLedgerCredit({
        nodeId: node.parent_id,
        amountUsd: amountUsd * 0.05,
        type: 'DIRECT_REFERRAL',
        referenceNodeId: userId,
        description: `Direct referral commission (5% of ${amountUsd} top-up hold)`,
      });
    }

    return NextResponse.json({
      success: true,
      addedUsd: amountUsd,
      totalHoldUsd: newInvestmentUsd,
    });
  } catch (error) {
    await query('ROLLBACK');
    console.error('[Affiliate Hold Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
