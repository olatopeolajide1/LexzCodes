"use client";

/**
 * Wallet connection + contract I/O via viem (injected wallets: MetaMask etc.).
 */
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { sepolia } from "viem/chains";
import { RPC_URL } from "./config";

export function hasInjectedWallet() {
  return typeof window !== "undefined" && !!window.ethereum;
}

export async function connectWallet() {
  if (!hasInjectedWallet()) {
    throw new Error("No injected wallet found. Install MetaMask and try again.");
  }
  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });
  const address = accounts[0];
  await ensureSepolia();
  return address;
}

export async function ensureSepolia() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }], // 11155111
    });
  } catch (err) {
    if (err && (err.code === 4902 || /Unrecognized chain/i.test(err.message || ""))) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xaa36a7",
            chainName: "Sepolia",
            nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: [RPC_URL],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export function getWalletClient() {
  return createWalletClient({ chain: sepolia, transport: custom(window.ethereum) });
}

export function getPublicClient() {
  return createPublicClient({ chain: sepolia, transport: http(RPC_URL) });
}

/** Send a contract write through the injected wallet and wait for the receipt. */
export async function writeContract({ address, abi, functionName, args, from }) {
  const wallet = getWalletClient();
  const hash = await wallet.writeContract({
    address,
    abi,
    functionName,
    args,
    account: from,
    chain: sepolia,
  });
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  return {
    status: receipt.status === "success" ? "success" : "failed",
    hash,
    blockNumber: Number(receipt.blockNumber),
    gasUsed: receipt.gasUsed.toString(),
  };
}

export function shortAddress(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}
