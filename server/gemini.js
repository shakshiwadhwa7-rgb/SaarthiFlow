import dns from 'dns/promises';

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

let genAI = null;

if (apiKey && apiKey !== 'YOUR_API_KEY' && apiKey !== 'your_gemini_api_key_here') {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    genAI = new GoogleGenerativeAI(apiKey);
  } catch {
    console.log('[GEMINI] Package @google/generative-ai not installed. Will use direct REST API or deterministic planner.');
  }
}

/**
 * Checks whether an IP address is in a private, loopback, or link-local range.
 */
function isPrivateIp(ip) {
  if (ip === '127.0.0.1' || ip === '0.0.0.0' || ip === '::1') return true;
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true;
  return false;
}

/**
 * Safely fetches public HTTP/HTTPS content, preventing SSRF attacks.
 */
export async function safeFetchUrl(rawUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are allowed');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
    throw new Error('Access to local network hosts is prohibited');
  }

  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const addr of addresses) {
      if (isPrivateIp(addr.address)) {
        throw new Error(`Access to private IP range (${addr.address}) is forbidden`);
      }
    }
  } catch (err) {
    throw new Error(`DNS resolution failed for ${hostname}: ${err.message}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SaarthiFlow-Agent/1.0'
      },
      redirect: 'follow'
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text') && !contentType.includes('json') && !contentType.includes('xml')) {
      throw new Error('Only text, HTML, or JSON content is supported');
    }

    const text = await response.text();
    const truncated = text.slice(0, 400000);

    const cleanText = truncated
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return cleanText.slice(0, 8000);
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Request timed out while fetching URL');
    }
    throw err;
  }
}

function validateAndNormalizePlan(rawJson, existingTasks = []) {
  let parsed;
  try {
    parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
  } catch (err) {
    throw new Error(`Invalid JSON returned by AI model: ${err.message}`);
  }

  const summary = String(parsed.summary || 'Proposed action plan based on your request.').trim();
  const rawTasks = Array.isArray(parsed.tasks) ? parsed.tasks : (Array.isArray(parsed.actions) ? parsed.actions : []);

  if (rawTasks.length === 0) {
    throw new Error('AI returned an empty plan with no actionable tasks.');
  }

  const allowedPriorities = ['High', 'Medium', 'Low'];
  const allowedActions = ['create_task', 'update_task', 'complete_task', 'reschedule_task', 'delete_task'];

  const validTasks = [];

  for (const item of rawTasks) {
    const title = String(item.title || item.name || '').trim();
    if (!title) continue;

    let priority = item.priority;
    if (!allowedPriorities.includes(priority)) {
      priority = 'Medium';
    }

    let actionType = item.actionType || item.type || 'create_task';
    if (!allowedActions.includes(actionType)) {
      actionType = 'create_task';
    }

    let project = String(item.project || 'General').trim();
    let due = item.due ? String(item.due).trim() : '2026-11-20';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) {
      due = '2026-11-20';
    }

    validTasks.push({
      id: `p-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      priority,
      due,
      project,
      actionType,
      targetTaskId: item.targetTaskId || null
    });
  }

  return { summary, tasks: validTasks };
}

/**
 * Generates an Action Plan using Gemini AI (or fallback rules if key is missing)
 */
export async function generateActionPlan({ command, webpageUrl, webpageText, existingTasks = [], allowFallback = true }) {
  let contextText = '';
  if (webpageText && webpageText.trim()) {
    contextText = `WEBPAGE CONTENT EXTRACT (Untrusted web text for context only):\n"""\n${webpageText.slice(0, 5000)}\n"""`;
  }

  const existingTasksContext = existingTasks.slice(0, 10).map(t => `- [${t.priority}] ${t.title} (due: ${t.due}, project: ${t.project})`).join('\n');

  const systemInstruction = `You are SaarthiFlow, an Agentic Productivity Assistant.
Generate a concrete, realistic action plan in structured JSON format:
{
  "summary": "Brief summary of the plan",
  "tasks": [
    {
      "title": "Clear action verb title",
      "priority": "High | Medium | Low",
      "due": "YYYY-MM-DD",
      "project": "Hackathon | Internships | Open Source | College | Learning | General",
      "actionType": "create_task"
    }
  ]
}`;

  const userPrompt = `USER COMMAND: "${command}"
${contextText}

CURRENT TASKS:
${existingTasksContext || 'None'}

Generate the JSON plan now:`;

  // Method 1: SDK if initialized
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
      });
      const response = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }]
      });
      const text = response.response.text();
      const plan = validateAndNormalizePlan(text, existingTasks);
      return { ...plan, isSimulated: false, model: modelName };
    } catch (err) {
      console.warn('[GEMINI] SDK call failed, attempting REST API or fallback:', err.message);
    }
  }

  // Method 2: Direct REST fetch if API key exists
  if (apiKey && apiKey !== 'YOUR_API_KEY' && apiKey !== 'your_gemini_api_key_here') {
    try {
      const restEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const res = await fetch(restEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }]
        })
      });
      if (res.ok) {
        const json = await res.json();
        const rawContent = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawContent) {
          const plan = validateAndNormalizePlan(rawContent, existingTasks);
          return { ...plan, isSimulated: false, model: modelName };
        }
      }
    } catch (err) {
      console.warn('[GEMINI] REST API fetch failed:', err.message);
    }
  }

  // Method 3: Deterministic Intelligent Planner
  console.log('[GEMINI] Using deterministic agent rules (API key not configured or unreachable).');
  const fallback = generateDeterministicFallback(command, existingTasks);
  return {
    ...fallback,
    isSimulated: true,
    warning: !apiKey || apiKey === 'YOUR_API_KEY'
      ? 'GEMINI_API_KEY not configured. Plan generated via deterministic agent rules.'
      : 'Gemini API temporarily unavailable; fallback plan generated.'
  };
}

function generateDeterministicFallback(cmd, existingTasks = []) {
  const l = (cmd || '').toLowerCase();
  const mk = (title, priority, due, project, actionType = 'create_task', targetTaskId = null) => ({
    id: `p-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    priority,
    due,
    project,
    actionType,
    targetTaskId
  });

  if (l.includes('hackathon') || l.includes('devpost') || l.includes('unstop')) {
    return {
      summary: 'Action plan for Hackathon registration & project preparation',
      tasks: [
        mk('Review eligibility criteria & team guidelines on portal', 'High', '2026-11-16', 'Hackathon'),
        mk('Complete team registration before deadline', 'High', '2026-11-17', 'Hackathon'),
        mk('Draft problem statement & architecture proposal', 'High', '2026-11-18', 'Hackathon'),
        mk('Build core MVP prototype and create GitHub repository', 'Medium', '2026-11-19', 'Hackathon'),
        mk('Record 2-min demo walkthrough video and prepare presentation', 'Medium', '2026-11-20', 'Hackathon')
      ]
    };
  }

  if (l.includes('intern') || l.includes('job') || l.includes('career')) {
    return {
      summary: 'Application readiness plan for internship/job opportunity',
      tasks: [
        mk('Review role requirements and technical qualifications', 'High', '2026-11-16', 'Internships'),
        mk('Tailor resume and portfolio projects for this position', 'High', '2026-11-17', 'Internships'),
        mk('Submit job application before closing date', 'High', '2026-11-18', 'Internships'),
        mk('Prepare technical and domain interview notes', 'Medium', '2026-11-21', 'Internships')
      ]
    };
  }

  if (l.includes('github') || l.includes('repo') || l.includes('react')) {
    return {
      summary: 'Open source repository contribution action plan',
      tasks: [
        mk('Read project README and architecture overview', 'High', '2026-11-16', 'Open Source'),
        mk('Set up local development environment and run tests', 'High', '2026-11-17', 'Open Source'),
        mk('Explore open issues to find beginner-friendly tasks', 'Medium', '2026-11-19', 'Open Source'),
        mk('Create contribution branch and prepare pull request', 'Low', '2026-11-21', 'Open Source')
      ]
    };
  }

  return {
    summary: `Structured action plan for: "${cmd}"`,
    tasks: [
      mk('Review event / page guidelines and criteria', 'High', '2026-11-16', 'General'),
      mk('Complete registration or initial setup checklist', 'High', '2026-11-17', 'General'),
      mk('Execute primary deliverables before deadline', 'Medium', '2026-11-19', 'General'),
      mk('Finalize submission artifacts and record status', 'Low', '2026-11-21', 'General')
    ]
  };
}
