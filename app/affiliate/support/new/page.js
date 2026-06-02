"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateTicket() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, message })
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/affiliate/support/${data.ticketId}`);
    } else {
      alert(data.error);
      setLoading(false);
    }
  };

  return (
    <>
      <header className="aff-page-header">
        <h1 className="aff-page-title">Create Support Ticket</h1>
        <p className="aff-page-sub">Describe your issue in detail.</p>
      </header>

      <div className="aff-card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#a1a1aa' }}>Subject</label>
            <input 
              type="text" 
              required
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{ width: '100%', padding: 12, background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 6 }} 
              placeholder="E.g. Missing withdrawal"
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 13, color: '#a1a1aa' }}>Message</label>
            <textarea 
              required
              value={message}
              onChange={e => setMessage(e.target.value)}
              style={{ width: '100%', padding: 12, background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 6, minHeight: 150, fontFamily: 'inherit' }} 
              placeholder="Please provide all relevant details..."
            />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="submit" disabled={loading} className="aff-btn">{loading ? 'Submitting...' : 'Submit Ticket'}</button>
            <Link href="/affiliate/support" className="aff-btn" style={{ background: '#27272a', color: '#fff' }}>Cancel</Link>
          </div>
        </form>
      </div>
    </>
  );
}
