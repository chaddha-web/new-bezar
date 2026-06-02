"use client";

import { useAffiliate } from "./layout";

export default function AffiliateDashboard() {
  const { data } = useAffiliate();
  
  if (!data) return null;
  const { user, node, network } = data;

  return (
    <>
      <header className="aff-page-header">
        <h1 className="aff-page-title">Welcome back, {user.name}</h1>
        <p className="aff-page-sub">@{node.username} · Affiliate Rank: {node.rank}</p>
      </header>

      <div className="aff-grid">
        <div className="aff-card aff-card-highlight">
          <div className="aff-card-label">Withdrawable Balance</div>
          <div className="aff-card-value">${node.walletUsd.toFixed(2)}</div>
          <div className="aff-card-sub">≈ ₹{node.walletInr.toFixed(2)} INR</div>
        </div>
        
        <div className="aff-card">
          <div className="aff-card-label">Total Earnings</div>
          <div className="aff-card-value">${node.earningsUsd.toFixed(2)}</div>
          <div className="aff-card-sub">Since joining</div>
        </div>

        <div className="aff-card">
          <div className="aff-card-label">Active Hold</div>
          <div className="aff-card-value">${node.investmentUsd.toFixed(2)}</div>
          <div className="aff-card-sub">Generating daily yield</div>
        </div>
      </div>

      <div className="aff-grid">
        <div className="aff-card">
          <div className="aff-card-label">Network Size</div>
          <div className="aff-card-value">{network.teamCount}</div>
          <div className="aff-card-sub">{network.directCount} direct sponsors</div>
        </div>
        
        <div className="aff-card">
          <div className="aff-card-label">Group Volume</div>
          <div className="aff-card-value">${network.teamVolumeUsd.toFixed(2)}</div>
          <div className="aff-card-sub">Total team investment</div>
        </div>
      </div>

      <div className="aff-card" style={{ marginTop: 24 }}>
        <h3>Your Referral Link</h3>
        <p style={{ color: '#a1a1aa', fontSize: 14, marginBottom: 16 }}>Share this link to grow your network and earn direct commissions.</p>
        <code style={{ background: '#000', padding: '12px 16px', borderRadius: 6, display: 'block', color: '#60a5fa', border: '1px solid #27272a' }}>
          https://bezar.in/signup?sponsor={node.username}
        </code>
      </div>
    </>
  );
}
