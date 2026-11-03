FIELD LOG v1.1
==============

This is a static, offline-first Progressive Web App. GPS logging and local
storage work without a server-side application. An optional upload button sends
saved entries to your own PHP endpoint when the phone has a connection.

I built this app because Google Maps makes saving and sharing pins into a clunky process that obscures the latitude and longitude values, acting as if such numbers are too technical for the intended audience.  It also likes to display such data as degrees-minutes-seconds instead of decimal degrees, making it difficult to place these on a map later.  Also, Google Maps doesn't work very well when there is no cell signal.
INSTALLATION
1. Copy the entire fieldlog folder to an HTTPS web host, preserving filenames.
   Example: https://your-domain.example/fieldlog/
2. Visit that HTTPS address in Chrome on your Android phone while online.
3. Allow location permission.
4. Wait for the app to load, then use Chrome's menu > Install app (or Add to
   Home screen).
5. Launch it from the new home-screen icon. After its first successful load,
   the cached app shell is available offline.

HTTPS IS REQUIRED
Browsers require HTTPS for geolocation and service workers. Opening index.html
from a file manager will not work properly.  (This sucks, of course.  It's my one-off app and I should be able to do with it what I like.)

FEATURES
- Button-triggered GPS capture, timestamp, accuracy, and optional caption.
- Entries stored locally in IndexedDB.
- In-app log viewer and per-entry deletion.
- Export plain text or CSV.
- Optional manual upload of saved entries to a PHP endpoint.
- Offline app shell via service worker.
- No automatic uploads or background tracking, though that could change.

CONFIGURING UPLOAD
1. Open View log, then expand Upload settings.
2. Enter the full URL of your PHP endpoint, for example:
   https://your-domain.example/server.php
3. Enter the device_id that your backend expects for this FieldLog installation.
4. Press Save upload settings.
5. Press Upload saved positions when you want to send the pending entries.

For each entry, Field Log makes one GET request to the configured endpoint with
these query-string parameters:

    device_id=<configured device ID>
    data=<latitude>*<longitude>*<timestamp>*<caption>

The timestamp is sent in ISO 8601 UTC form, as stored by the app. URL encoding
is handled by the browser. A successful HTTP response (status 200-299) is
considered an acknowledgment. The PHP endpoint should return a non-2xx status
when it has not successfully saved the entry.

Entries are sent one at a time. After each successful response, that entry is
marked as uploaded in the local database. If a request fails, the upload stops;
entries not yet acknowledged remain pending for the next attempt. The local
records are never removed by uploading.

If the endpoint is on a different domain from the FieldLog app, the PHP server
must send an appropriate Access-Control-Allow-Origin response header allowing
the app's origin. Hosting the app and endpoint on the same origin avoids this
cross-origin requirement. The endpoint should use HTTPS.

The endpoint URL and device ID are stored in this browser's localStorage. They
are configuration, not secrets. Do not put passwords or private API keys in
these fields or in browser JavaScript.

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
The service worker cache name is field-log-v2. Change it again (for example, to
field-log-v3) whenever you make another update, so browsers fetch the new files.
Revisit the app online to receive the update.

FILES
index.html, style.css, app.js, database.js, service-worker.js, manifest.json,
icon-192.png, icon-512.png.
