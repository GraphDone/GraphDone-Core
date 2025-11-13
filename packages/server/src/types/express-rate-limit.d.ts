import 'express-rate-limit';

declare module 'express' {
  export interface Request {
    rateLimit: {
      limit: number;
      current: number;
      remaining: number;
      resetTime: Date | undefined;
    };
  }
}
