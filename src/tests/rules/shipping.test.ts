import { describe, it, expect } from "vitest";
import { otifPercentage, routeOccupancy } from "@/lib/rules/shipping";

describe("routeOccupancy", () => {
  it("computes percentage", () => {
    expect(routeOccupancy(500, 1000)).toBe(50);
  });
  it("returns 0 for zero capacity", () => {
    expect(routeOccupancy(500, 0)).toBe(0);
  });
  it("caps at 100", () => {
    expect(routeOccupancy(1500, 1000)).toBe(100);
  });
});

describe("otifPercentage", () => {
  it("computes on-time ratio", () => {
    expect(
      otifPercentage([
        { otifStatus: "on_time" },
        { otifStatus: "on_time" },
        { otifStatus: "late" },
        { otifStatus: "at_risk" },
      ])
    ).toBe(50);
  });
  it("returns 0 for empty", () => {
    expect(otifPercentage([])).toBe(0);
  });
});
