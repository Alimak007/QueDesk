import { ApiError } from '../../utils/ApiError.js';
import { buildPage, escapeRegex, getPagination } from '../../utils/pagination.js';
import { audit } from '../audit/audit.service.js';
import { Company } from '../companies/company.model.js';
import { getDefaultCompany } from '../companies/company.service.js';
import { round2 } from '../documents/money.js';
import { User } from '../users/user.model.js';
import { nextSequence } from '../users/counter.model.js';
import { Payslip } from './payslip.model.js';

const POPULATE = [
  { path: 'employee', select: 'firstName lastName employeeId designation department email' },
  { path: 'company', select: 'name shortName currency' },
  { path: 'createdBy', select: 'firstName lastName' },
  { path: 'updatedBy', select: 'firstName lastName' },
];

async function nextPayslipNumber(company, payDate) {
  const prefix = company.payslip?.prefix || 'PS-';
  const yearMonth = payDate.slice(0, 7).replace('-', '');
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const seq = await nextSequence(`payslip:${company._id}:${yearMonth}`);
    const candidate = `${prefix}${yearMonth}-${String(seq).padStart(4, '0')}`;
    if (!(await Payslip.exists({ payslipNumber: candidate }))) return candidate;
  }
  throw new ApiError(500, 'Could not generate a unique payslip number');
}

/** Totals always come from the server, never from the browser. */
function calculateTotals({ earnings = [], deductions = [] }) {
  const normalise = (rows) => rows.map((r) => ({ label: r.label.trim(), amount: round2(r.amount) }));
  const cleanEarnings = normalise(earnings);
  const cleanDeductions = normalise(deductions);
  const grossEarnings = round2(cleanEarnings.reduce((sum, r) => sum + r.amount, 0));
  const totalDeductions = round2(cleanDeductions.reduce((sum, r) => sum + r.amount, 0));
  const netPay = round2(grossEarnings - totalDeductions);
  if (netPay < 0) throw ApiError.badRequest('Deductions cannot exceed total earnings');
  return { earnings: cleanEarnings, deductions: cleanDeductions, grossEarnings, totalDeductions, netPay };
}

async function loadEmployeeAndCompany(employeeId, companyId) {
  const [employee, company] = await Promise.all([User.findById(employeeId), Company.findById(companyId)]);
  if (!employee) throw ApiError.badRequest('Select a valid employee', { code: 'VALIDATION_ERROR', details: [{ path: 'employee', message: 'Employee not found' }] });
  if (!company) throw ApiError.badRequest('Select a valid company', { code: 'VALIDATION_ERROR', details: [{ path: 'company', message: 'Company not found' }] });
  return { employee, company };
}

const snapshotOf = (employee) => ({
  name: [employee.firstName, employee.lastName].filter(Boolean).join(' '),
  employeeId: employee.employeeId,
  designation: employee.designation,
  department: employee.department,
  joiningDate: employee.joiningDate,
});

export async function listPayslips(query) {
  const { search, employee, company, from, to, sortBy, sortOrder } = query;
  const filter = {};
  if (employee) filter.employee = employee;
  if (company) filter.company = company;
  if (from || to) filter.payDate = { ...(from && { $gte: from }), ...(to && { $lte: to }) };
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ payslipNumber: rx }, { 'employeeSnapshot.name': rx }, { 'employeeSnapshot.employeeId': rx }];
  }

  const { page, limit, skip } = getPagination(query);
  const [items, total] = await Promise.all([
    Payslip.find(filter).sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1, _id: -1 }).skip(skip).limit(limit).populate(POPULATE),
    Payslip.countDocuments(filter),
  ]);
  return buildPage(items, total, { page, limit });
}

export async function getPayslip(id) {
  const payslip = await Payslip.findById(id).populate(POPULATE);
  if (!payslip) throw ApiError.notFound('Payslip not found');
  return payslip;
}

export async function createPayslip(input, actor) {
  const { employee, company } = await loadEmployeeAndCompany(input.employee, input.company);

  if (await Payslip.exists({ employee: employee._id, periodStart: input.periodStart, periodEnd: input.periodEnd })) {
    throw ApiError.conflict('This employee already has a payslip for that pay period', {
      code: 'DUPLICATE_PAYSLIP',
      details: [{ path: 'periodStart', message: 'A payslip already exists for this period' }],
    });
  }

  const totals = calculateTotals(input);
  const payslip = await Payslip.create({
    ...input,
    ...totals,
    payslipNumber: await nextPayslipNumber(company, input.payDate),
    currency: input.currency || company.currency,
    employeeSnapshot: snapshotOf(employee),
    createdBy: actor._id,
  });

  await audit(actor, 'payslip.created', 'payslip', payslip._id, `Created payslip ${payslip.payslipNumber} for ${payslip.employeeSnapshot.name}`);
  return payslip.populate(POPULATE);
}

export async function updatePayslip(id, input, actor) {
  const payslip = await Payslip.findById(id);
  if (!payslip) throw ApiError.notFound('Payslip not found');

  const employeeId = input.employee ?? payslip.employee;
  const { employee, company } = await loadEmployeeAndCompany(employeeId, input.company);

  const clash = await Payslip.exists({
    _id: { $ne: payslip._id },
    employee: employeeId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });
  if (clash) {
    throw ApiError.conflict('This employee already has a payslip for that pay period', { code: 'DUPLICATE_PAYSLIP' });
  }

  Object.assign(payslip, input, calculateTotals(input), {
    currency: input.currency || company.currency,
    employeeSnapshot: snapshotOf(employee),
    updatedBy: actor._id,
  });
  await payslip.save();

  await audit(actor, 'payslip.updated', 'payslip', payslip._id, `Updated payslip ${payslip.payslipNumber}`);
  return payslip.populate(POPULATE);
}

export async function deletePayslip(id, actor) {
  const payslip = await Payslip.findByIdAndDelete(id);
  if (!payslip) throw ApiError.notFound('Payslip not found');
  await audit(actor, 'payslip.deleted', 'payslip', payslip._id, `Deleted payslip ${payslip.payslipNumber}`);
}

/**
 * Sensible starting values for a new payslip: the employee's last payslip if
 * there is one, otherwise the company's configured salary components.
 */
export async function getPayslipDefaults({ employee: employeeId, company: companyId }) {
  const employee = await User.findById(employeeId);
  if (!employee) throw ApiError.notFound('Employee not found');

  const company = companyId ? await Company.findById(companyId) : (employee.company && (await Company.findById(employee.company))) || (await getDefaultCompany());
  if (!company) throw ApiError.conflict('Add a company in Settings before generating payslips', { code: 'NO_COMPANY' });

  const last = await Payslip.findOne({ employee: employee._id }).sort({ payDate: -1 });
  const earnings = last
    ? last.earnings.map((e) => ({ label: e.label, amount: e.amount }))
    : (company.payslip?.defaultEarnings ?? []).map((label) => ({ label, amount: 0 }));
  const deductions = last
    ? last.deductions.map((d) => ({ label: d.label, amount: d.amount }))
    : (company.payslip?.defaultDeductions ?? []).map((label) => ({ label, amount: 0 }));

  return {
    company: company.id,
    currency: company.currency,
    earnings: earnings.length ? earnings : [{ label: 'Basic Pay', amount: 0 }],
    deductions,
    copiedFrom: last ? { id: last.id, payslipNumber: last.payslipNumber, payDate: last.payDate } : null,
    employee: {
      id: employee.id,
      name: [employee.firstName, employee.lastName].filter(Boolean).join(' '),
      employeeId: employee.employeeId,
      designation: employee.designation,
      department: employee.department,
      joiningDate: employee.joiningDate,
    },
  };
}
