import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export function createCaptchaChallengeLimiter() {
  return rateLimit({
    windowMs: 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    // Socket-only even when the application enables Express trust proxy.
    keyGenerator: req => ipKeyGenerator(req.socket.remoteAddress || 'unknown'),
  });
}
