import { z } from 'zod';
import { passwordSchema } from '../../utils/validators.js';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Password is required').max(128),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: 'New password must be different from the current password',
  });

export const updateProfileSchema = z.object({
  phone: z.string().trim().max(20, 'Phone number is too long').optional(),
});
