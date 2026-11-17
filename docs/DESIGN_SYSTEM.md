# Design System

Tokens live in `src/app/globals.css` (`@theme`). Components live in `src/components`. Preview everything at `/dev/components` (dev only; 404 in production).

## Rules

- Use token classes (`bg-surface`, `text-ink`, `border-border-strong`, …) and `src/components`. No raw colors, no `bg-[#…]`, no Tailwind default palette — the default palette is reset (`--color-*: initial`) and `src/components/noRawColors.test.ts` fails the build on violations.
- Never use color as the only signal. Pair `owe` / `owed` / `warning` / `danger` with text ("You owe", "Error:") or a sign (`−` / `+`).
- `owe` is for money, `danger` is for destructive actions and errors. Don't swap them.
- `border` is decorative (cards, table rows). Form controls use `border-strong` (≥ 3:1).
- Touch targets are at least 44px (`min-h-11`). Every interactive element shows a focus ring: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`.
- Light mode only for now. Names are semantic so dark mode can redefine the same tokens later.
- Join classes with `cx` from `src/lib/cx.ts`.

## Color tokens

| Token            | Value     | Use                                  |
| ---------------- | --------- | ------------------------------------ |
| `paper`          | `#faf8f4` | Page background                      |
| `surface`        | `#ffffff` | Cards, inputs, modals, tables        |
| `border`         | `#e4ded4` | Decorative dividers and outlines     |
| `border-strong`  | `#8c8479` | Input and control borders            |
| `ink`            | `#23201c` | Main text                            |
| `muted`          | `#6b645b` | Secondary text, hints, table headers |
| `primary`        | `#2f5d62` | Primary actions, links (slate-teal)  |
| `primary-hover`  | `#264a4e` | Hover for primary                    |
| `on-primary`     | `#ffffff` | Text on `primary` and `danger`       |
| `owe`            | `#a44f39` | Money you owe (clay)                 |
| `owe-subtle`     | `#f6e9e4` | Background behind `owe` text         |
| `owed`           | `#487057` | Money owed to you (sage)             |
| `owed-subtle`    | `#e8f0ea` | Background behind `owed` text        |
| `warning`        | `#8a5a00` | Warnings (amber)                     |
| `warning-subtle` | `#fbf0d9` | Background behind `warning` text     |
| `danger`         | `#9b2335` | Destructive actions, errors (wine)   |
| `danger-hover`   | `#7f1c2b` | Hover for danger                     |
| `danger-subtle`  | `#f8e6e8` | Background behind `danger` text      |
| `focus`          | `#2f5d62` | Focus ring                           |

Other tokens: `rounded-sm` / `rounded-md` / `rounded-lg`, `shadow-card`, `shadow-modal`, `font-sans` (Geist), `font-mono` (Geist Mono).
