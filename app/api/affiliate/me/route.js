import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { generateBscDepotAddress } from '@/lib/web3';
import { verifyUserToken } from '@/lib/auth';

const USD_TO_INR = 94.00;

/**
 * GET /api/affiliate/me
 * Resolves the active viewer session and returns their MLM node, wallet ledger,
 * and downline network (direct sponsored legs + recursive team size/volume).
 * Lazily provisions a unique BSC deposit address if one was never assigned.
 */
export async function GET(request) {
  try {
    const session = request.cookies.get('bezar_user_session');
    if (!session || !session.value) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    const payload = await verifyUserToken(session.value);
    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    const userId = payload.userId;

    // 1. Viewer identity + active subscription plan
    const userRes = await query(
      `SELECT u.id, u.email, u.name, u.created_at, s.plan_name AS plan
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       WHERE u.id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    const user = userRes.rows[0];

    // 2. MLM node
    let nodeRes = await query(
      `SELECT node_id, parent_id, investment_amount_usd, investment_amount_inr,
              accumulated_earnings_usd, accumulated_earnings_inr,
              wallet_balance_usd, wallet_balance_inr,
              node_status, accelerator_mode, current_rank,
              bsc_deposit_address, user_payout_address,
              username, currency_preference, withdrawal_pin_hash, created_at
       FROM mlm_nodes WHERE node_id = $1`,
      [userId]
    );

    // Auto-create if doesn't exist
    if (nodeRes.rows.length === 0) {
      await query(
        `INSERT INTO mlm_nodes (node_id, node_status) VALUES ($1, 'ACTIVE')
         ON CONFLICT (node_id) DO NOTHING`,
        [userId]
      );
      nodeRes = await query(
        `SELECT node_id, parent_id, investment_amount_usd, investment_amount_inr,
                accumulated_earnings_usd, accumulated_earnings_inr,
                wallet_balance_usd, wallet_balance_inr,
                node_status, accelerator_mode, current_rank,
                bsc_deposit_address, user_payout_address,
                username, currency_preference, created_at
         FROM mlm_nodes WHERE node_id = $1`,
        [userId]
      );
    }

    const node = nodeRes.rows[0];

    // 3. Wallet ledger (most recent first)
    const ledgerRes = await query(
      `SELECT id, amount_usd, amount_inr, transaction_type, reference_node_id,
              bsc_tx_hash, token_symbol, description, created_at
       FROM wallet_ledger
       WHERE node_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [userId]
    );

    // 4. Direct sponsored legs
    const directsRes = await query(
      `SELECT u.id, u.name, u.email, m.node_status, m.current_rank,
              m.investment_amount_usd, m.created_at
       FROM mlm_nodes m
       JOIN users u ON u.id = m.node_id
       WHERE m.parent_id = $1
       ORDER BY m.created_at DESC`,
      [userId]
    );

    // 5. Recursive whole-team size + group volume
    const teamRes = await query(
      `WITH RECURSIVE team AS (
         SELECT node_id FROM mlm_nodes WHERE parent_id = $1
         UNION ALL
         SELECT m.node_id FROM mlm_nodes m
         JOIN team t ON m.parent_id = t.node_id
       )
       SELECT COUNT(*)::int AS team_count,
              COALESCE(SUM(n.investment_amount_usd), 0)::float AS team_volume_usd
       FROM team t
       JOIN mlm_nodes n ON n.node_id = t.node_id`,
      [userId]
    );

    const num = (v) => (v === null || v === undefined ? 0 : Number(v));

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan || 'Free',
        joined: user.created_at,
      },
      node: {
        parentId: node.parent_id,
        investmentUsd: num(node.investment_amount_usd),
        investmentInr: num(node.investment_amount_inr),
        earningsUsd: num(node.accumulated_earnings_usd),
        earningsInr: num(node.accumulated_earnings_inr),
        walletUsd: num(node.wallet_balance_usd),
        walletInr: num(node.wallet_balance_inr),
        status: node.node_status,
        accelerator: node.accelerator_mode,
        rank: node.current_rank,
        payoutAddress: node.user_payout_address,
        username: node.username,
        currencyPreference: node.currency_preference || 'INR',
        payoutPreference: node.currency_preference || 'CRYPTO',
        hasWithdrawalPin: !!node.withdrawal_pin_hash,
        onboarded: !!node.username,
      },
      ledger: ledgerRes.rows.map((l) => ({
        id: l.id,
        type: l.transaction_type,
        amountUsd: num(l.amount_usd),
        amountInr: num(l.amount_inr),
        txHash: l.bsc_tx_hash,
        token: l.token_symbol,
        description: l.description,
        createdAt: l.created_at,
      })),
      network: {
        directCount: directsRes.rows.length,
        teamCount: teamRes.rows[0]?.team_count || 0,
        teamVolumeUsd: num(teamRes.rows[0]?.team_volume_usd),
        directs: directsRes.rows.map((d) => ({
          id: d.id,
          name: d.name,
          email: d.email,
          status: d.node_status,
          rank: d.current_rank,
          investmentUsd: num(d.investment_amount_usd),
          joined: d.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('[Affiliate Me Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/affiliate/me
 * Updates the designated Web3 payout destination address for the session user.
 */
export async function POST(request) {
  try {
    const session = request.cookies.get('bezar_user_session');
    if (!session || !session.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const payload = await verifyUserToken(session.value);
    if (!payload) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const userId = payload.userId;

    const { payoutAddress } = await request.json();

    if (!payoutAddress || !/^0x[a-fA-F0-9]{40}$/.test(payoutAddress.trim())) {
      return NextResponse.json(
        { error: 'Enter a valid BEP-20 (0x…) wallet address — 42 characters.' },
        { status: 400 }
      );
    }

    await query(
      `UPDATE mlm_nodes SET user_payout_address = $1 WHERE node_id = $2`,
      [payoutAddress.trim(), userId]
    );

    return NextResponse.json({ success: true, payoutAddress: payoutAddress.trim() });
  } catch (error) {
    console.error('[Affiliate Payout Update Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
