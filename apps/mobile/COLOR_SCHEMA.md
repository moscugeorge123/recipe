# Recipe app color schema — ReciMe orange

White paper, classic orange brand, black stadium CTAs, Inter type. Screens may look half-migrated until later agents restyle chrome; that is expected.

**The `paprika` key is now the orange brand (FAB, wordmark, active tab icon), not the filled button.** Primary buttons use `cta` black.

---

## Token lock

Keep the `colors.paprika*` keys so existing call sites compile. Hex values are classic orange.

| Token | Hex | Role |
| --- | --- | --- |
| `paprika` | `#F97316` | FAB, active tab icon, wordmark |
| `paprikaPressed` | `#EA580C` | Pressed orange / kicker tone |
| `paprikaSoft` | `#FFF4E8` | Cream disc / orange wash |
| `cta` | `#232220` | Primary button fill (ReciMe black pill) |
| `ctaDisabled` | `#E5E5E3` | Disabled primary fill |
| `page` | `#FFFFFF` | Screen background |
| `paper` | `#F8F7F2` | Header / active-tab disc / warm paper |
| `searchFill` | `#FBFCF6` | Search field fill |
| `tabInactive` | `#757472` | Inactive tab label / icon |
| `ingredientLink` | `#6B7C93` | Tappable ingredient words in steps |
| `mealBreakfast` | `#FDECB8` | Meal chip |
| `mealLunch` | `#D6E6F5` | Meal chip |
| `mealDinner` | `#D6B9F3` | Meal chip |
| `mealSnack` | `#F3E0D0` | Meal chip |
| `mango` | `#F4A36E` | Daisy / illustration only, never chrome |
| `cream` | `#FFFFFF` | Same as page. Use `paper` where the old cream-cookbook fill is needed. |

Overlay / shadow: `rgba(35, 34, 32, 0.42)` and `rgba(249, 115, 22, 0.28)`.

Supporting garden hues (`basil`, `honey`, `berry`, `espresso`, `olive`, …) stay available for tags, ratings, and copy. Do not treat them as the new chrome.

---

## CTA grammar

`Button` variant `primary` = black stadium (`colors.cta`, white label, full width at `lg`, radius ~28).

Orange is for FAB / wordmark / active icon only — not for every button.

| Component | Fill | Label |
| --- | --- | --- |
| Primary button | `cta` `#232220` | white |
| Primary disabled | `ctaDisabled` `#E5E5E3` | white |
| Ghost / text button | transparent | `paprika` |
| FAB | `paprika` | white |
| Selected chip | `cta` or `paprikaSoft` disc | inverse / espresso |
| Unselected chip | `paper` | cocoa / gray |

---

## Type

Inter 500 / 600 / 700 (and 800 where used) via `@expo-google-fonts/inter`.

`fonts.manrope*` and `fonts.mono*` point at Inter family names so most screens pick it up without a rewrite. `Text` variants `kicker` and `section` use Inter, not mono, with tracking ~0.02–0.04em (not 0.14em).

---

## Light theme tokens

```text
--color-bg:              #FFFFFF    page
--color-surface:         #F8F7F2    paper
--color-primary:         #F97316    paprika (brand, not filled button)
--color-primary-pressed: #EA580C
--color-primary-soft:    #FFF4E8
--color-on-primary:      #FFFFFF
--color-cta:             #232220
--color-cta-disabled:    #E5E5E3
--color-search-fill:     #FBFCF6
--color-tab-inactive:    #757472
--color-overlay:         rgba(35, 34, 32, 0.42)
--color-paprika-shadow:  rgba(249, 115, 22, 0.28)
```

Do not use `--color-primary` as the filled-button background. Button fill is set in JS from `colors.cta`.

---

## Quick reference

```text
Paprika  #F97316    brand orange — FAB, wordmark, active icon
CTA      #232220    primary button pill
Page     #FFFFFF    screen
Paper    #F8F7F2    header / tab disc
Cream    #FFFFFF    alias of page; use paper for warm fills
Mango    #F4A36E    illustration only
```
