import type { RequestHandler } from 'express';
import { generateToken } from '../utils/auth.js';
import { sqliteAuthStore } from './sqlite-auth.js';

export const oauthLoginCallback: RequestHandler = async (req, res) => {
  const authenticated = req.user as { id?: string; authVersion?: number } | undefined;
  if (!authenticated?.id) { res.status(401).json({ error: 'Authentication failed' }); return; }
  try {
    const user = await sqliteAuthStore.findUserById(authenticated.id);
    if (!user || user.authVersion !== authenticated.authVersion) {
      res.status(401).json({ error: 'Authentication failed' });
      return;
    }
    const token = generateToken(user.id, user.email, user.role, user.authVersion);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3127'}/login?token=${encodeURIComponent(token)}`);
  } catch {
    res.status(401).json({ error: 'Authentication failed' });
  }
};
