"use client";

import { useState } from "react";
import { useAccount } from "../AccountContext";
import CopyButton from "../CopyButton";
import { fmtUsd } from "../format";

const TOKENS = ["USDT", "USDC"];

export default function DepositPage() {
  const { data, refresh } = useAccount();
  const { node } = data;

  // Activation (verify on-chain deposit)
  const [token, setToken] = useState("USDT");
  const [txHash, setTxHash] = useState("");
  const [actErr, setActErr] = useState("");
  const [actOk, setActOk] = useState("");
  const [actBusy, setActBusy] = useState(false);

  // Payout address
  const [payout, setPayout] = useState(node.payoutAddress || "");
  const [payErr, setPayErr] = useState("");
  const [payOk, setPayOk] = useState("");
  const [payBusy, setPayBusy] = useState(false);

  const activate = async (e) => {
    e.preventDefault();
    setActErr("");
    setActOk("");
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash.trim())) {
      return setActErr("Enter a valid BSC transaction hash (0x… 66 characters).");
    }
    setActBusy(true);
    try {
      const res = await fetch("/api/web3/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id, bscTxHash: txHash.trim(), tokenSymbol: token }),
      });
      const body = await res.json();
      if (res.ok && body.success) {
        setActOk(`Confirmed — ${fmtUsd(body.value, { whole: true })} ${token} contract ${body.isRenewal ? "renewed" : "activated"}.`);
        setTxHash("");
        refresh();
      } else {
        setActErr(body.error || "Deposit verification failed.");
      }
    } catch {
      setActErr("Network error verifying the deposit.");
    } finally {
      setActBusy(false);
    }
  };

  const savePayout = async (e) => {
    e.preventDefault();
    setPayErr("");
    setPayOk("");
    if (!/^0x[a-fA-F0-9]{40}$/.test(payout.trim())) {
      return setPayErr("Enter a valid BEP-20 address (0x… 42 characters).");
    }
    setPayBusy(true);
    try {
      const res = await fetch("/api/affiliate/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutAddress: payout.trim() }),
      });
      const body = await res.json();
      if (res.ok && body.success) {
        setPayOk("Payout address saved.");
        refresh();
      } else {
        setPayErr(body.error || "Could not save payout address.");
      }
    } catch {
      setPayErr("Network error saving the address.");
    } finally {
      setPayBusy(false);
    }
  };

  return (
    <>
      <header className="acc-topbar">
        <div>
          <div className="acc-eyebrow">Member Console</div>
          <h1 className="acc-page-title">Deposit</h1>
        </div>
        <span className="acc-badge" data-status={node.status}><span className="dot" />{node.status}</span>
      </header>

      <div className="acc-grid-2">
        {/* DEPOSIT DEPOT */}
        <section className="acc-card">
          <div className="acc-card-head">
            <h2 className="acc-card-title">Your Deposit Address</h2>
            <p className="acc-card-sub">Send <strong>BEP-20 USDT or USDC</strong> on BNB Smart Chain (minimum 100) to activate or top up your contract.</p>
          </div>

          <label className="acc-label" style={{ marginBottom: 8, display: "block" }}>BSC Depot — BNB Smart Chain</label>
          <div className="acc-copy-row" style={{ marginBottom: 18 }}>
            <code className="acc-address">{node.depositAddress}</code>
            <CopyButton text={node.depositAddress} />
          </div>

          <ol style={{ paddingLeft: 18, color: "var(--ash)", fontSize: 13, lineHeight: 1.9 }}>
            <li>Send ≥ 100 USDT/USDC (BEP-20) to the address above.</li>
            <li>Wait for 12 block confirmations.</li>
            <li>Paste the transaction hash on the right to credit your node.</li>
          </ol>
        </section>

        {/* ACTIVATE */}
        <section className="acc-card">
          <div className="acc-card-head">
            <h2 className="acc-card-title">Confirm Deposit</h2>
            <p className="acc-card-sub">Verify your on-chain transfer to activate the contract instantly.</p>
          </div>

          {actErr && <div className="acc-alert err">{actErr}</div>}
          {actOk && <div className="acc-alert ok">{actOk}</div>}

          <form onSubmit={activate}>
            <div className="acc-field">
              <label className="acc-label">Token Sent</label>
              <div className="acc-seg">
                {TOKENS.map((t) => (
                  <button type="button" key={t} className={token === t ? "on" : ""} onClick={() => setToken(t)}>{t}</button>
                ))}
              </div>
            </div>
            <div className="acc-field">
              <label className="acc-label">Transaction Hash</label>
              <input className="acc-input acc-mono" value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x…" />
              <span className="acc-hint">The BscScan tx hash of your transfer.</span>
            </div>
            <button className="acc-btn full" type="submit" disabled={actBusy}>
              {actBusy ? "Verifying on-chain…" : "Verify & activate"}
            </button>
          </form>
        </section>
      </div>

      {/* PAYOUT ADDRESS */}
      <section className="acc-card acc-section" style={{ marginTop: 28 }}>
        <div className="acc-card-head">
          <h2 className="acc-card-title">Payout Address</h2>
          <p className="acc-card-sub">Where your withdrawals are sent. Must be a BEP-20 address you control.</p>
        </div>

        {payErr && <div className="acc-alert err">{payErr}</div>}
        {payOk && <div className="acc-alert ok">{payOk}</div>}

        <form onSubmit={savePayout} style={{ maxWidth: 640 }}>
          <div className="acc-field">
            <label className="acc-label">Destination (USDT/USDC · BSC)</label>
            <input className="acc-input acc-mono" value={payout} onChange={(e) => setPayout(e.target.value)} placeholder="0x…" />
          </div>
          <button className="acc-btn" type="submit" disabled={payBusy}>
            {payBusy ? "Saving…" : node.payoutAddress ? "Update address" : "Save address"}
          </button>
        </form>
      </section>
    </>
  );
}
