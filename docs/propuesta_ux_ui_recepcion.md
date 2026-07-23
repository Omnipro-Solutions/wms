# Propuesta UX/UI — Módulo de Recepción (Desktop + Mobile)

**Fecha:** 2026-07-23
**Tipo:** Documento de propuesta para evaluación — **no implementado**. Ninguno de los cambios aquí descritos se ha aplicado al código; es insumo para decidir qué construir en la siguiente iteración del módulo de Recepción.

---

## 1. Por qué dos experiencias distintas

Recepción tiene dos perfiles de usuario con necesidades opuestas:

| Perfil | Dónde trabaja | Qué necesita |
|---|---|---|
| **Supervisor / analista** | Oficina, escritorio, mouse+teclado | Ver todo el panorama: tablas densas, KPIs, comparar órdenes, aprobar excepciones, crear POs |
| **Operario de muelle** | De pie, en el andén, con el celular o una terminal en una mano y la mercancía en la otra | Una sola tarea a la vez, lo más rápido posible, sin escribir si se puede escanear, botones que se alcancen con el pulgar |

Hoy el módulo está construido **solo para el primer perfil**. Es correcto y debe mantenerse así para escritorio — pero no hay ninguna adaptación para el segundo. Esta propuesta no descarta lo existente: separa claramente qué se conserva tal cual (desktop) y qué necesita una superficie nueva (mobile).

---

## 2. Diagnóstico del estado actual (con evidencia)

No es una evaluación abstracta — esto es lo que hay hoy en el código:

| Componente | Estado actual | Problema para mobile |
|---|---|---|
| `ReceiveDialog` (`receive-dialog.tsx:148`) | `<DialogContent className="max-h-screen max-w-6xl! ...">` con `grid-cols-5` fijo (`:209`), panel izquierdo `col-span-2` + derecho `col-span-3` | Sin ningún prefijo `md:`/`sm:` — en una pantalla de 375–414px de ancho el grid de 5 columnas no colapsa, el diálogo se ve aplastado o requiere scroll horizontal. Es, literalmente, la misma vista que en un monitor de 27". |
| `DataTable` (`data-table.tsx`) | TanStack Table genérico envuelto en `<Table>` de shadcn | Patrón estándar: en pantallas angostas hace scroll horizontal. Aceptable para un supervisor comparando columnas; inutilizable para un operario con el celular en una mano mientras sostiene una caja con la otra. |
| `QtyInput` (`receive-dialog.tsx:47-98`) | Steppers `size-10` + input `h-14 text-3xl` | **Este ya es un buen patrón táctil** — objetivo de 40px+ y número gigante legible. Vale la pena preservarlo y generalizarlo, no rehacerlo. |
| `BarcodeScanner` (`barcode-scanner.tsx`) | Cámara vía `BarcodeDetector` + fallback manual, debounce de 2s contra doble lectura (`:90`), overlay de mira | Buena base técnica. Le faltan las señales que un operario necesita **sin mirar la pantalla de cerca**: sonido/vibración al leer, aviso inmediato de duplicado, freno automático al llegar a la meta. |
| Captura de series (`receive-dialog.tsx:387-441`) | Textarea que acumula un valor por línea, contador `X/Y` sobre el campo, validación de duplicados y de conteo | **Ya cubre la funcionalidad base** que pediste (recibir con serie) — ver §6 para qué tan completo está y qué falta pulir. |
| KPIs (`page.tsx:325`) | `grid-cols-2 lg:grid-cols-4` | Correcto, ya es responsive. |

**Conclusión:** no falta funcionalidad de negocio para mobile — falta una *superficie de interacción* pensada para el piso. El store y las acciones (`receiveAsn`, etc.) sirven para ambos casos sin cambios.

---

## 3. Principios para cada superficie

### Desktop (mantener y reforzar)
- Densidad de información alta es correcta: tablas, KPIs, filtros múltiples.
- Mouse + teclado: atajos de teclado para acciones repetitivas (ej. `Enter` para confirmar, `Esc` para cerrar) ya funcionan vía shadcn `Dialog` — verificar que se conserven.
- Diálogos anchos como `ReceiveDialog` están bien en este contexto — no se tocan para desktop.

### Mobile / operario de piso
- **Una tarea, una pantalla.** Nada de paneles de dos columnas ni formularios largos con scroll.
- **Escanear > escribir.** Cualquier campo que pueda llenarse con cámara o lector RF debe ofrecerlo primero; el teclado es el respaldo, no la opción por defecto.
- **Zona del pulgar.** La acción principal (confirmar, siguiente paso) vive fija en la franja inferior de la pantalla — nunca al final de un formulario largo que requiere scroll para llegar a ella.
- **Objetivos táctiles ≥ 44–48px.** Los operarios usan guantes o tienen las manos sudadas/sucias; nada de botones pequeños de escritorio reutilizados.
- **Texto ≥ 16px en inputs.** Evita el zoom automático de Safari/iOS al enfocar un campo y mejora la lectura a distancia de brazo.
- **Feedback multisensorial, no solo visual.** Un beep + vibración corta al escanear correctamente, un patrón distinto (doble vibración) en error/duplicado — el operario no siempre está mirando fijo la pantalla.
- **Alto contraste.** Los andenes suelen tener luz muy variable (portones abiertos, luz de patio vs. interior). Validar contraste AA también en modo claro con luz directa, no solo en modo oscuro.
- **Tolerancia a mala conexión.** La PWA ya existe (`public/manifest.json`, `public/sw.js`); una acción de recepción hecha sin señal debería poder quedar en cola local (IndexedDB, que ya es el storage del store) y reintentarse, no perderse.

---

## 4. Propuesta de arquitectura: misma lógica, dos superficies

No se propone reescribir el store ni las reglas de negocio — `receiveAsn`, `putawayItem`, `approveQc`, etc. sirven igual para ambas superficies. Lo que cambia es **cómo se presenta el mismo flujo**. Dos caminos posibles, para evaluar:

**Opción A — Layout responsive dentro de la misma ruta.**
`/receiving` detecta `useIsMobile()` (ya existe en `src/hooks/use-mobile.ts`) y, en vez de abrir `ReceiveDialog` como modal ancho, navega a una vista de pantalla completa tipo asistente (wizard) para las acciones de piso (recibir, escanear series, QC). Los tabs de tabla (Órdenes, Citas) se comprimen a lista de tarjetas.
- ✅ Un solo código de rutas, más fácil de mantener a futuro.
- ⚠️ El componente crece en complejidad condicional (`isMobile ? <Wizard/> : <Dialog/>`).

**Opción B — Ruta dedicada "modo operario".**
Una ruta aparte, ej. `/receiving/scan`, pensada 100% para el flujo de piso (recibir + escanear series + QC rápido), enlazada desde un botón grande "Modo escáner" en `/receiving`. `/receiving` de escritorio no cambia en absoluto.
- ✅ Cero riesgo de romper la vista de escritorio existente; se puede iterar el modo operario de forma aislada.
- ⚠️ Dos superficies que mantener en paralelo si el flujo de negocio cambia (ej. nueva validación en `receiveAsn`).

**Recomendación:** empezar con la **Opción B** para el flujo de recepción física + series (el de mayor fricción hoy), y evaluar migrar a la A una vez el patrón esté validado con operarios reales.

---

## 5. Flujo mobile propuesto — "Registrar entrega"

Wizard de pantalla completa, un paso visible a la vez, barra de progreso arriba, acción primaria siempre fija abajo:

```
┌─────────────────────────────┐  ┌─────────────────────────────┐
│ ← ASN-2607-014      1 de 3  │  │ ← ASN-2607-014      2 de 3  │
│ ●●○                         │  │ ●●●                         │
│                             │  │                             │
│  [foto producto]            │  │  Unidades en buen estado    │
│  Nevera No-Frost 350L       │  │                             │
│  Pendiente: 40 uds          │  │   [ − ]   40   [ + ]        │
│                             │  │      (fuente 3xl, h-14+)    │
│  Proveedor: Whirlpool       │  │                             │
│  Entrega #1                 │  │  Dañadas                    │
│                             │  │   [ − ]    0   [ + ]        │
│                             │  │                             │
│  [Requiere QC]  [Cross-dock]│  │                             │
│                             │  │                             │
├─────────────────────────────┤  ├─────────────────────────────┤
│      [ Continuar → ]        │  │      [ Continuar → ]        │
└─────────────────────────────┘  └─────────────────────────────┘
```

Paso 3 (solo si el producto rastrea por serie) — ver §6 para el detalle completo de esta pantalla.

El footer de acción (`[ Continuar → ]`) reutiliza el mismo componente `QtyInput` que ya existe — no hay que rediseñar el stepper, solo darle una pantalla propia en vez de compartirla con un panel lateral.

---

## 6. Recepción con número de serie — estado actual y mejoras

### Lo que ya funciona (no hay que reconstruirlo)

- `Asn`/`Product.trackBy === 'serial'` ya dispara el panel de captura (`receive-dialog.tsx:388`).
- `BarcodeScanner` ya soporta cámara (`BarcodeDetector`) + entrada manual como respaldo.
- La validación de conteo (`X/Y capturadas`) y de duplicados (`serialsDuplicated`) ya es en vivo, mientras se escribe/escanea (`use-receive-dialog.ts:56-63`).
- El textarea ya acepta pegado masivo (una serie por línea o separadas por coma) — útil si el proveedor manda un archivo con las series y el operario las copia.

### Lo que se propone mejorar para uso rápido en piso

```
┌─────────────────────────────────┐
│ ← Escanear series      3 de 3   │
│ ●●●                             │
│                                 │
│   ┌───────────────────────┐     │
│   │                       │     │
│   │     [ vista cámara ]  │     │
│   │      ⌐┐         ┌⌐    │     │
│   │      └┘         └┘    │     │
│   │                       │     │
│   └───────────────────────┘     │
│                                 │
│        ✓ 7 de 12 escaneadas     │
│                                 │
│   SN-88213-A   ✓ agregada       │
│   SN-88214-B   ⚠ duplicada      │
│                                 │
│   [ ⟲ Deshacer último ]  [⌨]    │
├─────────────────────────────────┤
│    [ Continuar (7/12) → ]       │
└─────────────────────────────────┘
```

1. **Beep + vibración por lectura válida** (`navigator.vibrate(60)` + un tono corto vía Web Audio API) — señal inmediata sin tener que leer el contador. Vibración distinta (doble pulso) en serie duplicada o inválida. La infraestructura de detección ya existe en `BarcodeScanner`; solo falta enganchar el callback `onScan` a esta señal.
2. **Rechazo inmediato de duplicados en el momento del escaneo**, no solo al enviar el formulario — hoy `serialsDuplicated` se calcula sobre el texto completo, lo cual ya es "en vivo", pero la cámara sigue escaneando sin avisar cuál lectura puntual fue el duplicado. Mostrar un toast/aviso puntual ("Este número ya fue escaneado") en el momento exacto del escaneo.
3. **Freno automático al llegar a la meta** — cuando `parsedSerials.length === goodQtyNum`, detener la cámara sola y mostrar el estado "Completo ✓" en vez de dejar la cámara corriendo esperando que el operario se dé cuenta.
4. **"Deshacer último escaneo"** — un botón visible sin tener que editar texto a mano dentro del textarea (hoy la única forma de corregir un escaneo erróneo es borrar manualmente dentro del campo de texto).
5. **Teclado numérico grande como respaldo**, no un textarea genérico — para series que son solo dígitos, un input `inputmode="numeric"` con teclado grande reduce errores de tipeo frente al teclado completo de un textarea normal. Si las series mezclan letras (como en los ejemplos sembrados, ej. `TVS-2026-0001`), mantener el textarea actual como respaldo.
6. **Mantener el pegado masivo actual** — es exactamente lo que un operario necesita si el proveedor ya mandó las series en digital; no reemplazar el textarea, solo agregarle las señales de los puntos 1-4 encima.

---

## 7. Tablas → tarjetas en mobile

Para las pestañas de lista (Órdenes, Citas, QC, Putaway), reemplazar `DataTable` por una lista de tarjetas apiladas por debajo de 768px (mismo breakpoint que ya usa `useIsMobile()`):

```
┌─────────────────────────────────┐
│ ASN-2607-014          [Parcial] │
│ Whirlpool · Nevera No-Frost 350L│
│ ▓▓▓▓▓▓▓▓░░░░░░  60%             │
│ Pendiente: 40 uds               │
│                                 │
│        [ Continuar recepción ]  │
└─────────────────────────────────┘
```

Una acción primaria grande por tarjeta (la misma que hoy es un botón de icono pequeño en la columna de acciones de `DataTable`), datos secundarios en texto pequeño debajo del título. Esto reutiliza los mismos `columns-*.tsx` como fuente de datos — solo cambia el renderer visual en mobile, no la lógica de qué acciones están disponibles (`canReceive`, `canQc`, `canPutaway`, etc. en `page.tsx:112-138` ya calculan exactamente esto).

---

## 8. Comparativa rápida por tarea

| Tarea | Desktop hoy | Mobile propuesto |
|---|---|---|
| Ver todas las ASN pendientes | Tabla con columnas, filtros, búsqueda | Lista de tarjetas, una acción primaria por tarjeta |
| Registrar entrega | Diálogo ancho de 2 paneles | Wizard de pantalla completa, 1 paso a la vez |
| Capturar series | Textarea + cámara dentro del mismo diálogo | Pantalla dedicada cámara-primero, con beep/vibración/freno automático |
| Aprobar/rechazar QC | Diálogo con detalle completo | Igual de diálogo simple — QC normalmente lo hace un supervisor, no el operario de piso, así que no es prioritario para el modo mobile |
| Crear orden de compra | Formulario completo | No aplica a mobile — tarea de oficina, se mantiene solo en desktop |

---

## 9. Priorización sugerida

**Quick wins (bajo esfuerzo, alto impacto — no requieren nueva ruta):**
- Agregar breakpoints reales a `ReceiveDialog` (`grid-cols-1 md:grid-cols-5`) para que al menos no se rompa si se abre en una pantalla angosta hoy mismo.
- Enganchar beep + vibración al `onScan` de `BarcodeScanner`.
- Freno automático de cámara al llegar a la meta de series.
- Botón "Deshacer último escaneo".

**Esfuerzo medio:**
- Vista de tarjetas para las listas en `<768px` (Opción A de §4, solo para las tablas, sin tocar los diálogos todavía).

**Esfuerzo mayor:**
- Ruta dedicada "modo operario" (`/receiving/scan`, Opción B de §4) con el wizard completo de recepción + captura de series.
- Cola offline (encolar `receiveAsn` sin conexión y reintentar al reconectar) — depende de qué tan real sea el problema de cobertura Wi-Fi en el andén.

---

## 10. Preguntas abiertas antes de construir

- ¿El dispositivo real en el andén es un celular personal (BYOD), una tablet montada, o una terminal RF dedicada (Zebra/Honeywell)? Cambia el tamaño de pantalla objetivo y si vale la pena invertir en integración `DataWedge` en vez de `BarcodeDetector`.
- ¿Hay Wi-Fi confiable en el andén de recepción, o el modo offline-con-cola es un requisito real y no un "nice-to-have"?
- ¿QC en piso lo hace el mismo operario que recibe, o siempre un rol distinto (supervisor de calidad)? Esto decide si vale la pena meter QC dentro del modo mobile o dejarlo solo en desktop.

---

*Documento de propuesta — Módulo de Recepción (UX/UI Desktop + Mobile) — 2026-07-23. Para evaluación, ningún cambio de código aplicado todavía.*
