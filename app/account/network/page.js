"use client";

import { useSyncExternalStore } from "react";
import { useAccount } from "../AccountContext";
import CopyButton from "../CopyButton";
import { fmtUsd, fmtInr, fmtDate, initials } from "../format";

// Read the browser origin without a hydration mismatch or setState-in-effect.
const subscribe = () => () => {};
const getOrigin = () => window.location.origin;
const getServerOrigin = () => "";

export default function NetworkPage() {
  const { data } = useAccount();
  const { user, node, network } = data;

  const origin = useSyncExternalStore(subscribe, getOrigin, getServerOrigin);
  const refLink = origin ? `${origin}/signup?ref=${user.id}` : "";

  return (
    <>
      <header className="acc-topbar">
        <div>
          <div className="acc-eyebrow">Member Console</div>
          <h1 className="acc-page-title">Network</h1>
        </div>
        <div className="acc-topbar-meta">
          <span className="acc-rank">{node.rank}</span>
          <span className="acc-badge" data-status={node.status}><span className="dot" />{node.status}</span>
        </div>
      </header>

      <div className="acc-stat-grid">
        <div className="acc-stat feature">
          <div className="acc-stat-label">Current Rank</div>
          <div className="acc-stat-num">{node.rank}</div>
          <div className="acc-stat-sub">Differential matching tier</div>
        </div>
        <div className="acc-stat">
          <div className="acc-stat-label">Direct Legs</div>
          <div className="acc-stat-num">{network.directCount}</div>
          <div className="acc-stat-sub">Personally sponsored</div>
        </div>
        <div className="acc-stat">
          <div className="acc-stat-label">Total Team</div>
          <div className="acc-stat-num">{network.teamCount}</div>
          <div className="acc-stat-sub">Across all downlines</div>
        </div>
        <div className="acc-stat">
          <div className="acc-stat-label">Group Volume</div>
          <div className="acc-stat-num">{fmtUsd(network.teamVolumeUsd, { whole: true })}<span className="unit">USDT</span></div>
          <div className="acc-stat-sub">{fmtInr(network.teamVolumeUsd * 94)}</div>
        </div>
      </div>

      {/* REFERRAL LINK */}
      <section className="acc-card acc-section">
        <div className="acc-card-head">
          <h2 className="acc-card-title">Your Invite Link</h2>
          <p className="acc-card-sub">Anyone who signs up through this link is placed directly on your first level.</p>
        </div>
        <div className="acc-copy-row">
          <code className="acc-address">{refLink || "Generating…"}</code>
          <CopyButton text={refLink} />
        </div>
      </section>

      {/* DIRECT DOWNLINE */}
      <section className="acc-card flush">
        <div className="acc-card-head">
          <h2 className="acc-card-title">Direct Downline</h2>
          <p className="acc-card-sub">Members you personally sponsored.</p>
        </div>

        {network.directs.length === 0 ? (
          <div className="acc-empty">
            <div className="big">No referrals yet</div>
            <p>Share your invite link above. Each direct sponsor activation pays you a flat 5% commission.</p>
          </div>
        ) : (
          <div>
            {network.directs.map((d) => (
              <div className="acc-leg" key={d.id}>
                <div className="acc-avatar">{initials(d.name)}</div>
                <div className="acc-leg-body">
                  <div className="acc-leg-name">{d.name || "Viewer"}</div>
                  <div className="acc-leg-meta">{d.email} · joined {fmtDate(d.joined)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span className="acc-badge" data-status={d.status} style={{ fontSize: 10 }}>{d.status}</span>
                  <div className="acc-leg-amt">{fmtUsd(d.investmentUsd, { whole: true })} <span className="acc-muted" style={{ fontWeight: 400 }}>USDT</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
