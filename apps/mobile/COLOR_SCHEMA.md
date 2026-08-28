# Recipe app color schema — Garden Plate

A warm, food-forward palette for the recipe mobile app. It should feel like a sunlit kitchen: ripe produce, chopped herbs, and a splash of citrus — **fresh**, **lively**, and **yummy**.

Use cream paper instead of cold gray, paprika instead of generic red, and basil instead of clinical green. Neutrals stay warm so food photos look appetizing, not washed out.

---

## Mood

| Word | How it shows up |
| --- | --- |
| Fresh | Basil greens, mint tints, herb chips, garden-leaf icons |
| Lively | Paprika CTAs, lemon highlights, berry favorites, punchy tags |
| Yummy | Honey gold, peach surfaces, cream paper, espresso type |

---

## Core brand colors

These five carry the brand. Everything else is a supporting shade.

| Token | Name | Hex | RGB | Role |
| --- | --- | --- | --- | --- |
| `paprika` | Paprika | `#E25A3C` | `226, 90, 60` | Primary brand and main CTAs |
| `basil` | Basil | `#2F8F5B` | `47, 143, 91` | Freshness, secondary actions, veggie cues |
| `honey` | Honey | `#E8B923` | `232, 185, 35` | Ratings, “yummy” badges, festive accents |
| `cream` | Cream | `#FFF8F2` | `255, 248, 242` | App background (cookbook paper) |
| `espresso` | Espresso | `#2A2118` | `42, 33, 24` | Primary text and dark UI chrome |

**Do not use paprika or honey as body text on cream.** They fail contrast at small sizes. Use them on buttons, chips, icons, and illustration.

---

## Full palette

### Paprika — appetite, energy, cook

Ripe tomato / paprika. The “I want to cook this” color.

| Step | Hex | Use |
| --- | --- | --- |
| 50 | `#FFF1ED` | Soft highlight behind selected recipe cards |
| 100 | `#FFDCD3` | Chip fill, light press state |
| 200 | `#FFB9A8` | Illustration, progress track |
| 300 | `#F78B72` | Hover / pressed outline |
| 400 | `#EF6D52` | Icons on cream |
| **500** | **`#E25A3C`** | **Primary, filled buttons, tab active** |
| 600 | `#C4472C` | Pressed button |
| 700 | `#A33822` | Strong emphasis, dark-mode paprika |
| 800 | `#7C2B1B` | Rare; dark illustration |
| 900 | `#541C12` | Do not use for UI fills |

### Basil — garden, healthy, go

Herb green. Fresh produce, vegetarian, success without looking like a banking app.

| Step | Hex | Use |
| --- | --- | --- |
| 50 | `#EAF7F0` | Veggie tag background, success toast |
| 100 | `#CDEBD9` | Selected filter chip |
| 200 | `#9DD4B4` | Charts, illustration |
| 300 | `#6BBA8C` | Icons on cream |
| 400 | `#45A36E` | Secondary button outline |
| **500** | **`#2F8F5B`** | **Secondary brand, success, “cook now” alt** |
| 600 | `#24754A` | Pressed secondary |
| 700 | `#1C5C3A` | Text on mint fills |
| 800 | `#15462D` | Dark-mode basil |
| 900 | `#0E2F1E` | Rare |

### Honey — zest, reward, delicious

Lemon-honey gold. Use sparingly so it stays special: stars, “staff pick”, cooking streak.

| Step | Hex | Use |
| --- | --- | --- |
| 50 | `#FFF8E1` | Rating row background |
| 100 | `#FDE9A8` | Badge fill |
| 200 | `#F6D56A` | Illustration |
| **400** | **`#E8B923`** | **Stars, highlight icons** |
| 600 | `#C49212` | Text on honey-50 |
| 800 | `#7A5B0C` | Dark-mode honey |

### Berry — favorite, social, dessert

Raspberry. Saves, likes, and dessert categories. One accent, not a second primary.

| Step | Hex | Use |
| --- | --- | --- |
| 50 | `#FDEEF2` | Liked-state wash |
| 100 | `#F9C9D6` | Heart chip |
| **500** | **`#D94F70`** | **Favorite heart, dessert tag** |
| 700 | `#A3324E` | Pressed heart |

### Cream & peach — paper, plates, warmth

Warm neutrals. Never pure `#FFFFFF` for large surfaces; food photography sits better on cream.

| Token | Hex | Use |
| --- | --- | --- |
| `cream` | `#FFF8F2` | Screen background |
| `peach` | `#FFE8D6` | Cards, search bar, bottom sheet handle area |
| `butter` | `#FFFDF9` | Elevated cards, input fill |
| `linen` | `#F3E6D8` | Dividers, skeleton bones |
| `crust` | `#E6D3C2` | Borders, unselected chips |

### Espresso & olive — type and quiet UI

Warm darks. Olive is the “muted” voice: metadata, timers, secondary labels.

| Token | Hex | Use |
| --- | --- | --- |
| `espresso` | `#2A2118` | Headlines, body, icons |
| `cocoa` | `#4A3D32` | Secondary headings |
| `olive` | `#6B7A62` | Captions, cook time, servings |
| `sage` | `#8A9580` | Placeholders, disabled labels |
| `steam` | `#C4B8AA` | Disabled borders, icons at rest |

---

## Semantic colors

| Intent | Token | Hex | On-color | Use |
| --- | --- | --- | --- | --- |
| Success | `basil-500` | `#2F8F5B` | `#FFFFFF` | Saved, added to list, step complete |
| Success wash | `basil-50` | `#EAF7F0` | `basil-700` | Inline confirmation |
| Warning | `honey-400` | `#E8B923` | `espresso` | Low pantry, timer almost up |
| Warning wash | `honey-50` | `#FFF8E1` | `honey-800` | Banner |
| Danger | `chili` | `#C43C2C` | `#FFFFFF` | Delete recipe, destructive confirm |
| Danger wash | `chili-50` | `#FDECEA` | `#8A2418` | Error under inputs |
| Info | `sky` | `#3A8FBF` | `#FFFFFF` | Tips, nutrition notes |
| Info wash | `sky-50` | `#E7F4FB` | `#1C5A7A` | Helper callout |

`chili` is a slightly deeper paprika so errors do not look like primary buttons.

---

## Recipe-specific tags

Keep tags pastel-on-dark-text so they stay readable on cream cards.

| Tag | Fill | Text | Hex fill / text |
| --- | --- | --- | --- |
| Vegetarian | Basil wash | Basil leaf | `#EAF7F0` / `#1C5C3A` |
| Vegan | Mint | Deep herb | `#D8F3E4` / `#15462D` |
| Spicy | Paprika wash | Chili | `#FFF1ED` / `#A33822` |
| Quick (≤20 min) | Honey wash | Cocoa | `#FFF8E1` / `#7A5B0C` |
| Dessert | Berry wash | Berry | `#FDEEF2` / `#A3324E` |
| Gluten-free | Sky wash | Ocean | `#E7F4FB` / `#1C5A7A` |
| Comfort / baked | Peach | Espresso | `#FFE8D6` / `#2A2118` |

---

## Light theme tokens

Map these 1:1 into NativeWind CSS variables / a theme object.

```text
--color-bg:              #FFF8F2    cream
--color-bg-elevated:     #FFFDF9    butter
--color-surface:         #FFE8D6    peach
--color-border:          #E6D3C2    crust
--color-text:            #2A2118    espresso
--color-text-muted:      #6B7A62    olive
--color-text-disabled:   #8A9580    sage
--color-icon:            #4A3D32    cocoa
--color-primary:         #E25A3C    paprika-500
--color-primary-pressed: #C4472C    paprika-600
--color-primary-soft:    #FFF1ED    paprika-50
--color-on-primary:      #FFFFFF
--color-secondary:       #2F8F5B    basil-500
--color-secondary-soft:  #EAF7F0    basil-50
--color-on-secondary:    #FFFFFF
--color-accent:          #E8B923    honey-400
--color-favorite:        #D94F70    berry-500
--color-tab-active:      #E25A3C
--color-tab-inactive:    #8A9580
--color-overlay:         rgba(42, 33, 24, 0.48)
```

### Suggested component pairing (light)

| Component | Background | Content | Extra |
| --- | --- | --- | --- |
| Screen | cream `#FFF8F2` | espresso | Status bar dark-content |
| Card | butter `#FFFDF9` | espresso | Border crust, radius 16 |
| Primary button | paprika `#E25A3C` | white | Pressed paprika-600 |
| Secondary button | transparent | basil `#2F8F5B` | 1.5px basil border |
| Ghost / text button | transparent | paprika | — |
| Search field | peach `#FFE8D6` | espresso | Placeholder sage |
| Bottom tab bar | butter | inactive sage | Active paprika + paprika-50 pill |
| FAB “add recipe” | paprika | white | Shadow `rgba(226, 90, 60, 0.28)` |
| Favorite heart (off) | — | steam | Stroke 1.5 |
| Favorite heart (on) | — | berry | Fill berry-500 |
| Rating stars | — | honey | Empty steam |
| Cook timer | basil-50 | basil-700 | Ring basil-500 |
| Skeleton | linen pulse | — | Avoid gray flash |

---

## Dark theme tokens

Warm night kitchen, not OLED blue-black. Food photos still need a brown-black stage.

```text
--color-bg:              #1A1612    night cocoa
--color-bg-elevated:     #252019    counter
--color-surface:         #312A22    board
--color-border:          #4A3F34
--color-text:            #F5EDE4    steamed milk
--color-text-muted:      #B5A898
--color-text-disabled:   #8A7D70
--color-icon:            #E6D3C2
--color-primary:         #EF6D52    paprika-400 (brighter on dark)
--color-primary-pressed: #E25A3C
--color-primary-soft:    #3A221C
--color-on-primary:      #2A2118    espresso on bright paprika
--color-secondary:       #45A36E    basil-400
--color-secondary-soft:  #163325
--color-on-secondary:    #0E2F1E
--color-accent:          #F6D56A    honey-200
--color-favorite:        #E56B86
--color-tab-active:      #EF6D52
--color-tab-inactive:    #8A7D70
--color-overlay:         rgba(0, 0, 0, 0.62)
```

On dark, prefer **paprika-400** and **basil-400** for fills so they glow instead of looking muddy. Primary button text can stay espresso on the brighter paprika, or white on paprika-600 if you want more pop.

---

## Contrast checklist

Targets: **4.5:1** for body/UI text, **3:1** for large type and icons.

| Pair | Approx. ratio | OK for |
| --- | --- | --- |
| Espresso `#2A2118` on cream `#FFF8F2` | ~14:1 | Body, captions |
| White on paprika `#E25A3C` | ~3.9:1 | Large button labels (17pt+ / bold). Prefer paprika-600 `#C4472C` (~4.9:1) for small labels |
| White on basil `#2F8F5B` | ~3.8:1 | Large labels; use basil-600 `#24754A` for small |
| Basil-700 `#1C5C3A` on basil-50 `#EAF7F0` | ~7:1 | Tag text |
| Olive `#6B7A62` on cream | ~4.6:1 | Captions |
| Honey `#E8B923` on cream | fails | Icons only, never small text |
| Espresso on honey-50 `#FFF8E1` | ~12:1 | Warning copy |

**Rule:** if a fill is paprika-500 or honey, the label is white or espresso at **button size**, never 12pt caption.

---

## Gradients (use rarely)

One hero gradient is enough. Do not wash every screen.

| Name | Stops | Use |
| --- | --- | --- |
| Sunrise | `#E25A3C` → `#E8B923` | Onboarding, empty-state illustration |
| Garden | `#2F8F5B` → `#3A8FBF` | Fresh / healthy collection header |
| Peach mist | `#FFF8F2` → `#FFE8D6` | Home header behind search |

Keep gradients at **low saturation behind photos**. Let the dish be the color.

---

## NativeWind / CSS variables starter

Drop into the mobile theme when you wire tokens:

```css
:root {
  --paprika: #e25a3c;
  --paprika-pressed: #c4472c;
  --paprika-soft: #fff1ed;
  --basil: #2f8f5b;
  --basil-soft: #eaf7f0;
  --honey: #e8b923;
  --berry: #d94f70;
  --cream: #fff8f2;
  --peach: #ffe8d6;
  --butter: #fffdf9;
  --crust: #e6d3c2;
  --espresso: #2a2118;
  --olive: #6b7a62;
  --chili: #c43c2c;
  --sky: #3a8fbf;
}

.dark {
  --paprika: #ef6d52;
  --paprika-pressed: #e25a3c;
  --paprika-soft: #3a221c;
  --basil: #45a36e;
  --basil-soft: #163325;
  --honey: #f6d56a;
  --berry: #e56b86;
  --cream: #1a1612;
  --peach: #312a22;
  --butter: #252019;
  --crust: #4a3f34;
  --espresso: #f5ede4;
  --olive: #b5a898;
  --chili: #ef6d52;
  --sky: #5eb0d6;
}
```

---

## Do / don't

**Do**

- Let recipe photography own the color; UI stays cream + paprika + basil.
- Use honey and berry as **punctuation** (stars, hearts, one badge).
- Keep corners soft (12–20) so the palette feels edible, not industrial.
- Pair paprika buttons with basil tags so the screen feels garden + kitchen, not all-red.

**Don't**

- Mix in cool gray (`#F3F4F6`, `#6B7280`) — it kills the food warmth.
- Use pure black or pure white as the only surfaces.
- Put paprika text on honey, or honey text on paprika.
- Use lime neon or candy pink; they read as toys, not cooking.
- Tint every card a different fruit color. Tags are enough.

---

## Quick reference

```text
Paprika  #E25A3C    cook, primary, hunger
Basil    #2F8F5B    fresh, go, veggie
Honey    #E8B923    yummy, rate, reward
Berry    #D94F70    love, dessert
Cream    #FFF8F2    paper, rest
Peach    #FFE8D6    plates, fields
Espresso #2A2118    words
Olive    #6B7A62    quiet words
```
