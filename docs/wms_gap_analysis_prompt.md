# Prompt: Auditoría Funcional WMS MVP — Análisis de Brechas (Gap Analysis)

## Contexto del Proyecto

Eres un **arquitecto de software senior y analista funcional experto en WMS**. Tienes frente a ti un MVP de un sistema WMS desarrollado en **Next.js con data seed**. Tu misión es auditar exhaustivamente ese MVP contra una lista de **101 requerimientos funcionales** organizados en 7 secciones, y producir un **reporte de brechas accionable**.

---

## Tu Tarea

1. **Explorar el código fuente del MVP** de forma sistemática.
2. **Evaluar cada uno de los 101 requerimientos** contra lo que existe en el código.
3. **Clasificar el estado de cada requerimiento** con uno de estos tres valores:
   - ✅ `CUBIERTO` — Existe implementación funcional (no solo UI estática ni seed data).
   - ⚠️ `PARCIAL` — Hay alguna base (modelo, componente, ruta) pero falta lógica de negocio, validaciones o integración real.
   - ❌ `FALTANTE` — No existe ninguna implementación relevante.
4. **Generar el reporte de brechas** en formato Markdown estructurado.

---

## Instrucciones de Exploración

Antes de evaluar, ejecuta estos pasos de reconocimiento del proyecto:

```bash
# 1. Estructura general del proyecto
find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" | grep -v node_modules | grep -v .next | sort

# 2. Modelos / esquemas de datos (Prisma, Drizzle, SQL, etc.)
find . -name "schema.prisma" -o -name "*.sql" -o -name "schema.ts" | grep -v node_modules

# 3. Rutas API (Next.js App Router o Pages Router)
find . -path "*/api/*" -name "*.ts" | grep -v node_modules | sort

# 4. Páginas y componentes principales
find . -path "*/app/*" -name "page.tsx" | grep -v node_modules | sort
find . -path "*/pages/*" -name "*.tsx" | grep -v node_modules | sort

# 5. Servicios / lógica de negocio
find . -name "*.service.ts" -o -name "*.actions.ts" -o -name "*.lib.ts" | grep -v node_modules | sort

# 6. Data seed
find . -name "seed*" -o -name "*.seed.ts" | grep -v node_modules | sort
```

Lee los archivos más relevantes encontrados. Prioriza:
- Modelos de base de datos (schema, migrations).
- Endpoints API (rutas, handlers).
- Lógica de negocio (services, actions, hooks de servidor).
- Ignora archivos de UI puramente estáticos si no tienen lógica asociada.

---

## Los 101 Requerimientos a Evaluar

Evalúa **cada ítem individualmente**. No agrupes. No omitas ninguno.

### SECCIÓN A — Capacidades WMS Core (ítems 1–27)

| # | Requerimiento | Criterio |
|---|---|---|
| 1 | ¿Gestiona el ciclo completo de recepción (ASN, cita previa, control de calidad, putaway)? | Funcionalidad core |
| 2 | ¿Gestión de ubicaciones con lógica FIFO, FEFO, LIFO, peso, zona? | Gestión de ubicaciones |
| 3 | ¿Múltiples unidades de medida y conversiones automáticas (caja, pallet, pieza, set)? | Flexibilidad de UM |
| 4 | ¿Gestión de lotes y fechas de vencimiento configurable por categoría? | Control de lotes |
| 5 | ¿Múltiples almacenes y múltiples empresas en una sola instancia? | Multi-almacén/Multi-empresa |
| 6 | ¿Módulo de control de calidad integrado? | Control de calidad |
| 7 | ¿Operaciones de cross-docking (directo, indirecto, oportunístico)? | Cross-docking |
| 8 | ¿Gestión de devoluciones y RMA? | Gestión de devoluciones |
| 9 | ¿Traslados inter-almacén e inter-compañía? | Transferencias |
| 10 | ¿Reabastecimiento automático de ubicaciones de picking por reglas? | Reabastecimiento |
| 11 | ¿Gestión de equipos de manejo de materiales (montacargas, carretillas)? | Gestión de equipos |
| 12 | ¿Gestión de mano de obra y productividad (labor management)? | Gestión de labor |
| 13 | ¿Slotting (optimización de ubicaciones de almacén)? | Slotting |
| 14 | ¿Kitting y ensamble dentro del almacén? | Kitting/ensamble |
| 15 | ¿Gestión de números de serie a nivel de unidad (serialization)? | Serialización |
| 16 | ¿Tipos de ubicaciones: picking, reserva, cuarentena, fijas, doble fondo? | Gestión de ubicaciones |
| 17 | ¿Control de capacidad y volumetría por ubicación? | Gestión de ubicaciones |
| 18 | ¿Etiquetado propio en recibo + soporte impresoras Zebra/inalámbricas? | Etiquetado |
| 19 | ¿Órdenes de Putaway dirigidas por sistema? | Gestión de almacenaje |
| 20 | ¿Gestión de tipos de estiba según racks y producto? | Gestión de almacenaje |
| 21 | ¿Zonas de inventario temporal o cross-docking? | Cross-docking |
| 22 | ¿Aplicación móvil nativa para operaciones en piso (RF/voz)? | Movilidad operativa |
| 23 | ¿Compatibilidad con dispositivos RF/RFID (Zebra, Honeywell)? | Compatibilidad hardware |
| 24 | ¿Interfaz configurable sin programación (no-code/low-code)? | Configurabilidad |
| 25 | ¿Dashboards operativos en tiempo real para supervisores y gerentes? | Visibilidad operativa |
| 26 | ¿Soporte completo para español? | Soporte de idiomas |
| 27 | ¿Gestión de perfiles y roles con control granular de acceso? | Control de acceso |

### SECCIÓN B — Requerimientos Específicos Retail Multitienda (ítems 28–40)

| # | Requerimiento | Criterio |
|---|---|---|
| 28 | ¿Inventario centralizado con reabastecimiento automático a tiendas (min/max, punto de reorden, estacionalidad)? | Reabastecimiento tiendas |
| 29 | ¿Reglas de asignación de inventario por tienda, canal o región con prioridades dinámicas? | Asignación de inventario |
| 30 | ¿Órdenes de transferencia CD-tiendas con trazabilidad completa? | Transferencias CD-tienda |
| 31 | ¿Gestión de inventario en consignación? | Consignación |
| 32 | ¿Gestión de planogramas o layouts de exhibición que influyan en reposición? | Planogramas |
| 33 | ¿Integración con sistemas POS para actualización de inventario en tiempo real? | Integración POS |
| 34 | ¿Gestión de promociones y eventos especiales que afecten preparación de pedidos? | Gestión de promociones |
| 35 | ¿Pedidos urgentes y especiales para tiendas (rush orders)? | Órdenes urgentes |
| 36 | ¿Visibilidad consolidada de inventario en red (CD + todas las tiendas)? | Visibilidad de red |
| 37 | ¿Devoluciones desde tiendas al CD con trazabilidad y reintegración al inventario? | Devoluciones tiendas |
| 38 | ¿Gestión de inventario en tránsito entre CD y tiendas? | Inventario en tránsito |
| 39 | ¿Múltiples tipos de empaque y presentación para tiendas (packing, individual, caja master)? | Gestión de empaque |
| 40 | ¿Almacenes satélite o CDs secundarios por región? | CDs secundarios |

### SECCIÓN C — Requerimientos para Productos Serializados (ítems 41–53)

| # | Requerimiento | Criterio |
|---|---|---|
| 41 | ¿Serialización nativa o requiere customización? | Nativo vs. customización |
| 42 | ¿Registro y control del número de serie desde recepción en CD? | Captura en recepción |
| 43 | ¿Rastreo de número de serie en todo el ciclo (recepción, ubicación, picking, despacho)? | Trazabilidad completa |
| 44 | ¿Múltiples números de serie asociados a una misma orden? | Multi-serie por orden |
| 45 | ¿Impresión de etiquetas con número de serie, código de barras y/o QR? | Etiquetado en almacén |
| 46 | ¿Control de serialización en devoluciones desde tienda con identificación del N/S original? | Serialización en devoluciones |
| 47 | ¿Cambio de estado de número de serie (nuevo, dañado, reacondicionado, en garantía)? | Estados de N/S |
| 48 | ¿Integración del número de serie con ERP para trazabilidad financiera? | Integración ERP-serialización |
| 49 | ¿Captura de series mediante RFID además de código de barras? | RFID para series |
| 50 | ¿Reportes y consultas de trazabilidad de N/S con historial completo? | Reportes de trazabilidad |
| 51 | ¿Gestión de kits donde cada componente tiene su propio número de serie? | Kits serializados |
| 52 | ¿Validación automática de N/S contra listas de exclusión (robados, garantía expirada)? | Validación de N/S |
| 53 | ¿Capacidad técnica de N/S simultáneos en una sola instancia? | Escala de serialización |

### SECCIÓN D — Gestión de Inventarios (ítems 54–68)

| # | Requerimiento | Criterio |
|---|---|---|
| 54 | ¿Conteo cíclico configurable por zona, categoría, rotación o valor? | Conteo cíclico |
| 55 | ¿Inventarios generales con bloqueo de operaciones? | Inventario general |
| 56 | ¿Ajustes de inventario con niveles de aprobación configurables por monto o porcentaje? | Ajustes con aprobación |
| 57 | ¿Gestión de inventario negativo con controles para evitarlo? | Control de negativos |
| 58 | ¿Gestión de mermas y averías con categorización por causa (daño, robo, vencimiento)? | Gestión de mermas |
| 59 | ¿Productos en cuarentena con restricciones de movimiento y visibilidad diferenciada? | Cuarentena |
| 60 | ¿KPI de exactitud de inventario (IRA) reportado? | KPI de exactitud |
| 61 | ¿Alertas automáticas por desviaciones de inventario fuera de rangos predefinidos? | Alertas de desviación |
| 62 | ¿Múltiples niveles de clasificación de inventario (ABC, XYZ, ABCXYZ)? | Clasificación ABC |
| 63 | ¿Gestión de inventario en consignación con visibilidad diferenciada? | Consignación |
| 64 | ¿Gestión de antigüedad del inventario con alertas por SKUs de baja rotación? | Antigüedad de inventario |
| 65 | ¿Bloqueo selectivo de ubicaciones o pallets para QC sin afectar stock disponible? | Bloqueo selectivo |
| 66 | ¿Alertas de ubicación vacía o por debajo del mínimo? | Gestión de ubicaciones |
| 67 | ¿Consultas de paradero actual o histórico de movimientos por artículo y serie? | Inventario general |
| 68 | ¿Forecasting o proyección de inventario basada en historial de movimientos? | Proyección de inventario |

### SECCIÓN E — Gestión de Picking y Preparación de Pedidos (ítems 69–80)

| # | Requerimiento | Criterio |
|---|---|---|
| 69 | ¿Metodologías de picking nativas (unitario, por ola, por zona, batch, cluster)? | Metodologías de picking |
| 70 | ¿Optimización de rutas de picking para minimizar desplazamientos? | Optimización de rutas |
| 71 | ¿Picking asistido por RFID para verificación en tiempo real? | RFID en picking |
| 72 | ¿Estrategias de picking diferenciadas por canal (tienda vs. e-commerce vs. venta directa)? | Picking multicanal |
| 73 | ¿Picking parcial y consolidación de órdenes incompletas? | Picking parcial |
| 74 | ¿Picking con validación de número de serie en el momento de extracción? | Serialización en picking |
| 75 | ¿Manejo de excepciones durante el picking (ubicación vacía, daño, sustitución)? | Manejo de excepciones |
| 76 | ¿Medición de productividad individual por picker en tiempo real? | Productividad de picking |
| 77 | ¿Prioridades de picking basadas en ventanas de tiempo o SLA de entrega? | Prioridades por SLA |
| 78 | ¿Picking de artículos de gran volumen o peso especial con instrucciones diferenciadas? | Artículos especiales |
| 79 | ¿Zonas de chequeo de pedidos antes de pasar a despacho? | Gestión de ubicaciones |
| 80 | ¿Automatización del wave planning (planificación de oleadas)? | Wave planning |

### SECCIÓN F — Gestión de Despacho y Transporte (ítems 81–91)

| # | Requerimiento | Criterio |
|---|---|---|
| 81 | ¿Módulo de gestión de patio para control de muelles y puertas de despacho (Yard Management)? | Yard management |
| 82 | ¿Programación y gestión de citas de transporte (appointment scheduling)? | Programación de citas |
| 83 | ¿Generación automática de documentación de despacho (lista de empaque, guía de remisión, manifiesto, factura)? | Documentación de despacho |
| 84 | ¿Integración nativa con TMS? | Integración TMS |
| 85 | ¿Gestión de rutas de reparto y consolidación de cargas por destino? | Gestión de rutas |
| 86 | ¿Gestión de modalidades de transporte (propio, tercero, courier, last-mile)? | Multi-modal |
| 87 | ¿Verificación de carga (load verification) antes de despacho con validación de N/S? | Verificación de carga |
| 88 | ¿Despacho parcial de órdenes con actualización automática de saldos pendientes? | Despacho parcial |
| 89 | ¿Trazabilidad de entrega hasta destinatario final con confirmación de recepción? | Trazabilidad de entrega |
| 90 | ¿Gestión de carga de contenedores con cálculo de ocupación volumétrica? | Carga de contenedores |
| 91 | ¿Gestión de ventanas de entrega específicas para tiendas con restricciones de horario? | Ventanas de entrega |

### SECCIÓN G — Omnicanalidad y e-Commerce (ítems 92–101)

| # | Requerimiento | Criterio |
|---|---|---|
| 92 | ¿Modelo Ship-from-Store (SFS) con asignación de órdenes e-commerce a tiendas físicas? | Ship-from-Store |
| 93 | ¿Click & Collect (BOPIS – Buy Online, Pick-up in Store)? | Click & Collect / BOPIS |
| 94 | ¿Devoluciones de e-commerce en tienda física con re-integración al inventario? | Buy Online, Return In Store |
| 95 | ¿Integración con plataformas e-commerce (Shopify, Magento, WooCommerce, propias)? | Integración e-commerce |
| 96 | ¿Visibilidad de inventario disponible-para-promesa (ATP) en tiempo real para canal digital? | ATP en tiempo real |
| 97 | ¿Priorización de órdenes e-commerce vs. reposición de tiendas con reglas configurables? | Priorización de canales |
| 98 | ¿SLAs diferenciados por canal con alertas de incumplimiento en tiempo real? | SLAs multicanal |
| 99 | ¿Packaging personalizado o tiquetado por canal? | Packaging personalizado |
| 100 | ¿Cálculo y optimización de la fuente de fulfillment (CD, tienda, almacén externo) para minimizar costo y tiempo? | Optimización de fulfillment |
| 101 | ¿Gestión de suscripciones y pedidos recurrentes con preparación automática? | Pedidos recurrentes |

---

## Formato de Salida Requerido

Produce exactamente el siguiente reporte en Markdown, sin omitir ningún ítem:

---

```markdown
# Reporte de Brechas WMS MVP
**Fecha:** [fecha de ejecución]
**Proyecto:** [nombre del proyecto detectado en package.json o README]
**Stack detectado:** [tecnologías identificadas]

---

## Resumen Ejecutivo

| Categoría | Cantidad | % del total |
|---|---|---|
| ✅ Cubierto | X | X% |
| ⚠️ Parcial | X | X% |
| ❌ Faltante | X | X% |
| **Total** | **101** | **100%** |

**Cobertura funcional estimada del MVP:** X%

---

## Análisis por Sección

### A. Capacidades WMS Core (27 ítems)
| # | Requerimiento (resumido) | Estado | Evidencia en el código | Brecha / Recomendación |
|---|---|---|---|---|
| 1 | Ciclo completo de recepción | ✅/⚠️/❌ | `ruta/archivo.ts:línea` | [descripción de la brecha o "ninguna"] |
...

[Repetir tabla para cada sección B, C, D, E, F, G]

---

## Brechas Críticas (Prioridad Alta)

> Ítems ❌ FALTANTES o ⚠️ PARCIALES que bloquean el uso productivo del sistema o son requerimientos de negocio core.

1. **[#X] [Nombre del requerimiento]**
   - **Estado actual:** Descripción de lo que existe (o no existe).
   - **Impacto:** Por qué es crítico para el negocio.
   - **Esfuerzo estimado:** Bajo / Medio / Alto.
   - **Propuesta técnica:** Qué archivos crear/modificar, qué modelo de datos agregar, qué endpoint implementar.

[Listar todas las brechas críticas]

---

## Brechas Secundarias (Prioridad Media/Baja)

> Ítems ⚠️ PARCIALES o ❌ FALTANTES que son deseables pero no bloquean la operación inicial.

[Misma estructura que brechas críticas]

---

## Recomendaciones de Arquitectura

> Problemas estructurales detectados en el MVP que deberían corregirse antes de continuar el desarrollo.

1. [Recomendación con archivo específico y solución propuesta]
...

---

## Plan de Desarrollo Sugerido (Sprints)

### Sprint 1 — Estabilización Core (semana 1-2)
- [ ] Ítem #X: [descripción + archivo a crear/modificar]
- [ ] Ítem #Y: ...

### Sprint 2 — [Nombre] (semana 3-4)
- [ ] ...

### Sprint 3 — [Nombre] (semana 5-6)
- [ ] ...

[Tantos sprints como sean necesarios]

---

## Cobertura de Reglas de Negocio Clave

| Regla | ¿Implementada? | Archivo / Mecanismo |
|---|---|---|
| Inventario no se modifica directamente | ✅/❌ | |
| Toda operación genera movimiento auditable | ✅/❌ | |
| No permite inventario negativo por defecto | ✅/❌ | |
| Transacciones en operaciones críticas | ✅/❌ | |
| Control de concurrencia en stock/reservas | ✅/❌ | |
| Lógica de negocio separada en servicios | ✅/❌ | |
| JWT para autenticación | ✅/❌ | |
| Control de permisos por rol | ✅/❌ | |

```

---

## Restricciones y Reglas para la Evaluación

- **Sé conservador**: Si no encuentras código explícito que implemente la funcionalidad, márcalo como ❌. No asumas que "podría estar" sin evidencia.
- **Distingue UI de lógica**: Un formulario que renderiza campos no equivale a funcionalidad implementada si no hay API ni modelo detrás.
- **El seed data no cuenta**: Tener datos de prueba en la BD no equivale a tener la funcionalidad operativa.
- **Cita siempre la evidencia**: Para ✅ y ⚠️, indica el archivo y línea (o función) específica que soporta la evaluación.
- **No repitas el enunciado completo**: En la tabla, resume el requerimiento en máx. 8 palabras.
- **Evalúa las 8 reglas de negocio clave** al final, independientemente de los 101 ítems.

---

## Notas Adicionales

- Si el proyecto no tiene README, infiere el nombre del `package.json`.
- Si encuentras funcionalidades implementadas que **no están en los 101 ítems** pero son relevantes para un WMS, menciónalas en una sección "Funcionalidades adicionales detectadas" al final del reporte.
- Si detectas deuda técnica relevante (código sin pruebas, lógica duplicada, falta de manejo de errores en operaciones críticas), inclúyela en "Recomendaciones de Arquitectura".

---

*Generado con Claude Code — Auditoría funcional WMS MVP*
