import mongoose from 'mongoose';

/**
 * True when the user is referenced by records outside leave/status/leads —
 * customers they own, or payslips and invoices raised for or by them.
 * Models are resolved lazily so this stays free of circular imports.
 */
export async function hasRelatedDocuments(userId) {
  const checks = [
    ['Customer', { $or: [{ owner: userId }, { createdBy: userId }] }],
    ['Payslip', { $or: [{ employee: userId }, { createdBy: userId }] }],
    ['Invoice', { createdBy: userId }],
  ];

  for (const [modelName, filter] of checks) {
    const model = mongoose.models[modelName];
    if (model && (await model.exists(filter))) return true;
  }
  return false;
}
