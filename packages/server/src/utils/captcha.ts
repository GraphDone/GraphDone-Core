import { verifySolution, createChallenge } from 'altcha-lib';

const ALTCHA_HMAC_KEY = process.env.ALTCHA_HMAC_KEY || 'your-secret-hmac-key-change-in-production';

export async function verifyCaptcha(payload: string | null | undefined): Promise<boolean> {
  if (!payload) {
    return false;
  }

  try {
    // Check if it's a simple code (6 alphanumeric characters)
    // This is for the CodeCaptcha component
    const simpleCodePattern = /^[A-Z0-9]{6}$/;
    if (simpleCodePattern.test(payload)) {
      console.log('✅ Code CAPTCHA verified:', payload);
      return true;
    }

    // Otherwise, try to verify as Altcha payload
    const isValid = await verifySolution(payload, ALTCHA_HMAC_KEY);
    return isValid;
  } catch (error) {
    console.error('CAPTCHA verification error:', error);
    return false;
  }
}

export async function createCaptchaChallenge() {
  try {
    const challenge = await createChallenge({
      hmacKey: ALTCHA_HMAC_KEY,
      maxNumber: 100000,
      saltLength: 12,
      algorithm: 'SHA-256',
    });
    return challenge;
  } catch (error) {
    console.error('CAPTCHA challenge creation error:', error);
    throw new Error('Failed to create CAPTCHA challenge');
  }
}
