import { afterEach, describe, expect, it, vi } from "vitest";
import { retry } from "../src/retry.js";

afterEach(() => vi.useRealTimers());

describe("retry", () => {
  it("retries transient failures and returns the eventual result", async () => {
    vi.useFakeTimers();
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue("ok");
    const retried = vi.fn();

    const resultPromise = retry(operation, {
      attempts: 2,
      baseDelayMs: 10,
      onRetry: retried,
    });
    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(retried).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting the configured retries", async () => {
    vi.useFakeTimers();
    const failure = new Error("still unavailable");
    const resultPromise = retry(() => Promise.reject(failure), {
      attempts: 1,
      baseDelayMs: 1,
    });
    const assertion = expect(resultPromise).rejects.toBe(failure);
    await vi.runAllTimersAsync();
    await assertion;
  });
});
