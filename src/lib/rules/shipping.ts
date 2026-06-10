export function routeOccupancy(currentLoadKg: number, capacityKg: number): number {
  if (capacityKg <= 0) return 0;
  return Math.min(100, Math.round((currentLoadKg / capacityKg) * 100));
}

export function otifPercentage(
  shipments: { otifStatus: "on_time" | "at_risk" | "late" }[]
): number {
  if (shipments.length === 0) return 0;
  const onTime = shipments.filter((s) => s.otifStatus === "on_time").length;
  return Math.round((onTime / shipments.length) * 100);
}
