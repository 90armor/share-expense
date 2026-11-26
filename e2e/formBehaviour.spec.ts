import { expect, test, type Page } from "@playwright/test";
import {
  countServerActions,
  MINUS,
  openDialog,
  waitForHydration,
} from "./helpers";

// Browser-only form behaviour that unit tests (first render only) can't see:
// Modal close/stay-open, drafts, double submits, keyboard, bigint amounts.
// Each test creates its own group, so they run in parallel.
//
// Parked gaps are deliberately not encoded (docs/decisions.md): closing
// Remove/Mark as paid while pending, and clicks before hydration (openDialog
// retries; waitForHydration).
test.describe.configure({ mode: "parallel" });

async function createGroup(page: Page, name: string, currency = "USD") {
  await page.goto("/groups/new");
  await page.getByLabel("Group name").fill(name);
  await page.getByRole("radio", { name: currency }).check();
  await page.getByRole("button", { name: "Create group" }).click();
  await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
}

function members(page: Page) {
  return page.getByRole("region", { name: "Members" });
}

function expenses(page: Page) {
  return page.getByRole("region", { name: "Expenses" });
}

async function openAddMember(page: Page) {
  return openDialog(
    page,
    members(page).getByRole("button", { name: "Add member" }),
    "Add member",
  );
}

async function openAddExpense(page: Page) {
  return openDialog(
    page,
    expenses(page).getByRole("button", { name: "Add expense" }),
    "Add expense",
  );
}

async function addMember(page: Page, name: string) {
  const dialog = await openAddMember(page);
  await dialog.getByLabel("Member name").fill(name);
  await dialog.getByRole("button", { name: "Add member" }).click();
  await expect(dialog).toBeHidden();
  await expect(members(page).getByText(name, { exact: true })).toBeVisible();
}

test("member Modals: a remove closes on success; a duplicate name and an in-use member keep the dialog open", async ({
  page,
}) => {
  await createGroup(page, "E2E member errors");
  await addMember(page, "Aung");
  await addMember(page, "Bo Bo");
  // Aung pays an expense shared by Aung only, so Bo Bo has none.
  const expenseDialog = await openAddExpense(page);
  await expenseDialog.getByLabel("Amount (USD)").fill("10");
  await expenseDialog
    .getByRole("radiogroup", { name: "Paid by" })
    .getByRole("radio", { name: "Aung" })
    .check();
  await expenseDialog
    .getByRole("group", { name: "Shared by" })
    .getByRole("checkbox", { name: "Bo Bo" })
    .uncheck();
  await expenseDialog.getByRole("button", { name: "Add expense" }).click();
  await expect(expenseDialog).toBeHidden();

  // Duplicate name (CONFLICT): stays open, alert, typed name kept.
  const addDialog = await openAddMember(page);
  await addDialog.getByLabel("Member name").fill("aung");
  await addDialog.getByRole("button", { name: "Add member" }).click();
  await expect(addDialog.getByRole("alert")).toHaveText(
    "Error: A member named “aung” is already in this group.",
  );
  await expect(addDialog).toBeVisible();
  await expect(addDialog.getByLabel("Member name")).toHaveValue("aung");
  await expect(members(page).getByRole("listitem")).toHaveCount(2);
  // Close + reopen: the old alert is gone, the typed name is kept.
  await addDialog.getByRole("button", { name: "Close" }).click();
  await expect(addDialog).toBeHidden();
  await openAddMember(page);
  await expect(addDialog.getByRole("alert")).toHaveCount(0);
  await expect(addDialog.getByLabel("Member name")).toHaveValue("aung");
  // A new submit is a new error: the alert is back.
  await addDialog.getByRole("button", { name: "Add member" }).click();
  await expect(addDialog.getByRole("alert")).toHaveText(
    "Error: A member named “aung” is already in this group.",
  );
  await addDialog.getByRole("button", { name: "Close" }).click();

  // Remove a member who pays for an expense (CONFLICT): stays open.
  const removeAung = await openDialog(
    page,
    members(page).getByRole("button", { name: "Remove Aung" }),
    "Remove member?",
  );
  await removeAung.getByRole("button", { name: "Remove member" }).click();
  await expect(removeAung.getByRole("alert")).toHaveText(
    "Error: This member paid for or shares an expense and can't be removed.",
  );
  await expect(removeAung).toBeVisible();
  await expect(members(page).getByText("Aung", { exact: true })).toBeVisible();
  // Close + reopen: the old alert is gone.
  await removeAung.getByRole("button", { name: "Close" }).click();
  await expect(removeAung).toBeHidden();
  await openDialog(
    page,
    members(page).getByRole("button", { name: "Remove Aung" }),
    "Remove member?",
  );
  await expect(removeAung.getByRole("alert")).toHaveCount(0);
  await removeAung.getByRole("button", { name: "Close" }).click();

  // Remove a member with no expenses: the dialog closes and the row goes.
  const removeBoBo = await openDialog(
    page,
    members(page).getByRole("button", { name: "Remove Bo Bo" }),
    "Remove member?",
  );
  await removeBoBo.getByRole("button", { name: "Remove member" }).click();
  await expect(
    page.getByRole("dialog", { name: "Remove member?" }),
  ).toHaveCount(0);
  await expect(members(page).getByText("Bo Bo", { exact: true })).toHaveCount(
    0,
  );
  await expect(members(page).getByRole("listitem")).toHaveCount(1);
});

test("Add expense keeps a draft across Close and Esc and is empty after a success", async ({
  page,
}) => {
  await createGroup(page, "E2E draft");
  await addMember(page, "Aung");
  await addMember(page, "Bo Bo");

  const dialog = await openAddExpense(page);
  const amount = dialog.getByLabel("Amount (USD)");
  const description = dialog.getByLabel("Description (optional)");
  const paidBy = dialog.getByRole("radiogroup", { name: "Paid by" });
  const sharedBy = dialog.getByRole("group", { name: "Shared by" });
  const expectDraft = async () => {
    await expect(amount).toHaveValue("12.34");
    await expect(description).toHaveValue("Taxi");
    await expect(paidBy.getByRole("radio", { name: "Bo Bo" })).toBeChecked();
    await expect(paidBy.getByRole("radio", { name: "Aung" })).not.toBeChecked();
    await expect(
      sharedBy.getByRole("checkbox", { name: "Aung" }),
    ).not.toBeChecked();
    await expect(
      sharedBy.getByRole("checkbox", { name: "Bo Bo" }),
    ).toBeChecked();
  };

  // No submit before the draft, so no error alert can be involved.
  await amount.fill("12.34");
  await description.fill("Taxi");
  await paidBy.getByRole("radio", { name: "Bo Bo" }).check();
  await sharedBy.getByRole("checkbox", { name: "Aung" }).uncheck();

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await openAddExpense(page);
  await expectDraft();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await openAddExpense(page);
  await expectDraft();

  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    expenses(page).getByRole("row").filter({ hasText: "Taxi" }),
  ).toContainText("USD 12.34");

  // After a success: empty fields, no payer, everyone shares again.
  await openAddExpense(page);
  await expect(amount).toHaveValue("");
  await expect(description).toHaveValue("");
  for (const radio of await paidBy.getByRole("radio").all()) {
    await expect(radio).not.toBeChecked();
  }
  await expect(sharedBy.getByRole("checkbox")).toHaveCount(2);
  for (const checkbox of await sharedBy.getByRole("checkbox").all()) {
    await expect(checkbox).toBeChecked();
  }
});

test("keyboard: focus starts on Close, Tab never reaches the page behind, Esc closes, Enter submits", async ({
  page,
}) => {
  // One member, so the page behind has its own focusable buttons
  // (Add expense, Add member, Remove Aung) that Tab must not reach.
  await createGroup(page, "E2E keyboard");
  await addMember(page, "Aung");

  const dialog = await openAddMember(page);
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();

  // Measured in Chromium (probe): Close -> Add member -> <body> (focus in
  // the browser UI) -> Member name -> Close ... Allowed: an element inside
  // the dialog, or <body>. Anything else is a page element behind the Modal.
  const focusState = () =>
    page.evaluate(() => {
      const active = document.activeElement;
      if (active === document.body) return "body";
      if (active && document.querySelector("dialog[open]")?.contains(active)) {
        return "dialog";
      }
      return `outside: ${active?.outerHTML.slice(0, 80) ?? "null"}`;
    });
  // 3 focusables in the dialog + body + 1 = a full cycle and a wrap.
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press(key);
      expect(await focusState(), `${key} #${i + 1}`).toMatch(/^(dialog|body)$/);
    }
  }

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await openAddMember(page);
  await dialog.getByLabel("Member name").fill("Bo Bo");
  await dialog.getByLabel("Member name").press("Enter");
  await expect(dialog).toBeHidden();
  await expect(members(page).getByText("Bo Bo", { exact: true })).toBeVisible();
});

test("a double-click on a submit button sends one action", async ({ page }) => {
  const actions = countServerActions(page);
  /** Runs `step`, then expects exactly one more Server Action than before. */
  const once = async (step: () => Promise<void>) => {
    const before = actions.count;
    await step();
    // A second request (queued or not) is sent before the first one's result
    // shows, so it would already be counted here.
    expect(actions.count).toBe(before + 1);
  };

  // Create group: waits for hydration, because a click before it is a native
  // form POST (parked gap). Note: the probe showed this step also sends one
  // action without disabled={pending}, so it is a regression check only.
  await page.goto("/groups/new");
  const create = page.getByRole("button", { name: "Create group" });
  await waitForHydration(create);
  await page.getByLabel("Group name").fill("E2E double click");
  await page.getByRole("radio", { name: "USD" }).check();
  await once(async () => {
    await create.dblclick();
    await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "E2E double click" }),
    ).toBeVisible();
  });

  // Add member: a second add would come back as CONFLICT and reopen the
  // dialog with an alert, so the request count is the precise check.
  for (const name of ["Aung", "Bo Bo"]) {
    const dialog = await openAddMember(page);
    await dialog.getByLabel("Member name").fill(name);
    await once(async () => {
      await dialog.getByRole("button", { name: "Add member" }).dblclick();
      await expect(dialog).toBeHidden();
      await expect(
        members(page).getByText(name, { exact: true }),
      ).toBeVisible();
    });
  }

  // Add expense: USD 10.00 paid by Aung, shared by both (the default).
  const expenseDialog = await openAddExpense(page);
  await expenseDialog.getByLabel("Amount (USD)").fill("10");
  await expenseDialog
    .getByRole("radiogroup", { name: "Paid by" })
    .getByRole("radio", { name: "Aung" })
    .check();
  await once(async () => {
    await expenseDialog.getByRole("button", { name: "Add expense" }).dblclick();
    await expect(expenseDialog).toBeHidden();
    await expect(expenses(page).getByText("USD 10.00")).toBeVisible();
  });

  // splitEqually(1000, 2): q = 500, r = 0, so both shares are USD 5.00 in any
  // id order. Nets: Aung +5.00, Bo Bo -5.00 -> one line. A second settlement
  // would flip it to "Aung pays Bo Bo USD 5.00".
  const balance = page.getByRole("region", { name: "Balance" });
  const settleDialog = await openDialog(
    page,
    balance.getByRole("button", {
      name: "Mark as paid: Bo Bo pays Aung USD 5.00",
      exact: true,
    }),
    "Mark as paid?",
  );
  await once(async () => {
    await settleDialog
      .getByRole("button", { name: "Mark as paid", exact: true })
      .dblclick();
    await expect(
      balance.getByText("Everyone is settled up. No payments needed."),
    ).toBeVisible();
  });

  // Read back from the DB: one expense, two members, still settled.
  await page.reload();
  await expect(expenses(page).getByRole("row")).toHaveCount(2); // header + 1
  await expect(members(page).getByRole("listitem")).toHaveCount(2);
  await expect(
    balance.getByText("Everyone is settled up. No payments needed."),
  ).toBeVisible();
  expect(actions.count).toBe(5);
});

test("an expense at the amount cap shows exact amounts and its line can be marked as paid", async ({
  page,
}) => {
  await createGroup(page, "E2E amount cap", "MMK");
  await addMember(page, "Aung");
  await addMember(page, "Bo Bo");

  // Over the cap (AMOUNT_MAX_MINOR_UNITS + 1 = 1,000,000,000,000 minor
  // units): server error, the dialog stays open and every value is kept.
  const dialog = await openAddExpense(page);
  const amount = dialog.getByLabel("Amount (MMK)");
  const paidBy = dialog.getByRole("radiogroup", { name: "Paid by" });
  const sharedBy = dialog.getByRole("group", { name: "Shared by" });
  await amount.fill("10,000,000,000");
  await dialog.getByLabel("Description (optional)").fill("Cap");
  await paidBy.getByRole("radio", { name: "Aung" }).check();
  await sharedBy.getByRole("checkbox", { name: "Aung" }).uncheck();
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(amount).toHaveAccessibleDescription(
    /Error: Amount must be at most 9,999,999,999\.99$/,
  );
  await expect(dialog).toBeVisible();
  const expectOverCapValues = async () => {
    await expect(amount).toHaveValue("10,000,000,000");
    await expect(dialog.getByLabel("Description (optional)")).toHaveValue(
      "Cap",
    );
    await expect(paidBy.getByRole("radio", { name: "Aung" })).toBeChecked();
    await expect(
      sharedBy.getByRole("checkbox", { name: "Aung" }),
    ).not.toBeChecked();
    await expect(
      sharedBy.getByRole("checkbox", { name: "Bo Bo" }),
    ).toBeChecked();
  };
  await expectOverCapValues();

  // Close + reopen: the old field error is gone, the values are kept.
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
  await openAddExpense(page);
  await expect(dialog.getByText(/^Error:/)).toHaveCount(0);
  await expect(amount).not.toHaveAccessibleDescription(/Error:/);
  await expectOverCapValues();

  // Exactly the cap: AMOUNT_MAX_MINOR_UNITS = 999_999_999_999n minor units
  // = MMK 9,999,999,999.99, paid by Aung, shared by Bo Bo only.
  await amount.fill("9,999,999,999.99");
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    expenses(page).getByRole("row").filter({ hasText: "Cap" }),
  ).toContainText("MMK 9,999,999,999.99");

  // splitEqually(999_999_999_999n, [Bo Bo]): n = 1, q = 999,999,999,999,
  // r = 0, so Bo Bo's share is the whole amount (no id-order dependence).
  // Nets: Aung +999,999,999,999 (paid, shares nothing), Bo Bo the negative.
  // computeTransfers: one line, Bo Bo -> Aung 999,999,999,999.
  // This line appeared through refresh(), so SettleForm was rendered in the
  // browser from the RSC payload (bigint "$n…"), not hydrated from SSR HTML.
  const balance = page.getByRole("region", { name: "Balance" });
  const lines = balance.getByRole("list", { name: "Who pays whom" });
  const perMember = balance.getByRole("list", { name: "Per member" });
  const memberRow = (name: string) =>
    perMember
      .getByRole("listitem")
      .filter({ has: page.getByText(name, { exact: true }) });
  await expect(lines.getByRole("listitem")).toHaveCount(1);
  await expect(
    lines.getByText("Bo Bo pays Aung MMK 9,999,999,999.99", { exact: true }),
  ).toBeVisible();
  await expect(memberRow("Aung")).toContainText(
    "is owed +MMK 9,999,999,999.99",
  );
  await expect(memberRow("Bo Bo")).toContainText(
    `owes ${MINUS}MMK 9,999,999,999.99`,
  );

  // Mark as paid: the hidden amount must parse back to exactly the cap
  // (the settle schema allows <= AMOUNT_MAX_MINOR_UNITS).
  const settleDialog = await openDialog(
    page,
    lines.getByRole("button", {
      name: "Mark as paid: Bo Bo pays Aung MMK 9,999,999,999.99",
      exact: true,
    }),
    "Mark as paid?",
  );
  await settleDialog
    .getByRole("button", { name: "Mark as paid", exact: true })
    .click();
  await expect(page.getByRole("dialog", { name: "Mark as paid?" })).toHaveCount(
    0,
  );
  const settled = async () => {
    await expect(
      balance.getByText("Everyone is settled up. No payments needed."),
    ).toBeVisible();
    await expect(memberRow("Aung")).toContainText("settled up MMK 0.00");
    await expect(memberRow("Bo Bo")).toContainText("settled up MMK 0.00");
    await expect(
      expenses(page).getByRole("row").filter({ hasText: "Cap" }),
    ).toContainText("MMK 9,999,999,999.99");
  };
  await settled();

  // Server-rendered from the DB (the SSR path).
  await page.reload();
  await settled();
});

test("Mark as paid closes its dialog when the recomputed balance has the same line again", async ({
  page,
}) => {
  await createGroup(page, "E2E same line");
  const names = ["Aung", "Bo Bo", "Chit", "Daw Mya", "Ei Ei"];
  for (const name of names) await addMember(page, name);

  // Each expense is shared by one member, so splitEqually gives that member
  // the whole amount (n = 1, r = 0): no remainder, no id-order dependence.
  const addExpense = async (amount: string, payer: string, sharer: string) => {
    const dialog = await openAddExpense(page);
    await dialog.getByLabel("Amount (USD)").fill(amount);
    await dialog
      .getByRole("radiogroup", { name: "Paid by" })
      .getByRole("radio", { name: payer, exact: true })
      .check();
    const sharedBy = dialog.getByRole("group", { name: "Shared by" });
    for (const name of names) {
      await sharedBy
        .getByRole("checkbox", { name, exact: true })
        .setChecked(name === sharer);
    }
    await dialog.getByRole("button", { name: "Add expense" }).click();
    await expect(dialog).toBeHidden();
  };
  await addExpense("8", "Ei Ei", "Aung");
  await addExpense("2", "Chit", "Aung");
  await addExpense("6", "Daw Mya", "Bo Bo");
  await addExpense("3", "Chit", "Bo Bo");

  const balance = page.getByRole("region", { name: "Balance" });
  const lines = balance.getByRole("list", { name: "Who pays whom" });
  const perMember = balance.getByRole("list", { name: "Per member" });
  const expectLines = async (expected: string[]) => {
    await expect(lines.getByRole("listitem")).toHaveCount(expected.length);
    await expect(lines.getByRole("listitem")).toContainText(expected);
  };
  const expectNets = async (expected: Record<string, string>) => {
    for (const [name, status] of Object.entries(expected)) {
      await expect(
        perMember
          .getByRole("listitem")
          .filter({ has: page.getByText(name, { exact: true }) }),
      ).toContainText(status);
    }
  };

  // Nets: Aung -10, Bo Bo -9, Chit +5, Daw Mya +6, Ei Ei +8. computeTransfers,
  // with a unique largest debtor and creditor at every step (so the result
  // does not depend on the random ids):
  // Aung->Ei Ei 8 (Aung -2), Bo Bo->Daw Mya 6 (Bo Bo -3), Bo Bo->Chit 3
  // (Chit +2), Aung->Chit 2.
  await expectNets({
    Aung: `owes ${MINUS}USD 10.00`,
    "Bo Bo": `owes ${MINUS}USD 9.00`,
    Chit: "is owed +USD 5.00",
    "Daw Mya": "is owed +USD 6.00",
    "Ei Ei": "is owed +USD 8.00",
  });
  await expectLines([
    "Aung pays Ei Ei USD 8.00",
    "Bo Bo pays Daw Mya USD 6.00",
    "Bo Bo pays Chit USD 3.00",
    "Aung pays Chit USD 2.00",
  ]);

  const settleDialog = await openDialog(
    page,
    lines.getByRole("button", {
      name: "Mark as paid: Aung pays Chit USD 2.00",
      exact: true,
    }),
    "Mark as paid?",
  );
  await settleDialog
    .getByRole("button", { name: "Mark as paid", exact: true })
    .click();

  // Settling Aung->Chit 2: Aung -8, Bo Bo -9, Chit +3, Daw Mya +6, Ei Ei +8.
  // Greedy (again no ties): Bo Bo->Ei Ei 8 (Bo Bo -1), Aung->Daw Mya 6
  // (Aung -2), Aung->Chit 2 (Chit +1), Bo Bo->Chit 1. "Aung pays Chit
  // USD 2.00" is back with the same key, so React keeps its SettleForm.
  const after = async () => {
    await expectLines([
      "Bo Bo pays Ei Ei USD 8.00",
      "Aung pays Daw Mya USD 6.00",
      "Aung pays Chit USD 2.00",
      "Bo Bo pays Chit USD 1.00",
    ]);
    // Exactly one settlement: two would give Aung -6.00 and Chit +1.00.
    await expectNets({
      Aung: `owes ${MINUS}USD 8.00`,
      "Bo Bo": `owes ${MINUS}USD 9.00`,
      Chit: "is owed +USD 3.00",
      "Daw Mya": "is owed +USD 6.00",
      "Ei Ei": "is owed +USD 8.00",
    });
  };
  await after();
  // The refresh has arrived (lines above); the dialog must be closed.
  await expect(page.getByRole("dialog", { name: "Mark as paid?" })).toHaveCount(
    0,
  );

  // Server-rendered from the DB (the SSR path).
  await page.reload();
  await after();
});

test("Mark as paid: a rejected settlement keeps the dialog open with the alert", async ({
  page,
}) => {
  await createGroup(page, "E2E settle error");
  await addMember(page, "Aung");
  await addMember(page, "Bo Bo");
  const expenseDialog = await openAddExpense(page);
  await expenseDialog.getByLabel("Amount (USD)").fill("10");
  await expenseDialog
    .getByRole("radiogroup", { name: "Paid by" })
    .getByRole("radio", { name: "Aung" })
    .check();
  await expenseDialog.getByRole("button", { name: "Add expense" }).click();
  await expect(expenseDialog).toBeHidden();

  // splitEqually(1000, 2): q = 500, r = 0, so both shares are USD 5.00 in any
  // id order. Nets: Aung +5.00, Bo Bo -5.00 -> one line.
  const balance = page.getByRole("region", { name: "Balance" });
  const lines = balance.getByRole("list", { name: "Who pays whom" });
  const perMember = balance.getByRole("list", { name: "Per member" });
  const memberRow = (name: string) =>
    perMember
      .getByRole("listitem")
      .filter({ has: page.getByText(name, { exact: true }) });
  const unchanged = async () => {
    await expect(lines.getByRole("listitem")).toHaveCount(1);
    await expect(
      lines.getByText("Bo Bo pays Aung USD 5.00", { exact: true }),
    ).toBeVisible();
    await expect(memberRow("Aung")).toContainText("is owed +USD 5.00");
    await expect(memberRow("Bo Bo")).toContainText(`owes ${MINUS}USD 5.00`);
  };
  await unchanged();

  const dialog = await openDialog(
    page,
    lines.getByRole("button", {
      name: "Mark as paid: Bo Bo pays Aung USD 5.00",
      exact: true,
    }),
    "Mark as paid?",
  );
  // The only settle error user input reaches needs a line above the amount
  // cap (docs/decisions.md, Known limitations (settle)), so force a server
  // rejection instead. A hidden input has no role, label or text, hence the
  // name selector. A probe showed the DOM edit reaches the
  // submitted FormData (the action reads FormData, not the previous state).
  await dialog
    .locator('input[name="amount"]')
    .evaluate((input: HTMLInputElement) => {
      input.value = "0";
    });

  const actions = countServerActions(page);
  await dialog
    .getByRole("button", { name: "Mark as paid", exact: true })
    .click();
  const alert = dialog.getByRole("alert");
  await expect(alert).toHaveText(/^Error:/);
  await expect(alert).toContainText("Amount must be more than 0");
  await expect(dialog).toBeVisible();
  expect(actions.count).toBe(1);
  await unchanged();

  // Close with Esc (the dialog's native close event) + reopen: the old alert
  // is gone.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await openDialog(
    page,
    lines.getByRole("button", {
      name: "Mark as paid: Bo Bo pays Aung USD 5.00",
      exact: true,
    }),
    "Mark as paid?",
  );
  await expect(dialog.getByRole("alert")).toHaveCount(0);

  // Server-rendered from the DB: no settlement was recorded.
  await page.reload();
  await unchanged();
});
