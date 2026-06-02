// Shared formatting helpers for the account section.

export const USD_TO_INR = 94;

export function fmtUsd(n, opts = {}) {
  const v = Number(n || 0);
  return v.toLocaleString('en-US', {
    minimumFractionDigits: opts.whole ? 0 : 2,
    maximumFractionDigits: opts.whole ? 0 : 2,
  });
}

export function fmtInr(n) {
  const v = Number(n || 0);
  return '₹' + v.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function shortHash(h, lead = 10, tail = 8) {
  if (!h) return '';
  if (h.length <= lead + tail + 1) return h;
  return `${h.slice(0, lead)}…${h.slice(-tail)}`;
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
