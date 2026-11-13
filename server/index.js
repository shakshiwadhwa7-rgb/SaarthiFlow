import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import * as db from './db.js';
import * as gemini from './gemini.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path !== '/api/health') {
      console.log(`[API] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ==========================================
// 1. HEALTH CHECK
// ==========================================
app.get('/api/health', async (req, res) => {
  res.json({
    status: 'ok',
    app: 'SaarthiFlow API',
    version: '1.0.0',
    database: db.isSupabaseConfigured ? 'supabase-postgresql' : 'local-persistent-store',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here'),
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// 2. TASKS ENDPOINTS
// ==========================================
app.get('/api/tasks', async (req, res, next) => {
  try {
    const { status, priority, project } = req.query;
    const tasks = await db.getTasks({ status, priority, project });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

app.post('/api/tasks', async (req, res, next) => {
  try {
    const { title, project, priority, status, due } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Task title is required' });
    }
    const task = await db.createTask({ title, project, priority, status, due });
    
    // Log activity
    await db.logActivity({
      type: 'Task',
      title: `Task created: ${task.title}`,
      detail: `${task.project} · due ${task.due}`,
      source: 'My Space',
      status: 'Completed'
    });

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

app.patch('/api/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const patch = req.body;
    const existing = await db.getTaskById(id);
    if (!existing) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }

    const updated = await db.updateTask(id, patch);

    // Activity log if status changed or toggled
    if (patch.status && patch.status !== existing.status) {
      const isDone = patch.status === 'done';
      await db.logActivity({
        type: 'Task',
        title: `${isDone ? 'Completed' : 'Reopened'}: ${updated.title}`,
        detail: `Status changed to ${patch.status}`,
        source: 'My Space',
        status: 'Completed'
      });
    } else {
      await db.logActivity({
        type: 'Task',
        title: `Task updated: ${updated.title}`,
        detail: `Priority: ${updated.priority}, Due: ${updated.due}`,
        source: 'My Space',
        status: 'Completed'
      });
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

app.delete('/api/tasks/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteTask(id);

    await db.logActivity({
      type: 'Task',
      title: `Task deleted: ${deleted.title || id}`,
      detail: 'Removed from workspace',
      source: 'My Space',
      status: 'Cancelled'
    });

    res.json({ message: 'Task deleted successfully', task: deleted });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 3. PROJECTS ENDPOINTS
// ==========================================
app.get('/api/projects', async (req, res, next) => {
  try {
    const projects = await db.getProjects();
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

app.post('/api/projects', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    const project = await db.createProject(name);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 4. GEMINI AGENT & PLANNING ENDPOINTS
// ==========================================
app.post('/api/agent/plan', async (req, res, next) => {
  try {
    const { command, webpageUrl, webpageText } = req.body;
    if (!command || !command.trim()) {
      return res.status(400).json({ error: 'Command text is required for agent planning' });
    }

    const existingTasks = await db.getTasks();

    // Generate AI action plan
    const planResult = await gemini.generateActionPlan({
      command,
      webpageUrl,
      webpageText,
      existingTasks
    });

    // Create an agent run record
    const run = await db.createAgentRun({
      command,
      status: 'planned',
      raw_input: `${command}${webpageUrl ? ` (URL: ${webpageUrl})` : ''}`,
      output_summary: planResult.summary
    });

    // Create a pending action proposal in the database
    const proposal = await db.createProposal({
      title: command,
      source: 'Agent Studio',
      tasks: planResult.tasks
    });

    // Log the planning activity
    await db.logActivity({
      type: 'Plan',
      title: `AI Plan drafted: ${command}`,
      detail: `${planResult.tasks.length} proposed actions awaiting approval`,
      source: 'Agent Studio',
      status: 'Pending'
    });

    res.json({
      success: true,
      proposalId: proposal.id,
      runId: run.id,
      summary: planResult.summary,
      tasks: planResult.tasks,
      isSimulated: planResult.isSimulated,
      warning: planResult.warning || null
    });
  } catch (err) {
    console.error('[API] /api/agent/plan failed:', err);
    res.status(500).json({ error: err.message || 'Failed to generate agent plan' });
  }
});

app.get('/api/agent/runs', async (req, res, next) => {
  try {
    const runs = await db.getAgentRuns();
    res.json(runs);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 5. APPROVALS & HUMAN-IN-THE-LOOP EXECUTION
// ==========================================
app.get('/api/approvals', async (req, res, next) => {
  try {
    const { status } = req.query;
    const proposals = await db.getProposals(status);
    res.json(proposals);
  } catch (err) {
    next(err);
  }
});

app.patch('/api/approvals/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tasks, title } = req.body;
    const updated = await db.updateProposal(id, {
      ...(tasks ? { tasks } : {}),
      ...(title ? { title } : {})
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

app.post('/api/approvals/:id/approve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tasks } = req.body; // Optional user-edited tasks array

    const result = await db.decideProposal(id, true, tasks);
    res.json(result);
  } catch (err) {
    console.error(`[API] Approval execution failed for ${req.params.id}:`, err);
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/approvals/:id/reject', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.decideProposal(id, false);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ==========================================
// 6. ACTIVITY LOGS
// ==========================================
app.get('/api/activity', async (req, res, next) => {
  try {
    const { status } = req.query;
    const activity = await db.getActivity({ status });
    res.json(activity);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 7. ANALYTICS
// ==========================================
app.get('/api/analytics', async (req, res, next) => {
  try {
    const stats = await db.getAnalytics();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// ==========================================
// 8. SETTINGS
// ==========================================
app.get('/api/settings', async (req, res, next) => {
  try {
    const settings = await db.getSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

app.post('/api/settings', async (req, res, next) => {
  try {
    const saved = await db.saveSettings(req.body);
    await db.logActivity({
      type: 'Settings',
      title: 'Settings saved',
      detail: 'Preferences updated in backend',
      source: 'Settings',
      status: 'Completed'
    });
    res.json(saved);
  } catch (err) {
    next(err);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[UNHANDLED_ERROR]', err);
  res.status(500).json({
    error: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`[SaarthiFlow Backend] Server listening on port ${PORT}`);
  console.log(`[SaarthiFlow Backend] Health check: http://localhost:${PORT}/api/health`);
});
