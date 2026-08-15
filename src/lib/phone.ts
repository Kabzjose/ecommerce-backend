import { z } from 'zod';

// Accepts: 0712345678, 0112345678, 712345678, +254712345678, 254712345678
// Normalizes all of them to: +254712345678
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');

  if (digits.startsWith('254') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+254${digits.slice(1)}`;
  }
  if ((digits.startsWith('7') || digits.startsWith('1')) && digits.length === 9) {
    return `+254${digits}`;
  }
  return null; // couldn't confidently normalize
}

// A zod schema that accepts any common input format, and TRANSFORMS it
// into the canonical +254XXXXXXXXX format before it ever reaches your service layer
export const kenyanPhoneSchema = z.string().transform((val, ctx) => {
  const normalized = normalizeKenyanPhone(val);
  if (!normalized) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a valid Kenyan phone number, e.g. 0712345678',
    });
    return z.NEVER;
  }
  return normalized;
});