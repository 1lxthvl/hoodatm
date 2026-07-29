"use client";

import { useEffect, useState } from "react";
import { Clock3, Crosshair, PackageCheck, PackageX, Phone, PhoneCall, ShieldAlert } from "lucide-react";
import { formatGangster, useMockGang } from "../components/mock-gang-provider";

function jailTime(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${remainingSeconds}`;
}

export default function JailPage() {
  const {
    currentPlayer,
    jailedUntil,
    jailPhones,
    jailPhoneCostTokens,
    lastJailPurchase,
    buyJailPhone,
    phoneHitOpportunity,
    lastPhoneHit,
    callGangMember,
  } = useMockGang();
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const remaining = (jailedUntil[currentPlayer.id] ?? 0) - currentTime;
  const jailed = currentTime > 0 && remaining > 0;
  const elapsedHitMinutes = phoneHitOpportunity
    ? Math.floor((currentTime - phoneHitOpportunity.occurredAt) / 60_000)
    : 0;
  const recoveryRatio = Math.max(0, 80 * (1 - Math.max(0, elapsedHitMinutes) / 60));

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-blue-300/20 bg-[radial-gradient(circle_at_85%_10%,rgba(59,130,246,.16),transparent_28rem),rgba(8,11,9,.95)] p-7 sm:p-9">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-400/10 px-3 py-1.5 text-sm font-bold text-blue-100">
              <ShieldAlert className="h-4 w-4" /> County lockup
            </div>
            <h1 className="mt-5 text-4xl font-black text-white sm:text-5xl">Behind bars. Off the block.</h1>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              A successful snitch roll disables idle earnings for 3 hours. Jail-shop purchases remain available, but every smuggling attempt is final and paid in $GANGSTER.
            </p>
          </div>
          <div className={`min-w-[260px] rounded-2xl border p-5 ${jailed ? "border-red-300/25 bg-red-400/10" : "border-lime-300/25 bg-lime-300/10"}`}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Your status</p>
            <p className={`mt-2 text-2xl font-black ${jailed ? "text-red-200" : "text-lime-200"}`}>{jailed ? "Behind bars" : "Free"}</p>
            <p className="mt-2 flex items-center gap-2 font-mono text-white"><Clock3 className="h-4 w-4" />{jailed ? jailTime(remaining) : "00:00:00"}</p>
            <p className="mt-2 text-xs text-slate-400">{jailed ? "Idle earnings disabled" : "Idle earnings eligible"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-200">Jail shop</p>
            <h2 className="mt-2 text-3xl font-black text-white">Smuggle something useful.</h2>
          </div>
          <p className="text-sm text-slate-400">Inventory: {jailPhones} phone{jailPhones === 1 ? "" : "s"}</p>
        </div>

        <article className="mt-7 grid gap-6 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <div className="grid h-20 w-20 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-300/10">
            <Phone className="h-9 w-9 text-cyan-200" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white">Contraband phone</h3>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">The live equivalent of $2 in $GANGSTER is paid before the verifiable delivery roll.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-lime-300/10 px-3 py-1.5 text-lime-200">50% delivered</span>
              <span className="rounded-full bg-red-300/10 px-3 py-1.5 text-red-200">25% caught · remaining time doubles</span>
              <span className="rounded-full bg-slate-300/10 px-3 py-1.5 text-slate-300">25% delivery fails</span>
            </div>
          </div>
          <button
            type="button"
            onClick={buyJailPhone}
            disabled={!jailed || jailPhoneCostTokens <= 0}
            className="rounded-xl bg-amber-300 px-5 py-3 font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Buy for {formatGangster(jailPhoneCostTokens)} $GANGSTER
          </button>
        </article>

        {lastJailPurchase ? (
          <div className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 ${
            lastJailPurchase.outcome === "delivered"
              ? "border-lime-300/25 bg-lime-300/10 text-lime-100"
              : "border-red-300/25 bg-red-400/10 text-red-100"
          }`}>
            {lastJailPurchase.outcome === "delivered" ? <PackageCheck className="mt-0.5 h-5 w-5" /> : <PackageX className="mt-0.5 h-5 w-5" />}
            <p className="font-semibold">
              {lastJailPurchase.outcome === "delivered"
                ? "Phone delivered to your inventory."
                : lastJailPurchase.outcome === "caught"
                  ? "The guards caught the smuggle. Your remaining jail time doubled."
                  : "Delivery failed. The payment was spent, but jail time did not change."}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-[2rem] border border-red-300/20 bg-red-400/[0.05] p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-red-300/25 bg-red-400/10"><PhoneCall className="h-6 w-6 text-red-200" /></div>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-red-200">Call a gang member</p>
            <h2 className="mt-2 text-3xl font-black text-white">Put a hit on whoever landed you here.</h2>
            <p className="mt-3 max-w-4xl leading-7 text-slate-300">
              A delivered phone buys one 50/50 retaliation hit. A successful order can recover 80% of eligible lost loot immediately, then the recoverable share decays evenly until none remains after 60 minutes.
            </p>
          </div>
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
          {phoneHitOpportunity ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black text-white">Target: {phoneHitOpportunity.target}</p>
                <p className="mt-1 text-sm text-slate-400">Eligible lost loot: {formatGangster(phoneHitOpportunity.originalLoot)} · recoverable now: {recoveryRatio.toFixed(1)}%</p>
              </div>
              <button type="button" onClick={callGangMember} disabled={jailPhones <= 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-300 px-5 py-3 font-black text-slate-950 disabled:opacity-40">
                <Crosshair className="h-4 w-4" /> Order 50/50 hit
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No phone-delivered hit is available. A phone and an active jail incident are required.</p>
          )}
        </div>
        {lastPhoneHit ? (
          <p className={`mt-4 rounded-2xl border p-4 font-semibold ${lastPhoneHit.won ? "border-lime-300/25 bg-lime-300/10 text-lime-200" : "border-red-300/25 bg-red-400/10 text-red-200"}`}>
            {lastPhoneHit.won
              ? `Hit landed. ${formatGangster(lastPhoneHit.recovered)} $GANGSTER was recovered at a ${Math.round(lastPhoneHit.ratio * 100)}% recovery rate.`
              : "The retaliation hit failed. The phone was consumed and no loot was recovered."}
          </p>
        ) : null}
      </section>
    </div>
  );
}
