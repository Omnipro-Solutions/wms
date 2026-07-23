# Módulo: Gestión de tareas y mano de obra (Labor Management — LMS)

**Fecha:** 2026-07-23
**Estado:** Implementado — 🟢 Base + 🔵 Estándar (referencia: `docs/funcionalidades_base_wms.md` §9)

## Para qué sirve

Mide, asigna y optimiza el trabajo humano del almacén. Unifica en una sola cola las tareas de picking, putaway y reposición — hoy repartidas en tres módulos distintos — para que un supervisor pueda ver de un vistazo qué falta por asignar, quién tiene qué carga, y sugerir rutas combinadas quie ahorren desplazamiento.

## Alcance implementado

### 🟢 Base
- Asignación de tareas a operarios desde una vista central (`/labor`), que escribe directamente a las acciones reales de cada módulo (`startPicking`, `startReplenishment`, `assignPutaway`).
- Productividad por operario (picks completados, unidades procesadas, parciales, incidencias) agregando las tres fuentes.

### 🔵 Estándar
- Cola de tareas priorizada y filtrable por tipo/zona/prioridad/operario.
- Interleaving: sugerencia visual de "ruta combinada" cuando un mismo operario tiene tareas de distinto tipo en ubicaciones cercanas (configurable por distancia máxima).
- Dashboards de productividad individual y por rol/equipo, con coloreado contra metas configurables.

### 🟣 Avanzado — no incluido en esta iteración
- Engineered Labor Standards (tiempo esperado por tarea vs. real, incentivos).
- Balanceo dinámico de carga con IA.
- Planificación de personal por pronóstico de demanda.

## Páginas

### `/labor` — Cola de tareas, Productividad, Turnos y operarios
- **Cola de tareas:** tabla unificada de tareas pendientes de picking, putaway y reposición. KPIs de total pendientes, sin asignar, con ruta combinada sugerida, y operarios activos. Asignación/reasignación vía diálogo, filtrado por tipo de operario compatible con cada tarea (picker → picking/reposición, receiver → putaway).
- **Productividad:** picks completados y unidades procesadas por operario, coloreado contra la meta de unidades/hora configurada, y vista agregada por rol.
- **Turnos y operarios:** operarios activos/inactivos con su carga actual (# de tareas asignadas ahora mismo). Edición de datos del operario redirige a `/admin`.

### `/labor-settings` — Sistema → Configuraciones
- Habilitar/deshabilitar interleaving y su distancia máxima de agrupación.
- Meta de unidades/hora usada para colorear el KPI de productividad.

## Modelo de datos

No se creó ninguna tabla/entidad nueva de "tarea de labor". `/labor` es una **proyección de solo lectura** (`src/lib/rules/labor.ts`) sobre `PickingTask`, `ReplenishmentTask` y `Asn` (putaway) ya existentes — la fuente de verdad de cada tarea sigue viviendo en su módulo original. La prioridad mostrada en la cola es la que ya trae cada tarea de su módulo de origen (no se deriva de un SLA propio de Labor). Se añadió:
- `Asn.assignedOperatorName?: string` — el único de los tres dominios sin paso de pre-asignación.
- Tres campos nuevos en `WmsSettings` (prefijo `labor*`): `laborInterleavingEnabled`, `laborInterleavingMaxDistanceM`, `laborTargetUnitsPerHour`.

## Persistencia

Vía el store Zustand + IndexedDB ya usado en todo el proyecto (`idbStorage`) — sin backend ni almacenamiento adicional. Los datos de la cola no se persisten (se recalculan en cada render); solo la configuración (`WmsSettings`) y el campo `assignedOperatorName` persisten.
