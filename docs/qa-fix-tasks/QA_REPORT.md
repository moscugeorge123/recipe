# Tortie — Manual QA Report

> **Copy kept with the fix tasks.** This is the original report. Corrections found while tracing the code are listed in [README.md](README.md#read-this-first) (F36 affects all titles; F58 is deliberate backend behaviour; F65/F66 were derived from code, not observed). One extra observation: **F79**, the "Welcome, QA" toast was still on screen ~9 minutes after login ([Q09](Q09-toasts.md)). F08/F63 are now verified: 18 icon names are absent from both bundled fonts ([Q14](Q14-icon-glyphs.md)).


**Date:** 2026-10-17 · **Branch:** `feat/firebase-auth` (with the uncommitted working-tree changes)
**Tester:** Claude (autonomous manual pass, no human help)
**Screenshots:** [`qa-report/screenshots/`](screenshots/) (referenced by file name below)

---

## 1. Test setup

| Part | How it was run |
| --- | --- |
| Device | Android emulator **Pixel_6** (1080×2400), dev-client APK `com.tortie.com` built 2026-10-15 |
| JS | Metro on `:8081`, `EXPO_PUBLIC_API_URL=http://localhost:3000/api/v1` via `adb reverse` (the `.env` value is a LAN IP, `192.168.88.28`) |
| API + worker | `npm run dev` / `npm run dev:worker` in `apps/api`, `AUTH_MODE=firebase`, real OpenAI + Apify keys from `.env` |
| DB | Fresh `recipe_api` in Docker Postgres 16, all migrations applied. Mapped to host port **5433**, because 5432 is held by another project's container (`lumen-postgres-1`), which I left alone. |
| Redis | Docker Redis 7 |
| Account | **Test account created in the real Firebase project `tortie-recipe`**: `qa.tortie.test1@example.com` (name "QA Tester"). Delete it from Firebase Auth / Firestore `users/…` if you don't want it. |

**What I did:** clean-install sign-up → onboarding → empty states → import by pasted link → imports **via Android share intent** (`ACTION_SEND text/plain`, same as sharing from Chrome/YouTube) for: a blocked recipe blog, YouTube, BBC Good Food ×2, a non-recipe page (Wikipedia), TikTok, a dead domain, an Instagram reel, a duplicate link, and a share with surrounding text → recipe detail, cook mode end to end, plan, groceries, profile/settings, editor, filters/search, dark mode, sign-out / wrong password / sign-in. Every imported recipe was also compared with what Postgres actually stored (and, where reachable, with the source page).

**Not tested:** Google / Facebook sign-in, iOS, scan-a-page camera, voice commands, timer alarms/notifications, tablet layout, real Instagram/TikTok content (the one Instagram link I used was a made-up shortcode, so it only exercised the failure path), offline mode.

**Environment noise (not app bugs):** the emulator's `system_server` hung once and I had to restart it; the dev-client "gear" button floats over the top-right of every screen.

---

## 2. Summary

| Severity | Theme |
| --- | --- |
| 🔴 High | lost units, wrong step order, missing last word in headings, fake progress, dead settings, auto-filled grocery list |
| 🟠 Medium | share-flow polish, wrong labels/emoji, stale state, misleading errors |
| 🟡 Low | copy, spacing, placeholders, toast overlap |

78 numbered observations (F01–F78, some merged below).

Most-impactful problems first:

1. **Imports lose ingredient units** on the fallback (page-text) path: `¼ Kosher salt`, `2 Ripe avocados` (§3.1).
2. **BBC pancakes import has its steps in the wrong order**: "Rest the batter" comes before "Make the batter", with a 30-min timer on it (§3.2).
3. **The last word of several centered serif headings is silently dropped** ("Your cookbook is", "An open", "This", "A blank", "You're in,") (§3.3).
4. **Import progress is fake**: the UI shows 69 % "Writing the steps" while the job is still at 5 % "acquiring content"; it also shows the previous recipe's counts (§3.4).
5. **Dead settings**: *Default servings* and *Dietary preferences* are saved but never read, and every new account starts as **Vegetarian** (§3.7).
6. **Groceries list fills itself** the moment a meal is planned, contradicting "Choose which ingredients to add" (§3.6).

---

## 3. Findings

IDs are stable (F##). Severity: 🔴 high · 🟠 medium · 🟡 low.

### 3.1 Recipe import quality (data)

#### 🔴 F15 — Ingredient units are lost on the page-text path
Simply Recipes "The best guacamole recipe" (blocked for plain fetch, so it went through the Apify/page-text fallback; `structuredData: null`).

* The LLM returned `quantity: "1/4 teaspoon", unit: null`. The normaliser parsed the number and dropped the unit. Stored rows: `0.25 | (no unit) | Kosher salt`, `1 | Fresh lime juice`, `2 | Minced red onion` (source says **2 to 4 tablespoons**), `1 | Serrano chilis` (source says "1 to 2"), `2 | Cilantro`.
* **Range quantities collapse to the lower bound** ("2 to 4 tablespoons" → `2`, "1 to 2" → `1`).
* The `rawExtraction` JSON still contained correct metric/imperial conversions (`1.25 g`, `0.008 oz`), but the final `metricQuantity`/`metricUnit` columns are null.
* In the UI: `¼ Kosher salt`, `2 Ripe avocados`, `1 Fresh lime or lemon juice`: nothing says teaspoon/tablespoon. Cooking from this list is guesswork.
* Evidence: [`026-detail.png`](screenshots/026-detail.png), [`027-detail-scroll1.png`](screenshots/027-detail-scroll1.png).
* Contrast: BBC Good Food (JSON-LD) and YouTube keep units correctly (`200 g`, `1 tsp`, `250 g`, `1 clove`). So the bug is specific to the fallback path.

#### 🔴 F39 / F69 — Step order wrong on BBC "Easy pancakes"
Stored order: 1 *Rest the batter (30 min)* → 2 *Make the batter* → 3 *Prepare the pan* → 4 *Cook*. The source order is mix, then rest. In cook mode the user would be told to rest a batter that doesn't exist yet, with a 30-min timer on that step. The editor shows the same order ([`086-editor2.png`](screenshots/086-editor2.png)). Probably the "make-ahead" (`ahead`) flag moves the step to the front.

#### 🔴 F25 / F29 — Step text split mid-sentence (guacamole)
Step 1 is stored as title "Cut the avocados" + body "in half. Remove the pit. …" (lower-case start). It appears like that in the Method tab and in cook mode ([`030-method2.png`](screenshots/030-method2.png), [`032-cook-step1.png`](screenshots/032-cook-step1.png)). Step titles shouldn't swallow the first words of the instruction.

#### 🟠 F36 — YouTube title stored fully lower-cased
"5 Minute Delicious Pasta to Save Your Busy Day! Easy and Cheap Pasta Recipe!" → `5 minute delicious pasta to save your busy day! easy and cheap pasta recipe!` The web import keeps case. Looks like a sentence-case pass on a clickbait title, and it leaves the trailing "!". Shown in Cookbook, Plan, Today ([`043-yt-detail.png`](screenshots/043-yt-detail.png), [`070-plan-pick.png`](screenshots/070-plan-pick.png)). The same title is also 4 lines in the grid, so cards have uneven heights.

#### 🟠 F37 — YouTube ingredients lose specifics from the description
The description lists "orecchiette", "cherry tomatoes", "pancetta"/"bacon" and "Robiola". Stored: "Pasta", "Tomatoes", "Bacon", "Fresh soft cheese (robiola)". Servings were assumed to be 2 and calories 600.

#### 🟠 F42 / F44 — Unit "piece" with no quantity
BBC pancakes: `Lemon wedges` and `Caster sugar` (both "to serve") are stored with unit `piece` and null quantity, rendering as **`piece Lemon wedges`**, **`piece Caster sugar`**, and `2 piece Large eggs` ([`047-bbc-ingredients.png`](screenshots/047-bbc-ingredients.png)). Sugar is not counted in pieces. Same in the editor (`No amount · won't scale`).

#### 🟠 F40 — Suspicious servings / calories
Pancakes: servings **12**, **61 kcal**/serving; chocolate cake 14 servings / 523 kcal. Servings value propagates to Today ("Serves 12") and the plan.

#### 🟠 F75 — BBC chocolate cake: ingredient groups flattened
The cake has sponge/buttercream/shards sections. They are merged without headings, giving duplicate-looking rows: `Cocoa powder 2 tbsp` and `Cocoa powder 5 tbsp`; `Milk chocolate` 100 g and 25 g; `Butter` vs `Unsalted butter`. "A pinch of salt" appears in the method but not in the ingredient list (also missing for pancakes). 12 steps, several with generic titles ("Combine ingredients").

#### 🟡 F41 — Method text is rewritten with clumsy conversions
`100g (3.53 oz) plain flour`, `300ml (10.14 fl oz) milk`, `1 tbsp (15 ml)`, `for 1 min (1 min) on each side`, `Bake for 20 minutes (20 mins)`, `every 30 seconds (30 secs)`. False precision (3.53 oz) and duplicated durations. These strings are baked into the text, so the Profile unit toggle can't change them (F65) and servings scaling doesn't touch them (F66).

#### 🟡 F17 — Validation warnings on correct data
`STEP_INGREDIENT_MISMATCH` raised for steps that do have `ingredientRefs`; `Could not parse quantity "Pinch"`.

#### 🟡 F43 — Low-res thumbnail kept
BBC thumbnail URL ends in `?resize=440%2C230`. Used as the 1080-px hero. Slightly soft ([`046-bbc-done.png`](screenshots/046-bbc-done.png)).

#### 🟡 F21 / F38 / F54 — Meal-type tag is a guess and contradicts the UI
Guacamole and pasta are tagged **LUNCH**; pancakes **Breakfast**. Today's hero says **"TONIGHT'S DINNER"** and **"Tonight's focus"** over a recipe badged **Breakfast** (pancakes, nothing planned) or **Lunch** (pasta, planned for dinner) ([`105-home-after-login.png`](screenshots/105-home-after-login.png), [`067-today-scroll1.png`](screenshots/067-today-scroll1.png)).

#### 🟡 F19 — Byline "by Website"
When the source has no author, the UI prints **"by Website"** on detail, Today and Cookbook ([`026-detail.png`](screenshots/026-detail.png), [`067-today-scroll1.png`](screenshots/067-today-scroll1.png)).

#### 🟡 F22 / F59 — Ingredient emoji / aisle wrong
"Red radish or jicama" gets a **chili-pepper** emoji; plain **Pepper** (black pepper) sits in PRODUCE with a chili emoji; Oils are under "Dry goods" ([`027`](screenshots/027-detail-scroll1.png), [`073`](screenshots/073-groceries.png), [`074`](screenshots/074-groc2.png)).

#### 🟠 F74 — Popular sites are not reachable
* `cookieandkate.com`: Apify "status 500" after 16 s → generic failure.
* `simplyrecipes.com`: plain fetch is blocked (`web.fetch blocked by the site`), so it only works through the slow fallback (~45 s) and then hits F15.
* In both cases the share preview shows only the hostname and "Couldn't load a preview. You can still import it." ([`065-dup-t2.png`](screenshots/065-dup-t2.png)).

### 3.2 Import flow and Share-from-another-app

What works: Android share intent opens the Tortie share screen, extracts the URL from surrounding text ("Check out this amazing recipe! https://… so good" → URL only), previews YouTube and BBC well (thumbnail, title, channel, domain), imports, shows "Saved to Cookbook", and "Open recipe" opens it ([`040`](screenshots/040-share-youtube.png), [`042`](screenshots/042-share-done.png), [`046`](screenshots/046-bbc-done.png)). Duplicate links resolve instantly to the existing recipe with no second row ([`065`](screenshots/065-dup-t2.png)). Wrong-link errors are mostly specific. Good.

#### 🔴 F72 / F46 / F45 — Progress UI is not tied to the job
* Instagram job: UI showed **"Writing the steps — 69 %"** while the DB row was `ACQUIRING_CONTENT`, 5 % ([`092-ig-result.png`](screenshots/092-ig-result.png)).
* Wikipedia "Cat": UI animated to 28–34 % "Grabbing the photo — Building your recipe" for a job that failed in ~1 s with `NOT_A_RECIPE` ([`051-wiki-t2.png`](screenshots/051-wiki-t2.png)).
* The skeleton card under the progress shows **"6 ingredients · 5 steps"** copied from the previously imported recipe, for an unrelated link (F45, [`051`](screenshots/051-wiki-t2.png)).
* For YouTube the label "Grabbing the photo" is shown although the thumbnail is already known.

#### 🟠 F34 — Progress row overlaps the preview text
While importing, the "Grabbing the photo 34 %" row is drawn **on top of** the channel name and "youtube.com" ([`041-share-importing.png`](screenshots/041-share-importing.png)). The skeleton hero is a striped placeholder though the thumbnail is already loaded.

#### 🟠 F47 — No pre-check for non-recipe pages
The Wikipedia "Cat" page gets a normal preview and an enabled **Import recipe** button. The backend rejects it (correctly), but only after the user waits ([`049-wiki-result.png`](screenshots/049-wiki-result.png)).

#### 🟠 F50 — TikTok / Instagram advertised, TikTok/Facebook unsupported
* Onboarding slide 1 and the Add sheet's "Works with recipe sites and 📷 ♪ ▶ 📌 f" icons advertise Instagram, **TikTok**, YouTube, Pinterest, **Facebook** ([`013-onb2.png`](screenshots/013-onb2.png), [`021-add-sheet.png`](screenshots/021-add-sheet.png)).
* A shared TikTok link gets a preview titled **"TikTok - Make Your Day"** (the login-wall title) with a *"Import from TikTok"* button. Tapping it fails with `UNSUPPORTED_SOURCE` ([`058`](screenshots/058-share-tiktok3.png), [`059`](screenshots/059-tt-t1.png)).
* Instagram: share preview is just the hostname `instagram.com` (no image/caption). A non-existent reel took **43 s** (retries) to fail, with a doubled message `Post does not exist: Post does not exist` in the job error.

#### 🟠 F52 — Wrong error for a dead domain
A link on a non-existent domain gives the toast **"That link isn't supported yet — try a website, I…"** (it *is* a website; also truncated) and no job is created ([`063-dead-t2.png`](screenshots/063-dead-t2.png)).

#### 🟡 F51 / F46 — Error toasts truncate and overlap the header
"TikTok links aren't supported yet — try a webs…" is cut off on one line and sits on top of the back button ([`059-tt-t1.png`](screenshots/059-tt-t1.png), [`052-wiki-t3.png`](screenshots/052-wiki-t3.png)). Same for "Welcome, QA" over the greeting ([`106-imports.png`](screenshots/106-imports.png)).

#### 🟡 F33 / F37 / F56 — YouTube thumbnails are letter-boxed
`hqdefault.jpg` includes black bars. They show as black bands in the share preview, recipe hero, Cookbook card (time badge sits on black), Plan row and Today hero ([`040`](screenshots/040-share-youtube.png), [`043`](screenshots/043-yt-detail.png), [`070`](screenshots/070-plan-pick.png), [`071`](screenshots/071-after-pick.png)). Use `maxresdefault`/`oar2` or crop.

#### 🟡 F18 / F50 / F52 — Dev placeholder text in production UI
When a thumbnail is missing, the striped placeholder prints mono text: `link · tiktok.com`, `link · instagram.com` ([`058`](screenshots/058-share-tiktok3.png)), and on cards **"photo"** is hidden behind the time chip ("photo · recipe" visible on the detail hero, [`026`](screenshots/026-detail.png), [`031`](screenshots/031-cook1.png), [`067`](screenshots/067-today-scroll1.png)). These look like leftovers from the design mock.

#### 🟡 F53 — Duplicate import isn't explained
A second import of the same URL says "Saved to Cookbook" instantly. It should say "Already in your cookbook".

### 3.3 UI irregularities

#### 🔴 F09 — Last word of centered serif headings is dropped
Reproducible, persistent (checked after 5 s, so not animation):

| Screen | Source text | Rendered |
| --- | --- | --- |
| Cookbook empty hero | "Your cookbook is empty" | "Your cookbook is" |
| Plan empty kicker | "An open week" | "An open" |
| Plan day card | "A blank week" | "A blank" |
| Today "This week" card | "This week" | "This" |
| Success after sign-up/login | "You're in, QA" | "You're in," |

See [`017`](screenshots/017-cookbook-empty.png), [`020`](screenshots/020-cookbook-empty-later.png), [`018`](screenshots/018-plan-empty.png), [`069`](screenshots/069-plan-day.png), [`011`](screenshots/011-home.png)/[`067`](screenshots/067-today-scroll1.png), [`010`](screenshots/010-welcome.png), [`104`](screenshots/104-after-login.png). The affected text is Newsreader serif with negative `letterSpacing` and `textAlign: center` (see `empty-state.tsx`, `first-recipe.tsx`). It looks like Android measures one line and then wraps, clipping the second line. For "You're in," the name *is* known (Today greets "QA"), and the source line is `You’re in, ${first}`, so the name is being clipped, not missing.

#### 🟠 F03 / F02c — Keyboard covers the sign-up/login success screen
The keyboard stays open over "Welcome back. Your recipes, plan and pantry…", hiding the copy and the CTA ([`008-after-signup.png`](screenshots/008-after-signup.png), [`103-loggedin.png`](screenshots/103-loggedin.png)). It needs `Keyboard.dismiss()` before navigating.

#### 🟡 F08 / F63 — Wrong icon glyphs (root cause found)
Icons are Material Symbols by ligature name (`ui/icon.tsx`). Names that aren't in the bundled font render as **plain letters**: `tour` → **"T"** (Profile → *Take the tour*, [`079`](screenshots/079-profile3.png)); `download` → an outlined "D" blob (the *Import a recipe* buttons, [`016`](screenshots/016-today-empty.png)); `cloud_download` → **"C"** (Imports empty state, [`106`](screenshots/106-imports.png)). Audit every `Glyph name=` against the font subset.

#### 🟡 F10 — Plan empty state: cropped "R" on a decorative card ([`018`](screenshots/018-plan-empty.png)).
#### 🟡 F23 — Sticky header is translucent: list text ("6 ingredients") shows through behind the title ([`027`](screenshots/027-detail-scroll1.png), [`047`](screenshots/047-bbc-ingredients.png)).
#### 🟡 F68 — Editor "Total time" stepper: − / + buttons touch the "30 min" text ([`085-editor.png`](screenshots/085-editor.png)).
#### 🟡 F30 — Cook step "You'll need" chips: chips with and without quantities are indented differently ([`034-cook-step3.png`](screenshots/034-cook-step3.png)).
#### 🟡 F77 — Dark mode
`app.json` has `userInterfaceStyle: "automatic"`, but with the device in dark mode the app stays light ([`096`](screenshots/096-dark-cookbook.png), [`097`](screenshots/097-dark-today.png)). Either implement dark theme or set `light`.

#### 🟡 F76 — Search/filter state persists across tabs
Leaving Cookbook and coming back keeps "avocado" + *Vegetarian*, hiding the freshly imported cake/pasta/pancakes; a user can think the import is missing ([`095-cookbook-4.png`](screenshots/095-cookbook-4.png)).
#### 🟡 F70 — "3 recipes · 0 saved": "saved" is ambiguous (favourites?).
#### 🟡 F13 — Plural grammar: "1 recipes" appears right after the first import ([`025-after-import.png`](screenshots/025-after-import.png)).
#### 🟡 F32 — Finishing cook mode returns to the recipe detail with no feedback (no rating, history or "cooked" confirmation); Profile still shows "1 meals cooked" but there's no history screen ([`037`](screenshots/037-after-finish.png), [`todo.md`](../../todo.md)).
#### 🟡 F28 — Cook overview says "portions" where detail says "servings" ([`031`](screenshots/031-cook1.png)).
#### 🟡 F31 — "Buon appetito." is shown for every cuisine ([`036`](screenshots/036-cook-done.png)).
#### 🟡 F04 — "Back to the kitchen" for a brand-new user ([`010`](screenshots/010-welcome.png)).
#### 🟡 F01 — Sign-up step 2: the email pill wraps `.com` onto its own line ([`005`](screenshots/005-after-continue.png)).

### 3.4 Settings that do nothing

#### 🔴 F61 / F62 — Dietary and servings preferences have no effect
* `prefs.defaultServings` ("Default servings — *Recipes open scaled to this*") and `prefs.diet` ("Dietary preferences — *Tortie flags recipes that don't fit*") are only read inside `profile.tsx`. A grep of `apps/mobile/src/tortie` shows nothing else uses them. Recipes open at their own servings (4, 12, 2…) and nothing is flagged.
* **Every new account starts with Vegetarian ON**: hard-coded default `diet: { veg: true }` at `prefs-store.ts:38`, so a brand-new omnivore user's profile says vegetarian ([`077-profile.png`](screenshots/077-profile.png)).

#### 🟠 F65 / F66 / F67 — Unit toggle and scaling are only half applied
* Imperial converts ingredient rows (`3½ oz`, `10 fl oz`) but not the baked-in method text.
* Scaling 12 → 6 servings halves the ingredient rows (`1 piece Large eggs`) but the method still says "2 large eggs, 100g flour" ([`082`](screenshots/082-imperial-pancakes.png), [`083`](screenshots/083-scaled6.png)).
* The **editor shows ingredients converted to the user's imperial preference** (`3½ oz Plain flour`, [`085`](screenshots/085-editor.png)); saving may overwrite the stored metric source values.

#### 🟡 F64 — Profile is missing standard items
No cooking history (still a stub per `todo.md`), no Terms/Privacy/About/version rows inside the app, no support link. Voice commands is ON by default with no permission prompt shown.

### 3.5 Account / sign-in

Good: wrong password gives a clear message ([`102`](screenshots/102-wrong-pass.png)); data survives sign-out → sign-in; two users exist server-side (default user + QA).

* 🟠 F78 — After tapping **Sign out**, the Profile screen showed a blank body under the "QA Tester" header (screenshot not kept) before the emulator hung. Unclear if related; worth a manual check on a real device.
* 🟡 After re-login, **Imports says "No imports yet"** ([`106`](screenshots/106-imports.png)) though 10 import jobs exist on the server for this user. The ledger is a local store cleared on sign-out and never re-hydrated from the API.
* 🟡 `apps/mobile/.env` points the API at a LAN IP (`192.168.88.28`), which breaks on any other network; this is fine for dev but easy to forget.

### 3.6 Plan & Groceries

#### 🔴 F58 — Shopping list fills itself from the plan
Planning two meals (pasta dinner, pancakes breakfast) produced a **16-item shopping list** and a red "10 → 16" badge on the Groceries tab, before touching *Add week to groceries*. The Plan card says "**Choose which ingredients to add**", and the recipe menu says "Everything's already on your list" ([`071`](screenshots/071-after-pick.png), [`073`](screenshots/073-groceries.png), [`084`](screenshots/084-menu.png)). Either the copy or the behaviour is wrong.

#### 🟡 F57 — The badge appears immediately after planning, with no explanation.
#### 🟡 F59 — Items without an amount just show "From your plan" ("Pepper", "Salt", "Olive oil"); "Lemon wedges" became "Lemon wedge".

### 3.7 Developer-visible errors (Metro log)

* **F06** — `ERROR [["recipes","detail",""]]: No queryFn was passed…` repeated many times: a recipe-detail query is mounted with an **empty id** (probably on Today/Plan before data resolves). It spams the log and fires needless work.
* **F07** — `[Reanimated] Writing to value during component render` repeats constantly; a shared value is written during render somewhere in the shared UI.

### 3.8 Things that worked well
* Clean sign-up → onboarding (4 slides) → empty states for every tab.
* Cook mode: step navigation, progress bar, finish; overview/ingredient chips.
* Share intent: URL extraction from free text; duplicate handling; good preview for YouTube/BBC; specific error for `NOT_A_RECIPE`, `UNSUPPORTED_SOURCE`.
* Cookbook search by ingredient and the *Vegetarian* filter (correctly excluded the bacon pasta).
* Plan → pick from Cookbook flow ("Tap a recipe for Saturday dinner" banner).
* Imperial conversion of ingredient rows.

---

## 4. Suggested fix order

1. **F15 + F39 + F25**: preserve units/ranges on the fallback path; don't reorder steps for `ahead`; stop moving words from the instruction into the title. These break the core promise (a recipe you can cook).
2. **F09** headings: fix the Android text clipping (probably remove negative `letterSpacing` / add `lineHeight` on centered serif text) — 5 screens affected.
3. **F72/F45/F46**: bind progress to the real job `status`/`progress`; reset skeleton counts between imports.
4. **F61/F62**: either wire `defaultServings`/`diet` into recipes or hide the settings; remove the `veg: true` default.
5. **F58** groceries copy vs behaviour; **F50** stop advertising TikTok/Facebook (or disable the CTA); **F52** fix the dead-domain error text.
6. Polish: icon names (F08/F63), YouTube letterbox thumbnails, "by Website", placeholder mono text, toast placement/truncation, keyboard on the success screen, dark mode decision.

## 5. Housekeeping notes
* `apps/api/.env` holds live credentials (Apify token, Firebase service-account JSON, OpenAI key). It is gitignored, but I printed part of it into this session's terminal while inspecting the config; **consider rotating those keys**.
* The test Firebase user, and the data in the local Docker volume (`recipe_postgres_data`), are left in place. Port 5433 is used for the Postgres container; the repo default (5432) was occupied by another project.
* Nothing in the source tree was modified; the only addition is this `qa-report/` folder.
