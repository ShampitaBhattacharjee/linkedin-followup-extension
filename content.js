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
        console.log(
            "Not on Sent Invitations page. Collector stopped."
        );
        return;
    }

    console.log("=================================");
    console.log("STARTING SENT INVITATION COLLECTOR");
    console.log("=================================");

    // Wait until LinkedIn creates the actual workspace
    let container = null;

    for (let attempt = 1; attempt <= 20; attempt++) {

        container = document.querySelector("main#workspace");

        if (container) {
            break;
        }

        console.log(
            `Waiting for LinkedIn workspace... ${attempt}/20`
        );

        await new Promise(resolve =>
            setTimeout(resolve, 500)
        );
    }

    if (!container) {

        console.error(
            "Could not find main#workspace."
        );

        return;
    }

    console.log(
        "LinkedIn invitation container found:",
        container
    );

    /*
     * Keep collecting everything that LinkedIn
     * currently has in the DOM.
     */
    getSentInvitations();

    let lastCount =
        allCollectedInvitations.size;

    let stableRounds = 0;

    /*
     * Scroll gradually instead of jumping immediately
     * to the bottom.
     */
    for (let round = 1; round <= 30; round++) {

        if (!isSentInvitationsPage()) {
            console.log(
                "Navigation detected. Collector stopped."
            );
            return;
        }

        console.log(
            `========== SCROLL ROUND ${round} ==========`
        );

        /*
         * Make sure we have the latest container.
         */
        container =
            document.querySelector("main#workspace");

        if (!container) {
            console.error(
                "LinkedIn workspace disappeared."
            );
            return;
        }

        /*
         * Collect BEFORE scrolling.
         */
        getSentInvitations();

        const beforeCount =
            allCollectedInvitations.size;

        console.log(
            "Profiles before scroll:",
            beforeCount
        );

        /*
         * Scroll down by one viewport.
         *
         * scrollTo() performs an actual browser scroll
         * and allows LinkedIn's scroll handlers to react.
         */
        const oldScrollTop =
            container.scrollTop;

        const scrollAmount =
            Math.max(
                300,
                container.clientHeight * 0.8
            );

        const targetScrollTop =
            Math.min(
                oldScrollTop + scrollAmount,
                container.scrollHeight
            );

        container.scrollTo({
            top: targetScrollTop,
            behavior: "smooth"
        });

        console.log(
            "Scrolling:",
            oldScrollTop,
            "→",
            targetScrollTop
        );

        /*
         * Give LinkedIn time to render lazy-loaded
         * invitation cards.
         */
        await new Promise(resolve =>
            setTimeout(resolve, 2500)
        );

        /*
         * Collect newly rendered profiles.
         */
        getSentInvitations();

        const afterCount =
            allCollectedInvitations.size;

        console.log(
            "Profiles after scroll:",
            afterCount
        );

        console.log(
            "New profiles:",
            afterCount - beforeCount
        );

        /*
         * Check whether we are at the bottom.
         */
        const distanceFromBottom =
            container.scrollHeight -
            (
                container.scrollTop +
                container.clientHeight
            );

        const atBottom =
            distanceFromBottom <= 10;

        console.log(
            "Current scrollTop:",
            container.scrollTop
        );

        console.log(
            "Current scrollHeight:",
            container.scrollHeight
        );

        console.log(
            "Distance from bottom:",
            distanceFromBottom
        );

        console.log(
            "At bottom:",
            atBottom
        );

        /*
         * If we found new profiles, reset the
         * stability counter.
         */
        if (afterCount > lastCount) {

            stableRounds = 0;

        } else {

            stableRounds++;
        }

        lastCount = afterCount;

        /*
         * If we reach the bottom, wait a little longer
         * and collect once more because LinkedIn may
         * render additional cards asynchronously.
         */
        if (atBottom) {

            console.log(
                "Reached bottom. Waiting for final lazy loading..."
            );

            await new Promise(resolve =>
                setTimeout(resolve, 3000)
            );

            getSentInvitations();

            const finalCount =
                allCollectedInvitations.size;

            console.log(
                "Profiles after bottom wait:",
                finalCount
            );

            /*
             * If no new profiles appeared after several
             * bottom checks, we're finished.
             */
            if (
                finalCount === lastCount &&
                stableRounds >= 2
            ) {

                console.log(
                    "No additional invitations detected."
                );

                break;
            }

            lastCount = finalCount;
        }
    }

    /*
     * FINAL COLLECTION
     */
    getSentInvitations();

    const finalInvitations =
        Array.from(
            allCollectedInvitations.values()
        );

    console.log("");
    console.log("=================================");
    console.log(
        "FINAL UNIQUE SENT INVITATIONS:",
        finalInvitations.length
    );
    console.log(
        finalInvitations
    );
    console.log("=================================");

    /*
     * Send ONLY the final collected Sent Invitation
     * data to background.js.
     */
    sendCollectedInvitations();
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