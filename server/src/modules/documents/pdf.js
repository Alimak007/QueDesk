import PDFDocument from 'pdfkit';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** Open Sans is close to the fonts used in the supplied templates. */
const FONT_FILES = {
  regular: '@fontsource/open-sans/files/open-sans-latin-400-normal.woff',
  semibold: '@fontsource/open-sans/files/open-sans-latin-600-normal.woff',
  bold: '@fontsource/open-sans/files/open-sans-latin-700-normal.woff',
  italic: '@fontsource/open-sans/files/open-sans-latin-400-italic.woff',
};

export const FONTS = { regular: 'body', semibold: 'body-semibold', bold: 'body-bold', italic: 'body-italic' };

export const COLORS = {
  navy: '#1F3864',
  headerBar: '#1F4E79',
  tableHead: '#17375E',
  accent: '#2E74B5',
  soft: '#DDEBF7',
  softAlt: '#F2F7FC',
  border: '#BFC8D6',
  line: '#D9D9D9',
  text: '#1A1A1A',
  muted: '#595959',
  light: '#7F7F7F',
  white: '#FFFFFF',
};

/** Registers the embedded fonts, falling back to the built-ins if a file is missing. */
function registerFonts(doc) {
  try {
    for (const [weight, file] of Object.entries(FONT_FILES)) {
      doc.registerFont(FONTS[weight], require.resolve(file));
    }
  } catch {
    doc.registerFont(FONTS.regular, 'Helvetica');
    doc.registerFont(FONTS.semibold, 'Helvetica-Bold');
    doc.registerFont(FONTS.bold, 'Helvetica-Bold');
    doc.registerFont(FONTS.italic, 'Helvetica-Oblique');
  }
}

export function createDocument({ margin = 40, title, author } = {}) {
  const doc = new PDFDocument({ size: 'A4', margin, bufferPages: true, info: { Title: title, Author: author } });
  registerFonts(doc);
  doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.text);
  return doc;
}

/** Runs the generator and resolves with the finished PDF as a Buffer. */
export function renderToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

export const contentWidth = (doc) => doc.page.width - doc.page.margins.left - doc.page.margins.right;
export const rightEdge = (doc) => doc.page.width - doc.page.margins.right;
export const bottomEdge = (doc) => doc.page.height - doc.page.margins.bottom;

/** Starts a new page when `needed` points would overflow the current one. */
export function ensureSpace(doc, needed, onNewPage) {
  if (doc.y + needed <= bottomEdge(doc)) return false;
  doc.addPage();
  onNewPage?.(doc);
  return true;
}

export function line(doc, y, { color = COLORS.line, width = 0.8, from, to } = {}) {
  doc
    .save()
    .moveTo(from ?? doc.page.margins.left, y)
    .lineTo(to ?? rightEdge(doc), y)
    .lineWidth(width)
    .strokeColor(color)
    .stroke()
    .restore();
}

/** Draws an image asset scaled to fit the box, anchored to its right or left edge. */
export function drawAsset(doc, asset, { x, y, width, height, align = 'left' }) {
  if (!asset?.data) return 0;
  try {
    const options = { fit: [width, height], align, valign: 'center' };
    doc.image(asset.data, x, y, options);
    return height;
  } catch {
    return 0; // A corrupt image must never break document generation.
  }
}

export function textBlock(doc, text, x, y, options = {}) {
  doc.text(String(text ?? ''), x, y, { lineBreak: false, ...options });
}

/** "Page 1 of 3" in the bottom-right corner of every page. */
export function addPageNumbers(doc, { label = 'Page' } = {}) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    const y = doc.page.height - doc.page.margins.bottom + 12;
    // Writing below the bottom margin would otherwise spill onto a new page.
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font(FONTS.regular)
      .fontSize(7.5)
      .fillColor(COLORS.light)
      .text(`${label} ${i - range.start + 1} of ${range.count}`, doc.page.margins.left, y, {
        width: contentWidth(doc),
        align: 'right',
        lineBreak: false,
      });
    doc.page.margins.bottom = bottom;
  }
  doc.flushPages();
}
