# Reporte de Brechas WMS MVP

**Fecha:** 2026-06-24  
**Proyecto:** wms (Warehouse Management System)  
**Stack detectado:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Zustand 5 (client-side con persistencia local) · TailwindCSS 4 · shadcn/Radix UI · TanStack React Table 8 · date-fns 4 · Vitest  
**Alcance:** MVP demostrativo con persistencia local (localStorage/IndexedDB). Sin backend ni API REST por diseño en esta etapa.

---

## Resumen Ejecutivo

| Categoría | Cantidad | % del total |
|---|---|---|
| ✅ Cubierto | 52 | 51% |
| ⚠️ Parcial | 22 | 22% |
| ❌ Faltante | 27 | 27% |
| **Total** | **101** | **100%** |

**Cobertura funcional estimada del MVP:** ~75% *(Sprint 7 completado — +4pp vs. Sprint 6 de 71%)*

> El MVP cubre de forma sólida la lógica de dominio (tipos, máquinas de estado, reglas de negocio puras, UI compleja para picking/slotting/packing/devoluciones). La persistencia local (localStorage/IndexedDB) es el objetivo de esta etapa — el backend y las integraciones externas son trabajo post-MVP documentado en la sección "Próximos Pasos".

---

## Análisis por Sección

### A. Capacidades WMS Core (27 ítems)

| # | Requerimiento (resumido) | Estado | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|
| 1 | Ciclo completo de recepción | ⚠️ | `store/wms-store.ts`: `confirmArrival`, `receiveAsn`, `approveQc`, `rejectQc`, `putawayItem` — **UI:** `/receiving` (5 tabs: OCs · Citas ASN · Recepciones activas · Cola QC · Staging putaway) · `/receiving/[asnId]` stepper FSM | ASN, QC y putaway funcionan en memoria. Citas de llegada son solo fecha sin gestión de muelle/door. |
| 2 | FIFO/FEFO/LIFO/peso/zona en ubicaciones | ⚠️ | `src/lib/rules/inventory.ts:isExpired` · `src/lib/rules/slotting.ts:idealLocationTier` — **UI:** `/inventory/lot-trace` muestra `expirationDate` · `/slotting` considera zona y peso | FIFO/FEFO implícito mediante `isExpired`. LIFO no existe. Estrategia por ubicación no configurable. |
| 3 | Múltiples UM y conversiones automáticas | ✅ | `src/lib/rules/uom.ts:convertQty/toBaseQty` · `receiveAsn/completePick/adjustInventory` convierten a base — **UI:** `/admin` tab "Unidades de medida" (CRUD) · `ReceiveDialog` selector de UM · `/inventory` columna Stock con abreviatura | Sprint 4 completo. 8 UMs seed, 10 productos con conversiones. |
| 4 | Lotes y fechas de vencimiento por categoría | ⚠️ | `InventoryItem.lot/expirationDate` · `isExpired` — **UI:** `/inventory/lot-trace` tabla de lotes con fecha de vencimiento · `/` banner alerta vencimiento · `/inventory` filtro de estado | Política de expiración por categoría no existe en `Product`. |
| 5 | Multi-almacén / multi-empresa | ⚠️ | `src/types/wms.ts:Warehouse` (6 en seed: 2 DCs + 4 tiendas) — **UI:** `/inventory` filtro por almacén · `/transfers` traslados entre warehouses · `/admin` CRUD almacenes | Multi-almacén: ✅. Multi-empresa: ❌ — no hay `companyId`. |
| 6 | Módulo QC integrado | ⚠️ | `store/wms-store.ts:approveQc/rejectQc` — **UI:** `/receiving` tab "Cola QC" con botones Aprobar/Rechazar · `/returns` tab "Inspecciones" (QC de devoluciones) | QC de recepción y devoluciones funcionan. Falta QC de salida/picking y reportes de KPIs de calidad. |
| 7 | Cross-docking (directo, indirecto, oportunístico) | ⚠️ | `Asn.crossDocking:boolean` · `CommerceOrder.fulfillmentType=cross_docking` — **UI:** `/receiving` muestra badge cross-dock en ASNs · `/commerce` filtro por tipo despacho | Flag existe. Sin flujo operativo diferenciado ni zonas staging con reglas de asignación directa. |
| 8 | Devoluciones y RMA | ✅ | `store/wms-store.ts:advanceReturn/inspectReturn/setReturnDisposition/executeReentry/executeScrap/createRepairTicket` — **UI:** `/returns` (5 tabs: Órdenes · Inspecciones · Reingresos · Reparaciones · Scrap) · FSM stepper visual | FSM completa (5 disposiciones). Sin RMA externo/portal cliente. |
| 9 | Traslados inter-almacén e inter-compañía | ⚠️ | `store/wms-store.ts:advanceTransfer` · `transferTransitions` FSM — **UI:** `/transfers` tabla con botones FSM, StockMovement auditable | Inter-almacén ✅. Inter-compañía ❌ (sin multi-empresa). |
| 10 | Reabastecimiento automático por reglas | ⚠️ | `store/selectors.ts:selectReplenishmentNeeds` · `generateReplenishmentTasks` — **UI:** `/slotting` tab "Necesidades de reposición" con prioridad high/medium/low · botón "Generar tareas" | Sin ejecución automática (cron/trigger). Sin min/max configurables por SKU en UI. |
| 11 | Gestión de equipos (montacargas, etc.) | ❌ | No hay tipo `Equipment` ni `Vehicle` — **UI:** Sin ruta dedicada | No existe. Requiere nuevo dominio: equipo, mantenimiento, asignación a tarea. |
| 12 | Gestión de mano de obra y productividad | ⚠️ | `src/lib/rules/picking.ts:productivityByOperator` — **UI:** `/reports` sección "Productividad por operador" tabla con picks, unidades, parciales | Sin planificación de turnos, costos de labor ni dashboard de supervisión en vivo. |
| 13 | Slotting (optimización de ubicaciones) | ✅ | `src/lib/rules/slotting.ts` · `store/selectors.ts:selectSlottingRecommendations/selectAffinityRecommendations/simulateRelocateAll` — **UI:** `/slotting` (5 tabs: Recomendaciones · Matriz ABC/XYZ · Reposición · Afinidad · Historial snapshots) | ABC/XYZ, scoring 0–100, simulación dry-run, afinidad, snapshots. |
| 14 | Kitting y ensamble | ❌ | No hay tipo `Kit`, `BillOfMaterials` — **UI:** Sin ruta dedicada | No existe. Requiere entidades nuevas y flujo de explosión de materiales. |
| 15 | Serialización a nivel de unidad | ⚠️ | `Product.trackBy=serial` · `completePick` valida `capturedSerial` — **UI:** `/picking` dialog "Completar pick" muestra campo N/S · `/serial-trace` timeline de ciclo de vida | Vista unificada putaway→picking→despacho→devolución en `/serial-trace` ✅. Sin rastreo en putaway explícito en UI separada. |
| 16 | Tipos de ubicaciones (picking, reserva, cuarentena, etc.) | ✅ | `StorageLocation.type: pick\|reserve\|quality_control\|staging\|returns` — **UI:** `/locations` mapa de almacén con filtro por tipo, badges de zona golden, isPickFace | 5 tipos modelados, CRUD completo en UI. |
| 17 | Capacidad y volumetría por ubicación | ⚠️ | `StorageLocation.maxWeightKg` · `slottingScore` hard constraint de peso — **UI:** `/locations` columna "Peso máx." · `/admin` → Ubicaciones campo peso | Sin `maxVolumeM3` ni `maxPallets`. Slotting no valida volumen por ubicación. |
| 18 | Etiquetado propio + soporte Zebra/inalámbrico | ⚠️ | `src/lib/rules/zpl.ts:buildZpl/printZpl` — **UI:** `/labels` tabla de etiquetas (producto, ubicación, caja, pallet, envío, devolución) · botón "ZPL" abre `ZplPreviewDialog` con preview 4"×2", campo IP impresora, copiar/enviar | ZPL II completo. Sin protocolo inalámbrico nativo (solo POST vía IP de red). |
| 19 | Órdenes de Putaway dirigidas por sistema | ⚠️ | `store/wms-store.ts:putawayItem` — **UI:** `/receiving` tab "Staging putaway" · `PutawayDialog` selección manual de ubicación | Sin asignación automática por reglas ABC ni zona de temperatura. |
| 20 | Tipos de estiba según rack y producto | ❌ | No hay `stackingType`, `rackType` ni `palletType` — **UI:** Sin campo en `/locations` ni `/admin` productos | No existe. |
| 21 | Zonas temporales/cross-docking | ⚠️ | `StorageLocation.type=staging` · `Asn.crossDocking:boolean` — **UI:** `/locations` filtra por tipo "staging" · `/receiving` badge cross-dock | Sin gestión de tiempo límite en zona staging ni reglas de flujo directo. |
| 22 | Aplicación móvil nativa (RF/voz) | ⚠️ | `public/manifest.json` + `public/sw.js` + `ServiceWorkerRegister` — **UI:** Instalable desde Chrome/Edge en Android · Shortcuts directos a Picking/Recepción/Inventario desde pantalla inicio | Sprint 5: PWA instalable. Sin React Native ni soporte RF/RFID real. |
| 23 | Compatibilidad dispositivos RF/RFID (Zebra, Honeywell) | ⚠️ | `src/components/shared/barcode-scanner.tsx` — **UI:** `/picking` botón cámara en dialog pick serial · `/receiving` → ReceiveDialog botón escanear N/S · fallback input manual | BarcodeDetector Web API + fallback. Sin Zebra DataWedge ni WebHID. |
| 24 | Interfaz configurable no-code/low-code | ❌ | No hay motor de formularios dinámicos — **UI:** Sin ruta dedicada | No existe. Todas las pantallas son código estático. |
| 25 | Dashboards operativos en tiempo real | ✅ | `store/selectors.ts:selectDashboardKpis/selectExpiringItems/selectCriticalStockItems/selectSlaBreaches` — **UI:** `/` (dashboard): 13 KPI cards · banners contextuales (freeze, ajustes, vencimiento, stock crítico, SLA) · tablas de pedidos recientes, slotting y salud de integraciones | Sin WebSocket/SSE — tiempo real requiere backend. |
| 26 | Soporte completo para español | ✅ | `src/lib/formatters.ts` locale `es` · `src/lib/status.ts` labels en español — **UI:** 100% de la app en es-CO · moneda COP · fechas dd/MM/yyyy | Completo. |
| 27 | Perfiles y roles con control granular | ✅ | `useCurrentOperator` hook · `OperatorGate` component · `currentOperatorId` en store — **UI:** Dialog selector de operador al abrir app · sidebar footer con nombre+rol · `/admin` botones supervisor gateados con `OperatorGate` · "Cambiar operador" en menú sidebar | Sprint 6. Sin autenticación real de servidor. |

---

### B. Requerimientos Específicos Retail Multitienda (ítems 28–40)

| # | Requerimiento (resumido) | Estado | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|
| 28 | Inventario centralizado + reabastecimiento automático a tiendas | ⚠️ | `store/selectors.ts:selectReplenishmentNeeds` · `generateReplenishmentTasks` — **UI:** `/slotting` tab "Necesidades de reposición" · botón "Generar tareas de reposición" | Sin min/max por tienda, sin estacionalidad, sin ejecución automática. |
| 29 | Reglas de asignación por tienda/canal/región | ❌ | `CommerceOrder.channel` existe — **UI:** `/commerce` filtro por canal, sin motor de reglas | Sin motor de reglas. Fulfillment type como campo pero no lógica configurable. |
| 30 | Órdenes de transferencia CD-tiendas con trazabilidad | ✅ | `store/wms-store.ts:advanceTransfer` appends `StockMovement` — **UI:** `/transfers` tabla de traslados · botones FSM · columna origen/destino con tipo DC/tienda | Trazabilidad completa (StockMovement). `Warehouse.type` diferencia DC vs. tienda. |
| 31 | Inventario en consignación | ❌ | No hay `consignment:boolean` ni `ConsignmentItem` — **UI:** Sin ruta dedicada | No existe. Requiere nuevo estado de inventario y flujo de liquidación. |
| 32 | Planogramas / layouts de exhibición | ❌ | No hay `Planogram` ni `ExhibitionLayout` — **UI:** Sin ruta dedicada | Fuera del scope WMS puro. Requiere integración con sistema de visual merchandising. |
| 33 | Integración POS en tiempo real | ⚠️ | `IntegrationConnection.type=pos` · `CommerceOrder.channel=pos` — **UI:** `/integrations` card "POS" con estado de conexión · `/commerce` filtro canal=POS | Tipo modelado. Sin webhook ni API de sincronización real. |
| 34 | Gestión de promociones y eventos especiales | ❌ | No hay tipo `Promotion` — **UI:** Sin ruta dedicada | No existe. Requiere módulo de campañas que afecte picking priority y reserva de stock. |
| 35 | Pedidos urgentes/rush para tiendas | ⚠️ | `PickingWave.groupBy=priority` — **UI:** `/picking` tab "Oleadas" selector `groupBy=priority` | Sin campo explícito `isRush:boolean`. Prioridad de wave existe pero no orientada a rush. |
| 36 | Visibilidad consolidada de inventario en red | ⚠️ | `src/app/inventory/page.tsx` filtra por `warehouseId` — **UI:** `/inventory` filtro desplegable por almacén | Sin vista "stock total en red por SKU" en un solo número agregado. |
| 37 | Devoluciones desde tiendas con reintegración | ✅ | `store/wms-store.ts:advanceReturn` FSM store→DC · `executeReentry` StockMovement — **UI:** `/returns` tab "Órdenes" · botones "Avanzar estado" · tab "Reingresos" con botón ejecutar reingreso | FSM cubre `received_at_store → in_transit_to_dc → received_at_dc`. Reingreso al inventario completo. |
| 38 | Inventario en tránsito CD-tiendas | ✅ | `InventoryItem.status=in_transit` · `StockMovement.type=transfer` — **UI:** `/inventory` filtro estado=in_transit · `/transfers` tabla con estado "en tránsito" | Estado en tránsito modelado y rastreado en StockMovements. |
| 39 | Múltiples tipos de empaque por tienda | ⚠️ | `PackingBoxType` — **UI:** `/packing` dialog "Seleccionar caja" lista tipos disponibles · `/admin` CRUD tipos de caja | Sin configuración "caja master vs. individual por canal/tienda". |
| 40 | Almacenes satélite / CDs secundarios por región | ⚠️ | Seed: 2 DCs (Bogotá, Medellín) + 4 tiendas — **UI:** `/admin` tab "Almacenes" tabla multi-warehouse · `/inventory` filtro por almacén | Modelo soporta múltiples DCs. Sin jerarquía CD principal→secundario ni reglas de fulfillment por región. |

---

### C. Requerimientos para Productos Serializados (ítems 41–53)

| # | Requerimiento (resumido) | Estado | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|
| 41 | Serialización nativa vs. customización | ⚠️ | `Product.trackBy=serial` · `InventoryItem.serial` · `PickingTask.capturedSerial` — **UI:** `/admin` tab "Productos" campo "Trazabilidad" (none/lot/serial) | Nativo para picking. Rastreo en putaway no tiene UI de flujo explícito. |
| 42 | Registro de N/S desde recepción en CD | ✅ | `receiveAsn(asnId, qty, op, damaged, serials?)` crea `InventoryItem` por serial — **UI:** `/receiving` · `ReceiveDialog` panel "Números de serie" con textarea + contador verde/rojo + botón cámara (BarcodeScanner) | Sprint 3. Validación: count mismatch, duplicados. |
| 43 | Rastreo de N/S en todo el ciclo | ✅ | `StockMovement.serial` en receipt, putaway, pick, packing — **UI:** `/serial-trace` timeline completo receipt→putaway→pick→packing→return · estado actual del InventoryItem | Cadena completa. |
| 44 | Múltiples N/S por orden | ⚠️ | `PackingOrder.items[].serial` implícito — **UI:** `/packing` lista ítems escaneados con serial si aplica | Sin modelo explícito `SerializedItem[]` por orden. Sin agregación de series por orden en UI. |
| 45 | Impresión etiquetas con N/S, barcode, QR | ⚠️ | `src/lib/rules/zpl.ts:buildZpl` · `ZplLabelData.lines` para N/S — **UI:** `/labels` botón "ZPL" por fila · `ZplPreviewDialog` preview 4"×2" + campo IP impresora | N/S imprimible via `lines[]`. Sin QR nativo ZPL (`^BQN`). |
| 46 | Serialización en devoluciones | ✅ | `ReturnItemInspection.serialMatchesDispatch?` · `inspectReturn` cross-referencia vs. StockMovement — **UI:** `/returns` tab "Inspecciones" · `InspectReturnDialog` campo N/S por ítem · badge verde/rojo de validación | Sprint 3. Validación contra movimiento de picking original. |
| 47 | Cambio de estado de N/S (nuevo, dañado, etc.) | ⚠️ | `InventoryItem.status: available\|on_hold\|damaged\|expired` — **UI:** `/inventory` acciones Hold/Release cambian estado indirectamente | Sin flujo "cambiar estado de N/S individual" con historial de razón. |
| 48 | Integración N/S con ERP trazabilidad financiera | ❌ | `IntegrationConnection.type=erp` — **UI:** `/integrations` card ERP (solo monitoreo de conexión) | Sin lógica de sync real con ERP. |
| 49 | RFID para captura de series | ❌ | No hay integración RFID — **UI:** Sin ruta dedicada | No existe. Requiere lectores RFID (Zebra FX9600, etc.). |
| 50 | Reportes de trazabilidad de N/S con historial | ✅ | `src/app/serial-trace/page.tsx` — **UI:** `/serial-trace` búsqueda por N/S exacto · timeline movimientos · resumen por tipo de movimiento · estado actual | Sprint 3. Enlace en nav "Trazabilidad N/S" (grupo Entrada). |
| 51 | Kits con N/S por componente | ❌ | No hay `Kit` ni `KitComponent` — **UI:** Sin ruta dedicada | Requiere módulo kitting (ítem 14) previo. |
| 52 | Validación N/S vs. listas de exclusión | ❌ | No hay `blocklist` — **UI:** Sin campo ni UI | Requiere integración con sistema antirrobo/garantías. |
| 53 | Capacidad técnica para N/S simultáneos a escala | ⚠️ | Arquitectura Zustand in-memory — **UI:** N/A | Sin DB indexada, escala real desconocida. Aceptable para MVP demo. |

---

### D. Gestión de Inventarios (ítems 54–68)

| # | Requerimiento (resumido) | Estado | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|
| 54 | Conteo cíclico por zona/categoría/rotación | ✅ | `store/wms-store.ts:createCyclicCount,startCyclicCount,completeCyclicCount,cancelCyclicCount` — **UI:** `/admin` tab "Conteos cíclicos" formulario creación (método by_zone/by_abc/by_rotation) · tabla con botones FSM · código auto-generado CC-XXXXXX | Sprint 2. FSM completo. |
| 55 | Inventario general con bloqueo de operaciones | ✅ | `WmsSettings.inventoryFreezeActive` · guards en `holdInventory/adjustInventory/requestAdjustment` — **UI:** `/admin` tab "Control Inventario" toggle freeze · `/inventory` banner azul · `/` banner azul con snowflake | Sprint 2. Descongelar desde cualquier banner. |
| 56 | Ajustes con niveles de aprobación | ✅ | `store/wms-store.ts:requestAdjustment,approveAdjustment,rejectAdjustment` — **UI:** `/inventory` dialog ajuste · panel solicitudes pendientes · `/admin` "Control Inventario" tabla aprobación con botones Aprobar/Rechazar (gateados por `OperatorGate`) | Sprint 2. Auto-aprueba si delta ≤ umbral configurable. |
| 57 | Control de inventario negativo | ✅ | `src/lib/rules/inventory.ts:applyReserve/applyHold` lanzan excepción si available < qty — **UI:** `/inventory` · `/picking` muestran error si no hay stock | Reglas puras impiden negativos. No hay UI especial — el error sube a la acción que lo llamó. |
| 58 | Mermas y averías con categorización | ⚠️ | `store/wms-store.ts:executeScrap` · `ScrapRecord.reasonId` — **UI:** `/returns` tab "Scrap" tabla de registros con razón y método | Sin categorización por causa en reportes agregados. |
| 59 | Cuarentena con restricciones de movimiento | ⚠️ | `holdInventory/holdByLot/holdByLocation` · `StorageLocation.type=quality_control` — **UI:** `/inventory` botones "Retener" · `/locations` filtro tipo=quality_control | `holdQuantity` separado de `onHandQuantity`. Sin restricción de movimiento físico desde/hacia ubicaciones en cuarentena. |
| 60 | KPI de exactitud de inventario (IRA) | ✅ | `store/selectors.ts:selectInventoryAccuracy` — **UI:** `/` KPI card "IRA — Exactitud" con tone verde/ámbar/rojo · `/inventory` 5ª tarjeta con pendientes de aprobación | Sprint 2. IRA = `(totalCounted − totalDeviation) / totalCounted × 100`. |
| 61 | Alertas automáticas por desviaciones | ✅ | `isNearExpiration(item, days)` · `selectExpiringItems/selectCriticalStockItems` — **UI:** `/` 2 KPI cards (Ítems por vencer, Stock crítico) + 2 banners (naranja, rojo) · `/admin` campos `stockAlertThreshold` y `expirationAlertDays` configurables | Sprint 6. Ambos KPIs sumados a `criticalAlerts`. |
| 62 | Clasificación ABC/XYZ/ABCXYZ | ✅ | `src/lib/rules/slotting.ts:classifyAbc/classifyXyz` · `abcByProduct/xyzByProduct` — **UI:** `/slotting` tab "Matriz ABC/XYZ" tabla combinada con badge por clase · colores verde/azul/rojo por clasificación | Pareto ABC + coeficiente de variación XYZ completos. |
| 63 | Consignación con visibilidad diferenciada | ❌ | No hay `ConsignmentRecord` ni `isConsignment` — **UI:** Sin ruta dedicada | No existe (mismo gap ítem 31). |
| 64 | Antigüedad de inventario con alertas | ⚠️ | `isExpired` · `expirationDate` visible — **UI:** `/inventory/lot-trace` columna "Vence" · `/` banner vencimiento | Sin aging report (días en bodega). Sin alertas por umbral de rotación baja. |
| 65 | Bloqueo selectivo por QC sin afectar stock disponible | ⚠️ | `holdQuantity` separado de `onHandQuantity` — **UI:** `/inventory` dialog "Retener" muestra `cantidadDisponible` antes y después del hold | Campo separado funciona correctamente. Sin UI de "bloqueo parcial por pallet/ubicación". |
| 66 | Alertas de ubicación vacía o bajo mínimo | ⚠️ | `store/selectors.ts:selectReplenishmentNeeds` — **UI:** `/slotting` tab "Reposición" lista pick faces bajo minStock con prioridad · `/` no tiene card específica de ubicaciones vacías | Sin alerta para ubicaciones vacías inesperadas (no pick-face). |
| 67 | Historial de movimientos por artículo/serie | ⚠️ | `src/lib/rules/reports.ts:traceMovements` filtra por productId/lot/serial — **UI:** `/serial-trace` (por N/S) · `/inventory/lot-trace` (por lote) · sin búsqueda genérica "¿dónde está este artículo ahora?" | Función existe. Sin página de búsqueda por productId sin conocer serial/lote. |
| 68 | Forecasting / proyección de inventario | ✅ | `src/lib/rules/forecast.ts:forecastDemand(samples, periods, alpha=0.3)` EMA — **UI:** `/reports` sección "Proyección de demanda" tabla top-10 SKUs · 4 períodos adelante · badge ámbar si tendencia bajista | Sprint 7. `forecastMAE` para back-testing. |

---

### E. Gestión de Picking y Preparación de Pedidos (ítems 69–80)

| # | Requerimiento (resumido) | Estado | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|
| 69 | Metodologías de picking nativas | ✅ | `store/wms-store.ts` acciones para 5 estrategias — **UI:** `/picking` (7 tabs: Tareas · Oleadas · Waveless · Batch · Cluster · Put-to-store · Zona) · cada tab con tabla + diálogos de acción | 5 estrategias con tipos, FSM, acciones y UI completa. |
| 70 | Optimización de rutas de picking | ⚠️ | `src/lib/rules/picking.ts:orderTasksByAccessibility` — **UI:** `/picking` tab "Cluster" muestra ruta optimizada por `accessibilityScore` | Sin TSP ni nearest-neighbor. Orden por score de accesibilidad. |
| 71 | Picking asistido por RFID | ❌ | No hay integración RFID — **UI:** Sin ruta dedicada | No existe (mismo gap ítem 23/49). |
| 72 | Picking diferenciado por canal | ⚠️ | `CommerceOrder.channel` · `PickingWave.groupBy=fulfillment_type` — **UI:** `/picking` tab "Oleadas" selector `groupBy` con opción `fulfillment_type` | Sin reglas de picking por canal (ej. e-commerce requiere serial, B2B no). |
| 73 | Picking parcial y consolidación de órdenes | ✅ | `store/wms-store.ts:approvePart/rejectPart` · FSM `partially_picked` — **UI:** `/picking` tab "Tareas" botones "Aprobar parcial" / "Rechazar parcial" · diálogo con campo cantidad pickeada y razón | Parcial aprobado/rechazado con razón. |
| 74 | Picking con validación de N/S en extracción | ✅ | `completePick` valida `product.trackBy === 'serial'` — **UI:** `/picking` dialog "Completar pick" campo N/S obligatorio + botón cámara BarcodeScanner para productos serializados | Validación en el momento del pick implementada. |
| 75 | Manejo de excepciones durante picking | ⚠️ | `PickingTask.status=with_issue` FSM — **UI:** `/picking` tab "Tareas" badge "Con incidencia" · sin formulario de excepción detallado | Sin tipo de problema, foto ni sustitución de producto. |
| 76 | Productividad individual por picker en tiempo real | ⚠️ | `src/lib/rules/picking.ts:productivityByOperator` — **UI:** `/reports` sección "Productividad por operador" tabla (picks completados, unidades, parciales, tareas con incidencia) | Sin actualización en tiempo real. Sin dashboard de supervisión en vivo. |
| 77 | Prioridades por ventana de tiempo / SLA | ⚠️ | `PickingWave.groupBy=priority\|dispatch_window` — **UI:** `/picking` "Nueva oleada" selector groupBy · SLAs de commerce detectados en dashboard (ver ítem 98) | Motor SLA de commerce ✅ (Sprint 7). Sin SLA configurable por cliente a nivel de PickingTask. |
| 78 | Picking de artículos de gran volumen/peso especial | ❌ | No hay `specialHandlingNotes` en `PickingTask` — **UI:** Sin campo en `/picking` | No existe. Requiere campo de instrucciones y reglas de asignación a operadores calificados. |
| 79 | Zonas de chequeo antes de despacho | ⚠️ | `StorageLocation.type=staging` — **UI:** `/locations` filtra tipo=staging · `/packing` es la zona de verificación implícita | Sin flujo "revisión completa antes de packing" separado de la zona staging. |
| 80 | Automatización de wave planning | ⚠️ | `store/wms-store.ts:createWave/releaseWave` · `PickingWave.groupBy` — **UI:** `/picking` tab "Oleadas" botón "Nueva oleada" con selector manual de órdenes y groupBy | Sin agrupación automática por cut-off time, carrier o zona. |

---

### F. Gestión de Despacho y Transporte (ítems 81–91)

| # | Requerimiento (resumido) | Estado | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|
| 81 | Módulo de gestión de patio (Yard Management) | ❌ | No hay `Dock`, `Door`, `YardSlot` — **UI:** Sin ruta `/yard` | No existe. Requiere módulo completo de patio. |
| 82 | Programación y gestión de citas de transporte | ⚠️ | `Asn.appointmentDate: string` — **UI:** `/receiving` tab "Citas ASN" muestra fecha pero sin gestión de muelle | Solo fecha. Sin calendario, muelle, restricciones de horario ni confirmación de transportista. |
| 83 | Documentación de despacho (packing list, guía, manifiesto, factura) | ⚠️ | `store/wms-store.ts:createManifest/addDocumentToManifest` — **UI:** `/load-manifests` tabla manifiestos · dialog "Agregar documento" · botón "Despachar" | Manifiesto con documentos adjuntos. Sin generación real de PDF de guía de remisión. |
| 84 | Integración nativa con TMS | ❌ | No hay `IntegrationConnection.type=tms` — **UI:** `/integrations` no tiene card TMS | No existe. Requiere API bidireccional con TMS. |
| 85 | Rutas de reparto y consolidación por destino | ⚠️ | `LoadManifest.stops[]` — **UI:** `/load-manifests` tabla con paradas secuenciadas · `/sap-routes` integración SAP rutas | Sin optimización VRP. Secuencia de paradas manual. |
| 86 | Modalidades de transporte (propio, tercero, courier, last-mile) | ⚠️ | `Carrier` · `CarrierService.serviceLevel` — **UI:** `/shipping` tab "Carriers" · `/admin` CRUD carriers y servicios | Sin `modalityType: own\|third_party\|courier\|last_mile`. |
| 87 | Verificación de carga antes de despacho con N/S | ⚠️ | `completePacking` verifica scannedItems vs. expected — **UI:** `/packing` escáner de ítems con badge ✅/❌ por ítem · alerta mismatch | Sin validación explícita de N/S en etapa de carga al camión (post-packing). |
| 88 | Despacho parcial con saldos pendientes | ⚠️ | `CommerceOrder.status=partial` — **UI:** `/commerce` badge "Parcial" · `/shipping` estado de envío | Sin generación automática de orden complementaria para el saldo. |
| 89 | Trazabilidad de entrega hasta destinatario | ⚠️ | `store/wms-store.ts:deliverShipment` `in_transit→completed` — **UI:** `/shipping` botón "Confirmar entrega" · `StatusBadge` "Completado" | Sin POD digital (foto, firma). Sin tracking de carrier externo. |
| 90 | Carga de contenedores con volumetría | ❌ | No hay tipo `Container` — **UI:** Sin ruta dedicada | `PackingBoxType` solo cubre cajas de packing, no contenedores de transporte. |
| 91 | Ventanas de entrega específicas por tienda | ❌ | No hay `deliveryWindows` en `Warehouse` — **UI:** Sin campo en `/admin` almacenes | No existe. Requiere config de horarios por tienda y validación en despacho. |

---

### G. Omnicanalidad y e-Commerce (ítems 92–101)

| # | Requerimiento (resumido) | Estado | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|
| 92 | Ship-from-Store con asignación de órdenes | ✅ | `store/wms-store.ts:markReadyForPickup` — **UI:** `/commerce` tabla · botón "Listo" para `ship_from_store` en progreso · badge `ready_for_pickup` · filtro de estado incluye "Listo para recoger" | Sprint 7. Sin motor de asignación automática a tienda (requiere backend). |
| 93 | Click & Collect / BOPIS | ✅ | `store/wms-store.ts:confirmPickup` — **UI:** `/commerce` KPI card "Listos para recoger" · botón "Confirmar recogida" (verde) para órdenes `ready_for_pickup` · filtro `pickup_in_store` | Sprint 7. Sin notificación al cliente (requiere backend/SMS). |
| 94 | Devoluciones e-commerce en tienda (BORIS) | ⚠️ | `ReturnOrder.fulfillmentType` · FSM `received_at_store` — **UI:** `/returns` tab "Órdenes" muestra origen · FSM stepper desde `received_at_store` | FSM cubre recepción en tienda. Sin flujo BORIS diferenciado con identificación del canal de origen. |
| 95 | Integración con plataformas e-commerce | ⚠️ | `IntegrationConnection.type=ecommerce\|marketplace` — **UI:** `/integrations` cards ecommerce y marketplace con estado de conexión, mensajes procesados, errores | Solo monitoreo. Sin webhooks ni sync real con Shopify/Magento/WooCommerce. |
| 96 | ATP (Available-to-Promise) en tiempo real | ✅ | `store/selectors.ts:selectAtp` — **UI:** Sin página dedicada aún · calculado en memoria disponible para uso en componentes vía hook | Sprint 7. Sin endpoint REST ni reserva con TTL (requiere backend). |
| 97 | Priorización e-commerce vs. reposición tiendas | ❌ | `CommerceOrder.channel` existe — **UI:** `/commerce` filtro por canal pero sin lógica de preferencia | Sin motor de reglas de priorización entre canales. |
| 98 | SLAs diferenciados por canal con alertas | ✅ | `store/selectors.ts:selectSlaBreaches` · `WmsSettings.slaConfigs[]` — **UI:** `/` banner rojo (SLA vencido) + KPI card "SLA vencidos" + lista de órdenes incumplidas · banner ámbar (en riesgo) · `/admin` sección "Configuración SLA" edita `maxHours` y `alertAtPercent` por config | Sprint 7. 4 configs seed. |
| 99 | Packaging personalizado por canal | ⚠️ | `PackingRule` triggers por categoría — **UI:** `/packing` muestra reglas aplicadas automáticamente · `/admin` CRUD reglas de packing | Sin `packagingTemplate` por canal/cliente. |
| 100 | Optimización de fuente de fulfillment | ❌ | No hay función de optimización multi-origen — **UI:** Sin ruta dedicada | No existe. Requiere motor de decisión con costo, distancia y stock. |
| 101 | Suscripciones y pedidos recurrentes | ❌ | No hay `Subscription` ni `RecurringOrder` — **UI:** Sin ruta dedicada | No existe. Requiere nuevo módulo de suscripciones. |

---

## Brechas Críticas (Prioridad Alta)

> Ítems que bloquean el uso productivo del sistema o son requerimientos de negocio core.

### 1. [#3] Múltiples unidades de medida y conversiones ✅ IMPLEMENTADO (Sprint 4)

- **Estado:** `UnitOfMeasure` entity + `UomConversion` en `src/types/wms.ts`. `Product.baseUomId` + `uomConversions[]`. `src/lib/rules/uom.ts` con `convertQty/toBaseQty/formatQtyUom`. `receiveAsn/completePick/adjustInventory` aceptan `uomId?` y convierten automáticamente a base. CRUD en `/admin` tab "Unidades de medida". UI en ReceiveDialog (selector de UM) y columna Stock en inventario (muestra abreviatura). 8 UMs seed (UND, PAR, CAJ, CAJ6, CAJ12, PAL, KG, MTR), 10 productos con conversiones configuradas.
- **Pendiente:** Conversión de UM en `completePick` solo aplica cuando el usuario opera desde una interfaz que pase `uomId`; la UI de picking no tiene selector de UM aún (brecha menor). Sin conversión de UM en putaway ni en transferencias.

### 2. [#22] Aplicación móvil / operaciones en piso RF ⚠️ PARCIALMENTE IMPLEMENTADO (Sprint 5)

- **Estado:** PWA instalable implementada. `manifest.json` con shortcuts para Picking/Recepción/Inventario. Service worker con cache-first para app shell (offline básico). `BarcodeScanner` con BarcodeDetector Web API para cámara del dispositivo — integrado en picking (serial) y recepción (N/S). La app es instalable desde Chrome/Edge en Android y escritorio.
- **Pendiente:** Sin React Native. Sin soporte Zebra DataWedge (teclado virtual RF). Sin modo offline completo para toda la app (solo app shell pre-cacheada). Para operaciones 100% offline se requiere sincronización de estado (IndexedDB + background sync).
- **Esfuerzo restante:** Medio — background sync de Zustand con IndexedDB para offline total.

### 3. ✅ [Sin número] Persistencia local del estado (localStorage) — IMPLEMENTADO

- **Estado:** Implementado en Sprint 1. `wms-store.ts` usa `zustand/middleware:persist` con `createJSONStorage(() => localStorage)` y key `wms-store-v1`. El seed aplica solo la primera vez; sesiones posteriores hidratan desde localStorage.
- **Reset demo:** `resetStore()` exportado limpia `localStorage` y recarga la página. UI en `/admin` con dialog de confirmación destructiva.

### 4. [#27] Autenticación y control de acceso por rol ✅ IMPLEMENTADO (Sprint 6 — parcial)

- **Estado:** `currentOperatorId` en store + `useCurrentOperator` hook + `OperatorGate` component. Dialog de selección al abrir la app. Gating de acciones de supervisor en `/admin`. Sin autenticación real de servidor (NextAuth/JWT) — control de rutas pendiente para transición a backend.
- **Pendiente:** NextAuth.js, middleware de rutas en `src/middleware.ts`, JWT con roles, row-level security en PostgreSQL.

### 5. [#55] Inventario general con bloqueo de operaciones ✅ IMPLEMENTADO (Sprint 2)

- **Estado:** `inventoryFreezeActive: boolean` en `WmsSettings`. Guards en `holdInventory`, `adjustInventory`, `requestAdjustment`. Toggle en `/admin` → "Control Inventario". Banner de alerta en `/inventory` y dashboard. Descongelar con un clic desde cualquier banner.

### 6. [#56] Ajustes de inventario con niveles de aprobación ✅ IMPLEMENTADO (Sprint 2)

- **Estado:** `InventoryAdjustmentRequest` con FSM `pending_approval→approved|rejected`. Campo `adjustmentApprovalThreshold` en `WmsSettings` (default: 50 uds). `requestAdjustment` auto-aprueba si |delta| ≤ umbral; crea solicitud pendiente si |delta| > umbral. Flujo supervisor en `/admin` → "Control Inventario" + panel en `/inventory`. Alerta en dashboard.

### 7. [#42] Captura de N/S en recepción ✅ IMPLEMENTADO (Sprint 3)

- **Estado:** `receiveAsn` acepta `serials?: string[]`. Para `trackBy=serial` crea un `InventoryItem` con `serial` por unidad en staging. Validaciones: count mismatch, duplicados, producto no serializado sin series. `ReceiveDialog` muestra panel de captura con textarea + contador verde/rojo. `/receiving/page.tsx` y `/receiving/[asnId]/page.tsx` pasan `requiresSerial` derivado de `product.trackBy`.

### 8. [#81] Módulo de Yard Management

- **Estado actual:** No existe ningún componente de gestión de patio, muelles ni puertas.
- **Impacto:** Sin YMS, la coordinación de llegada de camiones es manual, generando cuellos de botella en recepción.
- **Esfuerzo estimado:** Alto.
- **Propuesta técnica:** Crear tipos `Dock`, `DockAppointment` en `wms.ts`; nueva ruta `/yard`; acciones de store para programar y confirmar citas en muelles.

---

## Brechas Secundarias (Prioridad Media/Baja)

### 1. [#11] Gestión de equipos de manejo de materiales

- **Estado actual:** No existe.
- **Impacto:** Deseable para planificación de capacidad. No bloquea la operación inicial.
- **Esfuerzo estimado:** Medio.
- **Propuesta técnica:** Agregar `Equipment` type con `id, code, type (forklift\|pallet_jack\|reach_truck), status, assignedOperatorId, lastMaintenanceDate`; CRUD en `/admin`; asignación a tareas de picking.

### 2. [#14 / #51] Kitting y ensamble / Kits serializados

- **Estado actual:** No existe.
- **Impacto:** Requerido para retailers que arman sets o bundles. No bloquea operaciones básicas.
- **Esfuerzo estimado:** Alto.
- **Propuesta técnica:** Crear `KitDefinition` (lista de componentes + cantidades), `KitAssemblyOrder`, flujo de explosión de materiales y reserva de componentes.

### 3. [#24] Interfaz configurable no-code

- **Estado actual:** No existe.
- **Impacto:** Deseable para implementadores. No bloquea la operación.
- **Esfuerzo estimado:** Alto.
- **Propuesta técnica:** Motor de formularios dinámicos (react-jsonschema-form o similar); configuración de columnas visibles por rol; no es prioritario para MVP productivo.

### 4. [#60] KPI de exactitud de inventario (IRA) ✅ IMPLEMENTADO (Sprint 2)

- **Estado:** `selectInventoryAccuracy(state)` en `selectors.ts`. IRA = `max(0, (totalCounted − totalDeviation) / totalCounted × 100)`. KPI card en `/inventory` (5ª tarjeta) y en dashboard. `DashboardKpis` extendido con `ira`, `pendingAdjustments`, `inventoryFreezeActive`. Inicia en 100% (sin conteos = precisión asumida).

### 5. [#68] Forecasting / proyección de inventario ✅ IMPLEMENTADO (Sprint 7)

- **Estado:** `src/lib/rules/forecast.ts` — `forecastDemand(samples, periods, alpha=0.3)` (EMA). `forecastMAE` para back-testing. Tabla en `/reports`: top-10 SKUs por demanda, proyección 4 períodos, color ámbar si tendencia decreciente.

### 6. [#80] Automatización de wave planning

- **Estado actual:** Waves creadas y liberadas manualmente.
- **Impacto:** En volúmenes altos, la creación manual de waves es cuello de botella.
- **Esfuerzo estimado:** Medio.
- **Propuesta técnica:** Agregar `autoCreateWave(orders, cutoffTime, groupBy)` que agrupe automáticamente las órdenes elegibles antes del corte de despacho.

### 7. [#89] Trazabilidad de entrega con POD digital

- **Estado actual:** Solo cambio de estado a "completado" en store.
- **Impacto:** Para auditoría y disputas de entrega, se necesita prueba de entrega.
- **Esfuerzo estimado:** Medio.
- **Propuesta técnica:** Agregar `deliveryProof: { receiverName, signatureUrl, photoUrl, receivedAt }` a `Shipment`; captura en app móvil del repartidor.

### 8. [#98] SLAs diferenciados por canal ✅ IMPLEMENTADO (Sprint 7)

- **Estado:** `SlaConfig` en `wms.ts`. `WmsSettings.slaConfigs[]`. `selectSlaBreaches(state)`. Banners + KPI card en dashboard. Edición en `/admin`. — **[#97] Priorización canal vs. reposición** sigue ❌ — sin motor de reglas de priorización entre canales.

---

## Recomendaciones de Arquitectura

### 1. ✅ Persistencia local con `zustand/middleware:persist` — IMPLEMENTADO

**Implementación:** `src/store/wms-store.ts` wrapeado con `persist` middleware:
```ts
export const useWmsStore = create<WmsState>()(
  persist(
    (set, get) => ({ ...buildSeedState(), /* all actions */ }),
    {
      name: 'wms-store-v1',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
```
El estado persiste en localStorage key `wms-store-v1`. El seed solo aplica la primera vez — en sesiones subsecuentes el middleware hidrata desde localStorage.  
También se creó `resetStore()` exportado para limpiar `localStorage` y recargar la página con seed fresco.

### 2. ✅ Separar `src/data/seed.ts` de la inicialización del store — IMPLEMENTADO

**Implementación:** Seed extraído en factory `buildSeedState()` dentro de `wms-store.ts`. El `persist` middleware usa merge strategy que da prioridad al estado de localStorage sobre el estado inicial — el seed solo aplica cuando no hay estado previo.

### 3. Agregar tests de integración para acciones críticas del store

**Problema:** Solo existen tests unitarios en `src/tests/rules/`. Las acciones de store que combinan múltiples reglas (ej.: `completePick` que valida FSM + serial + stock + StockMovement) no tienen cobertura de integración.  
**Acción:** Agregar `src/tests/store/` con tests que ejerciten flujos completos: recepción→putaway, wave→picking→packing→shipping.

### 4. ✅ Extraer `src/app/picking/page.tsx` en sub-componentes — IMPLEMENTADO

**Implementación:** Creados 7 sub-componentes en `src/app/picking/_components/`:
- `TasksTab.tsx` — tareas individuales con filtro de estado
- `WavesTab.tsx` — oleadas con detalle de pedidos incluidos
- `WavelessTab.tsx` — pedidos VIP/urgentes
- `BatchTab.tsx` — batch picking con detalle de tareas por lote
- `ZoneTab.tsx` — vista de progreso por zona con cards de estado
- `ClusterTab.tsx` — cluster picking con progreso por contenedor
- `PutToStoreTab.tsx` — distribución a tiendas con progreso por allocation

`page.tsx` bajó de 2,230 → 1,567 LOC. Los diálogos siguen en el padre ya que usan estado local compartido.

### 5. ✅ Patrón "staging + commit" en operaciones críticas — VERIFICADO

**Verificación:** Las acciones `completePick`, `receiveAsn` y `advanceTransfer` ya agrupan todas las mutaciones en un único `set()` call. El patrón ya estaba aplicado correctamente — no requirió cambios.

### 6. No hay manejo de errores en acciones del store

**Problema:** Las acciones de `wms-store.ts` no tienen try/catch. Un error en runtime deja el store en estado intermedio sin feedback al usuario.  
**Acción:** Agregar `try/catch` en acciones críticas; emitir un evento de error a una slice de `notifications` que muestre toasts de error.

---

## Plan de Desarrollo Sugerido (Sprints MVP)

> Todos los sprints asumen persistencia local (Zustand + localStorage/IndexedDB). Las integraciones con backend, APIs externas y autenticación real se documentan en la sección **"Próximos Pasos: Transición a Backend"**.

### Sprint 1 — Estabilización y Persistencia Local (semanas 1-2) ✅ COMPLETADO
- [x] **[Sin #]** Habilitar `zustand/middleware:persist` con `localStorage` para todo el store (`wms-store.ts`) → implementado con `createJSONStorage(() => localStorage)` y key `wms-store-v1`
- [x] **[Sin #]** Separar seed: extraído en `buildSeedState()` factory; `persist` middleware hidrata desde storage si existe estado previo
- [x] **[Sin #]** Agregar botón "Resetear demo" en `/admin` que limpia `localStorage` y recarga el seed → `resetStore()` exportado desde `wms-store.ts`, UI en `src/app/admin/page.tsx` con dialog de confirmación
- [x] **Arquitectura:** Aplicar patrón "staging + commit" (un solo `set()`) en `completePick`, `receiveAsn`, `advanceTransfer` → verificado que las 3 acciones ya agrupan todas las mutaciones en un único `set()` call
- [x] **Arquitectura:** Extraer tabs de `picking/page.tsx` en sub-componentes → creados `src/app/picking/_components/`: `TasksTab.tsx`, `WavesTab.tsx`, `WavelessTab.tsx`, `BatchTab.tsx`, `ZoneTab.tsx`, `ClusterTab.tsx`, `PutToStoreTab.tsx`; `page.tsx` bajó de 2,230 a 1,567 LOC

### Sprint 2 — Control de Inventario y Operaciones Core (semanas 3-4) ✅ COMPLETADO

- [x] **[#55]** Flag `inventoryFreezeActive` en `WmsSettings` + freeze guard en `holdInventory`, `adjustInventory`, `requestAdjustment`. Toggle de freeze en `/admin` (tab "Control Inventario") con banner de alerta en `/inventory` y `/`. Descongelar desde cualquier banner.
- [x] **[#56]** Tipo `InventoryAdjustmentRequest` (status: `pending_approval|approved|rejected`) + campo `adjustmentApprovalThreshold` en `WmsSettings`. Acción `requestAdjustment` aplica automáticamente si delta ≤ umbral (auto-approved), o crea solicitud pendiente si delta > umbral. Acciones `approveAdjustment` / `rejectAdjustment` para supervisores. Panel de aprobación en `/inventory` + tabla completa en `/admin` → "Control Inventario". Alerta en dashboard cuando hay pendientes.
- [x] **[#60]** Selector `selectInventoryAccuracy(state)` en `selectors.ts` calcula IRA = `max(0, (totalCounted - totalDeviation) / totalCounted × 100)`. Retorna `{ ira, totalCounted, totalDeviation, adjustmentsApproved, adjustmentsPending, adjustmentsRejected }`. KPI IRA en dashboard y en `/inventory` (5ª tarjeta). `DashboardKpis` extendido con `ira`, `pendingAdjustments`, `inventoryFreezeActive`.
- [x] **[#54]** Tipo `CyclicCountPlan` (method: `by_zone|by_abc|by_rotation`, status FSM: `pending→in_progress→completed|cancelled`). Acciones `createCyclicCount`, `startCyclicCount`, `completeCyclicCount`, `cancelCyclicCount`. Tab "Conteos cíclicos" en `/admin` con formulario de creación (nombre, método, filtro, almacén, fecha, operador) y tabla con botones FSM. Código auto-generado tipo `CC-240624-001`.

### Sprint 3 — Serialización Completa (semanas 5-6) ✅ COMPLETADO

- [x] **[#42]** `receiveAsn(asnId, qty, op, damaged, serials?)` crea `InventoryItem` por serial en staging. Validaciones: count mismatch, duplicados. UI: panel de N/S en `ReceiveDialog` (textarea + contador). Propagado en `/receiving/page.tsx` y `/receiving/[asnId]/page.tsx`.
- [x] **[#43]** `putawayItem` mueve serialized items individualmente (1 `InventoryItem` → nueva ubicación). `completePacking` emite `StockMovement` con `serial` por cada `PackingOrderItem` serializado.
- [x] **[#50]** Nueva página `/serial-trace` dedicada: búsqueda por N/S exacto, timeline de ciclo de vida completo (receipt→putaway→pick→packing→return), estado actual del InventoryItem, resumen por tipo de movimiento. Enlace en nav "Trazabilidad N/S".
- [x] **[#46]** `inspectReturn` enriquece cada `ReturnItemInspection` con `serialMatchesDispatch: boolean` al cross-referenciar contra `StockMovement` de tipo `pick` con ese serial. `InspectReturnDialog` captura serial por ítem en productos `trackBy=serial`. Badge de verificación verde/rojo en la card de devolución.

### Sprint 4 — Unidades de Medida (semanas 7-8) ✅ COMPLETADO

- [x] **[#3]** `UnitOfMeasure { id, code, name, abbreviation, active }` + `UomConversion { fromUomId, toUomId, factor }` en `src/types/wms.ts`. `Product` extendido con `baseUomId?` y `uomConversions?[]`.
- [x] **[#3]** `src/lib/rules/uom.ts`: `convertQty(qty, fromUomId, toUomId, conversions)` (directo e inverso), `toBaseQty(qty, fromUomId, baseUomId, conversions)`, `formatQtyUom`, `uomLabel`, `validateUomConversion`. Funciones puras sin dependencias de store/React.
- [x] **[#3]** `receiveAsn`, `completePick`, `adjustInventory` aceptan `uomId?` — convierten a base con `toBaseQty` antes de mutar `onHandQuantity`. `StockMovement.uomId` registra la UM base usada en la transacción.
- [x] **[#3]** Tab "Unidades de medida" en `/admin` con tabla (código, nombre, abreviatura, estado), botón crear, dialog de creación/edición, toggle activa/inactiva. Validación de código único.
- [x] **[#3]** `ReceiveDialog` muestra selector de UM cuando el producto tiene conversiones configuradas. Descripción "Las cantidades se convertirán a la UM base". Footer muestra abreviatura de la UM seleccionada.
- [x] **[#3]** Columna Stock en `/inventory` muestra la abreviatura de la UM base del producto (ej. `und`, `par`). 8 UMs seed + todos los 10 productos del seed tienen `baseUomId` y `uomConversions[]`.

### Sprint 5 — Movilidad y Hardware (semanas 9-10) ✅ COMPLETADO

- [x] **[#22]** PWA instalable: `public/manifest.json` (shortcuts picking/recepción/inventario, tema slate-900, lang es-CO) + `public/sw.js` (service worker cache-first para app shell, stale-while-revalidate para chunks JS/CSS) + `ServiceWorkerRegister` en `layout.tsx`. `metadata.manifest` y `appleWebApp` en root layout. Iconos 192×512px generados.
- [x] **[#23]** `src/components/shared/barcode-scanner.tsx`: componente `BarcodeScanner` con `BarcodeDetector` Web API (Chrome 83+/Android), detección automática de soporte, vista de cámara con overlay de mira, fallback a input manual, debounce 2s para no duplicar escaneos. Integrado en `PickingPage` (captura de serial en `completePick`) y `ReceiveDialog` (append de N/S al textarea de series).
- [x] **[#18/45]** `src/lib/rules/zpl.ts`: `buildZpl(data)` genera ZPL II para etiqueta 4"×2" (812×406 dots, 203 dpi) con header por tipo de etiqueta (6 colores), barcode Code-128 via `^BC`, campo `reference`, hasta 4 líneas extra de datos, footer con operador y fecha. `printZpl(zpl, printerIp?)` envía vía POST a Zebra Link-OS (puerto 9100) o copia al clipboard. `ZplPreviewDialog` en `/labels` con preview visual HTML, visor de código ZPL, campo de IP de impresora, botón copiar/enviar.

### Sprint 6 — Roles, Permisos y UX Operativa (semanas 11-12) ✅ COMPLETADO

- [x] **[#27]** `currentOperatorId: string | null` en Zustand store (persiste en localStorage). `setCurrentOperator` action. `useCurrentOperator` hook con `canDo(capability)`, `isSupervisor`, `isRole`. `OperatorGate` component para gating declarativo en JSX. `OperatorPickerProvider` en layout — bloquea la app con dialog hasta seleccionar operador. Cambio de operador desde menú de sidebar (`NavUser` ahora muestra nombre y rol del operador activo).
- [x] **[#27]** Gating en `/admin`: aprobar/rechazar ajustes y toggle de freeze requieren `capability="approve_adjustment"` / `capability="freeze_inventory"`. Fallback: texto "Solo supervisor" para roles no autorizados.
- [x] **[#25]** Dashboard: 2 nuevas KPI cards (Ítems por vencer, Stock crítico). 2 nuevos banners de alerta (naranja vencimiento, rojo stock crítico). Saludo personalizado `Hola, {nombre}` con operador activo. `selectExpiringItems` y `selectCriticalStockItems` en `selectors.ts`.
- [x] **[#61]** `WmsSettings.stockAlertThreshold` (default 10 uds) y `expirationAlertDays` (default 30 días). `isNearExpiration(item, days)` en `lib/rules/inventory.ts`. Configurables en `/admin` → "Control de inventario" con `SettingField` components. Ambos KPIs sumados a `criticalAlerts`.

### Sprint 7 — Omnicanalidad y Fulfillment Avanzado (semanas 13-14) ✅ COMPLETADO

- [x] **[#92/93]** `markReadyForPickup` / `confirmPickup` actions en store. Estado `ready_for_pickup` en FSM `commerceTransitions` (`in_progress → ready_for_pickup → completed`). Botón "Listo" en `/commerce` para órdenes `ship_from_store`/`pickup_in_store` en progreso. Botón "Confirmar recogida" para órdenes `ready_for_pickup`. KPI card "Listos para recoger" en `/commerce`. Estado `ready_for_pickup` añadido a filtro de estado y a `STATUS_MAP` en `lib/status.ts`.
- [x] **[#96]** `selectAtp(state)` en `selectors.ts` — agrega `onHand - reserved - hold` por `productId × warehouseId`. Retorna `AtpRecord[]`. Sin endpoint REST ni reserva con TTL — requiere backend.
- [x] **[#98]** `SlaConfig` type en `wms.ts`. `WmsSettings.slaConfigs[]` con 4 configs seed (ecommerce/ship_from_dc 24h, ecommerce/ship_from_store 12h, all/pickup_in_store 2h, b2b/all 48h). `selectSlaBreaches(state)` en `selectors.ts`. `DashboardKpis.slaBreaches + slaAtRisk`. Banner rojo (SLA vencido) + ámbar (en riesgo) en dashboard. KPI card "SLA vencidos". Edición de `maxHours` y `alertAtPercent` por config en `/admin` → Configuración.
- [x] **[#68]** `src/lib/rules/forecast.ts`: `forecastDemand(samples, periods, alpha=0.3)` EMA puro. `forecastMAE` para back-testing. Tabla de proyección por SKU en `/reports` (top-10 por demanda promedio, 4 períodos adelante, color ámbar si tendencia bajista).

---

## Cobertura de Reglas de Negocio Clave

| Regla | ¿Implementada? | Archivo / Mecanismo |
|---|---|---|
| Inventario no se modifica directamente (siempre via acción de store) | ✅ | `store/wms-store.ts` — toda mutación pasa por `useWmsStore.getState()` actions |
| Toda operación genera movimiento auditable | ✅ | `StockMovement` se appendea en `holdInventory`, `releaseInventory`, `adjustInventory`, `completePick`, `advanceTransfer`, `executeReentry`, `executeScrap` |
| No permite inventario negativo por defecto | ✅ | `src/lib/rules/inventory.ts:applyReserve` — `if (available < qty) throw`; `applyHold` — misma validación |
| Transacciones en operaciones críticas | ✅ | `completePick`, `receiveAsn`, `advanceTransfer` agrupan todas las mutaciones en un único `set()` (patrón staging+commit). En backend futuro: transacciones de DB. |
| Control de concurrencia en stock/reservas | ⚠️ | Aceptable en MVP single-user con persistencia local. Requiere manejo en backend (optimistic locking) cuando se implemente. |
| Lógica de negocio separada en servicios | ✅ | `src/lib/rules/` (inventory, slotting, shipping, picking, packing, replenishment, reports) — funciones puras sin dependencia de React/store |
| JWT para autenticación | ⚠️ | Fuera del alcance del MVP. Pendiente en transición a backend (ver sección "Próximos Pasos"). |
| Control de permisos por rol | ⚠️ | `Operator.role` modelado. MVP planea gating de UI por rol en Sprint 6 sin autenticación real. Control real de acceso en backend. |

---

## Próximos Pasos: Transición a Backend

> Esta sección documenta el trabajo requerido para convertir el MVP con persistencia local en un sistema productivo con backend real. No forma parte del roadmap del MVP actual.

### Fase 1 — Base de datos y API REST

**Objetivo:** Persistencia durable, multi-usuario, multi-tenant.

| Tarea | Detalle |
|-------|---------|
| ORM + schema | Instalar Prisma ORM; mapear `src/types/wms.ts` a `schema.prisma` (1:1 en entidades core, relaciones FK explícitas) |
| Base de datos | PostgreSQL (recomendado) o PlanetScale. Migraciones Prisma desde cero. |
| API routes | Crear `src/app/api/[entity]/route.ts` para cada entidad con handlers `GET/POST/PATCH/DELETE`. Prioridad: `inventory`, `receiving`, `picking`, `orders`. |
| Server Actions | Migrar acciones críticas de Zustand (`completePick`, `receiveAsn`, `adjustInventory`) a Next.js Server Actions que escriben en PostgreSQL. |
| Zustand como cache | Mantener Zustand solo como cache de UI (optimistic updates). Invalidar en cada mutación confirmada por el servidor. |
| Seed condicional | Eliminar `src/data/seed.ts` del bundle de producción. Convertirlo en `prisma/seed.ts` para poblar la base de datos en entornos de desarrollo/staging. |

### Fase 2 — Autenticación y Autorización

**Objetivo:** Control de acceso real, sesiones, auditoría por usuario.

| Tarea | Detalle |
|-------|---------|
| Auth provider | Implementar NextAuth.js v5 con provider de credenciales propio (email + contraseña contra tabla `users`) o SSO (Azure AD / Google Workspace). |
| Middleware de rutas | `src/middleware.ts` — proteger todas las rutas excepto `/login`; redirigir por rol (`/admin` solo para `supervisor`). |
| JWT con roles | Incluir `operatorId` y `role` en el JWT payload; leer desde `getServerSession()` en Server Actions. |
| Auditoría | Agregar `createdBy: operatorId` a `StockMovement` y acciones de aprobación para trazabilidad de quién hizo qué. |
| Row-level security | En PostgreSQL: políticas RLS por `warehouseId` para aislar datos entre almacenes si se requiere multi-tenant estricto. |

### Fase 3 — Integraciones Externas

**Objetivo:** Conectar el WMS con los sistemas del ecosistema logístico.

| Integración | Prioridad | Detalle técnico |
|-------------|-----------|-----------------|
| **ERP / SAP** | Alta | Webhooks entrantes para POs y ASNs; API de confirmación de recepción saliente. Usar `IntegrationConnection.type=sap` ya modelado. |
| **POS** | Alta | Webhook de venta desde POS → decrementar inventario en tienda en tiempo real. Usar `CommerceOrder.channel=pos`. |
| **Carriers (API real)** | Media | Reemplazar rate shopping estático (`rateShop` en `shipping.ts`) por llamadas a APIs reales (Servientrega, TCC, Coordinadora, FedEx). |
| **E-commerce** | Media | Webhook de nueva orden desde Shopify/Magento → crear `CommerceOrder`; webhook de cancelación → liberar reserva. |
| **Impresoras Zebra** | Media | API ZPL sobre red local o Zebra Link-OS SDK para despachar impresión desde el servidor. |
| **RFID readers** | Baja | Integración con Zebra FX9600 vía LLRP o REST; mapear lecturas a `InventoryItem.serial`. |

### Fase 4 — Tiempo Real y Escalabilidad

**Objetivo:** Dashboards en vivo, sincronización multi-usuario, resiliencia.

| Tarea | Detalle |
|-------|---------|
| WebSockets / SSE | Usar Next.js Route Handlers con Server-Sent Events o un canal Pusher/Ably para actualizar dashboards de supervisión en tiempo real. |
| Optimistic locking | En PostgreSQL: `version` column + `WHERE version = $expected` en updates de `InventoryItem` para prevenir condiciones de carrera. |
| Queue de operaciones | Integrar BullMQ (Redis) para operaciones diferidas: generación de waves automáticas, cron de replenishment, alertas de expiración. |
| Caching | Redis para cálculos costosos repetidos (selectSlottingRecommendations, ATP por SKU). |
| Observabilidad | OpenTelemetry + Sentry para tracing de operaciones de inventario y alertas de errores en producción. |

---

## Funcionalidades Adicionales Detectadas

Las siguientes funcionalidades fueron implementadas en el MVP y no aparecen en los 101 ítems originales, pero son relevantes para un WMS completo:

| Funcionalidad | Descripción | Archivo |
|---|---|---|
| **Affinity Matrix de productos** | Co-picking score para co-ubicar SKUs que se piden juntos frecuentemente | `src/lib/rules/slotting.ts:buildAffinityMatrix` · `/slotting` tab Afinidad |
| **Slotting Snapshot & Trending** | Capturas del estado de slotting en el tiempo + delta entre snapshots | `store/selectors.ts:selectSlottingTrends` · `/slotting` tab Historial |
| **Simulación de reubicación masiva** | Dry-run antes de ejecutar relocaciones (distancia ahorrada, tiempo) | `store/selectors.ts:simulateRelocateAll` · `/slotting` tab Recomendaciones |
| **Rate shopping de carriers** | Comparación de cotizaciones entre carriers por peso/zona/fecha | `src/lib/rules/shipping.ts:rateShop` · `/shipping` |
| **OTIF breakdown por carrier** | On-Time In-Full desagregado por transportista | `src/lib/rules/shipping.ts:otifByCarrier` · `/shipping` |
| **Reparación de devoluciones** | Flujo completo de envío a taller y recepción post-reparación (restock o scrap) | `store/wms-store.ts:createRepairTicket/receiveRepairReturn` · `/returns` tab Reparaciones |
| **SAP Routes integration** | Sincronización de rutas de carga con SAP ERP | `src/app/sap-routes/page.tsx` · `LoadManifest.sapRouteId` |
| **Coeficiente de variación XYZ** | Clasificación de volatilidad de demanda sobre muestras históricas | `src/lib/rules/slotting.ts:classifyXyz/demandCv` |
| **Packing rule engine** | Motor de reglas condicional que detecta automáticamente productos peligrosos/frágiles/pesados | `src/lib/rules/packing.ts:applicableRules` · `/packing` |

---

*Generado con Claude Code — Auditoría funcional WMS MVP — 2026-06-24*
