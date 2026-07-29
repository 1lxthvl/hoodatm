import Link from "next/link";
import { ArrowRight, Gift, Landmark, TrendingUp, Users } from "lucide-react";
import { ReferralLinkCard } from "../components/referral-link-card";

export default function ReferralPage() {
  return (
    <div className="space-y-10">
      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8 shadow-[0_18px_80px_rgba(0,0,0,0.35)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-200">
          <Gift className="h-4 w-4" />
          Referral rewards
        </div>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white">Bring your crew, stack extra $GANGSTER, and grow the hoodATM block.</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
          Pass your code to trusted crew members. Every recorded referral adds 0.1× to your whitelist-points multiplier with no referral limit. Qualified members also add 2.5% to player-robbery loot, capped at 25%.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8">
          <h2 className="text-2xl font-semibold text-white">How referrals work</h2>
          <ul className="mt-6 space-y-4 text-slate-300">
            <li className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
              <p className="font-semibold text-white">Pass the code</p>
              <p className="mt-2 text-sm text-slate-400">Send the crew code to people who are ready to run the block with you.</p>
            </li>
            <li className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
              <p className="font-semibold text-white">Crew rolls in</p>
              <p className="mt-2 text-sm text-slate-400">For a referred entry, the contract records 2.5% of the treasury deposit as the referral-pool allocation.</p>
            </li>
            <li className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
              <p className="font-semibold text-white">Multiply whitelist points</p>
              <p className="mt-2 text-sm text-slate-400">One referral gives 1.1× points, two give 1.2×, three give 1.3×, and the multiplier keeps growing by 0.1× with every referral.</p>
            </li>
            <li className="rounded-3xl border border-white/10 bg-slate-900/60 p-4">
              <p className="font-semibold text-white">Stack the robbery boost</p>
              <p className="mt-2 text-sm text-slate-400">Each qualified new member adds 2.5% to successful player-robbery loot. Ten successful invites reach the 25% maximum. Idle earnings and ATM jackpots are unchanged.</p>
            </li>
          </ul>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8">
          <h2 className="text-2xl font-semibold text-white">Referral bonus design</h2>
          <div className="mt-6 grid gap-4">
            {[
              { label: "Referral entry pool", value: "2.5% tracked from each referred entry" },
              { label: "Whitelist points", value: "+0.1× per referral · unlimited" },
              { label: "Per-member bonus", value: "+2.5% player-robbery loot" },
              { label: "Maximum bonus", value: "+25% robbery loot after 10 invites" },
              { label: "Hood effect", value: "More active hood power = more control over the hood treasury" },
              { label: "Cooldown safe", value: "Referral rewards do not affect the 6h ATM hit limit" },
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
                <p className="text-sm text-slate-400">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-cyan-300/20 bg-cyan-300/[0.05] p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">Robbery bonus ladder</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">The robbery bonus caps at 25%; the points multiplier does not.</h2>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-slate-300"><Landmark className="h-4 w-4 text-amber-200" /> 2.5% entry pool</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-slate-300"><TrendingUp className="h-4 w-4 text-lime-300" /> 25% robbery-loot cap</span>
          </div>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-10">
          {Array.from({ length: 10 }, (_, index) => {
            const invites = index + 1;
            return (
              <div key={invites} className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 text-center">
                <Users className="mx-auto h-4 w-4 text-cyan-200" />
                <p className="mt-2 text-xs uppercase tracking-[0.12em] text-slate-500">{invites} invite{invites === 1 ? "" : "s"}</p>
                <p className="mt-1 font-black text-lime-300">+{invites * 2.5}%</p>
              </div>
            );
          })}
        </div>
        <p className="mt-5 text-sm leading-6 text-slate-300">
          After referral 10, robbery loot stays capped at +25%. Whitelist points keep scaling:
          referral 11 gives 2.1×, referral 20 gives 3.0×, and there is no referral ceiling.
        </p>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Crew network</p>
            <h2 className="text-3xl font-semibold text-white">Claim your crew code</h2>
          </div>
          <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400">
            Back to the block
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6"><ReferralLinkCard /></div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-gradient-to-r from-fuchsia-500/10 to-cyan-500/10 p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Build the hood</p>
            <h2 className="text-3xl font-semibold text-white">Build the crew and let the block keep stacking.</h2>
          </div>
          <div className="text-sm text-slate-300">
            Referral rewards strengthen treasury control without changing the six-hour ATM robbery cooldown.
          </div>
        </div>
      </section>
    </div>
  );
}
