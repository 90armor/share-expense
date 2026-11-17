# src/lib

Shared, framework-free helpers. Pure TypeScript — no Next.js, React or Prisma imports. Tests live next to each file as `*.test.ts`. Check this index before writing a new helper.

- `currency.ts` — supported currency codes (`MMK`, `USD`, `KHR`), `CurrencyCode` type, exponent per currency, `isCurrencyCode` guard.
- `money.ts` — `Money` (bigint minor units + currency), `parseAmount`, `formatAmount` / `formatMoney` (no Intl), `addMoney`, `subtractMoney`, `sumMoney`, `negate`, `isZero`, `assertSameCurrency` (throws on mixed currencies).
- `appError.ts` — `AppError` plain object (`VALIDATION` | `NOT_FOUND` | `CONFLICT` | `UNEXPECTED`, message, optional field map) and `appError()`.
- `result.ts` — `Result<T>` (ok / fail) with `ok()` and `fail()`; server code returns these instead of throwing across boundaries.
- `limits.ts` — input limits (`NAME_MAX_LENGTH`, `DESCRIPTION_MAX_LENGTH`, `AMOUNT_MAX_MINOR_UNITS`, `PARTICIPANTS_MAX`) shared by server validation and client forms (`maxLength`, hints); zod-free so client components can import it.
- `validation.ts` — zod schemas (`nameSchema`, `idSchema` (UUID v4, strict), `currencyCodeSchema`, `moneyAmountSchema(currency)`) and `parseWith(schema, input): Result<T>` with a field → message map.
- `formState.ts` — `FormState<F, V?>` (`{ error, values }`, serializable; `V` only for a multi-value field) and pure form helpers shared by features: `readFormFields(formData, fields)`, `readFormList(formData, field)` (checkboxes sharing a name → `string[]`), `toFormState(error, values)`, `fieldError(state, field)`, `formError(state, visibleFields)`.
- `cx.ts` — `cx(...parts)` joins class names, skipping `false` / `null` / `undefined` / empty strings.
