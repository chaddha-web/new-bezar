"use client";

import { useState } from "react";
import { IconCopy, IconCheck } from "./icons";

export default function CopyButton({ text, className = "acc-icon-btn" }) {
  const [done, setDone] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className={`${className} ${done ? "done" : ""}`}
      aria-label="Copy to clipboard"
    >
      {done ? <IconCheck /> : <IconCopy />}
    </button>
  );
}
