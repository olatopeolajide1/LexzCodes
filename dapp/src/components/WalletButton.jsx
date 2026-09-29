"use client";

import { useEffect, useState } from "react";
import { getPublicClient, connectWallet, hasInjectedWallet, shortAddress } from "../wallet";

export default function WalletButton({ onAddress }) {
  const [address, setAddress] = useState(null);
  const [chainOk, setChainOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refreshChain = async () => {
    if (!hasInjectedWallet()) {
      setChainOk(true);
      return;
    }
    try {
      const hex = await window.ethereum.request({ method: "eth_chainId" });
      setChainOk(parseInt(hex, 16) === 11155111); // Sepolia
    } catch {
      setChainOk(true);
    }
  };

  useEffect(() => {
    if (!hasInjectedWallet()) return;
    window.ethereum.request({ method: "eth_accounts" }).then((accs) => {
      if (accs && accs[0]) {
        setAddress(accs[0]);
        onAddress?.(accs[0]);
      }
      refreshChain();
    });
    const onAccounts = (accs) => {
      setAddress(accs[0] ?? null);
      onAddress?.(accs[0] ?? null);
    };
    const onChain = () => refreshChain();
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      const addr = await connectWallet();
      setAddress(addr);
      onAddress?.(addr);
      await refreshChain();
    } catch (e) {
      setError(e.message || "Failed to connect");
    } finally {
      setBusy(false);
    }
  };

  if (address) {
    return (
      <div className="walletRow">
        <span className={`chip ${chainOk ? "chipOk" : "chipBad"}`}>
          {chainOk ? "Sepolia" : "Wrong network"}
        </span>
        <span className="chip chipOk">{shortAddress(address)}</span>
      </div>
    );
  }

  return (
    <div className="walletRow">
      <button className="btn btnPrimary" onClick={connect} disabled={busy}>
        {busy ? "Connecting…" : "Connect Wallet"}
      </button>
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}
