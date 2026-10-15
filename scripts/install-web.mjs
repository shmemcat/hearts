import { spawnSync } from "node:child_process";

if (!process.env.FONTAWESOME_PACKAGE_TOKEN?.trim()) {
  console.error("Set FONTAWESOME_PACKAGE_TOKEN in the root .env file first.");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [process.env.npm_execpath, "--prefix", "web", "ci"],
  { stdio: "inherit" },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
