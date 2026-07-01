# Demo Script — WMS Client Presentation

**Fecha:** 2026-06-30  
**Audiencia:** Mix directivos + coordinadores operativos (45–60 min)  
**Contexto:** Cliente retail/moda Colombia, operación actual en Excel/papel

---

## Narrativa central

**Personaje:** Carlos, coordinador de bodega CEDI Bogotá. Su día real, digitalizado.

**Hilo conductor:** Carlos llega al turno, enfrenta una recepción con discrepancia, un producto dañado, necesidad de traslado entre bodegas, oleada de picking con parcial, empaque y devolución de un cliente ecommerce. Todo en 45-60 minutos.

---

## Estructura en 3 actos

### Introducción — 5 min
- Pantalla: **Dashboard**
- Apertura con KPIs en tiempo real
- Pain: sin visibilidad al inicio del turno

### Acto I — Recepción · 10 min

| Escena | Módulo | Tiempo |
|--------|--------|--------|
| 1. Cita proveedor llegando | Recepción → Citas ASN | 3 min |
| 2. Recepción compra con discrepancia | Recepción → ASN activo | 5 min |

### Acto II — Almacén · 15 min

| Escena | Módulo | Tiempo |
|--------|--------|--------|
| 3. Etiquetado producto + ubicación | Etiquetas | 4 min |
| 4. Slotting — recomendación automática | Slotting → Recomendaciones | 5 min |
| 5. Forecast demanda por SKU | Slotting → ABC/XYZ | 3 min |
| 6. Traslado CEDI Medellín → Bogotá | Traslados | 3 min |
| 7. Caso interno: producto dañado → scrap | Inventario (hold + ajuste) | 3 min |

### Acto III — Despacho · 15 min

| Escena | Módulo | Tiempo |
|--------|--------|--------|
| 8. Oleada mañana + picking | Picking → Oleadas | 6 min |
| 9. Picking parcial (8 de 10) | Picking → Tareas | 4 min |
| 10. Packing: caja sugerida + etiqueta | Packing | 4 min |
| 11. Devolución ecommerce → reingreso | Devoluciones | 5 min |

### Cierre — 10 min
- Frases de cierre (ver guión completo)
- Q&A con respuestas preparadas

---

## Datos de demo (seed existente)

| Entidad | Valor |
|---------|-------|
| Bodega principal | CEDI Bogotá (wh-bog) |
| Bodega origen traslado | CEDI Medellín (wh-med) |
| Tiendas destino | Andino (wh-andino), Santa Fe (wh-santafe) |
| SKU 1 | Camiseta Básica Negra — TS-BLK-001 |
| SKU 2 | Jean Slim Azul — JN-BLU-002 (producto estrella demo) |
| SKU 3 | Tenis Urbanos Blancos — SN-WHT-003 (caso scrap) |
| SKU 4 | Hoodie Oversize — HD-OVR-010 (picking parcial) |
| SKU 5 | Vestido Floral — DR-FLR-008 (devolución) |
| Proveedor demo | Confecciones Medellín S.A. |
| Operario 1 | Carlos Granados — picking zona A |
| Operario 2 | Andrés Gómez — picking zona B |
| Operario 3 | Paula Vega — packing |

---

## Frases clave de cierre

1. "Todo lo que vieron hoy — Carlos lo hace hoy en Excel y papel. ¿Cuántas horas pierde por semana en eso?"
2. "Cada vez que el inventario es inexacto, ustedes pierden ventas o venden lo que no tienen. Este sistema elimina eso desde el primer día."
3. "No es un sistema más. Es la operación de Carlos, digitalizada."

---

## Preguntas frecuentes anticipadas

| Pregunta | Respuesta / Pantalla |
|----------|---------------------|
| ¿Se integra con nuestro ERP? | Mostrar Integraciones: SAP, ecommerce, carriers |
| ¿Cuánto tarda la implementación? | Seed data para onboarding rápido |
| ¿Nuestros operarios pueden aprender esto? | UI en español, flujos guiados, sin jerga técnica |

---

## Referencia

Guión completo con scripts línea por línea: publicado en [Artifact — Demo WMS](https://claude.ai/code/artifact/19443c3f-46ae-43a0-8804-4b241c8fc6c6)
