Shared UI components.

Naming: PascalCase per file (e.g. `ExpenseCard.tsx`). Use design tokens only — see `docs/DESIGN_SYSTEM.md`. Preview at `/dev/components`.

- `Button.tsx` — `variant` primary / secondary / ghost / danger, `size` md / lg, native `disabled`; defaults to `type="button"`.
- `Input.tsx` — text input with `label`, optional `hint` and `error`, wired with `htmlFor`, `aria-describedby` and `aria-invalid`.
- `Card.tsx` — surface container with border, radius and shadow; passes through `div` props.
- `Modal.tsx` — client component on native `<dialog>`; `open`, `onClose`, `title`; closes on Esc or the Close button.
- `Table.tsx` — data table from `caption`, `columns` (`key`, `header`, `align`) and `rows`; scrolls horizontally on small screens.
