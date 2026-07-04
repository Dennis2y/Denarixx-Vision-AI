---
name: GitHub push pattern
description: How to push code to GitHub from Replit — the working approach vs the broken one.
---

## Rule

Use `node -e "..."` in a **bash** tool call with `https.request`. Never push via the `code_execution` sandbox.

**Why:** `process.env` is `undefined` inside the code_execution notebook environment, so `GITHUB_PERSONAL_ACCESS_TOKEN` can't be read there. The bash tool has full access to `process.env`.

## How to apply

Steps:
1. GET `/repos/{owner}/{repo}/git/ref/heads/{branch}` → headSha
2. GET `/repos/{owner}/{repo}/git/commits/{headSha}` → treeSha
3. POST `/repos/{owner}/{repo}/git/blobs` for each file → blob sha
4. POST `/repos/{owner}/{repo}/git/trees` with `base_tree` + new blobs → newTreeSha
5. POST `/repos/{owner}/{repo}/git/commits` with message, parents, tree → newCommitSha
6. PATCH `/repos/{owner}/{repo}/git/refs/heads/{branch}` with newCommitSha

Repo: `Dennis2y/Denarixx-Vision-AI`, branch: `main`, token env var: `GITHUB_PERSONAL_ACCESS_TOKEN`.
