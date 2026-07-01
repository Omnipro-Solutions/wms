# Industrial Orange Theme — Design Spec

**Date:** 2026-06-26  
**Scope:** New CSS preset `industrial` + set as app default

---

## Goal

Replace the neutral default palette with a naranja óxido / industrial identity. Workers in a warehouse context respond to high-contrast, high-legibility interfaces. The new theme should feel like equipment UI — not a SaaS dashboard.

---

## Palette

### Light mode

| Token | OKLCH | Approx hex | Role |
|-------|-------|------------|------|
| `--background` | `oklch(0.98 0.005 40)` | `#FAFAF8` | Off-white with warm tint |
| `--foreground` | `oklch(0.13 0 0)` | `#1A1A1A` | Near-black text |
| `--card` | `oklch(1 0 0)` | `#FFFFFF` | Pure white cards |
| `--card-foreground` | `oklch(0.13 0 0)` | `#1A1A1A` | Card text |
| `--primary` | `oklch(0.55 0.18 38)` | `≈ #C2410C` | Naranja óxido — CTAs, active states |
| `--primary-foreground` | `oklch(1 0 0)` | `#FFFFFF` | Text on primary |
| `--secondary` | `oklch(0.95 0.01 40)` | `≈ #F2EDE9` | Warm gray secondary |
| `--secondary-foreground` | `oklch(0.25 0 0)` | `#333` | Secondary text |
| `--muted` | `oklch(0.95 0.01 40)` | `≈ #F2EDE9` | Muted backgrounds |
| `--muted-foreground` | `oklch(0.52 0.01 40)` | `≈ #7A6F6A` | Muted text |
| `--accent` | `oklch(0.92 0.03 38)` | `≈ #EDE0D9` | Hover/highlight warm |
| `--accent-foreground` | `oklch(0.25 0 0)` | `#333` | Accent text |
| `--destructive` | `oklch(0.577 0.245 27.325)` | red | Errors (unchanged) |
| `--border` | `oklch(0.88 0.015 38)` | `≈ #E0D5CE` | Warm-tinted borders |
| `--input` | `oklch(0.93 0.01 40)` | `≈ #EDE8E4` | Input backgrounds |
| `--ring` | `oklch(0.55 0.18 38)` | `≈ #C2410C` | Focus ring matches primary |
| `--sidebar` | `oklch(0.16 0.015 38)` | `≈ #261E1A` | Dark charcoal, warm tint |
| `--sidebar-foreground` | `oklch(0.92 0 0)` | `≈ #EAEAEA` | Light text in sidebar |
| `--sidebar-primary` | `oklch(0.62 0.18 38)` | `≈ #D4561A` | Active nav item |
| `--sidebar-primary-foreground` | `oklch(1 0 0)` | `#FFFFFF` | Active nav text |
| `--sidebar-accent` | `oklch(0.23 0.015 38)` | `≈ #362B26` | Hover in sidebar |
| `--sidebar-accent-foreground` | `oklch(0.92 0 0)` | `≈ #EAEAEA` | Sidebar hover text |
| `--sidebar-border` | `oklch(1 0 0 / 10%)` | transparent white | Sidebar dividers |
| `--sidebar-ring` | `oklch(0.62 0.18 38)` | `≈ #D4561A` | Sidebar focus ring |

### Dark mode

| Token | OKLCH | Role |
|-------|-------|------|
| `--background` | `oklch(0.14 0.01 38)` | Deep antracite, warm tint |
| `--foreground` | `oklch(0.93 0 0)` | Near-white text |
| `--card` | `oklch(0.19 0.01 38)` | Cards slightly lighter than bg |
| `--card-foreground` | `oklch(0.93 0 0)` | Card text |
| `--popover` | `oklch(0.19 0.01 38)` | Popover bg |
| `--popover-foreground` | `oklch(0.93 0 0)` | Popover text |
| `--primary` | `oklch(0.62 0.18 38)` | Slightly lighter óxido on dark |
| `--primary-foreground` | `oklch(1 0 0)` | White on primary |
| `--secondary` | `oklch(0.24 0.01 38)` | Dark warm secondary |
| `--secondary-foreground` | `oklch(0.93 0 0)` | Secondary text |
| `--muted` | `oklch(0.24 0.01 38)` | Muted bg dark |
| `--muted-foreground` | `oklch(0.65 0 0)` | Muted text dark |
| `--accent` | `oklch(0.26 0.02 38)` | Hover dark |
| `--accent-foreground` | `oklch(0.93 0 0)` | Hover text dark |
| `--destructive` | `oklch(0.704 0.191 22.216)` | Errors dark (unchanged) |
| `--border` | `oklch(1 0 0 / 12%)` | Subtle borders |
| `--input` | `oklch(1 0 0 / 15%)` | Input borders dark |
| `--ring` | `oklch(0.62 0.18 38)` | Focus ring |
| `--sidebar` | `oklch(0.11 0.01 38)` | Darker than background |
| `--sidebar-foreground` | `oklch(0.92 0 0)` | Sidebar text |
| `--sidebar-primary` | `oklch(0.62 0.18 38)` | Active nav item |
| `--sidebar-primary-foreground` | `oklch(1 0 0)` | Active nav text |
| `--sidebar-accent` | `oklch(0.20 0.01 38)` | Sidebar hover |
| `--sidebar-accent-foreground` | `oklch(0.92 0 0)` | Sidebar hover text |
| `--sidebar-border` | `oklch(1 0 0 / 10%)` | Sidebar dividers |
| `--sidebar-ring` | `oklch(0.62 0.18 38)` | Sidebar focus ring |

### Chart colors (both modes)
Reuse warm/earthy tones to stay coherent: orange, amber, slate, stone, red.

---

## Signature element

Sidebar dark (`oklch(0.16)` charcoal warm) against light content area. The active nav item in naranja óxido acts like safety marking on industrial equipment — immediately readable, no ambiguity about where you are.

---

## Files to create/modify

| File | Action |
|------|--------|
| `src/styles/presets/industrial.css` | **Create** — full light + dark token set |
| `src/lib/preferences/theme.ts` | **Edit** — add `industrial` entry inside `generated:themePresets` block |
| `src/lib/preferences/preferences-config.ts` | **Edit** — change `theme_preset` default from `"default"` to `"industrial"` |
| `src/app/globals.css` | **Edit** — add `@import '../styles/presets/industrial.css'` |

---

## Constraints

- `--radius` stays at `0.625rem` (same as default/tangerine) — no shape change
- Chart colors updated to warm/earthy palette for coherence but functional palette unchanged
- No component files modified — pure CSS token swap
- Existing presets (`brutalist`, `soft-pop`, `tangerine`, `default`) remain available

---

## Out of scope

- KpiCard redesign (separate spec exists: `2026-06-25-kpi-card-redesign.md`)
- Sidebar dark/light override logic
- Per-section tinting
