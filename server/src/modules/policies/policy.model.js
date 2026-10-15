import mongoose from 'mongoose';
import { POLICY_CATEGORIES, POLICY_STATUS } from '../../constants/index.js';
import { toJSONPlugin } from '../../utils/mongoose.js';

const policySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 150 },
    category: { type: String, enum: POLICY_CATEGORIES, default: 'general' },
    summary: { type: String, trim: true, maxlength: 300, default: '' },
    content: { type: String, required: true, maxlength: 50_000 },
    status: { type: String, enum: Object.values(POLICY_STATUS), default: POLICY_STATUS.DRAFT },
    /** Employees must accept it before they can use the portal. */
    requiresAcceptance: { type: Boolean, default: true },
    /** Departments it applies to; empty means everyone. */
    departments: { type: [String], default: [] },
    /** Raised when a change needs everyone to accept the policy again. */
    version: { type: Number, default: 1, min: 1 },
    publishedAt: { type: Date, default: null },
    /** When the current version took effect. */
    versionDate: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

policySchema.index({ status: 1, departments: 1 });

toJSONPlugin(policySchema);

export const Policy = mongoose.model('Policy', policySchema);
