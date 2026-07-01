# Spec: KpiCard Redesign — Estilo Dashboard

**Fecha:** 2026-06-25  
**Autor:** Carlos Granados  
**Alcance:** `src/components/shared/kpi-card.tsx` + verificación de 26 call-sites

---

## Objetivo

Unificar el estilo visual de todos los KPI cards del WMS con el estilo del `AnalyticsKpiStrip` del dashboard. Actualmente `KpiCard` usa fondos de color sólido por tone (blue-50, red-50, etc.) con icono grande. El nuevo estilo usa fondo `bg-card` neutro con badges semánticos, igual que las gráficas del dashboard.

---

## Decisiones de diseño

| Decisión | Opción elegida | Razón |
|----------|---------------|-------|
| Estrategia | Reescribir `KpiCard` in-place | Cero cambios en 26 call-sites |
| Icono | Conservar, reducir a size-4 muted inline en header | Mantiene contexto visual sin dominar |
| Click/navegación | Eliminar `onClick` y `alert` | KPIs son solo informativos |
| Fondo | Siempre `bg-card` | Consistencia con gráficas del dashboard |
| Color semántico | Vive en el badge, no en el fondo | Igual que `AnalyticsKpiStrip` |

---

## API del componente

### Props que se mantienen
```ts
interface KpiCardProps {
  icon: LucideIcon
  value: number | string
  label: string
  sublabel?: string
  tone: 'blue' | 'red' | 'amber' | 'green' | 'neutral'
}
```

### Props eliminadas
- `alert?: boolean` — removida, sin funcionalidad de alerta animada
- `onClick?: () => void` — removida, KPIs son informativos

Los 26 call-sites que pasen `onClick` o `alert` seguirán compilando sin error porque TypeScript ignora props extra no declaradas en la interfaz. No requieren cambios.

---

## Estructura visual

```
┌──────────────────────────────────────────────┐  ← bg-card, rounded-xl, ring-1 ring-foreground/10
│  [icon size-4 muted]  Label (font-normal sm) │  ← CardHeader
│                                              │
│  42            [Badge · sublabel · tone]     │  ← CardContent flex justify-between
│  descripción muted xs                        │
└──────────────────────────────────────────────┘
```

### Mapa tone → badge

| tone    | className badge |
|---------|----------------|
| blue    | `bg-blue-500/10 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300` |
| green   | `bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300` |
| amber   | `bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300` |
| red     | `bg-destructive/10 text-destructive` |
| neutral | `bg-muted text-muted-foreground` |

### Tokens tipográficos (idénticos a AnalyticsKpiStrip)
- Título: `font-normal text-sm`
- Valor: `text-2xl leading-none tracking-tight`
- Sublabel: `text-xs text-muted-foreground`

---

## Referencia de implementación

Patrón del `AnalyticsKpiStrip` que debe replicarse:

```tsx
<Card>
  <CardHeader>
    <CardTitle className="font-normal text-sm flex items-center gap-1.5">
      <Icon className="size-4 text-muted-foreground" />
      {label}
    </CardTitle>
  </CardHeader>
  <CardContent className="flex flex-col gap-4">
    <div className="flex items-center justify-between gap-4">
      <div className="text-2xl leading-none tracking-tight">{value}</div>
      <Badge className={TONE_BADGE[tone]}>{sublabel ?? tone}</Badge>
    </div>
  </CardContent>
</Card>
```

---

## Call-sites afectados (26 archivos)

Todos los archivos que importan `KpiCard` de `@/components/shared/kpi-card`:

- `src/app/admin/page.tsx`
- `src/app/commerce/page.tsx`
- `src/app/integrations/page.tsx`
- `src/app/inventory/page.tsx`
- `src/app/load-manifests/page.tsx`
- `src/app/locations/page.tsx`
- `src/app/packing/page.tsx`
- `src/app/picking/_components/BatchTab.tsx`
- `src/app/picking/_components/ClusterTab.tsx`
- `src/app/picking/_components/PutToStoreTab.tsx`
- `src/app/picking/_components/TasksTab.tsx`
- `src/app/picking/_components/WavelessTab.tsx`
- `src/app/picking/_components/WavesTab.tsx`
- `src/app/picking/_components/ZoneTab.tsx`
- `src/app/picking/page.tsx`
- `src/app/receiving/page.tsx`
- `src/app/reports/_components/forecast-tab.tsx`
- `src/app/reports/_components/inventory-tab.tsx`
- `src/app/reports/_components/otif-tab.tsx`
- `src/app/reports/_components/productivity-tab.tsx`
- `src/app/returns/page.tsx`
- `src/app/serial-trace/page.tsx`
- `src/app/shipping/_components/otif-dashboard.tsx`
- `src/app/shipping/page.tsx`
- `src/app/slotting/page.tsx`
- `src/app/transfers/page.tsx`

**Cambios requeridos en call-sites:** Ninguno. La interfaz pública es compatible hacia atrás. Props `onClick` y `alert` son simplemente ignoradas.

---

## Criterios de aceptación

1. `KpiCard` renderiza con `bg-card` neutro en todos los tones
2. Icono visible como `size-4 text-muted-foreground` en el header
3. Badge refleja tone correcto con colores semánticos
4. Valor usa `text-2xl leading-none tracking-tight`
5. `sublabel` aparece como `text-xs text-muted-foreground`
6. Ningún call-site requiere modificación para compilar
7. Dark mode funciona en todos los tones
