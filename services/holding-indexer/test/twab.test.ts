import { describe, expect, it } from "vitest";
import { computeTwab, TWAB_WINDOW_SECONDS } from "../src/twab.js";

describe("computeTwab", () => {
  it("computes an exact 24-hour weighted average without floating point", () => {
    const start = 1_700_000_000;
    const result = computeTwab(
      100n,
      [
        { timestamp: start + 21_600, delta: 100n },
        { timestamp: start + 64_800, delta: -50n },
      ],
      start,
      start + TWAB_WINDOW_SECONDS,
    );

    expect(result.weightedSeconds).toBe(14_040_000n);
    expect(result.average).toBe(162n);
    expect(result.remainder).toBe(43_200n);
  });

  it("groups same-second effects without adding elapsed weight", () => {
    const result = computeTwab(
      0n,
      [
        { timestamp: 10, delta: 10n },
        { timestamp: 10, delta: 5n },
        { timestamp: 20, delta: -5n },
      ],
      0,
      30,
    );
    expect(result.weightedSeconds).toBe(250n);
    expect(result.average).toBe(8n);
    expect(result.remainder).toBe(10n);
  });

  it("rejects unsorted changes and negative balances", () => {
    expect(() =>
      computeTwab(1n, [{ timestamp: 9, delta: 1n }, { timestamp: 8, delta: 1n }], 0, 10),
    ).toThrow("timestamp-sorted");
    expect(() => computeTwab(1n, [{ timestamp: 5, delta: -2n }], 0, 10)).toThrow(
      "balance became negative",
    );
  });

  it("preserves values larger than JavaScript's safe integer range", () => {
    const balance = 10n ** 30n;
    const result = computeTwab(balance, [], 0, TWAB_WINDOW_SECONDS);
    expect(result.average).toBe(balance);
    expect(result.remainder).toBe(0n);
  });
});
