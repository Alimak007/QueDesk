/**
 * Checks, from the machine the API runs on, whether it can send email.
 *
 * Usage (from the server folder, where the app's .env lives):
 *   npm run mail:check                     settings, DNS, SMTP login over IPv4, IPv6 and 127.0.0.1, and who gets leave emails
 *   npm run mail:check -- you@example.com  the same, then sends one test email to that address
 *
 * It reads the same .env as `npm start`, so what it reports is what the app sees.
 * It only reads and sends a test message; it changes nothing.
 */
import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const TIMEOUT_MS = 15_000;
const recipient = process.argv.slice(2).find((arg) => arg.includes('@'));

const line = (label, value) => console.log(`  ${label.padEnd(16)} ${value}`);
const heading = (text) => console.log(`\n${text}`);

function describeError(err) {
  return [err.code, err.command && `(during ${err.command})`, err.message].filter(Boolean).join(' ');
}

/** Logs in to the mail server at one specific address, keeping the certificate check on the real host name. */
async function tryLogin(address) {
  const transport = nodemailer.createTransport({
    host: address,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    tls: { servername: env.SMTP_HOST },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
  const started = Date.now();
  try {
    await transport.verify();
    return { ok: true, ms: Date.now() - started, transport };
  } catch (err) {
    transport.close();
    return { ok: false, ms: Date.now() - started, error: describeError(err) };
  }
}

/** Who receives the "new leave request" email: active admins and anyone allowed to approve leave. */
async function listLeaveRecipients() {
  const { connectDatabase, disconnectDatabase } = await import('../config/db.js');
  const { listUsersWithPermission } = await import('../modules/notifications/notification.service.js');
  const { User } = await import('../modules/users/user.model.js');
  await connectDatabase();
  try {
    const approvers = await listUsersWithPermission('leave', 'approve');
    return await User.find({ _id: { $in: approvers.map((a) => a._id) } })
      .select('firstName lastName email role')
      .lean();
  } finally {
    await disconnectDatabase();
  }
}

const PLACEHOLDER_DOMAINS = /@(example\.(com|org|net)|test(\.io)?|quedesk\.com|localhost)$/i;

async function main() {
  console.log('QueDesk mail check');

  heading('1. Settings the app reads');
  const envFile = path.resolve('.env');
  line('.env file', fs.existsSync(envFile) ? envFile : `NOT FOUND at ${envFile} — the app only reads server/.env`);
  line('NODE_ENV', env.NODE_ENV);
  line('SMTP_HOST', env.SMTP_HOST || 'NOT SET');
  line('SMTP_PORT', `${env.SMTP_PORT} (${env.SMTP_PORT === 465 ? 'SSL' : 'STARTTLS'})`);
  line('SMTP_USER', env.SMTP_USER || 'NOT SET');
  line('SMTP_PASS', env.SMTP_PASS ? `set (${env.SMTP_PASS.length} characters)` : 'NOT SET');
  line('Links in emails', env.clientOrigins[0]);

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    console.log('\nRESULT: email is OFF. With any of SMTP_HOST, SMTP_USER or SMTP_PASS missing, the app skips every');
    console.log('email without logging anything. Add them to server/.env and restart the app.');
    process.exitCode = 1;
    return;
  }
  if (/localhost/.test(env.clientOrigins[0])) {
    console.log('  ! CLIENT_ORIGIN is localhost, so the links in emails will not open the live site.');
  }

  heading(`2. Addresses of ${env.SMTP_HOST}`);
  const addresses = await dns.lookup(env.SMTP_HOST, { all: true }).catch((err) => {
    line('lookup', `FAILED ${describeError(err)}`);
    return [];
  });
  for (const a of addresses) line(`IPv${a.family}`, a.address);

  heading(`3. SMTP login as ${env.SMTP_USER} on port ${env.SMTP_PORT}`);
  const candidates = [...addresses.map((a) => ({ label: `IPv${a.family} ${a.address}`, address: a.address })), {
    // Only meaningful when this runs on the mail server itself, as on a single VPS.
    label: 'local 127.0.0.1',
    address: '127.0.0.1',
  }];
  const results = [];
  for (const candidate of candidates) {
    const result = await tryLogin(candidate.address);
    results.push({ ...candidate, ...result });
    const note = !result.ok && candidate.address === '127.0.0.1' ? ' (fine unless this machine is the mail server)' : '';
    line(candidate.label, result.ok ? `OK (${result.ms} ms)` : `FAILED after ${result.ms} ms: ${result.error}${note}`);
  }

  heading('4. Who receives leave request emails');
  try {
    const people = await listLeaveRecipients();
    if (!people.length) line('nobody', 'There are no active admins or approvers.');
    for (const p of people) {
      const flag = PLACEHOLDER_DOMAINS.test(p.email) ? '  <- looks like a placeholder address; mail to it is lost' : '';
      line(p.role, `${[p.firstName, p.lastName].filter(Boolean).join(' ')} <${p.email}>${flag}`);
    }
  } catch (err) {
    line('database', `could not check: ${describeError(err)}`);
  }

  const working = results.find((r) => r.ok);
  if (recipient) {
    heading(`5. Test email to ${recipient}`);
    if (!working) {
      line('skipped', 'No address accepted the login, so nothing can be sent.');
    } else {
      try {
        const info = await working.transport.sendMail({
          from: { name: env.MAIL_FROM_NAME, address: env.SMTP_USER },
          to: recipient,
          subject: 'QueDesk mail check',
          text: `This is a test message from the QueDesk server, sent via ${working.label}. No action is needed.`,
        });
        line('accepted', info.accepted.join(', ') || 'none');
        if (info.rejected.length) line('rejected', info.rejected.join(', '));
        line('server reply', info.response);
      } catch (err) {
        line('FAILED', describeError(err));
      }
    }
  }
  for (const r of results) r.transport?.close();

  heading('RESULT');
  const failedByName = results.filter((r) => r.address !== '127.0.0.1' && !r.ok);
  if (!working) {
    console.log('  The app cannot log in to the mail server from this machine at any address, so no email can be sent.');
    console.log('  A timeout or "connection refused" usually means a firewall is blocking the mail port for this process.');
    process.exitCode = 1;
  } else if (failedByName.length) {
    console.log(`  Login works via ${working.label}, but not via ${failedByName.map((r) => r.label).join(', ')}.`);
    console.log(`  The app connects to ${env.SMTP_HOST} and picks one of its addresses at random, so emails fail some or all of the time.`);
    process.exitCode = 1;
  } else {
    console.log(`  The app can log in to ${env.SMTP_HOST} at every address.`);
    console.log('  If emails still do not arrive, check the recipients above and that the running app was restarted after editing .env.');
  }
}

main().catch((err) => {
  console.error(`\nMail check crashed: ${describeError(err)}`);
  process.exitCode = 1;
});
