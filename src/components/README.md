Shared UI components.

Naming: PascalCase per file (e.g. `ExpenseCard.tsx`). Use design tokens only — see `docs/DESIGN_SYSTEM.md`. Preview at `/dev/components`.

- `Button.tsx` — `variant` primary / secondary / ghost / danger, `size` md / lg, native `disabled`; defaults to `type="button"`. `buttonClassName({ variant, size, className })` gives the same classes to a `next/link` (no copied class strings).
- `Input.tsx` — text input with `label`, optional `hint` and `error`, wired with `htmlFor`, `aria-describedby` and `aria-invalid`.
- `RadioGroup.tsx` — `<fieldset role="radiogroup">` with `label` (legend), `name`, `options`, `defaultValue`, optional `hint` and `error`, `disabled`; same error/`aria-describedby` pattern as Input, 44px option targets.
- `Card.tsx` — surface container with border, radius and shadow; passes through `div` props.
- `Modal.tsx` — client component on native `<dialog>`; `open`, `onClose`, `title`, optional `actions` (main action(s) right of Close in one footer row, wraps on narrow screens; a body form's submit button uses `form={id}`); closes on Esc or the Close button; Close gets initial focus.
- `Table.tsx` — data table from `caption`, `columns` (`key`, `header`, `align`) and `rows`; scrolls horizontally on small screens.
