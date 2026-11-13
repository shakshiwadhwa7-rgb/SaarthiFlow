/**
 * SaarthiFlow Chrome Extension - Background Service Worker (Manifest V3)
 * Manages extension lifecycle, badge indicators, and background job coordination.
 */

// Import config and API into service worker scope
try {
  importScripts('config.js', 'api.js');
} catch (e) {
  console.warn('[SaarthiFlow Background] importScripts failed, fallback in-line mode:', e);
}

const BADGE_COLORS = {
  DEMO: '#8b5cf6',
  LIVE: '#10b981',
  PENDING: '#f59e0b',
  ERROR: '#ef4444'
};

/**
 * Update extension action badge based on current mode
 */
async function refreshBadge() {
  try {
    if (!chrome?.action?.setBadgeText) return;

    const settings = await (globalThis.SF_CONFIG ? globalThis.SF_CONFIG.getSettings() : Promise.resolve({ mode: 'demo' }));
    if (settings.mode === 'demo') {
      await chrome.action.setBadgeText({ text: 'DEMO' });
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS.DEMO });
    } else {
      await chrome.action.setBadgeText({ text: 'LIVE' });
      await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLORS.LIVE });
    }
  } catch (err) {
    console.debug('[SaarthiFlow] Badge update non-fatal:', err);
  }
}

// Lifecycle: Extension installed or updated
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[SaarthiFlow] Extension installed/updated:', details.reason);
  try {
    // Ensure default settings exist
    if (globalThis.SF_CONFIG) {
      const current = await globalThis.SF_CONFIG.getSettings();
      console.log('[SaarthiFlow] Current settings on boot:', current);
    }
    await refreshBadge();
  } catch (e) {
    console.warn('[SaarthiFlow] onInstalled handler warning:', e);
  }
});

// Lifecycle: Browser startup
chrome.runtime.onStartup.addListener(() => {
  refreshBadge();
});

// Runtime message listener for background tasks
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request || !request.action) return false;

  switch (request.action) {
    case 'SF_PING':
      sendResponse({ status: 'pong', timestamp: Date.now() });
      break;

    case 'SF_UPDATE_BADGE':
      if (request.text !== undefined) {
        chrome.action.setBadgeText({ text: request.text });
        if (request.color) {
          chrome.action.setBadgeBackgroundColor({ color: request.color });
        }
      } else {
        refreshBadge();
      }
      sendResponse({ success: true });
      break;

    case 'SF_REFRESH_SETTINGS':
      refreshBadge().then(() => sendResponse({ success: true }));
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
      break;
  }

  return false;
});
