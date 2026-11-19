import { createHash, randomBytes } from 'node:crypto';
import type { RequestHandler, Response } from 'express';

/** One-time codes that carry a new session from a sign-in redirect to the web page; held in this process's memory, so it assumes a single server process. */

type Session = { token: string; account: string };
type Pending = Session & { expiresAt: number };

const digest = (code: string) => createHash('sha256').update(code).digest('hex');

export class SessionHandoverStore {
  readonly entries = new Map<string, Pending>();
  private readonly lifetimeMs: number;
  private readonly limit: number;
  private readonly now: () => number;

  constructor({ lifetimeMs = 120_000, limit = 1_000, now = () => Date.now() }: { lifetimeMs?: number; limit?: number; now?: () => number } = {}) {
    this.lifetimeMs = lifetimeMs;
    this.limit = limit;
    this.now = now;
  }

  issue(session: Session): string {
    const now = this.sweep();
    for (const key of this.entries.keys()) {
      if (this.entries.size < this.limit) break;
      this.entries.delete(key);
    }
    const code = randomBytes(32).toString('base64url');
    this.entries.set(digest(code), { token: session.token, account: session.account, expiresAt: now + this.lifetimeMs });
    return code;
  }

  preview(code: unknown): string | null {
    return this.find(code)?.account ?? null;
  }

  complete(code: unknown): string | null {
    const pending = this.find(code);
    if (!pending) return null;
    this.entries.delete(digest(code as string));
    return pending.token;
  }

  private find(code: unknown): Pending | undefined {
    this.sweep();
    if (typeof code !== 'string' || !code || code.length > 128) return undefined;
    return this.entries.get(digest(code));
  }

  private sweep(): number {
    const now = this.now();
    for (const [key, pending] of this.entries) if (pending.expiresAt <= now) this.entries.delete(key);
    return now;
  }
}

export const sessionHandovers = new SessionHandoverStore();

export function redirectWithHandover(res: Response, session: Session): void {
  const code = sessionHandovers.issue(session);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3127'}/login#handover=${code}`);
}

const codeFrom = (body: unknown) => (body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined);

export const previewHandoverHandler: RequestHandler = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const account = sessionHandovers.preview(codeFrom(req.body));
  if (account === null) { res.status(400).json({ error: 'invalid_handover' }); return; }
  res.json({ account });
};

export const completeHandoverHandler: RequestHandler = (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const token = sessionHandovers.complete(codeFrom(req.body));
  if (token === null) { res.status(400).json({ error: 'invalid_handover' }); return; }
  res.json({ token });
};
