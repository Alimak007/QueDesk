import mongoose from 'mongoose';
import { HALF_DAY_SESSIONS, LEAVE_SOURCES, LEAVE_STATUS, LEAVE_TYPES } from '../../constants/index.js';
import { toJSONPlugin } from '../../utils/mongoose.js';

const leaveSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: LEAVE_TYPES, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    isHalfDay: { type: Boolean, default: false },
    halfDaySession: { type: String, enum: [...HALF_DAY_SESSIONS, null], default: null },
    /** Working days consumed, excluding weekends and company holidays. */
    days: { type: Number, required: true, min: 0 },
    /** Required on requests; old registers often have no reason, so records may leave it blank. */
    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
      required: [
        function reasonRequired() {
          return this.source !== LEAVE_SOURCES.RECORDED;
        },
        'Reason is required',
      ],
    },
    status: {
      type: String,
      enum: Object.values(LEAVE_STATUS),
      default: LEAVE_STATUS.PENDING,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, maxlength: 500, default: '' },
    cancelledAt: { type: Date, default: null },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    source: { type: String, enum: Object.values(LEAVE_SOURCES), default: LEAVE_SOURCES.REQUEST },
    /** When the employee originally asked for it; only known for recorded leave. */
    appliedOn: { type: String, default: null },
  },
  { timestamps: true },
);

leaveSchema.index({ employee: 1, startDate: -1 });
leaveSchema.index({ status: 1, startDate: 1 });
leaveSchema.index({ startDate: 1, endDate: 1 });

toJSONPlugin(leaveSchema);

export const Leave = mongoose.model('Leave', leaveSchema);
