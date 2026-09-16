import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { detectImageFormat } from '../modules/documents/imageFormat.js';
import { supportedUploadFormats } from '../modules/documents/imageStore.js';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
});

const listFormats = (formats) => formats.map((f) => f.toUpperCase()).join(', ');

/**
 * Accepts a single image in the `file` field and verifies what it actually is.
 * The declared content type is ignored: only the file's own bytes decide.
 */
export function uploadImage(req, res, next) {
  if (!req.is('multipart/form-data')) {
    return next(ApiError.badRequest('The image must be sent as multipart/form-data with a "file" field'));
  }

  return upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new ApiError(413, 'Image must be 5 MB or smaller'));
      return next(err instanceof ApiError ? err : ApiError.badRequest(err.message || 'Upload failed'));
    }
    if (!req.file) return next(ApiError.badRequest('Choose an image to upload'));

    const allowed = supportedUploadFormats();
    const detected = detectImageFormat(req.file.buffer);

    if (!detected) {
      logger.warn(
        { declared: req.file.mimetype, bytes: req.file.size, head: req.file.buffer.subarray(0, 12).toString('hex') },
        'Upload rejected: unrecognised file contents',
      );
      return next(ApiError.badRequest(`That file is not a recognisable image. Supported formats: ${listFormats(allowed)}.`));
    }

    if (!allowed.includes(detected.format)) {
      // Name the real format so a mislabelled file (e.g. a WebP saved as .png) is obvious.
      return next(
        ApiError.badRequest(
          `This file is a ${detected.format.toUpperCase()} image${
            req.file.mimetype && req.file.mimetype !== detected.mimeType ? ` (its name says ${req.file.mimetype})` : ''
          }. Supported formats: ${listFormats(allowed)}.`,
        ),
      );
    }

    // Hand the verified type downstream rather than the browser's guess.
    req.file.detected = detected;
    return next();
  });
}
