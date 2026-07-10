#!/usr/bin/env bash
# Integration smoke-test for the GitHub-push fallback path in post-merge.sh.
#
# Strategy: run the REAL scripts/post-merge.sh with a PATH-shimmed `pnpm` stub
# that makes `pnpm install` and `pnpm --filter db push` succeed, while making
# `pnpm --filter @workspace/scripts run push-github` fail (exit 1), to
# exercise the fallback block. We then assert:
#
#   1. post-merge.sh itself exits 0 (set -e is neutralised by the if/else wrapper)
#   2. The WARNING banner from the real script appears in output
#   3. The retry command from the real script appears in output
#   4. The token hint from the real script appears in output

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POST_MERGE="$SCRIPT_DIR/../post-merge.sh"

if [ ! -f "$POST_MERGE" ]; then
  echo "FATAL: post-merge.sh not found at $POST_MERGE"
  exit 1
fi

PASS=0
FAIL=0

check() {
  local name="$1"
  local result="$2"
  if [ "$result" = "ok" ]; then
    echo "  PASS: $name"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $name — $result"
    FAIL=$((FAIL + 1))
  fi
}

# ---------------------------------------------------------------------------
# Build the pnpm stub in a temp directory.
# The stub honours any invocation that isn't push-github; for push-github it
# exits 1 to simulate a token-missing / push-failed scenario.
# ---------------------------------------------------------------------------
STUB_DIR="$(mktemp -d)"
trap 'rm -rf "$STUB_DIR"' EXIT

cat > "$STUB_DIR/pnpm" <<'STUB'
#!/usr/bin/env bash
# Stub: fail only for push-github, succeed for everything else.
args="$*"
if echo "$args" | grep -q "push-github"; then
  exit 1
fi
exit 0
STUB
chmod +x "$STUB_DIR/pnpm"

# ---------------------------------------------------------------------------
# Run post-merge.sh with the stub injected into PATH.
# We capture both stdout and stderr; the script exits 0 on push failure.
# ---------------------------------------------------------------------------
set +e
output=$(PATH="$STUB_DIR:$PATH" bash "$POST_MERGE" 2>&1)
actual_exit=$?
set -e

# ---------------------------------------------------------------------------
# Assertions
# ---------------------------------------------------------------------------
check "post-merge.sh exits 0 when push fails" \
  "$([ "$actual_exit" -eq 0 ] && echo ok || echo "exit code was $actual_exit")"

check "WARNING banner appears in real script output" \
  "$(echo "$output" | grep -q 'WARNING: GitHub push failed' && echo ok || echo "WARNING line missing from output")"

check "retry command appears in real script output" \
  "$(echo "$output" | grep -q 'push-github' && echo ok || echo "retry command missing from output")"

check "token hint appears in real script output" \
  "$(echo "$output" | grep -qi 'GITHUB_PERSONAL_ACCESS_TOKEN' && echo ok || echo "token hint missing from output")"

check "scope hint appears in real script output" \
  "$(echo "$output" | grep -q "repo" && echo ok || echo "scope hint missing from output")"

# ---------------------------------------------------------------------------
# Run post-merge.sh with push succeeding — should NOT print the WARNING
# ---------------------------------------------------------------------------
cat > "$STUB_DIR/pnpm" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
chmod +x "$STUB_DIR/pnpm"

set +e
success_output=$(PATH="$STUB_DIR:$PATH" bash "$POST_MERGE" 2>&1)
success_exit=$?
set -e

check "post-merge.sh exits 0 when push succeeds" \
  "$([ "$success_exit" -eq 0 ] && echo ok || echo "exit code was $success_exit")"

check "WARNING banner absent when push succeeds" \
  "$(echo "$success_output" | grep -qv 'WARNING: GitHub push failed' && echo ok || echo "WARNING unexpectedly appeared")"

check "success message present when push succeeds" \
  "$(echo "$success_output" | grep -q 'GitHub push succeeded' && echo ok || echo "success message missing")"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
