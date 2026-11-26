import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';

function resolveJwtSecret() {
  const configured = (process.env.JWT_SECRET_KEY || '').trim();
  if (IS_PRODUCTION) {
    if (!configured || configured.length < 32) {
      throw new Error(
        '[AgriNexus Security] FATAL: JWT_SECRET_KEY environment variable must be set to a strong secret (>= 32 characters) when NODE_ENV=production.'
      );
    }
    if (configured === 'agrinexus-dev-secret-key-change-in-production') {
      throw new Error(
        '[AgriNexus Security] FATAL: Refusing to start in production with the legacy insecure JWT secret placeholder.'
      );
    }
    return configured;
  }
  if (configured) {
    return configured;
  }
  // Ephemeral random secret in non-production when no env override is supplied
  return crypto.randomBytes(32).toString('hex');
}

export const JWT_SECRET_KEY = resolveJwtSecret();
export const JWT_ALGORITHM = 'HS256';
export const JWT_ACCESS_TOKEN_EXPIRE_MINUTES = Math.max(
  5,
  parseInt(process.env.JWT_ACCESS_TOKEN_EXPIRE_MINUTES || '60', 10) || 60
);

export const OTP_EXPIRY_SECONDS = Math.max(
  60,
  parseInt(process.env.OTP_EXPIRY_SECONDS || '300', 10) || 300
);
export const OTP_MAX_ATTEMPTS = Math.max(
  1,
  parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10) || 5
);
export const OTP_RESEND_COOLDOWN_SECONDS = Math.max(
  10,
  parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || '60', 10) || 60
);

// Demo mode is strictly disabled in production and off by default unless explicitly opted in
export const DEMO_MODE =
  !IS_PRODUCTION && String(process.env.DEMO_MODE || 'false').toLowerCase() === 'true';

export const ADMIN_BOOTSTRAP_PASSWORD = (process.env.ADMIN_BOOTSTRAP_PASSWORD || '').trim();

export const DATABASE_PATH = (process.env.DATABASE_PATH || '').trim()
  ? path.resolve(process.env.DATABASE_PATH.trim())
  : path.resolve(__dirname, '..', 'data', 'agrinexus.db');

export const CORS_ALLOWED_ORIGINS = (
  process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const RATE_LIMIT_AUTH_PER_MINUTE = Math.max(
  1,
  parseInt(process.env.RATE_LIMIT_AUTH_PER_MINUTE || '10', 10) || 10
);
export const RATE_LIMIT_API_PER_MINUTE = Math.max(
  1,
  parseInt(process.env.RATE_LIMIT_API_PER_MINUTE || '60', 10) || 60
);
export const PORT = parseInt(process.env.PORT || '3000', 10) || 3000;
