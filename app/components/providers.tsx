"use client";

import { ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MockGangProvider } from "./mock-gang-provider";
import { hoodAtmChain } from "../lib/robinhood-chain";
import { wagmiConfig } from "../lib/wagmi-config";
import { GangsterPriceProvider } from "./gangster-price-provider";
import { PlayerTracker } from "./player-tracker";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={hoodAtmChain}>
          <GangsterPriceProvider>
            <MockGangProvider>
              <PlayerTracker />
              {children}
            </MockGangProvider>
          </GangsterPriceProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
