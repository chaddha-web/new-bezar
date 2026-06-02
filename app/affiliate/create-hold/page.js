"use client";

import { useState, useEffect } from "react";
import { useAffiliate } from "../layout";

export default function AffiliateCreateHold() {
  const { data, refresh } = useAffiliate();
  const [amount, setAmount] = useState('');
  const [mobile, setMobile] = useState('');
  const [maxInr, setMaxInr] = useState(30000);
  const [minHold, setMinHold] = useState(100);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  
  // Crypto Queue State
  const [cryptoAddress, setCryptoAddress] = useState(null);
  const [queueMsg, setQueueMsg] = useState('');
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(res => {
        if (res.settings && res.settings.MAX_INR_TRANSACTION) {
          setMaxInr(Number(res.settings.MAX_INR_TRANSACTION));
        }
        if (res.settings && res.settings.MIN_HOLD_USD) {
          setMinHold(Number(res.settings.MIN_HOLD_USD));
        }
      });
  }, []);

  // Poll for Crypto Wallet
  const requestWallet = async () => {
    setPolling(true);
    setQueueMsg('Waiting for an available company wallet...');
    try {
      const res = await fetch('/api/web3/request-wallet', { method: 'POST' });
      const d = await res.json();
      if (res.ok) {
        setCryptoAddress(d.walletAddress);
        setQueueMsg('');
        setPolling(false);
      } else if (res.status === 429) {
        // Queue busy, wait 5 seconds and retry
        setTimeout(requestWallet, 5000);
      } else {
        setQueueMsg('Error: ' + (d.error || 'Failed to request wallet'));
        setPolling(false);
      }
    } catch (e) {
      setQueueMsg('Network error.');
      setPolling(false);
    }
  };

  useEffect(() => {
    if (data && data.node.payoutPreference !== 'FIAT' && !cryptoAddress && !polling) {
      requestWallet();
    }
  }, [data, cryptoAddress, polling]);

  const handleTopup = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });
    const amt = Number(amount);
    if (!amt || amt < minHold) return setMsg({ type: 'err', text: `Minimum hold is $${minHold}.` });
    if (amt % 5 !== 0) return setMsg({ type: 'err', text: 'Use multiples of $5.' });

    if (data.node.payoutPreference === 'FIAT') {
      const baseInr = amount * 94;
      const fee = Math.round(baseInr * 0.08);
      const totalInr = baseInr + fee;

      const name = data.user.name || 'Affiliate Member';
      const email = data.user.email || 'support@bezar.in';
      const astroUrl = process.env.NEXT_PUBLIC_ASTRO_URL || 'http://localhost:3001';
      const url = `${astroUrl}/?bezar_checkout=true&amountInr=${totalInr}&holdUsd=${amount}&userId=${data.user.id}&name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}&mobile=${encodeURIComponent(mobile)}`;
      const popup = window.open(url, 'AstroPayment', 'width=500,height=750,left=100,top=100');
      
      const handleMessage = async (event) => {
        if (event.origin !== astroUrl) return;
        if (event.data?.type === 'RAZORPAY_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          await fetch('/api/webhooks/astro-success', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: data.user.id,
              holdUsd: event.data.holdUsd,
              paymentId: event.data.paymentId,
              type: 'topup'
            })
          });
          if (popup) popup.close();
          window.location.href = '/affiliate';
        }
      };
      window.addEventListener('message', handleMessage);
    } else {
      // CRYPTO flow — credit the hold directly via the idempotent top-up API.
      setBusy(true);
      try {
        const key = (crypto?.randomUUID && crypto.randomUUID()) || `hold-${Date.now()}`;
        const r = await fetch('/api/affiliate/hold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
          body: JSON.stringify({ amountUsd: amt }),
        });
        const b = await r.json();
        if (r.ok && b.success) {
          setMsg({ type: 'ok', text: b.duplicate ? 'That hold was already recorded.' : `Hold added — your contract base is now $${b.totalHoldUsd}.` });
          setAmount('');
          refresh();
        } else {
          setMsg({ type: 'err', text: b.error || 'Could not add hold.' });
        }
      } catch {
        setMsg({ type: 'err', text: 'Network error adding the hold.' });
      } finally {
        setBusy(false);
      }
    }
  };

  if (!data) return null;

  return (
    <>
      <header className="aff-page-header">
        <h1 className="aff-page-title">Create Hold</h1>
        <p className="aff-page-sub">Increase your hold to earn higher yields.</p>
      </header>

      <div className="aff-card" style={{ maxWidth: 500 }}>
        {msg.text && (
          <div style={{
            marginBottom: 16, padding: 12, borderRadius: 6, fontSize: 13,
            background: msg.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(255,0,0,0.1)',
            color: msg.type === 'ok' ? '#4ade80' : '#ff4444',
            border: `1px solid ${msg.type === 'ok' ? '#4ade80' : '#ff4444'}`,
          }}>{msg.text}</div>
        )}
        <form onSubmit={handleTopup}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#a1a1aa' }}>Add Amount (USDT)</label>
            <input
              type="number"
              min={minHold}
              step="5"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              style={{ width: '100%', padding: 12, background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 6 }} 
              placeholder="e.g. 50" 
            />
            {amount && data.node.payoutPreference === 'FIAT' ? (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: '#fff', fontSize: 13 }}>Base Amount: ₹{amount * 94}</div>
                <div style={{ color: '#a1a1aa', fontSize: 12 }}>8% Processing Fee: ₹{Math.round(amount * 94 * 0.08)}</div>
                <div style={{ color: '#60a5fa', fontSize: 13, fontWeight: 600, marginTop: 4 }}>Total to Pay: ₹{Math.round(amount * 94 * 1.08)}</div>
              </div>
            ) : amount ? (
              <div style={{ padding: 16, background: '#111', borderRadius: 8, marginTop: 16 }}>
                <div style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 8 }}>Send EXACTLY this amount to:</div>
                {cryptoAddress ? (
                  <div style={{ fontFamily: 'monospace', fontSize: 14, color: '#fff', wordBreak: 'break-all' }}>
                    {cryptoAddress}
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: '#f59e0b', fontWeight: 'bold' }}>
                    {queueMsg || 'Requesting deposit address...'}
                  </div>
                )}
              </div>
            ) : null}
            
            {data.node.payoutPreference === 'FIAT' && Math.round(amount * 94 * 1.08) > maxInr && (
              <div style={{ color: '#ff4444', fontSize: 12, marginTop: 8 }}>
                Transaction limit is ₹{maxInr} for INR (including fee). To deposit more in one shot, please use CRYPTO or create multiple smaller holds.
              </div>
            )}
          </div>
          
          {data.node.payoutPreference === 'FIAT' && amount && Math.round(amount * 94 * 1.08) <= maxInr && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#a1a1aa' }}>Mobile Number (For Invoice)</label>
              <input 
                type="tel" 
                required
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                style={{ width: '100%', padding: 12, background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 6 }} 
                placeholder="e.g. 9876543210" 
              />
            </div>
          )}

          <button
            className="aff-btn"
            style={{ width: '100%' }}
            disabled={busy || !amount || (data.node.payoutPreference === 'FIAT' && Math.round(amount * 94 * 1.08) > maxInr) || (data.node.payoutPreference === 'FIAT' && !mobile)}
          >
            {busy ? 'Processing…' : 'Add to Hold'}
          </button>
        </form>
      </div>
    </>
  );
}
