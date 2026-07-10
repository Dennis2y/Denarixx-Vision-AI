import { execSync } from "child_process";

const REPO = "Dennis2y/Denarixx-Vision-AI";
const BRANCH = "main";

function run() {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    console.error(
      "ERROR: GITHUB_PERSONAL_ACCESS_TOKEN is not set.\n" +
        "Set it as a Replit secret, then re-run this script."
    );
    process.exit(1);
  }

  const remoteUrl = `https://${token}@github.com/${REPO}.git`;

  console.log(`Pushing branch '${BRANCH}' to GitHub (${REPO})…`);

  try {
    const result = execSync(
      `git push "${remoteUrl}" HEAD:refs/heads/${BRANCH}`,
      { encoding: "utf8", stdio: ["inherit", "pipe", "pipe"] }
    );
    if (result) console.log(result);
    console.log("✓ Push complete.");
  } catch (err: unknown) {
    const error = err as { stderr?: string; stdout?: string; message?: string };
    const stderr = error.stderr ?? "";
    const stdout = error.stdout ?? "";
    if (stderr) console.error(stderr);
    if (stdout) console.error(stdout);
    console.error(
      "\nPush failed. Common causes:\n" +
        "  • Token expired or missing 'repo' / 'contents' scope\n" +
        "  • Remote has commits not in local HEAD (pull or force-push required)\n" +
        "  • Replit's git proxy intercepted the push (try again; it usually succeeds on retry)"
    );
    process.exit(1);
  }
}

run();
