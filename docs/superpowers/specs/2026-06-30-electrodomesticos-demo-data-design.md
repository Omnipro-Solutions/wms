# Spec: Demo Data — Distribuidor Electrodomésticos

**Fecha:** 2026-06-30  
**Estado:** Aprobado para implementación  
**Archivo objetivo:** `src/data/seed.ts` (edición in-place, reemplazo de contenido)

---

## Objetivo

Reemplazar el catálogo de ropa con productos reales de un distribuidor de electrodomésticos colombiano. Generar flujos de picking multi-zona con ruteo y cuatro flujos de cliente completos para uso en demo.

---

## Bloque 1 — Productos (12 SKUs)

Reemplazan completamente el array `products[]` y todos los arrays que referencian IDs de productos (`inventoryItems`, `demandStats`, `stockMovements`, `purchaseOrders`, `asns`, `commerceOrders`, `pickingTasks`, `packingOrders`, `shipments`, `loadManifests`, `returnOrders`, etc.).

### Catálogo

| ID | SKU | Nombre | Categoría | Peso (kg) | Volumen (m³) | trackBy | ABC esperado |
|----|-----|--------|-----------|-----------|--------------|---------|--------------|
| `p-nevera` | `LB-NEV-001` | Nevera No Frost 320L | Línea Blanca | 68 | 0.55 | serial | A |
| `p-lavadora` | `LB-LAV-002` | Lavadora Carga Frontal 12kg | Línea Blanca | 72 | 0.48 | serial | A |
| `p-lavaplatos` | `LB-LVP-003` | Lavaplatos 12 Puestos | Línea Blanca | 45 | 0.38 | serial | B |
| `p-secadora` | `LB-SEC-004` | Secadora de Ropa 10kg | Línea Blanca | 40 | 0.35 | serial | B |
| `p-estufa` | `LC-EST-005` | Estufa 4 Puestos Gas | Línea Cocina | 35 | 0.28 | serial | A |
| `p-microondas` | `LC-MIC-006` | Microondas 28L Digital | Línea Cocina | 12 | 0.06 | serial | B |
| `p-extractor` | `LC-EXT-007` | Extractor de Cocina 60cm | Línea Cocina | 8 | 0.05 | lot | C |
| `p-licuadora` | `PE-LIC-008` | Licuadora Industrial 2L | Pequeños | 2.8 | 0.008 | none | B |
| `p-batidora` | `PE-BAT-009` | Batidora de Pedestal 5L | Pequeños | 3.2 | 0.009 | none | C |
| `p-cafetera` | `PE-CAF-010` | Cafetera Espresso Automática | Pequeños | 2.1 | 0.007 | none | B |
| `p-sanduchera` | `PE-SAN-011` | Sanduchera Grill 1200W | Pequeños | 1.4 | 0.004 | none | C |
| `p-plancha` | `PE-PLA-012` | Plancha a Vapor 2800W | Pequeños | 1.8 | 0.005 | lot | C |

### Reglas de almacenamiento
- Línea blanca (nevera, lavadora): zona reserva (pallet/granel), minStock 2, maxStock 20
- Línea cocina grande (estufa): zona reserva, minStock 3, maxStock 15
- Línea cocina pequeña + pequeños: zona pick-face, minStock 5, maxStock 50
- Todos los `serial`-tracked: trackBy `serial`, un registro de inventario por unidad
- `extractor`, `plancha`: trackBy `lot` (lote de importación)

### DemandStats (para ABC/XYZ)
Diseñados para que el selector `abcByProduct` clasifique:
- **A (≥80% acumulado):** nevera (320 picks/mes), estufa (280), lavadora (210)
- **B (80–95%):** microondas (150), lavaplatos (110), licuadora (95), cafetera (80)
- **C (<5%):** secadora (45), extractor (30), batidora (25), sanduchera (18), plancha (15)

XYZ: nevera/estufa/lavadora → X (CV < 0.5, demanda estable). Extractor/plancha → Z (CV > 1.0, irregular).

---

## Bloque 2 — Picking multi-zona con ruteo

### Configuración de zonas del CEDI Bogotá

Las ubicaciones existentes (`loc-a0101`, `loc-b0204`, etc.) se reasignan a productos de electrodomésticos. Se añaden dos ubicaciones de staging adicionales para línea blanca (`loc-stg-lb1`, `loc-stg-lb2`) si no existen slots de pallet en el seed actual.

### Waves de picking

| ID | Nombre | Zona almacén | Agrupado por | Órdenes | Estado |
|----|--------|-------------|-------------|---------|--------|
| `wv-1` | Oleada mañana — Línea Blanca | A | fulfillment_type (b2b) | 2 B2B grandes | in_progress |
| `wv-2` | Oleada ecommerce pequeños | B | channel (ecommerce) | 3 ecommerce | draft |
| `wv-3` | Reposición Tienda Andino | S (staging) | fulfillment_type (put_to_store) | 1 put-to-store | released |

### Rutas de camiones (LoadManifests)

| ID | Nombre | Carrier | Zona | Estado |
|----|--------|---------|------|--------|
| `lm-ruta1` | Ruta Norte BOG — Alkosto, Éxito Kennedy | Coordinadora | Norte BOG | dispatched |
| `lm-ruta2` | Ruta Sur BOG — Jumbo, 2 distribuidores | TCC | Sur BOG | in_progress |

Cada manifiesto tiene 2–3 paradas. La Ruta 2 incluye entrega en Tienda Andino como última parada.

---

## Bloque 3 — Flujos de cliente para demo

### Flujo A: B2B / Mayorista

**Actores:** Alkosto (cliente mayorista), CEDI Bogotá  
**Narrativa:** Pedido de 5 neveras + 3 estufas. Picking wave completada, packing done, cargado en Ruta Norte.

| Entidad | ID | Estado |
|---------|----|--------|
| CommerceOrder | `co-b2b-1` | completed (Alkosto) |
| CommerceOrder | `co-b2b-2` | in_progress (Éxito Kennedy — parcial) |
| PickingTask x3 | `pt-b2b-*` | completed / partial_with_shortage |
| PickingWave | `wv-1` | in_progress |
| PackingOrder | `pk-b2b-1` | completed |
| Shipment | `sh-b2b-1` | delivered |
| LoadManifest | `lm-ruta1` | dispatched |

### Flujo B: Ecommerce / Marketplace

**Actores:** 3 clientes individuales, carriers (Coordinadora, Servientrega)  
**Narrativa:** Compras online de microondas, cafetera, sanduchera. Diferentes estados del ciclo.

| Entidad | ID | Estado |
|---------|----|--------|
| CommerceOrder | `co-eco-1` | shipped (microondas entregado) |
| CommerceOrder | `co-eco-2` | in_progress (cafetera en packing) |
| CommerceOrder | `co-eco-3` | pending (sanduchera — en wave) |
| PickingTask x3 | `pt-eco-*` | completed / in_progress / assigned |
| PackingOrder | `pk-eco-1` | completed |
| Shipment | `sh-eco-1` | delivered |
| Shipment | `sh-eco-2` | in_transit |

### Flujo C: Reposición Tienda Propia

**Actores:** CEDI Bogotá → Tienda Andino  
**Narrativa:** CEDI detecta stock bajo en Andino, genera transferencia + put-to-store para licuadoras y cafeteras.

| Entidad | ID | Estado |
|---------|----|--------|
| TransferOrder | `tr-andino-1` | in_transit |
| PutToStoreTask | `pts-andino-1` | in_progress (distribuyendo slots) |
| PickingWave | `wv-3` | released |
| PickingTask x2 | `pt-pts-*` | completed |

### Flujo D: Devolución & Reinspección

**Actores:** Cliente devuelve nevera defectuosa  
**Narrativa:** Nevera regresa al CEDI, pasa por QC, inspector determina va a reparación (no reingreso).

| Entidad | ID | Estado |
|---------|----|--------|
| ReturnOrder | `ret-1` | under_validation |
| ReturnInspection | `insp-1` | completed (disposition: repair) |
| RepairTicket | `rpr-1` | open |
| InventoryItem | `inv-ret-1` | on_hold en loc-qc |

---

## Restricciones de implementación

1. **No crear nuevos archivos.** Todo va en `seed.ts` existente.
2. **Mantener IDs de warehouses y locations.** Solo cambiar `productId` en inventario y órdenes.
3. **Actualizar todos los arrays dependientes** en el mismo archivo: `demandStats`, `inventoryItems`, `stockMovements`, `purchaseOrders`, `asns`, `commerceOrders`, `pickingTasks`, `pickingWaves`, `packingOrders`, `shipments`, `loadManifests`, `returnOrders`, `returnInspections`, `repairTickets`.
4. **Mantener diversidad de estados** en cada entidad — el seed es la "foto del momento" de una jornada operativa activa.
5. **IDs de productos:** prefijo `p-` seguido de nombre corto en kebab-case (ej. `p-nevera`, `p-estufa`).
6. **Imágenes:** usar URLs de Unsplash con `w=80&h=80&fit=crop` — buscar fotos de electrodomésticos reales.

---

## Criterio de éxito

- Navegar `/inventory` → ver 12 productos electrodomésticos con stock real
- Navegar `/picking` → ver wave con tareas de neveras/estufas, estados variados
- Navegar `/load-manifests` → ver Ruta Norte (dispatched) y Ruta Sur (in_progress)
- Navegar `/commerce` → ver 5+ órdenes con clientes B2B (Alkosto, Éxito) y ecommerce
- Navegar `/returns` → ver nevera en QC con ticket de reparación abierto
- Navegar `/slotting` → nevera y estufa clasificadas como A-X (alta prioridad de reubicación si están en zona B/C)
