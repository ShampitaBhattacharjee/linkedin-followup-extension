let trackerRows = [];
let statusChartInstance = null;
let stageChartInstance = null;
let currentFilter = "today";

document.addEventListener("DOMContentLoaded", () => {
    initDashboard();

    document.getElementById("refreshBtn").addEventListener("click", loadDataFromSheet);
    
    document.querySelectorAll(".filter-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
            document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            currentFilter = e.target.dataset.filter;
            renderTasksTable();
        });
    });
});

async function initDashboard() {
    const storage = await chrome.storage.local.get(["spreadsheetUrl"]);
    if (storage.spreadsheetUrl) {
        document.getElementById("openSheetBtn").href = storage.spreadsheetUrl;
    }
    await loadDataFromSheet();
}

async function loadDataFromSheet() {
    const tableBody = document.getElementById("taskTableBody");
    tableBody.innerHTML = `<tr><td colspan="7" class="loading-cell">Syncing latest data from Google Sheets...</td></tr>`;

    try {
        const response = await chrome.runtime.sendMessage({ type: "FETCH_SHEET_DATA" });
        if (!response.success) throw new Error(response.error);

        trackerRows = response.data || [];
        updateMetrics();
        renderCharts();
        renderTasksTable();
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="7" class="loading-cell" style="color: #dc2626;">Failed to load data: ${error.message}</td></tr>`;
    }
}

function updateMetrics() {
    const totalSent = trackerRows.length;
    const accepted = trackerRows.filter(r => r.status === "Accepted" || r.status === "Reply Received" || r.status === "Completed").length;
    const replies = trackerRows.filter(r => r.status === "Reply Received").length;

    const todayStr = new Date().toLocaleDateString("en-IN");
    const actionsToday = trackerRows.filter(r => {
        if (r.status === "Pending" || r.status === "Reply Received" || r.status === "Completed") return false;
        return isDueTodayOrOverdue(r.followUpDate);
    }).length;

    document.getElementById("metricTotalSent").textContent = totalSent;
    document.getElementById("metricAccepted").textContent = accepted;
    document.getElementById("metricAcceptRate").textContent = `${totalSent > 0 ? Math.round((accepted / totalSent) * 100) : 0}% Acceptance Rate`;
    
    document.getElementById("metricReplies").textContent = replies;
    document.getElementById("metricReplyRate").textContent = `${accepted > 0 ? Math.round((replies / accepted) * 100) : 0}% Conversion Rate`;
    
    document.getElementById("metricActionsToday").textContent = actionsToday;
}

function isDueTodayOrOverdue(dateStr) {
    if (!dateStr || dateStr === "-") return false;
    
    // Handles formats like DD/MM/YYYY or D/M/YYYY
    const parts = dateStr.split("/");
    if (parts.length !== 3) return false;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Months are 0-indexed in JS
    const year = parseInt(parts[2], 10);
    
    const targetDate = new Date(year, month, day);
    targetDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return targetDate <= today;
}

function renderCharts() {
    // Check if Chart.js is loaded
    if (typeof Chart === "undefined") {
        console.warn("Chart.js is not loaded or initialized. Skipping chart rendering.");
        return;
    }

    try {
        const statusCounts = { Pending: 0, Accepted: 0, "Reply Received": 0, Completed: 0 };
        const stageCounts = { "Day 0 (Initial)": 0, "Follow-Up 1": 0, "Follow-Up 2": 0, "Follow-Up 3": 0, "Follow-Up 4": 0 };

        trackerRows.forEach(r => {
            if (statusCounts[r.status] !== undefined) statusCounts[r.status]++;
            
            const stage = parseInt(r.stage) || 0;
            if (stage === 0) stageCounts["Day 0 (Initial)"]++;
            else if (stage === 1) stageCounts["Follow-Up 1"]++;
            else if (stage === 2) stageCounts["Follow-Up 2"]++;
            else if (stage === 3) stageCounts["Follow-Up 3"]++;
            else if (stage >= 4) stageCounts["Follow-Up 4"]++;
        });

        if (statusChartInstance) statusChartInstance.destroy();
        const statusCtx = document.getElementById("statusChart");
        if (statusCtx) {
            statusChartInstance = new Chart(statusCtx, {
                type: "doughnut",
                data: {
                    labels: Object.keys(statusCounts),
                    datasets: [{ data: Object.values(statusCounts), backgroundColor: ["#f59e0b", "#3b82f6", "#22c55e", "#a855f7"] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        if (stageChartInstance) stageChartInstance.destroy();
        const stageCtx = document.getElementById("stageChart");
        if (stageCtx) {
            stageChartInstance = new Chart(stageCtx, {
                type: "bar",
                data: {
                    labels: Object.keys(stageCounts),
                    datasets: [{ label: "Contacts", data: Object.values(stageCounts), backgroundColor: "#0a66c2" }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    } catch (err) {
        console.error("Error rendering charts:", err);
    }
}

function renderTasksTable() {
    const tableBody = document.getElementById("taskTableBody");
    tableBody.innerHTML = "";

    let filtered = trackerRows;

    if (currentFilter === "today") {
        filtered = trackerRows.filter(r => (r.status === "Accepted") && isDueTodayOrOverdue(r.followUpDate));
    } else if (currentFilter === "upcoming") {
        filtered = trackerRows.filter(r => (r.status === "Accepted") && !isDueTodayOrOverdue(r.followUpDate));
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="loading-cell">No tasks match the selected filter.</td></tr>`;
        return;
    }

    filtered.forEach(row => {
        const tr = document.createElement("tr");
        const stageText = row.stage === "0" ? "Day 0 Message" : `Follow-Up ${row.stage}`;
        
        const isAccepted = row.status === "Accepted";
        const isDue = isDueTodayOrOverdue(row.followUpDate);

        // Disable "Mark Done" if the follow-up date is in the future
        const markDoneDisabledAttr = !isDue ? "disabled" : "";

        const actionButtonsHtml = isAccepted
            ? `
                <button class="btn btn-sm btn-dm action-dm" data-url="${escapeHtml(row.linkedinUrl)}">Open DM ↗</button>
                <button class="btn btn-sm btn-done action-done" data-row="${row.rowNumber}" data-stage="${row.stage}" ${markDoneDisabledAttr}>Mark Done ✓</button>
                <button class="btn btn-sm btn-reply action-reply" data-row="${row.rowNumber}">Replied 💬</button>
              `
            : `<button class="btn btn-sm btn-dm action-dm" data-url="${escapeHtml(row.linkedinUrl)}">Open DM ↗</button>`;

        tr.innerHTML = `
            <td><strong>${escapeHtml(row.name)}</strong></td>
            <td><span class="badge badge-${row.status.toLowerCase().replace(" ", "")}">${row.status}</span></td>
            <td>${stageText}</td>
            <td>${escapeHtml(row.invitationNote || "-")}</td>
            <td>${row.lastContacted || "-"}</td>
            <td>${row.followUpDate || "-"}</td>
            <td>${actionButtonsHtml}</td>
        `;

        // Attach event listeners safely
        tr.querySelector(".action-dm").addEventListener("click", (e) => {
            const url = e.currentTarget.getAttribute("data-url");
            openDM(url);
        });

        if (isAccepted) {
            const markDoneBtn = tr.querySelector(".action-done");
            if (isDue) {
                markDoneBtn.addEventListener("click", (e) => {
                    const rowNum = e.currentTarget.getAttribute("data-row");
                    const stage = e.currentTarget.getAttribute("data-stage");
                    markDone(rowNum, stage);
                });
            }

            tr.querySelector(".action-reply").addEventListener("click", (e) => {
                const rowNum = e.currentTarget.getAttribute("data-row");
                markReplied(rowNum);
            });
        }

        tableBody.appendChild(tr);
    });
}

function openDM(url) {
    if (!url) return;
    
    // Clean URL to ensure it opens the base LinkedIn profile page directly
    const baseUrl = url.split("?")[0].replace(/\/$/, "");
    window.open(baseUrl, "_blank");
}

async function markDone(rowNumber, currentStage) {
    await chrome.runtime.sendMessage({
        type: "MARK_ACTION_DONE",
        rowNumber: rowNumber,
        currentStage: parseInt(currentStage) || 0
    });
    await loadDataFromSheet();
}

async function markReplied(rowNumber) {
    await chrome.runtime.sendMessage({
        type: "MARK_REPLIED",
        rowNumber: rowNumber
    });
    await loadDataFromSheet();
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}