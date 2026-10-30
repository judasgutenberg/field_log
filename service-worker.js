/*
 * Service worker for offline use.
 *
 * The first successful visit downloads the app files into a browser cache.
 * Later visits can load those files without a network connection.
 */
var CACHE_NAME = "field-log-v1";

var APP_FILES = [
    "./",
    "./index.html",
    "./style.css",
    "./database.js",
    "./app.js",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png"
];

// Install: cache the app shell, then activate this service worker.
self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function (cache) {
                return cache.addAll(APP_FILES);
            })
            .then(function () {
                return self.skipWaiting();
            })
    );
});

// Activate: remove older Field Log caches and take control of open pages.
self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (cacheNames) {
                return Promise.all(
                    cacheNames.map(function (cacheName) {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(function () {
                return self.clients.claim();
            })
    );
});

// Fetch: use a cached file when possible; otherwise fetch and cache it.
self.addEventListener("fetch", function (event) {
    if (event.request.method !== "GET") {
        return;
    }

    var requestUrl = new URL(event.request.url);

    // Do not intercept requests to other websites.
    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(function (cachedResponse) {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then(function (response) {
                if (
                    response &&
                    response.status === 200 &&
                    response.type === "basic"
                ) {
                    var responseCopy = response.clone();

                    caches.open(CACHE_NAME).then(function (cache) {
                        cache.put(event.request, responseCopy);
                    });
                }

                return response;
            });
        })
    );
});
