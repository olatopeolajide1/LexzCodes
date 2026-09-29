# PROPOSAL — zkAge Proof: Privacy-Preserving Age Verification

**Author:** Olatope Olajide ([@olatopeolajide1](https://github.com/olatopeolajide1))
**Date:** September 2026
**Track:** Zero-Knowledge dApp / Privacy & Identity
**Repo:** https://github.com/olatopeolajide1/LexzCodes

---

## 1. Executive Summary

`zkAge Proof` is a zero-knowledge dApp that lets any user prove **"I am at least 18 years old"** to a smart contract **without ever revealing their birth date**. The birth date and a personal secret never leave the user's browser: a Groth16 SNARK proof is generated client-side with snarkjs and submitted to an on-chain verifier on Sepolia. The contract stores only a boolean attestation per wallet plus an unlinkable nullifier that makes proof replay and proof-sharing impossible.

Age checks are everywhere — exchanges, gaming, dating, gated content, DeFi KYC gating — yet today's options demand full identity documents or trust in centralized attestation registries. This project demonstrates that a minimal, trustless, reusable alternative is practical today with commodity tooling (Circom + Groth16 + Hardhat + Next.js), at a cost of ~280k gas per verification.

## 2. Problem Statement

Existing age-verification models force an unacceptable trade-off:

- **Document KYC** (uploading an ID to a third party) exposes far more data than the service needs and creates honeypots of PII that eventually get breached.
- **Centralized attestation services** ("issuer X says you're 18") introduce a trusted intermediary, do not interoperate across platforms, and still link your identity to every service you use.
- **On-chain self-attestation** ("I confirm I'm 18") is trivially lieable and enforceable by no one.

The gap: a **self-sovereign, cryptographically enforceable** age gate. The user should hold their own data, reveal the *minimum* necessary fact — 18+ yes/no, not the birthdate, not the exact age, not the document — and produce a proof any contract on any EVM chain can verify without trusting the prover or an oracle.

## 3. Proposed Solution

A Circom circuit compiles the statement:

> *"I know a valid calendar date `(day, month, year)` and a secret such that I have already had my 18th birthday as of the reference date, and `nullifier = Poseidon(year, month, day, secret)`."*

Key design decisions:

- **Client-side proving.** The wasm/zkey artifacts are served statically to the browser and snarkjs generates the proof locally. The birth date is typed into the page and never transmitted — not to a server, not on-chain, not embedded in the proof.
- **Nullifier instead of identity.** `Poseidon(year, month, day, secret)` is deterministic, so the same birthdate+secret always maps to the same public nullifier: contracts can reject copied or replayed proofs while learning nothing about the date. Nothing links the nullifier to an identity or document.
- **On-chain policy pinning.** The contract hard-requires the public `minAgeYears` signal to equal 18, so proofs minted under any other policy are rejected even when cryptographically valid.
- **Self-contained setup.** Powers-of-tau and phase-2 contributions are generated locally by script — no downloaded ceremony files, fully reproducible builds from `npm run circom:build && npm run setup:zkey`.

The dApp flow: connect wallet → enter birth date (in-browser only) → Groth16 proof generated in-browser → proof submitted to `AgeVerifier` on Sepolia → contract emits `AgeVerified` and any third-party contract can gate on `hasVerifiedAdult(address)`.

## 4. Technical Architecture

```
Browser (Next.js dApp)                     Chain (Sepolia)
┌──────────────────────────────┐           ┌───────────────────────────┐
│ birth date + secret (memory) │           │ AgeVerifier               │
│         │                    │  proof +  │  ├─ nullifierUsed[]       │
│         ▼                    │ nullifier │  ├─ isVerifiedAdult[]     │
│ snarkjs.groth16.fullProve    │──────────▶│  └─ verifyProof() ───────▶ Groth16Verifier
│ (wasm + zkey from /zk)       │           │        (snarkjs-exported) (snarkjs-generated)
└──────────────────────────────┘           └───────────────────────────┘
```

| Layer | Technology | Artifact |
|---|---|---|
| Circuit | Circom 2.1.6 (circomlib comparators + Poseidon) | `circuits/age_verification.circom` |
| Proving system | Groth16 via snarkjs (local powers-of-tau, 2^12) | `circuits/build/*.zkey`, `contracts/Groth16Verifier.sol` |
| Contracts | Solidity 0.8.24 / Hardhat | `contracts/AgeVerifier.sol` |
| dApp | Next.js 14 + viem + injected wallets | `dapp/` |
| Tests | Hardhat/Chai — real proofs generated in-test | `test/ageVerifier.test.js` |
| CI | GitHub Actions: circuits → contracts → tests → dApp build | `.github/workflows/ci.yml` |

**Measured circuit characteristics** (from the compiled R1CS, bn-128):

| Metric | Value |
|---|---|
| Constraints | **584** |
| Wires | 575 |
| Private inputs | **16** (day, month, year, secret + 12 division witnesses) |
| Public inputs | 4 (+1 output: the nullifier) |
| Public signals on-chain | 5 (`nullifier, minAgeYears, refDay, refMonth, refYear`) |
| Gas: `verifyAgeProof` | **≈ 280,077 avg** (272k–292k observed) |

The modest constraint count keeps proving time in the low seconds on a laptop browser — acceptable for an interactive gate, with known headroom for mobile optimization (see Roadmap).

## 5. Privacy Model

| Data | Visible on-chain / to the verifier? |
|---|---|
| "This wallet is 18+" attestation | Yes — that is the whole point |
| Nullifier (`Poseidon(year, month, day, secret)`) | Yes — one-way, unlinkable to an identity |
| Birth date (day/month/year) | **Never** — stays in browser memory |
| Secret (random, held by prover) | **Never** |
| Exact age, ID documents, other PII | **Never** |

Trust assumptions, stated honestly:

1. **Reference date is prover-chosen.** The circuit proves 18+ *as of* `(refDay, refMonth, refYear)`, a public signal chosen at proof time. The dApp always uses "today" (UTC), and a relying party can require the anchor to be recent before accepting an attestation. Production hardening: commit to `block.timestamp` in-circuit.
2. **Self-declared birthdate.** The proof binds the wallet to *a* birthdate; a production system should feed it a signed credential from an issuer (ZK-KYC / anonymous credentials) so the date is *certified*, not self-declared. This is the first roadmap item.
3. **Setup ceremony.** The local two-contribution + beacon ceremony is safe for demonstration but a production deployment should use a public multi-party powers-of-tau ceremony.
4. **Poseidon preimage resistance** is what prevents recovering the birthdate from the nullifier; the secret additionally prevents brute-forcing small date spaces (a nullifier over a known birthdate + unknown 96-bit secret is unforgeable).

## 6. Deliverables

**Shipped (verified in CI — badge green on `main`):**

- [x] Circom circuit proving 18+ with full calendar-date validity (leap-year aware, 584 constraints)
- [x] Groth16 setup pipeline: local ptau → zkey → vkey → auto-generated `Groth16Verifier.sol`
- [x] `AgeVerifier.sol` with nullifier replay protection + on-chain 18-policy pin (~280k gas)
- [x] **7 Hardhat tests** generating real Groth16 proofs in-test: acceptance, nullifier determinism, underage rejection, birthday-boundary rejection, tamper rejection, replay rejection, policy-pin rejection
- [x] Next.js 14 dApp: wallet connect → in-browser proving → on-chain result with Etherscan link
- [x] GitHub Actions CI compiling circuits, running the full test suite, and building the dApp on every push (zero errors required)
- [x] README with CI badge, Privacy Model, architecture and file structure; PROPOSAL.md (this file)
- [x] Demo video script ([`demo/README.md`](demo/README.md)) with placeholder embed in README

**Pending (blocked on external inputs):**

- [ ] Funded Sepolia deploy of `AgeVerifier` → address to be recorded in README (`npm run deploy:sepolia`)
- [ ] 1-minute demo video recording → link to be embedded in README

## 7. Roadmap / Future Work

1. **Certified issuance** — replace the self-claimed birthdate with proofs over signed credentials (anonymous credentials / ZK-KYC attestations) so the birthdate is *certified*, not self-declared. This removes trust assumption #2.
2. **Verifiable reference time** — source the reference date from `block.timestamp` committed in-circuit, removing the prover's choice of anchor date and trust assumption #1.
3. **Age brackets & thresholds** — generalize to "21+", "65+", or committed age *ranges* (e.g., "between 18 and 30") without re-proving per threshold.
4. **Mobile UX** — optimize witness generation for mobile browsers; a WASM-SIMD or GPU-assisted prover would cut the few-second proving time substantially.
5. **Multi-chain** — the verifier is plain Solidity, deployable to any EVM network; add a canonical deployment plus cross-chain attestation reads via bridges or Chainlink CCIP.

## 8. Conclusion

`zkAge Proof` covers the full arc of a production-shaped ZK application: a hand-written circuit encoding a real arithmetic statement, a complete reproducible Groth16 setup, a hardened on-chain verifier with replay protection and policy pinning, seven tests that generate actual proofs, and a polished dApp that keeps every byte of private data client-side. It is deployable today, auditable end-to-end from this repository, and structured to extend naturally toward certified-credential age verification.
