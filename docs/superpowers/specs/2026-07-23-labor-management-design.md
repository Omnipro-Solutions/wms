# Diseño — Módulo 9: Gestión de tareas y mano de obra (Labor Management — LMS)

**Fecha:** 2026-07-23
**Estado:** Aprobado para plan de implementación
**Referencia:** `docs/funcionalidades_base_wms.md` §9

---

## Contexto

El WMS ya tiene productividad calculada (`productivityByOperator` en `lib/rules/picking.ts`) pero no existe módulo dedicado a gestión de mano de obra: no hay vista de cola de tareas cross-módulo, no hay asignación centralizada de operarios, no hay interleaving, ni configuración propia. Este diseño cubre los niveles 🟢 Base y 🔵 Estándar del catálogo de referencia (asignación de tareas, productividad, cola priorizada, interleaving, dashboards de equipo). El nivel 🟣 Avanzado (engineered labor standards, balanceo dinámico con IA, planificación de personal por forecast) queda **fuera de alcance**.

## Alcance

**Incluye:**
- Página `/labor` con 3 tabs: Cola de tareas, Productividad, Turnos y operarios.
- Página `/labor-settings` en Sistema → Configuraciones.
- Capa de proyección (adapter) que unifica `PickingTask`, `ReplenishmentTask` y `Asn` (putaway) en un view-model común de cola de trabajo, sin duplicar ni migrar sus datos fuente.
- Asignación real de operario desde `/labor`, escribiendo a las actions existentes del store (`startPicking`, `startReplenishment`) más una acción nueva `assignPutaway` para el caso de putaway, que hoy no tiene paso de pre-asignación.
- Sugerencia visual de interleaving (agrupar tareas de distinto tipo cercanas en zona/ubicación para el mismo operario) — solo agrupación en la vista, no cambia el flujo de ejecución real de cada módulo.

**Excluye:**
- Engineered Labor Standards (tiempo esperado por tarea vs. real, incentivos).
- Balanceo dinámico de carga con IA.
- Planificación de personal por pronóstico de demanda.
- CRUD de operarios (ya existe en `/admin` — Labor solo lee y muestra carga).

## Arquitectura

**Sin nuevos tipos de tarea fuente.** `PickingTask`, `ReplenishmentTask` y `Asn` siguen siendo dueños de su propio estado y FSM. Se agrega:

1. **Tipo nuevo `LaborQueueItem`** (`src/types/wms.ts`) — view-model de solo lectura, no persistido, generado en tiempo real por la capa de proyección:
   ```ts
   export interface LaborQueueItem {
     id: string                 // id de la tarea fuente
     sourceType: 'picking' | 'putaway' | 'replenishment'
     code: string                // código/referencia visible (orderId, asn code, productId)
     productId?: string
     locationId: string
     zone?: string
     priority: 'low' | 'medium' | 'high'
     status: string              // status crudo de la fuente, mapeado a etiqueta común en UI
     operatorName?: string
     suggestedRouteId?: string   // presente cuando aplica interleaving
   }
   ```

2. **Función pura `buildLaborQueue(state)`** (`src/lib/rules/labor.ts`) — mapea picking tasks pendientes/asignadas, replenishment tasks pendientes/asignadas y ASNs en estado `completed` (pendientes de putaway) a `LaborQueueItem[]`. No importa del store, recibe los arrays ya extraídos (sigue la regla de capas: `lib/rules/` sin dependencia de store).

3. **Función pura `suggestInterleavedRoutes(items, maxDistanceM)`** (`src/lib/rules/labor.ts`) — agrupa ítems del mismo `operatorName` cuyas ubicaciones estén dentro de `maxDistanceM` (usa `distanceToDispatchM` u otra métrica ya disponible en `StorageLocation` como proxy de cercanía), marcando `suggestedRouteId` compartido. Solo corre si `laborInterleavingEnabled` está activo en settings.

4. **Campo nuevo en `Asn`:** `assignedOperatorName?: string`. **Acción nueva en el store:** `assignPutaway(asnId: string, operatorName: string): void` — solo estampa el campo, no cambia `status` (el FSM de `Asn` no tiene paso "asignado", solo `completed → putaway_done`).

5. **Extensión de `productivityByOperator`** en `lib/rules/picking.ts` (o nueva función `productivityByOperatorAllSources` en `lib/rules/labor.ts` para no ensuciar el archivo de picking) — agrega conteo de putaway y replenishment completados por operario, no solo picks.

6. **Campos nuevos en `WmsSettings`:**
   ```ts
   laborSlaHighPriorityHours: number
   laborSlaMediumPriorityHours: number
   laborInterleavingEnabled: boolean
   laborInterleavingMaxDistanceM: number
   laborTargetPicksPerHour: number
   laborTargetUnitsPerHour: number
   ```
   Con defaults añadidos a `data/seed.ts` junto al resto de `WmsSettings`.

## Página `/labor`

Patrón `SubNav` idéntico a `/picking` (`defaultValue="queue"`).

### Tab 1 — Cola de tareas
- **KPI cards:** total pendientes, sin asignar, con ruta combinada sugerida, operarios activos ahora.
- **Tabla** (`DataTable` + columnas en `labor/columns.tsx`): Tipo (badge por `sourceType`), Código, Producto, Ubicación/Zona, Prioridad, Operario asignado, Estado, Ruta combinada (badge condicional), Acciones.
- **Filtros:** tipo de tarea (multi-select), zona, prioridad, operario, switch "solo sin asignar".
- **Asignar/Reasignar:** dropdown de operarios activos filtrados por rol compatible (`picker`→picking/replenishment, `receiver`→putaway); confirma y llama la action real correspondiente según `sourceType`.
- Clause guards: loading (no aplica, store en memoria), vacío ("Sin tareas pendientes"), sin resultados de filtro.

### Tab 2 — Productividad
- **KPI cards:** picks/hora promedio, unidades/hora promedio, tareas completadas hoy, top performer.
- **Tabla por operario:** extiende `ProductivityRow` con columnas de putaway/replenishment completados. Color de fila según meta de `/labor-settings` (verde ≥ meta, ámbar 80–99%, rojo <80%).
- **Vista por rol/equipo:** mismo cálculo agrupado por `Operator.role`.

### Tab 3 — Turnos y operarios
- Tabla: operario, rol, activo/inactivo (de `Operator`), carga actual (# tareas asignadas ahora, derivado de la cola), última actividad. Solo lectura, con enlace a `/admin` para editar el operario.

## Página `/labor-settings`

Mismo patrón de `inventory-settings/page.tsx` (`PageHeader`, cards KPI, `SectionHeading` + `SettingRow` + `InlineSlider`/`Switch`, botón "Guardar cambios" con estado sucio vía `settingsChanged`).

- **KPI cards:** productividad promedio general, % tareas sin asignar, operarios activos.
- **Sección "Cola y prioridad":** umbral SLA prioridad alta (h), umbral SLA prioridad media (h) — sliders.
- **Sección "Interleaving":** switch habilitar + slider distancia máxima (m), condicional al switch.
- **Sección "Metas de productividad":** picks/hora objetivo, unidades/hora objetivo — sliders. Solo colorean KPIs, sin lógica de incentivos.

## Navegación

Agregar a `NAV_GROUPS` en `lib/constants.ts`:
- Grupo "Operación": `{ label: 'Mano de obra', href: '/labor', icon: Users }`.
- Grupo "Sistema": `{ label: 'Config. Mano de obra', href: '/labor-settings', icon: SlidersHorizontal }` (o ícono `Users` variante).

## Persistencia

Todo vía el store Zustand existente + IndexedDB (mecanismo ya usado en el proyecto para persistencia demo). No requiere backend ni nuevas tablas — solo extensión de `WmsSettings` y `Asn`, más un tipo de solo lectura (`LaborQueueItem`) que nunca se persiste (se recalcula en cada render desde datos que ya viven en el store).

## Testing

- Unit tests (Vitest) para `buildLaborQueue` y `suggestInterleavedRoutes` en `lib/rules/labor.ts` — casos: cola vacía, mezcla de 3 tipos, interleaving activado/desactivado, umbral de distancia.
- No se agregan tests de UI (fuera del patrón actual del proyecto, que no testea páginas).
