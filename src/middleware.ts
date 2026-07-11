import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Authentication boundary (Story 1.2). Deny-by-default: everything is
 * protected except the explicit public surface. Authentication only —
 * authorization (permission + resource scope + lifecycle state) is
 * evaluated server-side per operation (Story 1.5, ADR-004).
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health",
  // Webhooks authenticate via signature verification, not sessions.
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
