# Sprint 8 — Despacho y Transporte: Fix + Fundamentos

**Fecha:** 2026-06-26
**Sección objetivo:** F — Gestión de Despacho y Transporte
**Cobertura actual:** 28% → **Meta:** ~55%
**Alcance:** Cliente-only (Zustand + localStorage). Sin nuevas rutas. Sin backend.

---

## Contexto

Sección F es la más débil del gap analysis (28%). `/sap-routes` crashea en runtime porque `state.sapRoutes` no existe en el store. Este sprint corrige ese crash y construye los tipos base que habilitan sprints futuros (Yard Management, flujo despacho completo).

## Ítems cubiertos

| Ítem | Descripción | Antes | Meta |
|------|-------------|-------|------|
| F-85 | `/sap-routes` fix crash + `SapRoute` tipo real en store | 45% | 85% |
| F-82 | Citas ASN con muelle + ventana horaria + confirmación transportista | 20% | 65% |
| F-86 | `modalityType` en `Carrier` + filtro + columna en `/shipping` | 50% | 80% |
| F-91 | `deliveryWindows` en `Warehouse` + UI en `/admin` | 0% | 60% |

**Excluidos (post-MVP):** F-81 (Yard Management — dominio nuevo alto esfuerzo), F-83 (PDF real — requiere servidor), F-84 (TMS API — requiere backend), F-87/88/89 (flujo despacho completo — Sprint 9-F), F-90 (contenedores transporte — nuevo dominio).

---

## Arquitectura

Todos los cambios siguen el patrón establecido del proyecto:

```
src/types/wms.ts          ← tipos nuevos / campos nuevos
src/data/seed.ts          ← datos demo para SapRoute + carrier modalityType + deliveryWindows
src/store/wms-store.ts    ← slice sapRoutes[] + acciones nuevas
src/app/sap-routes/       ← fix crash (columns.tsx simplificado)
src/app/receiving/        ← AppointmentDialog nuevo en _components/
src/app/shipping/         ← filtro + columna modalityType
src/app/admin/            ← sección deliveryWindows en CRUD almacén
```

**Sin nuevas rutas.** Sin archivos de tests (lógica de store, no reglas puras — no aplica TDD aquí).

---

## Sección 1: Tipos nuevos (`src/types/wms.ts`)

### 1.1 `SapRoute`

Tipo real que reemplaza el `SapRouteRow` inline de `columns.tsx`. El page ya lo espera en `state.sapRoutes`.

```ts
export type SapRouteStatus =
  | 'pending'
  | 'in_progress'
  | 'in_transit'
  | 'completed'
  | 'synced'
  | 'error'

export interface SapRoute {
  id: string
  code: string               // e.g. 'SAP-RT-001'
  name: string               // e.g. 'Ruta Bogotá Norte'
  originId: string           // warehouseId del CD origen
  destinationIds: string[]   // warehouseIds de tiendas destino
  carrierName: string
  driverName: string
  truckPlate: string
  routeDate: string          // ISO date 'YYYY-MM-DD'
  currentLoadKg: number
  capacityKg: number
  status: SapRouteStatus
}
```

### 1.2 `Asn` — 3 campos opcionales nuevos

Agregar a la interfaz `Asn` existente (línea ~207 en wms.ts):

```ts
dockId?: string           // muelle asignado ('dock-1'..'dock-4')
timeSlot?: string         // ventana horaria, e.g. '08:00-10:00'
carrierConfirmed?: boolean // transportista confirmó la cita
```

### 1.3 `Carrier` — 1 campo nuevo

Agregar a `interface Carrier` (línea ~747):

```ts
modalityType: 'own' | 'third_party' | 'courier' | 'last_mile'
```

### 1.4 `Warehouse` — 1 campo nuevo

Agregar a `interface Warehouse`:

```ts
deliveryWindows?: DeliveryWindow[]
```

Nueva interfaz (antes de `Warehouse`):

```ts
export interface DeliveryWindow {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6  // 0=domingo, 1=lunes, ...
  openTime: string   // 'HH:mm' — hora apertura recepción
  closeTime: string  // 'HH:mm' — hora cierre recepción
}
```

---

## Sección 2: Seed (`src/data/seed.ts`)

### 2.1 SapRoute seed — 6 rutas

```
SAP-RT-001  Ruta Bogotá Norte      DC Bogotá → Tienda Chapinero + Tienda Usaquén        status: in_transit
SAP-RT-002  Ruta Bogotá Sur        DC Bogotá → Tienda Kennedy                           status: synced
SAP-RT-003  Ruta Medellín Norte    DC Medellín → Tienda Laureles                        status: completed
SAP-RT-004  Ruta Medellín Sur      DC Medellín → Tienda Envigado                        status: in_transit
SAP-RT-005  Ruta Nacional Caribe   DC Bogotá → múltiples destinos Costa                 status: pending
SAP-RT-006  Ruta Nacional Eje Cafetero  DC Bogotá → Pereira/Manizales                   status: error
```

Capacidades: 5.000-8.000 kg. Carga actual: 50-95% de capacidad. Conductores/placas ficticias colombianas (formato ABC-123).

### 2.2 `Carrier` seed — agregar `modalityType`

| Carrier | modalityType |
|---------|-------------|
| Servientrega | courier |
| TCC | third_party |
| Coordinadora | courier |
| Flota propia | own |

### 2.3 `Warehouse` seed — `deliveryWindows` en tiendas

Las 4 tiendas reciben de lunes a sábado 08:00-18:00. Los 2 DCs no tienen `deliveryWindows` (son origen, no destino).

---

## Sección 3: Store (`src/store/wms-store.ts`)

### 3.1 Nuevo slice de estado

```ts
sapRoutes: SapRoute[]   // inicializado desde seed
```

Agregar al estado inicial y a la función de hidratación desde localStorage.

### 3.2 Acción: `updateSapRouteStatus`

```ts
updateSapRouteStatus: (id: string, status: SapRouteStatus) => void
```

Avanza estado de una ruta SAP manualmente (simula sync desde SAP). Transiciones válidas:

```
pending → in_progress → in_transit → completed
any → synced    (sincronización exitosa SAP)
any → error     (fallo de sync)
```

### 3.3 Acción: `updateWarehouseDeliveryWindows`

```ts
updateWarehouseDeliveryWindows: (id: string, windows: DeliveryWindow[]) => void
```

Reemplaza el array `deliveryWindows` del warehouse indicado. Spread inmutable sobre el warehouse existente.

### 3.4 Acción: `updateAsnAppointment`

```ts
updateAsnAppointment: (
  id: string,
  data: { dockId?: string; timeSlot?: string; carrierConfirmed?: boolean }
) => void
```

Actualiza los campos de cita de un ASN. No cambia el `status` del ASN.

---

## Sección 4: UI

### 4.1 `/sap-routes` — Fix crash (F-85)

**`src/app/sap-routes/columns.tsx`:**
- Eliminar `interface SapRouteRow` — ya no es necesario un tipo de fila separado
- Cambiar `ColumnDef<SapRouteRow>` → `ColumnDef<SapRoute>`
- Importar `SapRoute` desde `@/types/wms`
- Acceder a campos directamente (sin `originName`/`destinationNames` calculados en page): mover el enriquecimiento de nombres al page mediante `useStoreHelpers`

**`src/app/sap-routes/page.tsx`:**
- Ningún cambio estructural — `state.sapRoutes` ahora existe → página funciona
- Agregar botón "Estado" en cada fila: `DropdownMenu` shadcn con `DropdownMenuItem` por cada transición válida desde el estado actual. Al seleccionar → llama `updateSapRouteStatus(id, newStatus)`. Transiciones válidas según FSM de §3.2.

### 4.2 `/receiving` tab "Citas" — Muelle + Ventana horaria (F-82)

**`src/app/receiving/_components/appointment-dialog.tsx`** (nuevo):

Dialog accionado desde columna "Citas ASN" con botón "Asignar cita". Campos:

| Campo | Control | Opciones |
|-------|---------|---------|
| Muelle | Select | Dock 1, Dock 2, Dock 3, Dock 4 |
| Ventana horaria | Select | 06:00-08:00, 08:00-10:00, 10:00-12:00, 12:00-14:00, 14:00-16:00, 16:00-18:00 |
| Confirmado por transportista | Switch | — |

Al guardar: llama `updateAsnAppointment(id, { dockId, timeSlot, carrierConfirmed })`.

**`src/app/receiving/columns.tsx`** — tab appointments:
- Agregar columnas: "Muelle" (badge si asignado, `—` si no), "Ventana" (badge horario), "Confirmado" (icono ✓/✗)
- Agregar columna "Acción" con botón "Asignar" que abre `AppointmentDialog`

**`src/app/receiving/page.tsx`:**
- Importar y montar `AppointmentDialog` + su hook `useDialogState`

### 4.3 `/shipping` — Modalidad de carrier (F-86)

**`src/app/shipping/columns.tsx`:**
- Nueva columna "Modalidad" en tab Envíos: muestra `carrier.modalityType` del envío como badge
  - `own` → "Flota propia" (verde)
  - `third_party` → "Tercero" (azul)
  - `courier` → "Courier" (violeta)
  - `last_mile` → "Última milla" (naranja)

**`src/app/shipping/page.tsx`:**
- Nuevo filtro `modalityType` Select en tab "Envíos" (junto a los filtros existentes)
- Para resolver `modalityType` desde un `Shipment`: join via `carrierId` con el slice `carriers[]` del store

### 4.4 `/admin` tab "Almacenes" — Ventanas de entrega (F-91)

**`src/app/admin/page.tsx`** — sección almacenes:
- Expandir el drawer/dialog de edición de almacén con sección colapsable "Ventanas de entrega"
- Tabla inline editable: día (Select lunes-domingo), apertura (input `HH:mm`), cierre (input `HH:mm`), botón eliminar fila
- Botón "Agregar ventana"
- Acción store: `updateWarehouseDeliveryWindows(id: string, windows: DeliveryWindow[]) => void`

---

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `src/types/wms.ts` | Modificar | `SapRoute`, `SapRouteStatus`, `DeliveryWindow`, campos en `Asn`/`Carrier`/`Warehouse` |
| `src/data/seed.ts` | Modificar | 6 `SapRoute` seed, `modalityType` en carriers, `deliveryWindows` en tiendas |
| `src/store/wms-store.ts` | Modificar | Slice `sapRoutes[]`, acciones `updateSapRouteStatus`, `updateAsnAppointment`, `updateWarehouseDeliveryWindows` |
| `src/app/sap-routes/columns.tsx` | Modificar | Usar `SapRoute` directo, eliminar `SapRouteRow` inline |
| `src/app/sap-routes/page.tsx` | Modificar | Botón avance de estado por fila |
| `src/app/receiving/columns.tsx` | Modificar | Columnas muelle/ventana/confirmado + botón "Asignar" |
| `src/app/receiving/_components/appointment-dialog.tsx` | Crear | Dialog asignación muelle + ventana horaria |
| `src/app/receiving/page.tsx` | Modificar | Montar `AppointmentDialog` |
| `src/app/shipping/columns.tsx` | Modificar | Columna "Modalidad" con badge |
| `src/app/shipping/page.tsx` | Modificar | Filtro `modalityType` en tab Envíos |
| `src/app/admin/page.tsx` | Modificar | Sección `deliveryWindows` en CRUD almacenes |

---

## Constraints globales

- UI 100% español (es-CO) — nunca inglés en labels, badges, placeholders
- Fechas: siempre `date-fns` con locale `es`
- Componentes: arrow functions — `const MyComp = () => {}`
- Clause guards antes del happy path
- Clases CSS: siempre `cn()` — nunca template literals
- Tipos: siempre importar de `src/types/wms.ts` — nunca redefinir inline
- Default exports solo en `page.tsx` y `layout.tsx`
- Formularios: react-hook-form + zod — nunca `useState` crudo para form state
- No ternarios anidados
