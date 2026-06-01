import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { executeBep20TokenPayout } from '@/lib/web3';

export async function POST(request) {
  try {
    const { userId, amountUsd, tokenSymbol = 'USDT' } = await request.json();

    if (!userId || !amountUsd) {
      return NextResponse.json({ error: 'Missing userId or amountUsd' }, { status: 400 });
    }

    const requestAmountUsd = Number(amountUsd);

    // 1. Minimum Authorized Threshold Check
    if (requestAmountUsd < 25) {
      return NextResponse.json(
        { error: 'Minimum withdrawable threshold is 25 Stablecoins ($25 USD).' },
        { status: 400 }
      );
    }

    // 2. Discrete Step Modulo Constraint Check
    if (requestAmountUsd % 25 !== 0) {
      return NextResponse.json(
        { error: 'Withdrawals are restricted exclusively to absolute increments of 25 Stablecoins.' },
        { status: 400 }
      );
    }

    await query('BEGIN');

    // 3. Fetch active wallet balances and payout destination address
    const balanceRes = await query(
      `SELECT wallet_balance_usd, wallet_balance_inr, user_payout_address 
       FROM mlm_nodes 
       WHERE node_id = $1 FOR UPDATE`,
      [userId]
    );

    if (balanceRes.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Wallet details not found' }, { status: 404 });
    }

    const { wallet_balance_usd, wallet_balance_inr, user_payout_address } = balanceRes.rows[0];
    const currentBalanceUsd = Number(wallet_balance_usd);
    const currentBalanceInr = Number(wallet_balance_inr);

    if (currentBalanceUsd < requestAmountUsd) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Insufficient wallet balance' }, { status: 400 });
    }

    const payoutAddress = user_payout_address || '0xf8e7d...7955'; // Fallback mockup destination for tests

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
      `INSERT INTO wallet_ledger (node_id, amount_usd, amount_inr, transaction_type, bsc_tx_hash, token_symbol, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId, 
        -requestAmountUsd, 
        -(requestAmountUsd * 94), 
        'WITHDRAWAL', 
        blockchainPayout.txHash, 
        tokenSymbol, 
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
    console.error('[Withdrawal Error] Payout pipeline aborted:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
