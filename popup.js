document.addEventListener("DOMContentLoaded", () => {
  const button = document.createElement("button");
  button.textContent = "Load My Google Sheets";

  const container = document.createElement("div");
  container.style.marginTop = "15px";

  document.body.appendChild(button);
  document.body.appendChild(container);

  button.addEventListener("click", loadSheets);

  async function loadSheets() {
    try {
      container.innerHTML = "Loading...";

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
        "&fields=files(id,name)" +
        "&orderBy=name",
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

      container.innerHTML = "";

      if (!data.files || data.files.length === 0) {
        container.textContent = "No Google Sheets found.";
        return;
      }

      const label = document.createElement("label");
      label.textContent = "Select your Google Sheet:";
      label.style.display = "block";
      label.style.marginBottom = "8px";

      const select = document.createElement("select");
      select.style.width = "100%";
      select.style.padding = "6px";

      data.files.forEach((file) => {
        const option = document.createElement("option");

        option.value = file.id;
        option.textContent = file.name;

        select.appendChild(option);
      });

      const saveButton = document.createElement("button");
      saveButton.textContent = "Use This Sheet";
      saveButton.style.marginTop = "10px";

      container.appendChild(label);
      container.appendChild(select);
      container.appendChild(saveButton);

      saveButton.addEventListener("click", async () => {
        const selectedId = select.value;
        const selectedName =
          select.options[select.selectedIndex].textContent;

        await chrome.storage.local.set({
          selectedSheetId: selectedId,
          selectedSheetName: selectedName
        });

        alert(`Selected Sheet:\n${selectedName}`);
      });

    } catch (error) {
      console.error("Sheet loading error:", error);
      container.textContent = "Error: " + error.message;
    }
  }
});