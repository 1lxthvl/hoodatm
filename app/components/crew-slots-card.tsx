"use client";

import { Check, LockKeyhole, Users } from "lucide-react";
import { formatGangster, useMockGang } from "./mock-gang-provider";

export function CrewSlotsCard() {
  const {
    activeGangsters,
    crewActive,
    currentPlayer,
    gangsterSlots,
    nextGangsterSlotCostTokens,
    nextGangsterSlotCostUsd,
    slotUnlockError,
    unlockGangsterSlot,
  } = useMockGang();
  const canUnlock =
    nextGangsterSlotCostTokens > 0
    && currentPlayer.claimed >= nextGangsterSlotCostTokens;

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_12%_20%,rgba(34,211,238,.12),transparent_24rem),rgba(2,6,23,.7)] p-6 sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-cyan-200">
            <Users className="h-4 w-4" /> Active gangster slots
          </div>
          <h2 className="mt-3 text-3xl font-black text-white">
            {crewActive ? "Your crew is active." : `${gangsterSlots} active slot${gangsterSlots === 1 ? "" : "s"}.`}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            Every account starts with one active gangster slot. The second costs $10 in
            $GANGSTER, and every later slot doubles: $20, $40, $80, and onward. Three
            unlocked slots officially make a Crew.
          </p>
        </div>
        <div className="min-w-[260px] rounded-2xl border border-white/10 bg-black/35 p-5">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-slate-500">
            Next slot
          </p>
          <p className="mt-2 text-2xl font-black text-cyan-200">
            {formatGangster(nextGangsterSlotCostTokens)} $GANGSTER
          </p>
          <p className="mt-1 text-sm text-slate-400">${nextGangsterSlotCostUsd.toLocaleString()} live equivalent</p>
          <button
            type="button"
            onClick={() => void unlockGangsterSlot()}
            disabled={!canUnlock}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LockKeyhole className="h-4 w-4" /> Unlock slot {gangsterSlots + 1}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {Array.from({ length: Math.max(3, gangsterSlots) }, (_, index) => {
          const gangster = activeGangsters[index];
          const unlocked = index < gangsterSlots;
          return (
            <div
              key={index}
              className={`rounded-2xl border p-4 ${
                unlocked
                  ? "border-cyan-300/20 bg-cyan-300/[0.06]"
                  : "border-white/10 bg-black/25"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Slot {index + 1}
              </p>
              <p className={`mt-2 font-black ${unlocked ? "text-white" : "text-slate-600"}`}>
                {gangster ? `${gangster.character} · ${gangster.earningRate}% rate` : unlocked ? "Ready for a gangster" : "Locked"}
              </p>
              {index === 2 ? (
                <p className={`mt-2 inline-flex items-center gap-1 text-xs font-bold ${crewActive ? "text-lime-200" : "text-slate-500"}`}>
                  <Check className="h-3.5 w-3.5" /> Crew milestone
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {slotUnlockError ? <p className="mt-4 text-sm font-semibold text-amber-200">{slotUnlockError}</p> : null}
    </section>
  );
}
