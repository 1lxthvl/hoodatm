const EARN_CLOCK_PREFIX = "hoodatm:earn-started:";

function storageKey(gameAddress: string, wallet: string) {
  return `${EARN_CLOCK_PREFIX}${gameAddress.toLowerCase()}:${wallet.toLowerCase()}`;
}

/** Persistent start of the current earning period. Cleared when idle stops (lay low / jail / not hustling). */
export function readEarnStartedAt(gameAddress: string, wallet: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(window.localStorage.getItem(storageKey(gameAddress, wallet)));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function writeEarnStartedAt(gameAddress: string, wallet: string, startedAt: number) {
  if (typeof window === "undefined" || startedAt <= 0) return;
  try {
    window.localStorage.setItem(storageKey(gameAddress, wallet), String(startedAt));
  } catch {
    // ignore quota / private mode
  }
}

export function clearEarnStartedAt(gameAddress: string, wallet: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(gameAddress, wallet));
  } catch {
    // ignore
  }
}

/**
 * Resolve the hustle clock for an active earning period.
 * Prefers the earliest credible timestamp so refresh / tab switches never reset.
 */
export function resolveEarnStartedAt(options: {
  gameAddress: string;
  wallet: string;
  isEarning: boolean;
  chainHeatStartedAtMs?: number;
  nowMs?: number;
}): number {
  const now = options.nowMs ?? Date.now();
  if (!options.isEarning) {
    clearEarnStartedAt(options.gameAddress, options.wallet);
    return 0;
  }

  const stored = readEarnStartedAt(options.gameAddress, options.wallet);
  const chain = options.chainHeatStartedAtMs && options.chainHeatStartedAtMs > 0
    ? options.chainHeatStartedAtMs
    : 0;

  let started = 0;
  if (stored > 0 && chain > 0) started = Math.min(stored, chain);
  else if (stored > 0) started = stored;
  else if (chain > 0) started = chain;
  else started = now;

  // Guard against future clocks from bad storage.
  if (started > now) started = now;
  writeEarnStartedAt(options.gameAddress, options.wallet, started);
  return started;
}
