import { format, parseISO } from 'date-fns';
import { amountInWords, formatAmount } from '../documents/money.js';
import { loadPdfImage } from '../documents/imageStore.js';
import { COLORS, FONTS, addPageNumbers, contentWidth, createDocument, drawAsset, line, renderToBuffer, rightEdge } from '../documents/pdf.js';

const fmtDate = (value, pattern = 'dd-MMM-yy') => (value ? format(parseISO(value), pattern) : '—');

/**
 * Renders a payslip following the supplied template: confidential header with
 * the company logo, the details grid, the Earnings / Deductions table, the net
 * pay in figures and words, and the company footer.
 */
export async function renderPayslipPdf(payslip, company) {
  const doc = createDocument({ margin: 44, title: payslip.payslipNumber, author: company.name });
  const logo = await loadPdfImage(company.logo);

  const left = doc.page.margins.left;
  const right = rightEdge(doc);
  const width = contentWidth(doc);
  const currency = payslip.currency || company.currency;
  const currencyLabel = company.payslip?.currencyLabel || currency;
  const money = (value) => formatAmount(value, currency);

  /* Header ---------------------------------------------------------------- */
  const shortName = company.shortName || company.name;
  doc.font(FONTS.semibold).fontSize(8.5).fillColor(COLORS.muted);
  doc.text(`${shortName} – ${company.payslip?.confidentialityNote || 'Private & Confidential'}`, left, 40, {
    width: width * 0.6,
    lineBreak: false,
  });
  if (logo) {
    drawAsset(doc, logo, { x: right - 150, y: 26, width: 150, height: 46, align: 'right' });
  } else {
    // Until a logo is uploaded, the company name keeps the header balanced.
    doc.font(FONTS.bold).fontSize(11).fillColor(COLORS.navy);
    doc.text(company.name, right - 240, 34, { width: 240, align: 'right' });
  }

  // Decorative bar on the left edge, as in the template.
  doc.save().rect(0, 24, 8, 96).fill(COLORS.accent).restore();

  /* Title ----------------------------------------------------------------- */
  doc.font(FONTS.bold).fontSize(21).fillColor(COLORS.headerBar);
  doc.text(company.payslip?.title || 'Payslip', left, 96, { width, align: 'center' });

  /* Details grid ---------------------------------------------------------- */
  const gridTop = 150;
  const colGap = 24;
  const colWidth = (width - colGap) / 2;
  const rows = [
    ['Date :', fmtDate(payslip.payDate), 'Employee ID', payslip.employeeSnapshot?.employeeId ?? '—'],
    ['Date of Joining :', fmtDate(payslip.employeeSnapshot?.joiningDate), 'Employee Name :', payslip.employeeSnapshot?.name ?? '—'],
    [
      'Pay Period :',
      `${fmtDate(payslip.periodStart, 'd-MMM-yyyy')} to ${fmtDate(payslip.periodEnd, 'd-MMM-yyyy')}`,
      'Designation :',
      payslip.employeeSnapshot?.designation || '—',
    ],
  ];
  if (payslip.employeeSnapshot?.department) {
    rows.push(['', '', 'Department :', payslip.employeeSnapshot.department]);
  }

  let y = gridTop;
  for (const [labelA, valueA, labelB, valueB] of rows) {
    const height = Math.max(
      doc.font(FONTS.regular).fontSize(9.5).heightOfString(valueA || ' ', { width: colWidth - 110 }),
      doc.heightOfString(valueB || ' ', { width: colWidth - 110 }),
      14,
    );
    doc.font(FONTS.bold).fontSize(9.5).fillColor(COLORS.text).text(labelA, left, y, { width: 104, lineBreak: false });
    doc.font(FONTS.regular).text(valueA, left + 106, y, { width: colWidth - 110 });
    doc.font(FONTS.bold).text(labelB, left + colWidth + colGap, y, { width: 104, lineBreak: false });
    doc.font(FONTS.regular).text(valueB, left + colWidth + colGap + 106, y, { width: colWidth - 110 });
    y += height + 8;
  }

  /* Earnings / deductions table ------------------------------------------- */
  const tableTop = y + 18;
  const cols = [
    { x: left, width: width * 0.34, align: 'left' },
    { x: left + width * 0.34, width: width * 0.16, align: 'left' },
    { x: left + width * 0.5, width: width * 0.34, align: 'left' },
    { x: left + width * 0.84, width: width * 0.16, align: 'left' },
  ];
  const rowHeight = 22;

  doc.save().rect(left, tableTop, width, rowHeight).fill(COLORS.accent).restore();
  doc.font(FONTS.bold).fontSize(9.5).fillColor(COLORS.white);
  ['Earnings', `Amount (${currencyLabel})`, 'Deductions', `Amount (${currencyLabel})`].forEach((heading, i) => {
    doc.text(heading, cols[i].x + 8, tableTop + 6.5, { width: cols[i].width - 16, lineBreak: false });
  });

  const bodyRows = [];
  const maxRows = Math.max(payslip.earnings.length, payslip.deductions.length + 1);
  for (let i = 0; i < maxRows; i += 1) {
    const earning = payslip.earnings[i];
    const deduction = payslip.deductions[i];
    const isTotalDeductionRow = i === payslip.deductions.length;
    bodyRows.push([
      earning?.label ?? '',
      earning ? money(earning.amount) : '',
      isTotalDeductionRow ? 'Total Deductions' : (deduction?.label ?? ''),
      isTotalDeductionRow ? money(payslip.totalDeductions) : deduction ? money(deduction.amount) : '',
      isTotalDeductionRow,
    ]);
  }
  // Closing row: gross earnings on the left, net pay on the right.
  bodyRows.push(['Gross Earnings', money(payslip.grossEarnings), 'Net Pay', money(payslip.netPay), true]);

  y = tableTop + rowHeight;
  bodyRows.forEach((row, index) => {
    const isLast = index === bodyRows.length - 1;
    const shaded = index % 2 === 0;
    if (shaded || isLast) {
      doc.save().rect(left, y, width, rowHeight).fill(isLast ? COLORS.soft : COLORS.softAlt).restore();
    }
    const bold = isLast || row[4];
    doc.font(bold ? FONTS.bold : FONTS.regular).fontSize(9.5).fillColor(COLORS.text);
    doc.text(row[0], cols[0].x + 8, y + 6.5, { width: cols[0].width - 16, lineBreak: false, ellipsis: true });
    doc.text(row[1], cols[1].x + 8, y + 6.5, { width: cols[1].width - 16, lineBreak: false });
    doc.font(row[4] || isLast ? FONTS.bold : FONTS.regular);
    doc.text(row[2], cols[2].x + 8, y + 6.5, { width: cols[2].width - 16, lineBreak: false, ellipsis: true });
    doc.text(row[3], cols[3].x + 8, y + 6.5, { width: cols[3].width - 16, lineBreak: false });
    y += rowHeight;
  });

  doc.save().rect(left, tableTop, width, y - tableTop).lineWidth(0.6).strokeColor(COLORS.border).stroke().restore();

  /* Net pay in figures and words ------------------------------------------ */
  y += 26;
  doc.font(FONTS.bold).fontSize(11).fillColor(COLORS.text);
  doc.text(`${currencyLabel} ${money(payslip.netPay)}`, left, y, { width, align: 'center' });
  y += 16;
  doc.text(amountInWords(payslip.netPay, currency), left, y, { width, align: 'center' });

  if (payslip.notes) {
    y += 26;
    doc.font(FONTS.regular).fontSize(9).fillColor(COLORS.muted).text(payslip.notes, left, y, { width, align: 'center' });
  }

  y = doc.y + 24;
  doc.font(FONTS.italic).fontSize(8.5).fillColor(COLORS.muted);
  doc.text(company.payslip?.footerNote || '', left, y, { width, align: 'center' });

  /* Footer ---------------------------------------------------------------- */
  const footerY = doc.page.height - doc.page.margins.bottom - 34;
  line(doc, footerY - 8);
  doc.font(FONTS.bold).fontSize(8.5).fillColor(COLORS.muted).text(company.name, left, footerY, { width, align: 'center' });
  const addressLine = [company.address?.replace(/\s*\n\s*/g, ', '), company.website].filter(Boolean).join(' · ');
  doc.font(FONTS.regular).fontSize(7.5).fillColor(COLORS.light).text(addressLine, left, footerY + 12, { width, align: 'center' });

  addPageNumbers(doc);
  return renderToBuffer(doc);
}
