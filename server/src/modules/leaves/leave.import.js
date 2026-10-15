import ExcelJS from 'exceljs';
import { LEAVE_SOURCES, LEAVE_STATUS } from '../../constants/index.js';
import { ApiError } from '../../utils/ApiError.js';
import { countWeekdays, isValidDateOnly } from '../../utils/dates.js';
import { USER_SUMMARY_FIELDS } from '../../utils/mongoose.js';
import { audit } from '../audit/audit.service.js';
import { User } from '../users/user.model.js';
import { Leave } from './leave.model.js';
import { assertNoOverlap, calculateLeaveDays, LEAVE_POPULATE } from './leave.service.js';

const MAX_IMPORT_ROWS = 1000;
/** Records are history, not requests, so they may be longer than a request (90 days). */
const MAX_RECORD_SPAN_DAYS = 366;
const ACTIVE_STATUSES = [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED];

const fullName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(' ');

/** The shape every recorded leave is stored with: approved, by the person who recorded it. */
function toRecord({ type, startDate, endDate, isHalfDay, halfDaySession, days, reason, reviewNote, appliedOn }, employeeId, actor) {
  return {
    employee: employeeId,
    type,
    startDate,
    endDate,
    isHalfDay: Boolean(isHalfDay),
    halfDaySession: isHalfDay ? (halfDaySession ?? null) : null,
    days,
    reason: reason ?? '',
    reviewNote: reviewNote ?? '',
    appliedOn: appliedOn ?? null,
    status: LEAVE_STATUS.APPROVED,
    source: LEAVE_SOURCES.RECORDED,
    reviewedBy: actor._id,
    reviewedAt: new Date(),
  };
}

/**
 * Adds leave that was already approved — past leave from an old register, or
 * leave agreed outside the portal. Nobody is notified: it is history, not a
 * request. Like approving, nobody can record their own leave.
 */
export async function recordLeave(data, actor) {
  const employee = await User.findById(data.employee).select(USER_SUMMARY_FIELDS);
  if (!employee) {
    throw ApiError.badRequest('Employee not found', {
      code: 'VALIDATION_ERROR',
      details: [{ path: 'employee', message: 'Select an employee' }],
    });
  }
  if (employee.id === actor.id) throw ApiError.forbidden('You cannot record your own leave');

  await assertNoOverlap(employee._id, data);
  const days = await calculateLeaveDays(data);
  const leave = await Leave.create(toRecord({ ...data, days }, employee._id, actor));
  await audit(actor, 'leave.recorded', 'leave', leave._id, `Recorded approved ${leave.type} leave for ${fullName(employee)} (${describeRange(leave)})`);
  return leave.populate(LEAVE_POPULATE);
}

/* ------------------------------ Excel import ------------------------------ */

/** Column headings accepted for each field, compared without case, spaces or punctuation. */
const COLUMN_ALIASES = {
  employeeId: ['employeeid', 'empid', 'employeecode', 'empcode', 'staffid'],
  employeeName: ['employeename', 'name', 'employee'],
  appliedOn: ['leaveapplieddate', 'applieddate', 'appliedon', 'dateapplied', 'applicationdate'],
  type: ['leavetype', 'type'],
  startDate: ['fromdate', 'from', 'startdate'],
  endDate: ['todate', 'to', 'enddate'],
  days: ['noofdays', 'numberofdays', 'days', 'totaldays'],
  reason: ['reasonforleave', 'reason'],
  remarks: ['remarks', 'remark', 'notes', 'note', 'comments'],
};

const COLUMN_LABELS = {
  appliedOn: 'Leave Applied Date',
  days: 'No. of Days',
  reason: 'Reason for Leave',
  remarks: 'Remarks',
};

/** The codes used in leave registers, mapped to the portal's leave types. */
const TYPE_CODES = {
  cl: 'casual',
  casual: 'casual',
  casualleave: 'casual',
  sl: 'sick',
  sick: 'sick',
  sickleave: 'sick',
  medicalleave: 'sick',
  el: 'earned',
  pl: 'earned',
  earned: 'earned',
  earnedleave: 'earned',
  privilegeleave: 'earned',
  wfh: 'wfh',
  workfromhome: 'wfh',
  lwp: 'unpaid',
  lop: 'unpaid',
  unpaid: 'unpaid',
  unpaidleave: 'unpaid',
  leavewithoutpay: 'unpaid',
  lossofpay: 'unpaid',
  other: 'other',
  others: 'other',
};
/** A half day is recorded as half a day of casual leave. */
const HALF_DAY_CODES = ['hd', 'halfday', 'halfdayleave'];

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

const normaliseKey = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const pad = (n) => String(n).padStart(2, '0');
const fullYear = (y) => (y < 100 ? 2000 + y : y);

function toIso(year, month, day) {
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return isValidDateOnly(iso) ? iso : null;
}

/** What a cell holds, with formulas, rich text and hyperlinks reduced to their value. */
function cellValue(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v !== 'object') return v;
  if ('result' in v) return v.result instanceof Date || typeof v.result !== 'object' ? (v.result ?? null) : null;
  if (Array.isArray(v.richText)) return v.richText.map((part) => part.text).join('');
  if ('text' in v) return v.text;
  return null;
}

const cellText = (value) => (value === null || value === undefined || value instanceof Date ? '' : String(value).trim());

/** "13/2/2026", "13-02-26" or "13.2.2026" split into its three numbers. */
function numericDateParts(text) {
  const match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function parseTextDate(text, order) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return isValidDateOnly(text) ? text : null;

  const parts = numericDateParts(text);
  if (parts) {
    const [first, second, year] = parts;
    return order === 'mdy' ? toIso(fullYear(year), first, second) : toIso(fullYear(year), second, first);
  }

  // 13 Feb 2026, 13-Feb-26
  const dayFirst = text.match(/^(\d{1,2})[\s/-]+([a-z]{3,9})[\s,/-]+(\d{4}|\d{2})$/i);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].slice(0, 3).toLowerCase()];
    return month ? toIso(fullYear(Number(dayFirst[3])), month, Number(dayFirst[1])) : null;
  }
  // Feb 13, 2026
  const monthFirst = text.match(/^([a-z]{3,9})[\s-]+(\d{1,2}),?[\s-]+(\d{4})$/i);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].slice(0, 3).toLowerCase()];
    return month ? toIso(Number(monthFirst[3]), month, Number(monthFirst[2])) : null;
  }
  return null;
}

/** Excel stores dates as days since 30 Dec 1899. */
function fromExcelSerial(serial) {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  return new Date(Math.round((serial - 25569) * 86_400_000));
}

/**
 * Reads a date cell. `swapExcelDates` undoes Excel's own conversion: when a
 * day-first date such as 9/1/2026 is typed into Excel set to month-first, it
 * silently becomes 1 September, while 13/2/2026 stays as text.
 */
function readDate(value, { order, swapExcelDates }) {
  if (value === null || value === '') return { empty: true };

  if (value instanceof Date || typeof value === 'number') {
    const date = value instanceof Date ? value : fromExcelSerial(value);
    if (!date || Number.isNaN(date.getTime())) return { invalid: true };
    let month = date.getUTCMonth() + 1;
    let day = date.getUTCDate();
    if (swapExcelDates && day <= 12) [month, day] = [day, month];
    const iso = toIso(date.getUTCFullYear(), month, day);
    return iso ? { value: iso } : { invalid: true };
  }

  const iso = parseTextDate(String(value).trim(), order);
  return iso ? { value: iso } : { invalid: true };
}

/** Finds the first sheet with a recognisable header row (within its first 10 rows). */
function findTable(workbook) {
  for (const worksheet of workbook.worksheets) {
    const lastRow = Math.min(worksheet.rowCount, 10);
    for (let r = 1; r <= lastRow; r += 1) {
      const columns = {};
      worksheet.getRow(r).eachCell((cell, col) => {
        const key = normaliseKey(cellText(cellValue(cell)));
        const field = Object.keys(COLUMN_ALIASES).find((f) => COLUMN_ALIASES[f].includes(key));
        if (field && !columns[field]) columns[field] = col;
      });
      const identifiesEmployee = columns.employeeId || columns.employeeName;
      if (identifiesEmployee && columns.type && columns.startDate) return { worksheet, headerRow: r, columns };
    }
  }
  return null;
}

/** Words of a name, ignoring initials and punctuation, so "Aabid S. Shaikh" matches "Aabid Shaikh". */
const nameWords = (name) =>
  String(name ?? '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1);

function sameName(a, b) {
  const [shorter, longer] = [nameWords(a), nameWords(b)].sort((x, y) => x.length - y.length);
  return shorter.length > 0 && shorter.every((w) => longer.includes(w));
}

const describeRange = (l) => (l.startDate === l.endDate ? l.startDate : `${l.startDate} to ${l.endDate}`);

/**
 * Reads a leave register (the QueDesk template or a similar sheet) and records
 * every valid row as approved leave. With `commit: false` nothing is saved: the
 * result is a preview with a verdict for each row, so the admin can check the
 * file first. Rows with problems are skipped, never half-imported.
 */
export async function importLeaveRecords(buffer, { dateOrder = 'dmy', commit = false }, actor) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw ApiError.badRequest('The file could not be read as an Excel workbook. Save it as .xlsx and try again.');
  }

  const table = findTable(workbook);
  if (!table) {
    throw ApiError.badRequest(
      'No header row was found. The sheet needs columns such as "Employee ID", "Leave Type", "From Date" and "To Date" — download the template to see the layout.',
    );
  }
  const { worksheet, headerRow, columns } = table;

  const raw = [];
  for (let r = headerRow + 1; r <= worksheet.rowCount; r += 1) {
    const row = worksheet.getRow(r);
    const values = Object.fromEntries(Object.entries(columns).map(([field, col]) => [field, cellValue(row.getCell(col))]));
    const identifying = [values.employeeId, values.employeeName, values.type, values.startDate, values.endDate];
    // Blank rows, totals and footnotes have none of these.
    if (identifying.every((v) => v === null || (!(v instanceof Date) && cellText(v) === ''))) continue;
    raw.push({ row: r, values });
  }
  if (!raw.length) throw ApiError.badRequest('The sheet has no leave rows under its header.');
  if (raw.length > MAX_IMPORT_ROWS) {
    throw ApiError.badRequest(`A file can hold at most ${MAX_IMPORT_ROWS} rows; this one has ${raw.length}. Split it into smaller files.`);
  }

  const dateFields = ['startDate', 'endDate', 'appliedOn'];
  const dateValues = raw.flatMap(({ values }) => dateFields.map((f) => values[f]));
  const hasExcelDates = dateValues.some((v) => v instanceof Date || typeof v === 'number');
  const hasDayFirstText = dateValues.some((v) => {
    const parts = typeof v === 'string' ? numericDateParts(v.trim()) : null;
    return parts && parts[0] > 12 && parts[1] <= 12;
  });
  const swapExcelDates = dateOrder === 'dmy' && hasExcelDates && hasDayFirstText;
  const dateOptions = { order: dateOrder, swapExcelDates };

  const notices = [];
  if (swapExcelDates) {
    notices.push(
      'Excel had turned some of these dates around (for example 9/1/2026 stored as 1 September). They have been read day-first like the rest of the file — check the dates below before importing.',
    );
  }
  const missing = Object.keys(COLUMN_LABELS).filter((field) => !columns[field]);
  if (missing.length) {
    notices.push(`Not in this file, so left blank or worked out from the dates: ${missing.map((f) => COLUMN_LABELS[f]).join(', ')}.`);
  }

  const users = await User.find().select('employeeId firstName lastName department status').lean();
  const byEmployeeId = new Map(users.map((u) => [u.employeeId.toUpperCase(), u]));
  const byName = new Map();
  for (const u of users) {
    const key = nameWords(fullName(u)).join(' ');
    byName.set(key, [...(byName.get(key) ?? []), u]);
  }

  const rows = raw.map(({ row, values }) => parseRow(row, values, { byEmployeeId, byName, dateOptions, actor }));

  await markOverlaps(rows);

  const ready = rows.filter((r) => !r.errors.length);
  let imported;
  if (commit && ready.length) {
    await Leave.insertMany(ready.map((r) => toRecord({ ...r, reviewNote: r.remarks }, r.employee.id, actor)));
    imported = ready.length;
    await audit(actor, 'leave.imported', 'leave', null, `Imported ${imported} approved leave record${imported === 1 ? '' : 's'} from Excel`);
  }

  return {
    rows,
    notices,
    summary: {
      total: rows.length,
      ready: ready.length,
      failed: rows.length - ready.length,
      withWarnings: ready.filter((r) => r.warnings.length).length,
    },
    ...(commit && { imported: imported ?? 0 }),
  };
}

function parseRow(row, values, { byEmployeeId, byName, dateOptions, actor }) {
  const errors = [];
  const warnings = [];
  const idText = cellText(values.employeeId);
  const nameText = cellText(values.employeeName);

  /* Employee */
  let employee = null;
  if (idText) {
    employee = byEmployeeId.get(idText.toUpperCase()) ?? null;
    if (!employee) errors.push(`No employee has the ID "${idText}"`);
    else if (nameText && !sameName(nameText, fullName(employee))) {
      warnings.push(`The file says "${nameText}", but ${employee.employeeId} is ${fullName(employee)}`);
    }
  } else if (nameText) {
    const matches = byName.get(nameWords(nameText).join(' ')) ?? [];
    if (matches.length === 1) [employee] = matches;
    else if (matches.length > 1) errors.push(`More than one employee is called "${nameText}" — add their Employee ID`);
    else errors.push(`No employee is called "${nameText}"`);
  } else {
    errors.push('Employee ID is missing');
  }
  if (employee && String(employee._id) === String(actor._id)) errors.push('You cannot record your own leave');

  /* Leave type */
  const typeText = cellText(values.type);
  const typeKey = normaliseKey(typeText);
  const isHalfDayCode = HALF_DAY_CODES.includes(typeKey);
  const type = isHalfDayCode ? 'casual' : (TYPE_CODES[typeKey] ?? null);
  if (!typeText) errors.push('Leave Type is missing');
  else if (!type) errors.push(`Unknown leave type "${typeText}" — use CL, SL, EL, WFH, HD, LWP or Other`);

  /* Dates */
  const start = readDate(values.startDate, dateOptions);
  const end = readDate(values.endDate, dateOptions);
  const startDate = start.value ?? null;
  const endDate = end.empty ? startDate : (end.value ?? null);
  if (start.empty) errors.push('From Date is missing');
  else if (start.invalid) errors.push(`From Date "${cellText(values.startDate)}" is not a date`);
  if (end.invalid) errors.push(`To Date "${cellText(values.endDate)}" is not a date`);

  let span = 0;
  if (startDate && endDate) {
    span = (new Date(endDate) - new Date(startDate)) / 86_400_000 + 1;
    if (endDate < startDate) errors.push('To Date is before From Date');
    else if (span > MAX_RECORD_SPAN_DAYS) errors.push(`A single record cannot span more than ${MAX_RECORD_SPAN_DAYS} days`);
  }
  const datesOk = startDate && endDate && endDate >= startDate && span <= MAX_RECORD_SPAN_DAYS;

  /* Days */
  const daysText = cellText(values.days);
  const givenDays = daysText === '' ? null : Number(daysText);
  const isHalfDay = isHalfDayCode || givenDays === 0.5;
  let days = null;

  if (daysText !== '' && !Number.isFinite(givenDays)) {
    errors.push(`No. of Days "${daysText}" is not a number`);
  } else if (isHalfDay) {
    days = 0.5;
    if (datesOk && startDate !== endDate) errors.push('A half day must start and end on the same date');
    if (isHalfDayCode && givenDays !== null && givenDays !== 0.5) warnings.push(`Recorded as a half day (0.5), not ${givenDays}`);
  } else if (datesOk) {
    const workingDays = countWeekdays(startDate, endDate);
    if (givenDays === null) {
      if (workingDays === 0) errors.push('These dates are all weekend — add the No. of Days to record them');
      else days = workingDays;
    } else if (givenDays <= 0 || givenDays > span || !Number.isInteger(givenDays * 2)) {
      errors.push(`No. of Days must be between 0.5 and ${span} for these dates`);
    } else {
      days = givenDays;
      if (givenDays !== workingDays) {
        warnings.push(
          `The dates cover ${workingDays} working day${workingDays === 1 ? '' : 's'}; the file's ${givenDays} is used`,
        );
      }
    }
  }

  /* Optional details */
  const applied = readDate(values.appliedOn, dateOptions);
  if (applied.invalid) warnings.push(`Leave Applied Date "${cellText(values.appliedOn)}" is not a date and was left out`);
  const reason = cellText(values.reason);
  const remarks = cellText(values.remarks);
  if (reason.length > 1000) errors.push('Reason for Leave is longer than 1000 characters');
  if (remarks.length > 500) errors.push('Remarks are longer than 500 characters');

  return {
    row,
    employee: employee ? { id: String(employee._id), name: fullName(employee), employeeId: employee.employeeId } : null,
    employeeLabel: idText || nameText,
    type,
    isHalfDay,
    halfDaySession: null,
    startDate,
    endDate,
    days,
    appliedOn: applied.value ?? null,
    reason,
    remarks,
    errors,
    warnings,
  };
}

/** Flags rows that clash with leave already in the portal, or with an earlier row of the same file. */
async function markOverlaps(rows) {
  const candidates = rows.filter((r) => !r.errors.length);
  if (!candidates.length) return;

  const existing = await Leave.find({
    employee: { $in: [...new Set(candidates.map((r) => r.employee.id))] },
    status: { $in: ACTIVE_STATUSES },
    startDate: { $lte: candidates.reduce((max, r) => (r.endDate > max ? r.endDate : max), '') },
    endDate: { $gte: candidates.reduce((min, r) => (r.startDate < min ? r.startDate : min), '9999') },
  })
    .select('employee startDate endDate status type')
    .lean();

  const overlaps = (a, b) => a.startDate <= b.endDate && b.startDate <= a.endDate;
  const accepted = [];

  for (const row of candidates) {
    const clash = existing.find((l) => String(l.employee) === row.employee.id && overlaps(l, row));
    if (clash) {
      const same = clash.startDate === row.startDate && clash.endDate === row.endDate && clash.status === LEAVE_STATUS.APPROVED;
      row.errors.push(
        same
          ? `Already recorded: approved ${clash.type} leave on ${describeRange(clash)}`
          : `Overlaps ${clash.status} leave on ${describeRange(clash)}`,
      );
      continue;
    }
    const earlier = accepted.find((r) => r.employee.id === row.employee.id && overlaps(r, row));
    if (earlier) {
      row.errors.push(`Overlaps row ${earlier.row} of this file`);
      continue;
    }
    accepted.push(row);
  }
}

/* -------------------------------- Template -------------------------------- */

const TEMPLATE_COLUMNS = [
  { header: 'Sr. No', width: 8 },
  { header: 'Employee ID', width: 14 },
  { header: 'Employee Name', width: 28 },
  { header: 'Department', width: 26 },
  { header: 'Leave Applied Date', width: 19, date: true },
  { header: 'Leave Type', width: 12 },
  { header: 'From Date', width: 13, date: true },
  { header: 'To Date', width: 13, date: true },
  { header: 'No. of Days', width: 12 },
  { header: 'Reason for Leave', width: 40 },
  { header: 'Remarks', width: 30 },
];

const TEMPLATE_GUIDE = [
  ['Column', 'How to fill it'],
  ['Employee ID', 'Required. The ID shown in QueDesk under Employees, e.g. E2026002.'],
  ['Employee Name', 'Optional. Used only to double-check the Employee ID (or alone if there is no ID).'],
  ['Department', 'Optional. Ignored on import; the department comes from the employee record.'],
  ['Leave Applied Date', 'Optional. Day/Month/Year, e.g. 9/1/2026 for 9 January 2026.'],
  ['Leave Type', 'Required. CL = Casual, SL = Sick, EL or PL = Earned, WFH = Work from home, HD = Half day (casual), LWP = Unpaid, Other.'],
  ['From Date', 'Required. Day/Month/Year, e.g. 13/2/2026.'],
  ['To Date', 'Optional for a single day. Day/Month/Year.'],
  ['No. of Days', 'Optional. Worked out from the dates (weekends not counted) when blank. 0.5 means a half day.'],
  ['Reason for Leave', 'Optional.'],
  ['Remarks', 'Optional. Shown on the leave as the approver’s note.'],
  [],
  ['Every row is recorded as approved leave. Rows that overlap leave already in QueDesk are skipped, so the same file can be uploaded twice safely.'],
  ['The date columns are formatted as text so Excel keeps dates exactly as typed.'],
];

/** A blank workbook with the register's columns, plus a sheet explaining each one. */
export async function buildImportTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'QueDesk';

  const sheet = workbook.addWorksheet('Leave records', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = TEMPLATE_COLUMNS.map(({ header, width, date }) => ({
    header,
    width,
    // Text, so a typed 9/1/2026 is kept as typed instead of being turned into a date.
    ...(date && { style: { numFmt: '@' } }),
  }));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  header.alignment = { vertical: 'middle' };
  header.height = 20;
  sheet.dataValidations.add(`F2:F${MAX_IMPORT_ROWS + 1}`, {
    type: 'list',
    allowBlank: true,
    showErrorMessage: false,
    formulae: ['"CL,SL,EL,WFH,HD,LWP,Other"'],
  });

  const guide = workbook.addWorksheet('How to fill');
  guide.columns = [{ width: 22 }, { width: 110 }];
  TEMPLATE_GUIDE.forEach((line) => guide.addRow(line));
  guide.getRow(1).font = { bold: true };

  return workbook.xlsx.writeBuffer();
}
