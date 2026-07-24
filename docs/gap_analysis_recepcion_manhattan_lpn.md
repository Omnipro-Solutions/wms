# Gap Analysis — Recepción estilo Manhattan + LPN

**Análisis:** 2026-07-24 · **Implementación:** 2026-07-24
**Alcance:** flujo inbound (7 pasos Manhattan) + concepto LPN (License Plate Number)
**Base del análisis:** commit `d30737a`
**Verificación:** `npx tsc --noEmit` limpio · `npm run build` compila · 45 tests nuevos pasan

> Este documento registra el análisis de brechas **y su cierre**. Cada sección
> conserva el gap original y documenta cómo quedó resuelto.

---

## 1. Resumen ejecutivo

| # | Paso Manhattan | Antes | Ahora | Dónde |
|---|----------------|-------|-------|-------|
| 1 | ASN / PO anticipada | ⚠️ mono-producto | ✅ | `lib/rules/asn.ts`, `Asn.lines[]` |
| 2 | Gestión de patio y muelle | ⚠️ asignación manual | ✅ | `suggestDock()` en `lib/rules/yard.ts` |
| 3 | Descarga y verificación | ⚠️ sin unidad de carga ni conteo ciego | ✅ | `receiveAsnLine()`, `receivingBlindEnabled` |
| 4 | Inspección y QC | ⚠️ flag manual | ✅ | `lib/rules/qc.ts`, `/qc-settings` |
| 5 | Cross-docking inteligente | ⚠️ reactivo | ✅ | `findCrossDockOpportunities()`, `<CrossDockAlert>` |
| 6 | Putaway optimizado | ✅ ya estaba | ✅ | `lib/rules/putaway.ts` (sin cambios) |
| 7 | Visibilidad global | ❌ decorativo | ✅ | `lib/rules/stock-sync.ts`, `publishStockSync()` |
| — | **LPN / unidad de carga** | ❌ ausente total | ✅ base | `lib/rules/lpn.ts`, `/lpn`, paso RF |
| — | LPN anidado | ❌ | ⏸️ fuera de alcance | ver §9 |

**Veredicto original:** el flujo lógico de recepción ya era sólido (las reglas de putaway estaban por encima del promedio). Los dos huecos estructurales eran **LPN** y **publicación de inventario a ERP/OMS**.

**Estado:** ambos cerrados, junto con los cinco gaps parciales. Solo el anidamiento de LPN queda pendiente, por decisión explícita de alcance.

---

## 2. Gap por paso — análisis y resolución

### Paso 1 — ASN / PO

**Gap:** `Asn` tenía **un solo `productId`**. Un camión con 40 SKUs generaba 40 ASNs.

**Resuelto — estrategia aditiva.** Se agregó `Asn.lines: AsnLine[]` como fuente de verdad, manteniendo `productId` / `expectedQuantity` / `receivedQuantity` / `damagedQuantity` como **campos espejo**.

Motivo de no migrar: 29 archivos leen esos campos. Eliminarlos habría sido un diff enorme con riesgo alto de romper vistas sin detectarlo.

```ts
// lib/rules/asn.ts
syncAsnAggregates(asn)   // recalcula los espejo desde lines[]
ensureAsnLines(asn)      // hidrata lines[] desde los espejo (ASN legacy/seed)
linesOf(asn)             // acceso seguro, hidrata si viene vacío
applyLineReceipt(...)    // recepción sobre una línea concreta
isAsnFullyReceived(...)  // completo solo si TODAS las líneas están saldadas
```

`lines?` es **opcional** en el tipo para no romper seed ni tests previos. En runtime siempre está poblado: el store aplica `ensureAsnLines` al cargar ([wms-store.ts:717](../src/store/wms-store.ts#L717)).

`createReceptionFromPO` ahora crea **un ASN con N líneas** en vez de N ASNs de una línea. Nueva acción `receiveAsnLine(asnId, productId, ...)` recibe contra una línea concreta y delega el movimiento de stock en `receiveAsn` (reutiliza UoM, seriales, QC y staging sin duplicar lógica).

**Detalle:** las unidades dañadas saldan la línea — `lineOutstanding()` resta recibidas *y* dañadas, así una línea con faltante por avería no queda pendiente para siempre.

---

### Paso 2 — Patio y muelle

**Gap:** la asignación era **manual**. Manhattan asigna por tipo de mercancía, urgencia y zona destino.

**Resuelto.** `scoreDock()` y `suggestDock()` en [lib/rules/yard.ts](../src/lib/rules/yard.ts), reutilizando `isDockCompatible` y `hasDockConflict` que ya existían.

Fórmula del score (0–100):

| Factor | Peso |
|---|---|
| Compatible y operativo | +40 (base) |
| Sin conflicto de agenda | +25 |
| Con cita solapada | −35 |
| Muelle dedicado (no mixto) | +15 |
| Cross-dock cerca del despacho | +20 (o +10 sin datos de distancia) |
| Tipo incompatible / bloqueado / mantenimiento | → 0, con motivo |

**UI:** panel azul en el diálogo de asignación con el muelle sugerido, su score y los motivos concatenados. Botón **Usar sugerencia** precarga el select — la decisión final sigue siendo del operario, igual que con `suggestPutawayLocation`.

**Store:** `autoAssignDock(appointmentId)` para asignación directa sin diálogo.

---

### Paso 3 — Descarga y verificación

**Gaps:**
1. ASN mono-producto → resuelto en el paso 1
2. Sin recepción por unidad de carga → resuelto con LPN (§3)
3. Sin recepción ciega — el operario veía el esperado, sesgando el conteo

**Recepción ciega resuelta.** `settings.receivingBlindEnabled` (default `false`), con switch en `/putaway-settings`.

Con el modo activo, en el flujo RF:
- Donde iba la cantidad esperada dice **"Conteo ciego"**
- El contador **arranca en 0** en vez de prellenado con lo esperado

Ese segundo punto importa: prellenar el contador con `expectedQuantity` reintroduce exactamente el sesgo que el modo busca evitar.

La validación contra lo esperado **no cambia** — `receiveAsn` sigue derivando `partial` vs `completed` igual. El modo ciego es solo de presentación.

---

### Paso 4 — QC

**Gap:** la bandera `requiresQualityControl` se marcaba **a mano por ASN**. Sin reglas de desvío automático.

**Resuelto.** Tipo `QcRule` + [lib/rules/qc.ts](../src/lib/rules/qc.ts) + página `/qc-settings`, clonando el patrón de `PutawayRule`.

```ts
QcRule {
  matchType: 'category' | 'supplier' | 'product' | 'abc_class' | 'all'
  matchValue: string
  samplingPercent: number   // 0–100
  priority: number          // menor gana
  reason: string
  active: boolean
}
```

`evaluateQcRules()` corre al crear la recepción y setea `requiresQualityControl` automáticamente. El ASN guarda `qcRuleId` (qué regla lo desvió) y `qcSampledQuantity` (cuántas unidades).

**Reglas del seed:**

| Prioridad | Regla | Muestreo |
|---|---|---|
| 5 | Proveedor Importadora Andina — inspección total | 100% |
| 10 | Electrónica — muestreo 20% | 20% |
| 30 | Clase A — muestreo 10% | 10% |

**Detalles de la implementación:**
- El muestreo **redondea hacia arriba**: 20% sobre 15 unidades desvía 3, no 2.
- Nunca supera la cantidad esperada.
- El proveedor se compara sin distinguir mayúsculas ni espacios — los nombres llegan con formato variable.
- El flag manual sigue mandando: las reglas solo pueden **activar** el desvío, nunca desactivarlo.
- En un ASN multi-línea, si **cualquier** línea dispara una regla, todo el ASN se desvía.

---

### Paso 5 — Cross-docking

**Gaps:**
1. No era proactivo — el operario tenía que abrir el diálogo a buscar la oportunidad
2. Sin concepto de backorder — `matchCrossDockOrders` miraba pedidos pendientes, no pedidos bloqueados por falta de stock

**Resuelto.** [crossdock.ts](../src/lib/rules/crossdock.ts) ampliado:

```ts
isBackordered(order, productId, warehouseId, inventory)
  // stock disponible < unidades pendientes del pedido

findCrossDockOpportunities(asns, orders, inventory, warehouseId)
  // recorre lines[] de cada ASN; backorders primero
```

El cálculo usa `availableStock()` — el stock **reservado no cuenta** como disponible, que es lo correcto: mercancía comprometida con otro pedido no cubre este.

**UI:** `<CrossDockAlert>` arriba de las pestañas en `/receiving`:

> ⚡ N oportunidades de cross-docking · M en backorder

Cada fila: ASN → producto → unidades pendientes → badge rojo **Backorder** si no hay stock que lo cubra. Botón **Enviar a despacho** abre el diálogo directamente.

Selector `selectCrossDockOpportunities(state)` respeta `settings.crossDockAlertsEnabled`.

---

### Paso 6 — Putaway optimizado

**Sin gap.** Ya era la parte más fuerte del sistema: `validatePutawayDestination` verifica ubicación bloqueada, peso, volumen, compatibilidad de rack, hazmat, cadena de frío, mezcla de lotes, reglas configurables y tier ABC/XYZ.

**No se modificó.** El LPN lo **reutiliza**: `moveLpn` valida cada SKU del pallet con el mismo motor (ver §3).

Único faltante fino, sin resolver: no hay ruta óptima multi-parada cuando el operario lleva varios LPN. Baja prioridad.

---

### Paso 7 — Visibilidad global

**Gap:** `IntegrationConnection` existía con `status`, `lastSyncAt`, `processedMessages` — pero era **decorativo**. Grep de `syncInventory` / `publishStock` / `notifyErp` → cero resultados. `/integrations` mostraba salud que nadie actualizaba.

**Resuelto.** [lib/rules/stock-sync.ts](../src/lib/rules/stock-sync.ts) + acción `publishStockSync(itemIds, trigger)`.

```ts
buildStockSyncPayload(item, product)  // { sku, warehouse, location, qtyAvailable, lot, serial, ts }
syncTargets(connections, configuredIds)  // activas de tipo erp/oms/sap
syncHealthByConnection(log)           // salud por conexión
```

Se llama desde `putawayItem` (trigger `putaway`) y `approveQc` (trigger `qc_approved`). Cada publicación:
- Registra una entrada en `stockSyncLog[]`
- **Mueve `lastSyncAt` y `processedMessages`** de la conexión destino

**UI:** panel **Publicación de inventario** en `/integrations` con la tabla del log (fecha, destino, evento, SKU, ubicación, disponible, estado) y switch para desactivar.

> **Nota de diseño (`ponytail:` en el código):** registro en memoria, sin reintentos ni cola persistente. Al conectar un backend real, el único cambio es hacer el POST con `buildStockSyncPayload()`. Si se necesita entrega garantizada, ese es el punto de extensión.

---

## 3. LPN — de gap total a implementado

**Antes:** cero implementación. El sistema rastreaba cantidades sueltas por producto+ubicación; un pallet no existía como entidad.

| Sin LPN | Con LPN |
|---------|---------|
| Putaway mueve "50 unidades de SKU X" | Putaway mueve "LPN-000123" con un escaneo |
| Reabastecimiento calcula cantidades | Reabastecimiento baja un LPN completo |
| Picking de pallet = pick de N unidades | Escanear el LPN y listo |
| Trazabilidad = producto + lote | Trazabilidad = quién armó el pallet, dónde estuvo |

### Decisión de diseño: capa, no reemplazo

`InventoryItem.lpnId?` es **opcional**. El stock suelto sigue siendo válido y `availableStock()` no cambió. Un LPN agrupa; no sustituye al `InventoryItem`. Por eso nada del código existente se rompió.

### Tipos

```ts
type LpnType = 'pallet' | 'case' | 'tote' | 'container'
type LpnStatus = 'open' | 'closed' | 'in_transit' | 'stored' | 'consumed'

interface Lpn {
  id, code, type, status, warehouseId
  locationId?      // undefined mientras está en tránsito
  sourceType: 'inbound' | 'outbound' | 'internal'
  asnId?           // ASN de origen si nació en el muelle
  createdAt, closedAt?, operatorName?
}

interface LpnLine { id, lpnId, productId, quantity, lot?, serial?, expirationDate? }
```

FSM: `open → closed → stored → consumed`, con `in_transit` entre ubicaciones. `open` admite contenido; desde `closed` queda sellado.

### Acciones de store

```ts
createLpn(type, warehouseId, sourceType, operatorName, asnId?)
addToLpn(lpnId, productId, quantity, lot?, serial?)
closeLpn(lpnId)
moveLpn(lpnId, toLocationId, operatorName)
consumeLpn(lpnId, operatorName)
generateLpnLabel(lpnId, operatorName)
```

**Dos puntos no obvios de la implementación:**

1. **`addToLpn` vincula el `InventoryItem` de staging al LPN.** Sin ese vínculo el LPN sería una etiqueta suelta: `moveLpn` no encontraría qué mover y `/inventory` no mostraría la pertenencia.

2. **`moveLpn` valida cada SKU contra la ubicación destino** usando el mismo `validatePutawayDestination` del putaway individual. Un pallet mixto solo entra donde **todos** sus productos son compatibles; el error nombra el SKU que falló.

`consumeLpn` desvincula el stock pero **no lo borra** — la mercancía sigue existiendo como suelta.

### UI

- **`/lpn`** — KPIs (activos, abiertos, almacenados, unidades contenidas), tabla con badge **Mixto** para pallets multi-SKU, detalle de contenido al hacer clic, impresión de etiqueta
- **Flujo RF** — paso **Armar unidad de carga** entre recepción/QC y putaway: tres botones (Pallet 📦 / Caja 📥 / Cubeta 🧺) que crean, cargan, cierran e imprimen en un toque. Botón **Omitir** para ubicar como stock suelto
- **Putaway RF** — recuadro índigo con el código LPN: *"Escanea el LPN, no cada producto"*
- **`/inventory`** — columna **LPN**
- **`/labels`** — tipo `lpn` con badge índigo, reutilizando el generador ZPL existente

---

## 4. Archivos

**Nuevos — lógica pura (`src/lib/rules/`)**
`asn.ts` · `lpn.ts` · `qc.ts` · `stock-sync.ts`

**Modificados — lógica pura**
`crossdock.ts` (backorder + oportunidades) · `yard.ts` (scoring de muelle) · `zpl.ts` (tipo `lpn`)

**Store**
`wms-store.ts` — 4 slices (`qcRules`, `lpns`, `lpnLines`, `stockSyncLog`) + 13 acciones
`selectors.ts` — `selectCrossDockOpportunities`, `selectSyncHealth`

**UI**
`/qc-settings` (+ diálogo) · `/lpn` · `receiving/_components/cross-dock-alert.tsx` · `integrations/_components/stock-sync-panel.tsx` · `yard/_components/assign-dock-dialog.tsx` · `(worker)/worker/receiving/[asnId]` · `/inventory` (columna) · `/putaway-settings` (switches) · `constants.ts` (navegación)

**Tests**
`lib/rules/__tests__/inbound-flow.test.ts` — 34 tests de lógica pura
`store/__tests__/wms-store-lpn-sync.test.ts` — 11 tests de integración

---

## 5. Configuración nueva (`WmsSettings`)

```ts
receivingBlindEnabled: false   // oculta el esperado al contar
qcRulesEnabled: true           // motor de desvío automático a QC
stockSyncEnabled: true         // publicación hacia ERP/OMS
stockSyncConnectionIds: []     // vacío = todas las conexiones erp/oms/sap activas
crossDockAlertsEnabled: true   // alerta proactiva
lpnEnabled: true               // paso de paletizado en el flujo RF
lpnCodePrefix: 'LPN'
```

Switches en UI: recepción ciega y LPN en `/putaway-settings`; motor de QC en `/qc-settings`; publicación en `/integrations`.

---

## 6. Paso a paso para ver el flujo en vivo

```bash
npm run dev
```
http://localhost:3000 → login en `/auth/login`.

> **Importante:** el store persiste en IndexedDB. Si ya usaste la app antes de estos cambios, entra a **Administración → Reiniciar demo** para cargar el seed nuevo (con las reglas de QC). Sin eso no verás los datos nuevos.

### A) ASN multi-línea

1. **Recepción** (`/receiving`) → pestaña **Órdenes**
2. PO `confirmed` → **Crear recepción**
3. **Selecciona varias líneas** (varios SKU) con cantidad > 0
4. Confirma → se crea **un solo ASN** con todas esas líneas
   - Antes: una línea = un ASN. Ahora: un camión = un ASN.

### B) Patio — sugerencia de muelle

1. **Patio y muelles** (`/yard`) → pestaña **Citas**
2. Cita `scheduled` → **Asignar muelle**
3. Panel azul: **"Sugerido: M-0X"** con score y motivos
   *compatible y operativo · sin conflicto de agenda · muelle dedicado*
4. **Usar sugerencia** precarga el select
5. Para ver el descarte: dos citas solapadas sobre el mismo muelle → el score baja y aparece *"ya tiene una cita solapada"*

### C) Recepción ciega

1. **Config. Putaway** (`/putaway-settings`) → tarjeta **Recepción ciega** → activa el switch
2. `/worker/receiving/[asnId]` → paso **Recibir**
3. Donde iba el esperado dice **"Conteo ciego"**; el contador arranca en **0**

### D) QC automático

1. **Config. Control de calidad** (`/qc-settings`) — 3 reglas del seed
2. Crea una recepción desde una PO de **Electrónica** → el ASN sale marcado para QC **sin tocar la casilla**
3. Prueba la prioridad: PO de Electrónica **de Importadora Andina** → gana la regla de proveedor (prioridad 5), no la de categoría
4. Desactiva el switch **Motor de reglas** → las recepciones nuevas dejan de evaluarse

### E) Cross-dock proactivo

1. `/receiving` → alerta ámbar arriba de las pestañas si hay oportunidades
2. Cada fila: ASN → producto → unidades pendientes → badge **Backorder**
3. **Enviar a despacho** abre el diálogo directamente
4. La diferencia con antes: **el sistema avisa**, no hay que ir a buscar

### F) LPN — armar la unidad de carga

1. `/worker/receiving` → entra a un ASN
2. **Resumen** → **Escanear producto** → **Recibir**
3. **NUEVO: Armar unidad de carga** → Pallet 📦 / Caja 📥 / Cubeta 🧺
   - Crea el LPN, carga el contenido, lo cierra e imprime la etiqueta en un toque
   - **Omitir** para ubicar como stock suelto
4. **Ubicar mercancía** muestra el recuadro índigo con el código LPN
5. Confirma → `moveLpn` mueve la unidad completa

**Ver el resultado:** `/lpn` (KPIs, tabla, detalle de contenido, badge Mixto) · `/inventory` (columna LPN) · `/labels` (etiqueta índigo)

**Probar los guardas:**
- LPN vacío no se cierra → *"el LPN está vacío"*
- LPN abierto no se mueve → *"el LPN debe cerrarse antes de moverse"*
- LPN cerrado no admite contenido → *"El LPN está cerrado"*
- Pallet a ubicación incompatible → *"MW-001: No admite la categoría «Línea Cocina»"*

### G) Visibilidad global

1. Completa un putaway
2. **Integraciones** (`/integrations`) → panel **Publicación de inventario**

   | Fecha | Destino | Evento | SKU | Ubicación | Disponible | Estado |
   |---|---|---|---|---|---|---|
   | … | SAP ERP | Putaway | MW-001 | A-01-01 | 45 | Enviado |

3. La tarjeta de SAP muestra **`lastSyncAt` actualizado** y `processedMessages` incrementado
   - Antes esos números nunca se movían
4. Aprueba un QC → fila con evento **QC aprobado**
5. Apaga el switch → las publicaciones se detienen

---

## 7. Verificación

```bash
npx tsc --noEmit    # limpio
npm run build       # compila; /lpn y /qc-settings en el manifiesto
npm run test        # 127 pasan
```

**45 tests nuevos, todos pasan.** Cubren: agregados y saldo de líneas de ASN, ciclo de vida del LPN con sus guardas, muestreo y prioridad de reglas QC, detección de backorder, scoring de muelles, y publicación ERP/OMS end-to-end.

**8 tests fallaban antes de este trabajo y siguen fallando — no son regresiones:**
- 6 en `state-machines.test.ts` y `wms-store-receipt-labels.test.ts`: prueban estados `labels_pending` / `putaway_ready` que el commit `d88e68c` eliminó del FSM sin borrar los tests. **Tests obsoletos.**
- 2 en `auth-store.test.ts`: `crypto.subtle` no disponible en el entorno de test.

Conviene limpiarlos en un commit aparte para dejar la suite en verde.

**Lint:** 315 errores, contra 338 en la base. Bajaron 23 al convertir las reglas nuevas a arrow functions (`func-style`, convención del proyecto).

---

## 8. Cambios frente a lo propuesto en el análisis

| Propuesto | Implementado | Por qué |
|---|---|---|
| `src/lib/rules/integrations.ts` | `src/lib/rules/stock-sync.ts` | Nombre más preciso: publica stock, no gestiona integraciones |
| `publishStockSync(movements)` | `publishStockSync(itemIds, trigger)` | El payload necesita el estado del `InventoryItem`, no del movimiento |
| Migrar `Asn` a solo `lines[]` | `lines[]` + campos espejo | 29 archivos dependían de los campos; migrarlos era diff enorme y riesgo alto |
| `LpnStatus` con `'shipped'` | Sin `'shipped'` | `consumed` cubre la salida; agregar el estado sin flujo outbound sería especulativo |
| Llamar sync desde `completePick` | Solo `putawayItem` + `approveQc` | El alcance era el flujo inbound; picking se agrega cuando se trabaje outbound |

---

## 9. Fuera de alcance

**LPN anidado** (`parentLpnId`, `nestLpn`/`unnestLpn`, vista de árbol) — decisión explícita al elegir alcance "Base" sobre "Base + anidado".

Los tipos ya están preparados: agregar `parentLpnId?: string` a `Lpn` y dos acciones cubre el caso. Los casos borde a resolver son mover un padre con hijos dispersos en otra ubicación, y el unnest parcial.

**Ruta óptima multi-parada** en putaway cuando el operario lleva varios LPN. Baja prioridad.

**Sync con entrega garantizada** — hoy el log es en memoria, sin reintentos ni cola. Punto de extensión marcado con `ponytail:` en `stock-sync.ts`.
