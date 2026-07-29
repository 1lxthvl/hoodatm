import { AtmMachine } from "./atm-machine";

export function AtmCard({
  name,
  ticker,
  apy,
  accent,
  tier,
}: {
  name: string;
  ticker: string;
  apy: string;
  accent: string;
  tier: "low" | "medium" | "high" | "very-high";
}) {
  return (
    <div className="group relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_18px_60px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(56,189,248,0.16)]">
      <div className="absolute -top-3 right-4 h-4 w-4 rounded-full bg-cyan-400/30 blur-xl animate-pulse-slow" />
      <div className={`mb-5 h-32 w-full overflow-hidden rounded-[1.6rem] border border-white/10 bg-slate-950/70 p-3 shadow-inner ${accent} transition duration-300 group-hover:scale-105`}>
        <AtmMachine tier={tier} className="mx-auto h-full w-full object-contain drop-shadow-2xl" />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-white">{name}</p>
          <p className="text-sm text-slate-400">{ticker}</p>
        </div>
        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
          {apy}
        </div>
      </div>
      <p className="mt-6 text-sm leading-6 text-slate-400">
        Receives {apy} of the token-flow ATM allocation.
      </p>
    </div>
  );
}
