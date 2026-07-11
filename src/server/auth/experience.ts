import type { AuthContext } from "@/server/auth/context";
import { isNovaRole, isShelterRole } from "@/server/domain/roles";

/**
 * Experience access (Story 1.7). Each protected route group is gated by
 * membership type, server-side:
 *   - operations: any ACTIVE Nova-staff membership
 *   - shelter:    any ACTIVE shelter membership
 *   - participant: any provisioned account (the linked participant identity
 *     arrives with Epic 2/3 and tightens this gate there)
 * The shell gate controls which WORKSPACE renders; every operation inside
 * still runs the full permission + scope + lifecycle checks (Story 1.5).
 */
export type Experience = "participant" | "shelter" | "operations";

export function canAccessExperience(ctx: AuthContext, experience: Experience): boolean {
  switch (experience) {
    case "operations":
      return ctx.memberships.some((m) => isNovaRole(m.role));
    case "shelter":
      return ctx.memberships.some((m) => isShelterRole(m.role));
    case "participant":
      return true;
  }
}

/**
 * Where /dashboard sends a signed-in user. Priority: operations, then
 * shelter, then participant — staff who also hold other memberships land
 * on their staff workspace.
 */
export function routeForContext(ctx: AuthContext): "/operations" | "/shelter" | "/participant" {
  if (canAccessExperience(ctx, "operations")) return "/operations";
  if (ctx.memberships.some((m) => isShelterRole(m.role))) return "/shelter";
  return "/participant";
}
