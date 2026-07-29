import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, CircleDollarSign, PlayCircle, Sparkles } from "lucide-react";
import { AtmCard } from "../components/atm-card";
import { GangsterCard } from "../components/gangster-card";
import { AtmMachine } from "../components/atm-machine";
import { PixelGangster } from "../components/pixel-gangster";
import { GangsterUsdAmount } from "../components/gangster-price-provider";
import { CharacterClaimCard } from "../components/character-claim-card";
import { CrewSlotsCard } from "../components/crew-slots-card";

const machines = [
  { name: "Corner Store ATM", ticker: "L1 · CORNER", apy: "1%", accent: "bg-gradient-to-br from-fuchsia-500 to-violet-500", tier: "low" as const },
  { name: "Nightclub ATM", ticker: "L2 · CLUB", apy: "2%", accent: "bg-gradient-to-br from-cyan-500 to-sky-500", tier: "medium" as const },
  { name: "Casino Floor ATM", ticker: "L3 · CASINO", apy: "4%", accent: "bg-gradient-to-br from-amber-500 to-orange-500", tier: "high" as const },
  { name: "Downtown Vault ATM", ticker: "L4 · VAULT", apy: "18%", accent: "bg-gradient-to-br from-emerald-500 to-lime-500", tier: "very-high" as const },
];

const gangsters = [
  { name: "Hoodlum", tier: "Starter", power: "5", costUsd: 2.5, description: "Gain 5 power and share the daily base plus recycled-spending farm pool.", accent: "bg-gradient-to-br from-amber-400/30 to-orange-500/20", pattern: "pattern-amber", character: "rookie" as const },
  { name: "Captain", tier: "Mid", power: "30", costUsd: 12.5, description: "Secure 30 power and a larger relative share of the daily farm.", accent: "bg-gradient-to-br from-fuchsia-500/30 to-pink-500/20", pattern: "pattern-fuchsia", character: "captain" as const },
  { name: "General", tier: "High", power: "135", costUsd: 50, description: "Command 135 power and control more of the daily farm.", accent: "bg-gradient-to-br from-cyan-500/30 to-sky-500/20", pattern: "pattern-cyan", character: "boss" as const },
  { name: "OG", tier: "Elite", power: "750", costUsd: 250, description: "Hold 750 power and the strongest relative share of the daily farm.", accent: "bg-gradient-to-br from-emerald-500/30 to-lime-500/20", pattern: "pattern-emerald", character: "legend" as const },
];

const systems = [
  { title: "Join the hood", text: "Pay the live equivalent of $5 in ETH for Hood Access. Referred entries also track the 2.5% referral-pool allocation." },
  { title: "Hold $GANGSTER", text: "Keep at least $10 worth of $GANGSTER in the connected wallet to keep game access active." },
  { title: "Recruit gangsters", text: "Choose Hoodlum, Captain, General, or OG characters to add power to your account." },
  { title: "Build a Crew", text: "Run multiple active gangsters. Extra slots start at $10, double each time, and three slots make a Crew." },
  { title: "Hustle", text: "Earn from the $5–$10 daily base plus 25% of recycled $GANGSTER spending according to your active network power share." },
  { title: "Manage heat", text: "Heat rises while hustling and gradually cuts the account's earning power." },
  { title: "Lay low", text: "Pause earnings to cool heat at 1% per minute and stay protected from player robberies." },
  { title: "Hit ATMs", text: "Take power-scaled shots at the Corner Store, Nightclub, Casino Floor, and Downtown Vault ATMs." },
  { title: "Rob rivals", text: "Target exposed unclaimed balances, weigh the power gap, and respect the six-hour target cooldown." },
  { title: "Claim and burn", text: "Secure exposed earnings in the in-game wallet with a 10% burn, then withdraw an eligible portion every 12 hours." },
  { title: "Jail and snitch", text: "Snitch on stronger attackers, serve idle-earning lockouts, smuggle phones, and order retaliation hits." },
  { title: "Run a gang", text: "Create a gang, manage ranks, control the roster, and fund 25% same-gang jail-break attempts." },
  { title: "Refer members", text: "Earn robbery-only loot bonuses, build hood power, and qualify for a free gang charter after three referrals." },
  { title: "Track activity", text: "Review claims, burns, robberies, ATM outcomes, jail actions, and gang activity in one ledger." },
  { title: "Climb the leaderboard", text: "Compete on confirmed earnings. The season's first-place player wins an OG gangster." },
].map((system, index) => ({
  ...system,
  number: String(index + 1).padStart(2, "0"),
}));

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="grid gap-10 rounded-[2.5rem] border border-white/10 bg-slate-900/70 p-8 shadow-[0_18px_80px_rgba(2,6,23,0.45)] lg:grid-cols-[1.05fr_0.95fr] lg:p-12">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-sm text-fuchsia-200">
            <Sparkles className="h-4 w-4" />
            Block economy
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Build your crew, stack the block, and hit the ATMs for the jackpot.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Pay the live equivalent of $5 in ETH to join the gang, then keep at least $10 worth of $GANGSTER in your connected wallet to stay in the game. Entry payments go directly to the hoodATM treasury, with a 2.5% referral-pool allocation tracked for referred entries.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/create" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-5 py-3 font-semibold text-white transition hover:opacity-90">
              Start mobbin&apos;
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/leaderboard" className="rounded-full border border-white/10 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20">
              Explore ATMs
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              { value: "$5 in ETH", label: "Initiation allocation" },
              { value: <GangsterUsdAmount usd={10} compact />, label: "$10 live wallet hold" },
              { value: "1B", label: "$GANGSTER supply" },
              { value: "6h", label: "ATM hit cooldown" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-2xl font-semibold text-white">{item.value}</p>
                <p className="mt-1 text-sm text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative min-h-[440px] overflow-hidden rounded-[2rem] border border-amber-300/25 bg-[#090b09] p-4 shadow-[0_25px_70px_rgba(0,0,0,0.55)]">
          <Image src="/assets/hoodatm-game-logo.svg" alt="hoodATM pixel-art game logo" fill priority sizes="(max-width: 1024px) 100vw, 45vw" className="pixel-logo object-cover object-center opacity-95" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,6,.1),rgba(5,8,6,.78)_75%,rgba(5,8,6,.96))]" />
          <div className="absolute inset-0 hood-logo-grit" />
          <div className="relative z-10 flex items-center justify-between text-sm text-lime-200">
            <span className="inline-flex items-center gap-2 rounded-full border border-lime-300/35 bg-black/55 px-3 py-1.5 font-bold uppercase tracking-[0.14em]"><CircleDollarSign className="h-4 w-4" /> Hood control</span>
            <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-amber-100">Pre-launch</span>
          </div>
          <div className="absolute left-4 top-20 z-10 rounded-2xl border border-amber-200/30 bg-black/60 p-2 shadow-2xl animate-floating">
            <AtmMachine tier="very-high" className="h-28 w-24" />
          </div>
          <div className="absolute right-3 top-28 z-10 rounded-2xl border border-lime-300/25 bg-black/55 p-1.5 shadow-2xl [animation-delay:-3s] animate-floating">
            <PixelGangster type="legend" className="h-24 w-24" />
          </div>
          <div className="absolute inset-x-5 bottom-5 z-10 rounded-2xl border border-amber-200/20 bg-black/70 p-4 backdrop-blur-sm">
            <div className="flex items-end justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-200">ATM allocation</p><p className="mt-1 text-3xl font-black text-white">25% <span className="text-base font-semibold text-lime-300">token flow</span></p></div>
              <div className="text-right text-xs text-lime-100/65"><p>Hit cycle</p><p className="mt-1 font-mono text-lg font-bold text-amber-200">6 hours</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="machines" className="rounded-[2.5rem] border border-white/10 bg-slate-900/70 p-8 lg:p-10">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-200">Machines</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Pick the ATM your crew is built to hit.</h2>
            <p className="mt-3 text-lg text-slate-300">The Corner Store ATM receives 1%, Nightclub ATM 2%, Casino Floor ATM 4%, and Downtown Vault ATM 18% of the token flow. Each machine can be hit once every 6 hours as a jackpot event while idle farming remains your main income source.</p>
            <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              {machines.map((machine) => (
                <div key={machine.tier} className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
                  <AtmMachine tier={machine.tier} className="mx-auto h-44 w-full max-w-[220px] animate-atm-glow object-contain" />
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            {machines.map((machine) => (
              <AtmCard key={machine.name} {...machine} />
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2.5rem] border border-white/10 bg-slate-900/70 p-8 lg:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-fuchsia-200">Gangsters</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">Recruit your crew and take control of the block.</h2>
            <p className="mt-3 text-lg text-slate-300">Each gangster has a different level of power and cost, and you start as a CIVILIAN before moving up the chain gang.</p>
          </div>
          <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
            <span className="inline-flex items-center gap-2"><PlayCircle className="h-4 w-4" /> Gang roster</span>
          </div>
        </div>
        <div className="mt-6 rounded-[2rem] border border-fuchsia-500/20 bg-slate-950/70 p-6 text-slate-300">
          <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-200">CIVILIAN starter</p>
          <p className="mt-3 text-base leading-7">Every newcomer begins as a CIVILIAN with level 1 power. Pay the gangster upgrade fee to climb the chain gang and unlock Hoodlum, Captain, General, or OG status. Your farm share is based on effective power and dilutes as total network power grows.</p>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {gangsters.map((gangster) => (
            <GangsterCard key={gangster.name} {...gangster} />
          ))}
        </div>
        <CharacterClaimCard />
        <CrewSlotsCard />
      </section>

      <section id="how" className="rounded-[2.5rem] border border-white/10 bg-slate-900/70 p-8 lg:p-10">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.3em] text-fuchsia-200">How it works</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">{systems.length} systems to run the block.</h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {systems.map((step) => (
            <div key={step.number} className="rounded-[1.75rem] border border-white/10 bg-slate-950/60 p-6">
              <p className="text-2xl font-semibold text-fuchsia-300">{step.number}</p>
              <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="metrics" className="rounded-[2.5rem] border border-white/10 bg-slate-900/70 p-8 lg:p-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-200">Economy</p>
            <h2 className="mt-3 text-3xl font-semibold text-white">The block fund runs on risk, power, and pressure.</h2>
            <p className="mt-3 max-w-2xl text-lg text-slate-300">A $5 ETH treasury deposit brings players into the gang; referred entries track a 2.5% referral-pool allocation. The $10 $GANGSTER wallet hold keeps the crew committed. Crew power, claim burns, rewards, and jackpot risk drive the block economy.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { value: "25%", label: "Burn" },
              { value: "25%", label: "ATM allocation" },
              { value: "25%", label: "Buyback" },
              { value: "25%", label: "Rewards + reserve" },
            ].map((item) => (
              <div key={item.label} className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
                <p className="text-2xl font-semibold text-white">{item.value}</p>
                <p className="mt-1 text-sm text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2.5rem] border border-white/10 bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 p-8 lg:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.3em] text-cyan-200">Ready to run it</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Buy in, recruit your crew, and let the block work for you.</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/create" className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 font-semibold text-white transition hover:opacity-90">
              Start mobbin&apos;
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link href="/leaderboard" className="rounded-full border border-white/10 bg-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white/20">
              See the rules
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
