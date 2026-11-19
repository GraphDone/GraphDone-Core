import type { RequestHandler } from 'express';
import { generateToken } from '../utils/auth.js';
import { sqliteAuthStore } from './sqlite-auth.js';
import { redirectWithHandover } from './session-handover.js';

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
    redirectWithHandover(res, { token, account: user.email || user.username });
  } catch {
    res.status(401).json({ error: 'Authentication failed' });
  }
};
