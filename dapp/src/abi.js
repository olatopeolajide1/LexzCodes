/** Minimal ABI for the AgeVerifier contract. */
export const AGE_VERIFIER_ABI = [
  {
    type: "function",
    name: "verifyAgeProof",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_pA", type: "uint256[2]" },
      { name: "_pB", type: "uint256[2][2]" },
      { name: "_pC", type: "uint256[2]" },
      { name: "_pubSignals", type: "uint256[5]" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "hasVerifiedAdult",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "nullifierUsed",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "event",
    name: "AgeVerified",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "nullifier", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
];
