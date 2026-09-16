import { z } from 'zod';
import { paginationQuery } from '../../utils/pagination.js';
import { dateOnly, objectId, optionalTrimmed, trimmed } from '../../utils/validators.js';

const amount = z.coerce
  .number({ error: 'Enter a valid amount' })
  .min(0, 'Amount cannot be negative')
  .max(1_000_000_000, 'Amount is too large');

const componentSchema = z.object({
  label: trimmed('Label', { max: 60 }),
  amount,
});

const payslipFields = {
  employee: objectId('employee'),
  company: objectId('company'),
  periodStart: dateOnly('Period start'),
  periodEnd: dateOnly('Period end'),
  payDate: dateOnly('Pay date'),
  earnings: z.array(componentSchema).min(1, 'Add at least one earning').max(20, 'At most 20 earnings'),
  deductions: z.array(componentSchema).max(20, 'At most 20 deductions').default([]),
  notes: optionalTrimmed('Notes', 500),
};

function refinePayslip(v, ctx) {
  if (v.periodEnd < v.periodStart) {
    ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: 'Period end cannot be before period start' });
  }
  const gross = v.earnings.reduce((sum, e) => sum + e.amount, 0);
  const deductions = (v.deductions ?? []).reduce((sum, d) => sum + d.amount, 0);
  if (deductions > gross) {
    ctx.addIssue({ code: 'custom', path: ['deductions'], message: 'Deductions cannot exceed total earnings' });
  }
}

export const createPayslipSchema = z.object(payslipFields).superRefine(refinePayslip);

export const updatePayslipSchema = z
  .object({ ...payslipFields, employee: payslipFields.employee.optional() })
  .superRefine(refinePayslip);

export const listPayslipsQuery = z.object({
  ...paginationQuery,
  search: z.string().trim().max(100).optional(),
  employee: objectId('employee').optional(),
  company: objectId('company').optional(),
  from: dateOnly('From date').optional(),
  to: dateOnly('To date').optional(),
  sortBy: z.enum(['payDate', 'createdAt', 'netPay', 'payslipNumber']).default('payDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const defaultsQuery = z.object({
  employee: objectId('employee'),
  company: objectId('company').optional(),
});
