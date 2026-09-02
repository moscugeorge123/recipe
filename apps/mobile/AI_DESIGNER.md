# AI Designer brief — Mise (Recipe)

**Audience:** an AI designer restyling, extending, or generating screens for this product.  
**Source of truth:** this file describes the **shipping mobile app**, not a discarded prototype.  
**Companion docs:** [`COLOR_SCHEMA.md`](./COLOR_SCHEMA.md) (full Garden Plate palette) and [`CLAUDE_DESIGN.md`](./CLAUDE_DESIGN.md) (recolor rules). If those two disagree with this file, **this file wins** — it matches production.

This is a cooking companion. People import recipes from Instagram, YouTube, the web, photos, and notes; review an inbox; cook from a dark step-by-step shell; then file the result in their kitchen. It is **not** a generic recipe feed, social network, or grocery marketplace.

Target device: **portrait phone**, ~390–430pt wide, iOS-first (Android must still feel like the same kitchen). Inner fill is cream paper, never iOS grouped gray `#F2F2F7`.

---

## 1. Product identity

| | |
| --- | --- |
| **Working name in UI** | Mise (onboarding kicker). Expo display name is `Recipe`. |
| **Default person** | Sam (first name in greetings until they change it). |
| **Mood** | Sunlit kitchen: ripe produce, chopped herbs, citrus. **Fresh, lively, yummy.** |
| **Not** | Cool gray SaaS, Material red, OLED black, candy-pink toys, liquid-glass iOS 26 chrome, SF Pro large titles. |

**Voice:** warm, editorial, short. Second person. No corporate filler (“Oops! Something went wrong.”). No shouting.

Examples already in the product:

- “Evening, Sam. What are we cooking?”
- “Edited weekly. Nothing endless.”
- “Send me anything.”
- “Looks good — save it”
- “I'm ready — step 1”
- “WHILE THAT'S COOKING”
- “You cooked pistachio pasta.”
- “That link didn't want to cooperate.”

Section labels are inventory, not marketing: `RECIPE INBOX · 2`, `LAST UPLOADED`, `THE PLAN`, `YOU HAVE · 4`, `TO BUY · 8`.

---

## 2. How the app is structured

### 2.1 Two shells (this is the most important layout rule)

There is **no system-wide dark mode**. Light vs dark is a product story:

| Shell | When | Feeling |
| --- | --- | --- |
| **Browse (light)** | Home, Explore, Kitchen, You, Search, Recipe detail, Capture, Import, Pantry, Shop, Collections, Onboarding | Sunlit counter, paper cookbook |
| **Cook (dark by default)** | Cook intro (“The Plan”), cooking steps, cook complete | Night kitchen, screen stays awake, dish still glowing |

Cooking can switch to a **light kitchen** (`cookingTheme: Light`) for bright rooms / accessibility. Same layout, cream paper, espresso type, paprika CTA. Do **not** invent a third palette.

The **tab bar is hidden** during onboarding, extraction, cooking, and other full-screen capture flows. On browse tabs it is always **four tabs + a center capture tomato**.

A **timer bar** (espresso strip, honey pulse, steamed-milk clock) can float **above the tab bar on a light screen** while a cook timer is running. It is a dark *component* on a light page — keep that contrast.

### 2.2 Navigation map

Expo Router, no native headers (`headerShown: false`). Stack animation is **none** — screens do not slide like iOS UINavigationController. Motion lives inside screens (enter, stagger, press, Daisy), not in route chrome.

```
Root stack (cream #FFF8F2)
│
├── Onboarding  (first launch; no tabs)
│
├── (tabs)  ← four destinations + center capture
│     ├── Home      /
│     ├── Explore   /explore
│     ├── Kitchen   /kitchen
│     └── You       /you
│
├── Search              /search
├── Shop                /shop
├── Pantry              /pantry
├── Collection detail   /collection/[id]
│
├── Recipe detail       /recipe/[id]
│     ├── Edit          /recipe/[id]/edit
│     ├── History       /recipe/[id]/history
│     └── Revision      /recipe/[id]/revision/[revisionId]
│
├── Import preview      /import/preview
├── Extraction (Daisy)  /import/extract/[jobId]
├── Review editor       /import/review/[id]
├── Import error        /import/error
├── Manual paste        /import/manual
│
└── Cook (CookShell)
      ├── The Plan      /cook/[id]
      ├── Step          /cook/[id]/step
      └── Complete      /cook/[id]/complete

Global overlays (not routes): CaptureSheet, Toast, ConfirmSheet, filter/settings sheets
```

Center **+** is **not a tab**. It toggles the capture sheet. The tomato rotates the plus 45° into an × while the sheet is open.

### 2.3 Tab bar (always this 5-slot composition)

| Slot | Label | Icon (food glyph, 28pt) | Job |
| --- | --- | --- | --- |
| 1 | Home | Round burger (honey bun, basil lettuce, paprika patty) | Greeting, cooking-now, inbox, last uploaded, my recipes |
| 2 | Explore | Lemon-wheel compass | Edited collections, not an infinite feed |
| 3 | *(no label)* | Paprika tomato + white plus | Capture / import |
| 4 | Kitchen | Stock pot with steam | Inbox, Saved, Want to cook, Cooked, Collections |
| 5 | You | Ripe berry apple | Profile, units, cooking appearance, motion |

**Active tab is espresso type, not a paprika fill.** Active icon sits on a **paprika-soft** (`#FFF1ED`) circle. Inactive icon opacity ~0.52, scale 0.84. Inactive label is sage. Kitchen can show a **paprika inbox badge** (6pt dot, cream ring) on the pot.

Do **not** paint the tab bar paprika. Do **not** use SF tab icons, outline line-icons, or a floating glass pill.

Tab bar surface: cream at 92% (`bg/92`), crust hairline on top, 10pt side padding, 6pt top, bottom = `max(safe-area, 12)`. Each slot is 62pt tall. Labels: IBM Plex Mono 10.5px, tracking 0.2, bold when active.

### 2.4 User journeys (keep these intact)

1. **First open** — 3-step onboarding (promise → taste chips → capture sources) → Home. Skip is always available.
2. **Import** — Capture sheet → source preview (paste URL, pick thumbnail) → Daisy extraction theater → review editor → recipe detail.
3. **Import fail** — Daisy error pose → title + caption + paprika “Try again” + ghost “Paste a different link”.
4. **Cook** — Recipe detail “Start cooking” → The Plan → swipe/step through → complete (checkmark burst, note, Done / Cook again).
5. **Kitchen** — Inbox (needs review / ready) → Saved / Want / Cooked lists → Collections with photo mosaics → Shopping / Pantry shortcuts.
6. **Pantry** — Paste lines → Organize → preview chips with emoji + category color → Accept → match “you have / to buy” on recipe detail.

---

## 3. Design system — Garden Plate

Name the palette **Garden Plate**. Neutrals stay warm so food photos look appetizing, not washed out. Cream paper instead of gray. Paprika instead of generic red. Basil instead of clinical green.

### 3.1 Five brand colors (memorize these)

| Token | Name | Hex | Job |
| --- | --- | --- | --- |
| `paprika` | Paprika | `#E25A3C` | Primary brand. **The next irreversible cooking action.** |
| `basil` | Basil | `#2F8F5B` | Freshness, in-stock, success, pantry. |
| `honey` | Honey | `#E8B923` | Timers, stars, stage kickers, “yummy” punctuation. |
| `cream` | Cream | `#FFF8F2` | App background (cookbook paper). |
| `espresso` | Espresso | `#2A2118` | Primary text and dark chrome. |

**One filled paprika control per view.** Outline / ghost / inverse for everything else. Paprika is not a page fill, not body text, not the tab bar, not errors.

### 3.2 Color roles (what each family *means*)

**Paprika — cook / import / go**  
Start cooking, Resume, I'm ready — step 1, Next step, Save, Capture tomato, “See all”, selected radio dots, cook-mode progress ticks. Pressed = paprika-600 `#C4472C`. Soft wash behind selected cards = paprika-50 `#FFF1ED`.

**Basil — in stock / fresh / good**  
“You have” chips, pantry checkmarks, shopping-done checks, success without looking like a bank. Soft fill `#EAF7F0`, text `#1C5C3A`. Pantry shortcut on Kitchen is basil-soft. Do **not** replace Start cooking with basil. No lime.

**Honey — timer / stage / special**  
`STEP 3 OF 8`, `PREP · 8 MIN`, `THE 25-MINUTE ISSUE`, `COOKING NOW` kicker, rating stars, “needs review” banner wash (`honey-50` + `honey-800` kicker). Never a page fill. Never 12pt body on cream (contrast fails).

**Berry — saved**  
Favorite heart on. Off = steam stroke / empty heart on white-86 glass. On = berry fill `#D94F70` + white heart. Not the FAB. Not the tab bar.

**Chili — danger (not paprika)**  
Delete, destructive confirm, input errors. `#C43C2C` on `#FDECEA`. Import recovery CTA stays paprika (“Try again” is still the cook path).

**Sky — nutrition / helper only**  
`#3A8FBF`. “Updating” on the nutrition panel. Gluten-free tag. Do not introduce more blue.

**Cream / peach / butter / linen / crust — paper and plates**

| Token | Hex | Use |
| --- | --- | --- |
| cream | `#FFF8F2` | Screen background |
| peach | `#FFE8D6` | Inputs, search field, unselected chips, wells |
| butter | `#FFFDF9` | Elevated cards, icon buttons |
| linen | `#F3E6D8` | Meta panels, plan pills, empty/error panels, skeleton bone |
| crust | `#E6D3C2` | Borders, hairlines, unselected outlines |

Never pure `#FFFFFF` as a full screen. Small glass buttons on a photo hero may be `rgba(255,255,255,0.86)`.

**Espresso family — words and the dark plate**

| Token | Hex | Use |
| --- | --- | --- |
| espresso | `#2A2118` | Headlines, body, active tab, inverse button fill |
| cocoa | `#4A3D32` | Secondary headings, chip labels, icon stroke |
| olive | `#6B7A62` | Captions, cook time, placeholders |
| sage | `#8A9580` | Disabled, inactive tabs |
| steam | `#C4B8AA` | Empty stars, rest icons |
| steamed milk | `#F5EDE4` | Type on dark cook / espresso cards |

### 3.3 Light browse tokens (CSS variables in `global.css`)

```
bg              #FFF8F2    cream
bg-elevated     #FFFDF9    butter
surface         #FFE8D6    peach
border          #E6D3C2    crust
text            #2A2118    espresso
text-muted      #6B7A62    olive
text-disabled   #8A9580    sage
icon            #4A3D32    cocoa
primary         #E25A3C    paprika-500
primary-pressed #C4472C    paprika-600
primary-soft    #FFF1ED    paprika-50
on-primary      #FFFFFF
secondary       #2F8F5B    basil-500
secondary-soft  #EAF7F0    basil-50
accent          #E8B923    honey-400
favorite        #D94F70    berry-500
chili           #C43C2C
sky             #3A8FBF
overlay         rgba(26, 22, 18, 0.42)
paprika-shadow  rgba(226, 90, 60, 0.28)
```

### 3.4 Dark cook tokens (class `.cook-dark` + `cook-tokens.ts`)

Warm night kitchen, **not** OLED `#000` or iOS `#1C1C1E`.

```
bg              #1A1612    night cocoa
bg-elevated     #252019    counter
surface         #312A22    board
border          #4A3F34
text            #F5EDE4    steamed milk
text-muted      #B5A898
text-disabled   #8A7D70
icon            #E6D3C2
primary         #EF6D52    paprika-400 (brighter so it glows)
primary-pressed #E25A3C
on-primary      #2A2118    espresso on bright paprika
accent          #F6D56A    honey-200  (STEP N, PREP/COOK/FINISH)
secondary       #45A36E
secondary-soft  #163325
favorite        #E56B86
```

Cook-only component tokens:

| Role | Dark | Light cook |
| --- | --- | --- |
| Progress tick | paprika | paprika |
| Progress track | `rgba(255,255,255,0.14)` | crust |
| Ingredient chip | `rgba(255,255,255,0.07)` | peach |
| Ghost (Previous, Cook again) | `rgba(255,255,255,0.08)` | peach |
| Parallel task | honey 9% fill, dashed honey 40% | honey-50 + honey-200 |
| Timer on | honey 16% fill, honey 50% border, honey text | paprika-soft + paprika-200 border |
| Divider | `rgba(255,255,255,0.14)` | crust |

**Soft tokens on cook are dark tints**, never light pastels. No `#FFF1ED` or `#EAF7F0` on the night board.

### 3.5 Semantic pairings

| Intent | Fill | Content |
| --- | --- | --- |
| Success | basil-50 | basil-700 |
| Warning / needs review | honey-50 | honey-800 kicker, espresso body |
| Danger | chili-50 | chili |
| Info / nutrition updating | — | sky |
| Favorite on | berry | white |
| Favorite off | white/86 glass | espresso heart outline |

### 3.6 Recipe tags (pastel fill + dark text)

| Tag | Fill | Text |
| --- | --- | --- |
| Vegetarian | `#EAF7F0` | `#1C5C3A` |
| Vegan | `#D8F3E4` | `#15462D` |
| Spicy | `#FFF1ED` | `#A33822` |
| Quick (≤20 min) | `#FFF8E1` | `#7A5B0C` |
| Dessert | `#FDEEF2` | `#A3324E` |
| Gluten-free | `#E7F4FB` | `#1C5A7A` |
| Comfort / baked | `#FFE8D6` | `#2A2118` |

Do not tint every card a different fruit color. Tags are enough.

### 3.7 Source brand colors (icons only)

Instagram `#D62976`, TikTok `#010101`, YouTube `#FF0000`, Website basil, Facebook `#1877F2`, Photo honey, Note/Text olive, Share sheet paprika. These never become app chrome.

### 3.8 Photo stand-ins

When there is no thumbnail, use a **warm diagonal gradient**, not gray:

`#E6D9C4 → #DCCBB0` and five sibling pairs in `placeholderPairs`. Tiny mono caption `photo — …` at 8.5px, espresso 42%, bottom-right. Never a blue overlay on food. Hero scrim on Explore: `bg-black/50`. Recipe hero is full-bleed, 268pt tall, no radius.

### 3.9 Contrast

Body 4.5:1. White on paprika-500 is ~3.9:1 — OK for **17pt+ bold button labels**, not for 12pt captions. Prefer paprika-600 for small paprika labels. Honey on cream fails — icons only. Olive on cream is OK for captions.

---

## 4. Typography

Two families. **Never SF Pro, never a serif display, never a third sans.**

| Family | Weights loaded | Role |
| --- | --- | --- |
| **Manrope** | 500 / 600 / 700 / 800 | All UI copy |
| **IBM Plex Mono** | 500 / 600 / 700 | Kickers, clocks, `STEP 3 OF 8`, `TUESDAY · 18:40`, progress labels |

NativeWind aliases: `font-sans`, `font-sans-semibold`, `font-sans-bold`, `font-sans-extrabold`, `font-mono`, `font-mono-semibold`, `font-mono-bold`.

### 4.1 Text variants (`Text` component)

| Variant | Size / leading / tracking | Weight | Default tone |
| --- | --- | --- | --- |
| `display` | 27px / 1.14 / -0.02em | Manrope 800 | espresso |
| `title` | 23px / 1.14 / -0.02em | Manrope 800 | espresso |
| `section` | 13px / 700 / 0.1em | Manrope 700 | espresso |
| `kicker` | 11px / 0.14em | Plex Mono 500 | paprika-pressed |
| `body` | 15.5px / 1.45 | Manrope 500 | espresso |
| `caption` | 13.5px / 1.4 | Manrope 500 | olive |
| `mono` | 11.5px / 0.04em | Plex Mono 500 | olive |

Tones: `default` espresso, `muted` olive, `disabled` sage, `inverse` steamed milk, `primary` paprika-pressed, `secondary` basil, `accent` honey, `icon` cocoa.

### 4.2 Screen-specific type (lock these)

| Place | Spec |
| --- | --- |
| Home greeting | Display 27 / 800. Two lines: `{Morning\|Afternoon\|Evening}, {Name}.` then a status line. |
| Onboarding title | Display **36px / 1.06**, extra-bold. Body 16.5 / 1.5, max-width 300. |
| Explore hero title | Inverse 24px / 1.12 / 800 on photo. Kicker honey mono 10.5 / 0.14em. |
| Cook plan title | 32px / 800 steamed milk. Kicker honey mono, tracking ~2. |
| Cook step body | **30px / 36 leading / Manrope 700** steamed milk. This is the product. |
| Cook complete | 33px / 36 leading / 800. “You cooked {title}.” |
| Primary CTA | 16.5px Manrope 700. Ghost 14.5 / 600. Secondary 15.5. |
| Tab labels | Mono 10.5 / 0.2 tracking. |
| Recipe card title | 15.5 / 1.28 / Manrope 700, 2 lines. |
| Kitchen empty title | 19px / 700, centered. |

Section labels are **uppercase**, tracking 0.1em, espresso. Kickers are **uppercase**, tracking 0.12–0.16em, paprika on cream, honey on photos and in cooking.

---

## 5. Layout grammar

### 5.1 Spacing

Horizontal page padding is **20px** (`px-5`) on almost every browse screen. Onboarding uses 24. Cook uses 22.

Vertical rhythm between Home sections: **26px** (`pb-[26px]`). Cards inside a row: 12–14px gap.

Safe area: `Screen` insets **top, left, right** — **not bottom**, because the tab bar owns the home indicator. Full-screen flows (cook, onboarding) handle their own bottom padding (~30px).

### 5.2 Radius

| Token | Value | Use |
| --- | --- | --- |
| `icon` | 14 | 44×44 icon buttons |
| `card` | 16 | Cards, inputs (inputs actually 15), plan wells |
| `cta` | 18 | Primary buttons conceptually; shipping lg is **17** |
| `sheet` | 28 | Sheet top corners |

Also used in product: chips 13, capture tiles 18, Explore hero 22, empty/error panels 20, toasts 17, cooking-now card 20, tab icon circle = pill. Sheets are **only rounded on top**.

Keep corners **soft (12–20)** so the palette feels edible, not industrial. No 4px Material chips. No 999 pills except the extraction source pill and onboarding progress dots.

### 5.3 Elevation & shadow

Almost everything is **flat + crust hairline**. The only branded shadow is the large paprika CTA:

```
shadowColor: paprika
offset: 0, 8
opacity: 0.28
radius: 18
elevation: 6
```

Do not add drop shadows under cards, tab bar, or chips.

Overlay behind sheets: `rgba(26, 22, 18, 0.42)`.

### 5.4 Hit targets

**44×44 minimum** everywhere (`min-h-11`). Primary cook buttons are 56–62pt tall. Icon buttons 44×44. Tab slots 62 tall. Checkboxes 26–30 inside a 44 hit area.

### 5.5 Surface stack (light)

```
cream page
  → linen / peach wells (plan, nutrition, empty)
    → butter cards / inputs
      → crust hairlines
        → espresso type, olive captions
          → one paprika CTA
          → basil “have” chips
          → honey kickers / stars
```

---

## 6. Component inventory

Build with these primitives. Do not invent a second button language.

### 6.1 Button

Variants: `primary` | `secondary` | `ghost` | `destructive` | `inverse`.

| Variant | Light fill | Light label | Dark cook fill | Dark cook label |
| --- | --- | --- | --- | --- |
| primary | paprika | white | paprika-400 | espresso |
| secondary | basil-600 | white | same | white |
| inverse | espresso | steamed milk | espresso-as-text-color fill still espresso hex in light tokens | steamed milk |
| destructive | chili | white | chili | white |
| ghost | none (often peach wash) | paprika-pressed | none | paprika-pressed |

Sizes:

- `lg` — min-height 56, radius 17, px 20. Large paprika CTAs also get the terracotta shadow.
- `md` — min-height 48, radius 15.
- `icon` — 44×44, radius 14.

Press: scale to **0.97** in 120ms, back in 180ms (`PressScale`). Disabled: 50% opacity.

Typical pairs: paprika primary + ghost “Clear” on peach; inverse “Show results” / “Got it” / “Back to cooking”; destructive only for Stop cooking / delete collection.

### 6.2 Icon button

44×44, radius 14, butter fill, crust border. Search on Home is this. Hero back on recipe is **glass** `bg-white/86` instead — same size, no border.

### 6.3 Chip

Unselected: peach fill, cocoa 13px / 600, radius 13, px 15, min-height 44.  
Selected: **espresso fill**, steamed-milk type.  
Optional leading source icon at 16.

Used for Explore filters, Kitchen source/time, onboarding taste, pantry categories, recipe categories.

### 6.4 Input

Peach fill, crust border, radius 15, min-height 48 (88 multiline). Manrope 600, 15.5, espresso. Placeholder olive. Error: chili border + chili caption. Label: caption / cocoa.

Search field is the same language: peach, 48 tall, crust, inline magnifier (olive circle + stem) — not a system search bar.

### 6.5 Card

Radius 16, butter, crust border, padding 16. Recipe photos **are not this** — they are `PhotoStandIn` with no chrome, title below.

### 6.6 Sheet

Modal, transparent, no system animation. Overlay fades 180ms. Panel slides 300ms with bezier `(0.2, 0.8, 0.2, 1)`. Max height 80%. Cream fill, radius 28 on top, 20px side padding, 22pt top, bottom `max(safe, 34)`. Dimiss by overlay tap.

**Confirm sheet:** title + caption + row of ghost “Keep” (peach) and inverse/destructive confirm (flex 1.4). Pending label becomes “Working…”.

### 6.7 Toast

Absolute, 16px side inset, **104pt from bottom** (clears tab bar). Espresso fill, radius 17, 14px / 600 steamed milk. Leading 26×26 paprika rounded-9 glyph tile (espresso glyph). Optional action pill `rgba(255,255,255,0.14)`, 34 tall, 12.5 / 700. Auto-dismiss 2600ms, or 7000ms if there is an action. Enter: fade-down 260ms spring. Exit: fade 120ms.

Glyphs in product: `✓` save, `↓` shopping, `›` stub, `!` preview fail.

### 6.8 Empty / error / stale / skeleton

| State | Treatment |
| --- | --- |
| Empty | Linen panel, radius 20, crust, caption + optional paprika md button. Kitchen empty is centered 19px title + caption + button, no panel. |
| Inline error | Same linen panel. Alert role. Paprika Retry. **Never hide the rest of the recipe.** Nutrition/notes/collections fail in-section. |
| Stale | Olive caption: “Showing last loaded recipes. Pull to refresh.” Live region polite. |
| Skeleton | Linen bone, butter 80pt sweep 1400ms. Shapes: cards, grid, detail (hero+title+CTA), list, nutrition, preview, timeline. Reduced motion: static linen, no sweep. Loaded content fades in 180ms. |

Pull-to-refresh tint is paprika.

### 6.9 Timer bar (browse chrome)

Espresso rounded-14, mx 14, mb 8, honey 8pt breathe-dot, Manrope 600 13 inverse label, **Plex Mono 700 15** clock, Pause/Resume on white/14. Hidden when no timer.

### 6.10 Recipe card

Photo 16 radius (132 tall in inbox/horizontal, 118 in grid, 112 on Explore). Optional espresso-80% badge `NEEDS REVIEW` / `READY TO COOK` top-left, 9.5px inverse tracking. Favorite heart 44×44 top-right (glass or berry). Title 15.5 / 700. Source icon 14 + olive caption. Optional honey stars + `N× cooked`. Category pills peach, 8 radius, 10.5 cocoa.

Press uses PressScale. Heart uses **pop** (spring to 1.16 then 1).

### 6.11 Cooking now card

Espresso fill, radius 20, mx 20. Honey mono kicker `COOKING NOW`. Inverse 18 / 800 title. Muted `#B5A898` step count. Paprika segment bars vs white/16. Resume primary + Stop ghost with steamed-milk border. Stop opens destructive confirm.

### 6.12 Pantry / shopping checkboxes

Unchecked: butter + crust, radius 9, 26–30px. Checked: **basil fill**, white check. Pop on toggle. Done rows fade to 42% opacity.

“You have” chips: basil-soft, basil-700 13px, radius 12.

### 6.13 Stars

22px. Filled honey, empty steam. Pop on change. 44 hit area each.

---

## 7. Iconography

**No icon font. No SF Symbols as the brand.** Two custom families:

1. **Food tab icons** — geometric food, built from theme colors (burger, lemon compass, pot, apple, tomato). Size 28 in the bar; capture tomato 40.
2. **Source icons** — rounded-square brand marks (Instagram glyph, YouTube play, etc.) at 14 / 16 / 28 / 32 / 40.

Chevrons are a 22px `‹` in cocoa, or the SVG `ChevronLeft` on import preview. Cook previous is a 28px `<` on a ghost square 62×62.

Daisy (see §10) is illustration, not an icon. She is **decorative** (`accessibilityElementsHidden`); status is announced as text.

---

## 8. Motion

Library: **Reanimated 4**. Shared easing: cubic-bezier **`(0.2, 0.8, 0.2, 1)`**.

### 8.1 Durations

| Token | ms | Use |
| --- | --- | --- |
| instant | 120 | Press in, chip exit, toast exit |
| fast | 180 | Most enters, overlay, tab opacity, plus rotate, value crossfade |
| toast | 260 | Toast enter |
| sheet | 300 | Sheet slide (also keyboard follow) |
| step | 380 | Cook step content fade |

Stagger: `index * 40ms`, cap 240ms (cards 36/180, timeline 48/200, mosaic 50/150, pantry 24/120).

### 8.2 Springs

| Name | damping | stiffness | mass |
| --- | --- | --- | --- |
| snappy | 14 | 320 | 0.5 |
| gentle | 18 | 220 | 0.7 |

Tab icon: damping 16, stiffness 220.

### 8.3 Presets (`MotionItem`)

| Preset | Enter | Exit | Where |
| --- | --- | --- | --- |
| `section` | FadeInDown + gentle spring, stagger | — | — |
| `card` | FadeInDown, 36ms stagger | — | Home recipe grids/rows |
| `chip` | ZoomIn snappy 180 | ZoomOut 120 | Category chips |
| `timeline` | FadeInDown, 48ms stagger | — | Revision history |
| `mosaic` | Fade 180, 50ms stagger | — | Collection covers |
| `pantry` | Fade 120, 24ms stagger | — | Organized pantry rows |
| `content` | Fade 180 | — | Skeleton → content |
| `toast` | FadeInDown 260 spring | Fade 120 | Toasts |
| `step` | Fade 380 | — | Cook instruction swap |

Layout reorder: `LinearTransition` + gentle spring (pantry morph, lists).

### 8.4 Micro-interactions (keep)

| Name | Behavior |
| --- | --- |
| **PressScale** | 0.97 while down |
| **Pop** | 1 → 1.16 snappy → 1 gentle. Hearts, stars, servings number, shop checks |
| **Crossfade** | Opacity 0.35 → 1 in 180ms when a value string changes (nutrition numbers) |
| **Breathe** | Opacity 1 ↔ 0.35, 700ms each way, infinite. Honey timer dots |
| **Tab icon** | Scale 0.84↔1 spring, opacity 0.52↔1, paprika-soft disc |
| **Capture plus** | Rotate 0° → 45° in 180ms |
| **Onboarding dots** | Width 7 → 22, paprika vs `#E0D5C5` |
| **Skeleton sweep** | Butter bar translates across linen, 1400ms loop |
| **Cook complete** | Paprika full-screen flash 0.55 → 0 in 700ms; check ring scales 0.72 ↔ 1.08, 900ms breathe |
| **Servings** | Number pops when it changes |

**Route transitions are none.** Do not add iOS push/pop chrome.

### 8.5 Reduced motion (mandatory)

`reduceMotion` preference: `system` | `reduce` | `full`. Combined with OS `AccessibilityInfo`.

When reduced is on:

- All `entering` / `exiting` / `layout` presets become **undefined** (instant).
- PressScale does not shrink.
- Pop does not run.
- Breathe holds opacity 1.
- Skeleton has no sweep.
- Sheets snap (no slide).
- Tab icons snap scale/opacity.
- Daisy: no blink, no theater chips, poses snap, opacity still fades 400ms, intro sequence skipped, success hold 400ms instead of 1400ms.
- Cook complete: no flash, ring static at scale 1.

Never ship a looping animation that ignores this.

### 8.6 Haptics

| Event | Feedback |
| --- | --- |
| Tab change, capture open/close | Light impact |
| Cook next step | Medium impact |
| Daisy analyzing/processing starts | Light |
| Daisy success, add-to-shop, favorite paths that succeed | Success notification |

Fail silently on web.

---

## 9. Screen-by-screen composition

Paint the **inner column**. Status bar is dark-content on cream, light-content on cook dark.

### 9.1 Onboarding (3 steps, no tabs)

Progress: three pills, 7pt tall. Active stretches to 22pt paprika; future is `#E0D5C5`. Skip (olive caption) top-right.

Kicker paprika mono. Title 36 extra-bold. Body olive 16.5, max 300 wide.

- Step 1 — promise. CTA “Show me”. Foot “No account needed yet.”
- Step 2 — taste chips (Italian, Korean, Quick weeknights, Baking, One-pan, Vegetarian). Selected = espresso chips. CTA “Continue”. Foot “Tap a few, or skip.”
- Step 3 — 2×3 source tiles (72 tall, 15 radius, butter, crust) with source icons. CTA “Capture a recipe” finishes onboarding **and opens capture**. Foot “This one's on us — no signup.”

Large paprika button pinned to the bottom + caption under it.

### 9.2 Home (lock this order)

Do **not** add Tonight, From your kitchen, or an infinite feed. Shipping composition:

1. **Header** — mono kicker `TUESDAY · 18:40` (en-GB weekday, 24h clock). Display greeting. Status line is one of: “Dinner's underway.” / “Something's ready for you.” / “What are we cooking?” Search icon-button.
2. Kitchen sync banner (linen) if migration/offline needs a word.
3. **Cooking now** espresso card — only if a session is active.
4. **Recipe inbox** — section label + paprika “See all” → Kitchen. Horizontal 168-wide cards with review badges.
5. **Last uploaded** — horizontal cards (`sort=latest`). Empty: capture CTA.
6. **My recipes** — 2-column grid (`sort=engagement`: favorites, then cook count). Empty: ranking explanation + capture.

Pull paprika refresh. Errors are inline; cached recipes stay visible with a stale caption.

### 9.3 Explore

Display “Explore” + caption “Edited weekly. Nothing endless.”  
Horizontal filter chips; first selected (espresso).  
Editorial hero 220 tall, radius 22, 50% black scrim, honey issue kicker, white title max 240.  
`UNDER 30 MINUTES` 2-up cards.  
`CREATORS YOU IMPORT FROM` horizontal 132-wide butter tiles with source icon.

### 9.4 Kitchen

Display “My kitchen” + olive counts.  
Row of 46pt controls: filter dropdown (butter, crust, paprika dot if filters on), peach “Shopping →”, basil-soft “Pantry →”.

Filter sheet: radio rows with paprika filled dots, source chips with icons, time chips, ghost Clear + inverse Show results.

Lists are **62pt photo + title + meta**, crust dividers, paprika “Review” / “Cook” on inbox. Cooked shows `N× cooked` in mono.

Empty: 19px title, caption, paprika CTA.

Collections: mosaic of up to 3 photos (9 radius, 44 tall, 4pt gap), name, count. Create/rename via sheet. Delete is chili confirm.

### 9.5 You

Display `{Name}'s cooking`. Caption “Six weeks in · 3 dinners a week” (prototype flavor — keep the register).  
Three stat tiles (17 radius, butter, 25px display numbers).  
`YOU COOK MOSTLY` chips from onboarding tags.  
Settings rows: 15px cocoa label, olive hint, crust dividers. Cooking appearance toggles Dark kitchen / Light kitchen. Reduce motion cycles system → reduce → full.

### 9.6 Search

Back chevron + peach search field. Suggestion chips as olive phrases. Recent searches. Results as kitchen-style rows.

### 9.7 Recipe detail (browse)

Full-bleed 268 photo. Glass back 44 left; favorite 44 right (berry when on).  
Source icon + `Instagram · creator`. Display title. `N× cooked` caption. Category chips.  
Honey-50 review banner if inbox (`NEEDS REVIEW` / `READY TO COOK` + “Looks good”).  
**The only paprika fill:** “Start cooking” 58+ tall.  
Linen plan pills (`PREP · 8m → COOK · 20m`).  
Servings stepper: peach 44 buttons, popping number.  
`YOU HAVE` basil chips / `TO BUY` checklist + paprika text “Add N to shopping list”.  
Nutrition linen panel (section retry, sky “Updating”, portion vs per 100g chips, crossfading numbers).  
Honey stars. Notes. Collections entry. Rows: Original source (stub toast), Edit, Revision history.

Ingredient info sheet: kicker `INGREDIENT`, title, caption, inverse “Got it”.

### 9.8 Capture sheet

Title “Send me anything.” Caption about links, screenshots, voice notes.  
Two grids of 92pt tiles (18 radius, 10 gap): platforms then methods (Photo, Text, Voice note, Share sheet).  
Clipboard offer: peach well, source icon, mono preview, espresso “Use” pill 38pt.

### 9.9 Import preview

Back, source icon, URL field, thumbnail mosaic, large paprika “Make it a recipe”. Errors inline; failed preview also toasts.

### 9.10 Extraction (Daisy theater)

Cream full screen, no tabs. Centered Daisy 240. Optional source pill (`#F1E6D4`, quiet brown 12 / 600). Status 15 / 700, color by phase (ink / success green / error terracotta). Three quiet dots bounce while busy. “Cancel import” quiet 14 / 700.

Copy rotates every **2300ms**. Screen reader hears the first line of the bucket, not the mascot.

On success, hold Daisy’s grin **1400ms** then route to review. On fail, route to import error.

### 9.11 Import error

Daisy error pose 132, no food chips. Display title from error map. Caption 16 / 1.45, max 300. Paprika “Try again”. Ghost “Paste a different link”.

### 9.12 Review / edit

Same paper. Recipe editor fields (peach inputs). Save paprika. Cancel ghost. Success toast “Recipe reviewed and saved”.

### 9.13 Cook intro — The Plan

Night cocoa. “Exit” muted. Honey `READY IN {n} MIN`. 32px “The Plan”. Stages: honey mono `PREP · 8 MIN`, row text steamed/cocoa. Bottom lg “I'm ready — step 1” 60pt. Tab bar hidden. Keep-awake starts on the next screen.

### 9.14 Cook step (the product)

Keep-awake on. Swipe left next / right previous (50pt).  
Top: Exit | `STEP N OF M` muted mono | Ingredients.  
Stage bars: 4pt paprika when done/active, dim track otherwise. Active stage flex 1.6, mono 9.5.  
Center: honey `STEP N OF M` 12 / 700, then **30px instruction**. Ingredient chips. Timer row (honey when running). Dashed honey “WHILE THAT'S COOKING” if the next step can overlap.  
Bottom: 62 ghost `<` + paprika “Done · next step” / “Finish cooking”. Caption `swipe left · next`.

Ingredients sheet uses browse tokens (it is a cream sheet on top of the dark shell) — inverse “Back to cooking”.

### 9.15 Cook complete

Paprika flash, then pulsing paprika ring + espresso check. “You cooked {title}.” Three stat tiles. Note field. Paprika “Done” 58. Ghost “Cook again”. Keyboard lifts the note field with the sheet easing.

### 9.16 Pantry

Caption + large peach textarea. “Organize” paprika. Preview rows tinted with the item `colorToken` (peach/linen/basilSoft…). Honey-50 unresolved banner. “Accept and save”. Category chips. Saved rows with emoji tile + chili Delete. Undo via toast action.

### 9.17 Shopping

Category sections, crust rows, basil checks. Optional larger shopping-mode hits. Done items 42% opacity.

---

## 10. Daisy — the extraction mascot

Daisy is a **ginger cat in a basil apron**. She is the import ritual. She is not a logo, not a tab icon, not on Home.

### 10.1 Daisy colors (separate from Garden Plate UI)

| Token | Hex | Part |
| --- | --- | --- |
| fur | `#F2A65A` | Coat |
| furDeep | `#DE8340` | Shading |
| cream | `#FFEFDC` | Muzzle |
| inner | `#F7C9A3` | Ears |
| ink | `#3B2A20` | Eyes, line |
| apron | `#5E8C61` | Apron |
| spark | `#F2C14E` | Sparkles |
| success / successCopy | `#63B57B` / `#4E9B66` | Status on success |
| error | `#C25E4C` | Status on error |
| nose | `#CE6B4B` | Nose |
| blush | `#EFA286` | Cheeks |
| mouth | `#7A4636` | Mouth |
| tongue | `#E8836F` | Tongue |
| highlight | `#FFF9EF` | Specular |
| quiet | `#8A755C` | Cancel / source pill |
| pillBg | `#F1E6D4` | Source pill |
| clipboard | `#FFFFFF` | Processing clipboard |

ViewBox 260×234 (face crop `70 20 120 140`). Default size 240; error screen 132; `face` variant under 96.

### 10.2 Phases and poses

| Phase | Job status | Pose |
| --- | --- | --- |
| `idle` | waiting | Content mouth, soft blush, idle breath |
| `importing` | queued / acquiring | Pupils up-right, ears perk, mouth “o”, head tilt — she spotted a link |
| `analyzing` | extracting | **Glasses drop 24px onto the nose.** Beats: lookL, lookR, think (paw to chin, thought dots), check (squint) |
| `processing` | normalizing / validating | Glasses on, knit brow, focused mouth, **typing on a clipboard** (paws bounce 6px, right lags 250ms) |
| `success` | completed | Happy crescent eyes, grin, paw raise, sparkles, faster tail, extra blush |
| `error` | failed / cancelled | Flattened ears, sad brow, worry mouth, “?” |

Signature motion: glasses drop. Do not skip it on a fast backend — the display phase **forces** idle 700ms → importing 1300ms → at least 1200ms analyzing, then the real job phase, then 1400ms success hold.

### 10.3 Loops (timings from the prototype)

| Loop | Timing |
| --- | --- |
| Pose spring | 550ms, bezier `(0.34, 1.56, 0.64, 1)` |
| Pupil | 220ms |
| Opacity fades | 400ms |
| Blink | 130ms close; interval 2.4–5.0s random |
| Breathe | 3400ms, scale 1 → 1.015×1.035 from apron hem |
| Tail | ±5° to 9°, 2800ms (1100ms when celebrating) |
| Thought dots | 1600ms, 250ms stagger, rise 3px, opacity 0.25–1 |
| Sparkles | 1400ms, 150ms stagger, scale 0→1.3→0.4, 40° spin |
| Analyze beat | new beat every 1.1–2.0s |
| Chip focus | every 2300ms |

Theater chips sit in a 100pt band above her ears (Beef, Onion, Carrot with qty). They appear analyzing onward; quantities fade in during processing; checkmarks on success. Importing also flies in a source card.

Copy buckets: idle, importing, analyzing, extracting, processing, success, error — rotating lines in `DAISY_COPY` (see §11). Status line fades up 500ms, 4px.

---

## 11. Voice, copy, and empty/error language

Warm, specific, never blaming the user. Input is never “lost” in the copy.

**Daisy status (rotate these, don’t paraphrase into corporate):**

- Importing: “Fetching your recipe…”, “Grabbing the good part…”
- Analyzing: “Reading it like a chef…”
- Extracting: “Nothing gets past Daisy…”
- Processing: “Building your recipe…”
- Success: “Done — looks delicious.”
- Error: “Hmm, that recipe got away.”

**Errors (from the user-error map):**

- Rate limit: “Slow down a second” / “That source is busy.”
- Server: “Taking a short breather” / “Try again in a moment. Nothing you typed was lost.”
- Unsupported: “This video is private” / try website, Instagram, YouTube.
- Not found: “That recipe isn’t here.”
- Nutrition fail: recipe **stays**; “We couldn’t load nutrition. The recipe is still here.”

**Empties:**

- Inbox: “All caught up.”
- Saved: “Nothing saved yet.”
- Pantry: “Nothing saved yet. Organize a list and accept it.”
- Home latest: “You haven’t added any recipes yet. Capture a link, photo or note to get started.”

Toasts are one short sentence + a glyph, not banners.

---

## 12. Accessibility (design must honor)

- Hit targets ≥ 44.
- Tab, sheet, checkbox, radio roles and selected/expanded state.
- `accessibilityLabel` on icon-only controls (Search, Capture, hearts).
- Live regions: toasts/errors assertive or polite; cook step announces “Step N of M. {instruction}”; Daisy status announced as text; stale captions polite.
- Daisy is hidden from accessibility; her copy is not.
- Contrast as in §3.9.
- Reduced motion as in §8.5.
- Cooking theme Light is the accessibility escape from the night kitchen.
- Recovery after error: focus moves to the recovered section.

---

## 13. Photography and food

Let the **dish own the color**. UI stays cream + paprika + basil. Gradients behind photos stay low-saturation wheat (`#E6D9C4`). Hero overlays are espresso/black scrims, never colored filters.

Do not theme real photos with blue. Do not put paprika text on a tomato photo without a scrim.

Android adaptive icon and splash are cream `#FFF8F2`. Keep that.

---

## 14. What an AI designer must not do

- Start a new app, new name, or new tab structure.
- Fall back to iOS 26 starter chrome (`#F2F2F7`, liquid glass, SF large titles).
- Darken the whole app because cooking is dark.
- Use cool gray (`#F3F4F6`, `#6B7280`), pure black, or pure white as the only surfaces.
- Paint the tab bar paprika, or make inactive tabs paprika.
- Use paprika or honey as 12pt body on cream.
- Use chili for primary CTAs, or paprika for delete.
- Replace Manrope / IBM Plex Mono.
- Add a second display serif “for recipes”.
- Put lime, candy pink, or Material red in the UI.
- Show Daisy on Home or as a loading spinner on every screen.
- Add route push animations that fight `animation: 'none'`.
- Ignore reduced motion.
- Hide recipe content behind a full-screen nutrition error.
- Invent Tonight / infinite Explore feed / social comments. Shipping Home is greeting → cooking now → inbox → last uploaded → my recipes.

---

## 15. Token & file map (for implementation-faithful comps)

| What | Where |
| --- | --- |
| Hex tokens, fonts, radii, placeholders, source colors | `src/theme/tokens.ts` |
| CSS variables (NativeWind) | `src/global.css` |
| Tailwind color/font/radius aliases | `tailwind.config.js` |
| Cook shell + status bar | `src/theme/cook-shell.tsx` |
| Cook component tokens | `src/theme/cook-tokens.ts` |
| Motion presets | `src/lib/motion.ts` |
| UI primitives | `src/components/ui/*` |
| Tab bar + timer | `src/components/nav/*` |
| Food tab icons | `src/components/icons/food-tab-icons.tsx` |
| Daisy | `src/components/daisy/*` |
| Screens | `src/app/**` |
| Full palette reference | `COLOR_SCHEMA.md` |

NativeWind class examples you should reuse in comps: `bg-bg`, `bg-bg-elevated`, `bg-peach`, `bg-linen`, `border-crust`, `text-text`, `text-primary`, `bg-primary`, `bg-secondary-soft`, `rounded-card`, `rounded-cta`, `rounded-sheet`, `font-sans-extrabold`, `font-mono`.

---

## 16. One-line summary

**Light:** cream paper, butter cards, peach fields, espresso type, olive captions, paprika cook, basil in-stock, honey timers, berry save, espresso active tab, food icons, no gray.  
**Dark (cook only):** night cocoa, steamed-milk 30px steps, honey `STEP N`, paprika next, quiet ghosts for Exit/Previous, keep-awake, swipe.  
**Import:** Daisy the ginger cat, glasses drop, rotating chef copy, then a paper review.  
**Motion:** short springs, stagger, press 0.97, pop hearts, breathe timers; nothing if reduced motion.

That is Mise in Garden Plate. Cooking companion. Paper by day, board by night.
