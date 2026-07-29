"use client";

import Link from "next/link";
import { ArrowRight, Coins, Crown, Flame, ShieldCheck, Trophy, WalletCards } from "lucide-react";
import { formatGangster, useMockGang } from "../components/mock-gang-provider";

export default function LeaderboardPage() {
  const { players, currentPlayer, burnedTotal, lastWithdrawal, withdrawBalance, pendingAction, withdrawalGrossLimit, averageHeld24h } = useMockGang();
  const rankedPlayers = [...players].sort((a, b) => b.earned - a.earned);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-amber-300/20 bg-[radial-gradient(circle_at_10%_10%,rgba(234,179,8,.15),transparent_25rem),rgba(8,11,9,.94)] p-7 sm:p-9">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-300/10 px-3 py-1.5 text-sm font-semibold text-amber-100">
              <Trophy className="h-4 w-4" /> Gang leaderboard
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">See who is stacking the block.</h1>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              Rankings track total $GANGSTER earned from farming, jackpots, and successful robberies. Unclaimed balances stay exposed until they are claimed.
            </p>
          </div>
          <Link href="/rob" className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-red-600 via-amber-400 to-lime-300 px-5 py-3 font-bold text-[#10130c] transition hover:brightness-110">
            Enter robbery floor <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="rounded-[2rem] border border-amber-200/30 bg-[linear-gradient(120deg,rgba(251,191,36,.14),rgba(168,85,247,.09))] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-200">Season winner reward</p>
            <h2 className="mt-2 text-3xl font-black text-white">First place wins an OG gangster.</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              The top confirmed earner at the season close receives an OG gangster for their active roster. An open slot is required to activate it.
            </p>
          </div>
          <Crown className="h-12 w-12 shrink-0 text-amber-200" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: Coins, label: "Your total earned", value: formatGangster(currentPlayer.earned), accent: "text-amber-200" },
          { icon: WalletCards, label: "Your unclaimed", value: formatGangster(currentPlayer.unclaimed), accent: "text-lime-300" },
          { icon: ShieldCheck, label: "Your power", value: String(currentPlayer.power), accent: "text-cyan-200" },
          { icon: Flame, label: "Burned in this session", value: formatGangster(burnedTotal), accent: "text-red-300" },
        ].map((item) => (
          <div key={item.label} className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
            <item.icon className={`h-5 w-5 ${item.accent}`} />
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.17em] text-slate-500">{item.label}</p>
            <p className={`mt-2 text-3xl font-black ${item.accent}`}>{item.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[2rem] border border-lime-300/20 bg-lime-300/[0.06] p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-lime-200">Secure your stack</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Withdraw up to {formatGangster(withdrawalGrossLimit)} $GANGSTER</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Available every 12 hours. The amount is the smaller of half your claimed in-game balance and half your verified 24-hour average connected-wallet holding ({formatGangster(averageHeld24h)}).</p>
          </div>
          <button
            type="button"
            onClick={() => void withdrawBalance()}
            disabled={withdrawalGrossLimit <= 0 || pendingAction !== null}
            className="shrink-0 rounded-full bg-lime-300 px-5 py-3 font-bold text-[#10130c] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pendingAction === "Withdraw" ? "Confirming withdrawal…" : "Withdraw"}
          </button>
        </div>
        {lastWithdrawal && (
          <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 sm:grid-cols-2">
            <p className="text-sm text-slate-400">Withdrawn <span className="ml-2 font-bold text-white">{formatGangster(lastWithdrawal.gross)}</span></p>
            <p className="text-sm text-slate-400">Sent to connected wallet <span className="ml-2 font-bold text-lime-300">{formatGangster(lastWithdrawal.received)}</span></p>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70">
        <div className="border-b border-white/10 px-6 py-5 sm:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-amber-200">Top earners</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-left">
            <thead className="bg-black/25 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-6 py-4 sm:px-8">#</th>
                <th className="px-4 py-4">Gang member</th>
                <th className="px-4 py-4">Rank</th>
                <th className="px-4 py-4">Power</th>
                <th className="px-4 py-4">Total earned</th>
                <th className="px-4 py-4">Unclaimed / exposed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rankedPlayers.map((player, index) => (
                <tr key={player.id} className={player.id === currentPlayer.id ? "bg-lime-300/[0.06]" : "hover:bg-white/[0.025]"}>
                  <td className="px-6 py-5 font-black text-amber-200 sm:px-8">
                    <span className="inline-flex items-center gap-2">
                      {index === 0 ? <Crown className="h-4 w-4" /> : null}
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-4 py-5">
                    <p className="font-semibold text-white">{player.name}{player.id === currentPlayer.id ? " (You)" : ""}</p>
                    <p className="text-sm text-slate-500">{player.handle}</p>
                  </td>
                  <td className="px-4 py-5 text-slate-300">{player.rank}</td>
                  <td className="px-4 py-5 font-semibold text-cyan-200">{player.power}</td>
                  <td className="px-4 py-5 font-bold text-white">{formatGangster(player.earned)} <span className="text-xs text-slate-500">$GANGSTER</span></td>
                  <td className="px-4 py-5 font-bold text-lime-300">{formatGangster(player.unclaimed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-center text-sm text-slate-500">Rankings update from confirmed game activity.</p>
    </div>
  );
}
