"use client";

import { useEffect, useState } from "react";
import { CONTRACT_ADDRESS, EXPLORER, MIN_AGE_YEARS } from "../config";
import { AGE_VERIFIER_ABI } from "../abi";
import { generateAgeProof } from "../prover";
import {
  getPublicClient,
  hasInjectedWallet,
  shortAddress,
  writeContract,
} from "../wallet";

/**
 * The core dApp flow in one card:
 *   1. user enters their birth date (kept 100% private, in-memory only)
 *   2. the browser generates a Groth16 proof via snarkjs (wasm/zkey from /zk)
 *   3. the proof is submitted to AgeVerifier on Sepolia
 *   4. the on-chain result (verified / rejected) is displayed
 */
export default function VerifyCard({ address }) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [secret] = useState(() => BigInt(Math.floor(Math.random() * 1e9)).toString());

  const [stage, setStage] = useState("idle"); // idle|proving|sending|done|error
  const [statusMsg, setStatusMsg] = useState("");
  const [result, setResult] = useState(null); // {verified, txHash, nullifier}
  const [error, setError] = useState("");
  const [alreadyVerified, setAlreadyVerified] = useState(false);

  const configured = !CONTRACT_ADDRESS.startsWith("0x0");

  // If the wallet is already verified on-chain, show that up-front.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!address || !configured) return;
      try {
        const verified = await getPublicClient().readContract({
          address: CONTRACT_ADDRESS,
          abi: AGE_VERIFIER_ABI,
          functionName: "hasVerifiedAdult",
          args: [address],
        });
        if (!cancelled) setAlreadyVerified(Boolean(verified));
      } catch {
        /* ignore read errors (e.g. contract not on this chain yet) */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, result, configured]);

  const proveAndVerify = async () => {
    setError("");
    setResult(null);
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);

    try {
      // ── 1. generate the ZK proof entirely in the browser ──────────────────
      setStage("proving");
      setStatusMsg("Generating ZK proof (snarkjs, in your browser)…");
      const now = new Date();
      const ref = {
        refDay: now.getUTCDate(),
        refMonth: now.getUTCMonth() + 1,
        refYear: now.getUTCFullYear(),
      };
      const proof = await generateAgeProof(
        { day: d, month: m, year: y, secret: BigInt(secret) },
        ref
      );

      // ── 2. submit it to AgeVerifier on Sepolia ────────────────────────────
      setStage("sending");
      setStatusMsg("Submitting proof to AgeVerifier on Sepolia…");
      const receipt = await writeContract({
        address: CONTRACT_ADDRESS,
        abi: AGE_VERIFIER_ABI,
        functionName: "verifyAgeProof",
        args: [proof.pA, proof.pB, proof.pC, proof.pubSignals],
        from: address,
      });

      if (receipt.status !== "success") {
        throw new Error("Transaction reverted on-chain");
      }

      // ── 3. show the on-chain result ───────────────────────────────────────
      setStage("done");
      setResult({
        verified: true,
        txHash: receipt.hash,
        nullifier: proof.nullifier,
      });
    } catch (e) {
      setStage("error");
      setError(humanizeError(e));
    } finally {
      setStatusMsg("");
    }
  };

  const ready = day && month && year && address && configured && !alreadyVerified;

  return (
    <div className="card">
      <h2>Prove you are {MIN_AGE_YEARS}+ — without revealing when you were born</h2>

      {!configured ? (
        <p className="warn">
          Contract address not configured yet — deploy with{" "}
          <code>npm run deploy:sepolia</code> and paste it into{" "}
          <code>dapp/src/config.js</code>.
        </p>
      ) : null}

      {alreadyVerified ? (
        <p className="ok">✓ This wallet is already verified as 18+ on-chain.</p>
      ) : (
        <>
          <p className="muted">
            Your birth date never leaves this browser tab. Only a Groth16 proof and
            an unlinkable nullifier go on-chain.
          </p>

          <div className="row">
            <label>
              Day
              <input
                inputMode="numeric"
                placeholder="14"
                value={day}
                onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
              />
            </label>
            <label>
              Month
              <input
                inputMode="numeric"
                placeholder="5"
                value={month}
                onChange={(e) => setMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
              />
            </label>
            <label>
              Year
              <input
                inputMode="numeric"
                placeholder="1990"
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </label>
          </div>

          <button className="btn btnPrimary" onClick={proveAndVerify} disabled={!ready}>
            {stage === "proving" ? "Proving…" : stage === "sending" ? "Sending…" : "Prove I'm 18+"}
          </button>

          {statusMsg ? <p className="muted">{statusMsg}</p> : null}
        </>
      )}

      {result?.verified ? (
        <div className="result ok">
          <p>✓ Verified on-chain: this wallet is 18+.</p>
          <p className="mono">nullifier: {result.nullifier.slice(0, 20)}…</p>
          <a href={`${EXPLORER}/tx/${result.txHash}`} target="_blank" rel="noreferrer">
            View transaction ↗
          </a>
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}

function humanizeError(e) {
  const msg = e?.message || String(e);
  if (/nullifier already used/i.test(msg)) {
    return "This exact proof was already used on-chain (nullifier replay blocked).";
  }
  if (/invalid proof/i.test(msg)) {
    return "The on-chain verifier rejected the proof.";
  }
  if (/User rejected|user rejected/i.test(msg)) {
    return "Transaction request was rejected in the wallet.";
  }
  if (/Assert Failed/i.test(msg)) {
    return "Witness generation failed — the entered details cannot satisfy the 18+ statement.";
  }
  return msg;
}

export { shortAddress };
