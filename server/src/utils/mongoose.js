import mongoose from 'mongoose';

/** Consistent JSON output for every model: `id` instead of `_id`, no `__v`. */
export function toJSONPlugin(schema, { hide = [] } = {}) {
  const transform = (_doc, ret) => {
    ret.id = ret._id?.toString();
    delete ret._id;
    delete ret.__v;
    for (const key of hide) delete ret[key];
    return ret;
  };
  schema.set('toJSON', { virtuals: true, versionKey: false, transform });
  schema.set('toObject', { virtuals: true, versionKey: false });
}

export const isObjectId = (value) => mongoose.isValidObjectId(value) && /^[a-f\d]{24}$/i.test(String(value));

export const USER_SUMMARY_FIELDS = 'firstName lastName email employeeId department designation role status';
