/**
 * Clipboard helpers — copy text with a graceful fallback, and a short-id
 * formatter for displaying long UUIDs compactly (click-to-copy, #23).
 */

/** First `len` chars of an id (UUIDs are unwieldy in the UI). Safe on empty/nullish. */
export function shortId(id: string | null | undefined, len = 8): string {
  if (!id) return '';
  return id.length > len ? id.slice(0, len) : id;
}

/**
 * Copy `text` to the clipboard. Prefers the async Clipboard API; falls back to
 * a hidden textarea + execCommand for older/insecure contexts. Resolves true on
 * success, false if no mechanism worked.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to legacy path */ }

  try {
    if (typeof document === 'undefined' || !document.body) return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
