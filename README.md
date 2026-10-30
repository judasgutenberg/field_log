FIELD LOG v1
============

This is a static, offline-first Progressive Web App. It needs no PHP, database
server, npm, framework, or third-party library.

INSTALLATION
1. Copy the entire fieldlog folder to any HTTPS web host, preserving filenames.
   Example: https://your-domain.example/fieldlog/
2. Visit that HTTPS address in Chrome on your Android phone while online.
3. Allow location permission.
4. Wait for the app to load, then use Chrome's menu > Install app (or Add to
   Home screen).
5. Launch it from the new home-screen icon. After its first successful load,
   the cached app shell is available offline.

HTTPS IS REQUIRED
Browsers require HTTPS for geolocation and service workers. Opening index.html
directly from a file manager will not work properly.

FEATURES
- Button-triggered GPS capture, timestamp, accuracy, optional caption.
- Entries stored locally in IndexedDB.
- In-app log viewer and per-entry deletion.
- Export plain text or CSV.
- Offline app shell via service worker.
- No automatic uploads or tracking.

DATA
The log stays in this browser on this device. Export TXT or CSV periodically.
Clearing browser site data, uninstalling/resetting the browser, or device cleanup
can erase local data. Persistent storage is requested but not guaranteed.

GPS
Satellite GPS does not require cellular service. Initial fixes can take longer
after the phone has been off or when the sky view is obstructed. The phone may
also use Wi-Fi or other signals when available. The reported accuracy is an
estimate, not a guarantee.

UPDATING
When you modify the app files, change CACHE in service-worker.js (for example,
field-log-v2) so the browser installs a fresh cached version. Revisit online.

FILES
index.html, style.css, app.js, database.js, service-worker.js, manifest.json,
icon-192.png, icon-512.png.
