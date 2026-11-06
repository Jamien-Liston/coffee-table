# Coffee Table: rules for Claude Code

A personal iPhone PWA that gets Jam to open the coffee table books that never get looked at. Pick a book, or tap Surprise me, and it shows a page number picked uniformly at random between the book's first and last content pages. One user, one phone, no accounts or sharing. BRIEF.md has the full brief; v0.2 there is parked.

## Working with Jam

- Start each session by reading HANDOFF.md, and update it before the session ends.
- Plan first: before writing code for anything new, describe the files, data and screens in plain English.
- Jam verifies by using the app on the phone. After each change, say in plain English what changed, where it shows up and how to test it.
- Run `node --check` on every JS file after any change. Run `node test/logic.test.js` after any change to `js/logic.js`.
- Never commit, push, tag or deploy. Jam does all of that.
- UI copy and docs in Australian English; code in American English.

## Stack

- Vanilla HTML, CSS and JS. No build step, frameworks or packages. Hosted on GitHub Pages from the root of `main`.
- Plain scripts, not modules, loaded in order by `index.html`: version → config → logic → db → search → photo → views → app.
- `js/logic.js` holds the rules (random page, sorting, form checks, tidying API results, routes) and never touches the page, so Node can test it.
- Every path is relative, so the app works under any repo name (`jamien-liston.github.io/<repo>/`).
- iPhone Safari first, installed to the Home Screen. No third-party scripts or web fonts.

## Versions and the service worker

- `js/version.js` is the single source of truth for the version. The shelf shows it, and `service-worker.js` builds its `CACHE` name from it.
- **Bump `APP_VERSION` in `js/version.js` on any change to `index.html`, `css/`, `js/`, `manifest.webmanifest` or `icons/`**, or installed copies keep the old files. There is nothing to bump in `service-worker.js`.
- A new file the app needs must also go in `FILES` in `service-worker.js`.
- Keep `updateViaCache: 'none'` on the registration (it makes the browser notice a changed `version.js`). Also keep `cache: 'reload'` on the precache, which stops GitHub Pages' 10-minute browser cache from slipping old files into a new version.
- All of Jam's GitHub Pages apps share the origin `jamien-liston.github.io`, and with it cache storage and IndexedDB. The service worker deletes only caches whose names start with `coffee-table-v`. Never widen that.
- A new version reloads the app only from the shelf, never mid-form or while a page number is showing.

## Data

- IndexedDB: database `coffee-table`, store `books`, keyed by `id`. **Never rename either once real books exist**, or the shelf comes up empty. Schema changes need a version bump and an upgrade step in `js/db.js`.
- Record fields:
  - `id`
  - `title`
  - `author` (`''` if none)
  - `cover`: an https URL, `data:image/jpeg;base64,…`, or `''`
  - `pageCount`: a number or `null`
  - `startPage` and `endPage`
  - `source`: `googlebooks`, `openlibrary` or `manual`
  - `addedAt`: an ISO string
- Write to the database first, then update the in-memory list (`books` in `js/app.js`).
- Photos are shrunk to 600px on the longest side and stored as JPEG data URLs in the record.

## Safety

- Book details, whether from the APIs or typed in, go on the page with `textContent` or `el()` only. Never `innerHTML`.
- Covers always pass through `Logic.safeCover`, which allows only https links and the app's own JPEG data URLs.
- The Content-Security-Policy meta tag in `index.html` allows scripts only from the app, and network calls only to `www.googleapis.com` and `openlibrary.org`. A new API host has to be added there. No inline scripts or `style` attributes.
- `js/config.js` is public. The only thing allowed in it is the Google Books browser key, restricted to the Books API and `https://jamien-liston.github.io/*`. Browsers send other sites only the origin as the referrer, so a path-specific restriction would block every request.

## Renaming

- The visible name is in four places:
  - `<title>` in `index.html`
  - `apple-mobile-web-app-title` in `index.html`
  - the shelf heading in `index.html`
  - `name` and `short_name` in `manifest.webmanifest`
- Leave the internal `coffee-table` names (database, cache prefix) alone.
- iPhones keep the Home Screen name and icon from when the app was added. Remove it and add it again to pick up a change.
