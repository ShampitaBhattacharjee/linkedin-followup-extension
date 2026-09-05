console.log("LinkedIn Follow-Up Tracker loaded.");

// =====================================================
// OVERLAY FUNCTIONS
// =====================================================
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
            <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #0a66c2;">Syncing LinkedIn Data...</h2>
            <p style="font-size: 15px; font-weight: 500; color: #475569; line-height: 1.5; margin: 0;">
                It will take a few mins. Grab a tea till then! ☕ Don't close this tab
            </p>
        </div>
    `;

    document.body.appendChild(overlay);
}

// =====================================================
// PAGE HELPERS & SCRAPING LOGIC
// =====================================================
function isSentInvitationsPage() {
    return window.location.pathname.startsWith("/mynetwork/invitation-manager/sent/");
}

const allCollectedInvitations = new Map();

function getSentInvitations() {
    const invitations = [];
    const seen = new Set();

    const profiles = document.querySelectorAll("a[href*='/in/']");

    profiles.forEach((link) => {
        try {
            const url = link.href.split("?")[0].split("#")[0];

            if (!url || seen.has(url) || !url.includes("/in/")) return;
            seen.add(url);

            let name = link.innerText?.trim();

            const container =
                link.closest("li") ||
                link.closest('[role="listitem"]') ||
                link.closest("div[data-view-name]") ||
                link.parentElement?.parentElement?.parentElement;

            const containerText = container?.innerText?.trim() || "";

            if (!name && containerText) {
                const lines = containerText
                    .split("\n")
                    .map(line => line.trim())
                    .filter(Boolean);

                if (lines.length > 0) name = lines[0];
            }

            if (!name) {
                const match = url.match(/linkedin\.com\/in\/([^/]+)/);
                if (match) {
                    name = match[1]
                        .replace(/-\w{6,}$/i, "")
                        .replace(/[-_]+/g, " ")
                        .replace(/\b\w/g, c => c.toUpperCase());
                }
            }

            if (!name) return;

            const invitation = { name: name, linkedinUrl: url };
            allCollectedInvitations.set(url, invitation);
            invitations.push(invitation);

        } catch (error) {
            console.error("Error processing profile:", error);
        }
    });

    return invitations;
}

async function autoScrollAndCollect() {
    console.log("=================================");
    console.log("STARTING SENT INVITATION COLLECTOR");
    console.log("=================================");

    let noNewDataRounds = 0;
    const REQUIRED_STABLE_ROUNDS = 4;

    while (true) {
        if (!isSentInvitationsPage()) return;

        getSentInvitations();
        const beforeCount = allCollectedInvitations.size;

        console.log(`Currently collected: ${beforeCount} profiles...`);

        // Scroll window to bottom
        window.scrollTo(0, document.body.scrollHeight);

        // Scroll all possible inner containers
        const scrollableContainers = document.querySelectorAll(
            "main, #workspace, .scaffold-finite-scroll, ul.mn-invitation-manager__list, div.artdeco-card"
        );

        scrollableContainers.forEach(el => {
            el.scrollTop = el.scrollHeight;
        });

        // Dispatch scroll event to trigger LinkedIn Lazy Loading listeners
        window.dispatchEvent(new Event("scroll"));

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check for any "See more", "Load more", or show more buttons
        const buttons = Array.from(document.querySelectorAll("button"));
        const loadMoreBtn = buttons.find(button => {
            const text = button.innerText?.trim().toLowerCase() || "";
            return (
                (text.includes("load more") || 
                 text.includes("see more") || 
                 text.includes("show more")) &&
                !button.disabled
            );
        });

        if (loadMoreBtn) {
            console.log("Load/See More button detected. Clicking...");
            loadMoreBtn.scrollIntoView({ behavior: "smooth", block: "center" });
            await new Promise(resolve => setTimeout(resolve, 500));
            loadMoreBtn.click();
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        getSentInvitations();
        const afterCount = allCollectedInvitations.size;

        if (afterCount > beforeCount) {
            console.log(`Loaded ${afterCount - beforeCount} new profiles.`);
            noNewDataRounds = 0;
        } else {
            noNewDataRounds++;
            console.log(`No new profiles found in round ${noNewDataRounds}/${REQUIRED_STABLE_ROUNDS}`);
        }

        if (noNewDataRounds >= REQUIRED_STABLE_ROUNDS) {
            console.log("Reached end of list.");
            break;
        }
    }

    getSentInvitations();
    const finalInvitations = Array.from(allCollectedInvitations.values());

    console.log(`=================================`);
    console.log(`COLLECTION COMPLETE: ${finalInvitations.length} profiles gathered.`);
    console.log(`=================================`);

    chrome.runtime.sendMessage(
        {
            type: "LINKEDIN_DATA",
            data: finalInvitations
        },
        (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error sending data:", chrome.runtime.lastError.message);
            } else {
                console.log("All data sent to background successfully!");
            }
        }
    );
}

// =====================================================
// INITIALIZATION
// =====================================================
async function initContentScript() {
    const storage = await chrome.storage.local.get(["syncInProgress"]);
    if (!storage.syncInProgress) {
        console.log("LinkedIn Follow-Up Tracker: Sync not active. Content script dormant.");
        return; 
    }

    if (isSentInvitationsPage()) {
        console.log("LinkedIn Follow-Up Tracker: Sent Invitations sync active.");
        showSyncOverlay();
        setTimeout(() => {
            autoScrollAndCollect();
        }, 3000);
    }
}

initContentScript();