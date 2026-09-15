export class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} message Human readable message, safe to show to users
   * @param {object} [options]
   * @param {string} [options.code] Machine readable error code
   * @param {Array<{ path: string, message: string }>} [options.details] Field-level errors
   */
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Bad request', options) {
    return new ApiError(400, message, { code: 'BAD_REQUEST', ...options });
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message, { code: 'UNAUTHORIZED' });
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message, { code: 'FORBIDDEN' });
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message, { code: 'NOT_FOUND' });
  }

  static conflict(message = 'Conflict', options) {
    return new ApiError(409, message, { code: 'CONFLICT', ...options });
  }
}
