# Guión de Demo WMS — 30 minutos

> **Audiencia:** Centros de distribución y tiendas medianas/grandes en Colombia  
> **Duración:** 30 minutos  
> **Fecha:** 2026-06-30  

---

## Credenciales de acceso

| Rol | Email | Contraseña | Vista |
|-----|-------|-----------|-------|
| Supervisor | carlos.granados@wms.co | WMS2024 | Desktop `/` |
| Receiver | receiver@demo.com | 1234 | Móvil `/worker` |
| Picker | picker@demo.com | 1234 | Móvil `/worker` |
| Packer | packer@demo.com | 1234 | Móvil `/worker` |
| Driver | driver@demo.com | 1234 | Móvil `/worker` |

---

## Preparación (antes de la demo)

1. Abrir dos ventanas del browser: una desktop (supervisor), una móvil (operario — F12 → modo móvil o celular real)
2. Login supervisor en desktop
3. Login receiver en móvil
4. Tener el guión impreso o en segunda pantalla

---

## Flujo 1: Inbound — Llegada de mercancía (8 min)

**Historia:** "Un camión de Distribuidora Demo S.A. acaba de llegar con 15 microondas. El sistema guía a todo el equipo."

### 1.1 Supervisor — Vista general de recepciones (1 min)
- URL: `/receiving`
- Mostrar tab **Citas ASN** → señalar `ASN-DEMO-001` en estado `En Progreso`
- Decir: *"El supervisor ve en tiempo real cuánto se ha recibido: 5 de 15 unidades."*
- Hacer click en `ASN-DEMO-001` → mostrar detalle con el stepper de estado

### 1.2 Receiver (móvil) — Recibir cajas (4 min)
- URL: `/worker` → login como receiver@demo.com
- Mostrar pantalla de **Recepciones activas** → señalar `ASN-DEMO-001`
- Click → mostrar formulario de recepción
- Registrar 5 unidades más → confirmar recepción
- Decir: *"El operario en el muelle escanea o digita la cantidad. El sistema valida contra la orden de compra."*

### 1.3 Supervisor — QC y Putaway (3 min)
- Volver a desktop → `/receiving`
- Mostrar tab **Cola QC** si `requiresQualityControl: true`, o tab **Putaway staging**
- Mostrar la ubicación sugerida: `loc-a0101` (Zona A)
- Decir: *"El sistema sugiere la ubicación óptima basado en la clasificación ABC del producto."*
- Aprobar putaway → mostrar inventario actualizado en `/inventory`

**Punto clave a comunicar:** *"Desde el muelle hasta el estante, trazabilidad completa en tiempo real."*

---

## Flujo 2: Outbound — Picking → Packing → Despacho (14 min)

**Historia:** "Llegaron 3 órdenes de ecommerce esta mañana. El supervisor las agrupa en una oleada y el equipo las despacha en menos de una hora."

### 2.1 Supervisor — Crear y liberar wave (2 min)
- URL: `/commerce` → mostrar órdenes `PED-DEMO-001`, `PED-DEMO-002`, `PED-DEMO-003` en estado `Listo para picking`
- Decir: *"El sistema tiene 3 canales: ecommerce, marketplace y B2B. Todos en un solo panel."*
- URL: `/picking` → tab **Oleadas** → señalar `WAVE-DEMO-001` ya liberada (`En Progreso`)
- Decir: *"El supervisor agrupa las órdenes por zona, las libera, y el sistema asigna al operario."*

### 2.2 Picker (móvil) — Completar picks (5 min)
- Cambiar móvil a picker@demo.com
- URL: `/worker/picking` → mostrar lista de 3 tareas asignadas a Ana Picker
- Decir: *"El picker ve exactamente dónde ir: ubicación, producto, cantidad. Sin papel."*
- Click en `PICK-DEMO-001` → cafetera en `loc-pickfast1` → completar pick (qty: 2)
- Mostrar que la tarea pasa a `Completado` en tiempo real
- Click en `PICK-DEMO-002` → sanduchera en `loc-a0101` → completar
- Decir: *"El sistema optimiza la ruta de picking. El operario siempre sabe qué viene después."*

### 2.3 Packer (móvil) — Empacar y etiquetar (4 min)
- Cambiar móvil a packer@demo.com
- URL: `/worker/packing` → mostrar `PED-DEMO-001` pendiente
- Click → mostrar pantalla de escaneo de ítems
- Escanear/confirmar los 2 ítems → verificación OK ✓
- Mostrar sugerencia de caja: **Caja S** (calculada por peso y volumen)
- Generar etiqueta → mostrar código de despacho
- Decir: *"El sistema sugiere la caja correcta, aplica reglas de manejo especial (frágil, cadena de frío) y genera la etiqueta automáticamente."*

### 2.4 Supervisor — Rate shopping y despacho (3 min)
- Desktop → `/shipping` → mostrar comparación de tarifas por carrier
- Decir: *"El sistema cotiza en tiempo real con todos los carriers y selecciona el más económico dentro del SLA."*
- Desktop → `/load-manifests` → mostrar manifiesto de carga
- Cambiar móvil a driver@demo.com → `/worker/driver` → mostrar manifiesto asignado
- Decir: *"El conductor ve su ruta, confirma el despacho, y el cliente recibe notificación automática."*

**Punto clave a comunicar:** *"De la orden al camión en menos de 60 minutos. Sin Excel, sin papel, sin re-digitación."*

---

## Flujo 3: Devoluciones + Optimización de slotting (8 min)

**Historia:** "La Tienda Santa Fe devuelve 3 sanducheras. El sistema decide qué hacer y optimiza el inventario."

### 3.1 Receiver (móvil) — Recibir devolución (2 min)
- Móvil → receiver@demo.com → `/worker/returns`
- Mostrar `RMA-DEMO-001` — devolución de Tienda Santa Fe
- Click → registrar inspección: condición, fotos (si aplica)
- Decir: *"El receiver inspecciona en el momento. No hay papel. El resultado va directo al sistema."*

### 3.2 Supervisor — Disposición y trazabilidad (3 min)
- Desktop → `/returns` → mostrar `RMA-DEMO-001` en estado `Recibido en DC`
- Seleccionar disposición: **Reingreso a inventario** (restock)
- Confirmar → mostrar cómo el inventario se actualiza en `/inventory`
- Señalar otras disposiciones: Scrap, Reparación, Control de Calidad
- Decir: *"Cada devolución tiene un flujo trazado. El sistema sabe si el producto vuelve al inventario, va a reparación, o se da de baja."*

### 3.3 Supervisor — Slotting y optimización (3 min)
- Desktop → `/slotting`
- Mostrar tab **Recomendaciones** → lista de productos con score > 70
- Señalar el mapa ABC/XYZ: productos A-X van a zona dorada
- Decir: *"El sistema analiza la frecuencia de picking y la variabilidad de demanda. Nos dice exactamente qué mover y cuánto tiempo ahorramos."*
- Mostrar **Necesidades de reposición** → pick-faces bajo mínimo
- Decir: *"Antes de que se agote, el sistema ya generó la tarea de reposición."*

**Punto clave a comunicar:** *"Las devoluciones no son un problema — son inventario. Y el sistema siempre sabe dónde está cada unidad."*

---

## Cierre (2 min)

### Resumen de capacidades mostradas
| Capacidad | Demostrada |
|-----------|-----------|
| Recepción guiada por ASN | ✓ |
| QC y putaway sugerido | ✓ |
| Picking por oleadas | ✓ |
| Vistas móviles por rol | ✓ |
| Packing con sugerencia de caja | ✓ |
| Rate shopping de carriers | ✓ |
| Devoluciones con disposición | ✓ |
| Optimización slotting ABC/XYZ | ✓ |
| Trazabilidad completa | ✓ |

### Frases de cierre
- *"Esto es lo que pasa hoy en sus bodegas con Excel y papel. Con el WMS, cada movimiento queda registrado, cada operario sabe qué hacer, y usted tiene visibilidad en tiempo real."*
- *"¿Qué proceso de su operación le genera más errores hoy? Podemos profundizar en ese flujo."*

---

## Notas para el presentador

- Si el cliente es DC grande: enfatizar picking por oleadas, slotting, y manifiesto de carga
- Si el cliente es tienda mediana: enfatizar la vista móvil, devoluciones, y reposición automática
- Si preguntan por SAP: mostrar `/integrations` → conexión SAP activa, y `/load-manifests` → integración de rutas
- Si preguntan por multialmacén: señalar en `/inventory` el filtro por warehouse (Bogotá, Medellín, tiendas)
- La demo funciona 100% offline — todos los datos son locales, no depende de APIs externas
