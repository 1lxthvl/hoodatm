"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock3, Crosshair, Gavel, Share2, ShieldAlert, Siren, Swords, Target, Users, WalletCards } from "lucide-react";
import { formatGangster, getRobProfile, useMockGang } from "../components/mock-gang-provider";

function cooldownLabel(until: number, now: number) {
  const remaining = Math.max(0, until - now);
  if (!remaining) return null;
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.ceil((remaining % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export default function RobPage() {
  const [currentTime, setCurrentTime] = useState(0);
  const {
    players,
    currentPlayer,
    qualifiedReferrals,
    robberyBonusRate,
    cooldowns,
    lastRob,
    robPlayer,
    pendingAction,
    snitchOpportunity,
    lastSnitch,
    snitchCostTokens,
    snitch,
    jailedUntil,
    claimLockedUntil,
  } = useMockGang();
  const targets = players.filter((player) => player.id !== currentPlayer.id);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-red-400/20 bg-[radial-gradient(circle_at_80%_10%,rgba(220,38,38,.18),transparent_28rem),rgba(8,11,9,.94)] p-7 sm:p-9">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-200">
              <Swords className="h-4 w-4" /> Robbery floor
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">Pick the right mark or pay for it.</h1>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              Rob unclaimed $GANGSTER from rival gang members. Each target can only be attacked once every six hours, whether the hit succeeds or fails.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/45 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Your power</p>
              <p className="mt-2 text-2xl font-bold text-amber-200">{currentPlayer.power}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/45 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Unclaimed</p>
              <p className="mt-2 text-2xl font-bold text-lime-300">{formatGangster(currentPlayer.unclaimed)}</p>
            </div>
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-100/70">Referral loot bonus</p>
              <p className="mt-2 text-2xl font-bold text-cyan-200">+{robberyBonusRate * 100}%</p>
              <p className="mt-1 text-xs text-cyan-100/50">{qualifiedReferrals}/10 members</p>
            </div>
          </div>
        </div>
      </section>

      {lastRob && (
        <section className={`rounded-2xl border p-5 ${lastRob.won ? "border-lime-300/30 bg-lime-300/10" : "border-red-400/30 bg-red-500/10"}`}>
          <p className={`font-bold ${lastRob.won ? "text-lime-200" : "text-red-200"}`}>
            {lastRob.won
              ? `Hit landed: you took ${formatGangster(lastRob.amount)} $GANGSTER from ${lastRob.target}, including a ${formatGangster(lastRob.bonusAmount)} referral bonus.`
              : `Hit failed: ${formatGangster(lastRob.amount)} $GANGSTER moved to ${lastRob.target}.`}
          </p>
          <p className="mt-1 text-sm text-slate-300">The roll used a {lastRob.chance}% success chance. This target is now on a six-hour cooldown.</p>
        </section>
      )}

      <section className="rounded-[2rem] border border-blue-300/20 bg-[radial-gradient(circle_at_90%_10%,rgba(59,130,246,.14),transparent_24rem),rgba(8,11,9,.94)] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1.5 text-sm font-bold text-blue-100">
              <Siren className="h-4 w-4" /> Snitch retaliation
            </div>
            <h2 className="mt-4 text-3xl font-black text-white">Put a stronger robber behind bars.</h2>
            <p className="mt-3 leading-7 text-slate-300">
              If a stronger player successfully takes your loot, you get one 24-hour chance to pay the live equivalent of $1 in $GANGSTER and snitch. The roll has a 5% chance to disable their idle earnings for 3 hours.
            </p>
          </div>
          {snitchOpportunity ? (
            <div className="min-w-[280px] rounded-2xl border border-blue-300/20 bg-black/35 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Open case</p>
              <p className="mt-2 text-lg font-black text-white">{snitchOpportunity.attacker}</p>
              <p className="mt-1 text-sm text-slate-400">Power {snitchOpportunity.attackerPower} · stole {formatGangster(snitchOpportunity.loot)}</p>
              <button
                type="button"
                onClick={snitch}
                disabled={snitchCostTokens <= 0 || currentPlayer.claimed < snitchCostTokens}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-40"
              >
                <Gavel className="h-4 w-4" /> Snitch for {formatGangster(snitchCostTokens)} $GANGSTER
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-sm text-slate-400">No eligible stronger attacker.</div>
          )}
        </div>
        {lastSnitch ? (
          <p className={`mt-5 rounded-2xl border p-4 font-semibold ${lastSnitch.jailed ? "border-lime-300/25 bg-lime-300/10 text-lime-200" : "border-red-300/25 bg-red-400/10 text-red-200"}`}>
            {lastSnitch.jailed
              ? `${lastSnitch.attacker} is behind bars for 3 hours. Their idle earnings are disabled.`
              : `The 5% roll missed. ${lastSnitch.attacker} stayed out, and the snitch payment was spent.`}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Target, title: "Equal power", value: "50 / 50", text: "Balanced risk and balanced transfer." },
          { icon: Crosshair, title: "Stronger target", value: "10–25%", text: "Harder hit, larger share of available loot." },
          { icon: ShieldAlert, title: "Weaker target", value: "Bad value", text: "Small loot; failure costs 20–25% of your stack." },
        ].map((rule) => (
          <div key={rule.title} className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
            <rule.icon className="h-5 w-5 text-amber-200" />
            <p className="mt-4 text-sm font-semibold text-white">{rule.title}</p>
            <p className="mt-1 text-2xl font-black text-white">{rule.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">{rule.text}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 sm:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-red-200">Available marks</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">Choose a rival</h2>
          </div>
          <p className="hidden text-sm text-slate-400 sm:block">Balances update after confirmed transactions.</p>
        </div>

        <div className="mt-7 grid gap-4 lg:grid-cols-2">
          {targets.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-red-300/25 bg-red-400/[0.05] p-8 text-center lg:col-span-2">
              <Users className="mx-auto h-8 w-8 text-red-200" />
              <p className="mt-4 text-xl font-black text-white">Empty block — bring a rival.</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
                Robberies need exposed players. Share your crew link, drop a character code, or pull a friend into Season 1 so the floor fills up.
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <Link href="/referral" className="inline-flex items-center gap-2 rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-[#10130c]">
                  <Share2 className="h-4 w-4" /> Share referral link
                </Link>
                <Link href="/game" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-5 py-3 text-sm font-bold text-white">
                  Claim character code
                </Link>
              </div>
            </div>
          ) : null}
          {targets.map((target) => {
            const profile = getRobProfile(currentPlayer.power, target.power);
            const cooldown = cooldownLabel(cooldowns[target.id] ?? 0, currentTime);
            const estimatedBaseWin = Math.max(1, Math.floor(target.unclaimed * profile.stealRate));
            const estimatedBonus = Math.floor(estimatedBaseWin * robberyBonusRate);
            const estimatedWin = estimatedBaseWin + estimatedBonus;
            const estimatedLoss = Math.max(1, Math.floor(currentPlayer.unclaimed * profile.lossRate));
            const disabled = Boolean(cooldown) || target.unclaimed <= 0 || currentPlayer.unclaimed <= 0 || pendingAction !== null;
            const jailed = currentTime > 0 && (jailedUntil[target.id] ?? 0) > currentTime;
            const claimLocked = currentTime > 0 && (claimLockedUntil[target.id] ?? 0) > currentTime;

            return (
              <article key={target.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold text-white">{target.name}</p>
                    <p className="text-sm text-slate-500">{target.handle} · {target.rank}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {jailed ? <span className="rounded-full bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-200">Behind bars · idle off</span> : null}
                    {claimLocked ? <span className="rounded-full bg-fuchsia-400/10 px-3 py-1 text-xs font-bold text-fuchsia-200">Loot claim locked 30m</span> : null}
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${profile.chance >= 50 ? "bg-amber-300/10 text-amber-200" : "bg-red-500/10 text-red-200"}`}>{profile.chance}% hit</span>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl bg-black/35 p-3"><p className="text-slate-500">Power</p><p className="mt-1 font-bold text-white">{target.power}</p></div>
                  <div className="rounded-xl bg-black/35 p-3"><p className="text-slate-500">Balance</p><p className="mt-1 font-bold text-lime-300">{formatGangster(target.unclaimed)}</p></div>
                  <div className="rounded-xl bg-black/35 p-3"><p className="text-slate-500">Class</p><p className="mt-1 font-bold text-white">{profile.label}</p></div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-400">{profile.note}</p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
                  <span className="text-lime-300">Win ≈ +{formatGangster(estimatedWin)} ({formatGangster(estimatedBonus)} referral bonus)</span>
                  <span className="text-red-300">Lose ≈ −{formatGangster(estimatedLoss)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => robPlayer(target.id)}
                  disabled={disabled}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm font-bold uppercase tracking-[0.14em] text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {pendingAction === "Player robbery" ? "Confirming on-chain…" : cooldown ? <><Clock3 className="h-4 w-4" /> {cooldown}</> : <><WalletCards className="h-4 w-4" /> Rob {target.handle} on-chain</>}
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
