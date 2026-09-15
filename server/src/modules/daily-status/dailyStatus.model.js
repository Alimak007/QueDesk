import mongoose from 'mongoose';
import { toJSONPlugin } from '../../utils/mongoose.js';

const dailyStatusSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    workDone: { type: String, required: true, trim: true, maxlength: 5000 },
    planNext: { type: String, trim: true, maxlength: 3000, default: '' },
    blockers: { type: String, trim: true, maxlength: 2000, default: '' },
    hoursWorked: { type: Number, min: 0, max: 24, default: null },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

// One report per employee per day.
dailyStatusSchema.index({ employee: 1, date: -1 }, { unique: true });
dailyStatusSchema.index({ date: -1 });

toJSONPlugin(dailyStatusSchema);

export const DailyStatus = mongoose.model('DailyStatus', dailyStatusSchema);
