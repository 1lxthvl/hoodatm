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
}: {
  usd: number;
  prefix?: string;
  className?: string;
  compact?: boolean;
}) {
  const { price, loading } = useGangsterPrice();
  const amount = price ? usd / price.gangsterUsd : null;

  return (
    <span className={className} title={price?.source}>
      {prefix}
      {amount === null
        ? loading ? "Loading live quote…" : "Quote unavailable"
        : compact
          ? `~${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(amount)} $GANGSTER`
          : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: amount >= 1000 ? 0 : 2 }).format(amount)} $GANGSTER · $${usd.toFixed(usd < 0.01 ? 3 : 2)}`}
    </span>
  );
}
