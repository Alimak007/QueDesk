import mongoose from 'mongoose';
import { toJSONPlugin } from '../../utils/mongoose.js';

/** One employee's agreement to one version of a policy. Never edited or removed. */
const policyAcceptanceSchema = new mongoose.Schema(
  {
    policy: { type: mongoose.Schema.Types.ObjectId, ref: 'Policy', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, required: true },
  },
  { timestamps: { createdAt: 'acceptedAt', updatedAt: false } },
);

policyAcceptanceSchema.index({ policy: 1, user: 1, version: 1 }, { unique: true });
policyAcceptanceSchema.index({ user: 1 });

toJSONPlugin(policyAcceptanceSchema);

export const PolicyAcceptance = mongoose.model('PolicyAcceptance', policyAcceptanceSchema);
