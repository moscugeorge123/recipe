# AI Designer brief — ReciMe (Recipe)

**Audience:** an AI designer restyling, extending, or generating screens for this product.  
**Source of truth:** this file describes the **shipping mobile app**, not a discarded prototype.  
**Companion docs:** [`COLOR_SCHEMA.md`](./COLOR_SCHEMA.md) (ReciMe orange tokens). [`CLAUDE_DESIGN.md`](./CLAUDE_DESIGN.md) points here. If those disagree with this file, **this file wins**.

This is a cooking companion. People import recipes from Instagram, YouTube, the web, photos, and notes; cook from a white step-by-step shell; file cookbooks; plan a week; and shop by aisle. It is **not** a generic recipe feed, social network, grocery marketplace, or Discover product yet.

Target device: **portrait phone**, ~390–430pt wide, iOS-first (Android must still feel like the same kitchen). Inner fill is **white paper** `#FFFFFF`, never iOS grouped gray `#F2F2F7`.

---

## 1. Product identity

| | |
| --- | --- |
| **Working name in UI** | ReciMe (onboarding kicker `RECIME`). Orange wordmark on Recipes is `Recipe`. Expo display name is `Recipe`. |
| **Default person** | Sam (first name until they change it). |
| **Mood** | White paper, classic orange brand, black stadium buttons. Fresh, direct, edible. |
| **Not** | Cool gray SaaS, Material red, OLED black cook, candy-pink toys, liquid-glass iOS 26 chrome, SF Pro large titles, food-glyph tabs. |

**Voice:** warm, editorial, short. Second person. No corporate filler.

**Type:** **Inter** 500 / 600 / 700 / 800 via `@expo-google-fonts/inter`. Engineering still names tokens `fonts.manrope*` and `fonts.mono*` — they all point at Inter. Do not load Manrope or IBM Plex Mono.

---

## 2. How the app is structured

### 2.1 Two shells

There is **no system-wide dark mode**. Cooking is **white paper**, same as browse.

| Shell | When | Feeling |
| --- | --- | --- |
| **Browse (light)** | Recipes, Meal Plan, Groceries, Discover, Search, Recipe detail, Capture, Import, Pantry, Collections, Profile, Onboarding | White paper cookbook |
| **Cook (white)** | Cook intro (“The Plan”), cooking steps, cook complete | Same white paper. Screen stays awake. Black CTAs. Orange kickers. |

Do **not** invent a night-kitchen cook shell. `CookShell` defaults to light. Dark cook tokens exist only for leftover contrast tests — do not paint screens with `.cook-dark`.

The **tab bar is hidden** during onboarding, extraction, cooking, and other full-screen capture flows. On browse tabs it is always **four tabs + a center paprika FAB**.

A **timer bar** can float **above the tab bar** while a cook timer is running.

### 2.2 Navigation map

Expo Router, no native headers (`headerShown: false`).

**Stack + Tabs:** `animation: 'fade'` (crossfade) on every route — same transition as pressing a tab. The tab bar stays mounted.

When `useReducedMotion()` is on: Stack and tab animation is `'none'`, the FAB plus does not rotate, meal-plan drag is off.

Do **not** add shared-element hero zoom or confetti.

```
Root stack (white #FFFFFF)
│
├── Onboarding  (first launch; no tabs)
│
├── (tabs)  ← four destinations + center capture
│     ├── Recipes    /
│     ├── Meal Plan  /plan
│     ├── Groceries  /groceries
│     └── Discover   /discover   ← empty placeholder
│     └── (hidden redirects) /kitchen → /  /explore → /discover  /you → /profile
│
├── Search              /search
├── Profile             /profile
├── Shop / Pantry       redirect → /groceries
├── Groceries add       /groceries/add
├── Plan add            /plan/add
├── Collection detail   /collection/[id]
│
├── Recipe detail       /recipe/[id]
│     ├── Edit, History, Revision
│
├── Import preview / extract / review / error / manual
│
└── Cook (CookShell, white)
      ├── The Plan      /cook/[id]
      ├── Step          /cook/[id]/step
      └── Complete      /cook/[id]/complete

Global overlays: CaptureSheet (two-step chooser), Toast, ConfirmSheet
```

Center **+** is **not a tab**. It toggles the capture sheet. The paprika disc rotates the plus 45° into an × while the sheet is open (skipped when reduced motion).

### 2.3 Tab bar (always this 5-slot composition)

| Slot | Label | Icon | Job |
| --- | --- | --- | --- |
| 1 | Recipes | Bookmark | Cookbooks library + all recipes. Orange `Recipe` wordmark, profile person. |
| 2 | Meal Plan | Calendar | Week grid with drag (off when reduced motion). |
| 3 | *(no label)* | Paprika disc + white plus | Capture / import / new cookbook |
| 4 | Groceries | Basket | Shopping list by aisle + pantry panel |
| 5 | Discover | Compass | Empty placeholder only. Do not invent a feed. |

**No food-glyph tabs** (no burger, lemon, pot, apple, tomato icons). Icons live in `recime-tab-icons.tsx`.

**Active tab is espresso type.** Active icon sits on a **paper** (`#F8F7F2`) circle. Inactive label/icon uses `tabInactive` `#757472`.

Do **not** paint the tab bar paprika. Do **not** use SF tab icons.

Tab bar surface: white page, hairline top, 10pt side padding, bottom = `max(safe-area, 12)`. Each slot is 62pt tall. Labels: Inter 11px. Center FAB is 56pt paprika.

### 2.4 User journeys (keep these intact)

1. **First open** — 3-step onboarding (promise → taste chips → capture sources) → Recipes. Skip is always available. No quiz, no paywall.
2. **Import** — Capture sheet (Add a Recipe / Add a Cookbook) → source tiles → Daisy extraction → review editor → recipe detail.
3. **Import fail** — Daisy error pose → title + caption + black “Try again”.
4. **Cook** — Recipe detail “Start cooking” → The Plan → swipe/step through → complete.
5. **Recipes** — Cookbooks / All Recipes. Collections with photo mosaics.
6. **Meal Plan** — week strip, slot popover, drag to reorder.
7. **Groceries** — aisle shopping list + pantry organize.
8. **Discover** — “Nothing here yet.” Stop. Do not invent a feed, Ask ReciMe, or confetti.

---

## 3. Design system — ReciMe orange

Name the chrome **ReciMe orange**. Neutrals stay warm so food photos look appetizing. White paper instead of cream cookbook. Paprika is the **brand orange**, not the filled button.

### 3.1 Brand colors

| Token | Name | Hex | Job |
| --- | --- | --- | --- |
| `paprika` | Orange | `#F97316` | FAB, Recipes wordmark, active icon, kickers, progress dots. |
| `cta` | Black | `#232220` | **Primary button fill.** Skip on onboarding. Selected chips. |
| `page` | White | `#FFFFFF` | Screen background. |
| `paper` | Warm paper | `#F8F7F2` | Header disc, unselected chips, cook wells. |
| `espresso` | Ink | `#2A2118` | Primary text, active tab. |
| `basil` | Basil | `#2F8F5B` | In-stock / pantry / success. |
| `honey` | Honey | `#E8B923` | Stars, timers (punctuation only). |
| `berry` | Berry | `#D94F70` | Favorite heart on. |

**One filled black CTA per view.** Orange is FAB / wordmark / active icon / kicker — not every button. Outline / ghost for everything else.

Primary pressed orange: `paprikaPressed` `#EA580C`. Soft wash: `paprikaSoft` `#FFF4E8`. Disabled primary: `ctaDisabled` `#E5E5E3`.

### 3.2 CTA grammar

| Component | Fill | Label |
| --- | --- | --- |
| Primary button (`Button` default) | `cta` `#232220` | white |
| Primary disabled | `ctaDisabled` | white |
| Ghost / text | transparent | paprika |
| FAB | paprika | white plus |
| Onboarding Skip | none | black `cta` |
| Selected chip | `cta` | inverse |
| Unselected chip | `paper` | cocoa |

Large primary: min-height 56, radius ~28 (stadium). Paprika shadow is optional on the FAB, not required on every black pill.

### 3.3 Light browse tokens

See [`COLOR_SCHEMA.md`](./COLOR_SCHEMA.md). CSS variables in `global.css` use white `--color-bg`. NativeWind: `bg-bg` is white.

Never pure iOS gray as a full screen. Small glass buttons on a photo hero may be `rgba(255,255,255,0.86)`.

Supporting garden hues (`basil`, `honey`, `berry`, `olive`, `chili`, `sky`) stay for tags, ratings, and copy. Do not treat them as chrome.

### 3.4 Cook tokens

Cook is **white**. `cook-tokens.ts` light theme: page background, espresso type, paprika kickers, paper chips, black primary via `Button`.

Do not apply `.cook-dark`. Do not ship a Cooking appearance setting (profile has Units + Reduce motion + Replay onboarding only).

### 3.5 Contrast

Body 4.5:1. White on black CTA is fine. White on paprika-500 is OK for **17pt+ bold** FAB/wordmark, not for 12pt captions. Prefer paprikaPressed for small orange labels. Olive on white is OK for captions.

---

## 4. Typography

**Inter only.** Never SF Pro, never a serif display, never a third sans.

NativeWind aliases still read `font-sans*`. Kickers and section labels use Inter with tracking ~0.02–0.04em (not 0.14em mono).

| Variant | Size | Weight | Default tone |
| --- | --- | --- | --- |
| `display` | 27px / 1.14 / -0.02em | 800 | espresso |
| `title` | 23px | 800 | espresso |
| `section` | 13px / 0.04em | 700 | espresso |
| `kicker` | 11px / 0.02em | 600 | paprikaPressed |
| `body` | 15.5px / 1.45 | 500 | espresso |
| `caption` | 13.5px / 1.4 | 500 | olive |
| Recipes wordmark | 28px | 800 | paprika |

Onboarding title: Display **36px / 1.06**. Body 16.5 / 1.5, max-width 300.  
Cook step body: large Inter 700 on white.  
Primary CTA: 16.5px Inter 700 white on black.  
Tab labels: Inter 11px.

---

## 5. Layout grammar

Horizontal page padding is **20px** (`px-5`) on almost every browse screen. Onboarding uses 24.

Safe area: `Screen` insets **top, left, right** — **not bottom**, because the tab bar owns the home indicator. Full-screen flows (cook, onboarding) handle their own bottom padding.

Radius: cards 16, stadium CTAs ~28, sheets 28 on top, chips 13, capture tiles 18. Hit targets **44×44**. Almost everything is **flat + hairline**. Overlay behind sheets: `rgba(35, 34, 32, 0.42)`.

---

## 6. Component inventory

Build with existing primitives. Do not invent a second button language.

- **Button** — `primary` is black. `ghost` paprika label. `inverse` espresso fill. `destructive` chili.
- **Chip** — paper unselected, black selected.
- **Icon button** — 44×44, paper/butter, crust or none.
- **Sheet** — cream/white, radius 28 on top. Overlay fade 180ms, panel slide 300ms unless reduced.
- **Toast** — espresso fill, paprika glyph tile.
- **Recipe card** — photo + title; PressScale; heart pop.
- **Cooking now card** — espresso fill on Recipes when a session is active; Resume / Stop.
- **Capture sheet** — two steps: Add a Recipe / Add a Cookbook, then source tiles. Title is not “Send me anything.”

---

## 7. Iconography

**No icon font. No food-glyph tab set.** ReciMe line icons for Recipes / Meal Plan / Groceries / Discover / profile person. Source icons remain rounded-square brand marks.

Daisy is illustration, not an icon. She is **decorative**; status is announced as text.

---

## 8. Motion

Library: **Reanimated 4**. Shared easing: cubic-bezier **`(0.2, 0.8, 0.2, 1)`**.

### 8.1 Route transitions (allowed)

| Surface | Animation |
| --- | --- |
| All routes (tabs + stack) | `fade` |
| Reduced motion | `'none'` everywhere; no FAB plus rotate; no meal-plan drag |

Do **not** add shared-element hero zoom or confetti.

### 8.2 In-screen presets

Keep PressScale 0.97, pop on hearts/stars, breathe on timer dots, tab icon spring, onboarding dots 7→22, Daisy theater. All skip when reduced.

`reduceMotion` preference: `system` | `reduce` | `full`, combined with OS `AccessibilityInfo`.

---

## 9. Screen-by-screen composition

Status bar is dark-content on white (browse and cook).

### 9.1 Onboarding (3 steps, no tabs)

White paper. Three pills, 7pt tall. Active stretches to 22pt **paprika**; future is `ctaDisabled`. **Skip** is black Inter 600, top-right.

Kicker paprika Inter. Title 36 extra-bold. Body olive 16.5, max 300.

- Step 1 — promise. CTA **Next** (black pill). Foot “No account needed yet.”
- Step 2 — taste chips. Selected = black chips. CTA **Next**. Foot “Tap a few, or skip.”
- Step 3 — 2×3 source tiles (paper, crust). CTA **Capture a recipe** finishes onboarding **and opens capture**.

No quiz. No paywall.

### 9.2 Recipes (lock this)

Orange `Recipe` wordmark + profile person. Optional **COOKING NOW**. Segments: Cookbooks | All Recipes. Search field. Filter. Do **not** mount inbox / last uploaded / my-recipes / tonight / from-your-kitchen.

### 9.3 Meal Plan

`Meal Plan` header. Week strip. Day columns with meal chips. Drag to reorder unless reduced motion. Add sheet at `/plan/add`.

### 9.4 Groceries

`Grocery List` header. Pantry | Shopping list chips. Aisle sections. Pantry organize lives here (not a Kitchen tab). `/shop` and `/pantry` redirect here.

### 9.5 Discover

Centered compass + “Discover” + “Nothing here yet.” Empty placeholder **only**.

### 9.6 Profile

`{Name}` header. Units, Reduce motion, Replay onboarding. No Cooking appearance row.

### 9.7 Recipe detail

Full-bleed photo. Favorite. **Start cooking** is the black pill. Ingredients list; pantry caption “N already in Pantry” — not `YOU HAVE` / `TO BUY` section labels. Nutrition, stars, notes, collections.

### 9.8 Capture / import / Daisy

Two-step chooser, then Daisy extraction theater on white. Keep Daisy poses, glasses drop, rotating chef copy. Success hold then review.

### 9.9 Cook

White paper. Honey/orange `STEP N`. Large instruction. Black “Done · next step” / “Finish cooking”. Complete: “You cooked {title}.” Black Done, ghost Cook again.

---

## 10. Daisy — the extraction mascot

Daisy is a **ginger cat in a basil apron**. Import ritual only. Not a logo, not a tab icon, not on Recipes.

Colors, poses, and loops are unchanged from the extraction theater (`src/components/daisy/*`). Reduced motion: no blink, poses snap, intro sequence skipped.

---

## 11. Voice, copy, and empty/error language

Warm, specific, never blaming the user.

Discover empty: “Nothing here yet.”  
Groceries empty: “Nothing on your list yet.”  
Pantry empty: “Nothing saved yet. Organize a list and accept it.”

Toasts are one short sentence + a glyph.

---

## 12. Accessibility

- Hit targets ≥ 44.
- Tab / sheet / checkbox roles and selected state.
- `accessibilityLabel` on icon-only controls (Profile, Capture, hearts).
- Live regions for toasts, cook steps, Daisy status.
- Daisy is hidden from accessibility; her copy is not.
- Reduced motion as in §8.
- Recovery after error: focus moves to the recovered section.

---

## 13. What an AI designer must not do

- Start a new app or a fifth primary tab.
- Invent a Discover feed, Ask ReciMe, or confetti.
- Fall back to iOS 26 starter chrome (`#F2F2F7`, liquid glass, SF large titles).
- Darken cooking because the old app was a night kitchen.
- Paint the tab bar paprika, or restore food-glyph tabs (`HomeFoodIcon` and friends).
- Use paprika as the filled button (that is `cta` black).
- Replace Inter with Manrope / Plex Mono / a display serif.
- Put Daisy on Recipes or as a spinner on every screen.
- Ignore reduced motion (must kill stack slides, plus rotate, and drag).
- Re-mount Home inbox / latest / my-recipes, or Kitchen Inbox / Saved / Want to cook / Cooked lists.

---

## 14. Token & file map

| What | Where |
| --- | --- |
| Hex tokens, Inter aliases, radii | `src/theme/tokens.ts` |
| CSS variables | `src/global.css` |
| Full ReciMe orange lock | `COLOR_SCHEMA.md` |
| Cook shell (white) | `src/theme/cook-shell.tsx` |
| Cook tokens | `src/theme/cook-tokens.ts` |
| Motion + stackPushAnimation | `src/lib/motion.ts` |
| Tab bar | `src/components/nav/tab-bar.tsx` |
| ReciMe tab icons | `src/components/icons/recime-tab-icons.tsx` |
| Daisy | `src/components/daisy/*` |
| Screens | `src/app/**` |

---

## 15. One-line summary

**Light everywhere:** white paper, black stadium CTAs, orange FAB and wordmark, Inter, four tabs + paprika plus, white cook.  
**Import:** Daisy the ginger cat, then a paper review.  
**Motion:** fade on every route (tabs + stack); nothing extra if reduced motion.

That is ReciMe. Cooking companion. Paper and orange, cook included.
