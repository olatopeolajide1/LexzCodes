/* One-off demo E2E (not part of CI): deploys to the local node, generates a
 * real Groth16 proof, verifies it on-chain, and records the flow as JSON. */
const fs = require("node:fs");
const snarkjs = require("snarkjs");
const { ethers } = require("hardhat");

const REF = { refDay: 29, refMonth: 9, refYear: 2026 };
const isLeap = (y) => (y % 400 === 0) || (y % 4 === 0 && y % 100 !== 0);
const daysInMonth = (m, y) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
const qr = (value, n) => ({ q: Math.floor(value / n), r: value % n });

function buildInput(birth, ref) {
  const b = qr(birth.year, 4), b100 = qr(birth.year, 100), b400 = qr(birth.year, 400);
  const r = qr(ref.refYear, 4), r100 = qr(ref.refYear, 100), r400 = qr(ref.refYear, 400);
  return {
    day: birth.day, month: birth.month, year: birth.year, secret: birth.secret,
    minAgeYears: 18, refDay: ref.refDay, refMonth: ref.refMonth, refYear: ref.refYear,
    bq4: b.q, br4: b.r, bq100: b100.q, br100: b100.r, bq400: b400.q, br400: b400.r,
    rq4: r.q, rr4: r.r, rq100: r100.q, rr100: r100.r, rq400: r400.q, rr400: r400.r,
  };
}

(async () => {
  const t0 = Date.now();
  const [user] = await ethers.getSigners();

  // 1. deploy
  const verifier = await ethers.deployContract("Groth16Verifier");
  await verifier.waitForDeployment();
  const ageVerifier = await ethers.deployContract("AgeVerifier", [await verifier.getAddress()]);
  await ageVerifier.waitForDeployment();
  const tDeploy = ((Date.now() - t0) / 1000).toFixed(1);

  // 2. real in-process Groth16 proof
  const tp = Date.now();
  const birth = { day: 14, month: 5, year: 1990, secret: 12345678901234567890n };
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    buildInput(birth, REF),
    "circuits/build/age_verification_js/age_verification.wasm",
    "circuits/build/age_verification_final.zkey"
  );
  const tProve = ((Date.now() - tp) / 1000).toFixed(1);
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const parts = calldata.replace(/["[\]\s]/g, "").split(",").map((x) => BigInt(x).toString());

  // 3. on-chain verification
  const tx = await ageVerifier.connect(user).verifyAgeProof(
    [parts[0], parts[1]],
    [[parts[2], parts[3]], [parts[4], parts[5]]],
    [parts[6], parts[7]],
    parts.slice(8, 13)
  );
  const rc = await tx.wait();
  const verified = await ageVerifier.hasVerifiedAdult(user.address);
  const tTotal = ((Date.now() - t0) / 1000).toFixed(1);

  const out = {
    deployer: user.address,
    ageVerifier: await ageVerifier.getAddress(),
    txHash: rc.hash,
    block: rc.blockNumber,
    gasUsed: rc.gasUsed.toString(),
    nullifier: parts[8],
    publicSignals: parts.slice(8, 13),
    timings: { deploy: tDeploy, prove: tProve, total: tTotal },
    hasVerifiedAdult: Boolean(verified),
  };
  fs.writeFileSync("/tmp/demo-flow.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
