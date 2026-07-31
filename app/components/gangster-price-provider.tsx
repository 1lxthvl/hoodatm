"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import type { GangsterPriceSnapshot } from "../lib/gangster-economy";

type PriceContextValue = {
  price: GangsterPriceSnapshot | null;
  loading: boolean;
  error: string | null;
};

const GangsterPriceContext = createContext<PriceContextValue>({
  price: null,
  loading: true,
  error: null,
});

export function GangsterPriceProvider({ children }: { children: ReactNode }) {
  const [price, setPrice] = useState<GangsterPriceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function refresh() {
      try {
        const response = await fetch("/api/gangster-price", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Live price unavailable");
        if (active) {
          setPrice(data);
          setError(null);
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Live price unavailable");
      } finally {
        if (active) setLoading(false);
      }
    }

    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const value = useMemo(() => ({ price, loading, error }), [price, loading, error]);
  return <GangsterPriceContext.Provider value={value}>{children}</GangsterPriceContext.Provider>;
}

export function useGangsterPrice() {
  return useContext(GangsterPriceContext);
}

export function GangsterUsdAmount({
  usd,
  prefix = "",
  className = "",
  compact = false,
  showEth = true,
}: {
  usd: number;
  prefix?: string;
  className?: string;
  compact?: boolean;
  /** Append live ETH-equivalent of the USD amount (join-style pricing). */
  showEth?: boolean;
}) {
  const { price, loading } = useGangsterPrice();
  const amount = price ? usd / price.gangsterUsd : null;
  const ethAmount = price && price.ethUsd > 0 ? usd / price.ethUsd : null;
  const ethLabel = ethAmount === null
    ? null
    : `${ethAmount < 0.001 ? ethAmount.toFixed(6) : ethAmount.toFixed(4)} ETH`;

  return (
    <span className={className} title={price?.source}>
      {prefix}
      {amount === null
        ? loading ? "Loading live quote…" : "Quote unavailable"
        : compact
          ? `~${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount)} $GANGSTER${showEth && ethLabel ? ` · ~${ethLabel}` : ""}`
          : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: amount >= 1000 ? 0 : 2 }).format(amount)} $GANGSTER · $${usd.toFixed(usd < 0.01 ? 3 : 2)}${showEth && ethLabel ? ` · ~${ethLabel}` : ""}`}
    </span>
  );
}

/** Live ETH quote for USD-priced payments (join + tier upgrades). */
export function EthUsdAmount({
  usd,
  prefix = "",
  className = "",
  compact = false,
}: {
  usd: number;
  prefix?: string;
  className?: string;
  compact?: boolean;
}) {
  const { price, loading } = useGangsterPrice();
  const ethAmount = price && price.ethUsd > 0 ? usd / price.ethUsd : null;

  return (
    <span className={className} title={price?.source}>
      {prefix}
      {ethAmount === null
        ? loading ? "Loading live quote…" : "Quote unavailable"
        : compact
          ? `~${ethAmount < 0.001 ? ethAmount.toFixed(6) : ethAmount.toFixed(4)} ETH`
          : `${ethAmount < 0.001 ? ethAmount.toFixed(6) : ethAmount.toFixed(4)} ETH · $${usd.toFixed(usd < 0.01 ? 3 : 2)}`}
    </span>
  );
}
