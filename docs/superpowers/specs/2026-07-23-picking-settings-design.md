# Picking / preparación de pedidos — configuración base y estándar

**Fecha:** 2026-07-23
**Módulo de referencia:** `docs/funcionalidades_base_wms.md` → #5 Picking / preparación de pedidos
**Estado:** Aprobado para implementación

---

## Objetivo

Picking es hoy el único módulo operativo del catálogo de referencia sin capa de configuración (`WmsSettings`), sin freeze de gobierno y sin manejo de excepciones (`with_issue` existe en el tipo y en el FSM pero nunca se dispara). Este diseño lo nivela con el resto de módulos (`inventory-settings`, `returns-settings`, `replenishment-settings`, etc.) agregando:

1. Página `/picking-settings` con parámetros del módulo.
2. Freeze de picking aplicado a las 15 acciones de store relacionadas.
3. Prioridad automática sugerida por SLA de despacho.
4. Manejo de excepciones con foto y sustitución de producto (gap "Estándar" del catálogo de referencia).
5. Catálogo de zonas de picking (pick-and-pass) con orden de secuencia.

Fuera de alcance (documentado como línea futura): orquestación automática de estrategia ("order streaming"), picking por voz/RFID, goods-to-person.

---

## 1. Persistencia

Sin cambios de infraestructura. El store Zustand completo (incluyendo `settings`) ya persiste vía `idbStorage` (`src/lib/idb-storage.client.ts`, IndexedDB `wms-db`). Los nuevos campos de `WmsSettings` y los nuevos campos de `PickingTask` viajan automáticamente con el resto del estado — no se crea ningún object store nuevo.

## 2. `WmsSettings` — nuevos campos

```ts
// Picking module (#5) — configured in /picking-settings.
// Congela iniciar/completar/aprobar/rechazar picks, waves, batch, cluster,
// put-to-store, waveless y reporte/resolución de incidencias.
pickingFreezeActive: boolean

// SLA de despacho → prioridad sugerida al crear tarea/oleada/orden waveless.
// horas restantes < Urgent → 'high'; < Warning → 'medium'; resto → 'low'.
pickingSlaUrgentHours: number   // default 4
pickingSlaWarningHours: number  // default 12

// Umbral sugerido (no forzado) para agrupar órdenes en wave vs. dejarlas waveless.
pickingWaveMinOrders: number    // default 5

// Mínimo de órdenes del mismo producto+ubicación para sugerir candidato de batch
// (ya existe la lógica en lib/rules/picking.ts groupTasksForBatch — esto expone
// el umbral como configurable en vez de fijo en 2).
pickingBatchMinOrders: number   // default 2

// Techo operativo de un cluster — valida al crear/asignar.
pickingClusterMaxContainers: number // default 8

// Gobierna el dialog de reporte de incidencia.
pickingRequireIssuePhoto: boolean   // default false
pickingAllowSubstitution: boolean   // default true

// Catálogo independiente de zonas de picking (pick-and-pass), desacoplado de
// StorageLocation.zone para permitir renombrar/reordenar sin tocar ubicaciones.
pickingZones: PickingZoneConfig[]
```

```ts
export interface PickingZoneConfig {
  id: string
  name: string
  sequenceOrder: number // orden de paso en pick-and-pass, ascendente
  active: boolean
}
```

## 3. Excepciones — nuevo flujo

**Tipo (`PickingTask`, nuevos campos opcionales):**

```ts
issuePhotoUrl?: string        // dataURL, capturado con <input type="file" capture="environment">
substituteProductId?: string  // producto sugerido como reemplazo
```

**Store — nuevas acciones:**

- `reportIssue(taskId, reasonId, note, photoDataUrl?, substituteProductId?)`
  Válido desde `pending | assigned | in_progress` → `with_issue` (ya permitido por `state-machines.ts`). Bloqueada si `pickingFreezeActive`. Si `settings.pickingRequireIssuePhoto` y no viene `photoDataUrl`, lanza error de validación (la UI ya lo impide, pero el store es la última barrera).
- `resolveIssue(taskId)`
  `with_issue` → `in_progress` (ya permitido). Limpia `issuePhotoUrl` si se desea reintentar limpio — se conserva en `StockMovement`/histórico vía el propio `issueReason` guardado, no se borra el registro, solo se habilita continuar.

**UI:**

- Botón "Reportar incidencia" nuevo en `TasksTab` (tabla de tareas) y en el wizard de ejecución del worker (`(worker)/worker/picking/task/[taskId]`).
- Dialog: razón (motor de razones existente, contexto reutilizable), nota libre, captura de foto opcional/obligatoria según config, selector opcional de producto sustituto (deshabilitado si `pickingAllowSubstitution` es false).
- `StatusBadge` ya soporta `with_issue` (`lib/status.ts:52`) — sin cambios ahí.

## 4. Prioridad por SLA

Nueva función pura en `lib/rules/picking.ts`:

```ts
function derivePriorityFromSla(
  dispatchDeadline: string, // ISO
  now: Date,
  settings: Pick<WmsSettings, 'pickingSlaUrgentHours' | 'pickingSlaWarningHours'>
): 'low' | 'medium' | 'high'
```

Se usa como **valor por defecto sugerido** en los formularios de creación de tarea/wave/waveless (page.tsx) — el operador/supervisor puede sobrescribirlo manualmente, igual que hoy. No se auto-reasigna prioridad de tareas ya creadas (evita sorpresas de reordenamiento en curso).

## 5. Freeze — puntos de aplicación

Guard `if (state.settings.pickingFreezeActive) throw new Error(PICKING_FROZEN_ERROR)` al inicio de: `startPicking`, `completePick`, `approvePart`, `rejectPart`, `reportIssue`, `resolveIssue`, `releaseWave`, `createWave`, `startBatchTask`, `completeBatchTask`, `startClusterTask`, `depositToSlot`, `completeClusterTask`, `startPutToStore`, `distributeToStore`, `completePutToStore`, `createWavelessOrder`, `startWavelessOrder`. Mismo patrón textual que `RETURNS_FROZEN_ERROR`/`REPLENISHMENT_FROZEN_ERROR` (`wms-store.ts:120-129`).

## 6. Página `/picking-settings`

Estructura idéntica a `inventory-settings`/`returns-settings`:

- `PageHeader` — título "Configuración de Picking", descripción con referencia a `/picking`.
- Fila de KPI cards: tareas con incidencia abiertas (`with_issue` count), % tareas dentro de SLA urgente, tareas activas por estrategia (suma wave+waveless+batch+cluster+put-to-store en curso).
- Banner de freeze activo (igual patrón azul/Snowflake) con link a `/picking`.
- `Card` "Parámetros del módulo": secciones con `SectionHeading` + `SettingRow` + `InlineSlider`/`Select`/`Switch`, agrupadas: **SLA y prioridad** / **Agrupación (wave, batch, cluster)** / **Excepciones**.
- `Card` "Zonas de picking": tabla simple con nombre + orden de secuencia + activo/inactivo, crear/editar/reordenar (mismo patrón de UoM CRUD en `/admin`).
- Botón "Guardar cambios" con estado `settingsChanged`, idéntico a los demás.

## 7. Navegación

`src/components/navigation/sidebar/sidebar-items.ts` → dentro de `config.subItems` (Sistema → Configuración), agregar:

```ts
{ id: 'config-picking', title: 'Picking', url: '/picking-settings', icon: ClipboardList }
```

Hereda `allowedRoles: ['supervisor']` del nodo padre `config` — los roles operativos (`picker`, etc.) ya son redirigidos fuera de `/picking-settings` por el middleware de rutas de rol, sin cambios necesarios ahí.

## 8. Testing

Por instrucción explícita del usuario: **no se ejecutan tests** en esta tarea. Verificación manual vía UI (dev server) antes de reportar completo.

## 9. Entregables de esta tarea

1. `WmsSettings` + `PickingZoneConfig` + campos nuevos en `PickingTask` (`types/wms.ts`).
2. Defaults en el estado inicial del store + `updateSettings` sin cambios de firma.
3. Guards de freeze + `reportIssue`/`resolveIssue` en `wms-store.ts`.
4. `derivePriorityFromSla` en `lib/rules/picking.ts`.
5. Página `src/app/(app)/picking-settings/page.tsx`.
6. Botón + dialog de incidencia en `TasksTab` y en el wizard worker.
7. Entrada de nav en `sidebar-items.ts`.
8. `docs/modulo_gestion_picking.md` (documento de funcionalidades, mismo formato que módulos hermanos).
9. `docs/superpowers/plans/2026-07-23-picking-mobile-worker-plan.md` (plan de trabajo mobile, solo documento — sin código).
