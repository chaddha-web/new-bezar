"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "../AccountContext";
import CopyButton from "../CopyButton";
import { fmtUsd, fmtInr, fmtDate, shortHash } from "../format";
import { IconExternal } from "../icons";

const TOKENS = ["USDT", "USDC"];

export default function WalletPage() {
  const { data, refresh } = useAccount();
  const { user, node, ledger } = data;

  const [token, setToken] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const withdrawnToDate = ledger
    .filter((l) => l.type === "WITHDRAWAL")
    .reduce((s, l) => s + Math.abs(l.amountUsd), 0);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const amt = Number(amount);

    if (!amt || amt < 25) return setError("Minimum withdrawal is 25 stablecoins ($25).");
    if (amt % 25 !== 0) return setError("Withdrawals must be in increments of 25 stablecoins.");
    if (amt > node.walletUsd) return setError("Amount exceeds your available balance.");

    setBusy(true);
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, amountUsd: amt, tokenSymbol: token }),
      });
      const body = await res.json();
      if (res.ok && body.success) {
        setSuccess(`Payout authorized — ${fmtUsd(body.withdrawnUsd)} ${token} broadcast on BSC (tx ${shortHash(body.bscTxHash)}).`);
        setAmount("");
        refresh();
      } else {
        setError(body.error || "Withdrawal failed.");
      }
    } catch {
      setError("Network error processing the withdrawal.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="acc-topbar">
        <div>
          <div className="acc-eyebrow">Member Console</div>
          <h1 className="acc-page-title">Wallet</h1>
        </div>
        <span className="acc-badge" data-status={node.status}><span className="dot" />{node.status}</span>
      </header>

      <div className="acc-stat-grid">
        <div className="acc-stat feature">
          <div className="acc-stat-label">Available Balance</div>
          <div className="acc-stat-num">{fmtUsd(node.walletUsd)}<span className="unit">USDT</span></div>
          <div className="acc-stat-sub">{fmtInr(node.walletInr)}</div>
        </div>
        <div className="acc-stat">
          <div className="acc-stat-label">Lifetime Earnings</div>
          <div className="acc-stat-num">{fmtUsd(node.earningsUsd)}</div>
          <div className="acc-stat-sub">{fmtInr(node.earningsInr)}</div>
        </div>
        <div className="acc-stat">
          <div className="acc-stat-label">Withdrawn To Date</div>
          <div className="acc-stat-num">{fmtUsd(withdrawnToDate)}</div>
          <div className="acc-stat-sub">Across {ledger.filter((l) => l.type === "WITHDRAWAL").length} payouts</div>
        </div>
      </div>

      <div className="acc-grid-2">
        {/* WITHDRAW */}
        <section className="acc-card">
          <div className="acc-card-head">
            <h2 className="acc-card-title">Request Payout</h2>
            <p className="acc-card-sub">Stablecoins are released to your designated BEP-20 address in increments of 25.</p>
          </div>

          {!node.payoutAddress && (
            <div className="acc-alert err">
              No payout address set. <Link href="/account/deposit" style={{ textDecoration: "underline" }}>Add one</Link> before withdrawing.
            </div>
          )}
          {error && <div className="acc-alert err">{error}</div>}
          {success && <div className="acc-alert ok">{success}</div>}

          <form onSubmit={submit}>
            <div className="acc-field">
              <label className="acc-label">Stablecoin</label>
              <div className="acc-seg">
                {TOKENS.map((t) => (
                  <button type="button" key={t} className={token === t ? "on" : ""} onClick={() => setToken(t)}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="acc-field">
              <label className="acc-label">Amount</label>
              <input
                className="acc-input"
                type="number"
                step="25"
                min="25"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Multiples of 25"
              />
              <span className="acc-hint">25 · 50 · 75 · 100 … · 1 USDT ≈ {fmtInr(94)}</span>
            </div>

            <button className="acc-btn full" type="submit" disabled={busy}>
              {busy ? "Broadcasting…" : `Release ${token} payout`}
            </button>
          </form>
        </section>

        {/* LEDGER */}
        <section className="acc-card flush">
          <div className="acc-card-head">
            <h2 className="acc-card-title">Transaction Ledger</h2>
            <p className="acc-card-sub">Every credit, match, and payout on your node.</p>
          </div>

          {ledger.length === 0 ? (
            <div className="acc-empty">
              <div className="big">Empty ledger</div>
              <p>Commissions and payouts will appear here once your contract is active.</p>
            </div>
          ) : (
            <div className="acc-table-wrap">
              <table className="acc-table">
                <thead>
                  <tr><th>Type</th><th>Amount</th><th>INR</th><th>On-chain</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {ledger.map((l) => (
                    <tr key={l.id}>
                      <td><span className="acc-type" data-t={l.type}>{l.type.replace(/_/g, " ")}</span></td>
                      <td className={l.amountUsd < 0 ? "acc-amt-neg" : "acc-amt-pos"}>
                        {l.amountUsd < 0 ? "−" : "+"}{fmtUsd(Math.abs(l.amountUsd))}
                      </td>
                      <td className={l.amountInr < 0 ? "acc-amt-neg" : "acc-amt-pos"}>
                        {l.amountInr < 0 ? "−" : "+"}{fmtInr(Math.abs(l.amountInr))}
                      </td>
                      <td className="acc-mono" style={{ fontSize: 12 }}>
                        {l.txHash ? (
                          <a className="acc-tx-link" href={`https://bscscan.com/tx/${l.txHash}`} target="_blank" rel="noopener noreferrer">
                            {shortHash(l.txHash, 8, 6)} <IconExternal style={{ verticalAlign: "-1px" }} />
                          </a>
                        ) : (
                          <span className="acc-muted">Internal</span>
                        )}
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
