/*
 * Field Log application.
 *
 * This file handles GPS capture, the screen, log display, export, and upload.
 * database.js provides the FieldLogDB functions used for local storage.
 */
(function () {
    "use strict";

    var $ = function (id) {
        return document.getElementById(id);
    };

    var rows = [];
    var uploadInProgress = false;
    var settingsStorageKey = "field-log-upload-settings";

    // Display a status or error message above the main controls.
    function message(text, isError) {
        $("message").textContent = text;
        $("message").className = isError ? "error" : "";
    }

    function uploadMessage(text, isError) {
        $("upload-message").textContent = text;
        $("upload-message").className = isError ? "error" : "";
    }

    function formatDate(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    function formatCoordinates(entry) {
        return entry.latitude.toFixed(6) + ", " +
            entry.longitude.toFixed(6);
    }

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

    function locationError(error) {
        setBusy(false);

        var messages = {
            1: "Location permission denied. Allow location access in browser settings.",
            2: "Your phone could not determine a position. Try a clearer view of the sky.",
            3: "GPS timed out. Try again; a cold GPS start can take a while."
        };

        message(messages[error.code] || ("GPS error: " + error.message), true);
    }

    function databaseError(error) {
        message("Local storage error: " + error.message, true);
    }

    // Count entries that have not yet received a successful server response.
    function countPending(entries) {
        return entries.filter(function (entry) {
            return !entry.uploadedAt;
        }).length;
    }

    function updateUploadButton(entries) {
        var pending = countPending(entries);

        if (uploadInProgress) {
            return;
        }

        $("upload").disabled = pending === 0;
        $("upload").textContent = pending
            ? "Upload " + pending + " saved " +
                (pending === 1 ? "position" : "positions")
            : "All positions uploaded";
    }

    // Read all saved entries and rebuild the log display.
    function refreshLog() {
        FieldLogDB.all()
            .then(function (entries) {
                rows = entries;
                updateCount(entries.length);
                updateUploadButton(entries);

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

                    var uploadStatus = document.createElement("div");
                    uploadStatus.className = entry.uploadedAt
                        ? "entry-uploaded"
                        : "entry-pending";
                    uploadStatus.textContent = entry.uploadedAt
                        ? "Uploaded to server"
                        : "Waiting to upload";

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
                    card.append(
                        date, coordinates, caption, accuracy,
                        uploadStatus, actions
                    );
                    container.append(card);
                });
            })
            .catch(databaseError);
    }

    // Capture the current GPS position and save it locally first.
    $("log").addEventListener("click", function () {
        if (!navigator.geolocation) {
            message("This browser does not support geolocation.", true);
            return;
        }

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
                        updateUploadButton(entries);
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

                downloadFile(
                    makeFilename("csv"),
                    "\uFEFF" + lines.join("\r\n"),
                    "text/csv"
                );
            })
            .catch(databaseError);
    };

    // Load and save the two user-configurable upload settings.
    function loadUploadSettings() {
        var settings;

        try {
            settings = JSON.parse(localStorage.getItem(settingsStorageKey) || "{}");
        } catch (error) {
            settings = {};
        }

        $("upload-endpoint").value = settings.endpoint || "";
        $("device-id").value = settings.deviceId || "";
    }

    function getUploadSettings() {
        return {
            endpoint: $("upload-endpoint").value.trim(),
            deviceId: $("device-id").value.trim()
        };
    }

    $("save-settings").onclick = function () {
        var settings = getUploadSettings();

        if (!settings.endpoint || !settings.deviceId) {
            uploadMessage("Enter both the server endpoint and device ID.", true);
            return;
        }

        try {
            // Validate the URL now, so an invalid value is caught before upload.
            new URL(settings.endpoint, window.location.href);
            localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
            uploadMessage("Upload settings saved on this phone.");
        } catch (error) {
            uploadMessage("The endpoint URL is not valid.", true);
        }
    };

    // Send one entry to server.php using its query-string interface.
    // A successful HTTP 2xx response is treated as the server's acknowledgment.
    function sendEntry(entry, settings) {
        return new Promise(function (resolve, reject) {
            var endpoint;

            try {
                endpoint = new URL(settings.endpoint, window.location.href);
            } catch (error) {
                reject(new Error("The server endpoint URL is not valid."));
                return;
            }

            // The backend expects four asterisk-delimited fields in this order.
            var data = [
                entry.latitude,
                entry.longitude,
                entry.timestamp,
                entry.caption || ""
            ].join("*");

            endpoint.searchParams.set("data", data);
            endpoint.searchParams.set("device_id", settings.deviceId);

            var request = new XMLHttpRequest();
            request.open("GET", endpoint.toString(), true);
            request.timeout = 30000;
            request.setRequestHeader("Accept", "application/json, text/plain, */*");

            request.onload = function () {
                if (request.status >= 200 && request.status < 300) {
                    resolve(request.responseText);
                } else {
                    reject(new Error(
                        "Server returned HTTP " + request.status +
                        (request.responseText ? ": " + request.responseText : "")
                    ));
                }
            };

            request.onerror = function () {
                reject(new Error(
                    "Network error. Check the connection and server CORS settings."
                ));
            };

            request.ontimeout = function () {
                reject(new Error("The server request timed out."));
            };

            request.send();
        });
    }

    // Upload pending entries one at a time. Mark each only after its own
    // successful response, so an interrupted batch can safely be retried.
    $("upload").onclick = function () {
        var settings = getUploadSettings();

        if (!settings.endpoint || !settings.deviceId) {
            uploadMessage("Open Upload settings and enter the endpoint and device ID.", true);
            $("settings").open = true;
            return;
        }

        if (!navigator.onLine) {
            uploadMessage("This phone appears to be offline. Your entries are safe here.", true);
            return;
        }

        try {
            localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
        } catch (error) {
            uploadMessage("Could not save the upload settings: " + error.message, true);
            return;
        }

        FieldLogDB.all()
            .then(function (entries) {
                var pending = entries.filter(function (entry) {
                    return !entry.uploadedAt;
                });

                if (!pending.length) {
                    uploadMessage("There are no entries waiting to upload.");
                    updateUploadButton(entries);
                    return;
                }

                uploadInProgress = true;
                $("upload").disabled = true;
                $("upload").textContent = "Uploading…";

                var completed = 0;
                var chain = Promise.resolve();

                pending.forEach(function (entry) {
                    chain = chain.then(function () {
                        uploadMessage(
                            "Uploading position " + (completed + 1) +
                            " of " + pending.length + "…"
                        );

                        return sendEntry(entry, settings).then(function () {
                            entry.uploadedAt = new Date().toISOString();
                            return FieldLogDB.update(entry);
                        }).then(function () {
                            completed++;
                        });
                    });
                });

                chain.then(function () {
                    uploadInProgress = false;
                    uploadMessage(
                        "Uploaded " + completed + " " +
                        (completed === 1 ? "position" : "positions") +
                        ". Local copies have been kept."
                    );
                    refreshLog();
                }).catch(function (error) {
                    uploadInProgress = false;
                    uploadMessage(
                        "Uploaded " + completed + " of " + pending.length +
                        ". The remaining entries are still waiting. " + error.message,
                        true
                    );
                    refreshLog();
                });
            })
            .catch(function (error) {
                uploadInProgress = false;
                uploadMessage("Could not read the local log: " + error.message, true);
                refreshLog();
            });
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

    function updateConnectionStatus() {
        $("status").textContent = navigator.onLine
            ? "Ready · online"
            : "Ready · offline";
    }

    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);
    updateConnectionStatus();

    // Register the service worker so the app shell remains available offline.
    if ("serviceWorker" in navigator && isSecureContext) {
        addEventListener("load", function () {
            navigator.serviceWorker.register("./service-worker.js")
                .catch(console.warn);
        });
    }

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

    // Load settings and the saved count / most recent entry at startup.
    loadUploadSettings();

    FieldLogDB.all()
        .then(function (entries) {
            rows = entries;
            updateCount(entries.length);
            updateUploadButton(entries);

            if (entries.length) {
                showLastEntry(entries[0]);
            }
        })
        .catch(databaseError);
})();
