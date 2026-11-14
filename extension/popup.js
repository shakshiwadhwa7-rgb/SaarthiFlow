/**
 * SaarthiFlow Chrome Extension - Agentic Popup Controller
 * Workflow: DISCOVER → UNDERSTAND → PLAN → APPROVE → EXECUTE → VERIFY
 */

(function () {
  'use strict';

  // --- APPLICATION STATE ---
  const state = {
    settings: {
      mode: 'live',
      backendUrl: 'http://localhost:3001',
      dashboardUrl: 'http://localhost:5173'
    },
    currentTab: null,
    isRestrictedPage: false,
    pageData: null,
    planResult: null,
    tasks: [],
    isPlanning: false,
    isSubmitting: false
  };

  // --- DOM ELEMENT REFERENCES ---
  const elements = {
    // Top Bar
    btnToggleRecents: document.getElementById('btn-toggle-recents'),
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
    viewRecents: document.getElementById('view-recents'),

    // Current Tab Card
    tabFavicon: document.getElementById('tab-favicon'),
    tabFaviconFallback: document.getElementById('tab-favicon-fallback'),
    tabDomain: document.getElementById('tab-domain'),
    badgePageType: document.getElementById('badge-page-type'),
    tabTitle: document.getElementById('tab-title'),
    tabUrl: document.getElementById('tab-url'),

    // Action Hero
    panelInitialActions: document.getElementById('panel-initial-actions'),
    btnAnalyze: document.getElementById('btn-analyze'),
    btnQuickTask: document.getElementById('btn-quick-task'),
    btnSaveLater: document.getElementById('btn-save-later'),

    // Loading State
    panelLoading: document.getElementById('panel-loading'),
    loadingStageTitle: document.getElementById('loading-stage-title'),
    loadingStageDesc: document.getElementById('loading-stage-desc'),

    // Results Container
    panelResults: document.getElementById('panel-results'),

    // Non-Actionable Card
    cardNonActionable: document.getElementById('card-non-actionable'),
    btnNaQuickTask: document.getElementById('btn-na-quick-task'),
    btnNaForcePlan: document.getElementById('btn-na-force-plan'),

    // Actionable Opportunity Card
    cardOpportunity: document.getElementById('card-opportunity'),
    txtOppCategoryBadge: document.getElementById('txt-opp-category-badge'),
    txtOppOrganizer: document.getElementById('txt-opp-organizer'),
    txtOppTitle: document.getElementById('txt-opp-title'),
    txtOppDeadline: document.getElementById('txt-opp-deadline'),
    txtOppEligibility: document.getElementById('txt-opp-eligibility'),
    listOppRequirements: document.getElementById('list-opp-requirements'),
    listOppSteps: document.getElementById('list-opp-steps'),
    boxActionLinks: document.getElementById('box-action-links'),
    listActionLinks: document.getElementById('list-action-links'),

    // Tasks Card
    cardTasks: document.getElementById('card-tasks'),
    txtTaskCount: document.getElementById('txt-task-count'),
    btnSelectAll: document.getElementById('btn-select-all'),
    btnDeselectAll: document.getElementById('btn-deselect-all'),
    btnAddTask: document.getElementById('btn-add-task'),
    containerTasksList: document.getElementById('container-tasks-list'),
    btnSendApproval: document.getElementById('btn-send-approval'),
    txtSubmitBtnLabel: document.getElementById('txt-submit-btn-label'),

    // Workflow Status Tracker
    panelWorkflowStatus: document.getElementById('panel-workflow-status'),
    txtWorkflowDesc: document.getElementById('txt-workflow-desc'),
    btnOpenApprovalsPage: document.getElementById('btn-open-approvals-page'),

    // Quick Task Modal
    modalQuickTask: document.getElementById('modal-quick-task'),
    btnCloseQuickModal: document.getElementById('btn-close-quick-modal'),
    inputQtTitle: document.getElementById('input-qt-title'),
    selectQtPriority: document.getElementById('select-qt-priority'),
    inputQtDue: document.getElementById('input-qt-due'),
    selectQtProject: document.getElementById('select-qt-project'),
    inputQtSource: document.getElementById('input-qt-source'),
    btnSubmitQuickTask: document.getElementById('btn-submit-quick-task'),

    // Recents View
    btnBackFromRecents: document.getElementById('btn-back-from-recents'),
    listRecentCaptures: document.getElementById('list-recent-captures'),

    // Settings View Elements
    btnBackFromSettings: document.getElementById('btn-back-from-settings'),
    optModeLive: document.getElementById('opt-mode-live'),
    optModeDemo: document.getElementById('opt-mode-demo'),
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
    checkBackendHealthSilently();
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Navigation / Drawers
    elements.btnToggleSettings.addEventListener('click', () => toggleView('settings', true));
    elements.btnBackFromSettings.addEventListener('click', () => toggleView('settings', false));
    elements.btnStatusPill.addEventListener('click', () => toggleView('settings', true));

    elements.btnToggleRecents.addEventListener('click', () => {
      renderRecentCaptures();
      toggleView('recents', true);
    });
    elements.btnBackFromRecents.addEventListener('click', () => toggleView('recents', false));

    // Mode toggles inside settings
    elements.optModeLive.addEventListener('click', () => selectModeInSettings('live'));
    elements.optModeDemo.addEventListener('click', () => selectModeInSettings('demo'));

    // Test connection & save settings
    elements.btnTestConnection.addEventListener('click', testBackendConnection);
    elements.btnSaveSettings.addEventListener('click', saveSettingsFromForm);
    elements.btnClearDemo.addEventListener('click', handleClearDemoData);

    // Alerts
    elements.btnCloseAlert.addEventListener('click', hideAlert);

    // Primary Action: Turn This Page Into Actions
    elements.btnAnalyze.addEventListener('click', () => handlePlanActions(false));

    // Secondary Actions
    elements.btnQuickTask.addEventListener('click', openQuickTaskModal);
    elements.btnSaveLater.addEventListener('click', handleSaveForLater);

    // Non-Actionable fallbacks
    elements.btnNaQuickTask.addEventListener('click', openQuickTaskModal);
    elements.btnNaForcePlan.addEventListener('click', () => handlePlanActions(true));

    // Quick Task Modal
    elements.btnCloseQuickModal.addEventListener('click', closeQuickTaskModal);
    elements.btnSubmitQuickTask.addEventListener('click', handleSubmitQuickTask);

    // Tasks batch controls
    elements.btnSelectAll.addEventListener('click', () => setAllTasksSelection(true));
    elements.btnDeselectAll.addEventListener('click', () => setAllTasksSelection(false));
    elements.btnAddTask.addEventListener('click', handleAddNewTask);

    // Approval action
    elements.btnSendApproval.addEventListener('click', handleSendForApproval);
    elements.btnOpenApprovalsPage.addEventListener('click', () => openDashboardRoute('/approvals'));

    // Footer links
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
    elements.btnStatusPill.className = `status-pill ${isLive ? 'status-live-ok' : 'status-demo'}`;
    elements.txtModeLabel.textContent = isLive ? 'Live Mode' : 'Demo Mode';
  }

  function populateSettingsForm() {
    selectModeInSettings(state.settings.mode);
    elements.inputBackendUrl.value = state.settings.backendUrl || 'http://localhost:3001';
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
    const backendUrl = elements.inputBackendUrl.value.trim() || 'http://localhost:3001';
    const dashboardUrl = elements.inputDashboardUrl.value.trim() || 'http://localhost:5173';

    if (!window.SF_CONFIG.isValidHttpUrl(backendUrl)) {
      showAlert('Please enter a valid Backend URL (e.g. http://localhost:3001)', 'error');
      return;
    }

    if (!window.SF_CONFIG.isValidHttpUrl(dashboardUrl)) {
      showAlert('Please enter a valid Dashboard URL (e.g. http://localhost:5173)', 'error');
      return;
    }

    try {
      const updated = await window.SF_CONFIG.saveSettings({ mode, backendUrl, dashboardUrl });
      state.settings = updated;
      updateModeUI();

      chrome.runtime.sendMessage({ action: 'SF_REFRESH_SETTINGS' }, () => {});

      showAlert('Settings saved successfully.', 'success');
      setTimeout(() => toggleView('settings', false), 500);
    } catch (err) {
      showAlert(`Failed to save settings: ${err.message}`, 'error');
    }
  }

  async function testBackendConnection() {
    const backendUrl = elements.inputBackendUrl.value.trim() || 'http://localhost:3001';
    elements.statusConnectionBadge.className = 'connection-status-pill';
    elements.statusConnectionBadge.textContent = 'Testing connection…';
    elements.btnTestConnection.disabled = true;

    try {
      const res = await window.SF_API.checkHealth({ mode: 'live', backendUrl });
      if (res.ok) {
        elements.statusConnectionBadge.className = 'connection-status-pill ok';
        elements.statusConnectionBadge.textContent = `Connected (HTTP ${res.status})`;
      } else {
        elements.statusConnectionBadge.className = 'connection-status-pill error';
        elements.statusConnectionBadge.textContent = res.error || 'Server offline';
      }
    } catch {
      elements.statusConnectionBadge.className = 'connection-status-pill error';
      elements.statusConnectionBadge.textContent = 'Unreachable';
    } finally {
      elements.btnTestConnection.disabled = false;
    }
  }

  async function checkBackendHealthSilently() {
    if (state.settings.mode !== 'live') return;
    try {
      const res = await window.SF_API.checkHealth(state.settings);
      if (!res.ok) {
        elements.btnStatusPill.className = 'status-pill status-live-err';
        elements.txtModeLabel.textContent = 'Backend Offline';
      }
    } catch {
      elements.btnStatusPill.className = 'status-pill status-live-err';
      elements.txtModeLabel.textContent = 'Backend Offline';
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
    if (!confirm('Clear locally stored demo proposals?')) return;
    await window.SF_API.clearDemoProposals();
    updateDemoProposalsCount();
    showAlert('Demo proposals cleared.', 'info');
  }

  function toggleView(viewName, show) {
    if (viewName === 'settings') {
      elements.viewSettings.classList.toggle('hidden', !show);
      if (show) populateSettingsForm();
    } else if (viewName === 'recents') {
      elements.viewRecents.classList.toggle('hidden', !show);
    }
  }

  // --- TAB DETECTION & INITIAL CLASSIFICATION ---
  async function detectCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        if (!tabs || !tabs.length) {
          showRestrictedState('No active browser tab found.');
          return resolve(null);
        }

        const tab = tabs[0];
        state.currentTab = tab;
        const url = tab.url || '';
        const isRestricted = isRestrictedUrl(url);
        state.isRestrictedPage = isRestricted;

        // Render tab info
        elements.tabTitle.textContent = tab.title || 'Untitled Webpage';
        elements.tabUrl.textContent = url || 'No URL';

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
        } else {
          elements.tabFavicon.classList.add('hidden');
          elements.tabFaviconFallback.classList.remove('hidden');
        }

        if (isRestricted) {
          elements.badgePageType.textContent = 'Restricted';
          showRestrictedState('Chrome restricts extensions on internal system pages (chrome://, edge://). Please open any normal webpage.');
          return resolve(tab);
        }

        // Quick Pre-Extraction for Page Type Badge
        try {
          const quickExtract = await executeExtractorScript(tab.id);
          if (quickExtract && quickExtract.opportunity) {
            state.pageData = quickExtract;
            const opp = quickExtract.opportunity;
            elements.badgePageType.textContent = `${opp.categoryIcon} ${opp.categoryName}`;
          } else {
            elements.badgePageType.textContent = '🌐 Webpage';
          }
        } catch {
          elements.badgePageType.textContent = '🌐 Webpage';
        }

        hideAlert();
        elements.btnAnalyze.disabled = false;
        resolve(tab);
      });
    });
  }

  function isRestrictedUrl(url) {
    if (!url) return true;
    const restricted = ['chrome://', 'chrome-extension://', 'devtools://', 'edge://', 'about:', 'view-source:'];
    return restricted.some(p => url.startsWith(p));
  }

  function showRestrictedState(msg) {
    elements.btnAnalyze.disabled = true;
    elements.btnQuickTask.disabled = true;
    elements.btnSaveLater.disabled = true;
    showAlert(msg, 'warning');
  }

  // --- AGENTIC PLANNING WORKFLOW ---
  async function handlePlanActions(forcePlan = false) {
    if (state.isPlanning || state.isRestrictedPage || !state.currentTab) return;

    state.isPlanning = true;
    elements.btnAnalyze.disabled = true;
    elements.panelLoading.classList.remove('hidden');
    elements.panelResults.classList.add('hidden');
    elements.panelWorkflowStatus.classList.add('hidden');
    hideAlert();

    // Stage 1: Extraction
    elements.loadingStageTitle.textContent = 'Understanding webpage content…';
    elements.loadingStageDesc.textContent = 'Extracting opportunities, deadlines, and requirements';

    try {
      const tabId = state.currentTab.id;
      const extraction = await executeExtractorScript(tabId);
      if (!extraction || !extraction.success) {
        throw new Error(extraction?.error || 'Unable to extract information from active webpage.');
      }

      state.pageData = extraction;
      const opp = extraction.opportunity;

      // Update badge
      elements.badgePageType.textContent = `${opp.categoryIcon} ${opp.categoryName}`;

      // Stage 2: Planning
      elements.loadingStageTitle.textContent = state.settings.mode === 'live'
        ? 'SaarthiFlow Agent Planning…'
        : 'Structuring Action Plan (Demo)…';
      elements.loadingStageDesc.textContent = state.settings.mode === 'live'
        ? 'Gemini Agent generating structured action items'
        : 'Generating contextual tasks and deadlines';

      const planResult = await window.SF_API.planPageActions(state.pageData, state.settings);
      state.planResult = planResult;

      // Handle Non-Actionable Pages
      if (!planResult.isActionable && !forcePlan) {
        renderNonActionableState();
      } else {
        state.tasks = (planResult.tasks || []).map(t => ({
          ...t,
          selected: t.selected !== false
        }));
        renderActionableResults();
      }

      await persistCurrentSession();

    } catch (err) {
      console.error('[SaarthiFlow] Planning error:', err);
      showAlert(err.message || 'Action planning could not be completed.', 'error');
    } finally {
      state.isPlanning = false;
      elements.btnAnalyze.disabled = false;
      elements.panelLoading.classList.add('hidden');
    }
  }

  async function executeExtractorScript(tabId) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { action: 'SF_EXTRACT_CONTENT' }, (response) => {
        if (!chrome.runtime.lastError && response && response.success) {
          return resolve(response.data);
        }

        chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        }, (results) => {
          if (chrome.runtime.lastError) {
            return resolve({ success: false, error: chrome.runtime.lastError.message });
          }
          if (results && results.length > 0) {
            return resolve(results[0].result);
          }
          return resolve({ success: false, error: 'No data returned from content script.' });
        });
      });
    });
  }

  // --- RENDERING RESULTS ---
  function renderNonActionableState() {
    elements.panelResults.classList.remove('hidden');
    elements.cardNonActionable.classList.remove('hidden');
    elements.cardOpportunity.classList.add('hidden');
    elements.cardTasks.classList.add('hidden');
  }

  function renderActionableResults() {
    const plan = state.planResult;
    const opp = state.pageData?.opportunity || {};

    elements.panelResults.classList.remove('hidden');
    elements.cardNonActionable.classList.add('hidden');
    elements.cardOpportunity.classList.remove('hidden');
    elements.cardTasks.classList.remove('hidden');

    // Opportunity Metadata
    elements.txtOppCategoryBadge.textContent = `${opp.categoryIcon || '🎯'} ${opp.categoryName || 'Opportunity'}`;
    elements.txtOppOrganizer.textContent = opp.organizer ? `Host: ${opp.organizer}` : 'Host: Not specified';
    elements.txtOppTitle.textContent = opp.opportunityTitle || state.pageData.title;
    elements.txtOppDeadline.textContent = opp.primaryDeadline || 'Not specified';
    elements.txtOppEligibility.textContent = opp.eligibility || 'Not specified';

    // Requirements Checklist
    elements.listOppRequirements.innerHTML = '';
    const reqs = opp.requirements || ['Not specified'];
    reqs.forEach(r => {
      const pill = document.createElement('span');
      pill.className = 'req-pill';
      pill.textContent = r;
      elements.listOppRequirements.appendChild(pill);
    });

    // Next Steps List
    elements.listOppSteps.innerHTML = '';
    const steps = opp.recommendedNextSteps || [];
    steps.forEach(s => {
      const li = document.createElement('li');
      li.textContent = s;
      elements.listOppSteps.appendChild(li);
    });

    // Action Links
    const links = state.pageData?.links || [];
    if (links.length > 0) {
      elements.boxActionLinks.classList.remove('hidden');
      elements.listActionLinks.innerHTML = '';
      links.slice(0, 4).forEach(l => {
        const a = document.createElement('a');
        a.className = 'action-chip-link';
        a.href = l.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = `↗ ${l.title}`;
        elements.listActionLinks.appendChild(a);
      });
    } else {
      elements.boxActionLinks.classList.add('hidden');
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
      emptyNote.style.padding = '14px';
      emptyNote.style.textAlign = 'center';
      emptyNote.style.color = 'var(--ink-muted)';
      emptyNote.style.fontSize = '11px';
      emptyNote.textContent = 'No tasks proposed yet. Click "+ Add Task" to create one.';
      elements.containerTasksList.appendChild(emptyNote);
      return;
    }

    tasks.forEach((task, index) => {
      const itemEl = document.createElement('div');
      itemEl.className = `task-item ${task.selected ? 'selected' : ''}`;
      itemEl.dataset.taskId = task.id;

      // Row 1: Checkbox, Editable Title, Delete Button
      const rowTop = document.createElement('div');
      rowTop.className = 'task-row-top';

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

      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'task-title-input';
      titleInput.value = task.title || '';
      titleInput.placeholder = 'Action title…';
      titleInput.addEventListener('input', () => {
        task.title = titleInput.value.trim();
        persistCurrentSession();
      });
      rowTop.appendChild(titleInput);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'task-btn-delete';
      deleteBtn.setAttribute('aria-label', 'Delete action');
      deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
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

      // Row 2: Priority, Due Date, Project Tag
      const rowMeta = document.createElement('div');
      rowMeta.className = 'task-row-meta';

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

      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      dateInput.className = 'input-due-date';
      dateInput.value = task.due || '';
      dateInput.addEventListener('change', () => {
        task.due = dateInput.value;
        persistCurrentSession();
      });
      rowMeta.appendChild(dateInput);

      const projTag = document.createElement('span');
      projTag.className = 'task-project-tag';
      projTag.textContent = task.project || 'General';
      rowMeta.appendChild(projTag);

      itemEl.appendChild(rowMeta);
      elements.containerTasksList.appendChild(itemEl);
    });
  }

  function setAllTasksSelection(selected) {
    state.tasks.forEach(t => { t.selected = selected; });
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
      id: 'custom-' + Date.now().toString(36),
      title: 'New action item',
      description: 'Manually added to action plan',
      priority: 'Medium',
      due: `${y}-${m}-${d}`,
      project: state.pageData?.opportunity?.categoryName || 'General',
      selected: true
    };

    state.tasks.unshift(newTask);
    renderTasksList();
    persistCurrentSession();

    setTimeout(() => {
      const firstInput = elements.containerTasksList.querySelector('.task-title-input');
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }
    }, 40);
  }

  function updateSubmitButton() {
    const selectedCount = state.tasks.filter(t => t.selected).length;
    elements.txtSubmitBtnLabel.textContent = `Send ${selectedCount} Action${selectedCount === 1 ? '' : 's'} for Approval`;
    elements.btnSendApproval.disabled = selectedCount === 0 || state.isSubmitting;
  }

  // --- HUMAN-IN-THE-LOOP APPROVAL WORKFLOW ---
  async function handleSendForApproval() {
    if (state.isSubmitting) return;

    const selectedTasks = state.tasks.filter(t => t.selected);
    if (!selectedTasks.length) {
      showAlert('Please select at least one task to submit.', 'warning');
      return;
    }

    state.isSubmitting = true;
    updateSubmitButton();
    elements.panelWorkflowStatus.classList.add('hidden');

    const proposalPayload = {
      title: state.pageData?.opportunity?.opportunityTitle || state.pageData?.title || 'Webpage Action Plan',
      url: state.pageData?.url || state.currentTab?.url || '',
      summary: state.planResult?.summary || '',
      tasks: selectedTasks,
      proposalId: state.planResult?.proposalId || null
    };

    try {
      const response = await window.SF_API.submitProposalForApproval(proposalPayload, state.settings);

      // Display workflow status tracker
      elements.panelWorkflowStatus.classList.remove('hidden');

      if (response.mode === 'demo') {
        elements.txtWorkflowDesc.textContent = 'Plan saved locally in Chrome storage (Demo Mode). Not submitted to database.';
      } else {
        elements.txtWorkflowDesc.textContent = response.message || 'Plan created in SaarthiFlow backend! Awaiting your approval.';
      }

      updateDemoProposalsCount();
      showAlert('Action plan successfully sent for approval!', 'success');

    } catch (err) {
      console.error('[SaarthiFlow] Submit error:', err);
      showAlert(`Submission failed: ${err.message}`, 'error');
    } finally {
      state.isSubmitting = false;
      updateSubmitButton();
    }
  }

  // --- QUICK TASK & SAVE FOR LATER ---
  function openQuickTaskModal() {
    elements.inputQtTitle.value = '';
    elements.selectQtPriority.value = 'Medium';

    const d = new Date();
    d.setDate(d.getDate() + 3);
    elements.inputQtDue.value = d.toISOString().split('T')[0];

    const oppCat = state.pageData?.opportunity?.categoryName || 'General';
    elements.selectQtProject.value = ['Hackathon', 'Internships', 'Open Source', 'College', 'Learning'].includes(oppCat) ? oppCat : 'General';

    elements.inputQtSource.value = state.currentTab?.url || 'Current page';
    elements.modalQuickTask.classList.remove('hidden');
    elements.inputQtTitle.focus();
  }

  function closeQuickTaskModal() {
    elements.modalQuickTask.classList.add('hidden');
  }

  async function handleSubmitQuickTask() {
    const title = elements.inputQtTitle.value.trim();
    if (!title) {
      showAlert('Task title is required.', 'warning');
      return;
    }

    const taskPayload = {
      title: title,
      priority: elements.selectQtPriority.value,
      due: elements.inputQtDue.value,
      project: elements.selectQtProject.value,
      status: 'todo',
      source: elements.inputQtSource.value
    };

    try {
      elements.btnSubmitQuickTask.disabled = true;
      const res = await window.SF_API.createQuickTask(taskPayload, state.settings);
      closeQuickTaskModal();
      showAlert(res.message || 'Task created successfully!', 'success');
    } catch (err) {
      showAlert(err.message, 'error');
    } finally {
      elements.btnSubmitQuickTask.disabled = false;
    }
  }

  async function handleSaveForLater() {
    if (!state.currentTab) return;
    const title = `Review: ${state.pageData?.opportunity?.opportunityTitle || state.currentTab.title || 'Page'}`;
    const d = new Date();
    d.setDate(d.getDate() + 3);

    const taskPayload = {
      title: title.slice(0, 80),
      priority: 'Medium',
      due: d.toISOString().split('T')[0],
      project: state.pageData?.opportunity?.categoryName || 'General',
      status: 'todo',
      source: state.currentTab.url
    };

    try {
      const res = await window.SF_API.createQuickTask(taskPayload, state.settings);
      showAlert(`Saved as task: "${taskPayload.title}"`, 'success');
    } catch (err) {
      showAlert(err.message, 'error');
    }
  }

  // --- RECENT CAPTURES DRAWER ---
  async function renderRecentCaptures() {
    elements.listRecentCaptures.innerHTML = '';
    const recents = await window.SF_API.getRecentCaptures();

    if (!recents.length) {
      const empty = document.createElement('div');
      empty.style.padding = '20px';
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--ink-muted)';
      empty.style.fontSize = '11px';
      empty.textContent = 'No recent captures yet. Analyze a page to save it here.';
      elements.listRecentCaptures.appendChild(empty);
      return;
    }

    recents.forEach(item => {
      const card = document.createElement('a');
      card.className = 'recent-item';
      card.href = item.url;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';

      const icon = document.createElement('span');
      icon.className = 'recent-icon';
      icon.textContent = item.categoryIcon || '🌐';

      const details = document.createElement('div');
      details.className = 'recent-details';

      const title = document.createElement('div');
      title.className = 'recent-title';
      title.textContent = item.title;

      const meta = document.createElement('div');
      meta.className = 'recent-meta';
      meta.textContent = `${item.category} · ${new Date(item.timestamp).toLocaleDateString()}`;

      details.appendChild(title);
      details.appendChild(meta);

      card.appendChild(icon);
      card.appendChild(details);
      elements.listRecentCaptures.appendChild(card);
    });
  }

  // --- SESSION PERSISTENCE ---
  async function persistCurrentSession() {
    if (!chrome?.storage?.local || !state.pageData) return;
    try {
      const payload = {};
      payload[window.SF_CONFIG.STORAGE_KEYS.LAST_ANALYSIS] = {
        pageData: state.pageData,
        planResult: state.planResult,
        tasks: state.tasks,
        timestamp: Date.now()
      };
      chrome.storage.local.set(payload);
    } catch (e) {
      console.debug('[SaarthiFlow] Persist session non-fatal:', e);
    }
  }

  async function restorePreviousSession() {
    if (!chrome?.storage?.local) return;
    try {
      const result = await new Promise(r => chrome.storage.local.get([window.SF_CONFIG.STORAGE_KEYS.LAST_ANALYSIS], r));
      const saved = result[window.SF_CONFIG.STORAGE_KEYS.LAST_ANALYSIS];

      if (saved && saved.pageData && state.currentTab && saved.pageData.url === state.currentTab.url) {
        state.pageData = saved.pageData;
        state.planResult = saved.planResult;
        state.tasks = saved.tasks || [];

        if (saved.planResult && !saved.planResult.isActionable) {
          renderNonActionableState();
        } else if (saved.planResult) {
          renderActionableResults();
        }
      }
    } catch (e) {
      console.debug('[SaarthiFlow] Session restore non-fatal:', e);
    }
  }

  // --- NAVIGATION ---
  function openDashboardRoute(route) {
    const base = state.settings.dashboardUrl || 'http://localhost:5173';
    const targetUrl = `${window.SF_CONFIG.normalizeUrl(base)}${route}`;
    chrome.tabs.create({ url: targetUrl });
  }

  // --- ALERTS ---
  function showAlert(msg, type = 'info') {
    elements.bannerAlert.className = `alert-banner ${type}`;
    elements.alertMessage.textContent = msg;
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
