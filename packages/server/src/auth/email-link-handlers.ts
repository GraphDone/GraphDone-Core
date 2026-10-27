import type { RequestHandler } from 'express';
import { sqliteAuthStore } from './sqlite-auth.js';
import { generateToken } from '../utils/auth.js';
import { verifyCaptcha } from '../utils/captcha.js';

export const verifyMagicLinkHandler: RequestHandler = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3127'}/login?error=invalid_magic_link`);
    }

    const result = await sqliteAuthStore.verifyMagicLink(token);

    if (!result.valid || !result.userId || result.authVersion === undefined || !result.role) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3127'}/login?error=expired_magic_link`);
    }

    const jwtToken = generateToken(result.userId, result.email!, result.role, result.authVersion);
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3127';
    const redirectUrl = `${clientUrl}/login?token=${jwtToken}`;

    console.log(`🔐 Magic link verified for: ${result.email}`); // eslint-disable-line no-console
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ Magic link verification failed:', error); // eslint-disable-line no-console
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3127'}/login?error=magic_link_failed`);
  }
};

export const resetPasswordHandler: RequestHandler = async (req, res) => {
  try {
    const { token, newPassword, captchaPayload } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Reset token is required' });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Verify CAPTCHA
    const isCaptchaValid = await verifyCaptcha(captchaPayload, 'reset-password');
    if (!isCaptchaValid) {
      return res.status(400).json({ error: 'CAPTCHA verification failed' });
    }

    const success = await sqliteAuthStore.resetPasswordWithLink(token, newPassword);

    if (!success) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    return res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('❌ Password update failed:', error); // eslint-disable-line no-console
    return res.status(500).json({ error: 'Failed to update password' });
  }
};
