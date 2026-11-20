import { expect, test, type Locator, type Page } from "@playwright/test";

/** U+2212, the minus sign the balance uses (not the ASCII hyphen). */
const MINUS = "−";

/**
 * Clicks a Modal opener until its dialog is open. Before React hydrates, the
 * button has no click handler and a click does nothing (known UX gap, see
 * docs/decisions.md), so the click is retried on a condition, never a sleep.
 */
async function openDialog(
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

test("create a group, add members and an expense, then mark a line as paid", async ({
  page,
}) => {
  // Create group
  await page.goto("/");
  await page.getByRole("link", { name: "Create a group" }).click();
  await page.getByLabel("Group name").fill("E2E trip");
  await page.getByRole("radio", { name: "USD" }).check();
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "E2E trip" }),
  ).toBeVisible();

  // Add 3 members
  const members = page.getByRole("region", { name: "Members" });
  for (const name of ["Aung", "Bo Bo", "Chit"]) {
    const dialog = await openDialog(
      page,
      members.getByRole("button", { name: "Add member" }),
      "Add member",
    );
    await dialog.getByLabel("Member name").fill(name);
    await dialog.getByRole("button", { name: "Add member" }).click();
    await expect(dialog).toBeHidden();
    await expect(members.getByText(name, { exact: true })).toBeVisible();
  }

  // Add one expense: USD 90.00 paid by Aung, shared by all 3 (the default)
  const expenses = page.getByRole("region", { name: "Expenses" });
  const expenseDialog = await openDialog(
    page,
    expenses.getByRole("button", { name: "Add expense" }),
    "Add expense",
  );
  await expenseDialog.getByLabel("Amount (USD)").fill("90");
  await expenseDialog.getByLabel("Description (optional)").fill("Dinner");
  await expenseDialog
    .getByRole("radiogroup", { name: "Paid by" })
    .getByRole("radio", { name: "Aung" })
    .check();
  const sharedBy = expenseDialog
    .getByRole("group", { name: "Shared by" })
    .getByRole("checkbox");
  await expect(sharedBy).toHaveCount(3);
  for (const checkbox of await sharedBy.all()) {
    await expect(checkbox).toBeChecked();
  }
  await expenseDialog.getByRole("button", { name: "Add expense" }).click();
  await expect(expenseDialog).toBeHidden();

  // Balance. splitEqually(9000, 3): q = 3000, r = 0, so everyone's share is
  // USD 30.00 whatever the (random) id order. Nets: Aung +60.00, Bo Bo and
  // Chit -30.00. Both debtors pay Aung 30.00; the line order depends on the
  // ids, so the lines are checked as a set.
  const balance = page.getByRole("region", { name: "Balance" });
  const lines = balance.getByRole("list", { name: "Who pays whom" });
  const perMember = balance.getByRole("list", { name: "Per member" });
  const memberRow = (name: string) =>
    perMember
      .getByRole("listitem")
      .filter({ has: page.getByText(name, { exact: true }) });
  const boBoLine = lines.getByRole("button", {
    name: "Mark as paid: Bo Bo pays Aung USD 30.00",
    exact: true,
  });
  const chitLine = lines.getByRole("button", {
    name: "Mark as paid: Chit pays Aung USD 30.00",
    exact: true,
  });

  await expect(lines.getByRole("listitem")).toHaveCount(2);
  await expect(
    lines.getByText("Bo Bo pays Aung USD 30.00", { exact: true }),
  ).toBeVisible();
  await expect(
    lines.getByText("Chit pays Aung USD 30.00", { exact: true }),
  ).toBeVisible();
  await expect(boBoLine).toBeVisible();
  await expect(chitLine).toBeVisible();
  await expect(memberRow("Aung")).toContainText("is owed +USD 60.00");
  await expect(memberRow("Bo Bo")).toContainText(`owes ${MINUS}USD 30.00`);
  await expect(memberRow("Chit")).toContainText(`owes ${MINUS}USD 30.00`);

  // Mark Bo Bo's line as paid: Bo Bo 0, Aung +30.00, one line left.
  const settleDialog = await openDialog(page, boBoLine, "Mark as paid?");
  await expect(
    settleDialog.getByText("Bo Bo paid Aung USD 30.00. This can't be undone."),
  ).toBeVisible();
  await settleDialog
    .getByRole("button", { name: "Mark as paid", exact: true })
    .click();
  await expect(settleDialog).toBeHidden();

  // The line is gone, and the rest is checked too: with from/to swapped the
  // line would also vanish (replaced by "Bo Bo pays Aung USD 60.00").
  await expect(boBoLine).toHaveCount(0);
  await expect(lines.getByRole("listitem")).toHaveCount(1);
  await expect(chitLine).toBeVisible();
  await expect(memberRow("Aung")).toContainText("is owed +USD 30.00");
  await expect(memberRow("Bo Bo")).toContainText("settled up USD 0.00");
  await expect(memberRow("Chit")).toContainText(`owes ${MINUS}USD 30.00`);
});
