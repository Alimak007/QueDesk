import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../utils/logger.js';
import { Asset } from '../companies/asset.model.js';
import { PDF_SAFE_FORMATS } from './imageFormat.js';

/**
 * Stores company branding images (logos and signatures).
 *
 * Cloudinary is used when it is configured; otherwise the images are kept in
 * MongoDB, so the app (and the test suite) still works with no external service.
 * Either way the bytes are only ever served through the authenticated
 * `/api/companies/:id/:kind` endpoint — the storage URL is never exposed.
 */
const CLOUDINARY_FORMATS = ['png', 'jpeg', 'webp', 'gif', 'avif', 'heic', 'bmp', 'tiff'];
const FOLDER = 'quedesk/companies';

let configured = false;

export function isCloudinaryConfigured() {
  // Tests always use the database driver so they never reach the network.
  if (env.isTest) return false;
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}

function client() {
  if (!configured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
}

/** Formats an upload may use. Cloudinary normalises the web formats for us. */
export function supportedUploadFormats() {
  return isCloudinaryConfigured() ? CLOUDINARY_FORMATS : PDF_SAFE_FORMATS;
}

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = client().uploader.upload_stream(options, (error, result) => (error ? reject(error) : resolve(result)));
    stream.end(buffer);
  });
}

/**
 * Saves an image and returns the descriptor stored on the company.
 * `previous` (if any) is removed once the new image is safely in place.
 */
export async function storeImage({ file, kind, companyId, uploadedBy, previous }) {
  const detected = file.detected ?? { format: 'png', mimeType: file.mimetype };

  let asset;
  if (isCloudinaryConfigured()) {
    // A random suffix keeps the delivery URL unguessable.
    const publicId = `${kind}-${crypto.randomBytes(6).toString('hex')}`;
    const result = await uploadToCloudinary(file.buffer, {
      folder: `${FOLDER}/${companyId}`,
      public_id: publicId,
      resource_type: 'image',
      overwrite: true,
    });
    asset = {
      provider: 'cloudinary',
      publicId: result.public_id,
      version: String(result.version ?? ''),
      format: result.format ?? detected.format,
      mimeType: `image/${result.format ?? detected.format}`,
      bytes: result.bytes ?? file.size,
      width: result.width ?? null,
      height: result.height ?? null,
      uploadedAt: new Date(),
    };
  } else {
    const stored = await Asset.create({
      kind,
      mimeType: detected.mimeType,
      size: file.size,
      originalName: file.originalname,
      data: file.buffer,
      uploadedBy,
    });
    asset = {
      provider: 'database',
      assetId: stored._id,
      format: detected.format,
      mimeType: detected.mimeType,
      bytes: file.size,
      uploadedAt: new Date(),
    };
  }

  if (previous) await removeImage(previous);
  return asset;
}

/** Deletes a stored image; failures are logged but never block the request. */
export async function removeImage(asset) {
  if (!asset) return;
  try {
    if (asset.provider === 'cloudinary' && asset.publicId) {
      await client().uploader.destroy(asset.publicId, { resource_type: 'image', invalidate: true });
    } else if (asset.assetId) {
      await Asset.deleteOne({ _id: asset.assetId });
    }
  } catch (err) {
    logger.error({ err, publicId: asset.publicId }, 'Could not delete stored image');
  }
}

/**
 * Returns the image bytes. With `forPdf` the image is delivered as PNG when the
 * stored format is something pdfkit cannot embed (WebP, AVIF, HEIC…).
 */
export async function getImageBuffer(asset, { forPdf = false } = {}) {
  if (!asset) return null;

  if (asset.provider === 'cloudinary') {
    const needsConversion = forPdf && !PDF_SAFE_FORMATS.includes(asset.format);
    const url = client().url(asset.publicId, {
      secure: true,
      resource_type: 'image',
      ...(asset.version ? { version: asset.version } : {}),
      ...(needsConversion ? { format: 'png' } : { format: asset.format }),
    });

    const response = await fetch(url);
    if (!response.ok) throw new ApiError(502, 'The stored image could not be retrieved');
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      mimeType: needsConversion ? 'image/png' : asset.mimeType,
    };
  }

  const stored = await Asset.findById(asset.assetId);
  if (!stored) return null;
  return { buffer: stored.data, mimeType: stored.mimeType };
}

/**
 * An image ready for pdfkit (`{ data }`), converted to PNG if needed.
 * Returns null rather than throwing: a missing logo must not stop a document
 * from being generated.
 */
export async function loadPdfImage(asset) {
  if (!asset) return null;
  try {
    const image = await getImageBuffer(asset, { forPdf: true });
    return image ? { data: image.buffer, mimeType: image.mimeType } : null;
  } catch (err) {
    logger.error({ err }, 'Could not load a company image for the document');
    return null;
  }
}
