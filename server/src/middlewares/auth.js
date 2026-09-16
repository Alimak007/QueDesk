import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { USER_STATUS } from '../constants/index.js';
import { User } from '../modules/users/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { can } from '../utils/permissions.js';

function extractToken(req) {
  const cookieToken = req.cookies?.[env.COOKIE_NAME];
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Authenticates the request. The user is re-loaded from the database on every
 * request so that deactivation, role changes and password resets take effect
 * immediately rather than when the token expires.
 */
export async function authenticate(req, _res, next) {
  const result = await resolveUser(req);
  if (result.error) throw ApiError.unauthorized(result.error);
  req.user = result.user;
  next();
}

/** Attaches `req.user` when a valid session exists, but never rejects the request. */
export async function optionalAuthenticate(req, _res, next) {
  const result = await resolveUser(req);
  req.user = result.user ?? null;
  next();
}

async function resolveUser(req) {
  const token = extractToken(req);
  if (!token) return { error: 'Authentication required' };

  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return { error: 'Your session has expired. Please sign in again.' };
  }

  const user = await User.findById(payload.sub);
  if (!user || user.tokenVersion !== payload.tv) {
    return { error: 'Your session is no longer valid. Please sign in again.' };
  }
  if (user.status !== USER_STATUS.ACTIVE) {
    return { error: 'Your account has been deactivated.' };
  }
  return { user };
}

/**
 * Requires at least one of `actions` on `module` (admins always pass).
 * Must run after `authenticate`.
 */
export function requirePermission(module, ...actions) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!can(req.user, module, ...actions)) return next(ApiError.forbidden());
    return next();
  };
}

/** Restricts a route to the given roles. Must run after `authenticate`. */
export function authorize(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };
}
