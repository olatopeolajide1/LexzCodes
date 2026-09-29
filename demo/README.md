# 🎬 Demo Video — 1-Minute Script & Link

## 📹 Video link

> **➡️ PASTE THE DEMO VIDEO URL HERE AFTER RECORDING:**
>
> `<!-- e.g. https://www.youtube.com/watch?v=XXXXXXXXXX or Loom/Google Drive link -->`
>
> **Demo video:** _pending recording — paste public URL above and in the root `README.md`_

### After recording (3 steps)

1. Upload the video (YouTube / Loom / Google Drive) and paste the public URL in the block above.
2. In the root `README.md`, **delete the placeholder thumbnail block** and **uncomment the embed block** for your host (YouTube / Loom / Drive) — both are clearly marked in the Demo section, you only replace the `<id>` / `<key>` / `<fileid>`.
3. Until then, the README shows the animated preview [`demo-preview.svg`](demo-preview.svg) — a faithful animated mock of the real dApp flow (connect → prove → verified, same palette and screens) — which links back to this script page. The static fallback is [`demo-thumbnail.svg`](demo-thumbnail.svg).

---

## Shot-by-shot script (60 seconds)

| ⏱ Time | 🎥 Show | 🗣 Say / Caption |
|---|---|---|
| 0:00–0:05 | Repo `README.md` in browser — title + green CI badge visible | "This is zkAge Proof — zero-knowledge age verification on Sepolia." |
| 0:05–0:12 | **Terminal** running `npm test` — the 7 passing test lines scroll by | "Seven Hardhat tests pass — each one generates a real Groth16 proof in-test." |
| 0:12–0:18 | **Terminal** (or CI page) showing the dApp build / GitHub Actions green check | "CI compiles the circuit, runs the setup, tests, and builds the dApp on every push." |
| 0:18–0:30 | **dApp in browser** → click **"Connect Wallet"** → MetaMask popup → approve → address chip appears | "First, connect your wallet to Sepolia." |
| 0:30–0:45 | Type birth date (Day 14, Month 5, Year 1990) → click **"Prove I'm 18+"** → "Generating ZK proof (snarkjs, in your browser)…" → "Submitting proof to AgeVerifier…" | "I type my birth date — it never leaves this browser tab. snarkjs generates the Groth16 proof locally." |
| 0:45–0:55 | Green result card: **"✓ Verified on-chain: this wallet is 18+."** + nullifier snippet → click **"View transaction ↗"** → Etherscan tx page | "The proof is verified on-chain. Only a nullifier is public — the birth date is never revealed." |
| 0:55–1:00 | Back to README, highlight the **Privacy Model** table | "Private by design: on-chain, you're just 18+. Nothing more." |

## Recording checklist

- [ ] Terminal: `npm test` shows **7 passing** (run fresh so timings show)
- [ ] Terminal: `npm run build:dapp` → "✓ Compiled successfully" (or show GitHub Actions green)
- [ ] README visible with **green CI badge**
- [ ] Browser: full dApp flow — connect → prove → result → Etherscan
- [ ] Hide any private keys/addresses you don't want on camera
- [ ] 1920×1080, ~60 seconds, then upload (YouTube/Loom) and paste the link above
