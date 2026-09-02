# Recipe app color schema — Revolut marketing tokens

Source of truth: [`DESIGN.md`](./DESIGN.md) (Revolut marketing analysis). This file maps those tokens onto Mise’s existing NativeWind slots. Do not invent hexes, radii, or type sizes that are not in `DESIGN.md`.

Aeonik Pro is not licensed here. Display and UI type use **Inter** (`@expo-google-fonts/inter`), with Inter 500 and −1% tracking on display sizes.

---

## Two-mode canvas

| Mode                | Surface                     | Hex                      | Role                         |
| ------------------- | --------------------------- | ------------------------ | ---------------------------- |
| Browse (`:root`)    | `{colors.canvas-light}`     | `#ffffff`                | App canvas                   |
| Browse              | `{colors.surface-soft}`     | `#f4f4f4`                | Wells, chips, soft buttons   |
| Browse              | `{colors.surface-card}`     | `#ffffff`                | Cards                        |
| Browse              | `{colors.ink}`              | `#191c1f`                | Body / titles                |
| Browse              | `{colors.hairline-light}`   | `#e2e2e7`                | Dividers                     |
| Cook (`.cook-dark`) | `{colors.canvas-dark}`      | `#000000`                | True black — never `#0a0a0a` |
| Cook                | `{colors.surface-elevated}` | `#16181a`                | Elevated cards on black      |
| Cook                | `{colors.on-dark}`          | `#ffffff`                | Primary type on black        |
| Cook                | `{colors.on-dark-mute}`     | `rgba(255,255,255,0.72)` | Secondary type               |
| Cook                | `{colors.hairline-dark}`    | `rgba(255,255,255,0.12)` | Dividers                     |

Elevation is luminance only. No drop shadows.

**Cobalt** `{colors.primary}` `#494fdf` is scarce: featured badge, brand stamp, favorite-on. It is not a page fill and not the primary CTA.

---

## CTAs

| Surface            | Component                                          | Fill                  | Label              |
| ------------------ | -------------------------------------------------- | --------------------- | ------------------ |
| Cook / cooking-now | `{component.button-primary}`                       | white `#ffffff`       | black `#000000`    |
| Browse             | `{component.button-dark}`                          | black `#000000`       | `{colors.on-dark}` |
| Soft               | `{component.button-soft}`                          | `#f4f4f4`             | `{colors.ink}`     |
| Outline            | `{component.button-outline-*}`                     | canvas + 1px hairline | ink / on-dark      |
| Destructive        | outline + `{colors.accent-danger}` `#e23b4a` label |                       |                    |

All buttons are pills (`{rounded.full}`), 48px tall. Inputs are 56px / `{rounded.md}` 12px. Cards are `{rounded.lg}` 20px.

---

## CSS variable remap

Existing class names (`bg-peach`, `border-crust`, `text-espresso`) keep working. Hexes now point at Revolut surfaces:

```text
--color-bg:              #ffffff    canvas-light
--color-bg-elevated:     #ffffff    surface-card
--color-surface:         #f4f4f4    surface-soft
--color-border:          #e2e2e7    hairline-light
--color-text:            #191c1f    ink
--color-text-muted:      #505a63    mute
--color-text-disabled:   #8d969e    stone
--color-icon:            #3a3d40    charcoal
--color-primary:         #494fdf    cobalt stamp (not CTA fill)
--color-primary-pressed: #3a40c4    primary-deep
--color-primary-soft:    #f4f4f4    surface-soft
--color-on-primary:      #ffffff
--color-secondary:       #428619    accent-light-green (text/icon only)
--color-secondary-soft:  #f4f4f4    surface-soft
--color-accent:          #b09000    accent-yellow (illustration)
--color-favorite:        #494fdf    cobalt stamp
--color-chili:           #e23b4a    accent-danger
--color-sky:             #007bc2    accent-light-blue
--color-linen / peach:   #f4f4f4    surface-soft
--color-butter:          #ffffff    surface-card
--color-crust:           #e2e2e7    hairline-light
--color-espresso:        #191c1f    ink
--color-olive:           #505a63    mute
--color-sage:            #8d969e    stone
```

Cook shell (`.cook-dark`) remaps the same names onto `{colors.canvas-dark}`, `{colors.surface-elevated}`, `{colors.on-dark}`, and `{colors.hairline-dark}`.

---

## Accents (illustration / iconography only)

Never use these as button fills: teal `#00a87e`, pink `#e61e49`, light-green `#428619`, warning `#ec7e00`, yellow `#b09000`, brown `#936d62`. Success copy uses `{colors.accent-green-text}` `#006400`. Links use `{colors.link}` `#376cd5`.

Daisy the cat keeps her own fur/apron hexes in `src/components/daisy/colors.ts`.
