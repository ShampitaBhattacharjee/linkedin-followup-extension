// profile.js - Runs on linkedin.com/in/*

function autoClickMessageButton() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("autoMessage") !== "true") return;

    console.log("Auto-message parameter detected. Waiting for Message button...");

    let hasClicked = false;
    const startTime = Date.now();
    const timeout = 12000;

    const checkInterval = setInterval(() => {
        if (hasClicked) {
            clearInterval(checkInterval);
            return;
        }

        // Target the <a> element matching LinkedIn's messaging overlay structure
        const msgAnchor = 
            document.querySelector("a[href*='/messaging/compose/']") ||
            document.querySelector("a[href*='/messaging/thread/']") ||
            document.querySelector("a[componentkey*='msgOverlay']") ||
            Array.from(document.querySelectorAll("a, button")).find(el => el.innerText?.trim() === "Message");

        if (msgAnchor) {
            hasClicked = true;
            clearInterval(checkInterval);

            console.log("Message action element located:", msgAnchor);

            // Scroll into view & trigger native click
            msgAnchor.scrollIntoView({ behavior: "smooth", block: "center" });

            setTimeout(() => {
                msgAnchor.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
                msgAnchor.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
                msgAnchor.click();

                // Clean URL query parameter without navigating away
                const cleanUrl = window.location.href.replace(/([?&])autoMessage=true(&|$)/, "$1").replace(/[?&]$/, "");
                window.history.replaceState({}, document.title, cleanUrl);
            }, 300);
        }

        if (Date.now() - startTime > timeout) {
            clearInterval(checkInterval);
            console.warn("Message button could not be targeted within timeout.");
        }
    }, 800);
}

if (document.readyState === "complete" || document.readyState === "interactive") {
    autoClickMessageButton();
} else {
    document.addEventListener("DOMContentLoaded", autoClickMessageButton);
}