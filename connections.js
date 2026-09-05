console.log("=================================");
console.log("LinkedIn Connections checker loaded.");
console.log("=================================");

function showSyncOverlay() {
    if (document.getElementById("sync-tea-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "sync-tea-overlay";
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(15, 23, 42, 0.88);
        backdrop-filter: blur(5px);
        z-index: 9999999;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        text-align: center;
        pointer-events: auto;
    `;

    const gifUrl = chrome.runtime.getURL("tea.gif");

    overlay.innerHTML = `
        <div style="background: #ffffff; padding: 32px 40px; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4); max-width: 420px; color: #0f172a; text-align: center;">
            <img src="${gifUrl}" 
                 alt="Drinking tea" 
                 style="width: 200px; height: auto; border-radius: 12px; margin-bottom: 20px; display: block; margin-left: auto; margin-right: auto;" />
            <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #0a66c2;">Checking Connections...</h2>
            <p style="font-size: 15px; font-weight: 500; color: #475569; line-height: 1.5; margin: 0;">
                It will take a few mins. Grab a tea till then! ☕
            </p>
        </div>
    `;

    document.body.appendChild(overlay);
}

async function initConnectionsScript() {
    const storage = await chrome.storage.local.get(["syncInProgress"]);
    if (!storage.syncInProgress) {
        console.log("LinkedIn Follow-Up Tracker: Sync not active. Connection checker dormant.");
        return;
    }

    if (isConnectionsPage()) {
        console.log("LinkedIn Connections page detected for sync.");
        showSyncOverlay();
        setTimeout(() => {
            checkAllPendingConnections();
        }, 2000);
    }
}

initConnectionsScript();

/* =====================================================
   CONNECTIONS PAGE CHECK
===================================================== */

function isConnectionsPage() {
    return window.location.pathname.startsWith("/mynetwork/invite-connect/connections/");
}

/* =====================================================
   URL NORMALIZATION
===================================================== */

function normalizeLinkedInUrl(url) {
    if (!url) return "";
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
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
                return;
            }

            if (Date.now() - startTime >= timeout) {
                reject(new Error(`Element not found: ${selector}`));
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
        const input = await waitForElement('input[placeholder="Search by name"]');
        console.log("Connections search input found.");
        return input;
    } catch (error) {
        console.error("Could not find Connections search input:", error);
        return null;
    }
}

/* =====================================================
   ENTER SEARCH TEXT
===================================================== */

function enterSearchText(input, text) {
    input.focus();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
}

/* =====================================================
   WAIT FOR SEARCH RESULTS
===================================================== */

async function waitForSearchResults(targetUrl, timeout = 8000) {
    const normalizedTarget = normalizeLinkedInUrl(targetUrl);
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const profileLinks = document.querySelectorAll('a[href*="/in/"]');

        for (const link of profileLinks) {
            const href = normalizeLinkedInUrl(link.href);
            if (href && href === normalizedTarget) {
                return true;
            }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    return false;
}

/* =====================================================
   CLEAR SEARCH
===================================================== */

async function clearSearchResults(input) {
    input.focus();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    await new Promise(resolve => setTimeout(resolve, 1000));
}

/* =====================================================
   CHECK ONE PROFILE
===================================================== */

async function checkConnection(input, profile) {
    console.log("---------------------------------");
    console.log("Checking connection:", profile.name);
    console.log("Expected LinkedIn URL:", profile.linkedinUrl);

    // Search by person's name
    enterSearchText(input, profile.name);

    // Wait for LinkedIn to update DOM search results
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Check if the URL appears in the search result
    const found = await waitForSearchResults(profile.linkedinUrl, 8000);

    if (found) {
        console.log("RESULT: CONNECTION FOUND");
    } else {
        console.log("RESULT: CONNECTION NOT FOUND");
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
   CHECK ALL TARGETED INVITATIONS
===================================================== */

async function checkAllPendingConnections() {
    if (!isConnectionsPage()) {
        console.log("Not on Connections page. Checker stopped.");
        return;
    }

    console.log("=================================");
    console.log("STARTING CONNECTION CHECK");
    console.log("=================================");

    /* -------------------------------------------------
       Get profiles stored by background.js
    ------------------------------------------------- */
    const storage = await chrome.storage.local.get(["pendingConnectionChecks"]);
    const profiles = storage.pendingConnectionChecks || [];

    if (profiles.length === 0) {
        console.log("No profiles require a connection check.");
        return;
    }

    console.log(`Profiles to check: ${profiles.length}`);
    console.log(profiles);

    /* -------------------------------------------------
       Find Connections search box
    ------------------------------------------------- */
    const input = await getSearchInput();

    if (!input) {
        console.error("Connection checking aborted because search input was not found.");
        return;
    }

    /* -------------------------------------------------
       Check profiles one by one
    ------------------------------------------------- */
    const results = [];

    for (const profile of profiles) {
        try {
            const result = await checkConnection(input, profile);
            results.push(result);
        } catch (error) {
            console.error("Error checking profile:", profile.name, error);
            results.push({
                rowNumber: profile.rowNumber,
                name: profile.name,
                linkedinUrl: profile.linkedinUrl,
                connected: false,
                error: true
            });
        }
    }

    /* -------------------------------------------------
       Display final results & send back to background
    ------------------------------------------------- */
    console.log("=================================");
    console.log("CONNECTION CHECK COMPLETE");
    console.log("=================================");
    console.log("Results:", results);

    chrome.runtime.sendMessage(
    {
        type: "CONNECTION_CHECK_RESULTS",
        data: results
    },
    async (response) => {
        if (chrome.runtime.lastError) {
            console.error("Failed to send connection results:", chrome.runtime.lastError.message);
            return;
        }

        console.log("Connection results successfully sent to background.");

        // Clear temporary pending list
        await chrome.storage.local.remove("pendingConnectionChecks");
        console.log("Pending connection check queue cleared.");
    }
);
}

/* =====================================================
   INITIALIZATION
===================================================== */

if (isConnectionsPage()) {
    console.log("LinkedIn Connections page detected.");
    setTimeout(() => {
        checkAllPendingConnections();
    }, 2000);
} else {
    console.log("Not on Connections page.");
}