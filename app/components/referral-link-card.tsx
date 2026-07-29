"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Save } from "lucide-react";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "@wagmi/core";
import { Address, isAddress } from "viem";
import { hoodAtmChain, hoodAtmGameAbi } from "../lib/robinhood-chain";
import { wagmiConfig } from "../lib/wagmi-config";

function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 15);
}

export function ReferralLinkCard({ suggestedUsername = "" }: { suggestedUsername?: string }) {
  const [username, setUsername] = useState(() => normalizeUsername(suggestedUsername));
  const [savedUsername, setSavedUsername] = useState(() => normalizeUsername(suggestedUsername));
  const [status, setStatus] = useState("");
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const configuredAddress = process.env.NEXT_PUBLIC_HOODATM_GAME_ADDRESS;
  const gameAddress = configuredAddress && isAddress(configuredAddress) ? configuredAddress as Address : null;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const storedUsername = normalizeUsername(window.localStorage.getItem("hoodatm_username") || "");
      if (!storedUsername) return;
      setUsername(storedUsername);
      setSavedUsername(storedUsername);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const code = savedUsername ? `$GANGSTER${savedUsername}` : "";
  const referralLink = useMemo(
    () => code ? `https://hoodatm.online/?ref=${encodeURIComponent(code)}` : "",
    [code],
  );
  const valid = username.length >= 3;

  async function registerUsername() {
    if (!valid) return;
    setStatus("");
    try {
      if (gameAddress) {
        if (!isConnected) {
          setStatus("Connect your wallet first.");
          return;
        }
        if (chainId !== hoodAtmChain.id) await switchChainAsync({ chainId: hoodAtmChain.id });
        const hash = await writeContractAsync({
          address: gameAddress,
          abi: hoodAtmGameAbi,
          functionName: "setUsername",
          args: [username],
          chainId: hoodAtmChain.id,
        });
        await waitForTransactionReceipt(wagmiConfig, { chainId: hoodAtmChain.id, hash, confirmations: 1 });
      }
      if (address) {
        const response = await fetch("/api/admin/players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: address, gangsterUsername: username }),
        });
        if (!response.ok) {
          const result = await response.json() as { error?: string };
          throw new Error(result.error || "Could not register this referral code.");
        }
      }
      window.localStorage.setItem("hoodatm_username", username);
      setSavedUsername(username);
      setStatus(gameAddress ? "Crew code registered on-chain." : "Preview code saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message.split("\n")[0] : "Registration failed.");
    }
  }

  async function copyLink() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setStatus("Referral link copied.");
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6">
      <label className="text-sm font-semibold text-white" htmlFor="crew-username">Pick your gangster username</label>
      <p className="mt-1 text-sm leading-6 text-slate-400">
        After the initiation fee is paid, the contract reserves this lowercase username to your wallet. Your code is always $GANGSTER + username.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center rounded-full border border-white/15 bg-black/35 px-4">
          <span className="text-sm font-bold text-lime-300">$GANGSTER</span>
          <input
            id="crew-username"
            value={username}
            onChange={(event) => setUsername(normalizeUsername(event.target.value))}
            minLength={3}
            maxLength={15}
            className="min-w-0 flex-1 bg-transparent px-1 py-3 text-white outline-none"
            aria-describedby="crew-username-help"
          />
        </div>
        <button
          type="button"
          onClick={registerUsername}
          disabled={!valid}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-40"
        >
          <Save className="h-4 w-4" /> Register code
        </button>
      </div>
      <p id="crew-username-help" className="mt-2 text-xs text-slate-500">3–15 characters: a–z, 0–9, or underscore.</p>

      <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-slate-950/80 px-4 py-4 text-slate-200">
        <p className="text-sm text-slate-400">Your referral link</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="break-all font-semibold text-white">{referralLink || "Register your username to create a referral link."}</p>
          <button type="button" onClick={copyLink} disabled={!referralLink} className="inline-flex shrink-0 items-center gap-2 text-sm font-bold text-cyan-200 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40">
            <Copy className="h-4 w-4" /> Copy
          </button>
        </div>
      </div>
      {status ? <p className="mt-3 flex items-center gap-2 text-sm text-lime-200"><Check className="h-4 w-4" />{status}</p> : null}
    </div>
  );
}
