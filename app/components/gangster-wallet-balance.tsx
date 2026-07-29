"use client";

import { WalletCards } from "lucide-react";
import { formatGangster, useMockGang } from "./mock-gang-provider";

export function GangsterWalletBalance() {
  const { currentPlayer } = useMockGang();

  return (
    <div
      className="hidden items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-2 text-sm font-black text-lime-200 sm:inline-flex"
      title="Claimed in-game wallet balance"
    >
      <WalletCards className="h-4 w-4" />
      <span>$GANGSTER {formatGangster(currentPlayer.claimed)}</span>
    </div>
  );
}
