# Picking, Packing y Despacho — Guía completa del flujo de salida

**Fecha:** 2026-07-23

Este documento explica, en lenguaje llano, cómo funcionan **Picking** (`/picking`), **Packing** (`/packing`) y **Despacho/Shipping** (`/shipping`, `/load-manifests`) en el aplicativo: qué significa cada término (oleada, batch, cluster, waveless, put-to-store...), qué hace cada botón/acción, **cómo llega el trabajo a los operarios en la práctica**, y qué controla cada parámetro de configuración.

No repite el detalle exhaustivo de acciones/API que ya existe en:
- `docs/modulo_gestion_picking.md`
- `docs/modulo_packing.md`
- `docs/modulo_shipping.md`

Este documento es el "mapa narrativo" que conecta esos tres — pensado para entender el proceso de punta a punta, no solo módulo por módulo.

---

## 1. El panorama general

Una orden de cliente (`CommerceOrder`) atraviesa tres estaciones antes de salir del almacén:

```
 CommerceOrder                PICKING                    PACKING                  DESPACHO
 (pedido del      ──►   extraer producto de   ──►   verificar + embalar   ──►   cotizar + cargar
  cliente)               su ubicación                + etiquetar               + confirmar salida
```

Cada estación es un módulo independiente con su propia gente, su propia pantalla de escritorio (para el supervisor) y — en Picking, Packing y Despacho (conductor) — su propia app móvil simplificada para el operario (`/worker/...`).

Lo importante: **picking no tiene una sola forma de operar, tiene 6**. Todas conviven al mismo tiempo en el mismo store de datos; se elige una u otra según el tipo de pedido, no es una migración de una a otra.

---

## 2. Glosario — de oleada a put-to-store

| Término | En criollo, ¿qué es? |
|---|---|
| **PickingTask** | La unidad de trabajo más pequeña: "ve a la ubicación X, saca N unidades del producto Y". Todo lo demás (oleada, batch, cluster) es una forma distinta de **agrupar o generar** estas tareas. |
| **Oleada (Wave)** | Un supervisor agrupa varios pedidos (por zona, ruta, prioridad, transportadora o ventana de despacho) y los libera **todos juntos** como un bloque de trabajo. Es el modelo clásico: "esta tanda de pedidos sale a piso ahora". |
| **Waveless** | Lo opuesto a la oleada: un pedido individual genera sus tareas de picking **de inmediato**, sin esperar a agruparse con nadie. Útil para pedidos urgentes o flujos de bajo volumen donde esperar una oleada no tiene sentido. |
| **Batch** | Cuando **varios pedidos distintos** piden el **mismo producto en la misma ubicación**, en vez de que un operario vaya 5 veces al mismo pasillo, se consolidan en **un solo viaje** que recoge el total y luego se reparte entre los pedidos. Ahorra caminata. |
| **Cluster** | Un operario carga un carro con **varios contenedores** (uno por pedido) y recorre una ruta optimizada, depositando cada producto en el contenedor del pedido correspondiente mientras camina. Un solo recorrido resuelve varios pedidos a la vez. |
| **Put-to-store** | Pensado para redes de tiendas: se hace un pick **masivo** en el centro de distribución de un producto, y luego esa cantidad se **reparte (distribuye)** entre varias tiendas destino, cada una con su propia cantidad asignada. |
| **Zona / Pick-and-pass** | El almacén se divide en zonas (A, B, C…) con un orden de paso configurable. El picking "por zona" es simplemente picking discreto **filtrado y secuenciado** por esas zonas — cada operario cubre su zona y el pedido va pasando de zona en zona. |
| **Incidencia** | Algo salió mal durante el pick: no hay stock físico, el producto está dañado, o la ubicación está vacía/mal marcada. Se reporta, la tarea queda en pausa (`with_issue`) y un supervisor o el mismo operario la retoma después de resolverla. |
| **SLA de despacho** | Cuántas horas quedan hasta la fecha de despacho prometida. Entre menos horas queden, más urgente debería ser la prioridad de la tarea. |
| **Verificación (Packing)** | Comparar lo que el empacador **escaneó** contra lo que el pedido **espera**. Si coincide 1 a 1 → `verified`; si falta o sobra algo → `mismatch`. |
| **Cartonización** | El sistema sugiere la caja más pequeña que alcanza a contener el pedido, calculando peso y volumen y dejando un margen de seguridad configurable (para no llenar la caja al 100% exacto). |
| **Regla de empaque** | Un producto frágil, líquido, pesado, de cadena de frío o de alto valor **dispara requisitos especiales** al empacar (burbuja, doble empaque, hielo seco…) y una nota que va impresa en la etiqueta. |
| **Rate shopping** | Antes de despachar, el sistema cotiza el envío con **todas las transportadoras disponibles** para ese peso y esa zona, y recomienda la más barata o la más rápida, según la política configurada. |
| **Verificación de carga** | Contar físicamente los bultos que realmente se subieron al camión antes de dejarlo salir, y compararlos contra los bultos esperados del envío. |
| **Despacho parcial** | Dejar salir el camión con **menos bultos** de los esperados (por ejemplo, faltó uno), registrando el saldo pendiente en vez de bloquear todo el envío. |
| **Consolidación por destino** | Si dos envíos pendientes van a la misma ciudad, se sugiere agruparlos en una sola ruta/camión en lugar de despachar uno por uno. |
| **OTIF** | *On-Time In-Full* — el % de envíos que llegaron **a tiempo** y **completos**. Es el indicador estrella del despacho. |
| **Manifiesto (LoadManifest)** | El documento de ruta de un camión: qué paradas hace, qué pedidos/traslados/devoluciones lleva en cada una, con integración a las rutas SAP. |
| **Modo congelado (freeze)** | Un interruptor de gobierno que bloquea **todas** las operaciones de un módulo (útil para inventarios físicos, cierres de turno o incidentes) sin tener que desconectar a nadie del sistema. |

---

## 3. Las 6 estrategias de picking, una por una

Todas viven en `/picking`, cada una en su propia pestaña, y comparten el mismo store — no son sistemas separados.

### 3.1 Discreto (Tareas)
El caso base: una `PickingTask` por producto+ubicación+pedido. El operario recibe la tarea, va, escanea, confirma. Acciones: **Iniciar** (`startPicking`) → **Completar** (`completePick`) → si quedó incompleta, un supervisor **Aprueba** (`approvePart`) o **Rechaza** (`rejectPart`) el faltante.

### 3.2 Oleada (Wave)
Un supervisor crea la oleada (**Crear oleada** → `createWave`) eligiendo cómo agrupar los pedidos (zona/ruta/prioridad/transportadora/ventana de despacho) y le pone un equipo asignado (texto libre, ver sección 4). Cuando está lista, la **libera** (**Liberar** → `releaseWave`), lo que la pasa de `draft` a `in_progress` y desde ese momento las tareas de esa oleada quedan disponibles para trabajarse.

### 3.3 Waveless
Un pedido se marca como waveless (**Crear orden waveless** → `createWavelessOrder`) y el sistema **genera automáticamente** una `PickingTask` por cada línea del pedido, en estado `pending`, sin esperar agrupación. Luego se **inicia** (`startWavelessOrder`), lo que pasa esas tareas a `assigned` de una sola vez.

### 3.4 Batch
El sistema detecta candidatos a batch cuando ≥N pedidos (configurable) piden el mismo producto en la misma ubicación. Un operario **inicia el batch** (`startBatchTask`) — un solo viaje — y al **completarlo** (`completeBatchTask`) se descuenta el inventario total; la repartición entre pedidos individuales queda registrada en el batch, no exige que el operario reparta físicamente ahí mismo.

### 3.5 Cluster
Se crea un cluster con N "slots" (uno por pedido/contenedor) y una ruta de ubicaciones a visitar. El operario **inicia el cluster** (`startClusterTask`), y en cada parada **deposita** en el contenedor correspondiente (`depositToSlot`, por pedido+producto+cantidad). Cuando todos los slots están completos, se **cierra** (`completeClusterTask`).

### 3.6 Put-to-store
Se **inicia** el pick masivo (`startPutToStore`) para juntar toda la cantidad necesaria de un producto. Luego esa cantidad se **distribuye** tienda por tienda (`distributeToStore`, con la cantidad exacta para cada una) hasta cubrir todas las asignaciones, y finalmente se **completa** (`completePutToStore`).

### 3.7 Zona (pick-and-pass)
No es un tipo de dato nuevo — es la misma `PickingTask` discreta, pero la pestaña **filtra y ordena** por la zona configurada (`pickingZones`, con su `sequenceOrder`), para que cada operario trabaje solo su tramo del almacén.

---

## 4. La pregunta clave: ¿cómo llegan las tareas a los operarios?

Aquí hay **dos mecanismos distintos conviviendo**, y vale la pena entender la diferencia porque no es la misma lógica en todos los módulos.

### 4.1 Cómo un operario entra al sistema

1. El operario inicia sesión. Su rol (`picker`, `packer`, `receiver`, `driver` o `supervisor`) queda guardado en una cookie de sesión.
2. `src/middleware.ts` intercepta cada navegación: si el rol es operativo (no supervisor) e intenta entrar a una pantalla de escritorio, lo **redirige automáticamente** a su pantalla móvil (`picker → /worker/picking`, `packer → /worker/packing`, `driver → /worker/driver`). Un supervisor, en cambio, sí puede navegar todo `/picking`, `/packing`, `/shipping`.
3. Cada pantalla `/worker/*` pregunta "¿quién soy?" contra el operario logueado (`useCurrentOperator`) y filtra el trabajo a mostrar según ese `id`.

### 4.2 Dos modelos de reparto de trabajo

| | **Asignación dirigida (push)** | **Cola abierta (pull)** |
|---|---|---|
| Cómo funciona | La tarea trae un `assignedOperatorId` (o `assignedDriverId`); el operario **solo ve lo suyo** en "Mis tareas" | Todas las tareas pendientes son visibles para **cualquier** operario del rol correspondiente; el primero que la toma, la trabaja |
| Dónde se usa hoy | Picking (`/worker/picking` filtra por `assignedOperatorId`) y Conductor (`/worker/driver` filtra por `assignedDriverId` en manifiestos y traslados) | Packing (`/worker/packing` muestra la cola completa de órdenes `pending`, ordenada por antigüedad) |

### 4.3 Cómo se resuelve hoy — asignación directa + reparto automático

Hasta julio de 2026 esto era un hueco real: `assignedOperatorId` (picking) y `assignedDriverId` (manifiestos/traslados) **existían** en los tipos de datos y **sí eran** los que filtraban "Mis tareas", pero **solo llegaban poblados por los datos semilla de la demo** — ningún botón de la app escribía ese id para trabajo generado en vivo. Esto ya se corrigió en dos fases:

**Fase 1 — asignación dirigida real.** Ahora existe un componente compartido, `<AssignOperatorDialog>`, que lista los operarios activos filtrados por el rol correcto (`picker`, `receiver`, `driver`) y, al confirmar, escribe el **id real** — no solo el nombre para mostrar:
- `/labor` → "Cola de tareas" tiene un botón **Asignar/Reasignar** por fila que cubre picking discreto, reposición y putaway (`startPicking`, `startReplenishment`, `assignPutaway`, los tres con un 3er parámetro `operatorId` opcional).
- `/picking` → los 5 botones **Iniciar** (Tareas/Batch/Cluster/Put-to-store/Waveless) ahora abren el mismo diálogo en vez de escribir el texto `"Operador"` a secas. Para tareas discretas ya `assigned`, "Iniciar" no vuelve a preguntar — solo avanza el FSM.
- `/load-manifests` y `/transfers` → nuevo botón **Asignar conductor**, respaldado por dos acciones nuevas (`assignManifestDriver`, `assignTransferDriver`) que validan que el operario esté activo y tenga rol `driver` antes de escribir `assignedDriverId`.

**Fase 2 — reparto automático (balanceo de carga).** En "Cola de tareas" de `/labor` hay además un botón **Distribuir automáticamente**: reparte de una sola vez todo lo que esté sin operario dentro del filtro activo (todos los tipos, o solo picking/reposición/putaway), asignando a quien tenga **menos tareas activas en ese momento** entre los operarios activos del rol correspondiente (`distributeQueueByLoad` en `lib/rules/labor.ts`). No es round-robin por turno fijo — es balanceo por conteo, recalculado item por item dentro de la misma corrida, así que un operario recién asignado no vuelve a recibir el siguiente item si ya quedó "más cargado" que otro. Por diseño sigue siendo **un botón que el supervisor presiona**, no algo que se dispare solo al crear la tarea — sigue habiendo una oleada liberada, una orden waveless creada, o una tarea de reposición generada por `generateReplenishmentTasks` que queda `pending` hasta que alguien (persona o el botón de reparto) le pone un operario.

**Lo que sigue sin tener consumidor móvil:** `ReplenishmentTask.assignedOperatorId` y `Asn.assignedOperatorId` (putaway) ya se escriben correctamente por ambos mecanismos — pero hoy no existe ninguna pantalla `/worker/*` que filtre por ellos (el receptor en `/worker/receiving` ve sus ASN por estado/fecha, no por operario asignado). Es cableado de datos listo para el día que exista esa pantalla, no una función visible hoy. Tampoco tienen `assignedOperatorId` los tipos `BatchTask`/`ClusterTask`/`PutToStoreTask`/`WavelessOrder` — solo se corrigió que el nombre que muestran sea real en vez del texto `"Operador"`.

**Packing** nunca tuvo este problema: su cola es abierta (pull) y cualquier empacador activo puede tomar cualquier orden `pending`, sin necesidad de un id de asignación.

### 4.4 El recorrido completo, paso a paso (picking discreto, el más simple)

1. Existe un `CommerceOrder` con productos pedidos.
2. Se genera (por oleada, waveless, etc.) una `PickingTask` en estado `pending`, con ubicación, producto y cantidad.
3. Un supervisor le asigna un operario real desde `/labor` o `/picking` (o usa "Distribuir automáticamente"): la tarea pasa a `assigned` y queda con `assignedOperatorId` poblado.
4. Aparece de inmediato en "Mis tareas" del operario correspondiente en `/worker/picking`. El operario abre la tarea → wizard de 3 pasos (ver también §5.2, con el detalle completo del wizard móvil):
   - **Paso 1 — Escanear ubicación:** se muestra la zona y el código de la ubicación en letras grandes; el operario escanea el código de barras. Si coincide, la tarea pasa de `pending`/`assigned` a `assigned`/`in_progress` (`startPicking`).
   - **Paso 2 — Escanear producto:** se muestra el producto esperado (foto, nombre, SKU); el operario escanea el código de barras del producto.
   - **Paso 3 — Cantidad:** el operario ajusta cuántas unidades realmente recogió (control tipo +/-). Si el producto se rastrea por serial, debe capturarlo. Al confirmar:
     - Si la cantidad es igual a la pedida → `completePick` cierra la tarea como `completed`.
     - Si es menor → aparece un diálogo de confirmación de **pick parcial**; al confirmar, el wizard móvil llama `completePick` seguido de `approvePart` **en el mismo paso** — el propio operario autoaprueba el faltante desde el celular (queda en `partial_approved`), sin pasar por una cola de revisión de supervisor. `rejectPart` sí existe como acción, pero solo se usa hoy desde el tablero de escritorio, no desde este wizard.
   - En cualquier paso, el operario puede pulsar **"⚠️ Reportar incidencia"**: elige un motivo (sin stock, dañado, ubicación mal etiquetada), opcionalmente adjunta una foto (obligatoria si `pickingRequireIssuePhoto` está activo) y sugiere un producto sustituto. La tarea pasa a `with_issue` y sale de la lista activa hasta resolverse (`resolveIssue`, que la regresa a `in_progress`).
5. Una vez completada, la unidad recogida queda lista para pasar a **Packing**.

Para batch, cluster, waveless y put-to-store el mecanismo de fondo es el mismo (agrupar/generar tareas, luego ejecutar), solo cambia la unidad de trabajo — pero **hoy ninguna de esas 4 estrategias tiene todavía un wizard móvil propio**: el operario móvil de picking solo tiene flujo operativo para tareas discretas (`/worker/picking/task/[taskId]`). El resto se opera desde el tablero de escritorio.

---

## 5. El flujo completo en el celular — Picker, Empacador y Conductor

Todas las pantallas `/worker/*` comparten el mismo layout mobile-first: `src/app/(worker)/layout.tsx` limita el ancho a `max-w-lg` y pone un header simple (`WorkerHeader`) arriba — pensado para un celular en la mano, no para un navegador de escritorio con mouse. `middleware.ts` es lo que garantiza que cada rol **solo** vea su pantalla (§4.1); dentro de ella, `useCurrentOperator()` resuelve "quién soy" contra el operario logueado, y cada lista filtra el trabajo con ese id.

### 5.0 Cómo se "escanea" en esta app

No hay cámara ni lector de código de barras real: `ScanInput` (`src/components/worker/scan-input.tsx`) es un campo de texto que se **autoenfoca** al entrar al paso. En un celular/PDA de bodega real, un lector físico (Bluetooth o USB, la mayoría configurados como teclado — "HID") simplemente "teclea" el código leído en ese campo y dispara Enter; en la demo, se simula escribiendo el código a mano. El campo compara el valor contra lo esperado (`expectedValue`): verde + `onMatch()` si coincide, rojo + limpia el campo si no. Cada paso también tiene un botón secundario **"Confirmar manualmente"** que se salta la comparación — pensado para probar el flujo sin tener el código a la mano, no para uso en producción.

### 5.1 Antes de todo — cómo le llega el trabajo a cada uno

| Rol | Pantalla | Modelo | Filtro |
|---|---|---|---|
| Picker | `/worker/picking` | Push (asignación dirigida) | `pickingTasks` con `assignedOperatorId === operator.id` y estado en `pending`/`assigned`/`in_progress` |
| Empacador | `/worker/packing` | Pull (cola abierta) | `packingOrders` con `status === 'pending'`, sin filtro por operario — el primero que la toma la trabaja |
| Conductor | `/worker/driver` | Push (asignación dirigida) | `loadManifests` con `assignedDriverId === operator.id` + `transfers` con `assignedDriverId === operator.id` y `status === 'in_transit'` |

Para que algo le aparezca al picker o al conductor, un supervisor (o el botón "Distribuir automáticamente") tuvo que escribirle el id antes — ver §4.3. El empacador, en cambio, siempre ve toda la cola sin que nadie le asigne nada.

### 5.2 Picker (`/worker/picking`)

**Lista — "Mis tareas":** ordenada por prioridad (alta → media → baja), con un botón grande **"▶ Iniciar siguiente tarea"** que salta directo a la primera de la lista. Cada tarjeta (`WorkerCard`) muestra producto, zona+ubicación, cantidad pedida y el código de la tarea; se resalta si es prioridad alta.

**Wizard, 3 pasos** (`/worker/picking/task/[taskId]`), con una barra de progreso arriba:

1. **Escanear ubicación** — pantalla grande con la zona y el código de ubicación en letras enormes (pensado para leerse desde lejos en el pasillo) y una miniatura del producto esperado. Al escanear/confirmar, si la tarea estaba `pending`/`assigned` la avanza con `startPicking` (queda `in_progress`).
2. **Escanear producto** — foto grande, nombre y SKU del producto esperado; se escanea su código de barras.
3. **Cantidad** — un stepper +/- (`QuantityStepper`) para ajustar cuántas unidades se recogieron realmente, con la cantidad pedida como referencia grande arriba.
   - **Si el producto es serializado (`Product.trackBy === 'serial'`)**, aparece un campo de texto obligatorio para el serial (escaneado o tecleado) — no se puede confirmar sin él, y el store además valida que ese serial exista en el inventario del producto (`completePick` rechaza seriales inventados).
   - **Si es por lote (`trackBy === 'lot'`) o sin trazabilidad (`trackBy === 'none'`)**, no pide nada adicional — solo la cantidad.
   - Cantidad completa → `completePick` cierra la tarea en `completed`.
   - Cantidad menor a la pedida → diálogo "¿Confirmar cantidad parcial?"; al aceptar, el propio wizard encadena `completePick` + `approvePart` (ver nota en §4.4) y queda en `partial_approved`.
4. **En cualquier paso**, botón **"⚠️ Reportar incidencia"**: motivo (sin stock, dañado, ubicación mal etiquetada…) + foto opcional (obligatoria si `pickingRequireIssuePhoto` está activo) → `reportIssue`, la tarea pasa a `with_issue` y desaparece de la lista activa hasta que alguien la resuelva.

### 5.3 Empacador (`/worker/packing`)

**Lista — "Cola de empaque":** toda orden `pending`, ordenada por antigüedad (la más vieja primero), con el mismo botón **"▶ Iniciar siguiente"**. Cada tarjeta muestra el número de pedido, cuántos ítems espera y qué reglas de empaque (frágil, líquido…) ya tiene aplicadas.

**Wizard** (`/worker/packing/[orderId]`), pasos condicionales según si la orden tiene reglas aplicadas:

1. **Reglas de manejo** (solo si la orden tiene alguna regla aplicada) — muestra cada regla con su descripción (ej. "Frágil — usar burbuja doble") antes de dejar seguir. Al continuar, `startPacking` mueve la orden a `in_progress`.
2. **Ítems** — una línea de producto a la vez ("Producto 2 de 4"): foto, nombre, SKU, cantidad pedida. Se escanea el código de barras del producto y `scanItem` suma esa cantidad al conteo escaneado de la línea. Hay un botón **"Omitir verificación"** que da por escaneada la línea completa sin comparar el código — útil en demo, pero es la misma vía por la que un producto equivocado podría pasar sin detectarse.
3. **Caja** — se muestra la caja sugerida por cartonización (`suggestBox`, si `packingAutoBoxSuggestion` está activo) con botón directo "Usar esta caja", o la lista completa para elegir otra (`selectBox`).
4. **Etiqueta** — resumen de orden + cliente y botón **"Generar etiqueta"** (`generateLabel`), seguido de una pantalla de "Enviando a la impresora…" y el envío automático a Despacho (`sendToShipping`).

**Dos diferencias importantes frente al picking móvil, vale la pena tenerlas claras:**
- **No hay captura de serial en este wizard.** El modelo de datos sí tiene un campo `serial` por línea de `PackingOrder` (y `completePacking` genera un movimiento de stock por cada línea que lo tenga), pero ninguna pantalla —ni esta ni el escritorio— lo llena todavía. Si se necesita trazabilidad de serial en el momento de empacar (no solo en el pick), es una pieza pendiente.
- **El escaneo de producto siempre marca la línea completa como escaneada** (`scanItem(order.id, productId, pendingLine.requestedQuantity)`) — no hay un stepper de cantidad como en picking, así que hoy este wizard no puede registrar un empaque parcial/faltante por sí mismo; para eso existe `completePacking` con su lógica de `mismatch`, pero se opera desde el escritorio.

### 5.4 Conductor (`/worker/driver`)

**Lista:** dos secciones, **Manifiestos** (los `loadManifests` asignados a este conductor) y **Transferencias** (los `transfers` `in_transit` asignados a él). Cada manifiesto muestra código, número de paradas y transportadora; cada traslado trae de una vez el botón **"✓ Confirmar llegada"** (`advanceTransfer`) sin necesidad de abrir una pantalla adicional.

**Detalle de manifiesto** (`/worker/driver/manifest/[id]`): lista de paradas en el orden de la ruta (`sequence`), la parada actual resaltada con dos botones:
- **"✓ Confirmar entrega"** — marca la parada como hecha y pasa a la siguiente; cuando todas están hechas, cierra el manifiesto (`closeManifest`) y muestra "Ruta completada".
- **"⚠️ Novedad"** — abre un diálogo con motivos predefinidos (bulto faltante, rechazado por cliente, dirección incorrecta, otro) + nota libre; al registrar la novedad, la parada también se marca como hecha (con la novedad guardada en la nota, no como un estado FSM separado) y la ruta sigue.

Este flujo no tiene wizard de escaneo — a diferencia de picking/packing, el conductor no escanea productos, solo confirma paradas.

---

## 6. Packing — cómo llega a los empacadores y qué hace cada acción

### Cómo llega
No hay asignación dirigida: `/worker/packing` muestra **toda la cola de órdenes `pending`**, ordenada por la más antigua primero — el empacador toma la que sigue con el botón "▶ Iniciar siguiente" o elige cualquiera de la lista.

### El flujo, acción por acción

| Acción | Qué hace en la práctica |
|---|---|
| `startPacking` | El empacador toma la orden → `pending → in_progress`. |
| `scanItem` | Cada escaneo de un producto suma al conteo escaneado de esa línea y recalcula si ya coincide con lo esperado. |
| `completePacking` | Cierra la verificación: si escaneado = esperado → `verified`; si no → `mismatch` (bloqueado o permitido según la configuración). Si el producto es serializado, registra el movimiento de stock correspondiente. Si está activado, genera la etiqueta automáticamente. |
| `applyPackingRule` / `removePackingRule` | Aplica o quita una regla de empaque (frágil, líquido, pesado…) a la orden — puede ser automático por categoría de producto o manual. |
| `selectBox` | Asigna la caja elegida (manual o la sugerida por cartonización). |
| `generateLabel` | Crea la etiqueta de envío → `labelled`. |
| `sendToShipping` | Entrega el bulto ya etiquetado al módulo de Despacho → `dispatched`. |

Ver `docs/modulo_packing.md` para el CRUD de cajas y reglas, y la tabla completa de configuración.

---

## 7. Despacho — cómo llega a los conductores y qué hace cada acción

### Escritorio (`/shipping`, `/load-manifests`)
El supervisor de despacho trabaja aquí: cotiza, verifica y despacha cada envío manualmente, sin restricción de "asignación" — cualquier supervisor ve todos los envíos.

| Acción | Qué hace en la práctica |
|---|---|
| `createShipment` | Crea el envío en `pending` con la tarifa que se le aplique. |
| `applyRateQuote` | Cotiza con **todas** las transportadoras activas para ese peso/zona (`rateShop`), recomienda una (más barata o más rápida, según configuración) y al confirmarla recalcula el estado OTIF contra la fecha prometida. |
| `verifyShipmentLoad` | El operario cuenta los bultos que realmente subieron al camión y los registra contra los esperados. |
| `shipOrder` | Intenta despachar (`pending → in_transit`, genera número de tracking) — pero antes valida: ¿la modalidad de transporte está habilitada?, ¿ya se verificó la carga (si se exige)?, ¿faltan bultos y el parcial está permitido? Si alguna falla, bloquea con un mensaje explicando por qué. |
| `deliverShipment` | Registra la entrega al cliente → `completed`, y ese envío entra al cálculo de OTIF. |
| `createManifest` / `addDocumentToManifest` | Arma el documento de ruta del camión: qué pedidos, traslados o devoluciones lleva y en qué parada. |
| `closeManifest` / `dispatchManifest` | Cierra o despacha formalmente el manifiesto (con integración a rutas SAP). |

### Móvil del conductor (`/worker/driver`)
Mismo patrón que picking: la pantalla filtra manifiestos y traslados por `assignedDriverId === operator.id` — **asignación dirigida**, no cola abierta. Desde `/load-manifests` y `/transfers` el supervisor tiene un botón **Asignar conductor** que escribe ese id (`assignManifestDriver` / `assignTransferDriver`, ver §4.3). El conductor, una vez le aparece algo en su lista, puede abrir el manifiesto o **"Confirmar llegada"** de un traslado en tránsito (`advanceTransfer`) — el detalle completo del wizard móvil está en §5.4.

Ver `docs/modulo_shipping.md` para el detalle de `rateShop`, políticas de despacho parcial/modalidad, y OTIF.

---

## 8. Configuración — qué controla cada parámetro

Las tres páginas siguen el mismo patrón: **Sistema → Configuraciones → [Picking|Packing|Despacho]**, solo visibles para el rol `supervisor`, con KPIs en vivo arriba y los parámetros abajo, persistidos automáticamente (no hay botón "publicar", los cambios se guardan al confirmar).

### Picking (`/picking-settings`)

| Parámetro | Para qué sirve |
|---|---|
| `pickingFreezeActive` | Apaga todo el módulo (18 acciones bloqueadas) — para inventarios físicos o incidentes. |
| `pickingSlaUrgentHours` / `pickingSlaWarningHours` | Umbrales de horas-hasta-despacho que definirían prioridad alta/media (la función que los usa, `derivePriorityFromSla`, existe pero **aún no está conectada** a los formularios de creación — la prioridad hoy se sigue escogiendo a mano). |
| `pickingWaveMinOrders` | Umbral **sugerido** (no forzado) de cuántos pedidos conviene juntar en oleada antes de mandarlos waveless. |
| `pickingBatchMinOrders` | Mínimo de pedidos con el mismo producto+ubicación para que valga la pena hacer batch. |
| `pickingClusterMaxContainers` | Techo de contenedores simultáneos que un operario puede cargar en un cluster. |
| `pickingRequireIssuePhoto` | Obliga a adjuntar foto para poder reportar una incidencia. |
| `pickingAllowSubstitution` | Habilita sugerir un producto sustituto al reportar incidencia por falta de stock. |
| `pickingZones` | El catálogo de zonas de pick-and-pass (nombre + orden de paso), editable ahí mismo. |

### Packing (`/packing-settings`)

| Parámetro | Para qué sirve |
|---|---|
| `packingFreezeActive` | Apaga las 8 acciones de flujo de packing. |
| `packingAutoBoxSuggestion` | Enciende/apaga la sugerencia automática de caja. |
| `packingBoxSafetyMargin` | Qué % de la capacidad de la caja se reserva como colchón (10% por defecto → usa solo el 90%). |
| `packingRequireFullScan` | Si está activo, exige escaneo 1:1 exacto — bloquea cerrar con algo sin escanear. |
| `packingAllowMismatch` | Si está activo (y no se exige escaneo completo), permite cerrar con discrepancia registrada. |
| `packingAutoGenerateLabel` | Genera la etiqueta de envío automáticamente al verificar, sin paso manual. |

### Despacho (`/shipping-settings`)

| Parámetro | Para qué sirve |
|---|---|
| `shippingFreezeActive` | Apaga despachar, entregar, verificar carga, recotizar y manifiestos. |
| `shippingAutoRateShop` | Preselecciona automáticamente la cotización recomendada al abrir el comparador. |
| `shippingRateStrategy` | Criterio de recomendación: `cheapest` (más barata) o `fastest` (más rápida). |
| `shippingMaxCostOverBestPct` | Cuánto sobrecosto (%) se tolera sobre la tarifa más barata antes de forzar la más económica igual. |
| `shippingRequireLoadVerification` | Exige contar los bultos cargados antes de poder despachar. |
| `shippingAllowPartialDispatch` | Permite despachar con bultos faltantes, dejando el saldo registrado. |
| `shippingEnabledModalities` | Qué modalidades de transporte (flota propia, tercero, courier, última milla) están habilitadas para cotizar/despachar. |
| `shippingOtifAtRiskDays` | Días de holgura antes de que un envío se marque "en riesgo" en vez de "a tiempo". |
| `shippingOtifTargetPct` | Meta de cumplimiento OTIF usada como referencia en los KPIs. |
| `shippingConsolidateByDestination` | Activa la sugerencia de agrupar envíos pendientes del mismo destino. |

---

## 9. Gobierno — el modo congelado (freeze)

Cada uno de los tres módulos tiene su propio interruptor (`pickingFreezeActive`, `packingFreezeActive`, `shippingFreezeActive`), independiente entre sí. Al activarlo:

- Aparece una banda de aviso en la pantalla del módulo.
- Todas las acciones de flujo de ese módulo lanzan un error explicando que está congelado — no se puede iniciar, escanear, completar, despachar, etc.
- Las pantallas de **configuración**, **CRUD de catálogos** (cajas, reglas, transportadoras) y las de **consulta** siguen funcionando; solo se bloquea la operación.

Es la palanca que se usa para, por ejemplo, hacer un conteo físico de inventario o un cierre de turno sin que alguien mueva stock en paralelo.

---

## 10. Cómo se relacionan los tres módulos

```
Commerce Order
     │
     ▼
 PICKING  ──(6 estrategias, ver §3)──►  producto extraído
     │
     ▼
 PACKING  ──(escaneo → cartonización → reglas → etiqueta)──►  bulto listo
     │
     ▼
 DESPACHO ──(rate shopping → verificar carga → despachar → entregar)──►  cliente / tienda
     │
     ▼
 Manifiesto de ruta (opcional, agrupa varios despachos con integración SAP)
```

| Módulo | Entra desde | Sale hacia |
|---|---|---|
| Picking | `CommerceOrder` | Packing (unidad ya recolectada) |
| Packing | Picking | Despacho (`sendToShipping`) + Etiquetas (`/labels`) |
| Despacho | Packing | Cliente/tienda (entrega) + Manifiestos + Reportes (OTIF) |

---

## 11. Nota técnica encontrada al revisar el código (no es parte de la pregunta, pero vale mencionarla)

Al verificar la configuración con el compilador de TypeScript (`npx tsc --noEmit`), aparece un error real en `src/types/wms.ts`: los campos de configuración de **Packing** y **Despacho** (`packingFreezeActive`, `shippingFreezeActive`, etc., línea ~1228 en adelante) están declarados **dentro de la interfaz `PickingZoneConfig`** en vez de dentro de `WmsSettings` — parece un `}` de cierre puesto en el lugar equivocado. Esto no rompe la app en desarrollo (Next.js no bloquea por errores de tipos al correr `next dev`), pero sí hace fallar `tsc --noEmit` con ~30 errores en `packing-settings/page.tsx` y `shipping-settings/page.tsx`, y bloquearía un pipeline de CI que exija type-check limpio. Si quieres, lo puedo corregir por separado — es un cambio de una sola línea (mover el `}` de cierre).

---

## 12. Documentos relacionados

| Documento | Contenido |
|---|---|
| `docs/modulo_gestion_picking.md` | Referencia técnica de Picking: acciones completas, cobertura vs. benchmark, incidencias |
| `docs/modulo_packing.md` | Referencia técnica de Packing: arquitectura por capas, demos paso a paso |
| `docs/modulo_shipping.md` | Referencia técnica de Despacho: reglas puras de `rate shopping`/OTIF, demos paso a paso, pruebas automatizadas |
| `docs/funcionalidades_base_wms.md` | Catálogo de mercado (Base/Estándar/Avanzado) contra el que se mide cada módulo |

---

*Generado con Claude Code — 2026-07-23*
