console.log("Background service started.");

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

        console.log(
            "Google authorization successful."
        );

        console.log(
            "Creating Google Sheet..."
        );

        const spreadsheet =
            await createSpreadsheet(token);

        const spreadsheetId =
            spreadsheet.spreadsheetId;

        const spreadsheetUrl =
            `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

        console.log(
            "Google Sheet created successfully!"
        );

        console.log(
            "Spreadsheet ID:",
            spreadsheetId
        );

        console.log(
            "Spreadsheet URL:",
            spreadsheetUrl
        );

        // Save Sheet information
        await chrome.storage.local.set({

            spreadsheetId:
                spreadsheetId,

            spreadsheetUrl:
                spreadsheetUrl,

            googleSheetsConnected:
                true

        });

        console.log(
            "Spreadsheet information saved."
        );

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
        "Last Contacted",
        "Follow-Up Date",
        "Notes",
        "Last Updated"
    ];

    const range = "Sheet1!A1:H1";

    const url =
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;

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

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (message.type === "LINKEDIN_DATA") {

            console.log(
                "Received LinkedIn data:",
                message.data
            );

            sendResponse({
                success: true
            });

            return true;
        }

    }
);
function openSentInvitationsPage() {

    const url =
        "https://www.linkedin.com/mynetwork/invitation-manager/sent/";

    chrome.tabs.create(
        {
            url: url,
            active: false
        },
        (tab) => {

            console.log(
                "LinkedIn Sent Invitations page opened automatically.",
                tab.id
            );

        }
    );
}


initializeExtension()
    .then(() => {
        openSentInvitationsPage();
    });