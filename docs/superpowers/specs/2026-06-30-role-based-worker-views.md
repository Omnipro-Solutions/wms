# Role-Based Worker Views — Spec

**Fecha:** 2026-06-30  
**Autor:** Carlos Granados  
**Estado:** Aprobado

---

## Contexto

El WMS actual muestra la misma interfaz desktop a todos los roles. Los operadores de piso (picker, packer, receiver, driver) necesitan vistas táctiles optimizadas para tablet/handheld: flujos guiados paso a paso, botones grandes (≥48px), sin sidebar, sin complejidad administrativa.

El proyecto ya tiene:
- `Operator.role: 'picker' | 'packer' | 'receiver' | 'driver' | 'supervisor'`
- `useCurrentOperator()` con `canDo()` y `isRole()`
- `auth-store.ts` con login por email+password
- `setCurrentOperator()` en wms-store

---

## Enfoque: Rutas paralelas por rol (Opción A)

Nueva sección `src/app/(worker)/` con layout propio. Las rutas desktop `(app)/` quedan intactas para supervisor. Al hacer login, redirect automático según rol.

---

## Estructura de rutas

```
src/app/
├── (app)/                          # existente — supervisor/admin sin cambios
└── (worker)/
    ├── layout.tsx                  # full-screen táctil, sin sidebar
    ├── page.tsx                    # hub: detecta rol → redirect
    ├── picking/
    │   ├── page.tsx                # lista tareas asignadas al picker
    │   └── task/[taskId]/
    │       └── page.tsx            # flujo guiado 4 pasos
    ├── packing/
    │   ├── page.tsx                # cola de órdenes para empacar
    │   └── [orderId]/
    │       └── page.tsx            # flujo guiado 5 pasos
    ├── receiving/
    │   ├── page.tsx                # lista ASNs del día (táctil)
    │   └── [asnId]/
    │       └── page.tsx            # flujo guiado ítem por ítem
    ├── returns/
    │   └── page.tsx                # devoluciones pendientes de inspección
    └── driver/
        ├── page.tsx                # manifiestos + transferencias asignadas
        └── manifest/[id]/
            └── page.tsx            # paradas, confirmar entrega, reportar novedad
```

---

## Redirect por rol

| Rol | Destino login |
|-----|--------------|
| `picker` | `/worker/picking` |
| `packer` | `/worker/packing` |
| `receiver` | `/worker/receiving` |
| `driver` | `/worker/driver` |
| `supervisor` | `/` (dashboard existente) |

Implementado en `src/middleware.ts` leyendo el auth cookie. Si no hay sesión → `/login`.

---

## Worker Layout (`(worker)/layout.tsx`)

- Sin `AppSidebar`, sin `BreadcrumbNav`
- Header mínimo: logo + nombre operador + rol badge + botón "Cambiar operador"
- `OperatorPickerProvider` incluido (mismo que (app)/layout)
- Fondo: `bg-background`, content: `p-4 max-w-lg mx-auto` (centrado en tablet)
- Tipografía base `text-base` (16px mínimo)
- Todos los botones de acción primaria: `h-12` mínimo (48px)

---

## Vista Picker

### `/worker/picking` — Lista de tareas

- Filtra `pickingTasks` donde `assignedOperatorId === currentOperator.id` y `status` en `['pending','assigned','in_progress']`
- Ordena por: prioridad urgente primero → zona → ubicación (ruta optimizada)
- Cada card muestra: zona, código ubicación, nombre producto, cantidad solicitada, wave/batch asociado
- Badge "URGENTE" si la orden padre tiene `priority === 'urgent'`
- CTA principal: "▶ INICIAR SIGUIENTE TAREA" → va a la tarea más prioritaria
- Tap en card individual → `/worker/picking/task/[taskId]`

### `/worker/picking/task/[taskId]` — Flujo guiado

4 pasos secuenciales, sin posibilidad de saltar hacia adelante:

**Paso 1 — Ir a ubicación**
- Muestra zona + código ubicación en tipografía grande
- Input de escaneo de barcode (o confirm manual)
- Valida contra `location.barcode` o `location.code`
- Llama `startPicking(taskId, operator.name)` al confirmar

**Paso 2 — Escanear producto**
- Muestra nombre, SKU, imagen si disponible
- Input escaneo valida contra `product.barcode` o `product.sku`

**Paso 3 — Confirmar cantidad**
- Stepper numérico `[ − ] [ N ] [ + ]`
- Cantidad por defecto: `task.requestedQuantity`
- Si qty < requestedQuantity: muestra modal "¿Confirmar cantidad parcial?"
- Llama `completePick(taskId, qty)` + `approvePart(taskId)` si parcial

**Paso 4 — Done**
- Pantalla de éxito con ícono ✅
- Botones: "← Ver mis tareas" / "Siguiente tarea →" (va directo a siguiente pendiente)

---

## Vista Packer

### `/worker/packing` — Cola de órdenes

- Filtra `packingOrders` con `status === 'pending'`
- Ordena por: urgente primero → ventana de despacho más próxima
- Card: código orden, cantidad ítems, hora despacho, badges de reglas activas (fragile, liquid, heavy…)
- CTA: "▶ INICIAR SIGUIENTE"

### `/worker/packing/[orderId]` — Flujo guiado

5 pasos:

**Paso 1 — Reglas de manejo** (solo si hay reglas activas)
- Lista visual de reglas con íconos y descripción
- Botón "ENTENDIDO, CONTINUAR"
- Llama `applyPackingRule()` por cada regla aplicable

**Paso 2 — Escanear ítems** (loop por ítem esperado)
- Progreso: "Ítem N de M"
- Llama `scanItem(orderId, barcode)`
- Feedback inmediato: ✅ verde correcto / ❌ rojo incorrecto
- Opción "Confirmar manualmente" si escáner falla

**Paso 3 — Seleccionar caja**
- Muestra sugerencia de `suggestBox()` como opción primaria
- Botón "Elegir otra" despliega lista de `packingBoxTypes` disponibles
- Llama `selectBox(orderId, boxTypeId)`

**Paso 4 — Generar etiqueta**
- Resumen: orden, transportadora, destino
- Botón "🖨 GENERAR ETIQUETA" llama `generateLabel(orderId)`

**Paso 5 — Done**
- Llama `sendToShipping(orderId)`
- Botones: "← Ver cola" / "Siguiente →"

---

## Vista Receiver

### Dualidad de contexto

El receiver accede a dos vistas según contexto:

| Contexto | Ruta | Dispositivo |
|----------|------|-------------|
| Muelle (recibir físico) | `/worker/receiving` | Tablet táctil |
| Oficina (planificar) | `/receiving` | Desktop |

Al login redirige a `/worker/receiving`. Botón "🖥 Vista completa" lleva a `/receiving`.

### `/worker/receiving` — Lista ASNs del día

- Filtra ASNs con `status` en `['pending','in_progress']` y fecha = hoy
- Card: código ASN, proveedor, cantidad ítems, hora llegada, status badge
- ASNs `in_progress` aparecen primero

### `/worker/receiving/[asnId]` — Flujo ítem por ítem

**Paso 1 — Resumen ASN**
- Proveedor, total ítems, ítems recibidos hasta ahora
- CTA: "▶ CONTINUAR RECIBIENDO" o "▶ INICIAR RECEPCIÓN"

**Paso 2 — Recibir ítem** (loop por cada línea del ASN)
- Progreso: "Ítem N de M"
- Nombre producto, SKU, lote si aplica
- Stepper cantidad recibida (default: cantidad esperada)
- Campo "¿Dañadas?" (stepper, default 0)
- Botón "RECIBIR ÍTEM" llama `receiveAsn(asnId, qty, operator.name, damagedQty)`
- Opción "Reportar novedad" → modal con tipo de discrepancia + razón

**Paso 3 — QC inline** (si ASN requiere QC: `asn.requiresQualityControl === true`)
- Muestra resumen de lo recibido
- Botones: `[✅ APROBAR QC]` llama `approveQc()` / `[❌ RECHAZAR QC]` llama `rejectQc()`

**Paso 4 — Putaway guiado**
- Por cada ítem recibido que requiere putaway
- Muestra ubicación sugerida (pick-face o reserva según ABC)
- Confirmar ubicación llama `putawayItem(asnId, locationId, operator.name)`

**Paso 5 — Done**
- Resumen: N recibidas, N dañadas, N en QC
- Botón "← Volver a recepciones"

---

## Vista Driver

### `/worker/driver` — Panel principal

Dos secciones:

**Manifiestos asignados al conductor**
- Filtra `loadManifests` donde `assignedDriverId === currentOperator.id`
- Ordena: `dispatched` primero → `pending`
- Card: código manifiesto, ruta, cantidad paradas, hora salida, status

**Transferencias asignadas**
- Filtra `transfers` donde `assignedDriverId === currentOperator.id` y `status === 'in_transit'`
- Card: código, origen → destino, cantidad pallets, status

### `/worker/driver/manifest/[id]` — Detalle manifiesto

Lista de paradas ordenadas por secuencia de ruta:

- Paradas completadas: ✅ con hora de entrega
- Parada actual: destacada, con CTAs
- Paradas pendientes: ○ atenuadas

**CTA parada actual:**
- `[✅ CONFIRMAR ENTREGA]` → actualiza parada como entregada, avanza al siguiente
- `[⚠ REPORTAR NOVEDAD]` → modal con opciones:
  - Bulto faltante
  - Rechazado por cliente  
  - Dirección incorrecta
  - Otro (+ texto libre)

Al completar todas las paradas → llama `closeManifest(manifestId)`.

**Transferencias:** botón `[✅ CONFIRMAR LLEGADA]` llama `advanceTransfer(transferId)`.

### Capacidades del driver

| Puede | No puede |
|-------|----------|
| Ver manifiestos propios | Crear/editar manifiestos |
| Confirmar entrega por parada | Ver picking/packing/receiving |
| Reportar novedad con tipo+texto | Reasignar rutas |
| Confirmar llegada en transferencias | Acceder a admin/reportes |
| Ver historial del día | Gestionar inventario |

---

## Vista Returns (Receiver)

### `/worker/returns` — Devoluciones pendientes

- Accesible solo para `receiver` y `supervisor`
- Filtra `returns` con `status === 'received_at_store'` o `'received_at_dc'`
- Card: código devolución, cliente, producto, motivo
- Tap → flujo de inspección inline (aprobar disposición)

> Scope mínimo: listar y permitir avanzar estado vía `advanceReturn()`. Inspección detallada queda en desktop `/returns`.

---

## Permisos y navegación

### Sidebar desktop filtrado por rol

El supervisor ve todo. Los roles operativos que acceden a desktop (`receiver`) ven solo sus secciones:

| Sección | picker | packer | receiver | driver | supervisor |
|---------|--------|--------|----------|--------|------------|
| Dashboard | ❌ | ❌ | ❌ | ❌ | ✅ |
| Receiving | ❌ | ❌ | ✅ | ❌ | ✅ |
| Inventory | ❌ | ❌ | ✅ | ❌ | ✅ |
| Picking | ❌ | ❌ | ❌ | ❌ | ✅ |
| Packing | ❌ | ❌ | ❌ | ❌ | ✅ |
| Shipping | ❌ | ❌ | ❌ | ✅ | ✅ |
| Load Manifests | ❌ | ❌ | ❌ | ✅ | ✅ |
| Returns | ❌ | ❌ | ✅ | ❌ | ✅ |
| Admin | ❌ | ❌ | ❌ | ❌ | ✅ |

Implementado en `sidebarItems` con campo `allowedRoles?: OperatorRole[]`. `NavMain` filtra según `currentOperator.role`.

### Protección de rutas

`src/middleware.ts` verifica:
1. Cookie de auth → si no hay, redirect a `/login`
2. Rol del operador → si intenta acceder a ruta no permitida, redirect a su ruta worker

---

## Datos nuevos requeridos en tipos

### `LoadManifest` — campo nuevo
```ts
assignedDriverId?: string  // operatorId del conductor asignado
```

### `Transfer` — campo nuevo  
```ts
assignedDriverId?: string  // operatorId del conductor asignado
```

> Estos campos se agregan a `src/types/wms.ts` y al seed con datos de prueba.

---

## Componentes nuevos compartidos

| Componente | Ruta | Propósito |
|------------|------|-----------|
| `WorkerHeader` | `components/worker/worker-header.tsx` | Avatar + nombre + rol + botón cambiar |
| `WorkerCard` | `components/worker/worker-card.tsx` | Card táctil grande con flecha → |
| `WorkerStepper` | `components/worker/worker-stepper.tsx` | Indicador de pasos (1 de 4) |
| `ScanInput` | `components/worker/scan-input.tsx` | Input con ícono barcode, autofocus, feedback visual |
| `QuantityStepper` | `components/worker/quantity-stepper.tsx` | − / N / + con límites min/max |

---

## Seed de datos

Agregar a `data/seed.ts`:
- `assignedDriverId` en 2-3 manifiestos existentes apuntando a operador con `role: 'driver'`
- `assignedDriverId` en 1-2 transferencias existentes
- Operadores de prueba con email+password para cada rol (para demo login)

---

## Lo que NO entra en este sprint

- Firma digital / foto de entrega (driver)
- GPS tracking
- Push notifications
- Modo offline / PWA
- Scanner de cámara nativa (solo input de texto simulando barcode reader)
- Dashboard de supervisión en tiempo real

---

## Archivos a crear/modificar

### Nuevos
- `src/app/(worker)/layout.tsx`
- `src/app/(worker)/page.tsx`
- `src/app/(worker)/picking/page.tsx`
- `src/app/(worker)/picking/task/[taskId]/page.tsx`
- `src/app/(worker)/packing/page.tsx`
- `src/app/(worker)/packing/[orderId]/page.tsx`
- `src/app/(worker)/receiving/page.tsx`
- `src/app/(worker)/receiving/[asnId]/page.tsx`
- `src/app/(worker)/returns/page.tsx`
- `src/app/(worker)/driver/page.tsx`
- `src/app/(worker)/driver/manifest/[id]/page.tsx`
- `src/components/worker/worker-header.tsx`
- `src/components/worker/worker-card.tsx`
- `src/components/worker/worker-stepper.tsx`
- `src/components/worker/scan-input.tsx`
- `src/components/worker/quantity-stepper.tsx`

### Modificados
- `src/types/wms.ts` — `assignedDriverId` en `LoadManifest` y `Transfer`
- `src/data/seed.ts` — datos demo por rol
- `src/middleware.ts` — redirect por rol
- `src/components/navigation/sidebar/sidebar-items.ts` — `allowedRoles` por item
- `src/components/sidebar/nav-main.tsx` — filtrar por `currentOperator.role`
