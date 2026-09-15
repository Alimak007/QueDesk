import { env } from '../../config/env.js';
import toMilliseconds from '../../utils/duration.js';
import { ok } from '../../utils/response.js';
import * as authService from './auth.service.js';

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? 'strict' : 'lax',
  path: '/',
});

function setAuthCookie(res, token) {
  res.cookie(env.COOKIE_NAME, token, { ...cookieOptions(), maxAge: toMilliseconds(env.JWT_EXPIRES_IN) });
}

export async function login(req, res) {
  const { user, token } = await authService.login(req.valid.body);
  setAuthCookie(res, token);
  return ok(res, { user });
}

export async function logout(_req, res) {
  res.clearCookie(env.COOKIE_NAME, cookieOptions());
  return ok(res, { loggedOut: true });
}

export async function me(req, res) {
  return ok(res, { user: req.user });
}

export async function updateProfile(req, res) {
  const user = await authService.updateProfile(req.user.id, req.valid.body);
  return ok(res, { user });
}

export async function changePassword(req, res) {
  const { user, token } = await authService.changePassword(req.user.id, req.valid.body);
  setAuthCookie(res, token);
  return ok(res, { user });
}
