import mongoose from 'mongoose';
import { FIELD_ENTITIES, SALES_FIELD_TYPES } from '../../constants/index.js';
import { toJSONPlugin } from '../../utils/mongoose.js';

const optionSchema = new mongoose.Schema(
  {
    value: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    color: { type: String, default: 'slate' },
  },
  { _id: false },
);

const salesFieldSchema = new mongoose.Schema(
  {
    /** Which record type this field belongs to. */
    entity: { type: String, enum: FIELD_ENTITIES, default: 'lead', immutable: true },
    /** Stable machine name used as the key inside the record's `data`. Unique per entity. Immutable. */
    key: { type: String, required: true, trim: true, immutable: true },
    label: { type: String, required: true, trim: true, maxlength: 60 },
    /** Immutable so that stored lead values never become inconsistent with their type. */
    type: { type: String, enum: SALES_FIELD_TYPES, required: true, immutable: true },
    required: { type: Boolean, default: false },
    defaultValue: { type: mongoose.Schema.Types.Mixed, default: null },
    placeholder: { type: String, trim: true, maxlength: 120, default: '' },
    helpText: { type: String, trim: true, maxlength: 200, default: '' },
    options: { type: [optionSchema], default: [] },
    /** Shown on the add / edit form. */
    isVisible: { type: Boolean, default: true },
    /** Shown as a column in List View and on Kanban cards. */
    showInList: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    /** System fields power titles and Kanban; they cannot be archived or hidden. */
    isSystem: { type: Boolean, default: false },
    /** Archived fields are removed from forms but their historical data is retained. */
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

salesFieldSchema.index({ entity: 1, key: 1 }, { unique: true });
salesFieldSchema.index({ entity: 1, isArchived: 1, order: 1 });

toJSONPlugin(salesFieldSchema);

export const SalesField = mongoose.model('SalesField', salesFieldSchema);
