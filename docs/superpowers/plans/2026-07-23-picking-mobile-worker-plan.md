# Plan de trabajo — Picking móvil para usuarios operativos

**Fecha:** 2026-07-23
**Alcance:** Solo planeación. No incluye código — ver `docs/superpowers/plans/2026-07-23-picking-settings-implementation.md` para lo ya implementado en esta ronda (config de escritorio + flujo de incidencias en desktop y móvil).

---

## 1. Contexto

`(worker)/worker/picking/` hoy tiene dos pantallas:

- **Lista** (`page.tsx`): tareas asignadas al operario (`assignedOperatorId === operator.id`), ordenadas por prioridad, con botón "Iniciar siguiente tarea".
- **Wizard de ejecución** (`task/[taskId]/page.tsx`): 3 pasos (ubicación → producto → cantidad → confirmación), escaneo por `<ScanInput expectedValue={...} onMatch={...}>`, captura de serial si el producto lo requiere, dialog de confirmación parcial. Esta ronda de trabajo (Tarea 7 del plan de implementación) le agregó el botón "⚠️ Reportar incidencia" en los pasos de ubicación y producto.

Limitaciones actuales:
- Solo la estrategia **Discreto** (`PickingTask`) tiene pantalla móvil. Batch, Cluster, Wave, Waveless, Put-to-store y Zona no tienen ningún flujo operativo en `(worker)` — el operario nunca ve esas tareas en su teléfono, solo existen en las tabs de escritorio.
- No hay indicador visual de prioridad/SLA en la lista más allá de `urgent={task.priority === 'high'}` (booleano plano, no usa `pickingSlaUrgentHours`/`pickingSlaWarningHours`).
- No respeta `pickingFreezeActive` — si el módulo está congelado, el operario ve el error crudo que lanza `startPicking`/`completePick` sin explicación.
- No hay modo offline: todo escribe directo a `useWmsStore` (IndexedDB local), sin cola de sincronización a un backend futuro.

---

## 2. Fase 1 — Reflejar configuración en el wizard existente

**Tamaño:** S
**Depende de:** `pickingSlaUrgentHours`, `pickingSlaWarningHours`, `pickingFreezeActive` (ya existen en `WmsSettings`)

- Lista (`worker/picking/page.tsx`): mostrar badge de prioridad usando `derivePriorityFromSla` en vez del booleano `urgent` plano, coloreado por umbral real configurado.
- Wizard: si `settings.pickingFreezeActive` es true, mostrar un banner de bloqueo a pantalla completa antes del primer paso ("Picking en pausa — contacta a tu supervisor") en vez de dejar que `startPicking` lance un error que el operario no entiende.
- Archivos probables: `src/app/(worker)/worker/picking/page.tsx`, `src/app/(worker)/worker/picking/task/[taskId]/page.tsx`.

---

## 3. Fase 2 — Batch y Cluster en móvil

**Tamaño:** M
**Depende de:** `pickingClusterMaxContainers` (ya existe), `BatchTask`/`ClusterTask` (ya existen como tipos y acciones de store)

Hoy `BatchTask` y `ClusterTask` solo se operan desde `/picking` (escritorio). Un picker de piso que trabaja por lotes o clusters no tiene pantalla propia.

- Nueva ruta `worker/picking/batch/[batchId]/page.tsx`: reutiliza `ScanInput`/`QuantityStepper`, un solo paso de confirmación de cantidad total (`completeBatchTask`).
- Nueva ruta `worker/picking/cluster/[clusterId]/page.tsx`: wizard multi-slot — un paso de escaneo de ubicación por cada producto en la ruta del cluster, con contador visual "Contenedor X de N" respetando `pickingClusterMaxContainers` como techo de validación. Usa `depositToSlot`/`completeClusterTask`.
- Actualizar la lista de tareas del operario para incluir batch/cluster asignados, no solo `PickingTask`.

---

## 4. Fase 3 — Zona (pick-and-pass) en móvil

**Tamaño:** M
**Depende de:** `pickingZones` (nuevo — ya existe el catálogo con `sequenceOrder`)

- Pantalla que filtra las tareas del operario por la zona activa según `pickingZones` ordenado por `sequenceOrder`, mostrando solo las tareas de la zona actual.
- Al completar todas las tareas de una zona, avanza automáticamente a la siguiente zona activa en la secuencia (o notifica "zona completa, esperando siguiente").
- Requiere decidir cómo se asigna la "zona actual" del operario — probablemente un selector manual al iniciar turno, ya que no hay geolocalización en este MVP.

---

## 5. Fase 4 — Modo offline

**Tamaño:** L — bloqueado en trabajo de backend
**Depende de:** ninguna config existente; requiere una capa de sincronización que hoy no existe

Aclaración importante: "offline" hoy ya funciona en el sentido de que IndexedDB es local al dispositivo — el problema real es que no hay backend con el que sincronizar cuando llegue uno (ver `docs/funcionalidades_base_wms.md` §23, plataforma/API-first). Esta fase es:
- Cola de acciones pendientes de sincronizar cuando exista un backend real.
- Indicador de estado de conexión en la UI del operario.

No planear implementación de detalle hasta que exista una API backend — este ítem queda como marcador de dependencia, no como tarea ejecutable hoy.

---

## 6. Fase 5 — Voice / RFID / wearables

**Tamaño:** — (no planeado)

Nivel 🟣 Avanzado del catálogo de referencia (`docs/funcionalidades_base_wms.md` §5 y §19). No se planea para este producto en el horizonte actual — mencionado aquí solo para que quede registrado como excluido explícitamente, no olvidado.

---

## Resumen de prioridad sugerida

| Fase | Tamaño | Bloqueante | Prioridad |
|---|---|---|---|
| 1 — Config en wizard existente | S | Ninguno | Alta — bajo costo, cierra brecha de UX inmediata |
| 2 — Batch/Cluster móvil | M | Ninguno | Media — brecha funcional real (operario no puede trabajar por lotes desde el piso) |
| 3 — Zona móvil | M | Decisión de producto (asignación de zona) | Media |
| 4 — Offline | L | Backend inexistente | Baja — no accionable aún |
| 5 — Voice/RFID/wearables | — | N/A | Fuera de alcance |

---

*Generado con Claude Code — 2026-07-23*
