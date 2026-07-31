"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, Crown, Gavel, Shield, ShieldCheck, Users } from "lucide-react";
import { formatGangster, useMockGang, type GangRank } from "../components/mock-gang-provider";

const gangRanks: GangRank[] = ["Boss", "Underboss", "Enforcer", "Member"];
const gameLive = process.env.NEXT_PUBLIC_GAME_LIVE === "true";

function remainingJailTime(milliseconds: number) {
  const minutes = Math.max(1, Math.ceil(milliseconds / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function GangPage() {
  const {
    players,
    currentPlayer,
    qualifiedReferrals,
    gang,
    gangCreationCostTokens,
    gangCreationFree,
    gangJailbreakCostTokens,
    jailedUntil,
    lastGangJailbreak,
    createGang,
    updateGangRank,
    attemptGangJailbreak,
  } = useMockGang();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const members = useMemo(() => {
    if (!gang) return [];
    return gang.members.flatMap((membership) => {
      const player = players.find((candidate) => candidate.id === membership.playerId);
      return player ? [{ ...membership, player }] : [];
    });
  }, [gang, players]);

  const jailedMembers = members.filter(({ playerId }) => (
    currentTime > 0 && (jailedUntil[playerId] ?? 0) > currentTime
  ));
  const canPayCreation = gangCreationFree || (
    gangCreationCostTokens > 0 && currentPlayer.claimed >= gangCreationCostTokens
  );
  const validGang = name.trim().length >= 3 && tag.length >= 2;

  function submitGang() {
    if (gameLive) {
      setStatus("Gang HQ is coming online — create / invite / jailbreak land with the next GangSystem wire-up.");
      return;
    }
    setStatus("");
    if (!createGang(name, tag)) {
      setStatus("A valid name, 2–5 character tag, and enough $GANGSTER are required.");
      return;
    }
    setStatus("Gang claimed. Your member roster and rank controls are active.");
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-violet-300/20 bg-[radial-gradient(circle_at_82%_10%,rgba(139,92,246,.17),transparent_28rem),rgba(8,11,9,.95)] p-7 sm:p-9">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-violet-400/10 px-3 py-1.5 text-sm font-bold text-violet-100">
              <Shield className="h-4 w-4" /> Gang headquarters
            </div>
            <h1 className="mt-5 text-4xl font-black text-white sm:text-5xl">Build a crew that controls the block.</h1>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              Create a gang for the live equivalent of $10 in $GANGSTER, or earn the charter free after three qualified referrals. Gang bosses manage member ranks and can fund same-gang jail breaks.
            </p>
          </div>
          <div className="grid min-w-[290px] grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Qualified referrals</p>
              <p className="mt-2 text-2xl font-black text-cyan-200">{qualifiedReferrals}/3</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Gang members</p>
              <p className="mt-2 text-2xl font-black text-violet-200">{members.length}</p>
            </div>
          </div>
        </div>
      </section>

      {gameLive ? (
        <section className="rounded-[2rem] border border-amber-300/30 bg-amber-300/[0.08] p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-sm font-bold text-amber-100">
                <Clock3 className="h-4 w-4" /> Coming online
              </div>
              <h2 className="mt-4 text-3xl font-black text-white">Gang HQ lands next.</h2>
              <p className="mt-3 leading-7 text-slate-300">
                Season 1 is live for hustle, claim, ATM hits, and referrals. Create / invite / jailbreak need the GangSystem wire-up before we flip these switches — so the CTAs stay gated instead of erroring out.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/referral" className="inline-flex items-center gap-2 rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-[#10130c]">
                <Users className="h-4 w-4" /> Grow via referrals
              </Link>
              <Link href="/hustle" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/35 px-5 py-3 text-sm font-bold text-white">
                Back to hustle
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {!gameLive && !gang ? (
        <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-200">Claim a gang charter</p>
            <h2 className="mt-2 text-3xl font-black text-white">Name your crew.</h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-[1fr_180px]">
              <label className="text-sm text-slate-300">
                Gang name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value.slice(0, 28))}
                  placeholder="Enter gang name"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-violet-300/40"
                />
              </label>
              <label className="text-sm text-slate-300">
                Tag
                <input
                  value={tag}
                  onChange={(event) => setTag(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
                  placeholder="2–5 chars"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-4 py-3 font-mono uppercase text-white outline-none focus:border-violet-300/40"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={submitGang}
              disabled={!validGang || !canPayCreation}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Crown className="h-4 w-4" />
              {gangCreationFree ? "Claim gang for free" : `Create for ${formatGangster(gangCreationCostTokens)} $GANGSTER`}
            </button>
            {status ? <p className="mt-3 text-sm text-amber-200">{status}</p> : null}
          </div>

          <div className="rounded-[2rem] border border-lime-300/20 bg-lime-300/[0.05] p-6 sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-lime-200">Two ways in</p>
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <p className="font-black text-white">Pay the charter</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">Spend the live equivalent of $10: {formatGangster(gangCreationCostTokens)} $GANGSTER at the current token price.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <p className="font-black text-white">Recruit three members</p>
                <p className="mt-2 text-sm leading-6 text-slate-400">Three qualified referrals waive the entire gang-creation payment.</p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {!gameLive && gang ? (
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70">
          <div className="flex flex-col gap-4 border-b border-white/10 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="font-mono text-sm font-black text-violet-200">[{gang.tag}]</p>
              <h2 className="mt-1 text-3xl font-black text-white">{gang.name}</h2>
            </div>
            <p className="text-sm text-slate-400">Only the gang owner can assign ranks.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-black/25 text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-6 py-4 sm:px-8">Member</th>
                  <th className="px-4 py-4">Gang rank</th>
                  <th className="px-4 py-4">Power</th>
                  <th className="px-4 py-4">Game tier</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {members.map(({ player, playerId, rank }) => {
                  const jailed = currentTime > 0 && (jailedUntil[playerId] ?? 0) > currentTime;
                  return (
                    <tr key={playerId}>
                      <td className="px-6 py-5 sm:px-8">
                        <p className="font-bold text-white">{player.name}</p>
                        <p className="mt-1 text-sm text-slate-500">{player.handle}</p>
                      </td>
                      <td className="px-4 py-5">
                        <select
                          value={rank}
                          onChange={(event) => updateGangRank(playerId, event.target.value as GangRank)}
                          className="rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-sm text-white"
                          aria-label={`Gang rank for ${player.name}`}
                        >
                          {gangRanks.map((gangRank) => <option key={gangRank} value={gangRank}>{gangRank}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-5 font-bold text-cyan-200">{player.power}</td>
                      <td className="px-4 py-5 text-slate-300">{player.rank}</td>
                      <td className="px-6 py-5">
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${jailed ? "bg-red-400/10 text-red-200" : "bg-lime-300/10 text-lime-200"}`}>
                          {jailed ? `Jailed · ${remainingJailTime((jailedUntil[playerId] ?? 0) - currentTime)}` : "On the block"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!gameLive ? (
        <section className="rounded-[2rem] border border-red-300/20 bg-red-400/[0.05] p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-red-200">
                <Gavel className="h-4 w-4" /> Gang jail break
              </div>
              <h2 className="mt-3 text-3xl font-black text-white">Get your people back on the block.</h2>
              <p className="mt-3 leading-7 text-slate-300">
                Pay the live equivalent of $2 ({formatGangster(gangJailbreakCostTokens)} $GANGSTER) for a 25% chance to release a jailed member. The attempt is only available when both players belong to the same gang, and the payment is spent whether it succeeds or fails.
              </p>
            </div>
            <ShieldCheck className="h-10 w-10 text-red-200" />
          </div>

          <div className="mt-6 space-y-3">
            {!gang ? (
              <p className="rounded-2xl border border-white/10 bg-black/25 p-5 text-sm text-slate-400">Create or join a gang before you can fund a member’s release.</p>
            ) : jailedMembers.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-black/25 p-5 text-sm text-slate-400">No members of your gang are currently behind bars.</p>
            ) : jailedMembers.map(({ player, playerId }) => (
              <div key={playerId} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/25 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-white">{player.name}</p>
                  <p className="mt-1 text-sm text-slate-400">Release chance: 25% · same gang verified</p>
                </div>
                <button
                  type="button"
                  onClick={() => attemptGangJailbreak(playerId)}
                  disabled={currentPlayer.claimed < gangJailbreakCostTokens}
                  className="rounded-xl bg-red-300 px-5 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Pay {formatGangster(gangJailbreakCostTokens)} $GANGSTER
                </button>
              </div>
            ))}
          </div>
          {lastGangJailbreak ? (
            <p className={`mt-4 rounded-2xl border p-4 font-semibold ${lastGangJailbreak.freed ? "border-lime-300/25 bg-lime-300/10 text-lime-200" : "border-red-300/25 bg-red-400/10 text-red-200"}`}>
              {lastGangJailbreak.freed
                ? `${lastGangJailbreak.memberName} is free. The 25% release roll succeeded.`
                : `${lastGangJailbreak.memberName} remains jailed. The payment was spent.`}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
