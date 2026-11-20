# Feature Pattern

Every MVP feature copies `src/features/group/` (Create group). Keep the same files, names and layering.

## Layout and naming

- Feature folder is singular: `src/features/<name>/`. Routes are plural: `src/app/<names>/new`, `src/app/<names>/[id]`.
- `schema.ts` — zod schema built from `src/lib/validation.ts` pieces + inferred types.
- `service.ts` — `fn(db: PrismaClient, input: unknown): Promise<Result<T>>`. The only code that touches Prisma.
- `formState.ts` — pure, built on `src/lib/formState.ts` (`readFormFields`, `toFormState`, `fieldError`, `formError`): the feature's field list, initial state, `readXForm`, `toXFormState`, and a form-level error function bound to its visible fields. It may export only those; the form then imports `fieldError` from `src/lib/formState` directly (member does this; group keeps thin wrappers for its existing exports).
- `actions.ts` — `"use server"` actions, thin. A feature may have several actions and forms (member: add + remove).
- `<Thing>Form.tsx` — `"use client"` form (`useActionState`), PascalCase.
- Tests sit next to each file: `schema.test.ts`, `service.test.ts`, `formState.test.ts`.

## Layers

`page → action → service → db`. Pages only read through services; actions only call services.

- **Validation lives in the service only.** Services take `input: unknown` and always run `parseWith(schema, input)`, for writes and reads (ids too, via `idSchema`). Every caller goes through the service; never skip validation. Validation is always server-side. No HTML `required` (users see the server's messages); `maxLength` is fine as a UX aid when it uses the same constant from `src/lib/limits.ts`.
- **The service takes the db as a parameter.** App code passes `getDb()`; tests pass `createTestDb().db`.
- **Results, not throws.** Expected failures return `fail(appError(...))`: `VALIDATION` (with a field map), `NOT_FOUND`, `CONFLICT`. DB calls sit in `try/catch`: log the details with `console.error("[<feature>] …", error)` and return `UNEXPECTED` with a generic message. Never send DB errors to the user.
- **Return shaped objects** (e.g. `Group = { id, name, currency }`), never raw rows.
- **The action is thin:** `values = readXForm(formData)` → `result = await service(getDb(), values)` → on failure `return toXFormState(result.error, values)`. On success: `redirect(...)` when the user goes to another page (create group); `refresh()` from `next/cache` and return the cleared state when the change stays on the current page (add/remove member). Call `redirect` outside any `try/catch` (it throws); `refresh()` does not throw, and only works inside a Server Action.

## Form state and errors

- State is `{ error: AppError | null; values }`: plain and serializable. `values` are the raw strings the user typed.
- Field errors go to the component's `error` prop (`Input`, `RadioGroup`). Errors not tied to a visible field (`_root`, `UNEXPECTED`, …) show at the top in a `role="alert"` paragraph that starts with "Error:".
- React 19 resets uncontrolled fields after an action, so every field's `defaultValue`/`defaultChecked` comes from `state.values`. Both text and choices are then redisplayed after a failed submit.
- Disable the submit button while `pending` (no double-create).

## Pages that read the DB (Cache Components)

- `params` and DB rows are request data. Do the lookup in an async child component inside `<Suspense fallback={…}>`. Never put `"use cache"` on user data.
- Map `VALIDATION` and `NOT_FOUND` to `notFound()` (a malformed id is never a 500). Throw for `UNEXPECTED`.
- `notFound()` after the shell is sent shows the 404 page with **HTTP status 200** plus a `noindex` tag. This is expected; see `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` (Status codes → "When does streaming start?"). Tests and manual checks assert the page body, not the status.
- No `revalidatePath` is needed while nothing is cached. For a mutation that stays on the page, the action calls `refresh()` (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/refresh.md`): it re-renders the current route in the same response.

## What to test

- Schema: valid, blank, whitespace-only, too long, bad enum values, Burmese text.
- formState: FormData mapping (missing / File / extra keys), error → state, `fieldError` / `formError`.
- Service, with `createTestDb()`: write then read back, trimming, invalid input inserts nothing, `NOT_FOUND`, malformed id, Unicode round-trip, a failing fake db → `UNEXPECTED` + logged. Uniqueness → `CONFLICT` (including a `Promise.all` race). Child rows: an id from another parent (another group) → `NOT_FOUND`, and the row is untouched.
- Actions and pages stay thin enough to need no unit tests; cover them in the PR's manual test table.
- Tests first: show them failing for the right reason, then implement.

## E2E

- Unit tests (Vitest) are the default: schemas, formState, services, `src/lib` logic, section rendering and every edge case.
- Add or extend an E2E test (Playwright, `e2e/*.spec.ts`) only for a user flow that crosses pages, Server Actions and browser-only behaviour (Modals, hydration, `refresh()`). One happy path per flow; edge cases stay in unit tests.
- Exception to the line above: every Modal form gets E2E checks for both transitions after a submit, close on success and stay open on error. Node unit tests (`environment: "node"`) cannot see them. If no user input reaches an error, force a server rejection in the test (e.g. set a hidden field to an invalid value before submit).
- Selectors are what a user sees: role, label, text. Add a test id only when no accessible selector exists, and say why.
- No fixed sleeps (`waitForTimeout`): use auto-waiting actions and web-first `expect`.
- Each test creates its own group, so tests never depend on each other or on old rows.
- Expected amounts are derived from the lib rules (`splitEqually`, `computeTransfers`), written next to the assertion.
- The E2E server uses its own port (3100) and `./data/e2e.db`; never dev.db or docker.db.

## Security

There is no login, so the id in a URL is the only access control. Ids are UUID v4 (`@default(uuid(4))`, `idSchema = z.uuidv4()`). Never use sequential or time-ordered ids (autoincrement, cuid v1, uuid v1/v7) for anything reachable by URL.

## Final report

The reviewer sees only the final message you paste. Put everything the prompt or plan asked them to see in that FINAL message, not only in mid-work updates.

The final report must contain:

1. A checklist of every requested item and where it lives (file or location).
2. The first failing test output from the stubs: assertion failures, not "cannot find module".
3. The full code of new pure logic (services, `src/lib` functions), plus short snippets for anything the plan flagged.
4. Side effects outside the repo: pushes, PRs, Docker containers, images, volumes, databases or ports you touched, including the user's own dev environment.
5. What you could NOT verify.
6. `code-reviewer` findings. After committing, run `git fetch origin`, write `git diff --stat origin/main...HEAD` and `git diff origin/main...HEAD` to a file outside the repo (your scratchpad), and run the `code-reviewer` subagent with that path. Paste its findings verbatim (do not summarise or re-rank them), then, separately, what you did with each: fixed, or not fixed and why.

For a new rule or safety check, show it can fail (mutation check): break the code on purpose, show the tests fail, undo it with an Edit, then show `git diff` is empty. Never undo with `git checkout` or `git restore`.

Before you start a dev server or container, check what already runs on the port and which database it uses. Never write test data into the user's dev database.
