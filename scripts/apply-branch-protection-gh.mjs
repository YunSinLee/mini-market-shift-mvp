import { spawn } from "node:child_process";

function parseArgs(argv) {
  let repo = null;
  let branch = "main";
  let requiredChecks = ["PR Quality Gate / quality-gate"];
  let approvalCount = 1;
  let requireCodeOwners = true;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--repo" && argv[i + 1]) {
      repo = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--branch" && argv[i + 1]) {
      branch = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--required-checks" && argv[i + 1]) {
      requiredChecks = argv[i + 1]
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      i += 1;
      continue;
    }
    if (arg === "--approvals" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 6) {
        approvalCount = Math.round(parsed);
      }
      i += 1;
      continue;
    }
    if (arg === "--require-codeowners" && argv[i + 1]) {
      requireCodeOwners = argv[i + 1] === "true";
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
  }

  if (!repo) {
    throw new Error("Missing required argument: --repo <owner/name>");
  }

  return {
    repo,
    branch,
    requiredChecks,
    approvalCount,
    requireCodeOwners,
    dryRun
  };
}

function buildPayload({
  requiredChecks,
  approvalCount,
  requireCodeOwners
}) {
  return {
    required_status_checks: {
      strict: true,
      contexts: requiredChecks
    },
    enforce_admins: false,
    required_pull_request_reviews: {
      dismiss_stale_reviews: false,
      require_code_owner_reviews: requireCodeOwners,
      required_approving_review_count: approvalCount,
      require_last_push_approval: false
    },
    restrictions: null,
    required_conversation_resolution: true,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_linear_history: false,
    lock_branch: false,
    allow_fork_syncing: true
  };
}

function runGh(args, stdin = null) {
  return new Promise((resolve, reject) => {
    const child = spawn("gh", args, {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `gh exited with code ${code}`));
      }
    });

    if (stdin != null) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

const options = parseArgs(process.argv.slice(2));
const payload = buildPayload(options);

console.log("Branch protection payload:");
console.log(JSON.stringify(payload, null, 2));

if (options.dryRun) {
  console.log("dry_run=true, no GitHub API call was made.");
  process.exit(0);
}

await runGh(["repo", "view", options.repo, "--json", "nameWithOwner"]);

const endpoint = `/repos/${options.repo}/branches/${options.branch}/protection`;
await runGh(
  [
    "api",
    "--method",
    "PUT",
    "--header",
    "Accept: application/vnd.github+json",
    "--header",
    "X-GitHub-Api-Version: 2022-11-28",
    endpoint,
    "--input",
    "-"
  ],
  `${JSON.stringify(payload)}\n`
);

console.log(
  `Branch protection applied: repo=${options.repo}, branch=${options.branch}, checks=${options.requiredChecks.join("|")}`
);
