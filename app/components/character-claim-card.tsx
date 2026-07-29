"use client";

import { useState } from "react";
import { Gift, KeyRound } from "lucide-react";
import { useAccount } from "wagmi";
import { PixelGangster } from "./pixel-gangster";

type Character = "Hoodlum" | "Captain" | "General" | "OG";

const characterDesign: Record<Character, "rookie" | "captain" | "boss" | "legend"> = {
  Hoodlum: "rookie",
  Captain: "captain",
  General: "boss",
  OG: "legend",
};

export function CharacterClaimCard() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [claimed, setClaimed] = useState<Character | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { address, isConnected } = useAccount();

  async function claimCharacter() {
    setStatus("");
    if (!isConnected || !address) {
      setStatus("Connect the wallet that will receive the gangster.");
      return;
    }
    if (!code.trim()) {
      setStatus("Enter the one-time character claim code.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/character-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, wallet: address }),
      });
      const result = await response.json() as {
        error?: string;
        character?: Character;
        earningRate?: number;
      };
      if (!response.ok || !result.character) {
        throw new Error(result.error || "This character code could not be used.");
      }
      setClaimed(result.character);
      setStatus(`${result.character} claimed at ${result.earningRate ?? 50}% of the normal paid earning rate.`);
      window.dispatchEvent(new Event("hoodatm-character-claimed"));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "This character code could not be used.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-amber-300/20 bg-[radial-gradient(circle_at_88%_15%,rgba(251,191,36,.13),transparent_24rem),rgba(2,6,23,.7)] p-6 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-amber-200">
            <Gift className="h-4 w-4" /> Got claimed by a gang?
          </div>
          <h2 className="mt-3 text-3xl font-black text-white">Claim your gangster.</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
            Enter the one-time code issued for your wallet. The code assigns its specific Hoodlum, Captain, General, or OG character to your account at 50% of that paid gangster&apos;s normal earning rate.
            If every active slot is full, unlock the next slot before using another code.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <label className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-4">
              <KeyRound className="h-4 w-4 text-amber-200" />
              <span className="sr-only">Gangster character claim code</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 21))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void claimCharacter();
                }}
                placeholder="CLAIM-XXXX-XXXX"
                className="min-w-0 flex-1 bg-transparent py-3 font-mono uppercase text-white outline-none placeholder:text-slate-600"
              />
            </label>
            <button
              type="button"
              onClick={() => void claimCharacter()}
              disabled={submitting}
              className="rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Claiming…" : "Claim gangster"}
            </button>
          </div>
          {status ? <p className="mt-3 text-sm font-semibold text-amber-100">{status}</p> : null}
        </div>
        {claimed ? (
          <div className="mx-auto rounded-2xl border border-amber-300/25 bg-black/35 p-3">
            <PixelGangster type={characterDesign[claimed]} className="h-32 w-32" />
            <p className="mt-2 text-center font-black text-white">{claimed} · 50%</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
