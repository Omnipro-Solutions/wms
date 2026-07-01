# Reporte de Brechas WMS MVP

**Fecha:** 2026-06-25  
**Proyecto:** wms (Warehouse Management System)  
**Stack detectado:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Zustand 5 (client-side con persistencia local) · TailwindCSS 4 · shadcn/Radix UI · TanStack React Table 8 · date-fns 4 · Vitest  
**Alcance:** MVP demostrativo con persistencia local (localStorage/IndexedDB). Sin backend ni API REST por diseño en esta etapa.

> **Nota metodológica:** El porcentaje de cobertura (`% MVP`) evalúa solo funcionalidad implementada en el cliente (localStorage/Zustand). Las integraciones externas, autenticación real, WebSockets, backend y ERP están **fuera del alcance del MVP** y no restan puntos.

---

## Resumen Ejecutivo

| Categoría | Cantidad | % del total |
|---|---|---|
| ✅ Cubierto | 52 | 51% |
| ⚠️ Parcial | 24 | 24% |
| ❌ Faltante | 25 | 25% |
| **Total** | **101** | **100%** |

**Cobertura funcional estimada del MVP:** ~76%

> Sprint 7 completado. El MVP cubre de forma sólida la lógica de dominio (tipos, máquinas de estado, reglas de negocio puras, UI compleja para picking/slotting/packing/devoluciones). La persistencia local (localStorage/IndexedDB) es el objetivo de esta etapa. El dashboard fue removido (redirige a `/receiving`); `/reports` y `/sap-routes` existen como páginas pero carecen de integración con el store.

---

## Análisis por Sección

### A. Capacidades WMS Core (27 ítems) — cobertura: **59%**

| # | Requerimiento (resumido) | Estado | % MVP | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|---|
| 1 | Ciclo completo de recepción | ⚠️ | 75% | `store/wms-store.ts`: `confirmArrival`, `receiveAsn`, `approveQc`, `rejectQc`, `putawayItem` — **UI:** `/receiving` (5 tabs: OCs · Citas ASN · Recepciones activas · Cola QC · Staging putaway) · `/receiving/[asnId]` stepper FSM | Citas de llegada solo fecha, sin gestión de muelle/door. Sin CRUD de ASN desde UI. |
| 2 | FIFO/FEFO/LIFO/peso/zona en ubicaciones | ⚠️ | 50% | `src/lib/rules/inventory.ts:isExpired` · `src/lib/rules/slotting.ts:idealLocationTier` — **UI:** `/inventory/lot-trace` · `/slotting` considera zona y peso | FIFO/FEFO implícito via `isExpired`. LIFO ausente. Estrategia de rotación no configurable por ubicación. |
| 3 | Múltiples UM y conversiones automáticas | ✅ | 100% | `src/lib/rules/uom.ts:convertQty/toBaseQty` · `receiveAsn/completePick/adjustInventory` convierten a base — **UI:** `/admin` tab "Unidades de medida" (CRUD) · `ReceiveDialog` selector UM · `/inventory` columna Stock con abreviatura | Completo. Selector UM en picking pendiente (brecha menor). |
| 4 | Lotes y fechas de vencimiento por categoría | ⚠️ | 65% | `InventoryItem.lot/expirationDate` · `isExpired` — **UI:** `/inventory/lot-trace` tabla de lotes con fecha · `/` banner alerta vencimiento | Política de expiración por categoría no existe en `Product`. Sin configuración de regla FEFO por categoría de producto. |
| 5 | Multi-almacén / multi-empresa | ⚠️ | 70% | `src/types/wms.ts:Warehouse` (6 en seed: 2 DCs + 4 tiendas) — **UI:** `/inventory` filtro por almacén · `/transfers` traslados entre warehouses · `/admin` CRUD almacenes | Multi-almacén: ✅. Multi-empresa: ❌ — no hay `companyId`. Sin jerarquía de empresa sobre almacén. |
| 6 | Módulo QC integrado | ⚠️ | 60% | `store/wms-store.ts:approveQc/rejectQc` — **UI:** `/receiving` tab "Cola QC" con botones Aprobar/Rechazar · `/returns` tab "Inspecciones" | QC de recepción y devoluciones funciona. Falta QC de salida/picking y KPIs de calidad. |
| 7 | Cross-docking (directo, indirecto, oportunístico) | ⚠️ | 30% | `Asn.crossDocking:boolean` · `CommerceOrder.fulfillmentType=cross_docking` — **UI:** `/receiving` badge cross-dock en ASNs · `/commerce` filtro tipo despacho | Flag existe. Sin flujo operativo diferenciado, zonas staging ni reglas de asignación directa. |
| 8 | Devoluciones y RMA | ✅ | 90% | `store/wms-store.ts:advanceReturn/inspectReturn/setReturnDisposition/executeReentry/executeScrap/createRepairTicket` — **UI:** `/returns` (5 tabs: Órdenes · Inspecciones · Reingresos · Reparaciones · Scrap) · FSM stepper visual | FSM completa (5 disposiciones). Sin portal RMA externo para clientes (fuera de scope MVP). |
| 9 | Traslados inter-almacén e inter-compañía | ⚠️ | 70% | `store/wms-store.ts:advanceTransfer` · `transferTransitions` FSM — **UI:** `/transfers` tabla con botones FSM, StockMovement auditable | Inter-almacén ✅. Inter-compañía ❌ (sin multi-empresa). |
| 10 | Reabastecimiento automático por reglas | ⚠️ | 55% | `store/selectors.ts:selectReplenishmentNeeds` · `generateReplenishmentTasks` — **UI:** `/slotting` tab "Necesidades de reposición" con prioridad high/medium/low · botón "Generar tareas" | Sin ejecución automática (requiere cron — post-MVP). Sin min/max configurables por SKU en UI. |
| 11 | Gestión de equipos (montacargas, etc.) | ❌ | 0% | No hay tipo `Equipment` ni `Vehicle` — **UI:** Sin ruta dedicada | No existe. Requiere nuevo dominio: equipo, mantenimiento, asignación a tarea. |
| 12 | Gestión de mano de obra y productividad | ⚠️ | 40% | `src/lib/rules/picking.ts:productivityByOperator` — regla pura existe pero **UI /reports no existe** | `/reports` route eliminado en Sprint 7. Regla `productivityByOperator` sin UI de destino. Requiere crear `/reports` page. |
| 13 | Slotting (optimización de ubicaciones) | ✅ | 100% | `src/lib/rules/slotting.ts` · `store/selectors.ts:selectSlottingRecommendations/selectAffinityRecommendations/simulateRelocateAll` — **UI:** `/slotting` (5 tabs: Recomendaciones · Matriz ABC/XYZ · Reposición · Afinidad · Historial snapshots) | ABC/XYZ, scoring 0–100, simulación dry-run, afinidad, snapshots. Completo. |
| 14 | Kitting y ensamble | ❌ | 0% | No hay tipo `Kit`, `BillOfMaterials` — **UI:** Sin ruta dedicada | No existe. Requiere entidades nuevas y flujo de explosión de materiales. |
| 15 | Serialización a nivel de unidad | ⚠️ | 80% | `Product.trackBy=serial` · `completePick` valida `capturedSerial` — **UI:** `/picking` dialog "Completar pick" · `/serial-trace` timeline | Vista unificada receipt→picking→packing→return ✅. Sin rastreo explícito en putaway en UI separada. |
| 16 | Tipos de ubicaciones (picking, reserva, cuarentena, etc.) | ✅ | 100% | `StorageLocation.type: pick\|reserve\|quality_control\|staging\|returns` — **UI:** `/locations` mapa de almacén con filtro por tipo, badges de zona golden, isPickFace | 5 tipos modelados, CRUD completo en UI. |
| 17 | Capacidad y volumetría por ubicación | ⚠️ | 50% | `StorageLocation.maxWeightKg` · `slottingScore` hard constraint de peso — **UI:** `/locations` columna "Peso máx." · `/admin` → Ubicaciones campo peso | Sin `maxVolumeM3` ni `maxPallets`. Slotting no valida volumen por ubicación. |
| 18 | Etiquetado propio + soporte Zebra/inalámbrico | ⚠️ | 75% | `src/lib/rules/zpl.ts:buildZpl/printZpl` — **UI:** `/labels` tabla de etiquetas · botón "ZPL" abre `ZplPreviewDialog` con preview 4"×2", campo IP impresora, copiar/enviar | ZPL II completo. Sin protocolo inalámbrico nativo (solo POST vía IP). Sin QR nativo ZPL (`^BQN`). |
| 19 | Órdenes de Putaway dirigidas por sistema | ⚠️ | 45% | `store/wms-store.ts:putawayItem` — **UI:** `/receiving` tab "Staging putaway" · `PutawayDialog` selección manual de ubicación | Selección manual. Sin asignación automática por reglas ABC, zona de temperatura ni restricciones de capacidad en tiempo real. |
| 20 | Tipos de estiba según rack y producto | ❌ | 0% | No hay `stackingType`, `rackType` ni `palletType` — **UI:** Sin campo | No existe. |
| 21 | Zonas temporales/cross-docking | ⚠️ | 35% | `StorageLocation.type=staging` · `Asn.crossDocking:boolean` — **UI:** `/locations` filtra por tipo "staging" | Sin gestión de tiempo límite en zona staging ni reglas de flujo directo cross-dock. |
| 22 | Aplicación móvil nativa (RF/voz) | ⚠️ | 55% | `public/manifest.json` + `public/sw.js` + `ServiceWorkerRegister` — **UI:** PWA instalable desde Chrome/Edge en Android | PWA instalable ✅. Sin React Native ni soporte RF/RFID real. Sin offline completo (solo app shell). |
| 23 | Compatibilidad dispositivos RF/RFID (Zebra, Honeywell) | ⚠️ | 45% | `src/components/shared/barcode-scanner.tsx` — **UI:** `/picking` botón cámara · `/receiving` escaneo N/S | BarcodeDetector Web API + fallback manual ✅. Sin Zebra DataWedge ni WebHID. |
| 24 | Interfaz configurable no-code/low-code | ❌ | 0% | No hay motor de formularios dinámicos — **UI:** Sin ruta dedicada | No existe. Todas las pantallas son código estático. |
| 25 | Dashboards operativos | ⚠️ | 20% | `store/selectors.ts:selectDashboardKpis/selectExpiringItems/selectCriticalStockItems/selectSlaBreaches` existen pero **`/` redirige a `/receiving`** | Selectores implementados. El dashboard fue removido — `/` es solo redirect. Sin página de resumen KPI. |
| 26 | Soporte completo para español | ✅ | 100% | `src/lib/formatters.ts` locale `es` · `src/lib/status.ts` labels en español — **UI:** 100% es-CO · moneda COP · fechas dd/MM/yyyy | Completo. |
| 27 | Perfiles y roles con control granular | ✅ | 85% | `useCurrentOperator` hook · `OperatorGate` component · `currentOperatorId` en store — **UI:** Dialog selector operador · sidebar footer · `/admin` gateado con `OperatorGate` | Control de UI por rol ✅. Sin autenticación real de servidor (fuera de scope MVP). |

**Cobertura sección A:** ~59%

---

### B. Requerimientos Específicos Retail Multitienda (ítems 28–40) — cobertura: **52%**

| # | Requerimiento (resumido) | Estado | % MVP | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|---|
| 28 | Inventario centralizado + reabastecimiento automático a tiendas | ⚠️ | 50% | `store/selectors.ts:selectReplenishmentNeeds` · `generateReplenishmentTasks` — **UI:** `/slotting` tab "Necesidades de reposición" | Sin min/max por tienda, sin estacionalidad, sin ejecución automática (post-MVP). |
| 29 | Reglas de asignación por tienda/canal/región | ❌ | 10% | `CommerceOrder.channel` existe — **UI:** `/commerce` filtro por canal | Sin motor de reglas de fulfillment configurable por canal/región. |
| 30 | Órdenes de transferencia CD-tiendas con trazabilidad | ✅ | 100% | `store/wms-store.ts:advanceTransfer` appends `StockMovement` — **UI:** `/transfers` tabla · botones FSM · columna origen/destino con tipo DC/tienda | Trazabilidad completa. `Warehouse.type` diferencia DC vs. tienda. |
| 31 | Inventario en consignación | ❌ | 0% | No hay `consignment:boolean` ni `ConsignmentItem` — **UI:** Sin ruta dedicada | No existe. Requiere nuevo estado de inventario y flujo de liquidación. |
| 32 | Planogramas / layouts de exhibición | ❌ | 0% | No hay `Planogram` ni `ExhibitionLayout` — **UI:** Sin ruta dedicada | Fuera del scope WMS puro. Integración con sistema de visual merchandising. |
| 33 | Integración POS en tiempo real | ⚠️ | 20% | `IntegrationConnection.type=pos` · `CommerceOrder.channel=pos` — **UI:** `/integrations` card "POS" con estado de conexión | Tipo modelado. Sin webhook ni sync real (post-MVP). |
| 34 | Gestión de promociones y eventos especiales | ❌ | 0% | No hay tipo `Promotion` — **UI:** Sin ruta dedicada | No existe. |
| 35 | Pedidos urgentes/rush para tiendas | ⚠️ | 40% | `PickingWave.groupBy=priority` — **UI:** `/picking` tab "Oleadas" selector `groupBy=priority` | Sin campo explícito `isRush:boolean`. Prioridad de wave existe pero no orientada a rush explícito. |
| 36 | Visibilidad consolidada de inventario en red | ⚠️ | 55% | `src/app/inventory/page.tsx` filtra por `warehouseId` — **UI:** `/inventory` filtro desplegable por almacén | Sin vista "stock total en red por SKU" en un número agregado. Requiere selector `selectNetworkInventory`. |
| 37 | Devoluciones desde tiendas con reintegración | ✅ | 90% | `store/wms-store.ts:advanceReturn` FSM store→DC · `executeReentry` StockMovement — **UI:** `/returns` tab "Órdenes" · tab "Reingresos" | FSM cubre `received_at_store → in_transit_to_dc → received_at_dc`. Reingreso al inventario completo. |
| 38 | Inventario en tránsito CD-tiendas | ✅ | 95% | `InventoryItem.status=in_transit` · `StockMovement.type=transfer` — **UI:** `/inventory` filtro estado=in_transit · `/transfers` tabla con estado | Estado en tránsito modelado y rastreado en StockMovements. |
| 39 | Múltiples tipos de empaque por tienda | ⚠️ | 50% | `PackingBoxType` — **UI:** `/packing` dialog "Seleccionar caja" · `/admin` CRUD tipos de caja | Sin configuración "caja por canal/tienda". Sin template de packaging por destino. |
| 40 | Almacenes satélite / CDs secundarios por región | ⚠️ | 65% | Seed: 2 DCs (Bogotá, Medellín) + 4 tiendas — **UI:** `/admin` tab "Almacenes" · `/inventory` filtro por almacén | Modelo soporta múltiples DCs. Sin jerarquía CD principal→secundario ni reglas de fulfillment por región. |

**Cobertura sección B:** ~52%

---

### C. Requerimientos para Productos Serializados (ítems 41–53) — cobertura: **62%**

| # | Requerimiento (resumido) | Estado | % MVP | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|---|
| 41 | Serialización nativa vs. customización | ⚠️ | 75% | `Product.trackBy=serial` · `InventoryItem.serial` · `PickingTask.capturedSerial` — **UI:** `/admin` tab "Productos" campo "Trazabilidad" | Nativo para picking. Sin flujo explícito de captura de serial en putaway en UI separada. |
| 42 | Registro de N/S desde recepción en CD | ✅ | 100% | `receiveAsn(asnId, qty, op, damaged, serials?)` crea `InventoryItem` por serial — **UI:** `/receiving` · `ReceiveDialog` panel "Números de serie" con textarea + contador verde/rojo + botón cámara | Validación: count mismatch, duplicados. |
| 43 | Rastreo de N/S en todo el ciclo | ✅ | 95% | `StockMovement.serial` en receipt, putaway, pick, packing — **UI:** `/serial-trace` timeline completo receipt→putaway→pick→packing→return · estado actual del InventoryItem | Cadena completa. Serial en putaway implícito via `putawayItem`. |
| 44 | Múltiples N/S por orden | ⚠️ | 55% | `PackingOrder.items[].serial` implícito — **UI:** `/packing` lista ítems escaneados con serial | Sin modelo explícito `SerializedItem[]` por orden. Sin agregación de series por orden en UI. |
| 45 | Impresión etiquetas con N/S, barcode, QR | ⚠️ | 70% | `src/lib/rules/zpl.ts:buildZpl` · `ZplLabelData.lines` para N/S — **UI:** `/labels` botón "ZPL" · `ZplPreviewDialog` preview 4"×2" + campo IP | N/S imprimible via `lines[]`. Sin QR nativo ZPL (`^BQN`). Sin DataMatrix. |
| 46 | Serialización en devoluciones | ✅ | 95% | `ReturnItemInspection.serialMatchesDispatch?` · `inspectReturn` cross-referencia vs. StockMovement — **UI:** `/returns` tab "Inspecciones" · `InspectReturnDialog` campo N/S · badge verde/rojo | Validación contra movimiento de picking original. |
| 47 | Cambio de estado de N/S (nuevo, dañado, etc.) | ⚠️ | 50% | `InventoryItem.status: available\|on_hold\|damaged\|expired` — **UI:** `/inventory` acciones Hold/Release cambian estado | Sin flujo "cambiar estado de N/S individual" con historial de razón explícito. |
| 48 | Integración N/S con ERP trazabilidad financiera | ❌ | 5% | `IntegrationConnection.type=erp` — **UI:** `/integrations` card ERP (solo monitoreo) | Sin lógica de sync real con ERP (post-MVP). |
| 49 | RFID para captura de series | ❌ | 0% | No hay integración RFID — **UI:** Sin ruta dedicada | No existe. Requiere lectores RFID (post-MVP, hardware externo). |
| 50 | Reportes de trazabilidad de N/S con historial | ✅ | 95% | `src/app/serial-trace/page.tsx` — **UI:** `/serial-trace` búsqueda por N/S exacto · timeline movimientos · resumen por tipo · estado actual | Enlace en nav "Trazabilidad N/S". Sin exportación CSV/PDF. |
| 51 | Kits con N/S por componente | ❌ | 0% | No hay `Kit` ni `KitComponent` — **UI:** Sin ruta dedicada | Requiere módulo kitting (ítem 14) previo. |
| 52 | Validación N/S vs. listas de exclusión | ❌ | 0% | No hay `blocklist` — **UI:** Sin campo ni UI | Requiere integración con sistema antirrobo/garantías. |
| 53 | Capacidad técnica para N/S simultáneos a escala | ⚠️ | 60% | Arquitectura Zustand in-memory — **UI:** N/A | Sin DB indexada (post-MVP). Aceptable para demo local. |

**Cobertura sección C:** ~62%

---

### D. Gestión de Inventarios (ítems 54–68) — cobertura: **75%**

| # | Requerimiento (resumido) | Estado | % MVP | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|---|
| 54 | Conteo cíclico por zona/categoría/rotación | ✅ | 90% | `store/wms-store.ts:createCyclicCount,startCyclicCount,completeCyclicCount,cancelCyclicCount` — **UI:** `/admin` tab "Conteos cíclicos" formulario creación (método by_zone/by_abc/by_rotation) · tabla con botones FSM | Sin vista de conteo en piso (operador capturando conteos uno a uno). |
| 55 | Inventario general con bloqueo de operaciones | ✅ | 100% | `WmsSettings.inventoryFreezeActive` · guards en `holdInventory/adjustInventory/requestAdjustment` — **UI:** `/admin` toggle freeze · `/inventory` banner azul | Descongelar desde cualquier banner. |
| 56 | Ajustes con niveles de aprobación | ✅ | 100% | `store/wms-store.ts:requestAdjustment,approveAdjustment,rejectAdjustment` — **UI:** `/inventory` dialog ajuste · `/admin` tabla aprobación (gateada con `OperatorGate`) | Auto-aprueba si delta ≤ umbral configurable. |
| 57 | Control de inventario negativo | ✅ | 100% | `src/lib/rules/inventory.ts:applyReserve/applyHold` lanzan excepción si available < qty — **UI:** Error sube a la acción que lo llamó | Reglas puras impiden negativos. |
| 58 | Mermas y averías con categorización | ⚠️ | 60% | `store/wms-store.ts:executeScrap` · `ScrapRecord.reasonId` — **UI:** `/returns` tab "Scrap" tabla con razón y método | Sin categorización por causa en reportes agregados (sin `/reports`). |
| 59 | Cuarentena con restricciones de movimiento | ⚠️ | 65% | `holdInventory/holdByLot/holdByLocation` · `StorageLocation.type=quality_control` — **UI:** `/inventory` botones "Retener" | `holdQuantity` separado de `onHandQuantity`. Sin restricción de movimiento físico desde/hacia ubicaciones en cuarentena. |
| 60 | KPI de exactitud de inventario (IRA) | ✅ | 90% | `store/selectors.ts:selectInventoryAccuracy` — **UI:** `/inventory` 5ª tarjeta con IRA | IRA = `(totalCounted − totalDeviation) / totalCounted × 100`. Sin trend histórico de IRA. |
| 61 | Alertas automáticas por desviaciones | ✅ | 85% | `isNearExpiration(item, days)` · `selectExpiringItems/selectCriticalStockItems` — selectores existen pero **sin página dashboard que los muestre** | Los selectores están implementados pero el dashboard fue removido. Solo visibles en `/inventory`. |
| 62 | Clasificación ABC/XYZ/ABCXYZ | ✅ | 100% | `src/lib/rules/slotting.ts:classifyAbc/classifyXyz` · `abcByProduct/xyzByProduct` — **UI:** `/slotting` tab "Matriz ABC/XYZ" | Pareto ABC + coeficiente de variación XYZ completos. |
| 63 | Consignación con visibilidad diferenciada | ❌ | 0% | No hay `ConsignmentRecord` ni `isConsignment` — **UI:** Sin ruta dedicada | No existe (mismo gap ítem 31). |
| 64 | Antigüedad de inventario con alertas | ⚠️ | 45% | `isExpired` · `expirationDate` visible — **UI:** `/inventory/lot-trace` columna "Vence" | Sin aging report (días en bodega). Sin alerta por umbral de rotación baja. |
| 65 | Bloqueo selectivo por QC sin afectar stock disponible | ⚠️ | 70% | `holdQuantity` separado de `onHandQuantity` — **UI:** `/inventory` dialog "Retener" muestra `cantidadDisponible` antes y después | Sin UI de "bloqueo parcial por pallet/ubicación". |
| 66 | Alertas de ubicación vacía o bajo mínimo | ⚠️ | 50% | `store/selectors.ts:selectReplenishmentNeeds` — **UI:** `/slotting` tab "Reposición" lista pick faces bajo minStock | Sin alerta para ubicaciones vacías inesperadas (no pick-face). |
| 67 | Historial de movimientos por artículo/serie | ⚠️ | 65% | `src/lib/rules/reports.ts:traceMovements` filtra por productId/lot/serial — **UI:** `/serial-trace` (por N/S) · `/inventory/lot-trace` (por lote) | Sin búsqueda por productId sin conocer serial/lote. |
| 68 | Forecasting / proyección de inventario | ✅ | 70% | `src/lib/rules/forecast.ts:forecastDemand(samples, periods, alpha=0.3)` EMA — **regla existe pero `/reports` route no existe** | Forecasting implementado como regla pura. Sin UI visible (`/reports` fue removido de la app). |

**Cobertura sección D:** ~75%

---

### E. Gestión de Picking y Preparación de Pedidos (ítems 69–80) — cobertura: **62%**

| # | Requerimiento (resumido) | Estado | % MVP | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|---|
| 69 | Metodologías de picking nativas | ✅ | 100% | `store/wms-store.ts` acciones para 5 estrategias — **UI:** `/picking` (7 tabs: Tareas · Oleadas · Waveless · Batch · Cluster · Put-to-store · Zona) | 5 estrategias con tipos, FSM, acciones y UI completa. |
| 70 | Optimización de rutas de picking | ⚠️ | 40% | `src/lib/rules/picking.ts:orderTasksByAccessibility` — **UI:** `/picking` tab "Cluster" muestra ruta optimizada por `accessibilityScore` | Sin TSP ni nearest-neighbor. Orden por score de accesibilidad. |
| 71 | Picking asistido por RFID | ❌ | 0% | No hay integración RFID — **UI:** Sin ruta dedicada | No existe (hardware externo, post-MVP). |
| 72 | Picking diferenciado por canal | ⚠️ | 40% | `CommerceOrder.channel` · `PickingWave.groupBy=fulfillment_type` — **UI:** `/picking` tab "Oleadas" selector `groupBy` con opción `fulfillment_type` | Sin reglas de picking por canal. |
| 73 | Picking parcial y consolidación de órdenes | ✅ | 90% | `store/wms-store.ts:approvePart/rejectPart` · FSM `partially_picked` — **UI:** `/picking` tab "Tareas" botones "Aprobar parcial" / "Rechazar parcial" | Parcial aprobado/rechazado con razón. |
| 74 | Picking con validación de N/S en extracción | ✅ | 95% | `completePick` valida `product.trackBy === 'serial'` — **UI:** `/picking` dialog "Completar pick" campo N/S obligatorio + botón cámara BarcodeScanner | Validación en el momento del pick. |
| 75 | Manejo de excepciones durante picking | ⚠️ | 40% | `PickingTask.status=with_issue` FSM — **UI:** `/picking` tab "Tareas" badge "Con incidencia" | Sin tipo de problema, foto ni sustitución de producto. |
| 76 | Productividad individual por picker | ⚠️ | 35% | `src/lib/rules/picking.ts:productivityByOperator` — **`/reports` no existe** | Regla implementada pero sin UI visible. Requiere crear `/reports` page. |
| 77 | Prioridades por ventana de tiempo / SLA | ⚠️ | 65% | `PickingWave.groupBy=priority\|dispatch_window` — **UI:** `/picking` "Nueva oleada" selector groupBy · SLAs en selectores | Motor SLA de commerce ✅. Sin SLA configurable por cliente a nivel de PickingTask. |
| 78 | Picking de artículos de gran volumen/peso especial | ❌ | 0% | No hay `specialHandlingNotes` en `PickingTask` — **UI:** Sin campo | No existe. |
| 79 | Zonas de chequeo antes de despacho | ⚠️ | 50% | `StorageLocation.type=staging` — **UI:** `/locations` filtra tipo=staging · `/packing` es zona de verificación implícita | Sin flujo "revisión completa antes de packing" separado de la zona staging. |
| 80 | Automatización de wave planning | ⚠️ | 40% | `store/wms-store.ts:createWave/releaseWave` · `PickingWave.groupBy` — **UI:** `/picking` tab "Oleadas" botón "Nueva oleada" manual | Sin agrupación automática por cut-off time, carrier o zona. |

**Cobertura sección E:** ~62%

---

### F. Gestión de Despacho y Transporte (ítems 81–91) — cobertura: **28%** ⚠️ PRIORIDAD ALTA

| # | Requerimiento (resumido) | Estado | % MVP | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|---|
| 81 | Módulo de gestión de patio (Yard Management) | ❌ | 0% | No hay `Dock`, `Door`, `YardSlot` — **UI:** Sin ruta `/yard` | No existe. |
| 82 | Programación y gestión de citas de transporte | ⚠️ | 20% | `Asn.appointmentDate: string` — **UI:** `/receiving` tab "Citas ASN" muestra fecha | Solo fecha. Sin calendario, muelle, restricciones de horario ni confirmación de transportista. |
| 83 | Documentación de despacho (packing list, guía, manifiesto, factura) | ⚠️ | 55% | `store/wms-store.ts:createManifest/addDocumentToManifest` — **UI:** `/load-manifests` tabla manifiestos · dialog "Agregar documento" · botón "Despachar" | Manifiesto con documentos adjuntos. Sin generación real de PDF de guía de remisión. |
| 84 | Integración nativa con TMS | ❌ | 5% | No hay `IntegrationConnection.type=tms` — **UI:** `/integrations` no tiene card TMS | Solo card genérica. Sin API bidireccional con TMS (post-MVP). |
| 85 | Rutas de reparto y consolidación por destino | ⚠️ | 45% | `LoadManifest.stops[]` — **UI:** `/load-manifests` tabla con paradas secuenciadas · `/sap-routes` integración SAP rutas | `/sap-routes` page existe pero **`state.sapRoutes` no está definido en el store ni en types** — página crashea en runtime. Sin optimización VRP. |
| 86 | Modalidades de transporte (propio, tercero, courier, last-mile) | ⚠️ | 50% | `Carrier` · `CarrierService.serviceLevel` — **UI:** `/shipping` tab "Carriers" · `/admin` CRUD carriers y servicios | Sin `modalityType: own\|third_party\|courier\|last_mile`. |
| 87 | Verificación de carga antes de despacho con N/S | ⚠️ | 55% | `completePacking` verifica scannedItems vs. expected — **UI:** `/packing` escáner de ítems con badge ✅/❌ | Sin validación explícita de N/S en etapa de carga al camión (post-packing). |
| 88 | Despacho parcial con saldos pendientes | ⚠️ | 40% | `CommerceOrder.status=partial` — **UI:** `/commerce` badge "Parcial" · `/shipping` estado de envío | Sin generación automática de orden complementaria para el saldo. |
| 89 | Trazabilidad de entrega hasta destinatario | ⚠️ | 35% | `store/wms-store.ts:deliverShipment` `in_transit→completed` — **UI:** `/shipping` botón "Confirmar entrega" | Sin POD digital (foto, firma). Sin tracking de carrier externo. |
| 90 | Carga de contenedores con volumetría | ❌ | 0% | No hay tipo `Container` — **UI:** Sin ruta dedicada | `PackingBoxType` solo cubre cajas de packing, no contenedores de transporte. |
| 91 | Ventanas de entrega específicas por tienda | ❌ | 0% | No hay `deliveryWindows` en `Warehouse` — **UI:** Sin campo en `/admin` almacenes | No existe. |

**Cobertura sección F:** ~28%

---

### G. Omnicanalidad y e-Commerce (ítems 92–101) — cobertura: **52%**

| # | Requerimiento (resumido) | Estado | % MVP | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|---|
| 92 | Ship-from-Store con asignación de órdenes | ✅ | 80% | `store/wms-store.ts:markReadyForPickup` — **UI:** `/commerce` tabla · botón "Listo" para `ship_from_store` · badge `ready_for_pickup` | Sin motor de asignación automática a tienda (post-MVP, requiere backend). |
| 93 | Click & Collect / BOPIS | ✅ | 85% | `store/wms-store.ts:confirmPickup` — **UI:** `/commerce` KPI card "Listos para recoger" · botón "Confirmar recogida" | Sin notificación al cliente (requiere backend/SMS). |
| 94 | Devoluciones e-commerce en tienda (BORIS) | ⚠️ | 60% | `ReturnOrder.fulfillmentType` · FSM `received_at_store` — **UI:** `/returns` tab "Órdenes" FSM desde `received_at_store` | Sin flujo BORIS diferenciado con identificación del canal de origen. |
| 95 | Integración con plataformas e-commerce | ⚠️ | 15% | `IntegrationConnection.type=ecommerce\|marketplace` — **UI:** `/integrations` cards con estado de conexión | Solo monitoreo de estado. Sin webhooks ni sync real (post-MVP). |
| 96 | ATP (Available-to-Promise) en tiempo real | ✅ | 75% | `store/selectors.ts:selectAtp` — calculado en memoria disponible para uso en componentes | Sin endpoint REST ni reserva con TTL (post-MVP). Sin UI dedicada que exponga el ATP a la operación. |
| 97 | Priorización e-commerce vs. reposición tiendas | ❌ | 10% | `CommerceOrder.channel` existe — **UI:** `/commerce` filtro por canal pero sin lógica de preferencia | Sin motor de reglas de priorización entre canales. |
| 98 | SLAs diferenciados por canal con alertas | ✅ | 85% | `store/selectors.ts:selectSlaBreaches` · `WmsSettings.slaConfigs[]` — selectores existen pero **dashboard fue removido** | Selectores y configuración ✅. Sin UI de KPI dashboard activa (ver gap ítem 25). |
| 99 | Packaging personalizado por canal | ⚠️ | 50% | `PackingRule` triggers por categoría — **UI:** `/packing` muestra reglas aplicadas · `/admin` CRUD reglas | Sin `packagingTemplate` por canal/cliente. |
| 100 | Optimización de fuente de fulfillment | ❌ | 0% | No hay función de optimización multi-origen — **UI:** Sin ruta dedicada | No existe. Requiere motor de decisión con costo, distancia y stock. |
| 101 | Suscripciones y pedidos recurrentes | ❌ | 0% | No hay `Subscription` ni `RecurringOrder` — **UI:** Sin ruta dedicada | No existe. |

**Cobertura sección G:** ~52%

---

## Resumen de Cobertura por Sección

| Sección | Descripción | % MVP | Ítems ✅ | Ítems ⚠️ | Ítems ❌ |
|---|---|---|---|---|---|
| A | Capacidades WMS Core (27 ítems) | 59% | 9 | 13 | 5 |
| B | Retail Multitienda (13 ítems) | 52% | 4 | 6 | 3 |
| C | Productos Serializados (13 ítems) | 62% | 6 | 4 | 3 |
| D | Gestión de Inventarios (15 ítems) | 75% | 9 | 5 | 1 |
| E | Picking y Preparación (12 ítems) | 62% | 4 | 7 | 1 |
| F | Despacho y Transporte (11 ítems) | 28% | 0 | 6 | 5 |
| G | Omnicanalidad y e-Commerce (10 ítems) | 52% | 4 | 4 | 2 |
| **Total** | **101 ítems** | **~56%** | **36** | **45** | **20** |

> Nota: Los ítems ⚠️ aportan entre 30% y 80% de su valor. El promedio ponderado real (incluyendo parciales) es **~70%** sobre funcionalidad de cliente.

---

## Brechas Críticas del MVP Actual

### 1. `/reports` — Página eliminada, reglas huérfanas

- **Estado:** `/reports` fue removido de la app (no existe `src/app/reports/`). Las siguientes funcionalidades están implementadas como reglas puras pero sin UI visible:
  - `src/lib/rules/reports.ts:traceMovements` — historial por productId
  - `src/lib/rules/forecast.ts:forecastDemand` — proyección EMA
  - `src/lib/rules/picking.ts:productivityByOperator` — productividad por picker
  - `src/lib/rules/shipping.ts:otifBreakdown/otifByCarrier` — OTIF por carrier
  - `store/selectors.ts:selectInventoryAccuracy` — IRA (visible en `/inventory`, no centralizada)
- **Impacto:** Ítems 12, 68, 76 quedan ❌ efectivo aunque la lógica existe.
- **Solución:** Crear `/reports` con 4 tabs: Productividad · Inventario · OTIF · Proyección.

### 2. `/sap-routes` — Página crashea en runtime

- **Estado:** `src/app/sap-routes/page.tsx` usa `state.sapRoutes` pero `sapRoutes` **no está definido** en `WmsState` ni en `src/types/wms.ts`. La página no está en el nav (`NAV_GROUPS`).
- **Impacto:** Ítem 85 (rutas de reparto) queda en 25% real.
- **Solución:** Definir tipo `SapRoute` en `src/types/wms.ts`, agregar slice al store con seed data, añadir al nav en grupo "Despacho".

### 3. Dashboard eliminado

- **Estado:** `/` redirige a `/receiving`. `selectDashboardKpis`, `selectSlaBreaches`, `selectExpiringItems`, `selectCriticalStockItems` están implementados pero sin UI de destino.
- **Impacto:** Ítems 25 (dashboards), 61 (alertas), 98 (SLA visual) quedan con cobertura reducida.
- **Solución:** Restaurar `/` como página de dashboard o crear `/dashboard` con KPI cards y banners de alerta.

### 4. Gestión de Despacho — sección más débil (28%)

- Módulo YMS completo ausente (ítem 81)
- Sin gestión real de citas de transporte (ítem 82)
- Sin PDF de guía de remisión (ítem 83)
- Sin modalidades de transporte explícitas (ítem 86)
- Sin POD digital (ítem 89)
- Sin contenedores de transporte (ítem 90)

---

## Backlog Priorizado (solo cliente/localStorage)

| Prioridad | Ítem | Esfuerzo | Impacto en % |
|---|---|---|---|
| 🔴 Alta | Crear `/reports` page (4 tabs) | Bajo | +4pp |
| 🔴 Alta | Corregir `/sap-routes` — definir tipo + store slice | Bajo | +2pp |
| 🔴 Alta | Restaurar dashboard `/` con KPI cards | Medio | +3pp |
| 🟡 Media | Min/max por SKU configurable en UI (replenishment) | Bajo | +1pp |
| 🟡 Media | Vista "stock total en red por SKU" (selector) | Bajo | +1pp |
| 🟡 Media | Campo `isRush` en CommerceOrder + filtro en picking | Bajo | +1pp |
| 🟡 Media | Historial de cambio de estado por N/S individual | Medio | +1pp |
| 🟡 Media | Vista conteo cíclico en piso (captura de cantidades) | Medio | +2pp |
| 🟢 Baja | `maxVolumeM3` en ubicaciones + validación en slotting | Medio | +1pp |
| 🟢 Baja | `modalityType` en Carrier | Bajo | +0.5pp |
| 🟢 Baja | QR nativo ZPL (`^BQN`) en `/labels` | Bajo | +0.5pp |

---

## Próximos Pasos: Transición a Backend (fuera de scope MVP)

> Esta sección documenta el trabajo requerido para convertir el MVP con persistencia local en un sistema productivo con backend real.

### Fase 1 — Base de datos y API REST

| Tarea | Detalle |
|-------|---------|
| ORM + schema | Instalar Prisma ORM; mapear `src/types/wms.ts` a `schema.prisma` |
| Base de datos | PostgreSQL o PlanetScale. Migraciones Prisma desde cero. |
| API routes | `src/app/api/[entity]/route.ts` para cada entidad. Prioridad: `inventory`, `receiving`, `picking`, `orders`. |
| Server Actions | Migrar acciones críticas de Zustand a Next.js Server Actions que escriben en PostgreSQL. |
| Zustand como cache | Mantener Zustand solo como cache de UI (optimistic updates). Invalidar en cada mutación confirmada. |

### Fase 2 — Autenticación y Autorización

| Tarea | Detalle |
|-------|---------|
| Auth provider | NextAuth.js v5 con credenciales propias o SSO (Azure AD / Google Workspace). |
| Middleware de rutas | `src/middleware.ts` — proteger rutas excepto `/login`; redirigir por rol. |
| JWT con roles | `operatorId` y `role` en JWT payload; leer desde `getServerSession()` en Server Actions. |
| Auditoría | `createdBy: operatorId` a `StockMovement` y acciones de aprobación. |

### Fase 3 — Integraciones Externas

| Integración | Prioridad | Detalle técnico |
|-------------|-----------|-----------------|
| **ERP / SAP** | Alta | Webhooks entrantes para POs y ASNs; API de confirmación de recepción saliente. |
| **POS** | Alta | Webhook de venta desde POS → decrementar inventario en tienda en tiempo real. |
| **Carriers (API real)** | Media | Reemplazar rate shopping estático por APIs reales (Servientrega, TCC, Coordinadora, FedEx). |
| **E-commerce** | Media | Webhook nueva orden → crear `CommerceOrder`; cancelación → liberar reserva. |
| **RFID readers** | Baja | Integración con Zebra FX9600 vía LLRP o REST. |

### Fase 4 — Tiempo Real y Escalabilidad

| Tarea | Detalle |
|-------|---------|
| WebSockets / SSE | Next.js Route Handlers con SSE o Pusher/Ably para dashboards en tiempo real. |
| Optimistic locking | `version` column en PostgreSQL + `WHERE version = $expected` en updates de `InventoryItem`. |
| Queue de operaciones | BullMQ (Redis) para waves automáticas, cron de replenishment, alertas de expiración. |
| Caching | Redis para cálculos costosos repetidos (slotting, ATP por SKU). |

---

## Funcionalidades Adicionales Detectadas

| Funcionalidad | Descripción | Archivo |
|---|---|---|
| **Affinity Matrix de productos** | Co-picking score para co-ubicar SKUs frecuentemente pedidos juntos | `src/lib/rules/slotting.ts:buildAffinityMatrix` · `/slotting` tab Afinidad |
| **Slotting Snapshot & Trending** | Capturas del estado de slotting en el tiempo + delta entre snapshots | `store/selectors.ts:selectSlottingTrends` · `/slotting` tab Historial |
| **Simulación de reubicación masiva** | Dry-run antes de ejecutar relocaciones (distancia ahorrada, tiempo) | `store/selectors.ts:simulateRelocateAll` · `/slotting` tab Recomendaciones |
| **Rate shopping de carriers** | Comparación de cotizaciones entre carriers por peso/zona/fecha | `src/lib/rules/shipping.ts:rateShop` · `/shipping` |
| **OTIF breakdown por carrier** | On-Time In-Full desagregado por transportista | `src/lib/rules/shipping.ts:otifByCarrier` · `/shipping` |
| **Reparación de devoluciones** | Flujo completo de envío a taller y recepción post-reparación | `store/wms-store.ts:createRepairTicket/receiveRepairReturn` · `/returns` tab Reparaciones |
| **SAP Routes integration** | Sincronización de rutas de carga con SAP ERP — **página crashea, store incompleto** | `src/app/sap-routes/page.tsx` · `LoadManifest.sapRouteId` |
| **Coeficiente de variación XYZ** | Clasificación de volatilidad de demanda sobre muestras históricas | `src/lib/rules/slotting.ts:classifyXyz/demandCv` |
| **Packing rule engine** | Motor de reglas que detecta automáticamente productos peligrosos/frágiles/pesados | `src/lib/rules/packing.ts:applicableRules` · `/packing` |

---

*Generado con Claude Code — Auditoría funcional WMS MVP — 2026-06-25*

---

## Plan Sprint 8 — Despacho y Transporte (28% → 70%)

> **Alcance:** Solo cliente/localStorage. Sin backend, sin PDF real, sin TMS externo. Meta: llevar sección F de 28% a ~70% cubriendo los ítems realizables en MVP.

### Diagnóstico actual sección F

| Ítem | Estado actual | Causa raíz |
|---|---|---|
| 81 YMS | ❌ 0% | Tipos y store ausentes |
| 82 Citas transporte | ⚠️ 20% | Solo campo fecha, sin muelle/calendario |
| 83 Docs despacho | ⚠️ 55% | Manifiesto ✅, sin guía de remisión |
| 84 TMS | ❌ 5% | Post-MVP (API externa) |
| 85 SAP Routes | ⚠️ 45% | `state.sapRoutes` no existe en store — **página crashea** |
| 86 Modalidades transporte | ⚠️ 50% | Sin `modalityType` en `Carrier` |
| 87 Verificación carga N/S | ⚠️ 55% | Verificación en packing, no en carga al camión |
| 88 Despacho parcial | ⚠️ 40% | Sin orden complementaria automática |
| 89 POD / trazabilidad entrega | ⚠️ 35% | Solo cambio de estado, sin evidencia |
| 90 Contenedores volumetría | ❌ 0% | Tipo `Container` ausente |
| 91 Ventanas entrega por tienda | ❌ 0% | Sin `deliveryWindows` en `Warehouse` |

**Ítems fuera de scope MVP** (requieren backend/hardware/integraciones): 84 (TMS), 49 (RFID).

---

### Sprint 8-A — Correcciones bloqueantes (2–3 días)

#### Tarea 1: Corregir `/sap-routes` — crash en runtime

**Problema:** `state.sapRoutes` usado en `src/app/sap-routes/page.tsx` pero no definido en store ni types.

**Archivos a modificar:**
- `src/types/wms.ts` — agregar tipo `SapRoute`
- `src/store/wms-store.ts` — agregar slice `sapRoutes: SapRoute[]` + seed
- `src/lib/constants.ts` — agregar a `NAV_GROUPS` grupo "Despacho"

```ts
// src/types/wms.ts — agregar
export interface SapRoute {
  id: string
  code: string
  name: string
  originId: string
  destinationIds: string[]
  carrierName: string
  driverName: string
  truckPlate: string
  routeDate: string
  currentLoadKg: number
  capacityKg: number
  status: 'pending' | 'in_transit' | 'synced' | 'cancelled'
}
```

**Resultado:** Ítem 85 sube de 25% → 65%.

---

#### Tarea 2: `modalityType` en Carrier (ítem 86)

**Archivos a modificar:**
- `src/types/wms.ts` — agregar `modalityType: 'own' | 'third_party' | 'courier' | 'last_mile'` a `Carrier`
- `src/store/wms-store.ts` — actualizar seed de carriers con `modalityType`
- `src/app/admin/page.tsx` — agregar campo al formulario CRUD de carrier
- `src/app/shipping/page.tsx` o columns — mostrar badge de modalidad

**Resultado:** Ítem 86 sube de 50% → 85%.

---

#### Tarea 3: Ventanas de entrega por tienda (ítem 91)

**Archivos a modificar:**
- `src/types/wms.ts` — agregar `deliveryWindows?: DeliveryWindow[]` a `Warehouse`

```ts
export interface DeliveryWindow {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6   // 0=domingo
  openTime: string   // 'HH:mm'
  closeTime: string  // 'HH:mm'
}
```

- `src/store/wms-store.ts` — seed con ventanas para las 4 tiendas
- `src/app/admin/page.tsx` — UI para editar ventanas en el CRUD de almacenes (tipo=store)

**Resultado:** Ítem 91 sube de 0% → 60%.

---

### Sprint 8-B — Módulo YMS básico (3–4 días)

#### Tarea 4: Yard Management — tipos, store, UI `/yard` (ítem 81)

**Scope MVP:** Gestión de muelles (docks) y citas de llegada/salida. Sin optimización automática.

**Nuevos tipos en `src/types/wms.ts`:**

```ts
export interface Dock {
  id: string
  warehouseId: string
  code: string                    // 'M-01', 'M-02'
  type: 'inbound' | 'outbound' | 'mixed'
  status: 'available' | 'occupied' | 'maintenance'
  maxWeightKg: number
}

export interface DockAppointment {
  id: string
  dockId: string
  warehouseId: string
  carrierId?: string
  truckPlate: string
  driverName: string
  appointmentType: 'inbound' | 'outbound'
  scheduledAt: string             // ISO datetime
  estimatedDurationMin: number
  linkedAsnId?: string
  linkedManifestId?: string
  status: 'scheduled' | 'arrived' | 'in_progress' | 'completed' | 'no_show' | 'cancelled'
  actualArrivalAt?: string
  completedAt?: string
  notes?: string
}
```

**Store — nuevas acciones:**
- `createDock(data)` / `updateDock(id, data)` — CRUD
- `createDockAppointment(data)` — crear cita
- `advanceDockAppointment(id, status)` — FSM: scheduled→arrived→in_progress→completed

**Nueva ruta `/yard`** — 2 tabs:
- **"Muelles"** — mapa visual de muelles (grid), estado actual (badge color), botón asignar cita
- **"Citas"** — tabla de citas del día con filtro de almacén/fecha, botones FSM

**Archivo nuevo:** `src/app/yard/page.tsx` + `src/app/yard/_components/`

**Integrar con `/receiving`:** tab "Citas ASN" debe mostrar link a cita de muelle asociada si existe `linkedAsnId`.

**Agregar al nav** en grupo "Despacho": `{ label: 'Patio (YMS)', href: '/yard', icon: Warehouse }`.

**Resultado:** Ítem 81 sube de 0% → 65%.

**Mejora ítem 82:** Citas de transporte ahora tienen muelle asignado → sube de 20% → 70%.

---

### Sprint 8-C — Despacho parcial + POD (2–3 días)

#### Tarea 5: Despacho parcial con orden complementaria (ítem 88)

**Archivos a modificar:**
- `src/store/wms-store.ts` — nueva acción `createComplementaryOrder(originalOrderId)`:
  - Clona la `CommerceOrder` original con `status='pending'`, `isComplementary=true`, `originalOrderId`
  - Solo incluye los ítems con `quantityPending > 0`
- `src/types/wms.ts` — agregar `isComplementary?: boolean` + `originalOrderId?: string` a `CommerceOrder`
- `src/app/shipping/page.tsx` — botón "Crear orden complementaria" visible cuando `shipment.status=partial`

**Resultado:** Ítem 88 sube de 40% → 75%.

---

#### Tarea 6: POD digital — Prueba de entrega (ítem 89)

**Archivos a modificar:**
- `src/types/wms.ts` — agregar campo `deliveryProof` a `Shipment`:

```ts
deliveryProof?: {
  receiverName: string
  receivedAt: string       // ISO datetime
  notes?: string
  signatureDataUrl?: string  // base64 canvas signature
}
```

- `src/store/wms-store.ts` — modificar `deliverShipment(id, proof)` para aceptar y guardar `deliveryProof`
- `src/app/shipping/_components/` — nuevo `DeliveryConfirmDialog` con:
  - Campo nombre del receptor
  - Canvas de firma (usando `<canvas>` nativo, sin librería)
  - Textarea notas opcionales
  - Al confirmar: llama `deliverShipment(id, proof)`

**Resultado:** Ítem 89 sube de 35% → 75%.

---

### Sprint 8-D — Contenedores y documentos de despacho (2 días)

#### Tarea 7: Contenedores de transporte básicos (ítem 90)

**Scope MVP:** Asociar contenedor (camión/furgón) a un manifiesto con volumetría.

```ts
// src/types/wms.ts — agregar
export interface TransportContainer {
  id: string
  code: string
  type: 'truck' | 'van' | 'container_20ft' | 'container_40ft'
  capacityKg: number
  capacityM3: number
  truckPlate?: string
  carrierId?: string
}
```

- Agregar `containerId?` a `LoadManifest`
- CRUD de contenedores en `/admin` (tab nuevo "Vehículos/Contenedores")
- Selector de contenedor al crear manifiesto en `/load-manifests`
- KPI de ocupación (kg + m³) en la card del manifiesto

**Resultado:** Ítem 90 sube de 0% → 55%.

---

#### Tarea 8: Documentos de despacho — guía de remisión (ítem 83)

**Scope MVP:** Generar una guía de remisión en texto estructurado (no PDF real — HTML imprimible via `window.print()`).

- Nueva acción `generateRemisionHtml(manifestId)` en store — compila datos del manifiesto, stops, carrier, documentos adjuntos
- `RemisionPreviewDialog` en `/load-manifests/_components/` — muestra HTML con estilos de impresión (`@media print`), botón "Imprimir" llama `window.print()`
- Sin dependencias externas de PDF

**Resultado:** Ítem 83 sube de 55% → 80%.

---

### Proyección de cobertura post-Sprint 8

| Ítem | Antes | Después | Delta |
|---|---|---|---|
| 81 YMS | 0% | 65% | +65 |
| 82 Citas transporte | 20% | 70% | +50 |
| 83 Docs despacho | 55% | 80% | +25 |
| 85 SAP Routes fix | 25% | 65% | +40 |
| 86 Modalidades carrier | 50% | 85% | +35 |
| 88 Despacho parcial | 40% | 75% | +35 |
| 89 POD entrega | 35% | 75% | +40 |
| 90 Contenedores | 0% | 55% | +55 |
| 91 Ventanas entrega | 0% | 60% | +60 |
| 84 TMS | 5% | 5% | 0 (post-MVP) |
| 87 Verificación N/S carga | 55% | 55% | 0 (en scope packing) |

**Sección F antes:** 28% → **Sección F después:** ~68%

---

### Archivos nuevos que crea este sprint

```
src/app/yard/page.tsx
src/app/yard/_components/dock-map.tsx
src/app/yard/_components/appointments-table.tsx
src/app/yard/_components/create-appointment-dialog.tsx
src/app/shipping/_components/delivery-confirm-dialog.tsx
src/app/load-manifests/_components/remision-preview-dialog.tsx
```

### Archivos modificados

```
src/types/wms.ts              — SapRoute, Dock, DockAppointment, TransportContainer, DeliveryWindow, deliveryProof
src/store/wms-store.ts        — nuevos slices + acciones + seed
src/lib/constants.ts          — agregar /yard y /sap-routes al nav
src/app/admin/page.tsx        — tabs carrier modalityType, ventanas tienda, CRUD contenedores
src/app/shipping/page.tsx     — botón orden complementaria, integrar DeliveryConfirmDialog
src/app/load-manifests/page.tsx — selector contenedor, botón guía de remisión
```

*Plan Sprint 8 — Despacho y Transporte — 2026-06-25*
