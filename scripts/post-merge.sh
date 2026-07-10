#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push

echo ""
echo "==> Pushing to GitHub…"
if pnpm --filter @workspace/scripts run push-github; then
  echo "==> GitHub push succeeded."
else
  echo ""
  echo "=========================================================="
  echo "  WARNING: GitHub push failed — manual retry required."
  echo ""
  echo "  Common causes:"
  echo "    • GITHUB_PERSONAL_ACCESS_TOKEN secret is missing or"
  echo "      expired (needs 'repo'/'contents' scope)"
  echo "    • Remote has commits ahead of local HEAD"
  echo "      (someone pushed directly to GitHub — pull or"
  echo "       force-push needed)"
  echo "    • Transient network error — usually succeeds on retry"
  echo ""
  echo "  To retry manually:"
  echo "    pnpm --filter @workspace/scripts run push-github"
  echo "=========================================================="
  echo ""
fi
