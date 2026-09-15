import mongoose from 'mongoose';
import { EVENT_TYPES } from '../../constants/index.js';
import { toJSONPlugin } from '../../utils/mongoose.js';

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    type: { type: String, enum: EVENT_TYPES, required: true, default: 'event' },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    isAllDay: { type: Boolean, default: true },
    startTime: { type: String, default: null },
    endTime: { type: String, default: null },
    description: { type: String, trim: true, maxlength: 3000, default: '' },
    location: { type: String, trim: true, maxlength: 200, default: '' },
    additionalInfo: { type: String, trim: true, maxlength: 2000, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

eventSchema.index({ startDate: 1, endDate: 1 });
eventSchema.index({ type: 1, startDate: 1 });

toJSONPlugin(eventSchema);

export const Event = mongoose.model('Event', eventSchema);
