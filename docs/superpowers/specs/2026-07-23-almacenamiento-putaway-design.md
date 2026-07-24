# Diseño — Almacenamiento y Putaway (Base + Estándar)

**Fecha:** 2026-07-23
**Estado:** Aprobado para plan de implementación
**Referencia:** `docs/funcionalidades_base_wms.md` §3 (catálogo de referencia) · `docs/gap_analysis_wms_mvp.md` ítem 19

---

## Contexto

El catálogo de referencia (`docs/funcionalidades_base_wms.md` §3) define el módulo de Almacenamiento y Putaway con dos niveles:

- 🟢 **Base:** putaway manual con validación de ubicación destino + registro del movimiento con trazabilidad.
- 🔵 **Estándar:** putaway dirigido por sistema (sugerencia óptima), reglas de ubicación configurables por zona/tipo de producto/ABC/capacidad, y restricciones de temperatura/peligrosidad/compatibilidad de producto/mezcla de lotes.

Al auditar el código existente se encontró que el módulo está más avanzado de lo que sugería `docs/gap_analysis_wms_mvp.md` (ítem 19, 45%, fecha 2026-06-25): ya existe un flujo completo de putaway dirigido por ASN (`putawayItem`), un diálogo (`PutawayDialog`) que muestra clasificación ABC/XYZ y una sugerencia de ubicación, y un motor de reglas maduro (`SlottingRule` + su engine en `lib/rules/slotting.ts`) construido para el módulo de Slotting (#10) que sirve de plantilla directa.

Pero quedan brechas reales:

1. **`putawayItem` no valida el destino.** Acepta cualquier `locationId` sin chequear bloqueo, capacidad de peso/volumen, ni compatibilidad de rack. Esto incumple el ítem Base "validación de ubicación destino".
2. **No existe gobierno configurable** para las reglas de ubicación (zona/tipo/ABC/capacidad) — la sugerencia de sistema hoy es un fallback ABC-only sin posibilidad de ajuste por un administrador.
3. **No existen los campos de restricciones** (temperatura, peligrosidad, compatibilidad, mezcla de lotes) en ningún tipo del dominio — un comentario en `slotting.ts:1015` dice explícitamente "Cold-chain / temperature is Fase 2".
4. El operario que ejecuta el putaway se guarda como el literal `'Operador'` (`use-putaway-dialog.ts:129`), no el operario real de sesión.

Este diseño cierra las cuatro brechas, reutilizando el patrón ya establecido por otros módulos (`SlottingRule`, `/slotting-settings`, `xxxFreezeActive` en `WmsSettings`) en vez de inventar uno nuevo.

## Alcance

**Incluye:**
- Validación dura de destino en `putawayItem` (bloqueo, capacidad, rack, y las tres restricciones nuevas).
- Campos nuevos en `Product` (`isHazardous`, `requiresColdChain`) y `StorageLocation` (`hazardApproved`, `temperatureZone`, `allowsLotMixing`) con datos de siembra representativos.
- Nuevo tipo `PutawayRule` (motor paralelo e independiente de `SlottingRule`, mismo shape) con CRUD completo.
- Reescritura de `suggestPutawayLocation()` para combinar ABC/XYZ + `PutawayRule` + restricciones + preferencia de consolidación.
- Mejora de UX en `PutawayDialog`: candidatos inválidos deshabilitados con motivo, badges de compatibilidad.
- Corrección del operario hardcodeado (`'Operador'` → operario real de sesión).
- Nueva página `/putaway-settings` (mismo patrón que `/slotting-settings`) + entrada `config-putaway` en `sidebar-items.ts`.
- Campos nuevos en los formularios de edición de Producto (`/admin`) y Ubicación (`/locations/_components/location-form-dialog.tsx`).
- Bump de `version: 9` en la persistencia del store + seed data.
- Documento final `docs/modulo_almacenamiento_putaway.md`.

**Excluye (fuera de este spec):**
- Retrofit de las restricciones (hazmat/cadena de frío/mezcla de lotes) en `/slotting` (reubicación) o `/internal-moves` — quedan aplicando solo al flujo de putaway desde recepción. Se documenta como brecha conocida en el doc final.
- Un `PutawayTask` desacoplado del `Asn` con su propia FSM — el putaway sigue viviendo como una transición del `Asn` (`completed`/`short_received` → `putaway_done`), igual que hoy. No se introduce cola de tareas nueva.
- Multi-almacén en recepción (`putawayItem` sigue asumiendo `warehouseId: 'wh-bog'` como hoy) — es una simplificación de alcance preexistente y no relacionada con este trabajo.
- Modo "advisory" (no bloqueante) para las restricciones — quedan siempre aplicadas, sin toggle para desactivarlas, tal como se acordó (son restricciones físicas/de seguridad, no reglas de negocio ajustables).
- Tests — instrucción explícita del usuario para este trabajo.

## Arquitectura

### 1. Modelo de datos — `src/types/wms.ts`

```ts
export interface Product {
  // …campos existentes…
  isHazardous?: boolean        // NUEVO — requiere ubicación con hazardApproved
  requiresColdChain?: boolean  // NUEVO — requiere ubicación temperatureZone !== 'ambient'
}

export interface StorageLocation {
  // …campos existentes…
  hazardApproved?: boolean                                    // NUEVO — default false
  temperatureZone?: 'ambient' | 'refrigerated' | 'frozen'      // NUEVO — default 'ambient'
  allowsLotMixing?: boolean                                   // NUEVO — default true
}

// --- Putaway rules (motor paralelo e independiente de SlottingRule) ---

export type PutawayRuleMatchType = 'category' | 'abcClass' | 'weightAboveKg' | 'trackBy'

export type PutawayDirectiveKind =
  | 'preferTier'
  | 'requireLocationType'
  | 'requireZone'
  | 'requireGolden'
  | 'forbidGolden'
  | 'maxLevel'
  | 'requireRackCompatible'

export type PutawayDirective =
  | { kind: 'preferTier'; tier: SlottingTier }
  | { kind: 'requireLocationType'; locationType: LocationType }
  | { kind: 'requireZone'; zone: string }
  | { kind: 'requireGolden' }
  | { kind: 'forbidGolden' }
  | { kind: 'maxLevel'; level: number }
  | { kind: 'requireRackCompatible' }

export interface PutawayRule {
  id: string
  code: string
  name: string
  description?: string
  matchType: PutawayRuleMatchType
  matchValue: string
  directives: PutawayDirective[]
  priority: number
  active: boolean
}
```

`PutawayDirective`/`PutawayRuleMatchType` duplican el shape de `SlottingDirective`/`SlottingRuleMatchType` a propósito (no se importan) — así ajustar el motor de slotting nunca cambia por accidente el de putaway. `SlottingTier`/`LocationType` sí se reutilizan porque son vocabulario de dominio, no mecanismo de gobierno.

`WmsSettings` — nuevo campo, siguiendo el patrón `xxxFreezeActive` de todos los demás módulos:

```ts
putawayFreezeActive: boolean // congela putawayItem/assignPutaway
```

### 2. Motor de sugerencia y restricciones — `src/lib/rules/putaway.ts`

Reescritura completa del archivo (57 líneas hoy → engine completo), en el mismo estilo que `slotting.ts`:

```ts
export interface PutawayCompatibility {
  compatible: boolean
  reasons: string[]  // en español, listas para mostrar en UI/error
}

// Chequeo SIEMPRE activo (no configurable) de las 4 restricciones acordadas.
export function checkPutawayCompatibility(
  product: Pick<Product, 'unitWeightKg' | 'isHazardous' | 'requiresColdChain'>,
  candidate: Pick<StorageLocation, 'isBlocked' | 'maxWeightKg' | 'maxVolumeM3' | 'hazardApproved' | 'temperatureZone' | 'allowsLotMixing'>,
  rackType: RackType | undefined,
  hasOtherLotAtLocation: boolean,
): PutawayCompatibility

// Filtra + rankea candidatos: aplica checkPutawayCompatibility + directivas duras de
// PutawayRule activas que matchean, prefiere consolidar en ubicación que ya tiene el
// mismo producto, y ordena por slottingScore/accessibilityScore según el tier resuelto
// (ABC/XYZ, con override de preferTier si una regla lo declara).
export function suggestPutawayLocation(args: {
  product: Product
  abcClass: AbcClass
  xyzClass: XyzClass
  locations: StorageLocation[]
  inventoryItems: InventoryItem[]
  rules: PutawayRule[]
  rackTypes: RackType[]
  warehouseId?: string
}): { location: StorageLocation; reason: string } | null

// Usado por putawayItem para validar el destino elegido (sugerido o manual) antes de comitear.
export function validatePutawayDestination(args: {
  product: Product
  destination: StorageLocation
  rackType?: RackType
  hasOtherLotAtLocation: boolean
  rules: PutawayRule[]
  abcClass: AbcClass
}): PutawayCompatibility
```

Reutiliza de `lib/rules/slotting.ts` (sin duplicar): `idealLocationTier`, `slottingScore` (renombrado internamente vía import, misma función), `activeMatchingRules`/`evaluatePlacement`/`candidateAllowedByRules` — estas tres últimas ya son genéricas en sus parámetros (reciben `directives: SlottingDirective[]`), así que se les pasa el tipo `PutawayDirective[]` sin cambios (misma forma estructural). De `lib/rules/locations.ts`: `checkRackCompatibility`.

`hasOtherLotAtLocation` (parámetro de `checkPutawayCompatibility`/`validatePutawayDestination`) lo calcula el llamador: `true` cuando `product.trackBy === 'lot'` y existe algún `InventoryItem` en la ubicación candidata con el mismo `productId`, `lot` distinto al del ASN en curso, y `onHandQuantity > 0`. Para productos `trackBy !== 'lot'` siempre es `false` (la restricción `allowsLotMixing` no aplica — no hay lote que mezclar).

**Prioridad de sugerencia** (sin cambiar el orden que ya usa `use-putaway-dialog.ts`, pero re-validando cada candidato antes de mostrarlo):
1. Recomendación activa de slotting para el producto (`selectSlottingRecommendations`) — **ahora validada** con `validatePutawayDestination`; si ya no es compatible (p. ej. el producto se marcó hazmat después), se descarta y cae al siguiente nivel.
2. `asn.suggestedPutawayLocationId` (campo estático de siembra) — misma re-validación.
3. `suggestPutawayLocation()` (el nuevo motor completo).
4. Sin sugerencia — selección manual, con el dropdown ya filtrado/anotado (ver UI).

### 3. Store — `src/store/wms-store.ts`

**`putawayItem`** — antes de mutar, resuelve `abcClass` (vía `abcByProduct`, ya se computa en varios lugares del store) y llama `validatePutawayDestination`; si `!compatible`, lanza `Error(reasons.join('. '))`. El resto de la lógica (movimiento de staging → destino, `StockMovement`, transición FSM) no cambia.

**Nuevo slice:** `putawayRules: PutawayRule[]` + acciones CRUD (idéntico patrón a `slottingRules`):
```ts
createPutawayRule: (data: Omit<PutawayRule, 'id'>) => PutawayRule
updatePutawayRule: (id: string, data: Partial<PutawayRule>) => void
togglePutawayRule: (id: string) => void
deletePutawayRule: (id: string) => void
```
Sin guard de freeze en el CRUD de reglas (igual que `slottingRules`, que tampoco lo tiene) — el freeze (`putawayFreezeActive`) solo bloquea la ejecución (`putawayItem`/`assignPutaway`), no la configuración.

**`use-putaway-dialog.ts`** — `handleSubmit` deja de pasar el literal `'Operador'`; usa el operario de sesión actual (mismo patrón que otras pantallas: `useWmsStore((s) => s.currentOperatorId)` + lookup en `operators`, con fallback a `'Operador'` solo si no hay sesión activa — no se rompe el caso sin operador).

**Persistencia** (`wms-store.ts`, cola del archivo): bump a `version: 9`, nueva línea de changelog:
```
// v9: putaway module (#3) — putawayRules slice, hazard/cold-chain/lot-mixing fields
// on Product/StorageLocation, and putawayFreezeActive governance added to the seed.
```
`buildSeedState()` gana `putawayRules: seed.putawayRules` y `putawayFreezeActive: false` en `settings`.

### 4. Seed data — `src/data/seed.ts`

- 2–3 `PutawayRule` de ejemplo: una por zona (p. ej. "Electrónica siempre en zona A"), una por ABC (`preferTier: golden` para clase A), una `requireRackCompatible` reusando un `RackType` ya sembrado.
- 2–3 productos existentes marcados `isHazardous: true` o `requiresColdChain: true` (categorías plausibles: químicos/aerosoles para hazmat, lácteos/congelados para cadena de frío — ya existen categorías similares en el seed de productos).
- 2–3 ubicaciones nuevas o existentes marcadas `hazardApproved: true` / `temperatureZone: 'refrigerated'` (o `'frozen'`), y al menos una ubicación con `allowsLotMixing: false` para demostrar el bloqueo de mezcla de lotes.

### 5. UI

| Pantalla | Cambio |
|---|---|
| `PutawayDialog` (`receiving/_components/putaway-dialog.tsx`) | El `<Select>` de ubicaciones marca cada opción con badges (❄️ cadena de frío, ⚠️ hazmat, 🔒 lote único, Golden ya existente) y **deshabilita** las que fallan `checkPutawayCompatibility`, con el motivo como tooltip/texto secundario. Si la sugerencia recomendada ya no es válida, el banner verde se reemplaza por el siguiente nivel de sugerencia (o el amber "sin sugerencia") — sin necesidad de que el usuario lo note manualmente. |
| `use-putaway-dialog.ts` | `getSuggestion` incorpora la re-validación descrita arriba; `handleSubmit` usa el operario real de sesión. |
| `/putaway-settings` (nuevo) | Clonado de `/slotting-settings`: KPI header (reglas activas, ASNs pendientes de putaway, ubicaciones hazmat-aprobadas/cold-chain), toggle `putawayFreezeActive`, tabla CRUD de `PutawayRule` + `PutawayRuleDialog` (react-hook-form + zod + `useFieldArray`, clon directo de `SlottingRuleDialog`). |
| `sidebar-items.ts` | Nueva entrada `{ id: 'config-putaway', title: 'Putaway', url: '/putaway-settings', icon: … }` dentro del `subItems` de `'config'`, junto a `config-slotting`. |
| `/admin` → tab Productos | Dos checkboxes nuevos en el diálogo de edición existente (`isHazardous`, `requiresColdChain`), siguiendo el patrón `useState` ya usado ahí (no se migra el formulario completo a react-hook-form — fuera de alcance). |
| `/locations/_components/location-form-dialog.tsx` | Tres campos nuevos: `Switch` para `hazardApproved` y `allowsLotMixing` (junto a los `Switch` existentes de `isPickFace`/`golden`), `<Select>` para `temperatureZone`. |
| `/worker/receiving/[asnId]` | Sin cambios estructurales — ya muestra `suggestedLocation`; se beneficia automáticamente de que ese campo ahora esté validado antes de llegar aquí. |

## Documentación final

`docs/modulo_almacenamiento_putaway.md`, con la misma estructura que `docs/modulo_reabastecimiento.md`/`docs/modulo_slotting.md`: Para qué sirve → Checklist Base/Estándar (con referencia a archivo:línea) → Modelo de datos → Dónde vive en el código → Datos sembrados para la demo → Guion de demo paso a paso. Incluye una sección explícita de brechas conocidas (multi-almacén en recepción, restricciones no aplicadas en slotting/internal-moves) para que quede trazable qué se dejó fuera y por qué.

## Testing

Sin tests — instrucción explícita del usuario para este trabajo.
