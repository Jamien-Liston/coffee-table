// The single source of truth for the app's version. Semver.
//
// Loaded two ways from this one file, so the number shown in the app and the
// service worker's cache name can't drift apart:
//   - index.html loads it as a plain script, before everything else
//   - service-worker.js pulls it in with importScripts
// Hence `self` rather than `window`: it resolves in both places.
//
// Bump this on any change to index.html, css/, js/, the manifest or icons.
// It is the whole release ritual: the cache name follows automatically.
self.APP_VERSION = '0.1.1';
