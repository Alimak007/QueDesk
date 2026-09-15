import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

function normalizeError(err) {
  if (err instanceof ApiError) return err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return ApiError.badRequest(details[0]?.message || 'Validation failed', {
      code: 'VALIDATION_ERROR',
      details,
    });
  }

  if (err instanceof mongoose.Error.CastError) {
    return ApiError.badRequest(`Invalid value for ${err.path}`);
  }

  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || err.keyPattern || {})[0] || 'field';
    return ApiError.conflict(`A record with this ${field} already exists`, {
      code: 'DUPLICATE_KEY',
      details: [{ path: field, message: `This ${field} is already in use` }],
    });
  }

  if (err?.type === 'entity.parse.failed') {
    return ApiError.badRequest('Malformed JSON body');
  }

  if (err?.type === 'entity.too.large') {
    return new ApiError(413, 'Request body is too large');
  }

  return null;
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const apiError = normalizeError(err);

  if (!apiError) {
    (req.log || logger).error({ err }, 'Unhandled error');
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong. Please try again later.',
        ...(env.isProduction ? {} : { stack: err?.stack }),
      },
    });
  }

  if (apiError.statusCode >= 500) {
    (req.log || logger).error({ err }, apiError.message);
  }

  return res.status(apiError.statusCode).json({
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details ? { details: apiError.details } : {}),
    },
  });
}
