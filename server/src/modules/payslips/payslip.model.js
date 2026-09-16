import mongoose from 'mongoose';
import { toJSONPlugin } from '../../utils/mongoose.js';

const componentSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const payslipSchema = new mongoose.Schema(
  {
    payslipNumber: { type: String, required: true, unique: true, trim: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    /** Pay period, stored as date-only strings like every other date in the portal. */
    periodStart: { type: String, required: true },
    periodEnd: { type: String, required: true },
    payDate: { type: String, required: true },
    earnings: { type: [componentSchema], default: [] },
    deductions: { type: [componentSchema], default: [] },
    /** Totals are always recalculated on the server before saving. */
    grossEarnings: { type: Number, required: true, min: 0 },
    totalDeductions: { type: Number, required: true, min: 0 },
    netPay: { type: Number, required: true, min: 0 },
    currency: { type: String, uppercase: true, trim: true, default: 'INR', maxlength: 3 },
    notes: { type: String, trim: true, default: '', maxlength: 500 },
    /** Employee details frozen at generation time so historic payslips stay accurate. */
    employeeSnapshot: {
      name: String,
      employeeId: String,
      designation: String,
      department: String,
      joiningDate: String,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// One payslip per employee per pay period.
payslipSchema.index({ employee: 1, periodStart: 1, periodEnd: 1 }, { unique: true });
payslipSchema.index({ payDate: -1 });
payslipSchema.index({ company: 1, payDate: -1 });

toJSONPlugin(payslipSchema);

export const Payslip = mongoose.model('Payslip', payslipSchema);
