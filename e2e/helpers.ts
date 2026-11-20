import { expect, type Locator, type Page } from "@playwright/test";

/** U+2212, the minus sign the balance uses (not the ASCII hyphen). */
export const MINUS = "−";

/**
 * Clicks a Modal opener until its dialog is open. Before React hydrates, the
 * button has no click handler and a click does nothing (known UX gap, see
 * docs/decisions.md), so the click is retried on a condition, never a sleep.
 */
export async function openDialog(
  page: Page,
  opener: Locator,
  name: string,
): Promise<Locator> {
  const dialog = page.getByRole("dialog", { name });
  await expect(async () => {
    if (!(await dialog.isVisible())) await opener.click();
    await expect(dialog).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  return dialog;
}

/**
 * Counts Server Action calls: Next.js sends each one as a POST with the
 * `next-action` header (ACTION_HEADER in next/dist/client/components/
 * app-router-headers.js). A network check, so no accessible selector applies.
 * Read `.count` after the action's visible result.
 */
export function countServerActions(page: Page): { readonly count: number } {
  const counter = { count: 0 };
  page.on("request", (request) => {
    if (request.method() === "POST" && request.headers()["next-action"]) {
      counter.count += 1;
    }
  });
  return counter;
}

/**
 * Waits until React has hydrated `element`. For a page with no Modal, where
 * openDialog can't prove hydration. A click before hydration is a known gap
 * (docs/decisions.md), so tests wait instead of encoding it. Uses a React
 * internal: hydrated DOM nodes get a `__reactProps$<random>` key.
 */
export async function waitForHydration(element: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        element.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith("__reactProps$")),
        ),
      {
        message:
          "React never hydrated the element: no __reactProps$ key on it (a React internal; check it after a React upgrade)",
        timeout: 15_000,
      },
    )
    .toBe(true);
}
