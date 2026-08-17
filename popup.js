document.addEventListener("DOMContentLoaded", () => {
  const button = document.createElement("button");
  button.textContent = "Create Sheet Headers";

  document.body.appendChild(button);

  button.addEventListener("click", createHeaders);

  async function createHeaders() {
    try {
      const stored = await chrome.storage.local.get([
        "selectedSheetId",
        "selectedSheetName"
      ]);

      if (!stored.selectedSheetId) {
        alert("Please select a Google Sheet first.");
        return;
      }

      const result = await chrome.identity.getAuthToken({
        interactive: true,
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets"
        ]
      });

      const token = result.token;

      const headers = [
        "Name",
        "LinkedIn URL",
        "Company",
        "Industry",
        "Connection Sent",
        "Connection Accepted",
        "Message Sent",
        "Message Date",
        "Reply Received",
        "Reply Date",
        "Follow-up 3D",
        "Follow-up 7D"
      ];

      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${stored.selectedSheetId}/values/A1:L1?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            values: [headers]
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error?.message || `Sheets API error: ${response.status}`
        );
      }

      alert(
        `Headers created successfully in:\n${stored.selectedSheetName}`
      );

    } catch (error) {
      console.error("Header creation error:", error);
      alert("Error:\n\n" + error.message);
    }
  }
});