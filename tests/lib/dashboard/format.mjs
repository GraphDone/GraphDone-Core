/**
 * Pure, isomorphic formatting helpers shared by the dashboard server (Node) and
 * the browser app (served as a native ES module). No I/O, no Node builtins — so
 * it loads unchanged in both. Status vocab + colors mirror reporting/html.mjs.
 */
export const STATUS_COLOR = { passed: '#34d399', failed: '#f87171', warn: '#fbbf24', skipped: '#94a3b8' };
export const STATUS_ICON = { passed: '✅', failed: '❌', warn: '⚠️', skipped: '⏭️' };
export const STATUS_RANK = { failed: 3, warn: 2, passed: 1, skipped: 0 };

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function rollupStatus(statuses) {
  let best = 'skipped';
  for (const s of statuses) if ((STATUS_RANK[s] ?? 0) > (STATUS_RANK[best] ?? 0)) best = s;
  return best;
}

export function fmtDuration(ms) {
  if (ms == null || !isFinite(ms)) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s - m * 60);
  return `${m}m ${rem}s`;
}

export function fmtBytes(n) {
  if (n == null || !isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function fmtClock(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fmtAgo(ms, now) {
  const ref = now ?? Date.now();
  const diff = ref - ms;
  if (!isFinite(diff) || diff < 0) return fmtClock(ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function decodeMungedName(name) {
  return String(name ?? '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/^(audit|tour|redteam|flow)[-_]/i, '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || '—';
}
