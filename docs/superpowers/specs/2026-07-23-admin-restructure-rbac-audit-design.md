# Admin restructure + RBAC + auditoría + turnos — Diseño

**Fecha:** 2026-07-23
**Funcionalidad base:** [21. Administración, configuración y seguridad](../../../funcionalidades_base_wms.md) — niveles Base y Estándar.

## Contexto y motivación

El `/admin` actual (`src/app/(app)/admin/page.tsx`, 883 líneas) es un solo archivo con 7 tabs (Operadores, Razones, Carriers, UoM, Productos, Configuración, Almacenes) mezclando formularios inline sin react-hook-form/zod. El resto del código ya tiene una convención madura: 11 módulos operativos tienen su propia página `[modulo]-settings` hermana (`slotting-settings`, `replenishment-settings`, `returns-settings`, etc.). Admin es el único que no sigue ese patrón.

Investigación previa confirmó:
- El tab **Configuración** de admin (umbrales ABC/XYZ, factor de reabastecimiento) es 100% redundante: esos mismos campos ya se editan por completo en `slotting-settings` y `replenishment-settings`.
- El tab **Productos** edita `rotationStrategy`, un campo que **no lo lee ningún otro código** (`selectByStrategy()` en `lib/rules/inventory.ts` está definida pero nunca se llama), y duplica min/max stock que ya se edita mejor en `replenishment-settings`. No existe hoy ninguna página para crear un producto nuevo pese a que `createProduct` existe sin usar en el store.
- El tab **Almacenes** solo edita ventanas de entrega; no existe en ningún lado un CRUD real de almacenes (`createWarehouse`/`updateWarehouse` existen sin usar).
- **Operadores**, **Razones** y **Carriers** no tienen otro hogar — hoy son solo toggle activo/inactivo, sin creación (excepto Razones, que tiene un diálogo de creación parcial y duplicado en `returns-settings`, acotado a `context: 'return'`).
- No existe RBAC granular: solo hay `Operator.role` (picker/packer/receiver/driver/supervisor), usado únicamente para enrutar workers a su app móvil. Cualquier rol no-worker (solo `supervisor` hoy) tiene acceso total al desktop.
- El mecanismo de gating por rol para el sidebar **ya existe** (`allowedRoles?: OperatorRole[]` en `sidebar-items.ts`), pero solo oculta enlaces — no hay enforcement de ruta en `middleware.ts` para roles de escritorio.
- No existe auditoría (`AuditLogEntry`) ni turnos (`Shift`) en ningún lado.
- `SlaConfig` existe en `types/wms.ts` pero no tiene UI en ningún lugar.

## Alcance

**Incluye:** extracción/limpieza de lo duplicado en admin, CRUD real de Usuarios/Razones/Carriers/Almacenes/UoM, RBAC de 3 roles de escritorio (page-level), auditoría de acciones sensibles, catálogo simple de turnos, página nueva de catálogo de Productos, UI de SLAs en `shipping-settings`.

**No incluye (explícitamente fuera de alcance para esta iteración):** roles/permisos custom (matrix configurable), gating a nivel de botón/acción individual, integración de turnos con `/labor` o `/labor-settings`, auditoría de las 75+ acciones del store (solo las sensibles listadas abajo).

## A. Topología de rutas

`Administración` pasa a ser un ítem padre del sidebar con sub-ítems, igual que `Configuración` ya funciona hoy:

```
Administración (padre, ícono Settings2)
├── /admin                 landing: salud del store + accesos rápidos + "Resetear demo"
├── /admin/users           Usuarios          (antes: tab Operadores)
├── /admin/roles           Roles y permisos  (nuevo)
├── /admin/reasons         Razones           (antes: tab Razones, ahora CRUD completo)
├── /admin/carriers        Carriers          (antes: tab Carriers, ahora CRUD completo)
├── /admin/warehouses      Almacenes         (antes: tab Almacenes, ahora CRUD completo)
├── /admin/uom             Unidades de medida (igual que hoy, se mueve de tab a página)
├── /admin/shifts          Turnos            (nuevo)
└── /admin/audit-log       Auditoría         (nuevo)
```

Cada sub-ruta es su propio `page.tsx` con su propio `_components/` para diálogos — mismo patrón que `inventory-settings`, `slotting-settings`, etc. No se usa `SubNav`/tabs dentro de un archivo único.

Fuera de Admin:
- **`/products`** (nueva, grupo de nav "Entrada", junto a Inventario) — catálogo de productos, CRUD completo.
- **Tab "Configuración"** de admin — **se elimina sin reemplazo** (ya vive en `slotting-settings`/`replenishment-settings`).
- **`rotationStrategy`** en `Product` y **`selectByStrategy()`** en `lib/rules/inventory.ts` — se eliminan (código muerto confirmado).
- **`shipping-settings`** gana una sección nueva "SLAs por canal" (CRUD de `SlaConfig`).

## B. Modelo de datos

```ts
// src/types/wms.ts

// Operator — extender union existente
export interface Operator {
  // ...
  role: 'picker' | 'packer' | 'receiver' | 'driver' | 'supervisor' | 'admin' | 'viewer'
  shiftId?: string // NUEVO — turno asignado
}

// Product — agregar, quitar rotationStrategy
export interface Product {
  // ...
  active: boolean // NUEVO — reemplaza el borrado físico
  // rotationStrategy?: ... → ELIMINAR (código muerto, cero call sites)
}

// NUEVO
export interface Shift {
  id: string
  warehouseId: string
  name: string
  daysOfWeek: number[] // 0=domingo … 6=sábado, misma convención que DeliveryWindow
  startTime: string // 'HH:mm'
  endTime: string // 'HH:mm'
  active: boolean
}

// NUEVO
export interface AuditLogEntry {
  id: string
  timestamp: string // ISO
  operatorId: string | null
  operatorName: string // snapshot — sobrevive a renombres/desactivación posterior
  action: string // ej. 'operator.role_change', 'settings.update', 'inventory.hold'
  summary: string // descripción en español para la tabla
  entityType?: string
  entityId?: string
}
```

`Operator['role']` alimenta `OperatorRole` (`src/lib/worker-routes.ts`) por derivación de tipo — no requiere tipo nuevo. `ROLE_ROUTES` (Record exhaustivo) necesita entradas para `admin` y `viewer` (ambas → `/`, aunque nunca se alcanzan vía `resolveWorkerRoute` porque `WORKER_ROLES` no las incluye).

## C. RBAC

Tres roles de escritorio: **admin** (todo, incl. `/admin/*`), **supervisor** (todo lo operativo, sin `/admin/*`), **viewer** (solo `/` y `/reports`).

Gating a **nivel de página/ruta únicamente** (no por botón) — por eso viewer no puede tener acceso parcial a páginas como `/inventory` que mezclan vistas de lectura con botones de hold/adjust; su allowlist se limita a páginas que son de solo-lectura por naturaleza.

**`middleware.ts`** — se agregan 2 reglas a la lógica existente de redirección por rol (reutiliza la cookie `wms-operator-role` que ya se setea en login):

```ts
if (role === 'viewer' && pathname !== '/' && !pathname.startsWith('/reports')) {
  return NextResponse.redirect(new URL('/', request.url))
}
if (role === 'supervisor' && pathname.startsWith('/admin')) {
  return NextResponse.redirect(new URL('/', request.url))
}
```

Deliberadamente 2 reglas puntuales en vez de una tabla completa ruta×rol para las ~30 rutas existentes — admin/supervisor mantienen el acceso implícito total de hoy, solo se agregan las 2 restricciones nuevas que introduce este diseño.

**`sidebar-items.ts`** (el campo `allowedRoles` ya existe por ítem, solo se completa):
- Agregar `'admin'` junto a cada `'supervisor'` existente.
- Descomentar el ítem de Reportes con `allowedRoles: ['supervisor', 'admin', 'viewer']`.
- Nuevo ítem padre "Administración" con `allowedRoles: ['admin']` y los 8 sub-ítems.
- Nuevo ítem `/products` con `allowedRoles: ['supervisor', 'admin']`.

**`/admin/roles`** — matriz de solo lectura (no editable, los roles son fijos): filas = grupos de nav, columnas = Admin/Supervisor/Solo lectura, check/cross derivado de la misma regla de arriba. Satisface la visibilidad de "permisos granulares" sin necesitar un editor de roles custom.

## D. Auditoría

**Cubre** (acciones sensibles, no las 75+ mutaciones del store): login/logout, CRUD de usuarios + cambios de rol, CRUD de almacenes/carriers/razones/UoM/productos/turnos, hold/release/adjust de inventario, cualquier `updateSettings` (todas las páginas `*-settings` + admin), reset de demo.

**Integración** — nueva acción interna del store, mismo patrón que el append de `StockMovement`:

```ts
appendAuditLog: (action: string, summary: string, entityType?: string, entityId?: string) => void
```

Lee `currentOperatorId` (ya existe en el store) para el snapshot de nombre, timestamp propio, y antepone a `auditLog: AuditLogEntry[]`. Cada acción cubierta agrega una línea llamando a esta acción — `updateSettings` construye el summary a partir de las keys del payload (`"Configuración actualizada: abcThresholdA, abcThresholdB"`), cubriendo todas las páginas de settings sin cableado por página. `login`/`logout` en `auth-store.ts` la invocan vía `useWmsStore.getState()`, igual que ya hacen con `setCurrentOperator`.

**UI (`/admin/audit-log`)** — `DataTable` (operador, acción, resumen, fecha) más reciente primero, filtrable por operador y tipo de acción. Solo lectura — el log es append-only por naturaleza.

## E. Turnos

Catálogo simple, sin integración con `/labor` (decisión explícita). CRUD en `/admin/shifts`: nombre, almacén, días, horario, activo — mismo patrón de diálogo react-hook-form+zod que Razones/Carriers. La asignación operario→turno se hace agregando un select "Turno" al diálogo de operador existente en `/admin/users`, no en una pantalla separada.

## F. Contenido final de cada pantalla

- **`/admin`** — landing: card "Estado del almacén local" (igual que hoy) + accesos rápidos a los 8 sub-módulos + botón "Resetear demo".
- **`/admin/users`** — CRUD de operadores: nombre, código, email, rol (incl. admin/viewer), turno, activo.
- **`/admin/roles`** — matriz de solo lectura descrita en sección C.
- **`/admin/reasons`** — CRUD completo, los 8 contextos (return, partial_picking, adjustment, scrap, hold, internal_move, transfer_discrepancy, picking_issue).
- **`/admin/carriers`** — CRUD completo incl. servicios y zonas (hoy ni siquiera el toggle permite editarlos).
- **`/admin/warehouses`** — CRUD completo (código, nombre, ciudad, tipo) + editor de ventanas de entrega (ya existente, se conserva).
- **`/admin/uom`** — igual que el tab actual, sin cambios de funcionalidad, solo de ubicación.
- **`/admin/shifts`** — CRUD de turnos, sección E.
- **`/admin/audit-log`** — visor de auditoría, sección D.
- **`/products`** (nueva, fuera de Admin) — tabla: SKU, nombre, categoría, código de barras, peso, volumen, track-by, UM base, stock mín/máx (solo lectura, enlaza a `replenishment-settings`), estado. Diálogo crear/editar con react-hook-form+zod. Toggle activo/inactivo en vez de borrado físico.
- **`shipping-settings`** — nueva sección "SLAs por canal": alta/edición/baja de `SlaConfig` (canal, tipo de cumplimiento, horas máx, % de alerta), junto a los parámetros de OTIF existentes.

## Riesgos / consideraciones para el plan de implementación

- Extender `Operator['role']` es un cambio de tipo amplio — hay que revisar todo lugar que haga switch/map exhaustivo sobre `Operator['role']` (ej. `ROLE_LABELS` en el propio admin, `ROLE_ROUTES` en `worker-routes.ts`) para agregar los 2 casos nuevos.
- `Product.active` es un campo nuevo — los productos sembrados en `src/data/seed.ts` necesitan el default `active: true`.
- Los ~25 call-sites que deben llamar a `appendAuditLog` son mecánicos pero numerosos; conviene implementarlos módulo por módulo, no todos de una vez.
- El diálogo de creación de Razones ya existe duplicado en `returns-settings` (acotado a contexto `return`/`scrap`) — no se toca ni se elimina, queda como atajo local existente fuera de este alcance.
