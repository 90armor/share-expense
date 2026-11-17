# Feature Pattern

Every MVP feature copies `src/features/group/` (Create group). Keep the same files, names and layering.

## Layout and naming

- Feature folder is singular: `src/features/<name>/`. Routes are plural: `src/app/<names>/new`, `src/app/<names>/[id]`.
- `schema.ts` — zod schema built from `src/lib/validation.ts` pieces + inferred types.
- `service.ts` — `fn(db: PrismaClient, input: unknown): Promise<Result<T>>`. The only code that touches Prisma.
- `formState.ts` — pure: FormData → values, AppError → form state, `fieldError` / `formError`.
- `actions.ts` — `"use server"` actions, thin.
- `<Thing>Form.tsx` — `"use client"` form (`useActionState`), PascalCase.
- Tests sit next to each file: `schema.test.ts`, `service.test.ts`, `formState.test.ts`.

## Layers

`page → action → service → db`. Pages only read through services; actions only call services.

- **Validation lives in the service only.** Services take `input: unknown` and always run `parseWith(schema, input)`, for writes and reads (ids too, via `idSchema`). Every caller goes through the service; never skip validation. Validation is always server-side; no HTML `required`/`maxLength`, so users see the server's messages.
- **The service takes the db as a parameter.** App code passes `getDb()`; tests pass `createTestDb().db`.
- **Results, not throws.** Expected failures return `fail(appError(...))`: `VALIDATION` (with a field map), `NOT_FOUND`, `CONFLICT`. DB calls sit in `try/catch`: log the details with `console.error("[<feature>] …", error)` and return `UNEXPECTED` with a generic message. Never send DB errors to the user.
- **Return shaped objects** (e.g. `Group = { id, name, currency }`), never raw rows.
- **The action is thin:** `values = readXForm(formData)` → `result = await service(getDb(), values)` → on failure `return toXFormState(result.error, values)`, on success `redirect(...)`. Call `redirect` outside any `try/catch` (it throws).

## Form state and errors

- State is `{ error: AppError | null; values }`: plain and serializable. `values` are the raw strings the user typed.
- Field errors go to the component's `error` prop (`Input`, `RadioGroup`). Errors not tied to a visible field (`_root`, `UNEXPECTED`, …) show at the top in a `role="alert"` paragraph that starts with "Error:".
- React 19 resets uncontrolled fields after an action, so every field's `defaultValue`/`defaultChecked` comes from `state.values`. Both text and choices are then redisplayed after a failed submit.
- Disable the submit button while `pending` (no double-create).

## Pages that read the DB (Cache Components)

- `params` and DB rows are request data. Do the lookup in an async child component inside `<Suspense fallback={…}>`. Never put `"use cache"` on user data.
- Map `VALIDATION` and `NOT_FOUND` to `notFound()` (a malformed id is never a 500). Throw for `UNEXPECTED`.
- `notFound()` after the shell is sent shows the 404 page with **HTTP status 200** plus a `noindex` tag. This is expected; see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` (Status codes → "When does streaming start?"). Tests and manual checks assert the page body, not the status.
- No `revalidatePath` is needed while nothing is cached.

## What to test

- Schema: valid, blank, whitespace-only, too long, bad enum values, Burmese text.
- formState: FormData mapping (missing / File / extra keys), error → state, `fieldError` / `formError`.
- Service, with `createTestDb()`: write then read back, trimming, invalid input inserts nothing, `NOT_FOUND`, malformed id, Unicode round-trip, a failing fake db → `UNEXPECTED` + logged.
- Actions and pages stay thin enough to need no unit tests; cover them in the PR's manual test table.
- Tests first: show them failing for the right reason, then implement.

## Security

There is no login, so the id in a URL is the only access control. Ids are UUID v4 (`@default(uuid(4))`, `idSchema = z.uuidv4()`). Never use sequential or time-ordered ids (autoincrement, cuid v1, uuid v1/v7) for anything reachable by URL.
