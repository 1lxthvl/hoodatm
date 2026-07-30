import { describe, expect, it } from "vitest";
import { chunk } from "../src/oracle.js";

describe("oracle batching", () => {
  it("creates deterministic bounded batches", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 10)).toEqual([]);
  });

  it("rejects unsafe batch sizes", () => {
    expect(() => chunk([1], 0)).toThrow("positive");
    expect(() => chunk([1], 1.5)).toThrow("positive");
  });
});
