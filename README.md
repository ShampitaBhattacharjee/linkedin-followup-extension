# LinkedIn Follow-Up Tracker 

A Chrome Extension that helps you **track LinkedIn connection requests, connections, conversations, and follow-ups** using your own Google Sheet as the central source of truth.

The extension is designed for people who actively network on LinkedIn and often forget when to follow up with connections or conversations.

> **No automatic messages are sent.** The extension only tracks activity and reminds you when it is time to follow up.

---

## Features

### Connection Request Tracking

- Automatically detects sent LinkedIn connection requests.
- Tracks pending connection requests.
- Captures relevant profile information.
- Automatically synchronizes tracked profiles with Google Sheets.
- Prevents unnecessary manual data entry.

### Conversation Tracking

The extension monitors your LinkedIn messaging activity and keeps track of:

- Whether a conversation has started
- Number of messages exchanged
- When the last message was sent
- Whether a response has been received
- Follow-up status

### Smart Follow-Up Reminders

The extension helps you stay consistent with networking by calculating follow-up timing based on your activity.

Example workflow:

```text
Connection Accepted
        ↓
Send Initial Message
        ↓
No Reply?
        ↓
Follow-up Reminder → 2 Days
        ↓
Still No Reply?
        ↓
Follow-up Reminder → 7 Days
```

For newly accepted connections, the extension can remind you to send an initial message.

### 📊 Google Sheets Integration

Your Google Sheet acts as the **single source of truth**.

The extension can:

- Connect to your Google Sheet
- Create the required columns automatically
- Add new LinkedIn contacts
- Update existing contacts
- Store connection and messaging information
- Keep your networking data accessible outside the extension

This means your tracked data isn't dependent on Chrome's local storage.

###  Extension Dashboard

The extension provides a simple interface where you can:

- View tracked people
- See their current status
- Check follow-up information
- Open their LinkedIn profile
- Access your networking data quickly

###  Networking Analytics

The project can be extended to provide useful networking insights such as:

- Connection acceptance rate
- Response rate
- Reply rate
- Follow-up completion
- Connections by company
- Response rate by company sector

---

#  Architecture

```text
                   ┌─────────────────────┐
                   │      LinkedIn       │
                   │                     │
                   │ Invitations         │
                   │ Connections         │
                   │ Messaging           │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │  Chrome Extension   │
                   │                     │
                   │ Content Script      │
                   │ Background Worker   │
                   │ Extension UI        │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │   Google Apps       │
                   │      Script        │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │    Google Sheet     │
                   │                     │
                   │ Single Source of    │
                   │ Truth               │
                   └─────────────────────┘
```

---

#  Project Components

## 1. Content Script

The content script interacts with LinkedIn pages and extracts the information required by the extension.

It handles pages such as:

```text
/invitation-manager/sent/
/invite-connect/connections/
```

It is responsible for detecting relevant LinkedIn profiles and collecting information required for synchronization.

---

## 2. Background Service Worker

The background worker manages tasks that need to happen independently of the currently visible webpage.

Responsibilities include:

- Scheduled synchronization
- Extension state management
- Notifications
- Communication between extension components
- Triggering periodic LinkedIn checks

The extension uses Chrome's Manifest V3 architecture.

---

## 3. Google Apps Script

Google Apps Script acts as the bridge between the Chrome Extension and Google Sheets.

The extension sends structured data to the Apps Script endpoint, which then updates the spreadsheet.

```text
Chrome Extension
       │
       │ HTTP Request
       ▼
Google Apps Script
       │
       ▼
Google Sheets
```

---

## 4. Google Sheet

The Google Sheet stores the tracked networking information.

A typical record can contain information such as:

| Field | Description |
|---|---|
| Name | LinkedIn profile name |
| Profile URL | LinkedIn profile |
| Company | Current company |
| Status | Connection / Pending / Accepted |
| Message Count | Number of messages |
| Last Message | Last message activity |
| Follow-Up | Current follow-up status |
| Next Follow-Up | Suggested follow-up date |
| Updated At | Last synchronization time |

> The exact columns can be modified according to the implementation.

---

#  How It Works

## Step 1 — Connect Google Sheet

The user connects their Google Sheet to the extension.

If the sheet is empty, the extension creates the required headers automatically.

---

## Step 2 — Scan LinkedIn

The extension periodically checks supported LinkedIn pages.

For example:

```text
LinkedIn Sent Invitations
            ↓
Find pending invitations
            ↓
Extract profile information
            ↓
Compare with existing Sheet data
            ↓
Add / Update records
```

---

## Step 3 — Track Connections

Once a connection is accepted, the contact's status can be updated.

```text
Pending
   ↓
Accepted
```

---

## Step 4 — Track Messaging

When the user communicates with a connection, the extension tracks relevant messaging activity.

The extension uses the message activity to determine when the next follow-up may be required.

---

## Step 5 — Follow-Up

The extension calculates follow-up timing based on the last relevant activity.

Example:

```text
Connection Accepted
        ↓
Reminder to send message
        ↓
Message Sent
        ↓
Wait 2 Days
        ↓
No Reply?
        ↓
Follow-up Reminder
        ↓
Wait 7 Days
        ↓
No Reply?
        ↓
Final Follow-up Reminder
```

---

# ⏱️ Automatic Synchronization

The extension uses Chrome's scheduling capabilities to periodically perform synchronization.

The intended workflow is:

```text
Every 30 Minutes
       ↓
Open / Check LinkedIn
       ↓
Detect Changes
       ↓
Compare With Sheet
       ↓
Update Sheet
```

The user does not need to manually enter every connection.

---

#  Notifications

The extension can generate browser notifications when an action requires the user's attention.

Examples:

> Connection accepted — send an introductory message.

or

> Follow-up due — consider following up with this connection.

The extension **does not automatically send LinkedIn messages**.

The final decision and action always remain with the user.

---

#  Privacy & Data Handling

Privacy is an important part of the project.

### Single Source of Truth

The project intentionally uses Google Sheets as the primary storage layer for tracked networking information.

The extension does not rely on Chrome storage as the permanent database for scraped LinkedIn information.

### No Automatic Messaging

The extension does not automatically:

- Send connection requests
- Send LinkedIn messages
- Send follow-up messages
- Like posts
- Comment on posts

It only assists with tracking and reminders.

### One LinkedIn Account

The current design assumes:

```text
1 User
   ↓
1 LinkedIn Account
   ↓
1 Google Sheet
```

---

#  Tech Stack

### Frontend / Extension

- JavaScript
- HTML
- CSS
- Chrome Extension APIs
- Manifest V3

### Automation

- Chrome Alarms API
- Chrome Notifications API
- Background Service Worker

### Data

- Google Sheets
- Google Apps Script

### Version Control

- Git
- GitHub

---

# Project Structure

A typical project structure looks like:

```text
linkedin-followup-tracker/
│
├── manifest.json
│
├── background.js
├── content.js
│
├── popup.html
├── popup.js
├── popup.css
│
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
└── README.md
```

> File names may differ slightly depending on the current implementation.

---

#  Installation

## Prerequisites

Before installing the extension, make sure you have:

- Google Chrome
- A Google account
- A Google Sheet
- Access to the project source code

---

## 1. Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
```

Navigate into the project:

```bash
cd linkedin-followup-tracker
```

---

## 2. Open Chrome Extensions

Open:

```text
chrome://extensions/
```

Enable:

```text
Developer mode
```

---

## 3. Load the Extension

Click:

```text
Load unpacked
```

Select the project directory.

The extension should now appear in your Chrome extensions list.

---

#  Google Sheets Setup

1. Create a new Google Sheet.
2. Create the required Apps Script.
3. Deploy the Apps Script as a Web App.
4. Configure the endpoint in the extension.
5. Open the extension.
6. Connect/select your Google Sheet.
7. Allow the required permissions.

Once configured, the extension can synchronize tracked LinkedIn information with the sheet.

---

#  Usage

After installation:

### 1. Open the Extension

Click the extension icon in Chrome.

### 2. Connect Your Sheet

Select or configure the Google Sheet that should store your networking data.

### 3. Use LinkedIn Normally

Continue using LinkedIn normally.

The extension tracks supported activity in the background.

### 4. Check Your Follow-Ups

Open the extension to see contacts that require attention.

### 5. Open LinkedIn

Use the profile action to quickly navigate back to the person's LinkedIn profile.

---

# Example Workflow

Imagine you send a connection request to:

```text
John Doe
Software Engineer
Google
```

The extension records:

```text
John Doe
↓
Connection Request Sent
↓
Pending
```

When John accepts:

```text
Pending
   ↓
Accepted
```

The extension can then remind you:

```text
Send an introductory message
```

After you send the message:

```text
Message Sent
↓
Wait 2 Days
```

If there is no response:

```text
Follow-Up #1
↓
Wait 7 Days
↓
Follow-Up #2
```

This helps prevent promising networking opportunities from being forgotten.

---

#  Future Improvements

The project can be expanded with additional functionality.

### Analytics Dashboard

```text
Total Connections
        ↓
Acceptance Rate
        ↓
Response Rate
        ↓
Reply Rate
        ↓
Follow-Up Success Rate
```

### Advanced Analytics

- Response rate by company
- Response rate by industry
- Response rate by job title
- Best-performing outreach periods
- Average response time
- Follow-up conversion rate

### Additional Features

- Custom follow-up intervals
- Contact tagging
- Notes
- Priority contacts
- Follow-up history
- Search and filtering
- Export reports
- Dark mode
- Multiple Google Sheet views

---

#  Limitations

This project depends on LinkedIn's website structure.

Changes to LinkedIn's:

- HTML structure
- CSS classes
- Page layout
- URLs
- Client-side behavior

may require updates to the extension.

The extension also intentionally does **not** automatically send messages or connection requests.

---

#  Contributing

Contributions are welcome.

To contribute:

```bash
git fork <repository>
```

Create a new branch:

```bash
git checkout -b feature/new-feature
```

Make your changes and commit:

```bash
git add .
git commit -m "Add new feature"
```

Push the branch:

```bash
git push origin feature/new-feature
```

Then open a Pull Request.

---

#  Responsible Use

This project is intended to help users organize their own LinkedIn networking activity.

Users should:

- Respect LinkedIn's Terms of Service.
- Avoid excessive automated requests.
- Avoid spam.
- Respect other users' privacy.
- Keep authentication credentials secure.
- Use the extension responsibly.

The extension is designed as a **personal productivity and follow-up tool**, not as an automated messaging or mass-outreach system.

---

#  License

Add your preferred license here.

Example:

```text
MIT License
```

---

#  Author

**Shampita Bhattacharjee**

Built as a productivity tool for managing LinkedIn networking and follow-ups.

---

##  If You Find This Project Useful

Consider giving the repository a ⭐ on GitHub and sharing your feedback!

---
