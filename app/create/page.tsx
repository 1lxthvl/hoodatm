"use client";

import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { waitForTransactionReceipt } from "@wagmi/core";
import { Address, formatEther, isAddress, zeroAddress } from "viem";
import { readContract } from "@wagmi/core";
import { useAccount, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { GangsterUsdAmount } from "../components/gangster-price-provider";
import { hoodAtmChain, hoodAtmGameAbi } from "../lib/robinhood-chain";
import { wagmiConfig } from "../lib/wagmi-config";

const launchSteps = [
  { title: "Join", description: "Pay the live equivalent of $5 in ETH. The contract forwards the exact payment to the hoodATM treasury." },
  { title: "Hold", description: "Keep at least $10 worth of $GANGSTER in your connected wallet to unlock and retain game access." },
  { title: "Upgrade", description: "Pay the live $GANGSTER quote to move from Civilian to Hoodlum, Captain, General, or OG." },
  { title: "Hit", description: "Use earned, unclaimed $GANGSTER on on-chain ATM and player robbery actions." },
];

export default function CreatePage() {
  const [referrer, setReferrer] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [referralStatus, setReferralStatus] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, isPending } = useWriteContract();
  const configuredAddress = process.env.NEXT_PUBLIC_HOODATM_GAME_ADDRESS;
  const gameAddress = configuredAddress && isAddress(configuredAddress) ? configuredAddress as Address : undefined;
  const gameLive = process.env.NEXT_PUBLIC_GAME_LIVE === "true";

  useEffect(() => {
    const queryCode = new URLSearchParams(window.location.search).get("ref") || "";
    const code = queryCode || window.localStorage.getItem("hoodatm_referral_code") || "";
    if (!code) return;
    window.localStorage.setItem("hoodatm_referral_code", code);
    window.setTimeout(() => setReferralCode(code), 0);
    const username = code.replace(/^\$gangster/i, "");

    async function resolveReferrer() {
      setReferralStatus("Resolving referral wallet…");
      try {
        const response = await fetch(`/api/referral/resolve?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        if (response.ok) {
          const result = await response.json() as { wallet: string };
          if (isAddress(result.wallet)) {
            setReferrer(result.wallet);
            setReferralStatus(`Referral locked to ${code}`);
            return;
          }
        }
        if (gameAddress && username) {
          const wallet = await readContract(wagmiConfig, {
            address: gameAddress,
            abi: hoodAtmGameAbi,
            functionName: "resolveReferralCode",
            args: [username],
            chainId: hoodAtmChain.id,
          });
          if (wallet !== zeroAddress) {
            setReferrer(wallet);
            setReferralStatus(`Referral locked to ${code}`);
            return;
          }
        }
        setReferralStatus("This referral code is not registered yet.");
      } catch {
        setReferralStatus("Referral lookup is temporarily unavailable.");
      }
    }

    void resolveReferrer();
  }, [gameAddress]);

  const { data: requiredJoinEth } = useReadContract({
    address: gameAddress,
    abi: hoodAtmGameAbi,
    functionName: "requiredJoinEth",
    chainId: hoodAtmChain.id,
    query: { enabled: Boolean(gameAddress && gameLive) },
  });

  async function joinGang() {
    setStatus(null);
    if (!isConnected || !address) {
      setStatus("Connect MetaMask or Rabby first.");
      return;
    }
    if (!gameLive || !gameAddress || requiredJoinEth === undefined) {
      setStatus("Entry remains locked until the audited contracts are deployed, funded, and unpaused.");
      return;
    }
    if (referrer && !isAddress(referrer)) {
      setStatus("The referral wallet address is invalid.");
      return;
    }

    try {
      if (chainId !== hoodAtmChain.id) await switchChainAsync({ chainId: hoodAtmChain.id });
      const hash = await writeContractAsync({
        address: gameAddress,
        abi: hoodAtmGameAbi,
        functionName: "join",
        args: [referrer ? referrer as Address : zeroAddress],
        value: requiredJoinEth,
        chainId: hoodAtmChain.id,
      });
      setStatus("Payment submitted. Waiting for Robinhood Chain confirmation…");
      await waitForTransactionReceipt(wagmiConfig, { chainId: hoodAtmChain.id, hash, confirmations: 1 });
      window.localStorage.removeItem("hoodatm_referral_code");
      setStatus("You are in. Keep the required $GANGSTER value in this wallet to retain access.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message.split("\n")[0] : "Entry transaction failed.");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-cyan-950/20">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-200">
          <Sparkles className="h-4 w-4" />
          Step into the hood
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-white">Own the block. Stack the hood.</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-300">
          hoodATM has one initiation payment: $5 worth of ETH, quoted by Chainlink at entry and deposited into the hoodATM treasury. $GANGSTER is not a second buy-in: keep at least $10 worth in your connected wallet to access the game.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {launchSteps.map((step) => (
            <div key={step.title} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-sm font-semibold text-white">{step.title}</p>
              <p className="mt-2 text-sm text-slate-400">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      <aside className="rounded-3xl border border-fuchsia-500/20 bg-slate-900/80 p-8">
        <div className="flex items-center gap-2 text-fuchsia-200">
          <ShieldCheck className="h-5 w-5" />
          <span className="text-sm font-medium">Hood Access</span>
        </div>
        <div className="mt-8 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">ETH initiation · $5 USD</p>
            <p className="mt-1 font-semibold text-white">
              {requiredJoinEth === undefined ? "Quoted by contract at entry" : `${Number(formatEther(requiredJoinEth)).toFixed(6)} ETH`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">$GANGSTER wallet hold · $10 USD</p>
            <p className="mt-1 font-semibold text-white"><GangsterUsdAmount usd={10} /></p>
          </div>
          <label className="block text-sm text-slate-300">
            Referrer wallet (optional)
            <input
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none placeholder:text-slate-600"
              value={referrer}
              onChange={(event) => setReferrer(event.target.value.trim())}
              placeholder="0x…"
              readOnly={Boolean(referralCode)}
            />
          </label>
          {referralStatus ? <p className="text-xs text-cyan-200">{referralStatus}</p> : null}
          <button
            type="button"
            onClick={joinGang}
            disabled={!gameLive || !gameAddress || isPending}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-4 py-3 font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "Confirm in wallet…" : gameLive ? "Pay $5 in ETH & join" : "Entry opens after contract audit"}
            <ArrowRight className="h-4 w-4" />
          </button>
          {status && <p className="rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-slate-300">{status}</p>}
        </div>
        <div className="mt-6 flex items-center gap-2 text-sm text-slate-400">
          <Zap className="h-4 w-4" />
          Treasury deposit: $5 in ETH · Access: hold $10 in $GANGSTER
        </div>
        <p className="mt-4 text-sm text-slate-500">
          The token hold remains in your wallet. Paid $GANGSTER upgrades are quoted from a manipulation-resistant 30-minute pool TWAP and deposited directly to the treasury.
        </p>
        <p className="mt-3 text-xs leading-5 text-slate-600">
          For account security, abuse prevention, and referral attribution, hoodATM records the connected wallet, verified X username, IP address, and account status.
        </p>
      </aside>
    </div>
  );
}
