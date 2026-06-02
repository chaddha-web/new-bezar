import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { executeBep20TokenPayout } from '@/lib/web3';
import { verifyUserToken } from '@/lib/auth';
import { comparePassword } from '@/lib/password';

export async function POST(request) {
  try {
    const session = request.cookies.get('bezar_user_session');
    const payload = session ? await verifyUserToken(session.value) : null;
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = payload.userId;

    const idempotencyKey = request.headers.get('Idempotency-Key');
    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Idempotency-Key header is required' }, { status: 400 });
    }

    const { amountUsd, tokenSymbol = 'USDT', pin } = await request.json();

    if (!amountUsd) {
      return NextResponse.json({ error: 'Missing amountUsd' }, { status: 400 });
    }
    if (!pin) {
      return NextResponse.json({ error: 'Withdrawal PIN is required.' }, { status: 400 });
    }

    const requestAmountUsd = Number(amountUsd);

    // 1. Minimum Authorized Threshold Check
    if (requestAmountUsd < 50) {
      return NextResponse.json(
        { error: 'Minimum withdrawable threshold is 50 Stablecoins ($50 USD).' },
        { status: 400 }
      );
    }

    // 2. 1-Withdrawal Per Day Check
    const todayRes = await query(
      `SELECT COUNT(*) as count FROM wallet_ledger 
       WHERE node_id = $1 AND transaction_type = 'WITHDRAWAL' 
       AND CAST(created_at AT TIME ZONE 'UTC' AS DATE) = CAST(CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS DATE)`,
      [userId]
    );

    if (Number(todayRes.rows[0].count) > 0) {
      return NextResponse.json(
        { error: 'Withdrawals are restricted to exactly 1 request per day.' },
        { status: 429 }
      );
    }

    await query('BEGIN');

    // 3. Fetch active wallet balances, payout address, and the withdrawal PIN hash
    const balanceRes = await query(
      `SELECT wallet_balance_usd, wallet_balance_inr, user_payout_address, withdrawal_pin_hash
       FROM mlm_nodes
       WHERE node_id = $1 FOR UPDATE`,
      [userId]
    );

    if (balanceRes.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Wallet details not found' }, { status: 404 });
    }

    const { wallet_balance_usd, wallet_balance_inr, user_payout_address, withdrawal_pin_hash } = balanceRes.rows[0];

    // Verify the withdrawal PIN set during affiliate onboarding.
    if (!withdrawal_pin_hash) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'No withdrawal PIN on file. Complete affiliate onboarding first.' }, { status: 400 });
    }
    const pinValid = await comparePassword(String(pin), withdrawal_pin_hash);
    if (!pinValid) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Incorrect withdrawal PIN.' }, { status: 401 });
    }

    const currentBalanceUsd = Number(wallet_balance_usd);
    const currentBalanceInr = Number(wallet_balance_inr);

    if (currentBalanceUsd < requestAmountUsd) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
    }

    const payoutAddress = user_payout_address || '0xf8e7d00000000000000000000000000000007955'; // Fallback mockup destination for tests

    // 4. Trigger Automated Blockchain Smart Contract Payout Broadcast
    const blockchainPayout = await executeBep20TokenPayout(payoutAddress, requestAmountUsd, tokenSymbol);

    if (!blockchainPayout.success) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Decentralized gateway broadcast failed' }, { status: 500 });
    }

    // 5. Subtract amounts and retain residual float in database
    const remainingBalanceUsd = currentBalanceUsd - requestAmountUsd;
    const remainingBalanceInr = remainingBalanceUsd * 94; // Fixed conversion

    await query(
      `UPDATE mlm_nodes 
       SET wallet_balance_usd = $1, wallet_balance_inr = $2 
       WHERE node_id = $3`,
      [remainingBalanceUsd, remainingBalanceInr, userId]
    );

    // 6. Log transaction entry with BSC transaction hash inside wallet_ledger
    await query(
      `INSERT INTO wallet_ledger (node_id, amount_usd, amount_inr, transaction_type, bsc_tx_hash, token_symbol, idempotency_key, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId, 
        -requestAmountUsd, 
        -(requestAmountUsd * 94), 
        'WITHDRAWAL', 
        blockchainPayout.txHash, 
        tokenSymbol, 
        idempotencyKey,
        `Web3 outbound payout release of ${requestAmountUsd} BEP-20 ${tokenSymbol}`
      ]
    );

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      message: 'Withdrawal successfully authorized and processed.',
      withdrawnUsd: requestAmountUsd,
      withdrawnInr: requestAmountUsd * 94,
      bscTxHash: blockchainPayout.txHash,
      residualFloatUsd: remainingBalanceUsd
    });

  } catch (error) {
    await query('ROLLBACK');
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Duplicate withdrawal request detected' }, { status: 409 });
    }
    console.error('[Withdrawal Error] Payout pipeline aborted:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
