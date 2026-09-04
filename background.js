console.log("Background service started.");

let sheetSaveInProgress = false;
let pendingLinkedInData = [];
let sentInvitationsTabId = null;

function getGoogleToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken(
            {
                interactive: true
            },
            (token) => {
                if (chrome.runtime.lastError) {
                    reject(
                        new Error(chrome.runtime.lastError.message)
                    );
                    return;
                }

                if (!token) {
                    reject(
                        new Error("Google authentication failed.")
                    );
                    return;
                }

                resolve(token);
            }
        );
    });
}

// Create Google Sheet
async function createSpreadsheet(token) {
    const response = await fetch(
        "https://sheets.googleapis.com/v4/spreadsheets",
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                properties: {
                    title: "LinkedIn Follow-Up Tracker"
                }
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Could not create Google Sheet: ${errorText}`
        );
    }

    return await response.json();
}

// Initialize extension
async function initializeExtension() {
    console.log(
        "Initializing LinkedIn Follow-Up Tracker..."
    );

    const result = await chrome.storage.local.get([
        "spreadsheetId",
        "spreadsheetUrl"
    ]);

    // Sheet already exists
    if (result.spreadsheetId) {
        console.log(
            "Google Sheet already exists:",
            result.spreadsheetId
        );

        try {
            const token = await getGoogleToken();
            await addHeaders(
                token,
                result.spreadsheetId
            );
        } catch (error) {
            console.error(
                "Could not add headers:",
                error
            );
        }
        return;
    }

    console.log("No Google Sheet found.");
    console.log("Requesting Google authorization...");

    try {
        const token = await getGoogleToken();

        console.log("Google authorization successful.");
        console.log("Creating Google Sheet...");

        const spreadsheet = await createSpreadsheet(token);
        const spreadsheetId = spreadsheet.spreadsheetId;
        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

        console.log("Google Sheet created successfully!");
        console.log("Spreadsheet ID:", spreadsheetId);
        console.log("Spreadsheet URL:", spreadsheetUrl);

        // Save Sheet information
        await chrome.storage.local.set({
            spreadsheetId: spreadsheetId,
            spreadsheetUrl: spreadsheetUrl,
            googleSheetsConnected: true
        });

        console.log("Spreadsheet information saved.");
    } catch (error) {
        console.error(
            "Google Sheet setup failed:",
            error
        );
    }
}

async function addHeaders(token, spreadsheetId) {
    const headers = [
        "Name",
        "LinkedIn URL",
        "Date Added",
        "Status",
        "Invitation Note",
        "Last Contacted",
        "Follow-Up Date",
        "Notes",
        "Last Updated"
    ];

    const range = "Sheet1!A1:I1";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

    const response = await fetch(url, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            values: [headers]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Could not create headers: ${errorText}`
        );
    }

    console.log("Headers added successfully.");
}

async function saveLinkedInDataToSheet(invitations) {
    try {
        if (!invitations || invitations.length === 0) {
            console.log("No LinkedIn data to save.");
            return;
        }

        const result = await chrome.storage.local.get([
            "spreadsheetId"
        ]);

        if (!result.spreadsheetId) {
            console.error("No Google Sheet found.");
            return;
        }

        const token = await getGoogleToken();
        const spreadsheetId = result.spreadsheetId;

        /*
         * Get existing LinkedIn URLs from column B.
         * These are used to prevent duplicate rows.
         */
        const existingRange = "Sheet1!B2:B";
        const existingUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(existingRange)}`;

        const existingResponse = await fetch(
            existingUrl,
            {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (!existingResponse.ok) {
            throw new Error(
                "Could not read existing Google Sheet data."
            );
        }

        const existingData = await existingResponse.json();
        const existingUrls = (existingData.values || [])
            .flat()
            .filter(Boolean);

        /*
         * Remove profiles that already exist in the Google Sheet.
         */
        const newInvitations = invitations.filter(
            invitation => !existingUrls.includes(invitation.linkedinUrl)
        );

        if (newInvitations.length === 0) {
            console.log("All LinkedIn invitations already exist in the sheet.");
            return;
        }

        const today = new Date().toLocaleDateString("en-IN");

        /*
         * Convert LinkedIn profiles into Google Sheet rows.
         */
        const rows = newInvitations.map(invitation => [
            invitation.name || "",
            invitation.linkedinUrl || "",
            today,
            "Pending",
            invitation.invitationNote || "",
            "",
            "",
            "",
            today
        ]);

        /*
         * Append new rows to Google Sheet.
         */
        const appendRange = "Sheet1!A:I";
        const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

        const response = await fetch(
            appendUrl,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    values: rows
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `Could not save LinkedIn data: ${errorText}`
            );
        }

        console.log(
            `${rows.length} LinkedIn invitation(s) saved to Google Sheet.`
        );

    } catch (error) {
        console.error(
            "Error saving LinkedIn data to Google Sheet:",
            error
        );
        throw error;
    }
}

async function checkForDisappearedPendingInvitations(currentSentInvitations) {
    try {
        console.log("Checking for disappeared pending invitations...");

        const result = await chrome.storage.local.get([
            "spreadsheetId"
        ]);

        if (!result.spreadsheetId) {
            console.log(
                "No Google Sheet found. Cannot check invitation status."
            );
            return [];
        }

        const token = await getGoogleToken();
        const spreadsheetId = result.spreadsheetId;

        const range = "Sheet1!A2:D";
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(
                "Could not read existing invitation records."
            );
        }

        const data = await response.json();
        const rows = data.values || [];

        const currentSentUrls = new Set(
            (currentSentInvitations || [])
                .map(invitation => invitation.linkedinUrl)
                .filter(Boolean)
        );

        console.log("===== DISAPPEARANCE DEBUG =====");
        console.log(
            "Pending URLs from Sheet:",
            rows
                .filter(row => row[3] === "Pending")
                .map(row => ({ name: row[0], url: row[1] }))
        );
        console.log(
            "URLs collected from Sent Invitations:",
            currentSentInvitations.map(invitation => ({
                name: invitation.name,
                url: invitation.linkedinUrl
            }))
        );
        console.log("Current Sent URL Set:", Array.from(currentSentUrls));
        console.log("==============================");

        const disappearedInvitations = rows
            .map((row, index) => ({
                rowNumber: index + 2,
                name: row[0] || "",
                linkedinUrl: row[1] || "",
                dateAdded: row[2] || "",
                status: row[3] || ""
            }))
            .filter(row => (
                row.status === "Pending" &&
                row.linkedinUrl &&
                !currentSentUrls.has(row.linkedinUrl)
            ));

        console.log("=================================");
        console.log("Pending invitations in Sheet:", rows.filter(row => row[3] === "Pending").length);
        console.log("Current Sent Invitations:", currentSentUrls.size);
        console.log("Disappeared Pending invitations:", disappearedInvitations.length);
        console.log("Disappeared invitations:", disappearedInvitations);
        console.log("=================================");

        if (disappearedInvitations.length > 0) {
            await chrome.storage.local.set({
                pendingConnectionChecks: disappearedInvitations
            });

            console.log("Profiles saved for Connections check:", disappearedInvitations);

            if (sentInvitationsTabId !== null) {
                chrome.tabs.update(
                    sentInvitationsTabId,
                    {
                        url: "https://www.linkedin.com/mynetwork/invite-connect/connections/"
                    },
                    () => {
                        if (chrome.runtime.lastError) {
                            console.error(
                                "Could not navigate to Connections:",
                                chrome.runtime.lastError.message
                            );
                        } else {
                            console.log("Same LinkedIn tab navigating to Connections.");
                        }
                    }
                );
            } else {
                console.error("No Sent Invitations tab ID available.");
            }
        } else {
            // No connection checks required; safe to close the scraping tab immediately
            closeScraperTab();
        }

        return disappearedInvitations;

    } catch (error) {
        console.error("Error checking disappeared invitations:", error);
        closeScraperTab();
        return [];
    }
}

async function processPendingLinkedInData() {
    if (sheetSaveInProgress || pendingLinkedInData.length === 0) {
        return;
    }

    sheetSaveInProgress = true;
    const dataToSave = pendingLinkedInData;
    pendingLinkedInData = [];

    try {
        console.log("Processing pending LinkedIn data:", dataToSave.length);
        await saveLinkedInDataToSheet(dataToSave);
    } catch (error) {
        console.error("Failed to process pending LinkedIn data:", error);
        pendingLinkedInData = [...dataToSave, ...pendingLinkedInData];
    } finally {
        sheetSaveInProgress = false;
        if (pendingLinkedInData.length > 0) {
            processPendingLinkedInData();
        }
    }
}

async function updateConnectionCheckResults(results) {
    try {
        console.log("Updating Google Sheet with connection results:", results);

        if (!results || results.length === 0) {
            console.log("No connection results to update.");
            closeScraperTab();
            return;
        }

        const storage = await chrome.storage.local.get(["spreadsheetId"]);
        if (!storage.spreadsheetId) {
            throw new Error("No Google Sheet found.");
        }

        const token = await getGoogleToken();
        const spreadsheetId = storage.spreadsheetId;

        for (const result of results) {
            if (result.error) {
                console.warn("Skipping profile because connection check failed:", result.name);
                continue;
            }

            const status = result.connected ? "Accepted" : "Rejected";
            const today = new Date().toLocaleDateString("en-IN");

            const statusRange = `Sheet1!D${result.rowNumber}`;
            const statusUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(statusRange)}?valueInputOption=RAW`;

            await fetch(statusUrl, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ values: [[status]] })
            });

            const updatedRange = `Sheet1!I${result.rowNumber}`;
            const updatedUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(updatedRange)}?valueInputOption=RAW`;

            await fetch(updatedUrl, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ values: [[today]] })
            });

            console.log(`${result.name} → ${status}`);
        }

        await chrome.storage.local.remove("pendingConnectionChecks");
        console.log("Google Sheet connection statuses updated successfully.");

    } catch (error) {
        console.error("Error updating connection check results:", error);
    } finally {
        // Automatically close tab when connection check completes
        closeScraperTab();
    }
}

function closeScraperTab() {
    if (sentInvitationsTabId !== null) {
        chrome.tabs.remove(sentInvitationsTabId, () => {
            if (chrome.runtime.lastError) {
                console.log("Tab already closed or lost.");
            } else {
                console.log("Scraper tab closed automatically.");
            }
            sentInvitationsTabId = null;
        });
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "LINKEDIN_DATA") {
        console.log("Received LinkedIn data:", message.data);

        pendingLinkedInData = [
            ...pendingLinkedInData,
            ...(message.data || [])
        ];

        const uniqueData = new Map();
        pendingLinkedInData.forEach(item => {
            if (item.linkedinUrl) {
                uniqueData.set(item.linkedinUrl, item);
            }
        });

        pendingLinkedInData = Array.from(uniqueData.values());
        console.log("Pending LinkedIn profiles:", pendingLinkedInData.length);

        processPendingLinkedInData();
        checkForDisappearedPendingInvitations(message.data || []);

        sendResponse({ success: true });
        return true;
    }

    if (message.type === "CONNECTION_CHECK_RESULTS") {
        console.log("Received connection check results:", message.data);

        updateConnectionCheckResults(message.data || [])
            .then(() => sendResponse({ success: true }))
            .catch((error) => sendResponse({ success: false, error: error.message }));

        return true;
    }
});

function requestSyncPermission() {
    // 1x1 transparent PNG as fallback icon so Chrome doesn't crash if icon48.png is missing
    const dummyIcon = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

    chrome.notifications.create("sync_request", {
        type: "basic",
        iconUrl: dummyIcon,
        title: "LinkedIn Follow-Up Tracker",
        message: "We need ~2 minutes of active window focus to accurately update all your LinkedIn follow-ups. Ready to sync?",
        buttons: [
            { title: "Start Sync Now" },
            { title: "Ask Again in 30 Mins" }
        ],
        requireInteraction: true
    }, (notificationId) => {
        if (chrome.runtime.lastError) {
            console.error("Notification Error:", chrome.runtime.lastError.message);
        } else {
            console.log("Notification displayed successfully:", notificationId);
        }
    });
}

chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (notificationId === "sync_request") {
        if (buttonIndex === 0) {
            console.log("User approved sync. Opening active tab...");
            openSentInvitationsPage();
        } else {
            console.log("User deferred sync. Will prompt again in 30 minutes.");
        }
        chrome.notifications.clear(notificationId);
    }
});

function openSentInvitationsPage() {
    const url = "https://www.linkedin.com/mynetwork/invitation-manager/sent/";

    if (sentInvitationsTabId !== null) {
        chrome.tabs.update(
            sentInvitationsTabId,
            { url: url, active: true },
            (tab) => {
                if (chrome.runtime.lastError) {
                    sentInvitationsTabId = null;
                    createSentInvitationsTab(url);
                } else {
                    console.log("Reusing existing LinkedIn tab:", tab.id);
                }
            }
        );
        return;
    }

    createSentInvitationsTab(url);
}

function createSentInvitationsTab(url) {
    // ACTIVE is set to TRUE so Chrome does not throttle DOM rendering/scrolling
    chrome.tabs.create(
        {
            url: url,
            active: true
        },
        (tab) => {
            if (chrome.runtime.lastError) {
                console.error(
                    "Could not create LinkedIn tab:",
                    chrome.runtime.lastError.message
                );
                return;
            }

            sentInvitationsTabId = tab.id;
            console.log("LinkedIn Sent Invitations tab created:", tab.id);
        }
    );
}

// 1. Trigger notification on install/reload and configure alarm
chrome.runtime.onInstalled.addListener((details) => {
    console.log("Extension installed or reloaded. Requesting permission...");
    requestSyncPermission();

    chrome.alarms.create("linkedinDataSync", {
        delayInMinutes: 30,
        periodInMinutes: 30
    });
});

// 2. Alarm listener for periodic 30-minute sync prompts
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "linkedinDataSync") {
        console.log("30-minute sync trigger. Asking user permission...");
        requestSyncPermission();
    }
});

// Start core extension setup
initializeExtension();