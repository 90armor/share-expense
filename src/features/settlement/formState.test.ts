import { describe, expect, it } from "vitest";
import { appError } from "@/lib/appError";
import { AMOUNT_MAX_MINOR_UNITS } from "@/lib/limits";
import { parseAmount, type Money } from "@/lib/money";
import {
  initialSettleFormState,
  readSettleForm,
  settleFormError,
  toAmountFieldValue,
  toSettleFormState,
} from "./formState";

function formData(entries: Array<[string, string | Blob]>): FormData {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
}

const VALUES = {
  groupId: "g-1",
  fromId: "m-from",
  toId: "m-to",
  amount: "631192.00",
};

describe("settle form state", () => {
  it("starts with no error and the line's values", () => {
    expect(
      initialSettleFormState("g-1", "m-from", "m-to", "631192.00"),
    ).toEqual({ error: null, values: VALUES });
  });

  it("reads the four hidden fields as sent and ignores other keys", () => {
    expect(
      readSettleForm(
        formData([
          ["groupId", "g-1"],
          ["fromId", "m-from"],
          ["toId", "m-to"],
          ["amount", "631192.00"],
          ["createdAt", "2020-01-01"],
        ]),
      ),
    ).toEqual(VALUES);
  });

  it("maps missing fields and file uploads to empty strings", () => {
    expect(
      readSettleForm(
        formData([
          ["groupId", "g-1"],
          ["amount", new Blob(["1"])],
        ]),
      ),
    ).toEqual({ groupId: "g-1", fromId: "", toId: "", amount: "" });
  });

  it("keeps the sent values and the error after a failure", () => {
    const error = appError("VALIDATION", "Invalid input", {
      fromId: "Choose a member of this group",
    });
    expect(toSettleFormState(error, VALUES)).toEqual({
      error,
      values: VALUES,
    });
  });

  it("shows every error at form level (all fields are hidden)", () => {
    const at = (error: Parameters<typeof toSettleFormState>[0]) =>
      settleFormError(toSettleFormState(error, VALUES));

    expect(
      at(
        appError("VALIDATION", "Invalid input", {
          fromId: "Choose a member of this group",
        }),
      ),
    ).toBe("Choose a member of this group");
    expect(
      at(
        appError("VALIDATION", "Invalid input", {
          amount: "Amount must be more than 0",
        }),
      ),
    ).toBe("Amount must be more than 0");
    expect(
      at(appError("VALIDATION", "Invalid input", { _root: "Invalid input" })),
    ).toBe("Invalid input");
    expect(at(appError("NOT_FOUND", "Group not found"))).toBe(
      "Group not found",
    );
    expect(
      at(appError("UNEXPECTED", "Something went wrong. Please try again.")),
    ).toBe("Something went wrong. Please try again.");
  });

  it("shows nothing when there is no error", () => {
    expect(
      settleFormError(initialSettleFormState("g-1", "a", "b", "1.00")),
    ).toBeUndefined();
  });
});

describe("toAmountFieldValue (hidden amount: plain decimal, no separators)", () => {
  it.each<[Money, string]>([
    [{ amount: 3334n, currency: "USD" }, "33.34"],
    [{ amount: 63119200n, currency: "MMK" }, "631192.00"],
    [{ amount: 5n, currency: "KHR" }, "0.05"],
    [{ amount: 100000n, currency: "MMK" }, "1000.00"],
    [{ amount: AMOUNT_MAX_MINOR_UNITS, currency: "USD" }, "9999999999.99"],
  ])("%o -> %j, which parseAmount reads back exactly", (money, expected) => {
    const value = toAmountFieldValue(money);
    expect(value).toBe(expected);
    expect(value).not.toContain(",");
    expect(parseAmount(value, money.currency)).toEqual({
      ok: true,
      value: money,
    });
  });
});
