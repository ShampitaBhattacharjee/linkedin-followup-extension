const connectButton = document.getElementById("connectButton");
const openDashboardButton = document.getElementById("openDashboardButton");
const status = document.getElementById("status");
const sheetLink = document.getElementById("sheetLink");

const SHEET_NAME = "Sheet1";

const HEADERS = [
    "Name",
    "LinkedIn URL",
    "Date Added",
    "Status",
    "Invitation Note",
    "Last Contacted",
    "Follow-Up Date",
    "Notes",
    "Last Updated",
    "Followup Stage"
];

function showStatus(message, type = "") {
    if (status) {
        status.textContent = message;
        status.className = type;
    }
}

async function getGoogleToken() {
    return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: true }, (token) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            if (!token) {
                reject(new Error("Google authentication failed."));
                return;
            }
            resolve(token);
        });
    });
}

async function createSpreadsheet(token) {
    const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            properties: { title: "LinkedIn Follow-Up Tracker" }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not create Google Sheet: ${errorText}`);
    }

    return await response.json();
}

async function addHeaders(token, spreadsheetId) {
    const range = "Sheet1!A1:J1";
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

    const response = await fetch(url, {
        method: "PUT",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ values: [HEADERS] })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Could not create sheet headers: ${errorText}`);
    }
}

async function connectGoogleSheets() {
    try {
        if (connectButton) connectButton.disabled = true;
        showStatus("Connecting to Google...", "loading");

        const token = await getGoogleToken();
        showStatus("Creating Google Sheet...", "loading");

        const spreadsheet = await createSpreadsheet(token);
        const spreadsheetId = spreadsheet.spreadsheetId;

        showStatus("Setting up headers...", "loading");
        await addHeaders(token, spreadsheetId);

        const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

        await chrome.storage.local.set({
            googleSheetsConnected: true,
            spreadsheetId: spreadsheetId,
            spreadsheetUrl: spreadsheetUrl
        });

        if (connectButton) {
            connectButton.textContent = "Connected ✓";
            connectButton.disabled = true;
        }

        showStatus("✓ Connected successfully.", "success");

        if (sheetLink) {
            sheetLink.href = spreadsheetUrl;
            sheetLink.style.display = "block";
        }
    } catch (error) {
        if (connectButton) connectButton.disabled = false;
        showStatus(`Failed: ${error.message}`, "error");
    }
}

function checkConnection() {
    chrome.storage.local.get(["googleSheetsConnected", "spreadsheetUrl"], (result) => {
        if (result.googleSheetsConnected) {
            if (connectButton) {
                connectButton.textContent = "Connected ✓";
                connectButton.disabled = true;
            }
            if (result.spreadsheetUrl && sheetLink) {
                sheetLink.href = result.spreadsheetUrl;
                sheetLink.style.display = "block";
            }
        }
    });
}

if (openDashboardButton) {
    openDashboardButton.addEventListener("click", () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    });
}

if (connectButton) {
    connectButton.addEventListener("click", connectGoogleSheets);
}

checkConnection();