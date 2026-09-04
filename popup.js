const connectButton = document.getElementById("connectButton");
const status = document.getElementById("status");
const sheetLink = document.getElementById("sheetLink");

const SHEET_NAME = "LinkedIn Leads";

const HEADERS = [
    "Name",
    "LinkedIn URL",
    "Date Added",
    "Status",
    "Last Contacted",
    "Follow-Up Date",
    "Notes"
];

/* =====================================================
   UI HELPERS
===================================================== */

function showStatus(message, type = "") {
    if (status) {
        status.textContent = message;
        status.className = type;
    }
}

/* =====================================================
   GOOGLE AUTHENTICATION
===================================================== */

async function getGoogleToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken(
            {
                interactive: true
            },
            (token) => {
                if (chrome.runtime.lastError) {
                    reject(
                        new Error(
                            chrome.runtime.lastError.message
                        )
                    );
                    return;
                }

                if (!token) {
                    reject(
                        new Error(
                            "Google authentication failed."
                        )
                    );
                    return;
                }

                resolve(token);
            }
        );
    });
}

/* =====================================================
   CREATE GOOGLE SHEET
===================================================== */

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
                },
                sheets: [
                    {
                        properties: {
                            title: SHEET_NAME
                        }
                    }
                ]
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

/* =====================================================
   ADD HEADERS
===================================================== */

async function addHeaders(token, spreadsheetId) {
    const range = `${SHEET_NAME}!A1:G1`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

    const response = await fetch(
        url,
        {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                values: [
                    HEADERS
                ]
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Could not create sheet headers: ${errorText}`
        );
    }

    return await response.json();
}

/* =====================================================
   SAVE ONLY CONFIGURATION
===================================================== */

async function saveConfiguration(
    spreadsheetId,
    spreadsheetUrl
) {
    await chrome.storage.local.set({
        googleSheetsConnected: true,
        spreadsheetId: spreadsheetId,
        spreadsheetUrl: spreadsheetUrl
    });
}

/* =====================================================
   CONNECT GOOGLE SHEETS
===================================================== */

async function connectGoogleSheets() {
    try {
        if (connectButton) {
            connectButton.disabled = true;
        }

        showStatus(
            "Connecting to Google...",
            "loading"
        );

        const token = await getGoogleToken();

        showStatus(
            "Creating your Google Sheet...",
            "loading"
        );

        const spreadsheet = await createSpreadsheet(token);
        const spreadsheetId = spreadsheet.spreadsheetId;

        if (!spreadsheetId) {
            throw new Error(
                "Google did not return a spreadsheet ID."
            );
        }

        showStatus(
            "Setting up your tracker...",
            "loading"
        );

        await addHeaders(
            token,
            spreadsheetId
        );

        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

        await saveConfiguration(
            spreadsheetId,
            spreadsheetUrl
        );

        if (connectButton) {
            connectButton.textContent = "Connected ✓";
            connectButton.disabled = true;
        }

        showStatus(
            "✓ Google Sheets connected successfully.",
            "success"
        );

        if (sheetLink) {
            sheetLink.href = spreadsheetUrl;
            sheetLink.style.display = "block";
        }

    } catch (error) {
        console.error(
            "Google Sheets connection error:",
            error
        );

        if (connectButton) {
            connectButton.disabled = false;
        }

        showStatus(
            `Connection failed: ${error.message}`,
            "error"
        );
    }
}

/* =====================================================
   CHECK EXISTING CONNECTION
===================================================== */

async function checkConnection() {
    chrome.storage.local.get(
        [
            "googleSheetsConnected",
            "spreadsheetId",
            "spreadsheetUrl"
        ],
        (result) => {
            if (
                result.googleSheetsConnected &&
                result.spreadsheetId
            ) {
                if (connectButton) {
                    connectButton.textContent = "Connected ✓";
                    connectButton.disabled = true;
                }

                showStatus(
                    "✓ Google Sheets connected successfully.",
                    "success"
                );

                if (result.spreadsheetUrl && sheetLink) {
                    sheetLink.href = result.spreadsheetUrl;
                    sheetLink.style.display = "block";
                }
            }
        }
    );
}

/* =====================================================
   BUTTON LISTENER & INITIALIZATION
===================================================== */

if (connectButton) {
    connectButton.addEventListener(
        "click",
        connectGoogleSheets
    );
}

checkConnection();