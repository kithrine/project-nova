import { z } from "zod";

/**
 * Funding-source boundary validation (Story 1.8). Zod at the server
 * boundary (docs/architecture/coding-standards.md); shared with the form
 * for consistent messages. Dates travel as YYYY-MM-DD strings and are
 * converted to Date in the service.
 */

const optionalTrimmed = z
  .string()
  .trim()
  .max(200, "Keep this under 200 characters.")
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date.")
  .or(z.literal(""))
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const fundingSourceInputSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name for this funding source."),
    kind: z.enum(["GRANT", "CONTRACT", "OTHER"], {
      message: "Choose grant, contract, or other.",
    }),
    code: optionalTrimmed,
    startDate: optionalDate,
    endDate: optionalDate,
    notes: z
      .string()
      .trim()
      .max(2000, "Keep notes under 2,000 characters.")
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "The end date must be on or after the start date.",
      });
    }
  });

export type FundingSourceInput = z.infer<typeof fundingSourceInputSchema>;

/** First message per field — stable across Zod versions (reads issues directly). */
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
