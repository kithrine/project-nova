import { ActiveStatus, FundingSourceKind } from "@/generated/prisma/client";
import type { FundingSource } from "@/generated/prisma/client";
import type { AuthContext } from "@/server/auth/context";
import { requireLifecycleState, requireNovaScope, requirePermission } from "@/server/auth/authorize";
import { prisma } from "@/server/database/prisma";
import { NotFoundError } from "@/server/errors/app-error";
import type { FundingSourceInput } from "@/features/funding/validation";

/**
 * Funding-source reference data (Story 1.8). Nova-owned; guarded by
 * funding.manage + Nova scope on every operation. Archive-not-delete:
 * deactivation preserves the record because funding assignments (5.3) and
 * funding reports (7.2) depend on it. No monetary amounts (ADR-010).
 * Audit events attach when the audit infrastructure lands (Epic 2+).
 */

export const FUNDING_KIND_LABELS: Record<FundingSourceKind, string> = {
  [FundingSourceKind.GRANT]: "Grant",
  [FundingSourceKind.CONTRACT]: "Contract",
  [FundingSourceKind.OTHER]: "Other",
};

export interface FundingSourceView {
  id: string;
  name: string;
  kind: FundingSourceKind;
  kindLabel: string;
  code: string | null;
  status: ActiveStatus;
  statusLabel: "Active" | "Inactive";
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
  notes: string | null;
}

function toDateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

/** Shape a Prisma FundingSource into its view model — pure, unit-testable. */
export function toFundingSourceView(source: FundingSource): FundingSourceView {
  return {
    id: source.id,
    name: source.name,
    kind: source.kind,
    kindLabel: FUNDING_KIND_LABELS[source.kind],
    code: source.code,
    status: source.status,
    statusLabel: source.status === ActiveStatus.ACTIVE ? "Active" : "Inactive",
    startDate: toDateOnly(source.startDate),
    endDate: toDateOnly(source.endDate),
    notes: source.notes,
  };
}

function requireFundingManage(ctx: AuthContext): void {
  requirePermission(ctx, "funding.manage");
  requireNovaScope(ctx);
}

function toPersistence(input: FundingSourceInput) {
  return {
    name: input.name,
    kind: input.kind as FundingSourceKind,
    code: input.code ?? null,
    startDate: input.startDate ? new Date(`${input.startDate}T00:00:00Z`) : null,
    endDate: input.endDate ? new Date(`${input.endDate}T00:00:00Z`) : null,
    notes: input.notes ?? null,
  };
}

export async function listFundingSources(ctx: AuthContext): Promise<FundingSourceView[]> {
  requireFundingManage(ctx);
  const sources = await prisma.fundingSource.findMany({ orderBy: { name: "asc" } });
  return sources.map(toFundingSourceView);
}

/** Only ACTIVE sources are selectable for new funding assignments (Story 5.3). */
export async function listActiveFundingSources(ctx: AuthContext): Promise<FundingSourceView[]> {
  requireFundingManage(ctx);
  const sources = await prisma.fundingSource.findMany({
    where: { status: ActiveStatus.ACTIVE },
    orderBy: { name: "asc" },
  });
  return sources.map(toFundingSourceView);
}

export async function getFundingSource(ctx: AuthContext, id: string): Promise<FundingSourceView> {
  requireFundingManage(ctx);
  const source = await prisma.fundingSource.findUnique({ where: { id } });
  if (!source) throw new NotFoundError();
  return toFundingSourceView(source);
}

export async function createFundingSource(
  ctx: AuthContext,
  input: FundingSourceInput,
): Promise<FundingSourceView> {
  requireFundingManage(ctx);
  const created = await prisma.fundingSource.create({ data: toPersistence(input) });
  return toFundingSourceView(created);
}

export async function updateFundingSource(
  ctx: AuthContext,
  id: string,
  input: FundingSourceInput,
): Promise<FundingSourceView> {
  requireFundingManage(ctx);
  const existing = await prisma.fundingSource.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError();
  const updated = await prisma.fundingSource.update({
    where: { id },
    data: toPersistence(input),
  });
  return toFundingSourceView(updated);
}

/** Archive: ACTIVE -> INACTIVE only (no arbitrary status edits). */
export async function deactivateFundingSource(ctx: AuthContext, id: string): Promise<void> {
  requireFundingManage(ctx);
  const existing = await prisma.fundingSource.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError();
  requireLifecycleState(existing.status, [ActiveStatus.ACTIVE]);
  await prisma.fundingSource.update({
    where: { id },
    data: { status: ActiveStatus.INACTIVE },
  });
}

/** Reactivate: INACTIVE -> ACTIVE only. */
export async function reactivateFundingSource(ctx: AuthContext, id: string): Promise<void> {
  requireFundingManage(ctx);
  const existing = await prisma.fundingSource.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError();
  requireLifecycleState(existing.status, [ActiveStatus.INACTIVE]);
  await prisma.fundingSource.update({
    where: { id },
    data: { status: ActiveStatus.ACTIVE },
  });
}
