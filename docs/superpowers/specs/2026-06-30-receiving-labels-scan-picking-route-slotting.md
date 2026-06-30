# Spec: Etiquetado en Recepción · Picking Móvil por Barcode · Slotting por Ruta

**Fecha:** 2026-06-30  
**Estado:** Aprobado — listo para implementación  
**Alcance:** 3 funcionalidades independientes, implementables en paralelo o en secuencia

---

## F1 — Etiquetado obligatorio en recepción (ZPL)

### Problema

Los productos recibidos entran a staging sin identificación física. El campo `trackBy: lot | serial` en `Product` existe pero no se materializa en etiquetas durante la recepción. Esto rompe la trazabilidad FIFO y hace imposible el rastreo de lotes en picking y devoluciones.

### Solución

Generación automática de etiquetas ZPL al confirmar recepción de cada línea de ASN. El putaway queda bloqueado hasta que todas las etiquetas del ASN estén impresas.

### Cambios en tipos (`src/types/wms.ts`)

```ts
// WmsLabel.type agrega 'receipt'
type: 'product' | 'location' | 'box' | 'pallet' | 'shipping' | 'return' | 'receipt'

// Campos adicionales solo para receipt labels
interface WmsLabel {
  // ... campos existentes ...
  asnId?: string          // solo para type === 'receipt'
  lot?: string
  expirationDate?: string
  receivedQty?: number
  poNumber?: string
}
```

### Cambios en estado ASN

El flujo ASN agrega estado intermedio `labels_pending`:

```
confirmed → in_progress → labels_pending → putaway_ready → completed
```

- `labels_pending`: recepción registrada, etiquetas generadas pero no todas impresas
- `putaway_ready`: todas las etiquetas del ASN tienen `status === 'printed'`

### Cambios en store (`src/store/wms-store.ts`)

**`receiveAsn()` modificado:**
- Al registrar qty por línea, crea automáticamente `WmsLabel[]` tipo `receipt`
- Si `trackBy === 'serial'`: una etiqueta por unidad
- Si `trackBy === 'lot'` o `'none'`: una etiqueta por línea
- Avanza ASN a `labels_pending` (no directamente a putaway_ready)

**Nueva acción `printReceiptLabel(labelId: string)`:**
- Cambia `WmsLabel.status` a `'printed'`
- Evalúa si todas las etiquetas del ASN están `printed`
- Si sí → avanza ASN a `putaway_ready`
- Agrega `StockMovement` tipo `receipt` con referencia al labelId

### Cambios en UI

**Tab "Recibiendo" (`columns-receiving.tsx`):**
- Nueva columna "Etiquetas": badge `N/N impresas` (ej. `3/5 impresas`)
- Badge rojo si pendientes, verde si completo

**`ReceptionSheet` (`_components/reception-sheet.tsx`):**
- Por cada línea recibida: botón "Imprimir etiqueta" → abre `ZplPreviewDialog` existente
- `ZplPreviewDialog` recibe el `WmsLabel` de tipo `receipt`

**Tab "Putaway staging":**
- Clause guard: si ASN tiene `status === 'labels_pending'`, muestra banner de bloqueo
- Banner incluye conteo de etiquetas pendientes y CTA "Ir a imprimir etiquetas" → navega al tab "Recibiendo" filtrando ese ASN

### ZPL payload

Campos incluidos en el barcode GS1-128:
- SKU (Application Identifier 01)
- Lote (AI 10)
- Fecha de vencimiento (AI 17)
- Cantidad (AI 37)
- Número PO (AI 400)

Texto legible: nombre producto, SKU, PO#, qty, fecha vencimiento, nombre bodega.

### Seed data

Agregar `WmsLabel[]` tipo `receipt` en `seed.ts` para los ASNs con status `putaway_ready` o `completed`, con `status: 'printed'`.

---

## F2 — Picking móvil BYOD por barcode

### Problema

Las tareas de picking solo son operables desde desktop/tablet con UI de tabla. No existe flujo optimizado para operarios con celular o lector bluetooth BYOD que necesitan confirmación física por barcode en ubicación y producto.

### Solución

Nueva ruta `/picking/scan/[taskId]` con UI mobile-first de pantalla única. Orquesta el flujo de picking en 3 pasos secuenciales de escaneo. Reutiliza todas las acciones de store existentes.

### Cambios en tipos (`src/types/wms.ts`)

```ts
interface StorageLocation {
  // ... campos existentes ...
  barcode: string   // código para escanear con lector (ej. "LOC-A-01-03")
}
```

### Nueva ruta `src/app/(app)/picking/scan/[taskId]/page.tsx`

Page component mobile-first. Layout de pantalla completa sin sidebar.

**Estados del componente:**
```ts
type ScanPhase = 'location' | 'product' | 'quantity' | 'confirm'
```

**Flujo por fase:**

**Fase 1 — Ubicación:**
- Muestra: zona + código slot en tipografía grande (ej. "ZONA A · A-01-03")
- Input `autoFocus` con `inputMode="none"` captura scan bluetooth
- Validación: `scanned === location.barcode`
- Feedback visual 800ms: overlay verde (match) / rojo + vibración (mismatch)

**Fase 2 — Producto:**
- Muestra: imagen del producto + SKU + nombre
- Mismo input de scan
- Validación: `scanned === product.barcode`

**Fase 3 — Cantidad:**
- Muestra: qty solicitada en grande
- Input numérico `inputMode="numeric"`
- Si qty < solicitada: trigger flujo partial pick (dialog inline)
- Botón "Confirmar"

**Fase 4 — Confirmación:**
- Llama `completePick(taskId, qty)` existente
- Si hay siguiente tarea asignada al operario → redirige automáticamente
- Si no hay más → pantalla "¡Wave completada!" con CTA volver a `/picking`

### Componentes nuevos

**`ScanStep` (`_components/scan-step.tsx`):**
```tsx
interface Props {
  title: string
  hint: string
  expectedCode: string
  onMatch: () => void
  onError?: (scanned: string) => void
}
```
Input `autoFocus` + feedback overlay. Reutilizable en F1 (recepción) y futuro putaway scan.

**`ScanFeedback` (`_components/scan-feedback.tsx`):**
Overlay fullscreen verde/rojo, dura 800ms, luego desaparece. Usa `setTimeout` + estado local.

**`QuantityStep` (`_components/quantity-step.tsx`):**
Input numérico grande, muestra qty solicitada vs ingresada, botón confirmar.

### Acceso desde desktop

En `columns.tsx` de picking (tab Tareas):
- Nueva columna o acción en dropdown: icono `<Scan>` de lucide-react
- Solo visible para tareas con status `assigned` o `in_progress`
- Navega a `/picking/scan/[taskId]`

### Sin nueva lógica de store

Acciones usadas: `startPicking`, `completePick`, `approvePart`, `rejectPart` — todas existentes.

### Seed data

`StorageLocation` en `seed.ts` agrega campo `barcode` a todas las ubicaciones. Formato: `"LOC-{zone}-{code}"` (ej. `"LOC-A-A-01-03"`).

---

## F3 — Slotting por ruta de manifiesto

### Problema

El `slottingScore` actual optimiza distancia al despacho genérico (`distanceToDispatchM`). Productos que sistemáticamente salen por una ruta específica deberían estar cerca del staging de esa ruta, no del muelle genérico. Esta información ya existe en `LoadManifest` pero no se usa en slotting.

### Solución

Nuevo selector `selectRouteSlottingRecommendations` que cruza frecuencia de picking con rutas de manifiesto. Tab nuevo "Por ruta" en `/slotting`. Completamente aislado del slotting existente.

### Cambios en tipos (`src/types/wms.ts`)

```ts
interface StorageLocation {
  // ... campos existentes ...
  routeCode?: string   // ej. "RUTA-BOG-NORTE" — identifica staging de esa ruta
}

interface RouteSlottingRecommendation {
  productId: string
  routeCode: string            // ruta predominante del producto
  routeLabel: string           // nombre legible de la ruta
  currentLocationId: string
  candidateLocationId: string
  routePickFrequency: number   // ratio: picks en esta ruta / total picks del producto (0-1)
  currentDistanceToStagingM: number
  candidateDistanceToStagingM: number
  distanceGainM: number        // ahorro por pick
  totalDistanceSavedM: number  // distanceGainM × pickingFrequency del producto
  score: number                // 0-100 para ordenar tabla
}
```

### Nuevo selector (`src/store/selectors.ts`)

```ts
export function selectRouteSlottingRecommendations(
  state: WmsState
): RouteSlottingRecommendation[]
```

**Algoritmo:**

1. Por cada producto con `ProductDemandStat`, recopilar todos los `LoadManifest` completados que contienen `PickingTask` de ese producto
2. Agrupar por `routeCode` del manifiesto — calcular frecuencia relativa por ruta
3. Seleccionar ruta predominante: la de mayor frecuencia si supera 40% del total de picks
4. Calcular distancia promedio de la ubicación actual del producto al staging de esa ruta (ubicaciones con `routeCode === rutaPredominante`)
5. Buscar ubicaciones de picking sin `routeCode` (ubicaciones normales) más cercanas al staging de esa ruta
6. Generar `RouteSlottingRecommendation` si `distanceGainM > 10` (evitar ruido)
7. Ordenar por `totalDistanceSavedM` descendente

**Condición de no-recomendación:** producto sin ruta predominante clara (<40% en cualquier ruta) → no aparece en lista (distribución uniforme entre rutas, slotting clásico es suficiente).

### UI — Tab "Por ruta" en `/slotting`

**Posición:** 6to tab después de los 5 existentes.

**Tabla columnas:**
| Columna | Descripción |
|---------|-------------|
| Producto | SKU + nombre |
| Ruta predominante | `routeLabel` + `routeCode` |
| % picks en ruta | `routePickFrequency` como porcentaje |
| Ubicación actual | código + distancia actual a staging |
| Ubicación propuesta | código + distancia propuesta |
| Ahorro total | `totalDistanceSavedM` en metros con frecuencia |
| Score | badge 0-100 |
| Acción | Botón "Reubicar" |

**Botón "Reubicar":** llama `relocateInventory()` existente con `fromLocationId` → `candidateLocationId`. Misma UX que recomendaciones clásicas.

**Estado vacío:** si no hay productos con ruta predominante clara, muestra `EmptyState` con mensaje "No hay suficiente historial de manifiestos para detectar patrones de ruta."

### Seed data

- Agregar `routeCode` a ubicaciones de staging en `seed.ts` (ej. zonas de staging de cada ruta existente en `LoadManifest`)
- Asegurar que `LoadManifest` completados referencien `routeCode` coherente con las ubicaciones

### Aislamiento garantizado

- `slottingScore()` en `src/lib/rules/slotting.ts`: sin cambios
- Tabs 1-5 de `/slotting`: sin cambios
- `selectSlottingRecommendations`: sin cambios
- Nuevo selector es función pura independiente

---

## Dependencias entre funcionalidades

| F1 | F2 | F3 |
|----|----|----|
| Independiente | Requiere `barcode` en `StorageLocation` (también útil para F1 putaway futuro) | Independiente |

F2 agrega `StorageLocation.barcode` — si F1 evoluciona a escaneo en putaway en el futuro, reutiliza ese campo.

## Orden de implementación sugerido

1. **F1** — prerequisito de trazabilidad. Desbloquea lot/serial tracking real.
2. **F3** — alto impacto, bajo riesgo. Solo selector nuevo + tab nuevo.
3. **F2** — mayor esfuerzo UI. Requiere seed data actualizado de F2 (`barcode` en locations).

## Archivos a crear/modificar (resumen)

### F1
- `src/types/wms.ts` — extender `WmsLabel.type` y campos opcionales
- `src/store/wms-store.ts` — modificar `receiveAsn`, agregar `printReceiptLabel`
- `src/app/(app)/receiving/_columns/columns-receiving.tsx` — columna etiquetas
- `src/app/(app)/receiving/_components/reception-sheet.tsx` — botón imprimir
- `src/data/seed.ts` — receipt labels para ASNs completados

### F2
- `src/types/wms.ts` — agregar `barcode` a `StorageLocation`
- `src/app/(app)/picking/scan/[taskId]/page.tsx` — nueva página
- `src/app/(app)/picking/scan/[taskId]/_components/scan-step.tsx`
- `src/app/(app)/picking/scan/[taskId]/_components/scan-feedback.tsx`
- `src/app/(app)/picking/scan/[taskId]/_components/quantity-step.tsx`
- `src/app/(app)/picking/columns.tsx` — agregar acción scan
- `src/data/seed.ts` — agregar `barcode` a todas las `StorageLocation`

### F3
- `src/types/wms.ts` — agregar `routeCode` a `StorageLocation`, nuevo `RouteSlottingRecommendation`
- `src/store/selectors.ts` — agregar `selectRouteSlottingRecommendations`
- `src/app/(app)/slotting/page.tsx` — agregar tab "Por ruta"
- `src/app/(app)/slotting/columns.tsx` — columnas para tab de ruta
- `src/data/seed.ts` — agregar `routeCode` a ubicaciones de staging
