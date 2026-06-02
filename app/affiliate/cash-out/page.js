"use client";

import { useState } from "react";
import { useAffiliate } from "../layout";

export default function AffiliateCashOut() {
  const { data, refresh } = useAffiliate();
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDT");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data) return null;
  const { node } = data;

  const inputStyle = { width: "100%", padding: 12, background: "#111", border: "1px solid #333", color: "#fff", borderRadius: 6 };
  const labelStyle = { display: "block", marginBottom: 8, fontSize: 13, color: "#a1a1aa" };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const amt = Number(amount);
    if (!amt || amt < 25) return setError("Minimum cash-out is $25.");
    if (amt % 25 !== 0) return setError("Cash-outs must be in increments of $25.");
    if (amt > node.walletUsd) return setError("Amount exceeds your available balance.");
    if (!/^\d{4,6}$/.test(pin)) return setError("Enter your 4–6 digit withdrawal PIN.");

    setBusy(true);
    try {
      const key = (crypto?.randomUUID && crypto.randomUUID()) || `wd-${Date.now()}`;
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({ amountUsd: amt, tokenSymbol: token, pin }),
      });
      const body = await res.json();
      if (res.ok && body.success) {
        setSuccess(`Payout authorized — $${body.withdrawnUsd} ${token} broadcast on BSC.`);
        setAmount("");
        setPin("");
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
      <header className="aff-page-header">
        <h1 className="aff-page-title">Cash Out</h1>
        <p className="aff-page-sub">Withdraw your affiliate earnings.</p>
      </header>

      <div className="aff-card" style={{ maxWidth: 500 }}>
        <div className="aff-card-label">Available Balance</div>
        <div className="aff-card-value" style={{ marginBottom: 24 }}>${node.walletUsd.toFixed(2)}</div>

        {!node.hasWithdrawalPin && (
          <div style={{ background: "rgba(255,180,0,0.1)", color: "#fbbf24", border: "1px solid #fbbf24", padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
            No withdrawal PIN on file — finish affiliate onboarding to set one.
          </div>
        )}
        {error && <div style={{ background: "rgba(255,0,0,0.1)", color: "#ff4444", border: "1px solid #ff4444", padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>{error}</div>}
        {success && <div style={{ background: "rgba(34,197,94,0.1)", color: "#4ade80", border: "1px solid #4ade80", padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>{success}</div>}

        <form onSubmit={submit}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Amount (multiples of $25)</label>
            <input type="number" min="25" step="25" value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} placeholder="0.00" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Stablecoin</label>
            <select value={token} onChange={(e) => setToken(e.target.value)} style={inputStyle}>
              <option value="USDT">USDT</option>
              <option value="USDC">USDC</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Withdrawal PIN</label>
            <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} style={inputStyle} placeholder="••••" />
          </div>
          <button className="aff-btn" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Processing…" : "Request Withdrawal"}
          </button>
        </form>
      </div>
    </>
  );
}
