// Start-up, switching screens, and the app's state.
//
// Books are loaded from IndexedDB once and kept in `books`. Every change is
// written to the database first and only then applied to `books`, so the
// shelf always shows what's actually stored.

(() => {
  const $ = (id) => document.getElementById(id);

  let books = [];
  let loadProblem = '';
  let route = { view: 'shelf' };
  let currentBook = null; // the book on the random-page screen
  let pendingMatch = null; // what the details form starts from when adding
  let draft = null; // the details form in progress: { mode, id, source, cover, titleTidied }
  let saving = false;
  let lastSearch = null; // { title, author }
  let searchControl = null;
  let updateReady = false;
  const scrollMemory = {};

  // ---- Screens --------------------------------------------------------------

  function render() {
    scrollMemory[route.view] = window.scrollY;
    route = Logic.parseRoute(location.hash);
    if (route.view === 'add') showAdd();
    else if (route.view === 'details') showDetails(route);
    else if (route.view === 'book') showBook(route.id);
    else showShelf();
  }

  function showShelf() {
    Views.renderShelf(books, loadProblem);
    Views.showView('shelf');
    window.scrollTo(0, scrollMemory.shelf || 0);
    Views.focusHeading('shelf-heading');
    reloadIfUpdated();
  }

  function showAdd() {
    Views.showView('add');
    window.scrollTo(0, scrollMemory.add || 0);
    Views.focusHeading('add-heading');
  }

  function showBook(id) {
    const book = books.find((b) => b.id === id);
    if (!book) {
      location.replace('#/');
      return;
    }
    currentBook = book;
    Views.renderBook(book);
    Views.showView('book');
    window.scrollTo(0, 0);
    Views.focusHeading('book-title');
    roll();
  }

  function roll() {
    if (!currentBook || !Logic.hasValidRange(currentBook)) return;
    Views.showPage(Logic.randomPage(currentBook.startPage, currentBook.endPage));
  }

  function showDetails(r) {
    if (r.mode === 'edit') {
      const book = books.find((b) => b.id === r.id);
      if (!book) {
        location.replace('#/');
        return;
      }
      // A saved title is already yours, so editing never tidies it.
      draft = { mode: 'edit', id: book.id, source: book.source, cover: book.cover, titleTidied: true };
      Views.fillDetails({ mode: 'edit', book, guessed: false, backHref: Logic.bookRoute(book.id) });
    } else {
      // From a search match, or by hand (also after a reload, when the
      // picked match is gone). The first page always starts at 1; the last
      // starts at the page count when it's known.
      const start = pendingMatch || { source: 'manual', title: '', author: '', cover: '' };
      const pageCount = start.pageCount ?? '';
      draft = {
        mode: 'new',
        id: null,
        source: start.source,
        cover: start.cover || '',
        titleTidied: Boolean(start.titleTidied),
      };
      Views.fillDetails({
        mode: 'new',
        book: {
          title: start.title,
          author: start.author,
          pageCount,
          startPage: 1,
          endPage: pageCount,
        },
        guessed: start.source !== 'manual' && pageCount !== '',
        backHref: '#/add',
      });
    }
    Views.showCoverPreview(draft.cover);
    Views.showView('details');
    window.scrollTo(0, 0);
    Views.focusHeading('details-heading');
  }

  // ---- Shelf and random page ------------------------------------------------

  $('surprise').addEventListener('click', () => {
    if (books.length) location.hash = Logic.bookRoute(Logic.pickRandom(books).id);
  });

  $('again').addEventListener('click', roll);

  // ---- Search ---------------------------------------------------------------

  $('search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const input = Views.searchInput();
    const title = Logic.cleanText(input.title);
    const author = Logic.cleanText(input.author);
    if (!title) {
      Views.searchMessage('Type a title to search for.');
      $('search-title').focus();
      return;
    }
    document.activeElement?.blur(); // put the keyboard away so the matches show
    runSearch(title, author, false);
  });

  $('search-openlibrary').addEventListener('click', () => {
    if (lastSearch) runSearch(lastSearch.title, lastSearch.author, true);
  });

  $('add-by-hand').addEventListener('click', () => {
    const input = Views.searchInput();
    const title = Logic.cleanText(input.title);
    pendingMatch = {
      source: 'manual',
      // The title typed for the search arrives tidied, and that's its one
      // tidy: change it on the next screen and your version stays.
      title: Logic.titleCase(title),
      titleTidied: title !== '',
      author: Logic.cleanText(input.author),
      cover: '',
      pageCount: null,
    };
    location.hash = '#/add/details';
  });

  async function runSearch(title, author, openLibraryOnly) {
    searchControl?.abort();
    const control = new AbortController();
    searchControl = control;
    lastSearch = { title, author };
    if (navigator.onLine === false) {
      Views.searchOffline();
      return;
    }
    Views.searchBusy(openLibraryOnly ? 'Searching Open Library…' : 'Searching…');
    try {
      const options = {
        signal: control.signal,
        onFallback: () => Views.searchBusy('Trying Open Library…'),
      };
      const result = openLibraryOnly
        ? await Search.findOpenLibrary(title, author, options)
        : await Search.find(title, author, options);
      if (searchControl !== control) return;
      Views.searchResults(result, pickMatch, { openLibraryOnly });
    } catch (err) {
      if (searchControl !== control || err.kind === 'aborted') return;
      Views.searchFailed();
    } finally {
      if (searchControl === control) searchControl = null;
    }
  }

  function pickMatch(match) {
    pendingMatch = match;
    location.hash = '#/add/details';
  }

  // ---- Book details ---------------------------------------------------------

  $('photo-input').addEventListener('change', async (event) => {
    const input = event.target;
    const file = input.files && input.files[0];
    const target = draft;
    if (!file || !target) return;
    Views.coverStatus('Shrinking the photo…');
    try {
      const dataUrl = await Photo.shrink(file);
      if (draft !== target) return; // they've moved on to another book
      target.cover = dataUrl;
      Views.showCoverPreview(dataUrl);
      Views.coverStatus('');
    } catch {
      if (draft === target) Views.coverStatus("Couldn't use that photo. Try another one.");
    } finally {
      input.value = ''; // so picking the same photo again still counts
    }
  });

  $('cover-remove').addEventListener('click', () => {
    if (!draft) return;
    draft.cover = '';
    Views.showCoverPreview('');
  });

  // Leaving the title field tidies the title into title case, once per new
  // book: change it afterwards and your version stays. (Add by hand brings
  // the title over already tidied, and Edit never tidies.)
  let titleEnteredIn = null; // the form that was showing when the title got focus
  $('f-title').addEventListener('focus', () => {
    titleEnteredIn = draft;
  });
  $('f-title').addEventListener('blur', () => {
    const input = $('f-title');
    const title = Logic.cleanText(input.value);
    // A form filled in since the title got focus isn't the one being left.
    if (!draft || draft !== titleEnteredIn || draft.titleTidied || !title) return;
    draft.titleTidied = true;
    input.value = Logic.titleCase(title);
  });

  // Tapping into a page field selects its number, so typing replaces it.
  // Selecting when the field gets focus isn't enough on its own: Safari,
  // on iPhone especially, then puts the caret where the finger landed (or
  // at the start, after Return). So select again when the tap that focused
  // the field lifts, and once more after everything else has run.
  for (const field of ['pageCount', 'startPage', 'endPage']) {
    const input = $(`f-${field}`);
    let focusingTap = false; // a press that's about to focus the field
    const selectAll = () => {
      if (document.activeElement === input) input.setSelectionRange(0, input.value.length);
    };
    input.addEventListener('mousedown', () => {
      focusingTap = document.activeElement !== input;
    });
    input.addEventListener('focus', () => {
      selectAll();
      setTimeout(selectAll, 0);
    });
    input.addEventListener('mouseup', (event) => {
      if (!focusingTap) return;
      focusingTap = false;
      event.preventDefault(); // or lifting the finger puts the caret back where it landed
      selectAll();
    });
    input.addEventListener('blur', () => {
      focusingTap = false;
    });
  }

  // Return in a field moves on to the next one instead of saving early;
  // in the last field it just puts the keyboard away.
  $('details-form').addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.isComposing || event.target.tagName !== 'INPUT') return;
    event.preventDefault();
    const fields = [...$('details-form').querySelectorAll('input[type="text"]')];
    const next = fields[fields.indexOf(event.target) + 1];
    if (next) next.focus();
    else event.target.blur();
  });

  $('details-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving || !draft) return;
    const check = Logic.validateBook(Views.readDetails());
    Views.showErrors(check.errors);
    if (!check.ok) return;

    const cover = Logic.safeCover(draft.cover);
    let book;
    if (draft.mode === 'edit') {
      const existing = books.find((b) => b.id === draft.id);
      if (!existing) {
        location.replace('#/');
        return;
      }
      book = { ...existing, ...check.value, cover };
    } else {
      book = {
        id: newId(),
        ...check.value,
        cover,
        source: draft.source,
        addedAt: new Date().toISOString(),
      };
    }

    saving = true;
    Views.setSaving(true);
    Views.detailsProblem('');
    try {
      await DB.put(book);
    } catch {
      Views.detailsProblem("Couldn't save the book. Try again. If it keeps failing, " +
        'close the app fully and open it again.');
      return;
    } finally {
      saving = false;
      Views.setSaving(false);
    }

    const index = books.findIndex((b) => b.id === book.id);
    if (index >= 0) books[index] = book;
    else books.push(book);
    const wasEdit = draft.mode === 'edit';
    draft = null;
    if (wasEdit) {
      location.replace(Logic.bookRoute(book.id));
    } else {
      pendingMatch = null;
      Views.resetSearch();
      location.replace('#/');
    }
  });

  $('details-delete').addEventListener('click', async () => {
    if (saving || !draft || draft.mode !== 'edit') return;
    const book = books.find((b) => b.id === draft.id);
    if (!book) return;
    if (!window.confirm(`Delete “${book.title}”? This can't be undone.`)) return;

    saving = true;
    Views.setSaving(true);
    Views.detailsProblem('');
    try {
      await DB.remove(book.id);
    } catch {
      Views.detailsProblem("Couldn't delete the book. Try again. If it keeps failing, " +
        'close the app fully and open it again.');
      return;
    } finally {
      saving = false;
      Views.setSaving(false);
    }

    books = books.filter((b) => b.id !== book.id);
    draft = null;
    location.replace('#/');
  });

  function newId() {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  // ---- Offline copy and new versions -----------------------------------------

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    let controlled = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // The very first install takes charge without anything having changed.
      if (!controlled) {
        controlled = true;
        return;
      }
      updateReady = true;
      reloadIfUpdated();
    });
    // updateViaCache 'none': always check version.js for changes too.
    navigator.serviceWorker.register('service-worker.js', { updateViaCache: 'none' })
      .then((registration) => {
        // Look for a new version whenever the app comes back to the front,
        // not only when it's opened fresh.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => {});
        });
      })
      .catch(() => {}); // the app still works, just not offline
  }

  // A new version has taken over. Reload into it, but only from the shelf,
  // so nobody loses a half-filled form or the page number they're looking up.
  function reloadIfUpdated() {
    if (updateReady && route.view === 'shelf') {
      updateReady = false;
      location.reload();
    }
  }

  // Ask the browser not to clear the app's storage when space runs low.
  function keepStorage() {
    navigator.storage?.persisted?.()
      .then((persisted) => persisted || navigator.storage.persist())
      .catch(() => {});
  }

  // ---- Start ----------------------------------------------------------------

  async function start() {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    Views.setVersion(self.APP_VERSION);
    try {
      const stored = await DB.all();
      books = stored.filter((b) => b && typeof b.id === 'string' && typeof b.title === 'string');
    } catch {
      loadProblem = "Couldn't open your books. Close the app fully and open it again.";
    }
    window.addEventListener('hashchange', render);
    render();
    keepStorage();
    registerServiceWorker();
  }

  start();
})();
