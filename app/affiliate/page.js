"use client";

import { useEffect, useState } from 'react';

export default function AffiliateDashboard() {
  const [loading, setLoading] = useState(true);
  const [node, setNode] = useState(null);
  const [ledger, setLedger] = useState([]);
  
  // Withdrawal Form State
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawCurrency, setWithdrawCurrency] = useState('USDT'); // 'USDT' or 'USDC'
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');
  const [processing, setProcessing] = useState(false);

  // Mock static userId representing the active logged-in viewer
  const mockUserId = 'a34d3ebb-78a2-4ff1-b151-ba7ad4442301'; 

  useEffect(() => {
    fetchAffiliateDetails();
  }, []);

  const fetchAffiliateDetails = async () => {
    try {
      const detailsRes = await fetch(`/api/movies`);
      
      setNode({
        investment_amount_usd: 100.00,
        investment_amount_inr: 9400.00,
        accumulated_earnings_usd: 50.00,
        accumulated_earnings_inr: 4700.00,
        wallet_balance_usd: 50.00,
        wallet_balance_inr: 4700.00,
        node_status: 'ACTIVE',
        accelerator_mode: 'STANDARD',
        current_rank: 'R2',
        bsc_deposit_address: '0xa34d3ebb78a24ff1b151ba7ad4442301deadbeef',
        user_payout_address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'
      });

      setLedger([
        { id: '1', transaction_type: 'YIELD', amount_usd: 0.80, amount_inr: 75.20, bsc_tx_hash: null, created_at: new Date().toISOString(), description: 'Daily passive behavior yield (0.8%)' },
        { id: '2', transaction_type: 'DIRECT_REFERRAL', amount_usd: 5.00, amount_inr: 470.00, bsc_tx_hash: null, created_at: new Date().toISOString(), description: 'Direct referral commission fee (5%)' },
        { id: '3', transaction_type: 'MATCHING_COMMISSION', amount_usd: 2.00, amount_inr: 188.00, bsc_tx_hash: null, created_at: new Date().toISOString(), description: 'R2 upline differential delta match' },
        { id: '4', transaction_type: 'WITHDRAWAL', amount_usd: -25.00, amount_inr: -2350.00, bsc_tx_hash: '0x991c059f00d71c7656ec7ab88b098defb751b7401b5f6d8976fdeadbeef', created_at: new Date().toISOString(), description: 'Outbound payout authorized' }
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawSuccess('');
    
    const amount = Number(withdrawAmount);

    if (amount < 25) {
      setWithdrawError('Minimum authorized threshold is 25 Stablecoins ($25 USD).');
      return;
    }
    if (amount % 25 !== 0) {
      setWithdrawError('Withdrawals are restricted exclusively to absolute increments of 25 Stablecoins.');
      return;
    }

    setProcessing(true);

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: mockUserId, amountUsd: amount, tokenSymbol: withdrawCurrency })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setWithdrawSuccess(`Authorized! Successfully withdrew ${data.withdrawnUsd} BEP-20 ${withdrawCurrency}. TxHash: ${data.bscTxHash.substring(0, 16)}...`);
        setWithdrawAmount('');
        
        setNode(prev => ({
          ...prev,
          wallet_balance_usd: Number(prev.wallet_balance_usd) - data.withdrawnUsd,
          wallet_balance_inr: Number(prev.wallet_balance_inr) - data.withdrawnInr
        }));

        setLedger(prev => [
          {
            id: Date.now().toString(),
            transaction_type: 'WITHDRAWAL',
            amount_usd: -data.withdrawnUsd,
            amount_inr: -data.withdrawnInr,
            bsc_tx_hash: data.bscTxHash,
            created_at: new Date().toISOString(),
            description: `Outbound payout of ${data.withdrawnUsd} ${withdrawCurrency} authorized`
          },
          ...prev
        ]);
      } else {
        setWithdrawError(data.error || 'Withdrawal authorization failed');
      }
    } catch (err) {
      setWithdrawError('Network error processing withdrawal request');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="affiliate-loading">Connecting to Web3 Wallet Engine...</div>;
  }

  const maxCapUsd = Number(node?.investment_amount_usd || 100) * 2.5;
  const progressPercent = Math.min(((Number(node?.accumulated_earnings_usd || 0) / maxCapUsd) * 100), 100);

  return (
    <main className="affiliate-layout">
      {/* HEADER BANNER */}
      <header className="affiliate-header">
        <h1 className="logo-title">BEZAR <span>Affiliate Network</span></h1>
        <div className="status-badge" data-status={node?.node_status}>{node?.node_status}</div>
      </header>

      {/* WEB3 WALLET ADDR ROW */}
      <section className="web3-info-row">
        <div className="web3-addr-card">
          <h4>Your Unique BEP-20 Deposit Depot (Send USDT/USDC here to activate)</h4>
          <code className="crypto-address">{node?.bsc_deposit_address}</code>
          <span className="net-tag">BNB Smart Chain (BSC)</span>
        </div>
        <div className="web3-addr-card">
          <h4>Designated Payout Destination Address</h4>
          <code className="crypto-address">{node?.user_payout_address}</code>
          <span className="net-tag">USDT/USDC Smart Contract</span>
        </div>
      </section>

      {/* METRICS DASHBOARD ROW */}
      <section className="metrics-row" style={{ marginTop: '20px' }}>
        <div className="metric-box">
          <h4>Active Rank</h4>
          <h2>{node?.current_rank}</h2>
          <p>Qualifying Volume Tier</p>
        </div>
        <div className="metric-box">
          <h4>Earnings Ceiling (2.5x Cap)</h4>
          <h2>
            {node?.accumulated_earnings_usd} <span className="cap-label">/ {maxCapUsd} Stablecoins</span>
            <div style={{ fontSize: '14px', color: '#a1a1aa', marginTop: '4px' }}>
              Value: ₹{node?.accumulated_earnings_inr} / ₹{maxCapUsd * 94} INR
            </div>
          </h2>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
        <div className="metric-box highlighted-box">
          <h4>Available Wallet Balance</h4>
          <h2>{Number(node?.wallet_balance_usd).toFixed(2)} Stablecoins</h2>
          <div style={{ fontSize: '15px', color: '#a1a1aa', fontWeight: '600', marginTop: '4px' }}>
            Value: ₹{node?.wallet_balance_inr} INR
          </div>
          <p style={{ marginTop: '10px' }}>Residual Floats Retained</p>
        </div>
      </section>

      {/* MAIN LAYOUT SPLIT */}
      <div className="affiliate-grid">
        {/* WITHDRAW WIDGET */}
        <section className="affiliate-card form-card">
          <h3>Payout Request Portal</h3>
          <p className="card-subtitle">Authorize transfers to registered accounts. Payments are processed in set incremental pools.</p>

          <form onSubmit={handleWithdraw} className="withdraw-form">
            {withdrawError && <div className="alert alert-error">{withdrawError}</div>}
            {withdrawSuccess && <div className="alert alert-success">{withdrawSuccess}</div>}

            <div className="form-group">
              <label>Select Stablecoin Asset</label>
              <select 
                value={withdrawCurrency} 
                onChange={(e) => {
                  setWithdrawCurrency(e.target.value);
                  setWithdrawAmount('');
                  setWithdrawError('');
                }}
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#fff',
                  fontSize: '14px',
                  marginBottom: '10px'
                }}
              >
                <option value="USDT">BEP-20 USDT (BSC)</option>
                <option value="USDC">BEP-20 USDC (BSC)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Withdrawal Amount (Stablecoins)</label>
              <input
                type="number"
                required
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Must be multiples of 25"
              />
              <span className="step-hint">
                Increments: 25 · 50 · 75 · 100 etc. (Equivalent to ₹2,350 increments)
              </span>
            </div>

            <button type="submit" disabled={processing} className="withdraw-submit-btn">
              {processing ? 'Broadcasting BSC Payout...' : 'Release BEP-20 Payout'}
            </button>
          </form>
        </section>

        {/* LEDGER LOGGER */}
        <section className="affiliate-card table-card">
          <h3>Transaction Ledgers</h3>
          <p className="card-subtitle">Complete real-time accounting audits of network commissions, delta matches, and payouts.</p>

          <div className="table-container">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Value (Stablecoins)</th>
                  <th>Equivalent (INR)</th>
                  <th>Blockchain Audit (BscScan)</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id}>
                    <td className="bold-td">
                      <span className="type-pill" data-type={l.transaction_type}>
                        {l.transaction_type}
                      </span>
                    </td>
                    <td className={l.amount_usd < 0 ? 'negative-amt' : 'positive-amt'}>
                      {l.amount_usd < 0 ? '-' : '+'}{(Math.abs(Number(l.amount_usd))).toFixed(2)}
                    </td>
                    <td className={l.amount_inr < 0 ? 'negative-amt' : 'positive-amt'}>
                      {l.amount_inr < 0 ? '-' : '+'}₹{Math.abs(Number(l.amount_inr)).toFixed(2)}
                    </td>
                    <td className="desc-td" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                      {l.bsc_tx_hash ? (
                        <a 
                          href={`https://bscscan.com/tx/${l.bsc_tx_hash}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: '#60a5fa', textDecoration: 'underline' }}
                        >
                          {l.bsc_tx_hash.substring(0, 14)}...
                        </a>
                      ) : (
                        <span style={{ color: '#52525b' }}>Internal Ledger</span>
                      )}
                    </td>
                    <td className="date-td">{new Date(l.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <style jsx global>{`
        .affiliate-layout {
          min-height: 100vh;
          background: radial-gradient(circle at top, #121217 0%, #070709 100%);
          font-family: 'Inter', -apple-system, sans-serif;
          color: #fff;
          padding: 40px;
        }

        .affiliate-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 24px;
          margin-bottom: 30px;
        }

        .logo-title {
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 4px;
          margin: 0;
        }

        .logo-title span {
          font-size: 13px;
          color: #a1a1aa;
          letter-spacing: 1px;
          text-transform: uppercase;
          border-left: 1px solid rgba(255, 255, 255, 0.2);
          margin-left: 12px;
          padding-left: 12px;
        }

        .status-badge {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #22c55e;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          padding: 6px 14px;
          border-radius: 20px;
        }

        .status-badge[data-status="EXPIRED"] {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        .web3-info-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        @media (max-width: 768px) {
          .web3-info-row {
            grid-template-columns: 1fr;
          }
        }

        .web3-addr-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .web3-addr-card h4 {
          font-size: 11px;
          text-transform: uppercase;
          color: #a1a1aa;
          margin: 0;
          letter-spacing: 0.5px;
        }

        .crypto-address {
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          color: #60a5fa;
          background: rgba(0, 0, 0, 0.3);
          padding: 8px 12px;
          border-radius: 6px;
          word-break: break-all;
        }

        .net-tag {
          align-self: flex-start;
          font-size: 9px;
          font-weight: 800;
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
          padding: 3px 8px;
          border-radius: 4px;
        }

        .metrics-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          margin-bottom: 40px;
        }

        .metric-box {
          background: rgba(20, 20, 25, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 24px;
          backdrop-filter: blur(10px);
        }

        .metric-box h4 {
          color: #a1a1aa;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 12px 0;
        }

        .metric-box h2 {
          font-size: 30px;
          font-weight: 800;
          margin: 0 0 6px 0;
        }

        .cap-label {
          font-size: 16px;
          color: #52525b;
          font-weight: 500;
        }

        .metric-box p {
          margin: 0;
          font-size: 12px;
          color: #a1a1aa;
        }

        .highlighted-box {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .progress-track {
          height: 6px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 15px;
        }

        .progress-fill {
          height: 100%;
          background: #fff;
          border-radius: 3px;
        }

        .affiliate-grid {
          display: grid;
          grid-template-columns: 1fr 1.5fr;
          gap: 30px;
        }

        @media (max-width: 1024px) {
          .affiliate-grid {
            grid-template-columns: 1fr;
          }
        }

        .affiliate-card {
          background: rgba(20, 20, 25, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 18px;
          padding: 30px;
          backdrop-filter: blur(10px);
        }

        .affiliate-card h3 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 6px 0;
        }

        .card-subtitle {
          color: #a1a1aa;
          font-size: 13px;
          margin: 0 0 24px 0;
          line-height: 1.5;
        }

        .withdraw-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .alert {
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 13px;
          line-height: 1.4;
        }

        .alert-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.25);
          color: #ef4444;
        }

        .alert-success {
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.25);
          color: #22c55e;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #a1a1aa;
        }

        .form-group input {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 14px;
          color: #fff;
          font-size: 15px;
          transition: all 0.2s;
        }

        .form-group input:focus {
          outline: none;
          border-color: #fff;
        }

        .step-hint {
          font-size: 11px;
          color: #52525b;
        }

        .withdraw-submit-btn {
          background: #fff;
          color: #000;
          border: none;
          border-radius: 8px;
          padding: 15px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .withdraw-submit-btn:hover {
          background: #e4e4e7;
        }

        .withdraw-submit-btn:disabled {
          background: #27272a;
          color: #71717a;
          cursor: not-allowed;
        }

        .table-container {
          overflow-x: auto;
        }

        .ledger-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }

        .ledger-table th {
          color: #a1a1aa;
          font-weight: 500;
          padding: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ledger-table td {
          padding: 14px 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }

        .type-pill {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          padding: 4px 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.08);
          color: #a1a1aa;
        }

        .type-pill[data-type="YIELD"] {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .type-pill[data-type="DIRECT_REFERRAL"] {
          background: rgba(168, 85, 247, 0.1);
          color: #a855f7;
        }

        .type-pill[data-type="MATCHING_COMMISSION"] {
          background: rgba(245, 158, 11, 0.1);
          color: #f59e0b;
        }

        .type-pill[data-type="WITHDRAWAL"] {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }

        .positive-amt {
          color: #22c55e;
          font-weight: 600;
        }

        .negative-amt {
          color: #ef4444;
          font-weight: 600;
        }

        .desc-td {
          color: #d1d1d6;
        }

        .date-td {
          color: #52525b;
        }

        .affiliate-loading {
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #070709;
          color: #a1a1aa;
          font-size: 15px;
          letter-spacing: 1px;
        }
      `}</style>
    </main>
  );
}
