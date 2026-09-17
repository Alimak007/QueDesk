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

/**
 * The activity log keeps one month of history. MongoDB's TTL monitor removes
 * anything older on its own, so the collection never needs pruning by hand.
 */
export const AUDIT_RETENTION_DAYS = 30;

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: AUDIT_RETENTION_DAYS * 24 * 60 * 60 });
auditLogSchema.index({ entityType: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

toJSONPlugin(auditLogSchema);

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
