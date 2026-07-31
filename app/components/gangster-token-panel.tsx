"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Plus, RefreshCw } from "lucide-react";
import { useAccount, useWalletClient } from "wagmi";
import {
  GANGSTER_PONS_SWAP_URL,
  GANGSTER_TOKEN_ADDRESS,
  GANGSTER_TOKEN_SYMBOL,
} from "../lib/gangster-economy";
import { addGangsterTokenToWallet } from "../lib/add-gangster-token";
import { hoodAtmChain } from "../lib/robinhood-chain";

const AUTO_ADD_KEY = "hoodatm:gangster-token-auto-add";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function GangsterTokenPanel({ gameAddress }: { gameAddress?: string }) {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [copied, setCopied] = useState<"token" | "game" | null>(null);
  const [addStatus, setAddStatus] = useState<"idle" | "pending" | "added" | "error">("idle");
  const [addError, setAddError] = useState<string | null>(null);

  const copyAddress = useCallback(async (value: string, kind: "token" | "game") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  }, []);

  const addToken = useCallback(async () => {
    setAddStatus("pending");
    setAddError(null);
    const result = await addGangsterTokenToWallet(
      walletClient
        ? (args) => walletClient.request(args as Parameters<typeof walletClient.request>[0])
        : undefined,
    );
    if (result.ok) {
      setAddStatus("added");
      if (address) {
        try {
          localStorage.setItem(`${AUTO_ADD_KEY}:${address.toLowerCase()}`, "1");
        } catch {
          // ignore storage failures
        }
      }
      return;
    }
    setAddStatus("error");
    setAddError(result.error);
  }, [address, walletClient]);

  useEffect(() => {
    if (!isConnected || !address || !walletClient) return;
    let cancelled = false;
    try {
      if (localStorage.getItem(`${AUTO_ADD_KEY}:${address.toLowerCase()}`)) return;
    } catch {
      return;
    }

    void (async () => {
      const result = await addGangsterTokenToWallet((args) =>
        walletClient.request(args as Parameters<typeof walletClient.request>[0]),
      );
      if (cancelled) return;
      if (result.ok) {
        try {
          localStorage.setItem(`${AUTO_ADD_KEY}:${address.toLowerCase()}`, "1");
        } catch {
          // ignore
        }
        setAddStatus("added");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address, isConnected, walletClient]);

  const explorerTokenUrl = `${hoodAtmChain.blockExplorers.default.url}/token/${GANGSTER_TOKEN_ADDRESS}`;
  const explorerGameUrl = gameAddress
    ? `${hoodAtmChain.blockExplorers.default.url}/address/${gameAddress}`
    : null;

  return (
    <section className="rounded-[2rem] border border-lime-300/25 bg-[linear-gradient(135deg,rgba(163,230,53,0.08),rgba(9,11,9,0.92)_45%,rgba(251,191,36,0.08))] p-6 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.24em] text-lime-200">$GANGSTER live</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Contract + swap</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Verify the token address, buy on pons.family, and add ${GANGSTER_TOKEN_SYMBOL} to MetaMask or your
            connected wallet.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={GANGSTER_PONS_SWAP_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 via-lime-300 to-amber-300 px-5 py-3 font-bold text-[#10130c] transition hover:brightness-110"
          >
            Swap on pons <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={() => void addToken()}
            disabled={addStatus === "pending"}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-5 py-3 font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            {addStatus === "pending" ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : addStatus === "added" ? (
              <Check className="h-4 w-4 text-lime-300" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {addStatus === "added" ? "Added to wallet" : "Add to wallet"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Token contract</p>
          <p className="mt-2 break-all font-mono text-sm text-lime-100">{GANGSTER_TOKEN_ADDRESS}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyAddress(GANGSTER_TOKEN_ADDRESS, "token")}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-200 transition hover:border-lime-300/40 hover:text-white"
            >
              {copied === "token" ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "token" ? "Copied" : "Copy"}
            </button>
            <a
              href={explorerTokenUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-cyan-200 transition hover:border-cyan-300/40"
            >
              Explorer <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <span className="inline-flex items-center rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1.5 text-xs font-bold text-lime-200">
              {shortAddress(GANGSTER_TOKEN_ADDRESS)}
            </span>
          </div>
        </div>

        {gameAddress ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Game contract</p>
            <p className="mt-2 break-all font-mono text-sm text-slate-200">{gameAddress}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyAddress(gameAddress, "game")}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-200 transition hover:border-lime-300/40 hover:text-white"
              >
                {copied === "game" ? <Check className="h-3.5 w-3.5 text-lime-300" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === "game" ? "Copied" : "Copy"}
              </button>
              {explorerGameUrl ? (
                <a
                  href={explorerGameUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-cyan-200 transition hover:border-cyan-300/40"
                >
                  Explorer <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Trade route</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Buys and sells run through the locked GANGSTER/WETH pool on pons. Always match the contract above before signing.
            </p>
            <a
              href={GANGSTER_PONS_SWAP_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.16em] text-cyan-200 hover:text-cyan-100"
            >
              Open pons swap <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>

      {addError ? <p className="mt-4 text-sm text-red-300">{addError}</p> : null}
      {!isConnected ? (
        <p className="mt-4 text-sm text-slate-400">
          Connect your wallet to auto-add ${GANGSTER_TOKEN_SYMBOL}, or use Add to wallet after connecting.
        </p>
      ) : null}
    </section>
  );
}
