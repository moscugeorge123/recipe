# Recipe app color schema — Airbnb marketing

Mise uses the Airbnb marketing analysis in `DESIGN.md`. Garden Plate token **names** (`paprika`, `cream`, `espresso`, `peach`, …) remain so screens and NativeWind classes keep compiling. Hexes now point at the documented canvas, ink, hairline, and scarce **Rausch** voltage. Do not invent extra colors, radii, type sizes, or shadow tiers.

Luxe (`#460479`) and Plus (`#92174d`) are documented sub-brand tokens. They are unused on mainline Mise screens.

---

## Mood

| Word | How it shows up |
| --- | --- |
| Generous | White canvas, 16px card gutters, photography-first cards |
| Scarce voltage | Rausch only on primary CTAs, the capture orb, saved hearts, brand links |
| Soft | 8px buttons, 14px photo cards, pill search, circular icon buttons |

---

## Core brand colors

| Token | Airbnb | Hex | Role |
| --- | --- | --- | --- |
| `paprika` | `{colors.primary}` Rausch | `#ff385c` | Primary CTAs, search orb, heart saved, brand links |
| `paprikaPressed` | `{colors.primary-active}` | `#e00b41` | Primary press |
| `paprikaSoft` | `{colors.primary-disabled}` | `#ffd1da` | Disabled primary |
| `cream` | `{colors.canvas}` | `#ffffff` | App background — public web has no dark mode |
| `espresso` | `{colors.ink}` | `#222222` | Headlines, body, active nav, star ratings |
| `basil` | ink (no second brand) | `#222222` | Former secondary fill — outline/ink, not a green |
| `honey` | `{colors.star-rating}` | `#222222` | Stars and ratings are ink, never yellow |
| `berry` | Rausch | `#ff385c` | Favorite heart saved state |

**Do not use Rausch as body text on canvas.** It is for CTAs, the orb, and saved hearts.

---

## Surfaces, hairlines, type

| Token | Airbnb | Hex | Use |
| --- | --- | --- | --- |
| `peach` | `{colors.surface-soft}` | `#f7f7f7` | Soft wells, disabled fields |
| `linen` | `{colors.surface-strong}` | `#f2f2f2` | Icon-button circles, skeleton |
| `butter` | `{colors.surface-card}` | `#ffffff` | Elevated cards |
| `crust` | `{colors.hairline}` | `#dddddd` | 1px borders, search, tab bar |
| `steam` | `{colors.hairline-soft}` | `#ebebeb` | Soft separators |
| `cocoa` | `{colors.body}` | `#3f3f3f` | Long-form body |
| `olive` | `{colors.muted}` | `#6a6a6a` | Captions, inactive tabs |
| `sage` | `{colors.muted-soft}` | `#929292` | Placeholders; cook-dark muted (contrast-safe on ink) |
| `chili` | `{colors.primary-error-text}` | `#c13515` | Error text — distinct from Rausch |
| `sky` | `{colors.legal-link}` | `#428bff` | Legal copy only |
| `onPrimary` / `steamedMilk` | `{colors.on-primary}` / `{colors.on-dark}` | `#ffffff` | On Rausch and on cook ink |
| `overlay` | `{colors.scrim}` at 50% | `rgba(0,0,0,0.5)` | Sheets and dialogs |

---

## Light theme tokens

```text
--color-bg:              #ffffff    canvas
--color-bg-elevated:     #ffffff    surface-card
--color-surface:         #f7f7f7    surface-soft
--color-border:          #dddddd    hairline
--color-text:            #222222    ink
--color-text-muted:      #6a6a6a    muted
--color-text-disabled:   #929292    muted-soft
--color-icon:            #3f3f3f    body
--color-primary:         #ff385c    Rausch
--color-primary-pressed: #e00b41
--color-primary-soft:    #ffd1da
--color-on-primary:      #ffffff
--color-secondary:       #222222    ink (outline buttons)
--color-secondary-soft:  #f7f7f7
--color-accent:          #222222    star rating is ink
--color-favorite:        #ff385c
--color-tab-active:      #222222
--color-tab-inactive:    #6a6a6a
--color-overlay:         rgba(0, 0, 0, 0.5)
```

### Component pairing (light)

| Component | Spec | Treatment |
| --- | --- | --- |
| Screen | `{colors.canvas}` | White; status bar dark |
| Primary button | `{component.button-primary}` | Rausch, white 16/500, 8px, 48px, 14×24. Press `#e00b41`. Disabled `#ffd1da`. No transform, no extra shadow |
| Secondary / inverse | `{component.button-secondary}` | White, ink text, 1px ink outline, 8px, 48px |
| Ghost | `{component.button-tertiary-text}` | Ink, no fill, underline on press |
| Capture | `{component.search-orb}` | 48×48 Rausch circle, white icon |
| Search | `{component.search-bar-pill}` | White pill, hairline, one shadow tier, 64px |
| Input | `{component.text-input}` | White, 8px, 56px, 1px hairline; focus 2px ink, no glow. Error text `#c13515` |
| Recipe card | `{component.property-card}` | 14px photo clip, guest-favorite white pill 11/600 |
| Heart | `{component.icon-button-circle}` | 32px; outline default, Rausch fill saved |
| Tab bar | `{component.top-nav}` language | White, hairline; ink active / muted inactive; Rausch only on the orb |
| Category chip | `{component.category-tab-active}` | Ink + underline when selected; unselected muted, not espresso-filled |

**One shadow tier only:** `box-shadow: rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px 0, rgba(0,0,0,0.1) 0 4px 8px 0` on recipe cards, sheets, search, reservation-like cooking-now. Everything else is flat.

---

## Cook shell

Public Airbnb marketing has no dark mode. Cook maps to documented dark-capable tokens only — ink canvas, on-dark type, Rausch CTA. Do not invent a night-kitchen brown palette. Kickers are on-dark / muted-soft, never honey gold.

```text
canvas:  #222222    ink
text:    #ffffff    on-dark
muted:   #929292    muted-soft (muted #6a6a6a fails contrast on ink)
primary: #ff385c    Rausch, white label
overlay: rgba(0,0,0,0.5)
```

---

## Type

Substitute **Inter** for Airbnb Cereal VF / Circular.

| Use | Token | Size / weight |
| --- | --- | --- |
| Home greeting | `{typography.display-xl}` | 28px / 700 / 1.43 |
| Listing-style titles | `{typography.display-lg}` | 22px / 500 / -0.44px |
| Section heads | `{typography.display-md}` | 21px / 700 |
| Body | `{typography.body-md}` | 16px / 400 / 1.5 |
| Card meta | `{typography.body-sm}` | 14px / 400 |
| Kickers | `{typography.micro-label}` or `{typography.caption}` | 12/700 or 14/500 — no mono family |
| Peak number | `{typography.rating-display}` | 64px / 700 / -1px — cook-complete clock only |

Display weights 500–700. Body 400. Homepage h1 stays modest at 28px.

---

## Shape & spacing

`{rounded.sm}` 8px buttons and inputs · `{rounded.md}` 14px cards · `{rounded.xl}` 32px category strip · `{rounded.full}` search pill, orb, hearts.

Spacing: 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Card grids 16px gutters. Touch: primary 48, orb 48, heart 32 with padding.

---

## Contrast

| Pair | OK for |
| --- | --- |
| Ink `#222222` on canvas `#ffffff` | Body |
| On-dark `#ffffff` on cook ink `#222222` | Cook body |
| White on Rausch `#ff385c` | 16px button labels |
| Error `#c13515` on canvas | Helper text |
| Muted-soft `#929292` on cook ink | Cook captions |

---

## Do / don't

**Do**

- Keep product IA: Home / Explore / capture / Kitchen / You, routes, copy, Daisy illustration hexes.
- Use Rausch scarcely. Most of the page is white + ink.
- Clip recipe photos at 14px. Search is a pill. Primary buttons are 8px, not pills.

**Don't**

- Use Luxe or Plus on mainline screens.
- Paint yellow stars or a paprika-filled tab bar.
- Add extra shadow tiers or a night-cocoa cook palette.
- Add map / Where-When-Who marketplace IA that is not already in the app.
