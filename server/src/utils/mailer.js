import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/** Messages "sent" during tests, so the suite can assert on them without a mail server. */
export const testOutbox = [];

const MAX_ATTEMPTS = 3;

let transporter;

export function isMailConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // 465 is TLS from the first byte; 587 and 25 upgrade with STARTTLS.
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

/**
 * Sends a plain-text email from the company address. Like notifications, email
 * is a side effect: a failure to deliver one must never fail the business
 * operation that triggered it, so this resolves to `false` instead of throwing.
 */
export async function sendMail({ to, subject, text, replyTo }) {
  const recipients = [...new Set([to].flat().filter(Boolean))];
  if (!recipients.length) return false;

  const message = { to: recipients, subject, text, replyTo };
  // Tests must never touch the network.
  if (env.isTest) {
    testOutbox.push(message);
    return true;
  }
  if (!isMailConfigured()) return false;

  // Retry only failures to connect (an unreachable IPv6 route, a slow handshake):
  // nothing has been sent yet, so trying again cannot deliver the message twice.
  for (let attempt = 1; ; attempt += 1) {
    try {
      await getTransporter().sendMail({ ...message, from: { name: env.MAIL_FROM_NAME, address: env.SMTP_USER } });
      return true;
    } catch (err) {
      if (err.command === 'CONN' && attempt < MAX_ATTEMPTS) continue;
      logger.error({ err, subject }, 'Failed to send email');
      return false;
    }
  }
}
