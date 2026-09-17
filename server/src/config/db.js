import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Operator injection (e.g. `{ "$ne": null }`) is prevented at the edge: every
// request is parsed by a zod schema that only admits primitive values, and
// Sales field values are validated against their configured type.
mongoose.set('strictQuery', true);

const FALLBACK_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];

if (env.DNS_SERVERS.length) {
  dns.setServers(env.DNS_SERVERS);
}

// `mongodb+srv://` URIs need an SRV lookup. On some Windows setups Node's
// resolver points at a local address that refuses SRV queries even though the
// OS resolver works, so retry once through public DNS.
const isSrvLookupFailure = (err) =>
  env.MONGODB_URI.startsWith('mongodb+srv://') &&
  /querySrv|queryTxt/.test(err?.message ?? '') &&
  ['ECONNREFUSED', 'ETIMEOUT', 'ESERVFAIL'].includes(err?.code);

export async function connectDatabase(dbName = env.MONGODB_DB_NAME) {
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => logger.info('MongoDB reconnected'));

  const options = { dbName, serverSelectionTimeoutMS: 15000, autoIndex: true };

  try {
    await mongoose.connect(env.MONGODB_URI, options);
  } catch (err) {
    if (!isSrvLookupFailure(err) || env.DNS_SERVERS.length) throw err;
    logger.warn({ code: err.code }, `SRV lookup failed; retrying with public DNS (${FALLBACK_DNS_SERVERS.join(', ')})`);
    dns.setServers(FALLBACK_DNS_SERVERS);
    await mongoose.connect(env.MONGODB_URI, options);
  }

  logger.info({ dbName }, 'MongoDB connected');
  return mongoose.connection;
}

/** True once queries can actually run. */
export function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

/**
 * Turns a connection failure into something actionable. Atlas accepts the TCP
 * connection and then aborts the TLS handshake when the caller's IP is not on
 * the project's access list, which otherwise reads as an unexplained TLS error.
 */
export function explainConnectionError(err) {
  const message = err?.message ?? '';
  if (/tlsv1 alert internal error|SSL alert number 80/i.test(message)) {
    return "The database refused the TLS handshake. On MongoDB Atlas this almost always means this machine's public IP is not on the project's Network Access list.";
  }
  if (/querySrv|queryTxt/.test(message)) {
    return 'The database hostname could not be resolved. Check your internet connection, or set DNS_SERVERS=1.1.1.1,8.8.8.8 in server/.env.';
  }
  if (/Authentication failed|bad auth/i.test(message)) {
    return 'The database rejected the credentials in MONGODB_URI.';
  }
  if (/ECONNREFUSED/.test(message)) {
    return 'Nothing is listening at MONGODB_URI. Is your local MongoDB running?';
  }
  return message || 'The database could not be reached.';
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
