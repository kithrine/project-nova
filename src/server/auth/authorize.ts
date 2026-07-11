import type { AuthContext } from "@/server/auth/context";
import { permissionsForRoles, type Permission } from "@/server/auth/permissions";
import { isNovaRole } from "@/server/domain/roles";
import {
  AuthorizationError,
  LifecycleError,
  NotFoundError,
} from "@/server/errors/app-error";
import type { MembershipView } from "@/server/repositories/types";

/**
 * Authorization guards (Story 1.5).
 *
 * Authorization = Permission + Resource Scope + Lifecycle State
 * (docs/architecture/authorization-rbac.md). Deny-by-default: every check
 * throws a typed error unless it affirmatively passes. All inputs are
 * server-resolved (AuthContext) — client-supplied claims are never
 * consulted.
 */

/** Step 4 — permission, derived solely from ACTIVE memberships. */
export function hasPermission(ctx: AuthContext, permission: Permission): boolean {
  const roles = ctx.memberships.map((m) => m.role);
  return permissionsForRoles(roles).has(permission);
}

export function requirePermission(ctx: AuthContext, permission: Permission): void {
  if (!hasPermission(ctx, permission)) {
    throw new AuthorizationError();
  }
}

/** True when the requester holds any ACTIVE Nova-staff membership (Nova-wide scope). */
export function hasNovaScope(ctx: AuthContext): boolean {
  return ctx.memberships.some((m) => isNovaRole(m.role));
}

export function requireNovaScope(ctx: AuthContext): MembershipView {
  const membership = ctx.memberships.find((m) => isNovaRole(m.role));
  if (!membership) {
    throw new AuthorizationError();
  }
  return membership;
}

/**
 * Step 6 — resource scope. A resource belonging to an organization is in
 * scope when the requester holds an ACTIVE membership in that organization,
 * or any Nova-staff membership (Nova-wide scope). Participant self-scope
 * (own application, own placement) arrives with the participant linkage in
 * Epic 2/3 and extends this check there.
 */
export function requireOrganizationScope(
  ctx: AuthContext,
  organizationId: string,
): MembershipView {
  const member = ctx.memberships.find((m) => m.organizationId === organizationId);
  if (member) return member;

  const novaMembership = ctx.memberships.find((m) => isNovaRole(m.role));
  if (novaMembership) return novaMembership;

  throw new AuthorizationError();
}

/** Step 7 — lifecycle state gating. */
export function requireLifecycleState<TState extends string>(
  current: TState,
  allowed: readonly TState[],
): void {
  if (!allowed.includes(current)) {
    throw new LifecycleError();
  }
}

/** Step 8 — business prerequisites; every failure reason must be resolved. */
export function requirePrerequisites(failures: readonly string[]): void {
  if (failures.length > 0) {
    throw new LifecycleError(
      `This action isn't available yet: ${failures.join("; ")}.`,
    );
  }
}

/**
 * Orchestrates steps 4–8 for one protected operation
 * (docs/architecture/api-service-design.md):
 *   permission → load resource → scope → lifecycle → prerequisites.
 * Steps 1–3 happen in requireAuthContext(); steps 9–11 (transaction,
 * events, shaped result) belong to the calling service.
 */
export async function authorizeOperation<TResource>(options: {
  ctx: AuthContext;
  permission: Permission;
  loadResource: () => Promise<TResource | null>;
  /** Organization the resource belongs to; return null for Nova-global resources. */
  resourceOrganizationId: (resource: TResource) => string | null;
  lifecycle?: (resource: TResource) => { current: string; allowed: readonly string[] };
  prerequisites?: (resource: TResource, ctx: AuthContext) => readonly string[];
}): Promise<TResource> {
  const { ctx } = options;

  requirePermission(ctx, options.permission);

  const resource = await options.loadResource();
  if (resource === null) {
    throw new NotFoundError();
  }

  const organizationId = options.resourceOrganizationId(resource);
  if (organizationId === null) {
    requireNovaScope(ctx);
  } else {
    requireOrganizationScope(ctx, organizationId);
  }

  if (options.lifecycle) {
    const { current, allowed } = options.lifecycle(resource);
    requireLifecycleState(current, allowed);
  }

  if (options.prerequisites) {
    requirePrerequisites(options.prerequisites(resource, ctx));
  }

  return resource;
}
