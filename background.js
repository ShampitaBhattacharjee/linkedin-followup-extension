console.log("Background service started.");

let sheetSaveInProgress = false;

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
        "Invitation Note",
        "Last Contacted",
        "Follow-Up Date",
        "Notes",
        "Last Updated"
    ];

    const range = "Sheet1!A1:I1";

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

async function saveLinkedInDataToSheet(invitations) {

    // Prevent multiple simultaneous sheet writes
    if (sheetSaveInProgress) {

        console.log(
            "Sheet save already in progress. Skipping this request."
        );

        return;
    }

    sheetSaveInProgress = true;

    try {

        if (!invitations || invitations.length === 0) {

            console.log(
                "No LinkedIn data to save."
            );

            return;
        }


        const result =
            await chrome.storage.local.get([
                "spreadsheetId"
            ]);


        if (!result.spreadsheetId) {

            console.error(
                "No Google Sheet found."
            );

            return;
        }


        const token =
            await getGoogleToken();


        const spreadsheetId =
            result.spreadsheetId;


        /*
         * Get existing LinkedIn URLs from column B.
         * These are used to prevent duplicate rows.
         */

        const existingRange =
            "Sheet1!B2:B";


        const existingUrl =
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(existingRange)}`;


        const existingResponse =
            await fetch(
                existingUrl,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );


        if (!existingResponse.ok) {

            throw new Error(
                "Could not read existing Google Sheet data."
            );

        }


        const existingData =
            await existingResponse.json();


        const existingUrls =
            (existingData.values || [])
                .flat()
                .filter(Boolean);


        /*
         * Remove profiles that already exist
         * in the Google Sheet.
         */

        const newInvitations =
            invitations.filter(
                invitation =>
                    !existingUrls.includes(
                        invitation.linkedinUrl
                    )
            );


        if (newInvitations.length === 0) {

            console.log(
                "All LinkedIn invitations already exist in the sheet."
            );

            return;
        }


        const today =
            new Date().toLocaleDateString(
                "en-IN"
            );


        /*
         * Convert LinkedIn profiles
         * into Google Sheet rows.
         */

        const rows =
            newInvitations.map(
                invitation => [

                    invitation.name || "",

                    invitation.linkedinUrl || "",

                    today,

                    "Pending",

                    // Invitation Note - blank for Version 1
                    invitation.invitationNote || "",

                    "",

                    "",

                    "",

                    today

                ]
            );


        /*
         * Append new rows to Google Sheet.
         */

        const appendRange =
            "Sheet1!A:I";


        const appendUrl =
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(appendRange)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;


        const response =
            await fetch(
                appendUrl,
                {
                    method: "POST",

                    headers: {
                        "Authorization":
                            `Bearer ${token}`,

                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        values: rows
                    })
                }
            );


        if (!response.ok) {

            const errorText =
                await response.text();


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


    } finally {

        /*
         * Allow the next LinkedIn data update
         * after the current save has finished.
         */

        sheetSaveInProgress = false;

    }

}

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (message.type === "LINKEDIN_DATA") {

            console.log(
                "Received LinkedIn data:",
                message.data
            );

            saveLinkedInDataToSheet(
                message.data
            )
            .then(() => {

                sendResponse({
                    success: true
                });

            })
            .catch((error) => {

                console.error(
                    "Failed to save LinkedIn data:",
                    error
                );

                sendResponse({
                    success: false,
                    error: error.message
                });

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