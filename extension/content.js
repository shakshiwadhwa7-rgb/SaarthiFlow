/**
 * SaarthiFlow Chrome Extension - Content Extractor
 * Extracts semantic webpage content, headings, deadlines, and action links safely.
 * Strips ads, nav, footer, scripts, and protects private inputs.
 */

(function () {
  'use strict';

  // Prevent multiple executions in the same execution context
  const EXTRACTOR_VERSION = '1.0.0';

  /**
   * Safely discovers the best favicon URL for the current document
   */
  function extractFavicon() {
    try {
      const selectors = [
        'link[rel*="icon"]',
        'link[rel="apple-touch-icon"]',
        'link[rel="shortcut icon"]'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.href) {
          return el.href;
        }
      }
      return `${window.location.origin}/favicon.ico`;
    } catch {
      return '';
    }
  }

  /**
   * Extracts meta description or OpenGraph description
   */
  function extractMetaDescription() {
    try {
      const meta = document.querySelector('meta[name="description"]') ||
                   document.querySelector('meta[property="og:description"]') ||
                   document.querySelector('meta[name="twitter:description"]');
      return meta ? (meta.getAttribute('content') || '').trim() : '';
    } catch {
      return '';
    }
  }

  /**
   * Extracts clean headings (H1, H2, H3)
   */
  function extractHeadings(root) {
    const headings = [];
    const seen = new Set();

    try {
      const headingElements = root.querySelectorAll('h1, h2, h3');
      for (const el of headingElements) {
        // Skip hidden headings
        if (el.offsetParent === null && !el.getClientRects().length) continue;

        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (text.length >= 3 && text.length <= 140 && !seen.has(text.toLowerCase())) {
          seen.add(text.toLowerCase());
          headings.push({
            level: el.tagName.toLowerCase(),
            text
          });
          if (headings.length >= 15) break;
        }
      }
    } catch (e) {
      console.warn('[SaarthiFlow] Heading extraction error:', e);
    }

    return headings;
  }

  /**
   * Deterministically finds date and deadline mentions
   */
  function extractDatesAndDeadlines(rawText) {
    const dates = [];
    const seen = new Set();

    if (!rawText || typeof rawText !== 'string') return dates;

    // Pattern 1: Explicit deadline keywords with following text
    const keywordRegex = /\b(deadline|due date|last date|submission|register by|apply by|ends on|start date|starts on|timeline|milestone)[:\s]+([^\n\r.,;]{4,50})/gi;
    let match;
    while ((match = keywordRegex.exec(rawText)) !== null) {
      const label = match[1].trim();
      const val = match[2].trim();
      const combo = `${label}: ${val}`;
      if (!seen.has(combo.toLowerCase()) && val.length >= 3) {
        seen.add(combo.toLowerCase());
        dates.push({
          type: 'deadline',
          label: label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(),
          text: val,
          context: match[0].trim()
        });
        if (dates.length >= 8) break;
      }
    }

    // Pattern 2: Named month dates (e.g., Nov 18, 2026 or 18 November 2026)
    const monthRegex = /\b(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:,?\s+\d{4})?)\b/gi;
    while ((match = monthRegex.exec(rawText)) !== null) {
      const str = match[0].trim();
      if (!seen.has(str.toLowerCase())) {
        seen.add(str.toLowerCase());
        dates.push({
          type: 'date',
          label: 'Date',
          text: str,
          context: str
        });
        if (dates.length >= 10) break;
      }
    }

    // Pattern 3: ISO and standard numeric dates (YYYY-MM-DD or DD/MM/YYYY)
    const numDateRegex = /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/g;
    while ((match = numDateRegex.exec(rawText)) !== null) {
      const str = match[0].trim();
      if (!seen.has(str.toLowerCase())) {
        seen.add(str.toLowerCase());
        dates.push({
          type: 'date',
          label: 'Date',
          text: str,
          context: str
        });
        if (dates.length >= 12) break;
      }
    }

    return dates;
  }

  /**
   * Discovers high-value action links (Registration, Guidelines, Repo, Form)
   */
  function extractActionLinks(root) {
    const links = [];
    const seen = new Set();
    const actionKeywords = /register|apply|submit|guideline|rule|schedule|faq|github|repo|documentation|handbook|syllabus|form/i;

    try {
      const anchors = root.querySelectorAll('a[href]');
      for (const a of anchors) {
        const href = a.href;
        const text = (a.textContent || '').replace(/\s+/g, ' ').trim();

        if (!href || href.startsWith('javascript:') || href.startsWith('#') || href.startsWith('mailto:')) {
          continue;
        }

        if (text && actionKeywords.test(text) && !seen.has(href)) {
          seen.add(href);
          links.push({
            title: text.length > 50 ? text.slice(0, 47) + '…' : text,
            url: href
          });
          if (links.length >= 6) break;
        }
      }
    } catch (e) {
      console.warn('[SaarthiFlow] Links extraction error:', e);
    }

    return links;
  }

  /**
   * Main extractor function.
   * Clones target semantic node, cleans boilerplate, and extracts readable text.
   */
  function extractPageContent(maxChars = 12000) {
    const startTime = performance.now();

    // 1. Locate primary semantic content container
    const candidates = [
      'main',
      'article',
      '[role="main"]',
      '#content',
      '#main-content',
      '.main-content',
      '.content-area',
      '.post-content',
      '.article-content',
      'body'
    ];

    let targetElement = null;
    for (const selector of candidates) {
      const found = document.querySelector(selector);
      if (found && (found.textContent || '').trim().length > 150) {
        targetElement = found;
        break;
      }
    }

    if (!targetElement) {
      targetElement = document.body || document.documentElement;
    }

    // 2. Headings and action links before stripping
    const headings = extractHeadings(targetElement);
    const links = extractActionLinks(targetElement);

    // 3. Clone node to safely sanitize without altering live page DOM
    const clone = targetElement.cloneNode(true);

    // 4. Remove unwanted, boilerplate, or dangerous elements
    const unwantedSelectors = [
      'script',
      'style',
      'noscript',
      'svg',
      'canvas',
      'iframe',
      'audio',
      'video',
      'nav',
      'header',
      'footer',
      'aside',
      'dialog',
      'form',
      'input',
      'textarea',
      'select',
      'button',
      '[aria-hidden="true"]',
      '[role="navigation"]',
      '[role="banner"]',
      '[role="contentinfo"]',
      '.nav',
      '.navbar',
      '.footer',
      '.header',
      '.sidebar',
      '.ads',
      '.advertisement',
      '.ad-banner',
      '.cookie-banner',
      '.modal',
      '.popup'
    ];

    try {
      const badNodes = clone.querySelectorAll(unwantedSelectors.join(','));
      badNodes.forEach(node => node.remove());
    } catch (e) {
      console.warn('[SaarthiFlow] Sanitization error:', e);
    }

    // 5. Extract clean text with newline separation for block elements
    let rawText = '';
    try {
      // Use innerText on supported elements to respect CSS visibility
      rawText = clone.innerText || clone.textContent || '';
    } catch {
      rawText = clone.textContent || '';
    }

    // 6. Clean and normalize whitespace
    const cleanedText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[ \u00a0]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    // 7. Extract dates & deadlines from clean text
    const dates = extractDatesAndDeadlines(cleanedText);

    // 8. Truncate text cleanly if exceeding limits
    const truncatedText = cleanedText.length > maxChars
      ? cleanedText.slice(0, maxChars) + '…\n[Content truncated for analysis]'
      : cleanedText;

    const metaDescription = extractMetaDescription();
    const favicon = extractFavicon();

    return {
      success: true,
      version: EXTRACTOR_VERSION,
      url: window.location.href,
      domain: window.location.hostname || '',
      title: document.title || 'Untitled Webpage',
      favicon: favicon,
      metaDescription: metaDescription,
      extractedText: truncatedText,
      totalLength: cleanedText.length,
      isTruncated: cleanedText.length > maxChars,
      headings: headings,
      dates: dates,
      links: links,
      extractedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - startTime)
    };
  }

  // Listen for message from popup or background script
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && request.action === 'SF_EXTRACT_CONTENT') {
        try {
          const maxChars = request.maxChars || 12000;
          const result = extractPageContent(maxChars);
          sendResponse({ success: true, data: result });
        } catch (err) {
          sendResponse({ success: false, error: err.message || 'Extraction failed' });
        }
      }
      return true; // Keep message channel open for async response
    });
  }

  // Also support direct execution return for chrome.scripting.executeScript
  try {
    return extractPageContent();
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Direct extraction failed',
      url: window.location.href,
      title: document.title
    };
  }
})();
