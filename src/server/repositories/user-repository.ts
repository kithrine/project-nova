import type { User } from "@/generated/prisma/client";
import { prisma } from "@/server/database/prisma";
import type { UserView } from "@/server/repositories/types";

/** Shape a Prisma User into its view model — pure, unit-testable. */
export function toUserView(user: User): UserView {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    hasClerkIdentity: user.clerkUserId !== null,
  };
}

export async function findUserByClerkId(clerkUserId: string): Promise<UserView | null> {
  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  return user ? toUserView(user) : null;
}

export async function findUserByEmail(email: string): Promise<UserView | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  return user ? toUserView(user) : null;
}
