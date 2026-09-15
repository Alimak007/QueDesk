import mongoose from 'mongoose';
import { SYSTEM_SALES_FIELDS } from '../../constants/index.js';
import { toJSONPlugin } from '../../utils/mongoose.js';

/** Singleton document holding module-wide Sales preferences. */
const salesSettingsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'default' },
    /** Dropdown field whose options become the Kanban columns. */
    kanbanGroupField: { type: String, default: SYSTEM_SALES_FIELDS.STATUS },
    /** Number / currency field summed for pipeline value. */
    valueField: { type: String, default: 'expectedValue' },
    currency: { type: String, default: 'INR', uppercase: true, trim: true, maxlength: 3 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

toJSONPlugin(salesSettingsSchema);

export const SalesSettings = mongoose.model('SalesSettings', salesSettingsSchema);

export async function getSalesSettings() {
  return SalesSettings.findOneAndUpdate(
    { _id: 'default' },
    { $setOnInsert: { _id: 'default' } },
    { upsert: true, returnDocument: 'after' },
  );
}
