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
    // if (sheetSaveInProgress) {

    //     console.log(
    //         "Sheet save already in progress. Skipping this request."
    //     );

    //     return;
    // }

    // sheetSaveInProgress = true;

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
        throw error;


    } finally {

        /*
         * Allow the next LinkedIn data update
         * after the current save has finished.
         */

        // sheetSaveInProgress = false;

    }

}

async function checkForDisappearedPendingInvitations(
    currentSentInvitations
) {

    try {

        console.log(
            "Checking for disappeared pending invitations..."
        );

        const result =
            await chrome.storage.local.get([
                "spreadsheetId"
            ]);

        if (!result.spreadsheetId) {

            console.log(
                "No Google Sheet found. Cannot check invitation status."
            );

            return;
        }

        const token =
            await getGoogleToken();

        const spreadsheetId =
            result.spreadsheetId;

        /*
         * Read columns A-D:
         *
         * A = Name
         * B = LinkedIn URL
         * C = Date Added
         * D = Status
         */
        const range =
            "Sheet1!A2:D";

        const url =
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

        const response =
            await fetch(
                url,
                {
                    headers: {
                        "Authorization":
                            `Bearer ${token}`
                    }
                }
            );

        if (!response.ok) {

            throw new Error(
                "Could not read existing invitation records."
            );
        }

        const data =
            await response.json();

        const rows =
            data.values || [];

        /*
         * Create a Set containing all LinkedIn URLs
         * currently present on the Sent Invitations page.
         */
        const currentSentUrls =
            new Set(
                (currentSentInvitations || [])
                    .map(invitation =>
                        invitation.linkedinUrl
                    )
                    .filter(Boolean)
            );
        console.log("===== DISAPPEARANCE DEBUG =====");

        console.log(
            "Pending URLs from Sheet:",
            rows
                .filter(row => row[3] === "Pending")
                .map(row => ({
                    name: row[0],
                    url: row[1]
                }))
        );

        console.log(
            "URLs collected from Sent Invitations:",
            currentSentInvitations.map(invitation => ({
                name: invitation.name,
                url: invitation.linkedinUrl
            }))
        );

        console.log(
            "Current Sent URL Set:",
            Array.from(currentSentUrls)
        );

        console.log("==============================");

        /*
         * Find Pending invitations in the Sheet
         * that are no longer on the Sent Invitations page.
         */
        const disappearedInvitations =
            rows
                .map((row, index) => {

                    return {
                        rowNumber: index + 2,
                        name: row[0] || "",
                        linkedinUrl: row[1] || "",
                        dateAdded: row[2] || "",
                        status: row[3] || ""
                    };

                })
                .filter(row => {

                    return (
                        row.status === "Pending" &&
                        row.linkedinUrl &&
                        !currentSentUrls.has(
                            row.linkedinUrl
                        )
                    );

                });

        console.log(
            "================================="
        );

        console.log(
            "Pending invitations in Sheet:",
            rows.filter(row =>
                row[3] === "Pending"
            ).length
        );

        console.log(
            "Current Sent Invitations:",
            currentSentUrls.size
        );

        console.log(
            "Disappeared Pending invitations:",
            disappearedInvitations.length
        );

        console.log(
            "Disappeared invitations:",
            disappearedInvitations
        );

        console.log(
            "================================="
        );

        /*
         * For now we ONLY detect them.
         *
         * We will NOT change their status yet.
         */
        /*
 * If there are disappeared pending invitations,
 * remember them for the Connections check.
 */
        if (disappearedInvitations.length > 0) {

            await chrome.storage.local.set({
                pendingConnectionChecks:
                    disappearedInvitations
            });

            console.log(
                "Profiles saved for Connections check:",
                disappearedInvitations
            );

            /*
             * Navigate the SAME LinkedIn tab
             * from Sent Invitations to Connections.
             */
            if (sentInvitationsTabId !== null) {

                chrome.tabs.update(
                    sentInvitationsTabId,
                    {
                        url:
                            "https://www.linkedin.com/mynetwork/invite-connect/connections/"
                    },
                    () => {

                        if (chrome.runtime.lastError) {

                            console.error(
                                "Could not navigate to Connections:",
                                chrome.runtime.lastError.message
                            );

                        } else {

                            console.log(
                                "Same LinkedIn tab navigating to Connections."
                            );

                        }

                    }
                );

            } else {

                console.error(
                    "No Sent Invitations tab ID available."
                );

            }
        }
        return disappearedInvitations;

    } catch (error) {

        console.error(
            "Error checking disappeared invitations:",
            error
        );

        return [];
    }
}

async function processPendingLinkedInData() {

    if (sheetSaveInProgress) {
        return;
    }

    if (pendingLinkedInData.length === 0) {
        return;
    }

    sheetSaveInProgress = true;

    // Take the current pending data
    const dataToSave = pendingLinkedInData;

    // Clear the queue so new data can arrive while we save
    pendingLinkedInData = [];

    try {

        console.log(
            "Processing pending LinkedIn data:",
            dataToSave.length
        );

        await saveLinkedInDataToSheet(dataToSave);

    } catch (error) {

        console.error(
            "Failed to process pending LinkedIn data:",
            error
        );

        // Put the data back into the queue if saving failed
        pendingLinkedInData = [
            ...dataToSave,
            ...pendingLinkedInData
        ];

    } finally {

        sheetSaveInProgress = false;

        // If more data arrived while we were saving,
        // process it now.
        if (pendingLinkedInData.length > 0) {

            processPendingLinkedInData();

        }
    }
}

async function updateConnectionCheckResults(results) {

    try {

        console.log(
            "Updating Google Sheet with connection results:",
            results
        );

        if (!results || results.length === 0) {

            console.log(
                "No connection results to update."
            );

            return;
        }

        const storage =
            await chrome.storage.local.get([
                "spreadsheetId"
            ]);

        if (!storage.spreadsheetId) {

            throw new Error(
                "No Google Sheet found."
            );
        }

        const token =
            await getGoogleToken();

        const spreadsheetId =
            storage.spreadsheetId;

        /*
         * Update each existing row.
         *
         * D = Status
         * I = Last Updated
         */
        for (const result of results) {

            /*
             * If there was an actual checking error,
             * do NOT mark the person as Rejected.
             */
            if (result.error) {

                console.warn(
                    "Skipping profile because connection check failed:",
                    result.name
                );

                continue;
            }

            const status =
                result.connected
                    ? "Accepted"
                    : "Rejected";

            const today =
                new Date().toLocaleDateString(
                    "en-IN"
                );

            /*
             * Update Status in column D.
             */
            const statusRange =
                `Sheet1!D${result.rowNumber}`;

            const statusUrl =
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(statusRange)}?valueInputOption=RAW`;

            const statusResponse =
                await fetch(
                    statusUrl,
                    {
                        method: "PUT",

                        headers: {
                            "Authorization":
                                `Bearer ${token}`,

                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            values: [
                                [status]
                            ]
                        })
                    }
                );

            if (!statusResponse.ok) {

                const errorText =
                    await statusResponse.text();

                throw new Error(
                    `Could not update status for ${result.name}: ${errorText}`
                );
            }


            /*
             * Update Last Updated in column I.
             */
            const updatedRange =
                `Sheet1!I${result.rowNumber}`;

            const updatedUrl =
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(updatedRange)}?valueInputOption=RAW`;

            const updatedResponse =
                await fetch(
                    updatedUrl,
                    {
                        method: "PUT",

                        headers: {
                            "Authorization":
                                `Bearer ${token}`,

                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            values: [
                                [today]
                            ]
                        })
                    }
                );

            if (!updatedResponse.ok) {

                const errorText =
                    await updatedResponse.text();

                throw new Error(
                    `Could not update Last Updated for ${result.name}: ${errorText}`
                );
            }

            console.log(
                `${result.name} → ${status}`
            );

        }

        /*
         * Only clear the pending checks after
         * processing the results.
         */
        await chrome.storage.local.remove(
            "pendingConnectionChecks"
        );

        console.log(
            "Google Sheet connection statuses updated successfully."
        );

    } catch (error) {

        console.error(
            "Error updating connection check results:",
            error
        );

    }

}

chrome.runtime.onMessage.addListener(
    (message, sender, sendResponse) => {

        if (message.type === "LINKEDIN_DATA") {

            console.log(
                "Received LinkedIn data:",
                message.data
            );

            // Add incoming data to the pending queue
            pendingLinkedInData = [
                ...pendingLinkedInData,
                ...(message.data || [])
            ];

            // Remove duplicate profile URLs from the queue
            const uniqueData = new Map();

            pendingLinkedInData.forEach(item => {

                if (item.linkedinUrl) {
                    uniqueData.set(
                        item.linkedinUrl,
                        item
                    );
                }

            });

            pendingLinkedInData =
                Array.from(uniqueData.values());

            console.log(
                "Pending LinkedIn profiles:",
                pendingLinkedInData.length
            );

            processPendingLinkedInData();

            checkForDisappearedPendingInvitations(
                message.data || []
            );

            sendResponse({
                success: true
            });

            return true;
        }

        if (message.type === "CONNECTION_CHECK_RESULTS") {

            console.log(
                "Received connection check results:",
                message.data
            );

            updateConnectionCheckResults(
                message.data || []
            )
                .then(() => {

                    sendResponse({
                        success: true
                    });

                })
                .catch((error) => {

                    console.error(
                        "Failed to update connection results:",
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

    /*
     * If we already have a LinkedIn tab,
     * reuse that same tab.
     */
    if (sentInvitationsTabId !== null) {

        chrome.tabs.update(
            sentInvitationsTabId,
            {
                url: url
            },
            (tab) => {

                if (chrome.runtime.lastError) {

                    console.log(
                        "Existing LinkedIn tab unavailable. Creating a new one."
                    );

                    sentInvitationsTabId = null;

                    createSentInvitationsTab(url);

                } else {

                    console.log(
                        "Reusing existing LinkedIn tab:",
                        tab.id
                    );

                }

            }
        );

        return;
    }

    createSentInvitationsTab(url);
}

function createSentInvitationsTab(url) {

    chrome.tabs.create(
        {
            url: url,
            active: false
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

            console.log(
                "LinkedIn Sent Invitations tab created:",
                tab.id
            );

        }
    );
}


initializeExtension()
    .then(() => {
        openSentInvitationsPage();
    });

chrome.alarms.create(
    "linkedinDataSync",
    {
        periodInMinutes: 30
    }
);

chrome.alarms.onAlarm.addListener(
    (alarm) => {

        if (alarm.name === "linkedinDataSync") {

            console.log(
                "30-minute LinkedIn data sync started."
            );

            openSentInvitationsPage();

        }

    }
);