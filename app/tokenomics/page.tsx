import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { GangsterUsdAmount } from "../components/gangster-price-provider";

const tiers = [
  { name: "Civilian", totalUsd: 5, power: "1", role: "Initiation-only starting power" },
  { name: "Hoodlum", totalUsd: 7.5, power: "5", role: "$5 initiation + $2.50 upgrade" },
  { name: "Captain", totalUsd: 17.5, power: "30", role: "$5 initiation + $12.50 upgrade" },
  { name: "General", totalUsd: 55, power: "135", role: "Elite block power" },
  { name: "OG", totalUsd: 255, power: "750", role: "Most powerful gangster tier" },
];

const atmAllocs = [
  { tier: "Corner Store ATM", allocation: "1%", rewardUsd: 0.004, lossUsd: 0.001, role: "Entry-level jackpot sink" },
  { tier: "Nightclub ATM", allocation: "2%", rewardUsd: 0.01, lossUsd: 0.003, role: "Balanced earnings tier" },
  { tier: "Casino Floor ATM", allocation: "4%", rewardUsd: 0.025, lossUsd: 0.007, role: "High reward tier" },
  { tier: "Downtown Vault ATM", allocation: "18%", rewardUsd: 0.075, lossUsd: 0.02, role: "Jackpot tier" },
];

const atmOdds = [
  { rank: "Civilian", power: 1, odds: ["0.7000%", "0.0500%", "0.0105%", "0.0015%"] },
  { rank: "Hoodlum", power: 5, odds: ["3.5000%", "0.2500%", "0.0525%", "0.0075%"] },
  { rank: "Captain", power: 30, odds: ["21.0000%", "1.5000%", "0.3150%", "0.0450%"] },
  { rank: "General", power: 135, odds: ["48.0000%", "6.7500%", "1.4175%", "0.2025%"] },
  { rank: "OG", power: 750, odds: ["70.0000%", "37.5000%", "7.8750%", "1.1250%"] },
];

export default function GangstanomicsPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 shadow-[0_18px_80px_rgba(0,0,0,0.35)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1 text-sm text-fuchsia-200">
          <Sparkles className="h-4 w-4" />
          hoodATM Gangstanomics
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white">$GANGSTER economics for idle farming and ATM jackpots.</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
          hoodATM is built around a 1B on-chain token supply, a live $5 ETH initiation allocation, and a $10 $GANGSTER wallet-hold requirement. Every new recruit becomes a gang member after entry and keeps access by holding the required $GANGSTER value in their connected wallet.
        </p>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8">
        <h2 className="text-2xl font-semibold text-white">Token flow</h2>
        <p className="mt-4 text-slate-300">
          The ETH initiation payment is priced on-chain at a live $5 equivalent and deposited directly to the hoodATM treasury. Referred entries record a 2.5% referral-pool allocation on-chain. $GANGSTER remains a commitment requirement rather than a second payment.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            { label: "Treasury deposit", value: "100% of $5 entry" },
            { label: "Tracked referral allocation", value: "2.5% of referred entry" },
            { label: "$GANGSTER wallet hold", value: "$10 minimum" },
            { label: "Player-robbery boost", value: "2.5% each · 25% max" },
            { label: "Commitment rule", value: "Hold, don’t spend" },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
              <p className="text-xl font-semibold text-white">{item.value}</p>
              <p className="mt-1 text-sm text-slate-400">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8">
        <h2 className="text-2xl font-semibold text-white">Crew power & block earnings</h2>
        <p className="mt-4 text-slate-300">
          Gangster cost is paid in $GANGSTER and power is the key farming metric. The daily base earning pool starts at $2.50 and increases by 10% of that base for every active purchased gangster, reaching its $5 cap at 10. Code-granted characters do not increase the pool. Then 25% of every $GANGSTER gameplay payment is recycled into that day&apos;s farm pool. Idle rewards are distributed based on your power share relative to total network power. Earnings remain unclaimed—and exposed to robberies—until the player claims them.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {tiers.map((tier) => (
            <div key={tier.name} className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
              <p className="text-lg font-semibold text-white">{tier.name}</p>
              <p className="mt-2 text-sm text-slate-400">Total entry + tier cost: ${tier.totalUsd.toFixed(2)}</p>
              <p className="mt-1 text-sm text-slate-400">Power: {tier.power}</p>
              <p className="mt-2 text-sm text-slate-300">{tier.role}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-violet-300/20 bg-violet-400/[0.05] p-8">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-violet-200">Gang economy</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Recruit the crew or pay for the charter.</h2>
        <p className="mt-4 max-w-4xl leading-7 text-slate-300">
          A player can create a gang by spending the live equivalent of $10 in $GANGSTER. Three qualified referrals waive that creation payment. Gang owners maintain the member list and assign internal ranks.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { label: "Gang creation", value: "$5 in $GANGSTER", text: "Quoted from the live token price." },
            { label: "Free charter", value: "3 referrals", text: "Three qualified recruits waive the creation payment." },
            { label: "Gang jail break", value: "25% chance", text: "A paid attempt can only target a jailed member of the same gang." },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{item.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-red-400/20 bg-[radial-gradient(circle_at_85%_15%,rgba(220,38,38,.14),transparent_24rem),rgba(2,6,23,.72)] p-8">
        <p className="text-sm font-bold uppercase tracking-[0.24em] text-red-200">Claim burn & robbery economy</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">Secure the bag or leave it on the block.</h2>
        <p className="mt-4 max-w-4xl leading-7 text-slate-300">
          Farming and robbery rewards accumulate as an exposed, unclaimed balance. Claims are limited to once per hour and always burn 10%. An additional ATM-pool fee starts at 20% and falls by 2% for every completed hour the balance stays unclaimed, reaching 0% at 10 hours. From hour 11 through hour 20, the claim instead earns 2% extra per hour up to a 20% bonus. Claim fees are split across the Corner Store, Nightclub, Casino Floor, and Downtown Vault pools using their 1:2:4:18 allocation. A withdrawal remains available every 12 hours and is limited to the smaller of 50% of the protected in-game balance or 50% of the player&apos;s verified average $GANGSTER holding over the previous 24 hours. Accounts holding only a code-granted gangster must also purchase a gangster before withdrawing.
        </p>
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Claim window", value: "1h", text: "One protected in-game-wallet claim per rolling hour." },
            { label: "ATM fee", value: "20% → 0%", text: "Drops by 2% per completed unclaimed hour through hour 10." },
            { label: "Wait bonus", value: "0% → 20%", text: "Rises by 2% per hour after hour 10 and caps at hour 20." },
            { label: "Claim burn", value: "10%", text: "Permanently removed from supply on every claim." },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{item.value}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{item.text}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 rounded-2xl border border-lime-200/20 bg-lime-300/[0.06] p-5 text-sm leading-7 text-lime-50/80">
          <span className="font-black text-lime-200">Code-claim withdrawal rule:</span> a code-granted gangster can hustle and claim into the protected in-game balance, but the account cannot withdraw on-chain until it owns at least one paid gangster. Buying any gangster tier fulfills that requirement and permanently grants one additional active gangster slot at no slot fee. The normal 12-hour cooldown and verified 24-hour holding limit still apply.
        </div>
        <div className="mt-5 rounded-2xl border border-amber-200/20 bg-amber-300/[0.06] p-5 text-sm leading-7 text-amber-50/80">
          Powerless and low-power targets are deliberately bad marks: they hold less loot, only expose a small percentage of their balance, and can take 20–25% of the attacker’s unclaimed balance when the robbery fails. The strongest expected-value targets are equal-power rivals or carefully chosen stronger players.
        </div>
        <div className="mt-5 rounded-2xl border border-blue-200/20 bg-blue-300/[0.06] p-5 text-sm leading-7 text-blue-50/80">
          A victim robbed successfully by a stronger player may spend the live equivalent of $1 in $GANGSTER on one snitch attempt within 24 hours. The verifiable 5% roll can put that attacker behind bars and disable their idle earnings for 3 hours. Loot awarded after a failed robbery cannot be claimed for 30 minutes, and players actively cooling heat through Lay Low cannot be robbed.
        </div>
        <div className="mt-5 rounded-2xl border border-red-200/20 bg-red-300/[0.06] p-5 text-sm leading-7 text-red-50/80">
          In jail, a $2 $GANGSTER phone has a 50% delivery chance, a 25% chance of getting caught and doubling the remaining sentence, and a 25% failed-delivery chance. A delivered phone buys one 50/50 retaliation hit. Successful recovery starts at 80% of eligible lost loot and decays evenly to zero after 60 minutes.
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8">
        <h2 className="text-2xl font-semibold text-white">ATM rewards & jackpot design</h2>
        <p className="mt-4 text-slate-300">
          ATMs are jackpot tiers. They pay $GANGSTER and can be hit every 6 hours, preserving idle farming value while rewarding strategic ATM strikes.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {atmAllocs.map((item) => (
            <div key={item.tier} className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
              <p className="text-lg font-semibold text-white">{item.tier}</p>
              <p className="mt-2 text-sm font-bold text-amber-200">{item.allocation} of token flow</p>
              <p className="mt-2 text-sm text-lime-300">Reward: <GangsterUsdAmount usd={item.rewardUsd} /></p>
              <p className="mt-1 text-sm text-red-300">Failed-hit burn: <GangsterUsdAmount usd={item.lossUsd} /></p>
              <p className="mt-1 text-sm text-slate-300">{item.role}</p>
            </div>
          ))}
        </div>
        <div className="mt-7 overflow-x-auto rounded-3xl border border-white/10">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="bg-black/35 text-slate-400">
              <tr>
                <th className="px-4 py-3">Rank / power</th>
                <th className="px-4 py-3">Corner Store</th>
                <th className="px-4 py-3">Nightclub</th>
                <th className="px-4 py-3">Casino Floor</th>
                <th className="px-4 py-3">Downtown Vault</th>
              </tr>
            </thead>
            <tbody>
              {atmOdds.map((row) => (
                <tr key={row.rank} className="border-t border-white/10">
                  <td className="px-4 py-3 font-bold text-white">{row.rank} <span className="text-slate-500">· {row.power}</span></td>
                  {row.odds.map((odds) => <td key={odds} className="px-4 py-3 font-mono text-amber-200">{odds}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8">
        <h2 className="text-2xl font-semibold text-white">Risk & jackpot rules</h2>
        <p className="mt-4 text-slate-300">
          Players stake $GANGSTER on-chain for ATM breaks. Success yields jackpot bonuses and extra pool rewards; failure burns or routes tokens to reserve and makes the next hit harder.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            "Idle farming is the main income stream.",
            "The $2.50 daily base gains $0.25 per active purchased gangster, caps at $5 with 10, then adds 25% of all $GANGSTER gameplay spending before distribution by effective network power.",
            "Heat rises 1% per minute and cuts earnings 1% per 3 heat; laying low cools 1% per minute.",
            "ATM hits are limited to once every 6 hours.",
            "Jackpot rewards are tiered and risk-weighted.",
          ].map((text) => (
            <div key={text} className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 text-slate-300">
              {text}
            </div>
          ))}
        </div>
      </section>

      <div className="rounded-[2rem] border border-white/10 bg-cyan-500/10 p-8 text-slate-100">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Spread the word in the hood</p>
            <h2 className="text-3xl font-semibold">Spread the word in the hood and share the loot.</h2>
          </div>
          <Link href="/referral" className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
            Share the loot
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
