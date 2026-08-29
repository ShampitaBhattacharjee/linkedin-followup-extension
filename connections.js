console.log("=================================");
console.log("LinkedIn Connections checker loaded.");
console.log("=================================");


/* =====================================================
   CONNECTIONS PAGE CHECK
===================================================== */

function isConnectionsPage() {

    return window.location.pathname
        .startsWith("/mynetwork/invite-connect/connections/");

}


/* =====================================================
   URL NORMALIZATION
===================================================== */

function normalizeLinkedInUrl(url) {

    if (!url) {
        return "";
    }

    return url
        .split("?")[0]
        .split("#")[0]
        .replace(/\/$/, "")
        .toLowerCase();

}


/* =====================================================
   WAIT FOR ELEMENT
===================================================== */

function waitForElement(selector, timeout = 15000) {

    return new Promise((resolve, reject) => {

        const startTime = Date.now();

        const check = () => {

            const element =
                document.querySelector(selector);

            if (element) {

                resolve(element);
                return;

            }

            if (Date.now() - startTime >= timeout) {

                reject(
                    new Error(
                        `Element not found: ${selector}`
                    )
                );

                return;

            }

            setTimeout(check, 500);

        };

        check();

    });

}


/* =====================================================
   SEARCH INPUT
===================================================== */

async function getSearchInput() {

    try {

        const input =
            await waitForElement(
                'input[placeholder="Search by name"]'
            );

        console.log(
            "Connections search input found."
        );

        return input;

    } catch (error) {

        console.error(
            "Could not find Connections search input:",
            error
        );

        return null;

    }

}


/* =====================================================
   ENTER SEARCH TEXT
===================================================== */

function enterSearchText(input, text) {

    /*
     * Clear existing text.
     */
    input.focus();

    input.value = "";

    input.dispatchEvent(
        new Event(
            "input",
            {
                bubbles: true
            }
        )
    );

    /*
     * Enter the new search text.
     */
    input.value = text;

    input.dispatchEvent(
        new Event(
            "input",
            {
                bubbles: true
            }
        )
    );

    input.dispatchEvent(
        new Event(
            "change",
            {
                bubbles: true
            }
        )
    );

}


/* =====================================================
   WAIT FOR SEARCH RESULTS
===================================================== */

async function waitForSearchResults(
    targetUrl,
    timeout = 10000
) {

    const normalizedTarget =
        normalizeLinkedInUrl(targetUrl);

    const startTime =
        Date.now();

    while (
        Date.now() - startTime <
        timeout
    ) {

        const profileLinks =
            document.querySelectorAll(
                'a[href*="/in/"]'
            );

        for (const link of profileLinks) {

            const href =
                normalizeLinkedInUrl(
                    link.href
                );

            if (
                href &&
                href === normalizedTarget
            ) {

                return true;

            }

        }

        await new Promise(
            resolve =>
                setTimeout(resolve, 500)
        );

    }

    return false;

}


/* =====================================================
   CLEAR SEARCH
===================================================== */

async function clearSearchResults(input) {

    input.focus();

    input.value = "";

    input.dispatchEvent(
        new Event(
            "input",
            {
                bubbles: true
            }
        )
    );

    input.dispatchEvent(
        new Event(
            "change",
            {
                bubbles: true
            }
        )
    );

    await new Promise(
        resolve =>
            setTimeout(resolve, 1000)
    );

}


/* =====================================================
   CHECK ONE PROFILE
===================================================== */

async function checkConnection(
    input,
    profile
) {

    console.log(
        "---------------------------------"
    );

    console.log(
        "Checking connection:",
        profile.name
    );

    console.log(
        "Expected LinkedIn URL:",
        profile.linkedinUrl
    );

    /*
     * Search by the person's name.
     */
    enterSearchText(
        input,
        profile.name
    );

    /*
     * Give LinkedIn time to update
     * the search results.
     */
    await new Promise(
        resolve =>
            setTimeout(resolve, 1500)
    );

    /*
     * Check whether the exact LinkedIn
     * profile URL appears in the results.
     */
    const found =
        await waitForSearchResults(
            profile.linkedinUrl,
            8000
        );

    if (found) {

        console.log(
            "RESULT: CONNECTION FOUND"
        );

    } else {

        console.log(
            "RESULT: CONNECTION NOT FOUND"
        );

    }

    await clearSearchResults(input);

    return {
        rowNumber: profile.rowNumber,
        name: profile.name,
        linkedinUrl: profile.linkedinUrl,
        connected: found
    };

}


/* =====================================================
   CHECK ALL DISAPPEARED INVITATIONS
===================================================== */

async function checkAllPendingConnections() {

    if (!isConnectionsPage()) {

        console.log(
            "Not on Connections page. Checker stopped."
        );

        return;

    }

    console.log(
        "================================="
    );

    console.log(
        "STARTING CONNECTION CHECK"
    );

    console.log(
        "================================="
    );


    /* -------------------------------------------------
       Get profiles saved by background.js
    ------------------------------------------------- */

    const storage =
        await chrome.storage.local.get([
            "pendingConnectionChecks"
        ]);

    const profiles =
        storage.pendingConnectionChecks || [];


    if (profiles.length === 0) {

        console.log(
            "No profiles require a connection check."
        );

        return;

    }


    console.log(
        "Profiles to check:",
        profiles.length
    );

    console.log(
        profiles
    );


    /* -------------------------------------------------
       Find Connections search box
    ------------------------------------------------- */

    const input =
        await getSearchInput();


    if (!input) {

        console.error(
            "Connection checking aborted because search input was not found."
        );

        return;

    }


    /* -------------------------------------------------
       Check profiles one by one
    ------------------------------------------------- */

    const results = [];


    for (
        const profile of profiles
    ) {

        try {

            const result =
                await checkConnection(
                    input,
                    profile
                );

            results.push(result);

        } catch (error) {

            console.error(
                "Error checking profile:",
                profile.name,
                error
            );

            results.push({

                rowNumber:
                    profile.rowNumber,

                name:
                    profile.name,

                linkedinUrl:
                    profile.linkedinUrl,

                connected:
                    false,

                error:
                    true

            });

        }

    }


    /* -------------------------------------------------
       Display final results
    ------------------------------------------------- */

    console.log(
        "================================="
    );

    console.log(
        "CONNECTION CHECK COMPLETE"
    );

    console.log(
        "================================="
    );

    console.log(
        "Results:",
        results
    );


    /* -------------------------------------------------
       Send results to background.js
    ------------------------------------------------- */

    chrome.runtime.sendMessage(
        {
            type:
                "CONNECTION_CHECK_RESULTS",

            data:
                results
        },
        (response) => {

            if (chrome.runtime.lastError) {

                console.error(
                    "Failed to send connection results:",
                    chrome.runtime.lastError.message
                );

                return;

            }

            console.log(
                "Connection results successfully sent to background."
            );

        }
    );

}


/* =====================================================
   START
===================================================== */

if (isConnectionsPage()) {

    console.log(
        "LinkedIn Connections page detected."
    );

    /*
     * Give LinkedIn a little time to finish
     * rendering the Connections workspace.
     */
    setTimeout(
        () => {

            checkAllPendingConnections();

        },
        2000
    );

} else {

    console.log(
        "Not on Connections page."
    );

}