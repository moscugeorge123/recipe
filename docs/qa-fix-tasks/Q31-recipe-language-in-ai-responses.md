# Q31. The recipe language must apply to every AI response in the app

🟠 Medium · API + mobile · Finding **F88**

## Problem

The **Recipe language** setting should decide the language of everything the AI writes for the user, wherever it is triggered. Today only recipe imports use it.

## Evidence

Reported by the product owner. Code review below.

## Root cause (verified in code)

| AI feature | Gets the language? |
| --- | --- |
| Import (`POST /recipes/extract`) | Yes. `features/extraction/api.ts` sends `outputLanguage` from the recipe-language preference. **But** `importLanguage()` maps `'original'` to `'en'`, so the default setting ("As saved") forces English output even for a Romanian source. |
| Ask Tortie / edit with AI (`POST /recipes/assist`) | **No.** `assistRecipeBodySchema` (`recipe-assist.routes.ts`, `.strict()`) has no language field, and `recipe-assistant.ts` never mentions one. Replies and edits come back in whatever language the prompt or model picks. |
| Recipe translation (`POST /recipes/:id/translate`) | Yes, by target language. |
| Pantry/grocery text parsing (`POST /pantry/organize`) | The body accepts `locale`, but no mobile caller sends it (`features/pantry/api.ts`, `tortie/data/groceries.ts`). |
| Scan a page (OCR/vision) | Not checked: confirm whether it receives `outputLanguage`. |
| Server-written error messages (`RECIPE_ASSIST_REJECTED`, validation) | English only. |

## Fix

1. One source of truth on the API: a `languageContext` resolved per request from an `X-Recipe-Language` header (and `X-App-Language` for interface text), set once in `services/api-client.ts` from the prefs. Individual routes may still override it in the body.
2. `recipe-assistant.ts`: add "Write `message`, step titles, step text and ingredient names in {language}" to the prompt; edits to an existing recipe keep that recipe's current language unless the user asked to translate. Return `message` in the **app** language (it is chat text), recipe fields in the **recipe** language.
3. `importLanguage()`: `'original'` must mean "do not translate" (omit `outputLanguage` so the pipeline keeps the source language), not English. Confirm with the owner what "As saved" should do for sources that are not English.
4. Pass `locale` to `/pantry/organize` and scan/OCR calls.
5. Error codes instead of English text for user-facing server errors, mapped to app-language keys ([Q30](Q30-app-translation-coverage.md)).
6. Add the language to the `ai-usage` log so the dashboard can break spend down by language (optional).

## Acceptance criteria

- Recipe language Română: an Ask Tortie request in English ("make it spicier") returns a Română `message` (if the app language is Română) and Română recipe text.
- Importing an English web recipe with Recipe language Română returns Română steps and ingredients; "As saved" keeps the source language.
- Grocery text like "2 lămâi, 1kg făină" is organised correctly regardless of the app language.
- Every AI call site in the audit list sends the language; a test fails when a new call site does not.

## Tests

- Vitest: assistant prompt contains the language rule; `/recipes/assist` accepts and forwards the header.
- Jest: `api-client` adds the headers; `importLanguage()` for `original` / `ro`.
- Manual: Ask Tortie in `ro` and `en`; import one English and one Romanian link.
