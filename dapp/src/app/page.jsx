"use client";

import { useState } from "react";
import WalletButton from "../components/WalletButton";
import VerifyCard from "../components/VerifyCard";
import { CONTRACT_ADDRESS, EXPLORER } from "../config";

export default function Home() {
  const [address, setAddress] = useState(null);

  return (
    <main className="main">
      <header className="header">
        <div>
          <h1>ZK Age Verifier</h1>
          <p className="muted">
            Circom · Groth16 · Sepolia — your birth date never leaves the browser.
          </p>
        </div>
        <WalletButton onAddress={setAddress} />
      </header>

      <VerifyCard address={address} />

      <footer className="footer muted">
        {CONTRACT_ADDRESS.startsWith("0x0") ? (
          <span>AgeVerifier: deploy to get address</span>
        ) : (
          <a href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">
            AgeVerifier on Sepolia ↗
          </a>
        )}
        <span> · </span>
        <a href="https://docs.circom.io" target="_blank" rel="noreferrer">
          circom docs ↗
        </a>
      </footer>
    </main>
  );
}
