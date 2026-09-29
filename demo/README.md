# 🎬 Demo Video — 1-Minute Script & Link

## 📹 Video link — DONE

**Demo video (60.03s, 1280×720, H.264):**

- ▶ **Watch:** https://github.com/olatopeolajide1/LexzCodes/releases/tag/demo-v1
- ⬇ **Direct download:** https://github.com/olatopeolajide1/LexzCodes/releases/download/demo-v1/demo.mp4
- 📁 In-repo: [`demo/demo.mp4`](demo/demo.mp4) · linked in the root [`README.md`](../README.md)

### How it was generated (fully reproducible)

1. `npm test` — captured the real 7-test output (real Groth16 proofs in-test).
2. `npx hardhat node` + `npx hardhat run scripts/demo-e2e.cjs --network localhost` — real deploy, a real snarkjs Groth16 proof (1.6s), and its on-chain verification (292k gas, `AgeVerified` emitted).
3. `node scripts/render-demo-frames.cjs` — rendered 9 frames from the captured outputs (sharp + SVG), assembled with ffmpeg into `demo/demo.mp4`.

To regenerate after code changes: rerun steps 1–3, then `ffmpeg -f concat -safe 0 -i /tmp/demo-concat.txt -vf fps=30,format=yuv420p -c:v libx264 -crf 21 -movflags +faststart /tmp/demo.mp4` and re-upload to the release.

> The shot-by-shot script below remains the guide for a richer screen-recorded version (browser dApp flow) if you re-record later.

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

## Recording checklist — ✓ COMPLETE

- [x] Terminal: `npm test` shows **7 passing** (captured live)
- [x] Terminal: dApp build "✓ Compiled successfully" (CI green gate shown too)
- [x] README visible with **green CI badge**
- [x] Full flow — deploy → proof (1.6s) → on-chain verify (gas 292k) → `hasVerifiedAdult = true`
- [x] No secrets on camera (nothing private was ever shown — only public signals)
- [x] 1280×720, 60.03 seconds, published as GitHub Release `demo-v1` and linked in the root README
