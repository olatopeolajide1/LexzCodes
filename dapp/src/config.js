/**
 * dApp configuration.
 * ─────────────────────────────────────────────────────────────────────────────
 * After running `npm run deploy:sepolia`, paste the printed AgeVerifier
 * address below (it is also linked in the repo README).
 */
export const CHAIN_ID = 11155111; // Sepolia
export const CHAIN_NAME = "Sepolia";

// TODO(dev): replace with the deployed AgeVerifier address.
export const CONTRACT_ADDRESS =
  "0x0000000000000000000000000000000000000000";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";

export const EXPLORER = "https://sepolia.etherscan.io";
export const MIN_AGE_YEARS = 18;
