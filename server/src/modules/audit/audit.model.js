import mongoose from 'mongoose';
import { toJSONPlugin } from '../../utils/mongoose.js';

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Dotted action name, e.g. `invoice.downloaded`. */
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    summary: { type: String, default: '', maxlength: 500 },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entityType: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

toJSONPlugin(auditLogSchema);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
