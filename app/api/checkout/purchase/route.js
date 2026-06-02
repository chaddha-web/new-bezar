import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { executeLedgerCredit } from '@/lib/mlm';
import { verifyUserToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const session = request.cookies.get('bezar_user_session');
    const payload = session ? await verifyUserToken(session.value) : null;
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = payload.userId;

    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Idempotency-Key header is required' }, { status: 400 });
    }

    const { sponsorId, amountPaid } = await request.json();

    if (!amountPaid) {
      return NextResponse.json({ error: 'Missing amountPaid' }, { status: 400 });
    }

    const allowedPlans = {
      299: 299 / 94,
      3299: 3299 / 94,
      9400: 100, // Legacy baseline pack
      18800: 200
    };

    if (!allowedPlans[amountPaid]) {
      return NextResponse.json({ error: 'Invalid plan selected' }, { status: 400 });
    }

    const investment = Number(amountPaid);
    const investmentUsd = allowedPlans[amountPaid];

    await query('BEGIN');

    // 1. Verify if user is an existing MLM Node
    const nodeRes = await query('SELECT node_id, node_status FROM mlm_nodes WHERE node_id = $1', [userId]);

    if (nodeRes.rows.length > 0) {
      // RENEWAL CYCLE TRIGGERED: Reset accumulated earnings to 0 and set node to ACTIVE
      await query(
        `UPDATE mlm_nodes 
         SET investment_amount_inr = $1, accumulated_earnings_inr = 0.00, node_status = 'ACTIVE' 
         WHERE node_id = $2`,
        [investment, userId]
      );
    } else {
      // NEW ONBOARDING: Register new tree node
      const parentId = sponsorId || null;
      await query(
        `INSERT INTO mlm_nodes (node_id, parent_id, investment_amount_inr, accumulated_earnings_inr, node_status)
         VALUES ($1, $2, $3, 0.00, 'ACTIVE')`,
        [userId, parentId, investment]
      );
    }

    // 2. Fetch parent sponsor to allocate flat 5% direct commission fee
    const treeRes = await query('SELECT parent_id FROM mlm_nodes WHERE node_id = $1', [userId]);
    const sponsor = treeRes.rows.length > 0 ? treeRes.rows[0].parent_id : null;

    await query('COMMIT');

    if (sponsor) {
      // Compute 5% Direct Fee
      const directFeeUsd = investmentUsd * 0.05;
      
      // Credit direct sponsor wallet (Subject to 2.5x capping loops)
      const commissionRes = await executeLedgerCredit({
        nodeId: sponsor,
        amountUsd: directFeeUsd,
        type: 'DIRECT_REFERRAL',
        referenceNodeId: userId,
        idempotencyKey,
        description: `Direct referral onboarding commission fee (5% of ₹${investment} purchase)`
      });

      return NextResponse.json({
        success: true,
        message: 'Onboarding completed successfully. Referral commission dispatched.',
        commissionStatus: commissionRes.success ? 'DISPATCHED' : 'CAP_EXPIRED'
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully. No sponsor node linked.'
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('[Purchase Hook Error] Checkout pipeline aborted:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
