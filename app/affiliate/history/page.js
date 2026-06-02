"use client";

export default function AffiliateHistory() {
  return (
    <>
      <header className="aff-page-header">
        <h1 className="aff-page-title">Watch History</h1>
        <p className="aff-page-sub">Your recent viewing activity.</p>
      </header>

      <div className="aff-card">
        <p style={{ color: '#a1a1aa' }}>You have no watch history available right now.</p>
      </div>
    </>
  );
}
