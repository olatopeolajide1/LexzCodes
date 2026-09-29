#!/usr/bin/env node
/**
 * Copies generated ZK artifacts into dapp/public/zk so the browser prover
 * can fetch them. Run before `next dev` / `next build` (wired via dapp scripts).
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const build = join(root, "circuits", "build");
const out = join(root, "dapp", "public", "zk");
mkdirSync(out, { recursive: true });

const wasm = join(build, "age_verification_js", "age_verification.wasm");
const zkey = join(build, "age_verification_final.zkey");

for (const f of [wasm, zkey]) {
  if (!existsSync(f)) {
    console.error(`✗ Missing ${f} — run: npm run circom:build && npm run setup:zkey`);
    process.exit(1);
  }
}

copyFileSync(wasm, join(out, "age_verification.wasm"));
copyFileSync(zkey, join(out, "age_verification_final.zkey"));
console.log("✓ ZK assets copied to dapp/public/zk");
