import { describe, it, expect } from "vitest";
import { allocateTax, taxShare } from "@/lib/tax";

describe("allocateTax", () => {
  it("splits tax in proportion to item totals", () => {
    // items 10 and 30, tax 4 -> 1 and 3
    expect(allocateTax([10, 30], 4)).toEqual([1, 3]);
  });

  it("always adds up to the sale tax, even with rounding", () => {
    // 10.00 tax over three equal items cannot split evenly to the cent
    const parts = allocateTax([5, 5, 5], 10);
    expect(parts.reduce((sum, p) => sum + p, 0)).toBeCloseTo(10, 2);
    expect(parts.every((p) => Math.abs(p * 100 - Math.round(p * 100)) < 1e-9)).toBe(true);
  });

  it("splits tax correctly when the sale had a discount", () => {
    // items total 60 + 40 = 100, 20 discount, 10% tax on 80 -> sale tax 8
    expect(allocateTax([60, 40], 8)).toEqual([4.8, 3.2]);
  });

  it("returns zeros when there is nothing to split", () => {
    expect(allocateTax([], 5)).toEqual([]);
    expect(allocateTax([0, 0], 5)).toEqual([0, 0]);
  });
});

describe("taxShare", () => {
  it("gives tax per unit of item value", () => {
    // subtotal 100, tax 10 -> a refund of 50 carries 5 of tax
    expect(taxShare(10, [60, 40]) * 50).toBeCloseTo(5, 2);
  });

  it("gives the right refund tax when the sale had a discount", () => {
    // item total 100, 20 discount, 10% tax on 80 -> sale tax 8
    // refunding an item worth 50 should return 4 of tax (50 * 10% * 80%)
    expect(50 * taxShare(8, [100])).toBeCloseTo(4, 2);
  });

  it("returns 0 when there are no item totals", () => {
    expect(taxShare(10, [])).toBe(0);
  });
});
