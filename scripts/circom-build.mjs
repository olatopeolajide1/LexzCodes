#!/usr/bin/env node
/**
 * Compiles the Circom circuit to R1CS/WASM.
 * Auto-installs the circom 2.1.9 binary into .tools/bin on first run.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const bin = join(root, ".tools", "bin", "circom");
const circomUrl = "https://github.com/iden3/circom/releases/download/v2.1.9/circom-linux-amd64";

function ensureCircom() {
  if (existsSync(bin)) return bin;
  for (const candidate of ["/usr/local/bin/circom", "/usr/bin/circom"]) {
    if (existsSync(candidate)) return candidate;
  }
  console.log("› circom not found — downloading v2.1.9 (linux-amd64)...");
  mkdirSync(dirname(bin), { recursive: true });
  execFileSync("curl", ["-sL", "-o", bin, circomUrl], { stdio: "inherit" });
  chmodSync(bin, 0o755);
  console.log("› circom installed:", bin);
  return bin;
}

const circuit = join(root, "circuits", "age_verification.circom");
const outDir = join(root, "circuits", "build");
mkdirSync(outDir, { recursive: true });

const circom = ensureCircom();
console.log("› Compiling age_verification.circom ...");
execFileSync(circom, [
  "age_verification.circom",
  "-l", join(root, "node_modules"), // include base dir for circomlib
  "--r1cs",
  "--wasm",
  "--sym",
  "--output", outDir,
], { cwd: join(root, "circuits"), stdio: "inherit" });

console.log("✓ Circuit compiled → circuits/build/age_verification.r1cs, age_verification_js/age_verification.wasm");
