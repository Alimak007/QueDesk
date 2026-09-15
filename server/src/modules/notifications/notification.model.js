import mongoose from 'mongoose';
import { NOTIFICATION_TYPES } from '../../constants/index.js';
import { toJSONPlugin } from '../../utils/mongoose.js';

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: Object.values(NOTIFICATION_TYPES), required: true },
    title: { type: String, required: true, maxlength: 150 },
    message: { type: String, default: '', maxlength: 500 },
    link: { type: String, default: '' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
// Keep notifications for 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

toJSONPlugin(notificationSchema);

export const Notification = mongoose.model('Notification', notificationSchema);
