# Recipe app color schema — Apple marketing

Photography-first chrome for Mise. Garden Plate **class names** (`bg`, `peach`, `linen`, `espresso`, `primary`…) are unchanged so NativeWind screens restyle. Hexes follow `DESIGN.md`: parchment/white browse, near-black cook tiles, a **single** Action Blue accent.

There is no second brand color. Favorite, links, pills, and focus all use Action Blue. Daisy illustration hexes stay in `src/components/daisy/colors.ts`.

---

## Mood

| Word | How it shows up |
| --- | --- |
| Reverent | Edge-to-edge tiles; UI recedes behind the dish |
| Quiet | SF/Inter, 17px body, negative display tracking |
| Precise | One accent (`#0066cc`), one product-image shadow, press scale `0.95` |

---

## Core brand colors

| Token | Name | Hex | Role |
| --- | --- | --- | --- |
| `primary` / `paprika` | Action Blue | `#0066cc` | Every interactive signal: pills, links, favorite heart, progress ticks |
| `primary-focus` | Focus Blue | `#0071e3` | 2px keyboard/selected ring |
| `primary-on-dark` | Sky Link | `#2997ff` | Links on cook tiles only |
| `canvas` / `cream` | Pure White | `#ffffff` | Browse canvas |
| `parchment` / `linen` | Parchment | `#f5f5f7` | Alternating wells, frosted timer bar |
| `ink` / `espresso` | Near-black ink | `#1d1d1f` | Type, dark-utility fill, destructive chrome |
| `tile1` | Near-black tile | `#272729` | Cook `.cook-dark` (not OLED `#000`) |
| `surface-black` | Pure black | `#000000` | Tab bar / true void only |

**Do not use Action Blue as body text on white at caption size without the 17px pill grammar.** Labels on primary pills are `{colors.on-primary}` white.

---

## Surfaces

### Browse (`:root`)

| Token | Hex | NativeWind stand-in |
| --- | --- | --- |
| Canvas | `#ffffff` | `bg`, `cream`, `butter` |
| Parchment | `#f5f5f7` | `linen`, `surface` |
| Pearl | `#fafafc` | `peach`, `primary-soft` |
| Hairline | `#e0e0e0` | `crust`, `border` |
| Divider soft | `#f0f0f0` | — |

### Cook (`.cook-dark`)

| Token | Hex | Use |
| --- | --- | --- |
| Tile 1 | `#272729` | Default cook canvas |
| Tile 2 | `#2a2a2c` | Adjacent well |
| Tile 3 | `#252527` | Nested frames |
| On-dark | `#ffffff` | Headlines, step body |
| Body muted | `#cccccc` | Kickers, captions — not honey |

### Text

| Token | Hex | Use |
| --- | --- | --- |
| Ink / body | `#1d1d1f` | Headlines and paragraphs on light |
| Ink muted 80 | `#333333` | Pearl-button labels |
| Ink muted 48 | `#7a7a7a` | Captions, disabled, fine print |
| On-primary | `#ffffff` | Pill labels |

---

## Semantic mapping (Garden Plate names → Apple)

| Old role | Garden name | Now |
| --- | --- | --- |
| Primary CTA | paprika | Action Blue `#0066cc` |
| Secondary / success | basil | Action Blue (no second accent) |
| Favorite | berry | Action Blue |
| Stars / kickers | honey | Action Blue if interactive; `#cccccc` on cook if not |
| Danger | chili | Ink `#1d1d1f` (dark-utility). No Material red |
| Paper | cream | White `#ffffff` |
| Cards / search | peach | Pearl `#fafafc` or search pill on canvas |
| Type | espresso | Ink `#1d1d1f` |

---

## Contrast checklist

Targets: **4.5:1** body, **3:1** large type.

| Pair | OK for |
| --- | --- |
| Ink `#1d1d1f` on canvas `#ffffff` | Body, captions |
| On-dark `#ffffff` on tile-1 `#272729` | Cook body |
| White on Action Blue `#0066cc` | 17px pill labels |
| Ink muted 48 `#7a7a7a` on canvas | Captions |

---

## Elevation

**No shadows on cards, buttons, or text.** Exactly one shadow, only on recipe photography resting on a surface:

`rgba(0, 0, 0, 0.22) 3px 5px 30px` → `productImageShadow` in `src/theme/tokens.ts`.

---

## Type

SF Pro Display + SF Pro Text on iOS (`System`). Inter 300 / 400 / 600 / 700 off-system (`@expo-google-fonts/inter`). **Weight 500 is absent.** Body is 17px / 400 / 1.47 (1.44 if Inter). Display tracking is negative.

---

## Do / don't

**Do**

- Use Action Blue for every “click me” signal.
- Run body at 17px. Press scales to `0.95`.
- Alternate white/parchment vs tile-1 for section rhythm.

**Don't**

- Invent a second accent (no paprika/berry/honey chrome).
- Add card or button shadows, decorative gradients, or iOS grouped gray `#F2F2F7`.
- Round the screen canvas. Full-bleed tiles are `{rounded.none}`.
