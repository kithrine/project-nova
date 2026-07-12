import type { ApplicantProfile, Person } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { prisma } from "@/server/database/prisma";
import type { OnboardingInput } from "@/features/onboarding/validation";

/**
 * Applicant onboarding (Story 2.2). Ownership-based authorization: an
 * authenticated user acts only on their OWN Person/ApplicantProfile,
 * always via the server-resolved ctx.userId — a client-supplied user id
 * is never accepted. Holding these records confers no Role and no
 * Membership (the applicant/participant distinction; participant status
 * arrives with Epic 3, Story 3.1).
 */

export interface PersonView {
  id: string;
  legalFirstName: string;
  legalLastName: string;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  phone: string | null;
  mailingAddressLine1: string | null;
  mailingAddressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  hasProfile: boolean;
}

type PersonWithProfile = Person & { applicantProfile: ApplicantProfile | null };

/** Shape a Person (+ profile) into its view model — pure, unit-testable. */
export function toPersonView(person: PersonWithProfile): PersonView {
  return {
    id: person.id,
    legalFirstName: person.legalFirstName,
    legalLastName: person.legalLastName,
    dateOfBirth: person.dateOfBirth.toISOString().slice(0, 10),
    phone: person.applicantProfile?.phone ?? null,
    mailingAddressLine1: person.applicantProfile?.mailingAddressLine1 ?? null,
    mailingAddressLine2: person.applicantProfile?.mailingAddressLine2 ?? null,
    city: person.applicantProfile?.city ?? null,
    region: person.applicantProfile?.region ?? null,
    postalCode: person.applicantProfile?.postalCode ?? null,
    hasProfile: person.applicantProfile !== null,
  };
}

/** The requester's own Person, or null before onboarding. Ownership scope only. */
export async function getOwnPerson(ctx: AuthContext): Promise<PersonView | null> {
  const person = await prisma.person.findUnique({
    where: { userId: ctx.userId },
    include: { applicantProfile: true },
  });
  return person ? toPersonView(person) : null;
}

/**
 * Create the requester's Person + ApplicantProfile in one atomic write.
 * Idempotent: a returning applicant reuses their existing record — no
 * duplicates, and a lost race (double submit) resolves to the winner's row.
 */
export async function completeApplicantOnboarding(
  ctx: AuthContext,
  input: OnboardingInput,
): Promise<PersonView> {
  const existing = await prisma.person.findUnique({
    where: { userId: ctx.userId },
    include: { applicantProfile: true },
  });
  if (existing) {
    return toPersonView(existing);
  }

  try {
    const created = await prisma.person.create({
      data: {
        userId: ctx.userId,
        legalFirstName: input.legalFirstName,
        legalLastName: input.legalLastName,
        dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00Z`),
        applicantProfile: {
          create: {
            phone: input.phone,
            mailingAddressLine1: input.mailingAddressLine1,
            mailingAddressLine2: input.mailingAddressLine2 ?? null,
            city: input.city,
            region: input.region,
            postalCode: input.postalCode,
          },
        },
      },
      include: { applicantProfile: true },
    });
    return toPersonView(created);
  } catch (error) {
    // Unique(userId) lost a double-submit race: the record exists — reuse it.
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      const winner = await prisma.person.findUnique({
        where: { userId: ctx.userId },
        include: { applicantProfile: true },
      });
      if (winner) return toPersonView(winner);
    }
    throw error;
  }
}
