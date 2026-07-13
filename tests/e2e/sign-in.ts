import { clerk } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";

/**
 * Shared sign-in with backoff: the Clerk development instance rate-limits
 * FAPI traffic (429s), and sign-in-heavy specs running across parallel
 * workers can burst past it. A short exponential wait absorbs the burst
 * window without slowing runs that stay under the limit.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/sign-in");
  for (let attempt = 0; ; attempt++) {
    try {
      await clerk.signIn({
        page,
        signInParams: { strategy: "email_code", identifier: email },
      });
      break;
    } catch (error) {
      if (attempt < 3 && /too many requests|429/i.test(String(error))) {
        await page.waitForTimeout(8_000 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
  await page.waitForFunction(
    () => Boolean((window as unknown as { Clerk?: { user?: unknown } }).Clerk?.user),
    undefined,
    { timeout: 15_000 },
  );
}
