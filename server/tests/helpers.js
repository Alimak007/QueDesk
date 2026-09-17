import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

/**
 * Tests run against a disposable in-memory MongoDB so they need no network,
 * no credentials, and can never touch real data.
 */
let memoryServer;

export async function startTestDatabase() {
  memoryServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(memoryServer.getUri(), { dbName: 'quedesk_test' });
  return mongoose.connection;
}

export async function stopTestDatabase() {
  await mongoose.disconnect();
  await memoryServer?.stop();
}
