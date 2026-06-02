"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const AccountContext = createContext(null);

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within <AccountProvider>");
  return ctx;
}

// Pure fetch — resolves to the next state, never touches React state itself.
async function fetchAccountState() {
  try {
    const res = await fetch("/api/affiliate/me", { cache: "no-store" });
    if (res.status === 401) {
      return { loading: false, authenticated: false, data: null, error: null };
    }
    if (!res.ok) throw new Error("Failed to load account");
    const data = await res.json();
    return { loading: false, authenticated: true, data, error: null };
  } catch (err) {
    return { loading: false, authenticated: false, data: null, error: err.message };
  }
}

export function AccountProvider({ children }) {
  const [state, setState] = useState({
    loading: true,
    authenticated: false,
    data: null,
    error: null,
  });

  // setState lives inside the awaited continuation, not the synchronous body.
  const refresh = useCallback(async () => {
    const next = await fetchAccountState();
    setState(next);
  }, []);

  useEffect(() => {
    let active = true;
    fetchAccountState().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AccountContext.Provider value={{ ...state, refresh }}>
      {children}
    </AccountContext.Provider>
  );
}
