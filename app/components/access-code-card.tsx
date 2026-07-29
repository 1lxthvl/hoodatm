"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";

export function AccessCodeCard() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { address, isConnected } = useAccount();
  const router = useRouter();

  async function redeem() {
    setStatus("");
    if (!isConnected || !address) {
      setStatus("Connect your wallet before using a code.");
      return;
    }
    if (!code.trim()) {
      setStatus("Enter the word you were given.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, wallet: address }),
      });
      const result = await response.json() as { error?: string; redirectTo?: string };
      if (!response.ok) throw new Error(result.error || "This code could not be used.");
      setStatus("Word accepted. Hood access unlocked.");
      router.push(result.redirectTo || "/create");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "This code could not be used.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-[2rem] border border-red-300/20 bg-red-400/[0.06] p-6">
      <KeyRound className="h-7 w-7 text-red-300" />
      <h2 className="mt-4 text-2xl font-semibold text-white">WHAT&apos;S THE WORD?</h2>
      <p className="mt-3 text-sm leading-7 text-slate-300">
        Got a one-time hood code? Connect the wallet that will pay the initiation, enter it here, and unlock Hood Access. (Connection is only required to link invite code with the account)
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 20))}
          onKeyDown={(event) => {
            if (event.key === "Enter") void redeem();
          }}
          placeholder="HOOD-XXXX-XXXX"
          aria-label="One-time Hood Access code"
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-mono uppercase text-white outline-none placeholder:text-slate-600 focus:border-red-300/40"
        />
        <button
          type="button"
          onClick={() => void redeem()}
          disabled={submitting}
          className="rounded-xl bg-red-300 px-5 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? "Checking…" : "Say the word"}
        </button>
      </div>
      {status ? <p className="mt-3 text-sm font-semibold text-amber-100">{status}</p> : null}
    </section>
  );
}
