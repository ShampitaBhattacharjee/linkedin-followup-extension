document.addEventListener("DOMContentLoaded", () => {
  const button = document.createElement("button");
  button.textContent = "Load My Google Sheets";

  document.body.appendChild(button);

  button.addEventListener("click", async () => {
    try {
      const result = await chrome.identity.getAuthToken({
        interactive: true,
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive.readonly"
        ]
      });

      const token = result.token;

      const response = await fetch(
        "https://www.googleapis.com/drive/v3/files" +
        "?q=mimeType%3D'application%2Fvnd.google-apps.spreadsheet'" +
        "&fields=files(id,name)"
        + "&orderBy=name",
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Google Drive API error: ${response.status}`);
      }

      const data = await response.json();

      console.log("Google Sheets:", data.files);

      alert(
        `Found ${data.files.length} Google Sheet(s).\n\n` +
        data.files.map(file => file.name).join("\n")
      );

    } catch (error) {
      console.error("Sheet loading error:", error);
      alert("Error:\n\n" + error.message);
    }
  });
});