// The app's rules, kept away from the page (no DOM, storage or network) so
// Node can check them. Run `node test/logic.test.js` after any change here.
//
// In the browser this is a plain script that defines the global `Logic`.
// Node loads it through the module.exports line at the bottom.

const Logic = (() => {
  const MAX_TEXT = 200; // characters, for titles and authors
  const MAX_PAGE = 99999;

  // Google's default 128px thumbnails are blurry on an iPhone, and for
  // landscape books they can come back sideways. zoom=3 is 575px wide and
  // zoom=2 is 300px; both show landscape covers the right way round.
  const GOOGLE_COVER_ZOOM = 3;
  const GOOGLE_THUMB_ZOOM = 2;

  // ---- Random -------------------------------------------------------------

  // A page from start to end inclusive, every page equally likely.
  // `rand` is only swapped out by the tests.
  function randomPage(start, end, rand = Math.random) {
    return start + Math.floor(rand() * (end - start + 1));
  }

  // One item from a non-empty list, every item equally likely.
  function pickRandom(list, rand = Math.random) {
    return list[Math.floor(rand() * list.length)];
  }

  // ---- Text ---------------------------------------------------------------

  // Swap control characters for spaces, collapse runs of whitespace, trim.
  function cleanText(value) {
    return String(value ?? '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Clean text from an API and cut it to the app's limit.
  function clip(value) {
    if (typeof value !== 'string') return '';
    return cleanText(value).slice(0, MAX_TEXT).trim();
  }

  // ---- Titles -------------------------------------------------------------

  // Kept lowercase inside a title unless first, last or straight after a colon.
  const SMALL_WORDS = new Set([
    'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'the', 'to',
  ]);
  const HAS_WORD = /[\p{L}\p{N}]/u;
  const HYPHEN = /([-‐‑])/; // hyphen-minus, hyphen, non-breaking hyphen

  // Title case that only ever changes the first letter of a word:
  //   - small words (a, of, the…) lowercase unless first, last or after a colon
  //   - every other word capitalized
  //   - a word with a capital after its first letter left alone (MoMA, iPhone, UK)
  //   - a word that starts with a digit left alone (21st, 1970s)
  //   - each part of a hyphenated word counts as a word, and the first part
  //     is always capitalized (Mid-Century, Step-by-Step, A-Z)
  // Spacing and punctuation stay as they are.
  function titleCase(text) {
    const tokens = String(text ?? '').split(/(\s+)/);
    const words = tokens.flatMap((token, i) => (HAS_WORD.test(token) ? [i] : []));
    const first = words[0];
    const last = words[words.length - 1];
    let afterColon = false;
    return tokens.map((token, i) => {
      if (!HAS_WORD.test(token)) {
        if (token.endsWith(':')) afterColon = true; // a colon on its own: "Paris : a guide"
        return token;
      }
      const parts = token.split(HYPHEN);
      const wordParts = parts.flatMap((part, k) => (HAS_WORD.test(part) ? [k] : []));
      const compound = wordParts.length > 1;
      const cased = parts.map((part, k) => {
        if (!HAS_WORD.test(part)) return part;
        const capitalize =
          (k === wordParts[0] && (i === first || afterColon || compound)) ||
          (i === last && k === wordParts[wordParts.length - 1]);
        return caseWord(part, capitalize);
      }).join('');
      afterColon = token.endsWith(':');
      return cased;
    }).join('');
  }

  // Capitalizes one word's first letter, or lowercases it for a small word
  // that doesn't have to be capitalized. Leaves alone a word that starts
  // with a digit or has a capital after its first letter.
  function caseWord(word, capitalize) {
    const at = word.search(/[\p{L}\p{N}]/u);
    const head = String.fromCodePoint(word.codePointAt(at));
    const rest = word.slice(at + head.length);
    if (/\p{N}/u.test(head) || /[\p{Lu}\p{Lt}]/u.test(rest)) return word;
    const bare = (head + rest).replace(/[^\p{L}\p{N}]+$/u, '').toLowerCase();
    const lower = !capitalize && SMALL_WORDS.has(bare);
    return word.slice(0, at) + (lower ? head.toLowerCase() : head.toUpperCase()) + rest;
  }

  // ---- Shelf order --------------------------------------------------------

  // Sort by title, ignoring case and a leading "The", "A" or "An".
  function sortKey(title) {
    return cleanText(title).replace(/^(the|a|an)\s+/i, '');
  }

  function sortBooks(books) {
    return [...books].sort((a, b) =>
      sortKey(a.title).localeCompare(sortKey(b.title), undefined, {
        sensitivity: 'base',
        numeric: true,
      }) || String(a.addedAt).localeCompare(String(b.addedAt)));
  }

  // ---- Book form ----------------------------------------------------------

  // Reads a page field: { value } for a whole number from 1 to MAX_PAGE,
  // { empty: true } for a blank field, { bad: true } for anything else.
  function readPage(text) {
    const s = String(text ?? '').trim();
    if (s === '') return { empty: true };
    if (!/^\d{1,5}$/.test(s)) return { bad: true };
    const n = Number(s);
    return n >= 1 && n <= MAX_PAGE ? { value: n } : { bad: true };
  }

  const WHOLE_NUMBER = 'Use a whole number from 1 to 99,999.';

  // Checks the details form. Takes the fields as typed and returns
  // { ok, errors: { field: message }, value: the cleaned fields or null }.
  function validateBook(input) {
    const errors = {};

    const title = cleanText(input.title);
    if (!title) errors.title = 'Add a title.';
    else if (title.length > MAX_TEXT) errors.title = 'Keep the title to 200 characters or fewer.';

    const author = cleanText(input.author);
    if (author.length > MAX_TEXT) errors.author = 'Keep the author to 200 characters or fewer.';

    const pageCount = readPage(input.pageCount);
    if (pageCount.bad) errors.pageCount = 'Use a whole number, or leave it blank.';

    const start = readPage(input.startPage);
    if (start.empty) errors.startPage = 'Add the first content page.';
    else if (start.bad) errors.startPage = WHOLE_NUMBER;

    const end = readPage(input.endPage);
    if (end.empty) errors.endPage = 'Add the last content page.';
    else if (end.bad) errors.endPage = WHOLE_NUMBER;
    else if (start.value && end.value < start.value) {
      errors.endPage = "The last page can't be before the first.";
    }

    const ok = Object.keys(errors).length === 0;
    const value = ok
      ? {
          title,
          author,
          pageCount: pageCount.value ?? null,
          startPage: start.value,
          endPage: end.value,
        }
      : null;
    return { ok, errors, value };
  }

  // Whether a stored book's range can be rolled.
  function hasValidRange(book) {
    return Number.isInteger(book.startPage) && Number.isInteger(book.endPage) &&
      book.startPage >= 1 && book.endPage >= book.startPage && book.endPage <= MAX_PAGE;
  }

  // ---- Covers -------------------------------------------------------------

  // The only image sources the app uses: https links, or its own resized
  // photos. Anything else counts as no cover.
  function safeCover(src) {
    if (typeof src !== 'string' || src === '') return '';
    if (/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(src)) return src;
    try {
      const url = new URL(src);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  }

  // Google answers a cover size it hasn't got with its grey "image not
  // available" picture: HTTP 200, not an error, and always at exactly one of
  // these sizes. Print-only books often have only the small zoom=1 image.
  const GOOGLE_PLACEHOLDER_SIZES = new Set(['300x391', '575x750', '800x1043', '1280x1670']);

  // Google's zoom levels, largest image first. zoom=5 is a smaller copy of
  // zoom=1, so it's never worth stepping down to.
  const GOOGLE_ZOOMS_BY_SIZE = [6, 4, 3, 2, 1];

  function isGooglePlaceholder(width, height) {
    return GOOGLE_PLACEHOLDER_SIZES.has(`${width}x${height}`);
  }

  // The links to try for a cover, best first. A Google cover steps down
  // through the smaller sizes to zoom=1, which exists whenever Google gives
  // a cover link at all. Any other cover is tried as it is.
  function coverFallbacks(src) {
    let url;
    try {
      url = new URL(src);
    } catch {
      return [src];
    }
    const from = GOOGLE_ZOOMS_BY_SIZE.indexOf(Number(url.searchParams.get('zoom')));
    if (url.hostname !== 'books.google.com' || url.pathname !== '/books/content' || from < 0) {
      return [src];
    }
    return [src, ...GOOGLE_ZOOMS_BY_SIZE.slice(from + 1).map((zoom) => {
      url.searchParams.set('zoom', String(zoom));
      return url.href;
    })];
  }

  // Google Books cover links come back as http:// with a page-curl effect.
  // Make them https, drop the curl and set the size.
  function googleCover(link, zoom) {
    if (typeof link !== 'string' || link === '') return '';
    try {
      const url = new URL(link.replace(/^http:\/\//i, 'https://'));
      if (url.protocol !== 'https:') return '';
      url.searchParams.delete('edge');
      url.searchParams.set('zoom', String(zoom));
      return url.href;
    } catch {
      return '';
    }
  }

  // ---- Search -------------------------------------------------------------

  // Google Books query: each title word must be in the title, and each author
  // word in the author. Punctuation is dropped so it can't change the query.
  function googleQuery(title, author) {
    const words = (text, field) => cleanText(text)
      .split(/[^\p{L}\p{N}'’&-]+/u)
      .map((word) => word.replace(/^[-'’&]+|[-'’&]+$/g, ''))
      .filter((word) => /[\p{L}\p{N}]/u.test(word))
      .map((word) => `${field}:${word}`);
    return [...words(title, 'intitle'), ...words(author, 'inauthor')].join(' ');
  }

  function googleSearchUrl(title, author, key) {
    const params = new URLSearchParams({
      q: googleQuery(title, author),
      printType: 'books',
      maxResults: '20',
      fields: 'items(id,volumeInfo(title,subtitle,authors,publishedDate,' +
        'pageCount,printedPageCount,imageLinks))',
    });
    if (key) params.set('key', key);
    return `https://www.googleapis.com/books/v1/volumes?${params}`;
  }

  // A Google volume's own record. It can have a page count when the search
  // listing has none: A House in Japan is 0 pages in the listing, 272 here.
  function googleVolumeUrl(id, key) {
    const params = new URLSearchParams({ fields: 'volumeInfo(pageCount,printedPageCount)' });
    if (key) params.set('key', key);
    return `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}?${params}`;
  }

  // The page count from a volume record, printed count first, or null.
  function pageCountFromGoogle(json) {
    const info = json?.volumeInfo ?? {};
    return pageOrNull(info.printedPageCount) ?? pageOrNull(info.pageCount);
  }

  // A book listed as "Midcentury" can be missed by a search for "Mid-century",
  // so a hyphenated title that finds nothing is searched again without its
  // hyphens. Returns that title, or '' when no word in it has a hyphen.
  function withoutHyphens(title) {
    const clean = cleanText(title);
    const joined = clean.replace(/([\p{L}\p{N}])[-‐‑](?=[\p{L}\p{N}])/gu, '$1');
    return joined === clean ? '' : joined;
  }

  function openLibrarySearchUrl(title, author) {
    const params = new URLSearchParams({
      title: cleanText(title),
      limit: '20',
      fields: 'title,subtitle,author_name,first_publish_year,' +
        'number_of_pages_median,cover_i',
    });
    if (cleanText(author)) params.set('author', cleanText(author));
    return `https://openlibrary.org/search.json?${params}`;
  }

  function pageOrNull(n) {
    return Number.isInteger(n) && n >= 1 && n <= MAX_PAGE ? n : null;
  }

  function strings(list) {
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string') : [];
  }

  // Google's id for a volume, kept only if it looks like one. It's only used
  // to ask for that volume's record, never stored.
  const GOOGLE_ID = /^[A-Za-z0-9_-]{1,40}$/;

  // Google Books volumes -> matches. Each volume is one edition.
  function fromGoogle(json) {
    const items = Array.isArray(json?.items) ? json.items : [];
    return items.map((item) => {
      const info = item?.volumeInfo ?? {};
      const link = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail;
      const date = typeof info.publishedDate === 'string' ? info.publishedDate : '';
      return {
        googleId: typeof item?.id === 'string' && GOOGLE_ID.test(item.id) ? item.id : '',
        title: clip(info.title),
        subtitle: clip(info.subtitle),
        author: clip(strings(info.authors).join(', ')),
        year: date.match(/^\d{4}/)?.[0] ?? '',
        pageCount: pageOrNull(info.printedPageCount) ?? pageOrNull(info.pageCount),
        cover: googleCover(link, GOOGLE_COVER_ZOOM),
        thumb: googleCover(link, GOOGLE_THUMB_ZOOM),
        source: 'googlebooks',
      };
    }).filter((match) => match.title);
  }

  // Open Library works -> matches. A work covers all its editions, so the
  // year is the first publication and the page count is the editions' median.
  function fromOpenLibrary(json) {
    const docs = Array.isArray(json?.docs) ? json.docs : [];
    return docs.map((doc) => {
      const id = Number.isInteger(doc?.cover_i) && doc.cover_i > 0 ? doc.cover_i : null;
      const base = id ? `https://covers.openlibrary.org/b/id/${id}` : '';
      return {
        title: clip(doc?.title),
        subtitle: clip(doc?.subtitle),
        author: clip(strings(doc?.author_name).slice(0, 3).join(', ')),
        year: Number.isInteger(doc?.first_publish_year) ? String(doc.first_publish_year) : '',
        pageCount: pageOrNull(doc?.number_of_pages_median),
        cover: base && `${base}-L.jpg`,
        thumb: base && `${base}-M.jpg`,
        source: 'openlibrary',
      };
    }).filter((match) => match.title);
  }

  // ---- Routes -------------------------------------------------------------

  // Which screen a location hash points at.
  function parseRoute(hash) {
    let parts;
    try {
      parts = String(hash ?? '').replace(/^#\/?/, '').split('/')
        .filter(Boolean).map(decodeURIComponent);
    } catch {
      return { view: 'shelf' };
    }
    const [first, second, third] = parts;
    if (parts.length === 1 && first === 'add') return { view: 'add' };
    if (parts.length === 2 && first === 'add' && second === 'details') {
      return { view: 'details', mode: 'new' };
    }
    if (parts.length === 2 && first === 'book') return { view: 'book', id: second };
    if (parts.length === 3 && first === 'book' && third === 'edit') {
      return { view: 'details', mode: 'edit', id: second };
    }
    return { view: 'shelf' };
  }

  function bookRoute(id) {
    return `#/book/${encodeURIComponent(id)}`;
  }

  function editRoute(id) {
    return `#/book/${encodeURIComponent(id)}/edit`;
  }

  return {
    MAX_TEXT,
    MAX_PAGE,
    randomPage,
    pickRandom,
    cleanText,
    titleCase,
    sortBooks,
    validateBook,
    hasValidRange,
    safeCover,
    isGooglePlaceholder,
    coverFallbacks,
    googleCover,
    googleQuery,
    googleSearchUrl,
    googleVolumeUrl,
    pageCountFromGoogle,
    withoutHyphens,
    openLibrarySearchUrl,
    fromGoogle,
    fromOpenLibrary,
    parseRoute,
    bookRoute,
    editRoute,
  };
})();

if (typeof module === 'object' && module.exports) module.exports = Logic;
