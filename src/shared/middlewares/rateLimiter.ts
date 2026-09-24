import rateLimit from 'express-rate-limit';

// Strict rate limiter for sensitive financial endpoints (e.g., max 5 requests per minute)
export const transferLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 5, // Limit each user/IP to 5 transfer requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many transfer attempts. Please wait a moment before trying again.',
  },
});