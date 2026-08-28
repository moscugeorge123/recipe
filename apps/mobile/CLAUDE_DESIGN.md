# Claude Design — Garden Plate on Mise

**Audience:** Claude Design, restyling the existing **Mise** prototype.  
**Palette:** [`COLOR_SCHEMA.md`](./COLOR_SCHEMA.md) (Garden Plate).  
**Existing UI:** the Mise interactive prototype (iOS 402×874, Manrope, terracotta-on-paper). Do not throw that product away.

This file tells you **what the schema means on Mise**, **how light vs dark already work in the prototype**, and **how to recolor without redesigning**.

---

## What you are looking at

Mise is a **cooking companion**, not a generic recipe feed. People import from Instagram / YouTube / TikTok / the web, review an Inbox, cook from a dark step-by-step mode, then file the recipe under Cooked.

The current prototype already has:

- Warm paper shell (`#FAF6F0`), ink (`#221D19`), terracotta CTAs (`#C4522E`)
- **Manrope** 500 / 600 / 700 / 800 — not SF Pro, not a serif display
- **ui-monospace / Menlo** for kickers, clocks, `STEP 3 OF 8`, `TUESDAY · 18:40`
- Soft radii **14–20** on cards and buttons; primary CTA **56–62px** tall, radius **17–19**
- Terracotta button shadow `0 8–10px 18–26px rgba(196,82,46,.28–.34)`
- **Light** for browse. **Dark** only for cooking (and the floating timer bar)

Your job: keep that product, type, IA, and motion. **Swap the hexes to Garden Plate.** Make light fresher/livelier (paprika + basil + cream). Keep cooking mode a warm night kitchen, not OLED black.

Do **not**:

- Start a new app, new name, or new tab structure
- Fall back to the iOS 26 starter (`#F2F2F7`, `#000`, liquid-glass pills, SF large titles) for app chrome
- Invent cool gray, Material red, or a second type family
- Recolor by “making everything paprika”

---

## Product to preserve

### Tabs (bottom, always 4 + center capture)

| Key | Label | Job |
| --- | --- | --- |
| `home` | HOME | Evening greeting, Cooking now, Recipe inbox, Tonight, From your kitchen |
| `explore` | EXPLORE | Edited collections, not an infinite feed (“Nothing endless.”) |
| **capture** | **+** | Center FAB — import Instagram / YouTube / TikTok / web / paste / screenshot |
| `kitchen` | KITCHEN | Inbox, Saved, Want to cook, Cooked, Collections |
| `profile` | YOU | History, units, replay onboarding, timer notifications |

**Active tab is ink (espresso), not paprika.** Paprika is for cook / import / save-the-recipe. Inactive tabs are sage. Kitchen may show a paprika inbox badge on the icon.

Hide the tab bar in onboarding, extraction, cooking, and full-screen capture flows — same as the prototype.

### Screens (keep all of them)

Onboarding → Home → Search → Explore → Capture sheet → Source preview → Extraction → Review → Import error → Manual paste → Recipe detail → Cook intro (The Plan) → Cooking (steps) → Cook complete → Kitchen (Inbox / Saved / Want to cook / Cooked / Collections) → Shopping list → Profile → Filter sheet → Ingredient sheet → Toast.

Prototype hint under the phone stays useful: *Try: + → Instagram → extraction · Recipe → The Plan → Start cooking · Cooking → swipe left · Kitchen → Inbox.*

### Voice

Warm, editorial, short. Examples already in the file — keep this register:

- “Evening, Sam. What are we cooking?”
- “Edited weekly. Nothing endless.”
- “Looks good — save it”
- “I'm ready — step 1”
- “WHILE THAT'S COOKING”

Section labels: `RECIPE INBOX · 2`, `TONIGHT`, `THE PLAN`, `INGREDIENTS` — Manrope 700, 13px, letter-spacing ~0.1em, espresso.

Kickers: Manrope is wrong here. Use **ui-monospace**, 10–11.5px, letter-spacing 0.12–0.16em, paprika or honey depending on surface (paprika on cream, honey on photos and in cooking).

---

## Two themes — this is not a system-wide toggle

Mise already encodes light vs dark. Honor it.

| Theme | When | Story |
| --- | --- | --- |
| **Light** | Default: home, explore, search, kitchen, profile, recipe detail, capture, shopping | Sunlit counter, paper cookbook |
| **Dark** | Cooking shell: cook intro, cooking steps, cook complete. Optional: `cookingTheme` Light for accessibility | Night kitchen, screen stays awake, dish still glowing |

`IOSDevice` gets `dark={true}` only when the cooking shell is on (prototype: `deviceDark` / `isDarkShell`). Status bar and home indicator follow that. Do not darken the whole app unless the user asks for a full dark mode.

The **timer bar** (when a timer is running on a light screen) is a dark espresso strip with honey pulse + steamed-milk type. It is a dark *component* on a light screen — keep that.

---

## What the schema means on Mise

Hex lives in [`COLOR_SCHEMA.md`](./COLOR_SCHEMA.md). Use **tokens**. Below is meaning in this product, plus the **old Mise hex** you are replacing.

### Paprika — “cook / import / go”

The appetite color. **The next irreversible cooking action.**

| On Mise | Examples |
| --- | --- |
| Primary CTA | Start cooking, Resume, I'm ready — step 1, Next step, Save to Cooked, Looks good — save it, Make it a recipe, Try again |
| Capture FAB | Center `+` |
| Links that continue a cook path | See all (inbox), View original (use paprika-600 so it isn’t a second filled button) |
| Inbox selected radio | Filled paprika dot |
| Cooking-mode step ticks | Small paprika dots on the plan timeline |

**Not paprika:** page backgrounds, headlines, error “this video is private” (use chili wash), inactive tabs, “Skip” on onboarding.

| Was (Mise) | Becomes |
| --- | --- |
| `#C4522E` fill + white label | Light: `primary` `#E25A3C` + `on-primary` white. Dark cook: `primary` `#EF6D52` + espresso label **or** keep white on paprika-600 if the existing 17–18px bold white still reads |
| `#A63F1F` “See all” | `paprika-600` `#C4472C` (light) |
| Shadow `rgba(196,82,46,.28)` | `rgba(226, 90, 60, 0.28)` |

One filled paprika control per view. Outline / ghost for the rest.

### Basil — “in stock / fresh / good”

The prototype already has a quiet garden green for “you have this ingredient” (`#EFF4EA` / `#4C6B3E`). **Promote that to a real second brand** — that is the “fresh” in Garden Plate.

| On Mise | Token |
| --- | --- |
| “You have X of Y” chips, pantry checkmarks | `secondary-soft` + `basil-700` text |
| Success toast, “Added to Cooked” | basil, not paprika |
| Vegetarian / from-your-kitchen cues | basil wash |
| Secondary outline button | basil stroke (e.g. “Review every field” stays ghost; don’t add a second filled green CTA next to Start cooking) |

Do not replace Start cooking with basil. Do not use lime.

| Was | Becomes |
| --- | --- |
| `#EFF4EA` / `#E8F0E3` have-chips | `basil-50` `#EAF7F0` |
| `#4C6B3E` / `#3F5A33` chip text | `basil-700` `#1C5C3A` |
| `#5E7A4F` | `basil-500` `#2F8F5B` if you need a filled success |

### Honey — “timer / stage / special”

The prototype’s amber (`#E39B2E`, `#EBB55E`) is **already honey**. Keep the job: timers, stage names (`PREP` / `COOK` / `FINISH`), “THE 25-MINUTE ISSUE” on a dark photo, “WHILE THAT'S COOKING”, cook-intro stage labels.

Honey is **punctuation**. Never a page fill. Never 12pt body on cream.

| Was | Becomes |
| --- | --- |
| `#E39B2E` pulse dot, STEP kicker | `accent` / `honey-400` `#E8B923` (light) or `honey-200` `#F6D56A` (on dark cook) |
| `#EBB55E` on hero photos | `honey-200` |
| `#FBF1E2` / `#EDDCB8` “needs review” banner | `honey-50` + `honey-800` kicker |

### Berry — “saved”

The save heart on recipe detail. Off = steam stroke. On = berry fill. Dessert tags if you add them. Not the tab bar. Not the FAB.

### Cream / peach / butter / crust — “paper and plates”

Mise already lives here. Shift slightly toward Garden Plate so food photos stay warm.

| Role | Was | Token | Light |
| --- | --- | --- | --- |
| Screen | `#FAF6F0` | `bg` | `#FFF8F2` cream |
| Prototype canvas (outside the phone) | `#EDE7DE` | linen | `#F3E6D8` (or keep `#EDE7DE` — it’s the artboard, not the app) |
| Raised cards, inputs, search field, white icon buttons | `#FFFFFF` | `bg-elevated` | `#FFFDF9` butter — **not pure white screens**; small buttons on a hero may stay white/86% blur |
| Wells, meta cards, “From your kitchen”, plan pills, recent chips | `#F2EDE4` | `surface` | `#FFE8D6` peach (if peach is too strong on large panels, mix: peach search, linen `#F3E6D8` for meta cards) |
| Borders | `#EBE2D6` `#E1D6C7` `#E8DFD3` | `border` | `#E6D3C2` crust |
| Skeleton / hairline | `#D8CBB9` | linen / crust | |

**Do not** use `#F2F2F7` (iOS grouped gray). That is the starter frame default. Mise’s inside fill is cream.

### Espresso family — “words and the dark plate”

| Role | Was | Token | Light |
| --- | --- | --- | --- |
| Headlines, body, logo MISE, active tab | `#221D19` | `text` | espresso `#2A2118` |
| Back chevron, secondary titles | `#3B342E` | `icon` / cocoa | `#4A3D32` |
| Captions, source lines, “Skip” | `#6B6058` `#7A6E62` | `text-muted` | olive `#6B7A62` |
| Inactive tab, placeholder, “Previous” on cook | `#8A7E72` `#9C9086` `#B6A99A` | `text-disabled` / sage | `#8A9580` |
| Dark cards (“COOKING NOW”), inbox confirm, timer bar | `#221D19` | espresso fill | `#2A2118` |
| Cooking page | `#181310` | `bg` dark | `#1A1612` |

Type on espresso fills is steamed milk `#F7F1E8` / `#F5EFE7` → dark `text` `#F5EDE4`. Muted on those fills: `#C9BEB0` → dark `text-muted` `#B5A898`.

### Chili vs paprika

Import error (“This video is private”) currently uses paprika on `#FBEAE1`. **Split them:**

- Error icon wash: `chili-50` `#FDECEA` + chili `#C43C2C`
- Primary recovery CTA “Try again”: still paprika (the cook path)
- Ghost alternatives: butter + crust border, cocoa type

Delete-recipe (if you add it) is chili, never paprika.

### Sky

Nutrition / helper only. Mise barely uses blue (`#3B5A8C` once). Do not introduce more.

---

## Light theme — browse Mise

**Surfaces:** cream page → peach or linen wells → butter cards → crust hairlines.

**Type:** espresso headlines (Manrope 800, 25–32px, tracking -0.02em). Olive captions. Paprika only on CTAs and kickers on cream.

**Home (lock this composition):**

1. Greeting: mono kicker `TUESDAY · 18:40` + “Evening, Sam.”
2. Search icon button: butter + crust
3. Optional **COOKING NOW** espresso card, honey pulse, paprika **Resume**
4. **RECIPE INBOX** row of import cards
5. **TONIGHT** full-bleed editorial card (photo owns color; honey kicker; white title)
6. **FROM YOUR KITCHEN** linen/peach panel, basil “in stock” story
7. Tab bar on butter, espresso active, sage inactive, paprika `+`

**Recipe detail:** photo hero, glass-blur 44px icon buttons, espresso title, paprika **Start cooking**, plan pills in linen, ingredients with basil have-chips. Inbox review banner = honey wash, not paprika.

**Capture / review:** same paper; one paprika confirm.

**Common light mistakes on this file**

- Leaving `#C4522E` after a restyle (swap to paprika tokens)
- Painting the tab bar paprika
- White `#FFFFFF` as the full screen
- iOS grouped-list gray
- Paprika 12pt body (“Skip”, source lines)

---

## Dark theme — cooking Mise

Cooking is a **different shell**, not “invert every screen.”

**When:** cook intro (“Ready in N min” / The Plan), cooking steps, cook complete. Background `#1A1612` (was `#181310`). Type steamed milk. Stage labels honey. Progress ticks paprika. Primary still the big terracotta/paprika button at the bottom.

| Token | Dark cook hex | On cooking UI |
| --- | --- | --- |
| `bg` | `#1A1612` | Full screen under the status bar |
| `text` | `#F5EDE4` | Step body (Manrope 700, ~30px) |
| `text-muted` | `#B5A898` / `#9C9086` | Exit, All, Previous, “swipe left · next” |
| `primary` | `#EF6D52` (or keep `#E25A3C` if you need continuity with light CTAs) | Next step, I'm ready, Save to Cooked |
| `accent` | `#F6D56A` | `STEP N OF M`, PREP/COOK/FINISH |
| Ingredient chip | `rgba(255,255,255,.07)` | qty espresso-milk + name muted |
| Parallel task | honey at ~9% fill, dashed honey 40% | “WHILE THAT'S COOKING” |
| Cook again | `rgba(255,255,255,.08)` | ghost on complete |

**Soft tokens are dark tints**, never light pastels. No `#FFF1ED` or `#EAF7F0` on the cook screen.

**`cookingTheme: Light`:** same cooking layout on cream, espresso type, paprika CTA — for bright kitchens / accessibility. Do not invent a third palette.

**Do not**

- Use `#000000` or iOS `#1C1C1E`
- Cool blue nav
- Paste home’s cream cards into cooking
- Drop Manrope for SF Pro because `IOSDevice` is dark

Timer bar on **light** home while cooking continues: espresso fill, honey pulse, steamed-milk clock, Pause/Resume on `rgba(255,255,255,.14)`.

---

## Light vs dark — token table (Mise)

Same names. Browse uses the Light column. Cooking uses Dark.

| Token | Light (browse) | Dark (cook) | Means in Mise |
| --- | --- | --- | --- |
| `bg` | `#FFF8F2` | `#1A1612` | Paper vs night board |
| `bg-elevated` | `#FFFDF9` | `#252019` | Cards / cook chrome |
| `surface` | `#FFE8D6` | `#312A22` | Wells / inset |
| `border` | `#E6D3C2` | `#4A3F34` | Hairline |
| `text` | `#2A2118` | `#F5EDE4` | Voice |
| `text-muted` | `#6B7A62` | `#B5A898` | Meta |
| `primary` | `#E25A3C` | `#EF6D52` | Cook / import |
| `on-primary` | `#FFFFFF` | `#2A2118` (or white on paprika-600) | CTA label |
| `primary-pressed` | `#C4472C` | `#E25A3C` | Pressed CTA |
| `primary-soft` | `#FFF1ED` | `#3A221C` | Selected card wash |
| `secondary` | `#2F8F5B` | `#45A36E` | In stock / success |
| `secondary-soft` | `#EAF7F0` | `#163325` | Have-chip |
| `accent` | `#E8B923` | `#F6D56A` | Timer / stage |
| `favorite` | `#D94F70` | `#E56B86` | Saved heart |
| `tab-active` | `#2A2118` | — (tab bar hidden) | You are here |
| `tab-inactive` | `#8A9580` | — | Other tabs |

Label layers with **token names**. Engineering maps them to NativeWind.

---

## Type, radius, motion (already in the prototype — keep)

| Thing | Spec |
| --- | --- |
| UI font | **Manrope** 500 / 600 / 700 / 800 |
| Kickers & clocks | **ui-monospace, Menlo** |
| Display | 25–32px / 800 / -0.02em / espresso |
| Section label | 13px / 700 / 0.1em / espresso |
| Primary CTA type | 16.5–18px / 700 / white or on-primary |
| Corner | 14–20 cards; 17–19 primary buttons; 44px icon buttons at 14 |
| Hit targets | 44px minimum |
| Motion | `breathe` on timer dots, `rise` / `stepIn` on cook steps, `toastIn` — respect `reduceMotion` |

Food photos: placeholder gradients in the prototype (`#E6D9C4` → `#DCCBB0`) are fine as photo stands-ins. Do not theme real photos with a blue overlay. Hero title scrim: espresso 40–76% is already in the file.

---

## Recolor checklist (do this, in order)

1. Keep every screen, tab, sheet, and piece of copy.
2. Replace `#C4522E` → paprika tokens; `#221D19` → espresso; `#FAF6F0` → cream; `#FFFFFF` large fills → butter; borders → crust; muted browns → olive/sage; `#E39B2E` → honey; have-chips → basil.
3. Leave cooking on the dark shell; only retune to Garden Plate dark tokens.
4. One paprika fill per view; tab active stays espresso.
5. Push basil onto pantry/success so the app reads **fresh**, not only terracotta.
6. Check contrast: body 4.5:1. If paprika-500 + white is tight on a small label, use paprika-600.
7. If a hex is not in [`COLOR_SCHEMA.md`](./COLOR_SCHEMA.md), stop. Map it to the nearest token.

---

## How to output

- Restyle **Mise**, don’t ship a new brand.
- Pair **light browse + dark cooking** unless asked for one frame.
- Quote tokens (`bg`, `primary`, `accent`), not only hex.
- Call out the single paprika CTA per screen.
- Keep `IOSDevice` for bezel / Dynamic Island / home indicator; **paint the inner column yourself** (cream or night cocoa). Never let the starter’s `#F2F2F7` / `#000` show through.

**Light:** cream paper, butter cards, peach wells, espresso type, olive captions, paprika cook, basil in-stock, honey timers, berry save, espresso active tab.

**Dark (cook):** night cocoa, steamed-milk steps, honey `STEP N`, paprika next, quiet ghosts for Exit/Previous.

That is Mise in Garden Plate. Cooking companion, paper by day, board by night.
