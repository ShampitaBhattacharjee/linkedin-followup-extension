const CLIENT_ID =
  "954030658876-2v73ctjpsus51cmkg5ssu09tob2fnd0n.apps.googleusercontent.com";

document.addEventListener("DOMContentLoaded", () => {
  const button = document.createElement("button");
  button.textContent = "Connect Google Sheet";

  document.body.appendChild(button);

  button.addEventListener("click", () => {
    chrome.identity.getAuthToken(
      {
        interactive: true
      },
      (token) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          alert("Google login failed. Check the console.");
          return;
        }

        console.log("Google OAuth successful!");
        console.log("Token:", token);

        alert("Google account connected successfully!");
      }
    );
  });
});