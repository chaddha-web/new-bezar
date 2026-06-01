import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request) {
  try {
    const { userId, amount } = await request.json();

    if (!userId || !amount) {
      return NextResponse.json({ error: 'Missing userId or amount' }, { status: 400 });
    }

    const requestAmount = Number(amount);

    // 1. Minimum Threshold Constraint Check
    if (requestAmount < 2350) {
      return NextResponse.json(
        { error: 'Minimum withdrawal threshold is ₹2,350 INR.' },
        { status: 400 }
      );
    }

    // 2. Discrete Step Constraint Check (Modulo Equation)
    if (requestAmount % 2350 !== 0) {
      return NextResponse.json(
        { error: 'Withdrawals are restricted exclusively to absolute increments of ₹2,350 INR.' },
        { status: 400 }
      );
    }

    await query('BEGIN');

    // 3. Fetch active wallet balance to check availability
    const balanceRes = await query(
      'SELECT wallet_balance_inr FROM mlm_nodes WHERE node_id = $1 FOR UPDATE',
      [userId]
    );

    if (balanceRes.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const currentBalance = Number(balanceRes.rows[0].wallet_balance_inr);

    if (currentBalance < requestAmount) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
    }

    // 4. Subtract requested amount and preserve residual fractional system float
    const remainingBalance = currentBalance - requestAmount;

    await query(
      'UPDATE mlm_nodes SET wallet_balance_inr = $1 WHERE node_id = $2',
      [remainingBalance, userId]
    );

    // 5. Log entry in transaction ledger
    await query(
      `INSERT INTO wallet_ledger (node_id, amount, transaction_type, description)
       VALUES ($1, $2, $3, $4)`,
      [userId, -requestAmount, 'WITHDRAWAL', `Outbound payout release of ₹${requestAmount} INR`]
    );

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Withdrawal successfully authorized and processed.',
      withdrawn: requestAmount,
      residualFloat: remainingBalance
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('[Withdrawal Error] Payout pipeline aborted:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
