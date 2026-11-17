Per-feature code lives in `src/features/<name>/`. Copy the pattern in `docs/FEATURE_PATTERN.md`.

Naming: one folder per MVP feature, singular (e.g. `group`, `expense`); its routes are plural (`/groups/...`).

Created when that feature's code lands — not pre-scaffolded.

- `group/` — Create group (the reference example): `schema.ts`, `service.ts`, `formState.ts`, `actions.ts`, `CreateGroupForm.tsx`, with tests next to each.
