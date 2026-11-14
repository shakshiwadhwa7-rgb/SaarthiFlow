/**
 * SaarthiFlow Chrome Extension - Content Extractor & Opportunity Classifier
 * Extracts semantic webpage content, classifies opportunities (Hackathons, Jobs, Repos, Workshops),
 * extracts structured requirements and deadlines, and discards noise and private data.
 */

(function () {
  'use strict';

  const EXTRACTOR_VERSION = '2.0.0';

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
   * Finds explicit deadlines and dates
   */
  function extractDatesAndDeadlines(rawText) {
    const dates = [];
    const seen = new Set();

    if (!rawText || typeof rawText !== 'string') return dates;

    // Pattern 1: Explicit deadline keywords with following text
    const keywordRegex = /\b(deadline|due date|last date|submission deadline|register by|apply by|ends on|start date|starts on|event date|timeline)[:\s]+([^\n\r.,;]{4,60})/gi;
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

    // Pattern 3: ISO and numeric dates
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
    const actionKeywords = /register|apply|submit|guideline|rule|rubric|schedule|faq|github|repo|documentation|syllabus|handbook|form/i;

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
   * INTELLIGENT OPPORTUNITY CLASSIFICATION & STRUCTURED EXTRACTION
   * Classifies page type and extracts opportunity title, organizer, eligibility, requirements.
   */
  function classifyAndExtractOpportunity(url, title, rawText, headings, dates, links) {
    const lowerText = (rawText || '').toLowerCase();
    const lowerTitle = (title || '').toLowerCase();
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    let pageType = 'general';
    let isActionable = false;
    let categoryName = 'General Informational';
    let categoryIcon = '🌐';
    let opportunityTitle = title.split(/[-–|—]/)[0].trim() || 'Current Webpage';
    let organizer = 'Not specified';
    let eligibility = 'Not specified';
    const requirements = [];
    const requiredDocuments = [];
    const recommendedNextSteps = [];

    // --- CASE 1: SPECIFIC GITHUB REPOSITORY ---
    // Matches github.com/owner/repo but NOT github.com/ or github.com/explore
    const ghRepoMatch = hostname.includes('github.com') && pathname.match(/^\/([^/]+)\/([^/]+)(\/.*)?$/);
    const isSpecificGithubRepo = Boolean(ghRepoMatch && !['explore', 'topics', 'trending', 'pricing', 'features', 'login', 'signup'].includes(ghRepoMatch[1]));

    if (isSpecificGithubRepo) {
      pageType = 'github_repo';
      isActionable = true;
      categoryName = 'GitHub Repository';
      categoryIcon = '💻';
      opportunityTitle = `${ghRepoMatch[1]}/${ghRepoMatch[2]}`;
      organizer = ghRepoMatch[1];
      eligibility = 'Open source contributors & developers';
      requirements.push('Review repository README and architecture');
      requirements.push('Check installation & development setup guide');
      requirements.push('Browse open issues or good-first-issues for contribution');
      recommendedNextSteps.push('Clone or star the repository');
      recommendedNextSteps.push('Set up local development environment');
      recommendedNextSteps.push('Pick an issue or prepare bug report/feature');
    }
    // --- CASE 2: HACKATHON OR COMPETITION ---
    else if (
      /hackathon|devpost|unstop|hackerearth|devfolio|mlh\.io/i.test(hostname) ||
      /\bhackathon\b|\bhack\b|\bideathon\b|\bdatathon\b|\bcode challenge\b|\bcompetition\b/i.test(lowerTitle) ||
      (/\b(hackathon|problem statement|prize pool|tracks|submissions due)\b/i.test(lowerText) && /\b(register|submission|deadline)\b/i.test(lowerText))
    ) {
      pageType = 'hackathon';
      isActionable = true;
      categoryName = 'Hackathon';
      categoryIcon = '🏆';
      organizer = hostname.replace(/^www\./, '').split('.')[0];
      organizer = organizer.charAt(0).toUpperCase() + organizer.slice(1);

      // Extract eligibility snippets
      if (/all college students|university students|open to all|students enrolled/i.test(lowerText)) {
        eligibility = 'College & University Students';
      } else if (/students|professionals|developers/i.test(lowerText)) {
        eligibility = 'Students and Independent Developers';
      } else {
        eligibility = 'Review eligibility guidelines on portal';
      }

      // Hackathon requirements
      if (/prototype|working prototype|mvp/i.test(lowerText)) requirements.push('Working prototype or MVP');
      if (/github|repository|source code/i.test(lowerText)) requirements.push('Public GitHub repository with source code');
      if (/video|demo video|walkthrough/i.test(lowerText)) requirements.push('2-3 minute demo video walkthrough');
      if (/presentation|pitch deck|slides/i.test(lowerText)) requirements.push('Project presentation / pitch deck');
      if (requirements.length === 0) {
        requirements.push('Working prototype & presentation');
        requirements.push('Submission before the deadline');
      }

      requiredDocuments.push('Team Member Details');
      requiredDocuments.push('Project Links (GitHub & Demo Video)');

      recommendedNextSteps.push('Complete team registration on the portal');
      recommendedNextSteps.push('Review problem statements & scoring rubric');
      recommendedNextSteps.push('Build MVP and prepare submission artifacts');
    }
    // --- CASE 3: INTERNSHIP OR STUDENT ROLE ---
    else if (
      /\bintern\b|\binternship\b|\bsummer analyst\b|\bco-op\b/i.test(lowerTitle + ' ' + pathname) ||
      (/\binternship\b/i.test(lowerText) && /\b(apply|stipend|duration|qualifications|eligibility)\b/i.test(lowerText))
    ) {
      pageType = 'internship';
      isActionable = true;
      categoryName = 'Internship Opportunity';
      categoryIcon = '💼';

      organizer = hostname.replace(/^www\./, '').split('.')[0];
      organizer = organizer.charAt(0).toUpperCase() + organizer.slice(1);

      if (/pre-final|final year|graduating|b\.tech|b\.e|bachelor/i.test(lowerText)) {
        eligibility = 'Enrolled students or recent graduates';
      } else {
        eligibility = 'Check role qualifications on job page';
      }

      requirements.push('Updated Resume / CV tailored for this role');
      requirements.push('Portfolio or relevant project links');
      requiredDocuments.push('Resume (PDF)');
      requiredDocuments.push('Portfolio / GitHub / LinkedIn profile');

      recommendedNextSteps.push('Tailor resume highlighting relevant tech stack');
      recommendedNextSteps.push('Submit application before deadline');
      recommendedNextSteps.push('Prepare for technical and domain interview questions');
    }
    // --- CASE 4: JOB LISTING / CAREERS ---
    else if (
      /\bjob\b|\bcareer\b|\brole\b|\bhiring\b|\bposition\b|\bengineer\b/i.test(lowerTitle) &&
      (/\b(apply now|responsibilities|qualifications|requirements|full-time)\b/i.test(lowerText))
    ) {
      pageType = 'job';
      isActionable = true;
      categoryName = 'Job Opportunity';
      categoryIcon = '💼';

      organizer = hostname.replace(/^www\./, '').split('.')[0];
      organizer = organizer.charAt(0).toUpperCase() + organizer.slice(1);
      eligibility = 'Meets role requirements & work authorization';

      requirements.push('Technical qualifications & relevant experience');
      requirements.push('Verified resume and application responses');
      requiredDocuments.push('Resume / Curriculum Vitae');
      requiredDocuments.push('Cover Letter / Portfolio (Optional)');

      recommendedNextSteps.push('Review responsibilities and submit application');
      recommendedNextSteps.push('Track application status in your dashboard');
    }
    // --- CASE 5: WORKSHOP OR WEBINAR ---
    else if (
      /\bworkshop\b|\bwebinar\b|\bmasterclass\b|\bbootcamp\b/i.test(lowerTitle + ' ' + lowerText) &&
      /\b(register|rsvp|agenda|session|speaker)\b/i.test(lowerText)
    ) {
      pageType = 'workshop';
      isActionable = true;
      categoryName = 'Workshop / Webinar';
      categoryIcon = '🎓';
      organizer = hostname.replace(/^www\./, '').split('.')[0];
      eligibility = 'Open registration';

      requirements.push('Register for the session on the event page');
      requirements.push('Review required tools and prerequisites');
      recommendedNextSteps.push('Confirm registration and reserve your seat');
      recommendedNextSteps.push('Add date to calendar and prepare questions');
    }
    // --- CASE 6: EVENT / CONFERENCE ---
    else if (
      /\bconference\b|\bsummit\b|\bmeetup\b/i.test(lowerTitle) &&
      /\b(tickets|rsvp|speakers|schedule)\b/i.test(lowerText)
    ) {
      pageType = 'event';
      isActionable = true;
      categoryName = 'Event / Conference';
      categoryIcon = '📅';
      organizer = hostname.replace(/^www\./, '').split('.')[0];
      eligibility = 'Open to attendees';

      requirements.push('Register or purchase attendee pass');
      recommendedNextSteps.push('RSVP and add event to schedule');
    }
    // --- CASE 7: SCHOLARSHIP OR GRANT ---
    else if (
      /\bscholarship\b|\bgrant\b|\bfellowship\b/i.test(lowerTitle + ' ' + lowerText) &&
      /\b(apply|eligibility|deadline|award|funding)\b/i.test(lowerText)
    ) {
      pageType = 'scholarship';
      isActionable = true;
      categoryName = 'Scholarship / Grant';
      categoryIcon = '🏅';
      eligibility = 'Criteria listed on application portal';

      requirements.push('Academic transcripts or statement of purpose');
      requirements.push('Application form submission');
      requiredDocuments.push('Transcripts, Statement of Purpose');

      recommendedNextSteps.push('Verify eligibility criteria');
      recommendedNextSteps.push('Draft essay/SOP and gather recommendation letters');
    }
    // --- CASE 8: ACADEMIC ASSIGNMENT OR COURSEWORK ---
    else if (
      /\bassignment\b|\bhomework\b|\bproblem set\b|\blab\b/i.test(lowerTitle + ' ' + lowerText) &&
      /\b(due|submit|rubric|points|grade)\b/i.test(lowerText)
    ) {
      pageType = 'assignment';
      isActionable = true;
      categoryName = 'Academic Assignment';
      categoryIcon = '📑';
      eligibility = 'Enrolled students';

      requirements.push('Complete required deliverables according to rubric');
      requirements.push('Submit through LMS portal before deadline');
      recommendedNextSteps.push('Read assignment instructions carefully');
      recommendedNextSteps.push('Implement solution and test edge cases');
    }
    // --- CASE 9: PROJECT DOCUMENTATION ---
    else if (
      /\bdocumentation\b|\bdocs\b|\bapi reference\b|\bdeveloper guide\b/i.test(lowerTitle + ' ' + pathname)
    ) {
      pageType = 'documentation';
      isActionable = true;
      categoryName = 'Technical Documentation';
      categoryIcon = '📖';
      eligibility = 'Developers';

      requirements.push('Follow prerequisite steps and API guides');
      recommendedNextSteps.push('Review architecture patterns & code examples');
      recommendedNextSteps.push('Build a prototype implementation');
    }
    // --- CASE 10: GENERAL / NON-ACTIONABLE WEBPAGE ---
    else {
      pageType = 'general';
      isActionable = false;
      categoryName = 'General Informational';
      categoryIcon = '🌐';
      organizer = hostname.replace(/^www\./, '');
      eligibility = 'Not applicable';
    }

    // Determine primary deadline date
    let primaryDeadline = 'Not specified';
    for (const d of dates) {
      if (d.type === 'deadline' || d.label.toLowerCase().includes('deadline') || d.label.toLowerCase().includes('due') || d.label.toLowerCase().includes('apply by')) {
        primaryDeadline = `${d.label}: ${d.text}`;
        break;
      }
    }
    if (primaryDeadline === 'Not specified' && dates.length > 0) {
      primaryDeadline = `${dates[0].label}: ${dates[0].text}`;
    }

    return {
      pageType,
      isActionable,
      categoryName,
      categoryIcon,
      opportunityTitle,
      organizer,
      primaryDeadline,
      eligibility,
      requirements: requirements.length > 0 ? requirements : ['Not specified'],
      requiredDocuments: requiredDocuments.length > 0 ? requiredDocuments : ['Not specified'],
      recommendedNextSteps: recommendedNextSteps.length > 0 ? recommendedNextSteps : ['Review page content and save as a custom task if desired']
    };
  }

  /**
   * Main extractor function
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

    // 2. Extract Headings and Action Links
    const headings = extractHeadings(targetElement);
    const links = extractActionLinks(targetElement);

    // 3. Clone node to safely sanitize without altering live DOM
    const clone = targetElement.cloneNode(true);

    // 4. Remove boilerplate, dangerous, or unneeded elements
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

    // 5. Extract clean text
    let rawText = '';
    try {
      rawText = clone.innerText || clone.textContent || '';
    } catch {
      rawText = clone.textContent || '';
    }

    const cleanedText = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[ \u00a0]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    // 6. Dates and Deadlines
    const dates = extractDatesAndDeadlines(cleanedText);

    // 7. Opportunity Classification
    const opportunity = classifyAndExtractOpportunity(
      window.location.href,
      document.title || 'Untitled Webpage',
      cleanedText,
      headings,
      dates,
      links
    );

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
      opportunity: opportunity, // Structured actionable classification
      extractedAt: new Date().toISOString(),
      durationMs: Math.round(performance.now() - startTime)
    };
  }

  // Runtime listener
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
      return true;
    });
  }

  // Support direct execution return for chrome.scripting.executeScript
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
