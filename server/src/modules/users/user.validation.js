import { z } from 'zod';
import { LEAVE_TYPES, ROLES, USER_STATUS } from '../../constants/index.js';
import { paginationQuery } from '../../utils/pagination.js';
import { dateOnly, objectId, optionalTrimmed, passwordSchema, trimmed } from '../../utils/validators.js';

const email = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address'));

/** Days per leave type; null (or omitted) leaves that type uncapped. */
const leaveEntitlements = z
  .object(
    Object.fromEntries(
      LEAVE_TYPES.map((t) => [t, z.coerce.number().int('Whole days only').min(0, 'Cannot be negative').max(366).nullable().optional()]),
    ),
  )
  .optional();

const baseFields = {
  firstName: trimmed('First name', { max: 60 }),
  lastName: optionalTrimmed('Last name', 60),
  email,
  phone: z
    .string()
    .trim()
    .max(20, 'Phone number is too long')
    .regex(/^[+\d\s()-]*$/, 'Phone number can only contain digits, spaces and + ( ) -')
    .optional(),
  department: optionalTrimmed('Department', 80),
  designation: optionalTrimmed('Designation', 80),
  joiningDate: dateOnly('Joining date').nullable().optional(),
  role: z.enum(Object.values(ROLES)).optional(),
  company: objectId('company').nullable().optional(),
  leaveEntitlements,
};

export const createUserSchema = z.object({
  ...baseFields,
  employeeId: z
    .string()
    .trim()
    .max(20)
    .regex(/^[A-Za-z0-9-_]*$/, 'Employee ID can only contain letters, numbers, - and _')
    .optional(),
  password: passwordSchema,
});

export const updateUserSchema = z
  .object({
    ...baseFields,
    firstName: baseFields.firstName.optional(),
    email: email.optional(),
    employeeId: z
      .string()
      .trim()
      .min(1, 'Employee ID is required')
      .max(20)
      .regex(/^[A-Za-z0-9-_]+$/, 'Employee ID can only contain letters, numbers, - and _')
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const updateStatusSchema = z.object({
  status: z.enum(Object.values(USER_STATUS)),
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

export const listUsersQuery = z.object({
  ...paginationQuery,
  search: z.string().trim().max(100).optional(),
  department: z.string().trim().max(80).optional(),
  role: z.enum(Object.values(ROLES)).optional(),
  status: z.enum(Object.values(USER_STATUS)).optional(),
  company: objectId('company').optional(),
  sortBy: z.enum(['firstName', 'employeeId', 'joiningDate', 'createdAt', 'department']).default('firstName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
