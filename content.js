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


    /* =================================================
       PROFILE COLLECTION
    ================================================= */

    function getSentInvitations() {

        const invitations = [];
        const seen = new Set();

        const links = [
            ...document.querySelectorAll("a[href*='/in/']")
        ];

        console.log(
            "Profile links found:",
            links.length
        );

        links.forEach((link, index) => {

            try {

                const url = link.href
                    .split("?")[0]
                    .split("#")[0];

                if (!url || !url.includes("/in/")) {
                    return;
                }

                /*
                 * Find the invitation container.
                 *
                 * LinkedIn currently places the profile link
                 * inside a larger invitation/list container.
                 */

                let container =
                    link.closest("li") ||
                    link.closest('[role="listitem"]');

                /*
                 * If LinkedIn does not use <li>, walk upward
                 * until we find a container containing meaningful text.
                 */

                if (!container) {

                    let current = link.parentElement;

                    for (let i = 0; current && i < 6; i++) {

                        const text =
                            current.innerText?.trim();

                        if (
                            text &&
                            text.length > 10 &&
                            text.length < 1000
                        ) {

                            container = current;
                            break;

                        }

                        current = current.parentElement;

                    }

                }

                /*
                 * Get all visible text from the invitation.
                 */

                const fullText =
                    container?.innerText?.trim() ||
                    link.parentElement?.innerText?.trim() ||
                    "";

                /*
                 * LinkedIn profile name.
                 *
                 * The first non-empty line is normally
                 * the person's name.
                 */

                const lines =
                    fullText
                        .split("\n")
                        .map(line => line.trim())
                        .filter(Boolean);

                let name = "";

                if (lines.length > 0) {
                    name = lines[0];
                }

                /*
                 * Fallback: use the profile URL slug.
                 */

                if (!name) {

                    const match =
                        url.match(
                            /linkedin\.com\/in\/([^/?#]+)/
                        );

                    if (match) {

                        name = match[1]
                            .replace(/-\d+$/, "")
                            .replace(/-/g, " ")
                            .replace(/\b\w/g, c => c.toUpperCase());

                    }

                }

                /*
                 * Ignore if we still cannot identify
                 * the profile.
                 */

                if (!name) {
                    return;
                }

                /*
                 * Remove duplicate profile URLs.
                 */

                if (seen.has(url)) {
                    return;
                }

                seen.add(url);

                invitations.push({

                    name: name,

                    linkedinUrl: url

                });

                console.log(
                    `Profile ${index + 1}:`,
                    name,
                    url
                );

            } catch (error) {

                console.error(
                    "Error extracting profile:",
                    error
                );

            }

        });


        console.log(
            "Detected LinkedIn profiles:",
            invitations.length,
            invitations
        );


        /*
         * Send data to background service.
         */

        if (invitations.length > 0) {

            chrome.runtime.sendMessage({

                type: "LINKEDIN_DATA",

                data: invitations

            }, (response) => {

                if (chrome.runtime.lastError) {

                    console.error(
                        "Failed to send LinkedIn data:",
                        chrome.runtime.lastError.message
                    );

                } else {

                    console.log(
                        "LinkedIn data successfully sent to background."
                    );

                }

            });

        } else {

            console.warn(
                "No LinkedIn invitations were extracted."
            );

        }

        return invitations;
    }


    /* =================================================
       INITIAL COLLECTION
    ================================================= */

    async function autoScrollAndCollect() {

        console.log(
            "Starting automatic LinkedIn invitation scrolling..."
        );

        let previousCount = 0;
        let stableCount = 0;

        for (let i = 0; i < 15; i++) {

            const links =
                document.querySelectorAll("a[href*='/in/']");

            const currentCount = links.length;

            console.log(
                `Scroll ${i + 1}: ${currentCount} profile links found`
            );

            // Scroll the page
            const mainContainer = document.querySelector("main");

            if (mainContainer) {

                mainContainer.scrollTop = mainContainer.scrollHeight;
                console.log(
                    "Scrolled LinkedIn invitation list."
                );

            } else {

                console.log(
                    "Main scroll container not found."
                );

            } ``

            // Wait for LinkedIn to load more
            await new Promise(resolve =>
                setTimeout(resolve, 1500)
            );

            const newCount =
                document.querySelectorAll(
                    "a[href*='/in/']"
                ).length;

            if (newCount === previousCount) {

                stableCount++;

            } else {

                stableCount = 0;
            }

            previousCount = newCount;

            // If nothing new appears twice, stop
            if (stableCount >= 2) {

                console.log(
                    "No more LinkedIn profiles are loading."
                );

                break;
            }
        }

        console.log(
            "Automatic scrolling finished."
        );

        getSentInvitations();
    }


    setTimeout(() => {

        autoScrollAndCollect();

    }, 5000);


    /* =================================================
       WATCH FOR LOAD MORE / DOM CHANGES
    ================================================= */

    const observer =
        new MutationObserver(() => {

            getSentInvitations();

        });


    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );

}