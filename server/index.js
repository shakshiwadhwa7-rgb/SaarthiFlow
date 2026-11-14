/**
 * SaarthiFlow Standalone API Server
 * Zero-dependency native HTTP server compatible with Chrome Extensions and SaarthiFlow Web App.
 * Runs on Node.js v18+ without requiring external npm packages.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';
import * as gemini from './gemini.js';

// Auto-load .env file if it exists
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.slice(0, idx).trim();
        const v = trimmed.slice(idx + 1).trim();
        if (!process.env[k]) {
          process.env[k] = v.replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch (e) {
    console.debug('[ENV] Load warning:', e.message);
  }
}

const PORT = parseInt(process.env.PORT || '3001', 10);

/**
 * Safely parse JSON request body
 */
async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data.trim()) return resolve({});
      try {
    // ----------------------------------------------------
    // DOWNLOAD EXTENSION ZIP
    // ----------------------------------------------------
    if ((pathname === '/saarthiflow-extension.zip' || pathname === '/api/download-extension') && method === 'GET') {
      const zipPath = path.join(__dirname, '..', 'public', 'saarthiflow-extension.zip');
      if (fs.existsSync(zipPath)) {
        const stat = fs.statSync(zipPath);
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Length': stat.size,
          'Content-Disposition': 'attachment; filename="saarthiflow-extension.zip"',
          'Access-Control-Allow-Origin': origin || '*'
        });
        const readStream = fs.createReadStream(zipPath);
        return readStream.pipe(res);
      }
    }
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('Invalid JSON: ' + err.message));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response with universal CORS headers
 */
function sendJson(res, statusCode, data, origin = '*') {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Length': Buffer.byteLength(json)
  });
  res.end(json);
}

/**
 * Handle CORS preflight requests
 */
function handleCorsPreflight(res, origin = '*') {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Content-Length': '0'
  });
  res.end();
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '*';

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflight(res, origin);
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  try {
    // ----------------------------------------------------
    // DOWNLOAD EXTENSION ZIP
    // ----------------------------------------------------
    if ((pathname === '/saarthiflow-extension.zip' || pathname === '/api/download-extension') && method === 'GET') {
      const zipPath = path.join(__dirname, '..', 'public', 'saarthiflow-extension.zip');
      if (fs.existsSync(zipPath)) {
        const stat = fs.statSync(zipPath);
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Length': stat.size,
          'Content-Disposition': 'attachment; filename="saarthiflow-extension.zip"',
          'Access-Control-Allow-Origin': origin || '*'
        });
        const readStream = fs.createReadStream(zipPath);
        return readStream.pipe(res);
      }
    }
    // ----------------------------------------------------
    // 1. HEALTH CHECK
    // ----------------------------------------------------
    if (pathname === '/api/health' && method === 'GET') {
      return sendJson(res, 200, {
        status: 'ok',
        app: 'SaarthiFlow API',
        version: '1.0.0',
        database: db.isSupabaseConfigured ? 'supabase-postgresql' : 'local-persistent-store',
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_API_KEY'),
        port: PORT,
        timestamp: new Date().toISOString()
      }, origin);
    }

    // ----------------------------------------------------
    // 2. TASKS ENDPOINTS
    // ----------------------------------------------------
    if (pathname === '/api/tasks') {
      if (method === 'GET') {
        const filter = {
          status: urlObj.searchParams.get('status') || undefined,
          priority: urlObj.searchParams.get('priority') || undefined,
          project: urlObj.searchParams.get('project') || undefined
        };
        const tasks = await db.getTasks(filter);
        return sendJson(res, 200, tasks, origin);
      }

      if (method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.title || !body.title.trim()) {
          return sendJson(res, 400, { error: 'Task title is required' }, origin);
        }
        const created = await db.createTask(body);
        await db.logActivity({
          type: 'Task',
          title: `Task created: ${created.title}`,
          detail: `${created.project} · due ${created.due || 'Not specified'}`,
          source: body.source || 'My Space',
          status: 'Completed'
        });
        return sendJson(res, 201, created, origin);
      }
    }

    // Single task by ID: /api/tasks/:id
    const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch) {
      const taskId = taskMatch[1];
      if (method === 'PATCH') {
        const patch = await parseJsonBody(req);
        const updated = await db.updateTask(taskId, patch);
        return sendJson(res, 200, updated, origin);
      }
      if (method === 'DELETE') {
        const deleted = await db.deleteTask(taskId);
        return sendJson(res, 200, { message: 'Task deleted', task: deleted }, origin);
      }
    }

    // ----------------------------------------------------
    // 3. PROJECTS ENDPOINTS
    // ----------------------------------------------------
    if (pathname === '/api/projects') {
      if (method === 'GET') {
        const projects = await db.getProjects();
        return sendJson(res, 200, projects, origin);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const created = await db.createProject(body.name);
        return sendJson(res, 201, created, origin);
      }
    }

    // ----------------------------------------------------
    // 4. AGENT PLANNING & RUNS
    // ----------------------------------------------------
    if (pathname === '/api/agent/plan' && method === 'POST') {
      const body = await parseJsonBody(req);
      const command = body.command || 'Analyze webpage';
      const existingTasks = await db.getTasks();

      const planResult = await gemini.generateActionPlan({
        command,
        webpageUrl: body.webpageUrl,
        webpageText: body.webpageText,
        existingTasks
      });

      const run = await db.createAgentRun({
        command,
        status: 'planned',
        raw_input: `${command}${body.webpageUrl ? ` (URL: ${body.webpageUrl})` : ''}`,
        output_summary: planResult.summary
      });

      const proposal = await db.createProposal({
        title: body.opportunity?.opportunityTitle || command,
        source: 'Chrome Extension',
        tasks: planResult.tasks
      });

      await db.logActivity({
        type: 'Plan',
        title: `AI Plan drafted: ${proposal.title}`,
        detail: `${planResult.tasks.length} proposed actions awaiting approval`,
        source: 'Chrome Extension',
        status: 'Pending'
      });

      return sendJson(res, 200, {
        success: true,
        proposalId: proposal.id,
        runId: run.id,
        summary: planResult.summary,
        tasks: planResult.tasks,
        isSimulated: planResult.isSimulated,
        warning: planResult.warning || null
      }, origin);
    }

    if (pathname === '/api/agent/runs' && method === 'GET') {
      const runs = await db.getAgentRuns();
      return sendJson(res, 200, runs, origin);
    }

    // Structured Webpage Analysis (alias)
    if (pathname === '/api/analyze' && method === 'POST') {
      const body = await parseJsonBody(req);
      const command = `Analyze opportunity: ${body.opportunity?.opportunityTitle || body.title || 'Webpage'}`;
      const existingTasks = await db.getTasks();

      const planResult = await gemini.generateActionPlan({
        command,
        webpageUrl: body.url,
        webpageText: body.extractedText,
        existingTasks
      });

      return sendJson(res, 200, {
        success: true,
        summary: planResult.summary,
        category: body.opportunity?.categoryName || 'General',
        deadlines: body.opportunity?.primaryDeadline ? [body.opportunity.primaryDeadline] : [],
        requirements: body.opportunity?.requirements || [],
        tasks: planResult.tasks,
        isSimulated: planResult.isSimulated
      }, origin);
    }

    // ----------------------------------------------------
    // 5. PROPOSALS & APPROVALS
    // ----------------------------------------------------
    if (pathname === '/api/proposals' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.title || !body.title.trim()) {
        return sendJson(res, 400, { error: 'Proposal title is required' }, origin);
      }

      const proposal = await db.createProposal({
        title: body.title,
        url: body.url || '',
        source: body.source || 'Chrome Extension',
        summary: body.summary || '',
        tasks: body.tasks || []
      });

      await db.logActivity({
        type: 'Plan',
        title: `Plan sent for approval: ${proposal.title}`,
        detail: `${proposal.tasks?.length || 0} proposed actions awaiting human review`,
        source: body.source || 'Chrome Extension',
        status: 'Pending'
      });

      return sendJson(res, 201, {
        success: true,
        proposalId: proposal.id,
        id: proposal.id,
        message: 'Plan sent for approval in SaarthiFlow'
      }, origin);
    }

    if (pathname === '/api/approvals' && method === 'GET') {
      const status = urlObj.searchParams.get('status') || undefined;
      const proposals = await db.getProposals(status);
      return sendJson(res, 200, proposals, origin);
    }

    // PATCH /api/approvals/:id
    const patchApprovalMatch = pathname.match(/^\/api\/approvals\/([^/]+)$/);
    if (patchApprovalMatch && method === 'PATCH') {
      const propId = patchApprovalMatch[1];
      const patch = await parseJsonBody(req);
      const updated = await db.updateProposal(propId, patch);
      return sendJson(res, 200, updated, origin);
    }

    // POST /api/approvals/:id/approve
    const approveMatch = pathname.match(/^\/api\/approvals\/([^/]+)\/approve$/);
    if (approveMatch && method === 'POST') {
      const propId = approveMatch[1];
      const body = await parseJsonBody(req);
      const result = await db.decideProposal(propId, true, body.tasks);
      return sendJson(res, 200, result, origin);
    }

    // POST /api/approvals/:id/reject
    const rejectMatch = pathname.match(/^\/api\/approvals\/([^/]+)\/reject$/);
    if (rejectMatch && method === 'POST') {
      const propId = rejectMatch[1];
      const result = await db.decideProposal(propId, false);
      return sendJson(res, 200, result, origin);
    }

    // ----------------------------------------------------
    // 6. ACTIVITY LOGS
    // ----------------------------------------------------
    if (pathname === '/api/activity' && method === 'GET') {
      const status = urlObj.searchParams.get('status') || undefined;
      const activity = await db.getActivity({ status });
      return sendJson(res, 200, activity, origin);
    }

    // ----------------------------------------------------
    // 7. ANALYTICS
    // ----------------------------------------------------
    if (pathname === '/api/analytics' && method === 'GET') {
      const stats = await db.getAnalytics();
      return sendJson(res, 200, stats, origin);
    }

    // ----------------------------------------------------
    // 8. SETTINGS
    // ----------------------------------------------------
    if (pathname === '/api/settings') {
      if (method === 'GET') {
        const settings = await db.getSettings();
        return sendJson(res, 200, settings, origin);
      }
      if (method === 'POST') {
        const body = await parseJsonBody(req);
        const saved = await db.saveSettings(body);
        return sendJson(res, 200, saved, origin);
      }
    }

    // 404 Route Not Found
    return sendJson(res, 404, { error: `Endpoint not found: ${method} ${pathname}` }, origin);

  } catch (err) {
    console.error(`[API_ERROR] ${method} ${pathname}:`, err);
    return sendJson(res, 500, { error: err.message || 'Internal Server Error' }, origin);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SaarthiFlow Backend] Server listening on port ${PORT}`);
  console.log(`[SaarthiFlow Backend] Health check: http://localhost:${PORT}/api/health`);
  console.log(`[SaarthiFlow Backend] Storage: ${db.isSupabaseConfigured ? 'Supabase' : 'server/data/db.json'}`);
});
