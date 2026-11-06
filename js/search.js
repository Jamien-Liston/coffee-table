// Book search, straight from the browser: Google Books first, then Open
// Library if Google fails or finds nothing. The tidying of results lives in
// logic.js so Node can test it.

const Search = (() => {
  const TIMEOUT_MS = 10000;

  class SearchError extends Error {
    constructor(kind, status = 0) {
      super(status ? `${kind} ${status}` : kind);
      this.kind = kind; // 'http', 'network', 'timeout', 'aborted' or 'unreadable'
      this.status = status;
    }
  }

  // Fetches JSON, giving up after TIMEOUT_MS or when `signal` aborts.
  async function getJson(url, signal) {
    const control = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      control.abort();
    }, TIMEOUT_MS);
    const stop = () => control.abort();
    signal?.addEventListener('abort', stop, { once: true });
    const failure = (fallback) =>
      new SearchError(timedOut ? 'timeout' : signal?.aborted ? 'aborted' : fallback);
    try {
      if (signal?.aborted) throw new SearchError('aborted');
      let response;
      try {
        response = await fetch(url, { signal: control.signal, credentials: 'omit' });
      } catch {
        throw failure('network');
      }
      if (!response.ok) throw new SearchError('http', response.status);
      try {
        return await response.json();
      } catch {
        throw failure('unreadable');
      }
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', stop);
    }
  }

  // Why Google wasn't used, in plain words.
  function googleProblem(err) {
    if (err.kind === 'http' && err.status === 429) return 'Google Books is over its daily limit';
    if (err.kind === 'http' && err.status === 403) return 'Google Books turned the search away';
    if (err.kind === 'http') return `Google Books had a problem (error ${err.status})`;
    if (err.kind === 'timeout') return 'Google Books took too long';
    if (err.kind === 'unreadable') return 'Google Books sent back something unreadable';
    return "Google Books couldn't be reached";
  }

  async function google(title, author, signal) {
    const url = Logic.googleSearchUrl(title, author, CONFIG.GOOGLE_BOOKS_KEY);
    return Logic.fromGoogle(await getJson(url, signal));
  }

  async function openLibrary(title, author, signal) {
    const url = Logic.openLibrarySearchUrl(title, author);
    return Logic.fromOpenLibrary(await getJson(url, signal));
  }

  // Google first, then Open Library. Resolves to
  //   { source, matches, googleSkipped, googleFoundNothing }
  // where googleSkipped explains, in plain words, why Open Library was used.
  // Rejects with a SearchError if Open Library fails as well.
  async function find(title, author, { signal, onFallback } = {}) {
    let googleSkipped;
    let googleFoundNothing = false;
    try {
      const matches = await google(title, author, signal);
      if (matches.length) {
        return { source: 'googlebooks', matches, googleSkipped: '', googleFoundNothing };
      }
      googleSkipped = 'Google Books found nothing';
      googleFoundNothing = true;
    } catch (err) {
      if (err.kind === 'aborted') throw err;
      googleSkipped = googleProblem(err);
    }
    onFallback?.();
    const matches = await openLibrary(title, author, signal);
    return { source: 'openlibrary', matches, googleSkipped, googleFoundNothing };
  }

  // Open Library only, for "Not it? Try Open Library".
  async function findOpenLibrary(title, author, { signal } = {}) {
    const matches = await openLibrary(title, author, signal);
    return { source: 'openlibrary', matches, googleSkipped: '', googleFoundNothing: false };
  }

  return { find, findOpenLibrary };
})();
