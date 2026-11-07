# Coffee Table: handoff

v0.1.4 · 7 November 2026

## What it is

A personal PWA that gets Jam to open the coffee table books that never get looked at. Pick a book, or tap Surprise me, and it shows a page number picked uniformly at random between the book's first and last content pages. The repo is `Jamien-Liston/coffee-table`, live at https://jamien-liston.github.io/coffee-table/.

## State

v0.1.3 is live, and Google Books search works on Jam's phone. v0.1.4 is built and checked on this Mac, but not committed or deployed.

In the app since v0.1.0:

- **Shelf:** a grid of covers, sorted by title. Books without a cover get a plain title card. Surprise me sits at the bottom and the version under the grid.
- **Add by title:** searches Google Books first, then Open Library. Each match shows its cover, author, year and page count.
- **Details form:** one form for after picking a match, for adding by hand (with a cover from the camera or photo library, shrunk to 600px JPEG) and for editing. Delete asks to confirm first.
- **Random page:** a large page number with an Again button.
- **Offline:** in flight mode the app still opens and rolls pages. Searched covers may not show.

Since v0.1.2:

- **Page fields select their number** on focus, so typing replaces it.
  - This works for a tap, Return, the arrows above the keyboard, or tapping the label.
  - A second tap inside the active field places the caret as usual.
  - On iPhone, Safari puts the caret where the finger landed just after focus, so the app selects again when the tap lifts, and once more after that.
- **Title tidy:** leaving the title field on the details form tidies the title into title case, once per new book.
  - Small words stay lowercase unless they're first, last or straight after a colon: a, an, and, as, at, but, by, for, in, nor, of, on, or, the, to. Jam confirmed this list on 7 November. Longer words such as with and from are capitalised.
  - A word with a capital after its first letter is left alone (MoMA, iPhone, UK), and so is one that starts with a digit.
  - Each part of a hyphenated word counts as a word: Mid-Century.
  - Only first letters ever change, and after the one tidy, Jam's changes stay.
  - Add by hand brings the search title over already tidied, and that counts as its one tidy.
  - Edit never tidies, because a saved title is already Jam's version. Jam confirmed this on 7 November.
- **Hyphen retry:** a title with a hyphen inside a word that finds nothing is searched again without those hyphens, in each service, before the app moves on. The author is never changed.

Since v0.1.3:

- **Covers fall back to a size Google really has.** Every cover steps down a size when Google returns a stand-in picture or the image fails to load. That covers search results, the details form, the shelf and the random page.
  - Covers try zoom 3, 2, then 1. Search thumbnails try zoom 2, then 1.
  - A cover stays hidden while it's trying, so the placeholder never flashes up.
  - The details form saves the link that showed.
  - Books saved earlier with a placeholder link show the real cover anyway. Edit, then Save changes, stores the working link.
  - If every size fails (offline, say), the shelf shows the title card, and the saved link is kept.
- **Page count from the book's own Google record.** When a Google match's search listing has no page count, the details form opens straight away and asks Google for that volume's own record.
  - If the record has a page count, Page count and Last page fill in, with the "guess" hint.
  - The app only fills a field that's still empty and that you're not typing in.
  - If the request fails, both stay blank, as before.
  - Example: A House in Japan is 0 pages in the listing and 272 in its record.
  - The match's Google ID is used only for this request and isn't stored.

New in v0.1.4:

- **The cover check knows all of Google's stand-ins.** It used to know only "image not available". On v0.1.3, Mid-century Modern Furniture (Dominic Bradbury) showed its real cover in the list but a blank grey cover on the details form. Now the check covers:
  - Google's blank book cover
  - strips cut from scanned pages
  - anything more than three times wider than tall
  - See Google covers below.

Storage is IndexedDB, chosen over localStorage because photos would fill localStorage's roughly 5 MB within a few dozen books.

## Google Books

The key is in `js/config.js`, restricted to websites `https://jamien-liston.github.io/*` and to the Books API. GitHub may warn about it on push. That's expected for a restricted browser key.

No results on 7 November turned out to be the phone still running v0.1.0. It had no key, and without a key Google answers 429 "quota exceeded". The checks behind that:

- The live key worked with `Referer: https://jamien-liston.github.io/`. Google also accepts the `Origin` header on its own.
- Nothing in the app or on GitHub Pages sets a referrer policy.
- The live v0.1.1 got Google results in headless Chrome.

Jam confirmed Google results on the phone the same day.

Searches should find the books you'd expect. The query requires every title word in the title and every author word in the author.

## Google covers (checked 7 November 2026)

Google answers a cover size it hasn't got with a stand-in picture. It comes back as HTTP 200, not an error, so before v0.1.3 the app showed it as the cover. A scan of 94 photo-book volumes found three kinds, each always at fixed sizes:

| Stand-in | Sizes | Volumes |
|---|---|---|
| Grey "image not available" text: the same file for every book | 300×391 (zoom 2), 575×750 (zoom 3), 800×1043 (zoom 4), 1280×1670 (zoom 6) | 46 |
| A blank grey-blue book cover with hatched bars: the same file for every book | 575×829 (zoom 3), 800×1153 (zoom 4) | 11 |
| A strip cut from a scanned page, different for every book | 300×48 (zoom 2), 575×92 (zoom 3), 800×128 (zoom 4) | 20 |

- **The scan:**
  - 28 of the 94 have real covers at zoom 3. The other 66 have one only at zoom 1.
  - Zoom 1 was real for all 94.
  - The strips aren't only old library scans. Phaidon's *The History of English Interiors* strip just reads "ENGLISH".
- **A House in Japan** (Gestalten, `Gat80QEACAAJ`, ISBN 9783967042078):
  - Only zoom 1, at 128×160, is real. Zoom 2 and up are "image not available".
  - books.google.com shows the same zoom 1 image.
  - Open Library has no cover for the ISBN.
- **Mid-century Modern Furniture** (Dominic Bradbury, `9s-NEAAAQBAJ`):
  - Only zoom 1, at 128×155, is real. Zoom 2 is "image not available", and zoom 3 and 4 are the blank cover.
  - v0.1.3 didn't know the blank cover, so the details form, which starts at zoom 3, accepted it. The list thumbnail starts at zoom 2, so it stepped down to the real image.
  - "Mid-century" finds nothing, and the hyphen retry finds the book. It's 0 pages in the listing and 192 in its record.
- **The volume's own record doesn't help with covers.**
  - Its links use `/books/publisher/content` with an `imgtk` token, not `/books/content`.
  - They serve exactly the same images at every size, with or without the token.
  - Neither does Google's publisher-cover link, `/books/publisher/content/images/frontcover/<id>`.
  - The app only asks the record for page counts.
- **How the app spots a stand-in** (`Logic.isGooglePlaceholder`): by the loaded image's exact width and height, or by its being more than three times wider than tall.
  - File type is no help. A real cover can be a PNG, and the blank cover is a JPEG.
  - Google sends no CORS headers on images, so the app can't inspect pixels.
  - Zoom 1 is always accepted. Google only gives a cover link when a real image exists, and its small no-cover picture is 128×170, a size real covers can have.
- **If a stand-in gets through,** say because Google adds a new one, open the cover's link at that zoom to find its size, and add the size to `GOOGLE_PLACEHOLDER_SIZES` in `js/logic.js`.

## Checks at v0.1.4

- `node --check` passes on every JS file.
- `node test/logic.test.js`: 27 tests pass. Since v0.1.2 they also cover:
  - which cover sizes are tried
  - all three kinds of stand-in, plus real covers that must not count, including a landscape one and a 3:1 one
  - the volume record link and its page count
  - keeping Google's volume ID
- Replaying the check over the 94 scanned volumes: none would show a stand-in.
- End-to-end in headless Chrome at iPhone size. These were throwaway scripts in the session scratchpad, not in the repo.
  - Against a fake Google serving the real downloaded images: 30/30. The one run of v0.1.3's 25 checks that crashed did so while the test browser was starting, before any check ran. The checks covered:
    - A House in Japan: search thumbnails, the preview and the saved link
    - Bradbury's blank cover, skipped in the list and on the form
    - a snippet book's strips
    - Humans of New York keeping zoom 3
    - books saved earlier on the shelf, the random page and Edit
    - a cover that fails at every size
    - no stand-in ever showing
    - the late page count against a field you're in, a page you've typed, leaving early, a failed request, and picking the same match again
  - v0.1.2's 31 checks still pass.
  - Live, against the real Google API and real images, with Jam's github.io Referer added to API requests as the key requires:
    - Bradbury, searched as "Mid-century Modern Furniture" by Dominic Bradbury: the committed v0.1.3 reproduced the bug, with the form cover at zoom 3, 575×829.
    - On v0.1.4 the form shows the real zoom 1, 128×155, and 192 pages.
    - The A House in Japan and Humans of New York run: 8/8.
- **Not tested on iPhone Safari.** This Mac has no Xcode and Safari's remote automation is off. The phone test below is the real check.
- Security pass: nothing to fix. v0.1.4 only adds sizes and one shape rule to the stand-in check. The volume ID is checked against Google's ID pattern and encoded before it goes in a link, and every cover link still passes through `Logic.safeCover`.

## Phone test for v0.1.4

1. Open the app from the Home Screen icon and check that v0.1.4 shows at the bottom of the shelf. If it shows an older version, stay on the shelf for a few seconds, or swipe the app away and reopen it.
2. Search for Mid-century Modern Furniture by Dominic Bradbury and tap the match. The form should show the real cover, not a blank grey one. Page count and Last page should fill in with 192.
3. If it's already on your shelf with the blank cover, it should now show the real one. Open Edit and tap Save changes once to store the working link.
4. A House in Japan should still show its real cover in the list and on the form, with 272 pages.
5. Search for Humans of New York. The covers should look as sharp as before.

If not yet done, these v0.1.2 checks still stand:

- In a page field, tapping selects the number and typing replaces it.
- Title tidy: "the art of the plant: a guide" should become "The Art of the Plant: A Guide" when you leave the field.
- Searching "Mid-century houses today" should find Midcentury Houses Today.

The v0.1 checks still stand: the 10–12 range, Surprise me, edit and delete, books surviving a restart, and flight mode.

## Known limits

- Searched covers are links to Google or Open Library, so they can go missing offline (the brief allows this). Photos taken in the app are stored in it and always show.
- Books with only Google's small image, like A House in Japan and Mid-century Modern Furniture, look soft on the shelf. 128 pixels wide is all Google has.
- Google's 128px images can come back sideways for landscape books, so the app now uses that size only when Google has nothing bigger.
- A real cover that happens to be exactly one of the stand-in sizes, or more than three times wider than tall, drops one size. It's still the real cover, just smaller.
- Open Library results are works, not editions. The year is the first publication and the page count is the median across editions, so treat both as hints.
- The books live only on the phone. Removing the app from the Home Screen deletes them. The Home Screen app keeps its own storage, separate from Safari.
- The title tidy follows its rules literally. "From A to Z" becomes "From a to Z", because a capital A reads as the word "a". "o'keeffe" becomes "O'keeffe", and an all-capitals title stays as it is. One fix by hand sticks.
- Titles from a picked match are tidied only if you tap into the title and leave it.

## Next

1. Jam: commit and push v0.1.4, then run the phone test above.
2. Then v0.2, per BRIEF.md.

## Backlog

- v0.3, parked in BRIEF.md: read a photo of the cover or ISBN with Claude, through the v0.2 Worker. That photo would also make a sharper cover for print-only books.
- Maybe store searched covers so they also show offline.
- Maybe export and import a backup of the shelf, since the books live only on the phone.
- Mirage's service worker deletes every cache on the shared github.io origin except its own, so in a shared browser it can wipe this app's offline copy. This app refills its copy, but the fix belongs in Mirage: limit its deletions to its own prefix. Avoid the same pattern in bin-night's planned service worker.
- Maybe commit the headless-Chrome end-to-end tests as `test/smoke.mjs`, for one-command regression checks.
- To let Claude check iPhone-specific behaviour, either install Xcode (for the iOS Simulator), or turn on Safari Settings → Developer → Allow remote automation. The second gives Mac Safari: the same engine, but with a mouse, not touch.
