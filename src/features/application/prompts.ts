import type { ApplicationView } from "@/server/services/application-service";

/**
 * The application form's prompts — the single source of truth for field
 * labels, shared by the draft form (Story 2.3) and the server-side
 * submission completeness check (Story 2.5), so a missing-item message
 * always names the field exactly as the applicant sees it. Pure data,
 * client-safe (the service import above is type-only and fully erased).
 */

export type ApplicationPromptName = keyof Pick<
  ApplicationView,
  | "motivation"
  | "workExperience"
  | "animalExperience"
  | "availabilityNotes"
  | "transportationNotes"
>;

export const APPLICATION_PROMPTS: {
  name: ApplicationPromptName;
  label: string;
  hint: string;
}[] = [
  {
    name: "motivation",
    label: "Why do you want to join Project Nova?",
    hint: "There's no right answer — tell us in your own words.",
  },
  {
    name: "workExperience",
    label: "Work or volunteer experience",
    hint: "Any kind counts, recent or not.",
  },
  {
    name: "animalExperience",
    label: "Experience with animals",
    hint: "Pets, farm work, volunteering — or none yet; that's okay.",
  },
  {
    name: "availabilityNotes",
    label: "When are you available to work?",
    hint: "Days and times that could work for you.",
  },
  {
    name: "transportationNotes",
    label: "How would you get to a shelter site?",
    hint: "Bus, car, rides, walking — whatever applies.",
  },
];
