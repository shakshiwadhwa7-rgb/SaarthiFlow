<div align="center">

#  SaarthiFlow

### From Browsing to Doing.

**An Agentic AI Productivity Platform**

*Turning scattered information into structured plans, approved actions, and measurable progress.*

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Tailwind](https://img.shields.io/badge/Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-4285F4?style=for-the-badge&logo=googlegemini&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

![Status](https://img.shields.io/badge/Status-In_Development-orange?style=flat-square)
![Theme](https://img.shields.io/badge/Theme-Agentic_AI-7955E8?style=flat-square)
![Platform](https://img.shields.io/badge/Platform-Web_%2B_Chrome_Extension-blue?style=flat-square)

---

**[Overview](#-overview) · [Features](#-core-features) · [Architecture](#-system-architecture) · [Tech Stack](#-technology-stack) · [Setup](#-getting-started) · [Roadmap](#-development-roadmap)**

</div>

## 🌍 Overview

Every day, students, developers, and professionals discover internships, hackathons, events, and opportunities across the internet.

But discovering information is only the beginning.

The real challenge is turning that information into action: extracting deadlines, understanding requirements, planning tasks, and keeping track of everything.

**SaarthiFlow transforms passive browsing into actionable productivity.**

> **Browse → Understand → Plan → Approve → Execute → Verify**

---

## ⚡ The Problem vs. Our Solution

| The Problem | The SaarthiFlow Approach |
|:---|:---|
| Information scattered across websites | Capture relevant webpage context |
| Deadlines are easy to miss | Extract dates and requirements |
| Manual task creation is repetitive | Generate structured action plans |
| AI assistants only provide suggestions | Execute user-approved actions |
| Productivity tools are disconnected | Centralized task workspace |
| Difficult to track automated actions | Maintain execution and activity logs |

---

## ✨ Core Features

| Feature | Description | Module |
|:---|:---|:---|
| 🧠 AI Planning | Convert information into structured action plans | Agent Studio |
| 🌐 Webpage Capture | Extract content from websites | Chrome Extension |
| 📋 Task Management | Create, edit, complete, and organize tasks | My Space |
| ✅ Human Approval | Review actions before execution | Approvals |
| 📅 Deadline Tracking | Organize upcoming deadlines | Calendar |
| 📊 Productivity Insights | Visualize tasks and progress | Analytics |
| 🔍 Execution History | Track actions and verification | Activity |
| ⚡ Quick Actions | Launch common productivity workflows | Quick Actions |

*Features may be in development; see the roadmap for implementation status.*

---

## 🔄 How SaarthiFlow Works

```mermaid
flowchart LR
    A["🌐 Browse"] --> B["📥 Capture"]
    B --> C["🧠 Analyze"]
    C --> D["📝 Plan"]
    D --> E{"👤 Approve?"}
    E -->|Yes| F["⚙️ Execute"]
    E -->|No| G["🛑 Reject"]
    F --> H["✅ Verify"]
    H --> I["📊 Track"]

    style A fill:#EFF6FF,stroke:#60A5FA,color:#1E3A8A
    style C fill:#F3E8FF,stroke:#A78BFA,color:#581C87
    style E fill:#FEF3C7,stroke:#F59E0B,color:#92400E
    style F fill:#DCFCE7,stroke:#4ADE80,color:#166534
    style H fill:#DCFCE7,stroke:#4ADE80,color:#166534
```

### Example: Discovering a Hackathon

<details>
<summary><b>Click to explore the complete workflow</b></summary>

**Step 1 — Discover**

You open a hackathon registration webpage.

**Step 2 — Capture**

The Chrome extension extracts the event details, deadlines, and requirements.

**Step 3 — Understand**

Gemini identifies important information and generates a structured plan.

**Step 4 — Approve**

You review the proposed tasks and adjust deadlines or priorities.

**Step 5 — Execute**

SaarthiFlow creates the approved tasks in your workspace.

**Step 6 — Verify**

The system confirms the results and records them in the activity log.

</details>

---

## 🏗️ System Architecture

```mermaid
flowchart TB
    U["User"] --> W["React Dashboard"]
    U --> E["Chrome Extension"]

    E --> API["Node.js / Express API"]
    W --> API

    API --> AI["Gemini AI"]
    AI --> PLAN["Structured Action Plan"]

    PLAN --> APPROVAL["Human Approval"]
    APPROVAL -->|Approved| EXEC["Action Executor"]
    APPROVAL -->|Rejected| STOP["Stop"]

    EXEC --> DB[("Supabase PostgreSQL")]
    DB --> VERIFY["Execution Verification"]
    VERIFY --> LOG["Activity Logs"]
    LOG --> W

    style W fill:#EFF6FF,stroke:#60A5FA,color:#1E3A8A
    style AI fill:#F3E8FF,stroke:#A78BFA,color:#581C87
    style APPROVAL fill:#FEF3C7,stroke:#F59E0B,color:#92400E
    style EXEC fill:#DCFCE7,stroke:#4ADE80,color:#166534
    style DB fill:#E0F2FE,stroke:#38BDF8,color:#075985
```

*This diagram shows the target architecture, not necessarily the current implementation.*

---

## 📊 Productivity Analytics

SaarthiFlow's analytics dashboard is designed to visualize:

| Metric | What It Measures |
|:---|:---|
| Active Tasks | Tasks currently in progress |
| Completed Tasks | Successfully finished tasks |
| Completion Rate | Completed tasks as a percentage of all tasks |
| Upcoming Deadlines | Tasks approaching their due dates |
| AI Actions | Agent-generated or executed actions |
| Approval Rate | Approved proposals relative to reviewed proposals |

### Example Task Distribution

```mermaid
pie showData
    title Illustrative Task Distribution
    "Completed" : 45
    "In Progress" : 30
    "Pending" : 20
    "Overdue" : 5
```

*Illustrative data only — not actual SaarthiFlow usage statistics.*

### Example Weekly Productivity

```mermaid
xychart-beta
    title "Illustrative Tasks Completed Per Day"
    x-axis ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    y-axis "Tasks" 0 --> 10
    bar [3, 5, 4, 7, 6, 8, 5]
```

*Sample data used to demonstrate the planned analytics experience.*

---

## 🛠️ Technology Stack

| Layer | Technology | Purpose |
|:---|:---|:---|
| Frontend | React + Vite | Interactive web application |
| Styling | Tailwind CSS | Responsive interface |
| UI Icons | Lucide React | Consistent iconography |
| Charts | Recharts | Productivity visualization |
| AI | Google Gemini API | Information extraction and planning |
| Backend | Node.js + Express | API and action execution |
| Database | Supabase PostgreSQL | Persistent task and activity data |
| Browser | Chrome Manifest V3 | Webpage capture |
| Deployment | Vercel + Render | Frontend and backend hosting |

*Planned stack — update this table to reflect the final repository.*

---

## 🧩 Application Modules

<details>
<summary><b>🏠 Overview Dashboard</b></summary>

- Task and deadline statistics
- Agent Command panel
- Recent agent runs
- Task overview
- Productivity charts

</details>

<details>
<summary><b>🧠 Agent Studio</b></summary>

- Natural-language instructions
- AI-generated action plans
- Task suggestions
- Approval requests
- Agent workflow visualization

</details>

<details>
<summary><b>📋 My Space</b></summary>

- List and Kanban task views
- Project organization
- Priority and deadline management
- Task completion tracking

</details>

<details>
<summary><b>✅ Approvals</b></summary>

- Pending action requests
- Editable task proposals
- Approve or reject actions
- Execution authorization

</details>

<details>
<summary><b>📊 Analytics & Activity</b></summary>

- Productivity metrics
- Completion statistics
- Activity timelines
- Action verification history

</details>

---

## ⚙️ Getting Started

### Prerequisites

- Node.js and npm
- Git
- A modern web browser

### Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/SaarthiFlow.git
cd SaarthiFlow
```

### Install Dependencies

```bash
npm install
```

### Run Locally

```bash
npm run dev
```

Open the local URL shown in your terminal.

### Production Build

```bash
npm run build
```

> These commands assume the frontend is at the repository root. Adjust the directory and setup steps to match your actual project.

### Environment Configuration

For backend or AI integration, use an `.env.example` file to document required variables without exposing credentials.

Keep Gemini API keys and database secrets server-side. Never commit `.env` files containing real secrets.

---

## 🗺️ Development Roadmap

```mermaid
flowchart LR
    A["01<br/>Frontend & UX"] --> B["02<br/>AI Integration"]
    B --> C["03<br/>Chrome Extension"]
    C --> D["04<br/>Agent Execution"]
    D --> E["05<br/>Testing & Deployment"]

    style A fill:#DBEAFE,stroke:#60A5FA,color:#1E40AF
    style B fill:#F3E8FF,stroke:#A78BFA,color:#6B21A8
    style C fill:#DCFCE7,stroke:#4ADE80,color:#166534
    style D fill:#FEF3C7,stroke:#F59E0B,color:#92400E
    style E fill:#FCE7F3,stroke:#F472B6,color:#9D174D
```

### Milestone Checklist

- [ ] **Phase 1:** Frontend, navigation, tasks, and approvals
- [ ] **Phase 2:** Gemini integration and structured AI plans
- [ ] **Phase 3:** Chrome extension and webpage extraction
- [ ] **Phase 4:** Real execution, verification, and activity logs
- [ ] **Phase 5:** Testing, deployment, and final demo

*Update the checkboxes as development progresses.*

---

## 🎯 Target Users

| Audience | Use Case |
|:---|:---|
| Students | Assignments, events, workshops, deadlines |
| Job Seekers | Internship and application tracking |
| Developers | Projects, hackathons, milestones |
| Professionals | Task planning and workflow organization |
| Teams | Shared planning and future collaboration |

---

## 🔮 Future Scope

<details>
<summary><b>Click to explore planned integrations</b></summary>

| Integration | Planned Capability |
|:---|:---|
| Google Calendar | Create and reschedule events |
| Google Tasks | Synchronize tasks |
| Notion | Organize notes and projects |
| Trello | Manage project boards |
| Google Sheets | Update trackers |
| Smart Notifications | Deadline and progress reminders |

</details>

---

## ❓ Frequently Asked Questions

<details>
<summary><b>Is SaarthiFlow just another chatbot?</b></summary>

No. SaarthiFlow is designed to go beyond generating responses by supporting action planning, user approval, task execution, and verification.

</details>

<details>
<summary><b>Does SaarthiFlow perform actions automatically?</b></summary>

The intended workflow requires users to approve proposed actions before execution.

</details>

<details>
<summary><b>Why use a Chrome extension?</b></summary>

It allows SaarthiFlow to capture relevant webpage context without requiring users to manually copy information into the dashboard.

</details>

<details>
<summary><b>Can SaarthiFlow work without external task apps?</b></summary>

Yes. Its internal task manager is designed to create, organize, and track tasks directly within the application.

</details>

---

## 💜 Our Vision

We envision AI systems that do more than understand instructions.

Systems that transform information into organized actions, preserve user control, and make progress visible.

<div align="center">

### SaarthiFlow

**From Browsing to Doing.**

*Discover smarter. Plan better. Get things done.*

</div>
