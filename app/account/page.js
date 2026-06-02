"use client";

import Link from "next/link";
import { useAccount } from "./AccountContext";
import { fmtUsd, fmtInr, fmtDate } from "./format";

export default function OverviewPage() {
  const { data } = useAccount();
  const { user, node, ledger, network } = data;

  const maxCapUsd = node.investmentUsd * 2.5;
  const capPct = maxCapUsd > 0 ? Math.min((node.earningsUsd / maxCapUsd) * 100, 100) : 0;
  const recent = ledger.slice(0, 5);

  return (
    <>
      <header className="acc-topbar">
        <div>
          <div className="acc-eyebrow">Member Console</div>
          <h1 className="acc-page-title">Overview</h1>
        </div>
        <div className="acc-topbar-meta">
          <span className="acc-rank">{node.rank}</span>
          <span className="acc-badge" data-status={node.status}>
            <span className="dot" />{node.status}
          </span>
          <div className="acc-user-pill">
            <div className="nm">{user.name || "Viewer"}</div>
            <div className="em">{user.email}</div>
          </div>
        </div>
      </header>

      {/* KEY FIGURES */}
      <div className="acc-stat-grid">
        <div className="acc-stat feature">
          <div className="acc-stat-label">Available Balance</div>
          <div className="acc-stat-num">{fmtUsd(node.walletUsd)}<span className="unit">USDT</span></div>
          <div className="acc-stat-sub">{fmtInr(node.walletInr)}</div>
        </div>
        <div className="acc-stat">
          <div className="acc-stat-label">Total Earnings</div>
          <div className="acc-stat-num">{fmtUsd(node.earningsUsd)}</div>
          <div className="acc-stat-sub">of {fmtUsd(maxCapUsd, { whole: true })} cap (2.5×)</div>
        </div>
        <div className="acc-stat">
          <div className="acc-stat-label">Active Contract</div>
          <div className="acc-stat-num">{fmtUsd(node.investmentUsd, { whole: true })}<span className="unit">pack</span></div>
          <div className="acc-stat-sub">{fmtInr(node.investmentInr)}</div>
        </div>
        <div className="acc-stat">
          <div className="acc-stat-label">Team Size</div>
          <div className="acc-stat-num">{network.teamCount}</div>
          <div className="acc-stat-sub">{network.directCount} direct {network.directCount === 1 ? "leg" : "legs"}</div>
        </div>
      </div>

      <div className="acc-grid-2">
        {/* EARNINGS CEILING */}
        <section className="acc-card">
          <div className="acc-card-head">
            <h2 className="acc-card-title">Earnings Ceiling</h2>
            <p className="acc-card-sub">Each contract earns up to 2.5× its value before it must be renewed.</p>
          </div>
          <div className="acc-stat-num" style={{ fontSize: 40 }}>
            {fmtUsd(node.earningsUsd)}<span className="unit">/ {fmtUsd(maxCapUsd, { whole: true })}</span>
          </div>
          <div className="acc-progress"><div className="fill" style={{ width: `${capPct}%` }} /></div>
          <p className="acc-card-sub" style={{ marginTop: 14 }}>
            {capPct >= 100
              ? "Cap reached — renew your contract to keep earning."
              : `${capPct.toFixed(1)}% of ceiling used · ${fmtInr(node.earningsInr)} earned`}
          </p>
          <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
            <Link href="/account/wallet" className="acc-btn">Withdraw</Link>
            <Link href="/account/deposit" className="acc-btn-ghost">Top up contract</Link>
          </div>
        </section>

        {/* RECENT ACTIVITY */}
        <section className="acc-card flush">
          <div className="acc-card-head">
            <h2 className="acc-card-title">Recent Activity</h2>
            <p className="acc-card-sub">Latest commissions, yields, and payouts on your node.</p>
          </div>
          {recent.length === 0 ? (
            <div className="acc-empty">
              <div className="big">No activity yet</div>
              <p>Activate a contract and start referring to see commissions land here.</p>
            </div>
          ) : (
            <div className="acc-table-wrap">
              <table className="acc-table">
                <thead>
                  <tr><th>Type</th><th>Amount</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {recent.map((l) => (
                    <tr key={l.id}>
                      <td><span className="acc-type" data-t={l.type}>{l.type.replace(/_/g, " ")}</span></td>
                      <td className={l.amountUsd < 0 ? "acc-amt-neg" : "acc-amt-pos"}>
                        {l.amountUsd < 0 ? "−" : "+"}{fmtUsd(Math.abs(l.amountUsd))}
                      </td>
                      <td className="acc-muted">{fmtDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
