import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { ROLES, USER_STATUS } from '../../constants/index.js';
import { toJSONPlugin } from '../../utils/mongoose.js';

const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, trim: true, maxlength: 60, default: '' },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    joiningDate: { type: String, default: null },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.EMPLOYEE, index: true },
    status: { type: String, enum: Object.values(USER_STATUS), default: USER_STATUS.ACTIVE, index: true },
    passwordHash: { type: String, required: true, select: false },
    // Incremented to invalidate every issued token (password change, deactivation).
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: { type: Date, default: null },
    deactivatedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ firstName: 1, lastName: 1 });
userSchema.index({ department: 1 });

userSchema.virtual('fullName').get(function fullName() {
  return [this.firstName, this.lastName].filter(Boolean).join(' ');
});

userSchema.methods.setPassword = async function setPassword(password) {
  this.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
};

userSchema.methods.verifyPassword = function verifyPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

toJSONPlugin(userSchema, { hide: ['passwordHash', 'tokenVersion'] });

export const User = mongoose.model('User', userSchema);
