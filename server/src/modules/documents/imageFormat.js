/**
 * Detects an image's real format from its leading bytes. Browsers and operating
 * systems often mislabel files (a WebP saved as `.png` is very common), so the
 * declared content type is never trusted.
 */
const SIGNATURES = [
  { format: 'png', mimeType: 'image/png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { format: 'jpeg', mimeType: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    format: 'webp',
    mimeType: 'image/webp',
    test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
  { format: 'gif', mimeType: 'image/gif', test: (b) => b.subarray(0, 3).toString('latin1') === 'GIF' },
  {
    format: 'avif',
    mimeType: 'image/avif',
    test: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' && /avif|avis/.test(b.subarray(8, 12).toString('latin1')),
  },
  {
    format: 'heic',
    mimeType: 'image/heic',
    test: (b) => b.subarray(4, 8).toString('latin1') === 'ftyp' && /heic|heix|mif1/.test(b.subarray(8, 12).toString('latin1')),
  },
  { format: 'bmp', mimeType: 'image/bmp', test: (b) => b[0] === 0x42 && b[1] === 0x4d },
  { format: 'tiff', mimeType: 'image/tiff', test: (b) => (b[0] === 0x49 && b[1] === 0x49) || (b[0] === 0x4d && b[1] === 0x4d) },
  { format: 'svg', mimeType: 'image/svg+xml', test: (b) => /<svg|<\?xml/i.test(b.subarray(0, 200).toString('latin1')) },
  { format: 'pdf', mimeType: 'application/pdf', test: (b) => b.subarray(0, 4).toString('latin1') === '%PDF' },
];

/** Returns `{ format, mimeType }`, or null when the bytes are not a known image. */
export function detectImageFormat(buffer) {
  if (!buffer || buffer.length < 12) return null;
  const match = SIGNATURES.find((s) => {
    try {
      return s.test(buffer);
    } catch {
      return false;
    }
  });
  return match ? { format: match.format, mimeType: match.mimeType } : null;
}

/** Formats that pdfkit can embed directly. */
export const PDF_SAFE_FORMATS = ['png', 'jpeg'];
