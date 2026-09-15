import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

let unauthorizedHandler = null;

/** Registered by the auth provider so an expired session signs the user out everywhere. */
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url ?? '';
    if (status === 401 && !url.includes('/auth/login')) {
      unauthorizedHandler?.();
    }
    return Promise.reject(normalizeError(error));
  },
);

export class ApiRequestError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details ?? [];
  }
}

function normalizeError(error) {
  if (error.response) {
    const body = error.response.data?.error ?? {};
    return new ApiRequestError(body.message || 'Something went wrong', {
      status: error.response.status,
      code: body.code,
      details: body.details,
    });
  }
  if (error.code === 'ECONNABORTED') {
    return new ApiRequestError('The request timed out. Please try again.', { code: 'TIMEOUT' });
  }
  return new ApiRequestError('Unable to reach the server. Check your connection.', { code: 'NETWORK' });
}

/** Unwraps the `{ success, data }` envelope. */
export const unwrap = (promise) => promise.then((res) => res.data?.data);

export const http = {
  get: (url, params) => unwrap(api.get(url, { params })),
  post: (url, body) => unwrap(api.post(url, body)),
  put: (url, body) => unwrap(api.put(url, body)),
  patch: (url, body) => unwrap(api.patch(url, body)),
  delete: (url) => unwrap(api.delete(url)),
};

/** Strips empty values so they are not sent as query params. */
export function cleanParams(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined));
}

/**
 * Maps field-level API errors onto a react-hook-form instance.
 * Returns true when at least one field error was applied.
 */
export function applyServerErrors(error, setError, { prefix = '' } = {}) {
  if (!error?.details?.length) return false;
  let applied = false;
  for (const { path, message } of error.details) {
    if (!path) continue;
    setError(`${prefix}${path}`, { type: 'server', message });
    applied = true;
  }
  return applied;
}
