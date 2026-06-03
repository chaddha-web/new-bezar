import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

export async function GET(request) {
  try {
    const session = request.cookies.get('bezar_admin_session');
    if (!session || !session.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyAdminToken(session.value);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const res = await query(`SELECT * FROM company_crypto_wallets`);
    return NextResponse.json({ success: true, wallets: res.rows });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch wallets' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = request.cookies.get('bezar_admin_session');
    if (!session || !session.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyAdminToken(session.value);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { address, network } = await request.json();
    if (!address) return NextResponse.json({ error: 'Missing address' }, { status: 400 });

    const res = await query(
      `INSERT INTO company_crypto_wallets (address, network, is_active) VALUES ($1, $2, true) RETURNING *`,
      [address, network || 'BEP20']
    );

    return NextResponse.json({ success: true, wallet: res.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Wallet address already exists in pool.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to insert wallet' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const session = request.cookies.get('bezar_admin_session');
    if (!session || !session.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const payload = await verifyAdminToken(session.value);
    if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    await query(`DELETE FROM company_crypto_wallets WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete wallet' }, { status: 500 });
  }
}
