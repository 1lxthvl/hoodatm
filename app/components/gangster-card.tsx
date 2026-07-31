import { Sword, Shield } from "lucide-react";
import { PixelGangster } from "./pixel-gangster";
import { EthUsdAmount } from "./gangster-price-provider";

function BandanaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8s4-4 8-4 8 4 8 4v8s-4 4-8 4-8-4-8-4V8Z" />
      <path d="M6.5 12.5C8 11 10 10.5 12 10.5c2 0 4 .5 5.5 2" />
      <path d="M6 9.5c2.5 1.5 5.5 1.5 8 0" />
    </svg>
  );
}

export function GangsterCard({
  name,
  tier,
  power,
  costUsd,
  description,
  accent,
  pattern,
  character,
}: {
  name: string;
  tier: string;
  power: string;
  costUsd: number;
  description: string;
  accent: string;
  pattern: string;
  character: "rookie" | "captain" | "boss" | "legend";
}) {
  return (
    <div className="group relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/70 shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-2 hover:shadow-[0_25px_70px_rgba(168,85,247,0.28)]">
      <div className={`relative flex h-40 items-center justify-center overflow-hidden rounded-t-[1.8rem] ${accent} ${pattern} transition duration-300 group-hover:scale-105`}>
        <div className="absolute inset-0 opacity-25" />
        <div className="absolute inset-0 bg-white/10 opacity-0 transition duration-500 group-hover:opacity-70" />
        <div className="absolute -bottom-6 h-32 w-32 rounded-full bg-white/10 blur-2xl opacity-70" />
        <div className="relative z-10 rounded-[1.4rem] border border-white/20 bg-slate-950/60 p-2 shadow-2xl animate-floating">
          <PixelGangster type={character} className="h-28 w-28 drop-shadow-[0_0_18px_rgba(125,211,252,0.35)]" />
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-lg font-semibold text-white">{name}</p>
            <p className="text-sm text-slate-400">{tier}</p>
          </div>
          <div className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-fuchsia-200">
            {power}
          </div>
        </div>
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-fuchsia-500/20 to-cyan-500/20 opacity-0 transition duration-300 group-hover:opacity-70" />
          <div className="absolute inset-x-0 -top-6 h-2 bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-emerald-400 opacity-70 blur-xl" />
          <div className="relative space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2"><Sword className="h-4 w-4" /> Power</span>
              <span className="font-semibold text-white">{power}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2"><Shield className="h-4 w-4" /> Cost</span>
              <EthUsdAmount usd={costUsd} className="text-right font-semibold text-white" />
            </div>
            <p className="text-sm leading-6 text-slate-300">{description}</p>
          </div>
        </div>
        <div className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-400">
          <BandanaIcon />
          Unlock after entry
        </div>
      </div>
    </div>
  );
}
