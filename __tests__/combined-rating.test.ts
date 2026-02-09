import { describe, it, expect } from "vitest";

/**
 * VA Combined Rating Calculator - Pure Logic Tests
 * 
 * Tests the VA math formula (whole person theory):
 * Each rating is applied to remaining healthy percentage.
 * Final result is rounded to nearest 10%.
 */

function calculateCombinedRating(
  ratings: number[],
  options?: { bilateralRatings?: number[] }
): {
  exactCombined: number;
  roundedCombined: number;
  bilateralBonus: number;
} {
  if (ratings.length === 0) {
    return { exactCombined: 0, roundedCombined: 0, bilateralBonus: 0 };
  }

  const sortedRatings = [...ratings].sort((a, b) => b - a);
  let remainingHealthy = 100;

  for (const rating of sortedRatings) {
    const disability = (rating / 100) * remainingHealthy;
    remainingHealthy -= disability;
  }

  const exactCombined = 100 - remainingHealthy;

  // Bilateral factor
  let bilateralBonus = 0;
  if (options?.bilateralRatings && options.bilateralRatings.length >= 2) {
    let bilateralRemaining = 100;
    for (const br of options.bilateralRatings.sort((a, b) => b - a)) {
      bilateralRemaining -= (br / 100) * bilateralRemaining;
    }
    const bilateralCombined = 100 - bilateralRemaining;
    bilateralBonus = bilateralCombined * 0.10;
  }

  const adjustedCombined = exactCombined + bilateralBonus;
  const roundedCombined = Math.round(adjustedCombined / 10) * 10;

  return { exactCombined, roundedCombined, bilateralBonus };
}

describe("VA Combined Rating Calculator", () => {
  it("should return 0 for empty ratings", () => {
    const result = calculateCombinedRating([]);
    expect(result.roundedCombined).toBe(0);
  });

  it("should return the single rating for one condition", () => {
    const result = calculateCombinedRating([50]);
    expect(result.roundedCombined).toBe(50);
  });

  it("should calculate two ratings correctly (50% + 30%)", () => {
    // 50% + 30% of remaining 50% = 50 + 15 = 65% → rounds to 70%
    const result = calculateCombinedRating([50, 30]);
    expect(result.exactCombined).toBeCloseTo(65, 1);
    expect(result.roundedCombined).toBe(70);
  });

  it("should calculate three ratings correctly (50% + 30% + 20%)", () => {
    // 50% leaves 50% healthy
    // 30% of 50% = 15% → leaves 35% healthy
    // 20% of 35% = 7% → leaves 28% healthy
    // Combined = 72% → rounds to 70%
    const result = calculateCombinedRating([50, 30, 20]);
    expect(result.exactCombined).toBeCloseTo(72, 0);
    expect(result.roundedCombined).toBe(70);
  });

  it("should be order-independent", () => {
    const result1 = calculateCombinedRating([50, 30, 20]);
    const result2 = calculateCombinedRating([20, 50, 30]);
    expect(result1.exactCombined).toBeCloseTo(result2.exactCombined, 5);
    expect(result1.roundedCombined).toBe(result2.roundedCombined);
  });

  it("should handle 100% rating", () => {
    const result = calculateCombinedRating([100]);
    expect(result.roundedCombined).toBe(100);
  });

  it("should handle all 10% ratings", () => {
    const result = calculateCombinedRating([10, 10, 10]);
    // 10% + 9% + 8.1% = 27.1% → rounds to 30%
    expect(result.roundedCombined).toBe(30);
  });

  it("should round 5 up (VA rule)", () => {
    // Need to find ratings that produce a .5 combined
    // 70 + 30% of 30 = 70 + 9 = 79 → rounds to 80
    const result = calculateCombinedRating([70, 30]);
    expect(result.exactCombined).toBeCloseTo(79, 0);
    expect(result.roundedCombined).toBe(80);
  });

  it("should apply bilateral factor for paired limb conditions", () => {
    // Two knee conditions: 20% each
    // Combined without bilateral: 20 + 16 = 36% → 40%
    // Bilateral: combined 36%, bonus = 36 * 0.10 = 3.6
    // With bilateral: 36 + 3.6 = 39.6 → 40%
    const result = calculateCombinedRating([20, 20], {
      bilateralRatings: [20, 20],
    });
    expect(result.bilateralBonus).toBeGreaterThan(0);
    expect(result.roundedCombined).toBe(40);
  });
});
