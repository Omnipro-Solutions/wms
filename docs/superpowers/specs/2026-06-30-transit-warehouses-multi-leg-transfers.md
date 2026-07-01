# Spec: Bodegas Transitorias y Traslados Multi-Tramo

**Fecha:** 2026-06-30  
**Autor:** Carlos Granados  
**Estado:** Aprobado para implementación

---

## Contexto

El WMS actual modela `TransferOrder` como un movimiento directo punto a punto entre dos warehouses. No soporta nodos intermedios físicos (bodegas transitorias / hubs de distribución) ni itinerarios multi-salto donde el stock queda en tránsito entre recepciones parciales.

Los flujos reales de operación en Colombia requieren:

| Caso | Legs |
|------|------|
| Tienda → Tienda | 1 |
| Tienda → CD | 1 |
| CD → Tienda | 1 |
| CD → Tienda → Cliente | 2 (último leg dispara Shipment) |
| Tienda → CD → Cliente | 2 (último leg dispara Shipment) |
| Tienda → CD → Tienda | 2 |

"→ Cliente" no es un leg de traslado — al completar el último leg en el nodo de despacho, el flujo de `Shipment` normal toma control.

---

## Decisiones de diseño

| Decisión | Elección | Razón |
|----------|----------|-------|
| Modelo de datos | `TransferLeg[]` embebido en `TransferOrder` | Trazabilidad completa en una entidad; `advanceTransfer` se extiende, no se reemplaza |
| Recepción en tránsito | Recepción completa con conteo físico | Operaciones en nodos intermedios requieren inspección y conteo real |
| UX de recepción | En `/transfers` (nueva acción "Recepcionar") | El operador del destino gestiona desde traslados, no mezcla con inbound de proveedores |
| Creación multi-leg | Itinerario preconfigurado en origen | Cada nodo solo confirma llegada y despacha; no crea traslados manualmente |
| Stock en tránsito | Sin KPI global; solo visible en detalle del traslado | Decisión explícita del usuario — evita complejidad en dashboard |

---

## Cambios de tipos (`src/types/wms.ts`)

### 1. `Warehouse.type` — nuevo valor

```ts
type: 'distribution_center' | 'store' | 'transit'
```

Las bodegas `transit` son nodos físicos propios con ubicaciones (zona `staging` principalmente). Se crean en Admin igual que cualquier warehouse.

### 2. `TransitWarehouseRole` — nuevo tipo

```ts
export type TransitWarehouseRole = 'hub' | 'cross_dock' | 'consolidation'
```

Campos opcionales en `Warehouse` para bodegas transitorias:

```ts
transitRole?: TransitWarehouseRole
maxTransitDays?: number  // alerta si stock lleva más días sin re-despacho
```

### 3. `TransferLegStatus` — nuevo tipo

```ts
export type TransferLegStatus =
  | 'pending'      // leg creado, esperando despacho
  | 'in_transit'   // en camino al destino del leg
  | 'received'     // recepcionado en destino del leg
  | 'cancelled'
```

### 4. `TransferLeg` — nueva interfaz

```ts
export interface TransferLeg {
  id: string
  sequence: number           // 1-based: 1, 2, 3…
  originId: string           // warehouseId
  destinationId: string      // warehouseId (puede ser bodega transitoria)
  status: TransferLegStatus
  estimatedArrivalDate: string
  dispatchedAt?: string
  receivedAt?: string
  operatorName?: string
  notes?: string
}
```

### 5. `TransferOrder` — extensión

Se mantienen `originId` y `destinationId` (primer y último nodo) para compatibilidad con filtros y columnas existentes. Se agregan:

```ts
legs: TransferLeg[]          // siempre ≥1 elemento
isMultiLeg: boolean          // legs.length > 1
currentLegIndex: number      // índice del leg activo (0-based)
```

`TransferOrder.estimatedArrivalDate` pasa a referenciar la fecha del último leg.

---

## FSM

### `TransferLeg`

```
pending → in_transit → received
        ↘ cancelled
in_transit → cancelled
```

### `TransferOrder` (extendido)

```
draft → confirmed → in_progress → in_transit
                                → partial_received   (leg N recibido, N+1 activo)
                                → completed          (último leg recibido)
                                → cancelled
```

`partial_received` es un estado nuevo que se agrega a `transferTransitions` en `lib/state-machines.ts`.

---

## Lógica de store (`src/store/wms-store.ts`)

### `advanceTransfer` extendido

La función existente se refactoriza para operar leg a leg:

**Acción "Despachar"** (leg.status: `pending` → `in_transit`):
1. Validar FSM del leg.
2. `leg.dispatchedAt = now`, `leg.status = 'in_transit'`.
3. `StockMovement` tipo `transfer` en `originId` del leg (salida).
4. `InventoryItem.status = 'in_transit'` en origen.
5. Si es leg 1: `TransferOrder.status = 'in_transit'`.

**Acción "Recepcionar"** (leg.status: `in_transit` → `received`):
1. Validar FSM del leg.
2. `leg.receivedAt = now`, `leg.status = 'received'`, captura `operatorName` y `notes`.
3. Crear `InventoryItem` en `destinationId` del leg con `status = 'available'`.
4. `StockMovement` tipo `transfer` en `destinationId` (entrada).
5. Si hay leg siguiente: `currentLegIndex++`, `TransferOrder.status = 'partial_received'`.
6. Si es último leg: `TransferOrder.status = 'completed'`.

### Nueva acción `createTransferOrder`

```ts
createTransferOrder: (payload: {
  legs: Array<{ originId: string; destinationId: string; estimatedArrivalDate: string }>
  items: OrderLine[]
  operatorName: string
}) => TransferOrder
```

Genera automáticamente `TransferLeg[]` desde el array de legs del payload. El primer leg arranca en `pending`; los demás también en `pending` (se activan conforme se completan los anteriores).

---

## UI — `/transfers`

### Tabla principal

Nueva columna **"Nodo actual"**: muestra `leg[currentLegIndex].destinationId` resuelto a nombre de warehouse.

Nueva columna **"Tramos"**: `"1/2"`, `"2/2"`, `"1/1"` según `currentLegIndex+1 / legs.length`.

### Nuevos KPIs

| KPI | Lógica |
|-----|--------|
| En bodega transitoria | Traslados con `status = 'partial_received'` y destino del leg recibido es `type: 'transit'` |
| Multi-tramo activos | Traslados con `isMultiLeg = true` y `status` no terminal |

### `TransferDetailSheet` — sección de itinerario

Sección nueva encima de las líneas de producto:

```
ITINERARIO
○ ────────── ● ────────── ○
T.Norte    CD Bogotá    T.Sur
Leg 1 ✓    Leg 2 →
```

- Nodo completado: `●` verde con checkmark
- Nodo activo: `●` naranja/amber con flecha
- Nodo pendiente: `○` gris

Cada leg muestra: origen → destino, estado badge, fecha estimada, fecha real si aplica, operario.

### Dialog "Recepcionar traslado"

Acción disponible en el detalle cuando `leg[currentLegIndex].destinationId === warehouseActual` y `leg.status === 'in_transit'`. Dialog con:

- Líneas del traslado con cantidad esperada y campo cantidad recibida
- Campo discrepancia / notas
- Selector operario
- Botón "Confirmar recepción" → llama `advanceTransfer` con acción `receive`

### Dialog "Crear traslado"

Nuevo dialog accesible desde botón en header de `/transfers`:

```
Origen:           [selector warehouse]
¿Multi-tramo?     [ ] Agregar parada intermedia
  Parada 1:       [selector — solo type: 'transit']
  Fecha estimada: [date]
  [+ Agregar parada]
Destino final:    [selector warehouse]
Fecha estimada:   [date]
Productos:        [líneas con productId + cantidad]
```

---

## UI — `/admin`

### Lista de warehouses

Badge diferenciador para `type: 'transit'`: label **"Transitoria"** en amber.

### Formulario crear/editar warehouse

`type` selector agrega opción **"Bodega transitoria"**. Al seleccionar `transit`, aparecen campos opcionales:
- `transitRole`: selector Hub / Cross-dock / Consolidación
- `maxTransitDays`: número input

---

## Compatibilidad con código existente

| Área | Impacto |
|------|---------|
| `TransferOrder.originId / destinationId` | Se mantienen — apuntan a primer y último nodo |
| `TransferOrder.estimatedArrivalDate` | Se mantiene — fecha del último leg |
| `advanceTransfer` signature | Agrega parámetro opcional `action: 'dispatch' \| 'receive'` para distinguir las dos transiciones del leg |
| Traslados existentes en seed | Se migran con `legs: [{ sequence:1, originId, destinationId, status: mapFromOrderStatus }]`, `isMultiLeg: false`, `currentLegIndex: 0` |
| `transferTransitions` en `state-machines.ts` | Agrega `partial_received` como estado válido |
| Columnas de tabla existentes | Sin cambio — nuevas columnas se agregan, no reemplazan |

---

## Fuera de scope

- KPI global de stock en tránsito en dashboard (decisión explícita).
- Integración con manifiestos de carga para legs (puede venir después).
- Recepción parcial por línea en nodo intermedio (MVP: recepción completa del leg).
- Alertas automáticas por `maxTransitDays` (UI solo, sin notificaciones push).
