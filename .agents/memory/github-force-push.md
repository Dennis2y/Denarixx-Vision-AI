---
name: GitHub force-push pattern after task agent merges
description: Why plain git push fails after task agent merges and how to fix it.
---

## Rule
After task agents are merged into main, the GitHub remote often has commits that local HEAD does not (the task agent's own commits go directly to the remote during the merge process). A plain `git push HEAD:refs/heads/main` will fail with "fetch first".

**Fix:** Use `--force` when pushing from the main agent after a task merge:
```
git push "https://${GITHUB_PERSONAL_ACCESS_TOKEN}@github.com/Dennis2y/Denarixx-Vision-AI.git" HEAD:refs/heads/main --force
```

**Why:** Task agents push their work to GitHub as part of the merge. When the main agent then tries to push, the remote is ahead by those commits. Since the main agent's local tree is the canonical source of truth (post-merge), force-push is correct.

**How to apply:** Any time `push-to-github.ts` fails with "fetch first" / "non-fast-forward", switch to the force-push command above. Consider updating `push-to-github.ts` to support a `--force` flag as a follow-up.
