# Coffee Table: handoff

v0.1.2 · 7 November 2026

## What it is

A personal PWA that gets Jam to open the coffee table books that never get looked at. Pick a book, or tap Surprise me, and it shows a page number picked uniformly at random between the book's first and last content pages. The repo is `Jamien-Liston/coffee-table`, live at https://jamien-liston.github.io/coffee-table/.

## State

v0.1.1 is live: v0.1.0 plus the Google Books key. v0.1.2 is built and checked on this Mac, but not committed or deployed.

In the app since v0.1.0:

- **Shelf:** a grid of covers, sorted by title. Books without a cover get a plain title card. Surprise me sits at the bottom and the version under the grid.
- **Add by title:** searches Google Books first, then Open Library. Each match shows its cover, author, year and page count.
- **Details form:** one form for after picking a match, for adding by hand (with a cover from the camera or photo library, shrunk to 600px JPEG) and for editing. Delete asks to confirm first.
- **Random page:** a large page number with an Again button.
- **Offline:** in flight mode the app still opens and rolls pages. Searched covers may not show.

New in v0.1.2:

- **Page fields select their number.** Tapping into Page count, First page or Last page selects the whole number, so typing replaces it. The same happens when you move in with Return, with the arrows above the keyboard, or by tapping the label. A second tap inside the active field places the caret as usual. On iPhone, Safari puts the caret where the finger landed just after the field gets focus, so the app selects again when the tap lifts, and once more after that.
- **Title tidy.** Leaving the title field on the details form tidies the title into title case, once per new book:
  - Small words stay lowercase unless they're first, last or straight after a colon: a, an, and, as, at, but, by, for, in, nor, of, on, or, the, to.
  - A word with a capital after its first letter is left alone (MoMA, iPhone, UK), and so is one that starts with a digit (21st).
  - Each part of a hyphenated word counts as a word: Mid-Century, Step-by-Step, A-Z.
  - Only first letters ever change.
  - After the one tidy, Jam's changes stay.
  - Add by hand brings the search title over already tidied, and that counts as its one tidy.
  - Edit never tidies, because a saved title is already Jam's version.
- **Hyphen retry.** If a title with a hyphen inside a word finds nothing, each service is searched again with those hyphens taken out before the app moves on: Google, Google without hyphens, Open Library, then Open Library without hyphens. "Not it? Try Open Library" does the same. The author is never changed. On 7 November, "Mid-century houses today" found nothing in either service, and "Midcentury houses today" found the book in both.

Storage is IndexedDB, chosen over localStorage because photos would fill localStorage's roughly 5 MB within a few dozen books.

## Google Books

The key is in `js/config.js`, restricted to websites `https://jamien-liston.github.io/*` and to the Books API. GitHub may warn about it on push. That's expected for a restricted browser key.

Jam reported Google Books giving no results in the app. Checked on 7 November 2026:

- The live `js/config.js` on github.io has the key and matches the repo.
- curl with `Referer: https://jamien-liston.github.io/` gets results. With no Referer, Google answers 403 "Requests from referer <empty> are blocked", so the restriction works. Google also accepts the `Origin` header on its own, and every cross-site fetch sends it.
- Nothing in the app sets a referrer policy, GitHub Pages sends no `Referrer-Policy` header, and the search fetch uses the browser's default.
- The live v0.1.1 in headless Chrome sends `Referer: https://jamien-liston.github.io/` and shows "9 matches from Google Books" for Humans of New York.
- Without a key, as in v0.1.0, Google answers 429 "quota exceeded". The app then says "… from Open Library, because Google Books is over its daily limit."

Likely cause: the phone was still running v0.1.0 when it searched. A new version installs in the background and reloads the app only from the shelf, so a search made before that reload uses the old files. Two things rule out a stuck update. Safari has checked `importScripts` files such as `version.js` for changes since 2022 (WebKit bug 239657, iOS 16). And every file the service worker needs is live.

Not yet confirmed on the phone. After a search, the line above the matches names the source and, if Google wasn't used, the reason.

Once Google answers on the phone, two more checks:

- The covers look right. The app asks Google for 575px covers (`zoom=3`). If some show "image not available", lower `GOOGLE_COVER_ZOOM` in `js/logic.js` to 2.
- Searches find the books you'd expect. The query requires every title word in the title and every author word in the author.

## Checks at v0.1.2

- `node --check` passes on every JS file.
- `node test/logic.test.js`: 24 tests pass. On top of v0.1.0's they cover:
  - the title tidy: small words, first, last and after a colon, words left alone, hyphenated words, numbers and punctuation
  - which titles get a hyphen-free retry
- End-to-end in headless Chrome at iPhone size, with touch taps and canned Google and Open Library replies: 31/31 passing. This was a throwaway script in the session scratchpad, not in the repo. It covered:
  - every retry path: Google's retry finding the book, Google refusing, a retry that errors, nothing anywhere, no retry without a hyphen, and Not it? Try Open Library
  - the title tidy: by hand, after a change, Add by hand, a picked match, an empty title, Save straight from the title, and Edit
  - page fields: taps at different spots, typing over, Return from field to field, the label, and a mouse click
  - no errors in the page
- **Not tested on iPhone Safari.** This Mac has no Xcode, so no iOS Simulator, and Safari's remote automation is off. Chrome also passes a naive version that only selects on focus, so it can't vouch for the iPhone handling. The phone test below is the real check.
- Security pass: nothing to fix. Titles still go on the page as text only, there are no new hosts, and the Content-Security-Policy is unchanged.

## Phone test for v0.1.2

1. Open the app from the Home Screen icon and check that v0.1.2 shows at the bottom of the shelf. If it shows an older version, stay on the shelf for a few seconds, or swipe the app away and reopen it.
2. **Google:** search for Humans of New York. The line above the matches should say they're from Google Books. If not, note the line's exact wording.
3. **Page fields:** on Add a book, clear the Title box and tap Add by hand. Type 304 in Page count and 296 in Last page, then tap Done.
   - Tap First page. The 1 should be highlighted, and typing 9 should replace it.
   - Tap Last page near its left end, then Page count in the middle, then Last page near its right end. The whole number should be highlighted each time.
   - Tap again inside the highlighted field. The caret should go where you tapped.
   - Tap Author, then the keyboard's Next. Page count should come up highlighted, then First page and Last page as you keep tapping Next.
4. **Title:**
   - On the same form, type "the art of the plant: a guide" in Title and tap Next. It should become "The Art of the Plant: A Guide".
   - Change it to "the ART of plants" and leave the field. It should stay as typed.
   - Go back to Add a book, type "humans of new york" and tap Add by hand. The title should arrive as "Humans of New York".
   - Edit a saved book, change its title to all lowercase and leave the field. It should stay lowercase. Tap Back so nothing is saved.
5. **Search:** search for "Mid-century houses today". The matches should include Midcentury Houses Today.

The v0.1 checks still stand: the 10–12 range, Surprise me, edit and delete, books surviving a restart, and flight mode.

## Known limits

- Searched covers are links to Google or Open Library, so they can go missing offline (the brief allows this). Photos taken in the app are stored in it and always show.
- Open Library results are works, not editions. The year is the first publication and the page count is the median across editions, so treat both as hints.
- Google's default 128px thumbnails can come back sideways for landscape books, which is why the app asks for the larger sizes everywhere.
- The books live only on the phone. Removing the app from the Home Screen deletes them. The Home Screen app keeps its own storage, separate from Safari.
- The title tidy follows its rules literally. "From A to Z" becomes "From a to Z", because a capital A reads as the word "a". "o'keeffe" becomes "O'keeffe", and an all-capitals title stays as it is. One fix by hand sticks.
- Titles from a picked match are tidied only if you tap into the title and leave it.

## Next

1. Jam: commit and push v0.1.2, then run the phone test above.
2. Confirm Google Books results on the phone, or send the line above the matches.
3. Jam to decide:
   - Should Edit tidy titles too?
   - Is the small-word list right? It goes beyond the brief's examples with as, at, but, by, nor and or. Words of four or more letters, such as with and from, are capitalised.
4. Then v0.2, per BRIEF.md.

## Backlog

- v0.3, parked in BRIEF.md: read a photo of the cover or ISBN with Claude, through the v0.2 Worker.
- Maybe store searched covers so they also show offline.
- Maybe export and import a backup of the shelf, since the books live only on the phone.
- Mirage's service worker deletes every cache on the shared github.io origin except its own, so in a shared browser it can wipe this app's offline copy. This app refills its copy, but the fix belongs in Mirage: limit its deletions to its own prefix. Avoid the same pattern in bin-night's planned service worker.
- Maybe commit the headless-Chrome end-to-end test as `test/smoke.mjs`, for one-command regression checks.
- To let Claude check iPhone-specific behaviour, either install Xcode (for the iOS Simulator), or turn on Safari Settings → Developer → Allow remote automation. The second gives Mac Safari: the same engine, but with a mouse, not touch.
