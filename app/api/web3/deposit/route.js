import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyBep20TokenDeposit } from '@/lib/web3';
import { executeLedgerCredit } from '@/lib/mlm';
import { verifyUserToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const session = request.cookies.get('bezar_user_session');
    const payload = session ? await verifyUserToken(session.value) : null;
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = payload.userId;

    const { bscTxHash, tokenSymbol } = await request.json();

    if (!bscTxHash) {
      return NextResponse.json({ error: 'Missing bscTxHash' }, { status: 400 });
    }

    await query('BEGIN');

    // 1. Fetch user's node status
    const nodeRes = await query(
      'SELECT parent_id, node_status FROM mlm_nodes WHERE node_id = $1 FOR UPDATE',
      [userId]
    );

    if (nodeRes.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'MLM Node not registered yet' }, { status: 404 });
    }

    const { parent_id, node_status } = nodeRes.rows[0];

    // 1.5 Fetch active locked wallet for this user
    const lockRes = await query(
      `SELECT wallet_address FROM wallet_locks WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [userId]
    );

    if (lockRes.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'No active crypto address reservation found. Please request an address first.' }, { status: 400 });
    }

    const bsc_deposit_address = lockRes.rows[0].wallet_address;

    // 2. Perform on-chain transfer event audit with safety depths (12 blocks)
    const verification = await verifyBep20TokenDeposit(bscTxHash, bsc_deposit_address, tokenSymbol || 'USDT');

    if (!verification.verified) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'On-chain transaction verification failed' }, { status: 400 });
    }

    const investmentUsd = Number(verification.value);
    const investmentInr = investmentUsd * 94; // Fixed conversion layer

    if (investmentUsd < 100) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'Minimum contract deposit is 100 Stablecoins ($100 USD)' }, { status: 400 });
    }

    let isRenewal = false;

    // 3. Process contract activation or renewal resets
    if (node_status === 'EXPIRED') {
      isRenewal = true;
      await query(
        `UPDATE mlm_nodes 
         SET investment_amount_usd = $1, investment_amount_inr = $2,
             accumulated_earnings_usd = 0.00, accumulated_earnings_inr = 0.00,
             node_status = 'ACTIVE' 
         WHERE node_id = $3`,
        [investmentUsd, investmentInr, userId]
      );
    } else {
      await query(
        `UPDATE mlm_nodes 
         SET investment_amount_usd = $1, investment_amount_inr = $2, node_status = 'ACTIVE' 
         WHERE node_id = $3`,
        [investmentUsd, investmentInr, userId]
      );
    }

    // Record Deposit in Wallet Ledger
    await query(
      `INSERT INTO wallet_ledger (node_id, amount_usd, amount_inr, transaction_type, bsc_tx_hash, token_symbol, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, investmentUsd, investmentInr, 'DEPOSIT', bscTxHash, tokenSymbol || 'USDT', `Contract deposit of ${investmentUsd} BEP-20 ${tokenSymbol}`]
    );

    // Release the wallet lock instantly so someone else can use it
    await query(`DELETE FROM wallet_locks WHERE user_id = $1`, [userId]);

    await query('COMMIT');

    // 4. Pay Flat 5% Sponsor direct commission fee
    if (parent_id) {
      const directFeeUsd = investmentUsd * 0.05;
      
      await executeLedgerCredit({
        nodeId: parent_id,
        amountUsd: directFeeUsd,
        type: 'DIRECT_REFERRAL',
        referenceNodeId: userId,
        description: `Direct sponsored Web3 contract ${isRenewal ? 'renewal' : 'activation'} (5% commission)`
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Token deposit confirmed. Package activated.',
      value: investmentUsd,
      isRenewal
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('[Web3 Deposit Hook Error] Rollback executed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
