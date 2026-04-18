import { describe, it, expect } from "vitest";
import { planContiguousRanges } from "../src/logic/write-planner.js";

describe("planContiguousRanges", () => {
  it("returns empty array for empty resultMap", () => {
    expect(planContiguousRanges({})).toEqual([]);
  });

  it("returns single range for single entry", () => {
    const ranges = planContiguousRanges({ 5: "pk_value" });
    expect(ranges).toHaveLength(1);
    expect(ranges[0].startRowIndex).toBe(5);
    expect(ranges[0].values).toEqual([["pk_value"]]);
  });

  it("batches fully contiguous rows into a single range", () => {
    const ranges = planContiguousRanges({ 0: "a", 1: "b", 2: "c" });
    expect(ranges).toHaveLength(1);
    expect(ranges[0].startRowIndex).toBe(0);
    expect(ranges[0].values).toEqual([["a"], ["b"], ["c"]]);
  });

  it("splits on gaps into separate ranges", () => {
    const ranges = planContiguousRanges({ 0: "a", 1: "b", 5: "c", 6: "d" });
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({ startRowIndex: 0, values: [["a"], ["b"]] });
    expect(ranges[1]).toEqual({ startRowIndex: 5, values: [["c"], ["d"]] });
  });

  it("handles all single-element ranges (no contiguous rows)", () => {
    const ranges = planContiguousRanges({ 0: "a", 3: "b", 7: "c" });
    expect(ranges).toHaveLength(3);
    expect(ranges[0]).toEqual({ startRowIndex: 0, values: [["a"]] });
    expect(ranges[1]).toEqual({ startRowIndex: 3, values: [["b"]] });
    expect(ranges[2]).toEqual({ startRowIndex: 7, values: [["c"]] });
  });

  it("sorts out-of-order numeric keys", () => {
    const ranges = planContiguousRanges({ 5: "e", 2: "b", 0: "a", 1: "c", 3: "d" });
    expect(ranges).toHaveLength(2);
    expect(ranges[0]).toEqual({ startRowIndex: 0, values: [["a"], ["c"], ["b"], ["d"]] });
    expect(ranges[1]).toEqual({ startRowIndex: 5, values: [["e"]] });
  });

  it("handles large contiguous block efficiently", () => {
    const resultMap = {};
    for (let i = 0; i < 500; i++) resultMap[i] = `val_${i}`;
    const ranges = planContiguousRanges(resultMap);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].startRowIndex).toBe(0);
    expect(ranges[0].values).toHaveLength(500);
  });

  it("handles multiple gaps in sequence", () => {
    const ranges = planContiguousRanges({ 10: "a", 11: "b", 13: "c", 15: "d", 16: "e", 17: "f" });
    expect(ranges).toHaveLength(3);
    expect(ranges[0]).toEqual({ startRowIndex: 10, values: [["a"], ["b"]] });
    expect(ranges[1]).toEqual({ startRowIndex: 13, values: [["c"]] });
    expect(ranges[2]).toEqual({ startRowIndex: 15, values: [["d"], ["e"], ["f"]] });
  });
});
