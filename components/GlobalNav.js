"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
);

const IconChevronLeft = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
);

export default function GlobalNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        // ignore
      }
    };
    fetchSession();
  }, []);

  const isHome = pathname === "/";

  // When not on home, the navbar gets a solid background so it doesn't clash with content
  const navStyle = isHome ? {} : { background: 'var(--bg-card)', borderBottom: '1px solid rgba(255,255,255,0.05)' };

  return (
    <>
      {/* ═══════ UTILITY BAR ═══════ */}
      <div className="utility-bar" style={isHome ? {} : { background: '#0a0a0c' }}>
        {user ? (
          <>
            <span style={{ color: '#a1a1aa' }} className="hide-mobile">Welcome, <strong>{user.name}</strong> ({user.plan})</span>
            <span className="sep hide-mobile">|</span>
            <Link href="/affiliate" style={{ color: '#60a5fa', fontWeight: 'bold' }}>Affiliate Network</Link>
            <span className="sep">|</span>
            <Link href="/subscription" style={{ color: '#f59e0b' }}>Pricing</Link>
            <span className="sep">|</span>
            <button 
              onClick={async () => {
                await fetch('/api/auth/me', { method: 'DELETE' });
                window.location.reload();
              }}
              style={{ background: 'transparent', border: 'none', color: '#a1a1aa', cursor: 'pointer', padding: 0 }}
            >
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link href="/login">Viewer Login</Link>
            <span className="sep">|</span>
            <Link href="/signup">Sign Up</Link>
            <span className="sep">|</span>
            <Link href="/login" style={{ color: '#ef4444' }}>CMS Admin Center</Link>
          </>
        )}
      </div>

      {/* ═══════ PRIMARY NAV ═══════ */}
      <nav className="primary-nav" style={navStyle}>
        {!isHome && (
          <button 
            className="btn-icon" 
            onClick={() => router.push('/')}
            style={{ marginRight: '16px', color: '#fff' }}
            aria-label="Back to Home"
          >
            <IconChevronLeft />
          </button>
        )}

        <button
          className={`nav-hamburger ${drawerOpen ? "open" : ""}`}
          onClick={() => setDrawerOpen(!drawerOpen)}
          aria-label="Menu"
        >
          <span />
        </button>

        <Link href="/" className="nav-brand">Bezar</Link>

        {isHome ? (
          <div className="nav-links">
            <Link href="/" className="active">Home</Link>
            <a href="#live-news">Live News</a>
            <Link href="/affiliate">Affiliate Portal</Link>
            <Link href="/subscription">Subscriptions</Link>
            <Link href="/admin">Control Center</Link>
          </div>
        ) : (
          <div className="nav-links">
            <Link href="/">Back to Home</Link>
          </div>
        )}

        <div className="nav-right">
          <div className="search-pill">
            <IconSearch />
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                router.push('/?q=' + encodeURIComponent(e.target.value));
              }}
              id="search-input"
            />
          </div>
        </div>
      </nav>

      {/* ═══════ MOBILE DRAWER ═══════ */}
      <div className={`mobile-drawer ${drawerOpen ? "open" : ""}`}>
        <Link href="/" onClick={() => setDrawerOpen(false)}>Home</Link>
        {isHome && <a href="#live-news" onClick={() => setDrawerOpen(false)}>Live News</a>}
        <Link href="/subscription" onClick={() => setDrawerOpen(false)}>Subscriptions</Link>
        <Link href="/affiliate" onClick={() => setDrawerOpen(false)}>Affiliate Portal</Link>
        <Link href="/admin" onClick={() => setDrawerOpen(false)}>Control Center</Link>
      </div>
    </>
  );
}
