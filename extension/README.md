# SaarthiFlow Chrome Extension

> **From Browsing to Doing**  
> An Agentic AI productivity companion that extracts meaningful information from webpages, transforms it into structured task proposals, and integrates with the SaarthiFlow human-in-the-loop approval workflow.

---

## 1. Extension Overview

The **SaarthiFlow Chrome Extension** bridges the gap between passive browsing and actionable productivity. When inspecting hackathon pages, course portals, internship postings, or documentation, the extension:

1. **Extracts Real Webpage Data**: Targets primary semantic content (`main`, `article`), discovers headings, and deterministically pinpoints dates and deadlines while stripping ads, scripts, navigation, and boilerplate.
2. **Operates in Two Modes**:
   - **Mode A (Local Demo Mode)**: Runs 100% offline with zero dependencies or backend requirements. Extracts real page structure, analyzes keywords and deadlines, and generates customizable proposed tasks stored locally in `chrome.storage.local`.
   - **Mode B (Live Backend Mode)**: Routes through the SaarthiFlow Backend to trigger Activepieces workflows and AI agents, returning proposals directly into the popup.
3. **Supports Human-in-the-Loop Approvals**: Users can edit task titles, adjust priorities, change due dates, add custom tasks, and select specific items before sending proposals to SaarthiFlow's Approvals dashboard.

---

## 2. Directory Structure

```text
extension/
├── manifest.json       # Chrome Manifest V3 configuration & permissions
├── popup.html          # Extension popup markup
├── popup.css           # Premium SaaS styles matching SaarthiFlow brand
├── popup.js            # Controller managing UI, extraction, and state
├── background.js       # Manifest V3 service worker & badge indicator
├── content.js          # DOM extraction engine (scripts, ads, & noise stripped)
├── config.js           # Configuration, defaults, storage keys, and URL helpers
├── api.js              # Dual-mode API adapter (Local Demo & Live Backend)
├── icons/
│   ├── icon16.png      # 16x16 crisp favicon
│   ├── icon48.png      # 48x48 extension toolbar icon
│   └── icon128.png     # 128x128 high-res store icon
└── README.md           # Documentation, testing guide, and API contract
```

---

## 3. Chrome Installation Guide (Windows / Mac / Linux)

### Step 1: Open Chrome Extensions
1. Launch Google Chrome.
2. In the address bar, type `chrome://extensions` and press **Enter**.

### Step 2: Enable Developer Mode
1. In the top-right corner of the Extensions page, toggle the **Developer mode** switch **ON**.

### Step 3: Load the Unpacked Extension
1. Click the **Load unpacked** button located in the top-left toolbar.
2. In the file picker dialog, navigate to your SaarthiFlow project folder:
   ```text
   C:\Users\<YourUsername>\...\SaarthiFlow\extension
   ```
3. Select the **`extension`** folder (the folder containing `manifest.json`) and click **Select Folder**.

### Step 4: Pin the Extension
1. Click the puzzle icon (Extensions) next to the Chrome address bar.
2. Locate **SaarthiFlow — From Browsing to Doing**.
3. Click the pin icon to pin it to your toolbar for one-click access.

> **Note**: No `npm install`, `npm run build`, or `npm run dev` is required for the extension. It uses pure vanilla JavaScript, HTML5, and CSS3.

---

## 4. Testing Instructions

### Scenario A: Testing in Local Demo Mode (No Backend Needed)
*Demo Mode is active by default, allowing complete testing right away.*

1. Open any regular webpage in Chrome (e.g. [https://devpost.com](https://devpost.com), a GitHub repo, or any competition/article page).
2. Click the **SaarthiFlow extension icon** in your toolbar.
3. Notice:
   - The top status pill displays **Demo Mode**.
   - The active tab's title, domain, and favicon are displayed.
4. Click **"Analyze This Page"**:
   - The extension will inject `content.js` and extract the page text and dates.
   - A summary and detected deadlines are presented.
   - Categorized task proposals appear in the **Suggested Tasks** list.
5. **Edit Tasks**:
   - Click any task title to modify it.
   - Change the priority using the dropdown (**High**, **Medium**, **Low**).
   - Change the due date with the date picker.
   - Click **+ Add Task** to append a custom task item.
   - Use the trash icon to delete unwanted tasks.
6. **Select & Submit**:
   - Check or uncheck individual tasks, or use **Select All** / **Deselect All**.
   - Click **"Send N Tasks for Approval"**.
   - A confirmation banner will confirm: `"Saved locally to Chrome Storage — not submitted to SaarthiFlow backend."`
7. **Verify Demo Storage**:
   - Click the **Settings** gear icon in the top right.
   - Under **Demo Storage**, see the incremented count of stored proposals.
   - Click **Clear Demo Data** to reset.

---

### Scenario B: Switching to Live Backend Mode

When the SaarthiFlow backend server is running:

1. Click the **Settings** gear icon in the popup.
2. In the **Operating Mode** segment, select **Live Backend**.
3. Verify or adjust the URLs:
   - **Backend API Base URL**: `http://localhost:3000` (or your backend port)
   - **SaarthiFlow Web Dashboard URL**: `http://localhost:5173`
4. Click **Test Connection**:
   - If your backend is online and exposes `GET /api/health`, you will see **Connected (HTTP 200)**.
   - If offline, the extension cleanly displays **Unreachable / Server offline**.
5. Click **Save Settings**.
6. Return to the main view and click **"Analyze This Page"**:
   - Webpage content is sent to `POST /api/analyze`.
   - Proposed tasks from the backend/Activepieces agent are rendered.
   - Clicking **"Send for Approval"** sends the selected tasks to `POST /api/proposals`.
   - Links in the footer ("Approvals", "Dashboard", "My Tasks") open the live dashboard.

---

## 5. Backend API Contract (For Activepieces & Backend Teammate)

To connect the Chrome extension to your backend, implement the following four REST endpoints on your server.

### 1. Health Check
- **Endpoint**: `GET /api/health`
- **Purpose**: Verify backend connectivity and extension access.
- **Response** (`200 OK`):
  ```json
  {
    "status": "ok",
    "version": "1.0.0",
    "service": "saarthiflow-backend"
  }
  ```

---

### 2. Analyze Webpage
- **Endpoint**: `POST /api/analyze`
- **Purpose**: Receive extracted webpage payload from extension, pass to Activepieces/LLM agent, and return proposed tasks.
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "url": "https://hackowasp.devpost.com",
    "title": "HackOWASP 2026",
    "domain": "hackowasp.devpost.com",
    "favicon": "https://hackowasp.devpost.com/favicon.ico",
    "metaDescription": "Join HackOWASP 2026 to build cutting-edge security and productivity tools.",
    "extractedText": "Registration closes November 18, 2026. Teams of up to 4 participants...",
    "headings": [
      { "level": "h1", "text": "HackOWASP 2026" },
      { "level": "h2", "text": "Prizes and Tracks" }
    ],
    "dates": [
      { "type": "deadline", "label": "Deadline", "text": "November 18, 2026", "context": "Registration closes November 18, 2026" }
    ],
    "links": [
      { "title": "Register Now", "url": "https://hackowasp.devpost.com/register" }
    ]
  }
  ```
- **Synchronous Response** (`200 OK`):
  ```json
  {
    "success": true,
    "summary": "HackOWASP 2026 is an upcoming cybersecurity and AI hackathon ending November 18.",
    "category": "Hackathon",
    "deadlines": [
      "Deadline: November 18, 2026"
    ],
    "requirements": [
      "Team size: 1-4 members",
      "Working prototype and public GitHub repo required"
    ],
    "tasks": [
      {
        "id": "t-1",
        "title": "Register team for HackOWASP",
        "description": "Complete registration form before deadline",
        "priority": "High",
        "due": "2026-11-18",
        "project": "Hackathon"
      },
      {
        "id": "t-2",
        "title": "Draft problem statement & MVP scope",
        "description": "Plan architecture and user personas",
        "priority": "High",
        "due": "2026-11-20",
        "project": "Hackathon"
      }
    ]
  }
  ```
- **Optional Asynchronous Response** (for long-running Activepieces workflows):
  ```json
  {
    "success": true,
    "status": "pending",
    "jobId": "job-8f2a1b9c",
    "message": "Analysis running in background"
  }
  ```

---

### 3. Submit Tasks for Approval
- **Endpoint**: `POST /api/proposals`
- **Purpose**: Create a pending proposal in the SaarthiFlow database for human approval.
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "title": "HackOWASP 2026",
    "url": "https://hackowasp.devpost.com",
    "source": "Chrome Extension",
    "summary": "HackOWASP 2026 is an upcoming cybersecurity and AI hackathon ending November 18.",
    "tasks": [
      {
        "title": "Register team for HackOWASP",
        "description": "Complete registration form before deadline",
        "priority": "High",
        "due": "2026-11-18",
        "project": "Hackathon"
      },
      {
        "title": "Draft problem statement & MVP scope",
        "description": "Plan architecture and user personas",
        "priority": "High",
        "due": "2026-11-20",
        "project": "Hackathon"
      }
    ]
  }
  ```
- **Response** (`201 Created` or `200 OK`):
  ```json
  {
    "success": true,
    "proposalId": "prop-4a7b9c1d",
    "message": "Plan sent for approval in SaarthiFlow"
  }
  ```

---

## 6. Security & Privacy Safeguards

- **Strict Sandbox**: Does NOT read input field contents, password inputs, form controls, or hidden DOM subtrees.
- **Minimal Permissions**: Utilizes only `activeTab`, `scripting`, and `storage`.
- **No Third-Party Scripts**: 100% vanilla JavaScript, HTML, and CSS. No remote scripts loaded; fully compliant with Manifest V3 Content Security Policy (CSP).
- **Safe DOM Injection**: Content is injected via `textContent` and dynamic element construction (`document.createElement`). Untrusted webpage HTML is never executed or injected via `innerHTML`.
- **Restricted Pages**: System pages (`chrome://`, `edge://`, `devtools://`, extension settings) are automatically detected and prevented with user-friendly notices.

---

## 7. Reloading & Inspecting Logs

- **Inspect Popup**: Right-click anywhere in the extension popup and select **Inspect**. This opens the Chrome DevTools console for `popup.js`.
- **Inspect Service Worker**: In `chrome://extensions`, find SaarthiFlow and click **Inspect views: service worker** to view background logs.
- **Reloading Code**: Whenever you modify extension files:
  1. Go to `chrome://extensions`.
  2. Click the **Reload** (circular arrow) icon on the SaarthiFlow extension card.
