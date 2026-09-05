console.log("Background service worker running.");

let sentInvitationsTabId = null;

/* =====================================================
   TAB HELPER FUNCTIONS
===================================================== */

function safeRemoveTab(tabId) {
    if (!tabId) return;
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
            console.log(`Tab ${tabId} already closed or missing.`);
            return;
        }
        chrome.tabs.remove(tabId, () => {
            if (chrome.runtime.lastError) {
                console.log(`Could not remove tab ${tabId}:`, chrome.runtime.lastError.message);
            }
        });
    });
}

function safeUpdateTab(tabId, updateProperties, fallbackCallback) {
    chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
            if (fallbackCallback) fallbackCallback();
            return;
        }
        chrome.tabs.update(tabId, updateProperties, () => {
            if (chrome.runtime.lastError && fallbackCallback) {
                fallbackCallback();
            }
        });
    });
}

function getGoogleToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError || !token) {
                reject(new Error(chrome.runtime.lastError?.message || "Auth failed"));
                return;
            }
            resolve(token);
        });
    });
}

/* =====================================================
   MESSAGE HANDLERS
===================================================== */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "FETCH_SHEET_DATA") {
        fetchSheetData()
            .then(data => sendResponse({ success: true, data: data }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (message.type === "MARK_ACTION_DONE") {
        markActionDone(message.rowNumber, message.currentStage)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (message.type === "MARK_REPLIED") {
        updateRowStatus(message.rowNumber, "Reply Received")
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (message.type === "AUTO_DETECT_REPLY") {
        handleAutoDetectReply(message.linkedinUrl);
        return true;
    }

    if (message.type === "LINKEDIN_DATA") {
        saveLinkedInDataToSheet(message.data || [], sender.tab?.id)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (message.type === "CONNECTION_CHECK_RESULTS") {
        updateConnectionCheckResults(message.data || [])
            .then(() => {
                chrome.storage.local.set({ syncInProgress: false });
                sendResponse({ success: true });

                if (sender.tab?.id) {
                    safeRemoveTab(sender.tab.id);
                }
            })
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
});

/* =====================================================
   GOOGLE SHEETS OPERATIONS
===================================================== */

async function fetchSheetData() {
    const storage = await chrome.storage.local.get(["spreadsheetId"]);
    if (!storage.spreadsheetId) throw new Error("No Google Sheet connected.");

    const token = await getGoogleToken();
    const range = "Sheet1!A2:J";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${storage.spreadsheetId}/values/${encodeURIComponent(range)}`;

    const res = await fetch(url, { headers: { "Authorization": `Bearer ${token}` } });
    const data = await res.json();
    const rows = data.values || [];

    return rows.map((row, idx) => ({
        rowNumber: idx + 2,
        name: row[0] || "",
        linkedinUrl: row[1] || "",
        dateAdded: row[2] || "",
        status: row[3] || "Pending",
        invitationNote: row[4] || "",
        lastContacted: row[5] || "",
        followUpDate: row[6] || "",
        notes: row[7] || "",
        lastUpdated: row[8] || "",
        stage: row[9] || "0"
    }));
}

async function markActionDone(rowNumber, currentStage) {
    const storage = await chrome.storage.local.get(["spreadsheetId"]);
    const token = await getGoogleToken();

    const nextStage = currentStage + 1;
    const today = new Date();
    const todayStr = today.toLocaleDateString("en-IN");

    const future = new Date();
    future.setDate(today.getDate() + 3);
    const futureStr = future.toLocaleDateString("en-IN");

    const isCompleted = nextStage >= 4;
    const newStatus = isCompleted ? "Completed" : "Accepted";

    const range = `Sheet1!D${rowNumber}:J${rowNumber}`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${storage.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

    await fetch(url, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            values: [[newStatus, "", todayStr, futureStr, "", todayStr, nextStage.toString()]]
        })
    });
}

async function updateRowStatus(rowNumber, newStatus) {
    const storage = await chrome.storage.local.get(["spreadsheetId"]);
    const token = await getGoogleToken();
    const todayStr = new Date().toLocaleDateString("en-IN");

    const statusUrl = `https://sheets.googleapis.com/v4/spreadsheets/${storage.spreadsheetId}/values/Sheet1!D${rowNumber}?valueInputOption=RAW`;
    await fetch(statusUrl, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[newStatus]] })
    });

    const updatedUrl = `https://sheets.googleapis.com/v4/spreadsheets/${storage.spreadsheetId}/values/Sheet1!I${rowNumber}?valueInputOption=RAW`;
    await fetch(updatedUrl, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[todayStr]] })
    });
}

async function handleAutoDetectReply(linkedinUrl) {
    const rows = await fetchSheetData();
    const match = rows.find(r => r.linkedinUrl.toLowerCase() === linkedinUrl.toLowerCase());
    if (match && match.status !== "Reply Received") {
        await updateRowStatus(match.rowNumber, "Reply Received");
        console.log(`Auto-marked ${match.name} as Reply Received.`);
    }
}

async function saveLinkedInDataToSheet(invitations, tabId = null) {
    if (!invitations) return;
    const storage = await chrome.storage.local.get(["spreadsheetId"]);
    if (!storage.spreadsheetId) return;

    const token = await getGoogleToken();
    const existingRange = "Sheet1!B2:B";
    const existingUrl = `https://sheets.googleapis.com/v4/spreadsheets/${storage.spreadsheetId}/values/${encodeURIComponent(existingRange)}`;

    const res = await fetch(existingUrl, { headers: { "Authorization": `Bearer ${token}` } });
    const data = await res.json();
    const existingUrls = (data.values || []).flat().filter(Boolean);

    // Save new sent invitations to sheet
    const newInvitations = invitations.filter(inv => !existingUrls.includes(inv.linkedinUrl));
    if (newInvitations.length > 0) {
        const today = new Date().toLocaleDateString("en-IN");
        const rows = newInvitations.map(inv => [
            inv.name || "", inv.linkedinUrl || "", today, "Pending", inv.invitationNote || "", "", "", "", today, "0"
        ]);

        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${storage.spreadsheetId}/values/Sheet1!A:J:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
        await fetch(appendUrl, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ values: rows })
        });
    }

    // Pass tabId so we redirect the SAME tab
    await triggerConnectionsCheck(invitations.map(i => i.linkedinUrl), tabId);
}

async function triggerConnectionsCheck(currentlySentUrls = [], tabId = null) {
    try {
        const rows = await fetchSheetData();
        
        // Strict URL canonicalization helper
        const cleanUrl = (u) => {
            if (!u) return "";
            return u.toLowerCase()
                .replace(/^https?:\/\//, "")
                .replace(/^www\./, "")
                .split('?')[0]
                .split('#')[0]
                .replace(/\/$/, "");
        };

        const normalizedSentList = currentlySentUrls.map(cleanUrl);

        // Find Pending rows from Google Sheet that are strictly NO LONGER in the Sent list
        const disappearedRows = rows.filter(r => {
            if (r.status !== "Pending") return false;
            const normalizedSheetUrl = cleanUrl(r.linkedinUrl);
            return !normalizedSentList.includes(normalizedSheetUrl);
        });

        if (disappearedRows.length === 0) {
            console.log("No disappeared profiles found. Connections check skipped.");
            if (tabId) safeRemoveTab(tabId);
            return;
        }

        console.log(`Targeting only ${disappearedRows.length} disappeared profile(s) for connection search.`);

        await chrome.storage.local.set({ pendingConnectionChecks: disappearedRows });

        const targetUrl = "https://www.linkedin.com/mynetwork/invite-connect/connections/";

        if (tabId) {
            safeUpdateTab(tabId, { url: targetUrl }, () => {
                chrome.tabs.create({ url: targetUrl, active: true });
            });
        } else {
            chrome.tabs.create({ url: targetUrl, active: true });
        }
    } catch (err) {
        console.error("Error setting up connection check:", err);
    }
}

async function updateConnectionCheckResults(results) {
    if (!results || results.length === 0) return;
    const storage = await chrome.storage.local.get(["spreadsheetId"]);
    if (!storage.spreadsheetId) return;

    const token = await getGoogleToken();
    const today = new Date().toLocaleDateString("en-IN");

    for (const res of results) {
        if (res.error || !res.connected) continue;

        // Target range D to J for the accepted profile
        const range = `Sheet1!D${res.rowNumber}:J${res.rowNumber}`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${storage.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

        await fetch(url, {
            method: "PUT",
            headers: { 
                "Authorization": `Bearer ${token}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({
                values: [["Accepted", "", "", today, "", today, "0"]]
            })
        });
        console.log(`Updated row ${res.rowNumber} (${res.name}) to Accepted.`);
    }
}

/* =====================================================
   SYNC ENGINE & NOTIFICATION CLICK LISTENER
===================================================== */

function startFullSync() {
    console.log("Starting automated sync routine...");
    
    chrome.storage.local.set({ syncInProgress: true }, () => {
        chrome.tabs.create({
            url: "https://www.linkedin.com/mynetwork/invitation-manager/sent/",
            active: true
        }, (tab) => {
            sentInvitationsTabId = tab.id;
        });
    });
}

function requestSyncPermission() {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#0A66C2"; // LinkedIn Blue
    ctx.fillRect(0, 0, 1, 1);

    canvas.convertToBlob({ type: "image/png" }).then((blob) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
            const dataUrl = reader.result;

            chrome.notifications.create("sync_request", {
                type: "basic",
                iconUrl: dataUrl,
                title: "LinkedIn Follow-Up Tracker",
                message: "Ready to sync latest LinkedIn invitations and accepted connections?",
                buttons: [{ title: "Start Sync Now" }, { title: "Ask Again in 30 Mins" }],
                requireInteraction: true
            });
        };
    });
}

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (notificationId === "sync_request") {
        if (buttonIndex === 0) {
            startFullSync();
        }
        chrome.notifications.clear(notificationId);
    }
});

function setupPeriodicSync() {
    chrome.alarms.get("linkedinDataSync", (alarm) => {
        if (!alarm) {
            chrome.alarms.create("linkedinDataSync", { delayInMinutes: 30, periodInMinutes: 30 });
        }
    });
}

chrome.runtime.onInstalled.addListener(() => {
    requestSyncPermission();
    setupPeriodicSync();
});

// Re-registers alarm dynamically whenever background worker awakes
setupPeriodicSync();

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "linkedinDataSync") requestSyncPermission();
});