import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyUserToken } from '@/lib/auth';

export async function POST(request) {
  try {
    const session = request.cookies.get('bezar_user_session');
    const payload = session ? await verifyUserToken(session.value) : null;
    
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = payload.userId;

    await query('BEGIN');

    // 1. Clean up expired locks universally
    await query(`DELETE FROM wallet_locks WHERE expires_at < CURRENT_TIMESTAMP`);

    // 2. Check if user already has an active lock
    const existingLockRes = await query(
      `SELECT wallet_address, expires_at FROM wallet_locks 
       WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [userId]
    );

    if (existingLockRes.rows.length > 0) {
      await query('COMMIT');
      return NextResponse.json({ 
        success: true, 
        walletAddress: existingLockRes.rows[0].wallet_address,
        expiresAt: existingLockRes.rows[0].expires_at
      });
    }

    // 3. Find an available company wallet
    const availableWalletRes = await query(
      `SELECT address FROM company_crypto_wallets 
       WHERE is_active = TRUE 
       AND address NOT IN (SELECT wallet_address FROM wallet_locks WHERE expires_at > CURRENT_TIMESTAMP)
       LIMIT 1 FOR UPDATE SKIP LOCKED`
    );

    if (availableWalletRes.rows.length === 0) {
      await query('ROLLBACK');
      return NextResponse.json({ 
        error: 'All deposit addresses are currently in use. Please wait in queue.',
        queueStatus: 'BUSY'
      }, { status: 429 });
    }

    const assignedAddress = availableWalletRes.rows[0].address;

    // 4. Lock the wallet for 10 minutes
    const lockRes = await query(
      `INSERT INTO wallet_locks (wallet_address, user_id, expires_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '10 minutes')
       RETURNING expires_at`,
      [assignedAddress, userId]
    );

    await query('COMMIT');

    return NextResponse.json({
      success: true,
      walletAddress: assignedAddress,
      expiresAt: lockRes.rows[0].expires_at
    });

  } catch (error) {
    await query('ROLLBACK');
    console.error('[Wallet Request Error]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
