# GitHub Sync Guide

How to push the latest Replit code to the GitHub mirror after each sprint.

## Repository

`Dennis2y/Denarixx-Vision-AI` — branch `main`

---

## One-command push

```bash
pnpm --filter @workspace/scripts run push-github
```

This runs `scripts/src/push-to-github.ts`, which calls:

```
git push https://<TOKEN>@github.com/Dennis2y/Denarixx-Vision-AI.git HEAD:refs/heads/main
```

The token is read from the `GITHUB_PERSONAL_ACCESS_TOKEN` Replit secret — never
hard-coded.

---

## First-time setup

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens** (or classic tokens with `repo` scope).
2. Generate a token with at least **Contents: read & write** on the target repo.
3. In Replit, open **Secrets** and add:
   - Key: `GITHUB_PERSONAL_ACCESS_TOKEN`
   - Value: the token you just created

That's it. Run the command above after any sprint to push.

---

## Why this pattern (the Replit workaround)

Replit manages `.git/config` and intercepts the standard `origin` remote. You
cannot reliably add a persistent `github` remote via `git remote add` because
Replit may reset or ignore it.

**The fix:** pass the full HTTPS URL directly to `git push` instead of relying
on a named remote. The token is embedded in the URL at runtime — Replit never
sees it in a config file.

```
git push "https://<TOKEN>@github.com/Dennis2y/Denarixx-Vision-AI.git" HEAD:refs/heads/main
```

This also means:
- No `.git/config` modification required.
- No credential-helper config required.
- Works from both bash and any Node.js script that shells out.

---

## Sprint checklist (post-merge)

After a sprint lands on Replit's internal `main`:

1. Confirm the sprint tests pass locally.
2. Run `pnpm --filter @workspace/scripts run push-github`.
3. Verify the push on GitHub: `https://github.com/Dennis2y/Denarixx-Vision-AI/commits/main`.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `GITHUB_PERSONAL_ACCESS_TOKEN is not set` | Add the secret in Replit Secrets |
| `403 Permission denied` | Regenerate token with `Contents: read & write` scope |
| `Push rejected (non-fast-forward)` | GitHub has commits Replit doesn't. Either `git fetch github && git rebase github/main` (if history matters) or add `--force` to the push command if GitHub is just a mirror |
| `Replit git proxy intercepted` | Retry once — it usually succeeds on the second attempt |

---

## Relevant files

- `scripts/src/push-to-github.ts` — the push script
- `scripts/package.json` — `push-github` npm script
- `.agents/memory/github-push-pattern.md` — agent memory note on this pattern
