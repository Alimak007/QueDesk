import { z } from 'zod';

export const passwordRule = z
  .string()
  .min(8, 'At least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/\d/, 'Must contain a number');

export function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '@#$%&*';
  const random = (set) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length];
  const chars = [random(alphabet.slice(0, 24)), random(alphabet.slice(24)), random(digits), random(symbols)];
  while (chars.length < 12) chars.push(random(alphabet + digits));
  return chars.sort(() => crypto.getRandomValues(new Uint32Array(1))[0] % 3 - 1).join('');
}

