"use client";

import { Activity, BanknoteArrowDown, Coins, Flame, ShieldCheck, Siren, Swords } from "lucide-react";
import { formatGangster, GangActivity, useMockGang } from "../components/mock-gang-provider";

function activityStyle(item: GangActivity) {
  if (item.type === "claim") {
    return {
      icon: BanknoteArrowDown,
      iconClass: "border-lime-300/25 bg-lime-300/10 text-lime-300",
      amountClass: "text-lime-300",
      amountPrefix: "+",
      label: "Wallet received",
    };
  }

  if (item.type === "robbery" && item.outcome === "failed") {
    return {
      icon: Swords,
      iconClass: "border-red-300/25 bg-red-400/10 text-red-300",
      amountClass: "text-red-300",
      amountPrefix: "−",
      label: "Tokens lost",
    };
  }

  if (item.type === "robbery") {
    return {
      icon: Swords,
      iconClass: "border-amber-300/25 bg-amber-300/10 text-amber-200",
      amountClass: "text-amber-200",
      amountPrefix: "+",
      label: "Tokens stolen",
    };
  }

  if (item.type === "snitch") {
    return {
      icon: Siren,
      iconClass: "border-blue-300/25 bg-blue-400/10 text-blue-200",
      amountClass: "text-blue-200",
      amountPrefix: "−",
      label: "Snitch payment",
    };
  }

  return {
    icon: Coins,
    iconClass: "border-cyan-300/25 bg-cyan-300/10 text-cyan-200",
    amountClass: "text-cyan-200",
    amountPrefix: "+",
    label: "Hourly rate",
  };
}

export default function ActivityPage() {
  const { activities, burnedTotal, currentPlayer } = useMockGang();
  const successfulRobberies = activities.filter((item) => item.type === "robbery" && item.outcome === "success").length;
  const failedRobberies = activities.filter((item) => item.type === "robbery" && item.outcome === "failed").length;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,.13),transparent_28rem),rgba(8,11,9,.95)] p-7 sm:p-9">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 text-sm font-semibold text-cyan-100">
            <Activity className="h-4 w-4" /> Live gang activity
          </div>
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">Every move leaves a receipt.</h1>
          <p className="mt-4 text-lg leading-8 text-slate-300">
            Follow claims, token burns, automatic hustle earnings, and robbery outcomes. New confirmed actions appear here as they happen.
          </p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: ShieldCheck, label: "In-game wallet", value: formatGangster(currentPlayer.claimed), color: "text-lime-300" },
          { icon: Flame, label: "Your session burns", value: formatGangster(burnedTotal), color: "text-red-300" },
          { icon: Swords, label: "Successful hits", value: String(successfulRobberies), color: "text-amber-200" },
          { icon: Swords, label: "Failed hits", value: String(failedRobberies), color: "text-slate-300" },
        ].map((item) => (
          <div key={item.label} className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-5">
            <item.icon className={`h-5 w-5 ${item.color}`} />
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.17em] text-slate-500">{item.label}</p>
            <p className={`mt-2 text-3xl font-black ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5 sm:px-8">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">Activity feed</p>
            <p className="mt-1 text-sm text-slate-500">Newest actions appear first</p>
          </div>
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-lime-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-lime-300" /> Live
          </span>
        </div>

        <div className="divide-y divide-white/10">
          {activities.length === 0 ? (
            <div className="px-6 py-12 text-center sm:px-8">
              <p className="font-bold text-white">No confirmed activity yet.</p>
              <p className="mt-2 text-sm text-slate-500">Claims, burns, ATM hits, and robberies will appear here after they happen.</p>
            </div>
          ) : null}
          {activities.map((item) => {
            const style = activityStyle(item);
            const Icon = style.icon;

            return (
              <article key={item.id} className="grid gap-4 px-6 py-6 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-8">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${style.iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-white">{item.title}</h2>
                    {item.outcome && (
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.15em] ${item.outcome === "success" ? "bg-lime-300/10 text-lime-300" : "bg-red-400/10 text-red-300"}`}>
                        {item.outcome}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{item.detail}</p>
                  {item.burned !== undefined && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-red-300">
                      <Flame className="h-3.5 w-3.5" /> {formatGangster(item.burned)} $GANGSTER burned
                    </p>
                  )}
                </div>
                <div className="sm:text-right">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{style.label}</p>
                  <p className={`mt-1 text-xl font-black ${style.amountClass}`}>{style.amountPrefix}{formatGangster(item.amount)}</p>
                  <p className="mt-1 text-xs text-slate-600">{item.time}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <p className="text-center text-sm text-slate-500">Only confirmed gang activity appears in this feed.</p>
    </div>
  );
}
