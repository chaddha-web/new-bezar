"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import "./affiliate.css";

// Re-using same style concept as account but adapted for affiliate
const AffiliateContext = createContext(null);

export function useAffiliate() {
  const ctx = useContext(AffiliateContext);
  if (!ctx) throw new Error("useAffiliate must be used within <AffiliateProvider>");
  return ctx;
}

async function fetchAffiliateState() {
  try {
    const res = await fetch("/api/affiliate/me", { cache: "no-store" });
    if (res.status === 401) {
      return { loading: false, authenticated: false, data: null, error: null };
    }
    if (!res.ok) throw new Error("Failed to load affiliate state");
    const data = await res.json();
    return { loading: false, authenticated: true, data, error: null };
  } catch (err) {
    return { loading: false, authenticated: false, data: null, error: err.message };
  }
}

export function AffiliateProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    authenticated: false,
    data: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    const next = await fetchAffiliateState();
    setState(next);
  }, []);

  useEffect(() => {
    let active = true;
    fetchAffiliateState().then((next) => {
      if (active) setState(next);
    });
    return () => { active = false; };
  }, []);

  return (
    <AffiliateContext.Provider value={{ ...state, refresh }}>
      {children}
    </AffiliateContext.Provider>
  );
}

const NAV = [
  { href: "/affiliate", label: "Dashboard", exact: true },
  { href: "/affiliate/create-hold", label: "Create Hold" },
  { href: "/affiliate/network", label: "Track Network" },
  { href: "/affiliate/cash-out", label: "Cash Out" },
  { href: "/affiliate/history", label: "Watch History" },
  { href: "/affiliate/support", label: "Help / Support" },
  { href: "/affiliate/settings", label: "Settings / Profile" },
];

function AffiliateSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const signOut = async () => {
    await fetch("/api/auth/me", { method: "DELETE" });
    router.push("/login");
  };

  return (
    <aside className="aff-sidebar">
      <Link href="/" className="aff-brand">Bezar</Link>
      <div className="aff-brand-sub">Affiliate Portal</div>

      <nav className="aff-nav">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item) ? "active" : ""}>
            <span className="label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="aff-sidebar-foot">
        <Link href="/">Back to streaming</Link>
        <button onClick={signOut}>Sign out</button>
      </div>
    </aside>
  );
}

function AffiliateShell({ children }) {
  const { loading, authenticated, data } = useAffiliate();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !authenticated) {
      router.push("/login");
    } else if (!loading && authenticated && data) {
      if (!data.node.onboarded && pathname !== "/affiliate/onboard") {
        router.push("/affiliate/onboard");
      } else if (data.node.onboarded && pathname === "/affiliate/onboard") {
        router.push("/affiliate");
      }
    }
  }, [loading, authenticated, data, pathname, router]);

  if (loading || !authenticated) {
    return <div style={{ color: '#fff', padding: 40 }}>Loading Affiliate Portal...</div>;
  }

  // If we are on the onboard page, don't render the sidebar
  if (pathname === "/affiliate/onboard") {
    return children;
  }

  // Wait until redirect happens if not onboarded
  if (!data.node.onboarded) return null;

  return (
    <div className="aff-shell">
      <AffiliateSidebar />
      <main className="aff-main">{children}</main>
    </div>
  );
}

export default function AffiliateLayout({ children }) {
  return (
    <div className="aff-root">
      <AffiliateProvider>
        <AffiliateShell>{children}</AffiliateShell>
      </AffiliateProvider>
    </div>
  );
}
