import { format, parseISO } from 'date-fns';
import { amountInWords, formatAmount } from '../documents/money.js';
import { loadPdfImage } from '../documents/imageStore.js';
import {
  COLORS,
  FONTS,
  addPageNumbers,
  bottomEdge,
  contentWidth,
  createDocument,
  drawAsset,
  line,
  renderToBuffer,
  rightEdge,
} from '../documents/pdf.js';

const fmtDate = (value) => (value ? format(parseISO(value), 'd-MMM-yyyy') : '—');

/** Renders the tax invoice following the supplied template. */
export async function renderInvoicePdf(invoice, company) {
  const doc = createDocument({ margin: 40, title: invoice.invoiceNumber, author: company.name });
  const [logo, signature] = await Promise.all([loadPdfImage(company.logo), loadPdfImage(company.signature)]);

  const left = doc.page.margins.left;
  const right = rightEdge(doc);
  const width = contentWidth(doc);
  const currency = invoice.currency || company.currency;
  const money = (value) => formatAmount(value, currency, { forceDecimals: true });
  const seller = invoice.seller ?? {};
  const settings = company.invoice ?? {};

  /* Header ---------------------------------------------------------------- */
  let y = 34;
  if (logo) drawAsset(doc, logo, { x: left, y, width: 150, height: 58 });

  // Without a logo the seller block starts at the margin instead of leaving a gap.
  const sellerX = logo ? left + 168 : left;
  const sellerWidth = (logo ? width - 168 : width) - 170;
  doc.font(FONTS.bold).fontSize(12).fillColor(COLORS.navy);
  doc.text(seller.name ?? company.name, sellerX, y, { width: sellerWidth });
  doc.font(FONTS.semibold).fontSize(8.5).fillColor(COLORS.muted);
  doc.text(seller.address ?? company.address ?? '', sellerX, doc.y + 2, { width: sellerWidth, lineGap: 1 });
  const taxLine = [seller.taxLabel ?? company.taxLabel, seller.taxNumber ?? company.taxNumber].filter(Boolean).join(': ');
  if (taxLine) doc.font(FONTS.bold).fillColor(COLORS.text).text(taxLine, sellerX, doc.y + 3, { width: sellerWidth });

  doc.font(FONTS.bold).fontSize(17).fillColor(COLORS.navy);
  doc.text(settings.title || 'TAX INVOICE', right - 200, y + 2, { width: 200, align: 'right' });
  doc.font(FONTS.semibold).fontSize(9.5).fillColor(COLORS.accent);
  doc.text(invoice.invoiceNumber, right - 200, y + 24, { width: 200, align: 'right' });

  y = Math.max(doc.y, y + 62) + 14;
  line(doc, y, { color: COLORS.border, width: 1 });

  /* Meta blocks ------------------------------------------------------------ */
  y += 12;
  const metaCols = [
    [
      ['Invoice Date', fmtDate(invoice.invoiceDate)],
      ['P.O. No.', invoice.poNumber || '—'],
    ],
    [
      ['Due Date', fmtDate(invoice.dueDate)],
      ['P.O. Date', invoice.poDate ? fmtDate(invoice.poDate) : '—'],
    ],
    [['Terms', invoice.paymentTerms || settings.paymentTerms || '—']],
  ];
  const metaWidth = width / 3;
  metaCols.forEach((block, colIndex) => {
    let blockY = y;
    for (const [label, value] of block) {
      const x = left + colIndex * metaWidth;
      doc.save().rect(x, blockY, 2.5, 30).fill(COLORS.accent).restore();
      doc.font(FONTS.bold).fontSize(9.5).fillColor(COLORS.accent).text(label, x + 10, blockY, { width: metaWidth - 20, lineBreak: false });
      doc.font(FONTS.semibold).fontSize(9).fillColor(COLORS.text).text(value, x + 10, blockY + 14, { width: metaWidth - 20, ellipsis: true, lineBreak: false });
      blockY += 38;
    }
  });
  y += metaCols[0].length * 38 + 4;

  /* Bill to / Ship to ------------------------------------------------------ */
  const showShipTo = settings.showShipTo !== false;
  const boxWidth = showShipTo ? (width - 14) / 2 : width;
  const parties = [['BILL TO', invoice.billTo], ...(showShipTo ? [['SHIP TO', invoice.shipTo]] : [])];

  const partyHeights = parties.map(([, party]) => {
    const textWidth = boxWidth - 24;
    return (
      30 +
      doc.font(FONTS.bold).fontSize(9.5).heightOfString(party?.name || '—', { width: textWidth }) +
      doc.font(FONTS.regular).fontSize(8.5).heightOfString(party?.address || '', { width: textWidth, lineGap: 1 }) +
      (party?.taxNumber ? 14 : 0)
    );
  });
  const boxHeight = Math.max(...partyHeights, 78);

  parties.forEach(([title, party], index) => {
    const x = left + index * (boxWidth + 14);
    doc.save().roundedRect(x, y, boxWidth, boxHeight, 3).lineWidth(0.8).strokeColor(COLORS.border).stroke().restore();
    doc.font(FONTS.bold).fontSize(9).fillColor(COLORS.accent).text(title, x + 12, y + 10, { width: boxWidth - 24 });
    line(doc, y + 24, { from: x + 12, to: x + boxWidth - 12, color: COLORS.line });
    doc.font(FONTS.bold).fontSize(9.5).fillColor(COLORS.text).text(party?.name || '—', x + 12, y + 30, { width: boxWidth - 24 });
    doc.font(FONTS.regular).fontSize(8.5).fillColor(COLORS.muted).text(party?.address || '', x + 12, doc.y, { width: boxWidth - 24, lineGap: 1 });
    if (party?.taxNumber) {
      doc.font(FONTS.bold).fontSize(8.5).fillColor(COLORS.text).text(`TRN: ${party.taxNumber}`, x + 12, doc.y + 2, { width: boxWidth - 24 });
    }
  });
  y += boxHeight + 16;

  /* Line items ------------------------------------------------------------- */
  const hasDiscount = invoice.items.some((i) => i.discountPercent > 0);
  const columns = [
    { key: 'index', label: '#', width: 30, align: 'left' },
    { key: 'description', label: 'Item & Description', width: 0, align: 'left' },
    { key: 'quantity', label: settings.quantityLabel || 'Qty', width: 52, align: 'right' },
    { key: 'rate', label: 'Rate', width: 64, align: 'right' },
    ...(hasDiscount ? [{ key: 'discountPercent', label: 'Disc %', width: 46, align: 'right' }] : []),
    { key: 'taxRate', label: 'Tax %', width: 44, align: 'right' },
    { key: 'taxAmount', label: 'Tax', width: 62, align: 'right' },
    { key: 'amount', label: 'Amount', width: 72, align: 'right' },
  ];
  const fixed = columns.reduce((sum, c) => sum + c.width, 0);
  columns.find((c) => c.key === 'description').width = width - fixed;

  const drawItemsHeader = (top) => {
    doc.save().rect(left, top, width, 24).fill(COLORS.tableHead).restore();
    let x = left;
    doc.font(FONTS.bold).fontSize(8.5).fillColor(COLORS.white);
    for (const col of columns) {
      doc.text(col.label, x + 6, top + 7.5, { width: col.width - 12, align: col.align, lineBreak: false });
      x += col.width;
    }
    return top + 24;
  };

  y = drawItemsHeader(y);
  doc.y = y;

  invoice.items.forEach((item, index) => {
    const descriptionWidth = columns[1].width - 12;
    const textHeight = doc.font(FONTS.regular).fontSize(9).heightOfString(item.description, { width: descriptionWidth });
    const rowHeight = Math.max(textHeight + 12, 26);

    // Keep the table readable across pages: repeat the header after a break.
    if (doc.y + rowHeight > bottomEdge(doc) - 40) {
      doc.addPage();
      doc.y = drawItemsHeader(doc.page.margins.top);
    }
    const top = doc.y;

    if (index % 2 === 1) doc.save().rect(left, top, width, rowHeight).fill(COLORS.softAlt).restore();

    const values = {
      index: String(index + 1),
      description: item.description,
      quantity: formatAmount(item.quantity, currency),
      rate: money(item.rate),
      discountPercent: item.discountPercent ? `${item.discountPercent}%` : '—',
      taxRate: item.taxRate ? `${item.taxRate}%` : '—',
      taxAmount: money(item.taxAmount),
      amount: money(item.amount),
    };

    let x = left;
    doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.text);
    for (const col of columns) {
      doc.text(values[col.key], x + 6, top + 6, {
        width: col.width - 12,
        align: col.align,
        lineBreak: col.key === 'description',
      });
      x += col.width;
    }
    line(doc, top + rowHeight, { color: COLORS.line, width: 0.5 });
    doc.y = top + rowHeight;
  });

  /* Tax summary + totals ---------------------------------------------------- */
  const totalsRows = [
    ['Sub Total', money(invoice.subTotal)],
    ...(invoice.discountTotal ? [['Discount', `- ${money(invoice.discountTotal)}`]] : []),
    ['Total Taxable Amount', money(invoice.taxableAmount)],
    ...invoice.taxSummary.map((t) => [t.label, money(t.tax)]),
  ];
  const summaryHeight = Math.max(60 + invoice.taxSummary.length * 16, totalsRows.length * 20 + 66);

  if (doc.y + summaryHeight + 30 > bottomEdge(doc)) doc.addPage();
  y = doc.y + 18;

  const totalsWidth = 232;
  const summaryWidth = width - totalsWidth - 16;

  // TAX SUMMARY box
  doc.save().rect(left, y, summaryWidth, summaryHeight).fill(COLORS.softAlt).restore();
  doc.font(FONTS.bold).fontSize(9).fillColor(COLORS.accent).text('TAX SUMMARY', left + 12, y + 10, { width: summaryWidth - 24 });
  line(doc, y + 24, { from: left + 12, to: left + summaryWidth - 12, color: COLORS.border });
  let summaryY = y + 32;
  doc.font(FONTS.regular).fontSize(8.5).fillColor(COLORS.muted).text('Currency:', left + 12, summaryY, { width: 70, lineBreak: false });
  doc.font(FONTS.bold).fillColor(COLORS.accent).text(currency, left + 86, summaryY, { width: summaryWidth - 98, lineBreak: false });
  summaryY += 18;
  doc.font(FONTS.regular).fillColor(COLORS.muted).text(`Taxable Amount (${currency}):`, left + 12, summaryY, { width: 150, lineBreak: false });
  doc.font(FONTS.bold).fillColor(COLORS.text).text(money(invoice.taxableAmount), left + summaryWidth - 112, summaryY, { width: 100, align: 'right', lineBreak: false });
  for (const row of invoice.taxSummary) {
    summaryY += 16;
    doc.font(FONTS.regular).fillColor(COLORS.muted).text(`${row.label}:`, left + 12, summaryY, { width: 150, lineBreak: false });
    doc.font(FONTS.bold).fillColor(COLORS.text).text(money(row.tax), left + summaryWidth - 112, summaryY, { width: 100, align: 'right', lineBreak: false });
  }

  // Totals column
  const totalsX = left + summaryWidth + 16;
  let totalsY = y;
  for (const [label, value] of totalsRows) {
    doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.text).text(label, totalsX, totalsY + 5, { width: totalsWidth - 110, lineBreak: false });
    doc.font(FONTS.bold).text(value, totalsX + totalsWidth - 110, totalsY + 5, { width: 110, align: 'right', lineBreak: false });
    totalsY += 20;
  }
  doc.save().rect(totalsX, totalsY, totalsWidth, 24).fill(COLORS.tableHead).restore();
  doc.font(FONTS.bold).fontSize(10).fillColor(COLORS.white);
  doc.text(`Total (${currency})`, totalsX + 10, totalsY + 7, { width: totalsWidth - 120, lineBreak: false });
  doc.text(money(invoice.total), totalsX + totalsWidth - 110, totalsY + 7, { width: 100, align: 'right', lineBreak: false });
  totalsY += 24;
  doc.save().rect(totalsX, totalsY, totalsWidth, 22).fill(COLORS.soft).restore();
  doc.font(FONTS.bold).fontSize(9.5).fillColor(COLORS.navy);
  doc.text(`Balance Due (${currency})`, totalsX + 10, totalsY + 6, { width: totalsWidth - 120, lineBreak: false });
  doc.text(money(invoice.balanceDue), totalsX + totalsWidth - 110, totalsY + 6, { width: 100, align: 'right', lineBreak: false });

  y = Math.max(y + summaryHeight, totalsY + 22) + 16;

  /* Amount in words -------------------------------------------------------- */
  const wordsHeight = 26;
  if (y + wordsHeight > bottomEdge(doc)) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  doc.save().rect(left, y, width, wordsHeight).fill(COLORS.softAlt).restore();
  doc.font(FONTS.bold).fontSize(8.5).fillColor(COLORS.text).text('Total In Words: ', left + 10, y + 8.5, { continued: true });
  doc.font(FONTS.regular).text(amountInWords(invoice.total, currency));
  y += wordsHeight + 14;

  /* Bank details ----------------------------------------------------------- */
  const bank = seller.bank ?? {};
  const bankRows = [
    ['Bank Name :', bank.bankName, 'Address :', bank.branchAddress],
    ['Account Name:', bank.accountName, 'Account No :', bank.accountNumber],
    ['Swift :', bank.swift, 'IBAN :', bank.iban],
  ].filter((row) => row[1] || row[3]);

  if (bankRows.length) {
    const bankHeight = 34 + bankRows.length * 15;
    if (y + bankHeight > bottomEdge(doc)) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.save().rect(left, y, width, bankHeight).fill(COLORS.softAlt).restore();
    doc.font(FONTS.bold).fontSize(9).fillColor(COLORS.accent).text('BANK DETAILS', left + 12, y + 9, { width: width - 24 });
    line(doc, y + 23, { from: left + 12, to: right - 12, color: COLORS.border });
    let bankY = y + 30;
    const half = width / 2;
    for (const [labelA, valueA, labelB, valueB] of bankRows) {
      doc.font(FONTS.bold).fontSize(8.5).fillColor(COLORS.text).text(labelA, left + 12, bankY, { width: 90, lineBreak: false });
      doc.font(FONTS.regular).fillColor(COLORS.muted).text(valueA || '—', left + 104, bankY, { width: half - 120, align: 'right', lineBreak: false });
      doc.font(FONTS.bold).fillColor(COLORS.text).text(labelB, left + half + 12, bankY, { width: 90, lineBreak: false });
      doc.font(FONTS.regular).fillColor(COLORS.muted).text(valueB || '—', left + half + 104, bankY, { width: half - 120, align: 'right', lineBreak: false });
      bankY += 15;
    }
    y += bankHeight + 12;
  }

  /* Notes, terms and signature --------------------------------------------- */
  for (const [title, body] of [
    ['Note', invoice.notes],
    ['Terms & Conditions', invoice.terms],
  ]) {
    if (!body) continue;
    const textHeight = doc.font(FONTS.regular).fontSize(8.5).heightOfString(body, { width: width - 24 });
    const blockHeight = textHeight + 34;
    if (y + blockHeight > bottomEdge(doc)) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    doc.save().rect(left, y, width, blockHeight).fill(COLORS.softAlt).restore();
    doc.font(FONTS.bold).fontSize(9).fillColor(COLORS.accent).text(title, left + 12, y + 9, { width: width - 24 });
    line(doc, y + 23, { from: left + 12, to: right - 12, color: COLORS.border });
    doc.font(FONTS.regular).fontSize(8.5).fillColor(COLORS.text).text(body, left + 12, y + 28, { width: width - 24 });
    y += blockHeight + 12;
  }

  const signatureHeight = 58;
  if (y + signatureHeight > bottomEdge(doc)) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  if (signature) drawAsset(doc, signature, { x: right - 170, y, width: 150, height: 40, align: 'center' });
  line(doc, y + 42, { from: right - 190, to: right, color: COLORS.border });
  doc.font(FONTS.regular).fontSize(8.5).fillColor(COLORS.muted);
  doc.text(settings.signatureLabel || 'Authorized Signature', right - 190, y + 46, { width: 190, align: 'center' });

  addPageNumbers(doc);
  return renderToBuffer(doc);
}
