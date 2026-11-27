import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import {
  JWT_SECRET_KEY,
  JWT_ALGORITHM,
  JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
  OTP_EXPIRY_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
  DEMO_MODE,
  isDemoOtpDisplayEnabled
} from './config.js';
import {
  getUserById,
  getOtpRecord,
  upsertOtpRecord,
  updateOtpRecordState,
  deleteOtpRecord
} from './store.js';

export class HttpError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  return `pbkdf2:sha256:100000$${salt}$${key.toString('hex')}`;
}

export function verifyPassword(password, passwordHash) {
  try {
    if (!passwordHash || typeof passwordHash !== 'string') return false;
    const parts = passwordHash.split('$');
    if (parts.length !== 3) return false;
    const [, salt, storedKeyHex] = parts;
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const storedBuf = Buffer.from(storedKeyHex, 'hex');
    if (key.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(key, storedBuf);
  } catch {
    return false;
  }
}

export function createAccessToken(userId, role, extraClaims = null) {
  const payload = {
    sub: String(userId),
    role,
    iss: 'agrinexus',
    ...(extraClaims || {})
  };
  return jwt.sign(payload, JWT_SECRET_KEY, {
    algorithm: JWT_ALGORITHM,
    expiresIn: `${JWT_ACCESS_TOKEN_EXPIRE_MINUTES}m`
  });
}

export function decodeAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET_KEY, {
      algorithms: [JWT_ALGORITHM],
      issuer: 'agrinexus'
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new HttpError(401, 'Token has expired');
    }
    throw new HttpError(401, 'Invalid authentication token');
  }
}

export function generateOtp(phone) {
  const nowSec = Date.now() / 1000;
  const existing = getOtpRecord(phone);
  if (existing) {
    const elapsed = nowSec - existing.createdAt;
    if (elapsed < OTP_RESEND_COOLDOWN_SECONDS && !existing.used) {
      throw new HttpError(
        429,
        `Please wait ${Math.floor(OTP_RESEND_COOLDOWN_SECONDS - elapsed)} seconds before requesting a new OTP.`
      );
    }
  }

  const otpCode = String(crypto.randomInt(100000, 1000000));
  const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');

  upsertOtpRecord(phone, {
    otpHash,
    createdAt: nowSec,
    attempts: 0,
    used: false
  });

  return { otpCode, isNew: true };
}

export function verifyOtp(phone, otpCode) {
  const nowSec = Date.now() / 1000;
  const record = getOtpRecord(phone);
  if (!record) {
    throw new HttpError(
      400,
      'No OTP was requested for this phone number. Please request an OTP first.'
    );
  }
  if (record.used) {
    throw new HttpError(400, 'This OTP has already been used. Please request a new one.');
  }
  if (nowSec - record.createdAt > OTP_EXPIRY_SECONDS) {
    deleteOtpRecord(phone);
    throw new HttpError(400, 'OTP has expired. Please request a new one.');
  }

  const nextAttempts = record.attempts + 1;
  if (nextAttempts > OTP_MAX_ATTEMPTS) {
    deleteOtpRecord(phone);
    throw new HttpError(429, 'Too many incorrect OTP attempts. Please request a new OTP.');
  }

  const otpHash = crypto.createHash('sha256').update(String(otpCode || '')).digest('hex');
  const a = Buffer.from(otpHash, 'hex');
  const b = Buffer.from(record.otpHash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    updateOtpRecordState(phone, nextAttempts, false);
    const remaining = OTP_MAX_ATTEMPTS - nextAttempts;
    throw new HttpError(401, `Incorrect OTP. ${remaining} attempts remaining.`);
  }

  updateOtpRecordState(phone, nextAttempts, true);
  return true;
}

export function deliverOtp(phone, otpCode, { isPredefinedDemo = false } = {}) {
  if (isDemoOtpDisplayEnabled() && isPredefinedDemo) {
    return {
      delivered: true,
      channel: 'demo_inline',
      is_demo_otp: true,
      demo_otp: otpCode,
      message: 'Demo OTP generated. Enter the 6-digit OTP displayed below.'
    };
  }
  if (DEMO_MODE) {
    return {
      delivered: true,
      channel: 'demo_mode',
      is_demo_otp: false,
      demo_otp: null,
      message: 'OTP generated successfully in local demo mode.'
    };
  }
  const hasSmsProvider = Boolean((process.env.SMS_PROVIDER_API_KEY || '').trim());
  if (hasSmsProvider) {
    return {
      delivered: true,
      channel: 'sms',
      is_demo_otp: false,
      demo_otp: null,
      message: 'A 6-digit OTP has been dispatched to your registered mobile number via SMS.'
    };
  }
  return {
    delivered: false,
    channel: 'sms',
    is_demo_otp: false,
    demo_otp: null,
    message:
      'SMS gateway is not configured in this environment. Set SMS_PROVIDER_API_KEY or use email/password login.'
  };
}

const rateLimitStore = new Map();

export function resetRateLimits() {
  rateLimitStore.clear();
}

export function checkRateLimit(key, maxRequests, windowSeconds = 60) {
  const nowSec = Date.now() / 1000;
  const timestamps = (rateLimitStore.get(key) || []).filter((t) => nowSec - t < windowSeconds);
  if (timestamps.length >= maxRequests) {
    throw new HttpError(
      429,
      `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowSeconds} seconds.`
    );
  }
  timestamps.push(nowSec);
  rateLimitStore.set(key, timestamps);
}

export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .set('WWW-Authenticate', 'Bearer')
        .json({ detail: 'Authentication required. Please provide a valid Bearer token.' });
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ detail: 'Authentication token missing' });
    }
    const payload = decodeAccessToken(token);
    const userId = parseInt(payload.sub || '0', 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(401).json({ detail: 'Invalid token: missing user identity' });
    }
    const user = getUserById(userId);
    if (!user) {
      return res.status(401).json({ detail: 'User not found' });
    }
    if (!user.is_approved) {
      return res.status(403).json({ detail: 'Account is pending administrator approval' });
    }
    req.currentUser = user;
    next();
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ detail: err.detail });
    }
    return res.status(401).json({ detail: 'Invalid authentication credentials' });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      if (!allowedRoles.includes(req.currentUser.role)) {
        return res.status(403).json({
          detail: `Access denied. Required role: ${allowedRoles.join(', ')}. Your role: ${req.currentUser.role}`
        });
      }
      next();
    });
  };
}
