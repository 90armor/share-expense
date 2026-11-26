---
description: Push the current task branch with an explicit refspec and open its PR. Never merges.
argument-hint: "[live-check result]"
disable-model-invocation: true
---

Live check: $ARGUMENTS

Rules: FEATURE_PATTERN › Final report (PR body), CLAUDE.md › Git Workflow (push, PR title), `.github/pull_request_template.md`.

1. Check: the branch starts with `feat/`, `fix/` or `chore/`; the tree is clean; it has commits ahead of `origin/main`; this conversation has its final report; if the plan asked for a live check, a result is given above. Any check fails → stop and ask.
2. `git push -u origin <branch>`, in exactly this form.
3. Write the body per FEATURE_PATTERN › Final report (PR body) to a file in the scratchpad, and the title per CLAUDE.md › Git Workflow (PR title). Then `gh pr create --base main --head <branch> --title "<title>" --body-file <file>`.
4. Show the PR URL and stop. Merging is the user's step.
