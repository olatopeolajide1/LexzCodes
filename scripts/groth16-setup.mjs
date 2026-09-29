#!/usr/bin/env node
/**
 * One-time Groth16 setup (fully self-contained, no external ptau download):
 *   1. generates local powers-of-tau (2^12 = 4096 constraint headroom; circuit uses 584)
 *   2. phase-2 setup → age_verification_final.zkey
 *   3. exports verification key (JSON) + Solidity verifier contract
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const buildDir = join(root, "circuits", "build");
const r1cs = join(buildDir, "age_verification.r1cs");
const pot = join(buildDir, "pot12.ptau");
mkdirSync(buildDir, { recursive: true });

const snarkjsCli = join(root, "node_modules", "snarkjs", "build", "cli.cjs");
const snarkjs = (args) => {
  console.log("› snarkjs", args.join(" "));
  execFileSync(process.execPath, [snarkjsCli, ...args], { stdio: "inherit" });
};

if (!existsSync(r1cs)) {
  console.error("✗ Missing age_verification.r1cs — run `npm run circom:build` first.");
  process.exit(1);
}

// 1) local powers-of-tau ceremony (2^14 = 16384 constraint headroom)
{
  const stale = existsSync(pot) && statSync(pot).size < 1024 * 1024;
  if (stale) {
    console.log("› Removing corrupt/placeholder ptau file ...");
    rmSync(pot);
  }
  if (!existsSync(pot)) {
    const pot0 = join(buildDir, "pot0.ptau");
    const pot1 = join(buildDir, "pot1.ptau");
    console.log("› Generating local powers-of-tau (2^12) ...");
    snarkjs(["powersoftau", "new", "bn128", "12", pot0, "-v"]);
    snarkjs(["powersoftau", "contribute", pot0, pot1, "-n=LocalContribution1", "-v", "-e=entropy" + Date.now()]);
    snarkjs(["powersoftau", "contribute", pot1, pot0, "-n=LocalContribution2", "-v", "-e=entropy" + Math.random()]);
    snarkjs(["powersoftau", "prepare", "phase2", pot0, pot, "-v"]);
    rmSync(pot1, { force: true });
  }
}

// 2) phase 2 (circuit-specific setup)
const zkey0 = join(buildDir, "age_verification_0000.zkey");
const zkey1 = join(buildDir, "age_verification_0001.zkey");
const zkeyF = join(buildDir, "age_verification_final.zkey");
console.log("› Groth16 phase-2 setup ...");
snarkjs(["groth16", "setup", r1cs, pot, zkey0]);
snarkjs(["zkey", "contribute", zkey0, zkey1, "-n=1stContributor", "-v", "-e=entropy" + Date.now()]);
snarkjs(["zkey", "beacon", zkey1, zkeyF, "0102030405060708090a0b0c0d0e0f10", "10", "-n=FinalBeacon"]);

// 3) exports
snarkjs(["zkey", "export", "verificationkey", zkeyF, join(buildDir, "age_verification_vkey.json")]);
snarkjs(["zkey", "export", "solidityverifier", zkeyF, join(root, "contracts", "Groth16Verifier.sol")]);

console.log("✓ zkey + vkey + contracts/Groth16Verifier.sol ready");
