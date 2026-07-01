# Industrial Orange Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a naranja óxido industrial CSS preset and set it as the app default theme.

**Architecture:** Pure CSS token swap via the existing `data-theme-preset` system. New file `industrial.css` defines all OKLCH color tokens for light and dark modes. Three additional files wire it into the type system and set it as default — zero component changes.

**Tech Stack:** CSS custom properties (OKLCH), TailwindCSS 4, Next.js App Router, TypeScript

## Global Constraints

- No component files modified — pure CSS token swap
- `--radius` stays `0.625rem` (unchanged from default)
- All OKLCH values must be valid (lightness 0–1, chroma ≥ 0, hue 0–360)
- Primary naranja óxido: light `oklch(0.55 0.18 38)`, dark `oklch(0.62 0.18 38)`
- Sidebar always dark charcoal in both modes (light: `oklch(0.16 0.015 38)`, dark: `oklch(0.11 0.01 38)`)
- Existing presets (`default`, `brutalist`, `soft-pop`, `tangerine`) must remain functional
- Spec: `docs/superpowers/specs/2026-06-26-industrial-orange-theme-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/styles/presets/industrial.css` | **Create** | All light + dark CSS tokens for the preset |
| `src/lib/preferences/theme.ts` | **Modify** lines 11–52 | Add `industrial` entry to `THEME_PRESET_OPTIONS` inside generated block |
| `src/lib/preferences/preferences-config.ts` | **Modify** line 70 | Change `theme_preset` default from `"default"` to `"industrial"` |
| `src/app/globals.css` | **Modify** | Add `@import` for industrial.css after other preset imports |

---

### Task 1: Create `industrial.css` preset file

**Files:**
- Create: `src/styles/presets/industrial.css`

**Interfaces:**
- Produces: CSS custom properties under `:root[data-theme-preset="industrial"]` and `.dark:root[data-theme-preset="industrial"]`

- [ ] **Step 1: Create the file with full light + dark token set**

Create `src/styles/presets/industrial.css` with this exact content:

```css
/* 
label: Industrial
value: industrial  
*/

:root[data-theme-preset="industrial"] {
  --radius: 0.625rem;
  --background: oklch(0.98 0.005 40);
  --foreground: oklch(0.13 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.13 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.13 0 0);
  --primary: oklch(0.55 0.18 38);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.95 0.01 40);
  --secondary-foreground: oklch(0.25 0 0);
  --muted: oklch(0.95 0.01 40);
  --muted-foreground: oklch(0.52 0.01 40);
  --accent: oklch(0.92 0.03 38);
  --accent-foreground: oklch(0.25 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.88 0.015 38);
  --input: oklch(0.93 0.01 40);
  --ring: oklch(0.55 0.18 38);
  --chart-1: oklch(0.55 0.18 38);
  --chart-2: oklch(0.65 0.15 55);
  --chart-3: oklch(0.48 0.08 38);
  --chart-4: oklch(0.72 0.1 60);
  --chart-5: oklch(0.38 0.06 38);
  --sidebar: oklch(0.16 0.015 38);
  --sidebar-foreground: oklch(0.92 0 0);
  --sidebar-primary: oklch(0.62 0.18 38);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.23 0.015 38);
  --sidebar-accent-foreground: oklch(0.92 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.62 0.18 38);
  --shadow-2xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm: 0px 1px 3px 0px hsl(0 0% 0% / 0.1), 0px 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow: 0px 1px 3px 0px hsl(0 0% 0% / 0.1), 0px 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow-md: 0px 1px 3px 0px hsl(0 0% 0% / 0.1), 0px 2px 4px -1px hsl(0 0% 0% / 0.1);
  --shadow-lg: 0px 1px 3px 0px hsl(0 0% 0% / 0.1), 0px 4px 6px -1px hsl(0 0% 0% / 0.1);
  --shadow-xl: 0px 1px 3px 0px hsl(0 0% 0% / 0.1), 0px 8px 10px -1px hsl(0 0% 0% / 0.1);
  --shadow-2xl: 0px 1px 3px 0px hsl(0 0% 0% / 0.25);
}

.dark:root[data-theme-preset="industrial"] {
  --background: oklch(0.14 0.01 38);
  --foreground: oklch(0.93 0 0);
  --card: oklch(0.19 0.01 38);
  --card-foreground: oklch(0.93 0 0);
  --popover: oklch(0.19 0.01 38);
  --popover-foreground: oklch(0.93 0 0);
  --primary: oklch(0.62 0.18 38);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.24 0.01 38);
  --secondary-foreground: oklch(0.93 0 0);
  --muted: oklch(0.24 0.01 38);
  --muted-foreground: oklch(0.65 0 0);
  --accent: oklch(0.26 0.02 38);
  --accent-foreground: oklch(0.93 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 12%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.62 0.18 38);
  --chart-1: oklch(0.62 0.18 38);
  --chart-2: oklch(0.70 0.15 55);
  --chart-3: oklch(0.52 0.08 38);
  --chart-4: oklch(0.76 0.1 60);
  --chart-5: oklch(0.42 0.06 38);
  --sidebar: oklch(0.11 0.01 38);
  --sidebar-foreground: oklch(0.92 0 0);
  --sidebar-primary: oklch(0.62 0.18 38);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.20 0.01 38);
  --sidebar-accent-foreground: oklch(0.92 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.62 0.18 38);
  --shadow-2xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-xs: 0px 1px 3px 0px hsl(0 0% 0% / 0.05);
  --shadow-sm: 0px 1px 3px 0px hsl(0 0% 0% / 0.1), 0px 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow: 0px 1px 3px 0px hsl(0 0% 0% / 0.1), 0px 1px 2px -1px hsl(0 0% 0% / 0.1);
  --shadow-md: 0px 1px 3px 0px hsl(0 0% 0% / 0.1), 0px 2px 4px -1px hsl(0 0% 0% / 0.1);
  --shadow-lg: 0px 1px 3px 0px hsl(0 0% 0% / 0.1), 0px 4px 6px -1px hsl(0 0% 0% / 0.1);
  --shadow-xl: 0px 1px 3px 0px hsl(0 0% 0% / 0.1), 0px 8px 10px -1px hsl(0 0% 0% / 0.1);
  --shadow-2xl: 0px 1px 3px 0px hsl(0 0% 0% / 0.25);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/presets/industrial.css
git commit -m "feat(theme): add industrial orange preset CSS tokens"
```

---

### Task 2: Register preset in type system

**Files:**
- Modify: `src/lib/preferences/theme.ts` lines 11–52

**Interfaces:**
- Consumes: `industrial.css` preset value `"industrial"` from Task 1
- Produces: `ThemePreset` union type now includes `"industrial"` | `THEME_PRESET_OPTIONS` has new entry with OKLCH primary values

- [ ] **Step 1: Add `industrial` entry inside the generated block**

In `src/lib/preferences/theme.ts`, replace the block between `// --- generated:themePresets:start ---` and `// --- generated:themePresets:end ---` (lines 11–52) with:

```ts
// --- generated:themePresets:start ---

export const THEME_PRESET_OPTIONS = [
  {
    label: "Default",
    value: "default",
    primary: {
      light: "oklch(0.205 0 0)",
      dark: "oklch(0.922 0 0)",
    },
  },
  {
    label: "Industrial",
    value: "industrial",
    primary: {
      light: "oklch(0.55 0.18 38)",
      dark: "oklch(0.62 0.18 38)",
    },
  },
  {
    label: "Brutalist",
    value: "brutalist",
    primary: {
      light: "oklch(0.6489 0.237 26.9728)",
      dark: "oklch(0.7044 0.1872 23.1858)",
    },
  },
  {
    label: "Soft Pop",
    value: "soft-pop",
    primary: {
      light: "oklch(0.5106 0.2301 276.9656)",
      dark: "oklch(0.6801 0.1583 276.9349)",
    },
  },
  {
    label: "Tangerine",
    value: "tangerine",
    primary: {
      light: "oklch(0.64 0.17 36.44)",
      dark: "oklch(0.64 0.17 36.44)",
    },
  },
] as const;

export const THEME_PRESET_VALUES = THEME_PRESET_OPTIONS.map((p) => p.value);

export type ThemePreset = (typeof THEME_PRESET_OPTIONS)[number]["value"];

// --- generated:themePresets:end ---
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `ThemePreset` or `theme_preset`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/preferences/theme.ts
git commit -m "feat(theme): register industrial preset in ThemePreset type"
```

---

### Task 3: Wire `@import` in globals.css

**Files:**
- Modify: `src/app/globals.css` lines 6–8

**Interfaces:**
- Consumes: `industrial.css` from Task 1

- [ ] **Step 1: Add import after existing preset imports**

In `src/app/globals.css`, after line 8 (`@import '../styles/presets/tangerine.css';`), add:

```css
@import '../styles/presets/industrial.css';
```

The imports block should now read:

```css
@import '../styles/presets/brutalist.css';
@import '../styles/presets/soft-pop.css';
@import '../styles/presets/tangerine.css';
@import '../styles/presets/industrial.css';
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): import industrial preset in globals.css"
```

---

### Task 4: Set industrial as default theme

**Files:**
- Modify: `src/lib/preferences/preferences-config.ts` line 70

**Interfaces:**
- Consumes: `"industrial"` value now valid in `ThemePreset` (Task 2)

- [ ] **Step 1: Change default from `"default"` to `"industrial"`**

In `src/lib/preferences/preferences-config.ts`, on line 70, change:

```ts
  theme_preset: "default",
```

to:

```ts
  theme_preset: "industrial",
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Start dev server and verify visually**

```bash
cd /Users/carlosgranados/Documents/develop/wms && npm run dev
```

Open `http://localhost:3000`. Expect:
- Sidebar: dark charcoal (`≈ #261E1A`)
- Primary buttons: naranja óxido (`≈ #C2410C`)
- Background: off-white warm
- Theme picker shows "Industrial" as selected option

- [ ] **Step 4: Commit**

```bash
git add src/lib/preferences/preferences-config.ts
git commit -m "feat(theme): set industrial orange as default app theme"
```
