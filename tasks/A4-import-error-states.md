# A4. Import error states and error toast

Group A: Import experience

## Design source
- Spec: [DESIGN.md](DESIGN.md), Group A › A4. Import error states and error toast. Read it first. It is the design this task implements.
- Prototype: `Tortie App v2.dc.html`, screen: "Import error" (also the failed rows in "Imports"). Search the file for `data-screen-label="..."`.

## Design (`data-screen-label="Import error"`)
- Five error groups, each with an icon, a message, a sub-line, and a primary and secondary action:
  - **Not a recipe** (`no_meals`): "That link doesn't look like a food recipe". Actions: Try another link, Write it yourself.
  - **Unsupported source** (`link_off`): "TikTok links aren't supported yet…". Actions: Try another link, Scan a page.
  - **Couldn't open** (`public_off`): "Couldn't open that link — check it and try again". Actions: Try again, Edit link.
  - **Rate limited** (`hourglass_top`, amber): "That source is busy…". Try again is locked with a **15 s countdown**. Actions: Try again in Ns, Edit link.
  - **Generic** (`sentiment_dissatisfied`): "Couldn't read a recipe from that link". Actions: Try again, Write it yourself.
- Backend error codes map to the groups: `NOT_A_RECIPE`, `UNSUPPORTED_SOURCE`, `INVALID_URL`, `CONTENT_ACQUISITION_FAILED`, `TOO_MANY_REQUESTS`, `PROVIDER_RATE_LIMITED`, and anything else maps to the generic group.
- **Error toast variant:** red `error` icon, shown for 3.8 s instead of 2.4 s.
- The same error rows appear in Imports history ([A3](A3-imports-history-screen.md)).

## Repo
- `lib/user-error.ts` already maps API error codes to user copy.
- `tortie/ui/toast.tsx` has no error variant.
- No error screen inside the Add sheet.

## Enrich later
- Reuse `user-error.ts` copy, or adopt the design's copy.
- Retry-after from the server, instead of a fixed 15 s.
- TikTok and Facebook providers are still stubs on the API.
