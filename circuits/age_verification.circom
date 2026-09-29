pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/poseidon.circom";

/// ================================================================================
/// Age Verification ("I am 18+") — privacy-preserving
///
/// PRIVATE INPUTS (never leave the prover's device):
///   day, month, year — prover's birth date
///   secret           — prover-held random secret (makes the nullifier unforgeable)
///   bq4, br4, bq100, br100, bq400, br400 — auxiliary witnesses for the leap-year
///       check of the BIRTH date: year = 4*bq4+br4 = 100*bq100+br100 = 400*bq400+br400
///   rq4, rr4, rq100, rr100, rq400, rr400 — same, for the REFERENCE date
///
/// PUBLIC INPUTS:
///   minAgeYears — required minimum age in years (the contract/dApp pins this to 18)
///   refDay, refMonth, refYear — "today" anchor used by the prover (see README
///       Privacy Model: the verifier does not learn which date was used, and the
///       circuit guarantees the prover is 18+ *as of* that date, with the
///       date-checked flag on-chain proving recency to relying parties).
///
/// PUBLIC OUTPUT:
///   nullifier — Poseidon(year, month, day, secret): links verifications of the
///       same birthdate+secret on-chain so a proof cannot be replayed or shared,
///       while revealing nothing about the birthdate itself.
///
/// STATEMENT PROVED:
///   "I know a valid calendar date (day, month, year) and a secret such that
///    (refYear, refMonth, refDay) >= (year + minAgeYears, month, day), i.e. the
///    prover has already had their `minAgeYears`-th birthday as of the reference
///    date — and nullifier = Poseidon(year, month, day, secret)."
/// ================================================================================

/// Constrains `year = n*q + r` with `0 <= r < n` (division identity + range check),
/// so `(q, r)` is necessarily the true quotient/remainder pair.
template ConstantMod(n, bits) {
    signal input in;
    signal input q; // prover-supplied quotient witness
    signal input r; // prover-supplied remainder witness

    in === n * q + r;

    component lt = LessThan(bits); // 0 <= r < n
    lt.in[0] <== r;
    lt.in[1] <== n;
    lt.out === 1;
}

/// Constrains (day, month, year) to be a real calendar date (leap-year aware).
/// q*/r* are the division witnesses for year mod 4 / 100 / 400.
template DateValid() {
    signal input day;
    signal input month;
    signal input year;
    signal input q4;
    signal input r4;
    signal input q100;
    signal input r100;
    signal input q400;
    signal input r400;

    // month in [1, 12]
    component mGe = GreaterEqThan(8); mGe.in[0] <== month; mGe.in[1] <== 1;    mGe.out === 1;
    component mLe = GreaterEqThan(8); mLe.in[0] <== 13;    mLe.in[1] <== month; mLe.out === 1;

    // year in [1900, 9999]
    component yGe = GreaterEqThan(16); yGe.in[0] <== year;  yGe.in[1] <== 1900; yGe.out === 1;
    component yLe = GreaterEqThan(16); yLe.in[0] <== 10000; yLe.in[1] <== year; yLe.out === 1;

    // leap-year divisibility witnesses
    component m4   = ConstantMod(4, 2);   m4.in <== year; m4.q <== q4;   m4.r <== r4;
    component m100 = ConstantMod(100, 7); m100.in <== year; m100.q <== q100; m100.r <== r100;
    component m400 = ConstantMod(400, 9); m400.in <== year; m400.q <== q400; m400.r <== r400;

    component z4   = IsZero(); z4.in <== r4;
    component z100 = IsZero(); z100.in <== r100;
    component z400 = IsZero(); z400.in <== r400;

    // Gregorian: divisible by 400, or (divisible by 4 and not by 100)
    signal leap <== z400.out + z4.out * (1 - z100.out);

    // exactly one month matches; accumulate the days in that month
    component eq1  = IsEqual(); eq1.in[0]  <== month; eq1.in[1]  <== 1;
    component eq2  = IsEqual(); eq2.in[0]  <== month; eq2.in[1]  <== 2;
    component eq3  = IsEqual(); eq3.in[0]  <== month; eq3.in[1]  <== 3;
    component eq4  = IsEqual(); eq4.in[0]  <== month; eq4.in[1]  <== 4;
    component eq5  = IsEqual(); eq5.in[0]  <== month; eq5.in[1]  <== 5;
    component eq6  = IsEqual(); eq6.in[0]  <== month; eq6.in[1]  <== 6;
    component eq7  = IsEqual(); eq7.in[0]  <== month; eq7.in[1]  <== 7;
    component eq8  = IsEqual(); eq8.in[0]  <== month; eq8.in[1]  <== 8;
    component eq9  = IsEqual(); eq9.in[0]  <== month; eq9.in[1]  <== 9;
    component eq10 = IsEqual(); eq10.in[0] <== month; eq10.in[1] <== 10;
    component eq11 = IsEqual(); eq11.in[0] <== month; eq11.in[1] <== 11;
    component eq12 = IsEqual(); eq12.in[0] <== month; eq12.in[1] <== 12;

    signal febDays <== 28 * eq2.out + leap;
    signal dm <== 31 * eq1.out + febDays * eq2.out + 31 * eq3.out + 30 * eq4.out
               + 31 * eq5.out + 30 * eq6.out + 31 * eq7.out + 31 * eq8.out
               + 30 * eq9.out + 31 * eq10.out + 30 * eq11.out + 31 * eq12.out;

    // day in [1, daysInMonth]
    component dGe = GreaterEqThan(8); dGe.in[0] <== day; dGe.in[1] <== 1;  dGe.out === 1;
    component dLe = GreaterEqThan(8); dLe.in[0] <== dm;  dLe.in[1] <== day; dLe.out === 1;
}

template AgeVerification() {
    // ----------------------------------------------------------- private inputs
    signal input day;    // birth day
    signal input month;  // birth month
    signal input year;   // birth year
    signal input secret; // prover secret for the nullifier

    // leap-year division witnesses for the birth date
    signal input bq4;
    signal input br4;
    signal input bq100;
    signal input br100;
    signal input bq400;
    signal input br400;

    // leap-year division witnesses for the reference date
    signal input rq4;
    signal input rr4;
    signal input rq100;
    signal input rr100;
    signal input rq400;
    signal input rr400;

    // ------------------------------------------------------------ public inputs
    signal input minAgeYears; // contract pins this to 18
    signal input refDay;
    signal input refMonth;
    signal input refYear;

    // ------------------------------------------------------------ public output
    signal output nullifier;

    // 1) birth date is a valid calendar date
    component bd = DateValid();
    bd.day <== day;
    bd.month <== month;
    bd.year <== year;
    bd.q4 <== bq4;   bd.r4 <== br4;
    bd.q100 <== bq100; bd.r100 <== br100;
    bd.q400 <== bq400; bd.r400 <== br400;

    // 2) reference date is a valid calendar date
    component rd = DateValid();
    rd.day <== refDay;
    rd.month <== refMonth;
    rd.year <== refYear;
    rd.q4 <== rq4;   rd.r4 <== rr4;
    rd.q100 <== rq100; rd.r100 <== rr100;
    rd.q400 <== rq400; rd.r400 <== rr400;

    // 3) minAgeYears in [1, 150]
    component aGe = GreaterEqThan(8); aGe.in[0] <== minAgeYears; aGe.in[1] <== 1; aGe.out === 1;
    component aLe = GreaterEqThan(8); aLe.in[0] <== 151;         aLe.in[1] <== minAgeYears; aLe.out === 1;

    // 4) reference date >= (year + minAgeYears, month, day)  [lexicographic Y,M,D]
    component cY = GreaterEqThan(16); cY.in[0] <== refYear; cY.in[1] <== year + minAgeYears;
    component eY = IsEqual();         eY.in[0] <== refYear; eY.in[1] <== year + minAgeYears;
    signal gtY <== cY.out * (1 - eY.out);

    component cM = GreaterEqThan(8); cM.in[0] <== refMonth; cM.in[1] <== month;
    component eM = IsEqual();        eM.in[0] <== refMonth; eM.in[1] <== month;
    signal gtM <== cM.out * (1 - eM.out);

    component cD = GreaterEqThan(8); cD.in[0] <== refDay; cD.in[1] <== day;

    signal mdCmp <== gtM + eM.out * cD.out; // quadratic
    signal ageOk <== gtY + eY.out * mdCmp;  // quadratic
    ageOk === 1;

    // 5) nullifier = Poseidon(year, month, day, secret)
    component h = Poseidon(4);
    h.inputs[0] <== year;
    h.inputs[1] <== month;
    h.inputs[2] <== day;
    h.inputs[3] <== secret;
    nullifier <== h.out;
}

component main { public [minAgeYears, refDay, refMonth, refYear] } = AgeVerification();
