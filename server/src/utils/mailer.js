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

const missingSettings = () =>
  ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter((key) => !env[key]);

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
 * Says at startup whether email is on, and whether the mail server accepts the
 * login. Settings are only read when the process starts, so this line in the
 * log is what the running app actually uses. Never throws and never delays
 * startup: a mail server that is down must not stop the API.
 */
export async function checkMailSetup() {
  // Tests must never touch the network.
  if (env.isTest) return { enabled: false, reason: 'test' };

  if (!isMailConfigured()) {
    const missing = missingSettings();
    logger.warn(
      { missing },
      `Email is OFF: ${missing.join(', ')} not set in server/.env, so leave and daily status emails will not be sent. Add them and restart the app.`,
    );
    return { enabled: false, missing };
  }

  const server = { host: env.SMTP_HOST, port: env.SMTP_PORT, user: env.SMTP_USER };
  try {
    await getTransporter().verify();
    logger.info(server, 'Email is ON: SMTP login succeeded');
    return { enabled: true, ok: true };
  } catch (err) {
    logger.error({ ...server, err }, `Email is ON but the SMTP login failed (${err.code ?? err.message}); emails will fail until this is fixed`);
    return { enabled: true, ok: false, error: err.code ?? err.message };
  }
}

/**
 * Sends a plain-text email from the company address. Like notifications, email
 * is a side effect: a failure to deliver one must never fail the business
 * operation that triggered it, so this resolves to `false` instead of throwing.
 * Every outcome is logged, so the log shows what happened to each email.
 */
export async function sendMail({ to, subject, text, replyTo }) {
  const recipients = [...new Set([to].flat().filter(Boolean))];
  if (!recipients.length) {
    logger.warn({ subject }, 'Email skipped: nobody to send it to');
    return false;
  }

  const message = { to: recipients, subject, text, replyTo };
  // Tests must never touch the network.
  if (env.isTest) {
    testOutbox.push(message);
    return true;
  }
  if (!isMailConfigured()) {
    logger.warn({ to: recipients, subject, missing: missingSettings() }, 'Email skipped: email is off (SMTP settings missing)');
    return false;
  }

  // Retry only failures to connect (an unreachable IPv6 route, a slow handshake):
  // nothing has been sent yet, so trying again cannot deliver the message twice.
  for (let attempt = 1; ; attempt += 1) {
    try {
      const info = await getTransporter().sendMail({ ...message, from: { name: env.MAIL_FROM_NAME, address: env.SMTP_USER } });
      logger.info(
        { to: recipients, subject, accepted: info.accepted, rejected: info.rejected, response: info.response },
        'Email sent',
      );
      return true;
    } catch (err) {
      if (err.command === 'CONN' && attempt < MAX_ATTEMPTS) {
        logger.warn({ to: recipients, subject, attempt, err }, 'Email: could not connect to the mail server, retrying');
        continue;
      }
      logger.error({ to: recipients, subject, attempt, err }, 'Failed to send email');
      return false;
    }
  }
}
