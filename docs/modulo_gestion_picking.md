# Picking / Preparación de pedidos

Módulo de extracción de productos desde sus ubicaciones para cumplir pedidos. Es el proceso que más mano de obra consume en un almacén y el que más impacta la productividad. Referencia de mercado: `docs/funcionalidades_base_wms.md` §5.

---

## Conceptos clave

| Término | Definición |
|---|---|
| **PickingTask** | Unidad mínima de trabajo: un producto, una ubicación, una cantidad solicitada. |
| **Wave (oleada)** | Agrupación de órdenes por zona/ruta/prioridad/carrier/ventana de despacho, liberada como bloque. |
| **Waveless** | Orden individual que genera sus tareas de inmediato, sin esperar agrupación. |
| **Batch** | Consolidación de tareas del mismo producto+ubicación de varias órdenes en un solo viaje. |
| **Cluster** | Un picker recorre una ruta cargando N contenedores, uno por pedido. |
| **Put-to-store** | Pick masivo en el CD, luego distribuido a varias tiendas destino. |
| **Zona (pick-and-pass)** | Picking secuencial por zonas del almacén, en un orden de paso configurable. |
| **Incidencia** | Excepción reportada durante el picking (sin stock, dañado, ubicación vacía) que pausa la tarea. |
| **SLA de despacho** | Horas restantes hasta la fecha de despacho prometida; gobierna la prioridad sugerida. |

---

## Estrategias soportadas

Las 6 estrategias coexisten en el mismo store y comparten el mismo tipo `PickingTask` como unidad base (excepto put-to-store y waveless, que generan tareas por su cuenta).

| Estrategia | Ruta / tab | Tipo | Acciones de store |
|---|---|---|---|
| Discreto (tareas) | `/picking` → Tareas | `PickingTask` | `startPicking`, `completePick`, `approvePart`, `rejectPart` |
| Wave | `/picking` → Oleadas | `PickingWave` | `createWave`, `releaseWave` |
| Waveless | `/picking` → Waveless | `WavelessOrder` | `createWavelessOrder`, `startWavelessOrder` |
| Batch | `/picking` → Batch | `BatchTask` | `startBatchTask`, `completeBatchTask` |
| Cluster | `/picking` → Cluster | `ClusterTask` | `startClusterTask`, `depositToSlot`, `completeClusterTask` |
| Zona | `/picking` → Por zona | `PickingTask` (filtrado por zona) | mismas acciones de tareas |
| Put-to-store | `/picking` → Put-to-store | `PutToStoreTask` | `startPutToStore`, `distributeToStore`, `completePutToStore` |

Móvil: solo Discreto tiene wizard operativo hoy (`/worker/picking/task/[taskId]`). Ver `docs/superpowers/plans/2026-07-23-picking-mobile-worker-plan.md` para el resto.

---

## Configuración (`/picking-settings`)

Página en **Sistema → Configuración → Picking**, visible solo para el rol `supervisor` (los roles operativos son redirigidos por middleware). Sigue el mismo patrón que `inventory-settings`/`returns-settings`: parámetros con `updateSettings`, persistidos automáticamente en IndexedDB junto al resto del store — no requiere infraestructura nueva.

| Campo (`WmsSettings`) | Default | Qué gobierna |
|---|---|---|
| `pickingFreezeActive` | `false` | Congela las 16 acciones de picking (ver Gobierno). |
| `pickingSlaUrgentHours` | `4` | Horas hasta despacho por debajo de las cuales se sugiere prioridad **alta**. |
| `pickingSlaWarningHours` | `12` | Horas hasta despacho por debajo de las cuales se sugiere prioridad **media**. |
| `pickingWaveMinOrders` | `5` | Umbral sugerido (no forzado) para agrupar en oleada vs. waveless. |
| `pickingBatchMinOrders` | `2` | Mínimo de órdenes del mismo producto+ubicación para candidato de batch. |
| `pickingClusterMaxContainers` | `8` | Techo operativo de contenedores simultáneos por cluster. |
| `pickingRequireIssuePhoto` | `false` | Exige foto para poder guardar una incidencia. |
| `pickingAllowSubstitution` | `true` | Habilita sugerir producto sustituto al reportar incidencia. |
| `pickingZones` | 3 zonas semilla (Zona A/B/C) | Catálogo de zonas de pick-and-pass, independiente de `StorageLocation.zone`, con `name` + `sequenceOrder` + `active`, editable en la misma página. |

La página también muestra 3 KPI cards en vivo (incidencias abiertas, estado del modo congelado, tareas activas/urgentes) y una tabla CRUD para las zonas.

---

## Manejo de excepciones (Estándar del catálogo de referencia)

Antes de esta implementación, el estado `with_issue` de `PickingTaskStatus` existía en el tipo y en la máquina de estados (`pickingTaskTransitions`) pero **ningún código lo disparaba nunca**. Ahora es un flujo completo:

- **`reportIssue(taskId, reasonId, note, photoDataUrl?, substituteProductId?)`** — transiciona `pending | assigned | in_progress → with_issue`. Valida vía `canTransition`; si `pickingRequireIssuePhoto` está activo, exige `photoDataUrl`. Guarda `issueReasonId`, `issueReason`, opcionalmente `issuePhotoUrl` (dataURL, capturado con `<input type="file" capture="environment">`, cabe sin problema en IndexedDB) y `substituteProductId`.
- **`resolveIssue(taskId)`** — transiciona `with_issue → in_progress`, permite reintentar la tarea.
- **Razones**: nuevo contexto `Reason.context === 'picking_issue'`, con 3 entradas semilla: sin stock físico, producto dañado, ubicación vacía/mal etiquetada.
- **UI desktop**: botón de advertencia (▲) en la tabla de tareas (`/picking` → Tareas) para tareas activas, botón "Resolver" para tareas `with_issue`. Dialog con motivo, nota, foto y sustituto opcional.
- **UI móvil**: botón "⚠️ Reportar incidencia" en los pasos de ubicación y producto del wizard del operario (`/worker/picking/task/[taskId]`). Dialog simplificado (sin campo de nota) que redirige a la lista de tareas al enviar.

---

## Gobierno (freeze)

`pickingFreezeActive` bloquea, con el mensaje `PICKING_FROZEN_MSG`, las siguientes 16 acciones del store — mismo patrón que `returnsFreezeActive`/`replenishmentFreezeActive`/`yardFreezeActive`:

`startPicking`, `completePick`, `approvePart`, `rejectPart`, `releaseWave`, `createWave`, `startBatchTask`, `completeBatchTask`, `startClusterTask`, `depositToSlot`, `completeClusterTask`, `startPutToStore`, `distributeToStore`, `completePutToStore`, `createWavelessOrder`, `startWavelessOrder` — más `reportIssue` y `resolveIssue`.

---

## Prioridad sugerida por SLA

`derivePriorityFromSla(dispatchDeadline, now, settings)` en `src/lib/rules/picking.ts` — función pura, sin dependencia de store. Compara horas restantes hasta el despacho contra `pickingSlaUrgentHours`/`pickingSlaWarningHours` y devuelve `'low' | 'medium' | 'high'`. Es un **valor sugerido** en los formularios de creación (tarea/wave/waveless) — el usuario puede sobrescribirlo; no se reasigna automáticamente sobre tareas existentes.

---

## Cobertura frente al catálogo de referencia (`docs/funcionalidades_base_wms.md` §5)

| Nivel | Ítem | Estado |
|---|---|---|
| 🟢 Base | Picking discreto | ✅ |
| 🟢 Base | Validación por escaneo (ubicación, producto, serie/lote) | ✅ (ya existía) |
| 🟢 Base | Picking parcial con manejo de faltantes | ✅ (ya existía) |
| 🔵 Estándar | Wave / waveless / batch / cluster / zona / put-to-store | ✅ (ya existían, ahora con config compartida) |
| 🔵 Estándar | Priorización por SLA | ✅ (nuevo — `derivePriorityFromSla`) |
| 🔵 Estándar | Manejo de excepciones (sin stock, sustitución, incidencia con foto) | ✅ (nuevo — este trabajo) |
| 🔵 Estándar | Optimización de ruta por accesibilidad | ✅ (ya existía — `orderTasksByAccessibility`) |
| 🟣 Avanzado | Order streaming / orquestación dinámica de estrategia | ❌ Fuera de alcance — ver nota abajo |
| 🟣 Avanzado | Optimización de ruta TSP / nearest-neighbor | ❌ Fuera de alcance |
| 🟣 Avanzado | Voz, pick-to-light, RFID, wearables | ❌ Fuera de alcance |
| 🟣 Avanzado | Goods-to-person (AS/RS, AMR) | ❌ Fuera de alcance |

**Nota sobre order streaming:** se evaluó incluir `pickingDefaultStrategy` (sugerencia automática de qué estrategia usar según la orden) en esta ronda y se descartó deliberadamente — equivale al nivel Avanzado/IA del catálogo. Queda como línea futura.

---

## Rutas relacionadas

| Ruta | Rol | Propósito |
|---|---|---|
| `/picking` | supervisor | 7 tabs de gestión de picking (todas las estrategias) |
| `/picking-settings` | supervisor | Configuración del módulo |
| `/worker/picking` | picker | Lista de tareas asignadas al operario |
| `/worker/picking/task/[taskId]` | picker | Wizard de ejecución (escaneo → cantidad → confirmación) |

---

*Generado con Claude Code — 2026-07-23*
