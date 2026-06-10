import { describe, it, expect } from "vitest";
import {
  clampPickedQuantity,
  missingQuantity,
  orderTasksByAccessibility,
  pickingProgress,
} from "@/lib/rules/picking";

describe("pickingProgress", () => {
  it("computes percentage", () => {
    expect(pickingProgress(5, 10)).toBe(50);
  });
  it("returns 0 for zero requested", () => {
    expect(pickingProgress(5, 0)).toBe(0);
  });
  it("caps at 100", () => {
    expect(pickingProgress(15, 10)).toBe(100);
  });
});

describe("missingQuantity", () => {
  it("computes remaining", () => {
    expect(missingQuantity(10, 4)).toBe(6);
  });
  it("never negative", () => {
    expect(missingQuantity(10, 12)).toBe(0);
  });
});

describe("clampPickedQuantity", () => {
  it("prevents over-picking", () => {
    expect(clampPickedQuantity(15, 10)).toBe(10);
  });
  it("floors at 0", () => {
    expect(clampPickedQuantity(-2, 10)).toBe(0);
  });
});

describe("orderTasksByAccessibility", () => {
  it("sorts most accessible first", () => {
    const sorted = orderTasksByAccessibility([
      { accessibilityScore: 20 },
      { accessibilityScore: 90 },
      { accessibilityScore: 50 },
    ]);
    expect(sorted.map((t) => t.accessibilityScore)).toEqual([90, 50, 20]);
  });
});
