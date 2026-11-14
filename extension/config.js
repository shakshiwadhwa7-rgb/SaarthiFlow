/**
 * SaarthiFlow Chrome Extension - Configuration & Settings Module
 * Centralizes defaults, storage keys, endpoints, and storage utilities.
 */

(function (root) {
  'use strict';

  const SF_CONFIG = {
    // Operating Modes
    MODES: {
      DEMO: 'demo',
      LIVE: 'live'
    },

    // Default Configuration
    DEFAULTS: {
      mode: 'live', // Live Mode is primary; Demo Mode available for offline testing
      backendUrl: 'http://localhost:3001', // SaarthiFlow Express backend default port
      dashboardUrl: 'http://localhost:5173', // Vite client default port
      autoDetectPageType: true
    },

    // Chrome Storage Keys
    STORAGE_KEYS: {
      SETTINGS: 'sf_settings',
      LAST_PAGE: 'sf_last_page',
      LAST_ANALYSIS: 'sf_last_analysis',
      DEMO_PROPOSALS: 'sf_demo_proposals',
      RECENT_CAPTURES: 'sf_recent_captures',
      ACTIVE_JOB: 'sf_active_job'
    },

    // Backend API Endpoints Mapping
    ENDPOINTS: {
      health: '/api/health',
      agentPlan: '/api/agent/plan',     // Primary SaarthiFlow AI Planning & Proposal endpoint
      analyze: '/api/analyze',           // Structured webpage analysis endpoint
      proposals: '/api/proposals',       // Proposal submission endpoint
      approvals: '/api/approvals',       // Approvals query and decision endpoint
      tasks: '/api/tasks',               // Quick Task direct creation endpoint
      activity: '/api/activity'          // Activity log endpoint
    },

    // Extension Limits & Safeguards
    LIMITS: {
      MAX_EXTRACT_CHARS: 12000,
      MAX_SUMMARY_PREVIEW_CHARS: 240,
      REQUEST_TIMEOUT_MS: 15000,
      MAX_SAVED_PROPOSALS: 50,
      MAX_RECENT_CAPTURES: 15
    },

    // Utility: Validate URL format
    isValidHttpUrl(urlString) {
      if (!urlString || typeof urlString !== 'string') return false;
      try {
        const parsed = new URL(urlString.trim());
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    },

    // Utility: Normalize URL by stripping trailing slashes
    normalizeUrl(urlString) {
      if (!urlString || typeof urlString !== 'string') return '';
      const trimmed = urlString.trim();
      return trimmed.replace(/\/+$/, '');
    },

    // Retrieve user settings from chrome.storage.local with defaults
    async getSettings() {
      return new Promise((resolve) => {
        if (!chrome?.storage?.local) {
          resolve({ ...SF_CONFIG.DEFAULTS });
          return;
        }

        chrome.storage.local.get([SF_CONFIG.STORAGE_KEYS.SETTINGS], (result) => {
          if (chrome.runtime.lastError) {
            console.warn('[SaarthiFlow] Failed to load settings:', chrome.runtime.lastError);
            resolve({ ...SF_CONFIG.DEFAULTS });
            return;
          }

          const stored = result[SF_CONFIG.STORAGE_KEYS.SETTINGS] || {};
          const merged = {
            mode: stored.mode === SF_CONFIG.MODES.DEMO ? SF_CONFIG.MODES.DEMO : SF_CONFIG.MODES.LIVE,
            backendUrl: SF_CONFIG.normalizeUrl(stored.backendUrl || SF_CONFIG.DEFAULTS.backendUrl),
            dashboardUrl: SF_CONFIG.normalizeUrl(stored.dashboardUrl || SF_CONFIG.DEFAULTS.dashboardUrl),
            autoDetectPageType: stored.autoDetectPageType !== undefined ? Boolean(stored.autoDetectPageType) : true
          };
          resolve(merged);
        });
      });
    },

    // Save user settings into chrome.storage.local
    async saveSettings(newSettings) {
      return new Promise((resolve, reject) => {
        if (!chrome?.storage?.local) {
          reject(new Error('chrome.storage.local not available'));
          return;
        }

        this.getSettings().then((current) => {
          const updated = {
            ...current,
            ...newSettings,
            backendUrl: SF_CONFIG.normalizeUrl(newSettings.backendUrl || current.backendUrl),
            dashboardUrl: SF_CONFIG.normalizeUrl(newSettings.dashboardUrl || current.dashboardUrl)
          };

          const payload = {};
          payload[SF_CONFIG.STORAGE_KEYS.SETTINGS] = updated;

          chrome.storage.local.set(payload, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(updated);
            }
          });
        });
      });
    }
  };

  // Expose to global/worker scope
  root.SF_CONFIG = SF_CONFIG;
})(typeof globalThis !== 'undefined' ? globalThis : this);
