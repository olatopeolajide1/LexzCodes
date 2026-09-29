import { MIN_AGE_YEARS } from "../src/config";

/**
 * Browser-side ZK prover.
 * Loads the circuit wasm/zkey from /zk/ (see scripts/copy-zk-assets.mjs)
 * and produces a Groth16 proof that the user is 18+ without revealing the
 * birthdate.
 */

const WASM_URL = "/zk/age_verification.wasm";
const ZKEY_URL = "/zk/age_verification_final.zkey";

const isLeap = (y) => y % 400 === 0 || (y % 4 === 0 && y % 100 !== 0);
const daysInMonth = (m, y) =>
  [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

/** Validate the entered birth date and reference date, throwing readable errors. */
export function validateDates({ day, month, year }, ref) {
  if (year < 1900 || year > 9999) throw new Error("Birth year must be between 1900 and 9999");
  if (month < 1 || month > 12) throw new Error("Birth month must be 1-12");
  if (day < 1 || day > daysInMonth(month, year)) {
    throw new Error(`Invalid day for ${month}/${year}`);
  }
  if (ref.refYear < 1900 || ref.refYear > 9999) throw new Error("Invalid reference date");
  if (ref.refMonth < 1 || ref.refMonth > 12) throw new Error("Invalid reference date");
  if (ref.refDay < 1 || ref.refDay > daysInMonth(ref.refMonth, ref.refYear)) {
    throw new Error("Invalid reference date");
  }
}

/** Integer quotient/remainder witnesses for the circuit's division checks. */
function qr(value, n) {
  return { q: Math.floor(value / n), r: value % n };
}

/** Build the exact witness input expected by age_verification.circom. */
export function buildCircuitInput({ day, month, year, secret }, ref) {
  const b = qr(year, 4);
  const b100 = qr(year, 100);
  const b400 = qr(year, 400);
  const r = qr(ref.refYear, 4);
  const r100 = qr(ref.refYear, 100);
  const r400 = qr(ref.refYear, 400);
  return {
    day, month, year, secret,
    minAgeYears: MIN_AGE_YEARS,
    refDay: ref.refDay, refMonth: ref.refMonth, refYear: ref.refYear,
    bq4: b.q, br4: b.r, bq100: b100.q, br100: b100.r, bq400: b400.q, br400: b400.r,
    rq4: r.q, rr4: r.r, rq100: r100.q, rr100: r100.r, rq400: r400.q, rr400: r400.r,
  };
}

/**
 * Generate a Groth16 proof in the browser.
 * @param {{day:number, month:number, year:number, secret:bigint}} birth private birth date + secret
 * @param {{refDay:number, refMonth:number, refYear:number}} ref reference ("today") date
 * @returns contract-ready proof args + public signals
 *          (snarkjs order: [nullifier, minAgeYears, refDay, refMonth, refYear])
 */
export async function generateAgeProof(birth, ref) {
  validateDates(birth, ref);
  const input = buildCircuitInput(birth, ref);

  const snarkjs = (await import("snarkjs")).default ?? (await import("snarkjs"));
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM_URL, ZKEY_URL);
  const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);

  const parts = calldata
    .replace(/["[\]\s]/g, "")
    .split(",")
    .map((x) => BigInt(x).toString());

  return {
    pA: [parts[0], parts[1]],
    pB: [
      [parts[2], parts[3]],
      [parts[4], parts[5]],
    ],
    pC: [parts[6], parts[7]],
    pubSignals: parts.slice(8, 13),
    nullifier: parts[8],
  };
}
