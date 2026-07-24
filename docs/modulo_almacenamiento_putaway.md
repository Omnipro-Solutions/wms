# Módulo: Almacenamiento y Putaway

**Fecha:** 2026-07-23
**Alcance:** Niveles 🟢 Base y 🔵 Estándar del catálogo de referencia (`docs/funcionalidades_base_wms.md`, sección 3). MVP de demo con persistencia local (Zustand + IndexedDB), sin backend.

> Este documento describe qué hace el módulo, dónde vive en el código, qué datos de ejemplo se sembraron para la demo, y un guion paso a paso para presentarlo.

---

## 1. Para qué sirve

Decide y ejecuta *dónde guardar* la mercancía recién recibida, moviéndola desde la zona de
staging/QC a su ubicación definitiva. Coloca cada producto en la mejor posición posible según
reglas de negocio (zona, tipo de producto, clase ABC) y restricciones físicas/de seguridad
siempre activas (peligrosidad, cadena de frío, mezcla de lotes, compatibilidad de rack), para
densificar el uso del espacio y acortar los futuros recorridos de picking. Un buen putaway es la
base de un picking eficiente.

---

## 2. Checklist de funcionalidades cubiertas

### 🟢 Base

| # | Funcionalidad | Cómo está implementada |
|---|---|---|
| 1 | Putaway manual con validación de ubicación destino | `putawayItem()` (`src/store/wms-store.ts`) ahora llama `validatePutawayDestination()` (`src/lib/rules/putaway.ts`) antes de mutar inventario — rechaza ubicaciones bloqueadas, sin capacidad de peso/volumen, con rack incompatible, o que violan una restricción/regla activa. UI: `PutawayDialog` (`src/app/(app)/receiving/_components/putaway-dialog.tsx`) muestra el motivo en el banner de error si el envío falla. |
| 2 | Registro del movimiento con trazabilidad | Sin cambios — `putawayItem()` sigue registrando un `StockMovement` (`type: 'putaway'`) por cada unidad/serial movido, con `fromLocationId`/`toLocationId`/`operatorName`. Ahora el `operatorName` es el operario realmente autenticado (antes era el literal `'Operador'`), vía `useCurrentOperator()`. |

### 🔵 Estándar

| # | Funcionalidad | Cómo está implementada |
|---|---|---|
| 1 | Putaway dirigido por sistema | `suggestPutawayLocation()` (`src/lib/rules/putaway.ts`) resuelve la mejor ubicación disponible combinando clase ABC/XYZ, reglas `PutawayRule` activas y las restricciones siempre activas, con preferencia por consolidar en una ubicación que ya tenga el mismo producto. `usePutawayDialog` (`src/app/(app)/receiving/_hooks/use-putaway-dialog.ts`) prioriza: recomendación de slotting activa (re-validada) → sugerencia estática del ASN (re-validada) → este motor → selección manual. |
| 2 | Reglas de ubicación por zona, tipo de producto, ABC, capacidad | Nuevo tipo `PutawayRule` (`src/types/wms.ts`) — mismo shape que `SlottingRule` (matchType + directivas + prioridad) pero independiente, para que ajustar slotting nunca cambie el comportamiento de putaway. CRUD completo en **`/putaway-settings`** (`src/app/(app)/putaway-settings/page.tsx` + `PutawayRuleDialog`). 3 reglas sembradas: zona por categoría, preferencia de tier por clase ABC, compatibilidad de rack por categoría. |
| 3 | Restricciones: temperatura, peligrosidad, compatibilidad de producto, mezcla de lotes | `checkPutawayCompatibility()` (`src/lib/rules/putaway.ts`) — siempre activas, no configurables (son restricciones físicas/de seguridad, no reglas de negocio ajustables). Nuevos campos: `Product.isHazardous`/`requiresColdChain`, `StorageLocation.hazardApproved`/`temperatureZone`/`allowsLotMixing`. Reutiliza `checkRackCompatibility()` ya existente para la compatibilidad de producto/rack. |

---

## 3. Modelo de datos

```
PutawayRule                — regla de gobierno de destino (independiente de SlottingRule)
├── matchType: 'category' | 'abcClass' | 'weightAboveKg' | 'trackBy'
├── matchValue: string
├── directives: PutawayDirective[]   — preferTier | requireLocationType | requireZone |
│                                      requireGolden | forbidGolden | maxLevel | requireRackCompatible
├── priority: number
└── active: boolean

Product (campos nuevos)
├── isHazardous?: boolean
└── requiresColdChain?: boolean

StorageLocation (campos nuevos)
├── hazardApproved?: boolean
├── temperatureZone?: 'ambient' | 'refrigerated' | 'frozen'
└── allowsLotMixing?: boolean          — default true cuando está ausente

WmsSettings (campo nuevo)
└── putawayFreezeActive: boolean       — congela putawayItem/assignPutaway (no el CRUD de reglas)
```

---

## 4. Dónde vive en el código

| Capa | Archivo |
|---|---|
| Tipos | `src/types/wms.ts` — `PutawayRule`/`PutawayDirective`, campos nuevos en `Product`/`StorageLocation`/`WmsSettings` |
| Reglas puras | `src/lib/rules/putaway.ts` — `checkPutawayCompatibility`, `validatePutawayDestination`, `suggestPutawayLocation`, `activePutawayMatchingRules` |
| Store | `src/store/wms-store.ts` — `putawayItem` (endurecido), `assignPutaway` (guardia de congelamiento), slice `putawayRules` + CRUD, `version: 9` |
| UI operativa | `src/app/(app)/receiving/_hooks/use-putaway-dialog.ts` + `_components/putaway-dialog.tsx` — sugerencia re-validada, dropdown con candidatos inválidos deshabilitados |
| UI de configuración | `src/app/(app)/putaway-settings/page.tsx` + `_components/putaway-rule-dialog.tsx` |
| Admin | `src/app/(app)/admin/page.tsx` (Producto: hazmat/cadena de frío), `src/app/(app)/locations/_components/location-form-dialog.tsx` (Ubicación: hazmat/temperatura/mezcla de lotes) |
| Navegación | `src/components/navigation/sidebar/sidebar-items.ts` — `config-putaway` bajo Sistema → Configuración |

---

## 5. Datos sembrados para la demo

- **Productos:** `p-bateria-litio` (Batería de Litio, `isHazardous: true`), `p-gas-refrigerante` (Cilindro de Gas Refrigerante, `requiresColdChain: true`).
- **Ubicaciones:** `loc-hazmat-01` (`HZ-01-01`, `hazardApproved: true`), `loc-cold-01` (`CC-01-01`, `temperatureZone: 'refrigerated'`); `loc-b0204` (`B-02-04`, ya existente) gana `allowsLotMixing: false` para demostrar la restricción de mezcla de lotes sobre un pick face ordinario.
- **Reglas:** `PWR-01` (Electrónica → zona A), `PWR-02` (Clase A → preferir golden), `PWR-03` (Línea Blanca → requiere rack compatible).
- **Ajuste puntual para el guion de demo:** ninguno de los productos existentes con ASN pendiente de putaway parte marcado como hazmat/cold-chain — el guion de abajo lo activa a propósito sobre `p-nevera` (`asn-1`) para mostrar el rechazo en vivo.

---

## 6. Guion de demo paso a paso

1. Abrir `/putaway-settings` — mostrar los 3 KPIs (pendientes, reglas activas, hazmat/cadena de frío) y la tabla de reglas.
2. Abrir `/admin?tab=products`, editar **Nevera No Frost 320L**, activar **"Material peligroso (hazmat)"**, guardar.
3. Ir a `/receiving` → pestaña **"Putaway staging"** → clic en **"Asignar ubicación"** sobre el ASN de la nevera.
4. Mostrar que la ubicación previamente sugerida ahora aparece deshabilitada en el desplegable, con el motivo "requiere una ubicación aprobada para materiales peligrosos" — y que `HZ-01-01` (badge ⚡) sí es seleccionable.
5. Confirmar el putaway hacia `HZ-01-01`; el ASN pasa a "Ubicado" y el movimiento queda en el libro de auditoría con el operario real (no `'Operador'`).
6. Volver a `/putaway-settings`, crear una regla nueva (ej. "Accesorios solo en zona A"), guardarla, mostrar que aparece en la tabla y se puede activar/desactivar/eliminar.
7. Activar el switch **"Congelar operaciones de putaway"**, volver a `/receiving` e intentar confirmar otra ubicación — mostrar el mensaje de módulo congelado. Desactivar el freeze al terminar.

---

## 7. Brechas conocidas (fuera de alcance de este trabajo)

- Las restricciones de hazmat/cadena de frío/mezcla de lotes solo se aplican en el flujo de
  putaway desde recepción (`putawayItem`) — **no** se retroalimentan en `/slotting` (reubicación de
  stock ya existente vía `relocateInventory`) ni en `/internal-moves`. Un producto podría, en
  teoría, terminar reubicado a una posición no apta por esas vías.
- `putawayItem` sigue asumiendo `warehouseId: 'wh-bog'` — no hay putaway multi-almacén en
  recepción (simplificación de alcance preexistente, no introducida por este trabajo).
- No existe un `PutawayTask` desacoplado del `Asn` con su propia máquina de estados — el putaway
  sigue viviendo como la transición `completed`/`short_received` → `putaway_done` del ASN.

---

*Generado con Claude Code — Módulo Almacenamiento y Putaway — 2026-07-23*
