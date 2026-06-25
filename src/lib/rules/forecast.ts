// Demand forecasting — pure functions, no store dependency.

/**
 * Exponential Moving Average (EMA) forecast.
 * alpha: smoothing factor 0 < alpha <= 1 (higher = more weight on recent data).
 * Returns `periods` future values extrapolated from the last EMA value.
 */
export const forecastDemand = (samples: number[], periods: number, alpha = 0.3): number[] => {
  if (samples.length === 0 || periods <= 0) return []

  // Seed EMA with first sample
  let ema = samples[0]
  for (let i = 1; i < samples.length; i++) {
    ema = alpha * samples[i] + (1 - alpha) * ema
  }

  // Flat EMA projection — each future period uses the last EMA value
  return Array.from({ length: periods }, () => Math.max(0, Math.round(ema)))
}

/** Mean Absolute Error between forecast and actuals (for back-testing). */
export const forecastMAE = (actuals: number[], predicted: number[]): number => {
  const n = Math.min(actuals.length, predicted.length)
  if (n === 0) return 0
  const sum = actuals.slice(0, n).reduce((acc, v, i) => acc + Math.abs(v - predicted[i]), 0)
  return Math.round((sum / n) * 100) / 100
}
