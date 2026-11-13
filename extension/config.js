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
      mode: 'demo',
      backendUrl: 'http://localhost:3000',
      dashboardUrl: 'http://localhost:5173',
      autoAnalyze: false
    },

    // Chrome Storage Keys
    STORAGE_KEYS: {
      SETTINGS: 'sf_settings',
      LAST_PAGE: 'sf_last_page',
      LAST_ANALYSIS: 'sf_last_analysis',
      DEMO_PROPOSALS: 'sf_demo_proposals',
      ACTIVE_JOB: 'sf_active_job'
    },

    // Backend API Endpoints Mapping
    ENDPOINTS: {
      health: '/api/health',
      analyze: '/api/analyze',
      proposals: '/api/proposals',
      jobStatus: '/api/jobs' // /api/jobs/:id
    },

    // Extension Limits & Safeguards
    LIMITS: {
      MAX_EXTRACT_CHARS: 12000,
      MAX_SUMMARY_PREVIEW_CHARS: 280,
      REQUEST_TIMEOUT_MS: 15000,
      MAX_SAVED_PROPOSALS: 50
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
            mode: stored.mode === SF_CONFIG.MODES.LIVE ? SF_CONFIG.MODES.LIVE : SF_CONFIG.MODES.DEMO,
            backendUrl: SF_CONFIG.normalizeUrl(stored.backendUrl || SF_CONFIG.DEFAULTS.backendUrl),
            dashboardUrl: SF_CONFIG.normalizeUrl(stored.dashboardUrl || SF_CONFIG.DEFAULTS.dashboardUrl),
            autoAnalyze: Boolean(stored.autoAnalyze)
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
