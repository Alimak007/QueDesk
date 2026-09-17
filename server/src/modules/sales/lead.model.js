import mongoose from 'mongoose';
import { toJSONPlugin } from '../../utils/mongoose.js';

const leadSchema = new mongoose.Schema(
  {
    /** Values keyed by `SalesField.key`. Shape is governed by the admin configuration. */
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Denormalised lowercase text of all searchable values, used for free-text search. */
    searchText: { type: String, default: '', select: false },
    /** Manual ordering inside a Kanban column. */
    position: { type: Number, default: 0 },
    /** Set once the lead has been converted into a customer. */
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
    convertedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

leadSchema.index({ owner: 1, updatedAt: -1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ 'data.leadStatus': 1, position: 1 });

toJSONPlugin(leadSchema, { hide: ['searchText'] });

export const Lead = mongoose.model('Lead', leadSchema);
