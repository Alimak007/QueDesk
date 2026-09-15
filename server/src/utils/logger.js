import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : 'info'),
  redact: ['req.headers.cookie', 'req.headers.authorization', 'password', '*.password'],
  ...(isProduction || isTest
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }),
});
