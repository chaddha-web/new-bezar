"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardAffiliate() {
  const [username, setUsername] = useState('');
  const [sponsorUsername, setSponsorUsername] = useState('');
  const [payoutPreference, setPayoutPreference] = useState('CRYPTO');
  const [holdAmount, setHoldAmount] = useState(100);
  const [minHold, setMinHold] = useState(100);
  const [skipHold, setSkipHold] = useState(false);
  const [withdrawalPin, setWithdrawalPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [maxInr, setMaxInr] = useState(30000);
  const [mobile, setMobile] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data.settings && data.settings.MAX_INR_TRANSACTION) {
          setMaxInr(Number(data.settings.MAX_INR_TRANSACTION));
        }
        if (data.settings && data.settings.MIN_HOLD_USD) {
          const m = Number(data.settings.MIN_HOLD_USD);
          setMinHold(m);
          setHoldAmount(prev => (prev < m ? m : prev));
        }
      });
  }, []);

  const handleOnboard = async (e) => {
    e.preventDefault();
    setError('');

    if (!/^\d{4,6}$/.test(withdrawalPin)) {
      setError('Set a withdrawal PIN of 4–6 digits.');
      return;
    }
    if (withdrawalPin !== confirmPin) {
      setError('The two PINs do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/affiliate/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          sponsorUsername,
          currencyPreference: payoutPreference,
          amountUsd: skipHold || payoutPreference === 'FIAT' ? 0 : holdAmount,
          withdrawalPin,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        if (!skipHold && payoutPreference === 'FIAT' && holdAmount > 0) {
          // Open Astro Popup for INR Payment with 8% fee
          const baseInr = holdAmount * 94;
          const fee = Math.round(baseInr * 0.08);
          const totalInr = baseInr + fee;
          const astroUrl = process.env.NEXT_PUBLIC_ASTRO_URL || 'http://localhost:3001';
          const url = `${astroUrl}/?bezar_checkout=true&amountInr=${totalInr}&holdUsd=${holdAmount}&userId=${data.userId}&name=${encodeURIComponent(data.name)}&email=${encodeURIComponent(data.email)}&mobile=${encodeURIComponent(mobile)}`;
          const popup = window.open(url, 'AstroPayment', 'width=500,height=750,left=100,top=100');
          
          // Poll or listen for message
          const handleMessage = async (event) => {
            if (event.origin !== astroUrl) return;
            if (event.data?.type === 'RAZORPAY_SUCCESS') {
              window.removeEventListener('message', handleMessage);
              await fetch('/api/webhooks/astro-success', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId: data.userId,
                  holdUsd: event.data.holdUsd,
                  paymentId: event.data.paymentId,
                  type: 'onboard'
                })
              });
              if (popup) popup.close();
              window.location.href = '/affiliate';
            }
          };
          window.addEventListener('message', handleMessage);
        } else {
          window.location.href = '/affiliate'; 
        }
      } else {
        setError(data.error || 'Failed to onboard');
        setLoading(false);
      }
    } catch (err) {
      setError('An error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="onboard-container">
      <div className="onboard-card">
        <h1>Join the Affiliate Network</h1>
        <p>Complete your profile to start earning.</p>
        
        <form onSubmit={handleOnboard}>
          {error && <div className="error-banner">{error}</div>}

          <div className="input-group">
            <label>Set your Username</label>
            <input 
              type="text" 
              required 
              value={username} 
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="e.g. bezar_star"
            />
          </div>

          <div className="input-group">
            <label>Sponsor Username (Optional)</label>
            <input 
              type="text" 
              value={sponsorUsername} 
              onChange={(e) => setSponsorUsername(e.target.value)}
              placeholder="Who referred you?"
            />
          </div>

          <div className="input-group">
            <label>Payout Preference</label>
            <select value={payoutPreference} onChange={(e) => setPayoutPreference(e.target.value)}>
              <option value="CRYPTO">Crypto (USDT/USDC)</option>
              <option value="FIAT">Indian Rupees (INR)</option>
            </select>
          </div>

          <div className="input-group">
            <label>
              <input 
                type="checkbox" 
                checked={skipHold} 
                onChange={(e) => setSkipHold(e.target.checked)} 
                style={{ marginRight: 8 }}
              />
              Skip initial hold amount for now
            </label>
          </div>

          {!skipHold && (
            <div className="input-group">
              <label>Starting Hold Amount (${minHold} minimum, steps of $5)</label>
              <input
                type="number"
                min={minHold}
                step="5"
                value={holdAmount}
                onChange={(e) => setHoldAmount(Number(e.target.value))}
              />
              
              {payoutPreference === 'FIAT' ? (
                <div className="hint" style={{ marginTop: 8 }}>
                  <div style={{ color: '#fff' }}>Base Amount: ₹{holdAmount * 94}</div>
                  <div style={{ color: '#a1a1aa' }}>8% Processing Fee: ₹{Math.round(holdAmount * 94 * 0.08)}</div>
                  <div style={{ color: '#60a5fa', fontWeight: 600, marginTop: 4 }}>Total to Pay: ₹{Math.round(holdAmount * 94 * 1.08)}</div>
                </div>
              ) : (
                <div className="hint">Equivalent to ₹{holdAmount * 94} INR</div>
              )}
              
              {payoutPreference === 'FIAT' && Math.round(holdAmount * 94 * 1.08) > maxInr && (
                <div style={{ color: '#ff4444', fontSize: 12, marginTop: 8 }}>
                  Transaction limit is ₹{maxInr} for INR (including fee). If you wish to deposit more in one shot, please use CRYPTO or create multiple holds from the dashboard later.
                </div>
              )}
            </div>
          )}

          {!skipHold && payoutPreference === 'FIAT' && holdAmount > 0 && Math.round(holdAmount * 94 * 1.08) <= maxInr && (
            <div className="input-group">
              <label>Mobile Number (For Invoice)</label>
              <input 
                type="tel" 
                required
                placeholder="e.g. 9876543210"
                value={mobile} 
                onChange={(e) => setMobile(e.target.value)}
              />
            </div>
          )}

          <div className="input-group">
            <label>Withdrawal PIN (4–6 digits)</label>
            <input
              type="password"
              required
              inputMode="numeric"
              value={withdrawalPin}
              onChange={(e) => setWithdrawalPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
            />
            <div className="hint">You&apos;ll enter this to authorize every cash-out.</div>
          </div>

          <div className="input-group">
            <label>Confirm Withdrawal PIN</label>
            <input
              type="password"
              required
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading || (payoutPreference === 'FIAT' && (holdAmount * 94) > maxInr && !skipHold)}
            className="btn-primary"
          >
            {loading ? 'Activating...' : 'Activate Affiliate Node'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .onboard-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
          color: #fff;
          font-family: 'Inter', sans-serif;
        }
        .onboard-card {
          width: 100%;
          max-width: 480px;
          background: #111;
          padding: 40px;
          border-radius: 12px;
          border: 1px solid #333;
        }
        h1 { margin-top: 0; font-size: 24px; }
        p { color: #888; margin-bottom: 24px; }
        .input-group {
          margin-bottom: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        label { font-size: 13px; font-weight: 600; color: #ccc; }
        input[type="text"], input[type="number"], input[type="password"], input[type="tel"], select {
          padding: 12px;
          border-radius: 6px;
          border: 1px solid #444;
          background: #222;
          color: #fff;
          font-size: 15px;
        }
        .btn-primary {
          width: 100%;
          padding: 14px;
          border-radius: 6px;
          background: #fff;
          color: #000;
          font-weight: bold;
          font-size: 16px;
          border: none;
          cursor: pointer;
        }
        .btn-primary:hover { background: #eee; }
        .error-banner {
          background: rgba(255,0,0,0.1);
          color: #ff4444;
          padding: 12px;
          border-radius: 6px;
          margin-bottom: 20px;
          border: 1px solid #ff4444;
        }
        .hint { font-size: 12px; color: #666; }
        @media (max-width: 520px) {
          .onboard-container { padding: 16px; align-items: flex-start; }
          .onboard-card { padding: 24px; }
          h1 { font-size: 21px; }
        }
      `}</style>
    </div>
  );
}
