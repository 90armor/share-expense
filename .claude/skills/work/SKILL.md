---
description: Start a feat/fix/chore task — branch, plan, stop; then test-first, checks, review, final report. Never pushes.
argument-hint: "<feat|fix|chore>: <what to build or fix>"
disable-model-invocation: true
---

Task: $ARGUMENTS

This file holds only the order and the stop points. The rules live in CLAUDE.md (already in context), `docs/FEATURE_PATTERN.md`, `.github/pull_request_template.md` and `.claude/agents/code-reviewer.md`. Read the last three now, before step 1 changes the working tree. Where a step names a doc section, follow that section. These steps stay in force for the whole task.

## 1. Branch

- Prefix = the task's `feat:` / `fix:` / `chore:`. None given → ask. Branch = `<prefix>/<short-kebab-slug>`.
- Tree not clean, or the branch already exists → stop and ask.
- `git fetch origin`, then `git switch --no-track -c <branch> origin/main` (CLAUDE.md › Git Workflow).
- Show `git branch --show-current` and `git config branch.<branch>.merge` (must print nothing).

## 2. Plan — STOP

Write the plan per FEATURE_PATTERN › Plan. Change no files. Stop and wait for the user's approval.

## 3. After approval, in this order

1. Failing test first, before any implementation code: run it and keep the assertion failure (FEATURE_PATTERN › What to test; Final report item 2). For a fix, the test reproduces the bug.
2. Implement until it passes.
3. `npm run format:check`, `lint`, `typecheck`, `test`; `test:e2e` when the plan's E2E line says so. Fix root causes (CLAUDE.md › Working Rules).
4. Mutation check for each new rule or safety check (FEATURE_PATTERN › Final report).
5. Commit (CLAUDE.md › Git Workflow).
6. `code-reviewer` per FEATURE_PATTERN › Final report item 6.
7. Final report 1–6 (FEATURE_PATTERN › Final report). STOP.

## Never

Push, open a PR or merge. Pushing and the PR are `/open-pr`, which only the user starts.
