"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAffiliate } from "../layout";

export default function AffiliateSupport() {
  const { data } = useAffiliate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/support/tickets')
      .then(r => r.json())
      .then(data => {
        if (data.tickets) setTickets(data.tickets);
        setLoading(false);
      });
  }, []);

  if (!data) return null;

  return (
    <>
      <header className="aff-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 className="aff-page-title">Help / Support</h1>
          <p className="aff-page-sub">Manage your support tickets.</p>
        </div>
        <Link href="/affiliate/support/new" className="aff-btn">Create New Ticket</Link>
      </header>

      <div className="aff-card">
        {loading ? (
          <p style={{ color: '#a1a1aa' }}>Loading tickets...</p>
        ) : tickets.length === 0 ? (
          <p style={{ color: '#a1a1aa' }}>You have no open support tickets.</p>
        ) : (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#a1a1aa', fontSize: 13, textTransform: 'uppercase', borderBottom: '1px solid #27272a' }}>
                <th style={{ padding: '12px 0' }}>Subject</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid #27272a' }}>
                  <td style={{ padding: '16px 0', fontWeight: 600 }}>{t.subject}</td>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: 4, 
                      fontSize: 12, 
                      background: t.status === 'OPEN' ? 'rgba(96, 165, 250, 0.1)' : 'rgba(255,255,255,0.1)',
                      color: t.status === 'OPEN' ? '#60a5fa' : '#a1a1aa'
                    }}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ color: '#a1a1aa', fontSize: 14 }}>{new Date(t.updated_at).toLocaleDateString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={`/affiliate/support/${t.id}`} style={{ color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>View Thread →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
