import { z } from "zod";

const date = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date.");
const optionalDate = date.or(z.literal("")).transform((value) => value || undefined);

export const trainingEnrollmentInputSchema = z
  .object({
    trainingProgramId: z.string().trim().min(1, "Choose a training program."),
    enrolledAt: date,
    expectedCompletionDate: optionalDate,
    providerName: z
      .string()
      .trim()
      .max(200, "Keep the provider name under 200 characters.")
      .transform((value) => value || undefined),
  })
  .superRefine((value, ctx) => {
    if (value.expectedCompletionDate && value.expectedCompletionDate < value.enrolledAt) {
      ctx.addIssue({
        code: "custom",
        path: ["expectedCompletionDate"],
        message: "Expected completion cannot be before enrollment.",
      });
    }
  });

export const trainingTransitionInputSchema = z.object({
  effectiveDate: date,
  completionMethod: z
    .enum([
      "KNOWLEDGE_ASSESSMENT",
      "PROVIDER_VERIFICATION",
      "OBSERVED_COMPETENCY",
      "PRIOR_LEARNING_VERIFICATION",
    ])
    .optional(),
});

export function trainingFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}
