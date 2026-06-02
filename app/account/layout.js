"use client";

import "./account.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AccountProvider, useAccount } from "./AccountContext";
import { IconGrid, IconNetwork, IconWallet, IconDeposit, IconBack } from "./icons";

const NAV = [
  { href: "/account", label: "Overview", Icon: IconGrid, exact: true },
  { href: "/account/network", label: "Network", Icon: IconNetwork },
  { href: "/account/wallet", label: "Wallet", Icon: IconWallet },
  { href: "/account/deposit", label: "Deposit", Icon: IconDeposit },
];

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const signOut = async () => {
    await fetch("/api/auth/me", { method: "DELETE" });
    router.push("/login");
  };

  return (
    <aside className="acc-sidebar">
      <Link href="/" className="acc-brand">Bezar</Link>
      <div className="acc-brand-sub">Member Console</div>

      <nav className="acc-nav">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item) ? "active" : ""}>
            <item.Icon />
            <span className="label">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="acc-sidebar-foot">
        <Link href="/"><IconBack width={14} height={14} style={{ verticalAlign: "-2px", marginRight: 8 }} />Back to streaming</Link>
        <button onClick={signOut}>Sign out</button>
      </div>
    </aside>
  );
}

function LoadingGate() {
  return (
    <div className="acc-shell">
      <Sidebar />
      <main className="acc-main">
        <div className="acc-topbar">
          <div>
            <div className="acc-skeleton" style={{ width: 120, height: 14, marginBottom: 14 }} />
            <div className="acc-skeleton" style={{ width: 260, height: 48 }} />
          </div>
        </div>
        <div className="acc-stat-grid" style={{ border: "none", background: "transparent", gap: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="acc-skeleton" style={{ height: 132 }} />
          ))}
        </div>
      </main>
    </div>
  );
}

function UnauthGate() {
  return (
    <div className="acc-gate">
      <div className="acc-gate-card">
        <div className="acc-eyebrow">Bezar · Member Console</div>
        <h1 className="acc-page-title">Sign in to continue</h1>
        <p>Your affiliate network, wallet, and Web3 deposits live behind your viewer account. Sign in or create one to get started.</p>
        <div className="acc-gate-actions">
          <Link href="/login" className="acc-btn">Viewer Login</Link>
          <Link href="/signup" className="acc-btn-ghost">Create Account</Link>
        </div>
      </div>
    </div>
  );
}

function Shell({ children }) {
  const { loading, authenticated } = useAccount();
  if (loading) return <LoadingGate />;
  if (!authenticated) return <UnauthGate />;
  return (
    <div className="acc-shell">
      <Sidebar />
      <main className="acc-main">{children}</main>
    </div>
  );
}

export default function AccountLayout({ children }) {
  return (
    <div className="acc-root">
      <AccountProvider>
        <Shell>{children}</Shell>
      </AccountProvider>
    </div>
  );
}
