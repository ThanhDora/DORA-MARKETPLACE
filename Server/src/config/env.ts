import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  JWT_EMAIL_VERIFICATION_EXPIRES_IN: z.string().default('1h'),
  JWT_PASSWORD_RESET_EXPIRES_IN: z.string().default('15m'),
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  BACKEND_URL: z.string().url('BACKEND_URL must be a valid URL').default('http://localhost:3000'),
  REDIS_URL: z.string().url().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().url().optional(),
  OPENAI_MODEL: z.string().default('gpt-3.5-turbo'),
  XAI_API_KEY: z.string().optional(),
  XAI_MODEL: z.string().default('grok-3-mini'),
  MOMO_PARTNER_CODE: z.string().optional(),
  MOMO_ACCESS_KEY: z.string().optional(),
  MOMO_SECRET_KEY: z.string().optional(),
  MOMO_ENDPOINT: z.string().optional(),
  SEPAY_ENV: z.enum(['sandbox', 'production']).optional(),
  SEPAY_MERCHANT_ID: z.string().optional(),
  SEPAY_SECRET_KEY: z.string().optional(),
  SEPAY_TMN_CODE: z.string().optional(),
  SEPAY_HASH_SECRET: z.string().optional(),
  SEPAY_URL: z.string().optional(),
  SEPAY_RETURN_URL: z.string().optional(),
  SEPAY_IPN_TOKEN: z.string().optional(),
  SEPAY_API_TOKEN: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  PAYPAL_MODE: z.enum(['sandbox', 'live']).default('sandbox'),
  ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/, 'ENCRYPTION_KEY must be 64 hex characters').optional().or(z.literal('')),
  ENCRYPTION_SALT: z.string().regex(/^[a-fA-F0-9]{64}$/, 'ENCRYPTION_SALT must be 64 hex characters').optional().or(z.literal('')),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isDev = env.NODE_ENV === 'development';
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
