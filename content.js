console.log("LinkedIn Follow-Up Tracker loaded.");


/* =====================================================
   ONLY RUN ON SENT INVITATIONS PAGE
===================================================== */

function isSentInvitationsPage() {

    return window.location.pathname
        .startsWith("/mynetwork/invitation-manager/sent/");

}


/* =====================================================
   STOP ON ALL OTHER LINKEDIN PAGES
===================================================== */

if (!isSentInvitationsPage()) {

    console.log(
        "LinkedIn Follow-Up Tracker: Not on Sent Invitations page. Collector disabled."
    );

} else {

    console.log(
        "LinkedIn Follow-Up Tracker: Sent Invitations page detected."
    );

    const allCollectedInvitations = new Map();


    /* =================================================
       PROFILE COLLECTION
    ================================================= */

    function getSentInvitations() {
        const invitations = [];
        const seen = new Set();

        const profiles = document.querySelectorAll(
            "main#workspace a[href*='/in/']"
        );

        console.log("Profile links found:", profiles.length);

        profiles.forEach((link, index) => {
            try {
                const url = link.href
                    .split("?")[0]
                    .split("#")[0];

                if (!url || seen.has(url)) {
                    return;
                }

                seen.add(url);

                /*
                 * LinkedIn sometimes puts the name directly
                 * inside the <a>, and sometimes the <a> is empty.
                 */
                let name = link.innerText?.trim();

                /*
                 * Find the invitation card surrounding this profile.
                 */
                const container =
                    link.closest("li") ||
                    link.closest('[role="listitem"]') ||
                    link.closest("div[data-view-name]") ||
                    link.parentElement?.parentElement?.parentElement;

                const containerText =
                    container?.innerText?.trim() || "";

                /*
                 * If <a> has no text, get the name from
                 * the surrounding invitation card.
                 */
                if (!name && containerText) {
                    const lines = containerText
                        .split("\n")
                        .map(line => line.trim())
                        .filter(Boolean);

                    if (lines.length > 0) {
                        name = lines[0];
                    }
                }

                /*
                 * Final fallback: derive a readable name
                 * from the LinkedIn URL.
                 */
                if (!name) {
                    const match = url.match(
                        /linkedin\.com\/in\/([^/]+)/
                    );

                    if (match) {
                        name = match[1]
                            .replace(/-\w{6,}$/i, "")
                            .replace(/[-_]+/g, " ")
                            .replace(/\b\w/g, c => c.toUpperCase());
                    }
                }

                if (!name) {
                    console.warn(
                        "Could not determine name for:",
                        url
                    );
                    return;
                }

                const invitation = {
                    name: name,
                    linkedinUrl: url
                };

                /*
                 * IMPORTANT:
                 * Store it in the global Map.
                 * This was missing in the current code.
                 */
                allCollectedInvitations.set(
                    url,
                    invitation
                );

                invitations.push(invitation);

                console.log(
                    `Profile ${invitations.length}:`,
                    name,
                    url
                );

            } catch (error) {
                console.error(
                    "Error processing profile:",
                    index + 1,
                    error
                );
            }
        });

        console.log(
            "Detected LinkedIn profiles:",
            invitations.length,
            invitations
        );

        console.log(
            "Total unique profiles collected so far:",
            allCollectedInvitations.size
        );

        return invitations;
    }

    function sendCollectedInvitations() {

        if (!isSentInvitationsPage()) {
            console.log(
                "Not on Sent Invitations page. Final send cancelled."
            );
            return;
        }

        const finalInvitations =
            Array.from(allCollectedInvitations.values());

        console.log(
            "FINAL LinkedIn profiles:",
            finalInvitations.length,
            finalInvitations
        );

        if (finalInvitations.length === 0) {
            console.warn(
                "No LinkedIn invitations collected."
            );
            return;
        }

        console.log("🚨 ABOUT TO SEND TO BACKGROUND:", finalInvitations.length);
        console.log("🚨 FINAL ARRAY:", finalInvitations);

        chrome.runtime.sendMessage(
            {
                type: "LINKEDIN_DATA",
                data: finalInvitations
            },
            (response) => {

                if (chrome.runtime.lastError) {

                    console.error(
                        "Failed to send LinkedIn data:",
                        chrome.runtime.lastError.message
                    );

                } else {

                    console.log(
                        "LinkedIn data successfully sent to background:",
                        finalInvitations.length
                    );

                }
            }
        );
    }


    /* =================================================
       INITIAL COLLECTION
    ================================================= */

    async function autoScrollAndCollect() {

        if (!isSentInvitationsPage()) {
            console.log("Not on Sent Invitations page. Collector stopped.");
            return;
        }

        console.log("=================================");
        console.log("STARTING SENT INVITATION COLLECTOR");
        console.log("=================================");

        let container = null;

        // Wait for LinkedIn workspace
        for (let attempt = 1; attempt <= 30; attempt++) {

            container = document.querySelector("main#workspace");

            if (container) {
                break;
            }

            console.log(`Waiting for LinkedIn workspace... ${attempt}/30`);

            await new Promise(resolve =>
                setTimeout(resolve, 500)
            );
        }

        if (!container) {
            console.error("Could not find main#workspace.");
            return;
        }

        console.log("LinkedIn invitation container found.");

        // Initial collection
        getSentInvitations();

        let noNewDataRounds = 0;

        // We require several confirmations before stopping
        const REQUIRED_STABLE_ROUNDS = 3;

        while (true) {

            if (!isSentInvitationsPage()) {
                console.log("Navigation detected. Collector stopped.");
                return;
            }

            // LinkedIn may replace the container
            container = document.querySelector("main#workspace");

            if (!container) {
                console.error("LinkedIn workspace disappeared.");
                return;
            }

            // Collect currently visible profiles
            getSentInvitations();

            const beforeCount =
                allCollectedInvitations.size;

            console.log("---------------------------------");
            console.log("Profiles collected:", beforeCount);

            // Scroll to bottom
            container.scrollTo({
                top: container.scrollHeight,
                behavior: "auto"
            });

            window.scrollTo({
                top: document.documentElement.scrollHeight,
                behavior: "auto"
            });

            console.log("Scroll command executed.");

            // Give LinkedIn time to render/load
            await new Promise(resolve =>
                setTimeout(resolve, 3000)
            );

            // Collect anything loaded by scrolling
            getSentInvitations();

            const afterScrollCount =
                allCollectedInvitations.size;

            console.log(
                "Profiles after scroll:",
                afterScrollCount
            );

            /*
             * =========================================
             * CHECK FOR "LOAD MORE"
             * =========================================
             */

            const buttons =
                Array.from(
                    document.querySelectorAll("button")
                );

            const loadMoreButton =
                buttons.find(button => {

                    const text =
                        button.innerText
                            ?.trim()
                            .toLowerCase();

                    return (
                        text === "load more" &&
                        !button.disabled
                    );

                });

            if (loadMoreButton) {

                console.log(
                    "LOAD MORE button found. Clicking..."
                );

                loadMoreButton.scrollIntoView({
                    behavior: "auto",
                    block: "center"
                });

                await new Promise(resolve =>
                    setTimeout(resolve, 500)
                );

                loadMoreButton.click();

                console.log(
                    "LOAD MORE clicked. Waiting for new profiles..."
                );

                // Give LinkedIn time to load next batch
                await new Promise(resolve =>
                    setTimeout(resolve, 3000)
                );

                // Collect newly loaded profiles
                getSentInvitations();

                console.log(
                    "Profiles after Load More:",
                    allCollectedInvitations.size
                );

                // IMPORTANT:
                // Start the loop again and look for
                // another Load More button.
                noNewDataRounds = 0;

                continue;
            }

            /*
             * =========================================
             * NO LOAD MORE BUTTON
             * =========================================
             */

            const newProfiles =
                afterScrollCount - beforeCount;

            if (newProfiles > 0) {

                console.log(
                    "New profiles detected. Continuing..."
                );

                noNewDataRounds = 0;

                continue;
            }

            /*
             * =========================================
             * NOTHING NEW
             * =========================================
             */

            noNewDataRounds++;

            console.log(
                `No new profiles: ${noNewDataRounds}/${REQUIRED_STABLE_ROUNDS}`
            );

            if (
                noNewDataRounds >=
                REQUIRED_STABLE_ROUNDS
            ) {

                console.log("=================================");
                console.log(
                    "ALL SENT INVITATIONS COLLECTED"
                );
                console.log(
                    "Total unique profiles:",
                    allCollectedInvitations.size
                );
                console.log("=================================");

                break;
            }

            // Wait and check again
            await new Promise(resolve =>
                setTimeout(resolve, 3000)
            );
        }

        /*
         * =========================================
         * FINAL COLLECTION
         * =========================================
         */

        getSentInvitations();

        const finalInvitations =
            Array.from(
                allCollectedInvitations.values()
            );

        console.log("=================================");
        console.log(
            "FINAL UNIQUE SENT INVITATIONS:",
            finalInvitations.length
        );
        console.log(finalInvitations);
        console.log("=================================");

        /*
         * Send ONLY ONCE to background.js
         */

        chrome.runtime.sendMessage(
            {
                type: "LINKEDIN_DATA",
                data: finalInvitations
            },
            (response) => {

                if (chrome.runtime.lastError) {

                    console.error(
                        "Failed to send LinkedIn data:",
                        chrome.runtime.lastError.message
                    );

                } else {

                    console.log(
                        "COMPLETE SENT INVITATION LIST SENT TO BACKGROUND:",
                        finalInvitations.length
                    );
                }
            }
        );
    }

    setTimeout(() => {

        autoScrollAndCollect();

    }, 5000);


    /* =================================================
       WATCH FOR LOAD MORE / DOM CHANGES
    ================================================= */

    // const observer =
    //     new MutationObserver(() => {

    //         // LinkedIn is a SPA.
    //         // Do absolutely nothing on other pages.
    //         if (!isSentInvitationsPage()) {

    //             return;
    //         }

    //         getSentInvitations();

    //     });

    // observer.observe(
    //     document.body,
    //     {
    //         childList: true,
    //         subtree: true
    //     }
    // );

}