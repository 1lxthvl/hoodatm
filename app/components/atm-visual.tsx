import { PlayCircle } from "lucide-react";
import Image from "next/image";

export function AtmVisual({ image }: { image: string }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] animate-floating">
      <div className="absolute -top-6 -right-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="absolute -bottom-6 left-4 h-28 w-28 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="relative rounded-[1.6rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/15 via-slate-900 to-fuchsia-500/10 p-4">
        <div className="mb-4 flex items-center justify-between text-sm text-slate-300">
          <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1">Live ATM</span>
          <span className="inline-flex items-center gap-2 text-cyan-200"><PlayCircle className="h-4 w-4" /> Running</span>
        </div>
        <Image src={image} alt="ATM machine" width={280} height={224} className="mx-auto h-56 w-full max-w-[280px] rounded-[1.5rem] object-contain animate-atm-glow" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
            <p className="text-sm text-slate-400">Flow</p>
            <p className="mt-1 text-xl font-semibold text-white">+0.117 ETH</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
            <p className="text-sm text-slate-400">Status</p>
            <p className="mt-1 text-xl font-semibold text-white">Hot</p>
          </div>
        </div>
      </div>
    </div>
  );
}
