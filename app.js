/*
 * Field Log application.
 *
 * This file handles the screen, GPS capture, log display, and export.
 * database.js provides the FieldLogDB functions used to store entries.
 */
(function () {
    "use strict";

    // Short helper for finding an element by its ID.
    var $ = function (id) {
        return document.getElementById(id);
    };

    var rows = [];

    // Display a status or error message above the main controls.
    function message(text, isError) {
        $("message").textContent = text;
        $("message").className = isError ? "error" : "";
    }

    function formatDate(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    function formatCoordinates(entry) {
        return entry.latitude.toFixed(6) + ", " +
            entry.longitude.toFixed(6);
    }

    // Keep the entry counts in the navigation and log screen up to date.
    function updateCount(number) {
        $("nav-count").textContent = number;
        $("count").textContent = number +
            (number === 1 ? " entry" : " entries");
    }

    function setBusy(isBusy, label) {
        $("log").disabled = isBusy;
        $("log-label").textContent = label ||
            (isBusy ? "GETTING GPS FIX…" : "LOG POSITION");
    }

    // Show the details of the most recently recorded position.
    function showLastEntry(entry) {
        $("last").hidden = false;
        $("last-details").innerHTML = "";

        var coordinates = document.createElement("div");
        coordinates.className = "coords";
        coordinates.textContent = formatCoordinates(entry);

        var details = document.createElement("div");
        details.className = "meta";
        details.textContent = formatDate(entry.timestamp) +
            " · accuracy ±" + Math.round(entry.accuracy) + " m";

        $("last-details").append(coordinates, details);
    }

    // Switch between the recording screen and the saved-entry list.
    function showScreen(which) {
        var showLog = which === "log";

        $("record").hidden = showLog;
        $("log-screen").hidden = !showLog;
        $("nav-record").classList.toggle("selected", !showLog);
        $("nav-log").classList.toggle("selected", showLog);

        if (showLog) {
            refreshLog();
        }
    }

    // Translate browser geolocation errors into useful messages.
    function locationError(error) {
        setBusy(false);

        var messages = {
            1: "Location permission denied. Allow location access in browser settings.",
            2: "Your phone could not determine a position. Try a clearer view of the sky.",
            3: "GPS timed out. Try again; a cold GPS start can take a while."
        };

        message(messages[error.code] || ("GPS error: " + error.message), true);
    }

    // Read all saved entries and rebuild the log display.
    function refreshLog() {
        FieldLogDB.all()
            .then(function (entries) {
                rows = entries;
                updateCount(entries.length);

                var container = $("entries");
                container.innerHTML = "";

                if (!entries.length) {
                    var empty = document.createElement("div");
                    empty.className = "empty";
                    empty.textContent = "No positions recorded yet.";
                    container.append(empty);
                    return;
                }

                entries.forEach(function (entry) {
                    var card = document.createElement("article");
                    card.className = "entry";

                    var date = document.createElement("div");
                    date.className = "entry-date";
                    date.textContent = formatDate(entry.timestamp);

                    var coordinates = document.createElement("div");
                    coordinates.className = "coords";
                    coordinates.textContent = formatCoordinates(entry);

                    var caption = document.createElement("div");
                    caption.className = "entry-caption";
                    caption.textContent = entry.caption || "(no caption)";

                    var accuracy = document.createElement("div");
                    accuracy.className = "accuracy";
                    accuracy.textContent = "GPS accuracy ±" +
                        Math.round(entry.accuracy) + " m";

                    var actions = document.createElement("div");
                    actions.className = "entry-actions";

                    var deleteButton = document.createElement("button");
                    deleteButton.textContent = "Delete entry";
                    deleteButton.addEventListener("click", function () {
                        if (confirm("Delete this entry?")) {
                            FieldLogDB.remove(entry.id)
                                .then(refreshLog)
                                .catch(databaseError);
                        }
                    });

                    actions.append(deleteButton);
                    card.append(date, coordinates, caption, accuracy, actions);
                    container.append(card);
                });
            })
            .catch(databaseError);
    }

    function databaseError(error) {
        message("Local storage error: " + error.message, true);
    }

    // Capture the current GPS position and save it as a new entry.
    $("log").addEventListener("click", function () {
        if (!navigator.geolocation) {
            message("This browser does not support geolocation.", true);
            return;
        }

        // Browsers require a secure (HTTPS) context for geolocation.
        if (!window.isSecureContext) {
            message("GPS requires HTTPS. Open the app at its HTTPS address.", true);
            return;
        }

        setBusy(true);
        message("Waiting for a GPS position. This can take up to 30 seconds…");

        navigator.geolocation.getCurrentPosition(
            function (position) {
                var entry = {
                    timestamp: new Date().toISOString(),
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    caption: $("caption").value.trim()
                };

                FieldLogDB.add(entry)
                    .then(function () {
                        $("caption").value = "";
                        showLastEntry(entry);
                        setBusy(false);
                        message("Position saved on this phone.");
                        return FieldLogDB.all();
                    })
                    .then(function (entries) {
                        rows = entries;
                        updateCount(entries.length);
                    })
                    .catch(function (error) {
                        setBusy(false);
                        message(
                            "Position obtained, but saving failed: " + error.message,
                            true
                        );
                    });
            },
            locationError,
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 0
            }
        );
    });

    // Create a downloadable file from text or CSV data.
    function downloadFile(filename, data, contentType) {
        var blob = new Blob([data], {
            type: contentType + ";charset=utf-8"
        });

        var url = URL.createObjectURL(blob);
        var link = document.createElement("a");

        link.href = url;
        link.download = filename;
        document.body.append(link);
        link.click();
        link.remove();

        setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    // Give exported files a date-stamped name.
    function makeFilename(extension) {
        var today = new Date();

        return "field-log-" +
            today.getFullYear() + "-" +
            String(today.getMonth() + 1).padStart(2, "0") + "-" +
            String(today.getDate()).padStart(2, "0") +
            "." + extension;
    }

    // Export a readable plain-text version of the log.
    $("txt").onclick = function () {
        FieldLogDB.all()
            .then(function (entries) {
                var text = entries.reverse().map(function (entry) {
                    return formatDate(entry.timestamp) + "\n" +
                        formatCoordinates(entry) + "\n" +
                        "GPS accuracy: ±" + Math.round(entry.accuracy) + " m\n" +
                        (entry.caption || "") + "\n";
                }).join("\n");

                downloadFile(makeFilename("txt"), text, "text/plain");
            })
            .catch(databaseError);
    };

    // Quote CSV text fields, escaping any quotes inside the value.
    function csvCell(value) {
        return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
    }

    // Export a spreadsheet-friendly CSV version of the log.
    $("csv").onclick = function () {
        FieldLogDB.all()
            .then(function (entries) {
                var lines = [
                    "timestamp,latitude,longitude,accuracy_meters,caption"
                ];

                entries.reverse().forEach(function (entry) {
                    lines.push([
                        csvCell(entry.timestamp),
                        entry.latitude,
                        entry.longitude,
                        entry.accuracy,
                        csvCell(entry.caption)
                    ].join(","));
                });

                // UTF-8 BOM helps spreadsheet programs recognize the file.
                downloadFile(
                    makeFilename("csv"),
                    "\uFEFF" + lines.join("\r\n"),
                    "text/csv"
                );
            })
            .catch(databaseError);
    };

    // Delete the entire log, but only after an explicit confirmation.
    $("clear").onclick = function () {
        if (confirm("Permanently delete every entry? Export a copy first if you want to keep it.")) {
            FieldLogDB.clear()
                .then(function () {
                    rows = [];
                    refreshLog();
                    $("last").hidden = true;
                })
                .catch(databaseError);
        }
    };

    // Navigation buttons.
    $("nav-record").onclick = $("back").onclick = function () {
        showScreen("record");
    };

    $("nav-log").onclick = function () {
        showScreen("log");
    };

    // Show whether the phone currently has a network connection.
    function updateConnectionStatus() {
        $("status").textContent = navigator.onLine
            ? "Ready · online"
            : "Ready · offline";
    }

    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);
    updateConnectionStatus();

    // Register the service worker so the app can work offline after setup.
    if ("serviceWorker" in navigator && isSecureContext) {
        addEventListener("load", function () {
            navigator.serviceWorker.register("./service-worker.js")
                .catch(console.warn);
        });
    }

    // Ask the browser to preserve this site's local storage when possible.
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(function () {});
    }

    // Handle the optional Android/Chrome install prompt.
    var installPrompt = null;

    addEventListener("beforeinstallprompt", function (event) {
        event.preventDefault();
        installPrompt = event;
        $("install").hidden = false;
    });

    $("install").onclick = function () {
        if (installPrompt) {
            installPrompt.prompt();

            installPrompt.userChoice.then(function () {
                installPrompt = null;
                $("install").hidden = true;
            });
        }
    };

    // Load the saved count and most recent entry when the app starts.
    FieldLogDB.all()
        .then(function (entries) {
            rows = entries;
            updateCount(entries.length);

            if (entries.length) {
                showLastEntry(entries[0]);
            }
        })
        .catch(databaseError);
})();
