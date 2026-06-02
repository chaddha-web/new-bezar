"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function TicketThread() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`/api/support/tickets/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.ticket) {
          setTicket(data.ticket);
          setMessages(data.messages);
        }
        setLoading(false);
      });
  }, [id]);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);

    const res = await fetch(`/api/support/tickets/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: reply })
    });

    if (res.ok) {
      setMessages([...messages, { id: Date.now(), sender_type: 'USER', body: reply, created_at: new Date().toISOString() }]);
      setReply("");
    } else {
      const err = await res.json();
      alert(err.error);
    }
    setSending(false);
  };

  if (loading) return <div style={{ color: '#fff', padding: 40 }}>Loading thread...</div>;
  if (!ticket) return <div style={{ color: '#fff', padding: 40 }}>Ticket not found.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      <header className="aff-page-header" style={{ marginBottom: 20 }}>
        <Link href="/affiliate/support" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: 14, display: 'inline-block', marginBottom: 12 }}>← Back to Support</Link>
        <h1 className="aff-page-title">{ticket.subject}</h1>
        <p className="aff-page-sub">Ticket #{ticket.id} · {ticket.status}</p>
      </header>

      <div className="aff-card" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 20 }}>
        {messages.map(m => {
          const isSupport = m.sender_type === 'SUPPORT';
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isSupport ? 'flex-start' : 'flex-end' }}>
              <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 4 }}>
                {isSupport ? 'Bezar Support' : 'You'} · {new Date(m.created_at).toLocaleString()}
              </div>
              <div style={{ 
                background: isSupport ? '#27272a' : '#fff', 
                color: isSupport ? '#fff' : '#000',
                padding: '12px 16px',
                borderRadius: 8,
                maxWidth: '80%',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5
              }}>
                {m.body}
              </div>
            </div>
          );
        })}
      </div>

      {ticket.status === 'OPEN' ? (
        <form onSubmit={handleReply} style={{ display: 'flex', gap: 12 }}>
          <input 
            type="text" 
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Type your reply here..." 
            style={{ flex: 1, padding: 16, background: '#111', border: '1px solid #333', color: '#fff', borderRadius: 8, fontSize: 15 }} 
          />
          <button type="submit" disabled={sending} className="aff-btn" style={{ padding: '0 32px' }}>
            {sending ? 'Sending...' : 'Reply'}
          </button>
        </form>
      ) : (
        <div style={{ textAlign: 'center', color: '#a1a1aa', padding: 20, background: '#111', borderRadius: 8 }}>
          This ticket is closed.
        </div>
      )}
    </div>
  );
}
