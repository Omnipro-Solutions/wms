# Guión de Demo WMS — 30 minutos

> **Audiencia:** Centros de distribución y tiendas medianas/grandes en Colombia  
> **Duración:** 30 minutos  
> **Presentador:** Carlos Granados

---

## Credenciales de acceso

| Rol | Email | Contraseña | URL de entrada |
|-----|-------|-----------|----------------|
| Supervisor | carlos.granados@wms.co | WMS2024 | `http://localhost:3000/` |
| Receiver | receiver@demo.com | 123456 | `http://localhost:3000/worker` |
| Picker | picker@demo.com | 123456 | `http://localhost:3000/worker` |
| Packer | packer@demo.com | 123456 | `http://localhost:3000/worker` |
| Driver | driver@demo.com | 123456 | `http://localhost:3000/worker` |

---

## Preparación (5 min antes — no frente al cliente)

1. Abrir el browser → ir a `http://localhost:3000/auth/login`
2. Iniciar sesión con **supervisor**: `carlos.granados@wms.co` / `WMS2024`
3. Abrir DevTools → F12 → icono de móvil (modo responsive) → seleccionar "iPhone 12 Pro" o similar
4. En la pestaña móvil ir a `http://localhost:3000/auth/login` → iniciar sesión como **receiver**: `receiver@demo.com` / `123456`
5. Si los datos demo no aparecen: abrir consola JS → escribir `localStorage.clear()` → Enter → recargar la página → volver a iniciar sesión
6. Tener este guión en segunda pantalla o impreso

> **Tip:** El botón 👥 en el header móvil y "Cambiar operador" en el menú del avatar (vista desktop) abren el mismo selector — incluye supervisor. Úsalo para cambiar entre cualquier rol sin manejar pestañas separadas del navegador.

---

## INTRO (1 min)

**Decir:** *"Les voy a mostrar cómo funciona el WMS en un día típico de operación: una mercancía llega, se procesa una venta, y se gestiona una devolución. Todo con trazabilidad completa, sin papel y sin Excel."*

Mostrar el dashboard (`/`) al supervisor:
- Señalar los KPIs: órdenes pendientes, OTIF, alertas críticas
- **Decir:** *"Esta es la vista del supervisor. En tiempo real ve el estado de toda la operación."*

---

## FLUJO 1 — Inbound: Llegada de mercancía (8 min)

**Historia:** *"Un camión de Distribuidora Demo acaba de llegar con 15 microondas."*

### Paso 1 — Supervisor ve el ASN (1 min)
**Vista:** Desktop — supervisor

1. Click en **Recepción** en el menú lateral
2. Señalar el tab **Citas ASN**
3. Señalar `ASN-DEMO-001` en estado **Pendiente**
4. Click en `ASN-DEMO-001` → mostrar el detalle con el stepper de estado
5. **Decir:** *"El supervisor ve qué espera recibir, de qué proveedor, y cuánto. La orden ya viene del ERP."*

### Paso 2 — Receiver recibe las cajas (4 min)
**Vista:** Móvil — receiver@demo.com

1. En la vista móvil, ya iniciado como receiver, ir a `/worker`
2. Señalar la tarjeta **Recepciones** → click
3. Señalar `ASN-DEMO-001` en la lista
4. Click en `ASN-DEMO-001`
5. Registrar cantidad recibida: escribir `10` en el campo → confirmar
6. **Decir:** *"El operario en el muelle escanea o digita la cantidad. El sistema valida contra la orden de compra en tiempo real."*

### Paso 3 — Supervisor aprueba QC y Putaway (3 min)
**Vista:** Desktop — supervisor

1. Volver a `/receiving`
2. Click en tab **Cola QC** → mostrar que el ítem aparece para revisión
3. Aprobar calidad → Click **Aprobar QC**
4. Click en tab **Putaway staging**
5. Señalar la ubicación sugerida por el sistema (Zona A)
6. **Decir:** *"El sistema sugiere la ubicación óptima basado en la clasificación ABC del producto. Los productos de alta rotación van a zona dorada."*
7. Confirmar putaway
8. Ir a `/inventory` → buscar "Microondas" → mostrar stock actualizado
9. **Decir:** *"Desde el muelle hasta el estante — trazabilidad completa en tiempo real."*

**Pausa de transición:** *"Ahora veamos cómo sale esa mercancía: una venta de ecommerce."*

---

## FLUJO 2 — Outbound: Picking → Packing → Despacho (14 min)

**Historia:** *"Llegaron 3 órdenes de ecommerce esta mañana. El supervisor las agrupa y el equipo las despacha en menos de una hora."*

### Paso 4 — Supervisor ve las órdenes y la oleada (2 min)
**Vista:** Desktop — supervisor

1. Click en **Commerce** en el menú lateral
2. Señalar las 3 órdenes demo: `PED-DEMO-001`, `PED-DEMO-002`, `PED-DEMO-003` — estado: pendiente
3. **Decir:** *"El sistema centraliza todos los canales: ecommerce, marketplace, B2B. Todo en un panel."*
4. Click en **Picking** → tab **Oleadas**
5. Señalar `WAVE-DEMO-001` en estado **En Progreso**, asignada a Ana Picker
6. **Decir:** *"El supervisor crea la oleada, asigna al equipo, y libera. El operario recibe las tareas en su celular."*

### Paso 5 — Picker recoge los ítems (5 min)
**Vista:** Móvil — picker@demo.com

1. En la vista móvil: click en el botón 👥 (ícono de usuarios) en el header
2. En el dialog, seleccionar **Picker — Ana Picker**
3. Esperar que cargue → mostrar pantalla de inicio del picker
4. Click en **Picking** → señalar las 3 tareas asignadas
5. **Decir:** *"El picker ve exactamente a dónde ir: ubicación, producto, cantidad. Sin papel, sin confusión."*
6. Click en la primera tarea (`PICK-DEMO-001`) → Cafetera en ubicación `loc-pickfast1`
7. Completar el pick → escribir cantidad `2` → confirmar
8. Mostrar que la tarea cambia a **Completado**
9. Click en la segunda tarea (`PICK-DEMO-002`) → Sanduchera → completar
10. **Decir:** *"El sistema optimiza la ruta de picking. Cada tarea lleva al operario al siguiente punto más cercano."*

### Paso 6 — Packer empaca y genera etiqueta (4 min)
**Vista:** Móvil — packer@demo.com

1. Click en el botón 👥 en el header
2. Seleccionar **Empacador — Pedro Packer**
3. Click en **Packing** → señalar `PED-DEMO-001` en estado pendiente
4. Click en la orden → mostrar la pantalla de verificación de ítems
5. Escanear/confirmar ítem 1 (Cafetera × 2) → verificación OK ✓
6. Mostrar el mensaje de sugerencia de caja: **Caja S** (calculada por peso y volumen)
7. Confirmar selección de caja → click **Generar Etiqueta**
8. Mostrar el código de despacho generado
9. **Decir:** *"El sistema sugiere la caja correcta, detecta si el producto necesita manejo especial — frágil, cadena de frío, alto valor — y genera la etiqueta automáticamente. Cero errores humanos."*

### Paso 7 — Rate shopping y despacho (3 min)
**Vista:** Desktop — supervisor + Móvil — driver@demo.com

1. Desktop → `/shipping` → mostrar tabla de tarifas por carrier
2. **Decir:** *"El sistema cotiza en tiempo real con todos los carriers y selecciona el más económico dentro del SLA comprometido."*
3. Desktop → `/load-manifests` → mostrar el manifiesto de carga con las órdenes
4. **Decir:** *"El manifiesto se genera automáticamente. Se integra con SAP para las rutas."*
5. Móvil → click en 👥 → seleccionar **Conductor — Carlos Driver**
6. Señalar el manifiesto asignado al conductor
7. **Decir:** *"El conductor ve su ruta en el celular, confirma el despacho, y el sistema actualiza el OTIF automáticamente."*

**Pausa de transición:** *"¿Y qué pasa cuando un cliente devuelve algo? Veamos."*

---

## FLUJO 3 — Devoluciones + Optimización de Inventario (8 min)

**Historia:** *"La Tienda Santa Fe devuelve 3 sanducheras. El sistema decide qué hacer con ellas y optimiza el inventario."*

### Paso 8 — Receiver recibe la devolución (2 min)
**Vista:** Móvil — receiver@demo.com

1. Móvil → click en 👥 → seleccionar **Recepcionista — María Recepcionista**
2. Click en **Devoluciones** → señalar `RMA-DEMO-001` de Tienda Santa Fe
3. Click en la devolución → mostrar el formulario de inspección
4. Registrar condición: **Bueno** → confirmar recepción
5. **Decir:** *"El receiver inspecciona en el momento — condición, cantidades. Sin papel. El resultado queda en el sistema."*

### Paso 9 — Supervisor gestiona la disposición (3 min)
**Vista:** Desktop — supervisor

1. Desktop → `/returns`
2. Señalar `RMA-DEMO-001` en estado **Recibido en DC**
3. Click en la devolución → mostrar el panel de disposición
4. Señalar las opciones: **Reingreso**, **Scrap**, **Reparación**, **Control de Calidad**
5. Seleccionar **Reingreso a inventario** → confirmar
6. Ir a `/inventory` → buscar "Sanduchera" → mostrar que el stock aumentó
7. **Decir:** *"Cada devolución tiene un flujo. El sistema sabe si el producto vuelve al inventario, va a reparación, o se da de baja. Trazabilidad de punta a punta."*

### Paso 10 — Slotting: el sistema optimiza solo (3 min)
**Vista:** Desktop — supervisor

1. Click en **Slotting** en el menú lateral
2. Señalar tab **Recomendaciones** → lista de productos con score alto
3. **Decir:** *"El sistema analiza la frecuencia de picking y la variabilidad de demanda. Les dice exactamente qué mover y cuánto tiempo y distancia ahorran."*
4. Señalar tab **Matriz ABC/XYZ** → mostrar clasificación de productos
5. **Decir:** *"Los productos A-X son los de mayor rotación y demanda estable. Deben estar en zona dorada — cerca del despacho."*
6. Señalar tab **Necesidades de Reposición** → pick-faces bajo mínimo
7. **Decir:** *"Antes de que se agote, el sistema ya generó la tarea de reposición. Nunca más un picker llega a una ubicación vacía."*

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

### Frase de cierre

*"Esto es lo que pasa hoy en sus bodegas con Excel y papel: cada movimiento depende de una persona, cada error cuesta tiempo y plata. Con el WMS, cada operario sabe qué hacer, cada movimiento queda registrado, y usted tiene visibilidad en tiempo real desde el celular."*

*"¿Qué proceso de su operación les genera más errores o re-trabajo hoy? Podemos entrar a ese flujo en detalle."*

---

## Notas para el presentador

**Si el cliente es DC grande (alto volumen):**
- Enfatizar picking por oleadas, batch picking, slotting, y manifiesto de carga
- Mostrar `/picking` tab **Batch** — consolida picks del mismo producto de múltiples órdenes

**Si el cliente es tienda mediana:**
- Enfatizar la vista móvil, devoluciones store-to-DC, y reposición automática
- Mostrar que el supervisor puede operar desde el celular también

**Si preguntan por SAP:**
- Mostrar `/integrations` → conexión SAP activa
- Mostrar `/load-manifests` → integración de rutas SAP

**Si preguntan por multialmacén:**
- En `/inventory` señalar el filtro por warehouse: Bogotá, Medellín, tiendas
- Decir: *"El sistema gestiona todos los almacenes desde una sola pantalla. Traslados entre bodegas incluidos."*

**Si hay un problema técnico:**
- Si los datos no aparecen: consola JS → `localStorage.clear()` → recargar → re-login
- La demo funciona 100% offline — no depende de APIs externas
