# WMS — Documento de Funcionalidades

## Visión General

Sistema de gestión de almacén (WMS) construido con Next.js + TypeScript + Zustand. UI en español, orientado a operaciones de bodega en Colombia. Cubre el ciclo completo: recepción → inventario → picking → empaque → despacho.

---

## Navegación Principal (Sidebar)

El sidebar agrupa las páginas en 5 secciones:

| Sección | Páginas |
|---------|---------|
| **General** | Dashboard |
| **Entrada** | Recepción, Inventario, Slotting, Abastecimiento |
| **Operación** | Traslados, Devoluciones, Commerce, Picking Tasks, Oleadas, Packing, Etiquetas |
| **Despacho** | Shipping, Rutas SAP, Manifiestos |
| **Sistema** | Integraciones, Reportes, Administración |

---

## Páginas y Funcionalidades

### Dashboard (`/`)

- 11 KPI cards: pedidos pendientes, en picking, tareas parciales, oleadas activas, recepciones pendientes, devoluciones, inventario en hold, rutas activas, OTIF %, SKUs mal ubicados, alertas críticas
- Tabla de últimos 5 pedidos
- Card de salud del slotting (top 4 recomendaciones de relocalización)
- Card de rutas SAP y salud de integraciones

---

### Recepción — ASNs (`/receiving`)

- Tabla de ASNs con código, proveedor, producto, clase ABC, fecha de cita, cantidad esperada/recibida, estado, flags (QC, cross-docking)
- **Recibir:** ingresa cantidad recibida, actualiza estado pending → partial → completed, mueve stock a staging/QC
- **Putaway:** sugiere ubicación según clase ABC, mueve inventario de staging a ubicación definitiva

---

### Inventario (`/inventory`)

- Métricas: total on-hand, disponible, en hold
- Tabla de posiciones por producto + ubicación con clase ABC, lote/serial, on-hand, reservado, hold, disponible
- Acciones: **Hold** (bloquea picking), **Release** (libera hold), **Ajuste** (corrección de conteo físico)

---

### Slotting (`/slotting`)

- Métricas: SKUs clase A mal ubicados, oportunidades de relocalización, ahorro total de distancia
- Tabla ABC/XYZ live con frecuencia de picking, estado en golden zone
- Tabla de recomendaciones con score 0–100, ahorro en metros y segundos
- **Reubicar:** ejecuta movimiento a la ubicación sugerida, registra movimiento de putaway

**Lógica:**
- ABC basado en % acumulado de ventas
- XYZ basado en coeficiente de variación de demanda
- Golden zone = altura cintura-hombro, cerca de despacho

---

### Abastecimiento (`/replenishment`)

- Métricas: tareas alta prioridad, pendientes, completadas
- Tabla de tareas con producto, origen/destino, stock actual vs. mínimo/máximo, barra de nivel
- **Asignar:** asigna operario a tarea
- **Completar:** mueve cantidad sugerida de reserva a pick face

---

### Traslados (`/transfers`)

- Métricas: en tránsito, pendientes, completados
- Tabla con código, tipo (DC→Tienda, Tienda→Tienda, etc.), origen, destino, líneas, ETA, estado
- Flujo: Draft → Pending → In Progress → In Transit → Completed (con cancelación disponible)
- Vista expandible de líneas por traslado

---

### Devoluciones (`/returns`)

- **11 estados** con bifurcaciones por disposición (restock, scrap, QC, reparación, rechazado)
- Tabla con RMA, cliente, tipo, origen, destino, disposición, razón, estado
- Tipos: Cliente→Tienda, Cliente/Tienda→DC, Tienda→Tienda, DC→Proveedor

**Flujo:**
```
Requested → Received at store → In transit to DC → Received at DC
→ Under validation → (branch por disposición) → Closed
```

---

### Commerce / Pedidos (`/commerce`)

- Métricas: pedidos pendientes reserva, en operación, completados
- Tabla con pedido, cliente, canal, tipo de fulfillment, líneas, fecha prometida, estado
- Canales: Ecommerce, Marketplace, POS, B2B, App
- Fulfillment: Ship from DC, Ship from Store, Pickup in Store, Put to Store, Cross-docking
- **Reservar inventario:** reserva stock disponible, genera tareas de picking por línea

---

### Picking Tasks (`/picking/tasks`)

- **9 estados** por tarea
- Tabla con código, producto, ubicación, prioridad, qty solicitada/pickeada, progreso %, operario
- **Asignar → Iniciar → Registrar picking:** input de cantidad pickeada; si parcial, requiere razón
- Aprobación/rechazo de pickings parciales por supervisor
- Actualiza inventario (deduce on-hand y reservado), registra movimiento

---

### Oleadas de Picking (`/picking/waves`)

- Métricas: oleadas activas, en borrador, total unidades
- Agrupación por: Zona, Ruta, Prioridad, Carrier, Ventana de despacho, Tipo de fulfillment
- **Liberar oleada:** activa las tareas de picking asociadas
- Vista expandible de pedidos por oleada

---

### Packing (`/packing`)

- Métricas: pendientes verificación, verificados, discrepancias
- Tabla con pedido, ítems esperados/escaneados, progreso %, caja sugerida, peso, estado de verificación, etiqueta generada
- **Verificar:** ingresa ítems escaneados; auto-detecta discrepancia; genera etiqueta de envío si OK

---

### Etiquetas (`/labels`)

- Métricas: total, generadas, pendientes
- Tipos: Producto, Ubicación, Caja, Pallet, Envío, Devolución
- Cards por tipo con conteo rápido
- Acciones: **Generar** (pending → completed), **Reimprimir** (completed)

---

### Shipping (`/shipping`)

- Métricas: OTIF %, en tránsito, pendientes despacho
- Tabla con pedido, cliente, carrier, ruta SAP, paquetes, peso, tracking, estado OTIF (on time / at risk / late)
- **Despachar:** genera número de tracking, cambia estado a in_transit, registra fecha de envío

---

### Rutas SAP (`/sap-routes`)

- Métricas: rutas en tránsito, sincronizadas, carga total activa (kg)
- Tabla con código, nombre, origen, destinos, carrier, conductor/placa, fecha, barra de carga (verde/ámbar/rojo), estado

---

### Manifiestos (`/load-manifests`)

- Métricas: manifiestos activos, total unidades, peso total
- Tabla con código, fecha, ruta SAP, carrier, conductor, placa, paradas, paquetes, peso, volumen, estado
- **Detalle expandible por parada:** secuencia, destino, pedidos/traslados/devoluciones en esa parada, ciudad

---

### Integraciones (`/integrations`)

- Tipos: SAP ERP, Ecommerce, Marketplace, Carrier, ERP, OMS, POS, Proveedor
- Estados: Activa, Inactiva, Error, Pendiente configuración
- Cards con mensajes procesados, último sync, último error
- Acciones: Sincronizar, Retry, Configurar
- Banner de alertas para integraciones con error

---

### Reportes (`/reports`)

KPI strip: picks completados, discrepancias activas, OTIF global %, movimientos totales. Todos los reportes exportan a **CSV**.

| Reporte | Columnas clave |
|---------|---------------|
| Productividad por operario | Operario, picks, unidades, parciales, issues, eficiencia % |
| Discrepancias (recepción + picking) | Tipo, referencia, esperado, real, diferencia |
| Inventario por bodega | Bodega, SKUs, on-hand, reservado, hold, disponible |
| Movimientos de stock (últimos 20) | Tipo, producto, qty, referencia, operario, fecha |
| OTIF detallado | Cliente, carrier, estado OTIF, fecha envío, paquetes, peso |

---

### Administración (`/admin`)

7 tabs de configuración maestra:

| Tab | Gestiona |
|-----|---------|
| Operarios | Código, nombre, rol (Picker/Packer/Receiver/Driver/Supervisor), activo |
| Razones | Códigos de razón por contexto (devolución, picking parcial, ajuste, scrap, hold) |
| Carriers | Transportadoras |
| Bodegas | Centros de distribución y tiendas |
| Ubicaciones | Zonas, tipos, golden zone flag, score de accesibilidad, capacidad, distancia a despacho |
| Productos | SKU, barcode, peso, volumen, método de trazabilidad (ninguno/lote/serial) |
| Configuración | Umbrales ABC/XYZ, factor prioridad reabastecimiento, latencia simulada |

---

## Flujos Principales

```
Recepción:   ASN → Recibir (staging) → Putaway (ubicación definitiva)

Pedido:      Commerce → Reservar → Picking Tasks → Wave → Pick → Packing → Etiqueta → Shipping

Reabasto:    Stock < mínimo → Tarea creada → Asignar → Mover reserva a pick face

Devolución:  RMA creado → Tienda → Tránsito → DC → Validación → (branch disposición) → Cerrado
```

---

## Reglas de Negocio Clave

| Regla | Detalle |
|-------|---------|
| **Disponible** | On-hand − Reservado − Hold |
| **OTIF** | % envíos "on_time" vs. fecha prometida |
| **Prioridad reabasto** | Alta si stock < factor × stock mínimo |
| **Score slotting** | Mayor para productos A/X, menor para C/Z |
| **Picking** | 9 estados; parciales requieren aprobación supervisor |
| **Devoluciones** | 11 estados con bifurcación por disposición |

---

## Resumen

- **18 páginas** distribuidas en 5 secciones
- **~20 entidades de dominio** (ASN, InventoryItem, CommerceOrder, PickingTask, WmsLabel, Shipment, SapRoute, etc.)
- Estado centralizado en un **store Zustand** con selectores computados
- UI 100% en español, orientada a operaciones de bodega
