import { z } from "zod";

/**
 * Roll numbers look like "23A31A05B1" — alphanumeric, no spaces. Kept
 * permissive (colleges vary) but rejects obviously malformed input client-side.
 * Real authorization always happens server-side via Firebase Auth (SRS §29, §57).
 */
export const rollNumberSchema = z
  .string()
  .trim()
  .min(4, "Roll number looks too short")
  .max(20, "Roll number looks too long")
  .regex(/^[A-Za-z0-9]+$/, "Roll number should only contain letters and numbers")
  .transform((val) => val.toUpperCase());

/**
 * Roll number is the only required field. Accounts are created for students
 * by the browser extension with a known default password, so sign-in asks for
 * one only if the student has changed theirs — hence optional here, with the
 * length check applied only when something was actually typed.
 */
export const loginSchema = z.object({
  rollNumber: rollNumberSchema,
  password: z
    .string()
    .optional()
    .refine((value) => !value || value.length >= 6, "Password must be at least 6 characters"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Moving off the shared default password onto one of your own. Requires being
 * signed in — there's no reset email, since `@handy.local` addresses can't
 * receive mail (see services/firebase/auth.ts).
 */
export const changePasswordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
