"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleDollarSign, Clock3, Coins, Flame, Play, ShieldCheck, Swords, TrendingUp, WalletCards } from "lucide-react";
import { AtmMachine } from "../components/atm-machine";
import { atmTargets, formatGangster, getAtmChance, useMockGang } from "../components/mock-gang-provider";
import { GangsterUsdAmount, useGangsterPrice } from "../components/gangster-price-provider";
import { PixelGangster } from "../components/pixel-gangster";

function elapsedLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600).toString().padStart(2, "0");
  const minutes = Math.floor((seconds % 3_600) / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return days > 0 ? `${days}d ${hours}:${minutes}:${remainingSeconds}` : `${hours}:${minutes}:${remainingSeconds}`;
}

function cooldownLabel(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function usdValue(tokens: number, gangsterUsd?: number) {
  if (!gangsterUsd) return "Live USD quote loading…";
  const value = tokens * gangsterUsd;
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  })}`;
}

export default function HustlePage() {
  const {
    currentPlayer,
    claimEarnings,
    withdrawBalance,
    lastClaim,
    atmCooldowns,
    robAtm,
    pendingAction,
    averageHeld24h,
    withdrawalGrossLimit,
    withdrawalEligible,
    withdrawalRestriction,
    withdrawalAvailableAt,
    dailyFarmPoolUsd,
    dailyBaseFarmPoolUsd,
    spendingFarmPoolUsd,
    effectivePowerShare,
    idleRewardPerHour,
    heatLevel,
    heatMultiplier,
    isHustling,
    hustleStartedAt,
    hustleAccumulatedMs,
    hustleStatePending,
    claimAvailableAt,
    claimTerms,
    atmPoolContributions,
    startHustling,
    layLow,
    transactionError,
  } = useMockGang();
  const { price } = useGangsterPrice();
  const [startingEarned] = useState(() => currentPlayer.earned);
  const [currentTime, setCurrentTime] = useState(0);

  const sessionEarned = Math.max(0, currentPlayer.earned - startingEarned);
  const withdrawalCooldown = withdrawalAvailableAt - currentTime;
  const withdrawalLocked = withdrawalAvailableAt > 0 && (currentTime === 0 || withdrawalCooldown > 0);
  const claimCooldown = claimAvailableAt - currentTime;
  const claimLocked = claimAvailableAt > 0 && (currentTime === 0 || claimCooldown > 0);
  const activeHustleMs = isHustling && hustleStartedAt > 0 && currentTime > 0
    ? Math.max(0, currentTime - hustleStartedAt)
    : 0;
  const totalHustleMs = hustleAccumulatedMs + activeHustleMs;
  const characterType = currentPlayer.rank === "Captain"
    ? "captain"
    : currentPlayer.rank === "General"
      ? "boss"
      : currentPlayer.rank === "OG"
        ? "legend"
        : "rookie";

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-lime-300/20 bg-[radial-gradient(circle_at_75%_15%,rgba(163,230,53,.14),transparent_28rem),rgba(8,11,9,.95)] p-7 sm:p-9">
        <div className="grid gap-9 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1.5 text-sm font-semibold text-lime-200">
              <TrendingUp className="h-4 w-4" /> Idle hustle
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">Put your power to work.</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-300">
              Start hustling to stack unclaimed $GANGSTER based on your crew&apos;s share of total block power. Lay low whenever you want to pause earnings, cool your heat, and stay protected from robberies.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void startHustling()}
                disabled={isHustling || hustleStatePending}
                className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-6 py-3 font-bold text-[#10130c] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play className="h-4 w-4" /> {hustleStatePending && !isHustling ? "Starting…" : isHustling ? "Hustling active" : "Start hustling"}
              </button>
              <button
                type="button"
                onClick={() => void claimEarnings()}
                disabled={currentPlayer.unclaimed <= 0 || claimLocked || pendingAction !== null}
                className="inline-flex items-center gap-2 rounded-full bg-lime-300 px-6 py-3 font-bold text-[#10130c] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Coins className="h-4 w-4" /> {pendingAction === "Claim"
                  ? "Claimingâ€¦"
                  : claimLocked
                    ? `Claim in ${cooldownLabel(claimCooldown)}`
                  : currentPlayer.unclaimed <= 0
                    ? "Nothing to claim"
                    : `Claim ${formatGangster(currentPlayer.unclaimed)}`}
              </button>
              <button
                type="button"
                onClick={() => void withdrawBalance()}
                disabled={!withdrawalEligible || withdrawalGrossLimit <= 0 || withdrawalLocked || pendingAction !== null}
                className="inline-flex items-center gap-2 rounded-full border border-lime-300/30 bg-lime-300/10 px-6 py-3 font-bold text-lime-100 transition hover:bg-lime-300/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <WalletCards className="h-4 w-4" /> {pendingAction === "Withdraw"
                  ? "Confirming withdrawal…"
                  : !withdrawalEligible
                    ? "Paid gangster required"
                  : withdrawalLocked
                    ? `Withdraw in ${cooldownLabel(withdrawalCooldown)}`
                    : withdrawalGrossLimit <= 0
                      ? "Nothing to withdraw"
                      : `Withdraw ${formatGangster(withdrawalGrossLimit)}`}
              </button>
              <Link href="/leaderboard" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-5 py-3 font-semibold text-white transition hover:bg-white/10">
                View balance <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => void layLow()}
                disabled={!isHustling || hustleStatePending}
                className="inline-flex items-center gap-2 rounded-full border border-red-300/25 bg-red-400/10 px-5 py-3 font-semibold text-red-100 transition hover:bg-red-400/15 disabled:opacity-45"
              >
                <Flame className="h-4 w-4" /> {hustleStatePending && isHustling ? "Laying low…" : "Lay low"}
              </button>
            </div>
            <div className="mt-4 max-w-2xl rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-6 text-slate-300">
              Claims are limited to once per hour and always burn 10%. The ATM-pool fee starts at 20%, falls by 2% per completed unclaimed hour, and reaches 0% at 10 hours. After 10 hours, the wait bonus rises by 2% per hour to a 20% cap at 20 hours. Withdrawals remain available every 12 hours and move the smaller of 50% of your claimed balance or 50% of your verified 24-hour average connected-wallet holding ({formatGangster(averageHeld24h)} $GANGSTER). {withdrawalRestriction}
            </div>
            <div className="mt-3 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-red-300/20 bg-red-400/[0.07] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Claim fee now</p>
                <p className="mt-1 text-xl font-black text-red-200">{claimTerms.feeBps / 100}%</p>
              </div>
              <div className="rounded-xl border border-lime-300/20 bg-lime-300/[0.07] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Wait bonus now</p>
                <p className="mt-1 text-xl font-black text-lime-200">+{claimTerms.bonusBps / 100}%</p>
              </div>
              <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.07] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Held unclaimed</p>
                <p className="mt-1 text-xl font-black text-amber-200">{claimTerms.heldHours}h</p>
              </div>
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Next claim</p>
                <p className="mt-1 text-xl font-black text-cyan-200">{claimLocked ? cooldownLabel(claimCooldown) : "Ready"}</p>
              </div>
            </div>
            {transactionError ? (
              <p className="mt-3 max-w-2xl rounded-xl border border-red-300/25 bg-red-400/10 px-4 py-3 text-sm font-semibold text-red-200">{transactionError}</p>
            ) : null}
          </div>

          <div className="relative flex min-h-[380px] items-center justify-center rounded-[1.75rem] border border-lime-300/35 bg-black/40 p-6 shadow-[0_0_55px_rgba(163,230,53,.16)]">
            <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-lime-300/30 bg-lime-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-lime-200">
              <span className={`h-2 w-2 rounded-full ${isHustling ? "animate-pulse bg-lime-300" : "bg-orange-300"}`} />
              {isHustling ? "Hustle active" : "Laying low"}
            </div>
            <div className="relative flex flex-col items-center">
              <div className={`rounded-[2rem] border p-3 shadow-2xl ${isHustling ? "border-lime-300/35 bg-lime-300/10 animate-atm-glow" : "border-orange-300/25 bg-orange-300/[0.07]"}`}>
                <PixelGangster type={characterType} className="h-72 w-full max-w-[250px] drop-shadow-[0_0_24px_rgba(163,230,53,.25)]" />
              </div>
              <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-white">{currentPlayer.rank}</p>
            </div>
            <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/10 bg-black/65 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div><p className="text-xs uppercase tracking-[0.16em] text-slate-500">This session</p><p className="mt-1 text-2xl font-black text-lime-300">+{formatGangster(sessionEarned)}</p></div>
                <div className="text-right"><p className="text-xs uppercase tracking-[0.16em] text-slate-500">Hustling for</p><p className="mt-1 font-mono text-2xl font-black text-amber-200">{elapsedLabel(totalHustleMs)}</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {lastClaim && (
        <section className="grid gap-3 rounded-2xl border border-lime-300/20 bg-lime-300/[0.06] p-4 sm:grid-cols-2 xl:grid-cols-5">
          <p className="text-sm text-slate-400">Claimed <span className="ml-2 font-bold text-white">{formatGangster(lastClaim.gross)}</span></p>
          <p className="text-sm text-slate-400">Burned 10% <span className="ml-2 font-bold text-red-300">{formatGangster(lastClaim.burned)}</span></p>
          <p className="text-sm text-slate-400">ATM fee {lastClaim.feeBps / 100}% <span className="ml-2 font-bold text-amber-200">{formatGangster(lastClaim.fee)}</span></p>
          <p className="text-sm text-slate-400">Wait bonus {lastClaim.bonusBps / 100}% <span className="ml-2 font-bold text-cyan-200">+{formatGangster(lastClaim.bonus)}</span></p>
          <p className="text-sm text-slate-400">Added to game wallet <span className="ml-2 font-bold text-lime-300">{formatGangster(lastClaim.received)}</span></p>
        </section>
      )}

      <section className="rounded-[2rem] border border-amber-300/20 bg-amber-300/[0.05] p-6">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-200">Claim-funded ATM pools</p>
        <p className="mt-3 max-w-4xl leading-7 text-slate-300">
          Every dynamic claim fee is routed to the four ATM pools using the 1:2:4:18 distribution.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {["Corner Store ATM", "Nightclub ATM", "Casino Floor ATM", "Downtown Vault ATM"].map((name, index) => (
            <div key={name} className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{name}</p>
              <p className="mt-2 text-lg font-black text-amber-100">{formatGangster(atmPoolContributions[index])}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { icon: ShieldCheck, label: "Crew power", value: String(currentPlayer.power), color: "text-cyan-200" },
          {
            icon: CircleDollarSign,
            label: "Farm-pool share",
            value: `${(effectivePowerShare * 100).toFixed(2)}%`,
            subvalue: `$${dailyFarmPoolUsd.toFixed(2)}/day · $${dailyBaseFarmPoolUsd.toFixed(2)} base + $${spendingFarmPoolUsd.toFixed(2)} recycled`,
            color: "text-amber-200",
          },
          { icon: Coins, label: "Earning rate per hour", value: `${formatGangster(idleRewardPerHour)}/hr`, subvalue: `${usdValue(idleRewardPerHour, price?.gangsterUsd)}/hr`, color: "text-lime-300" },
          { icon: Clock3, label: "Unclaimed balance", value: formatGangster(currentPlayer.unclaimed), subvalue: usdValue(currentPlayer.unclaimed, price?.gangsterUsd), color: "text-red-200" },
          { icon: Flame, label: "Heat", value: `${heatLevel}%`, subvalue: `${Math.round(heatMultiplier * 100)}% hustling power`, color: heatLevel >= 75 ? "text-red-300" : "text-orange-200" },
        ].map((item) => (
          <div key={item.label} className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
            <item.icon className={`h-5 w-5 ${item.color}`} />
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.17em] text-slate-500">{item.label}</p>
            <p className={`mt-2 text-3xl font-black ${item.color}`}>{item.value}</p>
            {"subvalue" in item && item.subvalue ? <p className="mt-2 text-sm font-semibold text-slate-400">{item.subvalue}</p> : null}
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-orange-300/20 bg-orange-300/[0.05] p-6">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-200">Heat system</p>
        <p className="mt-3 max-w-4xl leading-7 text-slate-300">
          Heat rises by 1% every minute you hustle. For every 3% heat, your idle earning rate drops by 1%. Laying low pauses idle earnings and cools heat by 1% per minute. Press Start hustling when you&apos;re ready to get back to work.
        </p>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {[
          { step: "01", title: "Start hustling", text: "Put your current crew power to work and begin the persistent hustle clock." },
          { step: "02", title: "Build exposure", text: "Idle rewards land in your unclaimed balance and remain visible to robbers." },
          { step: "03", title: "Claim or risk it", text: "Claim hourly with the 10% burn and current fee, or keep exposed earnings unclaimed long enough to eliminate the fee and build up to a 20% wait bonus." },
        ].map((item) => (
          <article key={item.step} className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-6">
            <p className="text-sm font-black text-amber-200">{item.step}</p>
            <h2 className="mt-4 text-xl font-semibold text-white">{item.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-400">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-amber-300/20 bg-[radial-gradient(circle_at_85%_15%,rgba(245,158,11,.12),transparent_28rem),rgba(8,11,9,.95)] p-7 sm:p-9">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
              <Swords className="h-4 w-4" /> ATM robbery board
            </div>
            <h2 className="mt-4 text-3xl font-black text-white">Pick a machine. Risk your stack.</h2>
            <p className="mt-3 leading-7 text-slate-300">
              Higher-tier ATMs carry bigger jackpots and lower success odds. A failed hit burns the listed risk, and every machine locks for six hours after an attempt.
            </p>
          </div>
          <Link href="/activity" className="inline-flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-cyan-100">
            View robbery receipts <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {atmTargets.map((atm, atmIndex) => {
            const cooldownRemaining = (atmCooldowns[atm.id] ?? 0) - currentTime;
            const coolingDown = currentTime !== 0 && cooldownRemaining > 0;
            const liveLoss = price ? atm.lossUsd / price.gangsterUsd : Number.POSITIVE_INFINITY;
            const cannotCoverRisk = currentPlayer.unclaimed < liveLoss;
            const realChance = getAtmChance(currentPlayer.power, atmIndex);

            return (
              <article key={atm.id} className="rounded-[1.75rem] border border-white/10 bg-slate-950/75 p-5">
                <AtmMachine tier={atm.tier} className="mx-auto h-44 w-full max-w-[180px] animate-atm-glow" />
                <h3 className="mt-3 text-lg font-bold text-white">{atm.name}</h3>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-black/35 p-3"><p className="text-slate-500">Your real chance</p><p className="mt-1 font-black text-amber-200">{realChance.toFixed(realChance < 0.1 ? 4 : 2)}%</p></div>
                  <div className="rounded-xl bg-black/35 p-3"><p className="text-slate-500">Jackpot</p><p className="mt-1 font-black text-lime-300"><GangsterUsdAmount usd={atm.rewardUsd} prefix="+" /></p></div>
                  <div className="col-span-2 rounded-xl bg-black/35 p-3"><p className="text-slate-500">Failed-hit burn</p><p className="mt-1 font-black text-red-300"><GangsterUsdAmount usd={atm.lossUsd} prefix="−" /></p></div>
                </div>
                <button
                  type="button"
                  onClick={() => robAtm(atm.id)}
                  disabled={coolingDown || cannotCoverRisk || pendingAction !== null}
                  className="mt-4 w-full rounded-full bg-amber-300 px-4 py-3 text-sm font-black text-[#10130c] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
                >
                  {pendingAction === "ATM hit" ? "Confirming hit…" : coolingDown ? `Lay low ${cooldownLabel(cooldownRemaining)}` : cannotCoverRisk ? "Not enough unclaimed" : "Rob this ATM"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <p className="text-center text-sm text-slate-500">The daily base farm is deterministically set between $5 and $10. It grows whenever $GANGSTER is spent because 25% of every gameplay payment is recycled into earnings, then the total dilutes across active network power.</p>
    </div>
  );
}
