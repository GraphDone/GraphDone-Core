function safeUrl(value) {
  try { const url = new URL(value); return `${url.origin}${url.pathname}`.slice(0, 500); }
  catch { return '[unavailable URL]'; }
}

function safeText(value) {
  return String(value).slice(0, 4000)
    .replace(/https?:\/\/[^\s"'<>]+/g, safeUrl)
    .replace(/\bBearer\s+[^\s"',;]+/gi, 'Bearer [redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted JWT]')
    .replace(/((?:["']?)(?:password|token|authToken|access_token|refresh_token|secret)(?:["']?)\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi, '$1[redacted]')
    .slice(0, 1000);
}

export function captureBrowserDiagnostics(page) {
  const events = [];
  const started = Date.now();
  let dropped = 0;
  const record = event => {
    if (events.length === 50) { events.shift(); dropped++; }
    events.push({ elapsedMs: Date.now() - started, ...event });
  };
  const consoleMessage = message => {
    if (['warning', 'error'].includes(message.type())) record({ kind: 'console', level: message.type(), message: safeText(message.text()) });
  };
  const pageError = error => record({ kind: 'pageerror', message: safeText(error.message) });
  const requestFailed = request => record({ kind: 'requestfailed', url: safeUrl(request.url()), message: safeText(request.failure()?.errorText || 'Unknown request failure') });
  page.on('console', consoleMessage);
  page.on('pageerror', pageError);
  page.on('requestfailed', requestFailed);
  return {
    snapshot: () => ({ url: safeUrl(page.url()), dropped, events: events.map(event => ({ ...event })) }),
    stop: () => {
      page.off('console', consoleMessage);
      page.off('pageerror', pageError);
      page.off('requestfailed', requestFailed);
    },
  };
}
