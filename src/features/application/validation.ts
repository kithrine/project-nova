import { z } from "zod";

/**
 * Draft application validation (Story 2.3). Deliberately LENIENT: every
 * field is optional and only sane length caps apply — partial, incomplete
 * drafts must always save. Submission-level completeness is Story 2.5's
 * separate, stricter schema.
 */

const draftField = z
  .string()
  .trim()
  .max(2000, "Keep this under 2,000 characters.")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const draftInputSchema = z.object({
  motivation: draftField,
  workExperience: draftField,
  animalExperience: draftField,
  availabilityNotes: draftField,
  transportationNotes: draftField,
});

export type DraftInput = z.infer<typeof draftInputSchema>;

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
