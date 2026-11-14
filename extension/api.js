/**
 * SaarthiFlow Chrome Extension - API & Agentic Orchestration Layer
 * Connects the Chrome Extension to the SaarthiFlow Backend, Gemini Agent,
 * and Human-in-the-Loop Approval workflow.
 */

(function (root) {
  'use strict';

  const uid = (prefix = 'sf') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return toISODate(d);
  }

  function parseDateString(str) {
    if (!str) return null;
    const clean = str.replace(/(?:st|nd|rd|th)/gi, '').trim();
    const parsed = Date.parse(clean);
    if (!isNaN(parsed)) {
      const dt = new Date(parsed);
      if (dt.getFullYear() >= 2024 && dt.getFullYear() <= 2035) {
        return toISODate(dt);
      }
    }
    return null;
  }

  const SF_API = {
    /**
     * Resolves the active backend URL by checking the configured URL first,
     * then probing common SaarthiFlow ports (3001, 3000).
     */
    async resolveBackendUrl(preferredUrl) {
      const normalizedPreferred = root.SF_CONFIG.normalizeUrl(preferredUrl || root.SF_CONFIG.DEFAULTS.backendUrl);
      const candidates = [
        normalizedPreferred,
        'http://localhost:3001',
        'http://localhost:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3000'
      ];

      const unique = [...new Set(candidates.map(u => root.SF_CONFIG.normalizeUrl(u)))];

      for (const candidate of unique) {
        try {
          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 1200);
          const res = await fetch(`${candidate}/api/health`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
          });
          clearTimeout(tid);
          if (res.ok) {
            return candidate;
          }
        } catch {
          // Probe next candidate
        }
      }

      return normalizedPreferred;
    },

    /**
     * Check backend connectivity & services health
     */
    async checkHealth(settings) {
      if (settings.mode === 'demo') {
        return {
          ok: true,
          mode: 'demo',
          status: 200,
          message: 'Local Demo Mode Active (Offline testing, no backend required)'
        };
      }

      const activeUrl = await this.resolveBackendUrl(settings.backendUrl);
      const endpoint = `${activeUrl}${root.SF_CONFIG.ENDPOINTS.health}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        let data = null;
        try {
          data = await response.json();
        } catch {
          data = { status: response.statusText };
        }

        if (response.ok) {
          // If we discovered an alternate working port, update stored settings silently
          if (activeUrl !== settings.backendUrl && root.SF_CONFIG.saveSettings) {
            root.SF_CONFIG.saveSettings({ backendUrl: activeUrl }).catch(() => {});
          }

          return {
            ok: true,
            mode: 'live',
            status: response.status,
            activeUrl: activeUrl,
            data: data,
            message: `Connected to SaarthiFlow Backend at ${activeUrl} (${data.database || 'Database OK'})`
          };
        } else {
          return {
            ok: false,
            mode: 'live',
            status: response.status,
            error: `Backend error (HTTP ${response.status})`
          };
        }
      } catch (err) {
        clearTimeout(timeoutId);
        const isAbort = err.name === 'AbortError';
        return {
          ok: false,
          mode: 'live',
          error: isAbort
            ? `Connection to backend timed out (URL: ${activeUrl})`
            : `Backend not connected at ${activeUrl}. Run 'npm run server' in project root.`
        };
      }
    },

    /**
     * PRIMARY AGENTIC FLOW: Turn This Page Into Actions
     * DISCOVER & UNDERSTAND → PLAN
     */
    async planPageActions(pageData, settings) {
      // Record capture into recent history
      await this.recordRecentCapture(pageData);

      if (settings.mode === 'demo') {
        return this._demoPlanPageActions(pageData);
      } else {
        return this._livePlanPageActions(pageData, settings);
      }
    },

    /**
     * HUMAN-IN-THE-LOOP APPROVAL SUBMISSION
     * PLAN → APPROVE
     */
    async submitProposalForApproval(proposalData, settings) {
      if (settings.mode === 'demo') {
        return this._demoSubmitProposal(proposalData);
      } else {
        return this._liveSubmitProposal(proposalData, settings);
      }
    },

    /**
     * QUICK TASK CREATION: Create a manual task directly
     */
    async createQuickTask(taskData, settings) {
      if (settings.mode === 'demo') {
        return {
          success: true,
          mode: 'demo',
          task: { ...taskData, id: uid('task') },
          message: 'Quick Task saved locally (Demo Mode)'
        };
      }

      const activeUrl = await this.resolveBackendUrl(settings.backendUrl);
      const endpoint = `${activeUrl}${root.SF_CONFIG.ENDPOINTS.tasks}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(taskData),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Failed to create task (HTTP ${response.status}): ${errText}`);
        }

        const created = await response.json();
        return {
          success: true,
          mode: 'live',
          task: created,
          message: 'Task created successfully in SaarthiFlow My Space!'
        };
      } catch (err) {
        clearTimeout(timeoutId);
        throw new Error(`Unable to create task on backend (${activeUrl}): ${err.message}. Ensure backend is running.`);
      }
    },

    // -------------------------------------------------------------
    // MODE A: LOCAL DETERMINISTIC DEMO PLANNER
    // -------------------------------------------------------------
    _demoPlanPageActions(pageData) {
      const opp = pageData.opportunity || {};
      const dates = pageData.dates || [];
      const title = opp.opportunityTitle || pageData.title || 'Webpage';

      // Determine best due date from detected deadlines
      let nearestDueDate = null;
      for (const d of dates) {
        const parsed = parseDateString(d.text);
        if (parsed) {
          nearestDueDate = parsed;
          break;
        }
      }

      // CASE: Non-Actionable Page (e.g., google.com, github.com home, generic blogs)
      if (!opp.isActionable || opp.pageType === 'general') {
        return {
          success: true,
          mode: 'demo',
          isDemo: true,
          isActionable: false,
          categoryName: 'General Informational',
          categoryIcon: '🌐',
          opportunity: opp,
          message: 'No clear actionable opportunity detected on this page.',
          summary: 'This webpage does not appear to contain an actionable hackathon, job listing, workshop, or repository. You can create a task manually or save this page for reference.',
          tasks: []
        };
      }

      // Actionable Opportunities
      const tasks = [];
      let summary = '';

      switch (opp.pageType) {
        case 'hackathon':
          summary = `Action plan for Hackathon "${title}". Extracted key deadlines, team requirements, and project submission criteria.`;
          tasks.push({
            id: uid('t'),
            title: `Review eligibility criteria & team guidelines for ${title}`,
            description: `Check team size, constraints, and eligibility on ${pageData.domain}`,
            priority: 'High',
            due: addDays(2),
            project: 'Hackathon',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Complete registration & confirm team members`,
            description: `Sign up on portal before deadline (${opp.primaryDeadline})`,
            priority: 'High',
            due: nearestDueDate || addDays(4),
            project: 'Hackathon',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Draft problem statement & MVP feature roadmap`,
            description: `Brainstorm user journey, tech stack, and deliverables`,
            priority: 'High',
            due: addDays(6),
            project: 'Hackathon',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Build core prototype & public GitHub repository`,
            description: `Develop MVP and push clean codebase with documentation`,
            priority: 'Medium',
            due: addDays(9),
            project: 'Hackathon',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Record 2-min demo walkthrough & submit before deadline`,
            description: `Finalize video, presentation slides, and submit on portal`,
            priority: 'Medium',
            due: nearestDueDate || addDays(11),
            project: 'Hackathon',
            selected: false
          });
          break;

        case 'internship':
        case 'job':
          summary = `Application readiness plan for ${opp.categoryName}: "${title}". Extracted job requirements, resume checkpoints, and application milestones.`;
          tasks.push({
            id: uid('t'),
            title: `Review role requirements & qualifications for ${title}`,
            description: `Verify technical prerequisites on ${pageData.domain}`,
            priority: 'High',
            due: addDays(2),
            project: 'Internships',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Tailor resume & portfolio for ${title}`,
            description: `Highlight relevant projects, skills, and metrics matching role`,
            priority: 'High',
            due: addDays(3),
            project: 'Internships',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Submit application on careers portal`,
            description: `Complete application form before deadline (${opp.primaryDeadline})`,
            priority: 'High',
            due: nearestDueDate || addDays(5),
            project: 'Internships',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Prepare technical & domain interview notes`,
            description: `Practice core system, data structures, and role-specific concepts`,
            priority: 'Medium',
            due: addDays(8),
            project: 'Internships',
            selected: false
          });
          break;

        case 'github_repo':
          summary = `Repository contribution action plan for "${title}". Extracted architecture, setup guidelines, and contribution avenues.`;
          tasks.push({
            id: uid('t'),
            title: `Read README and architecture docs for ${title}`,
            description: `Understand project goals, tech stack, and module structure`,
            priority: 'High',
            due: addDays(2),
            project: 'Open Source',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Set up local development environment & run tests`,
            description: `Clone repo, install dependencies, and verify test suite passes`,
            priority: 'High',
            due: addDays(4),
            project: 'Open Source',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Explore open issues & find 'good-first-issue' candidate`,
            description: `Review discussion threads and identify beginner-friendly tasks`,
            priority: 'Medium',
            due: addDays(6),
            project: 'Open Source',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Implement patch / pull request and link issue`,
            description: `Follow contribution guidelines and submit PR with description`,
            priority: 'Medium',
            due: addDays(9),
            project: 'Open Source',
            selected: false
          });
          break;

        case 'workshop':
        case 'event':
          summary = `Participation plan for ${opp.categoryName}: "${title}". Extracted agenda, schedule, and preparation requirements.`;
          tasks.push({
            id: uid('t'),
            title: `Register for ${title} and verify confirmation`,
            description: `Reserve seat before registration closes (${opp.primaryDeadline})`,
            priority: 'High',
            due: nearestDueDate || addDays(2),
            project: 'Learning',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Review workshop prerequisites & install required software`,
            description: `Prepare laptop environment and development tools`,
            priority: 'Medium',
            due: addDays(4),
            project: 'Learning',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Add session dates & times to calendar`,
            description: `Set reminders for event schedule`,
            priority: 'Low',
            due: addDays(3),
            project: 'Learning',
            selected: true
          });
          break;

        case 'assignment':
          summary = `Academic coursework completion plan for "${title}". Extracted submission deadlines, rubrics, and deliverable items.`;
          tasks.push({
            id: uid('t'),
            title: `Read assignment brief & scoring rubric for ${title}`,
            description: `Identify mandatory sections and evaluation criteria`,
            priority: 'High',
            due: addDays(2),
            project: 'College',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Implement core assignment solution & test cases`,
            description: `Complete deliverables and verify all test requirements`,
            priority: 'High',
            due: nearestDueDate || addDays(5),
            project: 'College',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Perform format check & upload to submission portal`,
            description: `Submit final artifacts before deadline (${opp.primaryDeadline})`,
            priority: 'High',
            due: nearestDueDate || addDays(6),
            project: 'College',
            selected: true
          });
          break;

        case 'documentation':
          summary = `Technical exploration plan for "${title}". Extracted reference modules and quickstart tutorials.`;
          tasks.push({
            id: uid('t'),
            title: `Study technical reference & quickstart for ${title}`,
            description: `Read core API guide on ${pageData.domain}`,
            priority: 'Medium',
            due: addDays(3),
            project: 'Learning',
            selected: true
          });
          tasks.push({
            id: uid('t'),
            title: `Build proof-of-concept prototype integrating SDK`,
            description: `Test sample snippets and verify working API calls`,
            priority: 'Medium',
            due: addDays(6),
            project: 'Learning',
            selected: true
          });
          break;

        default:
          summary = `Action plan for ${title}.`;
          tasks.push({
            id: uid('t'),
            title: `Review and follow up on ${title.slice(0, 50)}`,
            description: `Action item extracted from ${pageData.domain}`,
            priority: 'Medium',
            due: nearestDueDate || addDays(4),
            project: 'General',
            selected: true
          });
          break;
      }

      return {
        success: true,
        mode: 'demo',
        isDemo: true,
        isActionable: true,
        categoryName: opp.categoryName,
        categoryIcon: opp.categoryIcon,
        opportunity: opp,
        summary: summary,
        tasks: tasks,
        proposalId: uid('demo-prop')
      };
    },

    async _demoSubmitProposal(proposalData) {
      const proposalId = proposalData.proposalId || uid('demo-prop');
      const record = {
        id: proposalId,
        title: proposalData.title || 'Action Plan',
        url: proposalData.url || '',
        source: 'Chrome Extension (Demo)',
        created: Date.now(),
        status: 'pending',
        summary: proposalData.summary || '',
        tasks: proposalData.tasks || [],
        isDemo: true
      };

      await this.saveDemoProposal(record);

      return {
        success: true,
        mode: 'demo',
        isDemo: true,
        proposalId: proposalId,
        status: 'Awaiting Approval',
        message: 'Plan saved locally in Chrome storage (Demo Mode) — not submitted to SaarthiFlow database.'
      };
    },

    // -------------------------------------------------------------
    // MODE B: LIVE SAARTHIFLOW BACKEND & AGENTIC INTEGRATION
    // -------------------------------------------------------------
    async _livePlanPageActions(pageData, settings) {
      const activeUrl = await this.resolveBackendUrl(settings.backendUrl);
      const opp = pageData.opportunity || {};

      const command = `Extract actionable tasks and deadlines for ${opp.categoryName || 'opportunity'}: ${opp.opportunityTitle || pageData.title}`;
      const endpoint = `${activeUrl}${root.SF_CONFIG.ENDPOINTS.agentPlan}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), root.SF_CONFIG.LIMITS.REQUEST_TIMEOUT_MS);

      const payload = {
        command: command,
        webpageUrl: pageData.url,
        webpageText: pageData.extractedText,
        opportunity: opp
      };

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Backend planning failed (HTTP ${response.status}): ${errText || response.statusText}`);
        }

        const data = await response.json();

        const mappedTasks = (data.tasks || []).map((t, idx) => ({
          id: t.id || uid(`task-${idx}`),
          title: t.title || 'Untitled Action',
          description: t.description || `Action derived from ${pageData.domain}`,
          priority: t.priority || 'Medium',
          due: t.due || addDays(5),
          project: t.project || opp.categoryName || 'General',
          actionType: t.actionType || 'create_task',
          selected: true
        }));

        return {
          success: true,
          mode: 'live',
          isDemo: false,
          isActionable: mappedTasks.length > 0,
          categoryName: opp.categoryName || 'Opportunity',
          categoryIcon: opp.categoryIcon || '🎯',
          opportunity: opp,
          summary: data.summary || `AI Action Plan drafted by SaarthiFlow Agent.`,
          tasks: mappedTasks,
          proposalId: data.proposalId,
          runId: data.runId,
          isSimulated: Boolean(data.isSimulated)
        };
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error(`Request timed out after ${root.SF_CONFIG.LIMITS.REQUEST_TIMEOUT_MS / 1000}s. Backend agent may be processing slowly.`);
        }
        throw new Error(`Backend not connected at ${activeUrl}. ${err.message || 'Ensure your server is running (npm run server).'}`);
      }
    },

    async _liveSubmitProposal(proposalData, settings) {
      const activeUrl = await this.resolveBackendUrl(settings.backendUrl);

      // If a proposalId was already created by /api/agent/plan, update it with user edits
      if (proposalData.proposalId) {
        const updateEndpoint = `${activeUrl}${root.SF_CONFIG.ENDPOINTS.approvals}/${proposalData.proposalId}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
          const response = await fetch(updateEndpoint, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              tasks: proposalData.tasks.map(t => ({
                title: t.title,
                priority: t.priority,
                due: t.due,
                project: t.project,
                actionType: t.actionType || 'create_task'
              }))
            }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            return {
              success: true,
              mode: 'live',
              isDemo: false,
              proposalId: proposalData.proposalId,
              status: 'Awaiting Approval',
              message: 'Plan submitted successfully! Open SaarthiFlow Approvals to review and execute.'
            };
          }
        } catch (e) {
          console.debug('[SaarthiFlow] PATCH proposal update warning, falling back to POST:', e);
        }
      }

      // Fallback or new proposal submission via POST /api/proposals
      const endpoint = `${activeUrl}${root.SF_CONFIG.ENDPOINTS.proposals}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), root.SF_CONFIG.LIMITS.REQUEST_TIMEOUT_MS);

      const payload = {
        title: proposalData.title,
        url: proposalData.url,
        source: 'Chrome Extension',
        summary: proposalData.summary,
        tasks: proposalData.tasks.map(t => ({
          title: t.title,
          description: t.description,
          priority: t.priority,
          due: t.due,
          project: t.project || 'General',
          actionType: t.actionType || 'create_task'
        }))
      };

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Proposal submission failed (HTTP ${response.status}): ${errText}`);
        }

        const data = await response.json();
        return {
          success: true,
          mode: 'live',
          isDemo: false,
          proposalId: data.proposalId || data.id,
          status: 'Awaiting Approval',
          message: 'Plan created in SaarthiFlow! Awaiting human approval.'
        };
      } catch (err) {
        clearTimeout(timeoutId);
        throw new Error(`Failed to submit proposal to backend (${activeUrl}): ${err.message}. Ensure backend is running.`);
      }
    },

    // -------------------------------------------------------------
    // STORAGE & RECENT CAPTURES
    // -------------------------------------------------------------
    async recordRecentCapture(pageData) {
      if (!chrome?.storage?.local) return;
      try {
        const key = root.SF_CONFIG.STORAGE_KEYS.RECENT_CAPTURES;
        chrome.storage.local.get([key], (res) => {
          const list = res[key] || [];
          const item = {
            url: pageData.url,
            title: pageData.opportunity?.opportunityTitle || pageData.title,
            category: pageData.opportunity?.categoryName || 'General',
            categoryIcon: pageData.opportunity?.categoryIcon || '🌐',
            timestamp: Date.now()
          };

          const filtered = list.filter(x => x.url !== item.url);
          filtered.unshift(item);
          const trimmed = filtered.slice(0, root.SF_CONFIG.LIMITS.MAX_RECENT_CAPTURES);

          const obj = {};
          obj[key] = trimmed;
          chrome.storage.local.set(obj);
        });
      } catch (e) {
        console.debug('[SaarthiFlow] Record capture non-fatal:', e);
      }
    },

    async getRecentCaptures() {
      return new Promise((resolve) => {
        if (!chrome?.storage?.local) return resolve([]);
        chrome.storage.local.get([root.SF_CONFIG.STORAGE_KEYS.RECENT_CAPTURES], (res) => {
          resolve(res[root.SF_CONFIG.STORAGE_KEYS.RECENT_CAPTURES] || []);
        });
      });
    },

    async getDemoProposals() {
      return new Promise((resolve) => {
        if (!chrome?.storage?.local) return resolve([]);
        chrome.storage.local.get([root.SF_CONFIG.STORAGE_KEYS.DEMO_PROPOSALS], (res) => {
          resolve(res[root.SF_CONFIG.STORAGE_KEYS.DEMO_PROPOSALS] || []);
        });
      });
    },

    async saveDemoProposal(proposal) {
      return new Promise((resolve) => {
        if (!chrome?.storage?.local) return resolve();
        chrome.storage.local.get([root.SF_CONFIG.STORAGE_KEYS.DEMO_PROPOSALS], (res) => {
          const list = res[root.SF_CONFIG.STORAGE_KEYS.DEMO_PROPOSALS] || [];
          list.unshift(proposal);
          const trimmed = list.slice(0, root.SF_CONFIG.LIMITS.MAX_SAVED_PROPOSALS);
          const obj = {};
          obj[root.SF_CONFIG.STORAGE_KEYS.DEMO_PROPOSALS] = trimmed;
          chrome.storage.local.set(obj, () => resolve(trimmed));
        });
      });
    },

    async clearDemoProposals() {
      return new Promise((resolve) => {
        if (!chrome?.storage?.local) return resolve();
        const obj = {};
        obj[root.SF_CONFIG.STORAGE_KEYS.DEMO_PROPOSALS] = [];
        chrome.storage.local.set(obj, () => resolve());
      });
    }
  };

  root.SF_API = SF_API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
