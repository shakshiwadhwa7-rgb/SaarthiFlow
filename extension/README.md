# SaarthiFlow Chrome Extension — "Agents That Get Work Done"

> **From Browsing to Doing**  
> An Agentic Productivity Extension that transforms web discoveries into structured, executable action plans with human-in-the-loop approvals.

---

## 1. Hackathon Problem Alignment

### Why the old approach failed
Previously, the extension behaved like a generic summarizer:
- Generated passive text summaries of webpages.
- Fabricated generic placeholder tasks even on blank or irrelevant pages.
- Treated all websites identically without recognizing opportunities.
- Failed to bridge passive browsing with the SaarthiFlow execution engine.

### The Agentic Solution
SaarthiFlow transforms passive browsing into active execution via a closed-loop agentic workflow:

```text
DISCOVER → UNDERSTAND → PLAN → APPROVE → EXECUTE → VERIFY
```

1. **DISCOVER**: Accurately classifies whether the current webpage is an actionable opportunity (Hackathon, Internship, Job, Specific GitHub Repository, Workshop, Event, Scholarship, Assignment) or a general non-actionable page.
2. **UNDERSTAND**: Extracts actionable metadata (Opportunity Title, Organizer, Deadlines, Eligibility, Requirements, Required Documents, and Action Links) without reading private input fields or passwords.
3. **PLAN**: Connects to the SaarthiFlow backend (`POST /api/agent/plan` powered by Gemini) to draft context-aware, structured action items. (In offline Demo Mode, an intelligent deterministic planner is used).
4. **APPROVE**: Empowers the user to review, edit titles, modify priorities (High, Medium, Low), adjust due dates, add custom tasks, and select specific items before sending for approval.
5. **EXECUTE**: Submits the proposal to the SaarthiFlow backend database (`POST /api/approvals`). Modifying actions are **never** executed prematurely.
6. **VERIFY**: The user opens SaarthiFlow Approvals (`/approvals`) to make the final decision. Approved tasks immediately sync to **My Space** (`/space`) and log into **Activity** (`/activity`).

---

## 2. Directory Structure

```text
extension/
├── manifest.json       # Chrome Manifest V3 configuration & minimal permissions
├── popup.html          # Action-oriented popup dashboard (~390px width)
├── popup.css           # SaarthiFlow SaaS design system (lavender/purple accents)
├── popup.js            # Controller for UI, task manipulation, and workflow status
├── background.js       # Manifest V3 service worker & toolbar badge management
├── content.js          # Opportunity classifier & semantic DOM extraction engine
├── config.js           # Configuration, endpoint mappings, and storage keys
├── api.js              # Agentic orchestration layer (Live Mode + Demo Mode)
├── icons/
│   ├── icon16.png      # 16x16 icon
│   ├── icon48.png      # 48x48 toolbar icon
│   └── icon128.png     # 128x128 high-res icon
└── README.md           # Documentation, testing guide, and API specification
```

---

## 3. Intelligent Classification Capabilities

The extension identifies specific opportunity categories:

| Category | Icon | Detection Logic | Action Plan Focus |
| :--- | :---: | :--- | :--- |
| **Hackathon** | 🏆 | Devpost, Unstop, MLH, Hackerearth, hackathon keywords, prize pool | Team registration, eligibility review, MVP prototype, demo video |
| **Internship** | 💼 | Internship postings, student developer roles, summer analyst | Resume tailoring, portfolio alignment, application submission |
| **Job Opportunity** | 💼 | Careers portals, job descriptions, responsibilities, qualifications | Role review, application submission, interview prep |
| **GitHub Repository** | 💻 | Specific `github.com/:owner/:repo` (excluding generic homepages) | Architecture review, local setup/tests, good-first-issue discovery |
| **Workshop / Event** | 🎓 | Hands-on workshops, webinars, masterclasses, agendas | Seat reservation, prerequisite setup, calendar scheduling |
| **Academic Assignment**| 📑 | Homework, problem sets, course portals, rubrics, due dates | Rubric analysis, deliverable implementation, LMS submission |
| **Technical Docs** | 📖 | API references, SDK documentation, developer guides | Reference study, proof-of-concept implementation |
| **General Webpage** | 🌐 | Non-actionable pages (e.g. `google.com`, `github.com` home) | **Shows "No clear actionable opportunity detected"**; offers Quick Task |

---

## 4. Key Agentic Features

### 1. "Turn This Page Into Actions"
The primary action button on the popup. Replaces the generic "Analyze This Page" with an immediate opportunity analysis and action plan generation.

### 2. Quick Task Modal
Enables users to capture manual tasks directly from any webpage with one click, preserving the current page URL as a reference link.

### 3. Save for Later
Instantly creates a review task for the current page in SaarthiFlow (`Review: [Page Title]`), scheduled for 3 days out.

### 4. Human-in-the-Loop Status Tracking
When tasks are submitted, the popup displays real-time workflow tracking (`Awaiting Approval`) and provides a 1-click link to review and decide in SaarthiFlow Approvals.

### 5. Recent Captures Drawer
Keeps a persistent history of recently discovered opportunities, accessible via the clock icon in the top header.

---

## 5. Mode Separation: Live Mode vs Demo Mode

### Live Mode (Primary)
- Communicates directly with the SaarthiFlow Express backend (`http://localhost:3001`).
- Uses `POST /api/agent/plan` (Gemini AI agent) to structure tasks.
- Submits proposals to the backend database (`db.createProposal`).
- If the backend is unreachable, clearly displays:  
  `"Backend not connected at http://localhost:3001. Ensure SaarthiFlow server is running (npm run server)."`  
  *(Does NOT silently fall back to demo mode).*

### Demo Mode (Offline Testing)
- Operates 100% locally with zero server requirements.
- Uses the deterministic opportunity classifier to extract real webpage details.
- Allows full task editing, adding custom tasks, and batch selection.
- Saves proposals in `chrome.storage.local`.
- Clearly labeled as Demo Mode with zero fabricated AI claims.

---

## 6. How to Run & Test the Extension

### Step 1: Open Chrome Extensions
1. In Google Chrome, go to `chrome://extensions`.
2. Toggle **Developer mode** to **ON** (top-right corner).

### Step 2: Reload or Load Unpacked
1. Click **Load unpacked** (top-left).
2. Select the `extension/` folder:
   ```text
   C:\Users\Omen\OneDrive\Desktop\SaarthiFlow\extension
   ```
3. *(If already loaded, simply click the circular **Reload** icon on the SaarthiFlow extension card).*

### Step 3: Pin and Test
1. Click the puzzle icon in Chrome and **Pin** SaarthiFlow.
2. Open a test page:
   - **Hackathon Test**: Open any hackathon page (e.g., on [Devpost](https://devpost.com)). Click the extension → see 🏆 Hackathon detection → click **"Turn This Page Into Actions"**.
   - **Repository Test**: Open a specific repository (e.g., `https://github.com/facebook/react`). See 💻 GitHub Repository detection → click **"Turn This Page Into Actions"**.
   - **Generic Home Test**: Open `https://github.com` or `https://google.com`. Click **"Turn This Page Into Actions"** → see **"No clear actionable opportunity detected"** (no fabricated filler tasks).
