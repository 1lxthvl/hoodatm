export interface TimedDelta {
  timestamp: number;
  delta: bigint;
}

export interface Twab {
  average: bigint;
  remainder: bigint;
  weightedSeconds: bigint;
}

export const TWAB_WINDOW_SECONDS = 86_400;

/**
 * Computes a time-weighted balance using integer arithmetic only. Events at the
 * same timestamp are applied together after weighting the preceding interval.
 */
export function computeTwab(
  balanceAtWindowStart: bigint,
  changes: readonly TimedDelta[],
  windowStart: number,
  windowEnd: number,
): Twab {
  if (!Number.isSafeInteger(windowStart) || !Number.isSafeInteger(windowEnd) || windowEnd <= windowStart) {
    throw new Error("Invalid TWAB window");
  }

  let balance = balanceAtWindowStart;
  let cursor = windowStart;
  let weightedSeconds = 0n;

  for (const change of changes) {
    if (!Number.isSafeInteger(change.timestamp) || change.timestamp < windowStart || change.timestamp > windowEnd) {
      throw new Error("TWAB change lies outside the window");
    }
    if (change.timestamp < cursor) throw new Error("TWAB changes must be timestamp-sorted");
    weightedSeconds += balance * BigInt(change.timestamp - cursor);
    balance += change.delta;
    if (balance < 0n) throw new Error("TWAB balance became negative");
    cursor = change.timestamp;
  }

  weightedSeconds += balance * BigInt(windowEnd - cursor);
  const duration = BigInt(windowEnd - windowStart);
  return {
    average: weightedSeconds / duration,
    remainder: weightedSeconds % duration,
    weightedSeconds,
  };
}
