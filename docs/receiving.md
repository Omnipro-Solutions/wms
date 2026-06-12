# Recepción — Inbound

Módulo de entrada de mercancía al almacén. Cubre el ciclo completo desde que el proveedor confirma un envío hasta que el stock queda disponible en su ubicación definitiva.

---

## Conceptos clave

| Término | Definición |
|---|---|
| **ASN** | *Advanced Shipping Notice* — aviso de llegada emitido por el proveedor. Es la unidad de trabajo del módulo. |
| **Conteo físico** | Verificación de las unidades reales recibidas vs. las prometidas en el ASN. |
| **Discrepancia** | Diferencia entre `expectedQuantity` y `receivedQuantity`. Requiere motivo para el reporte OTIF. |
| **QC** | *Quality Control* — inspección de calidad obligatoria para ciertos proveedores/productos. Bloquea el stock hasta aprobación. |
| **Putaway** | Acto de mover el stock del área de ingreso a su ubicación definitiva en el almacén. |
| **Cross-Docking** | El stock no se almacena; va directo al área de despacho tras ser recibido. |
| **Clase ABC** | Clasificación de rotación: A = alta, B = media, C = baja. Determina la ubicación sugerida. |
| **OTIF** | *On Time In Full* — métrica de cumplimiento del proveedor. Las discrepancias la alimentan. |

---

## Estados del ASN

```
pending ──► in_progress / partial ──► completed
                  │
                  └── (si requiresQualityControl)
                        │
                        ▼
                   [bloqueado en loc-qc]
                        │
                  QC aprueba
                        │
                        ▼
                   loc-stageout ──► putaway ──► ubicación final
```

| Estado | Significado |
|---|---|
| `pending` | Cita programada, camión no ha llegado |
| `partial` | Se recibieron algunas unidades, faltan más |
| `in_progress` | Recepción en curso |
| `completed` | Todas las unidades contadas y ubicadas |
| `cancelled` | ASN anulado |

---

## Tabs del módulo

### Tab 1 — Llegadas programadas
- Muestra ASNs con `status: "pending"`.
- Indica si la cita está **atrasada** (fecha < hoy y no completado).
- Acción disponible: **Iniciar recepción**.

### Tab 2 — Conteo físico
- Muestra ASNs con `status: "partial"` o `"in_progress"`.
- Muestra la barra de avance `receivedQuantity / expectedQuantity`.
- Acción disponible: **Continuar recepción**.

### Tab 3 — Inspección de calidad (QC)
- Solo ASNs con `requiresQualityControl: true` en estados `partial` / `completed`.
- El stock está bloqueado (`on_hold`) en `loc-qc` y no es disponible para venta.
- Acciones: **Aprobar lote** (libera el stock) o **Rechazar lote** (permanece bloqueado).

### Tab 4 — Ubicación en almacén (Putaway)
- ASNs sin QC con `status: "partial"` / `"completed"`.
- El sistema sugiere la ubicación óptima según la clase ABC del producto.
- En Cross-Docking: el botón dice "Enviar a salida" y el destino es el área de despacho.
- Acción: **Asignar ubicación**.

---

## KPIs del encabezado

| KPI | Lógica |
|---|---|
| Llegadas programadas | `count(status === "pending")` |
| Entregas con atraso | `count(appointmentDate < hoy AND status !== "completed/cancelled")` — alerta pulsante si > 0 |
| En inspección de calidad | `count(requiresQualityControl AND status en partial/completed)` |
| Recepciones completadas | `count(status === "completed")` |

---

## Lógica de negocio (store)

### `receiveAsn(asnId, qty, operatorName)`
1. Valida que el ASN exista y esté en estado `pending`, `partial` o `in_progress`.
2. Calcula el total acumulado: `newTotal = receivedQuantity + qty`.
3. Si `newTotal >= expectedQuantity` → `status: "completed"`, si no → `status: "partial"`.
4. Crea o acumula un `InventoryItem` en:
   - `loc-qc` con `status: "on_hold"` si `requiresQualityControl: true`
   - `loc-stageout` con `status: "available"` si no requiere QC
5. Registra un `StockMovement` de tipo `receipt`.

### `putawayItem(asnId, locationId, operatorName)`
1. Busca el stock en `loc-qc` (si tenía QC) o `loc-stageout`.
2. Vacía esa ubicación de staging (`onHandQuantity = 0`).
3. Crea o acumula el stock en `locationId` con `status: "available"`.
4. Registra un `StockMovement` de tipo `transfer`.

### Sugerencia de ubicación
- `selectSlottingRecommendations` cruza la clase ABC del producto con las ubicaciones disponibles.
- Clase A → posiciones `golden` o `pick` (alta frecuencia de acceso).
- Clase B/C → posiciones `reserve`.
- El operador siempre puede sobrescribir la sugerencia.

---

## Datos de prueba (seed)

El sistema arranca con 4 ASNs precargados:

| N° Aviso | Proveedor | Producto | Estado inicial | Tipo especial |
|---|---|---|---|---|
| ASN-2406-001 | Textiles del Norte | T-Shirt | `completed` | — |
| ASN-2406-002 | Calzado Premium | Sneakers | `partial` (180/200) | Requiere QC |
| ASN-2406-003 | Accesorios Urbanos | Cap | `pending` | Cross-Docking |
| ASN-2406-004 | Confecciones Andinas | Jacket | `pending` | Requiere QC |

> El estado se reinicia al recargar la página (el store es en memoria, no persiste en base de datos).

---

## Guías de prueba por escenario

### Escenario A — Flujo estándar sin QC (ASN-2406-003 · Cap)

**Objetivo:** recibir un envío completo y ubicarlo en almacén.

1. Ir a **Recepción** → tab **Llegadas programadas**.
2. Localizar `ASN-2406-003` (Accesorios Urbanos — Cap).
   - Verificar que aparece badge **Cross-Docking** en la columna Tipo.
3. Clic en **Iniciar recepción**.
4. En el dialog:
   - El campo "Unidades pendientes" muestra `600`.
   - Se ve el aviso azul: *"Salida rápida: este lote irá directo al área de despacho"*.
   - Ingresar `600` en el campo de cantidad contada.
   - No aparece alerta de discrepancia (cantidad completa).
5. Clic en **Confirmar recepción**.
6. El ASN desaparece de "Llegadas programadas" y aparece en tab **Ubicación en almacén**.
7. Clic en **Enviar a salida**.
8. En el dialog se muestra la ubicación sugerida (si existe) con el aviso de Cross-Docking.
9. Clic en **Confirmar posición recomendada** o seleccionar manualmente.
10. El ASN queda en `status: completed`. Badge verde **"Ubicado"** aparece en la fila.

---

### Escenario B — Recepción con discrepancia (ASN-2406-004 · Jacket)

**Objetivo:** registrar una recepción parcial con motivo de diferencia.

1. Ir a **Llegadas programadas**.
2. Localizar `ASN-2406-004` (Confecciones Andinas — Jacket, 120 uds esperadas).
   - Verificar badge **Inspección QC**.
3. Clic en **Iniciar recepción**.
4. En el dialog:
   - Se ve el aviso ámbar: *"El stock irá a zona de inspección de calidad hasta ser aprobado"*.
   - Cambiar la cantidad a `80` (menos de los 120 esperados).
   - Aparece alerta: *"40 unidades menos de lo esperado"*.
   - Aparece el selector **Motivo de la diferencia** (obligatorio).
   - Seleccionar "Proveedor envió menos de lo pactado".
5. Clic en **Confirmar recepción**.
6. El ASN pasa a `status: partial` y aparece en tab **Conteo físico** con barra al 67%.
7. Para recibir las 40 restantes: clic en **Continuar recepción**, ingresar `40`.
8. El ASN pasa a `status: completed` y se mueve a tab **Inspección de calidad**.

---

### Escenario C — Control de calidad (ASN-2406-002 · Sneakers)

**Objetivo:** aprobar un lote bloqueado en QC.

> Este ASN ya viene en `partial` (180/200) con QC activado desde el seed.

1. Ir a tab **Inspección de calidad**.
2. Localizar `ASN-2406-002` (Calzado Premium — Sneakers).
3. Clic en **Inspeccionar lote**.
4. El dialog muestra las opciones:
   - **Aprobar** → el stock sale de QC y queda disponible para ubicación.
   - **Rechazar** → permanece bloqueado para gestión del supervisor.
5. Clic en **Aprobar lote**.
6. El ASN aparece en tab **Ubicación en almacén** listo para putaway.
7. Clic en **Asignar ubicación**.
8. El sistema muestra la posición recomendada `loc-reserve` (producto Clase B/C).
9. Confirmar → stock disponible en inventario.

---

### Escenario D — Recepción con ASN atrasado

**Objetivo:** verificar la alerta de atraso.

El seed tiene las citas programadas para días posteriores al 10-jun-2026. Para simular un atraso, observar el comportamiento con cualquier ASN cuya `appointmentDate` sea anterior a hoy: la columna "Fecha de cita" muestra el ícono rojo `⚠` y el badge **"Atrasada"**. El KPI "Entregas con atraso" sube y aparece el punto rojo pulsante.

---

## Relaciones con otros módulos

| Módulo | Relación |
|---|---|
| **Inventario** | `receiveAsn` y `putawayItem` crean/actualizan `InventoryItem`. El stock queda visible en el módulo de Inventario tras el putaway. |
| **Reports** | Los `StockMovements` de tipo `receipt` generados alimentan los reportes de actividad. |
| **Shipping / Cross-Docking** | Los ASNs con `crossDocking: true` deben ubicarse directamente en el área de despacho (`loc-stageout`) sin pasar por almacén. |
| **Slotting / ABC** | `selectSlottingRecommendations` usa `demandStats` para calcular la clase ABC y sugerir la posición óptima. |
