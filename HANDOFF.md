# Coffee Table: handoff

v0.1.0 · 6 November 2026

## What it is

A personal PWA that gets Jam to open the coffee table books that never get looked at. Pick a book, or tap Surprise me, and it shows a page number picked uniformly at random between the book's first and last content pages. "Coffee Table" is a working name, to be changed before the repo is created (see Renaming in CLAUDE.md).

## State

v0.1 is built and checked on this Mac. It isn't committed or deployed yet. Everything in BRIEF.md's v0.1 scope is in:

- **Shelf:** a grid of covers, sorted by title. Books without a cover get a plain title card. Surprise me sits at the bottom and the version under the grid.
- **Add by title:** searches Google Books first, then Open Library. Each match shows its cover, author, year and page count.
- **Details form:** one form for after picking a match, for adding by hand (with a cover from the camera or photo library, shrunk to 600px JPEG) and for editing. Delete asks to confirm first.
- **Random page:** a large page number with an Again button.
- **Offline:** in flight mode the app still opens and rolls pages. Searched covers may not show.

Storage is IndexedDB, chosen over localStorage because photos would fill localStorage's roughly 5 MB within a few dozen books.

## Before first use

1. Rename, if you want to (CLAUDE.md, Renaming).
2. Create the GitHub repo, push, and turn on Pages (from the root of `main`).
3. On the iPhone, open the Pages link in Safari, tap Share, then Add to Home Screen, and open the app from the icon.
4. Add books from the installed app. The Home Screen app keeps its own storage, separate from Safari, so books added in a Safari tab won't show up in it.

## Google Books key

Google Books without a key answers "quota exceeded" to every request, because Google's shared allowance for keyless use is set to 0 a day (checked 6 November 2026). Until a key is in, every search comes from Open Library, and the app says why.

To turn Google on:

1. In the Google Cloud console, open APIs & Services and enable the Books API.
2. Under Credentials, create an API key.
3. Set the application restriction to Websites and add `https://jamien-liston.github.io/*`.
4. Set the API restriction to the Books API.
5. Paste the key into `js/config.js` and bump the version.

GitHub may warn about the key on push. That's expected for a restricted browser key.

Once the key is in, check three things:

- Search results say they're from Google Books.
- The covers look right. The app asks Google for 575px covers (`zoom=3`); if some show "image not available", lower `GOOGLE_COVER_ZOOM` in `js/logic.js` to 2.
- Searches find the books you'd expect. The query requires every title word in the title and every author word in the author.

## Checks at v0.1.0

- `node --check` passes on every JS file.
- `node test/logic.test.js` passes. It covers:
  - a 10–12 range rolled 100,000 times: only 10, 11 and 12, each about a third of the time
  - Surprise me landing on every book about equally
  - the form checks
  - tidying of Google and Open Library results
  - the cover allowlist
  - routes
- End-to-end in headless Chrome at iPhone size: 48/48 passing. This was a throwaway script in the session scratchpad, not in the repo. It covered:
  - the search fallback, and the form filled from a match
  - the 10–12 range on screen
  - photos shrunk and kept upright
  - return in a field moving to the next one
  - edit, remove cover and delete
  - books surviving a reload
  - flight mode
  - a new version reloading only from the shelf
- Accessibility:
  - all text is at least 5.3:1 contrast in light mode and 6.3:1 in dark
  - field borders and the focus ring are at least 3:1
  - every tap target is at least 44px
- Security pass: nothing to fix. There are no HTML injection points, no secrets, no outside scripts, and a Content-Security-Policy is set.

## Phone test list

1. Open the app from the Home Screen icon and check that v0.1.0 shows at the bottom of the shelf.
2. Add three books by typing their titles. Covers should show wherever the APIs have them.
3. Add one book by hand with a photo. A portrait photo should come out upright.
4. Set a book's first page to 10 and last page to 12, then tap Again about 20 times. Only 10, 11 and 12 should come up.
5. Tap Surprise me from the shelf a handful of times. It should land on different books.
6. Edit every field and save, then delete a book.
7. Swipe the app away and reopen it. The books should still be there.
8. Turn on flight mode and reopen the app. The shelf and random page should work; searched books may show title cards instead of covers.

## Known limits

- Searched covers are links to Google or Open Library, so they can go missing offline (the brief allows this). Photos taken in the app are stored in it and always show.
- Open Library results are works, not editions. The year is the first publication and the page count is the median across editions, so treat both as hints.
- Google's default 128px thumbnails can come back sideways for landscape books, which is why the app asks for the larger sizes everywhere.
- The books live only on the phone. Removing the app from the Home Screen deletes them.

## Next

1. Jam: rename, create the repo, push, install, and run the phone test list.
2. Add the Google Books key and check Google's results and covers.

## Backlog

- v0.2, parked in BRIEF.md: read a photo of the cover or ISBN with Claude, through a Cloudflare Worker.
- Maybe store searched covers so they also show offline.
- Maybe export and import a backup of the shelf, since the books live only on the phone.
- Mirage's service worker deletes every cache on the shared github.io origin except its own, so in a shared browser it can wipe this app's offline copy. This app refills its copy, but the fix belongs in Mirage: limit its deletions to its own prefix. Avoid the same pattern in bin-night's planned service worker.
- Maybe commit the headless-Chrome end-to-end test as `test/smoke.mjs`, for one-command regression checks.
