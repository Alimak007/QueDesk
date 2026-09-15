import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const errorBody = (message) => ({
  success: false,
  error: { code: 'RATE_LIMITED', message },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: errorBody('Too many requests. Please slow down.'),
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => env.isTest,
  message: errorBody('Too many failed sign-in attempts. Please try again in 15 minutes.'),
});
