"use client";

import { useAffiliate } from "../layout";
import { useState } from "react";

export default function AffiliateNetwork() {
  const { data } = useAffiliate();
  if (!data) return null;
  const { network, node } = data;

  return (
    <>
      <header className="aff-page-header">
        <h1 className="aff-page-title">Track Network</h1>
        <p className="aff-page-sub">Monitor your downline and team growth.</p>
      </header>

      <div className="aff-grid">
        <div className="aff-card">
          <div className="aff-card-label">Direct Legs</div>
          <div className="aff-card-value">{network.directCount}</div>
        </div>
        <div className="aff-card">
          <div className="aff-card-label">Total Team Size</div>
          <div className="aff-card-value">{network.teamCount}</div>
        </div>
        <div className="aff-card">
          <div className="aff-card-label">Group Volume</div>
          <div className="aff-card-value">${network.teamVolumeUsd.toFixed(2)}</div>
        </div>
      </div>

      <div className="aff-card">
        <h3>Direct Downline</h3>
        {network.directs.length === 0 ? (
          <p style={{ color: '#a1a1aa' }}>You have no direct sponsors yet.</p>
        ) : (
          <table style={{ width: '100%', textAlign: 'left', marginTop: 16 }}>
            <thead>
              <tr style={{ color: '#a1a1aa', fontSize: 13, textTransform: 'uppercase' }}>
                <th style={{ padding: '8px 0' }}>Name</th>
                <th>Rank</th>
                <th>Hold</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {network.directs.map(d => (
                <tr key={d.id} style={{ borderTop: '1px solid #27272a' }}>
                  <td style={{ padding: '12px 0' }}>{d.name}<br/><span style={{ fontSize: 12, color: '#a1a1aa' }}>{d.email}</span></td>
                  <td>{d.rank}</td>
                  <td>${d.investmentUsd.toFixed(2)}</td>
                  <td>{new Date(d.joined).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
