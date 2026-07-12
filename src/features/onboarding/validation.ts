import { z } from "zod";

/**
 * Applicant onboarding validation (Story 2.2). Zod at the server boundary
 * (docs/architecture/coding-standards.md), shared with the form. Messages
 * are plain and respectful (docs/ux/content-style-guide.md).
 *
 * Deliberately NOT validated here: any eligibility rule (age limits,
 * geography, history). Eligibility is determined during review (2.8) under
 * policy that is still open (docs/planning/open-questions.md #1) — this
 * schema checks only that the data is well-formed.
 */

const requiredName = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}.`)
    .max(100, "Keep this under 100 characters.");

const dateOfBirth = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime());
  }, "Enter a real date.")
  .refine((value) => value < new Date().toISOString().slice(0, 10), {
    message: "The date of birth must be in the past.",
  })
  .refine(
    (value) => {
      const year = Number(value.slice(0, 4));
      return year >= new Date().getFullYear() - 120;
    },
    { message: "Please double-check the year." },
  );

export const onboardingInputSchema = z.object({
  legalFirstName: requiredName("legal first name"),
  legalLastName: requiredName("legal last name"),
  dateOfBirth,
  phone: z
    .string()
    .trim()
    .regex(/^[+()\d\s.-]{7,20}$/, "Enter a phone number we can reach you at."),
  mailingAddressLine1: z
    .string()
    .trim()
    .min(1, "Enter your mailing address.")
    .max(200, "Keep this under 200 characters."),
  mailingAddressLine2: z
    .string()
    .trim()
    .max(200, "Keep this under 200 characters.")
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
  city: z.string().trim().min(1, "Enter your city.").max(100, "Keep this under 100 characters."),
  region: z
    .string()
    .trim()
    .min(1, "Enter your state or region.")
    .max(100, "Keep this under 100 characters."),
  postalCode: z
    .string()
    .trim()
    .min(3, "Enter your postal code.")
    .max(12, "Enter your postal code."),
});

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;

/** First message per field — stable across Zod versions. */
export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}
