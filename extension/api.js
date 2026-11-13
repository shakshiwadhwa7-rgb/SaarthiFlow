/**
 * SaarthiFlow Chrome Extension - API & Orchestration Layer
 * Handles Mode A (Local Deterministic Demo) and Mode B (Live Backend Integration).
 * Never calls Activepieces directly; routes strictly through SaarthiFlow Backend.
 */

(function (root) {
  'use strict';

  const uid = () => 'sf-' + Math.random().toString(36).slice(2, 9);

  // Helper to format Date as YYYY-MM-DD
  function toISODate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Add days to current date
  function addDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return toISODate(d);
  }

  // Attempt to parse string into YYYY-MM-DD
  function parseDateString(str) {
    if (!str) return null;
    const clean = str.replace(/(?:st|nd|rd|th)/gi, '').trim();
    const parsed = Date.parse(clean);
    if (!isNaN(parsed)) {
      const dt = new Date(parsed);
      // Guard against nonsensical dates
      if (dt.getFullYear() >= 2024 && dt.getFullYear() <= 2035) {
        return toISODate(dt);
      }
    }
    return null;
  }

  const SF_API = {
    /**
     * Check backend connectivity
     */
    async checkHealth(settings) {
      if (settings.mode === 'demo') {
        return {
          ok: true,
          mode: 'demo',
          status: 200,
          message: 'Local Demo Mode Active (No backend server required)'
        };
      }

      const backendUrl = settings.backendUrl;
      const endpoint = `${backendUrl}${root.SF_CONFIG.ENDPOINTS.health}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

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
          return {
            ok: true,
            mode: 'live',
            status: response.status,
            data: data,
            message: 'Connected to SaarthiFlow Backend'
          };
        } else {
          return {
            ok: false,
            mode: 'live',
            status: response.status,
            error: `Backend responded with HTTP ${response.status}`,
            data
          };
        }
      } catch (err) {
        clearTimeout(timeoutId);
        const isAbort = err.name === 'AbortError';
        return {
          ok: false,
          mode: 'live',
          error: isAbort
            ? `Connection to backend timed out (URL: ${backendUrl})`
            : `Backend not connected at ${backendUrl}. Ensure your backend server is running.`
        };
      }
    },

    /**
     * Analyze webpage content:
     * - In Demo Mode: Deterministic local parsing & heuristic proposal generation.
     * - In Live Mode: Calls configured SaarthiFlow backend endpoint.
     */
    async analyzeWebpage(pageData, settings) {
      if (settings.mode === 'demo') {
        return this._demoAnalyze(pageData);
      } else {
        return this._liveAnalyze(pageData, settings);
      }
    },

    /**
     * Submit selected tasks for human-in-the-loop approval:
     * - In Demo Mode: Saves to chrome.storage.local with demo attribution.
     * - In Live Mode: Sends to backend endpoint /api/proposals.
     */
    async submitProposal(proposalData, settings) {
      if (settings.mode === 'demo') {
        return this._demoSubmit(proposalData);
      } else {
        return this._liveSubmit(proposalData, settings);
      }
    },

    // -------------------------------------------------------------
    // MODE A: LOCAL DETERMINISTIC DEMO ENGINE
    // -------------------------------------------------------------
    _demoAnalyze(pageData) {
      const text = pageData.extractedText || '';
      const textLower = text.toLowerCase();
      const title = pageData.title || 'Untitled Page';
      const domain = pageData.domain || '';
      const dates = pageData.dates || [];
      const headings = pageData.headings || [];

      // Detect nearest deadline date
      let nearestDueDate = null;
      for (const d of dates) {
        const parsed = parseDateString(d.text);
        if (parsed) {
          nearestDueDate = parsed;
          break;
        }
      }

      // Domain and content category heuristics
      const isHackathon = /hackathon|devpost|unstop|hack|competition|challenge|prize|submission/i.test(title + ' ' + textLower + ' ' + domain);
      const isJob = /internship|careers|job|hiring|role|full-time|responsibilities|apply now/i.test(title + ' ' + textLower);
      const isCourse = /assignment|homework|syllabus|lecture|quiz|course|exam|university|college|semester/i.test(title + ' ' + textLower);
      const isDoc = /documentation|guide|tutorial|api reference|docs|getting started/i.test(title + ' ' + textLower);

      let category = 'General';
      let summary = '';
      const tasks = [];
      const deadlines = [];
      const requirements = [];

      // Add detected dates to deadlines list
      dates.forEach(d => {
        deadlines.push(`${d.label}: ${d.text}`);
      });

      if (isHackathon) {
        category = 'Hackathon';
        summary = `Detected hackathon & competition page on ${domain}. Identified registration guidelines, project submission timeline, and team rules.`;
        
        tasks.push({
          id: uid(),
          title: `Register team for ${title.split(/[-–|]/)[0].trim() || 'Hackathon'}`,
          description: `Complete team registration and read competition rules on ${domain}`,
          priority: 'High',
          due: nearestDueDate || addDays(3),
          project: 'Hackathon',
          selected: true
        });

        tasks.push({
          id: uid(),
          title: 'Draft problem statement & feature roadmap',
          description: 'Brainstorm core user personas, tech stack requirements, and MVP scope',
          priority: 'High',
          due: addDays(5),
          project: 'Hackathon',
          selected: true
        });

        tasks.push({
          id: uid(),
          title: 'Build core prototype and integration flows',
          description: 'Implement core functionality and verify key user journeys',
          priority: 'Medium',
          due: addDays(8),
          project: 'Hackathon',
          selected: true
        });

        tasks.push({
          id: uid(),
          title: 'Prepare demo video, README, and final submission',
          description: 'Record demonstration walkthrough and finalize project submission links',
          priority: 'Medium',
          due: nearestDueDate || addDays(10),
          project: 'Hackathon',
          selected: false
        });

        requirements.push('Review team size and eligibility criteria');
        requirements.push('Verify working GitHub repository & presentation requirements');

      } else if (isJob) {
        category = 'Internships';
        summary = `Detected career/internship opportunity on ${domain}. Extracted job requirements and application guidelines.`;

        tasks.push({
          id: uid(),
          title: `Tailor resume & portfolio for ${title.split(/[-–|]/)[0].trim()}`,
          description: `Align project highlights with requirements listed on ${domain}`,
          priority: 'High',
          due: addDays(2),
          project: 'Internships',
          selected: true
        });

        tasks.push({
          id: uid(),
          title: 'Submit job application & track status',
          description: 'Fill in application form and record submission details in tracker',
          priority: 'High',
          due: nearestDueDate || addDays(4),
          project: 'Internships',
          selected: true
        });

        tasks.push({
          id: uid(),
          title: 'Prepare technical interview notes & system questions',
          description: 'Study relevant tech stacks and practice domain problem solving',
          priority: 'Medium',
          due: addDays(7),
          project: 'Internships',
          selected: false
        });

        requirements.push('Update GitHub projects and portfolio links');
        requirements.push('Prepare concise answers for role-specific questions');

      } else if (isCourse) {
        category = 'College';
        summary = `Detected coursework or academic assignment on ${domain}. Extracted assignment scope and submission milestones.`;

        tasks.push({
          id: uid(),
          title: `Read assignment brief & rubric for ${title.split(/[-–|]/)[0].trim()}`,
          description: 'Understand scoring criteria, required tools, and deliverable format',
          priority: 'High',
          due: addDays(2),
          project: 'College',
          selected: true
        });

        tasks.push({
          id: uid(),
          title: 'Complete assignment implementation & test cases',
          description: 'Execute deliverables and verify all rubric items are addressed',
          priority: 'High',
          due: nearestDueDate || addDays(6),
          project: 'College',
          selected: true
        });

        tasks.push({
          id: uid(),
          title: 'Run plagiarism/format checks and submit on portal',
          description: 'Package submission files and upload before deadline',
          priority: 'Medium',
          due: nearestDueDate || addDays(7),
          project: 'College',
          selected: true
        });

        requirements.push('Adhere to academic integrity and submission guidelines');

      } else if (isDoc) {
        category = 'Learning';
        summary = `Detected technical documentation or tutorial on ${domain}. Extracted key implementation topics and architecture notes.`;

        tasks.push({
          id: uid(),
          title: `Study docs: ${title.split(/[-–|]/)[0].trim()}`,
          description: `Read technical reference and API patterns on ${domain}`,
          priority: 'Medium',
          due: addDays(3),
          project: 'Learning',
          selected: true
        });

        tasks.push({
          id: uid(),
          title: 'Build proof-of-concept prototype following documentation',
          description: 'Test code snippets and verify integration locally',
          priority: 'Medium',
          due: addDays(6),
          project: 'Learning',
          selected: true
        });

        requirements.push('Review prerequisites and environment setup instructions');

      } else {
        // Generic page parsing with heading-derived tasks
        category = 'General';
        const metaDesc = pageData.metaDescription ? ` ${pageData.metaDescription}` : '';
        summary = `Extracted content from ${domain}.${metaDesc || ' Page analyzed for actionable tasks and key milestones.'}`;

        // Create tasks based on top headings if available
        if (headings.length > 0) {
          const topHeadings = headings.slice(0, 3);
          topHeadings.forEach((h, idx) => {
            tasks.push({
              id: uid(),
              title: `Action: ${h.text}`,
              description: `Follow up on items outlined in "${h.text}" on ${domain}`,
              priority: idx === 0 ? 'High' : 'Medium',
              due: addDays(3 + idx * 2),
              project: 'General',
              selected: true
            });
          });
        } else {
          tasks.push({
            id: uid(),
            title: `Review and process: ${title.slice(0, 50)}`,
            description: `Review extracted items from ${domain}`,
            priority: 'Medium',
            due: nearestDueDate || addDays(4),
            project: 'General',
            selected: true
          });
        }
      }

      return {
        success: true,
        mode: 'demo',
        isDemo: true,
        category: category,
        summary: summary,
        deadlines: deadlines.length > 0 ? deadlines : ['No explicit deadline detected on page'],
        requirements: requirements.length > 0 ? requirements : ['No specific prerequisites detected'],
        tasks: tasks,
        extractedInfo: {
          title: pageData.title,
          url: pageData.url,
          domain: pageData.domain,
          headingsCount: headings.length,
          datesCount: dates.length,
          characterCount: (pageData.extractedText || '').length
        }
      };
    },

    async _demoSubmit(proposalData) {
      const proposalId = 'demo-prop-' + Date.now().toString(36);
      const record = {
        id: proposalId,
        title: proposalData.title || 'Webpage Analysis',
        url: proposalData.url || '',
        source: 'Chrome Extension (Demo)',
        created: Date.now(),
        status: 'pending',
        summary: proposalData.summary || '',
        tasks: proposalData.tasks || [],
        isDemo: true
      };

      // Store in chrome.storage.local
      await this.saveDemoProposal(record);

      return {
        success: true,
        mode: 'demo',
        isDemo: true,
        proposalId: proposalId,
        message: 'Saved locally to Chrome Storage — not submitted to SaarthiFlow backend.',
        proposal: record
      };
    },

    // -------------------------------------------------------------
    // MODE B: LIVE BACKEND INTEGRATION ENGINE
    // -------------------------------------------------------------
    async _liveAnalyze(pageData, settings) {
      const backendUrl = settings.backendUrl;
      const endpoint = `${backendUrl}${root.SF_CONFIG.ENDPOINTS.analyze}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), root.SF_CONFIG.LIMITS.REQUEST_TIMEOUT_MS);

      const payload = {
        url: pageData.url,
        title: pageData.title,
        domain: pageData.domain,
        favicon: pageData.favicon,
        metaDescription: pageData.metaDescription,
        extractedText: pageData.extractedText,
        headings: pageData.headings,
        dates: pageData.dates,
        links: pageData.links
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
          throw new Error(`Backend analysis failed (HTTP ${response.status}): ${errText || response.statusText}`);
        }

        const data = await response.json();

        // Support either synchronous task return or async job initiation
        if (data.jobId && data.status === 'pending') {
          return {
            success: true,
            mode: 'live',
            asyncJob: true,
            jobId: data.jobId,
            message: data.message || 'Analysis in progress on backend'
          };
        }

        return {
          success: true,
          mode: 'live',
          isDemo: false,
          summary: data.summary || 'Summary generated by SaarthiFlow Agent.',
          deadlines: data.deadlines || [],
          requirements: data.requirements || [],
          tasks: (data.tasks || []).map(t => ({
            id: t.id || uid(),
            title: t.title || 'Untitled Task',
            description: t.description || '',
            priority: t.priority || 'Medium',
            due: t.due || addDays(5),
            project: t.project || 'General',
            selected: true
          }))
        };
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error(`Request timed out after ${root.SF_CONFIG.LIMITS.REQUEST_TIMEOUT_MS / 1000}s. Backend might be processing slowly.`);
        }
        throw new Error(`Backend not connected at ${backendUrl}. ${err.message || 'Check server connection.'}`);
      }
    },

    async _liveSubmit(proposalData, settings) {
      const backendUrl = settings.backendUrl;
      const endpoint = `${backendUrl}${root.SF_CONFIG.ENDPOINTS.proposals}`;
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
          project: t.project || 'General'
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
          throw new Error(`Proposal submission failed (HTTP ${response.status}): ${errText || response.statusText}`);
        }

        const data = await response.json();
        return {
          success: true,
          mode: 'live',
          isDemo: false,
          proposalId: data.proposalId || data.id,
          message: data.message || 'Plan submitted successfully for approval in SaarthiFlow!'
        };
      } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          throw new Error('Submission timed out. Please verify backend status.');
        }
        throw new Error(`Failed to submit proposal to backend: ${err.message}`);
      }
    },

    // -------------------------------------------------------------
    // DEMO PROPOSAL LOCAL STORAGE HELPERS
    // -------------------------------------------------------------
    async getDemoProposals() {
      return new Promise((resolve) => {
        if (!chrome?.storage?.local) {
          resolve([]);
          return;
        }
        chrome.storage.local.get([root.SF_CONFIG.STORAGE_KEYS.DEMO_PROPOSALS], (res) => {
          resolve(res[root.SF_CONFIG.STORAGE_KEYS.DEMO_PROPOSALS] || []);
        });
      });
    },

    async saveDemoProposal(proposal) {
      return new Promise((resolve) => {
        if (!chrome?.storage?.local) {
          resolve();
          return;
        }
        chrome.storage.local.get([root.SF_CONFIG.STORAGE_KEYS.DEMO_PROPOSALS], (res) => {
          const list = res[root.SF_CONFIG.STORAGE_KEYS.DEMO_PROPOSALS] || [];
          list.unshift(proposal);
          // Keep up to max limit
          const trimmed = list.slice(0, root.SF_CONFIG.LIMITS.MAX_SAVED_PROPOSALS);
          const obj = {};
          obj[root.SF_CONFIG.STORAGE_KEYS.DEMO_PROPOSALS] = trimmed;
          chrome.storage.local.set(obj, () => resolve(trimmed));
        });
      });
    },

    async clearDemoProposals() {
      return new Promise((resolve) => {
        if (!chrome?.storage?.local) {
          resolve();
          return;
        }
        const obj = {};
        obj[root.SF_CONFIG.STORAGE_KEYS.DEMO_PROPOSALS] = [];
        chrome.storage.local.set(obj, () => resolve());
      });
    }
  };

  root.SF_API = SF_API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
