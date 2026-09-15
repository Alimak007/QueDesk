import { ApiError } from '../utils/ApiError.js';

/**
 * Validates `body`, `query` and `params` against zod schemas.
 * Parsed (coerced + stripped) values are exposed on `req.valid` because
 * Express 5 makes `req.query` read-only.
 *
 * @param {{ body?: import('zod').ZodType, query?: import('zod').ZodType, params?: import('zod').ZodType }} schemas
 */
export function validate(schemas) {
  return (req, _res, next) => {
    req.valid = req.valid || {};
    const details = [];

    for (const source of ['params', 'query', 'body']) {
      const schema = schemas[source];
      if (!schema) continue;

      const result = schema.safeParse(req[source] ?? {});
      if (result.success) {
        req.valid[source] = result.data;
      } else {
        for (const issue of result.error.issues) {
          details.push({ path: issue.path.join('.') || source, message: issue.message });
        }
      }
    }

    if (details.length) {
      return next(ApiError.badRequest(details[0].message, { code: 'VALIDATION_ERROR', details }));
    }
    return next();
  };
}
