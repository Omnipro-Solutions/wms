# Packing / Embalaje — Módulo #6

**Fecha:** 2026-07-23

Módulo de preparación de bultos para el envío. Es la **última barrera de calidad** antes del cliente: verifica que lo que sale coincide exactamente con lo pedido (escaneo esperado vs. escaneado), embala protegiendo el producto (cartonización + reglas de empaque) y genera la etiqueta y documentación de despacho.

Cubre el nivel 🟢 **Base** y 🔵 **Estándar** del benchmark de `funcionalidades_base_wms.md`:

| Nivel | Funcionalidad | Estado |
|---|---|---|
| 🟢 Base | Verificación de contenido por escaneo (esperado vs. escaneado) | ✅ |
| 🟢 Base | Registro de peso/dimensiones del bulto | ✅ |
| 🟢 Base | Generación de etiqueta de envío | ✅ |
| 🔵 Estándar | Sugerencia de caja / cartonización por volumen y peso | ✅ (configurable) |
| 🔵 Estándar | Motor de reglas de empaque (frágil, líquido, pesado, frío, alto valor…) | ✅ |
| 🔵 Estándar | Packing list y documentación | ✅ |
| 🔵 Estándar | **Gobierno del módulo** (freeze, política de verificación, catálogos) | ✅ **(nuevo)** |

---

## Conceptos clave

| Término | Definición |
|---|---|
| **PackingOrder** | Unidad de trabajo del módulo — una orden de cliente lista para empacar. Tiene su propia FSM. |
| **Verificación** | Escaneo de cada ítem: `scannedItems` vs. `expectedItems`. Resultado: `verified` / `mismatch`. |
| **Cartonización** | Sugerir la caja más pequeña que encaje por peso y volumen (`suggestBox`), con un **margen de seguridad** configurable. |
| **Caja (PackingBoxType)** | Contenedor del catálogo: código, peso máx., volumen, dimensiones. |
| **Regla de empaque (PackingRule)** | Manejo condicional disparado por el tipo de producto (frágil, líquido, pesado, sobredimensionado, cadena de frío, alto valor, hazmat). Aporta requisitos (burbuja, doble empaque, hielo seco, relleno) y una nota de etiqueta. |
| **Discrepancia (mismatch)** | El contenido escaneado no coincide con lo esperado. La política de configuración decide si bloquea el cierre o se permite registrarla. |
| **Etiqueta de envío** | `WmsLabel` tipo `shipping`, generada al verificar. Puede generarse manual o automáticamente. |
| **Modo congelado** | Interruptor de gobierno que bloquea todas las operaciones de packing (para inventarios, cierres de turno o incidentes). |

---

## Estados de la orden de packing (FSM)

```
pending ──► in_progress ──► verified ──► labelled ──► dispatched
                  │
                  └──► mismatch   (contenido no coincide con lo esperado)
```

| Estado | Significado |
|---|---|
| `pending` | En cola, sin empacador asignado |
| `in_progress` | Empacador escaneando el contenido |
| `verified` | Escaneo 1:1 completo — listo para etiquetar |
| `mismatch` | Discrepancia entre esperado y escaneado |
| `labelled` | Etiqueta de envío generada |
| `dispatched` | Enviado a despacho (shipping) |

---

## Arquitectura (por capas)

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Tipos | `src/types/wms.ts` | `PackingOrder`, `PackingBoxType`, `PackingRule`, `PackingRuleTrigger`, y campos de packing en `WmsSettings` |
| Reglas puras | `src/lib/rules/packing.ts` | `suggestBox(peso, vol, cajas, margen)`, `applicableRules`, `calcPackingDimensions`, `verificationStatus`, `generateLabelCode` |
| Estado + acciones | `src/store/wms-store.ts` | 8 acciones de flujo + CRUD de cajas y reglas, todas con guardia de *freeze* |
| Config UI | `src/app/(app)/packing-settings/` | Página de configuración (Sistema → Configuraciones → Packing) |
| Operación UI | `src/app/(app)/packing/` · `src/app/(worker)/worker/packing/` | Tablero de escritorio + asistente móvil del empacador |

**Persistencia:** todo el store se serializa a **IndexedDB** (`idbStorage`) — la config y los catálogos sobreviven a recargas, listo para demo sin backend.

---

## Acciones del store

| Acción | Efecto | Guardia freeze |
|---|---|---|
| `startPacking(orderId, packer)` | `pending → in_progress` | ✅ |
| `scanItem(orderId, productId, qty)` | Suma escaneo, recalcula verificación | ✅ |
| `completePacking(orderId, scanned)` | `→ verified / mismatch`; emite `StockMovement` por serie; auto-etiqueta si está configurado | ✅ + política |
| `applyPackingRule` / `removePackingRule` | Añade/quita regla aplicada a la orden | ✅ |
| `selectBox(orderId, boxTypeId)` | Asigna la caja | ✅ |
| `generateLabel(orderId)` | Crea `WmsLabel` shipping; `→ labelled` | ✅ |
| `sendToShipping(orderId)` | `→ dispatched` | ✅ |
| `createPackingRule` / `updatePackingRule` / `togglePackingRule` / `deletePackingRule` | CRUD de reglas | — |
| `createPackingBox` / `updatePackingBox` / `deletePackingBox` | CRUD de cajas | — |

---

## Configuración — Sistema → Configuraciones → Packing (`/packing-settings`)

Nueva página de gobierno, espejo de las otras `*-settings`.

### KPIs en vivo
- **Discrepancias** — órdenes con `verificationStatus === 'mismatch'`.
- **Modo congelado** — interruptor que bloquea las 8 acciones de flujo.
- **En cola / progreso** + etiquetadas.

### Parámetros del módulo

| Parámetro (`WmsSettings`) | Default | Qué controla |
|---|---|---|
| `packingFreezeActive` | `false` | Congela todas las operaciones de packing |
| `packingAutoBoxSuggestion` | `true` | Activa la sugerencia automática de caja en `/packing` |
| `packingBoxSafetyMargin` | `0.10` | Fracción de capacidad reservada al sugerir caja (10% = usar solo el 90%) |
| `packingRequireFullScan` | `false` | Exige escaneo 1:1 — bloquea cerrar con discrepancia |
| `packingAllowMismatch` | `true` | Permite cerrar con mismatch (ignorado si se exige escaneo completo) |
| `packingAutoGenerateLabel` | `false` | Genera la etiqueta automáticamente al verificar |

### Catálogos
- **Catálogo de cajas** — CRUD de `PackingBoxType` (código, nombre, peso máx., volumen, dimensiones LxAxH). Alimenta la cartonización.
- **Reglas de empaque** — CRUD de `PackingRule` con disparador, requisitos y nota de etiqueta; activar/desactivar y eliminar.

> La política de verificación se aplica en el store: `completePacking` lanza error si hay mismatch y `packingRequireFullScan` está activo o `packingAllowMismatch` está inactivo. La cartonización lee `packingBoxSafetyMargin` vía `suggestBox`.

---

## Cómo hacer una demostración (paso a paso)

> Todos los datos se guardan en IndexedDB del navegador — puedes recargar sin perder el estado. Para reiniciar la demo: borra el storage del sitio en DevTools → Application → IndexedDB.

### Demo A — Gobierno y política de verificación (rol supervisor)

1. Inicia sesión como **supervisor**. En el menú lateral abre **Sistema → Configuraciones → Packing** (`/packing-settings`).
2. Observa la fila de **KPIs**: discrepancias, cola/progreso, etiquetadas.
3. **Congela el módulo:** activa el interruptor *Modo congelado*. Aparece la banda azul de aviso.
4. Ve a **Packing** (`/packing`) e intenta **iniciar** o **escanear** una orden → verás el bloqueo en vivo: *"Packing en modo congelado. No se permiten operaciones."*
5. Vuelve a `/packing-settings` y **desactiva** el modo congelado.
6. En *Parámetros → Verificación*, activa **Exigir escaneo completo (1:1)** y pulsa **Guardar cambios** (verás el aviso "Cambios sin guardar" hasta guardar).
7. Ahora un packing con ítems faltantes **no se podrá cerrar** — el sistema bloquea el mismatch.
8. Activa **Generar etiqueta automáticamente** y guarda: al verificar una orden, la etiqueta saldrá sin paso manual.

### Demo B — Cartonización (caja sugerida)

1. En `/packing-settings → Cartonización`, verifica que **Sugerir caja automáticamente** está activo.
2. Sube el **Margen de seguridad** a 20–30% con el deslizador y guarda.
3. Abre el **catálogo de cajas** → *+ Nueva caja*: crea, por ejemplo, `CAJA-XL` (peso 25 kg, 0.08 m³, `50x40x40`).
4. Ve al flujo del empacador y abre una orden: la **caja sugerida** se recalcula con el nuevo margen y el nuevo catálogo. Un margen mayor empuja hacia cajas más grandes.

### Demo C — Reglas de empaque

1. En `/packing-settings → Reglas de empaque`, pulsa **+ Nueva regla**.
2. Crea una regla: código `FRAG-02`, disparador **Frágil**, marca *Burbuja* y *Doble empaque*, nota de etiqueta `FRÁGIL – MANEJO CUIDADOSO`.
3. Verás la **vista previa** de la etiqueta dentro del diálogo. Guarda.
4. Usa el interruptor de estado para **desactivar/activar** la regla en línea, o el bote de basura para **eliminarla** (con confirmación).

### Demo D — Flujo completo del empacador (verificación → etiqueta → despacho)

1. Con el módulo **activo**, abre **Packing** y toma una orden `pending`.
2. **Escanea** cada ítem hasta que el contenido quede *verificado* (esperado = escaneado).
3. El sistema propone la **caja** (cartonización) y aplica las **reglas** que disparen los productos.
4. **Completa** el packing → estado `verified`. Si activaste auto-etiqueta, la etiqueta ya está lista; si no, pulsa **Generar etiqueta** → `labelled`.
5. **Enviar a despacho** → `dispatched`. El bulto pasa al módulo de Shipping.

### Demo E — Discrepancia (mismatch)

1. En `/packing-settings`, **desactiva** *Exigir escaneo completo* y **activa** *Permitir cierre con discrepancia*.
2. Empaca una orden dejando **un ítem sin escanear** y completa: la orden cierra en estado **`mismatch`** y aparece en el KPI de discrepancias.
3. Reactiva *Exigir escaneo completo*: el mismo cierre ahora se **bloquea**. Contraste directo de la política.

---

## Relación con otros módulos

- **Picking (#5):** alimenta las órdenes de packing con lo ya pickeado.
- **Etiquetas (#): ** `generateLabel` crea un `WmsLabel` tipo `shipping` visible en `/labels`.
- **Shipping (#7):** `sendToShipping` entrega el bulto verificado y etiquetado al despacho.
- **Trazabilidad (#14):** `completePacking` emite un `StockMovement` por cada ítem serializado, cerrando la traza serie en la etapa de empaque.

---

*Generado con Claude Code — Módulo de Packing / Embalaje — 2026-07-23*
