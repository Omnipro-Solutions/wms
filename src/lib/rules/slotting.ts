import type { AbcClass, XyzClass } from "@/types/wms";

// ABC via Pareto over a movement metric (pickingFrequency or unitsSold).
// A = top thresholdA of cumulative volume, B = up to thresholdB, C = rest.
export function classifyAbc(
  items: { productId: string; metric: number }[],
  thresholdA = 0.8,
  thresholdB = 0.95
): Record<string, AbcClass> {
  const total = items.reduce((sum, i) => sum + i.metric, 0);
  const result: Record<string, AbcClass> = {};
  if (total <= 0) {
    for (const item of items) result[item.productId] = "C";
    return result;
  }
  const sorted = [...items].sort((a, b) => b.metric - a.metric);
  const epsilon = 1e-9; // absorb floating-point accumulation error at thresholds
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.metric / total;
    if (cumulative <= thresholdA + epsilon) result[item.productId] = "A";
    else if (cumulative <= thresholdB + epsilon) result[item.productId] = "B";
    else result[item.productId] = "C";
  }
  return result;
}

// XYZ via demand variability (coefficient of variation = stddev / mean).
export function classifyXyz(samples: number[], cvX = 0.5, cvY = 1.0): XyzClass {
  if (samples.length === 0) return "Z";
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  if (mean === 0) return "Z";
  const variance =
    samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length;
  const cv = Math.sqrt(variance) / mean;
  if (cv <= cvX) return "X";
  if (cv <= cvY) return "Y";
  return "Z";
}

// Score 0-100; higher means relocating this product is more beneficial.
export function slottingScore(args: {
  abcClass: AbcClass;
  product: { unitWeightKg: number };
  current: { accessibilityScore: number; golden: boolean; distanceToDispatchM: number };
  candidate: {
    accessibilityScore: number;
    golden: boolean;
    distanceToDispatchM: number;
    maxWeightKg: number;
  };
}): number {
  const { abcClass, product, current, candidate } = args;
  // Candidate must physically fit the product weight.
  if (product.unitWeightKg > candidate.maxWeightKg) return 0;

  const classWeight = abcClass === "A" ? 1 : abcClass === "B" ? 0.5 : 0.2;
  const accessibilityGain = Math.max(
    0,
    candidate.accessibilityScore - current.accessibilityScore
  );
  const goldenGain = candidate.golden && !current.golden ? 30 : 0;
  const distanceGain = Math.max(
    0,
    current.distanceToDispatchM - candidate.distanceToDispatchM
  );

  const raw =
    classWeight * (accessibilityGain + goldenGain + Math.min(40, distanceGain));
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function estimatedDistanceSaved(
  currentDistanceM: number,
  candidateDistanceM: number,
  pickingFrequency: number
): number {
  return Math.max(0, (currentDistanceM - candidateDistanceM) * pickingFrequency);
}

// Rough walking-time estimate: assume ~1.2 m/s operator walking speed.
export function estimatedTimeSaved(distanceSavedM: number): number {
  return Math.round(distanceSavedM / 1.2);
}
