# coffee-table: Claude Code brief

v0.1 is built and live (v0.1.0). Build v0.2 next; v0.3 stays parked.

## What it is

A personal PWA that gets me to open the coffee table books I never look at. I pick a book, or let the app pick one, and it gives me a random page within the book's actual content. I turn to it.

One user (me), one phone. No accounts, no sharing.

## Why random

Opening a book by hand skews towards the middle and towards wherever the spine already falls open, so the front and back rarely get seen. The app's core job is a uniformly random page between the first and last content pages, skipping front matter and back matter.

## v0.1 scope

**Add a book by title.** I type a title (author optional). Search Google Books; if that returns nothing useful, try Open Library. Show matches with cover, author, year and page count so I can pick the right edition. Save title, author, cover URL and page count.

**Set the content range.** Start and end page, typed by hand. Prefill start with 1 and end with the page count when known—these are hints I'll correct with the book in front of me. No automatic detection of where content starts and ends.

**Add a book by hand.** If the search comes up empty, I enter title, start and end myself, plus an optional cover photo from the camera or camera roll. Resize photos before storing (longest edge about 600px, JPEG).

**Edit and delete.** Every field stays editable after saving.

**Shelf.** The home screen is a grid of covers. Books without a cover show the title on a plain card.

**Random page.** Tap a book to see its cover, title and a large page number, picked uniformly at random between start and end inclusive. An "Again" button rolls a new one. The page number should be readable at arm's length.

**Surprise me.** One button on the shelf picks a random book and a random page in it, and lands on the same result screen.

## Not in v0.1

- Photo recognition (see v0.2)
- Automatic content-range detection
- Sync across devices, accounts or sharing
- Tracking which pages I've seen
- Notifications or reminders

## v0.2 scope

**Same shelf on every device.** Books live in Cloudflare KV behind a Worker, following Mirage's pattern: suggested name `coffee-table-api`, passphrase stored as a Worker secret, entered once per device and remembered there. Each device keeps its own copy in IndexedDB, so the shelf and random page still work offline. Adding, editing and deleting need a connection; when offline, say so plainly rather than failing silently. Single user, so if the same book is edited in two places, the latest edit wins. Photos travel with their book.

**Keep the books already on my phone.** The first time v0.2 runs on a device that has books, upload them before anything else, and keep the local copies until the upload succeeds.

**Publisher.** Add an optional publisher field to the book details form, prefilled from Google Books or Open Library when the match has one. The Add screen gets an optional publisher field too, used to narrow the search. Wherever the author shows, show the publisher instead when there's no author—my Gestalten book has no author.

**Worker conventions.**

- CORS: allow `https://jamien-liston.github.io` and every header the app sends, including the passphrase header and `content-type`, from the start.
- A wrong or missing passphrase gets a 401.
- I deploy the Worker myself with `npx wrangler deploy`, before pushing the front end—new routes would otherwise 404.

### v0.2 done when

- The two books already on my phone survive the update and show up on the Mac.
- A book added on the phone shows on the Mac after a refresh, and an edit on the Mac shows on the phone. A short delay is fine.
- Deleting a book on one device removes it from the other.
- curl with a wrong passphrase gets a 401, and the app shows a plain message for a wrong passphrase.
- In flight mode, the shelf and random page still work, and adding or editing says it needs a connection.
- A book with no author shows its publisher where the author would be.

## v0.3—parked, don't build yet

Photograph the cover, or the ISBN on the back, and have Claude read it through the v0.2 Worker (`ANTHROPIC_API_KEY` as a Worker secret, as in Mirage). The ISBN pins the exact edition, so the page count lines up. Use a plain file input with `capture` rather than a live camera view.

## Data

v0.1 keeps books in IndexedDB on the device. From v0.2, the Worker's KV store holds the shelf and IndexedDB is each device's offline copy. Per book: `id`, `title`, `author`, `publisher` (v0.2), `cover` (URL or resized image), `pageCount` (if known), `startPage`, `endPage`, `source` (`googlebooks`, `openlibrary` or `manual`), `addedAt`, `updatedAt` (v0.2).

## Stack and conventions

- Vanilla HTML/CSS/JS, no build step, hosted on GitHub Pages.
- iPhone Safari first, installed to the Home Screen.
- PWA with a manifest and service worker. Bump the `CACHE` version string in `service-worker.js` on any change to `index.html`, `css/` or `js/`. Show the app version in the UI.
- Call Google Books and Open Library straight from the browser. Try Google Books without a key; if it rate-limits, I'll add a referrer-restricted key. If thumbnail URLs come back as `http://`, rewrite them to `https://`.
- Plan first: before writing any code, describe the file structure, data shape and screens in plain English.
- I verify behaviourally, by using the app on my phone. After each change, tell me in plain English what changed and how to test it, and run `node --check` on the JS.
- Never commit, push or deploy—I do those myself.
- Create a `CLAUDE.md` with these conventions, and keep a `HANDOFF.md` in the repo root updated at the end of each session.

## v0.1 done when

- Three real books added by typing their titles, with covers where the APIs have them.
- One book added by hand with a cover photo.
- With a range of 10 to 12, repeated taps on "Again" produce 10, 11 and 12 and nothing else.
- "Surprise me" lands on different books over a handful of taps.
- Edit and delete work.
- Books survive closing and reopening the app from the Home Screen.
- In flight mode, the shelf and random page still work (covers may be missing).
