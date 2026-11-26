import { Router } from 'express';
import {
  getUserById,
  getUserByPhone,
  getUserByEmail,
  listUsers,
  createUser,
  updateUserAuthState,
  updateUserPassword,
  adminNeedsSetup,
  claimInitialAdminPassword
} from '../store.js';
import {
  DEMO_MODE,
  IS_PRODUCTION,
  RATE_LIMIT_AUTH_PER_MINUTE
} from '../config.js';
import {
  HttpError,
  hashPassword,
  verifyPassword,
  createAccessToken,
  generateOtp,
  verifyOtp,
  deliverOtp,
  checkRateLimit,
  requireAuth,
  requireRole
} from '../security.js';

const router = Router();

const PUBLIC_ALLOWED_ROLES = new Set(['farmer', 'buyer']);
const ALL_VALID_ROLES = new Set(['farmer', 'buyer', 'fpo_admin', 'admin']);

function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    fpo_id: user.fpo_id,
    locality: user.locality,
    language_preference: user.language_preference
  };
}

function normalizePhone(phone) {
  if (phone === null || phone === undefined || phone === '') return null;
  const cleaned = String(phone).replace(/\s+/g, '').trim();
  if (!/^\d{10}$/.test(cleaned)) {
    throw new HttpError(400, 'Phone number must be exactly 10 digits');
  }
  return cleaned;
}

function normalizeEmail(email) {
  if (email === null || email === undefined || email === '') return null;
  const cleaned = String(email).trim().toLowerCase();
  if (cleaned.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
    throw new HttpError(400, 'Please enter a valid email address');
  }
  return cleaned;
}

function validatePasswordInput(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new HttpError(400, 'Password must be between 8 and 128 characters long');
  }
  return password;
}

function validateNameInput(name) {
  const cleaned = String(name || '').trim();
  if (cleaned.length < 2 || cleaned.length > 120) {
    throw new HttpError(400, 'Full name must be between 2 and 120 characters');
  }
  return cleaned;
}

router.get('/admin-setup-status', (req, res) => {
  res.json({
    needs_setup: adminNeedsSetup(),
    demo_mode: DEMO_MODE && !IS_PRODUCTION
  });
});

router.post('/admin-setup', (req, res, next) => {
  try {
    const clientIp = req.ip || 'unknown';
    checkRateLimit(`admin_setup:${clientIp}`, RATE_LIMIT_AUTH_PER_MINUTE, 60);

    if (!adminNeedsSetup()) {
      throw new HttpError(
        409,
        'Initial administrator password is already configured. Sign in using Email & Password.'
      );
    }

    const { password } = req.body || {};
    const validPassword = validatePasswordInput(password);
    const claimedAdmin = claimInitialAdminPassword(hashPassword(validPassword));
    if (!claimedAdmin) {
      throw new HttpError(409, 'Administrator account has already been claimed.');
    }

    const accessToken = createAccessToken(claimedAdmin.id, claimedAdmin.role);
    return res.json({
      message: 'Initial administrator password configured successfully.',
      access_token: accessToken,
      token_type: 'bearer',
      user: formatUser(claimedAdmin)
    });
  } catch (err) {
    next(err);
  }
});

router.post('/request-otp', (req, res, next) => {
  try {
    const cleanPhone = normalizePhone(req.body?.phone);
    if (!cleanPhone) throw new HttpError(400, 'Phone number is required');

    const clientIp = req.ip || 'unknown';
    checkRateLimit(`otp_request:${clientIp}`, RATE_LIMIT_AUTH_PER_MINUTE, 60);
    checkRateLimit(`otp_request:${cleanPhone}`, 5, 60);

    let user = getUserByPhone(cleanPhone);
    if (!user) {
      if (DEMO_MODE && !IS_PRODUCTION) {
        user = createUser({
          name: `Farmer ${cleanPhone.slice(-4)}`,
          phone: cleanPhone,
          email: null,
          password_hash: null,
          role: 'farmer',
          locality: 'Kolar, Karnataka',
          fpo_id: 'FPO-KOLAR-01',
          language_preference: 'hi',
          is_approved: true
        });
      } else {
        return res.json({
          message: 'If this phone number is registered, an OTP has been sent.',
          channel: 'sms',
          expires_in_seconds: 300,
          demo_note: null,
          phone: cleanPhone
        });
      }
    }

    const now = new Date();
    if (user.locked_until && user.locked_until > now) {
      const remainingMins = Math.max(1, Math.floor((user.locked_until - now) / 60000));
      throw new HttpError(
        403,
        `Account locked due to repeated failed attempts. Try again in ${remainingMins} minutes.`
      );
    }

    const { otpCode } = generateOtp(cleanPhone);
    const deliveryResult = deliverOtp(cleanPhone, otpCode);

    return res.json({
      message: deliveryResult.message,
      channel: deliveryResult.channel,
      expires_in_seconds: 300,
      demo_note: DEMO_MODE && !IS_PRODUCTION ? `Demo OTP: ${otpCode}` : null,
      phone: cleanPhone
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login-otp', (req, res, next) => {
  try {
    const cleanPhone = normalizePhone(req.body?.phone);
    if (!cleanPhone) throw new HttpError(400, 'Phone number is required');
    const otp = String(req.body?.otp || '').trim();
    if (!/^\d{6}$/.test(otp)) {
      throw new HttpError(400, 'OTP must be a 6-digit code');
    }

    const clientIp = req.ip || 'unknown';
    checkRateLimit(`otp_verify:${clientIp}`, 15, 60);

    const user = getUserByPhone(cleanPhone);
    if (!user) {
      throw new HttpError(401, 'Invalid phone number or OTP');
    }
    if (!user.is_approved) {
      throw new HttpError(403, 'Account is pending administrator approval');
    }

    const now = new Date();
    if (user.locked_until && user.locked_until > now) {
      const remainingMins = Math.max(1, Math.floor((user.locked_until - now) / 60000));
      throw new HttpError(
        403,
        `Account locked due to failed attempts. Try again in ${remainingMins} minutes.`
      );
    }

    try {
      verifyOtp(cleanPhone, otp);
    } catch (err) {
      const nextFailed = (user.failed_attempts || 0) + 1;
      if (nextFailed >= 5) {
        updateUserAuthState(user.id, 0, new Date(now.getTime() + 15 * 60000));
      } else {
        updateUserAuthState(user.id, nextFailed, null);
      }
      throw err;
    }

    updateUserAuthState(user.id, 0, null);
    const accessToken = createAccessToken(user.id, user.role);
    return res.json({
      access_token: accessToken,
      token_type: 'bearer',
      user: formatUser(user)
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login-password', (req, res, next) => {
  try {
    const cleanEmail = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!cleanEmail || !password) {
      throw new HttpError(400, 'Email and password are required');
    }

    const clientIp = req.ip || 'unknown';
    checkRateLimit(`password_login:${clientIp}`, RATE_LIMIT_AUTH_PER_MINUTE, 60);

    const user = getUserByEmail(cleanEmail);
    const now = new Date();

    if (!user) {
      throw new HttpError(401, 'Invalid email or password');
    }

    if (!user.is_approved) {
      throw new HttpError(403, 'Account is pending administrator approval');
    }

    if (user.locked_until && user.locked_until > now) {
      const remainingMins = Math.max(1, Math.floor((user.locked_until - now) / 60000));
      throw new HttpError(
        403,
        `Account locked due to consecutive failed attempts. Try again in ${remainingMins} minutes.`
      );
    }

    if (!user.password_hash) {
      throw new HttpError(
        401,
        'No password configured for this account. Complete administrator setup or authenticate via OTP.'
      );
    }

    if (!verifyPassword(password, user.password_hash)) {
      const nextFailed = (user.failed_attempts || 0) + 1;
      if (nextFailed >= 5) {
        updateUserAuthState(user.id, 0, new Date(now.getTime() + 15 * 60000));
      } else {
        updateUserAuthState(user.id, nextFailed, null);
      }
      throw new HttpError(401, 'Invalid email or password');
    }

    updateUserAuthState(user.id, 0, null);
    const accessToken = createAccessToken(user.id, user.role);
    return res.json({
      access_token: accessToken,
      token_type: 'bearer',
      user: formatUser(user)
    });
  } catch (err) {
    next(err);
  }
});

router.post('/set-password', requireAuth, (req, res, next) => {
  try {
    const validPassword = validatePasswordInput(req.body?.password);
    updateUserPassword(req.currentUser.id, hashPassword(validPassword));
    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

router.post('/setup-password-with-otp', (req, res, next) => {
  try {
    const cleanPhone = normalizePhone(req.body?.phone);
    if (!cleanPhone) throw new HttpError(400, 'Phone number is required');
    const otp = String(req.body?.otp || '').trim();
    if (!/^\d{6}$/.test(otp)) throw new HttpError(400, 'OTP must be a 6-digit code');
    const validPassword = validatePasswordInput(req.body?.new_password);

    const user = getUserByPhone(cleanPhone);
    if (!user) throw new HttpError(404, 'User not found');

    verifyOtp(cleanPhone, otp);
    updateUserPassword(user.id, hashPassword(validPassword));

    const accessToken = createAccessToken(user.id, user.role);
    return res.json({
      message: 'Password configured successfully. Signed in.',
      access_token: accessToken,
      token_type: 'bearer',
      user: formatUser(user)
    });
  } catch (err) {
    next(err);
  }
});

router.post('/demo-switch', (req, res, next) => {
  try {
    if (IS_PRODUCTION || !DEMO_MODE) {
      throw new HttpError(
        403,
        'Demo switching is disabled. Set DEMO_MODE=true in a non-production environment only.'
      );
    }
    const targetId = Number(req.body?.user_id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
      throw new HttpError(400, 'Valid user_id is required');
    }
    const user = getUserById(targetId);
    if (!user) throw new HttpError(404, 'User not found');

    // Never allow unauthenticated switching into privileged administrator accounts
    if (user.role === 'admin' || user.role === 'fpo_admin') {
      throw new HttpError(
        403,
        'Administrator and FPO administrator accounts require verified credential authentication.'
      );
    }

    const accessToken = createAccessToken(user.id, user.role);
    return res.json({
      access_token: accessToken,
      token_type: 'bearer',
      user: formatUser(user)
    });
  } catch (err) {
    next(err);
  }
});

router.post('/signup', (req, res, next) => {
  try {
    const body = req.body || {};
    const clientIp = req.ip || 'unknown';
    checkRateLimit(`signup:${clientIp}`, 5, 60);

    const cleanName = validateNameInput(body.name);
    const cleanPhone = normalizePhone(body.phone);
    const cleanEmail = normalizeEmail(body.email);

    if (!cleanPhone && !cleanEmail) {
      throw new HttpError(400, 'Either a valid 10-digit phone number or email address is required');
    }

    const requestedRole = String(body.role || 'farmer').trim().toLowerCase();
    if (!PUBLIC_ALLOWED_ROLES.has(requestedRole)) {
      throw new HttpError(
        403,
        'Public registration only allows Farmer or Buyer accounts. Administrator accounts must be created by an authorized administrator.'
      );
    }

    const validPassword = validatePasswordInput(body.password);

    if (cleanPhone && getUserByPhone(cleanPhone)) {
      throw new HttpError(400, 'Phone number already registered');
    }
    if (cleanEmail && getUserByEmail(cleanEmail)) {
      throw new HttpError(400, 'Email already registered');
    }

    const locality = String(body.locality || 'Kolar, Karnataka').trim().slice(0, 120) || 'Kolar, Karnataka';
    const fpoId = String(body.fpo_id || 'FPO-KOLAR-01').trim().slice(0, 60) || 'FPO-KOLAR-01';
    const langPref = body.language_preference === 'hi' ? 'hi' : 'en';

    const newUser = createUser({
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      password_hash: hashPassword(validPassword),
      role: requestedRole,
      fpo_id: fpoId,
      locality,
      language_preference: langPref,
      is_approved: true
    });

    const accessToken = createAccessToken(newUser.id, newUser.role);
    return res.status(201).json({
      message: 'User registered successfully',
      access_token: accessToken,
      token_type: 'bearer',
      user: formatUser(newUser)
    });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/create-user', requireRole('admin'), (req, res, next) => {
  try {
    const body = req.body || {};
    const cleanName = validateNameInput(body.name);
    const cleanPhone = normalizePhone(body.phone);
    const cleanEmail = normalizeEmail(body.email);

    if (!cleanPhone && !cleanEmail) {
      throw new HttpError(400, 'Phone number or email address is required');
    }

    const requestedRole = String(body.role || 'fpo_admin').trim().toLowerCase();
    if (!ALL_VALID_ROLES.has(requestedRole)) {
      throw new HttpError(400, `Invalid role '${body.role}'`);
    }

    const validPassword = validatePasswordInput(body.password);

    if (cleanPhone && getUserByPhone(cleanPhone)) {
      throw new HttpError(400, 'Phone number already registered');
    }
    if (cleanEmail && getUserByEmail(cleanEmail)) {
      throw new HttpError(400, 'Email already registered');
    }

    const newUser = createUser({
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      password_hash: hashPassword(validPassword),
      role: requestedRole,
      fpo_id: String(body.fpo_id || 'FPO-KOLAR-01').trim().slice(0, 60),
      locality: String(body.locality || 'Kolar, Karnataka').trim().slice(0, 120),
      language_preference: body.language_preference === 'hi' ? 'hi' : 'en',
      is_approved: body.is_approved !== false
    });

    return res.status(201).json({
      message: `Account created for ${newUser.name} (${newUser.role})`,
      user: formatUser(newUser)
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users', requireRole('admin', 'fpo_admin'), (req, res) => {
  res.json(
    listUsers().map((u) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      email: u.email,
      role: u.role,
      locality: u.locality,
      fpo_id: u.fpo_id,
      is_approved: u.is_approved
    }))
  );
});

router.get('/me', requireAuth, (req, res) => {
  const u = req.currentUser;
  res.json({
    ...formatUser(u),
    is_approved: u.is_approved
  });
});

export default router;
