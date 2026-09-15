import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().min(1).default('quedesk'),
  /** Optional comma-separated DNS servers for Node (helps SRV lookups on some networks). */
  DNS_SERVERS: z
    .string()
    .default('')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  COOKIE_NAME: z.string().default('myportal_token'),
  SEED_ADMIN_EMAIL: z.string().trim().toLowerCase().pipe(z.email()).default('admin@myportal.com'),
  SEED_ADMIN_PASSWORD: z.string().min(1).default('Admin@12345'),
  SEED_ADMIN_NAME: z.string().trim().min(1).default('Portal Admin'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const raw = parsed.data;

export const env = Object.freeze({
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  clientOrigins: raw.CLIENT_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
});
