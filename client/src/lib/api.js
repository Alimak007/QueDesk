import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 20000,
  // No global Content-Type: axios picks JSON for plain objects and
  // multipart/form-data (with the required boundary) for FormData uploads.
});

let unauthorizedHandler = null;

/** Registered by the auth provider so an expired session signs the user out everywhere. */
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

/**
 * A failed blob request (a PDF download) carries its JSON error as a Blob,
 * so the real message has to be read out before the error can be described.
 */
async function readBlobError(error) {
  const data = error.response?.data;
  if (!(data instanceof Blob)) return;
  try {
    error.response.data = JSON.parse(await data.text());
  } catch {
    error.response.data = undefined;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    await readBlobError(error);
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

/** 502/503/504 come from the dev proxy or a load balancer, not from the API itself. */
const GATEWAY_STATUSES = [502, 503, 504];

function normalizeError(error) {
  if (error.response) {
    const { status } = error.response;
    const body = error.response.data?.error ?? {};

    // A gateway error with no message of ours came from the proxy: the API is down.
    if (!body.message && GATEWAY_STATUSES.includes(status)) {
      return new ApiRequestError('The server is not responding. It may still be starting up.', {
        status,
        code: 'SERVER_UNAVAILABLE',
      });
    }
    return new ApiRequestError(body.message || 'Something went wrong', {
      status,
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

/** Fetches a binary document (PDF) as a Blob, keeping the session cookie. */
export const getBlob = (url, params) => api.get(url, { params, responseType: 'blob' }).then((res) => res.data);

/** Saves a Blob to the user's device. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

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
