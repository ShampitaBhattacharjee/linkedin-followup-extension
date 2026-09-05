console.log("LinkedIn Messaging Watcher active.");

function checkActiveConversation() {
    try {
        const profileLink = document.querySelector("a[href*='/in/']");
        if (!profileLink) return;

        const rawUrl = profileLink.href.split("?")[0].split("#")[0];

        const chatContainer = document.querySelector(".msg-s-message-list") || document.body;
        const messages = chatContainer.querySelectorAll(".msg-s-event-listitem");

        if (messages.length === 0) return;

        const lastMessage = messages[messages.length - 1];
        const isIncoming = !lastMessage.classList.contains("msg-s-event-listitem--other-user");

        if (isIncoming) {
            console.log("Detected incoming message from:", rawUrl);
            chrome.runtime.sendMessage({
                type: "AUTO_DETECT_REPLY",
                linkedinUrl: rawUrl
            });
        }
    } catch (err) {
        console.error("Messaging scan error:", err);
    }
}

setInterval(checkActiveConversation, 4000);