"use client";

import Link from "next/link";
import { BadgeDollarSign, LockKeyhole } from "lucide-react";
import { usePathname } from "next/navigation";
import { CustomConnectButton } from "./connect-button";
import { GangsterWalletBalance } from "./gangster-wallet-balance";
import { ChainStatusBar } from "./chain-status-bar";

const navItems = [
  { href: "/", label: "Whitelist", public: true },
  { href: "/game", label: "Game", public: true },
  { href: "/hustle", label: "Hustle", public: false },
  { href: "/create", label: "Start Mobbin'", public: false },
  { href: "/rob", label: "Rob", public: false },
  { href: "/leaderboard", label: "Leaderboard", public: false },
  { href: "/activity", label: "Activity", public: false },
  { href: "/gang", label: "Gang", public: false },
  { href: "/jail", label: "Jail", public: false },
  { href: "/referral", label: "Referral", public: true },
  { href: "/tokenomics", label: "Gangstanomics", public: false },
  { href: "/admin", label: "Devtools", public: false, adminOnly: true },
];

export function SiteShell({
  children,
  adminAccess = false,
  hoodAccess = false,
  initiatedAccess = false,
}: {
  children: React.ReactNode;
  adminAccess?: boolean;
  hoodAccess?: boolean;
  initiatedAccess?: boolean;
}) {
  const pathname = usePathname();
  const gameLive = process.env.NEXT_PUBLIC_GAME_LIVE === "true";
  const publicRoute = pathname === "/" || pathname === "/game" || pathname === "/referral";
  const routeAvailable =
    publicRoute || gameLive || adminAccess || initiatedAccess || (hoodAccess && pathname === "/create");

  return (
    <div className="hood-theme min-h-screen text-slate-100">
      <header className="border-b border-lime-400/20 bg-[#0c100e]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="rounded-full border border-lime-400/50 bg-lime-400/10 p-2 shadow-[0_0_18px_rgba(163,230,53,0.22)]">
              <BadgeDollarSign className="h-5 w-5 text-lime-300" />
            </div>
            <p className="text-lg font-black uppercase tracking-tight">hoodATM</p>
          </Link>
          <nav className="hidden items-center gap-4 xl:flex">
            {navItems.map((item) => {
              if (item.adminOnly && !adminAccess) return null;
              const unlocked =
                item.public || gameLive || adminAccess || initiatedAccess || (hoodAccess && item.href === "/create");

              return unlocked ? (
                <Link key={item.href} href={item.href} className="text-sm text-slate-300 transition hover:text-white">
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.href}
                  className="inline-flex cursor-not-allowed items-center gap-1.5 text-sm text-slate-600"
                  title="$5 ETH initiation and $10 in $GANGSTER required"
                >
                  {item.label} <LockKeyhole className="h-3 w-3" />
                </span>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {(gameLive || adminAccess || initiatedAccess) && <GangsterWalletBalance />}
            <CustomConnectButton />
          </div>
        </div>
      </header>
      <ChainStatusBar />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10 lg:px-8">
        {routeAvailable ? children : (
          <section className="mx-auto grid min-h-[62vh] w-full max-w-3xl place-items-center">
            <div className="w-full rounded-[2rem] border border-lime-400/20 bg-black/55 p-8 text-center shadow-[0_0_60px_rgba(163,230,53,0.08)] md:p-12">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-lime-400/35 bg-lime-400/10">
                <LockKeyhole className="h-6 w-6 text-lime-300" />
              </div>
              <p className="mt-6 text-sm font-black uppercase tracking-[0.28em] text-lime-200">Hood Access locked</p>
              <h1 className="mt-4 text-4xl font-black uppercase tracking-tight text-white">Get checked before you enter.</h1>
              <p className="mx-auto mt-4 max-w-xl text-slate-300">
                When the game opens, access requires the $5 ETH initiation and at least $10 in $GANGSTER held in your connected wallet.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <CustomConnectButton />
                <Link href="/game" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-bold text-white transition hover:border-white/30">
                  View the game
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
      <footer className="border-t border-lime-400/15 bg-[#0c100e]/90">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 text-sm lg:px-8">
          <p className="text-lime-100/45">hoodATM — Own the block. Stack the hood.</p>
          <p className="max-w-3xl text-xs leading-5 text-slate-600">
            Security notice: connecting a wallet records its address, the verified X username, IP address, and account status for referral attribution and abuse prevention.
          </p>
        </div>
      </footer>
    </div>
  );
}
