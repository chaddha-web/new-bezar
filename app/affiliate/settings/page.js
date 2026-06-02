"use client";

import { useAffiliate } from "../layout";

export default function AffiliateSettings() {
  const { data } = useAffiliate();
  if (!data) return null;

  return (
    <>
      <header className="aff-page-header">
        <h1 className="aff-page-title">Settings / Profile</h1>
        <p className="aff-page-sub">Manage your affiliate account.</p>
      </header>

      <div className="aff-card" style={{ maxWidth: 600 }}>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#a1a1aa' }}>Username</label>
          <input type="text" disabled value={data.node.username} style={{ width: '100%', padding: 12, background: '#111', border: '1px solid #333', color: '#888', borderRadius: 6 }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#a1a1aa' }}>Payout Preference</label>
          <input type="text" disabled value={data.node.payoutPreference} style={{ width: '100%', padding: 12, background: '#111', border: '1px solid #333', color: '#888', borderRadius: 6 }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#a1a1aa' }}>Payout Wallet Address</label>
          <input type="text" defaultValue={data.node.payoutAddress || ''} placeholder="0x..." style={{ width: '100%', padding: 12, background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 6 }} />
        </div>
        <button className="aff-btn">Save Changes</button>
      </div>
    </>
  );
}
