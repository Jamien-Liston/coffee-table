// Draws each screen. Anything from the APIs or typed in goes onto the page as
// text (textContent and text nodes), never as HTML. Covers only ever come
// through Logic.safeCover.

const Views = (() => {
  const $ = (id) => document.getElementById(id);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const FIELDS = ['title', 'author', 'pageCount', 'startPage', 'endPage'];

  // el('p', { class: 'x', text: 'Hello' }, child, 'more text')
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    }
    for (const child of children) {
      if (child != null) node.append(child);
    }
    return node;
  }

  // A cover <img>, or null when there's no usable cover. If it fails to load
  // (offline, say) it removes itself, revealing whatever sits underneath.
  function coverImage(src, { className, lazy = false, onLoad, onError } = {}) {
    const safe = Logic.safeCover(src);
    if (!safe) return null;
    const img = el('img', { class: className, alt: '', decoding: 'async' });
    if (lazy) img.loading = 'lazy';
    img.addEventListener('load', () => onLoad?.(img), { once: true });
    img.addEventListener('error', () => {
      img.remove();
      onError?.();
    }, { once: true });
    img.src = safe;
    return img;
  }

  // ---- Screens ------------------------------------------------------------

  function showView(name) {
    for (const view of document.querySelectorAll('.view')) {
      view.hidden = view.id !== `view-${name}`;
    }
  }

  // Move focus to a screen's heading so screen readers announce the change.
  function focusHeading(id) {
    $(id)?.focus({ preventScroll: true });
  }

  // ---- Shelf --------------------------------------------------------------

  function renderShelf(books, problem) {
    $('shelf-grid').replaceChildren(...Logic.sortBooks(books).map(shelfTile));
    $('shelf-empty').hidden = books.length > 0 || Boolean(problem);
    $('shelf-dock').hidden = books.length === 0;
    const notice = $('shelf-error');
    notice.textContent = problem || '';
    notice.hidden = !problem;
  }

  function shelfTile(book) {
    const label = book.author ? `${book.title}, ${book.author}` : book.title;
    const link = el('a', { class: 'tile', href: Logic.bookRoute(book.id), 'aria-label': label },
      el('span', { class: 'tile-card', 'aria-hidden': 'true' },
        el('span', { class: 'tile-title', text: book.title }),
        book.author ? el('span', { class: 'tile-author', text: book.author }) : null));
    const img = coverImage(book.cover, {
      className: 'tile-img',
      lazy: true,
      onLoad: () => link.classList.add('has-cover'),
    });
    if (img) link.append(img);
    return el('li', {}, link);
  }

  function setVersion(version) {
    $('app-version').textContent = `v${version}`;
  }

  // ---- Random page --------------------------------------------------------

  function renderBook(book) {
    const coverBox = $('book-cover');
    coverBox.replaceChildren();
    const img = coverImage(book.cover, { className: 'book-cover-img' });
    if (img) coverBox.append(img);

    $('book-title').textContent = book.title;
    $('book-author').textContent = book.author;
    $('book-author').hidden = !book.author;
    $('book-edit').href = Logic.editRoute(book.id);

    const ok = Logic.hasValidRange(book);
    $('page-block').hidden = !ok;
    $('book-dock').hidden = !ok;
    $('book-problem').hidden = ok;
    $('book-problem').textContent = ok ? '' :
      "This book's pages need fixing. Tap Edit and set the first and last content pages.";
    $('page-number').textContent = '';
    if (!ok) return;

    // Size the number for the book's longest page, so it stays put between rolls.
    const digits = String(book.endPage).length;
    $('page-number').classList.toggle('digits-4', digits === 4);
    $('page-number').classList.toggle('digits-5', digits >= 5);
    $('page-range').textContent = `between ${book.startPage} and ${book.endPage}`;
  }

  function showPage(page) {
    const number = $('page-number');
    number.textContent = String(page);
    // A short pop on every roll, so a repeat (11, then 11) still looks new.
    if (typeof number.animate === 'function') {
      const frames = reduceMotion.matches
        ? [{ opacity: 0.2 }, { opacity: 1 }]
        : [
            { transform: 'scale(0.8)', opacity: 0.3 },
            { transform: 'scale(1.05)', opacity: 1, offset: 0.65 },
            { transform: 'scale(1)', opacity: 1 },
          ];
      number.animate(frames, { duration: reduceMotion.matches ? 200 : 280, easing: 'ease-out' });
    }
    announce(`Page ${page}`);
  }

  // Screen readers hear each roll, repeats included.
  function announce(text) {
    const live = $('page-announce');
    live.textContent = '';
    setTimeout(() => {
      live.textContent = text;
    }, 60);
  }

  // ---- Search -------------------------------------------------------------

  function setSearching(on) {
    $('search-submit').disabled = on;
    $('search-form').setAttribute('aria-busy', String(on));
  }

  function searchMessage(text) {
    setSearching(false);
    $('search-status').textContent = text;
    $('search-results').replaceChildren();
    $('search-openlibrary').hidden = true;
  }

  function searchBusy(text) {
    searchMessage(text);
    setSearching(true);
  }

  function searchResults(result, onPick, { openLibraryOnly = false } = {}) {
    setSearching(false);
    const { source, matches, googleSkipped, googleFoundNothing } = result;
    let status;
    if (!matches.length) {
      if (openLibraryOnly) status = 'No matches in Open Library either.';
      else if (googleFoundNothing) status = 'No matches in Google Books or Open Library.';
      else if (googleSkipped) status = `No matches in Open Library (${googleSkipped}).`;
      else status = 'No matches.';
      status += ' Check the spelling, or add the book by hand.';
    } else {
      const count = `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`;
      const from = source === 'googlebooks' ? 'Google Books' : 'Open Library';
      status = googleSkipped
        ? `${count} from ${from}, because ${googleSkipped}.`
        : `${count} from ${from}.`;
      status += ' Tap the one that matches your edition.';
    }
    $('search-status').textContent = status;
    $('search-results').replaceChildren(...matches.map((match) => matchItem(match, onPick)));
    $('search-openlibrary').hidden = source !== 'googlebooks';
  }

  function matchItem(match, onPick) {
    // Non-breaking spaces keep "428 pages" and "pages unknown" on one line;
    // the line only wraps at the dots.
    const meta = [
      match.author,
      match.year,
      match.pageCount ? `${match.pageCount} pages` : 'pages unknown',
    ].filter(Boolean).join(' · ');
    const button = el('button', { type: 'button', class: 'match' },
      el('span', { class: 'match-thumb' }, coverImage(match.thumb, { lazy: true })),
      el('span', { class: 'match-text' },
        el('span', { class: 'match-title', text: match.title }),
        match.subtitle ? el('span', { class: 'match-subtitle', text: match.subtitle }) : null,
        el('span', { class: 'match-meta', text: meta })));
    button.addEventListener('click', () => onPick(match));
    return el('li', {}, button);
  }

  function searchFailed() {
    searchMessage("Search isn't working right now. Check your connection, or add the book by hand.");
  }

  function searchOffline() {
    searchMessage("You're offline. Search needs a connection, but you can still add the book by hand.");
  }

  function resetSearch() {
    $('search-form').reset();
    searchMessage('');
  }

  function searchInput() {
    return { title: $('search-title').value, author: $('search-author').value };
  }

  // ---- Book details -------------------------------------------------------

  // mode: 'new' or 'edit'. book: any of the form fields.
  // guessed: the pages were filled in from the page count.
  function fillDetails({ mode, book, guessed, backHref }) {
    $('details-heading').textContent = mode === 'edit' ? 'Edit book' : 'Add a book';
    $('details-back').href = backHref;
    for (const field of FIELDS) $(`f-${field}`).value = book[field] ?? '';
    $('range-guess').hidden = !guessed;
    $('details-save').textContent = mode === 'edit' ? 'Save changes' : 'Save book';
    $('details-delete').hidden = mode !== 'edit';
    coverStatus('');
    detailsProblem('');
    setSaving(false);
    showErrors({}, { focus: false });
  }

  function readDetails() {
    return Object.fromEntries(FIELDS.map((field) => [field, $(`f-${field}`).value]));
  }

  function showErrors(errors, { focus = true } = {}) {
    for (const field of FIELDS) {
      const message = errors[field] || '';
      $(`f-${field}-error`).textContent = message;
      if (message) $(`f-${field}`).setAttribute('aria-invalid', 'true');
      else $(`f-${field}`).removeAttribute('aria-invalid');
    }
    const first = FIELDS.find((field) => errors[field]);
    if (first && focus) $(`f-${first}`).focus();
  }

  function showCoverPreview(src) {
    const box = $('cover-preview');
    const none = (text) => el('span', { class: 'cover-none', text });
    const img = coverImage(src, {
      // The failed image has removed itself. Only fill the gap if nothing
      // newer (a fresh photo, say) has taken its place in the meantime.
      onError: () => {
        if (!box.firstChild) box.append(none("Cover didn't load"));
      },
    });
    box.replaceChildren(img || none('No cover'));
    $('cover-remove').hidden = !img;
  }

  function coverStatus(text) {
    $('cover-status').textContent = text;
  }

  function detailsProblem(text) {
    $('details-error').textContent = text;
    $('details-error').hidden = !text;
  }

  function setSaving(on) {
    $('details-save').disabled = on;
    $('details-delete').disabled = on;
  }

  return {
    showView,
    focusHeading,
    renderShelf,
    setVersion,
    renderBook,
    showPage,
    searchMessage,
    searchBusy,
    searchResults,
    searchFailed,
    searchOffline,
    resetSearch,
    searchInput,
    fillDetails,
    readDetails,
    showErrors,
    showCoverPreview,
    coverStatus,
    detailsProblem,
    setSaving,
  };
})();
