import { describe, it, expect } from "vitest";
import {
  applyAdjustment,
  applyHold,
  applyPick,
  applyReceipt,
  applyRelease,
  applyReserve,
  applyScrap,
  availableStock,
} from "@/lib/rules/inventory";

const base = { onHandQuantity: 10, reservedQuantity: 2, holdQuantity: 1 };

describe("availableStock", () => {
  it("derives available = onHand - reserved - hold", () => {
    expect(availableStock(base)).toBe(7);
  });
  it("never returns negative", () => {
    expect(availableStock({ onHandQuantity: 1, reservedQuantity: 5, holdQuantity: 0 })).toBe(0);
  });
});

describe("applyReserve", () => {
  it("increases reserved", () => {
    expect(applyReserve(base, 3).reservedQuantity).toBe(5);
  });
  it("throws when exceeding available", () => {
    expect(() => applyReserve(base, 8)).toThrow();
  });
});

describe("applyPick", () => {
  it("decreases onHand and reserved", () => {
    const r = applyPick(base, 2);
    expect(r.onHandQuantity).toBe(8);
    expect(r.reservedQuantity).toBe(0);
  });
  it("throws when picking more than reserved", () => {
    expect(() => applyPick(base, 3)).toThrow();
  });
});

describe("applyReceipt", () => {
  it("increases onHand", () => {
    expect(applyReceipt(base, 5).onHandQuantity).toBe(15);
  });
});

describe("applyHold / applyRelease", () => {
  it("moves quantity in and out of hold", () => {
    const held = applyHold(base, 3);
    expect(held.holdQuantity).toBe(4);
    expect(applyRelease(held, 4).holdQuantity).toBe(0);
  });
  it("throws releasing more than held", () => {
    expect(() => applyRelease(base, 5)).toThrow();
  });
});

describe("applyScrap", () => {
  it("removes from onHand", () => {
    expect(applyScrap(base, 4).onHandQuantity).toBe(6);
  });
  it("throws scrapping more than onHand", () => {
    expect(() => applyScrap(base, 99)).toThrow();
  });
});

describe("applyAdjustment", () => {
  it("sets onHand to counted value", () => {
    expect(applyAdjustment(base, 20).onHandQuantity).toBe(20);
  });
  it("throws on negative count", () => {
    expect(() => applyAdjustment(base, -1)).toThrow();
  });
});
