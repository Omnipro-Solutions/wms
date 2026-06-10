export type Priority = "low" | "medium" | "high";

export function replenishmentPriority(
  current: number,
  min: number,
  highFactor = 0.5
): Priority {
  if (current < min * highFactor) return "high";
  if (current < min) return "medium";
  return "low";
}

export function suggestedReplenishmentQuantity(current: number, max: number): number {
  return Math.max(0, max - current);
}

export function needsReplenishment(current: number, min: number): boolean {
  return current < min;
}
