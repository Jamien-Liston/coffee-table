// Checks the rules in js/logic.js. Run from the repo root:
//   node test/logic.test.js
// Plain Node, no packages. Exits with an error if anything fails.

const assert = require('node:assert/strict');
const Logic = require('../js/logic.js');

let failures = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`ok    ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`FAIL  ${name}\n      ${err.message.split('\n').join('\n      ')}`);
  }
}

// ---- Random -----------------------------------------------------------------

test('a 10–12 range gives only 10, 11 and 12, each about a third of the time', () => {
  const rolls = 100000;
  const counts = new Map();
  for (let i = 0; i < rolls; i += 1) {
    const page = Logic.randomPage(10, 12);
    counts.set(page, (counts.get(page) || 0) + 1);
  }
  assert.deepEqual([...counts.keys()].sort((a, b) => a - b), [10, 11, 12]);
  for (const [page, count] of counts) {
    const share = count / rolls;
    assert.ok(Math.abs(share - 1 / 3) < 0.01, `page ${page} came up ${(share * 100).toFixed(2)}%`);
  }
});

test('both ends of a range can come up, and a one-page range always gives that page', () => {
  assert.equal(Logic.randomPage(10, 12, () => 0), 10);
  assert.equal(Logic.randomPage(10, 12, () => 0.9999999999), 12);
  for (let i = 0; i < 1000; i += 1) assert.equal(Logic.randomPage(7, 7), 7);
});

test('a long range covers every page and nothing outside it', () => {
  const seen = new Set();
  for (let i = 0; i < 200000; i += 1) {
    const page = Logic.randomPage(9, 296);
    assert.ok(page >= 9 && page <= 296, `out of range: ${page}`);
    seen.add(page);
  }
  assert.equal(seen.size, 296 - 9 + 1);
});

test('surprise me can land on every book, about equally often', () => {
  const books = ['a', 'b', 'c', 'd', 'e'];
  const picks = 50000;
  const counts = new Map();
  for (let i = 0; i < picks; i += 1) {
    const book = Logic.pickRandom(books);
    counts.set(book, (counts.get(book) || 0) + 1);
  }
  assert.equal(counts.size, books.length);
  for (const [book, count] of counts) {
    assert.ok(Math.abs(count / picks - 1 / books.length) < 0.015, `${book}: ${count}`);
  }
});

// ---- Form checks ------------------------------------------------------------

const good = { title: 'Humans of New York', author: '', pageCount: '', startPage: '9', endPage: '296' };

test('a complete form passes and comes back cleaned', () => {
  const check = Logic.validateBook({ ...good, title: '  Humans   of New York ', pageCount: '304' });
  assert.equal(check.ok, true);
  assert.deepEqual(check.value, {
    title: 'Humans of New York',
    author: '',
    pageCount: 304,
    startPage: 9,
    endPage: 296,
  });
});

test('a blank page count is fine and stored as empty', () => {
  const check = Logic.validateBook(good);
  assert.equal(check.ok, true);
  assert.equal(check.value.pageCount, null);
});

test('the first and last page can be the same', () => {
  assert.equal(Logic.validateBook({ ...good, startPage: '12', endPage: '12' }).ok, true);
});

test('form checks catch each problem with a plain message', () => {
  const cases = [
    [{ title: '   ' }, 'title', 'Add a title.'],
    [{ title: 'x'.repeat(201) }, 'title', 'Keep the title to 200 characters or fewer.'],
    [{ author: 'y'.repeat(201) }, 'author', 'Keep the author to 200 characters or fewer.'],
    [{ startPage: '' }, 'startPage', 'Add the first content page.'],
    [{ endPage: ' ' }, 'endPage', 'Add the last content page.'],
    [{ startPage: '0' }, 'startPage', 'Use a whole number from 1 to 99,999.'],
    [{ startPage: '2.5' }, 'startPage', 'Use a whole number from 1 to 99,999.'],
    [{ startPage: '-3' }, 'startPage', 'Use a whole number from 1 to 99,999.'],
    [{ endPage: '100000' }, 'endPage', 'Use a whole number from 1 to 99,999.'],
    [{ endPage: 'ten' }, 'endPage', 'Use a whole number from 1 to 99,999.'],
    [{ startPage: '20', endPage: '10' }, 'endPage', "The last page can't be before the first."],
    [{ pageCount: 'lots' }, 'pageCount', 'Use a whole number, or leave it blank.'],
    [{ pageCount: '0' }, 'pageCount', 'Use a whole number, or leave it blank.'],
  ];
  for (const [change, field, message] of cases) {
    const check = Logic.validateBook({ ...good, ...change });
    assert.equal(check.ok, false, `${JSON.stringify(change)} should fail`);
    assert.equal(check.value, null);
    assert.equal(check.errors[field], message, `${JSON.stringify(change)}`);
  }
});

test('stored ranges are checked before rolling', () => {
  assert.equal(Logic.hasValidRange({ startPage: 10, endPage: 12 }), true);
  assert.equal(Logic.hasValidRange({ startPage: 12, endPage: 10 }), false);
  assert.equal(Logic.hasValidRange({ startPage: 0, endPage: 10 }), false);
  assert.equal(Logic.hasValidRange({ startPage: '1', endPage: 10 }), false);
  assert.equal(Logic.hasValidRange({}), false);
});

// ---- Title tidy -------------------------------------------------------------

function checkTitles(cases) {
  for (const [typed, tidy] of cases) {
    assert.equal(Logic.titleCase(typed), tidy, `"${typed}"`);
  }
}

test('titles: every word capitalized, small words lowercase', () => {
  checkTitles([
    ['humans of new york', 'Humans of New York'],
    ['Humans Of New York', 'Humans of New York'],
    ['the history of an idea', 'The History of an Idea'],
    ['mice and men', 'Mice and Men'],
    ['art for the people', 'Art for the People'],
    ['paris on foot in the rain', 'Paris on Foot in the Rain'],
    ['places to go', 'Places to Go'],
    ['now or never', 'Now or Never'],
    ['paris by night at home', 'Paris by Night at Home'],
  ]);
});

test('titles: small words capitalized when first, last or straight after a colon', () => {
  checkTitles([
    ['the art of the plant', 'The Art of the Plant'],
    ['of mice and men', 'Of Mice and Men'],
    ['worth fighting for', 'Worth Fighting For'],
    ['star wars: the art of the film', 'Star Wars: The Art of the Film'],
    ['2001: a space odyssey', '2001: A Space Odyssey'],
    ['paris : a guide', 'Paris : A Guide'],
    ['the', 'The'],
  ]);
});

test('titles: a word with a capital after its first letter is left alone', () => {
  checkTitles([
    ['the MoMA collection', 'The MoMA Collection'],
    ['iPhone photography', 'iPhone Photography'],
    ['design in the UK', 'Design in the UK'],
    ['THE UK AT NIGHT', 'THE UK AT NIGHT'],
    ["the O'Keeffe museum", "The O'Keeffe Museum"],
  ]);
});

test('titles: each part of a hyphenated word counts, and the first is always capitalized', () => {
  checkTitles([
    ['mid-century modern', 'Mid-Century Modern'],
    ['Mid-century houses today', 'Mid-Century Houses Today'],
    ['step-by-step', 'Step-by-Step'],
    ['black-and-white photography', 'Black-and-White Photography'],
    ['the a-z of design', 'The A-Z of Design'],
    ['the in-between', 'The In-Between'],
    ['built-in', 'Built-In'],
    ['iPhone-ready homes', 'iPhone-Ready Homes'],
  ]);
});

test('titles: only first letters change; numbers, spacing and punctuation stay', () => {
  checkTitles([
    ['"the art of war"', '"The Art of War"'],
    ['21st-century design', '21st-Century Design'],
    ['1000 chairs', '1000 Chairs'],
    ['café ōsaka', 'Café Ōsaka'],
    ['rock & roll', 'Rock & Roll'],
    ["hitchcock's films", "Hitchcock's Films"],
    ['  spaced   out  ', '  Spaced   Out  '],
    ['', ''],
  ]);
});

// ---- Shelf order ------------------------------------------------------------

test('the shelf sorts by title, ignoring case and a leading The, A or An', () => {
  const books = [
    { title: 'The Zoo', addedAt: '1' },
    { title: 'apples', addedAt: '2' },
    { title: 'A Map of Mars', addedAt: '3' },
    { title: 'An Owl', addedAt: '4' },
    { title: 'Book 10', addedAt: '5' },
    { title: 'Book 9', addedAt: '6' },
  ];
  assert.deepEqual(Logic.sortBooks(books).map((b) => b.title),
    ['apples', 'Book 9', 'Book 10', 'A Map of Mars', 'An Owl', 'The Zoo']);
  assert.equal(books[0].title, 'The Zoo', 'sorting must not reorder the original list');
});

// ---- Covers -----------------------------------------------------------------

test('only https links and the app’s own JPEG photos are used as covers', () => {
  assert.equal(Logic.safeCover('https://covers.openlibrary.org/b/id/1-L.jpg'),
    'https://covers.openlibrary.org/b/id/1-L.jpg');
  assert.equal(Logic.safeCover('data:image/jpeg;base64,/9j/4AAQSkZJRg=='),
    'data:image/jpeg;base64,/9j/4AAQSkZJRg==');
  for (const bad of [
    'http://books.google.com/x.jpg',
    'javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/jpeg;base64,abc"onerror="x',
    '//evil.example/x.jpg',
    'not a url',
    '',
    null,
    42,
  ]) {
    assert.equal(Logic.safeCover(bad), '', `should refuse ${String(bad)}`);
  }
});

// ---- Search results ---------------------------------------------------------

const googleSample = {
  items: [
    {
      volumeInfo: {
        title: 'Humans of New York',
        subtitle: 'Stories',
        authors: ['Brandon Stanton'],
        publishedDate: '2015-10-13',
        pageCount: 432,
        imageLinks: {
          smallThumbnail: 'http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=5&edge=curl&source=gbs_api',
          thumbnail: 'http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
        },
      },
    },
    { volumeInfo: { title: 'No Cover Here', printedPageCount: 120, pageCount: 128 } },
    { volumeInfo: { authors: ['Untitled Author'] } },
    { volumeInfo: { title: 'Odd Data', authors: 'not a list', pageCount: -4, publishedDate: 1999 } },
  ],
};

test('Google results: https covers, no page curl, the larger size, plain fields', () => {
  const [first, second, third] = Logic.fromGoogle(googleSample);
  assert.equal(first.title, 'Humans of New York');
  assert.equal(first.subtitle, 'Stories');
  assert.equal(first.author, 'Brandon Stanton');
  assert.equal(first.year, '2015');
  assert.equal(first.pageCount, 432);
  assert.equal(first.source, 'googlebooks');
  assert.equal(first.cover,
    'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=3&source=gbs_api');
  assert.equal(first.thumb,
    'https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=2&source=gbs_api');

  assert.equal(second.cover, '');
  assert.equal(second.pageCount, 120, 'prefers the printed page count');

  assert.equal(third.title, 'Odd Data', 'volumes without a title are dropped');
  assert.equal(third.author, '');
  assert.equal(third.pageCount, null);
  assert.equal(third.year, '');
});

test('Google results: an empty or odd response gives no matches', () => {
  assert.deepEqual(Logic.fromGoogle({}), []);
  assert.deepEqual(Logic.fromGoogle(null), []);
  assert.deepEqual(Logic.fromGoogle({ items: 'nope' }), []);
});

test('Open Library results: cover links built only from a real cover number', () => {
  const matches = Logic.fromOpenLibrary({
    docs: [
      {
        title: 'Humans Of New York',
        author_name: ['Brandon Stanton'],
        first_publish_year: 2013,
        number_of_pages_median: 428,
        cover_i: 8291452,
      },
      { title: 'Sneaky', cover_i: '1/../../x', author_name: ['A', 'B', 'C', 'D'] },
      { title: 'Negative', cover_i: -1 },
      { author_name: ['No Title'] },
    ],
  });
  assert.equal(matches.length, 3);
  const [first, second, third] = matches;
  assert.equal(first.cover, 'https://covers.openlibrary.org/b/id/8291452-L.jpg');
  assert.equal(first.thumb, 'https://covers.openlibrary.org/b/id/8291452-M.jpg');
  assert.equal(first.year, '2013');
  assert.equal(first.pageCount, 428);
  assert.equal(first.author, 'Brandon Stanton');
  assert.equal(first.source, 'openlibrary');
  assert.equal(second.cover, '');
  assert.equal(second.author, 'A, B, C', 'at most three authors');
  assert.equal(third.cover, '');
});

test('API text is cleaned and cut to 200 characters', () => {
  const [match] = Logic.fromOpenLibrary({ docs: [{ title: `  Long\n\ttitle ${'x'.repeat(300)}` }] });
  assert.ok(match.title.startsWith('Long title x'));
  assert.ok(match.title.length <= 200);
});

test('Google query: title words in the title, author words in the author', () => {
  assert.equal(Logic.googleQuery('Humans of New York', 'Brandon Stanton'),
    'intitle:Humans intitle:of intitle:New intitle:York inauthor:Brandon inauthor:Stanton');
  assert.equal(Logic.googleQuery('Star Wars: The "Art"', ''),
    'intitle:Star intitle:Wars intitle:The intitle:Art');
  assert.equal(Logic.googleQuery('Rock & Roll - Photographs', ''),
    'intitle:Rock intitle:Roll intitle:Photographs');
  assert.equal(Logic.googleQuery('Café Ōsaka 1970s', ''),
    'intitle:Café intitle:Ōsaka intitle:1970s');
  assert.equal(Logic.googleQuery("Hitchcock's Films", ''),
    "intitle:Hitchcock's intitle:Films");
});

test('a title with hyphens inside words can be searched again without them', () => {
  assert.equal(Logic.withoutHyphens('Mid-century houses today'), 'Midcentury houses today');
  assert.equal(Logic.withoutHyphens(' Step-by-step   guide '), 'Stepbystep guide');
  assert.equal(Logic.withoutHyphens('Jean‐Michel'), 'JeanMichel', 'a Unicode hyphen counts too');
  for (const none of ['Humans of New York', 'Rock - Roll', '-Mid-', 'Mid--century', '']) {
    assert.equal(Logic.withoutHyphens(none), '', `nothing to retry for "${none}"`);
  }
});

test('search links are built safely, with the key only when there is one', () => {
  const plain = new URL(Logic.googleSearchUrl('A & B?', 'C', ''));
  assert.equal(plain.origin, 'https://www.googleapis.com');
  assert.equal(plain.searchParams.get('q'), 'intitle:A intitle:B inauthor:C');
  assert.equal(plain.searchParams.has('key'), false);
  const keyed = new URL(Logic.googleSearchUrl('A', '', 'KEY123'));
  assert.equal(keyed.searchParams.get('key'), 'KEY123');

  const ol = new URL(Logic.openLibrarySearchUrl(' Humans  of New York ', ''));
  assert.equal(ol.origin, 'https://openlibrary.org');
  assert.equal(ol.searchParams.get('title'), 'Humans of New York');
  assert.equal(ol.searchParams.has('author'), false);
  const olAuthor = new URL(Logic.openLibrarySearchUrl('x', 'Brandon Stanton&limit=1000'));
  assert.equal(olAuthor.searchParams.get('author'), 'Brandon Stanton&limit=1000');
  assert.equal(olAuthor.searchParams.get('limit'), '20');
});

// ---- Routes -----------------------------------------------------------------

test('routes map to the right screen, and anything odd goes to the shelf', () => {
  assert.deepEqual(Logic.parseRoute(''), { view: 'shelf' });
  assert.deepEqual(Logic.parseRoute('#/'), { view: 'shelf' });
  assert.deepEqual(Logic.parseRoute('#/add'), { view: 'add' });
  assert.deepEqual(Logic.parseRoute('#/add/details'), { view: 'details', mode: 'new' });
  assert.deepEqual(Logic.parseRoute('#/book/abc-123'), { view: 'book', id: 'abc-123' });
  assert.deepEqual(Logic.parseRoute('#/book/abc-123/edit'),
    { view: 'details', mode: 'edit', id: 'abc-123' });
  assert.deepEqual(Logic.parseRoute('#/book/%E0%A4%A'), { view: 'shelf' });
  assert.deepEqual(Logic.parseRoute('#/nowhere'), { view: 'shelf' });
  assert.deepEqual(Logic.parseRoute('#/book/a/b/c'), { view: 'shelf' });
  const id = 'id with/slash';
  assert.deepEqual(Logic.parseRoute(Logic.bookRoute(id)), { view: 'book', id });
  assert.deepEqual(Logic.parseRoute(Logic.editRoute(id)), { view: 'details', mode: 'edit', id });
});

if (failures) {
  console.log(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nAll passed');
