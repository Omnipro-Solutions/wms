# Guión de Demo WMS

> **Audiencia:** Centros de distribución y tiendas medianas/grandes en Colombia
> **Duración base:** 30 minutos (Flujos 1-3) — bloques extra son opcionales, según tiempo/interés del cliente
> **Presentador:** Carlos Granados

---

## Cómo cambiar de operador (usar en TODOS los pasos)

No se necesitan pestañas ni ventanas separadas. Un solo selector funciona en desktop y móvil:

- **Desktop:** click en el avatar (esquina superior derecha) → **"Cambiar operador"**
- **Móvil:** click en el ícono 👥 en el header

En ambos casos se abre el mismo diálogo **"Cambiar operador (demo)"** con 5 botones (Supervisor, Recepcionista, Picker, Empacador, Conductor). Click en el rol → login automático → redirige a la vista correspondiente.

Cada paso del guión abajo indica **qué operador debe estar activo** — cámbialo con este selector antes de ejecutar el paso.

---

## Credenciales (login inicial o si el selector falla)

| Rol | Nombre demo | Email | Contraseña | URL |
|-----|------------|-------|-----------|-----|
| Supervisor | Carlos Granados | carlos.granados@wms.co | wms2024 | `http://localhost:3000/` |
| Receiver | María Recepcionista | receiver@demo.com | 123456 | `http://localhost:3000/worker` |
| Picker | Ana Picker | picker@demo.com | 123456 | `http://localhost:3000/worker` |
| Packer | Pedro Packer | packer@demo.com | 123456 | `http://localhost:3000/worker` |
| Driver | Carlos Driver | driver@demo.com | 123456 | `http://localhost:3000/worker` |

---

## Preparación (5 min antes — no frente al cliente)

1. `http://localhost:3000/auth/login` → iniciar sesión como **supervisor** (`carlos.granados@wms.co` / `wms2024`)
2. Confirmar que el dashboard (`/`) carga con KPIs — si no, consola JS → `localStorage.clear()` → recargar → login de nuevo
3. Tener este guión en segunda pantalla o impreso
4. Decidir de antemano qué bloques opcionales usar según el cliente (ver tabla al final)

---

## INTRO (1 min)

**Qué es:** panel único del supervisor con el pulso de toda la operación — pedidos pendientes, cumplimiento de entregas (OTIF), alertas.

**Operador activo:** Supervisor

1. Dashboard (`/`) → señalar KPIs: órdenes pendientes, OTIF, alertas críticas
2. **Decir:** *"Les voy a mostrar un día típico: llega mercancía, sale una venta, se gestiona una devolución. Todo con trazabilidad completa, sin papel ni Excel."*

---

## FLUJO 1 — Inbound: Llegada de mercancía (8 min)

**Qué es:** recepción de mercancía contra una orden de compra (ASN = aviso de llegada), inspección de calidad y guardado en la ubicación correcta.

**Historia:** *"Un camión de Distribuidora Demo llegó con 15 microondas."*

**Datos de prueba:** ASN `ASN-DEMO-001` — Microondas 28L Digital (SKU `LC-MIC-006`), 15 unidades esperadas, estado inicial `Pendiente`. También disponible `ASN-DEMO-002` — Licuadora Industrial 2L, 20 unidades esperadas.

### Paso 1 — Supervisor ve el ASN (1 min)
**Operador activo:** Supervisor (ya lo está desde el intro — no cambiar)

1. Menú lateral → **Recepción**
2. Tab **Citas ASN** → localizar `ASN-DEMO-001`, estado **Pendiente**
3. Click en `ASN-DEMO-001` → mostrar detalle con el stepper de estado
4. **Decir:** *"El supervisor ve qué espera recibir, de qué proveedor, y cuánto. La orden ya viene del ERP."*

### Paso 2 — Receiver recibe las cajas (4 min)
**Cambiar operador:** avatar → Cambiar operador → **Recepcionista — María Recepcionista**

**Nota:** la vista de recepción ahora muestra 2 ASNs demo (`ASN-DEMO-001` y `ASN-DEMO-002`) — usar cualquiera para este paso.

1. Ya en `/worker` → tarjeta **Recepciones** → click
2. Localizar `ASN-DEMO-001` en la lista → click
3. En el campo de cantidad recibida escribir **`10`** → confirmar
4. Avanzar hasta el paso **putaway** → confirmar ubicación
5. En la pantalla **"Imprimir etiquetas de recepción"** → click **Imprimir** en cada etiqueta generada → **Continuar**
6. **Decir:** *"El operario en el muelle escanea o digita la cantidad, guarda en la ubicación sugerida, y el sistema genera e imprime la etiqueta de recepción — todo desde el celular, sin pasar por el computador."*

### Paso 3 — Supervisor aprueba QC y Putaway (3 min)
**Cambiar operador:** avatar → Cambiar operador → **Supervisor**

1. `/receiving` → tab **Cola QC** → el ítem aparece para revisión
2. Click **Aprobar QC**
3. Tab **Putaway staging** → señalar ubicación sugerida (Zona A, `loc-a0101`)
4. **Decir:** *"El sistema sugiere la ubicación óptima según la clasificación ABC del producto. Alta rotación va a zona dorada."*
5. Confirmar putaway
6. `/inventory` → buscar "Microondas" → mostrar stock actualizado
7. **Decir:** *"Desde el muelle hasta el estante — trazabilidad completa en tiempo real."*

**Transición:** *"Ahora veamos cómo sale esa mercancía: una venta de ecommerce."*

---

## FLUJO 2 — Outbound: Picking → Packing → Despacho (14 min)

**Qué es:** ciclo completo de una venta — agrupar pedidos en una oleada, recolectar los productos (picking), empacarlos con la caja y reglas correctas (packing), cotizar transporte y despachar.

**Historia:** *"Llegaron 3 órdenes de ecommerce esta mañana. El supervisor las agrupa y el equipo las despacha en menos de una hora."*

**Datos de prueba:** órdenes `PED-DEMO-001`, `PED-DEMO-002`, `PED-DEMO-003`; oleada `WAVE-DEMO-001` asignada a Ana Picker.

### Paso 4 — Supervisor ve las órdenes y la oleada (2 min)
**Operador activo:** Supervisor

1. Menú lateral → **Commerce** → señalar `PED-DEMO-001`, `PED-DEMO-002`, `PED-DEMO-003` (estado: pendiente)
2. **Decir:** *"El sistema centraliza todos los canales: ecommerce, marketplace, B2B. Todo en un panel."*
3. **Picking** → tab **Oleadas** → señalar `WAVE-DEMO-001`, estado **En Progreso**, asignada a Ana Picker
4. **Decir:** *"El supervisor crea la oleada, asigna al equipo, y libera. El operario recibe las tareas en su celular."*

### Paso 5 — Picker recoge los ítems (5 min)
**Cambiar operador:** avatar/👥 → **Picker — Ana Picker**

**Códigos de escaneo (paso 2 del flujo, "escanear ubicación y producto"):**

| Tarea | Ubicación (código de barras) | Producto (código de barras) |
|---|---|---|
| `PICK-DEMO-001` — Cafetera Espresso Automática | `LOC-A-PICKFAST1` | `7700000000103` |
| `PICK-DEMO-002` — Sanduchera Grill 1200W | `LOC-A-A0101` | `7700000000110` |
| `PICK-DEMO-003` — Licuadora Industrial 2L | `LOC-A-PICKFAST1` | `7700000000080` |

1. **Picking** → señalar las 3 tareas asignadas
2. **Decir:** *"El picker ve exactamente a dónde ir: ubicación, producto, cantidad. Sin papel, sin confusión."*
3. Click en `PICK-DEMO-001` → escanear/escribir ubicación **`LOC-A-PICKFAST1`** → escanear/escribir producto **`7700000000103`** → cantidad **`2`** → confirmar
4. Mostrar que pasa a **Completado**
5. Click en `PICK-DEMO-002` → ubicación **`LOC-A-A0101`** → producto **`7700000000110`** → cantidad **`1`** → confirmar
6. **Decir:** *"El sistema optimiza la ruta de picking. Cada tarea lleva al operario al punto más cercano."*

### Paso 6 — Packer empaca y genera etiqueta (4 min)
**Cambiar operador:** avatar/👥 → **Empacador — Pedro Packer**

1. **Packing** → señalar `PED-DEMO-001` (pendiente) → click
2. En el campo de escaneo escribir el código de barra **`7700000000103`** (Cafetera Espresso Automática, SKU `PE-CAF-010`, cantidad 2) → confirma la línea
3. Mostrar sugerencia de caja: **Caja S** (calculada por peso y volumen)
4. Confirmar caja → **Generar Etiqueta**
5. Mostrar el código de despacho generado
6. **Decir:** *"El sistema sugiere la caja correcta, detecta manejo especial — frágil, cadena de frío, alto valor — y genera la etiqueta automáticamente. Cero errores humanos."*

**Opcional — packing multi-producto:** usar `PED-DEMO-002` en vez de `PED-DEMO-001`:
- Línea 1 — Microondas 28L Digital, SKU `LC-MIC-006`, barra `7700000000066`, cantidad 1
- Línea 2 — Cafetera Espresso Automática, SKU `PE-CAF-010`, barra `7700000000103`, cantidad 1
- Cada línea se escanea por separado; solo con ambas confirmadas se habilita **Generar Etiqueta**
- Si el código no coincide, el sistema muestra el error esperado y bloquea el avance (o permite "Omitir verificación")

### Paso 7 — Rate shopping y despacho (3 min)
**Operador activo:** Supervisor (cambiar de vuelta) para los pasos 1-2; luego **Conductor — Carlos Driver** para el paso 3

1. `/shipping` → tabla de tarifas por carrier → **Decir:** *"El sistema cotiza en tiempo real con todos los carriers y elige el más económico dentro del SLA."*
2. `/load-manifests` → manifiesto de carga con las órdenes → **Decir:** *"Se genera automáticamente. Se integra con SAP para las rutas."*
3. **Cambiar operador** → **Conductor — Carlos Driver** → señalar el manifiesto asignado
4. **Decir:** *"El conductor ve su ruta en el celular, confirma el despacho, y el sistema actualiza el OTIF automáticamente."*

**Transición:** *"¿Y qué pasa cuando un cliente devuelve algo? Veamos."*

---

## FLUJO 3 — Devoluciones + Optimización de Inventario (8 min)

**Qué es:** recepción de un producto devuelto por una tienda, decisión de qué hacer con él (reingreso, scrap, reparación, QC), y el motor de slotting que recomienda dónde debería estar cada producto según su rotación.

**Historia:** *"La Tienda Santa Fe devuelve 3 sanducheras. El sistema decide qué hacer con ellas y optimiza el inventario."*

**Datos de prueba:** devolución `RMA-DEMO-001` — 3 sanducheras, Tienda Santa Fe, estado `Recibido en DC`. También disponible `RMA-DEMO-002` — 1 cafetera, Tienda Andino, estado `En validación` (lista para inspección directa).

### Paso 8 — Receiver recibe e inspecciona la devolución (3 min)
**Cambiar operador:** avatar/👥 → **Recepcionista — María Recepcionista**

**Nota:** hay 2 devoluciones demo — `RMA-DEMO-001` (Tienda Santa Fe, aún en "Recibido en DC") y `RMA-DEMO-002` (Tienda Andino, ya en "En validación", lista para inspeccionar directamente).

1. **Devoluciones** (o desde la tarjeta de devolución en `/worker/receiving`) → señalar `RMA-DEMO-001` → click **Avanzar a validación**
2. Con `RMA-DEMO-002` (ya en validación) → marcar condición **Bueno** por producto → **Confirmar inspección**
3. Elegir disposición: **Reingreso** → click
4. **Decir:** *"El receiver inspecciona en el momento — condición por producto — y decide qué pasa con la devolución ahí mismo, desde el celular."*

### Paso 9 — Supervisor gestiona la disposición (3 min)
**Cambiar operador:** avatar/👥 → **Supervisor**

1. `/returns` → señalar `RMA-DEMO-001`, estado **Recibido en DC** → click
2. Señalar opciones: **Reingreso**, **Scrap**, **Reparación**, **Control de Calidad**
3. Seleccionar **Reingreso a inventario** → confirmar
4. `/inventory` → buscar "Sanduchera" → mostrar que el stock aumentó
5. **Decir:** *"Cada devolución tiene un flujo. El sistema sabe si el producto vuelve al inventario, va a reparación, o se da de baja."*

### Paso 10 — Slotting: el sistema optimiza solo (3 min)
**Operador activo:** Supervisor

1. Menú lateral → **Slotting** → tab **Recomendaciones** → productos con score alto
2. **Decir:** *"El sistema analiza frecuencia de picking y variabilidad de demanda. Dice qué mover y cuánto tiempo/distancia se ahorra."*
3. Tab **Matriz ABC/XYZ** → clasificación de productos
4. **Decir:** *"Los productos A-X (alta rotación, demanda estable) van a zona dorada, cerca del despacho."*
5. Tab **Necesidades de Reposición** → pick-faces bajo mínimo
6. **Decir:** *"Antes de que se agote, el sistema ya generó la tarea de reposición. Nunca un picker llega a una ubicación vacía."*

---

## BLOQUES OPCIONALES — usar según el cliente o el tiempo disponible

### Opcional A — Traslados entre bodegas (Traslados) (4 min)

**Qué es:** movimiento planificado de inventario entre dos bodegas (o de bodega a tienda), con ruta, transportador y seguimiento por tramos hasta la recepción en destino.

**Datos de prueba:** traslado `TR-2406-001` (id `tr-1`) — Nevera No Frost 320L (100 uds) + Lavadora Carga Frontal 12kg (50 uds), de Bogotá (`wh-bog`) a Tienda Andino (`wh-andino`), estado **En tránsito**, llegada estimada 2026-06-11.

**Operador activo:** Supervisor

1. Menú lateral → **Traslados**
2. Localizar `TR-2406-001` → estado **En Tránsito** → click para ver detalle
3. Señalar los 2 productos y sus cantidades, la bodega origen/destino y la ruta asignada
4. **Decir:** *"El sistema sigue el traslado tramo a tramo: salida de bodega, en tránsito, llegada a destino. La tienda recibe notificación antes de que el camión llegue."*
5. Click **Avanzar estado** → mostrar que pasa a **Recibido** (o **Recibido parcial** si aplica)
6. **Decir:** *"Al confirmar la recepción en destino, el inventario se mueve automáticamente entre bodegas — sin ajustes manuales ni descuadres."*

### Opcional B — Batch picking (3 min)

**Qué es:** cuando varios pedidos piden el mismo producto en la misma ubicación, el sistema consolida esos picks en una sola tarea — el operario recoge una vez para varios pedidos.

**Datos de prueba:** tarea de lote `bt-1` — consolida 2 pedidos que piden Microondas 28L Digital en `loc-a0101`, estado **En Progreso** (1 de 3 unidades recolectadas), operario Andrés Gómez.

**Operador activo:** Supervisor

1. `/picking` → tab **Batch** → señalar `bt-1`
2. **Decir:** *"En vez de que el picker vaya 2 veces a la misma ubicación para 2 pedidos distintos, el sistema agrupa el pick en un solo viaje y luego reparte las unidades entre los pedidos."*

### Opcional C — Cluster picking (3 min)

**Qué es:** un solo picker recorre una ruta cargando varios contenedores (uno por pedido) y va llenando cada uno a medida que pasa por las ubicaciones — ideal para pedidos pequeños de alto volumen.

**Datos de prueba:** cluster `cl-1` — Paula Vega recorriendo `loc-reserve` → `loc-a0101` → `loc-pickfast1`, 3 pedidos en paralelo (contenedores), estado **En Progreso**.

**Operador activo:** Supervisor

1. `/picking` → tab **Cluster** → señalar `cl-1`
2. **Decir:** *"El picker lleva un carro con 3 canastillas. Cada ubicación que visita, deja producto en la canastilla del pedido correspondiente. Una sola caminata, tres pedidos completos."*

### Opcional D — Picking waveless (2 min)

**Qué es:** para pedidos urgentes o de bajo volumen, la tarea de picking se genera y libera al instante, sin esperar a agrupar una oleada.

**Datos de prueba:** orden waveless `wl-1` — pedido `co-eco-3` (Sofía Rincón), tarea `pt-eco-3` (2 sanducheras), estado **En Progreso**.

**Operador activo:** Supervisor

1. `/picking` → tab **Waveless** → señalar `wl-1`
2. **Decir:** *"Si un pedido no puede esperar la próxima oleada, sale inmediatamente como tarea individual. Útil para same-day o pedidos VIP."*

### Opcional E — Put-to-store (distribución a tiendas) (3 min)

**Qué es:** se hace un pick grande en el centro de distribución y luego se reparte entre varias tiendas destino — típico de reabastecimiento multi-tienda.

**Datos de prueba:** tarea `pts-andino-1` — Licuadora (pedido `co-pts-1`), operario Carlos Ramírez; Tienda Andino ya recibió 3 unidades, Tienda Santa Fe tiene 2 unidades pendientes.

**Operador activo:** Supervisor

1. `/picking` → tab **Put-to-store** → señalar `pts-andino-1`
2. **Decir:** *"Un solo pick grande en el DC, y el sistema distribuye las unidades entre las tiendas que las pidieron — Andino ya recibió su parte, Santa Fe está pendiente."*

### Opcional F — Captura de serial en picking (2 min)

**Qué es:** para productos que se rastrean por número de serie (ej. electrodomésticos grandes), el sistema exige capturar el serial exacto en el momento del pick — no solo la cantidad.

**Datos de prueba:** tarea `PICK-B2B-005` (id `pt-b2b-5`) — Microondas 28L Digital, ubicación `loc-a0101`, requiere serial. Seriales válidos disponibles: `MIC-2026-0002` o `MIC-2026-0003` (`MIC-2026-0001` ya está reservado). Usar cantidad `1` (la tarea pide 2, pero cada registro de serial cubre 1 unidad).

⚠️ No usar el SKU `LC-MIC-006` como serial — es el código de producto, no un serial válido.

**Operador activo:** Picker — Ana Picker

1. `/worker/picking` → abrir `PICK-B2B-005` → escribir serial **`MIC-2026-0002`** → cantidad **`1`** → confirmar
2. **Decir:** *"El sistema no deja avanzar sin el serial correcto. Trazabilidad unidad por unidad, útil para garantías y devoluciones."*

### Opcional G — Etiquetas (`/labels`) (1 min)

**Qué es:** repositorio central de todas las etiquetas generadas — de recepción, caja, ubicación y envío — filtrable por tipo y estado.

**Operador activo:** Supervisor

1. `/labels` → filtrar por tipo **Envío** → mostrar la etiqueta generada en el Paso 6
2. **Decir:** *"Cada etiqueta que el sistema genera queda aquí, reimprimible en cualquier momento — sin depender de que alguien guardó el PDF."*

### Opcional H — Administración (`/admin`) (1 min)

**Qué es:** panel de configuración CRUD para operarios, motivos, transportadores, bodegas, ubicaciones, productos, reglas de empaque y parámetros del sistema (umbrales ABC/XYZ, factores de reposición).

**Operador activo:** Supervisor

1. `/admin` → recorrer tabs rápidamente (Operarios, Transportadores, Reglas de empaque)
2. **Decir:** *"Todo lo que vieron hoy es configurable sin tocar código: nuevas bodegas, reglas de empaque, umbrales de clasificación ABC."*

---

## CIERRE (2 min)

### Resumen de lo demostrado

| Capacidad | ¿Vista? |
|-----------|---------|
| Recepción guiada por ASN con trazabilidad | ✓ |
| QC y putaway con ubicación sugerida | ✓ |
| Picking por oleadas con vistas móviles | ✓ |
| Packing con sugerencia de caja y reglas de manejo | ✓ |
| Rate shopping de carriers en tiempo real | ✓ |
| Gestión de devoluciones con disposición | ✓ |
| Optimización slotting ABC/XYZ | ✓ |
| Reposición automática de pick-faces | ✓ |
| Traslados entre bodegas | Opcional A |
| Batch / Cluster / Waveless / Put-to-store | Opcionales B-E |
| Captura de serial | Opcional F |
| Etiquetas y Administración | Opcionales G-H |

### Frase de cierre

*"Esto es lo que pasa hoy en sus bodegas con Excel y papel: cada movimiento depende de una persona, cada error cuesta tiempo y plata. Con el WMS, cada operario sabe qué hacer, cada movimiento queda registrado, y usted tiene visibilidad en tiempo real desde el celular."*

*"¿Qué proceso de su operación les genera más errores o re-trabajo hoy? Podemos entrar a ese flujo en detalle."*

---

## Guía rápida: qué mostrar según el cliente

| Perfil de cliente | Priorizar |
|---|---|
| DC grande, alto volumen | Flujos 1-3 + Opcional A (Traslados), B (Batch), C (Cluster) |
| Tienda mediana | Flujos 1-3 + Opcional E (Put-to-store), énfasis en vista móvil |
| Pregunta por SAP | `/integrations` → conexión SAP activa; `/load-manifests` → integración de rutas |
| Pregunta por multialmacén | Opcional A (Traslados); en `/inventory` señalar filtro por bodega (Bogotá, Medellín, tiendas) |
| Pregunta por trazabilidad serial/lote | Opcional F (Captura de serial) |
| Pregunta por configurabilidad | Opcional H (Administración) |

## Si hay un problema técnico

- Datos no aparecen: consola JS → `localStorage.clear()` → recargar → re-login
- La demo funciona 100% offline — no depende de APIs externas
