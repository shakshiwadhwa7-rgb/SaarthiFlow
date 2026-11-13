/**
 * SaarthiFlow Chrome Extension - Popup Controller
 * Manages UI interactions, extraction triggers, task manipulation, and approval workflows.
 */

(function () {
  'use strict';

  // --- STATE MANAGEMENT ---
  const state = {
    settings: {
      mode: 'demo',
      backendUrl: 'http://localhost:3000',
      dashboardUrl: 'http://localhost:5173'
    },
    currentTab: null,
    isRestrictedPage: false,
    pageData: null,
    analysisResult: null,
    tasks: [],
    isAnalyzing: false,
    isSubmitting: false
  };

  // --- DOM ELEMENT REFERENCES ---
  const elements = {
    // Top Bar
    btnStatusPill: document.getElementById('btn-status-pill'),
    txtModeLabel: document.getElementById('txt-mode-label'),
    btnToggleSettings: document.getElementById('btn-toggle-settings'),

    // Alerts
    bannerAlert: document.getElementById('banner-alert'),
    alertIcon: document.getElementById('alert-icon'),
    alertMessage: document.getElementById('alert-message'),
    btnCloseAlert: document.getElementById('btn-close-alert'),

    // Views
    viewMain: document.getElementById('view-main'),
    viewSettings: document.getElementById('view-settings'),

    // Current Tab Card
    tabFavicon: document.getElementById('tab-favicon'),
    tabFaviconFallback: document.getElementById('tab-favicon-fallback'),
    tabDomain: document.getElementById('tab-domain'),
    tabTitle: document.getElementById('tab-title'),
    tabUrl: document.getElementById('tab-url'),

    // Action Hero
    btnAnalyze: document.getElementById('btn-analyze'),

    // Loading State
    panelLoading: document.getElementById('panel-loading'),
    loadingStageTitle: document.getElementById('loading-stage-title'),
    loadingStageDesc: document.getElementById('loading-stage-desc'),

    // Results Panel
    panelResults: document.getElementById('panel-results'),
    badgeModeNotice: document.getElementById('badge-mode-notice'),
    txtSummary: document.getElementById('txt-summary'),
    badgeCategory: document.getElementById('badge-category'),
    cardDeadlines: document.getElementById('card-deadlines'),
    listDeadlines: document.getElementById('list-deadlines'),

    // Tasks
    txtTaskCount: document.getElementById('txt-task-count'),
    btnSelectAll: document.getElementById('btn-select-all'),
    btnDeselectAll: document.getElementById('btn-deselect-all'),
    btnAddTask: document.getElementById('btn-add-task'),
    containerTasksList: document.getElementById('container-tasks-list'),
    btnSendApproval: document.getElementById('btn-send-approval'),
    txtSubmitBtnLabel: document.getElementById('txt-submit-btn-label'),
    panelSubmissionFeedback: document.getElementById('panel-submission-feedback'),
    txtFeedbackTitle: document.getElementById('txt-feedback-title'),
    txtFeedbackMessage: document.getElementById('txt-feedback-message'),

    // Settings View Elements
    btnBackFromSettings: document.getElementById('btn-back-from-settings'),
    optModeDemo: document.getElementById('opt-mode-demo'),
    optModeLive: document.getElementById('opt-mode-live'),
    inputBackendUrl: document.getElementById('input-backend-url'),
    inputDashboardUrl: document.getElementById('input-dashboard-url'),
    btnTestConnection: document.getElementById('btn-test-connection'),
    statusConnectionBadge: document.getElementById('status-connection-badge'),
    txtDemoProposalsCount: document.getElementById('txt-demo-proposals-count'),
    btnClearDemo: document.getElementById('btn-clear-demo'),
    btnSaveSettings: document.getElementById('btn-save-settings'),

    // Footer Links
    linkDashboard: document.getElementById('link-dashboard'),
    linkApprovals: document.getElementById('link-approvals'),
    linkSpace: document.getElementById('link-space')
  };

  // --- INITIALIZATION ---
  async function init() {
    setupEventListeners();
    await loadSettings();
    await detectCurrentTab();
    await restorePreviousSession();
    updateDemoProposalsCount();
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Settings view navigation
    elements.btnToggleSettings.addEventListener('click', () => openSettingsView(true));
    elements.btnStatusPill.addEventListener('click', () => openSettingsView(true));
    elements.btnBackFromSettings.addEventListener('click', () => openSettingsView(false));

    // Mode toggles inside settings
    elements.optModeDemo.addEventListener('click', () => selectModeInSettings('demo'));
    elements.optModeLive.addEventListener('click', () => selectModeInSettings('live'));

    // Test backend connection
    elements.btnTestConnection.addEventListener('click', testBackendConnection);

    // Save settings
    elements.btnSaveSettings.addEventListener('click', saveSettingsFromForm);

    // Clear demo storage
    elements.btnClearDemo.addEventListener('click', handleClearDemoData);

    // Alert dismiss
    elements.btnCloseAlert.addEventListener('click', hideAlert);

    // Main action: Analyze page
    elements.btnAnalyze.addEventListener('click', handleAnalyzePage);

    // Tasks batch actions
    elements.btnSelectAll.addEventListener('click', () => setAllTasksSelection(true));
    elements.btnDeselectAll.addEventListener('click', () => setAllTasksSelection(false));
    elements.btnAddTask.addEventListener('click', handleAddNewTask);

    // Send for approval
    elements.btnSendApproval.addEventListener('click', handleSendForApproval);

    // Footer external links
    elements.linkDashboard.addEventListener('click', (e) => {
      e.preventDefault();
      openDashboardRoute('/');
    });
    elements.linkApprovals.addEventListener('click', (e) => {
      e.preventDefault();
      openDashboardRoute('/approvals');
    });
    elements.linkSpace.addEventListener('click', (e) => {
      e.preventDefault();
      openDashboardRoute('/space');
    });
  }

  // --- SETTINGS MANAGEMENT ---
  async function loadSettings() {
    try {
      state.settings = await window.SF_CONFIG.getSettings();
      updateModeUI();
      populateSettingsForm();
    } catch (err) {
      console.warn('[SaarthiFlow] Error loading settings:', err);
    }
  }

  function updateModeUI() {
    const isLive = state.settings.mode === 'live';

    // Status pill in header
    elements.btnStatusPill.className = `status-pill ${isLive ? 'status-live-ok' : 'status-demo'}`;
    elements.txtModeLabel.textContent = isLive ? 'Live Mode' : 'Demo Mode';

    // Mode notice in results
    if (elements.badgeModeNotice) {
      elements.badgeModeNotice.className = `mode-notice ${isLive ? 'mode-live-notice' : 'mode-demo-notice'}`;
      const textEl = elements.badgeModeNotice.querySelector('.mode-notice-text');
      if (textEl) {
        textEl.innerHTML = isLive
          ? '<strong>Live Mode:</strong> Webpage content analyzed via SaarthiFlow Backend. Real tasks will be submitted to Approvals.'
          : '<strong>Local Demo Mode:</strong> Analyzed real webpage structure. Tasks generated deterministically for testing without backend.';
      }
    }
  }

  function populateSettingsForm() {
    selectModeInSettings(state.settings.mode);
    elements.inputBackendUrl.value = state.settings.backendUrl || 'http://localhost:3000';
    elements.inputDashboardUrl.value = state.settings.dashboardUrl || 'http://localhost:5173';
  }

  function selectModeInSettings(mode) {
    if (mode === 'live') {
      elements.optModeLive.classList.add('active');
      elements.optModeDemo.classList.remove('active');
    } else {
      elements.optModeDemo.classList.add('active');
      elements.optModeLive.classList.remove('active');
    }
  }

  async function saveSettingsFromForm() {
    const isLive = elements.optModeLive.classList.contains('active');
    const mode = isLive ? 'live' : 'demo';
    const backendUrl = elements.inputBackendUrl.value.trim() || 'http://localhost:3000';
    const dashboardUrl = elements.inputDashboardUrl.value.trim() || 'http://localhost:5173';

    if (!window.SF_CONFIG.isValidHttpUrl(backendUrl)) {
      showAlert('Please enter a valid Backend URL (e.g., http://localhost:3000)', 'error');
      return;
    }

    if (!window.SF_CONFIG.isValidHttpUrl(dashboardUrl)) {
      showAlert('Please enter a valid Dashboard URL (e.g., http://localhost:5173)', 'error');
      return;
    }

    try {
      const updated = await window.SF_CONFIG.saveSettings({
        mode,
        backendUrl,
        dashboardUrl
      });
      state.settings = updated;
      updateModeUI();

      // Notify background worker
      chrome.runtime.sendMessage({ action: 'SF_REFRESH_SETTINGS' }, () => {
        // Safe callback ignore
      });

      showAlert('Settings saved successfully.', 'success');
      setTimeout(() => openSettingsView(false), 500);
    } catch (err) {
      showAlert(`Failed to save settings: ${err.message}`, 'error');
    }
  }

  async function testBackendConnection() {
    const backendUrl = elements.inputBackendUrl.value.trim() || 'http://localhost:3000';
    elements.statusConnectionBadge.className = 'connection-status-pill';
    elements.statusConnectionBadge.textContent = 'Testing connection…';
    elements.btnTestConnection.disabled = true;

    try {
      const res = await window.SF_API.checkHealth({
        mode: 'live',
        backendUrl: backendUrl
      });

      if (res.ok) {
        elements.statusConnectionBadge.className = 'connection-status-pill ok';
        elements.statusConnectionBadge.textContent = `Connected (HTTP ${res.status})`;
      } else {
        elements.statusConnectionBadge.className = 'connection-status-pill error';
        elements.statusConnectionBadge.textContent = res.error || 'Server offline';
      }
    } catch (e) {
      elements.statusConnectionBadge.className = 'connection-status-pill error';
      elements.statusConnectionBadge.textContent = 'Unreachable';
    } finally {
      elements.btnTestConnection.disabled = false;
    }
  }

  async function updateDemoProposalsCount() {
    try {
      const list = await window.SF_API.getDemoProposals();
      elements.txtDemoProposalsCount.textContent = `${list.length} proposal${list.length === 1 ? '' : 's'}`;
    } catch {
      elements.txtDemoProposalsCount.textContent = '0 proposals';
    }
  }

  async function handleClearDemoData() {
    if (!confirm('Clear all locally saved demo proposals from Chrome extension storage?')) {
      return;
    }
    await window.SF_API.clearDemoProposals();
    updateDemoProposalsCount();
    showAlert('Local demo proposals cleared.', 'info');
  }

  function openSettingsView(show) {
    if (show) {
      elements.viewSettings.classList.remove('hidden');
      populateSettingsForm();
      updateDemoProposalsCount();
    } else {
      elements.viewSettings.classList.add('hidden');
    }
  }

  // --- TAB DETECTION & VALIDATION ---
  async function detectCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs.length) {
          showRestrictedState('No active browser tab found.');
          resolve(null);
          return;
        }

        const tab = tabs[0];
        state.currentTab = tab;

        const url = tab.url || '';
        const isRestricted = isRestrictedUrl(url);
        state.isRestrictedPage = isRestricted;

        // Render Tab Info
        elements.tabTitle.textContent = tab.title || 'Untitled Webpage';
        elements.tabUrl.textContent = url || 'No URL available';

        try {
          const parsed = new URL(url);
          elements.tabDomain.textContent = parsed.hostname || 'Webpage';
        } catch {
          elements.tabDomain.textContent = 'Webpage';
        }

        // Render Favicon
        if (tab.favIconUrl && !tab.favIconUrl.startsWith('chrome://')) {
          elements.tabFavicon.src = tab.favIconUrl;
          elements.tabFavicon.classList.remove('hidden');
          elements.tabFaviconFallback.classList.add('hidden');
          elements.tabFavicon.onerror = () => {
            elements.tabFavicon.classList.add('hidden');
            elements.tabFaviconFallback.classList.remove('hidden');
          };
        } else {
          elements.tabFavicon.classList.add('hidden');
          elements.tabFaviconFallback.classList.remove('hidden');
        }

        if (isRestricted) {
          showRestrictedState('Chrome restricts extensions on system pages (e.g., chrome://, edge://, extension settings). Please open any normal webpage.');
        } else {
          hideAlert();
          elements.btnAnalyze.disabled = false;
        }

        resolve(tab);
      });
    });
  }

  function isRestrictedUrl(url) {
    if (!url) return true;
    const restrictedPrefixes = [
      'chrome://',
      'chrome-extension://',
      'devtools://',
      'edge://',
      'about:',
      'view-source:',
      'brave://',
      'opera://'
    ];
    return restrictedPrefixes.some(p => url.startsWith(p));
  }

  function showRestrictedState(message) {
    elements.btnAnalyze.disabled = true;
    showAlert(message, 'warning');
  }

  // --- WEBPAGE EXTRACTION & ANALYSIS WORKFLOW ---
  async function handleAnalyzePage() {
    if (state.isAnalyzing || state.isRestrictedPage || !state.currentTab) return;

    state.isAnalyzing = true;
    elements.btnAnalyze.disabled = true;
    elements.panelLoading.classList.remove('hidden');
    elements.panelResults.classList.add('hidden');
    elements.panelSubmissionFeedback.classList.add('hidden');
    hideAlert();

    // Stage 1: Extraction
    elements.loadingStageTitle.textContent = 'Reading webpage content…';
    elements.loadingStageDesc.textContent = 'Extracting clean text, headings, and dates';

    try {
      const tabId = state.currentTab.id;

      // Inject and execute content extractor script
      const extractionResult = await executeExtractorScript(tabId);
      if (!extractionResult || !extractionResult.success) {
        throw new Error(extractionResult?.error || 'Unable to extract content from webpage.');
      }

      state.pageData = extractionResult;

      // Stage 2: Analysis & Task Generation
      elements.loadingStageTitle.textContent = state.settings.mode === 'live'
        ? 'Sending to SaarthiFlow Backend…'
        : 'Generating task proposals (Demo)…';
      elements.loadingStageDesc.textContent = state.settings.mode === 'live'
        ? 'Activepieces agent is structuring your tasks'
        : 'Deterministic local parsing identifying action items';

      const analysis = await window.SF_API.analyzeWebpage(state.pageData, state.settings);
      state.analysisResult = analysis;
      state.tasks = (analysis.tasks || []).map(t => ({ ...t, selected: t.selected !== false }));

      // Render Results
      renderAnalysisResults();
      await persistCurrentSession();

    } catch (err) {
      console.error('[SaarthiFlow] Analysis failed:', err);
      showAlert(err.message || 'Analysis could not be completed.', 'error');
    } finally {
      state.isAnalyzing = false;
      elements.btnAnalyze.disabled = false;
      elements.panelLoading.classList.add('hidden');
    }
  }

  /**
   * Safely injects content.js or sends a message if already injected
   */
  async function executeExtractorScript(tabId) {
    return new Promise((resolve) => {
      // First try sending a message in case content.js is already running
      chrome.tabs.sendMessage(tabId, { action: 'SF_EXTRACT_CONTENT' }, (response) => {
        if (!chrome.runtime.lastError && response && response.success) {
          resolve(response.data);
          return;
        }

        // If not already injected, inject content.js dynamically
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }, (injectionResults) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              error: chrome.runtime.lastError.message
            });
            return;
          }

          if (injectionResults && injectionResults.length > 0) {
            resolve(injectionResults[0].result);
          } else {
            resolve({
              success: false,
              error: 'No extraction data returned from script.'
            });
          }
        });
      });
    });
  }

  // --- RENDERING RESULTS ---
  function renderAnalysisResults() {
    const analysis = state.analysisResult;
    if (!analysis) return;

    elements.panelResults.classList.remove('hidden');

    // Summary Text
    elements.txtSummary.textContent = analysis.summary || 'No summary available.';

    // Category Chip
    elements.badgeCategory.textContent = analysis.category || 'General';

    // Deadlines & Dates
    elements.listDeadlines.innerHTML = '';
    const dates = analysis.deadlines || [];
    if (dates.length === 0 || (dates.length === 1 && dates[0].includes('No explicit deadline'))) {
      const emptyTag = document.createElement('div');
      emptyTag.className = 'deadline-item';
      emptyTag.textContent = 'No explicit deadlines detected in body text.';
      elements.listDeadlines.appendChild(emptyTag);
    } else {
      dates.forEach(d => {
        const item = document.createElement('div');
        item.className = 'deadline-item';

        const parts = d.split(':');
        if (parts.length > 1) {
          const badge = document.createElement('span');
          badge.className = 'deadline-item-badge';
          badge.textContent = parts[0].trim();

          const val = document.createElement('span');
          val.className = 'deadline-item-text';
          val.textContent = parts.slice(1).join(':').trim();

          item.appendChild(badge);
          item.appendChild(val);
        } else {
          item.textContent = d;
        }

        elements.listDeadlines.appendChild(item);
      });
    }

    // Render Tasks
    renderTasksList();
  }

  function renderTasksList() {
    elements.containerTasksList.innerHTML = '';
    const tasks = state.tasks;

    elements.txtTaskCount.textContent = tasks.length;
    updateSubmitButton();

    if (tasks.length === 0) {
      const emptyNote = document.createElement('div');
      emptyNote.style.padding = '16px';
      emptyNote.style.textAlign = 'center';
      emptyNote.style.color = 'var(--ink-muted)';
      emptyNote.style.fontSize = '12px';
      emptyNote.textContent = 'No tasks proposed yet. Click "+ Add Task" to create one.';
      elements.containerTasksList.appendChild(emptyNote);
      return;
    }

    tasks.forEach((task, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = `task-item ${task.selected ? 'selected' : ''}`;
      itemEl.dataset.taskId = task.id;

      // Row 1: Checkbox + Editable Title + Delete Button
      const rowTop = document.createElement('div');
      rowTop.className = 'task-row-top';

      // Checkbox
      const checkWrap = document.createElement('div');
      checkWrap.className = 'task-checkbox-wrap';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'custom-checkbox';
      checkbox.checked = Boolean(task.selected);
      checkbox.addEventListener('change', () => {
        task.selected = checkbox.checked;
        itemEl.classList.toggle('selected', task.selected);
        updateSubmitButton();
        persistCurrentSession();
      });
      checkWrap.appendChild(checkbox);
      rowTop.appendChild(checkWrap);

      // Editable Title Input
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'task-title-input';
      titleInput.value = task.title || '';
      titleInput.placeholder = 'Task title…';
      titleInput.addEventListener('input', () => {
        task.title = titleInput.value.trim();
        persistCurrentSession();
      });
      rowTop.appendChild(titleInput);

      // Delete Button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'task-btn-delete';
      deleteBtn.setAttribute('aria-label', 'Delete task');
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      `;
      deleteBtn.addEventListener('click', () => {
        state.tasks.splice(index, 1);
        renderTasksList();
        persistCurrentSession();
      });
      rowTop.appendChild(deleteBtn);

      itemEl.appendChild(rowTop);

      // Row 2: Priority Dropdown + Due Date Picker + Project Badge
      const rowMeta = document.createElement('div');
      rowMeta.className = 'task-row-meta';

      // Priority Selector
      const priSelect = document.createElement('select');
      priSelect.className = `select-priority pri-${task.priority || 'Medium'}`;
      ['High', 'Medium', 'Low'].forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        if (task.priority === p) opt.selected = true;
        priSelect.appendChild(opt);
      });
      priSelect.addEventListener('change', () => {
        task.priority = priSelect.value;
        priSelect.className = `select-priority pri-${task.priority}`;
        persistCurrentSession();
      });
      rowMeta.appendChild(priSelect);

      // Due Date Input
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'input-due-date';
      dateInput.value = task.due || '';
      dateInput.addEventListener('change', () => {
        task.due = dateInput.value;
        persistCurrentSession();
      });
      rowMeta.appendChild(dateInput);

      // Project Tag
      const projTag = document.createElement('span');
      projTag.className = 'task-project-tag';
      projTag.textContent = task.project || 'General';
      rowMeta.appendChild(projTag);

      itemEl.appendChild(rowMeta);
      elements.containerTasksList.appendChild(itemEl);
    });
  }

  function setAllTasksSelection(selected) {
    state.tasks.forEach(t => {
      t.selected = selected;
    });
    renderTasksList();
    persistCurrentSession();
  }

  function handleAddNewTask() {
    const today = new Date();
    today.setDate(today.getDate() + 3);
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');

    const newTask = {
      id: 'sf-custom-' + Date.now().toString(36),
      title: 'New action item',
      description: 'Manually added task',
      priority: 'Medium',
      due: `${y}-${m}-${d}`,
      project: state.analysisResult?.category || 'General',
      selected: true
    };

    state.tasks.unshift(newTask);
    renderTasksList();
    persistCurrentSession();

    // Auto-focus the newly created title input
    setTimeout(() => {
      const firstInput = elements.containerTasksList.querySelector('.task-title-input');
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }
    }, 50);
  }

  function updateSubmitButton() {
    const selectedCount = state.tasks.filter(t => t.selected).length;
    elements.txtSubmitBtnLabel.textContent = `Send ${selectedCount} Task${selectedCount === 1 ? '' : 's'} for Approval`;
    elements.btnSendApproval.disabled = selectedCount === 0 || state.isSubmitting;
  }

  // --- SUBMISSION FOR APPROVAL ---
  async function handleSendForApproval() {
    if (state.isSubmitting) return;

    const selectedTasks = state.tasks.filter(t => t.selected);
    if (!selectedTasks.length) {
      showAlert('Please select at least one task to submit.', 'warning');
      return;
    }

    state.isSubmitting = true;
    updateSubmitButton();
    elements.panelSubmissionFeedback.classList.add('hidden');

    const proposalPayload = {
      title: state.pageData?.title || 'Webpage Analysis',
      url: state.pageData?.url || state.currentTab?.url || '',
      summary: state.analysisResult?.summary || '',
      tasks: selectedTasks
    };

    try {
      const response = await window.SF_API.submitProposal(proposalPayload, state.settings);

      // Display feedback panel
      elements.panelSubmissionFeedback.classList.remove('hidden');

      if (response.mode === 'demo') {
        elements.txtFeedbackTitle.textContent = 'Saved Locally (Demo Mode)';
        elements.txtFeedbackMessage.textContent = 'Proposals saved to Chrome local storage — not submitted to SaarthiFlow backend.';
      } else {
        elements.txtFeedbackTitle.textContent = 'Sent for Approval!';
        elements.txtFeedbackMessage.textContent = response.message || 'Plan submitted to SaarthiFlow Approvals page.';
      }

      updateDemoProposalsCount();
      showAlert('Tasks successfully prepared for approval!', 'success');

    } catch (err) {
      console.error('[SaarthiFlow] Submit error:', err);
      showAlert(`Submission failed: ${err.message}`, 'error');
    } finally {
      state.isSubmitting = false;
      updateSubmitButton();
    }
  }

  // --- SESSION PERSISTENCE ---
  async function persistCurrentSession() {
    if (!chrome?.storage?.local || !state.pageData) return;

    try {
      const payload = {};
      payload[window.SF_CONFIG.STORAGE_KEYS.LAST_ANALYSIS] = {
        pageData: state.pageData,
        analysisResult: state.analysisResult,
        tasks: state.tasks,
        timestamp: Date.now()
      };
      await new Promise(r => chrome.storage.local.set(payload, r));
    } catch (e) {
      console.debug('[SaarthiFlow] Session persist warning:', e);
    }
  }

  async function restorePreviousSession() {
    if (!chrome?.storage?.local) return;

    try {
      const result = await new Promise(r => chrome.storage.local.get([window.SF_CONFIG.STORAGE_KEYS.LAST_ANALYSIS], r));
      const saved = result[window.SF_CONFIG.STORAGE_KEYS.LAST_ANALYSIS];

      // Restore if exists and belongs to the current tab URL
      if (saved && saved.pageData && state.currentTab && saved.pageData.url === state.currentTab.url) {
        state.pageData = saved.pageData;
        state.analysisResult = saved.analysisResult;
        state.tasks = saved.tasks || [];
        renderAnalysisResults();
      }
    } catch (e) {
      console.debug('[SaarthiFlow] Session restore non-fatal:', e);
    }
  }

  // --- NAVIGATION HELPERS ---
  function openDashboardRoute(route) {
    const base = state.settings.dashboardUrl || 'http://localhost:5173';
    const targetUrl = `${window.SF_CONFIG.normalizeUrl(base)}${route}`;
    chrome.tabs.create({ url: targetUrl });
  }

  // --- ALERTS UI ---
  function showAlert(message, type = 'info') {
    elements.bannerAlert.className = `alert-banner ${type}`;
    elements.alertMessage.textContent = message;
    elements.bannerAlert.classList.remove('hidden');

    if (type === 'success') {
      setTimeout(() => hideAlert(), 4000);
    }
  }

  function hideAlert() {
    elements.bannerAlert.classList.add('hidden');
  }

  // Run on DOM ready
  document.addEventListener('DOMContentLoaded', init);
})();
