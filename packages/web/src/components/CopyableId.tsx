import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { shortId, copyText } from '../lib/clipboard';

interface CopyableIdProps {
  id: string;
  /** Characters of the id to show before truncating (default 8). */
  length?: number;
  label?: string;
  testId?: string;
}

/**
 * Click-to-copy id chip (#23): shows a short id + copy icon; clicking copies the
 * FULL id and flashes a transient "Copied!" confirmation. Reusable anywhere an
 * id is shown (inspector, modals, lists).
 */
export function CopyableId({ id, length = 8, label = 'ID', testId = 'copyable-id' }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);
  if (!id) return null;
  const onCopy = async () => {
    const ok = await copyText(id);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onCopy}
      title={`Copy ${label}: ${id}`}
      aria-label={`Copy ${label}`}
      className="group inline-flex items-center gap-1.5 font-mono text-[11px] text-gray-400 hover:text-gray-200 rounded px-1.5 py-0.5 hover:bg-gray-700/50 transition-colors"
    >
      <span>{shortId(id, length)}</span>
      {copied
        ? <span className="inline-flex items-center gap-1 text-emerald-400"><Check className="h-3 w-3" /> Copied!</span>
        : <Copy className="h-3 w-3 opacity-60 group-hover:opacity-100" />}
    </button>
  );
}
