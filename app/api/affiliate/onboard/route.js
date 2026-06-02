import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { executeLedgerCredit } from '@/lib/mlm';
import { getNumericSetting } from '@/lib/settings';

const USD_TO_INR = 94;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const PIN_RE = /^\d{4,6}$/;
// Accept the values the onboarding UI sends ('CRYPTO' / 'FIAT') as well as the
// raw token preferences. 'FIAT' is normalised to 'INR' for storage.
const VALID_PREFS = ['CRYPTO', 'FIAT', 'INR', 'USDT', 'USDC'];

/**
 * POST /api/affiliate/onboard
 * One-time affiliate join: claim a username, link the sponsor (by username),
 * set currency preference, and optionally open a starting hold. Idempotent.
 *
 * Data model: username + currency_preference live on mlm_nodes (see schema.sql).
 * The node already exists (created at registration), so we UPDATE — never INSERT.
 */
export async function POST(request) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const username = (body.username || '').trim();
    const sponsorUsername = (body.sponsorUsername || '').trim();
    let currencyPreference = (body.currencyPreference || 'CRYPTO').toUpperCase();
    const withdrawalPin = (body.withdrawalPin || '').trim();
    const amountUsd = Number(body.amountUsd) || 0;
    const hasHold = amountUsd > 0;

    // --- Validation ---
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json({ error: 'Invalid username — 3–20 letters, numbers, or underscores.' }, { status: 400 });
    }
    if (!VALID_PREFS.includes(currencyPreference)) {
      return NextResponse.json({ error: 'Invalid currency preference.' }, { status: 400 });
    }
    if (currencyPreference === 'FIAT') currencyPreference = 'INR';
    if (!PIN_RE.test(withdrawalPin)) {
      return NextResponse.json({ error: 'Set a withdrawal PIN of 4–6 digits.' }, { status: 400 });
    }

    const minHoldUsd = await getNumericSetting('MIN_HOLD_USD', 100);
    if (hasHold) {
      if (amountUsd < minHoldUsd) {
        return NextResponse.json({ error: `Minimum starting hold is $${minHoldUsd} (₹${minHoldUsd * USD_TO_INR}).` }, { status: 400 });
      }
      if (amountUsd % 5 !== 0) {
        return NextResponse.json({ error: 'Hold amount must be in multiples of $5.' }, { status: 400 });
      }
    }

    const investmentInr = amountUsd * USD_TO_INR;
    const token = currencyPreference === 'USDC' ? 'USDC' : 'USDT';
    const pinHash = await hashPassword(withdrawalPin);

    await query('BEGIN');

    // Lock the caller's node (created at registration; create defensively if absent).
    let nodeRes = await query(
      `SELECT node_id, parent_id, username FROM mlm_nodes WHERE node_id = $1 FOR UPDATE`,
      [userId]
    );
    if (nodeRes.rows.length === 0) {
      await query(`INSERT INTO mlm_nodes (node_id, node_status) VALUES ($1, 'ACTIVE')`, [userId]);
      nodeRes = await query(
        `SELECT node_id, parent_id, username FROM mlm_nodes WHERE node_id = $1 FOR UPDATE`,
        [userId]
      );
    }
    const node = nodeRes.rows[0];

    if (node.username) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'You have already joined the affiliate program.' }, { status: 409 });
    }

    // Username availability (case-insensitive).
    const taken = await query(
      `SELECT node_id FROM mlm_nodes WHERE LOWER(username) = LOWER($1) AND node_id <> $2 LIMIT 1`,
      [username, userId]
    );
    if (taken.rows.length > 0) {
      await query('ROLLBACK');
      return NextResponse.json({ error: 'That username is already taken.' }, { status: 409 });
    }

    // Resolve sponsor by username (optional, but must exist if provided).
    let sponsorId = node.parent_id;
    if (sponsorUsername) {
      const sponsorRes = await query('SELECT node_id FROM mlm_nodes WHERE LOWER(username) = LOWER($1)', [sponsorUsername]);
      if (sponsorRes.rows.length === 0) {
        await query('ROLLBACK');
        return NextResponse.json({ error: 'Sponsor username not found.' }, { status: 400 });
      }
      sponsorId = sponsorRes.rows[0].node_id;
      if (sponsorId === userId) {
        await query('ROLLBACK');
        return NextResponse.json({ error: 'You cannot sponsor yourself.' }, { status: 400 });
      }
    }

    // Record the opening hold (idempotent) only when one was funded.
    if (hasHold) {
      const ledgerInsert = await query(
        `INSERT INTO wallet_ledger (node_id, amount_usd, amount_inr, transaction_type, token_symbol, idempotency_key, description)
         VALUES ($1, $2, $3, 'DEPOSIT', $4, $5, $6)
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [userId, amountUsd, investmentInr, token, `onboard:${userId}`, `Initial affiliate hold of ${amountUsd} ${token}`]
      );
      if (ledgerInsert.rows.length === 0) {
        await query('ROLLBACK');
        return NextResponse.json({ success: true, duplicate: true });
      }
    }

    await query(
      `UPDATE mlm_nodes
       SET username = $1, currency_preference = $2, parent_id = $3,
           investment_amount_usd = $4, investment_amount_inr = $5,
           node_status = $6, withdrawal_pin_hash = $7
       WHERE node_id = $8`,
      [username, currencyPreference, sponsorId, amountUsd, investmentInr, hasHold ? 'ACTIVE' : 'PENDING', pinHash, userId]
    );

    await query('COMMIT');

    // Flat 5% direct sponsor commission (own transaction, subject to 2.5x cap).
    if (hasHold && sponsorId) {
      await executeLedgerCredit({
        nodeId: sponsorId,
        amountUsd: amountUsd * 0.05,
        type: 'DIRECT_REFERRAL',
        referenceNodeId: userId,
        description: `Direct referral commission (5% of ${amountUsd} hold)`,
      });
    }

    // Fetch name and email
    const userRes = await query(`SELECT name, email FROM users WHERE id = $1`, [userId]);
    const name = userRes.rows[0]?.name || '';
    const email = userRes.rows[0]?.email || '';

    return NextResponse.json({
      success: true,
      username,
      userId,
      name,
      email,
      currencyPreference,
      holdUsd: amountUsd,
      holdInr: investmentInr,
    });
  } catch (error) {
    await query('ROLLBACK');
    console.error('[Affiliate Onboard Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
