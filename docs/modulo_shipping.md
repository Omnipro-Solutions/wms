# Despacho y transporte (Outbound / Shipping) — Módulo #7

**Fecha:** 2026-07-23

Módulo de salida de la mercancía del almacén hacia el cliente o la tienda. Consolida los bultos de cada envío, elige la transportadora óptima (costo/servicio), genera guías y manifiestos, verifica la carga antes de que el camión salga y confirma la entrega midiendo el cumplimiento de la promesa (**OTIF**). Es donde el almacén cumple —o incumple— lo prometido al cliente.

Cubre el nivel 🟢 **Base** y 🔵 **Estándar** del benchmark de `funcionalidades_base_wms.md`:

| Nivel | Funcionalidad | Estado |
|---|---|---|
| 🟢 Base | Consolidación de bultos por orden/envío | ✅ |
| 🟢 Base | Generación de guía y manifiesto de carga | ✅ |
| 🟢 Base | Confirmación de despacho | ✅ |
| 🔵 Estándar | **Rate shopping** entre transportadoras (costo por peso/zona/servicio) | ✅ (configurable) |
| 🔵 Estándar | Verificación de carga antes del despacho | ✅ **(nuevo)** |
| 🔵 Estándar | Despacho parcial con saldo pendiente | ✅ **(nuevo)** |
| 🔵 Estándar | Rutas de reparto y consolidación por destino | ✅ **(nuevo)** |
| 🔵 Estándar | Modalidades: flota propia, tercero, courier, last-mile | ✅ (gobernadas por config) |
| 🔵 Estándar | Tracking OTIF (On-Time In-Full) | ✅ (umbral configurable) |
| 🔵 Estándar | **Gobierno del módulo** (freeze, políticas, tarifario) | ✅ **(nuevo)** |

---

## Conceptos clave

| Término | Definición |
|---|---|
| **Shipment** | Unidad de trabajo del módulo — un envío de una orden de cliente, con bultos, peso, destino, transportadora y estado propio. |
| **Rate shopping** | Comparar todas las tarifas disponibles para un peso y zona, y elegir la mejor según la política (menor costo o menor tiempo). |
| **Cotización (CarrierRateQuote)** | Resultado del rate shopping: transportadora, nivel de servicio, costo, días de tránsito y fecha estimada de entrega. |
| **Zona (CarrierZone)** | Agrupación de ciudades con la que la transportadora tarifica. Una ciudad se resuelve a zona con `resolveCarrierZone`. |
| **Modalidad** | Medio de transporte: flota propia, tercero, courier o última milla. Una modalidad desactivada desaparece del rate shopping y bloquea el despacho por ese medio. |
| **Verificación de carga** | Confirmar físicamente los bultos cargados (`verifiedPackages`) contra los esperados (`packageCount`) antes de despachar. |
| **Despacho parcial** | Salir con menos bultos de los esperados, dejando registrado el saldo (`pendingPackages`, `partialDispatch`). |
| **Consolidación por destino** | Agrupar envíos pendientes que comparten ciudad para que viajen en una sola ruta en vez de un camión por orden. |
| **OTIF** | On-Time In-Full — % de envíos entregados a tiempo y completos. Se deriva comparando fecha prometida vs. fecha estimada. |
| **Manifiesto (LoadManifest)** | Documento de ruta del camión: paradas, órdenes, traslados y devoluciones, con integración SAP. |
| **Modo congelado** | Interruptor de gobierno que bloquea todas las operaciones de despacho (inventarios, cierres de turno o incidentes). |

---

## Estados del envío (FSM)

```
pending ──► in_transit ──► completed
   │            │
   │            └──► (parcial: partialDispatch = true, pendingPackages > 0)
   └──► cancelled
```

| Estado | Significado |
|---|---|
| `pending` | En cola — cotizando tarifa y/o esperando verificación de carga |
| `in_transit` | Despachado, con número de tracking generado |
| `completed` | Entregado al cliente |
| `cancelled` | Envío anulado |

**Estado OTIF** (transversal, no es parte de la FSM): `on_time` · `at_risk` · `late`.

---

## Arquitectura (por capas)

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Tipos | `src/types/wms.ts` | `Shipment`, `Carrier`, `CarrierModality`, `CarrierService`, `CarrierRateQuote`, `LoadManifest`, y campos de shipping en `WmsSettings` |
| Reglas puras | `src/lib/rules/shipping.ts` | `rateShop`, `recommendedQuote`, `loadVerificationStatus`, `consolidationGroups`, `deriveOtifStatus`, `otifPercentage`, `otifByCarrier`, `costByCarrier`, `otifAlerts` |
| Estado + acciones | `src/store/wms-store.ts` | Acciones de flujo con guardia de *freeze* y validación de políticas |
| Config UI | `src/app/(app)/shipping-settings/` | Página de configuración (Sistema → Configuración → Despacho) |
| Operación UI | `src/app/(app)/shipping/` · `src/app/(app)/load-manifests/` | Tablero de envíos, consolidación, OTIF y manifiestos |

**Persistencia:** todo el store se serializa a **IndexedDB** (`idbStorage`) — la configuración, los envíos y las verificaciones sobreviven a recargas, listo para demo sin backend.

---

## Reglas puras (`src/lib/rules/shipping.ts`)

| Función | Qué hace |
|---|---|
| `rateShop(carriers, pesoKg, zona, fecha, opciones?)` | Cotiza todas las tarifas válidas. Descarta transportadoras inactivas, modalidades deshabilitadas, servicios que no cubren la zona y los que exceden el peso máximo. Ordena por costo (`cheapest`) o por días de tránsito (`fastest`). |
| `recommendedQuote(cotizaciones, topeSobrecosto)` | Recomienda una cotización. Si la preferida por la estrategia cuesta más que la más barata por encima del tope, cae a la más barata. |
| `loadVerificationStatus(verificados, esperados)` | `pending` · `partial` · `verified` · `over` |
| `consolidationGroups(envíos)` | Agrupa envíos **pendientes** por ciudad de destino (case-insensitive), sumando bultos y peso. Solo devuelve grupos de 2+. |
| `deriveOtifStatus(prometida, estimada, holguraDías?)` | `on_time` si no hay retraso, `at_risk` dentro de la holgura, `late` por encima. |
| `otifPercentage` · `otifBreakdown` · `otifByCarrier` | Agregados de cumplimiento — global, por estado y por transportadora. |
| `costByCarrier` | Costo total y número de envíos por transportadora. |
| `otifAlerts(envíos, mapaÓrdenes, hoy)` | Envíos en riesgo o tarde aún no entregados, ordenados por urgencia. |
| `calculateQuotedCost(base, porKg, peso)` | `base + porKg × peso`, redondeado a centavos. |
| `resolveCarrierZone(transportadora, ciudad)` | Resuelve la zona tarifaria de una ciudad. |
| `MODALITY_LABELS` · `SERVICE_LEVEL_LABELS` | Etiquetas en español para modalidades y niveles de servicio. |

---

## Acciones del store

| Acción | Efecto | Guardia freeze |
|---|---|---|
| `createShipment(datos, cotización)` | Crea el envío en `pending` con la tarifa aplicada | — |
| `applyRateQuote(envíoId, cotización)` | Aplica transportadora, servicio, costo y ETA; **recalcula OTIF** contra la fecha prometida. Solo en `pending`. | ✅ |
| `verifyShipmentLoad(envíoId, bultos, operario)` | Registra bultos verificados + operario + fecha. Rechaza negativos y cantidades mayores a las esperadas. Solo en `pending`. | ✅ |
| `shipOrder(envíoId, operario, flotaPropia?)` | `pending → in_transit`, genera tracking. Valida modalidad habilitada, verificación de carga y política de parcial. | ✅ + políticas |
| `deliverShipment(envíoId)` | `in_transit → completed` | ✅ |
| `createManifest(datos)` | Crea el manifiesto de carga | ✅ |
| `addDocumentToManifest(...)` | Añade orden/traslado/devolución a una parada | — |
| `closeManifest(id)` / `dispatchManifest(id)` | Cierra / despacha el manifiesto | ✅ (dispatch) |

### Validaciones de `shipOrder` (en orden)

1. **Freeze** — módulo congelado → bloquea.
2. **Estado** — solo despacha desde `pending`.
3. **Modalidad** — si la transportadora declara una modalidad que la configuración desactivó → bloquea.
4. **Verificación de carga** — si se exige y no hay bultos verificados → bloquea.
5. **Despacho parcial** — si faltan bultos y el parcial está deshabilitado → bloquea; si está habilitado → marca `partialDispatch` y `pendingPackages`.

---

## Configuración — Sistema → Configuración → Despacho (`/shipping-settings`)

Página de gobierno, espejo de las otras `*-settings`.

### KPIs en vivo
- **OTIF** — % de cumplimiento contra la meta configurada (verde si la alcanza, rojo si no).
- **Modo congelado** — interruptor que bloquea las operaciones de despacho.
- **Por despachar** — pendientes, cuántos sin verificar y cuántos en tránsito.

### Parámetros del módulo

| Parámetro (`WmsSettings`) | Default | Qué controla |
|---|---|---|
| `shippingFreezeActive` | `false` | Congela despachar, entregar, verificar carga, recotizar y crear/despachar manifiestos |
| `shippingAutoRateShop` | `true` | Preselecciona la cotización recomendada al abrir el comparador |
| `shippingRateStrategy` | `'cheapest'` | Criterio de recomendación: menor costo o menor tiempo |
| `shippingMaxCostOverBestPct` | `0.15` | Sobrecosto máximo tolerado sobre la tarifa más barata (15%) |
| `shippingRequireLoadVerification` | `true` | Exige confirmar bultos cargados antes de despachar |
| `shippingAllowPartialDispatch` | `false` | Permite despachar con saldo pendiente |
| `shippingEnabledModalities` | las 4 | Modalidades habilitadas para cotizar y despachar |
| `shippingOtifAtRiskDays` | `1` | Días de holgura antes de marcar un envío como tarde |
| `shippingOtifTargetPct` | `95` | Meta de cumplimiento OTIF — referencia de los KPIs |
| `shippingConsolidateByDestination` | `true` | Sugiere agrupar envíos pendientes del mismo destino |

### Catálogos y vistas
- **Modalidades de transporte** — activar/desactivar cada modalidad, con el conteo de transportadoras registradas en cada una.
- **Tarifario por transportadora** — vista de servicios, costo base, costo por kg, días de tránsito y zonas. Alimenta el rate shopping (se edita en Administración → Transportadoras).
- **Oportunidades de consolidación** — destinos con más de un envío pendiente, con bultos, peso y transportadoras involucradas.

> Las políticas se aplican en el store, no en la UI: `shipOrder` valida modalidad, verificación y parcial; `rateShop` filtra por modalidad y ordena por estrategia; `applyRateQuote` recalcula OTIF con `shippingOtifAtRiskDays`.

---

## Operación — `/shipping`

Tres pestañas:

1. **Envíos** — tabla con filtros por transportadora, modalidad, OTIF y estado. Columna **Carga** que muestra `verificados/esperados`, "Sin verificar" o la insignia **Parcial · N pend.** Acciones por fila: *Cotizar* / *Recotizar*, *Verificar carga* y *Despachar* (deshabilitado mientras falte la verificación), y *Entregado* en tránsito.
2. **Consolidación** — tarjetas por ciudad de destino con envíos, bultos, peso y transportadoras. Muestra un aviso si la consolidación está desactivada en la configuración.
3. **OTIF** — tablero de cumplimiento con alertas de envíos en riesgo y tarde, desempeño por transportadora.

Cuando el módulo está congelado, aparece una banda azul en la parte superior de la página.

---

## Cómo hacer una demostración (paso a paso)

> Todos los datos se guardan en IndexedDB del navegador — puedes recargar sin perder el estado. Para reiniciar la demo: borra el storage del sitio en DevTools → Application → IndexedDB.

### Demo A — Gobierno y modo congelado (rol supervisor)

1. Inicia sesión como **supervisor**. En el menú lateral abre **Sistema → Configuración → Despacho** (`/shipping-settings`).
2. Observa la fila de **KPIs**: OTIF contra la meta, por despachar, sin verificar, en tránsito.
3. **Congela el módulo:** activa el interruptor *Modo congelado*. Aparece la banda azul de aviso.
4. Ve a **Shipping** (`/shipping`) — verás la banda de bloqueo. Intenta **despachar** o **entregar** un envío → *"Despacho en modo congelado. No se permiten operaciones."*
5. Vuelve a `/shipping-settings` y **desactiva** el modo congelado.

### Demo B — Rate shopping y estrategia de tarifa

1. En `/shipping-settings → Rate shopping`, confirma que **Preseleccionar mejor tarifa** está activo y que el criterio es **Menor costo**. Guarda si cambiaste algo (verás "Cambios sin guardar" hasta guardar).
2. Ve a `/shipping` y pulsa **Cotizar** en un envío pendiente. El comparador abre con la opción **más económica** ya seleccionada.
3. Vuelve a la configuración y cambia el criterio a **Menor tiempo**; baja el **sobrecosto máximo** a 0%.
4. Cotiza de nuevo el mismo envío: como el servicio rápido excede el tope de sobrecosto, la recomendación **vuelve a la más económica** — la política manda sobre la preferencia.
5. Sube el sobrecosto máximo a 30–50% y cotiza otra vez: ahora sí gana el servicio rápido. Contraste directo de la política.

### Demo C — Modalidades de transporte

1. En `/shipping-settings → Modalidades de transporte`, **desactiva** *Courier* y guarda.
2. Cotiza un envío en `/shipping`: las tarifas de las transportadoras courier **desaparecen** de la lista.
3. Intenta despachar un envío cuya transportadora es courier → el sistema lo bloquea indicando que la modalidad está deshabilitada.
4. Reactiva *Courier* y guarda: vuelve a aparecer y el despacho se desbloquea.

### Demo D — Verificación de carga y despacho parcial

1. En `/shipping-settings → Verificación de carga`, confirma que **Exigir verificación de carga** está activo y que **Permitir despacho parcial** está **inactivo**. Guarda.
2. En `/shipping`, mira la columna **Carga**: el envío dice *Sin verificar* y el botón **Despachar** está deshabilitado.
3. Pulsa el botón de **verificar carga** (ícono de portapapeles). Deja **menos** bultos de los esperados (ej. 2 de 3): el diálogo avisa que faltan bultos y que el despacho quedará bloqueado. Confirma.
4. La columna Carga muestra ahora `2/3` en ámbar. Intenta **Despachar** → *"Carga incompleta: faltan 1 bulto(s) y la configuración no permite despacho parcial."*
5. Vuelve a la configuración, **activa** *Permitir despacho parcial* y guarda. Despacha de nuevo → el envío sale como **Parcial · 1 pend.** y queda `in_transit`.
6. Con otro envío, verifica la **carga completa** y despacha: sale sin marca de parcial y con número de tracking.

### Demo E — Consolidación por destino

1. En `/shipping-settings → Verificación de carga`, confirma que **Consolidar por destino** está activo.
2. Baja a **Oportunidades de consolidación**: verás los destinos con más de un envío pendiente, con bultos y peso sumados.
3. Ve a `/shipping → pestaña Consolidación`: las mismas agrupaciones en tarjetas, listas para armar una sola ruta.
4. Desactiva *Consolidar por destino* y guarda: la pestaña muestra el aviso de función desactivada. Reactívala.

### Demo F — OTIF (On-Time In-Full)

1. En `/shipping-settings → OTIF`, sube la **Meta OTIF** por encima del valor actual: la tarjeta de KPI pasa a **rojo** (no se alcanza la meta). Bájala y vuelve a **verde**.
2. Pon la **Holgura para 'en riesgo'** en 0 días y guarda.
3. Recotiza un envío con una tarifa cuya fecha estimada supere la prometida: el estado OTIF se recalcula al aplicar la tarifa y pasa a **Tarde**.
4. Sube la holgura a 3 días y recotiza igual: el mismo retraso ahora se clasifica **En riesgo**, no tarde.
5. Abre la pestaña **OTIF** en `/shipping` para ver el tablero de cumplimiento y las alertas por transportadora.

### Demo G — Flujo completo (cotizar → verificar → despachar → entregar)

1. Con el módulo **activo**, abre `/shipping` y toma un envío `pending`.
2. **Cotiza** la tarifa y confirma la cotización recomendada → se aplica transportadora, servicio, costo y ETA.
3. **Verifica la carga** con los bultos completos → la columna Carga queda en verde.
4. **Despacha** → estado `in_transit` con número de tracking generado.
5. **Registrar entrega** → estado `completed`. El envío entra al cálculo de OTIF.
6. Opcional: en **Manifiestos** (`/load-manifests`) crea un manifiesto de ruta y despáchalo para ver la documentación de carga con integración SAP.

---

## Relación con otros módulos

- **Packing (#6):** `sendToShipping` entrega el bulto verificado y etiquetado al despacho — es la entrada de este módulo.
- **Etiquetas:** la guía de envío es un `WmsLabel` tipo `shipping`, visible en `/labels`.
- **Manifiestos / SAP Rutas:** `LoadManifest` agrupa órdenes, traslados y devoluciones por parada y ruta SAP.
- **Patio y muelles (#8):** las citas de salida (`outbound`) se asocian al manifiesto para coordinar el muelle de carga.
- **Devoluciones (#12):** los envíos rechazados o no entregados alimentan la logística inversa.
- **Reportes (#14):** OTIF por transportadora, costo por transportadora y tendencias de cumplimiento.

---

## Pruebas

| Archivo | Cubre |
|---|---|
| `src/lib/rules/__tests__/shipping-outbound.test.ts` | `rateShop` (modalidades, estrategia, límite de peso), `recommendedQuote` (tope de sobrecosto), `loadVerificationStatus`, `consolidationGroups`, `deriveOtifStatus` |
| `src/store/__tests__/wms-store-shipping-dispatch.test.ts` | `verifyShipmentLoad`, políticas de `shipOrder` (verificación, parcial, modalidad), modo congelado, `applyRateQuote` con recálculo de OTIF |

```bash
npx vitest run src/lib/rules/__tests__/shipping-outbound.test.ts src/store/__tests__/wms-store-shipping-dispatch.test.ts
```

---

*Generado con Claude Code — Módulo de Despacho y transporte — 2026-07-23*
