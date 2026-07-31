"use client";

import { ExternalLink, Fuel, LoaderCircle, Plus } from "lucide-react";
import { useState } from "react";
import { useWalletClient } from "wagmi";
import { useMockGang } from "./mock-gang-provider";
import { hoodAtmChain } from "../lib/robinhood-chain";
import { useGangsterPrice } from "./gangster-price-provider";
import { addGangsterTokenToWallet } from "../lib/add-gangster-token";
import {
  GANGSTER_PONS_SWAP_URL,
  GANGSTER_TOKEN_ADDRESS,
} from "../lib/gangster-economy";

export function ChainStatusBar() {
  const { pendingAction, transactionHash, transactionError } = useMockGang();
  const { price, error: priceError } = useGangsterPrice();
  const { data: walletClient } = useWalletClient();
  const [adding, setAdding] = useState(false);
  const explorerUrl = transactionHash
    ? `${hoodAtmChain.blockExplorers.default.url}/tx/${transactionHash}`
    : null;
  const tokenRevealed = process.env.NEXT_PUBLIC_TOKEN_REVEALED !== "false";

  async function handleAddToken() {
    setAdding(true);
    try {
      await addGangsterTokenToWallet(
        walletClient
          ? (args) => walletClient.request(args as Parameters<typeof walletClient.request>[0])
          : undefined,
      );
    } finally {
      setAdding(false);
    }
  }

  if (!tokenRevealed && !pendingAction && !explorerUrl && !transactionError) return null;

  return (
    <div className="border-b border-white/5 bg-black/35">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-2 text-xs lg:px-8">
        {tokenRevealed ? (
          <>
            <span className="font-black text-lime-300">$GANGSTER</span>
            <a href={GANGSTER_PONS_SWAP_URL} target="_blank" rel="noreferrer" className="font-mono text-lime-100/70 transition hover:text-lime-100">
              {GANGSTER_TOKEN_ADDRESS}
            </a>
            <a href={GANGSTER_PONS_SWAP_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-black text-cyan-200 hover:text-cyan-100">
              Trade on pons <ExternalLink className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={() => void handleAddToken()}
              disabled={adding}
              className="inline-flex items-center gap-1 font-black text-amber-200 transition hover:text-amber-100 disabled:opacity-60"
            >
              <Plus className="h-3 w-3" /> {adding ? "Adding…" : "Add token"}
            </button>
            <span className="text-amber-200">
              {price
                ? `Live price $${price.gangsterUsd.toFixed(8)}`
                : priceError ? "Price feed unavailable" : "Loading live price"}
            </span>
          </>
        ) : null}
        {pendingAction && (
          <span className="inline-flex items-center gap-1.5 text-white">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> {pendingAction}: waiting for confirmation
          </span>
        )}
        {explorerUrl && !pendingAction && (
          <a href={explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-cyan-200 hover:text-cyan-100">
            <Fuel className="h-3.5 w-3.5" /> Transaction confirmed <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {transactionError && <span className="text-red-300">{transactionError}</span>}
      </div>
    </div>
  );
}
