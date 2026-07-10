import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "..", "src", "push-to-github.ts");
const TSX = join(__dirname, "..", "node_modules", ".bin", "tsx");

function runScript(env: NodeJS.ProcessEnv) {
  return spawnSync(TSX, [SCRIPT], { env, encoding: "utf8" });
}

function envWithoutToken(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GITHUB_PERSONAL_ACCESS_TOKEN;
  return env;
}

function envWithEmptyToken(): NodeJS.ProcessEnv {
  return { ...process.env, GITHUB_PERSONAL_ACCESS_TOKEN: "" };
}

test("missing token: exits with code 1", () => {
  const result = runScript(envWithoutToken());
  assert.strictEqual(
    result.status,
    1,
    "push script must exit 1 when GITHUB_PERSONAL_ACCESS_TOKEN is absent"
  );
});

test("empty token: exits with code 1", () => {
  const result = runScript(envWithEmptyToken());
  assert.strictEqual(
    result.status,
    1,
    "push script must exit 1 when GITHUB_PERSONAL_ACCESS_TOKEN is an empty string"
  );
});

test("missing token: stderr names the missing variable", () => {
  const result = runScript(envWithoutToken());
  const output = (result.stderr ?? "") + (result.stdout ?? "");
  assert.ok(
    output.includes("GITHUB_PERSONAL_ACCESS_TOKEN"),
    `error output should mention the missing variable, got: ${output}`
  );
});

test("missing token: stderr includes actionable hint", () => {
  const result = runScript(envWithoutToken());
  const output = (result.stderr ?? "") + (result.stdout ?? "");
  assert.ok(
    output.toLowerCase().includes("secret") ||
      output.toLowerCase().includes("set it"),
    `error output should include a hint about how to fix the problem, got: ${output}`
  );
});

test("missing token: does not attempt a git push", () => {
  const result = runScript(envWithoutToken());
  const output = (result.stderr ?? "") + (result.stdout ?? "");
  assert.ok(
    !output.includes("Pushing branch"),
    "push script should short-circuit before attempting git push when token is absent"
  );
});
