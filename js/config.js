// Settings that are safe to publish. There's no build step, so GitHub Pages
// serves this file exactly as it is.
//
// GOOGLE_BOOKS_KEY: a browser key for the Google Books API. While it's empty,
// the app asks Google without a key (which currently always comes back
// "quota exceeded") and then falls back to Open Library.
//
// A key here is public by design, so restrict it in Google Cloud:
//   - Application restriction: Websites -> https://jamien-liston.github.io/*
//     (browsers send other sites only the origin, never the page path, so a
//     path-specific restriction would block every request)
//   - API restriction: Books API only
// Never put any other kind of key or secret in this file.
const CONFIG = {
  GOOGLE_BOOKS_KEY: 'AIzaSyCQ3duPMKO0oFWwHDk8hav1TE_EFMAzrso',
};
