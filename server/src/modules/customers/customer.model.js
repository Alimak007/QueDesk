import mongoose from 'mongoose';
import { toJSONPlugin } from '../../utils/mongoose.js';

const customerSchema = new mongoose.Schema(
  {
    /** Values keyed by the Customer form field keys (admin-configurable). */
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Assigned employee. */
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    source: { type: String, enum: ['manual', 'lead'], default: 'manual' },
    /** The lead this customer was converted from (at most one customer per lead). */
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', default: null },
    convertedAt: { type: Date, default: null },
    convertedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    searchText: { type: String, default: '', select: false },
  },
  { timestamps: true, minimize: false },
);

// Database-level guarantee that a lead can only ever be converted once.
customerSchema.index({ lead: 1 }, { unique: true, partialFilterExpression: { lead: { $type: 'objectId' } } });
customerSchema.index({ owner: 1, updatedAt: -1 });
customerSchema.index({ createdAt: -1 });
customerSchema.index({ 'data.customerStatus': 1 });

toJSONPlugin(customerSchema, { hide: ['searchText'] });

export const Customer = mongoose.model('Customer', customerSchema);
