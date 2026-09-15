import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { USER_STATUS } from '../../constants/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { User } from '../users/user.model.js';

// Compared against when the email does not exist, so response time does not
// reveal whether an account is registered.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, tv: user.tokenVersion }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

export async function login({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');

  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (user.status !== USER_STATUS.ACTIVE) {
    throw ApiError.forbidden('Your account has been deactivated. Please contact your administrator.');
  }

  user.lastLoginAt = new Date();
  await user.save();

  return { user, token: signToken(user) };
}

export async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');

  if (!(await user.verifyPassword(currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect', {
      code: 'VALIDATION_ERROR',
      details: [{ path: 'currentPassword', message: 'Current password is incorrect' }],
    });
  }

  await user.setPassword(newPassword);
  user.tokenVersion += 1;
  await user.save();

  // A fresh token keeps the current session alive while revoking all others.
  return { user, token: signToken(user) };
}

export async function updateProfile(userId, updates) {
  const user = await User.findByIdAndUpdate(userId, updates, {
    returnDocument: 'after',
    runValidators: true,
  });
  if (!user) throw ApiError.notFound('User not found');
  return user;
}
