// Deterministic pseudo-random seeded by warehouseId + days so the same
// filter combination always returns the same data (no flicker on re-render).
const seed = (warehouseId: string, days: number) =>
  (warehouseId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) * 31 + days) % 997

const jitter = (base: number, pct: number, s: number) => {
  const factor = 1 + ((s % 100) / 100 - 0.5) * pct
  return Math.round(base * factor)
}

// ─── KPIs ────────────────────────────────────────────────────────────────────

export type MockKpis = {
  pendingOrders: number
  ordersInPicking: number
  partialPickingTasks: number
  otif: number
  ira: number
  criticalAlerts: number
  slaBreaches: number
}

export const getMockKpis = (warehouseId: string, days: number): MockKpis => {
  const s = seed(warehouseId, days)
  const scale = days / 30
  return {
    pendingOrders:       jitter(Math.round(142 * scale), 0.3, s),
    ordersInPicking:     jitter(Math.round(38  * scale), 0.3, s + 1),
    partialPickingTasks: jitter(Math.round(6   * scale), 0.5, s + 2),
    otif:                Math.min(99, Math.max(72, 91.4 + ((s % 20) - 10) * 0.4)),
    ira:                 Math.min(99.9, Math.max(88, 97.2 + ((s % 10) - 5) * 0.3)),
    criticalAlerts:      jitter(3, 0.8, s + 3),
    slaBreaches:         jitter(2, 0.8, s + 4),
  }
}

// ─── Weekly demand ───────────────────────────────────────────────────────────

const PRODUCTS = ["Camiseta Básica", "Zapatilla Running", "Pantalón Cargo", "Chaqueta Impermeable", "Mochila Urbana"]
const BASE_DEMAND = [130, 90, 68, 52, 40]

export const getMockWeeklyDemand = (warehouseId: string, days: number) => {
  const s = seed(warehouseId, days)
  const weeks = days <= 7 ? 7 : days <= 15 ? 15 : days <= 30 ? 8 : 13
  const label = days <= 15 ? "Día" : "Sem"

  return Array.from({ length: weeks }, (_, i) => {
    const row: Record<string, string | number> = { week: `${label} ${i + 1}` }
    PRODUCTS.forEach((p, pi) => {
      const base = BASE_DEMAND[pi]
      const sLocal = (s + i * 7 + pi * 13) % 997
      row[p] = jitter(base, 0.35, sLocal)
    })
    return row
  })
}

export const WEEKLY_DEMAND_PRODUCT_KEYS = PRODUCTS

// ─── Operator productivity ───────────────────────────────────────────────────

const OPERATOR_NAMES = [
  "Carlos M.", "Luisa F.", "Andrés T.", "Paola R.",
  "Diego S.",  "Mónica V.", "Javier C.", "Sandra P.",
]
const BASE_PICKS = [312, 287, 265, 241, 198, 175, 152, 134]

export const getMockOperatorProductivity = (warehouseId: string, days: number) => {
  const s = seed(warehouseId, days)
  const scale = days / 30
  return OPERATOR_NAMES.map((name, i) => ({
    operatorName:   name,
    unitsPicked:    jitter(Math.round(BASE_PICKS[i] * scale), 0.25, s + i),
    picksCompleted: jitter(Math.round(BASE_PICKS[i] * scale * 0.32), 0.2, s + i + 1),
    partialCount:   jitter(Math.round((4 - Math.floor(i / 2)) * scale), 0.5, s + i + 2),
    issueCount:     jitter(Math.round((2 - Math.floor(i / 4)) * scale), 0.6, s + i + 3),
  })).sort((a, b) => b.unitsPicked - a.unitsPicked)
}

// ─── Orders by status ────────────────────────────────────────────────────────

export type StatusDatum = { label: string; status: string; count: number }

export const getMockOrdersByStatus = (warehouseId: string, days: number): StatusDatum[] => {
  const s = seed(warehouseId, days)
  const scale = days / 30
  const counts = [
    { status: "Pendiente",   base: 58 },
    { status: "En progreso", base: 34 },
    { status: "Completada",  base: 41 },
    { status: "Cancelada",   base: 9  },
  ]
  return counts.map(({ status, base }, i) => {
    const count = jitter(Math.round(base * scale), 0.3, s + i)
    return { status, label: String(count), count }
  })
}

export const getMockPickingByStatus = (warehouseId: string, days: number): StatusDatum[] => {
  const s = seed(warehouseId, days)
  const scale = days / 30
  const counts = [
    { status: "Pendiente",        base: 22 },
    { status: "En progreso",      base: 38 },
    { status: "Completada",       base: 87 },
    { status: "Parcial aprobado", base: 11 },
    { status: "Con incidencia",   base: 5  },
  ]
  return counts.map(({ status, base }, i) => {
    const count = jitter(Math.round(base * scale), 0.3, s + i + 10)
    return { status, label: String(count), count }
  })
}

export const getMockReturnsByStatus = (warehouseId: string, days: number): StatusDatum[] => {
  const s = seed(warehouseId, days)
  const scale = days / 30
  const counts = [
    { status: "Solicitada",    base: 14 },
    { status: "En tránsito",   base: 8  },
    { status: "En validación", base: 6  },
    { status: "Reingresada",   base: 19 },
    { status: "Cerrada",       base: 31 },
  ]
  return counts.map(({ status, base }, i) => {
    const count = jitter(Math.round(base * scale), 0.3, s + i + 20)
    return { status, label: String(count), count }
  })
}

// ─── Alerts ──────────────────────────────────────────────────────────────────

export type MockAlert = {
  id: string
  label: string
  detail: string
  urgency: "critica" | "advertencia" | "info"
}

export const getMockAlerts = (warehouseId: string, days: number): MockAlert[] => {
  const kpis = getMockKpis(warehouseId, days)
  const alerts: MockAlert[] = []

  if (kpis.slaBreaches >= 1)
    alerts.push({ id: "sla-1", label: "SLA Incumplido",      detail: `Orden ORD-0042 — 26h / 24h (108%)`,           urgency: "critica"     })
  if (kpis.slaBreaches >= 2)
    alerts.push({ id: "sla-2", label: "SLA en Riesgo",        detail: `Orden ORD-0078 — 22h / 24h (92%)`,            urgency: "advertencia" })
  if (kpis.criticalAlerts >= 2)
    alerts.push({ id: "integ-1", label: "Error de Integración", detail: "SAP S/4HANA — timeout en sincronización", urgency: "critica" })
  if (kpis.criticalAlerts >= 1)
    alerts.push({ id: "stock-1", label: "Stock Crítico", detail: `${Math.max(1, kpis.criticalAlerts - 1)} producto(s) bajo mínimo`, urgency: "critica" })

  alerts.push({ id: "exp-1",  label: "Próximos a Vencer",  detail: `${jitter(12, 0.4, seed(warehouseId, days) + 99)} ítem(s) con vencimiento en 7 días`, urgency: "advertencia" })
  alerts.push({ id: "hold-1", label: "Inventario en Hold", detail: `${jitter(847, 0.3, seed(warehouseId, days) + 88)} unidades bloqueadas por QC`,         urgency: "info"        })

  return alerts
}
