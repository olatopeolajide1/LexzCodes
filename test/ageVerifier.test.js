const { expect } = require("chai");
const { ethers } = require("hardhat");
const fs = require("node:fs");
const path = require("node:path");
const snarkjs = require("snarkjs");

const BUILD = path.join(__dirname, "..", "circuits", "build");
const WASM = path.join(BUILD, "age_verification_js", "age_verification.wasm");
const ZKEY = path.join(BUILD, "age_verification_final.zkey");

const MIN_AGE = 18;
// Fixed "today" anchor used across tests (UTC calendar date).
const REF = { refDay: 29, refMonth: 9, refYear: 2026 };

const isLeap = (y) => (y % 400 === 0) || (y % 4 === 0 && y % 100 !== 0);
const daysInMonth = (m, y) => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

/** Integer quotient/remainder witnesses for the circuit's division checks. */
function qr(value, n) {
  return { q: Math.floor(value / n), r: value % n };
}

/** Build the full circuit input for a birth date. */
function buildInput(birth, ref) {
  const b = qr(birth.year, 4);
  const b100 = qr(birth.year, 100);
  const b400 = qr(birth.year, 400);
  const r = qr(ref.refYear, 4);
  const r100 = qr(ref.refYear, 100);
  const r400 = qr(ref.refYear, 400);
  return {
    day: birth.day, month: birth.month, year: birth.year,
    secret: birth.secret,
    minAgeYears: ref.minAgeYears ?? MIN_AGE,
    refDay: ref.refDay, refMonth: ref.refMonth, refYear: ref.refYear,
    bq4: b.q, br4: b.r, bq100: b100.q, br100: b100.r, bq400: b400.q, br400: b400.r,
    rq4: r.q, rr4: r.r, rq100: r100.q, rr100: r100.r, rq400: r400.q, rr400: r400.r,
  };
}

/** Generate a Groth16 proof and return contract-ready call args.
 * Public signal order (snarkjs): [nullifier, minAgeYears, refDay, refMonth, refYear].
 * opts.quiet silences the circom runtime log for *expected* witness failures. */
async function prove(input, opts = {}) {
  const origErr = console.error;
  if (opts.quiet) console.error = () => {};
  try {
    return await proveInner(input);
  } finally {
    if (opts.quiet) console.error = origErr;
  }
}

async function proveInner(input) {
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
  const parts = calldata
    .replace(/["[\]\s]/g, "")
    .split(",")
    .map((x) => BigInt(x).toString());
  const a = [parts[0], parts[1]];
  const b = [
    [parts[2], parts[3]],
    [parts[4], parts[5]],
  ];
  const c = [parts[6], parts[7]];
  const signals = parts.slice(8, 13);
  return { a, b, c, signals, publicSignals };
}

describe("AgeVerifier (ZK proofs generated in-test)", function () {
  this.timeout(300_000);

  let verifier, ageVerifier, user;

  before(async function () {
    for (const f of [WASM, ZKEY]) {
      if (!fs.existsSync(f)) throw new Error(`Missing ${f} — run: npm run circom:build && npm run setup:zkey`);
    }
    [, user] = await ethers.getSigners();

    verifier = await ethers.deployContract("Groth16Verifier");
    await verifier.waitForDeployment();
    ageVerifier = await ethers.deployContract("AgeVerifier", [await verifier.getAddress()]);
    await ageVerifier.waitForDeployment();
  });

  it("accepts a valid ZK proof that the user is 18+ (without revealing the birthdate)", async function () {
    const input = buildInput({ day: 14, month: 5, year: 1990, secret: 12345678901234567890n }, REF);
    const { a, b, c, signals, publicSignals } = await prove(input);

    expect(publicSignals.length).to.equal(5);
    // snarkjs order: [nullifier, minAgeYears, refDay, refMonth, refYear]
    expect(signals[1]).to.equal(String(MIN_AGE));
    expect(signals[2]).to.equal(String(REF.refDay));
    expect(signals[3]).to.equal(String(REF.refMonth));
    expect(signals[4]).to.equal(String(REF.refYear));

    const tx = await ageVerifier.connect(user).verifyAgeProof(a, b, c, signals);
    await expect(tx).to.emit(ageVerifier, "AgeVerified");

    expect(await ageVerifier.hasVerifiedAdult(user.address)).to.equal(true);
  });

  it("stores a nullifier that is bound to the birthdate+secret (same person ⇒ same nullifier)", async function () {
    const birth = { day: 2, month: 2, year: 2001, secret: 31337n };
    const p1 = await prove(buildInput(birth, REF));
    const p2 = await prove(buildInput(birth, REF));

    // same birthdate+secret always yields the same public nullifier,
    // even though the Groth16 proofs themselves are randomized
    expect(p1.signals[0]).to.equal(p2.signals[0]);

    const tx = await ageVerifier.connect(user).verifyAgeProof(p1.a, p1.b, p1.c, p1.signals);
    await expect(tx).to.emit(ageVerifier, "AgeVerified");
    expect(await ageVerifier.nullifierUsed(p1.signals[0])).to.equal(true);
  });

  it("cannot witness-generate a proof for an underage user (minors cannot forge the statement)", async function () {
    // born 2010-06-01 → 16 years old at the reference date
    const input = buildInput({ day: 1, month: 6, year: 2010, secret: 9876543210n }, REF);
    await expect(prove(input, { quiet: true })).to.be.rejectedWith(/Assert Failed/);
  });

  it("cannot witness-generate a proof whose 18th birthday falls after the reference date (boundary)", async function () {
    // born 2008-10-15 → turns 18 on 2026-10-15, i.e. AFTER ref 2026-09-29
    const input = buildInput({ day: 15, month: 10, year: 2008, secret: 5555n }, REF);
    await expect(prove(input, { quiet: true })).to.be.rejectedWith(/Assert Failed/);
  });

  it("rejects a tampered proof against the on-chain verifier", async function () {
    const input = buildInput({ day: 3, month: 3, year: 1980, secret: 424242n }, REF);
    const { a, b, c, signals } = await prove(input);

    // corrupt one proof coordinate — must fail on-chain
    const badC = [BigInt(c[0]) ^ 1n, BigInt(c[1])].map((x) => x.toString());

    await expect(
      ageVerifier.connect(user).verifyAgeProof(a, b, badC, signals)
    ).to.be.revertedWith("AgeVerifier: invalid proof");
  });

  it("rejects replaying the same proof (nullifier reuse)", async function () {
    const input = buildInput({ day: 9, month: 9, year: 1975, secret: 8888n }, REF);
    const { a, b, c, signals } = await prove(input);

    await ageVerifier.connect(user).verifyAgeProof(a, b, c, signals); // first use: OK

    await expect(
      ageVerifier.connect(user).verifyAgeProof(a, b, c, signals)
    ).to.be.revertedWith("AgeVerifier: nullifier already used (copied proof)");
  });

  it("rejects proofs generated with a policy other than minAge=18", async function () {
    const input = buildInput(
      { day: 14, month: 5, year: 1990, secret: 777n },
      { ...REF, minAgeYears: 21 } // valid 21+ proof, but contract pins 18-policy mapping
    );
    const { a, b, c, signals } = await prove(input);

    await expect(
      ageVerifier.connect(user).verifyAgeProof(a, b, c, signals)
    ).to.be.revertedWith("AgeVerifier: minAge must be 18");
  });
});
